# Review - load-sensitive-tests

**Verdict:** CHANGES_REQUESTED

Item 67, branch `fix/load-sensitive-tests`, head `49f6b754e8c22e50ca36351e51e147a90c4d71cd`, base
`5c05f6c`. I did not write this code. Apple M5 Pro, 18 cores; bun 1.3.11, node 26.13.1, node 22.6.0
(nvm). Every mutant ran in a scratch `git worktree` at
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review67/wt`
(removed at the end); scripts and raw output are in that `review67/` directory. The main checkout
was not changed until this report and my ledger row. Outside load (other sessions, Docker, VS Code)
was a 1-minute load average of 7.6 to 16 when my runs started.

## Changes required

1. **`tests/costs.test.ts:755-760` (asserted at `:772`): the best of five in CPU time drops a read
   of the transcript made on only some gate-branch Stops, and nothing says so.** Mutant M4 (the gate
   branch reads and parses the 50 MB on the first Stop only) and M5 (the same, twice): the new test
   is green 18 of 18; the old test was red on M5 8 of 9 (`Stop with a 50 MB transcript took
   136.958917ms against 79.09045899999995ms without one`, bun) and on M4 3 of 3 on node 22.6, the CI
   runtime. The new budget line shows the read and the min dropping it:
   `stop(hook) cpu=... of [65.5,3.0,3.5,3.3,3.0]` (M5, bun). The comment at `:727-742` says
   `stopPathMs` counts "a read made only on the first Stop" but does not say the CPU comparison
   does not; the report's "does not catch" list (`impl_load-sensitive-tests.md:235-238`) names C6
   and a raw read only. The design row (`decisions.tsv`, 2026-11-18T03:12:25) named exactly this
   risk ("a best-of-N comparison could pass a hook that reads the transcript only sometimes; the
   mutant table in the report is the check") and the mutant table has no such row; seam 2 fails for
   it. The min is not needed in CPU time: in the implementer's own loaded loop (`impl67/cpu_loaded.out`,
   40 runs a runtime at load 18.9 to 27.8) max(with) minus max(without) was at most 1.2 ms (bun) and
   2.2 ms (node), and in my 20 suite runs at most 0.9 ms. A bound on the slowest stop-side run (for
   example max against max, with one untimed Stop first so a cold gate path is not counted) catches
   M4 and M5 (first gate-branch run 33 to 77 ms and 61 to 122 ms of CPU). The other way out is to
   state the loss beside C6's, in the comment and the report. Command:
   `bash review67/mutants.sh 3 none M1_... M9_...` (rows below).
2. **`CHANGELOG.md:11-12` is false for a read without a parse:** "an in-process bound on the whole
   Stop path without its gate, which catches a read of the transcript outside the mark check". M8
   (`readFileSync` of the 50 MB on every Stop) and M7 (a utf8 read and a split on every Stop) are
   green on the new test on bun and node 26: `stop(no gate)` 5.1 to 6.4 ms and 9.3 to 13.2 ms
   against 20. What it catches is a read and parse (M1, M2: 26.9 to 40.0 ms). "a read and parse"
   makes it true.
3. **Acceptance criterion 1 is not met for `tests/run.test.ts:239`**, one of the three tests in the
   item's title, nor for `:154` (criterion 8). The report says so (`impl_load-sensitive-tests.md:209-212`,
   `:332`). The red in the diagnosis is a pid still alive 700 ms after the SIGINT:
   `AssertionError [ERR_ASSERTION]: run 1: children survived the Ctrl-C ... + 43830`
   (`impl59r2/logs/1794962574482_node_n1.log:688-694`). A child that is merely slow to die under
   load and one that escapes the group kill give the same red, so "fail on correct code" is not
   shown for it. 0 failures here is weak evidence: it failed only on node (2 of 4 node suites in
   the item 52 to 54 reviews, 2 of 20 in the diagnosis), and the before-rounds had 6 node suites,
   where a 1-in-10 rate gives no failure about half the time. To meet the criterion: runtime evidence,
   for example a loop of that test on node beside the 4+2 load that records whether the reported
   pid is still alive a few seconds after the assertion. Or the coordinator records a decision that
   moves `:239` and `:154` to an item of their own and amends criteria 1 and 2.

## Non-blocking

- **Thin margins on bun.** Red margins against the 20 ms bounds on this machine: M1 `stop(no gate)`
  26.9 to 30.1 ms, M3 CPU difference 26.0 to 27.1 ms (bun). A machine about 1.3 times faster per
  core at this work would pass M3 on bun. Node holds the line (M3 37.3 to 38.6 ms on node 26, 46.8
  to 56.3 on 22.6) and `npm test` runs both. A 10 ms bound would about double the bun margin: the
  correct code stayed at most 0.73 ms (`onStop`), 0.50 ms (`stop(no gate)`) and 1.3 ms (CPU
  difference) in every loaded run, the implementer's and mine.
- **A read without a parse is under every bound, before and after** (M7, M8 on bun and node 26; M7
  is red on node 22.6 only). The report says "a raw read ... without decoding"
  (`impl_load-sensitive-tests.md:237`); a decoded read and a split pass too.
- **Pre-existing, not this diff:** the mark-writing branch of `onStop` (`newMark`, run when the active
  item changed) is never hit after the 50 MB write, because `begin()` writes the mark first. A read and
  parse inside `newMark` passes the new test on bun and node (`review67/mutant_newmark.out`), and the
  old one never exercised that branch either.
- `scripts/load/rounds.sh:16-17`: `seq 1 "${NODE:-2}"` counts down on macOS, so `NODE=0` starts
  two node suites (slots `n1` and `n0`; run below). An arithmetic `for` loop fixes it.
- `scripts/load/README.md:19-20`: "a round took 150 s on 2026-11-18 and up to 430 s the night
  before". The 405 to 428 s rounds started 00:42 UTC on 2026-11-18 (`impl59r2/rounds.log`), the
  150 s before-round 03:26 UTC the same night (`impl67/round_before/rounds.log`).
- `scripts/load/run.mjs:32`: the `/bun|node/` filter for the ps listing at a kill also matches
  "bundle" (`powerd.bundle`, `--bundle-container-mode` in my killed runs' logs). Cosmetic.
- The two failures quoted at `impl_load-sensitive-tests.md:57-60` and the evidence path of the
  second implement row in `decisions.tsv` (`impl67/rounds_final/logs/1_n*_node_*.log`) cannot be
  re-derived: `rounds_final/` now holds the later 60 green runs at `fd1e3fd`. The same failure shape
  is in `impl67/cpu_loaded.out` rows 22 and 32 (`526.5083340000001ms against 461.8388329999998ms`,
  node; `308.08025ms against 207.28112499999997ms`, bun), so the claim stands.
- `impl_load-sensitive-tests.md:211` counts "6 suites at 4+2 and 14 at 10+4" for a node-only
  failure. The node counts are 2 and 4.
- `tests/verdict-reader.test.ts:87` took 54.2 to 54.9 s inside the node suites of my 10+4 round
  (14.2 to 14.3 s at 4+2, 2.9 s quiet): inside its 60 s, and node does not enforce a timeout on a
  synchronous test anyway (probe below). On bun it passed in all 14 of my suites.

## C6, judged

The budget the test guards is the transcript not being read on a Stop: "The hooks that run every
turn (`Stop`) do a stat and a compare. The transcript is read only by a *flush*" (`src/costs.ts:41-43`),
and "the cost part of `Stop` 0.11 ms" (`docs/wiki/State-Files.md:243-246`). A wait on the gate's
branch (M9, a 100 ms `Atomics.wait`) is not a read. The one wait that would break the budget is a
child process reading the transcript on that branch, and the gate's branch is not given the
transcript today (`src/hooks.ts:282`). The comment says "Time spent waiting (a sleep, a child
process) is not counted" (`tests/costs.test.ts:741`) and the report lists C6. I find that trade
acceptable and stated. The loss that is not stated is finding 1.

## Requirement to test

| R | Test | Evidence (mine) |
|---|---|---|
| costs:743 no longer fails on outside load | `tests/costs.test.ts:772` | 20 suite runs: CPU difference -0.3 to 0.4 ms, wall up to 2040 ms |
| a Stop that reads and parses the transcript is red | `:770`, `:771`, `:772` | M1, M2, M3 red 9 of 9 each |
| a read made on only some gate-branch Stops is red | none | M4, M5 green 18 of 18 (finding 1) |
| run:54 still catches a leaked directory | `tests/run.test.ts:72` | R1 red, bun and node |
| run:54 watches the directory the command writes to | `tests/run.test.ts:66` | R2 red on the new test, green on the old |
| gate:685, launcher:59 sized from measured runs | `tests/gate.test.ts:685`, `tests/launcher.test.ts:59` | timings below; assertions unchanged by the diff |

## Acceptance, quoted

**"the cause of each failure is identified with runtime evidence, not guessed from the code"**:
**not met**. Met for costs:698 under load (implementer's per-run lines; mine: every node budget line in
my rounds has the hook's CPU at 8.0 to 10.8 ms a Stop while one wall run reached 2040 ms), run:54
(the old test is red more often with more suites sharing the temp directory: 1 of 6 and 6 of 14, which
I re-derived from the logs; never alone), gate:681, launcher:55 and the verdict-reader test (below). Not
met for run:239 and run:154 (finding 3). The oldest-node gap on CI is "not shown", which the report
says (`:329`).

**"each test passes 0 failures in at least 20 suites per runtime under the same load, with the load
harness named in the report"**: met as written. `scripts/load/rounds.sh` is named. I re-derived the
counts from the logs (not from `results.tsv`): 40 bun and 20 node logs at 4+2, each with `0 fail` /
`ℹ fail 0`, 631 tests, no `(fail)` or `✖` line, no watchdog kill; 10 and 4 at 10+4, the same. My own
rounds at head: 4+2 0 of 4 bun and 0 of 2 node; 10+4 0 of 10 and 0 of 4. "The same load" is the harness
the item names (4 bun + 2 node). The machine was lighter than in the diagnosis: bun suites took 150 to
153 s for me and 145 to 153 s for the implementer at 4+2, and 237 to 244 s at 10+4, against 405 to 428 s
in the diagnosis at 4+2. At that load the old gate:681 and launcher:55 never failed (0 of 14 bun before),
so these rounds say nothing about their timeouts, as the report says (`:296-297`).

**"the report says whether either one is item 21's unidentified failure, and item 21 is closed or
updated accordingly"**: the first half is met, the second is pending the coordinator (the implementer was
told not to touch the store). I checked the claim with git: item 17's round-3 head `e246f1c`
(2026-08-21 21:42, item 21 filed at `d8243f1` 22:21) has 274 `test(` calls (273 pass + 1 fail).
`tests/costs.test.ts`, `tests/run.test.ts` and `tests/verdict-reader.test.ts` do not exist there. The
citation test is absent (added `0f6d972`, 2026-08-22 18:27). "hostile stdin" is at
`tests/launcher.test.ts:55` with the same inputs line. So "only `launcher:55` existed" is true. When
item 21's first criterion is closed, give the number: 0 failures in 94 suites at this test code (64 bun,
30 node; rule of three, about 3 % a suite at 95 %), at a load lighter than the diagnosis's.

**"the stop-minus-bare assertion at tests/costs.test.ts:743 ... no longer fails on outside load"**:
met. 0 of 94 suites red on it; CPU difference -0.6 to 1.0 ms across the implementer's 74 budget lines
and -0.3 to 0.4 ms across my 20, while wall runs reached 911.7 ms, 2039.7 ms and 2040.0 ms. It costs
the losses in finding 1 and C6.

**"tests/verdict-reader.test.ts 'agree on every sequence' was given a 60 s timeout ...; the report says
whether the time is the test's or the code's"**: met. The report says the test's (fixture and gate runs;
the reader 2 to 3 ms). My measurement is the total only: 2.88 s quiet (node), 14.2 to 14.3 s and 54.2
to 54.9 s inside node suites in my 4+2 and 10+4 rounds.

**"... the max of three at tests/costs.test.ts:732-733 keeps the slowest run on each side, so a min or a
median is the first remedy to try"**: met. The min of five in wall time was tried first (`af63607`). It
failed under load (`cpu_loaded.out` rows 22 and 32), and the switch to CPU time is recorded as a
decision. Finding 1 is what the min costs in CPU time, where it is not needed.

**"tests/gate.test.ts:681 and tests/launcher.test.ts:55 exceed bun's 5 s default beside other suites
...; each gets a cause and either an explicit timeout or a faster test"**: met.
- Citation test, my probe (the same ten sandboxes and ten gate runs): quiet 1.42 s, sandboxes 0.78 s (55 %)
  and gate 0.62 s (44 %); at load 31 during my round, 3.83 s (2.02 and 1.76 s). On node in my rounds,
  4.3 to 5.0 s. Against `{ timeout: 35_000 }`: the diagnosis's slowest is 20.9 s (re-derived:
  `[8782.30ms] [20899.67ms] [17509.56ms] [15201.92ms] [5015.78ms]`), and 43 full-suite reds at 5.0 to
  6.9 s.
- Launcher, eight `statusline` starts: quiet 0.50 s (62 to 65 ms each), at load 31 0.81 s (93 to 118
  ms each); on node in my rounds 2.7 to 3.9 s. Against `{ timeout: 10_000 }`: 34 reds in the diagnosis
  at 5.0 to 6.55 s.

Hiding a hang: none of the three figures can. All three tests are synchronous. Bun runs a synchronous
test to its end and marks it red afterwards (probe: a 12 s test under a 10 s timeout ran
`[12000.08ms]`, then "timed out after 10000ms"). Node does not mark it at all (the same test passes on
node 26). A hang in a `spawnSync` stalls the suite whatever the figure; only the harness watchdog or a
CI job limit stops it. The figures only decide how much slowdown counts as red: 22, 20 and 21 times
the quiet run.

**"tests/run.test.ts:54 compares two listings of mstack-run-* in the shared temp directory ...;
tests/run.test.ts:154 failed once on node beside the shrink loops"**: met for run:54. The shared
listing is gone. R1 is still red, R2 is red on the new test (green on the old), and 0 of 94 suites went
red. run:154: not reproduced, no cause (finding 3).

## Probes, briefly

- **`process.cpuUsage`** counts this process's CPU and not its children's, on all three runtimes
  (`review67/cpuprobe.mjs`): a 50 ms busy loop 49.5 to 52.4 ms; `Atomics.wait` 100 ms 0.0 to 0.2;
  `sleep 0.1` child 1.1 to 5.0; a perl child spinning about 1 s wall 0.7 to 1.8; `cat` of the 50 MB
  in a child 0.3 to 0.7; `git rev-parse` 0.5 to 1.5. In-process: buffer read 2.9 to 9.4, utf8 read 3.8
  to 10.8 (18.4 to 22.5 on node 22.6), read, split and parse of the usage lines 22.3 to 35.2 (43.7 to
  69.1 on node 22.6).
- **CI.** The old CI log has only the worst wall run per side (`94.5ms against 37.0ms`, attempt 1;
  `91.4ms against 37.5ms`, attempt 2), so whether the new assertion passes there is not known. If the gap
  is waiting, or a cost on the first Stop only, the new test passes. Only CPU spent on every Stop with a
  transcript fails it. The next `oldest-node` log prints the CPU and wall of all five runs per side, which
  shows which. Locally on node 22.6, run the way CI runs it (no bun on PATH, `--test-concurrency=3`, TAP),
  twice: 612 pass / 0 fail, `stop(hook) cpu=4.7ms ... wall=[80.8,83.9,78.9,79.6,82.7] stop(no transcript)
  cpu=3.9ms ... wall=[74.3,77.3,81.4,75.6,82.1]` and `cpu=4.3ms` against `4.2ms`. No gap here, as for
  the implementer.
- **run:54.** Bun does not pass a `process.env` change to children, and `tmpdir()` follows it
  (`review67/envprobe.mjs`): `bun 1.3.11: tmpdir() before=/var/folders/.../T after=/private/tmp/review67-x
  child(spawnSync)=/var/folders/.../T/`; node 26 and 22.6 pass it (`child=/private/tmp/review67-x`).
  R2 shows the test is not vacuous.
- **Harness** (`review67/wd_stop.sh`). Watchdog at 20 s: 30 processes in the two suite groups at 8 s,
  0 after; both rows `killed`, and each log has the ps listing. TERM to `rounds.sh` at 10 s: 36 → 0,
  run.mjs alive 0, exit 1. INT to one `run.mjs`: its group → 0. Nothing in `hooks/`, `skills/`,
  `agents/`, `bin/`, `src/`, `.claude-plugin/` or `.github/` refers to `scripts/load`. `tsconfig.json`
  includes only `src` and `tests`. lint-plugin, typecheck and the doc-link check are green (below).
- **Item 21 dates** and the **docs**: above. Every line the CHANGELOG adds is true of the code
  except finding 2. The README's lines are true except the date wording and `NODE=0`.

## Verification I ran

```
$ ./bin/mstack gate            # before acting, and again after npm test
PASSED - 0 failures, 0 warnings

$ bash review67/mutants.sh 3 none M1 ... M9   # worktree at 49f6b75; old = e37cbb7's costs test, 3 runs a runtime
| mutant (in src/hooks.ts stop(), before the gate line) | old red bun/node/22.6 | new red | new stop(no gate) ms | new CPU diff ms |
| none                                                | 0/0/0 | 0/0/0 | 0.1-0.2 | 0.0-0.5 |
| M1 every Stop reads and parses                      | 0/0/3 | 3/3/3 | 26.9-30.1 / 36.6-38.0 / 53.2-57.6 | 23.2-26.2 / 30.1-32.7 / 44.1-48.8 |
| M2 first Stop only, either branch                   | 0/0/3 | 3/3/3 | 29.5-31.2 / 36.2-40.0 / 54.1-58.2 | 0.1-0.7 |
| M3 gate branch, every Stop                          | 0/0/3 | 3/3/3 | 0.1 | 26.0-27.1 / 37.3-38.6 / 46.8-56.3 |
| M4 gate branch, first Stop only                     | 0/0/3 | 0/0/0 | 0.1 | -0.1-0.5 |
| M5 gate branch, first Stop only, twice              | 2/3/3 | 0/0/0 | 0.1 | 0.0-0.8 |
| M6 stat only                                        | 0/0/0 | 0/0/0 | 0.1 | -0.2-0.7 |
| M7 utf8 read and split, no parse, every Stop        | 0/0/0 | 0/0/3 | 9.3-9.5 / 12.6-13.2 / 25.0-25.6 | 5.7-7.4 / 7.6-8.5 / 19.5-20.2 |
| M8 buffer read, every Stop                          | 0/0/0 | 0/0/0 | 5.1-6.4 | 3.4-5.5 |
| M9 gate branch waits 100 ms (C6)                    | 3/3/3 | 0/0/0 | 0.1 | 0.2-0.8 |
new red lines: "the Stop hook without its gate took 26.855124999999987ms" (M1 bun),
  "Stop with a 50 MB transcript used 28.807ms of CPU against 2.758ms without one, the best of five runs each" (M3 bun),
  "the Stop hook without its gate took 24.964665999999994ms" (M7 node 22.6)
M4 new, bun: stop(hook) cpu=3.1ms of [33.3,3.3,3.8,3.2,3.1]  ...  M5 new, node 22.6: [121.9,6.5,6.5,6.6,6.8]

$ bash review67/mutants_run.sh        # tests/run.test.ts "tail keeps the last lines ..."
none                   old/new bun,node  green
R1_no_rmSync           old bun RED, old node RED, new bun RED, new node RED  "a temp directory was left behind"
R2_dir_in_private_tmp  old bun green, old node green, new bun RED, new node RED  "the command's temp directory is not in the TMPDIR it was given"

$ bash review67/mutant_newmark.sh
newMark_reads_parses	bun	green	onStop=0.17ms stop(no gate)=0.10ms
newMark_reads_parses	node	green	onStop=0.30ms stop(no gate)=0.20ms

$ scripts/load/rounds.sh 1 review67/round1          # from the worktree, 04:46:59 UTC, load 15.3 at start
runs: bun 4, node 2; red: bun 0, node 0; killed by the watchdog: bun 0, node 0
| (none) | 0 | 0 |
(bun 150-153 s, node 52 s)

$ BUN=10 NODE=4 scripts/load/rounds.sh 1 review67/round_heavy    # 04:49:55 UTC, load 13.5 at start, up to 30.4
runs: bun 10, node 4; red: bun 0, node 0; killed by the watchdog: bun 0, node 0
| (none) | 0 | 0 |
(bun 237-244 s, node 123 s)

$ WATCHDOG=1 BUN=1 NODE=0 scripts/load/rounds.sh 1 review67/zero
runs: bun 1, node 2; red: bun 1, node 2; killed by the watchdog: bun 1, node 2
b1 bun killed / n0 node killed / n1 node killed

$ bun test ./t.test.mjs ; node --test t.test.mjs    # sync spins under node:test timeouts
(fail) sync 6 s, default timeout [6001.87ms]   ^ this test timed out after 5000ms
(fail) sync 12 s, timeout 10 s [12000.08ms]    ^ this test timed out after 10000ms
 1 pass  2 fail                                  # bun: the 6 s test under { timeout: 10_000 } passed
✔ sync 6 s, default timeout (6000.955917ms)  ✔ sync 6 s, timeout 10 s  ✔ sync 12 s, timeout 10 s (12000.192875ms)   # node

$ ./bin/mstack lint-plugin .       -> PASSED - 0 failures, 0 warnings
$ npm run typecheck                -> exit 0
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md scripts/load/README.md -> 96 relative links checked, 0 broken

$ npm test                          # main checkout, load 14.2 at start
 631 pass
 0 fail
Ran 631 tests across 28 files. [114.66s]
ℹ tests 631
ℹ pass 631
ℹ fail 0
ℹ duration_ms 32337.719666
npm test exit=0
(git status afterwards: clean)

$ ./bin/mstack ledger check load-sensitive-tests 49f6b754e8c22e50ca36351e51e147a90c4d71cd   # before my row
FAIL no verdict at 49f6b754; 1 row(s) exist at other SHAs and a new head SHA voids them
```

## What I did not check

- CI itself, so the cause of the `oldest-node` gap (rung 2: CI's logs, read).
- The diagnosis's heavier machine state (bun suites at 405 to 428 s). My rounds ran at the same lighter
  state as the implementer's.
- The mutants G1 and L1 for `gate:685` and `launcher:59`: the diff changes only their options argument
  and a comment, not an assertion.
- A Ctrl-C from a real terminal on `rounds.sh` (I sent TERM to `rounds.sh` and INT to a `run.mjs`).
- Bun's per-test durations under load: bun prints no passing test names off a TTY. I timed the citation
  and launcher work with my own probe during the round, and the verdict-reader test only on node.
- The split of the verdict-reader test's time.
- A targeted reproduction of `run:239` or `run:154`.

Evidence rung: 4 for the mutant results, the harness behaviour, the rounds, the probes and the suite
on this machine; 2 for anything about CI.
