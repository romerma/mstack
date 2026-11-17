import { test } from "node:test";
import assert from "node:assert/strict";

import { appendFileSync } from "node:fs";

import { check, entries, record } from "../src/ledger.ts";
import { UserError } from "../src/paths.ts";
import { sandbox } from "./helpers.ts";


test("a verdict at the head SHA passes", () => {
  const sb = sandbox();
  try {
    record(sb.store, { target: "storage-layer", sha: sb.sha, verdict: "test-verified", evidence: "node --test", verifier: "reviewer" });
    const result = check(sb.store, "storage-layer", sb.sha);
    assert.equal(result.passing, true);
    assert.match(result.reason, /test-verified/);
  } finally {
    sb.dispose();
  }
});

test("a new head SHA voids the row, and says so", () => {
  const sb = sandbox();
  try {
    record(sb.store, { target: "storage-layer", sha: sb.sha, verdict: "live-verified", evidence: "drove it in the browser", verifier: "reviewer" });
    const result = check(sb.store, "storage-layer", sb.commit());
    assert.equal(result.passing, false);
    assert.equal(result.stale.length, 1, "the older row must be reported as stale, not ignored");
    assert.match(result.reason, /voids/);
  } finally {
    sb.dispose();
  }
});

test("type-check-only does not clear behavioural work", () => {
  const sb = sandbox();
  try {
    record(sb.store, { target: "x", sha: sb.sha, verdict: "type-check-only", evidence: "tsc --noEmit clean", verifier: "ci" });
    assert.equal(check(sb.store, "x", sb.sha, "test-verified").passing, false);
    assert.equal(check(sb.store, "x", sb.sha, "type-check-only").passing, true);
  } finally {
    sb.dispose();
  }
});

test("a blocked or failed verifier clears nothing", () => {
  const sb = sandbox();
  try {
    for (const verdict of ["verifier-blocked", "verifier-failed"] as const) {
      record(sb.store, { target: verdict, sha: sb.sha, verdict, evidence: "the harness could not run here", verifier: "ci" });
      assert.equal(check(sb.store, verdict, sb.sha, "type-check-only").passing, false, `${verdict} must not pass`);
    }
  } finally {
    sb.dispose();
  }
});

test("with no closing-role row, the strongest author row at a SHA is the answer", () => {
  const sb = sandbox();
  try {
    record(sb.store, { target: "x", sha: sb.sha, verdict: "type-check-only", evidence: "tsc --noEmit clean", verifier: "ci" });
    record(sb.store, { target: "x", sha: sb.sha, verdict: "live-verified", evidence: "drove the UI", verifier: "reviewer" });
    assert.equal(check(sb.store, "x", sb.sha).best?.verdict, "live-verified");
  } finally {
    sb.dispose();
  }
});

test("a row without evidence is refused", () => {
  const sb = sandbox();
  try {
    assert.throws(
      () => record(sb.store, { target: "x", sha: sb.sha, verdict: "test-verified", evidence: "  ", verifier: "ci" }),
      UserError,
    );
    assert.throws(
      () => record(sb.store, { target: "x", sha: "", verdict: "test-verified", evidence: "e", verifier: "ci" }),
      UserError,
    );
  } finally {
    sb.dispose();
  }
});

test("no verdict at all reads differently from a stale one", () => {
  const sb = sandbox();
  try {
    assert.match(check(sb.store, "never-seen", sb.sha).reason, /no verdict recorded/);
  } finally {
    sb.dispose();
  }
});

test("a SHA that is not a commit here is refused, because it is half the key", () => {
  const sb = sandbox();
  try {
    // Forty zeros recorded fine and read back indistinguishable from a real
    // commit, so a verdict could name a state of the repository that never was.
    assert.throws(
      () =>
        record(sb.store, {
          target: "x",
          sha: "0".repeat(40),
          verdict: "live-verified",
          evidence: "drove it in the browser",
          verifier: "reviewer",
        }),
      (error: unknown) => error instanceof UserError && /is not a commit in this repository/.test((error as Error).message),
    );
    assert.equal(check(sb.store, "x", sb.sha).best, undefined, "nothing may have been written");
  } finally {
    sb.dispose();
  }
});

