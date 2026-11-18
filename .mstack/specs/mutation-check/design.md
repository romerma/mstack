## Context

The design rows (decisions.tsv, 2026-11-18T12:32:13Z, 12:40:58Z and 13:02:23Z) are the
decision; this file elaborates them. Facts in the checkout that shape it, each read at the cited
line on `feat/mutation-check` at 6179767:

- There is no `verify` command today: `main` dispatches 13 commands and none is `verify`
  (`src/cli.ts:72-107`). `verify` is new, with two flags.
- `treeId` fingerprints *uncommitted* content outside the store and is `clean` after a commit
  (`src/verification.ts:201-264`); a receipt is keyed `(sha, command, tree)` (`:351-365`). That
  key changes with every commit, and a docs or store commit must not void a mutation receipt, so
  the mutation key is its own fingerprint, of code and tests (row 12:40:58Z).
- `receipts()` keeps rows whose `outcome` is `passed` or `failed` (`src/verification.ts:325-336`)
  and `append` writes whatever cells it is given (`src/tsv.ts:60`). New outcome words in the same
  file are invisible to every older reader and to `status()`.
- A closing check is one entry in `CLOSING_CHECKS` (`src/closing.ts:171`); the gate reports it at
  `verifying` and `state set --status done` runs it (`:178-188`, `src/cli.ts:632-693`). A forced
  close writes a marker constant into `closed_by` (`src/cli.ts:226-231`), chosen at `:646-649`
  and carried across a later `--closed-by` at `:733`.
- The size check's start and code predicate are `measureStart` (`src/size.ts:70`) and the
  closure `counted` inside `measureDiff` (`:138-141`). `measureStart` answers `base` when the base
  is a branch commit with the default branch merged in after it, and then counts the merged
  commits (`src/size.ts:59-69`; `docs/wiki/Gates-and-Hooks.md:212-225`; item 92's first
  criterion). For the size check that fails closed; for a revert it reverts other people's code
  and can kill tests that are not the item's, so R33 refuses that shape.
- `runCommand` is `spawnSync` (`src/run.ts:81,92-93`). The spec review measured that with a
  SIGTERM handler installed, node never ran it during a `spawnSync` and bun ran it only after the
  child returned. R17 needs a runner that leaves the event loop free. `src/run-helper.mjs` already
  kills the group on its own SIGINT/SIGTERM/SIGHUP and on timeout (`:43-52`), and is started with
  `cwd` set to a temp directory so bun loads no `bunfig.toml` or `.env` from the target
  (`src/run.ts:93-97`); the async runner spawns the same helper the same way.
- `git()` is `execFileSync` in the caller's process group (`src/git.ts:63`), decodes stdout as
  UTF-8 (`:65`), and discards stderr (`:66`). A terminal Ctrl-C reaches every process in the
  foreground group, so it kills an in-flight `git()` child (review `sig-exp.sh`; this round's
  `sig-exp`, below). The restore therefore runs no child process at all, and the revert reads
  everything it needs from git before the lock is taken.
- `git restore --source=<c> --worktree -- <dir-path>` deleted a directory holding an untracked
  file to put the source's file there, exit 0 (review `git-exp.sh` case b2). The revert and the
  restore therefore write with the filesystem and never call a git command that can remove what
  it did not create.
- The PreToolUse hook is a list of regexes over one shell segment (`src/hooks.ts:359-402`,
  `shellSegments` at `:461`, `preToolUse` at `:537`) and reads no state. The lock rule needs a
  filesystem answer, so it is a separate branch, not another `GUARDS` entry. Its matcher is
  `Bash` only (`hooks/hooks.json`).
- Every hook runs `${CLAUDE_PLUGIN_ROOT}/bin/mstack` (`hooks/hooks.json`). In a session started
  with `claude --plugin-dir .` in this repository that is this checkout's `src/`, which a revert of
  this repository's own item puts back to the start. R28 covers the mutation process; task 5.3
  covers the session.

## Usage

