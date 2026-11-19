> Source: item 100 (`./bin/mstack state show 100`), split from item 42 by the user's decision of
> 2026-11-19 (decisions.tsv 08:27:17Z), and `.mstack/progress/spec_review_mutation-check_r2.md`
> finding B3 (rule C-prime, its two companions, its table of five cases). This spec is
> authoritative for implementation; the item remains the discussion venue. The mechanism it reads
> is item 42's, `.mstack/specs/mutation-check/spec.md`, and nothing here restates it.

| Acceptance bullet of item 100 | Covered by |
|---|---|
| A1: From verifying, an item with base, size other than s and a code diff needs a killed receipt at the current code and test tree, enforced in the gate and at the done transition | R1, R2, R3, R4 |
| A2: A killed receipt proven on the item branch still holds on the default branch after a merge commit, a squash merge and a rebase merge, and is void when a code or test path of the item changed after the run | R4, R5, R6, R7, R8 |
| A3: An item already in flight when the check lands has a stated way to close, and a forced close past the check is on the record | R3 (the problem names both ways), R9, R10 |
| A4: state set --status done is refused while a mutation lock exists | R11 |

Two readings of the acceptance are decisions, recorded in decisions.tsv (phase `spec`, this
item): R1 also leaves out an item with no obligation, since no run can be made for it (item 42's
R1) and the verification check only warns for such an item (`src/gate.ts:756-765`); and "the
current code and test tree" is the tracked code and test content (R4, R5): an untracked file is
never a path of the item, and R8 keeps one from earning a kill. R10 depends on the fork in
`.mstack/progress/spec_mutation-closing-check.md`; every other requirement fits either answer.

## Terms

- *The rule* is `rules.require_mutation_to_close` in `.mstack/state.json`.
- *In scope*, *class*, *the lock* and *the CLI that wrote the lock* are as in item 42's Terms.
- *The start at HEAD* is item 42's *start*, `measureStart(store, base)` (`src/size.ts:81`).
- *The code diff* is the set of tracked in-scope `code` paths whose content or mode differs between
  the start at HEAD and the working tree. An untracked file is never in it.
- *The joined command* is the item's obligations (`obligations`, `src/verification.ts:106`) joined
  with ` && `, as item 42's R20 writes `command`.
- *A row* is a line of a `verification.tsv` whose `target` is the item's slug and whose `outcome`
  is `mutation-killed`, `mutation-survived` or `mutation-blocked`; it is *decisive* when killed or
  survived. *S* is its `sha`.
- *The stores read* are this store, and, for every other worktree that `git worktree list
  --porcelain` names, the store at the same path below that worktree's top as this store's root
  is below this worktree's top (`git rev-parse --show-prefix`).
- *HEAD's first-parent history* is what `git rev-list --first-parent HEAD` lists.
- *The merge that brought S in* is the merge commit M on HEAD's first-parent history whose first
  parent does not have S in its history and one of whose other parents, *M's parent with S*, does.
- *The start at S* is what `measureStart` answers with S in HEAD's place and, as the default
  branch, M's first parent when a merge brought S in, else `refs/heads/<default>` and
  `refs/remotes/origin/<default>` as they are now.
- *The item's paths of a row* are the in-scope `code` and `test` paths that differ between the start
  at S and S.
