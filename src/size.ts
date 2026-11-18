import { readFileSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";

import { defaultBranch, git, headSha } from "./git.ts";
import type { Store } from "./paths.ts";
import { classifyPath } from "./pathclass.ts";

/**
 * An item's size, and the one measurement the gate takes against it.
 *
 * `s` is the only size that buys less ceremony, so it is the only one held to
 * its diff. The two limits are the whole definition of "small" and live here and
 * nowhere else; the gate, the fix line and the docs all read them from here.
 */

export const SIZES = ["s", "m", "l"] as const;
export type Size = (typeof SIZES)[number];

export function isSize(value: unknown): value is Size {
  return typeof value === "string" && (SIZES as readonly string[]).includes(value);
}

/** The size an item without one is treated as. It is never written to the file. */
export const DEFAULT_SIZE: Size = "m";

/** More changed lines (insertions plus deletions) than this, in code files, is not small. */
export const SMALL_MAX_LINES = 60;
/** More changed code files than this is not small. */
export const SMALL_MAX_FILES = 3;

export interface DiffSize {
  readonly lines: number;
  readonly files: number;
}

/** The commit `ref` names, in full, or null when it is not a commit in this repository. */
export function resolveCommit(store: Store, ref: string): string | null {
  // A value that starts with a dash would be read by git as an option.
  if (ref === "" || ref.startsWith("-")) return null;
  return git(store, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
}

/**
 * The commit an item's diff is measured from, and why that one.
 *
 * - `base`: the item's own base.
 * - `older`: where HEAD left the default branch, because the base is an
 *   ancestor of that point: a rebase onto the default branch, or a merge of it
 *   into the branch, brought in commits that are not the item's.
 * - `rewritten`: the same point, because the base is not in HEAD's history
 *   any more (a rebase rewrote it).
 * - `lost`: the base is not in HEAD's history and there is no such point, so
 *   there is nothing honest to measure from.
 */
export interface Start {
  readonly from: string | null;
  readonly why: "base" | "older" | "rewritten" | "lost";
  /** The default branch, by name, that the fork point was looked for on. */
  readonly branch: string;
}

/**
 * Where to measure from, given `base` in full (`resolveCommit`'s answer).
 *
 * The fork point wins only when HEAD has commits of its own past the default
 * branch and the base is no later than that point. Everywhere else the base is
 * used: on the default branch itself, on a branch stacked on another (a base
 * later than the fork point, so the parent branch's work is not counted), and
 * where no default branch resolves.
 */
export function measureStart(store: Store, base: string): Start {
  const branch = defaultBranch(store);
  const fork = forkPoint(store, branch);
  if (!isAncestor(store, base, "HEAD")) {
    return fork === null ? { from: null, why: "lost", branch } : { from: fork, why: "rewritten", branch };
  }
  if (fork !== null && fork !== base && isAncestor(store, base, fork)) return { from: fork, why: "older", branch };
  return { from: base, why: "base", branch };
}

/**
 * Where HEAD left the default branch: the newest commit in HEAD's history that
 * the local branch or `origin/<branch>` also has. Null when neither ref exists,
 * or when HEAD has no commits of its own past that point.
 *
 * Both refs, not the local one alone: after `git fetch && git rebase
 * origin/main` the local `main` is usually behind, and its merge base with HEAD
 * is the old point, which counts everything the fetch brought in. Given more
 * than two commits, `git merge-base` answers for HEAD and a hypothetical merge
 * of the rest, which is the later of the two points when one contains the other.
 */
function forkPoint(store: Store, branch: string): string | null {
  const refs = [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`].filter(
    (ref) => git(store, ["rev-parse", "--verify", "--quiet", ref]) !== null,
  );
  if (refs.length === 0) return null;
  const fork = git(store, ["merge-base", "HEAD", ...refs]);
  return fork === null || fork === "" || fork === headSha(store) ? null : fork;
}

/** True when `commit` is `of` or one of its ancestors; any git error reads as false. */
function isAncestor(store: Store, commit: string, of: string): boolean {
  return git(store, ["merge-base", "--is-ancestor", commit, of]) !== null;
}

/**
 * The code that changed between `from` and the working tree, under the store's
 * root directory.
 *
 * Committed, staged, unstaged and untracked-but-not-ignored changes all count,
 * because the question is how big the item's work is, not how much of it has
 * been committed. Only what lies under the directory that holds `.mstack/`
 * counts, and paths are classified relative to it, so a store in `pkg/app` of
 * a monorepo measures `pkg/app` and its `tests/` holds tests. Only paths the
 * classifier calls `code` count, and nothing under the store directory: a
 * small fix with a thorough test and a progress report is still small. A
 * binary file is a file and no lines; an untracked file's lines are all
 * insertions. Returns null when git cannot answer.
 */
export function measureDiff(store: Store, from: string): DiffSize | null {
  // Both commands run in the store's root. `--relative` keeps only the changes
  // under it and prints their paths relative to it; `ls-files` without
  // `--full-name` does the same for untracked files.
  // `--numstat -z` with `--no-renames`: "<ins>\t<del>\t<path>\0" per file, nothing quoted.
  const numstat = git(store, ["diff", "--numstat", "--no-renames", "--relative", "-z", from, "--"], { raw: true });
  const untracked = git(store, ["ls-files", "--others", "--exclude-standard", "-z"], { raw: true });
  if (numstat === null || untracked === null) return null;

  // Both sides real, so a root reached through a symlink (macOS /var, a linked
  // checkout) and a store directory resolved elsewhere cannot relate as "..".
  const real = (p: string): string => {
    try {
      return realpathSync(p);
    } catch {
      return p;
    }
  };
  const storeDir = relative(real(store.root), real(store.dir)).split("\\").join("/");
  const counted = (path: string): boolean => {
    if (storeDir !== "" && !storeDir.startsWith("..") && (path === storeDir || path.startsWith(`${storeDir}/`))) return false;
    return classifyPath(path) === "code";
  };

  // A count is a non-negative integer, or "-" for a binary file. Anything else
  // is a record this parser does not understand (a rename record, if
  // `--no-renames` were ever lost, reads as "0\t0\t" then two bare paths), and
  // `Number()` of it is NaN, which every limit comparison calls small.
  const isCount = (s: string | undefined): s is string => s !== undefined && (s === "-" || /^[0-9]+$/.test(s));

  let lines = 0;
  let files = 0;
  for (const entry of numstat.split("\0")) {
    if (entry === "") continue;
    const [ins, del, ...rest] = entry.split("\t");
    if (!isCount(ins) || !isCount(del)) return null;
    const path = rest.join("\t");
    if (!counted(path)) continue;
    files += 1;
    // A binary file prints "-" for both counts.
    lines += (ins === "-" ? 0 : Number(ins)) + (del === "-" ? 0 : Number(del));
  }
  for (const path of untracked.split("\0")) {
    if (path === "" || !counted(path)) continue;
    files += 1;
    lines += countLines(join(store.root, path));
  }
  return { lines, files };
}

/** Lines in a text file; a file with a NUL byte is binary and has none. */
function countLines(file: string): number {
  let data: Buffer;
  try {
    data = readFileSync(file);
  } catch {
    return 0;
  }
  if (data.includes(0)) return 0;
  let n = 0;
  for (const byte of data) if (byte === 10) n += 1;
  return data.length > 0 && data[data.length - 1] !== 10 ? n + 1 : n;
}
