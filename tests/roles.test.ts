import { test } from "node:test";
import assert from "node:assert/strict";

import { citesImplementingReport } from "../src/roles.ts";

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
