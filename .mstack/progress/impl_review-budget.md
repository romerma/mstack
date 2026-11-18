# Implementation report: review-budget (item 43)

Rung reached: test-verified. The suite is green under bun and node, and the five criteria were
also run by hand in scratch repositories (below). Nothing was run against a live Claude session.

## What changed

`decisions.tsv` has a trailing `item` column. `mstack decide` fills it with the active item's
slug, `--item <slug|id>` overrides it (a ref that is not an item is refused before anything is
written) and it is empty with no active item. **Old files:** the header line is widened in place
by the first write, through the existing `ensureHeader` that added `resolves`; old rows are not
touched and read with an empty item (a missing cell is `""`). Checked on a copy of this
repository's own file at `362536f` (232 rows, tabs and quotes in real text): header
`...,resolves` became `...,resolves,item`, 233 rows, the 232 old rows byte-identical under the
header (`realcopy.sh`, output below).

`fanout plan --kind review --solo [--justify T]` (`planSolo`, `src/fanout.ts`) allocates
`review_<slug>.md` for round 1 and `review_<slug>_r<N>.md` after, N one more than the highest
**lone** round on disk (lensed reports do not count). From round 3 it refuses without
`--justify` (exit 2, "round 3 of a lone review of <slug> needs a reason") and with it writes the
row itself: phase `review-r<N>`, the text as the decision, item set; a second ask for the same
round writes no second row. It prints the path, then on its own lines `last reviewed commit,
still an ancestor of HEAD:` and the sha (or `none: no reviewer row for <slug> in the ledger is
an ancestor of HEAD`). "Reviewer" is any ledger verifier `canCloseAnItem` accepts, newest row in
file order whose sha passes `git merge-base --is-ancestor`. **Flags together:** `--solo` takes no
`--worker` and no `--round`, only `--kind review`, only `plan`; `--justify` needs `--solo`;
below round 3 `--justify` is accepted and writes no row.

**The gate:** one closing check, `review-budget` (`src/budget.ts`, wired in `src/closing.ts`),
for an item with a `base` only. (a) every review report of round >= 3, lone or lensed, needs a
`review-r<N>` row whose item is the slug; (b) no `spec_`, `spec_review_`, `impl_` or `review_`
report of the item is over `MAX_REPORT_BYTES = 24576`. **Gate and closing both:** it is reported
at every active status (a report grows before review) and run at `state set --status done`, so a
close cannot leave a store the gate calls red. Not overridable by `--force`.

**Spec size:** `state set --status spec_ready` from `specifying` on an sdd item is refused when
`spec.md` declares more distinct R-ids than 12 (m or no size) or 30 (l), counted by the new
`specRequirementIds` in `src/rcheck.ts`, which the table check now reads through too. The
refusal names count, limit and both ways out. **Forcing needs `--force` and `--closed-by`**
(`--force` alone is refused naming `--closed-by`); it then writes a `spec-size` row (reason as
the decision, item set). The text also lands in the item's `closed_by`, as any `--closed-by`
does; that is a side effect I did not remove.

**Remainder rule:** `roundOf` unchanged; `agents/reviewer.md` and the `ROUND_LIKE` comment in
`src/fanout.ts` now say a leading `r<digits>` is a round marker only when nothing or a dash
follows (`_r2x` is lens `r2x`, round 1); `fanout plan` still refuses every `r<digit>` worker.
**Prose:** `agents/implementer.md` (107 lines) and `skills/implement/SKILL.md`: a later round
writes `impl_<slug>_r<N>.md` with what changed since the last round and the whole table.

Known limit, pre-existing: `mstack gate --full` does not run the closing checks (the table check
has the same gap), so neither does it report the budget. The default gate does.

## Files

