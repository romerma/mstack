## Context

The decision rows (decisions.tsv 2026-11-18T12:32:13Z, 12:40:58Z, 13:02:23Z, and for this round
2026-11-19T08:27:17Z and 08:27:32Z) are the decision; this file elaborates them. Each fact below
was read at the cited line on `feat/mutation-check` at 13ca783.

- No `verify` command exists: `main` dispatches 13 commands and `help`, none of them `verify`
  (`src/cli.ts:72-111`); `USAGE` is at `:38`.
- A receipt row is six cells (`src/verification.ts:45`) written by `append` with whatever cells it
  is given (`src/tsv.ts:60`); `receipts()` keeps only `passed` and `failed` (`:325-336`), so new
  outcome words are invisible to every reader that exists. `treeId` (`:201-264`) changes with
  every commit, so the mutation key is its own fingerprint (row 12:40:58Z).
- `measureStart` is `src/size.ts:81-89`; the code predicate is the closure `counted` inside
  `measureDiff` (`:149-152`).
- `runCommand` is `spawnSync` (`src/run.ts:81,92-93`), which runs no signal handler while it
  blocks (round 1 review, `specreview42/sig-exp.sh`). `src/run-helper.mjs` makes the command lead
  its own group (`:17`), kills the group on its own SIGINT/SIGTERM/SIGHUP (`:43-50`) and on
  timeout (`:32-35`), and is started with `cwd` a temp directory so bun loads no `bunfig.toml` or
  `.env` from the target (`src/run.ts:93-99`).
- `git()` is `execFileSync` in the caller's process group with UTF-8 stdout, stderr dropped and a
  5 s timeout (`src/git.ts:21,61-76`); execFileSync's default 1 MiB buffer fails with ENOBUFS on a
  larger blob (`spec42r3/stream-exp`, `specreview42r2/buf-exp`). A terminal Ctrl-C kills such a
  child (`spec42r2/sig-exp`), so the revert and the restore run none.
- The PreToolUse hook is regexes over shell segments (`src/hooks.ts:359` `GIT`, `:361-402`
  `GUARDS`, `:461` `shellSegments`, `:537-559` `preToolUse`) behind a `Bash` matcher
  (`hooks/hooks.json:72-74`); every hook runs `${CLAUDE_PLUGIN_ROOT}/bin/mstack`. The Stop hook
  sends the gate's failures as context (`src/hooks.ts:279-295`).
- The gate's workspace section is `src/gate.ts:89-91` (it runs with no active item);
  `runVerification` (`:744-808`) inherits the terminal (`:768`) and samples `treeId` after the
  last command (`:794`).
- `runningCliRoot()` is `src/paths.ts:99`. The closing checks (`src/closing.ts:272`) are item
  100's and are not touched here.

## Usage

```
$ mstack verify --mutation [--timeout 900]   # 0 killed, 1 survived, 2 blocked or refused, 3 not restored
mutation: mutation-check (42), start 3fa9c1d2 (base), 5 code file(s) to revert
mutation: baseline: `npm test` recorded green at this tree, not re-run
mutation: lock /repo/.git/mstack-mutation.lock, run 20261119T090211Z-4242-9f3a
mutation: if this process dies: /home/u/.claude/plugins/cache/mstack/0.3.0/bin/mstack verify --restore
mutation: until the run ends, save nothing to the files it reverts: a save in the moment one is put back is lost
mutation: reverting 5 file(s)
mutation: running `npm test` on the reverted tree
mutation: `npm test` exit 1 after 8.2s
mutation: restored, tree verified, lock removed
mutation: left in place: coverage.json (`git status --short -- coverage.json`)
mutation-killed: `npm test` failed without the change (last 20 lines follow; a build failure and an assertion failure look the same here)

$ mstack verify --restore                    # 0 restored or nothing to do, 2 refused, 3 not restored
mutation: lock from pid 4242 (not running: no such process), run 20261119T090211Z-4242-9f3a, 5 path(s)
mutation: 2 at HEAD, 3 as the revert wrote them, 0 other
mutation: restored 3, tree verified, lock removed
```

A sketch of the contract, not output from a run; task 3.4 pastes real output into the wiki.

## Shape

### The sets and the key (`src/mutation.ts`, reads only)

- `scopeClass(store)` moves out of `measureDiff` and is exported from `src/size.ts`; it returns a
  store-relative path's class, or `null` under the store directory. `measureDiff` counts
  `scopeClass(store)(p) === "code"`, so the size check does not change.
- `revertSet(store, start)` parses `git diff --raw -z --no-renames --no-abbrev --relative <start>
  HEAD --` (`--full-index` leaves `--raw` blobs at 7 digits: `impl42s1/raw`) into `{ path, startMode, startBlob, headMode, headBlob }` and keeps class `code`. It also
  returns every path of that diff, of any class, for R3's prefix test. It reads git's output as
  bytes: `git()` decodes with replacement (`src/git.ts:61-76`), which turns a name that is not
  UTF-8 into one that is not on disk, so R3's name test runs on the bytes (`TextDecoder` with
  `fatal`).
