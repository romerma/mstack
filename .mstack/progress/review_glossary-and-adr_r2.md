# Review - glossary-and-adr, round 2

**Verdict:** CHANGES_REQUESTED

Reviewed alone, round 2, at `3a6fab426cef72b893d2085f0150016f2b97fcf1` (item base `5449746`,
round 1 reviewed at `4bf9aea`; `git diff 4bf9aea..3a6fab4 -- . ':!.mstack'`, 13 files, +413 -137).
Every claim below comes from a command I ran; the implementer's report was not used as evidence.
CLI probes ran in throwaway repositories under the scratchpad (`review58r2/`): a template made with
`git init`, a commit, this checkout's `setup` and a `feat/x` branch, copied once per case, with the
glossary committed. Gates ran as `bun src/cli.ts gate` and `node --disable-warning=ExperimentalWarning
--experimental-strip-types src/cli.ts gate` from this checkout. Scripts (`cases.mjs`, `run.sh`,
`hook.sh`, `closing.sh`, `mutants.mjs`, `time.mjs`) are in the scratchpad; mutants ran in a clone
there (`review58r2/clone`), restored after each, never in this working tree.

The machine was under heavy outside load for most of the run (`uptime` load averages 8.6 to 38,
Docker's `com.docker.sailor` at 577% CPU in `ps -r`). Timings and every bun timeout below are read
with that in mind, and each one is attributed by test name.

## Blocking findings

### 1. src/glossary.ts:16, 121-127: a bold label repeated under each term fails the gate as a repeated term

A glossary that puts a bold label such as `**Example:**`, `**Synonyms:**` or `**See also:**` under
each term is an ordinary hand-written style. Each such line matches `ENTRY` and becomes an entry
of its own, so the second label is "a term that repeats". It fails in all three layouts the check
recognises: bold entries, heading entries, and list items with nested labels.

```
$ bat -pp GLOSSARY.md                      # case 25
# G

**Order**: A request to buy something.
**Example:** order 1042.

**Invoice**: A bill sent after delivery.
**Example:** invoice 77.
$ bun src/cli.ts gate                       # node: same section, same summary
-- glossary
[fail]  GLOSSARY.md:7: entry "Example" repeats "Example" from line 4
        fix: merge the two or rename one
FAILED - 1 failure, 0 warnings              # rc 1 on bun and on node

# case 26: "## Order / A request to buy something. / **Example:** order 1042. / ## Invoice / A bill ... / **Example:** invoice 77."
[fail]  GLOSSARY.md:13: entry "Example" repeats "Example" from line 7        # rc 1/1
# case 28: "- **Order**: A request ... /   - **Synonyms:** purchase / - **Invoice**: A bill. /   - **Synonyms:** bill"
[fail]  GLOSSARY.md:6: entry "Synonyms" repeats "Synonyms" from line 4      # rc 1/1
```

The Stop hook carries it to the model at the end of every turn, with an instruction to change the
user's file:

```
$ printf '{"cwd":"<case 25>","hook_event_name":"Stop","session_id":"s","stop_hook_active":false}' | bun src/cli.ts hook stop
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- GLOSSARY.md:7: entry \"Example\" repeats \"Example\" from line 4 -> merge the two or rename one"}}
# node: the same stdout, rc 0
```

This is round 1's blocking 6 in a new form: the decided failures are an entry with no definition
and a repeated term, and this glossary has neither. **Fix:** "A bold `Label:` line inside an entry
(directly under its definition, indented under its list item, or under a `##`/`###` term heading)
is part of that entry and never a term of its own", with cases 25, 26 and 28 as tests.

### 2. src/glossary.ts:50-51: one bold line turns a heading-per-term glossary off, so its missing definitions and repeated terms pass

`headingEntries` runs only when `boldEntries` found nothing. A heading-per-term glossary with a
single bold line anywhere (a `**See also:**`, a `**Note:**`) is read in bold mode: its headings are
not entries, and the one bold line is reported as the whole glossary, under a clean line that is
false.

```
$ bat -pp GLOSSARY.md                      # case 39
# G

## Order

A request to buy something.

## Invoice

## Receipt

A record of a run.

**See also:** the README.
$ bun src/cli.ts gate
-- glossary
[ok]    GLOSSARY.md: 1 entry, each a term with a one or two sentence definition
PASSED - 0 failures, 0 warnings             # rc 0 on bun and on node

# the same file without the "See also" line is failed by the head, as tests/glossary.test.ts:201-202 pins:
[fail]  GLOSSARY.md:7: entry "Invoice" has no definition

# case 40: "# G / ## Order / A request to buy something. / ## Order / Again. / **Note:** kept short."
[ok]    GLOSSARY.md: 1 entry, each a term with a one or two sentence definition       # rc 0/0
```

That is the check passing an entry with no definition and a repeated term, the two things the
decision says it fails. `docs/wiki/Gates-and-Hooks.md:283-285`, `skills/reflect/references/domain-docs.md:23`
and `CHANGELOG.md:13-14` say one heading per term is recognised, with no condition. **Fix:** "A file
whose terms are `##`/`###` headings is read by its headings whatever bold lines it also has", with
cases 39 and 40 as tests. Findings 1 and 2 are one rule seen from two sides: a bold line inside an
entry belongs to that entry.

## Non-blocking findings

1. **A definition separated from its term line by an HTML comment, a rule or a blank line is
   reported as missing.** `**Order**:` / `<!-- reviewed 2026-11 -->` / `A request to buy
   something.` (case 11) renders as "Order: A request to buy something." and fails
   `GLOSSARY.md:3: entry "Order" has no definition`, fix "write one or two sentences under it, or
   remove the entry". The same with `***` (case 12) and with a blank line (case 10, two failures).
   `readable()` (`src/glossary.ts:150-165`) turns a comment or rule into a blank line, and a blank
   line ends an entry (`:117`). The blank-line case follows the documented format ("Entries are
   separated by blank lines", `domain-docs.md:23`). The comment case contradicts
   `Gates-and-Hooks.md:285` ("Rules, HTML comments and fenced blocks are skipped") and
   `domain-docs.md:26` ("are free"): directly under a term line they end it. Dropping such a line
   instead of blanking it, or naming what ended the entry in the message, would fix it; "remove the
   entry" is the wrong advice when the definition is right there.
2. **A duplicate written with emphasis or a code span passes.** `**Order**:` and `**_Order_**:`
   (case 21) or `` **`Order`**: `` (case 22): `[ok] 2 entries`. Outside the decided normalisation
   (case and a trailing colon), which `Gates-and-Hooks.md:287-288` states exactly, so not blocking;
   stripping `_`, `*` and backticks from the key would close it.
3. **`#word` at the start of a definition line is read as a heading.** `**Tag**:` / `#urgent and
   #later are examples of a label.` fails "has no definition" (case 31): `src/glossary.ts:117`
   tests `startsWith("#")`, while a Markdown heading needs a space after the hashes. Rare.
4. **A four-backtick fence containing a three-backtick line is misread** (case 36): the inner
   fence toggles `fenced` (`src/glossary.ts:155-157`) and `**Order**:` inside the block fails "has
   no definition". Rare.
5. **A dangling `GLOSSARY.md` symlink passes with no section** (`existsSync` is false,
   `src/gate.ts:106`), while `Gates-and-Hooks.md:288` says a file that "cannot be read ... is a
   failure that says so". Minor.
6. **An empty file prints `[ok] GLOSSARY.md: 0 entries, each a term with a one or two sentence
   definition`** (case 16). Vacuously true. Cosmetic.
7. **Mutants M26 and M43 survive and are worth one test each** (table below): at the head
   `**Order:**:` with nothing after it, and a `##` term with only an `_Avoid_:` line, both fail
   "has no definition" (pasted in Probe C); under the mutants both pass, and no test pins either.
   M28 and M39 matter little.
8. **The glossary tests time out on bun under load.** Ten runs each: node 10 of 10 green; bun 8 of
   10, runs 8 and 9 failing tests at 5,168 to 7,585 ms against bun's 5,000 ms default, with the load
   average between 17 and 38. Same family as item 67; a timeout on the tests that run several gates
   would remove it.
9. **ADR line 13, "In this clone the four commits are still in the object store (`git cat-file -t
   760a281` prints `commit`)".** True in this working copy, where the commit is reachable from no
   ref (`git fsck --unreachable --no-reflogs` lists it) and kept by the HEAD reflog alone. In any
   other clone the command prints `fatal: Not a valid object name 760a281` (a `git clone
   --no-local` of this checkout, Probe B), and a reflog expiry here would make it false too. A
   committed ADR read in another clone says "this clone" about the reader's own. "In the
   maintainer's working copy, when this was written" would keep it true.
10. **ADR: by its own last section the record does not establish conditions 1 and 3.** "Hard to
    reverse" is argued from git facts that, in this working copy, make a reversal one `git branch`;
    "real trade-off" says no alternative was weighed, where `domain-docs.md:34` asks that "one was
    picked for stated reasons". Criterion 2 requires this ADR, so the tension is in the item, and
    the ADR is right not to invent a reason. The reason is the maintainer's to give: one question
    to them, not a sentence by an agent.
11. **ADR line 5, the branch contents.** The four commits left here hold no `.cursor-plugin/` and
    no `.cursor/` writer (`git ls-tree -r --name-only 760a281` has no path containing `cursor`;
    `src/setup.ts` at `760a281` names only Grok), so the Cursor half of the list and the
    `.cursor/hooks.json` defect rest on the note alone. The ADR attributes the list to the note,
    which says exactly that, so the sentence holds; the defect sentence is in the ADR's own voice
    and could open "The note also records".
12. **Closing role leaves out the evidence rule.** A reviewer's `test-verified` whose evidence is
    `.mstack/progress/impl_alpha.md` is not independent (`ledger check`: "cites the implementer's
    own report ..., so it is not an independent approval"; `src/ledger.ts:232-237`). The entry
    defines the role and stays true; Verdict or Closing role could say an approval citing the
    author's own report does not count.
13. **No step before the review writes the glossary entry or ADR.** "It is written before the
    review of the item that introduced it" lives in the router's Closing step 1
    (`skills/router/SKILL.md:154-156`), `domain-docs.md:5` and `reflect/SKILL.md:45-48`. No playbook
    step before `/mstack:review` (`feature.md:30`, `bug-fix.md:20`, `refactor.md:16`) mentions it,
    and the Closing section is reached after the review, so in practice the entry goes into a
    follow-up item. Criterion 3 still holds (below); a line at the playbooks' review step, or
    "before launching the review" in the router, would make the order something a pass meets.
14. **`docs/wiki/How-A-Work-Item-Flows.md:174-190` still lists the base's four closing steps.** The
    router has had five since round 1 (step 1, glossary and ADR).
15. **Processes not mine.** `pgrep` at the start showed pids 6369 and 17416 (`until [ -z "$(pgrep
    -f mutants.py)" ]; do sleep 5; done`) and 91531 (`until rg -q "exit code" streams/h2.out ...`
    under `impl73r2`), from earlier agents. I left them as found.

## Probe A: the glossary, every statement, at the head

`GLOSSARY.md`, 14 entries. Sentence counts are mine, by reading; the gate agrees (`[ok]
GLOSSARY.md: 14 entries, each a term with a one or two sentence definition`, no warning, in this
checkout and in a throwaway repository on both runtimes). No entry names a file, flag, status or
function. The six terms the criterion names (item, verdict, closing role, receipt, fork, seam) are
present.

| Entry (sentences) | Statement | Command or file:line | Verdict |
|---|---|---|---|
| Item (2) | a unit of work in the project's queue, with a title | `src/cli.ts:442,455` "state add needs --slug and --title", "an item needs a title" | true |
| | acceptance criteria quoted from its source | `intake.md:52` "quoting the user's words"; `src/gate.ts:247-251` fails an empty list, fix "quote the acceptance criteria from the source" | true |
| | and, when it changes behaviour, the seams where it is tested | `intake.md:54` `--seam "<public surface where a test attaches>"`, `:62-63` "No behaviour change, no seam"; `feature.md:17-19` | true |
| | By default only one item is active at a time in a working copy | default is the rule `one_active_item`, true unless `false` (`src/state.ts:145`, `src/setup.ts:112`); throwaway store: `state set a1/a2 --status in_progress` both rc 0, gate `[fail] 2 items are active in this worktree`; rule off: `[warn] 2 items active with one_active_item off`, PASSED. Enforced by the gate (`src/gate.ts:258-268`), not by `state set` | true as the default rule |
| Intake (2) | the step that turns a request into a queue item | `skills/router/SKILL.md:21-22` "Intake: turn the request into a queue item"; `intake.md:5` | true |
| | facts are found, reversible decisions are recorded and forks are parked | `intake.md:17-19` (Fact: find it; Reversible: record it; Fork: park it); router `:29-30` | true |
| Fork (1) | a decision whose answer changes what the product's user can do or get, or that cannot be undone | `intake.md:18` | true |
| | so it is put to the user instead of being taken by the agent | `intake.md:18` "Park it on the item. Do not take it."; `:35` "The user hears every fork once" | true |
| Seam (2) | the public surface where a behaviour is observed and a test attaches | `intake.md:54`, `:62` "A seam is where the behaviour is observed" | true |
| | in design vocabulary also a place where behaviour can change without editing there | `skills/design/references/deep-modules.md:19-20` "a place where behaviour can change without editing there" | true |
| Playbook (2) | a short numbered list of steps for one kind of request | `skills/router/playbooks/*.md` (8 files, numbered); route table `SKILL.md:40-53` | true |
| | copied whole into the todo list; a step not done stays listed with the reason it was skipped | `SKILL.md:31-36` "copy ... verbatim", "stays in the list with a one-line `skip: <reason>`" | true |
| Spec path (2) | the opt-in route on which a specification is written and approved by a different pass before any code | `SKILL.md:60-68` "The spec path is opt-in", "no code is written before ... a **different pass** has approved it" | true |
| | on the direct path the item's acceptance criteria are the contract | `SKILL.md:68` | true |
| Pass (2) | one role's run over an item, such as implementing or reviewing | `skills/review/SKILL.md:36,44` "a second pass", "the pass that formed the verdict"; router `:67` | true |
| | a verdict is meant to come from a pass that did not write the work | `skills/ship/SKILL.md:11` | true |
| Lens (2) | a distinct angle, such as correctness or security, from which one pass examines the same work | `skills/review/SKILL.md:23-31` | true |
| | each reviewer on a panel is given its own | `review/SKILL.md:23` "each with the full diff and a distinct lens" | true |
| Verdict (2) | a pass's recorded judgement of the work at one commit | ledger row carries `sha` (`src/ledger.ts:37`) | true |
| | that it holds, that it failed, or that it could not be checked | `mstack help` verdicts: live/test-verified and type-check-only, verifier-failed, verifier-blocked; `evidence-ladder.md:35-41` | true |
| | a judgement of the work, where a receipt is only a fact about a command | `src/verification.ts:28-29` | true |
| Closing role (2) | a role whose verdict can close an item: any named role except the implementer and the spec author | `src/roles.ts:123-128`; `closing.sh` below: `coordinator`, `self`, `impl`, `reviewer` close with the gate green; `implementer`, `spec-author`, `mstack:implementer`, `Implementer` and an empty name do not | true |
| | whose verdicts are recorded but leave a closed item red at the gate | same run: `state set --status done` rc 0, then `[fail] items closed on a verdict from the pass that wrote the code: alpha (only implementer)` | true |
| | the rule goes by the role's name, not by who wrote what | `self` and `impl` close green | true (an approval citing the author's report is discounted by a separate rule: non-blocking 12) |
| Receipt (2) | a recorded fact that a verification command ran, against which commit and working tree, and whether it passed | `src/verification.ts:45` `target sha command outcome ts tree`, `:47` `"passed" \| "failed"` | true |
| | shows that something ran, not that the work is good | `src/verification.ts:28-29` | true |
| Ledger (2) | the append-only record of verdicts, each tied to the commit it judged | `ledger record` appends a row with the sha (`src/ledger.ts:105-140`) | true |
| | a failed verdict stays in it, and only a later independent approval answers it | run below: FAIL after `verifier-failed`, after a `verifier-blocked`, after an implementer `test-verified`; PASS only after a reviewer `test-verified` | true |
| Rung (2) | one of the five levels of the evidence ladder, from having said so up to having reproduced it in the running system | `evidence-ladder.md:6-12` (1 "You said so", 5 "You reproduced it in the running system") | true |
| | a claim is reported together with the rung where it stopped | `evidence-ladder.md:3-4`; router `:121-122` "Five rungs, and you say where yours stopped" | true |
| Gate (2) | a check that is code instead of prose, and that goes red when the work breaks a rule | router `:116-117` | true |
| | the session gate checks the working copy | `mstack help` "fast session gate"; sections store, state, glossary, workspace (branch, clean tree) | true |
| | the merge gate decides whether a change may land | `skills/ship/SKILL.md:21` `mstack merge-gate <pr>` exits 0 to go, 1 to wait, 2 to stop | true |

