import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkCliProvenance, runGate, SPEC_ARTIFACTS } from "../src/gate.ts";
import { record } from "../src/ledger.ts";
import { Report } from "../src/report.ts";
import { receipts, record as recordRaw } from "../src/verification.ts";
import { add as addDecision } from "../src/decisions.ts";
import { EMPTY_NEXT_STEP } from "../src/setup.ts";
import { captured, expectFail, expectPass, item, quiesce, recordReceipt, sandbox, state, trackCurrent } from "./helpers.ts";

/**
 * The fast gate, quiet, with both streams captured.
 *
 * Quiet writes its failures to stderr now. Most fixtures below are red on
 * purpose, so letting that through would bury a real failure in a page of
 * expected ones.
 */
function quietGate(sb: ReturnType<typeof sandbox>): { report: ReturnType<typeof runGate>; out: string; err: string } {
  const { value, out, err } = captured(() => runGate(sb.store, { quiet: true }));
  return { report: value, out, err };
}

const gate = (sb: ReturnType<typeof sandbox>) => quietGate(sb).report;

/** What git says is dirty, for fixtures whose point is that this does not move. */
function porcelain(sb: ReturnType<typeof sandbox>): string {
  return execFileSync("git", ["status", "--porcelain"], { cwd: sb.store.root, encoding: "utf8" });
}

test("a well-formed store passes", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    expectPass(gate(sb), "clean store");
  } finally {
    sb.dispose();
  }
});

test("the shape that silently disables every downstream check is rejected", () => {
  const sb = sandbox();
  try {
    // `jq empty` accepts this. So does JSON.parse. Every query below it then
    // reads undefined, every comparison sees nothing, and a gate without a
    // shape check reports green while enforcing not one rule.
    sb.writeState({ version: 1, project: "sandbox", rules: {}, items: {} });
    expectFail(gate(sb), /wrong shape.*items must be an array/, "items as an object");
  } finally {
    sb.dispose();
  }
});

test("unparseable JSON is reported, not swallowed", () => {
  const sb = sandbox();
  try {
    writeFileSync(sb.store.state, "{ not json", "utf8");
    expectFail(gate(sb), /not valid JSON/, "broken JSON");
  } finally {
    sb.dispose();
  }
});

test("two active items in one worktree is a failure", () => {
  const sb = sandbox();
  try {
    sb.writeState(
      state([
        item({ id: 1, slug: "one", status: "in_progress" }),
        item({ id: 2, slug: "two", status: "reviewing" }),
      ]),
    );
    expectFail(gate(sb), /2 items are active/, "two active");
  } finally {
    sb.dispose();
  }
});

test("one active item is fine", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" }), item({ id: 2, slug: "two" })]));
    trackCurrent(sb);
    expectPass(gate(sb), "one active");
  } finally {
    sb.dispose();
  }
});

test("duplicate ids and slugs are both caught", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ id: 1, slug: "same" }), item({ id: 1, slug: "same" })]));
    const report = gate(sb);
    expectFail(report, /duplicate id: 1/, "duplicate id");
    expectFail(report, /duplicate slug: same/, "duplicate slug");
  } finally {
    sb.dispose();
  }
});

test("an empty acceptance list is a failure, not a warning", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ acceptance: [] })]));
    expectFail(gate(sb), /empty acceptance list/, "no acceptance");
  } finally {
    sb.dispose();
  }
});

test("an unknown status names the field and the value", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "almost-done" })]));
    expectFail(gate(sb), /status is "almost-done"/, "bad status");
  } finally {
    sb.dispose();
  }
});

test("a non-kebab slug is rejected because it names files and branches", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ slug: "Storage Layer" })]));
    expectFail(gate(sb), /slug must be kebab-case/, "bad slug");
  } finally {
    sb.dispose();
  }
});

test("an sdd item past specifying needs its spec artifacts on disk", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ sdd: true, status: "in_progress" })]));
    trackCurrent(sb);
    expectFail(gate(sb), /has no spec at/, "missing spec dir");

    const dir = join(sb.store.specs, "storage-layer");
    mkdirSync(dir, { recursive: true });
    for (const file of ["proposal.md", "design.md"]) writeFileSync(join(dir, file), "x".repeat(80), "utf8");
    expectFail(gate(sb), /missing or empty: tasks\.md, spec\.md/, "partial spec");

    for (const file of ["tasks.md", "spec.md"]) writeFileSync(join(dir, file), "x", "utf8");
    // Four touched files used to satisfy "the spec is complete" — the same
    // existence-is-not-content mistake the state file check exists to prevent.
    expectFail(gate(sb), /missing or empty/, "empty spec files");

    for (const file of SPEC_ARTIFACTS) writeFileSync(join(dir, file), "x".repeat(80), "utf8");
    expectPass(gate(sb), "complete spec");
  } finally {
    sb.dispose();
  }
});

test("a non-sdd item never needs a spec", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    trackCurrent(sb);
    expectPass(gate(sb), "direct path");
  } finally {
    sb.dispose();
  }
});

test("done without proof is rejected, and prose is not proof", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "done" })]));
    expectFail(gate(sb), /no ledger verdict at all/, "unproven close");

    // This test used to assert the opposite: that any non-empty closed_by
    // cleared the requirement. It locked in the escape hatch — `--closed-by
    // "I checked it myself"` passed a gate with an empty ledger, which is the
    // requirement-plus-escape-hatch shape this project criticises pstack for.
    sb.writeState(state([item({ status: "done", closed_by: "I checked it myself" })]));
    expectFail(gate(sb), /no ledger verdict at all/, "closed_by is a note, not a verdict");

    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "test-verified",
      evidence: "suite green",
      verifier: "test",
    });
    expectPass(gate(sb), "proven close");
  } finally {
    sb.dispose();
  }
});

