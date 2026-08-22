# Design: closing-row-cites-own-report — candidate A

## Problem

`checkClosedItems` in `src/gate.ts` decides whether a `done` item's ledger rows prove it
was closed by a pass that did not write the code. Two holes let a forged or dead-end
ledger produce a green gate. Hole A: the check reads only the `verifier` column, so a row
recorded `--verifier reviewer --evidence .mstack/progress/impl_<slug>.md` closes the item
even though its evidence is the implementer's own report wearing a reviewer's name — the
column says one thing, the evidence says another, and nothing compares them. Hole B: the
"all rows failed" guard (`rows.every(...)`) is defeated by any passing row at all, even
the implementer's own, so a done item with one passing implementer row and one
unsuperseded `verifier-failed` reviewer row sails through — the implementer's pass
suppresses the every-check, and the reviewer's failed row still satisfies "some row has a
closing verifier" because that scan never reads the verdict column either. Both holes were
reproduced at runtime through the real CLI, and two tests already sit in the suite,
committed red, pinning exactly these two shapes (`tests/gate.test.ts`, "a closing row
citing the implementer's own report", "an unsuperseded verifier-failed").

## Usage

The caller here is a human or agent running `mstack gate` (or `mstack gate --quiet` from
the `Stop` hook). Four scenarios, each showing the failing message and its remedy in the
same format the check already uses (`report.fail(message, remedy)`, rendered as
`[fail]  <message> -> <remedy>` in quiet mode):

**Hole A, reproduced** — a `done` item whose only non-implementing row's evidence names
the implementer's own report:

```
[fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer cites the implementer's own report) -> a closing verdict needs evidence from the closing pass's own work, not a pointer to the implementer's report; re-run the check and record what actually happened
```

**Hole A, fixed** — a further row is recorded citing the reviewer's own report
(`review_storage-layer.md`); the forged row stays in the ledger (append-only) but is no
longer the only candidate, and the item passes:

```
[ok]    1 closed item(s) carry a ledger verdict
```

**Hole B, reproduced** — a `done` item carries a passing implementer row and an
unsuperseded `verifier-failed` reviewer row:

```
[fail]  items marked done whose most recent closing verdict is verifier-failed: storage-layer (most recent closing verdict, by "reviewer", is verifier-failed) -> the ledger is append-only, so the failed row stays; a later verdict from a closing role is what clears it — re-run the review after the fix and record a fresh one
```

**Hole B, fixed** — a later reviewer row records a passing (or blocked) verdict, superseding
the failure:

```
[ok]    1 closed item(s) carry a ledger verdict
```

Signatures the caller (`runGate` → `checkInvariants` → `checkClosedItems`) touches:

- `checkClosedItems(store: Store, state: State, report: Report): void` — same signature as
  today; only its body changes.
- `citesImplementingReport(evidence: string, slug: string): boolean` — new, exported from
  `src/roles.ts`.

## Shape

### Data

No new persisted shapes. `ledger.Entry` (`target, sha, verdict, evidence, verifier, ts`)
and `state.Item` are unchanged, and `ledgerEntries(store)` already returns rows in file
(chronological) order — the property this design leans on for "most recent."

`src/roles.ts` gains one pure function, placed beside `REPORT_KINDS`, `IMPLEMENTING_ROLES`
and `reportFiles` — the module that already owns the `<kind>_<slug>[_<suffix>].md` naming
contract, so a third consumer (the gate) reads the same table `reportFiles` and the
`SubagentStop` hook already read, instead of growing its own copy of the naming rule:

```ts
/**
 * Does this evidence string name an implementing role's own report for this
 * item — the report `reportFiles` would list for `impl`/`spec` — regardless
 * of which role the row's `verifier` column claims?
 *
 * A pure string check against the naming contract, not a directory read: the
 * ledger row has to prove or disprove itself from its own columns, the same
 * way every other check in `checkClosedItems` does.
 */
export function citesImplementingReport(evidence: string, slug: string): boolean {
  const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const role of IMPLEMENTING_ROLES) {
    const kind = REPORT_KINDS[role];
    if (kind === undefined) continue;
    const prefix = `${kind}_${escapedSlug}`;
    const pattern = new RegExp(`(?:^|[\\s/])${prefix}(?:\\.md|_[^\\s/]+\\.md)(?=$|[\\s,;:])`);
    if (pattern.test(evidence)) return true;
  }
  return false;
}
```

Iterating `IMPLEMENTING_ROLES` (today `{implementer, spec-author}`) rather than hardcoding
`"impl"` means a spec-author's own `spec_<slug>.md` cited by a non-authoring role is caught
by the same code path, for free, without a second predicate.

### How data moves through `checkClosedItems`

Per closed item, in order (each item lands in at most one outcome; unmatched falls
through to passing):

1. `rows = ledgerEntries(store).filter(e => e.target === item.slug)`.
   `rows.length === 0` → `missing`. *(unchanged)*
2. `rows.every(e => e.verdict === "verifier-failed")` → `failed`. *(unchanged: every row,
   including any implementer row, is a failure — the narrow case the existing message and
   its green test already describe accurately)*
3. `closingRows = rows.filter(e => canCloseAnItem(e.verifier))`.
   `closingRows.length === 0` → `selfClosed`, message unchanged. *(unchanged: no row at
   all carries a non-implementing verifier)*
4. `legitClosingRows = closingRows.filter(e => !citesImplementingReport(e.evidence, item.slug))`.
   `legitClosingRows.length === 0` → **new** `forgedEvidence`: every row whose verifier
   looked like a closing role turns out to cite the implementer's (or spec-author's) own
   report.
