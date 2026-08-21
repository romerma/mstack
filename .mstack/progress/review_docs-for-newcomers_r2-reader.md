# Review - docs-for-newcomers, round 2 (reader lens)

**Verdict:** CHANGES_REQUESTED

Narrow. All four of my round-1 blockers are genuinely fixed, several of them better than I
asked for. What holds this back is small and of one species: the round-2 additions introduced
three new before-definition uses on the newcomer-facing page, which is the exact defect round
2 existed to remove; plus one structural risk in the reworked diagram that I could not settle
without a renderer and that has a zero-cost fix.

Same stranger as round 1: installed the plugin, has not read the source.

## Verification I ran

`./bin/mstack gate --full` - exit 0.

```
-- state
[ok]    one active item: docs-for-newcomers (reviewing)
[ok]    16 closed item(s) carry a ledger verdict
-- workspace
[warn]  2 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 0 warnings        <- lint-plugin
99 relative links checked, 0 broken    <- check-doc-links (was 91 in round 1)
PASSED - 0 failures, 1 warning
[exited with code 0]
```

The item's `verification` field, command by command, at head `a2460265`:

```
npm test                                                   TEST_EXIT=0   (276 pass / 0 fail bun, pass 276 / fail 0 node)
npm run typecheck                                          TC_EXIT=0
./bin/mstack lint-plugin .                                 LINT_EXIT=0   PASSED - 0 failures, 0 warnings
node scripts/check-doc-links.mjs README.md docs/wiki/*.md  LINKS_EXIT=0  99 relative links checked, 0 broken
```

Green. Nothing below is a gate finding.

`./bin/mstack ledger check docs-for-newcomers` - same structural note as round 1: the
implementer's round-2 row landed at `06899f1` and commit `a246026` is the row itself, so head
moved past it again. I record no row (panel lens, `agents/reviewer.md` Record-it). The pass
that synthesizes this panel must record its single row at the head SHA at that moment.

## Round-1 findings, walked one by one

### Blockers

**R1-1: twelve skills documented at table-cell depth; "what it writes" absent for all
twelve, "what it must not do" absent for eleven.** Fixed, and over-delivered.
`Skills-and-Playbooks.md:39-52` is a new "What each skill leaves on disk" table, one row per
skill, all twelve present. `:59-72` is a prohibition list, twelve bullets, one per skill. The
page now carries all four dimensions the bullet names. The three specific artifact gaps I
cited are each closed at the line I predicted they would need to appear:

| I said missing | Now at |
|---|---|
| `/mstack:understand` -> `explore_<topic>.md` | `:43` |
| `/mstack:design` -> `design.md` or a decision row | `:44` |
| `/mstack:reflect` -> `history.md` | `:51` |

`:57` adds "The files themselves are read column by column on State-Files", which is the
route back from an artifact name to its column that I said was missing. `/mstack:unslop`
being given "Nothing of its own" (`:52`) rather than being skipped is the right call - a
stranger scanning for "which of these write things" needs the negative answer stated.

**R1-2: playbooks missing "what it writes".** Fixed. `:128-137`, "What each playbook leaves
behind", seven rows.

**R1-3: the flow diagram drew `mstack gate green` as a terminal pre-merge node and never
named the merge gate.** Fixed, and the fix teaches. `Home.md:35` is now
`merge["mstack merge-gate decides landing"]`, and the caption at `:39-42` does not merely
drop the wrong box, it says why it is not there: "One box is deliberately missing: the
session gate, `mstack gate`, is not a step in this flow. It runs at the start and end of
every session and can go red at any point in the picture." That converts my finding into the
one sentence a newcomer most needs about the two gates. Same in `README.md:47-48`.

**R1-4: the orchestrator absent from a diagram that claims to show the agents.** Fixed via
`subgraph orch["dispatched, pass by pass, by the orchestrator"]` (`Home.md:26-34`),
which is a better answer than the extra node I suggested: it shows the orchestrator as the
frame around the three passes rather than as a step in the sequence, which is what it is.

**R1-5: jargon before definition, eleven items.** I checked each at its current location
rather than trusting the round-2 report. Ten fully fixed, one partial:

