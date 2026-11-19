How every task is checked. A task's tests run with `bun test tests/<file>`, which ends with ` N pass`
and ` 0 fail`, and under node with `node --disable-warning=ExperimentalWarning
--experimental-strip-types --test tests/<file>`, which prints `# fail 0`. `bun run typecheck` exits 0
after every task. The seam is the CLI: every new test builds a throwaway git repository with
`sandbox()` (`tests/helpers.ts:30`) and the helpers of `tests/mutation-fixture.ts`, and runs
`bin/mstack gate --quiet`, `bin/mstack state set ...` and `bin/mstack verify --mutation` as child
processes with the repository as `cwd`, as `tests/mutation-cli.test.ts` does; no mocks of git, and
no test runs with this checkout as `cwd`. A killed row comes from a real `verify --mutation` whose
obligation is the item's `verification`, `sh tests/check.sh`, a test path the revert never touches,
which exits 1 unless `src/greet.js` contains `HELLO`. Where a test needs `state set --status done`
to succeed it also sets `rules.require_verdict_to_close` to `false`, writes
`.mstack/progress/impl_greet.md` holding `| R | Test | Where |` and `| A1 | check | tests/check.sh:1 |`,
and runs `bin/mstack gate --full` at that commit, so that this check is the one deciding. Names
(the terms, `MUTATION_CHECK`, `storesRead`, `holds`, `forcedMarker`) are defined in spec.md "Terms"
and design.md "Shape", in this directory. Each implementation task ends with the implementer's `| R
| Test | Where |` table for the requirements it covers (`agents/implementer.md`, "Your report"), and
adds its line to the Unreleased section of `CHANGELOG.md`.

## 1. The check

- [ ] 1.1 The rule. In `src/state.ts`, add `require_mutation_to_close` to `State.rules` (`:57-63`), to
  the parse (`:153-158`), reading an absent key as the fork's answer recorded in decisions.tsv by
  `decide --resolves mutation-closing-check` (A: `!== false`; B: `=== true`), and to
  `KNOWN_RULE_KEYS` (`:252`); in `src/setup.ts`, make `seedState` (`:111-116`) write it `true`. Add
  `"require_mutation_to_close": true` to the `rules` of this repository's `.mstack/state.json`, and
  name five rules in `docs/wiki/State-Files.md:40-41`. Tests in a new `tests/mutation-rule.test.ts`:
  `R10 setup writes the rule true`, `R10 a state.json without the rule reads it as the fork's
  answer`, `R10 a rewrite by state set keeps the rule and its value`. Done when `bun test
  tests/mutation-rule.test.ts` ends ` 3 pass` and ` 0 fail`, the node command prints `# fail 0`,
  `bun test tests/state.test.ts tests/state-cli.test.ts` ends ` 0 fail`, and `./bin/mstack gate`
  ends `PASSED`. (covers R10)

