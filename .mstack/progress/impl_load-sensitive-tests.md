# Item 67: load-sensitive tests (implementer report)

Branch `fix/load-sensitive-tests`, base `5c05f6c`, item opened at `e37cbb7`, final tree `fd1e3fd`.
Machine: macOS arm64, 18 cores, bun 1.3.11, node 26.13.1, and node 22.6.0 from nvm for the CI
comparison. Outside load (other sessions, Docker, VS Code) was a 1-minute load average of 8.6 to
16 when my runs started; the `uptime` of every round is in its `rounds.log`. Scratch directory, for
every script and log named below:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl67/`.

## What changed

Four tests changed, no source file. The load harness from the item 21 diagnosis is committed at
`scripts/load/`, not `sandbox/load/` (Deviations). The Stop budget test (`tests/costs.test.ts:698`)
compares the test process's CPU time instead of wall time, the best of five alternating runs per
side, under 20 ms. It adds an in-process bound on the whole Stop path except its gate, under 20 ms,
which catches a read of the transcript outside `onStop`; the old test missed that (mutants C1 and
C3). Its comment says which assertion carries which part of the claim. `tests/run.test.ts:54` gives
`runCommand` a `TMPDIR` of its own instead of listing the shared one, and checks the directory is
really made there. `tests/gate.test.ts:685` and `tests/launcher.test.ts:59` get explicit timeouts
of 35 s and 10 s, sized from durations measured under load. In every case the runs put the time or
the leak in the test, not in the code under test. One loosening is shown by mutant C6: a wait that
uses no CPU, on the gate's branch only, no longer fails the Stop test.

## Files

- `scripts/load/run.mjs`, `scripts/load/rounds.sh`, `scripts/load/table.mjs`, `scripts/load/README.md` (new)
- `tests/costs.test.ts`, `tests/run.test.ts`, `tests/gate.test.ts`, `tests/launcher.test.ts`
- `CHANGELOG.md` (one entry), `.mstack/decisions.tsv` (two rows), `.mstack/progress/current.md`, this report

Commits, in order: `f7f3bb9` harness; `af63607` costs, best of five in wall time; `69f5c3f` run;
`d58aa94` gate; `7ac50c1` launcher; `ded110d` changelog; `e63244e` executable bit on `rounds.sh`;
`15fb614` the harness stops its suites when stopped; `b782eba` costs in CPU time; `fd1e3fd`
changelog follows it.

## Per test

### `tests/costs.test.ts:698`: the Stop hook on a 50 MB transcript (assertion was `:743`)

**Cause, shown by runs.** The `stop()` calls the test times are in-process, but `stop()` runs the
gate, which spawns git. Under load one Stop call took up to 2.3 s, against about 75 ms on a quiet
machine, and the worst of three on each side keeps the run the load hit hardest. Per-run timings
from tagged debug lines (`DBG67`, removed), the one test beside background suites
(`logs/before1_1.log`):

```
costsdbg-node DBG67 order=stop-first stop=[791.2,566.2,628.2] bare=[636.7,610.6,637.4] node=v26.13.1
costs-node   AssertionError [ERR_ASSERTION]: Stop with a 50 MB transcript took 1076.8165ms against 785.3990000000003ms without one
```

The worst-of-three gap there is +154 ms; the best runs are 566 against 611 ms. The
transcript-dependent part, `onStop`, took 0.13 to 0.28 ms in every loaded run here.

The best of five in wall time, the decided first remedy (`af63607`), was not enough. It failed
both node suites of the first final round at 4 bun + 2 node:

```
budget: ... stop(no gate)=0.29ms stop(hook)=448.5ms of [623.1,826.5,448.5,706.5,609.6] stop(no transcript)=378.6ms of [444.5,378.6,541.3,607.6,530.1]
  AssertionError [ERR_ASSERTION]: Stop with a 50 MB transcript took 448.49333399999887ms against 378.630208999999ms without one, the best of five runs each
budget: ... stop(no gate)=0.17ms stop(hook)=514.1ms of [698.7,594.5,514.1,588.3,540.7] stop(no transcript)=398.7ms of [702.3,398.7,616.6,575.2,537.1]
  AssertionError [ERR_ASSERTION]: Stop with a 50 MB transcript took 514.093667000001ms against 398.6834579999995ms without one, the best of five runs each
