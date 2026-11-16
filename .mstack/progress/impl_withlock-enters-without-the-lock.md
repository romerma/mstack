# Item 52 withlock-enters-without-the-lock: implementer report

## What changed

`withLock` (src/tsv.ts) now holds a real lock whenever it runs the critical section. The lock
file records its owner as `<pid> <token>`, created by writing a private temp file and `link`ing
it into place (atomic, fails if the lock exists, content complete before the name is visible).
A lock whose owner pid is dead is broken at once, under a `.lock.break` guard so two breakers
cannot both remove and re-create, and then taken again with the same atomic create. A live
holder that outlasts the timeout makes the waiter THROW a `UserError` (names the lock, the pid,
the wait, with a fix line); it never enters. Release removes the lock only if it still carries
the caller's token. The doc comment was rewritten (it argued for "break and proceed"). The wait
is `Atomics.wait` instead of a spin, still synchronous. No caller needed a change: `decide`
exits 2 with the message, hooks go through `safely` and exit 0.
The "concurrent decisions" test now launches 12 processes together with `spawn`.

## Files

- src/tsv.ts
- tests/tsv.test.ts (the two red tests from bb73baa untouched; 7 tests added)
- tests/decisions.test.ts (only the concurrent decisions test)
- .mstack/decisions.tsv (one implement row), .mstack/progress/current.md, this report
- tests/lock-holder.ts, src/decisions.ts, src/costs.ts: unchanged (restored after the mutation)

## Commands

```
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 382
ℹ pass 382
ℹ fail 0
$ bun test ./tests
 382 pass
 0 fail
Ran 382 tests across 20 files. [63.22s]
$ bunx --bun tsc --noEmit        -> exit 0
$ ./bin/mstack lint-plugin .     -> PASSED - 0 failures, 0 warnings
```

Repro surface (A holds 3500 ms, B starts +200 ms holding 300, C starts ~2500 ms holding 300):

```
   51ms A ENTER
UserError: .../t.tsv.lock is held by pid 27521 and did not let go in 2002 ms     <- B, at ~2.2 s
        fix: 'wait for pid 27521 to finish, or stop it; if it is not an mstack process, remove ...'
 3552ms A LEAVE lock-file-present=true
 3553ms C ENTER
 3854ms C LEAVE lock-file-present=true
```

Nobody enters while A is inside, B fails loudly, C enters after A leaves. (Before: B entered at
2280 ms, C at 2802 ms, both beside A.)

Mutation for acceptance 5 (withLock call in decisions.add replaced by a direct call):

```
✖ concurrent decisions do not share a timestamp, because the timestamp is the key
  AssertionError [ERR_ASSERTION]: and each must be distinguishable from the others
(4 of 4 runs failed; unmutated: pass)
$ git status --short   (after restoring src/decisions.ts)
 M tests/decisions.test.ts ... only the committed test changes; src/decisions.ts clean
```

Mutation for hazard 1 (tryCreate as `openSync wx` then write): "a lock is never visible without
its owner in it" failed with `a reader saw a lock with no complete owner in it`.

Callers, run for real (temp git repo, holder on the lock for 5 s):

```
$ ./bin/mstack decide --decision x      (decisions.tsv.lock held by a live process)
mstack: .../decisions.tsv.lock is held by pid 56402 and did not let go in 2001 ms
        wait for pid 56402 to finish, or stop it; ...
exit=2   (2.05 s)
$ echo <input> | ./bin/mstack hook session-start     (costs-marks.jsonl.lock held)
{"hookSpecificOutput":...}   hook exit=0   (2.05 s, no mark written, holder's lock intact)
```

## R to test

| Acceptance | Test | file:line |
|---|---|---|
| 1 waiter never runs beside a live holder (spawn, red before) | a waiter that times out on a live holder does not enter beside it | tests/tsv.test.ts:99 |
| 1/4 waiter throws UserError naming lock and holder, leaves the lock | a waiter on a live holder throws a UserError ... | tests/tsv.test.ts:153 |
| 2 removes only own lock; stale break then atomic re-create | a lock left by a killed process is broken, and the next caller holds a real one; a release does not remove a lock that another owner now holds | tests/tsv.test.ts:127, :232 |
| 3 killed holder does not hang | same killed-process test (B enters within 5 s) | tests/tsv.test.ts:127 |
| 4 recorded: exit non-zero naming the lock | design row (last-but-one row of decisions.tsv); code matches | tests/tsv.test.ts:153 |
| 5 concurrent decisions truly concurrent, fails without withLock | concurrent decisions do not share a timestamp ... | tests/decisions.test.ts:428 |

## Hazards

1. Atomic create-with-content: write temp then `linkSync`; test at tests/tsv.test.ts:176 reads
   the lock in a loop while another process takes it 3000 times; it fails on the open-then-write
   mutation.
2. Stale-break race: serialised by a `.lock.break` guard; the breaker re-reads the lock under the
   guard and removes it only if it is still the same dead owner; a loser retries. Test at
   tests/tsv.test.ts:212 (8 processes on one dead lock, enter/leave strictly alternate).
   Residual window: a breaker killed inside the guard leaves a guard with a dead owner, which is
   itself broken by the same dead-pid rule; two parties breaking that guard at once could both
   hold it, and it only does harm if a second breaker's remove lands between a first breaker's
   remove and its re-create AND between that one's re-read and remove. That needs a process kill
   in a microsecond window plus two simultaneous breakers; accepted, not tested.
3. Unreadable owner (empty file from the old format, foreign content): waited on while younger
   than 2 s, broken after (same atomic re-create). Recorded with `decide --phase implement`.
   Tests tsv.test.ts:247 (young: throws, lock untouched) and :262 (old: broken, caller holds a
   real lock). 2 s, not 10 s, because tests/costs.test.ts:1132 (a hook killed on an empty
   leftover lock) needs a legacy lock to clear within the old wait; that test is unmodified and
   green. Cost: a legacy holder past 2 s is broken, which is the old behaviour restricted to the
   old format.
4. PID reuse: not handled. A dead owner whose pid is taken by an unrelated live process reads
   as alive, so waiters throw at the timeout until that process exits. Fail-closed, and the
   window is the time a lock file outlives its process, which is rare for millisecond sections.
   EPERM from `kill(pid,0)` counts as alive. Leftover `*.tmp` files are possible only if a
   process dies between writing the temp file and unlinking it; they are harmless.
5. Callers: checked by running (above). `decide` exits 2 with the message and fix; hooks swallow
   the throw via `safely` and exit 0, losing that one cost write. Other nested use in
   src/costs.ts:742-752 is unchanged (distinct files; tokens are per call, so the nesting still
   works).

Rung: 4 for acceptance 1 to 3 and 5 (real concurrent processes, both runtimes, mutation shown);
the guard residual window in hazard 2 is argued, not tested.
