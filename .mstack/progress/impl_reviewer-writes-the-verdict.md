# Implementation - reviewer-writes-the-verdict (item 15)

## What changed

The reviewer is now told to type its own ledger row. `agents/reviewer.md` gained a
`## Record it` section (lines 69-93, a pure insertion between the report format and the
return line; frontmatter untouched) giving the exact `mstack ledger record ... --verifier
reviewer` command, a fixed three-way verdict mapping, and a lens carve-out. The mapping:
APPROVED records the rung the verification run actually reached (`live-verified` /
`test-verified` / `type-check-only`); CHANGES_REQUESTED records `verifier-failed` even on a
green suite, because the check that ran is the review and the item failed it, and rank-0
mechanically blocks a close, which is what the verdict means; a verification that could not
run at all records `verifier-blocked`. A lens reviewer records nothing, because
`src/ledger.ts` keeps the best row per `(target, sha)` by RANK, so N lens rows would
collapse to the panel's most favorable member while a split panel means its least favorable.
`skills/review/SKILL.md` gained step 9 (lines 39-51) carrying the same rule from the
coordinator's side: one row per round, the lone reviewer has already recorded it (confirm
with `ledger check`, do not type a second one on its behalf), and after a panel the
synthesizing pass records the one synthesized row under its own role name, never as
`reviewer`. `skills/verify/SKILL.md:17` and `skills/ship/SKILL.md:31` were checked and left
alone: their generic `--verifier <role>` / `--verifier <who ran it>` wording agrees with the
new rule that whoever types the row signs it. README.md:100-102 and
docs/wiki/Getting-Started.md:233-249 already narrate the reviewer recording its own row, so
the documents that name who records agree. (Narrowed in round 2: this claim was too broad as
first written. The evidence ladder's verdict table still disagreed on which verdict a
green-suite rejection records, review finding 4; reconciled in the round-2 section below.) Both decisions are in `decisions.tsv` under phase
`item-15`. Deliberately untouched, per the item's scope: `agents/implementer.md:45`,
`src/roles.ts`, `src/gate.ts`, all agent frontmatter.

No test was added. The change is prose in an agent file and a skill file; the only
executable claims are that `lint-plugin` still passes and the suite is still green, and
inventing a test that cannot fail is the anti-pattern this refinement round exists to
remove. That honesty is itself part of the item's scope statement.

## Files

- `agents/reviewer.md` - new `## Record it` section, lines 69-93 (+25, insertion only)
- `skills/review/SKILL.md` - new step 9, lines 39-51 (+13, insertion only)
- `.mstack/progress/current.md` - session log
- `.mstack/decisions.tsv` - two decisions, phase `item-15`
- `.mstack/progress/impl_reviewer-writes-the-verdict.md` - this report

## Commands

```
$ npm test
(bun)  258 pass, 0 fail, 616 expect() calls, exit 0
(node) tests 258 / pass 258 / fail 0 / cancelled 0 / skipped 0 / todo 0
exit=0

$ npm run typecheck
> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit
typecheck exit=0

$ ./bin/mstack lint-plugin .
-- references
[ok]    20 reference file(s), every relative link resolves
-- shipped commands
[ok]    32 file(s), no command that would hang on stdin
-- cross-references
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves
-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts
PASSED - 0 failures, 0 warnings

$ ./bin/mstack gate
PASSED - 0 failures, 1 warning
(the warning is the expected mid-session uncommitted-changes one)

$ git diff -U0 -- agents/reviewer.md skills/review/SKILL.md | rg "^@@"
@@ -68,0 +69,25 @@ feeling.
@@ -38,0 +39,13 @@ The reviewer did not write the code. If that is not true, stop: ...
```

## Acceptance to evidence

This is a direct-path, prose-shaped item; where no test can fail, the row says what was run
instead and where the claim stopped on the ladder.