test("a verdict recorded at an older SHA still closes an item", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "done" })]));
    const older = sb.sha;
    sb.commit();
    // The stale rule is about verification that is still load-bearing. An item
    // was verified at the SHA it closed on; holding closed items to today's
    // HEAD would turn every item ever closed red as the branch moves on.
    record(sb.store, {
      target: "storage-layer",
      sha: older,
      verdict: "test-verified",
      evidence: "suite green then",
      verifier: "test",
    });
    expectPass(gate(sb), "historic verdict");
  } finally {
    sb.dispose();
  }
});

test("an item closed on a failed verifier is rejected", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "done" })]));
    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "verifier-failed",
      evidence: "3 tests failed",
      verifier: "test",
    });
    expectFail(gate(sb), /only verdict is verifier-failed/, "closed on a failure");

    // verifier-blocked is the honest way to close something no check could
    // reach. It is typed, keyed to a SHA, and carries its reason.
    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "verifier-blocked",
      evidence: "no harness in this repo",
      verifier: "test",
    });
    expectPass(gate(sb), "blocked is a verdict");
  } finally {
    sb.dispose();
  }
});

test("more than one active item with the rule off is reported, not called idle", () => {
  const sb = sandbox();
  try {
    sb.writeState(
      state([item({ status: "in_progress" }), item({ id: 2, slug: "two", status: "reviewing" })], {
        rules: { one_active_item: false, require_verdict_to_close: true, require_spec_for_sdd_items: true },
      }),
    );
    trackCurrent(sb);
    const report = gate(sb);
    assert.equal(report.failed, false, "turning the rule off is allowed");
    assert.ok(
      report.warnings.some((w) => /2 items active with one_active_item off/.test(w)),
      `expected the count to be stated, got ${JSON.stringify(report.warnings)}`,
    );
    // `ok()` lines are not retained on the report, so the wrong-fact half is
    // pinned by capturing what the gate actually printed.
    const printed: string[] = [];
    const quiet = console.log;
    console.log = (line: unknown) => void printed.push(String(line));
    try {
      runGate(sb.store);
    } finally {
      console.log = quiet;
    }
    assert.ok(
      !printed.some((line) => /no active item/.test(line)),
      `reporting 'no active item' while two are open states the wrong fact: ${JSON.stringify(printed)}`,
    );
  } finally {
    sb.dispose();
  }
});

test("every failure carries a message, so a red gate is never silent", () => {
  const sb = sandbox();
  try {
    sb.writeState({ version: 1, project: "sandbox", rules: {}, items: {} });
    const report = gate(sb);
    assert.ok(report.failed);
    assert.ok(report.failures.length > 0, "a red gate produced no explanation");
    for (const failure of report.failures) {
      assert.ok(failure.trim().length > 10, `unhelpful failure text: ${JSON.stringify(failure)}`);
    }
  } finally {
    sb.dispose();
  }
});

/**
 * The three tests below are the whole of `--quiet`.
 *
 * `docs/wiki/The-CLI.md` said "--quiet prints failures only" and it printed
 * nothing at all, on the mode `src/hooks.ts` wires to the `Stop` hook. What
 * that cost is narrower than it first reads, and the narrow version is the true
 * one: the `Stop` hook already put the failures in `additionalContext`, so the
 * model always had them. What produced nothing was every stream — `mstack gate
 * --quiet` in a terminal or a script gave back an exit code and no bytes.
 *
 * Each test asserts the concrete bytes rather than that something was printed:
 * "quiet printed something" passes on any non-empty string, which is how a
 * check that cannot fail gets written.
 */
test("quiet prints every failure with its fix, on stderr, and nothing else", () => {
  const sb = sandbox();
  try {
    // Two failures, and two warnings alongside them: a fresh sandbox is always
    // on its default branch with .mstack/ untracked. The warnings are what make
    // "and nothing else" mean something here.
    sb.writeState(state([item({ status: "in_progress", sdd: true })]));
    const { report, out, err } = quietGate(sb);

    assert.equal(report.failed, true);
    assert.ok(report.warnings.length > 0, "fixture must warn, or the silence below proves nothing");
    assert.deepEqual(
      err.split("\n").filter((line) => line !== ""),
      [
        "[fail]  1 storage-layer (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start",
        `[fail]  sdd item storage-layer is in_progress but has no spec at ${join(sb.store.specs, "storage-layer")} -> run '/mstack:spec' or move the item back to specifying`,
      ],
      "quiet is exactly one line per failure: the fix stays, the [ok] lines, section headers, warnings and summary do not",
    );
    // The stream is not a detail. `mstack hook stop` writes its structured JSON
    // to stdout, and failure text in front of it stops that JSON parsing.
    assert.equal(out, "", "stdout belongs to the hook's JSON");
    assert.equal(err.trimEnd().split("\n").length, report.failures.length, "one line per failure, no extras");
  } finally {
    sb.dispose();
  }
});

test("a green gate in quiet mode prints exactly nothing, on either stream", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    quiesce(sb);
    const { report, out, err } = quietGate(sb);
    assert.equal(report.failed, false);
    assert.equal(report.warnings.length, 0, "this fixture is the nothing-at-all case");
    // Wiring the gate to a hook that fires every turn is only cheap if a pass
    // costs zero lines.
    assert.equal(out, "", `green gate wrote to stdout: ${JSON.stringify(out)}`);
    assert.equal(err, "", `green gate wrote to stderr: ${JSON.stringify(err)}`);
  } finally {
    sb.dispose();
  }
});