```
$ mstack verify --mutation          # 0 killed, 1 survived, 2 blocked or refused, 3 not restored
mutation: mutation-check (42), start 3fa9c1d2 (base), 5 code file(s) to revert
mutation: baseline: `npm test` recorded green at this tree, not re-run
mutation: lock /repo/.git/mstack-mutation.lock, run 20261118T140211Z-4242-9f3a
mutation: if this process dies, `mstack verify --restore` puts the tree back; with git alone, `sh /repo/.git/mstack-mutation.lock` runs:
mutation:   cd '/repo' || exit 1
mutation:   rm -f -- 'src/b.ts'
mutation:   rm -f -- 'src/old.ts'
mutation:   GIT_LITERAL_PATHSPECS=1 git restore --source=3fa9c1d2e1... --worktree -- 'src/a.ts' 'src/c.ts' 'src/new.ts' && rm -f -- '/repo/.git/mstack-mutation.lock'
mutation: reverting 5 file(s)
mutation: running `npm test` on the reverted tree
mutation: `npm test` exit 1 after 8.2s
mutation: restoring
mutation: restored, tree verified, lock removed
mutation: left in place: coverage.json (`git status --short -- coverage.json`)
mutation-killed: `npm test` failed without the change (last 20 lines follow; a build failure and an assertion failure look the same here)
...

$ mstack verify --restore           # after a SIGKILL or a power cut
mutation: lock from pid 4242 on this host (not running), run 20261118T140211Z-4242-9f3a, HEAD 3fa9c1d2, 5 path(s)
mutation: 2 at HEAD, 3 as the revert wrote them, 0 other
mutation: restored 3, tree verified, lock removed
```

A sketch of the contract in spec.md, not output from a run; the docs tasks paste real output.

## Shape

### The three sets and the key (`src/mutation.ts`, reads only)

`scopeClass(store)` (exported from `src/size.ts`, replacing the `counted` closure) returns a
function from a store-relative path to its class, or `null` for a path under the store directory.
`measureDiff` keeps its behaviour by counting `scopeClass(store)(path) === "code"`.

- `codeDiff(store, from)`: `git diff --raw -z --no-renames --full-index --relative <from> --`
  (start against the working tree, tracked paths only), keeping class `code`, dropping mode
  `160000`. Its emptiness is the one meaning of "empty" (R4, R23, R24).
- `revertSet(store, from)`: `git diff --raw -z --no-renames --full-index --relative <from> HEAD
  --`, keeping class `code`. Each `SetEntry` is `{ path, startMode, startBlob, headMode, headBlob
  }` straight from the raw record; an entry with `160000` on either side goes to `submodules`
  instead. No pathspec is built from a path of the set, so `GIT_LITERAL_PATHSPECS` is not needed
  on these calls; object names are `<commit>:./<path>`, which git resolves from the store's root.
- `mutationKey(store, from)`: the tracked part from the same diff as `codeDiff` but keeping
  `code` and `test`, plus `git ls-files --others --exclude-standard -z` keeping `code` and `test`.
  One line per path, sorted: `path NUL tracked|untracked NUL startMode:startBlob NUL now`, where
  `now` is `-` (absent), `120000:<target>` (through `lstat`/`readlink`, as `treeId`'s `classify`
  does, `src/verification.ts:286-306`), `100644:<blob>` or `100755:<blob>` (blob ids from `git
  hash-object --stdin-paths` fed **absolute** paths: relative ones resolve from the repository
  root, not the store's, experiment `hash-exp`), or `other`. The key is `"mutation:" +
  sha256(lines).slice(0, 16)`, or `null` when git cannot answer. A path with a newline makes it
  `null`, as in `treeId`. "Tracked" is in the line so that committing an untracked file changes
  the key and asks for a run that reverts it.

### Refusals (`src/mutation.ts`)

`refusals(store, state, item, running = runningCliRoot())` returns the first `{ message, fix }`
or `null`, checking in this order: not a repository; no base; base not a commit; start lost; a
merge after a base start (R33: `start.why === "base"` and `git rev-list --merges <start>..HEAD`
not empty); no obligations; an operation in progress (`rebase-merge`, `rebase-apply`,
`MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `BISECT_LOG`, through `git rev-parse
--git-path`); the lock exists (R7); tracked changes outside the store directory (`git status
--porcelain=v1 -z --untracked-files=no`, minus the store directory); empty code diff (R4); a
revert path inside `running` (R28: `realpath` of the path under `realpath(running)`); collisions
(R6: for each entry the start has, `lstat` the path and each parent up to the root; an entry
there is in the way unless it is a path of the set that the revert removes first, compared by
`dev`/`ino` so that a case-only rename passes; a directory is in the way when anything under it is
not such a path; a symlink at a parent is in the way unless it is such a path). `lockPath(store)` is
`<absolute git dir>/mstack-mutation.lock` and lives here because the refusals need it.

