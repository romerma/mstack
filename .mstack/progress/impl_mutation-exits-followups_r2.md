# Implementation round 2 - mutation-exits-followups (item 105)

The account of the whole round: the answer to `review_mutation-exits-followups.md`
(CHANGES_REQUESTED, 1 blocking, 2 non-blocking; response row 04:22:14Z), then three rules tried
for the edited lock. Base `819c9a3`, round 1 head `410debf`. Scratch `S` =
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl105r2/`
(`S/scripts/`, `S/out/`). Every run of the mechanism was in fixtures under `S/fx/`, from `git
archive` copies of a commit (`S/head0` 410debf, `S/base` 819c9a3, `S/narrow` the final rule).

## What changed

**Blocking (a copied checkout restored with `GIT_DIR` and `GIT_WORK_TREE` refused).**
`rootDisagrees` (`src/mutation-lock.ts`) asks git about a lock's `root` only when
`relative(top, root)` stays under `top`, as the response took it, and that git call runs from the
root alone: `GitOptions.fromCwd` (`src/git.ts`) drops the variables `git rev-parse
--local-env-vars` lists. The response's fix alone left a copy made around the original refused
(L13a, L13b 0/7, base 7/7). The device-and-inode shortcut went: it guarded nothing.

**The edited lock: three rules.** Each refuses the edit A2 names (`rootFromTop` to `pkg/b`,
`root` left on A) from both stores. The first two each refused a restore the base performs:

| Rule | Commits | Refused a legitimate restore | Fate |
|---|---|---|---|
| 1. Any root git places in this worktree elsewhere than `rootFromTop` (round 1's, plus the two guards) | `f05d272`, `1da388b` | L14a: a checkout moved up into its parent's place whose repository tracks a directory at the old root's path, 0/7 (base 7/7) | replaced, row 05:23:35Z |
| 2. The store `findStore` gives from `root` must be this one | `dd78e1c` | L14e: the same move with a store at the repository's top, 0/7 (base 7/7) | stopped there (row 05:42:52Z), replaced, row 05:43:49Z |
| 3. Only a `root` that is another store's own directory (`root/.mstack`) is placed by git and can disagree | `d55c409` | L15a, L15b: moves that leave the old root on another store's own directory, 0/7 (base 7/7) | taken |

**Non-blocking 1**: the docs list what is not caught, each case measured (below). **Non-blocking
2**: `:652` gains a relative link and a two-link chain, `:720` the edit to `.` with a store at the
top; X1, X2, X3 are killed.

## Files and commits

`src/git.ts`, `src/mutation-lock.ts`, `tests/mutation-exits.test.ts`,
`.mstack/specs/mutation-check/design.md`, `.mstack/specs/mutation-check/spec.md`,
`docs/wiki/Gates-and-Hooks.md`, `docs/wiki/The-CLI.md`, `CHANGELOG.md`, `.mstack/decisions.tsv`,
`.mstack/ledger.tsv`, `.mstack/progress/current.md`, this report. Commits `912f34f` to the last:
tests first, then each rule with its tests, docs after each, chores for the reports and records.
`f05d272`'s subject was 73 characters and was reworded with `git rebase --exec`, trees identical.
The narrower rule was committed once before step 2 of its brief and undone with `git reset --soft`
so it went in after the L15 layouts were built (`d55c409`, tree equal to `S/narrow`).

## The git call added since the base, and the variables

`git diff 819c9a3..HEAD -- src/` adds one: `placeOfDir(root)`, `git rev-parse --show-toplevel
--show-prefix` with cwd the root, from `rootDisagrees` (reached from `restoreRun`, `fromLockStore`
and `inLockStore`). `cannotRun` starts no process. The store test is `existsSync(root/.mstack)`, the
disk only. `S/out/probe-env.txt` (git 2.54) gave what each variable does to that call at round 1:
`GIT_WORK_TREE`, alone or with `GIT_DIR`, from a root outside it, answers the caller's worktree
with an empty prefix (B1), and from a repository nested in it, that worktree with the nested
path (L13); `GIT_DIR` alone makes the cwd the top, no refusal; `GIT_INDEX_FILE` and `GIT_PREFIX`
change nothing; `GIT_CEILING_DIRECTORIES` only makes git fail, which accepts the lock. Now, ten
roots asked under nine settings (`S/out/probe-findstore-narrow.txt`, bun and node): the same
answers for every variable but a ceiling at the top, where git fails and the lock is accepted;
the restore itself refuses first there (`mutation-run.ts:528`, git cannot place its own store). A
file, a dangling link and a FIFO never throw or block (<1 s).

## Red first

```
B1 at 410debf (S/out/red-head0-bun.log): 15 pass 1 skip 3 fail, node the same
  B1 copied ... GIT_DIR and GIT_WORK_TREE: the gate's line ... -> no verify --restore takes this lock
  B1 copied into the directory that holds it: refused: ... its root .../top dir's "q" x/pkg/a is the store at top dir's "q" x/pkg/a
  B1 rootDisagrees: + `its root .../old path dir's "q" x is the store at pkg/b ...`  - null
