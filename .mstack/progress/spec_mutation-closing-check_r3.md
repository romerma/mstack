# Spec hand-off, round 3: item 100 mutation-closing-check

Written: `.mstack/specs/mutation-closing-check/{proposal,design,spec,tasks}.md`, revised to answer
`.mstack/progress/spec_review_mutation-closing-check_r2.md` (CHANGES_REQUESTED, 2 blocking, 10
non-blocking) as the coordinator's `spec` row of 2026-11-19T20:04:24Z says, and four rows in
`.mstack/decisions.tsv` (phase `spec`). **28 requirements** (size l, limit 30): R1 to R24 as
round 2 left them, with R3, R4, R5, R7, R8, R12, R16 changed, and R25 to R28 new. Item status, size
and fields not changed; no `src/`, `tests/` or docs touched. Every measurement ran under the
session scratchpad `spec100r3/` (absolute:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/spec100r3/`),
in fixture repositories or an archive copy of `a2b5f8d`, with this checkout's `./bin/mstack`, the
fixture as `cwd` and an empty `HOME`; none with this checkout as `cwd` or store. The checkout's
git dir has no `mstack-mutation.lock` (checked before the decision rows and before the commit).

## Forks for the user

**Fork 1: when a store's `state.json` has no `require_mutation_to_close` key (every store made
before this item), is the new closing check on or off?** A, on, like the other four rules: an
upgraded store with an item at `verifying` that has code turns red at once, until `mstack verify
--mutation` kills or a forced close records why. B, off: upgraded stores see nothing, and their
first `state set` writes `"require_mutation_to_close": false` into `state.json`, so the check stays
off there until someone changes it to `true`; new stores get it on under either answer.
**Recommendation: A**, because a check that an upgrade writes off without saying so is one that
nobody turns on.

**Fork 2: does acceptance 2 stand with one known gap?** The check does not see a test or code file
the item adds or changes after its mutation run, at a file the run had not touched, when that
change reaches the default branch by a route other than the item's own merge: a test cherry-picked
or merged as its own PR before the item, moved ahead of the item's code with `rebase -i` and then
rebase-merged or fast-forwarded, reordered by hand in a rebase merge, or committed on the default
branch after a merge commit (12 shapes measured: in 7 the branch's own gate showed the receipt
void before the merge, in 1 only until the branch was rebased, in 4 never). **Yes** keeps the spec
as it is; **no** means acceptance 2 cannot be met from git alone and needs a new item that ties
every commit to its item when it is made (a commit trailer or a hook), which still misses a commit
made without the tie, because recording the item's commits at the run would catch only the four
`rebase -i` shapes. **Recommendation: yes**: in every member the change was moved ahead of the
item's code or landed apart from the item's merge, the branch's gate already flags 7 of the 12, and
closing the rest costs a commit convention for every change in the repository.

For the coordinator: the item's `decision_required` still words fork 2 as the round 2 exception
(one shape, CPR); it needs the class wording above before the user reads it.

## Findings, one row each

| Finding | What was done, and where |
|---|---|
| B1, part 1 | The clause, run as the review words it, voids IREB and also six shapes that must hold (C2B, D2B, SUB-sq, SUB-rb, SHA256-sq: a squash or rebase merge of an item whose base is a commit of `main`, as `mstack worktree new` gives, after `main` moved; PREBASE: a branch rebased after the run with code from before its base). So it is a new requirement, R25 (spec.md, after R13), with "HEAD is ahead of the default branch" in Terms: on the branch only, a path that differs between S and Q but not between the start at S and the start at HEAD voids. It voids IREB, IREBB, IREB0, IREBX, IREBC, IREBM and holds RE1, RE1B, PREBASE, C2B and the rest; the cost is IREBF on `main` (void on the branch). R12 keeps its two clauses. Every fixture of the four earlier passes was rebuilt (`shapes.sh`, 108 shapes) and judged by `words3.mjs`, written fresh from spec.md as left; design.md Fact 4's table is replaced by that run, with an A2 column. Decision row. |
| B1, part 2 | Stated as one class in proposal.md "Acceptance 2, and its exception", design.md "What the rule misses" (with a members table: how each reached `main`, and whether the branch's gate showed it void) and fork 2 above. 27 new shapes; the class has 12 measured members: CPR, PRE, PRER, IREBR, IREBXR, IREBCR, IREBF, PRERB, PREO, PREOM, MCF, MCF3. Bound argued from the words (rung 3): four routes, no miss found outside them. MCF stated: after a merge commit, the item's own follow-up on `main` at a new path holds. Five voids that should hold that round 2's design did not list added: FPB, INTEG, SQDEV, PREBASES, QAMB2 (beside C3, L, GC). Decision row. |
| B2 | R16's fix: "commit each one, or move it out of the store's root"; its scenario asserts that text and no `.gitignore`; task 1.5's fix text, test name and doc sentence follow. spec.md's A1 reading and design.md "Trade-offs accepted" say an ignored in-scope test file can still earn a kill, because R16 leaves ignored files alone so that `tests/out.log` (a `test` path, `src/pathclass.ts:11`) does not refuse. proposal.md "What could break" updated. |
| N1 | Taken, in the code's form (`src/cli.ts:687`, `:694`, `:759`, `:846`, `:988`, `:997-1006`): R26 (an edit of `size`, `base` or `verification`, value or `--clear`, of an item R1 holds, left at `verifying`, exits 2 without `--closed-by`), R27 (with it: one `mutation-scope` row after the save, `closed_by` not written, as for `spec-size`), R28 (`done` runs the closing checks on the item as the command found it, before its clears); task 2.3. Narrowed to items R1 holds, because applied to every item at `verifying` it would refuse fixes the gate itself prints there (`--size m`, `--base` for a size `s` item, `src/gate.ts:297-333`; `--verification` from `gate --full`, `:800-810`). A stand-in for R26 and R28 in an archive copy changes no shipped test: `1095 pass`, `2 skip`, `1 fail`, the walkthrough as before (`probe.out`). R3's fix and scenario now pass `--closed-by`. Decision row. |
| N2 | Terms: Q is the oldest first-parent commit not in S's history (`git rev-list --first-parent HEAD ^S`); the start at S is lost when the base is not a commit. design.md "Shape" searches the same range; it found the full walk's Q on every row (no `DIFFER`). ALLDEL and REVITEM now hold; R12's keep scenario names ALLDEL; task 1.3 adds its test. |
| N3 | One rule, the index too: "differs from the working tree" is `git diff C --` or `git diff --cached C --` (Terms). STAGED now voids by R8 (round 2 words: pass); R8's void scenario names it; task 1.2's R8 test adds it. Decision row. |
| N4 | R7 reads the length from `git rev-parse --show-object-format` (40 or 64); scenario and task 1.2's R7 test add a SHA-256 repository. SHA256 and SHA256-sq now hold (round 2 words: held). |
| N5 | Terms: every git command given a path runs as `git --literal-pathspecs`; design.md "Shape" says so. GLOB: `git diff --name-only S -- 'src/[id].js'` lists `src/i.js`, with the flag nothing; the row holds. Task 1.3's R10 test adds it. |
| N6 | Fork 1's B text above, proposal.md "What could break": the first rewrite writes the key `false` (R22). |
| N7 | tasks.md preamble: "only the two R21 tests (tasks 1.1 and 1.2)". |
| N8 | Task 1.2's page sentence and proposal.md: "saw `test_shout` error" (a `TypeError`). |
| N9 | R4 is the choice of row only; the survived message moved to R5 (first in its precedence), with its scenario; task 1.2's test is `R4 R5 ...`. |
| N10 | GC is in design.md's table and "Voids that should hold" (R7), with the same way out. |

No finding was left unapplied, so no "not applied" row was recorded.

## The rule as measured

From `shapes.out` (R3 is this spec's words, R2 the round 2 words, REVIEW-CLAUSE this spec with R25
replaced by the review's clause):

```
== C2B: base on main, main moved, squash [A2 demands: pass]
  R3=PASS | REVIEW-CLAUSE=HELD: no holding row | ahead=false | ... holds R12+R25+R13 ... | R2=PASS
== IREBF: after-run test moved before the code by rebase -i, then main fast-forwarded [A2 demands: void (class)]
  on the branch:
  R3=HELD: no holding row | ahead=true | ... void R25 tests/helpers.test.mjs ... | R2=PASS
  R3=PASS | REVIEW-CLAUSE=HELD: no holding row | ahead=false | ... holds R12+R25+R13 ... | R2=PASS
== PREO: a test written for the item after the run, merged to main as its own PR, then the item squashed [A2 demands: void (class) if the test is the item's]
  on the branch:
  R3=PASS | ahead=true | ... holds R8 | R2=PASS
  R3=PASS | ahead=false | held: R3 start at HEAD lost | ... holds R12+R25+R13 ... | R2=PASS
== STAGED: an edit staged, the working tree file put back to S [A2 demands: void]
  R3=HELD: no holding row | ahead=true | ... void R8 src/greet.js | R2=PASS
```

Holds where acceptance 2 demands void (at the close; the branch's own gate before the merge):

- CPR, an after-run test reordered ahead of the code by hand in a rebase merge: branch void (R8).
- PRE, the test cherry-picked from the branch to `main`, then squash: branch void (R8).
- PRER, the same, then a rebase merge: branch void (R8).
- IREBR, the test moved ahead with `rebase -i`, then a rebase merge: branch void (R25).
- IREBXR, the test folded by `fixup` into an earlier commit, then a rebase merge: branch void (R25).
- IREBCR, an after-run `src/extra.js` moved ahead, then a rebase merge: branch void (R25).
- IREBF, the test moved ahead, then `main` fast-forwarded: branch void (R25).
- PRERB, the test cherry-picked to `main`, the branch rebased onto `main`, fast-forward: branch void
  until the rebase, holds after it.
- PREO, a test for the item merged as its own PR first, then squash: branch holds (never had it).
- PREOM, the same, then a merge commit: branch holds.
- MCF, the item's `src/extra.js` committed on `main` after a merge commit: no branch moment.
- MCF3, the same with a test: no branch moment.
- IGN, GITIG (an ignored scratch test earned the kill): hold on the branch, the B2 trade-off.

Voided where acceptance 2 demands a hold: L, FPB (R8), C3, QAMB2 (R13), INTEG (R11), SQDEV,
PREBASES (R12), GC (R7), WTRM (no row: the worktree was removed). PREBASES has a measured way
out (`extra.out`: `--base` at the commit `main` had when the branch was cut, then the row holds).

## Evidence ladder

Git's answers on every shape, the fixtures' real `verify --mutation` runs (a SHA-256 repository
writes a 64-digit `sha`), and the suite run with the R26/R28 stand-in: rung 4, run here. Every
verdict of the closing check: rung 3, emulated from spec.md's words in `words3.mjs` (imports
`measureStart`, `resolveCommit`, `scopeClass`, `obligations`, `readRecords`, `defaultBranch` from
this checkout; no code of the check exists). The bound of the class, and that recording commits
at the run would not close it: rung 3, argued from the words. UNTR's refusal: R16 read, not run.
R27's row: not in the stand-in. Not done: Linux, node for the fixtures, the real check. `bun run
typecheck` in the archive copy fails for a missing `@types/node` (no `node_modules` there; bunx
fetched `tsc` from the registry), so the stand-in was type-checked by nobody; `bun test` needs no
type check.

## Where the rest is

`spec100r3/`: `shapes.sh` + `shapes.out` (every shape, three verdicts) + `summary.mjs` →
`summary.out` (one line per shape, the mismatches, the review clause's differences), `words3.mjs`
(this spec's words), `words-r2.mjs` (the round 2 review's `words.mjs`, copied), `fmt.mjs`,
`todo.mjs` (the `rebase -i` editor), `extra.sh` + `extra.out` (PREBASES's way out), `probe.sh` +
`probe.out` + `patch-nb1.mjs` + `patch-author.mjs` (copied) + `probe/A.fail`, `decide.sh` (the
four rows), `files/` (copied), the fixtures under `fx/` and `wt/`.

## Gate, before the commit

```
[ok]    one active item: mutation-closing-check (specifying)
[ok]    7 open item(s) with a decision fork, each answered or still in specifying
[ok]    no sdd item is past specifying
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[warn]  6 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 1 warning
```

The six are the four spec files, this file and `decisions.tsv`; the commit takes them.
