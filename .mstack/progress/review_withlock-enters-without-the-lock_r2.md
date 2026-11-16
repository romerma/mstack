# Review - withlock-enters-without-the-lock

**Verdict:** CHANGES_REQUESTED

Round 2, reviewing alone. Head `8f297e3`, last code-changing commit `f56b44c`. Whole change
`git diff d34761e...HEAD -- src tests`; round 2 `git diff 572ebbc...HEAD -- src tests`
(`src/tsv.ts`, `tests/tsv.test.ts`, new `tests/lock-racer.ts` and `tests/lock-probe.ts`).

All four round 1 blockers are resolved, on the real surfaces as well as in the suite: the exFAT
and read-only stores that hung at 99.6% CPU now answer in under 40 ms, M16 and M10 die, and the
rebuilt race test kills M14 (node 20/20, bun 17/20). Three things remain.
(1) The new create-then-write design opens a window the link design did not have: a creator
stopped for 2 s or more between the exclusive create and the owner write is taken for a leftover,
its lock is broken, and when it resumes it runs beside the breaker. I ran it with the real code.
(2) The empty-guard branch that this design makes reachable has no test: a mutant that never
removes an empty `.lock.break` passes every test on both runtimes and makes every later caller
fail until the file is deleted by hand.
(3) Under several suites at once, the new spawn-based tests fail on correct code: :260 hits bun's
5 s default timeout in 3 of 3 heavy-load bun suites and takes every later bun test file down with
it, and the race test timed out once (bun, 1 of 33 heavy-load runs). Without that load: node 0 of
110 race runs, bun 0 of 70.

## Round 1 findings: resolved or not

| Round 1 finding | Resolved? | Evidence (this round, run by me) |
|---|---|---|
| Blocker 1: spins forever when the lock cannot be created (exFAT, read-only store) | **Yes** | exFAT store (`link` gives ENOTSUP): `decide` exit 0 in 40 ms, 12 concurrent decides 12/12 exit 0 with 12 distinct timestamps, hooks exit 0 in 38-104 ms. `.mstack` chmod 555: `decide` exit 2 in 36 ms naming the lock and EACCES, hooks exit 0 in 38-100 ms. Odd lock paths (directory, dangling symlink, symlink loop, ENAMETOOLONG, mode-000 lock, guard in a read-only dir): all return within the 400 ms timeout, cpu 0.05 s, no spin, on both runtimes. B1 and B1b killed. |
| Blocker 2: central property not pinned at the 2 s limit (M16) | **Yes** | `tests/tsv.test.ts:192` ages a live holder's lock 60 s; M16 killed on node and bun, by that test only. |
| Blocker 3: hazard-2 test cannot see the race (M14) | **Yes, statistically** | M14 killed node 20/20, bun 17/20 (race test only, `tests/tsv.test.ts:297`). False failures: see D. A deterministic test is possible (D). |
| Change 4: stale-guard branch untested (M10) | **Yes** | `tests/tsv.test.ts:213`; M10 killed on node and bun. |
| Note 1: orphan `.tmp` from killed waiters | **Yes** | No temp file any more. 40 waiters SIGKILLed mid-wait left nothing (round 1: 7 of 40 left a `.tmp`). |
| Note 2: M7 (EPERM read as dead) survives | **Yes** | `tests/tsv.test.ts:246`; M7 killed on node and bun. |
| Note 3: redundant `same` comparison | **Yes** | Removed; the under-guard `isStale` re-check (`src/tsv.ts:262`) is what M14 deletes, and it is pinned. |
| Note 4: dead conditional in a test | **Yes** | Line gone (`df7e3b0`). |
| Note 5: `UserError` imported from `paths.ts` | Not done, accepted | Deferred to item 53 with a stated reason (`src/state.ts` is out of scope). Not blocking. |
| Note 6: `.gitignore` change in `34fa8c9` | n/a | Unchanged; outside scope. |
| Follow-ups (ignore lock files in the store, hooks failing open silently, rename-based guard break) | Still open | Not in this item's scope; see Suggested follow-ups. |

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A1 never runs beside a live holder past its timeout | tests/tsv.test.ts:115, :169, :192 | spawn-based; M2, M3 killed (6-7 tests), M16 killed by :192 only; original repro: B throws, C enters after A leaves |
| A2 removes only its own lock | tests/tsv.test.ts:422 (release), :297 (breakers) | M4 killed by :422; M14 killed node 20/20, bun 17/20 by :297; **not held for a creator stopped >= 2 s inside create-then-write** (change 1) |
| A2 break, then the same atomic create | tests/tsv.test.ts:143, :213, :451 | M5 killed (4 tests) |
| A3 killed process's lock does not hang | tests/tsv.test.ts:143, :213, :451, :364, :378, :395 | M6, M10, M12, B1, B1b killed; **empty guard branch untested, N8 survives on both runtimes** (change 2) |
| A4 recorded with decide | `.mstack/decisions.tsv` rows `2026-11-16T16:46:08.291Z` (design), `...17:23:55.106Z` (implement, round 2) | code matches: `decide` exits 2 naming the lock and pid |
| A5 concurrent test fails without withLock | tests/decisions.test.ts:428 | mutant red node 3/3, bun 3/3; unmutated green on both |
| Contract "a lock is never visible half-written" | tests/tsv.test.ts:260 | N10 (owner in two writes) killed |
| Create errors other than EEXIST fail fast | tests/tsv.test.ts:364, :378, :395 | B1, B1b killed; real CLI on exFAT and a read-only store |

