import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, lstatSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { acquireLock } from "../src/mutation-lock.ts";
import { applyRevert } from "../src/mutation-tree.ts";
import { git, gitDirOf, indexEntries, locked, put, runDirOf, staged, withRepo } from "./mutation-fixture.ts";

/**
 * Item 42, task 2.2: what `applyRevert` leaves in the working tree, read right
 * after it returns. Each repository is a sandbox with a start commit and an
 * item commit; the lock is taken on it first, as a run does.
 */

const umask = process.umask();
const read = (root: string, rel: string): string => readFileSync(join(root, rel), "utf8");
const bytes = (root: string, rel: string): Buffer => readFileSync(join(root, rel));
const bits = (root: string, rel: string): number => lstatSync(join(root, rel)).mode & 0o7777;
const present = (root: string, rel: string): boolean => {
  try {
    lstatSync(join(root, rel));
    return true;
  } catch {
    return false;
  }
};
/** Names a run's writer leaves in a directory: `.mstack-mutation-<run>-<n>.<pid>.tmp`. */
const temps = (dir: string): string[] => readdirSync(dir).filter((n) => n.startsWith(".mstack-mutation-"));

const twoFiles = (root: string): void => {
  put(root, "src/a.ts", "a\n");
  put(root, "src/b.ts", "b\n");
};
const editBoth = (root: string): void => {
  put(root, "src/a.ts", "a2\n");
  put(root, "src/b.ts", "b2\n");
};

test("R9 added, deleted, modified and renamed", () => {
  withRepo(
    (root) => {
      put(root, "src/old.ts", "old\n");
      twoFiles(root);
    },
    (root) => {
      put(root, "src/new.ts", "new\n");
      rmSync(join(root, "src/old.ts"));
      put(root, "src/a.ts", "a2\n");
      git(root, "mv", "src/b.ts", "src/c.ts");
    },
    (r) => {
      const lock = locked(r);
      assert.deepEqual(applyRevert(r.store, lock), { ok: true });
      assert.equal(present(r.root, "src/new.ts"), false);
      assert.equal(present(r.root, "src/c.ts"), false);
      assert.deepEqual([read(r.root, "src/old.ts"), read(r.root, "src/b.ts"), read(r.root, "src/a.ts")], ["old\n", "b\n", "a\n"]);
      assert.deepEqual(temps(join(r.root, "src")), []);
    },
  );
});

test("R9 binary bytes and the executable bit", () => {
  const binary = Buffer.from([0, 255, 1, 254, 10, 13, 10, 0, 128]);
  const big = Buffer.alloc(3 << 20);
  for (let i = 0; i < big.length; i++) big[i] = (i * 31) % 256;
  withRepo(
    (root) => {
      put(root, "src/blob.bin", binary);
      put(root, "src/big.bin", big);
      put(root, "src/run.sh", "#!/bin/sh\necho hi\n", 0o644);
    },
    (root) => {
      put(root, "src/blob.bin", Buffer.from([9, 9, 9]));
      put(root, "src/big.bin", Buffer.alloc(10, 1));
      chmodSync(join(root, "src/run.sh"), 0o755);
    },
    (r) => {
      assert.deepEqual(applyRevert(r.store, locked(r)), { ok: true });
      assert.ok(bytes(r.root, "src/blob.bin").equals(binary), "the binary file is not the start's");
      assert.ok(bytes(r.root, "src/big.bin").equals(big), "the 3 MiB file is not the start's");
      assert.equal(bits(r.root, "src/run.sh"), 0o666 & ~umask, "the script is still executable");
    },
  );
});

test("R9 line endings are the start's as checked out here", () => {
  withRepo(
    (root) => {
      put(root, ".gitattributes", "*.txt text eol=crlf\n");
      put(root, "src/t.txt", "one\ntwo\n");
    },
    (root) => put(root, "src/t.txt", "one\ntwo\nthree\n"),
    (r) => {
      assert.deepEqual(applyRevert(r.store, locked(r)), { ok: true });
      assert.equal(read(r.root, "src/t.txt"), "one\r\ntwo\r\n");
    },
  );
});

test("R9 the index is not touched", () => {
  withRepo(twoFiles, editBoth, (r) => {
    const index = join(gitDirOf(r), "index");
    const entries = indexEntries(r.root);
    const raw = readFileSync(index);
    assert.deepEqual(applyRevert(r.store, locked(r)), { ok: true });
    assert.equal(read(r.root, "src/a.ts"), "a\n");
    assert.ok(readFileSync(index).equals(raw), "the index file was rewritten");
    assert.equal(indexEntries(r.root), entries);
    assert.equal(git(r.root, "diff", "--cached", "--name-only"), "");
  });
});

