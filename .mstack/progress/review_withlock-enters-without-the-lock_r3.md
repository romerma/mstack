# Review - withlock-enters-without-the-lock

**Verdict:** APPROVED

Round 3, reviewing alone. Head `4dbb41c`, last code-changing commit `9499621`. Whole change
`git diff d34761e...HEAD -- src tests`; round 3 `git diff c82902e...HEAD -- src tests`
(`src/tsv.ts`, `tests/tsv.test.ts`, `tests/lock-holder.ts`, `tests/lock-racer.ts` deleted).
Scope as set by the `review-r3` row (`.mstack/decisions.tsv:119`).

All three round 2 blockers are resolved, and I ran each one myself. (1) The round 2 reproduction
with real processes no longer overlaps: the stopped creator reads back the breaker's token and
waits (APFS and exFAT). Removing the read-back turns the new test red on both runtimes.
(2) N8 is killed on both runtimes. (3) The statistical test and `tests/lock-racer.ts` are gone.
M14 is killed deterministically on both runtimes. Under five rounds of four bun suites plus two
node suites at once (two of the rounds also had 18 busy loops), `tests/tsv.test.ts` failed
**0 times in 399 executions** (node 165, bun 234), and every bun suite ran all 394 tests.

I accept two residual risks, named under "Residual risks accepted". The bigger one I reproduced
with real processes: a creator that resumes exactly inside a breaker's re-check-to-remove step
still overlaps. It needs two stops lined up to the microsecond, and this design has no
compare-and-delete primitive to close it. It should be added to Known limits.

## Round 2 findings: resolved or not

| Round 2 finding | Resolved? | Evidence (this round, run by me) |
|---|---|---|
| Blocker 1: creator stopped >= 2 s between create and owner write is broken as a leftover and enters beside the breaker | **Yes** | Round 2 harness `review52r2/ownerless/run.sh`, unchanged, against HEAD. 3000 ms stop (twice): `B enter` at +2005, `A resumed` at +3157, `B leave` at +3505, `A enter` at +3508 with `ownLockOnDisk=true`, so there is no overlap (round 2: 341 ms overlap). Same result twice on exFAT. Mutant RB (`return true;` for the read-back) is killed by `tests/tsv.test.ts:149` only, on node and bun. Residual window: see "Residual risks accepted" 1 |
| Blocker 2: empty-guard branch untested (N8 survives) | **Yes** | N8 is killed by `tests/tsv.test.ts:273` only, on node and bun |
| Blocker 3: spawn tests fail on correct code under load; race test costly and statistical | **Yes** | `tests/lock-racer.ts` is absent, with no references to it left. M14 is killed by `:364` only, on node and bun, and the file takes 2-3 s. Load: `tests/tsv.test.ts` 0 failures in 399 executions (table below). Bun suites: 20 of 20 ran 394/394 tests, with no `NotImplementedError` cascade. A waiter that waits now ends red with no children left: M6 in 45 s (node) / 44 s (bun), N1 in 130 s / 129 s |
| Note a: racers keep running on a cancelled test | Yes | The racers are gone. The bench watchdog (`tests/tsv.test.ts:73-75`) kills children at 45 s. `pgrep` found 0 `lock-holder.ts` processes after every mutant run |
| Note b: 7 s per runtime for one mutant | Yes | Replaced by `:364` (seam). Node suite 18.7 s, bun suite 58.5 s (round 2: 19.4 s / 65.6 s) |
| Note c: old directory at the lock path throws a raw SystemError | Yes | `:521`. R9 (rethrow) killed on both runtimes |
| Note d, second half: a removal on the deadline pass throws "held" | Yes | `:537`. R6 (revert) killed on both runtimes |
| Note d, first half: message names the dead owner when the guard blocks | Not done, queued | Out of this round's scope per the brief |
| Note e: `UserError` in `src/paths.ts` | Not done, queued | Deferred to item 53 |

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A1 never runs beside a live holder past its timeout | tests/tsv.test.ts:120, :213, :236 | `:120` red on `d34761e`'s `src/tsv.ts` on node and bun (`B ran its critical section while A was still inside its own`), green at HEAD. M16 killed by `:236`. Original repro below |
| A2 removes only its own lock | :149 (read-back), :364 (re-check under guard), :475 (release) | RB, R1, R2, R12, M14 killed on both runtimes. Residual window not covered (residual 1) |
| A2 break, then the same atomic create | :187, :257, :273, :504, :537 | M6, M9, M10, N8, R6 killed |
| A3 killed process's lock does not hang | :187, :257, :273, :504, :417, :431, :448 | B1, B1b, M10, N8 killed. Real CLI on exFAT and on a read-only store (section C) |
| A4 recorded with decide | `.mstack/decisions.tsv:116` (design), `:118`, `:120` | `decide` against a live holder exits 2 naming the lock and pid (section F) |
| A5 concurrent test fails without withLock | tests/decisions.test.ts:428 | Mutant red on node 3/3 and bun 3/3. Green unmutated. 0 failures in 30 loaded suites |
| Contract "never visible half-written" | :326 | N10 (owner in two writes) killed 3/3 on node and bun with the time-bounded writer |

