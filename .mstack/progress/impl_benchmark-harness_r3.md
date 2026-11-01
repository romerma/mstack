# Implementation report, round 3: benchmark-harness

## What changed
Finished runs are no longer reachable. Stream and stderr are written straight to `$BENCH_OUT/streams/` (no `$BENCH_HOME/logs`). After scoring, the full diff from the template commit (untracked files included, `__pycache__` excluded) is saved as `streams/<run-id>.diff`, then the run copy is deleted (dry runs delete theirs too), so `$BENCH_HOME/runs` is empty. Plugin archives use `git archive <sha> -- . ':(exclude,glob)**/.mstack/**'`. The plain `:(exclude).mstack` form left `examples/notes-cli/.mstack` and was replaced; run.mjs also aborts if a `.mstack` exists anywhere in an archive. Every arm now runs `--permission-mode auto` with no `--allowedTools`; `--perm allowlist` is the opt-in debugging flag; the mode lands in a new `perm` column. `results.tsv` was renamed `results-spike.tsv` (summary reads `results.tsv` only by default). Guards added to check.mjs: final group kill, scoring timeout (`BENCH_SCORE_TIMEOUT_MS` override), the solved rule (`isSolved` extracted to lib.mjs), `--perm` validation.

## Files
- sandbox/bench/run.mjs
- sandbox/bench/lib.mjs
- sandbox/bench/check.mjs
- sandbox/bench/testing/fake-claude.sh (scenarios `orphan`, `hang`)
- sandbox/bench/DESIGN.md
- sandbox/bench/results/results.tsv -> results-spike.tsv (rename, gitignored)
- $BENCH_HOME/{runs,logs,versions,scoring} wiped and versions rebuilt

## Commands
```
$ bun sandbox/bench/verify.mjs | tail -4
T6: pristine hidden 0/9 pass, reference hidden 9/9 pass, visible after patch 18/18
  T6 trace: 5 sentences, 9 tests, all mapped

all checks passed

$ bun sandbox/bench/check.mjs | rg "FAIL|passed|\.mstack|no run copy"
  ok   no run copy survives: BENCH_HOME/runs is empty
  ok   no .mstack at any depth under versions/*: after-a4e6c784d99536d39c132cb0d5e4d634ad34e9f2 before
  ok   solved needs ok, passed = expected and total = expected
all harness checks passed

$ bun run.mjs --arm mstack-after --task T3 --rep 1 --dry-run --allow-dirty | rg -o -- "--(output-format|permission-mode|allowedTools).{0,30}|^dry.*"
--output-format stream-json --verbose --setti
--permission-mode auto
dry run: claude was not invoked, no results row written
$ (same for --arm plain)
--output-format stream-json --verbose --setti
--permission-mode auto
dry run: claude was not invoked, no results row written

$ ls -A $BENCH_HOME/runs     # after a fake mstack-after run (row printed perm=auto)
(empty)
$ fd -H .mstack $BENCH_HOME/versions
(no output)

$ ./bin/mstack gate | tail -2
PASSED - 0 failures, 2 warnings
```
check.mjs ran the fake claude only; the real claude was invoked with `--version` only.

## R to test
| R | Test | Where |
|---|------|-------|
| A1 streams/stderr straight to streams/, copy deleted, diff saved, nothing under HOME | "no run copy survives", "nothing logged under BENCH_HOME", "diff ... saved", "every run has jsonl, stderr, git state and diff", "earlier run copy is gone and its diff is saved", "untracked files are in the saved diff" | sandbox/bench/check.mjs (end-to-end and guards sections) |
| A2 no `.mstack/` in archives | "no .mstack at any depth under versions/*" (failed with the top-level-only exclude) | sandbox/bench/check.mjs (end-to-end section) |
| A3 spike rename, summary reads results.tsv | rename done; summary default path unchanged | sandbox/bench/summary.mjs:7 (default file); not separately asserted |
| A4 guards: final group kill, scoring timeout, solved rule | "stray background process is killed", "hanging scored test hits the scoring timeout", "solved needs ok, passed = expected and total = expected" | sandbox/bench/check.mjs (guards section) |
| A5 permission mode auto, no allowlist, perm column, opt-in flag | "perm column is auto by default", "--perm allowlist is recorded", "unknown --perm is refused"; dry-run output above | sandbox/bench/check.mjs (end-to-end and guards sections), run.mjs:119 |

Rung: test-verified. Ran the fake-driven checks and verify (rung 3, harness against a fake). No real model run, so nothing about real-claude behavior (e.g. whether `--permission-mode auto` is accepted unattended) is established.
