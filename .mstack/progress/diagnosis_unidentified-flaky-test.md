# Diagnosis: item 21, the unidentified flaky test (2026-11-18)

Run with steps 1 and 2 of `skills/router/playbooks/bug-fix.md` as they read after round 2 of item 59. A diagnosis only: no test and no source file was changed. The serial runs ran at `ea0b316` and the parallel rounds at `2a5a236`; `git diff --stat ea0b316..2a5a236 -- src tests` is empty. Scripts and logs are in the session scratchpad, not committed: `impl59/` (serial runs) and `impl59r2/` (parallel rounds: `run.mjs`, `round.sh`, `rounds.sh`, `shrink.sh`, `shrink2.sh`, `hypotheses.md`, `results.tsv`, `rounds.log`, `logs/`).

## Finding

- Candidate, for the August 273/1 run: nothing is identified. The August failure's name was never captured, so no test can be called its identification. Five tests were seen failing across both passes (table under "Failures seen"), each a candidate only.
- Reproduced with a failure mode shown by runtime output, in 10 parallel rounds of 4 bun and 2 node suites (60 runs): `tests/gate.test.ts:681` failed in 40 of 40 bun runs and `tests/launcher.test.ts:55` in 29 of 40, each with bun's own line `this test timed out after 5000ms`. Neither was on item 67's list. `gate:681` passes alone and times out again beside five other suites (shrink, below).
- Not reproduced: either hang. 0 of 79 full-suite runs (19 serial, 60 parallel) reached its watchdog; the longest run was 428 s.

## Serial runs: the loop

One command per run, `node run.mjs <bun|node> 420`, from the repo root. It runs the suite once on one runtime (`bun test ./tests`, or the `package.json` `test:node` command with `--test-reporter=spec` added) under a SIGKILL watchdog of 420 s, takes `ps -Ao pid,ppid,etime,command | rg "bun|node"` just before killing the process group if it fires, and appends one line to `results.tsv`. A driver ran `node` then `bun` alternately, one run at a time: 19 runs, 87 to 217 s each, 0 killed, and `tests/costs.test.ts:698` was the only failing test, 4 times.

First run, as printed (the line the script wrote; time is UTC):

```
23:27:40	bun	load_start=9.6	load_end=11.2	202s	pass=630	fail=1	failing=[hook paths stay within budget on a 50 MB transcript]		log=1794958060468_bun.log
```

It is red-capable (it went red on its first run), unattended, and 87 to 217 s per run, not seconds; the rate it gave was 4 red runs in 19, all the same test.

### Serial runs: every run

| # | UTC | runtime | load at start | load at end | duration | pass/fail | failing |
|---|-----|---------|---------------|-------------|----------|-----------|---------|
| 1 | 23:27:40 | bun | 9.6 | 11.2 | 202s | 630/1 | hook paths stay within budget on a 50 MB transcript |
| 2 | 23:31:16 | node | 11.2 | 24.2 | 91s | 631/0 | - |
| 3 | 23:32:48 | bun | 24.2 | 12.2 | 209s | 631/0 | - |
| 4 | 23:36:16 | node | 12.2 | 24.4 | 92s | 630/1 | hook paths stay within budget on a 50 MB transcript |
| 5 | 23:37:48 | bun | 24.4 | 13.1 | 209s | 631/0 | - |
| 6 | 23:41:18 | node | 13.1 | 22.6 | 91s | 631/0 | - |
| 7 | 23:42:48 | bun | 22.6 | 11.3 | 214s | 631/0 | - |
| 8 | 23:46:23 | node | 11.3 | 26.0 | 91s | 631/0 | - |
| 9 | 23:47:54 | bun | 26.0 | 12.2 | 211s | 631/0 | - |
| 10 | 23:51:25 | node | 12.2 | 27.0 | 92s | 631/0 | - |
| 11 | 23:52:57 | bun | 27.0 | 13.4 | 217s | 631/0 | - |
| 12 | 23:56:34 | node | 13.4 | 23.0 | 109s | 630/1 | hook paths stay within budget on a 50 MB transcript |
| 13 | 23:58:23 | bun | 23.0 | 11.9 | 216s | 631/0 | - |
| 14 | 00:02:00 | node | 11.9 | 21.9 | 91s | 631/0 | - |
| 15 | 00:03:31 | bun | 21.9 | 11.9 | 214s | 631/0 | - |
| 16 | 00:07:05 | node | 11.9 | 22.6 | 87s | 630/1 | hook paths stay within budget on a 50 MB transcript |
| 17 | 00:08:32 | bun | 22.6 | 12.0 | 206s | 631/0 | - |
| 18 | 00:11:58 | node | 12.0 | 27.3 | 89s | 631/0 | - |
| 19 | 00:13:27 | bun | 27.3 | 11.1 | 213s | 631/0 | - |