| Acceptance bullet | Evidence | Where | Rung |
|---|---|---|---|
| reviewer.md instructs the reviewer to record its own row, verifier from its own role | The wording itself: exact command with `--verifier reviewer`, "The verifier column is your own role" | `agents/reviewer.md:69-93` | 3 (read back end to end; no test can fail on prose) |
| Consistent with review/ship/verify skills, no two documents conflict on who records | `skills/review/SKILL.md:39-51` says the lone reviewer already recorded and forbids a second row on its behalf; `skills/verify/SKILL.md:17` and `skills/ship/SKILL.md:31` stay generic and agree; `rg -n "ledger record"` sweep of README.md and docs/wiki found the walkthroughs already narrate the reviewer recording its own row | `skills/review/SKILL.md:39-51`, `README.md:100-102`, `docs/wiki/Getting-Started.md:233-249` | 3 |
| Write-less reviewer can record is established by evidence, not assumed | Rung-5 probe run earlier this session: a real `mstack:reviewer` (tools `Read, Glob, Grep, Bash`) wrote its report via Bash heredoc and its row via the CLI. Row on disk: `greet-name / e382833... / test-verified / .mstack/progress/review_greet-name.md / reviewer` | scratch store `r15probe/.mstack/ledger.tsv` (scratchpad, preserved unmodified) | 5 |
| lint-plugin passes, frontmatter contract unchanged | `./bin/mstack lint-plugin .` exits 0 with 0 failures 0 warnings at this head; `git diff -U0` shows both edits are insertions at lines 69/39, first frontmatter block untouched | output above | 4 |

Both suites (`bun test`, `node --test`) pass 258/258 at this head, which proves the change
broke nothing; it does not prove the wording, and no row above claims it does.

## The new agents/reviewer.md wording, verbatim

> ## Record it
>
> Reviewing alone, you type your own ledger row, through Bash, once the report exists:
>
> `mstack ledger record <slug> "$(git rev-parse HEAD)" <verdict> --evidence <the report path you wrote> --verifier reviewer`
>
> The verifier column is your own role. Nobody types this row on your behalf: a row
> ghost-written by the coordinating pass is prose separation with no typed artifact behind it,
> which is the exact failure the column exists to catch. The verdict maps from what actually
> happened, not from the tone of the report:
>
> - **APPROVED** records the rung your verification run reached: `live-verified`,
>   `test-verified`, or `type-check-only`. Never a rung above what you ran.
> - **CHANGES_REQUESTED** records `verifier-failed`, even when the suite was green. The check
>   that ran is the review, and the item failed it; a green suite next to an uncovered
>   requirement is a failed verification, not a pass with a footnote. `verifier-failed` clears
>   nothing and blocks a close, which is exactly what your verdict means.
> - **A verification you could not run at all** records `verifier-blocked`, whatever you
>   thought of the diff. An opinion formed without running anything must not read as evidence.
>
> Given a lens, skip this step: write your report and record nothing. The ledger keeps the best
> row per `(target, sha)` by rank, so N lens rows would collapse to the panel's most favorable
> member, and a split panel means the opposite. The pass that synthesizes the panel's verdict
> records the one row, under its own name.

And the new skills/review/SKILL.md step, verbatim:

> 9. One ledger row per review round, typed by the pass that formed the verdict it carries:
>    - A lone `mstack:reviewer` records its own row (`--verifier reviewer`) before returning.
>      Confirm the row exists with `mstack ledger check <slug>`; do not type a second one on
>      its behalf.
>    - After a panel, the lenses have recorded nothing, so record the synthesized verdict
>      yourself: `mstack ledger record <slug> "$(git rev-parse HEAD)" <verdict> --evidence
>      <the lens reports> --verifier <your own role, never reviewer>`. One row, not one per
>      lens: the ledger keeps the best row per `(target, sha)`, and a split panel means its
>      worst lens, not its best.
>
>    Either way the mapping is fixed: `APPROVED` records the rung the verification reached,
>    `CHANGES_REQUESTED` records `verifier-failed`, and a verification nobody could run
>    records `verifier-blocked`.

---

# Round 2

Review verdict on round 1: CHANGES_REQUESTED
(`.mstack/progress/review_reviewer-writes-the-verdict.md`). All four acceptance bullets were
judged met; the rejection is on the diff. Four findings, four fixes, all landed on
`fix/reviewer-writes-the-verdict`. `src/gate.ts` untouched, per the brief: making the struck
promise true is now acceptance bullet 4 on item 18 `closing-row-cites-own-report`.

## Finding to fix

