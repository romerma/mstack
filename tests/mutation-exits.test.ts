import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runGate } from "../src/gate.ts";
import { preToolUse } from "../src/hooks.ts";
import { refusals, revertSet } from "../src/mutation.ts";
import { acquireLock, prepareRun } from "../src/mutation-lock.ts";
import { restoreRun } from "../src/mutation-run.ts";
import { storeAt, type Store } from "../src/paths.ts";
import { setup } from "../src/setup.ts";
import { parseState, type Item, type State } from "../src/state.ts";
import { captured, item, state } from "./helpers.ts";
import {
  caseInsensitive, commitAll, git, locked, lockFileOf, mutate, outsideCheckout, put, SIGNAL_MS, SPAWN_TEST, status, until, withRepo, withRunRepo,
} from "./mutation-fixture.ts";

/**
 * Item 101: every way out the mutation lock prints runs as printed, and the
 * hook reads the rest of git's spaced options and its plumbing. The findings
 * are the item 42 reviews' (round 3 non-blocking 1, 2, 3, 6, 7; round 2
 * non-blocking 5). Every repository and every copy of the CLI is under the
 * system's temporary directory, never this checkout.
 */

const CHECKOUT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(CHECKOUT, "bin", "mstack");
/** A space, a single quote and a double quote: each one ends an unquoted shell word or opens a quote. */
const ODD = `dir's "q" x`;

interface Ran {
  readonly code: number | null;
  readonly out: string;
  readonly all: string;
}

function run(bin: string, cwd: string, args: readonly string[]): Ran {
  outsideCheckout(cwd);
  const p = spawnSync(bin, [...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" }, timeout: 120_000 });
  return { code: p.status, out: p.stdout, all: `${p.stdout}${p.stderr}` };
}

/** A printed line, run as printed: `/bin/sh -c <line>`. */
function sh(line: string, cwd: string): Ran {
  outsideCheckout(cwd);
  const p = spawnSync("/bin/sh", ["-c", line], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" }, timeout: 120_000 });
  return { code: p.status, out: p.stdout, all: `${p.stdout}${p.stderr}` };
}

function captureOf(text: string, pattern: RegExp, what: string): string {
  const m = pattern.exec(text);
  assert.ok(m !== null && m[1] !== undefined, `${what}: no line matched ${pattern}:\n${text}`);
  return m[1];
}

function hookReason(command: string, cwd: string): string | null {
  const out = preToolUse({ tool_name: "Bash", tool_input: { command }, cwd });
  if (out === null) return null;
  const parsed = JSON.parse(out) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } };
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  return parsed.hookSpecificOutput.permissionDecisionReason;
}

let serial = 0;
const sleeper = (): string => `sleep 61.${process.pid}${serial++}`;
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

const deadPid = (): number => {
  const pid = spawnSync(process.execPath, ["-e", "0"]).pid;
  assert.ok(typeof pid === "number" && pid > 0);
  return pid;
};

/** A repository at `top` with git's identity set, and a store at each of `stores` (relative to `top`). */
function repoWithStores(top: string, stores: readonly string[]): void {
  mkdirSync(top, { recursive: true });
  for (const args of [["init", "-q"], ["config", "user.email", "test@example.com"], ["config", "user.name", "test"]]) git(top, ...args);
  for (const rel of stores) {
    mkdirSync(join(top, rel), { recursive: true });
    captured(() => setup(join(top, rel)));
  }
}

const writeState = (root: string, value: unknown): void => writeFileSync(join(root, ".mstack", "state.json"), `${JSON.stringify(value, null, 2)}\n`);

interface Odd {
  readonly base: string;
  readonly cli: string;
  readonly a: string;
  readonly b: string;
  readonly lockFile: string;
  readonly marker: string;
}

/**
 * A copy of the CLI under `cli dir's "q" x/`, and a repository under `top dir's
 * "q" x/` with stores at `pkg/a` and `pkg/b`: A's item turns `src/x.js` from OLD
 * into NEW, and A's verification sleeps when it reads OLD, which is the reverted
 * tree. Every path a recovery line carries, the CLI's and the `cd`'s, holds the
 * three characters.
 */
function oddWorld(): Odd {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "mstack-exits-")));
  const cliRoot = join(base, `cli ${ODD}`);
  mkdirSync(cliRoot);
  for (const part of ["bin", "src", "package.json"]) cpSync(join(CHECKOUT, part), join(cliRoot, part), { recursive: true });
  const top = join(base, `top ${ODD}`);
  repoWithStores(top, ["pkg/a", "pkg/b"]);
  const a = join(top, "pkg", "a");
  const b = join(top, "pkg", "b");
  const marker = sleeper();
  put(a, "src/x.js", "OLD\n");
  // In a script, so that only the sleep's own command line names the marker.
  put(a, "tests/check.sh", `grep -q NEW src/x.js || { ${marker}; }\n`);
  put(b, "src/y.js", "B's own\n");
  const start = commitAll(top, "start");
  writeState(a, state([item({ slug: "a", status: "in_progress", base: start })], { verify: "sh tests/check.sh" }));
  writeState(b, state([item({ slug: "b", status: "in_progress", base: start })], { verify: "true" }));
  put(a, "src/x.js", "NEW\n");
  commitAll(top, "item a");
  return { base, cli: join(cliRoot, "bin", "mstack"), a, b, lockFile: join(top, ".git", "mstack-mutation.lock"), marker };
}

