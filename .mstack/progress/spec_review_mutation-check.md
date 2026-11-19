**Verdict:** CHANGES_REQUESTED

# Spec review: item 42 mutation-check

Reviewer: spec-reviewer by hand (plugin not loaded), not the author. Reviewed at
`fe644f52a79506368d2f817733448f38c645b47e` on `feat/mutation-check`; `./bin/mstack gate` was
green before the review (`./bin/mstack version`: mstack 0.2.1 at this checkout). Read: item 42,
decisions.tsv rows 231 and 232, the four spec files, the hand-off, and the code each claim cites
(`src/verification.ts`, `closing.ts`, `rcheck.ts`, `size.ts`, `pathclass.ts`, `hooks.ts`,
`hooks/hooks.json`, `gate.ts`, `git.ts`, `run.ts`, `run-helper.mjs`, `cli.ts`, `tsv.ts`,
`tests/run.test.ts`, `tests/helpers.ts`).

Experiments, all in the session scratchpad `specreview42/` (macOS APFS, git 2.54.0 Apple Git-157,
node v26.13.1, bun 1.3.11):

- `git-exp.sh`: what `git restore --source --worktree` does to a directory in the way, a bad
  commit, a staged revert, a read-only directory; how `hash-object --stdin-paths` resolves paths.
- `sig-exp.sh`: whether a JS signal handler runs while `spawnSync` blocks; what a Ctrl-C to the
  process group does to a synchronous child of a process that ignores SIGINT.
- `lock-exp.sh`: temp file + fsync + `linkSync` + directory fsync, twice.

Every cited `file:line` in design.md "Context" was checked and is right. The claim the async
runner rests on is true at rung 4. It is in fact worse than design.md:23-25 says: with a
SIGTERM handler installed, node never ran the handler at all, and bun ran it only after
`spawnSync` returned (+3017 ms for a 3 s child). Without a handler both runtimes die at once
(exit 143). So restore-on-signal needs a runner that does not block, and a second function
that reuses `run-helper.mjs` is the smallest one that works.

## Grill

Moved unchanged to `.mstack/progress/attachments/spec_review_mutation-check.md` on 2026-11-19, to bring this report under the 24576 byte cap. No finding and no verdict line was edited.

## Blocking findings

### B1. The amendment: the key must cover tests. Every place that keys on code only must change.

Decision row 232 amends row 231: the fingerprint covers code and tests, and only docs and the
store directory are left out. The spec predates the amendment and keys on code only in each of
these places:

- `proposal.md:20` "keyed by a fingerprint of the code part". `:24` "the current code
  fingerprint".
- `design.md:9-12` "the mutation key is a second fingerprint, of the code part alone".
- `design.md:63-79`: `codeKey` hashes the revert set's entries, and the revert set is filtered
  by `isCountedCode`, which is code only. The key needs its own set: code and test paths under
  the store root, outside the store directory, that differ between the start and the working
  tree, untracked ones included.
- `design.md:66-68` "untracked code files ... counted in the fingerprint": untracked tests must
  be counted too.
- `design.md:209-211`, trade-off "keyed by the code part only ... editing a test after a killed
  run does not void it": now reversed.
- `design.md:232-233`, open question "Should test edits void a killed receipt? ... the design row
  says no": answered yes by row 232.
- `spec.md:206-207` (R13) "`tree` = `code:` plus the fingerprint of R14": the prefix now
  misnames the content. Rename it, or say it covers tests.
- `spec.md:222-227` (R14) "compute the code fingerprint over the revert set only ... a change to
  a test ... MUST NOT [change it]": a test change MUST change it.
- `spec.md:229-232` (R14, "What voids"): add "a test file is edited (committed or not)".
- `spec.md:234-237` (R14, "What does not void"): remove "a test file".
- `spec.md:403` (R23) "a run at another code state": should read "code or test state".
- `tasks.md:10,20-21` (1.1): `codeKey` and the tests `R14 what voids` and `R14 what does not
  void` follow the old R14. Add `R14 a test edit voids`.
- `tasks.md:94-96` (4.1): add `R23 test edited after the run`.

State explicitly that the exemption in R24 and the "code diff" test in A3 stay on code only. The
key set (code and tests) and the revert set (code) are now two different sets.

Evidence: decisions.tsv rows 231 and 232, and the lines above. To resolve: make those edits.