- `mutationKey(store, start)`: the tracked part from `git diff --raw -z --no-renames --no-abbrev
  --relative <start> --`, the untracked part from `git ls-files --others --exclude-standard -z`,
  both kept to `code` and `test`; one line per path, sorted: `path NUL tracked|untracked NUL
  startMode:startBlob NUL now`, where `now` is `-`, `120000:<target>` (from `lstat`/`readlink`, as
  `treeId`'s `classify` does, `src/verification.ts:286-306`), `<mode>:<blob>` with the blob from
  `git hash-object --stdin-paths` fed absolute paths (relative ones resolve from the repository
  root: `spec42r2/hash-exp`), or `other`. The key is `sha256(lines)` to 16 hex digits; `null` when
  git fails, a path holds a newline, or a path's name is not UTF-8 (both parts are read as bytes;
  decoded with replacement, such a name is not the one on disk, and its content would never reach
  the key: round 1 review, NB5).

### Refusals (`src/mutation.ts`)

`refusals(store, state, item, running = runningCliRoot())` returns the first `{ message, fix }` or
`null`, in this order: not a repository; no base; base not a commit; start lost; no obligations; an
operation in progress (`rebase-merge`, `rebase-apply`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`,
`REVERT_HEAD`, `BISECT_LOG` through `git rev-parse --git-path`); the lock exists; empty revert set;
the shapes of R3; the merges of R4; tracked paths outside the store directory flagged
skip-worktree or assume-unchanged, whose changes `git status` does not show (`git -C <top>
ls-files -v -z`: tag `S`, or a lower-case letter; round 1 review, B2); tracked changes outside the
store directory (`git status --porcelain=v1 -z --untracked-files=no`); the working-tree entries of R2; R5 (`realpath` of each
path under `realpath(running)`).

- R3's modes: anything but `000000`, `100644`, `100755` on either side.
- R3's file/directory test: a set path p such that another path of the diff starts with `p/`, or
  a parent of p is itself a path of the diff (`spec42r3/shape-exp`: it finds a file that became a
  directory, the reverse, and a directory that holds only a test, from the diff alone).
- R3's collisions: every set path and every parent prefix of one, grouped by `fold(s) =
  s.normalize("NFD").toLowerCase().toUpperCase().toLowerCase().normalize("NFC")`; a group with two
  spellings is refused. On this APFS volume every pair the filesystem treats as one name (case,
  NFC/NFD, `ß`/`ss`, `K`/Kelvin sign, `ς`/`σ`, `ﬁ`/`fi`) folds equal, and `İ`/`i` and `a`/`b` do
  not (`spec42r3/name-exp` e). Without the first `toLowerCase`, `ẞ` (U+1E9E) and `ss` fold apart;
  a sweep of 145,748 names finds 2,533 collisions on this volume and 0 that this fold misses
  (`impl42s1/fold`, node and bun; `specreview42r3/fold` found the one miss). The refusal applies on
  every filesystem, so Linux CI tests it.
- R3's names: a set path whose bytes hold a newline, or that `TextDecoder("utf-8", { fatal: true
  })` rejects.
- R4: for each `m` of `git rev-list --merges <start>..HEAD`, each parent after the first must pass
  `git merge-base --is-ancestor <parent> <start>` (`spec42r3/merge-exp`: refuses main merged after
  a base on the branch and a sibling merged after a fork-point start, passes main merged after a
  fork-point start, a rebase and a stacked branch; it also refuses the item's own sub-branch
  merged back, shape 6, which is accepted).
- R2's entries: for a path the start has and HEAD lacks, `lstat` must fail with ENOENT (so a
  variant counts as in the way); every parent must be a directory by exact name or absent with
  nothing resolving there; a path HEAD has must be present by exact name.

### Exact names (`src/mutation-tree.ts`)

`entryAt(root, p)` walks p's components: each directory's `readdirSync` (cached for one pass and
dropped after every write the pass makes) must list the component exactly, and each non-last
component must `lstat` as a directory. It returns `absent`, `file` (SHA-256 and `st_mode &
0o7777`), `dir`, `symlink` or `other`; for `absent` it also returns the name on disk of a variant,
found by matching `lstat(p).ino` among the parent's entries; and `parent` when a parent is a
symlink, not a directory, or a directory under another name (with that name on disk, for R2's
message and R15's `mv`). A `file` is hashed through one descriptor opened `O_NOFOLLOW |
O_NONBLOCK`, and its stat is that descriptor's `fstat`, taken before the bytes are read: the
revert's and the restore's re-check compare against what was judged. `spec42r3/name-exp`, node and bun: a
user's `Foo.ts` where the lock says `foo.ts` is absent by exact name though `lstat` resolves it,
`rename(tmp, "foo.ts")` then destroys its content (b), and moving it by its name on disk into a
rescue directory first keeps both (c); an NFD name on disk is absent under its NFC spelling (d).

### The lock and the run directory (`src/mutation-lock.ts`)

```ts
type Identity = { sha256: string; bits: number } | null; // null is absent
interface LockEntry { n: number; path: string; start: Identity; head: Identity; tmp: string }
interface Lock {
  v: 1; run: string; pid: number; host: string; boot: number; pidns: string | null;
  startedAt: string; cli: string; root: string; head: string; start: string;
  branch: string | null; // `git symbolic-ref --quiet --short HEAD`; null when detached
  entries: LockEntry[]; createdDirs: string[]; removedDirs: string[];
}
```

- `tmp` is `.mstack-mutation-<run>-<n>.`; a writer appends its own pid and `.tmp`, so two
  restores never share a temp file, and every temp name is derived from the lock.
- `createdDirs`: parents of start-only paths that are absent now, shallowest first.
  `removedDirs`: parents of HEAD-only paths that the start lacks, deepest first.
- `prepareRun(store, start, set)` writes only inside the git directory. It makes the run directory
  with a non-recursive `mkdir` (EEXIST draws a new id), then per entry: `start/<n>` through
  `gitToFile(store, ["cat-file", "--filters", "<start>:./<p>"], fd, 60_000)`, a new `src/git.ts`
  function that `spawnSync`s git with the staged file's descriptor as stdout, so no buffer exists
  (`spec42r3/stream-exp`: 3 MiB binary and 2 MiB CRLF text equal to what checkout writes, both
  runtimes); `head/<n>` a byte copy of p (regenerating HEAD from git is not the user's bytes:
  `spec42r2/crlf-exp`), and H(p) is taken from that copy: the SHA-256 of the bytes copied and the
  bits from an `fstat` of the descriptor read. An edit between the copy and the lock then fails
  the revert's check and stays; with H read from p at the lock, S was written over it and it
  existed nowhere (`specreview42r3/hcopy`, node and bun). Files and directories are fsynced. `--filters` may fetch a Git LFS object
  over the network, bounded by the 60 s; one that is missing, or a required filter that cannot
  run, exits 128 and becomes R1's refusal (`specreview42r2/filter-exp`).
- `acquireLock` writes `mstack-mutation.lock.<run>.tmp`, fsyncs it, `linkSync`s it to the lock
  name (EEXIST: refuse), fsyncs the directory, unlinks the temp. A reader sees no lock or a whole
  one. `readLock` returns `null`, `{ lock }` or `{ damaged }`; whatever is at the name is a lock,
  opened `O_NOFOLLOW | O_NONBLOCK`, so a symlink there is not followed and a FIFO does not block,
  and one that is not a regular file is `damaged` (round 1 review, NB7).
- `validateLock` is R24; it finds a path that appears twice by R3's `fold`, so two spellings of one
  path are refused (round 1 review, NB3). `sweepStale` runs once the run holds the lock: it removes
  `mstack-mutation.lock.*.tmp` other than its own and every run directory the lock does not name
  whose `rescue/` is empty or absent. That includes the staging of a live run that has prepared and
  not yet linked its lock: one `setImmediate` (The run, step 6), or as long as that run is stopped.
  If that run links after the sweeper has ended, its lock names staging that is gone, and the
  revert's check of every staged copy (Revert, step 0) finds it before the first write and writes
  nothing (round 1 review, B1). A run racing it can have its temp file swept before its link,
  which then fails with ENOENT, not EEXIST; `acquireLock` names the lock's holder on any failed link
  while a lock exists (`impl42s2`: 3 of 6 node runs of the two-holder test hit it before).

### Is the run alive (`src/mutation-lock.ts`)

`liveness(lock)` returns `running`, `not-running` or `unknown`, with the reason:

| Lock against now, in this order | Answer |
|---|---|
| another host, at any boot | `unknown` |
| same boot (within 60 s), another pid namespace (`null` against a non-null one included) | `unknown` |
| otherwise (same boot and same pid namespace, or another boot of this host) | `process.kill(pid, 0)`: ESRCH is `not-running`; otherwise `ps -o etime= -p <pid>` (LC_ALL=C), and the process started after `now - (etime + 1)` seconds (now read before `ps`); when that bound is in a later second than `startedAt` it is `not-running` (the pid was reused); else, or when `ps` cannot answer, `running` |

A different boot time alone never makes a live pid `not-running`: a step of the wall clock past
60 s moves `boot` as a reboot does. `etime` and not `lstart`: `lstart` prints local time, which is
ambiguous for one hour each autumn. The `+ 1`: `etime` is whole seconds. macOS `ps` takes the
difference of the whole seconds of now and of the start, so `now - etime` is in the start's own
second (`impl42s2/prim/etime.out`, node and bun); Linux procps counts them on the uptime clock,
whose seconds are offset from the wall clock's by the fraction of the boot instant, so `now -
etime` can land one second after the start (walk, rung 2). Read literally, that judges a live run
`not-running` when its lock was written in the same second as its start (a recorded baseline, a
small repository), and `verify --restore` would restore under it. The cost of the bound: a pid
reused less than about two seconds after the lock reads `running`.

`boot` is `round(Date.now()/1000 - os.uptime())`; `pidns` is `readlink("/proc/self/ns/pid")`, or
`null` where `/proc` does not exist. `spec42r3/live-exp`, node and bun: the boot time is stable to
the second and equals `kern.boottime`; `/proc/self/ns/pid` is ENOENT on macOS; an exited pid gives
ESRCH and pid 1 EPERM (alive); `ps` prints the start to the second, so the comparison is by whole
seconds (a process started 1.5 s after a lock is caught that way on both runtimes). That run read
`lstart`; `etime`, also whole seconds, has not been run against it.

### Revert (`applyRevert(store, lock, step?)`, `src/mutation-tree.ts`)

Synchronous, no child process. It returns `{ ok: true }` or `{ ok: false, path, reason, written }`,
`written` the numbers of the entries it wrote or unlinked; after R11 the run's own restore takes
only those (R11, the review's N5). Step names are the test seam, as `LockOptions.step` is
(`src/tsv.ts:103-104`); all of them: `prepared` (staging done, no lock), `lock-written`,
`revert-written:<n>`, `reverted:<n>`, `obligations-running`, `rescued:<n>`, `restore-written:<n>`,
`restored:<n>` (after each entry of the restore), `lock-removed`.

0. Every staged copy, `start/<n>` and `head/<n>`, must exist and hash to S(p) or H(p) as the lock
   records; the first that does not stops the revert with nothing written (R11).
1. Entries the start lacks, deepest first: `entryAt` must hold H(p) and every parent must be a
   directory by exact name (R11); `unlink`; step `reverted:<n>`.
2. `removedDirs`: `rmdir` where `entryAt` finds a directory by exact name, so never through a
   symlinked parent (round 1 review, NB8); ENOTEMPTY leaves it (it holds something the run did not
   write).
3. Entries the start has, shallowest first: p must hold H(p), or, where HEAD lacks p, nothing may
   resolve there (R11); `mkdir` each absent parent (a `createdDirs` entry); open `<dir>/<tmp><pid>.tmp`
   with `wx` and mode 0600, write `start/<n>`, `fchmod` S's bits, fsync, close (step
   `revert-written:<n>`), `lstat` p again and compare inode, size, mtime and ctime with the
   check's (or, where HEAD lacks p, that nothing resolves there); on a change unlink the temp file
   and stop (R11); `rename` over p, step `reverted:<n>`.

### Restore (`restoreFromLock(store, lock, { step?, rename?, entries? })`, `src/mutation-tree.ts`)

Synchronous, no child process. It runs `validateLock` first: a lock that fails it writes nothing
and is one failure naming what is wrong (R24; round 1 review, NB4). `entries`, given only by the
run's restore after R11, keeps the restore and its proof to those entries; the temp sweep and the
directories are as always. First
every temp name of every entry that is a regular file is
unlinked (`spec42r3/ro-exp`: the sweep takes the run's names, leaves a directory with such a name
and the user's `notes.tmp`), in p's directory only when `entryAt` finds it a directory by exact
name, so never through a symlinked parent (round 1 review, NB8). Then entries HEAD lacks, deepest
first; `createdDirs`, deepest first, `rmdir` when empty and a directory by exact name, else left
and reported; entries HEAD has, shallowest first. Per entry, with E
the entry at p by exact name:

| E | H(p) a file | H(p) absent |
|---|---|---|
| holds H(p) | nothing | n/a |
| holds S(p) | write H | `unlink` |
| absent, nothing resolves | write H, making absent parents | nothing |
| absent, a variant resolves | rescue the variant by its name on disk, write H | nothing; the variant is reported |
| anything else (file, directory, symlink, other) | rescue E, write H | leave E; it is reported |
| a parent is not a directory by exact name | failure (R15), nothing touched | nothing (p cannot hold S there); reported |

- *A parent under another name*: where the parent is a directory whose name on disk differs from
  git's (a case-only rename during the run), the failure's fix is `mv <name on disk> <git's name>`;
  `git stash push -- <p>` does not clear it, since it writes through the renamed directory
  (`specreview42r3/dircase`).
- *A missing staged copy*: the fix is `git stash push -- <p>`, then verify --restore; if that
  still fails, the lock may be deleted by hand, p may then be absent, and `git restore -- <p>` puts
  HEAD's content back.
- *Write H*: compare `head/<n>` with H's SHA-256 (missing or different: failure, after any rescue,
  so an edit is saved before the check that fails, the review's N8), then temp name, `wx` 0600,
  bytes, `fchmod` H's bits, fsync, step `restore-written:<n>`, `lstat` E again (inode, size, mtime,
  ctime; or that nothing resolves where E was absent); on a change unlink the temp file and decide
  p again by the table, once (a second change is a failure, R15); `rename`. `spec42r3/mode-exp`:
  0600, 0444 and 0755 come back exact and `git status` is clean; a hard link is split (nlink 2 to
  1).
