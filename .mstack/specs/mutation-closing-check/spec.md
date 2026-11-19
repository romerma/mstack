> Source: item 100 (`./bin/mstack state show 100`), split from item 42 by the user's decision of
> 2026-11-19 (decisions.tsv 08:27:17Z), and `.mstack/progress/spec_review_mutation-check_r2.md`
> finding B3. Round 2 answers `.mstack/progress/spec_review_mutation-closing-check.md` as the
> coordinator's row of 2026-11-19T18:55:36Z says (rule Qab for a receipt); round 3 answers
> `.mstack/progress/spec_review_mutation-closing-check_r2.md` as the row of 2026-11-19T20:04:24Z
> says. This spec is authoritative for implementation; the item remains the discussion venue. The
> mechanism it reads is item 42's, `.mstack/specs/mutation-check/spec.md`, and nothing here
> restates it.

| Acceptance bullet of item 100 | Covered by |
|---|---|
| A1: From verifying, an item with base, size other than s and a code diff needs a killed receipt at the current code and test tree, enforced in the gate and at the done transition | R1, R2, R3, R4, R5, R7, R8, R14, R28 |
| A2: A killed receipt proven on the item branch still holds on the default branch after a merge commit, a squash merge and a rebase merge, and is void when a code or test path of the item changed after the run | R8 to R13, R15, R16, R25 |
| A3: An item already in flight when the check lands has a stated way to close, and a forced close past the check is on the record | R6, R17, R18, R19, R20, R21, R22, R23, R26, R27 |
| A4: state set --status done is refused while a mutation lock exists | R24 |

Readings of the acceptance that are decisions (decisions.tsv, phase `spec`, this item): R1 leaves
out an item with no obligation, as the verification check does (it only warns,
`src/gate.ts:756-765`), so A1 is met for every item a run can be made for; "the current code and
test tree" is the tracked code and test content, in the working tree and in the index, so an
untracked file never voids a receipt and R16 keeps one from earning it, except an ignored one: R16
leaves ignored files alone so that a log under `tests/` does not refuse a run, and so an ignored
test file can still earn a kill (design.md, "Trade-offs accepted"); "a mutation lock" is this
checkout's (R24). A2 is met for every shape measured except one class: a change the item makes
after its run, at a file the run's commit had not changed, that reaches the default branch by a
route other than the item's own merge (design.md, "What the rule misses"); that exception waits
for the user's answer (fork 2). A3's "on the record" also covers an edit at `verifying` that could
take the item out of the check (R26, R27) and a close in the same command as a `--clear` (R28).
R21 is the one requirement that depends on fork 1 (how an absent rule reads).

## Terms

- *The rule* is `rules.require_mutation_to_close` in `.mstack/state.json`. It is *on* when it
  reads `true` (R21 says how an absent key reads).