test("R9 a directory left empty by an added file is removed, and a missing parent is made", () => {
  withRepo(
    (root) => {
      put(root, "src/gone/y.ts", "y\n");
      put(root, "src/keep.ts", "k\n");
    },
    (root) => {
      put(root, "src/feature/x.ts", "x\n");
      rmSync(join(root, "src/gone"), { recursive: true });
    },
    (r) => {
      const lock = locked(r);
      assert.deepEqual([lock.createdDirs, lock.removedDirs], [["src/gone"], ["src/feature"]]);
      assert.deepEqual(applyRevert(r.store, lock), { ok: true });
      assert.equal(present(r.root, "src/feature"), false, "src/feature/ is still there");
      assert.equal(read(r.root, "src/gone/y.ts"), "y\n");
    },
  );
});

test("R10 untracked, test and doc files are byte-identical after the revert", () => {
  withRepo(
    (root) => {
      put(root, "src/a.ts", "a\n");
      put(root, "tests/a.test.ts", "t\n");
      put(root, "docs/x.md", "d\n");
    },
    (root) => {
      put(root, "src/a.ts", "a2\n");
      put(root, "tests/a.test.ts", "t2\n");
      put(root, "docs/x.md", "d2\n");
    },
    (r) => {
      put(r.root, "src/wip.ts", "untracked work\n", 0o640);
      put(r.root, "notes.txt", "notes\n");
      const kept = ["tests/a.test.ts", "docs/x.md", "src/wip.ts", "notes.txt", ".mstack/state.json"];
      const before = kept.map((p) => [bytes(r.root, p), bits(r.root, p)]);
      const lock = locked(r);
      assert.deepEqual(lock.entries.map((e) => e.path), ["src/a.ts"]);
      assert.deepEqual(applyRevert(r.store, lock), { ok: true });
      assert.equal(read(r.root, "src/a.ts"), "a\n");
      assert.deepEqual(kept.map((p) => [bytes(r.root, p), bits(r.root, p)]), before);
      assert.doesNotMatch(readFileSync(join(gitDirOf(r), "mstack-mutation.lock"), "utf8"), /wip\.ts|notes\.txt/);
    },
  );
});

test("R11 a path that cannot be written stops the revert", () => {
  withRepo(
    (root) => {
      put(root, "src/a.ts", "a\n");
      put(root, "src/deep/old.ts", "old\n");
      put(root, "src/deep/keep.ts", "keep\n");
    },
    (root) => {
      put(root, "src/a.ts", "a2\n");
      rmSync(join(root, "src/deep/old.ts"));
    },
    (r) => {
      const lock = locked(r);
      const a = lock.entries.find((e) => e.path === "src/a.ts");
      chmodSync(join(r.root, "src/deep"), 0o555);
      try {
        const result = applyRevert(r.store, lock);
        assert.ok(!result.ok, "the revert went through a read-only directory");
        assert.equal(result.path, "src/deep/old.ts");
        assert.match(result.reason, /EACCES/);
        assert.deepEqual(result.written, [a?.n]);
        assert.equal(read(r.root, "src/a.ts"), "a\n");
        assert.deepEqual(temps(join(r.root, "src/deep")), []);
      } finally {
        chmodSync(join(r.root, "src/deep"), 0o755);
      }
    },
  );
});

test("R11 a path that changed since the lock stops the revert before it is written", () => {
  withRepo(twoFiles, editBoth, (r) => {
    const lock = locked(r);
    const result = applyRevert(r.store, lock, (step) => {
      if (step === "reverted:0") writeFileSync(join(r.root, "src/b.ts"), "b, edited during the revert\n");
    });
    assert.ok(!result.ok, "the revert wrote over an edit");
    assert.deepEqual([result.path, result.written], ["src/b.ts", [0]]);
    assert.equal(read(r.root, "src/b.ts"), "b, edited during the revert\n");
    assert.deepEqual(temps(join(r.root, "src")), []);
    assert.equal(existsSync(join(runDirOf(r, lock), "rescue")), false, "something was moved into rescue/");
  });
});

test("R11 an edit between the staged copy and the lock blocks the revert and keeps the edit", () => {
  withRepo(twoFiles, editBoth, (r) => {
    const lock = staged(r);
    writeFileSync(join(r.root, "src/a.ts"), "saved after the copy, before the lock\n");
    assert.ok(acquireLock(r.store, lock).ok);
    const result = applyRevert(r.store, lock);
    assert.ok(!result.ok, "the revert wrote over an edit made before the lock");
    assert.deepEqual([result.path, result.written], ["src/a.ts", []]);
    assert.equal(read(r.root, "src/a.ts"), "saved after the copy, before the lock\n");
    assert.equal(read(r.root, "src/b.ts"), "b2\n");
  });
});

test("R11 an edit after the temp file is written and before its rename stops the revert and keeps the edit", () => {
  withRepo(twoFiles, editBoth, (r) => {
    const lock = locked(r);
    const result = applyRevert(r.store, lock, (step) => {
      if (step === "revert-written:0") writeFileSync(join(r.root, "src/a.ts"), "saved in the moment before the rename\n");
    });
    assert.ok(!result.ok, "the rename went over an edit");
    assert.deepEqual([result.path, result.written], ["src/a.ts", []]);
    assert.equal(read(r.root, "src/a.ts"), "saved in the moment before the rename\n");
    assert.deepEqual(temps(join(r.root, "src")), [], "the temp file was left");
  });
});