- *Rescue*: a fresh `rescue/<k>/` made with a non-recursive `mkdir` (EEXIST takes k+1), so nothing
  at the target can exist; the entry keeps its path inside it; `rename`; step `rescued:<n>`. On
  EXDEV, a regular file is copied to a target opened `wx` (what `COPYFILE_EXCL` gives), its bits set
  with `fchmod` from the source's `fstat` (not left to `copyFileSync`, whose keeping of the mode is
  the runtime's), fsynced, compared byte for byte and then unlinked; a symlink is re-made from `readlink` and unlinked; anything else is a failure
  (`mode-exp`: a directory moves whole, a second rescue of the same path gets `2/`, the copy keeps
  mode 0750).
- *Proof*: every entry with H a file holds H(p); every entry with H absent does not hold S(p).
- Only then: `unlink` the lock when the one at its name is this run's by run id (another run's, or
  one that cannot be read, stays: round 1 review, NB6; ENOENT is fine), fsync the directory, remove `start/` and `head/`,
  and the run directory when `rescue/` is empty. A run whose lock file vanished, and whose restore
  then fails, writes it again from its record with `acquireLock`.
- The result is `{ restored, rescued: {path, to}[], left: string[], failed: {path, reason, fix}[] }`;
  a reason is the `fs` error's code and message. Index and HEAD are never written.

