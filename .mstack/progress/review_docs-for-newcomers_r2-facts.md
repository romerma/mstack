# Review - docs-for-newcomers (round 2, FACTS lens)

**Verdict:** CHANGES_REQUESTED

Panel lens, so this pass records **no ledger row** (`agents/reviewer.md:99-102`). Head at
review time: `a2460265cdf16865d11686a284e0d575a81baaa6`. Round-1 report:
`.mstack/progress/review_docs-for-newcomers_facts.md`.

All four round-1 findings are fixed. The round-2 additions are largely sound: I checked all
twelve leaves-on-disk rows, all twelve prohibition bullets and all seven playbook rows against
their skill files, and every one traces. One new sentence, added in round 2 to the README first
screen and to Home, states when the session gate runs and is wrong on both halves against the
hook it describes.

## Requirement to test

| R | Check | Evidence |
|---|---|---|
| 12 skill leaves-on-disk rows | each row read against its `SKILL.md` | all 12 trace; table below. Rung 2, two at rung 4 |
| 12 prohibition bullets | each read against its `SKILL.md` | all 12 trace; `docs/wiki/Skills-and-Playbooks.md:58-80`. Rung 2 |
| 7 playbook leaves-behind rows | each read against `skills/router/playbooks/*.md` | all 7 trace; table below. Rung 2 |
| Reworked flowchart parses | mermaid 11.17.0 `parse()` under jsdom | 3/3 ok, 2 mutants rejected. Rung 4 |
| Home and README flowcharts identical | byte compare of the extracted blocks | `true`. Rung 4 |
| Orchestrator dispatches the three passes | `agents/orchestrator.md:24-31` | spec-author, spec-reviewer, implementer, reviewer all dispatched. Rung 2 |
| merge-gate decides landing | `skills/ship/SKILL.md:21-26`, `agents/orchestrator.md:31`, `src/mergegate.ts` exists | Rung 2 |
| Router "or a skill directly" | `skills/router/SKILL.md:29-42` | 3 of 10 rows go to a skill. Rung 2 |
| "session gate runs at the start and end of every session" | ran the real `SessionStart` handler; read `src/hooks.ts` | **FAILS**, finding 1. Rung 5 |
| Round-1 findings 1-4 | re-read at their locations | all four fixed. Rung 2 |
| No verified transcript moved | fenced-block compare of every page against `2a4c17c` | only the 2 mermaid blocks changed. Rung 4 |
| Counts | re-derived from the filesystem | 5 / 12 / 7 / 9 unchanged. Rung 4 |
| Anchors | GitHub-slug resolver over all `#` links | 13/13 resolve, including the new one. Rung 4 |

## Acceptance, quoted

**"All five agents, all twelve skills and all seven playbooks are documented on wiki pages a
stranger can read: purpose, when it runs, what it writes, what it must not do - consistent
with agents/*.md and skills/*/SKILL.md at the same commit"** - MET, and better than in round 1.

My round-1 caveat was that skills and playbooks carried only two of the four promised
dimensions. Round 2 closes it. Counts re-derived, not read off the page:

```console
agents:    5      skills:    12     playbooks: 7      statuses:  9
```

Section row counts on `docs/wiki/Skills-and-Playbooks.md`: 12 / 12 / 10 / 7 / 7 / 5. No
skill or playbook is missing, none is invented.

Every leaves-on-disk row against its source (`docs/wiki/Skills-and-Playbooks.md:41-52`):

| Row | Source | Verdict |
|---|---|---|
| `/mstack` steps in todo list + rows the routed passes earn | `skills/router/SKILL.md:20-21`, `:108-118` | traces |
| `/mstack:setup` store files, seeded items, `CLAUDE.md` note | `skills/setup/SKILL.md:15-16`, `:34-38`, `:52-59` | traces; file list exact, including "an empty `specs/`" |
| `/mstack:understand` `explore_<topic>.md` per reader; one-file question writes nothing | `skills/understand/SKILL.md:30-31`, `:26` | traces; the "writes nothing" half is a correct claim of absence off "No fan-out" |
| `/mstack:design` `design.md`, **or** a decision row when there is no spec | `skills/design/SKILL.md:37` | traces; the conditional is preserved word for word ("or a decision row if there is no spec") |
| `/mstack:spec` the four artifacts; unsettleable fork becomes `decision_required` | `skills/spec/SKILL.md:13-14`, `:35-38` | traces; the four filenames come from `agents/spec-author.md:11-12`, not from `SKILL.md`, but they are correct |
| `/mstack:implement` code and tests, `impl_<slug>.md`, decision rows, live `current.md` | `skills/implement/SKILL.md:33-45`, `:49`, `:27-31`, `:24` | traces |
| `/mstack:verify` one ledger row with five named fields | `skills/verify/SKILL.md:16-17` | traces |
| `/mstack:review` one report per lens at fanout-allocated paths, one row per round | `skills/review/SKILL.md:12-19`, `:39` | traces; "one ledger row per review round" is verbatim |
| `/mstack:ship` PR, verdict at the merge SHA **if it has none**, close, history append, current reset | `skills/ship/SKILL.md:14`, `:31-35` | traces; conditional preserved |
| `/mstack:orchestrate` item per unit, worktree per concurrent unit with base SHA, report per worker | `skills/orchestrate/SKILL.md:25-28`, `:55-56`; `playbooks/orchestrate.md:13-18` | traces |
| `/mstack:reflect` appended `history.md`; workflow changes proposed, never unilateral | `skills/reflect/SKILL.md:54-57`, `:49-52` | traces; unconditional in the source, unconditional on the page |
| `/mstack:unslop` nothing of its own | whole file read; no artifact named anywhere | traces (claim of absence, rung 3) |

