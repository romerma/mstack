import { requiresVerification } from "./lifecycle.ts";
import type { Store } from "./paths.ts";
import { append, cell, readRecords } from "./tsv.ts";
import type { Item, State } from "./state.ts";

/**
 * Receipts: which verification command actually ran, where, and how it went.
 *
 * The gap this closes is the one the `Stop` hook could not see. The fast gate
 * touches only the store and the workspace, so `state.verify` and
 * `item.verification` were executed by nothing but a human typing `mstack gate
 * --full`. In one real session an item's `verification` was a non-executable
 * string from intake — half command, half prose — and it stayed red for 230
 * minutes across four agent passes. Nothing noticed, because nothing ran it, and
 * `sh -n` accepts that string. **The only thing that catches a non-executable
 * verification is running it.**
 *
 * So `gate --full` records what it ran here, and the fast gate reads that record
 * back. The split is what keeps the cost bounded: the hook that fires at the end
 * of every turn reads one small TSV, and the thing that takes minutes still only
 * happens when somebody asks for it.
 *
 * Not the ledger, deliberately. A ledger row is a *verdict* by a pass that
 * looked at the work; a receipt is a *fact* about one command exiting. Writing
 * these into `ledger.tsv` would hand them a verifier column that
 * `canCloseAnItem` accepts, so running `gate --full` would close the item — the
 * exact self-closing shape `checkClosedItems` exists to refuse.
 */

export const HEADER = ["target", "sha", "command", "outcome", "ts"] as const;

export type Outcome = "passed" | "failed";

/** The `target` a project-level `verify` command is recorded under. */
export const PROJECT_TARGET = "(project)";

export interface Receipt {
  readonly target: string;
  readonly sha: string;
  readonly command: string;
  readonly outcome: Outcome;
  readonly ts: string;
}

/** One command `gate --full` is obliged to run, and who it belongs to. */
export interface Obligation {
  readonly command: string;
  readonly target: string;
}

/**
 * Every command `mstack gate --full` would run for this state.
 *
 * One function, two callers: the half that *runs* the commands and the half
 * that *checks* they ran. Computing the list twice would let the check demand a
 * command `--full` never runs, which is a gate nobody can turn green.
 */
export function obligations(state: State, item: Item | undefined): Obligation[] {
  const out: Obligation[] = [];
  const project = (state.verify ?? "").trim();
  if (project !== "") out.push({ command: project, target: PROJECT_TARGET });
  const own = (item?.verification ?? "").trim();
  if (own !== "" && item !== undefined) out.push({ command: own, target: item.slug });
  return out;
}

export function record(store: Store, receipt: Omit<Receipt, "ts"> & { ts?: string }): Receipt {
  const full: Receipt = { ...receipt, ts: receipt.ts ?? new Date().toISOString() };
  append(store.verification, HEADER, [full.target, full.sha, full.command, full.outcome, full.ts]);
  return full;
}

export function receipts(store: Store): Receipt[] {
  return readRecords(store.verification)
    .filter((r) => r["outcome"] === "passed" || r["outcome"] === "failed")
    .map((r) => ({
      target: r["target"] ?? "",
      sha: r["sha"] ?? "",
      command: r["command"] ?? "",
      outcome: r["outcome"] as Outcome,
      ts: r["ts"] ?? "",
    }));
}

/**
 * The last time this exact command ran at this exact commit, if ever.
 *
 * Last rather than best, and the difference is the whole point: a command that
 * passed and was then re-run red is red. `check` reads the rows in file order,
 * which is append order.
 *
 * Matched on the command *text*, not on the item. The incident this module
 * exists for was a `verification` field that did not execute; keying a receipt
 * to `(item, sha)` alone would let a green run of the old string vouch for a
 * string edited afterwards. Both sides go through `cell` so the comparison sees
 * what was actually stored.
 */
function lastRun(rows: readonly Receipt[], command: string, sha: string): Receipt | undefined {
  const needle = cell(command);
  let found: Receipt | undefined;
  for (const row of rows) {
    if (row.sha === sha && cell(row.command) === needle) found = row;
  }
  return found;
}

export interface Status {
  readonly required: readonly Obligation[];
  /** Every required command has a passing run at this SHA. Vacuously true when none is required. */
  readonly satisfied: boolean;
  /** One line per command that is not proven green here. Empty when satisfied. */
  readonly problems: readonly string[];
}

export function status(store: Store, state: State, item: Item | undefined, sha: string): Status {
  const required = obligations(state, item);
  if (required.length === 0) return { required, satisfied: true, problems: [] };

  const rows = receipts(store);
  const problems: string[] = [];
  for (const { command } of required) {
    const here = lastRun(rows, command, sha);
    if (here?.outcome === "passed") continue;
    if (here?.outcome === "failed") {
      problems.push(`\`${command}\` ran at ${short(sha)} and failed`);
      continue;
    }
    // "Never" and "not here" are different facts and a reader acts on them
    // differently, so they are never collapsed into one message.
    const elsewhere = rows.filter((row) => cell(row.command) === cell(command));
    problems.push(
      elsewhere.length > 0
        ? `\`${command}\` has not run at ${short(sha)}; ${elsewhere.length} earlier run(s) exist at other commits, and a new commit voids them`
        : `\`${command}\` has never been executed`,
    );
  }
  return { required, satisfied: problems.length === 0, problems };
}

/**
 * Does this item owe a verification run right now?
 *
 * `verifying` and nothing earlier — the reasoning is in `requiresVerification`,
 * and the cost of moving that line is the reason it is written down.
 */
export function isDue(item: Item | undefined): item is Item {
  return item !== undefined && requiresVerification(item.status);
}

function short(sha: string): string {
  return sha.slice(0, 8);
}
