# Implementation report, round 2: item 40, item-fields-base-size

Branch `feat/item-size-and-base`, from `61e6b7a` to `9853fd9` (code and docs), then this report.
Review answered: `.mstack/progress/review_item-fields-base-size.md` (blocking 1; non-blocking 2, 3,
7 (M6 and M7) and 8 (`DEFAULT_SIZE`)). Every CLI call was `./bin/mstack`
(`mstack 0.2.1 at /Users/romerma/Code/mstack`). Scratch evidence is in
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl40r2/`
(shortened to `impl40r2/` below).

## What changed

A size s item is now measured from the commit `measureStart` (`src/size.ts:68`) returns, with the
reason it chose that commit. D is the default branch `defaultBranch` names. Its local ref and
`origin/<name>` both count, whichever of them exist. F is `git merge-base HEAD <those refs>`, and
it is only used when it is not HEAD. If `base` is not in HEAD's history, the start is F, or the
gate fails with a fix that names `--base` when there is no F. If `base` is an ancestor of F and not
equal to it, the start is F. Otherwise the start is `base`. The gate's `[ok]` and `[fail]` lines
name the commit measured from. When that is not the base they add
`(where this branch left main; base <sha8> is older)` or `(...; base <sha8> is not in this
branch's history)`. The fix for an item over the limit is still `--size m`.

`measureDiff` runs `git diff --relative` and `ls-files` without `--full-name` in the store's root.
Tracked and untracked changes outside that directory are therefore not counted, and paths are
classified relative to it. A numstat count that is neither a non-negative integer nor `-` now makes
`measureDiff` return null, so the gate fails with "could not measure" instead of adding `NaN`. A
pure `git mv` is pinned to count as every line deleted plus every line added, in two files. A test
pins the round 1 decision that a bad `size` in `state.json` is a read error. `DEFAULT_SIZE` is
removed. The two wiki pages and the CHANGELOG say all of this, with the line pasted from a real run.

## Files

- `src/size.ts`: `Start`, `measureStart`, `forkPoint`, `isAncestor`; `measureDiff` scoped to the store root and given the count guard; `DEFAULT_SIZE` removed
- `src/gate.ts`: `checkSmallDiff` uses `measureStart` and names the start in its line
- `tests/item-size-base.test.ts`: 15 new tests (49 to 64), plus helpers `onBranch`, `sizeLine`, `sizeFailures`, `branchThenMainMoves`, `subStore`, `withNumstat`
- `docs/wiki/Gates-and-Hooks.md`, `docs/wiki/The-CLI.md`, `CHANGELOG.md`
- `.mstack/decisions.tsv` (4 implement rows), `.mstack/progress/current.md`, this report

Commits (`git log --oneline 61e6b7a..HEAD` before this report):

```
9853fd9 docs(size): name the branch-internal base case in measureStart's comment
ffdfdca docs: say that a branch-internal base with main merged in still counts it
8f0c47f docs: say where the size s check measures from and that it stays under the store
2956e23 test(state): pin a bad size in state.json as a read error, drop DEFAULT_SIZE
6adec63 fix(gate): fail a size s check whose numstat record does not parse
57cd592 fix(gate): measure a size s item under its store's root directory only
c6acc67 fix(gate): measure a size s item from where its branch left main
```

Each commit is green on its own: tests went in with the code they drive.

## Commands

### The review's repro before the change (`bash impl40r2/repro.sh before`, at `61e6b7a`)

```
$ mstack state add --slug one --title T --acceptance x --size s
added 1 one (pending)
$ mstack state set one --status in_progress
1 one (in_progress)
  status: "pending" -> "in_progress"
  base: (unset) -> "7df33347f3caf386621730daf6596085a4ec58fa"
$ mstack gate | rg size   # before the rebase
[ok]    one is size s: 10 lines in 1 file of code since 7df33347, within 60 lines and 3 files
[ok]    no item carries a decision fork
$ git rebase main && mstack gate | rg size   # after the rebase
[fail]  1 one (in_progress) is size s but its code diff from 7df33347 is 210 lines in 6 files, over the limits of 60 lines and 3 files
        fix: it is not small: 'mstack state set one --size m' (or split the work)
fork point: 5e572833; base: 7df33347
```

### Red, slice by slice

1a. The rebase and merge tests, written first in this checkout and run before any source change
(`bun test tests/item-size-base.test.ts -t "from where it left main"`, `impl40r2/red-1a.txt`):

```
+   "1 storage-layer (in_progress) is size s but its code diff from 22fb0868 is 210 lines in 6 files, over the limits of 60 lines and 3 files -> it is not small: 'mstack state set storage-layer --size m' (or split the work)"
(fail) after a rebase onto a main that moved, only the branch's own lines count, from where it left main [412.06ms]
+   "1 storage-layer (in_progress) is size s but its code diff from 37c1b864 is 210 lines in 6 files, over the limits of 60 lines and 3 files -> it is not small: 'mstack state set storage-layer --size m' (or split the work)"
(fail) after main is merged into the branch, only the branch's own lines count, from where it left main [412.18ms]
 0 pass
 2 fail
```

1b. The other seven cases of the rule, run against the source at `61e6b7a` in a scratch clone
before they were run against the new code (`bash impl40r2/old-run.sh`, `impl40r2/red-1b-old.txt`):

```
(fail) after a rebase onto a main that moved, only the branch's own lines count, from where it left main [398.07ms]
(fail) after main is merged into the branch, only the branch's own lines count, from where it left main [395.12ms]
(fail) after a fetch and a rebase onto origin/main, a local main left behind does not hold the start back [421.45ms]
(fail) a base a rebase rewrote is replaced by where the branch left main, and the line says so [440.69ms]
(fail) a base a rebase rewrote, with no fork point to use, fails with a fix that names --base [333.82ms]
 53 pass
 5 fail
AssertionError: [fail]  1 storage-layer (in_progress) is size s but its code diff from 4ce0ec31 is 210 lines in 6 files, over the limits of 60 lines and 3 files
(fail) after a fetch and a rebase onto origin/main, a local main left behind does not hold the start back [424.75ms]
AssertionError: [fail]  1 storage-layer (in_progress) is size s but its code diff from da6aa08c is 210 lines in 6 files, over the limits of 60 lines and 3 files
(fail) a base a rebase rewrote is replaced by where the branch left main, and the line says so [454.33ms]
AssertionError: main: []
(fail) a base a rebase rewrote, with no fork point to use, fails with a fix that names --base [432.44ms]
```

The last red is the corrected version of that test (see Deviations). Four tests pass on the old
code because the old code always measured from `base`: "a main that moved but was not brought in",
"a branch stacked on another", "work committed straight onto main" and "with no main, no master
and no origin/HEAD". They are guards against the new rule reaching too far, and the mutants below
kill each one.

2. The sub-directory tests (`impl40r2/red-2.txt`). The first is the review's mismatch: the tracked
top-level file is counted and the untracked one is not. The second counts `pkg/app/tests/` as
code:

```
(fail) a store in a sub-directory measures that directory only, tracked and untracked alike [370.10ms]
(fail) in a sub-directory store, paths are classified from the store's root, so its tests/ holds tests [338.02ms]
 0 pass
 2 fail
'[fail]  1 storage-layer (in_progress) is size s but its code diff from bb8642e6 is 305 lines in 3 files, over the limits of 60 lines and 3 files'
'[fail]  1 storage-layer (in_progress) is size s but its code diff from ba5047d9 is 800 lines in 3 files, over the limits of 60 lines and 3 files'
```

3. The numstat guard, at the function seam (`impl40r2/red-3.txt`). The rename pin passed, as a pin
should; M14 below kills it:

```
AssertionError: Expected values to be strictly equal:
+ actual - expected
+ {
+   files: 4,
+   lines: NaN
+ }
- null
(fail) a numstat record whose counts do not parse makes the diff unmeasurable, and the gate fails [431.00ms]
 1 pass
 1 fail
```

4. The read-error test passed the first time it ran, because the behaviour already existed. M15
below kills it.

### Mutants

Driver: `impl40r2/mutants.mjs`, run on a scratch clone of `8f0c47f`. That is the code as it stands
at the final head; the only later change to `src/` is a comment. Each mutant was checked to match
exactly once, applied, and run with `bun test tests/item-size-base.test.ts`, then the file was
restored. The run ended with `clone src restored`. Full output: `impl40r2/mutants.txt`.

| Mutant | Fails | Tests that went red |
|---|---|---|
| M1 the "older" branch removed | 3 | rebase; merge; stale local main |
| M2 "fork point is not HEAD" removed | 3 | work committed straight onto main; rewritten base with no fork point; the existing "commits since the base count together ..." |
| M3 "base is an ancestor of the fork point" removed | 1 | stacked branch |
| M4 ancestor test swapped (fork ancestor of base) | 4 | rebase; merge; stale local main; stacked branch |
| M5 "base not in HEAD's history" inverted | 24 | every gate test that measures, including "no main, no master and no origin/HEAD" |
| M6 rewritten base measured from the base | 1 | rewritten base replaced by the fork point |
| M7 rewritten base with no fork point measured from the base | 1 | rewritten base with no fork point fails |
| M8 local ref only (`origin/<name>` dropped) | 1 | stale local main |
| M9 `origin/<name>` only | 3 | rebase; merge; rewritten base replaced |
| M10 `fork !== base` removed | 1 | main moved but not brought in |
| M11 tracked scope removed (no `--relative`) | 2 | both sub-directory tests |
| M12 untracked scope removed (`--full-name`, `:/`) | 2 | both sub-directory tests |
| M13 NaN guard removed | 1 | numstat record that does not parse |
| M14 `--no-renames` replaced by `-M` | 1 | pure `git mv` |
| M15 bad `size` in `state.json` accepted (review M6) | 2 | read error [node], [bun] |
| M16 the `[ok]` line dropped (review M7) | 8 | every test that reads the `[ok]` line |
| M17 the line never names a start that is not the base | 4 | rebase; merge; stale local main; rewritten base replaced |

None survived. "No main, no master and no origin/HEAD" is killed only by M5, because it pins a
fallback that no natural one-line mutant changes.

### Session at the final head (`bash impl40r2/repro.sh final`, `impl40r2/repro-final.txt`)

```
$ mstack state add --slug one --title T --acceptance x --size s
added 1 one (pending)
$ mstack state set one --status in_progress
1 one (in_progress)
  status: "pending" -> "in_progress"
  base: (unset) -> "27fb03cb624000bcb4efa8fb8a8dd2c2addb844c"
$ mstack gate | rg size   # before the rebase
[ok]    one is size s: 10 lines in 1 file of code since 27fb03cb, within 60 lines and 3 files
[ok]    no item carries a decision fork
$ git rebase main && mstack gate | rg size   # after the rebase
[ok]    one is size s: 10 lines in 1 file of code since ffa8d069 (where this branch left main; base 27fb03cb is older), within 60 lines and 3 files
[ok]    no item carries a decision fork
fork point: ffa8d069; base: 27fb03cb
```

The `$ git rebase main` echo stands for `git rebase -q main` in the script. The wiki line
(`c4557de9`, `b27f89b7`) comes from the same script run at `8f0c47f` (`impl40r2/repro-after.txt`).

### A case the rule leaves to the base (`bash impl40r2/probe-midbranch.sh`)

Here the item starts after an earlier commit on the branch, and then main is merged in:

```
  base: (unset) -> "7fa55431a9a99a192f5ece7cd03fc3c1a7de93c9"
$ git merge main && mstack gate | rg "size s"
[fail]  1 one (in_progress) is size s but its code diff from 7fa55431 is 210 lines in 6 files, over the limits of 60 lines and 3 files
        fix: it is not small: 'mstack state set one --size m' (or split the work)
```

### Verify, after the final source edit (`9853fd9`)

```
$ npm run typecheck >/dev/null 2>&1; echo "typecheck exit $?"
typecheck exit 0
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate        (lines with fail, warn or the summary)
[ok]    one active item: item-fields-base-size (in_progress)
[ok]    item-fields-base-size is in_progress; a verification run is due at verifying
[ok]    on branch feat/item-size-and-base
[warn]  2 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 1 warning
$ npm run test:bun
 698 pass
 0 fail
Ran 698 tests across 29 files. [135.03s]
$ npm run test:node
ℹ tests 698
ℹ pass 698
ℹ fail 0
ℹ cancelled 0
$ env HOME=<empty dir> GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 bun test tests/item-size-base.test.ts
 64 pass
 0 fail
Ran 64 tests across 1 file. [21.33s]
$ env HOME=<empty dir> GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 node ... --test tests/item-size-base.test.ts
ℹ tests 64
ℹ pass 64
ℹ fail 0
$ ~/.nvm/versions/node/v22.6.0/bin/node ... --test tests/item-size-base.test.ts
# tests 64
# pass 64
# fail 0
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
98 relative links checked, 0 broken
$ rg -n DEFAULT_SIZE src tests docs CHANGELOG.md; echo "rg exit $?"
rg exit 1
```

Both suites went from 683 to 698. The new file went from 49 to 64 tests: 13 gate tests, plus one
CLI test that runs once per runtime.

## R to test

All in `tests/item-size-base.test.ts`.

| Requirement (brief) | Test | Line |
|---|---|---|
| 1 rebase repro: 10 lines counted, from the fork point | after a rebase onto a main that moved ... | 538 |
| 1 merge of the default branch | after main is merged into the branch ... | 549 |
| 1 default branch moved, not brought in: from base | a main that moved but was not brought in ... | 560 |
| 1 D: local main behind `origin/main` (decision 1) | after a fetch and a rebase onto origin/main ... | 568 |
| 1 stacked branch: parent's work not counted | a branch stacked on another ... | 579 |
| 1 work committed on the default branch: from base | work committed straight onto main ... | 594 |
| 1 base orphaned by a rebase, fork point usable | a base a rebase rewrote is replaced ... | 607 |
| 1 base orphaned, no usable fork point (on main; no default branch): fail naming `--base` | a base a rebase rewrote, with no fork point to use ... | 629 |
| 1 no main, no master, no `origin/HEAD`: `defaultBranch` returns `main`, rule uses base | with no main, no master and no origin/HEAD ... | 655 |
| 1 `[ok]` and `[fail]` lines name the start and say when it is not the base | 538, 549, 568, 607 (`[ok]`); 594, 655 (`[fail]` naming the base) | |
| 1 the fix for an item over the limit stays `--size m` | 61 changed lines fails ...; mstack gate exits 1 ... (existing) | 349, 775 |
| 2 sub-directory store: tracked and untracked, inside and outside | a store in a sub-directory measures that directory only ... | 691 |
| 2 a test file under the sub-directory | in a sub-directory store, paths are classified ... | 706 |
| 2 realpath (macOS `/var`) | every gate test: the sandboxes are under `/var/folders/...` (`os.tmpdir()` on both runtimes) | |
| 3 a numstat count that does not parse: cannot measure | a numstat record whose counts do not parse ... | 760 |
| 3 rename behaviour pinned | a pure git mv of a code file ... | 721 |
| 4 bad `size` in `state.json` is a read error | a size in state.json outside s, m and l ... (node, bun) | 149 |
| 4 `DEFAULT_SIZE` removed | no behaviour; `rg` above finds nothing | |
| 4 docs and CHANGELOG | prose; doc links check above | |

## Findings not applied

Every finding in this round's brief was applied. The review findings below were left out because
the brief put them out of scope, and the coordinator is filing them. They are not rebuttals, so
they have no decide rows:

- Non-blocking 1 (`done` on an over-limit size s item), 4 (untracked-versus-git line counts), 5
  (the fix line when git times out or a buffer overflows), 6 (a hand-edited `base` such as
  `"HEAD"`), the `--clear` help duplication, the red commit `1273254`, and `commit.gpgsign` in the
  shared helper.
- Review mutant M5 (the last line of an untracked file without a newline has no test). It sits
  under 4 and is not in the brief's list, so no test was added.
- From non-blocking 8: `parseSize` trims, and lockfiles count as code. Neither is in the brief.

Blocking 1 is applied as the brief's rule, which is the review's option (a) with a condition that
HEAD has commits past the default branch. That condition covers the review's concern about
branches that are already merged. One case is still a false red; see decision 4.

## Decisions (also `./bin/mstack decide --phase implement` rows)

1. **D is the local ref and `origin/<name>` together, not the local ref preferred.** After
   `git fetch && git rebase origin/main`, the local `main` is usually behind. Its merge base with
   HEAD is then the old point, and the false red comes back. Given more than two commits,
   `git merge-base` answers for HEAD and a hypothetical merge of the rest, so F only ever moves
   later, along commits HEAD contains. When only one of the refs exists, that one is used. Test at
   line 568 (red at `61e6b7a`); M8 kills the local-only version.
2. **The numstat seam is a stand-in `git` first on `PATH`.** It forwards every call except
   `diff --numstat`, and for that one prints `0\t0\t\0src/old.ts\0src/new.ts\0`, the record
   `-M` produces. No flag this code passes makes the real git print a malformed record, and git is
   the one collaborator the project does not own. A parser exported and tested on its own would
   leave the null return in `measureDiff` unpinned. The test also calls the real git for contrast
   (`{ lines: 5, files: 1 }`).
3. **Wording of the line.** It reads `since <sha8> (where this branch left <name>; base <sha8> is
   older)`, or `is not in this branch's history`. A fork point equal to the base is reported as the
   base (M10). With no F, the fail line is "its base <sha8> is not in this branch's history (a
   rebase rewrites it), and there is no point where the branch left <name> to measure from instead"
   and the fix is `'mstack state set <slug> --base <commit>' names the commit the item's work
   starts after`.
