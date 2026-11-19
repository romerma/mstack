import { createHash } from "node:crypto";
import {
  closeSync, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readlinkSync, renameSync, rmdirSync, rmSync,
  symlinkSync, unlinkSync, type BigIntStats,
} from "node:fs";
import { dirname, join } from "node:path";

import { errorText, fsyncDirectory, lockPath, pump, READ_FLAGS, runDirectory, validateLock, type Identity, type Lock, type LockEntry } from "./mutation-lock.ts";
import type { Store } from "./paths.ts";

/**
 * What the mutation run writes to the working tree, and how it puts it back
 * (item 42, `.mstack/specs/mutation-check/design.md`, "Exact names", "Revert"
 * and "Restore"). Synchronous and with no child process: nothing here can be
 * interrupted half-way by a signal handler, and nothing here asks git.
 */

/**
 * The entry at a path by exact name: every directory from the root down lists
 * the next component under exactly that name, with no case folding and no
 * Unicode normalisation.
 *  - `file`: a regular file, with its SHA-256, its permission bits and the
 *    `fstat` of the descriptor its bytes were read from.
 *  - `absent`: the path is not there by exact name; `variant` is the name on
 *    disk (relative to the root) of what the filesystem resolves there anyway,
 *    or null when nothing does.
 *  - `parent`: a parent of the path is a symlink, not a directory, or a
 *    directory under another name (`onDisk`).
 */
export type Entry =
  | { readonly kind: "file"; readonly sha256: string; readonly bits: number; readonly stat: BigIntStats }
  | { readonly kind: "dir" | "symlink" | "other"; readonly stat: BigIntStats }
  | { readonly kind: "absent"; readonly variant: string | null }
  | { readonly kind: "parent"; readonly parent: string; readonly why: "symlink" | "not a directory" | "another name"; readonly onDisk: string | null };

const codeOf = (error: unknown): string | undefined => (error as NodeJS.ErrnoException | null)?.code;

/** lstat, or null when nothing resolves there. */
function resolves(absolute: string): BigIntStats | null {
  try {
    return lstatSync(absolute, { bigint: true });
  } catch (error) {
    const code = codeOf(error);
    if (code === "ENOENT" || code === "ENOTDIR") return null;
    throw error;
  }
}

function listing(dir: string, listings: Map<string, string[]>): string[] {
  let names = listings.get(dir);
  if (names === undefined) {
    names = readdirSync(dir);
    listings.set(dir, names);
  }
  return names;
}

/** The name in `dir` whose inode is `ino`: what the filesystem resolved under another spelling. */
function nameOnDisk(dir: string, ino: bigint, listings: Map<string, string[]>): string | null {
  for (const name of listing(dir, listings)) {
    try {
      if (lstatSync(join(dir, name), { bigint: true }).ino === ino) return name;
    } catch {
      // Gone since the listing.
    }
  }
  return null;
}

/**
 * The entry at `path` (relative to `root`, `/`-separated) by exact name.
 * `listings` caches each directory's `readdir` for one pass; a caller that
 * writes drops it. Errors other than "nothing there" are thrown.
 */
export function entryAt(root: string, path: string, listings: Map<string, string[]> = new Map()): Entry {
  const parts = path.split("/");
  let rel = "";
  for (let i = 0; i < parts.length; i++) {
    const name = parts[i] as string;
    const dir = rel === "" ? root : join(root, rel);
    const next = rel === "" ? name : `${rel}/${name}`;
    const absolute = join(root, next);
    const last = i === parts.length - 1;
    if (!listing(dir, listings).includes(name)) {
      const st = resolves(absolute);
      if (st === null) return { kind: "absent", variant: null };
      const found = nameOnDisk(dir, st.ino, listings);
      const onDisk = found === null ? next : rel === "" ? found : `${rel}/${found}`;
      return last ? { kind: "absent", variant: onDisk } : { kind: "parent", parent: next, why: "another name", onDisk };
    }
    const st = lstatSync(absolute, { bigint: true });
    if (!last) {
      if (st.isSymbolicLink()) return { kind: "parent", parent: next, why: "symlink", onDisk: null };
      if (!st.isDirectory()) return { kind: "parent", parent: next, why: "not a directory", onDisk: null };
      rel = next;
      continue;
    }
    if (st.isSymbolicLink()) return { kind: "symlink", stat: st };
    if (st.isDirectory()) return { kind: "dir", stat: st };
    if (!st.isFile()) return { kind: "other", stat: st };
    return readFile(absolute);
  }
  return { kind: "absent", variant: null };
}

