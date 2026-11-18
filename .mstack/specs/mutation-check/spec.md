> Source: item 42 and its design row in `.mstack/decisions.tsv` (2026-11-18T12:32:13Z).
> This spec is authoritative for implementation; `./bin/mstack state show 42` remains the
> discussion venue.

Acceptance bullets of item 42, and where each is covered:

| Bullet | Covered by |
|---|---|
| A1: `verify --mutation` reverts the code part of base..HEAD in place, confirms a green baseline, runs the obligations, records killed / survived / blocked keyed by code tree | R1-R12, R26, R27 |
| A2: the lock, restore in `finally` and on SIGINT/SIGTERM, a clean tree afterwards, `verify --restore`, PreToolUse denies commit/add/stash, the gate fails on a lock | R13-R22 |
| A3: from `verifying`, base + size other than `s` + code diff needs a killed receipt at the current code tree, in the gate and at `done` | R22-R25 |

Terms. *The start* is `measureStart(store, base).from` (`src/size.ts:70`), the same commit
the size check measures from. *Code path* is a path under the store's root, outside the store
directory, that `classifyPath` calls `code` (`src/pathclass.ts:50`, `src/size.ts:138-141`).
*The obligations* are `obligations(state, item)` (`src/verification.ts:106`). *The lock* is
the file `mstack-mutation.lock` in the git directory that `git rev-parse --absolute-git-dir`
prints for the store's root (a linked worktree has its own). *The revert set* is every code
path whose content or mode differs between the start and the working tree.

## ADDED Requirements

### Requirement: R1 The command works on the one active item
WHEN `mstack verify --mutation` runs, the system MUST operate on the single active item of the
store, and IF there is no active item, or `--mutation` and `--restore` are both given or both
absent, THEN the system MUST refuse with exit 2, touch nothing, and say which.

#### Scenario: No active item
- **WHEN** `verify --mutation` runs in a store whose items are all `done` or `pending`
- **THEN** it exits 2 naming "no active item", writes no lock and no row

#### Scenario: Neither flag
- **WHEN** `mstack verify` runs with no flag
- **THEN** it exits 2 and the message names `--mutation` and `--restore`

### Requirement: R2 What is reverted and to what
WHEN a mutation run reverts, the system MUST bring every path of the revert set to its content
and mode at the start, in the working tree only: a path added since the start is removed, a
path deleted since the start is put back, a modified path (content, executable bit, or type:
file to symlink and back) gets its start content and mode, and a rename is the removal of the
new path plus the putting back of the old one.

#### Scenario: Added, deleted, modified, renamed
- **WHEN** since the start the item added `src/new.ts`, deleted `src/old.ts`, edited `src/a.ts`
  and renamed `src/b.ts` to `src/c.ts`
- **THEN** during the obligations `src/new.ts` and `src/c.ts` do not exist, and `src/old.ts`,
  `src/b.ts` and the start version of `src/a.ts` do

#### Scenario: Binary, symlink and mode
- **WHEN** the revert set holds a binary file, a symlink whose target changed, and a script
  whose executable bit was set
- **THEN** during the obligations the binary is byte-identical to its start version, the link
  has its start target, and the script is not executable

#### Scenario: The index is not touched
- **WHEN** a mutation run is in progress or has ended
- **THEN** `git diff --cached` is empty

### Requirement: R3 What is not reverted
The system MUST NOT revert, delete or rewrite any path that is a test, a doc, under the store
directory, outside the store's root, an untracked file, an ignored file, or a submodule entry,
and MUST list each submodule entry that differs from the start as "not reverted".

#### Scenario: Tests and docs stay
- **WHEN** the item changed `src/a.ts`, `tests/a.test.ts`, `docs/x.md` and `.mstack/state.json`
- **THEN** during the obligations only `src/a.ts` is at its start content

#### Scenario: Store in a subdirectory
- **WHEN** the store is `pkg/app/.mstack` and the item also changed `other/lib.ts`
- **THEN** `other/lib.ts` is not in the revert set and `pkg/app/src/x.ts` is

