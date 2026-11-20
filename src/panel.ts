import type { Store } from "./paths.ts";
import { JUSTIFY_FROM_ROUND, reportFiles, roundOf, substantialReports } from "./roles.ts";
import type { Item } from "./state.ts";

/**
 * A size l item is reviewed by a panel (skills/router/references/size-matrix.md):
 * at least one review round of it has `PANEL_MIN_LENSES` lens reports or more.
 *
 * A lens report is a file `mstack fanout plan --kind review --worker <lens>`
 * names, read by `roundOf`, the reader `--solo` and the review budget use:
 * `review_<slug>_<lens>.md` is round 1, `review_<slug>_r<N>-<lens>.md` round N.
 * One under the stub floor is not a report. Any round counts, so the lone review
 * the review skill sends a later round to does not undo the panel before it.
 * Closed and cancelled items are not read.
 */

/** How many lens reports one round needs. */
export const PANEL_MIN_LENSES = 2;

export interface PanelProblem {
  /** Phrased to follow "and " in the gate and "cannot close: " in `state set`. */
  readonly message: string;
  readonly hint: string;
}

export function panelProblems(store: Store, item: Item): PanelProblem[] {
  if (item.size !== "l" || item.status === "done" || item.status === "cancelled") return [];

  const lenses = new Map<number, string[]>();
  const lone = new Set<number>();
  for (const file of substantialReports(store.progress, "review", item.slug)) {
    const { round, lens } = roundOf(file, "review", item.slug);
    if (lens === undefined) lone.add(round);
    else lenses.set(round, [...(lenses.get(round) ?? []), lens]);
  }
  for (const names of lenses.values()) if (names.length >= PANEL_MIN_LENSES) return [];

  const rounds = [...new Set([...lone, ...lenses.keys()])].sort((a, b) => a - b);
  const found = rounds.length === 0
    ? "it has no review report"
    : rounds
        .map((round) => {
          const has: string[] = [];
          if (lone.has(round)) has.push("a lone review");
          const names = lenses.get(round) ?? [];
          if (names.length > 0) has.push(`${names.length} lens report${names.length === 1 ? "" : "s"} (${names.join(", ")})`);
          return `round ${round} has ${has.join(" and ")}`;
        })
        .join("; ");

  // The next round is numbered as `--solo` numbers it: one more than the highest
  // round of any review report on disk, a stub's included.
  let highest = 0;
  for (const file of reportFiles(store.progress, "review", item.slug)) highest = Math.max(highest, roundOf(file, "review", item.slug).round);
  const next = highest + 1;
  const plan = `mstack fanout plan --kind review${next > 1 ? ` --round ${next}` : ""} --worker correctness --worker tests`;
  const row = next >= JUSTIFY_FROM_ROUND ? `, and record its review-r${next} decision row ('mstack decide --phase review-r${next} --item ${item.slug} ...')` : "";
  return [
    {
      message: `it is size l, and no review round of it has ${PANEL_MIN_LENSES} or more lens reports: ${found}`,
      hint: `a size l item closes on a review panel: '${plan}' allocates ${PANEL_MIN_LENSES} lens reports for round ${next}; launch one reviewer per path${row}`,
    },
  ];
}
