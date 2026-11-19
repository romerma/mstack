# Implementation, item 42 `mutation-check`, stage 2 of 4

Implementer by hand (the plugin is not loaded), from `agents/implementer.md`. This is the stage
after `impl_mutation-check.md` (stage 1), not a review round: there are no review findings to
answer. Scratch: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl42s2/`,
written `S/` below.

## What changed

Task group 2, the code that writes to a user's working tree. `src/git.ts` gains `gitToFile`. The
new `src/mutation-lock.ts` stages the run (`prepareRun`), takes the lock (`acquireLock`), reads it
and checks it (`readLock`, `validateLock`), sweeps what earlier runs left (`sweepStale`), and
judges whether the run that wrote a lock is alive (`liveness`). The new `src/mutation-tree.ts`
has `entryAt` (exact names), `applyRevert` and `restoreFromLock`. `src/run.ts` gains
`runCommandAsync`, and `src/run-helper.mjs` gains the `watch-parent` argument. Nothing in it
can take a lock on its own: no command calls it yet. It does the three things stage 1 left
open. `entryAt` is now the one exact-name implementation (R2's helpers are gone and stage 1's
16 refusal tests pass unchanged). The R1 lock refusal now says whether the run is alive, and
its test asserts it, in place. Node's `ℹ fail 0` is read as `# fail 0`. Mutants found two
things. One was a race in `acquireLock`'s message, fixed in its own commit. The other was
three gaps in the named tests, closed by two tests added at the ends of their files. The
counts of tasks 2.2 and 2.3 are corrected to match.

## Files

- `src/git.ts` (`gitToFile`), `src/mutation-lock.ts` (new), `src/mutation-tree.ts` (new),
  `src/mutation.ts` (`lockPath` moved out and re-exported; the lock refusal on `readLock` and
  `liveness`; `inTheWay` on `entryAt`), `src/run.ts` (`runCommandAsync`), `src/run-helper.mjs`
- `tests/mutation-lock.test.ts` (12), `tests/mutation-revert.test.ts` (11),
  `tests/mutation-restore.test.ts` (20), `tests/run-async.test.ts` (10), all new;
  `tests/mutation-holder.ts` (the holder), `tests/mutation-fixture.ts` (shared repository,
  lock and holder helpers, no tests); `tests/mutation-refusals.test.ts` (one assertion, in place)
- `.mstack/specs/mutation-check/design.md` (five corrections, below), `tasks.md` (2.1 to 2.4
  ticked, the counts of 2.2 and 2.3)
- `.mstack/decisions.tsv` (6 rows), `.mstack/ledger.tsv` (the verdict), `.mstack/progress/current.md`

Commits: `5e16b0a` (2.1), `61e3124` (2.2), `f178632` (2.3), `808b616` (2.4), `35c34dd` (the
`acquireLock` fix), `deb5733` (a test bug), `ca77520` (the two tests for surviving mutants),
then this report.

## Commands

Red first, each task's tests against a stub that has the names and types and does nothing.
The full output is in `S/red-2.1.txt` to `S/red-2.4.txt`:

```
$ bun test tests/mutation-lock.test.ts       # 2.1
(fail) R23 liveness: a live pid that started before the lock is running at another boot time, ...
 0 pass
 12 fail
$ bun test tests/mutation-revert.test.ts     # 2.2
(fail) R11 an edit after the temp file is written and before its rename stops the revert and keeps the edit [313.88ms]
 0 pass
 10 fail
$ bun test tests/mutation-restore.test.ts    # 2.3
(fail) R22 killed half restored, then restored twice [20230.81ms]
 0 pass
 19 fail
$ bun test tests/run-async.test.ts           # 2.4
(fail) R16 async: when the caller's whole group is SIGKILLed the command's group is gone within 2 s [20031.14ms]
 0 pass
 10 fail
```

