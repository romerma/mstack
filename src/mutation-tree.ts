import { createHash } from "node:crypto";
import { closeSync, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, renameSync, rmdirSync, rmSync, unlinkSync, type BigIntStats } from "node:fs";
import { dirname, join } from "node:path";

import { errorText, pump, READ_FLAGS, runDirectory, type Identity, type Lock, type LockEntry } from "./mutation-lock.ts";
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
  const from = openSync(source, READ_FLAGS);
  try {
    const to = openSync(tmp, "wx", 0o600);
    try {
      const hash = createHash("sha256");
      pump(from, to, hash);
      if (expect !== undefined && hash.digest("hex") !== expect) throw Object.assign(new Error(`the staged copy ${source} does not hold what the lock recorded`), { code: "ESTAGED" });
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

const tempName = (root: string, e: LockEntry): string => join(root, dirname(e.path), `${e.tmp}${process.pid}.tmp`);

export type Reverted =
  | { readonly ok: true }
  | { readonly ok: false; readonly path: string; readonly reason: string; readonly written: readonly number[] };

/**
 * Bring every path of the lock to the start's content (R9). Paths the start
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
