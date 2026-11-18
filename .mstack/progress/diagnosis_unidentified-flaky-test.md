# Diagnosis: item 21, the unidentified flaky test (2026-11-18)

Run with the new steps 1 and 2 of `skills/router/playbooks/bug-fix.md`. A diagnosis only: no test and no source file was changed. Commit the suite ran at: `ea0b316`.

## Finding

- Identified, with runtime evidence: the only failing test in 19 loaded suite runs was `hook paths stay within budget on a 50 MB transcript` (`tests/costs.test.ts:698`, already named by item 67), failing at its assertion on line 743, on both runtimes (bun 1 of 10 runs, node 3 of 9). Whether it is the test behind the August 273/1 run is not shown (the August name was never captured).
- Not reproduced: either hang (`tests/gate.test.ts:1618`, the `tests/launcher.test.ts` statusline child). 0 runs reached the 420 s watchdog; the longest run was 217 s.
- Bound: 0 failures other than that one test in 10 bun and 9 node full runs at load average 9.6 to 27.3. `tests/run.test.ts:54`, `:239` and the verdict-reader sequence test did not fail in any run.

## Step 1: the loop

One command per run, `node run.mjs <bun|node> 420`, from the repo root. It runs the suite once on one runtime (`bun test ./tests`, or the `package.json` `test:node` command with `--test-reporter=spec` added) under a SIGKILL watchdog of 420 s, takes `ps -Ao pid,ppid,etime,command | rg "bun|node"` just before killing the process group if it fires, and appends one line to `results.tsv`. A driver ran `node` then `bun` alternately, one run at a time. The scripts (`run.mjs`, `loop.sh`) live in the session scratchpad and are not committed.

First run, as printed (the line the script wrote; time is UTC):

```
23:27:40	bun	load_start=9.6	load_end=11.2	202s	pass=630	fail=1	failing=[hook paths stay within budget on a 50 MB transcript]		log=1794958060468_bun.log
```

It is red-capable (it went red on its first run), unattended, and 87 to 217 s per run, not seconds; the rate it gave was 4 red runs in 19, all the same test.

## Results, every run

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

## Step 2: hypotheses, written before any test file was read, and what each probe showed

1. H1: the August failure is a test item 67 already names. Prediction: every failing name across N loaded runs is in {run.test.ts:54, :239, costs.test.ts:698, verdict-reader "agree on every sequence"}. Probe: the failing-names column of the table. Result: holds for what was seen. All 4 failures are `costs.test.ts:698`; no name outside the list.
2. H2: the `gate.test.ts:1618` hang is a child that never exits under load. Prediction: a killed bun run ends in `tests/gate.test.ts` with a child of bun in `ps`. Probe: needs a kill. Result: no kill occurred in 10 bun runs; not tested, not ruled out.
3. H3: the launcher hang is a `statusline` child waiting on stdin. Prediction: a killed node run shows `tests/launcher.test.ts` and a `statusline` child in `ps`. Probe: needs a kill. Result: no kill in 9 node runs; not tested, not ruled out.
4. H4: the hangs need load. Prediction: more hangs at load 15 or above than below 10. Probe: the load columns. Result: untestable, there were 0 hangs at any load seen (9.6 to 27.3).
5. H5 (null): the August failure is not in the current suite. Prediction: 0 failures outside item 67's names. Result: consistent with the data, but this can only be bounded, not confirmed.

Mechanism for the one failure seen, from the logs: the assertion at `tests/costs.test.ts:743` is `stopMs - bare < 50`, where `stopMs` is the Stop hook with a 50 MB transcript and `bare` is the Stop hook without one, each measured once. The three node failure messages read: `took 1008.9ms against 933.7ms` (difference 75 ms), `1524.4ms against 1077.6ms` (447 ms), `829.2ms against 645.9ms` (183 ms). In the passing node runs the same difference was negative or small in both directions (for example `910.0` against `951.6`, `740.1` against `1078.0`), so the two timings vary by hundreds of ms between runs and the 50 ms margin is inside that. The bun failure was the same assertion (`stop(hook)=205.0ms stop(no transcript)=148.8ms`, 56 ms). The test run alone, load 10.3 at the time: `1 pass 0 fail`.

## What stays unknown

- Which test failed in August. This one is a candidate, not an identification.
- Both hangs. Neither reproduced in 19 runs, so nothing is said about their cause.
- Whether the hangs occur at a higher load than 27.3, or only under some other condition not in this loop.
