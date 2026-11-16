# Review - withlock-enters-without-the-lock

**Verdict:** CHANGES_REQUESTED

Round 1, reviewing alone. Head `572ebbc`, scope `git diff d34761e...HEAD -- src tests`
(fix `d33f618`, tests `bb73baa` and `377e742`). The fix is right for the case it was written
for: I re-ran the original repro and B now throws instead of entering. Three blockers remain.
(1) Any failure to create the lock other than "it already exists" makes `withLock` spin forever
at 100% CPU, where the old code finished. I ran this on the real CLI.
(2) The test for the central property passes on a one-line mutant that brings back the
reported defect at the default 2 s timeout.
(3) The hazard-2 test cannot see the race it is named after.

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| A1 never runs beside a live holder | tests/tsv.test.ts:99, :153 | red on d34761e code (all 8 new lock tests fail); M2/M3 killed; **M16 survives** (blocker 2) |
| A2 removes only its own lock | tests/tsv.test.ts:232 (release path) | M4 killed; breaker path **M14 survives** (blocker 3) |
| A2 break, then the same atomic create | tests/tsv.test.ts:127, :262 | M5 killed |
| A3 killed holder does not hang | tests/tsv.test.ts:127 | M6 killed; stale `.lock.break` path **M10 survives** (change 4) |
| A4 recorded with decide | `.mstack/decisions.tsv` row `2026-11-16T16:46:08.291Z` (design) | code matches: throws UserError, `decide` exits 2 |
| A5 concurrent test, fails without withLock | tests/decisions.test.ts:428 | 5/5 red with withLock removed; d34761e's spawnSync version 3/3 green on the same mutant |
| H1 lock never visible without owner | tests/tsv.test.ts:176 | M8 (open wx then write) killed |
| H3 unreadable owner: wait < 2 s, break after | tests/tsv.test.ts:247, :262 | M11, M12, M15 killed |

## Acceptance, quoted

**"a waiter whose timeout expires while a live holder is still inside never runs its critical section concurrently with that holder; a test with real concurrent processes (spawn, not spawnSync) shows it and fails on unmodified code"**
Behaviour met: rung 5 on the original repro (below). B throws at 2366 ms, and C enters at 3590 ms,
after A leaves at 3585 ms. The test at tests/tsv.test.ts:99 uses `spawn` and fails on d34761e's
`src/tsv.ts`. **Coverage not met:** its waiter timeout (200 ms, :107) and the one at :160 (100 ms)
both end before the lock is 2 s old. So a mutant that also breaks *live, readable* owners by
age passes the whole file, and then the original defect comes back at the 2 s default that every
real caller uses (src/decisions.ts:53, src/costs.ts:283,419,742,752). See blocker 2.

**"a process removes only a lock it created; breaking a stale lock is followed by re-acquiring it with the same atomic create before entering"**
Behaviour met: rung 4. My harness ran 16 waiters released at the same instant against a dead-owner
lock, inside-check of ownership on. Results: node 40 rounds, bun 25 rounds, 0 overlaps, 0 entries
without the caller's own lock. The release path is pinned (M4 killed), and so is the re-create
(M5 killed). **The breaker path is not pinned:** with the re-check under the guard deleted (M14),
a breaker removes a live holder's lock. tests/tsv.test.ts:212 passed that mutant 10/10. See
blocker 3.

**"a lock left by a killed process does not hang the CLI: it is detected as stale, broken, and the command completes"**
Met for a lock left by a process killed inside its critical section: rung 4, tests/tsv.test.ts:127
(B enters, and holds a real lock). A guard left by a dead process, together with a dead lock, is
also handled: harness "deadguard" mode, 65 rounds, 0 throws, 0 leftovers. But nothing tests that
(M10, change 4). Separately, the CLI *does* now hang on a store where the lock cannot be created
at all (blocker 1). That is not a killed-process lock, but it is the hang this bullet and the
design row both rule out.

