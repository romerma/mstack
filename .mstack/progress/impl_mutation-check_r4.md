# Implementation, item 42 `mutation-check`, stage 3 (the gate and the hook)

I am the implementer, by hand from `agents/implementer.md` ("A later round" names this file), since
the plugin is not loaded. This is stage 3 of 4: tasks 4.1 and 4.2, Part B (four tests that bun would
run on CI) and Part C (one uncaptured failure). Scratch:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl42s3/`,
written `I/` below. Head before this report: `11b10d6`. Nothing of group 3 is written: no `case
"verify"`, no `src/mutation-run.ts`.

## What changed

- **4.1 (`f59db81`).** `checkMutationLock` runs after `checkWorkspace`, so it runs with no active item.
  A lock is a failure whatever the item's status: one line with the lock, pid, host, start time and
  path count, then *running* (wait, no restore command), *not running* (`<cli> verify --restore`, plus
  the running CLI when that file is gone) or *cannot be told* (where to run it, and the by-hand
  recovery). A lock that is not JSON, not a regular file, or fails `validateLock` fails with the by-hand
  recovery. Every worktree's `rescue/` that holds an entry is a warning with its directory and "N
  entry/entries". `runVerification` asks for the lock first and runs nothing. `prunable` leaves out a
  worktree whose git directory holds the lock or a rescue. New in `src/mutation-lock.ts`:
  `restoreCommand`, `lockExistsIn`, `rescuesIn`, `rescueDirectories`.
- **4.2 (`1c95c3a`).** `preToolUse` tests each segment against the listed git verbs after the guards;
  only a match runs `git rev-parse --absolute-git-dir` in `input.cwd` and `lstat`s the lock. A new
  `GUARDS` entry denies `rm` of a path that ends in `mstack-mutation.lock`. `denied()` in
  `tests/hooks.test.ts` (and the other `preToolUse` call there) pass a throwaway `cwd`.
- **Part B (`f01b82f`).** The four tests choose `caseTest = caseInsensitive ? test : test.skip`.
- **Docs.** `docs/wiki/Gates-and-Hooks.md`: two rows in "What PreToolUse denies", a paragraph on what
  the hook does not see, and a bullet on the lock and the rescue under "What `mstack gate` checks"
  (output from `I/scripts/wiki-gate.sh`, paths and host shortened). `hooks/hooks.json`: the PreToolUse
  description. `tasks.md`: 4.1 and 4.2 ticked. `design.md` corrected (`11b10d6`).

Files: `src/gate.ts`, `src/hooks.ts`, `src/mutation-lock.ts`, `src/worktree.ts`, `hooks/hooks.json`,
`docs/wiki/Gates-and-Hooks.md`, `tests/mutation-gate.test.ts` (new, 8), `tests/mutation-hook.test.ts`
(new, 8), `tests/hooks.test.ts`, `tests/mutation-fixture.ts`, `tests/mutation-refusals.test.ts`,
`tests/mutation-restore.test.ts`, `.mstack/specs/mutation-check/{design,tasks}.md`,
`.mstack/decisions.tsv` (2 rows), `.mstack/ledger.tsv`, `.mstack/progress/current.md`.

## Part B: bun and `skip`

Probe (`I/probe-skip/skip.test.ts`, five lines, `{ skip: true }`; `I/out/probe-skip.out`):

```
== bun
(fail) skip true is ignored by bun [0.82ms]
 0 pass
 1 fail
== node
ℹ skipped 1
```

The claim holds. I then mounted a case-sensitive APFS volume (`hdiutil create -fs "Case-sensitive
APFS"`, `I/scripts/csdisk.sh`, ejected afterwards) and ran with `TMPDIR` on it
(`I/out/partb-casesensitive.out`):

```
old code (before f01b82f), bun, refusals, -t case:  (fail) R2 a case variant ... (fail) R2 a path of the set ...   0 pass, 2 fail
new code, bun, refusals + restore, -t case:         0 pass, 4 skip, 0 fail
new code, node, the same two files:                 ℹ pass 46, ℹ fail 0, ℹ skipped 4
```

