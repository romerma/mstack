# Spec hand-off, round 2: item 100 mutation-closing-check

Written: `.mstack/specs/mutation-closing-check/{proposal,design,spec,tasks}.md`, revised to answer
`.mstack/progress/spec_review_mutation-closing-check.md` (CHANGES_REQUESTED, 5 blocking, 13
non-blocking) as the coordinator's row of 2026-11-19T18:55:36Z says, and seven rows in
`.mstack/decisions.tsv` (phase `spec`). **24 requirements** (size l, limit 30). Item status, size
and fields not changed; no `src/`, `tests/` or docs touched. Every measurement ran under the
session scratchpad `spec100r2/` (absolute:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/spec100r2/`),
in fixture repositories or archive copies of `7d2d42b`, with this checkout's `./bin/mstack` and
the fixture as `cwd` and an empty `HOME`; none with this checkout as `cwd` or store. The
checkout's git dir has no `mstack-mutation.lock`.

## Forks for the user

**Fork 1 (open since round 1): how is a `state.json` whose `rules` has no
`require_mutation_to_close` read?** A: as `true`, like the other four rules; an upgraded store's
items at `verifying` with code turn red at once, until `verify --mutation` kills or a forced close
records why (after a squash or rebase merge a run is possible again once `--base` names the
commit before the merge). B: as `false`, with `setup` writing `true` for new stores; upgraded
stores see nothing until they add the key, and it is the first rule whose absence means off.
Depends on it: R21, the parse in task 1.1, and the two R21 tests (tasks 1.1 and 1.2), each written
with both branches; nothing else. **Recommendation: A.**

**Fork 2 (new): does acceptance 2 stand with one exception?** Acceptance 2 says a receipt is void
when a code or test path of the item changed after the run; the rule does that on every shape
measured except a rebase merge whose commits were reordered by hand so that a commit made after
the run lands before the item's code, because git cannot tell that commit from the default
branch's own earlier work and nothing records which commits were the item's. **Yes** keeps the
spec as written (the same rule also refuses a good receipt when other work lands between a
squash, rebase merge or fast-forward and the close, which costs a forced close or an earlier
close); **no** means acceptance 2 cannot be met from git alone, and needs a new item that records
the item's commits at the run, or your own narrower wording. **Recommendation: yes**: the shape
needs a hand-made reorder (a forge's rebase merge keeps the order), and the branch's own gate shows
the receipt void before the merge (R8).

For the coordinator: the item's `decision_required` text names R10; the requirement is now R21.
Fork 2 is not yet on the item.

## Findings, one row each

| Finding | What was done, and where |
|---|---|
| B1 | Rule Qab, as R7 to R14 (spec.md) with Q, P and "differs" in Terms. Checked against the review's wording before adopting it: R5's `lstat` test in front of Qab's clauses adds nothing for a tracked file given clause (a), and voids DELU (an untracked file where the item deleted one) while R8 holds the same tree on the branch, so "differs from the working tree" is `git diff` against the commit everywhere, and R14 catches what `git diff` cannot see. No clause can go (design.md Fact 4). Re-run every shape: the author's 19, the review's 24, four new, the three linked-worktree shapes (`shapes.sh`, `w2.sh`); the table with each column's rung is design.md Fact 4. "Trade-offs accepted" replaced: misses CPR; RV1 and OCT are correct holds; voids C3 and L. proposal.md "Acceptance 2, and its one exception" says it waits for the user (fork 2). |
| B2 | tasks.md preamble: every new test writes `require_mutation_to_close: true` (`closeRepo()`), only R21's tests write `rules` without it; `state()` writes it `false` (task 1.1). Found the tests that change by running the suite in archive copies with a stand-in check (design.md Fact 5, `probe/`): base 0 fail, A 3, B 1. Named: `tests/r-table-check.test.ts:387-395` and `:397-414` (under A, what they would assert; with `state()` writing `false`, unchanged: `helper.sh` 40 pass, 0 fail) and the walkthrough (both answers). Tasks 1.1 and 1.2 give both branches keyed to the `decide --resolves` row. |
| B3 | proposal.md "A new user's first close": the reviewer runs `verify --mutation` at `reviewing` after `gate --full` (measured: killed in 1 s, `walk.out`); task 1.2 changes `tests/walkthrough.test.ts` (one more step, one more mutant, the `gateFull` mutant also leaves out the run, whose baseline would record its receipt) and `Getting-Started.md`. R16 (round 1 R8) kept: a closing-time void cannot see a test untracked at the run and deleted after (design.md, rejected alternatives); task 1.5 moves `tests/mutation-run.test.ts:113` and `tests/mutation-changed.test.ts:90-100` to an untracked code file (the key still covers it) and amends item 42's spec at `:131-134` and `:548-552`; proposal.md "What could break" says so. |
| B4 | Task 3.3: steps 1 to 6 at `reviewing`, as item 42's own run was; step 7 moves to `verifying`; each "Done when" is read at the status it names. |
| B5 | R3 split into R4 (which row), R5 (what the problem says), R6 (the fix); R10 into R21, R22, R23; also R1 into R1 (who) and R2 (where), R9 into R17 to R20, and the void requirements no longer also say what the problem names (R5 does). |
| N1 | R3's fix names the commit before the merge, never HEAD. `--base` after the code and `--clear verification` are listed in design.md "Trade-offs accepted" with the reason; refusing `--base` at `verifying` and holding items with no obligation are rejected alternatives. Decision row. |
| N2 | R19: the marker stays; `--clear closed-by` on a marked note exits 2, for today's markers too. Decision row. |
| N3 | Terms, "the stores read": `--porcelain -z`, records with `prunable` left out; `w2.sh`. |
| N4 | Task 1.4 rewrites `docs/wiki/Gates-and-Hooks.md:703-707`. |
| N5 | R7: a 40-hex sha naming a commit, decided before any other git call; shape SHA. |
| N6 | R14: a flagged code or test file voids every row; shapes FLAG, W3. |
| N7 | Terms: every diff has `--relative`; design.md "Shape". |
| N8 | Task 3.3 step 1 restores item 42's sentence. |
| N9 | R16's fix: commit each one, or add it to `.gitignore`. |
| N10 | R20 pins the hint. |
| N11 | R24: this checkout's lock (Terms). A run in a linked worktree does not refuse a close in the main checkout, and why that is safe is design.md's last trade-off; task 2.2 tests and documents it. Decision row. |
| N12 | proposal.md cites tasks 3.3 and 3.4. |
| N13 | Fork 1's cost for A now says a run is possible after a squash or rebase merge once `--base` names the commit before it. |

No finding was left unapplied, so no "not applied" row was recorded.

## The rule as measured

From `shapes.out` (one line per shape: round 1's words, Qab, this spec, and the requirement that
voided the row):

```
== V5C: test after the run, main moved, squash
  SPEC1=PASSES | Qab=HELD (no holding row) | MINE=HELD | ... void R12 Q ...: tests/helpers.test.mjs
== CPR: rebase merge with the after-run test commit reordered before the code commit
  SPEC1=PASSES | Qab=PASSES | MINE=PASSES | ... holds R12+R13 Q ...
== C3: squash, then another item's code on main before the close
  SPEC1=PASSES | Qab=HELD (no holding row) | MINE=HELD | ... void R13 Q ...: src/other.js
== DELU: the item also deletes src/other.js; squash; then an untracked src/other.js
  SPEC1=PASSES | Qab=HELD (no holding row) | MINE=PASSES | ...
== FLAG: assume-unchanged on src/greet.js after the run, then an uncommitted edit, on the branch
  SPEC1=PASSES | Qab=PASSES | MINE=HELD | ... void R14 flagged: src/greet.js
```

- **Misses** (void expected, holds): CPR only.
- **Voids that should hold**: C3 (other work after a squash or rebase merge, R13) and L (the same
  after a fast-forward, R8).
- **Correct holds** the review asked about: RV1 (same content after a revert and reapply) and OCT
  (an octopus with another branch; OCT2 voids).
- Elsewhere this spec gives Qab's answer, except W2 and W3 (findings 3 and 6) and DELU.

## Evidence ladder

Git's answers on every shape, the walkthrough's run, the stand-in suite runs and the prunable
listing: rung 4, run here. The rule's verdicts: rung 3, emulated from spec.md's words in
`rule.mjs` (imports `measureStart`, `resolveCommit`, `scopeClass`, `obligations`, `readRecords`
from this checkout; no code of the check exists). Which tests change: rung 4 for what the stand-in
covers, rung 3 (read) for R16, R19 and R24. Fact 1: rung 3, unchanged and confirmed byte-identical
by the review. Not done: Linux, node for the fixtures, the real check.

## Where the rest is

`spec100r2/`: `shapes.sh` + `shapes.out`, `rule.mjs`, `rv.mjs` (the review's, copied),
`w2.sh` + `w2.out`, `bases0.sh` + `bases0.out`, `qcheck.mjs` + `qcheck.out` (the fast search for
Q in design.md "Shape" equals the full walk on 23 shapes), `walk.sh` + `walk.out`, `probe/run.sh`
+ `run.out` + `patch.mjs` + `{base,A,B}.fail` + `helper.sh` + `helper.out`, `decide.sh` (the
seven rows), `files/`, the fixtures under `fx/` and `wt/`.

## Gate, before the commit

```
[ok]    one active item: mutation-closing-check (specifying)
[ok]    7 open item(s) with a decision fork, each answered or still in specifying
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[warn]  6 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 1 warning
```

The six are the four spec files, this file and `decisions.tsv`; the commit takes them.
