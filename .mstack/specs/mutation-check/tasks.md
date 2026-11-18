How every task below is checked. A task's tests run with `bun test tests/<file>`, which ends
with ` N pass` and ` 0 fail` when they pass, and, for the same file under node, with
`node --disable-warning=ExperimentalWarning --experimental-strip-types --test tests/<file>`,
which prints `# fail 0`. `bun test tests/<file> -t "<pattern>"` runs the tests whose names
match the pattern (a regular expression; `^R14 ` selects the names that start with it) and
prints ` N pass` for N of them. `bun run typecheck` exits 0 after every task. Every test
builds a throwaway git repository with `sandbox({ git: true })` from `tests/helpers.ts:29` (no
mocks of git), and a test that spawns a process kills it and its group in `finally`. Names used below (`scopeClass`, `refusals`, `prepareRun`, the step names, and so
on) are defined in design.md "Shape", which is in this directory.

## 1. What is reverted, the key, and the refusals (reads only)

- [ ] 1.1 In `src/size.ts`, export `scopeClass(store)` by moving the `counted` closure out of
  `measureDiff` (`src/size.ts:137-141`) so that it returns a path's class or `null` under the
  store directory, and make `measureDiff` count `scopeClass(store)(path) === "code"`. Create
  `src/mutation.ts` with `codeDiff(store, from)`, `revertSet(store, from)` (returning `{
  entries: SetEntry[]; submodules: string[] }`) and `mutationKey(store, from)` as design.md "The
  three sets and the key" defines them. Tests in a new `tests/mutation-set.test.ts`: `R3 tests and
  docs are not in the revert set`, `R3 store in a subdirectory`, `R3 an untracked code file is
  not in the revert set`, `R3 a submodule entry is listed as not reverted`, `R4 the code diff is
  empty when only tests and docs changed`, `R4 the code diff is empty when the only code is
  untracked`, `R14 a code edit voids, committed or not`, `R14 a test edit voids, committed or
  not`, `R14 a new code or test file voids`, `R14 committing an untracked test file voids`, `R14
  an executable bit voids`, `R14 a docs or store commit does not void`, `R14 a rebase with no
  code or test change does not void`, `R14 a store in a subdirectory has a key that a test edit
  changes`. Done when `bun test tests/mutation-set.test.ts` ends ` 14 pass` and ` 0 fail`,
  `bun test tests/pathclass.test.ts tests/item-size-base.test.ts tests/gate.test.ts` ends
  ` 0 fail` (the size check is unchanged), and the node command for `tests/mutation-set.test.ts`
  prints `# fail 0`. (covers R3, R4, R14)

- [ ] 1.2 In `src/mutation.ts`, add `lockPath(store)` and `refusals(store, state, item,
  running)` (with `running` defaulting to `runningCliRoot()` from `src/paths.ts:99`) checking in
  the order design.md "Refusals" gives, each returning `{ message, fix }` with the fix text the
  requirement names. Tests in a new `tests/mutation-refusals.test.ts`; each asserts the message,
  and that no lock, no `<git dir>/mstack-mutation/` directory and no new `verification.tsv` row
  exist afterwards: `R4 an empty code diff is refused naming the start`, `R5 rebase in progress`,
  `R5 detached HEAD is allowed`, `R5 no obligations`, `R5 no base`, `R5 base not a commit`, `R5
  not a git repository`, `R5 start lost`, `R6 dirty tracked file`, `R6 state and progress files
  dirty are fine`, `R6 untracked file in the way`, `R6 directory with an untracked file in the
  way`, `R6 untracked symlink at a parent`, `R6 case-only rename` (it skips itself when the
  filesystem is case-sensitive: a file written as `probe` is not found as `PROBE`), `R7 an
  existing lock is refused naming its pid`, `R28 a revert path inside the running CLI is refused
  with the copy commands, and not from a copy` (it passes the sandbox root as `running`, then a
  directory outside it), `R33 a merge after the base is refused naming --base`, `R33 a rebased
  branch is not refused`, `R33 a fork-point start after merging main is not refused`. Done when `bun test tests/mutation-refusals.test.ts` ends
  ` 19 pass` and ` 0 fail`, and the node command prints `# fail 0`. (covers R4, R5, R6, R7, R28,
  R33)

