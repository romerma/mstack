import { headSha } from "./git.ts";
import type { Store } from "./paths.ts";
import type { Item, State } from "./state.ts";
import * as verification from "./verification.ts";

/**
 * Everything that has to be true before an item may close, as one list.
 *
 * `state set --status done` refuses on a non-empty answer and the gate reports
 * the same answer for the item at `verifying`, so the two cannot disagree. This
 * module does not import the gate, and adding a check is one line in `CHECKS`.
 */

/** Each check returns zero or more problems, phrased to follow "and ". */
type Check = (store: Store, state: State, item: Item, tree: string | undefined) => string[];

const UNREADABLE = "its verification runs could not be read, so nothing here can say whether it was verified: ";

/** True for the one problem that is a failure to look, not a finding; `--force` does not override it. */
export function isUnreadable(problem: string): boolean {
  return problem.startsWith(UNREADABLE);
}

const verificationReceipts: Check = (store, state, item, tree) => {
  const sha = headSha(store);
  if (sha === null) return [];
  try {
    return [...verification.status(store, state, item, sha, tree).problems];
  } catch (error) {
    // Fails closed: an unreadable record of what ran is not a record that anything did.
    return [`${UNREADABLE}${(error as Error).message}`];
  }
};

const CHECKS: readonly Check[] = [verificationReceipts];

/**
 * @param tree a working-tree fingerprint the caller already computed, to avoid hashing twice.
 */
export function closingProblems(store: Store, state: State, item: Item, tree?: string): string[] {
  return CHECKS.flatMap((check) => check(store, state, item, tree));
}
