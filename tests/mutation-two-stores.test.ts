import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { preToolUse } from "../src/hooks.ts";
import { setup } from "../src/setup.ts";
import { captured, item, sandbox, state } from "./helpers.ts";
import { commitAll, git, locked, makeRepo, outsideCheckout, put, SIGNAL_MS, SPAWN_TEST, status, until } from "./mutation-fixture.ts";

/**
 * Item 42, round 2 review B3: two stores in one worktree share its git
 * directory, and so one lock. A run in `pkg/a` is killed during its check;
 * `verify --restore` from `pkg/b` must write nothing and name `pkg/a`, and
 * the restore from `pkg/a` must repair it, in place and after the whole
 * checkout is moved. `bin/mstack` runs as a child in a sandbox, never in this
 * checkout.
 */

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

interface Ran {
  readonly code: number | null;
  readonly out: string;
  readonly all: string;
}

function cli(cwd: string, args: readonly string[]): Ran {
  outsideCheckout(cwd);
  const p = spawnSync(CLI, [...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" }, timeout: 120_000 });
  return { code: p.status, out: p.stdout, all: `${p.stdout}${p.stderr}` };
}

let serial = 0;
const sleeper = (): string => `sleep 47.${process.pid % 1000}${serial++}`;
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

/** Every entry under `dir` but `.git`: path to SHA-256 and mode, `dir`, or a link's target. */
function entries(dir: string): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (rel: string): void => {
    for (const name of readdirSync(rel === "" ? dir : join(dir, rel)).sort()) {
      if (rel === "" && name === ".git") continue;
      const r = rel === "" ? name : `${rel}/${name}`;
      const st = lstatSync(join(dir, r));
      if (st.isSymbolicLink()) found.set(r, `link:${readlinkSync(join(dir, r))}`);
      else if (st.isDirectory()) {
        found.set(r, "dir");
        walk(r);
      } else found.set(r, `${createHash("sha256").update(readFileSync(join(dir, r))).digest("hex")}:${(st.mode & 0o7777).toString(8)}`);
    }
  };
  if (existsSync(dir)) walk("");
  return found;
}

const without = (m: Map<string, string>, prefix: string): Map<string, string> => new Map([...m].filter(([p]) => !p.startsWith(prefix)));

interface Two {
  top: string;
  readonly log: string;
  readonly marker: string;
}

const a = (t: Two): string => join(t.top, "pkg", "a");
const b = (t: Two): string => join(t.top, "pkg", "b");
const gitDir = (t: Two): string => join(t.top, ".git");
const lockFile = (t: Two): string => join(gitDir(t), "mstack-mutation.lock");

/**
 * The review's `twoStores`: stores in `pkg/a` and `pkg/b` and none at the top;
 * A's item edits `src/x.js` and `src/shared.js`, adds `src/new.js` and deletes
 * `src/gone.js`; B commits the same `shared.js` and `gone.js` byte for byte, its
 * own `src/x.js`, and holds an untracked `src/new.js`. Each store has an item in
 * progress; A's verification sleeps on the reverted tree.
 */
function twoStores(): Two {
  const box = sandbox();
  const top = box.store.root;
  rmSync(join(top, ".mstack"), { recursive: true, force: true });
  const log = join(top, "..", `${top.split("/").pop() as string}.log`);
  const marker = sleeper();
  const A = join(top, "pkg", "a");
  const B = join(top, "pkg", "b");
  mkdirSync(A, { recursive: true });
  mkdirSync(B, { recursive: true });
  captured(() => setup(A));
  captured(() => setup(B));
  put(A, "src/x.js", "OLD\n");
  put(A, "tests/check.sh", `echo run >> "$1"\ngrep -q NEW src/x.js || { ${marker}; }\n`);
  put(B, "src/x.js", "B's own committed x\n");
  for (const root of [A, B]) {
    put(root, "src/shared.js", "export const shared = 1;\n");
    put(root, "src/gone.js", "export const gone = 1;\n");
  }
  const start = commitAll(top, "start");
  git(top, "switch", "-q", "-c", "feat/a");
  writeFileSync(join(A, ".mstack", "state.json"), `${JSON.stringify(state([item({ slug: "a", status: "in_progress", base: start })], { verify: `sh tests/check.sh '${log}'` }), null, 2)}\n`);
  writeFileSync(join(B, ".mstack", "state.json"), `${JSON.stringify(state([item({ slug: "b", status: "in_progress", base: start })], { verify: "true" }), null, 2)}\n`);
  put(A, "src/x.js", "NEW\n");
  put(A, "src/new.js", "A added\n");
  put(A, "src/shared.js", "export const shared = 2; // A's item\n");
  rmSync(join(A, "src", "gone.js"));
  commitAll(top, "item a");
  put(B, "src/new.js", "B's untracked work\n");
  return { top, log, marker };
}

/** A's run, SIGKILLed while its check sleeps on the reverted tree; the check gone after it. */
async function killedInA(t: Two): Promise<void> {
  outsideCheckout(a(t));
  const child = spawn(CLI, ["verify", "--mutation"], { cwd: a(t), stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NO_COLOR: "1" } });
  let text = "";
  child.stdout.on("data", (d: Buffer) => (text += d.toString("utf8")));
  child.stderr.on("data", (d: Buffer) => (text += d.toString("utf8")));
  const exited = new Promise<number | string | null>((res) => child.on("close", (code, signal) => res(code ?? signal)));
  try {
    assert.ok(await until(() => survivors(t.marker).length > 0, SIGNAL_MS), `the check never ran on the reverted tree: ${text}`);
    process.kill(child.pid as number, "SIGKILL");
    assert.equal(await exited, "SIGKILL");
    assert.ok(await until(() => survivors(t.marker).length === 0, 5000), "the check outlived the killed run");
  } finally {
    try {
      process.kill(child.pid as number, "SIGKILL");
    } catch {
      // Gone.
    }
    killAll(t.marker);
  }
  assert.ok(existsSync(lockFile(t)), `the killed run left no lock: ${text}`);
}