### Requirement: R4 An empty code diff is refused
IF the revert set is empty, THEN the system MUST refuse with exit 2, saying that no code changed
since the start and naming the start, and MUST NOT take the lock or write a row.

#### Scenario: Only tests and docs changed
- **WHEN** the item's commits touch `tests/` and `docs/` only
- **THEN** `verify --mutation` exits 2 with "no code changed since <start>", `verification.tsv`
  is unchanged and no lock exists

### Requirement: R5 Refusals on the repository
IF the store is not in a git repository, or the active item has no `base`, or the base is not
a commit, or `measureStart` finds no start (`why: "lost"`), or `obligations` is empty, or a
rebase, merge, cherry-pick, revert or bisect is in progress, THEN the system MUST refuse with
exit 2, name which, say what fixes it, and touch nothing.

#### Scenario: A rebase in progress
- **WHEN** `verify --mutation` runs while `.git/rebase-merge` exists
- **THEN** it exits 2 naming the rebase and writes no lock

#### Scenario: A detached HEAD is allowed
- **WHEN** HEAD is detached on a commit with a start and a code diff
- **THEN** the run proceeds as on a branch

#### Scenario: No obligations
- **WHEN** `state.json` has no `verify` and the item has no `verification`
- **THEN** it exits 2 naming both fields and writes no lock

### Requirement: R6 Refusals on the working tree
IF a tracked file outside the store directory has an uncommitted change (staged or unstaged),
or an untracked or ignored entry already exists at a path the revert would put back (or at a
parent of it), THEN the system MUST refuse with exit 2, list up to ten of the paths, and
touch nothing.

#### Scenario: A dirty tracked file
- **WHEN** `src/a.ts` is modified and uncommitted
- **THEN** it exits 2 naming `src/a.ts`; the file is byte-identical afterwards

#### Scenario: The state file being dirty is normal
- **WHEN** only `.mstack/state.json` and `.mstack/current.md` are modified
- **THEN** the run is not refused

#### Scenario: An untracked file in the way
- **WHEN** the item deleted `src/old.ts` and an untracked `src/old.ts` exists
- **THEN** it exits 2 naming `src/old.ts`; the untracked file is unchanged

#### Scenario: The tree moved during the baseline
- **WHEN** a tracked file is edited, or HEAD moves, while the baseline runs
- **THEN** it exits 2 before taking the lock, saying what changed

### Requirement: R7 One run at a time
IF the lock exists, THEN a new `verify --mutation` MUST refuse with exit 2 and a message that
names the lock's pid and start time and says `mstack verify --restore`, without touching any
file; and WHEN two runs start at the same moment, exactly one MUST take the lock.

#### Scenario: Two processes
- **WHEN** two `verify --mutation` processes are started together
- **THEN** one runs and the other exits 2 naming the first one's pid

#### Scenario: A lock left by a crash
- **WHEN** the lock exists and its pid is not running
- **THEN** `verify --mutation` exits 2 and the message says the run died and to run
  `verify --restore`

### Requirement: R8 The baseline comes first
WHEN every obligation has a `passed` receipt at the current sha and tree fingerprint
(`status(...).satisfied`, `src/verification.ts:384`, tree not `unknown`), the system MUST
count it as the baseline and not run the obligations; otherwise the system MUST run each
obligation in order before reverting anything, record a `passed` or `failed` receipt for each
exactly as `gate --full` does, and stop at the first that does not pass.

#### Scenario: A recorded green counts
- **WHEN** `gate --full` passed at this commit and tree, then `verify --mutation` runs
- **THEN** the baseline is printed as "recorded green, not re-run" and the obligations run once
  in total (on the reverted tree)

#### Scenario: A stale green does not count
- **WHEN** the last green receipt is from another commit
- **THEN** the obligations run for the baseline first

### Requirement: R9 A red baseline is blocked
IF a baseline obligation fails, times out or cannot start, THEN the system MUST NOT revert
anything and MUST record `mutation-blocked`, print that the baseline is red, and exit 2.

