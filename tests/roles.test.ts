import { test } from "node:test";
import assert from "node:assert/strict";

import { citesImplementingReport, roundOf } from "../src/roles.ts";

/**
 * The boundary table for the citation contract, pinned case by case.
 *
 * The gate tests exercise the predicate end to end; this table pins the exact
 * boundary decisions so a regex edit that shifts one of them fails here with
 * the offending string named, not in a sandboxed gate run three layers up.
 */
test("a citation is the exact report filename as a whole token", () => {
  const slug = "storage-layer";
  const cites: ReadonlyArray<readonly [string, string]> = [
    // The plain forms.
    ["impl_storage-layer.md", "implementer"],
    [".mstack/progress/impl_storage-layer.md", "implementer"],
    // Trailing prose after the filename is the ledger's established style.
    [".mstack/progress/impl_storage-layer.md round-2 section", "implementer"],
    ["impl_storage-layer.md - shipped bin/mstack driven as a process", "implementer"],
    // Punctuation around the token still cites: quotes, brackets, `=`, `(`.
    ['".mstack/progress/impl_storage-layer.md"', "implementer"],
    ["[impl_storage-layer.md]", "implementer"],
    ["=impl_storage-layer.md", "implementer"],
    ["(impl_storage-layer.md)", "implementer"],
    // `.md` terminates the filename contract, so a trailing hyphen — or any
    // other non-word character — is punctuation, not a longer filename.
    ["impl_storage-layer.md-round-2", "implementer"],
    ["impl_storage-layer.md.", "implementer"],
    ["impl_storage-layer.md#tests", "implementer"],
    // The fan-out family reportFiles admits, including the empty suffix.
    ["impl_storage-layer_round2.md", "implementer"],
    ["impl_storage-layer_.md", "implementer"],
    // The spec-author's report is an implementing role's report too.
    ["spec_storage-layer.md", "spec-author"],
    [".mstack/progress/spec_storage-layer.md", "spec-author"],
    // A string citing both kinds resolves to the implementer — the set's
    // first entry — regardless of which filename appears first.
    ["spec_storage-layer.md impl_storage-layer.md", "implementer"],
    // Case does not launder a citation: kind and slug are lowercase by
    // contract, and on a case-insensitive filesystem the upper-cased string
    // resolves to the very same file.
    ["IMPL_STORAGE-LAYER.MD", "implementer"],
    [".mstack/progress/Impl_Storage-Layer.mD", "implementer"],
    // Nor do zero-width format characters, which render as nothing in every
    // viewer the ledger targets.
    ["impl_storage-layer\u200B.md", "implementer"],
    ["\uFEFFimpl_storage\u200D-layer.md", "implementer"],
  ];
  const doesNot: string[] = [
    // A leading letter, digit, hyphen or underscore glues into a different
    // filename.
    "re-impl_storage-layer.md",
    "ximpl_storage-layer.md",
    // A different extension is a different file.
    "impl_storage-layer.mdx",
    // Another item's report is out of this item's audit.
    "impl_other-item.md",
    // A hyphenated slug continuation is a different slug's report.
    "impl_storage-layer-extra.md",
    // The requirements file a reviewer legitimately cites.
    ".mstack/specs/storage-layer/spec.md",
    // The closing pass's own report.
    ".mstack/progress/review_storage-layer.md",
    // Free prose that never names the file is the stated residual.
    "read the implementer's report, all good",
  ];
  for (const [evidence, role] of cites) {
    assert.equal(citesImplementingReport(evidence, slug), role, `should cite ${role}: ${evidence}`);
  }
  for (const evidence of doesNot) {
    assert.equal(citesImplementingReport(evidence, slug), undefined, `should not cite: ${evidence}`);
  }
});

