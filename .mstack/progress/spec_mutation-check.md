# Spec hand-off, round 2: item 42 mutation-check

Author pass: spec-author by hand (plugin not loaded), not the reviewer. Revised at 6179767 on
`feat/mutation-check`; `./bin/mstack gate` was green before starting (`./bin/mstack version`:
mstack 0.2.1 at this checkout). Inputs: item 42, decisions.tsv rows 231, 232 and 233, the spec
review `.mstack/progress/spec_review_mutation-check.md`, the round 1 spec and hand-off, and the
code each claim cites (`src/verification.ts`, `closing.ts`, `size.ts`, `pathclass.ts`,
`hooks.ts`, `gate.ts`, `git.ts`, `run.ts`, `run-helper.mjs`, `cli.ts`, `paths.ts`, `tsv.ts`,
`worktree.ts`, `hooks/hooks.json`, `tests/run.test.ts`, `tests/helpers.ts`,
`tests/state-cli.test.ts`). Every `file:line` in design.md "Context" was re-read at 6179767.

Now: **43 requirements (R1-R43), 19 tasks in 5 groups.** No requirement was renumbered: R1-R27
keep their ids and topics, clauses that made one requirement carry several obligations moved to
new ids (table below), and R28-R43 are new.

Mechanism chosen for revert and restore: **the filesystem, with byte copies staged before the
lock**. The start's content is read with `git cat-file --filters` and HEAD's is copied from the
working tree into `<git dir>/mstack-mutation/<run id>/` before the lock is linked; the revert and
the restore then only `rename`, `unlink`, `mkdir` and `rmdir`, run no child process, and never
call a git command that can remove what it did not write. `rename` over a directory fails EISDIR
and `rmdir` of a non-empty one fails ENOTEMPTY instead of removing anything. The lock is a shell
script whose header holds the record and whose body is the git-only recovery.

## Review finding | what changed | where

