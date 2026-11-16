import { test } from "node:test";
import assert from "node:assert/strict";

import { check, record } from "../src/ledger.ts";
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

test("the strongest verdict at a SHA wins", () => {
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