the review's fix alone (S/out/red-lex-bun.log): 17 pass 1 skip 1 fail: the copy around the original
L14 at b460909 (red-l14-bun.log): 18 pass 1 skip 2 fail: moved up one level: ... -> no verify --restore takes this lock ...
  its root .../outer/proj dir's "q" x/pkg/a is the store at proj dir's "q" x/pkg/a
L14e and the adjusted unit test at edb76cc (red-narrow-bun.log): 19 pass 2 fail
  L14e: ... its root .../outer/proj dir's "q" x/pkg/a is in the store at the worktree's top level
  L14 rootDisagrees: + `its root .../pkg/a/src is in the store at pkg/a ...`  - null
X1 (self = link): + lead: "... '.../relative link/bin/mstack', cannot run (its src/cli.ts is missing); "
X3 (hops < 1): AssertionError: .../chain/bin/mstack | X2: the top store ... restored 1, tree verified
```

Tests changed by the rules, each with a row: `:901`'s `..b` became a store under rule 2 (69b974b,
row 05:28:26Z; it still disagrees under rule 3). Under rule 3 the unit test at `:984` changes
its assertions for A's `src/` and for a file, a dangling link and a FIFO in A, named `pkg/b`
from B: they now agree, where rule 2 said "is in the store at pkg/a", because none is a store's
own directory. It gains a link under the top to A (disagrees) and `<top>/pkg/./b` (agrees), so
links are followed and git's place, not the spelling, decides (row 05:50:51Z).

## Legitimate restores, layout by result

`S/scripts/layouts.mjs` (from the reviewer's): a fresh fixture per case whose item modifies 2
files, adds 1 and deletes 1; a SIGKILL at `lock-written`, `reverted:0`, `revert-written:2`,
`obligations-running`, `restored:0`, `restore-written:2` (`tests/mutation-run-holder.ts` of the
copy, its process group killed) and a real `bin/mstack verify --mutation` killed with `kill -9`
while its check sleeps; then the layout's change and the restore as a person runs it. Good: exit
0, lock gone, every file outside `.git` byte-identical (path, mode, SHA-256) to before the run,
the run's own `verification.tsv` left out. On node the PATH holds no bun
(`S/out/which-runtime.txt`). The final rule, `S/narrow` (`layouts-narrow-bun.txt`, `-node.txt`):

| Layout (restore) | bun | node |
|---|---|---|
| L01 one store at the top; L02 a store in a subdirectory | 7/7; 7/7 | 7/7; 7/7 |
| L03 two stores, from A (from B: exit 2, nothing written, 7/7); L03b stores at the top and pkg/a, from A (from the top: exit 2, 7/7) | 7/7; 7/7 | 7/7; 7/7 |
| L04a the run's root spelled through a symlink; L04b cwd through a symlink | 7/7; 7/7 | 7/7; 7/7 |
| L05a moved; L05b moved, a clone at the old path | 7/7; 7/7 | 7/7; 7/7 |
| L06 copied: the copy; then the original | 7/7; 7/7 | 7/7; 7/7 |
| **L10c copied, `GIT_DIR` + `GIT_WORK_TREE`** (the blocking): copy; original | 7/7; 7/7 | 7/7; 7/7 |
| L10e copied, `GIT_WORK_TREE` alone: copy; original | 7/7; 7/7 | 7/7; 7/7 |
| L10f copied, `GIT_DIR` alone: exit 2 as at the base (both CLIs, 7/7 each); then no variable | 7/7 | 7/7 |
| L10a both variables in place; L10d the same, moved | 7/7; 7/7 | 7/7; 7/7 |
| L13a/b/c copy around the original (both, `GIT_WORK_TREE`, none): copy; original | 7/7 ×6 | 7/7 ×6 |
| L07 linked worktree (from main: nothing to restore); L08a case-variant cwd; L09 spaces, quotes, NFD `é` | 7/7 ×3 | 7/7 ×3 |
| L11a `--separate-git-dir`; L11b `GIT_DIR` + `core.worktree`; L12 a submodule's store | 7/7 ×3 | 7/7 ×3 |
| L14a moved up one level; L14c two levels; L14d a second store at pkg/b (from B: exit 2, 7/7); L14e a store at the top | 7/7 ×4 | 7/7 ×4 |
| **L15a moved up, the repository holding a store at the old root's path** | **0/7** | **0/7** |
| **L15b moved down into a new directory named like its `pkg/`, the repository holding a store at `a/`** | **0/7** | **0/7** |
| L15c A renamed `a-old`, B renamed `a`: from `a-old` exit 2, nothing written; from `a` exit 0, nothing rescued, A left reverted (OLD, NEW at HEAD); the base CLI the same, 7/7 each | as the base | as the base |
| The base CLI on L14a, L14e, L15a, L15b (L14b, L14f, L15a-base, L15b-base) | 7/7 ×4 | 7/7 ×4 |

This round's CLI: 245 legitimate restores per runtime (35 layout restores at 7 kill points), 231
succeeded; the 14 that failed are L15a and L15b, refused with exit 2, nothing written and the
by-hand recovery. The base controls: 28 of 28 per runtime. The same harness on the earlier
rules: rule 1 (8643c2c) 203 of 203 per runtime on the 29 layouts and L14a 0/7; rule 2 (dd78e1c)
every cell 7/7 but L14e 0/7, on both runtimes (`layouts-fixed*-*.txt`, `layouts-fixed2-*.txt`).

L15a and L15b, the brief's step 2: a move that leaves the old root exactly on another store's own
directory is the edit's shape, and nothing in the lock tells them apart. Telling them apart would
take a record of the store's identity at the run (its directory's device and inode, say) in a new
lock field. Not widened. L15c reaches no rule of item 105 (`root` and `rootFromTop` agree) and
behaves as the base does. The printers in L10c (`S/out/l10c-printers.txt`, the reviewer's script)
at 410debf gave only the by-hand way; at the fix R1 offers `<S>/fixed/bin/mstack verify
--restore`, the hook `run cd <S>/fx/l10c-fixed/copy/pkg/a && <S>/fixed/bin/mstack verify
--restore`, and the restore exits 0.

## Edits to the lock

A real run in A killed with `kill -9`, B holding its own committed `x.js`, `z.js` and an
uncommitted `z.js`, then the edit (`S/scripts/edits.mjs`; `S/out/edits-narrow.txt` and
`edits-narrow-node.txt`, the same on both runtimes). **Caught, 4 of 7**, exit 2 from every store
asked, the tree outside `.git`, the lock and the run directory hashed before and after and
unchanged: `rootFromTop` to `pkg/b` with `root` left on A, the two-stores repro (from B and A);
`root` alone to B (from B and A); a top store, `rootFromTop` to `.` (from the top and A); the
repro with `GIT_DIR` and `GIT_WORK_TREE` naming the worktree (from B and A).

**Not caught, 11**, each restored from B (or B's `src/`) with exit 0, `restored 2` and the lock
gone, B's own `x.js` and its uncommitted `z.js` in the run's `rescue/`, A's `x.js` left `OLD`
with `NEW` at HEAD: `rootFromTop` to `pkg/b` with `root` B (both fields agree), A's `src/` (newly
not caught under rule 3), B's `src/`, `.` run from B's `src/`, `.` run from B's root, nothing, a
file, a directory outside the worktree, a link from outside to A; `rootFromTop` edited after the
checkout moved; the repro in a worktree git finds only through `GIT_DIR`. Rule 1 caught 6 (B's
`src/` and `.` from B's `src/` too; A's `src/` was not run on it) and rule 2 caught 5 of 7 (A's
`src/` too), each with nothing lost in what it let through (`edits-fixed.txt`,
`edits-fixed-node.txt`, `edits-fixed2.txt`).

## R to test

| R | Test | Where |
|---|---|---|
| A1 | restoreCommand per state, links absolute, relative and chained; each printer from A and B, three states, line run via sh; the gate's R25 | tests/mutation-exits.test.ts:652, tests/mutation-exits.test.ts:688, tests/mutation-gate.test.ts:143 |
| A2 | edited lock refused from both stores by the restore, gate, R1 and hook, and the top store's edit; copy with git's variables; copy around the original; under-top rule; moved up; the narrower rule; the moved checkout | tests/mutation-exits.test.ts:720, tests/mutation-exits.test.ts:817, tests/mutation-exits.test.ts:864, tests/mutation-exits.test.ts:901, tests/mutation-exits.test.ts:959, tests/mutation-exits.test.ts:984, tests/mutation-exits.test.ts:1021, tests/mutation-two-stores.test.ts:203 |
| A3 | the six tests that assert the quoted form | tests/mutation-refusals.test.ts:179, tests/mutation-exits.test.ts:563, tests/mutation-gate.test.ts:143, tests/mutation-hook.test.ts:159, tests/mutation-cli.test.ts:137, tests/mutation-cli.test.ts:281 |
| A4 | rm and gh in any case, deny and allow lists | tests/hooks.test.ts:511 |

Printed back with `bat -pp -r N:N`:

```
mutation-exits:652  test("A1 (item 105) restoreCommand offers the writer's CLI only when it can run, ...
mutation-exits:688    test(`A1 (item 105) the writer's CLI path holds ${kind}: every printer, in the lock's store ...
mutation-exits:720  test("A2 (item 105) a lock edited so its rootFromTop names another real store restores into neither, ...
mutation-exits:817  test("B1 (item 105, round 2) a checkout copied after its run died restores from the copy with GIT_DIR ...
mutation-exits:864  test("B1 (item 105, round 2) a checkout copied into the directory that holds it restores ...
mutation-exits:901  test("B1 (item 105, round 2) rootDisagrees asks only about a root under this worktree's top level: ...
mutation-exits:959  test("L14 (item 105, round 2) a checkout moved up into its parent's place, whose repository holds ...
mutation-exits:984  test("L14 (item 105, round 2) rootDisagrees under the narrower rule: only another store's own directory ...
mutation-exits:1021 test("L14e (item 105, round 2) a checkout moved up into its parent's place, in a repository with a sto...
mutation-exits:563  test("A2 from inside the git directory, where git names no top level, the hook still denies ...
mutation-gate:143   test("R25 the gate line names the lock's CLI, and the running CLI when that path is gone", () => {
mutation-two-stores:203  test("R24 the same after the whole checkout is moved", SPAWN_TEST, async () => {
mutation-refusals:179    test("R1 an existing lock is refused naming its pid", () => {
mutation-hook:159   test("R25 the deny reason names the lock's CLI", () => {
mutation-cli:137    test("R25 the run prints the lock and the absolute restore command before reverting", ...
mutation-cli:281    userTest("R15 exit 3 when the restore fails, over every other code", SPAWN_TEST, async () => {
hooks:511           test("rm and gh are matched in any case, as git is, and their arguments as each program reads them ...
```

## Mutants

All on the final code `d55c409`, an archive per mutant, bun on the five pinning files
(`mutation-exits`, `-gate`, `-two-stores`, `hooks`, `mutation-hook`; `S/scripts/mutants3.sh`,
`mutants4.sh`, `S/out/mutants3.txt`, `mutants4.txt`):

| Mutant | Fails | Result |
|---|---|---|
| N1 no store test: every root under the top placed by git (rule 1) | `:959`, `:984`, `:1021` | killed |
| N2 any store around the root (rule 2) | `:984`, `:1021` | killed |
| N3 the store test made on the root's parent | `:720`, `:901`, `:984` | killed |
| N4 no comparison of git's place with `rootFromTop` | `:984` (`<top>/pkg/./b`) | killed |
| N5 the root's git call with the caller's variables | `:864` | killed |
| X1 a relative link read from the cwd | `:652` | killed |
| X2 no check when `rootFromTop` is `.` | `:720` | killed |
| X3 one link hop | `:652` | killed |
| R1 no under-top test | `:901` (a link outside the top to B) | killed |
| R3 `GIT_WORK_TREE` kept; R4 `GIT_DIR` kept (`core.worktree` read) | `:864` | killed |
| R5 `startsWith("..")` without the slash | `:901` (the store `..b`) | killed |
| R6 the parent of `top` asked | none, 68 pass 1 skip | survived: equivalent, git's top for the parent is never a child of it |
| R7 no `root === dir` shortcut | none, 68 pass 1 skip | survived: equivalent as walked (from `dir`, git alone answers the store's own place, another top, or nothing); it saves the git call on every lock no one edited |

14 mutants (R3 and R4 share a row), 12 killed; R6 shown equivalent, R7 walked (rung 3). The rule 2 mutants of
`dd78e1c` (S1 to S4, `mutants2.txt`) and the first set on `3f3905d` (`mutants.txt`) were all
killed or the same two equivalents, on the code they mutated.

## Suites

`S/scripts/suites.sh` in the checkout at `a290cf5` (`778a509` after it changes design.md only),
HOME a new empty directory (`S/out/suites-meta.txt`; load 10.7 at the start, 21.6 at the end):

```
bun run test:bun    exit 0 (394 s): 1142 pass 3 skip 0 fail, Ran 1145 tests across 59 files
bun run test:node   exit 0 (72 s):  tests 1145, pass 1144, fail 0, skipped 1
bun run typecheck   exit 0
./bin/mstack lint-plugin .   PASSED - 0 failures, 0 warnings
node scripts/check-doc-links.mjs README.md docs/wiki/*.md   112 relative links checked, 0 broken
```

1145 is round 1's 1139 plus the six tests at the end of `tests/mutation-exits.test.ts`. Ten runs
per runtime of that file, a fixed-count `for` in an archive of `778a509` (`S/scripts/ten.sh`;
load 20.5 at the start, 10.6 at the end):

```
plain (S/out/ten-plain.txt): bun failed 0 of 10 (21 pass 1 skip 0 fail) | node failed 0 of 10 (pass 21 fail 0 skipped 1)
dash  (S/out/ten-dash.txt):  bun failed 0 of 10 (21 pass 1 skip 0 fail) | node failed 0 of 10 (pass 21 fail 0 skipped 1)
```

Dash as `sh` (`DASH=1`): `sh` first on `PATH` links to `/bin/dash`, and `/bin/dash` replaces
`/bin/sh` in `bin/mstack`'s `#!`, `src/run.ts`, `src/run-helper.mjs` and the test file (none of
its `"/bin/sh"` left), so the printed lines the tests run went through dash. 40 runs, 0 failures.
Afterwards `pgrep -fl 'mutation-holder|run-helper|mutation-run-holder'` prints nothing.

## Sentences corrected

- `design.md:188` "so no dead run restores differently": now the one shape refused, what says
  nothing, the two rules dropped and why, the three refused restores of an unedited lock
  (`GIT_DIR` alone as at the base; L15a, L15b), what a restore does after a store is renamed
  (L15c), and the measured not-caught list. Three state-table rows.
- `spec.md` R24 "THEN the lock was edited": a root under the top that is a store's own directory
  and that git, run from it alone, places elsewhere is refused; any other root MUST NOT be held
  against the lock. Scenarios added: the copied checkout with git's variables; the checkout moved
  up; a root inside a store.
- `Gates-and-Hooks.md:293`, `The-CLI.md:896` "which only an edit makes": a root that is another
  store's own directory (the edit, or a move onto one); any other root is not held against it.
- `CHANGELOG.md:14`: a lock no one edited reads as before, moved, copied, with or without the
  variables, and moved up; the exceptions are moves onto another store's own directory.
- The code comment that named L14e now states the narrower rule.

## Decision rows

`implement`: 04:50:05.843Z (the blocking fix and the from-the-root call), .883Z (inode shortcut
removed), .922Z (`GIT_DIR` alone refused as at the base), 04:59:47Z (L14 left for the
coordinator), 05:28:26Z (`..b` a store), 05:42:52Z (where the store comparison stops), 05:50:51Z
(the tests rule 3 changes). `design`, the coordinator's: 05:23:35Z (rule 2), 05:43:49Z (rule 3).
No finding was left unapplied.

## Not done

- L15a and L15b stay refused (exit 2, nothing written, the by-hand recovery). Telling a move onto
  another store's directory from the edit would take a record of the store's identity at the
  run, such as its directory's device and inode, in a new lock field; not widened, per the brief.
- `GIT_DIR` alone below the top level is refused, as at the base.
- Real runs on this host only (macOS, case-folding APFS, git 2.54, bun 1.3.11, node 26.13.1);
  mutants on bun only.
- The commits up to `69b974b` chained the lock test, `git add` and `git commit` in one Bash call
  instead of a script file; later ones went through `S/scripts/commit.sh`. The lock test was false
  before every commit.