**"what a waiter does when a live holder outlasts the timeout (keep waiting, or exit non-zero naming the lock) is recorded with mstack decide"**
Met. Row `2026-11-16T16:46:08.291Z`, phase `design`, in `.mstack/decisions.tsv` (commit `8db3d1b`
touches only that file). The answer is "throws, naming the lock, the holder and the wait". Running
it for real: `decide` exits 2 in 2079 ms with `...decisions.tsv.lock is held by pid 32304 and did
not let go in 2004 ms` plus a fix line, and the holder's lock is left intact.

**"the 'concurrent decisions' test in tests/decisions.test.ts launches its processes concurrently, and removing the withLock call makes it fail (mutation shown in the report)"**
Met: rung 4. tests/decisions.test.ts:438-452 spawns 12 processes and awaits them together.
Mutation `src/decisions.ts:53`, `return withLock(store.decisions, () => {` changed to
`return ((run: () => Decision) => run())(() => {`. Result: 5/5 runs fail with `and each must be
distinguishable from the others`. The d34761e version of the test, on the same mutant, passes 3/3,
so the old test really never contended. Unmutated: 3/3 green under node and green under bun.

## Verification I ran

```
$ ./bin/mstack gate                      -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full               -> bun: 388 pass 0 fail (includes sandbox/, item 46); node: tests 382 pass 382 fail 0;
                                            typecheck ok; lint-plugin PASSED; "PASSED - 0 failures, 0 warnings", exit=0 (1:26)
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 382 / ℹ pass 382 / ℹ fail 0
$ bun test ./tests                       -> 382 pass, 0 fail, Ran 382 tests across 20 files. [66.18s]
```

Original repro (scratchpad `repro/lock.mjs`; A 3500 ms, B +200 ms 300 ms, C ~+2500 ms 300 ms):
```
A|    83ms A ENTER
B| UserError: .../t.tsv.lock is held by pid 18326 and did not let go in 2001 ms   (B exit=1 at 2366 ms)
A|  3585ms A LEAVE lock-file-present=true
C|  3590ms C ENTER
C|  3891ms C LEAVE lock-file-present=true
leftovers: (none)
```

Mutations of `src/tsv.ts` against `tests/tsv.test.ts`. Each was applied by script and then
restored with `git checkout -- src/tsv.ts`:
```
M2  timeout path `break;` before the throw                        killed (3 tests)
M3  rmSync(lock) before the throw                                 killed (3)
M4  release() -> rmSync(lock, {force:true})                       killed (1: release does not remove...)
M5  `if (tryBreakStale(...)) continue;` -> `break;`               killed (2)
M6  alive(): skip process.kill, return true                       killed (2)
M7  alive(): EPERM -> false                                       SURVIVES
M8  tryCreate as openSync(path,"wx") then write                   killed (never visible without its owner)
M9  guard not taken (`if (false && !tryCreate(guard, token))`)    SURVIVES (harness also 0 overlaps: re-check alone closes most of it)
M10 delete `if (isStale(guard, holder)) rmIfOwner(...)` (:233)    SURVIVES
M11 UNKNOWN_OWNER_STALE_MS = -1                                   killed (1)
M12 isStale(null) never true                                      killed (1)
M13 drop `!same ||` at :241                                       SURVIVES (equivalent: the isStale re-check covers it)
M14 replace :241 with `void same;` (no re-check under guard)      SURVIVES (repo test 10/10 green)
M15 unreadable owner always stale                                 killed (1)
M16 :209 `if (owner !== null) return !alive(owner.pid);`
    -> `if (owner !== null && !alive(owner.pid)) return true;`    SURVIVES (fail 0, pass 12)
```

M16 on the original repro. This is the item's own defect, back again:
```
   55ms A ENTER
 2058ms B ENTER
 2359ms B LEAVE lock-file-present=true
 2564ms C ENTER
 2865ms C LEAVE lock-file-present=true
 3556ms A LEAVE lock-file-present=false
```

