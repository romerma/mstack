import { createHash } from "node:crypto";
import { lstatSync, readlinkSync } from "node:fs";
import { join } from "node:path";

import { git } from "./git.ts";
import type { Store } from "./paths.ts";
import { scopeClass } from "./size.ts";

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