"Rung" is how the skills say it: `agents/implementer.md:53` "Be honest about the rung",
`agents/reviewer.md:97-98`, `skills/review/SKILL.md:56`, `skills/verify/SKILL.md:18,23`, router `:122`,
`skills/router/playbooks/investigate.md:13-14`, against the ladder's own column header "Rung"
(`evidence-ladder.md:6`).

Closing role, reproduced (`closing.sh`: one fresh store per name, item `alpha` at `verifying` with
a passing receipt, one `test-verified` row by that name, then `state set --status done` and
`gate`):

```
[implementer]        ledger check: PASS test-verified at 615fee29 by implementer (the author's own verdict, not an independent approval)
                     state set done rc=0   gate rc=1: [fail] items closed on a verdict from the pass that wrote the code: alpha (only implementer)
[spec-author]        state set done rc=0   gate rc=1: ... alpha (only spec-author)
[mstack:implementer] state set done rc=0   gate rc=1: ... alpha (only mstack:implementer)
[Implementer]        state set done rc=0   gate rc=1: ... alpha (only Implementer)
[coordinator]        ledger check: PASS test-verified at f297927a by coordinator      state set done rc=0   gate rc=0: [ok] 1 closed item(s) carry a ledger verdict
[self]               ledger check: PASS test-verified at 065e2e40 by self             state set done rc=0   gate rc=0: [ok] ...
[impl]               ledger check: PASS test-verified at 064d557b by impl             state set done rc=0   gate rc=0: [ok] ...
[reviewer]           ledger check: PASS test-verified at 6d1584f3 by reviewer         state set done rc=0   gate rc=0: [ok] ...
[]                   ledger check: PASS ... by unknown (the author's own verdict ...)  state set done rc=0   gate rc=1: ... alpha (only unnamed)
```