```

In a loop of the one test (40 iterations, each node and bun, beside 4 bun + 2 node background
suites, load average 18.9 to 27.8, `cpu_loaded.out`), the same runs timed in both wall and CPU
time showed:

| runtime | runs | wall of one Stop | wall best of five red (>= 50 ms) | CPU of one Stop | CPU difference of the best runs |
|---|---|---|---|---|---|
| bun | 34 | 71.2 to 411.3 ms | 1 | up to 5.9 ms | -0.4 to 1.0 ms |
| node | 34 | 76.0 to 1033.0 ms | 1 | up to 12.5 ms | -0.4 to 1.3 ms |

The hook's own CPU per Stop is 3 to 13 ms; the rest of its wall time is waiting for git. A read and
parse of the transcript in this process is CPU time: 28 to 44 ms a read in mutants C1 to C4 below,
55 to 76 ms for C5's two.

**The CI gap (the coordinator's hypothesis), on node 22.6.** Each of the three runs per side,
timed separately, in three orders, here with no load of mine:

```
$ DBG67_ORDER=<order> ~/.nvm/versions/node/v22.6.0/bin/node --disable-warning=ExperimentalWarning --experimental-strip-types --test --test-name-pattern "hook paths stay within budget on a 50 MB" tests/costs.test.ts
DBG67 order=stop-first stop=[77.6,76.0,78.0] bare=[75.2,76.1,76.2] node=v22.6.0
DBG67 order=bare-first stop=[73.4,73.0,75.1] bare=[80.4,76.8,75.0] node=v22.6.0
DBG67 order=interleaved stop=[78.1,76.1,75.6] bare=[75.8,75.9,74.2] node=v22.6.0
DBG67 order=stop-first stop=[76.7,75.0,75.3] bare=[72.4,74.9,74.3] node=v22.6.0
DBG67 order=bare-first stop=[76.7,74.7,75.1] bare=[77.2,76.4,72.4] node=v22.6.0
DBG67 order=interleaved stop=[78.9,74.4,73.7] bare=[74.8,75.1,71.7] node=v22.6.0
```

The whole file instead of the one test gave the same, 73.0 to 77.0 ms on both sides in four runs.
On this machine node 22.6 shows neither a first-run cost nor extra work with a transcript. The CI
budget lines, from `gh run view <id> --log` for the last five runs on `main` (`onStop` /
`stop(hook)` / `stop(no transcript)`, ms, worst of three each):

| run | bun (`test`) | node current (`test`) | node 22.6 (`oldest-node`) |
|---|---|---|---|
| 44228436422 (`5c05f6c`, red) | 0.08 / 6.8 / 7.0 | 0.15 / 37.1 / 21.9 | 0.15 / 91.4 / 37.5 |
| 44198760558 | 0.15 / 11.1 / 11.0 | 0.17 / 38.6 / 45.9 | 0.15 / 53.6 / 54.8 |
| 44144952169 | 0.15 / 10.6 / 8.5 | 0.17 / 47.4 / 32.1 | 0.15 / 92.3 / 74.2 |
| 44116978068 | 0.12 / 11.3 / 10.4 | 0.17 / 82.2 / 45.4 | 0.15 / 84.5 / 56.7 |
| 44093097918 | 0.15 / 10.6 / 8.4 | 0.18 / 48.3 / 39.2 | 0.14 / 86.4 / 60.3 |

On node `stop(hook)` is above `stop(no transcript)` in 8 of 10 lines (-7.3 to +53.9 ms); on bun the
difference is -0.2 to +2.1 ms; `onStop` is 0.08 to 0.18 ms everywhere. Which of the order, a
first-run cost or the node suite's own concurrency makes the CI gap is **not shown**: it does not
reproduce here, and CI printed only the worst run per side. The new test prints every run in both
wall and CPU time, so the next `oldest-node` log shows where the gap sits. If the hook did extra
work with a transcript in this process on every Stop, the CPU comparison would fail on CI, as C5
fails it here.

**Change** (`af63607`, then `b782eba`):
- `onStopMs` is unchanged.
- New `stopPathMs`: the worst of three in-process runs of `stop({ ...input, stop_hook_active: true })`, the whole hook except the gate, under 20 ms.
- The whole-hook comparison, gate included, is in this process's CPU time (`process.cpuUsage`), the best of five alternating runs per side, under 20 ms.
- The budget line prints every run's CPU and wall time.

The comment above them names what each one covers and that a wait using no CPU is not counted.

### `tests/run.test.ts:54`

**Cause, shown by runs.** The old test listed `mstack-run-*` in the system temp directory before
and after one `runCommand` and asserted the two lists equal. The red, from the before-round:

```
63 |   assert.deepEqual(after, before, "a temp directory was left behind");
AssertionError: a temp directory was left behind
```

It never failed alone (the `none` row of the mutant table, both runtimes), and its rate rose with the
number of suites sharing that directory: 1 of 6 runs at 4 bun + 2 node, 6 of 14 at 10 bun + 4 node.
The new test changes one thing, the directory listed, and its rate under the same harness is in
"Final rounds".

**Change** (`69f5c3f`): the test makes a directory of its own and points `TMPDIR` at it for the
call. It asserts that a listing taken by the command itself shows `mstack-run-*` there, so the test
cannot pass by watching a directory nothing writes to (mutant R2), and then that the directory is
empty. The listing's path is written into the command, not read from `$TMPDIR`, because bun does
not pass a change to `process.env` on to a child:

```
$ bun envprobe.mjs; node envprobe.mjs   # sets process.env.TMPDIR = "/private/tmp/x67", then spawnSync("/bin/sh", ["-c", "echo child TMPDIR=$TMPDIR"])
bun child TMPDIR=/var/folders/r1/cn30880j4jl1k4dg_fpj62mw0000gn/T/
node child TMPDIR=/private/tmp/x67
```

`os.tmpdir()` itself follows the change on bun, node 26 and node 22.6 (`tmpdir_probe.mjs`).

### `tests/gate.test.ts:685`: a citation is the exact report filename (was `:681`)

**Cause.** The red is bun's own 5 s timeout. In the item 21 diagnosis logs, at the same code (`git
log 2a5a236..e37cbb7 -- src tests` prints nothing), it failed in 43 full bun suites at 5.0 to 6.9 s,
and alone beside five suites 4 times at 5.0 to 20.9 s (`impl59r2/logs/shrink_beside.log`):

```
01:56:43 tests/gate.test.ts (fail) a citation is the exact report filename as a whole token, however punctuated [20899.67ms]   ^ this test timed out after 5000ms, before its done callback was called.
```

Where the time goes, from tagged lines inside the test (ten sandboxes, ten gate runs):

| condition | total | `sandbox()` x10 | gate x10 |
|---|---|---|---|
| alone, quiet | 1579 to 1582 ms | 785 to 789 ms | 635 to 640 ms |
| in a full bun suite, 4 bun + 2 node | 1718 to 1790 ms | 843 to 893 ms | 685 to 715 ms |
| in a full bun suite, 10 bun + 4 node | 3407 to 3549 ms | 1679 to 1777 ms | 1388 to 1433 ms |

About half is the fixture (a git repository per sandbox) and about 40 % the gate's runs, all child
processes the test starts, and both scale with load. The time is the test's: a gate run is 64 ms
quiet. Today neither load took it to 5 s (0 of 4 and 0 of 10 bun suites), so the red before the
change is the diagnosis's.

**Change** (`d58aa94`): `{ timeout: 35_000 }`, about 1.5 times the slowest measured run (20.9 s)
rounded up to the next 5 s, with a comment giving the figures.

### `tests/launcher.test.ts:59`: hostile stdin (was `:55`)

**Cause.** Also bun's timeout: 29 of 40 bun suites in the diagnosis, at 5.0 to 6.6 s:

```
(fail) hostile stdin never produces a non-zero exit or a word on stderr [6382.92ms]
```

The test starts the real launcher eight times (`bin/mstack statusline`, one input each). From
tagged lines: one `bin/mstack version` start, then each status line start:

| condition | total | `version` | each of the eight `statusline` starts |
|---|---|---|---|
| alone, quiet | 530 ms | 34 ms | 59 to 63 ms |
| in a full bun suite, 4 bun + 2 node | 1521 to 1723 ms | 57 to 74 ms | 133 to 297 ms |
| in a full bun suite, 10 bun + 4 node | 2602 to 3920 ms | 67 to 274 ms | 156 to 782 ms |

The time is eight child processes, each a shell, a runtime and the status line's own work, 60 ms a
start when quiet. Today 0 of 4 and 0 of 10 bun suites took it to 5 s.

**Change** (`7ac50c1`): `{ timeout: 10_000 }`, about 1.5 times the slowest measured run (6.6 s)
rounded up.

### `tests/verdict-reader.test.ts:87` "agree on every sequence" (not changed)

The time is the test's, not the reader's. Tagged lines, 17 cases:

```
quiet, load 9.4:   DBG67 verdict-seq total=2912ms cases=17 sandbox=1324ms check=2ms gate=1095ms   (bun; node: total=2913 to 2956ms, the same split)
beside 10+4 load:  DBG67 verdict-seq total=2790ms cases=17 sandbox=1277ms check=2ms gate=1037ms
```

46 % is the fixture (17 git sandboxes) and 37 % the 17 gate runs. The reader itself (`check`,
which reads through `readVerdict`) is 2 to 3 ms in all. The 60 s timeout it was given is about 20
times its quiet run.

### `tests/run.test.ts:154` and `:239`

Not changed. 0 failures in this item's runs: 6 suites at 4+2 and 14 at 10+4 before, and the final
rounds below. The rate was not raised, so no cause is shown, and per the design they are left.

## Mutant table

Each mutant is a perl edit to `src/`, reverted with `git checkout` after its runs. "Old" is the test
at `e37cbb7`, "new" the test at `fd1e3fd`. `costs` has 3 runs a runtime (C6 has 1), the others 1.
Scripts: `mutants_costs.sh`, `mutant_c5.sh`, `mutant_c6.sh`, `mutants_run.sh`, `mutants_timeout.sh`.

| test | mutant | old | new | red line (new) |
|---|---|---|---|---|
| costs:698 | none | green 6/6 | green 6/6 | - |
| costs:698 | C1 `stop()` reads and parses the transcript on every call | green 6/6 | RED 6/6 | `the Stop hook without its gate took 28.295166999999992ms` (bun), `35.682582999999994ms` (node) |
| costs:698 | C2 `onStop` reads and parses it on every call | RED 6/6 | RED 6/6 | `the Stop mark check took 30.305000000000007ms` (bun), `37.953541ms` (node) |
| costs:698 | C3 `stop()` flushes it once (`onSessionEnd`) | green 6/6 | RED 6/6 | `the Stop hook without its gate took 35.051875000000024ms` (bun), `41.74029199999998ms` (node) |
| costs:698 | C4 `onStop` flushes it once | RED 6/6 | RED 6/6 | `the Stop mark check took 34.593500000000006ms` (bun), `43.97812499999998ms` (node) |
| costs:698 | C5 the gate's branch only reads and parses it twice | RED 6/6 | RED 6/6 | `Stop with a 50 MB transcript used 55.22ms of CPU against 2.877ms without one, the best of five runs each` (bun), `used 75.605ms of CPU against 6.04ms` (node) |
| costs:698 | C6 the gate's branch only waits 100 ms, no CPU (`Atomics.wait`) | RED 2/2 | **green 2/2** | none: the one loosening. Old: `took 186.118417ms against 76.37454200000002ms without one` |
| run:54 | none | green 2/2 | green 2/2 | - |
| run:54 | R1 no `rmSync` of the temp directory | RED 2/2 | RED 2/2 | `a temp directory was left behind` |
| run:54 | R2 the temp directory made in `/private/tmp`, not `tmpdir()` | green 2/2 | RED 2/2 | `the command's temp directory is not in the TMPDIR it was given` |
| gate:685 | G1 no leading boundary on the citation match | RED 2/2 | RED 2/2 | `allowed: re-impl_storage-layer.md: expected a pass, got ["items closed on a verdict whose evidence cites the i...` |
| launcher:59 | L1 the status line writes to stderr on input it cannot parse | RED 2/2 | RED 2/2 | `input "" wrote bad input` |

