How every task is checked. A task's tests run with `bun test tests/<file>`, which ends with
` N pass` and ` 0 fail`, and under node with `node --disable-warning=ExperimentalWarning
--experimental-strip-types --test tests/<file>`, which prints `# fail 0`. `bun run typecheck` exits
0 after every task. Every test builds a throwaway git repository with `sandbox()` from
`tests/helpers.ts:30` (no mocks of git); a test that spawns a process kills it and its group in
`finally`. A test that needs a case-insensitive filesystem skips itself when a file written as
`probe` is not found as `PROBE`. Names used below (`entryAt`, `prepareRun`, the step names, and the
rest) are defined in design.md "Shape", in this directory. New tests go in the new files named
here. Each implementation task ends with the implementer's `| R | Test | Where |` table for the
requirements it covers (`agents/implementer.md`, "Your report").

## 1. What is reverted, the key and the refusals (reads only)

- [x] 1.1 In `src/size.ts`, move the `counted` closure out of `measureDiff` (`src/size.ts:149-152`)
  into an exported `scopeClass(store)` that returns a store-relative path's class or `null` under
  the store directory, and make `measureDiff` count `scopeClass(store)(path) === "code"`. Create
  `src/mutation.ts` with `revertSet(store, start)` and `mutationKey(store, start)` as design.md
  "The sets and the key" defines them. Tests in a new `tests/mutation-set.test.ts`: `R10 tests,
  docs and the store are not in the revert set`, `R10 a store in a subdirectory reverts only under
  its root`, `R10 an untracked code file is not in the revert set`, `R9 the revert set records each
  path's start and HEAD mode and blob`, `R21 a code or test edit changes the key, committed or
  not`, `R21 a new code or test file changes the key`, `R21 committing an untracked test file
  changes the key`, `R21 an executable bit changes the key`, `R21 a docs or store commit does not
  change the key`, `R21 a rebase that changes no code or test path keeps the key`, `R21 a store in
  a subdirectory has a key that a test edit changes`, `R21 a key path that holds a newline makes the
  key null, with its reason` and `R21 the key is null, with its reason, when git cannot list the
  changed or the untracked files` (both added in round 1, for mutants no named test killed), `R21 a
  key path whose name is not UTF-8 makes the key null, with its reason` (added in round 1, for
  NB5). Done when `bun test tests/mutation-set.test.ts` ends ` 14 pass` and ` 0 fail`, `bun test tests/item-size-base.test.ts
  tests/gate.test.ts` ends ` 0 fail` (the size check is unchanged), and the node command for
  `tests/mutation-set.test.ts` prints `# fail 0`. (covers R9, R10, R21)

- [x] 1.2 In `src/mutation.ts`, add `lockPath(store)` and `refusals(store, state, item, running)`
  (`running` defaults to `runningCliRoot()`, `src/paths.ts:99`) with the checks of R1 that need no
  staging, R2's checks before the baseline, and R5, in design.md "Refusals" order, each returning
  `{ message, fix }`. Tests in a new `tests/mutation-refusals.test.ts`; each asserts the message and
  that no lock, no `<git dir>/mstack-mutation/` and no new `verification.tsv` row exist afterwards:
  `R1 no active item`, `R1 not a git repository`, `R1 no base, and a base that is not a commit`,
  `R1 start lost`, `R1 no obligations`, `R1 a rebase in progress`, `R1 a detached HEAD is allowed`,
  `R1 an existing lock is refused naming its pid`, `R1 an empty revert set: only tests and docs, or
  only untracked code`, `R2 a dirty tracked file`, `R2 dirty store files are allowed`, `R2 an
  untracked file where the revert puts one back`, `R2 a case variant where the revert puts a file
  back` (case-insensitive only), `R2 a path of the set on disk under another case`
  (case-insensitive only), `R2 an untracked symlink at a parent directory`, `R5 a revert path inside
  the running CLI is refused with the copy commands, and not from a copy` (it passes the sandbox
  root as `running`, then a directory outside it), `R2 a skip-worktree file is refused, naming the
  flag and the command that clears it`, `R2 an assume-unchanged file is refused, naming the flag
  and the command that clears it` and `R2 a flagged file under the store directory is not refused`
  (the three added in round 1, for B2), `R2 at most ten paths are named, then how many more` and
  `R1 an operation in progress in a linked worktree refuses there and not in the main worktree`
  (both added in round 1, for mutants no named test killed). Done when `bun test
  tests/mutation-refusals.test.ts` ends ` 21 pass` (or fewer passes plus skips, on a case-sensitive
  filesystem) and ` 0 fail`, and the node command prints `# fail 0`. (covers R1, R2, R5)

