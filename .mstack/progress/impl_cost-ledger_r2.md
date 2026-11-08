# Implementation report, round 2: cost-ledger (item 37)

Answers `.mstack/progress/review_cost-ledger.md` (CHANGES_REQUESTED at 8aca6132). Delta over
d8e694a. Verdict: **test-verified**.

## What changed

1. **Fresh sessions.** The transcript does not exist at SessionStart, so no mark was written and
   the first turn fell into `unattributed`. `newMark` now writes offset 0 when the file is
   missing; `onSessionEnd` marks a session that has no mark (offset 0, from `transcript_path`)
   before flushing, so a session with no Stop is recorded. `prune` no longer treats a missing
   transcript as a dead session until the mark is a day old (it had deleted the new mark at once).
2. **`merge=union` double count.** What a machine has flushed per key (`main|run|model`,
   `sub|agent|model`, `cs|model`) is kept in the marks file under the git dir, as a `flushed`
   record, and a flush writes `total - flushed`. `costs.tsv` is never read to compute a delta.
   The record is re-read under the lock, and written after the rows. `prune` carries it over.
   `src/setup.ts` comment no longer says "every row stands alone".
3. **Per-item usd.** A session's `cost_usd` goes to an item only when every mark names the same
   item. Otherwise the cost is a row with `target=(multi-item)` (no tokens, whole delta), and the
   token remainder stays on the last item with no cost. `mstack cost --by item` prints that row as
   `multi-item sessions`. No split by token share. The column still sums to real spend.
4. **`prune` race.** `prune(file, beforeLock?)` re-reads the file under the lock and rewrites from
   that. It also preserves flushed totals and ended records.
5. **`GIT_DIR`.** `marksDir` asks git when `GIT_DIR` or `GIT_COMMON_DIR` is set.

Known limits, not changed (listed in State-Files and as a comment at `src/hooks.ts`): the
SubagentStop panel case (`some`) and a resumed subagent keeping its first timestamp; the Stop stat
racing the last assistant line; a crash between appending rows and recording flushed totals writes
that delta twice.

Fixture change: `fake()` no longer pre-creates the transcript (it was why the old tests hid
finding 1); tests that need an existing file pass `seed`. Docs fixed at the lines the review named
and the `mstack cost` example replaced with output from the real single-turn run below.

## Files

```
M src/costs.ts  M src/hooks.ts  M src/cli.ts  M src/setup.ts
M tests/costs.test.ts
M docs/wiki/The-CLI.md  M docs/wiki/State-Files.md
A .mstack/progress/impl_cost-ledger_r2.md   M .mstack/decisions.tsv, state.json (bookkeeping)
```

## Rung 4: one real single-turn session through this checkout's hooks

`claude -p "say hi" --model haiku --setting-sources project` in a fresh git project, hooks
SessionStart, Stop and SessionEnd wired to `/Users/romerma/Code/mstack/bin/mstack hook ...`.
Spend about $0.007.

```
claude modelUsage: i=20 o=2274 cr=178698 cw=18478 costUSD=0.00662158   (total_cost_usd 0.00662158)
.mstack/costs.tsv:
2757336b-...@0  demo  main          (none)  claude-haiku-5-5  20 18478 178698 2274  9      (none)    transcript
2757336b-...@0  demo  unattributed  (none)  claude-haiku-5-5   0     0      0    0  (none)  0.006622  cost-state
marks: {"run":"2757336b-...@0",...,"offset":0,"slug":"demo",...}   (transcript absent at SessionStart)
```

`main` equals modelUsage to the token and `unattributed` carries no tokens and the whole cost
(rounded to six places). Before the fix the same shape put the whole turn in `unattributed`.

## R to test

| R | Test | Where |
|---|---|---|
| Finding 1: missing transcript at SessionStart is a mark at 0; single-turn shape yields main rows that reconcile | a single-turn session whose transcript appears after SessionStart still gets main rows that reconcile | tests/costs.test.ts:787 |
| Finding 1: SessionEnd with no Stop and no mark records the session | SessionEnd marks a session nothing marked before... | tests/costs.test.ts:815 |
| Finding 1: crash in the first turn settled by next SessionStart | a session that crashed in its first turn is settled... | tests/costs.test.ts:834 |
| Finding 1: SessionStart mark at current size when the file exists (seeded fixture kept) | SessionStart writes a mark at the transcript's current size... | tests/costs.test.ts:186 |
| Finding 2: flush on feat/a, resume on main, merge: mstack cost equals real total | a session flushed on one branch and resumed on another does not double count... | tests/costs.test.ts:851 |
| Finding 2/4: flushed totals survive a prune, no rewrite of a pruned-then-resumed session | the flushed totals survive a prune... | tests/costs.test.ts:963 |
| Finding 3: cost to an item only if the whole session was on it; multi-item line; column sums to real spend; printed as `multi-item sessions` | cost_usd goes to an item only when the whole session worked on it... | tests/costs.test.ts:895 |
| Finding 4: mark written between snapshot and rewrite survives | prune re-reads the marks file under its lock... | tests/costs.test.ts:931 |
| Finding 5: GIT_DIR set, equals `git rev-parse --git-path mstack` | GIT_DIR is honoured... | tests/costs.test.ts:989 |
| Round 1 A1-A7 | unchanged, still green (27 tests in the file) | tests/costs.test.ts:128-760 |

## Fail-before reds

Scratch copy, one mutation each, `bun test tests/costs.test.ts` (`scratchpad/mutate2.py`):

```
F1 no mark when transcript missing at SessionStart:   RED (7 tests incl. single-turn, crash-first-turn)
F1 SessionEnd does not mark an unmarked session:      RED (1)
F1 prune drops a not-yet-created transcript:          RED (7)
F2 flushed totals not kept machine-locally:           RED (5 incl. the two-branch merge test)
F3 cost always billed to the last item:               RED (1)
F4 prune from a stale snapshot:                       RED (1)
F4b prune drops flushed totals:                       first STILL GREEN (nothing was pruned, so no
                                                      rewrite); test fixed with an old session, then RED
F5 GIT_DIR ignored:                                   RED (1)
```

## Commands

```
$ PATH=/Users/romerma/.nvm/versions/node/v24.14.0/bin:$PATH npm test
 376 pass
 0 fail
Ran 376 tests across 22 files. [49.63s]
ℹ tests 370
ℹ pass 370
ℹ fail 0
exit=0                                   (no item-21 hang)

$ bun run typecheck                      -> $ bunx --bun tsc --noEmit  (exit 0, no output)
$ ./bin/mstack lint-plugin .             -> PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
96 relative links checked, 0 broken
$ claude plugin validate . --strict
  ❯ root: CLAUDE.md at the plugin root is not loaded as project context. ...
  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). ...
✘ Validation failed (--strict treats warnings as errors)      (the two item-50 warnings only)

budget (bun, 50 MB): onStop=0.14ms stop(hook)=69.2ms vs 56.7ms bare, session-end=29ms, repeat=0.1ms
budget (dense, 74,500 turns): session-end=85ms
```

Evidence ladder: rung 4 for the single-turn path (real session, reconciled to modelUsage); rung 3
for the rest (suite on both runtimes; the two-branch merge is a real `git merge` with the union
driver on synthetic transcripts, as the reviewer reproduced it). SIGKILL and `/clear` remain
unobserved.
