# Load harness

Runs the whole test suite several times at once, so a test that passes alone and fails when
the machine is busy shows up with a rate instead of once in a while. It is what item 67 used
to find and check its load-sensitive tests. It runs nothing in CI, and has no dependencies
beyond bun and node.

## The one command

From the repository root:

```bash
scripts/load/rounds.sh 10 "$TMPDIR/mstack-load"
```

That runs 10 rounds. A round starts 4 bun suites (`bun test ./tests`) and 2 node suites (the
`test:node` command with the spec reporter) together and waits for all six, so 10 rounds are
40 bun and 20 node runs. Each run is under a SIGKILL watchdog on its process group, 820 s by
default. On the 18-core machine item 67 used, a round took 150 s on 2026-11-18 and up to
430 s the night before, with the same code. `BUN`, `NODE` and `WATCHDOG` in the environment
change the counts and the watchdog. The output directory should be outside
the repository: the suites must leave `git status` as they found it.

## Reading the result

`rounds.sh` prints the table at the end; `node scripts/load/table.mjs <out-dir>` prints it
again at any point, from the rows written so far. One round, before item 67's fixes:

```
runs: bun 4, node 2; red: bun 1, node 1; killed by the watchdog: bun 0, node 0

| failing test | bun (of 4) | node (of 2) |
|---|---|---|
| hook paths stay within budget on a 50 MB transcript | 0 | 1 |
| tail keeps the last lines of stdout and stderr, and the temp file is removed | 1 | 0 |
```

A row is one failing test name, with the number of runs it failed in on each runtime. A run
that the watchdog killed is counted in the first line, and its log ends with the `ps` listing
taken just before the kill. The rest is in the output directory:

- `results.tsv`: one line per run: round, slot, runtime, start time (UTC), 1-minute load
  average at start and end, seconds, pass and fail counts, `killed` or `-`, the failing
  names, and the log file name.
- `logs/`: the full output of every run.
- `rounds.log`: `uptime` at the start and end of each round.

The load average is the one other processes add to as well. A rate is only comparable with
another taken at a similar load.
