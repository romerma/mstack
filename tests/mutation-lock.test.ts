import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";

import { lockPath, refusals, revertSet } from "../src/mutation.ts";
import { acquireLock, bootTime, discard, liveness, pidNamespace, prepareRun, readLock, sweepStale, validateLock, type Lock } from "../src/mutation-lock.ts";
import { storeAt } from "../src/paths.ts";
import { parseState } from "../src/state.ts";
import {
  git, gitDirOf, hold, locked, lockFileOf, put, runDirOf, setOf, SIGNAL_MS, SPAWN_TEST, staged, status, until, withRepo, withRepoAsync,
} from "./mutation-fixture.ts";

/**
 * Item 42, task 2.1: staging the run, the lock, and whether the run that wrote
 * a lock is alive. Every repository is a sandbox; the lock and the run
 * directory are in its git directory.
 */

const sha = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const umask = process.umask();
const here = (): { host: string; boot: number; pidns: string | null } => ({ host: hostname(), boot: bootTime(), pidns: pidNamespace() });

/** A start with three code files; the item edits one, deletes one, adds one. */
const threeFiles = (root: string): void => {
  put(root, "src/a.ts", "a\n");
  put(root, "src/old.ts", "old\n");
};
const editDeleteAdd = (root: string): void => {
  put(root, "src/a.ts", "a2\n", 0o600);
  rmSync(join(root, "src/old.ts"));
  put(root, "src/new.ts", "new\n");
};

test("R8 the lock is one JSON document before the first write", () => {
  withRepo(threeFiles, editDeleteAdd, (r) => {
    const before = status(r.root);
    const lock = locked(r);
    const parsed = JSON.parse(readFileSync(lockFileOf(r), "utf8")) as Lock;
    assert.deepEqual(parsed, JSON.parse(JSON.stringify(lock)), "the lock on disk is not the record");
    assert.equal(parsed.v, 1);
    assert.match(parsed.run, new RegExp(`^\\d{8}T\\d{6}Z-${process.pid}-[0-9a-f]{4}$`));
    // Node's os.uptime() is whole seconds here, so two reads of the boot time can differ by one.
    assert.deepEqual([parsed.pid, parsed.host, Math.abs(parsed.boot - bootTime()) <= 1, parsed.pidns], [process.pid, hostname(), true, pidNamespace()]);
    assert.ok(Math.abs(Date.parse(parsed.startedAt) - Date.now()) < 60_000, `startedAt ${parsed.startedAt}`);
    assert.match(parsed.cli, /^\/.*\/bin\/mstack$/);
    assert.deepEqual([parsed.root, parsed.head, parsed.start, parsed.branch], [r.root, git(r.root, "rev-parse", "HEAD"), r.start, git(r.root, "branch", "--show-current")]);
    assert.deepEqual(parsed.entries.map((e) => e.path), ["src/a.ts", "src/new.ts", "src/old.ts"]);
    const [a, added, old] = parsed.entries as [Lock["entries"][number], Lock["entries"][number], Lock["entries"][number]];
    assert.deepEqual(a.start, { sha256: sha("a\n"), bits: 0o666 & ~umask });
    assert.deepEqual(a.head, { sha256: sha("a2\n"), bits: 0o600 });
    assert.deepEqual([added.start, added.head], [null, { sha256: sha("new\n"), bits: lstatSync(join(r.root, "src/new.ts")).mode & 0o7777 }]);
    assert.deepEqual([old.start?.sha256, old.head], [sha("old\n"), null]);
    for (const e of parsed.entries) assert.equal(e.tmp, `.mstack-mutation-${parsed.run}-${e.n}.`);
    const run = runDirOf(r, lock);
    assert.equal(readFileSync(join(run, "start", String(a.n)), "utf8"), "a\n");
    assert.equal(readFileSync(join(run, "head", String(a.n)), "utf8"), "a2\n");
    assert.deepEqual(readdirSync(gitDirOf(r)).filter((n) => n.endsWith(".tmp")), [], "a temporary lock file was left");
    assert.equal(status(r.root), before, "the working tree changed before the first write");
  });
});