5. `latest = legitClosingRows[legitClosingRows.length - 1]` (last in file order — the most
   recent word from a genuinely closing row). `latest.verdict === "verifier-failed"` →
   **new** `unsupersededFailure`.
6. Otherwise: passes.

After the loop, five `if (list.length > 0) report.fail(...)` blocks in this order —
`missing`, `failed`, `selfClosed`, `forgedEvidence`, `unsupersededFailure` — each
unchanged or new list appended after the three existing ones, so the diff against today's
code is additive. `report.ok` fires only when all five are empty.

Exact new messages and remedies:

```ts
if (forgedEvidence.length > 0) {
  report.fail(
    `items closed on a verdict whose evidence cites the implementer's own report: ${forgedEvidence.join(", ")}`,
    "a closing verdict needs evidence from the closing pass's own work, not a pointer to the implementer's report; re-run the check and record what actually happened",
  );
}
if (unsupersededFailure.length > 0) {
  report.fail(
    `items marked done whose most recent closing verdict is verifier-failed: ${unsupersededFailure.join(", ")}`,
    "the ledger is append-only, so the failed row stays; a later verdict from a closing role is what clears it — re-run the review after the fix and record a fresh one",
  );
}
```

Per-item detail pushed into each list, mirroring the existing `selfClosed` style (naming
the verifier(s) responsible):

```ts
forgedEvidence.push(
  `${item.slug} (${[...new Set(closingRows.filter(e => citesImplementingReport(e.evidence, item.slug)).map(e => e.verifier || "unnamed"))].join(", ")} cites the implementer's own report)`,
);
unsupersededFailure.push(
  `${item.slug} (most recent closing verdict, by "${latest.verifier || "unnamed"}", is verifier-failed)`,
);
```

## Edge cases

Walking each item the brief requires a decision on:

- **Exact path vs. prefix vs. basename.** Basename, path-prefix-agnostic: the regex
  anchors on `<kind>_<slug>` bounded by a path separator/whitespace/string-start before it
  and `.md` (bare or `_<suffix>.md`) bounded by whitespace/punctuation/string-end after.
  `.mstack/progress/impl_x.md`, `progress/impl_x.md`, and bare `impl_x.md` all match; a
  full-string-equality check would not, and would miss the real-ledger style of trailing
  prose (`impl_verification-never-runs.md round-2 section`, `impl_editable-item-fields.md -
  shipped bin/mstack driven as a process...`) if that same style were ever used by a
  forged row.
- **Prose that merely mentions the path, vs. evidence with trailing prose.** Both count as
  a citation. The check cannot reliably distinguish "this evidence *is* a pointer to the
  implementer's report" from "this evidence *also mentions* the implementer's report in
  passing while describing independent work" — both are free text. Erring toward flagging
  matches the fail-closed posture the rest of this check already takes (see the
  `closed_by`-escape-hatch comment at `gate.ts:353`); the cost is a false positive on a
  hypothetical adversarial review that quotes the impl path to refute it — see Trade-offs.
- **Spec-author reports.** Covered by construction: the loop iterates
  `IMPLEMENTING_ROLES`, which already contains `spec-author`, and `REPORT_KINDS["spec-
  author"] === "spec"`. A row citing `spec_<slug>.md` is caught the same way, no
  special-casing needed.
- **Other items' impl reports.** Not matched. The regex prefix is
  `<kind>_<the audited item's own slug>`, built per item inside the loop, so a row for
  item `storage-layer` citing `impl_other-item.md` does not trigger this check (it would be
  a different bug — evidence naming the wrong item — that no existing check catches
  either, and is out of scope here).
- **Supersession: fail-then-pass.** A later `legitClosingRows` entry with a passing verdict
  makes `latest.verdict !== "verifier-failed"` — passes. Proven by the committed test
  (reviewer fails, then a re-review records `test-verified` at the same SHA — passes).
- **Pass-then-fail.** A later closing-role row records `verifier-failed` after an earlier
  pass — `latest` is now the failed row — fails. This is deliberate: the most recent word
  from a closing role governs, not the best-ever word, so a review that later retracts
  approval blocks the close.
- **Fail-then-blocked.** `verifier-blocked` is not `"verifier-failed"`, so a blocked row
  after a failed one clears `latest.verdict === "verifier-failed"` — passes. This
  reproduces the existing green test ("blocked is a verdict") unchanged: `checkClosedItems`
  has never distinguished blocked from any other non-failed verdict, and this design does
  not start doing so — `ledger.ts`'s `RANK` table (where blocked and failed both rank 0) is
  scoped to `check()`'s pre-close verification-obligation question, a different concern.
- **Multiple closing roles.** Supersession is not scoped to a single named verifier
  string; it is "the most recent row among all closing-eligible, non-forged rows,
  regardless of who wrote it." A first reviewer's failure superseded by a second
  reviewer's pass (or by `orchestrator`, `review panel`, etc.) closes the item, matching
  the real pattern in this repo's own ledger (`docs-for-newcomers`: `orchestrator` fails
  twice, passes on the third panel round).
