import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { join } from "node:path";

import { add as addDecision } from "../src/decisions.ts";
import { cli, inWorld, report, reportWithTable, SPAWNING, type Box } from "./budget-helpers.ts";
import { recordClosingVerdict } from "./helpers.ts";

/**
 * Item 43, seam 3: `mstack gate` on a store whose active item has a base, with a
 * round 3 review report with and without its decision row, and a report over and
 * under 24 KB. The closing door (`state set --status done`) is asked the same.
 */

const BODY = report(200);
const LIMIT = 24576;

const decide = (box: Box, phase: string, item: string): void => {
  const r = cli(box, "decide", "--phase", phase, "--item", item, "--decision", "a third round is worth it", "--why", "two blocking findings were open", "--evidence", "review_bud_r2.md", "--result", "allowed");
  assert.equal(r.code, 0, r.stderr);
};

// ----------------------------------------------------------------- round 3 needs its row

test("a round 3 review report with no decision row fails the gate, naming the report and the command", SPAWNING, () => {
  inWorld({ status: "reviewing", reports: { "review_bud_r3.md": BODY } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /its review report \.mstack\/progress\/review_bud_r3\.md is round 3 and has no decision row \(phase review-r3, item bud\)/);
    assert.match(gate.stdout, /mstack fanout plan --kind review --solo --justify/);
  });
});

test("the same report passes once the review-r3 row for that item exists", SPAWNING, () => {
  inWorld({ status: "reviewing", reports: { "review_bud_r3.md": BODY } }, (box) => {
    decide(box, "review-r3", "bud");
    const gate = cli(box, "gate");
    assert.equal(gate.code, 0, gate.stdout + gate.stderr);
  });
});

test("a lensed round 3 report needs the row too, and round 2 does not", SPAWNING, () => {
  inWorld({ status: "reviewing", reports: { "review_bud_r3-facts.md": BODY } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.match(gate.stdout, /review_bud_r3-facts\.md is round 3 and has no decision row/);
  });
  inWorld({ status: "reviewing", reports: { "review_bud.md": BODY, "review_bud_r2.md": BODY, "review_bud_r2-facts.md": BODY } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 0, gate.stdout);
  });
});

test("a row of another round, or of another item, does not cover the report", SPAWNING, () => {
  inWorld({ status: "reviewing", reports: { "review_bud_r4.md": BODY } }, (box) => {
    decide(box, "review-r3", "bud");
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.match(gate.stdout, /review_bud_r4\.md is round 4 and has no decision row \(phase review-r4, item bud\)/);
  });
  inWorld({ status: "reviewing", reports: { "review_bud_r3.md": BODY } }, (box) => {
    addDecision(box.store, { phase: "review-r3", decision: "d", why: "w", evidence: "e", result: "r", item: "other" });
    assert.equal(cli(box, "gate").code, 1);
    addDecision(box.store, { phase: "review-r3", decision: "d", why: "w", evidence: "e", result: "r", item: "" });
    assert.equal(cli(box, "gate").code, 1);
  });
});

test("only an item with a base is checked", SPAWNING, () => {
  inWorld({ status: "reviewing", base: false, reports: { "review_bud_r3.md": BODY, "impl_bud.md": report(LIMIT + 1) } }, (box) => {
    const gate = cli(box, "gate");
    assert.doesNotMatch(gate.stdout, /decision row|bytes/);
  });
});

test("the round 3 report is held at every active status, not only at review", SPAWNING, () => {
  for (const status of ["in_progress", "verifying"]) {
    inWorld({ status, reports: { "review_bud_r3.md": BODY } }, (box) => {
      const gate = cli(box, "gate");
      assert.match(gate.stdout, /review_bud_r3\.md is round 3 and has no decision row/, status);
    });
  }
});

// ----------------------------------------------------------------- 24 KB

test("a report of exactly 24576 bytes passes and one byte more fails, naming the file and its size", SPAWNING, () => {
  inWorld({ reports: { "impl_bud.md": report(LIMIT) } }, (box) => {
    assert.equal(statSync(join(box.store.progress, "impl_bud.md")).size, LIMIT);
    const gate = cli(box, "gate");
    assert.equal(gate.code, 0, gate.stdout);
  });
  inWorld({ reports: { "impl_bud.md": report(LIMIT + 1) } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    assert.match(gate.stdout, /its report \.mstack\/progress\/impl_bud\.md is 24577 bytes, over the 24576 byte limit/);
  });
});

test("every kind of report is held to it: spec, spec review, implementation, review, lensed or later round", SPAWNING, () => {
  const names = ["spec_bud.md", "spec_review_bud.md", "impl_bud_r2.md", "review_bud_facts.md", "review_bud_r2.md"];
  inWorld({ reports: Object.fromEntries(names.map((n) => [n, report(LIMIT + 7)])) }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1);
    for (const n of names) assert.match(gate.stdout, new RegExp(`its report \\.mstack/progress/${n} is ${LIMIT + 7} bytes`), n);
  });
});

test("another item's big report is not this item's", SPAWNING, () => {
  inWorld({ reports: { "impl_other.md": report(LIMIT * 2), "impl_bud-more.md": report(LIMIT * 2) } }, (box) => {
    assert.equal(cli(box, "gate").code, 0);
  });
});

// ----------------------------------------------------------------- the closing door

test("closing is refused over a big report, and --force does not vouch for it", SPAWNING, () => {
  inWorld({ status: "verifying", reports: { "impl_bud.md": reportWithTable(LIMIT + 1) } }, (box) => {
    recordClosingVerdict(box, "bud");
    const done = cli(box, "state", "set", "bud", "--status", "done");
    assert.notEqual(done.code, 0);
    assert.match(done.stderr, /bud cannot close: its report \.mstack\/progress\/impl_bud\.md is 24577 bytes/);
    const forced = cli(box, "state", "set", "bud", "--status", "done", "--force", "--closed-by", "it is fine");
    assert.notEqual(forced.code, 0);
    assert.match(forced.stderr, /24577 bytes/);
  });
});

test("closing is refused over a round 3 report with no row", SPAWNING, () => {
  inWorld({ status: "verifying", reports: { "review_bud_r3.md": BODY } }, (box) => {
    recordClosingVerdict(box, "bud");
    const done = cli(box, "state", "set", "bud", "--status", "done");
    assert.notEqual(done.code, 0);
    assert.match(done.stderr, /review_bud_r3\.md is round 3 and has no decision row/);
  });
});
