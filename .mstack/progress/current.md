# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 23 docs-for-newcomers
- **Status:** in_progress
- **Branch:** docs/docs-for-newcomers
- **Base:** main
- **Worktree:** none

## Plan

User request: the docs are accurate but not friendly. Make them easier to read and explain
the cast - agents, skills, playbooks, gates.

- The gap measured, not assumed: no wiki page documents the 5 agents, 12 skills or 7
  playbooks as topics; zero mermaid diagrams anywhere; every page opens at mechanism level.
- Decided and recorded: additive, not a rewrite (item 9's panel verified the existing
  transcripts, and the problem is structure); two new pages, The-Agents.md and
  Skills-and-Playbooks.md, matching existing page granularity.
- One implementer for voice coherence, then a two-lens review panel: reader (a stranger) and
  facts (every claim re-run), on a different model.

## Log

- Item 23 filed with five acceptance bullets; branch docs/docs-for-newcomers.
- Implementer session started at 4ca05862. Byte copies of README.md and docs/wiki/*.md taken
  in the session scratchpad before any edit (restore source; git checkout is forbidden here).
- Decisions recorded: flowchart lives on Home.md and is reused in README; lifecycle
  stateDiagram draws blocked as a state with a note, mirroring canTransition's special case.
- Work order: scratch-repo transcript for The-Agents, two new pages, diagrams, opening
  summaries on the 8 existing pages, Publishing-the-Wiki sd-command update (re-run), README
  top, sidebar/Home tables, mermaid validation script, full verification, report.

## Next step if this session dies

Round 3 (narrow: the false gate caption replaced with what the code does, and four
before-definition uses on Skills-and-Playbooks glossed or linked) is implemented and
verified: full chain green, 100 links 0 broken, both mermaid validators green. Remaining:
commit, fresh implementer ledger row at the final head, then a round-3 review by a pass
that did not write this.

- Implementer landed `7a85351`: The-Agents.md (163 lines), Skills-and-Playbooks.md (107),
  lifecycle stateDiagram + flow flowchart, opening summaries on all 8 existing pages, README
  concept map. 703 insertions, 8 deletions, zero lines removed from the transcript pages.
- Verified independently before review: 276/0 both runtimes, typecheck 0, lint 0/0, 91 links
  0 broken, gate green. Spot-checked the lifecycle diagram edge-by-edge against
  src/lifecycle.ts TRANSITIONS: matches, including no in_progress->done edge.
- Review panel launched in parallel on a different model: reader lens (a stranger enters) and
  facts lens (every claim re-run). Paths allocated by fanout plan. Per item 15's rule the
  lenses record nothing; the synthesizing pass records one row under its own role.

- Panel round 1: both lenses CHANGES_REQUESTED. Synthesized verdict recorded as one
  verifier-failed row under orchestrator at 2a4c17c7, per item 15's panel rule.
- Reader blockers: skills and playbooks got two of the four promised dimensions (writes and
  must-not missing, and skills do write artifacts the reader cannot route to); the flow
  diagram teaches mstack gate as the landing decision, omits merge-gate and the orchestrator.
  Plus an 11-item jargon list, each located.
- Facts: 4 claims do not reproduce, worst being Skills-and-Playbooks' opening ("routes to one
  of seven playbooks") contradicted by its own route table (3 of 10 routes go to skills).
  Everything else held at rung 4: transcripts byte-identical, 18 diagram edges exact, mermaid
  parses under 11.17.0 with mutants rejected.
- Round 2 brief sent, one implementer, both lens reports named as the source of truth.
- Side event: killed 14 orphaned Claude Code snapshot shells spinning at ~99% CPU for 1.5h
  (PPID 1, no children, spin inside zsh snapshot sourcing). Machine clean after.

- Round 2: panel returned CHANGES_REQUESTED on both lenses (review_docs-for-newcomers_reader.md,
  _facts.md). Work list: (1) writes + must-not dimensions for all 12 skills and 7 playbooks
  with SKILL.md citations; (2) flow diagram reshaped: merge-gate named as the landing
  decision, orchestrator shown as the frame, opening sentence on Skills-and-Playbooks fixed
  for the 3 skill routes; (3) jargon: pass, ledger, rung, lens, panel, verdict enum,
  (target,sha), decision rows, worktree, EARS, sdd defined or linked at first use; (4) facts:
  Getting-Started opener names the runtime, two stale src cites fixed (lifecycle.ts:85-95,
  cli.ts:497-507); nits taken: Status-Line opener full sentence, State-Files opener claim
  softened, reviewer cast cell qualified. Mermaid re-validated with real mermaid 11.17.0 in
  the scratchpad plus the TRANSITIONS edge check.

- Round-2 panel relaunched after both lenses died on a usage limit at launch (nothing lost;
  they resumed with context).
- Reader r2: CHANGES_REQUESTED, narrow. 10 of 11 jargon items fixed, three fixes better than
  asked; but the new leaves-on-disk tables reintroduced unglossed jargon (fanout, lens,
  rung), and it flagged a subgraph-binding risk in the diagram it could only take to rung 3.
- Settled that risk myself at rung 4: mermaid 11.17.0's parser db places [spec, impl, review]
  inside the orchestrator frame for the shipped source; a true-failure mutant returns
  [review] only, so the probe can fail; Home and README copies are byte-identical. Probe at
  scratchpad/mermaid-probe.
- Facts r2 still running; round-3 brief goes out as one message when it lands.

## Verification

- Full suite at the editing tree: `npm test` (bun: 276 tests across 15 files; node: 276
  pass, 0 fail), `npm run typecheck` clean, `./bin/mstack lint-plugin .` PASSED 0/0,
  `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`: 91 links, 0 broken.
- Mermaid: scratchpad validator imports STATUSES/TRANSITIONS from src/lifecycle.ts and
  asserts the state diagram's 18 edges match exactly, all 9 statuses appear verbatim, no
  in_progress->done edge, both flowchart copies identical and under 15 nodes. Mutation
  check: injecting in_progress->done makes it exit 1; restored, exits 0.
- Publishing-the-Wiki sd commands re-run on fresh copies; diff against originals matches an
  independent link-only transform byte for byte.
- Scratch-repo transcripts for The-Agents produced by ./bin/mstack (self-approval gate
  failure, then green after a reviewer row).