### The run (`runMutation`, `src/mutation-run.ts`)

1. Install SIGINT/SIGTERM/SIGHUP handlers that record the first signal and call `stop()` on a
   running obligation; they never exit the process. Removed in `finally`.
2. `refusals`; sample HEAD and the key K0 (`mutationKey`).
3. Baseline (R6, R7) through `runCommandAsync`. A signal: exit 128+n, no receipt for it.
4. R2 again, plus HEAD against the sample and the key against K0 (an untracked test edited while
   the baseline ran is seen only here, the review's N14); refused: nothing recorded. Else the
   receipts, at one `treeId` taken after the last (as `src/gate.ts:794`).
5. The list of untracked entries.
6. `prepareRun` (git children). Then `await` one `setImmediate` and check the signal: a Ctrl-C that
   killed a `cat-file` child is seen here, so it exits 128+n rather than reporting an unreadable
   blob (`spec42r3/yield-exp` prepare: on both runtimes the flag is null right after the
   synchronous section and set after one yield).
7. `acquireLock`; print the lock line and R25's command; `sweepStale`.
8. One yield, then the signal check: if set, restore (nothing to do), exit 128+n with nothing
   written and nothing spawned (`yield-exp` revert).
9. `applyRevert`; a failure ends the run as blocked (R11), and step 11 restores only its
   `written` entries.
10. Obligations in order through `runCommandAsync`, with one yield and a signal check before each
    spawn. When they end: which paths do not hold S(p) (R18 a), whether the lock is this run's
    (R18 c).
11. `finally`: `restoreFromLock` from the in-memory record; failed: exit 3.
12. After the lock is gone (git again): HEAD (R18 b) and the branch it is on against the lock's
    `branch` (R19), `git status --porcelain=v1 -z --untracked-files=no` outside the store
    directory (R18 d), K1 against K0 (R18 e), untracked entries against step 5 (R19). Print the
    report.
13. A signal: exit 128+n. Changed: the final `mutation-blocked: the tree changed under the run`
    line, exit 2. Else `recordMutation` with K1, the final line, the exit of the outcome.

Output goes through `out`, which swallows write errors (EPIPE, EIO), so a closed terminal cannot
throw out of a restore.

### The async runner (`src/run.ts`, `src/run-helper.mjs`)

`runCommandAsync(cmd, { cwd, timeoutMs, tailLines? })` returns `{ result: Promise<RunResult>;
stop(): void }`. It `spawn`s `process.execPath` with `run-helper.mjs`, the four arguments
`runCommand` passes (`src/run.ts:93`) and a fifth, `watch-parent`, with `cwd` a fresh temp
directory and output to a temp file, detached, in a process group of its own: a SIGKILL of the
caller's group then leaves the helper and its watch alive (`specreview42r3/groupkill`: with the
helper in the caller's group, the obligation outlived a SIGKILL of that group, on both runtimes).
A terminal Ctrl-C reaches the caller and not the helper; the caller's handler calls `stop()` (The
run, step 1), and a caller with no handler dies, which the watch sees. `stop()` sends SIGTERM to the helper.
With `watch-parent` the helper calls `process.kill(<its parent>, 0)` every 250 ms and on ESRCH
kills the command's group and exits: `spec42r3/orphan-exp` shows the obligation gone 2 s after a
SIGKILL of the parent with the watch, and alive without it, on both runtimes; bun's
`process.ppid` keeps the dead parent's pid, so the poll cannot read `ppid`. `runCommand` passes no
fifth argument and does not change.