| # | Round-1 finding | Now | Verdict |
|---|---|---|---|
| a | "ledger" first used `The-Agents.md:22`, defined 129 lines later | first use is `:23`, linked `[ledger](State-Files.md)` | fixed |
| b | "rung" first used `:75` with no link | first use `:77`, and `:78` links `[the evidence ladder](Skills-and-Playbooks.md#the-evidence-ladder)`; anchor matches the `## The evidence ladder` heading | fixed |
| c | "lens"/"panel" undefined at `:144` | `:148-150` defines both before the grammar: "A panel is several reviewers run in parallel over the same diff, each with a lens, one assigned focus such as correctness or security" | fixed |
| d | four verdict-enum values unglossed | `:57-58` "A verdict is one of five typed values, `test-verified` below among them; the enum lives on [The-CLI](The-CLI.md)" | fixed |
| e | "`(target, sha)`" and "rank" at `:158` | rewritten to "keeps one winning row per item and commit, preferring the most favorable verdict" | fixed, and plainer |
| f | "decision rows" unexplained at `:19` | `:20` linked `[decision rows](State-Files.md)` | fixed |
| g | "pass" never defined | `The-Agents.md:5-6`: "A pass is one launch of one agent: it starts clean, does its one job, and only what it wrote to disk survives it" | fixed; this is the best single sentence added in round 2 |
| h | "worktree" used three times, undefined, unlinked | `:30` links `[worktrees](The-CLI.md)`; `:50` glosses "a worktree (its own checkout of the repository)" | **partial**, see nit 5 |
| i | "EARS" expanded nowhere in the docs tree | expanded at `Skills-and-Playbooks.md:25`, `The-Agents.md:109-110` (with the reference kit named), `State-Files.md:178` | fixed |
| j | "`sdd`" never expanded | `:25` "(the spec-driven flag)", `:145` "sdd is short for spec-driven development" | fixed |
| k | Skills-and-Playbooks never linked Gates-and-Hooks | linked at `:85` and `:152` | fixed |

**R1-6: `mstack gate` and "the merge gate" used on Skills-and-Playbooks with no route to
Gates-and-Hooks.** Fixed, same as (k).

### Nits

- **R1-7, Status-Line opener a sentence fragment.** Fixed: `Status-Line.md:3` now "The status
  line is an optional one-line display...".
- **R1-8, The-Story at sidebar position 2 despite telling you to skip it.** Survived.
  `_Sidebar.md:4` unchanged. It was a quibble and I am not pressing it; noting it was not a
  silent drop but an unaddressed one.
- **R1-9, `The-Agents.md` ledger table cells carrying paragraphs.** Survived, and one got
  longer. The reviewer-alone row is still 56 words (`:164`); the panel row went 49 -> 53
  words (`:165`) because the `(target, sha)` rewrite from (e) traded jargon for length. That
  trade is correct on jargon and wrong on scannability - the content wants to be prose with
  bold leads, not a three-column grid.
- **R1-10, lifecycle diagram gives six `--> cancelled` edges the weight of the five-edge
  spine.** Survived. `How-A-Work-Item-Flows.md` took only two `src/` line-number corrections
  in round 2 (`:56`, `:116`); the diagram is byte-identical.

## What round 2 introduced

Audited fresh, as briefed. The new prose carries three before-definition uses, all on
Skills-and-Playbooks, all in the tables that fixed R1-1:

1. **"fanned-out reader" and `mstack fanout plan`** at `:43`, `:48` and `:131`. New jargon,
   no gloss, no link. I checked every page: `The-CLI.md:399-420` documents the two
   subcommands mechanically and `State-Files.md:169` mentions `mstack fanout check`, but no
   page states in plain words that fanning out means running several workers in parallel over
   one job. A stranger hits "one per fanned-out reader" in the table that is supposed to tell
   them what a skill leaves behind and cannot parse the unit being counted.
2. **"lens"** at `:48`, first use on this page, undefined here. It *is* now defined at
   `The-Agents.md:148-150` - which is the round-2 fix for (c) - but `:48` does not link
   there. The fix for (b) shows the pattern: an anchored cross-page link.
3. **"rung"** at `:70`, ninety lines before `## The evidence ladder` defines it at `:160-166`
   on the same page. This is the identical shape as (b), which round 2 fixed correctly on
   The-Agents by linking `Skills-and-Playbooks.md#the-evidence-ladder`. Here the anchor is on
   the same page and still unlinked.

## Acceptance, quoted

**"All five agents, all twelve skills and all seven playbooks are documented on wiki pages a
stranger can read: purpose, when it runs, what it writes, what it must not do"**

Met, on all three casts and all four dimensions. Round 1 I scored agents 4/4, playbooks 2.5/4,
skills 2/4. Now:

| | purpose | when it runs | what it writes | what it must not do |
|---|---|---|---|---|
| 5 agents | `The-Agents.md:19-24` | `:33-43` | `Writes` column + per-agent sections `:91-170` | `Must never` column |
| 12 skills | `S&P:19-32` | `S&P:19-32` + route table `:88-99` | `S&P:39-52` | `S&P:59-72` |
| 7 playbooks | `S&P:114-125` | route table `:88-99` | `S&P:128-137` | `Its discipline` column |

The residual jargon in items 1-3 above degrades "a stranger can read" at three specific
words; it does not defeat the bullet.

**"The lifecycle and the request-to-router-to-playbook-to-agents-to-gate flow each carry a
mermaid diagram that renders on GitHub"**

Both diagrams present; the flow diagram's shape defect from round 1 is corrected. On whether
fixing the shape cost the readability the diagram existed for, which is what I was asked: it
did not. Node count is unchanged at nine (`you`, `router`, `steps`, `spec`, `impl`, `review`,
`ledger`, `merge`, `merged`); edges went 9 -> 10; the only addition is one subgraph frame.
The diagram got more correct without getting bigger. Read cold before the prose, it now says
the right thing about where the merge decision happens.

