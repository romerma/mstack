import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { runGate, SPEC_ARTIFACTS } from "../src/gate.ts";
import { record } from "../src/ledger.ts";
import { add as addDecision } from "../src/decisions.ts";
import { EMPTY_NEXT_STEP } from "../src/setup.ts";
import { expectFail, expectPass, item, sandbox, state, trackCurrent } from "./helpers.ts";

const gate = (sb: ReturnType<typeof sandbox>) => runGate(sb.store, { quiet: true });

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

test("an active item with an untouched current.md is red, because that file is the whole recovery plan", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));

    // Straight from setup: the file exists and says nothing. The third
    // end-to-end run ended correctly, on a decision_required fork, and left
    // exactly this — the question in one session's head and nothing on disk.
    expectFail(
      runGate(sb.store, { quiet: true }),
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
    expectPass(runGate(sb.store, { quiet: true }), "filled current.md");
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
    const report = runGate(sb.store, { quiet: true });
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
    expectPass(runGate(sb.store, { quiet: true }), "no active item");
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
    const early = runGate(sb.store, { quiet: true });
    assert.ok(
      !early.failures.some((f) => /decision unanswered/.test(f)),
      `specifying must be allowed to carry an open fork: ${JSON.stringify(early.failures)}`,
    );

    for (const status of ["in_progress", "reviewing", "verifying", "done"] as const) {
      sb.writeState(state([item({ status, decision_required: fork })]));
      trackCurrent(sb);
      expectFail(runGate(sb.store, { quiet: true }), /decision unanswered/, `open fork at ${status}`);
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
      runGate(sb.store, { quiet: true }),
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
    expectPass(runGate(sb.store, { quiet: true }), "answered fork");
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
    expectFail(runGate(sb.store, { quiet: true }), /no row with that timestamp resolves storage-layer/, "dangling pointer");
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
    expectPass(runGate(sb.store, { quiet: true }), "no fork");
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
    expectFail(runGate(sb.store, { quiet: true }), /from the pass that wrote the code/, "self-closed");

    record(sb.store, {
      target: "storage-layer",
      sha: sb.sha,
      verdict: "test-verified",
      evidence: "ran the suite myself rather than reading the report",
      verifier: "reviewer",
    });
    expectPass(runGate(sb.store, { quiet: true }), "closed by a second pass");
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
    expectFail(runGate(sb.store, { quiet: true }), /from the pass that wrote the code/, "qualified role");
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
    expectFail(runGate(sb.store, { quiet: true }), /from the pass that wrote the code/, "unnamed verifier");
  } finally {
    sb.dispose();
  }
});