What the new costs test does not catch: C6 above (a sleep, a lock, or a child process that reads the
transcript, on the gate's branch only, while the old test caught a wait of 50 ms or more there when
the machine was quiet), and a raw read of the 50 MB without decoding (3 to 7 ms here,
`readcost.mjs`), which is under every bound, as it was under the old one.

## Before rounds

With the committed harness, from a worktree at `e37cbb7` plus the tagged lines, which only print:

```
$ scripts/load/rounds.sh 1 <scratch>/round_before
runs: bun 4, node 2; red: bun 1, node 1; killed by the watchdog: bun 0, node 0
| hook paths stay within budget on a 50 MB transcript | 0 | 1 |
| tail keeps the last lines of stdout and stderr, and the temp file is removed | 1 | 0 |

$ BUN=10 NODE=4 scripts/load/rounds.sh 1 <scratch>/round_heavy_before
runs: bun 10, node 4; red: bun 5, node 2; killed by the watchdog: bun 0, node 0
| tail keeps the last lines of stdout and stderr, and the temp file is removed | 5 | 1 |
| hook paths stay within budget on a 50 MB transcript | 0 | 2 |
```

Suites took 148 to 150 s (bun) and 57 s (node) at 4+2, and 238 to 243 s and 121 to 122 s at 10+4.
The diagnosis's rounds of 4+2 took 405 to 428 s and 210 to 227 s with the same code, so its load was
heavier than either of mine. What made that night slower is not shown; `pmset -g log` shows AC power
through it.