## 2. The run directory, the lock, the revert, the restore, the async runner

- [ ] 2.1 In `src/git.ts`, add `gitBytes(store, args): Buffer | null` with the environment and
  timeout of `git()` (`src/git.ts:61-76`) and no decoding. Create `src/mutation-lock.ts` with the
  `Identity`, `LockEntry` and `Lock` types, `prepareRun(store, from, set)`, `acquireLock(store,
  lock)`, `readLock(store)`, `validateLock(store, lock)`, `sweepStale(store, lock)` and the lock's
  script text (design.md "Identities and the run directory" and "The lock"). Create
  `tests/mutation-holder.ts`, a child process in the style of `tests/lock-holder.ts`: argv `<store
  root> <journal> <phase> <blockAt> <release>`; phase `acquire` runs `prepareRun` and
  `acquireLock`, appending `at <step>` to the journal at each step and blocking at `blockAt`
  until the file `<release>` exists. Tests in a new `tests/mutation-lock.test.ts`: `R15 the lock
  is complete and parseable before the first write`, `R15 a linked worktree has its own lock`,
  `R15 leftovers of a killed acquire are removed by the next sweep` (SIGKILL of the holder at
  `prepared`), `R7 a second acquire fails and writes nothing`, `R7 two processes acquire at once
  and one wins` (two holders released together), `R31 the lock names every path in its recovery
  commands`, `R43 a lock path that is absolute or has a .. or .git segment is refused`, `R5 an
  unreadable start blob leaves no run directory`. Done when `bun test
  tests/mutation-lock.test.ts` ends ` 8 pass` and ` 0 fail`, and the node command prints
  `# fail 0`. (covers R5, R7, R15, R31, R43)

- [ ] 2.2 In `src/mutation-lock.ts`, add `applyRevert(store, lock, step?)` as design.md "Revert"
  defines it, returning `{ ok: true }` or `{ ok: false, path, reason }`. Tests in a new
  `tests/mutation-revert.test.ts`, each reading the tree right after `applyRevert` returns: `R2
  added, deleted, modified, renamed`, `R2 binary, symlink and mode`, `R2 a file that became a
  directory, and a directory that became a file`, `R2 line endings are the start's as checked out
  here` (a `.gitattributes` with `*.txt text eol=crlf`), `R2 the index is not touched`, `R3
  untracked, test and doc files are byte-identical after the revert`, `R34 a path that cannot be
  written stops the revert` (a read-only directory; the result names it and the `EACCES` code).
  Done when `bun test tests/mutation-revert.test.ts` ends ` 7 pass` and ` 0 fail`, and the node
  command prints `# fail 0`. (covers R2, R3, R34)

- [ ] 2.3 In `src/mutation-lock.ts`, add `restoreFromLock(store, lock, step?)` as design.md
  "Restore" defines it (its table, its order, the proof, then the lock and the run directory).
  Extend `tests/mutation-holder.ts` with phase `run`: `prepareRun`, `acquireLock`, `applyRevert`,
  step `obligations-running`, `restoreFromLock`, journalling and blocking as in phase `acquire`,
  and, when argv has a sixth argument `nogit`, setting `process.env.PATH` to a directory whose
  `git` writes a marker file before calling `restoreFromLock`. Tests in a new
  `tests/mutation-restore.test.ts`: `R16 clean afterwards: status as before, index empty, lock and
  run directory gone`, `R16 a changed tracked file outside the set does not keep the lock`, `R16
  a git add during the run does not keep the lock`, `R18 killed with the lock written and nothing
  reverted`, `R18 killed half reverted`, `R18 killed fully reverted`, `R18 killed half restored,
  then restored twice` (each SIGKILLs the holder at its step, then calls `restoreFromLock` on
  `readLock`), `R19 a read-only directory keeps the lock and the other paths are restored`, `R20
  HEAD moved: restored to the lock's HEAD and the lock removed`, `R30 an edit to a reverted file
  is moved to the rescue directory first`, `R30 a directory holding a file is left and keeps the
  lock`, `R30 a second incident gets its own run directory`, `R30 a symlinked parent is left and
  keeps the lock`, `R31 sh on the lock restores a killed run with git alone` (SIGKILL at
  `obligations-running`, then `sh <lock>`), `R35 the restore starts no child process` (the
  `nogit` holder; the marker file must not exist). Done when `bun test
  tests/mutation-restore.test.ts` ends ` 15 pass` and ` 0 fail`, and the node command prints
  `# fail 0`. (covers R16, R18, R19, R20, R30, R31, R35)