test("warnings alone print nothing in quiet mode, and do not turn the gate red", () => {
  const sb = sandbox();
  try {
    // A fresh sandbox warns twice: on the default branch, with an untracked
    // .mstack/. Both are normal mid-session states, and a Stop hook that
    // repeated them every turn is a hook someone switches off.
    sb.writeState(state([item()]));
    const { report, out, err } = quietGate(sb);
    assert.equal(report.failed, false);
    assert.ok(
      report.warnings.some((w) => /uncommitted change/.test(w)),
      `expected the fixture to warn, got ${JSON.stringify(report.warnings)}`,
    );
    assert.equal(out + err, "", `a warning-only gate printed ${JSON.stringify(out + err)}`);
  } finally {
    sb.dispose();
  }
});

test("an active item with an untouched current.md is red, because that file is the whole recovery plan", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));

    // Straight from setup: the file exists and says nothing. The third
    // end-to-end run ended correctly, on a decision_required fork, and left
    // exactly this — the question in one session's head and nothing on disk.
    expectFail(
      gate(sb),
      /is active but progress\/current\.md is not: the Item line still says _none_; Next step is still the empty template/,
      "untouched current.md",
    );
  } finally {
    sb.dispose();
  }
});

test("current.md filled in for the active item passes", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    writeFileSync(
      sb.store.current,
      "# Current session\n\n- **Item:** 1 storage-layer\n\n## Next step\n\nAnswer the export shape question.\n",
      "utf8",
    );
    expectPass(gate(sb), "filled current.md");
  } finally {
    sb.dispose();
  }
});

test("a half-filled current.md names which half is missing", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    // Item line updated, Next step left as the template. The common case, and
    // the one that matters: the header is cosmetic, the next step is the handoff.
    writeFileSync(
      sb.store.current,
      `# Current session\n\n- **Item:** 1 storage-layer\n\n## Next step\n\n${EMPTY_NEXT_STEP}\n`,
      "utf8",
    );
    const report = gate(sb);
    expectFail(report, /Next step is still the empty template/, "half-filled");
    assert.ok(
      !report.failures.some((f) => /Item line still says/.test(f)),
      `should not blame the Item line, got ${JSON.stringify(report.failures)}`,
    );
  } finally {
    sb.dispose();
  }
});

test("with no active item, current.md is not judged", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "pending" })]));
    expectPass(gate(sb), "no active item");
  } finally {
    sb.dispose();
  }
});

test("an unanswered product fork blocks the phases that build on the answer", () => {
  const sb = sandbox();
  try {
    const fork = "Stable public contract, or a dump we can reshape? The two answers produce different work.";

    // specifying is below the line on purpose: investigating the fork is work,
    // and it is the phase where the answer gets found.
    sb.writeState(state([item({ status: "specifying", sdd: true, decision_required: fork })]));
    trackCurrent(sb);
    const early = gate(sb);
    assert.ok(
      !early.failures.some((f) => /decision unanswered/.test(f)),
      `specifying must be allowed to carry an open fork: ${JSON.stringify(early.failures)}`,
    );

    for (const status of ["in_progress", "reviewing", "verifying", "done"] as const) {
      sb.writeState(state([item({ status, decision_required: fork })]));
      trackCurrent(sb);
      expectFail(gate(sb), /decision unanswered/, `open fork at ${status}`);
    }
  } finally {
    sb.dispose();
  }
});

test("the failure quotes the question, so the reader does not go looking for it", () => {
  const sb = sandbox();
  try {
    sb.writeState(
      state([item({ status: "in_progress", decision_required: "Versioned envelope, or a bare array?" })]),
    );
    trackCurrent(sb);
    expectFail(
      gate(sb),
      /"Versioned envelope, or a bare array\?"/,
      "quoted question",
    );
  } finally {
    sb.dispose();
  }
});

test("a fork answered by a real decisions row clears the item", () => {
  const sb = sandbox();
  try {
    const written = addDecision(sb.store, {
      phase: "design",
      decision: "versioned envelope",
      why: "a consumer has to be able to detect a breaking change",
      evidence: "acceptance bullet 2 of the item, quoted in state.json",
      result: "version field required",
      resolves: "storage-layer",
    });
    sb.writeState(
      state([
        item({ status: "in_progress", decision_required: "envelope or array?", decision_resolved: written.ts }),
      ]),
    );
    trackCurrent(sb);
    expectPass(gate(sb), "answered fork");
  } finally {
    sb.dispose();
  }
});

test("a pointer to a decision that does not exist is worse than no pointer", () => {
  const sb = sandbox();
  try {
    // A boolean would have let someone mark a fork answered without saying what
    // the answer was. The pointer has to lead somewhere.
    sb.writeState(
      state([
        item({ status: "in_progress", decision_required: "envelope or array?", decision_resolved: "2026-01-01T00:00:00.000Z" }),
      ]),
    );
    trackCurrent(sb);
    expectFail(gate(sb), /no row with that timestamp resolves storage-layer/, "dangling pointer");
  } finally {
    sb.dispose();
  }
});

test("an item with no fork is untouched by any of this", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "done" })]));
    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "test-verified",
      evidence: "the suite ran green",
      verifier: "t",
    });
    expectPass(gate(sb), "no fork");
  } finally {
    sb.dispose();
  }
});

test("the pass that wrote the code does not get to close the item", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "done" })]));
    // `agents/implementer.md` tells the implementer to record `--verifier
    // implementer`, and nothing read the column. `closed_by` again, in a
    // different costume, inside the check built to prevent it.
    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "test-verified",
      evidence: "the suite ran green",
      verifier: "implementer",
    });
    expectFail(gate(sb), /from the pass that wrote the code/, "self-closed");

    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "test-verified",
      evidence: "ran the suite myself rather than reading the report",
      verifier: "reviewer",
    });
    expectPass(gate(sb), "closed by a second pass");
  } finally {
    sb.dispose();
  }
});