## Acceptance, quoted

**"a waiter whose timeout expires while a live holder is still inside never runs its critical section concurrently with that holder; a test with real concurrent processes (spawn, not spawnSync) shows it and fails on unmodified code"**
Met, rung 5 on the original repro and rung 4 in the suite. Repro (A 3500 ms, B +200 ms, C +2500 ms):
B throws `...t.tsv.lock is held by pid 26822 and did not let go in 2002 ms` and exits 1 at 2288 ms;
A leaves at 3552 ms with its lock present; C enters at 3554 ms. tests/tsv.test.ts:115 uses `spawn`
(the holder is tests/lock-holder.ts) and, with :192, now also pins the 2 s case that real callers
use: M16 (age out a live readable owner) is killed by :192. The round 1 run showed these tests red
on the d34761e code; the code path they pin is unchanged in shape.

**"a process removes only a lock it created; breaking a stale lock is followed by re-acquiring it with the same atomic create before entering"**
Met for every case the tests name, rung 4: release (M4 killed by :422), breakers racing a dead lock
(M14 killed by :297, node 20/20, bun 17/20), break then re-create (M5 killed). **Not met in one case
this round introduced** (change 1): the lock is now created empty and the owner written after
(src/tsv.ts:199, :205), and an ownerless lock older than 2 s is broken (:235). A creator stopped
for 2 s or more between those two lines has its live lock removed by a waiter, and then enters
beside it. Ran with the real code (fs.writeSync wrapped so the creator SIGSTOPs itself just before
the owner write, then SIGCONT 3 s later):
```
A created-empty t=1794852270894
B enter t=1794852272898 ownLockOnDisk=true      <- B broke A's lock as a leftover after 2004 ms
A resumed t=1794852274056
A enter t=1794852274057 ownLockOnDisk=false     <- A enters while B is inside, with B's lock on disk
B leave t=1794852274398 ownLockOnDisk=true
A leave t=1794852275557 ownLockOnDisk=false
```
With a 1000 ms stop the same harness is correct (B throws at 2003 ms, A enters on its own lock).

**"a lock left by a killed process does not hang the CLI: it is detected as stale, broken, and the command completes"**
Met, rung 4 and 5. Killed holder: :143. Dead guard: :213. A creator killed between create and
write (new in this design) leaves an empty lock; the next caller with the default 2 s timeout
entered after 1935 ms, 928 ms and 12 ms when it started 0, 1 and 2.5 s after the kill, and nothing
was left. A breaker killed between creating the guard and writing it leaves an empty
`.lock.break` beside the dead lock; the next caller entered after 1965 ms, nothing left. That last
path is correct today but untested (change 2). No hang on any store I could build (section C).

