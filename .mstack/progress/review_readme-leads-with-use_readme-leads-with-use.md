# Review - readme-leads-with-use

**Verdict:** CHANGES_REQUESTED

Item 29, commit `5ea9110`, branch `fix/mstack-front-door`, head
`5ea911045c38b9ee7da097372ae2091434ad23fc`. Items 28, `d38e0ef` and `4eefde6` are out of scope
and were not judged.

The restructure is right and most of it is accurate: 5 of 7 playbook rows, 5 of 5 agent rows and
12 of 12 skill rows check out against the files, all four deletions have a traced surviving home,
and both named commands are green. Four things are wrong, all small, all in prose that this item
exists to get right. Three are factual, one is state.

## Requirement to test

A docs-only diff: `README.md`, `.mstack/state.json`, `.mstack/progress/current.md`. No test file
was touched, so nothing here can be traced to a test that fails on revert. That is inherent to
the item, not a criticism of it, but it means acceptance 1-4 sit at **rung 2** (I read the file
and the file it claims to describe, `file:line` both ends) and only acceptance 5 reaches **rung
4** (I ran the two commands).

| R | Test | Evidence |
|---|---|---|
| A1 usage before mechanism | none, inspection only | `README.md:15-18` inside the first screen; rung 2 |
| A2 seven playbooks | none, inspection only | `README.md:89-95` against `skills/mstack/playbooks/*.md`; rung 2, two rows defective, see below |
| A3 five agents | none, inspection only | `README.md:109-113` against `agents/*.md` front matter; rung 2, clean |
| A4 one command, its argument | none, inspection only | `README.md:10-27`; rung 2, `README.md:26-27` defective |
| A5 link check and lint green | `scripts/check-doc-links.mjs`, `bin/mstack lint-plugin` | both run by me below; rung 4 |

Nothing checks the counts. Add an eighth playbook tomorrow and `README.md:80` still says seven
with nothing to notice. `lint-plugin` already enumerates skills and agents and already gained a
front-door check in item 28, so this repository's own rule ("anything that must hold whether or
not the model remembers it lives in a hook or in a gate that is code", `README.md:158-159`)
points at a check here. Out of acceptance, so a follow-up item rather than a blocker.

## Acceptance, quoted

**"the README shows a real /mstack <request> example before any mechanism prose"** - met.
Four real requests at `README.md:15-18`, under `## One command` at `README.md:10`. What precedes
them is the tagline (`:3`) and a four-line paragraph (`:5-8`) that opens "You type one command
and say what you want in plain words" and describes outcomes, not machinery. Against the 84 lines
the complaint names, the first example now lands at line 15 of 475. The four examples route to
four distinct playbooks under `skills/mstack/SKILL.md:29-40` (bug-fix, feature, investigate,
resume), so they are representative rather than four of the same thing. Rung 2.

**"all seven playbooks are named in the README with what each one does"** - met on naming, two
rows defective on content. Seven rows at `README.md:89-95`; `fd` over
`skills/mstack/playbooks/` returns exactly seven files and the names match one for one. Rows for
bug-fix (`:90`), refactor (`:92`), orchestrate (`:93`), resume (`:94`) and cleanup (`:95`) are
faithful, several near-verbatim. The investigate (`:89`) and feature (`:91`) rows drop a
qualifier each and so overstate what the playbook forces. Details in Changes required 2 and 3.
Rung 2, `file:line` both ends.

**"all five subagents are named in the README with what each does and what it cannot do"** -
met, and this is the cleanest part of the change. Five rows at `README.md:109-113`, five files
in `agents/`, names match. Every "what it does" cell is a faithful compression of that agent's
own `description:`:

- implementer `README.md:109` vs `agents/implementer.md:3` - "Never marks its own work approved
  or done" is exactly what the README's "cannot do" cell says, and `README.md:196-200` shows the
  gate enforcing it.
- reviewer `README.md:110` vs `agents/reviewer.md:3`.
- spec-author `README.md:111` vs `agents/spec-author.md:3`.
- spec-reviewer `README.md:112` vs `agents/spec-reviewer.md:3`.
- orchestrator `README.md:113` vs `agents/orchestrator.md:3`.

