## Context

Each fact was read at the cited line on `feat/mutation-closing-check` at `7d2d42b`, or measured by
a script under the session scratchpad: round 1's in `spec100/`, the review's in `specreview100/`,
round 2's in `spec100r2/` (absolute:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/spec100r2/`),
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

### Fact 4: the shapes, under three wordings

`spec100r2/shapes.sh` rebuilds every shape of both earlier passes on one seed (item `greet` on
`feat/greet`, base the branch's first commit, `src/greet.js` and its test changed, a real `verify
--mutation`, `mutation-killed`), adds four (`w2.sh` rebuilds W2 and `bases0.sh` adds BASESM0),
and judges each three ways:
**Round 1**, the round 1 spec's words, and **Qab**, the review's rule, both by the review's
emulation `rv.mjs` (copied unchanged); **This spec**, by `rule.mjs`, written fresh from Terms and
R1 to R15, whose output names the requirement that voided each row. Git's answers are rung 4;
every verdict is rung 3 (emulated; no code exists). "Main moved" means another item's
`src/other.js` and `tests/other.test.mjs` landed on `main` first; a rebase merge is `git
cherry-pick` onto `main` with a later committer date. `pass` is the check answered, `held` it is
not.

| Shape | Round 1 | Qab | This spec | Voided by |
|---|---|---|---|---|
| on the branch right after the run | pass | pass | pass | - |
| A fast-forward | pass | pass | pass | - |
| B, E merge commit, main not moved / moved | pass | pass | pass | - |
| C, C2 squash, main not moved / moved | pass | pass | pass | - |
| D, D2 rebase merge, main not moved / moved | pass | pass | pass | - |
| V4 main edited line 1 of `src/greet.js`, merge commit | held | held | held | R10 `src/greet.js` |
| V5B test after the run, merge commit | held | held | held | R11 `tests/helpers.test.mjs` |
| V5C test after the run, squash | **pass** | held | held | R12 `tests/helpers.test.mjs` |
| V5A test after the run, fast-forward | held | held | held | R8 |
| V6 code edit after the run, on the branch | held | held | held | R8 |
| V7 docs after the run, squash | pass | pass | pass | - |
| L fast-forward, then other work before the close | held | held | held | R8 `src/other.js` |
| U untracked `notes.txt` and test after the run | pass | pass | pass | - |
| RE1 rebased after the run; RE2, RE3 rebased before, then squash or merge commit | pass | pass | pass | - |
| V5D test after the run, rebase merge | **pass** | held | held | R13 |
| AM1, AM2 amend after the run adding a test, or `src/other.js` | **pass** | held | held | R13 |
| AM3 amend changing `src/greet.js` | held | held | held | R13 |
| RB2 rebased after the run, then a test committed | **pass** | held | held | R13 |
| RS `reset --soft` and one recommit with a test | **pass** | held | held | R12 |
| CPR rebase merge, the after-run test commit reordered first | pass | pass | **pass** | - (the miss) |
| RV1 revert and reapply, same content, squash | pass | pass | pass | - |
| RV2 reapplied with different content, squash | held | held | held | R12 (no Q) |
| OCT octopus merge with another branch | pass | pass | pass | - |
| OCT2 the same, a test after the run | held | held | held | R11 |
| FPB main merged into the branch after the run, fast-forward | held | held | held | R8 |
| REN, FLIP renamed, or the test moved to `docs/`, squash | held | held | held | R12 (no Q) |
| MODE `chmod +x src/greet.js` after the run | held | held | held | R8 |
| MODE2 `chmod +x src/other.js` after the run, squash | **pass** | held | held | R12 `src/other.js` |
| C3 squash, then another item's code before the close | pass | held | **held** | R13 `src/other.js` (the cost) |
| TWO squash, then another item edits `src/greet.js` | held | held | held | R13 |
| INTEG branch into `develop`, `develop` into main | held | held | held | R11 |
| BASES `--base <S>` after a void, then squash | **pass** | held | held | R9 (P empty) |
| BASESM the same, then a merge commit | held | held | held | R9 (P empty) |
| BASESM0 (`bases0.sh`) `--base <S>` with no edit, main moved, merge commit | **pass** | held | held | R9 (P empty) |
| BASEH `--base HEAD` after a void, on the branch | not held | not held | not held | - (N1, trade-offs) |
| W1 a row of an abandoned attempt in a linked worktree | **pass** | held | held | R13 `src/extra.js` |
| SHA a hand-written row whose `sha` is `HEAD` | **pass** | **pass** | held | R7 |
| FLAG, W3 `assume-unchanged` then an edit | **pass** | **pass** | held | R14 |
| W2 (`w2.sh`) a `prunable` worktree record with a forged row | **pass** | **pass** | held | Terms, stores read |
| DELU the item deletes `src/other.js`, squash, untracked `src/other.js` | pass | **held** | pass | - |
| WT1, WT2 a linked worktree's row, merge commit or fast-forward | pass | pass | pass | - |
| WTRM the linked worktree removed first | held | held | held | no row |

On the 19 shapes of round 1 (the seed, A to V7, L, U, RE1 to RE3, V5C) all three agree except
V5C. On the review's 24 (V5D to BASEH, W1 to W3) this spec gives Qab's answer on every one but W2
and W3. Where it differs from Qab it is for a finding of the review applied (SHA: non-blocking 5;
FLAG, W3: 6; W2: 3) or for DELU, below.

**Checked against the review's definition.** Qab as worded has R5's own test of the working tree
(`lstat` and `hash-object`) in front of its two clauses. Given clause (a) (nothing differs between
Q and the working tree) and Q's definition (every path of P has S's blob and mode at Q), that test
adds nothing for a tracked file; it only sees an untracked file, and on DELU it voids a receipt
because an untracked `src/other.js` sits where the item deleted one, while R8 holds the same tree
on the branch. So this spec states "differs from the working tree" once, as `git diff` against
the commit (Terms), for R8, R10 and R13 alike, and catches the edit `git diff` cannot see by R14.
No clause of Qab can go. Without (ii) V5C, RS and MODE2 pass, and without (a) V5D, AM1, AM2, RB2
and W1 pass (the review's Qb column; each is a row above). Without (i), an empty P after a squash
makes Q the first commit, whose own change already voids by (ii), so (i) decides alone only after
a merge commit: `bases0.sh` moves the base to the run's commit, lets `main` move and merges, and
round 1's words, which in the merge case are Qab less (i), answer the check with a row that
covers nothing (`SPEC1=PASSES | Qab=HELD (no holding row) | P=[] | MINE=HELD | ... void R9 P
empty`).

### What the rule misses, and what it voids that should hold

- **Misses: CPR.** A rebase merge that puts a commit made after the run before the item's code:
  Q is the code's commit, the test commit is older than Q, and nothing in git separates it from
  the default branch's own earlier work. It is the one shape measured where a code or test path of
  the item changed after the run and the receipt still holds.
- **Correct holds, not misses:** RV1 (the content at the close is the content the run saw; a
  receipt is about content, as R8 already is on the branch) and OCT (the other branch's paths are
  not the item's; R11 still sees an after-run change on the item's branch, OCT2).
- **Voids that should hold:** C3, other work landing on the default branch between a squash or
  rebase merge and the close (R13), and L, the same after a fast-forward (R8). First-parent
  history cannot say whose commits came after Q or S. After a merge commit other work does not
  void (R10 reads the item's paths only). The way out is to close right after the merge, as
  `skills/ship/SKILL.md` step 7 already does, or the forced close.

### Fact 5: which shipped tests change (`spec100r2/probe/`)

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
    First `/^[0-9a-f]{40}$/` on S, then `git cat-file -e S^{commit}` (R7); then R14 from `git
    ls-files -v -z` at the store's root, kept to in-scope `code` and `test`. S on HEAD's
    first-parent history (`git rev-list --first-parent HEAD` holds S): R8, `git diff --name-only
    --no-renames --relative -z S --`. Otherwise M (walking the first-parent list from HEAD, the
    first commit with two or more parents whose first parent lacks S and another parent has it,
    by `git merge-base --is-ancestor`), the start at S and P (`git diff ... <start at S> S --`),
    R9; with M, R10 (`git diff ... S -- <P>`) and R11 (`git diff ... S <M's parent with S> --`);
    without, Q, R12 (`git diff ... <Q^ or the empty tree> Q --`) and R13 (`git diff ... Q --`).
    Q is looked for only among the first-parent commits that change a path of P, oldest first
    (`git rev-list --first-parent --reverse HEAD -- <P>`, then the root commit): a commit that
    changes no path of P has its first parent's content of P, so the oldest commit holding S's
    content of P is one of those, and each needs one `git ls-tree <c> -- <P>` compared with `git
    ls-tree S -- <P>` (`spec100r2/qcheck.mjs`: the same Q as the full walk on the 23 shapes with no
    merge commit, rung 4 for git). Every `git diff` here has `--relative` (review non-blocking 7).
  - `answer`: the decisive rows of the joined command, newest `ts` first, judged until one holds;
    then R5's precedence. A gate after one run judges one row.
- `src/cli.ts`, the `done` branch: before `closingProblems`, `readLock(store) !== null` throws a
  `UserError` with the gate's lock line (`lockProblem`, moved from `src/gate.ts:698-719` to
  `src/mutation-lock.ts`). The marker becomes `forcedMarker(checks)`; `FORCED_MARKERS` lists the
  seven; none is a prefix of another (each is `closed <phrases> (forced): `, and a phrase holds no
  `(forced)`), so the `find` at `:861` stays right. `--clear closed-by` on a marked note throws
  before `clearField` runs. One forced line per overridden check.
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
- **A rule that closes CPR from the branch's ref**: find each commit of `S..feat/greet` by its
  patch id among the first-parent commits before Q. It works only while a ref to the branch's
  commits exists, which the merge often ends (a forge's branch auto-delete, `git branch -d`); with
  the ref gone the answer changes for the same tree.
  **By the author date** of the commits before Q: the other item's commit on `main` was authored
  after the run too, and dates are the committer's to set.
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
- **Refusing `--base` at `verifying`**, against the `--base HEAD` way out. It cannot tell the dodge
  from R3's own way out after a squash (`--base Q^`, which empties the code diff of an item with no
  code), nor from the way out for an item with no code after a merge commit. **Recording every base
  move after `in_progress`** (a decision row, as `spec-size` does) would be the sound fix; it is a
  mechanism the acceptance does not need and the size check lacks too.
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

- **CPR** is not seen (above). It is the user's to accept: the hand-off's second fork.
- **C3 and L** void a receipt that should hold. Close right after the merge, or force.
- **`--base` moved to a commit after the item's code** (BASEH) empties the code diff, and the item
  closes with no marker. The base is the item's own declaration, every check trusts it (the size
  check, the table, the run itself), and the move is printed (`base: "<old>" -> "<new>"`) and lands
  in the `state.json` the close commit carries. R3's fix says never HEAD.
- **`--status done --clear verification`** in a store whose `verify` is `""` removes the only
  obligation before the checks run (`src/cli.ts:694`; `specreview100/worktrees.out` W5), and R1
  then does not hold the item. The same command already gets past the verification check; the clear
  is printed and lands in `state.json`.
- Other work outside the item's paths that changes whether its tests bite (a shared helper, a
  runner setting) is not seen after a merge commit (R10 reads the item's paths only).
- An item with no code of its own, merged with a merge commit after the default branch gained
  other code, or squash- or rebase-merged from a base on its branch, is held after the merge; the
  way out is `--base` with the commit before the merge, or the forced close.
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