| Finding | What changed | Where |
|---|---|---|
| B1 key covers tests | The key set is code and test paths, tracked or untracked, that differ from the start; each line records whether the path is tracked, so committing an untracked file changes the key. Prefix `code:` renamed `mutation:`. The exemption and "empty" stay on the code diff. Old trade-off and open question removed. Test-edit voids: scenario and tests. | spec Terms, R13, R14 (What voids), R23 (A test edited after the run), R24; design "The three sets and the key", "Trade-offs"; tasks 1.1 (`R14 a test edit voids...`, `R14 committing an untracked test file voids`), 4.1 (`R23 a test edited after the run`); proposal "What changes" |
| B2 untracked in the revert set | Revert set = tracked code paths that differ between the start and HEAD; code diff = tracked code paths that differ between the start and the working tree; "empty" defined once on the code diff and used by R4, R23, R24. Nothing untracked is in the set, the lock, moved or removed. | spec Terms, R3 (Untracked files stay where they are), R4 (The only code is untracked), R24; design "The three sets and the key"; tasks 1.1 (`R3 an untracked code file is not in the revert set`, `R4 ... only code is untracked`), 2.2 (`R3 untracked, test and doc files are byte-identical...`) |
| B3 proof had no terminal state | The proof is per path against H(p), the identity recorded when the lock was taken; nothing else decides the lock. HEAD moved, index changes, other tracked files and new untracked files are reported with the git command that shows each, never attributed, and never keep the lock; they block the row (R29). R20's outcome now matches the proof. All five cases walked in a table. | spec R16, R20, R29, R32; design "Restore", "Walks"; tasks 2.3 (`R16 a changed tracked file outside the set does not keep the lock`, `R16 a git add during the run does not keep the lock`, `R20 HEAD moved...`), 3.3 |
| B4 restore loses work | Restore writes H(p) directly only over S(p), nothing, or an empty directory; any other file or symlink is moved to `<git dir>/mstack-mutation/<run id>/rescue/<p>` first (one run directory per run, made with a non-recursive `mkdir`, exclusive names inside), named in the output, and warned on by the gate until removed. A directory holding anything where HEAD has a file is left, the lock kept, the contents named. Collisions refuse the run before anything is touched, including a directory with an untracked file and an untracked symlink at a parent. Mechanism changed from `git restore` to filesystem writes, tried in `fs-exp`. | spec R6 (three new scenarios), R30, R42; design "Context", "Revert", "Restore", "Experiments"; tasks 1.2 (`R6 directory with an untracked file in the way`, `R6 untracked symlink at a parent`), 2.3 (four `R30` tests), 4.3 (`R42`) |
| B5a recovery without mstack | The lock is a POSIX shell script: `sh <lock>` runs `rm -f` / `rmdir` / one `GIT_LITERAL_PATHSPECS=1 git restore --source=<head> --worktree` and removes the lock only if git succeeded. The commands are printed before the revert. | spec R15, R31; design "The lock", "Usage"; tasks 2.1 (`R31 the lock names every path...`), 2.3 (`R31 sh on the lock restores...`), 3.5 (`R31 the recovery is printed before the revert`) |
| B5b this repository | R28: a run refuses when a revert path lies inside the running CLI's root, and prints the copy commands. Task 5.3 is now step by step: the session (not `--plugin-dir .`; `--plugin-dir <copy>` or no mstack plugin), `git worktree add --detach "${TMPDIR:-/tmp}/mstack-42-cli" HEAD`, the baseline with `timeout: 600000`, the run with `run_in_background: true` and its completion notice, what `verify --restore` is run from if it dies (the copy, else `sh .git/mstack-mutation.lock`; not `./bin/mstack`, which has no `verify` while `src/` is reverted), and cleanup. Tried in `copy-exp`. | spec R28; design "Context", "This repository: running from a copy"; tasks 1.2, 3.5 (`R28 the CLI refuses to revert its own source`), 5.3 |
| N1 group Ctrl-C kills the restore | The restore and the revert run no child process (start bytes and HEAD backups are staged before the lock), and handlers that never exit the process are installed before anything is written, so a group SIGINT is acted on only after the restore. Requirement, scenarios, and two tests that signal the group. Tried in `sig-exp`. | spec R35; design "Restore", "The run" step 2; tasks 2.3 (`R35 the restore starts no child process`), 3.4 (`R35 SIGINT to the group during the restore...`, `R35 SIGINT twice...`) |
| N4 no row when the tree changed | "Changed under the run" defined: (a) a revert path not at S(p) when the obligations ended, (b) HEAD moved, (c) the lock no longer this run's, (d) any index change or a working-tree change to a code or test path outside the set. Outcome: no row, final line `mutation-blocked: the tree changed under the run` naming which and the paths, exit 2; in (c) the run writes nothing. | spec R29, R13 (precedence); design "The run" steps 6-9; tasks 3.3 (five `R29` tests) |
| N7 merge of the default branch | R33 refuses when the start is the base and `git rev-list --merges <start>..HEAD` prints a commit, naming the merge, a rebase and `--base`. A fork-point start after a merge is not refused, because the fork point already accounts for it. Tried in `merge-exp`. | spec R33; design "Refusals", "Experiments", "Rejected alternatives"; tasks 1.2 (three `R33` tests) |
| Async runner kept (point 9) | Kept, and every survivor guarantee `tests/run.test.ts` pins for the timed path is now a named `async:` test, plus `stop()` and "a handler runs while the command runs". The `:93` citation is corrected to `:93-97` for the bunfig/.env guarantee. | design "The async runner"; tasks 2.4 (14 tests) |
| N2 handlers before the lock | Installed first. | design "The run" step 2; spec R35 (Just after the lock); task 3.4 |
| N3 a path that cannot be reverted | R34: stop, run nothing, restore, blocked. | spec R34; tasks 2.2, 3.2 |
| N6 HEAD moved during the baseline | R6 re-checked after the baseline, plus "HEAD is the sampled sha"; nothing recorded on refusal. | spec R6 (The tree moved during the baseline); design "The run" step 3; task 3.2 |
| N8 128+n | Decided: killed, and the line names the signal. A shell ended by a signal mstack did not send stays blocked. | spec R10 (A crash), R12; design "Classifying" |
| N9 flakes | Stated; docs say run alone and last; a later survived row wins. | design "Trade-offs"; task 3.5 docs paragraph |
| N10 baseline timeout | No `failed` receipt for a timeout; blocked row. | spec R9 (A slow baseline); task 3.2 |
| N11 OS reason | Moot: the restore uses `fs`, whose errors carry the code and message. | design "Restore" |
| N12 hash-object paths | Absolute paths; subdirectory-store key test. Tried in `hash-exp`. No git call builds a pathspec from a set path. | spec R14 (A store in a subdirectory); design "The three sets and the key"; task 1.1 |
| N13 slow suites | `run_in_background`, `timeout: 600000`, the 120 s and 600 s limits, the cost of re-runs. `--timeout` bounded 1..2147483. | spec R12; tasks 3.5 (docs, `R12 --timeout must be...`), 5.1, 5.3 |
| N14 key timing | Sampled after the restore; "does not move its own key" now has a test. | spec R13, R14; task 3.2 (`R14 the run does not move its own key`) |
| N15 runner details | See point 9. | task 2.4 |
| N16 hook, gate, `--restore` | Taken: hook list widened to every git command that writes the tree, index or HEAD; existence decides, parsing is for the message; the gate's line says running or not; printed once (the lock is no longer a closing check); exit 3 for "not restored"; lock paths validated; an unparseable lock refused with `sh <lock>`; stale temp lock and staging swept; another host refused. Left: see "Left open". | spec R21, R22, R27, R38, R39, R41, R43, R15 (Leftovers); design "The lock", "The hook", "The closing check..." |
| N17 | Stated as trade-offs (dependencies, `.gitattributes`, deletion-only changes, worktree removal takes the rescue directory). | design "Trade-offs" |
| N18 wording | R13 vs R17 precedence stated in R13; `.mstack/progress/current.md`; R19's scenario uses `lib/ro/` so `src/a.ts` can be restored; A1-A3 mapping fixed and quoted verbatim; multi-obligation requirements split. | spec R6, R13, R19, the table at the top |
| N19 tasks | 3.1 and 4.1 split (receipt / outcomes / changed-under-run / signals / CLI; check / forced marker / gate and done / hook); R2 tests moved to the revert task; 4.1's done criterion no longer depends on closing this item; a CLI-level `kill -9` then `--restore` test; `--restore` CLI tests; every 5.x names R-ids; existing markers pinned byte-identical. | tasks 2.2, 3.1-3.5, 4.1-4.4, 5.1-5.4 |
| Grill: worktree rejection reason, stub alternative | The scratch-worktree rejection now leads with the per-ecosystem list and absolute cache paths; the empty-stub alternative is recorded as deferred. | design "Rejected alternatives" |

