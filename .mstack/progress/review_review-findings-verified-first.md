# Review - review-findings-verified-first (item 62)

**Verdict:** CHANGES_REQUESTED

Reviewed at head `ef756fb9b9c9ca993476d4e38a2aa15e1fd8f32e`, base `45a6f1c`. `./bin/mstack version` -> `mstack 0.2.1 at /Users/romerma/Code/mstack`. Scratch: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review62/`.

## Blocking findings

1. `agents/implementer.md:11`: the origin header makes a false claim. It says "every place the source asks (in Response Pattern, Handling Unclear Feedback, External Reviewers, When To Push Back and its examples) is here a `mstack decide` row". Checked against the source at `6b9f1b2`, that holds for one ask out of five:
   - Response Pattern `20: UNDERSTAND: Restate requirement in own words (or ask)` has no row. The implementer's own report (`impl_review-findings-verified-first.md:27`) says this one is "not carried".
   - Handling Unclear Feedback `44-45: STOP - do not implement anything yet / ASK for clarification` has no row either. Instead, `agents/implementer.md:56-57` says "take the reading the code supports, and say which reading in that same section", meaning the report section. The header's next clause says the same, so the header contradicts itself.
   - External Reviewers `79-80: IF can't easily verify: Say so: "... Should I [investigate/ask/proceed]?"` has no case in `agents/implementer.md:43-59`, so it has no row.
   - External Reviewers `82-83: Stop and discuss with your human partner first` has no row.
   - When To Push Back `125: Ask specific questions` is the only one that maps onto the decide row's `--why`/`--evidence`. Its line `127: Involve your human partner if architectural` has no row.
   - "When To Push Back and its examples" is also wrong: lines 113-129 contain no examples. The source's examples are under Real Examples (176-201), which the same header lists as "not copied".

   This is a false statement in a shipped file. The file is also the implementer's prompt, so every dispatch reads the claim. Fix: rewrite the Adapted clause to say what the text does. Where the source pushes back with reasoning (113-127), the text records a decide row. Where it asks about an unclear item (43-56), the text takes the reading the code supports and states it in the report. The restate-or-ask step (20), the can't-verify question (79-80) and the partner escalations (82-83, 127) are not carried. Then drop "and its examples".

## Non-blocking findings (to file)

1. `agents/implementer.md:45`: "The brief of a later round names the review report". Nothing in the workflow makes a brief name it. `agents/orchestrator.md:30` and `docs/wiki/The-Agents.md:41` only say "back to `implementer` on CHANGES_REQUESTED", and `skills/router/SKILL.md:80-81` lists the brief's fields without it. In the live run the brief did name it (Probe E), probably because `current.md` did, so the wiki's restatement (`docs/wiki/The-Agents.md:140`) was true at n=1 but nothing guarantees it. There is no fallback for a brief that names no report, such as the newest `review_<slug>*.md` in `.mstack/progress/`. The path form `review_<slug>[_rN].md` also leaves out a panel's lens reports `review_<slug>_<lens>.md` and `review_<slug>_r<N>-<lens>.md` (`agents/reviewer.md:53-57`). After a panel the findings are spread across several files.
2. Live run: the coordinating session judged both findings itself before it dispatched the implementer. It recorded its own row (`decide --phase review --decision "reject review finding 2's code fix; keep its test gap"`) and wrote "Review finding 1 is correct ... Review finding 2's suggested code fix is WRONG; do not apply it. Do NOT modify bookings/app/service.py" into the brief. Nothing in the router or orchestrator tells the coordinator to pass the review on without verdicts, so the check this item gives the implementer can be done upstream of it. A line on the later-round brief in `agents/orchestrator.md`/`skills/router/SKILL.md` would close both this and N-1: name the review report(s), pass the findings as written, and do not rule on them.
3. `agents/implementer.md:51-55` puts "its fix would break something the review did not see" into the same bullet as "does not hold", with "change nothing for it". Read literally, a finding that is right about the defect but wrong about its fix leaves a real defect unfixed. That contradicts "It holds: fix it". The text should say to fix the defect another way and record why the fix differs from the one proposed. In the live run both passes read finding 2 that way on their own ("keep its test gap"). The text does not say it.
4. `agents/implementer.md:46-59` leaves three cases open:
   - Non-blocking findings. "Take the findings one at a time, blocking ones first" and "It holds: fix it" imply fixing them. Reviews in this repository file them as follow-ups, and `agents/implementer.md:20` says not to widen the acceptance. The shipped reviewer format (`agents/reviewer.md:77`) has only "Changes required" and no blocking/non-blocking split, so "blocking" means severity, which the text does not say.
   - Two findings that conflict.
   - A finding that cannot be verified here (source 79-80).

   The shared "Stop for authorization ... product decisions" rule (`:97-98`) still covers a finding that is a product fork. A reader may ask whether "Do not ask" (`:57`) holds beyond the unclear-finding bullet.
