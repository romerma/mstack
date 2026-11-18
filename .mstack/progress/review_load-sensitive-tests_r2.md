# Review - load-sensitive-tests, round 2

**Verdict:** CHANGES_REQUESTED

Item 67, branch `fix/load-sensitive-tests`, head `7fc306049d098f7f9ffc306bc60cbb2ddb7e0cd6`; round 2 diff
`ab3f636..7fc3060`. I did not write this code. Apple M5 Pro, 18 cores; bun 1.3.11, node 26.13.1, and from nvm
node 22.6.0 (CI `oldest-node`) and node 24.14.0 (CI `test` uses node 24), nothing installed. Mutants ran in a
scratch worktree at `review67r2/wt` (removed); scripts and raw output are in
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review67r2/`.
`git diff --stat ab3f636..7fc3060 -- tests` lists only `tests/costs.test.ts | 23`.

## Changes required

1. **`tests/costs.test.ts:745-747` is false on both node versions CI runs, and `CHANGELOG.md:13-14` is false
   there for a decoded read.** The comment says "a plain read of the file, with or without a split, costs 4 to
   14 ms of CPU, under the 20 ms bounds". On node 22.6 and node 24 a utf8 read and a split (M7) is red, on
   the in-process bound: `the Stop hook without its gate took 24.95441600000001ms`, `22.53`, `26.22`, `24.46`
   (node 22.6, 4 of 4), `24.93016700000001ms`, `23.99` (node 24, 2 of 2); its CPU per with-side run is 22 to
   34 ms. A utf8 read with no split (M7b) is red on node 22.6 too: `took 20.699083ms`, `20.417333000000013ms`.
   The sentence holds on bun 1.3.11 and node 26, the only runtimes the implementer ran
   (`impl_load-sensitive-tests_r2.md:32`, "Not run on node 22.6"); round 1 already had M7 red on node 22.6,
   3 of 3 (`review_load-sensitive-tests.md:219`). A read of the bytes (M8) is under every bound on all four
   runtimes (CPU difference 4.4 to 10.1 ms, `stop(no gate)` 5.0 to 6.6 ms), so the CHANGELOG's "a plain read
   without a parse (4 to 14 ms of CPU, under the 20 ms bounds)" is true for a `Buffer` read and false on node
   22.6 for a decoded one. The error makes the test sound weaker than it is on CI, not stronger, but it is a
   measured figure stated without its runtime. Fix: name the runtimes, or narrow the limit to a read of the
   bytes, for example "a read of the bytes costs 4 to 14 ms of CPU and passes; a decoded read with a split
   is 9 to 13 ms on bun 1.3 and node 26, and 22 ms and more, red, on node 22.6 and 24". Line 728, which
   predates round 2, has the same gap: "A read and parse of these 50 MB measured 25 to 35 ms for item 67";
   on node 22.6 one read and parse (M4's first run minus a normal run) is 63 to 66 ms of CPU, on node 24
   58 ms.

## Non-blocking

- **The with side's slowest run is the cold gate, by construction.** In my 60 loaded runs the with-side max
  is run 1 in 58 (`flake.rows`), up to 4.2 ms over that side's median (node: `[14.5,10.3,10.2,10.4,10.2]`
  against a without-side max of 10.2). With the pair order swapped in a scratch copy, the excess moves to the
  without side's run 1 (`[9.4,6.0,5.9,6.0,6.3]`, node; the with side then 6.1 to 7.7), so it follows the
  first gate run in the process, not the transcript. One untimed `stop({ cwd: box.store.root })` before the
  loop (no transcript, so a read on the first with-side Stop is still timed and M4 still red) would take it
  off both sides. Margin today: worst 4.3 ms against 20. CPU time is not load-proof either: node's per-Stop
  CPU is 6 to 7 ms alone, a median of 6.9 to 10.1 ms beside my 4+2 load, and 15 to 16 ms inside the node half of `npm test`
  (budget line below). The difference cancels most of that; the cold-gate excess grew with it (2.4 to 3.4 ms
  quiet, up to 4.2 ms loaded, node).
- **The implementer's flake figures come from a broken parser.** `impl67r2/diff.pl` declares
  `my($g,$a,$b)` and then sorts with `$b<=>$a`, so its max is not the max (its node row "maxWith=10.1
  maxWithout=7.3 diff=2.8" matches no run in `flake.out`). Recomputed from `impl67r2/flake.out`: largest
  difference 1.1 ms (bun) and 2.5 ms (node), not 1.6 and 2.8. The 30 of 30 green per runtime is right.
- **The implementer's load was lighter than reported.** "beside `rounds.sh` 4 bun + 2 node full suites
  looping" (`impl_load-sensitive-tests_r2.md:35`): `impl67r2/loadrounds/results.tsv` has two rows, both node,
  done at 53 s (05:06:19 + 53 s), and `rounds.log` one round start; the check ran 05:06:39 to 05:08:04
  (`flake.uptime`), so its second half had the 4 bun suites only. My run below kept 4 bun and 2 node suites
  the whole time.

## Round 1 findings

1. **Max-based bound** (`tests/costs.test.ts:764-765`, asserted at `:777`): resolved. M4 and M5 are red on all
   four runtimes, figures below.
2. **CHANGELOG "a read of the transcript"**: resolved ("a read and parse", `CHANGELOG.md:12`). The limit
   sentence that came with it is finding 1. `rg -n -i "best of five|catches a read of the transcript"` outside
   `.mstack/` finds nothing; inside, only the round 1 reports and decision row 199, which are history.
3. **`run:239` and `run:154`**: resolved by the amendment, judged under criterion 1.

## Requirement to test

| R | Test | Evidence (mine) |
|---|---|---|
| a read and parse on only some gate-branch Stops is red | `tests/costs.test.ts:777` | M4 12 of 12 (bun, node 26, 22.6, 24), M5 10 of 10 (bun, node 26, 22.6) |
| a read and parse on every Stop is red | `:775`, `:776`, `:777` | C1 to C5 red once each on bun, node 26, node 22.6 |
| the bound does not flake under load | `:777` | 60 of 60 green beside 4 bun + 2 node; worst 4.3 ms |
| a wait with no CPU, a read of the bytes pass (stated) | comment `:743-747` | C6, M8 green on all runtimes; M7 is not (finding 1) |

## Acceptance, quoted

**"the cause of each failure is identified with runtime evidence, not guessed from the code (tests/run.test.ts:239
and :154 moved to item 86 on 2026-11-18: their red is a pid still alive after the signal, so load sensitivity
is not shown for them)"**: met. For the tests kept, round 1's evidence stands (those tests are unchanged). The
amendment is honest: it has a design row (`decisions.tsv`, 2026-11-18T05:01:57, citing the round 1 review),
the title says the item no longer covers them, and item 86 carries the counts (2 of 4 node suites in the item 52
to 54 reviews; 2 of 60 in the diagnosis, `diagnosis_unidentified-flaky-test.md:148`), the log line, and criteria
that ask for exactly what was missing here: a loop with a rate, runtime evidence of whether the pid is a real
survivor, and a test-first fix. "a pid still alive" is true of both: run:154's red is `AssertionError
[ERR_ASSERTION]: children survived the timeout ... + [ 59436 ]` (`impl59r2/logs/1794966943956_node_s2.log:777-783`),
run:239's `children survived the Ctrl-C ... + 43830` (round 1). Nothing claims either test fixed.

**"each test this item keeps passes 0 failures in at least 20 suites per runtime under the same load, with the
load harness named in the report"**: met. The unchanged tests: round 1's 40 bun + 20 node at 4+2. The changed
assertion reads five numbers per side that every suite has printed since `fd1e3fd`; only min became max. Over all
106 earlier suite logs that print them (72 bun, 34 node, including the 40 + 20 of `impl67/rounds_final` at 4+2),
max(with) - max(without) is at most 1.6 ms (bun) and 1.3 ms (node) (`maxmax_earlier.out`). At the final tree:
`impl67r2/rounds_final` 8 bun + 4 node, 0 red (re-derived: worst 0.5 and 1.1 ms); my 4 node load suites at head,
631/0 each; one `npm test`. The harness is `scripts/load/rounds.sh`.

**"the report says whether either one is item 21's unidentified failure, and item 21 is closed or updated
accordingly"**: first half met (`impl_load-sensitive-tests.md:299-325`; round 1 checked it with git). Second
half not yet done at head: `./bin/mstack state show 21` is unchanged. The coordinator's plan (write this item's
result into item 21's description and leave it open on the two hangs) satisfies "updated accordingly", provided
the update says that `launcher:55` is the only one of these tests that existed in August, with nothing
identifying it, and gives the bound (round 1: 0 failures in 94 suites at this test code, 64 bun and 30 node, at a
lighter load than the diagnosis). It must happen before `done`.

**"the stop-minus-bare assertion at tests/costs.test.ts:743 (each side the max of three runs, difference under
50 ms) no longer fails on outside load: ..."**: met. My 60 runs beside 4 bun + 2 node at load 14 to 24, 0 red,
worst difference 4.3 ms; the implementer's 60, 0 red; the 106 pooled suites above.

**"tests/verdict-reader.test.ts 'agree on every sequence' was given a 60 s timeout ...; the report says whether
the time is the test's or the code's"**: met (round 1; the test and the report section are unchanged).

**"the closing gate of item 59 was red on tests/costs.test.ts:698 in node three runs of four ...; the max of three
at tests/costs.test.ts:732-733 keeps the slowest run on each side, so a min or a median is the first remedy to
try"**: met. The min was tried first (`af63607`, wall time), failed under load, and the move to CPU time and back
to the slowest run is recorded with its reason (decision rows 03:49:00 and 05:01:57). In CPU time the slowest run
is not the load's: in my runs it is the first gate run (first non-blocking finding).

**"tests/gate.test.ts:681 and tests/launcher.test.ts:55 exceed bun's 5 s default ...; each gets a cause and either
an explicit timeout or a faster test"**: met (round 1; unchanged).

**"tests/run.test.ts:54 compares two listings of mstack-run-* in the shared temp directory, so another suite's
directory fails it (read from the code and one log, not tested by removing the sharing)"**: met (round 1, R1 and
R2; unchanged).

Seam "each changed test against a mutant of the defect it guards: it still goes red": met for M4, M5, C1 to C5.

## The comment at `tests/costs.test.ts:727-747`, sentence by sentence

- "Stop: a stat and a compare. It must not read the transcript at all": the claim under test; fine.
- "A read and parse of these 50 MB measured 25 to 35 ms for item 67": bun and node 26 only (finding 1).
- `onStopMs` and `stopPathMs` lines: unchanged; C2/C4 and C1/C3 red on them on every runtime.
- "a read and a parse here is CPU time on every run it is made in, the gate's branch included": true (C5, M4).
- "Each side is its slowest of five runs, taken in turn": true (`:760-765`).
- "the slowest, not the best, so a read made on only some of the Stops (the first one, say) is not dropped":
  true, M4 and M5 red.
- "The first run is timed too, on purpose": true; it is what keeps M4 red, and it also puts the cold gate on
  the with side (non-blocking).
- "a wait that uses no CPU on the gate's branch (a sleep, a child process) is not counted": true, C6 green on
  all runtimes, wall 175 to 188 ms.
- "a plain read of the file, with or without a split, costs 4 to 14 ms of CPU, under the 20 ms bounds":
  false on node 22.6 and 24 (finding 1).
- "so what these bounds catch is a read and a parse (26 ms and more), not a read alone": true as a lower edge.

## Harness nits

- `NODE=0`: `BUN=1 NODE=0 WATCHDOG=3 scripts/load/rounds.sh 1 review67r2/zero` started one suite; `results.tsv`
  has one row, `1 b1 bun killed`, and the table header reads `node (of 0)`.
- ps filter `/\b(bun|node)\b/`: true on `/usr/bin/node x`, `bun test ./tests`, `~/.bun/bin/bun test`,
  `.../v26.13.1/bin/node run.mjs`; false on `powerd.bundle/powerd`, `--bundle-container-mode`,
  `node_modules/.bin/tsc`.
- README "a round took 150 s in one run and up to 430 s in another on 2026-11-18": the 150 s round is
  03:26:26 to 03:28:56 UTC (`impl67/round_before/rounds.log`); the diagnosis's bun suites took 426 to 428 s
  (`impl59r2/results.tsv`), started 00:42 UTC the same day. True. "with the same code" not re-derived.

## Verification I ran

```
$ ./bin/mstack gate                         # before acting, and after npm test
PASSED - 0 failures, 0 warnings

