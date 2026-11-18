import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { all as decisionsFor } from "./decisions.ts";
import { gateProblems, VERIFICATION_CHECK } from "./closing.ts";
import { defaultBranch, git, headSha } from "./git.ts";
import { readGlossary } from "./glossary.ts";
import { runCommand } from "./run.ts";
import { measureDiff, measureStart, resolveCommit, SMALL_MAX_FILES, SMALL_MAX_LINES } from "./size.ts";
import { describeRow, entries as ledgerEntries, readVerdict } from "./ledger.ts";
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
  treeId,
  UNKNOWN_TREE,
  type Outcome,
} from "./verification.ts";

/** A cancelled item's fork does not need answering; nobody is building on it. */
const TERMINAL_IGNORED = new Set<string>(["cancelled"]);

/** An answer has to be words. A row of spaces is a boolean with extra steps. */
const SUBSTANTIAL = /[a-z0-9]/i;
import { errorsSince } from "./hooklog.ts";
import { cliProvenance, describeSrcComparison, HOOK_LOG, runningCliRoot, UserError, type Store } from "./paths.ts";
import { Report } from "./report.ts";
import { MIN_REPORT_BYTES } from "./roles.ts";
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
    // Under `--full` only the verification receipts are skipped: `--full` is about
    // to run the thing for real, and asking for a receipt of a past run and then
    // producing a fresh one in the same process would report a failure the same
    // run disproves three lines later. Every other closing check (the requirement
    // table, the review budget) is the plain gate's answer, so a full green cannot
    // sit over a red the plain gate reports.
    checkVerificationRuns(store, state, report, options.full === true);
  }

  checkGlossary(store, report);

  report.section("workspace");
  checkCliProvenance(store, report);
  checkWorkspace(store, report);

  if (options.full === true && state !== null) {
    report.section("verification");
    runVerification(store, state, report);
  }

  report.summary();
  return report;
}

/**
 * The glossary is optional and the gate never asks for one: a repository
 * without it gets no section and no line, so the gate stays green for every
 * consumer that has not adopted the practice. When the file exists its entries
 * are held to the format, at the repository root only.
 */
function checkGlossary(store: Store, report: Report): void {
  const path = join(store.root, "GLOSSARY.md");
  if (!existsSync(path)) return;
  report.section("glossary");
  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unreadable";
    report.fail(`GLOSSARY.md could not be read (${code})`, "make it a readable file");
    return;
  }
  const { entries, problems, warnings } = readGlossary(source);
  const at = (line: number) => (line > 0 ? `GLOSSARY.md:${line}` : "GLOSSARY.md");
  for (const problem of problems) report.fail(`${at(problem.line)}: ${problem.message}`, problem.fix);
  if (problems.length > 0) {
    for (const warning of warnings) report.warn(`${at(warning.line)}: ${warning.message}`);
    return;
  }
  const count = `GLOSSARY.md: ${entries} ${entries === 1 ? "entry" : "entries"}`;
  if (entries > 0 || warnings.length === 0) {
    report.ok(warnings.length === 0 ? `${count}, each a term with a one or two sentence definition` : count);
  }
  for (const warning of warnings) report.warn(`${at(warning.line)}: ${warning.message}`);
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
  checkReceiptIsIgnored(store, report);
  checkHookErrors(store, report);
}

/**
 * Hooks fail open, so a hook that broke said nothing to anyone. It left a line
 * in `.mstack/hook-errors.log` instead (`src/hooklog.ts`), and this is where
 * somebody reads it.
 *
 * "Since the last session close" is the last change to `progress/history.md`:
 * closing a session appends to it, so a line older than that was there to be
 * read before the session was closed. A warning, never a failure: a hook that
 * broke is a reason to look, not a reason to refuse the work, and a gate that
 * went red on a log nobody can clear but by writing history would be a trap.
 */
