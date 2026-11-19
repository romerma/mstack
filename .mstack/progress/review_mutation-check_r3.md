# Review - mutation-check

**Verdict:** APPROVED

Round 3, scoped to `76145911..cb1b255` (B3's fix and the non-blocking points taken with it), head
`cb1b255ea71617248e5fc7d8cb5d53710774bdc1`. Taken by hand from `agents/reviewer.md`. Scratch:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review42r3/`,
written `S/` below. Every CLI run used `S/head` (a `git archive` of the head) in repositories
under `S/repos/`, `S/base` (an archive of `76145911`) for the before runs, `S/mut` for mutants
and `S/clone` for the suites. In this checkout I ran only `gate`, `version`, `state show 42` and
`ledger check`, and wrote this file and my ledger row.

No blocking finding. Every attack below kept every byte (in place, or in the staging until the
printed restore ran), and every printed way out, run as printed, got out.

## Non-blocking

1. **Hook: three more global options take their value after a space** (`src/hooks.ts:362`).
   Under a lock, `git --namespace foo commit -m x`, `git --namespace foo add -A`,
   `git --config-env core.editor=EDITOR commit -m x` and `git --attr-source HEAD add -A` are
   allowed; git accepts all three forms (`status` through each exits 0). R26 says "with git's
   global options", so this is a literal gap, in the same class as round 2's `--git-dir .git`,
   which was filed non-blocking; a commit under the lock is still caught by R18 (b) and the gate.
   Fix: add `namespace|config-env|attr-source` to the space alternation. The 14 forms near the
   fixed ones are all denied (point 6). `S/out/hookforms.bun.out`.
2. **The hook and R1 put a `cd` in front of a `rootFromTop` that `validateLock` rejects**
   (`src/hooks.ts:446`, `:470`; `src/mutation.ts:385`). In hand-edited locks, `".."` gives
   `cd <the worktree's parent> && ... verify --restore`, `"/abs"` gives `cd <top>/abs`, and
   `"pkg/a/"` gives `cd <top>/pkg/a/`. For those same locks the gate and `verify --restore` say
   "cannot be read" and give the by-hand recovery. For a lock with no `rootFromTop`, R1 says
   `<CLI> verify --restore puts the tree back and removes the lock`, and the restore then refuses
   it. Nothing is written in any of these cases (`S/out/hand3.txt`). Fix: add the `cd` only for a
   lock that `validateLock` accepts. Design.md says the hook "checks no more of it", so this may
   be the accepted cost.
3. **A `rootFromTop` that differs from this store's only in case passes the check and leads in a
   loop.**
   - With `"PKG/A"` in the lock of store `pkg/a`, `verify --restore` from `pkg/a` refuses:
     `the lock is the run's of the store at PKG/A in this worktree, and this store is at pkg/a`.
   - It then names `cd <top>/PKG/A && <CLI> verify --restore`. Run as printed, that refuses with
     the same line, on both runtimes; the gate and the hook name the same line.
   - Nothing is written. The way out (fix the field, or the by-hand recovery) is not printed.
   - A lock that nobody edits never holds this: a run started from `cd <top>/PKG/A` records
     `pkg/a` (`caseCwd`), because getcwd and git give the case on disk. I did not run an NFD
     spelling, which I expect to behave the same.
4. **Three of my mutants of the B3 path survive** (point 7). Worth a test first: **D**, under
   which the hook **allows** `git commit` under a lock with no `rootFromTop`. `join(top, undefined)`
   throws, and the hook fails open (`S/scripts/mutD.sh`: head denied, mutant `ALLOWED`).
5. **N1b: keep the line, and it can be pinned without a tight bound.**
   - What I ran (`S/scripts/pin-n1b.mjs`): the helper is given a pid that is already dead and
     the command `sleep 0.15; : > <file>`.
   - At the head the file is never written, 20 of 20 (bun and node). Without the check at start
     it is written 20 of 20.
   - Why this cannot fail at the head: the check runs synchronously right after the spawn, so no
     load makes it late. Under load the mutant can only escape the test; it cannot turn a correct
     head red.
   - So the row's "only a bound tighter than the poll could tell the two apart, and a test of
     tens of milliseconds fails under load" (decisions.tsv:296) does not hold for this test.
   - Why keep the line: it cuts the orphan's life after a kill at spawn from 287-302 ms to
     47-52 ms (point 4).
6. **A CLI path with a space breaks every printed restore line** (`src/mutation-lock.ts:672`,
   before this round; R25).
   - The setup: `twoStores` with the CLI at `S/cli dir/mstack`.
   - B's line, `cd .../pkg/a && S/cli dir/mstack/bin/mstack verify --restore`, run as printed:
     `/bin/sh: S/cli: No such file or directory`, exit 127, and the lock stays.
   - With the path quoted by hand: `restored 4, tree verified, lock removed`, and nothing is
     lost (`S/out/clispace.jsonl`).
   - The plugin cache is under `$HOME`, so this only matters for a home directory with a space.
7. `CHANGELOG.md:19-20` lists the refusals of `--restore` as "while the run may be alive". It
   does not mention the new one: the lock of another store of the worktree. This is an omission,
   not a contradiction.

## B3, by attack (point 1)

Round 2's own `twoStores` (`S/scripts/r2/`, its `attacks.mjs` and `lib.mjs` with only the
scratch root and the CLI changed) gave, on bun and node:
- From B: `restoreFromB` exit 2, `refused: the lock is the run's of the store at pkg/a in this
  worktree, and this store is at pkg/b; nothing was written, and the lock stays`.