- *In scope*, *class*, *the lock*, *the CLI that wrote the lock* are as in item 42's Terms. The
  lock is this checkout's: `mstack-mutation.lock` in the git directory `git rev-parse
  --absolute-git-dir` prints at the store's root.
- *The start at HEAD* is item 42's *start*, `measureStart(store, base)` (`src/size.ts:81`).
- A path *differs between C and the working tree* when `git diff --name-only --no-renames
  --relative C --` (the working tree) or `git diff --cached --name-only --no-renames --relative C
  --` (the index), run at the store's root, lists it: a tracked file whose content in the working
  tree or in the index is not C's. An untracked file never differs. A path *differs between C and
  D* when `git diff --name-only --no-renames --relative C D --` lists it. Only in-scope `code` and
  `test` paths count, unless a requirement says `code`. A path is a name, never a pattern: every
  git command given one runs as `git --literal-pathspecs`.
- *The code diff* is the in-scope `code` paths that differ between the start at HEAD and the
  working tree.
- *The joined command* is the item's obligations (`obligations`, `src/verification.ts:106`) joined
  with ` && `, as item 42's R20 writes `command`.
- *A row* is a line of a `verification.tsv` whose `target` is the item's slug and whose `outcome`
  is `mutation-killed`, `mutation-survived` or `mutation-blocked`; it is *decisive* when killed or
  survived. *S* is its `sha`.
- *The stores read* are this store and, for every record of `git worktree list --porcelain -z`
  that is not this worktree's and has no `prunable` line, the store at the same path below that
  worktree's top as this store is below this worktree's top (`git rev-parse --show-prefix`).
- *HEAD's first-parent history* is what `git rev-list --first-parent HEAD` lists.
- *HEAD is ahead of the default branch* when it is in the history of neither
  `refs/heads/<default>` nor `refs/remotes/origin/<default>` (`git merge-base --is-ancestor HEAD
  <ref>` fails for each that resolves; when neither resolves, HEAD is ahead): an item branch
  before its merge, and not the default branch after it.
- *The merge that brought S in*, M, is the commit on HEAD's first-parent history whose first
  parent does not have S in its history and one of whose other parents, *M's parent with S*, does.
- *The start at S* is what `measureStart` answers with S in HEAD's place and, as the default
  branch, M's first parent when a merge brought S in, else `refs/heads/<default>` and
  `refs/remotes/origin/<default>` as they are now. It is lost when the item's base is not a
  commit.
- *The item's paths of a row*, P, are the paths that differ between the start at S and S.
- *Q* is, when no merge brought S in, the oldest commit on HEAD's first-parent history that is
  not in S's history (`git rev-list --first-parent HEAD ^S`) at which every path of P has the mode
  and blob that `git ls-tree S -- <path>` gives (absent where S lacks it). *Q's own change* is the
  paths that differ between Q's first parent and Q (the empty tree when Q has no parent).
- A row *holds* when none of R7 to R14 and R25 voids it.

## ADDED Requirements

### Requirement: R1 Who is held
WHILE the rule is on, the system MUST hold to the check exactly the items with a `base`, a size
other than `s` (no size included), at least one obligation, and a code diff that is not empty or
cannot be computed (R3).

#### Scenario: Held
- **WHEN** item 1 `greet`, with a base and no size, has `src/greet.js` changed and committed since
  its base, its verification is `sh tests/check.sh`, and it is at `verifying` with no row
- **THEN** `mstack gate --quiet` exits 1 with a line containing `has no mutation run`

#### Scenario: Not held
- **WHEN** the item has no base; or has size `s`; or changed only `tests/greet.test.mjs` and
  `docs/greet.md`; or has only an untracked `src/wip.js`; or `state.json` has `"verify": ""` and
  the item has no `verification`
- **THEN** `mstack gate` at `verifying` and `state set greet --status done` print no line
  containing `mutation`

### Requirement: R2 Where the check is enforced
The system MUST report the check of a held item in `mstack gate` while that item is the active
item at `verifying` and no lock exists, and in `state set <slug> --status done`, and nowhere
else.

#### Scenario: The gate at verifying, and done
- **WHEN** the held item is at `verifying` and no row exists
- **THEN** `mstack gate --quiet` exits 1 with a line containing `1 greet (verifying) is one step
  from done` and `has no mutation run`; and `state set greet --status done` exits 2, its stderr
  contains `has no mutation run`, and `greet` is still `verifying`

#### Scenario: Before verifying, and under a lock
- **WHEN** the held item with no row is at `reviewing`; or it is at `verifying` while the lock
  exists
- **THEN** `mstack gate` prints no line containing `mutation run`; under the lock its one failure
  is the lock's line

### Requirement: R3 A code diff that cannot be computed
IF the item's base is not a commit, or the start at HEAD is lost, or git cannot list the code
diff, and no holding killed row answers the check, THEN the problem of R5 MUST also say which of
the three held and name `mstack state set <slug> --base <commit> --closed-by "<why>"` (R26) with
the commit just before the item's work landed (after a squash or rebase merge, the first parent of
its first commit, never HEAD).

#### Scenario: A squash merge with no run
- **WHEN** `feat/greet`, whose base is a commit on that branch, is squash-merged into `main`, the
  item is at `verifying` on `main`, and no row exists
- **THEN** the gate's line says the start of `greet` is lost and names `mstack state set greet
  --base`, and `state set greet --status done --force --closed-by "no run was made"` is not
  refused by this check

#### Scenario: A base that is not a commit
- **WHEN** the item's base is `deadbeef` and no row exists
- **THEN** the gate's line says the base `deadbeef` is not a commit and names `--base`

#### Scenario: No code of its own, after a squash
- **WHEN** an item that changed only `docs/notes.md` is squash-merged as commit Q, and `mstack
  state set notes --base Q^ --closed-by "squash-merged as Q"` runs
- **THEN** `mstack gate` prints no line containing `mutation`

### Requirement: R4 Which row answers the check
The system MUST answer the check with the newest row by `ts` among the decisive rows of the stores
read whose `command` is the joined command and that hold, the check being met when that row is
`mutation-killed`.

#### Scenario: A killed run answers it
- **WHEN** `mstack verify --mutation` ended `mutation-killed` and nothing changed since
- **THEN** `mstack gate` and `state set greet --status done` print no line containing `mutation`

#### Scenario: The newest decides
- **WHEN** a `mutation-killed` row is followed, at the same commit, by a `mutation-survived` row
- **THEN** `state set greet --status done` exits 2 and `greet` is still `verifying`

#### Scenario: A blocked row decides nothing
- **WHEN** a `mutation-killed` row is followed by a `mutation-blocked` row
- **THEN** nothing is reported

### Requirement: R5 What the problem says when the check is not met
WHEN the check is not met, the system MUST report the first that is true of: the row of R4 is
`mutation-survived` (saying the last mutation run survived and naming its commit); decisive rows
of the joined command exist and none holds (naming the newest one's commit and why it does not
hold: up to ten of the paths that voided it; the flagged files, each with its flag and the `git
update-index --no-skip-worktree` or `--no-assume-unchanged` command that clears it; that its
commit cannot be found; or that no commit on HEAD's first-parent history holds its content of the
item's paths); only blocked rows of the joined command exist; rows exist only for another command
(naming the newest one's command); no row exists.

#### Scenario: Survived, void, blocked, another command, none
- **WHEN** a `mutation-killed` row is followed, at the same commit, by a `mutation-survived` row;
  or the only killed row is voided by a commit to `tests/helpers.test.mjs`; or the only row is
  `mutation-blocked`; or the killed run ran `sh tests/check.sh` and then `state set greet
  --verification "sh tests/check.sh && true" --closed-by "a stricter command"` ran; or no row
  exists
- **THEN** the gate's line says the last mutation run of `greet` survived and names its commit;
  names the row's commit and `tests/helpers.test.mjs`; says the mutation runs were blocked; names
  `sh tests/check.sh` as the command the last run ran; says there is no mutation run

### Requirement: R6 What every problem's fix names
The system MUST name in the fix of every problem of this check `mstack verify --mutation`, the
forced close `mstack state set <slug> --status done --force --closed-by "<why>"`, and, where the
store's root is an mstack checkout (`isMstackCheckout`, `src/paths.ts:122`), the commands that run
`verify --mutation` from a copy of the CLI outside the tree.

#### Scenario: The way out is named
- **WHEN** any problem of R3 to R5 is reported
- **THEN** its fix contains `mstack verify --mutation` and `--force --closed-by`, and, where the
  root holds `.claude-plugin/plugin.json` naming `mstack`, `bin/mstack` and `src/cli.ts`, also
  `git worktree add --detach`

### Requirement: R7 A row's commit
IF S is not lowercase hexadecimal of the length the repository's object format gives (40 for
`sha1`, 64 for `sha256`, as `git rev-parse --show-object-format` prints) that names a commit (`git
cat-file -e <S>^{commit}`), THEN the system MUST NOT count the row as holding, deciding the length
and the digits before S reaches any other git command.

#### Scenario: A sha that is a ref, one that is no commit, and SHA-256
- **WHEN** a row's `sha` is `HEAD`; or is 40 hex digits that name no commit here; or is the
  64-digit sha of a killed run in a repository made with `git init --object-format=sha256`, with
  nothing changed since
- **THEN** in the first two the row does not hold, and the gate's line, when it is the newest
  decisive row, says its commit cannot be found; in the third the gate prints no line containing
  `mutation`

### Requirement: R8 A row whose commit is on HEAD's first-parent history
IF S is on HEAD's first-parent history and a path differs between S and the working tree, THEN
the system MUST NOT count the row as holding.

#### Scenario: What keeps it
- **WHEN** after the killed run `docs/notes.md` and `.mstack/state.json` are committed; or `main`
  is fast-forwarded to the branch; or an untracked `notes.txt` and `tests/untracked.test.mjs` are
  created
- **THEN** the row holds

#### Scenario: What voids it
- **WHEN** after the killed run `tests/helpers.test.mjs` is committed; or `src/greet.js` is edited
  and not committed; or an edit to `src/greet.js` is staged and the working tree file put back as
  S has it; or `main` is fast-forwarded to the branch and another item's commit changing
  `src/other.js` lands on `main` before the close
- **THEN** the row does not hold, and the gate's line names `tests/helpers.test.mjs`,
  `src/greet.js`, `src/greet.js` or `src/other.js`

### Requirement: R9 The item's paths of a row off the first-parent history
IF S is not on HEAD's first-parent history, and the start at S is lost or P is empty, THEN the
system MUST NOT count the row as holding.

#### Scenario: The base moved to the run's commit
- **WHEN** after the killed run at S `src/greet.js` is edited and committed, `state set greet
  --base <S>` runs, and the branch is then squash-merged or merged with a merge commit
- **THEN** the row does not hold on `main`

### Requirement: R10 After a merge commit, the item's paths
IF a merge brought S in and a path of P differs between S and the working tree, THEN the system
MUST NOT count the row as holding.

#### Scenario: Merge commits that keep it
- **WHEN** after a killed run on `feat/greet` the branch is merged into `main` with a merge commit,
  once with `main` unchanged since the fork and once with `main` holding another item's
  `src/other.js` and `tests/other.test.mjs`; or in an octopus merge with another branch
- **THEN** the row holds on `main`, and `state set greet --status done` prints no line containing
  `mutation`

#### Scenario: The default branch changed the item's file
- **WHEN** `main` changed line 1 of `src/greet.js`, the item changed line 4, and the branch is
  merged with a merge commit
- **THEN** the row does not hold, and the line names `src/greet.js`

### Requirement: R11 After a merge commit, the merged branch
IF a merge brought S in and a path differs between S and M's parent with S, THEN the system MUST
NOT count the row as holding.

#### Scenario: A test added after the run
- **WHEN** `tests/helpers.test.mjs` is committed on `feat/greet` after the killed run and the
  branch is merged with a merge commit
- **THEN** the row does not hold, and the gate's line on `main` names `tests/helpers.test.mjs`

#### Scenario: Docs after the run
- **WHEN** only `docs/notes.md` is committed on the branch after the run before the merge commit
- **THEN** the row holds

### Requirement: R12 With no merge commit, the commit that brought the item's content
IF no merge brought S in, S is not on HEAD's first-parent history, and there is no Q or Q's own
change holds a path that is not in P, THEN the system MUST NOT count the row as holding.

#### Scenario: Squash and rebase merges that keep it
- **WHEN** after a killed run on `feat/greet` the branch reaches `main` by a squash merge or a
  rebase merge (its commits cherry-picked onto `main` with a later committer date), each once with
  `main` unchanged since the fork and once with `main` holding another item's `src/other.js` and
  `tests/other.test.mjs`; or the same with the item's base a commit of `main`, as `mstack worktree
  new` gives; or the branch is rebased onto a moved `main` after the run and stays a branch; or
  the item only deletes `src/legacy.js`, which `main` added before the item started
- **THEN** in each the row holds, and `state set greet --status done` prints no line containing
  `mutation`

#### Scenario: A test after the run, squashed in
- **WHEN** `tests/helpers.test.mjs` is committed on the branch after the killed run and the branch
  is squash-merged; or the branch's commits are reset with `--soft` and recommitted as one with that
  test
- **THEN** the row does not hold, and the line names `tests/helpers.test.mjs`

#### Scenario: Content git cannot find
- **WHEN** `src/greet.js` is renamed after the run and the branch is squash-merged
- **THEN** the row does not hold, and the line says no commit holds S's content of the item's paths

### Requirement: R13 With no merge commit, anything after that commit
IF no merge brought S in, S is not on HEAD's first-parent history, Q exists, and a path differs
between Q and the working tree, THEN the system MUST NOT count the row as holding.

#### Scenario: After-run work outside the squash commit
- **WHEN** after the killed run `tests/helpers.test.mjs` is committed on the branch and the branch is
  rebase-merged; or the run's commit is amended to add it; or the branch is rebased and then the
  test committed; or the item is squash-merged and another item's `src/other.js` lands on `main`
  before the close
- **THEN** the row does not hold, and the line names `tests/helpers.test.mjs` or `src/other.js`

### Requirement: R25 With no merge commit, on the branch, what came in before Q
IF no merge brought S in, S is not on HEAD's first-parent history, Q exists, HEAD is ahead of the
default branch, and a path differs between S and Q but not between the start at S and the start
at HEAD (every such path, when the start at HEAD is lost), THEN the system MUST NOT count the row
as holding.

#### Scenario: A test moved ahead of the code with `rebase -i`
- **WHEN** after the killed run `tests/helpers.test.mjs` is committed on `feat/greet` and `git
  rebase -i` moves that commit before the one that changed `src/greet.js`, or folds it into an
  earlier commit
- **THEN** on the branch the row does not hold, and the line names `tests/helpers.test.mjs`

#### Scenario: What it does not void
- **WHEN** after the killed run the branch is rebased onto a `main` that gained another item's
  `src/other.js` and `tests/other.test.mjs`, once as it is and once with `src/prep.js` committed on
  the branch before the item's base; or, with the item's base a commit of `main`, `main` moves and
  the branch is squash-merged
- **THEN** the row holds

### Requirement: R14 Files git does not show
IF a tracked in-scope `code` or `test` file is flagged `skip-worktree` or `assume-unchanged`, THEN
the system MUST NOT count any row as holding.

#### Scenario: A hidden edit after the run
- **WHEN** after the killed run `git update-index --assume-unchanged src/greet.js` runs and
  `src/greet.js` is edited
- **THEN** the row does not hold, and the gate's line names `src/greet.js`, `assume-unchanged` and
  `git update-index --no-assume-unchanged`

### Requirement: R15 Rows from the other worktrees
The system MUST answer the check from the rows of the `verification.tsv` of every store read,
each judged against this working tree, where a file of another worktree that is missing or cannot
be read adds no rows and no failure.

#### Scenario: A run in a linked worktree, closed in the main checkout
- **WHEN** the killed run was made in a linked worktree on `feat/greet`, and the main checkout
  merges `feat/greet` with a merge commit, or fast-forwards to it while the linked worktree holds an
  untracked `notes.txt`
- **THEN** the main checkout's `mstack gate` prints no line containing `mutation`, though its own
  `verification.tsv` holds no row

#### Scenario: Removed, prunable, unreadable
- **WHEN** `git worktree remove` removed the linked worktree before the close; or a worktree record
  that `git worktree list --porcelain` marks `prunable` points at a directory holding a killed row;
  or another worktree's `.mstack/verification.tsv` is a directory
- **THEN** in the first two the line says there is no mutation run; in the third the gate reports
  no failure for that file

### Requirement: R16 No run while an untracked test file is in scope
IF an untracked, not ignored, in-scope file that the classifier calls a test exists when `mstack
verify --mutation` runs, THEN it MUST exit 2 before the baseline, name up to ten such files, say
that a kill earned by a test that is not committed would answer the closing check without that
test, say to commit each one or move it out of the store's root, and write no lock, no run
directory and no row.

#### Scenario: An untracked test
- **WHEN** `tests/new.test.mjs` is untracked and not ignored
- **THEN** `verify --mutation` exits 2 naming `tests/new.test.mjs` and `move it out of the store's
  root`, and not naming `.gitignore`; `verification.tsv` is unchanged and no lock exists

#### Scenario: What this rule does not refuse
- **WHEN** the only untracked files are `tests/out.log`, ignored by `.gitignore`, and `notes.txt`
- **THEN** the run is not refused by this rule

### Requirement: R17 A forced close stores its marker
WHEN `state set <slug> --status done --force --closed-by "<why>"` closes an item past an
overridable problem, the system MUST store in `closed_by` `closed `, then the phrases
`unverified` (the verification check), `without a good requirement-to-test table` and `without a
killed mutation receipt` of the checks it overrode, in that order, joined as
`a`, `a and b` or `a, b and c`, then ` (forced): ` and `<why>`.

#### Scenario: Past this check alone
- **WHEN** an item at `verifying` whose last run survived is closed with `--force --closed-by "pure
  refactor, behaviour unchanged"`
