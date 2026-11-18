import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { reportFiles } from "../src/roles.ts";
import { cli, inWorld, report, SPAWNING } from "./budget-helpers.ts";

/**
 * Item 43, round 2, point 2: the way out for a report over the cap whose author is
 * gone is `.mstack/progress/attachments/<report file name>`. What sits there is not
 * a report (src/roles.ts does not read it) and the cap does not count it, and the
 * gate's failure line for an over-cap report names that way out.
 */

const LIMIT = 24576;

test("a file under progress/attachments is not read as a report, whatever its name", SPAWNING, () => {
  inWorld({ reports: { "review_bud.md": report(200) } }, (box) => {
    const dir = join(box.store.progress, "attachments");
    mkdirSync(dir, { recursive: true });
    for (const name of ["review_bud.md", "review_bud_r3.md", "impl_bud.md", "spec_bud.md"]) writeFileSync(join(dir, name), report(LIMIT * 2));
    const seen = reportFiles(box.store.progress, "review", "bud").map((f) => f.slice(box.store.progress.length + 1));
    assert.deepEqual(seen, ["review_bud.md"]);
    assert.deepEqual(reportFiles(box.store.progress, "impl", "bud"), []);
  });
});

test("the cap does not count attachments, and the next lone review is still round 2", SPAWNING, () => {
  inWorld({ status: "reviewing", reports: { "review_bud.md": report(200) } }, (box) => {
    const dir = join(box.store.progress, "attachments");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "review_bud.md"), report(LIMIT * 2));
    writeFileSync(join(dir, "review_bud_r3.md"), report(LIMIT * 2));
    const gate = cli(box, "gate");
    assert.equal(gate.code, 0, gate.stdout);
    const plan = cli(box, "fanout", "plan", "--kind", "review", "--solo");
    assert.match(plan.stdout, /review_bud_r2\.md/);
  });
});

test("the failure line for an over-cap report names the attachments way out", SPAWNING, () => {
  inWorld({ status: "reviewing", reports: { "review_bud.md": report(LIMIT + 1) } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /\.mstack\/progress\/attachments\/review_bud\.md/);
    assert.match(gate.stdout, /coordinating session/);
    assert.match(gate.stdout, /unchanged/);
    assert.match(gate.stdout, /docs\/wiki\/Gates-and-Hooks\.md/);
  });
});
