---
name: review
description: Judge work that already exists against its requirements, its tests and the real diff, using reviewers that did not write the code. Use to review a branch, a PR, or a diff, or when asked whether a change is ready.
argument-hint: [base ref or PR]
---

# Review

The reviewer did not write the code. If that is not true, stop: fetch someone who did not.

1. Establish scope. `git diff <base>...HEAD`, and the list of files it touches.
2. Launch reviewers in parallel, each with the full diff and a distinct lens. Give different
   lenses to different **models** where you can: models differ in blind spots, and agreement
   across models is signal in a way agreement across two runs of one model is not.
   - correctness and requirement coverage
   - security and failure paths
   - the tests themselves: would any of them fail if the change were reverted?
   Skip a lens that has nothing to review, and note that you skipped it.
3. `mstack:reviewer` runs the verification itself. The implementer's pasted output is not a
   substitute; the whole value of a second pass is that it does not inherit the first pass's
   assumptions.
4. Quote each acceptance bullet and answer it **individually** with evidence. An aggregate
   "all criteria met" is not a review.
5. `mstack ledger check <slug>` at the current head SHA. A verdict against an older SHA does
   not carry over.
6. Synthesize into one verdict: `APPROVED` or `CHANGES_REQUESTED`, then the findings ordered by
   severity, each with a `file:line`. A finding without a location is a feeling.

**Reply:** the verdict, and the findings that changed the outcome.
