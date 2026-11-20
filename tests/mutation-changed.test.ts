import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readLock } from "../src/mutation-lock.ts";
import { restoreFromLock } from "../src/mutation-tree.ts";
import { readRecords } from "../src/tsv.ts";
import { git, lockFileOf, mutate, once, put, SPAWN_TEST, withRunRepo, type RunRepo } from "./mutation-fixture.ts";

/**
 * Item 42, task 3.2: the tree changed under the run (R18), the lock written
 * again when it vanished and the restore failed (R15), and the report of what
 * else changed (R19). Each change is made from the `step` callback at
 * `obligations-running`, while the check runs on the reverted tree.
 */

const CHECK = 'echo run >> "$1"\ngrep -q new src/a.ts\n';
const startA = (root: string): void => put(root, "src/a.ts", "old\n");
const editA = (root: string): void => put(root, "src/a.ts", "new\n");
const withSnapshot = (root: string): void => {
  startA(root);
  put(root, "tests/a.snap", "snapshot\n");
};
const read = (r: RunRepo, rel: string): string => readFileSync(join(r.root, rel), "utf8");
const mutationRows = (r: RunRepo): Record<string, string>[] => readRecords(r.store.verification).filter((x) => (x["outcome"] ?? "").startsWith("mutation-"));
const during = (act: () => void): { step: (name: string) => void } => ({ step: once("obligations-running", act) });
const CHANGED = /^mutation-blocked: the tree changed under the run/;

// bun ignores the `skip` option of node:test, so the function is chosen; a read-only directory stops nobody running as root.
const userTest = process.getuid?.() === 0 ? test.skip : test;

test("R18 an edit to a reverted file during the run", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const m = await mutate(r, during(() => writeFileSync(join(r.root, "src/a.ts"), "an edit during the run\n")));
    assert.equal(m.code, 2, m.text);
    assert.match(m.last, CHANGED);
    assert.match(m.last, /\(a\)[^;]*src\/a\.ts/);
    assert.deepEqual(mutationRows(r), []);
    assert.equal(read(r, "src/a.ts"), "new\n");
    const rescued = m.lines.find((l) => /rescued src\/a\.ts to /.test(l));
    assert.ok(rescued !== undefined, m.text);
    assert.equal(readFileSync(rescued.replace(/^.* to /, ""), "utf8"), "an edit during the run\n");
  });
});

test("R18 a commit during the run", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const m = await mutate(r, during(() => git(r.root, "commit", "-q", "-am", "a commit during the run")));
    assert.equal(m.code, 2, m.text);
    assert.match(m.last, CHANGED);
    assert.match(m.last, /\(b\)/);
    assert.deepEqual(mutationRows(r), []);
  });
});

test("R18 the lock deleted during the run: restored, no row", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const m = await mutate(r, during(() => rmSync(lockFileOf(r))));
    assert.equal(m.code, 2, m.text);
    assert.match(m.last, CHANGED);
    assert.match(m.last, /\(c\)/);
    assert.equal(read(r, "src/a.ts"), "new\n");
    assert.equal(existsSync(lockFileOf(r)), false);
    assert.deepEqual(mutationRows(r), []);
  });
});

test("R18 a git add during the run", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const m = await mutate(r, during(() => git(r.root, "add", "src/a.ts")));
    assert.equal(m.code, 2, m.text);
    assert.match(m.last, CHANGED);
    assert.match(m.last, /\(d\)[^;]*src\/a\.ts/);
    assert.deepEqual(mutationRows(r), []);
  });
});

test("R18 a tracked test file rewritten during the run", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, withSnapshot, editA, async (r) => {
    const m = await mutate(r, during(() => writeFileSync(join(r.root, "tests/a.snap"), "rewritten\n")));
    assert.equal(m.code, 2, m.text);
    assert.match(m.last, CHANGED);
    assert.match(m.last, /\(d\)[^;]*tests\/a\.snap/);
    assert.deepEqual(mutationRows(r), []);
    assert.equal(read(r, "tests/a.snap"), "rewritten\n");
  });
});

test("R18 an untracked test file edited during the run", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    put(r.root, "tests/new.test.ts", "t\n");
    const m = await mutate(r, during(() => writeFileSync(join(r.root, "tests/new.test.ts"), "t2\n")));
    assert.equal(m.code, 2, m.text);
    assert.match(m.last, CHANGED);
    assert.match(m.last, /\(e\)[^;]*tests\/new\.test\.ts/);
    assert.doesNotMatch(m.last, /\((a|b|c|d)\)/);
    assert.deepEqual(mutationRows(r), []);
  });
});

