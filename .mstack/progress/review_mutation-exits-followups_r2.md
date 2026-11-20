# Review - mutation-exits-followups (round 2)

**Verdict:** APPROVED

Reviewer pass of item 105, round 2, at `a83a77d6954a14875cdd13824ddfbb97273e93a5` (item base `819c9a3`,
round 1 reviewed `d49c4b0`). I wrote neither the code nor the round 1 review. Scope: `d49c4b0..HEAD`
over `src/`, `tests/`, `docs/`, `CHANGELOG.md` and `.mstack/specs/mutation-check/`. Scratch `R` =
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review105r2/`
(scripts in `R/scripts/`, output in `R/out/`). Every run of the mechanism was in fixtures under `R/fx/`
and `R/mnt/`, the latter a case-sensitive APFS disk image attached at a mount point in the scratch. The
CLIs were `git archive` copies: `R/head` (a83a77d), `R/base` (819c9a3) and the mutants in `R/mut/`. In the
checkout I ran only `./bin/mstack gate`, `ledger check`, `state show` and the ledger record.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A2 | `tests/mutation-exits.test.ts:720` (the repro, and the edit to `.`), `:817` and `:864` (copies with git's variables), `:901` (under the top), `:959`, `:984`, `:1021` (moved up; the narrower rule), `tests/mutation-two-stores.test.ts:203` | Read in the diff. Rebuilt on the head: X2 is killed by `:720`. My mutants: V3 (a root that is a link is not followed) is killed by `:984`, and V4 (the gate's check in the lock's own store dropped) is killed by `:720`. V1 and V2 survive: see NB2 |
| A1 | `:652` (gains a relative link and a two-link chain) | X1 and X3, rebuilt on the head, are each killed by `:652` |
| A3, A4 | not touched in this round | not redone |

## Acceptance, quoted

**"a lock hand-edited to name another real store of the worktree does not restore into that store: the restore proves the lock's paths belong to the store it names, or refuses (today cd B && restore exits 0, writes A's file into B and leaves A reverted; nothing is lost)"**
\- met for the edit the item names, in the scope rows 02:09:45Z and 05:43:49Z set. Row 05:43:49Z
says: "the restore refuses only when the lock's root is another store's own directory in this worktree
(the edit the item was filed for ...); a root anywhere else is accepted, as at the base", and "Edits
of both fields were never caught and lose nothing". The evidence is `R/out/edits-head-bun.txt` and
`-node.txt`, the same on both runtimes: a real run in A, killed with `kill -9`, then `rootFromTop`
edited to `pkg/b`.

```
restore from B: exit 2, tree, lock and run directory unchanged
   mutation: refused: the lock <FX>/repro/.git/mstack-mutation.lock names this store, at pkg/b, and its root <FX>/repro/pkg/a is the store at pkg/a in this worktree, so the lock was edited ...; nothing was written, and the lock stays