### Clauses moved to new ids (no id renumbered)

| Round 1 clause | Now |
|---|---|
| R16 "IF the run left untracked files ... list them and leave them" and its `out.log` scenario | R32 |
| R16 scenario "the obligations changed a tracked file: the proof fails, the lock stays" | reversed: R16 "Another tracked file changed during the run" (lock removed), R29 (d), R32 |
| R17 "a signal received while the restore runs MUST NOT interrupt it", scenario "SIGINT twice" | R35 |
| R17 "A signal during the baseline ..." | R36 |
| R18 "IF there is no lock, THEN exit 0" | R37 |
| R18 "IF the lock's pid is running ... refuse unless `--force`", scenario "A live run" | R38 |
| R18 scenario "A torn file" | R30 "An edit to a reverted file" |
| R18 test "unparseable lock is refused with the manual recovery" | R43 "A lock that cannot be parsed" |
| R21 "MUST NOT run a git process ...; MUST allow ... when the lock is absent or git cannot answer", scenario "No lock" | R39 |
| R22 "`gate --full` MUST NOT run any obligation" | R40 |
| R22 "`state set --status done` MUST refuse ...", scenario "Close with a lock" | R41 |
| R19 exit 2 | R19 exit 3 (R27) |

New: R28 (running CLI), R29 (changed under the run), R30 (rescue), R31 (git-only recovery), R33
(merge), R34 (partial revert), R42 (rescue warning), R43 (lock checks).