- **THEN** it exits 0 and `closed_by` is `closed without a killed mutation receipt (forced): pure
  refactor, behaviour unchanged`

#### Scenario: Past more than one, and today's markers
- **WHEN** a forced close overrides the verification check and this one; or all three; or only the
  verification check, only the table, or both of them
- **THEN** `closed_by` starts `closed unverified and without a killed mutation receipt (forced): `;
  `closed unverified, without a good requirement-to-test table and without a killed mutation
  receipt (forced): `; or `closed unverified (forced): `, `closed without a good
  requirement-to-test table (forced): ` or `closed unverified and without a good
  requirement-to-test table (forced): `, as today

### Requirement: R18 A forced close prints what it overrode
WHEN a forced close overrides a problem of this check, the system MUST print `  forced: closed
without a killed mutation receipt - ` followed by that check's messages joined with `; `, on a line
of its own beside the line of each other check it overrode.

#### Scenario: The line
- **WHEN** the close of R17's first scenario runs
- **THEN** stdout contains `forced: closed without a killed mutation receipt - the last mutation
  run of greet survived`, and no line containing `did not run here`

### Requirement: R19 The marker stays
WHILE an item's `closed_by` starts with a marker of R17, the system MUST keep that marker at the
start of `closed_by` through every later `state set`, exiting 2 with the item unchanged on one
that would remove it.

