# The story

This page is background, not instructions: where mstack comes from, and why it is shaped
the way it is. Read it when you want the reasoning behind the workflow's rules. Skip it
freely if you just want to use the tool.

mstack has two parents. One is [pstack](https://github.com/cursor/plugins/tree/main/pstack), a
Cursor plugin by [Lauren Tan](https://github.com/poteto). The other is a spec-driven harness
that had been running in production, which these pages leave unnamed by convention. This page
says what each contributed, where they agree, where they collide, and what the join fixed.
Every claim here traces to [the research document](../research/pstack-port.md), which carries
the primary sources.

## pstack, and who poteto is

pstack lives in Cursor's [`cursor/plugins`](https://github.com/cursor/plugins) monorepo and is
the only plugin there not authored by Cursor itself. It is MIT, "Copyright (c) 2026 Lauren
Tan". Lauren Tan's GitHub handle is `poteto`, and the plugin is named after its author, not
after "product": `poteto` → `pstack`. mstack keeps that convention.

It is a large piece of work: 156 files, 44 skill directories (23 workflow, 21 single-rule
principles), 23 playbooks, and two TypeScript CLIs with real tests. One front door,
`/poteto-mode`, reads the request, matches a playbook, and copies its steps into the todo list
verbatim. The routing contract is worth quoting, because mstack's router is this, ported:

> Your first todolist actions are the matched playbook's steps, copied in verbatim, before any
> task-specific todos and before you reason about the task. [...] A step you choose not to do
> stays in the list with a one-line `skip: <reason>`; skipping silently is not allowed.

### The correction the research forced

The premise of the port was "join pstack's spec-driven workflow to a production harness". The
research killed that premise in its first finding: **pstack is not spec-driven development. It
is explicitly the opposite.** Its README says so in the section titled "why are there no
planning skills?":

> cursor already has a great plan mode which works great with pstack. but personally, i don't
> believe in planning. the best spec is code. if you do want to make a plan, `/poteto-mode`
> covers it, but it's not a default.

What pstack standardizes is not specs. It is **evidence**: repro output, traces, a typed
verification ledger keyed by `(target, sha)`, and a TSV decision log. Those four artifacts,
plus the router and the five-rung evidence ladder, are the part of pstack that mstack ports
most directly.

### What pstack could not enforce

pstack ships **zero hooks**, so every rule it has is advisory. Its feature playbook says the
design pass is required and supplies the escape hatch in the same breath: step 2 mandates
`architect`, and the next line reads *"Skipping stays as `architect skipped: <reason>`"*.
Nothing blocks anything; its `orch ledger` is the only real gate in the plugin, because it is
code. Its own shipping playbook records what advisory invalidation costs: *"Twenty-one
verdicts went stale this way in one run with no signal at all."* And it carries an honest
counter-datum about its own ceremony: measured head-to-head, the orchestration playbook
turned a half-hour twelve-unit job into one landed unit while a plain agent landed all
twelve. mstack quotes that number in its own `orchestrate` skill as the reason to check the
threshold before reaching for the machinery.

## The harness

The other parent enforced what pstack asks for. Its work items carry a lifecycle a gate
actually checks, split fast/slow so the fast pass finishes in seconds (mstack's own fast gate
gets that down to milliseconds); its header states the design rule mstack inherited: *"a gate
nobody waits for is a gate nobody runs."* Its reviewer roles ship without `Write` or
`Edit`, so "never review your own work" is a tool list
rather than a request. Its state lives on disk in two progress files with opposite disciplines:
a live checkpoint overwritten every session, and an append-only history. Its human gate is
lean and declarative: a human is interrupted only when the item is a direct request, carries a
`decision_required` fork, or a spec pass hits a product fork with different user-visible
outcomes.

Two of its lessons became mstack fixtures. First, the shape check: its gate documents that a
state file like `{"features": {}}` passes `jq empty` while silently disabling every downstream
query, so the gate must check shape, not parseability. The defect shipped there, in
production, and the gate's own comment pins it to two of the harness's issue numbers.
Second, the report contract: a review subagent once went idle without writing its report.
The analysis lived in the subagent's own working context, which a parent never sees, so it
would have vanished silently; it was caught only
because the leader checked for the file rather than trusting the one-line reply. The recorded
lesson, *"a reply is not evidence, the file is"*, is now the `SubagentStop` hook's whole job.

The harness had gaps of its own, and they are on the fix list below: its merge gate was prose,
its lifecycle enum was duplicated in six places, it had no worktree tooling (twelve of its
seventeen worktrees were merged and never cleaned up), and no status line.

## Where the two agree

pstack and the harness are philosophically opposed on planning, and they still converge on five
things. That convergence is the strongest signal in the research, because it is the same
lessons learned twice, independently:

1. **Evidence over assertion.** *"A reply is not evidence, the file is"* (harness) and *"Agents
   report what they intended, not always what happened"* (pstack) are one lesson.
2. **Author ≠ reviewer, enforced structurally**, not by asking nicely.
3. **Typed verdict enums, invalidated by a new SHA.**
4. **State on disk, because context windows die.**
5. **Gates must be code.** Both repos say so; only pstack's `orch ledger` and the harness's
   gate script actually were.

## Where they disagree, and the resolution

pstack routes straight to evidence; the harness routes through a spec. The resolution was
already latent in the harness, which carried an `sdd` flag per work item. mstack makes the spec
path **opt-in per item**: it turns on when the item has `sdd: true`, carries a
`decision_required` field, or the change crosses several subsystems. Both paths share one
ledger, one set of gates, and one durable state. The route changes how work is planned; it
never changes what counts as proof.

## What the join fixed

The port list is pstack's judgment plus the harness's enforcement. The fix list is what neither
parent had:

| Fix | The gap it closes |
|---|---|
| Real hooks, five of them | pstack has zero; every non-negotiable was prose |
| Merge gate as code, exit 0/1/2 | the harness had the policy as prose an agent had to choose to obey |
| `mstack worktree new/list/prune` | the harness had none, and twelve stale worktrees to show for it |
| Lifecycle enum in one source file, linted against duplication | the harness carried six copies |
| `mstack lint-plugin` over the prose itself | pstack: 125 Markdown files, zero validation |
| Report paths allocated before fan-out, dropouts named | pstack's `/tmp/arena-<slug>/` collides across concurrent runs |
| State persisted for every path, not just orchestration | pstack persists state in 1 of 23 playbooks |
| A status line that surfaces stale verdicts | neither parent had one |
| No runtime lock-in: bun or node ≥ 22.6, zero dependencies | pstack requires Bun specifically; the harness required bash + jq |

The principle behind the whole column is the one mstack's skills cite as governing themselves:
**encode lessons in structure**. A rule that lives only in prose drifts; make it a type, a
test, a lint, or a hook.

## Credit

The router, playbooks, evidence ladder, TSV decision log and verification ledger come from
[pstack](https://github.com/cursor/plugins/tree/main/pstack) by
[Lauren Tan](https://github.com/poteto), MIT. The lifecycle gate, the hooks-that-enforce
posture, tool-list-as-permission roles, the progress-file discipline, `decision_required` as a
data field and the fast/slow gate split come from the unnamed production harness. What is new
in mstack is joining them and making the gates executable on Claude Code's primitives: skills,
hooks, agents, and a `bin/` on the tool's `PATH`. Sources for every claim above:
[docs/research/pstack-port.md](../research/pstack-port.md).
