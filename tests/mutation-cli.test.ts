import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { bootTime, pidNamespace, shellWord } from "../src/mutation-lock.ts";
import { setup } from "../src/setup.ts";
import { readRecords } from "../src/tsv.ts";
import { captured, item, sandbox, state } from "./helpers.ts";
import { commitAll, git, gitDirOf, lockFileOf, outsideCheckout, put, SIGNAL_MS, SPAWN_TEST, status, until, withRunRepo, type RunRepo } from "./mutation-fixture.ts";

/**
 * Item 42, task 3.4: `mstack verify` as a user runs it, `bin/mstack` as a
 * child process whose working directory is a throwaway repository with a
 * store; never this checkout.
 */

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

interface Ran {
  readonly code: number | null;
  readonly out: string;
  readonly all: string;
}

function cli(cwd: string, args: readonly string[], bin: string = CLI): Ran {
  outsideCheckout(cwd);
  const p = spawnSync(bin, [...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" }, timeout: 120_000 });
  return { code: p.status, out: p.stdout, all: `${p.stdout}${p.stderr}` };
}

interface Live {
  readonly pid: number;
  readonly exited: Promise<number | string | null>;
  output(): string;
  dispose(): void;
}

/** `bin/mstack <args>` left running; `bin/mstack` execs the runtime, so its pid is the run's. */
function live(cwd: string, args: readonly string[]): Live {
  outsideCheckout(cwd);
  const child = spawn(CLI, [...args], { cwd, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NO_COLOR: "1" } });
  let text = "";
  child.stdout.on("data", (d: Buffer) => (text += d.toString("utf8")));
  child.stderr.on("data", (d: Buffer) => (text += d.toString("utf8")));
  const exited = new Promise<number | string | null>((res) => child.on("close", (code, signal) => res(code ?? signal)));
  return {
    pid: child.pid as number,
    exited,
    output: () => text,
    dispose() {
      try {
        process.kill(child.pid as number, "SIGKILL");
      } catch {
        // Gone.
      }
    },
  };
}

const startA = (root: string): void => put(root, "src/a.ts", "old\n");
const editA = (root: string): void => put(root, "src/a.ts", "new\n");
const CHECK = 'echo run >> "$1"\ngrep -q new src/a.ts\n';
/** `git status`, the store's own lines left out: the run appends to verification.tsv. */
const tree = (r: RunRepo): string => status(r.root).split("\n").filter((l) => !l.includes(".mstack/")).join("\n");
const mutationRows = (r: RunRepo): Record<string, string>[] => readRecords(r.store.verification).filter((x) => (x["outcome"] ?? "").startsWith("mutation-"));
const SH_LOCK = /sh .*mstack-mutation\.lock/;

let serial = 0;
const sleeper = (): string => `sleep 43.${process.pid % 1000}${serial++}`;
const onReverted = (then: string): string => `echo run >> "$1"\ngrep -q new src/a.ts || { ${then}; }\n`;
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

/** A lock in the sandbox's git directory as a run writes one, with these fields over it. */
function writeLock(r: { root: string }, fields: Record<string, unknown>): string {
  const run = "20260101T000000Z-1-abcd";
  const head = git(r.root, "rev-parse", "HEAD");
  const lock = {
    v: 1, run, pid: spawnSync("true").pid, host: hostname(), boot: bootTime(), pidns: pidNamespace(), startedAt: "2026-01-01T00:00:00.000Z",
    cli: CLI, root: r.root, rootFromTop: ".", head, start: head, branch: null, entries: [], createdDirs: [], removedDirs: [], ...fields,
  };
  const file = join(git(r.root, "rev-parse", "--absolute-git-dir"), "mstack-mutation.lock");
  writeFileSync(file, `${JSON.stringify(lock, null, 2)}\n`);
  return file;
}

// bun ignores the `skip` option of node:test, so the function is chosen; a read-only directory stops nobody running as root.
const userTest = process.getuid?.() === 0 ? test.skip : test;

test("R1 neither flag, or both", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    for (const args of [["verify"], ["verify", "--mutation", "--restore"]]) {
      const ran = cli(r.root, args);
      assert.equal(ran.code, 2, ran.all);
      assert.match(ran.all, /--mutation/);
      assert.match(ran.all, /--restore/);
    }
    assert.equal(existsSync(lockFileOf(r)), false);
    assert.equal(existsSync(join(gitDirOf(r), "mstack-mutation")), false);
    assert.equal(git(r.root, "status", "--porcelain", "--", "src"), "");
  });
});