### Identities and the run directory (`src/mutation-lock.ts`)

```ts
type Identity = { kind: "file"; exec: boolean; sha256: string } | { kind: "symlink"; target: string } | null;
type OnDisk = Identity | { kind: "dir"; empty: boolean } | { kind: "other" };
interface LockEntry { path: string; head: Identity; start: Identity; n: number }
interface Lock {
  v: 1; run: string; pid: number; host: string; startedAt: string;
  head: string; start: string; root: string; runDir: string;
  entries: LockEntry[]; createdDirs: string[]; removedDirs: string[];
}
```

`prepareRun(store, from, set)` runs before the lock and writes nothing outside the git directory.
It makes the run directory with a non-recursive `mkdir` (EEXIST means a clash: a new run id is
drawn; experiment `fs-exp` h), then for entry `n`:

- `start/<n>`: the bytes of S(p): `git cat-file --filters <from>:./<p>` for a file (the start's
  content as checkout would write it here: CRLF under `eol=crlf`, binary byte-identical,
  experiment `fs-exp` d, d2), the blob as the target string for a symlink (`fs-exp` d3). Read with
  a new `gitBytes(store, args): Buffer | null` in `src/git.ts` (same environment and timeout as
  `git()`, no decoding, because `git()` decodes UTF-8 and a binary blob would not survive).
- `head/<n>`: a copy of the working-tree bytes of p, which by R6 git sees as HEAD's. Not
  regenerated from git: `git cat-file --filters HEAD:p` wrote different bytes than the tree held
  (LF in the tree, CRLF regenerated) and `git status` then called the file modified (experiment
  `crlf-exp`). The backup puts back exactly what was there.
- H(p) and S(p) from those bytes; each staged file is fsynced, then the directory.
- `createdDirs`: parents of start paths that do not exist now; `removedDirs`: start files whose
  path is now a directory (which R6 guarantees holds only paths the revert removes).

A failure to read a start blob returns a refusal (R5) after removing the run directory.

### The lock (`src/mutation-lock.ts`)

The lock is a POSIX shell script. Line 1 is `#!/bin/sh`; line 2 is `# mstack-mutation-lock 1 `
followed by `JSON.stringify(lock)` (one line: JSON escapes every newline); comment lines say what
the file is and that `sh` on it overwrites what is at each path; then the recovery of R31:

```
cd '<store root>' || exit 1
rm -f -- '<each path HEAD lacks>'
rmdir -- '<each created directory, deepest first>' 2>/dev/null
GIT_LITERAL_PATHSPECS=1 git restore --source=<head sha> --worktree -- '<each path HEAD has>' && rm -f -- '<lock path>'
```

Paths are single-quoted with `'\''` for a quote. `rm` and `rmdir` run before `git restore`, so a
start file in the place of one of HEAD's directories is gone before git writes under it.

`acquireLock(store, lock)` writes `mstack-mutation.lock.<run>.tmp`, fsyncs it, `linkSync`s it to
the lock name (EEXIST: someone holds it, refuse), fsyncs the directory, unlinks the temporary. A
reader sees no lock or a whole one. `readLock(store)` returns `null` (no lock), `{ lock }`, or `{
damaged: reason }`; existence is `lstat`, and parsing is only for what is printed (R39).
`sweepStale(store, lock)` removes temporary lock files and run directories that the current lock
does not name and whose `rescue/` is empty; every `verify` calls it first (R15). While a lock
exists that cannot be parsed it removes nothing, since it cannot tell which run directory that
lock needs. `validateLock` refuses absolute, empty, `..` and `.git` segments (R43); `--restore`
refuses a damaged lock and names `sh <lock>` (R43).

### Revert (`applyRevert(store, lock, step?)`)

1. Entries the start lacks, deepest path first: check p holds H(p) (else stop: R34), unlink.
2. `removedDirs`, deepest first: `rmdir` (fails with ENOTEMPTY rather than removing anything,
   `fs-exp` b).
3. Entries the start has, shallowest first: check p holds H(p) or is absent where H(p) is absent
   (else stop: R34); `mkdir` each missing parent (they are `createdDirs`); copy `start/<n>` to
   `<dir>/.mstack-mutation-<run>-<n>.tmp` (or `symlink` the target to that name), `chmod` the
   executable bit, fsync, `rename` over p. `rename` of a file over a directory fails with EISDIR
   and leaves the directory and its contents alone, empty or not (`fs-exp` a, a2).