/** `verify --mutation` by the copy in A, SIGKILLed while its verification sleeps on the reverted tree; its output. */
async function killedRun(o: Odd): Promise<string> {
  outsideCheckout(o.a);
  const child = spawn(o.cli, ["verify", "--mutation"], { cwd: o.a, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NO_COLOR: "1" } });
  let text = "";
  child.stdout.on("data", (d: Buffer) => (text += d.toString("utf8")));
  child.stderr.on("data", (d: Buffer) => (text += d.toString("utf8")));
  const exited = new Promise<number | string | null>((res) => child.on("close", (code, signal) => res(code ?? signal)));
  try {
    assert.ok(await until(() => survivors(o.marker).length > 0, SIGNAL_MS), `the verification never ran on the reverted tree: ${text}`);
    process.kill(child.pid as number, "SIGKILL");
    assert.equal(await exited, "SIGKILL");
    assert.ok(await until(() => survivors(o.marker).length === 0, 5000), "the verification outlived the killed run");
  } finally {
    try {
      process.kill(child.pid as number, "SIGKILL");
    } catch {
      // Gone.
    }
    killAll(o.marker);
  }
  assert.ok(existsSync(o.lockFile), `the killed run left no lock: ${text}`);
  assert.equal(readFileSync(join(o.a, "src", "x.js"), "utf8"), "OLD\n", "the killed run left the tree as it was");
  return text;
}

/** The printed line, run as printed from `cwd`, puts A's tree back and removes the lock. */
function repairs(o: Odd, line: string, cwd: string): void {
  const ran = sh(line, cwd);
  assert.equal(ran.code, 0, `${line}\n${ran.all}`);
  assert.match(ran.out, /restored 1, tree verified, lock removed/, ran.all);
  assert.equal(existsSync(o.lockFile), false, "the lock stays");
  assert.equal(readFileSync(join(o.a, "src", "x.js"), "utf8"), "NEW\n");
}

test("A1 every printed restore line runs as printed when the CLI's path and the store's hold a space, a ' and a \"", SPAWN_TEST, async () => {
  const o = oddWorld();
  try {
    // First run: what each place prints, from A and from B, then B's line run from B.
    const ranA = await killedRun(o);
    const fromRun = captureOf(ranA, /^mutation: if this process dies: (.+)$/m, "the run");
    const gateA = captureOf(run(o.cli, o.a, ["gate", "--quiet"]).all, /mstack-mutation\.lock[^\n]* -> run (.+)$/m, "A's gate");
    const r1A = captureOf(run(o.cli, o.a, ["verify", "--mutation"]).all, /^mutation: (.+) puts the tree back and removes the lock$/m, "A's R1 refusal");
    assert.ok(fromRun.includes("verify --restore"), fromRun);
    assert.deepEqual([gateA, r1A], [fromRun, fromRun], "A's gate and R1 refusal print another line than the run");

    const restoreB = run(o.cli, o.b, ["verify", "--restore"]);
    assert.equal(restoreB.code, 2, restoreB.all);
    const fromB = captureOf(restoreB.out, /^mutation: run it from that store: (.+)$/m, "B's restore");
    const gateB = captureOf(run(o.cli, o.b, ["gate", "--quiet"]).all, /mstack-mutation\.lock[^\n]* -> run (.+)$/m, "B's gate");
    const r1B = captureOf(run(o.cli, o.b, ["verify", "--mutation"]).all, /^mutation: (.+) puts the tree back and removes the lock$/m, "B's R1 refusal");
    const hookB = captureOf(hookReason("git commit -m x", o.b) ?? "allowed", /if it is not running, run (.+)$/, "the hook in B");
    assert.ok(fromB.startsWith("cd ") && fromB.endsWith(` && ${fromRun}`), fromB);
    assert.deepEqual([gateB, r1B, hookB], [fromB, fromB, fromB], "B's gate, R1 refusal or hook print another line than B's restore");
    repairs(o, fromB, o.b);

    // Second run: the run's own line, run from A.
    const again = captureOf(await killedRun(o), /^mutation: if this process dies: (.+)$/m, "the second run");
    assert.equal(again, fromRun);
    repairs(o, again, o.a);
  } finally {
    killAll(o.marker);
    rmSync(o.base, { recursive: true, force: true });
  }
});

