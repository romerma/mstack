import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { basename, join } from "node:path";

import { runGate } from "../src/gate.ts";
import { runningCliRoot } from "../src/paths.ts";
import { stop } from "../src/hooks.ts";
import { prunable } from "../src/worktree.ts";
import { captured, expectFail, item, state, trackCurrent } from "./helpers.ts";
import { git, gitDirOf, locked, lockFileOf, withRepo, type Repo } from "./mutation-fixture.ts";

/**
 * Item 42, task 4.1: the gate and `worktree prune` know a lock and a rescue.
 * Every repository is a sandbox; a lock is written into that repository's git
 * directory, never into the checkout the suite runs from.
 */

const twoFiles = (root: string): void => {
  writeFileSync(join(root, "a.txt"), "a\n");
};
const edit = (root: string): void => {
  writeFileSync(join(root, "a.txt"), "a2\n");
};

/** The fast gate, quiet, as the Stop hook and a script run it. */
function quiet(r: Repo): { failed: boolean; failures: readonly string[]; warnings: readonly string[]; err: string } {
  const { value, err } = captured(() => runGate(r.store, { quiet: true }));
  return { failed: value.failed, failures: value.failures, warnings: value.warnings, err };
}

/** A pid that has exited. */
const deadPid = (): number => {
  const pid = spawnSync(process.execPath, ["-e", "0"]).pid;
  assert.ok(typeof pid === "number" && pid > 0);
  return pid;
};