- [ ] 2.4 In `src/run.ts`, add `runCommandAsync(cmd, { cwd, timeoutMs, tailLines? })` returning
  `{ result: Promise<RunResult>; stop(): void }` as design.md "The async runner" defines it. The
  existing tests in `tests/run.test.ts` pin the survivor guarantees of the timed path and stay
  untouched; the new runner is held to each of them. Append to `tests/run.test.ts`: `async: exit
  code, signal and tail match runCommand`, `async: a timeout reports timedOut, code null and
  SIGKILL within a bound`, `async: the whole group dies on timeout, under dash too`, `async: the
  command leads its own process group`, `async: the tail is only the command's output`, `async: a
  background grandchild holding the output does not keep it pending`, `async: a command that
  cannot start gives code null and an error`, `async: timeoutMs must be an integer from 1 to
  2^31-1`, `async: a timeout kills children being forked`, `async: does not load the target
  directory's bunfig.toml or .env`, `async: a SIGINT to the caller's group takes the command
  down` (signal sent with `process.kill(-pid)`, as `tests/run.test.ts:237` does), `async: a
  SIGINT while the command is forking leaves no survivor`, `async: stop() kills the whole group
  and the promise settles within 3s`, `async: a signal handler in the caller runs while the
  command runs`. Done when `bun test tests/run.test.ts -t "^async: "` prints ` 14 pass`, `bun test
  tests/run.test.ts` ends ` 0 fail`, and the node command for the file prints `# fail 0`.
  (covers R12, R17)

## 3. The receipt, the run, the command

- [ ] 3.1 In `src/verification.ts`, add `MUTATION_OUTCOMES`, `recordMutation(store, row)` and
  `mutationStanding(store, slug, key, command)` (design.md "The receipt"); `receipts()` and
  `status()` are not changed. Tests appended to `tests/verification.test.ts`: `R13 a mutation row
  has six cells and a mutation: tree`, `R13 receipts() and status() ignore mutation rows`, `R13 a
  file written before this feature reads unchanged`, `R23 standing: the last killed or survived
  row decides`, `R23 standing: a later blocked row does not void a killed one`, `R23 standing:
  rows at another key or with another command`. Done when `bun test tests/verification.test.ts -t
  "^R13 "` prints ` 3 pass`, `-t "^R23 standing"` prints ` 3 pass`, the file ends ` 0 fail`, and
  the node command prints `# fail 0`. (covers R13, R23)

