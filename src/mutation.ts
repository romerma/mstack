import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";

import { git } from "./git.ts";
import { runningCliRoot, STORE_DIR, type Store } from "./paths.ts";
import { measureStart, resolveCommit, scopeClass } from "./size.ts";
import type { Item, State } from "./state.ts";
import { obligations } from "./verification.ts";

/**
 * What `verify --mutation` reverts, and what its receipt is keyed by (item 42,
 * `.mstack/specs/mutation-check/`). Reads only: nothing here writes to the
 * working tree, the index or the git directory.
 */

/** One path of the revert set: a tracked code path whose blob or mode differs between the start and HEAD. */
export interface RevertEntry {
  /** Relative to the store's root. */
  readonly path: string;
  /** `000000` where the start lacks the path. */
  readonly startMode: string;
  /** All zeros where the start lacks the path. */
  readonly startBlob: string;
  /** `000000` where HEAD lacks the path. */
  readonly headMode: string;
  /** All zeros where HEAD lacks the path. */
  readonly headBlob: string;
}

export interface RevertSet {
  readonly entries: readonly RevertEntry[];
}

/** The key, or null with the reason, which the run prints instead of writing a row. */
export type MutationKey = { readonly key: string } | { readonly key: null; readonly reason: string };

interface RawRecord {
  readonly srcMode: string;
  readonly dstMode: string;
  readonly srcSha: string;
  readonly dstSha: string;
  readonly path: string;
}

/**
 * `git diff --raw -z --no-renames --no-abbrev --relative <revs> --` in the
 * store's root: `:<src mode> <dst mode> <src sha> <dst sha> <status>` NUL
 * `<path>` NUL per path, the path relative to that root and never quoted.
 * Null when git fails or prints a record this parser does not understand.
 */
function rawDiff(store: Store, revs: readonly string[]): RawRecord[] | null {
  const out = git(store, ["diff", "--raw", "-z", "--no-renames", "--no-abbrev", "--relative", ...revs, "--"], { raw: true });
  if (out === null) return null;
  const fields = out.split("\0");
  const records: RawRecord[] = [];
  let i = 0;
  for (; i + 1 < fields.length && fields[i] !== ""; i += 2) {
    const m = /^:([0-7]{6}) ([0-7]{6}) ([0-9a-f]{40}|[0-9a-f]{64}) ([0-9a-f]{40}|[0-9a-f]{64}) [A-Z][0-9]*$/.exec(fields[i] as string);
    if (m === null) return null;
    records.push({ srcMode: m[1] as string, dstMode: m[2] as string, srcSha: m[3] as string, dstSha: m[4] as string, path: fields[i + 1] as string });
  }
  // Anything but the one empty field after the last NUL is a record cut short.
  if (fields.slice(i).some((f) => f !== "")) return null;
  return records;
}

/** The tracked `code` paths whose blob or mode differs between `start` and HEAD; null when git cannot answer. */
export function revertSet(store: Store, start: string): RevertSet | null {
  const records = rawDiff(store, [start, "HEAD"]);
  if (records === null) return null;
  const scope = scopeClass(store);
  const entries = records
    .filter((r) => scope(r.path) === "code")
    .map((r) => ({ path: r.path, startMode: r.srcMode, startBlob: r.srcSha, headMode: r.dstMode, headBlob: r.dstSha }));
  return { entries };
}

/**
 * The receipt's key: one line per `code` and `test` path in scope whose content
 * or mode differs between `start` and the working tree, tracked or untracked
 * and not ignored, sorted, then SHA-256 to 16 hex digits. A line is the path,
 * whether it is tracked, its start mode and blob (`-` for an untracked path),
 * and what is there now: `-` for nothing, `120000:<target>` for a symlink,
 * `<mode>:<blob>` for a regular file, with the blob git would store for it, or
 * `other`. The sha and the commit graph are in no line, so a rebase that
 * changes no code or test path keeps the key.
 */
