# Review - closing-row-cites-own-report (lens: correctness and requirement coverage)

**Verdict:** CHANGES_REQUESTED

The two reproduced holes are genuinely closed. I re-derived every acceptance bullet at rung 5
myself, against the old CLI and the new one, and both forged shapes flip from green to refused.
Nothing is weakened, nothing is uncovered. What blocks approval is narrower and is the exact
thing this brief asked me to check: one of the two new gate messages states a fact that is false
on a shape the diff itself ships a test for, and a shipped test pins the false wording.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| Hole A: closing row citing `impl_<slug>.md` refused | `tests/gate.test.ts:568` (committed red at b27240e) | Red at b27240e: `expected a failure, got a pass`. Green at HEAD. Fails again when `src/gate.ts` alone is reverted to 3c7e883. |
| Hole A: spec-author's report is the same artifact | `tests/gate.test.ts:690` | Green; red on reverted gate.ts. Also live at rung 5 (see findings - the message it asserts is wrong). |
| Hole B: unsuperseded `verifier-failed` refused | `tests/gate.test.ts:603` (committed red at b27240e) | Red at b27240e: `closed on the reviewer's failure: expected a failure, got a pass`. Green at HEAD. |
| Hole B: pass-then-fail retracts | `tests/gate.test.ts:710` | Green; red on reverted gate.ts. |
| Forged row excluded from ordering in both directions | `tests/gate.test.ts:736` | Green; red on reverted gate.ts. Reproduced live below. |
| Citation boundary contract (decisions.tsv, 2026-08-22T16:14:07.640Z) | `tests/gate.test.ts:640` (7 shapes through the gate) + `tests/roles.test.ts:12` (23 strings direct) | Green on both runtimes; roles.test.ts fails to even import on reverted roles.ts. I ran 29 further probes of my own, 0 unexpected. |
| Fail-then-pass supersession | `tests/gate.test.ts:626-634` | Green; reproduced live. |
| Existing green tests unchanged | `git diff b27240e HEAD -- tests/` has zero deletion lines | No test text was altered to obtain green. |

## Acceptance, quoted

**"A done item whose only non-implementing row cites impl_<slug>.md as its evidence is reported by mstack gate"**

Met. Rung 5, in a scratch store I built (`scratchpad/pre_forged`), driven end to end through
`/Users/romerma/Code/mstack/bin/mstack`: `mstack setup`, one item forced to `done`, one row
`--verdict live-verified --evidence ".mstack/progress/impl_storage-layer.md" --verifier reviewer`
and nothing else.

```
=== forged : OLD CLI (3c7e883) ===
[ok]    1 closed item(s) carry a ledger verdict
PASSED - 0 failures, 2 warnings
=== forged : NEW CLI (HEAD) ===
[fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)
FAILED - 1 failure, 2 warnings
```

Same store, same ledger, two binaries. Exit 1 on the new one. Code path: `src/gate.ts:392-396`.

**"Evidence that is free prose rather than a path is unaffected, proven against every row currently in this repo's ledger"**

Met. Two independent proofs, both mine.

Live gate at the repo root (`./bin/mstack gate`, exit 0):

```
[ok]    18 closed item(s) carry a ledger verdict
[ok]    one active item: closing-row-cites-own-report (reviewing)
PASSED - 0 failures, 1 warning
```

