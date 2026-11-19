**Verdict:** CHANGES_REQUESTED

Round 2 spec review of item 100 `mutation-closing-check`: `.mstack/specs/mutation-closing-check/` as
revised in `bbb1a1f` (head `8e21140`), with `.mstack/progress/spec_mutation-closing-check_r2.md`.
Reviewer: a pass that wrote neither the spec nor the round 1 review. `./bin/mstack gate` PASSED before
the review (0 failures, 0 warnings). Evidence under the session scratchpad `specreview100r2/`
(absolute: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/specreview100r2/`):
`words.mjs` (the check applied from spec.md's words, written by me, not from `rule.mjs`; it also
prints the Q that design.md "Shape" would find), `shapes.sh` -> `shapes.out` and `shapes2.sh` ->
`shapes2.out` (every shape judged by `words.mjs` and by the author's `rule.mjs`, copied as
`rule-author.mjs`), `qnew.sh` -> `qnew.out`, `clause.sh` -> `clause.out`, `glob.sh` -> `glob.out`,
`walk.sh` -> `walk.out`, `probe.sh` -> `probe.out`. Every fixture ran this checkout's `./bin/mstack`
with the fixture as cwd and an empty `HOME`; none ran with this checkout as cwd or store. Git's
answers are rung 4; every verdict of the rule is rung 3 (emulated: no code of the check exists).

## Round 1 findings

- **B1** mechanism closed: Qab is R9, R12, R13 with Q, P and "differs" in Terms. From the words, the
  nine failing shapes are all held: V5C, MODE2, RS by R12; V5D, AM1, AM2, RB2, W1 by R13; BASES by R9
  (`shapes.out`, `shapes2.out`). DELU passes, BASESM0 is held by R9, CPR passes. The other half of
  B1, "the true list", is not closed: new B1 below.
- **B2** closed. `probe.out` runs the whole suite in archive copies of `8e21140` with the author's
  stand-in check and `state()` writing the rule `false` (the author ran the whole suite only without
  that line): under A, `1095 pass, 2 skip, 1 fail`, the one failure being the walkthrough; under B the same, `1095 pass, 2 skip, 1 fail`, the
  walkthrough. Task 1.2 rewrites that test.
- **B3** closed: proposal.md "A new user's first close" and "What could break" name the walkthrough
  and item 42's R2 and R18 scenarios; tasks 1.2 and 1.5 change them.
- **B4** closed: task 3.3 runs steps 1 to 6 at `reviewing`, step 7 moves to `verifying`.
- **B5** closed: R3 split into R4, R5, R6, R10 into R21, R22, R23 (size l, 24 of 30).
- **Non-blocking 1 to 13**: all thirteen checked against the text, each applied as the hand-off's
  table says: N1 R3 "never HEAD" (spec.md:99-101) and design.md "Trade-offs accepted"; N2 R19; N3
  Terms (spec.md:44-46); N4 task 1.4; N5 R7; N6 R14; N7 Terms `--relative`; N8 task 3.3 step 1
  (tasks.md:239-240); N9 R16's fix; N10 R20; N11 R24 and task 2.2's linked-worktree test; N12
  proposal.md:30; N13 the hand-off's fork 1 text. N1 and N9 come back below.

## Grill

**Hidden assumptions.** (1) That "after the run" is visible as "after Q" on the first-parent
history. It is not when an after-run commit is put before Q, by a reorder or by landing first (B1).
(2) That the branch's own gate shows such a receipt void before the merge (the hand-off's reason for
fork 2's yes). It does not after a `rebase -i` on the branch (IREB). (3) That "add it to
`.gitignore`" keeps an uncommitted test out of the run. A test runner runs ignored files (B2). (4)
That the oldest first-parent commit holding S's content of P is the one that brought it. On a
history where that content existed before the item, it is an older commit (N2). (5) That a row's
sha is 40 hex digits (N4).

**Rejected alternatives.** Most reasons hold. "Q for a merge commit too" and "the patch-id rule"
were measured or argued soundly. "A closing-time void for an untracked test, in place of R16" is
true as stated (UNTR below). "Refusing `--base` at `verifying`" is true, but the alternative the
design itself calls sound (a decision row on a base move, as `spec-size` writes) is rejected only as
"a mechanism the acceptance does not need" (N1).

**Fail paths.** Covered: an unreadable or missing store, a prunable record, a ref as sha, flags. Not
named: a SHA-256 repository (N4), path names with glob characters (N5), a pruned run commit (N10).

## Blocking

**B1. "CPR is the only miss" is false.** Fork 2 asks the user to accept one exception, "a rebase
merge whose commits were reordered by hand" (`decision_required` on item 100, hand-off "Forks for the
user", proposal.md:55-61, design.md "What the rule misses"). From the words, four more shapes hold a
receipt after a test path of the item changed on its branch after the run. None needs a hand
reorder at the merge:

```
== PRE: after-run test commit cherry-picked to main first, then squash [A2 demands: void]
  WORDS=PASS | held: R3 start at HEAD lost | killed@7a7bc867: holds R12+R13 | rule.mjs=PASSES
== PRER: the same, then a rebase merge (the now-empty commit dropped) [A2 demands: void]
  WORDS=PASS | ... holds R12+R13 | rule.mjs=PASSES
== IREB: after-run test commit moved before the code by rebase -i, on the branch [A2 demands: void]
  WORDS=PASS | held: code diff src/greet.js from 1327919b (base) | ... holds R12+R13 | rule.mjs=PASSES
== IREBR: the same, then a rebase merge that keeps the branch's order [A2 demands: void]
  WORDS=PASS | ... holds R12+R13 | rule.mjs=PASSES
```

(`shapes.out`; controls IREBS, the same reorder then a squash, and RBM2 are held by R12.) PRE is an
ordinary flow: the after-run commit reaches `main` first, by a cherry-pick or as its own PR, and the
item is squash- or rebase-merged after it. IREB is a common tidy-up, tests first, done with
`rebase -i` before the PR. The forge's rebase merge then keeps that order, and the branch's own gate
already passes, so the hand-off's "the branch's own gate shows the receipt void before the merge
(R8)" is false for it. The common cause is that an after-run change at a path outside P lands on
HEAD's first-parent history before Q, and git alone cannot tell it from earlier work.

The smallest change has two parts:
1. Close IREB on the branch with one clause in R12: "or, where the start at HEAD can be computed, a
   path that is not in P differs between the start at HEAD and Q". `clause.out` shows IREB void
   (`outside P between start and Q: [tests/helpers.test.mjs] -> void`) and RE1, the rebased branch R12's
   scenario keeps, still holding. The clause is silent wherever the start at HEAD is lost, so it
   changes nothing after a merge.
2. Re-state fork 2, proposal.md "Acceptance 2, and its one exception" and design.md "What the rule
   misses" as that class, with its measured members (CPR, IREBR, PRE, PRER), and say that in each the
   branch's gate showed the receipt void before the merge. Also say that after a merge commit, a
   later commit on the default branch at a path outside P holds even when it is the item's own
   follow-up. MCF: `held: code diff src/extra.js,src/greet.js ... holds R10+R11`. R1 counts that file
   as the item's code, yet design.md calls such a commit other work.

The user then answers a fork that is true.

**B2. R16's own fix reopens what R16 closes.** The spec's reading of A1 (spec.md:17-19) is "an
untracked file never voids a receipt and R16 keeps one from earning it". R16's fix says "commit each
one or add it to `.gitignore`" (spec.md:298, tasks.md:154). Task 1.5 tests that "an ignored test
file ... do[es] not refuse the run". An ignored test is untracked, and `node --test tests/` runs it.
In each shape below, the committed test asserts nothing and the scratch test is the only one that
bites. The scratch test is then deleted:

```
== IGN: the scratch test ignored by a .gitignore committed before the item (R16 lets it run)
    mutation-killed: `node --test tests/` failed without the change ...
  scratch test deleted, on the branch:
  WORDS=PASS | held: code diff src/greet.js from 11b58f42 (base) | killed@74121e8a: holds R8
== GITIG: the scratch test ignored by a .gitignore line the item itself adds (R16's fix, in the item)
  WORDS=PASS | held: code diff .gitignore,src/greet.js from 8e6190e5 (base) | killed@7effceb1: holds R8
```

(`shapes2.out`.) The deletion is not even needed: the repository's tests never contained a test that
bites, and the receipt says they do. No sabotage is involved, because the CLI's own fix sends the
user there. Smallest change: R16's fix becomes "commit each one, or move it out of the store's root",
and its scenario and task 1.5's text follow. Add to the A1 reading and to "Trade-offs accepted" that
an ignored in-scope test file can still earn a kill, because R16 leaves ignored files alone so that
`tests/out.log` does not refuse.

## Non-blocking

1. **The ways past the check, and one that is not listed** (point 4). `--size s` at `verifying` is
   accepted and takes the item out of R1, with no marker. Nothing at `done` measures a size `s`
   item's diff (`checkSmallDiff` is gate-only, `src/gate.ts:297`). From `shapes2.out` WAYS-size:
   `size: (unset) -> "s"`, `exit 0`, `WORDS=not held (size s)`. WAYS-base gives the same for
   `--base HEAD`, and `--status done --clear verification` is one command (`src/cli.ts:694`). The
   spec lists the last two. I do not block: each one edits what the item declares, which every
   check here trusts, each needs a deliberate act at `verifying` against the fix's own words, and
   each is printed and lands in the committed `state.json`. A3's "forced close" is the `--force`
   path, which R17 to R20 put on the record. They still do not meet A3 in spirit, and the
   codebase's own rule (`src/cli.ts:751-757`, "a one-command way around it") is against the
   one-command form. Smallest closing: one requirement that a change of `size`, `base` or
   `verification` on an item at `verifying` needs `--closed-by "<why>"` and writes a decision row,
   as `spec-size` does (`src/cli.ts:997-1002`), plus the done branch judging the closing checks
   before this command's clears. The least acceptable change is adding `--size s` to "Trade-offs
   accepted".
2. **Q in the words differs from design.md "Shape", and the words void a revert.** The words take
   the oldest first-parent commit holding S's content of P. The plan searches `rev-list --first-parent
   --reverse HEAD -- <P>` "then the root commit". They differ when P's content at S already existed
   before the item. ALLDEL (the item only deletes `src/legacy.js`, which `main` added after its first
   commit): `void R12 Q's own change src/greet.js,tests/greet.test.mjs [Q ffb35155 Qfast 843a0806
   DIFFER]`. REVITEM (an item that reverts earlier work) is void under both: Q is the first commit.
   Neither is in "Voids that should hold". Smallest change: Q is the oldest first-parent commit
   *not in S's history* (`git rev-list --first-parent HEAD ^S`). `qnew.out` shows that ALLDEL and
   REVITEM then hold, every other fixture's verdict is unchanged, and the plan's search agrees.
   Also say how the start at S reads when the base is not a commit (the words are silent;
   `rule.mjs` voids by R9).
3. **"Staged or not"** (Terms) is not what `git diff C --` compares: it reads the working tree.
   STAGED, an edit staged and the file put back: `git diff --cached --name-only: src/greet.js`,
   `WORDS=PASS`. A later `git commit` lands code the run never saw. Say "as the working tree has it"
   or also compare `git diff --cached --name-only C --`.
4. **A SHA-256 repository closes nothing without `--force`.** Item 42 runs there and writes a 64-hex
   sha (`qnew.out`: `object format: sha256; ... row sha length: 64`, `void R7 commit cannot be found`).
   R7 should accept the object format's length.
5. **Pathspecs.** "Shape" passes P to `git diff ... S -- <P>`, `rev-list ... -- <P>` and `ls-tree`.
   `git diff --name-only HEAD~ HEAD -- 'src/[id].js'` lists `src/i.js` (`glob.out`), so a Next.js-style
   route path voids on other work. Use `--literal-pathspecs` (as The-CLI.md's manual restore does), or
   filter the full diff as Terms define it.
6. **Fork 1, answer B, written down.** By R22 an upgraded store's first rewrite writes
   `"require_mutation_to_close": false`, so B is an explicit off in every upgraded store, not
   "nothing until they add the key". The hand-off's B text should say so.
7. tasks.md:20-21 says "only R21's test (task 1.1) writes `rules` without it". The fork paragraph
   (:38-39) has two, tasks 1.1 and 1.2.
8. The pasted run says `test_shout ... ERROR` (a `TypeError`); task 1.2's page sentence says "saw
   `test_shout` fail". Say "error", to match the output beside it.
9. R4 carries the choice of row and the survived message. The message sits more naturally among
   R5's. Optional.
10. GC: after a squash, a deleted branch and `git gc --prune`, S is gone (`void R7 commit cannot be
    found`). Add it to "Voids that should hold", with the same way out (close right after the
    merge).

## The points asked about

1. **The rule as worded**, on shapes nobody had built (`shapes.out`, `shapes2.out`). Held as A2
   demands: DELWT (tracked file deleted, not committed: R8), CASE (`git mv` case-only: R8 names both
   paths), RBM2, IREBS, QAMB2 (squash, revert, other code, reapply: R13, the C3 cost), SUB-v5c (a store
   in `pkg/`). Holds as A2 demands: REVERTED (a test after the run, reverted: content as at the run),
   QAMB1, RBM (rebased after the run, then a merge commit: Q is the merge, and the fast search finds
   it too), the store in `pkg/` after a squash, a rebase merge and a merge commit, and `top.js` outside
   the store root (out of scope). Misses: B1. False voids: N2, N10. An untracked or ignored file is
   invisible by Terms, as spec.md:17-19 decides, except that R16's fix leads to it (B2). Shallow clone
   not built (see the end).
2. **Words against `rule.mjs`.** Same answer on every fixture judged here, 44 of them. Where the
   words and the plan differ: Q's search (N2) and pathspecs (N5; `rule.mjs` uses a pathspec for R10
   too). Where the words are silent: the start at S with a base that is not a commit (N2).
3. **R16 kept.** "What could break" states the amendment to item 42's R2 and R18 (proposal.md:95-100)
   and task 1.5 writes it into item 42's spec. Nothing else of item 42 is contradicted: R21's key
   scenarios with an untracked test are key-level (`tests/mutation-set.test.ts`), not runs, and
   The-CLI.md:826 stays true. The reason holds: UNTR (an untracked test earned the kill under today's
   CLI and was deleted) gives `holds R8`. It holds equally for an ignored test, which R16 lets run
   (B2).
4. **The ways out**: non-blocking 1.
5. **The walkthrough.** `walk.out` follows Getting-Started command by command and adds the step.
   `gate --full` at `reviewing` gives `PASSED - 0 failures, 1 warning` (2 uncommitted `.mstack/`
   changes). `verify --mutation` gives `exit 0 after 706 ms`, `1 code file(s) to revert`, and a last
   line that starts exactly as task 1.2 asserts. The row is `greet-flag mutation-killed`, and the
   words then pass the close by R8. The kill is a `TypeError: greet() got an unexpected keyword
   argument 'shout'`: the test reaches the new parameter. It does not show that the test checks the
   uppercase (design.md Fact 3: a test that asserts nothing kills too). That is an honest first
   experience only because task 1.2 makes the page say so; keep that sentence (and N8).
6. **Fork 1 and the tests.** The claim reads true: only the walkthrough changes (`probe.out` under A
   and B). Every new test says what it writes. `closeRepo()` writes `true`, the two R21 tests write no
   key and assert each answer, the R22 test writes `false`, and R16's tests do not read the rule. All
   of these run the same under A and B. The exceptions are the two R21 tests, which are written per
   answer.
7. **Tasks 3.3 and 3.4.** The statuses are right, each "Done when" can be printed, steps 2 and 6 are
   the only git writes and fall outside the revert, step 1 rules out `--plugin-dir .` and restores
   "issue no git command ... until step 4 has reported", and R14 and R16 are stated as preconditions.
   This repository has not closed an item through a PR: `main`'s first-parent history is linear, and
   items 42 and 104 closed before `main` moved. Under a fast-forward, a merge commit, a squash or a
   rebase merge the row holds (R8, R10 and R11, or R12 and R13), as long as no other item's code
   lands first. With one active item it does not, and 3.4 names the forced close if it does. 3.4
   also needs a verification receipt at the merge commit (`gate --full` on `main`, ship step 7). I
   found no state in which item 100 cannot close.
8. **One obligation each; coverage.** Every requirement carries one obligation (R4: N9). All 24 are
   named by a task: R1 1.2/3.4, R2 1.2/2.1, R3 and R9-R13 1.3, R4-R8 and R14 1.2, R15 1.4, R16 1.5,
   R17-R20 2.1, R21-R23 1.1, R24 2.2. The "Done when" counts match the test lists (3, 12, 11, 4, 23,
   7, 5). None restates item 42. R22 is not redundant with `updateState`, because under B it is what
   writes the `false`.

**A third fork?** No. Fork 2 has to be re-stated (B1) before it reaches the user. Non-blocking 1
becomes a product fork only if the coordinator reads A3's "on the record" as covering every close
past the check.

## Evidence ladder, and what was not done

Rung 4: git's answers on every shape; the suite runs in `probe.out`; the walkthrough run; item 42's
runs in the SHA-256, IGN, GITIG and UNTR fixtures; `glob.out`. Rung 3: every verdict of the closing
check (emulated in `words.mjs`), and the reading of the tests' fixtures for point 6. Not done: a
shallow clone (by reading, the first-parent list stops at the boundary and R12 voids, which fails
closed), Linux, and the node runtime for the fixtures. The lock test on this checkout's git
directory is false (`no lock`).