5. `agents/implementer.md:56-57`: an unclear finding's reading goes "in that same section", which is **Findings not applied**. A finding applied under the chosen reading would then be listed as not applied. It also gets no decide row, so only the report carries it.
6. `agents/reviewer.md:36-39` does not say where the rows are or how "since the previous review" is found. No CLI command lists decisions (`./bin/mstack --help`: `decide` only appends). `.mstack/decisions.tsv` is named nowhere in `agents/` (`rg -n "decisions.tsv" agents/` returns nothing). The ledger's `verifier-failed` row timestamp, or the review filename in the row's decision text, would locate them. Nor does the bullet say to check that every earlier finding was either fixed or rebutted. That leaves the silent skip, which the design row (decision 203, "or silently skips it") names as the failure, to a full re-review finding it again. "the report's" is also ambiguous next to the reviewer's own report.
7. The pinned sha is not the last upstream commit touching the source. `git log -3 -- skills/receiving-code-review/SKILL.md` in a fresh clone (upstream HEAD `22f0b46`) gives `3fb7597` first (2026-07-23, "drop The Bottom Line recap", removing lines 207-213). `merge-base --is-ancestor 3fb7597 3be5aad` fails, so the clone the implementer used was checked out at `3be5aad`, before that commit. The pin is still a valid version, the removed lines were not adapted, and the LICENSE is identical at both. The header itself makes no "last" claim. The implementer's report line 11 ("last touched at 6b9f1b2") is true only of that checkout.
8. `README.md:486-490` (Credit) still names two adapted files. `agents/implementer.md` is now one more that adapts obra/superpowers text. This is the same pre-existing gap item 88 tracks for item 61's files.
9. `skills/implement/SKILL.md` ("The report") still lists four sections and says nothing about a later round. It tells the main session to delegate, so this matters only when it does not.

## Acceptance, quoted

**"the implementer's round 2+ instructions say to verify each finding against the code and to record a rebuttal with evidence instead of applying a wrong one"**: met. `agents/implementer.md:46-48` says "check each against the code at head before you act on it: run the command it cites, open the line". `:51-55` says "change nothing for it. Record one row, `mstack decide --phase implement --decision "finding <n> of <review file> not applied: ..." --why ... --evidence "<the command or file:line that shows it>"`", and to list it under **Findings not applied** (`:70`). Live (n=1): the implementer wrote that row in the template's words ("finding 2 code fix of review_long-stay-discount.md not applied") and a "Findings not applied" section, though its brief asked for neither. This bullet has gaps (N-3 to N-5) but does not fail.

**"no step in it asks the user; a disputed finding becomes a mstack decide row the next reviewer reads"**: met. Nothing in `agents/implementer.md:43-59` asks anyone, and `:57` says "Do not ask". The row is the `decide` at `:52-54`, and `agents/reviewer.md:36-39` tells the next reviewer to read the rows and judge each one. Live: the implementer asked nothing (its handback has no question), and the round-2 reviewer judged the rebuttal by applying the rejected fix as a mutant. Its brief pointed it at `decisions.tsv` (N-6). In the same run, the reviewer and the main session raised a product question (whether discounts stack). It was unrelated to the disputed finding and came from neither section.