**Still rung 3, not rung 4, on "renders on GitHub."** No renderer in `node_modules` and
adding one is a new dependency I am not authorized to install, so I read syntax, I did not
see either diagram rendered. Round 1 said the same and it remains true; I am not letting it
pass as settled on a second reading. And this round there is a specific structural reason to
doubt, which is finding 2 below.

**"Every wiki content page and the README top open with a plain-language summary before
mechanism detail, and the README first screen maps where each concept lives"**

Still met; round 2 touched three openers and none regressed. `Getting-Started.md:3` added the
runtime prerequisite ("`bun` or `node` 22.6 or newer"), which makes the opener more useful,
not less plain. `Status-Line.md:3` fixed the fragment. `State-Files.md:6` dropped "and each
one is small enough to read whole" - a factual trim I assume my sibling asked for; it costs
the sentence nothing as prose. The README map is unchanged at nine rows and still ends at raw
line 31, above the fold.

## Changes required

1. `docs/wiki/Skills-and-Playbooks.md:43`, `:48`, `:131` - "fanned-out reader" and
   `mstack fanout plan` are new undefined jargon introduced by the round-2 fix, on the page a
   stranger reads to learn the vocabulary. One clause fixes all three, e.g. at first use:
   "one per fanned-out reader (several readers run in parallel over one question)". If the
   concept deserves a home, `The-CLI.md:399` is where the commands live and an anchored link
   would do.

2. `docs/wiki/Home.md:24-34` and `README.md:38-46` - `spec` and `impl` are first referenced
   on the `steps -->|"spec path"| spec` / `steps -->|"direct path"| impl` edges *before* they
   are declared inside `subgraph orch`. Mermaid's node-to-subgraph binding in this
   declared-after-referenced order is exactly what I cannot confirm without rendering, and if
   it binds them to the top level the frame ends up containing only `review` and the entire
   R1-4 fix silently collapses to a box around one node. The fix is free and removes the
   question: move the two `steps -->` edge lines *below* the `end` of the subgraph, so all
   three agent nodes are declared inside it first. Please render it once on GitHub either
   way - that is the only thing that takes this bullet to rung 4.

3. `docs/wiki/Skills-and-Playbooks.md:48` - "lens" first used here, undefined on this page.
   Link it to `The-Agents.md#reviewer`, where round 2 correctly defined it.

4. `docs/wiki/Skills-and-Playbooks.md:70` - "rung" first used here, defined at `:160` on the
   same page. Link `[rung](#the-evidence-ladder)`, the same fix round 2 applied at
   `The-Agents.md:78`.

## Nits, not blocking

5. `docs/wiki/Skills-and-Playbooks.md:30` - `[worktrees](The-CLI.md)` lands on a 484-line
   reference with no anchor; the heading is `## worktree new / list / prune`. The inline
   gloss that actually defines the word is twenty lines later at `:50`. Anchor the link, or
   move the gloss to first use.

6. `docs/wiki/Home.md:22` and `README.md:36` - the router node now reads "matches a playbook,
   or a skill directly", but the diagram draws only the playbook edge into `steps`. The label
   advertises a branch with no line. Either draw the second edge or drop the clause; the
   route table on Skills-and-Playbooks already carries the nuance.

7. Round 2 inserted text mid-paragraph without re-wrapping, in a tree that otherwise holds
   about 93-95 columns: `Skills-and-Playbooks.md:152` (133 chars), `The-Agents.md:58` (113),
   `Getting-Started.md:5` (112), `The-Agents.md:6` (110), `Status-Line.md:4` (105), plus
   orphan short lines left by the EARS inserts at `The-Agents.md:110` and
   `State-Files.md:179`. Invisible once rendered; it makes the next diff noisier than it
   needs to be.

8. R1-9 unaddressed: `The-Agents.md:164` (56 words) and `:165` (53 words) are paragraphs in
   table cells.

9. R1-8 and R1-10 unaddressed, both by my own labelling non-blocking: sidebar order, and the
   `cancelled` edges in the lifecycle diagram.

## For the facts lens

One line, left with you: `State-Files.md:6` lost "and each one is small enough to read
whole", and `How-A-Work-Item-Flows.md:56`/`:116` moved `src/lifecycle.ts` and `src/cli.ts`
line references. I did not verify any of the three.

## What is good

Round 2 answered findings rather than deflecting them, and in three places the answer is
better than the finding asked for: the "pass" definition at `The-Agents.md:5-6`, the
deliberately-missing-box caption at `Home.md:39-42`, and the orchestrator-as-frame subgraph
instead of the extra node I proposed. The prohibition list at `Skills-and-Playbooks.md:59-72`
holds the repo's voice under what could easily have been twelve rows of filler - "`unslop` is
itself a list of prohibitions; the rule above them all is to not generate the bad sentence in
the first place" is the page earning its keep. The new tables are scannable: the
leaves-on-disk cells are single sentences, not the paragraph-cells I flagged elsewhere.