- *A path holds S's content* when the working tree has a regular file there whose blob (as `git
  hash-object` computes it) and mode (`100755` when the owner may execute it, else `100644`) are
  S's, or nothing there where S lacks the path.

## ADDED Requirements

### Requirement: R1 Who is held to the check
WHILE the rule is on, the system MUST hold to the check every item with a `base`, a size other
than `s` (no size included), at least one obligation, and a code diff that is not empty or cannot
be computed (R2), reporting it in `mstack gate` while that item is the active item at `verifying`
and no lock exists, and in `state set <slug> --status done`; and it MUST report the check for no
other item.

#### Scenario: The gate at verifying
- **WHEN** item 1 `greet`, with a base and no size, is at `verifying`, `src/greet.js` differs from
  its base, and no row exists
- **THEN** `mstack gate --quiet` exits 1 with a line that contains `1 greet (verifying) is one step
  from done` and `has no mutation run`

#### Scenario: The done transition
- **WHEN** `mstack state set greet --status done` runs for that item
- **THEN** it exits 2, its stderr contains `has no mutation run`, and `greet` is still `verifying`

#### Scenario: Items not held
- **WHEN** the item at `verifying` has no base; or has size `s`; or changed only
  `tests/greet.test.mjs` and `docs/greet.md`; or has only an untracked `src/wip.js`; or
  `state.json` has `"verify": ""` and the item has no `verification`
- **THEN** `mstack gate` prints no line containing `mutation run`, and `state set greet --status
  done` prints no such line either

#### Scenario: Before verifying, and under a lock
- **WHEN** the item with a code diff and no row is at `reviewing`; or it is at `verifying` while a
  lock exists
- **THEN** `mstack gate` prints no line containing `mutation run`; under the lock its one failure
  is the lock's line

### Requirement: R2 A code diff that cannot be computed
IF the item's base is not a commit git can find, or the start at HEAD is lost, or git cannot list
the code diff, THEN the system MUST hold the item, and, when no killed row answers the check (R3),
its problem MUST say which of these held and name `mstack state set <slug> --base <commit>`.

#### Scenario: A squash merge with no run
- **WHEN** `feat/greet`, whose base is a commit on that branch, is squash-merged into `main`, the
  item is at `verifying` on `main`, and no row exists
- **THEN** the gate's line says the start of `greet` is lost and names `mstack state set greet
  --base <commit>`, and `state set greet --status done --force --closed-by "no run was made"` is
  not refused by this check

#### Scenario: An item with no code of its own, after a squash
- **WHEN** an item that changed only `docs/notes.md` is squash-merged as commit Q, and then `mstack
  state set notes --base Q^` runs
- **THEN** `mstack gate` prints no line containing `mutation`

#### Scenario: A base that is not a commit
- **WHEN** the item's base is `deadbeef` and no row answers the check
- **THEN** the gate's line says the base `deadbeef` is not a commit git can find and names `mstack
  state set greet --base <commit>`

### Requirement: R3 What answers the check, and what the problem says
The system MUST answer the check with the newest row by `ts` among the decisive rows of the stores
read whose `command` is the joined command and that hold (R4 to R6): a `mutation-killed` row
reports nothing and a `mutation-survived` row reports that the last run survived; with no such
row it MUST report the first that is true of: decisive rows of the joined command exist and none
holds (naming the newest one's commit and the paths that changed since), only blocked rows of it
exist, rows exist only for another command (naming the newest one's command), no row exists; and
every problem MUST name `mstack verify --mutation` and the forced close of R9, and, in a checkout
of mstack itself (`isMstackCheckout`, `src/paths.ts:122`), the commands that run it from a copy of
the CLI outside the tree.

#### Scenario: A killed run answers it
- **WHEN** `mstack verify --mutation` ended `mutation-killed` and nothing changed since
- **THEN** `mstack gate` prints no line containing `mutation`, and `state set greet --status done`
  prints no line containing `mutation`

#### Scenario: Survived, and the newest decides
- **WHEN** a `mutation-killed` row is followed, at the same commit, by a `mutation-survived` row
- **THEN** the gate's line says the last mutation run of `greet` survived and names its commit

#### Scenario: Blocked rows
- **WHEN** a `mutation-killed` row is followed by a `mutation-blocked` row; or the only row is
  `mutation-blocked`
- **THEN** in the first case nothing is reported, and in the second the line says its mutation
  runs were blocked

#### Scenario: The verification was edited after the run
- **WHEN** the killed run ran `sh tests/check.sh`, and then `state set greet --verification "sh
  tests/check.sh && true"` runs
- **THEN** the gate's line names `sh tests/check.sh` as the command the last run ran

#### Scenario: The way out is named
- **WHEN** any of the problems above is reported
- **THEN** its fix contains `mstack verify --mutation` and `--force --closed-by`, and, where the
  store's root holds `.claude-plugin/plugin.json` naming `mstack`, also `git worktree add --detach`

### Requirement: R4 A row whose commit is on HEAD's first-parent history
WHEN a row's S is on HEAD's first-parent history, the system MUST count the row as holding exactly
when no tracked in-scope `code` or `test` path differs between S and the working tree.

#### Scenario: What keeps it
- **WHEN** after the killed run `docs/notes.md` and `.mstack/state.json` are committed; or `main`
  is fast-forwarded to the branch; or an untracked `notes.txt` and `tests/untracked.test.mjs`
  are created
- **THEN** the row holds

