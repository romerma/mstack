# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 12 rm-guard-command-boundary
- **Status:** in_progress
- **Branch:** fix/rm-guard-command-boundary
- **Base:** main
- **Worktree:** none

## Plan

First item of the refinement round driven by `sandbox/PROTOCOL.md`. Started ahead of the
triage because it is the one finding nobody disputes: a shipped defect, reproduced at rung 5
twice by two different passes, already carrying acceptance criteria.

- Re-reproduce the defect against HEAD before touching it. **Done**: 4 false positives and
  2 bypasses against the shipped regex.
- Delegate the fix to an implementer: evaluate only the shell segment containing the `rm`,
  keep every true positive, and state the limits the guard cannot see rather than implying
  it has none.
- Review by a pass that did not write it, then close.

## Log

- Refinement round opened. `mstack gate` was green on main; the dogfood branch landed
  `--ff-only` so item 11's verdict SHA survives.
- Re-verified five friction claims against plugin HEAD in a throwaway store: F1 (no
  per-subcommand help), F4 (`fanout plan` doubles the slug), F6 (`--verification` not
  settable via `state set`), F9 (abbreviated SHA fails `ledger check`), F10 (`--full` warns
  it checked nothing without failing). All five reproduce.
- F9 is worse than the protocol recorded: `src/ledger.ts:136` compares SHAs with `===`, so
  an abbreviated SHA lands every row in `stale` and the message asserts "a new head SHA
  voids them" — false, it is the same commit written shorter. The diagnostic lies.
- A divergent-lens pass is running against the whole findings list; its job is to argue
  against acting. Report will land at progress/reflect_divergent.md.
- Caught a measurement error of my own before reporting it: `bun test` without a path picks
  up the sandbox's suite. The project's command is `bun test tests/`, and both runtimes are
  green at HEAD (171 pass each).

- Implementer pass done. `shellSegments` added to `src/hooks.ts`; `preToolUse` now matches
  every guard per segment rather than per line. 24/24 rows correct, was 14/24.
- Segmentation applied to all six guards, not just `rm`. Four siblings had the same `[^\n]*`
  defect, all four reproduced; only `git reset --hard` escaped, and by luck. One line, one
  call site.
- The `&` of `2>&1` is not a separator. Splitting there would have hidden a trailing
  `--force` from the push guard, turning a false deny into a false allow.

## Verification

- The defect: rung 5, reproduced against the shipped regex in a standalone script, twice by
  two passes; re-reproduced this pass, 10 wrong rows out of 24.
- The fix: rung 5. `bin/mstack hook pre-tool-use` driven as a real process with real JSON on
  stdin, 14/14 rows correct. Plus rung 4: `npm test` 174 pass on both runtimes, three
  separate mutations of the new code each caught by a named test.
- `npm run typecheck` and `./bin/mstack lint-plugin .` both clean.
- Commits: `a8e8d90` the fix, `51a79cc` and `9b951a4` the tests, `0c0c24d` the report.
  Ledger row `live-verified` at `0c0c24d`, verifier `implementer` — that is the implementer's
  own evidence, not an approval.

- Reflect triage written to progress/reflect_refinement.md. The divergent pass dropped ten of
  fourteen findings, most because the documentation already said the thing. Four accepted;
  the user chose the full scope.
- Items 13 editable-item-fields, 14 verification-never-runs and 15 reviewer-writes-the-verdict
  filed as pending. The fifth accepted finding (rung 4 must say what it ran on) shipped
  directly as one clause in evidence-ladder.md, per CONTRIBUTING's small-fix rule.
- Item 12 review came back CHANGES_REQUESTED with a **real false allow**: a separator inside
  `$(...)` or backticks splits one shell command in half, so 30 of 30 spellings regressed from
  DENY to allow across all five guards. Proved at rung 5 by letting the allowed command delete
  a real store. My own 9/9 check missed it because it never tested command substitution.
- Sent back to the implementer for depth tracking, plus the false limit statement in the module
  comment and the wiki page that now describes the pre-change behaviour.

- Round 2 done. `shellSegments` now tracks substitution depth: `$(`, `<(`, `>(`, `$((`, any
  paren nested inside one, and a backtick toggle. While depth is non-zero nothing is a
  separator. 30/30 regressed spellings back to DENY through the shipped binary.
- Finding 2 closed by rewriting the comment rather than deleting it: it now leads with the
  one-directional rule (a construct it cannot model must leave a segment too long, never too
  short), names the incident that proves the asymmetry, and lists every unmodelled construct
  with the direction it fails in.
- Finding 3 closed: `docs/wiki/Gates-and-Hooks.md` cited a moved line range and described the
  pre-change guard. All 17 behavioural claims on the page re-run through both shipped binaries.
- Process error worth keeping: my first mutation driver restored with `git checkout`, which
  discarded the uncommitted fix and made six of seven mutations report SETUP-ERROR against
  unmodified code. Re-applied, committed first, driver now restores from a byte copy.

## Verification

- Round 2, rung 5: differential over **528** destructive spellings across two shipped
  binaries (`main` and this branch) - **0** false allows introduced, and all 17 false
  positives including the four acceptance rows stay allowed.
- Round 2, rung 4: 7 per-construct mutations of the depth tracking, all killed by a named
  test. `npm test` 176 pass on both runtimes; typecheck and lint clean.
- Commits: `7b81823` the depth fix and its tests, `5b8397f` the wiki.

## Next step

- Hand item 12 back to a reviewer that did not write it, for round 2. Report at
  `.mstack/progress/impl_rm-guard-command-boundary.md`, round-2 section at the bottom. The
  implementer did **not** mark it done and did not touch its status.
- Open question still standing for the reviewer: the sibling guards were fixed as a side
  effect, and round 1's reviewer noted that widening also opened four of the five false
  allows. They are closed now, but the scope judgement is still theirs to make.
