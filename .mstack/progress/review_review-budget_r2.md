# Review - review-budget (item 43), round 2

**Verdict:** CHANGES_REQUESTED

Reviewed at `16e21ab`, diff `ce55528..16e21ab`. Both round-1 blocking findings are fixed and hold
under the real CLI, the suite is green, and all five criteria are met. One committed transcript
shows behaviour the code rules out, so this is not an approval. Scratch is
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review43r2/`
(`$S` below): scripts in `$S/scripts/`, output in `$S/out/`. Probes ran the checkout's
`./bin/mstack` on throwaway git repos. The `--full` comparisons ran clones at `ce55528` and
`16e21ab` (`$S/clone-base`, `$S/clone-head`).

## Changes required (blocking)

1. **`docs/wiki/The-CLI.md:389-391` shows a refusal that does not happen in the order shown.**
   The block forces greet from `specifying` to `spec_ready` (`:384-387`). The next line is
   `$ mstack state set greet --status in_progress --force`, printed as refused ("--force would move
   greet to in_progress past the 12 requirement limit"). Run in that order (`$S/scripts/e_spec.sh` §1
   -> `$S/out/e_spec.out`):
   ```
   $ mstack state set greet --status in_progress --force
   1 greet (in_progress)
     status: "spec_ready" -> "in_progress"
     base: (unset) -> "5691258b..."
   (exit 0)
   ```
   That refusal is what the command prints from `specifying`. The implementation report's own copy
   carries the note `# from specifying` (`impl_review-budget_r2.md:88`); the page dropped it. The
   code does not ask the limit on `spec_ready -> in_progress`, by design: `!requiresSpecArtifacts(item.status)`
   at `src/cli.ts:685`, and the implementer's M7 kills the mutant that asks again. So the page
   demonstrates the one behaviour the code rules out, and `CONTRIBUTING.md:57-64` treats a transcript
   that does not reproduce as a bug. Fix: run that line from a store at `specifying` and say so in
   the block, or show `pending -> spec_ready --force` instead.

## Round 1's blocking findings

**1, the round count: fixed.** `src/fanout.ts:189-193` counts every review report, lone or lensed
(`$S/scripts/b1_rounds.sh` -> `$S/out/b1_rounds.out`):
```
== round 1 panel                     review_pn_correctness.md, review_pn_tests.md
== round 2, lone, --solo             review round 2 of pn ... review_pn_r2.md   (exit 0)
== round 3, lone, --solo, no --justify
mstack: round 3 of a lone review of pn needs a reason                          (exit 2)
== round 3 with --justify            review-r3  round 2 left one finding open  ...  review_pn_r3.md  round 3 allowed    pn
== again: no second row              rows: 1
== round 3 report on disk, no row (lone, then lensed _r3-facts): [fail] ... is round 3 and has no decision row (phase review-r3, item pq)   (gate exit 1, both)
```
Also: with nothing on disk it gives `review_ga.md`. With `_r3` present and `_r2` missing it refuses
"round 4 ... needs a reason", then gives `_r4`. `_r10` gives `_r11`. `review_ga-extra_r7.md`,
`_r5-facts.md` and `review_ga-extra.md` leave `ga` at round 1. `_r2x` and `_r2-` read as round 1.

The pin at `tests/review-solo.test.ts:37-40` changed on purpose, in its own commit `3516ec6`. Its body
gives the reason: "round 1 review of item 43 found the old pin wrong ... Decided in round 2 (the
last design row)". The hunk is that one assertion, which now expects `_r6` with `--justify`. The
second world in the test is untouched, and nothing else in the file is weakened.

The three prose places now say one thing:
- `agents/reviewer.md:68-72`: "When it names none and you are reviewing alone, do not compute a name: take the path `mstack fanout plan --kind review --solo` prints. It counts every review report of the item, lone or lensed, ... From round 3 it refuses without a reason; if it does, the round was not justified: say so in your reply and write nothing under a name you picked yourself."
- `skills/review/SKILL.md:23-27`: "`mstack fanout plan --kind review --solo` gives one more than the highest round of any review report of the item, a panel's included ... From round 3 it needs `--justify "<why>"` ... Pass the path it prints to the lone reviewer in the brief."
- `docs/wiki/The-Agents.md:194-198`: "A lone reviewer takes its path from the tool, never from its own arithmetic: ... one more than the highest round of any review report of the item, lone or lensed ..."