## Acceptance, quoted

**"a waiter whose timeout expires while a live holder is still inside never runs its critical section concurrently with that holder; a test with real concurrent processes (spawn, not spawnSync) shows it and fails on unmodified code"**
Met, at rung 5 on the original repro and rung 4 in the suite. Repro (`repro/lock.mjs`, `T0` set,
A 3500 ms, B +200 ms, C +2300 ms): B threw at 2292 ms (`... is held by pid 30436 and did not let go in 2003 ms`),
A left at 3552 ms with its lock present, C entered at 3555 ms, nothing was left behind.
`tests/tsv.test.ts:120` spawns the holder and the waiter (`lockBench().hold`, `spawn`). I ran it
against `git show d34761e:src/tsv.ts` in a scratch copy and it failed on node and bun with
`B ran its critical section while A was still inside its own`. M16 (age out a live owner) is
killed by `:236`.

**"a process removes only a lock it created; breaking a stale lock is followed by re-acquiring it with the same atomic create before entering"**
Met for every interleaving the tests reach, rung 4. The stopped creator no longer removes or
overwrites the breaker's lock. The owner is written through the fd (`src/tsv.ts:259`) and read
back by token (`:270`), and the tests check this (`:149`: `W's lock was changed or removed by C`).
RB, R1 (any readable owner accepted) and R2 (write by path) are killed by `:149`. M14 is killed
by `:364` and M4-class release by `:475`. Break-then-create is checked by `:187`, `:257`, `:273` and `:504`, each
asserting that the caller is inside with `^<own pid> <uuid>\n$` on disk. One interleaving is still
open: see residual 1. It needs two stops aligned to microsecond windows, it is the same class as
the guard's documented residual, and this design cannot close it without a compare-and-delete.

**"a lock left by a killed process does not hang the CLI: it is detected as stale, broken, and the command completes"**
Met, rung 4 and 5. Killed holder `:187`, dead guard `:257`, empty guard `:273`, old unreadable
lock `:504`. Real CLI: exFAT store `decide` exit 0 in 35-38 ms, read-only store exit 2 in 31 ms,
hooks exit 0 in 35-96 ms on both (section C). No case spins: B1b, the only spinning mutant, is
caught by the probe deadline (`:448`).

**"what a waiter does when a live holder outlasts the timeout (keep waiting, or exit non-zero naming the lock) is recorded with mstack decide"**
Met. Design row `.mstack/decisions.tsv:116` (throw, naming the lock, the holder and the wait), and
the round 2 and round 3 implement rows (`:118`, `:120`). The code matches: `src/tsv.ts:193-200`.
The CLI run is in section F (`decide` exit 2 in 2039 ms, message names the lock and pid 38414).

**"the 'concurrent decisions' test in tests/decisions.test.ts launches its processes concurrently, and removing the withLock call makes it fail (mutation shown in the report)"**
Met, rung 4. `tests/decisions.test.ts:439-452` spawns 12 `decide` processes and awaits them with
`Promise.all`. I applied the mutation in a scratch copy, changing `src/decisions.ts:53`
`  return withLock(store.decisions, () => {` to `  return ((run: () => Decision) => run())(() => {`.
Node was red 3/3 and bun red 3/3, both with `and each must be distinguishable from the others`.
Unmutated it is green on both. Under load it had 0 failures in 30 suites.

## Verification I ran

