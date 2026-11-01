# Review - benchmark-harness (item 38, round 3)

**Verdict:** CHANGES_REQUESTED

This round was scoped by decision row `review-r3` (`.mstack/decisions.tsv:93`) to three changes.

- **Change 1, nothing reachable: met and guarded.** Four of my five reverts go red.
- **Change 2, no `.mstack` in either archive: met and guarded.** Three of my four reverts go red. The fourth removes a defensive abort that the pathspec makes unreachable.
- **Change 3, `--permission-mode auto` for every arm: the code is correct but has no test.**
  - My dry runs of all three arms end in `--permission-mode auto` with no `--allowedTools`.
  - Restoring the round-2 line at `run.mjs:119` leaves `check.mjs` green, and the results row still says `perm=auto`.
  - This change is acceptance bullet 5, so it blocks approval. The fix is a few lines of test code.

**Evidence ladder:**
- Harness behaviour reached rung 4 against the fake `claude` and through dry runs. The real `claude` was invoked with `--version` only.
- That real `claude` applies `auto` under `env -i` is rung 1, unobserved. It belongs to the coordinator's probe.

I ran mutations only in scratch copies, with `REPO` pointed at the checkout. I did not touch the default `BENCH_HOME/runs` or `sandbox/bench/{results,streams}`. This report states no hidden-test values.

## Scope item 1: finished runs leave nothing reachable. Met.
- **Code:**
  - Stream and stderr are opened straight in `$BENCH_OUT/streams/` (`run.mjs:146-151`). There is no `logs/` dir.
  - `git.txt` goes to the same place (`run.mjs:178-180`).
  - After scoring, `git add -A` and `git diff --cached --binary <templateCommit>` write `streams/<run_id>.diff`, then the copy is deleted with `rmSync` (`run.mjs:190-192`).
  - Dry runs delete their copy too (`run.mjs:141`).
- **Guards:** `check.mjs:58,61,62,66,67,77,114`.
- **Observed:**
  - `check.mjs` is green.
  - The default `BENCH_HOME` has empty `runs/` and `scoring/`.
  - Three dry runs in my own fresh `BENCH_HOME` left `runs/` empty.
- **What `${CLAUDE_PLUGIN_ROOT}/../..` reaches:** it resolves to `$BENCH_HOME`, which holds `runs/` (only the live run), `scoring/` (empty while the agent runs) and `versions/`. The plugin writes nothing into its own root: its compile cache goes to `CLAUDE_PLUGIN_DATA` or `~/.cache` (`bin/mstack:51`).
- **Reverts:** m1a-m1d go red. m1e (the dry run keeps its copy) stays green: an uncovered line, but not answer-bearing (see the notes).

## Scope item 2: no `.mstack` at any depth in either archive. Met.
- **Code:**
  - The pathspec is `':(exclude,glob)**/.mstack/**'` (`run.mjs:70`).
  - A `find -name .mstack` abort follows it (`run.mjs:72`).
  - Guard: `check.mjs:70`.
- **Git at `a4e6c784`:**
  - 77 tracked `.mstack` paths: 72 at the top level, 5 under `examples/notes-cli/.mstack`.
  - The new pathspec archive lists 0 `.mstack` entries. It holds 113 files, which is the 190 tracked minus 77, so nothing else is dropped.
  - The `':(exclude).mstack'` form I suggested in round 2 still ships `examples/notes-cli/.mstack/`, so switching away from it was right.
- **`fd -H .mstack`:**
  - Default `<scratchpad>/bench-home/versions` (holds only `after-a4e6c784…`): no output.
  - My fresh `BENCH_HOME` with `before` and `after-a4e6c784…`, built by the dry runs: no output.
- **Reverts:** m2a-m2c go red. m2d, which removes only the abort, stays green as expected, because the pathspec never lets a `.mstack` reach the abort.

## Scope item 3: `--permission-mode auto` for every arm. The code is right; the test is missing.
- **Code:**
  - Default `perm: "auto"` (`run.mjs:18`), with validation (`run.mjs:26`).
  - `args` passes `--allowedTools` only for `allowlist`, and `--permission-mode auto` otherwise (`run.mjs:119`).
  - There is a `perm` column (`run.mjs:37,200`).
- **Dry runs (argv read in full):**

  | Run | Argv tail |
  |---|---|
  | `plain` | `… --max-budget-usd 8 --permission-mode auto` |
  | `mstack-before` | `… --plugin-dir <home>/versions/before --permission-mode auto` |
  | `mstack-after` | `… --plugin-dir <home>/versions/after-a4e6c784… --permission-mode auto` |
  | `--perm allowlist` | `--allowedTools 'Read Write …'` and no `--permission-mode` |
  | `--perm bogus` | exit 2 |

  No auto run has `--allowedTools`.
