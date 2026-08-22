import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Which file on disk proves a given role actually did its work.
 *
 * One mapping, imported by everything that needs it. The `SubagentStop` hook
 * uses it to catch a worker that returned without writing anything, and the
 * subagent status line uses it to show the same fact while there is still time
 * to do something about it.
 *
 * A role absent from this table has no report contract and is left alone.
 */
export const REPORT_KINDS: Readonly<Record<string, string>> = {
  "spec-author": "spec",
  "spec-reviewer": "spec_review",
  implementer: "impl",
  reviewer: "review",
};

/**
 * A plugin agent arrives as `mstack:implementer`; a project-level one as bare
 * `implementer`. Both name the same contract.
 */
export function roleOf(agentType: string | undefined): string {
  return (agentType ?? "").split(":").pop() ?? "";
}

export function reportKind(agentType: string | undefined): string | undefined {
  return REPORT_KINDS[roleOf(agentType)];
}

/**
 * Every file that could satisfy a role's report contract for one item.
 *
 * A lone reviewer writes `review_<slug>.md`. A review panel writes one file per
 * lens — `review_<slug>_correctness.md` and so on — because the `review` skill
 * launches those reviewers in parallel and a single shared filename would have
 * them overwrite each other. N-1 reviews would vanish, silently, which is the
 * precise failure the report contract exists to prevent.
 *
 * So the contract is the prefix, not the exact name.
 */
export function reportFiles(progressDir: string, kind: string, slug: string): string[] {
  const prefix = `${kind}_${slug}`;
  let names: string[];
  try {
    names = readdirSync(progressDir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name === `${prefix}.md` || (name.startsWith(`${prefix}_`) && name.endsWith(".md")))
    .sort()
    .map((name) => join(progressDir, name));
}

/**
 * A file this small is a stub, not a report.
 *
 * One number, in one place. It used to be the literal `40` written twice, in
 * two files, with the comparisons pointing in opposite directions.
 */
export const MIN_REPORT_BYTES = 40;

/**
 * The reports that actually say something.
 *
 * The `statSync` is inside the loop's own try on purpose. The paths come from a
 * `readdirSync` that ran earlier, and a fan-out of parallel writers is exactly
 * a window where a file can vanish between the two calls. An unguarded stat
 * there threw all the way out of the caller: one bad directory entry blanked
 * every subagent row, and separately made the SubagentStop hook report nothing
 * at all — the hook whose entire job is noticing a missing report.
 *
 * An entry we cannot stat counts as no report, which is the safe direction.
 */
export function substantialReports(progressDir: string, kind: string, slug: string): string[] {
  return reportFiles(progressDir, kind, slug).filter((file) => {
    try {
      return statSync(file).size >= MIN_REPORT_BYTES;
    } catch {
      return false;
    }
  });
}

/**
 * Roles whose verdict does not close an item, because they wrote the thing.
 *
 * `skills/ship/SKILL.md` defines safe as "a verdict from a pass that did not
 * write the code", and `agents/implementer.md` tells the implementer to record
 * `--verifier implementer`. Nothing checked the column, so the pass that wrote
 * the code closed the item: `closed_by` again, in a different costume.
 *
 * The column is free text — a verifier can be a person, a CI job, a session —
 * so this is a floor and not a proof. Someone typing `--verifier impl` gets
 * past it. That is worth having anyway: it stops the default path, which is the
 * one everybody takes.
 */
export const IMPLEMENTING_ROLES: ReadonlySet<string> = new Set(["implementer", "spec-author"]);

export function canCloseAnItem(verifier: string): boolean {
  const role = roleOf(verifier).trim().toLowerCase();
  return role !== "" && !IMPLEMENTING_ROLES.has(role);
}

/**
 * Does this evidence string name an implementing role's own report for this
 * item — the report `reportFiles` would list for `impl`/`spec` — regardless
 * of which role the row's `verifier` column claims? Returns the implementing
 * role whose report is cited (a row citing both kinds reports `implementer`,
 * the set's first entry), or `undefined` when nothing is cited — so the
 * caller can say which pass's report the evidence points at.
 *
 * A pure string check against the naming contract, not a directory read: the
 * ledger row has to prove or disprove itself from its own columns, the same
 * way every other check in `checkClosedItems` does.
 *
 * A citation is the exact report filename as a whole token, however
 * punctuated. Leading: quotes, brackets, `=`, `(`, whitespace, `/` or string
 * start all precede a citation; a letter, digit, hyphen or underscore glues
 * into a different filename (`re-impl_x.md` is not a citation). Trailing:
 * `.md` terminates the filename contract, so any following character that is
 * not a letter, digit or underscore — including a hyphen — is punctuation
 * (`impl_x.md-round-2` IS a citation; `impl_x.mdx` is not). The `*` rather
 * than `+` in the suffix arm mirrors `reportFiles`' own
 * `startsWith(prefix + "_")`, which admits `impl_x_.md`.
 *
 * Matching is case-insensitive: kind and slug are lowercase by contract
 * (`SLUG`, src/state.ts:49), so the `i` flag only widens what the evidence
 * side may look like — and on the case-insensitive filesystem this project
 * develops on, `IMPL_x.MD` resolves to the very file `impl_x.md` names.
 * Format characters (Unicode category Cf: zero-width spaces and joiners, the
 * BOM) are stripped before matching, because they render as nothing in every
 * viewer the ledger targets — a filename carrying one reads as the real
 * filename to a human and has to read the same way to this check.
 *
 * No escaping of `slug`: `SLUG` (src/state.ts:49) admits no regex
 * metacharacter and is enforced on load at src/state.ts:143, so interpolating
 * it directly is safe by construction, not by convention.
 *
 * Like `canCloseAnItem` above, this is a floor and not a proof: it stops the
 * default path, not a determined forger. What remains open: free prose that
 * never names the file passes, and nothing here can tell an honest
 * description from a dishonest one while `evidence` is free text; a Unicode
 * homoglyph (a Cyrillic letter standing in for a Latin one) is a different
 * string to this check and an identical-looking one to a reader; and a
 * citation of a *different* item's report is invisible here, because the
 * prefix is built from the audited item's own slug.
 */
export function citesImplementingReport(evidence: string, slug: string): string | undefined {
  const visible = evidence.replace(/\p{Cf}/gu, "");
  for (const role of IMPLEMENTING_ROLES) {
    const kind = REPORT_KINDS[role];
    if (kind === undefined) continue;
    const prefix = `${kind}_${slug}`;
    const pattern = new RegExp(`(^|[^A-Za-z0-9_-])${prefix}(\\.md|_[^\\s/]*\\.md)(?=$|[^A-Za-z0-9_])`, "i");
    if (pattern.test(visible)) return role;
  }
  return undefined;
}

/**
 * Prefixes a fan-out may allocate under.
 *
 * Wider than `REPORT_KINDS`, which maps the agent roles this plugin ships.
 * `understand` fans readers out to `explore_<topic>.md` and `design` fans out
 * its candidates, and `mstack fanout plan --kind explore` used to exit 2 — so
 * the tooling did not cover two of the three paths its own module comment cites
 * as the reason it exists.
 *
 * Those workers are generic subagents with no role of their own, so
 * `SubagentStop` cannot guard them. `mstack fanout check` is what covers them.
 */
export const FANOUT_KINDS: readonly string[] = [
  ...new Set([...Object.values(REPORT_KINDS), "explore", "design"]),
].sort();
