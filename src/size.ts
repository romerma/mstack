import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

import { git } from "./git.ts";
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
 * The code that changed between `base` and the working tree.
 *
 * Committed, staged, unstaged and untracked-but-not-ignored changes all count,
 * because the question is how big the item's work is, not how much of it has
 * been committed. Only paths the classifier calls `code` count, and nothing
 * under the store directory: a small fix with a thorough test and a progress
 * report is still small. A binary file is a file and no lines; an untracked
 * file's lines are all insertions. Returns null when git cannot answer.
 */
export function measureDiff(store: Store, base: string): DiffSize | null {
  const top = git(store, ["rev-parse", "--show-toplevel"]);
  if (top === null) return null;
  // `--numstat -z` with `--no-renames`: "<ins>\t<del>\t<path>\0" per file, nothing quoted.
  const numstat = git(store, ["diff", "--numstat", "--no-renames", "-z", base, "--"], { raw: true });
  const untracked = git(store, ["ls-files", "--others", "--exclude-standard", "--full-name", "-z"], { raw: true });
  if (numstat === null || untracked === null) return null;

  // Both sides real: git reports the real top-level, and a store reached through
  // a symlink (macOS /var, a linked checkout) would otherwise relate to it as "..".
  const real = (p: string): string => {
    try {
      return realpathSync(p);
    } catch {
      return p;
    }
  };
  const storeDir = relative(real(top), real(store.dir)).split("\\").join("/");
  const counted = (path: string): boolean => {
    if (storeDir !== "" && !storeDir.startsWith("..") && (path === storeDir || path.startsWith(`${storeDir}/`))) return false;
    return classifyPath(path) === "code";
  };

  let lines = 0;
  let files = 0;
  for (const entry of numstat.split("\0")) {
    if (entry === "") continue;
    const [ins, del, ...rest] = entry.split("\t");
    const path = rest.join("\t");
    if (!counted(path)) continue;
    files += 1;
    // A binary file prints "-" for both counts.
    lines += (ins === "-" ? 0 : Number(ins)) + (del === "-" ? 0 : Number(del));
  }
  for (const path of untracked.split("\0")) {
    if (path === "" || !counted(path)) continue;
    files += 1;
    lines += countLines(isAbsolute(path) ? path : join(top, path));
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