4. **A base that is a branch commit, with main merged in after it, is measured from the base.**
   The brief's "every other case" says so, and so does the round 2 design row. Base and F are
   unrelated there, and the probe above shows a 10-line fix reported as 210 lines with the advice
   `--size m`. Measuring from F instead would also count the branch's commits from before the
   item, which is what a rebase in the same situation already does, because the base is then
   rewritten. The wiki states this case.

## What is not shown

- The realpath comparison was kept, as the brief asked. With git's output now relative to its
  working directory, the comparison no longer guards a `/var` root, because both sides derive from
  `store.root`. The `/var` path is still exercised by every gate test. A `.mstack` that is a
  symlink outside the repository is unchanged (review non-blocking 4, out of scope).
- Not run: `claude plugin validate . --strict`, a real remote (`origin/main` is set with
  `git update-ref`, not fetched), a shallow clone, and a detached HEAD or an unborn orphan branch
  under the new rule. On an unborn branch, `merge-base --is-ancestor` errors and reads as "not in
  history", so the gate fails naming `--base`; this was not run.
- The stand-in `git` is a `#!/bin/sh` script, so the test is POSIX-only, like the rest of the
  suite's git fixtures. It runs green on bun 1.3.11, node 26.13.1 and node 22.6.0.

## Deviations

- The brief said to prefer the local branch. Both refs are used instead (decision 1).
- Red first held for the rebase and merge tests in this checkout. The other seven rule tests were
  written after `measureStart` and shown red against the old source in a scratch clone before they
  ran against the new code. The first version of "no fork point to use" was wrong: a
  `rebase --force-rebase` within the same second gave back the same commit ids, so the base was
  never orphaned. It failed against the new code, was corrected (rebase onto a new parent), and was
  then red on the old code and green on the new code before the commit.
- `2956e23` holds two changes, the read-error test and the removal of `DEFAULT_SIZE`, against the
  one-change-per-commit rule.
