# Implementation - mutation-test-pins (item 102)

Head of the code and tests: `031db3b` (base `113e784`, item start `79ff811`). Direct path; the contract
is the six acceptance criteria, the plan is decision row 2026-11-20T07:11:12Z. Scratch `S` =
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl102/`.
Every mutant ran in a `git archive` copy under `S/mut/`, every fixture under `S/fx/` or the
suites' own sandboxes. Nothing ran the mechanism in this checkout.

## What changed

Each mutant named in the criteria was rebuilt first, on the code at the item's start
(`S/scripts/survey-base.sh`, bun, the 16 mutation, run-async and hook test files together, 250
tests). Eleven survived and got a test; one (C) was already killed. Two (D, Q) no longer apply,
because item 101 rewrote the text they changed. Their behaviour was rebuilt as D2 and Q2, and
tests that exist kill both. None was equivalent. Each new test is at the end of its file, except
the two assertions A6 puts inside the root-check test. Then come the three text fixes: the root
check's refusal, design.md's not-caught list, and the moved-up comment. No other source changed.
No real defect was found.

## The mutants

Outcome: 1 = it survived and has a new test; 2 = an existing test already kills it; 3 = its
text is gone, and the same behaviour was rebuilt as a mutant on the new code. Each row reruns
with `bash S/scripts/mutant.sh <name> <sha> <bun|node> [test file]`. The script applies the
mutant with `sd -F` to a fresh archive, and fails loudly unless the text occurs exactly once and
the file changed. It then runs the row's test file and prints RED or GREEN. At `79ff811` the
row's test did not exist yet (`S/out/survey-base.txt`). At `031db3b` each row was run on its own
test file, with that file unmutated as the control, on bun and node (`S/out/verify-head.txt`).

| Mutant | What it removes | Out-come | At 79ff811 (bun) | Killed at 031db3b, bun and node, by |
|---|---|---|---|---|
| i | the `error` handler on stdout and stderr in `cmdVerify` (`src/cli.ts:245`) | 1 | GREEN 250/0 | `tests/mutation-cli.test.ts:341` |
| k | the signal check before a refusal in `refused()` (`src/mutation-run.ts:244`) | 1 | GREEN | `tests/mutation-signals.test.ts:297` |
| m | the reset after `git switch` when the lock's branch moved (`src/mutation-run.ts:154`) | 1 | GREEN | `tests/mutation-changed.test.ts:254` |
| a | the tail printed on a kill (`src/mutation-run.ts:466`, as `if (false)`) | 1 | GREEN | `tests/mutation-run.test.ts:455` |
| b | `TAIL = 20` (3) | 1 | GREEN | `tests/mutation-run.test.ts:455` |
| n | the 900 s default of `--timeout` (9; `src/cli.ts:219`) | 1 | GREEN | `tests/mutation-cli.test.ts:361` |
| D | round 3's: the hook's own reader taking a lock with no string `rootFromTop` | 3 | NOT-APPLICABLE (text gone) | rebuilt as D2 |
| D2 | D on the new reader: `readLockRecord` takes a lock with no `rootFromTop` past `checkLock` (`src/hooks.ts:507`) | (3) | RED | `tests/mutation-exits.test.ts:268` (exists) |
| Q | round 3's: the restore's `cd` unquoted | 3 | NOT-APPLICABLE (text gone) | rebuilt as Q2 |
| Q2 | Q on the new code: `inLockStore`'s `cd` unquoted, every printer's (`src/mutation-lock.ts:206`) | (3) | RED | `tests/mutation-exits.test.ts:183`, `:688` (exist) |
| C | the `badPath` check of `rootFromTop` (`src/mutation-lock.ts:621`) | 2 | RED | `tests/mutation-exits.test.ts:268` (exists) |
| N1b | the helper's check at start (`src/run-helper.mjs:78`) | 1 | GREEN | `tests/run-async.test.ts:311` |
| X2 | the gone-CLI clause in R15's line (`src/mutation-run.ts:88`) | 1 | GREEN | `tests/mutation-exits.test.ts:1063` |
| X3 | the gone-CLI clause in the hook's line from inside `.git` (`src/hooks.ts:474`) | 1 | GREEN | `tests/mutation-exits.test.ts:1086` |
| V1 | `there.top !== top` (`src/mutation-lock.ts:174`) | 1 | GREEN | `tests/mutation-exits.test.ts:984` (assertion `:1014`) |
| V2 | a silent git answering null (it refuses instead; same line) | 1 | GREEN | `tests/mutation-exits.test.ts:984` (assertion `:1020`) |

Counted by outcome:
- 11 new tests: i, k, m, a, b, n, N1b, X2, X3, V1 and V2;
- 1 killed by a test that already existed: C;
- 2 that no longer apply: D and Q, whose rebuilds D2 and Q2 existing tests kill;
- 0 equivalent.

A4 names no mutant. For it I built one: `said()` without its words for 127
(`src/mutation-run.ts:62`). It is GREEN at `79ff811`, where the test matched `/127/`, and RED at
`031db3b` (`tests/mutation-run.test.ts:197`).

**What D means now** (A2 asks this first). In round 3 the hook had its own reader. A lock with no
`rootFromTop` reached `join(top, undefined)`, which threw, and `src/cli.ts`'s catch fails the
hook open. Item 101 made the hook read the lock through `readLockAt` and `checkLock`. That lock
now fails `validateLock`, and the hook denies with the by-hand reason. D2 puts round 3's
acceptance back on the new reader. Through the CLI it fails open as D did (`S/scripts/d2-cli.sh`,
`S/out/d2-cli.txt`):

```
head: exit 0, denied: ...-include-untracked' saves every change and discards nothing; then delete the lock; 'mstack gate' says the same
D2: exit 0, ALLOWED
```

In process, `:268`'s case "no rootFromTop" gets the same throw out of `preToolUse`, and the test
fails.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | a and b: a kill prints the command's last 20 lines and only those; m: switch, then the reset when the lock's branch moved; k: a SIGINT that arrives while git answers R1's check, sent by a git on PATH, exits 130 and not 2; i: a stdout closed before the first line, exit 0 and the row; n: a 10 s command with no `--timeout` is killed, not blocked | tests/mutation-run.test.ts:455, tests/mutation-changed.test.ts:254, tests/mutation-signals.test.ts:297, tests/mutation-cli.test.ts:341, tests/mutation-cli.test.ts:361 |
| A2 | no new test: D and Q no longer apply, and D2, Q2 and C are killed by these existing tests | tests/mutation-exits.test.ts:268, tests/mutation-exits.test.ts:183, tests/mutation-exits.test.ts:688 |
| A3 | a pid that has exited and `sleep 0.15; : > <file>`: the file is never written, and no result is | tests/run-async.test.ts:311 |
| A4 | the R12 blocked test now asserts `exit 127 (the command was not found)` | tests/mutation-run.test.ts:197 |
| A5 | R15's line with the writer gone, then its command run as printed; the hook from inside `.git` with the writer gone | tests/mutation-exits.test.ts:1063, tests/mutation-exits.test.ts:1086 |
| A6 | V1 and V2: two assertions in the root-check test; the message's new words, which the B1 test pins | tests/mutation-exits.test.ts:984, tests/mutation-exits.test.ts:901 |

Every line cited above prints back as a `test(` or `userTest(` line with `bat -pp -r <n>:<n>`. One
is a template: `:688`, `` test(`A1 (item 105) the writer's CLI path holds ${kind}: ...`` inside
a `for`. Only A6 added lines inside an existing test, so only the one test after it moved: L14e,
from `:1021` to `:1036`. The comment fix kept its four lines, and A4 and the `:910` follow-up each
changed a single line.

## The two lines that name a gone CLI

- **R15's line.** `stillLocked`, `src/mutation-run.ts:86-89`: `tests/mutation-exits.test.ts:1063`.
  A dead run's lock with its `cli` at a path that does not exist (under a directory with a space,
  `'` and `"`), and A's `src/` read-only, so `restoreRun` exits 3. The test asserts the whole last
  line: `mutation: the lock stays; the CLI that wrote the lock, <gone>, is gone; once each path above
  is cleared: <running> verify --restore`. After the `chmod` back, it runs that command through
  `/bin/sh` from A and asserts exit 0, `restored 1`, and no lock. It is a `userTest`, as the
  suite's other read-only tests are, because root ignores a read-only directory.
- **The hook from inside `.git`.** `src/hooks.ts:473-475`: `tests/mutation-exits.test.ts:1086`.
  The lock's `cli` is gone, and `preToolUse` is asked `git -C .. commit -am x` with the git
  directory as its cwd. The reason ends `It is held by pid <pid>: the CLI that wrote the lock,
  <gone>, is gone; wait for it, or if it is not running, run from . under this worktree's top
  level: <running> verify --restore`.

## The three text fixes

1. **`src/mutation-lock.ts:175`** (`ea1c17f`) now says: `its root <root> is the store at <rel> in
   this worktree, so either the lock was edited or the checkout was moved and its old root is now
   that store, and whose the lock is cannot be told`. That is one sentence, and true both for the
   edit and for L15a/L15b/L15d. The test that pinned the old words, `tests/mutation-exits.test.ts:910`
   (inside `:901`), follows. `:851` asserts the absence of `/the lock was edited/`, and that phrase
   is still in the new words, so `:851` is unchanged and still meaningful. No doc or transcript
   quotes the message: `rg` for its words in docs/, CHANGELOG.md and the spec found none.
2. **`design.md`'s not-caught list** (`07b9a42`) gains the edit item 105 was filed for, under
   `GIT_CEILING_DIRECTORIES` naming a directory between the lock's `root` and the top level. git,
   run from that `root`, then finds no repository, so the `root` says nothing.
3. **The comment over `movedUp`** (`031db3b`, `tests/mutation-exits.test.ts:923-928`) now states
   the code's rule, from row 05:43:49Z. A root under the top level disagrees only when it is a
   store's own directory that git, run from it alone, places elsewhere than `rootFromTop`.

## Why no timing-sensitive test can fail on a correct head under load

- **`run-async:311` (A3).** There are two assertions.
  - *No `result.json`.* No timing at all. The check at start sets `orphaned` before the helper's
    event loop turns once. The command's exit can only be handled in a later turn, and with
    `orphaned` set its handler exits without a result.
  - *The file is never written.* The SIGKILL to the command's group goes out in the same
    synchronous run as the spawn. The shell's own `sleep 0.15` then comes before its write.
  - So at a correct head the file is written only if the helper is kept off the CPU for 150 ms
    between `spawn()` and the ~15 statements after it. Load turns that work from microseconds into
    milliseconds, which is two orders of magnitude short.
  - Under load the mutant can escape: a shell slow enough to start meets the 250 ms poll before
    its write. A correct head cannot turn red this way.
- **`mutation-cli:361` (n).** The head's bound is 900 s and the command sleeps 10 s.
  - The test is bounded by `SPAWN_TEST` (90 s) and `spawnSync`'s 120 s. The run is a recorded
    baseline, the revert, the 10 s sleep and the restore. It took 11.9 s in the node suite, at a
    load of 8 to 20.
  - The mutant's 9 s against the 10 s sleep matters only for catching the mutant.
- **The others** wait for no time:
  - `signals:297` waits for the holder's exit;
  - `cli:341` waits for the CLI's exit;
  - the rest run in process, with no wait.

## Commands

```
$ bash S/scripts/survey-base.sh          # S/out/survey-base.txt, 79ff811, bun, 16 files together
none GREEN 24 pass | i k m a b n N1b A4 X2 X3 V1 V2: GREEN 250 pass 3 skip 0 fail
D, Q: NOT-APPLICABLE | D2, C: RED 249 pass 1 fail (A2 the hook and R1 ...) | Q2: RED, 4 real fails (A1, A1 item 105 x3)
$ bash S/scripts/verify-head.sh 031db3b  # S/out/verify-head.txt, each row on its one file
bun:  six controls GREEN (25, 16, 11, 14, 23+1 skip, 13 pass); a b m k i n N1b A4 X2 X3 V1 V2 D2 Q2 C: RED, the named test
node: six controls GREEN; the same fifteen RED; D, Q NOT-APPLICABLE on both
$ bash S/scripts/portability.sh 031db3b  # S/out/portability.txt, the six changed files
dash   bun exit 0: 102 pass 1 skip 0 fail | node: tests 103, pass 102, fail 0, skipped 1
spaced bun exit 0: 102 pass 1 skip 0 fail | node: tests 103, pass 102, fail 0, skipped 1
$ bash S/scripts/suites.sh               # this checkout at 031db3b; S/out/suites.txt
bun run test: exit 0, 477 s
 1150 pass / 3 skip / 0 fail / Ran 1153 tests across 59 files. [402.71s]
ℹ tests 1153 / ℹ pass 1152 / ℹ fail 0 / ℹ skipped 1
bun run typecheck: exit 0
./bin/mstack lint-plugin .: PASSED - 0 failures, 0 warnings
check-doc-links: 112 relative links checked, 0 broken
load { 8.17 8.44 8.71 } at the start, { 20.33 12.60 10.16 } at the end; lock test: none; pgrep: nothing
```

The suite count is 1153: item 105's 1145, plus the eight new tests (A6's are assertions).