| Finding | Fix | Where |
|---|---|---|
| 1 (blocking): "`verifier-failed` clears nothing and blocks a close" is false; with the implementer's row already at the sha, the reviewer's rejection is what satisfies the no-self-approval audit (`src/gate.ts:371` fires only on `every`, `:373` needs only `rows.some(canCloseAnItem)`; proven live twice, probe revF) | The claim is struck, not hedged. The bullet now states what is true: the row records the rejection with the report as its evidence, it does not by itself block anything, and what keeps the item open is that a rejected item does not move past `reviewing` | `agents/reviewer.md:87-91` |
| 2 (blocking): `skills/review/SKILL.md` mapping paragraph must move with finding 1 or the documents drift | The same true statement appended to the mapping paragraph, in the same terms | `skills/review/SKILL.md:52-54` |
| 3 (blocking): "Given a lens, skip this step" makes lensing a guess, and the wrong guesses are asymmetric (N rows collapse to the most favorable and close over a rejection; the reverse deadlocks with no remedy) | Lensing is now the observable test the reviewer already used to pick its filename: lensed iff the handed report path carries the `review_<slug>_<lens>.md` suffix. The alone branch opens "Handed `review_<slug>.md`"; the lens branch opens "Handed a lens suffix". And the review skill's no-row case gained its remedy: re-run the reviewer, do not type the row on its behalf | `agents/reviewer.md:71-76,95-98`; `skills/review/SKILL.md:41-43` |
| 4 (now required): the ladder maps "Ran it and it failed" to `verifier-failed` while reviewer.md says record it "even when the suite was green"; a reviewer looking up "green suite, uncovered requirement" got two answers | Reconciled in the ladder, which now says the check in its last two table rows is the whole claim under judgement, not the suite that ran inside it. Changed the ladder rather than reviewer.md because the other direction, recording the suite's rung on a rejection, places a close-enabling reviewer row at the sha of a rejected implementation, which is finding 1's mechanism made live on every rejection. Decision recorded in `decisions.tsv`, phase `item-15` | `skills/router/references/evidence-ladder.md:43-45` |
| Also required: `impl_...md:24` "no document now contradicts another" was broader than established, finding 4 the counterexample | Narrowed in place to "the documents that name who records agree", with a pointer here | this file, What changed |

Out of scope, already filed, not chased: the row going stale on the commit that carries it
(item 19), the stale plugin cache governing which agent file actually loads (item 17
bullet 5).

## The changed wording, verbatim

`agents/reviewer.md`, the reworked parts of `## Record it`:

> Whether you record is not a judgement call, and you do not infer it from the phrasing of your
> brief: you were given a lens iff the report path you were handed carries a lens suffix,
> `review_<slug>_<lens>.md`. That is the same signal that chose your filename above.
>
> Handed `review_<slug>.md`, you are reviewing alone: type your own ledger row, through Bash,
> once the report exists:

> - **CHANGES_REQUESTED** records `verifier-failed`, even when the suite was green. The check
>   that ran is the review, and the item failed it; a green suite next to an uncovered
>   requirement is a failed verification, not a pass with a footnote. The row records the
>   rejection with your report as its evidence; it does not by itself block anything. What
>   keeps the item open is that a rejected item does not move past `reviewing`.

> Handed a lens suffix, write your report and record nothing. The ledger keeps the best row
> per `(target, sha)` by rank, so N lens rows would collapse to the panel's most favorable
> member, and a split panel means the opposite. The pass that synthesizes the panel's verdict
> records the one row, under its own name.

`skills/review/SKILL.md`, the reworked parts of step 9:

>    - A lone `mstack:reviewer` records its own row (`--verifier reviewer`) before returning.
>      Confirm the row exists with `mstack ledger check <slug>`. If no row exists, the
>      reviewer did not finish its contract: re-run the reviewer, and do not type the row on
>      its behalf.

>    Either way the mapping is fixed: `APPROVED` records the rung the verification reached,
>    `CHANGES_REQUESTED` records `verifier-failed`, and a verification nobody could run
>    records `verifier-blocked`. A `verifier-failed` row records the rejection with the report
>    as its evidence; what keeps a rejected item open is that it does not move past
>    `reviewing`.

`skills/router/references/evidence-ladder.md`, inserted directly under the mapping table:

> The check in the last two rows is the whole claim you were asked to judge, not the suite that
> ran inside it. A reviewer whose suite was green but whose review found a blocking defect ran
> the check and the check failed: that records `verifier-failed`, never the suite's rung.

## Commands, round 2

```
$ npm test
(bun)  258 pass, 0 fail
(node) tests 258 / pass 258 / fail 0
npm test exit=0

$ npm run typecheck
typecheck exit=0

$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings

$ git diff -U1 -- agents/reviewer.md skills/review/SKILL.md skills/router/references/evidence-ladder.md
(three files, insertions and the struck sentence only; frontmatter untouched, single first
hunk in agents/reviewer.md starts at line 70, inside the round-1 section)
```

