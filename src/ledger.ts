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

/**
 * An abbreviation is hex shorter than a full sha. Resolved through git to the
 * one commit it names, or `undefined` when it names none or several (git refuses
 * an ambiguous prefix). A full sha, or anything that is not hex, is returned
 * as typed: this never makes a git call for the sha `HEAD` produced.
 *
 * Rows are keyed by the exact string, so an abbreviation that is not resolved
 * before it is stored or compared is a row nobody can find again.
 */
const ABBREVIATED = /^[0-9a-f]{4,39}$/i;

export function resolveSha(store: Store, sha: string): string | undefined {
  if (!ABBREVIATED.test(sha)) return sha;
  try {
    const full = execFileSync("git", ["rev-parse", "--verify", "--quiet", `${sha}^{commit}`], {
      cwd: store.root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    }).trim();
    return full === "" ? undefined : full;
  } catch {
    return undefined;
  }
}

/**
 * Is this row at that commit? The same string, or a row recorded with an
 * abbreviation before `record` resolved them (one such row, `9b36340`, is in this
 * repository's append-only ledger) that is a prefix of the full sha. A string
 * comparison: no git call, because the status line reads through here.
 */
export function sameCommit(rowSha: string, sha: string): boolean {
  if (rowSha === sha) return true;
  return rowSha.length >= 7 && rowSha.length < sha.length && ABBREVIATED.test(rowSha) && sha.toLowerCase().startsWith(rowSha.toLowerCase());
}