- [x] 1.3 In `src/mutation.ts`, add to `refusals` the shapes of R3 (modes, the file/directory
  prefix test over every path of the start..HEAD diff, and the `fold` collisions over the set and
  its parent prefixes) and the merge rule of R4, as design.md "Refusals" defines them. Tests in a
  new `tests/mutation-shapes.test.ts`; a commit a case-insensitive checkout cannot hold is built in
  the index with `git update-index --index-info` (for an NFD name under `git -c
  core.precomposeunicode=false`) and then `git commit`: `R3 a symlink in the set`, `R3 a submodule
  in the set`, `R3 a file that became a directory`, `R3 a directory that became a file, its other
  files tests`, `R3 a case-only rename`, `R3 a normalisation-only rename`, `R3 parent directories
  that differ only by case`, `R3 plain added, deleted, modified and renamed files are not refused`,
  `R3 a name with a newline, and one that is not UTF-8` (built with `git update-index -z
  --index-info`), `R4 main merged in after a base on the branch`, `R4 a sibling branch merged in
  after a fork-point start`, `R4 main merged in after a fork-point start is not refused`, `R4 a
  rebased branch is not refused`. Done when `bun test tests/mutation-shapes.test.ts` ends ` 13
  pass` and ` 0 fail`, and the node command prints `# fail 0`. (covers R3, R4)

## 2. Staging, the lock, the tree, the runner

