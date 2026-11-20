# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 102 mutation-test-pins (item 100 is parked on two forks for the user)
- **Status:** in_progress, fixing the round 1 review (2 blocking: a test named for 900 s that holds 10 s; a test with no timeout option that fails under load on bun), then review round 2
- **Branch:** test/mutation-test-pins
- **Base:** 113e7842ade6b4482967fb12f7c42f25fb690bf2
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
- 2026-11-16 and 17: items 52 to 99 filed; 52, 53, 54, 47, 46, 70, 55, 56, 73, 74, 57, 58, 59, 67, 61, 62, 64, 39, 40, 41, 43, 82, 96, 95 and 49 closed; item 42 answered A on 2026-11-19 (in place, split: 42 the mechanism, 100 the closing check) and closed the same day after three review rounds, with 101, 102 and 103 filed; 104 (the one test CI failed on Linux after 42) closed the same day; 60 and 99 still wait on the user; see `history.md`. Item 60 needs the user's yes to open a real PR.
- Sessions launched as plain `claude` have no mstack plugin: no `mstack:*` agents, no hooks, no
  cost rows. On 2026-11-16 the user chose to continue anyway, with general-purpose agents
  briefed from `agents/*.md` (Sonnet implements, Opus reviews).
- Item 53 repro, 2026-11-16, throwaway store: 12 parallel `state add`, 12 exit 0, 8 items on
  disk. `saveState` is one `writeFileSync` (`src/state.ts:208-210`).

- 2026-11-20 item 101 round 2 implementer (scratch `.../scratchpad/impl101r2/`): blocking 1
  committed (f925e61, the gone CLI named in prose, one command offered; decision row 324); B2,
  NB1, NB2, NB5, NB6 committed (ea7cb01 to ab8bafc); 14 of 14 mutants killed; both suites green.
  Report `impl_mutation-printed-exits_r2.md`. Next: a review round 2 by a pass that did not
  write the code; NB4 goes to a follow-up item (row 323).

- 2026-11-20 item 44 implementer (scratch `.../scratchpad/impl44/`): design rows 327 to 330,
  implement row 331; the lens-panel closing check (4f7c074, aa02d17), the size matrix and the six
  files (e8699cc), the lint check (b135331), docs (a7f1b72); 18 of 18 mutants killed; both
  suites green. Report `impl_size-tiers.md`. Next: a review by a pass that did not write the code.

- 2026-11-20 item 105 implementer (scratch `.../scratchpad/impl105/`): design row for A2 (the
  lock's root must not name another store of the worktree), implement rows for the gate test's
  fixture, A3, A1's "can run" test and A4; commits 0b39697 to 9f39f15 (tests, three fixes, docs);
  both suites green here. Report `impl_mutation-exits-followups.md`. Next: a review by a pass that
  did not write the code.

- 2026-11-20 item 105 round 2 implementer (scratch `.../scratchpad/impl105r2/`), in progress:
  B1 reproduced at 410debf (L10c and L10e 0/7, base 7/7); the review's fix alone leaves a copy
  that holds the original (L13a, L13b) refused 0/7, so the root's git call also runs without git's
  local env vars. Commits 912f34f, f05d272, 1da388b, 15364a4 (code and tests), b5e7164 (docs);
  layouts 203/203 per runtime; mutants 8 of 10 killed, 2 equivalent. One legitimate layout stays
  refused, a checkout moved up into its parent's place (row 04:59:47Z, for the coordinator).
  Report `impl_mutation-exits-followups_r2.md`. Then the coordinator took L14 (row 05:23:35Z):
  rootDisagrees compares the store findStore gives from the root with the restore's own
  (69b974b, dd78e1c). L14a, L14c, L14d restore 7/7; L14e (moved up, a store at the repository's
  top) stays refused, 0/7, base 7/7: findStore cannot tell it from an edit, so the pass stopped,
  as its brief says (row "where the store comparison stops"). The coordinator took the narrower
  rule (row 05:43:49Z): refuse only when root is another store's own directory (d55c409, docs
  a290cf5). Every layout restores but L15a and L15b (a move that leaves the old root on another
  store's own directory), 0/7, base 7/7; edits caught 4 of 7, nothing lost in the 11 not caught.
  Report `impl_mutation-exits-followups_r2.md`, the whole round. Next: a review round 2 by a pass
  that did not write the code.

- 2026-11-20 item 102 implementer (scratch `.../scratchpad/impl102/`): every mutant rebuilt on
  the base first (`impl102/scripts/survey-base.sh`, driver `impl102/scripts/mutant.sh`); 11 got a
  test, C was already killed, D and Q no longer apply (rebuilt as D2 and Q2, killed by existing
  tests), none equivalent; commits d8dfedd to 031db3b (tests by criterion, three text fixes);
  rows 08:04:58Z; both suites green. Report `impl_mutation-test-pins.md`. Next: a review by a
  pass that did not write the code.
  Round 1 fixes (row 09:55:19Z): B1 pinned by reading the helper's argv with ps (d0ee162, row
  10:08:53Z), B2 SPAWN_TEST on exits:268 (8ec7227), the sweep, 141 more (5618171), NB1 in
  design.md (ccc5e81); 660 runs under load, 0 failed. Report updated in place. Next: review round 2.

Headless runs: `run.mjs` builds a clean `env -i` env, uses the claude.ai login, and never
passes bypassPermissions. Do not run `check.mjs` or `verify.mjs` while a batch is running
(item 49).

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
- Item 100 `mutation-closing-check` (asked 2026-11-19; spec at round 3, 28 requirements, in
  `.mstack/specs/mutation-closing-check/`; three spec reviews, the last with one blocking finding
  and a measured fix): (1) is the check on (A) or off (B) for a store with no
  `require_mutation_to_close` key; (2) keep the full receipt rule with a named class of gaps and a
  fourth review (X), or narrow acceptance 2 (Y). Both are worded on the item's `decision_required`.
  When answered: `state set 100 --status specifying`, then a fourth author from
  `spec_review_mutation-closing-check_r3.md`.
Record each answer with `mstack decide --resolves <slug>`.

Standing: push `main` after closing work and check CI (user, 2026-11-17).

Also for the user: ADR 0001 states their decision of 2026-10-31 and gives no reason, because the
record has none; the reason is theirs to add (item 58, round 2 review, non-blocking 10).

Next, not blocked:
0. Phase 3: 63 (its first criterion needs a live claude session, a paid run the user has not
   authorised) and 65 (to design after item 100: see its description). 44 closed 2026-11-20; its
   follow-up is 106, whose first point overlaps item 100's R26 to R28. Item 100 waits for the user
   and, being size l, needs a review round of two lens reports when it resumes. Follow-ups of 42:
   102, 103 (105 closed 2026-11-20).
1. Phase 2: 59 (in flight) diagnosis-loop-in-bug-fix, then 60, 61, 62, 64. Follow-up of 58: item 83.
2. Architecture candidates filed by the deepen playbook: 76 to 80, and 81.
3. Durability follow-ups: 67 first (its budget test made the closing gate of 58 red three runs
   of four under outside load), then 71, 66, 68, 69.

Lesson for briefs that make an agent file items: every assertion about the code goes in only
with the command that shows it, re-run after the edit (item 57 took four rounds over this).

Read an item with `./bin/mstack state show <ref>`. Live checks: a headless
`claude -p --plugin-dir .` run in a copy of `sandbox/bench/template`; the wrapper is in
`review_intake-step.md` under Probe C.