The tool claims at `README.md:110`, `:112`, `:113` and `:115-119` are correct against the
`tools:` lines: `agents/reviewer.md:4` is `Read, Glob, Grep, Bash`, `agents/spec-reviewer.md:4`
is `Read, Glob, Grep, Bash`, `agents/orchestrator.md:4` is `Read, Glob, Grep, Bash, Agent`. No
`Write`, no `Edit` in any of the three; `Bash` in all three. `agents/implementer.md:4` and
`agents/spec-author.md:4` do carry `Write, Edit`, and the README claims otherwise nowhere.
`README.md:104-105` ("its deliverable is a file on disk, not a reply") holds for all five,
including the orchestrator, which carries the same instruction at `agents/orchestrator.md:57`
despite having no `Write` and writing through `Bash`. Rung 2.

**"the entry point section says there is one command and how its argument works"** - met on the
one command and the argument, defective on the sentence about the other eleven.
`README.md:12` "That is the whole interface", `README.md:21` "Whatever follows `/mstack` is the
request. You do not pick a mode, a phase, or an agent", and `README.md:21-24` explains the
before-it-reasons ordering, faithful to `skills/mstack/SKILL.md:20-25`. `README.md:26-27` is
false in two ways; see Changes required 1. Rung 2 for the section, rung 4 for the falsification.

**"node scripts/check-doc-links.mjs README.md docs/wiki/*.md passes and lint-plugin stays
green"** - met at this commit, pinned nowhere. Both commands are green in my own run, pasted
below. But item 29 carries no `verification` field, the project-wide verify at
`.mstack/state.json` is `npm test && npm run typecheck && bin/mstack lint-plugin .` with no link
check in it, and `.github/workflows/ci.yml` does not run `check-doc-links` either. So the
command this criterion names is executed by nothing at close. Item 23, the previous docs item,
sets the precedent by carrying it in its own `verification`. See Changes required 4. Rung 4 on
today's pass, rung 0 on the ratchet.

## Deleted content, one by one

**`## The map`** - justified as a table pointing at pages the Documentation table already lists.
That holds for the links: every one of its nine targets appears at `README.md:445-455`. It holds
for eight of the nine one-sentence definitions, all of which were replaced by something longer
(`## The five agents`, `## The twelve skills`, `## The seven playbooks`,
`### Enforcement that runs...`, `## The CLI`, `## The status line`, the Getting-Started pointer
at `:51-53`, and the lifecycle in `## Your first item, in five commands`). The ninth did not
survive: "The ledger and the evidence ladder | Typed verdicts keyed to a commit, and the five
rungs a claim can reach | State-Files". The ledger is covered many times over. The evidence
ladder now appears in README exactly once, at `README.md:462`, as an unexplained proper noun in
a credit list, with no definition and no pointer. It is not lost from the project
(`docs/wiki/State-Files.md:76`, `skills/mstack/references/evidence-ladder.md`), but the README
row that pointed there is gone and the replacement row at `README.md:453` says only "The anatomy
of `.mstack/`, column by column". `docs/wiki/Home.md:66` still names the ladder in its own row
for the same page. Non-blocking; see Changes required 5.

**`## Quickstart`** - justified. Every element survives in `## Install`: no build step
(`:31`, also `:369`), marketplace (`:34-35`), clone (`:41-42`), `/mstack:setup` (`:48`),
`/mstack <what you want done>` (`:51`), Getting-Started link (`:53`). Nothing lost.

**`### A router, not an orchestrator`** - justified. The verbatim-steps rule survives at
`:21-24`, and the `skip: <reason>` rule with its stated failure mode survives near-verbatim at
`:82-85`. The one casualty is the flat sentence "Skipping silently is not allowed", which
`skills/mstack/SKILL.md:25` still carries; the README now implies it rather than saying it.
Acceptable.