export function mutationKey(store: Store, start: string): MutationKey {
  const tracked = rawDiff(store, [start]);
  const others = git(store, ["ls-files", "--others", "--exclude-standard", "-z"], { raw: true });
  if (tracked === null || others === null) return { key: null, reason: "git could not list the code and test files that changed" };
  const scope = scopeClass(store);
  const kept = (path: string): boolean => {
    const c = scope(path);
    return c === "code" || c === "test";
  };
  const paths: { path: string; tracked: boolean; start: string }[] = [
    ...tracked.filter((r) => kept(r.path)).map((r) => ({ path: r.path, tracked: true, start: `${r.srcMode}:${r.srcSha}` })),
    ...others.split("\0").filter((p) => p !== "" && kept(p)).map((p) => ({ path: p, tracked: false, start: "-" })),
  ];
  // `hash-object --stdin-paths` reads one path per line and has no -z form.
  const newline = paths.find((p) => p.path.includes("\n"));
  if (newline !== undefined) return { key: null, reason: `${JSON.stringify(newline.path)} holds a newline` };

  const now = new Map<string, string>();
  const files: { path: string; mode: string }[] = [];
  for (const { path } of paths) {
    const found = entryNow(join(store.root, path));
    if (typeof found === "string") now.set(path, found);
    else files.push({ path, mode: found.mode });
  }
  if (files.length > 0) {
    // Absolute paths: a relative one resolves from the repository's top level,
    // not from a store in a subdirectory.
    const out = git(store, ["hash-object", "--stdin-paths"], { stdin: `${files.map((f) => join(store.root, f.path)).join("\n")}\n` });
    const blobs = out === null ? [] : out.split("\n").filter((line) => line !== "");
    if (blobs.length !== files.length) return { key: null, reason: "git could not hash the code and test files that changed" };
    files.forEach((f, i) => now.set(f.path, `${f.mode}:${blobs[i]}`));
  }

  const lines = paths.map((p) => [p.path, p.tracked ? "tracked" : "untracked", p.start, now.get(p.path)].join("\0")).sort();
  return { key: createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16) };
}

/** What is at `absolute` now, or the mode of the regular file whose blob is to be hashed. */
function entryNow(absolute: string): string | { mode: string } {
  let stat;
  try {
    stat = lstatSync(absolute);
  } catch {
    return "-";
  }
  if (stat.isSymbolicLink()) {
    try {
      return `120000:${readlinkSync(absolute)}`;
    } catch {
      return "other";
    }
  }
  // git's rule: a regular file is 100755 when its owner may execute it.
  if (stat.isFile()) return { mode: (stat.mode & 0o100) !== 0 ? "100755" : "100644" };
  return "other";
}

/** A reason not to start, and what fixes it. */
export interface Refusal {
  readonly message: string;
  readonly fix: string;
}

/** `<git dir>/mstack-mutation.lock`, the git dir being this worktree's own; null outside a repository. */
export function lockPath(store: Store): string | null {
  const dir = git(store, ["rev-parse", "--absolute-git-dir"]);
  return dir === null || dir === "" ? null : join(dir, "mstack-mutation.lock");
}

/** At most ten, then how many more: a message names paths, it does not list a tree. */
function some(paths: readonly string[]): string {
  const shown = paths.slice(0, 10).join(", ");
  return paths.length > 10 ? `${shown} and ${paths.length - 10} more` : shown;
}

const short = (sha: string): string => sha.slice(0, 8);

/** Operations whose state files under the git directory mean the tree is mid-way through something. */
const IN_PROGRESS: readonly { file: string; what: string; fix: string }[] = [
  { file: "rebase-merge", what: "a rebase", fix: "finish it with 'git rebase --continue', or 'git rebase --abort'" },
  { file: "rebase-apply", what: "a rebase", fix: "finish it with 'git rebase --continue', or 'git rebase --abort'" },
  { file: "MERGE_HEAD", what: "a merge", fix: "finish it with 'git merge --continue', or 'git merge --abort'" },
  { file: "CHERRY_PICK_HEAD", what: "a cherry-pick", fix: "finish it with 'git cherry-pick --continue', or 'git cherry-pick --abort'" },
  { file: "REVERT_HEAD", what: "a revert", fix: "finish it with 'git revert --continue', or 'git revert --abort'" },
  { file: "BISECT_LOG", what: "a bisect", fix: "end it with 'git bisect reset'" },
];

/**
 * The first reason `verify --mutation` must not start, or null. It reads git and
 * the working tree and writes nothing. `running` is the root of the mstack copy
 * whose code is executing; a revert under it would change the running CLI.
 */
