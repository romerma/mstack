# Cleanup

Dead branches and dead worktrees. Cheap to create, and nobody ever gets round to removing them:
the harness this workflow was drawn from accumulated seventeen worktrees, twelve of them merged
and abandoned.

1. `mstack worktree list`. Each row is tagged `main`, `merged` or `dirty`.
2. `mstack worktree prune` with no flags. It lists candidates and removes nothing. A candidate
   is merged into the default branch *and* has no uncommitted work.
3. **Read the list.** Anything you do not recognise gets investigated, not deleted.
4. `mstack worktree prune --yes` once the list is right.
5. Branches merged but still present: `git branch --merged <default>`, then delete with `-d`.
   Never `-D`: the lowercase form refuses when work would be lost, and that refusal is the
   whole safety mechanism. A `PreToolUse` hook denies `-D` for this reason.
6. Items in `.mstack/state.json` whose work landed long ago and were never closed out: check
   whether each one is really done, then `mstack state set <ref> --status done --closed-by
   "..."` or reopen it honestly.

**Reply:** what was removed, and what you deliberately left alone.