function checkHookErrors(store: Store, report: Report): void {
  let closedAt = 0;
  try {
    closedAt = statSync(store.history).mtimeMs;
  } catch {
    // no history.md: every line counts, and the missing file is reported above
  }
  const { count, newest } = errorsSince(store.hookErrors, closedAt);
  if (count === 0 || newest === null) return;
  report.warn(
    `${count} hook error${count === 1 ? "" : "s"} recorded since the last session close; newest: ${newest.event}: ${newest.message}. Read .mstack/${HOOK_LOG}`,
  );
}

/**
 * A store that predates `.mstack/.gitignore` commits its receipts, and a
 * committed receipt cannot vouch for the commit that carries it.
 *
 * There is no migration and there cannot really be one: `mstack setup` installs
 * the file, but nothing tells an existing user to re-run it, and once the
 * receipt is already tracked `setup` is not enough — `git rm --cached` is also
 * required. Left alone the result is a permanent red-gate-and-dirty-tree loop
 * with nothing naming the cause, which is fail-closed but useless.
 *
 * So the gate names it. A warning rather than a failure: nothing here is unsafe,
 * it is the store's hygiene, and the actual red gate that follows is produced by
 * the check below with its own message.
 */
function checkReceiptIsIgnored(store: Store, report: Report): void {
  if (!existsSync(store.verification)) return;
  // `check-ignore -q` exits 0 when the path is ignored and 1 when it is not, so
  // a null answer here is "not ignored" (or no git at all, which the workspace
  // section reports on its own terms).
  if (git(store, ["check-ignore", "-q", store.verification]) !== null) return;
  if (git(store, ["rev-parse", "--git-dir"]) === null) return;
  report.warn(
    ".mstack/verification.tsv is not gitignored, and committing it voids the runs it records: run 'mstack setup' to install .mstack/.gitignore, then 'git rm --cached .mstack/verification.tsv' if it is already tracked",
  );
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
    checkSmallDiff(store, active[0]!, report);
  } else {
    report.ok("no active item");
  }

  checkOpenDecisions(store, state, report);
  if (state.rules.require_spec_for_sdd_items) checkSpecArtifacts(store, state, report);
  if (state.rules.require_verdict_to_close) checkClosedItems(store, state, report);
}

/**
 * A size-s item is held to its diff: the code that changed since it started,
 * committed or not, may not pass `SMALL_MAX_LINES` lines or `SMALL_MAX_FILES`
 * files. Only the active item with a `base` is measured, and only at size s;
 * everything else says nothing, so a store that does not use sizes is unchanged.
 */