/** Rewrite fields of the lock on disk. */
function editLock(r: Repo, patch: Record<string, unknown>): void {
  const file = lockFileOf(r);
  const lock = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...lock, ...patch }, null, 2)}\n`);
}

/** An item in progress with its notes in place, so that nothing but the lock is red. */
function inProgress(r: Repo): void {
  r.box.writeState(state([item({ status: "in_progress", base: r.start })], { verify: "true" }));
  trackCurrent(r.box);
}

const lineWith = (failures: readonly string[], word: RegExp): string => {
  const found = failures.find((f) => word.test(f));
  assert.ok(found !== undefined, `no failure matched ${word}: ${JSON.stringify(failures)}`);
  return found;
};

test("R27 a lock fails the gate with no active item", () => {
  withRepo(twoFiles, edit, (r) => {
    r.box.writeState(state([]));
    assert.equal(quiet(r).failed, false, "the gate is red before there is a lock");
    locked(r);
    const idle = quiet(r);
    assert.ok(idle.failed, "a lock and no active item left the gate green");
    assert.match(lineWith(idle.failures, /mstack-mutation\.lock/), new RegExp(`pid ${process.pid}\\b`));
    assert.equal(idle.err.trim().split("\n").length, 1, `one line was expected: ${idle.err}`);
    inProgress(r);
    expectFail(runGate(r.store, { quiet: true }), /mstack-mutation\.lock/, "an item in progress");
  });
});

test("R27 the line says running, not running or cannot tell", () => {
  withRepo(twoFiles, edit, (r) => {
    r.box.writeState(state([]));
    const lock = locked(r);
    const running = lineWith(quiet(r).failures, /mstack-mutation\.lock/);
    assert.match(running, /is running/);
    assert.match(running, /wait/);
    assert.doesNotMatch(running, /verify --restore/, "a live run is not told to restore");
    assert.ok(running.includes(lock.startedAt) && running.includes("1 path(s)"), running);

    editLock(r, { pid: deadPid() });
    const dead = lineWith(quiet(r).failures, /mstack-mutation\.lock/);
    assert.match(dead, /not running/);
    assert.match(dead, /verify --restore/);

    editLock(r, { host: "another-host.invalid" });
    const unknown = lineWith(quiet(r).failures, /mstack-mutation\.lock/);
    assert.match(unknown, /cannot be told/);
    assert.ok(unknown.includes("another-host.invalid"), "it does not say where to run the restore");
    assert.match(unknown, /git stash push --include-untracked/);
    assert.ok(hostname() !== "another-host.invalid");
  });
});

test("R27 an unparseable lock fails the gate", () => {
  withRepo(twoFiles, edit, (r) => {
    r.box.writeState(state([]));
    writeFileSync(join(gitDirOf(r), "mstack-mutation.lock"), "garbage");
    const line = lineWith(quiet(r).failures, /mstack-mutation\.lock/);
    assert.match(line, /cannot be read/);
    assert.match(line, /git stash push --include-untracked/);
    assert.match(line, /discard/);
  });
});

test("R27 the Stop hook carries the line", () => {
  withRepo(twoFiles, edit, (r) => {
    inProgress(r);
    locked(r);
    editLock(r, { pid: deadPid() });
    const { value } = captured(() => stop({ cwd: r.root }));
    assert.ok(value !== null, "the Stop hook said nothing under a lock");
    const context = (JSON.parse(value) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
    assert.match(context, /mstack-mutation\.lock/);
    assert.match(context, /not running/);
    assert.match(context, /verify --restore/);
  });
});

test("R27 gate --full runs nothing under a lock", () => {
  withRepo(twoFiles, edit, (r) => {
    const marker = join(r.root, "ran.marker");
    r.box.writeState(state([item({ status: "in_progress", base: r.start })], { verify: `node -e "require('fs').writeFileSync('${marker}','ran')"` }));
    trackCurrent(r.box);
    locked(r);
    const before = existsSync(r.store.verification) ? readFileSync(r.store.verification, "utf8") : null;
    const { value: held } = captured(() => runGate(r.store, { full: true }));
    assert.ok(held.failed, "gate --full passed under a lock");
    assert.ok(!existsSync(marker), "gate --full ran the obligation under a lock");
    const after = existsSync(r.store.verification) ? readFileSync(r.store.verification, "utf8") : null;
    assert.equal(after, before, "gate --full recorded a receipt under a lock");

    rmSync(lockFileOf(r));
    captured(() => runGate(r.store, { full: true }));
    assert.ok(existsSync(marker), "without a lock the obligation did not run: the command proves nothing");
  });
});

test("R25 the gate line names the lock's CLI, and the running CLI when that path is gone", () => {
  withRepo(twoFiles, edit, (r) => {
    r.box.writeState(state([]));
    locked(r);
    editLock(r, { pid: deadPid() });
    const running = join(runningCliRoot(), "bin", "mstack");
    const base = mkdtempSync(join(tmpdir(), "mstack-cli-"));
    try {
      const there = join(base, "bin", "mstack");
      mkdirSync(join(base, "bin"));
      writeFileSync(there, "#!/bin/sh\n");
      editLock(r, { cli: there });
      const found = lineWith(quiet(r).failures, /mstack-mutation\.lock/);
      assert.ok(found.includes(`${there} verify --restore`), found);
      assert.ok(!found.includes(running), "the running CLI is named although the lock's CLI exists");

      rmSync(there);
      const gone = lineWith(quiet(r).failures, /mstack-mutation\.lock/);
      assert.ok(gone.includes(`${there} verify --restore`) && gone.includes(`${running} verify --restore`), gone);
      assert.doesNotMatch(gone, /\bsh [^\n]*mstack-mutation\.lock/);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

/** `<git dir>/mstack-mutation/<run>/rescue/<k>/a.ts` for each k. */
function rescue(gitDir: string, ...ks: string[]): string {
  const dir = join(gitDir, "mstack-mutation", "20260101T000000Z-1-abcd", "rescue");
  mkdirSync(dir, { recursive: true });
  for (const k of ks) {
    mkdirSync(join(dir, k));
    writeFileSync(join(dir, k, "a.ts"), "saved\n");
  }
  return dir;
}

test("R28 a rescue directory that holds anything is a warning", () => {
  withRepo(twoFiles, edit, (r) => {
    r.box.writeState(state([]));
    const base = quiet(r);
    const gitDir = gitDirOf(r);
    rescue(gitDir);
    assert.deepEqual(quiet(r).warnings, base.warnings, "an empty rescue directory warned");
    const dir = rescue(gitDir, "1");
    const one = quiet(r);
    assert.deepEqual([one.failed, one.failures], [base.failed, base.failures], "a rescue changed what the gate fails on");
    const warning = one.warnings.find((w) => w.includes(dir));
    assert.ok(warning !== undefined && /1 entry/.test(warning), JSON.stringify(one.warnings));
    rescue(gitDir, "2");
    assert.ok(quiet(r).warnings.some((w) => w.includes(dir) && /2 entries/.test(w)));
  });
});

test("R28 a linked worktree's rescue warns from the main checkout, and prune offers no worktree holding a lock or a rescue", () => {
  withRepo(twoFiles, edit, (r) => {
    r.box.writeState(state([]));
    const base = mkdtempSync(join(tmpdir(), "mstack-wt-"));
    try {
      const wt = join(base, "linked");
      git(r.root, "worktree", "add", "-q", "-b", "linked-branch", wt);
      const names = (): string[] => prunable(r.store).map((c) => basename(c.info.path));
      assert.deepEqual(names(), ["linked"], "the control: a clean, merged worktree is offered");

      const linkedGit = git(wt, "rev-parse", "--absolute-git-dir");
      const dir = rescue(linkedGit, "1");
      const warning = quiet(r).warnings.find((w) => w.includes(dir));
      assert.ok(warning !== undefined && /1 entry/.test(warning), `the main checkout's gate did not warn: ${JSON.stringify(quiet(r).warnings)}`);
      assert.deepEqual(names(), [], "prune offered a worktree whose rescue holds something");

      rmSync(join(linkedGit, "mstack-mutation"), { recursive: true });
      assert.deepEqual(names(), ["linked"]);
      writeFileSync(join(linkedGit, "mstack-mutation.lock"), "garbage");
      assert.deepEqual(names(), [], "prune offered a worktree that holds a lock");
      rmSync(join(linkedGit, "mstack-mutation.lock"));
      execFileSync("git", ["worktree", "remove", "--force", wt], { cwd: r.root });
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

