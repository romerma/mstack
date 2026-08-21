# Review - docs-for-newcomers (FACTS lens)

**Verdict:** CHANGES_REQUESTED

Panel lens, so this pass records **no ledger row** (`agents/reviewer.md:99-102`). Head SHA at
review time: `2a4c17c7e2fe07613213acec2cecca4aa124285a`.

Scope: every claim on the touched pages is true of the shipped code at this commit. Reader
experience belongs to the sibling lens. Four claims do not reproduce; the rest of the page
content checks out, including all of the item-15 grammar the brief flagged.

## Requirement to test

Docs item: "test" means the check that would catch a regression.

| R | Check | Evidence |
|---|---|---|
| Cast table + per-agent sections vs `agents/*.md` | Frontmatter/body read line by line | tool lists at `agents/orchestrator.md:4`, `agents/reviewer.md:4`, `agents/spec-reviewer.md:4`, `agents/spec-author.md:4`, `agents/implementer.md:4`. Rung 2 |
| "Three of the five ship without Write and without Edit" | Same frontmatter | orchestrator `Read, Glob, Grep, Bash, Agent`; reviewer and spec-reviewer `Read, Glob, Grep, Bash`. Exactly three. Rung 2 |
| Report-name grammar (post-item-15) | `agents/reviewer.md:42-49` | all four forms match verbatim. Rung 2 |
| Who records which ledger row | `agents/reviewer.md:81-102`, `agents/implementer.md:44-45`, `agents/spec-*.md` (no `ledger` match) | matches, including the `verifier-failed`-on-green and `verifier-blocked` rules. Rung 2/4 |
| Gate refuses an implementer-only close | Re-run in a scratch repo | reproduced byte-for-byte, below. Rung 4 |
| Dispatch table | `agents/orchestrator.md:24-31` | all six rows identical. Rung 2 |
| Twelve skills / seven playbooks | `fd SKILL.md skills` = 12, `fd . skills/router/playbooks` = 7 | Rung 4 |
| Route table | `skills/router/SKILL.md:31-42` | all ten left-hand cells verbatim. Rung 2 |
| Three spec-path triggers | `skills/router/SKILL.md:47-51` | all three present. Rung 2 |
| stateDiagram vs `TRANSITIONS` | script imports the shipped module and diffs edge sets | 18 = 18, zero extra, zero missing. Rung 4 |
| `blocked` note, both claims | `canTransition` executed over all statuses | exact. Rung 4 |
| Mermaid well-formedness | mermaid 11.17.0 `parse()` under jsdom, plus mutants | 3 ok, 2 mutants fail. Rung 4 |
| `check-doc-links` sees the new pages | mutation in a scratch copy | broken count 6 -> 7. Rung 4 |
| Anchors resolve | GitHub-slug resolver over every `#` link | 12/12 OK. Rung 4 |
| Publishing-the-Wiki `sd` re-run claim | both commands re-run on fresh copies, diffed against an independent Python transform | byte-identical. Rung 4 |

## Acceptance, quoted

**"All five agents, all twelve skills and all seven playbooks are documented on wiki pages a
stranger can read: purpose, when it runs, what it writes, what it must not do - consistent
with agents/*.md and skills/*/SKILL.md at the same commit"** - MET on the facts half.

Counts re-derived from the filesystem, not from the page:

```console
$ fd . agents --type f | wc -l
5
$ fd SKILL.md skills --type f | wc -l
12
$ fd . skills/router/playbooks --type f | wc -l
7
```

The four attributes are all present for the five agents: purpose and "must never" in the cast
table (`docs/wiki/The-Agents.md:16-22`), "when it runs" in the dispatch table (`:32-41`),
"what it writes" in the cast table and again per agent (`:88-157`). Every cell traces to the
source: `orchestrator` "Write application code, or approve its own work" is
`agents/orchestrator.md:3`; `implementer` "Mark its own work approved or done" is
`agents/implementer.md:51`; `spec-reviewer` "Edit the spec, or review a spec it wrote" is
`agents/spec-reviewer.md:9-12`.