restore from A: exit 2, tree, lock and run directory unchanged
gate and R1, from B and from A: "no verify --restore takes this lock ... by hand"; hashes unchanged after all six calls
by hand, from A: git stash push --include-untracked: exit 0; lock deleted; status ""; A x "NEW\n"
the stash holds: -NEW +OLD -new z +old z -B's own z +B's uncommitted z
```

The base, given the same edit (`R/out/edits-base-bun-stdout.txt`), restores from B with exit 0:
"restored 2, tree verified, lock removed".

Item 42's binding: **"No path through the run, the restore or a recovery the tool prints removes or overwrites content the run did not write without first saving it, and no state keeps the lock with deleting work as the only way out"**.
It held in every run below. That covers 798 legitimate restores at the head (399 per runtime), each
either exit 0 with every file byte-identical or exit 2 with nothing written. It covers the repro plus
13 edits per runtime (the 11 listed, the ceiling case and its control), with B's own content kept in
every one. And it covers the by-hand line run in L15a and L15d, with the person's work all in the stash.

## Verification I ran

### 1. Legitimate restores, real runs killed

`R/scripts/layouts.mjs` is adapted from the implementer's harness, which was adapted from round 1's. Each
case gets a fresh fixture, and its item modifies 2 files, adds 1 and deletes 1. It is killed with SIGKILL
(the process group) at 7 points: `lock-written`, `reverted:0`, `revert-written:2`,
`obligations-running`, `restored:0` and `restore-written:2` through `tests/mutation-run-holder.ts`, and a
real `bin/mstack verify --mutation` killed while its check sleeps. Then the layout's change, and the
restore as a person runs it. A restore counts as good with exit 0, the lock gone, and every file outside
`.git` byte-identical (path, mode, SHA-256) to the snapshot taken before the run. Two things are new: runs
killed in a second store or worktree at the same point, and a control in which the base runs everything
(its own holder, its real run, its restore). On node the `PATH` holds no bun, so the launcher runs node.

The scope is 48 layouts with 57 restores, at 7 kill points, which makes 399 restores per CLI and
runtime. In all four files, 0 kill points left no lock and 0 failed to reach their step.

| CLI | bun | node |
|---|---|---|
| head `a83a77d` | 378 / 399 | 378 / 399 |
| base `819c9a3` | 399 / 399 | 399 / 399 |

The head refuses 21 restores per runtime: **L15a, L15b and L15d**, 0/7 each. Each one exits 2, and the
files and the lock are unchanged by the call. Every other cell is 7/7 on both runtimes and both CLIs:

- **Round 1's failures first.** L10c is the copy restored with `GIT_DIR` and `GIT_WORK_TREE`; L10e the
  copy with `GIT_WORK_TREE` alone; L13a, L13b and L13c the copy made into the directory that holds the
  original, with both variables, with `GIT_WORK_TREE` alone and with none. Each was restored in the copy,
  then the original.
- **Round 1's other 17 layouts:** L01, L02, L03 (from A), L04a, L04b, L05a, L05b, L06, L07 (linked),
  L08a, L08b, L09, L10a, L10d, L11a, L11b and L12.
- **Moved up:** L14a, L14c, L14d (from A) and L14e.
- **New layouts:**
  - N01a: vendored, moved into `mono/vendor/w` of a new repository.
  - N01b: a new repository made at the old path, with a store at the very old root, and the checkout
    moved into its `vendor/w`.
  - N02a: moved across filesystems to `R/mnt` (device 16777239 against 16777229).
  - N02b: the same with `GIT_DISCOVERY_ACROSS_FILESYSTEM=0`.
  - N03: moved to a path reached through a symlink, with `PWD` given the link's spelling.
  - N04b: the store renamed, then renamed back.
  - N05: two worktrees of one repository, each with a dead run.
  - N06: a store whose directory is a tracked symlink, with the run and the restore through it.
  - N07 and N07b: a top store and a nested repository with its own store, a dead run in each, restored
    in either order.
  - N08: a linked worktree after `git worktree move`.
  - N09a: the checkout renamed in case only.
  - N10a: `GIT_CEILING_DIRECTORIES` set to the parent.
  - N10b: L13a with a ceiling at the original's top.
  - N11: `mstack worktree new s1 --base HEAD` from `pkg/a`, whose linked worktree lands inside the main
    one at `pkg/a-wt-s1`, with a dead run in each.
  - N12: L15b's move with no store at `a/`.
  - N14: a backup restored to another path.
- **Refused as expected, by both CLIs:** exit 2 and nothing written, 7/7. That covers L03 and L14d from
  B, N04 from the renamed store, and N09b from a store renamed in case only. L07 from main: "nothing to
  restore".

**Why the refused set is the L15 class** (walked, rung 3). A refusal needs four things:
- `root !== dir`;
- `root` under the top as spelled;
- `root/.mstack` to exist;
- git, run from `root` alone, to give this top at a place other than `rootFromTop`.

In place, `root === dir` for an unedited lock, since both come from a resolved cwd. A rename or a link
that changes where `root` leads also moves the run's own store away from `rootFromTop`. Then the restore
refuses earlier, at the base as well, as N04 and N09b do. What is left is the checkout moved so that its
old root lands on another store of the same repository.

### 2. L15a, L15b: the accepted refusals

Row 06:19:05Z: "Only a record of the store's identity in the lock could tell them apart, which is a new
lock field ... out of proportion for a move that needs a dead run, a checkout moved before the restore,
and a repository holding a second store at the very path the old root falls on. Nothing is lost in
either".

Besides L15a and L15b, I built **L15d**, the member I thought likeliest. The top store's run dies with the
checkout nested one level too deep in `w/`, in a repository that holds a store at `w/`: a monorepo whose
package is named like the repository. The checkout is then moved up. This is the row's shape (the old
root, here the old top, falls on the store `w/`). It is also the docs' "moved up, the repository holding
a store at the old root's path", so it is inside the class.

The ordinary flows the brief names do not reach the class:
- N11, `mstack worktree new`, restores.
- A package renamed (N04) is refused before `rootDisagrees` runs, by the base too.
- A rename swap (the implementer's L15c) reaches no rule.
- Re-cloned beside (L05b), a backup restored elsewhere (N14) and a new repository at the old path
  (N01b) all restore.

**Judgment:** each member needs four rare things at once: a dead run, a checkout in the wrong place,
moving it before the restore, and a store at exactly the path the old root falls on. I found none that a
person would plausibly hit, and the outcome loses nothing. The printed way out works as printed
(`R/scripts/l15.mjs`, `R/out/l15-head-bun.txt` and `l15-head-node.txt`, the same on both). In it, an
untracked file is in place before the run and an uncommitted edit is made after it died:

```
L15a restore from the run's store: exit 2; tree unchanged; lock unchanged
   refused: ... its root <FX>/L15a -byhand/outer/w/pkg/a is the store at w/pkg/a in this worktree, so the lock was edited and whose it is cannot be told; ...
   by hand ...: 'git stash push --include-untracked' saves every change and discards nothing; then delete the lock