## Final rounds

At `fd1e3fd`, with the committed harness, 03:55:03 to 04:19:47 UTC:

```
$ scripts/load/rounds.sh 10 <scratch>/rounds_final
runs: bun 40, node 20; red: bun 0, node 0; killed by the watchdog: bun 0, node 0

| failing test | bun (of 40) | node (of 20) |
|---|---|---|
| (none) | 0 | 0 |
```

0 failures for every test in scope and nothing new: no test failed in any of the 60 runs. Suites
took 145 to 153 s (bun) and 53 to 56 s (node); the 1-minute load average was 9.0 to 14.5 at the
start of a run and 12.4 to 23.0 at its end. From the 60 budget lines: `onStop` at most 0.73 ms,
`stop(no gate)` at most 0.50 ms (both bounds 20 ms), the CPU difference of the best runs -0.6 to
1.0 ms (bound 20 ms), while one wall run of the hook reached 911.7 ms.

This is the acceptance figure, 20 suites per runtime in rounds of 4 bun + 2 node, but not the
diagnosis's load, which was heavier (its suites took 2.7 times as long). One heavier round, at the
load where the old tests failed 5 of 10 bun and 2 of 4 node suites (Before rounds), 04:21:43 to
04:25:45 UTC:

```
$ BUN=10 NODE=4 scripts/load/rounds.sh 1 <scratch>/round_heavy_after
runs: bun 10, node 4; red: bun 0, node 0; killed by the watchdog: bun 0, node 0

| failing test | bun (of 10) | node (of 4) |
|---|---|---|
| (none) | 0 | 0 |
```

