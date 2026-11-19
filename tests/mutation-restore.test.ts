import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";

import { readLock, type Lock } from "../src/mutation-lock.ts";
import { applyRevert, restoreFromLock, type Restored } from "../src/mutation-tree.ts";
import {
  CASE, git, hold, indexEntries, locked, lockFileOf, put, runDirOf, SIGNAL_MS, SPAWN_TEST, status, until, withRepo, withRepoAsync,
  type Repo,
} from "./mutation-fixture.ts";

/**
 * Item 42, task 2.3: `restoreFromLock` after a revert, in-process or after a
 * holder process was SIGKILLed at a named step. Each repository is a sandbox
 * with a start commit and an item commit.
 */

const umask = process.umask();
const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
const read = (root: string, rel: string): string => readFileSync(join(root, rel), "utf8");
const bits = (root: string, rel: string): number => lstatSync(join(root, rel)).mode & 0o7777;
const present = (root: string, rel: string): boolean => {
  try {
    lstatSync(join(root, rel));
    return true;
  } catch {
    return false;
  }
};
const temps = (dir: string): string[] => readdirSync(dir).filter((n) => n.startsWith(".mstack-mutation-"));
const nOf = (lock: Lock, path: string): number => {
  const e = lock.entries.find((x) => x.path === path);
  assert.ok(e !== undefined, `${path} is not in the lock`);
  return e.n;
};

/** The revert done, as the obligations would see it. */
function reverted(r: Repo): Lock {
  const lock = locked(r);
  assert.deepEqual(applyRevert(r.store, lock), { ok: true });
  return lock;
}

function clean(result: Restored): void {
  assert.deepEqual(result.failed, [], `the restore failed: ${JSON.stringify(result.failed)}`);
}

const twoFiles = (root: string): void => {
  put(root, "src/a.ts", "a\n");
  put(root, "src/b.ts", "b\n");
};
const editBoth = (root: string): void => {
  put(root, "src/a.ts", "a2\n");
  put(root, "src/b.ts", "b2\n");
};

/** Five paths: three edited, one added, one deleted, so the revert and the restore each have both kinds. */
const fiveAtStart = (root: string): void => {
  for (const name of ["a", "b", "c", "e"]) put(root, `src/${name}.ts`, `${name}\n`);
};
const fiveChanged = (root: string): void => {
  for (const name of ["a", "b", "c"]) put(root, `src/${name}.ts`, `${name}2\n`);
  put(root, "src/d.ts", "d, added\n");
  rmSync(join(root, "src/e.ts"));
};

test("R13 clean afterwards: status as before, index untouched, lock and staging gone", () => {
  withRepo(
    (root) => {
      fiveAtStart(root);
      put(root, "src/gone/y.ts", "y\n");
    },
    (root) => {
      fiveChanged(root);
      put(root, "src/feature/x.ts", "x\n");
      rmSync(join(root, "src/gone"), { recursive: true });
    },
    (r) => {
      const before = status(r.root);
      const index = indexEntries(r.root);
      const lock = reverted(r);
      assert.notEqual(status(r.root), before, "the revert changed nothing");
      const result = restoreFromLock(r.store, lock);
      clean(result);
      assert.deepEqual(result.rescued, []);
      assert.equal(status(r.root), before);
      assert.equal(indexEntries(r.root), index);
      assert.equal(existsSync(lockFileOf(r)), false, "the lock is still there");
      assert.equal(existsSync(runDirOf(r, lock)), false, "the staging is still there");
    },
  );
});

