# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 47 ledger-check-hides-a-rejection
- **Status:** in_progress (bug-fix playbook, steps 1, 2 and 4 done)
- **Branch:** fix/ledger-check-hides-a-rejection
- **Base:** 5b2714c
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

Item 47. Reproduced on this store: `./bin/mstack ledger check benchmark-harness <full a4e6c784
sha>` prints `PASS test-verified at a4e6c784 by implementer`. Mechanism: `src/ledger.ts:151`
keeps the best row by rank. Design recorded (row of phase `design`): judge a sha by its latest
closing-role row. An implementer has the brief and writes the red test first; its report goes
to `impl_ledger-check-hides-a-rejection.md`. Then a fresh reviewer on a different model.

Seen on the way, not in this item: `ledger check <target> a4e6c784` with an abbreviated sha
answers "no verdict at a4e6c784" although rows exist at that commit.

After 47: 46, 50. Then phase 1 and item 69, which need the plugin really loaded.

## Item 47 implementation (2026-11-17)

Fix landed on fix/ledger-check-hides-a-rejection (bb21cf7 red, 4cd34e7 fix, docs dcbfe12, ebd8a6b). Report: `.mstack/progress/impl_ledger-check-hides-a-rejection.md`. Next: a reviewer pass that did not write the code; do not change status here.