export function refusals(store: Store, state: State, item: Item | undefined, running: string = runningCliRoot()): Refusal | null {
  if (item === undefined) {
    return { message: "no active item", fix: "start one with 'mstack state set <slug> --status in_progress'" };
  }
  const lock = lockPath(store);
  if (lock === null) {
    return { message: "the store is not in a git repository", fix: "the check reverts committed code, so it needs git: 'git init' and commit the code first" };
  }
  const setBase = `'mstack state set ${item.slug} --base <commit>' names the commit the item's work starts after`;
  if (item.base === undefined) return { message: `item ${item.slug} has no base`, fix: setBase };
  const base = resolveCommit(store, item.base);
  if (base === null) return { message: `item ${item.slug}'s base ${item.base} is not a commit in this repository`, fix: setBase };
  const start = measureStart(store, base);
  if (start.from === null) {
    return { message: `the start of item ${item.slug} is lost: its base ${short(base)} is not in HEAD's history, and HEAD has no fork point from ${start.branch}`, fix: setBase };
  }
  if (obligations(state, item).length === 0) {
    return {
      message: `no verification command to run: neither the project's "verify" nor item ${item.slug}'s verification is set`,
      fix: `'mstack state set ${item.slug} --verification "<command>"' sets the item's`,
    };
  }

  const paths = git(store, ["rev-parse", ...IN_PROGRESS.flatMap((op) => ["--git-path", op.file])], { raw: true });
  if (paths === null) return { message: "git could not name the files of an operation in progress", fix: "run it again; if it persists, check 'git status'" };
  const found = paths.split("\n").findIndex((p, i) => i < IN_PROGRESS.length && p !== "" && existsSync(resolve(store.root, p)));
  const op = IN_PROGRESS[found];
  if (op !== undefined) return { message: `${op.what} is in progress`, fix: op.fix };

  const held = lockRefusal(lock, running);
  if (held !== null) return held;

  const set = revertSet(store, start.from);
  if (set === null) return { message: `git could not list the code changed since ${short(start.from)}`, fix: "run it again; if it persists, check 'git status'" };
  if (set.entries.length === 0) {
    return {
      message: `no code changed since ${short(start.from)}`,
      fix: "the check reverts tracked code that differs between the start and HEAD; commit the item's code first",
    };
  }

  const dirty = dirtyTracked(store);
  if (dirty === null) return { message: "git could not say whether tracked files have changes", fix: "run it again; if it persists, check 'git status'" };
  if (dirty.length > 0) {
    return {
      message: `uncommitted changes to tracked files: ${some(dirty)}`,
      fix: "commit them, or 'git stash' them, and run it again; the run restores only what it reverts",
    };
  }

  const way = inTheWay(store.root, set.entries);
  if (way.length > 0) {
    return {
      message: `the working tree is in the way of the revert: ${some(way.map((w) => `${w.path} (${w.why})`))}`,
      fix: "move each one aside, or commit it, and run it again; nothing was changed",
    };
  }

  const own = insideRunning(store.root, set.entries, running);
  if (own.length > 0) {
    const copy = '"${TMPDIR:-/tmp}/mstack-cli"';
    return {
      message: `the revert would change the source of the mstack that is running, ${running}: ${some(own)}`,
      fix: `run it from a copy of the CLI outside the tree: git worktree add --detach ${copy} HEAD, then ${copy.slice(0, -1)}/bin/mstack" verify --mutation, then git worktree remove ${copy}`,
    };
  }
  return null;
}

/** The refusal for a lock that exists, by `lstat`, whatever it holds. */
function lockRefusal(lock: string, running: string): Refusal | null {
  try {
    lstatSync(lock);
  } catch {
    return null;
  }
  const here = join(running, "bin", "mstack");
  let record: { pid?: unknown; startedAt?: unknown; cli?: unknown } | null = null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(lock, "utf8"));
    if (parsed !== null && typeof parsed === "object") record = parsed as { pid?: unknown; startedAt?: unknown; cli?: unknown };
  } catch {
    record = null;
  }
  if (record === null) {
    return { message: `the lock ${lock} exists and is not a run's record`, fix: `'${here} verify --restore' says what is wrong with it` };
  }
  const cli = typeof record.cli === "string" ? record.cli : here;
  const restore = existsSync(cli) || cli === here ? `'${cli} verify --restore'` : `'${cli} verify --restore' (that path is gone; this CLI: '${here} verify --restore')`;
  return {
    message: `a mutation run holds the tree: lock ${lock}, pid ${String(record.pid)}, started ${String(record.startedAt)}`,
    fix: `wait for it to end; if it is not running, ${restore}`,
  };
}

