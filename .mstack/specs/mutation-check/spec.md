> Source: item 42 (`./bin/mstack state show 42`) and its decision rows in `.mstack/decisions.tsv`
> (2026-11-18T12:32:13Z the decision, 12:40:58Z the key covers code and tests, 13:02:23Z round 2,
> 2026-11-19T08:27:17Z the user's answer to the fork, 08:27:32Z the design for this round). This
> spec is authoritative for implementation; the item remains the discussion venue. The closing
> check is item 100 (`mutation-closing-check`) and is not specified here.

| Acceptance bullet of item 42 | Covered by |
|---|---|
| A1: verify --mutation reverts the code part of the item diff in place (store, tests and docs excluded), confirms a green baseline first, runs the obligations and records mutation-killed, mutation-survived or mutation-blocked in verification.tsv keyed by the code and test tree | R1-R7, R9-R12, R20, R21 |
| A2: A lock under the git dir holds the restore list; restore runs in finally and on SIGINT/SIGTERM, the tree is as it was afterwards, verify --restore repairs a SIGKILLed run, PreToolUse denies git commit/add/stash while the lock exists, and the gate fails on a lock | R8, R13, R15-R17, R22-R24, R26, R27 |
| A3: No path through the run, the restore or a recovery the tool prints removes or overwrites content the run did not write without first saving it, and no state keeps the lock with deleting work as the only way out | R2, R3, R10, R11, R13-R15, R18, R19, R22-R25, R28; the state walk in design.md "Every state, and its exit" |

## Terms

- *The start* is `measureStart(store, base).from` (`src/size.ts:81`); *why* is its `why`.
- A path is *in scope* when it is under the store's root and outside the store directory. Its
  *class* is what `classifyPath` (`src/pathclass.ts:50`) says of it relative to the store's root.
- *The revert set* is the set of tracked in-scope `code` paths whose blob or mode differs
  between the start and HEAD. Nothing untracked, ignored or out of scope is ever in it.
- *The key set* is the set of in-scope `code` and `test` paths, tracked or untracked and not
  ignored, whose content or mode differs between the start and the working tree.
- An *identity* is *absent*, or a regular file given by the SHA-256 of its bytes and its
  permission bits (`st_mode & 0o7777`).
- *Exact name.* A path p is *present* when every directory from the store's root down lists the
  next component of p under exactly that name (no case folding, no Unicode normalisation), and
  *absent* otherwise. p *holds* an identity when it is present and is a regular file with those
  bytes and bits. A *variant* at p is an entry the filesystem resolves at p while p is absent.
- *H(p)* is the identity of p's staged copy `head/<n>`: the SHA-256 of the bytes copied and the
  permission bits from an `fstat` of the descriptor they were read from, not a later read of p;
  absent where HEAD lacks p.
- *S(p)* is the start's content of p as `git cat-file --filters <start>:./<p>` writes it, with
  permission bits 0666 (start mode 100644) or 0777 (100755) masked by the process umask; absent
  where the start lacks p.
- *The lock* is `<git dir>/mstack-mutation.lock`, where the git dir is what `git rev-parse
  --absolute-git-dir` prints at the store's root (a linked worktree has its own).
- *The run directory* is `<git dir>/mstack-mutation/<run id>/`, holding `start/<n>`, `head/<n>`
  and `rescue/`. The run id is the UTC start time, the pid and four random hex digits.
- A *temp name* of entry n is a name in p's directory that starts with
  `.mstack-mutation-<run id>-<n>.` and ends with `.tmp`.
- *The CLI that wrote the lock* is the absolute path of `bin/mstack` under the root of the copy
  that ran (`runningCliRoot()`, `src/paths.ts:99`).

## ADDED Requirements

### Requirement: R1 Refusals on the command, the repository and the item
IF `mstack verify` is not given exactly one of `--mutation` and `--restore`, or `--timeout` is
not an integer from 1 to 2147483, or, for `--mutation`: there is no active item, the store is not
in a git repository, the item has no `base` or its base is not a commit, `measureStart` finds no
start, the item has no obligations, a rebase, merge, cherry-pick, revert or bisect is in
progress, the lock exists, the revert set is empty, or the start's content of a path of the set
cannot be read; THEN the system MUST exit 2, name which and what fixes it, and leave no lock, no
run directory and no row.

#### Scenario: Neither flag, or both
- **WHEN** `mstack verify` runs with no flag, or with `--mutation --restore`
- **THEN** it exits 2 and the message names `--mutation` and `--restore`

#### Scenario: A rebase in progress
- **WHEN** `verify --mutation` runs while `rebase-merge` exists in the git directory
- **THEN** it exits 2 naming the rebase, and no lock and no run directory exist

#### Scenario: A detached HEAD is allowed
- **WHEN** HEAD is detached on a commit with a start and a non-empty revert set
- **THEN** the run is not refused

#### Scenario: A lock exists
- **WHEN** the lock exists
- **THEN** it exits 2, names the lock's pid, its start time and whether that run is alive (R23),
  and, when it is not, `<CLI that wrote the lock> verify --restore`; no file changes

#### Scenario: Nothing to revert
- **WHEN** the item's commits touch only `tests/` and `docs/`, or the only code that differs is
  an untracked `src/wip.ts`
- **THEN** it exits 2 with "no code changed since <start>", and `src/wip.ts` is unchanged

#### Scenario: A start blob that cannot be read
- **WHEN** a required smudge filter of a path of the set cannot run (or a Git LFS object is
  neither present nor fetchable)
- **THEN** it exits 2 naming the path, and no run directory is left

### Requirement: R2 Refusals on the working tree
IF a tracked file outside the store directory has an uncommitted change, staged or not, or is
flagged skip-worktree or assume-unchanged, so that git does not show its changes; or
anything the filesystem resolves sits at a path the start has and HEAD lacks (a file, a
directory, a symlink, or a variant); or a path of the set or one of its parent directories exists
under a name other than git's (it is absent by exact name, but a variant is there); or a parent
directory of a path of the set is a symlink or not a directory; or, after the baseline ran, HEAD
is not the commit it was before it, a tracked file outside the store directory changed, or the
key of R21 is not the one taken before the baseline; THEN the system MUST exit 2, name up to ten
of the paths (a flagged one with its flag and the `git update-index` command that clears it), and
write no lock, no run directory, no row and no baseline receipt.

#### Scenario: A dirty tracked file
- **WHEN** `src/a.ts` is modified and uncommitted
- **THEN** it exits 2 naming `src/a.ts`, and the file is byte-identical afterwards

#### Scenario: The store's own files may be dirty
- **WHEN** only `.mstack/state.json` and `.mstack/progress/current.md` are modified
- **THEN** the run is not refused

#### Scenario: A flag that hides a change
- **WHEN** `src/conf.ts` is flagged `--skip-worktree` or `--assume-unchanged` and holds a local edit
  that `git status` does not show
- **THEN** it exits 2 naming `src/conf.ts`, the flag and `git update-index --no-skip-worktree` or
  `--no-assume-unchanged`, and the file is byte-identical afterwards; a flagged file under the
  store directory is not refused

#### Scenario: An untracked file where the revert puts one back
- **WHEN** the item deleted `src/old.ts` and an untracked `src/old.ts` exists
- **THEN** it exits 2 naming `src/old.ts`, and the untracked file is unchanged

#### Scenario: A case variant in the way
- **WHEN** on a case-insensitive filesystem the item deleted `src/old.ts` and an untracked
  `src/OLD.ts` exists
- **THEN** it exits 2 naming `src/old.ts`, and `src/OLD.ts` is unchanged

#### Scenario: A path on disk under another case
- **WHEN** on a case-insensitive filesystem git tracks `src/foo.ts` and the entry on disk is
  `src/Foo.ts`
- **THEN** it exits 2 naming `src/foo.ts`

#### Scenario: A symlink at a parent
- **WHEN** the item deleted `src/lib/x.ts` and an untracked symlink `src/lib` points outside the
  repository
- **THEN** it exits 2 naming `src/lib`, and nothing is written through the link

#### Scenario: The tree moved during the baseline
- **WHEN** a commit is made while the baseline runs
- **THEN** it exits 2 before taking the lock, says what changed, and records no baseline receipt

#### Scenario: An untracked test edited during the baseline
- **WHEN** an untracked `tests/new.test.ts` is edited while the baseline runs
- **THEN** it exits 2 before taking the lock, names `tests/new.test.ts`, and records no baseline
  receipt

### Requirement: R3 Shapes the revert does not handle are refused
IF a path of the revert set is not a regular file (mode 100644 or 100755) at the start or at HEAD
(a symlink, a submodule); or is a file on one side while a path of the start..HEAD diff, of any
class, lies under it, or one of its parent directories is a file on one side; or differs only by
case or Unicode normalisation from another path of the set or from a parent directory of one; or
has a name holding a newline or bytes that are not UTF-8; THEN the system MUST exit 2 before
anything is touched, naming each such path and its reason.

#### Scenario: A symlink and a submodule
- **WHEN** the item changed the target of the symlink `src/link.ts`, or added the submodule
  `vendor/sub`
- **THEN** it exits 2 naming the path and "not a regular file"

#### Scenario: A file that became a directory, and the reverse
- **WHEN** the start has a file `src/x` and HEAD a directory `src/x/` holding `a.ts`; or the start
  has a file `src/z` and HEAD a directory `src/z/` holding only `z.test.ts`; or the start has
  `src/y/b.ts` and HEAD a file `src/y`
- **THEN** it exits 2 naming `src/x`, `src/z` or `src/y` and "a file on one side and a directory
  on the other"

#### Scenario: Case and normalisation
- **WHEN** the item renamed `src/Foo.ts` to `src/foo.ts`, or `src/café.ts` (NFC) to the same name
  in NFD, or deleted `src/Lib/a.ts` and added `src/lib/b.ts`
- **THEN** it exits 2 naming both spellings, on every filesystem

#### Scenario: A name with a newline, or not UTF-8
- **WHEN** the item added a code file whose name holds a newline, or one whose name holds the byte
  0xff
- **THEN** it exits 2 naming the path and its reason, on every filesystem

#### Scenario: Plain files are not refused
- **WHEN** the item only added, deleted, modified and renamed regular files
- **THEN** no shape is refused

### Requirement: R4 A merge of other work is refused
IF a merge commit in `<start>..HEAD` has a parent other than its first that is not an ancestor of
the start, THEN the system MUST exit 2 before anything is touched, name the merge and that
parent, say that the code since the start holds commits that are not the item's, and name as
fixes a rebase onto the default branch and `mstack state set <slug> --base <commit>`.

#### Scenario: Main merged in after a base on the branch
- **WHEN** the base is a commit on the branch and `main` was merged into the branch after it
- **THEN** it exits 2 naming the merge, and nothing is written

#### Scenario: A sibling branch merged in
- **WHEN** the start is the fork point (`why` is `older`) and another branch was merged in
- **THEN** it exits 2 naming the merge

#### Scenario: Merges that hold only the start's history
- **WHEN** `main` was merged in and the start is the fork point, or the branch was rebased
  instead
- **THEN** the run is not refused by this rule

### Requirement: R5 The running CLI is never reverted
IF a path of the revert set, resolved to an absolute real path, lies inside the root of the
mstack copy that is running, THEN the system MUST exit 2 before taking the lock, name up to ten
such paths, and print the commands that make a copy of the CLI at HEAD outside the tree (`git
worktree add --detach <dir> HEAD`), run `verify --mutation` from it and remove it afterwards.

#### Scenario: This repository
- **WHEN** `./bin/mstack verify --mutation` runs in an mstack checkout whose item changed
  `src/run-helper.mjs`
- **THEN** it exits 2 naming that path, the message contains `git worktree add --detach`, and
  nothing is written

#### Scenario: From the copy
- **WHEN** the same command runs from `<copy>/bin/mstack` with the checkout as its `cwd`
- **THEN** it is not refused by this rule

### Requirement: R6 The baseline comes first
WHEN every obligation has a `passed` receipt at the current sha and tree fingerprint
(`status(...).satisfied`, `src/verification.ts:384`, tree not `unknown`), the system MUST count
that as the baseline; otherwise it MUST run each obligation in order before taking the lock,
with captured output and the `--timeout` bound, record a `passed` or `failed` receipt for each as
`gate --full` does (one tree fingerprint, taken after the last), and stop at the first that does
not pass.

#### Scenario: A recorded green counts
- **WHEN** `gate --full` passed at this commit and tree, then `verify --mutation` runs
- **THEN** the output says "recorded green at this tree, not re-run" and the obligations run once,
  on the reverted tree

#### Scenario: A stale green does not count
- **WHEN** the last green receipt is from another commit
- **THEN** the obligations run for the baseline first

### Requirement: R7 A red or slow baseline is blocked
IF a baseline obligation exits non-zero, cannot start, or times out, THEN the system MUST take no
lock, revert nothing, append one `mutation-blocked` row, say that the baseline is red or that it
timed out with the bound, and exit 2; it records a `failed` receipt for a non-zero exit or a
failure to start, and none for a timeout.

#### Scenario: Red baseline
- **WHEN** the project's `verify` exits 1 at the current tree
- **THEN** no lock is taken, one `failed` receipt and one `mutation-blocked` row are appended, and
  the exit code is 2

#### Scenario: A slow baseline
- **WHEN** the baseline obligation runs past `--timeout 2`
- **THEN** its process group is killed, one `mutation-blocked` row and no `failed` receipt are
  appended, and the output says "baseline timed out after 2s"

### Requirement: R8 The lock is written first, atomically, and is data
WHEN a run has passed R1-R7, the system MUST stage the start's and HEAD's bytes of every path of
the set in the run directory and then create the lock atomically (a complete temporary file in
the git directory, fsynced, linked to the lock's name so that an existing lock fails the link, the
directory fsynced) before it writes any path; the lock MUST be one JSON document, not a script,
holding the run id, the pid, the host, the boot time, the pid namespace, the start time, the CLI
that wrote the lock, the store's root, the HEAD and start shas, the branch HEAD is on (none when
HEAD is detached), and for each path its H(p), its S(p) and the prefix of its temp names; and
once it holds the lock it MUST remove the run directories and temporary lock files of earlier
runs that no lock names, keeping any run directory whose `rescue/` holds anything.

