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

## Verification

- Pending: battery after the edits, then the review pass re-fetches the doc itself.

## Next step

If this session dies now: item 10 is in_progress on fix/panel-followup-prose, no file edited
yet. The edits: the shared rules bullet in agents/{implementer,reviewer,orchestrator,
spec-author,spec-reviewer}.md, the delegation bullet in skills/router/SKILL.md:71, the
shape-check sentences in README.md:217 and docs/wiki/Gates-and-Hooks.md:95 and
docs/wiki/The-Story.md:68-70, the four reflow lines, one CHANGELOG Unreleased bullet.
