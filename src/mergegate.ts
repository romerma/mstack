import { execFileSync } from "node:child_process";

import { check as ledgerCheck, type Verdict } from "./ledger.ts";
import { UserError, type Store } from "./paths.ts";

/**
 * The merge gate, as code.
 *
 * enxvo carries this policy as prose in a skill and a runbook, which means an
 * agent has to choose to obey it. The policy is good enough to deserve
 * enforcement: UNSTABLE is not green, a completed FAILURE is a stop even when
 * it is infrastructure, and a job that never started is not a failure. pstack
 * adds the half enxvo lacks: green is not safe. Safe is a verdict from someone
 * who did not write the code, recorded against this exact head SHA.
 */

export type Decision = "GO" | "WAIT" | "STOP";

export const EXIT: Readonly<Record<Decision, number>> = { GO: 0, WAIT: 1, STOP: 2 };

/** mergeStateStatus values that stop a merge outright. */
const BLOCKING_MERGE_STATE = new Set(["BLOCKED", "DIRTY", "UNSTABLE", "UNKNOWN"]);

/**
 * Check conclusions that are failures. A skipped job that never started is not
 * one. `ERROR` is a StatusContext state, and it was in neither this set nor the
 * pending one, so a commit status that errored counted as passing.
 */
const FAILING_CONCLUSIONS = new Set([
  "FAILURE",
  "TIMED_OUT",
  "CANCELLED",
  "STARTUP_FAILURE",
  "ACTION_REQUIRED",
  "STALE",
  "ERROR",
]);

/** `EXPECTED` is a StatusContext that has been promised and has not reported. */
const PENDING_STATUSES = new Set([
  "QUEUED",
  "IN_PROGRESS",
  "PENDING",
  "WAITING",
  "REQUESTED",
  "EXPECTED",
]);

/** The only conclusions that count as a check having passed. */
const PASSING_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

interface CheckRun {
  name?: string;
  status?: string;
  conclusion?: string;
  state?: string;
  __typename?: string;
}

export interface PullRequest {
  number: number;
  state: string;
  isDraft: boolean;
  mergeStateStatus: string;
  reviewDecision: string | null;
  headRefOid: string;
  statusCheckRollup: CheckRun[] | null;
}

export const GH_FIELDS = [
  "number",
  "state",
  "isDraft",
  "mergeStateStatus",
  "reviewDecision",
  "headRefOid",
  "statusCheckRollup",
] as const;

export function fetchPr(store: Store, pr: string): PullRequest {
  let raw: string;
  try {
    raw = execFileSync("gh", ["pr", "view", pr, "--json", GH_FIELDS.join(",")], {
      cwd: store.root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new UserError(
      `gh pr view ${pr} failed`,
      `${(error as Error).message.split("\n")[0]} - check 'gh auth status'`,
    );
  }
  return JSON.parse(raw) as PullRequest;
}

export interface Verdict_ {
  readonly decision: Decision;
  readonly reasons: readonly string[];
  readonly headSha: string;
}

/**
 * Evaluate one PR.
 *
 * Every reason is reported, not just the first, because "fix this, now fix the
 * next thing" is how a merge gate turns into four round trips.
 */
export function evaluate(
  pr: PullRequest,
  options: { ledger?: { store: Store; target: string; min?: Verdict } } = {},
): Verdict_ {
  const stops: string[] = [];
  const waits: string[] = [];
  const notes: string[] = [];

  if (pr.state !== "OPEN") stops.push(`PR is ${pr.state}, not OPEN`);
  if (pr.isDraft) stops.push("PR is a draft");
  if (pr.reviewDecision === "CHANGES_REQUESTED") stops.push("review decision is CHANGES_REQUESTED");
  if (BLOCKING_MERGE_STATE.has(pr.mergeStateStatus)) {
    stops.push(`mergeStateStatus is ${pr.mergeStateStatus}, which is not green`);
  }
  if (pr.mergeStateStatus === "BEHIND") waits.push("branch is behind the base; update it");

  const runs = pr.statusCheckRollup ?? [];
  const failed = runs.filter((r) => FAILING_CONCLUSIONS.has(normalizeConclusion(r)));
  const pending = runs.filter((r) => isPending(r));
  const skipped = runs.filter((r) => normalizeConclusion(r) === "SKIPPED");

  if (failed.length > 0) {
    stops.push(
      `${failed.length} failed check(s): ${failed.map((r) => `${r.name ?? "?"}=${normalizeConclusion(r)}`).join(", ")}`,
    );
  }
  if (pending.length > 0) {
    waits.push(`${pending.length} check(s) still running: ${pending.map((r) => r.name ?? "?").join(", ")}`);
  }
  if (skipped.length > 0) {
    notes.push(`${skipped.length} skipped check(s) ignored; a job that never started is not a failure`);
  }
  if (runs.length === 0) notes.push("no checks reported on this PR");

  // Anything this file does not recognise stops the merge instead of passing
  // through the gaps between the three sets above. GitHub adds states, and a
  // merge gate that says GO on a state it cannot classify is the exact shape
  // this whole plugin exists to stop.
  const unknown = runs.filter((r) => {
    const value = normalizeConclusion(r);
    return (
      !PASSING_CONCLUSIONS.has(value) &&
      !FAILING_CONCLUSIONS.has(value) &&
      !isPending(r)
    );
  });
  if (unknown.length > 0) {
    stops.push(
      `${unknown.length} check(s) in a state this gate does not recognise: ${unknown
        .map((r) => `${r.name ?? "?"}=${normalizeConclusion(r) || "(empty)"}`)
        .join(", ")}`,
    );
  }

  if (options.ledger !== undefined) {
    const { store, target, min } = options.ledger;
    const result = ledgerCheck(store, target, pr.headRefOid, min ?? "test-verified");
    if (result.passing) {
      notes.push(`ledger: ${result.reason}`);
    } else {
      stops.push(`ledger: ${result.reason}`);
    }
  }

  const decision: Decision = stops.length > 0 ? "STOP" : waits.length > 0 ? "WAIT" : "GO";
  return {
    decision,
    reasons: [...stops, ...waits, ...notes],
    headSha: pr.headRefOid,
  };
}

function normalizeConclusion(run: CheckRun): string {
  // Checks come back as CheckRun (status/conclusion) or StatusContext (state).
  return (run.conclusion ?? run.state ?? "").toUpperCase();
}

function isPending(run: CheckRun): boolean {
  const status = (run.status ?? "").toUpperCase();
  if (status !== "" && status !== "COMPLETED") return PENDING_STATUSES.has(status);
  const conclusion = normalizeConclusion(run);
  return conclusion === "" || PENDING_STATUSES.has(conclusion);
}