test("a closing row citing the implementer's own report does not close the item", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "done" })]));
    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "live-verified",
      evidence: ".mstack/progress/impl_storage-layer.md",
      verifier: "implementer",
    });
    // The verifier column says reviewer; the evidence is the implementer's own
    // report. A check that reads only the column accepts this row.
    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "live-verified",
      evidence: ".mstack/progress/impl_storage-layer.md",
      verifier: "reviewer",
    });
    expectFail(gate(sb), /implementer's own report/, "self-citing close");

    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "live-verified",
      evidence: ".mstack/progress/review_storage-layer.md",
      verifier: "reviewer",
    });
    expectPass(gate(sb), "review evidence closes");
  } finally {
    sb.dispose();
  }
});

test("an unsuperseded verifier-failed closing row does not close the item", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "done" })]));
    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "live-verified",
      evidence: ".mstack/progress/impl_storage-layer.md",
      verifier: "implementer",
    });
    // The implementer's passing row keeps the every-row-failed branch from
    // firing, and the reviewer's failed row satisfies the no-self-approval
    // scan, so the reviewer saying "this does not work" closes the item.
    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "verifier-failed",
      evidence: "review found the fix incomplete",
      verifier: "reviewer",
    });
    expectFail(gate(sb), /verifier-failed/, "closed on the reviewer's failure");

    // Reopened, fixed, re-reviewed: a later closing row supersedes the failure.
    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "test-verified",
      evidence: "re-review after the fix: suite green",
      verifier: "reviewer",
    });
    expectPass(gate(sb), "superseded failure");
  } finally {
    sb.dispose();
  }
});

test("a plugin-qualified role is the same role", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "done" })]));
    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "test-verified",
      evidence: "the suite ran green",
      verifier: "mstack:implementer",
    });
    expectFail(gate(sb), /from the pass that wrote the code/, "qualified role");
  } finally {
    sb.dispose();
  }
});

/**
 * The gap these cover, stated once.
 *
 * `src/hooks.ts` wires the `Stop` hook to the fast gate, which never touched
 * `state.verify` or `item.verification`. Only a human typing `mstack gate
 * --full` executed them. In one real session an item's `verification` was a
 * non-executable string from intake and it stayed red for 230 minutes across
 * four agent passes, because nothing ran it and `sh -n` accepts it. The only
 * thing that catches a non-executable verification is running it, so `--full`
 * now writes down what it ran and the fast gate refuses to call an item green
 * on a run that never happened.
 */
test("an item one step from done whose verification never ran is red, and the command is named", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    expectFail(gate(sb), /`pytest -q` has never been executed/, "never executed");
    // The failure has to name the way out, and the way out is the only thing
    // that executes it.
    assert.ok(
      gate(sb).failures.some((f) => /run 'mstack gate --full'/.test(f)),
      `the fix must name the command that runs it: ${JSON.stringify(gate(sb).failures)}`,
    );
  } finally {
    sb.dispose();
  }
});

test("a recorded passing run at this commit turns it green", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });
    expectPass(gate(sb), "recorded green run");
  } finally {
    sb.dispose();
  }
});

test("a recorded failing run keeps the gate red, which is the 230-minute case", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "failed" });
    // "Ran and failed" and "never ran" are different facts. Collapsing them
    // would send the reader to run something that has already told them.
    expectFail(gate(sb), new RegExp(`\`pytest -q\` ran at ${sb.sha.slice(0, 8)} and failed`), "recorded red run");
  } finally {
    sb.dispose();
  }
});

test("a run recorded at an older commit does not carry over", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });
    expectPass(gate(sb), "green at this commit");

    // The ledger's rule, applied to a run. Unlike a closed item's verdict, this
    // one is still load-bearing: the item has not closed yet, and the commit it
    // would close on is not the commit anything was proven at.
    sb.commit();
    expectFail(gate(sb), /1 earlier run\(s\) exist at other commits/, "moved on");
  } finally {
    sb.dispose();
  }
});

/**
 * The cost boundary, asserted rather than described.
 *
 * This check rides the `Stop` hook, which fires at the end of every turn. Held
 * from `in_progress`, it would go red after every commit for the whole phase
 * where most commits happen, and a gate that is red for a normal mid-session
 * state is a gate someone switches off — which costs more than the gap it
 * closes. `verifying -> done` is the only legal path to `done`, so `verifying`
 * is the earliest status that is also sufficient.
 */
test("nothing before verifying is held to a run, however loudly it is configured", () => {
  const sb = sandbox();
  try {
    for (const status of ["specifying", "spec_ready", "in_progress", "reviewing"] as const) {
      sb.writeState(state([item({ status, verification: "pytest -q" })], { verify: "make check" }));
      trackCurrent(sb);
      const report = gate(sb);
      assert.ok(
        !report.failures.some((f) => /gate --full/.test(f)),
        `${status} must not owe a verification run: ${JSON.stringify(report.failures)}`,
      );
    }

    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })], { verify: "make check" }));
    trackCurrent(sb);
    expectFail(gate(sb), /gate --full/, "verifying is where the line falls");
  } finally {
    sb.dispose();
  }
});

test("an item at verifying with nothing configured warns rather than wedging", () => {
  const sb = sandbox();
  try {
    // The empty `verify` every `mstack setup` store starts with. Failing here
    // would make a fresh project's first item unclosable; what governs closing
    // with no proof is require_verdict_to_close, whose typed answer for "no
    // check could be run" is the verifier-blocked verdict.
    sb.writeState(state([item({ status: "verifying" })], { verify: "" }));
    trackCurrent(sb);
    const report = gate(sb);
    expectPass(report, "nothing configured");
    assert.ok(
      report.warnings.some((w) => /nothing verifies it/.test(w)),
      `it still has to be said out loud: ${JSON.stringify(report.warnings)}`,
    );
  } finally {
    sb.dispose();
  }
});

