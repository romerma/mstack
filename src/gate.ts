import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check as ledgerCheck } from "./ledger.ts";
import { isActive, requiresSpecArtifacts } from "./lifecycle.ts";
import { UserError, type Store } from "./paths.ts";
import { Report } from "./report.ts";
import { EMPTY_ITEM_LINE, EMPTY_NEXT_STEP } from "./setup.ts";
import { parseState, type Item, type State } from "./state.ts";

/**
 * The session gate.
 *
 * Split fast/slow on purpose. The fast pass touches only the store and the
 * workspace and finishes in milliseconds, which is what makes it safe to wire
 * to the Stop hook: a gate nobody waits for is a gate nobody runs. `--full`
 * runs the project's own verification and is the *reviewer's* obligation, not
 * the implementer's.
 */

export interface GateOptions {
  readonly full?: boolean;
  readonly quiet?: boolean;
}

/** Spec artifacts an `sdd` item must have on disk once it leaves `specifying`. */
export const SPEC_ARTIFACTS = ["proposal.md", "design.md", "tasks.md", "spec.md"] as const;

export function runGate(store: Store, options: GateOptions = {}): Report {
  const report = new Report({ ...(options.quiet === true ? { quiet: true } : {}) });

  report.section("store");
  checkStoreFiles(store, report);

  const state = loadOrReport(store, report);
  if (state !== null) {
    report.section("state");
    checkInvariants(store, state, report);
  }

  report.section("workspace");
  checkWorkspace(store, report);

  if (options.full === true && state !== null) {
    report.section("verification");
    runVerification(store, state, report);
  }

  report.summary();
  return report;
}

function loadOrReport(store: Store, report: Report): State | null {
  try {
    const state = parseState(store.state);
    report.ok(`state.json parses and has the right shape (${state.items.length} items)`);
    return state;
  } catch (error) {
    if (error instanceof UserError) {
      report.fail(error.message, error.fix);
      return null;
    }
    throw error;
  }
}

function checkStoreFiles(store: Store, report: Report): void {
  for (const [label, path] of [
    ["state.json", store.state],
    ["progress/current.md", store.current],
    ["progress/history.md", store.history],
  ] as const) {
    if (existsSync(path)) report.ok(`${label} exists`);
    else report.fail(`${label} is missing`, "run 'mstack setup'");
  }
}

/**
 * `current.md` is the file that survives a dead context window, and existing is
 * not the same as saying anything.
 *
 * The third end-to-end run ended correctly — it hit a `decision_required` fork
 * and stopped to ask rather than guessing — and left "Next step" as the
 * untouched template. The session holding the question and the session that
 * would have to answer it were not the same session, and nothing on disk
 * carried it across. That is the one job this file has.
 *
 * Matched against the template `mstack setup` writes, so the check cannot drift
 * from it.
 */
function checkCurrent(store: Store, item: Item, report: Report): void {
  let source: string;
  try {
    source = readFileSync(store.current, "utf8");
  } catch {
    return; // Absent is already reported by checkStoreFiles.
  }

  const stale: string[] = [];
  if (source.includes(EMPTY_ITEM_LINE)) stale.push("the Item line still says _none_");
  if (source.includes(EMPTY_NEXT_STEP)) stale.push("Next step is still the empty template");

  if (stale.length > 0) {
    report.fail(
      `${itemLabel(item)} is active but progress/current.md is not: ${stale.join("; ")}`,
      "if this session dies now, nothing tells the next one where to start",
    );
  } else {
    report.ok("progress/current.md tracks the active item");
  }
}

function checkInvariants(store: Store, state: State, report: Report): void {
  reportDuplicates(state.items.map((i) => i.id), "id", report);
  reportDuplicates(state.items.map((i) => i.slug), "slug", report);

  const emptyAcceptance = state.items.filter((i) => i.acceptance.length === 0);
  if (emptyAcceptance.length > 0) {
    report.fail(
      `items with an empty acceptance list: ${emptyAcceptance.map((i) => i.slug).join(", ")}`,
      "quote the acceptance criteria from the source; do not paraphrase them",
    );
  } else {
    report.ok("every item has at least one acceptance criterion");
  }

  const active = state.items.filter((i) => isActive(i.status));
  if (state.rules.one_active_item && active.length > 1) {
    report.fail(
      `${active.length} items are active in this worktree: ${active.map((i) => `${i.slug} (${i.status})`).join(", ")}`,
      "finish or park all but one; use a separate worktree for parallel work",
    );
  } else if (active.length === 1) {
    report.ok(`one active item: ${active[0]?.slug} (${active[0]?.status})`);
    checkCurrent(store, active[0]!, report);
  } else {
    report.ok("no active item");
  }

  if (state.rules.require_spec_for_sdd_items) checkSpecArtifacts(store, state, report);
  if (state.rules.require_verdict_to_close) checkClosedItems(store, state, report);
}

