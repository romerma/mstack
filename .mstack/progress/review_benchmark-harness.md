# Review - benchmark-harness (item 38, round 1)

**Verdict:** CHANGES_REQUESTED

The tasks are fair and they discriminate: A2 is met. The harness is not yet fit to produce A1/A4.
- Every arm's run directory can reach the answer key.
- The mstack arms are handed a pointer to it.
- The plain arm can execute an installed mstack.
- The regression check scores the agent's own edited tests.
- The `subagents` column is a constant.
- The `versions/before` snapshot inside the checkout turns the repo's own `npm test` red.

Everything here is rung 4 unless marked otherwise, and the fake-claude runs say what they ran on. `claude` was not invoked except `claude --help`/`--version`.

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| A1 | n/a, the coordinator's spike | Harness fitness for it: see changes 3, 4, 7 |
| A2 | `sandbox/bench/verify.mjs` | I ran it: all checks passed (tail below). I read all six issue/hidden/meta files side by side |
| A3 | `run.mjs --dry-run` x3 arms. I also ran the real-run path on a scratch copy of the harness, with a fake `env` standing in for `claude` | Row appends, `no-result` and `timeout` handled. Regression check, subagents, isolation and wall time are wrong (changes 1-8) |
| A4 | n/a, the coordinator's step | Blocked on the changes below |

## Acceptance, quoted
**"sandbox/bench (gitignored, never pushed) holds a Python stdlib project whose visible tests pass, and six tasks, each an issue prompt plus hidden tests where every hidden test traces to a sentence of the issue"**: met.
- **Gitignored:** `git check-ignore -v` gives `.gitignore:20:sandbox/`. The nested `sandbox/` repo has no remote, but it shows `?? bench/` (see the notes).
- **Visible suite:** 18/18 on the pristine template.
- **Hidden tests:** fail on pristine (T1 5/9 by design, T2-T6 0/N) and pass 100% with `reference/<id>.patch`. No patch touches `tests/`.
- **Traceability:** `verify.mjs:41-51` checks verbatim sentences and full mapping.
- **Fairness, from my own read:**
  - No hidden test depends on a name, signature, error string or format that the issue (or the existing code it names) leaves unstated.
  - The names are all spelled out in the issues: `codes=`, `request_id=`, `export(fmt)`, `apply_percent_discount(amount_cents, percent)`, `BookingConflict`/`BookingError`.
  - T3's CLI tests rely on the existing `error: ...` with exit 1 and on `format_cents`, which follows from "All of these errors are `BookingError`" plus `cli.py`.
  - Tasks are independent of each other's seeded bugs. T4/T5/T6 fixtures avoid back-to-back dates, and T3 passes with or without the T2 fix.
- **Arithmetic:** I checked by hand every expected value in T2/T3 against half-up.

**"sandbox/bench/run.mjs runs arm x task x repetition in a fresh copy and appends hidden-test pass ratio, visible regressions, tokens, cost, turns and wall time to sandbox/bench/results/*.tsv; arms are plain, mstack-before (git archive of main when this item starts) and mstack-after (the checkout)"**: not met.
- **Met:**
  - It appends.
  - The header equals the DESIGN columns.
  - `versions/before` is byte-identical to `git archive a4e6c784` (`diff -r` shows only the extra `SHA` file).
  - after = HEAD with a `+dirty` flag.
- **Not met:**
  - "Fresh copy" is not isolated (changes 1-3).
  - "Visible regressions" is measured on the agent's tests (change 5).
  - "Tokens" may miss subagent calls, and "wall time" is empty on timeouts (change 7).

A1 and A4 are the coordinator's. They are not judged here.

