import { execFileSync } from "node:child_process";

import { UserError, type Store } from "./paths.ts";
import { append, readRecords } from "./tsv.ts";

/**
 * The verification ledger.
 *
 * This is the piece of pstack that actually gates, because it is code with a
 * typed enum rather than prose asking nicely. Two rules travel with it:
 * CI green is an *input* to a verdict, never a verdict; and a new head SHA
 * voids the row. pstack's own orchestrate playbook records twenty-one verdicts
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

  const best = here.reduce((a, b) => (RANK[b.verdict] > RANK[a.verdict] ? b : a));
  const passing = RANK[best.verdict] >= RANK[min];
  return {
    passing,
    best,
    stale,
    reason: passing
      ? `${best.verdict} at ${short(sha)} by ${best.verifier || "unknown"}`
      : `best verdict at ${short(sha)} is ${best.verdict}, which does not clear ${min}`,
  };
}

function short(sha: string): string {
  return sha.slice(0, 8);
}