**`## Where this comes from`** - justified, with one fact I had to chase. The attribution, the
pstack contribution list and the harness contribution list are all in `## Credit`
(`:459-466`); the "44 skills, 23 playbooks and zero hooks" statistic is at `:155`. The two
unique links are present and resolve: `docs/wiki/The-Story.md` and `docs/research/pstack-port.md`
at `README.md:468-470`, both inside the 93 links the checker walked with 0 broken. The one detail
that left the README entirely is "the only plugin in Cursor's `cursor/plugins` monorepo not
authored by Cursor itself". It survives at `docs/wiki/The-Story.md:16-17` and
`docs/research/pstack-port.md:27`, both of which the new Credit paragraph links. Not silently
lost.

**Also removed, not in the brief's list of four:** `### Roles that cannot quietly approve
themselves` folded into `## The five agents` at `:115-119`, keeping every load-bearing clause
and dropping an em dash the house style forbids; and `## The one idea` renamed to
`## Why the rules are code` with its body intact at `:148-159`. Both accounted for.

**Dangling references:** none. No `README.md#` anchor exists anywhere in the repository, and the
only in-README anchor, `[Development](#development)` at `:167`, still resolves to `## Development`
at `:405`. The hits for "quickstart" are in `CHANGELOG.md:94,112`, which is append-only history,
and the "A router, not an orchestrator" hit is a frontmatter-parser fixture string at
`tests/frontmatter.test.ts:9,16`, unrelated to the section.

## The directory-naming claim

`README.md:142-143` "A skill's command is named after its **directory**, so the router lives in
`skills/mstack/` and answers plain `/mstack`" is consistent with
`docs/wiki/Skills-and-Playbooks.md:13-16`, which states the same rule at more length, and with
the shipped check that prints `front door: /mstack resolves to skills/mstack/SKILL.md`
(`src/lint.ts:198`, in my gate output below). Consistent and, as far as this repository can
establish, accurate.

Where it stopped: **rung 2**. The underlying platform behaviour is item 28's finding, recorded in
`.mstack/decisions.tsv` on evidence of `claude plugin details` output plus a survey of 89 cached
skills. I cannot reach rung 4 on it from here, because I cannot register a plugin and type a
slash command inside this session. I am not relitigating it, and item 28 is out of my scope; I am
recording that the README's restatement inherits that rung and not a higher one.

## Readability against "muy facil de leer"

Delivers on the thing that was asked. A newcomer now sees a usable command on the first screen
instead of on line 84, and the order is use, install, then what happens. Two observations, both
non-blocking:

- The three tables at `:87-95`, `:107-113` and `:127-140` run back to back over 60 lines, and
  some cells are long: the orchestrate cell at `:93` is roughly 55 words in one table cell,
  which on GitHub renders as a wall inside a box. The bug-fix cell at `:90` and the reviewer
  cell at `:110` are close behind. Splitting the longest cells' second sentence into prose under
  the table would read better without losing anything.