## Seams

| Seam | Probe | Result |
|---|---|---|
| CLI: `mstack lint-plugin` output and exit code without the header | D | `[fail]  agents/implementer.md: no origin header`, `FAILED - 1 failure, 0 warnings`, exit 1 |
| `agents/implementer.md` followed by a headless later-round run | E | run made, n=1. The coordinator ruled on both findings before the implementer saw them (N-2) |

## Requirement to test

| R | Test | Fails if reverted? |
|---|---|---|
| `agents/implementer.md` must carry an origin header | `tests/lint.test.ts:295` (entry in the loop at `:285`) | yes: with only that entry dropped from `ORIGIN_REQUIRED`, bun gives `AssertionError: header removed from agents/implementer.md: expected a failure, got a pass` (26 pass 1 fail), and node gives the same assertion |
| the reshaped loop still tests the eight older entries | same loop | yes: dropping `skills/verify/SKILL.md` (bun) or `skills/router/playbooks/deepen.md` (node) from `ORIGIN_REQUIRED` turns it red, naming that path |
| later-round text and reviewer bullet | none | prose. Live run n=1 only (Probe E) |

## Probe A: origin header against the source

Source: `git -C <clone> show 6b9f1b214ab28a75677a9072d9333075971c333d:skills/receiving-code-review/SKILL.md`, 213 lines.

| Header clause | Source at the pinned sha | Holds? |
|---|---|---|
| checking each finding against the code before applying it | `21: 3. VERIFY: Check against codebase reality`; `69-70: BEFORE implementing: 1. Check: Technically correct for THIS codebase?`; `169: Blind implementation \| Verify against codebase first` | yes |
| blocking findings first | `105-106: Then implement in this order: - Blocking issues (breaks, security)` | yes |
| answering a wrong one with technical reasoning | `76-77: IF suggestion seems wrong: Push back with technical reasoning`; `124: Use technical reasoning, not defensiveness` | yes |
| its Response Pattern, Source-Specific Handling for external reviewers, Implementation Order, When To Push Back | headings at `14`, `59`/`67`, `100`, `113` | yes |
| MIT, `licenses/obra-superpowers-LICENSE.txt`, identical at that commit | `git show 6b9f1b2:LICENSE \| cmp - licenses/obra-superpowers-LICENSE.txt` -> no output, `LICENSE_IDENTICAL`; identical at upstream HEAD too | yes |
| fix breaks existing functionality | `71: 2. Check: Breaks existing functionality?`; `116: Suggestion breaks existing functionality` | yes (text `:51`) |
| every ask is a `decide` row (Response Pattern, Handling Unclear Feedback, External Reviewers, When To Push Back and its examples) | 20, 44-45, 79-80, 82-83, 127: no row; 125: row | **no** (B-1) |
| unclear finding read as the code supports, where the source stops and asks | `43-45` | yes |
| not copied: Forbidden Responses, human-partner handling, YAGNI, Acknowledging Correct Feedback, Gracefully Correcting, Common Mistakes, Real Examples, GitHub Thread Replies, simple-before-complex | `27`, `61`, `88`, `131`, `150`, `164`, `176`, `203`, `107-108`: none of them in `agents/implementer.md` | yes |
| the sha | last commit touching the file at the clone's checkout `3be5aad`, but not at upstream HEAD `22f0b46` (`3fb7597`) | pin valid (N-7) |

Reading the file: `src/frontmatter.ts` `parse` stops at the closing `---`. The header sits after it at line 11, and `skills/test-first/SKILL.md:7` already does the same. Lint passes (`[ok] 9 origin header(s)`). In the live run the init event lists `mstack:implementer`, the agent was dispatched as `subagent_type=mstack:implementer`, and it wrote the **Findings not applied** section and the template's row wording without being asked. That shows the checkout's text reached it.

