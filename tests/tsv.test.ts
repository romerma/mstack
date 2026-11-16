import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cell, row } from "../src/tsv.ts";

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
