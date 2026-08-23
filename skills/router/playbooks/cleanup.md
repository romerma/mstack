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
6. Items in `.mstack/state.json` whose work landed long ago and were never closed out. Closing
   one needs a ledger verdict, not a note: `mstack ledger record <slug> <the SHA the work landed
   on> <verdict> --evidence <path> --verifier <who ran it>`, then `mstack state set <ref>
   --status done`. The verdict may be at an older SHA — that is what closing an old item means —
   but it has to exist, and it has to come from a pass that did not write the code. If nobody
   can produce one, reopen the item honestly rather than closing it on a sentence.

   The verdict may be old; the **run** may not. `mstack state set <ref> --status done` also
   requires the item's verification to have been executed at today's HEAD, against today's
   working tree, so a dormant item needs one `mstack gate --full` before it closes. If the
   verification no longer runs at all — the harness is gone, the service is retired — that is
   `--force` with `--closed-by` saying so, which is stored in `state.json` where the next
   reader will find it. Do not edit the `verification` field to something trivial to get past
   the gate; that is the check-that-cannot-fail this whole mechanism exists to prevent.

**Reply:** what was removed, and what you deliberately left alone.
