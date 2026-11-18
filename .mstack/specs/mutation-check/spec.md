> Source: item 42 and its three design rows in `.mstack/decisions.tsv` (2026-11-18T12:32:13Z,
> the decision; 12:40:58Z, the key covers code and tests; 13:02:23Z, round 2 after the spec
> review). This spec is authoritative for implementation; `./bin/mstack state show 42` remains
> the discussion venue.

Acceptance bullets of item 42, and where each is covered. A1 and A3 say "code tree"; the
amendment of 12:40:58Z widens the receipt's key to code and tests, and this spec follows it
(R14). The exemption for an item with no code diff stays on code (R24).

| Bullet | Covered by |
|---|---|
| A1: verify --mutation reverts the code part of base..HEAD in place (store, tests and docs excluded), confirms a green baseline first, runs the obligations and records mutation-killed, mutation-survived or mutation-blocked in verification.tsv keyed by code tree | R1-R14, R26-R29, R33, R34 |
| A2: A lock under the git dir holds the restore list; restore runs in finally and on SIGINT/SIGTERM, the tree is clean afterwards, verify --restore repairs a SIGKILLed run, PreToolUse denies git commit/add/stash while the lock exists, and the gate fails on a lock | R15-R22, R30-R32, R35-R43 |
| A3: From verifying, an item with base, size other than s and a code diff needs a killed receipt at the current code tree, enforced in the gate and at the done transition | R23-R25, R41 |

## Terms

- *The start* is `measureStart(store, base).from` (`src/size.ts:70`), and *why* is its `why`.
- A path is *in scope* when it is under the store's root and outside the store directory. Its
  *class* is what `classifyPath` (`src/pathclass.ts:50`) says of it relative to the store's
  root: `code`, `test` or `doc`.
- *The code diff* is the set of tracked in-scope code paths whose content or mode differs
  between the start and the working tree, without submodule entries. It is *empty* when it holds
  no path; R4, R23 and R24 use that one meaning. An untracked file is never in it.
- *The revert set* is the set of tracked in-scope code paths whose content or mode differs
  between the start and HEAD, without submodule entries. R6 refuses a run while a tracked file
  outside the store directory has an uncommitted change, so at run time it holds exactly the
  paths of the code diff. Nothing untracked or ignored is ever in it.
- *The key set* is the set of in-scope code and test paths, tracked or untracked and not
  ignored, whose content or mode differs between the start and the working tree; an untracked
  path is absent at the start. Docs and the store directory are never in it.
- An *identity* is what a path holds: *absent*; a *file* (the SHA-256 of its bytes and whether
  it is executable); or a *symlink* (its target string). A path holds *absent* when no file and
  no symlink is at it; a directory there counts as absent, since git tracks no directories. A
  fifo or a device equals no identity.
- *H(p)* is the identity of path p in the working tree when the lock is taken. R6 guarantees
  that git sees it as HEAD's p, so H(p) is HEAD's content as checked out in this tree, and
  absent where HEAD has no p.
- *S(p)* is the identity the revert writes at p: the start's content of p as git checks it out
  in this tree (filters and line endings applied, `git cat-file --filters`), with the start's
  mode; absent where the start has no p.
- *The lock* is the file `mstack-mutation.lock` in the git directory that `git rev-parse
  --absolute-git-dir` prints for the store's root (a linked worktree has its own).
- *The run directory* is `<git dir>/mstack-mutation/<run id>/`, made for one run and never
  reused. The run id is the UTC start time, the pid and four random hex digits, for example
  `20261118T140211Z-4242-9f3a`. *The rescue directory* is its `rescue/` subdirectory.
- *The tree changed under the run* is defined in R29.

## ADDED Requirements

### Requirement: R1 The command works on the one active item
WHEN `mstack verify --mutation` runs, the system MUST operate on the single active item of the
store, and MUST refuse with exit 2, touching nothing, when there is no active item or when not
exactly one of `--mutation` and `--restore` is given. (`--restore` needs no active item, R18.)

#### Scenario: No active item
- **WHEN** `verify --mutation` runs in a store whose items are all `done` or `pending`
- **THEN** it exits 2 naming "no active item", and writes no lock, no run directory and no row

#### Scenario: Neither flag, or both
- **WHEN** `mstack verify` runs with no flag, or with `--mutation --restore`
- **THEN** it exits 2 and the message names `--mutation` and `--restore`

### Requirement: R2 What is reverted and to what
WHEN a mutation run reverts, the system MUST bring every path p of the revert set to S(p) in the
working tree only: a path added since the start is removed, a path deleted since the start is
put back, a modified path (content, executable bit, or type: file to symlink and back) gets its
start content and mode, a rename is the removal of the new path plus the putting back of the
old one, and a file that became a directory, or a directory that became a file, is put back as
the start had it.

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

#### Scenario: A file that became a directory
- **WHEN** the start has a file `src/x` and HEAD has a directory `src/x/` holding `a.ts`
- **THEN** during the obligations `src/x` is the start's file, and after the restore `src/x/a.ts`
  is HEAD's

#### Scenario: Line endings as checked out here
- **WHEN** `.gitattributes` gives `*.txt text eol=crlf` and the revert set holds `src/t.txt`
- **THEN** during the obligations `src/t.txt` holds the start's content with CRLF line endings,
  which is what `git checkout <start> -- src/t.txt` would write