test("R8 a linked worktree has its own lock", () => {
  withRepo(threeFiles, editDeleteAdd, (r) => {
    const wt = mkdtempSync(join(tmpdir(), "mstack-wt-"));
    try {
      git(r.root, "worktree", "add", "-q", "-b", "wt", wt);
      const other = storeAt(wt);
      const set = revertSet(other, r.start);
      assert.ok(set !== null);
      const prepared = prepareRun(other, r.start, set);
      assert.ok(prepared.ok);
      assert.ok(acquireLock(other, prepared.lock).ok);
      const own = join(git(wt, "rev-parse", "--absolute-git-dir"), "mstack-mutation.lock");
      assert.match(own, /\/worktrees\/[^/]+\/mstack-mutation\.lock$/);
      assert.equal(lockPath(other), own);
      assert.ok(existsSync(own));
      assert.equal(existsSync(lockFileOf(r)), false, "the main worktree holds the linked one's lock");
      const st = parseState(r.store.state);
      assert.equal(refusals(r.store, st, st.items[0], "/nonexistent-mstack-copy"), null, "the main worktree is refused by another worktree's lock");
    } finally {
      execFileSync("git", ["worktree", "remove", "--force", wt], { cwd: r.root, stdio: "ignore" });
      rmSync(wt, { recursive: true, force: true });
    }
  });
});

test("R8 two processes acquire at once and one wins", SPAWN_TEST, async () => {
  await withRepoAsync(threeFiles, editDeleteAdd, async (r) => {
    const before = status(r.root);
    const gate = mkdtempSync(join(tmpdir(), "mstack-release-"));
    const release = join(gate, "release");
    const a = hold(r.root, "acquire", "prepared", { release });
    const b = hold(r.root, "acquire", "prepared", { release });
    try {
      assert.ok(await until(() => a.journal().includes("at prepared") && b.journal().includes("at prepared"), SIGNAL_MS), "the holders never staged");
      writeFileSync(release, "");
      const codes = await Promise.all([a.exited, b.exited]);
      assert.deepEqual([...codes].sort(), [0, 2], `exit codes ${JSON.stringify(codes)}`);
      const [winner, loser] = codes[0] === 0 ? [a, b] : [b, a];
      assert.match(winner.journal(), /at lock-written/);
      assert.doesNotMatch(loser.journal(), /at lock-written/);
      assert.match(loser.journal(), new RegExp(`refused .*pid ${winner.pid}\\b`));
      const read = readLock(r.store);
      assert.ok(read !== null && "lock" in read);
      assert.equal(read.lock.pid, winner.pid);
      assert.equal(status(r.root), before, "a path was written");
    } finally {
      a.dispose();
      b.dispose();
      rmSync(gate, { recursive: true, force: true });
    }
  });
});

test("R8 leftovers of a killed prepare are removed once the next run holds the lock", SPAWN_TEST, async () => {
  await withRepoAsync(threeFiles, editDeleteAdd, async (r) => {
    const killed = hold(r.root, "acquire", "prepared");
    try {
      assert.ok(await until(() => killed.journal().includes("at prepared"), SIGNAL_MS), "the holder never staged");
      killed.kill();
      await killed.exited;
    } finally {
      killed.dispose();
    }
    const base = join(gitDirOf(r), "mstack-mutation");
    const [old] = readdirSync(base);
    assert.ok(old !== undefined && existsSync(join(base, old, "head")), "the killed run left no staging");
    // A SIGKILL inside acquireLock leaves its temporary lock file.
    const tmp = join(gitDirOf(r), `mstack-mutation.lock.${old}.tmp`);
    writeFileSync(tmp, '{"v": 1, "ru');
    const lock = locked(r);
    sweepStale(r.store, lock);
    assert.deepEqual(readdirSync(base), [lock.run]);
    assert.equal(existsSync(tmp), false, "the temporary lock file of the killed run is still there");
  });
});

