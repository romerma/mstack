# Session history (append-only)

> One entry per closed session, appended at the end. Never edit an earlier
> entry. If it turned out to be wrong, say so in a later one.

## 2026-08-19 — item 9, readme-and-wiki

- Found at open: this file had no entries while state.json showed items 1–8 closed, and
  `current.md` still described item 5 as in_progress. The sessions that closed items 1
  through 8 ended without appending here; their real record is in the ledger, decisions.tsv
  and the review reports. Recorded rather than back-filled: entries written after the fact
  would claim a discipline those sessions did not have.
- Item 9 ran the feature playbook on branch docs/readme-and-wiki: README rewritten as an
  on-ramp with the credit to Lauren Tan (poteto) on the first screen, eleven wiki pages under
  docs/wiki/ as the GitHub wiki's in-repo source with a verified publish route, a CHANGELOG
  Unreleased section, and scripts/check-doc-links.mjs so the item's verification field runs
  as recorded.
- Implementation was delegated. The review panel — facts lens and cold-reader lens on
  different models — returned 25 findings, every one fixed; a facts follow-up re-verified
  24 of 25 by re-running the commands and re-fetching the cited pages, and specified the two
  residual one-word fixes, applied by the orchestrator per the decision row.
- Ship: merge-gate skip: no remote exists before publication, so a PR is impossible; local
  fast-forward of docs/readme-and-wiki into main instead.
- Follow-up candidates recorded, not acted on: the "reply body" phrasing in agents/*.md and
  the research doc contradicts the sub-agents docs (the panel fixed it in the wiki only);
  README and Gates-and-Hooks say the shape-check defect "shipped" while The-Story pins it to
  two issue numbers — three pages, two characterisations of one defect; four prose lines sit
  past the ~100-column convention after the fix round's reflow.
