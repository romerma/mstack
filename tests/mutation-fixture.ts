import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { revertSet, type RevertSet } from "../src/mutation.ts";
import { acquireLock, prepareRun, type Lock } from "../src/mutation-lock.ts";
import { runMutation } from "../src/mutation-run.ts";
import type { Store } from "../src/paths.ts";
import { item, sandbox, state, type Sandbox } from "./helpers.ts";

/**
 * What the tests of item 42's group 2 share: a throwaway repository with a
 * start commit and an item commit, the staged run and the lock taken on it,
 * and a holder process stopped at a named step. Every repository is a
 * `sandbox()`; nothing here touches the checkout the suite runs from.
 */

export const RUNTIME_FLAGS = typeof (globalThis as { Bun?: unknown }).Bun === "undefined"
  ? ["--experimental-strip-types", "--disable-warning=ExperimentalWarning"]
  : [];
/** Above the holders' own deadlines, so a stuck holder fails its test instead of the suite. */
export const SPAWN_TEST = { timeout: 90_000 };
/** How long a positive signal (a journal line, an exit) is waited for; load cannot eat it. */
export const SIGNAL_MS = 20_000;

/** A file written as `probe` is found as `PROBE`: the filesystem folds case. */
export const caseInsensitive = ((): boolean => {
  const dir = mkdtempSync(join(tmpdir(), "mstack-case-"));
  try {
    writeFileSync(join(dir, "probe"), "");
    return existsSync(join(dir, "PROBE"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
})();
// bun ignores the `skip` option of node:test, so choose the function at definition time
export const caseTest = caseInsensitive ? test : test.skip;

/** git with no optional locks, so a status taken to compare does not rewrite the index. */
const gitEnv = (): NodeJS.ProcessEnv => ({ ...process.env, GIT_OPTIONAL_LOCKS: "0" });

export const git = (root: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", env: gitEnv() }).trim();

/** `git status --porcelain`, every untracked file listed, as git printed it. */
export const status = (root: string): string =>
  execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: root, encoding: "utf8", env: gitEnv() });

/** The index as entries (mode, blob, stage, path): what `git diff --cached` compares, without the stat cache. */
export const indexEntries = (root: string): string =>
  execFileSync("git", ["ls-files", "--stage"], { cwd: root, encoding: "utf8", env: gitEnv() });

export function put(root: string, rel: string, content: string | Buffer, mode?: number): void {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  if (mode !== undefined) chmodSync(file, mode);
}

export function commitAll(root: string, message: string): string {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
  return git(root, "rev-parse", "HEAD");
}

export interface Repo {
  readonly box: Sandbox;
  readonly root: string;
  readonly store: Store;
  /** The start commit: the item's base. */
  readonly start: string;
}

/**
 * A sandbox whose first commit (the start) holds what `atStart` writes and
 * whose second (the item) is what `change` does. The store's state then has
 * the item in progress with the start as its base and `true` as the project's
 * verification, which is what `refusals` and the holder read.
 */
export function makeRepo(atStart: (root: string) => void, change: (root: string) => void): Repo {
  const box = sandbox();
  const root = box.store.root;
  try {
    atStart(root);
    const start = commitAll(root, "start");
    change(root);
    commitAll(root, "the item");
    box.writeState(state([item({ status: "in_progress", base: start })], { verify: "true" }));
    return { box, root, store: box.store, start };
  } catch (error) {
    box.dispose();
    throw error;
  }
}

export function withRepo(atStart: (root: string) => void, change: (root: string) => void, body: (r: Repo) => void): void {
  const r = makeRepo(atStart, change);
  try {
    body(r);
  } finally {
    r.box.dispose();
  }
}

export async function withRepoAsync(
  atStart: (root: string) => void,
  change: (root: string) => void,
  body: (r: Repo) => Promise<void>,
): Promise<void> {
  const r = makeRepo(atStart, change);
  try {
    await body(r);
  } finally {
    r.box.dispose();
  }
}

export function setOf(r: Repo): RevertSet {
  const set = revertSet(r.store, r.start);
  assert.ok(set !== null, "git could not list the revert set");
  return set;
}

/** The run staged in the git directory, no lock taken. */
export function staged(r: Repo): Lock {
  const prepared = prepareRun(r.store, r.start, setOf(r));
  assert.ok(prepared.ok, `prepareRun refused: ${prepared.ok ? "" : prepared.reason}`);
  return prepared.lock;
}

/** The run staged and the lock taken. */
export function locked(r: Repo): Lock {
  const lock = staged(r);
  const got = acquireLock(r.store, lock);
  assert.ok(got.ok, `acquireLock refused: ${got.ok ? "" : got.reason}`);
  return lock;
}

export const gitDirOf = (r: Repo): string => git(r.root, "rev-parse", "--absolute-git-dir");
export const lockFileOf = (r: Repo): string => join(gitDirOf(r), "mstack-mutation.lock");
export const runDirOf = (r: Repo, lock: Lock): string => join(gitDirOf(r), "mstack-mutation", lock.run);

export async function until(condition: () => boolean, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (condition()) return true;
    await new Promise((res) => setTimeout(res, 10));
  }
  return condition();
}

const HOLDER = join(dirname(fileURLToPath(import.meta.url)), "mutation-holder.ts");

export interface Holder {
  readonly child: ChildProcess;
  readonly pid: number;
  /** The exit code, or the signal's name when it was killed. */
  readonly exited: Promise<number | string | null>;
  readonly dir: string;
  journal(): string;
  release(): void;
  /** SIGKILL to the holder's whole group: it leads one, so this test runner is not in it. */
  kill(): void;
  dispose(): void;
}

/**
 * `tests/mutation-holder.ts` on the store at `root`, in a group of its own,
 * journalling every step and stopped at `blockAt` until `release()`. Holders
 * given the same `release` file are let go together.
 */
export function hold(root: string, phase: string, blockAt: string, options: { release?: string; extra?: string[] } = {}): Holder {
  const dir = mkdtempSync(join(tmpdir(), "mstack-holder-"));
  const journal = join(dir, "journal");
  writeFileSync(journal, "");
  const release = options.release ?? join(dir, "release");
  const child = spawn(process.execPath, [...RUNTIME_FLAGS, HOLDER, root, journal, phase, blockAt, release, ...(options.extra ?? [])], {
    detached: true,
    stdio: "ignore",
  });
  const pid = child.pid as number;
  const exited = new Promise<number | string | null>((res) => child.on("close", (code, signal) => res(code ?? signal)));
  const kill = (): void => {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // The group is already gone.
    }
  };
  return {
    child,
    pid,
    exited,
    dir,
    journal: () => readFileSync(journal, "utf8"),
    release: () => writeFileSync(release, ""),
    kill,
    dispose() {
      kill();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Item 42, group 3: a repository whose project verification is the shell
 * script `tests/check.sh` (a test path, so never reverted), given a log file
 * outside the repository as its argument, so that what it writes never enters
 * the key. `atStart` and `change` write the code; the script is committed at
 * the start.
 */
export interface RunRepo extends Repo {
  /** One line per run of the script, appended by the script itself when it starts with `echo run >> "$1"`. */
  readonly log: string;
  /** A directory outside the repository for the test's own files. */
  readonly scratch: string;
  readonly command: string;
}

export function makeRunRepo(script: string, atStart: (root: string) => void, change: (root: string) => void): RunRepo {
  const scratch = mkdtempSync(join(tmpdir(), "mstack-run-scratch-"));
  const log = join(scratch, "log");
  const command = `sh tests/check.sh '${log}'`;
  try {
    const r = makeRepo((root) => {
      atStart(root);
      put(root, "tests/check.sh", script);
    }, change);
    r.box.writeState(state([item({ status: "in_progress", base: r.start })], { verify: command }));
    return { ...r, log, scratch, command };
  } catch (error) {
    rmSync(scratch, { recursive: true, force: true });
    throw error;
  }
}

export async function withRunRepo(
  script: string,
  atStart: (root: string) => void,
  change: (root: string) => void,
  body: (r: RunRepo) => Promise<void>,
): Promise<void> {
  const r = makeRunRepo(script, atStart, change);
  try {
    await body(r);
  } finally {
    r.box.dispose();
    rmSync(r.scratch, { recursive: true, force: true });
  }
}

/** How many times the check script ran. */
export const runs = (r: RunRepo): number => (existsSync(r.log) ? readFileSync(r.log, "utf8").split("\n").filter((l) => l !== "").length : 0);

const CHECKOUT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));

/** A run's store is a sandbox, never this checkout or anything under it. */
export function outsideCheckout(root: string): void {
  const real = realpathSync(root);
  assert.ok(real !== CHECKOUT && !real.startsWith(`${CHECKOUT}${sep}`), `the sandbox ${real} is inside the checkout`);
}

export interface Mutated {
  readonly code: number;
  readonly lines: readonly string[];
  readonly text: string;
  /** The final line. */
  readonly last: string;
}

/** `runMutation` in this process on the sandbox, its lines collected. */
export async function mutate(r: RunRepo, options: { timeoutMs?: number; step?: (name: string) => void } = {}): Promise<Mutated> {
  outsideCheckout(r.root);
  const lines: string[] = [];
  const code = await runMutation(r.store, {
    timeoutMs: options.timeoutMs ?? 60_000,
    out: (line) => lines.push(line),
    ...(options.step === undefined ? {} : { step: options.step }),
  });
  return { code, lines, text: lines.join("\n"), last: lines[lines.length - 1] ?? "" };
}

/** A step callback that runs `act` once, at the first step named `at`. */
export function once(at: string, act: () => void): (name: string) => void {
  let done = false;
  return (name) => {
    if (done || name !== at) return;
    done = true;
    act();
  };
}