#### Scenario: A later note, and a clear
- **WHEN** `state set greet --closed-by "merged in #12"` runs after R17's first close; then `state
  set greet --clear closed-by` runs
- **THEN** `closed_by` is `closed without a killed mutation receipt (forced): merged in #12`; the
  clear exits 2 and `closed_by` is unchanged; the same holds for a `closed unverified (forced): `
  note

### Requirement: R20 Forcing past this check needs a reason
IF `state set <slug> --status done --force` would override a problem of this check and has no
`--closed-by`, THEN the system MUST exit 2 with the item unchanged and a fix whose `--closed-by
"<why ... is right here>"` hint says `without a killed mutation receipt`.

#### Scenario: No reason given
- **WHEN** `state set greet --status done --force` runs for an item whose only problem is that it
  has no mutation run
- **THEN** it exits 2, stderr contains `closing without a killed mutation receipt`, and `greet` is
  still `verifying`

### Requirement: R21 The rule when the key is absent
WHEN `state.json`'s `rules` has no `require_mutation_to_close`, the system MUST read the rule as
**[fork: A `true` / B `false`]**, the answer the `decide --resolves mutation-closing-check` row
records.

#### Scenario: A store that predates the rule
- **WHEN** `rules` has no such key and item `greet` is held by R1's other conditions at `verifying`
  with no row