Suites took 238 to 242 s (bun) and 121 to 122 s (node), the same as the heavy before-round. Budget
lines: `onStop` at most 0.29 ms, `stop(no gate)` at most 0.46 ms, CPU difference -0.1 to 0.5 ms,
one wall run up to 2039.7 ms. This round did not reach 5 s for `gate:685` or `launcher:59` before
the change either, so it says nothing about their timeouts.

## Item 21

Item 21's run failed on 2026-08-21, and the failing name was never captured. When each test first
appears (author dates; the history was rewritten once, which keeps them):

```
$ for n in <name>...; do git log --reverse --format='%h %ad' --date=short -S "$n" -- tests | head -1; done
d8e694a 2026-11-08 | hook paths stay within budget on a 50 MB transcript
7f5e67a 2026-11-08 | tail keeps the last lines of stdout and stderr
0f6d972 2026-08-22 | a citation is the exact report filename as a whole token
32f0265 2026-08-19 | hostile stdin never produces a non-zero exit
b9242e9 2026-11-08 | a SIGINT while the command is forking leaves no survivor
141eb01 2026-11-08 | a timeout kills children that are being forked at that moment
d5956c9 2026-11-17 | agree on every sequence
```

`tests/costs.test.ts` and `tests/run.test.ts` first appear on 2026-11-08 and
`tests/verdict-reader.test.ts` on 2026-11-17, so `costs:698`, `run:54`, `:154`, `:239` and the
verdict-reader test cannot be the August failure; nor can `gate:681`, whose test is from the day
after. Only `launcher:55` existed then, in the same form (`git show 32f0265:tests/launcher.test.ts`:
the same eight inputs at line 55) and under the same 5 s default, so it is the one candidate left
among these tests. Nothing identifies it as the failure.

Recommendation for item 21 (not changed here, as the brief says):
- Record in its description that the load-sensitive tests of item 67 are fixed, and that `launcher:55` is the only one of them that existed in August, now with a measured timeout.
- Close its first criterion with the bound from the final rounds below.
- Keep it open on the two hang criteria. Those rounds did not reproduce either hang (0 watchdog kills), the same as the diagnosis's 79 runs.

