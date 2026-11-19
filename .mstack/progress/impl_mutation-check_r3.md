# Implementation, item 42 `mutation-check`, round 1 fixes

I am the implementer. I did this by hand from `agents/implementer.md` "A later round", because the
plugin is not loaded. This answers `review_mutation-check.md` (CHANGES_REQUESTED, the primitives of
stages 1 and 2), under decision row 275. Scratch:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl42r3/`,
written `I/` below. Head before the report: `3204a2a`. The brief and row 275 agree on every point,
so no point needed the row to decide it.

## What changed

B1: `applyRevert` checks every staged copy before its first write. `start/<n>` must hash to S and
`head/<n>` to H. A missing or different copy stops the revert with `written: []`, so a sweep of a
live run's staging, or a run directory deleted by hand, writes nothing. B2: `refusals` refuses a
tracked path outside the store directory that `git ls-files -v` tags `S` or with a lower-case letter,
naming the flag and the `git update-index` command that clears it. The non-blocking points 1 to 12
are in too:
- tests for the mutants that survived round 1 (M1 to M10, M15);
- `validateLock` finds a path that appears twice by R3's `fold`;
- `restoreFromLock` validates its lock;
- the key is null for a name that is not UTF-8;
- the restore unlinks only its own lock;
- `readLock` opens without following a symlink or blocking on a FIFO;
- the temp sweep and both `rmdir`s act only on a directory by exact name;
- two fsyncs before an unlink;
- "move <p> aside" as a failed rescue's fix;
- a guarded sweep;
- an exported `discard(store, run)`.

Each fix changed spec.md (R2 and its scenario, R21), design.md or tasks.md in its own commit. There
are still 28 requirements. I wrote nothing for stages 3 and 4.

## Files

- `src/mutation.ts`, `src/mutation-lock.ts`, `src/mutation-tree.ts`.
- `tests/mutation-set.test.ts` (+3), `tests/mutation-refusals.test.ts` (+5),
  `tests/mutation-lock.test.ts` (+6), `tests/mutation-revert.test.ts` (+5),
  `tests/mutation-restore.test.ts` (+9). Each new test is at the end of its file. The imports were
  extended in place, and one in the refusals file sits by its tests, so no cited line moved.
- `.mstack/specs/mutation-check/spec.md`, `design.md`, `tasks.md`.
- `.mstack/decisions.tsv` (8 rows), `.mstack/ledger.tsv` (the verdict), `.mstack/progress/current.md`.

Commits: `7aa8142` B1, `2793e1f` B2, `8457f2a` and `d1f319c` (NB1, NB2 tests), `e88bf55` NB3,
`436c551` (NB3's test written with escapes), `fa25ca5` NB4, `065d049` NB5, `5be2084` NB6, `8e73e01`
NB7, `e837c01` NB8, `f197bab` NB9, `5b293cf` NB10, `3204a2a` NB11 and NB12, then this report.

## The findings

| Finding | Closed by | Test |
|---|---|---|
| B1 sweep of a live run's staging | `7aa8142` | revert:246 (E1's calls), revert:277 (a copy changed, the directory deleted) |
| B2 skip-worktree, assume-unchanged | `2793e1f` | refusals:330, :340, :350 (under the store: not refused) |
| 1 M1, M2, M3, M4, M5, M10, M15 | `8457f2a` | revert:315, restore:478, lock:268, restore:512, lock:279, restore:498, revert:330 |
| 2 M6, M7, M8, M9 | `d1f319c` | refusals:360, refusals:376, set:295, set:307 |
| 3 duplicates by `fold` | `e88bf55`, `436c551` | lock:285 |
| 4 `restoreFromLock` validates | `fa25ca5`; the half tying paths to the revert set not applied | restore:539 |
| 5 key and a name not UTF-8 | `065d049` | set:336 |
| 6 run id before the unlink | `5be2084` | restore:556 |
| 7 `readLock`, symlink and FIFO | `8e73e01` | lock:296 |
| 8 parents by `entryAt` | `e837c01` | revert:345, restore:570 |
| 9 two fsyncs | `f197bab` | restore:642, restore:664 (node only) |
| 10 "move <p> aside" | `5b293cf` | restore:675 |
| 11 guarded `rmSync` | `3204a2a` | lock:320 |
| 12 `discard` exported | `3204a2a` | lock:337 |
| 13 liveness after a clock step | stage 4 (a trade-off in the wiki, row 275) | - |
| 14 `lock.head` against the sampled HEAD | stage 4 | - |
| 15 `ps` and `gitDirOf`'s cache | nothing to change | - |

`revert` is `tests/mutation-revert.test.ts` and so on for the other files. Rerun against `3204a2a`
(`I/out/*.after.*.out`, both runtimes), the review's attacks give:
- E1 and E11b: the revert writes nothing, and nothing is lost. E1's script then fails at its last
  step, which re-reads a lock that the clean restore has already removed.
- E11: refused.
- E4a: refused by `validateLock`.
- E4b: the outside file is kept.
- E4c: B's lock stays.
- E4e: damaged at once.
- E5: refused by the restore.
- E4d: still overwrites. That is the half not applied, below.

## Findings not applied

- **Finding 4, second half: `restoreFromLock` does not tie a lock's paths to the revert set.**
  R24 lists what a restore checks and asks nothing more. The review says so itself, and the brief
  and row 275 leave this half out. Evidence: `I/out/e4-hostile.after.node.out` (d). There, a lock
  edited by hand names `docs/readme.md`, with S set to the file's current bytes. It validates, and
  the restore writes H over the file. Only a crafted lock gets there. It has its decision row. Stage
  4's `verify --restore` could compare the lock's paths with `revertSet` between `lock.start` and
  `lock.head`.

## Commands

Red first: each test against the code as it was (`I/red/`). The last lines are below. The tests of
non-blocking 1 and 2 pin behaviour that was already right, so their red is the reviewer's mutant
(table below).

```
B1   (fail) R8 a run whose staging another run swept ... writes nothing     actual [1], expected []
     (fail) R11 a staged copy changed, or the run directory deleted ...     the revert went on with start/0 changed
B2   (fail) R2 a skip-worktree file is refused ... / R2 an assume-unchanged file is refused ...   got none
NB3  (fail) R24 two lock paths that differ only by case ...       ["src/a.ts","src/A.ts"] was not refused: []
NB4  (fail) R24 the restore checks the lock itself ...            AssertionError: [] (no failure)
NB5  (fail) R21 a key path whose name is not UTF-8 ...            {"key":"8aeaa60694d80c2b"}
NB6  (fail) R13 the restore leaves a lock that another run wrote  A's restore unlinked B's lock
NB7  (fail) R24 a lock that is a symlink or a FIFO ...            the symlink was followed: {"lock":{"v":1,...
NB8  (fail) R10 the revert removes no directory through a symlinked parent ...; (fail) R10 the restore lists ...
NB9  node: ℹ pass 0, ℹ fail 2: "the copy's directory was not fsynced before the source was unlinked", "src/ was not fsynced ..."
NB10 (fail) R15 a rescue that cannot be made ...                  Input: 'clear the cause of EXDEV'
NB11 (fail) R8 a run directory the sweep cannot remove ...        EACCES: permission denied, rm '.../20260101T000000Z-4-dddd'
NB12 SyntaxError: Export named 'discard' not found in module '.../src/mutation-lock.ts'.
```

NB11's red was taken in a copy at `5b293cf` with only the `discard` import dropped
(`I/scripts/red-nb11.sh`), because NB12's missing export fails the whole file.

### Mutants

`I/scripts/run-mutants.sh` makes a fresh `git archive` copy under `I/`. It applies one text
replacement, runs the owning test file, puts the file back and checks the hash. After every set, it
compares the copy's `src/` with the commit. All mutants ran under bun except N9a and N9b, which ran
under node. Output: `I/out/mutants-fixes.txt`, `I/out/mutants-review.txt`, logs `I/out/mutants/`.

| Mutant (at `3204a2a`) | Killed by |
|---|---|
| B1a no staged-copy check | revert:246, revert:277 |
| B1b a copy need only exist | revert:277 |
| B1c only `start/` checked | revert:277 |
| B2a flags not refused | refusals:330, :340 |
| B2b lower-case tag not seen | refusals:340 |
| B2c the store directory not left out | refusals:350 |
| N3 duplicates by exact string | lock:285 |
| N4 no `validateLock` in the restore | restore:539 |
| N5 no null key for a name not UTF-8 | set:336 |
| N6 the lock unlinked whoever wrote it | restore:556 |
| N7a without `O_NOFOLLOW` | lock:296 |
| N7b without `O_NONBLOCK` | lock:296 |
| N7c a FIFO read anyway | lock:296 |
| N8a the temp sweep through a link | restore:570 |
| N8b `createdDirs` through a link | restore:570 |
| N8c `removedDirs` through a link | revert:345 |
| N9a no fsync before the lock goes (node) | restore:664 |
| N9b no fsync before the source goes (node) | restore:642 |
| N10 the OS error's fix | restore:675 |
| N11 the `rmSync` unguarded | lock:320 |
| N12 `discard` keeps the directory | lock:176, lock:337 |

There are 21 mutants and all 21 were killed, each by the test written for it. The reviewer's
M1 to M10 and M15, with the same text, were first run at `d1f319c`. They ran again at `3204a2a`,
and all 11 were killed again, each by exactly its new test.

Checks, at `3204a2a`:

```
$ bun run typecheck                 # exit 0 (I/out/typecheck.txt)
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ bun test ./tests                  # I/out/suite-bun.txt
(fail) uncommitted src edits are invisible to the committed-tree comparison, as decided [5034.30ms]
 1009 pass
 2 skip
 1 fail
Ran 1012 tests across 50 files. [293.94s]
$ bun test tests/provenance.test.ts # that file alone (I/out/rerun-provenance-bun.txt)
 12 pass
 0 fail
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'   # I/out/suite-node.txt
ℹ tests 1012
ℹ pass 1012
ℹ fail 0
$ pgrep -fl mutation-holder         # once, after both suites
(nothing)
```

The one bun failure was in `tests/provenance.test.ts`, which this round did not change
(`git diff --stat 1b38994` of it and of `src/provenance.ts` is empty). It hit bun's 5 s timeout
under the machine's load, and the file alone passed 12 of 12. The 2 bun skips are the node-only
fsync tests. The bun total is 1012, which is 984 plus the 28 tests added here.

## R to test

Each cited line was printed again with `bat -pp -r`. No line of stage 2's table moved.

| R | Test | Where |
|---|---|---|
| R1 | refusals with no staging; an unreadable start blob; an operation in progress in a linked worktree (later: 3.4 the flags) | tests/mutation-refusals.test.ts:102, tests/mutation-refusals.test.ts:110, tests/mutation-refusals.test.ts:121, tests/mutation-refusals.test.ts:131, tests/mutation-refusals.test.ts:147, tests/mutation-refusals.test.ts:157, tests/mutation-refusals.test.ts:168, tests/mutation-refusals.test.ts:179, tests/mutation-refusals.test.ts:196, tests/mutation-lock.test.ts:176, tests/mutation-refusals.test.ts:376 |
| R2 | before the baseline; skip-worktree; assume-unchanged; flagged under the store; the cap of ten (later: 3.1 the checks after it) | tests/mutation-refusals.test.ts:211, tests/mutation-refusals.test.ts:224, tests/mutation-refusals.test.ts:237, tests/mutation-refusals.test.ts:251, tests/mutation-refusals.test.ts:265, tests/mutation-refusals.test.ts:278, tests/mutation-refusals.test.ts:330, tests/mutation-refusals.test.ts:340, tests/mutation-refusals.test.ts:350, tests/mutation-refusals.test.ts:360 |
| R3 | the refused shapes | tests/mutation-shapes.test.ts:90, tests/mutation-shapes.test.ts:103, tests/mutation-shapes.test.ts:112, tests/mutation-shapes.test.ts:127, tests/mutation-shapes.test.ts:139, tests/mutation-shapes.test.ts:161, tests/mutation-shapes.test.ts:178, tests/mutation-shapes.test.ts:191, tests/mutation-shapes.test.ts:208 |
| R4 | merges | tests/mutation-shapes.test.ts:229, tests/mutation-shapes.test.ts:248, tests/mutation-shapes.test.ts:267, tests/mutation-shapes.test.ts:284 |
| R5 | the running CLI (later: 3.4 the CLI) | tests/mutation-refusals.test.ts:297 |
| R6 | the baseline | n/a: implemented in stage 4 (task 3.1) |
| R7 | a red or slow baseline | n/a: implemented in stage 4 (task 3.1) |
| R8 | the lock first; a linked worktree; two at once; leftovers; a rescue kept; a swept staging writes nothing; a directory the sweep cannot remove; `discard` | tests/mutation-lock.test.ts:38, tests/mutation-lock.test.ts:66, tests/mutation-lock.test.ts:91, tests/mutation-lock.test.ts:119, tests/mutation-lock.test.ts:142, tests/mutation-revert.test.ts:246, tests/mutation-lock.test.ts:320, tests/mutation-lock.test.ts:337 |
| R9 | the set; 3 MiB; added, deleted, modified, renamed; bytes and bits; line endings; the index; directories; a 100755 start file | tests/mutation-set.test.ts:119, tests/mutation-lock.test.ts:157, tests/mutation-revert.test.ts:40, tests/mutation-revert.test.ts:63, tests/mutation-revert.test.ts:87, tests/mutation-revert.test.ts:101, tests/mutation-revert.test.ts:114, tests/mutation-revert.test.ts:330 |
| R10 | not in the set; untouched files; an untracked file in a removed or a made directory; nothing through a symlinked parent | tests/mutation-set.test.ts:72, tests/mutation-set.test.ts:91, tests/mutation-set.test.ts:106, tests/mutation-revert.test.ts:134, tests/mutation-revert.test.ts:315, tests/mutation-restore.test.ts:478, tests/mutation-revert.test.ts:345, tests/mutation-restore.test.ts:570 |
| R11 | unwritable; changed since the lock; before the lock; before the rename; an added file edited; a staged copy changed or deleted (later: 3.1 no obligation runs) | tests/mutation-revert.test.ts:161, tests/mutation-revert.test.ts:191, tests/mutation-revert.test.ts:205, tests/mutation-revert.test.ts:218, tests/mutation-revert.test.ts:231, tests/mutation-revert.test.ts:277 |
| R12 | the async runner (later: 3.1 the outcome) | tests/run-async.test.ts:111, tests/run-async.test.ts:121, tests/run-async.test.ts:136, tests/run-async.test.ts:143, tests/run-async.test.ts:153 |
| R13 | clean; whole bits; another file; SIGKILL in a write; the proof; S at a path HEAD lacks; another run's lock; fsync before the unlink (node) | tests/mutation-restore.test.ts:69, tests/mutation-restore.test.ts:96, tests/mutation-restore.test.ts:120, tests/mutation-restore.test.ts:138, tests/mutation-restore.test.ts:458, tests/mutation-restore.test.ts:512, tests/mutation-restore.test.ts:556, tests/mutation-restore.test.ts:664 |
| R14 | rescued; before the rename; a directory; a case variant; left where HEAD lacks; a second incident; the EXDEV copy; its fsync (node) | tests/mutation-restore.test.ts:160, tests/mutation-restore.test.ts:175, tests/mutation-restore.test.ts:195, tests/mutation-restore.test.ts:214, tests/mutation-restore.test.ts:231, tests/mutation-restore.test.ts:254, tests/mutation-restore.test.ts:286, tests/mutation-restore.test.ts:642 |
| R15 | read-only; missing staged copy; parent by case; a staged copy not H; a rescue that cannot be made (later: 3.2, 3.4) | tests/mutation-restore.test.ts:305, tests/mutation-restore.test.ts:339, tests/mutation-restore.test.ts:359, tests/mutation-restore.test.ts:498, tests/mutation-restore.test.ts:675 |
| R16 | stop(); SIGINT; the handler; SIGKILL alone; of the group (later: 3.3 the run) | tests/run-async.test.ts:163, tests/run-async.test.ts:182, tests/run-async.test.ts:198, tests/run-async.test.ts:219, tests/run-async.test.ts:235 |
| R17 | no child in the restore (later: 3.3 the signals) | tests/mutation-restore.test.ts:386 |
| R18 | no receipt when the tree changed | n/a: implemented in stage 4 (task 3.2) |
| R19 | the report of other changes | n/a: implemented in stage 4 (task 3.2) |
| R20 | the receipt row | n/a: implemented in stage 4 (task 3.1) |
| R21 | the key; a newline; git cannot list; a name not UTF-8 (later: 3.1 the run's own key) | tests/mutation-set.test.ts:167, tests/mutation-set.test.ts:188, tests/mutation-set.test.ts:206, tests/mutation-set.test.ts:218, tests/mutation-set.test.ts:234, tests/mutation-set.test.ts:254, tests/mutation-set.test.ts:281, tests/mutation-set.test.ts:295, tests/mutation-set.test.ts:307, tests/mutation-set.test.ts:336 |
| R22 | killed at four steps (later: 3.4 the command) | tests/mutation-restore.test.ts:420, tests/mutation-restore.test.ts:428, tests/mutation-restore.test.ts:437, tests/mutation-restore.test.ts:445 |
| R23 | liveness; the R1 refusal says alive or not; EPERM is running (later: 3.4) | tests/mutation-lock.test.ts:222, tests/mutation-lock.test.ts:236, tests/mutation-lock.test.ts:249, tests/mutation-refusals.test.ts:179, tests/mutation-lock.test.ts:279 |
| R24 | bad paths; damaged; a temp prefix; folded duplicates; a symlink or FIFO; the restore's own check (later: 3.4) | tests/mutation-lock.test.ts:195, tests/mutation-lock.test.ts:210, tests/mutation-lock.test.ts:268, tests/mutation-lock.test.ts:285, tests/mutation-lock.test.ts:296, tests/mutation-restore.test.ts:539 |
| R25 | the absolute restore command | n/a: implemented in stage 3 (tasks 4.1, 4.2) and stage 4 (task 3.4) |
| R26 | the hook | n/a: implemented in stage 3 (task 4.2) |
| R27 | the gate under a lock | n/a: implemented in stage 3 (task 4.1) |
| R28 | the rescue warning, prune | n/a: implemented in stage 3 (task 4.1) |

Rung: this round's code is at rung 4. The tests call the real functions on real repositories, on
macOS APFS (case-insensitive), with git 2.54.0, node v26.13.1 and bun 1.3.11. Two parts sit lower:
- **NB9.** The node-only tests show the order of the fsyncs and the unlinks. Durability across a
  power cut is rung 2.
- **NB5 for an untracked path.** That half is rung 2: APFS refuses the name (EILSEQ), so only the
  tracked half was run.

Not run: Linux, a case-sensitive disk.

## What stages 3 and 4 need that the spec does not say

Stage 2's list (`impl_mutation-check_r2.md`, last section) still holds, with these additions:

- **13.** On Linux, liveness reads a live run as a reused pid after the wall clock steps forward by
  more than about 1 s. Row 275 makes this a trade-off stated in the wiki, in stage 4.
- **14.** `prepareRun` reads HEAD itself. The run compares `lock.head` with the HEAD it sampled at
  step 2 before it reverts anything.
- **15.** `liveness` spawns `ps`, so it never runs between taking the lock and removing it. A fresh
  `verify --restore` calls `readLock` before `restoreFromLock`, so that `gitDirOf` is cached.
- **The revert's new failure.** `applyRevert` can now fail before any write: `written: []`, and a
  reason that names a staged copy. The run ends blocked (R11) and restores with `entries: []`,
  which only removes the lock.
- **The restore's lock checks.**
  - `restoreFromLock` runs `validateLock`. On a failure it writes nothing and returns one `failed`
    entry, whose path is the lock file. `verify --restore` still validates first, for R24's exit 2.
  - `restoreFromLock` leaves a lock at the name that is another run's, or that cannot be read, and
    says nothing about it. R18 (c) is the run's own check.
- **Other changes to the primitives.**
  - `discard(store, run)` removes a run directory after a refused `acquireLock`.
  - `refusals` has a new refusal, the flags, just before the dirty check. R2's second pass after
    the baseline gets it by calling `refusals` again.
  - `fold` is now exported from `src/mutation-lock.ts`.
- **Bun ignores the `skip` option of `node:test`** (`I/probe-skip/`, every form, even `skip:
  true`). The four `CASE` tests of stages 1 and 2 will run on CI's ubuntu bun job and fail there.
  The fix is to choose `test` or `test.skip`, as `nodeOnly` here and `tests/walkthrough.test.ts:210`
  do. I left those four tests as they are and recorded a row. The tests at lock:279 and lock:320,
  and older ones elsewhere, skip only for root, which matters only for a run as root.
- **One bun failure I did not capture.** It was in `tests/mutation-restore.test.ts`, on the run just
  after NB6. Five reruns of that file were clean.