/** The run's own lines: what names a directory names A's, by its real path. */
async function scenario(moved: boolean): Promise<void> {
  const t = twoStores();
  const first = t.top;
  try {
    const before = without(entries(t.top), "pkg/a/.mstack/");
    const statusBefore = status(t.top).split("\n").filter((l) => !l.includes("pkg/a/.mstack/")).join("\n");
    await killedInA(t);
    assert.notDeepEqual(without(entries(t.top), "pkg/a/.mstack/"), before, "A's tree is not reverted");
    if (moved) {
      renameSync(first, `${first}-moved`);
      t.top = `${first}-moved`;
    }
    const dirA = realpathSync(a(t));

    // From B: refused, and nothing written to the tree, the lock or the run directory.
    const tree = entries(t.top);
    const lock = readFileSync(lockFile(t), "utf8");
    const runs = entries(join(gitDir(t), "mstack-mutation"));
    const fromB = cli(b(t), ["verify", "--restore"]);
    assert.equal(fromB.code, 2, fromB.all);
    assert.ok(fromB.out.includes(dirA), `the refusal does not name ${dirA}:\n${fromB.all}`);
    assert.deepEqual(entries(t.top), tree, "a refused restore from B changed the tree");
    assert.equal(readFileSync(lockFile(t), "utf8"), lock, "a refused restore from B changed the lock");
    assert.deepEqual(entries(join(gitDir(t), "mstack-mutation")), runs, "a refused restore from B changed the run directory");
    assert.equal(readFileSync(join(b(t), "src", "new.js"), "utf8"), "B's untracked work\n");
    assert.equal(readFileSync(join(b(t), "src", "gone.js"), "utf8"), "export const gone = 1;\n");

    // B's gate, B's R1 refusal and the hook in B name A's directory.
    const gate = cli(b(t), ["gate", "--quiet"]);
    const line = gate.all.split("\n").find((l) => l.includes("mstack-mutation.lock"));
    assert.ok(line !== undefined && line.includes(dirA), `B's gate line does not name ${dirA}:\n${gate.all}`);
    const r1 = cli(b(t), ["verify", "--mutation"]);
    assert.equal(r1.code, 2, r1.all);
    assert.ok(r1.all.includes("mstack-mutation.lock") && r1.all.includes(dirA), `B's R1 refusal does not name ${dirA}:\n${r1.all}`);
    const hook = preToolUse({ tool_name: "Bash", tool_input: { command: "git commit -m x" }, cwd: b(t) });
    assert.ok(hook !== null && hook.includes(dirA), `the hook's reason in B does not name ${dirA}: ${hook ?? "allowed"}`);
    assert.deepEqual(entries(t.top), tree, "the gate or the R1 refusal changed the tree");

    // From A: repaired, and the lock gone.
    const fromA = cli(a(t), ["verify", "--restore"]);
    assert.equal(fromA.code, 0, fromA.all);
    assert.match(fromA.out, /restored 4, tree verified, lock removed/);
    assert.equal(existsSync(lockFile(t)), false);
    assert.deepEqual(without(entries(t.top), "pkg/a/.mstack/"), before);
    assert.equal(status(t.top).split("\n").filter((l) => !l.includes("pkg/a/.mstack/")).join("\n"), statusBefore);
  } finally {
    killAll(t.marker);
    for (const dir of [first, `${first}-moved`]) rmSync(dir, { recursive: true, force: true });
    rmSync(t.log, { force: true });
  }
}

test("R24 a restore from another store of the worktree refuses, names the lock's store, and the restore there repairs it", SPAWN_TEST, async () => {
  await scenario(false);
});

test("R24 the same after the whole checkout is moved", SPAWN_TEST, async () => {
  await scenario(true);
});

test("R24 a lock that does not say which store of the worktree wrote it cannot be read", SPAWN_TEST, () => {
  const r = makeRepo((root) => put(root, "src/a.ts", "old\n"), (root) => put(root, "src/a.ts", "new\n"));
  try {
    locked(r);
    const file = join(git(r.root, "rev-parse", "--absolute-git-dir"), "mstack-mutation.lock");
    const lock = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    delete lock["rootFromTop"];
    writeFileSync(file, `${JSON.stringify(lock, null, 2)}\n`);
    const text = readFileSync(file, "utf8");
    const tree = entries(r.root);
    const ran = cli(r.root, ["verify", "--restore"]);
    assert.equal(ran.code, 2, ran.all);
    assert.match(ran.out, /rootFromTop/);
    assert.match(ran.out, /which store/);
    assert.deepEqual(entries(r.root), tree);
    assert.equal(readFileSync(file, "utf8"), text);
    const gate = cli(r.root, ["gate", "--quiet"]);
    assert.match(gate.all, /cannot be read as a run's record[^\n]*rootFromTop/);
  } finally {
    r.box.dispose();
  }
});
