How every task is checked. A task's tests run with `bun test tests/<file>`, which ends with ` N pass`
and ` 0 fail`, and under node with `node --disable-warning=ExperimentalWarning
--experimental-strip-types --test tests/<file>`, which prints `# fail 0`. `bun run typecheck` exits 0
after every task. Each implementation task ends with the implementer's `| R | Test | Where |` table
for the requirements it covers (`agents/implementer.md`, "Your report") and adds its line to the
Unreleased section of `CHANGELOG.md`. Names (the terms, `MUTATION_CHECK`, `storesRead`, `holds`,
`forcedMarker`) are defined in spec.md "Terms" and design.md "Shape", in this directory.

**The new tests.** The seam is the CLI: every new test builds a throwaway git repository with
`sandbox()` (`tests/helpers.ts:30`) through `closeRepo()` of `tests/mutation-close-fixture.ts`
(created by task 1.2), and runs `bin/mstack gate --quiet`, `bin/mstack state set ...` and `bin/mstack
verify --mutation` as child processes with the repository as `cwd`, as
`tests/mutation-cli.test.ts` does; no mocks of git, and no test runs with this checkout as `cwd`.
`closeRepo()` commits `src/greet.js` (`hello`) and `tests/check.sh` (`grep -q HELLO src/greet.js`,
a test path the revert never touches) on `main`, branches `feat/greet`, and writes `state.json`
with `"verify": ""`, one item `{ "id": 1, "slug": "greet", "status": "in_progress", "base": <the
branch's first commit>, "verification": "sh tests/check.sh", "acceptance": ["greet shouts"] }` and
`"rules": { "one_active_item": true, "require_verdict_to_close": false,
"require_spec_for_sdd_items": true, "require_mutation_to_close": true }`. The key is written `true`
in every new test, so each runs the same under either answer of the fork; only the two R21 tests
(tasks 1.1 and 1.2) write `rules` without it. Where a test closes an item with `done` it also writes
`.mstack/progress/impl_greet.md` holding `| R | Test | Where |` and `| A1 | check |
tests/check.sh:1 |`, calls `trackCurrent`, and runs `bin/mstack gate --full` at that commit, so
that this check is the one deciding. A killed row comes from a real `verify --mutation` after
`src/greet.js` is committed holding `HELLO`.

**The existing tests.** `state()` (`tests/helpers.ts:190-197`) writes `require_mutation_to_close:
false` in its `rules` (task 1.1), so every existing test whose state it writes reads the rule off
under either answer. Measured with a stand-in check patched into archive copies of `7d2d42b`
(design.md Fact 5): without that line, answer A changes `tests/r-table-check.test.ts:387-395`
(its marker would become `closed unverified and without a killed mutation receipt (forced): no
python on this host`) and `:397-414` (`closed unverified, without a good requirement-to-test table
and without a killed mutation receipt (forced): `); with it, both assert what they assert today
under either answer. The tests whose store `setup` seeds (the key `true` under either answer) and
that close an item with a base, an obligation and code are the Getting-Started walkthrough (task
1.2). Task 1.5 rewrites the two item 42 tests that R16 makes unreachable. A stand-in for R26 and
R28 changes no shipped test (design.md Fact 5).

**The fork.** Only the parse in task 1.1 and the two R21 tests (tasks 1.1 and 1.2) differ by
answer; each gives both branches. `./bin/mstack state show mutation-closing-check`
prints `decision_resolved: <ts>`; the row of `.mstack/decisions.tsv` with that timestamp and
`mutation-closing-check` in its resolves column says A or B.

## 1. The check