#### Scenario: The index is not touched
- **WHEN** a mutation run is in progress or has ended
- **THEN** `git diff --cached` is empty

### Requirement: R3 Nothing outside the revert set is touched
The system MUST NOT write, move or remove, during a run or a restore, any file that is not a
path of the revert set (a test, a doc, a path under the store directory or outside the store's
root, an untracked or ignored file, a submodule entry), other than its own temporary files,
which are gone before the lock is, and the directories it creates, which it removes when they
are empty; and MUST list each submodule entry that differs from the start as "not reverted".

#### Scenario: Tests and docs stay
- **WHEN** the item changed `src/a.ts`, `tests/a.test.ts`, `docs/x.md` and `.mstack/state.json`
- **THEN** during the obligations only `src/a.ts` is at its start content

#### Scenario: Store in a subdirectory
- **WHEN** the store is `pkg/app/.mstack` and the item also changed `other/lib.ts`
- **THEN** `other/lib.ts` is not in the revert set and `pkg/app/src/x.ts` is

#### Scenario: Untracked files stay where they are
- **WHEN** an untracked `src/wip.ts` and an untracked `notes.txt` exist when the run starts
- **THEN** both are byte-identical during and after the run, and neither is named in the lock

#### Scenario: A submodule entry
- **WHEN** a submodule's recorded commit differs between the start and HEAD
- **THEN** the run lists it as "not reverted" and leaves it alone

### Requirement: R4 An empty code diff is refused
IF the code diff is empty, THEN the system MUST refuse with exit 2, saying that no code changed
since the start and naming the start, and MUST NOT take the lock or write a row.

#### Scenario: Only tests and docs changed
- **WHEN** the item's commits touch `tests/` and `docs/` only
- **THEN** `verify --mutation` exits 2 with "no code changed since <start>", `verification.tsv`
  is unchanged and no lock exists

#### Scenario: The only code is untracked
- **WHEN** nothing committed changed code and an untracked `src/wip.ts` exists
- **THEN** it exits 2 with the same message and `src/wip.ts` is unchanged

### Requirement: R5 Refusals on the repository
IF the store is not in a git repository, or the active item has no `base`, or the base is not a
commit, or `measureStart` finds no start (`why: "lost"`), or `obligations` is empty, or a
rebase, merge, cherry-pick, revert or bisect is in progress, or the start's content of a path
of the revert set cannot be read, THEN the system MUST refuse with exit 2, name which, say what
fixes it, and leave no lock, no run directory and no row.

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
IF a tracked file outside the store directory has an uncommitted change (staged or unstaged);
or, at a path the revert writes or at one of its parent directories, an entry exists that the
revert does not itself remove first (an untracked or ignored file, a symlink, or a directory
holding such an entry); or, after the baseline ran, HEAD is not the commit it was before the
baseline or a tracked file outside the store directory has an uncommitted change; THEN the
system MUST refuse with exit 2, list up to ten of the paths, and touch nothing: no lock, no run
directory, no row and no baseline receipt.

#### Scenario: A dirty tracked file
- **WHEN** `src/a.ts` is modified and uncommitted
- **THEN** it exits 2 naming `src/a.ts`; the file is byte-identical afterwards

#### Scenario: The store's own files being dirty is normal
- **WHEN** only `.mstack/state.json` and `.mstack/progress/current.md` are modified
- **THEN** the run is not refused

#### Scenario: An untracked file in the way
- **WHEN** the item deleted `src/old.ts` and an untracked `src/old.ts` exists
- **THEN** it exits 2 naming `src/old.ts`; the untracked file is unchanged

#### Scenario: A directory with an untracked file in the way
- **WHEN** the start has a file `src/x`, HEAD has `src/x/a.ts`, and an untracked
  `src/x/notes.txt` exists
- **THEN** it exits 2 naming `src/x/notes.txt`; `src/x/` and both files in it are unchanged

#### Scenario: An untracked symlink at a parent
- **WHEN** the item deleted the directory `src/lib/` and an untracked symlink `src/lib` points
  outside the repository
- **THEN** it exits 2 naming `src/lib`; nothing is written through the link

#### Scenario: A case-only rename on a case-insensitive filesystem
- **WHEN** the item renamed `src/Foo.ts` to `src/foo.ts` on a case-insensitive filesystem
- **THEN** the run is not refused, because the entry in the way is the one the revert removes
  first

#### Scenario: The tree moved during the baseline
- **WHEN** a tracked file is edited, or a commit is made, while the baseline runs
- **THEN** it exits 2 before taking the lock, saying what changed, and records no baseline
  receipt

### Requirement: R7 One run at a time
IF the lock exists, THEN a new `verify --mutation` MUST refuse with exit 2 and a message that
names the lock's pid and start time and says `mstack verify --restore`, without touching any
file; and WHEN two runs reach the lock at the same moment, exactly one MUST take it.

#### Scenario: Two processes
- **WHEN** two processes try to take the lock together
- **THEN** one takes it and the other refuses, naming the first one's pid

#### Scenario: A lock left by a crash
- **WHEN** the lock exists and its pid is not running
- **THEN** `verify --mutation` exits 2 and the message says the run died and to run
  `verify --restore`

### Requirement: R8 The baseline comes first
WHEN every obligation has a `passed` receipt at the current sha and tree fingerprint
(`status(...).satisfied`, `src/verification.ts:384`, tree not `unknown`), the system MUST count
it as the baseline and not run the obligations; otherwise the system MUST run each obligation in
order before reverting anything, with captured output and the `--timeout` bound, record a
`passed` or `failed` receipt for each as `gate --full` does (one tree fingerprint, sampled after
the last), and stop at the first that does not pass.