test("both configured commands have to have run, not just one", () => {
  const sb = sandbox();
  try {
    sb.writeState(
      state([item({ status: "verifying", verification: "pytest -q" })], { verify: "make check" }),
    );
    trackCurrent(sb);
    recordReceipt(sb, { target: "(project)", sha: sb.sha, command: "make check", outcome: "passed" });
    expectFail(gate(sb), /`pytest -q` has never been executed/, "one green does not carry the other");

    recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });
    expectPass(gate(sb), "both green");
  } finally {
    sb.dispose();
  }
});

test("with no active item the check says so instead of staying silent", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "pending", verification: "pytest -q" })]));
    const printed = captured(() => runGate(sb.store)).out;
    assert.match(printed, /no active item, so no verification run is due/);
  } finally {
    sb.dispose();
  }
});

/**
 * `--full` closes the loop it opened: it runs the commands and records what
 * happened, so the fast gate that fires on the next `Stop` can see a run it did
 * not itself perform. That split is what keeps a `Stop` hook from becoming a
 * test suite run.
 */
test("--full records what it ran, and the fast gate afterwards is green", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "true" })]));
    trackCurrent(sb);
    expectFail(gate(sb), /`true` has never been executed/, "before");

    expectPass(captured(() => runGate(sb.store, { full: true, quiet: true })).value, "--full itself");
    const rows = receipts(sb.store);
    assert.equal(rows.length, 1, `one run, one row: ${JSON.stringify(rows)}`);
    assert.equal(rows[0]?.outcome, "passed");
    assert.equal(rows[0]?.sha, sb.sha);
    assert.equal(rows[0]?.target, "storage-layer");

    expectPass(gate(sb), "after");
  } finally {
    sb.dispose();
  }
});

test("--full records a failure too, and the fast gate keeps saying it", () => {
  const sb = sandbox();
  try {
    // A command that is not a command. This is the shape of the string that
    // cost 230 minutes: `sh -n` accepts plenty that `sh` cannot run, so only
    // running it tells you anything.
    sb.writeState(state([item({ status: "verifying", verification: "false" })]));
    trackCurrent(sb);
    const full = captured(() => runGate(sb.store, { full: true, quiet: true })).value;
    expectFail(full, /`?false`? failed/, "--full itself");
    assert.equal(receipts(sb.store)[0]?.outcome, "failed");

    // The point of writing it down: the next turn's Stop hook does not run the
    // command, and still cannot call this green.
    expectFail(gate(sb), /ran at .* and failed/, "the turn after");
  } finally {
    sb.dispose();
  }
});

/**
 * Criterion 2. `--full` with nothing to run used to warn and exit 0, so asking
 * for the full gate and getting no verification at all was indistinguishable
 * from asking for it and passing.
 */
test("--full that ran nothing fails instead of reporting a pass", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })], { verify: "" }));
    trackCurrent(sb);
    const report = captured(() => runGate(sb.store, { full: true, quiet: true })).value;
    expectFail(report, /--full ran no verification/, "nothing configured");
    assert.match(
      report.failures.join("\n"),
      /storage-layer has no 'verification' command/,
      "it has to name which of the two places is empty",
    );
    assert.deepEqual(receipts(sb.store), [], "nothing ran, so nothing is recorded");
  } finally {
    sb.dispose();
  }
});

test("--full does not ask for a receipt of the run it is about to perform", () => {
  const sb = sandbox();
  try {
    // The fast check would fail this store; --full must not report a failure
    // that the same process disproves three lines later.
    sb.writeState(state([item({ status: "verifying", verification: "true" })]));
    trackCurrent(sb);
    const report = captured(() => runGate(sb.store, { full: true, quiet: true })).value;
    expectPass(report, "--full on a store with no prior run");
  } finally {
    sb.dispose();
  }
});

/**
 * Round 2, finding 1. The check that closes a fail-open gap shipped with one of
 * its own.
 *
 * `receipts` reads a file, a read throws, and `cmdHook` catches every throw and
 * returns 0 by design — so an unreadable receipt file made `mstack hook stop`
 * emit zero bytes and exit 0, which is byte-identical to a green gate, and made
 * `mstack gate` throw out of the middle so the workspace section and the summary
 * never ran. Its sibling twenty lines up has wrapped this same read since the
 * day an unreadable `decisions.tsv` did exactly this.
 */
test("an unreadable receipt file is a failure, not a green gate", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });
    expectPass(gate(sb), "readable and green");

    // A directory where the file should be. `chmod 000` is the other trigger
    // and cannot be used here: this suite has to behave the same when it runs
    // as root, where the mode bits are ignored and the read would succeed.
    rmSync(sb.store.verification);
    mkdirSync(sb.store.verification);

    const report = gate(sb);
    expectFail(report, /verification runs could not be read/, "unreadable receipt file");
    assert.ok(
      report.failures.some((f) => /EISDIR|illegal operation on a directory/i.test(f)),
      `the underlying reason has to survive into the message: ${JSON.stringify(report.failures)}`,
    );
  } finally {
    sb.dispose();
  }
});

test("an unreadable receipt file does not stop the checks below it either", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    mkdirSync(sb.store.verification);

    // The half that is easy to miss: the throw escaped mid-run, so the
    // workspace section never executed and no summary was printed. The gate
    // reports; it does not become the failure.
    const { report, err } = quietGate(sb);
    assert.equal(report.failed, true);
    assert.ok(
      report.warnings.some((w) => /uncommitted change/.test(w)),
      `the workspace section must still run: ${JSON.stringify(report.warnings)}`,
    );
    assert.ok(err.includes("[fail]"), `quiet mode still has to say something: ${JSON.stringify(err)}`);
  } finally {
    sb.dispose();
  }
});

/**
 * Round 2, finding 2. A receipt used to certify a commit, not a tree.
 *
 * A green `gate --full`, then an uncommitted edit that breaks the very command,
 * then a close: all at exit 0 with the verification red the whole time. This is
 * the item's own defect wearing a different hat, and the dirty-tree warning is a
 * uniquely weak backstop against it, because `state set --status done` writes
 * `state.json` itself, so the tree is dirty at close by construction.
 */