by hand: git stash push --include-untracked: exit 0; then the lock deleted: lock gone; status ""; A x "NEW\n" (HEAD's)
the stash holds: -pkg/a's notes +my uncommitted notes +my untracked file -NEW +OLD
the move undone instead, restore from the old place: exit 0; lock gone; x "NEW\n", notes and scratch as the person left them
L15d: the same lines, its root <FX>/L15d -byhand/outer/w "is the store at w"
```

The message says "the lock was edited" of a lock nobody edited: NB1.

### 3. The edit the refusal exists for, and the not-caught list

Part 1 is quoted under the acceptance. For the not-caught list I ran all 11 of design.md's edits on each
runtime (`R/scripts/edits.mjs`). Each was a real run in A killed with `kill -9`, with B holding its own
committed `x.js` and an uncommitted `z.js`, and the restore run from B. Every one is as the docs say: exit
0, `restored 2`, the lock gone, rescued `["B's own x\n","B's uncommitted z\n"]`, and A's `x.js` `"OLD\n"`
with `"NEW\n"` at HEAD. The 11 edits:
- both fields agreeing on B;
- `rootFromTop` edited after the move;
- `root` naming nothing;
- `root` a file;
- `root` a directory outside the worktree;
- `root` a link from outside into A;
- `root` A's `src/`;
- `root` B's `src/`;
- `root` `.`, from B's root and from B's `src/`;
- the repro in a worktree git finds only through `GIT_DIR`.

One edit is not in the list (NB3). Stores at `x/a` and `y/b`, `rootFromTop` edited to `y/b`, and the
restore from B with `GIT_CEILING_DIRECTORIES=<top>/x`: exit 0, with B's content rescued and nothing lost.
The same edit without the ceiling is refused, exit 2.

### 4. The git call that remains

- **Callers.** `git()` gets `fromCwd` only from `placeOf` (`src/mutation-lock.ts:112`), and only
  `placeOfDir` (`:144`) passes it as true. Every other `placeOf` keeps the old environment, since
  `gitEnv(false)` is the old `gitEnv()`; those are `mutation-run.ts:527`, `mutation-lock.ts:201` and `:314`, `mutation.ts:388`
  and `gate.ts:688`. So does `gitToFile` (`git.ts:120`). `LOCAL_REPO_ENV` is the same 15 names that
  `git rev-parse --local-env-vars` prints on git 2.54.
- **Odd roots** (`R/scripts/probe-root.ts`, `R/out/probe-root.txt`). I called `rootDisagrees` on 15
  roots, each runtime, under six settings of git's variables (none, both, `GIT_WORK_TREE`, `GIT_DIR`,
  ceiling at the top, discovery and index and objects). Nothing threw; the slowest call took 26 ms.
  - Null, with no git call: a file, a dangling link, a FIFO, a path under a FIFO, a dangling `.mstack`
    link, a mode-000 directory, and the top itself.
  - Asked of git and disagreeing, as `findStore` would take each as a store: a directory holding a
    `.mstack` file, one holding a `.mstack` link, and a mode-100 directory.
  - Null: a nested repository's store.
  - A newline in a store's name cuts git's prefix at the newline ("is the store at pkg/new"). That
    comes from `placeOf`'s `split("\n")`, which is older than this item; a newline in the top accepts.
  - The variables change no answer. A ceiling at the top makes git silent, so the root says nothing.
- **Cost** (`R/out/timing.txt`, load 12, median of 15 in process and 9 through the CLI, base against
  head):

```
valid lock, git commit from A (deny)    48.9 -> 45.4 ms | CLI 93 -> 95
edited lock (rootFromTop pkg/b), from A  46.2 -> 61.0    | CLI 92 -> 108
no lock, git commit                      14.2 -> 15.0    | CLI 62 -> 60
```

  An unedited lock costs nothing extra, because `root === dir` and no git runs. An edited one costs one
  `git rev-parse`, about 15 ms. Hook budget: `tests/hook-errors.test.ts` with `tests/mutation-hook.test.ts`
  gave bun 49 pass 0 fail and node 49 pass 0 fail. "a failing hook stays well inside the smallest
  timeout" took 182 ms.

### 5. Tests and mutants

**Tests.** `:652` and `:720` only gain cases. The `..b` directory at `:901` became a store, which keeps
its assertion meaningful under rule 3. The three assertions changed at `:984` (A's `src/`, and a file, a
dangling link and a FIFO in A, from "is in the store at pkg/a" to null) are what rule 3 changes, and the
test gains a link that disagrees. Nothing else in `d49c4b0..HEAD -- tests/` is weakened; the only file
it changes is `tests/mutation-exits.test.ts`.

**Mutants** (`R/scripts/mutants.sh`, `R/out/mutants-run1.txt`, `mut-*.log`): each one an archive of the
head, run under bun on the five pinning files, which give 68 pass and 1 skip at the head.

| Mutant | Result |
|---|---|
| X1 relative link read from the cwd | killed, `:652` |
| X2 no check when `rootFromTop` is `.` | killed, `:720` |
| X3 one link hop | killed, `:652` |
| V1 `there.top !== top` dropped | **survives**, 68 pass |
| V2 git silent (null) refuses | **survives**, 68 pass |
| V3 a root that is a link not followed | killed, `:984` |
| V4 `fromLockStore`'s own-store check dropped | killed, `:720` |
| R7 no `root === dir` shortcut | survives, 68 pass |

**R7, run instead of reasoned.** `R/out/layouts-mut/R7-no-same-string-shortcut-bun-r7.txt` gives
378 of 399, the L15a, L15b and L15d cells refused, and a table identical to the head's (`diff` empty). `R/out/edits-mut/r7-bun.txt` gives the same as the head: part 1
exit 2 from both stores with nothing written, and the 9 listed edits as the docs say. So R7 is equivalent
on every layout measured here; it saves one git call per restore. R6 I took from the implementer's
reasoning and did not rerun.

**V2, run** (`R/out/layouts-mut/V2-git-silent-refuses-bun-v2.txt`, the variable and ceiling layouts): 105 of
112. N10b is 0/7, exit 2: "names this store, at pkg/a, and git cannot place it". The base and the head
both restore it 7/7. So a mutant the suite lets through refuses a legitimate restore: NB2.

### 6. Docs and spec

I checked each sentence of `design.md:182-219`, `spec.md:695-706` (R24) and its three new scenarios
(`:732`, `:740`, `:747`), `Gates-and-Hooks.md:293`, `The-CLI.md:896` and `CHANGELOG.md:14-18` against
the code and the runs above.
- The rule, the variables, "a store git places in another repository", the L14 rows and the L15 row of
  the state table, and the not-caught list all match what ran. The list misses only NB3's ceiling
  case.
- No sentence of a dropped rule is left in the docs or the spec. One is left in a test comment: NB4.
- The history of the two dropped rules takes 5 lines of design.md (`:196-200`). That is short enough,
  though the bullet as a whole, at about 40 lines, is at the edge of what a reader takes in.

### 7. Suites, both runtimes

These ran in `R/suite-plain` and `R/sp ace dir/head`, archives of a83a77d with the checkout's
`node_modules` linked and `HOME` a new empty directory (`R/out/suites-meta.txt`; load 6.9 at the start,
26.4 at the end):

```
[plain]  bun run test exit 0 (463 s): bun 1142 pass 3 skip 0 fail, Ran 1145 tests | node: tests 1145, pass 1144, fail 0, skipped 1
[plain]  tsc --noEmit exit 0 | ./bin/mstack lint-plugin . PASSED - 0 failures, 0 warnings | check-doc-links: 112 relative links checked, 0 broken
[spaced] bun run test exit 0 (520 s): bun 1142 pass 3 skip 0 fail | node: tests 1145, pass 1144, fail 0, skipped 1
./bin/mstack gate (checkout): PASSED - 0 failures, 0 warnings
```

The ten-run loop covers `tests/mutation-exits.test.ts`, the one test file this round changes, in
`R/scripts/ten.sh`. It is a fixed-count `for` loop, run plain and with dash as `sh` (`DASH=1`): `sh`
first on `PATH` is linked to `/bin/dash`, `/bin/dash` is in `src/run.ts`, `src/run-helper.mjs` and the
test file, and `#!/bin/dash` is the launcher's line, with no `"/bin/sh"` left:

```
plain (out/ten-plain.txt, load 10.6 -> 12.1): bun failed 0 of 10 (21 pass 1 skip 0 fail) | node failed 0 of 10 (pass 21 fail 0 skipped 1)
dash  (out/ten-dash.txt,  load 11.1 -> 10.6): bun failed 0 of 10 (21 pass 1 skip 0 fail) | node failed 0 of 10 (pass 21 fail 0 skipped 1)
```

That is 40 runs with 0 failures.

Afterwards `pgrep -fl 'mutation-holder|run-helper'` printed nothing, and the lock test on the checkout
was false.

## Changes required

**Blocking:** none.

**Non-blocking**

1. `src/mutation-lock.ts:175`. The refusal says "so the lock was edited" in L15a, L15b and L15d, where
   nobody edited it and the checkout was moved. Smallest change: "so the lock was edited, or the checkout
   moved onto another store, and whose it is cannot be told", as spec R24 already words it.
2. `tests/mutation-exits.test.ts:984`. Two clauses the docs state are pinned by no test:
   - "a store git places in another repository" says nothing: V1 survives.
   - a root git cannot place says nothing: V2 survives, and it refuses N10b, a legitimate restore, while
     the suite stays green.

   Smallest change: two assertions in the `:984` test. A nested repository's store under the top
   (`git init` in `top/nested`, then `setup`) is null. The same with `GIT_CEILING_DIRECTORIES` set to
   `top/pkg` for the call is null for `o.a`.
3. `design.md:210-219`. The not-caught list lacks one edit: the repro's edit is not caught when
   `GIT_CEILING_DIRECTORIES` names a directory between the root and the top level (above, exit 0, B's
   content rescued). Smallest change: name it in the list, or drop `GIT_CEILING_DIRECTORIES` in
   `fromCwd` as well.
4. `tests/mutation-exits.test.ts:924-928`. The comment over `movedUp` states rule 2 ("disagrees only when
   the store a restore would find from it is another store"), which was dropped. Smallest change: state
   rule 3, or delete the comment.