test("R1 --timeout must be an integer from 1 to 2147483", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    for (const bad of ["0", "2147484", "1.5", "x", "", "-1"]) {
      const ran = cli(r.root, ["verify", "--mutation", `--timeout=${bad}`]);
      assert.equal(ran.code, 2, ran.all);
      assert.match(ran.all, /--timeout must be an integer from 1 to 2147483/, `--timeout=${bad}`);
    }
    const restore = cli(r.root, ["verify", "--restore", "--timeout", "5"]);
    assert.equal(restore.code, 2, restore.all);
    assert.match(restore.all, /--timeout/);
    // The largest is taken: the run goes on to the store, which has no active item.
    r.box.writeState(state([item({ status: "pending", base: r.start })], { verify: r.command }));
    const top = cli(r.root, ["verify", "--mutation", "--timeout", "2147483"]);
    assert.equal(top.code, 2, top.all);
    assert.match(top.all, /no active item/);
    assert.doesNotMatch(top.all, /--timeout/);
  });
});

test("R25 the run prints the lock and the absolute restore command before reverting", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const ran = cli(r.root, ["verify", "--mutation"]);
    assert.equal(ran.code, 0, ran.all);
    const lines = ran.out.split("\n");
    const at = (re: RegExp): number => {
      const i = lines.findIndex((l) => re.test(l));
      assert.ok(i >= 0, `no line matches ${re}:\n${ran.out}`);
      return i;
    };
    const reverting = at(/^mutation: reverting 1 file\(s\)$/);
    assert.ok(at(new RegExp(`^mutation: lock ${gitDirOf(r).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/mstack-mutation\\.lock, run `)) < reverting, ran.out);
    const restore = at(/verify --restore/);
    assert.ok(restore < reverting, ran.out);
    assert.ok(lines[restore]?.includes(`${shellWord(CLI)} verify --restore`), lines[restore]);
    assert.ok(CLI.startsWith("/"));
    assert.ok(at(/a save in the moment one is put back is lost/) < reverting, ran.out);
    assert.equal(lines.filter((l) => SH_LOCK.test(l)).length, 0, ran.out);
  });
});

test("R25 no output names sh with the lock", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const outputs: string[] = [cli(r.root, ["verify", "--mutation"]).all];
    writeLock(r, {});
    outputs.push(cli(r.root, ["verify", "--mutation"]).all);
    outputs.push(cli(r.root, ["verify", "--restore"]).all);
    writeFileSync(lockFileOf(r), "garbage");
    outputs.push(cli(r.root, ["verify", "--mutation"]).all);
    outputs.push(cli(r.root, ["verify", "--restore"]).all);
    for (const text of outputs) {
      assert.match(text, /^mutation(: |-killed: )/m, "the output is not the mutation command's, so it proves nothing");
      for (const line of text.split("\n")) assert.doesNotMatch(line, SH_LOCK);
    }
  });
});

test("R22 restore with no lock exits 0", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const listing = (): string[] =>
      (readdirSync(gitDirOf(r), { recursive: true }) as string[]).sort().map((p) => {
        const st = statSync(join(gitDirOf(r), p));
        return `${p} ${st.size} ${st.mtimeMs}`;
      });
    const before = { tree: status(r.root), git: listing() };
    const ran = cli(r.root, ["verify", "--restore"]);
    assert.equal(ran.code, 0, ran.all);
    assert.match(ran.out, /nothing to restore/);
    assert.deepEqual({ tree: status(r.root), git: listing() }, before);
  });
});

