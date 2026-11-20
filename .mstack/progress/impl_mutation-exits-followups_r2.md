# Implementation round 2 - mutation-exits-followups (item 105)

Answers `review_mutation-exits-followups.md` (CHANGES_REQUESTED, 1 blocking, 2 non-blocking) as the
response row of 04:22:14Z takes it. Base `819c9a3`, round 1 head `410debf`, this round
`912f34f..` (last code commit `15364a4`). Scratch `S` =
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl105r2/`
(`S/scripts/`, `S/out/`); every run of the mechanism was in fixtures under `S/fx/`, from `git
archive` copies (`S/head0` = 410debf, `S/base` = 819c9a3, `S/lex` = 410debf plus the review's fix
alone, `S/fixed` = 8643c2c, whose tree is 1da388b's: the history was reworded once, below).

## What changed

`rootDisagrees` (`src/mutation-lock.ts`) asks git about a lock's `root` only when
`relative(top, root)` stays under `top`, as the response took it, and that one git call now runs
from the root alone: `placeOfDir` passes `fromCwd`, a new `GitOptions` flag in `src/git.ts` that
drops the variables `git rev-parse --local-env-vars` lists (`GIT_DIR`, `GIT_WORK_TREE`,
`GIT_INDEX_FILE`, `GIT_PREFIX`, `GIT_COMMON_DIR`, `GIT_CONFIG_PARAMETERS` and the rest). The
review's fix alone was not enough: a checkout copied into the directory that holds the original
puts the original's root under the copy's top, and git asked with the caller's `GIT_WORK_TREE`
places it in the copy (L13a, L13b: 0 of 7 at the review's fix, 7 of 7 at the base). The
device-and-inode shortcut and the directory stat around it are gone (decision row). Tests: the
three B1 tests at the end of `tests/mutation-exits.test.ts`; `:652` gains a relative link and a
two-link chain; `:720` (was `:712`) gains the edit to `.` with a store at the top. The docs say
which roots are asked about and list what is not caught, each case measured.

## Files

`src/git.ts`, `src/mutation-lock.ts`, `tests/mutation-exits.test.ts`,
`.mstack/specs/mutation-check/design.md`, `.mstack/specs/mutation-check/spec.md`,
`docs/wiki/Gates-and-Hooks.md`, `docs/wiki/The-CLI.md`, `CHANGELOG.md`, `.mstack/decisions.tsv`,
`.mstack/ledger.tsv`, `.mstack/progress/current.md`, this report.

Commits: `912f34f` test (`:652`, `:720` additions), `f05d272` fix (and the three B1 tests),
`1da388b` refactor (the inode shortcut), `15364a4` test (core.worktree variant), `b5e7164` and
`a5beaf0` docs, then this report. The fix's subject was 73 characters; `git rebase --autostash --exec
S/scripts/reword.sh 410debf` reworded it, trees identical (`git diff 8643c2c 1da388b` and `3f3905d
15364a4` empty).

## Findings

| Finding | Done | Where |
|---|---|---|
| Blocking: copied checkout, restore with `GIT_DIR` and `GIT_WORK_TREE` refused | applied, plus git run from the root alone (the review's fix leaves L13a/L13b refused) | `src/mutation-lock.ts` `rootDisagrees`, `placeOfDir`; `src/git.ts` `fromCwd`; tests `:817`, `:864`, `:901`; rows 04:50:05.843Z, .922Z |
| Non-blocking 1: the list of edits not caught | the true list, each run (below); five sentences corrected | design.md, spec.md R24 and a scenario, Gates-and-Hooks.md, The-CLI.md, CHANGELOG.md |
| Non-blocking 2: X1, X2, X3 survive | tests added; all three killed | `:652` (relative link, chain), `:720` (rootFromTop `.`) |
| Inode shortcut | removed | row 04:50:05.883Z |
| Found here: checkout moved up into its parent's place, its repository holding a directory at the old root's path | not changed; refused 7/7 at 410debf and now, restored 7/7 by the base; docs name it | row 04:59:47Z |

## The git calls added since the base

`git diff 819c9a3..HEAD -- src/` adds one: `placeOfDir(lock.root)`, `git rev-parse
--show-toplevel --show-prefix` with cwd the lock's `root`, from `rootDisagrees`, reached from
`restoreRun`, `fromLockStore` (gate, R1 in the lock's store) and `inLockStore` (hook, the
other-store refusal, gate and R1 elsewhere). `cannotRun` starts no process; the hook's changes
are regexes. `placeOf(store)` and `inLockStore`'s `findStore` + `placeOf` are the base's, inherit
the caller's variables on purpose (they define "this worktree"); with them the base restored
L10c, L10e, L13a, L13b and L14 7 of 7 each and refuses L10f (`GIT_DIR` alone) too, and this
round's code restores every layout in the table below (L14 is the exception, after it). What
the caller's variables do to the added call (`S/out/probe-env.txt`, git 2.54, cwd the root):

| Variable | Round 1 (inherited) | Now |
|---|---|---|
| `GIT_DIR` alone | the cwd is the top: `(root, .)`, never `top`, so no refusal | dropped |
| `GIT_WORK_TREE`, alone or with `GIT_DIR`, root outside it | the caller's worktree, empty prefix: refused unless rootFromTop is `.` (L10c, L10e 0/7) | not asked: root outside `top` |
| the same, root in a repository nested in it | the caller's worktree, prefix `w/pkg/a`: refused (L13a, L13b 0/7) | dropped: git finds the nested repository, another top, null |
| `GIT_INDEX_FILE`, `GIT_PREFIX` | no change to the answer | dropped |
| `GIT_CEILING_DIRECTORIES` | only makes git fail (`fatal`, null, accepted) | kept, same |

## Red first

```
S/scripts/red.sh head0: 410debf's code with this round's test file (S/out/red-head0-bun.log)
(fail) B1 ... copied after its run died ... with GIT_DIR and GIT_WORK_TREE naming the copy ...
  AssertionError: the gate, GIT_DIR and GIT_WORK_TREE: no line matched /... -> run (.+)$/m
  [fail]  the mutation lock .../copy 0 dir's "q" x/.git/mstack-mutation.lock ... -> no verify --restore takes this lock: ...