#### Scenario: The lock precedes the first change
- **WHEN** the run is stopped at the step `lock-written`
- **THEN** `JSON.parse` of the whole lock succeeds, it names every path of the set, and `git
  status --porcelain` shows no change outside the store directory

#### Scenario: A linked worktree
- **WHEN** the run is in a linked worktree
- **THEN** the lock is in that worktree's git directory and the main worktree is not refused by
  it

#### Scenario: Two runs at once
- **WHEN** two processes try to take the lock together
- **THEN** one takes it and the other exits 2 naming the first one's pid, having written no path

#### Scenario: Leftovers of a killed start
- **WHEN** a run was SIGKILLed after staging and before linking its lock, and a later run takes
  the lock
- **THEN** the earlier run directory and temporary lock file are gone, and a run directory whose
  `rescue/` holds a file is kept

### Requirement: R9 What the revert writes
WHEN a run reverts, the system MUST bring every path p of the revert set to S(p) in the working
tree: a path added since the start is removed, a path deleted since the start is put back, a
modified path gets the start's bytes and mode; a directory the start lacks that the removals leave
empty is removed, and a missing parent of a path the start has is made.

#### Scenario: Added, deleted, modified, renamed
- **WHEN** since the start the item added `src/new.ts`, deleted `src/old.ts`, edited `src/a.ts` and
  renamed `src/b.ts` to `src/c.ts`