test("evidence has a floor, because one character is not evidence", () => {
  const sb = sandbox();
  try {
    for (const evidence of ["", " ", "x", "ok", "n/a"]) {
      assert.throws(
        () => record(sb.store, { target: "x", sha: sb.sha, verdict: "test-verified", evidence, verifier: "reviewer" }),
        (error: unknown) => error instanceof UserError,
        `accepted ${JSON.stringify(evidence)} as evidence`,
      );
    }
    // Short but real: a command a reviewer can re-run.
    record(sb.store, { target: "x", sha: sb.sha, verdict: "test-verified", evidence: "npm test -s", verifier: "reviewer" });
    assert.equal(check(sb.store, "x", sb.sha).passing, true);
  } finally {
    sb.dispose();
  }
});

// ---- item 47: a rejection must not hide behind the author's own row -----------------
//
// `check` used to keep the best-ranked row at a sha, so an implementer's
// `test-verified` outranked the reviewer's `verifier-failed` recorded after it.
// The cases below are the whole table; each row names who recorded what, in
// file order, and what `check` must say.

type Row = [verdict: Parameters<typeof record>[1]["verdict"], verifier: string, evidence?: string];

function checkAfter(rows: Row[], min?: Parameters<typeof check>[3]) {
  const sb = sandbox();
  try {
    for (const [verdict, verifier, evidence] of rows) {
      record(sb.store, { target: "x", sha: sb.sha, verdict, evidence: evidence ?? "node --test tests", verifier });
    }
    return check(sb.store, "x", sb.sha, min);
  } finally {
    sb.dispose();
  }
}

test("the benchmark-harness case: implementer test-verified, then reviewer verifier-failed, fails and names the rejection", () => {
  const r = checkAfter([
    ["test-verified", "implementer"],
    ["verifier-failed", "reviewer", ".mstack/progress/review_x.md"],
  ]);
  assert.equal(r.passing, false);
  assert.equal(r.best?.verdict, "verifier-failed");
  assert.equal(r.best?.verifier, "reviewer");
  assert.match(r.reason, /verifier-failed/);
  assert.match(r.reason, /reviewer/);
  assert.match(r.reason, /review_x\.md/);
  // The wording is the message a person reads when a merge is blocked: it must say
  // the rejection stands whatever an implementing role recorded.
  assert.match(r.reason, /rejects this commit, whatever an implementing role recorded/);
});