test("R8 a run directory whose rescue holds anything is kept", () => {
  withRepo(threeFiles, editDeleteAdd, (r) => {
    const base = join(gitDirOf(r), "mstack-mutation");
    const rescued = join(base, "20260101T000000Z-1-aaaa", "rescue", "1", "src");
    mkdirSync(rescued, { recursive: true });
    writeFileSync(join(rescued, "a.ts"), "an edit the restore saved\n");
    mkdirSync(join(base, "20260101T000000Z-2-bbbb", "rescue"), { recursive: true });
    mkdirSync(join(base, "20260101T000000Z-3-cccc", "head"), { recursive: true });
    const lock = locked(r);
    sweepStale(r.store, lock);
    assert.deepEqual(readdirSync(base).sort(), ["20260101T000000Z-1-aaaa", lock.run].sort());
    assert.equal(readFileSync(join(rescued, "a.ts"), "utf8"), "an edit the restore saved\n");
  });
});

test("R9 a 3 MiB start file is staged byte for byte", () => {
  const big = Buffer.alloc(3 << 20);
  for (let i = 0; i < big.length; i++) big[i] = (i * 7919) % 251;
  withRepo(
    (root) => put(root, "src/big.bin", big),
    (root) => put(root, "src/big.bin", Buffer.from("smaller now\n")),
    (r) => {
      const lock = staged(r);
      const [entry] = lock.entries;
      assert.ok(entry !== undefined && entry.path === "src/big.bin");
      const stagedBytes = readFileSync(join(runDirOf(r, lock), "start", String(entry.n)));
      assert.ok(stagedBytes.equals(big), `staged ${stagedBytes.length} bytes, not the start's ${big.length}`);
      const fromGit = execFileSync("git", ["cat-file", "blob", `${r.start}:src/big.bin`], { cwd: r.root, maxBuffer: 8 << 20 });
      assert.ok(stagedBytes.equals(fromGit));
      assert.equal(entry.start?.sha256, sha(big));
    },
  );
});

test("R1 a start blob that cannot be read leaves no run directory", () => {
  withRepo(
    (root) => put(root, "src/x.ts", "x\n"),
    (root) => put(root, "src/x.ts", "x2\n"),
    (r) => {
      // A required smudge filter whose command does not exist: git cannot write the start's content.
      writeFileSync(join(gitDirOf(r), "info", "attributes"), "src/x.ts filter=broken\n");
      git(r.root, "config", "filter.broken.smudge", "mstack-no-such-filter-command");
      git(r.root, "config", "filter.broken.required", "true");
      const prepared = prepareRun(r.store, r.start, setOf(r));
      assert.ok(!prepared.ok, "prepareRun staged a blob git could not read");
      assert.equal(prepared.path, "src/x.ts");
      assert.match(prepared.reason, /src\/x\.ts/);
      assert.equal(existsSync(join(gitDirOf(r), "mstack-mutation")), false, "a run directory was left");
      assert.equal(existsSync(lockFileOf(r)), false);
    },
  );
});

test("R24 a lock path that is absolute, empty, or has a . .. or .git segment is refused", () => {
  withRepo(threeFiles, editDeleteAdd, (r) => {
    const lock = staged(r);
    assert.deepEqual(validateLock(lock), []);
    const withPath = (path: string, at = 0): Lock => ({ ...lock, entries: lock.entries.map((e, i) => (i === at ? { ...e, path } : e)) });
    for (const bad of ["/etc/passwd", "", "src//a.ts", "./src/a.ts", "src/./a.ts", "../outside.txt", "src/../../x.ts", ".git/config", "src/.git/x.ts"]) {
      const problems = validateLock(withPath(bad));
      assert.ok(problems.some((p) => p.includes(JSON.stringify(bad))), `${JSON.stringify(bad)} was not refused: ${JSON.stringify(problems)}`);
    }
    assert.ok(validateLock(withPath("src/a.ts", 1)).some((p) => /appears twice/.test(p)), "a path that appears twice was not refused");
    assert.ok(validateLock({ ...lock, createdDirs: ["../up"] }).some((p) => p.includes('"../up"')), "a directory outside the root was not refused");
    assert.ok(validateLock({ ...lock, v: 2 } as unknown as Lock).some((p) => /version/.test(p)));
  });
});