test("R22 kill -9 mid-run, then verify --restore", SPAWN_TEST, async () => {
  const marker = sleeper();
  await withRunRepo(onReverted(marker), startA, editA, async (r) => {
    const before = tree(r);
    const run = live(r.root, ["verify", "--mutation"]);
    try {
      assert.ok(await until(() => survivors(marker).length > 0, SIGNAL_MS), `the check never ran on the reverted tree: ${run.output()}`);
      assert.notEqual(tree(r), before, "the tree is not reverted");
      process.kill(run.pid, "SIGKILL");
      assert.equal(await run.exited, "SIGKILL");
      assert.ok(await until(() => survivors(marker).length === 0, 5000), "the check outlived the killed run");
    } finally {
      run.dispose();
      killAll(marker);
    }
    assert.equal(existsSync(lockFileOf(r)), true, "the killed run left no lock");
    const restore = cli(r.root, ["verify", "--restore"]);
    assert.equal(restore.code, 0, restore.all);
    assert.match(restore.out, /not running/);
    assert.match(restore.out, /restored 1, tree verified, lock removed/);
    assert.equal(tree(r), before);
    assert.equal(existsSync(lockFileOf(r)), false);
    assert.deepEqual(mutationRows(r), []);
  });
});

test("R23 restore refuses a live run, and --force is not an option", SPAWN_TEST, async () => {
  const marker = sleeper();
  await withRunRepo(onReverted(marker), startA, editA, async (r) => {
    const before = tree(r);
    const run = live(r.root, ["verify", "--mutation"]);
    try {
      assert.ok(await until(() => survivors(marker).length > 0, SIGNAL_MS), `the check never ran on the reverted tree: ${run.output()}`);
      const during = tree(r);
      const lock = readFileSync(lockFileOf(r), "utf8");
      const refused = cli(r.root, ["verify", "--restore"]);
      assert.equal(refused.code, 2, refused.all);
      assert.match(refused.all, new RegExp(`pid ${run.pid}\\b`));
      assert.ok(refused.all.includes(hostname()), refused.all);
      assert.match(refused.all, /running/);
      const force = cli(r.root, ["verify", "--restore", "--force"]);
      assert.equal(force.code, 2, force.all);
      assert.match(force.all, /--force/);
      assert.equal(tree(r), during, "a refused restore changed the tree");
      assert.equal(readFileSync(lockFileOf(r), "utf8"), lock);
      process.kill(run.pid, "SIGTERM");
      assert.equal(await run.exited, 143, run.output());
    } finally {
      run.dispose();
      killAll(marker);
    }
    assert.equal(tree(r), before);
    assert.equal(existsSync(lockFileOf(r)), false);
  });
});

test("R24 restore refuses a lock with a path outside the root", SPAWN_TEST, () => {
  // The store is in a subdirectory, so that `../outside.txt` is still in the sandbox.
  const box = sandbox();
  try {
    const top = box.store.root;
    const app = join(top, "app");
    mkdirSync(app);
    captured(() => setup(app));
    put(top, "outside.txt", "outside\n");
    commitAll(top, "a store in app/");
    const sha = createHash("sha256").update("outside\n").digest("hex");
    const run = "20260101T000000Z-1-abcd";
    const file = writeLock({ root: top }, { root: app, rootFromTop: "app", entries: [{ n: 0, path: "../outside.txt", start: null, head: { sha256: sha, bits: 0o644 }, tmp: `.mstack-mutation-${run}-0.` }] });
    const lock = readFileSync(file, "utf8");
    const ran = cli(app, ["verify", "--restore"]);
    assert.equal(ran.code, 2, ran.all);
    assert.match(ran.all, /\.\.\/outside\.txt/);
    assert.equal(readFileSync(join(top, "outside.txt"), "utf8"), "outside\n");
    assert.equal(readFileSync(file, "utf8"), lock);
  } finally {
    box.dispose();
  }
});