/** Hash a regular file through one descriptor, and keep that descriptor's `fstat`: what was read is what was judged. */
function readFile(absolute: string): Entry {
  const fd = openSync(absolute, READ_FLAGS);
  try {
    const st = fstatSync(fd, { bigint: true });
    if (!st.isFile()) return { kind: "other", stat: st };
    const hash = createHash("sha256");
    pump(fd, null, hash);
    return { kind: "file", sha256: hash.digest("hex"), bits: Number(st.mode & 0o7777n), stat: st };
  } finally {
    closeSync(fd);
  }
}

/** True when the entry is a regular file with exactly this identity. */
export function holds(entry: Entry, identity: Identity): boolean {
  return identity !== null && entry.kind === "file" && entry.sha256 === identity.sha256 && entry.bits === identity.bits;
}

/** True when nothing at all resolves at the path: not by exact name, not as a variant. */
const empty = (entry: Entry): boolean => entry.kind === "absent" && entry.variant === null;

function describe(entry: Entry): string {
  switch (entry.kind) {
    case "file":
      return "a file with other content or bits";
    case "dir":
      return "a directory";
    case "symlink":
      return "a symlink";
    case "other":
      return "an entry that is not a regular file";
    case "absent":
      return entry.variant === null ? "nothing" : `${entry.variant}, under another name`;
    case "parent":
      return `its parent ${entry.parent} is ${entry.why === "another name" ? `on disk as ${entry.onDisk ?? "?"}` : entry.why === "symlink" ? "a symlink" : "not a directory"}`;
  }
}

/**
 * Has the entry checked as `was` changed? A file by inode, size, mtime and
 * ctime; nothing-there by whether anything resolves now.
 */
function changed(absolute: string, was: Entry): boolean {
  let now: BigIntStats | null;
  try {
    now = resolves(absolute);
  } catch {
    return true;
  }
  if (empty(was)) return now !== null;
  if (was.kind !== "file" || now === null) return true;
  const then = was.stat;
  return now.ino !== then.ino || now.dev !== then.dev || now.size !== then.size || now.mtimeNs !== then.mtimeNs || now.ctimeNs !== then.ctimeNs;
}

const depth = (p: string): number => p.split("/").length;
const deepestFirst = (a: LockEntry, b: LockEntry): number => depth(b.path) - depth(a.path) || a.n - b.n;
const shallowestFirst = (a: LockEntry, b: LockEntry): number => depth(a.path) - depth(b.path) || a.n - b.n;

function parentsOf(path: string): string[] {
  const parts = path.split("/");
  return parts.slice(1).map((_, i) => parts.slice(0, i + 1).join("/"));
}

/** mkdir each parent of `path` that nothing resolves at, shallowest first, never recursively. */
function makeParents(root: string, path: string): void {
  for (const d of parentsOf(path)) if (resolves(join(root, d)) === null) mkdirSync(join(root, d));
}

/**
 * Write `source`'s bytes to a new temp file `tmp`, mode 0600 while it is
 * written, then the permission bits, then fsync. With `expect`, the bytes must
 * hash to it, or the temp file is removed and an error thrown.
 */
function writeTemp(tmp: string, source: string, bits: number, expect?: string): void {
  let from: number;
  try {
    from = openSync(source, READ_FLAGS);
  } catch (error) {
    throw stagedError(`the staged copy ${source} cannot be read: ${errorText(error)}`);
  }
  try {
    const to = openSync(tmp, "wx", 0o600);
    try {
      const hash = createHash("sha256");
      pump(from, to, hash);
      if (expect !== undefined && hash.digest("hex") !== expect) throw stagedError(`the staged copy ${source} does not hold what the lock recorded`);
      fchmodSync(to, bits);
      fsyncSync(to);
    } finally {
      closeSync(to);
    }
  } catch (error) {
    rmSync(tmp, { force: true });
    throw error;
  } finally {
    closeSync(from);
  }
}

/** A staged copy that is missing or does not match its identity: the fix is git's copy of HEAD, not a retry. */
const stagedError = (message: string): Error => Object.assign(new Error(message), { code: "ESTAGED" });

