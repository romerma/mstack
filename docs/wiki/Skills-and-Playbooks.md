# Skills and playbooks

Skills are the commands you type; playbooks are the step lists they follow. When you start
work with `/mstack <what you want done>`, a router matches your request to one of eight
playbooks, or sends it straight to a single skill when one command covers the whole job. A
matched playbook's steps are copied into the todo list before any reasoning happens, and each
step either runs or is skipped out loud with a reason. This page introduces all fourteen skills
(thirteen commands and one internal reference) and all eight playbooks, says what each one
leaves on disk, and explains the one routing decision that matters: whether your work takes the
direct path or the spec path.

A skill here is a `/mstack:<name>` command: a set of instructions Claude Code reads into the
conversation when you invoke it. Each lives in `skills/<name>/SKILL.md`, and its frontmatter
description says when to use it. The router is the exception in naming only: it sits in
`skills/router/` but declares `name: mstack`, and Claude Code registers a skill under
`/<plugin>:<directory>` plus, when the declared name carries no colon, that bare name as an
alias. So the router answers three spellings: `/mstack:router` from its directory,
`/mstack:mstack` from its declared name, and plain `/mstack` from the alias. The last is the
front door everything else sits behind.

One more skill is not a command: `skills/test-first/SKILL.md` carries `user-invocable: false`
and is preloaded into `mstack:implementer` through that agent's `skills` field. It holds the
test-first reference (what a good test is, the red-then-green loop, the mutant check) and is
why the thirteen below are counted as the commands.

## The thirteen skills

| Skill | What it does | Reach for it when |
|---|---|---|
| `/mstack` | The router. Matches the request to a playbook, copies its steps into the todo list verbatim, and routes the work end to end | You are starting a task under mstack |
| `/mstack:setup` | Creates `.mstack/` and seeds the work queue from what the repository already tells you | Once per repository, or when mstack reports no `.mstack/` directory |
| `/mstack:understand` | Builds a traced mental model of a subsystem: how it works now, and why it ended up this way | Before changing unfamiliar code, or when asked how or why something works |
| `/mstack:design` | Generates structurally distinct candidates, judges them against criteria fixed in advance, and records the decision with its rejected alternatives | Before implementing anything non-trivial |
| `/mstack:spec` | Writes and adversarially reviews a specification before any code, with stable requirement ids and EARS statements (Easy Approach to Requirements Syntax) | An item is marked `sdd` (the spec-driven flag), or a change crosses several subsystems |
| `/mstack:implement` | Implements one work item with the tests that prove it, then hands it to a different pass to judge | Starting to write code for an item |
| `/mstack:verify` | Proves one claim on the surface where it is actually true or false, and records a typed verdict in the ledger | After implementing anything |
| `/mstack:review` | Judges work that already exists against its requirements, its tests and the real diff, using reviewers that did not write it | A branch, a PR, or a diff needs judging |
| `/mstack:ship` | Takes a verified change through review threads, CI and the merge gate to merged | Opening or landing a PR |
| `/mstack:orchestrate` | Runs a program of work across many changes, tracks and sessions, with isolated [worktrees](The-CLI.md) (each its own checkout of the repository) | Multi-session programs only; single-session work takes the feature route |
| `/mstack:reflect` | Reviews a finished session for what should change in the workflow itself | After closing an item, or after something went wrong |
| `/mstack:unslop` | Cuts the tells that make writing read as machine-generated | Writing anything a human will read |
| `/mstack:commit` | Holds a commit message to Conventional Commits 1.0.0: the type the change earns, the description, breaking changes marked | Before a commit, an amend, a squash, or a PR title |

## What each skill leaves on disk

A skill that ran and left nothing behind is a skill whose work vanished with the context
window, so most of them write something durable. Per skill:

