import { headSha } from "./git.ts";
import { VERIFICATION_REQUIRED_FROM, type Status } from "./lifecycle.ts";
import type { Store } from "./paths.ts";
import type { Item, State } from "./state.ts";
import * as verification from "./verification.ts";

/**
 * Everything that has to be true before an item may close, as one list.
 *
 * `state set --status done` runs every check and refuses on any problem. The
 * gate runs the checks whose `reportedAt` includes the active item's status, so
 * it flags an item one step from done by the same answer `state set` will give.
 * This module does not import the gate. Adding a check is one entry in
 * `CLOSING_CHECKS`; nothing in the gate or the CLI changes.
 */

export interface ClosingProblem {
  /** Which check found it. */
  readonly check: string;
  /** Phrased to follow "and " in the gate and "cannot close: " in `state set`. */
  readonly message: string;
  /** What to do about it. */
  readonly hint: string;
  /** False for a failure to look, which `--force` cannot vouch for. */
  readonly overridable: boolean;
}

export interface ClosingCheck {
  readonly name: string;
  /** The statuses at which the gate reports this check. `state set` always runs it. */
  readonly reportedAt: readonly Status[];
  readonly run: (store: Store, state: State, item: Item, tree: string | undefined) => ClosingProblem[];
}

export const VERIFICATION_CHECK = "verification";

const verificationReceipts: ClosingCheck = {
  name: VERIFICATION_CHECK,
  reportedAt: VERIFICATION_REQUIRED_FROM,
  run: (store, state, item, tree) => {
    // Before the tree fingerprint, which is the expensive part and has nothing to
    // compare when no command is required.
    if (verification.obligations(state, item).length === 0) return [];
    const sha = headSha(store);
    if (sha === null) return [];
    try {
      return verification.status(store, state, item, sha, tree).problems.map((message) => ({
        check: VERIFICATION_CHECK,
        message,
        hint: "run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check",
        overridable: true,
      }));
    } catch (error) {
      // Fails closed: an unreadable record of what ran is not a record that anything did.
      return [
        {
          check: VERIFICATION_CHECK,
          message: `its verification runs could not be read, so nothing here can say whether it was verified: ${(error as Error).message}`,
          hint: "fix the file or delete it and re-run 'mstack gate --full'; an unreadable record of what ran is not a record that anything did",
          overridable: false,
        },
      ];
    }
  },
};

/** Exported mutable so a test can register a second check; production code never does. */
export const CLOSING_CHECKS: ClosingCheck[] = [verificationReceipts];

/**
 * Every problem that stops this item closing.
 *
 * @param tree a working-tree fingerprint the caller already computed, to avoid hashing twice.
 */
export function closingProblems(store: Store, state: State, item: Item, tree?: string): ClosingProblem[] {
  return CLOSING_CHECKS.flatMap((check) => check.run(store, state, item, tree));
}

/** The subset the gate reports for an item at its current status. */
export function gateProblems(store: Store, state: State, item: Item, tree?: string): ClosingProblem[] {
  return CLOSING_CHECKS.filter((check) => check.reportedAt.includes(item.status)).flatMap((check) =>
    check.run(store, state, item, tree),
  );
}