- [ ] 1.1 The rule. In `src/state.ts`, add `require_mutation_to_close` to `State.rules` (`:57-63`), to
  the parse (`:153-158`) and to `KNOWN_RULE_KEYS` (`:252`). **Answer A:** the parse is
  `rules["require_mutation_to_close"] !== false`. **Answer B:** it is `=== true`. In `src/setup.ts`,
  `seedState` (`:111-116`) writes it `true`. In `tests/helpers.ts`, `state()` writes
  `require_mutation_to_close: false`. Add `"require_mutation_to_close": true` to the `rules` of this
  repository's `.mstack/state.json`, and name five rules in `docs/wiki/State-Files.md:40-41` with
  one sentence on the absent key as answered. Tests in a new `tests/mutation-rule.test.ts`, each
  through `bin/mstack` with a sandbox as `cwd`: `R23 setup writes the rule true`, `R22 a rewrite by
  state set keeps the rule false`, and `R21 a state.json without the rule is rewritten with the
  recorded answer`, which writes `rules` with the other three keys only, runs `state set greet
  --title "Greet"` and reads the file back: **answer A** asserts `"require_mutation_to_close":
  true`; **answer B** asserts `false`. Done when `bun test tests/mutation-rule.test.ts` ends ` 3
  pass` and ` 0 fail`, the node command prints `# fail 0`, `bun test tests/state.test.ts
  tests/state-cli.test.ts tests/r-table-check.test.ts` ends ` 0 fail`, and `./bin/mstack gate` ends
  `PASSED`. (covers R21, R22, R23)

