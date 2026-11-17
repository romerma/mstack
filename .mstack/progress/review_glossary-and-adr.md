# Review - glossary-and-adr

**Verdict:** CHANGES_REQUESTED

Reviewed alone, round 1, at `4bf9aea20f174fb51346f881f010f171c30df0d9` against base `5449746`
(`git diff 5449746..4bf9aea -- . ':!.mstack'`, 17 files, +509 -12). Every claim below comes
from a command I ran; the implementer's report was not used as evidence. CLI probes ran in
throwaway repositories under the scratchpad (`review58/`), never in this working tree. Three
scratch scripts (`cases.mjs`, `run.sh`, `mutants.mjs`) were written with the Write tool into the
scratchpad, not the repository.

## Blocking findings

### 1. GLOSSARY.md:7-8, Item: "with ... the seams where it is tested" is false for most items

Seams are optional in the code and in the skill the glossary is written from, and 69 of this
repository's 81 items have none.

```
$ ./bin/mstack state add --slug beta --title B --acceptance "b" --source s   # in a throwaway store, no --seam
$ ./bin/mstack state show beta
id: 2
slug: beta
title: B
status: pending
source: s
acceptance:
  - b
$ node -e '...items without seams in .mstack/state.json...'
items 81 without seams 69 1:statusline 2:subagent-statusline-shipping 3:why-source-playbooks ...
```

`src/state.ts:38` declares `seams?: string[]`, `src/state.ts:204` says "an empty list is fine",
and `skills/router/references/intake.md:62-63` says "No behaviour change, no seam: say why in
`--description`." **Fix:** "A unit of work in the project's queue, with a title, acceptance
criteria quoted from its source and, when it changes behaviour, the seams where it is tested."

### 2. GLOSSARY.md:36-37, Closing role: the rule goes by role name, not by who wrote the work

The entry says a closing role is "any role except the ones that write the work, such as the
implementer and the spec author". The code excludes exactly two names and nothing else
(`src/roles.ts:123` `IMPLEMENTING_ROLES = new Set(["implementer", "spec-author"])`,
`src/roles.ts:125-128` `canCloseAnItem`), plus an empty verifier; its own comment says "this is
a floor and not a proof" (`src/roles.ts:118-121`). A role that wrote the work under any other
name closes the item with a green gate. Reproduced in a throwaway store, item `alpha` at
`verifying` with a passing receipt, one row per run:

```
role            state set --status done     then mstack gate
[implementer]   done-rc=0  [fail] items closed on a verdict from the pass that wrote the code: alpha (only implementer)  FAILED
[spec-author]   done-rc=0  [fail] items closed on a verdict from the pass that wrote the code: alpha (only spec-author)  FAILED
[coordinator]   done-rc=0  [ok]   1 closed item(s) carry a ledger verdict  PASSED
[self]          done-rc=0  [ok]   1 closed item(s) carry a ledger verdict  PASSED
[reviewer]      done-rc=0  [ok]   1 closed item(s) carry a ledger verdict  PASSED

ledger check, same rows (case and plugin prefix folded, `impl` is not excluded):
[implementer]        PASS test-verified at 395f5ed7 by implementer (the author's own verdict, not an independent approval)
[mstack:implementer] PASS ... (the author's own verdict, not an independent approval)
[Implementer]        PASS ... (the author's own verdict, not an independent approval)
[mstack:spec-author] PASS ... (the author's own verdict, not an independent approval)
[coordinator]        PASS test-verified at 395f5ed7 by coordinator
[self]               PASS test-verified at 395f5ed7 by self
[impl]               PASS test-verified at 395f5ed7 by impl
[]                   PASS test-verified at 395f5ed7 by unknown (the author's own verdict, not an independent approval)
```

"such as" tells the reader the excluded set is open; it is closed at two names. "never close"
also needs care: `state set --status done` succeeds on an implementer-only row (rc 0); it is the
gate's audit that then goes red. This matters more after this item, because the router's
closing step 1 now has the coordinator write glossary entries and ADRs, and after a panel the
coordinator records the closing row under its own name (`skills/review/SKILL.md:49-51`).
**Fix:** "A role whose verdict can close an item: any named role except the implementer and
the spec author, whose verdicts are recorded but leave a closed item red at the gate. The rule
goes by the role's name, not by who wrote what."

### 3. docs/adr/0001-claude-code-only.md:9, "worked on for two months" contradicts the record

```
$ git reflog --date=iso | rg "2026-(08-2[5-9]|08-3|09|10)" | tail -6
6687df2 HEAD@{2026-10-31 15:12:56 +0100}: checkout: moving from feat/portable-core to main
760a281 HEAD@{2026-08-25 12:40:25 +0200}: commit: feat: write grok hooks from setup that actually fire
087b535 HEAD@{2026-08-25 12:16:37 +0200}: commit: feat: ship plugin hooks as a single command string
e479734 HEAD@{2026-08-25 11:52:02 +0200}: commit: feat: add the agent plugins root manifest
9cb44df HEAD@{2026-08-25 11:51:53 +0200}: commit: feat: accept grok and cursor hook envelopes
6687df2 HEAD@{2026-08-25 11:47:27 +0200}: checkout: moving from main to feat/portable-core
```

Four commits in 53 minutes on 2026-08-25, then nothing in this repository until HEAD left the
branch on 2026-10-31. The project's note says the decision came "after a 2-month pause". Two
months of pause is not two months of work. **Fix:** "the port was built on 2026-08-25 and then
sat untouched for two months before it was dropped".

### 4. docs/adr/0001-claude-code-only.md:5, 7, 9, the stated reason is not the recorded one