`classify(result)`: `timedOut`, `error` or a non-null `signal` is blocked; 126 or 127 blocked; 0
passed; anything else, 128+n included, failed (a kill).

### The receipt (`src/verification.ts`)

`MUTATION_OUTCOMES = ["mutation-killed", "mutation-survived", "mutation-blocked"]` and
`recordMutation(store, { target, sha, command, outcome, tree })`, which is `append` and nothing
else. `receipts()` and `status()` do not change.

### The gate and the hook

- `checkMutationLock(store, report)` in the workspace section prints R27's line (using
  `liveness`) and R28's warnings, for every worktree's `rescue/` under `git rev-parse
  --git-common-dir` (its own `mstack-mutation/` and `worktrees/*/mstack-mutation/`), since the
  main checkout's gate otherwise never reads a linked worktree's. `runVerification` fails and
  runs nothing under a lock.
- `prunable` (`src/worktree.ts:131`) leaves out a worktree whose git directory holds the lock or a
  `mstack-mutation/*/rescue/` with anything in it: `isDirty` (`:79`) reads the tree only, and once
  the restore leaves it clean, `git worktree remove` without `--force` deletes the rescue
  (`specreview42r3/wt`).
- `preToolUse` keeps `GUARDS` and adds, after them, a test of each segment against `GIT` followed
  by `(?:add|am|apply|checkout|cherry-pick|clean|commit|merge|mv|pull|rebase|reset|restore|revert|rm|stash|switch)(?![-\w])`.
  Only on a match does it run `git rev-parse --absolute-git-dir` in `input.cwd` and `lstat` the
  lock; present denies, with the pid and R25's command when the lock parses.