$ bash review67r2/mutants.sh ...            # worktree at 7fc3060; red = the test fails
none  green: bun 3/3, node 3/3, node22 3/3, node24 2/2
M4    RED 4/4 bun   "used 34.974ms of CPU against 3.889ms without one, the slowest of five runs each" (33.9 to 36.9 against 3.8 to 4.1)
      RED 3/3 node  53.4 to 54.3 against 6.3 to 6.9;  RED 3/3 node22  69.9 to 73.1 against 6.7 to 7.4;  RED 2/2 node24  64.5 to 64.7
      bun budget: "stop(hook) cpu max=35.0ms of [35.0,3.0,3.7,3.6,3.0]"
M5    RED 4/4 bun   59.3 to 68.0 against 3.8 to 4.2;  RED 3/3 node  90.9 to 98.7;  RED 3/3 node22  118.2 to 123.1
C1    RED bun/node/node22  "the Stop hook without its gate took 34.755167ms" / 35.58 / 57.92
C2    RED                  "the Stop mark check took 26.691125ms" / 36.48 / 52.74
C3    RED                  "the Stop hook without its gate took 34.868292ms" / 44.92 / 49.27
C4    RED                  "the Stop mark check took 34.03004200000001ms" / 41.96 / 49.53
C5    RED                  "used 61.636ms of CPU against 4.819ms" / 95.79 against 6.88 / 122.33 against 7.23
C6    green bun/node/node22  CPU difference 1.3 / 2.9 / 0.9; wall [175.7,174.5,178.3,176.4,186.7] (bun)
M7    green bun (stop(no gate) 10.00, CPU difference 10.6), green node26 (12.23, 10.7)
      RED node22 4/4 "the Stop hook without its gate took 24.95441600000001ms" (22.53, 26.22, 24.46)
      RED node24 2/2 "the Stop hook without its gate took 24.93016700000001ms" (23.99)