test("R24 restore refuses a lock that cannot be parsed and names git stash", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    writeFileSync(lockFileOf(r), "garbage");
    const before = status(r.root);
    const ran = cli(r.root, ["verify", "--restore"]);
    assert.equal(ran.code, 2, ran.all);
    assert.match(ran.all, /git stash push --include-untracked'? saves every change and discards nothing/);
    assert.equal(status(r.root), before);
    assert.equal(readFileSync(lockFileOf(r), "utf8"), "garbage");
  });
});

userTest("R15 exit 3 when the restore fails, over every other code", SPAWN_TEST, async () => {
  // Killed on the reverted tree (exit 0 on its own), and the command makes src/ read-only on its way out.
  await withRunRepo(onReverted("chmod 0555 src; exit 1"), startA, editA, async (r) => {
    const before = tree(r);
    try {
      const ran = cli(r.root, ["verify", "--mutation"]);
      assert.equal(ran.code, 3, ran.all);
      assert.match(ran.out, /src\/a\.ts/);
      assert.match(ran.out, /EACCES/);
      assert.ok(ran.out.includes(`${shellWord(CLI)} verify --restore`), ran.out);
      assert.equal(existsSync(lockFileOf(r)), true);
      assert.deepEqual(mutationRows(r), []);
    } finally {
      chmodSync(join(r.root, "src"), 0o755);
    }
    const restore = cli(r.root, ["verify", "--restore"]);
    assert.equal(restore.code, 0, restore.all);
    assert.equal(tree(r), before);
    assert.equal(existsSync(lockFileOf(r)), false);
  });
});

test("R5 the CLI refuses to revert its own source", SPAWN_TEST, () => {
  const box = sandbox();
  try {
    const root = box.store.root;
    const checkout = join(dirname(CLI), "..");
    for (const part of ["bin", "src", "package.json"]) cpSync(join(checkout, part), join(root, part), { recursive: true });
    const start = commitAll(root, "a copy of the CLI");
    writeFileSync(join(root, "src", "run-helper.mjs"), `${readFileSync(join(root, "src", "run-helper.mjs"), "utf8")}// the item's change\n`);
    commitAll(root, "the item");
    box.writeState(state([item({ status: "in_progress", base: start })], { verify: "true" }));
    const helper = readFileSync(join(root, "src", "run-helper.mjs"), "utf8");
    const ran = cli(root, ["verify", "--mutation"], join(root, "bin", "mstack"));
    assert.equal(ran.code, 2, ran.all);
    assert.match(ran.all, /src\/run-helper\.mjs/);
    assert.match(ran.all, /git worktree add --detach/);
    assert.equal(readFileSync(join(root, "src", "run-helper.mjs"), "utf8"), helper);
    assert.equal(existsSync(join(git(root, "rev-parse", "--absolute-git-dir"), "mstack-mutation.lock")), false);
    assert.equal(existsSync(join(git(root, "rev-parse", "--absolute-git-dir"), "mstack-mutation")), false);
  } finally {
    box.dispose();
  }
});

test("R23 restore refuses a lock from another host, naming it and the by-hand recovery", SPAWN_TEST, async () => {
  await withRunRepo(CHECK, startA, editA, async (r) => {
    const file = writeLock(r, { host: "another-host.example" });
    const lock = readFileSync(file, "utf8");
    const before = status(r.root);
    const ran = cli(r.root, ["verify", "--restore"]);
    assert.equal(ran.code, 2, ran.all);
    assert.match(ran.all, /another-host\.example/);
    assert.match(ran.all, /cannot be told/);
    assert.match(ran.all, /git stash push --include-untracked/);
    assert.equal(readFileSync(file, "utf8"), lock);
    assert.equal(status(r.root), before);
  });
});