```
$ ./bin/mstack version          -> mstack 0.2.1 at /Users/romerma/Code/mstack
$ ./bin/mstack gate             -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full      -> bun test tests/: 400 pass, 0 fail, Ran 400 tests across 22 files. [57.73s] (includes sandbox/, item 46)
                                   node --test: ℹ tests 394 / ℹ pass 394 / ℹ fail 0
                                   [ok] npm test && npm run typecheck && bin/mstack lint-plugin .
                                   PASSED - 0 failures, 0 warnings; exit=0 (1:18.36 total)
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 394 / ℹ pass 394 / ℹ fail 0 / ℹ duration_ms 18741.829791
$ bun test ./tests              -> 394 pass / 0 fail / Ran 394 tests across 20 files. [58.50s]
$ ./bin/mstack ledger check withlock-enters-without-the-lock   (before my row)
FAIL no verdict at 4dbb41c7; 5 row(s) exist at other SHAs and a new head SHA voids them
```
node v26.13.1, bun 1.3.11, macOS 25.6, APFS temp volume, 18 cores.

Original repro:
```
A|    51ms A ENTER
B| UserError: .../review52r3/repro/t.tsv.lock is held by pid 30436 and did not let go in 2003 ms
B exit at 2292 ms
A|  3552ms A LEAVE lock-file-present=true
C|  3555ms C ENTER
C|  3856ms C LEAVE lock-file-present=true
leftovers:
```

## A. The read-back, attacked

Round 2 reproduction, real processes, HEAD code (`fs.writeSync` wrapped in the child so the creator
SIGSTOPs itself just before the owner write):
```
##### stop 3000 ms
A created-empty t=1794856961578
B enter t=1794856963583 ownLockOnDisk=true
A resumed t=1794856964735
B leave t=1794856965083 ownLockOnDisk=true
B done after 3331 ms
A enter t=1794856965086 ownLockOnDisk=true      <- A waited for B instead of entering beside it
A leave t=1794856966586 ownLockOnDisk=true
##### stop 1000 ms
A resumed t=1794856972907
A enter t=1794856972908 ownLockOnDisk=true
B THREW after 2004 ms: ... is held by pid 30557 and did not let go in 2004 ms
```

**Can two processes both read back their own token?** Not from one path at one time: each
caller reads back after its own write, and a path has one content. For both to be inside, the
first one's file has to be removed while its owner is inside. Release only removes on a
token match. That leaves the breaker, and the breaker removes only what it judged stale
twice (`:306`, `:321`).

**Can the read-back pass and the lock then be broken while its owner is alive?** Yes, in one
interleaving. The breaker's re-check (`src/tsv.ts:321`) and its `rmSync` (`:323`) are two
operations, and a creator that resumes between them writes, reads back its own token and
enters. Then the breaker removes the file. I ran it with real processes on the HEAD code
(scratchpad `review52r3/residual/`: the creator as in round 2, and the breaker with `fs.rmSync`
wrapped so it SIGSTOPs itself just before removing the lock; the harness resumes the creator,
waits for `A enter`, then resumes the breaker). 3 of 3 runs:
```
A created-empty t=1794857008693
B about-to-rm lock (content now "") t=1794857010695
A resumed t=1794857010702
A enter t=1794857010703 ownLockOnDisk=true
B resumed, removing lock whose content is "30737 4747753c-9d21-4091-b3ca-bce4e6ed878d\n" t=1794857010711
B enter t=1794857010711 ownLockOnDisk=true
A leave t=1794857012203 ownLockOnDisk=false     <- 1.5 s overlap
B leave t=1794857012211 ownLockOnDisk=true
```
Accepted as a residual (see below). It needs the creator stopped for 2 s or more inside the
microseconds between `openSync` and `writeSync`, and its resume to land inside the breaker's
microseconds between re-read and remove. Round 2's defect needed only the first of those.

**The guard.** `tryCreate` serves both paths, so the guard gets the same read-back. Walked
(rung 3): a breaker stopped at `guard-created` for 2 s or more has its empty guard removed by
a second breaker (`:315`). On resume it reads back a foreign guard or none, `tryCreate` returns
false, and it backs off. The guard's own re-read-to-remove gap (`rmIfOwner`, `:337-338`) is the
residual already listed in Known limits. Dropping the guard read-back (R11) survives every test.
Even with R11, the re-check under the guard (`:321`) keeps a second guard holder from removing a
live lock, unless the two breakers also overlap inside the re-check-to-remove step. The seam has no
step there, so that cannot be shown deterministically.