const tempName = (root: string, e: LockEntry): string => join(root, dirname(e.path), `${e.tmp}${process.pid}.tmp`);

export type Reverted =
  | { readonly ok: true }
  | { readonly ok: false; readonly path: string; readonly reason: string; readonly written: readonly number[] };

/**
 * The first staged copy that is missing or does not hold what the lock records
 * (S at `start/<n>`, H at `head/<n>`), or null. The revert checks every one
 * before its first write: a run directory that another run's sweep removed
 * before this run linked its lock, or one deleted by hand, then stops the
 * revert with nothing written.
 */
function stagingFault(run: string, lock: Lock): { path: string; reason: string } | null {
  for (const e of lock.entries) {
    for (const [side, id] of [["start", e.start], ["head", e.head]] as const) {
      if (id === null) continue;
      const copy = join(run, side, String(e.n));
      let sha: string;
      try {
        sha = digest(copy);
      } catch (error) {
        return { path: e.path, reason: `its staged copy ${copy} cannot be read: ${errorText(error)}` };
      }
      if (sha !== id.sha256) return { path: e.path, reason: `its staged copy ${copy} does not hold what the lock recorded` };
    }
  }
  return null;
}

/**
 * Bring every path of the lock to the start's content (R9). Every staged copy
 * is checked first, and a missing or changed one writes nothing. Paths the start
 * lacks are unlinked first, deepest first, then the directories only they
 * held; then the start's files are written, shallowest first, each through a
 * temp name and a rename. Before each write the path must still hold H(p) (or,
 * where HEAD lacks it, nothing may resolve there), and again after its temp
 * file is written; on a change, or on any error, the revert stops and returns
 * the entries it wrote (R11). `step` is the test seam.
 */
export function applyRevert(store: Store, lock: Lock, step: (name: string) => void = () => {}): Reverted {
  const root = store.root;
  const run = runDirectory(store, lock.run);
  const written: number[] = [];
  const stop = (path: string, reason: string): Reverted => ({ ok: false, path, reason, written: [...written] });
  if (run === null) return stop(lock.entries[0]?.path ?? ".", "the store is not in a git repository");
  const unstaged = stagingFault(run, lock);
  if (unstaged !== null) return stop(unstaged.path, unstaged.reason);

  for (const e of lock.entries.filter((x) => x.start === null).sort(deepestFirst)) {
    let at: Entry;
    try {
      at = entryAt(root, e.path);
    } catch (error) {
      return stop(e.path, errorText(error));
    }
    if (!holds(at, e.head)) return stop(e.path, `it changed since the lock: ${describe(at)} is there`);
    try {
      unlinkSync(join(root, e.path));
    } catch (error) {
      return stop(e.path, errorText(error));
    }
    written.push(e.n);
    step(`reverted:${e.n}`);
  }

  for (const d of lock.removedDirs) {
    try {
      rmdirSync(join(root, d));
    } catch (error) {
      const code = codeOf(error);
      // Not empty: it holds something the run did not write, which stays.
      if (code !== "ENOTEMPTY" && code !== "EEXIST" && code !== "ENOENT") return stop(d, errorText(error));
    }
  }

  for (const e of lock.entries.filter((x) => x.start !== null).sort(shallowestFirst)) {
    const absolute = join(root, e.path);
    let at: Entry;
    try {
      at = entryAt(root, e.path);
    } catch (error) {
      return stop(e.path, errorText(error));
    }
    if (e.head === null ? !empty(at) : !holds(at, e.head)) return stop(e.path, `it changed since the lock: ${describe(at)} is there`);
    const tmp = tempName(root, e);
    try {
      makeParents(root, e.path);
      writeTemp(tmp, join(run, "start", String(e.n)), (e.start as NonNullable<Identity>).bits);
    } catch (error) {
      return stop(e.path, errorText(error));
    }
    step(`revert-written:${e.n}`);
    if (changed(absolute, at)) {
      rmSync(tmp, { force: true });
      return stop(e.path, "it changed while its revert was being written");
    }
    try {
      renameSync(tmp, absolute);
    } catch (error) {
      rmSync(tmp, { force: true });
      return stop(e.path, errorText(error));
    }
    written.push(e.n);
    step(`reverted:${e.n}`);
  }
  return { ok: true };
}

