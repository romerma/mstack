import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { preToolUse } from "../src/hooks.ts";
import { runningCliRoot } from "../src/paths.ts";
import { sandbox } from "./helpers.ts";

/**
 * Item 42, task 4.2: the PreToolUse hook under a mutation lock. Every lock is a
 * file in a throwaway repository's git directory; `cwd` is that repository, or
 * a directory with no repository at all.
 */

const LISTED = ["add", "am", "apply", "checkout", "cherry-pick", "clean", "commit", "merge", "mv", "pull", "rebase", "reset", "restore", "revert", "rm", "stash", "switch"];

interface Box {
  readonly root: string;
  readonly gitDir: string;
  readonly lockFile: string;
  dispose(): void;
}

/** A repository, and a directory outside any repository. */
function withBox(body: (box: Box, outside: string) => void): void {
  const sb = sandbox();
  const outside = mkdtempSync(join(tmpdir(), "mstack-hook-outside-"));
  try {
    const gitDir = join(sb.store.root, ".git");
    body({ root: sb.store.root, gitDir, lockFile: join(gitDir, "mstack-mutation.lock"), dispose: () => sb.dispose() }, outside);
  } finally {
    sb.dispose();
    rmSync(outside, { recursive: true, force: true });
  }
}

const lockText = (cli: string): string => `${JSON.stringify({ v: 1, run: "20261119T090000Z-4242-abcd", pid: 4242, cli, entries: [] })}\n`;

function decide(command: string, cwd: string): { denied: boolean; reason: string } {
  const out = preToolUse({ tool_name: "Bash", tool_input: { command }, cwd });
  if (out === null) return { denied: false, reason: "" };
  const parsed = JSON.parse(out) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } };
  return { denied: parsed.hookSpecificOutput.permissionDecision === "deny", reason: parsed.hookSpecificOutput.permissionDecisionReason };
}

/** A `git` first on PATH that writes a marker file and fails: it shows whether a git process starts. */
function fakeGit(body: (marker: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "mstack-fakegit-"));
  const marker = join(dir, "git-ran");
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "git"), `#!/bin/sh\necho "$@" >> '${marker}'\nexit 1\n`);
  chmodSync(join(bin, "git"), 0o755);
  const path = process.env["PATH"];
  process.env["PATH"] = `${bin}:${path ?? ""}`;
  try {
    body(marker);
  } finally {
    if (path === undefined) delete process.env["PATH"];
    else process.env["PATH"] = path;
    rmSync(dir, { recursive: true, force: true });
  }
}

test("R26 shapes caught under a lock", () => {
  withBox((box) => {
    writeFileSync(box.lockFile, lockText("/x/bin/mstack"));
    for (const command of ["git commit -m x", "git -C sub commit -am x", "git -c user.name=a add .", "cd x && git stash", "echo ok; git add -A", "git checkout ."]) {
      const d = decide(command, box.root);
      assert.ok(d.denied, `not denied under a lock: ${command}`);
      assert.match(d.reason, /verify --restore/, command);
    }
  });
});

test("R26 every listed git command is denied under a lock", () => {
  withBox((box) => {
    writeFileSync(box.lockFile, lockText("/x/bin/mstack"));
    for (const verb of LISTED) assert.ok(decide(`git ${verb} x`, box.root).denied, `git ${verb} was allowed under a lock`);
    // Git's global options do not hide the verb.
    assert.ok(decide("git --no-pager -C . reset HEAD~1", box.root).denied, "the safe reset forms are denied under a lock");
    // What is not listed, and what only starts with a listed word.
    for (const command of ["git status", "git log -1", "git diff", "git commit-tree HEAD^{tree}", "git add-note x", "git branch -a"]) {
      assert.ok(!decide(command, box.root).denied, `denied under a lock though it is not listed: ${command}`);
    }
  });
});