- `:5-8` is four lines of dense clause-stacking before the first example ("refuses to call
  anything done until a check that is code has seen the proof"). It is outcome language, not
  mechanism, so it does not breach acceptance 1, but it is the densest prose in the first screen.

## Verification I ran

```
$ ./bin/mstack version
mstack 0.1.0 at /Users/romerma/Code/mstack

$ git rev-parse HEAD
5ea911045c38b9ee7da097372ae2091434ad23fc

$ ./bin/mstack gate --full
-- manifest
[ok]    plugin name: mstack
[ok]    plugin-root CLAUDE.md is project memory for this checkout; .mstack/ shows the repo is worked in

-- skills
[ok]    skills/design/SKILL.md (58 lines, 307 description chars)
[ok]    skills/mstack/SKILL.md (145 lines, 310 description chars)
[ok]    skills/verify/SKILL.md (24 lines, 260 description chars)
[ok]    skills/understand/SKILL.md (56 lines, 281 description chars)
[ok]    skills/reflect/SKILL.md (59 lines, 247 description chars)
[ok]    skills/setup/SKILL.md (72 lines, 251 description chars)
[ok]    skills/spec/SKILL.md (71 lines, 305 description chars)
[ok]    skills/review/SKILL.md (56 lines, 212 description chars)
[ok]    skills/implement/SKILL.md (64 lines, 280 description chars)
[ok]    skills/ship/SKILL.md (38 lines, 190 description chars)
[ok]    skills/orchestrate/SKILL.md (57 lines, 240 description chars)
[ok]    skills/unslop/SKILL.md (71 lines, 216 description chars)
[ok]    front door: /mstack resolves to skills/mstack/SKILL.md

-- agents
[ok]    agents/orchestrator.md
[ok]    agents/reviewer.md
[ok]    agents/spec-reviewer.md
[ok]    agents/spec-author.md
[ok]    agents/implementer.md

-- hooks
[ok]    hook event SessionStart
[ok]    hook event PostToolUse
[ok]    hook event SubagentStop
[ok]    hook event Stop
[ok]    hook event PreToolUse

-- references
[ok]    20 reference file(s), every relative link resolves

-- shipped commands
[ok]    32 file(s), no command that would hang on stdin

-- cross-references
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves

-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .

PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
93 relative links checked, 0 broken
EXIT=0

$ ./bin/mstack lint-plugin .
... (same body as the gate's run)
PASSED - 0 failures, 0 warnings

$ ./bin/mstack ledger check readme-leads-with-use
FAIL no verdict recorded for readme-leads-with-use
EXIT=1
```

The ledger is empty for this slug at this SHA, which is correct for an item at `reviewing` that
no reviewer has judged yet. My own row follows this report.

Falsifying the "you never have to" claim, in a scratch repository with no `.mstack/`:

```
$ git init -q fresh && cd fresh && mstack gate
mstack: no .mstack/ found in this directory or any parent
        run 'mstack setup' to create one
EXIT=2
```

Rung 4, and I say what I ran it on: this checkout's `bin/mstack` against an empty git repository,
which is exactly the first-run case `README.md:26-27` is making a claim about.

Tests: this commit touches no test file (`git show --stat 5ea9110` lists `README.md`,
`.mstack/state.json`, `.mstack/progress/current.md` only), so no test was weakened to obtain
green. `npm test` is green inside the gate's `--full` run above.

## Changes required

1. `README.md:26-27` - "Eleven other `/mstack:<name>` commands exist. They are the machinery the
   router chains, and you can call one directly once you know exactly what you want. You never
   have to." False twice over, in the section this item exists to write.
   - `/mstack:setup` is one of the eleven, and this README tells you to type it 20 lines later
     at `:45-49`. Independently confirmed: with no `.mstack/`, `mstack gate` exits 2 telling you
     to run setup, and the router's first step is `mstack gate` with "A red gate stops you"
     (`skills/mstack/SKILL.md:17`). A first-time reader hits the contradiction on their first
     command.
   - "the machinery the router chains" is false for three of the eleven. Grepping
     `skills/mstack/` for `mstack:<name>` returns understand, design, implement, verify, review
     and ship only. Nothing in the router or any playbook chains `setup`, `reflect` or `unslop`;
     if you want those you must type them, which is the opposite of "You never have to".
   Fix: say the true thing. Something on the order of "Eleven other `/mstack:<name>` commands
   exist. `/mstack:setup` runs once per repository; the rest are steps the router calls for you,
   and `/mstack:reflect` and `/mstack:unslop` are there when you want them directly."

2. `README.md:91` - the feature row says "Two structurally distinct designs before picking".
   `skills/mstack/playbooks/feature.md:5-6` says "Two structurally distinct candidates before you
   pick one, **or a stated reason the constraints forced the answer**". The row deletes the
   escape hatch and so overstates what the playbook forces. This one costs more than accuracy:
   `README.md:155-156` criticises pstack because "its own feature playbook says a design pass is
   required and then supplies the escape hatch two lines later", 64 lines after a table that hides
   mstack's own. Fix: either restore the qualifier in the cell, or say why mstack's escape hatch
   is different from the one it names at `:155-156`.

3. `README.md:89` - the investigate row says "Fans out narrow readers instead of one broad one"
   unconditionally. `skills/mstack/playbooks/investigate.md:8` conditions it: "For anything with
   more than three moving parts". Fix: add the condition, four words.

4. `.mstack/state.json`, item 29 - the item carries no `verification` field, so the command
   acceptance 5 names is run by nothing. The project-wide verify is
   `npm test && npm run typecheck && bin/mstack lint-plugin .`; `.github/workflows/ci.yml` has no
   `check-doc-links` step; at close `mstack gate --full` will record a passing run that does not
   include the command the criterion is written around. Item 23, `docs-for-newcomers`, already
   carries the right shape. Fix, one command:
   `./bin/mstack state set readme-leads-with-use --verification "npm test && npm run typecheck && ./bin/mstack lint-plugin . && node scripts/check-doc-links.mjs README.md docs/wiki/*.md"`

## Non-blocking

5. `README.md:453` - the Documentation row for State-Files reads "The anatomy of `.mstack/`,
   column by column", which is where the deleted map row used to send readers for the evidence
   ladder. `docs/wiki/Home.md:66` describes the same page as "... and the evidence ladder".
   Matching that wording restores the only pointer the README had to a concept it still name-drops
   at `:462`.

6. Nothing checks "seven", "five" or "twelve" (`README.md:80`, `:101`, `:123`). `lint-plugin`
   already counts skills and agents and already gained a front-door check in item 28 for a defect
   of exactly this family. Worth a follow-up item: fail when the README's counts or names drift
   from `skills/`, `agents/` and `skills/mstack/playbooks/`.

7. Table cell length at `:93`, `:90`, `:110` as described under readability.

## What I could not establish

- That `/mstack` is typable as a bare command in a live Claude Code session. Rung 2 only, on
  `docs/wiki/Skills-and-Playbooks.md:13-16`, `src/lint.ts:178-198` and item 28's decision row.
  Registering a plugin and typing a slash command is outside what this session can run. Item 28
  owns that claim; I am recording the rung, not disputing it.
- Whether `/mstack` on a fresh repository would in practice trigger the setup skill by model
  invocation rather than stopping on the red gate. Both readings are defensible from
  `skills/setup/SKILL.md:3` and `skills/mstack/SKILL.md:17`. It does not change finding 1, which
  is a contradiction inside README.md between `:26-27` and `:45-49` whatever the model does.

---

# Re-review, round 2

**Verdict:** CHANGES_REQUESTED

Head is now `b4894a788a87347b032e996a083c7f3cd6ec96c5`, commit `b4894a7` "docs: the four things
the README review found", resolved with `git rev-parse HEAD` rather than from either SHA I was
handed: the coordinator's first message named `d5d47b8`, which is not in this history, and its
own correction named `b4894a7`, which is.

All five applied fixes are confirmed. One blocker remains, and it is the same falsehood as
round-1 finding 1 surviving in a second location my own report failed to cite. That is a miss on
my side as much as a miss on the fix's side, and it is one line.

## The correction I owe

**The coordinator is right and I was wrong. Five skills are chained, not six.** My round-1
finding 1 listed "understand, design, implement, verify, review and ship". `implement` does not
belong there.

The cause was my own regex. I searched `mstack:(setup|reflect|unslop|orchestrate|understand|
design|spec|implement|verify|review|ship)` with no trailing boundary, so the alternative
`implement` prefix-matched `mstack:implementer`, which is the agent at `agents/implementer.md`,
not the skill at `skills/implement/`. Rerun with an exact token:

```
$ rg -o 'mstack:[a-z-]+' skills/mstack | sort -u
skills/mstack/playbooks/bug-fix.md:mstack:design
skills/mstack/playbooks/bug-fix.md:mstack:implementer
skills/mstack/playbooks/bug-fix.md:mstack:review
skills/mstack/playbooks/bug-fix.md:mstack:ship
skills/mstack/playbooks/bug-fix.md:mstack:understand
skills/mstack/playbooks/feature.md:mstack:design
skills/mstack/playbooks/feature.md:mstack:implementer
skills/mstack/playbooks/feature.md:mstack:review
skills/mstack/playbooks/feature.md:mstack:ship
skills/mstack/playbooks/feature.md:mstack:understand
skills/mstack/playbooks/feature.md:mstack:verify
skills/mstack/playbooks/investigate.md:mstack:understand
skills/mstack/playbooks/refactor.md:mstack:design
skills/mstack/playbooks/refactor.md:mstack:review
skills/mstack/playbooks/refactor.md:mstack:ship
skills/mstack/playbooks/refactor.md:mstack:understand
skills/mstack/SKILL.md:mstack:implementer
skills/mstack/SKILL.md:mstack:review
skills/mstack/SKILL.md:mstack:reviewer
skills/mstack/SKILL.md:mstack:ship
skills/mstack/SKILL.md:mstack:spec-author
skills/mstack/SKILL.md:mstack:spec-reviewer
skills/mstack/SKILL.md:mstack:verify

$ for n in setup understand design spec implement verify review ship orchestrate reflect unslop
  do rg -o "mstack:$n\b" skills/mstack | wc -l; done
setup 0, understand 4, design 3, spec 2, implement 0, verify 2, review 4, ship 4,
orchestrate 0, reflect 0, unslop 0
```

Four of the nine distinct tokens are agents, not skills: `implementer`, `reviewer`,
`spec-author`, `spec-reviewer` all exist under `agents/` and have no directory under `skills/`.
The `spec` count of 2 is an artifact of the same class of trap I fell into the first time: `\b`
matches at the hyphen, so those two hits are `mstack:spec-author` and `mstack:spec-reviewer`, and
the unique-token list confirms no bare `mstack:spec` appears anywhere. So:

- chained skills = `understand`, `design`, `verify`, `review`, `ship` = **5**
- typed by the user = `setup` = **1**
- neither = `implement`, `spec`, `orchestrate`, `reflect`, `unslop` = **5**
- 1 + 5 + 5 = **11**, and that set is exactly the eleven non-router directories under `skills/`.

The arithmetic at `README.md:26-30` is correct. Rung 4: I ran the greps against the real files in
this checkout at `b4894a7`.

## The five fixes, confirmed

1. `README.md:26-30` - fixed and accurate. Names `/mstack:setup` as the one you type, the five
   the router calls, and the five that are yours. Verified against the grep above.
2. `README.md:94` - fixed. Now "Two structurally distinct designs before picking, or a stated
   reason the constraints forced the answer", matching `skills/mstack/playbooks/feature.md:5-6`
   clause for clause.
3. `README.md:92` - fixed. "Past three moving parts, fans out narrow readers instead of one broad
   one" against `skills/mstack/playbooks/investigate.md:8` "For anything with more than three
   moving parts". Same threshold, same direction.
4. `.mstack/state.json` item 29 - fixed, and this one is now load-bearing rather than cosmetic.
   The item carries `npm test && npm run typecheck && ./bin/mstack lint-plugin . && node
   scripts/check-doc-links.mjs README.md docs/wiki/*.md`, and `mstack gate --full` printed it
   back as the command it executed. The acceptance criterion's own command is now run by the
   gate at close instead of by a reviewer who happened to remember.
5. `README.md:460` - fixed. "The anatomy of `.mstack/` column by column, and the evidence
   ladder", restoring the pointer the deleted map row carried and matching
   `docs/wiki/Home.md:66`.

Item 30 `readme-counts-drift` is filed at `pending` with two acceptance criteria that would catch
the counts and the names. It would not have caught either version of the chaining sentence, which
is a claim about behaviour rather than about counts, so this round's blocker stays a human catch.

## The remaining blocker

`README.md:132` still reads:

> You need the first one. The other eleven are what it chains.

That is the round-1 falsehood, unfixed, in its second location. Six of the eleven are not chained
by anything: `setup`, `implement`, `spec`, `orchestrate`, `reflect`, `unslop` all return zero
references in `skills/mstack/`. It is now also a self-contradiction: `README.md:28` says five are
steps the router calls, and 106 lines later `README.md:132` says all eleven are. A reader who
notices has no way to tell which sentence to believe.

My round-1 report cited only `:26-27` in Changes required 1, so the fix pass had no reason to
look further. `rg -n 'eleven|chain' README.md` now returns exactly one line, `:132`, so this is
the last one.

Fix, one line, matching what `:26-30` already establishes: "You need the first one. The router
calls five of the others for you; the rest are here for when you want them directly." Any
phrasing works as long as it does not say all eleven are chained.

## The two questions I was asked

**"Say so if you think the README now needs to own that [mstack's escape hatch is the same shape
as the one it criticises pstack for]."** It does not, and I would leave `README.md:161-165` alone.
The criticised pstack behaviour is quoted in this repository's own research at
`docs/research/pstack-port.md:122`: feature.md step 2 says `architect` is required, then
supplies *"Skipping stays as `architect skipped: <reason>`."* That is an escape from the step.
mstack's restored clause is an escape from the *output* of a step that still runs: `/mstack:design`
is not optional in `feature.md:5`, and "or a stated reason the constraints forced the answer"
governs how many candidates come out of it. Different shapes.

