# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 52 withlock-enters-without-the-lock
- **Status:** reviewing, round 3
- **Branch:** fix/withlock-enters-without-the-lock
- **Base:** d34761e
- **Worktree:** none

## Plan

Improvement program, chosen as orchestrate on 2026-11-16 (decision row of that date; report at
`reports/Mejoras mstack con skills Pocock.md`, raw notes in `docs/research/notes-2026-11-16/`,
gitignored):

0. Durability: 52 (pilot), 53, 54, then 47, 46, 50.
1. Front end: 55 intake-step (its fork is answered), 56 test-first-reference.
2. Design and domain: 57, 58, 59, 60, 61, 62, 64.
3. Enforcement and cost: 39 to 44, then 63 (needs 44) and 65 (with 41 and 42).
4. Measurement: 49, then 45 (mstack-after rerun on both tiers, release 0.3.0).

The benchmark baseline is 16/16 solved per arm on both tiers. mstack-before costs 4.7–6.2× plain
and takes 5–9× the wall time. mstack-after must keep 16/16 and cut that. The second number to
watch is review rounds per item: if they do not drop after phase 1, intake is ceremony.

## Log

- Easy tier: `impl_benchmark-harness_baseline.md`.
- Hard tier: `impl_benchmark-hard-tier_baseline.md`.
- 2026-11-16: this session was launched as plain `claude`. No mstack plugin was loaded: no
  `mstack:*` agents, no hooks, no cost rows. Only main-session steps were done.
- 2026-11-16: items 52 to 65 seeded; fork on item 55 resolved from the user's reply.
- Item 52, step 1 (repro, three node processes on one file): A holds 48 to 3549 ms; B waits
  2 s, removes A's lock and enters at 2280 ms without one; C acquires a fresh lock at 2802 ms
  while A is still inside.
- Item 52, step 2 (mechanism): `src/tsv.ts:109-116` removes the lock on timeout and breaks out
  of the loop without creating one; the `finally` at `:129-135` removes whatever lock file
  exists. Callers: `src/decisions.ts:53`, `src/costs.ts:283,419,742,752`.
- Item 52, step 3 (failing tests): two tests in `tests/tsv.test.ts` with real concurrent
  processes through `tests/lock-holder.ts`. Both fail on unmodified code, on node and on bun.
- Item 53 repro, same day, throwaway store: 12 parallel `state add`, 12 exit 0, 8 items on disk.

Headless runs: `run.mjs` builds a clean `env -i` env, uses the claude.ai login, and never
passes bypassPermissions. Do not run `check.mjs` or `verify.mjs` while a batch is running
(item 49).

## Next step

Round 3 implementation is in: `impl_withlock-enters-without-the-lock_r3.md`, code head
`9499621`. `tryCreate` reads the lock back by token, an `options.step` seam drives deterministic
tests, the statistical race test and `tests/lock-racer.ts` are gone. Round 3 review is out to a
fresh reviewer, which writes `review_withlock-enters-without-the-lock_r3.md` and types its own
ledger row.

- APPROVED: `./bin/mstack gate --full`, `state set 52 --status verifying`, then `done`, merge
  the branch to main fast-forward, and start item 53.
- CHANGES_REQUESTED: a fourth round needs a `review-r4` decision row, and first the question of
  whether the seam is wrong rather than the patch (principle: redesign from first principles).

Follow-ups to file when the item closes: ignore or sweep `*.lock` and `*.lock.break` in the
store; under load `tests/costs.test.ts:698` and `tests/run.test.ts:54` fail on node and bun
(compare with item 21); `withLock` measures its wait on the wall clock; the timeout message
names the dead lock owner when the guard is what blocks; move `UserError` out of `src/paths.ts`
with item 53.