Race harness (scratchpad `review52/race/run.mjs`). N waiters spawned, all start acquiring at one
shared instant, hold 3 ms, and record whether the lock carries their own pid on entry and on exit:
```
unmodified  node dead       40 rounds x16: entries=640 overlaps=0 notOwnLock=0 threw=0 leftovers=0
unmodified  node deadguard  40 x16:        entries=640 overlaps=0 notOwnLock=0 threw=0 leftovers=0
unmodified  node legacy     40 x16:        entries=640 overlaps=0 notOwnLock=0 threw=0 leftovers=0
unmodified  bun  dead       25 x16:        entries=400 overlaps=0 ...
unmodified  bun  deadguard  25 x16:        entries=400 overlaps=0 ...
M14         node dead       20 x16:        entries=320 overlaps=4 notOwnLock=10
M9          node dead       20 x16:        entries=320 overlaps=0 notOwnLock=0
M10         node deadguard   2 x4:         entries=0 threw=8 nonZeroExit=8, leftovers t.tsv.lock, t.tsv.lock.break
```

Lock that cannot be created (blocker 1). The old CLI is `git archive d34761e` in the scratchpad:
```
withLock("/nonexistent-dir-xyz/file.tsv", timeoutMs 200): NEW killed after 5 s, still inside; OLD "returned ran 202 ms"
withLock(<dir chmod 555>/file.tsv, timeoutMs 200):       NEW killed after 5 s;                OLD "returned ran 202 ms"
ps while stuck: 33330  99.6%CPU  00:02  node ... unwritable.mjs
exFAT volume (hdiutil, link() -> ENOTSUP), real store, ./bin/mstack decide:      NEW killed after 8 s; OLD "recorded" exit=0 in 0 s
APFS store with .mstack chmod 555, ./bin/mstack decide:                         NEW killed after 8 s; OLD "recorded" exit=0 in 2 s
exFAT store, ./bin/mstack hook session-start:                                   NEW killed after 12 s (budget 10 s); OLD exit=0 in 70 ms
  left behind by the killed hook: .git/mstack/costs-marks.jsonl.lock.32012.<uuid>.tmp
```

Callers against a live holder (APFS store, tests/lock-holder.ts holding the named lock):
```
decide                         exit=2 in 2079 ms; message names the lock and pid 32304; lock intact
hook session-start  marks held exit=0 in 2081 ms; holder lock intact   | costs.tsv held: exit=0 in 62 ms, intact
hook stop           marks held exit=0 in 2173 ms; intact               | costs.tsv held: exit=0 in 123 ms, intact
hook session-end    marks held exit=0 in 2066 ms; intact               | costs.tsv held: exit=0 in 2085 ms, intact
```

Hazards, checked:
1. Create-with-content is atomic. Rung 3: the temp file is fully written before `linkSync`, and link
   publishes a complete inode. Rung 4: M8 killed by tests/tsv.test.ts:176, and the harness saw
   notOwnLock=0 over 2720 entries.
2. Stale-break race. Unmodified: 0 overlaps in 170 synchronised rounds, on both runtimes, with and
   without a stale guard. On the residual window I accept the argument and it is not a blocker for
   this item. It needs three things at once: a SIGKILL landing inside the guard, which is held only
   for a read, an existsSync, a kill(0) and an unlink, and only while breaking a lock that a killed
   process left; two waiters judging that guard stale at the same moment, with `rmIfOwner`'s
   read-then-unlink (src/tsv.ts:249-252) interleaving a third waiter's fresh guard; and the two
   guard holders' re-read and unlink then interleaving too. The harness's stale-guard mode found
   nothing in 65 rounds. The *test* for this hazard is the problem (blocker 3), not the window.
3. Unreadable owner. Sound as a migration rule. A readable owner is never broken by age
   (src/tsv.ts:209), and a new-format live lock is unreadable only on a read error such as EACCES
   across users. In that case a holder older than 2 s would be broken, which is the original
   defect, but only for a section that is already a fault. tests/costs.test.ts:1132 is
   unmodified and green. The rule itself is fine. Nothing pins "readable and live is never aged
   out" (blocker 2).