Ledger, reproduced on the `coordinator` store:

```
after verifier-failed   by reviewer    -> FAIL verifier-failed at f297927a by reviewer rejects this commit, whatever an implementing role recorded (evidence: docs/review-evidence.md)
after verifier-blocked  by reviewer    -> FAIL ... ; the later verifier-blocked by reviewer (evidence: docs/review-evidence.md) does not answer it
after test-verified     by implementer -> FAIL ... (same)
after test-verified     by reviewer    -> PASS test-verified at f297927a by reviewer
```

## Probe B: the ADR, every sentence

The record: the project's note of 2026-10-31 (`claude-only-host`, outside the repository), whose
text is "On 2026-10-31 the user dropped `feat/portable-core` (Grok and Cursor hook envelopes, Agent
Plugins root manifest, `.cursor-plugin/`, setup writing `.grok/` and `.cursor/` hook files) ...
**Why:** product decision to keep mstack a Claude Code plugin only, after a 2-month pause; the port
also had open defects (setup clobbered an existing `.cursor/hooks.json`, wrote machine-specific
absolute binary paths)", and what git shows:

```
$ git reflog --date=iso | rg 'portable-core|9cb44df|e479734|087b535|760a281'
6687df2 HEAD@{2026-10-31 15:12:56 +0100}: checkout: moving from feat/portable-core to main
760a281 HEAD@{2026-08-25 12:40:25 +0200}: commit: feat: write grok hooks from setup that actually fire
087b535 HEAD@{2026-08-25 12:16:37 +0200}: commit: feat: ship plugin hooks as a single command string
e479734 HEAD@{2026-08-25 11:52:02 +0200}: commit: feat: add the agent plugins root manifest
9cb44df HEAD@{2026-08-25 11:51:53 +0200}: commit: feat: accept grok and cursor hook envelopes
6687df2 HEAD@{2026-08-25 11:47:27 +0200}: checkout: moving from main to feat/portable-core
$ for c in 9cb44df e479734 087b535 760a281; do printf '%s %s | remote branches containing: [%s]\n' $c "$(git cat-file -t $c)" "$(git branch -r --contains $c)"; done
9cb44df commit | remote branches containing: []
e479734 commit | remote branches containing: []
087b535 commit | remote branches containing: []
760a281 commit | remote branches containing: []
$ git show-ref | rg -i portab; echo rc=$?
rc=1
$ git fsck --unreachable --no-reflogs | rg -c 760a281
1
$ git clone -q --no-local /Users/romerma/Code/mstack nolocal && git -C nolocal cat-file -t 760a281
fatal: Not a valid object name 760a281
$ git ls-tree -r --name-only 760a281 | rg -i 'cursor|grok|plugin\.json'
.claude-plugin/plugin.json
.grok-plugin/plugin.json
.grok/hooks/mstack.json
plugin.json
$ git show 760a281:src/setup.ts | rg -c -i cursor; echo rc=$?
rc=1
$ rg -n 'mstack is built on' README.md; rg -n 'Cursor plugin' docs/wiki/The-Story.md
477:mstack is built on [pstack](https://github.com/cursor/plugins/tree/main/pstack) by
8:Cursor plugin by [Lauren Tan](https://github.com/poteto). The other is a spec-driven harness
```