**A creator resumed after its own deadline** (5000 ms stop, 5000 ms timeout):
```
B enter t=1794856976489 ownLockOnDisk=true
B leave t=1794856977989 ownLockOnDisk=true
A resumed t=1794856979657
A THREW .../t.tsv.lock is held by a process that cannot be identified and did not let go in 5174 ms
```
No lock exists at that point, yet the fix line says to remove it. Wording at an edge, note 3.

## B. The seam (`options.step`)

- **Inert when absent:** every call is `step?.(...)` (`src/tsv.ts:202`, `:256`, `:307`), and no
  production caller passes `step`: `rg` over `src/` outside `tsv.ts` finds none. Both full suites
  are green with it absent everywhere except `tests/lock-holder.ts`.
- **Typed:** `LockStep` is a four-literal union (`:99`), `step?: (name: LockStep) => void`
  (`:104`), and the call stays synchronous. A misspelt `blockAt` in a test never blocks. The
  test then fails at its fixture assertion within `SIGNAL_MS`; it does not pass silently.
- **Documented** as a test seam in the `LockOptions` JSDoc (`:103`) and the `withLock` comment
  (`:149-152`).
- **Slow callback:** blocking at `lock-created` is the stopped creator, and the read-back covers
  it. Blocking at `guard-created` was walked above. Blocking at `judged-stale` is covered by the
  re-check (`:364`). Blocking at `waiting` only delays.
- **Throwing callback:** throwing at `judged-stale`, `guard-created` or `waiting` leaves nothing
  behind and has no effect on others. **Throwing at `lock-created`, after the lock was taken over,
  removes the new holder's live lock.** The step runs inside the `try` whose `catch` does
  `rmSync(path)` by path (`:255-262`). Ran it on node and bun (scratchpad
  `review52r3/seam/throwing-step.mjs`):
  ```
  W entered; lock now owned by W: true
  C threw UserError: cannot create the lock <dir>/t.tsv.lock: step callback failed
  after C's throw, while W is still inside: lock exists=false
  ```
  No test throws from `step`, and production passes none, so this is not reachable today.
  Production can reach the same `catch` through a `writeSync` failure after a stop of 2 s or more.
  Note 2.
- **Positive signals:** every seam test waits on journal lines (`X at <step>`, `X enter`) or on
  exits, bounded by `SIGNAL_MS` (`tests/tsv.test.ts:43`). The only clock-dependent move is
  `utimesSync` aging a lock to 60 s, which replaces waiting 2 s and is what a breaker reads.
- **Faithful?** Yes for both. `:149` holds the creator between `openSync` and `writeSync` with
  the fd open and the process alive, which is the state a SIGSTOP produces. The round 2 harness
  (real SIGSTOP, real 2 s) reaches the same state and now gives the same outcome. `:364` holds a
  breaker after its first judgement and before the guard, a state any preemption produces.
  Blocking at a step creates no state that real scheduling cannot reach. The one state it cannot
  reach is the residual above, because no step sits between the re-check and the remove.

## C. Regressions from the shared `tryCreate`, on real surfaces

Stores built with `git init` plus this checkout's `bin/mstack setup` (round 2 scripts in
`review52r2/cli/`).
```
exFAT (hdiutil -fs ExFAT, mount type exfat, noowners; node link() -> ENOTSUP)
  decide #1 exit=0 in 38 ms: recorded        decide #2 exit=0 in 35 ms: recorded
  12 concurrent decides in 94 ms, exit codes: 0 x12; concurrent rows=12 distinct ts=12
  burst 1: 24 concurrent decides 000000000000000000000000
  burst 2: 24 concurrent decides 000000000000000000000000; burst rows=48 distinct ts=48
  hook session-start exit=0 in 44 ms | hook stop exit=0 in 92 ms | hook session-end exit=0 in 35 ms
  lock-ish leftovers: (none)
  stopped-creator harness with TMPDIR on exFAT, 3000 ms stop, twice: B enter, A resumed, B leave, A enter; no overlap
APFS, .mstack and .git/mstack chmod 555 (restored to drwxr-xr-x afterwards)
  decide exit=2 in 31 ms: mstack: cannot create the lock <store>/.mstack/decisions.tsv.lock: EACCES: permission denied, ...
  hook session-start exit=0 in 35 ms | hook stop exit=0 in 96 ms | hook session-end exit=0 in 41 ms
```
Budgets (`hooks/hooks.json`): SessionStart 10 s, Stop 20 s, SessionEnd 5 s. Token read-back on
exFAT works: it compares content, not inodes. I also ran `tests/tsv.test.ts` with `TMPDIR` on the
exFAT volume, 3 times per runtime: 23 of 24 pass. The one failure is the read-only fixture
(`:431`, got `ENTERED`), because exFAT mounted `noowners` ignores `chmod 555`. That is the
environment, not the code. The volume was detached and the image deleted (`hdiutil info` lists no
image).