### B2. Untracked files are in the revert set, in the lock, and removed by the restore. R3 forbids it.

- The spec defines the revert set as "every code path whose content or mode differs between the
  start and the working tree" (`spec.md:18-19`). An untracked code file differs, so it is in the
  set.
- R2 (`spec.md:37-41`) brings every path of the set to its start state, where "a path added
  since the start is removed".
- R15 (`spec.md:248`) puts "the revert set as (path, kind) pairs" into the lock.
- R16 (`spec.md:262-263`) restores "every path of the revert set to its content and mode at the
  lock's HEAD sha". An untracked file's content at HEAD is absence.
- R3 (`spec.md:60-62`) says the system MUST NOT delete an untracked file.

The design builds the contradiction into its data. `revertSet` returns the untracked code files
as `Entry`s of kind `added`, the same kind as a committed added file (`design.md:63-68`). The only
thing keeping them from `applyRevert` "for `added`, `unlink`" (`:102-103`) is a parenthetical.
`restoreFromLock` then sorts such an entry as *neither* (present, but absent at HEAD and at the
start), copies it to the rescue directory, and "one HEAD lacks ... is removed with `unlink`"
(`:108-110`). That happens on every run, not only after a crash.

R6 refuses only *tracked* changes, and the classifier calls anything that is not a test or a doc
code: `notes.txt`, `out.log`, a scratch `wip.ts` (`src/pathclass.ts:50-55`). So a user's
never-committed file leaves its place on every run. A file that git never saw has no object to
recover from, and the rescue copy keeps the bytes but not the mode or symlink-ness.

The same ambiguity splits "empty". An item whose only code difference is untracked is held by R24
(its set is not empty) and refused by R4 (nothing to revert). It can then close only by force.

To resolve: define the revert set as the code paths that differ between the start and HEAD. R6
already guarantees that the tracked tree equals HEAD. Keep untracked files out of the revert and
out of the lock entirely. If they belong in the key (B1), list them there separately, or refuse
while untracked code or test files exist, as strict as R6. Define "empty" once and use it in
both R4 and R24.

Rung 3: walked through the spec and design text. No code exists yet.

### B3. The proof has no terminal state for anything but the restore changing the tree. R20 contradicts R16 and R18.

The proof is "no tracked file outside the store directory differs from HEAD", computed as
`git status --porcelain=v1 --untracked-files=no` against the current HEAD (`spec.md:264-266`,
`design.md:110-113`). `--restore` runs "the same proof" (R18), and "the lock stays" when it fails
(R16, R19).

- **R20 can never finish.** After a commit of the reverted tree and a restore of the worktree to
  the lock's HEAD, `git status` shows ` M src/a.ts`. The lock's paths match the lock's HEAD (the
  diff is empty), but the tree differs from the new HEAD (`git-exp.sh`, case c). R20's own
  outcome, "`git diff HEAD` shows the difference against the bad commit" (`spec.md:353`), is
  exactly what the proof rejects. So the lock stays, `--restore` fails the same way every time,
  and the gate stays red for good.
- **A `git add` from another terminal or an IDE** leaves `MM src/a.ts` after the restore
  (case g). The restore never writes the index (design.md:118), so this also never clears.
- **A tracked file the suite rewrites** (a snapshot, a committed build output, a lockfile) or the
  user's own edit to a test while the run is going: R16's scenario keeps the lock and "says it was
  changed by the obligations" (`spec.md:273-276`). The spec gives no way out.
  - The message claims a cause it cannot know. For a user's edit it is false.
  - The hook denies `git stash` while the lock exists. The only exit it still allows is
    `git restore <file>`, which discards the change. A user who believes the message is led to
    throw away their own work.

To resolve:

1. Make the proof that gates the lock's removal "every path of the lock matches the lock's HEAD
   (content and mode, or absent)". That is what the restore controls.
2. Report any other difference separately, without keeping the lock: HEAD moved, the index
   differs, other tracked files changed. Name each one and the command that resolves it (for a
   moved HEAD, the two shas and `git reset --soft <lock head>` as the user's option, not as an
   action the tool takes).
3. Record no row when that report is not empty.
4. Never attribute a change to the obligations.
5. Make R20's outcome consistent with the new proof.

### B4. Two restore paths lose work, and the spec does not close them.