test("R24 an unparseable lock is reported as damaged", () => {
  withRepo(threeFiles, editDeleteAdd, (r) => {
    assert.equal(readLock(r.store), null);
    for (const garbage of ["garbage", "[1, 2]", ""]) {
      writeFileSync(lockFileOf(r), garbage);
      const read = readLock(r.store);
      assert.ok(read !== null && "damaged" in read, `${JSON.stringify(garbage)} read as ${JSON.stringify(read)}`);
      assert.equal(readFileSync(lockFileOf(r), "utf8"), garbage, "reading the lock changed it");
    }
  });
});

test("R23 liveness: this process is running, an exited pid is not, a process at the pid that started later is not", async () => {
  assert.equal(liveness({ ...here(), pid: process.pid, startedAt: new Date().toISOString() }).state, "running");
  const exited = spawnSync("true").pid;
  assert.equal(liveness({ ...here(), pid: exited, startedAt: new Date().toISOString() }).state, "not-running");
  const lockTime = new Date(Date.now() - 600_000).toISOString();
  const later = spawn("sleep", ["30"], { stdio: "ignore" });
  try {
    const verdict = liveness({ ...here(), pid: later.pid as number, startedAt: lockTime });
    assert.equal(verdict.state, "not-running", `a process started after the lock: ${JSON.stringify(verdict)}`);
  } finally {
    later.kill("SIGKILL");
  }
});

test("R23 liveness: another boot of this host is not running, another host is unknown at any boot", () => {
  const exited = spawnSync("true").pid;
  const now = new Date().toISOString();
  assert.equal(liveness({ ...here(), boot: bootTime() - 3600, pid: exited, startedAt: now }).state, "not-running");
  for (const boot of [bootTime(), bootTime() - 3600]) {
    for (const pid of [exited, process.pid]) {
      const verdict = liveness({ ...here(), host: "another-host.invalid", boot, pid, startedAt: now });
      assert.equal(verdict.state, "unknown", `another host, boot ${boot}, pid ${pid}`);
      assert.match(verdict.reason, /another-host\.invalid/);
    }
  }
});

test("R23 liveness: a live pid that started before the lock is running at another boot time, a ps that fails is running, and a null pid namespace against a non-null one is unknown", () => {
  const now = new Date().toISOString();
  assert.equal(liveness({ ...here(), boot: bootTime() - 3600, pid: process.pid, startedAt: now }).state, "running", "a different boot time made a live run dead");
  const later = spawn("sleep", ["30"], { stdio: "ignore" });
  const empty = mkdtempSync(join(tmpdir(), "mstack-nops-"));
  const saved = process.env["PATH"];
  try {
    process.env["PATH"] = empty;
    const verdict = liveness({ ...here(), pid: later.pid as number, startedAt: new Date(Date.now() - 600_000).toISOString() });
    assert.equal(verdict.state, "running", `ps could not run: ${JSON.stringify(verdict)}`);
  } finally {
    process.env["PATH"] = saved;
    later.kill("SIGKILL");
    rmSync(empty, { recursive: true, force: true });
  }
  const other = pidNamespace() === null ? "pid:[4026531836]" : null;
  assert.equal(liveness({ ...here(), pidns: other, pid: process.pid, startedAt: now }).state, "unknown");
});

test("R24 a lock entry whose temp prefix is not the one its run derives is refused", () => {
  withRepo(threeFiles, editDeleteAdd, (r) => {
    const lock = staged(r);
    const other = lock.run.replace(/[0-9a-f]{4}$/, (hex) => (hex === "0000" ? "ffff" : "0000"));
    for (const tmp of ["", `.mstack-mutation-${other}-0.`, `.mstack-mutation-${lock.run}-1.`]) {
      const problems = validateLock({ ...lock, entries: lock.entries.map((e, i) => (i === 0 ? { ...e, tmp } : e)) });
      assert.ok(problems.some((p) => /temp prefix/.test(p)), `${JSON.stringify(tmp)} was not refused: ${JSON.stringify(problems)}`);
    }
  });
});

