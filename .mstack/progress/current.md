# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 54 hook-errors-leave-no-trace
- **Status:** in_progress, round 2 after CHANGES_REQUESTED
- **Branch:** fix/hook-errors-leave-no-trace
- **Base:** 8dac2fd
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
- 2026-11-16: items 52 to 68 filed. Item 52 closed in 3 rounds and item 53 in 2; see `history.md`.
- Sessions launched as plain `claude` have no mstack plugin: no `mstack:*` agents, no hooks, no
  cost rows. On 2026-11-16 the user chose to continue anyway, with general-purpose agents
  briefed from `agents/*.md` (Sonnet implements, Opus reviews).
- Item 53 repro, 2026-11-16, throwaway store: 12 parallel `state add`, 12 exit 0, 8 items on
  disk. `saveState` is one `writeFileSync` (`src/state.ts:208-210`).

Headless runs: `run.mjs` builds a clean `env -i` env, uses the claude.ai login, and never
passes bypassPermissions. Do not run `check.mjs` or `verify.mjs` while a batch is running
(item 49).

## Next step

Item 54, round 2 implementation done (`impl_hook-errors-leave-no-trace_r2.md`, head of code
`9b36340`): subagent-stop now logs an unreadable `state.json`, the fault branch of
`tolerateAbsence` is pinned, the exclude edit needs a directory store and follows the append,
and O5/O6/O6b/H8c have tests. Survivors G1 and H8c-literal are equivalent by layering (see
report). Next: `state set 54 --status reviewing`, then a fresh reviewer writes
`review_hook-errors-leave-no-trace_r2.md`.

Follow-ups to file when the item closes: the lint refuses a foreign hook whose args start with
"hook"; a `hooks.json` containing `null` crashes the lint (base too); `tests/run.test.ts:239`
is load-sensitive, add it to item 67; a gate warning for a store whose log is not ignored;
`session-start` on an unreadable `state.json` still prints "No active work item"; recording in
a real `claude --plugin-dir .` session is unproven.

After 54: 47, 46, 50. Then phase 1.