const startA = (root: string): void => put(root, "src/a.ts", "old\n");
const editA = (root: string): void => put(root, "src/a.ts", "new\n");

/** An active item with a base and an obligation, as `verify --mutation` reads it. */
function active(start: string): { st: State; it: Item } {
  const it = item({ status: "in_progress", base: start }) as unknown as Item;
  return { st: state([it], { verify: "true" }) as State, it };
}

function gateLine(store: Store): string {
  const { value } = captured(() => runGate(store, { quiet: true }));
  const found = value.failures.find((f) => f.includes("mstack-mutation.lock"));
  assert.ok(found !== undefined, `no gate line names the lock: ${JSON.stringify(value.failures)}`);
  return found;
}

const BY_HAND = /for a person at a terminal[^\n]*git stash push --include-untracked/;

test("A2 the hook and R1 name the restore only for a lock validateLock accepts, and otherwise say what the gate says", () => {
  withRepo(startA, editA, (r) => {
    locked(r);
    const file = lockFileOf(r);
    const written = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const json = (lock: Record<string, unknown>): string => `${JSON.stringify({ ...lock, pid: deadPid() }, null, 2)}\n`;
    const { st, it } = active(r.start);
    const cases: [string, string][] = [
      ["the parent", json({ ...written, rootFromTop: ".." })],
      ["an absolute path", json({ ...written, rootFromTop: "/abs" })],
      ["a trailing slash", json({ ...written, rootFromTop: "pkg/a/" })],
      ["no rootFromTop", json(Object.fromEntries(Object.entries(written).filter(([k]) => k !== "rootFromTop")))],
      ["not JSON", "garbage\n"],
    ];
    for (const [label, text] of cases) {
      writeFileSync(file, text);
      const tree = status(r.root);
      const gate = gateLine(r.store);
      assert.match(gate, /cannot be read as a run's record/, label);

      const r1 = refusals(r.store, st, it);
      assert.ok(r1 !== null, `${label}: R1 did not refuse`);
      assert.equal(`${r1.message} -> ${r1.fix}`, gate, `${label}: R1 does not say what the gate says`);
      assert.doesNotMatch(r1.fix, /verify --restore|\bcd /, label);

      const hook = hookReason("git commit -m x", r.root);
      assert.ok(hook !== null, `${label}: the hook allowed git commit under a lock`);
      assert.doesNotMatch(hook, /\bcd |verify --restore/, `${label}: ${hook}`);
      assert.match(hook, BY_HAND, label);
      assert.match(hook, /'mstack gate' says the same/, label);

      assert.equal(readFileSync(file, "utf8"), text, `${label}: the lock changed`);
      assert.equal(status(r.root), tree, `${label}: the tree changed`);
    }

    // The control: the lock as the run wrote it, its run not alive.
    writeFileSync(file, json(written));
    const r1 = refusals(r.store, st, it);
    assert.match(r1?.fix ?? "", /verify --restore puts the tree back and removes the lock/);
    assert.match(hookReason("git commit -m x", r.root) ?? "", /if it is not running, run cd [^\n]*verify --restore/);
  });
});