All twelve skills appear once each and none is invented; each row's sentence is a faithful
compression of its frontmatter `description` (spot-checked all twelve against the dump of
`rg '^description:' skills/*/SKILL.md`). Same for the seven playbooks: each "Its discipline"
cell is traceable - `bug-fix` steps 1/3/7, `feature` step 4 ("Mandatory, with no
skip-with-reason escape"), `refactor` steps 1/6, `resume` steps 2-5, `cleanup` steps 2/4/5,
`orchestrate` steps 4/5, `investigate` step 4.

The item-15 grammar is current, not pre-15. `docs/wiki/The-Agents.md:143-148` gives all four
forms (`review_<slug>.md`, `_<lens>`, `_r<N>`, `_r<N>-<lens>`) exactly as
`agents/reviewer.md:42-49` defines them, and `:152-157` gets the four ledger cases right
including "panel lens records nothing, the synthesizer records one row under its own name"
(`agents/reviewer.md:99-102`) and "spec-author, spec-reviewer: no ledger rows" (confirmed:
`rg -n ledger agents/spec-author.md agents/spec-reviewer.md` -> no match).

One caveat, not blocking: the skills table gives purpose and when-to-use but not "what it
writes / must not do". No `SKILL.md` carries such a contract, so there is nothing to be
inconsistent with; the four attributes only have a source for the agents.

**"Pasted output on touched pages is from real ./bin/mstack runs at the editing commit, and
existing verified transcripts are not altered unless re-run"** - MET, rung 4.

Both new transcripts re-run from scratch in
`<scratchpad>/agents-repro` with this checkout's `./bin/mstack` (my own repo, my own item,
never touched):

```console
$ mstack ledger record greet-flag "$(git rev-parse HEAD)" test-verified \
    --evidence ".mstack/progress/impl_greet-flag.md" --verifier implementer
recorded test-verified for greet-flag at f2f22f76

$ mstack state set greet-flag --status done --force --closed-by "demo: skipping review on purpose"
1 greet-flag (done)
  status: "in_progress" -> "done"
  closed_by: (unset) -> "demo: skipping review on purpose"

$ mstack gate
[fail]  items closed on a verdict from the pass that wrote the code: greet-flag (only implementer)
        fix: a closing verdict has to come from somewhere other than the implementer; run the verification again from a pass that did not write it
FAILED - 1 failure, 2 warnings

$ mstack ledger record greet-flag "$(git rev-parse HEAD)" test-verified \
    --evidence ".mstack/progress/review_greet-flag.md" --verifier reviewer
recorded test-verified for greet-flag at f2f22f76

$ mstack gate
[ok]    1 closed item(s) carry a ledger verdict
PASSED - 0 failures, 2 warnings
```

Identical to `docs/wiki/The-Agents.md:64-86` except the scratch SHA (`f2f22f76` here vs
`62849b5a` on the page - expected, different scratch repo; the page uses the same SHA in both
blocks, which is the claim "at the same SHA", and that is what my run shows too).

No pre-existing transcript changed. Deletions per touched file:

```console
$ for f in README.md docs/wiki/*.md; do ... git diff main...HEAD --numstat -- "$f" ...
README.md  +40 -0          docs/wiki/_Footer.md  +0 -0     docs/wiki/_Sidebar.md  +2 -0
Gates-and-Hooks.md  +6 -0  Getting-Started.md  +6 -0       Home.md  +28 -0
How-A-Work-Item-Flows.md  +41 -0                           Publishing-the-Wiki.md  +8 -2
Skills-and-Playbooks.md  +107 -0                           State-Files.md  +5 -0
Status-Line.md  +5 -0      The-Agents.md  +163 -0          The-CLI.md  +5 -0
The-Story.md  +4 -0
```

