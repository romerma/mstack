# Implementation report: item 58 glossary-and-adr

Branch `feat/glossary-and-adr`, base `5449746`. Role played by a general-purpose agent (no plugin loaded).

## What changed

`mstack gate` now checks the entry format of a root `GLOSSARY.md` when the file exists (new `src/glossary.ts`, `checkGlossary` in `src/gate.ts:104`, called at `src/gate.ts:83`). A new reference `skills/reflect/references/domain-docs.md` (42 body lines, origin header, added to `ORIGIN_REQUIRED` in `src/lint.ts`) holds the glossary entry format, the ADR format and numbering, and the three conditions. Intake (`intake.md:5-7`) and understand (`SKILL.md:40`) read the glossary; the router's "Closing a session" step 1 (`SKILL.md:154-157`) and reflect (`SKILL.md:40-41,45-46`) write terms and ADRs. The repository gets `GLOSSARY.md` (14 terms) and `docs/adr/0001-claude-code-only.md`. Wiki (Gates-and-Hooks, Skills-and-Playbooks, State-Files), README row and CHANGELOG are updated.

Commits (each green on lint and gate; full suite run at 39f16ab, e355d5a and the end):

```
39f16ab feat(gate): check the entry format of GLOSSARY.md when the file exists
41d4a0f docs(reflect): add the domain docs reference for the glossary and ADRs
e355d5a docs(skills): read the glossary in intake and understand, write it at close and in reflect
ac24d42 docs: add the project glossary
6cc884e docs(adr): record that mstack targets Claude Code only
945b35c fix(gate): name the next action for each glossary problem
d7c1c71 docs: describe the glossary check, the domain docs and the first ADR
```

