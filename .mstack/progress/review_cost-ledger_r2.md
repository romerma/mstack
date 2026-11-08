# Review r2 - cost-ledger (item 37), delta over 8aca613

**Verdict:** CHANGES_REQUESTED

HEAD 67a25b4a; the fix is 0b0c484. I reran the round-1 reproductions. Findings 1, 2, 4 and 5
are fixed and hold under those reproductions. Finding 3 matches the decision's wording but
misfires on the usual item-closing session. The fix for finding 2 opens a new double count: a
session resumed after the 14-day prune is counted twice. Real spend on probes this round: about
$0.013 (six haiku sessions).

## Round-1 findings, rechecked

| # | Status | Evidence |
|---|---|---|
| 1 fresh sessions | **fixed** | 6/6 real fresh sessions: one mark at offset 0, `main` equal to the transcript, all rows equal to cost-state, usd equal to real. Table below |
| 2 union double count | **fixed for the branch case**; new double count via prune, required change 1 | two-branch rerun: 150/15/$1.5, real 150/15/$1.5 |
| 3 per-item usd | matches the decision's wording, misfires on a common case | required change 2 |
| 4 prune race | **fixed** | rerun of my repro: `xsess` keeps mark, flushed and ended after a pass that also pruned `gone` |
| 5 GIT_DIR | **fixed** | GIT_DIR: walk = git = `subsrc/.git/mstack`. GIT_COMMON_DIR: both `.git/mstack`. Submodule still matches |

## 1. Fresh sessions, real probes through this checkout's hooks

Fresh scratch repo `repo_r2`, item `probe` active, logger plus `/Users/romerma/Code/mstack/bin/mstack
hook <event>` on SessionStart, Stop, SubagentStop and SessionEnd, `claude` 2.1.319, haiku. The
check script dedupes the transcript's own non-sidechain usage by `message.id` and compares it
with the rows:

```
8c103756 -p "say hi"          marks@[0]  main == transcript  all == cost-state  usd 0.002034 == 0.002034
0ea8ea49 -p "say hi"          marks@[0]  main == transcript  all == cost-state  usd 0.001582 == 0.001582
3e5878c4 -p --max-turns 1     marks@[0]  main == transcript  all == cost-state  usd 0.001602 == 0.001602  (error_max_turns, no Stop)
d7868a7b interactive /exit    marks@[0]  main == transcript  all == cost-state  usd 0.002648 == 0.002648
de20d8a9 interactive Ctrl-C   marks@[0]  main == transcript  all == cost-state  usd 0.002565 == 0.002565
f7d3227e interactive HUP      marks@[0]  main == transcript  all == cost-state  usd 0.002534 == 0.002534
```

In round 1 the same shapes gave no `main` rows in 3 of 4 single-turn sessions, and zero rows for
the max-turns run. In the two interactive sessions with an internal `agent_type ""` subagent,
the `unattributed` row is that call's usage (506 input / 40,5xx cache reads) and nothing else.
That is reconciliation doing its job.

**The one-day grace in `prune` (`src/costs.ts:431`).** I looked for a way it could lose or
double usage:
- It cannot double: `needsFlush` is false while the transcript is missing, so a kept
  missing-transcript mark is never flushed.
- It cannot lose: a session whose transcript never appears (transcript saving off, or opened
  and never used) has nothing to lose.
- The one edge: a session left open more than a day before its first prompt has its offset-0
  mark pruned by another session's SessionStart. The first Stop then re-marks at the current
  size, so that first turn is attributed to `unattributed`. The tokens are still counted.
  Acceptable.

## 2. Union merge, and the crash window

My two-branch script, unchanged, against the real CLI hooks: flush on `feat/a` and commit, an
extra `mstack cost` there, checkout `main`, resume, more usage, flush and commit, then merge:

```
mstack cost total: {'input': 150, 'output': 15, 'cost_usd': 1.5}  real: input 150 output 15 usd 1.5
```

The test `tests/costs.test.ts:851` asserts the same thing.

**Crash between the rows and the `flushed` record.** Writing the rows first is the right
order for this ledger. An over-count makes mstack look more expensive, which is the
conservative error for a "got cheaper" headline. Recording `flushed` first would flatter it.
I accept the residual window as a documented limit (`docs/wiki/State-Files.md:261`), with one
catch. The window is not just two adjacent appends today: the `flushed` append goes through
`appendLine`, which busy-waits up to 2 s on the marks lock (`src/costs.ts:817-820`, `:282`).
Reproduced with a leftover lock: `costs-marks.jsonl.lock` present, `hook session-end`
killed after 1 s, then `mstack cost`:

```
rows after the killed flush: 2
after the next flush: input 200 usd 2   real: input 100 usd 1.0
```

The killed hook also leaves its costs lock behind, so the next flush waits again. See required
change 3.

## Changes required