test("R27 the line for a lock that cannot be read says the way out is a person at a terminal", () => {
  // Round 2 review, non-blocking 2: the hook denies an agent both steps of the by-hand way.
  withRepo(twoFiles, edit, (r) => {
    r.box.writeState(state([]));
    for (const text of ["garbage", JSON.stringify({ v: 1 })]) {
      writeFileSync(join(gitDirOf(r), "mstack-mutation.lock"), text);
      const line = lineWith(quiet(r).failures, /mstack-mutation\.lock/);
      assert.match(line, /cannot be read/, text);
      assert.match(line, /for a person at a terminal/, text);
      assert.match(line, /git stash push --include-untracked/, text);
    }
  });
});

test("R27 gate --full runs nothing under a lock that cannot be parsed", () => {
  // Round 2 review, non-blocking 3, mutant g: only the lock's name decides, not whether it parses.
  withRepo(twoFiles, edit, (r) => {
    const marker = join(r.root, "ran.marker");
    r.box.writeState(state([item({ status: "in_progress", base: r.start })], { verify: `node -e "require('fs').writeFileSync('${marker}','ran')"` }));
    trackCurrent(r.box);
    writeFileSync(lockFileOf(r), "garbage");
    const before = existsSync(r.store.verification) ? readFileSync(r.store.verification, "utf8") : null;
    const { value } = captured(() => runGate(r.store, { full: true }));
    assert.ok(value.failed, "gate --full passed under a lock that cannot be parsed");
    assert.ok(!existsSync(marker), "gate --full ran the obligation under a lock that cannot be parsed");
    assert.equal(existsSync(r.store.verification) ? readFileSync(r.store.verification, "utf8") : null, before, "gate --full recorded a receipt");
    assert.equal(readFileSync(lockFileOf(r), "utf8"), "garbage");
  });
});