#### Scenario: What voids it
- **WHEN** after the killed run `tests/helpers.test.mjs` is committed; or `src/greet.js` is edited
  and not committed
- **THEN** the row does not hold, and the gate's line names that path

#### Scenario: Other work after a fast-forward
- **WHEN** `main` is fast-forwarded to the branch and then another item's commit changing
  `src/other.js` lands on `main` before the close
- **THEN** the row does not hold, and the line names `src/other.js`

### Requirement: R5 A row whose commit is not on HEAD's first-parent history
WHEN a row's S is not on HEAD's first-parent history, the system MUST count the row as holding
exactly when S is a commit git can find, the start at S is found, and every one of the item's
paths of the row holds S's content, unless R6 applies.

#### Scenario: The three merges, the default branch moved or not
- **WHEN** after a killed run on `feat/greet` the branch reaches `main` by a merge commit, a squash
  merge, or a rebase merge (its commits rewritten onto `main`), each once with `main` unchanged
  since the fork and once with `main` holding another item's `src/other.js` and
  `tests/other.test.mjs`
- **THEN** in all six the row holds on `main`, and `state set greet --status done` prints no line
  containing `mutation`

#### Scenario: The default branch changed the item's file
- **WHEN** `main` changed line 1 of `src/greet.js`, the item changed line 4, and the branch is then
  merged with a merge commit
- **THEN** the row does not hold, and the line names `src/greet.js`

#### Scenario: A rebased branch
- **WHEN** the branch is rebased onto a moved `main` after the killed run and stays a branch; or it
  is rebased before the run, and then squash-merged or merged with a merge commit
- **THEN** the row holds

#### Scenario: Docs after the run, and a commit git cannot find
- **WHEN** `docs/notes.md` is committed on the branch after the run and the branch is squash-merged;
  or a row's `sha` names no commit in the repository
- **THEN** the first row holds, and the second does not

### Requirement: R6 A change on the merged branch after the run
IF a merge brought S in and an in-scope `code` or `test` path differs between S and M's parent with
S, THEN the system MUST NOT count the row as holding, and the problem MUST name that path.

#### Scenario: A test added after the run, then a merge commit
- **WHEN** `tests/helpers.test.mjs` is committed on `feat/greet` after the killed run, `main` gains
  another item's code, and the branch is merged with a merge commit
- **THEN** the row does not hold, and the gate's line on `main` names `tests/helpers.test.mjs`

#### Scenario: Docs after the run, then a merge commit
- **WHEN** only `docs/notes.md` is committed on the branch after the run before the merge commit
- **THEN** the row holds

### Requirement: R7 Rows from the other worktrees
The system MUST read rows from the `verification.tsv` of every store read and judge each against
this working tree by R4 to R6, and a file of another worktree that is missing or cannot be read
MUST give no rows and no failure.

#### Scenario: A run in a linked worktree, closed in the main checkout
- **WHEN** the killed run was made in a linked worktree on `feat/greet`, and the main checkout then
  merges `feat/greet` with a merge commit
- **THEN** the main checkout's `mstack gate` prints no line containing `mutation`, though its own
  `verification.tsv` holds no row

#### Scenario: An untracked file in the linked worktree, then a fast-forward
- **WHEN** the linked worktree held an untracked `notes.txt` during the killed run and `main` is
  fast-forwarded to the branch
- **THEN** the row holds in the main checkout

#### Scenario: The worktree removed first, and a store that cannot be read
- **WHEN** `git worktree remove` removed the linked worktree before the close; or another
  worktree's `.mstack/verification.tsv` is a directory
- **THEN** in the first case the line says there is no mutation run; in the second the gate
  reports no failure for that file and its answer is the one it gives without that worktree

### Requirement: R8 No run while an untracked test file is in scope
IF an untracked, not ignored, in-scope file that the classifier calls a test exists when `mstack
verify --mutation` runs, THEN it MUST exit 2 before the baseline, name up to ten such files, say
that a kill earned by a test that is not committed would answer the closing check without that
test, and write no lock, no run directory and no row.

#### Scenario: An untracked test
- **WHEN** `tests/new.test.mjs` is untracked and not ignored
- **THEN** `verify --mutation` exits 2 naming `tests/new.test.mjs`, `verification.tsv` is
  unchanged, and no lock exists

#### Scenario: What this rule does not refuse
- **WHEN** the only untracked files are `tests/out.log`, ignored by `.gitignore`, and `notes.txt`
- **THEN** the run is not refused by this rule

