**Verdict:** CHANGES_REQUESTED

Spec review of item 100 `mutation-closing-check`, `.mstack/specs/mutation-closing-check/` at
`fdf2043`. Reviewer: a pass that did not write the spec. `./bin/mstack gate` PASSED before the
review. Evidence is in the scratchpad `specreview100/` (absolute:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/specreview100/`):
`rv.mjs` (the closing check emulated from spec.md's words, plus two candidate rules), `shapes.sh`
-> `shapes.out` (23 new shapes), `shapes2.sh` -> `shapes2.out` (the author's 17 rebuilt),
`worktrees.sh` -> `worktrees.out`, `w2.sh` -> `w2.out`, `fact1.sh` -> `fact1.out`, `fact1b.out`,
`counts.sh` -> `counts.out`. Every fixture ran this checkout's `./bin/mstack` with the fixture as
cwd and an empty `HOME`; nothing ran with this checkout as cwd or store.

## Grill

**Hidden assumptions.**
- "The branch's gate at `verifying` showed the receipt void before the merge (V5A, V6)"
  (design.md:266-268) is the defence of V5C. It holds only while S stays on HEAD's first-parent
  history. After an amend, a rebase or a reset of the branch, S is off it, R5 judges only the
  paths the item changed up to S, and the branch's own gate passes (B1).
- The start at S is assumed to be the run's start. The row does not record it, and the start
  follows the item's `base`, which `state set --base` moves at any status. `--base S` makes the
  item's paths of the row empty, and R5 then holds with nothing compared (B1, shape BASES).
- "Every other requirement and every task fits either answer" of the fork (hand-off, Fork): the
  test fixtures write `state.json` without the new key (B2).
- No shipped test or page closes an item with code: the Getting-Started walkthrough does (B3).
- `git diff S --` is taken to see the working tree. It does not see an edit under
  `assume-unchanged` or `skip-worktree` set after the run (N6).
- Task 3.3 assumes an unstated status (B4).

**Rejected alternatives.** Three of the stated reasons hold: rows of this store only (the
linked-worktree flow, measured), C' from the base (rebased branches), closing before the merge
(the coordinator's answer). Two do not. "Recording which commits are the item's ... Git keeps
nothing of it after a squash" (design.md:253-255): the item's paths of the row and S's tree are
known, and so is the first-parent commit Q at which those paths took S's content. Requiring
that Q changed no code or test path outside them closes V5C after a squash, and no answer
changes on the author's 19 shapes (B1). "Writing the start into the row" was rejected because
old rows lack it. A row from now on could still carry it, with old rows falling back, and that
would close BASES. The reason covers old rows only.

**Fail paths.** The spec names an unreadable store, a lost start, git failing and a lock. It
does not name: a row `sha` from another store that begins with `-` and is handed to `git
merge-base`, `ls-tree` or `diff` (N5); a `prunable` worktree entry, whose path git no longer
owns, which R7 still reads (N3, measured); a run in a linked worktree racing a close in the main
checkout (N12).

## Blocking

**B1. Acceptance 2 is not met, and the hole is wider than the one admitted.** A2 says the
receipt "is void when a code or test path of the item changed after the run", with no
exception. Decision row 299 accepts "a path first changed on the branch after the run is not
seen after a squash or rebase merge (V5C)". By R5's words (spec.md:158-161: "every one of the
item's paths of the row holds S's content"), any path outside those paths goes unseen whenever
S is off HEAD's first-parent history and no merge brought S in, and that includes the branch
itself. Emulated from the spec's words (`rv.mjs`). Git's answers are rung 4, the rule rung 3:

| Shape (row killed at S on `feat/greet`) | Spec | Qb | Qab |
|---|---|---|---|
| V5C test after the run, squash (the admitted hole) | **passes** | held | held |
| V5D the same, rebase merge | **passes** | passes | held |
| AM1 `commit --amend` adding `tests/helpers.test.mjs`, on the branch | **passes** | passes | held |
| AM2 amend changing `src/other.js`, on the branch (R1's code diff now lists it) | **passes** | passes | held |
| RB2 rebased after the run, then a test committed, on the branch | **passes** | passes | held |
| RS `reset --soft` and one recommit adding a test, on the branch | **passes** | held | held |
| MODE2 `chmod +x src/other.js` after the run, squash | **passes** | held | held |
| W1 a row from a linked worktree on an abandoned attempt; this branch adds `src/extra.js` | **passes** | passes | held |
| BASES code edit after the run, `state set greet --base <S>`, squash (paths of the row: none) | **passes** | held | held |
| CPR rebase merge with the after-run commit reordered before the code commit | passes | passes | passes |
| C3 squash, then another item's code on main before the close | passes | passes | held |
| Controls: AM3, RV2, REN, MODE, FLIP, TWO, OCT2, FPB, INTEG | held | held | held |
| RV1 revert and reapply, same content; OCT octopus merge | passes | passes | passes |

On the author's 17 rebuilt shapes (`shapes2.out`) all three columns give the author's answer.
**Qb** is R5 plus two clauses: the item's paths of the row are not empty, and, where no merge
brought S in, Q (the oldest commit on HEAD's first-parent history at which every path of the row
has S's mode and blob) changed no in-scope code or test path outside them against its first
parent. It costs nothing measured. **Qab** adds (a): no in-scope code or test path differs
between Q and the working tree. It costs C3, which is the L trade-off design.md already accepts
for a fast-forward, extended to squash and rebase merges. CPR stays open under both, so no
git-only rule here meets A2 for every shape. Smallest change: adopt Qb, take Qab or narrow A2
through the user (second fork below), and replace design.md "Trade-offs accepted" V5C with the
true list.

**B2. The fork reaches the tasks, not only R10.** The tests write their own `state.json`
through `state()` (`tests/helpers.ts:190-197`, rules without the new key), and so does
`tests/mutation-fixture.ts:92,233`, which tasks.md:4-8 makes the base of every new test.
- Under B (absent is `false`), every new R1-R7 test built that way sees the rule off and cannot
  print `has no mutation run` unless it writes the key. No task says to.
- Under A, existing tests change. `tests/r-table-check.test.ts:387-395` (base `box.sha`,
  verification `pytest -q`, `src/x.ts` committed, at `verifying`) is held. Forced, its marker
  becomes `closed unverified and without a killed mutation receipt (forced): ...`, and it
  asserts `closed unverified (forced): no python on this host`. Task 2.1's done condition
  (`tests/r-table-check.test.ts ... ends 0 fail`, tasks.md:119-121) then fails.

Rung 3 (code read; the check is not written). Smallest change: one tasks.md sentence. Either
every new test writes `rules.require_mutation_to_close: true`, or `state()` gets the key and
the existing tests that close an item with base, obligation and code are named with what they
assert afterwards.

**B3. Shipped behaviour breaks and the spec does not say so.**
- The Getting-Started walkthrough (item 96, `tests/walkthrough.test.ts`) runs `mstack setup`
  (:106), which writes the rule `true` after task 1.1 under either answer. It starts
  `greet-flag` with a base (:124), changes `greet.py` (code), sets a verification, and at
  `verifying` closes without `--force`, asserting exit 0 (:179-182, :214-217). With no mutation
  run that close is refused. No task changes the test or `docs/wiki/Getting-Started.md`, so a
  new user's first close would now need `verify --mutation`. Task 3.1's `bun run test` cannot
  pass as written.
- R8 makes two of item 42's scenarios unreachable: R2 "An untracked test edited during the
  baseline" (`mutation-check/spec.md:131-134`) and R18 "Untracked code and tests"
  (`:548-551`). Both start a run with an untracked `tests/new.test.ts`.
  `tests/mutation-changed.test.ts:90-100` asserts the R18 `(e) ... tests/new.test.ts` line and
  will fail, because R8 refuses before the baseline. `tests/mutation-run.test.ts:113` will still
  pass, for R8's reason instead of R2's. Task 1.5's done condition leaves the file out.

Smallest change: name both in proposal.md "What could break". Add a step to task 1.2 or 1.4 for
the walkthrough and its page. Add one to task 1.5 that retires or rewrites the two item 42
tests and records the change against item 42's R2 and R18.

**B4. Task 3.3 cannot be executed as written at `verifying`.** tasks.md does not say which
status the item is at. At `verifying`, step 3's copy `gate --full` "ends `PASSED`"
(tasks.md:163) cannot happen: `--full` leaves out only the verification check
(`src/gate.ts:748`), and the new check reports item 100's missing run until step 4 makes it.
Item 42 ran its 5.3 at `reviewing` and moved to `verifying` afterwards (`f5543aa`). Smallest
change: "at `reviewing`; move to `verifying` after step 6", or let step 3 accept that one line.

**B5. R3 carries two obligations by its own title**, "What answers the check, and what the
problem says" (spec.md:102-111): which row decides, and the precedence and fix text of five
messages. R10 carries three: the absent reading (the fork), keeping the key on a rewrite, and
`setup` seeding it. A third obligation would be one too many for a split here. Split R3, and
move `setup` writes `true` out of R10. With B1's clauses added, that is more than 12 for size m,
so `state set mutation-closing-check --size l` (limit 30) or a cut.

## Non-blocking

1. **Unmarked ways out.** `state set greet --base HEAD` empties the code diff, so R1 does not
   hold the item and it closes with no marker (`shapes.out` BASEH: `R1: not held (code diff
   empty)`). R2's fix names `--base <commit>` without saying which commit. In a store whose
   `verify` is `""` (setup's seed), `--status done --clear verification` clears before the check
   (`src/cli.ts:694`). Measured on today's CLI (`worktrees.out` W5): the verification problem
   leaves the refusal. By R1 the mutation check goes with it. Smallest change: R2's fix names the
   commit (the first parent of the squash, never HEAD), and "Trade-offs accepted" lists both
   ways out. R1's no-obligation exemption also narrows A1's text, as decision row 302 records.
2. **`--clear closed-by` erases the record.** Today's CLI, `worktrees.out` W4: `closed_by:
   "closed unverified and without a good requirem..." -> (unset)`, exit 0. R9 keeps the marker
   only across `--closed-by`. Smallest change: R9 refuses `--clear closed-by` on a marked note,
   or keeps the marker.
3. **R7 reads `prunable` entries.** A hand-written `.git/worktrees/forged/gitdir` is listed
   with `prunable gitdir file points to non-existent location`, and its rows are judged
   (`w2.out`: `row mutation-killed ... from .../forged/.mstack/verification.tsv by R4:
   holds=true`). This is no new trust boundary, since writing `.git/worktrees` is as easy as
   writing this store. But a prunable path no longer belongs to the repository. Skip such
   entries, and use `--porcelain -z`.
4. **The bend is undocumented.** R7 contradicts `docs/wiki/Gates-and-Hooks.md:703-707` ("a
   receipt from another checkout would let one worktree's run stand in for a run nobody in this
   one ever did"), and no task edits that paragraph. Add it to task 1.4. W1 shows the bend
   widens B1's hole to rows from other branches of the same slug. Qab closes that.
5. **A row's `sha` from another store goes to git unchecked.** Require a full hex sha, or
   `resolveCommit`, which refuses a leading `-` (`src/size.ts`), before any git call (design.md
   "Shape" `holds`).
6. **R4 and R1 miss an edit hidden by `assume-unchanged` or `skip-worktree` set after the run**
   (`worktrees.out` W3: `git diff --name-only <S> --: []`, `hash-object 5f3cf12b vs 0e356c75`,
   `SPEC: PASSES`). spec.md says "the working tree" and design.md's command does not see it.
   Item 42 refuses a run under those flags (`flaggedTracked`). The check should report them.
7. design.md:207's R6 command has no `--relative`, while R6 says "in-scope". In a subdirectory
   store it classifies repo-top paths.
8. Task 3.3 step 1 dropped item 42's "Where no hook knows the lock, issue no git command in the
   checkout until step 4 has reported" (`mutation-check/tasks.md:371`). A session with no mstack
   plugin has no hook that denies `git commit -a` of the reverted `src/`. Restore it.
9. R8 says what a kill would mean but not the fix. Staging is not enough: the dirty-tree
   refusal (`trackedChanges`, `--untracked-files=no`) then refuses. The message should say
   commit it, or add it to `.gitignore`.
10. `--force` without `--closed-by` hints "closing unverified" for any non-table marker
    (`src/cli.ts:804`). R9 should pin the hint for a mutation-only force.
11. R11's lock is this checkout's (`gitDirOf`). A run in a linked worktree does not refuse
    `done` here, and A4 says "a mutation lock". Say which.
12. proposal.md:36 cites "tasks.md 4.3, 4.4". They are 3.3 and 3.4.
13. The hand-off's cost for answer A, "no run is possible after a merge", is too strong. After a
    squash, `--base Q^` makes a run possible (start Q^, revert set the squash's code).

## The points asked about

- **Words against the emulation.** On the author's 17 rebuilt shapes and V5C, the words give
  the author's answers (`shapes2.out`). They differ from `eval.mjs` in four places. (a)
  `eval.mjs` takes the file's last decisive row of any command, while R3 takes the newest by
  `ts` among the holding rows of the joined command. (b) R6's `--relative` (N7). (c) R7's
  discovery (N3). (d) `git diff` against "working tree" (N6).
- **Other merge shapes.** Octopus: holds, and R6 catches an after-run test (OCT2). Main merged
  into the branch, then a fast-forward: void by R4, failing closed (FPB). Rename, mode, and a
  test moved to `docs/`: void (REN, MODE, FLIP). Two items sharing a file: void (TWO). An
  integration branch: void by R6, failing closed (INTEG). Amend, rebase, reset, mode outside
  the paths, another attempt's row: B1. No shape tried was a submodule. A gitlink in the
  revert set is refused by item 42's R3 (`REGULAR`), so no killed row can exist for one. A path
  outside the store root is out of scope by item 42's Terms.
- **R8 against item 42.** It is within A2's needs (B3's second companion) and contradicts R2
  and R18's scenarios (B3). For someone mid-work: a new test must be committed or ignored before
  the run (N9).
- **R9 against `closing.ts` and `cli.ts`.** The description of today's path is accurate
  (`:772-775` picks `FORCED_UNVERIFIED` for any non-table problem; `:810-812` is the line). The
  seven markers are all `closed <phrases> (forced): ` and a phrase cannot contain `(forced)`,
  so none is a prefix of another and the `find` at `:861` stays right. The record a person
  finds later is `closed_by` in the committed `state.json`, printed by `state show`. The gate
  does not read it. That meets A3 except for N2.
- **Exemptions.** No obligation, and `--base`: N1. A diff that cannot be computed: held and
  overridable, which fails closed and has a way out. No code of its own after a merge: held
  without cause, with a stated way out. None of them wedges an item.
- **This repository.** B4 and N8. With those fixed, the copy, `gate --full`, the run and the
  close are runnable. The copy is a linked worktree whose ignored store is empty, so R7 reads
  nothing from it. I found no state in which item 100 cannot close at all: a survived run is
  the forced close's business.
- **Fact 1.** Re-run, the output is byte-identical (`fact1.sh`: "fact1 identical", "fact1b
  identical"): 53 closed, 9 with a base, 6 with code (40, 41, 42, 43, 82, 95), 0 of size s, R3
  0, R4 0, all 6 reach item 42's R5 from `./bin/mstack`, and 1 refused window in 41. The current
  `state.json` agrees (53 done, 9 with a base). The project `verify` is set, so every item here
  has an obligation.
- **Counts the tasks cite.** `mutation-refusals` 21 pass and `mutation-gate` 10 pass, as tasks
  1.5 and 2.2 say (`counts.out`, an archive copy of `fdf2043`).

## Second fork for the user

A2 cannot be met for every merge shape by a rule that reads only git (CPR), so the narrowing is
the user's, not the spec's. Wording: "A receipt is to be void when a code or test path of the
item changed after the run: accept rule Qab, which also voids it when other work lands on the
default branch between a squash or rebase merge and the close and misses only an after-run
commit that a rebase merge reorders before the item's code, or keep the spec's rule and narrow
acceptance 2 to say a path first changed after the run is not seen whenever the run's commit is
not on HEAD's first-parent history (a squash, a rebase merge, or an amend, rebase or reset of
the branch)?"

## Evidence ladder

Git's answers on every shape, the worktree listing, the CLI on `--clear closed-by` and
`--clear verification`, Fact 1 and the test counts: rung 4, run here. The rule's verdicts are
rung 3: emulated from the words in `rv.mjs`, which imports `measureStart`, `scopeClass`,
`obligations` and `readRecords` from this checkout. B2, B3 and B4 are rung 3: the code and tests
read, since the check does not exist yet. Not done: Linux, the node runtime for the fixtures,
and a run of the walkthrough with the check in place.