test("an uncommitted edit after the run voids the receipt", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    const head = quiesce(sb);
    recordReceipt(sb, { target: "storage-layer", sha: head, command: "pytest -q", outcome: "passed" });
    expectPass(gate(sb), "green against the tree it ran on");

    writeFileSync(join(sb.store.root, "app.js"), "throw new Error('broken');\n", "utf8");
    expectFail(gate(sb), /an uncommitted file has changed since/, "edited after the run");

    // ...and reverting the edit brings the receipt back, because the tree is
    // byte-identical to the one it ran against. A timestamp could not do that.
    rmSync(join(sb.store.root, "app.js"));
    expectPass(gate(sb), "the edit reverted");
  } finally {
    sb.dispose();
  }
});

/**
 * Round 3, finding A. The tree key must fingerprint **contents**, not the list
 * of dirty paths.
 *
 * The first version hashed `git status --porcelain`, whose lines are two status
 * characters and a path. So it certified *which paths are dirty*, and if the
 * tree was already dirty when `--full` ran — the ordinary mid-session state —
 * every further edit confined to those same paths was invisible. Round 1's
 * finding 2 again, one layer in, with the code and the docs both asserting the
 * guarantee it did not provide.
 *
 * Every other tree test starts from a quiesced tree, so all of them exercise
 * clean -> dirty, which moves a path-set fingerprint too. This one is the case
 * none of them reached.
 */
test("editing an already-dirty tracked file voids the receipt, though its status line does not move", () => {
  const sb = sandbox();
  try {
    writeFileSync(join(sb.store.root, "check.sh"), "exit 0\n", "utf8");
    sb.writeState(state([item({ status: "verifying", verification: "sh check.sh" })]));
    trackCurrent(sb);
    const head = quiesce(sb);

    // The precondition that made this invisible: dirty *before* the run.
    writeFileSync(join(sb.store.root, "check.sh"), "exit 0  # tweak\n", "utf8");
    recordReceipt(sb, { target: "storage-layer", sha: head, command: "sh check.sh", outcome: "passed" });
    expectPass(gate(sb), "green against the dirty tree it ran on");
    const porcelainBefore = porcelain(sb);

    // Same path, same status letter, different contents — and the verification
    // is now red.
    writeFileSync(join(sb.store.root, "check.sh"), "exit 1\n", "utf8");
    assert.equal(porcelain(sb), porcelainBefore, "the fixture is only meaningful if the status line is unchanged");
    expectFail(gate(sb), /an uncommitted file has changed since/, "content edit within an already-dirty path");
  } finally {
    sb.dispose();
  }
});

test("editing an already-dirty untracked file voids it too, which git diff alone would miss", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "sh check.sh" })]));
    trackCurrent(sb);
    const head = quiesce(sb);

    // Untracked and staying untracked: `?? check.sh` before and after, and
    // `git diff HEAD` never mentions it at all. Hashing the diff without also
    // hashing untracked contents would be the same hole in a fourth hat.
    writeFileSync(join(sb.store.root, "check.sh"), "exit 0\n", "utf8");
    recordReceipt(sb, { target: "storage-layer", sha: head, command: "sh check.sh", outcome: "passed" });
    expectPass(gate(sb), "green against the tree with that untracked file");
    const porcelainBefore = porcelain(sb);

    writeFileSync(join(sb.store.root, "check.sh"), "exit 1\n", "utf8");
    assert.equal(porcelain(sb), porcelainBefore, "still just '?? check.sh'");
    expectFail(gate(sb), /an uncommitted file has changed since/, "untracked content edit");
  } finally {
    sb.dispose();
  }
});

/**
 * Round 3, finding B. The tree is sampled *after* the commands, and a mutation
 * moving that one line left the whole suite green.
 *
 * A verification that writes anything into the repository — a log, a coverage
 * file, a snapshot — would then void its own receipt the instant it ran, so a
 * green `--full` would be followed immediately by a red gate. That is the
 * disable-it failure the cost boundary exists to bound.
 */
test("a verification that writes into the repository does not void its own receipt", () => {
  const sb = sandbox();
  try {
    sb.writeState(
      state([item({ status: "verifying", verification: "printf 'ran\\n' >> build.log" })]),
    );
    trackCurrent(sb);
    quiesce(sb);

    expectPass(captured(() => runGate(sb.store, { full: true, quiet: true })).value, "--full itself");
    // The artifact exists now, and it did not exist when the command started.
    assert.equal(readFileSync(join(sb.store.root, "build.log"), "utf8"), "ran\n");
    expectPass(gate(sb), "the very next fast gate, with nothing else touched");
  } finally {
    sb.dispose();
  }
});

/**
 * Round 4. The whole point of the symlink fix, end to end.
 *
 * An ordinary untracked symlink to a directory — a `venv`, a shared assets dir,
 * a package link — made `hash-object` fail, which made `treeId` `unknown`, which
 * switched the tree half of the key off for the whole session. A green `--full`,
 * then a genuinely red verification, and the gate still said `PASSED` and the
 * item closed. Two commands, no exotic state.
 */
test("an untracked symlink does not switch the tree half off, so a red verification stays caught", () => {
  const sb = sandbox();
  try {
    const shared = mkdtempSync(join(tmpdir(), "mstack-assets-"));
    try {
      writeFileSync(join(sb.store.root, "check.sh"), "exit 0\n", "utf8");
      sb.writeState(state([item({ status: "verifying", verification: "sh check.sh" })]));
      trackCurrent(sb);
      quiesce(sb);
      symlinkSync(shared, join(sb.store.root, "assets"));

      expectPass(captured(() => runGate(sb.store, { full: true, quiet: true })).value, "--full itself");
      assert.notEqual(
        receipts(sb.store)[0]?.tree,
        "unknown",
        "the receipt must carry a real tree, or the key is off and everything below is theatre",
      );

      // The verification is now genuinely red, uncommitted.
      writeFileSync(join(sb.store.root, "check.sh"), "exit 1\n", "utf8");
      expectFail(gate(sb), /an uncommitted file has changed since/, "red verification behind a symlink");
    } finally {
      rmSync(shared, { recursive: true, force: true });
    }
  } finally {
    sb.dispose();
  }
});