function checkSmallDiff(store: Store, item: Item, report: Report): void {
  if (item.size !== "s" || item.base === undefined) return;
  const fixBase = `'mstack state set ${item.slug} --base <commit>' points it at a commit that exists`;
  const base = resolveCommit(store, item.base);
  if (base === null) {
    report.fail(`${itemLabel(item)} is size s but its base ${item.base} is not a commit git can find, so its diff cannot be measured`, fixBase);
    return;
  }
  // `measureStart` says why it picked the commit; the line says it too, so a
  // start that is not the base is visible rather than silently applied.
  const start = measureStart(store, base);
  if (start.from === null) {
    report.fail(
      `${itemLabel(item)} is size s but its base ${base.slice(0, 8)} is not in this branch's history (a rebase rewrites it), and there is no point where the branch left ${start.branch} to measure from instead`,
      `'mstack state set ${item.slug} --base <commit>' names the commit the item's work starts after`,
    );
    return;
  }
  const from = start.why === "base"
    ? start.from.slice(0, 8)
    : `${start.from.slice(0, 8)} (where this branch left ${start.branch}; base ${base.slice(0, 8)} ${start.why === "older" ? "is older" : "is not in this branch's history"})`;
  const size = measureDiff(store, start.from);
  if (size === null) {
    report.fail(`${itemLabel(item)} is size s but git could not measure its diff from ${from}`, fixBase);
    return;
  }
  const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;
  const found = `${plural(size.lines, "line")} in ${plural(size.files, "file")}`;
  if (size.lines > SMALL_MAX_LINES || size.files > SMALL_MAX_FILES) {
    report.fail(
      `${itemLabel(item)} is size s but its code diff from ${from} is ${found}, over the limits of ${SMALL_MAX_LINES} lines and ${SMALL_MAX_FILES} files`,
      `it is not small: 'mstack state set ${item.slug} --size m' (or split the work)`,
    );
  } else {
    report.ok(`${item.slug} is size s: ${found} of code since ${from}, within ${SMALL_MAX_LINES} lines and ${SMALL_MAX_FILES} files`);
  }
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
  const forgedImpl: string[] = [];
  const forgedSpec: string[] = [];
  const unsupersededFailure: string[] = [];
  for (const item of closed) {
    const rows = ledgerEntries(store).filter((entry) => entry.target === item.slug);
    if (rows.length === 0) {
      missing.push(item.slug);
      continue;
    }
    if (rows.every((entry) => entry.verdict === "verifier-failed")) {
      failed.push(item.slug);
      continue;
    }
    // One reader for `ledger check` and for this audit (`readVerdict`, src/ledger.ts),
    // so the two cannot disagree about the same rows. Every row of the item, in
    // file order: a closed item was verified at the SHA it closed on, and that is
    // not necessarily today's HEAD. What each kind means here:
    //  - author-only: the pass that wrote the code does not get to close the item.
    //  - discounted: every closing row is an approval citing an implementing
    //    role's own report, the column saying one thing and the evidence another.
    //  - rejected: a closing role's `verifier-failed` that no later independent
    //    approval answered. It is never dropped for what its evidence cites, and a
    //    `verifier-blocked` after it ("could not verify") does not answer it.
    //  - blocked: the latest closing row says nothing could be run. That is the
    //    documented escape hatch for an item nothing can verify, so it closes.
    const reading = readVerdict(rows, item.slug)!;
    if (reading.kind === "author-only") {
      selfClosed.push(`${item.slug} (only ${[...new Set(rows.map((r) => r.verifier || "unnamed"))].join(", ")})`);
    } else if (reading.kind === "discounted") {
      // The item is reported under the kind actually cited, so the message states
      // the fact; an item whose rows cite both kinds lands on the implementer
      // list, and each detail names only the verifiers whose rows cited that kind.
      const verifiers = (role: string) => [
        ...new Set(reading.discounted.filter((d) => d.role === role).map((d) => d.entry.verifier || "unnamed")),
      ];
      const implVerifiers = verifiers("implementer");
      if (implVerifiers.length > 0) {
        forgedImpl.push(`${item.slug} (${implVerifiers.join(", ")})`);
      } else {
        forgedSpec.push(`${item.slug} (${verifiers("spec-author").join(", ")})`);
      }
    } else if (reading.kind === "rejected") {
      unsupersededFailure.push(`${item.slug} (${reading.row.verifier || "unnamed"}): ${describeRow(reading.row)}`);
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
  if (forgedImpl.length > 0) {
    report.fail(
      `items closed on a verdict whose evidence cites the implementer's own report: ${forgedImpl.join(", ")}`,
      "a closing verdict needs evidence from the closing pass's own work, not a pointer to the implementer's report; re-run the check and record what actually happened",
    );
  }
  if (forgedSpec.length > 0) {
    report.fail(
      `items closed on a verdict whose evidence cites the spec-author's own report: ${forgedSpec.join(", ")}`,
      "a closing verdict needs evidence from the closing pass's own work, not a pointer to the spec-author's report; re-run the check and record what actually happened",
    );
  }
  if (unsupersededFailure.length > 0) {
    report.fail(
      `items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: ${unsupersededFailure.join("; ")}`,
      "the ledger is append-only, so the failed row stays; only a later independent approval from a closing role clears it, and 'could not verify' does not — re-run the review after the fix and record a fresh one",
    );
  }
  if (
    missing.length === 0 &&
    failed.length === 0 &&
    selfClosed.length === 0 &&
    forgedImpl.length === 0 &&
    forgedSpec.length === 0 &&
    unsupersededFailure.length === 0
  ) {
    report.ok(`${closed.length} closed item(s) carry a ledger verdict`);
  }
}

/**
 * Did this report come from the store's own CLI?
 *
 * Only asked where the store root is itself an mstack checkout. There, `which
 * mstack` resolves to the installed plugin cache, and the habit-formed `mstack
 * gate` runs a copy that predates the code under review. The loud version of
 * that mismatch is an unknown flag; the silent one was reproduced at rung 5
 * before this check existed — same store, same commit, an item whose
 * verification exits 1 and had never run, and the cached 0.1.0 gate printed
 * PASSED exit 0 where this checkout's gate printed FAILED exit 1, because the
 * stale copy did not implement the check it was being trusted to run.
 *
 * The severity ladder, one rung per answer `cliProvenance` can give. Outside
 * the repository is a failure: a green summary produced by a foreign copy is
 * exactly the confidently-wrong output the mismatch generates, so the wrong
 * copy must not be able to produce one here. A sibling inside the repository
 * at a different committed src tree is a warning — see the decision row and
 * the comment at the warn below. The agreeing cases say so out loud, naming
 * exactly what agreed: the store's own path, or the same repository *and*
 * the same committed src tree.
 *
 * The honest limit: this line ships with the code that is being missed, so a
 * copy installed *before* it existed still says nothing. What it closes is
 * every future round of the same trap; what closes the current one is the
 * contributor habit CONTRIBUTING.md now names.
 *
 * In an ordinary project — one that is not a checkout of this plugin — the
 * check says nothing at all, because the plugin CLI is supposed to be foreign
 * there. `running` is injectable so tests can exercise the branches where the
 * roots agree, which in-process runs otherwise cannot reach.
 */
export function checkCliProvenance(store: Store, report: Report, running: string = runningCliRoot()): void {
  const provenance = cliProvenance(store, running);
  switch (provenance.kind) {
    case "not-a-checkout":
      return;
    case "own":
      report.ok("store root is an mstack checkout, and this report came from its own ./bin/mstack");
      return;
    case "same-repo": {
      if (provenance.sameSrc) {
        // "Committed src tree", said exactly: this is `HEAD:src` on both
        // sides, so uncommitted edits to src/ are invisible to it, and src/
        // is dirty for most of a working session. The line claims what was
        // compared and no more.
        report.ok(
          `store root is an mstack checkout, and this report came from within the same repository at the same committed src tree (${provenance.storeSrc?.slice(0, 8)})`,
        );
        return;
      }
      // A warning, not a failure, and the severity is a recorded decision:
      // the mismatch is genuine — this report's checks may not be the store's
      // checks, which is the item's originating defect — but it is also the
      // normal state for the whole life of a branch touching src/, with hooks
      // wired to a plugin root no session can redirect per worktree. A hard
      // fail here is red every turn for days, which is the switch-off failure
      // that produced round two's silence. What warn gives up is stated in
      // the same row: the Stop hook composes its context from failures only,
      // so this line reaches a shell gate and not the hook.
      report.warn(
        `this report was produced by a sibling of this repository ${describeSrcComparison(provenance)}: ${provenance.running} — its checks may not be this store's checks; run ${join(store.root, "bin", "mstack")} for a report this store's code stands behind`,
      );
      return;
    }
    case "foreign":
      report.fail(
        `this store's root is an mstack checkout, but the CLI producing this report runs from ${provenance.running}`,
        `run ${join(store.root, "bin", "mstack")} instead; a copy installed elsewhere can predate the checks this store's code expects, and 'mstack version' prints which copy is running`,
      );
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
function checkVerificationRuns(store: Store, state: State, report: Report, full: boolean): void {
  // Said out loud even when nothing is due, for the same reason the decision
  // check says so: silence reads as "this ran and found nothing" when it may
  // equally mean the check never ran.
  const active = state.items.find((i) => isActive(i.status));
  if (active === undefined) {
    report.ok("no active item, so no verification run is due");
    return;
  }
  const required = obligations(state, active);
  const sha = headSha(store);
  // The tree is the costly part, so it is only computed when something will be
  // compared against it, and then once: it feeds both the check and the warning.
  const tree = !full && requiresVerification(active.status) && required.length > 0 && sha !== null ? treeId(store) : undefined;
  // Asked before the verification-specific early outs below, and of the same
  // function `state set --status done` asks, so a second closing check cannot be
  // invisible here while it refuses there. An unreadable receipt file is a
  // problem it reports, not a throw: `cmdHook` catches every throw and returns 0
  // by design, which made an unreadable file byte-identical to a green gate.
  const problems = gateProblems(store, state, active, tree, full ? [VERIFICATION_CHECK] : []);

  if (full) {
    // The verification section below says what ran; nothing to say about receipts here.
  } else if (!requiresVerification(active.status)) {
    report.ok(
      `${active.slug} is ${active.status}; a verification run is due at ${VERIFICATION_REQUIRED_FROM.join(", ")}`,
    );
  } else if (required.length === 0) {
    // A warning rather than a failure, and the boundary is deliberate. This
    // check is about an item *whose* verification never ran; whether one has to
    // exist at all is `require_verdict_to_close`'s question, and its answer for
    // "no check could be run" is the typed `verifier-blocked` verdict. Failing
    // here would wedge every store still carrying the empty `verify` that
    // `mstack setup` seeds.
    report.warn(
      `${active.slug} is ${active.status} and nothing verifies it: state.json has no 'verify' command and the item has no 'verification' command`,
    );
  } else if (sha === null) {
    report.warn(
      "no commit to check a verification run against; run 'mstack gate --full' and read the result yourself",
    );
  } else {
    // `unknown` is the one tree value that turns half the key off: both sides
    // compute it identically, so a receipt written while git could not be asked
    // is satisfied by a check while git could not be asked, with nothing compared.
    if (tree === UNKNOWN_TREE) {
      report.warn(
        "git could not describe the working tree, so only the commit half of the verification key was checked; an uncommitted change since the run would not be noticed",
      );
    }
    if (!problems.some((p) => p.check === VERIFICATION_CHECK)) {
      report.ok(`verification ran and passed at ${sha.slice(0, 8)}: ${required.map((r) => r.command).join(", ")}`);
    }
  }
  for (const problem of problems) {
    // "One step from done" is only true at the statuses that are; a check that
    // reports earlier (`reportedAt`) says what is true there instead.
    const lead = requiresVerification(active.status) ? "is one step from done" : "cannot close as it stands";
    report.fail(`${itemLabel(active)} ${lead}, and ${problem.message}`, problem.hint);
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
  const outcomes: { command: string; target: string; outcome: Outcome }[] = [];
  for (const { command, target } of required) {
    let outcome: Outcome;
    if (runCommand(command, { cwd: store.root, output: "inherit" }).code === 0) {
      outcome = "passed";
      report.ok(`${command}`);
    } else {
      outcome = "failed";
      report.fail(`${command} failed`, "fix it; a red verification is not a partial pass");
    }
    outcomes.push({ command, target, outcome });
  }
  if (sha === null) return;

  // Sampled once, *after* every command, and shared by every row.
  //
  // Sampling it first would let a suite that writes a log or a coverage file
  // into the repository void its own receipt the instant it wrote one: a green
  // `--full` followed immediately by a red gate, which is the disable-it
  // failure the cost boundary exists to bound. Not *permanently* red — a second
  // `--full` recovers, because by then the artifact already exists and the tree
  // stops moving — but "run it twice and it works" is the shape people stop
  // running. Sampling per command would leave every row but the last recording
  // a tree that no longer exists.
  //
  // The ordering is load-bearing and it is one line from reversing, so
  // `tests/gate.test.ts` pins it with a verification that really does write into
  // the repository. It went unpinned for a review round and a mutation moving
  // this call left the whole suite green.
  const tree = treeId(store);
  for (const { command, target, outcome } of outcomes) {
    try {
      recordRun(store, { target, sha, command, outcome, tree });
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

export function itemLabel(item: Item): string {
  return `${item.id} ${item.slug} (${item.status})`;
}
