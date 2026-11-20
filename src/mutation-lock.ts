import { spawnSync } from "node:child_process";
import { createHash, randomBytes, type Hash } from "node:crypto";
import {
  accessSync, closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync,
  readlinkSync, readSync, rmdirSync, rmSync, statSync, unlinkSync, writeSync,
} from "node:fs";
import { hostname, uptime } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { git, gitToFile } from "./git.ts";
import type { RevertSet } from "./mutation.ts";
import { findStore, runningCliRoot, type Store } from "./paths.ts";

/**
 * The run's staging, its lock, and whether the run that wrote a lock is alive
 * (item 42, `.mstack/specs/mutation-check/design.md`, "The lock and the run
 * directory" and "Is the run alive"). Everything here writes inside the git
 * directory only: the run directory `<git dir>/mstack-mutation/<run>/` and the
 * lock `<git dir>/mstack-mutation.lock`. The working tree is read, never
 * written.
 */

/** A regular file's SHA-256 and permission bits (`st_mode & 0o7777`); null is absent. */
export type Identity = { readonly sha256: string; readonly bits: number } | null;

export interface LockEntry {
  /** The entry's number: its staged files are `start/<n>` and `head/<n>`. */
  readonly n: number;
  /** Relative to the store's root. */
  readonly path: string;
  /** S(p): what the revert writes. */
  readonly start: Identity;
  /** H(p): what the restore writes back, taken from the staged copy. */
  readonly head: Identity;
  /** `.mstack-mutation-<run>-<n>.`; a writer appends its pid and `.tmp`. */
  readonly tmp: string;
}

export interface Lock {
  readonly v: 1;
  readonly run: string;
  readonly pid: number;
  readonly host: string;
  /** Seconds since the epoch at which this host booted, to the second. */
  readonly boot: number;
  /** `readlink /proc/self/ns/pid`; null where there is no `/proc`. */
  readonly pidns: string | null;
  readonly startedAt: string;
  /** The absolute path of the `bin/mstack` that wrote the lock. */
  readonly cli: string;
  readonly root: string;
  /**
   * The store's root relative to the worktree's top level, `.` at the top. Two
   * stores of one worktree share its git directory and so one lock; this says
   * whose it is, and it holds when the checkout is moved, which `root` does not.
   */
  readonly rootFromTop: string;
  readonly head: string;
  readonly start: string;
  /** The branch HEAD was on; null when it was detached. */
  readonly branch: string | null;
  readonly entries: readonly LockEntry[];
  /** Parents of start-only paths that were absent: the revert makes them. Shallowest first. */
  readonly createdDirs: readonly string[];
  /** Parents of HEAD-only paths that the start lacks: the revert removes them when empty. Deepest first. */
  readonly removedDirs: readonly string[];
}

export const LOCK_NAME = "mstack-mutation.lock";
const RUNS = "mstack-mutation";
const ABSENT = "000000";
/** `--filters` may fetch a Git LFS object over the network. */
const STAGE_TIMEOUT_MS = 60_000;
const RUN_ID = /^\d{8}T\d{6}Z-\d+-[0-9a-f]{4}$/;
const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
/** Never follow a symlink, and never block on a FIFO swapped in where a file was. */
export const READ_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;

const gitDirs = new Map<string, string>();

/**
 * `git rev-parse --absolute-git-dir` at the store's root, asked once per root.
 * The revert and the restore run no child process (R17), so they read the
 * answer an earlier call left here: `prepareRun` in a run, `readLock` in a
 * `verify --restore`.
 */
export function gitDirOf(store: Store): string | null {
  const known = gitDirs.get(store.root);
  if (known !== undefined) return known;
  const dir = git(store, ["rev-parse", "--absolute-git-dir"]);
  if (dir === null || dir === "") return null;
  gitDirs.set(store.root, dir);
  return dir;
}

/** `<git dir>/mstack-mutation.lock`, the git dir being this worktree's own; null outside a repository. */
export function lockPath(store: Store): string | null {
  const dir = gitDirOf(store);
  return dir === null ? null : join(dir, LOCK_NAME);
}

/** Where a store's root is in its worktree. */
export interface Place {
  /** `git rev-parse --show-toplevel`: the worktree's top level, as git resolves it. */
  readonly top: string;
  /** The store's root relative to `top`, `.` at the top. */
  readonly rel: string;
}

/** Where the store's root is in its worktree; null when git cannot say. `fromCwd`: as git finds it from there alone. */
export function placeOf(store: Store, fromCwd = false): Place | null {
  const out = git(store, ["rev-parse", "--show-toplevel", "--show-prefix"], { raw: true, fromCwd });
  const [top, prefix] = out === null ? [] : out.split("\n");
  if (top === undefined || top === "" || prefix === undefined) return null;
  const rel = prefix.replace(/\/$/, "");
  return { top, rel: rel === "" ? "." : rel };
}