function reportDuplicates(values: readonly (string | number)[], label: string, report: Report): void {
  const seen = new Set<string | number>();
  const dupes = new Set<string | number>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  if (dupes.size > 0) {
    report.fail(`duplicate ${label}: ${[...dupes].join(", ")}`, `make every ${label} unique`);
  } else {
    report.ok(`${label}s are unique`);
  }
}

function checkSpecArtifacts(store: Store, state: State, report: Report): void {
  const needing = state.items.filter((i) => i.sdd === true && requiresSpecArtifacts(i.status));
  if (needing.length === 0) {
    report.ok("no sdd item is past specifying");
    return;
  }
  for (const item of needing) {
    const dir = join(store.specs, item.slug);
    if (!existsSync(dir)) {
      report.fail(
        `sdd item ${item.slug} is ${item.status} but has no spec at ${dir}`,
        "run '/mstack:spec' or move the item back to specifying",
      );
      continue;
    }
    const present = new Set(readdirSync(dir));
    const missing = SPEC_ARTIFACTS.filter((a) => !present.has(a));
    if (missing.length > 0) {
      report.fail(
        `spec for ${item.slug} is missing ${missing.join(", ")}`,
        "no code against an incomplete spec",
      );
    } else {
      report.ok(`spec for ${item.slug} is complete`);
    }
  }
}

function checkClosedItems(store: Store, state: State, report: Report): void {
  const closed = state.items.filter((i) => i.status === "done");
  if (closed.length === 0) {
    report.ok("no closed items to audit");
    return;
  }
  const unproven = closed.filter((item) => {
    if (item.closed_by !== undefined && item.closed_by.trim() !== "") return false;
    return ledgerCheck(store, item.slug, headSha(store) ?? "", "test-verified").best === undefined;
  });
  if (unproven.length > 0) {
    report.fail(
      `items marked done with neither closed_by nor a ledger verdict: ${unproven.map((i) => i.slug).join(", ")}`,
      "record the verdict with 'mstack ledger record', or say what closed it",
    );
  } else {
    report.ok(`${closed.length} closed item(s) carry proof`);
  }
}

function checkWorkspace(store: Store, report: Report): void {
  if (git(store, ["rev-parse", "--git-dir"]) === null) {
    report.warn("not a git repository, skipping workspace checks");
    return;
  }
  // Distinguished on purpose. `rev-parse HEAD` also fails on a repository with
  // no commits, and reporting that as "not a git repository" is the kind of
  // confidently wrong output this gate exists to catch elsewhere.
  const branch = git(store, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch === null) {
    report.warn("git repository with no commits yet, skipping branch checks");
    return;
  }
  const dflt = defaultBranch(store);
  if (branch === dflt) {
    report.warn(`on ${branch}; feature work belongs on its own branch`);
  } else {
    report.ok(`on branch ${branch}`);
  }
  const dirty = git(store, ["status", "--porcelain"]);
  if (dirty !== null && dirty !== "") {
    const count = dirty.split("\n").length;
    report.warn(`${count} uncommitted change(s); expected mid-session, not at close`);
  } else {
    report.ok("working tree is clean");
  }
}

function runVerification(store: Store, state: State, report: Report): void {
  const active = state.items.find((i) => isActive(i.status));
  const commands = [state.verify, active?.verification].filter(
    (c): c is string => typeof c === "string" && c.trim() !== "",
  );
  if (commands.length === 0) {
    report.warn("no verify command is configured; --full checked nothing beyond the fast gate");
    return;
  }
  for (const command of commands) {
    try {
      execFileSync("/bin/sh", ["-c", command], { cwd: store.root, stdio: "inherit" });
      report.ok(`${command}`);
    } catch {
      report.fail(`${command} failed`, "fix it; a red verification is not a partial pass");
    }
  }
}

export function headSha(store: Store): string | null {
  return git(store, ["rev-parse", "HEAD"]);
}

export function defaultBranch(store: Store): string {
  const remote = git(store, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  if (remote !== null && remote.startsWith("origin/")) return remote.slice("origin/".length);
  for (const candidate of ["main", "master"]) {
    if (git(store, ["rev-parse", "--verify", "--quiet", candidate]) !== null) return candidate;
  }
  return "main";
}

export function git(store: Store, args: readonly string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: store.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function itemLabel(item: Item): string {
  return `${item.id} ${item.slug} (${item.status})`;
}