`agents/reviewer.md:36-39` has no header and needs none. The source is about receiving a review and has no reviewer-side text. None of the bullet's wording ("rebuttal", "closes that finding", "raised again") appears in it.

## Probe D: lint and test mutants

Scratch `git worktree` at `scratchpad/review62/wt`, detached at `ef756fb`, removed afterwards (`git worktree list` shows only the checkout).

```
== header removed from agents/implementer.md (git diff --numstat: 0 1 agents/implementer.md)
50:[fail]  agents/implementer.md: no origin header
56:FAILED - 1 failure, 0 warnings
lint exit 1
== restored -> PASSED - 0 failures, 0 warnings

== M1: "agents/implementer.md" dropped from ORIGIN_REQUIRED (bun test tests/lint.test.ts)
AssertionError: header removed from agents/implementer.md: expected a failure, got a pass
(fail) a file that must carry an origin header and does not is caught [185.36ms]
 26 pass
 1 fail
== M1 on node
  AssertionError [ERR_ASSERTION]: header removed from agents/implementer.md: expected a failure, got a pass
== M2: "skills/verify/SKILL.md" dropped (bun)
AssertionError: header removed from skills/verify/SKILL.md: expected a failure, got a pass
 26 pass
 1 fail
== M3: "skills/router/playbooks/deepen.md" dropped (node)
  AssertionError [ERR_ASSERTION]: header removed from skills/router/playbooks/deepen.md: expected a failure, got a pass
== clean: 27 pass, 0 fail
```

Removing an older header from the file itself (`skills/design/references/deep-modules.md`) turns red `the plugin as shipped lints clean` and the other tests that lint the shipped copy. The loop's own entry still passes, because the copy fails either way. Dropping a list entry is the mutant that shows the loop covers each path, and it does for old and new entries alike.

## Probe E: a live later-round run (n=1)

Project: a copy of `sandbox/bench/template` at `scratchpad/review62/live/proj`, set up as follows.
- `git init`, a commit, then `/Users/romerma/Code/mstack/bin/mstack setup`, with `state.verify = python3 -m unittest discover -s tests` committed (as `run.mjs:101-110` does).
- Branch `feat/long-stay-discount`, with item 1 `long-stay-discount` and two acceptance bullets: "7 nights or more is priced 10% below nights times the nightly rate, in quote and in book", and "6 or fewer as before".
- Code commit `bbd61bd`: `pricing.py:37 if nights > LONG_STAY_NIGHTS:`, with tests at 8 and 6 nights. All 20 tests were green.
- An implementer report and its `test-verified` row.
- `review_long-stay-discount.md` with verdict CHANGES_REQUESTED, two blocking findings, and a `verifier-failed` row by `reviewer`.
- Status `reviewing`, the one `agents/orchestrator.md:30` sends back to the implementer, and `current.md` filled in. The gate was green at the start.

The two findings:
- Finding 1 holds. It cites `pricing.py:37` and says 7 nights is full price. `python3 -m bookings quote standard 2025-03-01 2025-03-08` printed `$693.00`.
- Finding 2 does not hold. It cites `service.py:21` and says `book` never calls `pricing.quote`, then asks for a discount inside `book`. Line 21 is `total = pricing.quote(room, check_in, check_out)`. `book standard Ada 2025-03-01 2025-03-09` printed `$712.80`, equal to the quote, so the proposed fix would discount twice.

Wrapper `scratchpad/review62/live/run.sh`:
```
cd <proj>; /usr/bin/perl -e 'alarm 800; exec @ARGV' /usr/bin/env -i HOME USER LOGNAME TERM LANG TMPDIR SHELL PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:<bun bin>:<claude bin> \
  claude -p "/mstack continue with the long-stay-discount item" --model opus --output-format stream-json --verbose --setting-sources project \
  --strict-mcp-config --max-budget-usd 6 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto > ../stream.jsonl 2> ../stream.err
```
No ANTHROPIC_* variable was passed. `mstack` is not on that PATH (`no-mstack`). The run exited 0 with empty stderr.