- **THEN** during the obligations `src/new.ts` and `src/c.ts` are absent, and `src/old.ts`,
  `src/b.ts` and the start's `src/a.ts` are present

#### Scenario: Bytes, size and mode
- **WHEN** the set holds a binary file, a 3 MiB file, and a script whose executable bit was set
- **THEN** during the obligations both files are byte-identical to the start's and the script is
  not executable

#### Scenario: Line endings as checked out here
- **WHEN** `.gitattributes` gives `*.txt text eol=crlf` and the set holds `src/t.txt`
- **THEN** during the obligations `src/t.txt` holds what `git checkout <start> -- src/t.txt`
  writes, with CRLF line endings

#### Scenario: Directories
- **WHEN** the item added `src/feature/x.ts` (the start has no `src/feature/`) and deleted
  `src/gone/y.ts` (HEAD has no `src/gone/`)
- **THEN** during the obligations `src/feature/` is absent and `src/gone/y.ts` is present, and
  after the restore it is the other way round

#### Scenario: The index is not touched
- **WHEN** a run is in progress or has ended
- **THEN** `git diff --cached` is empty

### Requirement: R10 Nothing outside the revert set is touched
The system MUST NOT write, move or remove, during a run or a restore, any entry other than a path
of the revert set, a directory R9 makes or removes, a temp name of the run, or an entry R14 moves
into the rescue directory.