The two tests added later were red against the mutants that made them necessary (S5, S6 and S15,
below). The R1 refusal's new assertion is red against stage 1's refusal (S28).

Checks, at `ca77520` (the last code commit):

```
$ bun run typecheck                # exit 0, no diagnostics (S/typecheck.txt)
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ bun test ./tests                 # S/suite-bun.txt
 984 pass
 0 fail
Ran 984 tests across 50 files. [268.89s]
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'   # S/suite-node.txt
ℹ tests 984
ℹ pass 984
ℹ fail 0
$ pgrep -fl mutation-holder        # once, after both suites
(nothing)
```

Both suites ran once. Nothing was rerun. The disk is case-insensitive, so the four
case-sensitive tests ran and none was skipped. `./bin/mstack gate` after the report commit is in
the last section.

### Mutants

There are 28 mutants of this stage's code (`S/mutants/mutants.mjs`, runner `mutants.sh`). Each
one is a single text replacement in the checkout. It was run under bun against the test files
that own it, and the file was restored in `finally`. After every run, `git diff --quiet` of the
five source files was clean. The output is in `S/mutants/run1.log`, `mutants-S22-S24.out`,
`mutants-S5-S6-S15.out` and `mutants-S28.out`, with one `S<n>.log` per rerun.

| Mutant | Result | Killed by |
|---|---|---|
| S1 the re-check before the rename removed, in the revert | killed | R11 an edit after the temp file is written and before its rename ... |
| S2 the re-check before the rename removed, in the restore | killed | R14 an edit after H's temp file is written and before its rename is rescued |
| S3 the rescue skipped, so an edit is written over | killed | 7 tests, R14 an edit to a reverted file is rescued byte for byte first |
| S4 H from a fresh read of p when the lock is taken, not the staged copy | killed | R11 an edit between the staged copy and the lock ... |
| S5 the proof skipped | killed (after the new test) | R13 a path changed after its own restore fails the proof and keeps the lock |
| S6 the lock removed before the proof | killed (after the new test) | the same |
| S7 the temp sweep skipped | killed | R13 a SIGKILL between a temp write and its rename ... |
| S8 `entryAt` matches by `lstat`, not by the exact name | killed | R2 a path of the set on disk under another case; R14 a case variant ...; R15 a parent renamed by case ... |
| S9 the restore unlinks any file at a path HEAD lacks | killed | R14 a file left at a path HEAD lacks is left in place |
| S10 the mode restored as the exec bit only | killed | R13 the whole permission bits come back |
| S11 the copy fallback drops the mode (`fchmod`) | killed | R14 the copy fallback keeps the bytes and the mode |
| S12 the copy fallback drops the `fsync` | **survived** | no test can see an fsync without a power cut (rung 2) |
| S13 the helper not detached under `watch-parent` | killed | R16 async: when the caller's whole group is SIGKILLed ... |
| S14 liveness calls a live run dead when the boot time differs | killed | R23 liveness: a live pid that started before the lock is running at another boot time, ... |
| S15 the revert unlinks a path the start lacks without its check | killed (after the new test) | R11 an added file edited since the lock is not removed |
| S16 the helper's parent watch removed | killed | 3 tests, R16 async: SIGINT to the group, SIGKILL alone, SIGKILL of the group |
| S17 rescue/1 reused, not a fresh directory | killed | R14 a second incident gets its own rescue directory |
| S18 the sweep removes a run directory whose rescue holds something | killed | R8 a run directory whose rescue holds anything is kept |
| S19 the lock taken over an existing one | killed | R8 two processes acquire at once and one wins |
| S20 `prepareRun` keeps its run directory after an unreadable blob | killed | R1 a start blob that cannot be read leaves no run directory |
| S21 liveness without the host test | killed | R23 liveness: another boot of this host is not running, another host is unknown ... |
| S22 liveness with `now - etime`, the design's literal rule | **survived** (rerun) | equivalent on macOS, where `ps` makes it exact (`S/prim/etime.out`); it matters on Linux only |
| S23 `readLock` takes a JSON array as a lock | killed | R24 an unparseable lock is reported as damaged |
| S24 `validateLock` lets a `..` segment through | killed (rerun) | R24 a lock path that is absolute, empty, or has a . .. or .git segment is refused |
| S25 `stop()` sends nothing | killed | R16 async: stop() kills the whole group ...; R16 async: the caller's signal handler runs ... |
| S26 the restore writes H through a parent under another name | killed | R15 a parent renamed by case fails with the mv back as its fix |
| S27 the re-check compares the inode only | killed | the R11 and R14 tests of the moment before the rename |
| S28 the R1 lock refusal does not say whether the run is alive | killed | R1 an existing lock is refused naming its pid |

