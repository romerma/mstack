import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluate, type PullRequest } from "../src/mergegate.ts";
import { record } from "../src/ledger.ts";
import { sandbox } from "./helpers.ts";

function pr(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 12,
    state: "OPEN",
    isDraft: false,
    mergeStateStatus: "CLEAN",
    reviewDecision: "APPROVED",
    headRefOid: "a".repeat(40),
    statusCheckRollup: [{ name: "Backend", status: "COMPLETED", conclusion: "SUCCESS" }],
    ...overrides,
  };
}

test("a clean, green, approved PR is GO", () => {
  assert.equal(evaluate(pr()).decision, "GO");
});

test("UNSTABLE is not green", () => {
  const verdict = evaluate(pr({ mergeStateStatus: "UNSTABLE" }));
  assert.equal(verdict.decision, "STOP");
  assert.ok(verdict.reasons.some((r) => r.includes("UNSTABLE")));
});

test("BLOCKED and DIRTY stop too", () => {
  for (const status of ["BLOCKED", "DIRTY", "UNKNOWN"]) {
    assert.equal(evaluate(pr({ mergeStateStatus: status })).decision, "STOP", status);
  }
});

test("a completed failure stops, including an infrastructure one", () => {
  const verdict = evaluate(
    pr({ statusCheckRollup: [{ name: "Deploy Production", status: "COMPLETED", conclusion: "FAILURE" }] }),
  );
  assert.equal(verdict.decision, "STOP");
  assert.ok(verdict.reasons.some((r) => r.includes("Deploy Production")));
});

test("a job that never started is not a failure", () => {
  const verdict = evaluate(
    pr({
      statusCheckRollup: [
        { name: "Backend", status: "COMPLETED", conclusion: "SUCCESS" },
        { name: "Integration Tests", status: "COMPLETED", conclusion: "SKIPPED" },
      ],
    }),
  );
  assert.equal(verdict.decision, "GO");
  assert.ok(verdict.reasons.some((r) => r.includes("never started is not a failure")));
});

test("checks still running are a WAIT, not a STOP", () => {
  const verdict = evaluate(
    pr({ statusCheckRollup: [{ name: "Frontend", status: "IN_PROGRESS", conclusion: undefined }] }),
  );
  assert.equal(verdict.decision, "WAIT");
});

test("a failure outranks a pending check", () => {
  const verdict = evaluate(
    pr({
      statusCheckRollup: [
        { name: "A", status: "IN_PROGRESS" },
        { name: "B", status: "COMPLETED", conclusion: "FAILURE" },
      ],
    }),
  );
  assert.equal(verdict.decision, "STOP");
});

test("drafts, closed PRs, and requested changes all stop", () => {
  assert.equal(evaluate(pr({ isDraft: true })).decision, "STOP");
  assert.equal(evaluate(pr({ state: "MERGED" })).decision, "STOP");
  assert.equal(evaluate(pr({ reviewDecision: "CHANGES_REQUESTED" })).decision, "STOP");
});

test("a StatusContext-shaped check is read through .state", () => {
  assert.equal(evaluate(pr({ statusCheckRollup: [{ context: "ci", state: "FAILURE" } as never] })).decision, "STOP");
  assert.equal(evaluate(pr({ statusCheckRollup: [{ context: "ci", state: "SUCCESS" } as never] })).decision, "GO");
});

test("green is not safe: with no verdict at this head SHA the gate stops", () => {
  const sb = sandbox();
  try {
    const verdict = evaluate(pr(), { ledger: { store: sb.store, target: "storage-layer" } });
    assert.equal(verdict.decision, "STOP");
    assert.ok(verdict.reasons.some((r) => r.startsWith("ledger:")));
  } finally {
    sb.dispose();
  }
});

test("a verdict recorded against an older SHA does not carry over", () => {
  const sb = sandbox();
  try {
    record(sb.store, { target: "storage-layer", sha: "b".repeat(40), verdict: "live-verified", evidence: "drove it", verifier: "reviewer" });
    const verdict = evaluate(pr(), { ledger: { store: sb.store, target: "storage-layer" } });
    assert.equal(verdict.decision, "STOP", "a restack rewrites SHAs and silently invalidates verdicts");
    assert.ok(verdict.reasons.some((r) => r.includes("voids")));
  } finally {
    sb.dispose();
  }
});

test("a verdict at this head SHA clears the gate", () => {
  const sb = sandbox();
  try {
    record(sb.store, { target: "storage-layer", sha: "a".repeat(40), verdict: "test-verified", evidence: "node --test", verifier: "reviewer" });
    assert.equal(evaluate(pr(), { ledger: { store: sb.store, target: "storage-layer" } }).decision, "GO");
  } finally {
    sb.dispose();
  }
});

test("every reason is reported, not just the first", () => {
  const verdict = evaluate(
    pr({
      isDraft: true,
      mergeStateStatus: "BLOCKED",
      statusCheckRollup: [{ name: "A", status: "COMPLETED", conclusion: "FAILURE" }],
    }),
  );
  assert.ok(verdict.reasons.length >= 3, `expected several reasons, got ${JSON.stringify(verdict.reasons)}`);
});