- **THEN** under answer A the gate fails with `has no mutation run`; under answer B it prints no
  line containing `mutation`

### Requirement: R22 A rewrite writes the rule as read
WHEN the CLI rewrites `state.json`, the system MUST write `require_mutation_to_close` with the
value it read the rule as.

#### Scenario: Off stays off
- **WHEN** in a store whose rule is `false`, `state set greet --title "Greet"` runs
- **THEN** `state.json` still has `"require_mutation_to_close": false`, and the item at
  `verifying` with code and no row is not held

### Requirement: R23 Setup writes the rule on
WHEN `mstack setup` creates `state.json`, the system MUST write `"require_mutation_to_close": true`
in its `rules`.

#### Scenario: A new store
- **WHEN** `mstack setup` runs in a new repository
- **THEN** `.mstack/state.json` has `"require_mutation_to_close": true`

### Requirement: R24 `done` is refused under this checkout's lock
WHILE the lock (this checkout's, Terms) exists, `state set <slug> --status done` MUST exit 2 with
`state.json` unchanged, whatever `--force`, `--closed-by` and the rule say, with the message and
fix of the gate's lock line.

#### Scenario: The lock of a run that is not running
- **WHEN** an item at `verifying` with a holding killed row is closed with `--force --closed-by x`
  while the lock of a dead pid exists
- **THEN** it exits 2, stderr names the lock's path and `<the CLI that wrote the lock> verify
  --restore`, and the item is still `verifying`

#### Scenario: A live run, a lock that cannot be read, the rule off
- **WHEN** the lock's run is alive; or the lock holds `garbage`; or the rule is `false`
- **THEN** it exits 2 saying to wait for the run; or exits 2 naming `git stash push
  --include-untracked`; or is still refused

#### Scenario: Another transition, and another worktree's lock
- **WHEN** `state set greet --status in_progress` runs under the lock; or the only lock is in a
  linked worktree's git directory and `done` runs in the main checkout
- **THEN** neither is refused by this requirement

### Requirement: R26 An edit at verifying that could take the item out of the check
IF `state set <slug>` leaves at `verifying` an item that R1 holds as the command found it, and
would change that item's `size`, `base` or `verification` (a value or a `--clear`), and has no
`--closed-by "<why>"`, THEN the system MUST exit 2 with `state.json` unchanged and a fix that
names `--closed-by "<why>"`.

#### Scenario: Refused without a reason
- **WHEN** `greet`, held at `verifying` with no row, gets `state set greet --size s`; or `--base
  HEAD`; or `--verification "true"`; or `--clear verification`
- **THEN** each exits 2, its stderr names `--closed-by`, and `state.json` is unchanged

#### Scenario: What it does not refuse
- **WHEN** the same item gets `state set greet --title "Greet"`; or `--status in_progress --base
  HEAD`; or `--status done --closed-by "PR #1" --size s` after a killed run; or an item of size `s`
  at `verifying` gets `--size m`; or the rule is `false`
- **THEN** none is refused by this requirement

### Requirement: R27 That edit is on the record
WHEN `state set` makes an edit of R26 with `--closed-by "<why>"`, the system MUST record `<why>`,
after `state.json` is saved, in one `decisions.tsv` row whose `phase` is `mutation-scope`, whose
`item` is the slug and whose `why` names each changed field with its old and new value, in place
of writing `closed_by`.

#### Scenario: A size change at verifying
- **WHEN** `state set greet --size s --closed-by "a rename, behaviour unchanged"` runs with `greet`
  held at `verifying`
- **THEN** it exits 0, `size` is `s`, `closed_by` is as it was, and the last row of
  `decisions.tsv` has phase `mutation-scope`, decision `a rename, behaviour unchanged`, item
  `greet` and a `why` containing `size` and `"s"`

### Requirement: R28 `done` judges the item as the command found it
WHEN `state set <slug> --status done` runs, the system MUST run the closing checks on the item as
it was before that command's `--clear`s.

#### Scenario: A clear in the closing command
- **WHEN** in a store whose `verify` is `""`, `state set greet --status done --clear verification`
  runs for `greet` held at `verifying` with no row
- **THEN** it exits 2, stderr contains `has no mutation run`, and `greet` is still `verifying` with
  its `verification`
