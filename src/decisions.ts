import type { Store } from "./paths.ts";
import { append, readRecords, withLock } from "./tsv.ts";

/**
 * The decision trail. One row is one decision or checkpoint; if it does not fit
 * on one line, the decision is not crisp yet. Append-only: a wrong call gets a
 * new row that supersedes it, never an edit.
 */

export const HEADER = ["ts", "phase", "decision", "why", "evidence", "result", "resolves"] as const;

export interface Decision {
  ts: string;
  phase: string;
  decision: string;
  why: string;
  /** A link or path that proves it. Never a paragraph. */
  evidence: string;
  result: string;
  /**
   * The slug of the item whose `decision_required` fork this row answers, if any.
   *
   * The link has to live on the row as well as on the item. With it only on the
   * item, the pointer named a timestamp and nothing more: a row about tabs
   * versus spaces closed a fork about a public API contract, because no column
   * said which fork a row was about.
   */
  resolves: string;
}

/**
 * A timestamp is not a key.
 *
 * Twelve concurrent `mstack decide` calls produced eight distinct millisecond
 * timestamps, and fan-out is a shipped feature, so that is the designed
 * workflow rather than a stress test. A pointer that resolved to two rows could
 * name two contradictory answers with the gate green. Bumping past a taken
 * timestamp keeps the column readable and ordered while making it unique.
 */
function freeTimestamp(store: Store, wanted: string): string {
  const taken = new Set(all(store).map((decision) => decision.ts));
  if (!taken.has(wanted)) return wanted;
  let at = Date.parse(wanted);
  if (Number.isNaN(at)) return wanted;
  while (taken.has(new Date(at).toISOString())) at += 1;
  return new Date(at).toISOString();
}

export function add(store: Store, entry: Omit<Decision, "ts" | "resolves"> & { ts?: string; resolves?: string }): Decision {
  // The uniqueness check and the append are one critical section. Apart, they
  // are a read followed by a write with every other process free to run in
  // between, which is exactly how the duplicate timestamps happened.
  return withLock(store.decisions, () => {
    const full: Decision = {
      ...entry,
      resolves: entry.resolves ?? "",
      ts: freeTimestamp(store, entry.ts ?? new Date().toISOString()),
    };
    append(store.decisions, HEADER, [
      full.ts,
      full.phase,
      full.decision,
      full.why,
      full.evidence,
      full.result,
      full.resolves,
    ]);
    return full;
  });
}

export function all(store: Store): Decision[] {
  return readRecords(store.decisions).map((r) => ({
    ts: r["ts"] ?? "",
    phase: r["phase"] ?? "",
    decision: r["decision"] ?? "",
    why: r["why"] ?? "",
    evidence: r["evidence"] ?? "",
    result: r["result"] ?? "",
    resolves: r["resolves"] ?? "",
  }));
}