#### Scenario: A recorded green counts
- **WHEN** `gate --full` passed at this commit and tree, then `verify --mutation` runs
- **THEN** the baseline is printed as "recorded green at this tree, not re-run" and the
  obligations run once in total (on the reverted tree)

#### Scenario: A stale green does not count
- **WHEN** the last green receipt is from another commit
- **THEN** the obligations run for the baseline first

### Requirement: R9 A red baseline is blocked
IF a baseline obligation exits with a code other than 0, cannot start, or times out, THEN the
system MUST NOT revert anything, MUST record `mutation-blocked`, print that the baseline is red
(or that it timed out, with the bound), and exit 2; it records a `failed` receipt for a non-zero
exit or a failure to start, and no receipt for a timeout.

#### Scenario: Red baseline
- **WHEN** the project's `verify` exits 1 at the current tree
- **THEN** nothing is reverted, no lock is taken, one `failed` receipt and one
  `mutation-blocked` row are appended, and the exit code is 2

#### Scenario: A slow baseline
- **WHEN** the baseline obligation runs past `--timeout 2`
- **THEN** its process group is killed, one `mutation-blocked` row and no `failed` receipt are
  appended, and the output says "baseline timed out after 2s"

### Requirement: R10 Killed
WHEN an obligation on the reverted tree exits with a code other than 0, 126 and 127, including
128+n (a process inside it died of signal n), the system MUST stop running further obligations,
end the run as `mutation-killed`, and exit 0 after the restore.

#### Scenario: A test fails without the change
- **WHEN** the obligation exits 1 on the reverted tree
- **THEN** the outcome is `mutation-killed`, the exit code is 0, and the output names the
  obligation and prints the last 20 lines of its output

#### Scenario: The reverted tree does not compile
- **WHEN** the obligation exits 2 because a test imports a symbol the revert removed
- **THEN** the outcome is `mutation-killed`; the output says that a build failure and an
  assertion failure cannot be told apart from an exit code

#### Scenario: A crash
- **WHEN** the obligation exits 139 on the reverted tree
- **THEN** the outcome is `mutation-killed` and the output says "exit 139 (a process inside it
  died of signal 11)"

### Requirement: R11 Survived
WHEN every obligation exits 0 on the reverted tree, the system MUST end the run as
`mutation-survived`, print the revert set as the list of paths nothing noticed, and exit 1 after
the restore.

#### Scenario: Tests that do not bite
- **WHEN** the suite passes with `src/a.ts` at its start content
- **THEN** the outcome is `mutation-survived`, the exit code is 1 and the output lists the
  reverted paths

### Requirement: R12 Blocked
IF an obligation on the reverted tree times out (default 900 seconds; `--timeout <seconds>`
sets it, an integer from 1 to 2147483), or exits 126 or 127 (the shell could not run it), or its
shell is ended by a signal mstack did not send, or it cannot be spawned, THEN the system MUST
end the run as `mutation-blocked`, restore, and exit 2.

#### Scenario: The revert removed the script
- **WHEN** the item added `scripts/check.sh`, its `verification` is `scripts/check.sh`, and the
  baseline passed
- **THEN** on the reverted tree the shell exits 127 and the outcome is `mutation-blocked`, not
  killed

#### Scenario: A hang
- **WHEN** the obligation runs past `--timeout 2`
- **THEN** its process group is killed, the tree is restored, the outcome is `mutation-blocked`
  and the output says "timed out after 2s"

### Requirement: R13 The receipt row
WHEN a run ends killed, survived or blocked (R9-R12, R34), its restore passed the proof of R16,
no signal reached it (R17), and the tree did not change under it (R29), the system MUST append
exactly one row to `verification.tsv` with the existing six columns: `target` = the item's
slug, `sha` = HEAD when the obligations ran, `command` = the obligation commands joined with
` && `, `outcome` = `mutation-killed`, `mutation-survived` or `mutation-blocked`, `ts`, and
`tree` = `mutation:` plus the fingerprint of R14 computed after the restore; and in every other
case it MUST append no mutation row. It MUST NOT add a column, record the reverted runs as
`passed` or `failed`, or let a mutation row satisfy a verification obligation.

#### Scenario: A killed row
- **WHEN** a run is killed
- **THEN** `tail -1 .mstack/verification.tsv` has six cells, the fourth is `mutation-killed`
  and the sixth starts with `mutation:`

#### Scenario: Old files and old readers
- **WHEN** `verification.tsv` was written by a version without this feature, or a mutation row
  is read by one
- **THEN** the old rows read unchanged; the old reader ignores the mutation row and
  `status(...)` is the same with or without it

#### Scenario: No row when the run did not hold
- **WHEN** a run ends with a restore that failed, after a signal, or with the tree changed
  under it
- **THEN** `verification.tsv` has no new mutation row

### Requirement: R14 What the receipt is keyed by
The system MUST compute the fingerprint over the key set (code and tests): for each path,
sorted by path, the path, whether it is tracked, its start mode and blob (or absent), and its
identity in the working tree (for a regular file, the blob id git would store for it); a change
to any of those MUST change the fingerprint, and a change to a doc, a store file, the sha or the
commit graph that leaves them unchanged MUST NOT.