The only deletion anywhere is `docs/wiki/Publishing-the-Wiki.md:68-72`, the `sd` file list,
and that is a command block with no pasted output, not a transcript. The page's claim at
`:91-93` ("Both commands were run against a fresh copy of these files and the result diffed
against the originals ... the diff touches link targets and nothing else, this page
included") is the thing that needed re-earning, so I re-earned it independently: both `sd`
commands run on fresh copies of all 13 wiki files, then compared against a Python transform
that rewrites links and nothing else.

```console
Gates-and-Hooks.md   MATCH  changed      Publishing-the-Wiki.md  MATCH  untouched
Getting-Started.md   MATCH  changed      Skills-and-Playbooks.md MATCH  changed
Home.md              MATCH  changed      State-Files.md          MATCH  changed
How-A-Work-Item-Flows.md MATCH changed   Status-Line.md          MATCH  untouched
The-Agents.md        MATCH  changed      The-CLI.md              MATCH  changed
The-Story.md         MATCH  changed      _Footer.md              MATCH  untouched
_Sidebar.md          MATCH  changed

independent transform matches sd output byte for byte
```

`Publishing-the-Wiki.md` untouched by its own rewrite, matching the prose at `:76-80`. The
list is 12 files = 13 wiki files minus `Publishing-the-Wiki.md`, and both new pages are in it.

**"check-doc-links and lint-plugin pass, and Home.md and _Sidebar.md list every page"** - MET,
rung 4.

```console
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
91 relative links checked, 0 broken
```

The checker has teeth on the new pages, not just on old ones - mutating `](The-CLI.md)` to
`](The-CLI-typo.md)` in a scratch copy of `The-Agents.md` moved the broken count from 6 to 7
(the 6 are my scratch copy missing `docs/research/`, `CONTRIBUTING.md`, `SECURITY.md`):

```console
BROKEN  docs/wiki/The-Agents.md: (The-CLI-typo.md) -> .../docs/wiki/The-CLI-typo.md
91 relative links checked, 7 broken
```

Listing: `docs/wiki/` holds 13 files = 11 content pages + `_Sidebar.md` + `_Footer.md`.
`_Sidebar.md` names Home plus the other 10 (`:1-12`). `Home.md:51-60` tables the 10 others and
is itself the page. `README.md:405-415` lists all 11. Both new pages are in all three.

The link checker skips `#`-only targets, so I resolved every anchor by hand with a
GitHub-slug resolver: 12/12 OK, including `#verificationtsv`, `#development`,
`Gates-and-Hooks.md#verification-that-actually-ran`, `The-CLI.md#gate`. The two new pages
carry no anchor links at all, so the known gap does not touch them.

## Verification I ran

`mstack gate --full` (exit 0):

```console
PASSED - 0 failures, 0 warnings
91 relative links checked, 0 broken
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin . && node scripts/check-doc-links.mjs README.md docs/wiki/*.md

PASSED - 0 failures, 1 warning
```

The item's own `verification` field, run separately (exit 0):

```console
ℹ tests 276
ℹ pass 276
ℹ fail 0
=== TYPECHECK ===
> bunx --bun tsc --noEmit
=== LINT-PLUGIN ===
PASSED - 0 failures, 0 warnings
=== DOC LINKS ===
91 relative links checked, 0 broken
EXIT=0
```

Mermaid, parsed by the real parser (mermaid 11.17.0, jsdom shim, scratch `node_modules`
outside the repo - no runtime dependency added here):

```console
ok    docs/wiki/How-A-Work-Item-Flows.md:26  diagramType=stateDiagram
ok    docs/wiki/Home.md:20                   diagramType=flowchart-v2
ok    README.md:34                           diagramType=flowchart-v2

PASSED - 3 block(s) parsed by mermaid 11.17.0
```

The validator can fail - two injected mutants were both rejected:

```console
FAIL  MUTANT:0   Expecting 'ID', 'EDGE_STATE', got 'NL'
FAIL  MUTANT2:0  Expecting 'TAGEND', 'STR', 'MD_STR', ... got 'SQS'
FAILED - 2
```

Home and README carry byte-identical flowcharts (`Home flowchart === README flowchart: true`).

Lifecycle diagram vs the shipped module (edges parsed out of the page, `TRANSITIONS`
imported from `src/lifecycle.ts`):

```console
diagram edges (excluding [*]): 18
TRANSITIONS edges: 25  of which blocked->*: 7
in diagram but NOT in TRANSITIONS: none
in TRANSITIONS but NOT in diagram (blocked excluded, drawn as note): none
statuses count: 9
in_progress->done in diagram: false
```

The diagram and the table at `docs/wiki/How-A-Work-Item-Flows.md:58-68` agree row for row.
The `blocked` note's two claims, executed rather than read:

```console
NOT into blocked from: done, cancelled
out of blocked to: pending, specifying, spec_ready, in_progress, reviewing, verifying, cancelled
NOT out of blocked to: done
```

Exactly "reachable from any status except done and cancelled; leaves to any status except done
and blocked".

Ledger, at the current head:

```console
$ ./bin/mstack ledger check docs-for-newcomers
FAIL no verdict at 2a4c17c7; 1 row(s) exist at other SHAs and a new head SHA voids them
```

The only row is `test-verified` by `implementer` at `7d84e0d6`, and `git diff 7d84e0d 2a4c17c`
is `.mstack/ledger.tsv | 1 +` - the ledger row commit itself. Benign, but the closing pass owes
a fresh verdict at whatever head it closes on. Recording it is not mine (panel lens).

## Changes required

1. **`docs/wiki/Skills-and-Playbooks.md:3-5`** - "a router matches your request to one of seven
   playbooks and copies its steps into the todo list" is false for three of the ten routes.
   `skills/router/SKILL.md:31-42` routes "Proving a change actually works" to `/mstack:verify`,
   "Judging work that already exists" to `/mstack:review`, and "Getting a change merged" to
   `/mstack:ship` - skills, not playbooks, with no step list to copy. The page's own route table
   at `:30-41` shows this three rows from the end, so the opening contradicts the section it
   introduces. Fix: "matches your request to one of seven playbooks or straight to a skill",
   or similar.

2. **`docs/wiki/Getting-Started.md:3-4`** - "You need Claude Code and a repository you can
   experiment in" understates the prerequisites the same page states at `:19-22`: "Claude
   Code" **and** "`bun`, or `node` 22.6 or newer". A reader with neither runtime follows the
   opening and the launcher fails. Fix: name the runtime in the opening, or point at the
   Prerequisites section instead of enumerating.

3. **`docs/wiki/How-A-Work-Item-Flows.md:56`** - "The legal transitions, from `TRANSITIONS`
   (`src/lifecycle.ts:63-73`)". `TRANSITIONS` is at `src/lifecycle.ts:85-95`; lines 63-73 are
   prose inside the `VERIFICATION_REQUIRED_FROM` doc comment. Pre-existing drift (`src/` is
   unchanged on this branch), but this item added a diagram two lines above it that is derived
   from that exact constant, so it is a claim on a touched page that does not reproduce. Fix:
   `src/lifecycle.ts:85-95`. The three other citations on the page are correct
   (`:10-20` STATUSES, `:25-31` ACTIVE_STATUSES, `:49-55` DECISION_REQUIRED_FROM, and
   `src/roles.ts:64` is exactly `MIN_REPORT_BYTES = 40`).

4. **`docs/wiki/How-A-Work-Item-Flows.md:116`** - "the CLI and the gate both refuse to move the
   item until the fork is answered (`src/lifecycle.ts:49-55`, `src/cli.ts:479-489`)". The CLI
   refusal is `src/cli.ts:497-507`; 479-489 is the `--force`/clears preamble. Same class as (3),
   same one-line fix.

## Non-blocking, recorded so it is not rediscovered

- `README.md:43` / `docs/wiki/Home.md:28` - the diagram routes the ledger verdict off the
  `APPROVED` edge only. `agents/reviewer.md:92-97` records a row on `CHANGES_REQUESTED` too
  (`verifier-failed`, even on a green suite). The compression is defensible for an orientation
  diagram; flagging it because a reader takes "a verdict means approval" away from it.
- `README.md:44` / `docs/wiki/Home.md:29` - the node before "Merged, item done" is labelled
  `mstack gate green`. What decides a merge is `mstack merge-gate <pr>`
  (`skills/ship/SKILL.md` step 4; `agents/orchestrator.md:31` dispatches `verifying` to it).
  The session gate is also required at close (`skills/router/SKILL.md`, "Closing a session"),
  so nothing here is false - the node just names the wrong one of the two gates for the arrow
  it sits on.
- `docs/wiki/The-Agents.md:20` - the cast table gives `reviewer` "its own ledger row"
  unqualified. True reviewing alone, false as a panel lens; the page corrects itself at
  `:152-157`.
- `docs/wiki/State-Files.md:5` - "each one is small enough to read whole". In this store
  `decisions.tsv` is 61 KB. Soft claim, cheap to soften.
- `canTransition("blocked","blocked")` returns `true` via the `from === to` short-circuit, so
  the note's "leaves to any status except done and blocked" is true of `TRANSITIONS` but not
  literally of `canTransition`. A no-op self-transition, and the note points at the table as
  the precise reference. Mentioned only for completeness.

## Where claims stopped on the ladder

Rung 4 for everything executable: both new transcripts, the mermaid parse and its mutants, the
diagram-vs-`TRANSITIONS` edge diff, the `blocked` note via `canTransition`, the `sd` re-run,
the link-checker mutation, the anchor resolution, the counts, `gate --full`, and the item's
verification. Rung 2 for the prose-to-source comparisons (cast table, dispatch table, skill and
playbook descriptions, route table, report-name grammar, ledger-row table) - those are
`file:line` reads, and there is nothing to run.

Not reached: GitHub's actual rendering of the two mermaid blocks. The implementer flagged this
honestly at rung 2 and I cannot do better from here - mermaid 11.17.0 accepts both, and
`stateDiagram-v2` and `flowchart` are the two most common GitHub-supported types, but no render
on github.com was observed by this pass. Someone should glance at the PR preview.
