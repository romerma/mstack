## Context

Each fact was read at the cited line on `feat/mutation-closing-check` at `7d2d42b` (`src/`,
`tests/`, `docs/` and `skills/` are unchanged at `a2b5f8d`), or measured by a script under the
session scratchpad: round 1's in `spec100/`, the reviews' in `specreview100/` and
`specreview100r2/`, round 2's in `spec100r2/`, round 3's in `spec100r3/` (absolute:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/spec100r3/`),
each a `bash` file that starts `set -euo pipefail` with a checked `cd`, its output beside it as
`*.out`. macOS 26 on APFS, git 2.54.0, node v26.13.1. Every fixture ran this checkout's
`./bin/mstack` with a fixture repository as its working directory and an empty `HOME`; none ran
with this checkout as its working directory or store.

- A closing check is one entry in `CLOSING_CHECKS` (`src/closing.ts:272`). The gate runs every
  entry for the active item at `verifying` (`gateProblems`, `:284-289`; `src/gate.ts:748`, printed
  at `:783-788`), and `state set --status done` runs all of them (`src/cli.ts:758-819`). A problem
  is `overridable` or not (`src/closing.ts:28-29`); an overridable one closes with `--force
  --closed-by`, which writes one of three markers into `closed_by` (`src/cli.ts:294-299`, chosen
  at `:772-775`, carried across a later note at `:860-861`). The forced line for anything that is
  not the table reads `forced: closed on a verification that did not run here` (`:810-812`), and
  the hint without `--closed-by` says `closing unverified` (`:804`). `--clear` runs before the
  status move (`:694`), `--base` after it (`:917-925`). `done` reads no lock (`rg readLock
  src/cli.ts`: no match); the gate's lock line is `lockProblem` (`src/gate.ts:698-719`), on this
  checkout's git directory (`:685-690`).
- Item 42's row: `target` the slug, `sha` the HEAD the obligations ran at
  (`src/mutation-run.ts:457`), `command` the obligations joined with ` && ` (`:260`), `outcome`,
  `ts`, `tree` `mutation:<key>`. `receipts()` ignores these rows (`src/verification.ts:341-352`).
  The baseline of a run records passed receipts (`src/mutation-run.ts:310`).
- After a merge a new run is refused: a merge commit by item 42's R4 (`src/mutation.ts:270-276`), a
  squash or rebase merge of a branch whose base is a branch commit by R1's lost start (`:233-236`).
  Item 42 refuses a run under `skip-worktree` or `assume-unchanged` (`flaggedTracked`,
  `src/mutation.ts:411-427`).
- `verification.tsv` is ignored (`src/setup.ts:72`) and each checkout has its own store, a linked
  worktree included (`src/paths.ts:46-56`). `docs/wiki/Gates-and-Hooks.md:703-707` says why a
  receipt from another checkout is not evidence.
- Rules default to on when absent (`src/state.ts:153-158`), and a rewrite of `state.json` writes
  each known rule's parsed value (`updateState`, `:306-322`); `seedState` writes four
  (`src/setup.ts:111-116`). The tests write their own `state.json` through `state()`
  (`tests/helpers.ts:190-197`, three rules) and `sandbox()` runs `setup` (`:42`).

### Fact 1: what the check would have met here

Unchanged from round 1 and re-run byte-identical by the review (`specreview100/fact1.sh`): of 53
closed items, 9 had a base at their close; 6 have a code diff (40, 41, 42, 43, 82, 95), none of
size `s`, so the check would have held 6; item 42's R3 and R4 refuse none; all 6 change `src/`,
so item 42's R5 refuses each from `./bin/mstack` and none from a copy of the CLI. Over the round 3
review's windows, 1 window with code in 41 hits a refused shape (R4). Every item here has an
obligation (the project `verify` is set). Rung 3: diffs read, no run.

### Fact 2: where a receipt lives (`spec100/worktree.sh`, `spec100r2/shapes.sh` WT1, WT2, WTRM)

A run in a linked worktree leaves 1 row there and 0 in the main checkout's store; `git worktree
remove` deletes it with exit 0. Read across worktrees, the row answers the check in the main
checkout after a merge commit (WT1) and after a fast-forward with an untracked `notes.txt` in the
linked worktree (WT2), and after the remove there is no row (WTRM). So "survives the merge" means:
same machine and repository, the row in a store of one of its worktrees that still exists, judged
against the checkout that closes. A clone, CI and a removed worktree have none. Rung 4.

### Fact 3: what a kill proves (`spec100/kills.sh`, `spec100r2/walk.sh`)

A test that imports the new module and asserts nothing kills; `git diff --quiet HEAD -- src` kills;
`/bin/dash scripts/check.sh` with the script reverted away kills (exit 2) where bash is blocked
(127). In the Getting-Started repository the run kills in 1 s because `test_shout` raises
`TypeError: greet() got an unexpected keyword argument 'shout'`: the test reaches the code. Rung 4.

### Fact 4: the shapes, under this spec's words (`spec100r3/shapes.sh`)

`shapes.sh` rebuilds every shape of the four earlier passes (the round 1 and round 2 authors' and
reviews'; most on one seed: item `greet` on `feat/greet`, base the branch's first commit,
`src/greet.js` and its test changed, a real `verify --mutation`, `mutation-killed`; the round 2
review's second set and the linked-worktree shapes on their own repositories) and adds 27, two of
the seeds new: the base a commit of `main`, as `mstack worktree new` gives (names ending `B`), and
`src/prep.js` committed on the branch before the base (`PREBASE`). 108 shapes in all. Each is
judged by `words3.mjs`, written fresh from Terms, R1, R3 to R15 and R25 of this spec (**This
spec**), and by the round 2 review's emulation of the round 2 spec's words (**Round 2**,
`words-r2.mjs`, copied unchanged); `summary.out` has one line per shape. **A2** is what acceptance
2 demands at the close, or on the branch A1's "at the current code and test tree"; "other work"
means no path of the item changed after the run. `pass` is the check answered, `held` it is not,
and bold an answer A2 does not demand. Git's answers are rung 4; every verdict is rung 3
(emulated; no code exists). "Main moved" means another item's `src/other.js` and
`tests/other.test.mjs` landed on `main` first; a rebase merge is `git cherry-pick` onto `main` with
a later committer date. The fast search for Q in "Shape" found the full walk's Q on every row that
reached it.

| Shape | A2 | Round 2 | This spec | Voided by |
|---|---|---|---|---|
| seed; A fast-forward; B, E merge commit, main not moved / moved; C, C2 squash; D, D2 rebase merge; V7 docs after the run; U untracked `notes.txt` and test; RE1 rebased after the run; RE2, RE3 rebased before a second run; RV1 revert and reapply; OCT octopus; DELU; REVERTED a test after the run, reverted; QAMB1; RBM rebased, then a merge commit | pass | pass | pass | - |
| WT1, WT2 a linked worktree's row; SUBDIR, SUB-sq, SUB-rb, SUB-mc, SUB-top a store in `pkg/`; GLOB the item's `src/[id].js` after `main` changed `src/i.js` | pass | pass | pass | - |
| C2B, D2B, EB, AB, RE1B the base a commit of `main`, main moved; PREBASE code before the base, rebased after the run | pass | pass | pass | - |
| ALLDEL the item only deletes a file `main` added; REVITEM it reverts earlier work; each squashed | pass | **held** | pass | - (Q not in S's history) |
| SHA256, SHA256-sq a SHA-256 repository, on the branch and squashed | pass | **held** | pass | - (R7 reads the object format) |
| V4 main edited line 1 of `src/greet.js`, merge commit; MCF2 the item's follow-up edits it on `main` after one | void | held | held | R10 `src/greet.js` |
| V5B, OCT2 a test after the run, merge commit; PREM the same, the test also cherry-picked to `main` first | void | held | held | R11 `tests/helpers.test.mjs` |
| V5C, V5CB, SUB-v5c, RS, IREBS, RBM2 a test after the run, then a squash, a recommit, a reorder and squash, or a rebase and merge commit; AM1, AM2 an amend; MODE2 `chmod +x src/other.js`, squash | void | held | held | R12, Q's own change |
| AM3, RV2, REN, FLIP the item's content changed or moved after the run | void | held | held | R12, no Q |
| V5D, RB2, W1, TWO, SQF, RBF work after Q | void | held | held | R13 |
| V5A, V6, MODE, DELWT, CASE on the first-parent history after S | void | held | held | R8 |
| STAGED an edit staged, the working tree file put back | void | **pass** | held | R8 (the index) |
| IREB, IREBB, IREB0, IREBX, IREBC, IREBM an after-run test or `src/extra.js` moved or folded ahead of the code with `rebase -i`, on the branch | void | **pass** | held | R25 |
| BASES, BASESM, BASESM0 `--base <S>` after the run | void | held | held | R9 (P empty) |
| SHA a row whose `sha` is `HEAD` | void | held | held | R7 |
| FLAG, W3 `assume-unchanged`, then an edit | void | held | held | R14 |
| W2 a `prunable` worktree record with a forged row | void | held | held | not read (Terms) |
| BASEH, WAYS-size, WAYS-base `--base HEAD` or `--size s` at `verifying` | on the record | not held, no record | refused without `--closed-by` | R26, R27 |
| CPR, PRE, PRER, IREBR, IREBXR, IREBCR, IREBF, PRERB, PREO, PREOM, MCF, MCF3 | void | **pass** | **pass** | - (the misses, below) |
| IGN, GITIG an ignored scratch test earned the kill, then deleted | void | **pass** | **pass** | - (a trade-off) |
| UNTR an untracked scratch test earned the kill (today's CLI) | void | **pass** | no row | R16 refuses the run |
| L, FPB other work on the first-parent history after S, fast-forward | pass | **held** | **held** | R8 `src/other.js` |
| C3, QAMB2 other work after a squash | pass | **held** | **held** | R13 `src/other.js` |
| INTEG through a `develop` with other work, merge commits | pass | **held** | **held** | R11 `src/other.js` |
| SQDEV squashed into a `develop` with other work, merged into `main` | pass | **held** | **held** | R12 `src/other.js` |
| PREBASES code before the base, rebased, squashed | pass | **held** | **held** | R12 `src/prep.js` |
| GC squash, branch deleted, `gc --prune=now` | pass | **held** | **held** | R7 |
| WTRM the linked worktree removed first | pass | **held** | **held** | no row (Fact 2) |

Round 2's words and this spec differ on 11 shapes, each for a finding of the round 2 review: R25
(B1) on the six IREB shapes, the index (non-blocking 3) on STAGED, Q outside S's history (2) on
ALLDEL and REVITEM, the object format (4) on SHA256 and SHA256-sq. UNTR's "no row" is R16 read,
not run (today's CLI has no R16).

**Against the round 2 review's clause.** As the review words it ("where the start at HEAD can be
computed, a path that is not in P differs between the start at HEAD and Q"), the clause voids IREB
and also six shapes that hold: C2B, D2B, SUB-sq, SUB-rb and SHA256-sq, squash and rebase merges
of an item whose base is a commit of `main` after `main` moved (there the start at HEAD is the
base, and the default branch's own work lies between it and Q), and PREBASE, a branch rebased
after the run that carries code from before its base (`REVIEW-CLAUSE=HELD` in `shapes.out`). So
R25 reads only where HEAD is ahead of the default branch, and compares Q with S, less what the
default branch changed between the start at S and the start at HEAD. It holds all six; it gives up
IREBF on `main`, which the review's clause voids there (both void it on the branch).

**Checked against the round 1 review's definition** (round 2, `spec100r2/`). Qab as worded has
R5's own test of the working tree (`lstat` and `hash-object`) in front of its two clauses. Given
clause (a) (nothing differs between Q and the working tree) and Q's definition (every path of P has
S's blob and mode at Q), that test adds nothing for a tracked file; it only sees an untracked file,
and on DELU it voids a receipt because an untracked `src/other.js` sits where the item deleted one,
while R8 holds the same tree on the branch. So this spec states "differs from the working tree"
once, as `git diff` against the commit (Terms; the index too, from round 3), for R8, R10 and R13
alike, and catches the edit `git diff` cannot see by R14.
No clause of Qab can go. Without (ii) V5C, RS and MODE2 pass, and without (a) V5D, AM1, AM2, RB2
and W1 pass (the review's Qb column; each is a row above). Without (i), an empty P after a squash
makes Q the first commit, whose own change already voids by (ii), so (i) decides alone only after
a merge commit: `bases0.sh` moves the base to the run's commit, lets `main` move and merges, and
round 1's words, which in the merge case are Qab less (i), answer the check with a row that
covers nothing (`SPEC1=PASSES | Qab=HELD (no holding row) | P=[] | MINE=HELD | ... void R9 P
empty`).

### What the rule misses, and what it voids that should hold

**Misses: one class.** A test or code file the item adds or changes after its run, at a file the
run's commit had not changed, that reaches the default branch by a route other than the item's own
merge. For example: a test written after the run reaches `main` before the item does (cherry-picked
from the branch, or merged as its own PR); or it is moved ahead of the item's code with `rebase -i`
and the branch is then rebase-merged or fast-forwarded; or a rebase merge is reordered by hand; or
the item's follow-up is committed on `main` after a merge commit. Twelve members were measured:

| Member | How the change reached `main` | The branch's own gate before the merge |
|---|---|---|
| CPR | reordered ahead of the code by hand in a rebase merge | void (R8) |
| PRE, PRER | cherry-picked from the branch to `main`, then a squash or a rebase merge | void (R8) |
| IREBR, IREBXR, IREBCR | moved or folded ahead of the code with `rebase -i` (a test; a test folded into an earlier commit; `src/extra.js`), then a rebase merge | void (R25), from the reorder on |
| IREBF | moved ahead with `rebase -i`, then `main` fast-forwarded | void (R25), from the reorder on |
| PRERB | cherry-picked to `main`, then the branch rebased onto `main` and fast-forwarded | void (R8) until the rebase; holds after it |
| PREO, PREOM | a test written for the item, merged as its own PR before the item (then a squash; a merge commit) | holds: the branch never had it |
| MCF, MCF3 | committed on `main` after a merge commit (`src/extra.js`; a test) | none: it came after the merge |

Where the class stops, argued from the words (rung 3, not proven): a change at a path of P is
seen wherever it lands (R8, R10, R12's "no Q", R13), unless the content is back to the run's
(REVERTED, RV1: correct holds). A change outside P is seen on HEAD's first-parent history after S
(R8), on the merged branch after S (R11), in Q or after it (R12, R13), and before Q on the branch
(R25). It is not seen in four places: before Q on the default branch (R25 does not read there:
git cannot tell the item's commit from the default branch's own work); on the default branch's
side of a merge commit (R11 reads the merged branch); after a merge commit (R10 reads P); and on a
branch rebased onto a default branch that already had it (R25 excuses what the default branch
brought). Every member above is in one of the four, and no shape built here misses outside them.
PREO and PREOM are, to git, C2 and E: whether the test is the item's is not in the repository.

- **Correct holds, not misses:** RV1 and REVERTED (the content at the close is the content the run
  saw; a receipt is about content, as R8 already is on the branch) and OCT (the other branch's
  paths are not the item's; R11 still sees an after-run change on the item's branch, OCT2).
- **Voids that should hold:** other work on the first-parent history after a squash or rebase
  merge (C3, QAMB2, R13) or after S on a fast-forward (L, and FPB, `main` merged into the branch
  first; R8), since first-parent history cannot say whose commits came after Q or S; an
  integration branch with other work between the item and `main` (INTEG by R11, SQDEV by R12,
  whose Q is the merge of `develop`); a squash of a branch that carries code from before the
  item's base (PREBASES, R12: the squash commit holds that code too); and a run commit pruned after
  a squash and a deleted branch (GC, R7). After a merge commit, other work on `main` does not void
  (R10 reads the item's paths only). The way out is to close right after the merge, as
  `skills/ship/SKILL.md` step 7 already does; for PREBASES, `--base` at the branch's fork with a
  reason (R26); else the forced close.

### Fact 5: which shipped tests change (`spec100r2/probe/`, `spec100r3/probe.sh`)

`run.sh` takes three archive copies of `7d2d42b`, patches two with a stand-in for the check
(`patch.mjs`: the rule in `state.ts` read as A or as B, `seedState` writing it `true`, a closing
check holding R1's items with R8 for this store's rows, and the composed markers in `cli.ts`), and
runs `bun test ./tests` in each:

```
== bun test in base
 1096 pass
 2 skip
 0 fail
== bun test in A
 1093 pass
 2 skip
 3 fail
== bun test in B
 1095 pass
 2 skip
 1 fail
== failing only under A
(fail) --force past a verification only keeps its existing words, with a good table [357.90ms]
(fail) --force past both says both, verification first, and a later note keeps the marker [358.77ms]
(fail) Getting-Started, every command in order, ends in the accepted close and a green gate [1683.40ms]
== failing only under B
(fail) Getting-Started, every command in order, ends in the accepted close and a green gate [1675.56ms]
```

(the `Ran 1098 tests across 57 files` lines left out). The walkthrough's failure under both is the
stand-in's own words: `mstack: greet-flag cannot close: PROBE it has no mutation run`.

The two under A are `tests/r-table-check.test.ts:387-395` and `:397-414`: their state comes from
`state()`, with no key, and a stand-in close past the verification check also overrode this one
(`it is stored in state.json as "closed unverified, without a good requirement-to-test table and
without a killed mutation receipt (forced): ..."`). With `state()` writing the rule `false`,
`helper.sh` gives `40 pass, 0 fail` for that file under A. The walkthrough fails under both,
because `setup` writes the key `true` under either answer. The stand-in has no R16, R19 or R24;
for those the tests were read: `rg` finds no test that clears a marked `closed_by` or closes
under a lock, and two that start a run with an untracked test file (`tests/mutation-run.test.ts:113`,
`tests/mutation-changed.test.ts:90-100`). Rung 4 for the stand-in, rung 3 for the three read.

**R26 and R28** (`spec100r3/probe.sh`): an archive copy of `a2b5f8d` with that stand-in under
answer A, `state()` writing the rule `false` (as the round 2 review ran it), and `patch-nb1.mjs`
(R26: a change of `size`, `base` or `verification` of an item R1 holds, left at `verifying`, exits
2 without `--closed-by`; R28: `done` runs the closing checks on a copy of the item taken before
the clears) gives `1095 pass`, `2 skip`, `1 fail`, the failure the walkthrough with the stand-in's
`PROBE it has no mutation run`, as the review measured without the patch; no test met the R26
refusal (`PROBE-R26` in the output: 0). Rung 4 for the stand-in; R27's row is not in it.

## Usage

A sketch of the shape below, not a run (task 1.2 pastes real output into the wiki):

```
$ mstack gate --quiet
[fail]  1 greet (verifying) is one step from done, and it has no mutation run, so nothing has shown that its tests fail without its code -> run 'mstack verify --mutation' alone and last (it runs the verification twice); where it is refused, or the tests cannot notice the code (a refactor), 'mstack state set greet --status done --force --closed-by "<why>"' closes it on the record
$ mstack verify --mutation
...
mutation-killed: `sh tests/check.sh` failed without the change (exit 1; a build failure and an assertion failure look the same here)
$ git switch main && git merge --squash feat/greet && git commit -m "feat: shout (#1)"
$ mstack gate --quiet          # nothing about the mutation check: R12 and R13 hold the row
$ mstack state set greet --status done --closed-by "PR #1 merged as 7588b18"
```

The first close a new user makes, in Getting-Started, gains one command between the reviewer's
`gate --full` and its ledger row: `mstack verify --mutation`, at `reviewing`, which printed the
block in `spec100r2/walk.out` (killed, 1 s).

## Shape

- `src/size.ts`: `measureStart(store, base, at?)` with `at = { head?: string; against?: string[] }`;
  the defaults are `HEAD` and the default branch's refs (`forkPoint`, `:102-109`), so the callers
  do not change. The start at S is `measureStart(store, base, { head: S, against })`.
- `src/mutation-close.ts` (new):
  - `MUTATION_CHECK = "mutation"`, `mutationCheck: ClosingCheck` with `reportedAt: []`, appended
    to `CLOSING_CHECKS`. `run` returns `[]` when the rule is off, R1 does not hold the item, or the
    lock exists (`lockExistsIn(gitDirOf(store))`). Every problem is `overridable: true`.
  - `storesRead(store)`: this store's `verification` path, then for each record of `git worktree
    list --porcelain -z` (records end at an empty field) that is not this worktree and has no
    `prunable` line, `<path>/<prefix>/.mstack/verification.tsv`. Each is read with `readRecords`
    (`src/tsv.ts:79`) in a `try`.
  - `holds(store, item, row)`: `{ holds: true } | { holds: false; why: string; paths: string[] }`.
    First `/^[0-9a-f]{40}$/`, or `{64}` where `git rev-parse --show-object-format` prints
    `sha256`, on S, then `git cat-file -e S^{commit}` (R7); then R14 from `git ls-files -v -z` at
    the store's root, kept to in-scope `code` and `test`. "Differs from the working tree" is two
    calls, `git diff --name-only --no-renames --relative -z C --` and the same with `--cached`.
    S on HEAD's first-parent history (`git rev-list --first-parent HEAD` holds S): R8. Otherwise
    M (walking the first-parent list from HEAD, the first commit with two or more parents whose
    first parent lacks S and another parent has it, by `git merge-base --is-ancestor`), the start
    at S and P (`git diff ... <start at S> S --`), R9; with M, R10 (the working-tree diff of S
    kept to P) and R11 (`git diff ... S <M's parent with S> --`); without, Q, R12 (`git diff ...
    <Q^ or the empty tree of the object format> Q --`), R25 and R13 (the working-tree diff of
    Q). Q is looked for only among the first-parent commits not in S's history that change a path
    of P, plus the oldest of them (`git rev-list --first-parent --reverse HEAD ^S -- <P>` and
    `git rev-list --first-parent --reverse HEAD ^S`): a commit that changes no path of P has its
    first parent's content of P, so the oldest commit holding S's content of P is one of those,
    and each needs one `git ls-tree <c> -- <P>` compared with `git ls-tree S -- <P>`
    (`spec100r3/shapes.out`: the same Q as the full walk on every row that reached it, a merge of
    `develop` as Q included). R25: HEAD is ahead when `git merge-base --is-ancestor HEAD <ref>`
    fails for each default ref that resolves; then the paths of `git diff ... S Q --` less those
    of `git diff ... <start at S> <start at HEAD> --`. Every git call here runs as `git
    --literal-pathspecs` (`spec100r3/shapes.out` GLOB: `git diff --name-only S -- 'src/[id].js'`
    lists `src/i.js`, with the flag nothing), and every `git diff` has `--relative`.
  - `answer`: the decisive rows of the joined command, newest `ts` first, judged until one holds;
    then R5's precedence. A gate after one run judges one row.
- `src/cli.ts`, the `done` branch: before `closingProblems`, `readLock(store) !== null` throws a
  `UserError` with the gate's lock line (`lockProblem`, moved from `src/gate.ts:698-719` to
  `src/mutation-lock.ts`). The marker becomes `forcedMarker(checks)`; `FORCED_MARKERS` lists the
  seven; none is a prefix of another (each is `closed <phrases> (forced): `, and a phrase holds no
  `(forced)`), so the `find` at `:861` stays right. `--clear closed-by` on a marked note throws
  before `clearField` runs. One forced line per overridden check.
- `src/cli.ts`, `cmdState`'s `set`: a copy of the item is taken before the clears (`:694`), next to
  `closedByBefore` (`:687`). R28: `closingProblems` (`:759`) runs on that copy. R26: before
  `assertNotSddSmall` (`:988`), when the rule is on, the item ends at `verifying`, `heldByR1(store,
  state, copy)` (exported from `src/mutation-close.ts`) is true and `size`, `base` or
  `verification` differs from the copy's, a missing `--closed-by` throws; R27: with it, the
  `closed_by` loop skips the note, as it does for `forcedSpecSize` (`:846`), and a `mutation-scope`
  row is written after the save, as the `spec-size` row is (`:997-1006`).
- `src/mutation.ts`, `refusals`: R16 after the tracked-change refusals, from `git ls-files --others
  --exclude-standard -z`, kept to `test`.
- `src/state.ts`: `require_mutation_to_close` in `State.rules`, the parse and `KNOWN_RULE_KEYS`;
  `src/setup.ts`: `seedState` writes it `true`. This repository's `state.json` gets the key `true`.

Cost, at `verifying` only: one `git worktree list`, one TSV read per worktree, one `measureStart`
and one `git diff` for the code diff, one `ls-files -v`, and per row judged a `rev-list`, two or
three `git diff`, and for a row with no merge one more `rev-list` and one `ls-tree` per commit
that changed a path of P on the first-parent history. A gate after one run judges one row.

## Rejected alternatives

- **The review's Qb** (Qab without clause (a)). Five shapes pass that should not: V5D, AM1, AM2,
  RB2, W1 (`specreview100/shapes.out`).
- **R5's `lstat` test in front of Qab's clauses**, as the review words it: redundant for tracked
  files and wrong for DELU (above).
- **Q for a merge commit too**, one rule for every merge. M's own change against its first parent
  is everything the branch brought, so OCT (an octopus with another branch) and other work after
  a merge commit would void; R10 and R11 hold both, correctly.
- **The round 2 review's clause as it words it** ("where the start at HEAD can be computed, a
  path that is not in P differs between the start at HEAD and Q"). It voids six shapes that hold
  (C2B, D2B, SUB-sq, SUB-rb, SHA256-sq, PREBASE; Fact 4), among them the ordinary squash of an
  item started from `mstack worktree new` after `main` moved; R25 holds all six and gives up IREBF
  on `main` (still void on the branch).
- **A rule that closes CPR from the branch's ref**: find each commit of `S..feat/greet` by its
  patch id among the first-parent commits before Q. It works only while a ref to the branch's
  commits exists, which the merge often ends (a forge's branch auto-delete, `git branch -d`); with
  the ref gone the answer changes for the same tree.
  **By the author date** of the commits before Q: the other item's commit on `main` was authored
  after the run too, and dates are the committer's to set.
- **Recording the item's commits at the run** (the round 2 hand-off's "no" to fork 2). Commits made
  after the run are not in the record, so after a rebase merge or a fast-forward the record finds
  an after-run change only where it sits among the copies of the item's recorded commits, between
  them or folded into one (IREBR, IREBXR, IREBCR, IREBF); CPR (moved before all of them), PRE,
  PRER, PRERB, PREO, PREOM, MCF and MCF3 land outside them and stay unseen (argued, rung 2). Closing the class needs every commit
  tied to its item when it is made (a trailer, or a hook that records it), and then only for the
  commits that carry the tie.
- **R26 for every item at `verifying`**, as the review words it. Three fixes the gate already
  prints at `verifying` would then be refused: the size check's `--size m` and `--base <commit>`
  for a size `s` item (`src/gate.ts:297-333`) and `gate --full`'s `--verification "<command>"`
  for an item with no obligation (`src/gate.ts:800-810`). None of those items is held by R1, and
  no edit to an item R1 does not hold can take it out of this check, so R26 reads R1.
- **Item 42's key on the branch, the round 1 review's C' only after a merge.** The key depends on
  the checkout's untracked files (a linked worktree's row read in the main checkout was void by
  the key, `2c63a070` there and `f5d6dd16` here, with an untracked `notes.txt`), and R8 is the same
  comparison on tracked paths.
- **C' from the base.** A branch rebased before its run has a base outside S's history (RE2, RE3),
  and after a merge commit the start at S is lost when `main` holds S.
- **Rows of this store only.** The `mstack worktree new` flow would never answer the check where
  the merge lands (WT1: 0 rows there), and no new run is possible there.
- **Closing before the merge.** Refused by the coordinator in item 42's round 2; a squash-merge
  consumer's close commit would then need a second merge.
- **Writing the start into the row.** Exact for rows from now on and closes BASES for them, but
  rows already written have none; R9 closes BASES for every row.
- **A closing-time void for an untracked test, in place of R16.** It cannot see a test that was
  untracked at the run, earned the kill and was then deleted: the tracked tree equals S and R8
  holds. Only a refusal at the run sees it. R16 makes item 42's two untracked-test scenarios
  unreachable for a test file; both mechanisms (R2's key check during the baseline, R18's (e)) are
  still reached by an untracked code file, so task 1.5 moves the two tests to one.
- **Refusing `--base` at `verifying`** outright, against the `--base HEAD` way out. It cannot tell
  the dodge from R3's own way out after a squash (`--base Q^`, which empties the code diff of an
  item with no code), nor from the way out for an item with no code after a merge commit; R26 asks
  for the reason instead and R27 records it. **Recording every base move after `in_progress`**
  would also cover an edit made at `reviewing` and then moved to `verifying`; it would record the
  size check's own `--base` fix at `in_progress` too, and the acceptance asks for the record at the
  close.
- **Holding an item with no obligation**, against the `--clear verification` way out. No run can be
  made for it, so every item of a store without a `verify` would close only by `--force`; the
  verification check lets such an item close with a warning for the same reason
  (`src/gate.ts:756-765`).
- **The Getting-Started item made size `s`, or the page turning the rule off.** The page would
  teach that the check is optional, and a new user's first real item would meet it at the close
  with a line the page never showed.
- **The CLI making its own copy in an mstack checkout.** It changes item 42's R5, and the hooks of a
  session started with `--plugin-dir .` would still run the reverted `src/`.
- **A non-overridable problem when the code diff cannot be computed.** After a squash merge of a
  branch-based item that is every close, with no way out but `--base`.

## Trade-offs accepted

- **The class of misses** (above) is not seen. It is the user's to accept: the hand-off's second
  fork.
- **The voids that should hold** (above): close right after the merge, or force.
- **R25 reads only on the branch.** On the default branch a commit before Q cannot be told from the
  default branch's own work, and reading there voids the ordinary squash of an item whose base is
  a commit of `main` (Fact 4, against the review's clause); IREBF is the shape that costs.
- **`--base` moved to a commit after the item's code** (BASEH), `--size s` and `--clear
  verification` at `verifying` each take a held item out of the check. R26 and R27 put each on the
  record with its reason, and R28 judges `--status done --clear verification` before the clear. An
  edit made at `reviewing` and then carried to `verifying` by a second command is not recorded: it
  is printed and lands in the `state.json` the close commit carries, as every edit of what the item
  declares does, and R3's fix says never HEAD.
- **An ignored in-scope test file can still earn a kill** (the round 2 review's IGN and GITIG: a
  scratch test under an ignore rule bit, the committed test did not, and after the scratch test is
  deleted the row holds by R8). R16 leaves ignored files alone so that a log or build output under
  `tests/` (`tests/out.log` is a `test` path to the classifier, `src/pathclass.ts:11`) does not
  refuse every run; its fix no longer suggests `.gitignore`.
- Other work outside the item's paths that changes whether its tests bite (a shared helper, a
  runner setting) is not seen after a merge commit (R10 reads the item's paths only).
- An item with no code of its own, merged with a merge commit after the default branch gained
  other code, or squash- or rebase-merged from a base on its branch, is held after the merge; the
  way out is `--base` with the commit before the merge and a `--closed-by` reason (R26), or the
  forced close.
- `git worktree remove` deletes a linked worktree's receipts, with exit 0. Close first (task 1.4).
- A kill does not say the tests check behaviour (fact 3); the check makes "nothing noticed" a
  recorded decision.
- In this repository every item with code runs from a copy of the CLI outside the tree (fact 1),
  about one suite run on top of `gate --full` (item 42's: 198 s), from a session not started with
  `--plugin-dir .`.
- A run in a linked worktree does not refuse `done` in the main checkout (R24). The run reverts
  that worktree's files only, the close judges this tree, and a run in progress has no row yet, so
  the close is answered by rows that exist or not at all.

## Open questions

- Should `mstack worktree prune` leave out a worktree whose store holds a row for an open item?
  Deferrable: the gate says "no mutation run" after the loss.
- Should the gate say which requirement held a receipt? Deferrable: no closing check prints a line
  when it passes today.
