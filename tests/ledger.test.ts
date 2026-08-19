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
