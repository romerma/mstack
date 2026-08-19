# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 5 decision-required-gate — Make decision_required a gate, not an announcement
- **Status:** in_progress (bug-fix playbook, direct path)
- **Branch:** main
- **Base:** main
- **Worktree:** none

## Plan

- The field is read in four files and enforced in none. `SessionStart` announces it, the router
  stops to ask, and the gate's only mention is inside a comment.
- Answering it has to be recorded against the item, not as a free-floating `decisions.tsv` row.
  The row is the evidence; the item needs to know the row exists.
- Refuse to advance past `in_progress` while the fork is open, and quote the question in the
  failure so the reader does not have to go looking for it.

## Log

- Panel closed: 4 reviewers, all CHANGES_REQUESTED, every finding reproduced and fixed (item 1).
- Gap review found four more, of which this is the same class as the `require_verdict_to_close`
  defect: a rule the README sells that no code sustains.
- `DECISION_REQUIRED_FROM` added to lifecycle.ts beside `SPEC_REQUIRED_FROM`, with `specifying`
  deliberately below the line: investigating the fork is work, and it is where the answer is found.
- `decision_resolved` on the item is a pointer to a `decisions.tsv` row, not a copy of the answer
  and not a boolean. A boolean would let someone mark a fork answered without saying what the
  answer was.
- `mstack decide --resolves <ref>` writes the row and the pointer in one step, so neither can
  exist alone. Refuses an item with no fork, and writes nothing when it refuses.
- Enforced in the gate (authority) and refused in `state set` (immediate feedback). `--force`
  still moves it and the gate then says so, which is the point of having both.
- Exercised live against the example's `export-json`: refused, answered, moved.

## Verification

- 148 tests green under bun and node. Six mutations injected, six caught: removing the gate check,
  accepting a dangling pointer, drawing the line at `specifying`, dropping the `state set` refusal,
  accepting `--resolves` on an item with no fork, and writing a pointer that names no row.
- Rung 4.

## Next step

Item 6, statusline argument hardening: `mstack statusline --subagents` exits 2 with stderr.
