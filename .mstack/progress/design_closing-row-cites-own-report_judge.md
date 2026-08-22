# Judge: closing-row-cites-own-report

Both candidates were traced, not read. The two predicates and both decision procedures were
transcribed into a script and run over the real `.mstack/ledger.tsv` (51 rows) against the
18 `done` items in `.mstack/state.json`, and over 17 adversarial evidence strings. The four
tests named in the brief were walked row by row through both procedures. Findings below cite
those runs.

**Shared facts established by the trace** (true of both candidates, so they discriminate
nothing and are stated once):

- All 18 done items stay green under both. Both reach `pass` on every one.
- 21 of 51 ledger rows cite an `impl_<slug>.md` path. Every one of them is `--verifier
  implementer`, so `canCloseAnItem` excludes them before either predicate is consulted.
  **No closing-role row in the real ledger trips either predicate.** The 30 free-prose rows
  trip neither.
- Both predicates match the real trailing-prose style
  (`impl_verification-never-runs.md round-2 section`, `impl_editable-item-fields.md - shipped
  bin/mstack driven as a process...`) and both correctly ignore `impl_<other-slug>.md`,
  `impl_<slug>.mdx` and `impl_<slug>-extra.md`.
- `path-mstack-is-the-installed-copy` is the real-ledger stress case: reviewer rows 38, 40, 42
  are `verifier-failed`, superseded only at row 44. Both designs' most-recent-candidate rule
  keeps it green; any "some row failed" rule would have turned it red. Both got this right.
- Both write `arr[arr.length - 1]` and then dereference it. `tsconfig.json` sets
  `noUncheckedIndexedAccess: true`, so both need a `!` (the repo already uses `match[0]!` at
  `src/gate.ts:286`). One character, equal cost to both — not scored.
- All four named tests pass under both procedures, traced individually.

---

## Candidate A

| # | Criterion | Score | Evidence |
|---|---|---|---|
| 1 | No false positives on the real ledger | 2 | Simulated: 18/18 done items `pass`; zero closing-role rows match `citesImplementingReport`; the `spec` arm adds no match either, and `.mstack/specs/<slug>/spec.md` (what a reviewer would legitimately cite) does not match the `spec_<slug>` prefix. |
| 2 | Both forged shapes refused; supersession | 1 | All five enumerated walks are correct (forged-reviewer → `forgedEvidence`; impl-pass+rev-fail → `unsupersededFailure`; fail-then-pass → pass; pass-then-fail → fail; fail-then-blocked → pass). But the trailing boundary `(?=$\|[\s,;:])` lets the *same* forged row through with one extra character: `impl_storage-layer.md.`, `...md)`, `...md#tests`, `...md\|passed` all return `false` under A and `true` under B. |
| 3 | Naming contract stays in roles.ts | 2 | Predicate lives in `src/roles.ts` beside `reportFiles`; builds the prefix by iterating `IMPLEMENTING_ROLES` × `REPORT_KINDS` rather than naming a kind, and guards the `undefined` the table lookup can return. `gate.ts` learns nothing about `<kind>_<slug>`. |
| 4 | Message names item, shape, remedy | 2 | Two new messages, both literally true of the shape that produced them. `most recent closing verdict is verifier-failed` is the actual fact; the remedy explains the append-only supersession mechanic, which is the thing a maintainer staring at a passing implementer row needs told. Uses `report.fail(message, remedy)` unchanged. |
| 5 | Maintainer fatigue | 1 | No config, no git walking, synchronous. But ~+50 lines across `src/` (≈29 in gate.ts, ≈21 in roles.ts with its doc comment), and two pieces the semantics do not need: `escapedSlug` is dead — `SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/` (`src/state.ts:49`, enforced on load at :143) admits no regex metacharacter — and the retained `rows.every(...)` branch is now reachable only for message wording. |
| 6 | Existing tests keep meaning | 2 | Traced all four green. `rows.every` is kept precisely so `/only verdict is verifier-failed/` still pins the every-row-failed shape and nothing wider; blocked-after-failed passes via `latest.verdict !== "verifier-failed"`; `mstack:implementer` and `""` both reach `selfClosed` unchanged, so `README.md:149` and the wiki's pasted `(only implementer)` output stay byte-identical. |

**Total: 10/12**

### Holes found in A

- **One-character evasion of the check itself.** `--evidence ".mstack/progress/impl_x.md."`
  — a trailing full stop — passes A. So do a closing paren, a `#anchor`, and a `|`. This is
  the check's own subject matter, not an adjacent case, and it is the likeliest *accidental*
  form as well as the easiest deliberate one. B's boundary class catches all four.
