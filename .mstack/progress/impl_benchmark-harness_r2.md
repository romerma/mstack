# Implement round 2 - benchmark-harness (item 38)

Everything below is rung 4 against a fake `claude` (`sandbox/bench/testing/fake-claude.sh`). The real `claude` was only run with `--version`. How the real CLI behaves under the scrubbed env (claude.ai auth, `--allowedTools` syntax) is still unobserved: the coordinator's spike must re-check it.

## What changed
`run.mjs` and `lib.mjs` were rewritten and `summary.mjs` was changed; `check.mjs` and `testing/fake-claude.sh` are new. All of it is under `sandbox/bench/`.
- Nothing runs under `/Users/romerma` any more. `BENCH_HOME` defaults to the scratchpad `bench-home`, and the harness refuses a `BENCH_HOME` under `$HOME`.
- Each run gets a unique dir, `$BENCH_HOME/runs/<arm>-<task>-r<rep>-<utc>/`.
- Plugin versions are `git archive` snapshots under `$BENCH_HOME/versions/`.
- `claude` runs from an environment built from scratch, detached in its own process group.
- Scoring happens in a fresh directory with the template's original tests restored.
- The row has the new columns.
- `summary.mjs` leads with the solved rate.
- `sandbox/bench/versions/` is deleted from the repo tree.
- The T3 hidden test now has a half-even-sensitive case.

## Findings
1. **Default run root inside the checkout** (`run.mjs:49`).
   - `lib.mjs` `benchHome()` returns `BENCH_HOME` or the scratchpad default, and throws for anything under `homedir()`.
   - Proof: `BENCH_HOME=/Users/romerma/Code/foo bun run.mjs ... --dry-run` throws at `benchHome()`.
   - `check.mjs` asserts that the fake's cwd is under `$BENCH_HOME/runs/<run_id>` and outside `/Users/romerma`, for all 3 arms.
   - Stream, stderr and git state (`status`, `branch`, `worktree list`, `diff --stat`) are archived to `streams/<run-id>.{jsonl,stderr.log,git.txt}`.
   - Deviation: the archive lives in `streams/`, flat. The row carries `run_id`, which names the files.
2. **Shared parent, reruns destroy evidence.**
   - There is no `rmSync` of a run dir any more, and `openSync` writes into a unique `$BENCH_HOME/logs/<run-id>.*`.
   - `run_id` = `<arm>-<task>-r<rep>-<UTC stamp>`, and a run aborts if its dir exists.
   - A (arm, task, rep) with a results row is refused ("pass a new --rep number").
   - The run dir is kept after scoring (not deleted). Each is a sibling under `runs/`, not in an arm/task tree.
   - `check.mjs` covers this: 3 arms give 3 dirs, a rerun is refused, a new rep adds a row, and the earlier dir survived.
3. **Plugin dirs over the answer key; the snapshot broke `npm test`.**
   - `run.mjs` archives `BEFORE_SHA` (`a4e6c784...`) to `$BENCH_HOME/versions/before` and HEAD to `$BENCH_HOME/versions/after-<sha>`, with a `SHA` file in each.
   - mstack-after refuses a tree dirty outside `.mstack` unless `--allow-dirty`, because it archives HEAD only.
   - The `${CLAUDE_PLUGIN_ROOT}` expansion now points outside the repo, and the grandparent holds no `tasks/` or `reference/`.
   - `sandbox/bench/versions/` was deleted.
4. **Inherited env.**
   - `cleanEnv()` keeps HOME, USER, LOGNAME, TERM, LANG, TMPDIR and SHELL.
   - PATH is `/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/Users/romerma/.bun/bin` plus the directory of the `claude` binary. Entries containing `.claude/plugins` are dropped.
   - There is no `ANTHROPIC_*` or `CLAUDE_*`.
   - The spawn is `env -i K=V... claude ...`.
   - The test-only `BENCH_PASS_ENV` hook refuses `ANTHROPIC`/`CLAUDE` names.
   - Dry-run prints the env and probes it. The plain arm aborts if the probe prints a path.
   - `check.mjs` poisons the parent env with `ANTHROPIC_API_KEY`, `CLAUDE_EFFORT`, `CLAUDECODE` and `CLAUDE_CODE_SESSION_ID`. It asserts the fake child's `env` dump contains no `ANTHROPIC*`/`CLAUDE*` and no `.claude/plugins`.
   - Left open, rung 1: CLAUDE_EFFORT is no longer set at all, so effort is whatever the CLI default is. Set it deliberately in the spike if wanted.