src: `src/budget.ts` (new), `src/decisions.ts`, `src/cliopts.ts`, `src/cli.ts`, `src/fanout.ts`,
`src/closing.ts`, `src/rcheck.ts`, `src/size.ts`. Prose: `agents/implementer.md`,
`agents/reviewer.md`, `skills/implement/SKILL.md`. Docs: `docs/wiki/The-CLI.md`,
`docs/wiki/Gates-and-Hooks.md`, `docs/wiki/The-Agents.md`, `CHANGELOG.md`. Tests (all new files):
`tests/budget-helpers.ts`, `tests/decide-item-column.test.ts`, `tests/review-solo.test.ts`,
`tests/review-budget-gate.test.ts`, `tests/spec-size.test.ts`, `tests/round-remainder.test.ts`.
Store: five `implement` decision rows in `.mstack/decisions.tsv`, the first written with the
column.

## Commands

Red first (before each code commit, `bun test <file>`): decide column 5 fail of 5
(`all(...).item` undefined, header still 7 columns); solo 11 fail of 11 (`Unknown option
'--solo'`); gate 9 fail of 11 (the 2 passes are "only an item with a base" and "another item's
report"); spec size 3 fail of 7 (13 requirements exited 0, `--force` alone exited 0); prose
pins fail with the prose stashed: `agents/reviewer.md states the rule roundOf applies` and
`the implementer prose says a later round writes impl_<slug>_r<N>.md` (9 pass, 2 fail). The
`roundOf` cases pass at once, as intended: the function did not change, the cases pin it.
The `src/fanout.ts` comment test cannot be shown red separately: the comment was rewritten in
the `--solo` commit, before the test existed; the base file has no "only when nothing or a dash
follows" text (`git show 362536f:src/fanout.ts`, only line 90 mentions `r2x`).

Mutants, each applied alone, then `bun test` on the owning files, then reverted
(`mutants.py`): 32 applied, 32 killed, 0 survived.

| Mutant | Killed by (test title, abbreviated) |
|---|---|
| decide item = always empty | decide writes the active item's slug |
| `--item` not validated | `--item` overrides ..., refused with nothing written |
| justify from round 4 / from round 2 | round 3 report with no row fails the gate / lensed round 3 needs the row |
| round = highest (no +1); lensed counted | the next round is one more than the highest lone round |
| row written twice (no `have` check) | asking again ... does not write a second row |
| no ancestor check; implementer rows count | the last reviewed commit is the latest reviewer row ... ancestor |
| `--solo` takes `--worker` / `--round` | `--solo` cannot be combined with ... |
| limit 24577 / 24575 / `<` for `<=` | exactly 24576 bytes passes and one byte more fails |
| only impl reports sized | every kind of report is held to it |
| round `<=` bound (round 3 exempt) | round 3 report with no decision row fails the gate |
| row item / row phase not matched | a row of another round, or another item, does not cover |
| no base requirement | only an item with a base is checked |
| not reported at in_progress | held at every active status |
| budget overridable; not a closing check | closing is refused over a big report, `--force` does not vouch; round 3 gate test |
| m limit 13 / 11, l limit 31 / 29, count `<` | 12 pass, 13 refused, l allows 30 and refuses 31 |
| no size reads as l | 13 refused for m and for no size |
| `--force` without `--closed-by`; no row | `--force` alone is refused ...; records a spec-size row |
| ids not deduplicated | the same requirement id twice counts once |
| `--size` in the same command ignored | `--size l` given in the same command |

Real session in a scratch repository, item with a base (`session.sh`; the path is shortened to
`/tmp/demo`). Rounds, without and with `--justify`:

```
$ mstack fanout plan --kind review --solo
review round 2 of greet, one lone reviewer; the report goes to:
/tmp/demo/solo/.mstack/progress/review_greet_r2.md
last reviewed commit, still an ancestor of HEAD:
beb01d1a139af19dc4918630327944f80ce25e56
$ mstack fanout plan --kind review --solo
mstack: round 3 of a lone review of greet needs a reason
        rounds from 3 on are written down; pass --justify "<why another round is worth it>" ...
(exit 2)
$ mstack fanout plan --kind review --solo --justify "round 2 left the empty-flag case open; ..."
review round 3 of greet, one lone reviewer; the report goes to:
/tmp/demo/solo/.mstack/progress/review_greet_r3.md
recorded the review-r3 decision row for greet
2026-11-18T14:20:18.756Z|review-r3|round 2 left the empty-flag case open; ...|...|.mstack/progress/review_greet_r3.md|round 3 allowed||greet
```

Separate gate runs, one failure each (`mstack gate`, exit 1):

```
[fail]  1 greet (reviewing) cannot close as it stands, and its review report .mstack/progress/review_greet_r3.md is round 3 and has no decision row (phase review-r3, item greet)
[fail]  1 greet (in_progress) cannot close as it stands, and its report .mstack/progress/impl_greet.md is 25009 bytes, over the 24576 byte limit
```

A spec with 13 requirements, refused, `--force` alone refused, then forced:

```
$ mstack state set greet --status spec_ready
mstack: .mstack/specs/greet/spec.md declares 13 requirements, and a size m item may have 12
$ mstack state set greet --status spec_ready --force
mstack: --force would move greet to spec_ready past the 12 requirement limit, and that has to be on the record
$ mstack state set greet --status spec_ready --force --closed-by "the 13 parts ship as one release ..."
  forced: greet has 13 requirements, over the 12 a size m item may have; ...
  status: "specifying" -> "spec_ready"
2026-11-18T14:20:19.889Z|spec-size|the 13 parts ship as one release and cannot be split|...|.mstack/specs/greet/spec.md|forced past the limit||greet
```

This repository's own file, old to new (`realcopy.sh`):

```
rows before: 232; header: ts,phase,decision,why,evidence,result,resolves
header after: ts,phase,decision,why,evidence,result,resolves,item
rows after: 233
identical
```

Final verification (code unchanged since the mutant run; only this report and docs changed after):

```
$ npm run typecheck                    -> exit 0, no diagnostics
$ ./bin/mstack lint-plugin .           -> PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 103 relative links checked, 0 broken
$ ./bin/mstack gate                    -> PASSED - 0 failures (the one warning is the uncommitted tree)
$ npm run test:bun   (HOME empty, GIT_CONFIG_GLOBAL=/dev/null) -> 842 pass, 0 fail, 36 files
$ npm run test:node  (same)            -> tests 842, pass 842, fail 0
```

842 each, up from 797: 45 new tests (5 + 11 + 11 + 7 + 11 in the five new test files).

My own gate check against this store: this repository's item stays `in_progress`, so the table
check is not due and I set no field on it. I ran the same check on a copy of this repository's
`.mstack/` and `tests/` in a scratch git repository with the copy's item 43 moved to
`reviewing` (`owngate.sh`): `[ok] review-budget is reviewing ...`, `PASSED - 0 failures, 0
warnings`, so this report's table (rows A1 to A5), its size and the review budget pass the
reading the closing checks will give them.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | the item column (active, none, `--item`, old 7-column file copied from this repository's own, 6-cell file); `--solo` path, `--justify` row, ancestor sha | tests/decide-item-column.test.ts:29, tests/decide-item-column.test.ts:74, tests/review-solo.test.ts:55, tests/review-solo.test.ts:66, tests/review-solo.test.ts:98 |
| A2 | the gate fails a round 3 report with no row and passes with it; 24576 passes and 24577 fails, naming file and size; the closing door refuses too | tests/review-budget-gate.test.ts:25, tests/review-budget-gate.test.ts:34, tests/review-budget-gate.test.ts:87, tests/review-budget-gate.test.ts:117 |
| A3 | prose pin: a later round writes `impl_<slug>_r<N>.md` with what changed and the whole table, under 110 lines; the table check reads the newest round alone (item 41) | tests/round-remainder.test.ts:53, tests/r-table-check.test.ts:317 |
| A4 | 12 pass, 13 refused with count and limit, l allows 30 and refuses 31, `--force` needs `--closed-by` and writes the `spec-size` row | tests/spec-size.test.ts:16, tests/spec-size.test.ts:26, tests/spec-size.test.ts:39, tests/spec-size.test.ts:56 |
| A5 | `roundOf` on `_r2`, `_r2-facts`, `_r2x`, `_r10`, `_r0`, `_r`, `_facts`; reviewer prose and fanout comment say the one rule | tests/round-remainder.test.ts:32, tests/round-remainder.test.ts:37, tests/round-remainder.test.ts:44 |
