# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 42 mutation-check (the mechanism; item 100 is the closing check)
- **Status:** in_progress, fixing the round 1 review (B1, B2), then stages 3 and 4, then review round 2
- **Branch:** feat/mutation-check
- **Base:** a9b2a56b62c3f9a5640a27f9df7931d064bb56d4
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
- 2026-11-16 and 17: items 52 to 99 filed; 52, 53, 54, 47, 46, 70, 55, 56, 73, 74, 57, 58, 59, 67, 61, 62, 64, 39, 40, 41, 43, 82, 96, 95 and 49 closed; item 42 answered A on 2026-11-19 (in place, split: 42 the mechanism, 100 the closing check); 60 and 99 still wait on the user; see `history.md`. Item 60 needs the user's yes to open a real PR.
- Sessions launched as plain `claude` have no mstack plugin: no `mstack:*` agents, no hooks, no
  cost rows. On 2026-11-16 the user chose to continue anyway, with general-purpose agents
  briefed from `agents/*.md` (Sonnet implements, Opus reviews).
- Item 53 repro, 2026-11-16, throwaway store: 12 parallel `state add`, 12 exit 0, 8 items on
  disk. `saveState` is one `writeFileSync` (`src/state.ts:208-210`).

Headless runs: `run.mjs` builds a clean `env -i` env, uses the claude.ai login, and never
passes bypassPermissions. Do not run `check.mjs` or `verify.mjs` while a batch is running
(item 49).

## Item 67 in flight (implementer, 2026-11-18)

- Implemented and reported: `.mstack/progress/impl_load-sensitive-tests.md` (final tree `fd1e3fd`). Next is
  the review pass by someone who did not write it. Read the report's mutant table first (C6 is the one
  loosening: a no-CPU wait on the gate branch passes the Stop test now).