- **Rows at different SHAs.** Ignored, on purpose, for both the forged-evidence and the
  supersession checks — consistent with `checkClosedItems`'s existing documented stance
  ("any verdict for the slug, not one at the current head," `gate.ts:361`). SHA freshness
  matters to the *pre-close* obligation check (`checkVerificationRuns`); an already-`done`
  item's audit here only asks whether its ledger trail, taken as a whole in the order it
  was written, tells a legitimate story.

## Rejected alternatives

- **Full-string equality between `evidence` and the report path**, instead of a bounded
  substring match. Rejected: brittle to the path-prefix variation already present in this
  repo's own ledger (`.mstack/progress/impl_x.md` vs. bare filenames some tools might
  record) and to trailing prose, which is an established, unremarkable style for genuine
  implementer rows (`round-2 section`, `- shipped bin/mstack driven...`) and therefore a
  realistic style a forged row could also use.
- **Filesystem check**: call `reportFiles`/`substantialReports` to compare evidence against
  files that actually exist in `.mstack/progress/`. Rejected: violates the stated
  constraint that the audit stays a synchronous scan over parsed rows with "no filesystem
  reads beyond what already happens"; also wrong in kind — the question is whether the
  *ledger* is internally consistent (an append-only proof trail), not whether a particular
  file currently sits on this disk (which a fresh clone, a different worktree, or a
  deleted report would all answer "no" for reasons unrelated to the forgery this check
  exists to catch).
- **A blocklist of known-forged verifier strings.** Rejected: not the actual shape of the
  hole. The hole is generic — any closing-sounding role name paired with evidence that
  names the implementer's report — and a blocklist would chase specific past incidents
  rather than the mechanism.
- **Rank-based supersession** (`ledger.ts`'s `RANK`: closable if the *highest-ranked* row
  among legit closing rows is not failed) instead of *most-recent*. Rejected: rank-max
  would let a stale pass outrank a newer, more authoritative failure — exactly backwards
  for "pass-then-fail," where a later reviewer retracting approval must still block the
  close.
- **Verifier-scoped supersession** (only the *same* named verifier's later row clears its
  own earlier failure). Rejected: `verifier` is free text — a person's name, `"review
  panel"`, `"orchestrator"` — and the real ledger already shows re-reviews landing under
  different verifier strings across rounds; scoping supersession to exact-string identity
  would fail the repo's own "multiple closing roles" case, which the brief explicitly asks
  to cover.
- **Reuse the existing `selfClosed`/`failed` lists and messages** rather than adding two
  new ones. Rejected: `selfClosed`'s message ("closed on a verdict from the pass that
  wrote the code") is false for Hole A — the verifier column names a legitimate role; the
  evidence is what lies. `failed`'s message ("whose only verdict is verifier-failed") is
  false for Hole B — there is a passing implementer row. Reusing either would make an
  accurate check emit an inaccurate message, and would either break the two existing green
  tests' exact regexes or require diluting them.

## Trade-offs accepted

- We accept flagging evidence that merely *mentions* the implementer's report path
  alongside independently described work, in exchange for closing the reproduced hole
  without a fuzzier heuristic ("is this citation load-bearing or incidental?") that a
  forged row could route around by rewording. The remedy line tells the fix: describe what
  the closing pass did, and if the impl report needs mentioning, cite the closing pass's
  own report file first and reference the impl report by name in prose without triggering
  the exact `<kind>_<slug>` filename shape — or simply don't put it in `evidence` at all.
- We accept that supersession orders purely by ledger file order and ignores SHA, in
  exchange for staying consistent with `checkClosedItems`'s pre-existing, tested stance
  that a closed item's ledger proof is not held to today's HEAD.
- We accept that `verifier-blocked` still counts as clearing a prior failure for this
  audit, even though it asserts nothing about correctness, in exchange for not touching an
  existing, separately-decided, separately-tested design point that is out of this item's
  scope.
- We accept two new list/message pairs rather than three or four (e.g., splitting
  fail-then-pass from multi-role supersession into separate messages), in exchange for
  keeping the report's shape — "one list per failure class, named offenders, one remedy" —
  unchanged in kind, just longer by two entries.

## Open questions

- Should `mstack ledger record` itself warn or refuse at write time when `--evidence`
  cites the recording role's own disallowed report, rather than only catching it later in
  `gate`? Left for a separate item — this design is scoped to tightening the audit, not
  adding a new write-time linter.
- Should a wrong-slug citation (item A's row naming item B's `impl_*.md`) be treated as a
  distinct ledger-integrity problem? Out of scope here; no existing check catches
  evidence naming the wrong target today, and this fix does not change that.
