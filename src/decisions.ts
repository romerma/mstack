import type { Store } from "./paths.ts";
import { append, readRecords } from "./tsv.ts";

/**
 * The decision trail. One row is one decision or checkpoint; if it does not fit
 * on one line, the decision is not crisp yet. Append-only: a wrong call gets a
 * new row that supersedes it, never an edit.
 */

export const HEADER = ["ts", "phase", "decision", "why", "evidence", "result"] as const;

export interface Decision {
  ts: string;
  phase: string;
  decision: string;
  why: string;
  /** A link or path that proves it. Never a paragraph. */
  evidence: string;
  result: string;
}

export function add(store: Store, entry: Omit<Decision, "ts"> & { ts?: string }): Decision {
  const full: Decision = { ...entry, ts: entry.ts ?? new Date().toISOString() };
  append(store.decisions, HEADER, [
    full.ts,
    full.phase,
    full.decision,
    full.why,
    full.evidence,
    full.result,
  ]);
  return full;
}

export function all(store: Store): Decision[] {
  return readRecords(store.decisions).map((r) => ({
    ts: r["ts"] ?? "",
    phase: r["phase"] ?? "",
    decision: r["decision"] ?? "",
    why: r["why"] ?? "",
    evidence: r["evidence"] ?? "",
    result: r["result"] ?? "",
  }));
}
