# Implementation report, round 3 - withlock-enters-without-the-lock

Branch `fix/withlock-enters-without-the-lock`, started at `c82902e`. Last code-changing commit
`9499621`. Scope was the `review-r3` row of `.mstack/decisions.tsv`: three blockers, plus the
two non-blocking notes that fit in a few lines.

## What changed

`withLock` gained a test seam, `options.step`, called at four named steps (`lock-created`,
`guard-created`, `judged-stale`, `waiting`) and doing nothing when absent. With it,
`tryCreate` now reads the lock back by path after writing the owner through the fd, and
returns true only when the lock carries this caller's token; otherwise it closes the fd and
returns false without touching the path (blocker 1). The empty-guard branch has a test
(blocker 2). The statistical race test and `tests/lock-racer.ts` are gone, replaced by a
deterministic test through the seam that kills M14 on both runtimes. Every process-spawning
test has an explicit 90 s timeout, the bench kills its children after 45 s (a watchdog) so a
failure is a red and never a stall, the writer in the partial-owner test is bounded by 500 ms
of time, and no test waits on a wall-clock margin (blocker 3). Notes c and d (second half) are
done; d's first half is left. The doc comment above `withLock` describes the read-back, the
seam and a Known limits list.

## Files

- `src/tsv.ts` (seam, read-back, note c, note d, doc comment)
- `tests/tsv.test.ts` (new tests, race test removed, timeouts, watchdog)
- `tests/lock-holder.ts` (optional `blockAt` and `signal` step arguments)
- `tests/lock-racer.ts` (deleted, nothing uses it)
- `.mstack/progress/current.md`, this report, one `decide` row, one ledger row

Commits (oldest first): `c672e50` test: empty guard (passes on correct code, lands alone);
`8242310` refactor: the seam; `0ffcdc8` test: creator that lost its lock (red); `d7b45a8` fix:
read-back (green); `303d828` test: M14 through the seam, race test dropped; `386a911` test:
timeouts and watchdog; `6975c9f` test: notes c and d (red); `b534aaa` fix: notes c and d;
`9499621` docs: the doc comment.

## Findings answered

| Finding | Reproduced? | What I did | Test |
|---|---|---|---|
| Blocker 1: creator stopped between create and write is broken as a leftover and enters beside the breaker | Yes: the new test failed on the unfixed code on both runtimes (`C entered beside W`) | read-back by token after the fd write; on a mismatch close the fd and return false, path untouched; the guard gets the same read-back because `tryCreate` serves both | `tests/tsv.test.ts:149`; seam steps `src/tsv.ts:256`; read-back `src/tsv.ts:270` |
| Blocker 2: empty-guard branch untested, N8 survives | Yes: N8 passed the suite before; now killed | wrote the test the review asked for | `tests/tsv.test.ts:273` (N8 killed, node and bun) |
| Blocker 3a: `:260` hits bun's 5 s default under load | Not reproduced by me in 4 bun suites at once, and 4 bun plus 3 node suites with 18 busy loops, twice (the time is now 500 ms of hammering plus boot) | explicit timeout, writer bounded by time | `tests/tsv.test.ts:326` |
| Blocker 3b: statistical race test times out and leaves racers | Not reproduced (it is deleted) | deleted it and `tests/lock-racer.ts`; M14 now killed deterministically on both runtimes | `tests/tsv.test.ts:364` |
| Blocker 3c: every spawn test needs a timeout, kills children, no wall-clock margin | Applies to the 4 s and 1.5 s bounds in the old tests | `SPAWN_TEST` on all 15 spawn tests; bench watchdog at 45 s; waits are bounded by 20 s on journal signals; `probe` kill slack 3 s to 15 s; test 120 waits for B's exit instead of 1.5 s | `tests/tsv.test.ts:38-45`, `:63-70` |
| Note c: directory at the lock path older than 2 s throws a raw system error | Yes (`SystemError EISDIR` on node) | `rmSync` failure in `tryBreakStale` returns false, so it is waited on to the deadline and throws a `UserError` naming the lock | `tests/tsv.test.ts:521`; `src/tsv.ts:322-330` |
| Note d, second half: a removal on the deadline pass throws although the lock is free (N2) | Yes (`timeoutMs: -1` threw) | one extra pass after a removal that crosses the deadline (`lastChance`, still bounded) | `tests/tsv.test.ts:537`; `src/tsv.ts:179-191` |
| Note d, first half: the message names the dead lock owner when the guard is what blocks | Not changed | left: naming the real blocker needs `tryBreakStale` to report what held it, more than a few lines | none |