**The dash copy.** `sh` first on `PATH` is a link to `/bin/dash`. `"/bin/sh"` becomes
`"/bin/dash"` in `src/run.ts`, `src/run-helper.mjs` and `tests/mutation-exits.test.ts`.
`#!/bin/sh` becomes `#!/bin/dash` in `bin/mstack` and in the git wrappers of
`tests/mutation-signals.test.ts` and `tests/mutation-run.test.ts`. The one `/bin/sh` left in the
six files is a comment.

**The spaced copy** is at `S/port/sp ace dir/mstack`.

**Twenty runs.** `S/scripts/twenty.sh 031db3b <rt>` ran each of the six changed files twenty
times per runtime, in a fixed-count `for` loop, in a copy of `031db3b`. The two runtimes ran at
the same time, at a load of 15.8 at the start and 7.1 to 7.6 at the end (`S/out/twenty-{bun,node}.txt`):

```
bun  mutation-run 0 of 20 failed (25 pass) | mutation-changed 0 (16) | mutation-signals 0 (11)
     mutation-cli 0 (14) | mutation-exits 0 (23 pass 1 skip) | run-async 0 (13)
node mutation-run 0 of 20 failed (25 pass) | mutation-changed 0 (16) | mutation-signals 0 (11)
     mutation-cli 0 (14) | mutation-exits 0 (23 pass 1 skip) | run-async 0 (13)
```