**"what a waiter does when a live holder outlasts the timeout (keep waiting, or exit non-zero naming the lock) is recorded with mstack decide"**
Met. Design row `2026-11-16T16:46:08.291Z` (throw, naming the lock, the holder and the wait), and
round 2's implement row `2026-11-16T17:23:55.106Z`. Running it: with tests/lock-holder.ts holding
`.mstack/decisions.tsv.lock`, `decide` exits 2 in 2037 ms, and the holder's lock is unchanged. A
second run printed
`mstack: <store>/.mstack/decisions.tsv.lock is held by pid 38613 and did not let go in 2002 ms`
and the fix line `wait for pid 38613 to finish, or stop it; if it is not an mstack process, remove <store>/.mstack/decisions.tsv.lock`.

**"the 'concurrent decisions' test in tests/decisions.test.ts launches its processes concurrently, and removing the withLock call makes it fail (mutation shown in the report)"**
Met, rung 4. tests/decisions.test.ts:438-452 spawns 12 `decide` processes and awaits them
together (unchanged this round). Mutation of `src/decisions.ts:53`,
`  return withLock(store.decisions, () => {` to `  return ((run: () => Decision) => run())(() => {`,
applied in a scratch copy: node 3/3 red (`each must be distinguishable from the others`), bun 3/3
red (`every decision must be recorded`). Unmutated: green on both.

## Verification I ran

```
$ ./bin/mstack version                    -> mstack 0.2.1 at /Users/romerma/Code/mstack
$ ./bin/mstack gate                       -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full                -> bun test tests/: 396 pass, 0 fail, 22 files (includes sandbox/, item 46) [64.45s]
                                             node --test: ℹ tests 390 / ℹ pass 390 / ℹ fail 0
                                             typecheck ok; lint-plugin PASSED - 0 failures, 0 warnings
                                             [ok] npm test && npm run typecheck && bin/mstack lint-plugin .
                                             PASSED - 0 failures, 0 warnings; exit=0 (1:26.62 total)
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 390 / ℹ pass 390 / ℹ fail 0                     (19.4 s)
$ bun test ./tests                        -> 390 pass, 0 fail, Ran 390 tests across 20 files. [65.55s]
$ ./bin/mstack ledger check withlock-enters-without-the-lock
FAIL no verdict at 8f297e30; 3 row(s) exist at other SHAs and a new head SHA voids them   (before my row)
```

Original repro (`repro/lock.mjs`, `T0` set; A 3500 ms, B +200 ms 300 ms, C +2500 ms 300 ms):
```
A|    51ms A ENTER
B| UserError: .../review52r2/repro/t.tsv.lock is held by pid 26822 and did not let go in 2002 ms
B exit=1 at 2288 ms
A|  3552ms A LEAVE lock-file-present=true
C|  3554ms C ENTER
C|  3854ms C LEAVE lock-file-present=true
leftovers: (none)
```

## B. The new design's own risk: the ownerless instant

- **When is an ownerless lock broken?** Only when `Date.now() - mtimeMs > 2000` (src/tsv.ts:235).
  On a local disk the window between `openSync(path, "wx")` (:199) and `writeSync` (:205) is
  microseconds, and a fresh file's apparent age, measured over 40 creates, is -0.3-0 ms on APFS
  and 0-9 ms on exFAT (10 ms timestamps). So under normal scheduling, load included, a waiter that
  meets the empty lock waits; it is never broken. The 3840 entries per race run (sections D, A2)
  meet that window constantly and saw no overlap on unmutated code; with the threshold set to
  zero (M11) the race test fails at once (`W20 entered in round 28 while W30 was inside`), so the
  test would see this class if it were common.
- **A slow or suspended creator is mistaken for a leftover once the stop reaches 2 s.** Shown
  above with the real code: a 3 s stop gives a 341 ms overlap and a holder inside with someone
  else's lock on disk. What produces it: SIGSTOP/SIGTSTP (Ctrl-Z on an interactive `decide`), a
  debugger, or a system sleep landing inside that window; and, off local disks, a file server whose
  clock is more than 2 s behind (then every fresh ownerless lock looks stale and the window is a
  network round trip). Rare, but it is the item's own defect (two processes inside, a live lock
  removed) and the round 1 design did not have it: there the name appeared only with the owner in
  it, and a readable live owner is never aged out. The decision row for round 2 says the instant
  "is the legacy empty lock that the unreadable-and-young rule already waits on", which holds only
  while the instant stays under 2 s; the Known limits comment (:123-129) does not mention it.
  The guard has the same window but is safe: a breaker resumed after its guard was taken away
  re-checks the lock under the guard (:262) and backs off. The lock has no such re-check.