## What is not shown

- The cause of the CI gap on `oldest-node`. The next CI run's budget line is the evidence.
- A fresh red for `gate:685` and `launcher:59` on today's machine; the red before the change is the
  diagnosis's logs, same code.
- Any cause for `run:154` and `run:239`.
- Why the diagnosis's suites ran 2.7 times slower than today's on the same machine and code.

## Deviations

- The harness is at `scripts/load/`, not `sandbox/load/`: `sandbox/` is in `.gitignore` and is a
  nested git repository, so nothing under it can be committed (decision row, 2026-11-18).
- Costs: the decided remedy, the best of several alternating runs in wall time, failed under the
  acceptance load, so the comparison moved to CPU time (second decision row), at the cost shown by
  C6. The in-process bound `stopPathMs` is added because the decided comparison alone, like the old
  one, let C1 and C3 through on this machine.
- The brief called the timed `stop()` runs "subprocess runs": they are in-process calls whose gate
  spawns git.
- My first targeted loop ran its target with `spawnSync`, which blocked the event loop that restarts
  the background suites, so after its first iterations it ran without my load. Its rates are not
  used; the rates here come from the committed harness and from the fixed loop (`cpu_loaded.out`).
- `rounds.sh` went in without its executable bit, so the first start of the final rounds ran nothing
  (`e63244e`), and stopping a round left its suites running until `15fb614`:

```
$ bash sigtest.sh
1: rounds.sh=85556 run.mjs=85566 85568 suite groups=85571 85577 processes in them=27
1: after TERM to rounds.sh: run.mjs alive=0 processes in suite groups=0
2: run.mjs=99277 suite group=99283 processes=2
2: after KILL to run.mjs: processes in its suite group=2
2: after cleanup: processes in that group=0
```

## Commands

At `fd1e3fd`, after the final rounds, load average 11.7 at the start:

```
$ ./bin/mstack lint-plugin .
...
PASSED - 0 failures, 0 warnings

$ npm run typecheck
> mstack@0.2.1 typecheck
> bunx --bun tsc --noEmit
(exit 0)

$ npm test
 631 pass
 0 fail
Ran 631 tests across 28 files. [115.04s]
ℹ tests 631
ℹ pass 631
ℹ fail 0
ℹ duration_ms 31511.579375
(exit 0)
```

```
$ ./bin/mstack gate        # before committing this report, the ledger row and current.md
...
[ok]    load-sensitive-tests is in_progress; a verification run is due at verifying
...
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[ok]    on branch fix/load-sensitive-tests
[warn]  3 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 1 warning
```

The rounds, the mutant scripts and the loops are named in the sections above; their raw output and
logs are in the scratch directory (`rounds_final/`, `round_heavy_after/`, `round_before/`,
`round_heavy_before/`, `mutants_*.out`, `mutant_c5*.out`, `cpu_loaded.out`, `logs/`).

Evidence rung: 4 for every claim about these tests on this machine (run, with the red output
pasted); the CI gap is at rung 2 (CI's own logs, read, not reproduced).

## R to test

| acceptance | test or evidence | where |
|---|---|---|
| the cause of each failure with runtime evidence | the per-test sections | this report |
| 0 failures in at least 20 suites per runtime under the same load, harness named | 0 of 40 bun and 0 of 20 node in 10 rounds of 4+2 at `fd1e3fd`; the load was lighter than the diagnosis's (Final rounds) | `scripts/load/rounds.sh` |
| whether either is item 21's failure, and item 21 updated | the Item 21 section (a recommendation: the brief forbids changing item 21) | this report |
| `stopMs - bare` no longer fails on outside load | now `stopCpu - bareCpu < 20` | `tests/costs.test.ts:772` |
| verdict-reader: the test's time or the code's | the test's | `tests/verdict-reader.test.ts:87` |
| costs: a min or a median first | the min was tried (`af63607`) and failed under load; CPU time | `tests/costs.test.ts:755-760` |
| gate:681 and launcher:55: a cause and an explicit timeout | `{ timeout: 35_000 }`, `{ timeout: 10_000 }` | `tests/gate.test.ts:685`, `tests/launcher.test.ts:59` |
| run:54 compares listings of the shared temp directory; run:154 | its own `TMPDIR`, mutants R1 and R2; run:154 not reproduced | `tests/run.test.ts:54`, `:66`, `:73` |