(`The-Story.md:7-8` reads "One is [pstack](...), a / Cursor plugin by Lauren Tan". A default `git gc`
on a copy of `.git` left `760a281` in place, so the sentence is not false here today.)

| Line | Sentence | Record or command | Verdict |
|---|---|---|---|
| 1 | "mstack targets Claude Code only" | note: "este repo quedará solo para claude" | supported |
| 3 | "Status: accepted. Decided 2026-10-31, written down 2026-11-17." | note dated 2026-10-31; reflog checkout away 2026-10-31 15:12:56; first ADR commit `6cc884e` 2026-11-17 | supported |
| 5 | "On 2026-10-31 the maintainer dropped the branch `feat/portable-core`, and mstack stays a Claude Code plugin only." | note; no ref left (`show-ref` rc 1) | supported |
| 5 | "By the project's note of that day, which is kept outside this repository, the branch held Grok and Cursor hook envelopes, an Agent Plugins root manifest, a `.cursor-plugin/` directory and a setup that wrote `.grok/` and `.cursor/` hook files." | the note's list, item by item; the commits show the Grok and manifest half and no Cursor file, and the sentence attributes the list to the note | supported (non-blocking 11) |
| 5 | "The decision came after a two-month pause, and two defects in the port were still open: setup overwrote an existing `.cursor/hooks.json`, and it wrote absolute binary paths specific to one machine." | note "after a 2-month pause"; reflog: last commit 2026-08-25 12:40, branch left 2026-10-31 15:12, 67 days; the two defects as the note states them | supported |
| 7 | "Given up: running mstack on Grok or Cursor. Kept: one host to target." | entailed by the decision; no motive | supported |
| 9 | "The note records this as a product decision and gives no further reasoning, so this ADR adds none." | note's Why: "product decision ..., after a 2-month pause; the port also had open defects", all three already stated at line 5; nothing beyond | supported |
| 13 | "The branch ref is gone, and none of its four commits in this clone is on a remote branch." | `show-ref` rc 1; `branch -r --contains` empty for all four | true |
| 13 | "In this clone the four commits are still in the object store (`git cat-file -t 760a281` prints `commit`)." | true in this working copy, reachable from no ref; `fatal` in a transport clone | true here; non-blocking 9 |
| 14 | "The README says mstack is built on pstack, and `docs/wiki/The-Story.md` calls pstack a Cursor plugin." | `README.md:477`; `The-Story.md:7-8` | true, verbatim sense |
| 15 | "The record names what was given up and what was kept. It names no alternative that was weighed." | the note names the dropped port and the decision, and no weighing | true |

No sentence supplies a motive or contradicts the record; round 1's three (two months of work, the
upkeep rationale, a port starting from nothing) are gone (`git diff 4bf9aea..3a6fab4 --
docs/adr/0001-claude-code-only.md`).

**Criterion 2, "the trade-off": yes, met as far as the record allows.** A trade-off is what was
given up for what was kept, and line 7 states both, from the record. The record has no motive, and
the ADR says so instead of writing one; an ADR that invented a reason to satisfy the word would be
the worse defect, and that was round 1's blocking 4. What the ADR cannot show is the source's
third condition, "one was picked for stated reasons" (non-blocking 10): that is the maintainer's to
add.

## Probe C: the gate check, real CLI, both runtimes, throwaway repositories

`run.sh`: one fresh copy of the template per case, `GLOSSARY.md` committed, `gate` on bun and on
node. Both runtimes gave the same exit code and summary in every case, and `cmp` of the two
glossary sections printed "identical" for all of them. The section shown is bun's.