- **Creator killed between create and write:** recovers in at most 2 s (above), nothing left.
- **Boundary with "live holder, old lock: never break" (the M16 class):** correct. A readable owner
  is judged by pid only (:233), whatever its age; M16 is killed by :192. The only live lock that is
  unreadable is one inside the create-then-write window (or one another user cannot read), which is
  the case above.

## C. The hang, on the real surfaces

Stores built with `git init` plus this checkout's `bin/mstack setup`.
```
exFAT (hdiutil, mount type exfat; node link() -> ENOTSUP; fresh-file age 0-9 ms)
  decide #1 exit=0 in 40 ms: recorded        decide #2 exit=0 in 38 ms: recorded
  12 concurrent decides in 99 ms, exit codes: 0 x12; concurrent rows=12 distinct ts=12
  hook session-start exit=0 in 47 ms | hook stop exit=0 in 104 ms | hook session-end exit=0 in 38 ms
  lock-ish leftovers: (none)
APFS, .mstack and .git/mstack chmod 555 (restored to drwxr-xr-x afterwards)
  decide exit=2 in 36 ms: mstack: cannot create the lock <store>/.mstack/decisions.tsv.lock:
         EACCES: permission denied, open '<store>/.mstack/decisions.tsv.lock'
  hook session-start exit=0 in 39 ms | hook stop exit=0 in 100 ms | hook session-end exit=0 in 38 ms
```
Round 1 saw both stores hang at 99.6% CPU. The volume was detached and the image deleted.

Other ways to make the loop spin or block, each run in a child with a 400 ms timeout, a 4 s kill
deadline and `/usr/bin/time` (node; bun gave the same outcomes):
```
lock path is a young directory          THREW UserError in 404 ms (held by a process that cannot be identified)  cpu 0.05 s
lock path is an old directory           THREW SystemError in 1 ms: rm returned EISDIR   (bun: Error EFAULT)        note c
lock path is a dangling symlink         THREW UserError in 402 ms                                                cpu 0.05 s
lock path is a symlink loop             THREW UserError in 402 ms                                                cpu 0.05 s
file name too long                      THREW UserError in 1 ms: cannot create the lock ...: ENAMETOOLONG
existing young lock, mode 000           THREW UserError in 403 ms
existing old empty lock, mode 000       ENTERED in 2 ms
dead lock in a read-only dir            THREW UserError in 1 ms: cannot create the lock ....lock.break: EACCES
dead lock, guard path an old directory  THREW UserError in 402 ms (held by pid <dead>)                           note d
dead lock, empty guard aged 60 s        ENTERED in 6 ms, nothing left
dead lock, young empty guard            THREW UserError in 401 ms (held by pid <dead>)                           note d
```
No case spins (cpu 0.04-0.08 s each) or outlives its deadline.

## D. The statistical race test, measured

False failures, unmutated code, `tests/tsv.test.ts:297` unless said:
```
condition                                                   node          bun
alone, one after another                                    40/40 pass    40/40 pass   (7.1-7.2 s each)
inside the full suite, quiet machine (repeats, direct, gate) 12/12        6/6
whole tsv.test.ts under 18 busy loops (18 cores)            8/8           8/8          (9.4-9.6 s per file)
four race tests at once (4 x 32 racers)                     20/20         16/16
"several suites at once": two node suites + one bun suite   18/18         17/18        1 FAIL: this test timed out after 30000ms
  + a race loop per runtime, run three times
same load, bun, a copy that keeps its bench dir             -             12/12
inside the node full suites of that load                    12/12         -
inside the bun full suites of that load                     -             3/3
```
Race test totals: node 0 failures in 110 runs; bun 1 in 103 (0 in 70 without the heavy load, 1 in
33 with it). The one failure is the test's own 30 s timeout, not an assertion: it never reached
the journal checks, so it says nothing against the lock, and it is not an overlap. I could not
reproduce it in 12 more runs under the same load with the bench directory kept, so the cause is
unproven. Candidates: racers starved past their 5 s `withLock` timeout several times in a row, or
file-system metadata contention (128+ processes creating and unlinking in one temp volume)
stretching 3840 entries past 30 s. Node never failed, including the 12 runs inside node suites
that themselves went red on the pre-existing tests/costs.test.ts:698 under that load (9 of 12).

