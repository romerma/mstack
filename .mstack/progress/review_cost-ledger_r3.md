# Review r3 - cost-ledger (item 37), delta over 67a25b4

**Verdict:** APPROVED

HEAD 4c88bc2a; the fix is 491f2ef. Scope is the `review-r3` decision row:
1. the prune double count;
2. the multi-item rule, as refined by the 13:52:39 decision row;
3. the marks lock taken before the rows;
4. the stale 20% figure.

All four are done. Each of my three reproductions now gives the real figure. One live haiku
session plus a resume reconciles to the token and the cent. Spend this round: about $0.0024.

## The three reproductions, rerun against HEAD with the real CLI hooks

**1. Prune after more than 14 days, then resume, then flush.** The steps:
- flush (main 100, subagent `sub1` 40, cost-state 150/15/$1.0);
- age every marks record to 20 days and let another session's SessionStart prune;
- resume with 50 more (cost-state 200/20/$1.5), then SessionEnd.

```
S records after prune: ['mark', 'flushed', 'ended']
@0 alpha main 100/10 · subagent sub1 40/4 · unattributed 10/1 $1 · main 50/5 · unattributed 0/0 $0.5
mstack cost total: 200 20 1.5    real: 200 20 1.5        (round 2: 350 35 2.5)
```

The subagent is not re-emitted. `prune` now keeps a session as long as its transcript exists
(`src/costs.ts:427-435`).

**2. Item-closing session with a trailing `(none)` mark.** Five sessions through the CLI hooks
(A: opens with no item, then picks alpha; B: alpha throughout; C: closes alpha in its last
turn; D: beta, then no item; E: alpha, then beta):

```
cccc...@0    alpha  main          70  (none)
cccc...@242  alpha  unattributed  0   0.7          (round 2: (multi-item))
aaaa...@0    (none) main 10 · @242 alpha main 90 · alpha unattributed $1
eeee...@0    alpha main 20 · @242 beta main 30 · beta unattributed 10 · (multi-item) $3
{'alpha': (230, 2.2), 'beta': (60, 2), '(none)': (40, None), '(multi-item)': (0, 3)}  total usd 7.2 = real 7.2
```

This matches the refined decision on every case. The usd goes to the one real item that
carried usage (A, B, C, D). It goes to `(multi-item)` only when alpha and beta both carried
usage (E). `(none)` stretches keep their tokens and never make a session multi-item. The column
still sums to real spend.

**3. A leftover lock, then a hook killed during the wait.** First with a stale
`costs-marks.jsonl.lock`, then a variant with a stale `costs.tsv.lock`:

```
session-end killed after 1 s (exit=142)
rows after the killed flush: 0; leftover locks: 2
after the next flush: input 100 usd 1   real: input 100 usd 1.0     (round 2: 200 / 2)
after one more flush: input 100 usd 1
variant killed (exit=142) rows: 0 · variant after next flush: input 100 usd 1
```

## Live session through this checkout's hooks

`repo_r2` (scratch, hooks: logger plus `/Users/romerma/Code/mstack/bin/mstack hook <event>`),
`claude -p "say hi" --model haiku`, then `claude -p "Say ok." --resume <id>`:

```
== SessionStart size=missing · Stop 97766 · SessionEnd 159908 cost-state=1
== SessionStart 159908 (resume) · Stop 163490 · SessionEnd 166981 cost-state=2
9616af9a marks@[0]  main == transcript [4, 10606, 25986, 69]  all rows == cost-state  usd 0.002416 == 0.002416
```

The usd rows are 0.00152 + 0.000896, which equals the cumulative cost-state.

## The two edited existing tests

Both still assert exactly what they asserted before. Only the session that triggers the rewrite
changed: it was "settled 30 days ago" and is now "transcript gone, 30 days old". Under the new
rule the old fixture is kept, so the rewrite these tests depend on would no longer happen.
- **Prune race (`tests/costs.test.ts:931`).** The assertion is unchanged: the old session is
  pruned and the mark appended through the `beforeLock` seam survives. A prune that read its
  snapshot before the seam would still lose that mark and go red.