- [x] 2.1 In `src/git.ts`, add `gitToFile(store, args, fd, timeoutMs): boolean`, a `spawnSync` of
  git with the environment of `git()` (`src/git.ts:61-76`) and `fd` as stdout. Create
  `src/mutation-lock.ts` with the `Identity`, `LockEntry` and `Lock` types, `prepareRun`,
  `acquireLock`, `readLock`, `validateLock`, `sweepStale` and `liveness` (design.md "The lock and
  the run directory" and "Is the run alive"). Create `tests/mutation-holder.ts`, a child process in
  the style of `tests/lock-holder.ts`: argv `<store root> <journal> <phase> <blockAt> <release>`;
  phase `acquire` runs `prepareRun` and `acquireLock`, appends `at <step>` to the journal at each
  step and blocks at `blockAt` until the file `<release>` exists. Tests in a new
  `tests/mutation-lock.test.ts`: `R8 the lock is one JSON document before the first write`, `R8 a
  linked worktree has its own lock`, `R8 two processes acquire at once and one wins` (two holders
  released together), `R8 leftovers of a killed prepare are removed once the next run holds the
  lock` (SIGKILL of a holder at `prepared`), `R8 a run directory whose rescue holds anything is
  kept`, `R9 a 3 MiB start file is staged byte for byte`, `R1 a start blob that cannot be read
  leaves no run directory` (a `filter.<x>.required` smudge filter whose command does not exist),
  `R24 a lock path that is absolute, empty, or has a . .. or .git segment is refused`, `R24 an
  unparseable lock is reported as damaged`, `R23 liveness: this process is running, an exited pid
  is not, a process at the pid that started later is not`, `R23 liveness: another boot of this
  host is not running, another host is unknown at any boot`, `R23 liveness: a live pid that
  started before the lock is running at another boot time, a ps that fails is running, and a null
  pid namespace against a non-null one is unknown` (`ps` made to fail through `PATH`), `R24 a lock
  entry whose temp prefix is not the one its run derives is refused` and `R23 liveness: a live
  process this user may not signal (EPERM) is running` (both added in round 1, for mutants no
  named test killed), `R24 two lock paths that differ only by case or Unicode normalisation are
  refused` (added in round 1, for NB3), `R24 a lock that is a symlink or a FIFO is damaged, read
  without following the link or blocking` (added in round 1, for NB7), `R8 a run directory the
  sweep cannot remove is left, and the sweep does not throw` and `R8 a run refused the lock can
  remove its own staging` (added in round 1, for NB11 and NB12). Done when `bun test
  tests/mutation-lock.test.ts` ends ` 18 pass` and ` 0 fail`, and the node command prints `# fail
  0`. (covers R1, R8, R9, R23, R24)

- [x] 2.2 Create `src/mutation-tree.ts` with `entryAt(root, path)` (design.md "Exact names") and
  `applyRevert(store, lock, step?)` (design.md "Revert"), returning `{ ok: true }` or `{ ok: false,
  path, reason, written }`. Tests in a new `tests/mutation-revert.test.ts`, each reading the tree right after
  `applyRevert` returns: `R9 added, deleted, modified and renamed`, `R9 binary bytes and the
  executable bit`, `R9 line endings are the start's as checked out here` (a `.gitattributes` with
  `*.txt text eol=crlf`), `R9 the index is not touched`, `R9 a directory left empty by an added file
  is removed, and a missing parent is made`, `R10 untracked, test and doc files are byte-identical
  after the revert`, `R11 a path that cannot be written stops the revert` (a read-only directory;
  the result names it and `EACCES`), `R11 a path that changed since the lock stops the revert
  before it is written` (the edit is made from `step` at `reverted:0`), `R11 an edit between the
  staged copy and the lock blocks the revert and keeps the edit` (the edit is made after
  `prepareRun` and before `acquireLock`), `R11 an edit after the temp file is written and before
  its rename stops the revert and keeps the edit` (the edit is made from `step` at
  `revert-written:0`), `R11 an added file edited since the lock is not removed` (added by stage 2,
  for a mutant no named test killed), `R8 a run whose staging another run swept before it linked
  its lock writes nothing` and `R11 a staged copy changed, or the run directory deleted, between
  the lock and the revert: the revert writes nothing` (both added in round 1, for B1), `R10 an
  untracked file in a directory the revert removes when empty is kept` and `R9 a start file of mode
  100755 is put back with its executable bits` (both added in round 1, for mutants no named test
  killed), `R10 the revert removes no directory through a symlinked parent` (added in round 1, for
  NB8). Done when `bun test tests/mutation-revert.test.ts` ends ` 16 pass` and ` 0 fail`, and the
  node command prints `# fail 0`. (covers R8, R9, R10, R11)

- [x] 2.3 In `src/mutation-tree.ts`, add `restoreFromLock(store, lock, options?)` with `options` `{
  step?; rename?; entries? }` (`rename` defaults to `renameSync`; a test passes one that throws an `EXDEV`
  error for a target under `rescue/`), as design.md "Restore" defines it: the temp sweep, its order,
  its table, the rescue, the proof, then the lock and the staging. Extend `tests/mutation-holder.ts`
  with phase `run`: `prepareRun`, `acquireLock`, `applyRevert`, step `obligations-running`,
  `restoreFromLock`, journalling and blocking as in phase `acquire`; with a sixth argument `nogit`
  it sets `process.env.PATH` to a directory whose `git` writes a marker file, before calling
  `restoreFromLock`. Tests in a new `tests/mutation-restore.test.ts`: `R13 clean afterwards: status
  as before, index untouched, lock and staging gone`, `R13 the whole permission bits come back`
  (0600 and 0444), `R13 a changed tracked file outside the set does not keep the lock`, `R13 a
  SIGKILL between a temp write and its rename leaves nothing after the restore` (SIGKILL at
  `revert-written:0`), `R14 an edit to a reverted file is rescued byte for byte`, `R14 an edit after
  H's temp file is written and before its rename is rescued` (the edit is made from `step` at
  `restore-written:0`), `R14 a directory where HEAD has a file is moved whole into rescue`, `R14 a case variant where HEAD has a file is
  rescued under its own name` (case-insensitive only), `R14 a file left at a path HEAD lacks is
  left in place`, `R14 a second incident gets its own rescue directory`, `R14 the copy fallback
  keeps the bytes and the mode`, `R15 a read-only directory keeps the lock and the other paths are
  restored`, `R15 a missing staged copy keeps the lock after rescuing what is there`, `R15 a parent
  renamed by case fails with the mv back as its fix` (case-insensitive only), `R17 the
  restore starts no child process` (the `nogit` holder; the marker file must not exist), `R22
  killed with the lock written and nothing reverted`, `R22 killed half reverted`, `R22 killed fully
  reverted`, `R22 killed half restored, then restored twice` (each SIGKILLs the holder at its step,
  then calls `restoreFromLock` on `readLock`), `R13 a path changed after its own restore fails the
  proof and keeps the lock` (added by stage 2, for two mutants no named test killed), `R10 a file
  written into a directory the revert made survives the restore`, `R15 a staged copy of H that does
  not hold what the lock recorded is not written, and the lock stays` and `R13 a path HEAD lacks
  that holds the start's content at the proof keeps the lock` (the three added in round 1, for
  mutants no named test killed), `R24 the restore checks the lock itself, and writes nothing for one
  that fails the check` (added in round 1, for NB4), `R13 the restore leaves a lock that another
  run wrote` (added in round 1, for NB6), `R10 the restore lists and removes nothing through a
  symlinked parent` (added in round 1, for NB8), `R14 the copy fallback fsyncs its copy's
  directory before it unlinks the source` and `R13 the restore fsyncs the directories it wrote
  before it unlinks the lock` (both added in round 1, for NB9; node only, through
  `syncBuiltinESMExports`, and skipped under bun), `R15 a rescue that cannot be made names moving
  the entry aside as the fix` (added in round 1, for NB10). Done when `bun test
  tests/mutation-restore.test.ts` ends ` 27 pass`, ` 2 skip` (or fewer passes plus two more skips,
  on a case-sensitive filesystem) and ` 0 fail`,
  and the node command prints `# fail 0` with 29 passing. (covers R10, R13, R14, R15, R17, R22, R24)

- [x] 2.4 In `src/run.ts`, add `runCommandAsync(cmd, { cwd, timeoutMs, tailLines? })` returning `{
  result: Promise<RunResult>; stop(): void }`, and in `src/run-helper.mjs` the fifth argument
  `watch-parent` (design.md "The async runner": with it, the helper is spawned detached);
  `runCommand` passes no fifth argument. Tests in a
  new `tests/run-async.test.ts`: `R12 async: exit code, signal and tail match runCommand`, `R12
  async: a timeout reports timedOut, code null and SIGKILL, and the group is gone`, `R12 async: a
  command that cannot start gives code null and an error`, `R12 async: timeoutMs must be an integer
  from 1 to 2^31-1`, `R12 async: does not load the target directory's bunfig.toml or .env`, `R16
  async: stop() kills the whole group and the promise settles within 3 s`, `R16 async: a SIGINT to
  the caller's group takes the command down` (sent with `process.kill(-pid)`, as
  `tests/run.test.ts:237` does), `R16 async: the caller's signal handler runs while the command
  runs`, `R16 async: when the caller is SIGKILLed the command's group is gone within 2 s` (a child
  caller that starts the command, then `kill -9` of that caller, then `pgrep -f` of a marker in
  the command, as `tests/run.test.ts:158-161` does), `R16 async: when the caller's whole group is
  SIGKILLed the command's group is gone within 2 s` (the child caller leads its own group, and the
  test sends `kill -9` to that group). Done when `bun test tests/run-async.test.ts`
  ends ` 10 pass` and ` 0 fail`, `bun test tests/run.test.ts` ends ` 0 fail`, and the node command
  for both files prints `# fail 0`. (covers R12, R16)

## 3. The run and the command

- [x] 3.1 In `src/verification.ts`, add `MUTATION_OUTCOMES` and `recordMutation` (design.md "The
  receipt"); `receipts()` and `status()` do not change. Create `src/mutation-run.ts` with
  `runMutation(store, { timeoutMs, running?, step?, out })` and `classify(result)` (design.md "The
  run" steps 1 to 13, without the signal paths and without R18's checks, and "The async runner").
  Tests in a new `tests/mutation-run.test.ts`, calling `runMutation` in-process with `out`
  collecting lines and an obligation that is a shell script under the sandbox's `tests/` (a test
  path, so never reverted) checking the content of `src/a.ts`: `R6 a recorded green counts as the
  baseline`, `R6 a stale green does not count`, `R2 the tree moved during the baseline` (the script
  commits on its first run), `R2 an untracked test file edited during the baseline` (the script
  edits it on its first run), `R7 a red baseline is blocked and reverts nothing`, `R7 a baseline
  timeout records no failed receipt`, `R12 killed`, `R12 a build failure is killed and says so`,
  `R12 an exit of 128+n is killed and names the signal`, `R12 survived lists the paths`, `R12 a
  script removed by the revert is blocked`, `R12 a hang is blocked at the timeout`, `R11 a revert
  that cannot complete runs no obligation and is blocked`, `R11 the run's restore after a stopped
  revert leaves the change that stopped it in place` (the edit is made from `step` at `reverted:0`;
  no `rescue/` exists afterwards), `R20 a mutation row has six cells and a
  mutation: tree`, `R20 receipts() and status() ignore mutation rows`, `R20 no row after a failed
  restore`, `R21 the run does not move its own key`, `R2 HEAD that moves before the staging reads it
  is refused, and nothing is written` (added by stage 4, for review round 1 non-blocking 14), `R1 a
  lock taken by another run after the staging is refused naming its pid, and the staging is
  removed` (added by stage 4, for review round 1 non-blocking 12) and `R12 classify: 0 passes; 126,
  127, a timeout, an error and a signal are blocked; any other code is a kill` (added by stage 4: no
  named test has an exit 126). Done when `bun test tests/mutation-run.test.ts`
  ends ` 21 pass` and ` 0 fail`, `bun test tests/verification.test.ts tests/gate.test.ts` ends
  ` 0 fail`, and the node command for `tests/mutation-run.test.ts` prints `# fail 0`. (covers R2,
  R6, R7, R11, R12, R20, R21)

- [ ] 3.2 In `src/mutation-run.ts`, add R18's checks (a) to (e), the re-written lock of R15 when the
  lock file vanished and the restore failed, and R19's report (design.md "The run" steps 10 to 13).
  Tests in a new `tests/mutation-changed.test.ts`, each making its change from the `step` callback
  at `obligations-running`: `R18 an edit to a reverted file during the run`, `R18 a commit during
  the run`, `R18 the lock deleted during the run: restored, no row`, `R18 a git add during the
  run`, `R18 a tracked test file rewritten during the run`, `R18 an untracked test file edited
  during the run`, `R18 a non-ignored output file written by the obligation`, `R15 a failed restore
  after the lock was deleted writes the lock again`, `R19 HEAD moved: both shas and git reset,
  mixed`, `R19 HEAD on another branch: git switch to the lock's branch, and no reset when that
  branch did not move`, `R19 the index line names git restore --staged and what it discards`, `R19 left in place
  and changed files are reported without a cause`. Done when `bun test
  tests/mutation-changed.test.ts` ends ` 12 pass` and ` 0 fail`, and the node command prints
  `# fail 0`. (covers R15, R18, R19)

- [ ] 3.3 In `src/mutation-run.ts`, add the signal handling of design.md "The run" steps 1, 3, 6, 8
  and 10 (handlers before anything is written, `stop()` of the running obligation, one yield before
  each signal check and each spawn, acting only after the restore). Create
  `tests/mutation-run-holder.ts`, a child process that runs `runMutation` on the sandbox given in
  argv with a `step` that journals and, at the step named in argv, blocks synchronously
  (`Atomics.wait`) until a release file exists. Tests in a new `tests/mutation-signals.test.ts`,
  each spawning the holder with `detached: true` so that it leads its own group: `R16 SIGTERM to the
  mstack process alone during the obligations`, `R16 SIGINT to the whole group during the
  obligations`, `R16 SIGHUP during the baseline touches nothing`, `R16 SIGKILL during the
  obligations leaves no obligation process after 3 s`, `R17 SIGINT to the group during the restore
  does not interrupt it` (blocked at `restored:0`, signalled, released), `R17 SIGINT twice during
  the restore`, `R17 SIGINT to the group right after the lock: nothing reverted, no obligation
  started` (blocked at `lock-written`; the journal holds no `reverted:` step and the obligation's
  marker file does not exist), `R17 SIGINT to the group at reverted:0: no obligation starts`
  (blocked at `reverted:0`; the obligation's marker file does not exist), `R17 SIGINT to the group
  during prepare exits 130, not a refusal`
  (the start blob's smudge filter is `sleep 2; cat`). Each asserts the exit code, `git status
  --porcelain` against the one taken before, no lock, no row, and no process left (`pgrep -f` of a
  marker in the obligation). Done when `bun test tests/mutation-signals.test.ts` ends ` 9 pass` and
  ` 0 fail`, and the node command prints `# fail 0`. (covers R16, R17)

- [ ] 3.4 In `src/cli.ts`, add `case "verify"` to `main` (`src/cli.ts:72-111`) and `cmdVerify`:
  `--mutation [--timeout <seconds>]` calls `runMutation`; `--restore` calls `readLock`,
  `validateLock`, `liveness`, then `restoreFromLock`; any other flag, `--force` included, is a usage
  error; the exit codes and lines of R12, R15, R22-R25. Add `verify --mutation [--timeout S] |
  --restore` to `USAGE` (`src/cli.ts:38`) and exit 3 to its exit-code line (`:68`). Add a `## verify`
  section to `docs/wiki/The-CLI.md`, before `## version`, with the transcripts of a killed run, a
  survived run and a `--restore` after `kill -9`, each pasted from a real run of `./bin/mstack
  verify ...` in a throwaway repository (CONTRIBUTING.md, "Pasted output is from real runs"), and
  paragraphs on: how an agent runs it (the Bash tool's `run_in_background`, since two runs of a
  suite pass the 120-second default and the 900-second `--timeout` default passes the 600-second
  ceiling); running it alone and last (flaky tests; a code or test commit changes the key); a
  recorded `gate --full` green inheriting the terminal (design.md "Trade-offs accepted"); the
  refused shapes; a save to a reverted file in the moment it is put back being lost (design.md
  "What cannot be made safe" 1); a restarted container as the common way to a lock whose run
  cannot be told; an mstack checkout running it from a copy, and hooks of a `--plugin-dir .`
  session running the reverted `src/`; and "By hand" with the three ways of design.md "By hand",
  each with what it discards. Add an Unreleased entry for `verify` to `CHANGELOG.md`. Tests in a
  new `tests/mutation-cli.test.ts`, running `bin/mstack` as a child in a throwaway repository with
  a store: `R1 neither flag, or both`, `R1 --timeout must be an integer from 1 to 2147483`, `R25
  the run prints the lock and the absolute restore command before reverting` (and the line about a
  save in the moment a file is put back), `R25 no output names
  sh with the lock`, `R22 restore with no lock exits 0`, `R22 kill -9 mid-run, then verify
  --restore` (the obligation sleeps on the reverted tree; the test SIGKILLs the `mstack` pid only,
  runs `verify --restore`, compares `git status --porcelain`), `R23 restore refuses a live run, and
  --force is not an option`, `R24 restore refuses a lock with a path outside the root`, `R24
  restore refuses a lock that cannot be parsed and names git stash`, `R15 exit 3 when the restore
  fails, over every other code`, `R5 the CLI refuses to revert its own source` (the sandbox holds a
  commit of this checkout's `bin/` and `src/`, a later commit changes `src/run-helper.mjs`, and
  `<sandbox>/bin/mstack verify --mutation` exits 2). Done when `bun test tests/mutation-cli.test.ts`
  ends ` 11 pass` and ` 0 fail`, the node command prints `# fail 0`, and `node
  scripts/check-doc-links.mjs README.md docs/wiki/*.md` ends `0 broken`. (covers R1, R5, R15, R22,
  R23, R24, R25)

## 4. The gate and the hook

- [x] 4.1 In `src/gate.ts`, add `checkMutationLock(store, report)` to the workspace section after
  `checkWorkspace` (`src/gate.ts:89-91`, so it runs with no active item) with R27's line, R25's
  command and R28's warnings (every worktree's rescue, design.md "The gate and the hook"), and make
  `runVerification` (`src/gate.ts:744`) fail and run nothing while the lock exists. In
  `src/worktree.ts`, make `prunable` (`:131`) leave out a worktree whose git directory holds the
  lock or a rescue with anything in it. Add the lock line and the rescue warning to "What `mstack gate` checks" in
  `docs/wiki/Gates-and-Hooks.md` (`:136`), with output pasted from `./bin/mstack gate` in a
  throwaway repository holding a lock from a killed run. Tests in a new
  `tests/mutation-gate.test.ts`: `R27 a lock fails the gate with no active item`, `R27 the line says
  running, not running or cannot tell`, `R27 an unparseable lock fails the gate`, `R27 the Stop hook
  carries the line`, `R27 gate --full runs nothing under a lock`, `R25 the gate line names the
  lock's CLI, and the running CLI when that path is gone`, `R28 a rescue directory that holds
  anything is a warning`, `R28 a linked worktree's rescue warns from the main checkout, and prune
  offers no worktree holding a lock or a rescue` (its tree clean, its branch merged). Done when
  `bun test tests/mutation-gate.test.ts` ends ` 8 pass` and ` 0
  fail`, `bun test tests/gate.test.ts` ends ` 0 fail`, and the node command for both files prints
  `# fail 0`. (covers R25, R27, R28)

- [x] 4.2 In `src/hooks.ts`, extend `preToolUse` (`src/hooks.ts:537`) with the lock branch of
  design.md "The gate and the hook", and add to `GUARDS` (`:361`) the entry for `rm` of the lock.
  In `tests/hooks.test.ts`, change `denied()` (`:283-286`) to pass a throwaway directory as `cwd`,
  so the suite never reads this checkout's lock: otherwise `the safe forms are not denied` fails
  under every mutation run here (it allows `git reset --soft HEAD~1` and `git reset HEAD~1`, which
  the lock branch denies). Add a row to "What PreToolUse denies" in
  `docs/wiki/Gates-and-Hooks.md` (`:83`) naming the git commands denied under a lock and what the
  hook does not see (aliases, `"git"`, interpreters, `npm version`, `git -C` from outside the
  repository, the Edit and Write tools), and add the lock to the PreToolUse `description` in
  `hooks/hooks.json` (`:81`). Tests in a new `tests/mutation-hook.test.ts`, each with a lock file in
  a throwaway git directory: `R26 shapes caught under a lock` (the six commands of the scenario),
  `R26 every listed git command is denied under a lock`, `R26 shapes not caught are allowed`, `R26
  an unrelated command spawns no git` (`PATH` points at a directory whose `git` writes a marker
  file, which must not exist), `R26 no lock, or git cannot answer, allows`, `R26 an unparseable lock
  still denies`, `R26 rm of the lock is denied, with a lock or without one` (no git process starts),
  `R25 the deny reason names the lock's CLI`. Done when `bun test
  tests/mutation-hook.test.ts` ends ` 8 pass` and ` 0 fail`, `bun test tests/hooks.test.ts` ends
  ` 0 fail`, `./bin/mstack lint-plugin .` exits 0, and the node command for both test files prints
  `# fail 0`. (covers R25, R26)

## 5. Verification and close

- [ ] 5.1 `bun run test && bun run typecheck && ./bin/mstack lint-plugin . && node
  scripts/check-doc-links.mjs README.md docs/wiki/*.md` all exit 0 (the Bash tool's `timeout:
  600000`). Then the seams of item 42 by hand in a throwaway repository with this checkout's
  `./bin/mstack`, outputs pasted into the implementation report: `verify --mutation` killed,
  survived and blocked with the row each wrote and `git status --porcelain` before, during and
  after; `kill -9` of the process mid-run, then `gate --quiet`, a denied `git commit` from
  `./bin/mstack hook pre-tool-use`, `verify --restore`, and `git status --porcelain` identical to
  before. The implementation report's `| R | Test | Where |` table has a row for each of R1-R28.
  (covers R1-R28)
- [ ] 5.2 Independent review by a pass that did not write the code. It tries first to lose a byte
  of the user's work or to keep the lock with deleting as the only way out: a SIGKILL at each named
  step followed by `verify --restore`; a Ctrl-C to the whole group at `lock-written` and during the
  restore; an edit, a commit, a `git add`, a case-only rename and a new directory at a reverted path
  from another terminal during the obligations; a second run and a `verify --restore` racing a live
  one; and each refused shape of R3 and R4. (covers R2, R3, R4, R13, R14, R16, R17, R18, R23)
- [ ] 5.3 Item 42's own mutation run, from a copy of the CLI outside the tree: R5 refuses
  `./bin/mstack verify --mutation` here, because the item changes `src/`. Do it after 5.2 has
  approved and every code and test change is committed. Run every step from the checkout's root,
  and make every mstack call from step 2 to step 6 through `"${TMPDIR:-/tmp}/mstack-42-cli/bin/mstack"`:
  while `src/` is reverted, `./bin/mstack` is the start's code and has no `verify`.
  1. The session: a terminal, a Claude Code session with no mstack plugin, or one started with
     `claude --plugin-dir "${TMPDIR:-/tmp}/mstack-42-cli"` after step 2. Not one started with
     `--plugin-dir .`, whose hooks run the reverted `src/`. Where no hook knows the lock, issue no
     git command in the checkout until step 4 has reported.
  2. `git worktree add --detach "${TMPDIR:-/tmp}/mstack-42-cli" HEAD` prints `HEAD is now at
     <sha>`; `"${TMPDIR:-/tmp}/mstack-42-cli/bin/mstack" version` prints `mstack <version> at
     <that directory>`.
  3. `"${TMPDIR:-/tmp}/mstack-42-cli/bin/mstack" gate --full` with the Bash tool's `timeout:
     600000` prints `PASSED`; it records the green baseline at this tree.
  4. `"${TMPDIR:-/tmp}/mstack-42-cli/bin/mstack" verify --mutation`, launched with the Bash tool's
     `run_in_background: true`; wait for its completion notice and do not poll it. Its output says
     "recorded green at this tree, not re-run", prints the lock line with
     `${TMPDIR:-/tmp}/mstack-42-cli/bin/mstack verify --restore` expanded to an absolute path, and
     ends with a block that starts `mutation-killed:`; its exit code is 0.
  5. If it did not end that way: `test -e "$(git rev-parse --absolute-git-dir)/mstack-mutation.lock"
     && echo locked` prints `locked` when the tree is still held; then
     `"${TMPDIR:-/tmp}/mstack-42-cli/bin/mstack" verify --restore` exits 0. Find out why, and repeat
     from step 3.
  6. `git worktree remove "${TMPDIR:-/tmp}/mstack-42-cli"`.
  Done when `tail -1 .mstack/verification.tsv | cut -f4` prints `mutation-killed`, `git status
  --porcelain` prints nothing outside `.mstack/`, and `./bin/mstack gate --quiet` prints no line
  containing "mutation". (covers R5, R20, R25)
- [ ] 5.4 PR, merge gate and close, as `skills/ship/SKILL.md` says. No closing check holds item 42
  to its receipt (that is item 100), so it closes on its verification receipts, its table and an
  independent verdict. (covers R1-R28)
