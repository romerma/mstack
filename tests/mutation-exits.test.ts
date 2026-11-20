import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { runGate } from "../src/gate.ts";
import { preToolUse } from "../src/hooks.ts";
import { refusals, revertSet } from "../src/mutation.ts";
import { acquireLock, prepareRun, restoreCommand, rootDisagrees, shellWord } from "../src/mutation-lock.ts";
import { restoreRun } from "../src/mutation-run.ts";
import { applyRevert } from "../src/mutation-tree.ts";
import { runningCliRoot, storeAt, type Store } from "../src/paths.ts";
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

function run(bin: string, cwd: string, args: readonly string[], input?: string): Ran {
  outsideCheckout(cwd);
  const p = spawnSync(bin, [...args], { cwd, encoding: "utf8", input, env: { ...process.env, NO_COLOR: "1" }, timeout: 120_000 });
  return { code: p.status, out: p.stdout, all: `${p.stdout}${p.stderr}` };
}

/** The hook's reason for `git commit -m x` in `cwd`, from `cli`'s own process, so the running CLI it names is that copy. */
function hookOf(cli: string, cwd: string): string {
  const input = JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git commit -m x" }, cwd });
  const ran = run(cli, cwd, ["hook", "pre-tool-use"], input);
  assert.equal(ran.code, 0, ran.all);
  assert.notEqual(ran.out.trim(), "", `the hook allowed git commit under a lock: ${ran.all}`);
  return (JSON.parse(ran.out) as { hookSpecificOutput: { permissionDecisionReason: string } }).hookSpecificOutput.permissionDecisionReason;
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

    // Third run, its CLI gone since: the gate names the gone CLI in prose and offers the running one, and that line runs.
    const goneCli = join(o.base, `gone ${ODD}`, "bin", "mstack");
    const lead = `the CLI that wrote the lock, ${shellWord(goneCli)}, is gone; `;
    const killedGone = async (): Promise<void> => {
      await killedRun(o);
      const lock = JSON.parse(readFileSync(o.lockFile, "utf8")) as Record<string, unknown>;
      writeFileSync(o.lockFile, `${JSON.stringify({ ...lock, cli: goneCli }, null, 2)}\n`);
    };
    await killedGone();
    const gone = captureOf(run(o.cli, o.a, ["gate", "--quiet"]).all, /mstack-mutation\.lock[^\n]* -> (.+)$/m, "A's gate, the CLI gone");
    assert.equal(gone, `${lead}run ${fromRun}`);
    repairs(o, gone.slice(`${lead}run `.length), o.a);

    // Runs four to seven, the CLI gone, read from B: each of the four printers offers one command, the running
    // CLI's behind the cd to A, never the gone one, and that command, run as printed from B, puts A's tree back.
    const goneFromB: [string, () => string, RegExp][] = [
      ["B's gate", () => run(o.cli, o.b, ["gate", "--quiet"]).all, /mstack-mutation\.lock[^\n]* -> (.+)$/m],
      ["B's R1 refusal", () => run(o.cli, o.b, ["verify", "--mutation"]).all, /^mutation: (.+ puts the tree back and removes the lock)$/m],
      ["the hook in B", () => hookOf(o.cli, o.b), /It is held by pid \d+: (.+)$/],
      ["B's restore", () => run(o.cli, o.b, ["verify", "--restore"]).out, /^mutation: ((?:.+; )?run it from that store: .+)$/m],
    ];
    const said = [
      `${lead}run ${fromB}`,
      `${lead}${fromB} puts the tree back and removes the lock`,
      `${lead}wait for it, or if it is not running, run ${fromB}`,
      `${lead}run it from that store: ${fromB}`,
    ];
    for (const [i, [what, print, pattern]] of goneFromB.entries()) {
      await killedGone();
      const printed = captureOf(print(), pattern, `${what}, the CLI gone`);
      assert.equal(printed, said[i], `${what}: the CLI gone`);
      assert.ok(!printed.includes(`${shellWord(goneCli)} verify --restore`), `${what} offers the gone CLI as a command: ${printed}`);
      // The one command the line offers, as printed: from its cd to the end of the line or to the prose after it.
      repairs(o, captureOf(printed, /(cd .+? verify --restore)(?: puts the tree back|$)/, what), o.b);
    }
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

/**
 * A store at `pkg/café`, its name in NFC as git gives it, and the run staged and
 * the lock taken, then edited to name its store `rootFromTop`.
 */
function cafeLock(rootFromTop: (written: string) => string, body: (s: { store: Store; root: string; file: string; start: string }) => void): void {
  const top = realpathSync(mkdtempSync(join(tmpdir(), "mstack-exits-case-")));
  try {
    const rel = "pkg/café";
    repoWithStores(top, [rel]);
    const root = join(top, rel);
    const store = storeAt(root);
    startA(root);
    const start = commitAll(top, "start");
    editA(root);
    writeState(root, state([item({ status: "in_progress", base: start })], { verify: "true" }));
    commitAll(top, "the item");
    const set = revertSet(store, start);
    assert.ok(set !== null);
    const prepared = prepareRun(store, start, set);
    assert.ok(prepared.ok, prepared.ok ? "" : prepared.reason);
    assert.equal(prepared.lock.rootFromTop, rel);
    assert.ok(acquireLock(store, prepared.lock).ok);
    const file = join(top, ".git", "mstack-mutation.lock");
    writeFileSync(file, `${JSON.stringify({ ...prepared.lock, pid: deadPid(), rootFromTop: rootFromTop(rel) }, null, 2)}\n`);
    body({ store, root, file, start });
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
}

test("A3 a rootFromTop that differs from this store's only in case or Unicode form prints no cd that loops but the by-hand way out, and writes nothing", () => {
  // On a disk that folds them both spellings name this store, and on one that does not, no directory.
  const spellings: [string, (rel: string) => string][] = [
    ["in upper case", (rel) => rel.toUpperCase()],
    ["in NFD", (rel) => rel.normalize("NFD")],
  ];
  for (const [label, spell] of spellings) {
    cafeLock(spell, ({ store, root, file, start }) => {
      const text = readFileSync(file, "utf8");
      const tree = status(root);
      const lines: string[] = [];
      assert.equal(restoreRun(store, { out: (l) => lines.push(l) }), 2, `${label}: ${lines.join("\n")}`);
      const restore = lines.join("\n");
      assert.match(restore, /refused: the lock is the run's of the store at/, label);
      assert.match(restore, /no verify --restore takes this lock/, label);
      assert.doesNotMatch(restore, /\bcd |mstack'? verify --restore/, `${label}:\n${restore}`);
      assert.match(restore, BY_HAND, label);

      const gate = gateLine(store);
      assert.doesNotMatch(gate, /\bcd |mstack'? verify --restore/, `${label}: ${gate}`);
      assert.match(gate, BY_HAND, label);

      const { st, it } = active(start);
      const r1 = refusals(store, st, it);
      assert.ok(r1 !== null);
      assert.doesNotMatch(r1.fix, /\bcd |mstack'? verify --restore/, `${label}: ${r1.fix}`);
      assert.match(r1.fix, BY_HAND, label);

      const hook = hookReason("git commit -m x", root);
      assert.ok(hook !== null, `${label}: the hook allowed git commit under a lock`);
      assert.doesNotMatch(hook, /\bcd |mstack'? verify --restore/, `${label}: ${hook}`);
      assert.match(hook, BY_HAND, label);

      assert.equal(readFileSync(file, "utf8"), text, `${label}: the lock changed`);
      assert.equal(status(root), tree, `${label}: the tree changed`);
    });
  }
});

// bun ignores the `skip` option of node:test, so choose the function at definition time
const caseSensitiveTest = caseInsensitive ? test.skip : test;

caseSensitiveTest("A3 where the disk tells case apart, PKG/A and pkg/a are two stores and the cd to the lock's store runs as printed", SPAWN_TEST, () => {
  const top = realpathSync(mkdtempSync(join(tmpdir(), "mstack-exits-cs-")));
  try {
    repoWithStores(top, ["PKG/A", "pkg/a"]);
    const upper = join(top, "PKG", "A");
    const lower = join(top, "pkg", "a");
    startA(upper);
    startA(lower);
    const start = commitAll(top, "start");
    editA(upper);
    writeState(upper, state([item({ status: "in_progress", base: start })], { verify: "true" }));
    commitAll(top, "the item");
    const store = storeAt(upper);
    const set = revertSet(store, start);
    assert.ok(set !== null);
    const prepared = prepareRun(store, start, set);
    assert.ok(prepared.ok, prepared.ok ? "" : prepared.reason);
    assert.equal(prepared.lock.rootFromTop, "PKG/A");
    assert.ok(acquireLock(store, prepared.lock).ok);
    const file = join(top, ".git", "mstack-mutation.lock");
    writeFileSync(file, `${JSON.stringify({ ...prepared.lock, pid: deadPid() }, null, 2)}\n`);

    const lines: string[] = [];
    assert.equal(restoreRun(storeAt(lower), { out: (l) => lines.push(l) }), 2, lines.join("\n"));
    const line = captureOf(lines.join("\n"), /^mutation: run it from that store: (.+)$/m, "pkg/a's restore");
    assert.ok(line.startsWith(`cd ${upper} && `), line);
    const ran = sh(line, lower);
    assert.equal(ran.code, 0, ran.all);
    assert.match(ran.out, /tree verified, lock removed/);
    assert.equal(existsSync(file), false);
    assert.equal(readFileSync(join(upper, "src", "a.ts"), "utf8"), "new\n");
    assert.equal(readFileSync(join(lower, "src", "a.ts"), "utf8"), "old\n");
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("A4 under a lock the hook denies git's options given with a space and the plumbing that writes the index, a tree, a commit or a ref", () => {
  withRepo(startA, editA, (r) => {
    const denied = [
      "git --namespace foo commit -m x",
      "git --namespace foo add -A",
      "git --config-env core.editor=EDITOR commit -m x",
      "git --attr-source HEAD add -A",
      "git --attr-source=HEAD add -A",
      "git update-index --add src/a.ts",
      "git -C . update-index --refresh",
      "GIT_INDEX_FILE=/tmp/i git update-index --add src/a.ts",
      "git read-tree HEAD",
      "git read-tree -u --reset HEAD",
      "git checkout-index -f -a",
      "git write-tree",
      "git mktree < tree.txt",
      "git commit-tree HEAD^{tree} -p HEAD -m x",
      "git update-ref refs/heads/main HEAD~1",
    ];
    // Reads, and the writes the docs name as not covered: none can save the reverted tree.
    const allowed = [
      "git --namespace foo log -1",
      "git --attr-source HEAD status",
      "git cat-file -p HEAD",
      "git ls-files -s",
      "git ls-tree HEAD",
      "git diff-index HEAD",
      "git merge-base HEAD HEAD",
      "git hash-object src/a.ts",
      "git hash-object -w src/a.ts",
      "git symbolic-ref HEAD",
      "git branch -f x HEAD",
      "git tag x",
      "git sparse-checkout set src",
    ];
    for (const command of [...denied, ...allowed]) assert.equal(hookReason(command, r.root), null, `denied with no lock: ${command}`);
    locked(r);
    for (const command of denied) assert.ok(hookReason(command, r.root) !== null, `not denied under a lock: ${command}`);
    for (const command of allowed) assert.equal(hookReason(command, r.root), null, `denied under a lock: ${command}`);
  });
});

test("A6 an obligation that runs a script the revert removed through an interpreter is killed wherever the interpreter does not exit 126 or 127", SPAWN_TEST, async () => {
  // What docs/wiki/The-CLI.md says of it: node exits 1 for a script that is not there, and dash 2.
  const interpreters: [string, string, string, string][] = [["node", "scripts/check.js", "process.exit(0);\n", "exit 1"]];
  if (existsSync("/bin/dash")) interpreters.push(["/bin/dash", "scripts/check.sh", "exit 0\n", "exit 2"]);
  for (const [interpreter, script, body, exit] of interpreters) {
    const addScript = (root: string): void => {
      editA(root);
      put(root, script, body);
    };
    await withRunRepo('echo run >> "$1"\n', startA, addScript, async (r) => {
      r.box.writeState({ ...(parseState(r.store.state) as object), verify: `${interpreter} ${script}` });
      const { code, text, last } = await mutate(r);
      assert.equal(code, 0, text);
      assert.match(last, /^mutation-killed: /, text);
      assert.ok(text.includes(`\`${interpreter} ${script}\` ${exit} after`), `${interpreter}: ${text}`);
      assert.equal(readFileSync(join(r.root, script), "utf8"), body);
    });
  }
});

test("A2 a symlink or a FIFO at the lock's name: the hook reads it as readLock does, names no restore, and does not block", SPAWN_TEST, () => {
  // Round 1 review, blocking 2 and non-blocking 3: readFileSync followed the link, and blocked on the FIFO.
  withRepo(startA, editA, (r) => {
    locked(r);
    const file = lockFileOf(r);
    const written = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const target = join(dirname(file), "real-lock.json");
    writeFileSync(target, `${JSON.stringify({ ...written, pid: deadPid() }, null, 2)}\n`);
    rmSync(file);
    symlinkSync("real-lock.json", file);
    const tree = status(r.root);

    const gate = gateLine(r.store);
    assert.match(gate, /cannot be read as a run's record/);
    const lines: string[] = [];
    assert.equal(restoreRun(r.store, { out: (l) => lines.push(l) }), 2, lines.join("\n"));
    const hook = hookReason("git commit -m x", r.root);
    assert.ok(hook !== null, "the hook allowed git commit with a symlink at the lock's name");
    assert.doesNotMatch(hook, /\bcd |verify --restore/, `the hook names a restore that refuses the lock: ${hook}`);
    assert.match(hook, BY_HAND);
    assert.match(hook, /'mstack gate' says the same/);
    assert.ok(lstatSync(file).isSymbolicLink(), "the symlink changed");
    assert.equal(status(r.root), tree, "the tree changed");

    // In its own process, under a timeout that kills it: in this one a blocked open would never return.
    rmSync(file);
    assert.equal(spawnSync("mkfifo", [file]).status, 0, "mkfifo failed");
    const input = JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git commit -m x" }, cwd: r.root });
    const began = Date.now();
    const p = spawnSync(CLI, ["hook", "pre-tool-use"], { cwd: r.root, input, encoding: "utf8", timeout: SIGNAL_MS, killSignal: "SIGKILL", env: { ...process.env, NO_COLOR: "1" } });
    rmSync(file);
    assert.equal(p.signal, null, `the hook blocked on a FIFO at the lock's name until it was killed, after ${Date.now() - began} ms`);
    assert.equal(p.status, 0, `${p.stdout}${p.stderr}`);
    const reason = (JSON.parse(p.stdout) as { hookSpecificOutput: { permissionDecisionReason: string } }).hookSpecificOutput.permissionDecisionReason;
    assert.doesNotMatch(reason, /\bcd |verify --restore/, reason);
    assert.match(reason, BY_HAND);
  });
});

test("A4 under a lock the hook denies git --shallow-file with its value after a space, and git's own name in any case", () => {
  // Round 1 review, non-blocking 1: `git --shallow-file x status` exits 0 (with `=` git exits 129), and on a disk
  // that folds case `GIT status` runs git. git's subcommand does not fold: `git COMMIT` exits 128, writing nothing.
  withRepo(startA, editA, (r) => {
    const denied = [
      "git --shallow-file x commit -m x",
      "git --shallow-file x add -A",
      "git -C . --shallow-file x stash",
      "git --shallow-file x update-index --add src/a.ts",
      "GIT commit -m x",
      "Git add -A",
      "GIT -C . --shallow-file x update-ref refs/heads/main HEAD~1",
    ];
    const allowed = ["git --shallow-file x status", "GIT status", "Git --shallow-file x log -1", "git COMMIT -m x"];
    for (const command of [...denied, ...allowed]) assert.equal(hookReason(command, r.root), null, `denied with no lock: ${command}`);
    locked(r);
    for (const command of denied) assert.match(hookReason(command, r.root) ?? `not denied under a lock: ${command}`, /mstack-mutation\.lock exists/, command);
    for (const command of allowed) assert.equal(hookReason(command, r.root), null, `denied under a lock: ${command}`);
  });
  // The same prefix leads every git guard: a force push spelled GIT is one too.
  assert.match(hookReason("GIT push --force origin main", tmpdir()) ?? "allowed", /force-push rewrites history/);
});

test("A3 a run that cannot be told alive, under a lock whose store no restore takes: the gate says wait, as R1 does, then the by-hand way out", () => {
  // Round 1 review, non-blocking 5 and 6 (M2): the gate's line for this case said only the by-hand way, so a run
  // that may be alive on another host was told to stash and delete the lock, and no test reached the branch.
  withRepo(startA, editA, (r) => {
    locked(r);
    const file = lockFileOf(r);
    const written = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    writeFileSync(file, `${JSON.stringify({ ...written, host: "elsewhere.invalid", rootFromTop: "pkg/gone" }, null, 2)}\n`);
    const gate = gateLine(r.store);
    assert.match(gate, /whether the run is running cannot be told \(the lock is from another host, elsewhere\.invalid\)/);
    const fix = gate.slice(gate.indexOf(" -> ") + " -> ".length);
    assert.match(fix, /^wait for it to end; no verify --restore takes this lock: it names its store pkg\/gone, and there is no directory /);
    assert.match(fix, BY_HAND);
    assert.doesNotMatch(fix, /\bcd |mstack'? verify --restore|where the run started/, fix);
    const { st, it } = active(r.start);
    assert.equal(refusals(r.store, st, it)?.fix, fix, "the gate and R1 give another way out");
  });
});

test("A2 from inside the git directory, where git names no top level, the hook still denies under a lock and names the store to run from", () => {
  // Round 1 review, non-blocking 6 (M3): without the `top === null` guard the hook threw there, and the CLI's
  // hook command fails open on a throw.
  withRepo(startA, editA, (r) => {
    locked(r);
    const file = lockFileOf(r);
    const gitDir = dirname(file);
    // The CLI that wrote the lock is this one, as one shell word: quoted when the checkout's path holds a space (item 105, A3).
    const restore = `${shellWord(join(runningCliRoot(), "bin", "mstack"))} verify --restore`;
    const asWritten = hookReason("git -C .. commit -am x", gitDir);
    assert.ok((asWritten ?? "allowed").endsWith(`run from . under this worktree's top level: ${restore}`), asWritten ?? "allowed");
    const written = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    writeFileSync(file, `${JSON.stringify({ ...written, rootFromTop: "pkg/a" }, null, 2)}\n`);
    const another = hookReason("git -C .. commit -am x", gitDir);
    assert.ok((another ?? "allowed").endsWith(`run from pkg/a under this worktree's top level: ${restore}`), another ?? "allowed");
  });
});

test("A1 shellWord: a path run through the shell comes back as it was, whatever shell character it holds, and a plain path stays bare", () => {
  // Round 1 review, non-blocking 6 (M1): no test called shellWord, and the odd paths of A1 hold only a space and quotes.
  const shells = ["/bin/sh", ...(existsSync("/bin/dash") ? ["/bin/dash"] : [])];
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "mstack-word-")));
  try {
    for (const c of [" ", "'", '"', "$", "`", ";", "&", "|", "(", ")", "<", ">", "!", "*", "?", "[", "]", "{", "}", "~", "#", "\\", "\t", "\n", "é"]) {
      const path = `/tmp/a${c}b${c}/bin/mstack`;
      const word = shellWord(path);
      assert.ok(word.startsWith("'"), `${JSON.stringify(c)} left bare: ${word}`);
      for (const shell of shells) {
        const p = spawnSync(shell, ["-c", `printf '%s' ${word}`], { cwd, encoding: "utf8" });
        assert.equal(p.stdout, path, `${shell}, ${JSON.stringify(c)}: ${word} -> ${p.stdout}${p.stderr}`);
      }
    }
    assert.deepEqual(spawnSync("/bin/sh", ["-c", "ls -A"], { cwd, encoding: "utf8" }).stdout, "", "a word wrote a file");
    const plain = "/opt/x-1.2_3/bin/mstack@%+=:,";
    assert.equal(shellWord(plain), plain, "a plain path is quoted: every transcript of one would change");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

/**
 * Item 105 (the item 101 reviews' last points): a writer's CLI path that holds
 * something that cannot run, and a lock edited to name another store.
 */

/** What can be at the path of the CLI that wrote the lock, and the reason the printers give when it cannot run. */
const CANNOT_RUN: readonly [string, string][] = [
  ["a directory", "it is a directory"],
  ["a file without the execute bit", "it is not executable"],
  ["a copy whose src/ is gone", "its src/cli.ts is missing"],
];

/** A copy of the CLI at `<base>/writer dir's "q" x/`, made into `kind`; its `bin/mstack`. */
function writerAt(base: string, kind: string): string {
  const root = join(base, `writer ${ODD}`);
  rmSync(root, { recursive: true, force: true });
  const cli = join(root, "bin", "mstack");
  if (kind === "a directory") {
    mkdirSync(cli, { recursive: true });
    return cli;
  }
  mkdirSync(root, { recursive: true });
  for (const part of ["bin", "src", "package.json"]) cpSync(join(CHECKOUT, part), join(root, part), { recursive: true });
  if (kind === "a file without the execute bit") chmodSync(cli, 0o644);
  if (kind === "a copy whose src/ is gone") rmSync(join(root, "src"), { recursive: true });
  return cli;
}

/**
 * What a run of A's item killed with kill -9 on the reverted tree leaves, made in
 * this process: A staged, the lock taken, the tree reverted, then the lock's pid
 * one that has exited and its CLI `cli`.
 */
function deadRunIn(o: Odd, cli: string): Record<string, unknown> {
  outsideCheckout(o.a);
  const store = storeAt(o.a);
  const start = git(o.a, "rev-parse", "HEAD~1");
  const set = revertSet(store, start);
  assert.ok(set !== null);
  const prepared = prepareRun(store, start, set);
  assert.ok(prepared.ok, prepared.ok ? "" : prepared.reason);
  assert.ok(acquireLock(store, prepared.lock).ok);
  assert.ok(applyRevert(store, prepared.lock).ok);
  const lock = { ...prepared.lock, pid: deadPid(), cli };
  writeFileSync(o.lockFile, `${JSON.stringify(lock, null, 2)}\n`);
  assert.equal(readFileSync(join(o.a, "src", "x.js"), "utf8"), "OLD\n");
  return lock;
}

test("A1 (item 105) restoreCommand offers the writer's CLI only when it can run, and otherwise names it and offers the running one", () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "mstack-writer-")));
  try {
    const running = "/opt/running/bin/mstack";
    // Can run: a copy, and a symlink to one, which bin/mstack follows to find its src/.
    const runs = writerAt(base, "a copy that runs");
    const link = join(base, "link", "bin", "mstack");
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(runs, link);
    // A relative link, which is read from the link's own directory and not the cwd, and a chain of two links
    // (round 1 review, non-blocking 2: X1 and X3).
    const relativeLink = join(base, "relative link", "bin", "mstack");
    mkdirSync(dirname(relativeLink), { recursive: true });
    symlinkSync(relative(dirname(relativeLink), runs), relativeLink);
    const chain = join(base, "chain", "bin", "mstack");
    mkdirSync(dirname(chain), { recursive: true });
    symlinkSync(link, chain);
    for (const cli of [runs, link, relativeLink, chain]) {
      assert.deepEqual(restoreCommand(cli, running), { command: `${shellWord(cli)} verify --restore`, lead: "" }, cli);
      const ran = sh(`${shellWord(cli)} version`, base);
      assert.equal(ran.code, 0, `${cli} was called runnable and does not run: ${ran.all}`);
    }
    for (const [kind, why] of CANNOT_RUN) {
      const cli = writerAt(base, kind);
      assert.deepEqual(restoreCommand(cli, running), { command: `${running} verify --restore`, lead: `the CLI that wrote the lock, ${shellWord(cli)}, cannot run (${why}); ` }, kind);
      const ran = sh(`${shellWord(cli)} version`, base);
      assert.ok(ran.code === 126 || ran.code === 127, `${kind}: called unrunnable, and it runs: exit ${ran.code} ${ran.all}`);
    }
    const gone = join(base, "nowhere", "bin", "mstack");
    assert.deepEqual(restoreCommand(gone, running), { command: `${running} verify --restore`, lead: `the CLI that wrote the lock, ${gone}, is gone; ` });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

for (const [kind, why] of CANNOT_RUN) {
  test(`A1 (item 105) the writer's CLI path holds ${kind}: every printer, in the lock's store and in another, offers the running CLI's restore, and it runs as printed`, SPAWN_TEST, () => {
    const o = oddWorld();
    try {
      const writer = writerAt(o.base, kind);
      const lead = `the CLI that wrote the lock, ${shellWord(writer)}, cannot run (${why}); `;
      const here = `${shellWord(o.cli)} verify --restore`;
      const there = `cd ${shellWord(o.a)} && ${here}`;
      const puts = " puts the tree back and removes the lock";
      // [where, printer, what it prints, the prose in front of the command, the command, the prose after it]
      const printers: [string, string, () => string, RegExp, string, string, string][] = [
        ["A", "the gate", () => run(o.cli, o.a, ["gate", "--quiet"]).all, /mstack-mutation\.lock[^\n]* -> (.+)$/m, `${lead}run `, here, ""],
        ["A", "R1", () => run(o.cli, o.a, ["verify", "--mutation"]).all, /^mutation: (.+ puts the tree back and removes the lock)$/m, lead, here, puts],
        ["A", "the hook", () => hookOf(o.cli, o.a), /It is held by pid \d+: (.+)$/, `${lead}wait for it, or if it is not running, run `, there, ""],
        ["B", "the gate", () => run(o.cli, o.b, ["gate", "--quiet"]).all, /mstack-mutation\.lock[^\n]* -> (.+)$/m, `${lead}run `, there, ""],
        ["B", "R1", () => run(o.cli, o.b, ["verify", "--mutation"]).all, /^mutation: (.+ puts the tree back and removes the lock)$/m, lead, there, puts],
        ["B", "the hook", () => hookOf(o.cli, o.b), /It is held by pid \d+: (.+)$/, `${lead}wait for it, or if it is not running, run `, there, ""],
        ["B", "the restore", () => run(o.cli, o.b, ["verify", "--restore"]).out, /^mutation: ((?:.+; )?run it from that store: .+)$/m, `${lead}run it from that store: `, there, ""],
      ];
      for (const [where, what, print, pattern, before, command, after] of printers) {
        deadRunIn(o, writer);
        const printed = captureOf(print(), pattern, `${what} in ${where}`);
        assert.equal(printed, `${before}${command}${after}`, `${what} in ${where}, the writer ${kind}`);
        assert.ok(!printed.includes(`${shellWord(writer)} verify --restore`), `${what} in ${where} offers the writer that cannot run: ${printed}`);
        // The one command the line offers, cut from the printed text between its prose, and run as printed where it was printed.
        repairs(o, printed.slice(before.length, printed.length - after.length), where === "A" ? o.a : o.b);
      }
    } finally {
      rmSync(o.base, { recursive: true, force: true });
    }
  });
}

test("A2 (item 105) a lock edited so its rootFromTop names another real store restores into neither, says why, and writes nothing", () => {
  const o = oddWorld();
  try {
    const written = deadRunIn(o, o.cli);
    const edited = `${JSON.stringify({ ...written, rootFromTop: "pkg/b" }, null, 2)}\n`;
    writeFileSync(o.lockFile, edited);
    const top = dirname(dirname(o.a));
    const runs = join(dirname(o.lockFile), "mstack-mutation");
    const listing = (): string =>
      JSON.stringify((readdirSync(runs, { recursive: true }) as string[]).sort().map((p) => [p, lstatSync(join(runs, p)).isFile() ? readFileSync(join(runs, p), "base64") : "dir"]));
    const tree = status(top);
    const staged = listing();
    const noCommand = /\bcd |mstack'? verify --restore/;
    const { st, it } = active(git(o.a, "rev-parse", "HEAD~1"));
    for (const [where, root] of [["B, which the edit names", o.b], ["A, where the run was", o.a]] as const) {
      const store = storeAt(root);
      const lines: string[] = [];
      assert.equal(restoreRun(store, { out: (l) => lines.push(l) }), 2, `${where}: ${lines.join("\n")}`);
      const restore = lines.join("\n");
      assert.ok(restore.includes(`its root ${o.a} is the store at pkg/a in this worktree`), `${where}:\n${restore}`);
      assert.doesNotMatch(restore, noCommand, `${where}:\n${restore}`);
      assert.match(restore, BY_HAND, where);

      const gate = gateLine(store);
      assert.doesNotMatch(gate.slice(gate.indexOf(" -> ")), noCommand, `${where}: ${gate}`);
      assert.match(gate, BY_HAND, where);
      const r1 = refusals(store, st, it);
      assert.ok(r1 !== null, where);
      assert.doesNotMatch(r1.fix, noCommand, `${where}: ${r1.fix}`);
      assert.match(r1.fix, BY_HAND, where);
      const hook = hookReason("git commit -m x", root);
      assert.ok(hook !== null, `${where}: the hook allowed git commit under a lock`);
      assert.doesNotMatch(hook, noCommand, `${where}: ${hook}`);
      assert.match(hook, BY_HAND, where);

      assert.equal(readFileSync(o.lockFile, "utf8"), edited, `${where}: the lock changed`);
      assert.equal(status(top), tree, `${where}: the tree changed`);
      assert.equal(listing(), staged, `${where}: the run directory changed`);
      assert.equal(readFileSync(join(o.a, "src", "x.js"), "utf8"), "OLD\n");
      assert.equal(existsSync(join(o.b, "src", "x.js")), false, `${where}: A's file was written into B`);
    }

    // The control: the lock as the run wrote it, restored from A.
    writeFileSync(o.lockFile, `${JSON.stringify(written, null, 2)}\n`);
    const back: string[] = [];
    assert.equal(restoreRun(storeAt(o.a), { out: (l) => back.push(l) }), 0, back.join("\n"));
    assert.equal(readFileSync(join(o.a, "src", "x.js"), "utf8"), "NEW\n");

    // The same lock, its root spelled through a symlink to A, or naming a store of another worktree (a copy, or a
    // path reused after a move): either is the run's own store, and the restore from A takes it.
    const link = join(o.base, "link to a");
    symlinkSync(o.a, link);
    const other = join(o.base, "other top", "pkg", "b");
    repoWithStores(join(o.base, "other top"), ["pkg/b"]);
    for (const [label, root] of [["a symlink to A", link], ["a store of another worktree", other]] as const) {
      deadRunIn(o, o.cli);
      const lock = JSON.parse(readFileSync(o.lockFile, "utf8")) as Record<string, unknown>;
      writeFileSync(o.lockFile, `${JSON.stringify({ ...lock, root }, null, 2)}\n`);
      const lines: string[] = [];
      assert.equal(restoreRun(storeAt(o.a), { out: (l) => lines.push(l) }), 0, `${label}: ${lines.join("\n")}`);
      assert.match(lines.join("\n"), /restored 1, tree verified, lock removed/, label);
      assert.equal(readFileSync(join(o.a, "src", "x.js"), "utf8"), "NEW\n", label);
    }

    // The edit to `.`, with a store at the top level: that store is held to the same check (round 1 review,
    // non-blocking 2: X2).
    captured(() => setup(top));
    const toTop = `${JSON.stringify({ ...deadRunIn(o, o.cli), rootFromTop: "." }, null, 2)}\n`;
    writeFileSync(o.lockFile, toTop);
    for (const [where, root] of [["the top store, which the edit names", top], ["A, where the run was", o.a]] as const) {
      const lines: string[] = [];
      assert.equal(restoreRun(storeAt(root), { out: (l) => lines.push(l) }), 2, `${where}: ${lines.join("\n")}`);
      assert.ok(lines.join("\n").includes(`its root ${o.a} is the store at pkg/a in this worktree`), `${where}:\n${lines.join("\n")}`);
      assert.equal(readFileSync(o.lockFile, "utf8"), toTop, `${where}: the lock changed`);
      assert.equal(existsSync(join(top, "src", "x.js")), false, `${where}: A's file was written into the top store`);
      assert.equal(readFileSync(join(o.a, "src", "x.js"), "utf8"), "OLD\n", where);
    }
  } finally {
    rmSync(o.base, { recursive: true, force: true });
  }
});

/**
 * Item 105, round 2 (the round 1 review, B1): the check of a lock's `root` asks
 * git only about a root under this worktree's top level, and asks it from that
 * root alone, so a caller's GIT_DIR or GIT_WORK_TREE, which name the caller's
 * worktree, cannot place a copied checkout's original in the copy.
 */

/** `cli args` from `cwd` with the caller's git variables dropped and `vars` set. */
function runWith(cli: string, cwd: string, args: readonly string[], vars: Readonly<Record<string, string>>): Ran {
  outsideCheckout(cwd);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const p = spawnSync(cli, [...args], { cwd, encoding: "utf8", env: { ...env, NO_COLOR: "1", ...vars }, timeout: 120_000 });
  return { code: p.status, out: p.stdout, all: `${p.stdout}${p.stderr}` };
}

test("B1 (item 105, round 2) a checkout copied after its run died restores from the copy with GIT_DIR and GIT_WORK_TREE naming the copy, with GIT_WORK_TREE alone, and with neither", SPAWN_TEST, () => {
  const o = oddWorld();
  try {
    deadRunIn(o, o.cli);
    const top = dirname(dirname(o.a));
    const variants: [string, (copy: string) => Record<string, string>][] = [
      ["GIT_DIR and GIT_WORK_TREE", (copy) => ({ GIT_DIR: join(copy, ".git"), GIT_WORK_TREE: copy })],
      ["GIT_WORK_TREE alone", (copy) => ({ GIT_WORK_TREE: copy })],
      ["neither", () => ({})],
    ];
    for (const [n, [label, vars]] of variants.entries()) {
      const copy = join(o.base, `copy ${n} ${ODD}`);
      cpSync(top, copy, { recursive: true, verbatimSymlinks: true });
      const a = join(copy, "pkg", "a");
      // The gate's line in the copy, run as printed with the same variables, is the restore.
      const line = captureOf(runWith(o.cli, a, ["gate", "--quiet"], vars(copy)).all, /mstack-mutation\.lock[^\n]* -> run (.+)$/m, `the gate, ${label}`);
      assert.equal(line, `${shellWord(o.cli)} verify --restore`, label);
      const ran = runWith("/bin/sh", a, ["-c", line], vars(copy));
      assert.equal(ran.code, 0, `${label}: ${ran.all}`);
      assert.match(ran.out, /restored 1, tree verified, lock removed/, label);
      assert.equal(readFileSync(join(a, "src", "x.js"), "utf8"), "NEW\n", label);
      assert.equal(existsSync(join(copy, ".git", "mstack-mutation.lock")), false, `${label}: the copy's lock stays`);
      assert.equal(readFileSync(join(o.a, "src", "x.js"), "utf8"), "OLD\n", `${label}: the original changed`);
    }

    // GIT_DIR alone makes the cwd the worktree's top level (git's rule), so the copy's pkg/a is its top: refused
    // as before item 105, as another store's lock and not as an edited one, and nothing written.
    const copy = join(o.base, `copy git dir ${ODD}`);
    cpSync(top, copy, { recursive: true, verbatimSymlinks: true });
    const lock = join(copy, ".git", "mstack-mutation.lock");
    const held = readFileSync(lock, "utf8");
    const alone = runWith(o.cli, join(copy, "pkg", "a"), ["verify", "--restore"], { GIT_DIR: join(copy, ".git") });
    assert.equal(alone.code, 2, alone.all);
    assert.match(alone.out, /the lock is the run's of the store at pkg\/a in this worktree, and this store is at the worktree's top level/);
    assert.doesNotMatch(alone.all, /the lock was edited/);
    assert.equal(readFileSync(lock, "utf8"), held, "GIT_DIR alone: the lock changed");
    assert.equal(readFileSync(join(copy, "pkg", "a", "src", "x.js"), "utf8"), "OLD\n");

    // The original, after the copies, from its own store.
    const back = runWith(o.cli, o.a, ["verify", "--restore"], {});
    assert.equal(back.code, 0, back.all);
    assert.equal(readFileSync(join(o.a, "src", "x.js"), "utf8"), "NEW\n");
  } finally {
    rmSync(o.base, { recursive: true, force: true });
  }
});

test("B1 (item 105, round 2) a checkout copied into the directory that holds it restores from the copy with the variables naming the copy: the original is a repository of its own, not a store of the copy", SPAWN_TEST, () => {
  const o = oddWorld();
  try {
    deadRunIn(o, o.cli);
    const top = dirname(dirname(o.a));
    // `cp -R <top>/. <its parent>/`: the copy's worktree is o.base, and it holds the original, whose pkg/a is the
    // lock's root. git asked with the caller's variables places that root in the copy, at `top dir's "q" x/pkg/a`;
    // asked from the root alone, in the original.
    const a = join(o.base, "pkg", "a");
    // The last but one: GIT_DIR alone, the copy's config naming its worktree (core.worktree), which git then reads.
    const variants: [string, Record<string, string>, boolean][] = [
      ["GIT_DIR and GIT_WORK_TREE", { GIT_DIR: join(o.base, ".git"), GIT_WORK_TREE: o.base }, false],
      ["GIT_WORK_TREE alone", { GIT_WORK_TREE: o.base }, false],
      ["GIT_DIR alone, with core.worktree", { GIT_DIR: join(o.base, ".git") }, true],
      ["neither", {}, false],
    ];
    for (const [label, vars, coreWorktree] of variants) {
      rmSync(join(o.base, ".git"), { recursive: true, force: true });
      rmSync(join(o.base, "pkg"), { recursive: true, force: true });
      cpSync(top, o.base, { recursive: true, verbatimSymlinks: true });
      if (coreWorktree) git(o.base, "config", "core.worktree", o.base);
      assert.equal(readFileSync(join(a, "src", "x.js"), "utf8"), "OLD\n", `${label}: the copy is not of the reverted tree`);
      const ran = runWith(o.cli, a, ["verify", "--restore"], vars);
      assert.equal(ran.code, 0, `${label}: ${ran.all}`);
      assert.match(ran.out, /restored 1, tree verified, lock removed/, label);
      assert.equal(readFileSync(join(a, "src", "x.js"), "utf8"), "NEW\n", label);
      assert.equal(existsSync(join(o.base, ".git", "mstack-mutation.lock")), false, `${label}: the copy's lock stays`);
      assert.equal(readFileSync(join(o.a, "src", "x.js"), "utf8"), "OLD\n", `${label}: the original changed`);
    }
    const back = runWith(o.cli, o.a, ["verify", "--restore"], {});
    assert.equal(back.code, 0, back.all);
    assert.equal(readFileSync(join(o.a, "src", "x.js"), "utf8"), "NEW\n");
  } finally {
    rmSync(o.base, { recursive: true, force: true });
  }
});

test("B1 (item 105, round 2) rootDisagrees asks only about a root under this worktree's top level: one outside says nothing whatever that path holds now, and one under it is held to rootFromTop", () => {
  const o = oddWorld();
  try {
    const top = dirname(dirname(o.a));
    // After a move, the old path may hold anything, even a link into another store of this worktree.
    const old = join(o.base, `old path ${ODD}`);
    symlinkSync(o.b, old);
    assert.equal(rootDisagrees({ root: old, rootFromTop: "pkg/a" }, o.a, top), null);
    // Under the top level: another store, and a store whose name starts with two dots, which is not the parent.
    assert.equal(rootDisagrees({ root: o.b, rootFromTop: "pkg/a" }, o.a, top), `its root ${o.b} is the store at pkg/b in this worktree, so the lock was edited and whose it is cannot be told`);
    const dots = join(top, "..b");
    mkdirSync(dots);
    captured(() => setup(dots));
    assert.match(rootDisagrees({ root: dots, rootFromTop: "pkg/a" }, o.a, top) ?? "agrees", /its root .+ is the store at \.\.b in this worktree/);
    // This store's own root, and a root under the top level that names no directory, say nothing.
    assert.equal(rootDisagrees({ root: o.a, rootFromTop: "pkg/a" }, o.a, top), null);
    assert.equal(rootDisagrees({ root: join(top, "pkg", "gone"), rootFromTop: "pkg/a" }, o.a, top), null);
  } finally {
    rmSync(o.base, { recursive: true, force: true });
  }
});
