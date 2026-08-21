# Review - docs-for-newcomers (reader lens)

**Verdict:** CHANGES_REQUESTED

Lens: the experience of a stranger who installed the plugin, has not read the source, and
wants to know what this thing is and how to drive it. The facts lens owns consistency with
`agents/` and `skills/`; where I name a factual doubt I name it in one line and leave it.

## Verification I ran

`./bin/mstack gate --full` - exit 0.

```
-- state
[ok]    one active item: docs-for-newcomers (reviewing)
[ok]    16 closed item(s) carry a ledger verdict
-- workspace
[warn]  2 uncommitted change(s); expected mid-session, not at close
-- verification
 276 pass / 0 fail (bun), pass 276 / fail 0 (node --test)
PASSED - 0 failures, 0 warnings        <- lint-plugin
91 relative links checked, 0 broken    <- check-doc-links
PASSED - 0 failures, 1 warning
[exited with code 0]
```

The item's own `verification` field, run command by command:

```
npm test                                                   TEST_EXIT=0
npm run typecheck                                          TC_EXIT=0
./bin/mstack lint-plugin .                                 LINT_EXIT=0
node scripts/check-doc-links.mjs README.md docs/wiki/*.md  LINKS_EXIT=0
```

Green suite. Nothing here blocks on the gate; the changes below are lens findings.

`./bin/mstack ledger check docs-for-newcomers` at head `2a4c17c7`:

```
FAIL no verdict at 2a4c17c7; 1 row(s) exist at other SHAs and a new head SHA voids them
```

Expected: commit `2a4c17c` is itself the implementer's ledger row, so the row landed one SHA
behind head. As a lens I record no row (`agents/reviewer.md`, Record-it). Flagging it so the
pass that synthesizes this panel records its single row at the head SHA and not at
`7d84e0d`.

## Requirement to test

This is a docs item; no bullet is covered by an executing test, and the item's `verification`
field is a suite that would stay green if `7a85351` were reverted wholesale. That is not a
defect - it is what a docs item is - but it means every bullet below is judged by reading,
and the evidence rung is stated per bullet rather than assumed.

| R | Check | Evidence |
|---|---|---|
| Counts (5/12/7) | `fd` against `agents/`, `skills/`, `skills/router/playbooks/` | 5 agents, 12 skills, 7 playbooks on disk; all 5, all 12, all 7 named on the pages. Rung 4 |
| Links resolve | `check-doc-links.mjs` | 91 links, 0 broken. Rung 4 |
| Diagrams render | no renderer available; installing one is a new dependency and needs authorization | syntax read against the mermaid grammar only. **Rung 3, not 4** - I did not see either diagram rendered |

## Acceptance, quoted

**"All five agents, all twelve skills and all seven playbooks are documented on wiki pages a
stranger can read: purpose, when it runs, what it writes, what it must not do"**

Half met. The bullet names four dimensions. Measured per cast:

| | purpose | when it runs | what it writes | what it must not do |
|---|---|---|---|---|
| 5 agents | yes | yes | yes | yes |
| 7 playbooks | yes | yes | **no** | partial |
| 12 skills | yes | yes | **no** | **no** |

The agents are done properly. `The-Agents.md:17-23` gives a cast table with a `Writes` column
and a `Must never` column, `:32-42` gives a status-to-launch table for "when it runs", and
each of the five then gets its own section (`:88`, `:100`, `:111`, `:122`, `:134`) with all
four dimensions in prose. That is a page a stranger can read.

