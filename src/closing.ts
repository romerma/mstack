import { headSha } from "./git.ts";
import { describeRow, entries as ledgerEntries, readVerdict, sameCommit, short } from "./ledger.ts";
import { requiresVerification, VERIFICATION_REQUIRED_FROM, type Status } from "./lifecycle.ts";
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
  /**
   * Statuses to report at *in addition to* `verifying`. At `verifying` the gate
   * reports every check, because that is one step from done and `state set`
   * would refuse on it; this can only add earlier statuses. `state set` always
   * runs every check.
   */
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

export const LEDGER_VERDICT_CHECK = "ledger-verdict";

/**
 * A standing rejection from a role that can close an item.
 *
 * Reads the rows through `readVerdict`, the function `ledger check` and the
 * gate's audit of closed items also call, twice: over the rows at the commit being
 * closed (what `ledger check` answers for that sha), and over every row of the
 * item (the audit of a closed item cannot do better, because an item records no
 * closing commit). A rejection in either refuses the close. Only a rejection is refused here:
 * "no verdict yet", the author's own verdict and a discounted approval are the
 * audit's findings about an item already closed, and a `verifier-blocked` with no
 * rejection under it is the documented escape hatch for an item nothing can verify.
 *
 * Never overridable. `--force` vouches for a finding the gate does not hold
 * against a closed item; the gate holds a rejection against one for as long as
 * the ledger, which is append-only, carries it, so a forced close would only
 * leave the store red with the item already out of the active set.
 */
const standingRejection: ClosingCheck = {
  name: LEDGER_VERDICT_CHECK,
  reportedAt: [],
  run: (store, _state, item) => {
    let reading;
    let atClosingSha = false;
    try {
      const rows = ledgerEntries(store).filter((e) => e.target === item.slug);
      // The verdict AT the commit being closed, through the reader `ledger check` calls.
      const sha = headSha(store);
      const here = sha === null ? [] : rows.filter((e) => sameCommit(e.sha, sha));
      const atHead = readVerdict(here, item.slug);
      if (atHead?.kind === "rejected") {
        reading = atHead;
        atClosingSha = true;
      } else {
        // And across every sha: a rejection recorded against another commit, after
        // the last approval, is not answered by an approval it was never about.
        reading = readVerdict(rows, item.slug);
      }
    } catch (error) {
      // Fails closed, like the receipts: an unreadable ledger is not a clean one.
      return [
        {
          check: LEDGER_VERDICT_CHECK,
          message: `the ledger could not be read, so nothing here can say whether a rejection stands: ${(error as Error).message}`,
          hint: "fix ledger.tsv; an unreadable record of verdicts is not a record of none",
          overridable: false,
        },
      ];
    }
    if (reading?.kind !== "rejected") return [];
    const later =
      reading.blockedAfter === undefined
        ? ""
        : `; the later verifier-blocked by ${reading.blockedAfter.verifier || "unnamed"} does not answer it`;
    const elsewhere = atClosingSha
      ? ""
      : `; it was recorded against another commit (${short(reading.row.sha)}) and only a later independent approval answers it`;
    return [
      {
        check: LEDGER_VERDICT_CHECK,
        message: `a rejection stands in the ledger: ${describeRow(reading.row)}${later}${elsewhere}`,
        hint: "fix what it found and record an independent approval from a closing role at the new commit; 'could not verify' does not answer a rejection and --force does not close over one",
        overridable: false,
      },
    ];
  },
};

/** Exported mutable so a test can register a second check; production code never does. */
export const CLOSING_CHECKS: ClosingCheck[] = [verificationReceipts, standingRejection];

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
  const atTheDoor = requiresVerification(item.status);
  return CLOSING_CHECKS.filter((check) => atTheDoor || check.reportedAt.includes(item.status)).flatMap((check) =>
    check.run(store, state, item, tree),
  );
}