/**
 * A path as a shell word: bare when it is plain, else single-quoted. The one
 * quoting rule for every path a printed recovery line carries, the CLI's and
 * the `cd`'s included, so a line runs as printed (item 101); a plain path stays
 * bare, so a transcript of one does not change.
 */
export const shellWord = (p: string): string => (/^[\w./@%+=:,-]+$/.test(p) ? p : `'${p.replace(/'/g, "'\\''")}'`);

/** The directory of the store a lock names, in the worktree whose top level is `top`. */
export const lockStoreDir = (top: string, rootFromTop: string): string => (rootFromTop === "." ? top : join(top, rootFromTop));

/**
 * A restore line that runs as printed, with what a message says in front of the
 * way out that holds it (`Restore.lead`), or why there is none.
 */
export type RestoreLine = { readonly line: string; readonly lead: string } | { readonly none: string };

const storeName = (rel: string): string => (rel === "." ? "the worktree's top level" : rel);

/**
 * Where a directory is in its worktree, as git finds it from inside it alone
 * (`fromCwd`): the caller's `GIT_DIR` and `GIT_WORK_TREE` say where this store
 * is, not where another directory is. Null when git cannot say.
 */
function placeOfDir(dir: string): Place | null {
  return placeOf({ root: dir } as Store, true);
}

/**
 * Why the lock's `root` says it is another store's than the one at `dir`, which
 * `rootFromTop` names in the worktree whose top level is `top`; null when it
 * does not. The run writes both fields in one record, so they disagree only
 * after an edit, and the restore cannot tell which one is the run's (item 105,
 * A2). Only a `root` under `top`, as spelled, is asked about: one outside it,
 * as after the checkout was moved or copied, says nothing whatever that path
 * holds now, as before item 105 (R24; round 1 review, B1). Stores are compared,
 * not paths: the store a restore would find from `root` (`findStore`, which
 * reads the disk and no variable, and walks up from a file, a dangling link or
 * a FIFO as from a directory) disagrees only when it is another store of this
 * worktree than the one `rootFromTop` names, as git, run from that store's root
 * alone (`placeOfDir`), places it. A `root` in this store, or in no store, says
 * nothing: a checkout moved up into its parent's place leaves its old root at a
 * directory of the worktree, which is in no store unless one above it holds
 * that path (a store at the repository's top does, and that restore is still
 * refused; decision row 2026-11-20T05:23:35Z). So does a store git places in
 * another worktree, a repository nested in this one included. One `git
 * rev-parse`, and none while `root` is `dir`, as it is for every lock no one
 * edited.
 */
export function rootDisagrees(lock: Pick<Lock, "root" | "rootFromTop">, dir: string, top: string): string | null {
  if (lock.root === dir) return null;
  const inside = relative(top, lock.root);
  if (inside === ".." || inside.startsWith("../")) return null;
  const found = findStore(lock.root);
  if (found === null || found.root === dir) return null;
  const there = placeOfDir(found.root);
  if (there === null || there.top !== top || there.rel === lock.rootFromTop) return null;
  const is = found.root === resolve(lock.root) ? "is" : "is in";
  return `its root ${lock.root} ${is} the store at ${storeName(there.rel)} in this worktree, so the lock was edited and whose it is cannot be told`;
}

/**
 * `cd <the lock's store> && <the restore's command>`, when the restore run from
 * that directory takes the lock as its own store's: the store it finds there is
 * the one git names `rootFromTop` in the worktree whose top level is `top`, and
 * the lock's `root` does not name another (`rootDisagrees`). Otherwise why no
 * directory does. A `rootFromTop` that differs from git's spelling only in
 * case or Unicode form names, on a disk that folds them, this same store, whose
 * restore refuses the lock again, so a `cd` there would lead in a loop; on a
 * disk that does not fold them it names no directory, or another store. The
 * disk decides, through git, and nothing here folds a name (item 101, A3).
 */
export function inLockStore(restore: Restore, top: string, lock: Pick<Lock, "root" | "rootFromTop">): RestoreLine {
  const { rootFromTop } = lock;
  const dir = lockStoreDir(top, rootFromTop);
  const lead = `no verify --restore takes this lock: it names its store ${storeName(rootFromTop)}, and`;
  let isDirectory = false;
  try {
    isDirectory = statSync(dir).isDirectory();
  } catch {
    // Not there, or not readable: either way no `cd` to it runs.
  }
  if (!isDirectory) return { none: `${lead} there is no directory ${dir}` };
  const found = findStore(dir);
  const there = found === null ? null : placeOf(found);
  if (there === null || there.top !== top) return { none: `${lead} there is no store of this worktree at ${dir}` };
  if (there.rel === rootFromTop) {
    const disagrees = rootDisagrees(lock, dir, top);
    if (disagrees !== null) return { none: `${lead} ${disagrees}` };
    return { line: `cd ${shellWord(dir)} && ${restore.command}`, lead: restore.lead };
  }
  if (fold(there.rel) === fold(rootFromTop)) {
    return { none: `${lead} ${dir} is the store git spells ${storeName(there.rel)}, which differs only in case or Unicode form, so its restore refuses the lock too` };
  }
  return { none: `${lead} a restore run from ${dir} finds the store at ${storeName(there.rel)}, which refuses the lock too` };
}

