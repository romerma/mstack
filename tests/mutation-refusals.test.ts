import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { lockPath, refusals, type Refusal } from "../src/mutation.ts";
import type { Item, State } from "../src/state.ts";
import { item, sandbox, state, type Sandbox } from "./helpers.ts";

/**
 * Item 42, task 1.2: the refusals of R1, R2 and R5 that need no staging. Each
 * test asserts the message, and that nothing was written: no lock, no run
 * directory, no new receipt row.
 */

/** A file written as `probe` is found as `PROBE`: the filesystem folds case. */
const caseInsensitive = ((): boolean => {
  const dir = mkdtempSync(join(tmpdir(), "mstack-case-"));
  try {
    writeFileSync(join(dir, "probe"), "");
    return existsSync(join(dir, "PROBE"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
})();
const CASE = { skip: caseInsensitive ? false : "needs a case-insensitive filesystem" };

const git = (root: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function put(root: string, rel: string, content: string): void {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function commitAll(root: string, message: string): string {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
  return git(root, "rev-parse", "HEAD");
}

/** An active item with a base and an obligation, and the state that holds it. */
function active(base: string | undefined, overrides: Record<string, unknown> = {}): { st: State; it: Item } {
  const it = item({ status: "in_progress", ...(base === undefined ? {} : { base }), ...overrides }) as unknown as Item;
  const st = state([it], { verify: "true" }) as State;
  return { st, it };
}

/**
 * The sandbox at its start: `src/a.ts` committed with the store, so a later
 * commit has code to revert. Returns the start's sha.
 */
function started(box: Sandbox): string {
  put(box.store.root, "src/a.ts", "a\n");
  return commitAll(box.store.root, "start");
}

/** The git directory, asked of git by the test itself; null outside a repository. */
function gitDir(box: Sandbox): string | null {
  try {
    return git(box.store.root, "rev-parse", "--absolute-git-dir");
  } catch {
    return null;
  }
}

/** Run `refusals` and check that it wrote nothing: no lock, no run directory, no receipt row. */
function refuse(box: Sandbox, st: State, it: Item | undefined, running?: string): Refusal | null {
  const dir = gitDir(box);
  const lock = dir === null ? null : join(dir, "mstack-mutation.lock");
  const lockBefore = lock !== null && existsSync(lock);
  const receipts = existsSync(box.store.verification) ? readFileSync(box.store.verification, "utf8") : null;
  const result = running === undefined ? refusals(box.store, st, it) : refusals(box.store, st, it, running);
  if (dir !== null && lock !== null) {
    assert.equal(existsSync(lock), lockBefore, "the lock was written or removed");
    assert.equal(existsSync(join(dir, "mstack-mutation")), false, "a run directory was written");
  }
  const after = existsSync(box.store.verification) ? readFileSync(box.store.verification, "utf8") : null;
  assert.equal(after, receipts, "a receipt row was written");
  return result;
}

function withBox(body: (box: Sandbox) => void, options: { git?: boolean } = {}): void {
  const box = sandbox(options);
  try {
    body(box);
  } finally {
    box.dispose();
  }
}

function refused(r: Refusal | null, pattern: RegExp): Refusal {
  assert.ok(r !== null, `expected a refusal matching ${pattern}, got none`);
  assert.match(`${r.message}\n${r.fix}`, pattern);
  return r;
}

test("R1 no active item", () => {
  withBox((box) => {
    started(box);
    const r = refused(refuse(box, state([], { verify: "true" }) as State, undefined), /no active item/);
    assert.match(r.fix, /state set/);
  });
});

test("R1 not a git repository", () => {
  withBox(
    (box) => {
      const { st, it } = active("0".repeat(40));
      refused(refuse(box, st, it), /not in a git repository/);
      assert.equal(lockPath(box.store), null);
    },
    { git: false },
  );
});

test("R1 no base, and a base that is not a commit", () => {
  withBox((box) => {
    started(box);
    const none = active(undefined);
    refused(refuse(box, none.st, none.it), /has no base[\s\S]*--base <commit>/);
    const bad = active("f".repeat(40));
    refused(refuse(box, bad.st, bad.it), new RegExp(`base ${"f".repeat(40)} is not a commit[\\s\\S]*--base <commit>`));
  });
});

test("R1 start lost", () => {
  withBox((box) => {
    const root = box.store.root;
    git(root, "branch", "-M", "stem");
    started(box);
    git(root, "checkout", "-q", "-b", "side");
    put(root, "src/a.ts", "side\n");
    const base = commitAll(root, "a base on a branch HEAD will not hold");
    git(root, "checkout", "-q", "stem");
    put(root, "src/a.ts", "stem\n");
    commitAll(root, "the item, elsewhere");
    const { st, it } = active(base);
    refused(refuse(box, st, it), /start .*lost[\s\S]*--base <commit>/);
  });
});

test("R1 no obligations", () => {
  withBox((box) => {
    const start = started(box);
    put(box.store.root, "src/a.ts", "a2\n");
    commitAll(box.store.root, "the item");
    const it = item({ status: "in_progress", base: start }) as unknown as Item;
    refused(refuse(box, state([it]) as State, it), /no verification command[\s\S]*--verification/);
  });
});

test("R1 a rebase in progress", () => {
  withBox((box) => {
    const start = started(box);
    put(box.store.root, "src/a.ts", "a2\n");
    commitAll(box.store.root, "the item");
    mkdirSync(join(git(box.store.root, "rev-parse", "--absolute-git-dir"), "rebase-merge"));
    const { st, it } = active(start);
    refused(refuse(box, st, it), /a rebase is in progress[\s\S]*git rebase --continue/);
  });
});

test("R1 a detached HEAD is allowed", () => {
  withBox((box) => {
    const start = started(box);
    put(box.store.root, "src/a.ts", "a2\n");
    commitAll(box.store.root, "the item");
    git(box.store.root, "checkout", "-q", "--detach");
    const { st, it } = active(start);
    assert.equal(refuse(box, st, it), null);
  });
});

test("R1 an existing lock is refused naming its pid", () => {
  withBox((box) => {
    const start = started(box);
    put(box.store.root, "src/a.ts", "a2\n");
    commitAll(box.store.root, "the item");
    const lock = lockPath(box.store);
    assert.ok(lock !== null);
    assert.equal(lock, join(git(box.store.root, "rev-parse", "--absolute-git-dir"), "mstack-mutation.lock"));
    writeFileSync(lock, JSON.stringify({ v: 1, pid: 4242, startedAt: "2026-11-19T09:02:11Z", cli: "/opt/mstack/bin/mstack" }));
    const { st, it } = active(start);
    const r = refused(refuse(box, st, it), /4242/);
    assert.match(`${r.message}\n${r.fix}`, /2026-11-19T09:02:11Z/);
    assert.match(r.fix, /\/opt\/mstack\/bin\/mstack verify --restore/);
  });
});

test("R1 an empty revert set: only tests and docs, or only untracked code", () => {
  withBox((box) => {
    const root = box.store.root;
    const start = started(box);
    put(root, "tests/a.test.ts", "t\n");
    put(root, "docs/x.md", "d\n");
    commitAll(root, "tests and docs only");
    const { st, it } = active(start);
    refused(refuse(box, st, it), new RegExp(`no code changed since ${start.slice(0, 8)}`));
    put(root, "src/wip.ts", "untracked work\n");
    refused(refuse(box, st, it), new RegExp(`no code changed since ${start.slice(0, 8)}`));
    assert.equal(readFileSync(join(root, "src/wip.ts"), "utf8"), "untracked work\n");
  });
});

test("R2 a dirty tracked file", () => {
  withBox((box) => {
    const root = box.store.root;
    const start = started(box);
    put(root, "src/b.ts", "b\n");
    commitAll(root, "the item");
    put(root, "src/a.ts", "an uncommitted edit\n");
    const { st, it } = active(start);
    refused(refuse(box, st, it), /src\/a\.ts/);
    assert.equal(readFileSync(join(root, "src/a.ts"), "utf8"), "an uncommitted edit\n");
  });
});

test("R2 dirty store files are allowed", () => {
  withBox((box) => {
    const root = box.store.root;
    const start = started(box);
    put(root, "src/a.ts", "a2\n");
    commitAll(root, "the item");
    writeFileSync(box.store.state, `${readFileSync(box.store.state, "utf8")}\n`);
    writeFileSync(box.store.current, "# Current session\n\nedited\n");
    const { st, it } = active(start);
    assert.equal(refuse(box, st, it), null);
  });
});

test("R2 an untracked file where the revert puts one back", () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/old.ts", "old\n");
    const start = started(box);
    rmSync(join(root, "src/old.ts"));
    commitAll(root, "the item deletes src/old.ts");
    put(root, "src/old.ts", "untracked, not the start's\n");
    const { st, it } = active(start);
    refused(refuse(box, st, it), /src\/old\.ts/);
    assert.equal(readFileSync(join(root, "src/old.ts"), "utf8"), "untracked, not the start's\n");
  });
});

test("R2 a case variant where the revert puts a file back", CASE, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/old.ts", "old\n");
    const start = started(box);
    rmSync(join(root, "src/old.ts"));
    commitAll(root, "the item deletes src/old.ts");
    put(root, "src/OLD.ts", "a variant\n");
    const { st, it } = active(start);
    refused(refuse(box, st, it), /src\/old\.ts/);
    assert.equal(readFileSync(join(root, "src/OLD.ts"), "utf8"), "a variant\n");
  });
});

