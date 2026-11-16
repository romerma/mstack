import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, symlinkSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { UserError } from "../src/paths.ts";
import { cell, row, withLock } from "../src/tsv.ts";

test("a cell a spreadsheet would run as a formula is neutralised", () => {
  // Evidence is often attacker-influenced text: PR titles, branch names,
  // filenames, generated output. None of it may execute when a reviewer opens
  // the file in a spreadsheet.
  for (const hostile of ["=cmd|' /c calc'!A1", "+1+1", "-2+3", "@SUM(A1)"]) {
    assert.equal(cell(hostile).charAt(0), "'", `${hostile} was left executable`);
  }
});

test("ordinary text is left alone", () => {
  assert.equal(cell("reverted, see PR #12"), "reverted, see PR #12");
  assert.equal(cell("a-b"), "a-b");
});

test("tabs and newlines cannot break a row apart", () => {
  assert.equal(cell("a\tb\nc\r\nd"), "a b c d");
  assert.equal(row(["a\tb", "c"]).split("\t").length, 2);
});

test("null and undefined become empty, not the string 'undefined'", () => {
  assert.equal(cell(undefined), "");
  assert.equal(cell(null), "");
});

const HOLDER = join(dirname(fileURLToPath(import.meta.url)), "lock-holder.ts");
const PROBE = join(dirname(fileURLToPath(import.meta.url)), "lock-probe.ts");
// Every test that spawns processes carries SPAWN_TEST, which sits above the
// watchdog, and waits for positive signals (a journal line, an exit) with bounds
// that load cannot eat; nothing here depends on how long a child takes to boot.
const WATCHDOG_MS = 45_000;
const SPAWN_TEST = { timeout: 90_000 };
const SIGNAL_MS = 20_000;
const RUNTIME_FLAGS = typeof (globalThis as { Bun?: unknown }).Bun === "undefined"
  ? ["--experimental-strip-types", "--disable-warning=ExperimentalWarning"]
  : [];

interface Holder {
  readonly child: ChildProcess;
  readonly exited: Promise<number | null>;
  release(): void;
  /** Let the process go on from the step it was told to block at. */
  releaseStep(): void;
}

/**
 * Real processes contending for one lock.
 *
 * `withLock` exists for fan-out, which is several `mstack` processes at once,
 * so a test that calls it twice in one process, or runs its children one after
 * another, never meets the case it was written for.
 */