#### Scenario: Red baseline
- **WHEN** the project's `verify` exits 1 at the current tree
- **THEN** nothing is reverted, no lock is taken, one `failed` receipt and one
  `mutation-blocked` row are appended, and the exit code is 2

### Requirement: R10 Killed
WHEN an obligation exits with a code other than 0, 126 and 127 on the reverted tree, the
system MUST stop running further obligations, record `mutation-killed`, and exit 0 after the
restore.

#### Scenario: A test fails without the change
- **WHEN** the obligation exits 1 on the reverted tree
- **THEN** the row is `mutation-killed`, the exit code is 0, and the output names the
  obligation and prints the last 20 lines of its output

#### Scenario: The reverted tree does not compile
- **WHEN** the obligation exits 2 because a test imports a symbol the revert removed
- **THEN** the row is `mutation-killed`; the output says that a build failure and an assertion
  failure cannot be told apart from an exit code

### Requirement: R11 Survived
WHEN every obligation exits 0 on the reverted tree, the system MUST record
`mutation-survived`, print the revert set as the list of paths nothing noticed, and exit 1
after the restore.

#### Scenario: Tests that do not bite
- **WHEN** the suite passes with `src/a.ts` at its start content
- **THEN** the row is `mutation-survived`, the exit code is 1 and the output lists the
  reverted paths

### Requirement: R12 Blocked
IF an obligation on the reverted tree times out (default 900 seconds, `--timeout <seconds>`
sets it), or exits 126 or 127 (the shell could not run it), or is killed by a signal that is
not the user's, or cannot be spawned, THEN the system MUST record `mutation-blocked`, restore,
and exit 2.

#### Scenario: The revert removed the script
- **WHEN** the item added `scripts/check.sh`, its `verification` is `scripts/check.sh`, and the
  baseline passed
- **THEN** on the reverted tree the shell exits 127 and the row is `mutation-blocked`, not
  killed

#### Scenario: A hang
- **WHEN** the obligation runs past `--timeout 5`
- **THEN** its process group is killed, the tree is restored, the row is `mutation-blocked`
  and the output says "timed out after 5s"

### Requirement: R13 The receipt row
WHEN a run ends with a restored and proven tree, the system MUST append one row to
`verification.tsv` with the existing six columns: `target` = the item's slug, `sha` = HEAD
when the obligations ran, `command` = the obligation commands joined with ` && `, `outcome` =
`mutation-killed`, `mutation-survived` or `mutation-blocked`, `ts`, and `tree` = `code:` plus
the fingerprint of R14; and MUST NOT add a column, record the reverted runs as `passed` or
`failed`, or let a mutation row satisfy a verification obligation.

#### Scenario: A killed row
- **WHEN** a run is killed
- **THEN** `tail -1 .mstack/verification.tsv` has six cells, the fourth is `mutation-killed`
  and the sixth starts with `code:`

#### Scenario: Old files and old readers
- **WHEN** `verification.tsv` was written by a version without this feature, or a mutation row
  is read by one
- **THEN** the old rows read unchanged; the old reader ignores the mutation row and
  `status(...)` is the same with or without it

