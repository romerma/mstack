import { test } from "node:test";
import assert from "node:assert/strict";

import { cli, inWorld, report, SPAWNING, type Box } from "./budget-helpers.ts";
import { recordClosingVerdict } from "./helpers.ts";

/**
 * Item 44, A2: the gate fails a size l item at verifying with no review round of
 * two or more lens reports, and `state set --status done` refuses it. A lens
 * report is a file `mstack fanout plan --kind review --worker <lens>` names. Both
 * seams are the real CLI on a sandbox store; messages are asserted as literals.
 */

const BODY = report(200);
const STUB = "# stub\n";

/** A store at `verifying` with an independent verdict, so only the check under test can fail. */
function at(w: { size?: string; status?: string; reports?: Record<string, string> }, body: (box: Box) => void): void {
  inWorld({ status: w.status ?? "verifying", ...(w.size === undefined ? {} : { size: w.size }), reports: w.reports ?? {} }, (box) => {
    recordClosingVerdict(box, "bud");
    body(box);
  });
}

const reports = (...names: string[]): Record<string, string> => Object.fromEntries(names.map((n) => [n, BODY]));

// ----------------------------------------------------------------- held

test("an l item at verifying with no review report fails the gate, naming the next round's panel", SPAWNING, () => {
  at({ size: "l" }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /\[fail\]  1 bud \(verifying\) is one step from done, and it is size l, and no review round of it has 2 or more lens reports: it has no review report\n/);
    assert.match(gate.stdout, /fix: a size l item closes on a review panel: 'mstack fanout plan --kind review --worker correctness --worker tests' allocates 2 lens reports for round 1; launch one reviewer per path\n/);
  });
});

test("an l item with a lone review only fails, and the fix names round 2", SPAWNING, () => {
  at({ size: "l", reports: reports("review_bud.md") }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /lens reports: round 1 has a lone review\n/);
    assert.match(gate.stdout, /'mstack fanout plan --kind review --round 2 --worker correctness --worker tests' allocates 2 lens reports for round 2; launch one reviewer per path\n/);
  });
});

test("an l item whose round has one lens report fails, naming the lens", SPAWNING, () => {
  at({ size: "l", reports: reports("review_bud_correctness.md") }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /lens reports: round 1 has 1 lens report \(correctness\)\n/);
  });
});

test("one lens report in each of two rounds is not a round of two", SPAWNING, () => {
  at({ size: "l", reports: reports("review_bud_correctness.md", "review_bud_r2-tests.md", "review_bud_r3.md") }, (box) => {
    // The round 3 report has its row, so the review budget says nothing here.
    const row = cli(box, "decide", "--phase", "review-r3", "--item", "bud", "--decision", "a third round", "--why", "w", "--evidence", "e", "--result", "allowed");
    assert.equal(row.code, 0, row.stderr);
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /lens reports: round 1 has 1 lens report \(correctness\); round 2 has 1 lens report \(tests\); round 3 has a lone review\n/);
    // From round 3 the next round needs its decision row as well.
    assert.match(gate.stdout, /--round 4 --worker correctness --worker tests' allocates 2 lens reports for round 4; launch one reviewer per path, and record its review-r4 decision row \('mstack decide --phase review-r4 --item bud \.\.\.'\)\n/);
  });
});

test("a lens report under the stub floor does not count", SPAWNING, () => {
  at({ size: "l", reports: { "review_bud_correctness.md": BODY, "review_bud_tests.md": STUB } }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /lens reports: round 1 has 1 lens report \(correctness\)\n/);
  });
});

test("another item's lens reports are not this item's", SPAWNING, () => {
  at({ size: "l", reports: reports("review_other_correctness.md", "review_other_tests.md", "review_bud-more_correctness.md", "review_bud-more_tests.md") }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /lens reports: it has no review report\n/);
  });
});

// ----------------------------------------------------------------- passes