test("R18 a non-ignored output file written by the obligation", SPAWN_TEST, async () => {
  await withRunRepo('echo run >> "$1"\ngrep -q new src/a.ts || { echo x > out.log; exit 1; }\n', startA, editA, async (r) => {
    const m = await mutate(r);
    assert.equal(m.code, 2, m.text);
    assert.match(m.last, CHANGED);
    assert.match(m.last, /\(e\)[^;]*out\.log/);
    assert.match(m.last, /\.gitignore/);
    assert.deepEqual(mutationRows(r), []);
    assert.equal(read(r, "out.log"), "x\n");
  });
});

userTest("R15 a failed restore after the lock was deleted writes the lock again", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    try {
      const m = await mutate(r, during(() => {
        rmSync(lockFileOf(r));
        chmodSync(join(r.root, "src"), 0o555);
      }));
      assert.equal(m.code, 3, m.text);
      const run = /, run (\S+)$/.exec(m.lines.find((l) => l.startsWith("mutation: lock ")) ?? "")?.[1];
      const held = readLock(r.store);
      assert.ok(held !== null && "lock" in held, "no lock after a failed restore");
      assert.equal(held.lock.run, run);
      assert.match(m.text, /verify --restore/);
      assert.match(m.last, /\(c\)/);
    } finally {
      chmodSync(join(r.root, "src"), 0o755);
    }
    const held = readLock(r.store);
    assert.ok(held !== null && "lock" in held);
    assert.deepEqual(restoreFromLock(r.store, held.lock).failed, []);
    assert.equal(read(r, "src/a.ts"), "new\n");
    assert.deepEqual(mutationRows(r), []);
  });
});

test("R19 HEAD moved: both shas and git reset, mixed", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const old = git(r.root, "rev-parse", "HEAD");
    const m = await mutate(r, during(() => git(r.root, "commit", "-q", "-am", "a commit during the run")));
    const now = git(r.root, "rev-parse", "HEAD");
    assert.notEqual(now, old);
    assert.equal(read(r, "src/a.ts"), "new\n", "the working tree does not have the item's code again");
    assert.ok(m.text.includes(old.slice(0, 8)) && m.text.includes(now.slice(0, 8)), m.text);
    assert.ok(m.text.includes(`git reset ${old}`), m.text);
    assert.doesNotMatch(m.text, /--soft/);
  });
});

test("R19 HEAD on another branch: git switch to the lock's branch, and no reset when that branch did not move", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const branch = git(r.root, "symbolic-ref", "--short", "HEAD");
    const m = await mutate(r, during(() => {
      git(r.root, "switch", "-q", "-c", "other");
      git(r.root, "commit", "-q", "--allow-empty", "-m", "on another branch");
    }));
    assert.equal(m.code, 2, m.text);
    assert.ok(m.text.includes(`git switch ${branch}`), m.text);
    assert.doesNotMatch(m.text, /git reset/);
  });
});

test("R19 the index line names git restore --staged and what it discards", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const m = await mutate(r, during(() => git(r.root, "add", "src/a.ts")));
    const line = m.lines.find((l) => l.includes("git restore --staged -- src/a.ts"));
    assert.ok(line !== undefined, m.text);
    assert.match(line, /git diff --cached -- src\/a\.ts/);
    assert.match(line, /discards/);
    assert.equal(git(r.root, "diff", "--cached", "--name-only"), "src/a.ts", "the staged version was not left as it was");
  });
});

test("R19 left in place and changed files are reported without a cause", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, withSnapshot, editA, async (r) => {
    const m = await mutate(r, during(() => {
      git(r.root, "add", "src/a.ts");
      writeFileSync(join(r.root, "tests/a.snap"), "rewritten\n");
      writeFileSync(join(r.root, "out.log"), "log\n");
    }));
    assert.equal(m.code, 2, m.text);
    assert.ok(m.lines.some((l) => l.includes("git restore --staged -- src/a.ts") && /discards/.test(l)), m.text);
    assert.ok(m.lines.some((l) => l.includes("tests/a.snap") && l.includes("git diff -- tests/a.snap")), m.text);
    assert.ok(m.lines.some((l) => /left in place: out\.log/.test(l)), m.text);
    assert.doesNotMatch(m.text, /obligation/i);
    assert.equal(git(r.root, "diff", "--cached", "--name-only"), "src/a.ts");
    assert.equal(read(r, "tests/a.snap"), "rewritten\n");
    assert.equal(read(r, "out.log"), "log\n");
  });
});