No finding was rebutted, so there is no `--phase implement` row for a rebuttal. One row records the
round 3 design choices.

## Commands

All from `/Users/romerma/Code/mstack`.

```
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 394 / ℹ pass 394 / ℹ fail 0 / ℹ duration_ms 18438     (before: 390 tests, 19347 ms)
$ bun test ./tests
 394 pass / 0 fail / Ran 394 tests across 20 files. [58.46s]   (before: 390 tests, [65.11s])
$ bunx --bun tsc --noEmit                 -> no output (ok)
$ ./bin/mstack lint-plugin .              -> PASSED - 0 failures, 0 warnings
$ node ... --test tests/tsv.test.ts       -> pass 24, fail 0, 2.6 s
$ bun test ./tests/tsv.test.ts            -> 24 pass, 0 fail [2.07s]
```

Wall time: node 19.4 s to 18.4 s (files run in parallel, so it only gains what the longest
file did), bun 65.1 s to 58.5 s (files run in series; the race test cost about 7 s there). The
tests count 390 to 394: minus the race test, plus the read-back, M14, empty-guard, directory
and deadline tests.

Original repro (`repro/lock.mjs`, `T0` set; A 3500 ms, B at 200 ms holding 300, C at 2300 ms
holding 300):

```
A|    51ms A ENTER
B| file:///Users/romerma/Code/mstack/src/tsv.ts:195  throw new UserError(   (B exit at 2294 ms)
A|  3552ms A LEAVE lock-file-present=true
C|  3554ms C ENTER
C|  3855ms C LEAVE lock-file-present=true
```

B never entered; A left with its lock still on disk; C entered after A. (I filtered B's stack
trace; its message is the UserError the CLI check below shows in full.)

CLI against a live holder, throwaway store (`impl52r3/cli-store`), `tests/lock-holder.ts`
holding `decisions.tsv.lock` and `costs-marks.jsonl.lock`:

```
$ ./bin/mstack decide ...      (cwd the store)
mstack: <store>/.mstack/decisions.tsv.lock is held by pid 39593 and did not let go in 2003 ms
        wait for pid 39593 to finish, or stop it; if it is not an mstack process, remove <store>/.mstack/decisions.tsv.lock
decide exit=2
$ echo '{}' | ./bin/mstack hook session-start
{"hookSpecificOutput":{"hookEventName":"SessionStart", ...}}   hook session-start exit=0
```

## Mutants

Each applied by script to `src/tsv.ts` in this checkout, `tests/tsv.test.ts` run on node and
on bun, then restored (`git status --short` was clean after every one and at the end).

| Mutant | Edit | Killed by (identical on node and bun) |
|---|---|---|
| read-back removed (blocker 1) | `return readOwner(path)?.token === token;` becomes `return true;` | `a creator that lost its empty lock to a breaker...` (`:149`) only |
| N8 (blocker 2) | `if (owner?.token === token) rmSync(...)` | `an empty guard left by a process killed...` (`:273`) only |
| M14 (blocker 3) | the re-check under the guard deleted | `a waiter that judged a lock dead does not remove the live lock...` (`:364`) only, deterministic |
| M16 | `if (owner !== null && !alive(owner.pid)) return true;` | `a live holder's lock is never aged out...` (`:236`) |
| M9 (no guard) | `if (false && !tryCreate(guard ...))` | `:295`, `:257`, `:273` |
| M10 (dead-guard line deleted) | line removed | `:257`, `:273` |
| M6 (a pid always reads alive) | `alive()` returns true | five tests (`:187`, `:257`, `:273`, `:364`, `:537`); the run ended, the watchdog killed the waiting children (88 s for both runtimes together, no stall, no children left) |
| note c reverted | `catch (e) { throw e; }` | `:521` |
| note d reverted | `if (removed && waited <= timeout)` | `:537` |
| `src/decisions.ts:53` without `withLock`, in a scratch copy | `((run) => run())(() => {` | `tests/decisions.test.ts:428` red on node and bun |