#### Scenario: What voids
- **WHEN** a killed receipt exists and then `src/a.ts` or `tests/a.test.ts` is edited
  (committed or not), or a code or test file is added, or an untracked test file is committed,
  or the executable bit of a code file changes
- **THEN** the closing check no longer finds a receipt at the current fingerprint

#### Scenario: What does not void
- **WHEN** a killed receipt exists and then a docs file or a store file is committed, or the
  branch is rebased so the sha changes but no code or test path differs
- **THEN** the closing check still finds the receipt

#### Scenario: The run does not move its own key
- **WHEN** a run ends and appends a row
- **THEN** the fingerprint computed after the run equals the one in the row

#### Scenario: A store in a subdirectory
- **WHEN** the store is `pkg/app/.mstack` and `pkg/app/src/x.ts` and `pkg/app/tests/x.test.ts`
  differ from the start, one of them untracked
- **THEN** the fingerprint is not null, and an edit to `pkg/app/tests/x.test.ts` changes it

### Requirement: R15 The lock is written first
WHEN a run has passed its preconditions and its baseline, the system MUST create the lock
atomically (write a complete temporary file in the git directory, fsync it, link it to
`mstack-mutation.lock` so that an existing lock fails the link, fsync the directory) before it
writes any path of the revert set, and the lock MUST hold the run id, the pid, the host name,
the start time, the HEAD sha, the start sha, the store's root, for each path p of the revert
set H(p) and S(p), the directories the revert creates and removes, and the recovery of R31;
with the copies staged in the run directory, that is all a restore needs.

#### Scenario: The lock precedes the first change
- **WHEN** the run is stopped at the step "lock written, nothing reverted"
- **THEN** the lock is complete and parseable and `git status --porcelain` shows no change to
  any code path

#### Scenario: A linked worktree
- **WHEN** the run is in a linked worktree
- **THEN** the lock is in that worktree's git directory (`.git/worktrees/<name>/`) and the main
  worktree's `verify --mutation` is not refused by it

#### Scenario: Leftovers of a killed start
- **WHEN** a run was SIGKILLed after making its run directory and before linking its lock,
  leaving a run directory and a temporary lock file
- **THEN** the next `verify` removes both, since no lock names that run and its rescue
  directory is empty

### Requirement: R16 Restore, proven per path, before the lock goes
WHEN the obligations end, whatever the outcome, an exception or an early exit, the system MUST
restore every path p of the lock to H(p) under the rules of R30, then prove the restore path by
path (p holds H(p), in the sense of the Terms), and remove the lock only once
that proof holds; nothing else (HEAD, the index, other files) decides whether the lock is
removed.

#### Scenario: Clean afterwards
- **WHEN** a run ends in any outcome
- **THEN** `git status --porcelain --untracked-files=no` is what it was before the run, the lock
  does not exist, and the run directory is gone unless its rescue directory holds something

#### Scenario: Another tracked file changed during the run
- **WHEN** the obligation rewrites a tracked snapshot file that is not in the revert set
- **THEN** the lock is removed, the snapshot file is left as the obligation wrote it, and R32
  names it

#### Scenario: A `git add` during the run
- **WHEN** `git add src/a.ts` runs from another terminal while the tree is reverted
- **THEN** the working tree is restored, the lock is removed, and the index is left as that
  command left it

### Requirement: R17 Signals during the obligations
WHEN the process receives SIGINT, SIGTERM or SIGHUP while obligations run on the reverted tree,
the system MUST kill the obligation's whole process group, restore and prove the tree as in R16,
remove the lock, record no row, and exit 130, 143 or 129 respectively.

#### Scenario: SIGTERM to mstack alone
- **WHEN** SIGTERM is sent to the `mstack` process alone while a 30-second obligation runs on
  the reverted tree
- **THEN** within 10 seconds the process exits 143, no obligation process survives, the tree
  is as before, no lock exists and no row was added

