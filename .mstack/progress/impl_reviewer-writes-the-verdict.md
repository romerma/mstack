# Implementation - reviewer-writes-the-verdict (item 15)

## What changed

The reviewer is now told to type its own ledger row. `agents/reviewer.md` gained a
`## Record it` section (lines 69-93, a pure insertion between the report format and the
return line; frontmatter untouched) giving the exact `mstack ledger record ... --verifier
reviewer` command, a fixed three-way verdict mapping, and a lens carve-out. The mapping:
APPROVED records the rung the verification run actually reached (`live-verified` /
`test-verified` / `type-check-only`); CHANGES_REQUESTED records `verifier-failed` even on a
green suite, because the check that ran is the review and the item failed it, and rank-0
mechanically blocks a close, which is what the verdict means; a verification that could not
run at all records `verifier-blocked`. A lens reviewer records nothing, because
`src/ledger.ts` keeps the best row per `(target, sha)` by RANK, so N lens rows would
collapse to the panel's most favorable member while a split panel means its least favorable.
`skills/review/SKILL.md` gained step 9 (lines 39-51) carrying the same rule from the
coordinator's side: one row per round, the lone reviewer has already recorded it (confirm
with `ledger check`, do not type a second one on its behalf), and after a panel the
synthesizing pass records the one synthesized row under its own role name, never as
`reviewer`. `skills/verify/SKILL.md:17` and `skills/ship/SKILL.md:31` were checked and left
alone: their generic `--verifier <role>` / `--verifier <who ran it>` wording agrees with the
new rule that whoever types the row signs it. README.md:100-102 and
docs/wiki/Getting-Started.md:233-249 already narrate the reviewer recording its own row, so
no document now contradicts another. Both decisions are in `decisions.tsv` under phase
`item-15`. Deliberately untouched, per the item's scope: `agents/implementer.md:45`,
`src/roles.ts`, `src/gate.ts`, all agent frontmatter.

No test was added. The change is prose in an agent file and a skill file; the only
executable claims are that `lint-plugin` still passes and the suite is still green, and
inventing a test that cannot fail is the anti-pattern this refinement round exists to
remove. That honesty is itself part of the item's scope statement.

## Files

- `agents/reviewer.md` - new `## Record it` section, lines 69-93 (+25, insertion only)
- `skills/review/SKILL.md` - new step 9, lines 39-51 (+13, insertion only)
- `.mstack/progress/current.md` - session log
- `.mstack/decisions.tsv` - two decisions, phase `item-15`
- `.mstack/progress/impl_reviewer-writes-the-verdict.md` - this report

## Commands

```
$ npm test
(bun)  258 pass, 0 fail, 616 expect() calls, exit 0
(node) tests 258 / pass 258 / fail 0 / cancelled 0 / skipped 0 / todo 0
exit=0

$ npm run typecheck
> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit
typecheck exit=0

$ ./bin/mstack lint-plugin .
-- references
[ok]    20 reference file(s), every relative link resolves
-- shipped commands
[ok]    32 file(s), no command that would hang on stdin
-- cross-references
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves
-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts
PASSED - 0 failures, 0 warnings

$ ./bin/mstack gate
PASSED - 0 failures, 1 warning
(the warning is the expected mid-session uncommitted-changes one)

$ git diff -U0 -- agents/reviewer.md skills/review/SKILL.md | rg "^@@"
@@ -68,0 +69,25 @@ feeling.
@@ -38,0 +39,13 @@ The reviewer did not write the code. If that is not true, stop: ...
```

## Acceptance to evidence

This is a direct-path, prose-shaped item; where no test can fail, the row says what was run
instead and where the claim stopped on the ladder.