The same load found a worse false failure in the same file. `tests/tsv.test.ts:260` ("a lock is
never visible with a partial or foreign owner in it") sets no timeout, so bun applies its 5 s
default. It takes about 1 s on a quiet machine (929 ms and 1060 ms in node) and 4.7-7.1 s under
that load (node, five measurements). In bun it timed out in 3 of 3 full suites under that load, and
each time bun's node:test shim then failed every later file:
```
(fail) a lock is never visible with a partial or foreign owner in it [5000.07ms]
  ^ this test timed out after 5000ms, before its done callback was called.
...
NotImplementedError: test() inside another test() is not yet implemented in Bun. ...
 19 pass
 20 fail
 19 errors
Ran 39 tests across 20 files. [16.13s]
```
That is 39 tests run instead of 390. On a quiet machine: 0 of 6 bun suites.

Detection. M14 is killed node 20/20 and bun 17/20 (race test alone; the implementer measured 15/15
and 14/15), so about 89% per run on bun. :297 is the only test that kills M14, and the only one
that notices an ownerless lock being broken early (M11). It costs about 7 s on each runtime: node
runs files in parallel, so its suite stays at 19.4 s; bun runs them in series, so about 7 s of its
65 s. A deterministic test can kill the same mutant. My probe plants a dead lock and, at the moment
the waiter takes the guard, a wrapped `fs.openSync` swaps a live owner into the lock: M14 3/3 red
(`entered=true liveLockIntact=false`), unmutated green, about 150 ms. It only works under node,
because in bun the wrapped `fs` does not reach the ESM bindings. A seam (note b) would make it
portable.

## E. The relaxed test in `45a0659`

Right contract, not a weakening to obtain green. The old assertion, `/^\d+ [0-9a-f-]{36}\n$/`,
states the link design's property; the new one, `/^(\d+ [0-9a-f-]{36}\n)?$/`, states this
design's: empty or complete, never partial. It was committed alone and before the fix
(`8c69cdd`), when the code still used `link`, so it was not needed to turn anything green. It
still has teeth: N10 (the owner written in two `writeSync` calls) is killed by it. What it gives up
is exactly what change 1 is about: an empty lock is now a normal state, so how long one may be
trusted has to be pinned somewhere, and nothing pins it from the creator's side.

## F. Callers when `withLock` throws

tests/lock-holder.ts holding each lock (APFS store):
```
decisions.tsv.lock held   decide exit=2 in 2037 ms, names the lock and pid 33254 | hooks exit 0 in 41/103/40 ms | lock intact
costs.tsv.lock held       decide exit=0 in 35 ms | hooks exit 0 in 41/100/39 ms | lock intact
costs-marks.jsonl.lock    decide exit=0 in 36 ms | session-start exit=0 in 2039 ms, stop 2107 ms, session-end 2042 ms | lock intact
```
Nested flush (src/costs.ts:742-752), session-end with a real usage delta in the transcript:
```
nothing held     exit=0 in 40 ms;   costs.tsv lines 1 -> 3
costs.tsv held   exit=0 in 2044 ms; costs.tsv lines 3 -> 3; holder's lock intact; no leftovers
marks held       exit=0 in 2041 ms; costs.tsv lines 3 -> 3; holder's lock intact; no leftovers (outer lock released)
```
Budgets in hooks/hooks.json: SessionStart 10 s, Stop 20 s, SessionEnd 5 s. `cmdHook`
(src/cli.ts:1010-1021) swallows the throw and returns 0.

## G. Leftovers, by exit path

- Normal: none (tests/tsv.test.ts:411). `run` throws: none (ran). Waiter throws at the timeout:
  only the holder's lock (spin table). 40 waiters SIGKILLed mid-wait: nothing but the holder's
  lock while it was inside, nothing after (round 1: 7 of 40 left a `.tmp`).
- Killed between create and write: an empty lock, broken within 2 s by the next caller.
- Killed mid-break: an empty or dead-owner `.lock.break`, removed by the next breaker (ran both).
  A breaker killed after removing the dead lock and before removing its guard leaves a
  `.lock.break` with no lock beside it; nothing ever sweeps that, because only a waiter facing a
  stale lock looks at the guard. Ran it: after a `decide`, `.mstack/decisions.tsv.lock.break`
  is still there and `mstack gate` warns `1 uncommitted change(s)`. The window is microseconds and
  the result is a warning, not a failure; follow-up below.

## H. Runtime rules, diff, scope

- `src/tsv.ts` imports `node:crypto`, `node:fs`, `node:path` and `./paths.ts` only; no `Bun.` in
  `src/`; no new dependency (`package.json` has only `@types/node` and `typescript`, dev); no build
  step; `withLock` is still synchronous (`Atomics.wait`, :172). `openSync`/`writeSync`/`closeSync`
  exist in every node the launcher accepts (22.6+). Both runtimes green.
- Scope: `git diff d34761e...HEAD -- src/state.ts tests/costs.test.ts src/decisions.ts src/costs.ts src/hooks.ts`
  is empty. `tests/lock-holder.ts` is unchanged this round.
- Tests removed this round: the old 8-holder race test (replaced by the 32 x 120 one, which asserts
  more) and the old "never visible without its owner" assertion (E). Nothing else was loosened.
- Comments: the loop comment at :139-140 matches the code; the `tryCreate` and `tryBreakStale`
  comments match. The class comment's "A waiter never enters without holding the lock" (:109) is
  not true for the resumed creator in change 1, and Known limits (:123-129) does not list it.

## Mutants

All applied by script to a scratch copy of HEAD (`git archive`), never to this checkout, then
restored (`cmp` against HEAD's `src/tsv.ts` after each batch). Test file `tests/tsv.test.ts`,
node unless marked. Baseline on the copy: pass 20, fail 0.

| Mutant | Edit (current code) | Result | Killed by |
|---|---|---|---|
| M2 enter at timeout | `break;` first in the `waited > timeout` branch (:144) | killed, 7 tests | :115, :169, :192, :229, :246, :395, :436 |
| M3 remove lock at timeout | `rmSync(lock)` first in that branch | killed, 6 | :115, :169, :192, :229, :246, :436 |
| M4 release removes any lock | `release` -> `rmSync(lock, {force:true})` | killed, 1 | :422 |
| M5 enter after breaking | `if (removed && waited <= timeout) break;` (:143) | killed, 4 | :143, :213, :297, :451 |
| M6 dead reads alive | `alive()` returns true without `kill(0)` | killed, 3 | :143, :213, :297 (the race test then times out and its 32 racers keep running: note a) |
| M7 EPERM read as dead | `alive()` catch returns false | killed, 1 (node and bun) | :246 |
| M9 no guard | `if (false && !tryCreate(guard, token))` (:254) | killed, 3 (node and bun) | :213, :229, :297 |
| M10 dead guard kept | delete :256 | killed, 1 (node and bun) | :213 |
| M11 unknown owner always old | `UNKNOWN_OWNER_STALE_MS = -1` | killed, 2 | :436, :297 |
| M12 unknown owner never stale | `return false && ...` at :235 | killed, 1 | :451 |
| M14 no re-check under guard | delete :262 | killed: node 20/20, bun 17/20 (race test alone, 20 runs each) | :297 only |
| M15 unknown owner always stale | :235 -> `return true;` | killed, 3 | :297, :395, :436 |
| M16 age breaks live owner | :233 -> `if (owner !== null && !alive(owner.pid)) return true;` | killed, 1 (node and bun) | :192 |
| B1 swallow create errors | `tryCreate` catch -> `return false;` | killed, 2 (node and bun) | :364, :378 (by message: no spin now even with B1, the loop reaches the deadline) |
| B1b skip deadline | :143 -> `if (removed \|\| !existsSync(lock)) continue;` | killed, 1 | :395 |
| N1 owner never written | delete the `writeSync` at :205 | killed, 7 | :115, :143, :169, :192, :213, :451, ... |
| N2 removal skips deadline | :143 -> `if (removed) continue;` | survives | equivalent in effect; arguably better behaviour (note d) |
| **N8 empty guard never removed** | :273 -> `if (owner?.token === token) rmSync(...)` | **survives, node and bun** | none (change 2) |
| N9 unstatable lock is stale | `isStale` catch -> `return true;` | killed, 2 | :297, :395 |
| N10 owner in two writes | `writeSync(pid + " ")`, then `writeSync(token + "\n")` | killed, 1 | :260 (the relaxed test) |
| M13 redundant `same` | code removed this round | n/a | - |
| M8 non-atomic create | the create is non-atomic by design now | n/a | replaced by N10 |
| decisions.ts:53 without `withLock` | direct call | killed node 3/3, bun 3/3 | tests/decisions.test.ts:428 |

Deterministic probe for M14 (scratchpad `review52r2/det/m14probe.mjs`): a dead lock is planted and,
the moment the waiter takes the guard, a wrapped `fs.openSync` swaps a live owner into the lock.
Unmutated: `swapped=true entered=false threw=UserError liveLockIntact=true`; M14 3/3:
`entered=true liveLockIntact=false`; about 150 ms. It works under node only: in bun the wrapped
`fs` does not reach the ESM binding (`swapped=false`).

## Changes required

1. **src/tsv.ts:196-213 (`tryCreate`), with :232-235 - a creator stopped for 2 s or more between
   the exclusive create (:199) and the owner write (:205) is broken as a leftover, and on resume
   enters beside the waiter that broke it.** Ran with the real code (section B): 341 ms of overlap,
   and the resumed creator inside with another process's lock on disk. That is acceptance 2 ("a
   process removes only a lock it created") and the comment at :109 failing, in a window the link
   design did not have. It is rare (a 2 s stop inside a microsecond window, or a file server whose
   clock is 2 s behind), so either resolution is acceptable:
   - preferred, about five lines: after the write, read the lock back and return `true` only if it
     carries this caller's token; otherwise close the fd and return `false` without touching the
     path (it is someone else's now), so the loop waits as for any held lock. Compare the token
     rather than inode numbers: on this exFAT volume `fstat` inode numbers are near 2^64, and as JS
     numbers an unlinked file and its re-created successor compared equal 20/20 (0/20 with
     `{ bigint: true }`). This is the lock's counterpart of the re-check the guard already has
     (:262). Pin it with a test that makes the creator lose the lock between create and write: a small seam (the
     codebase has one already, `prune(file, beforeLock?)` at src/costs.ts:416), or, node only, a
     child that wraps `fs.writeSync` and calls `syncBuiltinESMExports()` before importing
     `src/tsv.ts`, as my harness does (scratchpad `review52r2/ownerless/creator.mjs`).
   - or accept it on the record: an `mstack decide` row naming this window and its cost, and the
     window added to Known limits (:123-129). The round 2 implement row says the instant is
     waited on like a legacy lock, which is true only below 2 s.
2. **tests/tsv.test.ts (missing test) - the empty-guard branch (src/tsv.ts:256 with :273,
   `token === null ? owner === null : ...`) is untested.** This design creates every guard empty
   for an instant, so a breaker killed there leaves an empty `.lock.break` beside the dead lock
   (ran it: guard size 0, lock 43 bytes). The code recovers (next caller entered after 1965 ms).
   Mutant N8, `if (owner?.token === token) rmSync(...)`, never removes such a guard: every later
   caller then throws until someone deletes the file by hand (my probe: `THREW ... left: t.tsv.lock,
   t.tsv.lock.break`), and the suite passes 20/20 on node and on bun. This is the same gap round 1
   raised for M10. Fix: write an empty `.lock.break` aged past 2 s (`utimesSync`) beside a
   dead-owner lock; `withLock` must enter holding its own lock and leave neither file.
3. **tests/tsv.test.ts:260 and :297 - the new spawn-based lock tests fail on correct code under
   CPU load (section D).** :260 sets no timeout, takes 4.7-7.1 s under several suites at once
   (about 1 s otherwise), and in bun hits the 5 s default. That happened in 3 of 3 bun suites
   under that load, and each time it took the remaining 19 test files down with it (39 tests run
   instead of 390). :297 timed out at 30 s once in 33 bun runs under the same load (0 in 70
   without it, node 0 in 110). The cause is unproven, and it was not an overlap. Fix: give :260 an
   explicit timeout and bound its writer by time (hammer for about 500 ms) rather than by 3000
   iterations. For :297, either replace it with a deterministic test through a seam (note b), or
   keep it with a budget that holds under load (fewer rounds or a longer timeout) and with its
   racers killed when the test is cancelled (note a). Then re-measure both runtimes with several
   suites running at once; the harnesses are in scratchpad `review52r2/race/` (`loadplan.sh`,
   `l3again.sh`).

Non-blocking notes:

a. tests/tsv.test.ts:297-361 - when the race test times out, its 32 racers keep running. Any
   regression that makes a waiter wait (M6, N1) leaves the test awaiting `racer.exited` past its
   30 s timeout, so `finally { bench.dispose() }` never runs; each racer then spends up to 5 s on
   each of 120 rounds. M6 kept the file running 137 s and N1 55 s, and that was with my watchdog
   killing racers older than 45 s. Kill the racers when the test is cancelled (pass the test
   context's `signal`, or bound the racers' total time) so a regression is a fast red, not a
   ten-minute stall.
b. tests/tsv.test.ts:297 costs about 7 s per runtime for one mutant (M14) that a deterministic
   test could kill in about 150 ms (see the probe under Mutants). If a seam is added for change
   1, the same seam can pin M14 deterministically on both runtimes, and the race test could then
   shrink or go.
c. src/tsv.ts:263 - a lock path that is a directory older than 2 s throws a raw `SystemError`
   (node: `rm returned EISDIR`; bun: `EFAULT: bad address`) instead of a `UserError`, so `decide`
   would print an internal error rather than a fix line. Not a hang, and it needs a directory
   where the lock belongs.
d. src/tsv.ts:143-151 - the timeout message names the lock's (dead) owner when what blocks is the
   guard (a young empty guard, or a directory at the guard path): `held by pid <dead>`. And when a
   waiter removes a dead lock on the same pass that crosses the deadline, it throws "held by a
   process that cannot be identified" although the lock is now free (mutant N2, which retries
   instead, passes everything). Both are wording at an edge.
e. Note 5 of round 1 (`UserError` from `paths.ts`): the reason for deferring it to item 53 is sound.

## Suggested follow-ups (own items, not blocking this one)

- Store `.gitignore`: ignore `*.lock` and `*.lock.break`, or sweep a `.lock.break` that has no
  lock beside it. Ran it: a guard left by a breaker killed after removing the dead lock survives
  every later `decide` (only a waiter facing a stale lock ever looks at the guard), and
  `mstack gate` warns `1 uncommitted change(s)` until someone deletes it.
- Hooks fail open silently (carried over from round 1; item 54 should log the `withLock` throw).
- `withLock` measures its wait with `Date.now()` (src/tsv.ts:135, :142); a wall clock stepped
  back extends the wait by the step. `performance.now()` for the deadline would keep the mtime
  rule on wall time and the wait on a monotonic clock. Pre-existing.

Evidence ladder. Change 1 at rung 4: the real code in real processes, with the pause injected by
wrapping `fs.writeSync` (rung 5 would need a SIGSTOP landing inside a microsecond window of a live
CLI). Change 2 at rung 4: a mutant on the suite, plus the leftover produced by a real process killed
at that point. Change 3 at rung 4 for :260 (reproduced 3 of 3, durations measured) and for the :297
timeout itself, but rung 1 for its cause, which is unproven. Round 1 blocker 1 is resolved at rung 5
(real CLI, real exFAT volume, real read-only store). All runs were on this machine: macOS 25.6,
APFS temp volume, 18 cores, node v26.13.1, bun 1.3.11.
