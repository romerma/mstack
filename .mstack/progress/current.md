# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 9 readme-and-wiki — README and wiki that teach mstack to a stranger
- **Status:** in_progress (feature playbook, direct path)
- **Branch:** docs/readme-and-wiki
- **Base:** main
- **Worktree:** none

## Plan

Feature playbook, steps verbatim, with dispositions:

1. `/mstack:understand` over the subsystems this touches — done in-session: the research doc,
   the README, the CHANGELOG, `.mstack/` state, ledger and decisions, the router and its
   playbooks, the phase skills, the agent contracts, `src/lint.ts` scope.
2. `/mstack:design` — done: criteria fixed first (cold-start on-ramp, fact-check bar held,
   wiki reviewable pre-publication, credit visible on the first screen, one home per topic).
   Two structurally distinct candidates; decision row records the pick and the rejects.
3. Throughput checkpoint, four items:
   - Blocking first steps: the design outline and the item's acceptance array; both landed.
   - Independent workstreams: n/a — README and wiki cross-link and share one voice; that is
     the invariant, so one writer, serialized.
   - Shared mutable state: n/a — one branch, one writer per file, no parallel writes.
   - Smallest safe decomposition: one implementer for all pages, because every page links the
     others and a fan-out of page-writers would fracture voice and cross-links.
4. Delegate implementation — implementer subagent, brief with goal/scope/context/acceptance/
   verify/forbidden/report; report to `progress/impl_readme-and-wiki.md`.
5. `/mstack:verify` — gate --full plus a link check over README.md and docs/wiki (the linter
   scopes to skills/ and agents/, so docs/ needs its own).
6. Small ordered commits: open item · readme · wiki · changelog · review fixes · close.
7. `/mstack:review` — two-lens panel via fanout (facts on one model, cold reader on another),
   then `/mstack:ship` — merge-gate `skip: no remote exists before publication; PR impossible`,
   local fast-forward to main instead.

## Log

- Found `current.md` still describing item 5 as in_progress while state.json has items 1–8
  closed; previous sessions closed without appending to history.md. Reset here; recorded in
  the close-out entry.
- Item 9 added with the five-bullet acceptance contract; design decision recorded in
  decisions.tsv (docs/wiki as the wiki's in-repo source).

## Verification

- Pending: npm test, typecheck, lint-plugin, link check, all after implementation.

## Next step

If this session dies now: item 9 is in_progress on branch docs/readme-and-wiki, design is
recorded, implementation not yet launched. Launch the implementer against the acceptance
array, then verify, review, close.
