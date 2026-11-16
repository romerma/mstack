# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 53 state-json-loses-concurrent-writes
- **Status:** in_progress, round 2 after CHANGES_REQUESTED
- **Branch:** fix/state-json-loses-concurrent-writes
- **Base:** dce98cb
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
- 2026-11-16: items 52 to 67 filed. Item 52 closed in 3 rounds; see `history.md`.
- Sessions launched as plain `claude` have no mstack plugin: no `mstack:*` agents, no hooks, no
  cost rows. On 2026-11-16 the user chose to continue anyway, with general-purpose agents
  briefed from `agents/*.md` (Sonnet implements, Opus reviews).
- Item 53 repro, 2026-11-16, throwaway store: 12 parallel `state add`, 12 exit 0, 8 items on
  disk. `saveState` is one `writeFileSync` (`src/state.ts:208-210`).

Headless runs: `run.mjs` builds a clean `env -i` env, uses the claude.ai login, and never
passes bypassPermissions. Do not run `check.mjs` or `verify.mjs` while a batch is running
(item 49).

## Next step

Item 53, round 1 review: CHANGES_REQUESTED, `review_state-json-loses-concurrent-writes.md`,
ledger row `verifier-failed` at ee2ad50. One blocker: `src/state.ts:274` writes once with
`writeSync` and ignores the byte count, so a short write is renamed over `state.json` and the
command exits 0 (`ulimit -f 2` with the real CLI leaves 1024 bytes of invalid JSON). Acceptance
1, 3 and 4 are met; 2 is met for the kill case.

A fresh implementer has the blocker and two cheap notes. When it returns: `state set 53 --status
reviewing`, then a fresh reviewer writes `review_state-json-loses-concurrent-writes_r2.md`.

Follow-ups to file when the item closes (from the round 1 review's non-blocking list): the
`decide --resolves` message when the row is recorded and the pointer is not; a leftover temp
file whose pid recurs fails one write; a symlinked `state.json` is replaced by a regular file
and file mode is not kept; `--status done` does git work under the lock; the known-key lists
are kept in step with `parseItem` by hand; surviving mutants M7b, M8, M16.

After 53: 54, 47, 46, 50.

- 2026-11-16 round 2: blocker (short write at state.ts:274) reproduced and fixed with writeFileSync; red test 1df7891, fix acf1e8a, dead line 448fc54, finally-kill 4b533c8. Next: reviewer round 2.