export function record(store: Store, entry: Omit<Entry, "ts"> & { ts?: string }): Entry {
  if (entry.target.trim() === "") {
    throw new UserError(
      "a ledger row needs a target: the item slug it is a verdict about",
      "pass the slug first: 'mstack ledger record <slug> <sha> <verdict> ...'",
    );
  }
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
  const sha = resolveSha(store, entry.sha);
  if (sha === undefined || !isCommit(store, sha)) {
    throw new UserError(
      `${entry.sha.slice(0, 12)} is not a commit in this repository`,
      "pass the output of 'git rev-parse HEAD'; a verdict against a SHA that does not exist proves nothing, and an abbreviation that matches two commits is refused like one that matches none",
    );
  }
  const full: Entry = { ...entry, sha, ts: entry.ts ?? new Date().toISOString() };
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

/**
 * What the rows for one target say, as a kind.
 *
 * - `approved`: the latest closing-role row that counts is an approval, and no
 *   rejection stands over it.
 * - `rejected`: a closing role said `verifier-failed` and no later independent
 *   approval has answered it. A `verifier-blocked` after it is "could not
 *   verify", not an answer, so it does not lift the rejection.
 * - `blocked`: the latest closing row is a `verifier-blocked` with no rejection
 *   under it: nothing could be run. The gate lets that close (the documented
 *   escape hatch for an item nothing can verify); `ledger check` fails it.
 * - `discounted`: every closing-role row is an approval whose evidence cites an
 *   implementing role's own report, so none is independent.
 * - `author-only`: no row is from a role that can close an item.
 */
export type VerdictKind = "approved" | "rejected" | "blocked" | "discounted" | "author-only";

export interface Reading {
  readonly kind: VerdictKind;
  /**
   * The row that decides: the latest independent approval, the standing
   * rejection, the blocked row, the latest discounted approval, or the best
   * author row. For `rejected` it is the `verifier-failed` row even when a
   * `verifier-blocked` follows it, because that is the row to read.
   */
  readonly row: Entry;
  /** For `rejected`: the latest `verifier-blocked` after the standing rejection, which did not answer it. */
  readonly blockedAfter?: Entry;
  /** Closing-role approvals dropped for citing an implementing role's report, in file order. */
  readonly discounted: readonly { readonly entry: Entry; readonly role: string }[];
}

/** A row as one clause, for the messages that have to name the row that rejects. */
export function describeRow(e: Entry): string {
  return `${e.verdict} at ${short(e.sha)} by ${e.verifier || "unnamed"} (evidence: ${e.evidence})`;
}

/**
 * Only a `verifier-failed` is exempt from the citation filter. A `verifier-blocked`
 * is a closing verdict in the gate (the escape hatch for an item nothing can
 * verify), so one resting on the author's own report is that report under a
 * reviewer's name, exactly like an approval that does, and is discounted.
 */
const isRejection = (e: Entry) => e.verdict === "verifier-failed";

/**
 * The one reader of the verdict. `ledger check` (one sha) and the gate's closing
 * audit (every row of a closed item, in file order) both call it, so the two
 * cannot disagree about the same rows again: item 47 fixed `check` and left the
 * gate with a copy of the rule, which is how the gate kept the hole.
 *
 * `rows` are in file order, which is append order and so chronological. The `ts`
 * column is not used: a row can be recorded with an explicit `ts`, rows from two
 * machines can carry skewed clocks, and position is the one order both callers
 * already share. Returns `undefined` for no rows; callers say that in their own words.
 *
 * A role "that can close an item" is `canCloseAnItem`. An APPROVAL whose evidence
 * points at an implementing role's own report is that report under a reviewer's
 * name and is discounted, and so is a `verifier-blocked` that does (it would
 * otherwise be the escape hatch); a `verifier-failed` is never discounted, because
 * citing the report it rejects is ordinary prose and dropping it could only hide a
 * failure.
 */
export function readVerdict(rows: readonly Entry[], slug: string): Reading | undefined {
  if (rows.length === 0) return undefined;

  const byCloser = rows.filter((e) => canCloseAnItem(e.verifier));
  if (byCloser.length === 0) {
    // Every row is the author's own, so the best-ranked one is the answer, labelled.
    const best = rows.reduce((a, b) => (RANK[b.verdict] > RANK[a.verdict] ? b : a));
    return { kind: "author-only", row: best, discounted: [] };
  }

  const cited = byCloser.map((entry) => ({ entry, role: isRejection(entry) ? undefined : citesImplementingReport(entry.evidence, slug) }));
  const discounted = cited.flatMap((c) => (c.role === undefined ? [] : [{ entry: c.entry, role: c.role }]));
  const closing = cited.filter((c) => c.role === undefined).map((c) => c.entry);

  const latest = closing[closing.length - 1];
  if (latest === undefined) {
    return { kind: "discounted", row: discounted[discounted.length - 1]!.entry, discounted };
  }

  // A rejection stands from its row until a later independent approval. Walking in
  // order keeps the LAST verifier-failed that nothing independent has answered.
  let standing: Entry | undefined;
  for (const e of closing) {
    if (e.verdict === "verifier-failed") standing = e;
    else if (e.verdict !== "verifier-blocked") standing = undefined;
  }
  if (standing !== undefined) {
    const after = closing.slice(closing.indexOf(standing) + 1).filter((e) => e.verdict === "verifier-blocked");
    const blockedAfter = after[after.length - 1];
    return blockedAfter === undefined
      ? { kind: "rejected", row: standing, discounted }
      : { kind: "rejected", row: standing, blockedAfter, discounted };
  }
  if (latest.verdict === "verifier-blocked") return { kind: "blocked", row: latest, discounted };
  return { kind: "approved", row: latest, discounted };
}

export interface CheckResult {
  readonly passing: boolean;
  readonly best: Entry | undefined;
  /** What the reader made of the rows at this sha; undefined when there are none. */
  readonly kind: VerdictKind | undefined;
  /** Rows for this target recorded against some *other* SHA. */
  readonly stale: readonly Entry[];
  readonly reason: string;
}

/** The report a discounted approval cites belongs to this role; say which. */
function ownReport(role: string): string {
  return `${role === "spec-author" ? "spec-author" : "implementer"}'s own report`;
}

/**
 * Does `target` hold a verdict at `sha` that clears `min`?
 *
 * Judged by `readVerdict`, the same reader the gate's closing audit calls.
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
  // An abbreviation is resolved here, in the one function every caller reaches. One
  // that names no commit is kept as typed and finds no row, which is `no verdict at`.
  const at = resolveSha(store, sha) ?? sha;
  const all = entries(store).filter((e) => e.target === target);
  const here = all.filter((e) => sameCommit(e.sha, at));
  const stale = all.filter((e) => !sameCommit(e.sha, at));

  const reading = readVerdict(here, target);
  if (reading === undefined) {
    return {
      passing: false,
      best: undefined,
      kind: undefined,
      stale,
      reason:
        stale.length > 0
          ? `no verdict at ${short(at)}; ${stale.length} row(s) exist at other SHAs and a new head SHA voids them`
          : `no verdict recorded for ${target}`,
    };
  }

  const { kind, row } = reading;
  const by = row.verifier || "unknown";
  switch (kind) {
    case "rejected":
    case "blocked": {
      const later = reading.blockedAfter;
      return {
        passing: false,
        best: row,
        kind,
        stale,
        reason:
          `${row.verdict} at ${short(at)} by ${by} rejects this commit, whatever an implementing role recorded (evidence: ${row.evidence})` +
          (later === undefined
            ? ""
            : `; the later verifier-blocked by ${later.verifier || "unknown"} (evidence: ${later.evidence}) does not answer it`),
      };
    }
    case "approved": {
      const passing = RANK[row.verdict] >= RANK[min];
      return {
        passing,
        best: row,
        kind,
        stale,
        reason: passing
          ? `${row.verdict} at ${short(at)} by ${by}`
          : `latest closing verdict at ${short(at)} is ${row.verdict} by ${by}, which does not clear ${min}`,
      };
    }
    case "discounted": {
      // The gate refuses to close on this, so `check` fails and says why rather
      // than printing it as an independent PASS.
      const role = reading.discounted[reading.discounted.length - 1]!.role;
      return {
        passing: false,
        best: row,
        kind,
        stale,
        reason: `${row.verdict} at ${short(at)} by ${row.verifier} cites the ${ownReport(role)} (evidence: ${row.evidence}), so it is not an independent approval`,
      };
    }
    case "author-only": {
      const passing = RANK[row.verdict] >= RANK[min];
      return {
        passing,
        best: row,
        kind,
        stale,
        reason: passing
          ? `${row.verdict} at ${short(at)} by ${row.verifier || "unknown"} (the author's own verdict, not an independent approval)`
          : `best verdict at ${short(at)} is ${row.verdict}, which does not clear ${min} (the author's own verdict)`,
      };
    }
  }
}

function short(sha: string): string {
  return sha.slice(0, 8);
}
