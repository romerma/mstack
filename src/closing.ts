import { budgetProblems } from "./budget.ts";
import { headSha } from "./git.ts";
import { describeRow, entries as ledgerEntries, readVerdict, sameCommit } from "./ledger.ts";
import { requiresVerification, VERIFICATION_REQUIRED_FROM, type Status } from "./lifecycle.ts";
import type { Store } from "./paths.ts";
import { R_HINT, rTableProblems } from "./rcheck.ts";
import { typedName } from "./roles.ts";
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
      : `; it was recorded against another commit than the one being closed, and only a later independent approval answers it`;
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

export const INDEPENDENT_VERDICT_CHECK = "independent-verdict";

/** What the gate says about an item closed on the author's own verdicts, and what `state set` says at the door. Shared so the two cannot drift. */
export const SELF_CLOSED_FIX =
  "a closing verdict has to come from a pass that did not write the code; run the verification again from one and record the row under a name that is not the author's (your own name, or `ci`), or, if no check could be run, record `verifier-blocked` under such a name";
export const FORGED_IMPL_FIX =
  "a closing verdict needs evidence from the closing pass's own work, not a pointer to the implementer's report; re-run the check and record what actually happened";
export const FORGED_SPEC_FIX =
  "a closing verdict needs evidence from the closing pass's own work, not a pointer to the spec-author's report; re-run the check and record what actually happened";

/**
 * An independent verdict, from a role that did not write the work.
 *
 * The gate audits every closed item for this (`checkClosedItems`) and went red
 * AFTER `state set --status done` had succeeded: the close and the audit asked
 * different questions. This asks the audit's question at the door, through the
 * audit's reader (`readVerdict`) over the same rows (every row of the item: an
 * item records no closing commit, and the gate accepts a verdict at any sha), so
 * the two agree on every sequence with a row. Refused: rows that are only the
 * author's (an implementing role's name, `self`, an empty verifier: see
 * `canCloseAnItem`), and approvals whose evidence is the implementing pass's own
 * report. A rejection is `standingRejection`'s, and a `verifier-blocked` is the
 * documented escape hatch and closes.
 *
 * Held only while `rules.require_verdict_to_close` is on, the rule the gate's
 * audit is held to.
 *
 * Not overridable, for the reason `standingRejection` is not: `--force` would
 * only close the item over a finding the gate holds against every closed item
 * for as long as the ledger carries it, leaving the store red with the item out
 * of the active set. The way out that exists is a `verifier-blocked` row from a
 * pass that did not write the work, and an independent approval.
 */
const independentVerdict: ClosingCheck = {
  name: INDEPENDENT_VERDICT_CHECK,
  reportedAt: [],
  run: (store, state, item) => {
    if (!state.rules.require_verdict_to_close) return [];
    let rows;
    try {
      rows = ledgerEntries(store).filter((e) => e.target === item.slug);
    } catch {
      // `standingRejection` reports an unreadable ledger, and fails closed.
      return [];
    }
    const refuse = (message: string, hint: string): ClosingProblem[] => [{ check: INDEPENDENT_VERDICT_CHECK, message, hint, overridable: false }];
    const reading = readVerdict(rows, item.slug);
    // No row at all is left to the gate (`items marked done with no ledger verdict`): a close with none is
    // what many callers do before a verdict exists, and this check is about whose verdict stands.
    if (reading === undefined) return [];
    if (reading.kind === "author-only") {
      const names = [...new Set(rows.map((r) => typedName(r.verifier) || "unnamed"))].join(", ");
      return refuse(`its only verdicts are from the pass that wrote the code (only ${names})`, SELF_CLOSED_FIX);
    }
    if (reading.kind === "discounted") {
      const own = (role: string) => [...new Set(reading.discounted.filter((d) => d.role === role).map((d) => d.entry.verifier || "unnamed"))];
      const impl = own("implementer");
      return impl.length > 0
        ? refuse(`its closing verdict cites the implementer's own report (${impl.join(", ")})`, FORGED_IMPL_FIX)
        : refuse(`its closing verdict cites the spec-author's own report (${own("spec-author").join(", ")})`, FORGED_SPEC_FIX);
    }
    return [];
  },
};

export const R_TO_TEST_CHECK = "r-to-test";

/**
 * The requirement-to-test table of the newest implementation report, read.
 *
 * Reported by the gate from `reviewing` (and so at `verifying`) and run at the
 * `done` transition, for an item with a `base` only: items from before this
 * check have none and are never held to it, and closed and cancelled items are
 * never read. See `src/rcheck.ts` for what is read and what is proved.
 *
 * Overridable, like the verification receipts: a table problem is a finding about
 * the report that `--force` with a recorded `--closed-by` may vouch for (the
 * requirement is covered by something the table cannot cite). A report that
 * exists and cannot be read is a failure to look, and is not.
 */
const requirementTable: ClosingCheck = {
  name: R_TO_TEST_CHECK,
  reportedAt: ["reviewing"],
  run: (store, _state, item) =>
    rTableProblems(store, item).map((p) => ({
      check: R_TO_TEST_CHECK,
      message: p.message,
      hint: R_HINT,
      overridable: p.overridable,
    })),
};

export const REVIEW_BUDGET_CHECK = "review-budget";

/**
 * The budget of an item's reports: a round 3 or later review report has its
 * decision row, and no report is over 24 KB (`src/budget.ts`).
 *
 * Reported at every active status, because a report grows long before review,
 * and run at the `done` transition, because an item that is no longer active
 * is no longer looked at by the gate. For an item with a `base` only.
 *
 * Not overridable. `--force` vouches for a finding about what the work proved;
 * these are about a file, and the fix (a row, a shorter report) is cheaper than
 * the reason a forced close would have to give.
 */
const reviewBudget: ClosingCheck = {
  name: REVIEW_BUDGET_CHECK,
  reportedAt: ["specifying", "spec_ready", "in_progress", "reviewing"],
  run: (store, _state, item) =>
    budgetProblems(store, item).map((p) => ({ check: REVIEW_BUDGET_CHECK, message: p.message, hint: p.hint, overridable: false })),
};

/** Exported mutable so a test can register a second check; production code never does. */
export const CLOSING_CHECKS: ClosingCheck[] = [verificationReceipts, standingRejection, independentVerdict, requirementTable, reviewBudget];

/**
 * Every problem that stops this item closing.
 *
 * @param tree a working-tree fingerprint the caller already computed, to avoid hashing twice.
 */
export function closingProblems(store: Store, state: State, item: Item, tree?: string): ClosingProblem[] {
  return CLOSING_CHECKS.flatMap((check) => check.run(store, state, item, tree));
}

/** The subset the gate reports for an item at its current status, less the checks named in `except` (`--full` leaves out the receipts it is about to write). */
export function gateProblems(store: Store, state: State, item: Item, tree?: string, except: readonly string[] = []): ClosingProblem[] {
  const atTheDoor = requiresVerification(item.status);
  return CLOSING_CHECKS.filter((check) => !except.includes(check.name) && (atTheDoor || check.reportedAt.includes(item.status))).flatMap((check) =>
    check.run(store, state, item, tree),
  );
}