export interface Restored {
  /** Entries the restore wrote H to, or unlinked S from. */
  restored: number;
  /** Entries moved into `rescue/<k>/` before H was written: the name they had on disk, and where they are now. */
  readonly rescued: { readonly path: string; readonly to: string }[];
  /** Entries left where they are, and reported: something other than S where HEAD lacks the path, a directory not empty. */
  readonly left: string[];
  /** Paths the restore could not write, move or prove, with the operating system's error and what to do; the lock stays. */
  readonly failed: { readonly path: string; readonly reason: string; readonly fix: string }[];
}

export interface RestoreOptions {
  /** The test seam: `rescued:<n>`, `restore-written:<n>`, `restored:<n>`, `lock-removed`. */
  readonly step?: (name: string) => void;
  /** Every rename of the restore; a test passes one that fails with EXDEV. */
  readonly rename?: (from: string, to: string) => void;
  /** Only these entries are restored and proved (the run's own restore after R11); the temp sweep and the directories are as always. */
  readonly entries?: readonly number[];
}

/** A path as a shell word: bare when it is plain, else single-quoted. */
const shellWord = (p: string): string => (/^[\w./@%+=:,-]+$/.test(p) ? p : `'${p.replace(/'/g, "'\\''")}'`);

/** What to do about an error the operating system gave for `path`. */
function fixFor(error: unknown, path: string): string {
  const code = codeOf(error);
  const dir = dirname(path);
  if (code === "EACCES" || code === "EPERM") return `make ${dir} writable: chmod u+w ${shellWord(dir)}`;
  if (code === "ENOSPC") return "free space on the disk";
  return `clear the cause of ${code ?? "the error"}`;
}

/** R15's fix for a staged copy that is missing or wrong. */
const stashFix = (path: string): string =>
  `git stash push -- ${shellWord(path)} writes HEAD's content there and saves whatever is there first; ` +
  `if the restore still fails after it, the lock may be deleted by hand, ${path} may then be absent, and git restore -- ${shellWord(path)} puts HEAD's content back`;

const AGAIN = "run the restore again once nothing else writes to it";

/**
 * Put every path of the lock back to H(p), proved path by path, and only then
 * remove the lock and the staging (R13, R14). First the run's temp names that
 * are regular files are unlinked; then the paths HEAD lacks, deepest first
 * (unlinked only where they hold S); then the directories the revert made,
 * when empty; then the paths HEAD has, shallowest first. Where p holds S, or
 * nothing resolves there, H is written by a temp name and a rename, checked
 * again just before the rename; anything else there (an edit, a directory, a
 * symlink, a case variant) is first moved into a fresh `rescue/<k>/` under the
 * name it has on disk. A path that cannot be written, moved or proved is
 * named in `failed` with what to do, and the lock stays (R15). A lock that
 * fails `validateLock` writes nothing and is one failure (R24). Synchronous,
 * no child process, and from the lock's record alone: the lock file is not
 * read.
 */
