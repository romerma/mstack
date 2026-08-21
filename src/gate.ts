import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { all as decisionsFor } from "./decisions.ts";
import { entries as ledgerEntries } from "./ledger.ts";
import {
  isActive,
  requiresDecision,
  requiresSpecArtifacts,
  requiresVerification,
  VERIFICATION_REQUIRED_FROM,
} from "./lifecycle.ts";
import {
  obligations,
  record as recordRun,
  status as verificationStatus,
  type Outcome,
} from "./verification.ts";

/** A cancelled item's fork does not need answering; nobody is building on it. */
const TERMINAL_IGNORED = new Set<string>(["cancelled"]);

/** An answer has to be words. A row of spaces is a boolean with extra steps. */
const SUBSTANTIAL = /[a-z0-9]/i;
import { UserError, type Store } from "./paths.ts";
import { Report } from "./report.ts";
import { canCloseAnItem, MIN_REPORT_BYTES } from "./roles.ts";
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
 *
 * The two halves are joined by a receipt rather than by making the fast pass
 * slow. `--full` writes down which command it ran, at which commit, and how it
 * went (`src/verification.ts`); the fast pass reads that back, and from
 * `verifying` on it refuses to call an item green on a verification nothing has
 * executed here. Nothing runs a test suite on a `Stop` hook, and nothing needs
 * to: the expensive half still only happens when somebody asks for it.
 */

