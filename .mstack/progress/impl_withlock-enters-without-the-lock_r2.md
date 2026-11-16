# Implementation report, round 2 - withlock-enters-without-the-lock

Branch `fix/withlock-enters-without-the-lock`, started at `11997b6`. Last code-changing commit: see the ledger row (head SHA of `fix: say the system error once...`, `f56b44c`).

## What changed

`withLock` no longer links a temp file into place. The lock is created with an exclusive create (`openSync(path, "wx")`) and the owner is written straight after. Only `EEXIST` means "held"; any other error creating the lock throws a `UserError` naming the lock path and the system error, so a missing or read-only directory fails in milliseconds and a filesystem without hard links (exFAT, where `link` gives ENOTSUP) gets a working lock. The acquire loop now reaches the deadline check or the sleep on every pass unless it has just removed a dead lock itself. `tryBreakStale` returns true only when the caller removed the lock; the redundant `same` comparison and the `existsSync` checks are gone; there is no temp file, so a killed waiter leaves nothing behind. The decision is recorded as an `implement` row in `.mstack/decisions.tsv`. The price: for the instant between create and write a reader can meet the lock empty, which is the legacy "unreadable and young: wait" case, so the old "never visible without an owner" test was relaxed to "never partial" in its own commit (`45a0659`).

