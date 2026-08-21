# Review - docs-for-newcomers (round 3, FACTS lens)

**Verdict:** APPROVED

Panel lens, so this pass records **no ledger row** (`agents/reviewer.md:99-102`). Head at
review time: `871f9768d914fd8214e7d83240133e028fcc3b75`. Prior reports:
`review_docs-for-newcomers_facts.md` (round 1), `_r2-facts.md` (round 2).

Confirmation pass over a 19-line documentation diff. Both round-2 findings are fixed, every
clause of the replacement sentence is re-derived below rather than inherited, the four new
glosses trace to their sources, and nothing previously verified moved.

## Requirement to test

| R | Check | Evidence |
|---|---|---|
| "The `Stop` hook runs the fast gate" | every `runGate` call site in `src/` | one hooks-plane site, `src/hooks.ts:172`, inside `stop()`. Rung 2 |
| "at the end of every turn" | `src/hooks.ts:160`, `hooks/hooks.json`, `Gates-and-Hooks.md:26` | consistent. Rung 2 |
| "every pass runs `mstack gate` before it acts" | all five `agents/*.md`, re-grepped | 5/5 carry it. Rung 2 |
| No contradiction left with Gates-and-Hooks | `:23` and `:26` re-read | the SessionStart claim is gone. Rung 2 |
| Both copies say the same thing | verbatim substring test | identical in README and Home. Rung 4 |
| Fan-out gloss | `skills/understand/SKILL.md:28`, `:31` | traces. Rung 2 |
| Worktree gloss | `docs/wiki/The-CLI.md:355-361`, `skills/orchestrate/SKILL.md:25-26` | traces. Rung 2 |
| `[lens](The-Agents.md#reviewer)` | anchor resolves and the destination defines the term | `The-Agents.md:139`, definition at `:148-150`. Rung 4 |
| `[rung](#the-evidence-ladder)` | same-page anchor resolves to the 5-rung table | `Skills-and-Playbooks.md:156`. Rung 4 |
| No transcript or diagram moved | fenced-block compare of every page against `a246026` | zero changed. Rung 4 |
| Counts and listings unchanged | re-derived from the filesystem | 5 / 12 / 7 / 9, tables 12/12/10/7/7/5, 12 bullets. Rung 4 |
| Anchor class | publish rewrite re-run | one joined item 24's class, one is same-page and safe. Rung 4 |

## Round-2 finding 1, re-derived clause by clause

The caption now reads, identically on `README.md:53-55` and `docs/wiki/Home.md:41-43`:

> One box is deliberately missing: the session gate, `mstack gate`, is not a step in this flow.
> The `Stop` hook runs the fast gate at the end of every turn, and every pass runs `mstack gate`
> before it acts, so it can go red at any point in the picture.

**"The `Stop` hook runs the fast gate."** Every `runGate` reference in `src/`:

```console
$ rg -n "runGate" src/
src/hooks.ts:4:import { runGate } from "./gate.ts";
src/hooks.ts:172:  const report = runGate(store, { quiet: true });
src/paths.ts:117:    // every turn (`runGate` on the Stop hook) and on every Bash call
src/cli.ts:8:import { defaultBranch, headSha, itemLabel, runGate } from "./gate.ts";
src/cli.ts:180:  const report = runGate(requireStore(), {
src/gate.ts:64:export function runGate(store: Store, options: GateOptions = {}): Report {
```

One call site in the hooks plane, `src/hooks.ts:172`, and it sits inside `stop()`, declared at
`:167`. The other two are the `gate` subcommand a pass types itself (`src/cli.ts:180`) and the
definition (`src/gate.ts:64`). So the `Stop` hook is the only hook that runs the gate, which is
what the sentence now claims and the opposite of what round 2 claimed.

**"the fast gate."** `runGate(store, { quiet: true })` at `:172`, with no `full` option.
`docs/wiki/Gates-and-Hooks.md:26` says "Runs the fast gate, quiet - never `--full`". The
caption's wording matches the wiki's.