Two rows checked at rung 4 rather than 2, because the brief called them out as conditional or
inferred:

```console
$ ./bin/mstack fanout plan --kind review --worker correctness --worker security
  correctness	/Users/romerma/Code/mstack/.mstack/progress/review_docs-for-newcomers_correctness.md
  security	/Users/romerma/Code/mstack/.mstack/progress/review_docs-for-newcomers_security.md
```

confirms the `/mstack:review` row's "paths allocated up front by `mstack fanout plan`" and
that they land under `.mstack/progress/`. And `setup`'s "an empty `specs/`":

```console
$ fd . <scratch>/.mstack --max-depth 1
.mstack/.gitignore  .mstack/decisions.tsv  .mstack/ledger.tsv
.mstack/progress/   .mstack/specs/         .mstack/state.json
```

All twelve prohibition bullets (`:58-80`) trace: router `:23-25`; setup `:16-17`, `:42-43`;
understand `:34-36`; design `:14-18`, `:44`; spec `:13-14`, `:55-64` plus router `:54-56`;
implement `:19-20`, `:39`; verify `:18-19`, `:20-21`; review `:9`, `:41-43`; ship `:27-28`,
`:29-30`; orchestrate `:9-12`; reflect `:49-52`, `:54-57`; unslop `:8-9`. None invented.

All seven playbook rows (`:129-137`) trace: investigate `:10`, `:15`; bug-fix `:11`, `:18`;
feature `:5-6`, `:15`, `:18`; refactor `:6`, `:13`; resume `:14`; cleanup `:16-18`;
orchestrate `:13-18`, `:32-33`.

The item-15 grammar is unchanged and still current (`docs/wiki/The-Agents.md:148-152` against
`agents/reviewer.md:42-49`). The new panel and lens definitions at `:146-148` match
`skills/review/SKILL.md:20-26`. The rewritten `(target, sha)` cell at `:165` - "keeps one
winning row per item and commit, preferring the most favorable verdict" - matches
`src/ledger.ts:151` (`reduce` on `RANK`, `live-verified` 3 down to `verifier-failed` 0).

**"Pasted output on touched pages is from real ./bin/mstack runs at the editing commit, and
existing verified transcripts are not altered unless re-run"** - MET, rung 4.

Every fenced block on every page compared byte-wise against `2a4c17c`:

```console
page                               r1 blocks r2 blocks  changed fenced blocks
README.md                                 11        11  indices [0]
docs/wiki/Home.md                          1         1  indices [0]
```

Index 0 on both is the flowchart. **No console transcript changed anywhere** - not the two
gate transcripts on `The-Agents.md`, not the three on `How-A-Work-Item-Flows.md`, not
Getting-Started's or The-CLI's. `Publishing-the-Wiki.md` is untouched in round 2, so the -2
deletion I cleared at rung 4 in round 1 is the only one in the item.

`src/`, `skills/`, `agents/`, `hooks/`, `bin/` and `scripts/` are unchanged since `2a4c17c`
(`git diff 2a4c17c..HEAD --stat` over those paths is empty), so my round-1 rung-4
reproduction of both gate transcripts stands without re-running: identical bytes on the page,
identical CLI underneath.

I re-ran the publish rewrite anyway, because round 2 added intra-wiki links even though
`Publishing-the-Wiki.md` did not move. Both `sd` commands on fresh copies of all 13 files,
compared against an independent link-only transform: still byte-identical, still touching
link targets and nothing else, `Publishing-the-Wiki.md` still untouched by its own rewrite.

**"check-doc-links and lint-plugin pass, and Home.md and _Sidebar.md list every page"** - MET,
rung 4.

