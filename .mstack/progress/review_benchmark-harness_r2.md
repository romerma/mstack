# Review - benchmark-harness (item 38, round 2)

**Verdict:** CHANGES_REQUESTED

Six of the eight round-1 findings are fixed, and so is the T3 note. Two are fixed only in part:
- **2:** finished copies and every transcript still sit next to the next run.
- **3:** `.mstack/` rides inside both plugin archives, so the answer-bearing path round 1 named comes back with this item's next `chore:` commit.

Both fixes are small. Harness behaviour below is rung 4 against the fake `claude`. Whether a real agent would actually read the adjacent files is rung 2, inferred: the paths are reachable and, for plugin subagents, handed over. The real `claude` was not invoked. I avoided `BENCH_HOME/runs` and `sandbox/bench/{results,streams}`. Mutations ran only in a scratch copy.

This report states no hidden-test values on purpose: see blocking item 2.

## Round-1 findings, one line each
1. **Run root inside the checkout: fixed.**
   - `BENCH_HOME` defaults to the scratchpad (`lib.mjs:13`) and anything under `$HOME` is refused (`lib.mjs:17-22`).
   - I ran it: `BENCH_HOME=/Users/romerma/Code/zz-bench-probe ... --dry-run` threw, and nothing was created.
   - Gap: the archived git state is `diff --stat` only (`run.mjs:179`), not the diff round 1 asked for. Folded into blocking item 1.
2. **Shared parent, reruns destroy evidence: partly fixed. NOT fixed: the leak.**
   - Fixed:
     - Unique `run_id` dir (`run.mjs:89-93`).
     - A rerun of the same (arm, task, rep) is refused (`run.mjs:49-57`).
     - The stream is no longer in the copy's parent.
     - Unique cwd paths, so no shared auto-memory key.
   - Not fixed: every run is a sibling under `$BENCH_HOME/runs/`, and finished copies are kept (`run.mjs:91`, `:215`). Live and finished transcripts sit at `../../logs/` (`run.mjs:143-148`). Blocking item 1.
