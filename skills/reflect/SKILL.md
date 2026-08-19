---
name: reflect
description: Review a finished session for what should change in the workflow itself, deciding for each lesson which document or check should absorb it. Use after closing an item, after something went wrong, or when asked to run a retro or improve the process.
argument-hint: [session or item slug]
---

# Reflect

The output is not a list of observations. It is a decision, per lesson, about **where that
lesson now lives**.

## 1. Gather what actually happened

`.mstack/progress/*_<slug>.md`, `decisions.tsv`, the commit history, the review verdicts, and
the CI runs. Look for the gap between what the record says and what the diff shows.

## 2. Three lenses, in parallel

- **Judgment.** Where did a call turn out wrong, and what was knowable at the time?
- **Tooling.** What was slow, repetitive, or done by hand three times?
- **Divergent.** What would someone who disagreed with the whole approach say?

## 3. Sort every finding

| Verdict | Meaning |
|---|---|
| **Accepted** | Worth acting on now |
| **Backlog** | Real, but not now. Say what would make it now. |
| **Rejected** | Considered and declined, with the reason |

## 4. Then the question that matters

For each accepted finding, name the document or check that **absorbs** it. This is the step
that separates a retro from a diary.

| If the lesson is | It belongs in |
|---|---|
| A rule an agent must follow every time | A hook, or the gate. Not prose. |
| A constraint specific to one directory | That directory's `CLAUDE.md` |
| A decision with lasting consequences | An ADR, or `decisions.tsv` |
| A procedure someone will repeat | A skill or a playbook |
| A gap in what gets verified | A new check in the gate, or a new test |

**Anything better enforced by a lint, a type or a test goes to Backlog as a code change, not to
Accepted as a documentation change.** A rule that lives only in prose drifts, and the drift is
invisible until it costs something. That is the whole reason this plugin has a `hooks/`
directory.

## 5. Do not edit the workflow unilaterally

Changes to skills, agents or hooks are proposed and shown, then applied once the human agrees.
A workflow that rewrites itself mid-session is a workflow nobody can reason about.

## 6. Append, never edit

The session summary goes at the end of `.mstack/progress/history.md`. If an earlier entry
turned out to be wrong, say so in a later one. The record of what you believed at the time is
part of what makes the retro possible at all.