| # | Case | rc bun/node | Glossary section | Right? |
|---|---|---|---|---|
| - | no `GLOSSARY.md` | 0/0 | no section | yes |
| - | this repository's `GLOSSARY.md` | 0/0 | `[ok] GLOSSARY.md: 14 entries, each a term with a one or two sentence definition` | yes, no warning |
| - | the reference's ```` ```md ```` example (`domain-docs.md:11-21`) | 0/0 | `[ok] GLOSSARY.md: 2 entries, each a term ...` | yes, no warning (pinned by `tests/glossary.test.ts:162-176`) |
| 01 | `**Order**: ...` x2 | 0/0 | `[ok] 2 entries, each a term ...` | yes |
| 02 | `**Order:** ...` x2 | 0/0 | `[ok] 2 entries ...` | yes |
| 03 | `- **Order**: ...` list | 0/0 | `[ok] 2 entries ...` | yes |
| 04 | `## Order` / paragraph per term | 0/0 | `[ok] 2 entries ...` | yes |
| 05 | prose, `## The work`, bold entries, `## The proof`, bold entries, `### Notes` with three sentences of prose | 0/0 | `[ok] 2 entries ...` | yes (the mixed form this repository uses) |
| 06 | a `\| Term \| Meaning \|` table | 0/0 | `[warn] GLOSSARY.md: no entry recognised; entries are **Term**: or **Term:** (also as a list item) followed by the definition, or a ## Term or ### Term heading followed by a paragraph` | yes (decided warning) |
| 07 | definition list `Order` / `: A request ...` | 0/0 | the same warning | yes (decided warning) |
| 08 | list items with nested plain bullets | 0/0 | `[ok] 2 entries ...` | yes |
| 09 | `**Order**:` / definition on the next line | 0/0 | `[ok] 2 entries ...` | yes |
| 10 | `**Order**:` / blank line / definition | 1/1 | `:3 entry "Order" has no definition`, `:7 entry "Invoice" has no definition` | as documented, misleading (non-blocking 1) |
| 11 | `**Order**:` / `<!-- reviewed 2026-11 -->` / definition | 1/1 | `:3 entry "Order" has no definition` | wrongly failed (non-blocking 1) |
| 12 | `**Order**:` / `***` / definition | 1/1 | `:3 entry "Order" has no definition` | defensible (non-blocking 1) |
| 13 | ```` ```md ```` block with `**Order**:`, `**Invoice**:`, `- **Item**: x` after an entry | 0/0 | `[ok] 2 entries ...` | yes (round 1's case 13 fixed) |
| 14 | the same block before the first entry | 0/0 | `[ok] 1 entry ...` | yes (round 1's case 14 fixed) |
| 15 | CRLF line endings | 0/0 | `[ok] 2 entries ...` | yes |
| 16 | empty file | 0/0 | `[ok] GLOSSARY.md: 0 entries, each a term with a one or two sentence definition` | yes (decided), wording odd (non-blocking 6) |
| 17 | `# Glossary` only | 0/0 | the no-entry warning | yes (decided) |
| 18 | `**Order**:` and `**ORDER**:` | 1/1 | `:3 entry "ORDER" repeats "Order" from line 1`, fix `merge the two or rename one` | yes |
| 19 | `**Order**:` and `**Order:**:` | 1/1 | `:3 entry "Order" repeats "Order" from line 1` | yes (round 1's case 4 fixed) |
| 20 | `**Order**:` and `** Order **:` | 1/1 | `:3 entry "Order" repeats "Order" from line 1` | yes |
| 21 | `**Order**:` and `**_Order_**:` | 0/0 | `[ok] 2 entries ...` | misses a duplicate (non-blocking 2) |
| 22 | `**Order**:` and `` **`Order`**: `` | 0/0 | `[ok] 2 entries ...` | misses a duplicate (non-blocking 2) |
| 23 | `**Invoice**:` with no definition last, trailing newline | 1/1 | `:3 entry "Invoice" has no definition` | yes |
| 24 | the same with no trailing newline | 1/1 | `:3 entry "Invoice" has no definition` | yes |
| 25 | bold entries, each with an `**Example:**` line | 1/1 | `:7 entry "Example" repeats "Example" from line 4` | **wrongly failed: blocking 1** |
| 26 | heading entries, each with an `**Example:**` line | 1/1 | `:13 entry "Example" repeats "Example" from line 7` | **wrongly failed: blocking 1** |
| 27 | heading entries plus one `**See also:**` line | 0/0 | `[ok] 1 entry, each a term ...` | wrong count, headings unread (blocking 2) |
| 28 | list items, each with a nested `- **Synonyms:**` | 1/1 | `:6 entry "Synonyms" repeats "Synonyms" from line 4` | **wrongly failed: blocking 1** |
| 29 | `**Order** - A request ...` (no colon) | 0/0 | no-entry warning plus `:3 "**Order** - A request to buy something." starts like an entry but has no colon after the term, so it is not counted` and the same for `:5` | yes (decided warning) |
| 30 | three sentences | 0/0 | `[ok] GLOSSARY.md: 1 entry` and `[warn] GLOSSARY.md:1: entry "Order" has 3 sentences; a definition is one or two` | yes; no "each a term with" claim beside it |
| 31 | `**Tag**:` / `#urgent and #later ...` | 1/1 | `:1 entry "Tag" has no definition` | wrongly failed, rare (non-blocking 3) |
| 32 | `## Order` and `## Order:` | 1/1 | `:5 entry "Order:" repeats "Order" from line 1` | yes |
| 33 | `#### Order` only | 0/0 | the no-entry warning | yes, as documented (`##` or `###`) |
| 34 | `**Order**:` / `_Avoid_: Purchase` only | 1/1 | `:1 entry "Order" has no definition` | yes |
| 35 | UTF-8 BOM | 0/0 | `[ok] 1 entry ...` | yes |
| 36 | ````` ````md ````` block containing a ```` ``` ```` block | 1/1 | `:5 entry "Order" has no definition` | wrongly failed, rare (non-blocking 4) |
| 37 | `## Order` / `- A request ...` | 0/0 | `[ok] 2 entries ...` | yes |
| 38 | 2,000 entries (123,786 bytes) | 0/0 | `[ok] 2000 entries, each a term ...` | yes |
| 39 | heading entries, one with no definition, plus one `**See also:**` | 0/0 | `[ok] 1 entry, each a term with a one or two sentence definition` | **passes a missing definition: blocking 2** |
| 40 | a repeated heading term plus one `**Note:**` | 0/0 | `[ok] 1 entry, each a term ...` | **passes a duplicate: blocking 2** |
| 41 | an entry, then a separate three-sentence paragraph | 0/0 | `[ok] 2 entries ...` | yes (prose after a blank line is free) |
| - | round 1 case 10: `**Invoice** A bill ...` before a good entry | 0/0 | `[ok] GLOSSARY.md: 1 entry`, `[warn] GLOSSARY.md:3: "**Invoice** A bill sent after delivery." starts like an entry but has no colon ...` | yes (decided warning) |
| - | round 1 case 22: `---` between two sections of entries | 0/0 | `[ok] 2 entries ...` | yes (fixed) |
| - | round 1 case 23: `<!-- keep sorted -->` between entries | 0/0 | `[ok] 2 entries ...` | yes (fixed) |
| - | `**Order:**:` with nothing after it | 1/1 | `:1 entry "Order" has no definition` | yes (unpinned: M26) |
| - | `## Order` / `_Avoid_: Purchase` only | 1/1 | `:1 entry "Order" has no definition` | yes (unpinned: M43) |
| - | the wiki's example (`# G`, three sentences on line 3, `**Receipt**:` on line 5) | 1/1 | `[fail] GLOSSARY.md:5: entry "Receipt" has no definition` / `fix: write one or two sentences under it, or remove the entry` / `[warn] GLOSSARY.md:3: entry "Order" has 3 sentences; a definition is one or two` | matches `Gates-and-Hooks.md:296-300` exactly |
| - | dangling symlink | 0/0 | no section | silent (non-blocking 5) |
| - | `GLOSSARY.md` is a directory | 1/1 | `[fail] GLOSSARY.md could not be read (EISDIR)` / `fix: make it a readable file`; the workspace section and the summary still print | yes (round 1 crash fixed) |
| - | `GLOSSARY.md` mode 000 | 1/1 | `[fail] GLOSSARY.md could not be read (EACCES)` / `fix: make it a readable file` | yes (round 1 crash fixed) |

No message tells the reader to delete the file: `rg -n -i 'delete|remove' src/glossary.ts` prints
only `82: fix: "write one or two sentences under it, or remove the entry"`, and the glossary part of
`src/gate.ts` (lines 96-130) has neither word.

Wrongly failed reasonable glossaries: cases 25, 26, 28 (blocking 1), and 11 (non-blocking). Wrongly
passed broken ones: cases 39 and 40 (blocking 2), and 21 and 22 (non-blocking).

### What reaches the model through the Stop hook

`hook.sh`: `{"cwd":"<case>","hook_event_name":"Stop","session_id":"s","stop_hook_active":false}` on
stdin to `src/cli.ts hook stop`, both runtimes, the same input shape as `stop({ cwd })` in
`tests/glossary.test.ts:345-367`. Bun and node printed the same bytes in every case.

```
== 25-example-labels-bold
  bun rc=0 stdout={"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- GLOSSARY.md:7: entry \"Example\" repeats \"Example\" from line 4 -> merge the two or rename one"}}
  bun stderr=[fail]  GLOSSARY.md:7: entry "Example" repeats "Example" from line 4 -> merge the two or rename one
== 10-def-after-blank
  bun rc=0 stdout={"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- GLOSSARY.md:3: entry \"Order\" has no definition -> write one or two sentences under it, or remove the entry\n- GLOSSARY.md:7: entry \"Invoice\" has no definition -> write one or two sentences under it, or remove the entry"}}
== 06-table                      (a warning)
  bun rc=0 stdout=<empty>
  bun stderr=
== 30-three-sentences            (a warning)
  bun rc=0 stdout=<empty>
  bun stderr=
== directory
  bun rc=0 stdout={"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- GLOSSARY.md could not be read (EISDIR) -> make it a readable file"}}
```

A failure reaches the model; a warning reaches neither the model nor the transcript, as
`Gates-and-Hooks.md:291-292` says.

### Timing

`time.mjs`, ten runs each after a warm-up, wall clock of `gate`:

```
run 1:             none bun 98.7 ms  node 167.8 ms | repo-glossary bun 109.4  node 172.8 | 2000-entries bun 113.5  node 702.8
run 2 (load 8.6):  none bun 482.7 ms node 784.0 ms | repo-glossary bun 492.8  node 765.8 | 2000-entries bun 510.0  node 785.6
```

The two runs disagree by four times on the same files, so the CLI numbers measure the load. In
process, `readGlossary` on the 2,000-entry file: bun 11.4 ms, node 7.3 ms per read (mean of 21,
`bench.ts`). The check costs about 10 ms at 2,000 entries.

### Mutants

`mutants.mjs`: one mutant at a time on `review58r2/clone` at `3a6fab4`, the file restored after each
(`git -C clone status --short` empty at the end), `tests/glossary.test.ts` on bun and on node; the
survivors then ran the full suite on both runtimes. M02, M12 and M18 are round 1's, rewritten for
the new code with the same intent (round 1's exact strings no longer occur in the file).

| Mutant | glossary.test bun / node | Killed by | Full suite bun / node | Matters? |
|---|---|---|---|---|
| M02 colon optional in `ENTRY` (`(?:\*\*:?\|:\*\*)`) | killed / killed | "a bold term with no colon is not an entry and is named in a warning" | | round 1 survivor, now pinned |
| M12 sentence split lookahead dropped | killed / killed | "a sentence ends before a capital ... 'approx. ten' is one sentence" | | round 1 survivor, now pinned |
| M18 `[ok]` printed beside failures (the `problems.length > 0` return removed) | killed / killed | "a failure leaves no clean line behind ..." | | round 1 survivor, now pinned |
| M23 no `- ` list marker in `ENTRY` | killed / killed | "a bold term with the colon inside or outside the bold, bare or as a list item"; "Windows line endings" | | |
| M24 `**Term:**` form dropped | killed / killed | the forms test; "a failure leaves no clean line" | | |
| M25 duplicate key keeps a trailing colon | killed / killed | "a failure leaves no clean line ... trailing colon" | | |
| M26 leading colons of the rest not stripped | SURVIVED / SURVIVED | | bun: 1 fail, "a citation is the exact report filename ..." (times out at the head too, below); node: 1 fail | some: `**Order:**:` with nothing after it would pass (head fails it, Probe C) |
| M27 heading mode never used | killed / killed | "one heading per term ..." | | |
| M28 `####` accepted as a term heading | SURVIVED / SURVIVED | | bun: 1 fail, "ledger check and the gate's closing audit agree ..." (times out at the head too); node: 1 fail | little |
| M29 a grouping heading read as an entry | killed / killed | "one heading per term ..." | | |
| M30 fences not skipped | killed / killed | "a fenced block is skipped whole, wherever it is" | | |
| M31 comments not skipped | killed / killed | "rules, HTML comments and blank lines between entries are ignored" | | |
| M32 rules not skipped | killed / killed | the same test | | |
| M33 the no-entry warning dropped | killed / killed | "a file in which no entry is recognised warns once ..." | | |
| M34 the no-entry warning on an empty file | killed / killed | "an empty GLOSSARY.md is not an unknown style" | | |
| M35 a long definition fails instead of warning | killed / killed | "a definition of three sentences warns ..."; "approx. ten" | | |
| M36 `MAX_SENTENCES = 3` | killed / killed | the same two | | |
| M37 the no-colon warning dropped | killed / killed | "a bold term with no colon ..." | | |
| M38 the read unguarded (`throw error` in the catch) | killed / killed | the directory, mode 000 and Stop hook tests | | |
| M39 no warnings printed beside failures | SURVIVED / SURVIVED | | bun: 1 fail, "ledger check and the gate's closing audit agree ..."; node: 1 fail | little: the wiki's own example (`Gates-and-Hooks.md:296-300`) shows a warning beside a failure, and nothing pins it |
| M40 `[ok]` printed for a file with no recognised entry | killed / killed | "a file in which no entry is recognised ... an [ok] line" | | |
| M41 warnings reported as failures | killed / killed | five tests | | |
| M42 a heading does not end an entry (bold mode) | killed / killed | "the _Avoid_ line ..., and a heading ends the entry above it" | | |
| M43 `_Avoid_` counted as definition in heading mode | SURVIVED / SURVIVED | | bun: 1 fail, "ledger check and the gate's closing audit agree ..."; node: 1 fail, "hook paths stay within budget on a 50 MB transcript (9109.553417ms)" | some: a `##` term with only an `_Avoid_:` line would pass (head fails it, Probe C) |
| M44 no `continue` after a duplicate | killed / killed | "a failure leaves no clean line ..." | | |
| M45 the error code dropped from the unreadable message | killed / killed | the directory, mode 000 and Stop hook tests | | |

The full-suite failures under the four survivors are load, not kills. At the head, unmutated, under
the same load:

```
$ bun test tests/gate.test.ts -t 'a citation is the exact report filename as a whole token, however punctuated'
(fail) a citation is the exact report filename as a whole token, however punctuated [5083.89ms]
  ^ this test timed out after 5000ms, before its done callback was called. ...
$ bun test tests/verdict-reader.test.ts -t 'agree on every sequence'
(fail) ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict [23334.58ms]
  ^ this test timed out after 5000ms, before its done callback was called. ...
```

and no other test can see these lines: `rg -l 'GLOSSARY|glossary' tests` prints only
`tests/glossary.test.ts`, so `checkGlossary` returns at `src/gate.ts:106` for every other sandbox,
and this repository's own glossary (bold entries, no `####`, no `**Term:**:`, no failure) reads the
same under all four. The node failure under M43 is the budget test the brief names as
load-sensitive; the node failure names under M26, M28 and M39 were not captured (the first runner
kept only the count), and by the same argument they cannot be glossary tests, which passed under
those mutants on node. Rung 4 for the glossary-test results, rung 3 for "survives the full suite".

## Probe D: writing order and the small prose

**The three files agree.** `skills/router/SKILL.md:154-156` ("No glossary or ADR change is left
uncommitted or unreviewed: it is written before the review of the item that introduced it ..., and a
later one goes into a follow-up item"), `skills/reflect/SKILL.md:45-48` ("what it proposes after the
verdict goes into a follow-up item, not into the closed one") and `skills/reflect/references/domain-docs.md:5`
("Each is written before the review of the item that introduced the term or took the decision, so
the verdict has seen it; what reflect proposes after the verdict goes into a follow-up item") say
the same thing. So do `docs/wiki/Skills-and-Playbooks.md:93-97`, `docs/wiki/State-Files.md:26-31`
("both are written before the review of the item that introduced them") and `CHANGELOG.md:11-12`.
Two places do not carry it: no playbook mentions the glossary or an ADR (`rg -n -i
'glossary|adr\b|docs/adr|domain-docs' skills agents` finds no playbook), and
`docs/wiki/How-A-Work-Item-Flows.md:174-190` lists the base's four closing steps (non-blocking 13,
14).

**Criterion 3 as worded.** "closing an item and reflect are where terms and ADRs are written": the
router's Closing section and reflect are still the two places that say when and how a term or an
ADR is written, and both route a late one to a follow-up item; what moved is the moment, from after
the review to before it, which is what round 1 found wrong (a glossary closed on a verdict that never
saw it). Read as "the parts of the workflow that own the glossary and the ADRs", it holds. Read
literally, closing now checks and the writing happens earlier in the item, at a step no playbook
names. I count it met, with non-blocking 13 as the gap. The "only decisions meeting all three
conditions" half is unchanged: `domain-docs.md:30-34`, `reflect/SKILL.md:40`.

**`domain-docs.md`.** Line 9 no longer offers to park a term ("leave out a term they do not settle
and say so in the report"), which round 1 flagged. Line 26 now reads "Prose, rules, HTML comments
and fenced blocks are free, and so are headings in a file whose terms are bold. A term appears
once." It is true of headings; it is not true of a bold-led prose line, which is read as an entry
(blocking 1 and 2), nor of a comment directly under a term line (non-blocking 1). Line 23 describes
`**Term**:`, `**Term:**`, the `- ` marker and one heading per term; the check accepts those, plus
`*` and `+` markers, and drops heading mode when any bold entry exists, which line 23 does not say
(blocking 2).

**`intake.md`.** 77 lines at the base and at the head. Section by section:

```
$ for sec in ...; do awk '$0=="## "sec{f=1;next} /^## /{f=0} f' <base|head> | shasum; done
## Map                           base 73810ef4cbbb head 73810ef4cbbb identical
## Record a reversible decision  base 01582ae4b757 head 01582ae4b757 identical
## Park a fork                   base a3668a1223d9 head a3668a1223d9 identical
## End                           base 1f9b9b3b65a2 head 1f9b9b3b65a2 identical
## Interactive mode              base 0023537cee0e head 0023537cee0e identical
     77 intake.base.md
     77 intake.head.md
```

`git diff 5449746..3a6fab4 -- skills/router/references/intake.md` has two hunks: the glossary
sentence joined to the opening paragraph (`:6-7`), and Proportion with "(several changes or
tracks)" removed and rewrapped (`:67-69`), its sentence order back to the base's. The glossary line
is unchanged since round 1 (`git diff 4bf9aea..3a6fab4 -- skills/router/references/intake.md` touches
only Proportion), and `skills/understand/SKILL.md` is untouched since round 1 (not in the diff
stat), so round 1's live reading run still stands for both.

**Dashes.** `git diff 5449746..3a6fab4 -- . ':!.mstack' | rg '^\+' | rg -c '—|–'` prints nothing,
rc 1.

## Probe E: regression and docs

**Suite, at the head, in this checkout.**

```
$ npm test                         # bun half under load ~20-30; node half not reached (`&&`)
(fail) ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict [5001.99ms]
 615 pass
 1 fail
Ran 616 tests across 28 files. [330.95s]
$ npm run test:node
ℹ tests 616
ℹ pass 616
ℹ fail 0
ℹ duration_ms 104700.888792
$ npm run test:bun                 # rerun, load ~13-18
(fail) ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict [5006.44ms]
 615 pass
 1 fail
Ran 616 tests across 28 files. [220.29s]
```

The one bun failure is a 5,000 ms timeout in `tests/verdict-reader.test.ts:87`, a file this item does
not touch (not in `git diff --stat 5449746..3a6fab4`). It fails the same way at the item base, in a
`--no-local` clone, at load 13:

```
$ git checkout -q 5449746 && bun test tests/verdict-reader.test.ts
(fail) ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict [6294.43ms]
 19 pass
 1 fail
$ git checkout -q 3a6fab4 && bun test tests/verdict-reader.test.ts
(fail) ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict [6263.76ms]
 19 pass
 1 fail
```

Base 6,294 ms, head 6,264 ms: load, not a regression. Every other test passed on bun, and all 616
on node. `tests/costs.test.ts:698` and `tests/run.test.ts:239` passed in all three runs; the
launcher did not hang.

**`tests/glossary.test.ts` ten times on each runtime** (24 tests):

```
node run  1..10 rc=0  ℹ tests 24 ℹ pass 24 ℹ fail 0     (15.2 to 102.5 s per run)
bun run  1..7   rc=0  24 pass 0 fail                    (38.8 to 43.5 s per run)
bun run  8      rc=1  19 pass 5 fail | (fail) a fenced block is skipped whole, wherever it is [5270.93ms] (fail) Windows line endings read like Unix ones [5168.31ms] ...
bun run  9      rc=1  21 pass 3 fail | (fail) the CLI exits 1 on a malformed glossary, 0 on a well-formed one and with none [7584.71ms] ...
bun run 10      rc=0  24 pass 0 fail
```

Every bun failure is a test over bun's 5,000 ms default (non-blocking 8). Unloaded, the file runs in
7.0 s (`Ran 24 tests across 1 file. [7.03s]`, the run before the loop).

**Typecheck.** `npm run typecheck` (`bunx --bun tsc --noEmit`): rc 0.

**lint-plugin.**

```
$ ./bin/mstack lint-plugin . | tail -1
PASSED - 0 failures, 0 warnings                              # rc 0
$ # --no-local clone at 3a6fab4, first line of skills/reflect/references/domain-docs.md removed
[fail]  skills/reflect/references/domain-docs.md: no origin header
        fix: the text is derived; restore the <!-- Origin: ... --> comment
FAILED - 1 failure, 0 warnings
$ git checkout -- skills/reflect/references/domain-docs.md && lint-plugin . | tail -1
PASSED - 0 failures, 0 warnings
```

**`./bin/mstack gate` in this checkout.**

```
-- glossary
[ok]    GLOSSARY.md: 14 entries, each a term with a one or two sentence definition
...
[ok]    working tree is clean
PASSED - 0 failures, 0 warnings
```

I did not run `gate --full` in this checkout: it writes `.mstack/verification.tsv`, and the brief
allows no write to the repository's `.mstack/` beyond my report and ledger row. The suite, the
typecheck and lint above are its `verify` command run by hand.

**Ledger before my row.** `./bin/mstack ledger check glossary-and-adr`: `FAIL no verdict at 3a6fab42;
3 row(s) exist at other SHAs and a new head SHA voids them`.

**Docs against what I observed.**

- `docs/wiki/Gates-and-Hooks.md:281-305`: the forms, the two failures with their line, the
  unreadable and directory failures, the two warnings, the quiet Stop hook and the pasted example
  are all reproduced (Probe C). Two statements are not: "one `##` or `###` heading per term" holds
  only in a file with no bold line (`:284-285`, blocking 2), and "Rules, HTML comments and fenced
  blocks are skipped" (`:285`) fails for a comment or rule directly under a term line
  (non-blocking 1). A dangling symlink is silent, not "a failure that says so" (`:288`,
  non-blocking 5).
- `docs/wiki/State-Files.md:26-31`: true ("a missing definition or a repeated term fails, the rest
  warns" leaves out the unreadable-file failure, which the wiki page above states).
- `docs/wiki/Skills-and-Playbooks.md:73-77, 92-97`: true.
- `README.md:148`: true.
- `CHANGELOG.md:5-17`: true except "one heading per term" (blocking 2). "with the date and what was
  given up" matches the ADR.
- `docs/wiki/How-A-Work-Item-Flows.md:174-190`: stale (non-blocking 14).

## Acceptance, quoted

| # | Criterion | Verdict | Evidence | Rung |
|---|---|---|---|---|
| 1 | "GLOSSARY.md exists with the terms the code and skills already use (item, verdict, closing role, receipt, fork, seam), each one or two sentences with no implementation detail" | **Met** | 14 entries, the six named present, each one or two sentences (the gate agrees, no warning), no file, flag, status or function names; every statement true against the code and the skills (Probe A); round 1's Item and Closing role defects fixed and Closing role reproduced name by name | 5 for Item's active rule, Closing role and Ledger (real CLI, throwaway stores); 2 for the statements about skill text |
| 2 | "docs/adr/ exists and its first ADR records 'Claude Code only' with the date and the trade-off" | **Met, as far as the record allows** | `docs/adr/0001-claude-code-only.md`: the decision, "Decided 2026-10-31", "Given up ... Kept ..."; every sentence supported by the note or by git, no motive supplied (Probe B). Non-blocking 9 to 11 | 4 (`git reflog`, `cat-file`, `branch -r --contains`, `fsck`, a transport clone, `ls-tree` run); the note read |
| 3 | "intake and understand read the glossary; closing an item and reflect are where terms and ADRs are written, and only decisions meeting all three conditions become ADRs" | **Met** | `intake.md:6-7` and `understand/SKILL.md:40-41` unchanged since round 1's live run; the router's Closing step 1, reflect and domain-docs agree on when a term or ADR is written and send a late one to a follow-up item; the three conditions at `domain-docs.md:30-34`, `reflect/SKILL.md:40`. Item 55's fork sections of `intake.md` identical to the base. Gap: no playbook step before the review (non-blocking 13) | 5 for reading (round 1's live run, carried: the lines are unchanged, which I checked at rung 4 with `git diff`); 2 for writing (text) |
| 4 | "mstack gate checks the glossary's entry format" | **Not met** | It checks, on both runtimes, recognises the common forms, warns instead of failing on styles it does not know, reports an unreadable file, and keeps a warning from the model. But a bold label repeated under each term fails a reasonable glossary and tells the model to rename it (blocking 1), and one bold line turns a heading glossary off so that a missing definition and a repeated term pass under a false clean line (blocking 2) | 5 (real CLI in throwaway repositories, `hook stop`, both runtimes) |

## Changes required

1. `src/glossary.ts:16, 111-141` - a bold `Label:` line inside an entry (directly under its
   definition, indented under its list item, or under a `##`/`###` term heading) is part of that
   entry and never a term; tests from cases 25, 26 and 28.
2. `src/glossary.ts:50-51` - a file whose terms are `##`/`###` headings is read by its headings
   whatever bold lines it also has, so a heading with no definition or a repeated heading fails
   there too; tests from cases 39 and 40. `Gates-and-Hooks.md:284-285`, `domain-docs.md:23,26` and
   `CHANGELOG.md:13-14` then stay true as written.

The non-blocking list is optional; 1 (a comment under a term line), 7 (pin M26 and M43) and 9 (the
ADR's "this clone") are the cheapest worth taking.
