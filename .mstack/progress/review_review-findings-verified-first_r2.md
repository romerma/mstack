# Review - review-findings-verified-first (item 62), round 2

**Verdict:** APPROVED

Reviewed at head `fa4c0c2eab97a3a89d4dc01285279c2f0ee0220e`; the round 2 change is `git diff ef756fb..fa4c0c2 -- agents CHANGELOG.md`. `./bin/mstack version` -> `mstack 0.2.1 at /Users/romerma/Code/mstack`. Source: `git -C <scratchpad>/impl61/up show 6b9f1b2:skills/receiving-code-review/SKILL.md`, 213 lines. Line numbers below are the source's unless they are prefixed with a file name.

Round 1's B-1 is closed. The "Adapted:" clause no longer says every ask became a `decide` row, and "and its examples" is gone. Each sentence that is left is true of the source and of `agents/implementer.md`. No finding below is blocking.

## Check 1: the header's "Adapted:" clause, sentence by sentence

| Clause (`agents/implementer.md:11`) | Source | mstack text | Holds? |
|---|---|---|---|
| "the source pushes back by asking the reviewer (When To Push Back, "Ask specific questions")" | heading `113 ## When To Push Back`; `123-125 **How to push back:** ... - Ask specific questions` | - | yes |
| "here a finding that does not hold becomes a `mstack decide` row and a report section" | - | `implementer.md:51-55`: one `mstack decide --phase implement` row, "and list it in your report under **Findings not applied**" | yes |
| "where the source stops and asks before implementing anything (Handling Unclear Feedback)" | heading `40`; `43-45 IF any item is unclear: STOP - do not implement anything yet / ASK for clarification` | - | yes |
| "an unclear finding is read as the code supports and the reading is said in the report" | - | `implementer.md:58-59` "take the reading the code supports, and say which reading in that same section. Do not ask." | yes |
| "to restate a requirement, in Response Pattern" ... not carried | heading `14`; `20 2. UNDERSTAND: Restate requirement in own words (or ask)` | nothing in `implementer.md:43-61` restates or asks | yes (see N-1, wording) |
| "when a suggestion cannot be verified ... under From External Reviewers" ... not carried | heading `67`; `79-80 IF can't easily verify: Say so: "... Should I [investigate/ask/proceed]?"` | no can't-verify case in `:43-61` | yes |
| "or conflicts with a prior decision, under From External Reviewers" ... not carried | `82-83 IF conflicts with your human partner's prior decisions: Stop and discuss with your human partner first` | none | yes |
| "involving the human partner, in When To Push Back" ... not carried | `127 - Involve your human partner if architectural` (and `129` "tell your partner") | none | yes |
| not copied: Forbidden Responses, human-partner handling, YAGNI check, Acknowledging Correct Feedback, Gracefully Correcting Your Pushback, Common Mistakes, Real Examples, GitHub Thread Replies, simple-before-complex | `27`, `61` (heading "From your human partner"), `88`, `131`, `150`, `164`, `176`, `203`, `107-108` | none of them in `agents/implementer.md` | yes |

Every ask in the source, checked one by one: `12` (Overview), `20`, `36` (Forbidden Responses), `44-45`, `56`, `63` (From your human partner), `80`, `83`, `94` (YAGNI), `104` (Implementation Order), `125`, `127`, `173-174` (Common Mistakes), `187`/`193`/`200` (Real Examples), `211` (The Bottom Line). All are accounted for except `12`, `104` and `211` (N-1).

## Check 2: the two changed parts of "A later round"

- Neither adds a question to the user. `rg -n -i '\bask|question|user' agents/implementer.md` outside the header hits `:25`, `:34` ("do not ask anyone"), `:59` ("Do not ask."), `:61`, and the shared rules `:97`, `:100`. None of these lines is new.
- Neither contradicts the rest of the file. The new bullet (`:56-57`) fixes the real defect, which fits "It holds: fix it" (`:50`). The review asked for that defect to be fixed, so "Change nothing the review did not ask for" (`:61`) still holds. The Tests section (`:39`) still covers its test.
- The new bullet reads clearly, but it has a gap and it displaces an antecedent (N-3).
- The fallback "the newest reports matching `review_<slug>*.md`" (`:46`) leads to the right files only if "newest" is read as "highest round". The text does not say that (N-2):
  - Lone later round: files `review_<slug>.md`, `review_<slug>_r2.md`, ... (`agents/reviewer.md:54-56`). The highest round is the single `_r<N>` file, which is right.
  - Panel: one file per lens, `review_<slug>_<lens>.md` or `review_<slug>_r<N>-<lens>.md` (`agents/reviewer.md:53,57`). The synthesis writes no file of its own; its ledger row's evidence is "the lens reports" (`skills/review/SKILL.md:49-51`). So every lens file of the highest round is the right set, and the plural "reports" allows it.
  - Neither mtime nor name order gives that set. The progress files are tracked (98 `review_` files in `git ls-files .mstack/progress`), so after a clone or checkout their mtimes are not round order. Sorted by name, round 1's lenses come after round 3's (`fd -t f review_closing-row-cites-own-report .mstack/progress | sort`, pasted below).

## Check 3: docs