3. **Plugin dirs over the answer key, snapshot breaks `npm test`: partly fixed.**
   - Fixed:
     - Snapshots are `git archive`s under `$BENCH_HOME/versions/` (`run.mjs:66-86`).
     - `sandbox/bench/versions/` is gone (`fd` finds no such dir).
     - `bun test tests/` picks up nothing under `sandbox/bench` (only the 2 pre-existing `sandbox/clima-portable` files, item 46).
     - Dirty-tree refusal for after (`run.mjs:79`).
   - Not fixed: the archives include `.mstack/` (the after dry-run's `versions/after-<sha>/.mstack/progress` holds 68 files). Blocking item 2.
4. **Inherited env: fixed.**
   - `cleanEnv` is an allowlist plus a fixed PATH (`lib.mjs:31-43`), spawned via `env -i` (`run.mjs:150`).
   - Plain aborts if `command -v mstack` resolves (`run.mjs:126`). The dry-run printed `-> no-mstack`.
   - Mutation `env = { ...src }`: check.mjs goes red, 5 FAIL.
5. **Regression check ran the agent's tests: fixed.**
   - `score()` scores a copy with `tests/` replaced by the template originals, run module by module. Total 0 is not ok (`lib.mjs:59,75-101`).
   - `regressions` and `tests_touched` are in the row (`run.mjs:198`).
   - Mutation back to round 1 (discover the agent's own `tests/` in the work dir): 2 FAIL, tamper and rmtests.
6. **No solved rate: fixed.**
   - `solved` = hidden ok and passed == total == the `def test_` count (`lib.mjs:65-66,97`).
   - The regex counts equal the unittest totals for all six tasks (9/9/13/9/5/9). No skip decorators.
   - Summary leads with solved and adds a by-task table (`summary.mjs:21-32`).
   - Coverage gap: see the notes.
7. **Row fields: fixed.**
   - (a) `subagents` = `subagent_stats.spawned` (`run.mjs:194`). Mutation to the key count: 3 FAIL.
   - (b) Tokens summed over `modelUsage` (`run.mjs:190-191,200`). `usage_*` are kept apart.
   - (c) Harness `wall_ms` (`run.mjs:162`). Mutation to `duration_ms`: the timeout check FAILs (`wall_ms=` blank).
   - (d) `models` and `cc_version` (`run.mjs:206-207`).
8. **Timeout killed one pid: fixed.**
   - `detached` spawn, group SIGTERM then SIGKILL, and a final group SIGKILL after close (`run.mjs:150-161`).
   - Scoring `spawnSync` has `timeout` plus SIGKILL (`lib.mjs:63`). `--timeout-min` NaN is now rejected (`run.mjs:27`).
   - Mutation to the round-1 behaviour (leader-only SIGTERM, no final group kill): FAIL `no sleep 4321/4322 survived: 48907`. No stragglers afterwards.
   - Coverage gaps: see the notes.
- **T3 note: fixed.**
  - `test_T3.py:43-45` adds a case where half-up and half-even differ by a cent. It traces to the issue's "rounding half up to the whole cent after each step" and holds in either code order.
  - I ran it in scratch: the reference passes 13/13. With the reference's rounding changed to Python `round()`, it is `FAILED (failures=1)` at `test_T3.py:44`, and the old `:39` case still passes.
- **verify.mjs pin (round-1 note): done** (`verify.mjs:36-37`).

## Blocking findings
1. **`run.mjs:91`, `:143-148`, `:179`, `:215` and `check.mjs:67`: finished copies and every transcript stay adjacent to later runs.**
   - Round 1's fix was "no sibling runs", "delete the copy once it is archived", and "write the stream straight into `sandbox/bench/streams/`". The implementer kept the copies, made them siblings, and wrote the live logs under `$BENCH_HOME/logs`. `check.mjs:67` now asserts the opposite ("the earlier run dir survived").
   - Rung 4 (my dry-run, own `BENCH_HOME`): `runs/plain-T1-r1-…/` and `runs/mstack-after-T1-r2-…/` side by side. So in the batch:
     - rep 2's `..` holds rep 1's solved tree;
     - mstack-after's `..` holds plain's solution;
     - `../../logs/` holds every earlier full transcript.
   - The plugin root is `$BENCH_HOME/versions/<v>`, so `${CLAUDE_PLUGIN_ROOT}/../..` reaches the same `runs/` and `logs/` for subagents only. That is the same asymmetric pointer round-1 finding 3 was about, moved.
   - Fix:
     - Write the live stream and stderr straight to `$BENCH_OUT/streams/<run_id>.*`.
     - After scoring, archive the full `git diff <templateCommit>` plus untracked files (e.g. `git add -A && git diff --cached <templateCommit> --binary`) next to `git.txt`.
     - Then `rmSync(dir)`.
     - Change `check.mjs:67` to assert the run dir is gone and the diff archive exists.
2. **`run.mjs:69` (both arms): `.mstack/` is inside the plugin archives.**
   - Rung 4 (today):
     - 68 `.mstack/progress` files are tracked and sit in `versions/after-<sha>/.mstack/progress/`. 48 of them are `review_*`.
     - Commits `7f0e498`, `958f9ec` and `a4e6c78` show that this repo commits every round's reports.
     - This item's untracked `review_benchmark-harness.md` and `impl_benchmark-harness_r2.md` already carry hidden-test values (`rg` matched 2 and 3 answer strings).
   - So on the next `chore: record ... item 38` commit, every later mstack-after run gets `${CLAUDE_PLUGIN_ROOT}/.mstack/progress/` with the answer discussion. That is the exact path round-1 finding 3 named. Today it is absent only because those files are untracked.
   - The plugin does not need its own work queue to run.
   - Fix: `git archive <sha> -- . ':(exclude).mstack'` for both versions, for symmetry. Add a check.mjs assertion that `versions/*/.mstack` does not exist.

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| A2 | `verify.mjs` | Exit 0. Pristine counts pinned, reference 100%, traces mapped. T3 mutant above |
| A3 | `check.mjs` | 50 ok, exit 0. 6 of my 9 mutations go red; the 3 survivors are in the notes |
| A1, A4 | the coordinator's spike and batch | Not judged. A4 is blocked by blocking items 1 and 2 |

## Verification I ran
```
$ ./bin/mstack gate                 -> PASSED - 0 failures, 2 warnings
$ ./bin/mstack gate --full          -> /bin/sh: npm: command not found  [fail] (env: no npm/node on PATH, as round 1)
  legs I could run: bun test tests/ -> 292 pass, 0 fail, 18 files (16 tests/*.test.ts + 2 sandbox/clima-portable, item 46)
                    bunx --bun tsc --noEmit -> exit 0 ; ./bin/mstack lint-plugin . -> PASSED
                    node --test leg: not run (no node on PATH)
$ bun sandbox/bench/verify.mjs      -> T1 5/9->9/9, T2 0/9->9/9, T3 0/13->13/13, T4 0/9->9/9,
                                       T5 0/5->5/5, T6 0/9->9/9, visible 18/18; all checks passed
$ bun sandbox/bench/check.mjs       -> all harness checks passed (4.7 s), exit 0
$ ./bin/mstack ledger check benchmark-harness -> PASS test-verified at a4e6c784 by implementer
mutations (scratch copy, REPO pointed at the checkout):
  f5  score agent's own tests in place    -> 2 FAIL (tamper, rmtests)
  f4  env = { ...src }                    -> 5 FAIL
  f7a subagents = key count               -> 3 FAIL
  f7c wall_ms = duration_ms               -> 1 FAIL (timeout row)
  f8a leader-only SIGTERM, no final kill  -> 1 FAIL (sleep survived)
  f2  rep refusal disabled                -> 3 FAIL
  f8b only the post-close group kill removed (run.mjs:161)   -> all passed (uncovered)
  f8c scoring spawnSync timeout removed (lib.mjs:63)         -> all passed (uncovered)
  f6  solved = passed == run's own total (lib.mjs:97)        -> all passed (uncovered)
```

## Non-blocking notes
- **Coverage gaps (f8b, f8c, f6 above; also `lib.mjs:20` and `run.mjs:79`, which check.mjs never exercises):**
  - A fake `bgexit` scenario (a background `sleep` and a normal exit) would cover `run.mjs:161`.
  - A hanging hidden test with an overridable `SCORE_TIMEOUT_MS` would cover `lib.mjs:63`.
  - A `benchHome()` unit assertion would cover the `$HOME` refusal.
- **`regressions`:** it undercounts when a module fails to import ("Ran 1 test, errors=1"). `visible_ok` is the reliable signal.
- **Scoring and git-state commands** run with the coordinator's full env inside agent-written trees (`lib.mjs:63`, `run.mjs:180,186`). That is fine for a cooperative agent, but a repo-local `core.fsmonitor` would execute.
- **`benchHome()`** is a lexical check (`resolve` does not follow symlinks).
- **Parallel runs:** the header write and the rep refusal still race (`run.mjs:49-57,212`).
- **Unobserved, rung 1:** the real CLI under `env -i` (claude.ai auth, `Bash(git:*)` syntax), and whether real agents read outside cwd. These are the coordinator's spike.
- **Ledger:** the implementer self-recorded `test-verified` again (`ledger.tsv:72`) at the same SHA. `ledger check` reads PASS over this rejection, the same ranking issue as round 1. Harness revisions remain indistinguishable by SHA because `sandbox/` is gitignored.
