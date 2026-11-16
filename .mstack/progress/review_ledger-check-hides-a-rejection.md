# Review - ledger-check-hides-a-rejection

**Verdict:** CHANGES_REQUESTED

Round 1, reviewing alone, head `a16e49087d0505861833d4b277f317b6bfc4d4c7` (last code/docs commit `ebd8a6b`).
Diff reviewed: `git diff 5b2714c...HEAD -- src tests agents skills docs README.md` (5 files, +221/-8).

The fix is right for the default path, every closed item still passes, and the suite and gate are
green. Two things block: a reviewer's rejection is still hidden behind the implementer's row when
the rejection's evidence names the implementer's report (the evidence filter is applied to
rejections too, so the item's own bug survives in that shape, rung 5 below), and a wiki sentence
the change made false was missed.

## Changes required

1. `src/ledger.ts:157-159` - the forged-evidence filter (`citesImplementingReport(...) === undefined`)
   is applied to rejections as well as approvals. A reviewer `verifier-failed` (or
   `verifier-blocked`) whose evidence mentions `impl_<slug>.md` is dropped from `closing`; with no
   closing row left, `check` falls back to best-by-rank over all rows and prints the implementer's
   PASS, exit 0, without naming the rejection. Real CLI, throwaway store, rows in file order
   `implementer test-verified` then `reviewer verifier-failed --evidence ".mstack/progress/review_demo.md; the claims in .mstack/progress/impl_demo.md do not hold"`:

   ```
   CHECK [exit 0] PASS test-verified at d921ed8e by implementer (the author's own verdict, not an independent approval)
   GATE  [exit 1] [fail]  items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)
   ```

   Same with evidence `.mstack/progress/impl_demo.md` alone (case A13f). The readers inherit it:
   `merge-gate` evaluates `GO | ledger: test-verified at d6fc1c50 by implementer (the author's own verdict, ...)`
   and the status line renders `<GREEN>test-verified</>` for that ledger (case C6). This is the
   item's defect in a second shape - acceptance 1 reads "a reviewer's verifier-failed row is the
   latest closing-role row", and the recorded design defines a closing role as `canCloseAnItem`,
   which `reviewer` is - and it is the unsafe direction: `check` PASS where the gate refuses the
   same ledger. The filter exists to stop a forged *approval*
   (`src/gate.ts:416-420`: "so a forged row can neither close an item nor supersede a genuine
   failure"); applied to a rejection it can only make `check` more permissive. A reviewer citing
   the report it is rejecting is ordinary prose, not forgery.
   Fix: exempt rejections from the citation filter, e.g.
   `(e) => canCloseAnItem(e.verifier) && (e.verdict === "verifier-failed" || e.verdict === "verifier-blocked" || citesImplementingReport(e.evidence, target) === undefined)`,
   and add the test: implementer `test-verified`, then reviewer `verifier-failed` with evidence
   `".mstack/progress/review_x.md; impl_x.md overclaims"` -> `passing === false`, reason names
   `verifier-failed` and `reviewer`. I applied exactly that edit as a mutant: 0 of 171 tests fail on either runtime, and the real CLI from a patched copy prints `FAIL verifier-failed at 5f6188b6 by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md; the claims in .mstack/progress/impl_demo.md do not hold)`, exit 1, for A13d.
   With that fix, case A13e (legitimate reviewer approval, then a reviewer rejection citing the
   impl report) becomes `check` FAIL while the gate still closes - a disagreement in the safe
   direction, and a gate defect of its own (follow-up 2). `docs/wiki/The-CLI.md:323-324`
   ("a later `verifier-failed` ... from a reviewer fails the check ..., whatever an implementer
   recorded at that SHA") is false today for exactly this case and becomes true with the fix.

2. `docs/wiki/The-Agents.md:165` - now false, and the same sentence the change corrected in
   `agents/reviewer.md:99-101` and `skills/review/SKILL.md:50-52`:
   "The ledger keeps one winning row per item and commit, preferring the most favorable verdict,
   so several lens rows would collapse to the panel's most favorable member." Under the new rule
   they collapse to whichever lens recorded last. The implementer's search pattern
   (`best row|by rank|best verdict|keeps the best`) does not match "most favorable"; I found it
   with `rg -n -i "favou?rable|winning row" docs/wiki`. Fix: the same rewrite as
   `agents/reviewer.md:99-101`.

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| 1. fails and names a reviewer rejection that is the latest closing-role row, over a higher-ranked implementer row | `tests/ledger.test.ts:154`, `:167`, `:185`, `:203`, `:246` | red at `bb21cf7`; killed by M1/M2/M8/M9; real CLI A03/A04/A06/A07/A09. Gap: no test for a rejection whose evidence mentions the impl report (A13d/A13f), which fails today |
| 2. a test reproduces implementer test-verified then reviewer verifier-failed at one sha | `tests/ledger.test.ts:154` | red at `bb21cf7`; killed by M1, M8, M10 |

## Acceptance, quoted

**"ledger check exits non-zero and names the rejection when a reviewer's verifier-failed row is the latest closing-role row at the checked sha, even if an implementer row at that sha ranks higher"** -
met on the default path, not met in one shape. Met: case A03 (implementer pass then reviewer fail)
and A04 (reviewer fail then implementer pass, the original bug) both print
`FAIL verifier-failed at <sha8> by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md)`, exit 1,
with the real CLI; `src/ledger.ts:167-176`; tests `tests/ledger.test.ts:154` and `:167`, both red
at `bb21cf7` (11 of 23 ledger tests failed there, all 11 new; the 9 pre-existing tests passed and
are byte-identical). Not met: when the reviewer's rejection mentions `impl_<slug>.md` in its
evidence (Changes required 1, cases A13d/A13f): exit 0, rejection not named.

**"a test reproduces the benchmark-harness case: implementer test-verified then reviewer verifier-failed at one sha"** -
met by `tests/ledger.test.ts:154` ("the benchmark-harness case: ..."), which records exactly those
two rows at one sha and asserts `passing === false`, `best.verdict === "verifier-failed"`,
`best.verifier === "reviewer"` and the evidence path in the reason. It fails at `bb21cf7` (red run
below) and under the best-by-rank mutant on both runtimes. On the real store,
`./bin/mstack ledger check benchmark-harness a4e6c784d99536d39c132cb0d5e4d634ad34e9f2` now prints
`PASS test-verified at a4e6c784 by reviewer` (exit 0; the round-4 reviewer approval, row 77, is
the latest closing row), where `5b2714c` printed `PASS test-verified at a4e6c784 by implementer`.

## Verification I ran

```
$ ./bin/mstack version
mstack 0.2.1 at /Users/romerma/Code/mstack
$ ./bin/mstack gate
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full          (exit 0)
 467 pass / 0 fail / Ran 467 tests across 24 files. [69.67s]   (bun test tests/, includes the gitignored sandbox/)
ℹ tests 461 / ℹ pass 461 / ℹ fail 0                            (node --test 'tests/*.test.ts')
> bunx --bun tsc --noEmit                                        (clean)
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'   (node v26.13.1, exit 0)
ℹ tests 461 / ℹ pass 461 / ℹ fail 0
$ bun test ./tests   (exit 0)
 461 pass / 0 fail / Ran 461 tests across 22 files. [70.74s]
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings   (exit 0)
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
96 relative links checked, 0 broken   (exit 0)
```

Red state, `git archive bb21cf7` into the scratchpad, its own `src`:
```
$ node ... --test tests/ledger.test.ts
ℹ tests 23 / ℹ pass 12 / ℹ fail 11   (the 11 are the new tests, incl. "the benchmark-harness case ...")
```
Load-sensitive tests (`tests/run.test.ts:54`, `:239`, `tests/costs.test.ts:698`) did not fail in any run.

### A. Case table - real CLI, throwaway store per case, default `--min test-verified` unless noted

Each case: `git init`, empty commit, `/Users/romerma/Code/mstack/bin/mstack setup`, item `demo`,
rows recorded at the full HEAD sha in the order given, `ledger check demo <sha>`. Evidence:
`review_demo.md` / `review_demo_r2.md` / `impl_demo.md` are under `.mstack/progress/`.

| # | Rows at the sha (file order) | `ledger check` output | exit |
|---|---|---|---|
| A01 | implementer test-verified | `PASS test-verified at fed0907a by implementer (the author's own verdict, not an independent approval)` | 0 |
| A02 | implementer test-verified; reviewer test-verified | `PASS test-verified at 5633653b by reviewer` | 0 |
| A03 | implementer test-verified; reviewer verifier-failed | `FAIL verifier-failed at 1ff90824 by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md)` | 1 |
| A04 | reviewer verifier-failed; implementer test-verified (the bug) | `FAIL verifier-failed at 9296f53c by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md)` | 1 |
| A05 | reviewer verifier-failed; reviewer test-verified (r2) | `PASS test-verified at 391e999f by reviewer` | 0 |
| A06 | reviewer test-verified; reviewer verifier-failed (r2) | `FAIL verifier-failed at 7ea1625a by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo_r2.md)` | 1 |
| A07 | implementer test-verified; reviewer verifier-blocked | `FAIL verifier-blocked at 959f5f5c by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md)` | 1 |
| A08 | `--verifier ""` test-verified | `PASS test-verified at 3e474128 by unknown (the author's own verdict, not an independent approval)` | 0 |
| A09 | implementer test-verified; `ci-bot` verifier-failed | `FAIL verifier-failed at 4660ffe8 by ci-bot rejects this commit, whatever an implementing role recorded (evidence: https://ci.example/run/1)` | 1 |
| A10 | implementer test-verified; reviewer test-verified; `--min live-verified` | `FAIL latest closing verdict at 36ef522d is test-verified by reviewer, which does not clear live-verified` | 1 |
| A11 | reviewer test-verified at the previous commit only | `FAIL no verdict at 0c7d2d3d; 1 row(s) exist at other SHAs and a new head SHA voids them` | 1 |
| A12 | empty ledger | `FAIL no verdict recorded for demo` | 1 |
| A13a | reviewer verifier-failed; reviewer test-verified citing `impl_demo.md` (forged approval) | `FAIL verifier-failed at 419b6c38 by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md)` | 1 |
| A13b | implementer test-verified; reviewer test-verified citing `impl_demo.md` | `PASS test-verified at 7caf3118 by implementer (the author's own verdict, not an independent approval)` | 0 |
| A13c | reviewer test-verified citing `impl_demo.md` only | `PASS test-verified at 17721453 by reviewer (the author's own verdict, not an independent approval)` | 0 |
| **A13d** | implementer test-verified; reviewer verifier-failed, evidence `review_demo.md; the claims in impl_demo.md do not hold` | `PASS test-verified at d921ed8e by implementer (the author's own verdict, not an independent approval)` | **0** |
| A13e | reviewer test-verified; reviewer verifier-failed, evidence `review_demo_r2.md: impl_demo.md is wrong` | `PASS test-verified at 5c46a773 by reviewer` | 0 |
| **A13f** | implementer test-verified; reviewer verifier-failed, evidence `impl_demo.md` | `PASS test-verified at 802b76c0 by implementer (the author's own verdict, not an independent approval)` | **0** |

A13a confirms the implementer's claim: a forged "reviewer" approval citing `impl_demo.md` cannot
turn a rejection into a PASS. A13d/A13f are the opposite hole: the same filter turns a real
rejection into the implementer's PASS (Changes required 1).

Further cases run the same way (also in the gate table below): B01 reviewer pass then
implementer pass -> `PASS test-verified at 74739341 by reviewer`; B02 reviewer pass then
implementer verifier-failed -> `PASS test-verified at 30905300 by reviewer`; B03 reviewer
live-verified then reviewer type-check-only -> `FAIL latest closing verdict at 4d9d6206 is type-check-only by reviewer, which does not clear test-verified`;
B04 spec-author only -> `PASS test-verified at 590297ce by spec-author (the author's own verdict, not an independent approval)`;
B05 `mstack:implementer` live then `mstack:reviewer` fail -> `FAIL verifier-failed at 0cdc7e00 by mstack:reviewer rejects this commit, ...`;
B06 `" Implementer "` only -> `PASS test-verified at 533733ae by Implementer (the author's own verdict, ...)`;
B07 reviewer fail only -> FAIL; B08 reviewer blocked only -> FAIL; B09 reviewer fail then
`orchestrator` pass citing lens reports -> `PASS test-verified at 9678ede9 by orchestrator`;
B10 implementer fail then implementer pass -> PASS (author's own); B11 reviewer fail then a
reviewer pass citing `spec_demo.md` -> FAIL; B12 implementer pass then implementer
verifier-failed -> `PASS test-verified at 47313b9d by implementer (the author's own verdict, ...)`;
B14 reviewer fail then reviewer blocked -> `FAIL verifier-blocked ...`; B15 reviewer pass then
reviewer blocked -> `FAIL verifier-blocked ...`.

### B. Agreement with the gate - same store, item moved pending -> in_progress -> reviewing -> verifying -> done, committed, `./bin/mstack gate`

`state set --status done` was accepted in every case (no `verify` command, no `verification` on
the item, so `closingProblems` is empty); the gate's closing audit then judged the ledger.

| Case | `ledger check` | gate closing audit | Agree? |
|---|---|---|---|
| A01 impl only | PASS, author's own | `[fail] items closed on a verdict from the pass that wrote the code: demo (only implementer)` | known difference 1 |
| A02 impl, rev pass | PASS | `[ok] 1 closed item(s) carry a ledger verdict` | yes |
| A03 impl, rev fail | FAIL | `[fail] items marked done whose most recent closing verdict is verifier-failed: demo (reviewer)` | yes |
| A04 rev fail, impl | FAIL | same `[fail]` | yes |
| A05 rev fail, rev pass | PASS | `[ok]` | yes |
| A06 rev pass, rev fail | FAIL | `[fail] ... most recent closing verdict is verifier-failed` | yes |
| A07 impl, rev blocked | FAIL | `[ok]` | known difference 2 (safe direction) |
| A08 empty verifier | PASS, author's own | `[fail] ... the pass that wrote the code: demo (only unnamed)` | known difference 1 |
| A09 impl, ci-bot fail | FAIL | `[fail] ... verifier-failed: demo (ci-bot)` | yes |
| A10 `--min live-verified` vs test-verified approval | FAIL | `[ok]` | known difference 3 (safe direction) |
| A11 rows at another sha only | FAIL, no verdict at sha | `[ok]` | by design: the gate audits every sha |
| A12 empty ledger | FAIL | `[fail] items marked done with no ledger verdict at all: demo` | yes |
| A13a rev fail, forged pass | FAIL | `[fail] ... verifier-failed: demo (reviewer)` | yes |
| A13b impl, forged pass | PASS, author's own | `[fail] items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)` | difference 1 |
| A13c forged pass only | PASS, author's own | same `[fail]` | difference 1 |
| **A13d impl, rev fail citing impl** | **PASS (exit 0)** | `[fail] ... evidence cites the implementer's own report: demo (reviewer)` | **no - blocker** |
| A13e rev pass, rev fail citing impl | PASS | `[ok]` | agree, both wrong (gate follow-up) |
| **A13f impl, rev fail = impl_demo.md** | **PASS (exit 0)** | same `[fail]` | **no - blocker** |
| B01 rev pass, impl pass | PASS | `[ok]` | yes |
| B02 rev pass, impl fail | PASS | `[ok]` | yes |
| B03 rev live, rev type-check-only | FAIL | `[ok]` | difference 3 |
| B04 spec-author only | PASS, author's own | `[fail] ... (only spec-author)` | difference 1 |
| B05 ns impl, ns rev fail | FAIL | `[fail] ... verifier-failed: demo (mstack:reviewer)` | yes |
| B06 `" Implementer "` only | PASS, author's own | `[fail] ... (only Implementer)` | difference 1 |
| B07 rev fail only | FAIL | `[fail] items marked done whose only verdict is verifier-failed: demo` | yes |
| B08 rev blocked only | FAIL | `[ok]` | difference 2 |
| B09 rev fail, orchestrator pass | PASS | `[ok]` | yes |
| B10 impl fail, impl pass | PASS, author's own | `[fail] ... (only implementer)` | difference 1 |
| B11 rev fail, pass citing spec_demo.md | FAIL | `[fail] ... verifier-failed: demo (reviewer)` | yes |
| B12 impl pass, impl fail | PASS, author's own | `[fail] ... (only implementer)` | difference 1 |
| B13 rev pass at H2, then rev fail recorded at older H1; check at H2 | `PASS test-verified at 3cc01735 by reviewer` | `[fail] ... most recent closing verdict is verifier-failed: demo (reviewer)` | by design (one sha vs all shas); see follow-up 4 |
| B14 rev fail, rev blocked | FAIL | `[ok]` | difference 2 - gate defect, follow-up 1 |
| B15 rev pass, rev blocked | FAIL | `[ok]` | difference 2 |

The three differences the implementer reports are real and as described: (1) author-only rows,
gate refuses, `check` exits 0 with the label (A01, A08, B04, B06, B10, B12) - as the design row
says; (2) a latest `verifier-blocked` closes in the gate and fails `check` (A07, B08, B15) - it
pre-dates this change (`src/gate.ts:446` tests only `verifier-failed`, untouched); (3) `check`
applies `--min`, the gate has no rung floor (A10, B03). The one other disagreement where
`check` says PASS and the gate refuses on the ledger is A13d/A13f (Changes required 1). B13 is
also PASS/refuse, but across two shas: the rejection is about another commit, and `check` is
sha-keyed by design.

Is (2) a gate defect? A lone `verifier-blocked` closing is the gate's documented escape hatch
(`src/gate.ts:386-388`, hint at `:454`), so not by itself. But B14 shows the defect inside it: a
reviewer's `verifier-failed` followed by a `verifier-blocked` ("could not run the check") lets the
item close, so "could not verify" erases a standing rejection. That deserves its own item.

### C. Readers of the result

Status line, `render(..., { colours: true })` and `mstack statusline` on stdin, active item `demo`
`in_progress`, rows at HEAD:

| Ledger at HEAD | Verdict segment | `ledger check` |
|---|---|---|
| impl pass, rev fail | `<RED>verifier-failed</>` (was green `test-verified` before the change) | FAIL |
| author only (impl pass) | `<GREEN>test-verified</>` | PASS (author's own) |
| impl pass, rev blocked | `<YELLOW>verifier-blocked</>` | FAIL |
| impl pass, rev pass | `<GREEN>test-verified</>` | PASS |
| rev live, rev type-check-only | `<YELLOW>type-check-only</>` | FAIL |
| impl pass, rev fail citing impl report (C6) | `<GREEN>test-verified</>` | PASS (Changes required 1) |

What a user sees: a rejection now shows red, which is the fix working. An author-only verdict is
green `test-verified`, indistinguishable from an independent approval - the status line drops the
"author's own" label (`src/statusline.ts:152-155` reads only `best.verdict` and `passing`); same
as before the change, so not a regression (follow-up 3).

Every reader (`rg -n "ledger\.check|ledgerCheck|\.best\b|\.passing\b" src`): `src/cli.ts:756-758`
prints `reason` and exits on `passing` (table A); `src/statusline.ts:141,152-155` (above);
`src/mergegate.ts:165-170` puts `reason` in notes or stops - evaluated against the same ledgers:
impl+rev fail `STOP | ledger: verifier-failed at c05a1787 by reviewer rejects this commit, ...`;
author only `GO | ledger: test-verified at db5adcf7 by implementer (the author's own verdict, not an independent approval)` (GO as before);
impl+rev blocked `STOP`; impl+rev pass `GO`; C6 `GO` (Changes required 1). No other reader of
`check` in `src/` (`src/gate.ts` reads `ledgerEntries` directly; `src/fanout.ts` `check` is a
different function). None misreports beyond Changes required 1.

### D. Closing unaffected

`./bin/mstack ledger check <slug> <sha of its latest closing row>` for all 29 closed items of this
store, new code vs `git archive 5b2714c`: all 29 PASS on both, exit 0. Panel-closed:
`statusline` -> `PASS test-verified at 32f02656 by review panel`, `decision-required-gate` ->
`PASS test-verified at a41bf754 by review panel`. Two changed only in who is named:
`benchmark-harness` -> `PASS test-verified at a4e6c784 by reviewer` (old: `by implementer`),
`benchmark-hard-tier` -> `PASS test-verified at d6cc37b7 by reviewer` (old: `by implementer`).
No closed item in this store has a row after its last closing row (checked over all 112 rows), so
the "later non-closing row" case was run in the throwaway store instead: B01 (reviewer pass, then
implementer pass) and B02 (reviewer pass, then implementer `verifier-failed`) both PASS by
reviewer and the gate closes both. `./bin/mstack gate` on this repository: `PASSED - 0 failures, 0 warnings`.

### E. Mutants

Each applied to `src/ledger.ts` through Bash (exact string replacement from a saved copy, or the
whole `5b2714c` file for M1), run with `node --test` and `bun test` over
`tests/ledger.test.ts tests/statusline.test.ts tests/mergegate.test.ts tests/cli.test.ts tests/gate.test.ts`
(171 tests), and restored; `git diff --quiet src/ledger.ts` after each. Both runtimes killed the
same tests in every case.

Test locations: `L:<n>` is `tests/ledger.test.ts:<n>`; `SL:276` "a verdict that exists at HEAD is
reported as itself", `SL:441` "the colours are the message", `MG:111` "a verdict at this head SHA
clears the gate".

| # | Mutant (exact edit in `src/ledger.ts`) | Killed by, node and bun alike |
|---|---|---|
| M1 | revert to best-by-rank (the whole `5b2714c` file) | 11: L:154, L:167, L:185, L:194, L:203, L:222, L:229, L:239, L:246, L:255, L:268 |
| M2 | latest of any role: filter at `:158` -> `(e) => true,` | 4: L:167, L:222, L:239, L:268 |
| M3 | first closing row: `closing[closing.length - 1]` -> `closing[0]` | 4: L:57, L:176, L:185, L:194 |
| M4 | ignore `verifier-blocked`: `:170` -> `if (latest.verdict === "verifier-failed") {` | 1: L:203 |
| M5 | drop `--min` on the closing row: `:178` -> `RANK[latest.verdict] > 0` | 4: L:34, L:194, L:255, SL:441 |
| M5b | `:178` -> `const passing = true;` | 4: L:34, L:194, L:255, SL:441 |
| M6 | drop the evidence filter: `:158` -> `(e) => canCloseAnItem(e.verifier),` | 1: L:268 |
| M7 | drop the "author's own" wording from both fallback messages (`:199`, `:200`) | 2: L:222, L:239 |
| M8 (mine) | drop ` (evidence: ${latest.evidence})` from the rejection reason (`:175`) | 3: L:154, L:185, L:203 |
| M9 (mine) | implementer counts as closing: `:158` -> `(e) => e.verifier !== "" && citesImplementingReport(...) === undefined,` | 2: L:167, L:222 |
| M10 (mine) | rejection branch `best: latest` -> `best: undefined` (`:173`) | 3: L:154, SL:276, SL:441 |
| M11 (mine) | `:178` `>=` -> `>` | 7: L:9, L:34, L:115, L:176, L:229, SL:441, MG:111 |
| M12 (mine) | rejection branch `passing: false` -> `passing: RANK[latest.verdict] >= RANK[min]` (`:172`) | 1: L:203 (its `--min verifier-blocked` half) |
| M13 (mine) | drop ` rejects this commit, whatever an implementing role recorded` from `:175` | **survived** (wording only; tests match verdict, verifier and evidence) |
| M14 (mine) | `:167` -> best-by-rank among closing rows | 2: L:185, L:194 |
| M15 (mine) | passing branch `best: latest` -> best-by-rank over `here` (`:181`) | 2: L:194, L:229 |
| M16 (mine) | `:200` `, which does not clear ${min} (the author's own verdict)` -> `, which does not clear ${min}` | **survived**: no test covers a failing author-only check (e.g. implementer `type-check-only` alone) |
| Fix | proposed fix for Changes required 1 (filter at `:158` exempts `verifier-failed`/`verifier-blocked`) | 0 of 171 fail on either runtime; with the real CLI from a patched `git archive HEAD` copy, A13d, A13e and A13f print `FAIL verifier-failed ... rejects this commit ...` (exit 1) and A13a still FAILs |

Survivors: M13 is cosmetic. M16 is a missing assertion for the failing half of the author-only
branch; one line in a test closes it (record implementer `type-check-only` only, assert
`/author's own/` in the reason). Neither blocks. `git status --short` is empty after every mutant
and at the end.

### F. Prose

- `agents/reviewer.md:99-102`: true under the new rule (`check` reads the latest closing row, so
  lens rows would collapse to the last lens; a panel's verdict is its worst lens). The instruction
  to a lens reviewer - record nothing, the synthesizing pass records one row - is still right:
  with latest-wins, lens rows would make the answer depend on who finished last. The edit stayed
  inside the sentence; line 101 was not re-wrapped (about 130 characters against the file's ~95).
- `skills/review/SKILL.md:50-52`: true, edit stayed inside the sentence.
- `docs/wiki/The-CLI.md:312`: the transcript line reproduces with the real CLI (case A01 prints
  the same shape). `:322-326`: true except for the A13d/A13f case (Changes required 1).
- Missed: `docs/wiki/The-Agents.md:165` (Changes required 2). No other hit for
  `best row|by rank|best verdict|keeps the best|strongest|most favorable|winning row` in README,
  docs/wiki, skills, agents or CHANGELOG. `docs/wiki/Status-Line.md:19-23` ("reports a verdict at
  HEAD as itself") stays true.

### G. Tests and rules

`git diff 5b2714c...HEAD --numstat -- tests` -> `166 0 tests/ledger.test.ts`: only additions; the
nine pre-existing ledger tests are unchanged and none was weakened or deleted. The "11 of 23"
red count is 11 new tests failing against the old `src`, not old tests rewritten (red run above).
`src/gate.ts`, `src/closing.ts`, `src/roles.ts`, `src/tsv.ts`, `src/state.ts`, `src/hooks.ts`
(and `src/cli.ts`, `src/statusline.ts`, `src/mergegate.ts`) are untouched
(`git diff --stat 5b2714c...HEAD -- <them>` is empty). Runtime rules hold: no new dependency,
only an import from `./roles.ts`, no `Bun.*`, both runtimes green, no build step.

## Non-blocking notes

1. `src/ledger.ts:157-158` + `src/roles.ts:180` - a new crash path. `citesImplementingReport`
   interpolates the slug into a `RegExp` unescaped, which is safe for the gate because state.json
   slugs are `SLUG`-validated (`src/roles.ts:161-163`), but `ledger record`/`ledger check` take a
   free-text target (`src/cli.ts:721,745`). Throwaway store, reviewer `test-verified` at HEAD for
   target `api(v2`: new code `mstack: Invalid regular expression: missing )`, exit 2; `5b2714c`
   `PASS test-verified at d299cf02 by reviewer`. `pkg[core` likewise. It fails closed and every
   target in this store's 112 rows is a slug, so not a blocker; fix by skipping the citation check
   (or escaping) when the target does not match `SLUG`.
2. `tests/ledger.test.ts:57` - the title "the strongest verdict at a SHA wins" now states the old
   rule; it passes because its strongest row is also its latest. Rename it to what it pins.
3. `src/ledger.ts:169` - `latest.verifier || "unknown"` is dead in the closing branch:
   `canCloseAnItem("")` is false, so a closing row always has a verifier.
4. "Latest" is file order. `ledger.tsv` is `merge=union` (`.mstack/.gitattributes`), so after a
   merge of two branches that both recorded at one sha, "latest" is whatever order git's union
   merge wrote. Shared with the gate's audit; the code comment at `:161-166` should say so.

## Suggested follow-ups

1. Gate: `verifier-blocked` supersedes a standing `verifier-failed` (B14: reviewer fail, then
   reviewer blocked -> the gate closes the item, `check` fails it). `src/gate.ts:445-448` should
   treat a blocked row as not answering an earlier rejection. Already noted to file in
   `.mstack/progress/current.md:58-59` in its general form.
2. Gate: a closing-role rejection whose evidence cites the impl report is dropped by
   `src/gate.ts:421-422`, so a legitimate approval followed by such a rejection closes (A13e). Same
   asymmetry as Changes required 1, on the gate side.
3. Status line: an author-only verdict renders green like an independent approval
   (`src/statusline.ts:152-155`); it could render yellow or carry a marker.
4. Gate audits rows across every sha in file order, so a late rejection recorded against an older
   commit retracts an approval at the newer one the item closed on (B13). Decide whether that is
   intended.
5. Author-only fallback keeps best-by-rank, so the author's own later `verifier-failed` is hidden
   (B12). The design row chose this; worth a decision row if `check` should ever fail author-only.
6. Already known and queued (not re-reported): exact sha comparison, so an abbreviated sha answers
   "no verdict"; the 7-character row in the ledger.

## Evidence ladder

Changes required 1 and 2: rung 5 (real CLI and real gate in a throwaway store; quoted line in the
repository). Acceptance 1 default path and acceptance 2: rung 5 for the CLI, rung 4 for the tests
(red at `bb21cf7`, killed by mutants). Closing unaffected: rung 5 on this store's 29 closed items.
Status line and merge-gate: rung 4 (`render`/`evaluate` called on real stores, CLI statusline
also). Gate defect B14: rung 5. Regex crash: rung 5.