test("R23 liveness: a live process this user may not signal (EPERM) is running", { skip: process.getuid?.() === 0 ? "root may signal pid 1" : false }, () => {
  assert.throws(() => process.kill(1, 0), (error: NodeJS.ErrnoException) => error.code === "EPERM");
  const verdict = liveness({ ...here(), pid: 1, startedAt: new Date().toISOString() });
  assert.equal(verdict.state, "running", JSON.stringify(verdict));
});

test("R24 two lock paths that differ only by case or Unicode normalisation are refused", () => {
  withRepo(threeFiles, editDeleteAdd, (r) => {
    const lock = staged(r);
    const withPaths = (first: string, second: string): Lock => ({ ...lock, entries: lock.entries.map((e, i) => (i === 0 ? { ...e, path: first } : i === 1 ? { ...e, path: second } : e)) });
    for (const [first, second] of [["src/a.ts", "src/A.ts"], ["src/a.ts", "SRC/a.ts"], ["src/caf\u00e9.ts", "src/cafe\u0301.ts"]] as const) {
      const problems = validateLock(withPaths(first, second));
      assert.ok(problems.some((p) => /appears twice/.test(p) && p.includes(JSON.stringify(second))), `${JSON.stringify([first, second])} was not refused: ${JSON.stringify(problems)}`);
    }
  });
});

test("R24 a lock that is a symlink or a FIFO is damaged, read without following the link or blocking", () => {
  withRepo(threeFiles, editDeleteAdd, (r) => {
    const elsewhere = join(gitDirOf(r), "a-whole-lock-elsewhere.json");
    writeFileSync(elsewhere, JSON.stringify(staged(r)));
    symlinkSync(elsewhere, lockFileOf(r));
    const viaLink = readLock(r.store);
    assert.ok(viaLink !== null && "damaged" in viaLink, `the symlink was followed: ${JSON.stringify(viaLink)?.slice(0, 60)}`);
    rmSync(lockFileOf(r));
    execFileSync("mkfifo", [lockFileOf(r)]);
    // A reader that blocks waits for a writer: this one opens the FIFO after 2 s, so such a read ends, late.
    const writer = spawn("sh", ["-c", `sleep 2; : > '${lockFileOf(r)}'`], { stdio: "ignore" });
    try {
      const t0 = Date.now();
      const viaFifo = readLock(r.store);
      const took = Date.now() - t0;
      assert.ok(viaFifo !== null && "damaged" in viaFifo, JSON.stringify(viaFifo));
      assert.match(viaFifo.damaged, /not a regular file/);
      assert.ok(took < 1500, `readLock blocked for ${took} ms`);
    } finally {
      writer.kill("SIGKILL");
    }
  });
});

test("R8 a run directory the sweep cannot remove is left, and the sweep does not throw", { skip: process.getuid?.() === 0 }, () => {
  withRepo(threeFiles, editDeleteAdd, (r) => {
    const stuck = join(gitDirOf(r), "mstack-mutation", "20260101T000000Z-4-dddd", "head");
    mkdirSync(stuck, { recursive: true });
    writeFileSync(join(stuck, "0"), "a staged copy in a directory this user cannot write\n");
    chmodSync(stuck, 0o555);
    try {
      const lock = locked(r);
      sweepStale(r.store, lock);
      assert.ok(existsSync(join(stuck, "0")));
      assert.ok(existsSync(runDirOf(r, lock)));
    } finally {
      chmodSync(stuck, 0o755);
    }
  });
});

test("R8 a run refused the lock can remove its own staging", () => {
  withRepo(threeFiles, editDeleteAdd, (r) => {
    const loser = staged(r);
    const winner = locked(r);
    assert.equal(acquireLock(r.store, loser).ok, false);
    discard(r.store, loser.run);
    assert.equal(existsSync(runDirOf(r, loser)), false, "the refused run's staging is still there");
    assert.ok(existsSync(join(runDirOf(r, winner), "head")), "the winner's staging went too");
    const read = readLock(r.store);
    assert.ok(read !== null && "lock" in read && read.lock.run === winner.run);
  });
});