In the first run, S22 and S24 also "killed" an R8 test that neither mutant reaches. That flake
was the race fixed in `35c34dd`. The winner's `sweepStale` removed the loser's temporary lock
file before the loser linked it. The loser's link then failed with ENOENT, and its refusal named
no holder. On node, 3 of 6 runs failed that way before the fix, and 6 of 6 passed after it. The
loser was refused in every case.

## R to test

Stage 2 implements R8, R13, R14, R17 and R24, and its own parts of R1, R9, R10, R11, R12, R15,
R16, R22 and R23. Stage 1's rows are carried over. Its lines in `tests/mutation-refusals.test.ts`
moved down by one or two (one import line and one line in the lock test). Each cited line below
was printed back with `bat -pp -r`. Stage numbers follow the plan row: 3 is group 4, 4 is group 3.

| R | Test | Where |
|---|---|---|
| R1 | refusals with no staging (stage 1); a start blob that cannot be read (later: 3.4 the flags) | tests/mutation-refusals.test.ts:102, tests/mutation-refusals.test.ts:110, tests/mutation-refusals.test.ts:121, tests/mutation-refusals.test.ts:131, tests/mutation-refusals.test.ts:147, tests/mutation-refusals.test.ts:157, tests/mutation-refusals.test.ts:168, tests/mutation-refusals.test.ts:179, tests/mutation-refusals.test.ts:196, tests/mutation-lock.test.ts:176 |
| R2 | before the baseline (stage 1) (later: 3.1 the checks after it) | tests/mutation-refusals.test.ts:211, tests/mutation-refusals.test.ts:224, tests/mutation-refusals.test.ts:237, tests/mutation-refusals.test.ts:251, tests/mutation-refusals.test.ts:265, tests/mutation-refusals.test.ts:278 |
| R3 | the refused shapes (stage 1) | tests/mutation-shapes.test.ts:90, tests/mutation-shapes.test.ts:103, tests/mutation-shapes.test.ts:112, tests/mutation-shapes.test.ts:127, tests/mutation-shapes.test.ts:139, tests/mutation-shapes.test.ts:161, tests/mutation-shapes.test.ts:178, tests/mutation-shapes.test.ts:191, tests/mutation-shapes.test.ts:208 |
| R4 | merges (stage 1) | tests/mutation-shapes.test.ts:229, tests/mutation-shapes.test.ts:248, tests/mutation-shapes.test.ts:267, tests/mutation-shapes.test.ts:284 |
| R5 | the running CLI (stage 1) (later: 3.4 the CLI) | tests/mutation-refusals.test.ts:297 |
| R6 | the baseline | n/a: implemented in stage 4 (task 3.1) |
| R7 | a red or slow baseline | n/a: implemented in stage 4 (task 3.1) |
| R8 | one JSON document before the first write; a linked worktree; two at once; a killed prepare's leftovers; a rescue kept | tests/mutation-lock.test.ts:38, tests/mutation-lock.test.ts:66, tests/mutation-lock.test.ts:91, tests/mutation-lock.test.ts:119, tests/mutation-lock.test.ts:142 |
| R9 | the set's modes and blobs (stage 1); a 3 MiB blob staged; added, deleted, modified, renamed; bytes and the exec bit; line endings; the index; directories | tests/mutation-set.test.ts:119, tests/mutation-lock.test.ts:157, tests/mutation-revert.test.ts:40, tests/mutation-revert.test.ts:63, tests/mutation-revert.test.ts:87, tests/mutation-revert.test.ts:101, tests/mutation-revert.test.ts:114 |
| R10 | not in the set (stage 1); untracked, test and doc files untouched by the revert | tests/mutation-set.test.ts:72, tests/mutation-set.test.ts:91, tests/mutation-set.test.ts:106, tests/mutation-revert.test.ts:134 |
| R11 | unwritable path; changed since the lock; edit between copy and lock; edit before the rename; an added file edited (later: 3.1 no obligation runs) | tests/mutation-revert.test.ts:161, tests/mutation-revert.test.ts:191, tests/mutation-revert.test.ts:205, tests/mutation-revert.test.ts:218, tests/mutation-revert.test.ts:231 |
| R12 | the async runner: codes and tail, timeout, cannot start, the bound, no bunfig (later: 3.1 the outcome) | tests/run-async.test.ts:111, tests/run-async.test.ts:121, tests/run-async.test.ts:136, tests/run-async.test.ts:143, tests/run-async.test.ts:153 |
| R13 | clean afterwards; whole bits; another tracked file; SIGKILL inside a write; the proof keeps the lock | tests/mutation-restore.test.ts:69, tests/mutation-restore.test.ts:96, tests/mutation-restore.test.ts:120, tests/mutation-restore.test.ts:138, tests/mutation-restore.test.ts:458 |
| R14 | edit rescued; edit before the rename; directory; case variant; left where HEAD lacks; second incident; EXDEV copy | tests/mutation-restore.test.ts:160, tests/mutation-restore.test.ts:175, tests/mutation-restore.test.ts:195, tests/mutation-restore.test.ts:214, tests/mutation-restore.test.ts:231, tests/mutation-restore.test.ts:254, tests/mutation-restore.test.ts:286 |
| R15 | read-only directory; missing staged copy; parent renamed by case (later: 3.2 the lock written again, 3.4 exit 3) | tests/mutation-restore.test.ts:305, tests/mutation-restore.test.ts:339, tests/mutation-restore.test.ts:359 |
| R16 | stop(); SIGINT to the group; the caller's handler; SIGKILL alone; SIGKILL of the group (later: 3.3 the run) | tests/run-async.test.ts:163, tests/run-async.test.ts:182, tests/run-async.test.ts:198, tests/run-async.test.ts:219, tests/run-async.test.ts:235 |
| R17 | the restore starts no child (later: 3.3 the signals) | tests/mutation-restore.test.ts:386 |
| R18 | no receipt when the tree changed | n/a: implemented in stage 4 (task 3.2) |
| R19 | the report of other changes | n/a: implemented in stage 4 (task 3.2) |
| R20 | the receipt row | n/a: implemented in stage 4 (task 3.1) |
| R21 | the key (stage 1) (later: 3.1 the run's own key) | tests/mutation-set.test.ts:167, tests/mutation-set.test.ts:188, tests/mutation-set.test.ts:206, tests/mutation-set.test.ts:218, tests/mutation-set.test.ts:234, tests/mutation-set.test.ts:254, tests/mutation-set.test.ts:281 |
| R22 | killed at lock-written, half reverted, fully reverted, half restored then twice (later: 3.4 the command) | tests/mutation-restore.test.ts:420, tests/mutation-restore.test.ts:428, tests/mutation-restore.test.ts:437, tests/mutation-restore.test.ts:445 |
| R23 | liveness, three tests; the R1 refusal says alive or not (later: 3.4 the refusal of verify --restore) | tests/mutation-lock.test.ts:222, tests/mutation-lock.test.ts:236, tests/mutation-lock.test.ts:249, tests/mutation-refusals.test.ts:179 |
| R24 | bad paths; a damaged lock (later: 3.4 the command's messages) | tests/mutation-lock.test.ts:195, tests/mutation-lock.test.ts:210 |
| R25 | the absolute restore command | n/a: implemented in stage 3 (tasks 4.1, 4.2) and stage 4 (task 3.4) |
| R26 | the hook | n/a: implemented in stage 3 (task 4.2) |
| R27 | the gate under a lock | n/a: implemented in stage 3 (task 4.1) |
| R28 | the rescue warning, prune | n/a: implemented in stage 3 (task 4.1) |

Rung: everything this stage implements is at rung 4. The tests call the real functions on real
git repositories, with real SIGKILLs of real processes, on macOS APFS (case-insensitive), with
git 2.54.0, node v26.13.1 and bun 1.3.11. Not run: Linux, a case-sensitive disk, a real second
filesystem (EXDEV is injected through `rename`), ENOSPC.

## Where the code differs from design.md as I found it

Each difference is written into design.md in the commit that made it, or listed here when it
only adds detail.

1. **Liveness bounds the start by `etime + 1`** (`5e16b0a`, design corrected). `etime` is whole
   seconds. On macOS, `ps` takes the difference of whole seconds, so `now - etime` is exact
   (`S/prim/etime.out`, both runtimes). Linux procps counts on the uptime clock, so `now - etime`
   can be one second late there (walk, rung 2). Read literally, the rule calls a live run
   `not-running` when its lock was written in its first second, and `verify --restore` would
   then restore under it. The cost: a pid reused less than about two seconds after the lock
   reads `running`.
2. **`lockPath` moved to `src/mutation-lock.ts`** (re-exported from `mutation.ts`). It asks git
   for the git dir once per store root (`gitDirOf`). That is how the revert and the restore find
   the run directory with no child process (R17). The design says neither.
3. **`entryAt` returns `parent`** for a parent that is a symlink, not a directory, or under
   another name, with that name on disk. A `file`'s stat is the `fstat` of the descriptor it was
   hashed through, taken before the read, and it is opened `O_NOFOLLOW | O_NONBLOCK`
   (`61e3124`, design amended).
4. **The revert's `removedDirs`.** ENOTEMPTY, EEXIST and ENOENT leave a directory as it is. Any
   other error stops the revert (R11). The design names ENOTEMPTY only.
5. **The restore compares `head/<n>` with H while it copies it into the temp file**, not in a
   read before. The outcome is the same (no rename on a mismatch), with one read instead of
   two. A missing or wrong staged copy gets R15's stash fix.
6. **The EXDEV copy** is made to a target opened `wx`, and its bits are set with `fchmod`. It
   does not use `copyFileSync` (`f178632`, design amended). `copyFileSync` keeps the mode on
   both runtimes here (`S/prim/prim.out`), but only because the runtime does it, and S11 needs
   the bits to be this code's.
7. **A failed path's `fix` never names `verify --restore`.** R25 wants that command as the
   writing CLI's absolute path, and it adds the running CLI's when the writer's file is gone.
   The tree module does not know which CLI is running, so the caller prints the command.
8. **A lock that cannot be unlinked** is a failure under its own path, and the lock stays. A
   `createdDirs` entry that cannot be removed goes into `left`.
9. **`acquireLock`** removes a temporary lock file of its own run id before it writes one. On any
   failed link while a lock exists, it names that lock's holder (`35c34dd`, design amended).
10. **`validateLock` checks more than R24 lists.** It checks the run id's shape, that `n` equals
    the entry's index, the temp prefix against the one the run derives, the identities, and the
    `createdDirs` and `removedDirs` paths. It compares `.git` case-insensitively. The temp sweep
    unlinks by prefix, so the prefix has to be checked. `prepareRun` takes `removedDirs` from
    `git cat-file -t <start>:./<dir>`.
11. **The R1 lock refusal** words its fix for each of the three liveness answers: wait; the
    restore command; or wait or restore where the run ran.

## What I could not make safe

Nothing in this stage keeps the lock with deleting work as the only exit. The two windows of
design.md "What cannot be made safe" stand as written. The revert's and the restore's last
check is now an `lstat` after the fsync (S1, S2, S27 pin it), so the window is narrowed but not
closed. One hole is left open, by choice and not by inability. It is for the reviewer of the
primitives (walk, rung 3, no probe). `sweepStale` removes a run directory that no lock names,
including one belonging to a live run that has not linked its lock yet. When that run then
loses the race to link, it is refused, and nothing is touched. A loss needs that run stopped
(SIGSTOP or Ctrl-Z) between `prepareRun` and `acquireLock`, about one `setImmediate`, for as
long as the other run's whole run lasts. It would then take the lock with no staging. The
revert would unlink a path the start lacks (its H is checked against the record), and the
restore would fail under R15 with the stash fix. H is HEAD's checkout, because R2 refuses a
dirty tracked file, so git holds the content. Two cheap closes are available: the sweep could
skip a directory whose run id names a live pid, or `applyRevert` could check every staged copy
before its first write. I did neither, so as not to widen the design.

## For stage 3 (the gate and the hook) and stage 4 (the run and the command)

- **`readLock` returns the parsed object unchecked.** Run `validateLock` before trusting a field.
  The gate's line (R27) needs `pid` and `startedAt` even from a lock that fails validation.
- **`liveness` spawns `ps`.** That is fine for the gate and for `verify --restore`, but not
  between taking the lock and removing it (R17).
- **`bootTime()` flips by one second within a node process** on this machine, because node's
  `os.uptime()` is whole seconds. A test that compares boot times exactly will flake under node
  (`deb5733`). Liveness allows 60 s.
- **`restoreFromLock` and `applyRevert` read the git dir that `gitDirOf` cached.** In a fresh
  process, call `readLock` (verify --restore) or `prepareRun` (the run) first, or the restore
  asks git once.
- **What the functions return.** `applyRevert` returns `{ ok: true }`, with no `written`, on
  success. After R11, pass `entries: result.written`. `restoreFromLock` returns `restored`,
  `rescued` (`path` as it was on disk, `to` absolute), `left` (paths left as they were, and
  `createdDirs` not removed) and `failed` (`path`, `reason`, `fix`). Print R25's restore command
  after the list.
- **The order the steps come in.** Entry numbers are the revert set's order. The revert works
  through the paths the start lacks, deepest first, then the start's files, shallowest first.
  The restore works through the paths HEAD lacks, then `createdDirs`, then the paths HEAD has.
  So `reverted:0` comes first only when entry 0 is a start file and no path the start lacks
  exists. Ties go by `n`.
- **The lock's `cli`** is `runningCliRoot()/bin/mstack`. `prepareRun` takes no `running`.
- **After `stop()`**, `runCommandAsync` settles with `code: null`, `signal: null` and `error`
  "the timeout helper did not report a result". Check the signal flag before `classify`. Once
  the result is in, `stop()` does nothing, so a reused pid is never signalled. A helper whose
  caller died writes no result.
- **For R28:** after a restore that rescued something, the run directory holds only `rescue/`.
  Its entries are the `<k>` directories, one per rescue. `sweepStale` keeps such a directory.
- **For the hook (R26):** the lock is `<git dir>/mstack-mutation.lock`, with the git dir from
  `git rev-parse --absolute-git-dir` in the input's `cwd`. `lockPath` needs a `Store`.
- **Reusable test helpers:** `tests/mutation-fixture.ts` has `makeRepo`, `locked`, `hold`,
  `until` and `status`, and phase `run` of the holder.

`./bin/mstack gate` with this report, its rows and the verdict written, just before their commit.
The one warning is those four files:

```
[warn]  4 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 1 warning
```
