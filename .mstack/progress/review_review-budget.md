# Review - review-budget (item 43), round 1

**Verdict:** CHANGES_REQUESTED

Reviewed at `373c2fe`, diff `362536f..373c2fe`. The code does what each seam says on the cases its
tests pick, and the suite is green. Two things in normal workflow use go wrong, and the first one
leaves acceptance bullet 1 unmet. Scratch output is under
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review43/`
(written `$S` below). Every probe ran `/Users/romerma/Code/mstack/bin/mstack` on a throwaway git repo.

## Changes required (blocking)

1. **`--solo` does not count panel rounds, so the third review asks for no reason.**
   `src/fanout.ts:194` keeps only lone reports (`lens === undefined`). `skills/review/SKILL.md:12-16`
   opens a review with a panel by default. Repro, `$S/scripts/b_panel.sh` -> `$S/b_panel.out`:
   ```
   == review round 1: the panel skills/review/SKILL.md step 2 launches   (review_pn_correctness.md, review_pn_tests.md)
   == review round 2, lone, through --solo
   review round 1 of pn, one lone reviewer; the report goes to: .../review_pn.md
   == review round 3, lone, through --solo: no --justify asked
   review round 2 of pn, one lone reviewer; the report goes to: .../review_pn_r2.md
   == review round 4, lone, through --solo
   mstack: round 3 of a lone review of pn needs a reason
   == gate after three lone-or-panel rounds and no review-rN row
   (gate exit 0)
   ```
   `tests/review-solo.test.ts:38` pins it: with `review_bud_r5-facts.md` on disk, `--solo` gives
   `_r2`. That puts round 6 down as round 2. For the same state, three committed files say three
   different things. `agents/reviewer.md:59-61` says a lone later round takes "the first `N` from 2
   upward whose file does not exist", which is `_r2` after a round-1 panel where `--solo` gives
   `review_pn.md`. With `_r2` missing and `_r3` present it is `_r2` again, where `--solo` gives
   `_r4` (`$S/a1_solo.out`). `docs/wiki/The-Agents.md:181` says "A lone reviewer asks the tool for
   its path", but `agents/reviewer.md` never says to.
   Fix: take N as one more than the highest round of any review report, lone or lensed. Then make
   `agents/reviewer.md:59-61` and `docs/wiki/The-Agents.md:181` say the same thing, and replace
   the pin at `review-solo.test.ts:38`. Otherwise, record why panels must not count and change
   bullet 1.

2. **The 24 KB cap applies to reports whose authors are never told about it. Once one is over,
   the next role stops.**
   No agent or skill mentions the limit: `rg -n -i "24 ?KB|24576|byte limit" agents skills hooks`
   prints nothing. The cap is not a rare case. In this repository, 41 of 184 `impl_`/`review_`/
   `spec_` reports are over 24576 bytes (largest: `impl_verification-never-runs.md`, 97923 bytes).
   29 of them are review reports, up to 61596 bytes. Every role's rule is "A red gate stops the session"
   (`agents/implementer.md:95`, `agents/reviewer.md:131`, `agents/spec-author.md:67`,
   `agents/spec-reviewer.md:53`). The reviewer's exception at `agents/reviewer.md:27-30` covers only
   the requirement table. Walkthrough, `$S/scripts/c_flow.sh` -> `$S/c_flow.out`:
   ```
   == 2. the coordinator moves it to reviewing: is that refused?          (exit 0, not refused)
   == 3. the reviewer's first step, 'mstack gate'
   [fail]  1 fl (reviewing) ... its report .mstack/progress/impl_fl.md is 30085 bytes, over the 24576 byte limit
   == 5. the coordinator sends it back for round 2: the implementer's first 'mstack gate'
   [fail]  1 fl (in_progress) ... its report .mstack/progress/review_fl.md is 30000 bytes, over the 24576 byte limit
   == 6. the Stop hook: "The mstack gate is red. Fix these before closing: ..."
   ```
   When a reviewer has written 30 KB and returned, the failure line's only way out is "cut
   review_fl.md to 24576 bytes". That means some other pass edits the file a `verifier-failed`
   ledger row cites as its evidence, and nothing in the prose says who may do that.
   Fix: (a) give the cap, and where bulk output goes, in `agents/implementer.md`,
   `agents/reviewer.md`, `agents/spec-author.md` and `agents/spec-reviewer.md` (and in
   `skills/implement` and `skills/review`). (b) Widen the exception at `agents/reviewer.md:27-30`, and
   give the implementer the same one, so that a budget failure on another pass's report is a finding
   and not a stop. (c) Say in the hint how a coordinator handles a report whose author is gone.

## Non-blocking (file them)

- N1 `mstack gate --full` runs none of the closing checks (`src/gate.ts:81` skips
  `checkVerificationRuns`, and `gateProblems` is called only there, `:698`). This gap predates the
  diff: the table check of item 41 has it too. Now it also hides the budget. In `$S/a2_gate.out`,
  `gate --full` printed `PASSED - 0 failures, 2 warnings` over a 30 KB report and a round-6 report
  with no row, while the default gate failed both. `docs/wiki/Gates-and-Hooks.md:360-361` states
  this correctly. Still, `agents/reviewer.md:19` makes `--full` the reviewer's verification, and the
  USAGE line `src/cli.ts:41` ("--full also runs verification") reads as a superset.
- N2 On a forced spec move, the `--closed-by` text is stored in `closed_by`. It shows on an item
  that is not closed: in `$S/a4_spec.out` it is still there at `in_progress`. A close without
  `--closed-by` then keeps it as the close note. A close with `--closed-by` (the ship skill passes
  one) overwrites it, and a forced close replaces it after its marker. The behaviour is documented
  (`docs/wiki/The-CLI.md:365-366`), and the decision row already holds the reason. Suggest not
  persisting it.
- N3 Forcing past the door skips the spec limit and writes no row. With 40 requirements,
  `specifying -> in_progress --force` and `pending -> spec_ready --force` both exit 0
  (`$S/a4_spec.out`). Bullet 4 names only the `specifying -> spec_ready` door, so it is still met.
- N4 `src/fanout.ts:210` checks for an existing row outside the lock: six concurrent
  `--solo --justify` runs wrote six `review-r3` rows for one item (`$S/a1_concurrent.out`). The gate
  does not care.
- N5 Three of my mutants survive (`$S/mutants.out`): R2, the budget not reported at `specifying` or
  `spec_ready` (`src/closing.ts:187`); R3, the planSolo dedupe ignoring the item
  (`src/fanout.ts:210`); R4, `--sdd` given in the same command ignored (`src/cli.ts:679`).
- N6 `JUSTIFY_FROM_ROUND` sits in the planner (`src/fanout.ts:65`) and the gate's
  `src/budget.ts:8` imports it from there. It belongs next to `MAX_REPORT_BYTES`, with fanout
  importing it.
- N7 A panel round 3 (`fanout plan --round 3 --worker x`) asks for no reason and writes no row,
  and the gate then fails its reports. `skills/review/SKILL.md` never mentions `--solo` or
  `--justify`.
- N8 `docs/wiki/The-CLI.md:648,658` print `/tmp/demo/solo/...` as if it were the real path. The
  neighbouring block elides its path as `/private/tmp/.../` (`:611`).
- N9 Small fixes. `CHANGELOG.md:17` starts a sentence with lower-case "moving". The JSDoc at
  `src/cli.ts:346` ("One of s, m or l...") was cut off from `parseSize` (`:371`) when
  `specOverLimit` was inserted between them. The USAGE line `src/cli.ts:51` lacks
  `[--item <slug>]`, which `decide --help` has. The forced `spec-size` row is written after the
  state is saved (`src/cli.ts:943`), so a lock timeout leaves a move with no row.
- N10 `_r2-` is untested. `roundOf` reads it as round 1 with lens `r2-` (`$S/roundof.out`).
  "a round marker only when nothing follows it or a dash does" is a necessary condition, so the
  prose is not false. But `_r3-` needs no row, and a loose reading calls it round 3. Add it to
  `tests/round-remainder.test.ts:20`.
- N11 The spec count includes headings inside a code fence and under `## REMOVED Requirements`:
  10 plain headings plus `R11:`, `R012`, one fenced and one removed counted 14 (`$S/a4_spec.out`).
  The table check reads the same way, so the two agree.