The record of why: a product decision to keep mstack a Claude Code plugin only, taken after a
two-month pause, and the port had open defects (the coordinator's brief; the project note
`claude-only-host` reads "product decision to keep mstack a Claude Code plugin only, after a
2-month pause; the port also had open defects"). The ADR replaces that with an upkeep argument
nobody recorded: line 5 gives the why as "its enforcement lives in hooks and subagents, which
belong to the host, so a second host means a second hook and agent contract to keep correct
beside the first"; line 7 names "The trade-off is reach against upkeep"; line 9 asserts an
event, that the port was "weighed against its upkeep before it was dropped". Nothing in
`decisions.tsv`, `history.md`, the CHANGELOG or the branch's commits records such a weighing
(`rg -n -i "grok|cursor|portab|claude code only" .mstack/decisions.tsv .mstack/progress/history.md CHANGELOG.md`
returns `CHANGELOG.md:8`, this item's own entry, and `decisions.tsv:157`, where "portab" matches
"importable"). The facts inside line 5 are true of the repository
(hooks in `hooks/hooks.json`, agents in `agents/`); as the reason for the decision they are
the ADR's invention. **Fix:** state the recorded reason ("a product decision, taken after the
branch had sat for two months, with open defects in the port") and present the upkeep point,
if kept, as a consequence of the decision rather than its motive; any further reason is the
maintainer's to give, so ask.

### 5. docs/adr/0001-claude-code-only.md:9, "a port starts again from nothing" is false in this clone

```
$ for c in 9cb44df e479734 087b535 760a281; do printf '%s ' $c; git cat-file -t $c; done
9cb44df commit
e479734 commit
087b535 commit
760a281 commit
$ git show --stat --format='%h %ad %s' --date=iso 760a281 | head -3
760a281 2026-08-25 12:40:25 +0200 feat: write grok hooks from setup that actually fire
 .grok/hooks/mstack.json    | 61 ++++++++++++++++++++++++++++++
$ git branch -r --contains 760a281      # (empty: never on origin)
$ git branch -a | rg -i portab          # (empty: the ref is gone)
```

The branch ref is gone and it was never pushed, so the sentence holds for any other clone. In
this one, the four commits are still in the object store and the HEAD reflog, recoverable with
one `git branch`, until a gc prunes them. The note says "treat the work as gone", which is a
choice, not a fact about the repository. The first condition is argued from the false half.
**Fix:** "the branch was deleted without being pushed, so its work survives in no shared
copy and a port would be rebuilt", or argue hard-to-reverse from the cost of a second hook and
agent contract.

### 6. src/glossary.ts:75-82 and :65-72, the gate fails reasonable hand-written glossaries, and tells the agent to delete one

The gate runs in every consumer project, at the end of every turn, and checks any root
`GLOSSARY.md`. A glossary a project already had in any common Markdown style other than the
reference's turns the session gate red. Real CLI, throwaway repositories, both runtimes agree
(table in Probe C, cases 18 to 23):

```
$ bat -pp GLOSSARY.md
# Glossary

- **Order**: A request to buy something.
- **Invoice**: A request for payment.
$ printf '{"cwd":"%s","hook_event_name":"Stop",...}' "$PWD" | ./bin/mstack hook stop
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- GLOSSARY.md: no entries: each term is a line starting **Term**: -> add an entry, or delete the file if the project has no glossary yet"}}
```

A glossary with two entries is told it has none, and the model is told, at the end of every
turn, to add an entry or delete the user's file. The same "no entries" fires on `**Term:**`
(colon inside the bold), one heading per term, and a table; with mstack-format entries, a `---`
rule between sections or an HTML comment fails as "text outside any entry". This is the risk
the design row names ("a format check that is too strict turns gates red on hand-written
glossaries"), and it contradicts `docs/wiki/Gates-and-Hooks.md:285`, "a hand-written glossary is
not held to a style". **Fix:** "A `GLOSSARY.md` with no `**Term**:` line is not in this format
and gets one warning naming the format, never a failure or a deletion hint; a `- ` list marker
before `**Term**:` is an entry, and `---` rules, HTML comments and fenced code are skipped."

## Non-blocking findings

- **Unreadable or directory `GLOSSARY.md` crashes the gate and silences the Stop hook.**
  `src/gate.ts:108` reads without a guard. Mode 000 or a directory: `mstack gate` exits 2 with
  `mstack: EACCES ...`/`EISDIR ...` before the workspace section and the summary; `mstack hook
  stop` prints no `additionalContext`, so a store that is red for another reason (two active
  items here) is silent to the model. `ledger.tsv` already behaves this way (`rc=2 EISDIR`),
  `decisions.tsv` fails closed (`could not be read`), and `docs/wiki/Gates-and-Hooks.md:429`
  records the rule "an unreadable receipt file is a failure, never a pass". Wrap the read and
  `report.fail` it.
- **A malformed first entry passes as prose.** `# G` / `**Invoice** A bill sent after
  delivery.` / `**Order**: A request.` passes with "1 entry" (case 10): the broken term line is
  before the first entry, where prose is free. Flag a line that starts with `**` before the
  first entry.
- **The colon rule is untested.** Mutant M02 (`:` optional in `ENTRY`) survives
  `tests/glossary.test.ts` and the full suite on both runtimes. A test with `**Invoice** A
  bill.` after an entry would pin it.
- **Sentence boundary before a lowercase word is untested** (M12 survives everywhere): dropping
  the uppercase lookahead would count "approx. ten" as two sentences.
- **Fenced code is not understood**: a ```` ```md ```` example after the entries fails twice
  (case 13, the fence line and a fake duplicate); before the first entry its `**Order**:` line
  is counted as an entry (case 14, "2 entries").
- **`**Item:**:` is not a duplicate of `**Item**:`** (case 4). Minor.
- **Case-insensitive file systems check `glossary.md` too** (case "lowercase" fails on macOS
  with a message naming `GLOSSARY.md`; on Linux it would not be read). Minor.
- **`skills/reflect/references/domain-docs.md:9`** "or park it the way intake parks a fork"
  offers a question to the user, which the origin header ("with no question to the user") and
  the Map's fork test (a term's sense changes nothing the user can do or get) both rule out.
  Drop the clause.
- **`domain-docs.md:26`** "After it, every line belongs to an entry" is narrower than the gate,
  which allows headings anywhere (this repository's own glossary has `## The proof` after
  entries). Say "every line but a heading".
- **Router "Closing a session" step 1** (`skills/router/SKILL.md:154-157`) writes the glossary
  entry after the review that step 5 relies on. It is reviewed only if it is committed and
  forces a fresh verdict at the new head. Left uncommitted, it is not: in a throwaway store with
  a reviewer approval at HEAD, writing `GLOSSARY.md` made `state set --status done` refuse ("an
  uncommitted file has changed since"), but one more `gate --full` re-recorded the receipt and
  `state set a1 --status done` then closed (`"verifying" -> "done"`), the gate `PASSED - 0
  failures, 1 warning`, on a verdict that never saw the glossary. Say "commit it; the reviewer
  then judges the new head", or move the write before review.
- **`CHANGELOG.md:14`** "a failure names the entry and its line": "no entries" names neither and
  "text outside any entry" names only a line.
- **Glossary wording, true but loose:** Intake (`GLOSSARY.md:10-11`) is "the first step for a
  new request", though the router runs gate and state first (`skills/router/SKILL.md:17-21`),
  and a program of work does not become one item (`intake.md:67`); Pass (`:27-28`) says "one
  agent session", where a subagent run is not a session and a verifier may be a person or a CI
  job (`src/roles.ts:118`); "Evidence rung" (`:45`) appears nowhere else, the skills say "rung"
  and "the evidence ladder"; Gate (`:48-49`) runs at the end of every turn only with the plugin
  loaded, inside a store, and not on a turn the Stop hook itself continued
  (`src/hooks.ts:279-282`); Item's "one active" is the default rule `one_active_item`, which the
  gate enforces and `state set` does not (two `in_progress` items were accepted, then the gate
  failed "2 items are active in this worktree").
- **Same word, other sense:** `skills/test-first/SKILL.md:11` "The red output is the receipt" and
  `skills/reflect/SKILL.md:25` (a "Verdict" column of Accepted/Backlog/Rejected) use two glossary
  terms in senses the glossary does not give.
- **Missing terms the skills lean on**, optional: store, report (the report-file contract),
  reversible decision.

## Probe A: the glossary, term by term

Each entry is split into its statements. Sentence counts are mine, by reading; the gate agrees
(`[ok] GLOSSARY.md: 14 entries` on this repository and on a copy in a throwaway repository,
both runtimes). No entry names a file, flag, status or function. Format: every entry is a
`**Term**:` line with the definition on the line below, as the reference allows; `## The work`
and `## The proof` are free headings.

| Entry (sentences) | Statement | Evidence | Verdict |
|---|---|---|---|
| Item (2) | a unit of work in the project's queue, with a title | `src/state.ts` item shape; `state add --slug --title` | true |
| | acceptance criteria quoted from its source | `intake.md:52` "quoting the user's words"; gate "every item has at least one acceptance criterion" | true |
| | the seams where it is tested | `src/state.ts:38` `seams?`; `intake.md:62-63` "no seam"; 69 of 81 items have none; `state add` without `--seam` succeeds | **false: blocking 1** |
| | only one is active at a time in a working copy | `src/gate.ts:245-257`; two `in_progress` items: `state set` rc 0 both, gate `[fail] 2 items are active in this worktree`; rule `one_active_item` can be turned off (warn) | true as the default rule |
| Intake (2) | the first step for a new request | `skills/router/SKILL.md:17-21`: step 3, after gate and state | loose, non-blocking |
| | turns it into one item | `intake.md:5`; `intake.md:67` a program of work goes to orchestrate | true for one request |
| | facts found, reversible decisions recorded, forks parked | `intake.md:15-19`, `:21-44`; router `:29-30` | true |
| Fork (1) | answer changes what the product's user can do or get, or cannot be undone | `intake.md:18` | true |
| | put to the user instead of taken by the agent | `intake.md:18` "Park it ... Do not take it"; `src/gate.ts:285-354` `decision_required` must be answered by `decide --resolves` past specifying | true |
| Seam (2) | the public surface where a behaviour is observed and a test attaches | `intake.md:54`, `:62`; `skills/test-first/SKILL.md:22` | true |
| | in design vocabulary, where one implementation can stand in for another without editing in place | `skills/design/references/deep-modules.md:19-20` "a place where behaviour can change without editing there", adapter fills the interface | true |
| Playbook (2) | short numbered list of steps for one kind of request | `skills/router/playbooks/*.md`, 5 to 8 numbered steps each; router route table | true |
| | copied whole into the todo list; a skipped step stays listed with its reason | `skills/router/SKILL.md:31-36` | true |
| Spec path (2) | opt-in; spec written and approved by a different pass before any code | `skills/router/SKILL.md:60-68` | true |
| | on the direct path the acceptance criteria are the contract | `skills/router/SKILL.md:68` | true |
| Pass (2) | one agent session doing one role on an item | used as a term: `skills/ship/SKILL.md:11`, `agents/*.md` "The separate passes", `skills/review/SKILL.md:36,44`; not a coinage. "Session" is loose (`src/roles.ts:118`: a verifier can be a person or a CI job) | true, loose |
| | a verdict counts only from a pass that did not write the work | `skills/ship/SKILL.md:11`; enforced by role name (see Closing role) | true as the rule |
| Lens (1) | a distinct angle one pass examines the work from, so a panel does not repeat itself | `skills/review/SKILL.md:23-31`; `agents/reviewer.md:40-53`; `src/roles.ts:67-83` | true |
| Verdict (2) | a pass's recorded judgement at one commit | ledger row carries `sha` (`src/ledger.ts:150-155`) | true |
| | that it holds, failed, or could not be checked | five values (`mstack help`): live-verified, test-verified, type-check-only (holds, by rung), verifier-failed, verifier-blocked | true |
| | a judgement of the work, where a receipt is a fact about a command | `src/verification.ts:28-32` | true |
| Closing role (2) | any role except the ones that write the work, such as the implementer and the spec author | `src/roles.ts:123-128`: exactly two names; `coordinator`, `self`, `impl` close with a green gate (run above) | **false: blocking 2** |
| | their verdicts are recorded but never close | rows record; `state set --status done` succeeds (rc 0) and the gate's audit fails "closed on a verdict from the pass that wrote the code" | true only as "the gate refuses it" |
| Receipt (2) | a recorded fact that a verification command ran, against which commit and working tree, whether it passed | `src/verification.ts:45` header `target sha command outcome ts tree`; `Outcome = "passed" \| "failed"` | true |
| | shows that something ran, not that the work is good | `src/verification.ts:28-32` | true |
| Ledger (2) | append-only record of verdicts, each tied to the commit it judged | only `ledger record` writes it; `.gitattributes` merges it as a union; nothing stops a hand edit, which is the code's own wording too (`src/closing.ts:89`) | true |
| | a failed verdict stays; only a later independent approval answers it | reproduced: `verifier-failed` by reviewer, then `verifier-blocked`, then `test-verified` by implementer: `ledger check` still FAIL; `state set --status done --force` refused "a rejection stands ... --force does not close over one"; then `test-verified` by reviewer: PASS, done | true |
| Evidence rung (2) | a level of proof, from having said so up to reproduced in the running system | `evidence-ladder.md:6-12`: five rungs, 1 "You said so", 5 "You reproduced it in the running system" | true |
| | a claim is reported with the rung where it stopped | `evidence-ladder.md:3-4`, router `:121-122` | true; the term itself is used nowhere (the skills say "rung", "evidence ladder") |
| Gate (2) | a check that is code instead of prose, red when the work breaks a rule | `skills/router/SKILL.md:116-117`, `src/gate.ts:38-53` | true |
| | the session gate runs at the end of every turn | `hooks/hooks.json` Stop -> `mstack hook stop`; `src/hooks.ts:279-282` skips when no store or `stop_hook_active`; only with the plugin loaded | true with the plugin loaded |
| | the merge gate decides whether a change may land | `mstack merge-gate <pr>` | true |

The six terms the criterion names are all present. Terms the skills lean on that are absent
(optional): store, report, reversible decision.

## Probe B: the ADR, sentence by sentence

Record used: the coordinator's brief (the project note of 2026-10-31) and what the repository
shows. `git branch -a` has no `feat/portable-core`; `git log --all --oneline | rg -i
"portab|grok|cursor"` finds one unrelated commit (`a98a5d0 fix: portable process-group
timeout ...`); the HEAD reflog and the object store still hold the branch (pasted under
blocking 3 and 5). `docs/research/pstack-port.md` is tracked (`git ls-files docs`) and not
ignored (`git check-ignore` rc 1); only `docs/research/notes-2026-11-16/` is ignored, and it
is absent here.

| Line | Sentence | Record | Verdict |
|---|---|---|---|
| 1 | "mstack targets Claude Code only" | note: "este repo quedará solo para claude" | supported |
| 3 | "Status: accepted. Decided 2026-10-31, written down 2026-11-17." | note dated 2026-10-31; reflog `2026-10-31 15:12:56 checkout: moving from feat/portable-core to main` | supported |
| 5 | "On 2026-10-31 the maintainer dropped `feat/portable-core`" | note; reflog | supported |
| 5 | "a branch begun on 2026-08-25" | reflog `2026-08-25 11:47:27 checkout: moving from main to feat/portable-core` | supported (this clone only) |
| 5 | "that added Grok and Cursor hook envelopes, a root manifest for the Agent Plugins format, a `.cursor-plugin/` directory and a setup step that wrote `.grok/` and `.cursor/` hook files" | note, word for word in substance; the commits show envelopes (`9cb44df`), root `plugin.json` (`e479734`), `.grok-plugin/` (`087b535`), `.grok/hooks` and setup writing Grok hooks (`760a281`) | supported by the note |
| 5 | "mstack stays a Claude Code plugin" | note | supported |
| 5 | ": its enforcement lives in hooks and subagents, which belong to the host, so a second host means a second hook and agent contract to keep correct beside the first" | true of the repository as a fact; not the recorded reason (note: "product decision ... after a 2-month pause") | **beyond the record as the why: blocking 4** |
| 7 | "The trade-off is reach against upkeep." | not recorded; a framing | **blocking 4** |
| 7 | "Users of Cursor and Grok are given up; in return there is one contract, and every hook, agent and setup change is checked against one host." | entailed by the decision | supported as a consequence |
| 7 | "The branch also had open defects when it was dropped: setup overwrote an existing `.cursor/hooks.json` and wrote absolute binary paths specific to one machine." | note: "setup clobbered an existing `.cursor/hooks.json`, wrote machine-specific absolute binary paths" | supported |
| 9 | "All three conditions hold." | depends on the three below | not argued from supported facts |
| 9 | "Reversing it is hard because the branch no longer exists in the repository, so a port starts again from nothing." | ref gone and never pushed; commits still in this clone (`git cat-file -t 760a281` -> commit) | **half false: blocking 5** |
| 9 | "It is surprising because mstack is built on pstack, a Cursor plugin, and the research notes under `docs/` still discuss Cursor." | `README.md:477` "mstack is built on pstack"; `docs/wiki/The-Story.md:7-8` "a Cursor plugin"; `docs/research/pstack-port.md` tracked, about porting from Cursor | supported ("notes" is one file) |
| 9 | "It is a real trade-off because the port was built, worked on for two months, and weighed against its upkeep before it was dropped." | built: four commits; two months of work: contradicted by the reflog and the note ("2-month pause"); weighed against upkeep: not recorded | **false and beyond: blocking 3, 4** |

Format: `docs/adr/0001-claude-code-only.md` follows `NNNN-slug.md` from `0001`
(`domain-docs.md:30`); a Status line with the date, the decision, and what was given up are
present. The status line differs slightly from the template ("Status: accepted, 2026-11-17"),
which is fine.

## Probe C: the gate check, real CLI, both runtimes

Each case is a fresh copy of one throwaway repository (`git init`, a commit, this checkout's
`setup`, a feature branch, the glossary committed), gate run with `bun src/cli.ts gate` and
`node --disable-warning=ExperimentalWarning --experimental-strip-types src/cli.ts gate`
(script `review58/run.sh`, output `review58/run.out`). Bun and node gave the same exit code and
summary in every case; the glossary section shown is bun's.

| # | Case | rc bun/node | Glossary section | Right? |
|---|---|---|---|---|
| - | no `GLOSSARY.md` | 0/0 | no section, no line | yes |
| 01 | this repository's `GLOSSARY.md` | 0/0 | `[ok] GLOSSARY.md: 14 entries, each a term with a one or two sentence definition` | yes |
| 02 | `**Alpha**:` directly followed by `**Beta**: A thing.` | 1/1 | `GLOSSARY.md:3: entry "Alpha" has no definition` | yes |
| 03 | `**Item**` and `**ITEM**` | 1/1 | `GLOSSARY.md:3: entry "ITEM" repeats "Item" from line 1` | yes |
| 04 | `**Item**:` and `**Item:**:` | 0/0 | `2 entries` | misses a duplicate (minor) |
| 05 | `**Item**:` and `**Item **:` | 1/1 | `entry "Item" repeats "Item" from line 1` | yes |
| 06 | three sentences | 1/1 | `GLOSSARY.md:1: entry "Order" has 3 sentences; a definition is one or two` | yes |
| 07 | one sentence of 400 clauses | 0/0 | `1 entry` | passes by design (counts sentences only) |
| 08 | `Invoice: A bill.` after an entry | 1/1 | `GLOSSARY.md:3: text outside any entry: "Invoice: A bill."` | yes |
| 09 | `**Invoice** A bill.` after an entry | 1/1 | `text outside any entry: "**Invoice** A bill."` | yes |
| 10 | `**Invoice** A bill ...` as the first entry, then a good one | 0/0 | `1 entry` | misses a broken entry |
| 11 | prose paragraphs before the first entry | 0/0 | `1 entry` | yes |
| 12 | `##`, `###`, `####` around entries | 0/0 | `2 entries` | yes |
| 13 | fenced ```` ```md ```` with `**Order**:` after the entries | 1/1 | `:5 text outside any entry: "```md"`, `:6 entry "Order" repeats "Order" from line 3` | over-strict, confusing |
| 14 | the same fence before the first entry | 0/0 | `2 entries` (the fenced line counted) | wrong count |
| 15 | CRLF line endings | 0/0 | `2 entries` | yes |
| 16 | empty file | 1/1 | `GLOSSARY.md: no entries: each term is a line starting **Term**:` | yes |
| 17 | only `# Glossary` | 1/1 | `no entries` | yes |
| 18 | `- **Order**: ...` bullet list | 1/1 | `no entries` + "delete the file" hint | **wrong: blocking 6** |
| 19 | `**Order:** ...` colon inside the bold | 1/1 | `no entries` | **wrong: blocking 6** |
| 20 | `### Order` heading per term | 1/1 | `no entries` | **wrong: blocking 6** |
| 21 | a `| Term | Meaning |` table | 1/1 | `no entries` | **wrong: blocking 6** |
| 22 | `---` rule between two sections of good entries | 1/1 | `GLOSSARY.md:7: text outside any entry: "---"` | **wrong: blocking 6** |
| 23 | `<!-- keep sorted -->` between good entries | 1/1 | `GLOSSARY.md:5: text outside any entry: "<!-- keep sorted -->"` | **wrong: blocking 6** |
| 24 | second paragraph under a definition | 1/1 | `GLOSSARY.md:3: text outside any entry: "It is placed by a customer."` | defensible (a definition is one paragraph) |
| 25 | "Approved under U.S. law. It is paid." | 0/0 | `1 entry` | yes |
| 26 | "What should happen? It is asked. Once." | 1/1 | `has 3 sentences` | yes |
| 27 | UTF-8 BOM | 0/0 | `1 entry` | yes |
| 28 | 2,000 entries (175,786 bytes) | 0/0 | `2000 entries` | yes |
| 29 | `_Avoid_:` before any definition | 1/1 | `entry "Order" has no definition` | yes |
| 30 | definition as a `- ` list | 0/0 | `1 entry` | yes |
| - | malformed `src/GLOSSARY.md` | 0/0 | no section | yes, as documented |
| - | malformed `docs/GLOSSARY.md` | 0/0 | no section | yes, as documented |
| - | malformed lower-case `glossary.md` (macOS) | 1/1 | `GLOSSARY.md:1: entry "Order" has no definition` | checked on a case-insensitive FS only |
| - | `GLOSSARY.md` symlink to a file with a duplicate | 1/1 | `GLOSSARY.md:3: entry "Order" repeats ...` | yes |
| - | dangling symlink | 0/0 | no section | acceptable |
| - | `GLOSSARY.md` is a directory | 2/2 | `mstack: EISDIR: illegal operation on a directory, read`, no summary | crash (non-blocking) |
| - | `GLOSSARY.md` mode 000 | 2/2 | `mstack: EACCES: permission denied, open '.../GLOSSARY.md'` | crash (non-blocking) |
| - | malformed root glossary, gate run from `pkg/deep` | 1/1 | `GLOSSARY.md:1: entry "Order" has no definition` | yes: the root is found from a subdirectory |

Every failure names its line, and the entry where there is one. The reference's example passes
(`tests/glossary.test.ts:168-180` pins it, and the test passes). The check runs in a consumer
project: the live run in Probe D printed `-- glossary [ok] GLOSSARY.md: 2 entries` in the
bookings project.

The Stop hook with the directory case and a second, unrelated failure:

```
== plain: hook stop
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- 2 items are active in this worktree: a1 (in_progress), a2 (in_progress) -> ..."}}[hook rc=0]
== dirglossary: hook stop
[fail]  2 items are active in this worktree: a1 (in_progress), a2 (in_progress) -> ...     (stderr only)
[hook rc=0]                                                                                (no stdout)
== dirglossary: gate
mstack: EISDIR: illegal operation on a directory, read
[gate rc=2]
```

Timing, 10 runs each after a warm-up, `review58/time.sh`:

```
none               bun  rc=0 mean 93.4 ms over 10
none               node rc=0 mean 140.4 ms over 10
01-repo-glossary   bun  rc=0 mean 95.3 ms over 10
01-repo-glossary   node rc=0 mean 142.7 ms over 10
28-2000-entries    bun  rc=0 mean 99.3 ms over 10
28-2000-entries    node rc=0 mean 145.3 ms over 10
```

2,000 entries add about 5 ms to a 93 to 145 ms gate. Not noticeable.

### Mutants

22 mutants of my own, applied one at a time to a clone at `4bf9aea` (`review58/mutants.mjs`),
`tests/glossary.test.ts` on both runtimes; survivors then ran the full suite on both runtimes.

| Mutant | glossary.test bun/node | full suite bun/node | Matters? |
|---|---|---|---|
| M01 `MAX_SENTENCES = 3` | killed/killed | | |
| M02 colon optional in `ENTRY` | SURVIVED/SURVIVED | survived/survived (0 fail) | yes: the documented `**Term**:` colon is unpinned |
| M03 duplicates case-sensitive | killed/killed | | |
| M04 no `continue` after a duplicate | SURVIVED/SURVIVED | survived/survived (0 fail) | little: a duplicate also gets its definition checked |
| M05 prose before the first entry fails | killed/killed | | |
| M06 `_Avoid_` counted in the definition | killed/killed | | |
| M07 a heading does not end an entry | killed/killed | | |
| M08 code spans counted as sentences | killed/killed | | |
| M09 abbreviations counted | killed/killed | | |
| M10 no "no entries" check | killed/killed | | |
| M11 problems not sorted by line | SURVIVED/SURVIVED | survived/survived (0 fail) | little: output order |
| M12 uppercase lookahead dropped | SURVIVED/SURVIVED | survived/survived (0 fail) | some: "approx. ten" would count as two sentences, a false red |
| M13 term not trimmed | SURVIVED/SURVIVED | survived/survived (0 fail) | little: `**Item **:` would escape the duplicate check |
| M14 same-line definition dropped | killed/killed | | |
| M15 `checkGlossary` call removed | killed/killed | | |
| M16 `glossary.md` lower case in the gate | SURVIVED/SURVIVED | survived (bun 0 fail; node 1 fail, the unrelated load-sensitive "hook paths stay within budget on a 50 MB transcript") | little on macOS (case-insensitive FS); would die on Linux |
| M17 `report.fail` -> `report.warn` | killed/killed | | |
| M18 `[ok]` printed even with problems | SURVIVED/SURVIVED | survived/survived (0 fail) | some: an `[ok] ... each a term with a one or two sentence definition` line beside the failures |
| M19 no line number in the message | killed/killed | | |
| M20 path from `process.cwd()` not the store root | killed/killed | | |
| M21 glossary checked only under `--full` | killed/killed | | |
| M22 a same-line definition ignored | killed/killed | | |

## Probe D: the reading and writing lines

**As text.** `skills/router/references/intake.md` is 78 lines (base 77; `wc -l` on both
revisions). The sections that carry item 55's fork rules are identical to the base, compared
section by section with `awk` extraction and `diff`:

```
## Map: identical
## Record a reversible decision: identical
## Park a fork: identical
## End: identical
```

The added sentence is at `intake.md:6-7`. The only other change moves "A one-line request with
nothing ambiguous costs a couple of lookups and one `state add`" to the end of Proportion as "...
is a couple of lookups and one `state add`" (`intake.md:69-70`); nothing of substance was cut.
`skills/understand/SKILL.md:40-41` reads the glossary. Writing: `skills/router/SKILL.md:154-157`
(Closing a session, step 1), `skills/reflect/SKILL.md:40-46`, and
`skills/reflect/references/domain-docs.md:5`; each states all three conditions (hard to reverse,
surprising without context, a real trade-off), each sends any other decision to `decisions.tsv`,
and each says a session with nothing to write writes nothing. The contradictions I found are
listed as non-blocking above (domain-docs `:9` "park it the way intake parks a fork", `:26`
"every line belongs to an entry", router step order).

**Live, one run.** A fresh copy of `sandbox/bench/template`, `git init`, a commit, this
checkout's `setup`, `state.verify = python3 -m unittest discover -s tests`, and this committed
`GLOSSARY.md`:

```
# bookings

## Language

**Booking**:
One guest's reservation of one room for one stay, with the total charged when it was made. A cancelled booking is kept but is no longer listed.
_Avoid_: Reservation, order

**Stay**:
The nights a booking covers, from the check-in date up to but not including the check-out date.
_Avoid_: Visit
```

The request rubs against **Stay**: it uses "stay" for a booking record. Wrapper
`review58/live/run.sh`: `env -i` with `HOME USER LOGNAME TERM LANG TMPDIR SHELL PATH` only, no
ANTHROPIC_* variable, `claude -p "<prompt>" --model opus --output-format stream-json --verbose
--setting-sources project --strict-mcp-config --max-budget-usd 6 --plugin-dir
/Users/romerma/Code/mstack --permission-mode auto`, claude 2.1.326; a watchdog stopped it when
the implementer launched. Prompt, whole:

`/mstack add a stays subcommand: python3 -m bookings stays "<guest>" prints every stay that guest has that is not cancelled, one per line in exactly the format list uses, in id order; when the guest has none it prints nothing and exits 0. Guest names match exactly, case-sensitive.`

Stream `review58/live/stream.jsonl` (93,525 bytes, empty stderr), rendered:

```
INIT plugins: mstack,cc-plugin-agents-md,cc-plugin-telemetry,cc-plugin-privacy,cc-plugin-plugin-authoring perm: auto model: claude-opus-5-5
TOOL Bash | mstack gate; mstack state active; cat .mstack/progress/current.md; ls -R . ...
  RESULT> ... -- glossary\n[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition ... PASSED - 0 failures, 1 warning
TOOL Bash | cat bookings/cli.py bookings/app/service.py bookings/domain/booking.py bookings/ports/repository.py GLOSSARY.md; sed -n 1,200p .../skills/router/playbooks/feature.md; sed -n 1,80p .../skills/router/references/intake.md
TOOL Bash | git checkout -b feat/stays-subcommand && \
  mstack decide --phase intake --decision "Add BookingService.stays(guest) beside list(); CLI 'stays' reuses list's line format via a shared formatter" ... --result "if wrong: a refactor of where the filter lives; output unchanged" && \
  mstack decide --phase intake --decision "Glossary 'Stay' means nights of a booking; the user's 'stays' subcommand lists bookings. Keep the user's command name, use 'booking' in docs and acceptance" --why "command name is the user's explicit request; glossary term usage differs, which is a fact not a question" --evidence "GLOSSARY.md; request text" --result "if wrong: rename of a help string" && \
  mstack state add --slug stays-subcommand --title "CLI stays subcommand: a guest's active bookings" \
   --acceptance "python3 -m bookings stays \"<guest>\" prints every booking that guest has that is not cancelled, one per line in exactly the format list uses" \
   --acceptance "lines are in id order" --acceptance "when the guest has none it prints nothing and exits 0" \
   --acceptance "guest names match exactly, case-sensitive (no trimming, no case folding)" \
   --source "user request via /mstack:router, 2026-11-17" \
   --seam "CLI: python3 -m bookings --db <file> stays <guest> stdout and exit code" --seam "app: BookingService.stays(guest) return value" && \
  mstack state set stays-subcommand --status in_progress
  RESULT> Switched to a new branch 'feat/stays-subcommand'\nrecorded\nrecorded\nadded 1 stays-subcommand (pending)\n1 stays-subcommand (in_progress) ...
TOOL Bash | (writes current.md) ... python3 -m pytest -q
TOOL Bash | python3 -m unittest discover -s tests -q   -> Ran 18 tests ... OK
TEXT> Intake is done: the item `stays-subcommand` is filed and the branch is created. Baseline is 18 tests green. I'm handing implementation to the implementer agent now.
TOOL Agent | {"subagent_type":"mstack:implementer", ...}
watchdog: implementer launched at +46s; claude exited rc=143 after 49s
```

| Question | Answer |
|---|---|
| Did intake read the glossary? | Yes, `GLOSSARY.md` in the second tool call, beside `intake.md`. |
| Title and acceptance in the glossary's terms and sense? | Yes. Title "a guest's active bookings"; the user's "every stay" became "every booking" in the first criterion; the command name `stays` kept as the user asked. |
| Any question about a term to the user? | No. The mismatch was recorded as an intake `decide` row, "a fact not a question". |
| Did a fully specified request park nothing? | Yes. No `--decision-required`, item `in_progress`, implementer launched at 46 s. |

Rung 5 for the reading half. The writing half (closing step 1, reflect) is text only, rung 2:
the run was stopped before any session closed.

## Probe E: provenance and lint

The origin header (`domain-docs.md:1`) names `skills/engineering/domain-modeling/SKILL.md`,
`GLOSSARY-FORMAT.md` and `ADR-FORMAT.md` at `49dd158d1076134a641b33efb035946536778336`, which is
the `gitCommitSha` of `mattpocock-skills@claude-plugins-official` 1.3.1 in
`~/.claude/plugins/installed_plugins.json`. The source directory holds exactly those three plus
`agents/openai.yaml`, which is not used. Text from each of the three is used (the three
conditions from `SKILL.md` and `ADR-FORMAT.md`, the entry format and example from
`GLOSSARY-FORMAT.md`, the numbering and optional sections from `ADR-FORMAT.md`). MIT is named,
and `diff -q` of the source `LICENSE` against `licenses/mattpocock-skills-LICENSE.txt` prints
nothing ("licence-identical"). The three conditions are a close paraphrase with the same bold
headings; the rest is rewritten, and "Adapted" states the departures. The reference is called
"domain-docs", not by the source's name.

```
$ ./bin/mstack lint-plugin . | tail -1
PASSED - 0 failures, 0 warnings                              (rc 0, at 4bf9aea, root GLOSSARY.md and docs/adr/ present)
$ # clone at 4bf9aea, first line of domain-docs.md removed
[fail]  skills/reflect/references/domain-docs.md: no origin header
        fix: the text is derived; restore the <!-- Origin: ... --> comment
FAILED - 1 failure, 0 warnings                               (rc 1; restored: rc 0)
```

## Probe F: docs and regression

- `docs/wiki/Gates-and-Hooks.md:281-298`: the pasted failure is reproduced exactly by
  `# G / **Receipt**: / **Order**: A request.` (`GLOSSARY.md:3: entry "Receipt" has no
  definition`, `fix: write one or two sentences under it, or remove the entry`, rc 1). Its
  sentence "a hand-written glossary is not held to a style" (`:285`) is contradicted by cases 18
  to 23 (blocking 6).
- `docs/wiki/State-Files.md:26-31`, `docs/wiki/Skills-and-Playbooks.md:73-77, 92-96`,
  `README.md:148`: match what I observed.
- `CHANGELOG.md:5-15`: "a failure names the entry and its line" is not true of "no entries" or
  "text outside any entry" (non-blocking).
- No em dash or en dash in any added line (`git diff ... | rg '^\+' | rg '—|–'` rc 1).

## Acceptance, quoted

| # | Criterion | Verdict | Evidence | Rung |
|---|---|---|---|---|
| 1 | "GLOSSARY.md exists with the terms the code and skills already use (item, verdict, closing role, receipt, fork, seam), each one or two sentences with no implementation detail" | **Not met** | The six are present, all 14 entries are one or two sentences with no implementation detail, the format passes the gate; but Item (`GLOSSARY.md:8`, seams) and Closing role (`GLOSSARY.md:37`, by name, `self` closes) state what the code contradicts. Blocking 1, 2. | 5 (reproduced on the CLI in throwaway stores) |
| 2 | "docs/adr/ exists and its first ADR records 'Claude Code only' with the date and the trade-off" | **Not met** | The file, its name and the date are right; the reason and the trade-off are argued from a statement the reflog contradicts ("worked on for two months"), one the object store contradicts ("starts again from nothing") and one nothing records ("weighed against its upkeep"). Blocking 3, 4, 5. | 4 (`git reflog`, `git cat-file`, `git branch -r --contains` run) |
| 3 | "intake and understand read the glossary; closing an item and reflect are where terms and ADRs are written, and only decisions meeting all three conditions become ADRs" | Met | `intake.md:6-7`, `understand/SKILL.md:40-41`, router `:154-157`, `reflect/SKILL.md:40-46`, `domain-docs.md:5, 30-34`; a live `/mstack` run read `GLOSSARY.md`, wrote the title and acceptance in its sense, asked nothing and parked nothing. Fork sections of `intake.md` identical to the base. | 5 for reading (live run); 2 for writing (text) |
| 4 | "mstack gate checks the glossary's entry format" | **Partly** | It checks, on both runtimes, in a consumer project, from a subdirectory, in about 5 ms for 2,000 entries, and names the line and entry; but it fails reasonable hand-written glossaries and tells the agent to delete one. Blocking 6. | 5 (real CLI and `mstack hook stop`) |

## Verification I ran

- `npm test` at the head, before any live run: bun `603 pass, 0 fail, Ran 603 tests across 28
  files. [109.29s]`; node `ℹ tests 603 ℹ pass 603 ℹ fail 0`; `exit 0`.
- Rerun with nothing else running, `./bin/mstack gate --full` in a clean clone at `4bf9aea` (its `verify` is `npm test && npm run typecheck && bin/mstack lint-plugin .`): bun `603 pass, 0 fail, Ran 603 tests across 28 files. [109.31s]`; node `ℹ pass 603 ℹ fail 0`; `[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .`; `PASSED - 0 failures, 0 warnings`, rc 0, 2:25 total. The load-sensitive tests (`tests/costs.test.ts`, `tests/run.test.ts`, `tests/launcher.test.ts`) passed in both full runs; the one budget-test failure under mutant M16 was during concurrent load and is not from this diff.
- `bunx --bun tsc --noEmit`: rc 0. `./bin/mstack lint-plugin .`: `PASSED - 0 failures, 0
  warnings`. `./bin/mstack gate` in this checkout: `PASSED - 0 failures, 0 warnings`, with a
  `-- glossary` section.
- `tests/glossary.test.ts` ten times on each runtime: 10 of 10 green on bun and on node (`11
  pass, 0 fail` each).
- `./bin/mstack ledger check glossary-and-adr` before my row: `FAIL no verdict at 4bf9aea2; 1
  row(s) exist at other SHAs and a new head SHA voids them`.
- I did not run `gate --full` in this checkout: it writes `.mstack/verification.tsv`, and the
  brief forbids writing to the repository's `.mstack/` beyond my ledger row. The clean-clone `gate --full` above stands in for it.

## Changes required

1. `GLOSSARY.md:8` - Item: seams are optional; say "and, when it changes behaviour, the seams
   where it is tested".
2. `GLOSSARY.md:37` - Closing role: the excluded set is exactly the implementer and the spec
   author, by role name; drop "such as" and say the rule goes by name.
3. `docs/adr/0001-claude-code-only.md:9` - "worked on for two months" -> built on 2026-08-25,
   then untouched for two months.
4. `docs/adr/0001-claude-code-only.md:5, 7, 9` - give the recorded reason (a product decision
   after a two-month pause, with open defects); the upkeep argument is a consequence, not the
   motive, and "weighed against its upkeep" goes unless the maintainer says it happened.
5. `docs/adr/0001-claude-code-only.md:9` - "a port starts again from nothing" is false in this
   clone; say the branch was deleted unpushed, or argue the first condition from something
   recorded.
6. `src/glossary.ts:75-82, 65-72` and `docs/wiki/Gates-and-Hooks.md:285` - a glossary with no
   `**Term**:` line warns once and is not failed (no "delete the file" hint); a `- ` list marker
   is an entry; `---`, HTML comments and fenced code are skipped. Add a test per style, and one
   for the colon rule (M02).
