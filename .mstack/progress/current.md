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

Implementation is complete and verified; the remaining steps are commit, the impl report at
.mstack/progress/impl_docs-for-newcomers.md, the implementer ledger row at the report
commit's SHA, and review by a pass that did not write this.

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