When a brief names a path and the tool would give another, the brief wins. `reviewer.md:66` says
"Write your report to the path your brief names", and the tool is consulted only when the brief
names none (non-blocking 11).

**2, the cap: fixed for the cases it names.** The cap is stated in all four report-writing agent files, where each one describes its report:
`reviewer.md:63-64` ("Your report stays under 24 KB (24576 bytes): ... check the size with `wc -c`
before you return. A longer one turns the next role's gate red."), `implementer.md:73` (in
**Commands**: "report under 24 KB (24576 bytes), `wc -c` it"), `spec-author.md:60-61`,
`spec-reviewer.md:43-45`. `agents/implementer.md` is 108 lines. The new exception sentences:
- `reviewer.md:32-35`: "The same holds for a gate red **only** on the budget of the item under review (a report over 24 KB, or a review round without its decision row): quote the failing line as a finding, and the review goes on. ... never cut or move another pass's report yourself."
- `implementer.md:47-48`: "A gate red only on this item's budget (a report over 24 KB, a review round without its row) is a finding, not a stop: cut your own reports, name another pass's in yours."
- `orchestrator.md:17-19`: "One red does not stop you: a gate red only on the budget of the item ... Launch the role that fixes it, and when its author is gone, do the attachment move in `skills/router/SKILL.md`, Delegation."
- `skills/router/SKILL.md:17-19`: "The one exception is a gate red only on the budget of the item ...: it does not stop you from launching the role that fixes it."; `:89-92`, the move.

Each says "only", so none weakens another red. `state set --status done` still refuses an over-cap
report with `--force` (`closing.ts:181-189`, not overridable). A role can tell the budget lines
apart from the others: they read "its report <path> is N bytes, over the 24576 byte limit" and "its
review report <path> is round 3 and has no decision row". The table line reads "<path> has no table
headed ...". All of them share the lead "cannot close as it stands". With two problems red at once,
both lines print (`$S/out/d_attach.out` §2, `FAILED - 2 failures`); see non-blocking 2.

