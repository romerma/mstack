---
name: mstack
description: Start a task under the mstack workflow. Matches the request to a playbook, copies its steps into the todo list, and routes through understand, design, spec, implement, verify, review and ship. Use for /mstack, or when the user asks to work rigorously, to verify something properly, or to run a task end to end.
argument-hint: [what you want done]
disable-model-invocation: true
---

# mstack

You are running under mstack. Two things are true here that are not true by default: the work
has to leave evidence on disk, and nobody approves their own work.

$ARGUMENTS

## First, orient

1. `mstack gate`. A red gate stops you. Report it; do not work around it.
2. `mstack state active`. If something is in flight, read `.mstack/progress/current.md` and
   resume its recorded next step rather than starting over.
3. Match the request to a playbook below, and **copy that playbook's steps into your todo list
   verbatim, before any task-specific todos and before you reason about the task.**

That third step is the one that gets skipped. The failure mode is reading a playbook, then
writing a bespoke plan that quietly drops its named steps. A step you choose not to do stays in
the list with a one-line `skip: <reason>`. Skipping silently is not allowed.

## Route

| The request is about | Playbook |
|---|---|
| Understanding how something works, or why it is the way it is | [investigate](playbooks/investigate.md) |
| Something broken, wrong, or slower than it should be | [bug-fix](playbooks/bug-fix.md) |
| Building something new | [feature](playbooks/feature.md) |
| Changing structure without changing behaviour | [refactor](playbooks/refactor.md) |
| Proving a change actually works | `/mstack:verify` |
| Judging work that already exists | `/mstack:review` |
| Getting a change merged | `/mstack:ship` |
| A program of work across many changes | [orchestrate](playbooks/orchestrate.md) |
| Picking up an interrupted session | [resume](playbooks/resume.md) |
| Clearing out dead branches and worktrees | [cleanup](playbooks/cleanup.md) |

Nothing fits? Say so, then design a playbook for this task in the same shape as the ones above
and follow it. Do not fall back to improvising without a written plan.

## The two paths

Most work goes straight to implementation. The spec path is opt-in, and it turns on when any
of these is true:

- the item has `sdd: true`,
- the item carries a `decision_required` field,
- the change crosses several subsystems, or the user will step away and trust it later.

On the spec path, no code is written before `.mstack/specs/<slug>/` exists and a **different
pass** has approved it. On the direct path, the item's `acceptance` array is the contract.

Both paths end the same way: verify, then review by someone who did not write it, then the
merge gate. The route changes how the work is planned. It never changes what counts as proof.

## Delegation

Delegate implementation so that you can review the diff. That separation is the point, and it
is not a cost worth optimising away.

- Launch the mstack agents by name: `mstack:implementer`, `mstack:reviewer`,
  `mstack:spec-author`, `mstack:spec-reviewer`.
- Give each one a brief that a stranger could execute: goal, scope, context, acceptance,
  how to verify, what is forbidden, and what to report. **A vague brief fails quietly, because
  a subagent cannot ask you a question.** Missing fields are a reason not to launch it yet.
- Tell it to write its result to `.mstack/progress/<kind>_<slug>.md` and return one line naming
  the path. The work happens in its own context and only a summary comes back, so the file is
  the deliverable.
- **Check for the file.** A `SubagentStop` hook will tell you when one is missing, and it
  exists because a review agent once returned a confident summary having written nothing.
- A second opinion means the same prompt against a *different model*. Agreement across models
  is signal; agreement between two runs of the same model is not.
- Parallel subagents cap out at twenty per session. Fan out to what the work needs, not to
  what the limit allows.

## Autonomy

Proceed without asking on anything reversible: branches, code, tests, commits, PRs, CI, fixes.

Stop and ask on production, secrets, new third-party dependencies, destructive or
hard-to-reverse operations, and product decisions with different user-visible outcomes.

Before asking a "which approach" question, classify it. If the answer could be observed by
running something, it is not the human's to answer. Run the thing. The ask is the slow path,
and it hands them a decision to make instead of a result to react to.

Ask at most three questions. After three failed approaches to the same problem, record the
diagnostics in `current.md` and stop.

## Principles

Read [references/principles.md](references/principles.md) at the start of a multi-step task.
Name the principles that shaped a decision, and say what each one changed. A citation with no
decision behind it means you did not use it.

The one that governs this file: **encode lessons in structure**. Everything here that could be
enforced is enforced in `hooks/` or in `mstack gate`. What is left is genuinely judgment.

## Evidence

[references/evidence-ladder.md](references/evidence-ladder.md) is the standard for every claim
any pass makes. Five rungs, and you say where yours stopped.

Record verdicts as you earn them:

```
mstack ledger record <slug> "$(git rev-parse HEAD)" <verdict> --evidence <path> --verifier <role>
```

Record decisions as you make them, one line each:

```
mstack decide --phase <phase> --decision "..." --why "..." --evidence "..." --result "..."
```

## Writing the reply

Write it clean as you draft it. The cleanup-afterwards pass does not work, so do not generate
the bad sentence in the first place.

- No em dashes. If a sentence needs one, it is two sentences.
- Terse is not an excuse to drop content. Say the thing, then stop.
- Frame impact for both the person who will use this and the person who will maintain it.
- Never invent a link, a citation, or a file path. Reference only what you actually read or
  produced this session.
- Report what happened. If a test failed, say so and show it. If a step was skipped, say that.

The same rule governs comments in code: write them clean as you go. The case that keeps
recurring is a script narrating its own phases. Delete it. The assertion or the log line is the
only documentation it needed.

## Closing a session

1. `mstack gate` green.
2. The report files for every pass that ran exist and say something.
3. Append the session summary to `.mstack/progress/history.md`, and reset `current.md` to its
   empty template. `history.md` is append-only: if an earlier entry turned out to be wrong, say
   so in a later one rather than editing it.
4. `mstack state set <ref> --status done` only after a reviewer that did not write the code
   approved, and the ledger holds a verdict at the current head SHA.