- `CHANGELOG.md:5-14`: true at head. "for a finding that does not hold, change nothing and record a `mstack decide` row ... also listed in the report under "Findings not applied"" is `implementer.md:51-55`. "a real defect whose proposed fix would break something is fixed another way, with the same row" is `:56-57`. "Nothing asks the user" holds (check 2). `lint-plugin` requires the header: `src/lint.ts:431` lists `"agents/implementer.md"`, and `tests/lint.test.ts` is green on both runtimes (below). It does not mention the fallback (N-4).
- `docs/wiki/The-Agents.md:139-144`: true of `implementer.md:45-55`. It omits the fallback and the third case (N-4). "its brief names the review report" is round 1's N-1. This change did not make it untrue: the agent text now handles a brief that names none.
- `docs/wiki/The-Agents.md:153-155`: true of `agents/reviewer.md:36-39`, which this change did not touch.

## Findings (all non-blocking)

1. `agents/implementer.md:11`: three asks are not named.
   - `104` is in Implementation Order, which the header says it copied from: "1. Clarify anything unclear FIRST".
   - `12` (Overview), "Ask before assuming", and `211` (The Bottom Line), "Verify. Question. Then implement.", are in sections listed neither as copied nor as not copied.

   Nothing in the header is false as a result. The mstack text treats `104` like Handling Unclear Feedback (`implementer.md:58-59`). Fix: name it there ("(Handling Unclear Feedback, and Implementation Order's first step)"), and add Overview and The Bottom Line to the not-copied list. Wording: at `20` the ask is the "(or ask)" beside restating, so "to restate a requirement" names the step rather than the ask. The clause is still true, since neither is carried.
2. `agents/implementer.md:46`: the fallback has three problems.
   - "Newest" is undefined (check 2). Fix: "every report of the highest round on disk: `_r<N>` or `_r<N>-<lens>` with the largest N, round 1 being `review_<slug>.md` or `review_<slug>_<lens>.md`". That is `roundOf`'s rule (`src/roles.ts:66-86`).
   - The glob `review_<slug>*.md` also matches another item's reports when that item's slug extends this one. This store has three such pairs: `cost-ledger` and `cost-ledger-followups`, `statusline` and `statusline-argument-hardening`, `verify-claim-gate` and `verify-claim-gate-followups`. None of the longer slugs has a review file today. The code's own contract is `review_<slug>.md` or `review_<slug>_*.md` (`src/roles.ts:53`).
   - "Read all of it" follows a plural "reports".
3. `agents/implementer.md:56-57`: the new bullet says "record the same row" but not to list the finding under **Findings not applied**. `:51-55` says to do both, so whether the report carries this case is left open. Inserting the bullet also puts the next bullet's "that same section" (`:59`) two bullets away from the section it names (`:54`). That makes round 1's N-5 slightly worse. Fix: add "and list it under **Findings not applied**" at `:57`, and name the section at `:59`.
4. `CHANGELOG.md:7` and `docs/wiki/The-Agents.md:140-144` mention neither the fallback nor (for the wiki) the third case. Nothing in them is false. Optional.

## Verification I ran

At `fa4c0c2`, tree clean before this report:
```
$ ./bin/mstack lint-plugin .
[ok]    agents/implementer.md
[ok]    9 origin header(s), each naming a licence file that ships
PASSED - 0 failures, 0 warnings
lint exit 0
$ ./bin/mstack gate
[ok]    one active item: review-findings-verified-first (reviewing)
[ok]    working tree is clean
PASSED - 0 failures, 0 warnings
gate exit 0
$ git diff --stat ef756fb..fa4c0c2 -- src tests
src/tests stat end (exit 0)          <- empty
$ bun test ./tests/lint.test.ts
 27 pass
 0 fail
Ran 27 tests across 1 file. [807.00ms]
bun exit 0
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test tests/lint.test.ts
ℹ tests 27
ℹ pass 27
ℹ fail 0
node exit 0
$ ./bin/mstack ledger check review-findings-verified-first      (before my row)
FAIL no verdict at fa4c0c2e; 2 row(s) exist at other SHAs and a new head SHA voids them
ledger check exit 1
$ fd -t f review_closing-row-cites-own-report .mstack/progress | sort
...review_closing-row-cites-own-report_correctness.md
...review_closing-row-cites-own-report_r2-correctness.md
...review_closing-row-cites-own-report_r2-security.md
...review_closing-row-cites-own-report_r2-tests.md
...review_closing-row-cites-own-report_r3-correctness.md
...review_closing-row-cites-own-report_security.md
...review_closing-row-cites-own-report_tests.md
$ node -e '<slugs in state.json that prefix another slug>'
88 slugs; prefix pairs: 3
statusline  <  statusline-argument-hardening
cost-ledger  <  cost-ledger-followups
verify-claim-gate  <  verify-claim-gate-followups
(no slug's review_<slug>*.md glob matches another item's file today)
```
The `ledger check` failure is expected before this round's row: no verdict exists yet at the new head.

## What I did not check

- The full suite on either runtime, and any live session, as the brief asked. Round 1 ran both at `ef756fb`. `src` and `tests` are unchanged since then; only `agents/implementer.md`, `CHANGELOG.md` and `.mstack/` changed.
- Whether a model actually reads "newest" as the highest round, and whether it reads the new bullet as calling for a report entry. Both are judged from the text only (rung 3).
- Whether the source changed after the pinned sha beyond what round 1's N-7 found. I used the pinned sha only.

Evidence ladder: lint, gate and `tests/lint.test.ts` at rung 4 (run at head, real output). Header against source at rung 4 (opened at the pinned sha, lines cited). Reader clarity of the two changed parts at rung 3 (reading only).
