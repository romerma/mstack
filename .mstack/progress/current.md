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
- Segmentation applied to all five guards, not just `rm`. The sibling guards had the same
  `[^\n]*` defect (3 of them reproduced), and the fix is one line at one call site.
- The `&` of `2>&1` is not a separator. Splitting there would have hidden a trailing
  `--force` from the push guard, turning a false deny into a false allow.

## Verification

- The defect: rung 5, reproduced against the shipped regex in a standalone script, twice by
  two passes; re-reproduced this pass, 10 wrong rows out of 24.
- The fix: rung 5. `bin/mstack hook pre-tool-use` driven as a real process with real JSON on
  stdin, 10/10 rows correct. Plus rung 4: `npm test` 174 pass on both runtimes, three
  separate mutations of the new code each caught by a named test.
- `npm run typecheck` and `./bin/mstack lint-plugin .` both clean.

## Next step

- Hand item 12 to a reviewer that did not write it. Report at
  `.mstack/progress/impl_rm-guard-command-boundary.md`. The implementer did **not** mark it
  done and did not touch its status.
- Open question for the reviewer, not for this pass: the sibling guards were fixed as a side
  effect. If that reads as scope creep, the alternative is a per-guard opt-in flag, which is
  worse code for a cleaner boundary. Decision is recorded in decisions.tsv.