#### Scenario: Ctrl-C to the whole process group
- **WHEN** SIGINT is sent to the process group of `mstack` (what a terminal's Ctrl-C does)
  while the obligation runs on the reverted tree
- **THEN** the process exits 130, no obligation process survives, the tree is as before and no
  lock exists

### Requirement: R18 `verify --restore`
WHEN `mstack verify --restore` runs and a lock exists whose run is not alive (R38), the system
MUST restore every path of the lock under R30, prove it as in R16, remove the lock, and leave the
tree the same however many times it is run.

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
- **THEN** the first run puts back the remaining two, and the second says there is nothing to
  restore (R37)

### Requirement: R19 A restore that fails keeps the lock
IF writing or proving fails for any path (a permission, a staged copy that is missing or does
not match its identity), THEN the system MUST keep the lock, continue with the other paths, name
each failed path with the operating system's error, say what to fix and to run `mstack verify
--restore` (or `sh <lock>`) after, record no row, and exit 3.

#### Scenario: A read-only directory
- **WHEN** `lib/ro/` is made read-only during the run, so that `lib/ro/x.ts` cannot be put back
- **THEN** `src/a.ts` is restored, the lock stays, the exit code is 3 and the output names
  `lib/ro/x.ts` with "permission denied"; after `chmod u+w lib/ro`, `verify --restore` exits 0

### Requirement: R20 HEAD moved while the lock existed
IF HEAD is not the lock's HEAD sha when a restore runs (a commit was made despite the hook),
THEN the system MUST restore every path to H(p), the lock's own record, remove the lock under
R16's proof, say that HEAD moved, name both shas, name `git reset --soft <lock HEAD>` as the
user's option, and leave the commit alone.

#### Scenario: A commit of the reverted tree
- **WHEN** `git commit -am x` ran from another terminal while the tree was reverted, and the run
  ends
- **THEN** the working tree has the item's code again, the lock is removed, `git diff HEAD` shows
  the item's code against the new commit, and the output names the old and the new HEAD and
  `git reset --soft <old HEAD>`

### Requirement: R21 The PreToolUse hook denies commands that write the tree, the index or HEAD
WHILE the lock exists in the git directory of the hook input's `cwd`, the system MUST deny any
Bash command that has a segment running git `add`, `am`, `apply`, `checkout`, `cherry-pick`,
`clean`, `commit`, `merge`, `mv`, `pull`, `rebase`, `reset`, `restore`, `revert`, `rm`, `stash`
or `switch` (including with git's global options and in a compound command), with a reason that
names the lock, `mstack verify --restore` and `sh <lock path>`.

#### Scenario: Shapes caught
- **WHEN** the lock exists and the command is `git commit -m x`, `git -C sub commit -am x`,
  `git -c user.name=a add .`, `cd x && git stash`, `echo ok; git add -A` or `git checkout .`
- **THEN** the hook prints a `permissionDecision: "deny"` whose reason names `verify --restore`

#### Scenario: Not caught, said so
- **WHEN** the command is `git ci` through a user alias, `git-commit`, `"git" commit`,
  `git -C "dir with space" commit`, an interpreter one-liner, `npm version`, or a `git -C <repo>`
  from a `cwd` outside the repository; or the change is made with the Edit or Write tool, which
  the hook's `Bash` matcher does not see
- **THEN** the hook allows it (a speed bump in front of the obvious spelling, as `GUARDS` is);
  R16, R29 and the gate are the backstop

### Requirement: R22 The gate fails on a lock
WHILE the lock exists, `mstack gate` MUST fail, whatever the item's status and with no active
item, with one line in its workspace section that names the pid, whether it is running on this
host, the start time, the number of paths and the fix (wait for a run that is running;
`mstack verify --restore` for one that is not; `sh <lock path>` with git alone); a lock that
cannot be parsed fails the gate too.

#### Scenario: A lock and a green store
- **WHEN** a lock whose pid is not running exists and nothing else is wrong
- **THEN** `gate --quiet` exits 1 and its one stderr line contains "not running" and
  `verify --restore`

#### Scenario: A live run
- **WHEN** the lock's pid is running on this host
- **THEN** the line says "running" and its fix says to wait for it, not to run `--restore`

#### Scenario: The Stop hook
- **WHEN** the lock exists and the Stop hook runs
- **THEN** its additional context lists the same line as a gate failure

#### Scenario: Once
- **WHEN** the lock exists and the active item is at `verifying`
- **THEN** the gate prints the lock line once

### Requirement: R23 The closing check holds an item to a killed receipt
WHEN an item is at `verifying` (gate) or is being moved to `done` (`state set`), has a `base`,
has a size other than `s` (including no size), and its code diff is not empty, the system MUST
report a problem unless, among the `verification.tsv` rows with the item's slug as `target`, a
`mutation-*` outcome, the current fingerprint (R14) in `tree` and a `command` equal to the
current obligations joined as in R13, the last one that is `mutation-killed` or
`mutation-survived` is `mutation-killed`; a `mutation-blocked` row never decides. The problem
MUST say which of these holds: no run, a run at another code or test state, the last decisive
run survived, only blocked runs at this state, or the obligations changed since.

#### Scenario: Gate at verifying
- **WHEN** an item at `verifying` has a base, size `m`, a code diff and no row
- **THEN** `gate --quiet` exits 1 and the line says "no mutation run" and
  `mstack verify --mutation`

#### Scenario: A killed receipt turns it green
- **WHEN** the last decisive row at the current fingerprint is `mutation-killed`
- **THEN** the check reports nothing

#### Scenario: A later survived row wins
- **WHEN** a killed row is followed by a survived row at the same fingerprint
- **THEN** the check reports "the last run survived"

#### Scenario: A later blocked row does not void a killed one
- **WHEN** a killed row is followed by a blocked row at the same fingerprint
- **THEN** the check reports nothing

#### Scenario: The obligations changed
- **WHEN** the item's `verification` was edited after the killed run
- **THEN** the check reports that the obligations changed since the run

#### Scenario: A test edited after the run
- **WHEN** `tests/a.test.ts` is edited after the killed run
- **THEN** the check reports a run at another code or test state

### Requirement: R24 Who is not held to it
The system MUST NOT report the mutation problem for an item with no `base`, an item of size
`s`, an item whose code diff is empty, or, in the gate, an item at a status before `verifying`
(`state set --status done` runs the check whatever the status, as it does every closing check,
`src/closing.ts:178`); and IF git cannot answer (the base is not a commit, no start, a failed
diff or key), THEN the system MUST report a problem that `--force` cannot override and that
names `mstack state set <slug> --base <commit>`.

#### Scenario: Each exemption
- **WHEN** an item at `verifying` has no base, or size `s`, or only test changes, or only an
  untracked code file
- **THEN** `gate --quiet` prints nothing about mutation and exits as without the check

#### Scenario: Base not found
- **WHEN** the item's base is not a commit git can find
- **THEN** the gate fails with a line naming `state set <slug> --base <commit>`, and
  `state set --status done --force --closed-by x` exits 2

### Requirement: R25 A forced close past it is on the record
WHEN `state set <slug> --status done --force --closed-by "<why>"` closes an item one of whose
problems is the mutation check, the system MUST print a line saying the item was closed without
a killed mutation receipt, MUST store in `closed_by` a marker that names the mutation check and
each other overridden check, and MUST keep that marker across any later `--closed-by`; WITHOUT
`--closed-by` it MUST refuse, as the existing forced closes do; and the three markers that exist
today MUST stay byte-identical for the cases they cover now.

#### Scenario: The refactor
- **WHEN** a refactor at `verifying` has a surviving row and is closed with `--force
  --closed-by "pure refactor, behaviour unchanged"`
- **THEN** the command exits 0, prints "forced: closed without a killed mutation receipt", and
  `closed_by` in `state.json` starts with "closed without a killed mutation receipt (forced): "

#### Scenario: Marker survives a later note
- **WHEN** `state set <slug> --closed-by "merged in #12"` runs afterwards
- **THEN** `closed_by` still starts with the marker and ends with "merged in #12"

#### Scenario: No reason given
- **WHEN** `--force` is given without `--closed-by`
- **THEN** it exits 2 and the item stays `verifying`

#### Scenario: The markers that exist today
- **WHEN** a forced close overrides only the verification check, only the requirement-to-test
  table, or both
- **THEN** `closed_by` starts with "closed unverified (forced): ", "closed without a good
  requirement-to-test table (forced): " or "closed unverified and without a good
  requirement-to-test table (forced): ", as before

### Requirement: R26 What it prints while it works
The system MUST print to stdout, in order, one line per phase prefixed `mutation: ` (the item
and its start with why that start; the revert set's size; the baseline as recorded or run, per
obligation, with its duration; the lock's path and run id; the recovery of R31; "reverting N
file(s)"; each reverted-tree obligation as it starts, and its exit and duration when it ends;
"restoring"; each rescued path; "restored, tree verified, lock removed"; the report of R32),
then a final line beginning with the outcome word, then, for a killed or blocked outcome, the
last 20 lines of the obligation's output; and MUST NOT stream the obligations' own output while
they run.

#### Scenario: A killed run, in order
- **WHEN** a run is killed
- **THEN** stdout lines appear in the order above and the last `mutation`-prefixed line before
  the tail starts `mutation-killed:`

### Requirement: R27 Cost and exit codes
The system MUST run each obligation at most twice per invocation (once for the baseline, once on
the reverted tree; the baseline zero times when a recorded green counts), and MUST exit 0 for
killed, 1 for survived, 2 for blocked, for every refusal and for a tree that changed under the
run, 130, 143 or 129 after a signal, and 3 whenever the tree could not be restored (3 wins over
every other code); `verify --restore` exits 0 when it restored or had nothing to restore, 2 when
it refused, and 3 when the restore failed.

#### Scenario: Count of runs
- **WHEN** two obligations pass the baseline and both pass on the reverted tree
- **THEN** four runs happened in total; if the first fails on the reverted tree, three

#### Scenario: Exit codes
- **WHEN** runs end killed, survived, blocked, and with a read-only directory that defeats the
  restore
- **THEN** they exit 0, 1, 2 and 3

### Requirement: R28 The running CLI is never reverted
IF a path of the revert set, resolved to an absolute real path, lies inside the root directory
of the mstack copy that is running (`runningCliRoot()`, `src/paths.ts:99`), THEN the system
MUST refuse with exit 2 before taking the lock, name up to ten such paths, and print the
commands that make a copy of the CLI at HEAD outside the tree (`git worktree add --detach <dir>
HEAD`), run `verify --mutation` from it, and remove it afterwards.

#### Scenario: This repository
- **WHEN** `./bin/mstack verify --mutation` runs in an mstack checkout whose item changed
  `src/cli.ts`
- **THEN** it exits 2 naming `src/cli.ts`, the message contains `git worktree add --detach`, and
  nothing is written

#### Scenario: From the copy
- **WHEN** the same command runs from `<copy>/bin/mstack` with the checkout as its `cwd`
- **THEN** it is not refused by this rule

### Requirement: R29 No receipt when the tree changed under the run
IF the tree changed under the run, which is any of: (a) a path p of the revert set did not hold
S(p) when the obligations ended; (b) HEAD is not the lock's HEAD sha; (c) the lock is no longer
this run's own (it is gone, or names another run id); (d) after the restore, the index differs
from HEAD at any path outside the store directory, or a tracked code or test path outside the
revert set differs from HEAD in the working tree; THEN the
system MUST record no mutation row, end with a line beginning `mutation-blocked: the tree
changed under the run` that names which of (a)-(d) held and the paths, and exit 2 (3 if the
restore failed); and in case (c) it MUST NOT write any path, since the lock is no longer its own.

#### Scenario: An edit to a reverted file during the run
- **WHEN** `src/a.ts` is edited while the obligations run on the reverted tree
- **THEN** no row is appended, the final line names (a) and `src/a.ts`, and R30 saves the edit

#### Scenario: A commit during the run
- **WHEN** a commit is made from another terminal while the obligations run
- **THEN** no row is appended and the final line names (b); R20 describes the restore

#### Scenario: A forced restore under the run
- **WHEN** `verify --restore --force` runs while the obligations run, and the obligations then
  end
- **THEN** the run writes nothing more, appends no row, says the lock was taken from it, and
  exits 2

#### Scenario: A test snapshot rewritten during the run
- **WHEN** the obligation rewrites a tracked file `tests/__snapshots__/a.snap`
- **THEN** no row is appended and the final line names (d) and that path

### Requirement: R30 Restore writes only over what the revert wrote
WHEN a restore puts a path p of the lock back, the system MUST write H(p) directly only where p
holds S(p), holds nothing, or is an empty directory; where p holds a file or a symlink whose
identity is neither S(p) nor H(p), it MUST first move it into the run's rescue directory at
`rescue/<p>`, never replacing anything already there, and name the rescued copy in its output;
and where H(p) is a file or symlink and p is a directory that holds anything, or a parent of p
is not a directory, it MUST leave it as it is, keep the lock, and name what is in the way (exit
3, R19).

#### Scenario: An edit to a reverted file
- **WHEN** `src/a.ts` holds content that is neither the start's nor HEAD's when the restore
  runs
- **THEN** that content is at `<git dir>/mstack-mutation/<run id>/rescue/src/a.ts`, byte for
  byte, `src/a.ts` holds HEAD's content, and the output names the rescued copy

#### Scenario: A directory in the way, holding a file
- **WHEN** the start has a directory `src/y/` holding `b.ts`, HEAD has a file `src/y`, and
  during the run an untracked `src/y/out.log` is written
- **THEN** `src/y/out.log` is left where it is, the lock stays, the exit code is 3 and the
  output names `src/y/out.log`; once it is moved elsewhere, `verify --restore` exits 0

#### Scenario: A second incident
- **WHEN** two runs each rescue `src/a.ts`
- **THEN** each copy is in its own run directory and the first is byte-identical to what it was

#### Scenario: A symlinked parent
- **WHEN** during the run `lib/` is replaced by a symlink to a directory outside the repository
- **THEN** nothing is written through it, the lock stays, and the output names `lib`

### Requirement: R31 A recovery that needs only git
WHEN the lock is taken, the system MUST make the lock itself a POSIX shell script that puts every
path of the revert set back to the lock's HEAD sha with git and `rm`/`rmdir` alone (each path
HEAD lacks removed with `rm -f`, each directory the revert created removed with `rmdir` when
empty, the others written by one `git restore --source=<HEAD sha> --worktree` under
`GIT_LITERAL_PATHSPECS=1`, and the lock removed only if that command succeeded), and MUST print
those commands on stdout before it reverts anything, with `sh <lock path>` as the way to run
them.

#### Scenario: A killed run, recovered without mstack
- **WHEN** a run is SIGKILLed during the obligations and `sh .git/mstack-mutation.lock` is run
- **THEN** `git status --porcelain` is what it was before the run and the lock is gone

#### Scenario: Printed first
- **WHEN** a run takes the lock
- **THEN** the recovery commands appear on stdout before the line "reverting N file(s)"

### Requirement: R32 Other changes are reported and do not hold the lock
WHEN a restore has removed the lock, the system MUST report every tracked file outside the store
directory that differs from HEAD in the working tree or the index and did not when the run
began, and every untracked file that did not exist when the run began ("left in place"), each
with the git command that shows it, without saying who or what changed it and without writing
any of them.

#### Scenario: Untracked output
- **WHEN** the obligation writes an untracked `out.log`
- **THEN** the run ends normally and the output says "left in place: out.log"

#### Scenario: A changed tracked file
- **WHEN** a tracked `tests/__snapshots__/a.snap` was rewritten during the run
- **THEN** the output names it with `git diff -- tests/__snapshots__/a.snap`, does not say
  "obligations", and the file is as it was left

### Requirement: R33 A merge between the start and HEAD is refused
IF the start is the item's base (`why` is `base`) and a merge commit lies between the start and
HEAD (`git rev-list --merges <start>..HEAD` prints one), THEN the system MUST refuse with exit 2
before anything is touched, name the merge commit and the start, say that the code since the
start may hold commits that are not the item's, and name as fixes a rebase onto the default
branch and `mstack state set <slug> --base <commit>`.

#### Scenario: The default branch merged in after the base
- **WHEN** the base is a commit on the branch and `main` was merged into the branch after it
- **THEN** `verify --mutation` exits 2 naming the merge commit and `--base`, and nothing is
  written

#### Scenario: The same work rebased
- **WHEN** the branch was rebased onto `main` instead, so the start is where it left `main`
- **THEN** the run is not refused by this rule

#### Scenario: A merge after a fork-point start
- **WHEN** the base is on `main`, `main` moved and was merged into the branch, and the start is
  therefore the fork point (`why` is `older`)
- **THEN** the run is not refused by this rule

### Requirement: R34 A revert that cannot complete runs nothing
IF writing S(p) fails for a path of the revert set, or a path does not hold H(p) when the revert
reaches it, THEN the system MUST stop reverting, run no obligation, restore as in R16, end the
run as `mutation-blocked`, name the path with the operating system's error, and exit 2 (3 if the
restore fails).

#### Scenario: A path that cannot be written
- **WHEN** `src/deep/` is read-only when the revert must put back `src/deep/old.ts`
- **THEN** no obligation runs, every path already reverted is restored, the outcome is
  `mutation-blocked`, and the output names `src/deep/old.ts`

### Requirement: R35 Nothing interrupts a revert or a restore
WHILE the system holds the lock and is reverting or restoring, it MUST NOT be stopped by SIGINT,
SIGTERM or SIGHUP, whether sent to it alone or to its whole process group, and MUST act on such a
signal only once the restore and its proof are done (R17's exit code, no row); from taking the
lock to removing it, it MUST run no child process other than the obligations.

#### Scenario: Ctrl-C to the group during the restore
- **WHEN** SIGINT is sent to the process group while the restore runs
- **THEN** the restore completes, the tree is as before, no lock exists, and the exit code is
  130

#### Scenario: Twice
- **WHEN** a second SIGINT arrives while the restore runs
- **THEN** the restore completes and the tree is clean

#### Scenario: Just after the lock
- **WHEN** SIGTERM arrives between the lock being linked and the first path being reverted
- **THEN** the process does not die with the lock in place: it restores (nothing to do),
  removes the lock and exits 143

### Requirement: R36 A signal during the baseline
WHEN SIGINT, SIGTERM or SIGHUP arrives while the baseline runs, the system MUST kill the
obligation's process group, record no receipt for the interrupted obligation, touch nothing
else, and exit 130, 143 or 129.

#### Scenario: SIGHUP during the baseline
- **WHEN** SIGHUP is sent while a baseline obligation runs
- **THEN** the process exits 129, no obligation process survives, and no lock, run directory,
  receipt or row exists

### Requirement: R37 Nothing to restore
IF no lock exists, THEN `verify --restore` MUST exit 0, say there is nothing to restore, and
write nothing.

#### Scenario: No lock
- **WHEN** `verify --restore` runs in a repository with no lock
- **THEN** it exits 0 with "nothing to restore" and the tree and the git directory are unchanged

### Requirement: R38 `verify --restore` does not restore under a live run
IF the lock's pid is running on this host, or the lock was written on another host, THEN
`verify --restore` MUST refuse with exit 2 naming the pid and the host and write nothing, unless
`--force` is given (pids are reused after a reboot).

#### Scenario: A live run is not restored under its feet
- **WHEN** a run is in progress and `verify --restore` runs without `--force`
- **THEN** it exits 2 naming the running pid and changes no file

#### Scenario: With `--force`
- **WHEN** `verify --restore --force` runs under a live run
- **THEN** it restores and removes the lock, and the run records nothing (R29 (c))

#### Scenario: Another host
- **WHEN** the lock names a host other than this one
- **THEN** `verify --restore` exits 2 naming that host

### Requirement: R39 The hook asks git only when it must, and the lock's existence decides
The system MUST NOT run a git process in the PreToolUse hook for a command that has no segment
of R21's list; MUST allow every command when the lock is absent or git cannot name the git
directory; and MUST deny under R21 when the lock exists even if it cannot be parsed.

#### Scenario: An unrelated command
- **WHEN** the command is `ls -la`
- **THEN** no git process is started

#### Scenario: No lock
- **WHEN** the lock does not exist
- **THEN** `git commit -m x` is allowed as before

#### Scenario: Git cannot answer
- **WHEN** the `cwd` is not inside a git repository
- **THEN** `git commit -m x` is allowed

#### Scenario: An unparseable lock
- **WHEN** the lock exists and holds `garbage`
- **THEN** `git commit -m x` is denied

### Requirement: R40 `gate --full` runs nothing under a lock
WHILE the lock exists, `mstack gate --full` MUST run no obligation, record no receipt, and fail
saying that the tree is reverted by a mutation run.

#### Scenario: A full gate under a lock
- **WHEN** the lock exists and `gate --full` runs
- **THEN** it exits 1, no obligation ran, and `verification.tsv` is unchanged

### Requirement: R41 `done` is refused under a lock
WHILE the lock exists, `state set <slug> --status done` MUST refuse with exit 2, whatever
`--force` and `--closed-by` say, naming the lock and `mstack verify --restore`.

#### Scenario: Close with a lock
- **WHEN** an item at `verifying` with a killed receipt is closed with `--force --closed-by x`
  while the lock exists
- **THEN** `state set` exits 2 and the item stays `verifying`

### Requirement: R42 Rescued content is reported until it is removed
WHILE a rescue directory under `<git dir>/mstack-mutation/` holds any entry, `mstack gate` MUST
warn in its workspace section, naming the directory and the number of entries in it.

#### Scenario: After a rescue
- **WHEN** a restore moved `src/a.ts` into a rescue directory
- **THEN** `mstack gate` prints a warning naming that directory and "1 entry", and exits as it
  would without the warning

### Requirement: R43 The lock is checked before a restore writes
IF the lock cannot be parsed, or a path in it is absolute, empty, or has a `..` or `.git`
segment, THEN `verify --restore` MUST refuse with exit 2, write nothing, keep the lock, and name
what is wrong (for a lock that cannot be parsed, that `sh <lock path>` runs its recovery if its
commands are intact, to be read first); paths are resolved against the current store's root, and
the output says so when that differs from the root the lock names.

#### Scenario: A path outside the root
- **WHEN** the lock was edited to name `../outside.txt`
- **THEN** `verify --restore` exits 2 naming it, and `../outside.txt` and the lock are unchanged

#### Scenario: A lock that cannot be parsed
- **WHEN** the lock's header line is not valid JSON
- **THEN** `verify --restore` exits 2, names `sh <lock path>`, and the tree and the lock are
  unchanged