1. **`src/costs.ts:433` (with `:417-440`): the 14-day prune deletes a session's `flushed`
   totals while its transcript still exists. A later `--resume` then writes the session
   again.** Before this fix, the same case was correct, because the delta subtracted the rows
   in costs.tsv. Now the totals live only in the marks file, and `prune` drops the whole
   session (marks, flushed, ended) once `ended` is 14 days old. Claude Code keeps transcripts
   for 30 days by default, so a resume in days 14 to 30 re-emits:
   - every subagent's full totals, because subagent files are re-read whole;
   - the cumulative cost-state minus almost nothing.

   Reproduced with the real CLI hooks:
   - flush (main 100, one subagent 40, cost-state 150/15/$1.0);
   - age the marks 20 days and let another SessionStart prune;
   - resume with 50 more (cost-state 200/20/$1.5), then SessionEnd.

   ```
   @0    main 100 / subagent 40 / unattributed 10, $1.0
   @427  main  50 / subagent 40 / unattributed 110, $1.5
   mstack cost total: 350 35 2.5    real: 200 20 1.5
   ```

   Fix: never drop a session's flushed totals while its transcript exists. Drop on a missing
   transcript (past the grace), or keep a compact `flushed` line for aged sessions. Test: settle,
   age `ended` past 14 days, prune, resume and flush, then assert the sums equal the last cost-state.

2. **`src/costs.ts:732-733`: "multi-item" is decided from marks, not from where the usage is.**
   A session that works only on `alpha` and closes it in its last turn gets a trailing
   `(none)` mark from the Stop that follows the close. That mark's range is empty, yet the
   whole session's cost goes to `(multi-item)`. Real CLI-hook reproduction (session C: 70 tokens,
   all on alpha):

   ```
   cccc...@0    alpha         main          70  (none)
   cccc...@242  (multi-item)  unattributed  0   0.7
   ```

   The decision row says "every mark names the same item". Its reason says "a session that
   spanned items". Session C did not span items. Every mstack session that closes an item ends
   like this, so per-item usd would be empty for exactly the sessions that finish work. Fix:
   build `items` from runs that carry usage (main ranges with nonzero tokens, plus subagents'
   assigned runs), and add a test where a trailing empty mark keeps the cost on the item.

   A separate case is a session that opens with no active item and picks one in its first turn
   (session A: 10 tokens in `(none)`, 90 on alpha, so the cost goes to multi-item). It really does span
   `(none)`, so whether that counts as two items is a product choice. The coordinator should
   answer it through `mstack decide`, not the implementer.

3. **`src/costs.ts:817-820`: take the marks lock before appending the rows.** Then the rows and
   the `flushed` record are adjacent writes with no 2 s wait between them. Today the order is
   costs lock, then marks lock, and nothing takes them the other way round, so nesting is safe.
   But `withLock` is not re-entrant: if `appendLine` is called inside the held marks lock, it
   waits 2 s and then breaks its own lock. Write the two lines directly. This does not close the
   window, which stays a documented limit. It removes what widened it.

Nit: `docs/wiki/The-CLI.md:371` still cites "about 20% of the cache reads in one measured
session with a subagent" as calls a transcript never records. That measurement was taken
before the fix and was the first turn, which sat before the first mark. Drop the figure, or
replace it with the internal-subagent case above.

## Verification I ran

```
$ ./bin/mstack gate --quiet                                     -> exit 0
$ bun test tests/costs.test.ts tests/hooks.test.ts tests/cli.test.ts
 80 pass / 0 fail   (bun exit=0)
budget: transcript=50.3MB onStop=0.12ms stop(hook)=54.9ms vs 51.5ms bare session-end=29ms repeat=0.1ms; dense 83ms
$ node --test tests/costs.test.ts tests/hooks.test.ts tests/cli.test.ts   (v24.14.0)
ℹ tests 80 / pass 80 / fail 0 / cancelled 0   (node exit=0)
budget: onStop=0.10ms stop(hook)=64.4ms vs 64.1ms session-end=37ms; dense 119ms
$ bun run typecheck                                             -> exit 0
$ ./bin/mstack lint-plugin .                                    -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack ledger check cost-ledger
FAIL no verdict at 67a25b4a; 3 row(s) exist at other SHAs and a new head SHA voids them
```

I did not run the full suite, as instructed. No round-1 assertion was weakened: the only edits
to old tests are three `fake(undefined, true)` seeds, where the old fixture had always seeded.

Extra budget check: `onStop` against an accumulated marks file of 3.7 MB took 0.9 ms, and 2.6 ms
at 14 MB. The growing `flushed` snapshots are not a hot-path problem.

Evidence ladder:
- Rung 5: the fresh-session table (real sessions, the running system).
- Rung 4: the two-branch merge, the prune-then-resume double count, the killed-flush double
  count, the multi-item misfire and GIT_DIR. All used the real CLI hooks or `marksDir` on
  synthetic transcripts.
- Still unobserved: SIGKILL, `/clear`, and whether Claude Code cuts SessionEnd hooks short of
  their 5 s.