That is 240 runs with 0 failures. Afterwards `pgrep -fl 'mutation-holder|run-helper'` printed
nothing, and no sleep of these tests was left.

## Decision rows

- 2026-11-20T08:04:58.351Z: A3 is pinned, and this answers row 2026-11-19T16:00:22Z (row 296).
  That row said no test could tell the two apart without a tight bound, because it compared how
  soon the command goes. This test asks whether the command gets to act.
- 2026-11-20T08:04:58.393Z: D and Q no longer apply. Their rebuilds D2 and Q2, and also C, are
  killed by existing tests, so no test was added for them.
- 2026-11-20T08:04:58.433Z: n is pinned by a 10 s command through the CLI. Reading the helper's
  argv out of `ps` was the alternative, and it was not taken.

## Real defects

None. Every mutant's behaviour at the head is the one its review described as right.

## What I did not do

- **No Linux run.** Dash was checked through the dash copy on macOS. The case-sensitive test at
  `tests/mutation-exits.test.ts:383` is skipped here (APFS folds case) and is not mine.
- **Not run as root.** The A5 R15 test is a `userTest`, which root skips.
- **No `gate --full`.** It appends receipts to this store. The suites, the typecheck, the lint
  and the doc links above are its obligations.
- **Not every file for every mutant at the head.** Each mutant ran on its own file only. The
  base survey ran all 16 files.

## Files

- `tests/mutation-run.test.ts`, `tests/mutation-changed.test.ts`, `tests/mutation-signals.test.ts`,
  `tests/mutation-cli.test.ts`, `tests/run-async.test.ts`, `tests/mutation-exits.test.ts`
- `src/mutation-lock.ts` (the message only), `.mstack/specs/mutation-check/design.md`
- `.mstack/decisions.tsv`, `.mstack/progress/current.md`, `.mstack/ledger.tsv`, this report

Commits: `d8dfedd` (A1), `e057018` (A3), `23f1cf0` (A4), `342ad0c` (A5), `5ffc139` (A6 tests),
`ea1c17f`, `07b9a42` and `031db3b` (the three text fixes), then this report.