## D. Mutants

Applied by script to a scratch copy of HEAD (`git archive`; scratchpad `review52r3/mut/specs.mjs`
holds each exact edit), never to this checkout. `tests/tsv.test.ts` was run with its own timeouts
(no override), and the copy was restored and compared (`cmp`) against HEAD after each batch.
Baseline on the copy: 24 pass on node and bun. Line numbers are HEAD's `src/tsv.ts`.

| Mutant | Edit | node | bun | Killed by |
|---|---|---|---|---|
| RB read-back removed | `:270` -> `return true;` | killed | killed | :149 only |
| R12 read-back skipped for the lock | `:270` -> `return created === "lock-created" ? true : readOwner(path)?.token === token;` | killed | killed | :149 |
| R1 read-back accepts any owner | `:270` -> `return readOwner(path) !== null;` | killed | killed | :149 |
| R2 owner written by path | `:259` -> `writeFileSync(path, ...)` | killed | killed | :149 |
| **R11 read-back skipped for the guard** | `:270` -> `return created === "guard-created" ? true : ...` | **survives** | **survives** | none; see A, "The guard" |
| N8 empty guard never removed | `:338` -> `if (owner?.token === token) rmSync(...)` | killed | killed | :273 only |
| M14 no re-check under guard | delete `:321` | killed | killed | :364 only (deterministic, file 2-3 s) |
| M16 live owner aged out | `:291` -> `if (owner !== null && !alive(owner.pid)) return true;` | killed | killed | :236 |
| M9 no guard | `:313` -> `if (false && !tryCreate(guard, ...))` | killed | killed | :257, :273, :295 |
| M10 dead guard kept | delete `:315` | killed | killed | :257, :273 |
| M7 EPERM read as dead | `:286` -> `return false;` | killed | killed | :312 |
| M6 pid always alive | `:282-283` -> `return true;` | killed, red in 45 s | killed, red in 44 s | 5 tests; 0 holders left |
| N1 owner never written | delete `:259` | killed, red in 130 s | killed, red in 129 s | 13 tests; 0 holders left |
| N10 owner in two writes | `:259` split in two `writeSync` | killed 3/3 | killed 3/3 | :326 |
| B1 create errors swallowed | `:253` -> `return false;` | killed | killed | :417, :431 |
| B1b deadline skipped | `:189` -> `if (removed \|\| !existsSync(lock)) {` | killed (18 s) | killed (17 s) | :448 (probe deadline) |
| R3 / R4 / R5 a step call removed | delete `:256` / `:307` / `:202` | killed (22 / 23 / 43 s) | killed (22 / 22 / 42 s) | :149 / :364 / both |
| R6 note d reverted | `:189` -> `if (removed && waited <= timeout) {` | killed | killed | :537 |
| R9 note c reverted | `:324` catch -> `throw e;` | killed | killed | :521 |
| **R7 lastChance never set** | delete `:190` | **survives** | **survives** | none; note 4 |
| **R8 every removal retries** | `:189` -> `if (removed) {` | **survives** | **survives** | none; note 4 |
| **R10 unremovable lock counted as removed** | `:327` -> `return true;` | **survives** | **survives** | none: same outcome, a 2 s busy loop (sys 1.70 s vs 0.28 s); note 4 |
| **R13 no rm in tryCreate's catch** | delete `:261` | **survives** | **survives** | none; pre-existing line; note 2 |
| `src/decisions.ts:53` without `withLock` | `((run: () => Decision) => run())(() => {` | killed 3/3 | killed 3/3 | tests/decisions.test.ts:428 |