Load is the 1-minute load average from `os.loadavg()`. A node run itself raises the load average (from about 11 to about 24 within its 90 s), so "load at end" for node runs is mostly the suite's own concurrency, on top of outside load from other processes (Docker, VS Code).

These runs were not enough: step 1 says a bug that is not constant needs a higher rate ("loop the trigger, run it in parallel, add load, pin the rate"), and both hangs in item 21 were seen while several suites ran at once. One suite at a time could not test either hang.

## Parallel rounds: hypotheses, written before any parallel run

Created 00:42:49 UTC; the first parallel run started 00:42:54 UTC. Verbatim:

```
Written before any parallel run. A round is 4 bun suites and 2 node suites started together.
N: at least 4 rounds counted, so at least 16 bun runs and 8 node runs (24 in all); every run in the table counts, calibration round included. Extra rounds add to N.
Serial baseline (round 1 of the diagnosis): costs.test.ts:698 failed in 4 of 19 runs (21%); durations 87 to 217 s; no run killed.

H1 (rank 1): parallel suites raise the rate of the known failure. Prediction: at least 6 of the 24 runs fail at costs.test.ts:698 (serial rate scaled to 24 runs is 5). Refuted if 5 or fewer.
H2 (rank 2): slowness, not a hang, explains a long stall. Prediction: at least 1 run takes longer than 434 s (twice the slowest serial run, 217 s) and still finishes by itself. Refuted if every run is under 434 s or is killed.
H3 (rank 3): a test outside item 67's list fails under parallel suites. Prediction: at least 1 failing name in the rounds is not costs.test.ts:698, run.test.ts:54, run.test.ts:239 or the verdict-reader sequence test. Refuted if every failing name is in that list.
H4 (rank 4): the tests/gate.test.ts:1618 hang is brought on by several bun suites at once. Prediction: at least 1 of the bun runs is killed by the watchdog with its last file header in tests/gate.test.ts. Refuted if 0 of at least 16.
H5 (rank 5): the tests/launcher.test.ts stall is a `statusline` child that does not exit when node suites run beside bun suites. Prediction: at least 1 of the node runs is killed with a `statusline` child in the ps capture. Refuted if 0 of at least 8.
```

## Parallel rounds: the loop

- Driver: `round.sh <round> <watchdog> 4 2` starts four bun and two node suites together, each as `node run.mjs <runtime> <watchdog> <slot>` (the serial script with one added argument, the slot, in the log file name and the row), and `wait`s on their pids. `rounds.sh` ran rounds 2 to 10 back to back. Each ran in the background under `perl -e 'alarm N'`, because the foreground limit is 600 s and a round takes about 7 minutes.
- Watchdog: round 1 ran with a watchdog of 1200 s. Its slowest run took 408 s, so rounds 2 to 10 used 820 s (about twice). Across all 10 rounds the bun runs took 405 to 428 s and the node runs 210 to 227 s, so the watchdog never fired.
- Shared paths: each run writes its own log (`logs/<ms>_<runtime>_<slot>.log`), and `git status --porcelain` in the repository was empty after the rounds. The suites use `mkdtemp` under the system temp directory; one test reads that directory for other suites' directories (`run:54`, below).
- Load: `uptime` at the start and end of every round is in `rounds.log`: round starts 8.8 to 29.1 (1-minute average), round ends 21.3 to 29.1.
- 10 rounds: 40 bun and 20 node runs, 00:42:54 to 01:53:57 UTC (71 minutes).

### Parallel rounds: every run

Failing names: `costs:698` is `tests/costs.test.ts:698` (assertion :743); `launcher:55` is `tests/launcher.test.ts:55` (`hostile stdin never produces a non-zero exit or a word on stderr`); `gate:681` is `tests/gate.test.ts:681` (`a citation is the exact report filename as a whole token, however punctuated`); `run:54` and `run:239` are `tests/run.test.ts:54` and `:239`. "Load end" is the load average when that run finished, with its siblings still running.