(The one warning is `6 uncommitted change(s); expected mid-session` - the gate's own wording.)

Predicate traced over every row of the real `.mstack/ledger.tsv` by importing `src/roles.ts`
directly (`scratchpad/trace.ts`):

```
total rows: 53
done items: 18
rows whose evidence contains an impl_*.md path: 22
  their verifier column values: ["implementer"]
rows where citesImplementingReport(evidence, target) === true: 22
  of those, rows with a CLOSING verifier (would trip the gate): 0
free-prose rows (no .md anywhere): 9 -> any match? false
rows citing a review_*.md: 22 -> any match? false
rows citing a spec_*.md: 0 -> matching: []
```

All 22 impl-citing rows are `--verifier implementer`, so `canCloseAnItem` (`src/roles.ts:103`)
discards them before the new predicate is consulted. Zero closing-role rows match. The judge
report counted 21; item 18's own implementer row makes 22 - the count moved, the conclusion
did not.

**"The check is proven at rung 5 by a row that passes today and is refused after"**

Met, both halves, by me.

Refused-after: the transcript under bullet 1, plus the clearing half in the same store -
appending `--evidence ".mstack/progress/review_storage-layer.md" --verifier reviewer` yields
`[ok]    1 closed item(s) carry a ledger verdict / PASSED - 0 failures, 2 warnings`. The forged
row stays in the append-only ledger and simply stops being the only candidate, exactly as the
design says.

Passes-today: I did not take this on the implementer's word or on the pre-fix session log. I
cloned the repo to `scratchpad/redcheck`, checked out **3c7e883** (pre-fix), and ran that
checkout's own `bin/mstack` against the same scratch store - output above, `PASSED`. I also
confirmed the committed red tests really were red at b27240e:

```
✖ a closing row citing the implementer's own report does not close the item (268.546584ms)
  AssertionError: self-citing close: expected a failure, got a pass
✖ an unsuperseded verifier-failed closing row does not close the item (274.598583ms)
  AssertionError: closed on the reviewer's failure: expected a failure, got a pass
```

And that the coverage is not free-riding: with `src/gate.ts` alone reverted to 3c7e883 and
everything else at HEAD, all six new gate tests fail and the other 62 still pass -

```
✖ a closing row citing the implementer's own report does not close the item
✖ an unsuperseded verifier-failed closing row does not close the item
✖ a citation is the exact report filename as a whole token, however punctuated
✖ a closing row citing the spec-author's own report does not close the item
✖ a later verifier-failed closing row retracts an earlier pass
✖ a forged passing row cannot supersede a genuine failure
ℹ pass 62
ℹ fail 6
```

With `src/roles.ts` reverted instead, `tests/roles.test.ts` fails at import:
`SyntaxError: The requested module '../src/roles.ts' does not provide an export named 'citesImplementingReport'`.

**"A done item carrying an unsuperseded verifier-failed row from a non-implementing role is refused by mstack gate; today that row is what satisfies the no-self-approval audit and flips the gate green"**

Met, both the refusal and the clearing, at rung 5 in `scratchpad/pre_failed` and
`scratchpad/store4`. Rows: implementer `live-verified` citing the impl report, then reviewer
`verifier-failed` with free-prose evidence.

```
=== failed : OLD CLI (3c7e883) ===
[ok]    1 closed item(s) carry a ledger verdict
PASSED - 0 failures, 2 warnings
=== failed : NEW CLI (HEAD) ===
[fail]  items marked done whose most recent closing verdict is verifier-failed: storage-layer (reviewer)
FAILED - 1 failure, 2 warnings
```

Clearing, same store, one appended row (`test-verified`, `--verifier reviewer`):

```
recorded test-verified for storage-layer at 694aca8d
[ok]    1 closed item(s) carry a ledger verdict
PASSED - 0 failures, 2 warnings
```

Code path: `src/gate.ts:403-406`.

## Verification I ran

`./bin/mstack gate --full` - exit 0. Both runtimes inside it:

```
bun test v1.3.11 (af24e281)
 283 pass
 0 fail
Ran 283 tests across 16 files. [66.64s]

ℹ tests 283
ℹ pass 283
ℹ fail 0
ℹ duration_ms 29209.508583

> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit

PASSED - 0 failures, 0 warnings          <- lint-plugin
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .

PASSED - 0 failures, 1 warning           <- gate --full
EXIT=0
```

`bun test tests/` standalone: `283 pass / 0 fail / Ran 283 tests across 16 files. [58.49s]`.
`npm run typecheck` standalone: clean, no diagnostics.
`bun test tests/roles.test.ts` -> `1 pass`; `node --test tests/roles.test.ts` -> `ℹ pass 1`.
The new file runs on both runtimes.

`./bin/mstack ledger check closing-row-cites-own-report` at head `dfa78f09`:

```
FAIL no verdict at dfa78f09; 1 row(s) exist at other SHAs and a new head SHA voids them
EXIT=1
```

The item's only ledger row sits at `b16aa45`, and the docs commit `dfa78f0` moved head. See
finding 6.

### Edge semantics I re-derived live (rung 5, scratch stores)

| Shape | Gate says | As designed |
|---|---|---|
| fail-then-blocked | `[ok] 1 closed item(s) carry a ledger verdict` | yes (`verifier-blocked` is not `verifier-failed`) |
| pass-then-fail | `[fail] ... most recent closing verdict is verifier-failed: storage-layer (reviewer)` | yes |
| multi-role supersession (reviewer fails, orchestrator passes) | `[ok] ...` | yes, identity-agnostic |
| plugin-qualified forger `mstack:reviewer` citing impl report | `[fail] ... cites the implementer's own report: storage-layer (mstack:reviewer)` | yes |
| SHA ignored: forged row at an older SHA after head moved | `[fail] ... cites the implementer's own report` | yes |
| every row `verifier-failed` (retained branch) | `[fail] items marked done whose only verdict is verifier-failed: storage-layer` | yes, and literally true |
| implementer-only rows | `[fail] items closed on a verdict from the pass that wrote the code: storage-layer (only implementer)` | unchanged, so `README.md:149` and the wiki's pasted output stay byte-identical |
| forged passing row appended after a genuine failure | `[fail] ... most recent closing verdict is verifier-failed` | refuses, but see finding 4 |

### Predicate probes I wrote myself (29 strings, 0 unexpected)

Beyond the 23 the unit table pins, I probed: `impl_x.md.`, `impl_x.md)`, `impl_x.md#tests`,
`impl_x.md|passed`, `impl_x.md.mdx`, `x.impl_x.md`, `9impl_x.md`, `progress\impl_x.md`,
`../progress/impl_x.md`, `spec_review_x.md`, `impl_x .md`, `impl_x.mdx impl_x.md`, and the
three case variants. Every one matched the contract decided in `.mstack/decisions.tsv`
(2026-08-22T16:14:07.640Z). The regex at `src/roles.ts:141` is character-for-character the
decided one.

### Checked and clean

- **Design fidelity.** The shipped loop is candidate A's six steps in exactly the decided
  order (`src/gate.ts:370-407`), the five report blocks in the decided order
  (`src/gate.ts:409-438`), and the `report.ok` guard widened to all five lists
  (`src/gate.ts:439-447`). Judge grafts 1-4 all present: boundary class, no `escapedSlug`
  with the checked SLUG reason, `(verifiers)` detail style, continue-per-outcome loop. The
  `IMPLEMENTING_ROLES` loop covers `spec-author` (`src/roles.ts:137-143`).
- **The "Also do" bullets.** No bypass-teaching prose survived: I grepped the diff for
  candidate A's Trade-offs wording and it appears nowhere in `src/`, comments included. The
  residual is stated honestly at `src/roles.ts:131-134`, in the same register as
  `canCloseAnItem`'s comment at `src/roles.ts:96-99`, as the judge asked.
- **The no-escaping justification, verified rather than assumed.** `SLUG`
  (`src/state.ts:49`) is enforced at `src/state.ts:143` on every item that reaches
  `parseState`. I confirmed at rung 5 that a hand-edited scratch `state.json` with slug
  `a.*(b` never reaches `new RegExp` - the parse refuses it first:
  `[fail] ... .items[0].slug must be kebab-case, got "a.*(b"`. No ReDoS or mis-match surface.
- **Ordering assumption.** `entries()` (`src/ledger.ts:101-112`) applies no sort, so file
  order is preserved and `filter` keeps it. The `latest` comment at `src/gate.ts:397-402` is
  accurate.
- **`noUncheckedIndexedAccess`.** The `!` at `src/gate.ts:403` is required and matches the
  existing precedent at `src/gate.ts:286`.
- **Debug leftovers, dead code, layering.** None. No `console.log`, no TODO, no unused
  binding. The naming contract stayed in `src/roles.ts`; `src/gate.ts` learned nothing about
  `<kind>_<slug>`.
- **Tests weakened to obtain green.** No. `git diff b27240e HEAD -- tests/` contains zero
  deletion lines.

## Changes required

1. **`src/gate.ts:429` and `src/gate.ts:430`** - the message and remedy say "the implementer's
   own report" and "a pointer to the implementer's report", but the check also fires on the
   spec-author's `spec_<slug>.md`, which no implementer wrote. Reproduced at rung 5 in
   `scratchpad/store_spec` - one row, `--evidence ".mstack/progress/spec_storage-layer.md"
   --verifier spec-reviewer`:

   ```
   [fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (spec-reviewer)
           fix: a closing verdict needs evidence from the closing pass's own work, not a pointer to the implementer's report; re-run the check and record what actually happened
   ```

   There is no implementer report in that ledger. The detail string `(spec-reviewer)` names
   the verifier, not the offending path, so nothing in the output points at the spec file
   either - a maintainer is told to go look for something that does not exist.

   This is not a stylistic nit here. `design_closing-row-cites-own-report_judge.md:120` and
   `:137-140` made "a gate that states the fact vs. a gate that states a nearby falsehood on
   the shape it just caught" *the* deciding criterion for basing on candidate A over B, and
   the repo has already spent a test on the principle (`tests/gate.test.ts:263-276`).
   Candidate A's message text was written before the spec arm was reasoned about; being
   faithful to it here reproduces the defect A was chosen to avoid. The implementer names
   this at `impl_closing-row-cites-own-report.md:221-223` and declines on the grounds that
   "the message pair is fixed verbatim by the brief" - but my brief says the design is an
   input, not gospel, and this is the case where that matters.

   Fix: widen both strings to cover both implementing roles - e.g. message `items closed on a
   verdict whose evidence cites an implementing pass's own report`, remedy `... not a pointer
   to a report written by the pass that did the work; ...`. Keep the `(verifiers)` detail
   shape (graft 3).

2. **`tests/gate.test.ts:704`** - `expectFail(gate(sb), /implementer's own report/, "spec-citing
   close")` pins the wording that finding 1 says is false, on the very row that proves it
   false. Update the regex alongside the message so the test asserts the accurate sentence.
   `tests/roles.test.ts:38-39` (the two `spec_storage-layer.md` cases) is fine as is - the
   predicate is right; only the sentence the gate prints is wrong.

3. **`docs/wiki/Gates-and-Hooks.md:203-207`** - the wiki's enumeration of the closed-items
   audit lists exactly three refusals ("no verdict for it", "its only verdict is
   `verifier-failed`", "every verdict it has came from the pass that wrote the code"). Two new
   refusals now ship and neither appears anywhere in `docs/`. A maintainer who hits either
   message has no documentation to land on. `CONTRIBUTING.md:57-58` requires pasted output
   from real runs, so the two lines want a real `./bin/mstack gate` transcript - the scratch
   transcripts above are reusable. `README.md:149`, `docs/wiki/Getting-Started.md:238,255` and
   `docs/wiki/The-Agents.md:73,88` need no change: I verified the `(only implementer)` output
   is byte-identical after the diff.

## Findings that do not block, ordered by severity

4. **`src/gate.ts:394`** - the `forgedEvidence` detail is built from `closingRows`, not from
   the citing subset. Correct today only because the branch is guarded by
   `legitimate.length === 0`, which makes the two sets identical. It reads as if it were
   deliberate breadth, and any future edit that fires this list in a partial case would name
   verifiers whose rows were clean. `closingRows.filter((e) => citesImplementingReport(e.evidence, item.slug))`
   costs one call and is self-evidently right.

5. **`src/gate.ts:435`, and the silence beside it** - on the "forged passing row cannot
   supersede a genuine failure" shape, the ledger's last closing-role row is a *passing* one
   and the gate says "most recent closing verdict is verifier-failed". Defensible (a forged
   row is not a closing verdict) but confusing against the ledger a maintainer will open.
   Worse, `forgedEvidence` stays silent in that shape, so the output never mentions the forged
   row at all. Reproduced at rung 5 in `scratchpad/store_fs`:

   ```
   2026-08-22T16:40:18.129Z  storage-layer  e5536338  live-verified    .mstack/progress/impl_storage-layer.md
   2026-08-22T16:40:18.415Z  storage-layer  e5536338  verifier-failed  review found the fix incomplete
   2026-08-22T16:40:18.659Z  storage-layer  e5536338  live-verified    .mstack/progress/impl_storage-layer.md
   [fail]  items marked done whose most recent closing verdict is verifier-failed: storage-layer (reviewer)
   ```

   The refusal is right; only the diagnosis is partial. Either say "most recent *legitimate*
   closing verdict", or let a forged row be reported even when a legitimate one exists.

6. **Ledger, not code** - `./bin/mstack ledger check closing-row-cites-own-report` is red at
   head `dfa78f09` (`no verdict at dfa78f09; 1 row(s) exist at other SHAs`). The implementer's
   row is at `b16aa45`; commit `dfa78f0` voided it. Per the panel protocol I recorded no row.
   The coordinator needs the synthesized verdict recorded at whatever SHA is head when the
   panel lands, and the implementer's row will need re-recording too.

7. **`src/roles.ts:141`, note only** - the predicate is case-sensitive while `canCloseAnItem`
   (`src/roles.ts:104`) lowercases its input. `IMPL_STORAGE-LAYER.MD` is not a citation, though
   on a case-insensitive filesystem it names the same file. This sits in the same class as the
   disclosed free-prose residual and I would not spend code on it; one clause in the comment at
   `src/roles.ts:131-134` would make it a stated residual rather than an unstated one.

## Evidence ladder

Acceptance 1, 3 and 4: **rung 5** - the shipped `./bin/mstack` driven against scratch stores I
built, and against the pre-fix checkout's own binary for the passes-today half. Acceptance 2:
**rung 5** for the repo-root gate run, **rung 4** for the ledger trace (real module, real
ledger file, my own driver). Edge-semantics table: **rung 5**. Predicate probes: **rung 4**.
Design-fidelity, ordering, `noUncheckedIndexedAccess` and dead-code checks: **rung 1**, read
against the diff - and I say so rather than dressing them up. The SLUG no-escaping
justification I took from rung 1 to **rung 5** by driving a metacharacter slug through the CLI
rather than trusting the comment.