## E. Tests weakened or removed in round 3

Compared `tests/tsv.test.ts` against `c82902e`:
- Removed: only the 32 x 120 race test (`c82902e` `:297`), which the `review-r3` row authorizes.
  Its mutant M14 is killed by `:364` instead.
- Stronger: `:135` now asserts that B decided (it was an unasserted `until(..., 1_500)`). Four tests
  are new (`:149`, `:273`, `:521`, `:537`).
- Relaxed timing, assertions unchanged: `until` bounds 5 s -> 20 s (`SIGNAL_MS`), probe kill slack
  3 s -> 15 s (`:411`), and the writer in `:326` bounded at 500 ms instead of 3000 iterations. The
  slack means "fails promptly" now tolerates up to 15.2 s before calling it a hang. B1 and B1b are
  still killed, and N10 still dies 3/3. No assertion was loosened.

## F. Callers and leftovers

`tests/lock-holder.ts` holding each lock (APFS store):
```
decisions.tsv.lock held   decide exit=2 in 2039 ms: mstack: <store>/.mstack/decisions.tsv.lock is held by pid 38414 and did not let go in 2003 ms
                          hooks exit 0 in 44/91/35 ms; holder's lock intact; holder exit=0
costs.tsv.lock held       decide exit=0 in 31 ms; hooks exit 0 in 36/90/35 ms; holder's lock intact
costs-marks.jsonl.lock    decide exit=0 in 31 ms; hooks exit 0 in 2052/2126/2064 ms; holder's lock intact
after all holders         decide exit=0; no lock or .break file left in .mstack or .git/mstack
```
No path I ran left a file that blocks later callers. Seam tests end with neither the lock nor the
guard present (`:181`, `:394`). The throwing-step case leaves nothing behind either; its problem
is the removal (B).

## G. Runtime rules, comment, scope

- `src/tsv.ts` imports `node:crypto`, `node:fs`, `node:path` and `./paths.ts` only. No `Bun.` in
  `src/`, no new dependency, no build step. `withLock` stays synchronous (`Atomics.wait`, `:222`,
  and the step callback is `=> void`). Both runtimes are green, and the typecheck passed inside
  `gate --full`.
- Comment: the read-back, seam and Known limits paragraphs match the code. Two sentences overstate:
  "A waiter never enters without holding the lock" (`:135`), and "the cost then is a retry for its
  creator, not an overlap" (`:170-171`). Residual 1 is an overlap, and with a skewed file server
  clock its first precondition no longer needs a stop. Note 1.
- Scope: `git diff d34761e...HEAD --stat -- . ':!.mstack'` lists `src/tsv.ts`, `tests/tsv.test.ts`,
  `tests/lock-holder.ts`, `tests/decisions.test.ts`, plus `tests/lock-probe.ts` (round 2's probe
  helper, unchanged this round) and `.gitignore` (round 1 commit `34fa8c9`, already noted in round 1
  as note 6). `tests/lock-racer.ts` was added and removed inside the branch, so it does not appear.

## Load runs (unmodified checkout)

Each round runs 4 full bun suites (`bun test ./tests`) and 2 full node suites at once, plus a
`tests/tsv.test.ts` loop per runtime for as long as the suites run. Rounds La-1..3 had no other load.
Rounds Lb-1..2 added 18 busy loops (`yes`), one per core. Total 463 s (scratchpad `review52r3/load/`).

| Where | Executions of tsv.test.ts | tsv.test.ts failures | Other failures (pre-existing, not blocking) |
|---|---|---|---|
| 20 full bun suites | 20 (all 394/394 tests across 20 files ran) | **0** | tests/run.test.ts:54 in 7 of 20 |
| 10 full node suites | 10 | **0** | tests/run.test.ts:54 in 2 of 10; tests/costs.test.ts:698 in 2 of 10 (both in Lb-2) |
| tsv.test.ts loop, node | 155 | **0** | - |
| tsv.test.ts loop, bun | 214 | **0** | - |
| **Total** | **399 (node 165, bun 234)** | **0** | tests/decisions.test.ts:428: 0 of 30 |

## Residual risks accepted

