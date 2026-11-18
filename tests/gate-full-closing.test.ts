import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { cli, inWorld, put, report, SPAWNING, type Box } from "./budget-helpers.ts";

/**
 * Item 43, round 2, point 3: `mstack gate --full` reports the closing checks the
 * plain gate reports (the requirement table, the review budget), and still runs
 * the verification. Before, `--full` skipped them and printed PASSED over a
 * 30 KB report and over a missing table, where `gate` failed.
 */

const LIMIT = 24576;
const RAN = "ran.flag";
const VERIFY = `touch ${RAN}`;
const ran = (box: Box): boolean => existsSync(join(box.store.root, RAN));

test("--full is red over a missing requirement table exactly where the plain gate is, and still runs the verification", SPAWNING, () => {
  inWorld({ status: "reviewing", verification: VERIFY }, (box) => {
    put(box, ".mstack/progress/impl_bud.md", "# Report\n\nno table here, only prose to pass the stub floor\n");
    const plain = cli(box, "gate");
    assert.equal(plain.code, 1, plain.stdout);
    assert.match(plain.stdout, /requirement-to-test table|R to test|\| R \| Test \| Where \|/);
    const full = cli(box, "gate", "--full");
    assert.equal(full.code, 1, full.stdout);
    assert.match(full.stdout, /requirement-to-test table|R to test|\| R \| Test \| Where \|/);
    assert.equal(ran(box), true, "the verification must still run");
  });
});

test("--full is red over a report past the cap exactly where the plain gate is, and still runs the verification", SPAWNING, () => {
  inWorld({ status: "reviewing", verification: VERIFY, reports: { "review_bud.md": report(LIMIT + 1) } }, (box) => {
    const plain = cli(box, "gate");
    assert.equal(plain.code, 1, plain.stdout);
    assert.match(plain.stdout, /review_bud\.md is 24577 bytes, over the 24576 byte limit/);
    const full = cli(box, "gate", "--full");
    assert.equal(full.code, 1, full.stdout);
    assert.match(full.stdout, /review_bud\.md is 24577 bytes, over the 24576 byte limit/);
    assert.equal(ran(box), true);
  });
});

test("--full is red for a round-3 report with no row, like the plain gate", SPAWNING, () => {
  inWorld({ status: "reviewing", verification: VERIFY, reports: { "review_bud_r3.md": report(200) } }, (box) => {
    assert.equal(cli(box, "gate").code, 1);
    const full = cli(box, "gate", "--full");
    assert.equal(full.code, 1, full.stdout);
    assert.match(full.stdout, /review_bud_r3\.md is round 3 and has no decision row/);
  });
});

test("--full is green where the plain gate is green, and runs the verification once", SPAWNING, () => {
  inWorld({ status: "reviewing", verification: VERIFY }, (box) => {
    assert.equal(cli(box, "gate").code, 0);
    const full = cli(box, "gate", "--full");
    assert.equal(full.code, 0, full.stdout + full.stderr);
    assert.match(full.stdout, /PASSED/);
    assert.equal(ran(box), true);
  });
});