M7b   green bun 2/2 (7.11, 7.72), green node26 2/2 (10.33, 8.99), RED node22 2/2 "took 20.699083ms" (20.42)
M8    green bun (5.85, 7.2), node26 (6.56, 4.4), node22 4/4 (4.97 to 5.25, 9.0 to 10.1), node24 2/2 (6.17 to 6.32, 6.2 to 6.5)
(M7 = utf8 read and split; M7b = utf8 read; M8 = Buffer read; all on every Stop, before the gate line)

$ bash review67r2/flake.sh 25 10            # from the worktree; load = two rounds.sh, BUN=4 NODE=0 and BUN=0 NODE=2
ramp 07:01:02 load averages: 14.29 ... | bun suites: 4 node suites: 2
after 25 07:03:28 load averages: 23.96 ... | bun suites: 4 node suites: 2
load stopped 07:03:29
  25 bun green    25 node green    10 node22 green          (0 RED, 0 NORUN)
bun    max(with)-max(without) -0.7 to 1.6; with-side max at run 1 in 23 of 25
node   0.8 to 4.3; run 1 in 25 of 25; worst: with=[14.5,10.3,10.2,10.4,10.2] without=[10.1,10.1,10.1,9.9,10.2]
node22 0.2 to 2.1; run 1 in 10 of 10
load node suites: 4 of 4 at 631 pass / 0 fail (loadB/results.tsv); bun load suites stopped mid-run, no rows
afterwards: no `bun test ./tests`, `run.mjs`, `rounds.sh` or node-suite process on the machine