#### Scenario: Tests, docs and the store stay
- **WHEN** the item changed `src/a.ts`, `tests/a.test.ts`, `docs/x.md` and `.mstack/state.json`
- **THEN** during the obligations only `src/a.ts` is at its start content

#### Scenario: A store in a subdirectory
- **WHEN** the store is `pkg/app/.mstack` and the item also changed `other/lib.ts`
- **THEN** `pkg/app/src/x.ts` is reverted and `other/lib.ts` is not

#### Scenario: Untracked files stay where they are
- **WHEN** an untracked `src/wip.ts` and an untracked `notes.txt` exist when the run starts
- **THEN** both are byte-identical during and after the run, and neither is named in the lock

### Requirement: R11 A revert that cannot complete runs nothing
IF writing a path fails, or, immediately before a path is written and again after its temp file
is written and just before the rename, it no longer holds H(p) (or, where HEAD lacks p, something
resolves there) or one of its parents is no longer a directory by exact name, THEN the system MUST
stop reverting, run no obligation, restore as in R13 only the paths the revert wrote (the others,
the one that stopped it included, are left as they are), end the run as `mutation-blocked` naming
the path with the operating system's error or the change, and exit 2 (3 if the restore fails).

#### Scenario: A path that cannot be written
- **WHEN** `src/deep/` is read-only when the revert must put back `src/deep/old.ts`
- **THEN** no obligation runs, every path already reverted is restored, and the output names
  `src/deep/old.ts` and `EACCES`

#### Scenario: A path that changed since the lock
- **WHEN** `src/b.ts` is edited between the lock and its own revert write
- **THEN** `src/b.ts` keeps the edit, nothing is moved into `rescue/`, no obligation runs, and the
  outcome is blocked

#### Scenario: An edit before the lock
- **WHEN** `src/b.ts` is saved after its staged copy is made and before the lock is taken
- **THEN** the revert stops before writing it, and `src/b.ts` keeps the edit

#### Scenario: An edit in the moment before the rename
- **WHEN** `src/b.ts` is edited after the temp file of its revert is written and before the rename
- **THEN** the temp file is removed, `src/b.ts` keeps the edit, and no obligation runs

### Requirement: R12 The outcome of the reverted run
WHEN the obligations run on the reverted tree, each through a runner that kills its process
group on timeout, the system MUST stop at the first that does not exit 0 and end the run as
`mutation-killed` (exit 0) when that one exits with a code other than 0, 126 and 127, 128+n
included; as `mutation-survived` (exit 1) when every one exits 0, listing the revert set as the
paths nothing noticed; and as `mutation-blocked` (exit 2) when one times out (default 900
seconds), exits 126 or 127, is ended by a signal mstack did not send, or cannot be spawned; and
for killed and blocked it MUST print the last 20 lines of that obligation's output.

#### Scenario: Killed
- **WHEN** the obligation exits 1 on the reverted tree
- **THEN** the final line starts `mutation-killed:`, names the obligation, and the exit code is 0

#### Scenario: A build failure and a crash
- **WHEN** the obligation exits 2 because a test imports a symbol the revert removed, or exits 139
- **THEN** the outcome is killed; the output says a build failure and an assertion failure look
  the same here, and for 139 names signal 11

#### Scenario: Survived
- **WHEN** the suite passes with `src/a.ts` at its start content
- **THEN** the outcome is survived, the exit code is 1, and the output lists `src/a.ts`

#### Scenario: Blocked
- **WHEN** the revert removed `scripts/check.sh`, the obligation, and the shell exits 127; or the
  obligation runs past `--timeout 2`
- **THEN** the outcome is blocked, the exit code is 2, and for the timeout its group is gone and
  the output says "timed out after 2s"

### Requirement: R13 Restore, proven per path, before the lock goes
WHEN the obligations end, whatever the outcome, an exception or a signal, the system MUST first
remove every temp name of the run that is a regular file, then restore every path of the lock
under R14 from its own record (also when the lock file is gone), then prove it path by path (p
holds H(p) where H(p) is a file; p does not hold S(p) where H(p) is absent), and remove the lock
only once that proof holds; HEAD, the index and other files MUST NOT decide whether the lock is
removed.

#### Scenario: Clean afterwards
- **WHEN** a run ends in any outcome
- **THEN** `git status --porcelain` is what it was before the run, the permission bits of every
  restored path are what they were (0600 and 0444 included), the lock is gone, and the run
  directory is gone unless its `rescue/` holds something

#### Scenario: Another tracked file changed during the run
- **WHEN** the obligation rewrites a tracked snapshot file that is not in the set
- **THEN** the lock is removed and the snapshot file is left as the obligation wrote it

#### Scenario: Killed inside a write
- **WHEN** a SIGKILL lands after a temp file of `src/a.ts` was written and before its rename, and
  `verify --restore` runs
- **THEN** no temp name of the run is left in `src/`, and `src/a.ts` holds H

