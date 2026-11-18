# Review - item-fields-base-size, round 2

**Verdict:** APPROVED

Reviewed head `b0a3d580577bf221ff80ced3440396735c51b319` against round 1's head `61e6b7a` (the round 2
diff `git diff 61e6b7a..b0a3d58 -- src tests docs CHANGELOG.md`), alone, no lens. Every CLI call was
`./bin/mstack` (`mstack 0.2.1 at /Users/romerma/Code/mstack`). Every probe ran in throwaway repositories
under the session scratchpad (`.../scratchpad/review40r2/`, shortened to `r2/` below), from script files,
with `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_NOSYSTEM=1`. Remotes are local bare repositories,
fetched and pushed with real git. In this checkout I ran only the suites, read-only CLI commands,
`git log`/`diff`/`show`, this file and the one ledger row.

Round 1's blocking finding is fixed: the rebase repro and the merge variant are both green with
`10 lines in 1 file`, and the line names the commit it measured from. The rule is right on every
case in mstack's normal flow that I ran (one item per branch from the default branch, `origin` as
the canonical remote, rebase or merge, local `main` stale or deleted, detached, linked worktree,
shallow clone). The cases it gets wrong are all off that flow, and the wiki states them. Nothing
is blocking. Nine non-blocking findings are below.

## Blocking

None.

## 1. The blocking finding, re-run (`bash r2/check1.sh`, `r2/check1.txt`)

This is round 1's repro unchanged: the store is committed, the 10-line `fix.ts` is on `feat/one`,
and five 40-line files land on `main`.

```
=== round 1 repro, then git rebase
  base: (unset) -> "9d2657f98fcda09ce09ac22388e2a30f6d19ea5f"
$ mstack gate   # before
[ok]    one is size s: 10 lines in 1 file of code since 9d2657f9, within 60 lines and 3 files
main tip: bdd1339b; base: base: 9d2657f98fcda09ce09ac22388e2a30f6d19ea5f
$ git rebase main && mstack gate
[ok]    one is size s: 10 lines in 1 file of code since bdd1339b (where this branch left main; base 9d2657f9 is older), within 60 lines and 3 files
gate exit 0
=== round 1 repro, then git merge
  base: (unset) -> "8b8623b821b3257c57a96bb5c915219969a836c4"
$ mstack gate   # before
[ok]    one is size s: 10 lines in 1 file of code since 8b8623b8, within 60 lines and 3 files
main tip: 3915c8f9; base: base: 8b8623b821b3257c57a96bb5c915219969a836c4
$ git merge main && mstack gate
[ok]    one is size s: 10 lines in 1 file of code since 3915c8f9 (where this branch left main; base 8b8623b8 is older), within 60 lines and 3 files
gate exit 0
```

Closed. The commit named is `main`'s tip, which is where the branch now leaves `main`.

## 2. The rule, case by case (`r2/check2.sh`, `r2/check2b.sh`, `r2/check2c.sh` and their `.txt`)

Each case is a fresh repository with a 10-line `fix.ts` as the item's work, unless the row says
otherwise. "Other work" is five 40-line files (200 lines). After a `[fail]` line, my helper printed
`(no size line)`. That is an artifact of `pipefail` on the gate's exit 1, not gate output, and it is
left out below.