(fail) B1 ... copied into the directory that holds it ...
  AssertionError: GIT_DIR and GIT_WORK_TREE: mutation: refused: ... and its root <T>/.../top dir's "q" x/pkg/a is the store at top dir's "q" x/pkg/a in this worktree ... 2 !== 0
(fail) B1 rootDisagrees asks only about a root under this worktree's top level ...
  + `its root .../old path dir's "q" x is the store at pkg/b in this worktree, ...`  - null
 15 pass 1 skip 3 fail (bun) | node: pass 15 fail 3 skipped 1
S/scripts/red.sh lex (the review's fix alone): 17 pass 1 skip 1 fail, the same on node
(fail) B1 ... copied into the directory that holds it ...: ... its root .../top dir's "q" x/pkg/a is the store at top dir's "q" x/pkg/a in this worktree
```

X1, X2 and X3, each rebuilt in an archive and run against the new tests (`S/out/mut-*.log`):

```
X1 (self = link): A1 (item 105) restoreCommand ...  + lead: "... '.../relative link/bin/mstack', cannot run (its src/cli.ts is missing); "  - lead: ''
X3 (hops < 1):    A1 (item 105) restoreCommand ...  AssertionError: .../chain/bin/mstack
X2 (rootFromTop "." unchecked): A2 (item 105) ...  AssertionError: the top store, which the edit names: ... restored 1, tree verified, lock removed
```

Green: the same three tests at `15364a4`, 18 pass 1 skip on each runtime (`S/out/file-fix4-*.log`);
the `:652` and `:720` additions pass on 410debf's code (15 pass 1 skip, `S/out/red-c1-*.log`).

## Legitimate restores, layout by result

`S/scripts/layouts.mjs` (from the reviewer's): a fresh fixture per case whose item modifies 2
files, adds 1, deletes 1; a SIGKILL at `lock-written`, `reverted:0`, `revert-written:2`,
`obligations-running`, `restored:0`, `restore-written:2` (the head's `mutation-run-holder.ts`,
its process group killed) and a real `bin/mstack verify --mutation` killed with `kill -9` while
its check sleeps; then the layout's change and the restore as a person runs it. Good means exit 0,
lock gone, every file outside `.git` byte-identical (path, mode, SHA-256) to before the run, the
run's own `.mstack/verification.tsv` left out as the reviewer did. On
node the PATH has no bun, so the launcher, the run and the holder run node (`S/out/which-runtime.txt`).

| Layout (restore) | bun | node |
|---|---|---|
| L01 one store at the top | 7/7 | 7/7 |
| L02 a store in a subdirectory | 7/7 | 7/7 |
| L03 two stores, from A (from B: exit 2, nothing written, 7/7) | 7/7 | 7/7 |
| L03b stores at the top and at pkg/a, from A (from the top: exit 2, 7/7) | 7/7 | 7/7 |
| L04a the run's root spelled through a symlink | 7/7 | 7/7 |
| L04b cwd through a symlink | 7/7 | 7/7 |
| L05a moved; L05b moved, a clone at the old path | 7/7; 7/7 | 7/7; 7/7 |
| L06 copied: the copy; then the original | 7/7; 7/7 | 7/7; 7/7 |
| **L10c copied, `GIT_DIR` + `GIT_WORK_TREE`** (the blocking): copy; original | 7/7; 7/7 | 7/7; 7/7 |
| L10e copied, `GIT_WORK_TREE` alone: copy; original | 7/7; 7/7 | 7/7; 7/7 |
| L10f copied, `GIT_DIR` alone: exit 2 as at the base (both CLIs, 7/7 each); then no variable | 7/7 | 7/7 |
| L10a both variables in place; L10d the same, moved | 7/7; 7/7 | 7/7; 7/7 |
| L13a/b/c copy around the original (both, `GIT_WORK_TREE`, none): copy; original | 7/7 ×6 | 7/7 ×6 |
| L07 linked worktree (from main: nothing to restore) | 7/7 | 7/7 |
| L08a case-variant cwd; L09 spaces, quotes, NFD `é` | 7/7; 7/7 | 7/7; 7/7 |
| L11a `--separate-git-dir`; L11b `GIT_DIR` + `core.worktree` | 7/7; 7/7 | 7/7; 7/7 |
| L12 a submodule's store | 7/7 | 7/7 |

203 of 203 per runtime, 406 in all (`S/out/layouts-fixed-bun.txt`, `-node.txt`). At 410debf:
L10c, L10e, L13a, L13b 0/7 each; the base 7/7 each; the review's fix alone L13a, L13b 0/7
(`layouts-head0-bun-sel.txt`, `layouts-base-bun-sel.txt`, `layouts-lex-bun-sel.txt`). Not a
success: L14a, the checkout moved up into its parent's place with a tracked directory at the old
root's path, exit 2 and nothing written 7/7 here on bun and on node and at 410debf
(`layouts-fixed-bun-sel.txt`, `layouts-fixed-node-sel-l14.txt`, `layouts-head0-bun-sel-l14.txt`),
restored 7/7 by the base on each runtime (the same files).

The printers in L10c (`S/out/l10c-printers.txt`, the reviewer's script): at 410debf R1 and the
hook gave only "no verify --restore takes this lock: ... so the lock was edited" and the restore
exited 2; now R1 says `<S>/fixed/bin/mstack verify --restore puts the tree back and removes the
lock`, the hook `run cd <S>/fx/l10c-fixed/copy/pkg/a && <S>/fixed/bin/mstack verify --restore`,
and the restore exits 0 with `x.js` `NEW`.

## Edits to the lock (`S/scripts/edits.mjs`, `S/out/edits-fixed.txt`, `edits-fixed-node.txt`)

The same results on bun and on node (a PATH without bun).

A real run in A killed with `kill -9`, B holding its own committed `x.js`, `z.js` and an
uncommitted `z.js`, then the edit. Caught, 6 of 6, exit 2 from each store named with the tree, the
lock and the run directory unchanged: `rootFromTop` to `pkg/b` (the review's repro, from B and A);
`root` alone to B; `rootFromTop` to `pkg/b` with `root` B's `src/`; a top store, `rootFromTop` to
`.` (from the top and A); `root` `.` from B's `src/`; the repro with `GIT_DIR` and `GIT_WORK_TREE`
naming the worktree. Not caught, 8, each from B: exit 0, `restored 2`, lock gone, rescued
`["B's own x\n","B's uncommitted z\n"]`, A's `x.js` `OLD` with `NEW` at HEAD: both fields to agree;
`rootFromTop` edited after a move; `root` naming nothing, a file, a directory outside the worktree,
a link from outside it to A; `root` `.` from B's root; the repro in a worktree git finds only
through `GIT_DIR`. At 410debf the link and the `GIT_DIR`-only case were caught (exit 2,
`edits-head0.txt`): those two are what this fix gives up.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | restoreCommand per state, links absolute, relative and chained; each printer from A and B, three states, line run via sh; the gate's R25 | tests/mutation-exits.test.ts:652, tests/mutation-exits.test.ts:688, tests/mutation-gate.test.ts:143 |
| A2 | edited lock refused from B and A by the restore, gate, R1 and hook, and the top store's edit; copied checkout with git's variables; copy around the original; the under-top rule; the moved checkout | tests/mutation-exits.test.ts:720, tests/mutation-exits.test.ts:817, tests/mutation-exits.test.ts:864, tests/mutation-exits.test.ts:901, tests/mutation-two-stores.test.ts:203 |
| A3 | the six tests that assert the quoted form | tests/mutation-refusals.test.ts:179, tests/mutation-exits.test.ts:563, tests/mutation-gate.test.ts:143, tests/mutation-hook.test.ts:159, tests/mutation-cli.test.ts:137, tests/mutation-cli.test.ts:281 |
| A4 | rm and gh in any case, deny and allow lists | tests/hooks.test.ts:511 |

Printed back with `bat -pp -r N:N`:

```
mutation-exits:652  test("A1 (item 105) restoreCommand offers the writer's CLI only when it can run, ...
mutation-exits:688    test(`A1 (item 105) the writer's CLI path holds ${kind}: every printer, ...
mutation-exits:720  test("A2 (item 105) a lock edited so its rootFromTop names another real store restores into neither, ...
mutation-exits:817  test("B1 (item 105, round 2) a checkout copied after its run died restores from the copy with GIT_DIR ...
mutation-exits:864  test("B1 (item 105, round 2) a checkout copied into the directory that holds it restores ...
mutation-exits:901  test("B1 (item 105, round 2) rootDisagrees asks only about a root under this worktree's top level: ...
mutation-exits:563  test("A2 from inside the git directory, where git names no top level, the hook still denies ...
mutation-gate:143   test("R25 the gate line names the lock's CLI, and the running CLI when that path is gone", () => {
mutation-two-stores:203  test("R24 the same after the whole checkout is moved", SPAWN_TEST, async () => {
mutation-refusals:179    test("R1 an existing lock is refused naming its pid", () => {
mutation-hook:159   test("R25 the deny reason names the lock's CLI", () => {
mutation-cli:137    test("R25 the run prints the lock and the absolute restore command before reverting", ...
mutation-cli:281    userTest("R15 exit 3 when the restore fails, over every other code", SPAWN_TEST, async () => {
hooks:511           test("rm and gh are matched in any case, as git is, and their arguments as each program reads them (item 105)", ...
```

## Mutants

`S/scripts/mutants.sh 3f3905d` (tree of `15364a4`): an archive per mutant, bun on the five pinning
files (`mutation-exits`, `-gate`, `-two-stores`, `hooks`, `mutation-hook`), `S/out/mutants.txt`.

| Mutant | Fails | Result |
|---|---|---|
| X1 a relative link read from the cwd | `:652` | killed |
| X2 no check when rootFromTop is `.` | `:720` | killed |
| X3 one link hop | `:652` | killed |
| R1 no under-top test (every root asked) | `:901` | killed |
| R2 the root's git call with the caller's variables | `:864` | killed |
| R3 `GIT_WORK_TREE` kept | `:864` | killed |
| R4 `GIT_DIR` kept (`core.worktree` read) | `:864` | killed |
| R5 `startsWith("..")` without the slash | `:901` (`..b`) | killed |
| R6 the parent of `top` asked of git | none, 65 pass 1 skip | survived: equivalent, git's top for the parent is never a child of it |
| R7 no `root === dir` shortcut | none, 65 pass 1 skip | survived: equivalent as walked (from `dir`, git alone answers the store's own place, another top, or nothing); it saves the git call on every lock no one edited (round 1 code) |

8 of 10 killed; the 2 survivors are equivalent (R6 shown, R7 walked: rung 3, not run). The inode shortcut is gone, so the review's M2b
has nothing left to mutate.

## Suites

`S/scripts/suites.sh` in the checkout at `b5e7164` (`a5beaf0` after it changes design.md only),
HOME a new empty directory (`S/out/suites-meta.txt`; load 8.2 at the start, 21.8 at the end):

```
bun run test:bun    exit 0 (382 s): 1139 pass 3 skip 0 fail, Ran 1142 tests across 59 files
bun run test:node   exit 0 (72 s):  tests 1142, pass 1141, fail 0, skipped 1
bun run typecheck   exit 0
./bin/mstack lint-plugin .   PASSED - 0 failures, 0 warnings
node scripts/check-doc-links.mjs README.md docs/wiki/*.md   112 relative links checked, 0 broken
```

1142 is round 1's 1139 plus the three B1 tests. Each commit of the round typechecks in its own
archive (`S/out/per-commit.txt`), and its tests passed as committed: `912f34f` on 410debf's code
(`red-c1`), `f05d272` and `1da388b` the five pinning files 65 pass 1 skip per runtime
(`file-fix2`, `file-fix3`), `15364a4` (`file-fix4`). Ten runs per runtime of the one changed test
file, `tests/mutation-exits.test.ts`, a fixed-count `for` in an archive of `a5beaf0`
(`S/scripts/ten.sh`; load 17.6 at the start, 11.0 at the end):

```
plain (S/out/ten-plain.txt): bun failed 0 of 10 (18 pass 1 skip 0 fail) | node failed 0 of 10 (pass 18 fail 0 skipped 1)
dash  (S/out/ten-dash.txt):  bun failed 0 of 10 (18 pass 1 skip 0 fail) | node failed 0 of 10 (pass 18 fail 0 skipped 1)
```

Dash as `sh` (`DASH=1`): `sh` first on `PATH` links to `/bin/dash`, and `/bin/dash` replaces
`/bin/sh` in `bin/mstack`'s `#!`, `src/run.ts`, `src/run-helper.mjs` and the test file (none of its
four `"/bin/sh"` left), so the B1 test's printed gate line ran under dash. 40 runs, 0 failures.
After the runs `pgrep -fl 'mutation-holder|run-helper|mutation-run-holder'` prints nothing.

## Sentences corrected

- `design.md:188` "so no dead run restores differently" now: a lock no one edited restored in
  every layout measured but two (`GIT_DIR` alone, refused as at the base; the moved-up checkout),
  and the true list of what is not caught. `design.md:189`'s list replaced by the eight measured
  cases. Two state-table rows.
- `spec.md:696` R24 "THEN the lock was edited": now git run from the root alone, a root under
  the top level, "no restore can tell whose the lock is (an edit makes that, and so does a
  checkout moved up ...)", and a root outside the top MUST NOT be held against the lock. New
  scenario: a copied checkout restored with git's variables.
- `Gates-and-Hooks.md:293`, `The-CLI.md:896` "which only an edit makes": an edit, or the moved-up
  checkout; a root outside the top, or in another repository, is not held against the lock
  whatever `GIT_DIR` and `GIT_WORK_TREE` say.
- `CHANGELOG.md:14` "A lock no one edited reads as before": adds moved or copied, with or without
  the variables, and names the one exception measured.

## Decision rows

04:50:05.843Z blocking applied with the from-the-root git call; 04:50:05.883Z the inode shortcut
removed; 04:50:05.922Z `GIT_DIR` alone stays refused as at the base; 04:59:47Z the moved-up
checkout not changed. No finding was left unapplied.

## Not done

- The moved-up checkout (L14) stays refused: fixing it means asking about the store a restore
  would find from `root` (`findStore`), which also stops catching `root` edited into the named
  store's subdirectory; the row leaves that to the coordinator.
- `GIT_DIR` alone below the top level is refused, as at the base.
- Rung: real runs and restores on this host (macOS, case-folding APFS, git 2.54, bun 1.3.11,
  node 26.13.1); not on Linux, not on a second host. The mutants ran on bun only; the layouts,
  L14 and the edit cases on both runtimes.
- The commits of this round were made with the lock test, `git add` and `git commit` chained in
  one Bash call each, not from a script file; the lock test was false before every one.