- `GUARDS` gets one more entry, `rm` on a path ending in `mstack-mutation.lock`, which needs no
  git and no lock: an agent told that the gate is red may delete the lock. It reads no lock, so its
  reason points at `mstack gate` for the restore command rather than naming one (R25).

### By hand

The wiki page (task 3.4) describes these, each with what it discards. The tool prints only the
first two, and only where R15 and R24 say.

1. *One path the restore could not write* (R15): `git stash push -- <p>` writes HEAD's content
   and saves whatever was there first (`spec42r3/recover-exp` c). If verify --restore still fails
   on p after it, delete the lock by hand; p may then be absent, and `git restore -- <p>` puts
   HEAD's content back.
2. *A damaged lock* (R24): `git stash push --include-untracked` saves every change and untracked
   file, the reverted code included, and discards nothing; it also stashes the store's own files
   until `git stash pop`. Then delete the lock.
3. *Without mstack*: `GIT_LITERAL_PATHSPECS=1 git stash push --include-untracked -- <each path of
   the lock>`, then delete the lock and the run directory's `start/` and `head/`, keeping its
   `rescue/`. Discards nothing: the stash
   holds the reverted content and every edit made during the run, and paths outside the lock stay
   (`recover-exp` a). Not `git restore --source=<HEAD> --worktree` with `rm` (round 2's `sh
   <lock>`): it discards every edit made to those paths during the run (`recover-exp` b2).

### This repository: running from a copy

R5 refuses `./bin/mstack verify --mutation` here, because the item changes `src/`. Task 5.3 makes a
copy with `git worktree add --detach "${TMPDIR:-/tmp}/mstack-42-cli" HEAD` and runs it with the
checkout as `cwd`: the copy finds the checkout's store and keeps running its own `src/` while the
checkout's is reverted, where `./bin/mstack` is the start's code and has no `verify`
(`spec42r2/copy-exp`). Because of that, every mstack call in that task goes through the copy's
absolute path, and the step that decides whether to restore tests `test -e "$(git rev-parse
--absolute-git-dir)/mstack-mutation.lock"` (the review's B4). R5 covers the CLI, not hooks loaded
from inside the tree: a session started with `--plugin-dir .` runs the reverted `src/` in every
hook, so task 5.3 runs from a session that does not.

## Every state, and its exit

"verify --restore" below is R25's absolute command. "Walk" rows were traced through Shape; the
experiment named is the one the row rests on.

**The run's own steps, and a SIGKILL or power cut at each**

| State | Tree | Lock, run directory | Exit |
|---|---|---|---|
| Refusals, baseline | untouched | none | none needed; an orphaned baseline obligation dies within 2 s (`orphan-exp`) |
| Staging, or inside the temp lock write | untouched | run directory and maybe `mstack-mutation.lock.<run>.tmp`, no lock | none needed; the next run removes both (R8). A run stopped here, whose staging a later run swept, and that links after it: its revert finds a staged copy missing and writes nothing (Revert, step 0) |
| Lock linked, nothing reverted | untouched | lock, staging | verify --restore: nothing to write, lock removed |
| Between two revert writes | some paths at S, the rest at H | lock, staging | verify --restore: S back to H |
| Inside a revert write (temp written, not renamed) | p at H, a temp name beside it | lock (its `tmp` prefix) | verify --restore unlinks the temp (`ro-exp`) |
| After a start-lacking path is unlinked, or a `removedDirs` entry removed | p absent | lock | verify --restore writes H, making the parent |
| After a `createdDirs` entry is made | an empty directory | lock | verify --restore removes it when empty |
| Obligations running | fully reverted | lock | the helper, in a group of its own, kills the group within 2 s, after a SIGKILL of mstack alone or of its group; then verify --restore |
| Between two restore writes | some at H, some at S | lock | verify --restore resumes; it is idempotent |
| Inside a restore write | p at S or absent, a temp name | lock | verify --restore |
| After a rescue, before H is written | p absent; the entry in `rescue/<k>/` | lock | verify --restore writes H; the rescue stays and the gate warns (R28) |
| Inside an EXDEV copy (copied, not unlinked) | both copies | lock | verify --restore rescues p again into a new `k`: a duplicate, nothing lost |
| Lock unlinked, staging not removed | as before the run | no lock; a run directory | none; the next run removes it; no row (fail-closed) |
| Lock removed, before the row | as before the run | none | none; no row |

A power cut adds only ordering: every staged copy and the lock are fsynced, with their directory,
before the first tree write, and each temp file before its rename; `F_FULLFSYNC` on macOS is not
established (walk).

**Someone else during the run**

