# impl: verify-claim-gate (item 61)

## What changed
`skills/router/references/evidence-ladder.md` has a new section "Between the run and the claim" (five numbered steps, before "What does not count") and one added line there (a run from before the last edit). `skills/verify/SKILL.md` steps 3 and 4 now carry the five moves (still six steps, 29 lines). Both files have an origin header citing obra/superpowers `skills/verification-before-completion/SKILL.md` @ `3be5aad3dd2400ef23b15680969f4bcd3b6d7b8b`. Both paths are in `ORIGIN_REQUIRED` (`src/lint.ts`) and in the list in `tests/lint.test.ts:293`. CHANGELOG entry added. No other doc changed: README.md and the wiki describe verify in one line that stays true; no per-file notices list exists (README:489 names the licences generally).

## Files
src/lint.ts, tests/lint.test.ts, skills/verify/SKILL.md, skills/router/references/evidence-ladder.md, CHANGELOG.md.
Commits: e06c581 (red test), f1a2b28 (text, headers, lint list), 748bdd1 (changelog).

## Commands
Licence: `cmp LICENSE licenses/obra-superpowers-LICENSE.txt` at the pinned sha: identical (no output, exit 0).

Red (test only, before headers/list):
```
AssertionError: header removed from verify/SKILL.md: expected a failure, got a pass
(fail) a file that must carry an origin header and does not is caught
 0 pass / 1 fail
```
Green: `./bin/mstack lint-plugin .` -> `PASSED - 0 failures, 0 warnings`.

Mutants (header removed in turn, lint run):
| removed from | result |
|---|---|
| skills/verify/SKILL.md | `[fail] skills/verify/SKILL.md: no origin header`, exit 1 |
| skills/router/references/evidence-ladder.md | `[fail] skills/router/references/evidence-ladder.md: no origin header`, exit 1 |
| entry removed from ORIGIN_REQUIRED | covered by the red run above (test fails when list lacks the entry and no header) |

Verify after the final commit: lint-plugin PASSED; `npm run typecheck` clean; `./bin/mstack gate` PASSED; `npm test`: bun 631 pass 0 fail, node (`npm run test:node`) tests 631 pass 631 fail 0; `wc -l`: verify/SKILL.md 29, evidence-ladder.md 71.

## Header clause | source line | where in mstack
| clause | source line @ sha | mstack |
|---|---|---|
| the five steps (Gate Function) | 24-36: IDENTIFY, RUN, READ, VERIFY, ONLY THEN | ladder steps 1-5; verify steps 3-4 |
| run all of it | 28 "Execute the FULL command (fresh, complete)" | ladder step 2; verify step 3 |
| read output, exit code, counts | 29 "Full output, check exit code, count failures" | ladder step 3; verify step 3 |
| state claim with evidence, or what it shows | 30-33 | ladder step 5; verify step 4 |
| a run from before the change is not evidence | 42 "Not Sufficient: Previous run" | ladder step 2 and "What does not count"; verify step 3 |
| claims table reduced to one contrast | 45 (Bug fixed: not "code changed") and 48 (Requirements met: not "Tests passing") | ladder step 4, verify step 4 |
| not copied: Iron Law, red flags, rationalization table, key patterns, when-to-apply | 14-20, 50-59, 61-72, 74-104, 106-120 | absent |
| "at this head" is mstack's wording | no such phrase in source | ladder step 2, verify step 3 |

## Not shown
The wording was not run in a live session; it has no unit test. Only the lint requirement is tested. The "at this head" and "green suite proves the suite is green" phrasings are mine, not the source's.

## Deviations
Header "reduced to one contrast" rather than the design's "two rows". Wiki and README left unchanged on purpose.
