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
- Implementer session started. Context read: research doc, README, CHANGELOG, state files,
  router + playbooks + references, all eleven skills, five agents, hooks.json, src/lifecycle.ts
  TRANSITIONS, gate.ts, hooks.ts GUARDS, ledger/decisions/state/roles/mergegate/lint sources,
  bin/mstack, examples/notes-cli and its .mstack store.
- Demo repo driven end to end in the scratchpad: setup, gate green and red, both close
  refusals, the fork refusal and its decide --resolves answer, stale ledger check, fanout
  plan/check with a named dropout, worktree new/list/prune, statusline main and --subagent,
  merge-gate's no-remote stop. All output captured for the wiki.
- GitHub wiki mechanics verified against four docs.github.com pages; the dash-to-space title
  rendering is not stated there and is marked unverified in Publishing-the-Wiki.md.
- README rewritten (327 lines); one kept example corrected against the code: the status line
  prints 'verdict stale' with no count (src/statusline.ts:156-160, test-pinned). Decision row
  recorded.
- Eleven wiki files written under docs/wiki/. Both publish-route sd commands tested for real
  against a copy; the -F command scoped to two files so it cannot rewrite its own example.
- CHANGELOG Unreleased section added.
- Verify battery: link check 53/0 broken, npm test 169 pass, typecheck clean, lint-plugin
  PASSED, gate PASSED.

## Verification

- Rung 4 for every pasted command block (live runs in the scratch demo repo), the link check,
  the sd publish transformation, and the full battery: 169 tests, typecheck, lint-plugin,
  gate, all green. Prose lineage claims are rung 2 against docs/research/pstack-port.md and
  the cited sources. The dash-to-space wiki title rendering stopped at rung 1 and says so.

## Next step

If this session dies now: deliverables are written and verified, commits in progress in the
order readme -> wiki -> changelog -> bookkeeping, then the implementer ledger row at the
changelog commit's SHA. After that: review by a pass that did not write this, per the plan.
