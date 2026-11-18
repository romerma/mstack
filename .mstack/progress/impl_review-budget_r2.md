# Implementation report: review-budget (item 43), round 2

Rung reached: test-verified. Both runtimes green (865 each, was 842), `gate --full` green over this
repository, nothing run in a live Claude session. Round 1 report: `impl_review-budget.md`.

## What changed since round 1

Both blocking findings and N1, N2, N3, N5, N6, N8, N9 (the small ones), N10 held against the code and
are applied. Not applied: see the last section.

1. **Round count.** `planSolo` (`src/fanout.ts`) takes one more than the highest round among every
   review report of the item, lone or lensed. `JUSTIFY_FROM_ROUND` moved to `src/roles.ts`, the
   planner and `src/budget.ts` import it. The old pin (`review-solo.test.ts`, `_r5-facts` giving
   `_r2`) was changed in its own commit first (`3516ec6`, reason in the message). Prose:
   `agents/reviewer.md`, `skills/review/SKILL.md`, `docs/wiki/The-Agents.md` (quoted below).
2. **The cap, told to every role.** `agents/implementer.md` (108 lines), `reviewer.md`,
   `spec-author.md`, `spec-reviewer.md` say a report stays under 24 KB (24576 bytes), what to paste,
   and to check the size. The reviewer's red-gate exception now also covers a gate red only on the
   item's own budget; the implementer has the matching sentence; `orchestrator.md` and
   `skills/router/SKILL.md` let a coordinating pass launch the fixing role. The way out is in
   `skills/router/SKILL.md` (Delegation) and `docs/wiki/Gates-and-Hooks.md` ("A report over the
   cap"), and the gate's failure line names it. `attachments/` is not read as reports and not counted.
3. **`gate --full`** reports the closing checks (table, budget); see below.
4. **Spec limit on every forced route**, and a forced spec move no longer writes `closed_by`.
5. **Small ones:** tests for the three surviving mutants and `_r2-`, the lower-case `moving`, the
   `parseSize` JSDoc, `[--item <slug>]` in the usage line, the `/tmp/demo` paths shown as
   `/private/tmp/.../`.
6. **Docs:** CHANGELOG entry, `The-CLI.md`, `Gates-and-Hooks.md`, `The-Agents.md`.

### The three prose files, as they now stand

`agents/reviewer.md`: "When it names none and you are reviewing alone, do not compute a name: take the
path `mstack fanout plan --kind review --solo` prints. It counts every review report of the item, lone
or lensed, so a lone review after a round-1 panel is `review_<slug>_r2.md` and never overwrites an
earlier round. From round 3 it refuses without a reason; if it does, the round was not justified: say
so in your reply and write nothing under a name you picked yourself." (It begins "Write your report to
the path your brief names.")

`skills/review/SKILL.md`: "A lone reviewer's path comes from the tool as well: `mstack fanout plan
--kind review --solo` gives one more than the highest round of any review report of the item, a
panel's included, so the review after a round-1 panel is round 2. From round 3 it needs `--justify
"<why>"`, which also writes the `review-r<N>` decision row the gate asks for. Pass the path it prints
to the lone reviewer in the brief."

`docs/wiki/The-Agents.md`: "A lone reviewer takes its path from the tool, never from its own
arithmetic: `mstack fanout plan --kind review --solo` allocates one more than the highest round of any
review report of the item, lone or lensed (a round-1 panel makes the next lone review round 2), and
from round 3 on wants a reason (`--justify`), which it records as the item's `review-r<N>` decision
row."

### What the coordinating prompts said, and say now

Before: `agents/orchestrator.md` step 1, "A failure stops you here"; `skills/router/SKILL.md` step 1,
"A red gate stops you." Now each adds one exception: a gate red only on the budget of the item (a
report over 24 KB, a review round without its row) does not stop launching the role that fixes it. The
router's Delegation list also carries the attachments move: "you move the pasted output, unchanged,
into `.mstack/progress/attachments/<report file name>`, and leave a pointer to it in the report. You
edit no finding and no verdict line."

### `gate --full`, before and now

Before: `runGate` (`src/gate.ts`) called `checkVerificationRuns` only when `full !== true`, and that
function is where `gateProblems` (every closing check) runs, so `--full` skipped the table and the
budget along with the receipts. Reproduced red first (`tests/gate-full-closing.test.ts`, 3 of 4 failed,
the fourth is the green case): `gate` exit 1, `gate --full` printed `PASSED - 0 failures, 1 warning`
over an impl report with no table, and `PASSED - 0 failures, 0 warnings` over a 24577-byte report and
over a round-3 report with no row.

Fix: `checkVerificationRuns(..., full)` always runs; under `--full` it leaves out the `verification`
check (`gateProblems(..., except)`) and its receipt lines, and skips the tree fingerprint. Now `--full`
is red exactly where `gate` is, and still runs the verification (the tests assert a command that
touches a file ran). On this repository, item 43 is `in_progress`, so only the budget check is due
and it is green: `gate --full` prints no extra line and `PASSED - 0 failures, 0 warnings`.

### Forced spec routes

`src/cli.ts` asks the limit whenever the target is in `SPEC_REQUIRED_FROM` and the source is not, for
an sdd item (`--sdd` in the same command included). Legal unforced moves are refused too
(`pending -> in_progress`, `blocked -> in_progress`; decide row filed); a move to `done` is not asked
(its `--closed-by` is the close note). The `--closed-by` of a forced spec move is skipped in the field
loop, so the reason is the `spec-size` row's alone. Real run:

```
$ mstack state set greet --status spec_ready --force --closed-by "the 13 parts ship as one release and cannot be split"
1 greet (spec_ready)
  forced: greet has 13 requirements, over the 12 a size m item may have; the reason is recorded as a spec-size decision row
  status: "specifying" -> "spec_ready"
$ mstack state set greet --status in_progress --force     # from specifying
mstack: --force would move greet to in_progress past the 12 requirement limit, and that has to be on the record
        add --closed-by "<why this many is right>"; it is written to decisions.tsv as a spec-size row
```

## Files

src: `src/fanout.ts`, `src/roles.ts`, `src/budget.ts`, `src/gate.ts`, `src/closing.ts`, `src/cli.ts`.
Prose: `agents/{implementer,reviewer,spec-author,spec-reviewer,orchestrator}.md`,
`skills/router/SKILL.md`, `skills/review/SKILL.md`. Docs: `docs/wiki/{The-CLI,Gates-and-Hooks,
The-Agents}.md`, `CHANGELOG.md`. Tests: new `tests/review-round-count.test.ts`,
`gate-full-closing`, `spec-size-forced`, `review-budget-mutants`, `report-attachments`; added at the
end of `tests/round-remainder.test.ts`; `tests/review-solo.test.ts` (the pin, +1 line, so its cited
lines moved by one); `tests/budget-helpers.ts` (a `verification` field). Store: two `implement` rows.

## Commands

Red first (`bun test <file>` before each code commit): round count 2 fail of 4 (`_r2` where the third
review needed a reason; `_r3` with `_r2` missing was already `_r4`); pinned solo test 1 fail (`_r2`,
expected `_r6`); gate `--full` 3 fail of 4; spec routes 6 fail of 9 (`PASSED`-style exit 0 on
`--force` with no reason; `closed_by` set); attachments 1 fail of 3 (the fix line named no way out).
The other new tests pass at once by design: they are guards for surviving mutants and are shown
killed below.

Mutants, each applied alone, run on the owning files under bun, reverted (`mutants.py`). Counts are
fail counts of the run I then repeated by hand (the script's own pass/fail regex misreads three of them):

| Mutant | Result |
|---|---|
| M1 `--solo` counts lone reports only | killed (3 fail) |
| M2 justify from round 4 | killed (3 fail) |
| M3 `--full` skips the closing checks | killed (3 fail) |
| M4 `--full` keeps the receipts check | killed (4 fail, `gate.test.ts`) |
| M5 limit only for specifying -> spec_ready | killed (4 fail) |
| M6 forced reason stored in `closed_by` | killed (6 fail) |
| M7 limit asked again from `spec_ready` | killed (2 fail) |
| M8 failure line without the attachments path | killed (1 fail) |
| M9 `attachments/` read as reports | killed (3 fail) |
| R2 budget not reported at specifying/spec_ready | killed (1 fail) |
| R3 `--solo` duplicate check ignores the item | killed (1 fail) |
| R4 `--sdd` in the same command ignored | killed (1 fail) |
| R5 `_r2-` read as round 2 | killed (2 fail) |

Final verification, after the last edit (`87ada6a`), `HOME` empty, `GIT_CONFIG_GLOBAL=/dev/null`:

```
$ npm run typecheck                 -> exit 0
$ ./bin/mstack lint-plugin .        -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate                 -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full          -> [ok] npm test && npm run typecheck && bin/mstack lint-plugin .
                                       PASSED - 0 failures, 0 warnings   (exit 0)
  inside it: bun 865 pass, 0 fail, 41 files; node tests 865, pass 865, fail 0
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 105 relative links checked, 0 broken
```

865 each, up from 842: 23 new tests (4 + 4 + 9 + 2 + 3 + 1). An earlier full run failed once, on the
implementer prose test (110 lines); fixed in `87ada6a`, which is the run above.

## R to test

Every cited line was printed back before this commit and is a `test(` line with the title shown.

| R | Test | Where |
|---|---|---|
| A1 | the item column (active, none, `--item`, old file, 6-cell file); `--solo` path, `--justify` row, ancestor sha; and round 2: a round-1 panel then two lone reviews asks for a reason, `_r3` with `_r2` missing gives `_r4` | tests/decide-item-column.test.ts:29, tests/decide-item-column.test.ts:74, tests/review-solo.test.ts:56, tests/review-solo.test.ts:67, tests/review-solo.test.ts:99, tests/review-round-count.test.ts:20, tests/review-round-count.test.ts:39, tests/review-budget-mutants.test.ts:24 |
| A2 | the gate fails a round 3 report with no row (also after a panel) and passes with it; 24576 passes and 24577 fails; closing refuses; `--full` is red where `gate` is for table, budget and a missing row; budget reported at specifying/spec_ready; attachments not read or counted, fix line names the way out | tests/review-budget-gate.test.ts:25, tests/review-budget-gate.test.ts:34, tests/review-budget-gate.test.ts:87, tests/review-budget-gate.test.ts:117, tests/review-round-count.test.ts:57, tests/gate-full-closing.test.ts:20, tests/gate-full-closing.test.ts:33, tests/gate-full-closing.test.ts:45, tests/review-budget-mutants.test.ts:14, tests/report-attachments.test.ts:18, tests/report-attachments.test.ts:42 |
| A3 | prose pin: a later round writes `impl_<slug>_r<N>.md` with what changed and the whole table, under 110 lines (now 108); the table check reads the newest round alone (item 41) | tests/round-remainder.test.ts:53, tests/r-table-check.test.ts:317 |
| A4 | 12 pass, 13 refused, l allows 30 and refuses 31, `--force` needs `--closed-by` and writes the row; every route past spec_ready refused and forced with the reason in the row only; no `closed_by` on an open item; `--sdd` in the same command | tests/spec-size.test.ts:16, tests/spec-size.test.ts:26, tests/spec-size.test.ts:39, tests/spec-size.test.ts:56, tests/spec-size-forced.test.ts:28, tests/spec-size-forced.test.ts:53, tests/spec-size-forced.test.ts:72, tests/spec-size-forced.test.ts:81 |
| A5 | `roundOf` on `_r2`, `_r2-facts`, `_r2x`, `_r10`, `_r0`, `_r`, `_facts`, and `_r2-`, `_r3-`; reviewer prose and fanout comment say the one rule | tests/round-remainder.test.ts:32, tests/round-remainder.test.ts:37, tests/round-remainder.test.ts:44, tests/round-remainder.test.ts:66 |

## Findings not applied

Decision row filed. None of the blocking findings was wrong. Not applied, outside the four decided
points and the small ones listed: N4 (concurrent `--solo --justify`, filed separately), N7 (a panel
round 3 asks for no reason), N9's last item (the `spec-size` row is written after the state save),
N11 (spec count includes fenced and removed headings; agrees with the table check) and N12
(`decide-item-column.test.ts:16` reads this repository's live `decisions.tsv`). One extra decision,
also a row: the spec limit is asked on unforced legal moves too (`pending`/`blocked -> in_progress`).