- **The design prose teaches the bypass.** Trade-offs (lines 258–260) advises "reference the
  impl report by name in prose without triggering the exact `<kind>_<slug>` filename shape —
  or simply don't put it in `evidence` at all." That is the evasion, written down as guidance.
  The *shipped* remedy string is clean, so this is a document problem, not a code one — but it
  should not survive into the implementation's comments.
- **Detail string duplicates its own header.** `storage-layer (reviewer cites the
  implementer's own report)` repeats the message it is appended to, and diverges from the
  established `(only implementer)` shape the docs have pasted output for.

---

## Candidate B

| # | Criterion | Score | Evidence |
|---|---|---|---|
| 1 | No false positives on the real ledger | 2 | Simulated: 18/18 done items `pass`; zero closing-role rows match `citesOwnReport`; the narrower `impl`-only scope makes a false positive strictly less likely than A's. |
| 2 | Both forged shapes refused; supersession | 2 | All five enumerated walks correct, same outcomes as A. Boundary class `(?=$\|[^A-Za-z0-9_-])` is a strict superset of A's coverage: of 17 adversarial probes B misses 2, A misses 6, and every string A catches B catches except `spec_<slug>.md`. |
| 3 | Naming contract stays in roles.ts | 2 | Predicate in `src/roles.ts` next to `canCloseAnItem`; the two-armed alternation `(\.md\|_[^\s/]*\.md)` mirrors `reportFiles`'s `name === prefix+".md" \|\| startsWith(prefix+"_")` exactly, including the empty-suffix case A's `+` rejects. `gate.ts` stays ignorant of the contract. |
| 4 | Message names item, shape, remedy | 1 | The new `selfCited` message is good. But hole B reuses `items marked done whose only verdict is verifier-failed`, which is **false on the exact shape the committed red test pins** — there are two verdicts and the implementer's passed. A maintainer who opens the ledger sees a passing row and concludes the gate is broken. This repo already pins the principle that a gate must not state a wrong fact (`tests/gate.test.ts:263-276`, the `no active item` while two are open case). B names the trade in Trade-offs but takes it. |
| 5 | Maintainer fatigue | 2 | ~+41 lines across `src/` (≈24 gate.ts, ≈17 roles.ts). Deletes the `rows.every` scan rather than keeping it; one new list, one new message; no escape helper, with a checked justification for why none is needed. Nothing here the semantics do not require. The `Shape` block is transcribable as written. |
| 6 | Existing tests keep meaning | 1 | All four pass, traced. But `/only verdict is verifier-failed/` now matches a message whose scope has silently widened to cover impl-pass+rev-fail and pass-then-fail. The test keeps passing while no longer pinning what its own regex asserts — the "green test that stopped meaning anything" shape. B discloses this; it does not fix it or amend the test. |

**Total: 10/12**

### Holes found in B

- **`spec_<slug>.md` cited by a reviewer still closes the item.** The spec-author's progress
  report (`agents/spec-author.md` writes `.mstack/progress/spec_<slug>.md`) is structurally
  the same artifact as `impl_<slug>.md`, and `IMPLEMENTING_ROLES` already contains
  `spec-author` for exactly this reason. B scopes it out deliberately; the cost of closing it
  is one loop.
- **`REPORT_KINDS["implementer"]` is `string | undefined` under `noUncheckedIndexedAccess`,**
  and a template literal swallows `undefined` silently. B builds the prefix straight into the
  template with no guard, so a future table edit yields the pattern `undefined_<slug>` and a
  check that matches nothing, quietly. A guards this.
- **The `failed` list can no longer distinguish "never passed" from "regressed",** and B's
  remedy ("reopen the item") omits the fact that a *later closing row* is what clears an
  append-only failure — the one instruction the reproduced hole B actually needs.

---

## Holes both leave open

1. **Leading boundary is quote-blind.** Both require `^` or `[\s/]` before the prefix, so
   `evidence: "impl_storage-layer.md"` — a quoted path — passes both. So does `[impl_x.md]`
   and `=impl_x.md`.
2. **A trailing hyphen defeats both.** `impl_storage-layer.md-round-2` passes A (`-` not in
   `[\s,;:]`) and B (`-` is excluded by `[^A-Za-z0-9_-]`). Since `- shipped ...` is an
   established real style, the hyphen variant is a natural thing to type.
3. **Prose that never names the file passes both.** `--verifier reviewer --evidence "read the
   implementer's report, all good"` is refused by neither. This is the irreducible residual:
   `verifier` is free text and `roles.ts:96-99` already says the column is "a floor and not a
   proof." Both designs lower the bar to "do not name the file," and neither claims more —
   but neither states this residual plainly either, and the fix's own report should.
4. **Wrong-slug citation.** A row for item X citing `impl_Y.md` is invisible to both, by
   construction. Both name it and scope it out; agreed, out of scope.