The honest caveat, since you asked me to say what I could not settle: mstack does have a
general escape of pstack's exact shape, at `skills/mstack/SKILL.md:24-25` ("A step you choose not
to do stays in the list with a one-line `skip: <reason>`"), exercised by name at
`skills/mstack/playbooks/bug-fix.md:13-14` as `skip: single-site fix`. So "can the design pass be
skipped with a reason" is yes in both plugins. The paragraph survives that anyway, because its
claim is not "our playbook has no escape hatch". It is that prose cannot bind, which is why
mstack puts what must bind in code and concedes the rest to judgment at `README.md:164-165`. The
two paragraphs are arguing different things. No ownership needed.

**"Confirm that did not lose the warning's force."** It did not, and it gained some. Against
`skills/mstack/playbooks/orchestrate.md:5-9`, the prose at `README.md:100-102` keeps both
load-bearing parts, "opens by telling you not to use it" and the twelve-versus-one head-to-head,
and adds the rule the old table cell omitted: below that line, use feature. The playbook's
"in at least one measured head-to-head" is rendered "In one measured head-to-head", which is the
weaker claim and so cannot overstate. The only clause not carried over is "Choosing this playbook
is a decision worth recording with `mstack decide`", which was never in the README. As a
readability fix it also works: the 55-word cell is gone and the row is now four items long.