- [ ] 1.2 The check on the branch. Create `src/mutation-close.ts` with `MUTATION_CHECK`,
  `mutationCheck` and `holds` as design.md "Shape" defines them, reading this store's rows only and
  judging a row whose S is not on HEAD's first-parent history as not holding (task 1.3 replaces
  that); append `mutationCheck` to `CLOSING_CHECKS` (`src/closing.ts:272`). Export the text of item
  42's R5 fix from `src/mutation.ts` (`:310-313`) as one constant and use it in both places. Create
  `tests/mutation-close-fixture.ts` with `closeRepo()` as the preamble says. Add a "mutation"
  entry to "What `mstack gate` checks" in `docs/wiki/Gates-and-Hooks.md`, after the review
  budget's (`:431`), with the `[fail]` and `fix:` lines pasted from `./bin/mstack gate` in a
  throwaway repository holding an item at `verifying` with no run.
  **The walkthrough.** In `tests/walkthrough.test.ts`, after the reviewer's `gate --full`
  (`:161-170`) and before its ledger row (`:171-177`), the reviewer runs `mstack verify --mutation`
  at `reviewing`, asserting exit 0 and a last line starting ``mutation-killed: `python3 -m unittest
  test_greet -v` failed without the change``; its row's evidence adds `; mstack verify --mutation:
  mutation-killed`. Add `mutation` to `leaveOut`, and a test `Getting-Started without verify
  --mutation is refused at the close` asserting exit 2 and `has no mutation run`. The `gateFull`
  mutant leaves out the mutation run too, since the run's baseline would record the receipt that
  mutant is about (`src/mutation-run.ts:310`), and keeps its assertion. In
  `docs/wiki/Getting-Started.md`, "The close is audited" (`:347-379`) gains the command and its
  output, pasted from a real run of `./bin/mstack` in a throwaway repository following the page,
  and two sentences: the run put `greet.py` back as it was at the item's start, ran the
  verification, saw `test_shout` error and put `greet.py` back again; a kill says the tests reach
  the code (here a `TypeError`), not that they check it.
  Tests in a new `tests/mutation-close.test.ts`: `R1 R2 an item at verifying with a code diff and
  no run fails the gate and is refused at done`, `R1 no base, size s, only tests and docs, only
  untracked code, or no obligation: nothing about the mutation check`, `R2 at reviewing, and at
  verifying under a lock, the gate prints no mutation line`, `R4 a killed run answers the check in
  the gate and at done`, `R4 R5 a later survived run is reported naming its commit, and a later
  blocked run leaves a killed one standing`, `R5 a void row, only blocked rows, a run of another
  command, no row: each line says which` (its verification change passes `--closed-by "a
  stricter command"`, which R26 needs from task 2.3 on), `R6 the fix names verify --mutation and
  the forced close,
  and the copy commands in an mstack checkout` (the sandbox writes `.claude-plugin/plugin.json`
  with `"name": "mstack"`, and `bin/mstack` and `src/cli.ts`, `src/paths.ts:122-139`; the test reads
  only the mutation line), `R7 a row whose sha is HEAD, or 40 hex digits naming no commit, does not
  hold, and a killed row of a repository made with git init --object-format=sha256 does`, `R8 a
  docs commit, a store commit, a fast-forward and untracked files keep the receipt`, `R8 a test
  committed after the run, an uncommitted or a staged code edit, or other work fast-forwarded onto
  main voids it, naming the path`, `R14 an assume-unchanged edit after the run voids the row,
  naming the file, the flag and the command`, and `R21 a store whose rules lack the key: the gate
  answers as recorded`, which writes `rules` without the key and an item R1 holds at `verifying`
  with no row: **answer A** asserts `gate --quiet` exits 1 with `has no mutation run`; **answer B**
  asserts it prints no line containing `mutation`. Done when `bun test tests/mutation-close.test.ts`
  ends ` 12 pass` and ` 0 fail`, `bun test tests/walkthrough.test.ts` ends ` 5 pass` and ` 0 fail`
  (five skips where `python3` is missing), `bun test tests/closing.test.ts tests/gate.test.ts
  tests/gate-full-closing.test.ts tests/r-table-check.test.ts` ends ` 0 fail`, the node command for
  `tests/mutation-close.test.ts` prints `# fail 0`, and `node scripts/check-doc-links.mjs README.md
  docs/wiki/*.md` ends `0 broken`. Every git call `holds` makes runs as `git --literal-pathspecs`,
  and "differs from the working tree" reads the index too (spec.md Terms). (covers R1, R2, R4, R5,
  R6, R7, R8, R14, R21)

- [ ] 1.3 The check after a merge. In `src/size.ts`, give `measureStart` (`:81`) the optional third
  argument `{ head?, against? }` of design.md "Shape" (`forkPoint`, `:102`, takes the commits to
  compare with); in `src/mutation-close.ts`, judge a row whose S is not on HEAD's first-parent
  history by R9 to R13 and R25 (Q searched among the first-parent commits not in S's history, as
  design.md "Shape" says), and report a code diff that cannot be computed by R3. Add "After the
  merge" to `## verify` in `docs/wiki/The-CLI.md` (`:711`): what holds a receipt after a fast-forward, a
  merge commit, a squash and a rebase merge, what voids it, what the rule misses and voids that
  should hold (design.md, "What the rule misses"), and the transcript of a squash merge closed on
  its receipt, pasted from a real run of `./bin/mstack` in a throwaway repository. Tests in a new
  `tests/mutation-merge.test.ts`, each with a killed run on `feat/greet` first unless it says
  otherwise; a rebase merge is the branch's commits cherry-picked onto `main` with
  `GIT_COMMITTER_DATE` a minute later: `R10 a merge commit keeps the receipt, main moved or not, and
  so does an octopus merge, and an item whose file is src/[id].js after main changed src/i.js`,
  `R10 main's edit to another line of the item's file voids it through a merge commit, naming the
  file`, `R11 a test added on the branch after the run voids it through a merge commit, and a docs
  commit does not`, `R12 a squash merge and a rebase merge keep the receipt, main moved or not,
  from a base on the branch and from a base on main, and so does a rebase onto a moved main after
  the run`, `R12 an item whose only change deletes a file main added before the item started keeps
  the receipt through a squash`, `R12 a test after the run squashed in, or recommitted after reset
  --soft, voids it, naming the test`, `R12 a file renamed after the run voids it: no commit holds
  the run's content`, `R13 a test after the run brought by a rebase merge, an amend, or a commit on
  a rebased branch voids it`, `R13 another item's code on main after a squash voids it, naming the
  path`, `R25 an after-run test moved ahead of the code with rebase -i, or folded into an earlier
  commit, voids the row on the branch, naming it` (`git rebase -i` with a `GIT_SEQUENCE_EDITOR`
  script that moves the test's `pick` line above the code's, or turns it into a `fixup` under an
  earlier `pick`), `R25 a branch rebased onto a moved
  main after the run keeps the receipt, with src/prep.js committed before its base too`, `R9 --base
  moved to the run's commit after a void voids the row through a squash and a merge commit`, `R3
  after a squash with no run the line says the start is lost and names --base and --closed-by, and
  the forced close is allowed`, `R3 a base that is not a commit names --base, and an item with no
  code of its own is not held once --base names the commit before the squash` (that `state set`
  passes `--closed-by "squash-merged"`, which R26 needs from task 2.3 on). Done when `bun test
  tests/mutation-merge.test.ts` ends ` 14 pass` and ` 0 fail`, `bun test
  tests/item-size-base.test.ts tests/mutation-refusals.test.ts tests/mutation-close.test.ts` ends `
  0 fail` (the size check and the refusals keep their start), the node command for
  `tests/mutation-merge.test.ts` prints `# fail 0`, and the doc-links command ends `0 broken`.
  (covers R3, R9, R10, R11, R12, R13, R25)

- [ ] 1.4 Rows of the other worktrees. In `src/mutation-close.ts`, add `storesRead` and read the
  rows of every store it names (design.md "Shape"), leaving out a record with a `prunable` line. In
  `skills/ship/SKILL.md` step 7 (`:31-35`), add one sentence: an item worked in a linked worktree is
  closed before that worktree is removed, because `git worktree remove` deletes its mutation
  receipt. In `docs/wiki/Gates-and-Hooks.md:703-707`, keep the reason a verification receipt of
  another checkout is not evidence, and add that mutation rows are the exception: the closing check
  reads them from every worktree of the repository and judges each against this checkout's own
  tree, path by path, so what holds is this tree's content. Tests in a new
  `tests/mutation-close-worktrees.test.ts`: `R15 a run in a linked worktree answers the check in the
  main checkout after a merge commit, and after a fast-forward with an untracked notes.txt there`,
  `R15 after git worktree remove the check reports no mutation run`, `R15 a prunable worktree
  record's store is not read` (the record written by hand under `.git/worktrees/`, as
  `spec100r2/w2.sh` does), `R15 another worktree whose verification.tsv is missing or a directory
  gives no rows and no failure`. Done when `bun test tests/mutation-close-worktrees.test.ts` ends `
  4 pass` and ` 0 fail`, the node command prints `# fail 0`, and `./bin/mstack lint-plugin .` exits
  0. (covers R15)

- [ ] 1.5 The untracked-test refusal. In `src/mutation.ts`, add R16 to `refusals` (`:221`) after the
  tracked-change refusal (`:291-298`), from `git ls-files --others --exclude-standard -z` kept to
  `scopeClass(store)` `test`, naming up to ten with `some` (`:199`), its fix `commit each one, or
  move it out of the store's root`. Add it to "What it refuses" in `docs/wiki/The-CLI.md` (`:803`),
  with one sentence: an ignored test file is not refused (so that a log under `tests/` does not
  stop every run), and so it can still earn a kill. Item 42's
  two untracked-test tests become unreachable for a test file and move to an untracked code file,
  which the key still covers (`src/mutation.ts:121-167`): in `tests/mutation-run.test.ts:113-123`,
  `R2 an untracked test file edited during the baseline` becomes `R2 an untracked code file edited
  during the baseline`, with `src/scratch.ts` in place of `tests/new.test.ts` in the script and the
  `put`, asserting exit 2, `src/scratch.ts` and `changed during the baseline`; in
  `tests/mutation-changed.test.ts:90-100`, `R18 an untracked test file edited during the run`
  becomes `R18 an untracked code file edited during the run`, the same swap, asserting `(e)` and
  `src/scratch.ts`. In item 42's spec, `.mstack/specs/mutation-check/spec.md:131-134` and
  `:548-552`, the scenarios name `src/scratch.ts` in place of `tests/new.test.ts`, each followed by
  `(Amended by item 100: an untracked test file now refuses the run before the baseline, R16 of
  .mstack/specs/mutation-closing-check/spec.md.)`. Tests added to
  `tests/mutation-refusals.test.ts`: `R16 an untracked test file refuses the run, naming it and
  saying to move it out of the store's root, never .gitignore, and writes nothing`, `R16 an ignored
  test file and an untracked code file do not refuse the run`. Done when `bun test
  tests/mutation-refusals.test.ts` ends ` 23 pass` (21 before) and ` 0 fail`, or fewer passes plus skips on a case-sensitive filesystem, `bun test
  tests/mutation-run.test.ts tests/mutation-changed.test.ts tests/mutation-cli.test.ts` ends ` 0
  fail`, `rg -n 'tests/new\.test\.ts' tests/mutation-run.test.ts tests/mutation-changed.test.ts`
  prints nothing, and the node command for the three changed files prints `# fail 0`. (covers R16)

## 2. The done transition

- [ ] 2.1 The forced close. In `src/cli.ts`, replace the choice of marker (`:769-775`) with
  `forcedMarker(checks)` over the overridden checks, list the seven markers in `FORCED_MARKERS`
  (`:299`), print one forced line per overridden check (`:807-817`), the mutation one `  forced:
  closed without a killed mutation receipt - <messages>`, make the hint without `--closed-by`
  (`:804`) name the phrases of the checks it would override, and refuse `--clear closed-by` before
  `clearField` runs (`:694`) when the note starts with a marker. Extend the sentence on markers in
  `docs/wiki/Gates-and-Hooks.md` (`:426-429`) with the new phrase, a combined one and the refused
  clear, and the `--clear` list in `docs/wiki/The-CLI.md:292` with the same refusal. Tests in a new
  `tests/mutation-forced.test.ts`: `R17 a forced close past a survived run stores the mutation
  marker`, `R17 past the verification check and this one, and past all three, the marker names
  each in order`, `R17 the three markers of today are byte-identical`, `R18 the forced line names
  this check's messages, with no 'did not run here' line for a close past this check alone`, `R19 a
  later --closed-by keeps the marker, and --clear closed-by on a marked note exits 2 and changes
  nothing, for today's markers too`, `R20 --force without --closed-by exits 2, its hint says
  without a killed mutation receipt, and the item stays`, `R2 after a forced close the gate prints
  no line about the closed item's mutation check, and state show prints its closed_by`. Done when
  `bun test tests/mutation-forced.test.ts` ends ` 7 pass` and ` 0 fail`, `bun test
  tests/state-cli.test.ts tests/r-table-check.test.ts tests/gate.test.ts tests/cli.test.ts` ends ` 0
  fail`, and the node command for `tests/mutation-forced.test.ts` prints `# fail 0`. (covers R2,
  R17, R18, R19, R20)

- [ ] 2.2 `done` under a lock. Move `lockProblem` from `src/gate.ts` (`:698-719`) to
  `src/mutation-lock.ts`, export it, and call it from the gate and from the `done` branch of
  `cmdState` (`src/cli.ts:758`), which throws a `UserError` with its message and fix before
  `closingProblems` runs, whatever `--force` and the rule say. Add to "While it runs" in
  `docs/wiki/The-CLI.md` (`:821`) that `state set --status done` is refused under the lock, and that
  a run in a linked worktree does not refuse a close in the main checkout (design.md, the last
  trade-off). Tests in a new `tests/mutation-done-lock.test.ts`, each writing a lock into the
  sandbox's git directory as `tests/mutation-gate.test.ts:45` does: `R24 done under the lock of a
  dead run is refused with --force and --closed-by, naming the restore`, `R24 done under the lock of
  a live run says to wait`, `R24 done under a lock that cannot be read names git stash push
  --include-untracked`, `R24 with the rule off done is still refused under a lock, and a move to
  in_progress is not`, `R24 a lock in a linked worktree's git directory does not refuse done in the
  main checkout`. Done when `bun test tests/mutation-done-lock.test.ts` ends ` 5 pass` and ` 0
  fail`, `bun test tests/mutation-gate.test.ts` ends ` 10 pass` and ` 0 fail`, and the node command
  for both files prints `# fail 0`. (covers R24)

- [ ] 2.3 Edits at `verifying`, and `done` before the clears. In `src/cli.ts`, `cmdState`'s `set`
  branch: take `const found = structuredClone(item)` beside `closedByBefore` (`:687`), before the
  clears (`:694`), and pass `found` to `closingProblems` (`:759`) (R28). Export `heldByR1(store,
  state, item)` from `src/mutation-close.ts`: R1's test, the rule included. Before
  `assertNotSddSmall(item)` in the `set` branch (`:988`): when `item.status` is `verifying`,
  `heldByR1(store, state, found)` is true and `size`, `base` or `verification` differs between
  `item` and `found`, throw a `UserError` naming the changed fields, with the fix `add --closed-by
  "<why>"; it is written to decisions.tsv as a mutation-scope row`, unless `--closed-by` was given
  (R26); when it was, skip the note in the `closed_by` loop as it is skipped for `forcedSpecSize`
  (`:846`), and after the state is saved write `decisions.add(store, { phase: "mutation-scope",
  decision: <why>, why: "<slug> at verifying: <field>: <old> -> <new>", one clause per changed
  field joined with "; ", evidence: ".mstack/state.json", result: "changed at verifying", item:
  <slug> })`, beside the `spec-size` row (`:997-1006`) (R27). R3's fix in `src/mutation-close.ts`
  names `--closed-by "<why>"` after `--base <commit>`. Add one paragraph to "Size and base" in
  `docs/wiki/The-CLI.md` (`:300`): at `verifying`, on an item the mutation check holds, a change of
  `--size`, `--base` or `--verification`, or the `--clear` of one, needs `--closed-by "<why>"`,
  which goes to `decisions.tsv` as a `mutation-scope` row and not to `closed_by`, and `--status
  done` judges the closing checks on the item as it was before the same command's `--clear`s; with
  the refusal and the accepted change pasted from a real run of `./bin/mstack` in a throwaway
  repository. Tests in a new `tests/mutation-scope.test.ts`, through `closeRepo()`: `R26 --size s,
  --base HEAD, --verification true and --clear verification at verifying are each refused without
  --closed-by and change nothing`, `R26 a title, a move to in_progress with --base, a done with
  --size after a killed run, --size m on a size s item, and any edit with the rule off are not
  refused`, `R27 --size s with --closed-by writes one mutation-scope row naming size and leaves
  closed_by as it was`, `R28 --status done --clear verification in a store whose verify is empty is
  refused with has no mutation run, and the item keeps its verification`. Done when `bun test
  tests/mutation-scope.test.ts` ends ` 4 pass` and ` 0 fail`, `bun test tests/state-cli.test.ts
  tests/cli.test.ts tests/item-size-base.test.ts tests/spec-size.test.ts
  tests/mutation-close.test.ts tests/mutation-merge.test.ts` ends ` 0 fail`, and the node command
  for `tests/mutation-scope.test.ts` prints `# fail 0`. (covers R26, R27, R28)

## 3. Verification and close

- [ ] 3.1 `bun run test && bun run typecheck && ./bin/mstack lint-plugin . && node
  scripts/check-doc-links.mjs README.md docs/wiki/*.md` all exit 0 (the Bash tool's `timeout:
  600000`). Then the seam by hand, in a throwaway repository, with this checkout's `./bin/mstack`
  and the repository as `cwd`, outputs pasted into the implementation report: for each of the five
  shapes (a merge commit, a squash merge, a rebase merge, a fast-forward, and a merge commit after
  another item's code landed on `main`), `gate --quiet` and `state set --status done` on the branch
  and on `main`, once with a killed receipt and once without; and `state set --status done --force
  --closed-by x` under a lock. The report's `| R | Test | Where |` table has a row for each of
  R1-R28. (covers R1-R28)
- [ ] 3.2 Independent review by a pass that did not write the code, at `reviewing`. It tries first
  to close an item with no holding killed receipt: every shape of design.md Fact 4 whose "This
  spec" column is `held`, an edited verification, a row of another item's slug, a row whose
  worktree was removed, a row of a prunable worktree record, a row whose `sha` is `HEAD`; then to
  make a holding receipt void on the shapes marked `pass`, R1, R3 and R4; then `done` under each
  kind of lock; then to take a held item out of the check at `verifying` with no `mutation-scope`
  row. (covers R4, R7 to R15, R24 to R28)
- [ ] 3.3 This item's own mutation run, from a copy of the CLI outside the tree: item 42's R5
  refuses `./bin/mstack verify --mutation` here, since the item changes `src/`. The item is at
  `reviewing` from step 1 to step 6, as item 42 was for its own run (`f5543aa` moved it to
  `verifying` after), so the new check, which the gate reports only at `verifying`, does not hold
  the copy's `gate --full`. Do it after 3.2 approved and every code and test change is committed,
  with no untracked test file (R16) and no flagged file (R14). Every mstack call from step 2 to
  step 5 goes through `"${TMPDIR:-/tmp}/mstack-100-cli/bin/mstack"`, run from the checkout's root.
  1. The session is a terminal, a Claude Code session with no mstack plugin, or one started with
     `claude --plugin-dir "${TMPDIR:-/tmp}/mstack-100-cli"` after step 2; not `--plugin-dir .`, whose
     hooks run the reverted `src/`. Where no hook knows the lock, issue no git command in the
     checkout until step 4 has reported.
  2. `git worktree add --detach "${TMPDIR:-/tmp}/mstack-100-cli" HEAD` prints `HEAD is now at <sha>`;
     the copy's `version` prints `mstack <version> at <that directory>`.
  3. The copy's `gate --full`, with the Bash tool's `timeout: 600000`, ends `PASSED` (at
     `reviewing`).
  4. The copy's `verify --mutation`, launched with `run_in_background: true`; wait for its
     completion notice. It says "recorded green at this tree, not re-run" and ends with a block
     that starts `mutation-killed:`, exit 0.
  5. If it did not: `test -e "$(git rev-parse --absolute-git-dir)/mstack-mutation.lock" && echo
     locked`; when locked, the copy's `verify --restore` exits 0. Find out why, and repeat from 3.
  6. `git worktree remove "${TMPDIR:-/tmp}/mstack-100-cli"`.
  7. `./bin/mstack state set mutation-closing-check --status verifying` prints `status: "reviewing"
     -> "verifying"`.
  Done when `tail -1 .mstack/verification.tsv | cut -f1,4` prints `mutation-closing-check` and
  `mutation-killed` separated by a tab, `git status --porcelain` prints nothing outside `.mstack/`,
  and `./bin/mstack gate --quiet`, at `verifying`, prints no line containing `mutation`. (covers R4,
  R8, R16)
- [ ] 3.4 PR, merge gate and close, as `skills/ship/SKILL.md` says, under the rule this item adds.
  Done when, after the merge, `./bin/mstack gate --quiet` prints no line containing `mutation`, and
  `./bin/mstack state set mutation-closing-check --status done --closed-by "PR #<n> merged as
  <sha>"`, with no `--force`, exits 0 and prints no line starting `  forced:`. If another item's
  code reached `main` between the merge and the close, the line names that path (design.md, C3 and
  L); the close is then `--force --closed-by "<the line>"`, and the report says so. (covers R1, R4,
  R8, R12, R13)