## Where round 2 stopped on the ladder

Findings 1-4 are wording fixes; the mechanical facts behind them were established at rung 5
by the review's probes (revC, revD, revF), which I did not re-derive. The fixes themselves
are prose: rung 3 by read-back (a reviewer now decides lensing from the path it was handed,
records the mapped verdict, and no document promises the row blocks anything), rung 4 for
`lint-plugin`, both suites, and the gate at this head. As in round 1, no test can fail on
this wording and none was invented.

---

# Round 3

Review verdict on round 2: CHANGES_REQUESTED
(`.mstack/progress/review_reviewer-writes-the-verdict_r2.md`). Round-1 findings 2 and 4 are
done; both round-3 findings are in the paragraph round 2 rewrote. `src/gate.ts` and
`src/lifecycle.ts` untouched: making a rejection mechanically hold is item 18 bullet 4,
recorded as this round's `item-15` decision row by the coordinator.

## Finding 1: the replacement clause was a second false promise

"What keeps the item open is that a rejected item does not move past `reviewing`" named a
mechanism that does not exist: `src/lifecycle.ts:90` allows `reviewing -> verifying`
unconditionally and `canTransition` never reads the ledger, proven live by two independent
passes. The fix strikes the causal clause and writes no third one. What remains is only what
both passes verified: the row is the typed record of the rejection, carrying the report as
its evidence, and it is not itself a gate. The same clause is struck from
`skills/review/SKILL.md` so the two documents move together, per round-1 finding 2.

`agents/reviewer.md:92-95`, verbatim:

> - **CHANGES_REQUESTED** records `verifier-failed`, even when the suite was green. The check
>   that ran is the review, and the item failed it; a green suite next to an uncovered
>   requirement is a failed verification, not a pass with a footnote. The row is the typed
>   record of your rejection, carrying your report as its evidence; it is not itself a gate.

`skills/review/SKILL.md:50-53`, verbatim (the reworked tail of the mapping paragraph):

>    records `verifier-blocked`. A `verifier-failed` row is the typed record of the rejection,
>    carrying the report as its evidence; it is not itself a gate.

## Finding 2: the path-suffix rule misread rounds as lenses

Round 2's rule made any suffix mean "lens", which would have suppressed
`review_verification-never-runs_r4.md`'s row, the only reviewer-typed closing row in this
repo's history, and looped a solo round-2 reviewer against the review skill's re-run remedy.

**Rule chosen: shape, with `_r<digits>` reserved as a round marker.** Strip `review_<slug>`
and `.md` from the handed path; a leading `r<digits>` in the remainder is a round marker,
never a lens. Empty remainder or a bare round marker: solo, records. Anything else, bare
(`_correctness`) or composed (`_r2-facts`): a panel lens, records nothing.

Why this one: it keeps the property that made the round-2 fix right, the signal is observable
from artifacts the reviewer already holds, its handed path and the slug it is reviewing. The
failure mode of the other candidate, "record unless your brief named you one of several
fanout workers", is that membership is not observable from the handed path at all: it has to
be restated in the brief and trusted, which is the brief-tone inference round-1 finding 3
removed, and it is undefined for a solo reviewer launched by the orchestrator's dispatch
table, which is exactly the path that must record. Residual of the chosen rule, stated in the
decision row: a lens deliberately named `r<digits>` or `r<digits>-x` would misparse, so that
shape is reserved and lenses are named with words.

The rule, executed over every `review_*` name in `.mstack/progress` (23 files, script in the
session transcript, regenerated for this table):