## Still non-blocking

- `README.md:28-30` sets up a contrast that is literally true but can be read past. `implement`
  and `spec` sit in the "yours to type" group, yet the router does cover both steps, through
  `mstack:implementer` (`skills/mstack/SKILL.md:65`, `playbooks/feature.md:15`, where delegation
  is "Mandatory, with no skip-with-reason escape") and `mstack:spec-author` /
  `mstack:spec-reviewer` (`skills/mstack/SKILL.md:65-66`). The sentence only claims they are
  available, so it is accurate, and the diagram at `README.md:61-73` shows all three agents being
  dispatched. Worth half a clause if you touch the paragraph anyway, not worth a round on its own.
- Round-1 items 6 and 7 for the table cells at `:93` and `:110` stand as written.

## Verification I ran, round 2

```
$ git rev-parse HEAD
b4894a788a87347b032e996a083c7f3cd6ec96c5

$ ./bin/mstack gate --full
... (full body green)
PASSED - 0 failures, 0 warnings
93 relative links checked, 0 broken
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin . && node scripts/check-doc-links.mjs README.md docs/wiki/*.md

PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
93 relative links checked, 0 broken
EXIT=0

$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings

$ ./bin/mstack ledger check readme-leads-with-use
FAIL no verdict at b4894a78; 1 row(s) exist at other SHAs and a new head SHA voids them
LEDGER_EXIT=1

$ rg -n 'eleven|chain' README.md
132:You need the first one. The other eleven are what it chains.
```

That ledger line is the mechanism `README.md:345-350` describes, working: my round-1 row at
`5ea9110` was voided the moment the fix commit landed, which is why this pass records its own row
at `b4894a7` rather than letting the old verdict ride.

The fix commit touches no test file. `git show --stat b4894a7` is `.mstack/ledger.tsv`,
`.mstack/progress/review_readme-leads-with-use_readme-leads-with-use.md`, `.mstack/state.json`
and `README.md`. Nothing was weakened to obtain green.

## Changes required, round 2

1. `README.md:132` - "The other eleven are what it chains" is false for `setup`, `implement`,
   `spec`, `orchestrate`, `reflect` and `unslop`, and contradicts the corrected `README.md:28`.
   Rewrite it to agree with `:26-30`. This is the only blocker; everything else on this branch is
   confirmed done.