- N12 `tests/decide-item-column.test.ts:16` reads this repository's live `.mstack/decisions.tsv`.

## Acceptance, quoted

**"decisions.tsv gains a trailing item column; fanout plan --kind review --solo allocates
review_<slug>_r<N>.md, requires --justify from round 3 and writes the review-r<N> decision row,
and prints the last reviewed sha that is still an ancestor of HEAD"** - **unmet** because of
blocking 1. Checked and holding:
- The column is filled with no active item, with an active one, with `--item other`, and with
  `--item 2`. `--item nope` exits 2 and leaves the file unchanged (`$S/a1_decide.out`).
- Tabs and newlines in a value become spaces, and `=1+1`, `-rf`, `@x` are prefixed with `'`.
- On the file as of `362536f`, the header became `...,resolves,item`, 232 rows became 233, and the
  old rows are byte-identical (`cmp`, `$S/a1_oldfile.out`). The gate, `--resolves` and the reader
  still work on it, and every old row reads with an empty item.
- Eight concurrent `decide` runs give one header line and eight 8-cell rows.
- `--solo` without `--justify` at round 3 exits 2, and a blank `--justify` is refused. With a reason,
  `--solo` writes `review-r3|<reason>|...|.mstack/progress/review_bud_r3.md|round 3 allowed||bud`, and
  asking again writes nothing. `_r10` follows `_r9`. With no active item it exits 2.
- The printed sha skips implementer, `mstack:implementer` and spec-author rows, a row another
  target holds, and a row a reset orphaned. With no row it prints `none: ...` (`$S/a1_sha.out`).

**"The gate fails the active item with base when a round-3-or-later review report has no matching
decision row, or when any of its reports exceeds 24 KB"** - met (`$S/a2_gate.out`,
`$S/a2_gate_b.out`):
- Round 3 with no row: exit 1. A row filed for another item: exit 1. A `review-r4` row only:
  exit 1.
