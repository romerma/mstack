---
name: implement
description: Implement one work item with the tests that prove it, keeping durable state current and recording the requirement-to-test map, then hand it to a different pass to judge. Use when starting to write code for an item, or when asked to implement, build, or fix something under mstack.
argument-hint: [item slug]
---

# Implement

Delegate this to `mstack:implementer` rather than doing it in the main session. The gain is
review separation: a pass that wrote the code cannot review it, and "it was faster to do it
myself" trades away the only structural check in the workflow.

## Where the contract lives

On the spec path, work from `.mstack/specs/<slug>/` and execute `tasks.md` in order, ticking
each box as you finish. Not from the issue, and not from the acceptance array: the spec is
what was reviewed.

On the direct path, the item's `acceptance` array is the contract. Do not widen it. If the work
turns out to need something outside it, that is a finding, not a licence.

## While you work

Keep `.mstack/progress/current.md` updated **as you go**, not at the end. Its last section
answers one question: if this session stops right now, what should the next one do first.

```
mstack decide --phase implement --decision "..." --why "..." --evidence "..." --result "..."
```

One row is one decision. If it does not fit on one line, the decision is not crisp yet.

## Tests

Every behaviour change gets a test that **fails without the change**. Check that: revert the
change locally and watch it go red. A test that passes either way is not coverage, it is
decoration.

Never weaken an existing test to get green. If a test is genuinely wrong, fix it deliberately,
in its own commit, with the reason recorded. That is a different act from making a failure go
away, and the commit history should show which one happened.

Prefer no new test over a bad one. A bad test is one that mostly exercises mocks, encodes
current implementation details, depends on timing or global state, or would be deleted the
moment it had proved its point.

## The report

`.mstack/progress/impl_<slug>.md`:

- **What changed**, in a paragraph.
- **Files**, the real list.
- **Commands**, fenced, with the **actual output pasted**. Not a summary of it.
- **R to test**: each requirement, the test that covers it, and the `file:line` where that test
  lives. On the direct path, map acceptance bullets instead.

Then `/mstack:verify` and record the verdict.

## When something breaks unexpectedly

Do not improvise a workaround. Record the blocker in `current.md`, `mstack state set <slug>
--status blocked`, and stop. A workaround invented at hour four of a session is the thing the
next person spends a day undoing.