test("R13 the whole permission bits come back", () => {
  withRepo(
    (root) => {
      put(root, "src/private.ts", "p\n");
      put(root, "src/readonly.ts", "r\n");
      put(root, "src/run.sh", "#!/bin/sh\n");
    },
    (root) => {
      put(root, "src/private.ts", "p2\n", 0o600);
      put(root, "src/readonly.ts", "r2\n", 0o444);
      put(root, "src/run.sh", "#!/bin/sh\necho 2\n", 0o750);
    },
    (r) => {
      const lock = reverted(r);
      assert.equal(bits(r.root, "src/private.ts"), 0o666 & ~umask, "the revert kept the bits");
      clean(restoreFromLock(r.store, lock));
      assert.deepEqual(
        ["src/private.ts", "src/readonly.ts", "src/run.sh"].map((p) => [read(r.root, p), bits(r.root, p).toString(8)]),
        [["p2\n", "600"], ["r2\n", "444"], ["#!/bin/sh\necho 2\n", "750"]],
      );
    },
  );
});

test("R13 a changed tracked file outside the set does not keep the lock", () => {
  withRepo(
    (root) => {
      put(root, "src/a.ts", "a\n");
      put(root, "tests/__snapshots__/a.snap", "snapshot\n");
    },
    (root) => put(root, "src/a.ts", "a2\n"),
    (r) => {
      const lock = reverted(r);
      writeFileSync(join(r.root, "tests/__snapshots__/a.snap"), "rewritten by the obligation\n");
      clean(restoreFromLock(r.store, lock));
      assert.equal(existsSync(lockFileOf(r)), false, "the lock was kept for a file outside the set");
      assert.equal(read(r.root, "tests/__snapshots__/a.snap"), "rewritten by the obligation\n");
      assert.equal(read(r.root, "src/a.ts"), "a2\n");
    },
  );
});

test("R13 a SIGKILL between a temp write and its rename leaves nothing after the restore", SPAWN_TEST, async () => {
  await withRepoAsync(twoFiles, editBoth, async (r) => {
    const before = status(r.root);
    const h = hold(r.root, "run", "revert-written:0");
    try {
      assert.ok(await until(() => h.journal().includes("at revert-written:0"), SIGNAL_MS), "the holder never wrote its temp file");
      h.kill();
      await h.exited;
    } finally {
      h.dispose();
    }
    assert.equal(temps(join(r.root, "src")).length, 1, "no temp file was left by the kill");
    const lock = readLock(r.store);
    assert.ok(lock !== null && "lock" in lock);
    clean(restoreFromLock(r.store, lock.lock));
    assert.deepEqual(temps(join(r.root, "src")), []);
    assert.equal(read(r.root, "src/a.ts"), "a2\n");
    assert.equal(status(r.root), before);
    assert.equal(existsSync(lockFileOf(r)), false);
  });
});

test("R14 an edit to a reverted file is rescued byte for byte", () => {
  withRepo(twoFiles, editBoth, (r) => {
    const lock = reverted(r);
    const edit = Buffer.from([0x65, 0x64, 0x69, 0x74, 0, 0xff, 0x0a]);
    writeFileSync(join(r.root, "src/a.ts"), edit);
    const result = restoreFromLock(r.store, lock);
    clean(result);
    assert.deepEqual(result.rescued, [{ path: "src/a.ts", to: join(runDirOf(r, lock), "rescue", "1", "src", "a.ts") }]);
    assert.ok(readFileSync(result.rescued[0]?.to as string).equals(edit), "the rescued copy is not the edit");
    assert.equal(read(r.root, "src/a.ts"), "a2\n");
    assert.equal(existsSync(lockFileOf(r)), false);
    assert.deepEqual(readdirSync(runDirOf(r, lock)), ["rescue"], "the staging was kept, or the rescue removed");
  });
});

test("R14 an edit after H's temp file is written and before its rename is rescued", () => {
  withRepo(twoFiles, editBoth, (r) => {
    const lock = reverted(r);
    const at = `restore-written:${nOf(lock, "src/a.ts")}`;
    let edited = false;
    const result = restoreFromLock(r.store, lock, {
      step: (name) => {
        if (name !== at || edited) return;
        edited = true;
        writeFileSync(join(r.root, "src/a.ts"), "saved in the moment before the restore's rename\n");
      },
    });
    clean(result);
    assert.equal(result.rescued.length, 1);
    assert.equal(readFileSync(result.rescued[0]?.to as string, "utf8"), "saved in the moment before the restore's rename\n");
    assert.equal(read(r.root, "src/a.ts"), "a2\n");
    assert.deepEqual(temps(join(r.root, "src")), []);
  });
});