| File | Suffix | Classification | Ledger row |
|---|---|---|---|
| `review_decision-required-gate_adversarial.md` | `_adversarial` | lens adversarial | records nothing |
| `review_decision-required-gate_correctness.md` | `_correctness` | lens correctness | records nothing |
| `review_editable-item-fields.md` | `(none)` | solo, round 1 | records |
| `review_editable-item-fields_r2.md` | `_r2` | solo, round 2 | records |
| `review_panel-followup-prose_facts.md` | `_facts` | lens facts | records nothing |
| `review_quiet-gate-prints-nothing.md` | `(none)` | solo, round 1 | records |
| `review_quiet-gate-prints-nothing_r2.md` | `_r2` | solo, round 2 | records |
| `review_readme-and-wiki_facts.md` | `_facts` | lens facts | records nothing |
| `review_readme-and-wiki_r2-facts.md` | `_r2-facts` | round 2, lens facts | records nothing |
| `review_readme-and-wiki_reader.md` | `_reader` | lens reader | records nothing |
| `review_reviewer-writes-the-verdict.md` | `(none)` | solo, round 1 | records |
| `review_reviewer-writes-the-verdict_r2.md` | `_r2` | solo, round 2 | records |
| `review_rm-guard-command-boundary.md` | `(none)` | solo, round 1 | records |
| `review_rm-guard-command-boundary_r2.md` | `_r2` | solo, round 2 | records |
| `review_session_thesis.md` | `_thesis` | lens thesis | records nothing |
| `review_statusline_correctness.md` | `_correctness` | lens correctness | records nothing |
| `review_statusline_robustness.md` | `_robustness` | lens robustness | records nothing |
| `review_statusline_tests.md` | `_tests` | lens tests | records nothing |
| `review_verification-never-runs.md` | `(none)` | solo, round 1 | records |
| `review_verification-never-runs_r2.md` | `_r2` | solo, round 2 | records |
| `review_verification-never-runs_r3.md` | `_r3` | solo, round 3 | records |
| `review_verification-never-runs_r4.md` | `_r4` | solo, round 4 | records |
| `review_why-source-playbooks_facts.md` | `_facts` | lens facts | records nothing |

Every row matches ground truth, including the two decisive cases:
`review_verification-never-runs_r4.md` is solo and records (it is the row that closed item
14), and `review_readme-and-wiki_r2-facts.md` is round 2, lens `facts`, and records nothing.

The filename rule at `agents/reviewer.md:42-49` gained the same grammar, fixing the real bug
found on the way: a solo later round writes `review_<slug>_r<N>.md`, first free `N` from 2
upward, instead of overwriting round 1. Verbatim:

> Write your report to `.mstack/progress/review_<slug>_<lens>.md` when you were given a lens, and
> `.mstack/progress/review_<slug>.md` when you are reviewing alone. Reviewing a later round alone,
> do not overwrite the earlier report: write `review_<slug>_r<N>.md`, taking the first `N` from 2
> upward whose file does not exist. A lensed later round composes the two as
> `review_<slug>_r<N>-<lens>.md`. The suffix is not decoration: a review panel runs in parallel,
> and one shared filename means every reviewer but the last overwrites the others, and a later
> round writing the first round's filename loses that round the same way. Losing a review
> silently is the failure this report exists to prevent.

And the record rule at `agents/reviewer.md:75-81`, verbatim:

> Whether you record is not a judgement call, and you do not infer it from the phrasing of your
> brief: read it off your report path, the same signal that chose your filename above. Strip
> `review_<slug>` and `.md`; a leading `r<digits>` in what remains is a round marker, never a
> lens. Nothing left, or only a round marker such as `_r2`: you are reviewing alone. Anything
> else is a lens, whether bare like `_correctness` or composed with a round like `_r2-facts`.
>
> Reviewing alone, in any round, type your own ledger row, through Bash, once the report exists:

With the closing paragraph at `:99-102` now opening "As one lens of a panel, in any round,
write your report and record nothing." The re-run remedy in `skills/review/SKILL.md:41-43` is
unchanged and no longer loops: a re-run solo round-N reviewer classifies itself solo and
records.

## Non-blocking residue, fixed

The ladder's mapping table first column now reads as outcomes throughout
(`skills/router/references/evidence-ladder.md:35-41`): "The claim held at rung 5 / at rung
4", and the last row is "Ran it and the claim failed". Row 4 no longer reads unconditionally,
which also reinforces the round-2 finding-4 reconciliation: a green suite inside a rejecting
review is not "the claim held".

## Commands, round 3

```
$ npm test
(bun)  258 pass, 0 fail
(node) tests 258 / pass 258 / fail 0
npm test exit=0

$ npm run typecheck
typecheck exit=0

$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
```

## Where round 3 stopped on the ladder

The lifecycle walk behind finding 1 was established at rung 5 by two independent passes; not
re-derived, and the fix deliberately asserts nothing in its place. The classification rule is
rung 4: executed as a script over all 23 real filenames, output pasted above, and it would
fail loudly on a name it misparses. The prose itself remains rung 3 by read-back, as in every
round: a solo round-N reviewer now reaches "record" without reasoning past a rule, which is
the specimen failure of round 2. No test was invented that cannot fail.
