import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { acquireLock, sweepStale } from "../src/mutation-lock.ts";
import { applyRevert, restoreFromLock } from "../src/mutation-tree.ts";
import { git, gitDirOf, indexEntries, locked, put, runDirOf, staged, status, withRepo } from "./mutation-fixture.ts";

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

test("R11 an added file edited since the lock is not removed", () => {
  withRepo(
    (root) => put(root, "src/keep.ts", "k\n"),
    (root) => put(root, "src/new.ts", "new\n"),
    (r) => {
      const lock = locked(r);
      writeFileSync(join(r.root, "src/new.ts"), "edited after the lock, before the revert unlinks it\n");
      const result = applyRevert(r.store, lock);
      assert.ok(!result.ok, "the revert unlinked an edit");
      assert.deepEqual([result.path, result.written], ["src/new.ts", []]);
      assert.equal(read(r.root, "src/new.ts"), "edited after the lock, before the revert unlinks it\n");
    },
  );
});

test("R8 a run whose staging another run swept before it linked its lock writes nothing", () => {
  withRepo(
    (root) => {
      put(root, "src/a.ts", "a\n");
      put(root, "src/keep.ts", "k\n");
    },
    (root) => {
      put(root, "src/a.ts", "a2\n");
      put(root, "src/new.ts", "new, the item's added file\n");
    },
    (r) => {
      const before = status(r.root);
      // The review's E1: A stages; B stages, takes the lock, sweeps and ends; then A takes the lock.
      const a = staged(r);
      const b = locked(r);
      sweepStale(r.store, b);
      assert.equal(existsSync(runDirOf(r, a)), false, "the sweep kept A's staging, so this test proves nothing");
      assert.deepEqual(restoreFromLock(r.store, b).failed, []);
      assert.ok(acquireLock(r.store, a).ok);
      const result = applyRevert(r.store, a);
      assert.ok(!result.ok, "the revert went on with its staging gone");
      assert.deepEqual(result.written, []);
      assert.match(result.reason, /staged copy/);
      assert.equal(read(r.root, "src/new.ts"), "new, the item's added file\n");
      assert.equal(status(r.root), before, "the revert wrote to the tree");
      assert.deepEqual(restoreFromLock(r.store, a, { entries: result.written }).failed, []);
      assert.equal(existsSync(join(gitDirOf(r), "mstack-mutation.lock")), false);
    },
  );
});

test("R11 a staged copy changed, or the run directory deleted, between the lock and the revert: the revert writes nothing", () => {
  withRepo(
    (root) => {
      put(root, "src/a.ts", "a\n");
      put(root, "src/old.ts", "old\n");
    },
    (root) => {
      put(root, "src/a.ts", "a2\n");
      rmSync(join(root, "src/old.ts"));
      put(root, "src/new.ts", "new\n");
    },
    (r) => {
      const before = status(r.root);
      const lock = locked(r);
      const run = runDirOf(r, lock);
      const a = lock.entries.find((e) => e.path === "src/a.ts");
      assert.ok(a !== undefined);
      for (const side of ["start", "head"]) {
        const copy = join(run, side, String(a.n));
        const kept = readFileSync(copy);
        writeFileSync(copy, "not what the lock recorded\n");
        const result = applyRevert(r.store, lock);
        assert.ok(!result.ok, `the revert went on with ${side}/${a.n} changed`);
        assert.deepEqual([result.path, result.written], ["src/a.ts", []]);
        assert.match(result.reason, /staged copy/);
        assert.equal(status(r.root), before, `the revert wrote to the tree with ${side}/${a.n} changed`);
        writeFileSync(copy, kept);
      }
      rmSync(run, { recursive: true });
      const result = applyRevert(r.store, lock);
      assert.ok(!result.ok, "the revert went on with its run directory gone");
      assert.deepEqual(result.written, []);
      assert.equal(read(r.root, "src/new.ts"), "new\n");
      assert.equal(status(r.root), before, "the revert wrote to the tree with its run directory gone");
    },
  );
});

test("R10 an untracked file in a directory the revert removes when empty is kept", () => {
  withRepo(
    (root) => put(root, "src/keep.ts", "k\n"),
    (root) => put(root, "src/feature/x.ts", "x\n"),
    (r) => {
      const lock = locked(r);
      assert.deepEqual(lock.removedDirs, ["src/feature"]);
      put(r.root, "src/feature/notes.md", "untracked notes\n");
      assert.deepEqual(applyRevert(r.store, lock), { ok: true });
      assert.equal(present(r.root, "src/feature/x.ts"), false);
      assert.equal(read(r.root, "src/feature/notes.md"), "untracked notes\n");
    },
  );
});

test("R9 a start file of mode 100755 is put back with its executable bits", () => {
  withRepo(
    (root) => put(root, "src/run.sh", "#!/bin/sh\necho start\n", 0o755),
    (root) => {
      put(root, "src/run.sh", "#!/bin/sh\necho head\n");
      chmodSync(join(root, "src/run.sh"), 0o644);
    },
    (r) => {
      assert.deepEqual(applyRevert(r.store, locked(r)), { ok: true });
      assert.equal(read(r.root, "src/run.sh"), "#!/bin/sh\necho start\n");
      assert.equal(bits(r.root, "src/run.sh").toString(8), (0o777 & ~umask).toString(8));
    },
  );
});

test("R10 the revert removes no directory through a symlinked parent", () => {
  withRepo(
    (root) => put(root, "src/keep.ts", "k\n"),
    (root) => put(root, "src/feature/sub/x.ts", "x\n"),
    (r) => {
      const lock = locked(r);
      assert.deepEqual(lock.removedDirs, ["src/feature/sub", "src/feature"]);
      // Outside the working tree: an empty directory the rmdir of src/feature/sub would reach through a link.
      const elsewhere = join(gitDirOf(r), "elsewhere");
      mkdirSync(join(elsewhere, "sub"), { recursive: true });
      const x = lock.entries.find((e) => e.path === "src/feature/sub/x.ts");
      applyRevert(r.store, lock, (step) => {
        if (step !== `reverted:${x?.n}`) return;
        rmSync(join(r.root, "src/feature"), { recursive: true });
        symlinkSync(elsewhere, join(r.root, "src/feature"));
      });
      assert.ok(existsSync(join(elsewhere, "sub")), "the revert removed a directory through the symlink");
      assert.ok(lstatSync(join(r.root, "src/feature")).isSymbolicLink());
    },
  );
});
