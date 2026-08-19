import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { runGate } from "../src/gate.ts";
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
    for (const file of ["proposal.md", "design.md"]) writeFileSync(join(dir, file), "x", "utf8");
    expectFail(gate(sb), /missing tasks\.md, spec\.md/, "partial spec");

    for (const file of ["tasks.md", "spec.md"]) writeFileSync(join(dir, file), "x", "utf8");
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

test("done without proof is rejected", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "done" })]));
    expectFail(gate(sb), /neither closed_by nor a ledger verdict/, "unproven close");

    sb.writeState(state([item({ status: "done", closed_by: "PR #12 squash-merged as abc1234" })]));
    expectPass(gate(sb), "proven close");
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