- A hand-typed `mstack decide --phase review-r3` while the item is active fills `item` and gives
  exit 0. So this repository's habit of typing the row by hand still satisfies the check.
- `_r3-facts` is held to its row, and `_r5-facts` with no row fails.
- `review_cost-ledger-followups_r3.md` and a 30 KB `impl_cost-ledger-followups.md` do not count
  against `cost-ledger`.
- For each kind (impl with a table, review, spec, spec_review), 24576 bytes passes and 24577 fails.
- An item without a base is not checked, and neither is a done one. `--force` at `done` is
  refused.

**"Implementer rounds after the first write impl_<slug>_r<N>.md deltas carrying the full R-to-test
table"** - met. `agents/implementer.md:65-78` and `skills/implement/SKILL.md:49-60` say this, and it
matches `src/rcheck.ts:36-44`, which takes the highest round among the files with no lens
(`impl_<slug>.md` is round 1).

**"specifying to spec_ready is refused when spec.md declares more requirements than its size
allows (m 12, l 30) unless forced with a decision row"** - met (`$S/a4_spec.out`):
- 12 requirements pass and 13 exit 2 at size `m` and at no size. At `l`, 30 pass and 31 exit 2.
- `--force` alone exits 2, naming `--closed-by`.
- `--force --closed-by` moves the item and writes
  `spec-size|<reason>|sp declares 13 requirements, over the 12 ...|.mstack/specs/sp/spec.md|forced past the limit||sp`.
- A spec with no headings, or a missing spec, passes.
- `--size l` given in the same command is used, and so is `--clear size`.
- See N3 and N11.

**"before anything uses roundOf to decide solo versus panel, one rule covers a remainder like
_r2x ..."** - met for `_r2`, `_r2-facts`, `_r2x`, `_r10`, `_r0`, `_r` and `_facts`, which code,
`agents/reviewer.md:92-97` and `src/fanout.ts:52-61` agree on (`$S/roundof.out`). `_r2-`: see N10.

## Implementer decisions

- One closing check, reported at every active status: right, because a report grows before
  review. Not overridable: defensible only once blocking 2 is fixed, because today the hint's way
  out is editing another pass's evidence.
- `--closed-by` stored in `closed_by`: wrong field, but harmless to the gates (N2).
- `--full` skipping the closing checks: reproduced. It is older than this diff and documented, but
  this diff widens what it hides (N1).
- `JUSTIFY_FROM_ROUND` in `src/fanout.ts`: wrong module (N6).
- Lensed reports not counted: blocking 1. No decision row records this choice.

## Tests

- The diff adds only new test files under `tests/`. I opened each R-table citation: every one is a
  `test(` line whose title matches its row. A1 also names the no-item, `--item` and 6-cell cases,
  and those tests exist (`:45`, `:57`, `:103`) without being cited.
- Mutants, applied one at a time in a scratch clone, with the owning files run under bun. The
  implementer's five are all killed:
  ```
  I1 decide item always empty: KILLED (1 pass, 4 fail)
  I2 justify from round 4: KILLED (14 pass, 8 fail)
  I3 limit 24577: KILLED (9 pass, 2 fail)
  I4 no ancestor check: KILLED (10 pass, 1 fail)
  I5 m limit 13: KILLED (5 pass, 2 fail)
  R1 budget: a review-rN row of any item covers: KILLED (10 pass, 1 fail)
  R2/R3/R4: SURVIVED (see N5)
  ```
- Timing: each new file ran 5 times per runtime with `HOME` empty and `GIT_CONFIG_GLOBAL=/dev/null`,
  and all 50 runs exited 0. The slowest single test was 653 ms on bun and 851 ms on node, against
  bun's 5 s default. The tests set explicit 120 s timeouts. Slowest file: `review-budget-gate`,
  4.0 s on bun and 4.98 s on node (`$S/timing/`).
- Stop hook cost on a store with 50 reports and 240 decision rows, median of 15 runs: head 116 ms,
  base 114 ms. `gate --quiet`: head 113 ms, base 112 ms (`$S/c_timing.out`).

## Verification I ran

```
$ npm run typecheck                                   -> exit 0
$ ./bin/mstack lint-plugin .                          -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate                                   -> PASSED - 0 failures, 0 warnings (before this file)
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 103 relative links checked, 0 broken
$ HOME=<empty> GIT_CONFIG_GLOBAL=/dev/null npm run test:bun   -> 842 pass, 0 fail, 36 files
$ HOME=<empty> GIT_CONFIG_GLOBAL=/dev/null npm run test:node  -> tests 842, pass 842, fail 0
```
`impl_review-budget.md` is 12164 bytes. The pasted blocks in `docs/wiki/Gates-and-Hooks.md:343-358`
reproduce byte for byte, fix lines included, and so do The-CLI.md's `--item nope` block and its
spec-size block (`$S/g_docs.out`, `$S/a4_spec.out`).

## Not checked

- node 22.6: only v26.13.1 is installed.
- `claude plugin validate . --strict`.
- A live Claude session: the Stop hook was fed JSON by hand.
- The implementer's "red first" counts.