5. **Nothing stops the shape being written.** Both tighten the post-hoc audit only;
   `mstack ledger record` and the close path still accept the forged row. A raises this as an
   open question; B does not.

## Where they disagree, and whether it matters

- **Kind coverage** (`impl` only vs `impl`+`spec`) — matters, cheaply. A's version costs one
  loop and has no false-positive exposure on the real ledger; `.mstack/specs/<slug>/spec.md`,
  the requirements file a reviewer legitimately cites, does not match the `spec_<slug>` prefix.
- **Whether `rows.every` survives** — matters for messages, not verdicts. Under A an item
  whose rows are all failed with no closing role reports `only verdict is verifier-failed`;
  under B the same item reports `closed on a verdict from the pass that wrote the code`. No
  test pins it. A's diagnosis leads with the bigger fact.
- **One `failed` list vs two** — the real fork. It is the difference between a gate that
  states the fact and a gate that states a nearby falsehood on the shape it just caught.
- Everything else — ordering by ledger file position, dropping forged rows from the ordering
  rather than letting them supersede (both got this right in both directions: a forged
  passing row appended after a genuine failure clears nothing under either), identity-agnostic
  supersession, ignoring SHA, `verifier-blocked` clearing a failure — is identical.

---

## Recommendation

**Base: candidate A.** The two designs tie on points and are behaviorally identical on every
verdict the enumerated walks and the real ledger produce, so the tiebreak is which defect is
structural and which is a line. A's defect is a regex character class — replace
`(?=$|[\s,;:])` with B's `(?=$|[^A-Za-z0-9_-])` and it is gone, along with four of A's six
adversarial misses. B's defect is that the gate's user-facing sentence is false on exactly the
shape the committed red test reproduces, and fixing it means re-deriving A's structure: a
second accumulator, a second message, and the `rows.every` branch B deleted. That is most of
A's contribution, grafted back. This repository has already spent a test on the principle that
a red gate must not state the wrong fact, and `checkClosedItems` is the check whose entire
history is "the message and the reality diverged" — shipping a check that catches the forgery
and then misdescribes it is the same mistake in a new costume. A's messages also carry the
append-only supersession mechanic in the remedy, which is what a maintainer looking at a
passing implementer row and a red gate needs to be told.

### Graft from candidate B

1. **The boundary class.** Use B's `(^|[\s/])<prefix>(\.md|_[^\s/]*\.md)(?=$|[^A-Za-z0-9_-])`
   in place of A's `(?:^|[\s/])...(?=$|[\s,;:])`. Keep A's loop over `IMPLEMENTING_ROLES`
   around it, and keep A's `if (kind === undefined) continue` guard. Note B's `*` over A's `+`
   in the suffix arm: B's mirrors `reportFiles` exactly (`startsWith(prefix + "_")` admits
   `impl_x_.md`), A's does not.
2. **Drop `escapedSlug`,** and keep B's *reason* for dropping it in the comment: `SLUG`
   (`src/state.ts:49`) admits no regex metacharacter and is enforced on load at :143, so the
   safety is by construction, not by convention. That is a checked claim, not an assumption,
   and it is worth writing down.
3. **B's detail-string shape.** `${item.slug} (${verifiers.join(", ")})` — matching the
   existing `(only implementer)` style — instead of A's `(reviewer cites the implementer's own
   report)`, which restates its own header.
4. **B's transcribable loop body** as the structural template for the rewrite (the `continue`-
   per-outcome shape and the inline comments explaining why file order is chronological). A
   describes its procedure in numbered prose plus fragments; B's block can be typed in.
5. **Do not graft** B's single-`failed`-list consolidation, or its `impl`-only kind scope.
   Those are the two places A is ahead.

### Also do, beyond either design

- Cut A's Trade-offs sentence about rewording evidence "without triggering the exact
  `<kind>_<slug>` filename shape" from anything that ships. Do not repeat it in a code comment.
- State the residual (hole 3 above) honestly in the code comment, the way `roles.ts:96-99`
  already does for `canCloseAnItem`: this check stops the default path, not a determined
  forger.

### Open question an implementer still has to ask

Neither design addresses the **leading** boundary, so a quoted or bracketed path
(`evidence: "impl_x.md"`, `[impl_x.md]`) escapes both, as does a trailing hyphen
(`impl_x.md-round-2`). Widening the leading anchor to `(?:^|[^A-Za-z0-9_-])` and adding `-` back
into the trailing class would close both, but nothing in this repository's real ledger exercises
either form, and widening the trailing class re-opens the `impl_x.md-round-2` question in the
other direction (is a hyphenated suffix a citation or a different filename?). Decide before
writing the regex: is the contract "the exact report filename as a whole token, however it is
punctuated," or "the report filename as a path component only"? A's and B's regexes answer
differently by accident rather than by decision, and the tests pin neither.

BASE: candidate-a