4. PID reuse. The stated consequence is accurate. A lock naming a live unrelated `sleep` gave
   `decide` exit=2 "held by pid 33914". After that pid exited, the next `decide` recorded, with no
   lock left. A lock naming pid 1 (kill(1,0) gives EPERM) also reads as alive and gives exit=2
   every time. "Until that process exits" means "until removed by hand" for a long-lived pid; the
   fix line says so.
5. Callers. Live holder: see above. Hooks exit 0 inside their budget and leave the holder's lock
   alone. Nesting at src/costs.ts:742-752 takes two different locks (costs.tsv, then marks). The
   inner callback appends directly, and `appendLine`/`prune` are only called outside any lock
   (src/costs.ts:336, 360, 368-370, 388, 393, 455), so nothing takes the same lock twice. Lock order
   is always costs before marks. The costs suite exercises the nested flush and is green on both
   runtimes. On an unwritable store, though, every hook overruns its budget (blocker 1).

Runtime rules: `src/tsv.ts` imports only `node:crypto`, `node:fs` and `./paths.ts`. There is no
`Bun.*` in src/, `withLock` is still synchronous (`Atomics.wait`), no build step, and both runtimes
are green.

Scope: `src/state.ts`, `src/decisions.ts`, `src/costs.ts` and `src/hooks.ts` are untouched since
d34761e. tests/lock-holder.ts is unchanged since bb73baa. No test was weakened: the bb73baa tests
are byte-identical, and the only lines removed from tests/decisions.test.ts are the `spawnSync`
loop, with the same assertions kept. tests/costs.test.ts is unchanged.

Leftovers: none after a normal exit, a throw inside `run` (0 files), or a waiter that throws at the
timeout. A waiter SIGKILLed during its wait leaves `<lock>.<pid>.<uuid>.tmp` (7 of 40 kills). See
note 1.

## Changes required

Blockers:

1. **src/tsv.ts:131-132, 183-192, 223 - `withLock` spins forever when the lock cannot be created
   for a reason other than "it already exists".** `tryCreate` turns every error into `false`
   (:188-192): ENOENT, EACCES, EROFS, ENOSPC, and ENOTSUP/EPERM from `linkSync` on a filesystem
   without hard links. `tryBreakStale` then returns `true` because no lock exists (:223), and
   `continue` skips both the timeout check and the sleep. Ran it: `decide` hangs at 99.6% CPU on an
   exFAT store and on a store whose `.mstack/` is read-only (the old code recorded the row in 0 s
   and in 2 s). `hook session-start` on exFAT overruns its 10 s budget (old: 70 ms). That is the
   "a CLI that hangs forever" both the old comment and the design row rule out. Fix: treat only
   EEXIST as "held". Surface any other create error as an error naming the lock (or, for link
   ENOTSUP/EPERM, fall back to an exclusive create and accept the empty-file window that the
   unknown-owner rule already handles). Never let the loop skip the timeout check. Add a test: a
   path in a missing or read-only directory must throw within the timeout rather than spin.