## Verification I ran
```
$ ./bin/mstack gate                       -> PASSED - 0 failures, 2 warnings (on main; 5 uncommitted)
$ ./bin/mstack gate --full                -> /bin/sh: npm: command not found
  [fail] npm test && npm run typecheck && bin/mstack lint-plugin . failed     (exit 1)
$ bun test tests/        (the bun leg of `npm test`)
  574 pass / 4 fail, "Ran 578 tests across 34 files"
  failing file: sandbox/bench/versions/before/tests/launcher.test.ts:50,62,69 ...
  + "mstack: note: this store's root is an mstack checkout, and this command ran a different
     copy from /Users/romerma/Code/mstack/sandbox/bench/versions/before; prefer .../bin/mstack"
$ bun test ./tests/      -> 286 pass, 0 fail, 16 files      (the checkout's own suite)
$ bunx --bun tsc --noEmit -> exit 0 ;  ./bin/mstack lint-plugin . -> PASSED
$ ./bin/mstack ledger check benchmark-harness -> PASS test-verified at a4e6c784 by implementer

$ bun sandbox/bench/verify.mjs
pristine visible suite: 18/18 OK
T1: pristine hidden 5/9 pass, reference hidden 9/9 pass, visible after patch 18/18
T2: pristine hidden 0/9 ... T3: 0/13 -> 13/13 ... T4: 0/9 -> 9/9 ... T5: 0/5 -> 5/5 ... T6: 0/9 -> 9/9
all checks passed      (exit 0)

$ BENCH_RUNS=<scratch>/dry bun sandbox/bench/run.mjs --arm {plain,mstack-before,mstack-after} --task T1 --dry-run
  all exit 0; mstack arms: "13edf4c mstack setup | f0fc216 template", .mstack/ from that version's
  bin/mstack setup, state.verify = "python3 -m unittest discover -s tests"; plain: no .mstack/
```
The argv that reached `claude` was captured by the fake `env`. Long values are truncated here.
```
plain (14): -p "# Back-to-back…(1215 chars)" --model opus --output-format stream-json --verbose
  --setting-sources project --strict-mcp-config --max-budget-usd 8 --allowedTools "Read Write … Bash(printf:*)"(277 chars)
mstack-before (16): same, prompt "/mstack # Back-to-back…(1223)", plus --plugin-dir <bench>/versions/before
  before --allowedTools (last).   prompt identical except "/mstack " prefix: true
child PATH entries with mstack: /Users/romerma/.claude/plugins/cache/mstack/mstack/0.2.1/bin
child CLAUDE_EFFORT: xhigh
```
For the real-run path, I copied `sandbox/bench` to the scratchpad and put the fake `env` first on PATH. Results went only to the scratch copy.
```
ref     plain T1 r1  hidden_pass=9 hidden_total=9 visible_ok=1 cost_usd=1.23 ... subagents=2 denials=1 is_error=0
noop    plain T1 r2  hidden_pass=5 hidden_total=9 visible_ok=1 ...
weaken  plain T1 r3  hidden_pass=9 hidden_total=9 visible_ok=1 ...   <- agent changed the standard rate,
        deleted tests/test_money_pricing.py, edited "$198.00" in test_adapters_cli.py
        same tree vs the pristine visible tests: "Ran 18 tests ... FAILED (failures=3)"
noresult plain T2    cost_usd= ... is_error=no-result        (row still written: good)
timeout plain T4 --timeout-min 0.03: elapsed=2s, is_error=timeout, duration_ms= (blank)
        pgrep afterwards: "83576 sleep 287" "83577 sleep 301"  <- the fake's children survived SIGKILL
empty tests/ dir: runVisible -> {"total":0,"passed":0,"ok":true,"regressions":0}
summary: plain T1 cell 0.85 = mean(1.00, 0.56 for the no-op, 1.00); regressions 1/6 (misses "weaken")
layout:  runs/plain/T1/{r1/,r2/,r3/,stream-r1.jsonl,stream-r2.jsonl,stream-r3.jsonl,stderr-r*.log}
```
Coordinator's spike stream (`scratchpad/spike/router.jsonl`, claude 2.1.316), read-only:
```
subagent_stats = {"spawned":0,"requested":{..},"started_in_background":0,"max_depth":0,
  "spawned_by_subagents":0,"completed":0,"failed":0,"killed":{..},"refused":{..},"by_type":{}}
run.mjs count(subagent_stats) on it -> 10
sum(modelUsage[*].costUSD) 0.00392991 == total_cost_usd 0.00392991
init.memory_paths = {"auto":"/Users/romerma/.claude/projects/<cwd-slug>/memory/"}
```

## Changes required
1. **`sandbox/bench/run.mjs:49`: the default run root is inside the checkout.**
   - `BENCH_RUNS || join(BENCH, "runs")` puts every copy under `/Users/romerma/Code/mstack/`. There the child loads `~/.claude/CLAUDE.md` and the repo `CLAUDE.md` ("Start work with /mstack"). That is the coordinator's rung-4 result.
   - The answer key is a few `..` away.
   - `findStore` walks to `/` (`src/paths.ts:61-68`). So a plain-arm `mstack` call from such a copy would act on the real `/Users/romerma/Code/mstack/.mstack`.
   - **Fix:** make the default a directory outside `/Users/romerma`, e.g. `/private/tmp/claude-501/-Users-romerma-Code-mstack/b5ee4aa1-47a5-426c-90f7-8e7d4724795e/scratchpad/bench-runs`. Refuse a root under `/Users/romerma` without an explicit override.
   - After scoring, copy `stream.jsonl`, `stderr.log` and the final `git diff <template-commit>` plus `git status`/`git branch --show-current`/`git worktree list` into `sandbox/bench/streams/<arm>/<task>/<run-id>.*`. Put that path in the row.
