# Implementation report, round 2 - glossary-and-adr

Implementer, round 2, on `feat/glossary-and-adr` from head `1fe2405`. No plugin loaded: a
general-purpose agent playing the implementer role (`agents/implementer.md`, `skills/test-first/SKILL.md`).
Commands below were run in this session; scratch repositories live under
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl58r2/`.

## Findings: did each reproduce?

| # | Finding | Reproduced | How |
|---|---|---|---|
| 1 | Item says seams where it is tested | yes | `src/state.ts:38` `seams?: string[]`; `intake.md:63` "No behaviour change, no seam"; `node -e` on `.mstack/state.json`: `82 69` (items, items without seams) |
| 2 | Closing role excludes "the ones that write the work" | yes | `src/roles.ts:123` two names; live run below: `implementer` row leaves the gate red, `coordinator` row closes with a green gate |
| 3 | "worked on for two months" | yes | reflog: four commits 11:51 to 12:40 on 2026-08-25, checkout out of the branch 2026-10-31 |
| 4 | upkeep rationale is not in the record | yes | `rg -n -i 'grok\|cursor\|claude code only\|portable-core' .mstack/decisions.tsv .mstack/progress/history.md CHANGELOG.md` returns only `CHANGELOG.md:8`, the item's own entry |
| 5 | "starts again from nothing" false in this clone | yes | `git cat-file -t` prints `commit` for all four |
| 6 | check fails reasonable glossaries, hints to delete | yes | before any change, a two-bullet glossary in a throwaway repo: `[fail] GLOSSARY.md: no entries: ... -> add an entry, or delete the file if the project has no glossary yet` |
| nb | unreadable file or directory crashes | yes, red output below | `EISDIR`/`EACCES` thrown out of `checkGlossary` |
| nb | malformed first entry passes as prose; M02, M12, M18 survive | yes, by the mutant run below, which kills them after the new tests |

## What changed

Five commits plus follow-ups, each green on its own for the glossary tests, typecheck and lint:

```
f840f44 feat(gate): read the common glossary styles and fail only on a missing definition or a repeated term
dc8388b docs(glossary): state what the code does for item, closing role, intake, pass, rung and gate
821bdb2 docs(adr): state only what the record shows in the first ADR
9e909cb docs(skills): write glossary and adr changes before the review that judges them
fe39d6a fix(gate): print no clean line for a glossary in which no entry is recognised
ff19f3e docs(wiki): describe the glossary check as failures and warnings and the writing order
370ded9 docs(glossary): drop the reasons the skills do not give for lens and seam
d9fb4ef docs(adr): drop the claim about garbage collection that no command shows
```

(The wording follow-ups came from my own re-derivation tables; they could not be squashed without
rewriting history I was told not to touch.)

**The check** (`src/glossary.ts`, `src/gate.ts:104-128`). Entries: `**Term**:`, `**Term:**`, with or
without a `- `/`* ` marker, definition on the line or below; or, when the file has no bold entry,
`##`/`###` headings followed by a paragraph (a heading followed by a deeper heading only groups).
Rules, HTML comments and fenced blocks become blank lines before reading (`readable`, so line numbers stay true).
Failures: no definition; duplicate term (case and trailing colon ignored). Warnings (gate stays green): a
non-empty file with no recognised entry, a definition of more than two sentences, a line that starts
with a bold term but has no colon. An unreadable file or a directory is `GLOSSARY.md could not be read (EISDIR) -> make it a readable file`.
Text outside an entry is no longer a failure. No message says to delete the file. Warnings use `report.warn`, which
is silent under the quiet gate the Stop hook runs (`src/report.ts:43-55`), so they show on `mstack gate` and not in the hook.

**Glossary** (`GLOSSARY.md`), final wording of the entries that changed:

- Item: "A unit of work in the project's queue, with a title, acceptance criteria quoted from its source and, when it changes behaviour, the seams where it is tested. By default only one item is active at a time in a working copy."
- Intake: "The step that turns a request into a queue item. Facts are found, reversible decisions are recorded and forks are parked."
- Seam: "The public surface where a behaviour is observed and a test attaches. In design vocabulary it is also a place where behaviour can change without editing there."
- Pass: "One role's run over an item, such as implementing or reviewing. A verdict is meant to come from a pass that did not write the work."
- Lens: "A distinct angle, such as correctness or security, from which one pass examines the same work. Each reviewer on a panel is given its own."
- Closing role: "A role whose verdict can close an item: any named role except the implementer and the spec author, whose verdicts are recorded but leave a closed item red at the gate. The rule goes by the role's name, not by who wrote what."
- Rung (was Evidence rung): "One of the five levels of the evidence ladder, from having said so up to having reproduced it in the running system. A claim is reported together with the rung where it stopped."
- Gate: "A check that is code instead of prose, and that goes red when the work breaks a rule. The session gate checks the working copy, and the merge gate decides whether a change may land."

**ADR** (`docs/adr/0001-claude-code-only.md`), final text:

