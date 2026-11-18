Test commands: a task's tests run with `bun test tests/<file>` and, for the whole file under
node, `node --disable-warning=ExperimentalWarning --experimental-strip-types --test
tests/<file>`. Bun prints ` N pass` then ` 0 fail`; node prints `# fail 0`. "Done when" below
names the file and the tests that must exist in it; each is selected with `-t "<name>"`,
which prints ` 1 pass` when the name matches exactly one test. All tests build a throwaway git
repository with `sandbox({ git: true })` from `tests/helpers.ts:29` (no mocks of git).

## 1. The revert set, the key, the refusals

- [ ] 1.1 Create `src/mutation.ts` with `Entry`, `revertSet(store, from)`, `codeKey(store, from)`
  and `refusals(store, state, item)` as defined in design.md "Shape"; in `src/size.ts` export
  `isCountedCode(store, path)` by moving the `counted` closure out of `measureDiff` (`:138-141`)
  and make `measureDiff` call it, so the size check and the revert set cannot disagree. Test
  in `tests/mutation-set.test.ts`, one test per scenario of R2 (names start `R2 added,
  deleted, modified, renamed`, `R2 binary symlink and mode`), R3 (`R3 tests and docs stay`,
  `R3 store in a subdirectory`, `R3 submodule entry is listed as not reverted`), R4 (`R4 empty
  diff`), R5 (`R5 rebase in progress`, `R5 detached HEAD allowed`, `R5 no obligations`, `R5 no
  base`, `R5 base not a commit`, `R5 not a git repository`), R6 (`R6 dirty tracked file`, `R6
  state file dirty is fine`, `R6 untracked file in the way`, `R6 case-only rename` which skips
  itself when the filesystem is case-sensitive) and R14 (`R14 what voids`, `R14 what does not
  void`, `R14 key is stable across a rebase with no code change`). Done when `bun test
  tests/mutation-set.test.ts` ends ` 0 fail`, `bun test tests/pathclass.test.ts
  tests/gate.test.ts tests/item-size-base.test.ts` still ends ` 0 fail` (the size check is
  unchanged), and the node command for `tests/mutation-set.test.ts` prints `# fail 0`. (covers
  R2, R3, R4, R5, R6, R14)

## 2. The lock, the revert, the restore, the async runner

- [ ] 2.1 In `src/run.ts` add `runCommandAsync(cmd, { cwd, timeoutMs })` returning
  `Promise<RunResult>`: it `spawn`s `src/run-helper.mjs` with the arguments `runCommand` passes
  it (`src/run.ts:93`), output to a temp file, and on the parent's SIGINT, SIGTERM or SIGHUP
  forwards SIGTERM to the helper and awaits it. Test in `tests/run.test.ts`, appended after the
  existing tests (they pin the survivor guarantees and stay untouched): `async: exit code and
  tail match runCommand`, `async: timeout kills the group`, `async: SIGTERM to the parent kills
  the whole group and the promise settles within 3s`, `async: a signal while forking leaves no
  survivor`. Done when `bun test tests/run.test.ts` ends ` 0 fail` with the four new tests
  listed by `bun test tests/run.test.ts -t "async:"` printing ` 4 pass`, and the same file
  under node prints `# fail 0`. (covers R17, R12)

- [ ] 2.2 Create `src/mutation-lock.ts` with `lockPath(store)`, `acquireLock(store, lock)`,
  `readLock(store)`, `applyRevert(store, lock)`, `restoreFromLock(store, lock, hooks?)` and the
  rescue directory, as defined in design.md "Shape" (the lock is linked into place, never
  written in place; one `git restore` per path; unlink for paths the target lacks; the proof
  before the unlink of the lock; the step names `lock-written`, `reverted:<n>`,
  `obligations-running`, `restored:<n>`). Test in `tests/mutation-restore.test.ts`, each
  SIGKILL point as a child process: a new `tests/mutation-holder.ts` runs `acquireLock`,
  `applyRevert` and `restoreFromLock` with a `hooks` that journals `at <step>` and blocks at the
  step named in its argv, as `tests/lock-holder.ts` does for `withLock`, and the test SIGKILLs
  it there: `R15 lock is complete before the first change`, `R15
  linked worktree has its own lock`, `R7 second acquire fails and touches nothing`, `R16 clean
  afterwards: index empty, status as before`, `R16 a tracked file changed by the obligations is
  reported and not overwritten`, `R16 untracked output is listed and left`, `R18 killed with
  nothing reverted`, `R18 killed half reverted`, `R18 killed fully reverted`, `R18 killed half
  restored then restore twice`, `R18 torn file is copied to the rescue directory`, `R19
  read-only directory keeps the lock and the others are restored`, `R20 HEAD moved`, `R18
  unparseable lock is refused with the manual recovery`, `R18 live pid is refused without --force`. Done when `bun test
  tests/mutation-restore.test.ts` ends ` 0 fail` and the node command prints `# fail 0`.
  (covers R7, R15, R16, R18, R19, R20)

## 3. The command, the receipt