test("R14 a directory where HEAD has a file is moved whole into rescue", () => {
  withRepo(
    (root) => put(root, "src/keep.ts", "k\n"),
    (root) => put(root, "src/new.ts", "new\n"),
    (r) => {
      const lock = reverted(r);
      assert.equal(present(r.root, "src/new.ts"), false);
      put(r.root, "src/new.ts/out.log", "written during the run\n");
      const result = restoreFromLock(r.store, lock);
      clean(result);
      const to = join(runDirOf(r, lock), "rescue", "1", "src", "new.ts");
      assert.deepEqual(result.rescued, [{ path: "src/new.ts", to }]);
      assert.equal(readFileSync(join(to, "out.log"), "utf8"), "written during the run\n");
      assert.equal(read(r.root, "src/new.ts"), "new\n");
      assert.equal(existsSync(lockFileOf(r)), false);
    },
  );
});

test("R14 a case variant where HEAD has a file is rescued under its own name", CASE, () => {
  withRepo(twoFiles, editBoth, (r) => {
    const lock = reverted(r);
    renameSync(join(r.root, "src/a.ts"), join(r.root, "src/A.ts"));
    writeFileSync(join(r.root, "src/A.ts"), "edited under another case\n");
    const result = restoreFromLock(r.store, lock);
    clean(result);
    const to = join(runDirOf(r, lock), "rescue", "1", "src", "A.ts");
    assert.deepEqual(result.rescued, [{ path: "src/A.ts", to }]);
    assert.ok(readdirSync(join(runDirOf(r, lock), "rescue", "1", "src")).includes("A.ts"), "the variant lost its name");
    assert.equal(readFileSync(to, "utf8"), "edited under another case\n");
    const names = readdirSync(join(r.root, "src"));
    assert.ok(names.includes("a.ts") && !names.includes("A.ts"), `src/ holds ${JSON.stringify(names)}`);
    assert.equal(read(r.root, "src/a.ts"), "a2\n");
  });
});

test("R14 a file left at a path HEAD lacks is left in place", () => {
  withRepo(
    (root) => {
      put(root, "src/a.ts", "a\n");
      put(root, "src/old.ts", "old\n");
    },
    (root) => {
      put(root, "src/a.ts", "a2\n");
      rmSync(join(root, "src/old.ts"));
    },
    (r) => {
      const lock = reverted(r);
      assert.equal(read(r.root, "src/old.ts"), "old\n");
      writeFileSync(join(r.root, "src/old.ts"), "edited during the run\n");
      const result = restoreFromLock(r.store, lock);
      clean(result);
      assert.deepEqual([result.left, result.rescued], [["src/old.ts"], []]);
      assert.equal(read(r.root, "src/old.ts"), "edited during the run\n");
      assert.equal(existsSync(lockFileOf(r)), false);
    },
  );
});

test("R14 a second incident gets its own rescue directory", () => {
  withRepo(
    (root) => {
      put(root, "src/a.ts", "a\n");
      put(root, "lib/ro/x.ts", "x\n");
    },
    (root) => {
      put(root, "src/a.ts", "a2\n");
      put(root, "lib/ro/x.ts", "x2\n");
    },
    (r) => {
      const lock = reverted(r);
      writeFileSync(join(r.root, "src/a.ts"), "the first edit\n");
      chmodSync(join(r.root, "lib/ro"), 0o555);
      let first: Restored;
      try {
        first = restoreFromLock(r.store, lock);
      } finally {
        chmodSync(join(r.root, "lib/ro"), 0o755);
      }
      assert.deepEqual(first.failed.map((f) => f.path), ["lib/ro/x.ts"]);
      writeFileSync(join(r.root, "src/a.ts"), "the second edit\n");
      const second = restoreFromLock(r.store, lock);
      clean(second);
      const rescue = join(runDirOf(r, lock), "rescue");
      assert.deepEqual([first.rescued[0]?.to, second.rescued[0]?.to], [join(rescue, "1", "src", "a.ts"), join(rescue, "2", "src", "a.ts")]);
      assert.equal(readFileSync(join(rescue, "1", "src", "a.ts"), "utf8"), "the first edit\n");
      assert.equal(readFileSync(join(rescue, "2", "src", "a.ts"), "utf8"), "the second edit\n");
    },
  );
});

