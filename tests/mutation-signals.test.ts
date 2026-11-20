import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readLock } from "../src/mutation-lock.ts";
import { restoreFromLock } from "../src/mutation-tree.ts";
import { readRecords } from "../src/tsv.ts";
import { recordReceipt } from "./helpers.ts";
import { git, gitDirOf, lockFileOf, outsideCheckout, put, RUNTIME_FLAGS, SIGNAL_MS, SPAWN_TEST, status, until, withRunRepo, type RunRepo } from "./mutation-fixture.ts";

/**
 * Item 42, task 3.3: signals to a run, through `tests/mutation-run-holder.ts`,
 * a process that runs `runMutation` on a sandbox in a process group of its
 * own, so that a signal can go to it alone or to its whole group (a terminal's
 * Ctrl-C), and that stops synchronously at a named step until released.
 */

const HOLDER = join(dirname(fileURLToPath(import.meta.url)), "mutation-run-holder.ts");
const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

interface RunHolder {
  readonly pid: number;
  /** The exit code, or the signal's name when it was killed. */
  readonly exited: Promise<number | string | null>;
  journal(): string;
  release(): void;
  dispose(): void;
}

function holdRun(r: RunRepo, blockAt: string): RunHolder {
  outsideCheckout(r.root);
  const dir = mkdtempSync(join(tmpdir(), "mstack-run-holder-"));
  const journal = join(dir, "journal");
  writeFileSync(journal, "");
  const release = join(dir, "release");
  const child = spawn(process.execPath, [...RUNTIME_FLAGS, HOLDER, r.root, journal, blockAt, release, "60000"], { cwd: r.root, detached: true, stdio: "ignore" });
  const pid = child.pid as number;
  const exited = new Promise<number | string | null>((res) => child.on("close", (code, signal) => res(code ?? signal)));
  return {
    pid,
    exited,
    journal: () => readFileSync(journal, "utf8"),
    release: () => writeFileSync(release, ""),
    dispose() {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        // The group is gone.
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

const startA = (root: string): void => put(root, "src/a.ts", "old\n");
const editA = (root: string): void => put(root, "src/a.ts", "new\n");
/** `git status`, the store's own lines left out: the run appends to verification.tsv. */
const tree = (r: RunRepo): string => status(r.root).split("\n").filter((l) => !l.includes(".mstack/")).join("\n");
const rows = (r: RunRepo): Record<string, string>[] => readRecords(r.store.verification);
/** The file the check writes when it runs on the reverted tree. */
const reverted = (r: RunRepo): string => `${r.log}.reverted`;

let serial = 0;
const sleeper = (whole: number): string => `sleep ${whole}.${process.pid % 1000}${serial++}`;
/** Passes at HEAD; on the reverted tree it writes `<log>.reverted` and then runs `then`. */
const onReverted = (then: string): string => `echo run >> "$1"\ngrep -q new src/a.ts || { : > "$1.reverted"; ${then}; }\n`;

const survivors = (marker: string): number[] =>
  spawnSync("pgrep", ["-f", marker], { encoding: "utf8" }).stdout.split("\n").filter((l) => l !== "").map(Number).filter((p) => p !== process.pid);
function killAll(marker: string): void {
  for (const pid of survivors(marker)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Gone.
    }
  }
}

/** The run ended with `code`, the tree is as it was, and no lock, row or process of `marker` is left. */
async function settled(r: RunRepo, h: RunHolder, code: number, before: string, marker: string | null): Promise<void> {
  assert.equal(await h.exited, code, h.journal());
  assert.equal(tree(r), before, h.journal());
  assert.equal(existsSync(lockFileOf(r)), false, "the lock is still there");
  assert.deepEqual(rows(r).filter((x) => (x["outcome"] ?? "").startsWith("mutation-")), [], "a mutation row was written");
  if (marker !== null) assert.ok(await until(() => survivors(marker).length === 0, 3000), `a process of ${marker} is left`);
}

test("R16 SIGTERM to the mstack process alone during the obligations", SPAWN_TEST, async () => {
  const marker = sleeper(30);
  await withRunRepo(onReverted(marker), startA, editA, async (r) => {
    const before = tree(r);
    const h = holdRun(r, "none");
    try {
      assert.ok(await until(() => survivors(marker).length > 0, SIGNAL_MS), `the check never ran on the reverted tree: ${h.journal()}`);
      const sent = Date.now();
      process.kill(h.pid, "SIGTERM");
      await settled(r, h, 143, before, marker);
      assert.ok(Date.now() - sent < 10_000, "it took 10 s or more to exit");
    } finally {
      h.dispose();
      killAll(marker);
    }
  });
});

test("R16 SIGINT to the whole group during the obligations", SPAWN_TEST, async () => {
  const marker = sleeper(30);
  await withRunRepo(onReverted(marker), startA, editA, async (r) => {
    const before = tree(r);
    const h = holdRun(r, "none");
    try {
      assert.ok(await until(() => survivors(marker).length > 0, SIGNAL_MS), `the check never ran on the reverted tree: ${h.journal()}`);
      process.kill(-h.pid, "SIGINT");
      await settled(r, h, 130, before, marker);
    } finally {
      h.dispose();
      killAll(marker);
    }
  });
});

test("R16 SIGHUP during the baseline touches nothing", SPAWN_TEST, async () => {
  const marker = sleeper(30);
  await withRunRepo(`echo run >> "$1"\n${marker}\n`, startA, editA, async (r) => {
    const before = tree(r);
    const h = holdRun(r, "none");
    try {
      assert.ok(await until(() => survivors(marker).length > 0, SIGNAL_MS), `the baseline never ran: ${h.journal()}`);
      process.kill(-h.pid, "SIGHUP");
      await settled(r, h, 129, before, marker);
      assert.deepEqual(rows(r), [], "a receipt was written");
      assert.equal(existsSync(join(gitDirOf(r), "mstack-mutation")), false, "a run directory exists");
    } finally {
      h.dispose();
      killAll(marker);
    }
  });
});

test("R16 SIGKILL during the obligations leaves no obligation process after 3 s", SPAWN_TEST, async () => {
  const marker = sleeper(30);
  await withRunRepo(onReverted(marker), startA, editA, async (r) => {
    const before = tree(r);
    const h = holdRun(r, "none");
    try {
      assert.ok(await until(() => survivors(marker).length > 0, SIGNAL_MS), `the check never ran on the reverted tree: ${h.journal()}`);
      process.kill(h.pid, "SIGKILL");
      assert.equal(await h.exited, "SIGKILL");
      await sleep(3000);
      assert.deepEqual(survivors(marker), [], "the check outlived the run by 3 s");
    } finally {
      h.dispose();
      killAll(marker);
    }
    const held = readLock(r.store);
    assert.ok(held !== null && "lock" in held, "the killed run left no lock");
    assert.deepEqual(restoreFromLock(r.store, held.lock).failed, []);
    assert.equal(tree(r), before);
    assert.equal(existsSync(lockFileOf(r)), false);
    assert.deepEqual(rows(r).filter((x) => (x["outcome"] ?? "").startsWith("mutation-")), []);
  });
});

test("R17 SIGINT to the group during the restore does not interrupt it", SPAWN_TEST, async () => {
  await withRunRepo(onReverted("exit 1"), startA, editA, async (r) => {
    const before = tree(r);
    const h = holdRun(r, "restored:0");
    try {
      assert.ok(await until(() => h.journal().includes("at restored:0"), SIGNAL_MS), h.journal());
      process.kill(-h.pid, "SIGINT");
      await sleep(200);
      h.release();
      await settled(r, h, 130, before, null);
      assert.match(h.journal(), /at lock-removed/);
    } finally {
      h.dispose();
    }
  });
});

test("R17 SIGINT twice during the restore", SPAWN_TEST, async () => {
  await withRunRepo(onReverted("exit 1"), startA, editA, async (r) => {
    const before = tree(r);
    const h = holdRun(r, "restored:0");
    try {
      assert.ok(await until(() => h.journal().includes("at restored:0"), SIGNAL_MS), h.journal());
      process.kill(-h.pid, "SIGINT");
      await sleep(200);
      process.kill(-h.pid, "SIGINT");
      await sleep(200);
      h.release();
      await settled(r, h, 130, before, null);
      assert.match(h.journal(), /at lock-removed/);
    } finally {
      h.dispose();
    }
  });
});

test("R17 SIGINT to the group right after the lock: nothing reverted, no obligation started", SPAWN_TEST, async () => {
  await withRunRepo(onReverted("exit 1"), startA, editA, async (r) => {
    const before = tree(r);
    const h = holdRun(r, "lock-written");
    try {
      assert.ok(await until(() => h.journal().includes("at lock-written"), SIGNAL_MS), h.journal());
      process.kill(-h.pid, "SIGINT");
      await sleep(200);
      h.release();
      await settled(r, h, 130, before, null);
      assert.doesNotMatch(h.journal(), /at (revert-written|reverted|obligations-running)/);
      assert.equal(existsSync(reverted(r)), false, "the check ran on a reverted tree");
    } finally {
      h.dispose();
    }
  });
});

test("R17 SIGINT to the group at reverted:0: no obligation starts", SPAWN_TEST, async () => {
  await withRunRepo(onReverted("exit 1"), startA, editA, async (r) => {
    const before = tree(r);
    const h = holdRun(r, "reverted:0");
    try {
      assert.ok(await until(() => h.journal().includes("at reverted:0"), SIGNAL_MS), h.journal());
      process.kill(-h.pid, "SIGINT");
      await sleep(200);
      h.release();
      await settled(r, h, 130, before, null);
      assert.doesNotMatch(h.journal(), /at obligations-running/);
      assert.equal(existsSync(reverted(r)), false, "the check ran on a reverted tree");
    } finally {
      h.dispose();
    }
  });
});

test("R17 SIGINT to the group during prepare exits 130, not a refusal", SPAWN_TEST, async () => {
  const marker = sleeper(2);
  const slow = (root: string): void => {
    startA(root);
    put(root, ".gitattributes", "src/a.ts filter=slow\n");
  };
  await withRunRepo(onReverted("exit 1"), slow, editA, async (r) => {
    git(r.root, "config", "filter.slow.smudge", `${marker}; cat`);
    git(r.root, "config", "filter.slow.clean", "cat");
    recordReceipt(r.box, { target: "(project)", sha: git(r.root, "rev-parse", "HEAD"), command: r.command, outcome: "passed" });
    const before = tree(r);
    const h = holdRun(r, "none");
    try {
      assert.ok(await until(() => survivors(marker).length > 0, SIGNAL_MS), `the start blob was never staged through the filter: ${h.journal()}`);
      process.kill(-h.pid, "SIGINT");
      await settled(r, h, 130, before, marker);
      assert.doesNotMatch(h.journal(), /refused/);
      const runs = join(gitDirOf(r), "mstack-mutation");
      assert.deepEqual(existsSync(runs) ? readdirSync(runs) : [], [], "a run directory is left");
    } finally {
      h.dispose();
      killAll(marker);
    }
  });
});

// bun ignores the `skip` option of node:test, so the function is chosen; a read-only directory stops nobody running as root.
const userTest = process.getuid?.() === 0 ? test.skip : test;

userTest("R15 a signal and a restore that fails: exit 3, and the lock stays", SPAWN_TEST, async () => {
  const marker = sleeper(30);
  await withRunRepo(onReverted(marker), startA, editA, async (r) => {
    const before = tree(r);
    const h = holdRun(r, "none");
    try {
      // The signal while the command runs, so that the run has it before the restore, which then fails.
      assert.ok(await until(() => survivors(marker).length > 0, SIGNAL_MS), `the check never ran on the reverted tree: ${h.journal()}`);
      chmodSync(join(r.root, "src"), 0o555);
      process.kill(-h.pid, "SIGINT");
      assert.equal(await h.exited, 3, h.journal());
      assert.match(h.journal(), /not restored: src\/a\.ts/);
      assert.equal(existsSync(lockFileOf(r)), true, "the lock went although the restore failed");
      assert.ok(await until(() => survivors(marker).length === 0, 3000), `a process of ${marker} is left`);
    } finally {
      chmodSync(join(r.root, "src"), 0o755);
      h.dispose();
      killAll(marker);
    }
    const held = readLock(r.store);
    assert.ok(held !== null && "lock" in held);
    assert.deepEqual(restoreFromLock(r.store, held.lock).failed, []);
    assert.equal(tree(r), before);
    assert.deepEqual(rows(r).filter((x) => (x["outcome"] ?? "").startsWith("mutation-")), []);
  });
});

test("R16 a signal that comes while git answers a check is acted on before the refusal the failed git leads to: exit 130, not 2", SPAWN_TEST, async () => {
  // Item 42, round 2 review, non-blocking 3: mutant k (the refusal printed before the signal check) survived. The git
  // on PATH, asked R1's question of an operation in progress, sends SIGINT to the run and fails, as a git child does
  // when a Ctrl-C to the group kills it; the run is in a synchronous call then, so its handler runs only after.
  await withRunRepo(onReverted("exit 1"), startA, editA, async (r) => {
    const before = tree(r);
    const real = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
    const bin = join(r.scratch, "bin");
    mkdirSync(bin);
    const flag = join(r.scratch, "signalled");
    writeFileSync(join(bin, "git"), `#!/bin/sh\nif [ "$1 $2" = "rev-parse --git-path" ] && [ ! -e '${flag}' ]; then : > '${flag}'; kill -INT "$PPID"; exit 1; fi\nexec '${real}' "$@"\n`);
    chmodSync(join(bin, "git"), 0o755);
    outsideCheckout(r.root);
    const dir = mkdtempSync(join(tmpdir(), "mstack-run-holder-"));
    const journal = join(dir, "journal");
    writeFileSync(journal, "");
    const env = { ...process.env, PATH: `${bin}:${process.env["PATH"] ?? ""}` };
    const child = spawn(process.execPath, [...RUNTIME_FLAGS, HOLDER, r.root, journal, "none", join(dir, "release"), "60000"], { cwd: r.root, detached: true, stdio: "ignore", env });
    const exited = new Promise<number | string | null>((res) => child.on("close", (code, signal) => res(code ?? signal)));
    try {
      const code = await exited;
      const text = readFileSync(journal, "utf8");
      assert.ok(existsSync(flag), `the run never asked git for the files of an operation in progress:\n${text}`);
      assert.equal(code, 130, text);
      assert.match(text, /^out mutation: stopped by SIGINT, so nothing was recorded$/m);
      assert.doesNotMatch(text, /refused/);
      assert.equal(tree(r), before);
      assert.equal(existsSync(lockFileOf(r)), false, "a lock was left");
      assert.deepEqual(rows(r), [], "a receipt or a row was written");
    } finally {
      try {
        process.kill(-(child.pid as number), "SIGKILL");
      } catch {
        // The group is gone.
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