- **The rescue location is fixed per path.** `<git dir>/mstack-mutation.rescue/<path>`
  (`spec.md:332`, `design.md:108`) holds a user's edit or a torn file from one incident. A second
  incident at the same path overwrites the earlier copy. Nothing reports that the rescue directory
  has content, so the first copy is likely still unread when the second lands. With B2 as
  written, an untracked file is "rescued" on every run, so overwriting is the normal case.
- **git deletes a directory in the way, untracked contents included.** With `src/x/` holding an
  untracked `untracked.txt`, `git restore --source=<start> --worktree -- src/x` exited 0, and
  `src/x` became the start's regular file. The directory and the untracked file were gone
  (`git-exp.sh`, case b2).
  - At revert time this happens for an item that turned a file into a directory. R6 refuses only
    "an untracked or ignored entry" at the path (`spec.md:100-103`). A directory that holds
    tracked files is neither. design.md's "present means in the way, except an entry the same
    revert removes first" (`:86-89`) is stricter, but the two disagree, and spec.md is
    authoritative.
  - At restore time nothing checks. For an item that turned a directory into a file, anything
    written into that directory during the run (obligation output, the user's file) is deleted
    by the restore, contrary to R16's "list them and leave them".

To resolve:

- Give each run its own rescue directory (`.../mstack-mutation.rescue/<startedAt>-<pid>/`),
  write into it exclusively and never overwrite, and add a gate warning while any rescue directory
  is non-empty.
- Before every revert and restore write, `lstat` the target. Move a directory found where a file
  is wanted, or the reverse, whole into the run's rescue directory. Never leave that case to git.
- Give R6 and R16 a scenario each for the file-to-directory swap.

### B5. Item 42's own run, the one task 5.3 plans, leaves this repository reverted with no signal and no recovery command.

Task 5.3 closes item 42 "on a `mutation-killed` receipt from its own command". On this branch the
revert puts `src/cli.ts`, `src/hooks.ts`, `src/gate.ts` and `src/closing.ts` back to the start and
deletes `src/mutation*.ts`.

- The process doing the run is safe, because every import is static (no dynamic import in `src/`).
- Everything else that runs `bin/mstack` from this tree runs the start's code:
  - the hooks of a `claude --plugin-dir .` session, which CLAUDE.md requires (`${CLAUDE_PLUGIN_ROOT}/bin/mstack`, `hooks/hooks.json`);
  - every `./bin/mstack` call.
- So for the length of the run the PreToolUse hook has no lock branch, and `git commit -am` is
  allowed. The Stop hook's gate has no lock check: a reverted tree there is only the
  "uncommitted change(s)" *warning* (`src/gate.ts:662-666`), and `gateFeedback` returns nothing
  unless something failed (`src/hooks.ts:290`). The model is told nothing.
- If the run dies (and on this suite the Bash tool's 120 s default makes that likely,
  assumption 6), `./bin/mstack verify --restore` answers `unknown command 'verify'`. At the start
  `main` has no `verify` case (`src/cli.ts:72-107`). The copy on PATH is older (CLAUDE.md).
- The manual recovery exists only as a message `--restore` prints for an unparseable lock
  (`design.md:97-100`).

To resolve:

- At lock time, print a recovery that needs only git, and write it beside the lock (for example
  `<git dir>/mstack-mutation.recover.sh`: `git restore --source=<head> --worktree -- <path>` per
  path HEAD has, `rm -f -- <path>` per path HEAD lacks).
- State in task 5.3 how item 42's own run is made: from a copy of the CLI at HEAD outside the
  tree (mstack has no runtime dependencies, so `git worktree add --detach <scratch> HEAD` and
  `<scratch>/bin/mstack verify --mutation` run with cwd in the checkout), with the Bash timeout
  above the measured duration or in the background. Say that a `--plugin-dir .` session's hooks
  are the start's code while it runs.
- Generalize: refuse, or warn on the first line, when the revert set contains the running CLI's
  own source. `cliProvenance` already resolves the running root (`src/cli.ts:1290-1300`).

Rung 2-3: read and walked. Not run, because the code does not exist.

## Non-blocking findings

**Signals and the runner**

- **N1. R17's "a signal received while the restore runs MUST NOT interrupt it" is not met by
  the design.** A group Ctrl-C kills `git()` children in both runtimes (`sig-exp.sh`), and
  `git()` is `execFileSync` in the caller's group (`src/git.ts:63`). Test `R17 SIGINT twice`
  must signal the group (`process.kill(-pgid)`, as `tests/run.test.ts:237` does), or it passes
  while Ctrl-C fails. Run the restore's git calls outside the terminal's group.
- **N2.** Install the signal handlers before `acquireLock`, not after it (design.md:124-125).
- **N13. Slow suites.** The default `--timeout` of 900 s is above the Bash tool's 600 s
  foreground ceiling. The docs task should say how an agent runs the command (timeout or
  background), and what a consumer with a slow suite pays: up to two full runs after every code
  or test change, and more often than that with B1.
- **N15. `runCommandAsync` (task 2.1).**
  - It cites `src/run.ts:93`, which is the argv. The bunfig and `.env` guarantee comes from
    `cwd: dir` at `:94-97`. Say so, and add `async: does not load bunfig.toml or .env` and a
    group-SIGINT test next to the four listed.
  - `--timeout` has no maximum, and `runCommand` throws above 2^31-1 ms (`src/run.ts:77-79`).

**The run and its receipt**

- **N3. A path that cannot be reverted is unspecified.** Make it `mutation-blocked`, then
  restore. Never run the obligations on a partial revert.
- **N4. Record a row only if the revert held.** Before the restore, check that every path of the
  lock is still at its start state and that the lock is still this run's own. Otherwise record
  nothing. This one check closes the false kills from `git stash`/`checkout .` in another
  terminal, editor saves, Claude's Edit/Write, and `--restore --force` under a live run.
- **N5. Overlapping baselines.** R7 refuses only a lock that already exists. Take the lock
  (empty list) before the baseline. A `gate --full` that started before the lock samples
  `treeId` after its runs (`src/gate.ts:789`) and can record a run that happened on the reverted
  tree as `clean`.
- **N6.** R6's "HEAD moves during the baseline" is not detected by calling `refusals` again
  (design.md:90): a clean tree at a new HEAD passes every refusal. Sample sha and key before the
  baseline and compare them after.
- **N8.** Exits of 128+n (`src/run.ts:47-53`) classify as killed, while R12 says a signal is
  blocked. Decide the rule and state it. Treating >128 as blocked trades away a crash that the
  revert genuinely caused.
- **N9.** State the flake risk, and recommend running the mutation alone (no parallel suites).
- **N10.** A baseline that times out records `failed` (R8/R9). The verification check then
  reports "ran and failed" for a command that was only slow.
- **N11.** R19 wants "the operating system's reason". `git()` discards stderr
  (`src/git.ts:66`), and the reason only appears there ("unable to unlink old 'src/a.ts':
  Permission denied", `git-exp.sh` case e).
- **N12.** `git hash-object --stdin-paths` resolves paths from the repository root, not from the
  cwd (`git-exp.sh` case f). The revert set's paths are relative to the store root
  (`--relative`). In a store in a subdirectory the key is then `null`, and R24 turns that into a
  non-overridable red. Add a subdirectory-store key test. Separately, `GIT_LITERAL_PATHSPECS=1`
  turns off the `:(top)`/`:(exclude)` magic `treeId` uses (`src/verification.ts:75`), and `git()`
  takes no `env` (`src/git.ts:70`).
- **N14. Key timing.** Say the key is sampled after the restore, as `treeId` is
  (`src/gate.ts:774-789`). The scenario "The run does not move its own key" has no test in any
  task. Untracked obligation output of the code class (`*.log`) enters the key, so deleting it
  later voids the receipt.

**What is reverted**

- **N7.** Covered in the grill: refuse, or restrict the revert to the first-parent non-merge
  commits `<start>..HEAD`, when a merge from the default branch lies after the start.
- **N17.**
  - If the obligations install, reverting `package.json` or a lockfile leaves the ignored
    `node_modules` at the start's state, with nothing saying so.
  - Reverting `.gitattributes` first changes how the later paths are written.
  - A code change that is only deletions survives by construction, like a refactor; say it
    closes the same way.
  - `mstack worktree prune` deletes `.git/worktrees/<name>/`, lock and rescue directory included.

**The hook, the gate and `--restore`**

- **N16.**
  - The PreToolUse branch misses shapes that R21 does not list: `git -C <repo>` or
    `cd <repo> &&` from a cwd outside the repository (only `input.cwd` is resolved);
    `git -C "dir with space" commit` (the `GIT` prefix takes `\S+`, `src/hooks.ts:359`);
    `"git" commit`; `npm version` (which runs git add and commit itself).
  - It also misses every other writer of the tree, the index or HEAD (`checkout`, `switch`,
    `restore`, `reset`, `merge`, `pull`, `rebase`, `rm`, `mv`, `clean`) and the Edit/Write
    tools. Either list them as not caught, or widen the regex; widening costs nothing.
  - "Any failure to read means allow" must not cover an unparseable lock. Existence decides, and
    parsing is only for the message.
  - The gate's line should tell a live run (pid alive) from a dead one. Otherwise the Stop hook
    sends the model to `--restore` a running run, and the refusal mentions `--force`.
  - SessionStart says nothing about a lock.
  - The gate prints the lock twice: the workspace line, plus `mutation-lock` at every active
    status.
  - `--restore` should kill an orphaned obligation group before restoring, which means recording
    its pgid in the lock.
  - Give "tree not restored" (R19) an exit code of its own instead of sharing 2 with
    blocked/refused.
  - Make `--restore` validate the lock's paths (relative, no `..`, no symlinked parent) against
    the current root, not the lock's `root`.
  - Say who removes a stale `<lock>.<pid>.tmp`, and what happens when the lock's host differs
    from the current host.

**Spec and task wording**

- **N18.**
  - R13's "WHEN a run ends with a restored and proven tree ... append one row" conflicts with
    R17's "record no row" after a signal: state which takes precedence.
  - R6's scenario path `.mstack/current.md` is `.mstack/progress/current.md`.
  - R19's scenario: a read-only `src/` also blocks every other path in `src/` (case e), so
    "every other path is restored" holds only outside `src/`.
  - The table at `spec.md:10` maps A2 to R13-R14, which are A1's receipt.
  - R16, R17, R18, R21 and R22 each carry several obligations, against "one obligation" in the
    agent's checklist; each clause does have a test.
- **N19. Tasks.**
  - 3.1 and 4.1 each bundle pieces a reviewer could approve and reject separately:
    - in 3.1, the receipt functions, the runner and the CLI;
    - in 4.1, the forced-marker refactor, the lock gate and the check.
  - 1.1's R2 tests cannot observe "during the obligations", because `applyRevert` arrives in
    2.2. Move them there.
  - 4.1's done criterion ("`gate --quiet` exits 0 once this item is closed or has a killed row")
    cannot be met inside the task, and passes for an unrelated reason: the item is not at
    `verifying` yet.
  - No automated test runs `kill -9` on a real `verify --mutation` and then `verify --restore`.
    2.2 tests it through a holder at the module level, and 5.1 does it by hand.
  - 3.1 lists no CLI tests for `--restore`: no lock exits 0, a live pid exits 2, `--force`.
  - 5.1-5.3 name no R-ids.
  - Keep the three existing forced-close markers byte-identical (`tests/cli.test.ts:704`,
    `tests/r-table-check.test.ts:363-364`).

## Completeness

Moved unchanged to `.mstack/progress/attachments/spec_review_mutation-check.md` on 2026-11-19, to bring this report under the 24576 byte cap. No finding and no verdict line was edited.

## What I did not check

- No new code exists, so every behaviour of the planned modules is rung 2-3: read and walked,
  not run.
- I did not re-run the author's `git restore` experiment for the executable bit and the
  symlink type change (their rung 4).
- Durability: I checked only that the link and directory fsync calls succeed on APFS under node
  and bun (`lock-exp.sh`: `linked`, `EEXIST` on the second run, `dir fsync ok`). I did not check
  whether `fs.fsyncSync` uses `F_FULLFSYNC` on macOS under either runtime, so power-loss ordering
  is not established.
- Nothing was run on Linux (CI) or on a case-insensitive rename.
- I did not check how Claude Code's Bash tool ends a command at its timeout (which signal, whether
  to the group).
- I did not check what git leaves on disk when it is killed in the middle of writing a file:
  `sh -c sleep` stood in for the child.
- LFS, clean/smudge filters and editor autosave behaviour: reasoned about, not tried.
