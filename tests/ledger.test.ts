import { test } from "node:test";
import assert from "node:assert/strict";

import { check, record } from "../src/ledger.ts";
import { UserError } from "../src/paths.ts";
import { sandbox } from "./helpers.ts";

const OTHER_SHA = "b".repeat(40);

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
    record(sb.store, { target: "storage-layer", sha: sb.sha, verdict: "live-verified", evidence: "ran it", verifier: "reviewer" });
    const result = check(sb.store, "storage-layer", OTHER_SHA);
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
    record(sb.store, { target: "x", sha: sb.sha, verdict: "type-check-only", evidence: "tsc", verifier: "ci" });
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
      record(sb.store, { target: verdict, sha: sb.sha, verdict, evidence: "n/a", verifier: "ci" });
      assert.equal(check(sb.store, verdict, sb.sha, "type-check-only").passing, false, `${verdict} must not pass`);
    }
  } finally {
    sb.dispose();
  }
});

test("the strongest verdict at a SHA wins", () => {
  const sb = sandbox();
  try {
    record(sb.store, { target: "x", sha: sb.sha, verdict: "type-check-only", evidence: "tsc", verifier: "ci" });
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
