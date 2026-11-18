import { readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, posix, relative, sep } from "node:path";

import type { Store } from "./paths.ts";
import { classifyPath } from "./pathclass.ts";
import { reportFiles, roundOf } from "./roles.ts";
import { parseRTable, R_HEADER, type RRow } from "./rtable.ts";
import type { Item } from "./state.ts";

/**
 * The requirement-to-test table of an item's newest implementation report, read
 * against the item and the files it cites. The `r-to-test` closing check
 * (`src/closing.ts`) is the only caller.
 *
 * It proves the citation exists: the file is a test by the same classifier the
 * size check uses, and the line is inside it. It does not prove the test covers
 * the requirement; a reviewer reads that.
 */

/** Characters an `n/a:` reason needs after trimming. */
export const MIN_NA_REASON = 12;

export interface RProblem {
  readonly message: string;
  /** False for a failure to look, which `--force` cannot vouch for. */
  readonly overridable: boolean;
}

const HEADER_TEXT = `| ${R_HEADER.join(" | ")} |`;

/** What every problem's hint says: the one place the format is named for the person fixing it. */
export const R_HINT = `the table is headed ${HEADER_TEXT} with one row per requirement id (A<n> in acceptance order, or R<n> of the spec on the spec path); Where is path:line of test files, or n/a: and a reason of ${MIN_NA_REASON}+ characters; agents/implementer.md defines it`;
const posixPath = (p: string): string => p.split(sep).join("/");

/** The newest implementation report: the highest round, among files with no lens. */
function newestReport(store: Store, slug: string): string | undefined {
  let best: { file: string; round: number } | undefined;
  for (const file of reportFiles(store.progress, "impl", slug)) {
    const { round, lens } = roundOf(file, "impl", slug);
    if (lens !== undefined) continue;
    if (best === undefined || round > best.round) best = { file, round };
  }
  return best?.file;
}