On a case-sensitive disk the four tests are skipped under both runtimes, and the old code failed
there. Not run: Linux, and CI's ubuntu job itself. The four are `refusals:251`, `:265`,
`restore:214`, `:359`; no `test(` line moved. `tests/mutation-shapes.test.ts` has no case test. The
skipped tests carry no reason text in their name (the walkthrough's do). Decision row recorded.

## Part C: `tests/mutation-restore.test.ts`, 30 runs under bun and 30 under node

`I/scripts/partc.sh` runs each in its own file. Machine load average was 7 to 9 from outside work
during both loops, and my own suites and mutant runs overlapped with them.

Result, no run failed in 60 of each:

```
second loop (I/partc2/, no edit to a test or source file while it ran): bun failures: 0 of 30; node failures: 0 of 30
first loop  (I/partc/):  bun failures: 0 of 30; node failures: 1 of 30
```

The one node failure of the first loop is `I/partc/node.4.out`: `SyntaxError: The requested module
'./mutation-fixture.ts' does not provide an export named 'CASE'`. It is not a test failing. That run
started while I was editing Part B (the fixture's `CASE` already renamed, the restore file not yet),
so the file did not load. The second loop is the clean one. I changed nothing for Part C: no
failing test to name, so no hypotheses to rank. The earlier bun failure stays uncaptured; it did not
recur in 60 bun runs here or in the 5 reruns of stage 2, under load average 7 to 9.

## Red first

`I/red/`. Each test file against the code as it was, last lines:

```
tests/mutation-gate.test.ts (I/red/gate.red.out): 8 tests, 0 pass, 8 fail, e.g.
  AssertionError: a lock and no active item left the gate green
  AssertionError: gate --full passed under a lock
  AssertionError: the main checkout's gate did not warn: ["on main; ...","1 uncommitted change(s); ..."]
tests/mutation-hook.test.ts (I/red/hook.red.out): 1 pass, 7 fail, e.g.
  AssertionError: not denied under a lock: git commit -m x
  AssertionError: without a lock, not denied: rm .git/mstack-mutation.lock
  (the pass is "shapes not caught are allowed": nothing denied yet; H2 and H8 below show it can fail)
tests/hooks.test.ts, old denied(), in a copy of the checkout with its own repository and a lock (I/red/denied.red.out):
  (fail) the destructive-command guard denies what it should and nothing more
  (fail) the safe forms are not denied, including the one the guard recommends
  (fail) a store name in a later command does not deny the rm in an earlier one
   20 pass / 3 fail      then with the throwaway cwd (I/out/denied.green.out): 23 pass / 0 fail
```

The last block shows why `denied()` needs the throwaway: three tests of that file, not one, read
the lock of the `cwd` repository, and the second `preToolUse` call (line 40) passed no `cwd` at all.
The lock was only ever in the copy, never in this checkout.

## Mutants

`I/scripts/mut.py` copies the checkout to `I/mutant-copy/` (no `.git`), applies one text
replacement, runs the task's file under bun, and puts the file back from the checkout. Specs:
`I/scripts/mut41.json`, `mut42.json`; output `I/out/mut41.txt`, `mut42.txt`. All 22 were killed.

| Mutant | Killed by |
|---|---|
| M1 the gate's lock check removed | gate:60, :74, :98, :109, :142, :179, :196 |
| M2 `gate --full` runs under a lock | gate:123 |
| M3 the rescue warning reads only the common dir's own | gate:196 |
| M4 prune offers a worktree holding a lock | gate:196 |
| M5 prune offers a worktree holding a rescue | gate:196 |
| M6 an unparseable lock allowed | gate:98 |
| M7 a live run is told to restore | gate:74 |
| M8 the running CLI never named | gate:142 |
| M9 an empty `rescue/` warns | gate:179 |
| M10 the pid and start left out of the line | gate:74 |
| M11 cannot-tell reported as not running | gate:74 |
| H1 `git stash` let through | hook:67, :78 |
| H2 the hook spawns git for an unrelated command | hook:78, :91, :101 |
| H3 the `rm` guard removed | hook:138 |
| H4 an unparseable lock allowed | hook:125 |
| H5 the `rm` guard also matches the lock's temp file | hook:138 |
| H6 the lock's existence not checked | hook:113 |
| H7 the reason does not name the lock's CLI | hook:158 |
| H8 git cannot answer denies | hook:91, :113 |
| H9 `input.cwd` ignored | hook:67, :78, :113, :125, :158 |
| H10 `commit-tree`, `add-note` match | hook:78 |
| H11 the `rm` guard needs a lock | hook:138 |

`gate` is `tests/mutation-gate.test.ts`, `hook` is `tests/mutation-hook.test.ts`. No mutant survived,
so `tasks.md`'s counts (8 and 8) stand. In the first run of H1, `hook:101` failed as well; four reruns
of H1 killed exactly hook:67 and :78, and 23 runs of the file on the unmutated code were clean
(`I/flake/`). I did not find the cause; a failed fork under that load is a guess, not a finding.

## Checks

```
$ bun run typecheck                          # exit 0
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ bun run test     (I/out/suite-both.txt, at 11b10d6 plus the decision row)
 1026 pass
 2 skip
 0 fail
Ran 1028 tests across 52 files. [275.32s]
ℹ tests 1028
ℹ pass 1028
ℹ fail 0
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
109 relative links checked, 0 broken
$ claude plugin validate . --strict
✘ Validation failed: root: CLAUDE.md at the plugin root is not loaded as project context   (the one warning; not from this stage)
```

The 2 bun skips are the node-only fsync tests of stage 2. The bun total is 1012 + 16 new = 1028.

```
$ ./bin/mstack gate        # before the report commit
PASSED - 0 failures, 1 warning      (the warning: the uncommitted report and rows)
```

## Where the code differs from `design.md`, and why

`design.md` "The gate and the hook" is corrected in `11b10d6`, with a `decide` row.
- The common git directory is asked with `--path-format=absolute` (git 2.31 or later). The plain
  form may print a relative path. With an older git the rescue warning is absent.
- A lock that is JSON but fails `validateLock` is reported as one that cannot be read as a run's
  record, with its first problem. `liveness` trusts fields R24 checks.
- The restore command is `restoreCommand(lock.cli)`, one function for the gate, the hook and stage 4.
- The hook reads only an integer `pid` and an absolute `cli` from the lock; with those it names both,
  otherwise it points at `mstack gate`. A lock name that cannot be `lstat`ed for a reason other than
  ENOENT or ENOTDIR counts as present.
- An "entry" of a rescue is what is directly under `rescue/`, so each `rescue/<k>/` is one.
- `runVerification` asks for the lock before it reads the obligations, so it also covers "no
  active item".

## R to test

Each cited line was printed again with `bat -pp -r` / read by `I/scripts/checklines.py` (122
citations of rows R1 to R24, all `test(`, `caseTest(` or `nodeOnly(` lines, `I/out/checklines.txt`).
Rows R25 to R28 are new.

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
| R25 | the gate line names the lock's CLI, and the running CLI when that path is gone; the hook's reason names it (later: stage 4, task 3.4, the lines a run and a restore print) | tests/mutation-gate.test.ts:142, tests/mutation-hook.test.ts:158 |
| R26 | shapes caught; every listed command; shapes not caught; no git for an unrelated command; no lock or git cannot answer; an unparseable lock; rm of the lock | tests/mutation-hook.test.ts:67, tests/mutation-hook.test.ts:78, tests/mutation-hook.test.ts:91, tests/mutation-hook.test.ts:101, tests/mutation-hook.test.ts:113, tests/mutation-hook.test.ts:125, tests/mutation-hook.test.ts:138 |
| R27 | a lock and no active item; running, not running, cannot tell; unparseable; the Stop hook; gate --full | tests/mutation-gate.test.ts:60, tests/mutation-gate.test.ts:74, tests/mutation-gate.test.ts:98, tests/mutation-gate.test.ts:109, tests/mutation-gate.test.ts:123 |
| R28 | a rescue that holds anything; a linked worktree's rescue; prune | tests/mutation-gate.test.ts:179, tests/mutation-gate.test.ts:196 |

Rung: the new code is at rung 4 on macOS (APFS, git 2.54.0, node v26.13.1, bun 1.3.11). The hook was
also run through `./bin/mstack hook pre-tool-use` on a throwaway repository with a lock
(`I/out/hook-e2e.out`): deny with the pid and the CLI path, and `git status` allowed. Not run:
Linux, a case-sensitive disk for the whole suite, git older than 2.31.

## What stage 4 needs that the spec does not say

Stage 3's list (`impl_mutation-check_r3.md`, last section) still holds, with these additions:

- **16.** Use `restoreCommand(cli)` from `src/mutation-lock.ts` for every message that names the
  restore (R25): the lines `verify --mutation` prints at the lock, a refusal, a failed restore. It
  returns `<cli> verify --restore`, and adds the running CLI when the lock's file is gone.
- **17.** The gate is red under the lock from the moment `acquireLock` links it. A test of the run
  that calls `runGate` before the restore sees that line; the Stop hook sends it too.
- **18.** The hook sees only commands the Bash tool is asked to run, so the run's own `git` calls
  (`execFileSync`) are not touched by it, and a test of the run need not work around it. An agent's
  `git add` or `git commit` in the same session is denied until the restore; the by-hand recovery
  in the gate's line (`git stash push --include-untracked`) is denied for an agent too, and is for a
  person at a terminal.
- **19.** `mstack gate --full` under a lock fails and writes nothing, so a run must not call it as its
  baseline after the lock. R7's baseline is read from `verification.tsv` or run before the lock.
- **20.** `worktree prune` offers nothing that holds a lock or a non-empty `rescue/`; the wiki's page
  on the restore (task 3.4) should say a rescue is removed by hand, and the gate warns until it is.
- **21.** The by-hand text lives in `src/gate.ts` (`BY_HAND`) and says only what R24 and the design
  say for a lock that cannot be read; task 3.4's `verify --restore` output for a damaged lock should
  use the same words.