- [ ] 3.2 Create `src/mutation-run.ts` with `runMutation(store, options)` and `classify(result)`
  as design.md "The run" (steps 1 to 7 and 9 without the signal paths) and "Classifying a
  reverted-tree run" define them. Tests in a new `tests/mutation-run.test.ts`, calling
  `runMutation` in-process with `out` collecting lines and an obligation that is a shell script
  under `tests/` of the sandbox (a test path, so never reverted) that checks the content of
  `src/a.ts`: `R8 a recorded green counts as the baseline`, `R8 a stale green does not count`,
  `R6 the tree moved during the baseline` (the script commits on its first run), `R9 a red
  baseline is blocked and reverts nothing`, `R9 a baseline timeout records no failed receipt`,
  `R10 killed`, `R10 a build failure is killed and says so`, `R10 an exit of 128+n is killed and
  names the signal`, `R11 survived lists the paths`, `R12 a script removed by the revert is
  blocked`, `R12 a hang is blocked at the timeout`, `R13 no row after a failed restore`, `R14 the
  run does not move its own key`, `R27 run counts`, `R34 a revert that cannot complete runs no
  obligation and is blocked`. Done when `bun test tests/mutation-run.test.ts` ends ` 15 pass` and
  ` 0 fail`, and the node command prints `# fail 0`. (covers R6, R8, R9, R10, R11, R12, R13, R14,
  R27, R34)

- [ ] 3.3 In `src/mutation-run.ts`, add the "changed under the run" detection and the report
  (design.md "The run", steps 6 to 9: R29 (a) to (d), R20's line, R32's lines). Tests appended to
  `tests/mutation-run.test.ts`, each making its change from the `step` callback at
  `obligations-running`: `R29 an edit to a reverted file during the run`, `R29 a commit during
  the run`, `R29 a forced restore under the run writes nothing more`, `R29 a tracked test file
  rewritten during the run`, `R29 a git add during the run`, `R20 the HEAD-moved line names both
  shas and git reset --soft`, `R32 left in place and changed files are reported without a cause`.
  Done when `bun test tests/mutation-run.test.ts -t "^R29 "` prints ` 5 pass`, the file ends
  ` 0 fail`, and the node command prints `# fail 0`. (covers R13, R20, R29, R32)

- [ ] 3.4 In `src/mutation-run.ts`, add the signal handling of design.md "The run" step 2 (handlers
  before anything is written, `stop()` of the running obligation, acting only after the restore,
  EPIPE swallowed by `out`). Create `tests/mutation-run-holder.ts`, a child process that runs
  `runMutation` on the sandbox given in argv with a `step` that journals and, at the step named in
  argv, blocks synchronously (`Atomics.wait`) until a release file exists. Tests in a new
  `tests/mutation-signals.test.ts`, each spawning the holder with `detached: true` so that it
  leads its own group and the signal can go to the whole group: `R17 SIGTERM to the mstack process
  alone during the obligations`, `R17 SIGINT to the whole process group during the obligations`,
  `R35 SIGINT to the group during the restore does not interrupt it` (blocked at `restored:1`,
  signalled, released), `R35 SIGINT twice during the restore`, `R35 SIGTERM just after the lock is
  taken` (blocked at `lock-written`), `R36 SIGHUP during the baseline touches nothing`. Each
  asserts the exit code, `git status --porcelain` against the one taken before, no lock, no row,
  and no survivor (`pgrep -f` of a marker in the obligation, as `tests/run.test.ts:158-161`
  does). Done when `bun test tests/mutation-signals.test.ts` ends ` 6 pass` and ` 0 fail`, and the
  node command prints `# fail 0`. (covers R17, R35, R36)