test("R14 the copy fallback keeps the bytes and the mode", () => {
  withRepo(twoFiles, editBoth, (r) => {
    const lock = reverted(r);
    writeFileSync(join(r.root, "src/a.ts"), "an edit on its way to another filesystem\n");
    chmodSync(join(r.root, "src/a.ts"), 0o750);
    const crossDevice = (from: string, to: string): void => {
      if (to.includes(`${sep}rescue${sep}`)) throw Object.assign(new Error(`EXDEV: cross-device link not permitted, rename '${from}' -> '${to}'`), { code: "EXDEV" });
      renameSync(from, to);
    };
    const result = restoreFromLock(r.store, lock, { rename: crossDevice });
    clean(result);
    const to = result.rescued[0]?.to as string;
    assert.equal(readFileSync(to, "utf8"), "an edit on its way to another filesystem\n");
    assert.equal((lstatSync(to).mode & 0o7777).toString(8), "750");
    assert.equal(read(r.root, "src/a.ts"), "a2\n");
    assert.equal(bits(r.root, "src/a.ts"), 0o644 & ~umask);
  });
});

test("R15 a read-only directory keeps the lock and the other paths are restored", () => {
  withRepo(
    (root) => {
      put(root, "src/a.ts", "a\n");
      put(root, "lib/ro/x.ts", "x\n");
    },
    (root) => {
      put(root, "src/a.ts", "a2\n");
      put(root, "lib/ro/x.ts", "x2\n");
    },
    (r) => {
      const lock = reverted(r);
      chmodSync(join(r.root, "lib/ro"), 0o555);
      try {
        const result = restoreFromLock(r.store, lock);
        assert.equal(result.failed.length, 1, JSON.stringify(result.failed));
        const [failure] = result.failed;
        assert.equal(failure?.path, "lib/ro/x.ts");
        assert.match(failure?.reason ?? "", /EACCES/);
        assert.match(failure?.fix ?? "", /chmod u\+w lib\/ro/);
        assert.equal(read(r.root, "src/a.ts"), "a2\n");
        assert.ok(existsSync(lockFileOf(r)), "the lock went with a path not restored");
      } finally {
        chmodSync(join(r.root, "lib/ro"), 0o755);
      }
      const again = readLock(r.store);
      assert.ok(again !== null && "lock" in again);
      clean(restoreFromLock(r.store, again.lock));
      assert.equal(read(r.root, "lib/ro/x.ts"), "x2\n");
      assert.equal(existsSync(lockFileOf(r)), false);
    },
  );
});

