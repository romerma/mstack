# Implementation, item 42 `mutation-check`, stage 1 of 4

Implementer by hand (the plugin is not loaded), from `agents/implementer.md`. Scratch:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl42s1/`,
written `S/` below.

## What changed

Part A wrote the 17 findings of `spec_review_mutation-check_r3.md` into the spec: `spec.md`,
`design.md`, `tasks.md`, plus `src/worktree.ts` in `proposal.md`'s Impact list, which N2 asks
for. The spec still has 28 requirements. The tasks now name 157 tests (144 before). Part B is
task group 1. `scopeClass` moves out of `measureDiff` into an export of `src/size.ts`. The new
`src/mutation.ts` holds `revertSet`, `mutationKey`, `lockPath` and `refusals`: R1's checks
that need no staging, R2's checks before the baseline, R3, R4 and R5. `src/git.ts` gains
`gitBytes`, which R3's name test needs. Group 1 only reads: nothing in it writes to a working
tree, takes a lock or makes a run directory. One departure from the design, now written into
`design.md`: the raw diffs use `--no-abbrev`. With `--full-index`, `--raw` prints 7-digit blobs
(`S/raw/raw-exp.out`).

### Part A, finding by finding

Each finding was checked before it was applied. All 17 hold.

| N | Checked against | Landed in |
|---|---|---|
| 1 | `specreview42r3/hcopy` (both runtimes) | Terms H(p); design prepareRun; R11 scenario; test in 2.2 |
| 2 | `specreview42r3/wt`; `src/worktree.ts:79,131` | R28 text and scenario; design gate and hook, trade-offs; test in 4.1; proposal Impact |
| 3 | `tests/hooks.test.ts:276-286` against R26's pattern | task 4.2 |
| 4, first way | `specreview42r3/groupkill` | R16 text and scenario; design async runner and state row; test in 2.4 |
| 5 | design restore table, "anything else" row, against R11's scenario | R11 text and scenario; design Revert (`written`), Restore (`entries`), run step 9; test in 3.1 |
| 6 | `src/git.ts:61-76` decodes with replacement | R3 scenario; design sets and refusals; test in 1.3 |
| 7 | fold sweep re-run with the new fold: 2,533 collisions, 0 missed, node and bun (`S/fold/fold-sweep.out`) | design refusals |
| 8 | `specreview42r3/dircase` | R15 text and scenario; design restore; test in 2.3 |
| 9 | `specreview42r3/window` | R11, R14, R25 text and scenarios; design revert, restore, "cannot be made safe" 1, Usage; tests in 2.2 and 2.3; 3.4 test and wiki |
| 10 | git semantics: reset moves the checked-out branch | R8 (lock field), R19 text and scenario; design Lock, run step 12, state row; test in 3.2 |
| 11 | the review's two-host walk | R23 text and scenario; design liveness table (host first, `etime`); 2.1 tests; 3.4 wiki |
| 12 | design restore table walked after a `git stash` | R15 text and scenario; design state row, restore, By hand 1 |
| 13 | task 3.3's list | R17 scenario; test in 3.3 |
| 14 | R2's second check is tracked-only, and R18 (e) compares with K0 taken after the baseline | R2 text and scenario; design run steps 2, 4, 5; test in 3.1 |
| 15 | design.md By hand 3 | design |
| 16 | R4's text (merges only), ignored files, R18 (a) | design trade-offs |
| 17 | `src/hooks.ts:399` (the store's `rm` guard) | R26 text and scenario; design hook; test in 4.2 |

Choices the findings left open, each recorded with `mstack decide`:

- **N5:** `applyRevert` returns `written`, and `restoreFromLock` takes `entries`.
- **N9:** after a change at the re-check, the restore decides once more. A second change is
  an R15 failure, so the loop cannot run forever.
- **N10:** a lock taken on a detached HEAD names `git switch --detach <lock HEAD>`.
- **N17:** the `rm` guard reads no lock, so its reason does not name `verify --restore` (R25).

Counts per task after Part A: 1.1 11, 1.2 16, 1.3 13, 2.1 12, 2.2 10, 2.3 19, 2.4 10, 3.1 18,
3.2 12, 3.3 9, 3.4 11, 4.1 8, 4.2 8.

**Findings not applied:** none.

## Files

- `.mstack/specs/mutation-check/{spec,design,tasks,proposal}.md` (Part A; design also for `--no-abbrev`; tasks 1.1 to 1.3 ticked)
- `src/size.ts` (`scopeClass`), `src/git.ts` (`gitBytes`, shared `gitEnv`), `src/mutation.ts` (new)
- `tests/mutation-set.test.ts`, `tests/mutation-refusals.test.ts`, `tests/mutation-shapes.test.ts` (new)
- `.mstack/decisions.tsv` (4 rows), `.mstack/ledger.tsv` (the verdict row, keyed to `01a816c`, where the checks ran), `.mstack/progress/current.md`

Commits: `75d4b88` (Part A), `c0506e6` (1.1), `eec2ffa` (1.2), `01a816c` (1.3), then this report.

## Commands

Red first. The code each task's tests ran against: a stub returning an empty set and a
constant key (1.1); a stub `refusals` returning null (1.2); 1.2's code, with no R3 or R4 (1.3).
Full output: `S/red-1.1.txt`, `S/red-1.2.txt`, `S/red-1.3.txt`.

```
$ bun test tests/mutation-set.test.ts          # 1.1, against the stub
AssertionError: Expected "actual" to be strictly unequal to: ''
(fail) R21 a store in a subdirectory has a key that a test edit changes [169.72ms]
 2 pass
 9 fail