1. **Breaker removes a lock that became live between its re-check and its remove**
   (`src/tsv.ts:321-323`, against `:259-270`). Reproduced in section A with real processes and
   two injected stops: 1.5 s overlap, 3 of 3. Acceptable because:
   - It needs a creator stopped for 2 s or more inside a microsecond window, and its resume
     landing inside another microsecond window. Round 2's blocker needed only the first.
   - Removal is by path with no compare-and-delete, so no check can close it within this design.
     The only design that removes the empty instant is write-then-`link` with this as a fallback,
     and the round 2 implement row (`.mstack/decisions.tsv:118`) rejected that for its moving parts.
   - The guard carries the same class of residual and documents it.
   - The rest of the item holds at rung 4 to 5.

   What is owed is documentation (note 1).
2. **A throwing `step`, or a `writeSync` failure after a stop of 2 s or more, removes the
   new holder's lock by path** (`src/tsv.ts:255-262`). Not reachable today: no caller throws from
   `step`, and the write failure needs ENOSPC/EIO on a 45-byte write at the same moment. A cheap
   fix is in note 2.

## Non-blocking notes

1. `src/tsv.ts:135`, `:154-171`: add residual 1 to Known limits ("a creator resumed inside a
   breaker's re-check-to-remove step, after a stop longer than the limit, enters and then has its
   lock removed"). Soften `:135` and `:170-171` to match: with a file server whose clock is more than
   2 s behind, a fresh empty lock is stale at once, so the remaining window is two microsecond
   races and no longer a stop plus a race.
2. `src/tsv.ts:255-262`: the `catch` removes by path, and `step?.(created)` sits inside it. Either
   drop the `rmSync`, so a failed create leaves an empty lock that ages out in 2 s (R13 shows nothing
   pins the removal), or remove only when `fstatSync(fd, { bigint: true })` and
   `statSync(path, { bigint: true })` agree on dev and ino (round 2 found bigint inodes reliable on
   exFAT). And/or call the step before the `try`.
3. `src/tsv.ts:193-200`: a caller whose read-back failed because the lock was removed, and whose
   deadline has passed, throws "held by a process that cannot be identified ... remove <lock>" when
   no lock exists. One more pass when `existsSync(lock)` is false at the deadline (like
   `lastChance`) would take it. This is the same family as note d.
4. Survivors R7, R8 and R10: no test pins the loop's bound after a removal past the deadline, or
   the sleep on an unremovable lock. All three keep the outcome. R7 and R8 can only spin while
   something keeps planting dead locks, and R10 burns 2 s of CPU. R11: see A. None changes mutual
   exclusion at the seam's granularity.
5. `tests/tsv.test.ts:43`, `:411`: N1 takes about 130 s per runtime to go red (several 20 s waits
   per test). It is bounded and leaves no processes, but a smaller `SIGNAL_MS` for the in-process
   waits would make the red faster.
6. `tests/decisions.test.ts:428` spawns 12 processes under bun's 5 s default timeout. It had 0
   failures in 30 loaded suites, so I do not count it as a finding. An explicit timeout would match
   the rule now used in `tests/tsv.test.ts`.

## Suggested follow-ups (own items)

- Known limits for residual 1, plus the `tryCreate` catch (notes 1 and 2): one small item, no
  behaviour change beyond the catch.
- Already queued and not repeated here: lock artifacts not ignored in the store, the wall-clock
  wait, the message naming the dead owner when the guard blocks, `UserError` in `src/paths.ts`,
  and the two load-sensitive tests (`tests/run.test.ts:54`, `tests/costs.test.ts:698`).

Evidence ladder:
- Blockers 1-3 resolved at rung 4: real processes on the HEAD code, mutants on both runtimes,
  and the load runs.
- The original repro, the exFAT and read-only stores and the live-holder runs at rung 5: the real
  CLI on real volumes.
- Residual 1 at rung 4: real processes on the HEAD code with injected stops. A real occurrence
  would need two aligned stops, so it cannot be taken to rung 5.
- The guard's read-back at rung 3 (walked, plus R11 surviving).

All runs were on this machine (macOS 25.6, APFS temp volume plus one exFAT image, 18 cores,
node v26.13.1, bun 1.3.11). The ledger row records `test-verified`: the item's central claims
reached rung 4, not 5.
