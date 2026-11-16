import { execFileSync } from "node:child_process";

import { UserError, type Store } from "./paths.ts";
import { canCloseAnItem, citesImplementingReport } from "./roles.ts";
import { append, readRecords } from "./tsv.ts";

/**
 * The verification ledger.
 *
 * This is the piece of pstack that actually gates, because it is code with a
 * typed enum rather than prose asking nicely. Two rules travel with it:
 * CI green is an *input* to a verdict, never a verdict; and a new head SHA
 * voids the row. pstack's own shipping playbook records twenty-one verdicts
 * going stale in a single run with no signal at all, which is what happens when
 * the second rule is left to memory.
 */

export const VERDICTS = [
  "live-verified",
  "test-verified",
  "type-check-only",
  "verifier-blocked",
  "verifier-failed",
] as const;

export type Verdict = (typeof VERDICTS)[number];

/** Higher clears more. A blocked or failed verifier clears nothing. */
const RANK: Readonly<Record<Verdict, number>> = {
  "live-verified": 3,
  "test-verified": 2,
  "type-check-only": 1,
  "verifier-blocked": 0,
  "verifier-failed": 0,
};

export const HEADER = ["target", "sha", "verdict", "evidence", "verifier", "ts"] as const;

export function isVerdict(value: string): value is Verdict {
  return (VERDICTS as readonly string[]).includes(value);
}

export interface Entry {
  target: string;
  sha: string;
  verdict: Verdict;
  evidence: string;
  verifier: string;
  ts: string;
}

/** Short enough for "python3 -m pytest -q", long enough to exclude "x". */
const MIN_EVIDENCE = 8;

function isCommit(store: Store, sha: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
      cwd: store.root,
      stdio: "ignore",
      timeout: 5_000,
    });
    return true;
  } catch {
    return false;
  }
}

export function record(store: Store, entry: Omit<Entry, "ts"> & { ts?: string }): Entry {
  if (entry.sha.trim() === "") {
    throw new UserError(
      "a ledger row needs the head SHA it was produced against",
      "pass the output of 'git rev-parse HEAD'",
    );
  }
  if (entry.evidence.trim().length < MIN_EVIDENCE) {
    throw new UserError(
      `a ledger row needs evidence, and "${entry.evidence.trim()}" is not any`,
      "a command, a file path, a run URL - something a reviewer can re-open",
    );
  }
  // The row is sold as "keyed by (target, sha)". Half that key was unvalidated:
  // forty zeros recorded fine and read back indistinguishable from a real
  // commit, so a verdict could name a state of the repository that never was.
  if (!isCommit(store, entry.sha)) {
    throw new UserError(
      `${entry.sha.slice(0, 12)} is not a commit in this repository`,
      "pass the output of 'git rev-parse HEAD'; a verdict against a SHA that does not exist proves nothing",
    );
  }
  const full: Entry = { ...entry, ts: entry.ts ?? new Date().toISOString() };
  append(store.ledger, HEADER, [
    full.target,
    full.sha,
    full.verdict,
    full.evidence,
    full.verifier,
    full.ts,
  ]);
  return full;
}

export function entries(store: Store): Entry[] {
  return readRecords(store.ledger)
    .filter((r) => isVerdict(r["verdict"] ?? ""))
    .map((r) => ({
      target: r["target"] ?? "",
      sha: r["sha"] ?? "",
      verdict: r["verdict"] as Verdict,
      evidence: r["evidence"] ?? "",
      verifier: r["verifier"] ?? "",
      ts: r["ts"] ?? "",
    }));
}

export interface CheckResult {
  readonly passing: boolean;
  readonly best: Entry | undefined;
  /** Rows for this target recorded against some *other* SHA. */
  readonly stale: readonly Entry[];
  readonly reason: string;
}

/**
 * Does `target` hold a verdict at `sha` that clears `min`?
 *
 * Judged by the latest row from a role that can close an item; see below.
 *
 * Rows recorded against a different SHA are reported as stale rather than
 * ignored, because "there was a verdict once" is the exact story that gets a
 * rewritten stack merged.
 */
export function check(
  store: Store,
  target: string,
  sha: string,
  min: Verdict = "test-verified",
): CheckResult {
  const all = entries(store).filter((e) => e.target === target);
  const here = all.filter((e) => e.sha === sha);
  const stale = all.filter((e) => e.sha !== sha);

  if (here.length === 0) {
    return {
      passing: false,
      best: undefined,
      stale,
      reason:
        stale.length > 0
          ? `no verdict at ${short(sha)}; ${stale.length} row(s) exist at other SHAs and a new head SHA voids them`
          : `no verdict recorded for ${target}`,
    };
  }

  // The rows the gate's closing audit reads (`checkClosedItems`): a role that can
  // close an item. An APPROVAL whose evidence points at an implementing role's own
  // report is that report under a reviewer's name, and the gate drops it. A
  // REJECTION is never dropped: citing the report it rejects is ordinary prose,
  // and discarding it could only hide a failure.
  const byCloser = here.filter((e) => canCloseAnItem(e.verifier));
  const isRejection = (e: Entry) => e.verdict === "verifier-failed" || e.verdict === "verifier-blocked";
  const closing = byCloser.filter((e) => isRejection(e) || citesImplementingReport(e.evidence, target) === undefined);
  const discounted = byCloser.filter((e) => !closing.includes(e));

  // The latest closing row is the answer, not the best-ranked row: a rejection
  // after an approval retracts it, and an approval after a rejection answers it.
  // "Latest" is row order, which is append order. The `ts` column is not used:
  // a row can be recorded with an explicit `ts`, rows from two machines can
  // carry skewed clocks, and the gate's audit already orders by position, so
  // the two cannot disagree about which row is last.
  const latest = closing[closing.length - 1];
  if (latest !== undefined) {
    const by = latest.verifier || "unknown";
    if (isRejection(latest)) {
      return {
        passing: false,
        best: latest,
        stale,
        reason: `${latest.verdict} at ${short(sha)} by ${by} rejects this commit, whatever an implementing role recorded (evidence: ${latest.evidence})`,
      };
    }
    const passing = RANK[latest.verdict] >= RANK[min];
    return {
      passing,
      best: latest,
      stale,
      reason: passing
        ? `${latest.verdict} at ${short(sha)} by ${by}`
        : `latest closing verdict at ${short(sha)} is ${latest.verdict} by ${by}, which does not clear ${min}`,
    };
  }

  // Closing-role approvals exist but every one cites the implementer's own report:
  // the gate refuses to close on that, so `check` fails and says why rather than
  // printing it as an independent PASS.
  const forged = discounted[discounted.length - 1];
  if (forged !== undefined) {
    return {
      passing: false,
      best: forged,
      stale,
      reason: `${forged.verdict} at ${short(sha)} by ${forged.verifier} cites the implementer's own report (evidence: ${forged.evidence}), so it is not an independent approval`,
    };
  }

  // No closing-role row: every row here is the author's own, so the best-ranked
  // one is kept as before, and the message says whose verdict it is so nobody
  // reads it as an independent approval.
  const best = here.reduce((a, b) => (RANK[b.verdict] > RANK[a.verdict] ? b : a));
  const passing = RANK[best.verdict] >= RANK[min];
  return {
    passing,
    best,
    stale,
    reason: passing
      ? `${best.verdict} at ${short(sha)} by ${best.verifier || "unknown"} (the author's own verdict, not an independent approval)`
      : `best verdict at ${short(sha)} is ${best.verdict}, which does not clear ${min} (the author's own verdict)`,
  };
}

function short(sha: string): string {
  return sha.slice(0, 8);
}