$ bun test tests/mutation-refusals.test.ts     # 1.2, against the stub
AssertionError: expected a refusal matching /src\/run-helper\.mjs/, got none
(fail) R5 a revert path inside the running CLI is refused with the copy commands, and not from a copy [218.58ms]
 2 pass
 14 fail
$ bun test tests/mutation-shapes.test.ts       # 1.3, against 1.2's code
AssertionError: expected a refusal matching /058175cd/, /463aabcd/, /not the item's/, /rebase/, /--base <commit>/, got none
(fail) R4 a sibling branch merged in after a fork-point start [582.30ms]
 3 pass
 10 fail
```

Seven tests passed in the red phase, and each is a guard against a wrong answer. Mutants
show that each one can fail:

| Test | Mutants that make it fail |
|---|---|
| 1.1, docs or store commit | M7, M21, M22 |
| 1.1, rebase | M22 |
| 1.2, detached HEAD | M19 |
| 1.2, dirty store files | M20 |
| 1.3, plain files | M16 |
| 1.3, the two R4 "not refused" tests | M13, M14, M16 |

The first test run of 1.1 against the real code failed 11 of 11 on the parser. That is what
found `--full-index`.

Mutants: 26 applied to `src/mutation.ts` and `src/size.ts`. Each was run against the test files
that own it (bun), and each file was restored after its run. The runner is `S/mutants/mutants.sh`
and the output is `S/mutants/mutants.out`. After the last run, `git diff --quiet` of both files
was clean.

| Mutant | Result | Killed by |
|---|---|---|
| M1 a refusal removed: the lock | killed | R1 an existing lock is refused naming its pid |
| M2 a refusal removed: dirty tracked files | killed | R2 a dirty tracked file |
| M3 a refusal removed: an operation in progress | killed | R1 a rebase in progress |
| M4 a refusal removed: R5 | killed | R5 a revert path inside the running CLI ... |
| M5 a refusal removed: R2's working-tree entries | killed | the four R2 working-tree tests |
| M6 a class test inverted (set keeps non-code) | killed | 13 tests, R10 x3 and R9 among them |
| M7 a class test inverted (store dir not excluded, `scopeClass`) | killed | R10 x2, R21 docs or store commit |
| M8 a path left out of the set: added files | killed | R9 records modes and blobs; R10 store in a subdirectory |
| M9 a path left out of the set: deleted files | killed | R9; R2 untracked file, case variant, symlink |
| M10 an untracked file let into the set | killed | R10 an untracked code file; R1 an empty revert set |
| M11 the fold weakened: round 2's fold (no first `toLowerCase`) | killed | R3 a case-only rename (its `ẞ`/`ss` case) |
| M12 the fold weakened: no normalisation | killed | R3 a normalisation-only rename |
| M13 the merge rule's ancestor test inverted | killed | R4 x3 |
| M14 the merge rule reads the first parent too | killed | R4 x3 |
| M15 R3's file/directory test without its prefix half | killed | R3 file to directory, directory to file |
| M16 R3's prefix test without its slash | killed | R3 plain files, R4 x4, R3 case and normalisation |
| M17 R3's mode test removed | killed | R3 symlink, R3 submodule |
| M18 R3's name test without the UTF-8 half | killed | R3 a name with a newline, and one that is not UTF-8 |
| M19 a detached HEAD refused | killed | R1 a detached HEAD is allowed |
| M20 dirty store files not excluded | killed | R2 dirty store files are allowed |
| M21 the key keeps docs and the store | killed | R21 a docs or store commit does not change the key |
| M22 the key holds HEAD's sha | killed | R21 code or test edit; docs or store commit; rebase |
| M23 the key ignores the mode | killed | R21 an executable bit changes the key |
| M24 the key ignores the working tree | killed | R21 x3 |
| M25 the key drops untracked files | killed | R21 x3 |
| M26 the lock path outside the git dir | killed | R1 an existing lock is refused naming its pid |

Before M11 was run, I added the `ẞ`-to-`ss` rename to `R3 a case-only rename`. Without it, M11
survives: the `Foo`/`foo` case folds equal under both folds. That is reasoning, not a run (rung 3).

Checks, at the commit before this report (`01a816c`):

```
$ bun run typecheck                     # exit 0, no diagnostics
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ bun test ./tests                      # test:bun of `bun run test`; S/suite-bun.txt
 931 pass
 0 fail
