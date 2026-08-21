# Skills and playbooks

Skills are the commands you type; playbooks are the step lists they follow. When you start
work with `/mstack <what you want done>`, a router matches your request to one of seven
playbooks and copies its steps into the todo list before any reasoning happens, and each step
either runs or is skipped out loud with a reason. This page introduces all twelve skills and
all seven playbooks, and explains the one routing decision that matters: whether your work
takes the direct path or the spec path.

A skill here is a `/mstack:<name>` command: a set of instructions Claude Code reads into the
conversation when you invoke it. Each lives in `skills/<name>/SKILL.md`, and its frontmatter
description says when to use it. The router is the exception in naming only: its skill is
named `mstack`, so it is invoked as plain `/mstack`, and it is the front door everything else
sits behind.

## The twelve skills

| Skill | What it does | Reach for it when |
|---|---|---|
| `/mstack` | The router. Matches the request to a playbook, copies its steps into the todo list verbatim, and routes the work end to end | You are starting a task under mstack |
| `/mstack:setup` | Creates `.mstack/` and seeds the work queue from what the repository already tells you | Once per repository, or when mstack reports no `.mstack/` directory |
| `/mstack:understand` | Builds a traced mental model of a subsystem: how it works now, and why it ended up this way | Before changing unfamiliar code, or when asked how or why something works |
| `/mstack:design` | Generates structurally distinct candidates, judges them against criteria fixed in advance, and records the decision with its rejected alternatives | Before implementing anything non-trivial |
| `/mstack:spec` | Writes and adversarially reviews a specification before any code, with stable requirement ids and EARS statements | An item is marked `sdd`, or a change crosses several subsystems |
| `/mstack:implement` | Implements one work item with the tests that prove it, then hands it to a different pass to judge | Starting to write code for an item |
| `/mstack:verify` | Proves one claim on the surface where it is actually true or false, and records a typed verdict in the ledger | After implementing anything |
| `/mstack:review` | Judges work that already exists against its requirements, its tests and the real diff, using reviewers that did not write it | A branch, a PR, or a diff needs judging |
| `/mstack:ship` | Takes a verified change through review threads, CI and the merge gate to merged | Opening or landing a PR |
| `/mstack:orchestrate` | Runs a program of work across many changes, tracks and sessions, with isolated worktrees | Multi-session programs only; single-session work takes the feature route |
| `/mstack:reflect` | Reviews a finished session for what should change in the workflow itself | After closing an item, or after something went wrong |
| `/mstack:unslop` | Cuts the tells that make writing read as machine-generated | Writing anything a human will read |

## The router

`skills/router/SKILL.md` is what `/mstack` runs. It orients first (`mstack gate`, then the
active item and its recorded next step), then matches the request against a route table:

| The request is about | Where it goes |
|---|---|
| Understanding how something works, or why it is the way it is | the investigate playbook |
| Something broken, wrong, or slower than it should be | the bug-fix playbook |
| Building something new | the feature playbook |
| Changing structure without changing behaviour | the refactor playbook |
| Proving a change actually works | `/mstack:verify` |
| Judging work that already exists | `/mstack:review` |
| Getting a change merged | `/mstack:ship` |
| A program of work across many changes | the orchestrate playbook |
| Picking up an interrupted session | the resume playbook |
| Clearing out dead branches and worktrees | the cleanup playbook |

The load-bearing rule is what happens next: the matched playbook's steps are copied into the
todo list **verbatim**, before any task-specific todos. A step you decline stays in the list
with a one-line `skip: <reason>`, because the failure mode is reading a playbook and then
writing a bespoke plan that quietly drops its named steps. If nothing fits, the router says
so and designs a playbook in the same shape rather than improvising without a written plan.

The shape of one request flowing through router, playbook, agents and gate is drawn on
[Home](Home.md); the agents the playbooks delegate to are introduced in
[The-Agents](The-Agents.md).

## The seven playbooks

Playbooks live in `skills/router/playbooks/`, one file each. A playbook is a short numbered
step list plus the reply it owes the user, and each one carries a discipline that is the
reason it exists:

| Playbook | For | Its discipline |
|---|---|---|
| `investigate` | Answering a question about the system; produces understanding, not a change | Every claim says where it stopped on the evidence ladder |
| `bug-fix` | Something broken, wrong, or slow | Reproduce it yourself first, and write the failing test before the fix; the repro lands before the fix in history |
| `feature` | Building something new | Understand and design before building; delegating implementation is mandatory, with no skip-with-reason escape, because the gain is review separation |
| `refactor` | Changing structure without changing behaviour | Pin current behaviour with characterization tests before touching anything, and verify by running them unchanged |
| `resume` | Picking up interrupted work | Read the recorded state, then reconcile against the repository; where they disagree, the repository wins |
| `cleanup` | Dead branches and dead worktrees | `mstack worktree prune` lists candidates and removes nothing without `--yes`; branch deletion is `-d`, never `-D` |
| `orchestrate` | A program of work: many changes, several tracks, more than one session | Pilot one unit end to end before fanning out; every worker gets a brief a stranger could execute |

## The two paths

Most work takes the **direct path**: the item's `acceptance` array is the contract, the
implementer must not widen it, and building starts immediately.

The **spec path** is opt-in, for work that needs a contract written and attacked before any
code exists. It turns on when the item has `sdd: true`, when it carries a `decision_required`
fork, or when the change crosses several subsystems or the user will step away and trust it
later. On the spec path, no code is written before `.mstack/specs/<slug>/` exists and a
different pass has approved it.

Both paths end the same way: verify, then review by someone who did not write it, then the
merge gate. The route changes how the work is planned. It never changes what counts as proof.
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