| round | slot | runtime | start UTC | load start | load end | duration | pass/fail | failing |
|---|---|---|---|---|---|---|---|---|
| 1 | b1 | bun | 00:42:54 | 8.8 | 21.1 | 406s | 629/2 | launcher:55, gate:681 |
| 1 | b2 | bun | 00:42:54 | 8.8 | 21.1 | 408s | 628/3 | launcher:55, gate:681, run:54 |
| 1 | b3 | bun | 00:42:54 | 8.8 | 21.1 | 408s | 630/1 | gate:681 |
| 1 | b4 | bun | 00:42:54 | 8.8 | 21.3 | 408s | 630/1 | gate:681 |
| 1 | n1 | node | 00:42:54 | 8.8 | 35.2 | 210s | 629/2 | costs:698, run:239 |
| 1 | n2 | node | 00:42:54 | 8.8 | 35.2 | 211s | 631/0 | - |
| 2 | b1 | bun | 00:52:08 | 9.8 | 24.7 | 407s | 629/2 | launcher:55, gate:681 |
| 2 | b2 | bun | 00:52:08 | 9.8 | 24.7 | 405s | 629/2 | launcher:55, gate:681 |
| 2 | b3 | bun | 00:52:08 | 9.8 | 24.7 | 405s | 629/2 | launcher:55, gate:681 |
| 2 | b4 | bun | 00:52:08 | 9.8 | 24.7 | 406s | 630/1 | gate:681 |
| 2 | n1 | node | 00:52:08 | 9.8 | 35.9 | 211s | 629/2 | costs:698, run:54 |
| 2 | n2 | node | 00:52:08 | 9.8 | 35.9 | 211s | 631/0 | - |
| 3 | b1 | bun | 00:58:55 | 24.7 | 25.1 | 412s | 629/2 | gate:681, run:54 |
| 3 | b2 | bun | 00:58:55 | 24.7 | 25.1 | 410s | 630/1 | gate:681 |
| 3 | b3 | bun | 00:58:55 | 24.7 | 25.1 | 412s | 629/2 | launcher:55, gate:681 |
| 3 | b4 | bun | 00:58:55 | 24.7 | 25.1 | 411s | 629/2 | launcher:55, gate:681 |
| 3 | n1 | node | 00:58:55 | 24.7 | 33.6 | 217s | 630/1 | costs:698 |
| 3 | n2 | node | 00:58:55 | 24.7 | 33.6 | 217s | 629/2 | costs:698, run:54 |
| 4 | b1 | bun | 01:05:47 | 25.1 | 25.4 | 412s | 629/2 | launcher:55, gate:681 |
| 4 | b2 | bun | 01:05:47 | 25.1 | 25.4 | 413s | 629/2 | launcher:55, gate:681 |
| 4 | b3 | bun | 01:05:47 | 25.1 | 25.4 | 413s | 629/2 | launcher:55, gate:681 |
| 4 | b4 | bun | 01:05:47 | 25.1 | 25.4 | 411s | 629/2 | launcher:55, gate:681 |
| 4 | n1 | node | 01:05:47 | 25.1 | 35.1 | 216s | 629/2 | costs:698, run:54 |
| 4 | n2 | node | 01:05:47 | 25.1 | 35.1 | 215s | 630/1 | costs:698 |
| 5 | b1 | bun | 01:12:41 | 25.4 | 24.1 | 411s | 629/2 | launcher:55, gate:681 |
| 5 | b2 | bun | 01:12:41 | 25.4 | 24.1 | 410s | 629/2 | launcher:55, gate:681 |
| 5 | b3 | bun | 01:12:41 | 25.4 | 24.1 | 410s | 629/2 | launcher:55, gate:681 |
| 5 | b4 | bun | 01:12:41 | 25.4 | 24.1 | 410s | 629/2 | launcher:55, gate:681 |
| 5 | n1 | node | 01:12:41 | 25.4 | 34.5 | 212s | 630/1 | costs:698 |
| 5 | n2 | node | 01:12:41 | 25.4 | 34.5 | 212s | 631/0 | - |
| 6 | b1 | bun | 01:19:32 | 24.1 | 24.4 | 408s | 630/1 | gate:681 |
| 6 | b2 | bun | 01:19:32 | 24.1 | 24.4 | 409s | 629/2 | launcher:55, gate:681 |
| 6 | b3 | bun | 01:19:32 | 24.1 | 24.4 | 407s | 628/3 | launcher:55, gate:681, run:54 |
| 6 | b4 | bun | 01:19:32 | 24.1 | 24.4 | 407s | 629/2 | launcher:55, gate:681 |
| 6 | n1 | node | 01:19:32 | 24.1 | 30.6 | 213s | 629/2 | costs:698, run:54 |
| 6 | n2 | node | 01:19:32 | 24.1 | 30.6 | 213s | 629/2 | costs:698, run:54 |
| 7 | b1 | bun | 01:26:21 | 24.4 | 30.8 | 426s | 629/2 | launcher:55, gate:681 |
| 7 | b2 | bun | 01:26:21 | 24.4 | 30.8 | 426s | 629/2 | launcher:55, gate:681 |
| 7 | b3 | bun | 01:26:21 | 24.4 | 29.1 | 428s | 629/2 | launcher:55, gate:681 |
| 7 | b4 | bun | 01:26:21 | 24.4 | 29.1 | 427s | 628/3 | launcher:55, gate:681, costs:698 |
| 7 | n1 | node | 01:26:21 | 24.4 | 65.5 | 227s | 629/2 | costs:698, run:54 |
| 7 | n2 | node | 01:26:21 | 24.4 | 65.5 | 227s | 631/0 | - |
| 8 | b1 | bun | 01:33:29 | 29.1 | 24.9 | 410s | 629/2 | launcher:55, gate:681 |
| 8 | b2 | bun | 01:33:29 | 29.1 | 26.1 | 408s | 629/2 | launcher:55, gate:681 |
| 8 | b3 | bun | 01:33:29 | 29.1 | 24.9 | 410s | 630/1 | gate:681 |
| 8 | b4 | bun | 01:33:29 | 29.1 | 24.9 | 411s | 629/2 | launcher:55, gate:681 |
| 8 | n1 | node | 01:33:29 | 29.1 | 39.3 | 217s | 630/1 | costs:698 |
| 8 | n2 | node | 01:33:29 | 29.1 | 39.3 | 217s | 628/3 | costs:698, run:54, run:239 |
| 9 | b1 | bun | 01:40:20 | 24.9 | 22.2 | 407s | 630/1 | gate:681 |
| 9 | b2 | bun | 01:40:20 | 24.9 | 22.2 | 407s | 629/2 | launcher:55, gate:681 |
| 9 | b3 | bun | 01:40:20 | 24.9 | 22.2 | 408s | 628/3 | launcher:55, gate:681, run:54 |
| 9 | b4 | bun | 01:40:20 | 24.9 | 22.2 | 408s | 629/2 | launcher:55, gate:681 |
| 9 | n1 | node | 01:40:20 | 24.9 | 31.3 | 212s | 630/1 | costs:698 |
| 9 | n2 | node | 01:40:20 | 24.9 | 31.3 | 212s | 630/1 | run:54 |
| 10 | b1 | bun | 01:47:08 | 22.2 | 24.5 | 408s | 630/1 | gate:681 |
| 10 | b2 | bun | 01:47:08 | 22.2 | 24.5 | 408s | 629/2 | launcher:55, gate:681 |
| 10 | b3 | bun | 01:47:08 | 22.2 | 24.5 | 406s | 630/1 | gate:681 |
| 10 | b4 | bun | 01:47:08 | 22.2 | 24.5 | 409s | 630/1 | gate:681 |
| 10 | n1 | node | 01:47:08 | 22.2 | 36.3 | 215s | 630/1 | costs:698 |
| 10 | n2 | node | 01:47:08 | 22.2 | 36.3 | 214s | 631/0 | - |