test("R26 shapes not caught are allowed", () => {
  withBox((box, outside) => {
    writeFileSync(box.lockFile, lockText("/x/bin/mstack"));
    for (const command of ['git ci -m x', '"git" commit -m x', 'git -C "dir with space" commit -m x', `node -e "require('child_process').execFileSync('git',['commit','-m','x'])"`, "npm version patch"]) {
      assert.ok(!decide(command, box.root).denied, `denied though the hook is said not to see it: ${command}`);
    }
    assert.ok(!decide(`git -C ${box.root} commit -m x`, outside).denied, "a git -C from a cwd outside the repository was denied");
  });
});

test("R26 an unrelated command spawns no git", () => {
  withBox((box) => {
    writeFileSync(box.lockFile, lockText("/x/bin/mstack"));
    fakeGit((marker) => {
      for (const command of ["ls -la", "echo hello && pwd", "bun test tests/foo.test.ts", "rm -rf node_modules"]) decide(command, box.root);
      assert.ok(!existsSync(marker), "a git process started for a command with no listed git segment");
      decide("git commit -m x", box.root);
      assert.ok(existsSync(marker), "the control: a listed git command asks git for the git directory");
    });
  });
});

test("R26 no lock, or git cannot answer, allows", () => {
  withBox((box, outside) => {
    assert.ok(!decide("git commit -m x", box.root).denied, "denied with no lock");
    writeFileSync(box.lockFile, lockText("/x/bin/mstack"));
    assert.ok(decide("git commit -m x", box.root).denied, "the control: the same command is denied with a lock");
    assert.ok(!decide("git commit -m x", outside).denied, "denied from a directory that is not in a repository");
    fakeGit(() => {
      assert.ok(!decide("git commit -m x", box.root).denied, "denied when git cannot name the git directory");
    });
  });
});

test("R26 an unparseable lock still denies", () => {
  withBox((box) => {
    writeFileSync(box.lockFile, "garbage");
    const d = decide("git commit -m x", box.root);
    assert.ok(d.denied, "a lock that does not parse allowed git commit");
    assert.match(d.reason, /mstack-mutation\.lock/);
    assert.match(d.reason, /mstack gate/);
    rmSync(box.lockFile);
    mkdirSync(box.lockFile);
    assert.ok(decide("git add .", box.root).denied, "a directory at the lock's name allowed git add");
  });
});

test("R26 rm of the lock is denied, with a lock or without one", () => {
  withBox((box) => {
    const commands = [`rm .git/mstack-mutation.lock`, `rm -f ${box.lockFile}`, `rm -f "${box.lockFile}"`, `cd x && rm -rf .git/mstack-mutation.lock`];
    fakeGit((marker) => {
      for (const withLock of [false, true]) {
        if (withLock) writeFileSync(box.lockFile, lockText("/x/bin/mstack"));
        for (const command of commands) {
          const d = decide(command, box.root);
          assert.ok(d.denied, `${withLock ? "with" : "without"} a lock, not denied: ${command}`);
          assert.match(d.reason, /mstack gate/);
        }
      }
      assert.ok(!existsSync(marker), "a git process started for an rm of the lock");
      for (const command of ["rm .git/mstack-mutation.lock.20261119T090000Z-1-abcd.tmp", "rm .git/mstack-mutation.lockfile", "ls .git/mstack-mutation.lock"]) {
        assert.ok(!decide(command, box.root).denied, `denied though it does not delete the lock: ${command}`);
      }
    });
  });
});

test("R25 the deny reason names the lock's CLI", () => {
  withBox((box) => {
    const running = join(runningCliRoot(), "bin", "mstack");
    const gone = join(tmpdir(), "mstack-no-such-copy", "bin", "mstack");
    writeFileSync(box.lockFile, lockText(gone));
    const d = decide("git commit -m x", box.root);
    assert.ok(d.reason.includes(`${gone} verify --restore`) && d.reason.includes(`${running} verify --restore`), d.reason);
    assert.ok(d.reason.includes(box.lockFile) && d.reason.includes("4242"), d.reason);
    assert.doesNotMatch(d.reason, /\bsh [^\n]*mstack-mutation\.lock/);
    writeFileSync(box.lockFile, lockText(running));
    const there = decide("git commit -m x", box.root).reason;
    assert.ok(there.includes(`${running} verify --restore`), there);
  });
});
