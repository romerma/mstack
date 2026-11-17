import { test } from "node:test";
import assert from "node:assert/strict";

import { check, readVerdict, record, type Entry, type VerdictKind } from "../src/ledger.ts";
import { runGate } from "../src/gate.ts";
import { captured, item, sandbox, state } from "./helpers.ts";

/**
 * Item 70: ONE function reads the verdict at a sha, and `ledger check` and the
 * gate's closing audit both call it. The table below is the whole contract: each
 * row is a sequence in file order and the kind the reader must give it. The
 * second test then feeds the same sequences to the real `check` and the real
 * gate and asserts they cannot disagree about the rows that matter.
 */

type Row = [verdict: Entry["verdict"], verifier: string, evidence?: string];

const SLUG = "storage-layer";
const IMPL = ".mstack/progress/impl_storage-layer.md";
const SPEC = ".mstack/progress/spec_storage-layer.md";

interface Case {
  name: string;
  rows: Row[];
  kind: VerdictKind;
  /** The deciding row, as `verdict by verifier`. */
  row: string;
  /** What `ledger check` does with the kind. */
  check: "pass" | "fail";
  /** What the gate does with an item closed over these rows. */
  gate: "pass" | "fail";
}

const CASES: Case[] = [
  { name: "author only", rows: [["test-verified", "implementer"]], kind: "author-only", row: "test-verified by implementer", check: "pass", gate: "fail" },
  { name: "author then reviewer approval", rows: [["test-verified", "implementer"], ["test-verified", "reviewer"]], kind: "approved", row: "test-verified by reviewer", check: "pass", gate: "pass" },
  { name: "author then reviewer rejection", rows: [["test-verified", "implementer"], ["verifier-failed", "reviewer"]], kind: "rejected", row: "verifier-failed by reviewer", check: "fail", gate: "fail" },
  { name: "rejection then the author reports again", rows: [["verifier-failed", "reviewer"], ["test-verified", "implementer"]], kind: "rejected", row: "verifier-failed by reviewer", check: "fail", gate: "fail" },
  { name: "rejection then independent approval", rows: [["verifier-failed", "reviewer"], ["test-verified", "reviewer"]], kind: "approved", row: "test-verified by reviewer", check: "pass", gate: "pass" },
  { name: "approval then rejection", rows: [["test-verified", "reviewer"], ["verifier-failed", "reviewer"]], kind: "rejected", row: "verifier-failed by reviewer", check: "fail", gate: "fail" },
  { name: "the reproduced case: approval then a rejection citing the implementer's report", rows: [["test-verified", "implementer", IMPL], ["test-verified", "reviewer", "review_demo.md"], ["verifier-failed", "reviewer", `.mstack/progress/review_demo_r2.md; the claims in ${IMPL} do not hold`]], kind: "rejected", row: "verifier-failed by reviewer", check: "fail", gate: "fail" },
  { name: "an approval citing the implementer's report is discounted", rows: [["test-verified", "implementer"], ["test-verified", "reviewer", IMPL]], kind: "discounted", row: "test-verified by reviewer", check: "fail", gate: "fail" },
  { name: "an approval citing the spec-author's report is discounted", rows: [["test-verified", "reviewer", SPEC]], kind: "discounted", row: "test-verified by reviewer", check: "fail", gate: "fail" },
  { name: "a discounted approval does not answer a rejection", rows: [["verifier-failed", "reviewer"], ["test-verified", "reviewer", IMPL]], kind: "rejected", row: "verifier-failed by reviewer", check: "fail", gate: "fail" },
  { name: "a lone blocked row", rows: [["verifier-blocked", "reviewer"]], kind: "blocked", row: "verifier-blocked by reviewer", check: "fail", gate: "pass" },
  { name: "approval then blocked", rows: [["test-verified", "reviewer"], ["verifier-blocked", "reviewer"]], kind: "blocked", row: "verifier-blocked by reviewer", check: "fail", gate: "pass" },
  { name: "blocked after failed does not answer it", rows: [["verifier-failed", "reviewer"], ["verifier-blocked", "reviewer"]], kind: "rejected", row: "verifier-failed by reviewer", check: "fail", gate: "fail" },
  { name: "failed after blocked", rows: [["verifier-blocked", "reviewer"], ["verifier-failed", "reviewer"]], kind: "rejected", row: "verifier-failed by reviewer", check: "fail", gate: "fail" },
  { name: "approval, failed, blocked", rows: [["test-verified", "reviewer"], ["verifier-failed", "reviewer"], ["verifier-blocked", "reviewer"]], kind: "rejected", row: "verifier-failed by reviewer", check: "fail", gate: "fail" },
  { name: "failed, blocked, then an independent approval", rows: [["verifier-failed", "reviewer"], ["verifier-blocked", "reviewer"], ["test-verified", "reviewer"]], kind: "approved", row: "test-verified by reviewer", check: "pass", gate: "pass" },
  { name: "failed by one closing role, blocked by another", rows: [["verifier-failed", "reviewer"], ["verifier-blocked", "orchestrator"]], kind: "rejected", row: "verifier-failed by reviewer", check: "fail", gate: "fail" },
];

