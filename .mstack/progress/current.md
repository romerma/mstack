# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 34 commit-message-standard
- **Status:** reviewing
- **Branch:** main
- **Base:** main
- **Worktree:** none

## Plan

Two halves, both landed:

1. Rewrite the 143 non-imperative commit subjects to Conventional Commits form,
   and repoint every SHA the store cites at the rewritten commits.
2. Ship `/mstack:commit` so future messages stay there, and point the router,
   the README, the wiki and CONTRIBUTING at it.

Open: a reviewer that did not write this has to judge it, and `origin/main` has
not been force-pushed yet. That push is the user's call and is the one step here
that cannot be undone.

## Log

History rewritten and verified, skill shipped and lint-clean, item at reviewing
with an implementer row at `a83b23dd`. If this session dies now, the next one
picks up at the review, and the pre-rewrite history is a mirror clone in the
session scratchpad, not in this repository.

## Verification

- `./bin/mstack lint-plugin .` PASSED, 0 failures, 0 warnings.
- `npm test` 286 tests, 286 pass, 0 fail, bun and node.
- `./bin/mstack gate` PASSED, 0 failures, 1 warning (on main).
- All 201 trees, authors and both timestamps byte-identical to the pre-rewrite
  mirror; 303 SHA citations translated, 0 ambiguous, 0 left behind.
