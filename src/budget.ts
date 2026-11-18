import { statSync } from "node:fs";
import { basename, relative } from "node:path";

import * as decisions from "./decisions.ts";
import type { Store } from "./paths.ts";
import { JUSTIFY_FROM_ROUND, REPORT_KINDS, reportFiles, roundOf } from "./roles.ts";
import type { Item } from "./state.ts";

/**
 * What an item's reports may cost a reader.
 *
 * Ten items of this program took three to five review rounds and wrote reports
 * past what a reviewer reads, and nothing in the tool counted either. Two
 * limits, both read by the gate and by `state set --status done`
 * (`src/closing.ts`), both for an item with a `base` only: an item from before
 * this check has none, and is never held to it.
 *
 *  - a review report of round `JUSTIFY_FROM_ROUND` or later (lone or lensed)
 *    needs a decision row of phase `review-r<N>` whose item is the slug, which
 *    `mstack fanout plan --kind review --solo --justify` writes;
 *  - no report of the item exceeds `MAX_REPORT_BYTES`.
 */

/** The largest a report may be, in bytes: 24 KiB. The one place the number is written. */
export const MAX_REPORT_BYTES = 24576;

/** Where pasted output moves when a report is over the cap and its author is gone; not read as a report, not counted. */
const ATTACHMENTS = ".mstack/progress/attachments";

export interface BudgetProblem {
  /** Phrased to follow "and " in the gate and "cannot close: " in `state set`. */
  readonly message: string;
  readonly hint: string;
}

export function budgetProblems(store: Store, item: Item): BudgetProblem[] {
  if (item.base === undefined || item.status === "done" || item.status === "cancelled") return [];
  const problems: BudgetProblem[] = [];
  const shown = (file: string): string => relative(store.root, file).split("\\").join("/");

  let rows: ReturnType<typeof decisions.all> | undefined;
  try {
    rows = decisions.all(store);
  } catch (error) {
    problems.push({
      message: `decisions.tsv could not be read, so no review round can be matched to its decision row: ${(error as Error).message}`,
      hint: "fix decisions.tsv; the gate reports the same failure under the decision check",
    });
  }

  for (const file of reportFiles(store.progress, "review", item.slug)) {
    const { round } = roundOf(file, "review", item.slug);
    if (round < JUSTIFY_FROM_ROUND || rows === undefined) continue;
    const phase = `review-r${round}`;
    if (rows.some((d) => d.phase === phase && d.item === item.slug)) continue;
    problems.push({
      message: `its review report ${shown(file)} is round ${round} and has no decision row (phase ${phase}, item ${item.slug})`,
      hint: `a round from ${JUSTIFY_FROM_ROUND} on is written down: 'mstack fanout plan --kind review --solo --justify "<why this round is worth it>"' allocates the next round and writes its row; for this report, 'mstack decide --phase ${phase} --item ${item.slug} --decision "<why>" ...' writes the row`,
    });
  }

  for (const kind of new Set(Object.values(REPORT_KINDS))) {
    for (const file of reportFiles(store.progress, kind, item.slug)) {
      let size: number;
      try {
        size = statSync(file).size;
      } catch {
        continue;
      }
      if (size <= MAX_REPORT_BYTES) continue;
      problems.push({
        message: `its report ${shown(file)} is ${size} bytes, over the ${MAX_REPORT_BYTES} byte limit`,
        hint: `cut ${basename(file)} to ${MAX_REPORT_BYTES} bytes or fewer: keep the findings and the lines that matter, and name the file that holds the rest; when the pass that wrote it is gone, the coordinating session moves the pasted output, unchanged, to ${ATTACHMENTS}/${basename(file)} and leaves a pointer in the report, editing no finding and no verdict line (docs/wiki/Gates-and-Hooks.md, "A report over the cap")`,
      });
    }
  }
  return problems;
}
