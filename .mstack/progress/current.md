# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 10 panel-followup-prose — The prose the panel flagged but item 9 could not touch
- **Status:** in_progress (bug-fix playbook, direct path)
- **Branch:** fix/panel-followup-prose
- **Base:** main
- **Worktree:** none

## Plan

Bug-fix playbook, steps verbatim, with dispositions:

1. Reproduce it yourself — done: sub-agents docs re-fetched this session ("the subagent does
   that work in its own context and returns only the summary"; "Claude Code scans each
   subagent's final report before Claude reads it"), so the reply-body phrasing is wrong on
   the mechanism; rg places it in the five agent contracts and the router. The three-page
   split on the shape-check defect reproduced by rg.
2. Binary-search the cause — n/a: the mechanism is prose written before the docs were checked,
   inherited from the harness's own phrasing; the research doc records the same wording.
3. Failing test first — skip: no test surface exists for prose claims; the linter checks
   links and shapes, not facts. The review pass is the test.
4. Design — skip: single-site wording fix, one formulation applied everywhere.
5. Delegate the fix — skip: eight prose lines across seven files; review separation is
   preserved by delegating the review of the diff to a pass that did not write it.
6. Verify on the same surface — the re-fetched docs, the rg sweeps, and the full battery.
7. Repro-before-fix commit staging — n/a: no failing test to stage.
8. Review (independent pass on the diff), then ship: merge-gate skip: no remote exists
   before publication; local fast-forward to main.

## Log

- Item 10 opened with five acceptance bullets quoting the follow-up record.
- Sub-agents doc verified at rung 4 before touching any file.
- Edits applied: the shared bullet in the five agent contracts (sd, verified 5/5), the router
  delegation bullet, the three shape-check sentences unified with the decision row recording
  why the shipped half stands, the four flagged rewraps, one CHANGELOG bullet.
- The opening sweep missed src/: the same reply-body claim lived in a src/hooks.ts comment.
  Fixed, comment-only. sd silently no-opped on that multi-line comment (its known failure
  mode); the Edit tool applied it. My own The-Story rewrap merged a line twice before it
  stayed under the convention; both caught by the awk sweep.
- Committed as c5de4fb. Battery green: 169 tests, typecheck, lint-plugin, 54 links, gate.
- Item at reviewing; facts reviewer launched on the allocated fanout path, told to re-fetch
  the sub-agents doc itself and to confirm the src/hooks.ts hunk is comment-only.

## Verification

- Rung 4 for the mechanism (sub-agents doc fetched this session) and the battery; the review
  pass re-derives both independently.

## Next step

If this session dies now: reviewer is running against review_panel-followup-prose_facts.md.
fanout check, act on the report, closing verdict from the reviewer, verifying -> done,
history.md append, current.md reset, fast-forward fix/panel-followup-prose into main.
Ship note: merge-gate skip: no remote exists before publication; local fast-forward instead.