The way out (`$S/scripts/d_attach.sh` -> `$S/out/d_attach.out`): the failure line names it, ending
"... moves the pasted output, unchanged, to .mstack/progress/attachments/review_at.md and leaves a
pointer in the report, editing no finding and no verdict line (docs/wiki/Gates-and-Hooks.md, "A report
over the cap")". The wiki (`Gates-and-Hooks.md:364-377`, `The-Agents.md:114-125`) and the router
(`:89-92`) agree with it. After the move, the report went from 30133 to 202 bytes and the gate
exited 0. The `verifier-failed` row's evidence path still exists, and `ledger check` still reads the
rejection. Under `attachments/`, a 30 KB `impl_at.md`, a `review_at_r3.md` with no row, a 30 KB
`review_at_r5-facts.md` and `sub/review_at_r9.md` are neither read nor counted (gate exit 0), and
`--solo` still gives `_r2`. `$S/scripts/g_docs.sh`: `Gates-and-Hooks.md:357-358` reproduces byte for byte.

Round 1's `c_flow.sh`, again (`$S/out/c_flow.out`): the gate is red at every step, as before, but
each next role now has a rule for it. The reviewer at step 3 quotes the line and goes on. The
round-2 implementer at step 5 goes on and names the reviewer's report. The coordinator's Stop hook
at step 6 carries the attachments way out. `--full` at step 7 is red too.

## Non-blocking (file them)

1. **The way out covers pasted output only.** In this repository, 26 of the 41 reports over 24576
   bytes would still be over after every fenced block was moved out. That count is a node one-liner
   over `.mstack/progress`, measuring bytes outside fences; examples are `impl_verification-never-runs.md`
   at 57525 and `review_decision-required-gate_adversarial.md` at 28746. The budget is not overridable,
   and the coordinator "edit[s] no finding". So when a report's findings alone pass 24 KB and its
   author is gone, nothing documented lets the item close. Name the next step, such as relaunching
   that role to cut its own report at the same path.
2. **Table and budget red at once is covered by neither exception.** `reviewer.md:27-35` says "only"
   twice, and `:30` says "Any other red still stops you". A literal reviewer stops on
   `$S/out/d_attach.out` §2. Say "red only on the table, the budget, or both".
3. **The round-1 implementer on the spec path.** The exception sits under "## A later round"
   (`implementer.md:47-48`), and the wiki scopes it to "an implementer of a later round"
   (`Gates-and-Hooks.md:368`, `The-Agents.md:121`). The base is set by the move to `in_progress`,
   though, so the round-1 implementer is the first role whose gate counts the spec-reviewer's report.
   `$S/out/f_specflow.out`: with a 30 KB `spec_review_sf.md`, the gate exits 0 at `specifying` and at
   `spec_ready`, then exits 1 right after the move to `in_progress`. Both `spec_review_` reports in this
   repository are over the cap. The same run shows that the budget "reported at specifying and
   spec_ready" (`closing.ts:187`, the R2 test) only reaches an item given `--base` by hand.
4. **`--full` now also reports a standing rejection at `verifying`.** Case 10 of
   `$S/out/c_full_{base,head}.out`: `ce55528` prints PASSED and head prints the `verifier-failed`
   line, exit 1. That matches the plain gate, so the behaviour is right. But USAGE (`src/cli.ts:41-42`),
   `CHANGELOG.md:29-31` and `The-CLI.md:79-82` name only "the table, the budget", and no test pins it
   (X2 survives). A green `--full` also prints no line for the closing checks: the `if (full)` branch
   at `gate.ts:703` is empty, so the output never says that the table and the budget were read.
5. **Unblocking a spec already forced asks again.** `$S/out/e_spec.out` §2: a forced `spec_ready`
   with a reason, then `in_progress`, then `blocked`. After that, `state set sb --status in_progress`
   exits 2 with "cut the spec to 12 or fewer, or pass --force with --closed-by". `blocked -> reviewing`
   does the same. Each unblock costs another `--force --closed-by` and another `spec-size` row. That
   `--force` also skips the unanswered-fork refusal (§6, where only the gate catches it).
   `implementer.md:92` sends an agent to `blocked` on any unexpected failure. Nothing of ordinary
   size is refused: at 12, `pending -> in_progress`, `blocked -> in_progress` and
   `blocked -> spec_ready` all exit 0 (§3). The message is clear about the count and the ways out, but
   says nothing of the earlier forced row. Skip the ask when the item already has a `spec-size` row.
6. **Mutants that survive** (below): X3 (the limit asked only for `spec_ready` and `in_progress`
   targets, so `blocked -> reviewing` and `blocked -> verifying` are untested) and X4 (the row's
   `moved to <status>` text is untested).
7. **"Name the file that holds the rest" gives no place.** The round-1 hint's "outside
   .mstack/progress" is gone (`src/budget.ts:73`), and no agent file says where the rest goes. A bulk
   file next to the report, `review_sb_full-output.md` (30 KB), is read as a lensed round-1 review and
   fails the cap (`$S/out/i_sibling.out`). Say `attachments/` or a scratch directory.
8. **`orchestrator.md:17-19` hands the attachment move to a role with no `Write` and no `Edit`**
   (its own `:11-12`). The move edits a report. Bash can do it, against the point of the tool list.
9. **The `review-solo.test.ts` change shifted cited lines.** `3516ec6` adds one line mid-file. Since
   then, decision rows 236 (`:127`, `:90`) and 239 (`:98`), and `impl_review-budget.md` (`:55`, `:66`,
   `:98`), cite blank lines, because each test now sits one line lower. Nothing turns red, since the
   gate reads only the newest table. An edit that kept the line count would have kept them.
10. **Row 242 says "N4 is filed separately".** No item at head files it: ids run to 93, and 78 is
    about unlocked appends, not the check-then-write in `planSolo`. Your brief says round 1's leftovers
    are being filed, and the sentence becomes true when that happens.
11. `reviewer.md:66` lets the brief's path win with no check that the file is free, so a stale `_r2`
    overwrites the old one. Add: "if it exists, say so and stop".

## Findings not applied, judged (row 242)

- **N4**: the race is untouched (`fanout.ts:208` reads outside the lock). As scope, the rebuttal
  holds. Its claim that the race is filed is not yet true (non-blocking 10).
- **N7: the rebuttal does not hold on its own ground.** It calls the finding "outside the four
  decided points", but decided point (1), row 240, says "the third review of any shape needs its
  reason". In `$S/out/b1_rounds.out` §B, `fanout plan --round 3 --worker facts` asks for nothing and
  writes no row, though the gate turns red once that report exists. `--round 2 --worker facts` after a
  lone `_r2.md` makes a third review with the gate green and no row. `skills/review/SKILL.md:15`, the
  panel command a coordinator copies, has no `--round`. As written, it gives a later panel round-1
  names. After two lone rounds that makes three lensed reports with no row and no budget line, and a
  second panel prints the same paths, so it overwrites the first (`$S/out/b2_skillpanel.out`; the
  overwrite predates this item). Criterion 1 concerns `--solo` and criterion 2 the round a report's
  name carries, so neither is defeated. The budget leaks through the panel route all the same. This
  round did not make it worse, so it stays non-blocking, and whoever files it should take this repro.
- **N9, the last part (row written after the save)**: the comment at `src/cli.ts:954` gives the
  trade-off, which is that a refused write leaves no row for a move that did not happen. Holds.
- **N11**: the count matches the table check's reader. Holds. **N12**: unchanged. Holds as scope.
- **Row 241, unforced legal moves asked**: defensible (see non-blocking 5). A move to `done` is not
  asked: `specifying -> done --force --closed-by abandon` exits 0 and writes no row (§4). That is right,
  because nothing gets built on the spec after a close, and `--closed-by` there is the close note.

## Acceptance, quoted

**"decisions.tsv gains a trailing item column; fanout plan --kind review --solo allocates
review_<slug>_r<N>.md, requires --justify from round 3 and writes the review-r<N> decision row, and
prints the last reviewed sha that is still an ancestor of HEAD"**: **met**. `$S/out/h_accept.out`:
header `...result	resolves	item`, row ending `r		ac`, and `--solo` printed the sha just recorded.
The `--solo` rounds are above.

**"The gate fails the active item with base when a round-3-or-later review report has no matching
decision row, or when any of its reports exceeds 24 KB"**: **met**. Cases 3 and 4 of
`$S/out/c_full_head.out` exit 1 on both gates, and `b1` §B shows `_r3-facts`.

**"Implementer rounds after the first write impl_<slug>_r<N>.md deltas carrying the full R-to-test
table"**: **met**. `implementer.md:64-79` says so. In `$S/out/h_accept.out`, an `impl_ac_r2.md` that
lacks A2 is red ("impl_ac_r2.md has no row for A2"), even though round 1's table is complete, and
the complete round 2 is green.

**"specifying to spec_ready is refused when spec.md declares more requirements than its size allows
(m 12, l 30) unless forced with a decision row"**: **met**. `e_spec` §1: exit 2, then `--force`
alone exits 2, then `--force --closed-by` moves the item with one `spec-size` row and
`closed_by=undefined`.

**"before anything uses roundOf to decide solo versus panel, one rule covers a remainder like _r2x
..."**: **met**. `tests/round-remainder.test.ts:32,66`, plus `b1` §C, where `_r2x` and `_r2-` are
both round 1 and `--solo` gives `_r2`.

Docs and CHANGELOG sentences from round 2 hold true, with two exceptions: blocking 1, and the scope
gaps in non-blocking 3 and 4. The sentence at `CHANGELOG.md:17` now starts with a capital, "Moving".

## `gate --full` (`$S/scripts/c_full.sh base|head`)

| case | plain | `--full` at ce55528 | `--full` at head |
|---|---|---|---|
| 1 table missing / 2 bad citation / 3 30 KB report / 4 r3 no row | 1 | 0 `PASSED` | 1, same line |
| 5 green | 0 | 0 | 0 |
| 6 `verify` is `false` | 0 | 1 | 1 |
| 7 no `verify`, 11 no item | 0 | 1 `ran no verification` | 1 |
| 8 no base, no table, 30 KB | 0 | 0 | 0 |
| 9 `verifying`, no receipt | 1 | 0 | 0 (plain then 0) |
| 10 `verifying`, rejection | 1 | 0 | 1 |

`--full` skips only the receipts check and the tree hash (`gate.ts:695,701`), because it is about to
write those receipts. Case 9 shows why that is right. No case turned red that was green before for
an item without a base or a store without `verify`. The only new red is case 10, where the plain
gate was already red. No workflow breaks: every newly red `--full` sits where the plain gate,
`state set --status done`, or both already refuse.

## Tests and mutants

`git diff --stat ce55528..16e21ab -- tests` shows five new files. `round-remainder.test.ts` gained
lines only at its end (`:63-69`). `budget-helpers.ts` is a helper that no report cites.
`review-solo.test.ts` has the one mid-file line (non-blocking 9). I printed all 33 citations in the
round-2 table, and each is a `test(` line whose title matches its row (`:32` and
`spec-size-forced:28` are the template inside a loop). The report is 12335 bytes.

Mutants, each applied alone in `$S/clone-head`, with the nine changed test files run under bun
(`$S/scripts/mutants.mjs` -> `$S/out/mutants.out`):
```
R2 budget not reported at specifying/spec_ready: KILLED (62 pass, 1 fail)
R3 planSolo: another item's review-rN row stops this item's row: KILLED (62 pass, 1 fail)
R4 spec limit ignores --sdd given in the same command: KILLED (62 pass, 1 fail)
M1 --solo counts lone reports only: KILLED (60 pass, 3 fail)
M3 --full skips the closing checks: KILLED (60 pass, 3 fail)
M6 forced reason stored in closed_by: KILLED (57 pass, 6 fail)
M9 attachments read as reports: KILLED (61 pass, 2 fail)
X1 --full leaves out the budget too: KILLED (61 pass, 2 fail)
X2 --full leaves out the standing rejection: SURVIVED (154 pass, 0 fail; +gate, closing tests)
X3 spec limit asked only for spec_ready and in_progress targets: SURVIVED (63 pass)
X4 spec-size row says spec_ready whatever the target: SURVIVED (63 pass)
```
Timing (`$S/scripts/timing.sh` -> `$S/timing/`): I ran the seven changed files five times per
runtime with `HOME` empty and `GIT_CONFIG_GLOBAL=/dev/null`. All 70 runs exited 0. The slowest file
was `spec-size-forced`, at 2919-2957 ms on bun and 4158-4198 ms on node. The slowest node test took
1171 ms ("a spec within the limit moves on every route without a row"). Every bun test runs in under
its file's 2.96 s, against bun's 5 s default.

## Verification I ran

```
$ npm run typecheck                                         -> exit 0
$ ./bin/mstack lint-plugin .                                -> PASSED - 0 failures, 0 warnings
$ HOME=<empty> GIT_CONFIG_GLOBAL=/dev/null npm run test:bun  -> 865 pass, 0 fail, 41 files [171.13s]
$ HOME=<empty> GIT_CONFIG_GLOBAL=/dev/null npm run test:node -> tests 865, pass 865, fail 0
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 105 relative links checked, 0 broken
$ ./bin/mstack gate            (before this file) -> PASSED - 0 failures, 0 warnings; for item 43:
  [ok]    one active item: review-budget (reviewing)
  [ok]    review-budget is reviewing; a verification run is due at verifying
  (no table or budget line: both green and silent)
$ ./bin/mstack gate --full     (before this file) -> exit 0, out/gate-full-here.txt
  state section: "one active item: review-budget (reviewing)" and no line for item 43's checks
  [ok]    npm test && npm run typecheck && bin/mstack lint-plugin .   (inside: 865/865 on both)
  PASSED - 0 failures, 0 warnings
$ ./bin/mstack ledger check review-budget -> FAIL no verdict at 16e21ab4; 4 row(s) exist at other SHAs
```

## Not checked

- node 22.6 (only the installed node), `claude plugin validate . --strict`, a live Claude session.
- Whether GitHub gives `#a-report-over-the-cap` an anchor. The heading sits inside a list item
  (`Gates-and-Hooks.md:364`), and `check-doc-links.mjs` skips anchors.
- The implementer's "red first" counts.