2. **`run.mjs:50-53` and `:98-100`: runs share a parent, and a rerun destroys evidence.**
   - All reps of an (arm, task) sit side by side with their streams. Rep 2's `..` holds rep 1's solved tree and full transcript, and every other arm is at `../../..` (layout above).
   - `rmSync(dir)` (`:51`) and `openSync(streamPath,"w")` (`:99`) wipe an earlier run when a rep is re-run, while its results row stays.
   - The cwd path also keys auto-memory (`init.memory_paths.auto`), so a rerun at the same path loads whatever an earlier run wrote there. Whether runs write memory is rung 1, unverified, but the channel exists.
   - **Fix:**
     - Give each run a unique directory (`mkdtemp`, `<arm>-<task>-r<rep>-<ts>`) with no sibling runs.
     - Write the stream straight into `sandbox/bench/streams/`, not into the copy's parent.
     - Delete the copy once it is archived.
     - Add a `run_id` column.
3. **`run.mjs:40` and `lib.mjs:8`/`run.mjs:43`: the plugin dirs sit over the answer key, and the snapshot breaks `npm test`.**
   - Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` into plugin agent prompts as an absolute path (`versions/before/agents/reviewer.md:118`; rung 4 as observed: my own reviewer prompt carries the expanded path).
   - So mstack-arm subagents are handed `/Users/romerma/Code/mstack/sandbox/bench/versions/before/...`, whose grandparent holds `tasks/*/hidden/` and `reference/*.patch`.
   - For mstack-after the plugin root is the checkout, so `${CLAUDE_PLUGIN_ROOT}/sandbox/bench/reference/` is literally inside it, along with `.mstack/progress/impl_benchmark-harness.md`.
   - The plain arm gets no such pointer, so the leak is asymmetric.
   - Separately, `bun test tests/` (the bun leg of `npm test`) also runs the 16 test files under `sandbox/bench/versions/before/tests/`. 4 fail (output above), so `mstack gate --full` goes red for every future item while the snapshot lives there.
   - **Fix:** at batch start, `git archive <sha>` both versions into a directory outside `/Users/romerma` and pass that as `--plugin-dir`. For before, use `versions/before/SHA`. For after, use HEAD, and refuse a dirty tree or archive `git stash create`. Keep only the SHA file inside the checkout.
4. **`run.mjs:101`: the child inherits the coordinator's whole environment.**
   - The fake shows the child PATH contains `/Users/romerma/.claude/plugins/cache/mstack/mstack/0.2.1/bin`. Since `Bash(mstack:*)` is allowed (`:27`), the plain arm can run the installed mstack 0.2.1.
   - Launched from inside Claude Code, the child also inherits `CLAUDE_EFFORT=xhigh`, `CLAUDE_CODE_SESSION_ATTENDED=1`, `CLAUDE_CODE_CHILD_SESSION=1`, `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID` and `CLAUDE_CODE_MESSAGING_SOCKET/TOKEN`.
   - What these do to behaviour is rung 1, unknown. The point is that a baseline launched here and an after-run launched from a terminal run under different conditions.
   - **Fix:**
     - Build the env explicitly: drop `ANTHROPIC_API_KEY` and every `CLAUDE*` key, and drop every PATH entry that holds an executable `mstack`.
     - Set effort deliberately if it is meant to be controlled.
     - Before the plain arm spawns, check that `sh -c 'command -v mstack'` under that env prints nothing.
     - Re-check in the spike that claude.ai auth still works with the scrubbed env.
5. **`lib.mjs:36-41` (used at `run.mjs:113`): "visible regressions" runs the agent's tests.**
   - The `weaken` run above reports `visible_ok=1` on a tree that fails 3 of the 18 pristine visible tests.
   - Deleting every test file gives `Ran 0 tests ... OK`, which is `ok:true`.
   - No reference patch touches `tests/`, so nothing legitimate needs the agent's versions.
   - **Fix:**
     - First record `git diff --stat <template-commit> -- tests` as a `tests_touched` signal.
     - Then copy `template/tests/test_*.py` over the copy and run exactly those modules.
     - Treat total 0 as not ok.
     - Store the regression count: `runVisible` computes it, and the row drops it.
6. **`summary.mjs:19,25,30`: no solved rate, so T1 ratios mislead.**
   - A no-op T1 run scores 5/9 = 0.56 (the `noop` row).
   - A partial 8/9 fix outranks an arm that fully solves 2 of 3 reps (0.85 above).
   - **Fix:** add `solved` = (`hidden_pass` == the task's expected count) and make solved rate per arm and per task the headline column.
     - Take the expected count from the hidden module's test definitions or `meta.json`. Do not take it from the run's `hidden_total`: an import error reports `Ran 1 test`.
     - Optionally also print the ratio excluding T1's 5 guard tests.
7. **`run.mjs:115-124`: row fields that are wrong or missing.**
   - (a) `subagents` = `count(subagent_stats)` = **10 for every run**. On the real shape it is `Object.keys(...).length`. Use `subagent_stats.spawned`, plus `spawned_by_subagents` if wanted.
   - (b) Tokens come from `result.usage`, while cost equals the sum of `modelUsage[*].costUSD`. Whether `usage` includes subagent calls is unverified (the spike spawned none), and only the mstack arms spawn subagents. Sum the `modelUsage` token fields so tokens and cost share one source.
   - (c) Wall time comes only from `result.duration_ms`, so it is blank on timeout/no-result (the `timeout` row). A3 requires wall time. Record a harness-measured `wall_ms`.
   - (d) `--model opus` is an alias, and the CLI updates itself. Record `init.model` and `init.claude_code_version` per row so baseline and after are like-for-like.
8. **`run.mjs:101-103` and `lib.mjs:32,38`: the timeout kills one pid.**
   - The fake's children kept running after SIGKILL (pgrep above). With real claude (env execs it), Bash-tool processes would outlive it and could edit the copy while it is being scored. That last point is rung 2, inferred.
   - The scoring `spawnSync` calls have no timeout, so one hanging hidden test stalls the batch.
   - **Fix:** use `detached: true` with `process.kill(-pid)` (SIGTERM, a grace period, then SIGKILL), and put a `timeout` on both `spawnSync` calls.

## Non-blocking notes
- **T3, `test_T3.py:39`:** the case cannot tell half-up from half-even or round-at-end. Add a case where they differ by a cent. [hidden-test values redacted; full text in sandbox/bench/evidence/, local only]
- **T5, `test_T5.py:60`:** the directory-listing assertion also forbids a backup or lock file, which the issue does not mention. It is acceptable as written.
- **`verify.mjs:36`:** only asserts "not all pass on pristine". Pin the exact pristine counts (T1 5, the others 0) so an edit cannot quietly weaken discrimination.
- **`--allowedTools`:** passing the list as one space-joined argument is accepted per `claude --help` 2.1.316 ("Comma or space-separated list"); that is rung 2. The help's example rule syntax is `Bash(git *)`, while the harness uses `Bash(git:*)`. Check `permission_denials` in the spike. `cd/cp/mv/rm` are not allowed, so compare denial counts across arms.
- **Spike prompt:** `/mstack # <heading>\n…` (multi-line slash-command args) is untested. The spike should use the exact T1 prompt.
- **mstack work left off the scored tree:** work left on a branch or worktree (`versions/before/src/worktree.ts:113` makes `../<repo>-wt-<slug>`) would score as unsolved. The git state archived under change 1 makes that visible.
- **Nested `sandbox/` repo:** it lists `?? bench/`, so a `git add -A` there would commit the hidden tests. `.git/info/exclude` is outside `sandbox/bench`, so that is the coordinator's call.
- **Minor:**
  - The template is 327 lines of code against the 400-600 in DESIGN (disclosed).
  - The header write races under parallel runs (`run.mjs:128`).
  - A NaN `--timeout-min` kills at once.
  - The `lib.mjs:36` comment holds only because of call order.
- **Ledger:** `sandbox/` is gitignored, so every harness revision sits at SHA a4e6c784. Rows for this item cannot tell revisions apart. The implementer self-recorded `test-verified` at that SHA (`ledger.tsv:70`).
- **Ledger, after recording this review:** `./bin/mstack ledger check benchmark-harness` still prints `PASS test-verified at a4e6c784 by implementer`. The implementer's self-recorded row outranks this reviewer's `verifier-failed` row (`ledger.tsv:71`) at the same SHA, so the ledger does not show the rejection. That is worth an item of its own.