- [ ] 3.1 In `src/verification.ts` add `MUTATION_OUTCOMES`, `recordMutation` and `lastMutation`
  (design.md "The receipt"; `receipts()` and `status()` are not changed). Create
  `src/mutation-run.ts` with `runMutation(store, options)` and `classify(result)` and add the
  `verify` case to `main` (`src/cli.ts:72`) with `cmdVerify`: `--mutation`, `--restore`,
  `--timeout <seconds>` (an integer from 1; default 900), exit codes and the `mutation: ` output
  lines of R26 and R27, the signal handlers of R17. Add `verify [--mutation [--timeout S] | --restore [--force]]` to
  `USAGE` (`src/cli.ts:37`) and a `## verify` section to `docs/wiki/The-CLI.md` with the
  transcript of a killed run, a survived run and a restore, each pasted from a real run of
  `./bin/mstack verify ...` in a throwaway repository (the docs rule in CONTRIBUTING.md).
  Test in `tests/mutation-cli.test.ts`, running `bin/mstack` as a child in a throwaway
  repository with a store: `R1 no active item`, `R1 neither flag`, `R8 recorded green counts`,
  `R8 stale green does not count`, `R9 red baseline is blocked and reverts nothing`, `R10
  killed`, `R10 build failure is killed and says so`, `R11 survived lists the paths`, `R12
  script removed by the revert is blocked`, `R12 hang is blocked at --timeout 2`, `R13 row has
  six cells and no verification receipt is added for the reverted run`, `R13 a mutation row does
  not satisfy status()`, `R17 SIGTERM mid-run`, `R17 SIGINT twice during restore`, `R17 SIGHUP
  during the baseline`, `R26 lines in order`, `R27 run counts`, `R27 exit codes`, `R6 tree moved
  during the baseline`. Done when `bun test tests/mutation-cli.test.ts` ends ` 0 fail`, `bun
  test tests/verification.test.ts` ends ` 0 fail`, `node scripts/check-doc-links.mjs
  docs/wiki/The-CLI.md` prints no error, and the node command prints `# fail 0`. (covers R1,
  R5, R6, R8, R9, R10, R11, R12, R13, R17, R26, R27)

## 4. The closing checks, the gate, the hook

- [ ] 4.1 In `src/closing.ts` add `MUTATION_CHECK = "mutation"` and `MUTATION_LOCK_CHECK =
  "mutation-lock"` to `CLOSING_CHECKS` (design.md "The closing checks"); in `src/gate.ts` add a
  `checkMutationLock` line to the `workspace` section (it runs with no active item) and make
  `runVerification` (`src/gate.ts:739`) return a failure and run nothing while the lock exists;
  in `src/cli.ts` add `FORCED_MUTATION` and make the marker a function of the set of overridden
  checks (`src/cli.ts:226-231,646-649`), keeping every marker in `FORCED_MARKERS`. Add the
  gate and closing-check rows to `docs/wiki/Gates-and-Hooks.md` ("What `mstack gate` checks")
  with real output pasted from `./bin/mstack gate` at an item with no row and at a lock. Test
  in `tests/closing.test.ts` and `tests/state-cli.test.ts`: `R23 no row at verifying`, `R23
  killed turns it green`, `R23 later survived wins`, `R23 obligations changed`, `R23 code edited
  after the run`, `R14 docs commit after the run does not void`, `R24 no base`, `R24 size s`,
  `R24 only tests changed`, `R24 base not found is not overridable`, `R22 lock fails the gate
  with no active item`, `R22 gate --full runs nothing under a lock`, `R22 done refuses under a
  lock even with --force`, `R22 the Stop hook carries the line`, `R25 forced close records the
  marker`, `R25 marker survives a later --closed-by`, `R25 no --closed-by is refused`, `R25 two
  overridden checks name both`. Done when `bun test tests/closing.test.ts
  tests/state-cli.test.ts tests/gate.test.ts` ends ` 0 fail` and the node command for the same
  files prints `# fail 0`; and `./bin/mstack gate --quiet` at this repository, once this item is
  closed or has a killed row, exits 0. (covers R22, R23, R24, R25, R14)

- [ ] 4.2 In `src/hooks.ts` extend `preToolUse` (`:537`) with the lock branch of design.md
  "The hook"; add the row to the "What PreToolUse denies" table in
  `docs/wiki/Gates-and-Hooks.md` (`:83`) saying what it catches and what it does not (aliases,
  `git-commit`, interpreters). Test in `tests/hooks.test.ts`: `R21 shapes caught` (the five
  commands of the scenario, each with a lock file in a throwaway git directory), `R21 not
  caught, allowed`, `R21 no lock allows`, `R21 unrelated command spawns no git` (the test points
  `PATH` at a directory whose `git` writes a marker file, and asserts the marker is absent),
  `R21 git cannot answer allows`, `R21 reason names verify --restore`. Done when `bun test
  tests/hooks.test.ts` ends ` 0 fail` and the node command prints `# fail 0`. (covers R21)

## 5. Verification and close

- [ ] 5.1 `bun run test && bun run typecheck && ./bin/mstack lint-plugin . && node
  scripts/check-doc-links.mjs README.md docs/wiki/*.md` all exit 0. Then the seams of item 42
  by hand in a throwaway repository, outputs pasted into the implementation report: `verify
  --mutation` killed, survived and blocked with the row each wrote; `kill -9` of the process
  mid-run then `gate --quiet`, a denied `git commit`, `verify --restore`, `git status
  --porcelain` identical to before; `gate` and `state set --status done` with and without a
  killed row and with a lock. Record the R-to-test table of the implementation report with
  `| R | Test | Where |` rows for R1-R27 (item 41's format).
- [ ] 5.2 Independent review by a pass that did not write the code, which must try first to
  leave a tree reverted: a SIGKILL at each named step, a read-only directory, a second process,
  a commit with an alias.
- [ ] 5.3 PR, merge gate, close; item 42 has no size, which is "a size other than `s`", so once
  this check ships it closes on a `mutation-killed` receipt from its own command, or on a
  forced close that says why.