- **Flushed totals survive a prune (`tests/costs.test.ts:963`).** The assertions are unchanged:
  "the rewrite happened", no new rows after a forced flush, and the flushed totals are non-empty.
  With the old fixture, the "rewrite happened" assertion would fail under the new rule. The edit
  was needed and weakens nothing.

No other existing test changed.

## Can the costs-wraps-marks lock deadlock?

No. Every `withLock` in `src/`:
- `decisions.ts:53`: the decisions file only.
- `costs.ts:283`, `appendLine`: the marks lock only, around one `appendFileSync`. Its callers are
  the marks written by `onStop`, `onSessionStart` and `onSessionEnd`.
- `costs.ts:419`, `prune`: the marks lock only. It reads, writes a tmp file and renames, and
  takes no other lock.
- `costs.ts:742/752`, `flushSession`: the costs lock, then the marks lock. This is the only
  nesting.

`flushSession` is never called with the marks lock held. Its callers are the
`onSessionStart` loop, `onSessionEnd` and `flushAll`, and `prune` runs after the loop, not
around it. Nothing takes the marks lock and then the costs lock, so there is no inversion.
Two stores sharing one git dir each take their own costs lock and then the shared marks lock,
which is the same order. In any case `withLock` breaks a lock after 2 s, so the worst outcome
is a forced break, never a hang. The kill test shows the break does not double count.

## Verification I ran

```
$ ./bin/mstack gate --quiet                                    -> exit 0
$ bun test tests/costs.test.ts tests/hooks.test.ts tests/cli.test.ts
 84 pass / 0 fail   Ran 84 tests across 3 files. [14.52s]   (exit 0)
budget: transcript=50.3MB onStop=0.18ms stop(hook)=61.0ms vs 52.9ms bare session-end=29ms repeat=0.1ms; dense 83ms
$ node --test tests/costs.test.ts tests/hooks.test.ts tests/cli.test.ts    (v24.14.0)
ℹ tests 84 / pass 84 / fail 0 / cancelled 0   (exit 0)
budget: onStop=0.09ms stop(hook)=61.9ms vs 60.4ms session-end=36ms; dense 116ms
$ bun run typecheck            -> exit 0
$ ./bin/mstack lint-plugin .   -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack ledger check cost-ledger
FAIL no verdict at 4c88bc2a; 5 row(s) exist at other SHAs and a new head SHA voids them   (before my row)
$ rg -n "20%" docs/wiki README.md   -> nothing
```

I did not run the full suite, as instructed; the coordinator runs `gate --full`.

## Non-blocking (file them if wanted)

1. Marks-file growth. Sessions now stay until their transcript is gone, and `prune` compacts the
   file only when it drops a session. With Claude Code's default 30-day cleanup that happens
   regularly. With cleanup turned off, the file grows without limit. Measured: `readSessions`
   took 16 ms at 13.9 MB and 79 ms at 69.5 MB, and `onStop` took 2.6 ms at 14 MB. That is not a
   problem today. A compaction when superseded `flushed`/`ended` lines pile up would bound it.
2. "Two adjacent writes" (`docs/wiki/State-Files.md`, `src/costs.ts:835-842`) is really one
   `appendFileSync` per row and then one for the records. A kill between row appends leaves a
   partial delta that the next flush writes again in full. Joining the rows into a single append
   would make the residual window what the docs describe.

Evidence ladder:
- Rung 5: the live fresh-plus-resume session.
- Rung 4: the three reproductions (real CLI hooks, synthetic transcripts), the deadlock walk
  backed by the kill test, and the suite on both runtimes.
- Still unobserved: SIGKILL of Claude Code itself, `/clear`, and whether Claude Code cuts
  SessionEnd hooks short of their 5 s.

I recorded `test-verified`, the rung the item as a whole reached.