- Harness committed at `scripts/load/` (decision row; `sandbox/` is ignored and a nested repo).
- Scratch evidence: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl67/`.
- Item 21 is not changed; the report has a recommendation for it.

## Item 40 round 2 in flight (implementer, 2026-11-18)

- Brief: four changes (measure from the fork point; scope to the store root; a numstat line that does
  not parse fails; small things). Review: `.mstack/progress/review_item-fields-base-size.md`.
- Scratch: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl40r2/`
  (`repro.sh <name>` is the review's rebase repro; `repro-before.txt` is its red at `61e6b7a`).
- Implemented and reported: `.mstack/progress/impl_item-fields-base-size_r2.md` (code at `9853fd9`).
  Next is the round 2 review by someone who did not write it. Read decision 4 there first (a base
  inside the branch, then main merged in, still counts main's commits) and decision 1 (the local
  default branch and `origin/` together, against the brief's "prefer the local branch").

## Item 42 stage 1 in flight (implementer, 2026-11-19)

- Part A committed at `75d4b88`: N1 to N17 of `spec_review_mutation-check_r3.md` in the spec
  (28 requirements, 157 tests named). Part B, task group 1: `c0506e6` (1.1), `eec2ffa` (1.2),
  `01a816c` (1.3); 26 mutants killed. Report: `.mstack/progress/impl_mutation-check.md`.
- Scratch: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl42s1/`.
- Next: stage 2 (task group 2) by a fresh implementer; read the report's last section first.

## Item 42 stage 2 in flight (implementer, 2026-11-19)

- Task group 2 (2.1 to 2.4), one commit per task, then `chore: report item 42 stage 2` with
  `.mstack/progress/impl_mutation-check_r2.md`.
- Scratch: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl42s2/`
  (`prim/` the runtime probes; `prim/etime.out` is why liveness bounds the start by etime+1).
- Done: 2.1 `5e16b0a`, 2.2 `61e3124`, 2.3 `f178632`, 2.4 `808b616`, fixes `35c34dd` `deb5733`
  `ca77520`; 984 pass on bun and node; 26 of 28 mutants killed. Report:
  `.mstack/progress/impl_mutation-check_r2.md`.
- Next: the review of the primitives by a pass that did not write them (plan row 264); read the
  report's "What I could not make safe" (the sweep of a stopped run's staging) first.

## Item 42 round 1 fixes in flight (implementer, 2026-11-19)

- Brief: B1, B2 and non-blocking 1 to 12 of `review_mutation-check.md`, by decision row 275.
  One commit per finding or group, tests at the ends of their files, then
  `chore: report the item 42 round 1 fixes` with `.mstack/progress/impl_mutation-check_r3.md`.
- Scratch: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl42r3/`
  (`pristine/` is HEAD at 1b38994; `out/*.before.*.out` are the reviewer's attacks rerun there:
  every one reproduces).
- Done: B1 `7aa8142`, B2 `2793e1f`, NB1 tests `8457f2a`, NB2 tests `d1f319c` (the reviewer's 11
  mutants killed, `out/mutants-review.txt`). Red outputs in `red/`. NB3 `e88bf55` (+ `436c551`
  escapes), NB4 `fa25ca5`, NB5 `065d049`, NB6 `5be2084`, NB7 `8e73e01`.
- One uncaptured bun fail in tests/mutation-restore.test.ts right after NB6; 5 reruns clean.
  NB8 `e837c01`, NB9 `f197bab`, NB10 `5b293cf`, NB11+12 `3204a2a`: every code fix is in.
- Found, not in the review: bun 1.3.11 ignores node:test's `skip` option (probe-skip/), so the
  four CASE tests would run under bun on CI's case-sensitive ubuntu disk. Reported, not changed.
- Mutants: 21 of 21 of the fixes killed, the reviewer's 11 killed again at `3204a2a`
  (`out/mutants-*.txt`). Attacks rerun: `out/*.after.*.out`. 8 decision rows recorded.
- Report: `.mstack/progress/impl_mutation-check_r3.md`. Next: round 2 is not next. By row 275,
  stages 3 and 4 follow, then round 2 reviews the fixes and the whole. Read the report's last
  section first, and its note on bun ignoring `skip` (the four CASE tests on CI).

## Item 42 stage 3 done (implementer, 2026-11-19)

- Tasks 4.1 and 4.2 are in (`f59db81`, `1c95c3a`), Part B (`f01b82f`, the four case tests chosen by
  definition), `design.md` corrected (`11b10d6`). Report: `.mstack/progress/impl_mutation-check_r4.md`.
  Part C: 60 bun and 60 node runs of tests/mutation-restore.test.ts, no failure.
- Next: stage 4 (group 3, the run and the `verify` command), then task 5.x and review round 2.
  Read the report's last section first: `restoreCommand` is the one function for R25's messages.

## Next step

Phases 0 and 1 are closed, except item 50 (waits for the user). Phase 2 has 57 and 58 closed.

Waiting on the user, each asked on 2026-11-17 with a recommendation of yes:
- Item 72 `unattended-run-forks`: does an unattended run take a fork's recommended answer as a
  provisional ruling and list them at the end, instead of stopping at the fork round?
- Item 75 `spec-path-for-answered-forks`: does an item whose forks are all answered take the
  direct path, unless it is sdd, crosses several subsystems, or the user steps away?
- Item 50 (`plugin validate --strict`): the icon is the user's call per its own acceptance.
- Item 60 `ship-pr-body`: may a real PR be opened on GitHub for its third criterion?
- Item 99 `bench-trace-and-durability`: where the benchmark harness and its baseline live; today
  `sandbox/bench/` is under no version control.
Record each answer with `mstack decide --resolves <slug>`.

Standing: push `main` after closing work and check CI (user, 2026-11-17).

Also for the user: ADR 0001 states their decision of 2026-10-31 and gives no reason, because the
record has none; the reason is theirs to add (item 58, round 2 review, non-blocking 10).

Next, not blocked:
1. Phase 2: 59 (in flight) diagnosis-loop-in-bug-fix, then 60, 61, 62, 64. Follow-up of 58: item 83.
2. Architecture candidates filed by the deepen playbook: 76 to 80, and 81.
3. Durability follow-ups: 67 first (its budget test made the closing gate of 58 red three runs
   of four under outside load), then 71, 66, 68, 69.

Lesson for briefs that make an agent file items: every assertion about the code goes in only
with the command that shows it, re-run after the edit (item 57 took four rounds over this).

Read an item with `./bin/mstack state show <ref>`. Live checks: a headless
`claude -p --plugin-dir .` run in a copy of `sandbox/bench/template`; the wrapper is in
`review_intake-step.md` under Probe C.
