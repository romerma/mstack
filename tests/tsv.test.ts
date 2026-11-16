import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
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
const RACER = join(dirname(fileURLToPath(import.meta.url)), "lock-racer.ts");
const RUNTIME_FLAGS = typeof (globalThis as { Bun?: unknown }).Bun === "undefined"
  ? ["--experimental-strip-types", "--disable-warning=ExperimentalWarning"]
  : [];

interface Holder {
  readonly child: ChildProcess;
  readonly exited: Promise<number | null>;
  release(): void;
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
    hold(name: string, timeoutMs: number): Holder {
      const release = join(dir, `release-${name}`);
      const child = spawn(process.execPath, [...RUNTIME_FLAGS, HOLDER, file, journal, name, String(timeoutMs), release], {
        stdio: "ignore",
      });
      children.push(child);
      return {
        child,
        exited: new Promise((res) => child.on("close", (code) => res(code))),
        release: () => writeFileSync(release, ""),
      };
    },
    race(name: string, rounds: number, start: number, roundMs: number, holdMs: number): Holder {
      const child = spawn(
        process.execPath,
        [...RUNTIME_FLAGS, RACER, file, journal, name, String(rounds), String(start), String(roundMs), String(holdMs)],
        { stdio: "ignore" },
      );
      children.push(child);
      return {
        child,
        exited: new Promise((res) => child.on("close", (code) => res(code))),
        release: () => {},
      };
    },
    dispose() {
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

test("a waiter that times out on a live holder does not enter beside it", async () => {
  const bench = lockBench();
  try {
    const a = bench.hold("A", 5_000);
    assert.ok(await until(() => bench.journal().includes("A enter"), 5_000), "A never took the lock");

    // B's patience is shorter than A's hold. Whatever B does about that, keep
    // waiting or give up and say so, it may not run beside A.
    const b = bench.hold("B", 200);
    b.release();
    let bExited = false;
    void b.exited.then(() => {
      bExited = true;
    });
    await until(() => bExited || bench.journal().includes("B enter"), 1_500);

    assert.equal(bench.journal(), "A enter\n", "B ran its critical section while A was still inside its own");
    assert.ok(existsSync(bench.lock), "A is still inside and its lock file is gone: B removed a lock it did not create");

    a.release();
    assert.equal(await a.exited, 0);
    assert.ok(await until(() => bExited, 5_000), "B never finished after A let go");
    assert.ok(!existsSync(bench.lock), "the lock must not survive the writers");
  } finally {
    bench.dispose();
  }
});

test("a lock left by a killed process is broken, and the next caller holds a real one", async () => {
  const bench = lockBench();
  try {
    const a = bench.hold("A", 5_000);
    assert.ok(await until(() => bench.journal().includes("A enter"), 5_000), "A never took the lock");
    a.child.kill("SIGKILL");
    await a.exited;
    assert.ok(existsSync(bench.lock), "fixture: a killed holder should leave its lock behind");

    const b = bench.hold("B", 200);
    assert.ok(await until(() => bench.journal().includes("B enter"), 5_000), "B hung on a dead process's lock");

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

test("a waiter on a live holder throws a UserError naming the lock and the holder, and leaves the lock alone", async () => {
  const bench = lockBench();
  try {
    const a = bench.hold("A", 5_000);
    assert.ok(await until(() => bench.journal().includes("A enter"), 5_000), "A never took the lock");
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

test("a live holder's lock is never aged out, however old it is", async () => {
  // The unreadable-owner rule breaks a lock by age. A readable owner that is alive
  // must not be subject to it: the default wait is 2 s and so is that limit, so a
  // waiter that outlasts it would otherwise walk in beside a holder still inside.
  const bench = lockBench();
  try {
    const a = bench.hold("A", 5_000);
    assert.ok(await until(() => bench.journal().includes("A enter"), 5_000), "A never took the lock");
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

test("a guard left by a dead process does not keep a dead lock from being broken", async () => {
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

test("a dead lock is not broken while a live process holds the break guard", async () => {
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

test("a lock is never visible with a partial or foreign owner in it", async () => {
  // The owner is written just after the exclusive create, so a reader may meet the
  // lock empty for an instant, which the unreadable-owner rule waits on. What it
  // must never meet is half an owner. Hammer the name from one process and read it
  // from this one.
  const bench = lockBench();
  const writer = spawn(
    process.execPath,
    [
      ...RUNTIME_FLAGS,
      "-e",
      `import(${JSON.stringify(join(dirname(HOLDER), "..", "src", "tsv.ts"))}).then(({withLock})=>{for(let i=0;i<3000;i++)withLock(${JSON.stringify(bench.file)},()=>{})})`,
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

test("waiters that all see the same dead owner never hold the lock together", { timeout: 30_000 }, async () => {
  // The hazard is two breakers: each judges the same dead lock dead, one removes
  // it and takes its own, and the other then removes that live one and walks in.
  // The window is microseconds wide, so the waiters start from a shared instant,
  // every round plants a fresh dead lock, and each one checks from inside that the
  // lock on disk is still its own.
  const waiters = 32;
  const rounds = 120;
  const roundMs = 50;
  const bench = lockBench();
  try {
    const dead = await bench.deadPid();
    const start = Date.now() + 1_000;
    const racers = Array.from({ length: waiters }, (_, i) => bench.race(`W${i}`, rounds, start, roundMs, 1));
    for (let round = 0; round < rounds; round++) {
      const plant = start + round * roundMs - roundMs / 2;
      await new Promise((res) => setTimeout(res, Math.max(0, plant - Date.now())));
      // Exclusive: if the previous round is still running, leave its lock alone.
      try {
        writeFileSync(bench.lock, `${dead} ${TOKEN}\n`, { flag: "wx" });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    for (const racer of racers) await racer.exited;

    let inside: string | null = null;
    let entries = 0;
    const foreign: string[] = [];
    for (const line of bench.journal().split("\n").filter((l) => l !== "")) {
      const [round, name, what, own] = line.split(" ") as [string, string, string, string];
      assert.notEqual(what, "THREW", `a waiter threw: ${line}`);
      if (own !== "true") foreign.push(`${name} in round ${round}`);
      if (what === "enter") {
        assert.equal(inside, null, `${name} entered in round ${round} while ${inside} was inside`);
        inside = name;
        entries += 1;
      } else {
        assert.equal(inside, name, `${name} left in round ${round} while ${inside} was the one inside`);
        inside = null;
      }
    }
    assert.equal(entries, waiters * rounds, "some waiters never entered");
    assert.deepEqual(foreign, [], "a waiter was inside while the lock on disk was not its own");
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
  const timer = setTimeout(() => { hung = true; child.kill("SIGKILL"); }, timeoutMs + 3_000);
  await new Promise((res) => child.on("close", res));
  clearTimeout(timer);
  return { out: out.trim(), ms: Date.now() - started, hung };
}

test("a lock that cannot be created because the directory is missing fails promptly, naming the lock", async () => {
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

test("a lock that cannot be created because the directory is read-only fails promptly, naming the lock", { skip: process.getuid?.() === 0 }, async () => {
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