$ swap probe (scratch copy, without-side first in each pair)
node  stop(hook) cpu max=7.7ms of [6.3,6.6,6.6,7.1,7.7]  stop(no transcript) cpu max=9.4ms of [9.4,6.0,5.9,6.0,6.3]
bun   stop(hook) cpu max=4.2ms of [3.3,3.3,3.9,4.2,3.0]  stop(no transcript) cpu max=4.2ms of [4.2,2.8,3.4,3.1,2.9]

$ perl review67r2/maxmax.pl all-earlier-suites <219 earlier suite logs>
bun: n=72 worst max(with)-max(without)=1.6;  node: n=34 worst=1.3

$ ./bin/mstack lint-plugin .   -> PASSED - 0 failures, 0 warnings
$ npm run typecheck            -> exit 0
$ npm test                     # main checkout, load 9.2 at start
 631 pass
 0 fail
Ran 631 tests across 28 files. [114.95s]
ℹ tests 631
ℹ pass 631
ℹ fail 0
npm test exit=0
budget (node half): stop(hook) cpu max=16.2ms of [15.8,15.4,15.7,16.2,15.4] ... stop(no transcript) cpu max=16.5ms of [15.5,16.5,15.7,14.2,15.5]

$ ./bin/mstack ledger check load-sensitive-tests 7fc306049d098f7f9ffc306bc60cbb2ddb7e0cd6   # before my row
FAIL no verdict at 7fc30604; 3 row(s) exist at other SHAs and a new head SHA voids them
```

## What I did not check

- CI itself, so the bound on a GitHub runner (rung 2: the next `oldest-node` log prints all ten runs).
- The 10-round verification, as briefed; the other tests are unchanged since round 1.
- C1 to C6 and M5 on node 24 (M4, M7, M8 only).
- Whether "with the same code" in the load README is true.
- Deviation from the brief: I waited for my own flake driver with one bounded polling loop
  (`while ... sleep 5`, under `alarm 200`) instead of its completion notice. It changed no result.

Evidence rung: 4 for the mutants, the flake run, the harness checks and the suite on this machine; 3 for the
pooled re-derivation from earlier logs; 2 for CI.
