**Verdict:** CHANGES_REQUESTED

Round 3 spec review of item 100 `mutation-closing-check`: `.mstack/specs/mutation-closing-check/` as
revised in `d9f6342` (head `69e5bdb`), with `.mstack/progress/spec_mutation-closing-check_r3.md`.
Reviewer: a pass that wrote neither the spec nor either earlier review. Scope: what changed in
`git diff bbb1a1f..d9f6342` and what it touches. `./bin/mstack gate` PASSED before the review (0
failures, 0 warnings). Evidence is in the session scratchpad `specreview100r3/` (absolute:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/specreview100r3/`).
`mine.mjs` is the check applied from spec.md's words (Terms, R1, R3, R4, R7 to R14, R25). I wrote it
from the spec, not from `words3.mjs`. `judge-theirs.sh` -> `.out` judges 43 of the author's
fixtures (copied). `myshapes.sh` -> `.out` builds 29 shapes of mine, and `trunk2.sh` 3 more. `evil.sh`, `trunk2.sh`,
`wayout.sh`, `wayout2.sh`, `cross.sh` each have an `.out` beside them. Every fixture ran this
checkout's `./bin/mstack` with the fixture as cwd and an empty `HOME`. None ran with this checkout
as cwd or store. Git's answers and the fixtures' real `verify --mutation` runs are rung 4. Every
verdict of the check is rung 3: it is emulated, since no code exists. `cross.out` runs the author's
`words3.mjs` on my 29 final fixtures, and it gives the same verdict on all 29.

## Round 2 findings

- **B1 part 1: closed.** I applied R25 and the Term "HEAD is ahead" from the words. They void
  IREB, IREBB, IREB0, IREBX, IREBC and IREBM on the branch, each by `R25 tests/helpers.test.mjs`
  or `R25 src/extra.js`. For IREBM the excused paths are `src/other.js,tests/other.test.mjs`. The
  same words hold C2B, D2B, SUB-sq, SUB-rb, SHA256-sq (`not ahead`), PREBASE, RE1 and RE1B (`holds
  R12+R13+R25`, main's paths excused). IREBF holds on `main` (`judge-theirs.out`). R25's own edges
  are under point 1 below. They give non-blocking 1 to 3, and none of them blocks.
- **B1 part 2: not closed.** The class is still not the whole list: new B1 below.
- **B2: closed.** R16's fix, its scenario (`not naming .gitignore`), task 1.5's fix text and doc
  sentence, the A1 reading (spec.md:20-23) and "Trade-offs accepted" (design.md:400-404) all say
  what the review asked. The trade-off is honest. Non-blocking 8 offers a narrower option.
- **Non-blocking 2 to 10, spot-checked against the text.** N2: Q is taken from `git rev-list
  --first-parent HEAD ^S` (spec.md:68-71), and the start at S is lost for a base that is not a
  commit (:65-66). ALLDEL and REVITEM hold. N3: Terms read `git diff` and `git diff --cached`
  (:39-43), and STAGED is void by `R8 src/greet.js`. N4: R7 reads `--show-object-format`
  (:183-186), and SHA256-sq holds. N5: `git --literal-pathspecs` (:44-45), and GLOB holds. N6: the
  fork 1 B text says the first rewrite writes `false`. N7, N8, N9 and N10 are also as the hand-off
  says.

## Grill

**Hidden assumptions.** (1) The fork assumes every after-run change that escapes "reaches the
default branch by a route other than the item's own merge". A change made inside the item's own
merge commit escapes too (B1). (2) Terms assume "not ahead" means "the default branch after the
merge". With no default ref, HEAD is always ahead (non-blocking 1). (3) R25 assumes that what the
default branch changed between the two starts is the default branch's alone. A path both sides
changed is excused (non-blocking 3).

**Rejected alternatives.** "The review's clause" was rejected for six measured voids, and that
reason holds. Nothing considers a clause on the merge commit's own content, which closes B1 at no
measured cost.

**Fail paths.** Covered: a detached HEAD (DETIREB void, DETC2B holds), a rewritten default branch
(REWR, REWRS hold), and `origin/main` ahead of a stale local `main` (ORIG holds). Not covered: a
repository with no resolvable default branch (non-blocking 1) and a stacked branch (non-blocking 2).

## Blocking

**B1. Fork 2's class misses a change made inside the item's own merge commit.** The class, in the
fork text (hand-off :26-31, the item's `decision_required`), proposal.md:62-68 and design.md:148-153,
is "a test or code file the item adds or changes after its mutation run ... when that change
reaches the default branch **by a route other than the item's own merge**". design.md:165-173
bounds it to four places. Two shapes hold where acceptance 2 demands void. Each reaches `main` *in*
the item's merge commit, so neither is in the class or in any of the four places:

```
== EVIL: merge commit made with --no-commit; tests/helpers.test.mjs added in the merge commit itself [A demands: void]
  MINE=PASS | ... | killed@78d4690b: holds R10+R11 (M 3a304e99, P src/greet.js,tests/greet.test.mjs)
== EVILA: merge commit, then the item's follow-up src/extra.js amended into it [A demands: void]
  MINE=PASS | held (code src/extra.js,src/greet.js ...) | killed@78d4690b: holds R10+R11 (M f616a9d8, ...)
```

(`myshapes.out`. `cross.out` gives `author R3=PASS` for both.) Neither needs sabotage. You fix a
test that a merge broke and commit it inside the merge (`--no-commit`), or you amend the merge
commit. R1 counts `src/extra.js` as the item's code, yet R10 reads only P and R11 reads only the
merged branch. The fork's reason for its "yes" ("in every member the change was moved ahead of the
item's code or landed apart from the item's merge") is false for both. So is proposal.md:68's
"Git alone cannot tell such a commit". Git can tell: M differs from every one of its parents at
that path.

Smallest change, one of the following:
- **(a) Close it.** R11 also voids "when a path differs between M and every one of M's parents".
  `evil.out` measures the clause on every merge-commit fixture. It voids EVIL, EVILA and V4 (V4 is
  void already by R10). It finds nothing in B, E, OCT, OCT2, GLOB, SUB-mc, INTEG, V5B, MCF, MCF2,
  MCF3, PREOM, PREM, EB, RE3, MM2, MSQ2, PCPM or TRUNK-E. The cost is one scenario and one more
  case in task 1.3's R11 test.
- **(b) State it.** Add a fifth place to the class: "inside the merge commit that brought the run's
  commit in (a merge made with `--no-commit`, or amended after it)". List EVIL and EVILA as members
  whose branch gate never showed them, which makes the count "6 never", and re-word the fork's
  reason.

Either way, also correct three wordings so the user reads a true fork:
- Route 3 becomes "after a merge commit, by a commit on the default branch **or a later merge of
  the item's branch**". MM2 is a second merge commit of the same branch and MSQ2 a second PR
  squashed after a merge commit. Both hold (`myshapes.out`). They sit in design.md's third place,
  but not in the fork's words "committed on the default branch".
- "adds or changes" becomes "adds, changes or deletes". PREDEL, a deletion cherry-picked first and
  then squashed, holds.
- Add "or reordered with `rebase -i` on the default branch itself, for an item worked there". This
  is non-blocking 4.

## Non-blocking

1. **No default branch resolves, so R25 reads on the default branch.** In a repository whose
   default branch is `trunk` (no `main`, no `master`, no `origin/HEAD`), Terms make HEAD always
   "ahead". The parenthetical "(every such path, when the start at HEAD is lost)" then voids the
   ordinary squash and rebase merge once `trunk` has moved, and the rebased branch too:
   `TRUNK-C2F: void R25 src/other.js,tests/other.test.mjs [...] startH null`, and the same for
   TRUNK-D2 and TRUNK-RE1. A2 demands a hold, and round 2's words held them. A way out exists:
   `--base` at the commit before the squash, then a new run on `trunk`, after which the row holds
   by R8 (`wayout2.out`). The gloss at spec.md:59-60 ("not the default branch after it") is false
   in that repository. Smallest change: drop the parenthetical, so that R25 reads only where the
   start at HEAD is computed. `trunk2.out` then holds TRUNK-C2F, TRUNK-D2 and TRUNK-RE1 and still
   voids TRUNK-IREB, giving up only TRUNK-IREB0. Or list the shape in "Voids that should hold".
2. **A stacked branch rebased onto its moved parent branch is voided by R25.** INTREB: the item's
   branch sits on `develop`, not the default branch. `develop` gains other work, and the branch is
   rebased onto it after the run. Result: `void R25 src/other.js [...] excused -`. That is other
   work, round 2's words held it, and it is not in "Voids that should hold". The way out is
   measured: a new run on the branch exits 0 and then `holds R8` (`wayout.out`). Add it to the list
   with that way out.
3. **R25 excuses an after-run change at a path the default branch also changed.** OVERLAP: `main`
   edits line 1 of `src/shared.js`. After the run the item edits its line 5, and `rebase -i` onto
   `main` moves that commit before the code. On the branch the result is `holds R12+R13+R25 [...
   S-Q src/shared.js excused src/shared.js]`, where A1 demands void. After a rebase merge it holds
   (the IREBR route, so inside the class). After a squash it is void by R12. design.md:167-168 says
   a change outside P is "seen ... before Q on the branch (R25)", and the fourth place says "a
   default branch that already had it". Both should say "except at a path the default branch also
   changed between the two starts".
4. **An item worked on the default branch, reordered there.** MAINIREB: no branch. A test after the
   run, then `rebase -i` on `main` moves it before the code. Before the reorder it is `void R8`;
   after it, `holds R12+R13 (not ahead)`. This is design.md's first place ("before Q on the default
   branch"), so it is inside the class, but there is no gate moment that shows it void. Name it in
   the fork's route list (B1's third wording).
5. **Item 42's own `--base` fixes now exit 2 at `verifying`.** `verify --mutation` prints `'mstack
   state set <slug> --base <commit>'` for a base that is not a commit and for a lost start
   (`src/mutation.ts:229`, `:231-236`), and for a foreign merge (`:274`). Those items are held by
   R1, so at `verifying` R26 refuses that line without `--closed-by`. The refusal names the flag,
   so the user gets there in two steps. design.md:345-349 covers the gate's fixes and not these.
   Smallest change: one line in proposal.md "What could break". Alternatively, task 2.3 appends
   ` --closed-by "<why>"` to those fixes when the item is at `verifying`. Not at other statuses,
   where `--closed-by` writes `closed_by` on an open item.
6. **The R26 trade-off is honest, but narrower than the dodge.** design.md:396-399 says "an edit
   made at `reviewing` and then carried to `verifying` by a second command". `verifying ->
   in_progress` is legal without `--force` (`src/lifecycle.ts:91`), and R26's own scenario does
   not refuse `--status in_progress --base HEAD`. So a held item leaves the check in three printed
   commands with no row. Say "an edit by a command that leaves the item outside `verifying`, a step
   back from `verifying` included". It is bounded as stated: printed, and committed in
   `state.json`.
7. **Fork 1, answer B.** "Their first `state set` writes ... `false`" is true, but `state add` and
   `decide --resolves` rewrite `state.json` too (`src/cli.ts:569`, `:617`, `:1165`). Say "first
   rewrite". This is a nit.
8. **Optional for R16.** Refusing an ignored file only where it matches a test *name* pattern
   (`**/*.test.*`, `**/test_*.py`, ..., `src/pathclass.ts:11-21`) would still leave `tests/out.log`
   alone and would catch IGN and GITIG. Either list it as a rejected alternative or leave it.

## The points asked about

1. **R25's words on the edges.** HEAD equal to the default branch (MAINIREB, and IREBF after the
   fast-forward): R25 is silent and the receipt holds, inside the class (non-blocking 4). No default
   branch resolves: non-blocking 1. Detached HEAD: DETIREB is void by R25, DETC2B holds. The default
   branch itself rewritten: REWR (base amended on `main`, branch rebased) and REWRS hold, with the
   change excused. A branch that merged the default branch in after the run: on the branch it is
   void by R8 (`src/other.js`), the FPB cost already listed. Then squashed, it holds. MERGEINT (a
   test, then `rebase -i` onto `main`) is void by R25. A path both sides changed: non-blocking 3.
   `origin/main` ahead of a stale `main` (ORIG): holds. Nothing that must hold is voided without a
   way out. INTREB and the TRUNK shapes are voided, each with a measured way out.
2. **Fork 2.** It is not true as worded (B1). What I tried:
   - A change at a path of P, by the class's routes: PCP (cherry-picked to `main`, then a squash) is
     void, no Q. PCPM (then a merge commit) is void by R10. PIREB (folded into the code commit by
     `fixup`, then a fast-forward) is void by R12, no Q. PCPR (a rebase merge) could not be built,
     because the cherry-pick conflicts.
   - A change that travels with the item's own merge: EVIL and EVILA hold (B1). MM2 and MSQ2 hold
     (B1's route 3 wording). SQ2 (a second squash after a squash) is void by R13.
   - A deletion: PREDEL holds by route 1, so it is in the class, with the wording fix. DELSQ is
     void by R12.
   - A rename: under `--no-renames` it is a deletion plus an addition. Not built separately.
   - OVERLAP: non-blocking 3.

   Fork 1 is true and answerable (non-blocking 7 is a nit). Fork 2 becomes answerable once B1's
   wording, or clause (a), is in.
3. **R26, R27, R28.** Each carries one obligation and each is testable through the CLI.
   - The cited lines are right: `closedByBefore` at `src/cli.ts:687`, clears at `:694`,
     `closingProblems` at `:759`, the `spec-size` skip at `:846`, `assertNotSddSmall` at `:988`,
     the row at `:997-1006`.
   - Values (`--size`, `--base`, `--verification`) apply after the status move, so `--status done
     --size s` is judged on the old size today, and R28 is needed only for clears. The R28 copy also
     changes the verification check for `--status done --clear verification`, and proposal.md:129
     says so.
   - `patch-nb1.mjs` matches R26 and R28 as worded, and the author's `probe.out` has `1095 pass`, `2 skip`,
     `1 fail` (the walkthrough), with `PROBE-R26` at 0. I read it and did not re-run it (352 s).
   - The walkthrough edits no `--size`, `--base` or `--verification` at `verifying`
     (`tests/walkthrough.test.ts:119-179`). `decisions.add` validates no phase, so `mutation-scope`
     is accepted.
   - Fix lines: see the closing summary. The trade-off is non-blocking 6.
4. **R16 and the ignored-test trade-off.** Covered under B2 above, plus non-blocking 8.
5. **Non-blocking 2 to 10 of round 2.** Covered above.
6. **Size and executability.** 28 requirements against a limit of 30. R3, R4, R5, R7, R8, R12, R16
   and R25 to R28 each carry one obligation. R12 keeps the two clauses round 2 confirmed.
   - Every R is named by a task: R25 by task 1.3 and R26 to R28 by task 2.3, and 3.1 names R1 to
     R28.
   - The stated counts match the test lists: 1.2 has 12, 1.3 has 14, 2.3 has 4.
   - Every test file named exists.
   - Task 2.3 can be built from `tasks.md` alone. Its lines, names (`found`, `heldByR1`,
     `forcedSpecSize`), fix text and row fields are all given, and `heldByR1` comes from task 1.2's
     file.
   - Tasks 3.3 and 3.4 still hold. Step 7 changes no field R26 watches, and the close after the
     merge leaves the item at `done`, so R26 does not apply. On `main` after the merge, R25 is
     silent.
   - Under either answer of fork 1 every new test writes the key `true`, and task 2.3's tests run
     through `closeRepo()`.

**Fix lines.** Each fix line the spec prints works as printed:
- R3's `state set <slug> --base <commit> --closed-by "<why>"`: R1 holds the item, so R26 asks for
  the reason, R27 writes the row and `closed_by` stays as it was. The "no code of its own" scenario
  ends unheld.
- R6's `verify --mutation`, the forced close and `git worktree add --detach`.
- R5 and R14's `git update-index --no-...`, R16's "commit ... or move it out", R20's hint, R24's
  lock line, and R26's `add --closed-by "<why>"`.

The exception is a shipped line, not one the spec prints: item 42's `--base` fixes at `verifying`
(non-blocking 5).

**Advice on a cut.** None is needed, and the spec can be built in order as written. If the user
wants a smaller item, the clean seam is R26 to R28 with task 2.3 and R3's ` --closed-by` (25
requirements, and non-blocking 5 and 6 go with it). That fails no acceptance criterion: A3 is then
met in its letter, by R17 to R20 and the stated ways out. But the coordinator weighed and refused
exactly this (decisions.tsv, 2026-11-19T20:04:24Z: "Leaving non-blocking 1 as a listed trade-off
lost because three one-command edits walk an item past the check with no marker, which meets
acceptance 3 only in the letter"). So it is the user's call, not a finding.

## Evidence ladder, and what was not done

Rung 4: git's answers on every shape; the real `verify --mutation` runs in MAINIREB, TRUNK,
OVERLAP, OVERLAP0, and the re-runs in INTREB and TRUNK-C2 (`wayout*.out`); item 42 refusing a run in
TRUNK-RE1 (start lost). Rung 3: every verdict of the check, in `mine.mjs`, which agrees with the
author's `words3.mjs` on all 29 of my final fixtures (`cross.out`). It also gives the hand-off's
verdict on each of the 43 author fixtures I judged.

Not done:
- Linux.
- The node runtime for the fixtures.
- PCPR (the cherry-pick conflicts).
- A rename shape.
- Re-running the 352 s suite probe.
- A typecheck of any stand-in. No registry fetch was made.

The lock test on this checkout's git directory: `no lock` before every fixture run and at the end.
