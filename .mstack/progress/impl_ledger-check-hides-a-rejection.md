# Implementation report: ledger-check-hides-a-rejection (item 47)

## What changed

`ledger.check` (`src/ledger.ts`) no longer keeps the best-ranked row at a sha. It takes the rows at the sha that the gate's closing audit reads (`canCloseAnItem(verifier)` and evidence that does not cite an implementing role's own report via `citesImplementingReport`), and answers with the LATEST of them in file order (not `ts`: a row can carry an explicit ts and clocks skew; the gate also orders by position, so the two cannot disagree on which row is last; comment in code). If it is `verifier-failed` or `verifier-blocked` the check fails and names verdict, verifier and evidence ("rejects this commit, whatever an implementing role recorded"). If it passes, it is the answer and `--min` applies to it (`PASS <verdict> at <sha8> by <verifier>`, unchanged shape). With no closing row at the sha it keeps best-by-rank and appends "(the author's own verdict, not an independent approval)". No rows at the sha, and an empty ledger, keep their messages byte for byte. Mechanism reproduced first: `check benchmark-harness a4e6c784...` printed `PASS test-verified at a4e6c784 by implementer` because rank 2 beat the reviewer's rank 0.

## Files

- `src/ledger.ts` (fix), `tests/ledger.test.ts` (14 new tests)
- `agents/reviewer.md`, `skills/review/SKILL.md` (the two "best row by rank" sentences)
- `docs/wiki/The-CLI.md` (transcript line now has the author's-own suffix, plus one paragraph on the rule)
- `.mstack/progress/impl_ledger-check-hides-a-rejection.md`, `.mstack/progress/current.md`
- `src/cli.ts` and `tests/cli.test.ts` unchanged: the command prints `result.reason`, so the output follows from the core.

Commits: bb21cf7 red tests; 4cd34e7 fix; 0d53679 test tightened after a mutant survived; dcbfe12 and ebd8a6b docs.

## Commands

```
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 461   ℹ pass 461   ℹ fail 0         (447 before, +14)
$ bun test ./tests      ->  461 pass, 0 fail, Ran 461 tests across 22 files. [70.55s]
$ bunx --bun tsc --noEmit   -> exit 0
$ ./bin/mstack lint-plugin .  -> PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 96 relative links checked, 0 broken
$ ./bin/mstack gate -> PASSED - 0 failures, 0 warnings
```
Red state (bb21cf7, before the fix): `ℹ pass 12 / ℹ fail 11` in tests/ledger.test.ts.

Original surface (this store, read-only):
```
before: ./bin/mstack ledger check benchmark-harness a4e6c784d995...  -> PASS test-verified at a4e6c784 by implementer   (exit 0)
after:  ./bin/mstack ledger check benchmark-harness a4e6c784d995...  -> PASS test-verified at a4e6c784 by reviewer      (exit 0, round 4 approval)

closed items at the sha of their last non-implementer row, before -> after:
cost-ledger                        4c88bc2a  PASS test-verified by reviewer -> PASS test-verified at 4c88bc2a by reviewer
withlock-enters-without-the-lock   4dbb41c7  PASS test-verified by reviewer -> PASS test-verified at 4dbb41c7 by reviewer
state-json-loses-concurrent-writes 4092af57  PASS live-verified by reviewer -> PASS live-verified at 4092af57 by reviewer
hook-errors-leave-no-trace         9adb4b9b  PASS test-verified by reviewer -> PASS test-verified at 9adb4b9b by reviewer
```
Throwaway store (`.../scratchpad/impl47/store`, real CLI):
```
$ mstack ledger record demo $H test-verified --evidence "node --test tests" --verifier implementer
$ mstack ledger check demo
PASS test-verified at 4bc472ef by implementer (the author's own verdict, not an independent approval)   exit 0
$ mstack ledger record demo $H verifier-failed --evidence ".mstack/progress/review_demo.md" --verifier reviewer
$ mstack ledger check demo
FAIL verifier-failed at 4bc472ef by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md)   exit 1
$ mstack ledger record demo $H test-verified --evidence ".mstack/progress/review_demo_r2.md" --verifier reviewer
$ mstack ledger check demo
PASS test-verified at 4bc472ef by reviewer   exit 0
$ mstack ledger check demo --min live-verified
FAIL latest closing verdict at 4bc472ef is test-verified by reviewer, which does not clear live-verified   exit 1
```

## R to test

| Acceptance bullet | Test | file:line |
|---|---|---|
| 1. exits non-zero and names the rejection when a reviewer verifier-failed row is the latest closing row, even if an implementer row ranks higher | the benchmark-harness case; rejection-then-impl-row | tests/ledger.test.ts:154, :167, :185 |
| 2. a test reproduces implementer test-verified then reviewer verifier-failed at one sha | the benchmark-harness case | tests/ledger.test.ts:154 |

CLI exit code and printed line: verified by the throwaway-store run above (the CLI prints `result.reason` and exits `passing ? 0 : 1`, `src/cli.ts:757-758`).

## Case table (exact `ledger check` line, min test-verified, rows in file order)

| Rows at the sha | Output | Test line |
|---|---|---|
| none anywhere | `no verdict recorded for x` (FAIL, unchanged) | :290 |
| other sha only | `no verdict at <sha8>; 1 row(s) exist at other SHAs and a new head SHA voids them` (unchanged) | :278 |
| impl pass | `PASS test-verified at <sha8> by implementer (the author's own verdict, not an independent approval)` | :222 |
| empty verifier | `PASS test-verified at <sha8> by unknown (the author's own verdict, not an independent approval)` | :239 |
| impl pass, reviewer pass | `PASS test-verified at <sha8> by reviewer` | :229 |
| impl pass, reviewer fail | `FAIL verifier-failed at <sha8> by reviewer rejects this commit, whatever an implementing role recorded (evidence: <path>)` | :154 |
| reviewer fail, impl pass (the bug) | same FAIL line | :167 |
| reviewer fail, reviewer pass | `PASS test-verified at <sha8> by reviewer` | :176 |
| reviewer pass, reviewer fail | FAIL line naming the later row's evidence | :185 |
| impl pass, reviewer blocked | `FAIL verifier-blocked at <sha8> by reviewer rejects this commit, ...` (also at `--min verifier-blocked`) | :203 |
| impl pass, ci-bot fail (unknown verifier) | FAIL naming ci-bot | :246 |
| reviewer live then reviewer type-check-only | `FAIL latest closing verdict at <sha8> is type-check-only by reviewer, which does not clear test-verified` | :194 |
| --min live-verified vs test-verified approval | `FAIL latest closing verdict at <sha8> is test-verified by reviewer, which does not clear live-verified` | :255 |
| reviewer fail, then reviewer row citing impl_x.md | FAIL (forged approval ignored, as in the gate) | :268 |

## Mutant table (tests/ledger.test.ts only, each reverted; `git status --short` clean at the end)

| Mutant | Killed by |
|---|---|
| revert to best-by-rank | 10 tests (incl. :154) |
| latest of any role | 4 (:167, :222, :239, :268) |
| first closing row instead of last | 4 (existing "strongest verdict" test, :176, :185, :194) |
| ignore verifier-blocked | SURVIVED the first suite (fell through to rank 0 < min with a different message); added message and `--min verifier-blocked` assertions at :203, now killed |
| drop the --min comparison on the closing row | 3 (existing type-check-only test, :194, :255) |
| drop "author's own" wording | 2 (:222, :239) |
| drop the citation filter | 1 (:268) |
| closing = any verifier | 3 (:167, :222, :239) |
| drop evidence from rejection text | 2 (:154, :185) |

## Callers of `ledger.check` and what each shows now

- `src/cli.ts:756` `ledger check`: prints `PASS|FAIL <reason>`, exit by `passing`. Table above.
- `src/statusline.ts:141,152-154` (the only reader of `.best`): shows `best.verdict`. Now `best` is the latest closing row, so a rejection after an implementer row renders RED `verifier-failed` (before: green `test-verified`); `verifier-blocked` renders yellow; author-only still shows the implementer's verdict (green if it passes). Untouched file; no statusline test changed and all pass. Note the status line cannot show the "author's own" label.
- `skills/review/SKILL.md` step 9 ("confirm the row exists with ledger check"): now a rejection no longer looks like an existing passing row; the text needed no change. Briefs/reviewers that quote the check see the new lines.
- No other `src/` caller (`rg "ledger\.check|\.best\b" src`).

## Comparison with the gate's closing audit (`src/gate.ts:375-490`), same rows, run through the real gate on a done item

| Case | gate refuses to close | `ledger check` |
|---|---|---|
| impl only | yes (selfClosed) | PASS, labelled author's own |
| impl pass, reviewer pass | no | PASS |
| impl pass, reviewer fail | yes | FAIL |
| reviewer fail, impl pass | yes | FAIL |
| reviewer fail, reviewer pass | no | PASS |
| reviewer pass, reviewer fail | yes | FAIL |
| reviewer blocked | no | FAIL |
| empty verifier | yes | PASS, labelled author's own |
| reviewer fail, reviewer row citing impl report | yes | FAIL |
| reviewer live, then type-check-only | no | FAIL |

They agree on every rejection (the item's contract). Three legitimate differences, none forced:
1. Author-only rows (impl only, empty verifier): the gate refuses to close, `ledger check` still passes. The recorded design says to keep best-by-rank there and label it; `check` answers "does a verdict at this sha clear the rung", the gate also asks "was it independent". Exit code stays 0 so a pass by an implementer mid-work is not turned into a failure for every in-progress item; the label carries the difference. If the owner wants `check` to fail here too, it is one branch (a follow-up/decision).
2. `verifier-blocked` latest: the gate lets it close (documented escape hatch, only `verifier-failed` is refused); `check` fails it, since it clears no rung, as before.
3. Rung: the gate has no rung floor; `check` applies `--min` (type-check-only after live fails the default test-verified).
Also: the gate audits all shas of an item, `check` one sha.

## Suggested follow-ups (not done)

- Confirmed: `./bin/mstack ledger check benchmark-harness a4e6c784` (abbreviated sha) answers `FAIL no verdict at a4e6c784; 8 row(s) exist at other SHAs ...` although rows exist at that commit; `check` compares sha strings exactly. The ledger even holds a row recorded with the 7-char `9b36340`.
- Decide whether author-only should be a FAIL (difference 1).

## Honest rung

Rung 4 for the changed behaviour (real CLI in a throwaway store, real gate run over the case table, both suites, mutants). The status line change is inferred from reading and the unchanged statusline tests, not rendered. Known load-sensitive tests did not fail.