| Acceptance bullet | Evidence | Where | Rung |
|---|---|---|---|
| reviewer.md instructs the reviewer to record its own row, verifier from its own role | The wording itself: exact command with `--verifier reviewer`, "The verifier column is your own role" | `agents/reviewer.md:69-93` | 3 (read back end to end; no test can fail on prose) |
| Consistent with review/ship/verify skills, no two documents conflict on who records | `skills/review/SKILL.md:39-51` says the lone reviewer already recorded and forbids a second row on its behalf; `skills/verify/SKILL.md:17` and `skills/ship/SKILL.md:31` stay generic and agree; `rg -n "ledger record"` sweep of README.md and docs/wiki found the walkthroughs already narrate the reviewer recording its own row | `skills/review/SKILL.md:39-51`, `README.md:100-102`, `docs/wiki/Getting-Started.md:233-249` | 3 |
| Write-less reviewer can record is established by evidence, not assumed | Rung-5 probe run earlier this session: a real `mstack:reviewer` (tools `Read, Glob, Grep, Bash`) wrote its report via Bash heredoc and its row via the CLI. Row on disk: `greet-name / e382833... / test-verified / .mstack/progress/review_greet-name.md / reviewer` | scratch store `r15probe/.mstack/ledger.tsv` (scratchpad, preserved unmodified) | 5 |
| lint-plugin passes, frontmatter contract unchanged | `./bin/mstack lint-plugin .` exits 0 with 0 failures 0 warnings at this head; `git diff -U0` shows both edits are insertions at lines 69/39, first frontmatter block untouched | output above | 4 |

Both suites (`bun test`, `node --test`) pass 258/258 at this head, which proves the change
broke nothing; it does not prove the wording, and no row above claims it does.

## The new agents/reviewer.md wording, verbatim

> ## Record it
>
> Reviewing alone, you type your own ledger row, through Bash, once the report exists:
>
> `mstack ledger record <slug> "$(git rev-parse HEAD)" <verdict> --evidence <the report path you wrote> --verifier reviewer`
>
> The verifier column is your own role. Nobody types this row on your behalf: a row
> ghost-written by the coordinating pass is prose separation with no typed artifact behind it,
> which is the exact failure the column exists to catch. The verdict maps from what actually
> happened, not from the tone of the report:
>
> - **APPROVED** records the rung your verification run reached: `live-verified`,
>   `test-verified`, or `type-check-only`. Never a rung above what you ran.
> - **CHANGES_REQUESTED** records `verifier-failed`, even when the suite was green. The check
>   that ran is the review, and the item failed it; a green suite next to an uncovered
>   requirement is a failed verification, not a pass with a footnote. `verifier-failed` clears
>   nothing and blocks a close, which is exactly what your verdict means.
> - **A verification you could not run at all** records `verifier-blocked`, whatever you
>   thought of the diff. An opinion formed without running anything must not read as evidence.
>
> Given a lens, skip this step: write your report and record nothing. The ledger keeps the best
> row per `(target, sha)` by rank, so N lens rows would collapse to the panel's most favorable
> member, and a split panel means the opposite. The pass that synthesizes the panel's verdict
> records the one row, under its own name.

And the new skills/review/SKILL.md step, verbatim:

> 9. One ledger row per review round, typed by the pass that formed the verdict it carries:
>    - A lone `mstack:reviewer` records its own row (`--verifier reviewer`) before returning.
>      Confirm the row exists with `mstack ledger check <slug>`; do not type a second one on
>      its behalf.
>    - After a panel, the lenses have recorded nothing, so record the synthesized verdict
>      yourself: `mstack ledger record <slug> "$(git rev-parse HEAD)" <verdict> --evidence
>      <the lens reports> --verifier <your own role, never reviewer>`. One row, not one per
>      lens: the ledger keeps the best row per `(target, sha)`, and a split panel means its
>      worst lens, not its best.
>
>    Either way the mapping is fixed: `APPROVED` records the rung the verification reached,
>    `CHANGES_REQUESTED` records `verifier-failed`, and a verification nobody could run
>    records `verifier-blocked`.