## Experiments this round

All under `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/spec42r2/`,
each a `bash` script starting `set -euo pipefail` with a checked `cd`, outputs saved as `*.out`
beside them. Results are in design.md "Experiments this round"; in short:

- `fs-exp.sh` (node and bun): `rename` of a file over a directory, empty or not, fails `EISDIR`
  and keeps the directory; `rmdir` of a non-empty one fails `ENOTEMPTY`; fs writes of HEAD's bytes
  leave `git status` clean and the index untouched; `cat-file --filters` gives the checked-out
  form (CRLF), binary byte-identical, and a symlink's target; symlink and mode changes round-trip;
  a second `mkdir` of a run directory and a second `wx` write fail `EEXIST`. Rung 4 on macOS only.
- `crlf-exp.sh`: regenerating HEAD from `git cat-file --filters` wrote different bytes than the
  tree held, and `git status` called the file modified. Reason for the byte backup.
- `sig-exp.sh`: a SIGINT to the whole group during a synchronous fs loop is handled after the
  loop, 30/30 steps done, both runtimes; with a synchronous child per step the in-flight child
  died of SIGINT, both runtimes. Reason for R35's "no child process".
- `copy-exp.sh`: in a `--no-local` clone, a detached worktree copy runs its own code with the
  clone as `cwd`, finds the clone's store, reports "the same committed src tree", and keeps
  running while the clone's `src/` is put back 40 commits; the clone's own `./bin/mstack verify`
  is then an unknown command.
- `merge-exp.sh`: the merged-main shape, the rebased shape, a stacked branch, and `main` after a
  `--no-ff` merge when `main` moved; R33's test separates them as intended.
- `hash-exp.sh`: from a subdirectory store, relative paths to `hash-object --stdin-paths` fail,
  absolute paths work.

Not checked: Linux (CI), a case-insensitive rename (its test skips on case-sensitive systems),
how the Bash tool ends a command at its timeout (5.3 avoids the question with
`run_in_background`), whether `fs.fsyncSync` reaches `F_FULLFSYNC` on macOS, LFS and other
smudge filters through `cat-file --filters`, and anything about the new code, which does not
exist: every behaviour of the planned modules is rung 2-3.

## Decided here, without asking

- **Untracked code and test files are in the key**, flagged as untracked. Row 232 leaves out only
  docs and the store, and an untracked new test that earned a kill must not be deletable after
  it. Cost (review N14): deleting untracked, non-ignored output such as `out.log` voids a
  receipt, as it changes `treeId` today.
- **Any index change during the run blocks the row** (R29 d), not only changes to code and tests:
  a staged reverted file is one `git commit` from a bad commit.
- **A blocked row never decides the closing check** (R23): it says the question could not be
  asked, so it does not void an earlier kill at the same key. Round 1 let the last row of any
  outcome decide.
- **Exit 128+n on the reverted tree is a kill** (N8), named as a signal in the output.
- **Exit 3** for "the tree could not be restored", winning over every other code.
- **The lock is a shell script** with the record on its second line, so the git-only recovery is
  the lock itself.
- **The lock is not taken before the baseline** (review N5): rejected with the reason in design.md
  "Rejected alternatives"; the overlap it guards can only record a false `failed`.
- **The lock is not a closing check**: the gate reports it once in its workspace section and the
  `done` branch refuses on it directly (N16: as a closing check it printed twice).
