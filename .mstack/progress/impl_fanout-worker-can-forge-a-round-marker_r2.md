# impl r2: fanout-worker-can-forge-a-round-marker

Delta over round 1, answering the four findings of review_fanout-worker-can-forge-a-round-marker.md.

## What changed
1. `ROUND_LIKE` widened to `/^r\d/` (src/fanout.ts:50): any name starting `r<digit>` is refused, `r2x` and `r0` included, matching agents/reviewer.md:77 literally. Error fix line, wiki prose (docs/wiki/The-CLI.md) and the code comment now say `r<digit>`. The wiki's `r2` output block is unchanged and still byte-identical to a real run; `r2x` real output below.
2. Boundary tests: tests/fanout.test.ts:217 refuses `r2`, `r10`, `r2-facts`, `r2x`, `r0` and allows `reader`, `r`, `rust2`, `r-team`; tests/roles.test.ts:172 adds `review_s_r2x.md` -> round 1, lens `r2x`.
3. Descriptions corrected: skills/review/SKILL.md step 2 (`r2-facts` = round 2 with lens `facts`, shares a path with `plan --round 2 --worker facts`); src/fanout.ts comment (`r2-x` becomes `..._r2-x.md`).
4. Table rows added for impl_fanout-worker-can-forge-a-round-marker.md, impl_..._r2.md (this report) and review_fanout-worker-can-forge-a-round-marker.md. A loop over every impl/review/design/reflect file in .mstack/progress at the final commit printed no MISSING.
Non-blocking, not taken: no prefix check in `roundOf` (it has no production caller; a file without the prefix is returned unstripped, and the caller owns that), and no round-0 rejection in `roundOf` (`plan` already rejects `--round 0`, and the name `r0` is now refused by ROUND_LIKE). Neither changes behaviour, so neither needs a test.

## Files
src/fanout.ts, tests/fanout.test.ts, tests/roles.test.ts, skills/review/SKILL.md, docs/wiki/The-CLI.md, this report.

## Commands
```
$ ./bin/mstack fanout plan --kind review --worker r2x; echo "exit $?"
mstack: 'r2x' is not a usable worker name: it would be read as a round marker
        names starting r<digit> are reserved for review rounds; pick a lens name like 'reader' or 'security'
exit 2
```
Mutation proofs (node --test tests/roles.test.ts tests/fanout.test.ts, each restored afterwards):
```
== M1 drop the $ anchor in roundOf's marker pattern
✖ roundOf: a lens that merely starts with r is a lens, a marker is not
ℹ pass 16 / ℹ fail 1
    actual: { round: 2 },  expected: { round: 1, lens: 'r2x' },
== M2 narrow ROUND_LIKE back to /^r\d+(-|$)/
✖ a worker named like a round marker is refused, because roundOf would read it as one
ℹ pass 16 / ℹ fail 1
  AssertionError: Missing expected exception: r2x
== M3 widen ROUND_LIKE to /^r/
✖ a worker named like a round marker is refused, because roundOf would read it as one
ℹ pass 16 / ℹ fail 1   (reader is wrongly refused)
```
Final verification at the restored tree (`git diff src/roles.ts` empty, ROUND_LIKE is `/^r\d/`):
```
 295 pass
 0 fail
Ran 295 tests across 18 files. [35.57s]
ℹ tests 289 / ℹ pass 289 / ℹ fail 0
$ bun run typecheck -> $ bunx --bun tsc --noEmit
$ ./bin/mstack lint-plugin . -> PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 93 relative links checked, 0 broken
```
Rung: test-verified. Mutations were run on node only, not bun.

## R to test
| R | Test | Where |
|---|------|-------|
| A1 refuse round-marker names, boundary r2x/r0 | a worker named like a round marker is refused... | tests/fanout.test.ts:217 |
| A2 error says why, before/after | same test (`/round marker/`); round 1 report before/after, r2x output above | tests/fanout.test.ts:217 |
| A3 roundOf table over all real names, incl. this item's reports | roundOf reads the round and lens of every real report name | tests/roles.test.ts:164 |
| A3 edge: r2x, r2, r2-facts, reader, r | roundOf: a lens that merely starts with r... | tests/roles.test.ts:172 |
| A4 one MIN_REPORT_BYTES | structural: defined src/roles.ts:64, imported src/fanout.ts:5, used :126 | src/fanout.ts:5 |