- B's files as before: `bX "B's own committed x"`, `bNew "B's untracked work"`, `bShared` and
  `bGone` at their committed bytes.
- `gateB` ends `-> run cd .../twoStores-<rt>/pkg/a && <CLI> verify --restore`. The lock stays.

Its `lost` lists A's three files because the script stops before any restore from A
(`S/r2run/out/head.attacks.*.jsonl`).

My driver (`S/scripts/attacks3.mjs`, `lib3.mjs`) works like this:
- It builds the stores and kills A's run with its group during the check.
- From each other store it runs, in turn, `verify --restore`, `gate --quiet`, `verify
  --mutation` and the hook on `git commit -m x`. It hashes the whole tree, the lock and the run
  directory around each.
- It then runs the printed line verbatim: the `cd` part under zsh, and the whole line under
  `/bin/sh` from the other store.
- Finally it compares every byte against the snapshot taken before the run (the stores' own
  `.mstack` excluded).

Every row below held the same on bun and on node (`S/out/attacks3.{bun,node}.jsonl`,
`node S/scripts/table3.mjs`).

| Shape | From the other store | Printed line, run as printed |
|---|---|---|
| `pkg/a` and `pkg/b` | 2; tree, lock and run dir unchanged; gate, R1 and hook name `cd .../pkg/a` | 0, `restored 4`, lock gone, 0 changed, 0 lost |
| a store at the top and `pkg/a`, run in `pkg/a` | the same, from `.` | the same |
| the same, run at the top (`rootFromTop "."`) | the same, from `pkg/a`, naming the top | the same |
| `pkg/a` and `pkg/ab`, run in either | the same | the same |
| started and restored through a symlink to the repository | the same; the line names the real path | the same |
| one store, the checkout renamed | n/a | its own restore: 0, 0 changed, 0 lost |
| two stores, the checkout renamed | the same, naming the new path | the same |
| ``pkg/my a`` and ``pkg/b's "q"`` under ``sp ace's "dir"``, renamed to ``it's moved "too"`` | the same; `cd '...sp ace'\''s "dir"/it'\''s moved "too"-<rt>/pkg/my a'` | zsh `cd` lands in A; sh: 0, 0 lost |
| `pkg/café` (NFC) and `pkg/b` | the same | the same |
| the run started from `cd <top>/PKG/A` | `rootFromTop "pkg/a"`; the same | the same |
| a linked worktree with one store | main: `nothing to restore`, no lock line in its gate, hook allows | 0 in the worktree |
| a linked worktree with `pkg/a`, `pkg/b` | from the worktree's `pkg/b`: the same; main's `pkg/a`: `nothing to restore` | 0 |

Hand-edited `rootFromTop` (`S/out/hand3.txt`) gave the following, from A and from B, on both
runtimes, with the tree and the lock unchanged in all 22 cases:
- `/abs`, `..`, `""`, `pkg/a/`, `./pkg/a`, `pkg//a`, `pkg/x/../a`, `5` and `null` are refused as
  a lock "not one a run wrote" and get the by-hand line. Non-blocking 2 is about the hook and R1
  for these.
- With no field, the restore says `it does not say which store of the worktree wrote it` and
  gives the by-hand line, and so does the gate. The hook gives the by-hand reason.