- **R33's rule** is "start is the base and a merge commit lies in `<start>..HEAD`", not the narrower
  "neither the base nor the fork point is an ancestor of the other", because the merge-commit
  close on `main` after `main` moved has the same defect and only the wider rule catches it
  (`merge-exp`, last block).

## Left open, and why

- Review N5 (lock before the baseline): rejected, see above.
- Review N16, the rest: SessionStart says nothing about a lock (the gate on the Stop hook does);
  `--restore` does not record or kill an orphaned obligation's process group after a SIGKILL
  (a pid in the lock can be reused, and killing a reused group is worse than an orphan); the hook
  still misses `git -C` from outside the repository, quoted `"git"`, aliases and `npm version`,
  now listed as not caught (R21).
- The empty-stub alternative to removing new files: deferred (design "Rejected alternatives").
- Default `--timeout` and a reason column for blocked rows: unchanged open questions.
- Closing on `main` after a merge commit when `main` moved: the receipt from the branch no longer
  matches and a run there is refused. Task 5.4 says what to do for item 42 (move `--base` to the
  merge's first parent, or re-run on the branch before merging); whether `skills/ship/SKILL.md`
  should close before merging is a workflow choice for the user, left in design.md "Open
  questions".

## Where I think the decided design is wrong or thin

1. **Row 233 (5) covers the mutation process, not the hooks.** In this repository a session
   started with `claude --plugin-dir .` (which CLAUDE.md asks for) runs every hook from this
   checkout's `src/` (`hooks/hooks.json`: `${CLAUDE_PLUGIN_ROOT}/bin/mstack`), so during item 42's
   own run the PreToolUse and Stop hooks are the start's code and know nothing of the lock. The
   CLI cannot see which plugin directory a session loaded, so R28 cannot enforce this; task 5.3
   makes it a stated precondition of the session. For items after 42 the start will contain the
   lock branch, so the hooks then run the start's code with it.
2. **The closing check at `done` and the ship order disagree** (row 231 with
   `skills/ship/SKILL.md` step 7, merge first and close after). Evidence: `merge-exp`, last block:
   on `main` after a `--no-ff` merge when `main` had moved, `base..HEAD` holds `main`'s own
   `src/m3.ts` and `src/other.ts`, so the key differs from the branch's receipt and R33 refuses a
   run there. Closing on the branch, or moving `--base` to the merge's first parent, works; the
   spec says so, and the user may prefer to change the ship order.
3. **Acceptance A1 and A3 still say "code tree"**; row 232 widened the key to code and tests. The
   spec follows the row and says so at the top of spec.md; the item's `acceptance` text in
   `state.json` was not edited, since this pass edits only the spec and this file.
4. **Row 233 (2), "each path's content at HEAD when the lock was taken"**, is implemented as the
   working tree's bytes at that moment, which git sees as HEAD's but which need not be the bytes a
   fresh checkout of HEAD would write (`crlf-exp`). Restoring those bytes is what puts the user's
   tree back; regenerating from HEAD is not.

## What the reviewer should try to break first

1. R30 and R16 together: lose a byte of the user's work, or keep the lock with deleting as the
   only way out. Edits to a reverted file, a directory where HEAD has a file, a symlinked parent,
   a `--restore --force` racing a live run, a SIGKILL between rename steps.
2. R35: a group Ctrl-C at `lock-written`, `reverted:n` and `restored:n`, and whether anything in
   `restoreFromLock` as designed still needs a child process.
3. The lock script of R31: paths with quotes, spaces, newlines, a leading `-`, `:(` magic; the
   order of `rm`, `rmdir` and `git restore` for file-to-directory swaps both ways.
4. R29's four conditions: a change under the run that none of them sees (an edit to an untracked
   file that existed before the run is not detected, by design; is that a hole for the key?).
5. R33's rule: a shape it refuses wrongly (a merge of the item's own sub-branch) or misses (a
   merge of a sibling branch when the start is the fork point).
6. R14's key: a clean filter that makes `hash-object` disagree with the bytes, and the
   tracked/untracked flag across a commit.