```console
$ npm test && npm run typecheck && ./bin/mstack lint-plugin . && node scripts/check-doc-links.mjs README.md docs/wiki/*.md
ℹ tests 276
ℹ pass 276
ℹ fail 0
> bunx --bun tsc --noEmit
PASSED - 0 failures, 0 warnings
99 relative links checked, 0 broken
CHAIN EXIT=0
```

99, up from 91: the eight new links are the jargon fixes. No page was added or removed, so the
listing result from round 1 is unchanged - `_Sidebar.md` names Home plus the other 10 content
pages, `Home.md:57-66` tables the 10 others, `README.md:411-421` lists all 11.

## Round-1 findings, re-checked at their locations

| # | Round-1 finding | Now | Confirmed against |
|---|---|---|---|
| 1 | S&P opening claimed all routes go to playbooks | `:4-5` now "one of seven playbooks, or sends it straight to a single skill when one command covers the whole job" | `skills/router/SKILL.md:29-42`: 3 of 10 rows go to `/mstack:verify`, `/mstack:review`, `/mstack:ship`. Accurate |
| 2 | Getting-Started opener omitted the runtime | `:3-4` now "Claude Code, `bun` or `node` 22.6 or newer, and a repository" | matches its own Prerequisites at `:19-22` |
| 3 | `src/lifecycle.ts:63-73` for `TRANSITIONS` | `How-A-Work-Item-Flows.md:56` now `:85-95` | `rg -n "export const TRANSITIONS" src/lifecycle.ts` -> 85; object closes at 95. Correct |
| 4 | `src/cli.ts:479-489` for the decision gate | `:116` now `:497-507` | the `has an unanswered decision` throw is `src/cli.ts:497-507`. Correct |

Both round-1 non-blocking notes were also taken: the reviewer cast cell now reads "its own
ledger row when reviewing alone" (`The-Agents.md:24`), and "small enough to read whole" is
gone from `State-Files.md:6`.

## Verification I ran

Item verification, exit 0 - pasted above. `mstack gate`: `PASSED - 0 failures, 1 warning`
(the warning is 2 uncommitted changes, expected mid-session).

Mermaid, re-parsed the way round 1 did it (mermaid 11.17.0 + jsdom, scratch `node_modules`
outside the repo):

```console
ok    docs/wiki/How-A-Work-Item-Flows.md:26  diagramType=stateDiagram
ok    docs/wiki/Home.md:20                   diagramType=flowchart-v2
ok    README.md:34                           diagramType=flowchart-v2

PASSED - 3 block(s) parsed by mermaid 11.17.0
```

Two mutants against the **new** subgraph shape, both rejected, so the parse has teeth on the
part that changed:

```console
FAIL  MUT-unclosed-subgraph:0  Expecting ... 'subgraph', 'end', ... got '1'
FAIL  MUT-broken-arrow:0       Parse error on line 10: ...spec -->> impl... got 'TAGEND'
FAILED - 2
```

Structure of the reworked flowchart:

```console
Home flowchart === README flowchart: true
nodes declared: you, router, steps, orch, spec, impl, review, ledger, merge, merged
edge lines: 10
subgraph label: dispatched, pass by pass, by the orchestrator
```

The state diagram did not move (byte-identical to round 1) and `src/lifecycle.ts` did not
move, so its 18-edge match against `TRANSITIONS` stands from round 1 without re-derivation.

Ledger:

```console
$ ./bin/mstack ledger check docs-for-newcomers
FAIL no verdict at a2460265; 3 row(s) exist at other SHAs and a new head SHA voids them
```

`git diff 06899f1 a246026` is `.mstack/ledger.tsv | 1 +` - the round-2 implementer row
committing itself. Same benign chicken-and-egg as round 1. Worth recording that the round-1
panel verdict was typed correctly: one `verifier-failed` row at `2a4c17c7` under
`--verifier orchestrator`, naming both lens reports as evidence, exactly per
`skills/review/SKILL.md:44-48`.

## Changes required