`step` is the test seam, as `LockOptions.step` is for `withLock` (`src/tsv.ts:104`): named steps
`prepared`, `lock-written`, `reverted:<n>`, `obligations-running`, `restored:<n>`.

### Restore (`restoreFromLock(store, lock, step?)`)

No child process (R35). For each path, classify what is on disk against the lock, then act:

"Absent" is held by a path with no file and no symlink at it; a directory there counts as
absent, because git tracks no directories (so a directory at a path HEAD has only as a parent of
other paths is fine).

| p holds | Action |
|---|---|
| H(p) | nothing |
| S(p), or nothing | write H(p) from `head/<n>` (temp + rename, as in the revert, making any missing parent), or unlink when H(p) is absent |
| an empty directory, where H(p) is a file or symlink | `rmdir`, then write H(p) |
| another file or symlink | `rename` it to `rescue/<p>` (exclusive: if that name exists, `.1`, `.2` ... is appended), then write H(p) or leave p empty when H(p) is absent |
| a directory holding anything where H(p) is a file or symlink, or a parent that is not a directory | leave it, record a failure naming what is inside, keep the lock |
| `head/<n>` missing or not matching H(p) | record a failure, keep the lock; the message names `sh <lock>` |

Order: entries HEAD lacks (deepest first), then `createdDirs` (`rmdir` when empty, else left and
listed), then entries HEAD has (shallowest first). Then the proof: every p equals H(p). Only then
is the lock unlinked (`ENOENT` is fine: two restores can race and both are right), `start/` and
`head/` removed, and the run directory removed when `rescue/` is empty. The result is `{
restored, rescued: { path, to }[], failed: { path, reason }[], lockRemoved }`; a failure's reason
is the `fs` error's `code` and message, which is the operating system's reason (the review's N11).

Index and HEAD are never written. The target is the lock's H(p), not the current HEAD, so a commit
made despite the hook is undone in the working tree and left in history (R20).

### The run (`src/mutation-run.ts`)

`runMutation(store, options: { timeoutMs; running?; step?; out })` returns `{ exit, outcome? }`:

1. `sweepStale`; `refusals`; sample HEAD.
2. Install the SIGINT/SIGTERM/SIGHUP handlers (before anything else is written, N2). A handler
   records the first signal and, if an obligation is running, calls its `stop()`; it never exits
   the process.
3. Baseline: `status(...).satisfied` at the current `treeId` (not `unknown`) counts; otherwise each
   obligation through `runCommandAsync`, stopping at the first that does not pass. A signal here:
   exit 128+n, no receipt for the interrupted obligation (R36). Then R6 again plus "HEAD is the
   sampled sha"; refused, nothing is recorded; else the receipts are recorded at `treeId` sampled
   once after the last (as `gate --full`, `src/gate.ts:774-789`). Red or timed out: blocked row
   (R9).
4. `prepareRun`; snapshot `git ls-files --others --exclude-standard` (for R32); print the lock
   line and the recovery; `acquireLock`.
5. If no signal yet: `applyRevert`; on failure skip to 7 with outcome blocked (R34).
6. Obligations in order through `runCommandAsync`, stopping at the first that is not `passed`.
   When they end, record which paths do not hold S(p) (R29 a) and whether the lock still names
   this run (R29 c).
7. `try/finally`: if the lock is not this run's, write nothing. Else `restoreFromLock`; a failed
   restore keeps the lock and exits 3.
8. After the lock is removed (git again): HEAD against the lock's (R29 b, R20); `git status
   --porcelain=v1 -z --untracked-files=no` outside the store directory against the empty state
   R6 guaranteed (R29 d: any index entry, or a working-tree change to a code or test path outside
   the revert set; R32 reports every line); untracked files against the snapshot (R32). Print the
   report.
9. A signal: exit 128+n. Changed under the run: final `mutation-blocked: the tree changed under
   the run ...`, exit 2. Else `mutationKey` after the restore (N14), `recordMutation`, final line,
   exit by outcome.

Handlers are removed in `finally` so an in-process test leaves none behind. Output goes through
`out`, which swallows EPIPE, so a SIGHUP that closed the terminal cannot throw out of the restore.

### The async runner (`src/run.ts`)

`runCommandAsync(cmd, { cwd, timeoutMs, tailLines? })` returns `{ result: Promise<RunResult>;
stop(): void }`. It `spawn`s `process.execPath` with `src/run-helper.mjs` and the same four
arguments `runCommand` passes (`src/run.ts:93`), `cwd` a fresh temp directory (`:94-97`), stdout
and stderr to a temp file, in the caller's process group (so a terminal Ctrl-C reaches the helper,
which kills the command's group, as it does today). `stop()` sends SIGTERM to the helper. The
promise settles on the helper's `exit` and reads `result.json` and the tail as `runCommand` does.
It validates `timeoutMs` as `runCommand` does (`:77-79`). It adds no kill logic.

### Classifying a reverted-tree run (`classify(result)`)

`timedOut`, `error` or a non-null `signal` (the shell itself was ended by a signal mstack did not
send) → blocked; `code` 126 or 127 → blocked; `code` 0 → passed; anything else, including 129-192
→ failed, which kills the run. The killed line names the signal for a code above 128.

### The receipt (`src/verification.ts`)

`MUTATION_OUTCOMES = ["mutation-killed", "mutation-survived", "mutation-blocked"]`.
`recordMutation(store, { target, sha, command, outcome, tree })` is `append(store.verification,
HEADER, [...])` and nothing else. `mutationStanding(store, slug, key, command)` returns
`"killed" | "survived" | "blocked" | "other-command" | "other-key" | "none"`: among rows with this
slug, a mutation outcome, `tree === key` and `cell(command)` equal, the last killed or survived row
decides; with only blocked rows, `blocked`; with rows at this key and another command,
`other-command`; with rows for this slug and command at another key, `other-key`; else `none`.
`receipts()` is untouched.

### The closing check, the gate, `done`, the forced marker

- `MUTATION_CHECK = "mutation"` in `CLOSING_CHECKS`, `reportedAt: []`. For an item with a base, a
  size other than `s`, a resolvable base and start, and a non-empty code diff, it maps
  `mutationStanding` to the messages of R23. `overridable` is false when git cannot answer (R24).
- The lock is a workspace fact, not the item's, so it is not a closing check: `checkMutationLock`
  in the gate's workspace section prints it once (R22), and the `done` branch of `cmdState`
  refuses on `readLock(store) !== null` before `closingProblems` (R41). As a closing check it was
  printed twice at `verifying` (review N16).
- `runVerification` (`src/gate.ts:739`) fails and runs nothing under a lock (R40).
- The workspace section warns per non-empty rescue directory (R42).
- `forcedMarker(checks)` in `src/cli.ts`: `"closed " + phrases + " (forced): "`, phrases in the
  order verification ("unverified"), r-to-test ("without a good requirement-to-test table"),
  mutation ("without a killed mutation receipt"), joined as `a`, `a and b`, `a, b and c`. It yields
  the three existing markers byte for byte. `FORCED_MARKERS` lists all seven; none is a prefix of
  another, so the `find` at `src/cli.ts:733` stays correct.

### The hook (`src/hooks.ts`)

After the existing guards, `preToolUse` tests each segment against `GIT` (`:359`) followed by
`(?:add|am|apply|checkout|cherry-pick|clean|commit|merge|mv|pull|rebase|reset|restore|revert|rm|stash|switch)(?![-\w])`.
Only on a match does it run `git rev-parse --absolute-git-dir` in `input.cwd`, then `lstat`
`mstack-mutation.lock` there: present denies, with pid and start time from `readLock` when it
parses. Git failing allows.

### This repository: running from a copy

R28 makes the mutation process refuse to revert its own source. The fix it prints, and task 5.3,
make a copy with `git worktree add --detach <dir> HEAD` outside the tree and run
`<dir>/bin/mstack verify --mutation` with the checkout as `cwd`: the copy resolves the store from
`cwd`, its gate reports "the same committed src tree", and it keeps running from its own `src/`
while the checkout's `src/` is reverted, where the checkout's own `./bin/mstack` has no `verify`
command (experiment `copy-exp`). mstack has no runtime dependencies, so the copy needs nothing
installed. Hooks are not covered by R28: a session started with `--plugin-dir .` runs every hook
from the checkout's reverted `src/`, so task 5.3 runs from a session that does not.

## Walks

What the restore does in each case that the review raised (B3, B4), when the lock goes, and what
is printed. "Report" is R32's; "row" is R13's.

| Case | Restore | Lock | Printed | Row |
|---|---|---|---|---|
| A commit from another terminal during the run | paths at S(p) get H(p) | removed (proof is per path) | HEAD moved, both shas, `git reset --soft <lock HEAD>` as the user's option | no (R29 b) |
| `git add src/a.ts` during the run | working tree restored; index never written | removed | "changed during the run: src/a.ts", with `git diff --cached -- src/a.ts` | no (R29 d) |
| The user edits a reverted `src/a.ts` | edit moved to `rescue/src/a.ts`, H(p) written | removed | the rescued path; the gate warns until the run directory is removed (R42) | no (R29 a) |
| The obligations rewrite a tracked snapshot outside the set | not touched | removed | "changed during the run: <path>", no cause named | no (R29 d) |
| The obligations write untracked `out.log` | not touched | removed | "left in place: out.log" | yes |
| A directory holding a file sits where HEAD has a file | left | **kept**, exit 3 | the paths inside; moving them away (not deleting) and `verify --restore` clears it | no |
| A read-only directory | other paths restored | **kept**, exit 3 | path and EACCES; `chmod`, then `verify --restore` | no |
| SIGKILL at any step | nothing runs | kept | the gate's line: not running, `verify --restore`, `sh <lock>` | no |
| Ctrl-C to the group at any step from the lock on | the restore completes (no child to kill; signals wait) | removed | normal restore lines | no, exit 130 |
| `verify --restore --force` under a live run | the forced restore restores; the run then writes nothing | removed by the forced restore | the run: "the lock was taken from this run" | no (R29 c) |

No case keeps the lock with deleting work as the only way out: the two that keep it are cleared
by `chmod` or by moving files elsewhere, and `sh <lock>` is always available.

Fail paths by boundary:

| Boundary | SIGKILL / power loss | SIGINT / SIGTERM / SIGHUP (alone or to the group) |
|---|---|---|
| Preconditions, baseline | nothing reverted; an orphaned baseline obligation runs on | handlers installed: the group is killed, no receipt for it, exit 128+n (R36) |
| Run directory made, lock not linked | staging and temp lock left; the next `verify` sweeps them (R15) | handled after `prepareRun`, nothing to restore |
| Lock linked, nothing reverted | `verify --restore` removes it, or `sh <lock>` | handled: restore (nothing to do), lock removed (R35) |
| Reverting | partial; restore classifies every path | waits until the revert step ends, then restores (R35) |
| Obligations | an orphaned helper and obligation keep running on the tree | the group is killed, restored, exit 128+n (R17) |
| Restoring | `verify --restore` resumes; idempotent | waits until the restore ends (R35) |
| Lock removed, before the row | no row; fail-closed | no row, exit 128+n |

## Experiments this round

All under the session scratchpad `spec42r2/` (macOS APFS, git 2.54.0 Apple Git-157, node
v26.13.1, bun 1.3.11), each a `bash` script starting `set -euo pipefail`; outputs saved beside
them as `*.out`.

- `fs-exp.sh` + `fs-exp.mjs`, under both runtimes, identical results:
  - a: `renameSync(file, dir)` with an untracked file in `dir` failed `EISDIR`; the directory and
    file survived. a2: the same with an empty directory, also `EISDIR`.
  - b: `rmdirSync` of a non-empty directory failed `ENOTEMPTY`; contents survived.
  - c: writing other bytes over a tracked file and HEAD's bytes back through temp + rename left
    `git status --porcelain` with only the untracked scratch entries and `git diff --cached`
    empty.
  - d: `git cat-file --filters <rev>:crlf.txt` under `*.txt text eol=crlf` held CRLF, the blob
    did not; writing the start form then the backed-up form left the path clean. d2: a binary
    blob came through `--filters` byte-identical. d3: a symlink blob through `--filters` printed
    its target string; `ls-tree` said `120000`.
  - e: a symlink made under a temp name and renamed over a regular file showed ` T link`; the
    file renamed back made it clean. f: clearing and restoring the executable bit, clean.
  - h: a second non-recursive `mkdirSync` of a run directory failed `EEXIST`; a second `wx`
    write failed `EEXIST` and kept the first copy. i: one `renameSync` moved a directory with
    its file into a rescue location. j: `unlinkSync` of a directory failed `EPERM`.
- `crlf-exp.sh`: the tree held LF for `crlf.txt` (committed before the attribute applied);
  `git cat-file --filters HEAD:crlf.txt` wrote different bytes (sha256 `bce2aeea...` before,
  `a4d18c3e...` after) and `git status` then printed ` M crlf.txt`. Regenerating HEAD from git is
  not restoring the user's tree; a byte backup is.
- `sig-exp.sh` (`sig-exp.mjs`, `sig-victim.mjs`): a victim in its own group installs handlers and
  runs a 30-step synchronous loop (~3 s); the harness sends SIGINT to the whole group 0.7 s in.
  With filesystem work only, node and bun both finished 30/30 steps and ran the handler after the
  loop (+2502 ms, +2494 ms). With a synchronous `sleep 0.1` child per step (as `git()` does),
  the in-flight child died of SIGINT on both (`step 6 child failed: SIGINT`, 29/30). So a restore
  with no child process cannot be interrupted by a group Ctrl-C, and one with git children can.
- `copy-exp.sh`: in a `--no-local` clone of this checkout at 6179767, `git worktree add --detach
  <scratch>/cli-copy HEAD`; `<copy>/bin/mstack version` with the clone as `cwd` printed `mstack
  0.2.1 at .../cli-copy`; its gate printed `[ok] store root is an mstack checkout, and this report
  came from within the same repository at the same committed src tree (b4669c23)`; `state active`
  printed `mutation-check`. With the clone's `src/` put back 40 commits, the copy still ran
  (`state show 42`), and the clone's `./bin/mstack verify --restore` printed `mstack: unknown
  command 'verify'`. `git worktree remove` left one worktree.
- `merge-exp.sh`: a base on the branch with `main` merged in after it: neither the base nor the
  fork point is an ancestor of the other, `base..HEAD` holds `src/item.ts src/other.ts` (the
  second is `main`'s) and one merge commit. The same work rebased: the base is not in HEAD's
  history, the fork point is the start, zero merges, only the item's paths. A stacked branch: the
  fork point is an ancestor of the base. On `main` after a `--no-ff` merge of that branch with
  `main` moved first: `merge-base HEAD main` is HEAD (no fork point, start = base), and
  `base..HEAD` holds `main`'s `src/m3.ts` and `src/other.ts` and two merges. R33 refuses both
  merge shapes and neither of the others.
- `hash-exp.sh`: from a store in `pkg/app`, `git hash-object --stdin-paths` given `src/x.ts`
  failed (`could not open 'src/x.ts'`); given the absolute path it printed the expected blob id.

## Rejected alternatives

**A scratch git worktree or a copy of the tree for the obligations.** Nothing to restore, and a
crash cannot hurt the user's code. Rejected because the obligations depend on what a copy lacks,
and making it up is per ecosystem: which ignored directories to link or copy (`node_modules`,
`.venv`, `target/`, build output), local environment files, and tool caches that hold absolute
paths into the checkout. A suite green in the checkout and red in a fresh worktree gives a red
baseline that says nothing about the tests. The price accepted is the lock. (The *CLI* does run
from a copy in this repository, R28: the CLI needs nothing installed, the obligations do.)

**`git restore --source` for the revert and the restore.** Rejected on the review's rung-4
result: it deleted a directory with an untracked file in it to write the source's file, exit 0.
Writing bytes with the filesystem fails `EISDIR`/`ENOTEMPTY` instead of removing anything
(`fs-exp` a, a2, b), and it runs no child a Ctrl-C can kill (`sig-exp`).

**Regenerating HEAD's content from git at restore time** instead of a byte backup. Rejected: it
is a child process during the restore, and it is not the user's bytes (`crlf-exp`).

**`git stash` to park the item's changes.** The item's code is committed, so there is nothing to
stash; a stash entry is shared repository state (`refs/stash`), a crash leaves an entry nobody can
relate to the tree, and `stash pop` after the user has done anything conflicts.

**Whole-tree `git checkout <from> -- .` / `reset --hard` for revert or restore.** They touch tests,
docs and the store, write the index, and `reset --hard` is denied by this repository's own hook
(`src/hooks.ts:376-379`). Restoring a whole tree after a crash would overwrite a test edit made in
between.

**A proof against `git status` and the current HEAD.** Round 1's. Rejected: a commit or a `git add`
during the run made it fail for good, with discarding work the only exit (review B3, `git-exp.sh`
cases c and g). The proof is per path against the lock's record.

**A restore list kept in memory with `finally` and handlers only.** SIGKILL, an OOM kill and a
power cut run no handler.

**A detached watchdog process.** Survives SIGKILL, not a power cut, and `verify --restore` is needed
anyway.

**A mutant per path.** N obligation runs instead of one, for a question (which file the tests
notice) the item does not ask.

**Computing the item's own changes past a merge from first-parent, non-merge commits (N7).**
Rejected: reverse patches of a commit series conflict, and a merge's conflict resolution belongs
to neither side. R33 refuses instead and names the two fixes.

**Refusing a run while any untracked code or test file exists** (as strict as R6). Rejected: the
classifier calls `notes.txt` and `out.log` code (`src/pathclass.ts:50-55`), so it would refuse in
most checkouts. Untracked files are left alone and are in the key, marked untracked.

**Keeping each new file as an empty stub instead of removing it**, so that "the suite imports a
file the revert removed" does not count as a kill. Deferred, not rejected on merit: a stub is not
the start's tree, and an empty module fails an import of a named export just the same in most
languages. The killed line says a build failure and an assertion failure look the same.

**Taking the lock before the baseline** (review N5). Rejected: a crash during a long baseline
would leave a red gate with nothing reverted. What it protects against is narrow: a revert only
happens after a green baseline at the same tree, so a `gate --full` or a second baseline that
overlaps the reverted window can falsely record `failed` (fail-closed), and can record `passed`
only for a reverted tree that passed, at a tree whose real code had just passed too.

## Trade-offs accepted

- `killed` does not mean the tests assert behaviour: a revert that breaks the build, removes a
  file the suite imports, or crashes the runner (exit 128+n) kills. In exchange the rule is one
  sentence and a refactor (or a change that only deletes code) is the honest false negative; both
  close by a forced close that names the check (R25).
- A flaky test can kill or survive by chance, and this repository has a load-sensitive one
  (`.mstack/progress/diagnosis_unidentified-flaky-test.md`). The docs say to run the mutation
  alone, with no other suite running; a survived row after a killed one wins (R23).
- The baseline runs with captured output and a timeout, unlike `gate --full`, which inherits the
  terminal and has none (`src/gate.ts:763`). A suite that behaves differently without a TTY gives
  a red baseline here (blocked, not a false kill).
- The key holds untracked code and test files (row 12:40:58Z leaves out only docs and the store),
  so deleting an untracked, non-ignored output file such as `out.log` voids a receipt, exactly as
  it changes `treeId`. Ignore build output.
- Every code or test commit after a killed run voids it, so a slow suite pays up to two full runs
  after each such change. The docs say to run the mutation last, after review.
- A refusal on a dirty tracked file is strict: a test or doc edit also refuses. In exchange the
  baseline and the reverted run see a tree the user can name.
- Reverting `package.json` or a lockfile does not revert installed dependencies; reverting
  `.gitattributes` does not change how the start's other files are read (all are read before the
  first write, with the current attributes).
- A rescue directory in a linked worktree's git directory goes with that worktree when `git
  worktree remove` (or `mstack worktree prune`, `src/worktree.ts:146-147`) removes it; the gate's
  warning (R42) is what tells the user first. Power-loss ordering of the fsyncs is not
  established on macOS (the review did not check `F_FULLFSYNC`).
- The hook is a speed bump: aliases, interpreters, `npm version`, `git -C` from outside and the
  Edit/Write tools pass it (R21). R16, R29 and the gate are what hold.
- Two runners in `src/run.ts`, a sync one and an async one, sharing one helper.
- Every in-flight item at `verifying` with a base and a size other than `s` goes red until it has
  a killed receipt; no migration (row 12:32:13Z).
- The status line does not show the lock: it renders on every message and must not add git calls.
  The Stop hook carries the gate's red line.

## Open questions

- Is 900 seconds the right default for `--timeout`? A ceiling for a hang, not an estimate; the
  baseline's duration is not recorded. Deferrable: one constant.
- Should a `mutation-blocked` row carry its reason in a seventh column? Not now: the reason is
  printed. `ensureHeader` takes a trailing column if readers ask (`src/tsv.ts:45-58`).
- Closing on the default branch after a merge commit, when the default branch moved after the
  branch left it: the start is the base, the key then holds the default branch's other changes,
  the branch's receipt no longer matches, and a new run there is refused (R33). Today's ship
  order merges first and closes after (`skills/ship/SKILL.md` step 7). Task 5.4 says what to do
  for item 42; whether the ship skill should close before the merge is left to the user.