/**
 * Round 3, finding C. `unknown` is the one tree value that switches half the key
 * off, because both sides compute it identically and therefore match.
 *
 * The gate used to print "verification ran and passed" over the top of that,
 * which is the mechanism claiming a check it did not make.
 */
test("a tree git cannot describe is said out loud, not passed over in silence", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    const head = quiesce(sb);
    recordReceipt(sb, { target: "storage-layer", sha: head, command: "pytest -q", outcome: "passed" });
    const clean = gate(sb);
    assert.deepEqual(clean.warnings.filter((w) => /working tree/.test(w)), [], "nothing to say when git answers");

    // `rev-parse HEAD` still works with an unreadable index, so `headSha` does
    // not short-circuit and the check runs with the tree half disabled.
    rmSync(join(sb.store.root, ".git", "index"));
    mkdirSync(join(sb.store.root, ".git", "index"));

    const report = gate(sb);
    assert.ok(
      report.warnings.some((w) => /only the commit half of the verification key was checked/.test(w)),
      `the disabled half has to be named: ${JSON.stringify(report.warnings)}`,
    );
  } finally {
    sb.dispose();
  }
});

/**
 * The same rule against a *tracked* file, which is a different porcelain line
 * and was a real bug for one commit.
 *
 * An untracked file is `?? path`; a modified tracked one is ` M path`, whose
 * first status character is a space. `git()` trims its whole output, so that
 * leading space was eaten off the first line only and the path parse returned
 * `rc/app.js` for `src/app.js`. Every fixture with two dirty files passed and
 * this one did not, which is exactly the shape that ships.
 */
test("a modified tracked file voids the receipt too, leading space and all", () => {
  const sb = sandbox();
  try {
    writeFileSync(join(sb.store.root, "app.js"), "module.exports = 1;\n", "utf8");
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    const head = quiesce(sb);
    recordReceipt(sb, { target: "storage-layer", sha: head, command: "pytest -q", outcome: "passed" });
    expectPass(gate(sb), "committed and green");

    writeFileSync(join(sb.store.root, "app.js"), "module.exports = 2;\n", "utf8");
    expectFail(gate(sb), /an uncommitted file has changed since/, "one modified tracked file");
  } finally {
    sb.dispose();
  }
});

test("edits inside .mstack/ do not void a run, or the gate would be red every turn", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    const head = quiesce(sb);
    recordReceipt(sb, { target: "storage-layer", sha: head, command: "pytest -q", outcome: "passed" });

    // Exactly what every session does while an item is open. A fingerprint over
    // the whole porcelain output would go red because someone wrote a line of
    // their own progress notes.
    writeFileSync(sb.store.current, "# Current session\n\n- **Item:** 1 storage-layer\n\n## Next step\n\nkeep going\n", "utf8");
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q", description: "a note" })]));
    expectPass(gate(sb), "store churn is not code churn");
  } finally {
    sb.dispose();
  }
});

test("a run recorded before the tree column existed says so rather than blaming a tree", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    // What `ensureHeader` leaves behind when it widens a store written by the
    // previous version: the row is at this commit, and its tree is unknown.
    recordRaw(sb.store, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed", tree: "" });
    expectFail(gate(sb), /before receipts recorded the working tree/, "pre-migration row");
  } finally {
    sb.dispose();
  }
});

/**
 * Round 2, finding 3. A store created before this change commits its receipts,
 * and a committed receipt cannot vouch for the commit that carries it.
 */
test("a receipt file that git would commit is called out by name", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    trackCurrent(sb);
    rmSync(join(sb.store.dir, ".gitignore"));
    recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });

    const report = gate(sb);
    assert.ok(
      report.warnings.some((w) => /verification\.tsv is not gitignored/.test(w)),
      `an unignored receipt file has to be named: ${JSON.stringify(report.warnings)}`,
    );
    // Naming the cause is the point; both commands the recovery needs are in it.
    const warning = report.warnings.find((w) => /not gitignored/.test(w)) ?? "";
    assert.match(warning, /mstack setup/);
    assert.match(warning, /git rm --cached/);
  } finally {
    sb.dispose();
  }
});

test("the ignored case says nothing at all, on the path that runs every turn", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    trackCurrent(sb);
    recordReceipt(sb, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });
    const report = gate(sb);
    assert.deepEqual(
      report.warnings.filter((w) => /gitignored/.test(w)),
      [],
      "setup already wrote the .gitignore, so there is nothing to say",
    );
  } finally {
    sb.dispose();
  }
});

test("an unnamed verifier does not close an item either", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "done" })]));
    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "test-verified",
      evidence: "the suite ran green",
      verifier: "",
    });
    expectFail(gate(sb), /from the pass that wrote the code/, "unnamed verifier");
  } finally {
    sb.dispose();
  }
});

/**
 * CLI provenance: a foreign copy of this CLI must not produce a green report
 * inside an mstack checkout.
 *
 * These run in-process, so "the running CLI" is this repository — the code the
 * test suite executes — and a sandbox in tmpdir is always foreign to it. The
 * agreeing-roots branch is unreachable that way, which is what the injectable
 * `running` parameter and the process-level tests in provenance.test.ts are
 * for.
 */