### Requirement: R9 A forced close past the check is on the record
WHEN `state set <slug> --status done --force --closed-by "<why>"` closes an item past a problem of
this check, the system MUST print `  forced: closed without a killed mutation receipt - <the
problem>`, store in `closed_by` the marker of the checks it overrode followed by `<why>`, keep that
marker in front of any later `--closed-by`, and leave the three markers that exist today
(`src/cli.ts:294-298`) byte-identical for the closes they cover; the marker is `closed `, then the
phrases `unverified`, `without a good requirement-to-test table` and `without a killed mutation
receipt` of the checks overridden, in that order, joined as `a`, `a and b` or `a, b and c`, then `
(forced): `; and without `--closed-by` it MUST exit 2 leaving the item unchanged.

#### Scenario: A refactor
- **WHEN** an item at `verifying` whose last run survived is closed with `--force --closed-by "pure
  refactor, behaviour unchanged"`
- **THEN** it exits 0, stdout contains `forced: closed without a killed mutation receipt - `, and
  `closed_by` is `closed without a killed mutation receipt (forced): pure refactor, behaviour
  unchanged`

#### Scenario: A later note, and no reason
- **WHEN** `state set greet --closed-by "merged in #12"` runs after that close; or `--force` is given
  without `--closed-by`
- **THEN** `closed_by` is `closed without a killed mutation receipt (forced): merged in #12`; and
  the second exits 2 with `greet` still `verifying`

#### Scenario: More than one check overridden
- **WHEN** the close overrides the verification check and this one; or all three overridable checks
- **THEN** `closed_by` starts `closed unverified and without a killed mutation receipt (forced): `;
  or `closed unverified, without a good requirement-to-test table and without a killed mutation
  receipt (forced): `

#### Scenario: Today's markers, and the gate afterwards
- **WHEN** a forced close overrides only the verification check, only the table, or both; and
  `mstack gate` runs after any forced close
- **THEN** `closed_by` starts `closed unverified (forced): `, `closed without a good
  requirement-to-test table (forced): ` or `closed unverified and without a good
  requirement-to-test table (forced): `; and the gate prints no line about the closed item's
  mutation check, while `state show greet` prints its `closed_by`

### Requirement: R10 The rule
The system MUST hold items to the check only while the rule is `true`, MUST read a `state.json`
whose `rules` lacks the key as **[fork: A `true` / B `false`]**, MUST keep the key and its value
when it rewrites `state.json`, and `mstack setup` MUST write it as `true`.

#### Scenario: The rule off
- **WHEN** `"require_mutation_to_close": false` and an item at `verifying` has a code diff and no row
- **THEN** `mstack gate` prints no line containing `mutation run`, and `state set greet --status
  done` prints none either

#### Scenario: A store that predates the rule
- **WHEN** `state.json`'s `rules` has no `require_mutation_to_close` and the same item is at
  `verifying`
- **THEN** under answer A the gate fails with `has no mutation run`; under answer B it prints no
  such line

#### Scenario: Setup, and a rewrite
- **WHEN** `mstack setup` creates a store; and, in a store whose rule is `false`, `state set greet
  --title "Greet"` runs
- **THEN** the new `state.json` has `"require_mutation_to_close": true`; and the rule is still
  `false` afterwards

### Requirement: R11 `done` is refused under a lock
WHILE the lock exists, `state set <slug> --status done` MUST exit 2 with `state.json` unchanged,
whatever `--force`, `--closed-by` and the rule say, naming the lock and the way out the gate's lock
line gives (item 42's R27 and R25).

#### Scenario: The lock of a run that is not running
- **WHEN** an item at `verifying` with a killed row is closed with `--force --closed-by x` while the
  lock of a dead pid exists
- **THEN** it exits 2, stderr names the lock's path and `<the CLI that wrote the lock> verify
  --restore`, and the item is still `verifying`

#### Scenario: A live run, and a lock that cannot be read
- **WHEN** the lock's run is alive; or the lock holds `garbage`
- **THEN** it exits 2 saying to wait for the run; or exits 2 naming `git stash push
  --include-untracked`

#### Scenario: The rule off, and another transition
- **WHEN** the rule is `false` and the lock exists; and `state set greet --status in_progress` runs
  under the lock
- **THEN** `done` is still refused; and the move to `in_progress` is not refused by this rule
