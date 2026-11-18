# Implementation - review-findings-verified-first (item 62)

## What changed
`agents/implementer.md` gets a section "A later round" (read the review the brief names, check each finding against the code at head, fix what holds, record a `mstack decide --phase implement` row for one that does not, take the supported reading of an unclear one, change nothing unrequested) and a fifth report section "Findings not applied". `agents/reviewer.md` gets one bullet judging those rebuttals. Origin header on `implementer.md`; `agents/implementer.md` joins `ORIGIN_REQUIRED` and the lint test. CHANGELOG and `docs/wiki/The-Agents.md` updated.

## Files
agents/implementer.md, agents/reviewer.md, src/lint.ts, tests/lint.test.ts, CHANGELOG.md, docs/wiki/The-Agents.md.
Commits: ab1fa63 (red test), b5dee50 (text, header, lint entry, docs in one commit).

## Source
obra/superpowers, skills/receiving-code-review/SKILL.md, last touched at 6b9f1b214ab28a75677a9072d9333075971c333d. `git show <sha>:LICENSE | cmp - licenses/obra-superpowers-LICENSE.txt` printed no difference (LICENSE_IDENTICAL).

## Header clause to source
| header clause | source heading and line at the sha | where it shows |
|---|---|---|
| check each finding against the code before applying | Response Pattern, step 3 VERIFY, line 21; Common Mistakes, line 169 | "check each against the code at head before you act on it" |
| blocking findings first | Implementation Order, lines 105-106 | "blocking ones first" |
| answer a wrong one with technical reasoning | External Reviewers, lines 76-77; When To Push Back, lines 124-126 | the decide row with `--why` and `--evidence` |
| does the fix break existing functionality | External Reviewers check 2, line 71; When To Push Back, line 116 | "whose fix would break something the review did not see" |
| every ask becomes a decide row | asks at lines 20, 45, 80, 83, 94, 125, 127, 187, 193 | the decide row and "Do not ask" |
| unclear finding: source stops before implementing anything | Handling Unclear Feedback, lines 43-48 | "take the reading the code supports, and say which reading" |
| not copied: Forbidden Responses 27-38, human partner 61-65, YAGNI 88-98, Acknowledging Correct Feedback 131-148, Gracefully Correcting 150-162, Common Mistakes table 164-174, Real Examples 176-201, GitHub Thread Replies 203-205, simple-before-complex order 107-108 | as listed | absent |

## Where the source says ask
| source | mstack |
|---|---|
| line 20 "or ask" (restate) | not carried; the finding is read, no restating step |
| line 45, 56, 200 ASK about unclear items | take the supported reading, say which, in "Findings not applied" |
| line 80 "Should I investigate/ask/proceed" | decide row |
| line 83 discuss with human partner | no partner step; decide row |
| lines 94, 193 "Remove it (YAGNI)?" | section not copied |
| lines 125, 127 ask specific questions / involve partner | evidence in the decide row |
| line 187 | example not copied |

## Lint red and green
Red (commit ab1fa63, bun): `AssertionError: header removed from agents/implementer.md: expected a failure, got a pass`.
Green after the header and `ORIGIN_REQUIRED` entry: `[ok] 9 origin header(s), each naming a licence file that ships` / `PASSED - 0 failures, 0 warnings`.
Mutant: header line removed from agents/implementer.md: `[fail]  agents/implementer.md: no origin header`, `FAILED - 1 failure, 0 warnings`, exit 1; reverted with git checkout, lint green again. (A first attempt with `sd '^...'` was a no-op, since sd is not multiline; redone with python.)

## Point 4
`rg CHANGES_REQUESTED skills agents docs/wiki`: only `agents/orchestrator.md:30` and `docs/wiki/The-Agents.md:41` have a dispatch row, "back to `implementer` on CHANGES_REQUESTED". Nothing describes the next implementer brief, so nothing was added there. The brief naming the review report is stated only in the implementer's own text.

## Verify (after the final edit, head b5dee50, tree clean)
- `./bin/mstack lint-plugin .`: PASSED - 0 failures, 0 warnings
- `npm run typecheck`: no output beyond the command line (tsc --noEmit)
- `./bin/mstack gate`: PASSED - 0 failures, 0 warnings
- `npm run test:bun`: 631 pass, 0 fail
- `npm run test:node`: 631 pass, 0 fail
- `wc -l`: agents/implementer.md 98, agents/reviewer.md 136

## Not shown
No live later-round session was run; whether the wording changes behaviour is for the reviewer. docs/wiki/How-A-Work-Item-Flows.md has no sentence about the review loop, so it was left unchanged.

## Deviations
Docs went in the same commit as the text, not a separate one. The lint test list was reshaped from (dir, name) pairs to repo-relative paths so an agents file fits.
