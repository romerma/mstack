# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 96 walkthroughs-after-closing-checks
- **Status:** in_progress (round 2: the run does what the page says; the reviewer approves on a green gate)
- **Branch:** docs/walkthroughs-run-as-written
- **Base:** c6e35e9
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
- 2026-11-16 and 17: items 52 to 96 filed; 52, 53, 54, 47, 46, 70, 55, 56, 73, 74, 57, 58, 59, 67, 61, 62, 64, 39, 40, 41, 43 and 82 closed; item 96 (the Getting-Started walkthrough no longer runs as written) goes next; see `history.md`. Item 60 needs the user's yes to open a real PR.
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

## Next step

Phases 0 and 1 are closed, except item 50 (waits for the user). Phase 2 has 57 and 58 closed.

Waiting on the user, each asked on 2026-11-17 with a recommendation of yes:
- Item 72 `unattended-run-forks`: does an unattended run take a fork's recommended answer as a
  provisional ruling and list them at the end, instead of stopping at the fork round?
- Item 75 `spec-path-for-answered-forks`: does an item whose forks are all answered take the
  direct path, unless it is sdd, crosses several subsystems, or the user steps away?
- Item 50 (`plugin validate --strict`): the icon is the user's call per its own acceptance.
- Item 42 `mutation-check`: how the check touches the user's tree (in place and split in two, a copy of
  the tree, or not at all); its spec and two spec reviews are in `.mstack/specs/mutation-check/` and
  `.mstack/progress/spec_review_mutation-check*.md`. Recommended: the copy of the tree.
- Item 60 `ship-pr-body`: may a real PR be opened on GitHub for its third criterion?
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