- `PKG/A` is non-blocking 3.

After the original lock was put back, the restore from A gave 0, with 0 changed and 0 lost.

The acceptance sentence holds for every shape here: nothing the run did not write was removed
or overwritten unsaved. No lock was left whose only way out deletes work; the one loop, a
hand-edited case variant, is left by fixing one field.

## The printed line, the gate, the hook and R1 (points 2 and 3)

- **The gate and R1 in the lock's own store have no `cd`:** `-> run <CLI> verify --restore`;
  R1 says `<CLI> verify --restore puts the tree back and removes the lock`. This held in
  `twoStores` and `topNestedRunTop`, on both runtimes.
- **From another store, both have it.** The hook always has it, from any directory.
- **From inside `.git`** (`S/out/hook-gitdir.out`), where `--show-toplevel` fails, the hook says
  `run from pkg/a under this worktree's top level: <CLI> verify --restore`, as the implementer
  says.
- **The pasted transcripts still match.** `S/scripts/wikidiff.mjs` compared them line by line
  with fresh runs (`S/wiki/run-wiki.sh` on both runtimes and `S/wiki/wiki-gate.sh`), after
  normalising ids, pids, times, shas, the host and paths (`S/out/wikidiff.out`):
  - `The-CLI.md:777-792` (survived, 14 lines; the key `mutation:12b5aef8361b07f7` is exact): 0
    without a real line.
  - `:815-819` (refused, 3 lines): 0.
  - `:845-867` (kill -9 and the restore, 21 lines, bun and node): 0.
  - `Gates-and-Hooks.md:290-300` (the gate, 8 lines): 0.

## Non-blocking 1 of round 2: the helper's caller (point 4)

`S/scripts/nb1-driver.mjs`: a caller that SIGKILLs itself right after `runCommandAsync`; the time
from its death until no process with the command's marker is left; 10 runs per row
(`S/out/nb1.out`, load average 9.5):

| Copy | bun | node |
|---|---|---|
| `76145911` | alive past 3 s, 10 of 10 | alive past 3 s, 10 of 10 |
| head | 47-52 ms | 47-52 ms |
| head without `watch()` at start (N1b) | 287-295 ms | 289-302 ms |

The same through the CLI, with round 2's `helperRace-3` and `-10`:
- At `76145911` the check was alive 3 s later on both runtimes, and the 20 s timeout ended it.
- At the head the check never started, and the restore gave 0, then `nothing to restore`.

For kills 10, 100, 300 and 1000 ms after the spawn, 5 each per runtime, the last process went
after at most 254 ms. That is within `The-CLI.md:839-841` ("at most 264 ms"). On N1b, see
non-blocking 5.

## Non-blocking 8 of round 2: the capture file (point 5)

`S/scripts/nb8-probe.mts` makes the command remove its capture file, replace it with a
directory, or `chmod 000` it, then exit 3 (`S/out/nb8.out`):
- At `76145911`, a file that is **gone** gives an empty tail with no throw, `code 3`, on both
  runtimes. The implementer's reading is right.
- At `76145911`, a **directory** or an **unreadable** file throws in the `close` handler. Under
  node the process dies, exit 1, with `EISDIR` or `EACCES`. Under bun the error is printed and
  the promise never settles: my 10 s timer ended it.
- At the head, all three settle with `code 3` and `tail` `(the output could not be read:
  ENOENT|EISDIR|EACCES ...)`, on both runtimes.

## The hook's near forms (point 6)

These are denied under a lock (`S/out/hookforms.{bun,node}.out`, 14 of 14 on each runtime):
- `git --git-dir .git --work-tree . commit`, the `=` forms, and the two in either order.
- `-C . --git-dir .git stash`, and `--git-dir .git -C . -c a.b=c stash push`.
- `GIT_DIR=.git git commit`, `GIT_DIR=.git GIT_WORK_TREE=. git add .`, and `env GIT_DIR=.git
  git stash`.
- `--no-pager` or `-P` mixed in, tabs as separators, `"$PWD/.git"`, `'.git'`, and
  `./.git --work-tree=. stash -u`.

These pass, and are not filed:
- `--git-dir '/a dir/.git'` and `-c 'user.name=a b'`: a quoted value with a space, the class
  R26's "Not caught" already lists as `-C "dir with space"`.
- The plumbing commands: left for a follow-up by the design row.

