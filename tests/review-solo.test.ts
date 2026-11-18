import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";

import { all } from "../src/decisions.ts";
import { cli, inWorld, report, SPAWNING, type Box } from "./budget-helpers.ts";

/**
 * Item 43, seam 2: `mstack fanout plan --kind review --solo`: the path it
 * allocates, the --justify rule from round 3, the decision row it writes and
 * the sha it prints.
 */

const PLAN = ["fanout", "plan", "--kind", "review", "--solo"];
const BODY = report(200);

const git = (box: Box, ...args: string[]): string =>
  execFileSync("git", args, { cwd: box.store.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

// The CLI runs in the resolved directory (/private/var on macOS), the sandbox names the symlink.
const path = (box: Box, name: string): string => join(realpathSync(box.store.progress), name);

/** Line n (0-based) of stdout. */
const line = (out: string, n: number): string => out.split("\n")[n] ?? "";

test("round 1 is review_<slug>.md, and nothing is created", SPAWNING, () => {
  inWorld({}, (box) => {
    const r = cli(box, ...PLAN);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(line(r.stdout, 1), path(box, "review_bud.md"));
    assert.equal(existsSync(join(box.store.progress, "review_bud.md")), false);
  });
});

test("the next round is one more than the highest lone round on disk; lensed reports do not count", SPAWNING, () => {
  inWorld({ reports: { "review_bud.md": BODY, "review_bud_r5-facts.md": BODY, "review_bud_facts.md": BODY } }, (box) => {
    assert.equal(line(cli(box, ...PLAN).stdout, 1), path(box, "review_bud_r2.md"));
  });
  inWorld({ reports: { "review_bud.md": BODY, "review_bud_r2.md": BODY, "review_bud_r10.md": BODY } }, (box) => {
    const r = cli(box, ...PLAN, "--justify", "a late round");
    assert.equal(line(r.stdout, 1), path(box, "review_bud_r11.md"));
  });
});

test("round 2 needs no justification and writes no decision row", SPAWNING, () => {
  inWorld({ reports: { "review_bud.md": BODY } }, (box) => {
    const r = cli(box, ...PLAN);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(all(box.store).length, 0);
  });
});

test("round 3 is refused without --justify, says why, and writes nothing", SPAWNING, () => {
  inWorld({ reports: { "review_bud.md": BODY, "review_bud_r2.md": BODY } }, (box) => {
    const r = cli(box, ...PLAN);
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /round 3 of a lone review of bud needs a reason/);
    assert.match(r.stderr, /--justify "<why another round is worth it>"/);
    assert.equal(all(box.store).length, 0);
    assert.equal(r.stdout, "");
  });
});

test("round 3 with --justify writes the review-r3 row for the active item and prints the path", SPAWNING, () => {
  inWorld({ reports: { "review_bud.md": BODY, "review_bud_r2.md": BODY } }, (box) => {
    const r = cli(box, ...PLAN, "--justify", "round 2 left two blocking findings open");
    assert.equal(r.code, 0, r.stderr);
    assert.equal(line(r.stdout, 1), path(box, "review_bud_r3.md"));
    const rows = all(box.store);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.phase, "review-r3");
    assert.equal(rows[0]?.decision, "round 2 left two blocking findings open");
    assert.equal(rows[0]?.item, "bud");
    assert.equal(rows[0]?.evidence, ".mstack/progress/review_bud_r3.md");
  });
});

test("asking again for the same round does not write a second row", SPAWNING, () => {
  inWorld({ reports: { "review_bud.md": BODY, "review_bud_r2.md": BODY } }, (box) => {
    assert.equal(cli(box, ...PLAN, "--justify", "first reason").code, 0);
    const again = cli(box, ...PLAN, "--justify", "second reason");
    assert.equal(again.code, 0, again.stderr);
    assert.equal(all(box.store).length, 1);
    assert.equal(all(box.store)[0]?.decision, "first reason");
  });
});

test("--justify below round 3 is not needed and writes no row", SPAWNING, () => {
  inWorld({}, (box) => {
    const r = cli(box, ...PLAN, "--justify", "not needed yet");
    assert.equal(r.code, 0, r.stderr);
    assert.equal(all(box.store).length, 0);
  });
});

test("the last reviewed commit is the latest reviewer row whose sha is still an ancestor of HEAD", SPAWNING, () => {
  inWorld({}, (box) => {
    const first = box.sha;
    const record = (sha: string, verifier: string): void => {
      const r = cli(box, "ledger", "record", "bud", sha, "test-verified", "--evidence", "some command output", "--verifier", verifier);
      assert.equal(r.code, 0, r.stderr);
    };
    record(first, "reviewer");
    const second = box.commit();
    record(second, "implementer"); // the pass that wrote the code is not a reviewer
    // A reviewer row for a commit that is not in HEAD's history.
    git(box, "checkout", "-q", "-b", "side");
    const side = box.commit();
    git(box, "checkout", "-q", "-");
    record(side, "reviewer");
    const r = cli(box, ...PLAN);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(line(r.stdout, 3), first);
    assert.equal(line(r.stdout, 2), "last reviewed commit, still an ancestor of HEAD:");
  });
});

test("with no reviewer row it says so on that line", SPAWNING, () => {
  inWorld({}, (box) => {
    const r = cli(box, ...PLAN);
    assert.match(line(r.stdout, 3), /^none: no reviewer row for bud in the ledger is an ancestor of HEAD$/);
  });
});

test("--solo cannot be combined with --worker, --round or another kind, and is for plan only", SPAWNING, () => {
  inWorld({}, (box) => {
    const worker = cli(box, ...PLAN, "--worker", "facts");
    assert.notEqual(worker.code, 0);
    assert.match(worker.stderr, /--solo allocates one lone report, so it takes no --worker/);
    const round = cli(box, ...PLAN, "--round", "2");
    assert.notEqual(round.code, 0);
    assert.match(round.stderr, /--solo works out the round itself, so it takes no --round/);
    const kind = cli(box, "fanout", "plan", "--kind", "impl", "--solo");
    assert.notEqual(kind.code, 0);
    assert.match(kind.stderr, /--solo is for --kind review/);
    const check = cli(box, "fanout", "check", "--kind", "review", "--solo");
    assert.notEqual(check.code, 0);
    assert.match(check.stderr, /--solo is for 'fanout plan'/);
  });
});

test("--justify without --solo is refused", SPAWNING, () => {
  inWorld({}, (box) => {
    const r = cli(box, "fanout", "plan", "--kind", "review", "--worker", "facts", "--justify", "why");
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /--justify belongs to --solo/);
  });
});