export function restoreFromLock(store: Store, lock: Lock, options: RestoreOptions = {}): Restored {
  const step = options.step ?? ((): void => {});
  const rename = options.rename ?? renameSync;
  const root = store.root;
  const out: Restored = { restored: 0, rescued: [], left: [], failed: [] };
  const fail = (path: string, reason: string, fix: string): void => {
    if (!out.failed.some((f) => f.path === path)) out.failed.push({ path, reason, fix });
  };
  const run = runDirectory(store, lock.run);
  const lockFile = lockPath(store);
  if (run === null || lockFile === null) {
    fail(".", "the store is not in a git repository", "run the restore from the repository the lock is in");
    return out;
  }
  // R24: no field of a lock that fails the check is trusted, the temp prefix that the sweep unlinks by included.
  const problems = validateLock(lock);
  if (problems.length > 0) {
    fail(lockFile, `the lock is not one a run wrote: ${problems.join("; ")}`, "nothing was written; git stash push --include-untracked saves every change, the reverted code included, and discards nothing");
    return out;
  }

  for (const e of lock.entries) sweepTemps(root, e, fail);
  const only = options.entries === undefined ? null : new Set(options.entries);
  const chosen = lock.entries.filter((e) => only === null || only.has(e.n));

  for (const e of chosen.filter((x) => x.head === null).sort(deepestFirst)) {
    removeStart(root, e, out, fail);
    step(`restored:${e.n}`);
  }
  for (const d of [...lock.createdDirs].reverse()) {
    try {
      rmdirSync(join(root, d));
    } catch (error) {
      if (codeOf(error) !== "ENOENT") out.left.push(d);
    }
  }
  const ctx: PutBack = { root, run, rename, step, out, fail };
  for (const e of chosen.filter((x) => x.head !== null).sort(shallowestFirst)) {
    putBack(ctx, e);
    step(`restored:${e.n}`);
  }

  // The proof: what decides whether the lock goes. Not HEAD, not the index, not other files.
  for (const e of chosen) {
    let at: Entry;
    try {
      at = entryAt(root, e.path);
    } catch (error) {
      fail(e.path, errorText(error), fixFor(error, e.path));
      continue;
    }
    if (e.head !== null && !holds(at, e.head)) fail(e.path, `after the restore it does not hold HEAD's content: ${describe(at)} is there`, AGAIN);
    if (e.head === null && holds(at, e.start)) fail(e.path, "after the restore it still holds the start's content", AGAIN);
  }
  if (out.failed.length > 0) return out;

  try {
    unlinkSync(lockFile);
  } catch (error) {
    if (codeOf(error) !== "ENOENT") {
      fail(lockFile, errorText(error), fixFor(error, lockFile));
      return out;
    }
  }
  try {
    fsyncDirectory(dirname(lockFile));
  } catch {
    // The lock is unlinked; the fsync only orders it before what follows.
  }
  rmSync(join(run, "start"), { recursive: true, force: true });
  rmSync(join(run, "head"), { recursive: true, force: true });
  if (listOrEmpty(join(run, "rescue")).length === 0) {
    rmSync(join(run, "rescue"), { recursive: true, force: true });
    try {
      rmdirSync(run);
    } catch {
      // Left for the next run's sweep.
    }
  }
  step("lock-removed");
  return out;
}