/**
 * The restore's command run from the lock's store, when `place` is another
 * store of the worktree: two stores share the worktree's lock, and a restore
 * resolves the lock's paths against the root of the store it runs in (round 2
 * review, B3). In the lock's own store, the command as it is, unless the lock's
 * `root` names another store (`rootDisagrees`), whose restore refuses. When git
 * cannot say where this store is, the command as it is.
 */
export function fromLockStore(restore: Restore, lock: Pick<Lock, "root" | "rootFromTop">, place: Place | null): RestoreLine {
  if (place === null) return { line: restore.command, lead: restore.lead };
  if (lock.rootFromTop !== place.rel) return inLockStore(restore, place.top, lock);
  const disagrees = rootDisagrees(lock, lockStoreDir(place.top, place.rel), place.top);
  if (disagrees === null) return { line: restore.command, lead: restore.lead };
  return { none: `no verify --restore takes this lock: it names its store ${storeName(lock.rootFromTop)}, and ${disagrees}` };
}

/** `<git dir>/mstack-mutation/<run>/`; null outside a repository. */
export function runDirectory(store: Store, run: string): string | null {
  const dir = gitDirOf(store);
  return dir === null ? null : join(dir, RUNS, run);
}

/** The error's message, with its code in front when the message does not already carry it. */
export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return typeof code === "string" && !message.includes(code) ? `${code}: ${message}` : message;
}

const codeOf = (error: unknown): string | undefined => (error as NodeJS.ErrnoException | null)?.code;

function writeAll(fd: number, chunk: Buffer): void {
  let at = 0;
  while (at < chunk.length) at += writeSync(fd, chunk, at, chunk.length - at);
}

/** Copy `from` to `to` (when given) from their current offsets, feeding `hash` (when given); the bytes copied. */
export function pump(from: number, to: number | null, hash?: Hash): number {
  const buffer = Buffer.allocUnsafe(1 << 16);
  let total = 0;
  for (;;) {
    const n = readSync(from, buffer, 0, buffer.length, null);
    if (n === 0) return total;
    const chunk = buffer.subarray(0, n);
    hash?.update(chunk);
    if (to !== null) writeAll(to, chunk);
    total += n;
  }
}