export interface GateOptions {
  readonly full?: boolean;
  /**
   * Failures only, one line each, on stderr. No passes, no sections, no
   * warnings, no summary — see `Report#fail`, which owns the rendering.
   */
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
    // Skipped under `--full`, which is about to run the thing for real. Asking
    // for a receipt of a past run and then producing a fresh one in the same
    // process would report a failure the same run disproves three lines later.
    if (options.full !== true) checkVerificationRuns(store, state, report);
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
  if (!state.rules.one_active_item && active.length > 1) {
    // Turning the rule off is allowed. Reporting "no active item" while three
    // are open is not: the else branch was reached whenever the rule was off,
    // and it printed the wrong fact rather than a permitted one.
    report.warn(
      `${active.length} items active with one_active_item off: ${active.map((i) => `${i.slug} (${i.status})`).join(", ")}`,
    );
  } else if (state.rules.one_active_item && active.length > 1) {
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

  checkOpenDecisions(store, state, report);
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

/**
 * An unanswered product fork must not reach the phases that build on an answer.
 *
 * `decision_required` was read in four files and enforced in none: SessionStart
 * announced it, the router stopped to ask, and this file mentioned it only
 * inside a comment. An item could carry an unresolved fork all the way to
 * `done` and the gate would call that proven — the same shape as `closed_by`
 * clearing `require_verdict_to_close`, which is to say a rule the README sells
 * that no code sustained.
 *
 * The answer has to be a `decisions.tsv` row, because a boolean would let
 * someone mark a fork answered without saying what the answer was.
 */
function checkOpenDecisions(store: Store, state: State, report: Report): void {
  const carrying = state.items.filter(
    (item) => (item.decision_required ?? "") !== "" && !TERMINAL_IGNORED.has(item.status),
  );
  if (carrying.length === 0) {
    // Says so out loud. Staying silent here while both sibling checks always
    // speak reads as "this ran and found nothing" when it may not have run.
    report.ok("no item carries a decision fork");
    return;
  }

  let rows: ReturnType<typeof decisionsFor>;
  try {
    rows = decisionsFor(store);
  } catch (error) {
    // The gate reports; it does not become the failure. An unreadable
    // decisions.tsv used to throw out of the middle of the run, so every check
    // below this one silently never happened.
    report.fail(
      `decisions.tsv could not be read: ${(error as Error).message}`,
      "restore or recreate it; without it no fork can be shown to have been answered",
    );
    return;
  }

  const open: Item[] = [];
  const bad: string[] = [];
  for (const item of carrying) {
    const answer = item.decision_resolved ?? "";
    if (answer === "") {
      if (requiresDecision(item.status)) open.push(item);
      continue;
    }
    // Matched on the pair, not on the timestamp. A row has to say which fork it
    // answers, or any row answers any fork.
    const match = rows.filter((row) => row.ts === answer && row.resolves === item.slug);
    if (match.length === 0) {
      bad.push(`${itemLabel(item)} points at decision ${answer}, and no row with that timestamp resolves ${item.slug}`);
    } else if (match.length > 1) {
      bad.push(`${itemLabel(item)} points at decision ${answer}, which matches ${match.length} rows`);
    } else if (!SUBSTANTIAL.test(match[0]!.decision)) {
      bad.push(`${itemLabel(item)} is answered by a decision that says nothing: "${match[0]!.decision}"`);
    } else if (match[0]!.result.trim() === "" || match[0]!.result.trim() === "open") {
      bad.push(`${itemLabel(item)} is answered by a decision whose result is still "${match[0]!.result}"`);
    }
  }

  for (const item of open) {
    report.fail(
      `${itemLabel(item)} is past specifying with its decision unanswered: "${item.decision_required}"`,
      "answer it with 'mstack decide --resolves <slug> ...'; the two answers produce different work, which is why the field exists",
    );
  }
  for (const message of bad) {
    report.fail(message, "the row is the evidence; a pointer to one that does not say anything is not an answer");
  }
  if (open.length === 0 && bad.length === 0) {
    report.ok(`${carrying.length} open item(s) with a decision fork, each answered or still in specifying`);
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
    // Present but empty is the shape this check was blind to: four `touch`ed
    // files satisfied "the spec is complete". It is the same existence-is-not-
    // content mistake the state file check exists to prevent, and the same
    // floor a subagent report has to clear.
    const present = new Set(
      readdirSync(dir).filter((name) => {
        try {
          return statSync(join(dir, name)).size >= MIN_REPORT_BYTES;
        } catch {
          return false;
        }
      }),
    );
    const missing = SPEC_ARTIFACTS.filter((a) => !present.has(a));
    if (missing.length > 0) {
      report.fail(
        `spec for ${item.slug} is missing or empty: ${missing.join(", ")}`,
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
  // `closed_by` used to clear this on its own, so any non-empty string closed an
  // item with an empty ledger — `--closed-by "I checked it myself"` passed. That
  // is the requirement-with-an-escape-hatch shape this project criticises pstack
  // for, shipped in the check that exists to prevent it.
  //
  // The escape hatch belongs in the ledger, where it already exists and is
  // typed: `verifier-blocked` says a check could not be run, keyed to a SHA and
  // carrying its evidence. `closed_by` is a note, not a verdict.
  // Any verdict for the slug, not one at the current head. The stale rule is
  // about verification that is still load-bearing; a closed item was verified at
  // the SHA it closed on, and holding it to today's HEAD would turn every item
  // ever closed red as the branch moves on.
  const missing: string[] = [];
  const failed: string[] = [];
  const selfClosed: string[] = [];
  for (const item of closed) {
    const rows = ledgerEntries(store).filter((entry) => entry.target === item.slug);
    if (rows.length === 0) {
      missing.push(item.slug);
    } else if (rows.every((entry) => entry.verdict === "verifier-failed")) {
      failed.push(item.slug);
    } else if (!rows.some((entry) => canCloseAnItem(entry.verifier))) {
      // The pass that wrote the code does not get to close the item. Nothing
      // read this column, so the implementer's own row was sufficient.
      selfClosed.push(`${item.slug} (only ${[...new Set(rows.map((r) => r.verifier || "unnamed"))].join(", ")})`);
    }
  }

  if (missing.length > 0) {
    report.fail(
      `items marked done with no ledger verdict at all: ${missing.join(", ")}`,
      "record it with 'mstack ledger record'; if no check could be run, that verdict is 'verifier-blocked'",
    );
  }
  if (failed.length > 0) {
    report.fail(
      `items marked done whose only verdict is verifier-failed: ${failed.join(", ")}`,
      "a failed verifier is a reason to reopen the item, not to close it",
    );
  }
  if (selfClosed.length > 0) {
    report.fail(
      `items closed on a verdict from the pass that wrote the code: ${selfClosed.join(", ")}`,
      "a closing verdict has to come from somewhere other than the implementer; run the verification again from a pass that did not write it",
    );
  }
  if (missing.length === 0 && failed.length === 0 && selfClosed.length === 0) {
    report.ok(`${closed.length} closed item(s) carry a ledger verdict`);
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

/**
 * Has this item's verification actually been executed, here, at this commit?
 *
 * The check that closes the gap, and it costs one small TSV read. Nothing in
 * this function runs a command; `--full` does that, and writes down what
 * happened. See `VERIFICATION_REQUIRED_FROM` for why the line falls at
 * `verifying` and not earlier — that choice is the whole cost of the mechanism.
 */
function checkVerificationRuns(store: Store, state: State, report: Report): void {
  // Said out loud even when nothing is due, for the same reason the decision
  // check says so: silence reads as "this ran and found nothing" when it may
  // equally mean the check never ran.
  const active = state.items.find((i) => isActive(i.status));
  if (active === undefined) {
    report.ok("no active item, so no verification run is due");
    return;
  }
  if (!requiresVerification(active.status)) {
    report.ok(
      `${active.slug} is ${active.status}; a verification run is due at ${VERIFICATION_REQUIRED_FROM.join(", ")}`,
    );
    return;
  }

  const required = obligations(state, active);
  if (required.length === 0) {
    // A warning rather than a failure, and the boundary is deliberate. This
    // check is about an item *whose* verification never ran; whether one has to
    // exist at all is `require_verdict_to_close`'s question, and its answer for
    // "no check could be run" is the typed `verifier-blocked` verdict. Failing
    // here would wedge every store still carrying the empty `verify` that
    // `mstack setup` seeds.
    report.warn(
      `${active.slug} is ${active.status} and nothing verifies it: state.json has no 'verify' command and the item has no 'verification' command`,
    );
    return;
  }

  const sha = headSha(store);
  if (sha === null) {
    report.warn(
      "no commit to check a verification run against; run 'mstack gate --full' and read the result yourself",
    );
    return;
  }

  const result = verificationStatus(store, state, active, sha);
  if (result.satisfied) {
    report.ok(`verification ran and passed at ${sha.slice(0, 8)}: ${required.map((r) => r.command).join(", ")}`);
    return;
  }
  for (const problem of result.problems) {
    report.fail(
      `${itemLabel(active)} is one step from done, and ${problem}`,
      "run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check",
    );
  }
}

function runVerification(store: Store, state: State, report: Report): void {
  const active = state.items.find((i) => isActive(i.status));
  const required = obligations(state, active);
  if (required.length === 0) {
    // A warning and exit 0, which is what this was, is indistinguishable from
    // having run and passed: you ask for the full gate, get no verification at
    // all, and the summary says PASSED. A check that cannot fail is the shape
    // this whole gate exists to catch.
    report.fail(
      active === undefined
        ? "--full ran no verification: state.json has no 'verify' command and no item is active"
        : `--full ran no verification: state.json has no 'verify' command and ${active.slug} has no 'verification' command`,
      "set one with 'mstack state set <slug> --verification \"<command>\"', or put a project-wide 'verify' in state.json",
    );
    return;
  }

  const sha = headSha(store);
  if (sha === null) {
    report.warn("not a commit, so these runs cannot be recorded; the fast gate will not see them");
  }
  for (const { command, target } of required) {
    let outcome: Outcome;
    try {
      execFileSync("/bin/sh", ["-c", command], { cwd: store.root, stdio: "inherit" });
      outcome = "passed";
      report.ok(`${command}`);
    } catch {
      outcome = "failed";
      report.fail(`${command} failed`, "fix it; a red verification is not a partial pass");
    }
    if (sha === null) continue;
    try {
      recordRun(store, { target, sha, command, outcome });
    } catch (error) {
      // The run is the fact; being unable to write it down is a separate
      // failure and gets said as one. Swallowing it would leave the fast gate
      // asking for a run that keeps happening, with nothing naming why.
      report.fail(
        `${command} ran, but the result could not be recorded: ${(error as Error).message}`,
        "fix the write; until it lands, the fast gate cannot tell this run from one that never happened",
      );
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

/**
 * Every caller treats a git failure as "no answer", so a hang has to become one
 * too. Without a timeout a slow or prompting git blocked the status line
 * indefinitely, on the one path that runs on every assistant message. Five
 * seconds is far past any local plumbing command and still finite.
 */
const GIT_TIMEOUT_MS = 5_000;

export function git(store: Store, args: readonly string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: store.root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: GIT_TIMEOUT_MS,
      // A git that stops to ask for credentials never returns on its own.
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
    }).trim();
  } catch {
    return null;
  }
}

export function itemLabel(item: Item): string {
  return `${item.id} ${item.slug} (${item.status})`;
}