- [ ] 1.2 The check on the branch. Create `src/mutation-close.ts` with `MUTATION_CHECK`,
  `mutationCheck` and `holds` as design.md "Shape" defines them, reading this store's rows only and
  judging a row whose S is not on HEAD's first-parent history as not holding (task 1.3 replaces
  that); append `mutationCheck` to `CLOSING_CHECKS` (`src/closing.ts:272`). Export the text of R5's
  fix from `src/mutation.ts` (`:310-313`) as one constant and use it in both places. Add a
  "closing check" entry to "What `mstack gate` checks" in `docs/wiki/Gates-and-Hooks.md`, after the
  review budget's (`:431`), with the `[fail]` and `fix:` lines pasted from `./bin/mstack gate` in a
  throwaway repository holding an item at `verifying` with no run. Tests in a new
  `tests/mutation-close.test.ts`: `R1 an item at verifying with a code diff and no run fails the
  gate and is refused at done`, `R1 no base, size s, only tests and docs, only untracked code, or no
  obligation: nothing about the mutation check`, `R1 at reviewing, and at verifying under a lock,
  the gate prints no mutation line`, `R10 with the rule false an item with code and no run is not
  held`, `R3 a killed run answers the check in the gate and at done`, `R3 a later survived run is
  reported as survived, naming its commit`, `R3 a later blocked run leaves a killed one standing,
  and blocked runs alone are reported`, `R3 a verification edited after the run is reported naming
  the command that ran`, `R3 the fix names verify --mutation and the forced close, and the copy
  commands in an mstack checkout` (the sandbox writes `.claude-plugin/plugin.json` with `"name":
  "mstack"`, and `bin/mstack` and `src/cli.ts`, which `isMstackCheckout` also requires,
  `src/paths.ts:122-139`; the test reads only the mutation line), `R4 a docs commit, a store
  commit and a fast-forward keep the receipt`, `R4 a test committed after the run, or an uncommitted
  code edit, voids it and the line names the path`, `R4 untracked files created after the run do
  not void it`, `R4 other work fast-forwarded onto main before the close voids it`. Done when `bun
  test tests/mutation-close.test.ts` ends ` 13 pass` and ` 0 fail`, `bun test tests/closing.test.ts
  tests/gate.test.ts tests/gate-full-closing.test.ts` ends ` 0 fail`, the node command for
  `tests/mutation-close.test.ts` prints `# fail 0`, and `node scripts/check-doc-links.mjs README.md
  docs/wiki/*.md` ends `0 broken`. (covers R1, R3, R4, R10)

