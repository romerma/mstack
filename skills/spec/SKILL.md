---
name: spec
description: Write and adversarially review a specification before any code is written, with stable requirement ids, EARS statements and a task list that maps back to them. Use on the opt-in spec path, when an item is marked sdd, when a change crosses several subsystems, or when asked to write a spec or requirements.
argument-hint: [item slug]
---

<!-- Origin: the task-size rule and the rule for writing a task for an executor with no context, in section 4, from obra/superpowers, skills/writing-plans/SKILL.md (its Task Right-Sizing, Overview, No Placeholders and Remember) @ 8e1262a3bae92b640d87fa81c51c53b65e490590 (MIT, licenses/obra-superpowers-LICENSE.txt, identical at that commit). Adapted: Task Right-Sizing is the Size paragraph, reworded; from Overview only the premise that the reader has none of the author's context is carried, as the second paragraph, and its "questionable taste", its skilled-developer and test-design assumptions, the docs the reader might need to check and "DRY. YAGNI. TDD. Frequent commits" are not; from No Placeholders, "TBD" (of its first bullet), "add error handling" and "handle edge cases" (of its second, without "add validation"), and the references to types, functions or methods defined in no task (here a name that an existing file defines also counts, and files are named beside types and functions) are carried, and "Similar to Task N" is carried as "as in task N" with a different remedy (the source repeats the code, here the task says it in full); its "Write tests for the above" and "Steps that describe what to do without showing how" are not carried, because a task here has no code block; from Remember, "Exact file paths always" and "Exact commands with expected output" are carried and "Complete code in every step" is not; Bite-Sized Task Granularity, Plan Document Header (with its Global Constraints), Task Structure (its Files and Interfaces blocks, steps and commit step), Scope Check, File Structure, Self-Review and Execution Handoff are not copied, nor are the announcement line, the Context line about worktrees, or the save path `docs/superpowers/plans/` (the file stays `.mstack/specs/<slug>/tasks.md`). -->

# Spec

The spec path is opt-in. It turns on when the item has `sdd: true`, carries a
`decision_required` field, or the change crosses several subsystems. Otherwise the item's
`acceptance` array is the contract and you should be implementing.

Four artifacts in `.mstack/specs/<slug>/`, all four required before the item leaves
`specifying`. Templates in [references/templates.md](references/templates.md), statement kit in
[references/ears.md](references/ears.md).

## 1. Ground the spec in its source

Read what the item cites, and **re-verify every `file:line` it references**. Issues rot: one
written weeks ago names code that has moved, and it can be wrong about the mechanism on the day
you pick it up.

Open with the provenance:

```
> Source: issue #370. This spec is authoritative for implementation;
> #370 remains the discussion venue.
```

If the source and the spec disagree, the source is the newer intent. Stop and reconcile.
Implementing an outdated spec correctly is still the wrong outcome.

## 2. Interview the repository, not the user

Most open questions are answered by the code, the history, or an existing decision. Go there
first. Bring the human only the forks the repository genuinely cannot settle: product choices
with different user-visible outcomes. Those go in `decision_required`, which is what triggers
the human gate.

## 3. Requirements

Stable ids `R1`, `R2`, and EARS statements. One requirement carries one obligation.

A spec is a behaviour contract, not an implementation plan. Quick test: if the implementation
could change without changing externally visible behaviour, it does not belong here.

Every acceptance bullet maps to at least one requirement. Every requirement gets at least one
WHEN/THEN scenario.

## 4. Tasks

Every task names the requirements it covers: `- [ ] 1.1 ... (covers R1, R3)`. The last group is
always verification and close. A requirement no task covers is a requirement nobody will build.

**Size.** A task is the smallest unit that carries its own test cycle and is worth a fresh
reviewer's gate. Setup, configuration, scaffolding and docs fold into the task whose deliverable
needs them. Split only where a reviewer could reject one task and approve its neighbour. Each
task ends in something that can be tested by itself.

**Written for an executor who has only this file.** Each task gives the exact paths it touches,
the exact command that shows it done and what that command prints. Never "TBD", "add error
handling", "handle edge cases", "as in task 3", or a name (type, function, file) that no task
or existing file defines.

## 5. Grill it, with a different pass

`mstack:spec-reviewer`, which has no `Write` and no `Edit`, and which must not be the pass that
wrote the spec. Three questions in writing:

- **Hidden assumptions.** What does this take for granted that nobody checked?
- **Rejected alternatives.** What else was possible, and is the stated reason real?
- **Fail paths.** Dependency down, input hostile, value absent, two callers racing.

`CHANGES_REQUESTED` means revise and repeat. It does not mean present the plan anyway.

## 6. Only then

`mstack state set <slug> --status spec_ready`. The gate refuses to let an `sdd` item sit past
`specifying` without all four artifacts on disk, which is what stops "we will write the spec
after" from becoming the norm.