/** The ids the table has to cover, with a label to quote for each, or a problem. */
function requirementIds(store: Store, item: Item): { ids: Map<string, string> } | { problem: RProblem } {
  const ids = new Map<string, string>();
  if (item.sdd !== true) {
    item.acceptance.forEach((bullet, i) => {
      ids.set(`A${i + 1}`, bullet.length > 60 ? `${bullet.slice(0, 57)}...` : bullet);
    });
    return { ids };
  }
  const spec = join(store.specs, item.slug, "spec.md");
  const shown = posixPath(relative(store.root, spec));
  let text: string;
  try {
    text = readFileSync(spec, "utf8");
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    return {
      problem: {
        message: missing
          ? `${shown} does not exist, so the requirement ids to map are unknown`
          : `${shown} could not be read: ${(error as Error).message}`,
        overridable: missing,
      },
    };
  }
  for (const m of text.matchAll(/^###[ \t]+Requirement:[ \t]+(R\d+)\b/gm)) ids.set(m[1] as string, "");
  if (ids.size === 0) {
    return { problem: { message: `${shown} has no requirement ids to map (### Requirement: R<n> <name>)`, overridable: true } };
  }
  return { ids };
}

function lineCount(file: string): number {
  const data = readFileSync(file);
  let n = 0;
  for (const byte of data) if (byte === 10) n += 1;
  return data.length > 0 && data[data.length - 1] !== 10 ? n + 1 : n;
}

/** What is wrong with one citation of a Where cell, or undefined. */
function citationProblem(store: Store, raw: string, counts: Map<string, number>): string | undefined {
  const text = raw.replace(/`/g, "").trim();
  // `path:line`, `path:from-to`, and either with a `:column` after it, which is ignored
  // (editors and stack traces print one; the table proves a line, not a column).
  const m = /^(.+?):(\d+)(?:-(\d+))?(?::\d+)?$/.exec(text);
  if (m === null) return `"${text}" is not path:line`;
  const path = m[1] as string;
  const from = Number(m[2]);
  const to = m[3] === undefined ? from : Number(m[3]);
  const norm = posix.normalize(path.trim());
  if (isAbsolute(norm) || norm === ".." || norm.startsWith("../")) return `${text} is outside the store's root`;
  const rel = norm.replace(/^\.\//, "");
  const kind = classifyPath(rel);
  if (kind !== "test") return `${text} is not a test file (the path classifier calls it ${kind})`;
  const file = join(store.root, rel);
  let size: number | undefined;
  try {
    if (statSync(file).isDirectory()) return `${text} is a directory, not a test file`;
    const inside = relative(realpathSync(store.root), realpathSync(file));
    if (inside.startsWith("..") || isAbsolute(inside)) return `${text} is outside the store's root`;
    size = counts.get(rel) ?? lineCount(file);
    counts.set(rel, size);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR"
      ? `${text} names a file that does not exist`
      : `${text} could not be read (${code ?? (error as Error).message})`;
  }
  if (from < 1 || to < 1) return `${text} is not a line; lines start at 1`;
  if (to < from) return `${text} runs backwards`;
  if (to > size) return `${text} is past the end of ${rel}, which has ${size} lines`;
  return undefined;
}

function rowProblems(store: Store, row: RRow, counts: Map<string, number>): string[] {
  const [, , where = ""] = row.cells;
  const label = `line ${row.line} (${row.cells[0]})`;
  if (where.startsWith("n/a:")) {
    const reason = where.slice("n/a:".length).trim();
    return reason.length >= MIN_NA_REASON
      ? []
      : [`${label}: the n/a: reason "${reason}" has ${reason.length} characters, and needs at least ${MIN_NA_REASON}`];
  }
  const cites = where.split(/<br\s*\/?>|,/i).map((c) => c.trim()).filter((c) => c !== "");
  if (cites.length === 0) return [`${label}: the Where cell is empty`];
  return cites.flatMap((c) => {
    const problem = citationProblem(store, c, counts);
    return problem === undefined ? [] : [`${label}: ${problem}`];
  });
}

/**
 * Every problem with the item's table. Empty for an item with no `base` and for
 * one that is closed or cancelled: items from before the check existed are never
 * held to it.
 */
export function rTableProblems(store: Store, item: Item): RProblem[] {
  if (item.base === undefined || item.status === "done" || item.status === "cancelled") return [];
  const file = newestReport(store, item.slug);
  if (file === undefined) {
    const first = posixPath(relative(store.root, join(store.progress, `impl_${item.slug}.md`)));
    return [{ message: `it has no implementation report to read, ${first} or a later round of it`, overridable: true }];
  }
  const shown = posixPath(relative(store.root, file));
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    return [{ message: `${shown} could not be read: ${(error as Error).message}`, overridable: false }];
  }
  const want = requirementIds(store, item);
  if ("problem" in want) return [want.problem];
  const table = parseRTable(text);
  if (!table.found) return [{ message: `${shown} has no table headed ${HEADER_TEXT}`, overridable: true }];

  const found: string[] = table.problems.map((p) => `${shown} ${p}`);
  const covered = new Set<string>();
  const counts = new Map<string, number>();
  for (const row of table.rows) {
    const named = (row.cells[0] ?? "").split(",").map((s) => s.replace(/`/g, "").trim()).filter((s) => s !== "");
    if (named.length === 0) found.push(`${shown} line ${row.line} names no requirement id in its first cell`);
    for (const id of named) {
      if (want.ids.has(id)) covered.add(id);
      else found.push(`${shown} line ${row.line} names ${id}, which this item does not have (it has ${[...want.ids.keys()].join(", ")})`);
    }
    found.push(...rowProblems(store, row, counts).map((p) => `${shown} ${p}`));
  }
  for (const [id, label] of want.ids) {
    if (!covered.has(id)) found.push(`${shown} has no row for ${id}${label === "" ? "" : ` ("${label}")`}`);
  }
  return found.map((message) => ({ message, overridable: true }));
}