- [ ] 1.3 The check after a merge. In `src/size.ts`, give `measureStart` (`:81`) the optional third
  argument `{ head?, against? }` of design.md "Shape" (`forkPoint`, `:102`, takes the commits to
  compare with); in `src/mutation-close.ts`, judge a row whose S is not on HEAD's first-parent
  history by R5 and R6, and report a code diff that cannot be computed by R2. Add "After the
  merge" to `## verify` in `docs/wiki/The-CLI.md`: what holds a receipt after a fast-forward, a
  merge commit, a squash and a rebase merge, what voids it, the two holes of design.md "Trade-offs
  accepted" (V5C and L), and the transcript of a squash merge closed on its receipt, pasted from a
  real run of `./bin/mstack` in a throwaway repository. Tests in a new
  `tests/mutation-merge.test.ts`, each with a killed run on `feat/greet` first unless it says
  otherwise: `R5 a merge commit keeps the receipt, main moved or not`, `R5 a squash merge keeps the
  receipt, main moved or not`, `R5 a rebase merge keeps the receipt, main moved or not` (the
  branch's commits cherry-picked onto `main` with `GIT_COMMITTER_DATE` a minute later), `R5 main's
  edit to another line of the item's file voids it, naming the file`, `R5 a branch rebased after
  the run, or before it and then squash-merged or merged, keeps it`, `R5 a docs commit after the
  run keeps it through a squash, and a row whose commit git cannot find does not hold`, `R6 a test
  added on the branch after the run voids it through a merge commit, naming the test`, `R6 a docs
  commit after the run keeps it through a merge commit`, `R2 after a squash with no run the line
  says the start is lost and names --base, and the forced close is allowed`, `R2 an item with no
  code of its own is not held once --base names the commit before the squash`, `R2 a base that is
  not a commit is held and names --base`. Done when `bun test tests/mutation-merge.test.ts` ends `
  11 pass` and ` 0 fail`, `bun test tests/item-size-base.test.ts tests/mutation-refusals.test.ts
  tests/mutation-close.test.ts` ends ` 0 fail` (the size check and the refusals keep their start),
  the node command for `tests/mutation-merge.test.ts` prints `# fail 0`, and the doc-links command
  ends `0 broken`. (covers R2, R5, R6)

- [ ] 1.4 Rows of the other worktrees. In `src/mutation-close.ts`, add `storesRead` and read the
  rows of every store it names (design.md "Shape"). In `skills/ship/SKILL.md` step 7 (`:31-35`), add
  one sentence: an item worked in a linked worktree is closed before that worktree is removed,
  because `git worktree remove` deletes its mutation receipt. Tests in a new
  `tests/mutation-close-worktrees.test.ts`: `R7 a run in a linked worktree answers the check in the
  main checkout after a merge commit`, `R7 an untracked notes.txt in the linked worktree at the run
  does not void it after a fast-forward`, `R7 after git worktree remove the check reports no
  mutation run`, `R7 another worktree whose verification.tsv is missing or a directory gives no
  rows and no failure`. Done when `bun test tests/mutation-close-worktrees.test.ts` ends ` 4 pass`
  and ` 0 fail`, the node command prints `# fail 0`, and `./bin/mstack lint-plugin .` exits 0.
  (covers R7)

- [ ] 1.5 The untracked-test refusal. In `src/mutation.ts`, add R8 to `refusals` (`:221`) after the
  tracked-change refusal (`:291-298`), from `git ls-files --others --exclude-standard -z` kept to
  `scopeClass(store)` `test`, naming up to ten with `some` (`:199`). Add it to "What it refuses" in
  `docs/wiki/The-CLI.md` (`:803-813`). Tests added to `tests/mutation-refusals.test.ts`: `R8 an
  untracked test file refuses the run, naming it, and writes nothing`, `R8 an ignored test file
  and an untracked code file do not refuse the run`. Done when `bun test
  tests/mutation-refusals.test.ts` ends ` 23 pass` (21 before) and ` 0 fail`, or fewer passes plus
  skips on a case-sensitive filesystem, `bun test tests/mutation-run.test.ts tests/mutation-cli.test.ts`
  ends ` 0 fail`, and the node command for the refusals file prints `# fail 0`. (covers R8)

## 2. The done transition

- [ ] 2.1 The forced close. In `src/cli.ts`, replace the choice of marker (`:769-775`) with
  `forcedMarker(checks)` over the overridden checks, list the seven markers in `FORCED_MARKERS`
  (`:299`), and print one forced line per overridden check (`:807-817`), the mutation one `  forced:
  closed without a killed mutation receipt - <messages>`. Extend the sentence on markers in
  `docs/wiki/Gates-and-Hooks.md` (`:426-429`) with the new phrase and a combined one. Tests in a new
  `tests/mutation-forced.test.ts`: `R9 a forced close past a survived run prints the line and stores
  the marker`, `R9 the marker survives a later --closed-by`, `R9 --force without --closed-by exits 2
  and the item stays`, `R9 past the verification check and this one, and past all three, the marker
  names each`, `R9 the three markers of today are byte-identical`, `R9 after a forced close the gate
  prints no line about the closed item's mutation check, and state show prints its closed_by`. Done
  when `bun test tests/mutation-forced.test.ts` ends ` 6 pass` and ` 0 fail`, `bun test
  tests/state-cli.test.ts tests/r-table-check.test.ts tests/gate.test.ts` ends ` 0 fail`, and the
  node command for `tests/mutation-forced.test.ts` prints `# fail 0`. (covers R9)

- [ ] 2.2 `done` under a lock. Move `lockProblem` from `src/gate.ts` (`:698-719`) to
  `src/mutation-lock.ts`, export it, and call it from the gate and from the `done` branch of
  `cmdState` (`src/cli.ts:758`), which throws a `UserError` with its message and fix before
  `closingProblems` runs, whatever `--force` and the rule say. Add to "While it runs" in
  `docs/wiki/The-CLI.md` (`:821`) that `state set --status done` is refused under the lock. Tests in
  a new `tests/mutation-done-lock.test.ts`, each writing a lock into the sandbox's git directory as
  `tests/mutation-gate.test.ts:45` does: `R11 done under the lock of a dead run is refused with
  --force and --closed-by, naming the restore`, `R11 done under the lock of a live run says to
  wait`, `R11 done under a lock that cannot be read names git stash push --include-untracked`, `R11
  with the rule off done is still refused under a lock, and a move to in_progress is not`. Done
  when `bun test tests/mutation-done-lock.test.ts` ends ` 4 pass` and ` 0 fail`, `bun test
  tests/mutation-gate.test.ts` ends ` 10 pass` and ` 0 fail`, and the node command for both files
  prints `# fail 0`. (covers R11)

## 3. Verification and close

- [ ] 3.1 `bun run test && bun run typecheck && ./bin/mstack lint-plugin . && node
  scripts/check-doc-links.mjs README.md docs/wiki/*.md` all exit 0 (the Bash tool's `timeout:
  600000`). Then the seam by hand, in a throwaway repository, with this checkout's `./bin/mstack`
  and the repository as `cwd`, outputs pasted into the implementation report: for each of the five
  shapes (a merge commit, a squash merge, a rebase merge, a fast-forward, and a merge commit after
  another item's code landed on `main`), `gate --quiet` and `state set --status done` on the branch
  and on `main`, once with a killed receipt and once without; and `state set --status done --force
  --closed-by x` under a lock. The report's `| R | Test | Where |` table has a row for each of
  R1-R11. (covers R1-R11)
- [ ] 3.2 Independent review by a pass that did not write the code. It tries first to close an item
  with no holding killed receipt: V4, V5A, V5B, V6 and L of design.md Fact 4, an edited
  verification, a row of another item's slug, a row whose worktree was removed, a row of another
  worktree whose store is at another path; then to make a holding receipt void on the five shapes,
  R1, R2 and R3; then `done` under each kind of lock. (covers R3, R4, R5, R6, R7, R11)
- [ ] 3.3 This item's own mutation run, from a copy of the CLI outside the tree: R5 refuses
  `./bin/mstack verify --mutation` here, since the item changes `src/`. Do it after 3.2 approved and
  every code and test change is committed, with no untracked test file (R8). Every mstack call from
  step 2 to step 5 goes through `"${TMPDIR:-/tmp}/mstack-100-cli/bin/mstack"`, run from the
  checkout's root.
  1. The session is a terminal, a Claude Code session with no mstack plugin, or one started with
     `claude --plugin-dir "${TMPDIR:-/tmp}/mstack-100-cli"` after step 2; not `--plugin-dir .`, whose
     hooks run the reverted `src/`.
  2. `git worktree add --detach "${TMPDIR:-/tmp}/mstack-100-cli" HEAD` prints `HEAD is now at <sha>`;
     the copy's `version` prints `mstack <version> at <that directory>`.
  3. The copy's `gate --full`, with the Bash tool's `timeout: 600000`, ends `PASSED`.
  4. The copy's `verify --mutation`, launched with `run_in_background: true`; wait for its
     completion notice. It says "recorded green at this tree, not re-run" and ends with a block
     that starts `mutation-killed:`, exit 0.
  5. If it did not: `test -e "$(git rev-parse --absolute-git-dir)/mstack-mutation.lock" && echo
     locked`; when locked, the copy's `verify --restore` exits 0. Find out why, and repeat from 3.
  6. `git worktree remove "${TMPDIR:-/tmp}/mstack-100-cli"`.
  Done when `tail -1 .mstack/verification.tsv | cut -f1,4` prints `mutation-closing-check` and
  `mutation-killed` separated by a tab, `git status --porcelain` prints nothing outside `.mstack/`,
  and `./bin/mstack gate --quiet` prints no line containing `mutation`. (covers R4, R8)
- [ ] 3.4 PR, merge gate and close, as `skills/ship/SKILL.md` says, under the rule this item adds.
  Done when, after the merge, `./bin/mstack gate --quiet` prints no line containing `mutation`, and
  `./bin/mstack state set mutation-closing-check --status done --closed-by "PR #<n> merged as
  <sha>"`, with no `--force`, exits 0 and prints no line starting `  forced:`. (covers R1, R3, R4,
  R5)