### Requirement: R14 Restore writes only over what the run wrote
WHEN a restore puts p back where H(p) is a file, the system MUST write H(p) (bytes and permission
bits) by a temp name and a rename only where p holds S(p), or is absent with no variant there,
checked again just before the rename (on a change the temp file is removed and p is decided
again under this requirement, once; a second change is a failure under R15); where p holds
anything else (another file, a directory with what is in it, a symlink) or a variant is there, it
MUST first move that entry under its own name into a fresh directory of the run's `rescue/`,
never replacing anything, and name it; where H(p) is absent it MUST unlink p only when p holds
S(p), and leave anything else there in place. WHEN the move fails with EXDEV, a regular file
or a symlink MUST be copied, fsynced, compared and only then unlinked; any other entry is left,
and R15 applies.

#### Scenario: An edit to a reverted file
- **WHEN** `src/a.ts` holds neither S nor H when the restore runs
- **THEN** that content is under `rescue/<k>/src/a.ts` byte for byte, `src/a.ts` holds H, and the
  output names the rescued copy

#### Scenario: An edit in the moment before the rename
- **WHEN** `src/a.ts` is edited after the temp file of its restore is written and before the rename
- **THEN** the edit is under `rescue/<k>/src/a.ts` byte for byte, and `src/a.ts` holds H

#### Scenario: A directory where HEAD has a file
- **WHEN** during the run a directory `src/new.ts/` holding `out.log` was made where the revert
  had removed the file
- **THEN** the directory with `out.log` is under `rescue/<k>/`, `src/new.ts` holds H, and the lock
  is removed

#### Scenario: A case variant
- **WHEN** on a case-insensitive filesystem `src/a.ts` was renamed to `src/A.ts` and edited during
  the run
- **THEN** `src/A.ts` is under `rescue/<k>/` with the edit, and `src/a.ts` holds H

#### Scenario: Something left where HEAD has nothing
- **WHEN** the revert put back `src/old.ts` (HEAD lacks it) and it was edited during the run
- **THEN** the edited `src/old.ts` is left where it is and is reported

#### Scenario: A second incident
- **WHEN** two restores each rescue `src/a.ts`
- **THEN** each copy is in its own directory and the first is byte-identical to what it was

#### Scenario: The rescue is on another filesystem
- **WHEN** the move into `rescue/` fails with EXDEV for a 0750 file
- **THEN** the copy holds its bytes and mode 0750, the source is unlinked after the comparison,
  and H is written

### Requirement: R15 A restore that fails keeps the lock
IF writing, moving or proving fails for a path (a permission, a full disk, a staged copy that is
missing or does not match its identity, a parent that is not a directory), THEN the system MUST
keep the lock (writing it again from its record if it is gone), continue with the other paths,
name each failed path with the operating system's error and what to do, name `<CLI that wrote
the lock> verify --restore` for after, record no row, and exit 3, whatever other code applied.
Where a parent is a directory under a name other than git's, what to do is `mv <its name on disk>
<git's name>`, and the output says that `git stash` does not clear it; for a missing staged copy,
it also says that if the restore still fails after the stash, the lock may be deleted by hand, p
may then be absent, and `git restore -- <p>` puts HEAD's content back.

#### Scenario: A read-only directory
- **WHEN** `lib/ro/` is made read-only during the run, so that `lib/ro/x.ts` cannot be put back
- **THEN** `src/a.ts` is restored, the lock stays, the exit code is 3 and the output names
  `lib/ro/x.ts` and `EACCES`; after `chmod u+w lib/ro`, `verify --restore` exits 0

#### Scenario: A missing staged copy
- **WHEN** `head/<n>` of `src/a.ts` was deleted and `src/a.ts` holds an edit
- **THEN** the edit is rescued first, the lock stays, the exit code is 3, and the output names
  `git stash push -- src/a.ts`, saying it writes HEAD's content there and saves whatever is there
  first, and names `git restore -- src/a.ts` for after a lock deleted by hand; after the stash,
  `verify --restore` exits 0

#### Scenario: A parent renamed by case
- **WHEN** on a case-insensitive filesystem `src/lib/`, holding the reverted `src/lib/a.ts`, is
  renamed to `src/Lib/` during the run
- **THEN** the lock stays, the exit code is 3, and the output names `mv src/Lib src/lib` and says
  that `git stash` does not clear it; after the `mv`, `verify --restore` exits 0

#### Scenario: The lock was deleted during the run
- **WHEN** the lock file is deleted during the run and the restore then fails for one path
- **THEN** the lock exists again with the run's record and the exit code is 3

### Requirement: R16 Signals and death during an obligation
WHEN SIGINT, SIGTERM or SIGHUP reaches the process while an obligation runs, at the baseline or on
the reverted tree, the system MUST kill that obligation's process group, record no receipt and
no row for it, restore and prove the tree as in R13 when anything was reverted, and exit 130, 143
or 129; and WHEN the process dies while an obligation runs, killed alone or with its process
group, the obligation's process group MUST be gone within 2 seconds.

#### Scenario: SIGTERM to mstack alone
- **WHEN** SIGTERM is sent to the `mstack` process alone while a 30-second obligation runs on the
  reverted tree
- **THEN** within 10 seconds it exits 143, no obligation process is left, the tree is as before
  and no lock exists

#### Scenario: Ctrl-C to the whole group
- **WHEN** SIGINT is sent to the process group of `mstack` while the obligation runs on the
  reverted tree
- **THEN** it exits 130, no obligation process is left, and the tree is as before

#### Scenario: SIGHUP during the baseline
- **WHEN** SIGHUP is sent while a baseline obligation runs
- **THEN** it exits 129, and no lock, run directory, receipt or row exists