- **Reverts:**
  - m3a and m3d go red.
  - **m3b (`run.mjs:119` restored to round 2's `"--allowedTools", ALLOW.join(" "),`) stays green.** A fake run of that mutant printed `--allowedTools 'Read…` and wrote `perm=auto` in the row.
  - **m3c (the auto branch passes nothing) also stays green.**
- **Cause:**
  - The fake never sees its argv: `testing/fake-claude.sh:4-5` records only `env` and `pwd`.
  - The `perm` column copies the flag (`run.mjs:200`), not what `claude` received.
  - So the three `perm` checks (`check.mjs:68,124,126`) test the option parser, not the command line.

## Requirement to test
| R (scope) | Test | Evidence |
|---|---|---|
| 1a stream and stderr straight to `streams/`, nothing under `BENCH_HOME` | `check.mjs:58,62,67` | m1b red (5 FAIL) |
| 1b full diff, untracked files included | `check.mjs:66,114` | m1c and m1d red |
| 1c run copy deleted, so `runs/` is empty | `check.mjs:61,77` | m1a red; m1e (dry-run copy) green |
| 2 no `.mstack` at any depth in either archive | `check.mjs:70`, plus the abort at `run.mjs:72` | m2a, m2b, m2c red |
| 3a every arm gets `--permission-mode auto` and no `--allowedTools` | **none** | **m3b and m3c green: not covered** |
| 3b `--perm allowlist` is opt-in | `check.mjs:123-126` (column and validation only) | m3a red; the argv is not checked |
| 3c `perm` column | `check.mjs:68,124` | m3a and m3d red |

## Acceptance, quoted
**"every arm runs with --permission-mode auto and no allowlist, so one classifier applies to all arms alike"**
- The code meets it (`run.mjs:119`). I saw rung 4 in dry runs of all three arms.
- No test fails when it is reverted (m3b, m3c). See Changes required 1.
- Whether the real CLI applies `auto` unattended under `env -i` is rung 1, the coordinator's probe.

## Verification I ran
```
$ ./bin/mstack gate                      -> PASSED - 0 failures, 2 warnings (on main; 9 uncommitted)
$ ./bin/mstack gate --full               -> /bin/sh: npm: command not found  [fail]  (no npm/node on PATH; environment, as rounds 1-2)
  legs I could run: bunx --bun tsc --noEmit -> exit 0 ; ./bin/mstack lint-plugin . -> PASSED
                    bun test tests/ (twice) -> 291 pass, 1 fail:
                      tests/gate.test.ts:1618 "every manifest failure shape ..." hung ~608 s, then timed out
                    same test alone: 1 pass, 0 fail [387 ms]
                    tests/ unchanged since 9776e48 (2026-08-23); this item touches only gitignored sandbox/bench.
                    A load-dependent hang, not attributable to this item. Flagged for the coordinator.
$ bun sandbox/bench/verify.mjs           -> pristine visible 18/18; T1 5/9->9/9, T2 0/9->9/9, T3 0/13->13/13,
                                            T4 0/9->9/9, T5 0/5->5/5, T6 0/9->9/9; traces mapped; all checks passed
$ bun sandbox/bench/check.mjs            -> 62 ok, all harness checks passed, exit 0 (13.7 s)
$ BENCH_HOME=<scratch>/rv3/home BENCH_OUT=<scratch>/rv3/out bun run.mjs --arm {plain,mstack-after,mstack-before} --task T3 --rep 1 --dry-run
                                         -> argv as tabled above; plain probe "-> no-mstack"; runs/ empty afterwards
$ fd -H .mstack <scratchpad>/bench-home/versions   -> (no output)
$ fd -H .mstack <scratch>/rv3/home/versions        -> (no output)  [before + after built fresh]
$ ./bin/mstack ledger check benchmark-harness      -> PASS test-verified at a4e6c784 by implementer
mutations (scratch copy; baseline copy: 62 ok, exit 0):
  m1a drop rmSync(dir) after the diff (run.mjs:192)          -> 1 FAIL  check.mjs:61 runs/ not empty
  m1b stream+stderr to $BENCH_HOME/logs (round-2 layout)     -> 5 FAIL  (:58 x3, :62, :67)
  m1c worktree diff without `add -A` (untracked dropped)     -> 1 FAIL  check.mjs:114
  m1d `--stat` instead of the full diff                      -> 1 FAIL  check.mjs:66
  m1e dry run keeps its copy (run.mjs:141)                   -> all passed (uncovered)
  m2a round-2 `git archive <sha>`, abort kept                -> 4 FAIL  (both mstack runs abort; :70)
  m2b round-2 archive, abort removed                         -> 1 FAIL  check.mjs:70
  m2c `:(exclude).mstack`, abort removed                     -> 1 FAIL  check.mjs:70 (examples/notes-cli/.mstack)
  m2d abort removed only                                     -> all passed (expected: pathspec covers it)
  m3a --perm default "allowlist"                             -> 1 FAIL  check.mjs:68
  m3b run.mjs:119 back to round-2 `--allowedTools` always    -> all passed; fake run: argv `--allowedTools 'Read…`, row perm=auto
  m3c auto branch passes nothing                             -> all passed
  m3d perm column removed                                    -> 2 FAIL  check.mjs:68,124
```

## Changes required
1. **`testing/fake-claude.sh:4-5` and `check.mjs:41-60,123-124`: acceptance bullet 5 has no test that fails on revert.**
   - **The gap:** restoring round 2's `run.mjs:119` (m3b) or dropping `--permission-mode auto` (m3c) leaves `check.mjs` green, and the row reads `perm=auto`.
   - **Fix:**
     - When `FAKE_ENV_OUT` is set, have the fake write its argv one per line, e.g. `printf '%s\n' "$@" > "$FAKE_ENV_OUT.argv"`.
     - In the end-to-end loop, assert for each of the three arms that the argv holds `--permission-mode` immediately followed by `auto`, and no `--allowedTools`.
     - In the `--perm allowlist` guard, pass `FAKE_ENV_OUT` and assert the reverse: `--allowedTools` present, `--permission-mode` absent.
   - **Done when:** m3b and m3c both go red.

## Non-blocking notes (outside this round's scope)
1. **Before the batch: answer keys sit one level above the default `BENCH_HOME`.**
   - `lib.mjs:13` puts `DEFAULT_HOME` at `<scratchpad>/bench-home`. A run's `../../..` (cwd `BENCH_HOME/runs/<id>`) and `${CLAUDE_PLUGIN_ROOT}/../../..` both resolve to the session scratchpad.
   - Today the scratchpad holds:
     - copies of every hidden test and reference patch from earlier review and implementer passes (`benchcopy/`, `mut/*/bench/`);
     - solved trees (`ref/`) and round-1 spike copies (`runs/`);
     - two full plugin trees with `.mstack/` (`at-bc66346/`, `parent/`).
   - This is outside item 1's literal scope (`$BENCH_HOME`), and the current harness did not create these files. It is still the same reachable-answer class.
   - I saw the files (rung 4). That an agent would walk three levels up is rung 2.
   - Fix: run the batch with `BENCH_HOME` set to a fresh directory whose ancestors hold nothing (e.g. `mktemp -d /private/tmp/bench-XXXXXX`), or clear the residue.
   - My own mutation copies under `<scratchpad>/rv3/` are deleted after this report.
2. **Interrupted runs.** `rmSync(dir)` runs only on the normal path (`run.mjs:192`). A killed harness or a throw in `score()` leaves the copy in `runs/`, and possibly a `scoring/` dir, as siblings of later runs. The same holds for anything an agent writes outside its cwd, e.g. `git worktree add ../x`: `git.txt` records `worktree list`, but nothing removes the tree. Refusing to start on a non-empty `runs/` would close it.
3. **`run.mjs:190-191` ignores git's exit status.** With a broken or deleted `.git`, the `.diff` is empty and the copy is deleted anyway.
4. **The abort at `run.mjs:72` leaves the partly extracted directory, `.mstack` included, under `versions/`.** Another arm could reach it at `${CLAUDE_PLUGIN_ROOT}/../`. The current pathspec never triggers this. Calling `rmSync(dest)` before exiting would make it fail clean.
5. **`summary.mjs:18` groups by arm only.** A `--perm allowlist` debugging row in `results.tsv` would be averaged in with the `auto` rows.
6. **Optional, stronger version of Changes required 1:** add a column read from `init.permissionMode`. Real init events carry it: the round-1 spike streams show `permissionMode=default`. Every real row would then show the mode `claude` actually applied, not the mode the harness requested.
7. **Stale docs.** `DESIGN.md:97-99,104` still describe the round-1 layout (stream next to the copy, runs under `sandbox/bench/runs`) and the allowlist. `DESIGN.md:16` is current.
8. **Ledger ranking.** The implementer self-recorded `test-verified` at `a4e6c784` (`ledger.tsv:74`), the same SHA as both reviewer rejections. `ledger check` reads PASS, as in rounds 1-2. Because `sandbox/` is gitignored, SHAs cannot tell harness revisions apart.
