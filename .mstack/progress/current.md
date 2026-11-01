# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 48 benchmark-hard-tier (next, not started)
- **Status:** pending
- **Branch:** main (deliverables live in sandbox/bench, gitignored, never pushed)
- **Base:** none yet
- **Worktree:** none

## Plan

1. Hard-tier template in sandbox/bench (about 2k or more lines). Symptom-style issues, hidden
   tests that cover both the reported behaviour and documented regressions, and at least one
   trap.
2. Calibrate with plain until it fails some tasks over 2 or more reps.
3. Run the hard-tier baseline for plain and mstack-before, with the reps recorded by
   mstack decide.

Then items 20, 36, 37, 39-44. Before item 39, relaunch with `claude --plugin-dir .`.
Item 45 reruns mstack-after on both tiers.

## Log

- Item 38 closed 2026-11-01. Easy-tier baseline: plain 12/12 at $0.24 and 46 s per run;
  mstack-before 12/12 at $1.49 and 403 s.
  - Full write-up: `impl_benchmark-harness_baseline.md`.

Headless runs: `env -i` clean env built by run.mjs, claude.ai login, never bypassPermissions.
Program plan: ~/.claude/plans/perfecto-ahora-haz-el-dynamic-pie.md.

## Verification

None yet for item 48.