### Requirement: R14 What the receipt is keyed by
The system MUST compute the code fingerprint over the revert set only: for each code path that
differs between the start and the working tree, its path, its start mode and content (or
absent), and its working-tree mode and content (or absent, a symlink's target string, an
untracked file's bytes); sorted by path. A change to any of those MUST change the
fingerprint; a change to a test, a doc, a store file, the sha, or the commit graph that leaves
those unchanged MUST NOT.

#### Scenario: What voids
- **WHEN** a killed receipt exists and `src/a.ts` is edited (committed or not), or a new code
  file is added, or the executable bit of a code file changes
- **THEN** the closing check no longer finds a receipt at the current fingerprint

#### Scenario: What does not void
- **WHEN** a killed receipt exists and then a docs file, a test file or a store file is
  committed, or the branch is rebased so the sha changes but no code path differs
- **THEN** the closing check still finds the receipt

#### Scenario: The run does not move its own key
- **WHEN** a run ends
- **THEN** the fingerprint computed after the restore equals the one in the row

### Requirement: R15 The lock is written first
WHEN a run has passed its preconditions and the baseline, the system MUST create the lock
atomically (write a complete temporary file in the git directory, fsync it, link it to
`mstack-mutation.lock` so that an existing lock fails the link, fsync the directory) before
it touches any file of the revert set, and the lock MUST hold the pid, the host name, the start
time, the HEAD sha, the start sha, the store's root and the revert set as (path, kind) pairs,
which is enough to restore with no other state than the repository.

#### Scenario: The lock precedes the first change
- **WHEN** the run is stopped by an injected failure at the step "lock written, nothing reverted"
- **THEN** the lock is complete and parseable and `git status --porcelain` shows no change to
  any code path

#### Scenario: A linked worktree
- **WHEN** the run is in a linked worktree
- **THEN** the lock is in that worktree's git directory (`.git/worktrees/<name>/`) and the main
  worktree's `verify --mutation` is not refused by it

### Requirement: R16 Restore after the run and what clean means
WHEN the obligations end, whatever the outcome, an exception, or an early exit, the system MUST
restore every path of the revert set to its content and mode at the lock's HEAD sha, then prove
the restore, and only then remove the lock. The proof is: every path of the lock matches the
HEAD sha (content and mode, or absent where HEAD has none), and no tracked file outside the
store directory differs from HEAD. IF the run left untracked files that did not exist before,
THEN the system MUST list them and leave them.

#### Scenario: Clean afterwards
- **WHEN** a run ends in any outcome
- **THEN** `git status --porcelain` is what it was before the run, and the lock does not exist

#### Scenario: The obligations changed a tracked file
- **WHEN** the obligation rewrites a tracked snapshot file not in the revert set
- **THEN** the proof fails, the lock stays, the output names the file and says it was changed by
  the obligations, and the file is not overwritten

#### Scenario: The obligations leave a new untracked file
- **WHEN** the obligation writes an untracked `out.log`
- **THEN** the run ends normally and the output says "left in place: out.log"

### Requirement: R17 Signals
WHEN the process receives SIGINT, SIGTERM or SIGHUP while obligations run, the system MUST kill
the obligation's whole process group, restore and prove the tree as in R16, remove the lock,
record no row, and exit 130, 143 or 129 respectively; and a signal received while the restore
runs MUST NOT interrupt it. A signal during the baseline MUST stop the obligations and exit
the same codes with nothing touched.

#### Scenario: SIGTERM mid-run
- **WHEN** SIGTERM is sent to the `mstack` process while a 30-second obligation runs on the
  reverted tree
- **THEN** within 10 seconds the process exits 143, no obligation process survives, the tree
  is as before, no lock exists and no row was added

#### Scenario: SIGINT twice
- **WHEN** a second SIGINT arrives while the restore runs
- **THEN** the restore completes and the tree is clean

### Requirement: R18 `verify --restore`
WHEN `mstack verify --restore` runs, the system MUST read the lock and, for each path in it,
find which of three states the working tree is in (at the HEAD sha; at the start; neither)
and put every path not at HEAD back, with the same proof and the same removal of the lock as
R16, and the command MUST be safe to run twice. IF there is no lock, THEN it MUST exit 0 and
say there is nothing to restore; IF the lock's pid is running on the lock's host, THEN it MUST
refuse with exit 2 naming the pid, unless `--force` is given (pids are reused after a reboot).

#### Scenario: A live run is not restored under its feet
- **WHEN** a run is in progress and `verify --restore` runs without `--force`
- **THEN** it exits 2 naming the running pid and changes no file

#### Scenario: Killed with the lock written and nothing reverted
- **WHEN** SIGKILL lands at the step "lock written, nothing reverted"
- **THEN** `verify --restore` exits 0, changes no file, removes the lock

#### Scenario: Killed half reverted
- **WHEN** SIGKILL lands after two of five paths were reverted
- **THEN** `verify --restore` puts back the two, leaves the other three untouched, and
  `git status --porcelain` is what it was before the run

#### Scenario: Killed fully reverted
- **WHEN** SIGKILL lands during the obligations
- **THEN** `verify --restore` puts back all five paths

#### Scenario: Killed half restored, and run twice
- **WHEN** SIGKILL lands after three of five paths were restored, and `verify --restore` is run
  twice
- **THEN** the first run puts back the remaining two, the second says there is nothing to restore

#### Scenario: A torn file
- **WHEN** a path holds neither the HEAD content nor the start content (a write cut by a power
  loss, or an edit by the user)
- **THEN** its current bytes are copied to `<git dir>/mstack-mutation.rescue/<path>` first,
  the path is put back, and the output names the rescue copy

### Requirement: R19 A restore that fails keeps the lock
IF restoring or proving fails for any path (a read-only directory, a vanished object), THEN the
system MUST keep the lock, continue with the other paths, name each failed path with the
operating system's reason, say "run `mstack verify --restore` after fixing it", and exit 2; and
a run whose restore failed MUST NOT record a row.

#### Scenario: A read-only directory
- **WHEN** `src/` is made read-only during the run so that `src/old.ts` cannot be put back
- **THEN** every other path is restored, the lock stays, the exit code is 2 and the output names
  `src/old.ts`; after `chmod u+w src`, `verify --restore` exits 0

### Requirement: R20 HEAD moved while the lock existed
IF HEAD is not the lock's HEAD sha when a restore runs (a commit was made despite the hook),
THEN the system MUST restore the working tree to the lock's HEAD sha content, say that HEAD
moved and name both shas, and leave the commit alone.

#### Scenario: A commit of the reverted tree
- **WHEN** a commit was made while the tree was reverted and `verify --restore` runs
- **THEN** the working tree has the item's code again, `git diff HEAD` shows the difference
  against the bad commit, and the output names the old and the new HEAD

### Requirement: R21 The PreToolUse hook denies commit, add and stash
WHILE the lock exists in the git directory of the hook input's `cwd`, the system MUST deny any
Bash command that has a segment running `git commit`, `git add` or `git stash` (including with
git's global options and in a compound command), with a reason that names the lock and
`mstack verify --restore`; and MUST NOT run a git process for a command that has no such
segment, and MUST allow every command when the lock is absent or git cannot answer.

#### Scenario: Shapes caught
- **WHEN** the lock exists and the command is `git commit -m x`, `git -C sub commit -am x`,
  `git -c user.name=a add .`, `cd x && git stash`, or `echo ok; git add -A`
- **THEN** the hook prints a `permissionDecision: "deny"` whose reason names `verify --restore`

#### Scenario: Not caught, said so
- **WHEN** the command is `git ci` through a user alias, `git-commit`, or an interpreter
  one-liner
- **THEN** the hook allows it (a speed bump in front of the obvious spelling, as `GUARDS` is);
  the gate and the closing check are the backstop

#### Scenario: No lock
- **WHEN** the lock does not exist
- **THEN** `git commit -m x` is allowed as before

### Requirement: R22 The gate and the done transition refuse a lock
WHILE the lock exists, `mstack gate` MUST fail, whatever the item's status and even with no
active item, with a line that names the pid, the start time, the number of paths and the fix
`mstack verify --restore`; `gate --full` MUST NOT run any obligation or write any receipt; and
`state set <slug> --status done` MUST refuse without `--force` being able to override it.

#### Scenario: A lock and a green store
- **WHEN** the lock exists and nothing else is wrong
- **THEN** `gate --quiet` exits 1 and its stderr line contains `verify --restore`

#### Scenario: The Stop hook
- **WHEN** the lock exists and the Stop hook runs
- **THEN** its additional context lists the same line as a gate failure

#### Scenario: Close with a lock
- **WHEN** an item at `verifying` with a killed receipt is closed with `--force` while the lock
  exists
- **THEN** `state set` exits 2 and the item stays `verifying`

### Requirement: R23 The closing check holds an item to a killed receipt
WHEN an item is at `verifying` (gate) or is being moved to `done` (`state set`), has a `base`,
has a size other than `s` (including no size), and its revert set is not empty, the system MUST
report a problem unless the last `verification.tsv` row with the item's slug as `target`, a
`mutation-*` outcome, the current fingerprint in `tree`, and a `command` equal to the current
obligations joined as in R13, is `mutation-killed`; and the problem MUST say which of these
holds: no run, a run at another code state, the last run survived, the last run was blocked,
or the obligations changed since.

#### Scenario: Gate at verifying
- **WHEN** an item at `verifying` has a base, size `m` and a code diff and no row
- **THEN** `gate --quiet` exits 1 and the line says "no mutation run" and `mstack verify --mutation`

#### Scenario: A killed receipt turns it green
- **WHEN** the last row at the current fingerprint is `mutation-killed`
- **THEN** the check reports nothing

#### Scenario: A later survived row wins
- **WHEN** a killed row is followed by a survived row at the same fingerprint
- **THEN** the check reports "the last run survived"

#### Scenario: The obligations changed
- **WHEN** the item's `verification` was edited after the killed run
- **THEN** the check reports that the obligations changed since the run

### Requirement: R24 Who is not held to it
The system MUST NOT report the mutation problem for an item with no `base`, an item of size
`s`, an item with an empty revert set, or, in the gate, an item at a status before `verifying`
(`state set --status done` runs the check whatever the status, as it does every closing
check, `src/closing.ts:178`); and IF git cannot
answer (the base is not a commit, no start, a failed diff), THEN the system MUST report a
problem that `--force` cannot override and that names `mstack state set <slug> --base <commit>`.

#### Scenario: Each exemption
- **WHEN** an item at `verifying` has no base, or size `s`, or only test changes
- **THEN** `gate --quiet` prints nothing about mutation and exits as without the check

#### Scenario: Base not found
- **WHEN** the item's base is not a commit git can find
- **THEN** the gate fails with a line naming `state set <slug> --base <commit>`

### Requirement: R25 A forced close past it is on the record
WHEN `state set <slug> --status done --force --closed-by "<why>"` closes an item whose only
or one of whose problems is the mutation check, the system MUST print a line saying the item
was closed without a killed mutation receipt, MUST store in `closed_by` a marker naming the
mutation check (and each other overridden check), and MUST keep that marker across any later
`--closed-by`; and WITHOUT `--closed-by` it MUST refuse, as the existing forced closes do.

#### Scenario: The refactor
- **WHEN** a refactor at `verifying` has a surviving row and is closed with `--force
  --closed-by "pure refactor, behaviour unchanged"`
- **THEN** the command exits 0, prints "forced: closed without a killed mutation receipt", and
  `closed_by` in `state.json` starts with a marker containing "mutation"

#### Scenario: Marker survives a later note
- **WHEN** `state set <slug> --closed-by "merged in #12"` runs afterwards
- **THEN** `closed_by` still starts with the marker and ends with "merged in #12"

#### Scenario: No reason given
- **WHEN** `--force` is given without `--closed-by`
- **THEN** it exits 2 and the item stays `verifying`

### Requirement: R26 What it prints while it works
The system MUST print to stdout, in order, one line per phase prefixed `mutation: ` (the item and
its start with why that start; the revert set's size; the baseline as recorded or run, per
obligation, with its duration; the lock's path; "reverting N file(s)"; each reverted-tree
obligation as it starts, with its duration when it ends; "restoring"; "restored, tree
verified"), then a final line beginning with the outcome word; and for a killed or blocked
outcome the last 20 lines of the obligation's output; and MUST NOT stream the obligations'
own output while they run.

#### Scenario: A killed run, in order
- **WHEN** a run is killed
- **THEN** stdout lines appear in the order above and the last line starts `mutation-killed:`

### Requirement: R27 Cost and exit codes
The system MUST run each obligation at most twice per invocation (once for the baseline, once
on the reverted tree; the baseline zero times when a recorded green counts), and MUST exit 0
for killed, 1 for survived, 2 for blocked and for every refusal, and 130, 143 or 129 after a
signal; `verify --restore` exits 0 or 2.

#### Scenario: Count of runs
- **WHEN** two obligations pass the baseline and both pass on the reverted tree
- **THEN** four runs happened in total; if the first fails on the reverted tree, three
