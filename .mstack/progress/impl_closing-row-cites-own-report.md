# impl: closing-row-cites-own-report

## What changed

`checkClosedItems` (src/gate.ts) now runs candidate A's six-step decision procedure
(design_closing-row-cites-own-report_candidate-a.md, Shape) written in candidate B's
transcribable continue-per-outcome loop style (judge graft 4): rows → `missing`; every row
failed → `failed`; no closing-role row → `selfClosed`; closing rows whose evidence all cite
an implementing role's own report → new `forgedEvidence`; most recent legitimate closing
row `verifier-failed` → new `unsupersededFailure`; otherwise pass. The two new lists are
appended after the existing three with exactly candidate A's message/remedy pairs, and the
detail strings use the `(verifiers)` shape matching the existing `(only implementer)` style
(graft 3). Forged rows are filtered out *before* the ordering, so a forged passing row can
neither close an item nor supersede a genuine failure. The evidence predicate
`citesImplementingReport(evidence, slug)` is new in src/roles.ts beside the naming
contract; it iterates `IMPLEMENTING_ROLES` × `REPORT_KINDS` (so a spec-author's
`spec_<slug>.md` is caught by the same path), guards the `undefined` table lookup, and uses
the decided boundary regex `(^|[^A-Za-z0-9_-])<prefix>(\.md|_[^\s/]*\.md)(?=$|[^A-Za-z0-9_])`
— the citation contract is "the exact report filename as a whole token, however punctuated"
(decision row 2026-08-22T16:14:07.640Z in decisions.tsv, superseding both candidates'
boundary choices). `escapedSlug` was dropped with the checked reason in the comment (graft
2: SLUG at src/state.ts:49 admits no regex metacharacter, enforced on load at
src/state.ts:143). The predicate's comment states the residual honestly, mirroring
canCloseAnItem: it stops the default path, not a determined forger — free prose that never
names the file passes. Candidate A's Trade-offs sentence teaching the bypass wording was
not carried anywhere. The `latest` indexed access carries `!` per `noUncheckedIndexedAccess`
(precedent: `match[0]!` at src/gate.ts:286). No existing test was edited; README.md and
docs/ untouched.

## Files

- src/roles.ts — new exported predicate `citesImplementingReport` (src/roles.ts:136) with
  the contract, no-escaping justification, `*`-not-`+` note, and residual in its doc comment.
- src/gate.ts — `checkClosedItems` rewritten (loop at src/gate.ts:365-408; two new fail
  blocks at :427-439; widened ok guard at :440-448); import of the predicate at :31.
- tests/gate.test.ts — 4 new tests (lines 640, 690, 710, 736); the two committed red tests
  (568, 603) now green, unmodified.