| Skill | What it leaves on disk |
|---|---|
| `/mstack` | The matched playbook's steps in the todo list, and the ledger and decision rows the passes it routes to earn along the way |
| `/mstack:setup` | The `.mstack/` store itself (`state.json`, `progress/current.md`, `progress/history.md`, `ledger.tsv`, `decisions.tsv`, an empty `specs/`), the seeded items, and a Workflow note in the project's `CLAUDE.md` |
| `/mstack:understand` | `.mstack/progress/explore_<topic>.md`, one per fanned-out reader (fanning out runs several readers in parallel, each with its own narrow question); a one-file question is answered in the reply and writes nothing |
| `/mstack:design` | `.mstack/specs/<slug>/design.md`, or a decision row in `decisions.tsv` when there is no spec |
| `/mstack:spec` | The four artifacts in `.mstack/specs/<slug>/`: `proposal.md`, `design.md`, `tasks.md`, `spec.md`; a product fork it cannot settle goes onto the item as `decision_required` |
| `/mstack:implement` | The code and its tests, `.mstack/progress/impl_<slug>.md`, decision rows as calls are made, and `current.md` kept live throughout |
| `/mstack:verify` | One ledger row: target, commit, typed verdict, evidence path, and who ran it |
| `/mstack:review` | One report per [lens](The-Agents.md#reviewer) under `.mstack/progress/` (paths allocated up front by `mstack fanout plan`), and one ledger row per review round |
| `/mstack:ship` | The PR, a ledger verdict at the merge SHA if that SHA has none, the item's close in `state.json`, an appended `history.md` entry and a reset `current.md` |
| `/mstack:orchestrate` | One item per unit in `state.json`, a worktree (its own checkout of the repository) per concurrent unit with the base SHA recorded in that worktree's `current.md`, and a report from every worker |
| `/mstack:reflect` | An appended entry in `.mstack/progress/history.md`; changes to the workflow itself are proposed to the human, never applied unilaterally |
| `/mstack:unslop` | Nothing of its own. It shapes the prose you were already writing |
| `/mstack:commit` | Nothing of its own. It shapes the commit message you were already writing |

The files themselves are read column by column on [State-Files](State-Files.md).

Most skills also carry a prohibition, and they are worth knowing before you run one:

- The router never skips a playbook step silently; a declined step stays in the todo list
  with `skip: <reason>`.
- `setup` never overwrites an existing store file without `--force`, and acceptance criteria
  are quoted from the source, never paraphrased.
- `understand` does not let an unreachable source read as an absence: "Slack was not
  searchable" is a finding, not "there was no discussion". When the project has a
  `GLOSSARY.md` it reads it and uses its terms; intake does the same for an item's title and
  acceptance, and a term the request uses differently is a fact to settle against the code,
  not a question for the user.
- `design` fixes its judging criteria before any candidate exists, and a design with no
  rejected alternative is a first idea, not a decision.
- `spec` writes no code, and the item cannot leave `specifying` until all four artifacts
  exist and a different pass has approved them.
- `implement` does not widen the acceptance array, and never weakens an existing test to
  get green.
- `verify` never records a [rung](#the-evidence-ladder) above what actually ran, and
  inconclusive is not a pass.
- `review` requires reviewers that did not write the code, and nobody types the lone
  reviewer's ledger row on its behalf.
- `ship` never merges past a red check by another route, and never force-pushes the default
  branch.
- `orchestrate` is refused below its threshold: work one agent could finish in a session
  takes the feature route instead.
- `reflect` never edits skills, agents or hooks unilaterally, and `history.md` is
  append-only. A term the work introduced goes into `GLOSSARY.md`, and a decision that is hard
  to reverse, surprising without context and a real trade-off becomes an ADR under `docs/adr/`,
  both before the review of the item that introduced them; what `reflect` proposes after the
  verdict goes into a follow-up item. A decision missing any one of the three stays a
  `decisions.tsv` row, and a session that introduced nothing writes nothing.
- `unslop` is itself a list of prohibitions; the rule above them all is to not generate the
  bad sentence in the first place.
- `commit` states Conventional Commits only and never presents a house rule as the
  specification; it defers to a repository's own `CLAUDE.md` or `CONTRIBUTING.md` for those.

## The router

`skills/router/SKILL.md` is what `/mstack` runs. It orients first (`mstack gate`, the
session gate described on [Gates-and-Hooks](Gates-and-Hooks.md), then the active item and
its recorded next step), then runs intake (the request becomes a queue item with acceptance,
a source and test seams; method in `skills/router/references/intake.md`), then matches the request against a route table:

| The request is about | Where it goes |
|---|---|
| Understanding how something works, or why it is the way it is | the investigate playbook |
| Something broken, wrong, or slower than it should be | the bug-fix playbook |
| Building something new | the feature playbook |
| Changing structure without changing behaviour | the refactor playbook |
| Reviewing the architecture, or finding where the code should be deeper | the deepen playbook |
| Proving a change actually works | `/mstack:verify` |
| Judging work that already exists | `/mstack:review` |
| Getting a change merged | `/mstack:ship` |
| Writing the commit message, or a PR title | `/mstack:commit` |
| A program of work across many changes | the orchestrate playbook |
| Picking up an interrupted session | the resume playbook |
| Clearing out dead branches and worktrees | the cleanup playbook |

The load-bearing rule is what happens next: the matched playbook's steps are copied into the
todo list **verbatim**, before any task-specific todos. A step you decline stays in the list
with a one-line `skip: <reason>`, because the failure mode is reading a playbook and then
writing a bespoke plan that quietly drops its named steps. If nothing fits, the router says
so and designs a playbook in the same shape rather than improvising without a written plan.

The shape of one request flowing through router, playbook, agents and merge gate is drawn on
[Home](Home.md); the agents the playbooks delegate to are introduced in
[The-Agents](The-Agents.md).

## The eight playbooks

Playbooks live in `skills/router/playbooks/`, one file each. A playbook is a short numbered
step list plus the reply it owes the user, and each one carries a discipline that is the
reason it exists:

| Playbook | For | Its discipline |
|---|---|---|
| `investigate` | Answering a question about the system; produces understanding, not a change | Every claim says where it stopped on the evidence ladder |
| `bug-fix` | Something broken, wrong, or slow | Reproduce it yourself first, and write the failing test before the fix; the repro lands before the fix in history |
| `feature` | Building something new | Understand and design before building; a named test-first step hands the implementer the item's seams as pre-agreed; delegating implementation is mandatory, with no skip-with-reason escape, because the gain is review separation |
| `refactor` | Changing structure without changing behaviour | Pin current behaviour with characterization tests before touching anything, and verify by running them unchanged |
| `deepen` | Reviewing the architecture, or finding where the code should be deeper | Uses the deletion test and the other tests in `skills/design/references/deep-modules.md`; files at most five candidates as `pending` items and asks the user nothing; implements none |
| `resume` | Picking up interrupted work | Read the recorded state, then reconcile against the repository; where they disagree, the repository wins |
| `cleanup` | Dead branches and dead worktrees | `mstack worktree prune` lists candidates and removes nothing without `--yes`; branch deletion is `-d`, never `-D` |
| `orchestrate` | A program of work: many changes, several tracks, more than one session | Pilot one unit end to end before fanning out; every worker gets a brief a stranger could execute |

## What each playbook leaves behind

| Playbook | What it leaves behind |
|---|---|
| `investigate` | `.mstack/progress/explore_<topic>.md` per fanned-out reader, and a decision row for each conclusion worth remembering |
| `bug-fix` | A failing repro test that lands before the fix in history, then the fix itself |
| `feature` | A recorded design decision, the implementer's code, tests and report, and a ledger verdict from the verify step |
| `refactor` | Characterization tests committed before anything moves, then one commit per transformation |
| `deepen` | Up to five `pending` items, each with the files, the deepening, observable acceptance and the test surface as a seam; none when nothing is worth filing |
| `resume` | Corrections to `current.md` wherever the record and the repository disagreed |
| `cleanup` | Removals, mostly; plus a ledger verdict and a close for items whose work landed long ago and were never closed out |
| `orchestrate` | One item per unit in `state.json`, a worktree per concurrent unit, and a report from every worker |

## The two paths

Most work takes the **direct path**: the item's `acceptance` array is the contract, the
implementer must not widen it, and building starts immediately.

The **spec path** is opt-in, for work that needs a contract written and attacked before any
code exists. It turns on when the item has `sdd: true` (sdd is short for spec-driven
development), when it carries a `decision_required`
fork, or when the change crosses several subsystems or the user will step away and trust it
later. On the spec path, no code is written before `.mstack/specs/<slug>/` exists and a
different pass has approved it.

Both paths end the same way: verify, then review by someone who did not write it, then the
merge gate ([Gates-and-Hooks](Gates-and-Hooks.md)). The route changes how the work is planned. It never changes what counts as proof.
The full lifecycle, with the statuses the gate enforces, is in
[How-A-Work-Item-Flows](How-A-Work-Item-Flows.md).

## The evidence ladder

Every claim any pass makes is placed on the ladder in
`skills/router/references/evidence-ladder.md`, and the pass says where its claim stopped:

| Rung | What it means |
|---|---|
| 1 | You said so |
| 2 | You pointed at the line |
| 3 | You showed the bad case cannot happen |
| 4 | You ran it |
| 5 | You reproduced it in the running system |

Anything that cannot reach rung 4 is said out loud rather than written up as settled. How the
rungs map onto the ledger's typed verdicts is covered in [State-Files](State-Files.md).