test("R18 an edit to a path the item added, made during the run, writes no row", SPAWN_TEST, async () => {
  // Round 2 review, non-blocking 3, mutant l: (a) blind to a path the start lacks wrote a killed row here.
  const addB = (root: string): void => {
    editA(root);
    put(root, "src/b.ts", "added by the item\n");
  };
  await withRunRepo(CHECK, startA, addB, async (r) => {
    const m = await mutate(r, during(() => writeFileSync(join(r.root, "src/b.ts"), "an edit during the run\n")));
    assert.equal(m.code, 2, m.text);
    assert.match(m.last, CHANGED);
    assert.match(m.last, /\(a\)[^;]*src\/b\.ts/);
    assert.deepEqual(mutationRows(r), []);
    assert.equal(read(r, "src/b.ts"), "added by the item\n");
    const rescued = m.lines.find((l) => /rescued src\/b\.ts to /.test(l));
    assert.ok(rescued !== undefined, m.text);
    assert.equal(readFileSync(rescued.replace(/^.* to /, ""), "utf8"), "an edit during the run\n");
  });
});

test("R18 the lock replaced by another run's during the run: no row, and that lock stays", SPAWN_TEST, async () => {
  // Round 2 review, non-blocking 3, mutant j: (c) blind to another run's lock wrote a killed row here.
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const other = "20260101T000000Z-1-abcd";
    const m = await mutate(r, during(() => {
      const lock = JSON.parse(readFileSync(lockFileOf(r), "utf8")) as Record<string, unknown>;
      writeFileSync(lockFileOf(r), `${JSON.stringify({ ...lock, run: other })}\n`);
    }));
    assert.equal(m.code, 2, m.text);
    assert.match(m.last, CHANGED);
    assert.match(m.last, new RegExp(`\\(c\\) the lock file names another run, ${other}`));
    assert.deepEqual(mutationRows(r), []);
    assert.equal(read(r, "src/a.ts"), "new\n");
    assert.equal((JSON.parse(readFileSync(lockFileOf(r), "utf8")) as { run: string }).run, other, "the other run's lock did not stay");
  });
});

test("R13 the restore's line says lock removed only when it removed the run's lock", SPAWN_TEST, async () => {
  // Round 2 review, non-blocking 7: the line said "lock removed" when the lock was gone, or was another run's and stayed.
  const acts: Record<string, (r: RunRepo) => void> = {
    gone: (r) => rmSync(lockFileOf(r)),
    another: (r) => {
      const lock = JSON.parse(readFileSync(lockFileOf(r), "utf8")) as Record<string, unknown>;
      writeFileSync(lockFileOf(r), `${JSON.stringify({ ...lock, run: "20260101T000000Z-1-abcd" })}\n`);
    },
  };
  for (const [name, act] of Object.entries(acts)) {
    await withRunRepo(CHECK, startA, editA, async (r) => {
      const m = await mutate(r, during(() => act(r)));
      const line = m.lines.find((l) => /^mutation: restored \d+, tree verified/.test(l));
      assert.ok(line !== undefined, `${name}: ${m.text}`);
      assert.doesNotMatch(line, /lock removed/, name);
      assert.match(line, /no lock of this run's was at its name, so none was removed/, name);
    });
  }
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const m = await mutate(r);
    assert.ok(m.lines.includes("mutation: restored 1, tree verified, lock removed"), `the control: ${m.text}`);
  });
});

test("R19 HEAD on another branch and the lock's branch moved too: git switch to it first, then the reset", SPAWN_TEST, async () => {
  // Item 42, round 2 review, non-blocking 3: mutant m (never the reset after the switch) survived; the test above has a branch that did not move.
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const branch = git(r.root, "symbolic-ref", "--short", "HEAD");
    const old = git(r.root, "rev-parse", "HEAD");
    const m = await mutate(r, during(() => {
      git(r.root, "commit", "-q", "--allow-empty", "-m", "on the lock's branch");
      git(r.root, "switch", "-q", "-c", "other");
    }));
    assert.equal(m.code, 2, m.text);
    assert.notEqual(git(r.root, "rev-parse", branch), old, "the lock's branch did not move");
    const line = m.lines.find((l) => l.startsWith("mutation: HEAD is on other, "));
    assert.equal(
      line,
      `mutation: HEAD is on other, not on ${branch}: git switch ${branch} first, then, if you want it: git reset ${old} moves ${branch} back and keeps the working tree (the commit stays in the reflog)`,
      m.text,
    );
  });
});
