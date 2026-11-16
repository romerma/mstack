import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
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

test("a lock is never visible without its owner in it", async () => {
  // Hazard: create-then-write leaves a window where the lock exists and is
  // empty, which a reader cannot tell from a previous-format lock. Hammer the
  // name from one process and read it from this one.
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
        assert.match(text, /^\d+ [0-9a-f-]{36}\n$/, "a reader saw a lock with no complete owner in it");
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

test("waiters that all see the same dead owner do not end up inside together", async () => {
  const bench = lockBench();
  try {
    writeFileSync(bench.lock, `${await bench.deadPid()} ${TOKEN}\n`);
    const holders = Array.from({ length: 8 }, (_, i) => bench.hold(`W${i}`, 5_000));
    for (const h of holders) h.release();
    for (const h of holders) assert.equal(await h.exited, 0);
    const lines = bench.journal().split("\n").filter((l) => l !== "");
    assert.equal(lines.length, 16);
    lines.forEach((line, i) => {
      const [name, what] = line.split(" ") as [string, string];
      assert.equal(what, i % 2 === 0 ? "enter" : "leave", `entries overlapped: ${lines.join(", ")}`);
      if (i % 2 === 1) assert.equal(name, (lines[i - 1] as string).split(" ")[0]);
    });
    assert.ok(!existsSync(bench.lock) && !existsSync(`${bench.lock}.break`));
  } finally {
    bench.dispose();
  }
});

test("a release does not remove a lock that another owner now holds", () => {
  const bench = lockBench();
  try {
    writeFileSync(bench.journal === undefined ? "" : bench.file, "");
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