What passes and is filed is non-blocking 1. CHANGELOG's cost holds. With no lock, `git commit`
starts one `git rev-parse --absolute-git-dir`, and `ls -la` and `git status` start none
(`S/out/hookgit.bun.out`).

## Spec and tests (point 7)

**R24 as amended, against `tests/mutation-two-stores.test.ts`:**
- `:207` covers "does not name its store's root relative to the worktree's top level": exit 2,
  `rootFromTop` and `which store` in the output, the tree and the lock unchanged, and the gate's
  line "cannot be read".
- `:199` and `:203` (in place, and after `renameSync` of the top) cover the rest:
  - exit 2 from B, with A's directory named by its real path;
  - the tree, the lock text and the run directory unchanged, B's untracked `new.js` included;
  - B's gate line, B's R1 refusal and the hook in B naming A's directory;
  - from A: exit 0, `restored 4, tree verified, lock removed`, no lock, and the tree and
    `git status` as before.
- These are the scenario's clauses one for one.
- No earlier test was weakened. The removed lines in `76145911..HEAD` are three fixture lines,
  which gain `rootFromTop`, and one import.

**The table of `impl_mutation-check_r6.md`.**
- `S/scripts/table.mjs`: 28 rows, 208 citations, each a `test(`, `caseTest(`, `nodeOnly(` or
  `userTest(` line of the head, and no id missing.
- I read the bodies of 15 cited tests, across ten rows:
  - every test new this round: R12 `run-async:279`; R13 `changed:230`; R16 `run-async:251`;
    R18 `changed:194` and `:213`; R24 `two-stores:199`, `:203` and `:207`; R26 `hook:173` and
    `:184`; R27 `gate:224` and `:238`;
  - and three older ones: R1 `refusals:102`, R22 `cli:189` and R25 `gate:142`.
- For five more I checked only that the line is a test and that its name matches the row: R5
  `cli:303`, R9 `revert:40`, R20 `run:286`, R26 `hook:125` and R24 `restore:539`.
- Each test I read asserts what its requirement says. For example:
  - `:279` asserts `code 3` and `/the output could not be read/` for a removed file and for a
    directory;
  - `:194` asserts exit 2, `(a) ... src/b.ts`, no row, HEAD's bytes back, and the edit in the
    rescue;
  - `gate:238` asserts no marker file, no receipt, and the lock unchanged.

**My mutants** (`S/scripts/mutants.sh`). Each was run against the two-stores, hook, lock, gate,
refusals, restore and cli test files under bun, 103 tests each time. `diff -rq` of `src`
against the head was clean afterwards (`S/out/mutants.txt`).

| Mutant | Result |
|---|---|
| Q. the restore's refusal names the directory unquoted (`mutation-run.ts:527`) | survived: 101 pass, 0 fail |
| C. no `badPath` check of `rootFromTop` (`mutation-lock.ts:519`) | survived: 101 pass, 0 fail |
| D. the hook takes a lock without a string `rootFromTop` (`hooks.ts:470`) | survived: 101 pass, 0 fail; the hook then fails open (non-blocking 4) |

None is a test that passes without the behaviour it names. They are branches no test names:
quoting, a bad field value, and the hook under a lock from before the field. The behaviour at
the head is right in each (the `quoted`, `handEdit` and `mutD` runs).

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| R24 (amended) | two-stores:199, :203, :207 | read; the attack table above repeats them through the CLI on both runtimes |
| R16 | run-async:251 | read; `nb1.out` before and after |
| R12 | run-async:279 | read; `nb8.out` before and after |
| R26 | hook:173, :184 | read; `hookforms` 14 of 14 denied |
| R27 | gate:224, :238 | read |
| R18, R13 | changed:194, :213, :230 | read |
| R1, R22, R25 | refusals:102, cli:189, gate:142 | read; R22's shape is also the wiki's kill -9 transcript, rerun |

The other 18 rows are carried over from round 2's table. `table.mjs` checks each of their
citations as a test line; I did not reread their bodies.

## Acceptance, quoted

**"verify --mutation reverts the code part of the item diff in place (store, tests and docs
excluded), confirms a green baseline first, runs the obligations and records mutation-killed,
mutation-survived or mutation-blocked in verification.tsv keyed by the code and test tree"**: met
at this head.
- The wiki's survived run writes `mutation-survived	mutation:12b5aef8361b07f7`, the wiki's key
  to the digit.