/**
 * Tracked paths outside the store directory with a change, staged or not,
 * relative to the repository's top. Null when git cannot answer.
 */
function dirtyTracked(store: Store): string[] | null {
  const prefix = git(store, ["rev-parse", "--show-prefix"], { raw: true });
  const out = git(store, ["status", "--porcelain=v1", "-z", "--untracked-files=no"], { raw: true });
  if (prefix === null || out === null) return null;
  const storeDir = `${prefix.replace(/\n$/, "")}${STORE_DIR}`;
  const paths: string[] = [];
  const fields = out.split("\0");
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i] as string;
    if (field === "") continue;
    const path = field.slice(3);
    // A staged rename or copy carries its original path in the next field.
    if (field[0] === "R" || field[0] === "C") i += 1;
    if (path === storeDir || path.startsWith(`${storeDir}/`)) continue;
    paths.push(path);
  }
  return paths;
}

/** The name on disk of the entry at `absolute`, found by inode among its directory's entries; null when there is none. */
function nameOnDisk(absolute: string): string | null {
  try {
    const ino = lstatSync(absolute).ino;
    const dir = dirname(absolute);
    return readdirSync(dir).find((name) => lstatSync(join(dir, name)).ino === ino) ?? null;
  } catch {
    return null;
  }
}

/** True when the directory `dir` lists `name` under exactly that name. */
function listsExactly(dir: string, name: string): boolean {
  try {
    return readdirSync(dir).includes(name);
  } catch {
    return false;
  }
}

/**
 * Entries of the working tree that the revert would have to write through or
 * over, by exact name (no case folding, no Unicode normalisation): a parent
 * directory that is a symlink, not a directory, or there under another name;
 * anything at a path the start has and HEAD lacks; a path HEAD has that is not
 * there under git's name.
 */
function inTheWay(root: string, entries: readonly RevertEntry[]): { path: string; why: string }[] {
  const found = new Map<string, string>();
  const parentOk = new Map<string, boolean>();
  for (const entry of entries) {
    const parts = entry.path.split("/");
    let ok = true;
    for (let i = 1; i < parts.length && ok; i++) {
      const dir = parts.slice(0, i).join("/");
      const known = parentOk.get(dir);
      if (known !== undefined) {
        ok = known;
        continue;
      }
      const absolute = join(root, dir);
      let stat;
      try {
        stat = lstatSync(absolute);
      } catch {
        // Absent with nothing resolving there: the revert makes it, and every deeper one.
        parentOk.set(dir, true);
        break;
      }
      let why: string | null = null;
      if (stat.isSymbolicLink()) why = "a symlink where a parent directory goes";
      else if (!stat.isDirectory()) why = "not a directory, where a parent directory goes";
      else if (!listsExactly(dirname(absolute), basename(absolute))) why = `on disk as ${join(dirname(dir), nameOnDisk(absolute) ?? "?")}`;
      parentOk.set(dir, why === null);
      if (why !== null) {
        found.set(dir, why);
        ok = false;
      }
    }
    if (!ok) continue;
    const absolute = join(root, entry.path);
    if (entry.headMode === "000000") {
      try {
        lstatSync(absolute);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        found.set(entry.path, (error as NodeJS.ErrnoException).code ?? "cannot be read");
        continue;
      }
      const name = nameOnDisk(absolute);
      const there = name === null || name === basename(entry.path) ? "something is there" : `${join(dirname(entry.path), name)} is there`;
      found.set(entry.path, `${there}, where the revert puts the start's file back`);
    } else if (!listsExactly(dirname(absolute), basename(absolute))) {
      const name = nameOnDisk(absolute);
      found.set(entry.path, name === null ? "not on disk" : `on disk as ${join(dirname(entry.path), name)}`);
    }
  }
  return [...found].map(([path, why]) => ({ path, why }));
}

/** The real path of `absolute`, or of its nearest existing ancestor with the rest appended. */
function realOf(absolute: string): string {
  try {
    return realpathSync(absolute);
  } catch {
    const parent = dirname(absolute);
    return parent === absolute ? absolute : join(realOf(parent), basename(absolute));
  }
}

/** Paths of the set that, resolved to real paths, lie inside the running copy's root. */
function insideRunning(root: string, entries: readonly RevertEntry[], running: string): string[] {
  const top = realOf(running);
  return entries.map((e) => e.path).filter((p) => {
    const real = realOf(join(root, p));
    return real === top || real.startsWith(`${top}${sep}`);
  });
}
