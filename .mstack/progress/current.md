# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** none active (20 closed 2026-11-08; next 36 shared-runner-and-closing)
- **Status:** -
- **Branch:** main
- **Base:** -
- **Worktree:** none

## Plan

Program order (plan at `~/.claude/plans/perfecto-ahora-haz-el-dynamic-pie.md`):

1. Items 20, 36, 37.
2. Relaunch with `claude --plugin-dir .` and the marketplace mstack disabled. Then items 39–44.
3. Item 49 (bench hygiene) before 45.
4. Item 45: mstack-after rerun on both tiers, then release 0.3.0.

The benchmark baseline is 16/16 solved per arm on both tiers. mstack-before costs 4.7–6.2× plain
and takes 5–9× the wall time. mstack-after must keep 16/16 and cut that.

## Log

- Easy tier: `impl_benchmark-harness_baseline.md`.
- Hard tier: `impl_benchmark-hard-tier_baseline.md`.

- Item 20 closed 2026-11-08 (2 rounds; merged ff to main locally).

Headless runs: `run.mjs` builds a clean `env -i` env, uses the claude.ai login, and never
passes bypassPermissions. Do not run `check.mjs` or `verify.mjs` while a batch is running
(item 49).

## Verification

-
