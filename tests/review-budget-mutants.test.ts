import { test } from "node:test";
import assert from "node:assert/strict";

import { add, all } from "../src/decisions.ts";
import { cli, inWorld, report, SPAWNING } from "./budget-helpers.ts";

/**
 * Item 43, round 2: the three mutants the round 1 review left alive. The
 * `--sdd`-in-the-same-command one is in tests/spec-size-forced.test.ts.
 */

const BODY = report(200);

test("the budget is reported at specifying and spec_ready, not only from in_progress", SPAWNING, () => {
  for (const status of ["specifying", "spec_ready"]) {
    inWorld({ status, reports: { "spec_bud.md": report(24577) } }, (box) => {
      const gate = cli(box, "gate");
      assert.equal(gate.code, 1, `${status}: ${gate.stdout}`);
      assert.match(gate.stdout, /spec_bud\.md is 24577 bytes, over the 24576 byte limit/);
    });
  }
});

test("--solo writes its row for this item even when another item already has the same phase", SPAWNING, () => {
  inWorld({ reports: { "review_bud.md": BODY, "review_bud_r2.md": BODY } }, (box) => {
    add(box.store, { phase: "review-r3", decision: "d", why: "w", evidence: "e", result: "r", item: "other" });
    const r = cli(box, "fanout", "plan", "--kind", "review", "--solo", "--justify", "this item needs round 3");
    assert.equal(r.code, 0, r.stderr);
    const mine = all(box.store).filter((d) => d.phase === "review-r3" && d.item === "bud");
    assert.equal(mine.length, 1);
    assert.equal(mine[0]?.decision, "this item needs round 3");
  });
});
