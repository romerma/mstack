---
name: orchestrate
description: Run a program of work across many changes, tracks and sessions, with isolated worktrees, briefs a stranger could execute, and continuous landing. Use only for multi-session programs; single-session work should use the feature route instead.
argument-hint: [program name]
---

# Orchestrate

**Check the threshold first.** Work one agent could finish inside a single session is not a
program. This machinery costs real throughput: in one measured head-to-head, the equivalent
ceremony turned a twelve-unit job into one landed unit while a plain agent landed all twelve.
Below that line, use the feature route.

Choosing this is a decision worth recording, including why the simpler route was rejected:

```
mstack decide --phase frame --decision "run as a program" --why "..." --evidence "..." --result open
```

The full procedure is in [the orchestrate playbook](../router/playbooks/orchestrate.md). Three
things carry most of the weight.

## Isolation is what makes parallelism legal

`mstack worktree new <slug>` per concurrent unit. Each worktree carries its own `.mstack/`,
which is what makes "one active item" mean one active item *here* rather than one across the
whole machine. Record the base SHA in that worktree's `current.md`: "branched from main" is not
a checkpoint, because main moved.

## The brief is the product

A vague brief fails quietly, because a worker cannot ask you a question. Nine fields: goal,
scope, context, acceptance, verify, timebox, forbidden, report, standing constraints. Missing
fields are a reason not to launch it yet.

Size the brief to the unit. A four-kilobyte scaffold around a two-line edit costs more to write
and obey than the edit.

Workers cannot see each other. Anything a unit depends on gets pasted into its context in full,
not referenced as "see the other agent's report".

## Landing is continuous, never a final phase

Integration starts with the first verified unit. Walk up from the lowest unmerged change and
stop at the first without a passing verdict: a verified change sitting above an unverified one
is not landable, because merging it pulls the gap in underneath it.

Concurrent subagents cap at twenty per session, and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` moves
that number. Past the cap, spawning **fails** — it does not queue — so `mstack fanout plan`
refuses first, against the session's configured limit. It bounds one fan-out, not a session: two
plans of fifteen both pass, and keeping the session total under the cap is yours to do.
Fan out to what the work needs, not to what the limit allows, and say what you dropped if you
bound the fan-out: silent truncation reads as full coverage.

`mstack fanout check` afterwards names the workers that did not report. Named, not counted — "two
of three returned" sends you looking, "security did not report" tells you what to re-run.