test("an l item with a round of two lens reports passes the gate and closes", SPAWNING, () => {
  at({ size: "l", reports: reports("review_bud_correctness.md", "review_bud_tests.md") }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 0, gate.stdout + gate.stderr);
    assert.doesNotMatch(gate.stdout, /lens report/);
    const done = cli(box, "state", "set", "bud", "--status", "done");
    assert.equal(done.code, 0, done.stderr);
  });
});

test("a later round with two lens reports passes, after a lone round 1", SPAWNING, () => {
  at({ size: "l", reports: reports("review_bud.md", "review_bud_r2-correctness.md", "review_bud_r2-security.md") }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 0, gate.stdout + gate.stderr);
  });
});

test("two rounds where only the earlier one had two lens reports pass: any round counts", SPAWNING, () => {
  at({ size: "l", reports: reports("review_bud_correctness.md", "review_bud_tests.md", "review_bud_r2.md") }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 0, gate.stdout + gate.stderr);
    const done = cli(box, "state", "set", "bud", "--status", "done");
    assert.equal(done.code, 0, done.stderr);
  });
});

// ----------------------------------------------------------------- not held

test("an m item, an s item and an item with no size are not held, in the same states", SPAWNING, () => {
  for (const size of ["m", "s", undefined]) {
    for (const names of [[], ["review_bud.md"], ["review_bud_correctness.md"]]) {
      at({ ...(size === undefined ? {} : { size }), reports: reports(...names) }, (box) => {
        const gate = cli(box, "gate");
        assert.equal(gate.code, 0, `${size ?? "no size"} ${names.join(",")}: ${gate.stdout}${gate.stderr}`);
        assert.doesNotMatch(gate.stdout, /lens report/);
      });
    }
  }
});

test("an l item before verifying is not reported", SPAWNING, () => {
  for (const status of ["in_progress", "reviewing"]) {
    at({ size: "l", status, reports: reports("review_bud.md") }, (box) => {
      const gate = cli(box, "gate");
      assert.equal(gate.code, 0, `${status}: ${gate.stdout}${gate.stderr}`);
      assert.doesNotMatch(gate.stdout, /lens report/);
    });
  }
});

test("an l item already done on lone reviews still reads as closed", SPAWNING, () => {
  at({ size: "l", status: "done", reports: reports("review_bud.md", "review_bud_r2.md") }, (box) => {
    const gate = cli(box, "gate");
    assert.equal(gate.code, 0, gate.stdout + gate.stderr);
    assert.match(gate.stdout, /\[ok\]    1 closed item\(s\) carry a ledger verdict\n/);
    assert.doesNotMatch(gate.stdout, /lens report/);
  });
});

// ----------------------------------------------------------------- the closing door

test("closing an l item with a lone review is refused, and --force does not close over it", SPAWNING, () => {
  at({ size: "l", reports: reports("review_bud.md") }, (box) => {
    const done = cli(box, "state", "set", "bud", "--status", "done");
    assert.equal(done.code, 2, done.stdout);
    assert.match(done.stderr, /mstack: bud cannot close: it is size l, and no review round of it has 2 or more lens reports: round 1 has a lone review\n/);
    assert.match(done.stderr, /allocates 2 lens reports for round 2/);
    const forced = cli(box, "state", "set", "bud", "--status", "done", "--force", "--closed-by", "one reviewer was enough");
    assert.equal(forced.code, 2, forced.stdout);
    assert.match(forced.stderr, /bud cannot close: it is size l, and no review round of it has 2 or more lens reports/);
    const show = cli(box, "state", "show", "bud");
    assert.match(show.stdout, /^status: verifying$/m);
    assert.doesNotMatch(show.stdout, /closed_by/);
  });
});

test("a forced close from reviewing, past verifying, is refused by the same check", SPAWNING, () => {
  at({ size: "l", status: "reviewing", reports: reports("review_bud.md") }, (box) => {
    const forced = cli(box, "state", "set", "bud", "--status", "done", "--force", "--closed-by", "skip verifying");
    assert.equal(forced.code, 2, forced.stdout);
    assert.match(forced.stderr, /bud cannot close: it is size l, and no review round of it has 2 or more lens reports: round 1 has a lone review\n/);
  });
});
