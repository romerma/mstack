# Review - mutation-test-pins

**Verdict:** CHANGES_REQUESTED

Item 102, head `69e6c045f4168a6fd885d5c604c02f9673645c64`, base `113e784`. Two blocking findings, each with a
one-line fix: a new test whose name claims more than it holds, and a test that A2 relies on, which fails on a
correct head under load on bun. Every mutant in the table is killed as the table says. `S` =
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review102/`.
Each mutant ran in its own `git archive` copy under `S/mut/`, against the one named test (bun `-t`, node
`--test-name-pattern`), with that test unmutated as the control (`S/scripts/mut.sh`, `rerun.sh`, `rerun2.sh`,
`rerun3.sh`; results `S/out/rerun-{bun,node}.txt`, `rerun2.txt`, `rerun3.txt`; diffs and logs `S/out/mutants/`).
Nothing of the mechanism ran in the checkout.

## The mutants, rerun (point 1)

Rebuilt from each review's words, not copied from `mutant.sh`. Where my text differs from the implementer's
(a, m, C, N1b, V2), it removes the same thing. Each control is GREEN on both runtimes with exactly the named test
run (1 pass; 3 for the `:688` template).

| Mutant | The review: what it removes | My rebuild at the head | Named test | bun | node | Table |
|---|---|---|---|---|---|---|
| i | r2 NB3: the stdout `error` handler | `src/cli.ts:245` removed | `mutation-cli:341` | RED | RED | matches |
| k | a refusal printed before the signal check | `refused()` returns `refuse(...)`, no `ctl.caught` | `mutation-signals:297` | RED | RED | matches |
| m | R19's reset after a switch | the `tip === lock.head ? "" : reset` clause removed | `mutation-changed:254` | RED | RED | matches |
| a | R12's tail printed on a kill | `printTail` dropped from `case "killed"` | `mutation-run:455` | RED | RED | matches |
| b | R12's 20 lines | `TAIL = 3` | `mutation-run:455` | RED | RED | matches |
| n | the 900 s default | `DEFAULT_TIMEOUT_S = 9` | `mutation-cli:361` | RED | RED | matches |
| D | r3 NB4: hook takes a lock with no string `rootFromTop` (`hooks.ts:470` at `cb1b255`) | its text occurs 0 times in `src/hooks.ts` | - | n/a | n/a | matches: no longer applies |
| D2 | D on the hook's reader now | `readLockRecord` lets such a lock past `checkLock` | `mutation-exits:268` | RED | RED | matches |
| Q | r3: restore's refusal names the store unquoted (`mutation-run.ts:527` at `cb1b255`) | `cd ${shellWord(lockStoreDir(` occurs 0 times | - | n/a | n/a | matches: no longer applies |
| Q2 | Q on `inLockStore`, which that refusal (`mutation-run.ts:532`) prints now | `` cd ${dir} `` | `mutation-exits:183`, `:688` (3 of 3) | RED | RED | matches |
| C | r3: no `badPath` check of `rootFromTop` | its `problems.push` removed | `mutation-exits:268` | RED | RED | matches: already killed, RED at `79ff811` too |
| N1b | r3 NB5: the helper's check at start | `watch();` removed | `run-async:311` | RED | RED | matches |
| A4 | item 104 NB1: a bare `127` | `said()` without the 127 words | `mutation-run:197` | RED | RED | matches |
| X2 | printed-exits r2 NB4: gone-CLI clause in R15's line | `${restoreLine.lead}` dropped (`mutation-run.ts:88`) | `mutation-exits:1063` | RED | RED | matches |
| X3 | the same clause, hook from inside `.git` | `${restore.lead}` dropped (`hooks.ts:474`) | `mutation-exits:1086` | RED | RED | matches |
| V1 | followups r2 NB2: `there.top !== top` dropped | as named | `mutation-exits:984` (`:1014`) | RED | RED | matches |
| V2 | a silent git refuses | `there === null` returns a refusal | `mutation-exits:984` (`:1020`) | RED | RED | matches |

**17 of 17 match the table.** 15 were rerun on both runtimes, all RED with the control GREEN, and D and Q do not
apply. Each RED log shows an assertion of the named test failing. The exception is D2, where `preToolUse` throws
(`The "paths[1]" property must be of type string`), as the report says.

**D's point is carried.** Through the CLI, as Claude Code runs the hook (`S/scripts/dcli.sh`, `S/out/dcli.txt`),
`git commit -m x` under a lock with no `rootFromTop` gives the same on both runtimes:

```
dcli-head | a lock of pid and cli only (round 3's probe): exit 0, denied: ...then delete the lock; 'mstack gate' says the same
dcli-D2   | a lock of pid and cli only (round 3's probe): exit 0, ALLOWED
dcli-D3   | a lock a run wrote, rootFromTop removed: exit 0, ALLOWED
dcli-head | a lock a run wrote, rootFromTop removed: exit 0, denied: ...
```

D2 fails open as round 3's D did. So does my D3 below, the plainer form of D on the new code, and `:268` kills
it too. Q's point is carried as well: the restore's refusal now prints `inLockStore`'s line, so Q2 is Q plus every
other printer.

## Neighbours: do the tests pin the behaviour (point 2)

For each new test I built one mutant of my own, a different break of what the test's name says:

| Mine | Break | Test | bun | node |
|---|---|---|---|---|
| i2 | the `error` handler on stderr only | `cli:341` | RED | RED |
| k2 | `refused()` without its `await tick()`, the check kept | `signals:297` | RED | RED |
| m2 | the reset names the new HEAD (`git reset ${now}`) | `changed:254` | RED | RED |
| b2 | the reverted run's tail at the runner's default 40, header still "20" | `run:455` | RED | RED |
| **n2** | **`DEFAULT_TIMEOUT_S = 60`** | **`cli:361`** | **GREEN** | **GREEN** |
| N1c | the watch uses `process.ppid`, not the argv pid (r2 NB1) | `run-async:311` | RED | RED |
| N1d | the start check sets `orphaned` and sends no kill | `run-async:311` | RED | RED |
| A4b | 127 given 126's words | `run:197` | RED | RED |
| X2b | R15's line offers the gone writer's command | `exits:1063` | RED | RED |
| X3b | the hook from `.git` offers the gone writer's command | `exits:1086` | RED | RED |
| V1b | the other top compared with `startsWith(top)` | `exits:984` | RED | RED |
| V2b | a silent git answered from the spelling (`?? { top, rel: inside }`) | `exits:984` | RED | RED |
| D3 | `validateLock` stops requiring `rootFromTop` | `exits:268` | RED | RED |

My first D3 did not parse, and my first X3b threw a `ReferenceError`. The rows above are the corrected versions,
whose logs hold no parse or reference error (`S/out/rerun3.txt`). Each test asserts what its requirement states: the
printed line, the exit code, the tree. None relies on an incidental string. The exception is `cli:361`, which is
blocking 1. (The baseline's tail at 40, my b3, is GREEN, but it is not what `run:455` names.)

## Flakiness (point 3)

**Loops** (`S/scripts/loop.sh`, `load.sh`, `variants.sh`; `S/out/loops/*.txt`). Each of the six files ran in
copies of the head: six parallel copies of the loop per runtime, five runs each, twelve loops at once, load 19 to
31 on 18 cores. That gives 30 runs per file per runtime:

```
bun  mutation-run 0/30 | changed 0/30 | signals 0/30 | cli 0/30 | exits 2/30 | run-async 0/30
node mutation-run 0/30 | changed 0/30 | signals 0/30 | cli 0/30 | exits 0/30 | run-async 0/30
  tests/mutation-exits.test.ts run 2 FAILED (22 pass 1 skip 1 fail): (fail) A2 the hook and R1 name the restore only
  for a lock validateLock accepts, ... [5065.24ms]   (and [5018.77ms] in a second copy)
  ^ this test timed out after 5000ms ...
```

Those two failures are blocking 2. The same loops then ran with dash as `sh` (`sh` on PATH linked to `/bin/dash`,
and the runner's `"/bin/sh"` and the wrappers' `#!/bin/sh` replaced by `/bin/dash`) and from a copy under
`sp ace <label>/`, three runs per file, runtime and variant, while the main load ran. That is 72 runs, 0 failed.
In all, 432 file runs and 2 failures. Afterwards `pgrep -fl 'mutation-holder|run-helper|mutation-run-holder'`
showed nothing, and no `sleep 3[47].`/`sleep 10` was left.

**A3 (`run-async:311`): the implementer is right, and 150 ms is enough.** I instrumented a copy of the helper to
measure the window, the ms from `spawn()` returning to the start check's kill (`S/scripts/margin.sh`,
`margin.mjs`, `a3bg.sh`; `S/out/margin-*.txt`, `S/out/loops/a3bg.txt`):

```
idle (load 8)               bun median 0.115 max 0.215 ms (50) | node median 0.170 max 0.341 (50)
my load (19-27)             bun median 0.152 p99 1.09 max 2.41 (500) | node median 0.220 p99 0.95 max 1.22 (500)
taskpolicy -b at load 27    bun median 0.427 p99 4.62 max 7.76 (300) | node median 0.718 p99 11.3 max 24.4 (300)
file written 0, result written 0 in all 1700
```

The A3 test alone ran 100 times per runtime under the load and 50 more per runtime at background QoS: 300 runs,
0 failures. The worst window I could make was 24 ms, about 6 times inside 150 ms. The report's "two orders of
magnitude" holds at ordinary load. There is no window-free form of the file assertion that still kills N1b, because
the 250 ms poll bounds the window from above. Against the head's helper and N1b's, 20 runs each per runtime:

```
N1b  | the test's: sleep 0.15, then write: file written 20/20, result written 20/20
N1b  | a longer sleep: sleep 0.4, then write: file written 0/20, result written 0/20   <- the mutant escapes
N1b  | exits at once (the no-result half alone): file written 0/20, result written 20/20
head | each of the three: file 0/20, result 0/20
```

A longer sleep therefore loses the kill. The no-result assertion is already window-free on the head (`orphaned`
is set before the loop turns once), and it kills N1b by itself whenever the command ends before the poll. No
change is needed.

**n (`cli:361`, 10 s).** A behavioural kill of a 9 s default needs a command that outlives 9 s, so 10 s is the
least for that mutant. But it pins only "above 10 s" (blocking 1). Reading the bound directly would pin 900 with no
wait: in the obligation's `-c` shell, `$PPID` is the helper, whose argv holds the timeout in ms.

The other new tests wait on no clock. `signals:297` and `cli:341` wait for a process's exit. The rest run in
process.

## Placement (point 4)

`S/scripts/placement.sh` lists every `test(`/`userTest(` line at base and head. Each new test comes after the
base's last line: `run:455`, `changed:254`, `signals:297`, `cli:341`/`:361`, `exits:1063`/`:1086` and
`run-async:311`. One-line changes stay in place: two import lines, `run:209` (A4), `exits:910`, and the four-line
comment at `:924-927`. **Moved: one test, L14e `exits:1021 -> 1036`**, which the 15 lines of A6's assertions
inside the L14 test cause. The criterion places those assertions there, so this is not a finding.
`review_mutation-exits-followups_r2.md` cites `:1021`.

## The three text fixes (point 5)

**The refusal (`src/mutation-lock.ts:175`).** I ran every printer from a copy of the head. Each case is a real run
killed with `kill -9` (`S/scripts/msg.sh`, `msg.mjs`; `S/out/msg-{bun,node}.txt`, which are identical apart from
pids). The cases are the edit (rootFromTop pkg/a -> pkg/b, from A and from B) and the moves L15a and L15d. The
restore, R1, the gate and the hook print the new words in every case. For L15a, nobody edited the lock:

```
mutation: refused: the lock <FX>/L15a/outer/.git/mstack-mutation.lock names this store, at pkg/a, and its root
<FX>/L15a/outer/w/pkg/a is the store at w/pkg/a in this worktree, so either the lock was edited or the checkout was
moved and its old root is now that store, and whose the lock is cannot be told; nothing was written, and the lock stays
mutation: by hand, for a person at a terminal (...): 'git stash push --include-untracked' saves every change and discards nothing; then delete the lock
hook: ... and whose the lock is cannot be told, so the way out is by hand, for a person at a terminal (...)
```

The sentence is true in both cases: an edit, or a move whose old root is now another store, which is the store it
names. It is one sentence, and the by-hand way follows it in every printer. Nothing still prints or pins the old
words: `rg -F 'whose it is cannot be told'` and `rg -F 'so the lock was edited'` outside `.mstack/progress` and
`decisions.tsv` both exit 1, and `exits:910` pins the new sentence. `:851`'s `doesNotMatch(/the lock was edited/)`
still means something, because that case prints another refusal.

**design.md's not-caught item.** I checked it against the code through the CLI (`S/scripts/ceil.sh`,
`S/out/ceil-*.txt`). It holds for the review's layout, stores x/a and y/b with `GIT_CEILING_DIRECTORIES=<top>/x`:
the restore from B gives exit 0 and rescues A's file. It is broader than that case, though. See non-blocking 1.

**The comment over `movedUp` (`exits:924-927`)** states `rootDisagrees`' rule as the code has it. A root under the
top disagrees only when it holds a `.mstack` and git, run from it alone, places it in this worktree elsewhere than
`rootFromTop` (`src/mutation-lock.ts:168-175`).

## The decision row (point 6)

Row 2026-11-20T08:04:58.351Z: "item 102 A3: the helper's check at start can be tested and now is
(tests/run-async.test.ts, the last test), which answers row 2026-11-19T16:00:22Z: given a pid that has exited and
the command 'sleep 0.15; : > <file>', the file is never written and the helper writes no result". Its "if wrong"
says "the no-result assertion cannot fail at a correct head". That is what is now true. Row 296's "only a bound
tighter than the poll could tell the two apart" is answered: the test asks whether the command acts, not how soon
it goes, and the measurements above bear that out.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A1 | `run:455`, `changed:254`, `signals:297`, `cli:341`, `cli:361` | i k m a b n RED both runtimes; neighbours i2 k2 m2 b2 RED, n2 GREEN (blocking 1) |
| A2 | `exits:268`, `:183`, `:688` (existing) | D, Q gone; D2 Q2 C (and D3) RED; `:268` flaky on bun under load (blocking 2) |
| A3 | `run-async:311` | N1b N1c N1d RED; 300 runs alone, 0 failed; 1700 windows, max 24 ms |
| A4 | `run:197` (`:209` asserts the phrase) | A4, A4b RED |
| A5 | `exits:1063`, `exits:1086` | X2 X3 X2b X3b RED |
| A6 | `exits:984` (`:1014`, `:1020`), `exits:910`, design.md, comment | V1 V2 V1b V2b RED; message read in every printer |

## Acceptance, quoted

**"a test fails for each of round 2's mutants i, k, m, a, b and n, or the report says why one is equivalent"** -
met; the table above, both runtimes. n's test passes for a 60 s default as well (blocking 1).

**"a test fails for each of round 3's three mutants of the B3 path; first D, under which the hook allows git commit
under a lock with no rootFromTop (join(top, undefined) throws and the hook fails open)"** - met in substance. D's and
Q's texts are gone (0 occurrences). D2, Q2 and C are killed, and through the CLI D2 fails open as D did. The
killing test `exits:268` fails on a correct head under load on bun (blocking 2).

**"the helper's check at start is pinned: given a pid that is already dead and the command sleep 0.15 then write a
file, the file is never written; the decision row that says it cannot be tested is answered"** - met,
`tests/run-async.test.ts:311`, and row 08:04:58.351Z.

**"the R12 blocked test matches the whole phrase 'exit 127 (the command was not found)', not a bare 127 that a
short sha could carry (item 104 review, non-blocking 1)"** - met, `tests/mutation-run.test.ts:209`.

**"a test covers the two lines that name a gone CLI and have none: R15's line (src/mutation-run.ts:88) and the
hook's line from inside .git (src/hooks.ts:468) (item 101 review round 2, non-blocking 4); and a test fails for that
review's mutants X2 and X3"** - met, `tests/mutation-exits.test.ts:1063` (whole line, then its command run, which
restores) and `:1086`.

**"from the item 105 review round 2: a test fails for its mutants V1 (there.top !== top dropped) and V2 (a silent
git refuses, which turns away the legitimate restore N10b with the suite green): two assertions in the root-check
test of tests/mutation-exits.test.ts; the message at src/mutation-lock.ts:175 does not say 'the lock was edited' for
a moved checkout nobody edited; design.md's not-caught list gains the edit under GIT_CEILING_DIRECTORIES between the
root and the top; the test comment near tests/mutation-exits.test.ts:924 states the rule in the code"** - met. The
assertions are at `:1014` and `:1020`. The message now gives the edit as one of two possibilities, not as a fact.
The design item exists (see non-blocking 1), and the comment matches the code.

## Verification I ran

In a copy of the head (`S/scripts/suites.sh`, `S/out/suites.txt`; HOME and TMPDIR empty, node_modules linked):

```
bun test ./tests: exit 0 in 403 s:  1150 pass 3 skip 0 fail Ran 1153 tests across 59 files.
node --test: exit 0 in 75 s: tests 1153, pass 1152, fail 0, cancelled 0, skipped 1
typecheck (bunx --bun tsc --noEmit): exit 0, no output
./bin/mstack lint-plugin .: PASSED - 0 failures, 0 warnings
node scripts/check-doc-links.mjs README.md docs/wiki/*.md: 112 relative links checked, 0 broken
```

In the checkout: `./bin/mstack version` gives `mstack 0.2.1 at /Users/romerma/Code/mstack`, and `./bin/mstack gate`
passed, 0 failures and 0 warnings, before this report was written. `ledger check mutation-test-pins` gave `no
verdict at 69e6c045`. I did not run `gate --full` in the checkout because it writes receipts; the suites above are
its obligations. Lock test at the end: `test -e "$L" || test -L "$L"` is false (no lock, no link).

## Changes required

**Blocking**

1. `tests/mutation-cli.test.ts:361`. The test's name says "the default bound is 900 s", and it passes with the
   default at 60 s:
   `bash S/scripts/mut.sh n2 bun tests/mutation-cli.test.ts "with no --timeout a command may run 10 s"` gives
   `n2 bun GREEN exit=0 pass=1 fail=0`, and node gives the same. No other test pins 900: besides this test's name and comment,
   `rg -n 900 tests/` finds only timestamps and a line number. Row 08:04:58.433Z knows this: "if wrong: a default between 10 and 900 s is
   not seen". Smallest change: rename the test, and the R-table row, to what it holds ("...may run 10 s: the
   default bound is above 10 s"). The stronger change pins 900: have the obligation read its helper's argv
   (`ps -ww -o args= -p "$PPID"` from the `-c` shell) and assert `900000`, which also drops the 10 s sleep.
2. `tests/mutation-exits.test.ts:268` (A2's evidence for D2, C and D3; written in item 101, `67fbd41`, and in a
   file this item changes) fails on a correct head under load on bun: 2 of 30, in `S/out/loops/L-bun-2.txt` and
   `L-bun-5.txt`. It has no timeout option, so bun's default of 5000 ms applies, and it takes 1.67 s idle
   (`S/out/durations.txt`). At the bound bun kills the hook's git ("killed 1 dangling process"), `lockReason`
   finds no git dir, and the hook allows. `:307` then fails on `''`. Reproduced at once
   (`S/scripts/a2timeout.sh`): `head, bun --timeout 1000: exit 1: killed 1 dangling process;timed out after 1000ms`
   and `spawn, bun --timeout 1000: exit 0: 1 pass`. Smallest change, on the same line with no shift:
   `test("A2 the hook and R1 name the restore only ...", SPAWN_TEST, () => {`.

**Non-blocking**

1. `.mstack/specs/mutation-check/design.md:216-220`. The new item names a ceiling "between the lock's `root` and
   the top level". When that ceiling is also above the store the restore runs in (stores pkg/a and pkg/b, ceiling
   `<top>/pkg`), the restore never reaches the root check. It prints `mutation: nothing to restore: the store is
   not in a git repository`, exit 0, the lock stays and A is not restored (`S/out/ceil-bun.txt`). Smallest
   change: add "and not above the store the restore runs in".
2. `tests/mutation-exits.test.ts:720` has blocking 2's exposure: no timeout option, 1.37 s idle on bun. It passed
   30 of 30 here. Smallest change: `SPAWN_TEST` on it too.
