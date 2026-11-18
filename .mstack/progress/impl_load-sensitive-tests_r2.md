# Implementation report, round 2 - load-sensitive-tests

Item 67, branch `fix/load-sensitive-tests`, from `661501c`. Commits: `8ddd933` (test), `4b42717` (docs), `28f340b` (harness).
Scratch (mutants, outputs): `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl67r2` (mut.sh, before.out, after.out, flake.out, rounds_final/).

## What changed
`tests/costs.test.ts`: the whole-hook comparison bounds the slowest of five CPU runs per side, `max(cpuWith) - max(cpuWithout) < 20`
(was min). Comment, assertion message and `budget:` line (prints every run, now `cpu max=`) match; the comment states both limits
(a wait with no CPU, C6; a plain read without a parse, M7/M8). `CHANGELOG.md` says read and parse, slowest, and lists both limits.
Harness: `NODE=0` starts no node suite, the ps filter at a kill is `/\b(bun|node)\b/`, the README's "the night before" is replaced.

## Green on a mutant, before (round 1 test, `bash mut.sh costs-r1.ts 3 M4 M5`, before.out)
```
M4 bun  green x3  stop(hook) cpu=3.0ms of [33.1,3.0,3.7,3.3,3.0]   stop(no transcript) cpu=2.8ms ...
M4 node green x3  stop(hook) cpu=6.3ms of [54.9,7.0,6.3,6.5,7.0]
M5 bun  green x3  stop(hook) cpu=3.0ms of [63.5,3.2,3.9,3.2,2.9]
M5 node green x3  stop(hook) cpu=6.5ms of [96.1,6.5,6.8,6.7,6.9]
```
The read is in the first run and the min drops it: the defect.

## Mutant table, final test (3 runs a runtime, after.out; M4/M5 as in the review, C1-C6 as in round 1)
| mutant | bun | node | figure |
|---|---|---|---|
| none | green 3/3 | green 3/3 | max-max 0.9-1.3 bun, 2.8-3.7 node |
| C1 to C4 | RED 3/3 | RED 3/3 | wall/in-process bounds |
| C5 | RED 3/3 | RED 3/3 | CPU bound |
| M4 | RED 3/3 | RED 3/3 | `used 33.318ms of CPU against 3.93ms without one, the slowest of five runs each` (bun); `51.82ms against 6.932ms` (node) |
| M5 | RED 3/3 | RED 3/3 | `63.71ms against 3.865ms` (bun); `94.216ms against 7.084ms` (node) |
| C6 (=M9, 100 ms wait) | green 3/3 | green 3/3 | diff 1.6-1.7 bun, 3.2-3.8 node: not caught, stated in the comment |
| M7 (utf8 read + split) | green 3/3 | green 3/3 | diff 9.5-9.8 bun, 13.1-13.4 node; stop(no gate) 8.5-9.8 / 11.7-12.8 |
| M8 (buffer read) | green 3/3 | green 3/3 | diff 4.0-4.9 bun, 13.1-14.3 node |
Bound left at 20: M7 on bun (9.5) is not separable from a bound with margin on both sides, so I did not tune it. Not run on node 22.6.

## Flake check under load (flake.sh; flake.uptime)
Test alone, 30 runs per runtime, beside `rounds.sh` 4 bun + 2 node full suites looping (load average 17.7 to 22.9 at check start/end): bun 30/30 green, node 30/30 green, 0 failures.
Largest max(with) - max(without): 1.6 ms bun, 2.8 ms node. Load stopped afterwards (rounds.sh killed, none left).

## Harness nits
- `BUN=1 NODE=0 WATCHDOG=5 scripts/load/rounds.sh 1 zero`: results.tsv has one slot, `b1 bun`; before, it started `n1` and `n0`. Table header: `node (of 0)`.
- ps filter: `/\b(bun|node)\b/` on "/usr/bin/node x" true, "bun test ./tests" true, "/System/powerd.bundle" false, "--bundle-container-mode" false (the old regex: true for all four).
- README: "a round took 150 s in one run and up to 430 s in another on 2026-11-18, with the same code".
- `rg -n "best of five|cpu" CHANGELOG.md docs README.md CONTRIBUTING.md scripts/load/README.md`: only CHANGELOG:9 had the claim, fixed.

## Verify (final tree)
```
./bin/mstack lint-plugin .  -> PASSED - 0 failures, 0 warnings
npm run typecheck           -> exit 0
./bin/mstack gate           -> PASSED - 0 failures, 0 warnings
npm test                    -> 631 pass, 0 fail (bun 114 s); node ℹ pass 631 ℹ fail 0
scripts/load/rounds.sh 2 (4 bun + 2 node): runs: bun 8, node 4; red: bun 0, node 0; killed by the watchdog: bun 0, node 0
```

## Not shown
Node 22.6 (the CI runtime) for the mutants and the loaded loop; CI itself; the `NODE=0` demo was cut short by a 5 s watchdog; run:239 and :154 are item 86's.
Deviations: none from the three changes. The test comment says 4 to 14 ms for a plain read (measured M7/M8 diffs), not the round 1 figure.