test("a failing author-only check still says the verdict is the author's own", () => {
  const r = checkAfter([["type-check-only", "implementer"]]);
  assert.equal(r.passing, false);
  assert.match(r.reason, /does not clear test-verified \(the author's own verdict\)/);
});

test("a rejection recorded before the implementer's next row still wins over it", () => {
  const r = checkAfter([
    ["verifier-failed", "reviewer", ".mstack/progress/review_x.md"],
    ["test-verified", "implementer"],
  ]);
  assert.equal(r.passing, false);
  assert.match(r.reason, /verifier-failed.*reviewer/);
});

test("a later approval from a closing role supersedes an earlier rejection", () => {
  const r = checkAfter([
    ["verifier-failed", "reviewer", ".mstack/progress/review_x.md"],
    ["test-verified", "reviewer", ".mstack/progress/review_x_r2.md"],
  ]);
  assert.equal(r.passing, true);
  assert.equal(r.reason, `test-verified at ${r.best?.sha.slice(0, 8)} by reviewer`);
});

test("a later rejection retracts an earlier approval from a closing role", () => {
  const r = checkAfter([
    ["test-verified", "reviewer", ".mstack/progress/review_x.md"],
    ["verifier-failed", "reviewer", ".mstack/progress/review_x_r2.md"],
  ]);
  assert.equal(r.passing, false);
  assert.match(r.reason, /review_x_r2\.md/);
});

test("the latest closing row is the answer, not the best one: a weaker later approval replaces a stronger earlier one", () => {
  const r = checkAfter([
    ["live-verified", "reviewer", ".mstack/progress/review_x.md"],
    ["type-check-only", "reviewer", ".mstack/progress/review_x_r2.md"],
  ]);
  assert.equal(r.best?.verdict, "type-check-only");
  assert.equal(r.passing, false, "type-check-only does not clear the default test-verified");
});

test("a reviewer verifier-blocked row fails the check and is named", () => {
  const r = checkAfter([
    ["test-verified", "implementer"],
    ["verifier-blocked", "reviewer", ".mstack/progress/review_x.md"],
  ]);
  assert.equal(r.passing, false);
  assert.match(r.reason, /verifier-blocked.*reviewer/);
  assert.match(r.reason, /review_x\.md/, "names the evidence, like a failed row");
  // Rank 0 would clear `--min verifier-blocked`; a rejection must not.
  const floor = checkAfter(
    [
      ["test-verified", "implementer"],
      ["verifier-blocked", "reviewer", ".mstack/progress/review_x.md"],
    ],
    "verifier-blocked",
  );
  assert.equal(floor.passing, false);
});

test("with only an implementer row the verdict stays, labelled as the author's own", () => {
  const r = checkAfter([["test-verified", "implementer"]]);
  assert.equal(r.passing, true);
  assert.match(r.reason, /^test-verified at [0-9a-f]{8} by implementer/);
  assert.match(r.reason, /author's own/);
});

test("an implementer then reviewer approval passes and names the reviewer, without the author's-own label", () => {
  const r = checkAfter([
    ["test-verified", "implementer"],
    ["test-verified", "reviewer", ".mstack/progress/review_x.md"],
  ]);
  assert.equal(r.passing, true);
  assert.equal(r.best?.verifier, "reviewer");
  assert.doesNotMatch(r.reason, /author's own/);
});

test("an empty verifier is not a closing role, so its row is only the labelled author's own verdict", () => {
  // canCloseAnItem("") is false, the same floor the gate applies: unnamed is not independent.
  const r = checkAfter([["test-verified", ""]]);
  assert.equal(r.passing, true);
  assert.match(r.reason, /author's own/);
});

test("an unknown verifier name can close, so its rejection counts", () => {
  const r = checkAfter([
    ["test-verified", "implementer"],
    ["verifier-failed", "ci-bot", "https://ci.example/run/1"],
  ]);
  assert.equal(r.passing, false);
  assert.match(r.reason, /verifier-failed.*ci-bot/);
});

test("--min applies to the closing row: live-verified against a test-verified approval fails", () => {
  const r = checkAfter(
    [
      ["live-verified", "implementer"],
      ["test-verified", "reviewer", ".mstack/progress/review_x.md"],
    ],
    "live-verified",
  );
  assert.equal(r.passing, false);
  assert.match(r.reason, /test-verified/);
  assert.match(r.reason, /live-verified/);
});

test("a closing row that cites the implementer's own report is not a closing row, as in the gate", () => {
  const r = checkAfter([
    ["verifier-failed", "reviewer", ".mstack/progress/review_x.md"],
    ["test-verified", "reviewer", ".mstack/progress/impl_x.md"],
  ]);
  // The forged approval is dropped, so the rejection is still the latest closing row.
  assert.equal(r.passing, false);
  assert.match(r.reason, /verifier-failed.*reviewer/);
});

test("rows at another sha only keep the unchanged stale message", () => {
  const sb = sandbox();
  try {
    record(sb.store, { target: "x", sha: sb.sha, verdict: "verifier-failed", evidence: "review_x.md here", verifier: "reviewer" });
    const r = check(sb.store, "x", sb.commit());
    assert.equal(r.passing, false);
    assert.match(r.reason, /^no verdict at [0-9a-f]{8}; 1 row\(s\) exist at other SHAs and a new head SHA voids them$/);
  } finally {
    sb.dispose();
  }
});

test("an empty ledger keeps the unchanged message", () => {
  const sb = sandbox();
  try {
    assert.equal(check(sb.store, "x", sb.sha).reason, "no verdict recorded for x");
  } finally {
    sb.dispose();
  }
});

// ---- item 47, round 2: a rejection is a rejection whatever it cites -------------------
//
// The gate drops closing-role rows that cite an implementing role's own report
// because such a row is the author's report under a reviewer's name. That is
// right for an approval. For a rejection it can only hide a failure, so a
// rejection counts however its evidence reads.

test("a reviewer rejection that cites the implementer's report next to its own still fails and is named", () => {
  const r = checkAfter([
    ["test-verified", "implementer"],
    ["verifier-failed", "reviewer", ".mstack/progress/review_x.md; the claims in .mstack/progress/impl_x.md do not hold"],
  ]);
  assert.equal(r.passing, false);
  assert.match(r.reason, /verifier-failed.*reviewer/);
  assert.match(r.reason, /review_x\.md/);
  assert.match(r.reason, /rejects this commit/, "answered as a rejection, not as a discounted row");
});

test("a rejection citing the implementer's report retracts an earlier genuine approval", () => {
  const r = checkAfter([
    ["test-verified", "reviewer", ".mstack/progress/review_x.md"],
    ["verifier-failed", "reviewer", ".mstack/progress/review_x_r2.md; impl_x.md overclaims"],
  ]);
  assert.equal(r.passing, false);
  assert.match(r.reason, /rejects this commit/);
});

test("a reviewer rejection whose only evidence is the implementer's report still fails", () => {
  const r = checkAfter([
    ["test-verified", "implementer"],
    ["verifier-failed", "reviewer", ".mstack/progress/impl_x.md"],
  ]);
  assert.equal(r.passing, false);
  assert.match(r.reason, /verifier-failed.*reviewer rejects this commit/);
});

test("a verifier-blocked row that cites the implementer's report still fails, as not independent", () => {
  const r = checkAfter([
    ["test-verified", "implementer"],
    ["verifier-blocked", "reviewer", ".mstack/progress/impl_x.md"],
  ]);
  assert.equal(r.passing, false);
  assert.match(r.reason, /verifier-blocked.*reviewer cites the implementer's own report/);
  assert.match(r.reason, /not an independent approval/);
});

test("an approval that cites the implementer's report is not presented as an independent pass", () => {
  // The gate refuses to close on this ledger (every closing row cites the report),
  // so `check` fails and says why instead of printing an independent PASS.
  const r = checkAfter([
    ["test-verified", "implementer"],
    ["test-verified", "reviewer", ".mstack/progress/impl_x.md"],
  ]);
  assert.equal(r.passing, false);
  assert.match(r.reason, /test-verified.*reviewer/);
  assert.match(r.reason, /implementer's own report/);
  assert.match(r.reason, /impl_x\.md/);
});

test("an approval citing the implementer's report does not count when a genuine approval exists", () => {
  const r = checkAfter([
    ["test-verified", "reviewer", ".mstack/progress/review_x.md"],
    ["live-verified", "reviewer", ".mstack/progress/impl_x.md"],
  ]);
  assert.equal(r.passing, true);
  assert.equal(r.best?.verdict, "test-verified", "the discounted row is not the answer");
});

// ---- item 47, round 2: a slug with regex metacharacters is a literal --------------------
//
// `ledger record` and `ledger check` take a free-text target, and the citation
// check builds a pattern from it. `api(v2` crashed the command with "Invalid
// regular expression" where it used to print an answer.

function checkTarget(target: string, rows: Array<[Row[0], string, string]>) {
  const sb = sandbox();
  try {
    for (const [verdict, verifier, evidence] of rows) {
      record(sb.store, { target, sha: sb.sha, verdict, evidence, verifier });
    }
    return check(sb.store, target, sb.sha);
  } finally {
    sb.dispose();
  }
}

for (const target of ["api(v2", "a.b", "x[1]", "a+b"]) {
  test(`a target with regex metacharacters (${target}) gets an ordinary answer`, () => {
    const r = checkTarget(target, [["test-verified", "reviewer", `.mstack/progress/review_${target}.md`]]);
    assert.equal(r.passing, true);
    assert.equal(r.reason, `test-verified at ${r.best?.sha.slice(0, 8)} by reviewer`);
  });

  test(`an approval citing impl_${target}.md is still recognised as the implementer's report`, () => {
    const r = checkTarget(target, [["test-verified", "reviewer", `.mstack/progress/impl_${target}.md`]]);
    assert.equal(r.passing, false);
    assert.match(r.reason, /implementer's own report/);
  });
}

test("a dot in the target is not a wildcard: impl_axb.md is not the report for a.b", () => {
  const r = checkTarget("a.b", [["test-verified", "reviewer", ".mstack/progress/impl_axb.md"]]);
  assert.equal(r.passing, true, "a report for another item does not discount the row");
  assert.equal(r.best?.verifier, "reviewer");
});

// ---- item 70: shas, targets, and naming the role whose report is cited -----------------

test("an abbreviated sha is resolved to the full commit by ledger check", () => {
  const sb = sandbox();
  try {
    record(sb.store, { target: "x", sha: sb.sha, verdict: "test-verified", evidence: "node --test tests", verifier: "reviewer" });
    for (const length of [7, 8, 12]) {
      const r = check(sb.store, "x", sb.sha.slice(0, length));
      assert.equal(r.passing, true, `${length} chars: ${r.reason}`);
      assert.equal(r.best?.verdict, "test-verified");
    }
  } finally {
    sb.dispose();
  }
});

test("an abbreviated sha given to ledger record is stored as the full sha", () => {
  const sb = sandbox();
  try {
    const entry = record(sb.store, { target: "x", sha: sb.sha.slice(0, 7), verdict: "test-verified", evidence: "node --test tests", verifier: "reviewer" });
    assert.equal(entry.sha, sb.sha);
    assert.equal(check(sb.store, "x", sb.sha).passing, true);
  } finally {
    sb.dispose();
  }
});

test("an abbreviation that is no commit here is refused by record and finds nothing in check", () => {
  const sb = sandbox();
  try {
    assert.throws(
      () => record(sb.store, { target: "x", sha: "deadbee", verdict: "test-verified", evidence: "node --test tests", verifier: "reviewer" }),
      (error: unknown) => error instanceof UserError && /is not a commit in this repository/.test((error as Error).message),
    );
    assert.equal(check(sb.store, "x", "deadbee").passing, false);
  } finally {
    sb.dispose();
  }
});

test("a row recorded with a short sha before sha resolution existed is still found at its full sha", () => {
  const sb = sandbox();
  try {
    // The ledger is append-only, so one row in this repository carries 7 characters.
    appendFileSync(sb.store.ledger, `x\t${sb.sha.slice(0, 7)}\ttest-verified\tnode --test tests\treviewer\t2026-01-01T00:00:00.000Z\n`);
    const r = check(sb.store, "x", sb.sha);
    assert.equal(r.passing, true, r.reason);
    assert.equal(r.stale.length, 0, "the short row is the same commit, not a stale one");
  } finally {
    sb.dispose();
  }
});

test("ledger record refuses an empty or blank target", () => {
  const sb = sandbox();
  try {
    for (const target of ["", "   "]) {
      assert.throws(
        () => record(sb.store, { target, sha: sb.sha, verdict: "test-verified", evidence: "node --test tests", verifier: "reviewer" }),
        (error: unknown) => error instanceof UserError && /needs a target/.test((error as Error).message),
        `accepted ${JSON.stringify(target)}`,
      );
    }
    assert.equal(entries(sb.store).length, 0, "nothing may have been written");
  } finally {
    sb.dispose();
  }
});

test("an approval that cites a spec-author's report names the spec-author, not the implementer", () => {
  const r = checkAfter([["test-verified", "reviewer", ".mstack/progress/spec_x.md"]]);
  assert.equal(r.passing, false);
  assert.match(r.reason, /spec-author's own report/);
  assert.doesNotMatch(r.reason, /implementer's own report/);
});

test("a verifier-blocked after a verifier-failed fails the check, naming the failure and saying the blocked row does not answer it", () => {
  const r = checkAfter([
    ["verifier-failed", "reviewer", ".mstack/progress/review_x_r2.md"],
    ["verifier-blocked", "orchestrator", "could not re-run the suite"],
  ]);
  assert.equal(r.passing, false);
  assert.equal(r.kind, "rejected");
  assert.equal(r.best?.verdict, "verifier-failed");
  assert.match(r.reason, /^verifier-failed at \w{8} by reviewer rejects this commit/);
  assert.match(r.reason, /review_x_r2\.md/);
  assert.match(r.reason, /the later verifier-blocked by orchestrator \(evidence: could not re-run the suite\) does not answer it/);
});

// ---- item 70 round 2: a verifier-blocked row is discounted for citing the author's report, a verifier-failed is not ----

test("a lone verifier-blocked row citing the implementer's report is not independent, and check says so", () => {
  const r = checkAfter([["verifier-blocked", "reviewer", ".mstack/progress/impl_x.md"]]);
  assert.equal(r.passing, false);
  assert.equal(r.kind, "discounted");
  assert.match(r.reason, /verifier-blocked at \w{8} by reviewer cites the implementer's own report/);
  assert.match(r.reason, /not an independent approval/);
});

test("a genuine approval then a verifier-blocked citing the implementer's report: the approval is the answer", () => {
  const r = checkAfter([
    ["test-verified", "reviewer", ".mstack/progress/review_x.md"],
    ["verifier-blocked", "reviewer", ".mstack/progress/impl_x.md"],
  ]);
  assert.equal(r.passing, true, r.reason);
  assert.equal(r.kind, "approved");
  assert.match(r.reason, /test-verified/);
});

test("a rejection then a verifier-blocked citing the implementer's report: the rejection stands and the blocked row is not named as an answer attempt", () => {
  const r = checkAfter([
    ["verifier-failed", "reviewer", ".mstack/progress/review_x.md"],
    ["verifier-blocked", "reviewer", ".mstack/progress/impl_x.md"],
  ]);
  assert.equal(r.passing, false);
  assert.equal(r.kind, "rejected");
  assert.match(r.reason, /verifier-failed at \w{8} by reviewer rejects this commit/);
});

test("a lone genuine verifier-blocked row still reads as blocked", () => {
  const r = checkAfter([["verifier-blocked", "reviewer", "no harness in this repo"]]);
  assert.equal(r.passing, false);
  assert.equal(r.kind, "blocked");
});