- tests/roles.test.ts — new; direct boundary table for the predicate (23 strings).
- .mstack/progress/impl_closing-row-cites-own-report.md — this report.
- .mstack/ledger.tsv — one appended implementer row (the recording command's output).

## Commands

All run on this branch at the commit under review, no build step. 278 tests existed before
(2 committed red); 283 now (+5 new), all green on both runtimes.

`npm test` (runs `bun test tests/ && node --test 'tests/*.test.ts'`):

```
bun test v1.3.11 (af24e281)
 283 pass
 0 fail
Ran 283 tests across 16 files. [45.81s]
ℹ tests 283
ℹ suites 0
ℹ pass 283
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 23607.741667
```

`npm run typecheck`:

```
> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit

typecheck exit: 0
```

`./bin/mstack lint-plugin .` (tail):

```
-- cross-references
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves

-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings
```

`./bin/mstack gate` in the repo root (acceptance criterion 2 — every real ledger row, all
free-prose and implementer-cited evidence, unaffected):

```
-- store
[ok]    state.json exists
[ok]    progress/current.md exists
[ok]    progress/history.md exists
[ok]    state.json parses and has the right shape (25 items)

-- state
[ok]    ids are unique
[ok]    slugs are unique
[ok]    every item has at least one acceptance criterion
[ok]    one active item: closing-row-cites-own-report (in_progress)
[ok]    progress/current.md tracks the active item
[ok]    no item carries a decision fork
[ok]    no sdd item is past specifying
[ok]    18 closed item(s) carry a ledger verdict
[ok]    closing-row-cites-own-report is in_progress; a verification run is due at verifying

-- workspace
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[ok]    on branch fix/closing-row-cites-own-report
[warn]  9 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 1 warning
```

The warning is the mid-session working tree (this report, tests, src, current.md, the
design files), expected before the closing commit.

Red-without-the-fix proof: src/gate.ts and src/roles.ts restored to HEAD (b27240e), then
`node --test tests/gate.test.ts tests/roles.test.ts`:

```
✖ a closing row citing the implementer's own report does not close the item (171.638125ms)
✖ an unsuperseded verifier-failed closing row does not close the item (168.765208ms)
✖ a citation is the exact report filename as a whole token, however punctuated (159.528458ms)
✖ a closing row citing the spec-author's own report does not close the item (155.340167ms)
✖ a later verifier-failed closing row retracts an earlier pass (170.8085ms)
✖ a forged passing row cannot supersede a genuine failure (180.863209ms)
✖ tests/roles.test.ts (76.187375ms)
ℹ pass 62
ℹ fail 7
```

(The roles.test.ts file-level failure is its import of the then-nonexistent predicate.)
Fix restored, everything above green again in the 283/283 runs.

## Rung-5 scratch-store transcripts (acceptance criterion 3)

The "passes today" half was recorded by the pre-fix session through this same CLI surface
(current.md log, step 1). Post-fix, scratch stores under the session scratchpad, driven
entirely by `/Users/romerma/Code/mstack/bin/mstack` — this checkout's shipped CLI.

**Scratch A — forged self-citation refused, then cleared by real review evidence:**

```
$ git init … && git commit --allow-empty && mstack setup
$ mstack state add --slug storage-layer --title "Atomic JSON storage" --acceptance "load() returns [] when the file is absent"
added 1 storage-layer (pending)
$ mstack state set storage-layer --status done --force
1 storage-layer (done)
  status: "pending" -> "done"
$ mstack ledger record storage-layer $SHA live-verified --evidence ".mstack/progress/impl_storage-layer.md" --verifier implementer
recorded live-verified for storage-layer at ff3ac2d9
$ mstack ledger record storage-layer $SHA live-verified --evidence ".mstack/progress/impl_storage-layer.md" --verifier reviewer
recorded live-verified for storage-layer at ff3ac2d9
$ mstack gate
[fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)
        fix: a closing verdict needs evidence from the closing pass's own work, not a pointer to the implementer's report; re-run the check and record what actually happened
FAILED - 1 failure, 2 warnings
exit: 1
$ mstack ledger record storage-layer $SHA live-verified --evidence ".mstack/progress/review_storage-layer.md" --verifier reviewer
recorded live-verified for storage-layer at ff3ac2d9
$ mstack gate
[ok]    1 closed item(s) carry a ledger verdict
PASSED - 0 failures, 2 warnings
exit: 0
```

(The two warnings in both runs are the scratch repo's default branch and its untracked
`.mstack/`, unrelated to this check.)

**Scratch B — unsuperseded verifier-failed refused, then cleared by a later passing row:**

```
$ mstack ledger record storage-layer $SHA live-verified --evidence "ran the suite and the live probe myself" --verifier implementer
recorded live-verified for storage-layer at 2d870a00
$ mstack ledger record storage-layer $SHA verifier-failed --evidence "review found the fix incomplete" --verifier reviewer
recorded verifier-failed for storage-layer at 2d870a00
$ mstack gate
[fail]  items marked done whose most recent closing verdict is verifier-failed: storage-layer (reviewer)
        fix: the ledger is append-only, so the failed row stays; a later verdict from a closing role is what clears it — re-run the review after the fix and record a fresh one
FAILED - 1 failure, 2 warnings
exit before supersession: 1
$ mstack ledger record storage-layer $SHA test-verified --evidence "re-review after the fix: suite green" --verifier reviewer
recorded test-verified for storage-layer at 2d870a00
$ mstack gate
[ok]    1 closed item(s) carry a ledger verdict
PASSED - 0 failures, 2 warnings
exit after supersession: 0
```

## R to test

| Requirement | Test / proof | Where |
|---|---|---|
| Acceptance 1: done item whose only non-implementing row cites impl_<slug>.md is reported | "a closing row citing the implementer's own report does not close the item" (committed red, now green) + scratch A transcript | tests/gate.test.ts:568; transcript above |
| Acceptance 2: free-prose evidence unaffected, every real ledger row | `./bin/mstack gate` in repo root: `[ok] 18 closed item(s) carry a ledger verdict` | pasted output above |
| Acceptance 3: rung-5 refusal through the shipped CLI, both shapes, plus clearing | scratch A (forged citation, exit 1 → cleared exit 0) and scratch B (unsuperseded failure, exit 1 → superseded exit 0) | transcripts above |
| Acceptance 4: done item with unsuperseded verifier-failed from a non-implementing role refused | "an unsuperseded verifier-failed closing row does not close the item" (committed red, now green) + scratch B | tests/gate.test.ts:603 |
| Probe: `".mstack/progress/impl_<slug>.md"` in quotes → refused | gate probe loop + unit table | tests/gate.test.ts:646; tests/roles.test.ts:23 |
| Probe: `[impl_<slug>.md]` → refused | gate probe loop + unit table | tests/gate.test.ts:647; tests/roles.test.ts:24 |
| Probe: `impl_<slug>.md-round-2` → refused | gate probe loop + unit table | tests/gate.test.ts:648; tests/roles.test.ts:29 |
| Probe: `re-impl_<slug>.md` → allowed | gate probe loop + unit table | tests/gate.test.ts:652; tests/roles.test.ts:42 |
| Probe: `impl_<slug>.mdx` → allowed | gate probe loop + unit table | tests/gate.test.ts:653; tests/roles.test.ts:45 |
| Probe: `impl_<other-slug>.md` → allowed | gate probe loop + unit table | tests/gate.test.ts:654; tests/roles.test.ts:47 |
| Trailing prose: `.mstack/progress/impl_<slug>.md round-2 section` → refused | gate probe loop + unit table | tests/gate.test.ts:649; tests/roles.test.ts:20 |
| Spec-author's own report cited by a closing role → refused | "a closing row citing the spec-author's own report does not close the item" | tests/gate.test.ts:690 |
| Pass-then-fail: later failure retracts an earlier pass → refused | "a later verifier-failed closing row retracts an earlier pass" | tests/gate.test.ts:710 |
| Forged passing row after a genuine failure clears nothing | "a forged passing row cannot supersede a genuine failure" | tests/gate.test.ts:736 |
| Existing tests unweakened: /only verdict is verifier-failed/, self-closed, qualified role, done-without-proof, blocked, older SHA | all pass unmodified in the 283/283 runs | tests/gate.test.ts:172,198,220,769 |
| Fail-then-pass supersession | second half of the committed red test, now green | tests/gate.test.ts:626-634 |

Evidence ladder: every row above is rung 5 (live through `./bin/mstack` or through the real
suite on both runtimes) except the typecheck line, which is what it says it is.

## Noticed, not done

- The judge's holes 3-5 remain by design and are stated in the predicate's comment: free
  prose that never names the file passes (irreducible while `evidence` is free text);
  wrong-slug citation is invisible (out of scope, no existing check covers it); nothing
  stops `mstack ledger record` writing the forged shape — the audit refuses it later.
  Write-time refusal is a possible future item (candidate A's open question).
- The `forgedEvidence` message says "the implementer's own report" even when the cited
  report is the spec-author's (`spec_<slug>.md`). The message pair is fixed verbatim by the
  brief; if a real spec-forgery ever fires it, the wording could name the role.
- The `rows.every` branch is now reachable only when *every* row failed (as before), which
  keeps `/only verdict is verifier-failed/` pinning exactly that shape — the judge's
  criterion 6 reasoning for candidate A, confirmed in the green run.

## Round 2

Panel verdict CHANGES_REQUESTED (security, correctness, tests reports in
`.mstack/progress/review_closing-row-cites-own-report_{security,correctness,tests}.md`).
All eight consolidated changes implemented. Commits: `fix:` (src + tests, changes 1-4 and
6-8), `docs:` (wiki, change 5), then this report section + the re-recorded ledger row.

### Change map

| # | Change | Where | Proof |
|---|---|---|---|
| 1 | `i` flag on the citation regex | src/roles.ts:158 | Unit: tests/roles.test.ts:41 (`IMPL_STORAGE-LAYER.MD`), :42 (mixed case). Gate probe: tests/gate.test.ts:691. Rung 5 transcript below. |
| 2 | `\p{Cf}` strip before matching | src/roles.ts:153 | Cf category probe below. Unit: tests/roles.test.ts:45 (U+200B), :46 (U+FEFF + U+200D). Gate probe: tests/gate.test.ts:694. Rung 5 transcript below (printf trick). |
| 3 | Forged list split by kind; predicate returns matched role | src/roles.ts:152 (`string \| undefined`), src/gate.ts:368-369, :396-409, :441-452 | Committed red regex `/implementer's own report/` untouched (tests/gate.test.ts:588 unchanged); spec test now expects the truthful wording (tests/gate.test.ts:754); real spec-citing gate line pasted below. Both-kinds row lands on the implementer list (set order; comment at src/gate.ts:398-402), detail names only the verifiers whose rows cited that kind (correctness finding 4 folded in). |
| 4 | Multi-role supersession pinned | tests/gate.test.ts:651 | Mutation result below: verifier-scoped supersession fails exactly and only the new test. |
| 5 | Wiki refusal classes | docs/wiki/Gates-and-Hooks.md, "closed items to audit" bullet | Three new `[fail]`/`fix:` line pairs pasted from real `./bin/mstack gate` runs in scratch stores (transcript sources below); enumeration now covers all six refusal classes. |
| 6 | Residual comment | src/roles.ts:137-151 | Names case-insensitivity and Cf-stripping as closed, and homoglyphs, wrong-slug citations and free prose as the open residual; floor-not-proof framing kept; no evasion wording. |
| 7 | Detail strings pinned | tests/gate.test.ts:590-594, :630-634 | Asserts `storage-layer (reviewer)` appears in the failure text of both committed red tests; kills tests-report mutation (g). |
| 8 | Empty-suffix gate probe | tests/gate.test.ts:696 | `impl_storage-layer_.md` in the refused list; gate-level cover for mutation (c). |

### Cf category probe (required before relying on `\p{Cf}`)

```
$ node -e '...'
U+200B Cf? true
U+200C Cf? true
U+200D Cf? true
U+FEFF Cf? true
strip demo: .mstack/progress/impl_x.md
```

All four are category Cf, so the single `\p{Cf}` class covers the set; no explicit list
needed.

### Mutation result (change 4)

The tests report's verifier-scoped supersession mutation, applied to the round-2 tree
(the `latest` block at src/gate.ts:417 replaced by a per-verifier "failure not cleared by
a later same-verifier pass" scan, detail shape preserved so only the semantics move), then
`node --test tests/gate.test.ts tests/roles.test.ts`:

```
✖ a later pass from a different closing role supersedes a failure (170.777458ms)
ℹ pass 69
ℹ fail 1
```

Exactly and only the new test dies. Shipped code restored from backup;
`rg -n "const latest = legitimate" src/gate.ts` → 417, subset re-run: 70 pass, 0 fail.

### Rung-5 re-runs of the security transcripts (both now refused)

Upper-case citation (security finding 1), scratch store, shipped `./bin/mstack`:

```
$ mstack ledger record storage-layer $SHA live-verified --evidence ".mstack/progress/impl_storage-layer.md" --verifier implementer
recorded live-verified for storage-layer at f61b3f66
$ mstack ledger record storage-layer $SHA live-verified --evidence ".mstack/progress/IMPL_storage-layer.md" --verifier reviewer
recorded live-verified for storage-layer at f61b3f66
$ mstack gate
[fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)
        fix: a closing verdict needs evidence from the closing pass's own work, not a pointer to the implementer's report; re-run the check and record what actually happened
FAILED - 1 failure, 2 warnings
exit: 1
```

Zero-width citation (security finding 2), same printf trick as the security report:

```
$ EVIDENCE=$(printf '.mstack/progress/impl_storage-layer\xe2\x80\x8b.md')
$ mstack ledger record storage-layer $SHA live-verified --evidence "$EVIDENCE" --verifier reviewer
recorded live-verified for storage-layer at 2878ad8d
$ mstack gate
[fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)
        fix: a closing verdict needs evidence from the closing pass's own work, not a pointer to the implementer's report; re-run the check and record what actually happened
FAILED - 1 failure, 2 warnings
exit: 1
```

Spec-citing shape, generating the wiki's pasted line (correctness finding 1 fixed —
message now names the spec-author):

```
$ mstack ledger record storage-layer $SHA live-verified --evidence ".mstack/progress/spec_storage-layer.md" --verifier spec-reviewer
$ mstack gate
[fail]  items closed on a verdict whose evidence cites the spec-author's own report: storage-layer (spec-reviewer)
        fix: a closing verdict needs evidence from the closing pass's own work, not a pointer to the spec-author's report; re-run the check and record what actually happened
exit: 1
```

### Widened-predicate sweep over the real ledger

Changes 1-2 widen what the predicate matches, so the round-1 differential was re-run with
the shipped module over every row of `.mstack/ledger.tsv`:

```
total rows: 52
rows citing an implementing report (widened predicate: i-flag + Cf strip): 22
of which from a closing role (would trip the gate): 0
```

Same 22 rows as before widening — all `--verifier implementer` — so the widening changes
nothing on real history. The live gate agrees (below): 18 done items green.

### Verification (round 2)

`npm test`:

```
bun test v1.3.11 (af24e281)
 284 pass
 0 fail
Ran 284 tests across 16 files. [43.97s]
ℹ tests 284
ℹ suites 0
ℹ pass 284
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 19480.039416
```

`npm run typecheck`:

```
> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit

typecheck exit: 0
```

`./bin/mstack lint-plugin .` (tail):

```
[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings
```

`./bin/mstack gate` at the repo root (closed-items line and summary):

```
[ok]    18 closed item(s) carry a ledger verdict
PASSED - 0 failures, 1 warning
```

(The warning is the mid-session uncommitted tree, as in round 1.)

### Noticed, not done (round 2)

- Correctness finding 5 (the unsuperseded-failure message on the forged-supersession shape
  does not mention the forged row) was not in the consolidated list and is unchanged; the
  refusal itself is pinned at tests/gate.test.ts:786.
- The Cyrillic-homoglyph probe from the security report remains open by design and is now
  named in the predicate's comment (change 6) rather than left unstated.
- The design-record erratum (candidate A citing docs-for-newcomers as multi-role
  supersession when its rows are all `orchestrator`) is the coordinator's to record at
  close; the behaviour itself is now pinned by the change-4 test.