```
# mstack targets Claude Code only

Status: accepted. Decided 2026-10-31, written down 2026-11-17.

On 2026-10-31 the maintainer dropped the branch `feat/portable-core`, and mstack stays a Claude Code plugin only. By the project's note of that day, which is kept outside this repository, the branch held Grok and Cursor hook envelopes, an Agent Plugins root manifest, a `.cursor-plugin/` directory and a setup that wrote `.grok/` and `.cursor/` hook files. The decision came after a two-month pause, and two defects in the port were still open: setup overwrote an existing `.cursor/hooks.json`, and it wrote absolute binary paths specific to one machine.

Given up: running mstack on Grok or Cursor. Kept: one host to target.

The note records this as a product decision and gives no further reasoning, so this ADR adds none.

## What the record shows against the three conditions

- **Hard to reverse.** The branch ref is gone, and none of its four commits in this clone is on a remote branch. In this clone the four commits are still in the object store (`git cat-file -t 760a281` prints `commit`).
- **Surprising without context.** The README says mstack is built on pstack, and `docs/wiki/The-Story.md` calls pstack a Cursor plugin.
- **The result of a real trade-off.** The record names what was given up and what was kept. It names no alternative that was weighed.
```

**Writing order.** `skills/reflect/SKILL.md:45-48` (reflect may propose; what it proposes after the verdict goes into a
follow-up item); `skills/router/SKILL.md:153-156` (Closing a session, step 1: "No glossary or ADR change is left uncommitted or
unreviewed: it is written before the review of the item that introduced it, ... and a later one goes into a follow-up item.");
`domain-docs.md:5` (same rule), `:9` (a term the docs do not settle is left out and said so in the report; no question to anyone),
`:23` and `:26` (the format the check accepts, failures and warnings). `CHANGELOG.md:5-17`. `intake.md` is 77 lines
(`wc -l`), Map, Park a fork, the note and End untouched; Proportion lost "(several changes or tracks)" and was rewrapped.
Docs: `docs/wiki/Gates-and-Hooks.md:281-305`, `State-Files.md:26-32`, `Skills-and-Playbooks.md:92-97`.

## Test first: mutant table before the code

Written before any code of the new check (target names: M02, M12, M18 are the review's):

| Mutant | Meant to be caught by |
|---|---|
| M02 colon optional in `ENTRY` | a bold term with no colon is not an entry |
| M12 sentence boundary before a lowercase word | "approx. ten" is one sentence |
| M18 `[ok]` printed beside failures | no `[ok]` line when a failure exists |
| N04 `**Term:**` form dropped | colon-inside slice |
| N05 list marker dropped | bullet slice |
| N06 heading mode off | heading slice |
| N07 fence not skipped | fence slice |
| N08 lines not trimmed (CRLF, BOM) | CRLF slice |
| N09 duplicates case-sensitive; N10 trailing colon kept | duplicate test |
| N11 rule not ignored; N12 comment not ignored | rule and comment slice |
| N13 no-entry warning becomes a failure; N14 long definition becomes a failure | warning slices |
| N15 unreadable file not caught | directory and mode 000 slices |
| N16 no definition not failing; N17 delete hint in a message | failure slice |
| N18 empty file warns; N19 MAX_SENTENCES 3 | empty-file and three-sentence slices |
| N20 no-colon warning dropped (the review's malformed first entry) | no-colon slice |
| N21 grouping heading read as an entry; N24 line numbers off by one; N25 heading duplicates unchecked | heading and failure slices |
| N23 warnings not printed beside the ok line | three-sentence slice |

### Red output, one slice at a time

Each was run before the code for it. Slice 1, bullets and colon inside (old regex):

```
AssertionError: - **Order**: A request to buy something.
- **Invoice**: A request for payment.
: expected a pass, got ["GLOSSARY.md: no entries: each term is a line starting **Term**: -> add an entry, or delete the file if the project has no glossary yet"]
(fail) a bold term with the colon inside or outside the bold, bare or as a list item, is an entry
 11 pass / 1 fail
```

Slice 2, headings:

```
AssertionError: heading per term: expected a pass, got ["GLOSSARY.md: no entries: each term is a line starting **Term**: -> ..."]
(fail) one heading per term followed by a paragraph is an entry when the file uses headings for terms
```
(a second red in that run was my own test's line number, 6 for 7; fixed in the test, not the code.)

Slice 3, rules, comments, fences (CRLF was already green: `trim()` handles `\r`, so it is a guard, and N08 below shows what pins it):

```
AssertionError: rules and comments: expected a pass, got ["GLOSSARY.md:5: text outside any entry: \"---\" -> ...","GLOSSARY.md:7: text outside any entry: \"<!-- keep sorted -->\" -> ...", ...]
(fail) rules, HTML comments and blank lines between entries are ignored
AssertionError: The input did not match the regular expression /GLOSSARY\.md: 1 entry,/.
(fail) a fenced block is skipped whole, wherever it is
```

Slice 4, warnings (no entry recognised, empty file, three sentences):

```
AssertionError: unknown style: expected a pass, got ["GLOSSARY.md: no entries: each term is a line starting **Term**: -> add an entry, or delete the file if the project has no glossary yet"]
AssertionError: empty: expected a pass, got ["GLOSSARY.md: no entries: ..."]
AssertionError: three sentences: expected a pass, got ["GLOSSARY.md:3: entry \"Order\" has 3 sentences; a definition is one or two -> cut it to the two that say what it is"]
 16 pass / 3 fail
```

Slice 5, colon rule and the malformed first entry (the M02 and review-case-10 tests), plus duplicates and the clean line:

```
AssertionError: Expected values to be strictly deep-equal:      (a bold term with no colon ... named in a warning)
AssertionError: colon: failed silently. No message matched /... entry "Item:" repeats .../   (my test expected the term text "Item:"; the message says "Item": test corrected)
 18 pass / 2 fail
```
The M12 sentence-boundary test passed on first run (a guard); the mutant run below is what shows it pins the lookahead.

Slice 8, unreadable and directory (guard removed again to show the red; restored):

```
EISDIR: illegal operation on a directory, read   code: "EISDIR"
(fail) a GLOSSARY.md that is a directory is a failure with a clear line, and the gate still finishes
EACCES: permission denied, open '.../GLOSSARY.md'   code: "EACCES"
(fail) an unreadable GLOSSARY.md is a failure, not a crash
(fail) the Stop hook carries a glossary failure to the model, including when the file cannot be read, and is silent on a warning
```

Follow-up red (empty `[ok]` for a file with no entry): `AssertionError: an [ok] line for a file with no entry` then fixed in `fe39d6a`.

Rule and comment survivors (N11, N12 first run) became tests ("a rule is not a definition", "a comment is not a definition") and then died.

### Mutants applied to a scratch clone, final run on the final source

Both runtimes run `tests/glossary.test.ts`. `mutants.py` and its output are in the scratchpad directory.

```
M02 colon optional: bun killed / node killed
M12 lowercase lookahead: bun killed / node killed
M18 ok line beside failures: bun killed / node killed
N04 colon-inside form dropped: bun killed / node killed
N05 list marker dropped: bun killed / node killed
N06 heading mode off: bun killed / node killed
N07 fence not skipped: bun killed / node killed
N08 lines not trimmed in boldEntries (CR and BOM stay): bun killed / node killed
N09 duplicates case-sensitive: bun killed / node killed
N10 trailing colon kept: bun killed / node killed
N11 rule not ignored: bun killed / node killed
N12 comment not ignored: bun killed / node killed
N13 no-entry warning is a failure: bun killed / node killed
N14 long definition is a failure: bun killed / node killed
N15 unreadable not caught: bun killed / node killed
N16 no definition not failing: bun killed / node killed
N17 delete hint on no definition: bun killed / node killed
N18 empty file warns: bun killed / node killed
N19 MAX_SENTENCES 3: bun killed / node killed
N20 no-colon warning dropped: bun killed / node killed
N21 grouping heading is an entry: bun killed / node killed
N23 warnings not printed beside ok: bun killed / node killed
N24 line numbers off by one: bun killed / node killed
N25 first-entry ENTRY only for bold, not heading dup: bun killed / node killed
```

Notes: the first run left N08 (CRLF), N11 and N12 alive; N22 (BOM) is an equivalent mutant, because `trim()` removes a BOM and the explicit strip I had written was dead code, so I removed the strip instead of keeping an untestable line. N10 would also have survived (the regex never leaves a trailing colon) until I added `**Item::**:` to the duplicates test.

## VERIFY

### 1. Suites

```
npm test, bun half (run 2):   616 pass   0 fail   Ran 616 tests across 28 files. [113.17s]
npm test, node half (run 2):  tests 616  pass 615  fail 1   (tests/costs.test.ts:698, load-sensitive, below)
npm run test:node alone:      tests 616  pass 616  fail 0
first npm test, at f840f44:   bun 616 pass 0 fail; node 615 pass 1 fail (costs.test.ts:698); isolated rerun of costs.test.ts: 31 pass 0 fail
bunx --bun tsc --noEmit:      rc 0
```

`tests/costs.test.ts:698` ("hook paths stay within budget on a 50 MB transcript") failed twice in a full `npm test` on the node half
(`took 258 ms against 205 ms`, then `290 ms against 223 ms`) and passed in isolation and in a node-only rerun (`616 pass 0 fail`), item 67, not caused by this diff.

`tests/glossary.test.ts` five times on each runtime, from the run in this session:

```
bun 1:  24 pass  0 fail   node 1: pass 24 fail 0
bun 2:  24 pass  0 fail   node 2: pass 24 fail 0
bun 3:  24 pass  0 fail   node 3: pass 24 fail 0
bun 4:  24 pass  0 fail   node 4: pass 24 fail 0
bun 5:  24 pass  0 fail   node 5: pass 24 fail 0
tsc=0
./bin/mstack lint-plugin .   ->  PASSED - 0 failures, 0 warnings
```

`./bin/mstack gate` on the last commit: 
```
[ok]    one active item: glossary-and-adr (in_progress)
[ok]    glossary-and-adr is in_progress; a verification run is due at verifying
-- glossary
[ok]    GLOSSARY.md: 14 entries, each a term with a one or two sentence definition
[ok]    on branch feat/glossary-and-adr
PASSED - 0 failures, 1 warning
```

Timing, 10 runs each after a warm-up, a 2,000-entry glossary (`big.md`), `time.sh`:

```
after none bun mean 111.9 ms
after none node mean 157.4 ms
after big bun mean 119.5 ms
after big node mean 163.8 ms
(before)
before none bun mean 112.7 ms
before none node mean 160.8 ms
before big bun mean 118.3 ms
before big node mean 164.1 ms
```
Before: 2,000 entries add 5.6 ms (bun) and 3.3 ms (node); after: 7.6 ms and 6.4 ms, on a 112 to 161 ms gate.

### 2. Real CLI, both runtimes, throwaway repositories

`cases.sh` (in the scratchpad) copies one throwaway repository per case, writes the glossary, and runs `bun src/cli.ts gate` and
`node --experimental-strip-types src/cli.ts gate`. Exit code 0 for every case except the six failures, and bun and node agree on exit code
and glossary lines in every case. The glossary lines are bun's.

```
### bullets   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
### bullets_below   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
### colon_inside   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
### heading_h2   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
### heading_h3   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
### table   rc bun=0 node=0   runtimes: same
[warn]  GLOSSARY.md: no entry recognised; entries are **Term**: or **Term:** (also as a list item) followed by the definition, or a ## Term or ### Term heading followed by a paragraph
### rule   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
### comment   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
### fence_after   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 1 entry, each a term with a one or two sentence definition
### fence_before   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 1 entry, each a term with a one or two sentence definition
### crlf   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
### crlf_bad   rc bun=1 node=1   runtimes: same
[fail]  GLOSSARY.md:6: entry "Receipt" has no definition
        fix: write one or two sentences under it, or remove the entry
### empty   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 0 entries, each a term with a one or two sentence definition
### title_only   rc bun=0 node=0   runtimes: same
[warn]  GLOSSARY.md: no entry recognised; entries are **Term**: or **Term:** (also as a list item) followed by the definition, or a ## Term or ### Term heading followed by a paragraph
### dir   rc bun=1 node=1   runtimes: same
[fail]  GLOSSARY.md could not be read (EISDIR)
        fix: make it a readable file
### unreadable   rc bun=1 node=1   runtimes: same
[fail]  GLOSSARY.md could not be read (EACCES)
        fix: make it a readable file
### no_definition   rc bun=1 node=1   runtimes: same
[fail]  GLOSSARY.md:6: entry "Receipt" has no definition
        fix: write one or two sentences under it, or remove the entry
### duplicate   rc bun=1 node=1   runtimes: same
[fail]  GLOSSARY.md:3: entry "item" repeats "Item" from line 1
        fix: merge the two or rename one
### duplicate_colon   rc bun=1 node=1   runtimes: same
[fail]  GLOSSARY.md:3: entry "Item" repeats "Item" from line 1
        fix: merge the two or rename one
### three_sentences   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 1 entry
[warn]  GLOSSARY.md:1: entry "Order" has 3 sentences; a definition is one or two
### malformed_first   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 1 entry
[warn]  GLOSSARY.md:3: "**Invoice** A bill sent after delivery." starts like an entry but has no colon after the term, so it is not counted
### no_colon_later   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 1 entry
[warn]  GLOSSARY.md:3: "**Invoice** A bill." starts like an entry but has no colon after the term, so it is not counted
### abbreviation   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 1 entry, each a term with a one or two sentence definition
### bom   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 1 entry, each a term with a one or two sentence definition
### reference_example   rc bun=0 node=0   runtimes: same
[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
```

The Stop hook, `printf '{"cwd":"%s","hook_event_name":"Stop"}' "$PWD" | ./bin/mstack hook stop`, one failure, one warning, one unreadable:

```
== no_definition   (failure)
[fail]  GLOSSARY.md:6: entry "Receipt" has no definition -> write one or two sentences under it, or remove the entry
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- GLOSSARY.md:6: entry \"Receipt\" has no definition -> write one or two sentences under it, or remove the entry"}}   rc=0
== three_sentences  (warning)
(no output at all)   rc=0
== table            (warning)
(no output at all)   rc=0
== dir              (unreadable)
[fail]  GLOSSARY.md could not be read (EISDIR) -> make it a readable file
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- GLOSSARY.md could not be read (EISDIR) -> make it a readable file"}}   rc=0
```

A warning does not reach the model: that is how `report.warn` behaves under the quiet gate for every warning, and the wiki says so.

### 3. Glossary and ADR tables, re-run after the final edit

Raw output of `tables.sh` (re-run after commit `370ded9`; the ADR commit `d9fb4ef` removed one clause, noted in the ADR table):

```
##### GLOSSARY

$ ./bin/mstack gate | rg -A1 '^-- glossary'
-- glossary
[ok]    GLOSSARY.md: 14 entries, each a term with a one or two sentence definition

$ rg -n 'seams\?' src/state.ts; rg -n 'no seam' skills/router/references/intake.md; rg -n 'quoting the user' skills/router/references/intake.md
38:  seams?: string[];
63:stdout``. No behaviour change, no seam: say why in `--description`.
52:  --acceptance "<observable criterion, quoting the user's words>" [...] \

$ rg -n 'title' src/state.ts | head -3; rg -n 'acceptance' src/state.ts | head -3
12:  title: string;
76:  if (item.title.trim() === "") throw new UserError("an item needs a title");
185:  if (typeof value["title"] !== "string" || value["title"].trim() === "") {
15:  acceptance: string[];
194:  const acceptance = value["acceptance"];
195:  if (!Array.isArray(acceptance) || acceptance.some((a) => typeof a !== "string")) {

$ rg -n 'one_active_item' src/gate.ts | head -3; rg -n 'one_active_item' src/state.ts | head -3
258:  if (!state.rules.one_active_item && active.length > 1) {
263:      `${active.length} items active with one_active_item off: ${active.map((i) => `${i.slug} (${i.status})`).join(", ")}`,
265:  } else if (state.rules.one_active_item && active.length > 1) {
49:    one_active_item: boolean;
145:      one_active_item: rules["one_active_item"] !== false,
234:const KNOWN_RULE_KEYS = new Set(["one_active_item", "require_verdict_to_close", "require_spec_for_sdd_items", "record_costs"]);

$ rg -n 'Intake\*\*: turn the request into a queue item' skills/router/SKILL.md; rg -n 'Fact|Reversible decision|Park a fork' skills/router/references/intake.md | head -4
21:3. **Intake**: turn the request into a queue item, by the method in
17:| **Fact**: the request, the repository, its docs or tests, or a convention the project already follows settles it | Find it. Never ask the user for one. |
19:| **Reversible decision**: the user's result is the same either way (where code lives, names, structure, internal approach), or only a message, label or format differs and follows what the project already prints | Tak
31:## Park a fork
77:and the user confirms. Facts are never asked. End with the same `state add`.

$ rg -n 'Fork\*\*: its answers change' skills/router/references/intake.md; rg -n 'Do not take it' skills/router/references/intake.md
18:| **Fork**: its answers change what the product's user can do or get (what is charged, allowed, refused, stored, deleted or returned as a value, including an exit code a script would branch on), or it cannot be undone
18:| **Fork**: its answers change what the product's user can do or get (what is charged, allowed, refused, stored, deleted or returned as a value, including an exit code a script would branch on), or it cannot be undone

$ rg -n 'A \*\*seam\*\* is where' skills/router/references/intake.md; rg -n 'Seam\*\*: where' skills/design/references/deep-modules.md
62:A **seam** is where the behaviour is observed, such as ``CLI: `mstack state add` exit code and
19:- **Seam**: where the module's interface lives, a place where behaviour can change without

$ rg -c '^[0-9]+\. ' skills/router/playbooks/*.md | tr '\n' ' '; echo; rg -n 'verbatim' skills/router/SKILL.md; rg -n 'skip: <reason>' skills/router/SKILL.md
skills/router/playbooks/resume.md:6 skills/router/playbooks/investigate.md:5 skills/router/playbooks/orchestrate.md:7 skills/router/playbooks/refactor.md:7 skills/router/playbooks/cleanup.md:6 skills/router/playbooks/dee
32:   verbatim, before any task-specific todos and before you reason about the task.**
27:   Say which in one line (`skip: <reason>`). It ends with
36:the list with a one-line `skip: <reason>`. Skipping silently is not allowed.

$ rg -n 'opt-in|different' skills/router/SKILL.md | head -4; rg -n 'acceptance. array is the contract' skills/router/SKILL.md
60:Most work goes straight to implementation. The spec path is opt-in, and it turns on when any
67:On the spec path, no code is written before `.mstack/specs/<slug>/` exists and a **different
88:- A second opinion means the same prompt against a *different model*. Agreement across models
68:pass** has approved it. On the direct path, the item's `acceptance` array is the contract.

$ rg -n 'separate passes' agents/implementer.md; rg -n 'did not write the code' skills/ship/SKILL.md
70:- Never implement and approve the same work. The separate passes exist to prevent that.
11:Safe means a verdict from a pass that did not write the code, recorded against **this** head

$ rg -n 'distinct lens' skills/review/SKILL.md; rg -n 'does not repeat|lens' agents/reviewer.md | head -3
23:3. Launch them in parallel, each with the full diff and a distinct lens. Give different lenses to
40:## The design lens
42:Only when your brief gives you the `design` lens: read
45:Judge what the diff changes and nothing around it. Without the lens, do not read that file.

$ rg -n 'sha' src/ledger.ts | head -3; sed -n 19,24p src/ledger.ts | head -0; rg -n 'live-verified|test-verified|type-check-only|verifier-blocked|verifier-failed' src/ledger.ts | head -5
37:export const HEADER = ["target", "sha", "verdict", "evidence", "verifier", "ts"] as const;
45:  sha: string;
55:function isCommit(store: Store, sha: string): boolean {
head: illegal line count -- 0
19:  "live-verified",
20:  "test-verified",
21:  "type-check-only",
22:  "verifier-blocked",
23:  "verifier-failed",

$ rg -n 'a verdict. by a pass|fact. about one command' src/verification.ts
29: * looked at the work; a receipt is a *fact* about one command exiting. Writing

$ rg -n 'IMPLEMENTING_ROLES|canCloseAnItem' src/roles.ts | head -4; rg -n 'closed on a verdict from the pass that wrote the code' src/*.ts | head -2
123:export const IMPLEMENTING_ROLES: ReadonlySet<string> = new Set(["implementer", "spec-author"]);
125:export function canCloseAnItem(verifier: string): boolean {
127:  return role !== "" && !IMPLEMENTING_ROLES.has(role);
166: * Like `canCloseAnItem` above, this is a floor and not a proof: it stops the
src/gate.ts:491:      `items closed on a verdict from the pass that wrote the code: ${selfClosed.join(", ")}`,

$ rg -n 'target sha command outcome ts tree|HEADER' src/verification.ts | head -3; rg -n 'ran, not that|a fact' src/verification.ts | head -2
45:export const HEADER = ["target", "sha", "command", "outcome", "ts", "tree"] as const;
314:  append(store.verification, HEADER, [

$ rg -n 'append' src/ledger.ts | head -2; cat .mstack/.gitattributes | rg ledger; rg -n 'only a later independent approval' src/closing.ts | head -1
5:import { append, readRecords } from "./tsv.ts";
97: * repository's append-only ledger) that is a prefix of the full sha. A string
ledger.tsv merge=union
130:      : `; it was recorded against another commit than the one being closed, and only a later independent approval answers it`;

$ rg -n '^\| [1-5] \|' skills/router/references/evidence-ladder.md; rg -n 'say where it stopped' skills/router/references/evidence-ladder.md; head -1 skills/router/references/evidence-ladder.md
8:| 1 | **You said so.** Worthless on its own. |
9:| 2 | **You pointed at the line.** A real `file:line`, or the dependency's own source. |
10:| 3 | **You showed the bad case cannot happen.** You walked the failure step by step and it does not reach. |
11:| 4 | **You ran it.** A script or test that calls the real code and fails loudly if you are wrong. |
12:| 5 | **You reproduced it in the running system.** |
4:and **say where it stopped**.
# The evidence ladder

$ rg -n 'checkWorkspace|checkStoreFiles|checkInvariants' src/gate.ts | head -4; rg -n 'exits 0 to go, 1 to wait, 2 to stop' skills/ship/SKILL.md; rg -n '"Stop"' -A6 hooks/hooks.json | rg 'hook|stop'
71:  checkStoreFiles(store, report);
76:    checkInvariants(store, state, report);
87:  checkWorkspace(store, report);
144:function checkStoreFiles(store: Store, report: Report): void {
21:4. `mstack merge-gate <pr>`. It exits 0 to go, 1 to wait, 2 to stop, and it prints every reason
47-        "hooks": [
51-            "args": ["hook", "stop"],

ledger rejection, live (throwaway):
recorded verifier-failed for alpha at 824d62a8
recorded test-verified for alpha at 824d62a8
FAIL verifier-failed at 824d62a8 by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/ev.md)
recorded test-verified for alpha at 824d62a8
PASS test-verified at 824d62a8 by reviewer

closing role, live: implementer-only row then done then gate:
  status: "verifying" -> "done"
[implementer] [fail]  items closed on a verdict from the pass that wrote the code: alpha (only implementer)|FAILED - 1 failure, 1 warning|
  status: "verifying" -> "done"
[coordinator] [ok]    1 closed item(s) carry a ledger verdict|PASSED - 0 failures, 1 warning|

##### ADR

$ git log --format='%h %ad %s' --date=short -- docs/adr/0001-claude-code-only.md | tail -1
6cc884e 2026-11-17 docs(adr): record that mstack targets Claude Code only

$ git reflog --date=iso | rg 'portable-core'
6687df2 HEAD@{2026-10-31 15:12:56 +0100}: checkout: moving from feat/portable-core to main
6687df2 HEAD@{2026-08-25 11:47:27 +0200}: checkout: moving from main to feat/portable-core

$ git reflog --date=iso | rg '2026-08-25' | rg 'commit:'
760a281 HEAD@{2026-08-25 12:40:25 +0200}: commit: feat: write grok hooks from setup that actually fire
087b535 HEAD@{2026-08-25 12:16:37 +0200}: commit: feat: ship plugin hooks as a single command string
e479734 HEAD@{2026-08-25 11:52:02 +0200}: commit: feat: add the agent plugins root manifest
9cb44df HEAD@{2026-08-25 11:51:53 +0200}: commit: feat: accept grok and cursor hook envelopes

$ for c in 9cb44df e479734 087b535 760a281; do printf '%s ' $c; git cat-file -t $c; done
9cb44df commit
e479734 commit
087b535 commit
760a281 commit

$ git branch -r --contains 760a281 | wc -l; git branch -a | rg -c portable-core
       0

$ git ls-tree -r --name-only 760a281 | rg -i 'cursor|grok|^plugin.json'
.grok-plugin/plugin.json
.grok/hooks/mstack.json
plugin.json

$ rg -n 'pstack' README.md | rg 'built on'; rg -n 'Cursor plugin' docs/wiki/The-Story.md
477:mstack is built on [pstack](https://github.com/cursor/plugins/tree/main/pstack) by
8:Cursor plugin by [Lauren Tan](https://github.com/poteto). The other is a spec-driven harness

$ rg -n -i 'grok|cursor|claude code only|portable-core' .mstack/decisions.tsv .mstack/progress/history.md CHANGELOG.md | cut -c1-110
CHANGELOG.md:8:  records that mstack targets Claude Code only, with the date and the trade-off. A new referenc

$ bat -pp ~/.claude/projects/-Users-romerma-Code-mstack/memory/claude-only-host.md | rg 'On 2026|Why'| cut -c1-300
On 2026-10-31 the user dropped `feat/portable-core` (Grok and Cursor hook envelopes, Agent Plugins root manifest, `.cursor-plugin/`, setup writing `.grok/` and `.cursor/` hook files): "este repo quedará solo para claude"
**Why:** product decision to keep mstack a Claude Code plugin only, after a 2-month pause; the port also had open defects (setup clobbered an existing `.cursor/hooks.json`, wrote machine-specific absolute binary paths).

$ rg -c '—|–' docs/adr/0001-claude-code-only.md GLOSSARY.md
```

#### Glossary, 14 entries, every statement

| Entry | Statement | Command or file:line | True |
|---|---|---|---|
| Item | a unit of work in the project's queue, with a title | `src/state.ts:12`, `:76` | yes |
| | acceptance criteria quoted from its source | `intake.md:52` "quoting the user's words"; `src/state.ts:15` | yes |
| | when it changes behaviour, the seams where it is tested | `src/state.ts:38` `seams?`; `intake.md:63` "No behaviour change, no seam" | yes |
| | by default only one is active in a working copy | `src/gate.ts:258-265`; `src/state.ts:145` default on, can be turned off | yes |
| Intake | the step that turns a request into a queue item | `skills/router/SKILL.md:21` | yes |
| | facts found, reversible decisions recorded, forks parked | `intake.md:17-19` Map, `:31` Park a fork | yes |
| Fork | answer changes what the user can do or get, or cannot be undone | `intake.md:18` | yes |
| | put to the user instead of taken by the agent | `intake.md:18` "Do not take it", `:31-44` | yes |
| Seam | the public surface where a behaviour is observed and a test attaches | `intake.md:54`, `:62` | yes |
| | in design vocabulary a place where behaviour can change without editing there | `skills/design/references/deep-modules.md:19` | yes |
| Playbook | a short numbered list of steps for one kind of request | `rg -c '^[0-9]+\. ' skills/router/playbooks/*.md`: 5 to 8 each | yes |
| | copied whole into the todo list | `skills/router/SKILL.md:31-32` "verbatim" | yes |
| | a step not done stays listed with the reason | `skills/router/SKILL.md:27`, `:36` `skip: <reason>` | yes |
| Spec path | opt-in; spec approved by a different pass before any code | `skills/router/SKILL.md:60`, `:67-68` | yes |
| | on the direct path the acceptance criteria are the contract | `skills/router/SKILL.md:68` | yes |
| Pass | one role's run over an item, such as implementing or reviewing | `agents/implementer.md:70` "The separate passes"; the role names in `src/roles.ts:123` | yes |
| | a verdict is meant to come from a pass that did not write the work | `skills/ship/SKILL.md:11` | yes |
| Lens | a distinct angle, such as correctness or security | `skills/review/SKILL.md:23`, `:26-27` | yes |
| | each reviewer on a panel is given its own | `skills/review/SKILL.md:23` "each ... a distinct lens" | yes |
| Verdict | a pass's recorded judgement at one commit | `src/ledger.ts:37` header has `sha` | yes |
| | that it holds, failed, or could not be checked | `src/ledger.ts:19-23` five values | yes |
| | a judgement of the work, where a receipt is a fact about a command | `src/verification.ts:28-30` | yes |
| Closing role | a role whose verdict can close an item: any named role except the implementer and the spec author | `src/roles.ts:123-127`; live: `[coordinator] [ok] 1 closed item(s) carry a ledger verdict PASSED` | yes |
| | their verdicts are recorded but leave a closed item red at the gate | live: `[implementer] [fail] items closed on a verdict from the pass that wrote the code: alpha (only implementer)`; `src/gate.ts:491` | yes |
| | the rule goes by the role's name, not by who wrote what | `src/roles.ts:118-128`, "a floor and not a proof" at `:166`; the `coordinator` row above | yes |
| Receipt | a recorded fact that a verification command ran, against which commit and working tree, and whether it passed | `src/verification.ts:45` `target sha command outcome ts tree` | yes |
| | it shows that something ran, not that the work is good | `src/verification.ts:28-30` | yes |
| Ledger | append-only record of verdicts, each tied to the commit it judged | `.mstack/.gitattributes` `ledger.tsv merge=union`; `src/ledger.ts:37` `sha` | yes |
| | a failed verdict stays; only a later independent approval answers it | live run: after `verifier-failed` by reviewer, `test-verified` by implementer: `FAIL verifier-failed ... rejects this commit`; by reviewer: `PASS`; `src/closing.ts:130` | yes |
| Rung | one of the five levels of the evidence ladder | `skills/router/references/evidence-ladder.md:8-12` | yes |
| | from having said so up to having reproduced it in the running system | `:8` "You said so", `:12` "You reproduced it in the running system" | yes |
| | a claim is reported with the rung where it stopped | `evidence-ladder.md:4` "say where it stopped" | yes |
| Gate | a check that is code instead of prose, red when the work breaks a rule | `skills/router/SKILL.md:116-117`, `src/gate.ts:38-53` | yes |
| | the session gate checks the working copy | `src/gate.ts:71`, `:76`, `:87` store, state and workspace checks | yes |
| | the merge gate decides whether a change may land | `skills/ship/SKILL.md:21` "exits 0 to go, 1 to wait, 2 to stop" | yes |

#### ADR, every sentence

| Sentence | Support, re-checked | True |
|---|---|---|
| "# mstack targets Claude Code only" | the note: "keep mstack a Claude Code plugin only" | yes |
| "Status: accepted. Decided 2026-10-31, written down 2026-11-17." | reflog `6687df2 HEAD@{2026-10-31 15:12:56 +0100}: checkout: moving from feat/portable-core to main`; `git log` first commit of the file `6cc884e 2026-11-17` | yes |
| "On 2026-10-31 the maintainer dropped the branch `feat/portable-core`, and mstack stays a Claude Code plugin only." | the note, and the same reflog line | yes |
| "By the project's note of that day, which is kept outside this repository, the branch held Grok and Cursor hook envelopes, an Agent Plugins root manifest, a `.cursor-plugin/` directory and a setup that wrote `.grok/` and `.cursor/` hook files." | the note's first line, same list; it is a memory file, not tracked (`git ls-files` does not list it). The four commits in this clone hold the envelope, root `plugin.json`, `.grok-plugin/`, `.grok/hooks` and a Grok setup, and no `.cursor-plugin/` (`git ls-tree -r --name-only 760a281`) | yes, as the note's list |
| "The decision came after a two-month pause," | the note: "after a 2-month pause"; reflog: last commit 2026-08-25 12:40, checkout away 2026-10-31 | yes |
| "and two defects in the port were still open: setup overwrote an existing `.cursor/hooks.json`, and it wrote absolute binary paths specific to one machine." | the note: "setup clobbered an existing `.cursor/hooks.json`, wrote machine-specific absolute binary paths" | yes, as the note |
| "Given up: running mstack on Grok or Cursor. Kept: one host to target." | follows from "Claude Code plugin only" in the note | yes |
| "The note records this as a product decision and gives no further reasoning, so this ADR adds none." | the note's **Why** line: "product decision ... after a 2-month pause; the port also had open defects", nothing else | yes |
| "The branch ref is gone, and none of its four commits in this clone is on a remote branch." | `git branch -a \| rg -c portable-core` prints nothing; `git branch -r --contains 760a281 \| wc -l` prints `0`; four commits in the reflog | yes |
| "In this clone the four commits are still in the object store (`git cat-file -t 760a281` prints `commit`)." | tables.out: all four print `commit` | yes |
| "The README says mstack is built on pstack, and `docs/wiki/The-Story.md` calls pstack a Cursor plugin." | `README.md:477` "mstack is built on [pstack]"; `The-Story.md:7-8` "pstack, a Cursor plugin" | yes |
| "The record names what was given up and what was kept." | the note | yes |
| "It names no alternative that was weighed." | `rg -n -i 'grok\|cursor\|claude code only\|portable-core'` over `decisions.tsv`, `history.md`, `CHANGELOG.md` returns only `CHANGELOG.md:8`, which names none; the note names none | yes, as a statement about those files |

I cut "until a gc prunes them" in `d9fb4ef`: no command in this session shows it.

## Decisions taken

Recorded with `./bin/mstack decide --phase implement` (seven rows): text outside an entry is no longer a failure and a bold line without a colon warns by name; heading mode only when no bold entry exists; "Evidence rung" renamed "Rung"; the ADR attributes the branch contents to the note and says the note is outside the repository; `intake.md` trimmed by one parenthetical; empty file passes with "0 entries"; CHANGELOG says what was given up, not the trade-off.

## Found and not fixed

- `src/roles.ts` closes on a role name only (`coordinator`, `self`, `impl` close with a green gate): item 82, not mine. The glossary says what it does today.
- An empty `GLOSSARY.md` prints `[ok] GLOSSARY.md: 0 entries, each a term with a one or two sentence definition`, which is vacuous. Left as decided (empty is not an unknown style).
- A comment or a rule directly under an entry's first line ends the entry (they become blank lines): `**Order**:` / `<!-- x -->` / `A request.` reads as no definition.
- On a case-insensitive file system `glossary.md` is read too (review non-blocking, unchanged).
- `.cursor-plugin/` is in the note's list and in none of the four commits left in this clone; the ADR says it is the note's list.
- Two sentences of the skills use glossary words in other senses (`skills/test-first/SKILL.md:11` "receipt", `skills/reflect/SKILL.md:25` "Verdict" column); not touched.
- I ran `sed -n` and used `/tmp` for one scratch copy (deleted) before catching myself; no effect on the repository.

## Verdict

`test-verified`: the glossary tests, both halves of the suite (after the load-sensitive rerun), typecheck, lint-plugin and the gate pass, and the CLI cases ran on both runtimes. Rung 4 for the check (tests and mutants), rung 5 for the CLI behaviour in throwaway repositories; rung 2 for the prose, which has no test.
