## Context

The design row (decisions.tsv, 2026-11-18T12:32:13Z) is the decision and this file elaborates
it. Facts in the checkout that shape it, each read at the cited line:

- There is no `verify` command today: `main` dispatches 13 commands and none is `verify`
  (`src/cli.ts:72-107`). `verify` is new, with two flags.
- `treeId` fingerprints *uncommitted* content outside the store and is `clean` after a commit
  (`src/verification.ts:201-264`); a receipt is keyed `(sha, command, tree)` (`:351-365`).
  That key cannot serve here: it changes with every commit, and the design says a docs or store
  commit must not void a mutation receipt. So the mutation key is a second fingerprint, of
  the code part alone.
- `receipts()` keeps rows whose `outcome` is `passed` or `failed` (`src/verification.ts:325-336`)
  and `append` writes whatever cells it is given (`src/tsv.ts:60`). New outcome words in the
  same file are invisible to every older reader and to `status()`, which is what keeps a
  mutation row from ever counting as a verification run.
- A closing check is one entry in `CLOSING_CHECKS` (`src/closing.ts:171`); the gate reports it
  at `verifying` and `state set --status done` runs it (`:178-188`, `src/cli.ts:632-693`). A
  forced close writes a marker constant into `closed_by` (`src/cli.ts:226-231`).
- The size check's start and code-path predicate are `measureStart` (`src/size.ts:70`) and the
  closure `counted` inside `measureDiff` (`:138-141`). The revert set must be the same set the
  size check measures, so the predicate is exported and both use it.
- `runCommand` is `spawnSync` (`src/run.ts:81,92-93`). A synchronous call cannot run a signal
  handler: a SIGTERM sent to `mstack` alone waits until the obligation exits, which may be
  never. R17 needs an async runner. `src/run-helper.mjs` already kills the process group on
  its own SIGINT/SIGTERM/SIGHUP and on timeout (`:43-52`), so the async runner spawns that
  helper rather than a second kill implementation.
- The PreToolUse hook is a list of regexes over one shell segment (`src/hooks.ts:359-402`,
  `shellSegments` at `:461`) and reads no state. The lock rule is the first guard that needs
  a filesystem answer, so it is a separate branch, not another `GUARDS` entry.
- `git restore --source=<commit> --worktree -- <paths>` writes the working tree only: tried on
  git 2.54, it left `git diff --cached` empty, restored the executable bit and a symlink-to-file
  type change, and failed the whole command with "pathspec did not match" for a path absent from
  the source commit. So a path that is absent at the target is removed with `unlink`, and the
  others are restored; never in one command.

## Usage

```
$ mstack verify --mutation          # exit 0 killed, 1 survived, 2 blocked or refused
mutation: mutation-check (42), start 3fa9c1d2 (base), 5 code file(s) to revert
mutation: baseline: `npm test` recorded green at this tree, not re-run
mutation: lock /repo/.git/mstack-mutation.lock
mutation: reverting 5 file(s)
mutation: running `npm test` on the reverted tree
mutation: `npm test` exit 1 after 8.2s
mutation: restoring
mutation: restored, tree verified
mutation-killed: `npm test` failed without the change (last 20 lines follow; a build failure and an assertion failure look the same here)
...

$ mstack verify --restore           # after a SIGKILL or a power cut
mutation: lock from pid 4242 (not running), started 2026-11-18T14:02:11Z, HEAD 3fa9c1d2, 5 path(s)
mutation: 2 at the start, 3 at HEAD
mutation: restored 2, tree verified, lock removed
```

This is a sketch of the contract in spec.md, not output from a run; the docs task pastes real
output.

## Shape

**The revert set** (`src/mutation.ts`). `revertSet(store, from)` returns `Entry[]`,
`{ path: string; kind: "added" | "deleted" | "modified" | "typechange" }`, from
`git diff --raw -z --no-renames --full-index --relative <from> --` (working tree against the
start, so a modified-and-uncommitted file is in it) plus `git ls-files --others
--exclude-standard -z` for untracked code files (kind `added`, never reverted: R3, but counted
in the fingerprint). Filtered by the exported `isCountedCode(store, path)` from `src/size.ts`
(code class, under the store root, outside the store directory). Entries whose mode on either
side is `160000` are returned in a separate `skipped` list. Git is called with
`GIT_LITERAL_PATHSPECS=1` so that a file named `*.ts` is a path and not a glob.

**The key** (`src/mutation.ts`). `codeKey(store, from)` = `"code:" + sha256(lines).slice(0,16)`,
one line per entry sorted by path: `path NUL kind NUL startMode:startBlob NUL nowMode:nowId`.
`nowId` is the blob id git assigns the working-tree file (`git hash-object --stdin-paths`,
the same call `treeId` makes) or the symlink target string through `lstat` as `treeId`'s
`classify` does (`src/verification.ts:286-306`); absent is `-`. It is computed from the
working tree and the start, never from HEAD, so an uncommitted code edit voids a receipt and a
rebase that changes no code path does not. Returns `null` if git cannot answer.