5. **Regression check ran the agent's tests.**
   - `score()` copies the agent's tree (minus `.git`) into a fresh dir under `$BENCH_HOME/scoring`.
   - It deletes `tests/`, restores the template's `tests/`, then runs each original module by name (`-p test_x.py`). `visible_ok` = every module ran, none failed, and total > 0.
   - Then it adds the hidden module. Every `spawnSync` has `timeout: 120000` and SIGKILL.
   - New columns: `regressions` and `tests_touched` (files in `tests/` that differ from the template commit, including untracked).
   - `check.mjs`, `tamper` scenario: the fake applies the patch, changes the standard rate, edits `$198.00` and deletes a test module. Result: `visible_ok=0 regressions=3 tests_touched=2`.
   - `rmtests` scenario: it deletes `tests/`. Result: `visible_ok=1, solved=0`, because the originals are restored.
6. **No solved rate.**
   - New `solved` column: hidden passed == the count of `def test_` in the task's hidden module, and the module ran OK. The expected count does not come from `hidden_total`.
   - `hidden_total` in the row is that expected count.
   - `summary.mjs` columns are now `arm runs solved mean_hidden regressions cost_usd tokens turns errors`, plus a solved-by-task table. `check.mjs` asserts the column order.
7. **Row fields.**
   - (a) `subagents` is `subagent_stats.spawned` if numeric, otherwise blank. The raw JSON is in `subagent_stats`. `agent_calls` counts `Agent`/`Task` tool_use blocks in the stream.
   - (b) `input`, `output`, `cache_read` and `cache_write` are summed over `modelUsage` (`inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens`). `usage_*` keeps the `usage` totals.
   - (c) `wall_ms` is measured by the harness, and is set on timeout (1804 in the check).
   - (d) `models` (the `modelUsage` keys, falling back to `init.model`) and `cc_version` (the init event, falling back to `claude --version`).
   - The fake emits two models and `spawned:2`. `check.mjs` asserts subagents=2, agent_calls=1, input=101, output=202, cache_read=303, cache_write=404, usage_input=10, the models and the version.
8. **Timeout killed one pid.**
   - `spawn(..., { detached: true })`, then `process.kill(-pid, SIGTERM)`, SIGKILL on the group 3 s later.
   - After `close`, the group gets SIGKILL once more so stragglers cannot edit the copy during scoring.
   - Mutation check: with `child.kill()` and no final group kill, `check.mjs` fails with `no sleep 4321/4322 survived: 15493`. Restored, it passes.
- **T3 note.** `test_T3.py` gets a case where half-up and half-even differ by a cent. [hidden-test values redacted; full text in sandbox/bench/evidence/, local only]
  - Pristine fails, as before.
  - Reference patch: 13/13.
  - Half-even mutant (`round(exact)` in place of `floor(exact + 1/2)`): `AssertionError` off by one cent, `FAILED (failures=1)`.
  - Mutant with the new assertion removed: `OK`.
- **verify.mjs.** It now pins the pristine pass counts (T1 5, the others 0).

## Files
- `sandbox/bench/run.mjs` (rewritten)
- `sandbox/bench/lib.mjs` (rewritten)
- `sandbox/bench/summary.mjs`
- `sandbox/bench/verify.mjs`
- `sandbox/bench/check.mjs` (new)
- `sandbox/bench/testing/fake-claude.sh` (new)
- `sandbox/bench/tasks/T3/hidden/test_T3.py`
- Deleted: `sandbox/bench/versions/`
- Also this report and the ledger row.