The skills are not. `Skills-and-Playbooks.md:18-31` is a twelve-row table whose columns are
`Skill | What it does | Reach for it when` - purpose and when, and nothing else. Eleven of
the twelve get no "must not" at all (only the router's verbatim-copy rule at `:51-55`), and
none of the twelve says what it writes. That omission is material, because these skills do
write named artifacts and the reader has no way to find out which:

- `/mstack:understand` (`:22`) writes `.mstack/progress/explore_<topic>.md`
  (`skills/understand/SKILL.md:30`). The page never says so.
- `/mstack:design` (`:23`) says it "records the decision with its rejected alternatives" -
  where? `.mstack/specs/<slug>/design.md`, or a decision row
  (`skills/design/SKILL.md:37`). The page never says so.
- `/mstack:reflect` (`:30`) appends to `.mstack/progress/history.md`
  (`skills/reflect/SKILL.md:56`). The page never says so.

`State-Files.md:167` does list the `explore_`, `design_` progress-file prefixes, but nothing
connects a prefix back to the skill that produces it, and Skills-and-Playbooks does not link
to that line. So a stranger finishes the page knowing what `/mstack:design` is *for* and not
whether running it leaves anything behind. This is the "merely named in a table cell" failure
the bullet is written to prevent, and it is my primary blocker.

The seven playbooks (`:67-75`) are closer: `For` covers purpose, the route table at `:38-49`
covers when, and `Its discipline` is a genuine "must not" for most rows. Only "what it
writes" is missing. `:64` says a playbook is "a short numbered step list plus the reply it
owes the user", which gestures at output without naming any.

**"The lifecycle and the request-to-router-to-playbook-to-agents-to-gate flow each carry a
mermaid diagram that renders on GitHub"**

Both diagrams exist: lifecycle at `How-A-Work-Item-Flows.md:26-52`, request flow at
`Home.md:20-32` and `README.md:31-45`. Syntax reads as valid mermaid (bare `blocked` state
declaration and `note right of` are both legal in `stateDiagram-v2`; quoted edge labels and
stadium nodes are legal in `flowchart`). I could not render either one - no renderer in
`node_modules`, and adding one is a new dependency I am not authorized to install - so
"renders on GitHub" stops at **rung 3** for me. Saying that out loud rather than writing it
up as settled.

On whether they *teach*, which is my half: the request-flow diagram is wrong-shaped at its
tail. `Home.md:30` draws `ledger --> gate["mstack gate green"] --> merged`, and the caption
at `:35-36` calls it "the gate at the end". A stranger learns from this that the gate is a
single terminal check sitting between the verdict and the merge. It is not: `mstack gate` is
the *session* gate, run at SessionStart and Stop and red at any point in the flow
(`Gates-and-Hooks.md:9-12`), and the thing that actually decides whether a change may land is
`mstack merge-gate`, which the diagram never names even though it is the box drawn. So the
first picture a newcomer sees teaches a model that the next page has to undo.

Second shape problem, same diagram: the `orchestrator` does not appear. It is one of the five
agents and it is the one that dispatches every other box in the picture
(`The-Agents.md:32-42`). A diagram whose stated job is request-to-router-to-playbook-to-**agents**-to-gate
that omits the dispatching agent leaves the reader to discover a fifth role later with no
place to put it.

The lifecycle diagram is correct and complete, and I am not blocking on it, but it is drawn
as an exhaustive reference rather than as a teaching aid: nine states, twenty edges, six of
them `--> cancelled`, all rendered at the same visual weight as the five-edge happy path.
The prose right above it (`:23-24`) makes exactly the right call for `blocked` - "kept to a
note because it connects to nearly everything" - and then does not apply that reasoning to
`cancelled`, which has six in-edges and connects to nearly everything for the same reason.
The precise table sits directly below, so the diagram does not need to be exhaustive.

**"Every wiki content page and the README top open with a plain-language summary before
mechanism detail, and the README first screen maps where each concept lives"**

Met, and this is the strongest part of the change. All eleven openers checked individually,
none of them a title restated in more words:

| Page | Opener | Does it say what you get and when you'd need it? |
|---|---|---|
| `Home.md:3-7` | "mstack makes agent work inspectable..." | yes |
| `Getting-Started.md:3-7` | "Start here the first time you use mstack" | yes, and names the prerequisite and the end state |
| `The-Story.md:3-5` | "This page is background, not instructions" | yes - and tells you to skip it, which is honest |
| `How-A-Work-Item-Flows.md:3-9` | "Every piece of work mstack tracks is a work item..." | yes, and hands off "who does the building" to The-Agents |
| `The-Agents.md:3-8` | "mstack splits work across five agents..." | yes |
| `Skills-and-Playbooks.md:3-8` | "Skills are the commands you type; playbooks are the step lists they follow" | yes - best sentence in the diff |
| `Gates-and-Hooks.md:3-7` | "the part of mstack that does not ask nicely" | yes, with a "read it when the gate has gone red" trigger |
| `The-CLI.md:3-6` | "Read it as a reference rather than in order" | yes, and lowers the page's perceived weight usefully |
| `State-Files.md:3-6` | "mstack's memory is a handful of small files" | yes |
| `Status-Line.md:3-6` | "An optional one-line display..." | yes, but see nit 7 |
| `README.md:5-9` | same as Home | yes |

The README map: nine rows, `README.md:16-30`, ending at raw line 31, immediately under the
two intro paragraphs. That is the first screen on any rendered width - `## The map` is at raw
line 16, so even a 24-line viewport reaches the heading and most of the table. Not below the
fold. Each row is a real one-sentence definition, not a page description.

**Navigation, from Home in one link**

- "what is an implementer" - `Home.md:35` links The-Agents; `The-Agents.md:122` is the
  section. One link. Met.
- "what is a playbook" - `Home.md:34` links Skills-and-Playbooks;
  `Skills-and-Playbooks.md:61` is the section, and `:3` defines the word in the first
  sentence. One link. Met.
- "what does the gate check" - `Home.md:35-36` links Gates-and-Hooks, whose new opener
  (`:3-7`) answers it in the first paragraph. One link. Met.

`_Sidebar.md` is a learning path, not an alphabet: start, why, what flows, who does it, how
you drive it, what enforces it, then two references, then optional, then maintainer-only.
The-Agents and Skills-and-Playbooks are inserted at positions 4 and 5, which is the right
place. One quibble at nit 8.

## Changes required

1. `docs/wiki/Skills-and-Playbooks.md:18-31` - the twelve-skill table carries only purpose
   and when, but the acceptance bullet asks for four dimensions. Add what each skill writes
   (at minimum: `/mstack:understand` -> `.mstack/progress/explore_<topic>.md`,
   `/mstack:design` -> `design.md` or a decision row, `/mstack:reflect` ->
   `.mstack/progress/history.md`, `/mstack:verify` -> a ledger row, `/mstack:spec` ->
   `.mstack/specs/<slug>/`), and a "must not" for the skills that have one. Either two more
   columns, or - better for scannability - short per-skill entries for the six that actually
   write something, with the table kept as the index.

2. `docs/wiki/Skills-and-Playbooks.md:67-75` - the playbook table has no "what it writes"
   column. `:64` promises "the reply it owes the user" and then never names an artifact for
   any of the seven.

3. `docs/wiki/Home.md:30` and `README.md:43` - the node `gate["mstack gate green"]` sitting
   between the ledger and `merged` teaches that the gate is a single terminal pre-merge
   check. Name the merge gate here (`merge-gate` is what decides landing per
   `Gates-and-Hooks.md:11`), or split into two nodes, and change the caption at
   `Home.md:35-36` so it stops saying "the gate at the end". A newcomer's first picture
   should not be the one the enforcement page has to correct.

4. `docs/wiki/Home.md:20-32` and `README.md:31-45` - the `orchestrator` is missing from a
   diagram that claims to show the agents. Add it as the box that dispatches, or say in the
   caption that the coordinating agent is left out on purpose and where to find it.

5. Jargon used before it is defined or linked, on the new prose. Each of these is a place a
   stranger stalls:
   - `The-Agents.md:22` - "its own ledger row" is the first use of "ledger" on the page; the
     definition and the State-Files link do not arrive until `:151-152`, 129 lines later.
     Link on first use.
   - `The-Agents.md:75` - "at the rung the implementer honestly reached" is the first use of
     "rung", with no link. The evidence ladder lives on a different page
     (`Skills-and-Playbooks.md:93-107`) and The-Agents never links to it at all.
   - `The-Agents.md:144` - "as one lens of a panel" introduces both "lens" and "panel"
     undefined. `:147` says panels run in parallel but never says a lens is a review focus.
   - `The-Agents.md:61`, `:130`, `:157` - `test-verified`, `type-check-only`,
     `verifier-failed`, `verifier-blocked` are verdict-enum values used with no gloss and no
     link to the enum (`The-CLI.md`). `:13` does link The-CLI, but only for the `$ mstack`
     spelling convention.
   - `The-Agents.md:158` - "keeps the best row per `(target, sha)` by rank" uses both an
     unexplained notation and an unexplained ranking.
   - `The-Agents.md:19` - "decision rows" appears in the cast table and is never explained or
     linked anywhere on the page.
   - "pass" is the single most load-bearing word in the diff (`The-Agents.md:21`, `:55`,
     `:56`, `:77`, `:109`, `:113`, `:154-159`) and is never defined. The nearest thing is
     `:4-5`, "hand the result to the next pass", which asks the reader to infer that a pass
     is one agent invocation. One explicit sentence would fix it.
   - `Skills-and-Playbooks.md:29`, `:49`, `:74` - "worktree" used three times, never defined,
     never linked. The only explanation in the wiki is `The-CLI.md:380`, which this page does
     not link to.
   - `Skills-and-Playbooks.md:24` - "EARS statements" is expanded nowhere in the entire docs
     tree (also `The-Agents.md:106`, `State-Files.md:178`). A stranger cannot decode it.
   - `Skills-and-Playbooks.md:24` - "An item is marked `sdd`" is the first use; the acronym is
     never expanded and its meaning only arrives at `:83`.

6. `docs/wiki/Skills-and-Playbooks.md:35` and `:88` - the page uses `mstack gate` and then
   "the merge gate" as the thing every path ends at, and never links Gates-and-Hooks. Its
   four outbound links are Home, The-Agents, How-A-Work-Item-Flows, State-Files. Add the
   link; a reader told "then the merge gate" has no route to finding out what that is.

## Nits, not blocking

7. `docs/wiki/Status-Line.md:3` - the page's opening sentence is a fragment ("An optional
   one-line display in Claude Code's status bar that shows..."). The other ten openers are
   full sentences; this one reads as a caption that lost its subject.

8. `docs/wiki/_Sidebar.md:4` - The-Story sits at position 2 of what is otherwise a clean
   learning path, and its own new opener (`The-Story.md:5`) says "Skip it freely if you just
   want to use the tool." A page that tells you to skip it probably should not be the second
   thing in the path.

9. `docs/wiki/The-Agents.md:157` (56 words) and `:158` (49 words) - two table cells carrying
   full paragraphs with three distinct rules packed into one of them. In a three-column grid
   these render as walls. The "Who records which ledger row" content wants to be prose with
   bold leads, or the rules want to be split into rows.

10. `docs/wiki/How-A-Work-Item-Flows.md:26-52` - the lifecycle diagram gives six
    `--> cancelled` edges the same weight as the five-edge spine. The page already solved this
    problem for `blocked` with a note; the same treatment for `cancelled`, or a highlighted
    happy path, would let the diagram teach instead of duplicating the table below it.

## For the facts lens

Two factual doubts, named and left, per the split:

- Whether `mstack gate` is the right command for the node between the ledger and merge in the
  request-flow diagram (`Home.md:30`, `README.md:43`), or whether that box is `merge-gate`.
  I judged the shape; the command is yours.
- The `blocked` note at `How-A-Work-Item-Flows.md:47-51` claims reachability "from any status
  except done and cancelled" and exit "to any status except done and blocked". Unverified
  against `src/lifecycle.ts` by me.

## What is good

Worth recording, because the report is mostly findings. The plain-language openers do the job
the user asked for - "the docs are not really friendly" - and none of them restates its title.
`Skills-and-Playbooks.md:3` and `Gates-and-Hooks.md:3` are the kind of first sentence that
makes a stranger keep reading. The voice holds throughout the new prose: I found nothing
generic or marketing-flavored, and the honest hedge at `The-Agents.md:51-53` ("a speed bump
with an audit trail, not a sandbox") is the repo's voice working correctly. Neither new page
recreates the density complaint - 163 and 107 lines against Gates-and-Hooks' 463 and
The-CLI's 484. The one-link navigation test passes on all three questions.