| Actor | What the restore does | Row | Exit |
|---|---|---|---|
| An edit to a path HEAD has | rescues it, writes H (R14) | no (a) | the lock goes; the rescue is named and warned on |
| An edit to a path HEAD lacks (the revert put it back) | leaves it (R14) | no (a or e) | reported |
| An edit to a tracked file outside the set | nothing | no (d) | reported with `git diff -- <p>` |
| A commit | restores to the lock's H | no (b) | `git reset <lock HEAD>`, mixed, keeps the tree; `--soft` would leave the reverted code staged (`specreview42r2/reset-exp`); after a `git switch` to another branch, `git switch <the lock's branch>` first, since a reset there moves the other branch (R19) |
| A `git add` | the tree only; the index is left | no (d) | `git restore --staged -- <p>`, said to discard the staged version |
| A new untracked file | nothing | no when code or test (e); yes when a doc | "left in place" |
| A new file or directory where the revert removed one | rescues it, writes H | no (a) | named |
| A case-only rename of a reverted file | rescues the variant, writes H (`name-exp` c) | no (a) | named |
| `git stash` or `git checkout .` in a terminal | finds H, or unlinks the start's file | no (a) | the stash holds only the run's content |
| The lock deleted | restores from memory; writes it again only if the restore fails | no (c) | named |
| The run directory deleted | rescues what is not S, then fails on the staged copy (R15) | no | `git stash push -- <p>`, then verify --restore; if git's checkout of HEAD is not H's bytes (an `eol` setting, a mode other than 0644), that restore rescues git's copy and cannot write H, so p is left absent, and the lock is deleted by hand, which discards nothing: HEAD's bytes are in git and in `rescue/`, and `git restore -- <p>` puts them back |
| A second `verify --mutation` | refused: the lock exists, or the link fails | n/a | none |
| `verify --restore` while the run is alive | refused (R23) | n/a | wait |
| Two `verify --restore` on a dead lock | each writes through its own temp name; one may unlink the other's temp and report a failure (exit 3) | n/a | a third run says nothing to restore |
| A full disk | prepare: refused, nothing written; revert: blocked (R11); restore: kept (R15) | no | free space, verify --restore |
| A read-only directory | revert: blocked; restore: kept, EACCES (`ro-exp`) | no | `chmod u+w`, verify --restore |
| Ctrl-C to the group | before the revert: seen after one yield; during revert or restore: acted on after; during obligations: group killed, restored | no | exit 130 |
| A lock from another host, or another pid namespace | `unknown`: verify --restore refuses | n/a | run verify --restore there, or by hand (3), which discards nothing |

**What cannot be made safe inside this design**

1. A write by another process to a path in the moment between the tool's last check of it and its
   rename (a few system calls) is replaced and lost, whether the writer writes in place or renames
   its own temp file (`spec42r3/race-exp`, both runtimes). So is a later write through a
   descriptor opened on the replaced file. This holds for the revert, the restore and an EXDEV
   copy (between the comparison and the unlink). The last check is an `lstat` after the temp
   file's fsync, which narrows the moment for a 3 MiB file from 4 to 11 ms to 2 to 5 ms
   (`specreview42r3/window`, both runtimes); the line printed at the lock and the wiki say it.
2. An orphaned obligation can write for up to 250 ms after mstack's death; a verify --restore that
   starts in that window can be overwritten by it.

Neither keeps the lock, and neither is reached without another process writing the same path at
the same instant.

## What item 100 needs from this spec

- The row carries what B3's rule C' reads: the item's slug, `sha` (the commit the obligations ran
  at), the obligations joined with ` && `, the outcome, and the key. C' recomputes the item's code
  and test paths from the base and that `sha`, so no column is added and item 100 needs no
  migration of rows written here.
- `mutationKey(store, start)`, `revertSet` and `scopeClass` are exported, so the check compares
  with the same functions; `readLock` is exported for the refusal of `done` under a lock.
- One row per run, appended; blocked rows exist (R7, R11, R12) and decide nothing here.
- A run on the default branch after a merge is refused (R4, `merge-exp` shape 7), so item 100's
  rule cannot depend on running there; refused shapes write no row, and item 100's forced close is
  their exit.
- Item 100 may add a refusal of untracked test files in scope (B3's second companion) to R1's list.

## Experiments this round

Under the session scratchpad `spec42r3/` (macOS 26 on APFS, case-insensitive; git 2.54.0 Apple
Git-157; node v26.13.1; bun 1.3.11). Each is a `bash` script that starts `set -euo pipefail` and
makes a checked `cd`; output beside it as `*.out`; node and bun where the runtime matters.

- `shape-exp.sh` (+ `.mjs`): R3 found from one raw diff; a control with plain files refuses nothing.
- `merge-exp.sh`: R4 on seven branch shapes.
- `name-exp.sh` (+ `.mjs`): exact name against `lstat`, a rename over a variant, a rescue by name
  on disk, NFC/NFD, and the fold against the filesystem's own collisions.
- `stream-exp.sh` (+ `.mjs`): a blob over 1 MiB streamed to a descriptor; ENOBUFS without.
- `yield-exp.sh` (+ `.mjs`, `yield-victim.mjs`): a group SIGINT during a synchronous section is
  seen after one `setImmediate`, before any spawn; a killed child reads as an interruption.
- `orphan-exp.sh` (+ helper and parent): the parent watch.
- `recover-exp.sh`: the by-hand ways and what each discards.
- `mode-exp.sh` (+ `.mjs`): permission bits round trip; the rescue primitives.
- `ro-exp.sh` (+ `.mjs`): EACCES in a read-only directory; the temp-name sweep.
- `race-exp.sh` (+ `.mjs`): the window of "what cannot be made safe" 1.
- `live-exp.sh` (+ `.mjs`): the liveness primitives.

Earlier ones still cited: `spec42r2/` `crlf-exp`, `copy-exp`, `hash-exp`, `sig-exp`, `fs-exp`
(rename over a directory fails EISDIR, `rmdir` of a non-empty one ENOTEMPTY); `specreview42r2/`
`filter-exp`, `reset-exp`, `buf-exp`; from the round 3 review, `specreview42r3/` `hcopy`,
`groupkill`, `dircase`, `window`, `wt` and `fold`, and the fold re-run with N7's fold,
`impl42s1/fold`. Not reproduced: EXDEV (no second filesystem here; rename(2)
semantics, rung 2), ENOSPC (rung 2), Linux.

## Rejected alternatives

- **A copy of the tree for the run (option B of the fork).** Nothing of the user's is touched and
  no lock exists. The user chose A (row 2026-11-19T08:27:17Z); the record gives no further reason.
- **`sh <lock>` with checks before it writes** (round 2 review B1's fix). Rejected by row 08:27:32Z:
  a second exit is a second thing to prove safe. The lock is data, `verify --restore` is the exit,
  and the by-hand way that discards nothing is a `git stash`.
- **Handling every shape** (round 2: file/directory swaps, case-only renames, symlinks, 43
  requirements). Both reviews found the losses there and in the script, none in plain files.
  Refusing is one rule and one test per shape.
- **`--restore --force` with a run that re-checks the lock before each write** (N9's other
  option). A check-then-write window stays between the run's check and its rename, and a forced
  restore that lands in it leaves S(p) with no lock. Without `--force`, liveness decides, and
  `unknown` leaves the by-hand way, which discards nothing.
- **A hard link to the replaced file kept during each write**, judged afterwards. It would save an
  in-place writer's bytes in the window of "cannot be made safe" 1, but not a writer that renames,
  and it puts a judged name in the tree per write. Not taken: machinery for a state it cannot
  close.
- **The rescue beside p in the tree** (no EXDEV possible). The rescued file would be untracked in
  the tree, enter the key and be swept into a `git add -A`.
- **A heartbeat file for liveness.** It works across hosts and namespaces, but a stopped process
  (Ctrl-Z) looks dead after the interval and is then restored under.
- **`git restore --source` for the revert or the restore.** It removed a directory holding an
  untracked file to write the source's file, exit 0 (round 1 review `git-exp.sh` b2).
- **Regenerating HEAD's bytes from git at restore time.** A child process in the restore, and not
  the user's bytes (`spec42r2/crlf-exp`).
- **Whole-tree `git checkout <start> -- .`, `reset --hard` or `git stash` to park the change.**
  They touch tests, docs and the store, write the index or shared refs; `reset --hard` is denied by
  this repository's own hook (`src/hooks.ts:377-378`).
- **A restore list in memory only, or a detached watchdog.** SIGKILL and a power cut run no
  handler; a watchdog survives SIGKILL but not a power cut, and `verify --restore` is needed anyway.
- **Taking the lock before the baseline.** A crash in a long baseline would leave a red gate with
  nothing reverted; what it guards is a false `failed` from an overlapping `gate --full`.

## Trade-offs accepted

- A shape R3 or R4 refuses gets no receipt; once item 100 lands, such an item closes by a forced
  close. How many past items would be refused is to be counted before item 100 is specified (row
  08:27:32Z). The item's own sub-branch merged back is one of them (`merge-exp` shape 6).
- `killed` does not mean the tests assert behaviour: a build failure, an import of a removed file or
  a crash kills. A refactor survives by construction.
- A flaky test can kill or survive by chance; the docs say to run the mutation alone and last.
- A recorded `gate --full` green counts as the baseline, and that run inherits the terminal
  (`src/gate.ts:768`) while the reverted run is captured. A suite whose result depends on a TTY can
  pass there and fail here: a false kill (the review's N10). The wiki page names it.
- The key holds untracked code and test files, so a suite that writes a non-ignored output file
  gets no row (R18 e) until the file is ignored. Ignored files, and docs a test reads (this
  repository's `lint-plugin` reads `SKILL.md`), are not watched.
- A dirty tracked file refuses the run, a test or doc edit included.
- Permission bits are kept; owners, hard links (split), extended attributes and ACLs are not.
- Reverting `package.json` or a lockfile does not revert installed dependencies; every start blob
  is read with the current attributes before the first write.
- A lock from another host or pid namespace (a container, a macOS host renamed and rebooted) is
  `unknown`: the exit is verify --restore where it was written, or by hand.
- The hook is a speed bump: aliases, interpreters, `npm version`, `git -C` from outside and the
  Edit and Write tools pass it. The rescue, R18 and the gate are what hold.
- `git worktree remove` deletes a linked worktree's git directory, rescue included; `mstack
  worktree prune` does not offer such a worktree, and the gate's warning (R28), in any worktree, is
  what tells the user first.
- R4 sees only merges: commits by others that reach the branch after the start by fast-forward,
  squash or cherry-pick are reverted as the item's, which can kill on code that is not the item's.
- An obligation that installs dependencies leaves ignored files (`node_modules`) at the start's
  versions after the run.
- An obligation that rewrites code (a `--fix`) ends every run with no row and a rescue.
- The status line does not show the lock; the Stop hook carries the gate's line.
- Two runners in `src/run.ts`, one helper.

## Open questions

- Is 900 seconds the right default for `--timeout`? A ceiling for a hang; one constant.
- Should a `mutation-blocked` row carry its reason in a seventh column? Not now: the reason is
  printed, and item 100 reads no reason.