**"at the end of every turn."** `src/hooks.ts:160`, the handler's own doc comment: "Stop: run
the fast gate before the turn ends." `hooks/hooks.json` registers it on `Stop`.
`docs/wiki/Gates-and-Hooks.md:26` fires it when "The main agent is about to end its turn."
Three sources, same claim.

**"every pass runs `mstack gate` before it acts."** Re-grepped rather than taken on trust:

```console
$ for f in agents/*.md; do rg -n "Run .mstack gate. before you act" "$f"; done
agents/implementer.md     58:- Run `mstack gate` before you act. A red gate stops the session; never work around it.
agents/orchestrator.md    55:- Run `mstack gate` before you act. A red gate stops the session; never work around it.
agents/reviewer.md       111:- Run `mstack gate` before you act. A red gate stops the session; never work around it.
agents/spec-author.md     57:- Run `mstack gate` before you act. A red gate stops the session; never work around it.
agents/spec-reviewer.md   48:- Run `mstack gate` before you act. A red gate stops the session; never work around it.
```

Five agent files on disk, five carrying the instruction. `skills/router/SKILL.md:16` opens the
router the same way. The claim is now correctly attributed to instruction rather than to a
hook, which was the substance of the round-2 finding.

**Consistency with Gates-and-Hooks.** The false half is gone: nothing on either page now says
the gate runs at `SessionStart`, so there is no longer a contradiction with
`docs/wiki/Gates-and-Hooks.md:23` ("Prints the active item, its open `decision_required` if
any, and the last checkpoint"). Both pages still send the reader there, and the reader now
finds the same story.

**Both copies agree.** The sentence is byte-identical in the two files:

```console
README.md            contains the sentence verbatim: True
docs/wiki/Home.md    contains the sentence verbatim: True
```

## The four new glosses and links

| Addition | Source | Verdict |
|---|---|---|
| `Skills-and-Playbooks.md:43` "fanning out runs several readers in parallel, each with its own narrow question" | `skills/understand/SKILL.md:28` "Two or three readers in parallel, each with a narrow disjoint question"; `:31` "Narrow questions, disjoint scopes." | traces; "its own" carries the source's "disjoint" |
| `Skills-and-Playbooks.md:30` "[worktrees](The-CLI.md) (each its own checkout of the repository)" | `docs/wiki/The-CLI.md:355-361` shows `mstack worktree new export-json --base main` producing its own directory and branch; `skills/orchestrate/SKILL.md:25-26` "Each worktree carries its own `.mstack/`" | traces; the link target has the `## worktree new / list / prune` section at `:355` |
| `Skills-and-Playbooks.md:48` `[lens](The-Agents.md#reviewer)` | anchor resolves to `The-Agents.md:139`; the section defines the term at `:148-150`: "each with a lens, one assigned focus such as correctness or security" | traces, and the link delivers what it promises at the destination |
| `Skills-and-Playbooks.md:70` `[rung](#the-evidence-ladder)` | same-page anchor to `:156 ## The evidence ladder`, which carries the five-rung table | traces |

The worktree gloss now appears twice on the page (`:30` and `:50`) in the same words. That is
deliberate duplication for a reader who lands on either table, not a contradiction.

## Regression sweep

Source is untouched since round 2, so every source comparison from rounds 1 and 2 stands:

```console
$ git diff a246026..HEAD --stat -- src/ skills/ agents/ hooks/ bin/ scripts/
(empty)
```

Fenced-block compare of every page against `a246026`:

```console
no fenced block changed on any page
```

Zero transcripts moved, and zero mermaid blocks moved, so the round-2 rung-4 results carry
without re-derivation. I re-parsed anyway, since it is cheap:

```console
ok    docs/wiki/How-A-Work-Item-Flows.md:26  diagramType=stateDiagram
ok    docs/wiki/Home.md:20                   diagramType=flowchart-v2
ok    README.md:34                           diagramType=flowchart-v2

PASSED - 3 block(s) parsed by mermaid 11.17.0
Home flowchart === README flowchart: true
```

Counts and listings, re-derived from the filesystem rather than read off the pages:

```console
agents=5 skills=12 playbooks=7 wiki=13 statuses=9

 12  The twelve skills            12  What each skill leaves on disk
 10  The router                    7  The seven playbooks
  7  What each playbook leaves behind
  5  The evidence ladder          prohibition bullets: 12

_Sidebar entries: 10   Home table rows: 10   README doc rows: 11
```

Unchanged from round 2 in every position.

## The anchor class, and item 24

Item 24 `wiki-publish-breaks-md-anchors` is filed and `pending`, with the class as its subject.
Round 3 added two anchor links, and I re-ran the publish rewrite to classify them rather than
reason about the regex:

```console
=== cross-page .md# links surviving the rewrite (item 24's class) ===
./Gates-and-Hooks.md:303   [The-CLI](The-CLI.md#gate)
./The-CLI.md:75            [Gates-and-Hooks](Gates-and-Hooks.md#verification-that-actually-ran)
./The-CLI.md:130           [Gates-and-Hooks](Gates-and-Hooks.md#verification-that-actually-ran)
./The-CLI.md:455           [Gates-and-Hooks](Gates-and-Hooks.md#what-mstack-gate-checks)
./State-Files.md:132       [Gates-and-Hooks](Gates-and-Hooks.md#verification-that-actually-ran)
./The-Agents.md:78         [the evidence ladder](Skills-and-Playbooks.md#the-evidence-ladder)
./Skills-and-Playbooks.md:48  [lens](The-Agents.md#reviewer)

=== same-page #anchors after the rewrite ===
70:- `verify` never records a [rung](#the-evidence-ladder) above what actually ran
```

`The-Agents.md#reviewer` joins the existing class: same shape, same cause, nothing new for
item 24 to characterize. `#the-evidence-ladder` is same-page, carries no `.md`, is untouched by
the rewrite and resolves on the published wiki, so it is outside the class rather than a new
instance of it. Round 3 chose the existing class, as asked. The fix stays with item 24.

One thing for whoever picks item 24 up: its acceptance says "The five pre-existing instances
and the new one", which was six at filing time. The count is now seven. The wording is on
item 24, not on any page here, so it is not a finding against this item.

## Acceptance, quoted - final facts verdict

**"All five agents, all twelve skills and all seven playbooks are documented on wiki pages a
stranger can read: purpose, when it runs, what it writes, what it must not do - consistent
with agents/*.md and skills/*/SKILL.md at the same commit"** - MET.

Counts re-derived this round: 5 agents, 12 skills, 7 playbooks. All four dimensions are
present for all three sets: agents in the cast table (`The-Agents.md:18-24`), the dispatch
table (`:34-43`) and the per-agent sections (`:91-170`); skills across the twelve-row purpose
table (`:19-32`), the twelve-row writes table (`:41-52`) and the twelve prohibition bullets
(`:58-80`); playbooks across the seven-row discipline table (`:117-125`) and the seven-row
leaves-behind table (`:129-137`). In round 2 I checked every one of those 31 rows and 12
bullets against its `SKILL.md` or playbook line and all traced. `skills/` and `agents/` have
not changed since, so that result stands at this commit. Round 3 touched two cells, both
verified above.

**"Pasted output on touched pages is from real ./bin/mstack runs at the editing commit, and
existing verified transcripts are not altered unless re-run"** - MET, rung 4.

No fenced block changed on any page this round, so no transcript was altered. Across the whole
item the only deletion to a pre-existing block is `Publishing-the-Wiki.md:68-72`, the `sd`
file list, which is a command block rather than pasted output and which I re-ran and diffed
against an independent transform in round 1 and again in round 2. Both new transcripts on
`The-Agents.md:64-86` reproduced byte-for-byte from my own scratch-repo run in round 1, and
both the page bytes and the CLI behind them are unchanged since.

**"check-doc-links and lint-plugin pass, and Home.md and _Sidebar.md list every page"** - MET,
rung 4.

```console
$ npm test && npm run typecheck && ./bin/mstack lint-plugin . && node scripts/check-doc-links.mjs README.md docs/wiki/*.md
ℹ tests 276
ℹ pass 276
ℹ fail 0
> bunx --bun tsc --noEmit
PASSED - 0 failures, 0 warnings
100 relative links checked, 0 broken
CHAIN EXIT=0
```

100, up from 99: the one new counted link is `The-Agents.md#reviewer`. The same-page
`#the-evidence-ladder` is a `#`-only target and the checker skips it, which is why I resolved
all fifteen anchors by hand instead: 15/15 OK. `_Sidebar.md` names Home plus the other 10
content pages, `Home.md` tables the 10 others, `README.md` lists all 11. Unchanged this round.

## Verification I ran

The item's verification, exit 0, pasted above. `mstack gate`: `PASSED - 0 failures, 1 warning`
(1 uncommitted change, expected mid-session).

```console
$ ./bin/mstack ledger check docs-for-newcomers
FAIL no verdict at 871f9768; 5 row(s) exist at other SHAs and a new head SHA voids them
```

`git diff 05a7c49 871f976` is `.mstack/ledger.tsv | 1 +`: the round-3 implementer row
committing itself, the same benign chicken-and-egg as rounds 1 and 2. The closing pass owes a
verdict at whatever head it closes on. Recording is not mine. Worth noting that both panel
rounds were typed correctly: one `verifier-failed` row per round under `--verifier
orchestrator`, naming both lens reports as evidence, per `skills/review/SKILL.md:44-48`.

## Non-blocking, carried forward unfixed

These were flagged non-blocking in round 2 and deliberately left. Recording them so they are
not rediscovered as new:

- `Skills-and-Playbooks.md:41` - the router row's first artifact is the todo list, which is
  session state, under a column headed "What it leaves on disk".
- `Skills-and-Playbooks.md:51` - the `reflect` row omits `decisions.tsv`, which
  `skills/reflect/SKILL.md:40` names as a destination and which the "proposed to the human"
  clause at `:49-52` does not cover.
- `Skills-and-Playbooks.md:75` - "`orchestrate` is refused below its threshold" reads as a
  mechanical refusal; `skills/orchestrate/SKILL.md:9-12` makes it an instruction.
- `The-Agents.md:5-6` - "only what it wrote to disk survives it"; the one-line reply survives
  too, though the agents' rules say it is not evidence.
- The EARS expansion is rung 1, as the implementer says out loud.
- New this round, and smaller than all of the above: `src/hooks.ts:168` returns early when
  `stop_hook_active` is true, so "the end of every turn" has a re-entrancy exception.
  `Gates-and-Hooks.md:26` does not mention it either, so the caption is consistent with the
  page it points at.

## Where claims stopped on the ladder

Rung 4 this round for the fenced-block sweep, the anchor resolution, the publish-rewrite
classification, the caption byte-comparison, the mermaid re-parse, the counts, `gate` and the
item's verification. Rung 2 for the caption's four clauses and the four glosses: those are
`file:line` reads against `src/`, `agents/` and `skills/`, and there is nothing to run. The
round-2 rung-5 result stands underneath the caption fix: I ran the shipped `SessionStart`
handler and it emits state with no gate, which is why the old sentence was wrong and the new
one is right.

Still not reached, unchanged across all three rounds: GitHub's own rendering of the two mermaid
blocks. mermaid 11.17.0 parses all three, `stateDiagram-v2` and `flowchart` with a `subgraph`
are GitHub-documented, but nothing on github.com was observed by any pass. One glance at the
PR preview closes it, and it is the only claim in this item I would not call settled.