Tests: three tests for behaviour that was already correct landed first and alone (`df7e3b0`: a live holder's old lock is not aged out; a dead guard is broken; a live guard is respected; EPERM is alive). The race test was rebuilt (`5631d9f`, tuned in `fe719c0`, `266b660`) and the hang tests came with the fix (`8c69cdd`, `3445bde`).

## Files

- `src/tsv.ts` (fix)
- `tests/tsv.test.ts`
- `tests/lock-racer.ts` (new: child for the race test, many rounds per process, shared start instant)
- `tests/lock-probe.ts` (new: child that tries the lock once, so a hang is a test failure and not a hung suite)
- `.mstack/decisions.tsv` (one `implement` row), `.mstack/progress/current.md`, this report
- Not touched: `src/state.ts`, `src/decisions.ts`, `src/costs.ts`, `tests/costs.test.ts`, any skill, agent, hook config or doc.

## Commits (`git log 11997b6..HEAD`)

```
f56b44c fix: say the system error once when a lock cannot be created
3445bde test: a dangling lock path ends at the deadline instead of spinning
266b660 test: order the lock race by journal appends, not by clocks
dd23b8d test: time the lock race on the system monotonic clock
fe719c0 test: race thirty-two waiters over 120 dead locks so the re-check mutant dies
8c69cdd fix: fail promptly when withLock cannot create the lock, and stop using hard links
45a0659 test: let a reader meet a lock empty, never half-written
5631d9f test: race sixteen waiters over a dead lock, checking the owner from inside
df7e3b0 test: pin live-holder age, dead and live break guards, and EPERM owners
```

`dd23b8d` swapped to `process.hrtime` thinking it was a system-wide clock; under Bun it is relative to process start, which showed up as a false overlap. `266b660` removed clocks altogether (journal append order). Kept in history as is.

## Commands and output

Suite, before (at `11997b6`, 382 tests) and after (389 tests):

```
node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
before: ℹ tests 382 / pass 382 / fail 0, 20.6 s wall
after:  ℹ tests 389 / pass 389 / fail 0, 19.7 s wall   (5 further full runs on the final code, 0 failures)
bun test ./tests
before: 382 pass, 0 fail, Ran 382 tests across 20 files. [62.57s]
after:  389 pass, 0 fail, Ran 389 tests across 20 files. [66.35s]
bunx --bun tsc --noEmit            -> exit 0, no output
./bin/mstack lint-plugin .         -> PASSED - 0 failures, 0 warnings
```

`tests/tsv.test.ts` alone went from about 2.4 s to about 9 s per runtime (the race test is 7 s of that). Node runs files in parallel so the suite wall time did not move; Bun runs them serially and pays about 4 s.

Hang, on the real surfaces (store = scratch git repo with `./bin/mstack setup`, new code):

```
APFS, normal                      decide  exit=0 in 26 ms  "recorded"
APFS, .mstack chmod 555           decide  exit=2 in 25 ms  mstack: cannot create the lock .../.mstack/decisions.tsv.lock: EACCES: permission denied, open '...'
                                  hook session-start exit=0 in 29 ms | hook stop exit=0 in 70 ms | hook session-end exit=0 in 30 ms
exFAT volume (hdiutil, mount: exfat; node: link -> ENOTSUP)
                                  decide  exit=0 in 28 ms "recorded"  (twice: 28 ms, 29 ms; both rows present)
                                  hook session-start exit=0 in 33 ms | hook stop exit=0 in 68 ms | hook session-end exit=0 in 28 ms
                                  leftover lock/tmp files: none
```
The volume was detached and the image deleted; `.mstack` was restored to writable. Round 1 saw the same commands hang at 99.6% CPU on the old head.

Original repro (A 3500 ms, B at 200 ms holding 300 ms, C at 2500 ms holding 300 ms; `T0` set):

```
A|    50ms A ENTER
B| UserError: .../t.tsv.lock is held by pid ... and did not let go in 2002 ms   (B never entered)
A|  3550ms A LEAVE lock-file-present=true
C|  3552ms C ENTER
C|  3852ms C LEAVE lock-file-present=true
leftovers: (none)
```

Acceptance 5, mutation `src/decisions.ts:53` `withLock(...)` replaced by a direct call, `tests/decisions.test.ts`: `concurrent decisions do not share a timestamp, because the timestamp is the key` red (restored).

## Findings answered

| Finding | Reproduced? | What I did | Test (`file:line`) |
|---|---|---|---|
| 1 Hang when the lock cannot be created | Yes: with the old `tryCreate` restored (mutant B1), the missing-dir and read-only tests are killed by the probe deadline (3.2 s each). Real surfaces above. | Exclusive create + write (decision row); only EEXIST is "held"; others throw `UserError` naming the lock; the loop cannot skip both deadline and sleep. exFAT works (28 ms). | `tests/tsv.test.ts:364` (missing dir), `:378` (read-only dir, skipped as root), `:395` (dangling symlink at the lock path: EEXIST yet `existsSync` false, which would also spin with a naive `continue`) |
| 2 Central test misses a live holder at the real 2 s limit | Yes: mutant M16 passed all 12 tests on the old code; with `df7e3b0` it fails exactly one. | Test with a live holder whose lock is `utimes`-aged 60 s, default limit, waiter 100 ms: must throw, not enter, leave the lock. No injectable option needed. | `tests/tsv.test.ts:192` |
| 3 Race test cannot see the race | Yes (reviewer's M14 passed 10/10). | Rebuilt: 32 persistent racer processes, 120 rounds, shared start instant (`tests/lock-racer.ts`), a fresh dead lock planted each round, each racer checks from inside that the lock on disk carries its own pid, overlap judged by journal order. Measured, with M14 applied to the final code: node 15/15 red, bun 14/15 red (15 runs each, final version). Earlier 16-waiter x 60-round version: node 6/10, bun 9/10. Cost: about 7 s for the test on each runtime. Not 100%: a miss is possible about 1 run in 15 on Bun. M9 (guard dropped) and M10 are killed deterministically by the tests below, so the guard has two deterministic pins besides the race. | `tests/lock-racer.ts`, `tests/tsv.test.ts:297` |
| 4 Dead guard untested | Yes (M10 passed). | Dead lock plus dead guard: the caller enters, holds its own lock, nothing left. The guard file was kept, so this is a live mechanism and not moot. | `tests/tsv.test.ts:213` |
| a Orphan `.tmp` from killed waiters | Yes (7/40). | Removed by design: there is no temp file. Test that taking and releasing leaves the directory as it was. A waiter killed between create and write can leave an empty lock; that is broken after 2 s by the existing rule. | `tests/tsv.test.ts:411` |
| b Surviving mutants (EPERM, `same`, no guard) | Yes. | EPERM: lock naming pid 1, must be held (skips as root). `same`: deleted, the under-guard `isStale` re-check subsumes it. No guard: live guard held by another process blocks the break (deterministic), plus the race test. | `tests/tsv.test.ts:246`, `:229` |
| c Dead conditional | Yes. | Line removed (`df7e3b0`). | `tests/tsv.test.ts:422` |
| d `UserError` imported from `paths.ts` | n/a | Left. A real move must update every importer, and `src/state.ts` (16 uses, out of scope, item 53) is one. A re-export from `paths.ts` would keep the upward dependency in practice. Suggest doing it with item 53. | - |

No finding was rebutted.

## Mutants (all applied by script, test file `tests/tsv.test.ts`, then restored; `git status` clean afterwards)

| Mutant | Edit (new code) | Killed by | Result |
|---|---|---|---|
| B1 swallow create errors | `tryCreate`: `if (code === "EEXIST") return false; throw ...` becomes `return false;` | `...directory is missing fails promptly...`, `...read-only fails promptly...` (hang reported by deadline) | killed |
| B1b skip the deadline | loop `if (removed && waited <= timeout) continue;` becomes `if (removed \|\| !existsSync(lock)) continue;` | `a lock path that exists but cannot be read is waited on...` | killed |
| M16 age out live owner | `isStale`: `if (owner !== null && !alive(owner.pid)) return true;` | `a live holder's lock is never aged out` | killed |
| M14 no re-check under guard | delete `if (!isStale(lock, readOwner(lock))) return false;` in `tryBreakStale` | `waiters ... never hold the lock together` | node 15/15, bun 14/15 |
| M10 dead guard line | delete `if (isStale(guard, holder)) rmIfOwner(...)` | `a guard left by a dead process...` | killed |
| M9 no guard | `if (false && !tryCreate(guard, token))` | `a dead lock is not broken while a live process holds the break guard`, the dead-guard test, the race test | killed |
| M7 EPERM dead | `alive()`: `return false;` | `a lock whose owner exists but belongs to someone else...` | killed |
| M13 redundant `same` | code deleted | n/a | removed |
| Old M16/M10/M9/M7 on the old code, tests alone (`df7e3b0`) | as round 1 | same tests | all killed before the fix existed |
| decisions.ts:53 no `withLock` | direct call | `concurrent decisions do not share a timestamp...` | killed |

Not retried this round (round 1 killed them and the code they touch is unchanged in shape): M2, M3, M4, M5, M6, M8 (M8 no longer applies: the create is non-atomic by design), M11, M12, M15.

## Acceptance to test

| Acceptance | Test | Line |
|---|---|---|
| 1 waiter timeout on a live holder never runs beside it (spawn) | `a waiter that times out on a live holder does not enter beside it`; `a live holder's lock is never aged out` | `tests/tsv.test.ts:115`, `:192` |
| 2 removes only its own lock; break then re-create with the same atomic create | `a release does not remove a lock that another owner now holds`; `waiters ... never hold the lock together`; `a lock left by a killed process is broken, and the next caller holds a real one` | `tests/tsv.test.ts:422`, `:297`, `:143` |
| 3 a killed process's lock does not hang | `a lock left by a killed process is broken...`; `a guard left by a dead process...`; `an old lock with an unreadable owner is broken...`; `a lock that cannot be created ... fails promptly` | `tests/tsv.test.ts:143`, `:213`, `:451`, `:364` |
| 4 live holder past the timeout is recorded with decide | design row `2026-11-16T16:46:08.291Z`; implement row for this round; test `a waiter on a live holder throws a UserError naming the lock and the holder` | `.mstack/decisions.tsv`, `tests/tsv.test.ts:169` |
| 5 concurrent decisions test launches processes concurrently and fails without `withLock` | `concurrent decisions do not share a timestamp...` | `tests/decisions.test.ts:428` |

## Evidence ladder

Hang, exFAT and read-only store, original repro: rung 5 (real CLI, real volume). Mutants: rung 4. The race test is statistical: it catches the M14 mutant in about 14 of 15 runs, not all; the guard itself also has deterministic pins.

## Left undone

- Note d (`UserError` module move), for the reason above.
- An intermittent failure of the first draft of the race test appeared once in the first full node run (not reproduced in 8 further full runs of that draft and 6 runs of it under 24 busy loops). The likely cause was the cross-process clock in that draft, which was replaced; I cannot prove that was the cause. The current test uses no clocks across processes and failed 0 times in 6 full node runs and 1 full bun run.
- Suggested follow-ups from the review (ignore `*.lock*` in the store `.gitignore`, hooks failing open silently) are not touched.