## Load runs (unmutated code)

| Condition | Runtime | Result |
|---|---|---|
| `tests/tsv.test.ts` alone, 30 runs, quiet | node / bun | 30 of 30 / 30 of 30 |
| same, under 18 busy loops, 30 runs | node / bun | 30 of 30 / 30 of 30 |
| 4 full bun suites + 2 full node suites at once, 2 rounds | 8 node-or-bun suites each round | 12 of 12 suites green, 394 of 394 each |
| 4 bun + 3 node full suites at once under 18 busy loops, 2 rounds | 14 suites | 0 failures in any tsv test; failures in other files, below |

Failures seen on unmutated code (all outside `tests/tsv.test.ts`, reported not fixed):
- `tests/run.test.ts:54` "tail keeps the last lines of stdout and stderr, and the temp file is
  removed": node 6 of 6 suites in the heavy runs and bun 3 of 8 (message `a temp directory was left behind`:
  it lists `mstack-run-*` in the shared tmpdir before and after, so a concurrent suite's directory
  shows up; it needs several suites sharing a tmpdir).
- `tests/costs.test.ts:698` "hook paths stay within budget on a 50 MB transcript": node, 4 of 6
  suites (about 3.2-3.5 s under 18 busy loops, the one the reviewer already saw).
- No bun `NotImplementedError` cascade appeared, and every bun suite ran all 394 tests.

## Acceptance to test

| Acceptance | Test | Where |
|---|---|---|
| 1. a timed-out waiter never runs beside a live holder; real concurrent processes; fails on unmodified code | `a waiter that times out on a live holder...`, `a waiter on a live holder throws...`, `a live holder's lock is never aged out...` | `tests/tsv.test.ts:120`, `:213`, `:236` |
| 2. removes only a lock it created; break, then the same atomic create before entering | `a creator that lost its empty lock...` (read-back), `a waiter that judged a lock dead...` (re-check under the guard), `a release does not remove...`, `a lock left by a killed process is broken...` | `:149`, `:364`, `:475`, `:187` |
| 3. a killed process's lock does not hang | `a lock left by a killed process...`, `a guard left by a dead process...`, `an empty guard left by...`, `an old lock with an unreadable owner...` | `:187`, `:257`, `:273`, `:504` |
| 4. what a waiter does is recorded with decide | design row 2026-11-16T16:46:08.291Z, rounds 2 and 3 rows in `.mstack/decisions.tsv`; code throws a UserError, shown above | `src/tsv.ts:195` (the throw at the deadline) |
| 5. concurrent decisions test launches processes together; removing `withLock` fails it | `concurrent decisions do not share a timestamp...` (unchanged this round; mutation shown above, red on node and bun) | `tests/decisions.test.ts:428` |

## Left undone, and honest limits

- Note d first half (the message names the dead lock owner when the guard blocks) is not changed.
- `SIGNAL_MS` is 20 s and the watchdog 45 s, so a real regression is red within about a minute
  per runtime (M6: five red tests, 88 s for both runtimes), never a stall; I did not make that
  tighter, because the bar was zero false failures.
- If the read-back itself cannot read the file, the caller treats its own lock as someone else's
  (fail-closed); listed under Known limits, not tested.
- Rung: the blockers are at rung 4 (real processes, real code, seam-stopped, each mutant killed on
  both runtimes), the CLI and the original repro at rung 5. Everything ran on this machine
  (macOS, APFS temp volume, node v26, bun 1.3.11); I did not re-run the exFAT or read-only stores
  from round 2, whose paths this round does not touch except for the shared `tryCreate` read-back.
