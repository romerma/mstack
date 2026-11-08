# Implementation report, round 3: cost-ledger (item 37)

Scope: the four changes in the `review-r3` decision, answering
`.mstack/progress/review_cost-ledger_r2.md` (CHANGES_REQUESTED at 67a25b4a). Nothing else was
touched. Verdict: **test-verified**.

## What changed

1. **Prune double count.** `prune` kept a session only while its `ended` record was under 14
   days old. A session's `flushed` totals now stay for as long as its transcript exists, whatever
   its age; they go only when the transcript is gone, plus the one-day grace (`src/costs.ts`,
   `prune`). The `ENDED_KEEP_MS` constant is removed.
2. **Multi-item, from usage.** `flushSession` builds the set of real items from the stretches
   that carry usage (main ranges and subagent rows with tokens), not from the marks. One item:
   the cost goes to it. None: to `(none)`. Two or more: to `(multi-item)`. The token remainder
   stays on the last stretch's item; when its target differs from the cost target, the
   unattributed output is two rows (tokens, then cost) so the column sum is unchanged.
3. **Lock before rows.** The costs lock now wraps the marks lock, and the rows plus the
   `flushed` and `ended` lines are written inside the marks lock, the lines by one direct
   `appendFileSync` (no `appendLine`, which would re-enter the lock). Order kept: rows, then
   flushed. A hook killed while waiting for a lock now writes nothing.
4. **Nit.** The "about 20% of the cache reads" figure is dropped from `docs/wiki/The-CLI.md`; the
   `unattributed` description now cites the internal-subagent case and `/compact`.

Docs updated to match (The-CLI, State-Files, including the remaining crash window: two adjacent
writes under a held lock).

Two existing tests were changed deliberately, because the prune rule they encoded changed: the
F4 prune-race test and the flushed-survive-prune test used a settled session with an *existing*
transcript as the "old session to prune". Under the new rule that session is kept, so both now
use a session whose transcript is gone. No assertion about counting was weakened.

## Files

```
M src/costs.ts   M tests/costs.test.ts
M docs/wiki/The-CLI.md   M docs/wiki/State-Files.md
A .mstack/progress/impl_cost-ledger_r3.md   (decisions/state bookkeeping unchanged by me)
```

## R to test

| R | Test | Where |
|---|---|---|
| 1. flush, age marks past 14 days, prune, resume, flush: total equals the last cost-state, subagent not re-emitted | a session resumed after its marks were more than 14 days old is not written twice | tests/costs.test.ts:1022 |
| 1. prune still drops a session whose transcript is gone, and keeps flushed totals across a rewrite | the flushed totals survive a prune...; prune re-reads the marks file under its lock... | tests/costs.test.ts:963, :931 |
| 2. closing alpha in the last turn (trailing `(none)` mark): usd on alpha | a session is multi-item only when two real items carried usage... (case 1) | tests/costs.test.ts:1058 |
| 2. starting with no item then alpha: usd on alpha; tokens of the `(none)` stretch stay `(none)` | same test (case 2) | tests/costs.test.ts:1058 |
| 2. real usage on alpha and beta: `(multi-item)`; column sums to real spend | same test (case 3) | tests/costs.test.ts:1058 |
| 2. no real item carried usage: usd on `(none)` | a session with no real item carrying usage puts its cost on (none) | tests/costs.test.ts:1115 |
| 3. leftover marks lock, hook killed mid-wait: no rows written, next flush counts once | a hook killed while it waits on a leftover lock leaves no rows that the next flush writes again | tests/costs.test.ts:1132 |
| 4. figure removed | docs only; `rg "20%" docs/wiki` returns nothing | docs/wiki/The-CLI.md |

## Fail-before reds

The round-2 `src/costs.ts` (`git show HEAD:src/costs.ts`) in a scratch copy with the new tests:

```
28 pass / 3 fail
(fail) a session resumed after its marks were more than 14 days old is not written twice     (change 1)
(fail) a session is multi-item only when two real items carried usage; ...                    (change 2)
(fail) a hook killed while it waits on a leftover lock leaves no rows ...                     (change 3)
```

Change 2's test covers all three required cases in one test, so one red shows all of them; the
"no item carried usage" test passes against round 2 (it already put the cost on `(none)`), so it
is a pin, not a red. Change 4 is wording and has no test.

## Commands

```
$ PATH=/Users/romerma/.nvm/versions/node/v24.14.0/bin:$PATH npm test
 380 pass
 0 fail
Ran 380 tests across 22 files. [56.19s]
ℹ tests 374
ℹ pass 374
ℹ fail 0
exit=0                              (no item-21 hang)

$ node --test tests/costs.test.ts   (node 24.14.0)    ℹ pass 31, fail 0
$ bun test tests/costs.test.ts                        31 pass, 0 fail
$ bun run typecheck                 $ bunx --bun tsc --noEmit  (exit 0)
$ ./bin/mstack lint-plugin .        PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md   96 relative links checked, 0 broken
$ claude plugin validate . --strict  red only for the CLAUDE.md-at-root and ICON_MISSING warnings
budget (bun, 50 MB): onStop=0.13ms stop(hook)=55.1ms vs 53.7ms bare, session-end=30ms, repeat=0.1ms; dense 87ms
```

The lock test takes about 5 s (it waits out two 2 s lock breaks on purpose) and carries a 30 s
timeout.

Evidence ladder: rung 3 for all four (suite on both runtimes, red against the previous code).
The kill test uses the real CLI as a subprocess with a real SIGKILL; none of this round was
re-proved against a live Claude Code session. Known limits are unchanged from round 2 apart from
the narrowed crash window.