Format decided (source's own): a line `**Term**:`, definition on that line or below, optional `_Avoid_:` line; headings and prose before the first entry are free. The gate fails: no entries; an entry with no definition; a duplicate term (case-insensitive); a definition over two sentences (code spans and e.g./i.e./etc./vs. do not end one); text after the first entry that belongs to no entry. Absent file: no section, no line (follows `checkReceiptIsIgnored`). Only the root file is read. `lint-plugin` needed no change for `GLOSSARY.md` or `docs/adr/` (it skips `docs/`, and the glossary lists no statuses); it did need the new reference in `ORIGIN_REQUIRED` (lint test first).

## Mutant table (written before the code, then applied)

Planned before code: missing file fails; empty definition passes; duplicate passes; no bold term accepted; failure does not name the entry; subdirectory glossary read; `docs/` glossary read; boundary of the sentence limit; abbreviations and code spans counted as sentence ends; no entries passes; `[ok]` printed with no file; failures only warnings.

Applied with `scratchpad/impl58/mut.py` against `tests/glossary.test.ts`. First pass: 4 survivors (M8 abbreviation, M8b code span, M15 `_Avoid_` counted, M16 heading not ending an entry); fixed with one changed and one new test; second pass all killed.

| Mutant | Result |
|---|---|
| M1 missing file fails | killed |
| M2 empty definition passes | killed |
| M3 duplicate passes | killed |
| M4 text outside any entry accepted | killed |
| M5 failure does not name the entry | killed |
| M6 also reads docs/GLOSSARY.md | killed |
| M6b also reads src/GLOSSARY.md | killed |
| M7 three sentences allowed | killed |
| M7b two sentences refused | killed |
| M8 abbreviations end a sentence | survived, then killed (example now has `e.g. Basket`) |
| M8b code spans not masked | survived, then killed (example has a code span with `. `) |
| M9 no entries passes | killed |
| M10 `[ok]` printed with no file | killed |
| M11 duplicates case-sensitive | killed |
| M12 failures are warnings | killed |
| M13 same-line definition ignored | killed |
| M14 continuation lines dropped | killed |
| M15 `_Avoid_` line counted as definition | survived, then killed (new test) |
| M16 heading does not end an entry | survived, then killed (new test) |
| M17 first-wins dropped | killed |

Re-run after the `fix` commit 945b35c: no survivors.

## Red output per slice

Honest deviation: I wrote the nine gate tests together and ran them red together rather than one slice at a time. The red output (before `src/glossary.ts` existed):

```
ℹ pass 2
ℹ fail 7
AssertionError: The input did not match /\[ok\]\s+GLOSSARY\.md: 2 entries .../   (well-formed: no line yet)
AssertionError: empty definition: expected a failure, got a pass
AssertionError: duplicate: expected a failure, got a pass
AssertionError: no bold term: expected a failure, got a pass
AssertionError: three sentences: expected a failure, got a pass
AssertionError: empty glossary: expected a failure, got a pass
AssertionError: Expected values to be strictly equal: expected: 1 (failure count)
```

The two that passed were guards (no file passes; subdirectory not read), which pass without the change. Reference slice, red:

```
Error: ENOENT: no such file or directory, open '.../skills/reflect/references/domain-docs.md'   (glossary example test)
Error: ENOENT ... mstack-lint-.../skills/reflect/references/domain-docs.md   (lint origin-header test)
ℹ pass 37 / ℹ fail 2
```

Fix-text slice (945b35c), red before the change: 4 of 11 failing (`an entry with no definition...`, `a term defined twice...`, `text after the first entry...`, `a definition of three sentences...`), then 11/11.

## Glossary terms: uses pasted and definitions

Searches: `rg -n -i "receipt" src skills agents docs`, `rg -n "closing role|canCloseAnItem|closing-role" src skills agents docs README.md`, `rg -n -i "\bfork\b|\bseams?\b|\blens\b|\bverdicts?\b"`.

**Item.** `agents/implementer.md:11` "You implement exactly one item, start to finish, and then hand it to someone else to judge."; `agents/implementer.md:66` "One active item per worktree."; `src/state.ts:10-40` fields: acceptance "Quoted from the source", seams "public surfaces where the behaviour is observed and where a test attaches". Definition: unit of the queue with title, acceptance quoted from source, seams; one active at a time per working copy. Consistent with all three. ("worktree" rendered as "working copy" to keep implementation words out.)

**Intake.** `skills/router/SKILL.md:21` "Intake: turn the request into a queue item"; `intake.md:5-6` "Turn the request into one queue item ... the agent takes the reversible ones and records them"; Map table `intake.md` fact/fork/reversible. Definition matches.

**Fork.** `intake.md:18` (fork: answers change what the product's user can do or get, or cannot be undone; park it, do not take it); `src/state.ts:19` "Prose naming an unresolved product fork. Its presence triggers the human gate."; `src/gate.ts:285` "An unanswered product fork must not reach the phases that build on an answer." Definition matches.

**Seam, two live senses.** `src/state.ts:35-37` and `intake.md` "where the behaviour is observed" / "where a test attaches"; `skills/design/references/deep-modules.md:19` "Seam: where the module's interface lives, a place where behaviour can change without editing there"; `src/tsv.ts:103` also says "test seam" (the same idea). Both senses are in the entry: the testing sense first (what the skills teach at intake), the design sense second.

**Playbook.** `skills/router/SKILL.md:31` "copy that playbook's steps into your todo list verbatim"; `README.md:85` "A playbook is a short numbered step list ... A step it declines stays in the list as `skip: <reason>`". Definition matches.

**Spec path.** `skills/router/SKILL.md:60` "The spec path is opt-in"; `:67-68` "On the spec path, no code is written before `.mstack/specs/<slug>/` exists and a different pass has approved it. On the direct path, the item's acceptance array is the contract." Definition matches.

**Pass.** `skills/ship/SKILL.md:11` "a verdict from a pass that did not write the code"; `agents/implementer.md:70` "The separate passes exist to prevent that."; `skills/router/SKILL.md:67-68`. Definition: one agent session doing one role on an item.

**Lens.** `skills/review/SKILL.md:23` "each with the full diff and a distinct lens"; `agents/reviewer.md:40-49` "the design lens", per-lens report files; `skills/reflect/SKILL.md:17` "Three lenses, in parallel"; `skills/understand/references/sources/incidents.md:3` "Not a system of its own, a lens". Definition: a distinct angle from which one pass examines the same work. Fits all four.

**Verdict.** `skills/ship/SKILL.md:11` "a verdict from a pass that did not write the code, recorded against this head SHA"; `skills/review/SKILL.md:42` "Synthesize into one verdict: APPROVED or CHANGES_REQUESTED"; `src/ledger.ts:159-174` kinds approved/rejected/blocked; `src/verification.ts:28-29` "A ledger row is a verdict by a pass that looked at the work; a receipt is a fact about one command exiting". Definition covers holds / failed / could not be checked and contrasts with a receipt.

**Closing role.** Not defined as a word anywhere; used at `src/ledger.ts:162,164,170` ("latest closing-role row"), `src/gate.ts:439`, `agents/reviewer.md:109`, `skills/review/SKILL.md:52`. Defined by code at `src/roles.ts:111-128`: `canCloseAnItem` is true unless the role is in `IMPLEMENTING_ROLES` (implementer, spec-author); `src/gate.ts:436` "author-only: the pass that wrote the code does not get to close the item". Definition: a role whose verdict is allowed to close an item, any except the ones that write the work.

**Receipt, two uses.** `src/verification.ts:10-12,28-29` "which verification command actually ran, against what, and how it went"; `src/gate.ts:47` "joined by a receipt"; `src/verification.ts:77-85` fields target, sha, command, outcome (passed/failed), tree. Second use: `skills/test-first/SKILL.md:11` "The red output is the receipt: no receipt, no code." That is a recorded fact that a command ran and how it went, pasted in a report, so one definition covers both; the gate-side receipt is the machine-written kind. Definition says "recorded fact that a verification command ran ... and whether it passed" and that it is not a judgement of the work.

**Ledger.** `README.md:74` "Verdict in the ledger, keyed to this commit"; `src/gate.ts:498` "the ledger is append-only, so the failed row stays; only a later independent approval from a closing role clears it". Definition matches.

**Evidence rung.** `skills/router/references/evidence-ladder.md:6-14` five rungs from "You said so" to "reproduced in the running system", "say where it stopped". Definition matches.

**Gate.** `skills/router/SKILL.md:~140` "enforced in hooks/ or in mstack gate"; `README.md:79-80` "the session gate, mstack gate ... The Stop hook runs the fast gate at the end of every turn"; `skills/ship/SKILL.md:21` `mstack merge-gate`. Two live senses (session gate, merge gate), both in the entry.

Candidates not added: "spec", "playbook step", "decision row": no use I could pin as a distinct term of art.

## Mismatch between a term and the code (reported, not fixed)

- "Closing role" is used in code and docs but is never named as a role set: the code has `IMPLEMENTING_ROLES` (the complement) and `canCloseAnItem`. The glossary defines it by the complement.
- "Seam" and "gate" are each used in two senses (above); both are in the entries.
- "Verdict" names both the recorded ledger row and the review's `APPROVED`/`CHANGES_REQUESTED` value; the definition covers the judgement, not the vocabulary of values.

## ADR 0001: the command behind every statement

- "dropped `feat/portable-core` on 2026-10-31", "begun 2026-08-25": `git reflog --all --date=iso | rg portable` shows `HEAD@{2026-08-25 11:47:27}: checkout: moving from main to feat/portable-core` and `HEAD@{2026-10-31 15:12:56}: checkout: moving from feat/portable-core to main`. The decision itself and the owner's intent come from the project's memory note (`claude-only-host.md`) and the brief, not from the repository.
- "the branch no longer exists in the repository": `git branch -a` lists no `portable-core`; `git ls-tree -r --name-only 6687df2 | rg -i "cursor|grok"` is empty (the branch's contents are not in history).
- What the branch added (Grok/Cursor hook envelopes, Agent Plugins root manifest, `.cursor-plugin/`, setup writing `.grok/` and `.cursor/` hook files) and its open defects (overwrote `.cursor/hooks.json`, machine-specific absolute binary paths): from the brief and the memory note only. `git log --all --oneline | rg -i "portab|grok|cursor"` shows only `a98a5d0 fix: portable process-group timeout...` (unrelated, about OS portability). Unproven by the repository; the ADR says so only implicitly. A reviewer should decide whether to keep those details.
- "enforcement lives in hooks and subagents": `hooks/hooks.json` runs `${CLAUDE_PLUGIN_ROOT}/bin/mstack`; `agents/*.md` use Claude Code frontmatter (`src/lint.ts` AGENT_KEYS, AGENT_FORBIDDEN).
- "built on pstack, a Cursor plugin; research notes under docs/ still discuss Cursor": `rg -n -i "grok|cursor" README.md docs CHANGELOG.md` (README.md:477, docs/wiki/The-Story.md:7-8, docs/research/pstack-port.md).
- "worked on for two months": the two reflog dates above (about 67 days).
- No Cursor/Grok files on main: `fd -H -t d -d 2 "cursor|grok|agents-plugin" .` returned nothing.
Why all three conditions hold is written in the ADR.

## VERIFY

1. Final state (commit d7c1c71 plus the report): `npm test` exit 0; typecheck exit 0; lint and gate green; doc links green.

```
 603 pass
 0 fail
ℹ tests 603
ℹ pass 603
ℹ fail 0
tsc exit 0
./bin/mstack lint-plugin .  -> PASSED - 0 failures, 0 warnings
./bin/mstack gate           -> [ok] GLOSSARY.md: 14 entries, each a term with a one or two sentence definition ... PASSED - 0 failures
96 relative links checked, 0 broken
```
No load-sensitive failure appeared (no live run was going; `pgrep claude -p` empty).

2. Real CLI, both runtimes (`bun src/cli.ts gate` and `node --experimental-strip-types src/cli.ts gate`), throwaway repos in `scratchpad/impl58/repos/`, full output in `scratchpad/impl58/v2.out`. Identical on bun and node:

```
no glossary                         exit=0  PASSED, no glossary line
this repository's GLOSSARY.md       exit=0  [ok] GLOSSARY.md: 14 entries, each a term with a one or two sentence definition
empty definition                    exit=1  [fail] GLOSSARY.md:3: entry "Receipt" has no definition
                                            fix: write one or two sentences under it, or remove the entry
duplicate term                      exit=1  [fail] GLOSSARY.md:3: entry "item" repeats "Item" from line 1
text outside any entry              exit=1  [fail] GLOSSARY.md:3: text outside any entry: "Receipt is a record."
three sentences                     exit=1  [fail] GLOSSARY.md:1: entry "Item" has 3 sentences; a definition is one or two
no entries                          exit=1  [fail] GLOSSARY.md: no entries: each term is a line starting **Term**:
malformed GLOSSARY.md in src/       exit=0  PASSED, no glossary line
```

3. Scratch clone `scratchpad/impl58/clone` with line 1 of the reference removed:

```
[fail]  skills/reflect/references/domain-docs.md: no origin header
FAILED - 1 failure, 0 warnings          exit 1
```
(a first attempt with `sd` did not strip the line and printed PASSED; I redid it with python and the failure appeared.)

4. Live run, plugin loaded, `scratchpad/impl58/live/` (wrapper `run.sh`, driver `drive.sh`, stream `stream.jsonl`, summary `python3 show.py stream.jsonl`). Project: copy of `sandbox/bench/template`, `git init`, commit, this checkout's `setup`, committed `GLOSSARY.md` defining **Stay** (nights from check-in up to but not including check-out) and **Rate** (nightly price in integer cents, never a total). Clean `env -i`, no ANTHROPIC_* variable, `--permission-mode auto`, opus, `--max-budget-usd 6`. Request: `/mstack add a long-stay discount: a stay of 7 nights or more gets 10% off the rate. quote and book should both show the discounted total.` (the request's "rate" rubs against the glossary's Rate). Init: plugins `['mstack', ...]`, permission `auto`, model `claude-opus-5-5`. The run ended on its own after 60 s, 5 turns, $0.30, exit clean, empty stderr; it parked a fork, so no implementer was launched. No process left running.

```
TOOL Bash | mstack gate; ... cat .../skills/router/references/intake.md .../playbooks/feature.md
TOOL Bash | cat GLOSSARY.md README.md bookings/domain/*.py ...
  RESULT> # bookings ... **Stay**: ... **Rate**: The nightly price of a room type, in integer cents ...
TOOL Bash | mstack decide --phase intake --decision "Long-stay discount applies to the nightly Rate: ..." --why "Request says '10% off the rate'; GLOSSARY defines Rate as the nightly price, never a total" --evidence "GLOSSARY.md Rate entry; request 2026-11-17" ...
  mstack state add --slug long-stay-discount --title "Long-stay discount: 10% off the Rate for a Stay of 7 nights or more" \
    --acceptance "A Stay of 7 nights or more gets 10% off the rate: quote returns round(rate*0.9) * nights" ...
```
`state show 1` afterwards: title uses Stay and Rate; acceptance 1 and 2 use "Stay"; the only fork parked is `1) When quote is called with --discount-percent on a 7+ night Stay, should the two discounts compound?` (a pricing fork, not a term). The term mismatch was settled as a reversible decision citing the glossary, with no question about a term to the user. Unproven by this run: the `understand` line (not exercised), and whether the model read the glossary because of the new intake line or because it reads README-adjacent files anyway (one run, rung 5 for "read and used", not for causation).
Side finding from that run (out of scope): `Booking.overlaps` uses inclusive bounds, so back-to-back stays conflict despite the half-open Stay definition.

## Decisions recorded (`./bin/mstack decide --phase implement`)

Three rows: the glossary format and what the gate enforces; the gate prints a section only when the file exists; intake.md grows by one line (77 to 78).

## Found, not fixed

- `intake.md` is 78 lines, one over the brief's 77 (allowed "a line"); the glossary sentence says "a fact, not a question" where the brief's wording was "a fact to settle, not a question for the user".
- The glossary format's sentence limit uses a heuristic split (period, whitespace, capital); a definition with a sentence starting in lowercase after a period would count as one. Cosmetic.
- Pre-existing em dashes in `skills/understand/**`, `CHANGELOG.md` and elsewhere; none added by this item.
- `node --test` and bun both ran the suite once each at the end; I did not rerun the load-sensitive tests separately because none failed.
- `tests/helpers.ts` sandbox gates carry two warnings by default; not touched.

## Per-criterion table

| Criterion | Evidence | Rung |
|---|---|---|
| GLOSSARY.md exists with item, verdict, closing role, receipt, fork, seam, each one or two sentences with no implementation detail | `GLOSSARY.md` (14 entries); the gate passes it on both runtimes (sentence count enforced); each definition backed by pasted uses above; "no implementation detail" is by my reading, no check enforces it | 4 for the format, 3 for the meaning (read against the uses, not run) |
| docs/adr/ exists, first ADR records "Claude Code only" with date and trade-off | `docs/adr/0001-claude-code-only.md`; dated 2026-10-31 and 2026-11-17; branch contents and defects rest on the brief and a memory note, not on the repository | 2 for the repo-visible facts, 1 for the branch contents |
| intake and understand read the glossary; closing and reflect write terms and ADRs; only decisions meeting all three conditions become ADRs | intake.md:5-7, understand SKILL.md:40, router SKILL.md:154-157, reflect SKILL.md:40-46, reference conditions; live run shows the glossary read at intake and its terms in title and acceptance | 5 for intake reading; 2 for understand, closing and reflect (prose, not exercised) |
| mstack gate checks the glossary's entry format | `tests/glossary.test.ts` (11 tests, 20 mutants killed), real CLI output on both runtimes | 4 |

## Verdict

`test-verified` for the code; the prose halves stop at rung 2 to 3 except intake (rung 5).