test("R2 a path of the set on disk under another case", CASE, () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/foo.ts", "foo\n");
    const start = started(box);
    put(root, "src/foo.ts", "foo2\n");
    commitAll(root, "the item");
    renameSync(join(root, "src/foo.ts"), join(root, "src/Foo.ts"));
    const { st, it } = active(start);
    refused(refuse(box, st, it), /src\/foo\.ts[\s\S]*src\/Foo\.ts/);
  });
});

test("R2 an untracked symlink at a parent directory", () => {
  withBox((box) => {
    const root = box.store.root;
    put(root, "src/lib/x.ts", "x\n");
    const start = started(box);
    rmSync(join(root, "src/lib"), { recursive: true });
    commitAll(root, "the item deletes src/lib/x.ts");
    const outside = mkdtempSync(join(tmpdir(), "mstack-outside-"));
    try {
      symlinkSync(outside, join(root, "src/lib"));
      const { st, it } = active(start);
      refused(refuse(box, st, it), /src\/lib\b/);
      assert.deepEqual(readdirSync(outside), [], "something was written through the link");
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

test("R5 a revert path inside the running CLI is refused with the copy commands, and not from a copy", () => {
  withBox((box) => {
    const root = box.store.root;
    const start = started(box);
    put(root, "src/run-helper.mjs", "// changed\n");
    commitAll(root, "the item changes the CLI's own source");
    const { st, it } = active(start);
    const r = refused(refuse(box, st, it, root), /src\/run-helper\.mjs/);
    assert.match(r.fix, /git worktree add --detach /);
    assert.match(r.fix, /verify --mutation/);
    assert.match(r.fix, /git worktree remove /);
    const copy = mkdtempSync(join(tmpdir(), "mstack-copy-"));
    try {
      assert.equal(refuse(box, st, it, copy), null);
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });
});