- [ ] 3.5 In `src/cli.ts`, add `case "verify"` to `main` (`src/cli.ts:72-107`) and `cmdVerify`:
  `--mutation [--timeout <seconds>]` (an integer from 1 to 2147483, default 900) calling
  `runMutation`; `--restore [--force]` calling `sweepStale`, `readLock`, `validateLock`, the pid and
  host check of R38, then `restoreFromLock`; the exit codes of R27 and the output lines of R26.
  Add `verify --mutation [--timeout S] | --restore [--force]` to `USAGE` (`src/cli.ts:37`) with a
  line for exit 3. Add a `## verify` section to `docs/wiki/The-CLI.md` with the transcripts of a
  killed run, a survived run and a `--restore` after `kill -9`, each pasted from a real run of
  `./bin/mstack verify ...` in a throwaway repository (CONTRIBUTING.md's docs rule), and three
  paragraphs: how an agent runs it (the Bash tool's `run_in_background`, since a suite run twice
  passes the 120-second default and the 900-second default `--timeout` passes the 600-second
  ceiling), that it should run alone and last (flaky tests, and every code or test commit voids
  the receipt), and that in an mstack checkout it runs from a copy (R28). Tests in a new
  `tests/mutation-cli.test.ts`, running `bin/mstack` as a child in a throwaway repository with a
  store: `R1 no active item`, `R1 neither flag, or both`, `R26 lines in order for a killed run`,
  `R27 exit codes 0, 1, 2 and 3`, `R31 the recovery is printed before the revert`, `R37 restore
  with no lock exits 0`, `R38 restore refuses a live run without --force`, `R38 restore --force
  restores under a live run`, `R38 restore refuses a lock from another host`, `R18 kill -9 mid-run,
  then verify --restore` (the obligation sleeps on the reverted tree; the test SIGKILLs the
  `mstack` pid only, runs `verify --restore`, compares `git status --porcelain`, then kills the
  orphaned obligation by marker), `R43 restore refuses a lock with a path outside the root`, `R43
  restore refuses a lock that cannot be parsed and names sh`, `R28
  the CLI refuses to revert its own source` (the sandbox holds a commit of this checkout's `bin/`
  and `src/`, a later commit changes `src/run-helper.mjs`, and `<sandbox>/bin/mstack verify
  --mutation` exits 2), `R12 --timeout must be an integer from 1 to 2147483`. Done when `bun test
  tests/mutation-cli.test.ts` ends ` 14 pass` and ` 0 fail`, the node command prints `# fail 0`,
  and `node scripts/check-doc-links.mjs docs/wiki/The-CLI.md` prints no error. (covers R1, R12,
  R18, R26, R27, R28, R31, R37, R38, R43)

## 4. The closing check, the forced close, the gate, the hook

- [ ] 4.1 In `src/closing.ts`, add `MUTATION_CHECK = "mutation"` to `CLOSING_CHECKS`
  (`src/closing.ts:171`) as design.md "The closing check, the gate, `done`, the forced marker"
  defines it. Add its row to "What `mstack gate` checks" in `docs/wiki/Gates-and-Hooks.md`
  (`:136`) with real output pasted from `./bin/mstack gate` in a throwaway repository at an item
  with no row. Tests appended to `tests/closing.test.ts`: `R23 no row at verifying`, `R23 killed
  turns it green`, `R23 later survived wins`, `R23 later blocked does not void a killed`, `R23
  obligations changed`, `R23 a test edited after the run`, `R23 state set done runs it at any
  status`, `R24 no base`, `R24 size s`, `R24 only tests changed`, `R24 only an untracked code
  file`, `R24 base not found is not overridable`. Done when `bun test tests/closing.test.ts -t
  "^R2[34] "` prints ` 12 pass`, `bun test tests/closing.test.ts tests/gate.test.ts` ends ` 0 fail`,
  and the node command for both files prints `# fail 0`. (covers R23, R24)

- [ ] 4.2 In `src/cli.ts`, replace the choice between `FORCED_UNVERIFIED`, `FORCED_TABLE` and
  `FORCED_BOTH` (`src/cli.ts:646-649`) with `forcedMarker(checks)` over the set of overridden
  check names, export `FORCED_MUTATION`, list all seven markers in `FORCED_MARKERS`
  (`src/cli.ts:231`), and print "forced: closed without a killed mutation receipt - <messages>"
  for a mutation problem. Tests appended to `tests/state-cli.test.ts`: `R25 forced close past the
  mutation check records the marker`, `R25 the marker survives a later --closed-by`, `R25 --force
  without --closed-by is refused`, `R25 two overridden checks are both named`, `R25 the three
  existing markers are byte-identical`, each through `onEach` (`tests/state-cli.test.ts:34-36`),
  which runs it once per installed runtime. Done when `bun test tests/state-cli.test.ts -t
  "^R25 "` prints ` 10 pass` with node and bun installed, and `bun test tests/state-cli.test.ts tests/cli.test.ts
  tests/r-table-check.test.ts` ends ` 0 fail` (`tests/cli.test.ts:704` and
  `tests/r-table-check.test.ts:363-364` pin the existing markers), and the node command for those
  three files prints `# fail 0`. (covers R25)

- [ ] 4.3 In `src/gate.ts`, add `checkMutationLock(store, report)` to the workspace section
  (`src/gate.ts:86-88`, so it runs with no active item) with the line of R22 and the rescue
  warning of R42, and make `runVerification` (`src/gate.ts:739`) fail and run nothing while the
  lock exists; in `src/cli.ts`, make the `done` branch of `cmdState` (`src/cli.ts:632`) refuse
  while `readLock(store)` is not `null`, before `closingProblems`, whatever `--force` says. Add the
  lock line and the rescue warning to "What `mstack gate` checks" in
  `docs/wiki/Gates-and-Hooks.md` with output pasted from `./bin/mstack gate` in a throwaway
  repository holding a lock from a killed run. Tests appended to `tests/gate.test.ts`: `R22 a lock
  fails the gate with no active item`, `R22 the line says whether the run is running`, `R22 an
  unparseable lock fails the gate`, `R22 the lock is reported once at verifying`, `R22 the Stop
  hook carries the line`, `R40 gate --full runs nothing under a lock`, `R42 a non-empty rescue
  directory is a warning`; and to `tests/state-cli.test.ts`, through `onEach`: `R41 done is
  refused under a lock even with --force`. Done when `bun test tests/gate.test.ts -t "^R22 "` prints ` 5 pass`, `bun
  test tests/gate.test.ts tests/state-cli.test.ts` ends ` 0 fail`, and the node command for both
  files prints `# fail 0`. (covers R22, R40, R41, R42)

- [ ] 4.4 In `src/hooks.ts`, extend `preToolUse` (`src/hooks.ts:537`) with the lock branch of
  design.md "The hook". Add a row to "What PreToolUse denies" in `docs/wiki/Gates-and-Hooks.md`
  (`:83`) naming the git commands it denies under a lock and what it does not see (aliases,
  `git-commit`, `"git"`, interpreters, `npm version`, `git -C` from outside the repository, the
  Edit and Write tools). Tests appended to `tests/hooks.test.ts`, each with a lock file in a
  throwaway git directory: `R21 shapes caught` (the six commands of the scenario), `R21 every
  listed git command is denied under a lock`, `R21 not caught, allowed`, `R21 the reason names
  verify --restore and sh`, `R39 an unrelated command spawns no git` (the test points `PATH` at a
  directory whose `git` writes a marker file, and asserts the marker is absent), `R39 no lock
  allows`, `R39 git cannot answer allows`, `R39 an unparseable lock still denies`. Done when `bun
  test tests/hooks.test.ts -t "^R21 "` prints ` 4 pass`, `-t "^R39 "` prints ` 4 pass`, the file
  ends ` 0 fail`, and the node command prints `# fail 0`. (covers R21, R39)

## 5. Verification and close

- [ ] 5.1 `bun run test && bun run typecheck && ./bin/mstack lint-plugin . && node
  scripts/check-doc-links.mjs README.md docs/wiki/*.md` all exit 0 (use the Bash tool's `timeout:
  600000`; the suite takes about 70 s). Then the seams of item 42 by hand in a throwaway
  repository, with `./bin/mstack` of this checkout and outputs pasted into the implementation
  report: `verify --mutation` killed, survived and blocked with the row each wrote; `kill -9` of
  the process mid-run, then `gate --quiet`, a denied `git commit` from `./bin/mstack hook
  pre-tool-use`, `verify --restore`, and `git status --porcelain` identical to before; `gate` and
  `state set --status done` with and without a killed row and with a lock. Record the
  requirement-to-test table of the implementation report with `| R | Test | Where |` rows for
  R1-R43 (item 41's format, `src/rcheck.ts`). (covers R1-R43)
- [ ] 5.2 Independent review by a pass that did not write the code. It tries first to leave a tree
  reverted or to lose a byte of the user's work: a SIGKILL at each named step followed by both
  `verify --restore` and `sh <lock>`; a Ctrl-C to the whole group during the restore; a commit, a
  `git add` and an editor save from another terminal during the obligations; a directory created
  where HEAD has a file; a second run and a `--restore --force` racing a live one; and a commit
  through an alias. (covers R16, R17, R29, R30, R35)
- [ ] 5.3 Item 42's own mutation run, from a copy of the CLI outside the tree (R28 refuses
  `./bin/mstack verify --mutation` here, because the item changed `src/`). Do it after 5.2 has
  approved and every code and test change is committed: a later code or test commit voids the
  receipt (R14). Run every step from the checkout's root.
  1. The session. Run from a terminal, from a Claude Code session started with `claude
     --plugin-dir "${TMPDIR:-/tmp}/mstack-42-cli"` after step 2 (its hooks then run the copy's
     code, which has the lock branch of R21), or from a session with no mstack plugin. Not from a
     session started with `--plugin-dir .`: its hooks run this checkout's `src/`, which the revert
     puts back to the start, where no hook knows the lock. In a terminal, in a session with no
     mstack plugin, or in one whose hooks are the marketplace copy's (they run from their install
     directory and do not know the lock), nothing denies a git command during the run: issue none
     in the checkout until step 4 has reported.
  2. `git worktree add --detach "${TMPDIR:-/tmp}/mstack-42-cli" HEAD` prints `HEAD is now at
     <sha>`; then `"${TMPDIR:-/tmp}/mstack-42-cli/bin/mstack" version` prints `mstack <version>
     at <that directory>`.
  3. `./bin/mstack gate --full` with the Bash tool's `timeout: 600000` (about 90 s here) prints
     `PASSED`; it records the green baseline at this tree.
  4. `"${TMPDIR:-/tmp}/mstack-42-cli/bin/mstack" verify --mutation`, launched with the Bash
     tool's `run_in_background: true` (one run of `npm test && npm run typecheck && bin/mstack
     lint-plugin .` on the reverted tree takes about 50 to 130 s, past the 120-second default; a
     background command has no tool timeout). Wait for its completion notice; do not poll it. Its
     output says "recorded green at this tree, not re-run", prints the recovery lines, and ends
     with a block that starts `mutation-killed:`; its exit code is 0.
  5. If it did not end that way and `./bin/mstack gate --quiet` names a lock that is not running:
     `"${TMPDIR:-/tmp}/mstack-42-cli/bin/mstack" verify --restore` (exit 0), or, if the copy is
     gone, `sh .git/mstack-mutation.lock`. `./bin/mstack verify --restore` cannot work while
     `src/` is reverted: the start has no `verify` command. Then find out why and repeat from 3.
  6. `git worktree remove "${TMPDIR:-/tmp}/mstack-42-cli"`.
  Done when `tail -1 .mstack/verification.tsv | cut -f4` prints `mutation-killed`, `git status
  --porcelain` prints nothing outside `.mstack/`, and `./bin/mstack gate --quiet` prints no line
  containing "mutation". (covers R13, R23, R28)
- [ ] 5.4 PR, merge gate, close, as `skills/ship/SKILL.md` says. Item 42 has no size, which is "a
  size other than `s`", so it closes on the `mutation-killed` receipt of 5.3, or on a forced close
  that says why. If `./bin/mstack state set mutation-check --status done` on `main` after the
  merge reports a run at another code or test state, or a start it cannot find, the merge moved
  the start: `./bin/mstack state set mutation-check --base <commit>` with the commit `main` was at
  before the merge (`git rev-parse HEAD^1` when the merge made a merge or squash commit) puts the
  start there, and the receipt of 5.3 matches again when `main`'s own commits in between changed
  none of the item's code or test paths; otherwise run 5.3 on the branch again before merging.
  (covers R23, R25)