- The killed run and the refusal match `The-CLI.md` (point 3).
- Rounds 1 and 2 cover the rest; this round's diff does not touch that path.

**"A lock under the git dir holds the restore list; restore runs in finally and on
SIGINT/SIGTERM, the tree is as it was afterwards, verify --restore repairs a SIGKILLed run,
PreToolUse denies git commit/add/stash while the lock exists, and the gate fails on a lock"**:
met, now also with several stores in one worktree.
- `verify --restore` repairs the SIGKILLed run in all 13 shapes on both runtimes: from the
  lock's store, or by the printed line.
- The gate fails on the lock in every store of the worktree.
- The hook denies `git commit` from every store. The near forms are in non-blocking 1.

**"No path through the run, the restore or a recovery the tool prints removes or overwrites
content the run did not write without first saving it, and no state keeps the lock with
deleting work as the only way out"**: met for every path I made.
- B3's path now writes nothing, and the line it prints repairs the right store.
- The hand-edited locks write nothing.
- The CLI path with a space (non-blocking 6) and the case loop (non-blocking 3) each keep the
  lock, with a way out that deletes nothing.

## Verification I ran (point 8)

```
$ ./bin/mstack gate                # this checkout, head cb1b255: PASSED - 0 failures, 0 warnings
$ ./bin/mstack ledger check mutation-check   # FAIL no verdict at cb1b255e (before my row)
$ bun run typecheck                # S/clone: exit 0
$ ./bin/mstack lint-plugin .       # S/clone: PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md   # 110 relative links checked, 0 broken
$ bun test ./tests                 # S/clone: 1096 pass, 2 skip, 0 fail; Ran 1098 tests across 57 files [339.43s]
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 1098 / ℹ pass 1098 / ℹ fail 0
```

The outputs are in `S/out/suite-{bun,node}.txt`, `typecheck.txt`, `lint.txt` and `links.txt`.
The load average was 6.5 to 17.9 during the suites. I did not run `gate --full`, which appends
receipts here; the commands above are the store's `verify`.

`S/scripts/ten.sh` ran each test file this round changed or added 10 times per runtime, in a
fixed-count loop (`S/out/ten.txt`). Failures:

```
tests/mutation-two-stores.test.ts  bun 0 of 10, node 0 of 10
tests/run-async.test.ts            bun 0 of 10, node 0 of 10
tests/mutation-gate.test.ts        bun 0 of 10, node 0 of 10
tests/mutation-hook.test.ts        bun 0 of 10, node 0 of 10
tests/mutation-changed.test.ts     bun 0 of 10, node 0 of 10
tests/mutation-cli.test.ts         bun 0 of 10, node 0 of 10
```

That is 120 runs with 0 failures. The load average was 8.5 at the end, and other runs of mine
were going alongside.

## Docs (point 9)

- **The transcripts:** point 3.
- **`The-CLI.md:839-841`:** "killed at 0 to 1000 ms ... no process of it was left after at most
  264 ms". My runs at 0, 10, 100, 300 and 1000 ms gave at most 254 ms (point 4).
- **`:888-889`:** "250 ms, and somewhat more on a busy machine" agrees with that.
- **`:799-801`:** the tree-clean note rests on round 2's `gitkill.out`, which I did not rerun.
- **CHANGELOG:** the hook's cost (point 6) and the `rm` deny hold; the omission is non-blocking
  7.
- **`Gates-and-Hooks.md`:** the `cd` text agrees with the runs: the gate only for another store,
  the hook always.

## Decision rows of this round, judged

- **Row 292, the design.** "No path of a lock is ever resolved against another store root,
  moved checkout or not: the relative root survives a move". This holds: `movedTwo` and `quoted`
  refuse from B and repair from A after a rename.
- **Row 293**, the `cd` only for another store in the gate and R1, always in the hook: holds,
  as point 3 says.
- **Row 295, NB8's reading:** holds (point 5).
- **Row 296, N1b kept:** the decision holds; its reason for having no test does not
  (non-blocking 5).

## What I did not check

- **Not run:** Linux, a case-sensitive volume, an NFD-spelled `rootFromTop`, a submodule with
  its own store, a store whose path holds a newline, and `core.precomposeUnicode` changed between
  a run and its restore.
- **Not rerun:** round 2's other attacks and the implementer's 18 mutants. Neither is in this
  round's diff.
- **Not reread:** the bodies of the tests of the 18 carried-over rows.
- **The design lens** was not given, so I did not read it.