function checkoutMarkers(sb: ReturnType<typeof sandbox>, manifest: string | null = '{ "name": "mstack" }\n'): void {
  mkdirSync(join(sb.store.root, "bin"), { recursive: true });
  mkdirSync(join(sb.store.root, "src"), { recursive: true });
  writeFileSync(join(sb.store.root, "bin", "mstack"), "#!/bin/sh\n", "utf8");
  writeFileSync(join(sb.store.root, "src", "cli.ts"), "// marker\n", "utf8");
  // Every real checkout shape carries the repository's package.json (with
  // "type": "module"); a fixture standing in for one carries the real file too,
  // so the shape stays faithful as the file evolves. `isMstackCheckout` does
  // not key on it, so the not-a-checkout variants below are unaffected.
  copyFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
    join(sb.store.root, "package.json"),
  );
  if (manifest !== null) {
    mkdirSync(join(sb.store.root, ".claude-plugin"), { recursive: true });
    writeFileSync(join(sb.store.root, ".claude-plugin", "plugin.json"), manifest, "utf8");
  }
}

test("a foreign CLI against a store rooted in an mstack checkout is a red gate that names both paths", () => {
  const sb = sandbox();
  try {
    checkoutMarkers(sb);
    sb.writeState(state([item()]));
    const report = gate(sb);
    expectFail(report, /store's root is an mstack checkout/, "foreign CLI in a checkout");
    // Both halves of the fix: which copy actually ran, and which one to run.
    const line = report.failures.find((f) => /mstack checkout/.test(f)) ?? "";
    assert.ok(line.includes(join(sb.store.root, "bin", "mstack")), `the fix names the store's own launcher: ${line}`);
  } finally {
    sb.dispose();
  }
});

test("the store's own CLI in its own checkout is an [ok] line, not silence", () => {
  const sb = sandbox();
  try {
    checkoutMarkers(sb);
    const report = new Report();
    const { out } = captured(() => checkCliProvenance(sb.store, report, sb.store.root));
    assert.equal(report.failed, false, `own copy reported: ${JSON.stringify(report.failures)}`);
    assert.match(out, /mstack checkout.*its own \.\/bin\/mstack/, "the agreeing case says so out loud");
  } finally {
    sb.dispose();
  }
});

test("an ordinary repository never sees the provenance check, even from a foreign CLI", () => {
  // The plugin CLI is *supposed* to be foreign in a user's repo. A check that
  // fired there would train every user to ignore it.
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    const report = gate(sb);
    expectPass(report, "ordinary repo");
    assert.deepEqual(
      report.failures.filter((f) => /checkout/.test(f)),
      [],
      "no provenance line in a repo with no bin/mstack of its own",
    );
  } finally {
    sb.dispose();
  }
});

test("one marker alone is not a checkout: both bin/mstack and src/cli.ts are required", () => {
  // A repo that vendors a launcher script, or one with an unrelated src/cli.ts,
  // is still a user's repo. Firing on half the evidence is how a check becomes
  // noise, and noise is how it gets switched off.
  for (const marker of ["bin/mstack", "src/cli.ts"]) {
    const sb = sandbox();
    try {
      sb.writeState(state([item()]));
      mkdirSync(join(sb.store.root, marker.split("/")[0]!), { recursive: true });
      writeFileSync(join(sb.store.root, marker), "content\n", "utf8");
      const report = gate(sb);
      expectPass(report, `only ${marker} present`);
      assert.deepEqual(
        report.failures.filter((f) => /checkout/.test(f)),
        [],
        `${marker} alone must not fire the check`,
      );
    } finally {
      sb.dispose();
    }
  }
});

test("both file markers without the plugin manifest are a user's repo, and the check stays silent", () => {
  // Round one fired here, and its fix: line named the very command that had
  // just produced the failure — a wrapper at bin/mstack plus an unremarkable
  // src/cli.ts, in a project that has nothing to do with this plugin. The
  // manifest is the identity; without it there is nothing to say.
  const sb = sandbox();
  try {
    checkoutMarkers(sb, null);
    sb.writeState(state([item()]));
    const report = gate(sb);
    expectPass(report, "wrapper repo without a manifest");
    assert.deepEqual(
      report.failures.filter((f) => /checkout/.test(f)),
      [],
      "no provenance line without the mstack manifest",
    );
  } finally {
    sb.dispose();
  }
});

test("every manifest failure shape isMstackCheckout promises reads as not-a-checkout", () => {
  // Silence is the only safe failure direction in a stranger's repo. mstack's
  // own manifest going bad is lint-plugin's problem, not a gate failure in
  // somebody else's project. The shapes here are the contract the function's
  // own comment states — differently named, unparseable, parsed-but-not-an-
  // object, and unreadable (a directory at the manifest path, which throws
  // EISDIR out of readFileSync) — plus "missing", covered by the wrapper-repo
  // test above. The one shape a catch cannot cover, a read that blocks rather
  // than throws, is the fifo process test in provenance.test.ts.
  const shapes: [string, (manifestPath: string) => void][] = [
    ["someone else's name", (p) => writeFileSync(p, '{ "name": "their-plugin" }\n', "utf8")],
    ["unparseable", (p) => writeFileSync(p, "{ not json\n", "utf8")],
    ["JSON null", (p) => writeFileSync(p, "null\n", "utf8")],
    ["a directory", (p) => mkdirSync(p)],
  ];
  for (const [label, install] of shapes) {
    const sb = sandbox();
    try {
      checkoutMarkers(sb, null);
      mkdirSync(join(sb.store.root, ".claude-plugin"), { recursive: true });
      install(join(sb.store.root, ".claude-plugin", "plugin.json"));
      sb.writeState(state([item()]));
      const report = gate(sb);
      expectPass(report, `manifest shape: ${label}`);
      assert.deepEqual(
        report.failures.filter((f) => /checkout/.test(f)),
        [],
        `manifest shape "${label}" must not fire the check`,
      );
    } finally {
      sb.dispose();
    }
  }
});