function lockBench() {
  const dir = mkdtempSync(join(tmpdir(), "mstack-lock-"));
  const file = join(dir, "target.tsv");
  const journal = join(dir, "journal");
  writeFileSync(journal, "");
  const children: ChildProcess[] = [];
  // A test that fails or is cancelled while it awaits a child leaves the child
  // running, and the child's own deadline can be many seconds. Past this budget
  // every child is killed, so what the test awaits resolves and it fails, fast,
  // instead of stalling the suite. It is far above what a test needs under load.
  const watchdog = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, WATCHDOG_MS);
  return {
    dir,
    lock: `${file}.lock`,
    journal: () => readFileSync(journal, "utf8"),
    file,
    /** The pid of a process that has exited, for a lock whose owner is dead. */
    async deadPid(): Promise<number> {
      const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
      const pid = child.pid as number;
      await new Promise((res) => child.on("close", res));
      return pid;
    },
    hold(name: string, timeoutMs: number, steps: { blockAt?: string; signal?: string } = {}): Holder {
      const release = join(dir, `release-${name}`);
      const child = spawn(
        process.execPath,
        [...RUNTIME_FLAGS, HOLDER, file, journal, name, String(timeoutMs), release, steps.blockAt ?? "", steps.signal ?? ""],
        { stdio: "ignore" },
      );
      children.push(child);
      return {
        child,
        exited: new Promise((res) => child.on("close", (code) => res(code))),
        release: () => writeFileSync(release, ""),
        releaseStep: () => writeFileSync(`${release}.step`, ""),
      };
    },
    dispose() {
      clearTimeout(watchdog);
      for (const child of children) child.kill("SIGKILL");
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function until(condition: () => boolean, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (condition()) return true;
    await new Promise((res) => setTimeout(res, 10));
  }
  return condition();
}

test("a waiter that times out on a live holder does not enter beside it", SPAWN_TEST, async () => {
  const bench = lockBench();
  try {
    const a = bench.hold("A", 5_000);
    assert.ok(await until(() => bench.journal().includes("A enter"), SIGNAL_MS), "A never took the lock");

    // B's patience is shorter than A's hold. Whatever B does about that, keep
    // waiting or give up and say so, it may not run beside A. B's exit (or its
    // entering) is the signal that it has decided; no clock is read.
    const b = bench.hold("B", 200);
    b.release();
    let bExited = false;
    void b.exited.then(() => {
      bExited = true;
    });
    assert.ok(await until(() => bExited || bench.journal().includes("B enter"), SIGNAL_MS), "B neither gave up nor entered");

    assert.equal(bench.journal(), "A enter\n", "B ran its critical section while A was still inside its own");
    assert.ok(existsSync(bench.lock), "A is still inside and its lock file is gone: B removed a lock it did not create");

    a.release();
    assert.equal(await a.exited, 0);
    assert.ok(await until(() => bExited, SIGNAL_MS), "B never finished after A let go");
    assert.ok(!existsSync(bench.lock), "the lock must not survive the writers");
  } finally {
    bench.dispose();
  }
});

test("a creator that lost its empty lock to a breaker does not enter beside the breaker", SPAWN_TEST, async () => {
  // The lock is created empty and the owner written a moment later. A creator held
  // between the two for longer than the unreadable-owner limit has an empty lock
  // that looks like a leftover, and a waiter breaks it and takes its own. When the
  // creator goes on it must find that the lock is no longer its own and wait.
  const bench = lockBench();
  try {
    const c = bench.hold("C", 5_000, { blockAt: "lock-created", signal: "waiting" });
    assert.ok(await until(() => bench.journal().includes("C at lock-created"), SIGNAL_MS), "C never created the lock");
    const old = new Date(Date.now() - 60_000);
    utimesSync(bench.lock, old, old);

    const w = bench.hold("W", 5_000);
    assert.ok(await until(() => bench.journal().includes("W enter"), SIGNAL_MS), "W never broke the empty lock");
    const ownedByW = () => readFileSync(bench.lock, "utf8").startsWith(`${w.child.pid} `);
    assert.ok(ownedByW(), "fixture: W should hold the lock it took from C");

    c.releaseStep();
    const settled = await until(() => /C (at waiting|enter)/.test(bench.journal()), SIGNAL_MS);
    assert.ok(settled, "C neither entered nor waited after it was released");
    assert.ok(!bench.journal().includes("C enter"), `C entered beside W:\n${bench.journal()}`);
    assert.ok(ownedByW(), "W's lock was changed or removed by C");

    w.release();
    assert.equal(await w.exited, 0);
    assert.ok(await until(() => bench.journal().includes("C enter"), SIGNAL_MS), "C never got the lock after W let go");
    c.release();
    assert.equal(await c.exited, 0);
    assert.deepEqual(
      bench.journal().split("\n").filter((l) => /enter|leave/.test(l)),
      ["W enter", "W leave", "C enter", "C leave"],
    );
    assert.ok(!existsSync(bench.lock), "the lock must not survive the writers");
  } finally {
    bench.dispose();
  }
});

test("a lock left by a killed process is broken, and the next caller holds a real one", SPAWN_TEST, async () => {
  const bench = lockBench();
  try {
    const a = bench.hold("A", 5_000);
    assert.ok(await until(() => bench.journal().includes("A enter"), SIGNAL_MS), "A never took the lock");
    a.child.kill("SIGKILL");
    await a.exited;
    assert.ok(existsSync(bench.lock), "fixture: a killed holder should leave its lock behind");

    const b = bench.hold("B", 200);
    assert.ok(await until(() => bench.journal().includes("B enter"), SIGNAL_MS), "B hung on a dead process's lock");

    // Breaking a stale lock is not holding one. A caller that removes the
    // leftover and walks in has no lock for the next process to wait on.
    assert.ok(existsSync(bench.lock), "B is inside with no lock file: it broke the stale lock and never took its own");

    b.release();
    assert.equal(await b.exited, 0);
    assert.ok(!existsSync(bench.lock), "the lock must not survive the writers");
  } finally {
    bench.dispose();
  }
});

const TOKEN = "00000000-0000-4000-8000-000000000000";

test("a waiter on a live holder throws a UserError naming the lock and the holder, and leaves the lock alone", SPAWN_TEST, async () => {
  const bench = lockBench();
  try {
    const a = bench.hold("A", 5_000);
    assert.ok(await until(() => bench.journal().includes("A enter"), SIGNAL_MS), "A never took the lock");
    let entered = false;
    assert.throws(
      () => withLock(bench.file, () => { entered = true; }, { timeoutMs: 100 }),
      (error: unknown) =>
        error instanceof UserError &&
        error.message.includes(bench.lock) &&
        error.message.includes(`pid ${a.child.pid}`) &&
        (error.fix ?? "").length > 0,
    );
    assert.equal(entered, false);
    assert.ok(existsSync(bench.lock), "the throwing waiter removed a lock it did not own");
    a.release();
    assert.equal(await a.exited, 0);
  } finally {
    bench.dispose();
  }
});

test("a live holder's lock is never aged out, however old it is", SPAWN_TEST, async () => {
  // The unreadable-owner rule breaks a lock by age. A readable owner that is alive
  // must not be subject to it: the default wait is 2 s and so is that limit, so a
  // waiter that outlasts it would otherwise walk in beside a holder still inside.
  const bench = lockBench();
  try {
    const a = bench.hold("A", 5_000);
    assert.ok(await until(() => bench.journal().includes("A enter"), SIGNAL_MS), "A never took the lock");
    const old = new Date(Date.now() - 60_000);
    utimesSync(bench.lock, old, old);
    let entered = false;
    assert.throws(() => withLock(bench.file, () => { entered = true; }, { timeoutMs: 100 }), UserError);
    assert.equal(entered, false, "a waiter entered beside a live holder because its lock was old");
    assert.ok(existsSync(bench.lock), "the waiter removed a live holder's lock because it was old");
    a.release();
    assert.equal(await a.exited, 0);
  } finally {
    bench.dispose();
  }
});

test("a guard left by a dead process does not keep a dead lock from being broken", SPAWN_TEST, async () => {
  const bench = lockBench();
  try {
    writeFileSync(bench.lock, `${await bench.deadPid()} ${TOKEN}\n`);
    writeFileSync(`${bench.lock}.break`, `${await bench.deadPid()} ${TOKEN}\n`);
    let inside = "";
    withLock(bench.file, () => {
      inside = readFileSync(bench.lock, "utf8");
    }, { timeoutMs: 1_000 });
    assert.match(inside, new RegExp(`^${process.pid} [0-9a-f-]{36}\\n$`), "the caller entered without its own lock");
    assert.ok(!existsSync(bench.lock) && !existsSync(`${bench.lock}.break`), "a lock or guard was left behind");
  } finally {
    bench.dispose();
  }
});

test("an empty guard left by a process killed as it created it does not keep a dead lock from being broken", SPAWN_TEST, async () => {
  // Every guard is empty for an instant, so a breaker killed there leaves an empty
  // `.lock.break` beside the dead lock. Nothing names its owner, so only its age
  // can say it is a leftover, and it must then be removed, not merely ignored.
  const bench = lockBench();
  try {
    const guard = `${bench.lock}.break`;
    writeFileSync(bench.lock, `${await bench.deadPid()} ${TOKEN}\n`);
    writeFileSync(guard, "");
    const old = new Date(Date.now() - 60_000);
    utimesSync(guard, old, old);
    let inside = "";
    withLock(bench.file, () => {
      inside = readFileSync(bench.lock, "utf8");
    }, { timeoutMs: 1_000 });
    assert.match(inside, new RegExp(`^${process.pid} [0-9a-f-]{36}\\n$`), "the caller entered without its own lock");
    assert.ok(!existsSync(bench.lock) && !existsSync(guard), "a lock or guard was left behind");
  } finally {
    bench.dispose();
  }
});

test("a dead lock is not broken while a live process holds the break guard", SPAWN_TEST, async () => {
  const bench = lockBench();
  try {
    const guard = `${bench.lock}.break`;
    const dead = `${await bench.deadPid()} ${TOKEN}\n`;
    writeFileSync(bench.lock, dead);
    writeFileSync(guard, `${process.pid} ${TOKEN}\n`);
    let entered = false;
    assert.throws(() => withLock(bench.file, () => { entered = true; }, { timeoutMs: 150 }), UserError);
    assert.equal(entered, false, "a second breaker ran while another process was breaking");
    assert.equal(readFileSync(bench.lock, "utf8"), dead, "the lock was broken without the guard");
    assert.equal(readFileSync(guard, "utf8"), `${process.pid} ${TOKEN}\n`, "a live process's guard was removed");
  } finally {
    bench.dispose();
  }
});

test("a lock whose owner exists but belongs to someone else is treated as held", { skip: process.getuid?.() === 0 }, () => {
  // kill(1, 0) is EPERM for a non-root user: the process is there, so the lock is not stale.
  const bench = lockBench();
  try {
    writeFileSync(bench.lock, `1 ${TOKEN}\n`);
    let entered = false;
    assert.throws(() => withLock(bench.file, () => { entered = true; }, { timeoutMs: 100 }), UserError);
    assert.equal(entered, false, "EPERM was read as a dead owner");
    assert.equal(readFileSync(bench.lock, "utf8"), `1 ${TOKEN}\n`);
  } finally {
    bench.dispose();
  }
});

test("a lock is never visible with a partial or foreign owner in it", SPAWN_TEST, async () => {
  // The owner is written just after the exclusive create, so a reader may meet the
  // lock empty for an instant, which the unreadable-owner rule waits on. What it
  // must never meet is half an owner. Hammer the name from one process and read it
  // from this one. The writer is bounded by time, not by a count of iterations, so
  // how long the test takes does not depend on how loaded the machine is.
  const bench = lockBench();
  const writer = spawn(
    process.execPath,
    [
      ...RUNTIME_FLAGS,
      "-e",
      `import(${JSON.stringify(join(dirname(HOLDER), "..", "src", "tsv.ts"))}).then(({withLock})=>{for(const end=Date.now()+500;Date.now()<end;)withLock(${JSON.stringify(bench.file)},()=>{})})`,
    ],
    { stdio: "ignore" },
  );
  try {
    const done = new Promise((res) => writer.on("close", res));
    let finished = false;
    void done.then(() => { finished = true; });
    let seen = 0;
    while (!finished) {
      try {
        const text = readFileSync(bench.lock, "utf8");
        seen += 1;
        assert.match(text, /^(\d+ [0-9a-f-]{36}\n)?$/, "a reader saw a lock with a partial owner in it");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await new Promise((res) => setImmediate(res));
    }
    assert.ok(seen > 0, "fixture: the reader never caught the lock present");
  } finally {
    writer.kill("SIGKILL");
    bench.dispose();
  }
});

test("a waiter that judged a lock dead does not remove the live lock that replaced it", SPAWN_TEST, async () => {
  // The hazard is two breakers: each judges the same dead lock dead, one removes it
  // and takes its own, and the other then removes that live one and walks in. The
  // second breaker is stopped after it judged and before it took the guard, so the
  // first one gets all the way in, and the second must judge again under the guard.
  const bench = lockBench();
  try {
    writeFileSync(bench.lock, `${await bench.deadPid()} ${TOKEN}\n`);
    const w2 = bench.hold("W2", 5_000, { blockAt: "judged-stale", signal: "waiting" });
    assert.ok(await until(() => bench.journal().includes("W2 at judged-stale"), SIGNAL_MS), "W2 never judged the lock dead");

    const w1 = bench.hold("W1", 5_000);
    assert.ok(await until(() => bench.journal().includes("W1 enter"), SIGNAL_MS), "W1 never broke the dead lock");
    const ownedByW1 = () => readFileSync(bench.lock, "utf8").startsWith(`${w1.child.pid} `);
    assert.ok(ownedByW1(), "fixture: W1 should hold the lock it took from the dead owner");

    w2.releaseStep();
    assert.ok(await until(() => /W2 (at waiting|enter)/.test(bench.journal()), SIGNAL_MS), "W2 neither entered nor waited");
    assert.ok(!bench.journal().includes("W2 enter"), `W2 entered beside W1:\n${bench.journal()}`);
    assert.ok(ownedByW1(), "W2 removed the lock W1 now holds");

    w1.release();
    assert.equal(await w1.exited, 0);
    assert.ok(await until(() => bench.journal().includes("W2 enter"), SIGNAL_MS), "W2 never got the lock after W1 let go");
    w2.release();
    assert.equal(await w2.exited, 0);
    assert.deepEqual(
      bench.journal().split("\n").filter((l) => /enter|leave/.test(l)),
      ["W1 enter", "W1 leave", "W2 enter", "W2 leave"],
    );
    assert.ok(!existsSync(bench.lock) && !existsSync(`${bench.lock}.break`));
  } finally {
    bench.dispose();
  }
});

/**
 * `withLock` on a path in a child that is killed if it has not answered. A lock
 * that spins turns an assertion into a hung suite, so the deadline belongs to the
 * test, not to the code under test.
 */
async function probe(file: string, timeoutMs: number): Promise<{ out: string; ms: number; hung: boolean }> {
  const started = Date.now();
  const child = spawn(process.execPath, [...RUNTIME_FLAGS, PROBE, file, String(timeoutMs)], { stdio: ["ignore", "pipe", "ignore"] });
  let out = "";
  child.stdout.on("data", (chunk) => { out += String(chunk); });
  let hung = false;
  const timer = setTimeout(() => { hung = true; child.kill("SIGKILL"); }, timeoutMs + 15_000);
  await new Promise((res) => child.on("close", res));
  clearTimeout(timer);
  return { out: out.trim(), ms: Date.now() - started, hung };
}

test("a lock that cannot be created because the directory is missing fails promptly, naming the lock", SPAWN_TEST, async () => {
  const bench = lockBench();
  try {
    const file = join(bench.dir, "no-such-dir", "target.tsv");
    const result = await probe(file, 200);
    assert.equal(result.hung, false, "withLock spun instead of failing");
    assert.match(result.out, /^THREW UserError /);
    assert.ok(result.out.includes(`${file}.lock`), result.out);
    assert.match(result.out, /ENOENT/);
  } finally {
    bench.dispose();
  }
});

test("a lock that cannot be created because the directory is read-only fails promptly, naming the lock", { skip: process.getuid?.() === 0, ...SPAWN_TEST }, async () => {
  const bench = lockBench();
  try {
    const dir = join(bench.dir, "readonly");
    mkdirSync(dir);
    chmodSync(dir, 0o555);
    const result = await probe(join(dir, "target.tsv"), 200);
    chmodSync(dir, 0o755);
    assert.equal(result.hung, false, "withLock spun instead of failing");
    assert.match(result.out, /^THREW UserError /);
    assert.ok(result.out.includes(join(dir, "target.tsv.lock")), result.out);
    assert.match(result.out, /EACCES|EPERM|EROFS/);
  } finally {
    bench.dispose();
  }
});

test("a lock path that exists but cannot be read is waited on to the deadline, not spun on", SPAWN_TEST, async () => {
  // A dangling symlink: creating the lock fails with EEXIST, yet the path "does not
  // exist" to existsSync and stat. Nothing here can be broken, so the waiter must
  // reach the deadline and say so.
  const bench = lockBench();
  try {
    symlinkSync(join(bench.dir, "nowhere"), bench.lock);
    const result = await probe(bench.file, 200);
    assert.equal(result.hung, false, "withLock spun on a lock path it could neither take nor break");
    assert.match(result.out, /^THREW UserError /);
    assert.ok(result.out.includes(bench.lock), result.out);
  } finally {
    bench.dispose();
  }
});

test("taking and releasing a lock leaves nothing in the directory but the files it was given", () => {
  const bench = lockBench();
  try {
    const before = readdirSync(bench.dir).sort();
    withLock(bench.file, () => {});
    assert.deepEqual(readdirSync(bench.dir).sort(), before);
  } finally {
    bench.dispose();
  }
});

test("a release does not remove a lock that another owner now holds", () => {
  const bench = lockBench();
  try {
    withLock(bench.file, () => {
      // Something replaced the lock while we were inside (a breaker that judged us dead).
      rmSync(bench.lock);
      writeFileSync(bench.lock, `${process.pid} ${TOKEN}\n`);
    });
    assert.equal(readFileSync(bench.lock, "utf8"), `${process.pid} ${TOKEN}\n`, "released a lock it no longer owned");
  } finally {
    bench.dispose();
  }
});

test("a fresh lock with an unreadable owner is waited on, not broken", () => {
  const bench = lockBench();
  try {
    for (const content of ["", "garbage\n", "123\n"]) {
      writeFileSync(bench.lock, content);
      let entered = false;
      assert.throws(() => withLock(bench.file, () => { entered = true; }, { timeoutMs: 50 }), UserError, content);
      assert.equal(entered, false);
      assert.equal(readFileSync(bench.lock, "utf8"), content, "an unidentifiable lock was removed while young");
    }
  } finally {
    bench.dispose();
  }
});

test("an old lock with an unreadable owner is broken and the caller takes a real one", () => {
  const bench = lockBench();
  try {
    writeFileSync(bench.lock, "");
    const old = new Date(Date.now() - 60_000);
    utimesSync(bench.lock, old, old);
    let inside = "";
    withLock(bench.file, () => {
      inside = readFileSync(bench.lock, "utf8");
    }, { timeoutMs: 50 });
    assert.match(inside, new RegExp(`^${process.pid} [0-9a-f-]{36}\\n$`), "the caller entered without its own lock");
    assert.ok(!existsSync(bench.lock));
  } finally {
    bench.dispose();
  }
});