/** fsync a directory, so a name made or removed in it survives a power cut. */
export function fsyncDirectory(dir: string): void {
  const fd = openSync(dir, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function sha256Of(file: string): string {
  const fd = openSync(file, READ_FLAGS);
  try {
    const hash = createHash("sha256");
    pump(fd, null, hash);
    return hash.digest("hex");
  } finally {
    closeSync(fd);
  }
}

/** `round(now - uptime)`: stable to the second while the clock is. */
export function bootTime(): number {
  return Math.round(Date.now() / 1000 - uptime());
}

export function pidNamespace(): string | null {
  try {
    return readlinkSync("/proc/self/ns/pid");
  } catch {
    return null;
  }
}

export type Prepared =
  | { readonly ok: true; readonly lock: Lock }
  | { readonly ok: false; readonly path: string | null; readonly reason: string };

/**
 * Stage the start's and HEAD's bytes of every path of the set in a new run
 * directory, and return the lock's record; nothing is written outside the git
 * directory. `start/<n>` is git's own checkout of the start's blob, streamed to
 * the file; `head/<n>` is a byte copy of p, and H(p) is taken from that copy (the
 * bytes copied, the bits of the descriptor they were read from), so an edit
 * after the copy fails the revert's check instead of being written over. Any
 * failure removes the run directory and names the path.
 */
export function prepareRun(store: Store, start: string, set: RevertSet): Prepared {
  const gitDir = gitDirOf(store);
  if (gitDir === null) return { ok: false, path: null, reason: "the store is not in a git repository" };
  const place = placeOf(store);
  if (place === null) return { ok: false, path: null, reason: "git could not say where the store is in its worktree" };
  const head = git(store, ["rev-parse", "--verify", "HEAD"]);
  if (head === null) return { ok: false, path: null, reason: "git could not read HEAD" };
  const branch = git(store, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const base = join(gitDir, RUNS);
  const made = makeRunDirectory(base);
  if ("reason" in made) return { ok: false, path: null, reason: made.reason };
  const { run, dir, at } = made;
  let current: string | null = null;
  try {
    mkdirSync(join(dir, "start"));
    mkdirSync(join(dir, "head"));
    const mask = process.umask();
    const entries: LockEntry[] = [];
    for (const [n, e] of set.entries.entries()) {
      current = e.path;
      let startId: Identity = null;
      if (e.startMode !== ABSENT) {
        const file = join(dir, "start", String(n));
        if (!stageStart(store, start, e.path, file)) {
          discard(store, run);
          return {
            ok: false,
            path: e.path,
            reason: `git could not write the start's content of ${e.path}: a smudge filter that cannot run, or a Git LFS object that is not here`,
          };
        }
        // git checks a file out with 0666 or 0777, masked by the umask.
        startId = { sha256: sha256Of(file), bits: (e.startMode === "100755" ? 0o777 : 0o666) & ~mask };
      }
      const headId = e.headMode === ABSENT ? null : copyOut(join(store.root, e.path), join(dir, "head", String(n)));
      entries.push({ n, path: e.path, start: startId, head: headId, tmp: `.mstack-mutation-${run}-${n}.` });
    }
    current = null;
    const createdDirs = absentParents(store.root, set);
    const removedDirs = parentsTheStartLacks(store, start, set);
    for (const d of [join(dir, "start"), join(dir, "head"), dir, base]) fsyncDirectory(d);
    return {
      ok: true,
      lock: {
        v: 1,
        run,
        pid: process.pid,
        host: hostname(),
        boot: bootTime(),
        pidns: pidNamespace(),
        startedAt: at.toISOString(),
        cli: join(runningCliRoot(), "bin", "mstack"),
        root: store.root,
        rootFromTop: place.rel,
        head,
        start,
        branch,
        entries,
        createdDirs,
        removedDirs,
      },
    };
  } catch (error) {
    discard(store, run);
    return { ok: false, path: current, reason: `${current === null ? "" : `${current}: `}${errorText(error)}` };
  }
}

/** A run directory made with a non-recursive mkdir, so it is new; EEXIST draws another id. */
function makeRunDirectory(base: string): { run: string; dir: string; at: Date } | { reason: string } {
  try {
    mkdirSync(base, { recursive: true });
  } catch (error) {
    return { reason: `could not make ${base}: ${errorText(error)}` };
  }
  for (let tries = 0; tries < 16; tries++) {
    const at = new Date();
    const run = `${at.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z-${process.pid}-${randomBytes(2).toString("hex")}`;
    try {
      mkdirSync(join(base, run));
      return { run, dir: join(base, run), at };
    } catch (error) {
      if (codeOf(error) !== "EEXIST") return { reason: `could not make a run directory in ${base}: ${errorText(error)}` };
    }
  }
  return { reason: `could not make a run directory in ${base}: every name drawn exists` };
}

/**
 * Remove a run's directory, and `mstack-mutation/` when no other run's is in
 * it: what a run leaves when its staging fails or it is refused the lock. For
 * a run that holds no lock.
 */
export function discard(store: Store, run: string): void {
  const gitDir = gitDirOf(store);
  if (gitDir === null) return;
  rmSync(join(gitDir, RUNS, run), { recursive: true, force: true });
  try {
    rmdirSync(join(gitDir, RUNS));
  } catch {
    // Other runs' directories are in it.
  }
}

function stageStart(store: Store, start: string, path: string, file: string): boolean {
  const fd = openSync(file, "wx", 0o600);
  try {
    const ok = gitToFile(store, ["cat-file", "--filters", `${start}:./${path}`], fd, STAGE_TIMEOUT_MS);
    if (ok) fsyncSync(fd);
    return ok;
  } finally {
    closeSync(fd);
  }
}

/** Copy the regular file `source` to a new `target`; its identity is what was copied. */
function copyOut(source: string, target: string): Identity {
  const from = openSync(source, READ_FLAGS);
  try {
    const st = fstatSync(from);
    if (!st.isFile()) throw new Error(`${source} is not a regular file`);
    const to = openSync(target, "wx", 0o600);
    try {
      const hash = createHash("sha256");
      pump(from, to, hash);
      fsyncSync(to);
      return { sha256: hash.digest("hex"), bits: st.mode & 0o7777 };
    } finally {
      closeSync(to);
    }
  } finally {
    closeSync(from);
  }
}

const depth = (p: string): number => p.split("/").length;

function parentsOf(path: string): string[] {
  const parts = path.split("/");
  return parts.slice(1).map((_, i) => parts.slice(0, i + 1).join("/"));
}

/** Parents of start-only paths with nothing at them now, shallowest first. */
function absentParents(root: string, set: RevertSet): string[] {
  const dirs = new Set<string>();
  for (const e of set.entries) {
    if (e.startMode === ABSENT || e.headMode !== ABSENT) continue;
    for (const d of parentsOf(e.path)) {
      try {
        lstatSync(join(root, d));
      } catch (error) {
        const code = codeOf(error);
        if (code === "ENOENT" || code === "ENOTDIR") dirs.add(d);
      }
    }
  }
  return [...dirs].sort((a, b) => depth(a) - depth(b) || (a < b ? -1 : 1));
}

/** Parents of HEAD-only paths that are not a tree at the start, deepest first. */
function parentsTheStartLacks(store: Store, start: string, set: RevertSet): string[] {
  const dirs = new Set<string>();
  for (const e of set.entries) if (e.startMode === ABSENT) for (const d of parentsOf(e.path)) dirs.add(d);
  return [...dirs]
    .filter((d) => git(store, ["cat-file", "-t", `${start}:./${d}`]) !== "tree")
    .sort((a, b) => depth(b) - depth(a) || (a < b ? -1 : 1));
}

export type Acquired = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Take the lock: a complete temporary file in the git directory, fsynced, then
 * linked to the lock's name, which fails with EEXIST when a lock exists, then
 * the directory fsynced. A reader sees no lock or a whole one.
 */
export function acquireLock(store: Store, lock: Lock): Acquired {
  const gitDir = gitDirOf(store);
  if (gitDir === null) return { ok: false, reason: "the store is not in a git repository" };
  const final = join(gitDir, LOCK_NAME);
  const tmp = join(gitDir, `${LOCK_NAME}.${lock.run}.tmp`);
  try {
    // The run id is this run's own: a temp file with its name is this run's leftover.
    rmSync(tmp, { force: true });
    const fd = openSync(tmp, "wx", 0o644);
    try {
      writeAll(fd, Buffer.from(`${JSON.stringify(lock, null, 2)}\n`));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    rmSync(tmp, { force: true });
    return { ok: false, reason: `could not write ${tmp}: ${errorText(error)}` };
  }
  try {
    linkSync(tmp, final);
  } catch (error) {
    rmSync(tmp, { force: true });
    // EEXIST, or ENOENT when the run that won swept this temp file before the
    // link: either way a lock exists, and the refusal names whose it is.
    const held = readLock(store);
    if (held === null) return { ok: false, reason: `could not link ${final}: ${errorText(error)}` };
    const whose = "lock" in held ? `: pid ${String(held.lock.pid)}, run ${String(held.lock.run)}` : "";
    return { ok: false, reason: `the lock ${final} exists${whose}` };
  }
  try {
    fsyncDirectory(gitDir);
    unlinkSync(tmp);
  } catch {
    // The lock is linked; a temp file left is swept by the next run.
  }
  return { ok: true };
}

/** No lock (null), a JSON object (`lock`, not yet checked: `validateLock`), or one that cannot be read as one. */
export type LockRead = null | { readonly lock: Lock } | { readonly damaged: string };

/** The store's lock as it is on disk (`readLockAt`); null outside a repository. */
export function readLock(store: Store): LockRead {
  const file = lockPath(store);
  return file === null ? null : readLockAt(file);
}

/**
 * The lock at `file` as it is on disk. Whatever is at the name is a lock: it is
 * opened with `READ_FLAGS`, so a symlink there is not followed and a FIFO does
 * not block, and anything that is not a regular file is damaged. The one reader
 * of a lock: the gate, R1, the restore and the hook all read through it, so none
 * names a restore for a lock the others call unreadable (item 101, round 1
 * review, B2).
 */
export function readLockAt(file: string): LockRead {
  let fd: number;
  try {
    fd = openSync(file, READ_FLAGS);
  } catch (error) {
    if (codeOf(error) === "ENOENT") return null;
    return { damaged: `the lock ${file} cannot be read: ${errorText(error)}` };
  }
  let text: string;
  try {
    if (!fstatSync(fd).isFile()) return { damaged: `the lock ${file} is not a regular file` };
    text = readFileSync(fd, "utf8");
  } catch (error) {
    return { damaged: `the lock ${file} cannot be read: ${errorText(error)}` };
  } finally {
    closeSync(fd);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { damaged: `the lock ${file} is not JSON: ${errorText(error)}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { damaged: `the lock ${file} is not a run's record` };
  return { lock: parsed as Lock };
}

/**
 * Two spellings the filesystem may treat as one name fold equal: case, and
 * Unicode normalisation. The first `toLowerCase` joins `ẞ` (U+1E9E) with `ss`,
 * which upper-then-lower case alone keeps apart. R3 groups the revert set by
 * it, and `validateLock` finds a path that appears twice by it.
 */
export function fold(s: string): string {
  return s.normalize("NFD").toLowerCase().toUpperCase().toLowerCase().normalize("NFC");
}

/** Why `path` cannot be a path of the lock, or null. */
function badPath(path: unknown): string | null {
  if (typeof path !== "string") return "is not a string";
  if (path === "") return "is empty";
  if (path.startsWith("/")) return "is absolute";
  if (path.includes("\0")) return "holds a NUL";
  for (const segment of path.split("/")) {
    if (segment === "") return "has an empty segment";
    if (segment === "." || segment === "..") return `has a ${segment} segment`;
    // `.GIT` is `.git` on a filesystem that folds case.
    if (segment.toLowerCase() === ".git") return "has a .git segment";
  }
  return null;
}

function isIdentity(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v["sha256"] === "string" && /^[0-9a-f]{64}$/.test(v["sha256"]) && Number.isInteger(v["bits"]) && (v["bits"] as number) >= 0 && (v["bits"] as number) <= 0o7777;
}

/**
 * R24: what is wrong with a lock before a restore trusts it, or nothing. Every
 * path is relative to the store's root with no empty, `.`, `..` or `.git`
 * segment and appears once; every temp prefix is the one the run derives.
 */
export function validateLock(value: unknown): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return ["the lock is not a JSON object"];
  const l = value as Record<string, unknown>;
  const problems: string[] = [];
  if (l["v"] !== 1) problems.push(`the lock's version is ${JSON.stringify(l["v"])}, not 1`);
  const run = l["run"];
  if (typeof run !== "string" || !RUN_ID.test(run)) problems.push(`its run id ${JSON.stringify(run)} is not one a run writes`);
  if (!Number.isInteger(l["pid"]) || (l["pid"] as number) <= 0) problems.push(`its pid ${JSON.stringify(l["pid"])} is not a process id`);
  for (const key of ["host", "startedAt", "cli", "root"]) if (typeof l[key] !== "string") problems.push(`its ${key} is not a string`);
  // Which store of the worktree wrote it: without it, the lock's paths could be resolved against another store's root.
  const rel = l["rootFromTop"];
  if (rel === undefined) problems.push("it does not say which store of the worktree wrote it: it has no rootFromTop, the store's root relative to the worktree's top level");
  else if (typeof rel !== "string") problems.push("its rootFromTop is not a string");
  else if (rel !== ".") {
    const bad = badPath(rel);
    if (bad !== null) problems.push(`its rootFromTop ${JSON.stringify(rel)} ${bad}`);
  }
  if (typeof l["boot"] !== "number" || !Number.isFinite(l["boot"])) problems.push("its boot time is not a number");
  for (const key of ["pidns", "branch"]) if (l[key] !== null && typeof l[key] !== "string") problems.push(`its ${key} is neither a string nor null`);
  for (const key of ["head", "start"]) if (typeof l[key] !== "string" || !SHA.test(l[key] as string)) problems.push(`its ${key} is not a commit id`);
  const entries = l["entries"];
  if (!Array.isArray(entries)) problems.push("its entries are not a list");
  else {
    // By the folded name: two spellings of one path on a filesystem that folds them are one path.
    const seen = new Map<string, string>();
    entries.forEach((raw: unknown, i) => {
      if (raw === null || typeof raw !== "object") {
        problems.push(`entry ${i} is not an object`);
        return;
      }
      const e = raw as Record<string, unknown>;
      if (e["n"] !== i) problems.push(`entry ${i} is numbered ${JSON.stringify(e["n"])}`);
      const bad = badPath(e["path"]);
      const path = e["path"] as string;
      const first = bad === null ? seen.get(fold(path)) : undefined;
      if (bad !== null) problems.push(`entry ${i}: the path ${JSON.stringify(e["path"])} ${bad}`);
      else if (first !== undefined) problems.push(`entry ${i}: the path ${JSON.stringify(path)} appears twice${first === path ? "" : `, as ${JSON.stringify(first)}`}`);
      else seen.set(fold(path), path);
      if (!isIdentity(e["start"]) || !isIdentity(e["head"])) problems.push(`entry ${i}: an identity is neither null nor a SHA-256 and permission bits`);
      else if (e["start"] === null && e["head"] === null) problems.push(`entry ${i}: absent at the start and at HEAD`);
      if (typeof run === "string" && e["tmp"] !== `.mstack-mutation-${run}-${i}.`) problems.push(`entry ${i}: its temp prefix ${JSON.stringify(e["tmp"])} is not the one its run derives`);
    });
  }
  for (const key of ["createdDirs", "removedDirs"]) {
    const dirs = l[key];
    if (!Array.isArray(dirs)) {
      problems.push(`its ${key} are not a list`);
      continue;
    }
    for (const d of dirs as unknown[]) {
      const bad = badPath(d);
      if (bad !== null) problems.push(`${key}: the path ${JSON.stringify(d)} ${bad}`);
    }
  }
  return problems;
}

/**
 * Once the run holds the lock: remove the temporary lock files of other runs,
 * and every run directory the lock does not name whose `rescue/` is empty or
 * absent. A rescue holds what a restore saved; it is never removed here.
 */
export function sweepStale(store: Store, lock: Lock): void {
  const gitDir = gitDirOf(store);
  if (gitDir === null) return;
  const own = `${LOCK_NAME}.${lock.run}.tmp`;
  const prefix = `${LOCK_NAME}.`;
  for (const name of safeList(gitDir)) {
    if (name === own || !name.startsWith(prefix) || !name.endsWith(".tmp")) continue;
    try {
      if (lstatSync(join(gitDir, name)).isFile()) unlinkSync(join(gitDir, name));
    } catch {
      // Gone already, or not ours to remove.
    }
  }
  const base = join(gitDir, RUNS);
  for (const name of safeList(base)) {
    if (name === lock.run) continue;
    const dir = join(base, name);
    try {
      if (!lstatSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    let keep: boolean;
    try {
      keep = readdirSync(join(dir, "rescue")).length > 0;
    } catch (error) {
      // No rescue directory: nothing saved. Anything else (a file there, no permission): keep.
      keep = codeOf(error) !== "ENOENT";
    }
    if (keep) continue;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Left as it is for a later sweep: the run that holds the lock goes on.
    }
  }
}

function safeList(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

export interface Liveness {
  readonly state: "running" | "not-running" | "unknown";
  readonly reason: string;
}

/**
 * R23: may the run that wrote the lock still be running? `unknown` for a lock
 * from another host, or from this boot (within 60 s) in another pid namespace.
 * Otherwise the pid decides: no such process is `not-running`; a live process
 * is `running`, unless `ps` shows it started in a later second than the lock,
 * which is a reused pid. A different boot time alone never makes a live
 * process `not-running`.
 */
export function liveness(lock: Pick<Lock, "pid" | "host" | "boot" | "pidns" | "startedAt">): Liveness {
  if (lock.host !== hostname()) return { state: "unknown", reason: `the lock is from another host, ${String(lock.host)}` };
  const here = pidNamespace();
  if (Math.abs(lock.boot - bootTime()) <= 60 && lock.pidns !== here) {
    return { state: "unknown", reason: `the lock is from another pid namespace (${lock.pidns ?? "none"}; here ${here ?? "none"})` };
  }
  if (!Number.isInteger(lock.pid) || lock.pid <= 0) return { state: "unknown", reason: `the lock names no process id (${JSON.stringify(lock.pid)})` };
  try {
    process.kill(lock.pid, 0);
  } catch (error) {
    // EPERM: a process of another user has the pid; it is alive.
    if (codeOf(error) === "ESRCH") return { state: "not-running", reason: "no such process" };
  }
  const before = Date.now();
  const elapsed = processAge(lock.pid);
  if (elapsed === null) return { state: "running", reason: `pid ${lock.pid} is alive, and ps cannot tell when it started` };
  // etime is whole seconds, and Linux procps counts them on the uptime clock,
  // so `now - etime` can land a second after the true start. The process
  // started after `before - (etime + 1) s`; only that bound may call it reused.
  const earliest = Math.floor((before - (elapsed + 1) * 1000) / 1000);
  const lockSecond = Math.floor(Date.parse(lock.startedAt) / 1000);
  if (Number.isFinite(lockSecond) && earliest > lockSecond) {
    return { state: "not-running", reason: `pid ${lock.pid} is a process that started after the lock (the pid was reused)` };
  }
  return { state: "running", reason: `pid ${lock.pid} is alive` };
}

/** Seconds since `pid` started, from `ps -o etime=` (`[[dd-]hh:]mm:ss`); null when ps cannot say. */
function processAge(pid: number): number | null {
  const r = spawnSync("ps", ["-o", "etime=", "-p", String(pid)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5_000,
    env: { ...process.env, LC_ALL: "C" },
  });
  if (r.error !== undefined || r.status !== 0 || typeof r.stdout !== "string") return null;
  const m = /^\s*(?:(?:(\d+)-)?(\d+):)?(\d+):(\d+)\s*$/.exec(r.stdout);
  if (m === null) return null;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3]) * 60 + Number(m[4]);
}

/** R25: the restore as a message names it. */
export interface Restore {
  /** `<cli> verify --restore`, the one command a line offers for the restore; its path is one shell word. */
  readonly command: string;
  /** Empty, or, when the CLI that wrote the lock is gone, the clause that names it, said in front of the way out. */
  readonly lead: string;
}

/**
 * Why the `bin/mstack` at `cli` cannot run, or null when it can: `gone` when
 * nothing is there, else the reason. What the launcher needs, asked with a few
 * `stat`s and no child process: a regular file (through a symlink) this user
 * may execute, and `src/cli.ts` a regular file at `<its directory>/../src/`,
 * once links of the file itself are followed, as `bin/mstack` finds its root
 * (item 105, A1).
 */
export function cannotRun(cli: string): string | null {
  try {
    const st = statSync(cli);
    if (!st.isFile()) return st.isDirectory() ? "it is a directory" : "it is not a regular file";
  } catch (error) {
    const code = codeOf(error);
    return code === "ENOENT" || code === "ENOTDIR" ? "gone" : `it cannot be read: ${errorText(error)}`;
  }
  try {
    accessSync(cli, constants.X_OK);
  } catch {
    return "it is not executable";
  }
  try {
    // bin/mstack's own walk: `$0` through its links, each relative one from the link's directory, then `$(dirname "$self")/..`.
    let self = cli;
    for (let hops = 0; hops < 40 && lstatSync(self).isSymbolicLink(); hops++) {
      const link = readlinkSync(self);
      self = link.startsWith("/") ? link : `${dirname(self)}/${link}`;
    }
    if (statSync(resolve(dirname(self), "..", "src", "cli.ts")).isFile()) return null;
  } catch {
    // Not there, or not readable: the launcher's `[ -f ]` fails the same way.
  }
  return "its src/cli.ts is missing";
}

/**
 * R25: the CLI that wrote the lock, since a restore run by another copy may not
 * know the lock's format, and in a checkout that hosts its own CLI the running
 * copy may be the reverted source. When it cannot run (`cannotRun`: nothing at
 * the path, a directory, no execute bit, no `src/` beside it) it is named in
 * prose, in front of the way out, and the command is the CLI that is running:
 * every command a line offers runs as printed, and a `cd` goes in front of that
 * command, never of prose (item 101, round 1 review, B1; item 105, A1). Each
 * path is one shell word (`shellWord`), so the line runs as printed from a home
 * directory with a space in it.
 */
export function restoreCommand(cli: string, running: string = join(runningCliRoot(), "bin", "mstack")): Restore {
  const why = cannotRun(cli);
  if (why === null) return { command: `${shellWord(cli)} verify --restore`, lead: "" };
  const said = why === "gone" ? "is gone" : `cannot run (${why})`;
  return { command: `${shellWord(running)} verify --restore`, lead: `the CLI that wrote the lock, ${shellWord(cli)}, ${said}; ` };
}

/** The by-hand recovery for a lock that cannot be read as a run's record (R24), in the gate's words and in `verify --restore`'s. */
export const BY_HAND = "'git stash push --include-untracked' saves every change and discards nothing; then delete the lock";

/** Who takes `BY_HAND`: while the lock exists the hook denies an agent both of its steps (round 2 review, non-blocking 2). */
export const FOR_A_PERSON = "by hand, for a person at a terminal (while the lock exists the hook denies an agent git stash and an rm of the lock)";

/** A lock `validateLock` accepts, or what to say of one it does not. */
export type CheckedLock = { readonly lock: Lock } | { readonly unreadable: { readonly message: string; readonly fix: string } };

/**
 * The lock at the name, once `validateLock` has accepted it; for one it does
 * not accept, what the gate and R1's refusal say of it, in one set of words:
 * it cannot be read as a run's record, and the way out is by hand. Neither
 * names the restore for such a lock, since `verify --restore` refuses it
 * (item 101, A2).
 */
export function checkLock(held: NonNullable<LockRead>, file: string): CheckedLock {
  const unreadable = "a mutation lock exists and cannot be read as a run's record";
  const fix = `${FOR_A_PERSON}: ${BY_HAND}`;
  if ("damaged" in held) return { unreadable: { message: `${unreadable}: ${held.damaged}`, fix } };
  const problems = validateLock(held.lock);
  if (problems.length > 0) return { unreadable: { message: `${unreadable}: the lock ${file}: ${problems[0] as string}`, fix } };
  return { lock: held.lock };
}

/** Is there anything at the lock's name in this git directory? Only the name counts, not what it holds. */
export function lockExistsIn(gitDir: string): boolean {
  try {
    lstatSync(join(gitDir, LOCK_NAME));
    return true;
  } catch (error) {
    return codeOf(error) !== "ENOENT" && codeOf(error) !== "ENOTDIR";
  }
}

export interface Rescue {
  readonly dir: string;
  readonly entries: number;
}

/** Every `<git dir>/mstack-mutation/<run>/rescue/` that holds an entry. */
export function rescuesIn(gitDir: string): Rescue[] {
  const found: Rescue[] = [];
  const base = join(gitDir, RUNS);
  for (const run of safeList(base)) {
    const dir = join(base, run, "rescue");
    const entries = safeList(dir).length;
    if (entries > 0) found.push({ dir, entries });
  }
  return found;
}

/** The rescues of every worktree: the common git directory's own, and each linked worktree's under `worktrees/`. */
export function rescueDirectories(commonDir: string): Rescue[] {
  const own = rescuesIn(commonDir);
  const linked = safeList(join(commonDir, "worktrees")).flatMap((name) => rescuesIn(join(commonDir, "worktrees", name)));
  return [...own, ...linked];
}