#### Scenario: SIGKILL during the obligations
- **WHEN** the `mstack` process alone is SIGKILLed while an obligation sleeps on the reverted tree
- **THEN** 3 seconds later no process of the obligation is left

#### Scenario: SIGKILL to the group during the obligations
- **WHEN** the process group of `mstack` is SIGKILLed while an obligation sleeps on the reverted
  tree
- **THEN** 3 seconds later no process of the obligation is left

### Requirement: R17 Nothing interrupts a revert or a restore
WHILE the system holds the lock and is reverting or restoring, it MUST NOT be stopped by SIGINT,
SIGTERM or SIGHUP, sent to it alone or to its group, and MUST act on such a signal only after the
restore and its proof (R16's exit code, no row); from taking the lock to removing it, it MUST run
no child process other than the obligations; and a signal that arrives before the first revert
write MUST be acted on before any path is written and before any obligation starts.

#### Scenario: Ctrl-C to the group during the restore
- **WHEN** SIGINT is sent to the process group while the restore runs, once or twice
- **THEN** the restore completes, the tree is as before, no lock exists, and the exit code is 130

#### Scenario: Ctrl-C to the group just after the lock
- **WHEN** SIGINT is sent to the group at the step `lock-written`
- **THEN** no path is written, no obligation starts, the lock is removed, and the exit code is 130

#### Scenario: Ctrl-C to the group during the revert
- **WHEN** SIGINT is sent to the group at the step `reverted:0`
- **THEN** no obligation starts, the tree is as before, no lock exists, and the exit code is 130

#### Scenario: Ctrl-C to the group while staging
- **WHEN** SIGINT is sent to the group while a `git cat-file` child stages a start blob
- **THEN** the exit code is 130, not a refusal, and no run directory is left

### Requirement: R18 No receipt when the tree changed under the run
IF (a) a path of the set did not hold S(p), by exact name, when the obligations ended; (b) HEAD is
not the lock's HEAD; (c) the lock file is gone or names another run; (d) after the restore, the
index or the working tree of a tracked file outside the store directory differs from HEAD; or (e)
the key of R21 after the restore differs from the key taken before the lock; THEN the system MUST
record no row, end with a line beginning `mutation-blocked: the tree changed under the run` that
names which of (a)-(e) held and the paths, and exit 2 (3 if the restore failed).

#### Scenario: An edit to a reverted file during the run
- **WHEN** `src/a.ts` is edited while the obligations run
- **THEN** no row is appended and the final line names (a) and `src/a.ts`

#### Scenario: A commit, a git add, a test rewritten
- **WHEN** during the run a commit is made, or `git add src/a.ts` runs, or the obligation rewrites
  the tracked `tests/__snapshots__/a.snap`
- **THEN** no row is appended and the final line names (b), (d) or (d) and the path

#### Scenario: The lock deleted during the run
- **WHEN** the lock file is deleted while the obligations run
- **THEN** the tree is restored, no row is appended and the final line names (c)

#### Scenario: Untracked code and tests
- **WHEN** an untracked `tests/new.test.ts` is edited during the run, or the obligation writes a
  new non-ignored `out.log`
- **THEN** no row is appended, the final line names (e) and the path, and for `out.log` it says to
  ignore generated files

### Requirement: R19 The report of other changes
WHEN the lock has been removed, the system MUST report, without naming a cause and without
writing any of them: a moved HEAD, with both shas and, as the user's option, `git reset <lock
HEAD>` (it moves the branch back and keeps the working tree; the commit stays in the reflog) when
HEAD is still on the branch the lock names, and otherwise `git switch <that branch>` first (`git
switch --detach <lock HEAD>` where the lock names none), followed by that reset only when the
branch no longer points at the lock's HEAD; each path
whose index differs from HEAD, with `git diff --cached -- <p>` and `git restore --staged -- <p>`,
saying that the latter discards the staged version that diff shows; each other tracked path that
differs, with `git diff -- <p>`; each untracked entry that did not exist when the run began, as
"left in place"; and each rescued entry with its path in `rescue/`.

#### Scenario: HEAD moved
- **WHEN** `git commit -am x` ran from another terminal during the run
- **THEN** the working tree has the item's code again, the output names the old and the new HEAD
  and `git reset <old HEAD>`, and does not say `--soft`

#### Scenario: HEAD on another branch
- **WHEN** another terminal ran `git switch -c other` and committed during the run
- **THEN** the output names `git switch <the lock's branch>` and does not name `git reset`

#### Scenario: Staged and changed paths, new files
- **WHEN** during the run `src/a.ts` was staged, `tests/a.snap` rewritten and `out.log` written
- **THEN** the output names the three with their commands, says what `git restore --staged`
  discards, does not say "obligations", and leaves all three as they were

### Requirement: R20 The receipt row
WHEN a run ends killed, survived or blocked, its restore (if a lock was taken) passed the proof, no
signal reached it, the tree did not change under it, and the key could be computed, the system
MUST append exactly one row to `verification.tsv` with the existing six columns: `target` the
item's slug, `sha` HEAD when the obligations ran, `command` the obligations joined with ` && `,
`outcome` `mutation-killed`, `mutation-survived` or `mutation-blocked`, `ts`, and `tree`
`mutation:` plus the key of R21; in every other case it MUST append no mutation row; and a
mutation row MUST NOT satisfy a verification obligation.

#### Scenario: A killed row
- **WHEN** a run is killed
- **THEN** `tail -1 .mstack/verification.tsv` has six cells, the fourth `mutation-killed` and the
  sixth starting `mutation:`

#### Scenario: Old files and old readers
- **WHEN** `verification.tsv` was written before this feature, or holds a mutation row
- **THEN** the old rows read unchanged, and `receipts()` and `status(...)` give the same answer
  with or without the mutation row

#### Scenario: No row when the restore failed
- **WHEN** a run ends with exit 3
- **THEN** `verification.tsv` has no new mutation row

### Requirement: R21 What the receipt is keyed by
The system MUST compute the key over the key set: for each path, sorted, the path, whether it is
tracked, its start mode and blob (or absent), and its identity in the working tree (a regular
file as the blob id git would store for it); a change to any of those MUST change the key, and a
change to a doc, a store file, the sha or the commit graph that leaves them unchanged MUST NOT;
and the key MUST be null, with no row written and the reason printed, when git cannot answer or a
path of the key set holds a newline or has a name that is not UTF-8.

#### Scenario: What changes it
- **WHEN** `src/a.ts` or `tests/a.test.ts` is edited (committed or not), a code or test file is
  added, an untracked test file is committed, or a code file's executable bit changes
- **THEN** the key differs from the one before

#### Scenario: What does not
- **WHEN** a docs file or a store file is committed, or the branch is rebased so the sha changes
  but no code or test path differs
- **THEN** the key is the same

#### Scenario: A store in a subdirectory
- **WHEN** the store is `pkg/app/.mstack` and `pkg/app/src/x.ts` and an untracked
  `pkg/app/tests/x.test.ts` differ from the start
- **THEN** the key is not null, and an edit to `pkg/app/tests/x.test.ts` changes it

#### Scenario: The run does not move its own key
- **WHEN** a run appends a row
- **THEN** the key computed afterwards equals the one in the row

### Requirement: R22 verify --restore repairs a run that is not alive
WHEN `mstack verify --restore` runs, the system MUST exit 0 saying there is nothing to restore
and write nothing when no lock exists; and when a lock exists whose run is not alive (R23) and
that passes R24, it MUST restore and prove under R13 and R14, remove the lock, remove the run's
staging, and exit 0, leaving the tree the same however many times it is run.

#### Scenario: No lock
- **WHEN** `verify --restore` runs in a repository with no lock
- **THEN** it exits 0 with "nothing to restore", and the tree and the git directory are unchanged

#### Scenario: Killed at each step
- **WHEN** SIGKILL lands at `lock-written`, after two of five paths were reverted, during the
  obligations, or after three of five paths were restored
- **THEN** `verify --restore` exits 0 and `git status --porcelain` is what it was before the run

#### Scenario: Run twice
- **WHEN** `verify --restore` runs a second time after a successful one
- **THEN** it exits 0 with "nothing to restore"

### Requirement: R23 verify --restore never runs under a live run
IF the run that wrote the lock may be alive, THEN `verify --restore` MUST exit 2, name the pid,
the host and why, and write nothing; and `verify` MUST NOT accept `--force`. The run may be
alive when the lock names another host, whatever its boot time; when it is from this boot (boot
times within 60 seconds) and another pid namespace, a null namespace against a non-null one
included; and otherwise when its pid is a live process that started no later than the lock's
start time to the second, or `ps` cannot tell when that process started. A different boot time
alone never makes such a process not alive; a lock from another boot of this host whose pid is
not such a process is not alive.

#### Scenario: A live run is not restored under its feet
- **WHEN** a run is in progress and `verify --restore` runs
- **THEN** it exits 2 naming the running pid, and no file changes

#### Scenario: No --force
- **WHEN** `verify --restore --force` runs
- **THEN** it exits 2 naming the unknown option, and no file changes

#### Scenario: A reused pid, an earlier boot, another host
- **WHEN** the lock's pid is now a process that started after the lock; or the lock's boot time is
  an hour before this boot's, on this host; or the lock names another host, at this boot or another
- **THEN** the first two restore, and the third exits 2 naming that host

#### Scenario: A live process at another boot time, another namespace, no ps
- **WHEN** the lock's boot time is more than 60 seconds off this boot's and its pid is a live
  process that started before the lock; or, at this boot, the lock's pid namespace is null and
  this one is not, or the reverse; or `ps` cannot run and the lock's pid is a live process
- **THEN** `verify --restore` exits 2, and no file changes

### Requirement: R24 The lock is checked before a restore writes
IF the lock is not one JSON document of version 1, does not name its store's root relative to the
worktree's top level, or a path in it is absolute, empty, has an empty, `.`, `..` or `.git`
segment, or appears twice, THEN `verify --restore` MUST exit 2, write nothing, keep the lock, and
name what is wrong; for a lock that cannot be read it MUST also name the by-hand recovery and what
it discards. Two stores of one worktree share its lock: IF the store root the lock names relative
to the worktree's top level is not this store's, THEN `verify --restore` MUST exit 2, write nothing
to the tree, the lock or the run directory, and name the directory to run it from, and the gate's
line, the hook's reason and R1's refusal of the lock MUST name that directory too; a lock's paths
are resolved against the root of the store it names, never against another store's, in a moved
checkout or not.

#### Scenario: A path outside the root
- **WHEN** the lock was edited to name `../outside.txt`
- **THEN** `verify --restore` exits 2 naming it, and `../outside.txt` and the lock are unchanged

#### Scenario: A lock that cannot be parsed
- **WHEN** the lock holds `garbage`
- **THEN** `verify --restore` exits 2, says `git stash push --include-untracked` saves every change
  and discards nothing, and the tree and the lock are unchanged

#### Scenario: Two stores in one worktree
- **WHEN** a run in the store `pkg/a` is SIGKILLed during its check, and `verify --restore` runs
  from the store `pkg/b`, in place or after the whole checkout is moved to another directory
- **THEN** it exits 2 naming the directory of `pkg/a`; the tree (B's tracked and untracked files
  included), the lock and the run directory are unchanged; B's gate line, B's R1 refusal and the
  hook's reason in B name that directory; and `verify --restore` from `pkg/a` exits 0, with the
  tree as it was before the run and no lock

### Requirement: R25 Every message that names the restore names the CLI that wrote the lock
WHEN a run, a refusal, a failed restore, the gate or the hook names `verify --restore`, the system
MUST give it as the absolute path of the CLI that wrote the lock followed by `verify --restore`,
and, when no file exists at that path, also the absolute path of the CLI that is running, each
path one shell word (single-quoted when it holds a character the shell reads, item 101) and the
directory of a `cd` in front of it the same, so the line runs as printed; it
MUST NOT name `sh` together with the lock in any output; and the lines a run prints when it
takes the lock MUST also say that a file saved at a reverted path in the moment the run puts it
back is lost.

#### Scenario: Printed before the revert
- **WHEN** a run takes the lock
- **THEN** before the line "reverting N file(s)" it prints the lock's path, `<absolute CLI>
  verify --restore` and the line about a file saved in the moment it is put back, and no line
  matches `sh .*mstack-mutation.lock`

#### Scenario: The writing CLI is gone
- **WHEN** the gate runs with a lock whose CLI path no longer exists
- **THEN** its line names that path and the running CLI's path, each with `verify --restore`

### Requirement: R26 The PreToolUse hook denies git writes under a lock
WHILE the lock exists in the git directory of the hook input's `cwd`, the system MUST deny any
Bash command with a segment running git `add`, `am`, `apply`, `checkout`, `cherry-pick`, `clean`,
`commit`, `merge`, `mv`, `pull`, `rebase`, `reset`, `restore`, `revert`, `rm`, `stash` or `switch`
(with git's global options, in a compound command), with a reason that names the lock and the
restore command of R25; it MUST decide by the lock's existence alone, so a lock that cannot be
parsed denies too; it MUST start no git process for a command with no such segment; it MUST
allow when no lock exists or git cannot name the git directory; and, with or without a lock, it
MUST deny a segment running `rm` on a path that ends in `mstack-mutation.lock`, as it denies an
`rm -r` of the store.

#### Scenario: Shapes caught
- **WHEN** the lock exists and the command is `git commit -m x`, `git -C sub commit -am x`, `git
  -c user.name=a add .`, `cd x && git stash`, `echo ok; git add -A` or `git checkout .`
- **THEN** the hook prints `permissionDecision: "deny"` with a reason naming `verify --restore`

#### Scenario: Not caught, and said so
- **WHEN** the command is `git ci` through an alias, `"git" commit`, `git -C "dir with space"
  commit`, an interpreter one-liner, `npm version`, or a `git -C <repo>` from a `cwd` outside the
  repository
- **THEN** the hook allows it

#### Scenario: What decides
- **WHEN** the command is `ls -la`; or there is no lock; or the `cwd` is not in a repository; or
  the lock holds `garbage`
- **THEN** no git process starts for `ls -la`; `git commit -m x` is allowed in the next two cases
  and denied in the last

#### Scenario: Deleting the lock
- **WHEN** the command is `rm .git/mstack-mutation.lock` or `rm -f /repo/.git/mstack-mutation.lock`,
  with a lock or without one
- **THEN** the hook prints `permissionDecision: "deny"`, and no git process starts

### Requirement: R27 The gate fails on a lock, and gate --full runs nothing
WHILE the lock exists, `mstack gate` MUST fail, whatever the item's status and with no active
item, with one line in its workspace section naming the lock, the pid, whether the run is
running, not running or cannot be told (R23), the start time, the number of paths and the fix
(wait; R25's restore command; or, when it cannot be told, where to run it and the by-hand
recovery), a lock that cannot be parsed included; and `mstack gate --full` MUST run no obligation
and record no receipt.

#### Scenario: A lock and a green store
- **WHEN** a lock whose pid is not running exists and nothing else is wrong
- **THEN** `gate --quiet` exits 1, and its one stderr line contains "not running" and `verify
  --restore`

#### Scenario: A live run
- **WHEN** the lock's run is alive
- **THEN** the line says "running" and to wait, and does not name `verify --restore` as the fix

#### Scenario: The Stop hook and gate --full
- **WHEN** the lock exists and the Stop hook runs, or `gate --full` runs
- **THEN** the Stop hook's context lists the line as a failure; `gate --full` exits 1, ran no
  obligation and left `verification.tsv` unchanged

### Requirement: R28 Rescued content is reported until it is removed
WHILE a `rescue/` directory under the `mstack-mutation/` of any worktree's git directory (`<git
common dir>/mstack-mutation/` and `<git common dir>/worktrees/*/mstack-mutation/`) holds any
entry, `mstack gate`, run in any worktree, MUST warn in its workspace section, naming the
directory and the number of entries in it; and `mstack worktree prune` MUST NOT offer a worktree
whose git directory holds the lock or such a `rescue/`.

#### Scenario: After a rescue
- **WHEN** a restore moved `src/a.ts` into a rescue directory
- **THEN** `mstack gate` prints a warning naming that directory and "1 entry", and exits as it
  would without it

#### Scenario: A linked worktree's rescue
- **WHEN** a linked worktree's restore rescued a file, and its tree is clean and its branch merged
- **THEN** `mstack gate` in the main checkout warns naming that directory, and `mstack worktree
  prune` does not offer the worktree
