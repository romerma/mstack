import { test } from "node:test";
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { join } from "node:path";

import { all } from "../src/decisions.ts";
import { cli, inWorld, put, report, SPAWNING, type Box } from "./budget-helpers.ts";

/**
 * Item 43, round 2, point 1: a review round is counted over every review report
 * of the item, lone or lensed. A round-1 panel is round 1, so the next lone
 * review is round 2 and the third review of any shape needs its reason.
 */

const PLAN = ["fanout", "plan", "--kind", "review", "--solo"];
const BODY = report(200);
const path = (box: Box, name: string): string => join(realpathSync(box.store.progress), name);
const line = (out: string, n: number): string => out.split("\n")[n] ?? "";

test("a round-1 panel, then two lone reviews: the third review asks for a reason", SPAWNING, () => {
  inWorld({ reports: { "review_bud_correctness.md": BODY, "review_bud_tests.md": BODY } }, (box) => {
    const second = cli(box, ...PLAN);
    assert.equal(second.code, 0, second.stderr);
    assert.equal(line(second.stdout, 1), path(box, "review_bud_r2.md"));
    put(box, ".mstack/progress/review_bud_r2.md", BODY);

    const third = cli(box, ...PLAN);
    assert.equal(third.code, 2, third.stdout);
    assert.match(third.stderr, /round 3 of a lone review of bud needs a reason/);
    assert.equal(all(box.store).length, 0);

    const allowed = cli(box, ...PLAN, "--justify", "the panel and round 2 left a blocking finding");
    assert.equal(allowed.code, 0, allowed.stderr);
    assert.equal(line(allowed.stdout, 1), path(box, "review_bud_r3.md"));
    assert.equal(all(box.store)[0]?.phase, "review-r3");
  });
});

test("with _r3 on disk and _r2 missing the next is _r4, and with nothing on disk it is review_<slug>.md", SPAWNING, () => {
  inWorld({ reports: { "review_bud_r3.md": BODY } }, (box) => {
    const r = cli(box, ...PLAN, "--justify", "a late round");
    assert.equal(line(r.stdout, 1), path(box, "review_bud_r4.md"));
  });
  inWorld({}, (box) => {
    assert.equal(line(cli(box, ...PLAN).stdout, 1), path(box, "review_bud.md"));
  });
});

test("a lensed round-2 panel counts too: the next lone review is round 3 and needs a reason", SPAWNING, () => {
  inWorld({ reports: { "review_bud.md": BODY, "review_bud_r2-facts.md": BODY } }, (box) => {
    const r = cli(box, ...PLAN);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /round 3 of a lone review of bud needs a reason/);
  });
});

test("the gate is red for a round-3 report with no row after a panel and a lone round 2", SPAWNING, () => {
  inWorld({ status: "reviewing", reports: { "review_bud_correctness.md": BODY, "review_bud_r2.md": BODY, "review_bud_r3.md": BODY } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /review_bud_r3\.md is round 3 and has no decision row \(phase review-r3, item bud\)/);
  });
});