function entries(rows: Row[], sha = "a".repeat(40)): Entry[] {
  return rows.map(([verdict, verifier, evidence]) => ({
    target: SLUG,
    sha,
    verdict,
    evidence: evidence ?? "node --test tests",
    verifier,
    ts: "2026-01-01T00:00:00.000Z",
  }));
}

for (const c of CASES) {
  test(`readVerdict: ${c.name} is ${c.kind}`, () => {
    const reading = readVerdict(entries(c.rows), SLUG);
    assert.ok(reading !== undefined);
    assert.equal(reading.kind, c.kind);
    assert.equal(`${reading.row.verdict} by ${reading.row.verifier}`, c.row);
  });
}

test("readVerdict names the role whose report a discounted approval cites", () => {
  const impl = readVerdict(entries([["test-verified", "reviewer", IMPL]]), SLUG);
  assert.deepEqual(impl?.discounted.map((d) => d.role), ["implementer"]);
  const spec = readVerdict(entries([["test-verified", "reviewer", SPEC]]), SLUG);
  assert.deepEqual(spec?.discounted.map((d) => d.role), ["spec-author"]);
});

test("readVerdict of no rows is undefined, and a target with regex metacharacters is read literally", () => {
  assert.equal(readVerdict([], SLUG), undefined);
  const rows = entries([["test-verified", "reviewer", ".mstack/progress/impl_axb.md"]]);
  assert.equal(readVerdict(rows, "a.b")?.kind, "approved", "impl_axb.md is not the report for a.b");
});

test("ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict", { timeout: 60_000 }, () => {
  for (const c of CASES) {
    const sb = sandbox();
    try {
      sb.writeState(state([item({ status: "done" })]));
      for (const [verdict, verifier, evidence] of c.rows) {
        record(sb.store, { target: SLUG, sha: sb.sha, verdict, evidence: evidence ?? "node --test tests", verifier });
      }
      const checked = check(sb.store, SLUG, sb.sha);
      const { value: report } = captured(() => runGate(sb.store, { quiet: true }));
      const audited = report.failed;
      assert.equal(checked.passing ? "pass" : "fail", c.check, `${c.name}: ledger check, ${checked.reason}`);
      assert.equal(audited ? "fail" : "pass", c.gate, `${c.name}: gate, ${JSON.stringify(report.failures)}`);
      // The rows both commands refuse for a rejection must be refused by both.
      if (c.kind === "rejected" || c.kind === "discounted" || c.kind === "author-only") {
        assert.equal(checked.kind, c.kind, `${c.name}: check reports the reader's kind`);
        if (c.kind !== "author-only") assert.equal(checked.passing, false);
        assert.equal(audited, true, `${c.name}: the gate must refuse what check refuses`);
      }
      assert.equal(checked.kind, c.kind, `${c.name}: kind on the check result`);
    } finally {
      sb.dispose();
    }
  }
});