test("R15 a missing staged copy keeps the lock after rescuing what is there", () => {
  withRepo(twoFiles, editBoth, (r) => {
    const lock = reverted(r);
    rmSync(join(runDirOf(r, lock), "head", String(nOf(lock, "src/a.ts"))));
    writeFileSync(join(r.root, "src/a.ts"), "an edit, before the restore finds its staged copy gone\n");
    const result = restoreFromLock(r.store, lock);
    assert.equal(result.rescued.length, 1);
    assert.equal(readFileSync(result.rescued[0]?.to as string, "utf8"), "an edit, before the restore finds its staged copy gone\n");
    assert.deepEqual(result.failed.map((f) => f.path), ["src/a.ts"]);
    assert.match(result.failed[0]?.fix ?? "", /git stash push -- src\/a\.ts[\s\S]*HEAD's content[\s\S]*git restore -- src\/a\.ts/);
    assert.ok(existsSync(lockFileOf(r)), "the lock went with a path not restored");
    assert.equal(read(r.root, "src/b.ts"), "b2\n");
    // The fix it names, then the restore again.
    git(r.root, "stash", "push", "-q", "--", "src/a.ts");
    clean(restoreFromLock(r.store, lock));
    assert.equal(read(r.root, "src/a.ts"), "a2\n");
    assert.equal(existsSync(lockFileOf(r)), false);
  });
});

test("R15 a parent renamed by case fails with the mv back as its fix", CASE, () => {
  withRepo(
    (root) => {
      put(root, "src/lib/a.ts", "a\n");
      put(root, "src/b.ts", "b\n");
    },
    (root) => {
      put(root, "src/lib/a.ts", "a2\n");
      put(root, "src/b.ts", "b2\n");
    },
    (r) => {
      const lock = reverted(r);
      renameSync(join(r.root, "src/lib"), join(r.root, "src/Lib"));
      const result = restoreFromLock(r.store, lock);
      assert.deepEqual(result.failed.map((f) => f.path), ["src/lib/a.ts"]);
      assert.match(result.failed[0]?.fix ?? "", /mv src\/Lib src\/lib\b/);
      assert.match(result.failed[0]?.fix ?? "", /git stash.*does not clear/);
      assert.ok(existsSync(lockFileOf(r)));
      assert.equal(read(r.root, "src/b.ts"), "b2\n");
      renameSync(join(r.root, "src/Lib"), join(r.root, "src/lib"));
      clean(restoreFromLock(r.store, lock));
      assert.equal(read(r.root, "src/lib/a.ts"), "a2\n");
      assert.equal(existsSync(lockFileOf(r)), false);
    },
  );
});

test("R17 the restore starts no child process", SPAWN_TEST, async () => {
  await withRepoAsync(fiveAtStart, fiveChanged, async (r) => {
    const before = status(r.root);
    const h = hold(r.root, "run", "", { extra: ["nogit"] });
    try {
      assert.equal(await h.exited, 0, h.journal());
      assert.match(h.journal(), /at obligations-running[\s\S]*at restored:/);
      assert.match(h.journal(), /git ran during the restore: false/);
      assert.match(h.journal(), /canary: git ran after one git\(\): true/, "the fake git would not have caught a child");
    } finally {
      h.dispose();
    }
    assert.equal(status(r.root), before);
    assert.equal(existsSync(lockFileOf(r)), false);
  });
});

/** SIGKILL a holder of phase `run` at `blockAt`, then restore from the lock it left, as `verify --restore` does. */
async function killedAt(r: Repo, blockAt: string): Promise<Lock> {
  const h = hold(r.root, "run", blockAt);
  try {
    assert.ok(await until(() => h.journal().includes(`at ${blockAt}`), SIGNAL_MS), `the holder never reached ${blockAt}`);
    h.kill();
    await h.exited;
  } finally {
    h.dispose();
  }
  const read = readLock(r.store);
  assert.ok(read !== null && "lock" in read, "the killed run left no lock");
  clean(restoreFromLock(r.store, read.lock));
  assert.equal(readLock(r.store), null, "the lock is still there");
  return read.lock;
}

test("R22 killed with the lock written and nothing reverted", SPAWN_TEST, async () => {
  await withRepoAsync(fiveAtStart, fiveChanged, async (r) => {
    const before = status(r.root);
    await killedAt(r, "lock-written");
    assert.equal(status(r.root), before);
  });
});

test("R22 killed half reverted", SPAWN_TEST, async () => {
  await withRepoAsync(fiveAtStart, fiveChanged, async (r) => {
    const before = status(r.root);
    // The revert unlinks src/d.ts (entry 3) first, then writes src/a.ts (entry 0): two of five.
    await killedAt(r, "reverted:0");
    assert.equal(status(r.root), before);
  });
});

test("R22 killed fully reverted", SPAWN_TEST, async () => {
  await withRepoAsync(fiveAtStart, fiveChanged, async (r) => {
    const before = status(r.root);
    await killedAt(r, "obligations-running");
    assert.equal(status(r.root), before);
  });
});

test("R22 killed half restored, then restored twice", SPAWN_TEST, async () => {
  await withRepoAsync(fiveAtStart, fiveChanged, async (r) => {
    const before = status(r.root);
    // The restore unlinks src/e.ts (entry 4) first, then writes src/a.ts and src/b.ts: three of five.
    const lock = await killedAt(r, "restored:1");
    assert.equal(status(r.root), before);
    clean(restoreFromLock(r.store, lock));
    assert.equal(status(r.root), before, "a second restore changed the tree");
    assert.equal(readLock(r.store), null);
    assert.equal(sha(read(r.root, "src/d.ts")), sha("d, added\n"));
  });
});

test("R13 a path changed after its own restore fails the proof and keeps the lock", () => {
  withRepo(twoFiles, editBoth, (r) => {
    const lock = reverted(r);
    const at = `restored:${nOf(lock, "src/a.ts")}`;
    const result = restoreFromLock(r.store, lock, {
      step: (name) => {
        if (name === at) writeFileSync(join(r.root, "src/a.ts"), "saved just after its restore, before the proof\n");
      },
    });
    assert.deepEqual(result.failed.map((f) => f.path), ["src/a.ts"], "the proof passed over a path that does not hold H");
    assert.ok(existsSync(lockFileOf(r)), "the lock went before the proof held");
    assert.equal(read(r.root, "src/a.ts"), "saved just after its restore, before the proof\n");
    const again = restoreFromLock(r.store, lock);
    clean(again);
    assert.equal(readFileSync(again.rescued[0]?.to as string, "utf8"), "saved just after its restore, before the proof\n");
    assert.equal(read(r.root, "src/a.ts"), "a2\n");
    assert.equal(existsSync(lockFileOf(r)), false);
  });
});

test("R10 a file written into a directory the revert made survives the restore", () => {
  withRepo(
    (root) => {
      put(root, "src/keep.ts", "k\n");
      put(root, "src/gone/y.ts", "y\n");
    },
    (root) => rmSync(join(root, "src/gone"), { recursive: true }),
    (r) => {
      const lock = reverted(r);
      assert.deepEqual(lock.createdDirs, ["src/gone"]);
      put(r.root, "src/gone/out.log", "written during the run\n");
      const result = restoreFromLock(r.store, lock);
      clean(result);
      assert.deepEqual(result.left, ["src/gone"]);
      assert.equal(present(r.root, "src/gone/y.ts"), false);
      assert.equal(read(r.root, "src/gone/out.log"), "written during the run\n");
    },
  );
});

test("R15 a staged copy of H that does not hold what the lock recorded is not written, and the lock stays", () => {
  withRepo(twoFiles, editBoth, (r) => {
    const lock = reverted(r);
    writeFileSync(join(runDirOf(r, lock), "head", String(nOf(lock, "src/a.ts"))), "not HEAD's content\n");
    const result = restoreFromLock(r.store, lock);
    assert.deepEqual(result.failed.map((f) => f.path), ["src/a.ts"]);
    assert.match(result.failed[0]?.fix ?? "", /git stash push -- src\/a\.ts/);
    assert.equal(read(r.root, "src/a.ts"), "a\n", "the restore wrote a staged copy that is not H");
    assert.deepEqual(temps(join(r.root, "src")), []);
    assert.ok(existsSync(lockFileOf(r)), "the lock went with a path not restored");
    assert.equal(read(r.root, "src/b.ts"), "b2\n");
  });
});

test("R13 a path HEAD lacks that holds the start's content at the proof keeps the lock", () => {
  withRepo(
    (root) => {
      put(root, "src/a.ts", "a\n");
      put(root, "src/old.ts", "old\n");
    },
    (root) => {
      put(root, "src/a.ts", "a2\n");
      rmSync(join(root, "src/old.ts"));
    },
    (r) => {
      const lock = reverted(r);
      const at = `restored:${nOf(lock, "src/old.ts")}`;
      const result = restoreFromLock(r.store, lock, {
        step: (name) => {
          if (name === at) put(r.root, "src/old.ts", "old\n", 0o666 & ~umask);
        },
      });
      assert.deepEqual(result.failed.map((f) => f.path), ["src/old.ts"], "the proof passed over a path that holds S");
      assert.ok(existsSync(lockFileOf(r)), "the lock went before the proof held");
      clean(restoreFromLock(r.store, lock));
      assert.equal(present(r.root, "src/old.ts"), false);
      assert.equal(existsSync(lockFileOf(r)), false);
    },
  );
});

test("R24 the restore checks the lock itself, and writes nothing for one that fails the check", () => {
  withRepo(twoFiles, editBoth, (r) => {
    const lock = reverted(r);
    put(r.root, "src/notes.tmp", "the user's own notes, untracked\n");
    const before = status(r.root);
    const onDisk = readFileSync(lockFileOf(r), "utf8");
    // The review's E5: a temp prefix of "" would make the temp sweep take every *.tmp file there.
    const result = restoreFromLock(r.store, { ...lock, entries: lock.entries.map((e) => ({ ...e, tmp: "" })) });
    assert.equal(result.failed.length, 1, JSON.stringify(result.failed));
    assert.match(result.failed[0]?.reason ?? "", /temp prefix/);
    assert.deepEqual([result.restored, result.rescued, result.left], [0, [], []]);
    assert.equal(read(r.root, "src/notes.tmp"), "the user's own notes, untracked\n");
    assert.equal(status(r.root), before, "the restore wrote to the tree with a lock that fails its check");
    assert.equal(readFileSync(lockFileOf(r), "utf8"), onDisk);
  });
});

test("R13 the restore leaves a lock that another run wrote", () => {
  withRepo(twoFiles, editBoth, (r) => {
    const a = reverted(r);
    // The review's E4c: A's lock deleted by hand during its run, and B takes the lock.
    rmSync(lockFileOf(r));
    const b = locked(r);
    clean(restoreFromLock(r.store, a));
    assert.equal(read(r.root, "src/a.ts"), "a2\n");
    const now = readLock(r.store);
    assert.ok(now !== null && "lock" in now, "A's restore unlinked B's lock");
    assert.equal(now.lock.run, b.run);
  });
});

test("R10 the restore lists and removes nothing through a symlinked parent", () => {
  withRepo(
    (root) => {
      put(root, "src/lib/a.ts", "a\n");
      put(root, "src/gone/sub/y.ts", "y\n");
    },
    (root) => {
      put(root, "src/lib/a.ts", "a2\n");
      rmSync(join(root, "src/gone"), { recursive: true });
    },
    (r) => {
      const lock = reverted(r);
      assert.deepEqual(lock.createdDirs, ["src/gone", "src/gone/sub"]);
      // Outside the working tree: a file with the run's temp name, and an empty directory where createdDirs reach.
      const elsewhere = join(lock.root, ".git", "elsewhere");
      const a = lock.entries.find((e) => e.path === "src/lib/a.ts");
      const tempNamed = join(elsewhere, "lib", `${a?.tmp}99999.tmp`);
      put(elsewhere, `lib/${a?.tmp}99999.tmp`, "not the run's\n");
      mkdirSync(join(elsewhere, "gone", "sub"), { recursive: true });
      for (const d of ["lib", "gone"]) {
        rmSync(join(r.root, "src", d), { recursive: true });
        symlinkSync(join(elsewhere, d), join(r.root, "src", d));
      }
      const result = restoreFromLock(r.store, lock);
      assert.ok(existsSync(tempNamed), "the temp sweep unlinked a file through the symlink");
      assert.ok(existsSync(join(elsewhere, "gone", "sub")), "the restore removed a directory through the symlink");
      assert.deepEqual(result.failed.map((f) => f.path), ["src/lib/a.ts"]);
      assert.ok(existsSync(lockFileOf(r)), "the lock went with a path not restored");
    },
  );
});

// Node only: bun does not rebind node:fs's named exports. Bun also ignores the `skip` option of
// node:test, so the function is chosen, as tests/walkthrough.test.ts does.
const nodeOnly = typeof (globalThis as { Bun?: unknown }).Bun === "undefined" ? test : test.skip;

/**
 * The fsyncs and unlinks `body` makes, in order: `fsync <path>` and `unlink <path>`. Node's
 * `syncBuiltinESMExports` rebinds the named `node:fs` imports of every module, so the code under
 * test calls the recording functions.
 */
async function fsyncsAndUnlinks(body: () => void): Promise<string[]> {
  const { createRequire, syncBuiltinESMExports } = await import("node:module");
  const fs = createRequire(import.meta.url)("node:fs") as typeof import("node:fs");
  const saved = { openSync: fs.openSync, fsyncSync: fs.fsyncSync, unlinkSync: fs.unlinkSync };
  const opened = new Map<number, string>();
  const events: string[] = [];
  Object.assign(fs, {
    openSync: (path: string, ...rest: unknown[]): number => {
      const fd = (saved.openSync as (...a: unknown[]) => number)(path, ...rest);
      opened.set(fd, String(path));
      return fd;
    },
    fsyncSync: (fd: number): void => {
      events.push(`fsync ${opened.get(fd) ?? fd}`);
      saved.fsyncSync(fd);
    },
    unlinkSync: (path: string): void => {
      events.push(`unlink ${path}`);
      saved.unlinkSync(path);
    },
  });
  syncBuiltinESMExports();
  try {
    body();
  } finally {
    Object.assign(fs, saved);
    syncBuiltinESMExports();
  }
  return events;
}

nodeOnly("R14 the copy fallback fsyncs its copy's directory before it unlinks the source", async () => {
  await withRepoAsync(twoFiles, editBoth, async (r) => {
    const lock = reverted(r);
    writeFileSync(join(r.root, "src/a.ts"), "an edit on its way to another filesystem\n");
    const crossDevice = (from: string, to: string): void => {
      if (to.includes(`${sep}rescue${sep}`)) throw Object.assign(new Error("EXDEV: cross-device link not permitted"), { code: "EXDEV" });
      renameSync(from, to);
    };
    let result: Restored | undefined;
    const events = await fsyncsAndUnlinks(() => {
      result = restoreFromLock(r.store, lock, { rename: crossDevice });
    });
    assert.ok(result !== undefined);
    clean(result);
    const to = result.rescued[0]?.to as string;
    const unlinked = events.indexOf(`unlink ${join(r.root, "src/a.ts")}`);
    const synced = events.indexOf(`fsync ${dirname(to)}`);
    assert.ok(unlinked >= 0, JSON.stringify(events));
    assert.ok(synced >= 0 && synced < unlinked, `the copy's directory was not fsynced before the source was unlinked: ${JSON.stringify(events)}`);
  });
});

nodeOnly("R13 the restore fsyncs the directories it wrote before it unlinks the lock", async () => {
  await withRepoAsync(twoFiles, editBoth, async (r) => {
    const lock = reverted(r);
    const events = await fsyncsAndUnlinks(() => clean(restoreFromLock(r.store, lock)));
    const unlocked = events.findIndex((e) => e.startsWith("unlink ") && e.endsWith(`${sep}mstack-mutation.lock`));
    const synced = events.indexOf(`fsync ${join(r.root, "src")}`);
    assert.ok(unlocked >= 0, JSON.stringify(events));
    assert.ok(synced >= 0 && synced < unlocked, `src/ was not fsynced before the lock was unlinked: ${JSON.stringify(events)}`);
  });
});
