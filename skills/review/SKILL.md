---
name: review
description: Judge work that already exists against its requirements, its tests and the real diff, using reviewers that did not write the code. Use to review a branch, a PR, or a diff, or when asked whether a change is ready.
argument-hint: [base ref or PR]
---

# Review

The reviewer did not write the code. If that is not true, stop: fetch someone who did not.

1. Establish scope. `git diff <base>...HEAD`, and the list of files it touches.
2. Allocate the paths **before** launching anything:

   ```bash
   mstack fanout plan --kind review --worker correctness --worker security --worker tests
   ```

   Give each reviewer the path it prints, and nothing else. Two reviewers handed one filename
   overwrite each other silently, which is the failure this command exists to prevent.
   Worker names starting `r<digit>` (`r2`, `r2-facts`, `r2x`) are reserved, and `plan` refuses
   them: `r2` would be read as round 2 of a lone reviewer, and `r2-facts` as round 2 with lens
   `facts`, sharing a path with `plan --round 2 --worker facts`.
   A lone reviewer's path comes from the tool as well: `mstack fanout plan --kind review --solo`
   gives one more than the highest round of any review report of the item, a panel's included,
   so the review after a round-1 panel is round 2. From round 3 it needs `--justify "<why>"`,
   which also writes the `review-r<N>` decision row the gate asks for. Pass the path it prints
   to the lone reviewer in the brief.
3. Launch them in parallel, each with the full diff and a distinct lens. Give different lenses to
   different **models** where you can: models differ in blind spots, and agreement across models
   is signal in a way agreement across two runs of one model is not. `reviewer` runs on Opus
   and `implementer` on Sonnet, so the panel differs from the code's author by default, but
   two `reviewer` passes are one model: launch one of them on another to get a second.
   - correctness and requirement coverage
   - security and failure paths
   - the tests themselves: would any of them fail if the change were reverted?
   - `design`, only when the diff adds or changes a module's interface or moves a seam: the
     reviewer reads the deep-module vocabulary and judges the diff with its tests
   Skip a lens that has nothing to review, and note that you skipped it.
4. When they return, `mstack fanout check --kind review --worker ...` with the same workers as
   the plan, minus any lens you skipped. It names the ones that did not write a report. A reply
   is not evidence; act on the file or re-run the worker.
5. `mstack:reviewer` runs the verification itself. The implementer's pasted output is not a
   substitute; the whole value of a second pass is that it does not inherit the first pass's
   assumptions.
6. Quote each acceptance bullet and answer it **individually** with evidence. An aggregate
   "all criteria met" is not a review.
7. `mstack ledger check <slug>` at the current head SHA. A verdict against an older SHA does
   not carry over.
8. Synthesize into one verdict: `APPROVED` or `CHANGES_REQUESTED`, then the findings ordered by
   severity, each with a `file:line`. A finding without a location is a feeling.
9. One ledger row per review round, typed by the pass that formed the verdict it carries:
   - A lone `mstack:reviewer` records its own row (`--verifier reviewer`) before returning.
     Confirm the row exists with `mstack ledger check <slug>`. If no row exists, the
     reviewer did not finish its contract: re-run the reviewer, and do not type the row on
     its behalf.
   - After a panel, the lenses have recorded nothing, so record the synthesized verdict
     yourself: `mstack ledger record <slug> "$(git rev-parse HEAD)" <verdict> --evidence
     <the lens reports> --verifier <your own role, never reviewer>`. One row, not one per
     lens: `ledger check` reads the latest closing-role row per `(target, sha)`, so a row
     per lens would leave whichever lens recorded last as the verdict, and a split panel
     means its worst lens.

   Either way the mapping is fixed: `APPROVED` records the rung the verification reached,
   `CHANGES_REQUESTED` records `verifier-failed`, and a verification nobody could run
   records `verifier-blocked`. A `verifier-failed` row is the typed record of the rejection,
   carrying the report as its evidence, and it stands until a later independent approval at
   that commit: `state set --status done` refuses it (`--force` included), the gate fails,
   and a later `verifier-blocked` does not lift it.

**Reply:** the verdict, and the findings that changed the outcome.
