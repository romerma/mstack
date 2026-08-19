# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 9 readme-and-wiki — README and wiki that teach mstack to a stranger
- **Status:** reviewing (feature playbook, direct path)
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
- Review round: both lenses CHANGES_REQUESTED (reader 6 findings, facts 19). Fix round
  started per the orchestrator's triage. Plan: rebuild the scratch demo store so ids mirror
  examples/notes-cli (greet-flag 1, cli-search 2 filler, export-json 3 sdd + exact fork),
  replay the whole walkthrough from scratch and re-capture every pasted block; then the F1-F19
  page fixes, scripts/check-doc-links.mjs, item 9 verification field amendment, and the one
  attribution word in src/ledger.ts:12 (orchestrate -> shipping, a panel finding).
- Fix round applied in full. Demo replayed from scratch in one coherent run (new shas
  4b63888b/ccb9e2e/542ac0c, fork item export-json id 3 with the exact fixture text); all six
  reader findings and all nineteen facts findings addressed; scripts/check-doc-links.mjs
  shipped and item 9's verification field now executes as recorded (exit 0, run whole);
  corrected publish route re-run on a fresh copy, diff shows link targets only and
  Publishing-the-Wiki.md untouched. Battery: 169 tests, typecheck, lint-plugin PASSED,
  54 links 0 broken, gate PASSED. Two decision rows added. No ledger row this round and item
  status untouched, per the orchestrator.

## Verification

- Rung 4 for every pasted command block (live runs in the scratch demo repo), the link check,
  the sd publish transformation, and the full battery: 169 tests, typecheck, lint-plugin,
  gate, all green. Prose lineage claims are rung 2 against docs/research/pstack-port.md and
  the cited sources. The dash-to-space wiki title rendering stopped at rung 1 and says so.

- Parent diff review done: README and all eleven wiki pages read in full; every cited
  file:line range opened and confirmed (lifecycle 10-20/25-31/49-55/63-73, hooks GUARDS
  205-243, roles 14-19/64/101-106, statusline 146-163, ledger 17-23, gate SPEC_ARTIFACTS,
  the orchestrate twelve-unit quote in both files).
- Verify battery re-run by the parent, not inherited: 169 tests, typecheck, lint-plugin,
  gate, 53 links — all green.
- Item moved to reviewing. Panel launched with fanout-allocated paths: facts lens on opus,
  cold-reader lens on sonnet, both forbidden to edit.
- Reader lens returned CHANGES_REQUESTED with six findings, each reproduced twice: the
  export-csv/export-json split identity across three pages (self-contradicting within
  How-A-Work-Item-Flows.md), a missing `git add -A` that Getting-Started's staleness payoff
  depends on, a gate --full transcript captured with -q while the docs configure -v, a
  commit-first instruction whose pasted gate output is the uncommitted state, a jargon-dense
  README opening, and item 9's own verification string not being executable as recorded.
  Everything else held, including both sd publish commands and all link resolution re-checked
  by hand.

## Next step

If this session dies now: both panel reports are in and the fix round is applied and verified,
awaiting the single commit 'fix: what the docs review panel found' (docs +
scripts/check-doc-links.mjs + the src/ledger.ts comment word + bookkeeping). After that:
re-review of the fixes by a pass that did not write them, record the closing verdict from that
pass, then verifying -> done, history.md append, current.md reset, fast-forward
docs/readme-and-wiki into main. Ship note: merge-gate skip: no remote exists before
publication, a PR is impossible; local fast-forward instead.