### Failures seen

| name | serial (19) | parallel bun (40) | parallel node (20) | on item 67's list |
|---|---|---|---|---|
| `costs:698` | 1 of 10 bun, 3 of 9 node | 1 | 14 | yes |
| `run:54` | 0 | 4 | 8 | yes |
| `run:239` | 0 | 0 | 2 | yes |
| `gate:681` | 0 | 40 | 0 | no |
| `launcher:55` | 0 | 29 | 0 | no |

Every bun run in the parallel rounds had at least one failure (40 of 40); 15 of the 20 node runs did.

## Parallel rounds: what each hypothesis showed

1. H1, the rate of the known failure rises under parallel suites. Predicted at least 6 of 24 runs; the first 24 runs (rounds 1 to 4) had 6, all node. The threshold was met, but no rise is shown: over all 60 runs `costs:698` failed 15 times (25%), against 4 of 19 (21%) serial, and the two passes mix the runtimes differently (20 of 60 node runs against 9 of 19). On node it is 14 of 20 against 3 of 9, which is suggestive only; on bun it is 1 of 40 against 1 of 10.
2. H2, slowness explains a long stall. Predicted a run over 434 s that finishes by itself. Refuted: the slowest of 60 runs took 428 s.
3. H3, a test outside item 67's list fails under parallel suites. Held: `gate:681` (40 runs) and `launcher:55` (29 runs). Both fail with `this test timed out after 5000ms` (69 such lines in the 40 bun logs, 40 + 29), the test taking 5.0 to 6.9 s. `launcher:55` runs a loop of eight child spawns (`tests/launcher.test.ts:55-64`). Shrunk below: `gate:681` reproduces beside five other suites; `launcher:55` does not reproduce outside the full run.
4. H4, the `tests/gate.test.ts:1618` hang is brought on by several bun suites at once. Refuted: 0 of 40 bun runs killed (0 of 46 with the shrink loops' bun runs).
5. H5, the `tests/launcher.test.ts` stall is a `statusline` child that does not exit beside bun suites. Refuted: 0 of 20 node runs killed (0 of 24 with the shrink loops). No `ps` capture was taken, because the watchdog never fired.

Refuted means refuted for these rounds (load 8.8 to 29.1); it does not rule out a hang that needs another condition.

The 10 full suites that ran beside the shrink loops (6 bun, 4 node; the `shrink` and `shrink2` rows of `results.tsv`) are counted above for kills only. Their failures are not in the "Failures seen" table: `gate:681` failed in 3 of the 6 bun suites, and a sixth test failed once on node, `tests/run.test.ts:154` ("a timeout kills children that are being forked at that moment").

### Shrinking the two new failures

Each in its own file with `bun test <file> -t <name>`, then beside the other five suites of a round (three bun and two node started together, the tests started 60 s later). `shrink.sh` and `shrink2.sh`; logs `logs/shrink_alone.log`, `logs/shrink_beside.log`, `logs/shrink2_beside.log`.

| run | `gate:681` | `launcher:55` |
|---|---|---|
| the one test alone, twice | 1 pass 0 fail, twice | 1 pass 0 fail, twice |
| the one test beside 5 suites, 4 times | 0 pass 1 fail, 4 times (timed out after 5000ms, test took 5.0 to 20.9 s) | 1 pass 0 fail, 4 times |
| the whole file beside 5 suites, 3 times | 1 failed of 3 (the test took 8.8 s) | 6 pass 0 fail, 3 times |

So `gate:681` exceeds bun's 5 s default when five other suites run. `launcher:55` fails only inside a full parallel run, and what in the full run brings it on is not shown.

### `tests/run.test.ts:54`: a shared path

The test lists the `mstack-run-*` directories in the system temp directory before and after its command and asserts the lists are equal (`tests/run.test.ts:55-63`). A node log shows the assertion `a temp directory was left behind` with an extra entry, `mstack-run-1Iznj3`, in the second list. With six suites sharing the temp directory, another suite's directory appearing between the two reads fails it.

## Mechanism for `costs:698`

The assertion at `tests/costs.test.ts:743` is `stopMs - bare < 50`. `stopMs` is the Stop hook with a 50 MB transcript and `bare` is the Stop hook without one, each the max of three runs (`tests/costs.test.ts:732-733`). Serial failure messages: `took 1008.9ms against 933.7ms` (75 ms), `1524.4ms against 1077.6ms` (447 ms), `829.2ms against 645.9ms` (183 ms). In the parallel logs the messages read, for example, `took 3351.1ms against 2102.3ms` and `3507.0ms against 3270.2ms`: both timings are in the seconds with six suites running. The same test alone at load 11.2: `stop(hook)=132.3ms stop(no transcript)=123.3ms`, `1 pass 0 fail` (`logs/costs_alone.log`). The max of three keeps the slowest run on each side, so one slow run on either side goes whole into `stopMs - bare`, against a 50 ms margin.

## What stays unknown

- Which test failed in August. Nothing here identifies it; every test seen failing is a candidate.
- Both hangs. 0 kills in 79 full-suite runs plus 10 in the shrink loops; what causes them is not shown.
- Whether the hangs need a condition this loop did not reach (higher load, other tools running, a particular machine).