| Case | Line the gate printed | The item's own work? |
|---|---|---|
| A. main moved, not brought in | `[ok] one is size s: 10 lines in 1 file of code since 09110469, within 60 lines and 3 files` | yes |
| B1. stacked: child of `parent` (4x40 lines), base = parent tip | `[ok] ... 10 lines in 1 file of code since ac982c18, within ...` | yes |
| B3b. stacked, main moved, `git rebase --onto main parent` | `[ok] ... 10 lines in 1 file of code since 83e53713 (where this branch left main; base 219dc26c is not in this branch's history), within ...` | yes |
| B4. parent merged into main (merge commit), child `git rebase main` | `[ok] ... 10 lines in 1 file of code since 171429af (where this branch left main; base 40a9befe is older), within ...` | yes |
| B3a. stacked, parent unmerged, child `git rebase main` | `[fail] 1 one (in_progress) is size s but its code diff from 8b70748f (where this branch left main; base dd7eb5b5 is not in this branch's history) is 170 lines in 5 files, ...` / `fix: it is not small: 'mstack state set one --size m' (or split the work)` | no: the parent's 160 lines were replayed onto the branch (non-blocking 3) |
| B2'. stacked, main moved, child merges main | `[fail] 1 one (in_progress) is size s but its code diff from a0436761 is 210 lines in 6 files, ...` / `fix: it is not small: ... --size m` | no: the decision 4 shape (point 3) |
| C1. 61 lines committed straight onto main | `[fail] 1 one (in_progress) is size s but its code diff from db8cd4c9 is 61 lines in 1 file, ...` | yes |
| C2. on main, 10-line fix, then `git pull --rebase` brings 200 lines | `[fail] ... its code diff from db8cd4c9 is 210 lines in 6 files, ...` | no, but this is the design: row 214 says "On the default branch itself the base is used", and the gate already warns `on main; feature work belongs on its own branch` |
| D1. base is a branch commit (5 lines before the item), rebase onto moved main | `[ok] ... 15 lines in 2 files of code since 9af66809 (where this branch left main; base 2051ef33 is not in this branch's history), within ...` | nearly: the 5 pre-item lines count (non-blocking 3) |
| D2. base is a local unpushed commit on main, `git pull --rebase` rewrites it | `[fail] 1 one (in_progress) is size s but its base 1be6ec53 is not in this branch's history (a rebase rewrites it), and there is no point where the branch left main to measure from instead` / `fix: 'mstack state set one --base <commit>' names the commit the item's work starts after` | honest refusal, and the fix is actionable |
| D3. base rewritten, branch `trunk`, no main or origin | same `[fail] ... its base 0abb80c3 is not in this branch's history ...` with the `--base` fix | honest refusal |
| E. no main, no master, no `origin/HEAD` (`trunk`), trunk merged in | `[fail] ... its code diff from 218df45f is 210 lines in 6 files, ...` | no. The wiki documents it ("where no default branch exists"), and the test at line 655 pins it |
| F. only `origin/main` (local `main` deleted), `git fetch && git rebase origin/main` | `[ok] ... 10 lines in 1 file of code since bd956cc3 (where this branch left main; base da82d8d9 is older), within ...` | yes |
| G. `git fetch && git rebase origin/main`, local `main` left at `da82d8d9`, `origin/main` `7846d544` | `[ok] ... 10 lines in 1 file of code since 7846d544 (where this branch left main; base da82d8d9 is older), within ...` | yes |
| G'. `git fetch && git merge origin/main` | `[ok] ... 10 lines in 1 file of code since 5b54125d (where this branch left main; base 89688b32 is older), within ...` | yes |
| G''. "Update branch" simulated (merge pushed from a second clone), then bare `git pull` | `[ok] ... 10 lines in 1 file of code since e8c2102f (where this branch left main; base 67d572c0 is older), within ...` | yes |
| G'''. the same, then `git pull origin feat/one` (`origin/main` not refreshed) | `[fail] ... its code diff from 7ffa5179 is 210 lines in 6 files, ...` / `--size m` | no (non-blocking 2) |
| K. `git pull --rebase origin main` on the branch | `[ok] ... 10 lines in 1 file of code since a134c566 (where this branch left main; base b9b724a1 is older), within ...` | yes |
| L. fork layout (`origin` = own fork, `upstream` = canonical), `git fetch upstream && git rebase upstream/main` | `[fail] ... its code diff from 98bfac7a is 210 lines in 6 files, ...` / `--size m` | no (non-blocking 2) |
| H. detached HEAD after a rebase onto moved main | `[ok] ... 10 lines in 1 file of code since 85abbe1f (where this branch left main; base ede40519 is older), within ...` | yes |
| H'. detached at main's tip, item started and committed detached | `[ok] ... 10 lines in 1 file of code since ede40519, within ...` | yes |
| I. linked worktree from `mstack worktree new one --base main`, store committed, main moves, rebase in the worktree | before: `[ok] ... 10 lines in 1 file of code since 8dab79e8, ...`; after: `[ok] ... 10 lines in 1 file of code since 6d8d2257 (where this branch left main; base 8dab79e8 is older), within ...` | yes. The worktree was removed afterwards |
| J. shallow clone (`--depth 1`), `git fetch --depth 1 && git rebase origin/main` | before: `[ok] ... since 8b99ad1b`; after: `[ok] ... 10 lines in 1 file of code since b5d62dd7 (where this branch left main; base 8b99ad1b is not in this branch's history), within ...` | yes. A merge in that clone is refused by git (`refusing to merge unrelated histories`), so there is nothing to measure |
| N. orphan branch, unborn and after its first commit | both times `[fail] ... its base 3eeb76f7 is not in this branch's history (a rebase rewrites it), and there is no point where the branch left main ...` with the `--base` fix | honest refusal. The "(a rebase rewrites it)" guess is wrong here, but harmless |

**Decision 1 (the local ref and `origin/<name>` together, against the brief's "prefer local"):**
the rebuttal holds. `git merge-base HEAD A B` computes the merge base of HEAD with a hypothetical
merge of A and B, so when one ref contains the other it picks the later point along HEAD's history.
It never moves the start earlier than the local ref alone would. Cases G, F, G'' and K are right
because of it. Under my mutant R5 (`--octopus`, which takes the older point), the test at line 568
goes red. I found no case where the pair gives a worse answer than the local ref alone. The one
where it changes nothing is C2: on `main`, the local ref is HEAD, so the start is always `base`,
which is the design's intent. I accept the deviation.

## 3. The limit the implementer documented (decision 4) (`bash r2/check3.sh`, `r2/check3.txt`)

Reproduced:

```
=== decision 4: base is a commit on the branch (earlier branch work), then main is merged in
  base: (unset) -> "b7d73a98f133a36a12c1b9118873e1067152d549"
$ mstack gate   # before the merge
[ok]    one is size s: 10 lines in 1 file of code since b7d73a98, within 60 lines and 3 files
$ git merge main && mstack gate
[fail]  1 one (in_progress) is size s but its code diff from b7d73a98 is 210 lines in 6 files, over the limits of 60 lines and 3 files
        fix: it is not small: 'mstack state set one --size m' (or split the work)
gate exit 1
=== decision 4 via a second item on a branch whose first item was squash-merged
  base: (unset) -> "920acfcb4181d3b3b9f0b11d3c66f09d425aaab9"
$ git merge main && mstack gate
[fail]  1 two (in_progress) is size s but its code diff from 920acfcb is 210 lines in 6 files, over the limits of 60 lines and 3 files
        fix: it is not small: 'mstack state set two --size m' (or split the work)
--- the same branch, rebased instead of merged
$ git rebase main && mstack gate
[ok]    two is size s: 10 lines in 1 file of code since db1febf5 (where this branch left main; base 920acfcb is not in this branch's history), within 60 lines and 3 files
```

My judgement is that this is **non-blocking**.

- **Who hits it.** Someone who starts an item on a branch that already carries commits not
  reachable from `main`, then merges `main` in rather than rebasing. The earlier commits can be an
  earlier item, unmerged or squash-merged (the second run above), or a parent branch (case B2' in
  point 2). That is outside mstack's flow of one item per branch from the default branch.
  `worktree new` branches from `origin/main` by default. Also, nothing assigns size `s` yet: the
  CHANGELOG says "Nothing in the intake or the skills chooses a size yet". So today only someone who
  typed `--size s` by hand can meet it. A rebase recovers the squash case, as the run above shows.
- **The docs.** The red line reads "code diff from ...". The place to look for it is the "size s"
  bullet of `docs/wiki/Gates-and-Hooks.md`. Lines 220-224 there say "Everywhere else it measures
  from `base`: ... and where `base` is a commit of the branch's own and `main` was merged in after
  it, in which case the merged commits do count". That is true, and the probe above shows it.
  `docs/wiki/The-CLI.md:310-317` refers to that bullet for "the full rule". The CHANGELOG does not
  state the limit (non-blocking 8).
- **Whether the red line misleads.** Partly. Its first half is literally true: it names the base
  and the diff from it. But it carries no note that `main` was merged in after the base, unlike the
  `(where this branch left main; ...)` note the other cases get. And its fix, "it is not small",
  states something false about a 10-line change. A reader who trusts the fix line re-sizes the item.
  That is the same wrong advice round 1 blocked on, now on an off-flow case.
- **The follow-up to file.** The case can be detected cheaply: the base is in HEAD's history, a
  fork point exists, and neither commit is an ancestor of the other. One fix is to measure from
  `git merge-tree --write-tree <base> <fork>`. That gives the tree of base with `main` merged in,
  and `git diff --numstat <tree>` compares it with the working tree. I tried it on both shapes
  (`bash r2/followup-probe.sh`, git 2.54.0):

  ```
  == d4: base b7d73a98, fork e82c4706, merge-tree 2034dcdf1f3e31e041a80bd1c30e3589f2db9e2a
  10	0	fix.ts
  == B2b: base a0436761, fork b4addef5, merge-tree 1a651bf94ec8b6724ea9fa823a7defd97e222bcb
  10	0	fix.ts
  ```

  In the other cases it gives the same answer as the current rule: when base is an ancestor of the
  fork point, the result is the fork point's tree, and on a stacked branch it is base's tree. It
  needs git 2.38 or later and a fallback when the merge conflicts. At the least, the line should
  carry a note for this shape, and its fix should not claim that the item is big.

## 4. Scope to the store root (`bash r2/check4.sh`, `r2/check4.txt`)

The layout is a monorepo with the store in `pkg/app`. The base commit holds `pkg/app/src/a.ts`
(20 lines), `top.ts`, `pkg/other/o.ts` and `pkg/app/tests/y.ts`.

```
--- nothing changed yet
[ok]    one is size s: 0 lines in 0 files of code since dfbce3bd, within 60 lines and 3 files
--- inside: tracked edit +10 (a.ts), untracked 15 (u.ts); outside: tracked top.ts +280, untracked other.ts 500, pkg/other/o.ts deleted
[ok]    one is size s: 25 lines in 2 files of code since dfbce3bd, within 60 lines and 3 files
--- the same, committed (the outside changes too)
[ok]    one is size s: 25 lines in 2 files of code since dfbce3bd, within 60 lines and 3 files
--- tests under pkg/app/tests: y.ts edited +290, x.ts untracked 500 (expect not counted)
[ok]    one is size s: 25 lines in 2 files of code since dfbce3bd, within 60 lines and 3 files
--- ... .mstack/junk.ts 200 lines
[ok]    one is size s: 25 lines in 2 files of code since dfbce3bd, within 60 lines and 3 files
--- run from pkg/app/src (a sub-directory of the store root)
[ok]    one is size s: 25 lines in 2 files of code since dfbce3bd, within 60 lines and 3 files
=== store reached through a symlink: monolink -> mono
pwd: monolink/pkg/app; pwd -P: mono/pkg/app
[ok]    one is size s: 25 lines in 2 files of code since dfbce3bd, within 60 lines and 3 files
--- the store root directory itself is a symlink: .../applink -> mono/pkg/app
[ok]    one is size s: 25 lines in 2 files of code since dfbce3bd, within 60 lines and 3 files
```

Tracked and untracked changes are treated alike, inside and outside the store root, committed or
not. `pkg/app/tests/x.ts` is a test. `.mstack/junk.ts` is excluded, including through both symlinks.
Round 1's non-blocking 2 is closed. The sentences are true: `Gates-and-Hooks.md:193-197` ("It lists
the paths under the store's root ... so a store in `pkg/app` of a monorepo measures `pkg/app` alone
and `pkg/app/tests/` holds tests") and `The-CLI.md:314-316` ("It measures only what lies under the
directory that holds `.mstack/`, with paths read relative to it ...").

## 5. Unparseable numstat (decision 2), and the rename pin

**The seam is honest.** `withNumstat` (`tests/item-size-base.test.ts`, above line 760) puts a
`#!/bin/sh` git first on `PATH`. For a call whose arguments include `--numstat` it prints the fixed
record and exits. Every other call (`ls-files`, `rev-parse`, `merge-base`) is `exec`ed to the real
git found by `command -v git`. The record is git's own, byte for byte. `bash r2/check5.sh`, a pure
`git mv`:

```
git diff --numstat -z -M HEAD (bytes, od -c):
0000000    0  \t   0  \t  \0   s   r   c   /   o   l   d   .   t   s  \0
0000020    s   r   c   /   n   e   w   .   t   s  \0
```

The test proves the stand-in was used, because it asserts `null` under it and `{ lines: 5, files: 1 }`
with the real git afterwards. And with the guard removed, the stand-in's output reaches the parser
(R4 below, red on both runtimes).

**It cannot leak.**
- It changes `process.env.PATH` of the test process only, and restores it and removes its
  directory in a `finally`.
- Tests within a file run one at a time on both runners. Neither the file nor the `package.json`
  scripts set any concurrency.
- `node --test` runs each file in its own process, and bun runs the files one after another.
- After both full suites: `PATH has no stand-in after the suite: 0` and
  `stand-in dirs left in the test tmpdir: 0`.
- Nothing reaches a user's shell.

**The rename pin.** Through the CLI (`r2/check2c.txt`, case M), a pure `git mv` of a 31-line file
gives `[fail] 1 one (in_progress) is size s but its code diff from 044d267e is 62 lines in 2 files`.
The wiki's "a renamed file is one file deleted and one added" is true.

## 6. Tests and mutants

**The 15 new tests.** These are the 13 gate tests at lines 538-760 and the read-error test at
line 149 (run under node and under bun). Each asserts the concrete line or failure, including the
commit named and the parenthetical. None asserts only that nothing threw. No existing test was
weakened: `git diff 61e6b7a..b0a3d58 -- tests` only adds lines, apart from the import block.

**Mutants.** I ran them in a scratch clone of `b0a3d58` (`r2/mut`, `git clone --no-hardlinks`; no
worktree of this checkout), with `node r2/mutants.mjs r2/mut bun`. Each mutant was checked to match
exactly once and was restored after its run, and the run ended with
`clone restored (git status clean)`.

| Mutant | Result | Red lines |
|---|---|---|
| R1 (impl M5) `!isAncestor(store, base, "HEAD")` inverted | 24 fail | `(fail) exactly 60 changed lines in exactly 3 code files passes` ... `(fail) after a rebase onto a main that moved, only the branch's own lines count, from where it left main` ... `(fail) a numstat record whose counts do not parse makes the diff unmeasurable, and the gate fails`, `(fail) mstack gate exits 1 over the limit and prints the [fail] line, then 0 once the item is size m` (24 lines, `r2/mutants-bun.txt`) |
| R2 (impl M4) `isAncestor(store, base, fork)` -> `(store, fork, base)` | 4 fail | `(fail) after a rebase onto a main that moved, ...`, `(fail) after main is merged into the branch, ...`, `(fail) after a fetch and a rebase onto origin/main, a local main left behind does not hold the start back`, `(fail) a branch stacked on another is measured from its base, so the parent branch's work does not count` |
| R3 (impl M11) `--relative` removed | 2 fail (bun and node) | `(fail) a store in a sub-directory measures that directory only, tracked and untracked alike`, `(fail) in a sub-directory store, paths are classified from the store's root, so its tests/ holds tests` |
| R4 (impl M13) NaN guard removed | 1 fail (bun and node) | `(fail) a numstat record whose counts do not parse makes the diff unmeasurable, and the gate fails`; node: `✖ a numstat record whose counts do not parse ...` |
| R5 (mine) `merge-base --octopus HEAD ...refs` (the older point) | 1 fail | `(fail) after a fetch and a rebase onto origin/main, a local main left behind does not hold the start back` |
| R6 (mine) the guard checks `ins` only | **survived**, 64 pass | none (non-blocking 5) |

The counts for R1 to R4 match the implementer's table (M5 24, M4 4, M11 2, M13 1).

**Timing** (`bash r2/timing.sh bun|node`, five runs each; per-test times from bun's junit reporter
and node's spec reporter):

```
bun run 1: tests 64 failures 0 total 20.57766s; slowest 0.939s "size m, size l, an absent size, an item with no base and an inactive item are not measured"; 2nd 0.928s "a base a rebase rewrote, with no fork point to use, fails with a fix that names --base"
bun run 2: ... total 20.63887s; slowest 0.953s (same test); 2nd 0.929s
bun run 3: ... total 20.612319s; slowest 0.960s; 2nd 0.923s
bun run 4: ... total 20.58456s; slowest 0.954s; 2nd 0.936s
bun run 5: ... total 20.583637s; slowest 0.954s; 2nd 0.933s
node run 1: ℹ tests 64, ℹ fail 0, ℹ duration_ms 21009.257083; slowest 0.978s (same test); 2nd 0.951s "a base a rebase rewrote, with no fork point to use, ..."
node run 2: ... duration_ms 20801.1445; slowest 0.962s; 2nd 0.944s
node run 3: ... duration_ms 20845.3915; slowest 0.988s; 2nd 0.938s
node run 4: ... duration_ms 20957.50525; slowest 0.995s; 2nd 0.945s
node run 5: ... duration_ms 20840.963; slowest 0.966s; 2nd 0.935s
```

The slowest test is under 1 s every time, against bun's 5 s default, and the file sets 60 s and
120 s explicitly. The run times are stable to within 0.1 s on bun and 0.2 s on node.

**Isolation** (`bash r2/isolated.sh`):

```
$ env HOME=<empty> GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 bun test tests/item-size-base.test.ts
 64 pass
 0 fail
Ran 64 tests across 1 file. [21.22s]
$ env HOME=<empty> GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 node ... --test tests/item-size-base.test.ts
ℹ tests 64
ℹ pass 64
ℹ fail 0
$ node 22.6.0 --experimental-strip-types --test tests/item-size-base.test.ts
# tests 64
# pass 64
# fail 0
```

**Every round 2 commit is green on its own**, for `tests/item-size-base.test.ts` together with
`tests/gate.test.ts` under bun (`bash r2/percommit.sh`): `c6acc67` 136 pass, `57cd592` 138,
`6adec63` 140, `2956e23` 142, `8f0c47f` 142, `ffdfdca` 142 and `9853fd9` 142, with 0 fail at each.
The report's claim holds for those two files. I did not run the whole suite at each commit.

## 7. Docs truth

Each sentence the round changed, checked against a run:

- `Gates-and-Hooks.md:193-197`, the scope to the store root: true (point 4).
- `:198-200`, "a renamed file is one file deleted and one added": true (case M).
- `:203-204`, "A diff record the check cannot read fails the check rather than counting as
  nothing": the "fails" part is true (R4, and the test). "Counting as nothing" is loose; see
  non-blocking 8.
- `:212-216`, measuring from the fork point when `base` is no later than it, "so a `git rebase main`
  ... or a merge of `main` into the branch, adds nothing": true (point 1; cases G', G'', H, I and K).
- `:216-218`, "The default branch is the one `origin/HEAD` names, else `main`, else `master`; its
  local branch and its `origin/` copy both count": matches `defaultBranch` (`src/git.ts:82-89`) and
  `forkPoint` (`src/size.ts:92-98`), and it is true (cases F and G).
- `:218-220`, a rewritten base is replaced, and without a fork point the check fails naming
  `--base`: true (cases D1, D2, D3, J and N).
- `:220-224`, the "Everywhere else" list: each clause is true. The default branch is C1 and C2, the
  stacked branch is B1, no default branch is E, and the branch-internal base with a merge is point 3.
- `:224-225`, "The line names the commit it measured from and says when that is not the base": true.
- `:227-231`, the pasted line: my run of the same steps printed
  `[ok]    one is size s: 10 lines in 1 file of code since bdd1339b (where this branch left main; base 9d2657f9 is older), within 60 lines and 3 files`.
  That is identical to the page except for the two shas. The page's shas (`c4557de9`, `b27f89b7`)
  are in the implementer's `impl40r2/repro-after.txt:6,11`.
- `The-CLI.md:310-317`: every claim is true within its stated condition (points 1, 2 and 4). It
  sends the reader to the wiki for the exceptions.
- `CHANGELOG.md:12-27`: true within its conditions. It does not state the decision 4 limit
  (non-blocking 8). Its "a base git cannot find, or a rewritten base with no point to replace it,
  fails with a fix naming `--base`" is true (D2, D3).

I found no false statement.

## 8. Acceptance, quoted (`bash r2/check8.sh`, `r2/check8.txt`)

**"size s|m|l is accepted by state add and state set, clearable (absent means m), and an invalid
value is refused rather than dropped"**: met.

```
$ mstack state add --slug one --title T --acceptance x --size s
added 1 one (pending)
$ mstack state set one --size l
  size: "s" -> "l"
$ mstack state set one --clear size
  size: "l" -> (unset)
$ mstack state set one --size xl
mstack: 'xl' is not a size
        the sizes are s, m or l; nothing was written
(exit 2)
state.json byte-identical after the refusal
```

The new test at line 149 pins a hand-written `"size": "xl"` as a read error. `DEFAULT_SIZE` is
gone: `rg -n DEFAULT_SIZE src tests docs CHANGELOG.md` finds nothing.

**"base is recorded automatically on the first move to in_progress only, editable with --base, and
refused by --clear"**: met.

```
HEAD 9fd0c4b0df41f31438b2845c06ad2f135867ee2b
$ mstack state set one --status in_progress
  base: (unset) -> "9fd0c4b0df41f31438b2845c06ad2f135867ee2b"
$ mstack state set one --status reviewing
  status: "in_progress" -> "reviewing"
$ mstack state set one --status in_progress      # after one more commit: no base line
  status: "reviewing" -> "in_progress"
$ mstack state set one --base HEAD
  base: "9fd0c4b0df41f31438b2845c06ad2f135867ee2b" -> "76f4d9f7813a0aa97725daf4d54201a1abf67f63"
$ mstack state set one --clear base
mstack: base cannot be cleared
(exit 2)
state.json byte-identical after the refusal
```

**"The gate fails an item with base and size s whose code diff from base exceeds 60 lines or 3
files, and sdd with size s is refused"**: met.

```
[fail]  1 one (in_progress) is size s but its code diff from 9fd0c4b0 is 61 lines in 1 file, over the limits of 60 lines and 3 files
(gate exit 1)
[fail]  1 one (in_progress) is size s but its code diff from 9fd0c4b0 is 4 lines in 4 files, over the limits of 60 lines and 3 files
$ mstack state set one --sdd
mstack: sdd and size s cannot go together: ...; nothing was written
(exit 2)
$ mstack state add --slug two --title T --acceptance x --size s --sdd
(exit 2)
state.json byte-identical after both refusals
```

Read literally, "code diff from base" no longer describes the rebase and merge cases: there the
diff from `base` is 210 lines and the gate passes. That is the round 1 fix, decided in design row
214. I read the criterion as "the item's code diff since it started", which is what round 1 asked
for. See non-blocking 7.

## 9. Suite, at `b0a3d58` in this checkout

```
$ npm run typecheck >/dev/null 2>&1; echo "typecheck exit $?"
typecheck exit 0
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate
PASSED - 0 failures, 0 warnings
$ npm run test:bun
 698 pass
 0 fail
Ran 698 tests across 29 files. [135.86s]
$ npm run test:node
ℹ tests 698
ℹ pass 698
ℹ fail 0
ℹ cancelled 0
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
98 relative links checked, 0 broken
$ ./bin/mstack ledger check item-fields-base-size      # before this row
FAIL no verdict at b0a3d580; 3 row(s) exist at other SHAs and a new head SHA voids them
```

No test failed. The gate ran with item 40 at `reviewing`, with a base and no size, so the size check
did not run on this store.

## The round's other rebuttals, judged

- **Decision 1** (both refs): it holds; see point 2.
- **Decision 2** (the stand-in git): it holds; see point 5.
- **Decision 3** (the wording): it holds. A fork point equal to the base reads as the base: case A,
  and H' prints `since ede40519` with no parenthetical. The "lost" line names `--base`.
- **Decision 4** (branch-internal base): accepted as non-blocking; see point 3.
- **"Findings not applied"**: these are the round 1 items the brief left out of scope. None is made
  worse, apart from the small widening in non-blocking 6.
- **Disclosed deviation.** `2956e23` holds two changes: the read-error test and removing
  `DEFAULT_SIZE`. It is a small breach of one change per commit, and it does not affect behaviour.

## Non-blocking (file these)

1. **A base that neither contains nor is contained by the fork point, with the default branch merged
   in, counts the merged commits, and the fix says `--size m`** (point 3; cases B2' and the
   squash-merged second item). The code is `src/size.ts:76` (no branch for this shape) and the fix
   is at `src/gate.ts:319-322`. The follow-up: detect the shape, then measure from
   `git merge-tree --write-tree <base> <fork>`, or at least add a note to the line and drop the
   "it is not small" fix for that shape. Add a test that pins whichever is chosen.
2. **Stale or differently named refs bring the round 1 false red back.**
   - `git pull origin feat/one` after a merge was made on the remote leaves `origin/main` stale
     (G''').
   - A fork layout that rebases onto `upstream/main` uses neither `main` nor `origin/main` (L).
   - Both print `... 210 lines in 6 files` from the base, with no note, and the `--size m` fix.
   - `forkPoint` (`src/size.ts:92-98`) looks only at `refs/heads/<name>` and
     `refs/remotes/origin/<name>`. That is truthful to the wiki's "its local branch and its
     `origin/` copy", and consistent with the rest of mstack, which treats `origin` as canonical
     (`worktree new` defaults to `origin/main`).
   - Follow-up: also consult `<name>@{upstream}` and `refs/remotes/*/<name>`, or take the merged-in
     commits from the merge commits on HEAD's first-parent chain since base, which needs no ref at all.