```
INIT model: claude-opus-5-5 perm: auto cc: 2.1.327
  plugins: [('mstack', '/Users/romerma/Code/mstack'), ...builtin...]
  agents: ['mstack:implementer', 'mstack:orchestrator', 'mstack:reviewer', 'mstack:spec-author', 'mstack:spec-reviewer']
BASH mstack gate; ...; cat .mstack/progress/review_long-stay-discount.md; ...; cat .mstack/progress/impl_long-stay-discount.md
BASH cat bookings/domain/pricing.py bookings/app/service.py; ...
BASH git log --oneline -- bookings/app/service.py; git diff main --stat; sed -n 15,25p bookings/app/service.py | cat -n
BASH mstack decide --phase review --decision "reject review finding 2's code fix; keep its test gap" --why "service.py:21 already prices book through pricing.quote (unchanged since a1fb496); adding apply_percent_discount in book would double-discount" ...
AGENT subagent_type=mstack:implementer desc='Round 2 long-stay-discount fix'
  PROMPT: Round 2 of mstack item `long-stay-discount` ... Round 1 review: `.mstack/progress/review_long-stay-discount.md` (CHANGES_REQUESTED). ...
  - Review finding 1 is correct: `bookings/domain/pricing.py:37` uses `nights > LONG_STAY_NIGHTS` ... Change to `>=`. Add tests at exactly 7 nights ...
  - Review finding 2's suggested code fix is WRONG; do not apply it. `BookingService.book` at bookings/app/service.py:21 already calls `pricing.quote` ... Do NOT modify bookings/app/service.py. But the gap it names is real: no test proves acceptance 1 "in book". Add a test ...
  Report: append a "## Round 2" section ... (no mention of a decide row or of "Findings not applied")
SUB BASH mstack gate; ...; cat .mstack/progress/review_long-stay-discount.md; cat bookings/domain/pricing.py bookings/app/service.py; ...
SUB BASH (new tests at 7 nights first) -> 4 FAIL, e.g. AssertionError: 69300 != 62370
SUB BASH sed 's/if nights > LONG_STAY_NIGHTS:/if nights >= LONG_STAY_NIGHTS:/' ... -> green; mutants M1-M4 each killed
SUB BASH mstack decide --phase implement --decision "round 2: fix boundary to >=, cover book at 7 nights via service and CLI tests; finding 2 code fix of review_long-stay-discount.md not applied" --why "service.py:21 already prices book through pricing.quote; adding apply_percent_discount there double-discounts" --evidence "bookings/app/service.py:21; tests/test_service.py test_book_seven_nights_stores_discounted_total passes with service.py unchanged" --result "if wrong: ..."
SUB (report) ### Findings not applied - **Finding 2 of review_long-stay-discount.md, the code fix** ... Not applied. `bookings/app/service.py:21` already computes `total = pricing.quote(...)` ...
AGENT subagent_type=mstack:reviewer desc='Round 2 review long-stay-discount'
  PROMPT: ... The orchestrator rejected that code fix ... The rationale is in `.mstack/decisions.tsv`. ... Check this rejection yourself against the code and do not take it on trust.
SUB BASH mstack gate; ...; cat .mstack/decisions.tsv; git diff main...HEAD -- bookings tests
SUB (review_long-stay-discount_r2.md) ## Round 1 rebuttal, checked ... **The rebuttal holds.** ... I applied it as mutant M5 in a throwaway copy, and tests/test_service.py:19 and tests/test_adapters_cli.py:55 failed.
RESULT subtype: success turns: 15 cost: 1.2434689999999997 duration_ms: 299913 is_error: False
  permission_denials: []
```