1. **`README.md:47-48` and `docs/wiki/Home.md:41-43`** - "One box is deliberately missing: the
   session gate, `mstack gate`, is not a step in this flow. It runs at the start and end of
   every session and can go red at any point in the picture." The first clause is right and
   answers my round-1 note. The second sentence is wrong on both halves.

   **Not at the start of a session.** `SessionStart` prints state and nothing else. Run
   against this very repository:

   ```console
   $ echo '{"cwd":"...","hook_event_name":"SessionStart"}' | ./bin/mstack hook session-start
   {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":
     "mstack state for this repository:\n- Active item 23 `docs-for-newcomers` is reviewing.\n
      \nLast recorded checkpoint (.mstack/progress/current.md): ..."}}
   ```

   No gate, no failures, no exit code. `src/hooks.ts:65-85` builds that string and returns;
   `runGate` is imported at `src/hooks.ts:4` and called at exactly one site, `:172`, inside
   the `Stop` handler. `hooks/hooks.json:4-17` describes the SessionStart command as "Put the
   active item and the last checkpoint back in front of the model." The gate does get run at
   the start of a pass, but by instruction (`skills/router/SKILL.md:16`, and the "Rules that
   hold for every mstack role" block in all five `agents/*.md`), not by any mechanism.

   **Not once per session at the end, either.** `src/hooks.ts:160` is "Stop: run the fast gate
   before the turn ends", and it fires at the end of every turn.

   Both statements contradict `docs/wiki/Gates-and-Hooks.md:23` and `:26`, the page the very
   next sentence sends the reader to for "both gates". Rung 5 on the SessionStart half (ran
   the shipped handler in the running system), rung 2 on the Stop half.

   Fix: something like "Every pass runs it before it acts, and the `Stop` hook runs it again
   at the end of every turn, so it can go red at any point in the picture." Both copies, they
   are currently identical prose.

## Non-blocking, recorded so it is not rediscovered

- `docs/wiki/Skills-and-Playbooks.md:41` - the column is "What it leaves on disk" and the
  router row's first artifact is "the matched playbook's steps in the todo list". The todo
  list is session state, not a file in the repository. Every other cell in the table is a
  real path.
- `docs/wiki/Skills-and-Playbooks.md:51` - the `reflect` row names only `history.md`.
  `skills/reflect/SKILL.md:40` also routes "a decision with lasting consequences" to
  `decisions.tsv`, and that is not covered by the "proposed to the human" clause at `:49-52`,
  which is scoped to skills, agents and hooks. Under-lists rather than misstates.
- `docs/wiki/The-Agents.md:78` - the new `](Skills-and-Playbooks.md#the-evidence-ladder)`
  survives the publish rewrite with `.md#` intact, because the `sd` pattern at
  `Publishing-the-Wiki.md:68` requires `.md)`. On the published wiki, where pages are
  addressed without the extension, it would not resolve. Pre-existing class, not a regression:
  five other instances already exist (`Gates-and-Hooks.md:303`, `The-CLI.md:75,130,455`,
  `State-Files.md:132`). This is the sixth, and `check-doc-links` cannot see it because the
  link resolves in-repo. Worth one line in Publishing-the-Wiki's "Two deliberate scopings"
  paragraph, on its own item.
- `docs/wiki/Skills-and-Playbooks.md:75` - "`orchestrate` is refused below its threshold"
  reads as a mechanical refusal. `skills/orchestrate/SKILL.md:9-12` and its frontmatter make
  it an instruction; nothing enforces it. The other eleven bullets are self-imposed too, so
  the register is at least consistent.
- `docs/wiki/The-Agents.md:5-6` - "only what it wrote to disk survives it". The one-line reply
  survives as well; the agents' rules say only that it is not evidence.
- The EARS expansion at `The-Agents.md:109`, `Skills-and-Playbooks.md:25` and
  `State-Files.md:178` is rung 1, as the implementer says out loud. `skills/spec/references/ears.md`
  exists and carries the fixed forms (rung 2) but never spells the acronym out.

## Where claims stopped on the ladder

Rung 5 for the SessionStart finding: I ran the shipped hook handler against this repository
and read its output. Rung 4 for the mermaid parse and its mutants, the flowchart identity, the
fenced-block regression sweep, the anchor resolution, the counts, the `fanout plan` and
`setup` artifact checks, the publish rewrite, `gate`, and the item's verification. Rung 2 for
the prose-to-source comparisons: all twelve writes rows, all twelve prohibitions, all seven
playbook rows, the dispatch and route tables, and the four round-1 fixes.

Carried from round 1 without re-derivation, because both the page bytes and the source bytes
are unchanged: the two gate transcripts on `The-Agents.md`, the 18-edge state-diagram match,
and the `blocked` note. Pages that needed re-checking this round: README, Home,
Skills-and-Playbooks, The-Agents, How-A-Work-Item-Flows, Getting-Started, State-Files,
Status-Line. Pages that did not: The-Story, Gates-and-Hooks, The-CLI, Publishing-the-Wiki,
_Sidebar, _Footer.

Still not reached: GitHub's own rendering of the two mermaid blocks. mermaid 11.17.0 accepts
both, including the new `subgraph`, but nothing on github.com was observed by this pass. The
subgraph is new since round 1, so the PR preview glance is now worth slightly more than it was.