Ran 931 tests across 46 files. [256.20s]
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'   # S/suite-node.txt
ℹ tests 931
ℹ pass 931
ℹ fail 0
$ bun test tests/item-size-base.test.ts tests/gate.test.ts    # 1.1: the size check is unchanged
 143 pass
 0 fail
```

Both suites ran once each with no failure, so no file was rerun. The three new files have 40
tests and none was skipped: this disk is case-insensitive, so the two case-only tests ran.

## R to test

Stage 1 implements R3 and R4 in full, and its own parts of R1, R2, R5, R9, R10 and R21. Each
row names the tasks that implement the rest. Stage numbers follow the plan row: 2 is group 2,
3 is group 4, 4 is group 3.

| R | Test | Where |
|---|---|---|
| R1 | refusals with no staging: no active item, not a repository, no base or a bad one, start lost, no obligations, a rebase, a detached HEAD allowed, a lock, an empty set (later: 2.1 an unreadable start blob; 3.4 the flags) | tests/mutation-refusals.test.ts:101, tests/mutation-refusals.test.ts:109, tests/mutation-refusals.test.ts:120, tests/mutation-refusals.test.ts:130, tests/mutation-refusals.test.ts:146, tests/mutation-refusals.test.ts:156, tests/mutation-refusals.test.ts:167, tests/mutation-refusals.test.ts:178, tests/mutation-refusals.test.ts:194 |
| R2 | before the baseline: dirty tracked file, dirty store allowed, untracked in the way, case variant, path under another case, symlink parent (later: 3.1 the checks after the baseline) | tests/mutation-refusals.test.ts:209, tests/mutation-refusals.test.ts:222, tests/mutation-refusals.test.ts:235, tests/mutation-refusals.test.ts:249, tests/mutation-refusals.test.ts:263, tests/mutation-refusals.test.ts:276 |
| R3 | symlink, submodule, file to directory, directory to file, case-only, normalisation-only, parent case, plain not refused, newline and not UTF-8 | tests/mutation-shapes.test.ts:90, tests/mutation-shapes.test.ts:103, tests/mutation-shapes.test.ts:112, tests/mutation-shapes.test.ts:127, tests/mutation-shapes.test.ts:139, tests/mutation-shapes.test.ts:161, tests/mutation-shapes.test.ts:178, tests/mutation-shapes.test.ts:191, tests/mutation-shapes.test.ts:208 |
| R4 | main merged after a base on the branch, a sibling after a fork-point start, main after a fork-point start allowed, a rebase allowed | tests/mutation-shapes.test.ts:229, tests/mutation-shapes.test.ts:248, tests/mutation-shapes.test.ts:267, tests/mutation-shapes.test.ts:284 |
| R5 | the refusal and its copy commands, not from a copy (later: 3.4 the CLI) | tests/mutation-refusals.test.ts:295 |
| R6 | the baseline | n/a: implemented in stage 4 (task 3.1) |
| R7 | a red or slow baseline | n/a: implemented in stage 4 (task 3.1) |
| R8 | the lock | n/a: implemented in stage 2 (task 2.1) |
| R9 | the set records each path's start and HEAD mode and blob (later: 2.1 and 2.2 the staging and the revert) | tests/mutation-set.test.ts:119 |
| R10 | tests, docs and store not in the set; a subdirectory store; untracked code not in it (later: 2.2 the revert touches nothing else) | tests/mutation-set.test.ts:72, tests/mutation-set.test.ts:91, tests/mutation-set.test.ts:106 |
| R11 | a revert that cannot complete | n/a: implemented in stage 2 (task 2.2) and stage 4 (task 3.1) |
| R12 | the outcome | n/a: implemented in stage 2 (task 2.4) and stage 4 (task 3.1) |
| R13 | restore and proof | n/a: implemented in stage 2 (task 2.3) |
| R14 | restore writes only over the run's writes | n/a: implemented in stage 2 (task 2.3) |
| R15 | a failed restore keeps the lock | n/a: implemented in stage 2 (task 2.3) and stage 4 (tasks 3.2, 3.4) |
| R16 | signals during an obligation | n/a: implemented in stage 2 (task 2.4) and stage 4 (task 3.3) |
| R17 | nothing interrupts a revert or a restore | n/a: implemented in stage 2 (task 2.3) and stage 4 (task 3.3) |
| R18 | no receipt when the tree changed | n/a: implemented in stage 4 (task 3.2) |
| R19 | the report of other changes | n/a: implemented in stage 4 (task 3.2) |
| R20 | the receipt row | n/a: implemented in stage 4 (task 3.1) |
| R21 | the key: code or test edit, new file, committed untracked test, executable bit, docs or store commit, rebase, subdirectory store (later: 3.1 the run's own key) | tests/mutation-set.test.ts:167, tests/mutation-set.test.ts:188, tests/mutation-set.test.ts:206, tests/mutation-set.test.ts:218, tests/mutation-set.test.ts:234, tests/mutation-set.test.ts:254, tests/mutation-set.test.ts:281 |
| R22 | verify --restore | n/a: implemented in stage 2 (task 2.3) and stage 4 (task 3.4) |
| R23 | liveness | n/a: implemented in stage 2 (task 2.1) and stage 4 (task 3.4) |
| R24 | the lock checked before a restore | n/a: implemented in stage 2 (task 2.1) and stage 4 (task 3.4) |
| R25 | the absolute restore command | n/a: implemented in stage 3 (tasks 4.1, 4.2) and stage 4 (task 3.4) |
| R26 | the hook | n/a: implemented in stage 3 (task 4.2) |
| R27 | the gate under a lock | n/a: implemented in stage 3 (task 4.1) |
| R28 | the rescue warning, prune | n/a: implemented in stage 3 (task 4.1) |

Rung: R1 to R5, R9, R10 and R21, as far as group 1 implements them, are at rung 4. The tests
call the real functions in real git repositories on macOS APFS, which is case-insensitive.
Neither Linux nor a case-sensitive disk was run.

## For the next stage (group 2), not in the spec

- **`revertSet`'s shape.** It returns `{ entries, diffPaths, notUtf8 }`. An entry is `{ path,
  startMode, startBlob, headMode, headBlob }`. Modes are six-digit strings, and an absent side
  is `000000` with 40 zeros. Paths are relative to the store's root.
- **`mutationKey`'s shape.** It returns `{ key } | { key: null, reason }`, with no per-path
  lines yet. Two later checks have to name paths: R2's key check after the baseline (N14, task
  3.1) and R18 (e). For them, extend it to return its lines.
- **A gap in the key.** A key-set path whose name is not UTF-8 is read lossily, so the key
  cannot see that file's content. The spec does not cover this, and the reviewer should judge it.
- **The lock refusal does not call `liveness` yet** (task 2.1). It names the pid, the start time
  and `<lock cli> verify --restore`, conditionally. R1's scenario asks whether the run is alive,
  and for the restore command only when it is not. Wire `liveness` in.
- **Exact names are implemented twice for now.** R2's check has its own helpers in
  `src/mutation.ts` (`listsExactly`, `nameOnDisk`). Task 2.2's `entryAt` should become the one
  implementation.
- **`git rev-parse --git-path` prints an absolute path in a linked worktree** and a relative one
  elsewhere (`S/gitpath/gitpath-exp.out`). Resolve its output against the store's root; do not
  join it.
- **The node test reporter.** Node 26 prints `ℹ fail 0` where tasks.md says `# fail 0`.
- **Gaps with no named test.** The cap of ten paths per message, R21's null cases, and an
  operation in progress in a linked worktree.
- **A gap N11 leaves.** A forward step of the wall clock past 60 s still makes a live run look
  dead. The rule judges reuse by a start that is computed from the clock. This is a rung 3 walk,
  and it does not lose data (the review's section 3).