Answers:
- `mstack:implementer` was dispatched, and its brief named the review report.
- Before editing, it read the review, `pricing.py` and `service.py`. It wrote the 7-night tests first and watched them go red (`69300 != 62370`). Its rebuttal evidence is `service.py:21`, plus the book tests passing with `service.py` unchanged.
- The true finding was fixed with tests at 6 and 7 nights through quote, service `book` and CLI book. Its own mutants were killed.
- The false finding was not applied (`service.py` untouched). It got a `decide --phase implement` row in the template's words and a **Findings not applied** section, and the brief asked for neither.
- A round-2 reviewer read `decisions.tsv`, judged the rebuttal, and applied the rejected fix as a mutant: both book tests went red. Verdict APPROVED, at `review_long-stay-discount_r2.md`.
- The implementer asked nothing. The reviewer and the main session's final reply raised whether discounts stack ("tell me if it should be one"), a product point unrelated to either finding.
- Cost $1.24, 15 turns, 299.9 s (07:01:04Z to 07:06:04Z).

What one run can and cannot show:
- **Can show.** The plugin and agent load with the header after the frontmatter. The new text shapes the row and the report section even when the brief does not ask for them. In this setup nothing asked the user about the disputed finding.
- **Cannot show.** Whether the implementer checks findings on its own. The coordinator checked both and wrote the verdicts into the brief (N-2), so the implementer was told which finding to apply.
- **Not attributable to the bullet.** Whether `agents/reviewer.md:36-39` alone makes a reviewer find and judge the rows. Its brief named `decisions.tsv` and asked it to check the rejection.
- n=1, one model for every pass, one scenario.

## Probe F: docs

- `CHANGELOG.md:5-13`: every clause is true of `agents/implementer.md:43-59`, `:70` and `agents/reviewer.md:36-39`. "Nothing asks the user" is true of the section, and `lint-plugin` does require the header (Probe D).
- `docs/wiki/The-Agents.md:140-144`: true of the text. "its brief names the review report" repeats `agents/implementer.md:45`. That held in the run but nothing guarantees it (N-1).
- `docs/wiki/The-Agents.md:153-155`: true of `agents/reviewer.md:36-39`.
- `rg -n -i "later round|round 2|CHANGES_REQUESTED" docs/wiki README.md skills | head -30`: `README.md:72` and `docs/wiki/Home.md:32` (`review -->|"CHANGES_REQUESTED"| impl`), `docs/wiki/The-Agents.md:41` (dispatch row), `:160-161` (report names) and `skills/review/SKILL.md:21-22,42,57`. None is made untrue by this diff. `skills/implement/SKILL.md` is incomplete in the way N-9 describes, and the README Credit in the way N-8 describes.

## Verification I ran

At `ef756fb`, tree clean:
```
$ ./bin/mstack lint-plugin .      -> lint exit 0; [ok]    9 origin header(s), each naming a licence file that ships
$ npm run typecheck               -> typecheck exit 0 (bunx --bun tsc --noEmit)
$ ./bin/mstack gate               -> gate exit 0
$ npm run test:bun                -> bun exit 0
 631 pass
 0 fail
Ran 631 tests across 28 files. [114.29s]
$ npm run test:node               -> node exit 0
ℹ tests 631
ℹ pass 631
ℹ fail 0
ℹ duration_ms 30346.583
```
All five ran while the live run (Probe E) was going: file times put them between 08:02:03 and 08:04:37, inside the run's 08:01:04 to 08:06:04 local window. Nothing failed, so nothing needed a rerun on its own.

## What I did not check

- Whether the implementer checks findings on its own when the brief holds no verdicts. The one run had the coordinator rule on both first. A second run, with a brief that names only the report, is the check.
- A panel later round (several lens reports), a finding that is right about the defect but wrong about its fix, two conflicting findings, and an unclear finding. Each was judged from the text only.
- Another model for any pass, and any run on Claude Code other than 2.1.327.
- Whether Claude Code removes HTML comments from an agent body before the model sees it. The header's claim reaches the prompt only if it does not.

Evidence ladder: CLI seam and lint mutants at rung 4 (run, real output). Text-to-source at rung 4 (opened at the pinned sha, lines cited). Behaviour of the later-round text at rung 5 for n=1, with the confound N-2; whether the implementer judges findings unprompted is not reached.