**Preconditions** (`src/mutation.ts`). `refusals(store, state, item)` returns the first of:
not a repo, no base, base not a commit, no start, no obligations, an operation in progress
(any of `rebase-merge`, `rebase-apply`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`,
`BISECT_LOG`, found with `git rev-parse --git-path`), empty revert set, tracked changes
outside the store directory (`git status --porcelain=v1 -z --untracked-files=no`, minus
paths under the store directory), paths in the way (for each `deleted`, `modified` or
`typechange` entry that the revert puts back: `lstat` of the path and of each parent; present
means in the way, except an entry the same revert removes first, which is how a case-only
rename on a case-insensitive filesystem passes). A refusal is a message and a fix; nothing has
been written when it is returned. The same function is called again after the baseline.

**The lock** (`src/mutation-lock.ts`). `lockPath(store)` = `<absolute git dir>/mstack-mutation.lock`.
Content, JSON, one object: `{ v: 1, pid, host, startedAt, head, from, root, entries: Entry[] }`.
`acquireLock(store, lock)` writes `<lock>.<pid>.tmp`, `fsync`s it, `linkSync`s it to the lock
name (EEXIST means someone holds it: refuse), `fsync`s the directory, unlinks the temporary.
A reader therefore sees no lock or a whole one, never half of one. A lock that does not parse
is not guessed at: `--restore` refuses and prints the three-line manual recovery (`git restore
--source=<head> --worktree -- <paths>` for the paths still reverted; `unlink` for the
paths HEAD does not have), because a lock is always complete before the first file is touched,
so an unparseable one is damage and not an interrupted write.

**Revert and restore** (`src/mutation-lock.ts`). `applyRevert(store, lock)`: for `added`,
`unlink`; for the rest, `git restore --source=<from> --worktree -- <path>`, one path per call
so one failure does not hide the others. `restoreFromLock(store, lock, hooks?)`: for each
entry, find the state by comparing the working tree to the two commits (`git diff --raw
<head> -- <path>` for paths HEAD has; for a path HEAD lacks, existence plus
`git hash-object --path=<path> <file>` against the start blob): *at HEAD* (nothing to do),
*at the start* (restore), *neither* (copy to `<git dir>/mstack-mutation.rescue/<path>`, then
restore). A path HEAD has is restored with `git restore --source=<head> --worktree`; one HEAD
lacks (`deleted` since the start) is removed with `unlink`. Then the proof: `git diff --raw
<head> -- <paths>` is empty for the paths HEAD has, the others are absent, and `git status
--porcelain=v1 --untracked-files=no` outside the store directory is empty. Only then is the
lock `unlink`ed (`ENOENT` is fine: two restores can race and both are right). `hooks` is the
test seam, as `LockOptions.step` is for `withLock` (`src/tsv.ts:101-105`): named steps
`lock-written`, `reverted:<n>`, `obligations-running`, `restored:<n>` at which a test stops
the process, to make each SIGKILL point of R18 happen on purpose.

Index and HEAD are never written. The restore target is the lock's `head`, not the current
HEAD, so a commit made despite the hook is undone in the working tree and left in history (R20).

**The run** (`src/mutation-run.ts`). `runMutation(store, options)`:
`refusals` → baseline (`status()` satisfied at the current `treeId`, tree not `unknown`; else
run each obligation with `runCommandAsync`, record `passed`/`failed` as `gate --full` does,
sampling `treeId` once after) → `refusals` again → `acquireLock` → install the signal
handlers → `applyRevert` → obligations in order with `runCommandAsync`, stop at the first
that does not exit 0 → `try/finally`: `restoreFromLock` → remove the lock → on success only,
`recordMutation`. The signal handler sets a flag, asks the runner to kill the group and lets
the same `finally` restore; handlers ignore further signals once the restore has begun.

`runCommandAsync(cmd, { cwd, timeoutMs })` in `src/run.ts`: an async `spawn` of
`src/run-helper.mjs` with the same arguments `runCommand` passes, output to a temp file,
returning the same `RunResult`. On the parent's signal it sends SIGTERM to the helper (which
already kills the group and exits 128+n) and awaits it. It adds no kill logic of its own.

**The classification of a reverted-tree run** (`src/mutation-run.ts`, `classify(result)`):
`timedOut` or `error` or a `signal` → blocked; `code` 126 or 127 → blocked; `code` 0 → passed;
anything else → failed. A reverted run is *killed* at the first failed obligation, *survived*
when all passed, *blocked* at the first blocked one. A baseline obligation that is failed or
blocked blocks the whole run before the lock.

**The receipt** (`src/verification.ts`). `MUTATION_OUTCOMES = ["mutation-killed",
"mutation-survived", "mutation-blocked"]`; `recordMutation(store, { target, sha, command,
outcome, tree })` is `append(store.verification, HEADER, [...])` and nothing else, so the
header is unchanged and an older file is not widened. `lastMutation(store, slug, key,
command)` reads `readRecords` for rows whose outcome is a mutation outcome, whose `target`
is the slug, whose `tree` is the key and whose `command` equals `command` through `cell`,
and returns the last. `receipts()` is untouched and keeps filtering to `passed`/`failed`.

**The closing checks** (`src/closing.ts`). `MUTATION_CHECK = "mutation"`, `reportedAt: []`
(so the gate reports it at `verifying` only, and `state set` runs it for every status);
`overridable: true` except when git cannot answer, then `false`. `MUTATION_LOCK_CHECK =
"mutation-lock"`, `reportedAt` every active status, never overridable. The gate additionally
has a workspace line from the same function, so a lock with no active item is red.
`CLOSING_CHECKS` gains both; `gateProblems` and `closingProblems` do not change.

**The forced-close marker** (`src/cli.ts`). `FORCED_MUTATION = "closed without a killed
mutation receipt (forced): "`. The combination logic that picks between `FORCED_UNVERIFIED`,
`FORCED_TABLE` and `FORCED_BOTH` becomes a function of the set of overridden check names that
yields one marker naming each of them; every marker joins `FORCED_MARKERS` so a later
`--closed-by` keeps it (`src/cli.ts:733`).

**The hook** (`src/hooks.ts`). `preToolUse` gains, after the existing guards, a branch: if any
segment matches `GIT` + `(commit|add|stash)(?![-\w])` (the `GIT` prefix at `:359` already eats
global options), run `git rev-parse --absolute-git-dir` in `input.cwd` once, and deny when
`mstack-mutation.lock` exists there, with the lock's pid and start time read from it in the
reason. Any failure to read means allow.

## Rejected alternatives

**A scratch git worktree or a copy of the tree.** The obvious design: nothing to restore, a
crash cannot hurt the user's code. Rejected because the obligations depend on what a copy does
not have: installed dependencies (`node_modules`), build output, ignored configuration, local
environment files, absolute paths in tool caches. A suite that is green in the checkout and
red in a fresh worktree gives a red baseline for a reason that has nothing to do with the
tests, and symlinking the ignored directories in makes the copy a second in-place edit with
the same hazard and less honesty. The price accepted is the lock.

**`git stash` to park the item's changes.** Rejected on two counts. The revert is not a
stash of uncommitted work: the item's code is *committed*, so there is nothing to stash; the
revert has to write files whatever happens. And a stash entry is shared repository state
(`refs/stash`, common to linked worktrees), a crash leaves an entry whose relation to the
tree nobody can read, and `git stash pop` after the user has done anything conflicts. The
lock file is the one place the state lives.

**Whole-tree `git checkout <from> -- .` or `git reset --hard <from>` for the revert, and
`git checkout HEAD -- .` or `reset --hard HEAD` for the restore.** Rejected: they touch tests,
docs and the store, they write the index, and `reset --hard` is a command this repository's own
hook denies (`src/hooks.ts:376-379`). Restoring a whole tree is also unsafe after a crash,
because it would overwrite an edit the user made to a test between the crash and the restore.
The revert set is a list; the restore touches the list.

**A restore list kept in memory with `finally` and signal handlers only.** Rejected: SIGKILL,
an OOM kill and a power cut run no handler. The lock exists because those happen.

**A detached watchdog process that restores when the parent dies.** Rejected: it survives
SIGKILL but not a power cut, it is one more process to clean up, and `verify --restore` is
needed anyway for the case it cannot cover.

**Mutating one file at a time (a mutant per path).** Rejected on cost: N obligation runs
instead of one, and the question the item asks is whether the tests fail without the change,
not which file they notice.

## Trade-offs accepted

- We accept that `killed` does not mean the tests assert behaviour: a revert that breaks the
  build, or removes a file the suite imports, kills at exit 2, and an exit code cannot tell a
  compile error from an assertion. In exchange the rule is one sentence and a refactor is the
  only honest false negative. The output says so on every killed line.
- We accept that the receipt is keyed by the code part only (the design row), so editing a
  *test* after a killed run does not void it. Recorded in the hand-off for the spec review.
  What does void it, beyond the code, is a changed `command`, which costs nothing.
- We accept that a refusal on a dirty tracked file is strict: a test or doc edit also refuses.
  In exchange the baseline and the reverted run see a tree the user can name, and the restore
  needs no merge logic.
- We accept an async runner next to the sync one in `src/run.ts`: two functions, one helper.
- We accept that an item with a base, a size other than `s` and a code diff goes red at
  `verifying` until it has a killed receipt, with no migration for items in flight.
- We accept that the hook cannot see aliases (R21). The window the hook covers is the duration
  of one command, or until a human runs `--restore`.
- We accept that the status line does not show the lock: it renders on every assistant message
  and must stay free of git calls it does not already make; the Stop hook carries the gate's
  red line to the model, which is where the person fixing it will read it.

## Open questions

- Is 900 seconds the right default for `--timeout`? It is a ceiling for a hang, not an
  estimate; the baseline's duration is not recorded anywhere, so a ratio to it is not
  available. Deferrable: the flag exists and the default is one constant.
- Should a `mutation-blocked` row carry its reason in a new trailing column? Not now: R13
  keeps six columns and the reason is printed. If reviewers read blocked rows by hand often,
  a seventh column is the only schema change `ensureHeader` takes (`src/tsv.ts:45-58`).
- Should test edits void a killed receipt? See the hand-off; the design row says no and this
  spec follows it.