// The names are listed, not read from the directory, so the table stays stable
// as the directory grows. Every row is a real report written by this repository.
const REAL_REPORTS: [file: string, kind: string, slug: string, round: number, lens: string | undefined][] = [
  ["design_closing-row-cites-own-report_candidate-a.md", "design", "closing-row-cites-own-report", 1, "candidate-a"],
  ["design_closing-row-cites-own-report_candidate-b.md", "design", "closing-row-cites-own-report", 1, "candidate-b"],
  ["design_closing-row-cites-own-report_judge.md", "design", "closing-row-cites-own-report", 1, "judge"],
  ["impl_benchmark-hard-tier.md", "impl", "benchmark-hard-tier", 1, undefined],
  ["impl_benchmark-hard-tier_baseline.md", "impl", "benchmark-hard-tier", 1, "baseline"],
  ["impl_benchmark-hard-tier_r2.md", "impl", "benchmark-hard-tier", 2, undefined],
  ["impl_benchmark-harness.md", "impl", "benchmark-harness", 1, undefined],
  ["impl_benchmark-harness_baseline.md", "impl", "benchmark-harness", 1, "baseline"],
  ["impl_benchmark-harness_r2.md", "impl", "benchmark-harness", 2, undefined],
  ["impl_benchmark-harness_r3.md", "impl", "benchmark-harness", 3, undefined],
  ["impl_benchmark-harness_r4.md", "impl", "benchmark-harness", 4, undefined],
  ["impl_closing-row-cites-own-report.md", "impl", "closing-row-cites-own-report", 1, undefined],
  ["impl_commit-message-standard.md", "impl", "commit-message-standard", 1, undefined],
  ["impl_commit-message-standard_r2.md", "impl", "commit-message-standard", 2, undefined],
  ["impl_commit-message-standard_r3.md", "impl", "commit-message-standard", 3, undefined],
  ["impl_docs-for-newcomers.md", "impl", "docs-for-newcomers", 1, undefined],
  ["impl_editable-item-fields.md", "impl", "editable-item-fields", 1, undefined],
  ["impl_fanout-worker-can-forge-a-round-marker.md", "impl", "fanout-worker-can-forge-a-round-marker", 1, undefined],
  ["impl_fanout-worker-can-forge-a-round-marker_r2.md", "impl", "fanout-worker-can-forge-a-round-marker", 2, undefined],
  ["review_fanout-worker-can-forge-a-round-marker.md", "review", "fanout-worker-can-forge-a-round-marker", 1, undefined],
  ["impl_path-mstack-is-the-installed-copy.md", "impl", "path-mstack-is-the-installed-copy", 1, undefined],
  ["impl_provenance-fixtures-lack-package-json.md", "impl", "provenance-fixtures-lack-package-json", 1, undefined],
  ["impl_quiet-gate-prints-nothing.md", "impl", "quiet-gate-prints-nothing", 1, undefined],
  ["impl_readme-and-wiki.md", "impl", "readme-and-wiki", 1, undefined],
  ["impl_reviewer-writes-the-verdict.md", "impl", "reviewer-writes-the-verdict", 1, undefined],
  ["impl_rm-guard-command-boundary.md", "impl", "rm-guard-command-boundary", 1, undefined],
  ["impl_verification-never-runs.md", "impl", "verification-never-runs", 1, undefined],
  ["reflect_divergent.md", "reflect", "divergent", 1, undefined],
  ["reflect_refinement.md", "reflect", "refinement", 1, undefined],
  ["review_bare-names-wording.md", "review", "bare-names-wording", 1, undefined],
  ["review_benchmark-hard-tier.md", "review", "benchmark-hard-tier", 1, undefined],
  ["review_benchmark-harness.md", "review", "benchmark-harness", 1, undefined],
  ["review_benchmark-harness_r2.md", "review", "benchmark-harness", 2, undefined],
  ["review_benchmark-harness_r3.md", "review", "benchmark-harness", 3, undefined],
  ["review_benchmark-harness_r4.md", "review", "benchmark-harness", 4, undefined],
  ["review_closing-row-cites-own-report_correctness.md", "review", "closing-row-cites-own-report", 1, "correctness"],
  ["review_closing-row-cites-own-report_r2-correctness.md", "review", "closing-row-cites-own-report", 2, "correctness"],
  ["review_closing-row-cites-own-report_r2-security.md", "review", "closing-row-cites-own-report", 2, "security"],
  ["review_closing-row-cites-own-report_r2-tests.md", "review", "closing-row-cites-own-report", 2, "tests"],
  ["review_closing-row-cites-own-report_r3-correctness.md", "review", "closing-row-cites-own-report", 3, "correctness"],
  ["review_closing-row-cites-own-report_security.md", "review", "closing-row-cites-own-report", 1, "security"],
  ["review_closing-row-cites-own-report_tests.md", "review", "closing-row-cites-own-report", 1, "tests"],
  ["review_commit-message-standard.md", "review", "commit-message-standard", 1, undefined],
  ["review_commit-message-standard_r2.md", "review", "commit-message-standard", 2, undefined],
  ["review_commit-message-standard_r3.md", "review", "commit-message-standard", 3, undefined],
  ["review_decision-required-gate_adversarial.md", "review", "decision-required-gate", 1, "adversarial"],
  ["review_decision-required-gate_correctness.md", "review", "decision-required-gate", 1, "correctness"],
  ["review_docs-for-newcomers_facts.md", "review", "docs-for-newcomers", 1, "facts"],
  ["review_docs-for-newcomers_r2-facts.md", "review", "docs-for-newcomers", 2, "facts"],
  ["review_docs-for-newcomers_r2-reader.md", "review", "docs-for-newcomers", 2, "reader"],
  ["review_docs-for-newcomers_r3-facts.md", "review", "docs-for-newcomers", 3, "facts"],
  ["review_docs-for-newcomers_r3-reader.md", "review", "docs-for-newcomers", 3, "reader"],
  ["review_docs-for-newcomers_reader.md", "review", "docs-for-newcomers", 1, "reader"],
  ["review_editable-item-fields.md", "review", "editable-item-fields", 1, undefined],
  ["review_editable-item-fields_r2.md", "review", "editable-item-fields", 2, undefined],
  ["review_panel-followup-prose_facts.md", "review", "panel-followup-prose", 1, "facts"],
  ["review_path-mstack-is-the-installed-copy.md", "review", "path-mstack-is-the-installed-copy", 1, undefined],
  ["review_path-mstack-is-the-installed-copy_r2.md", "review", "path-mstack-is-the-installed-copy", 2, undefined],
  ["review_path-mstack-is-the-installed-copy_r3.md", "review", "path-mstack-is-the-installed-copy", 3, undefined],
  ["review_path-mstack-is-the-installed-copy_r4.md", "review", "path-mstack-is-the-installed-copy", 4, undefined],
  ["review_provenance-fixtures-lack-package-json.md", "review", "provenance-fixtures-lack-package-json", 1, undefined],
  ["review_quiet-gate-prints-nothing.md", "review", "quiet-gate-prints-nothing", 1, undefined],
  ["review_quiet-gate-prints-nothing_r2.md", "review", "quiet-gate-prints-nothing", 2, undefined],
  ["review_readme-and-wiki_facts.md", "review", "readme-and-wiki", 1, "facts"],
  ["review_readme-and-wiki_r2-facts.md", "review", "readme-and-wiki", 2, "facts"],
  ["review_readme-and-wiki_reader.md", "review", "readme-and-wiki", 1, "reader"],
  ["review_readme-leads-with-use_mstack-front-door.md", "review", "readme-leads-with-use", 1, "mstack-front-door"],
  ["review_readme-leads-with-use_readme-leads-with-use.md", "review", "readme-leads-with-use", 1, "readme-leads-with-use"],
  ["review_reviewer-writes-the-verdict.md", "review", "reviewer-writes-the-verdict", 1, undefined],
  ["review_reviewer-writes-the-verdict_r2.md", "review", "reviewer-writes-the-verdict", 2, undefined],
  ["review_reviewer-writes-the-verdict_r3.md", "review", "reviewer-writes-the-verdict", 3, undefined],
  ["review_rm-guard-command-boundary.md", "review", "rm-guard-command-boundary", 1, undefined],
  ["review_rm-guard-command-boundary_r2.md", "review", "rm-guard-command-boundary", 2, undefined],
  ["review_session_thesis.md", "review", "session", 1, "thesis"],
  ["review_statusline_correctness.md", "review", "statusline", 1, "correctness"],
  ["review_statusline_robustness.md", "review", "statusline", 1, "robustness"],
  ["review_statusline_tests.md", "review", "statusline", 1, "tests"],
  ["review_verification-never-runs.md", "review", "verification-never-runs", 1, undefined],
  ["review_verification-never-runs_r2.md", "review", "verification-never-runs", 2, undefined],
  ["review_verification-never-runs_r3.md", "review", "verification-never-runs", 3, undefined],
  ["review_verification-never-runs_r4.md", "review", "verification-never-runs", 4, undefined],
  ["review_why-source-playbooks_facts.md", "review", "why-source-playbooks", 1, "facts"],
];

test("roundOf reads the round and lens of every real report name", () => {
  for (const [file, kind, slug, round, lens] of REAL_REPORTS) {
    const got = roundOf(`/x/.mstack/progress/${file}`, kind, slug);
    assert.equal(got.round, round, `${file}: round`);
    assert.equal(got.lens, lens, `${file}: lens`);
  }
});

test("roundOf: a lens that merely starts with r is a lens, a marker is not", () => {
  assert.deepEqual(roundOf("review_s_r2.md", "review", "s"), { round: 2 });
  assert.deepEqual(roundOf("review_s_r2-facts.md", "review", "s"), { round: 2, lens: "facts" });
  assert.deepEqual(roundOf("review_s_reader.md", "review", "s"), { round: 1, lens: "reader" });
  assert.deepEqual(roundOf("review_s_r2x.md", "review", "s"), { round: 1, lens: "r2x" });
  assert.deepEqual(roundOf("review_s_r.md", "review", "s"), { round: 1, lens: "r" });
});
