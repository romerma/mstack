# impl: fanout-worker-can-forge-a-round-marker

## What changed
`fanout plan` now refuses any worker name matching `^r\d+(-|$)` with an error saying it would be read as a round marker (A1, A2). `roundOf(file, kind, slug)` was added to `src/roles.ts` returning `{round, lens?}` (A3). No ad hoc round parsing existed in `src/` (rg for `_r\d`, `^r`, round patterns found none), so nothing was re-routed and no behaviour changed. `src/fanout.ts` imports `MIN_REPORT_BYTES` from `src/roles.ts` instead of redefining it (A4). `skills/review/SKILL.md` step 2 states the reservation; `docs/wiki/The-CLI.md` documents it with real output. README only names the command, so unchanged. `agents/reviewer.md` already states it.

## Files
- src/roles.ts (roundOf, basename import)
- src/fanout.ts (ROUND_LIKE refusal, shared MIN_REPORT_BYTES)
- tests/roles.test.ts (table over 79 real report names + marker/lens edge cases)
- tests/fanout.test.ts (refusal test)
- skills/review/SKILL.md, docs/wiki/The-CLI.md

## Commands
Before (base 528cfb7):
```
$ ./bin/mstack fanout plan --kind review --worker r2
review fan-out on fanout-worker-can-forge-a-round-marker, 1 worker(s):
  r2	/Users/romerma/Code/mstack/.mstack/progress/review_fanout-worker-can-forge-a-round-marker_r2.md

Give each worker its own path. Two workers with one filename lose a report silently.
```
After:
```
$ ./bin/mstack fanout plan --kind review --worker r2; echo "exit $?"
mstack: 'r2' is not a usable worker name: it would be read as a round marker
        names starting r<digits> are reserved for review rounds; pick a lens name like 'reader' or 'security'
exit 2
```
Tests (`npm test`, runs bun and node):
```
 295 pass
 0 fail
Ran 295 tests across 18 files. [34.27s]
ℹ tests 289
ℹ pass 289
ℹ fail 0
```
```
$ bun run typecheck
$ bunx --bun tsc --noEmit
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
93 relative links checked, 0 broken
```
Rung: test-verified (both runtimes green). The new tests were not separately run against the old code; the refusal test fails without the change by construction (old code accepted `r2`) and `roundOf` did not exist.

## R to test
| R | Test | Where |
|---|------|-------|
| A1 refuse round-marker names | a worker named like a round marker is refused... | tests/fanout.test.ts (last test) |
| A2 error says why | same test asserts `/round marker/` in message; before/after output above | tests/fanout.test.ts (last test) |
| A3 roundOf | roundOf reads the round and lens of every real report name; roundOf: a lens that merely starts with r... | tests/roles.test.ts (appended tables) |
| A4 shared MIN_REPORT_BYTES | no redefinition; existing check tests exercise the import | src/fanout.ts:5, tests/fanout.test.ts (check tests) |
