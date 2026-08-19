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