3. **A rewritten base counts the branch's commits from before the item.** D1 gives
   `15 lines in 2 files`, 5 of them pre-item. A stacked branch rebased onto `main` with its parent
   unmerged gives `170 lines in 5 files` (B3a), and its fix still says `--size m`. There,
   `--base <the rewritten commit>` is the remedy. The line does say
   `base ... is not in this branch's history`, but the wiki does not say the pre-item commits count.
4. **Not covered by a test:** detached HEAD, a linked worktree, a shallow clone, and the decision 4
   limit. My CLI runs above cover the first three. A test that pins the limit would make the
   follow-up's change visible.
5. **Mutant R6 survives.** Removing `!isCount(del)` from `src/size.ts:154` leaves 64 tests passing.
   The test's record only makes `ins` malformed. If `--no-renames` were lost, a rename of a file
   whose name is all digits would reach `NaN` again. Add a record whose deletions field is
   malformed.
6. **The "could not measure" fix still names `--base`** (`src/gate.ts:292`, `fixBase`). It now also
   covers an unparseable numstat record, so round 1's non-blocking 5 is widened by one rare cause.
7. **The wording of acceptance 3** ("code diff from base") predates row 214. Rewording it to "from
   where the item's work starts" would stop a later reader from taking the passing rebase case for
   an unmet criterion.
8. **Docs nits.**
   - `Gates-and-Hooks.md:212` says "with one exception", and a second replacement follows at
     `:218` (the rewritten base).
   - "rather than counting as nothing" (`:204` and the CHANGELOG) is loose. Before the guard, the
     record made the line count `NaN`, which disabled the line limit, while files still counted.
   - The CHANGELOG states the benefit and not the decision 4 limit.
9. **The "lost" line says "(a rebase rewrites it)"** for an orphan branch too (case N). That is a
   harmless guess.

## Not checked

- A real hosted remote. The remotes were local bare repositories, and GitHub's "Update branch" was
  simulated by a merge pushed from a second clone.
- Criss-cross histories, where `git merge-base` has more than one answer and prints one.
- The Stop hook and status line paths over a size s item. Only `gate` was run.
- `claude plugin validate . --strict` and `merge-gate` against a real PR.
- Windows. The stand-in git is POSIX-only, like the suite's other git fixtures.
- git older than 2.54.0, my version (`git version 2.54.0 (Apple Git-157)`).
- The full suite at each intermediate commit. Only the two relevant files were run there.

Every fact above is at rung 4: scripts and tests that call the real code, the CLI included, in
throwaway repositories. None is at rung 5 (a live plugin session).
