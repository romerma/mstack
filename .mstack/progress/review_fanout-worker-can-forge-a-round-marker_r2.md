# Review r2 - fanout-worker-can-forge-a-round-marker

**Verdict:** APPROVED

Round 2, reviewing alone, delta `6e5f0aa..HEAD` (c059e03 plus store commit 919e768), HEAD
`919e768c65658563d91b45f64533d3ab4e5cceaa`. Answers the four changes in
`review_fanout-worker-can-forge-a-round-marker.md`. The fork in change 2 was settled as option (a),
widening `ROUND_LIKE` to `/^r\d/`.

## Finding by finding
**1. "The `r<digit><letter>` boundary is unpinned"** - fixed. Both of my round-1 mutations now
fail a test, and I reran each one myself on bun and on node (output below).
- **Unanchored `roundOf`.** Removing the `$` anchor from the `roundOf` pattern is the mutation
  that brought the forgery back. It is now killed by `tests/roles.test.ts:176`
  (`review_s_r2x.md` -> `{round:1, lens:"r2x"}`): node reports `actual: { round: 2 }`.
- **`ROUND_LIKE` boundary.** My other round-1 mutation is now the code, so the matching check
  is to narrow it back to `/^r\d+(-|$)/`. That is killed by `tests/fanout.test.ts:220`
  ("Missing expected exception: r2x").
- **Further mutations.** I also tried `/^r/`, `/^r\d\d/` and `/^r[1-9]/`. They are killed by
  `reader` at `:228`, `r2` at `:220` and `r0` at `:220` respectively.

**2. "The stated rule is wider than the code"** - fixed, and every statement of the rule now says
the same thing:
- the code, `src/fanout.ts:50` (`/^r\d/`);
- the hint, `src/fanout.ts:94` ("names starting r<digit>");
- the wiki, `docs/wiki/The-CLI.md:418-419` and `:424`;
- the skill, `skills/review/SKILL.md:20`;
- the literal reading of `agents/reviewer.md:77`.

A repo-wide `rg` for `r<digit` and "round marker" outside `.mstack/` and `tests/` turns up no other
statement of the rule. The wiki block at `:422-425` is byte-identical to a real
`fanout plan --worker r2` run (the `diff` is empty). `r2x` and `r0` are refused with exit 2, while
`reader`, `r-team` and `rust2` are still allocated.

**3. "What a refused name would turn into is described wrongly"** - fixed. Both descriptions now
match what the code does:
- `skills/review/SKILL.md:21-22` says `r2` is a lone reviewer's round 2, and `r2-facts` is round 2
  with lens `facts`, sharing a path with `plan --round 2 --worker facts`.
- `src/fanout.ts:87-90` says `r2-x` becomes `..._r2-x.md`, which is the path `--round 2 --worker x`
  allocates.

My round-1 run of `--round 2 --worker facts` printed `..._r2-facts.md`, so I did not rerun it.

**4. "One real report is missing from the table"** - fixed. The progress listing in the working
tree is identical to the HEAD tree, and it has 84 files. `comm` against the 82 rows of
`REAL_REPORTS` (`tests/roles.test.ts:79-162`) leaves only `current.md` and `history.md`, which are
not reports. The table has no duplicates and no rows for files that do not exist. Three rows are
new: `:97-99` cover the impl report, the r2 impl report (round 2) and my round-1 review. This file
will not be in the table, because no table can contain the report that reviews it.

## Verification I ran
```
$ bun test tests/fanout.test.ts tests/roles.test.ts
 17 pass
 0 fail
Ran 17 tests across 2 files. [830.00ms]
$ node --test tests/fanout.test.ts tests/roles.test.ts      # node v24.14.0
ℹ tests 17
ℹ pass 17
ℹ fail 0
$ bun run typecheck                -> bunx --bun tsc --noEmit, exit 0
$ ./bin/mstack lint-plugin .       -> PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 93 relative links checked, 0 broken
$ ./bin/mstack gate                -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack fanout plan --kind review --worker r2x
mstack: 'r2x' is not a usable worker name: it would be read as a round marker
        names starting r<digit> are reserved for review rounds; pick a lens name like 'reader' or 'security'
exit 2
```
Mutations, run in a scratch copy of HEAD (now deleted; the working tree was not touched):
```
roundOf marker /^_r(\d+)(?:-(.+))?/ (no $)
  bun:  AssertionError: Expected values to be strictly deep-equal: + round: 2 - round: 1   (roles.test.ts:176)
  node: ✖ roundOf: a lens that merely starts with r ... actual: { round: 2 }, expected: { round: 1, lens: 'r2x' }
ROUND_LIKE = /^r\d+(-|$)/   bun: Missing expected exception: r2x   node: fail 1, Missing expected exception: r2x
ROUND_LIKE = /^r/           bun: 'reader' is not a usable worker name ...   node: fail 1, same
ROUND_LIKE = /^r\d\d/       bun: Missing expected exception: r2    node: fail 1, same
ROUND_LIKE = /^r[1-9]/      bun: Missing expected exception: r0    node: fail 1, same
```
**Scope:** following the coordinator's instruction, I ran only the touched test files and not the
full suite. That still covers every test of the changed code: `rg -l fanout tests/` finds only
these two files, and no other test passes a worker named `r<digit>`. The round-1 full suite at
d3aa2a8 was green on both runtimes. `gate --full` at this HEAD is still to come, from the
coordinator. Rung 4 for findings 1 and 4, rung 5 (the real CLI) for findings 2 and 3.

Tests were not weakened. The only removed lines in `git diff 6e5f0aa..HEAD -- tests/` are the two
name lists, each replaced by a longer one at `tests/fanout.test.ts:220` and `:228`.

## Non-blocking notes
- **`roundOf` and the reviewer prose still disagree on `_r2x`.**
  - The comment at `src/fanout.ts:49` says "a leading `r<digit>` is never a lens".
  - `roundOf`, as A3 requires ("any other remainder is round 1 with that lens"), reads `_r2x` as
    lens `r2x`, and `tests/roles.test.ts:176` pins that.
  - `plan` can no longer produce such a name, so the disagreement is only reachable through a file
    named by hand. If a future caller of `roundOf` decides solo versus panel from it, the two rules
    should be made one. That belongs in a follow-up item, not this delta.
- **The test title is now partly inaccurate.** `tests/fanout.test.ts:217` says refused names are
  refused "because roundOf would read it as one". For `r2x` that is not the reason: the reason is
  `reviewer.md:77`. It is a naming nit only.
- **The `roundOf` input checks you declined are reasonably declined.** You did not add a prefix
  check or a round-0 rejection to `roundOf`, and your reasons hold (impl r2 report, line 10).

APPROVED
