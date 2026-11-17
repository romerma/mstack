# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 46 npm-test-misses-strip-types
- **Status:** in_progress (bug-fix playbook, steps 1 and 2 done; step 4 skip: single-site fix)
- **Branch:** fix/npm-test-misses-strip-types
- **Base:** a9f1d1d
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

Item 46. Reproduced with node 22.6.0 from nvm first on PATH: `node --test 'tests/*.test.ts'`
fails every file with ERR_UNKNOWN_FILE_EXTENSION; with `--disable-warning=ExperimentalWarning
--experimental-strip-types` the full suite is 477 of 477 on 22.6.0, including the tests added
in items 52, 53, 54 and 47. Mechanism: `package.json:8-10` omits the flag that
`.github/workflows/ci.yml:56` passes, and `bun test tests/` treats the path as a filter and
runs the gitignored `sandbox/` too. An implementer has the brief; its report goes to
`impl_npm-test-misses-strip-types.md`. Then a fresh reviewer on a different model.

After 46: item 50 needs the user's answer on the icon (its own acceptance says so). Item 70
(the gate closes over a standing rejection) is the most serious follow-up. Then phase 1 and
item 69, which need the plugin really loaded.