function listOrEmpty(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** Unlink every temp name of the entry that is a regular file; anything else with such a name is left. */
function sweepTemps(root: string, e: LockEntry, fail: (path: string, reason: string, fix: string) => void): void {
  const rel = dirname(e.path);
  const dir = join(root, rel);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (error) {
    const code = codeOf(error);
    if (code !== "ENOENT" && code !== "ENOTDIR") fail(e.path, `its directory cannot be listed for the run's temp files: ${errorText(error)}`, fixFor(error, e.path));
    return;
  }
  for (const name of names) {
    if (!name.startsWith(e.tmp) || !name.endsWith(".tmp")) continue;
    const temp = rel === "." ? name : `${rel}/${name}`;
    try {
      if (lstatSync(join(dir, name)).isFile()) unlinkSync(join(dir, name));
    } catch (error) {
      if (codeOf(error) !== "ENOENT") fail(temp, errorText(error), fixFor(error, temp));
    }
  }
}

/** An entry HEAD lacks: unlink it where it holds S; leave and report anything else. */
function removeStart(root: string, e: LockEntry, out: Restored, fail: (path: string, reason: string, fix: string) => void): void {
  let at: Entry;
  try {
    at = entryAt(root, e.path);
  } catch (error) {
    fail(e.path, errorText(error), fixFor(error, e.path));
    return;
  }
  if (holds(at, e.start)) {
    try {
      unlinkSync(join(root, e.path));
      out.restored += 1;
    } catch (error) {
      fail(e.path, errorText(error), fixFor(error, e.path));
    }
    return;
  }
  if (empty(at)) return;
  out.left.push(at.kind === "absent" && at.variant !== null ? at.variant : e.path);
}

interface PutBack {
  readonly root: string;
  readonly run: string;
  readonly rename: (from: string, to: string) => void;
  readonly step: (name: string) => void;
  readonly out: Restored;
  readonly fail: (path: string, reason: string, fix: string) => void;
}

function parentFix(at: Extract<Entry, { kind: "parent" }>): string {
  if (at.why === "another name") {
    return `mv ${shellWord(at.onDisk ?? "?")} ${shellWord(at.parent)}: git stash does not clear this, since it writes through the directory under its other name`;
  }
  return `move ${shellWord(at.parent)} aside, so that a directory can be there again`;
}

/** An entry HEAD has: write H where p holds S or nothing; rescue anything else first. Decided again once on a change. */
function putBack(ctx: PutBack, e: LockEntry): void {
  const { root, run, out, fail } = ctx;
  const head = e.head as NonNullable<Identity>;
  const absolute = join(root, e.path);
  for (let attempt = 0; ; attempt++) {
    let at: Entry;
    try {
      at = entryAt(root, e.path);
    } catch (error) {
      fail(e.path, errorText(error), fixFor(error, e.path));
      return;
    }
    if (at.kind === "parent") {
      fail(e.path, describe(at), parentFix(at));
      return;
    }
    if (holds(at, head)) return;
    let expect: Entry = at;
    if (!holds(at, e.start) && !empty(at)) {
      const source = at.kind === "absent" && at.variant !== null ? at.variant : e.path;
      try {
        rescue(ctx, e, source);
      } catch (error) {
        fail(e.path, `${source} could not be moved into ${join(run, "rescue")}: ${errorText(error)}`, fixFor(error, source));
        return;
      }
      expect = { kind: "absent", variant: null };
    }
    const tmp = tempName(root, e);
    try {
      makeParents(root, e.path);
      writeTemp(tmp, join(run, "head", String(e.n)), head.bits, head.sha256);
    } catch (error) {
      fail(e.path, errorText(error), codeOf(error) === "ESTAGED" ? stashFix(e.path) : fixFor(error, e.path));
      return;
    }
    ctx.step(`restore-written:${e.n}`);
    if (changed(absolute, expect)) {
      rmSync(tmp, { force: true });
      if (attempt >= 1) {
        fail(e.path, "it changed while its restore was being written, twice", AGAIN);
        return;
      }
      continue;
    }
    try {
      ctx.rename(tmp, absolute);
      out.restored += 1;
    } catch (error) {
      rmSync(tmp, { force: true });
      fail(e.path, errorText(error), fixFor(error, e.path));
    }
    return;
  }
}

/** Move the entry at `source` (its name on disk) into a fresh `rescue/<k>/`, keeping its path; never over anything. */
function rescue(ctx: PutBack, e: LockEntry, source: string): void {
  const base = join(ctx.run, "rescue");
  mkdirSync(base, { recursive: true });
  let dir = "";
  for (let k = 1; ; k++) {
    dir = join(base, String(k));
    try {
      mkdirSync(dir);
      break;
    } catch (error) {
      if (codeOf(error) !== "EEXIST") throw error;
    }
  }
  const target = join(dir, source);
  try {
    mkdirSync(dirname(target), { recursive: true });
    try {
      ctx.rename(join(ctx.root, source), target);
    } catch (error) {
      if (codeOf(error) !== "EXDEV") throw error;
      copyAcross(join(ctx.root, source), target);
    }
  } catch (error) {
    // Nothing of the entry is in it: the move failed, or the copy was not complete when the source was kept.
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
  ctx.out.rescued.push({ path: source, to: target });
  ctx.step(`rescued:${e.n}`);
}

function digest(file: string): string {
  const fd = openSync(file, READ_FLAGS);
  try {
    const hash = createHash("sha256");
    pump(fd, null, hash);
    return hash.digest("hex");
  } finally {
    closeSync(fd);
  }
}

/**
 * The rescue when `rename` cannot cross filesystems: a regular file is copied
 * with its permission bits, fsynced, compared byte for byte and only then
 * unlinked; a symlink is made again from its target and unlinked; anything
 * else is left where it is, and the rescue fails.
 */
function copyAcross(from: string, to: string): void {
  const st = lstatSync(from);
  if (st.isSymbolicLink()) {
    symlinkSync(readlinkSync(from), to);
    unlinkSync(from);
    return;
  }
  if (!st.isFile()) throw Object.assign(new Error(`${from} is not a regular file or a symlink, and cannot be copied to another filesystem`), { code: "EXDEV" });
  const src = openSync(from, READ_FLAGS);
  try {
    const mode = fstatSync(src).mode & 0o7777;
    const dst = openSync(to, "wx", 0o600);
    try {
      pump(src, dst);
      fchmodSync(dst, mode);
      fsyncSync(dst);
    } finally {
      closeSync(dst);
    }
  } finally {
    closeSync(src);
  }
  if (digest(from) !== digest(to)) throw new Error(`the copy of ${from} differs from it, so it was left where it is`);
  unlinkSync(from);
}