2. **tests/tsv.test.ts:99-125 and :153-174 - the central property is not pinned at the timeout
   real callers use.** Both waiters give up (200 ms at :107, 100 ms at :160) before a lock can be
   2 s old, so mutant M16 passes all 12 tests. M16 changes src/tsv.ts:209 from
   `if (owner !== null) return !alive(owner.pid);` to
   `if (owner !== null && !alive(owner.pid)) return true;`, which ages out live readable owners
   too. With M16, the original repro shows B entering at 2058 ms and C at 2564 ms while A is inside
   (55-3556 ms). Fix: a test where a live holder's lock is older than `UNKNOWN_OWNER_STALE_MS`
   (for example `utimesSync` on A's lock back 60 s, then a waiter with a short timeout) and the
   waiter must throw, not enter, and leave A's lock in place.
3. **tests/tsv.test.ts:212-229 - the hazard-2 test does not detect the race it names.** Mutant M14
   replaces src/tsv.ts:241 with `void same;`, so a breaker holding the guard removes whatever lock
   is there, including a live one. That breaks "a process removes only a lock it created", and
   the test passed it 10/10. My harness caught the same mutant in 20 rounds (4 overlaps, 10
   entries without own lock). The test cannot see it because the holders start whenever node
   boots, the release file is written before they enter (:217), so the section lasts about 0 ms,
   and the journal check never asks whether the process inside owns the lock. Fix: start the
   waiters from a shared instant, give the section a non-zero hold, assert inside the section that
   the lock carries the caller's pid, and repeat enough rounds that M14 goes red reliably.
4. **tests/tsv.test.ts (missing test) - the stale-guard branch, src/tsv.ts:232-233, is untested.**
   With it deleted (M10), a `.lock.break` left by a dead process makes every waiter throw for as
   long as it stays (harness: 8/8 threw, with lock and guard left). That is acceptance 3 for a
   process killed inside the guard. The behaviour is correct today (65 harness rounds, 0 throws),
   so only the test is missing: write a dead-owner `.lock.break` plus a dead-owner lock, and
   expect `withLock` to enter, hold its own lock, and leave neither file behind.

Non-blocking notes:

1. src/tsv.ts:181-195 writes and unlinks a temp file on every 2 ms poll. A waiter killed mid-wait
   leaves `<lock>.<pid>.<uuid>.tmp` behind (7 of 40 SIGKILLs). Nothing ever removes it, and in
   `.mstack/` the gate reports it as an uncommitted change. Writing the temp once per call and
   removing it in the `finally` would shrink the window. A sweep of temps whose pid is dead would
   close it.
2. M7 survives. A test with a lock naming pid 1 (EPERM for a non-root user; skip when running as
   root) would pin "EPERM is alive".
3. M13 survives as an equivalent mutant. The `same` comparison at src/tsv.ts:240-241 adds nothing
   over the `isStale(lock, again)` re-check, so drop it or say why it is there.
4. tests/tsv.test.ts:235 `writeFileSync(bench.journal === undefined ? "" : bench.file, "")` has a
   dead conditional, because `bench.journal` is a function. Write `bench.file`, or drop the line.
5. src/tsv.ts:4 makes the storage primitive import `UserError` from `src/paths.ts` (store
   discovery and git). There is no cycle (git.ts imports only a type), but the dependency points
   upward. `UserError` could live in its own module.
6. `.gitignore` changed in `34fa8c9` (the program-seeding chore: `research_notes/` was replaced by
   `docs/research/notes-2026-11-16/`). This is outside this item's scope and harmless, and it is
   noted only because the scope list excludes it.

## Suggested follow-ups (own items, not blocking this one)

- Store `.gitignore`: ignore `*.lock`, `*.lock.break` and `*.lock.*.tmp`. A lock left behind
  shows up as an uncommitted change (a pre-existing issue for `.lock`, new for the other two).
- Hooks fail open silently. While a lock is stuck (pid reuse, a long-lived EPERM pid), every Stop
  and SessionStart waits 2 s and loses its mark, and nobody is told. Item 54 (logging hook
  failures) should cover the `withLock` throw.
- Breaking a stale guard (src/tsv.ts:233, 249-252) is read-then-unlink. Renaming it to a unique
  name and then checking the token would make the residual window go away instead of just
  narrowing it.

Evidence ladder: blocker 1 at rung 5 (real CLI, real exFAT volume and read-only store); blocker 2
at rung 4 (mutant on the suite) and rung 5 (mutant on the original repro); blockers 3 and 4 at
rung 4 (mutant plus harness). The hazard-2 residual window is rung 3 only: argued, plus a harness
that found nothing, which is not proof of absence.