## Commands
```
$ bun sandbox/bench/verify.mjs | tail
T3: pristine hidden 0/13 pass, reference hidden 13/13 pass, visible after patch 18/18
T6: pristine hidden 0/9 pass, reference hidden 9/9 pass, visible after patch 18/18
all checks passed

$ bun sandbox/bench/check.mjs      (4.9 s; 3 arms x end-to-end, tamper, timeout, summary)
clean environment: 4 ok
end to end with a fake claude: 12 ok per arm for plain, 11 ok per arm for mstack-before and mstack-after (the plain arm has one extra no-mstack probe check)
  ok   same (arm, task, rep) is refused
  ok   a new --rep is accepted and adds a row
  ok   the earlier run dir survived
  ok   tampered tests: visible_ok=0, regressions=3
  ok   tests_touched=2 (edited and deleted modules)
  ok   deleting tests/ cannot hide anything: originals restored, visible_ok=1, T1 not solved
  ok   timeout row written, wall_ms=1804
  ok   no `sleep 4321/4322` survived: none
  ok   second column after arm/runs is solved: arm runs solved mean_hidden regressions cost_usd tokens turns errors
arm            runs  solved   mean_hidden  regressions  cost_usd  tokens      turns   errors
plain          5     3/5      0.71         1/5          1.50      1010        7.0     1
mstack-before  1     1/1      1.00         0/1          1.50      1010        7.0     0
mstack-after   1     1/1      1.00         0/1          1.50      1010        7.0     0
all harness checks passed

$ BENCH_HOME=/private/tmp/x2 bun run.mjs --arm plain --task T1 --dry-run     (head)
arm=plain task=T1 rep=1 version=- run_id=plain-T1-r1-20261031T155049Z
cwd:  /private/tmp/x2/runs/plain-T1-r1-20261031T155049Z
claude 2.1.316 (Claude Code) at /Users/romerma/.local/bin/claude
child env (built from scratch):
  HOME=/Users/romerma
  USER=romerma
  LOGNAME=romerma
  TERM=xterm-256color
  LANG=en_US.UTF-8
  TMPDIR=/var/folders/r1/cn30880j4jl1k4dg_fpj62mw0000gn/T/
  SHELL=/bin/zsh
  PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/Users/romerma/.bun/bin:/Users/romerma/.local/bin
env -i <that env> sh -c 'command -v mstack || echo no-mstack' -> no-mstack

$ mutation: timeout kills only the leader
  FAIL no `sleep 4321/4322` survived: 15493
  1 problem(s)

$ bun test tests/                                   (repo root)
 292 pass
 0 fail
Ran 292 tests across 18 files.
$ junit suite names: 16 are tests/*.test.ts; 2 are sandbox/clima-portable/tests/{format,wmo}.test.js
$ fd -e ts . tests | wc -l   -> 17   (16 *.test.ts plus helpers.ts)

$ ./bin/mstack gate
PASSED - 0 failures, 2 warnings
```
Item 5 caveat:
- Nothing under `sandbox/bench/` is picked up now.
- The 18 files are the 16 `tests/*.test.ts` plus 2 from `sandbox/clima-portable/tests/` (the weather-app dogfood).
- Those 2 are outside this item's files, so I left them. They are the same kind of leak: bun's `tests/` filter is a substring match on the path.
- `fd -e ts` counts `helpers.ts`, which is not a test.
- Decision for the coordinator: the 292 tests pass, but a fresh clone has no `sandbox/`. Whether the gate should ignore that dogfood is yours to call.

## Not done or unverified
- The spike still has to run the real CLI under `env -i` with the scrubbed env, to check claude.ai auth and that `Bash(git:*)` is honoured.
- The real `subagent_stats` shape beyond `spawned` is read from the coordinator's spike. `agent_calls` is the cross-check.
- `~/.claude/CLAUDE.md` (HOME is kept, per the decision) still loads for every arm, equally.

## A to test
| R | Test | Where |
|---|---|---|
| A1 | the coordinator's spike (not judged here) | n/a |
| A2 | `verify.mjs` pins pristine counts, reference patches, issue to hidden-test trace, and now T3's half-even case | `sandbox/bench/verify.mjs:36-37`, `sandbox/bench/tasks/T3/hidden/test_T3.py:43-45` |
| A3 | `check.mjs`: end to end with the fake for 3 arms, clean env, unique dirs, rerun refusal, tamper scoring, timeout group kill, summary columns | `sandbox/bench/check.mjs:30-110` |
| A4 | the coordinator's run, unblocked by findings 1-8 | n/a |
