> Source: item 42 (`./bin/mstack state show 42`) and its three design rows in
> `.mstack/decisions.tsv` (2026-11-18T12:32:13Z, "verify --mutation works in the user's tree,
> not in a copy"; 12:40:58Z, the key covers code and tests; 13:02:23Z, round 2 after the spec
> review). This spec is authoritative for implementation; the item remains the discussion venue.

## Why

A green suite says the tests pass with the change. Nothing says they fail without it. In the
review rounds of this program the reviewers found tests that did not bite (unkilled mutants) by
hand in most rounds, and the requirement-to-test table (item 41) proves only that a cited test
exists and is a test file, not that it covers anything. `verify --mutation` is the check that
the tests bite: revert the item's own code, run the obligations, and require that they fail.

## What changes

- New command `mstack verify --mutation`: reverts the item's own committed code (the tracked
  code paths that differ between the start and HEAD) in the user's working tree, with the
  filesystem and never with a git command that can remove what it did not write; confirms a
  green baseline first; runs the item's obligations on the reverted tree; restores, proving each
  path against what the lock recorded; and records `mutation-killed`, `mutation-survived` or
  `mutation-blocked` in `.mstack/verification.tsv`, keyed by a fingerprint of the code and the
  tests. No row is written when the tree changed under the run.
- The lock, in the git directory, is a shell script: its header holds the restore record, and
  `sh <lock>` puts the tree back with git alone. The command prints those commands before it
  reverts anything. Anything at a reverted path that the restore does not recognise is moved to a
  rescue directory of that run first, and the gate warns while one holds anything.
- New command `mstack verify --restore`: repairs a tree left reverted by a run that was SIGKILLed
  or lost to a power cut.
- A run refuses to revert the source of the CLI that is running it; in an mstack checkout it runs
  from a copy made with `git worktree add --detach` outside the tree.
- New closing check `mutation`: from `verifying`, an item with a base, a size other than `s` and a
  non-empty code diff needs a `mutation-killed` receipt at the current fingerprint, in the gate
  and at the `done` transition. Overridable by a forced close that names it.
- While the lock exists: the gate fails, `gate --full` runs nothing, `done` is refused, and the
  PreToolUse hook denies the git commands that write the tree, the index or HEAD.
- A forced close past the mutation check records that fact in `closed_by`; the existing markers
  stay byte-identical.

## Impact

- New files: `src/mutation.ts` (the sets, the key, the refusals), `src/mutation-lock.ts` (the run
  directory, the lock, revert, restore), `src/mutation-run.ts` (the run).
- Changed: `src/cli.ts` (the `verify` command, the forced-close marker, `done` under a lock),
  `src/closing.ts`, `src/gate.ts`, `src/hooks.ts`, `src/verification.ts` (mutation rows),
  `src/size.ts` (`scopeClass` is exported, not copied), `src/git.ts` (`gitBytes`), `src/run.ts`
  (an async runner on the same helper).
- Docs: `docs/wiki/The-CLI.md` (`verify`), `docs/wiki/Gates-and-Hooks.md` (the hook row, the gate
  lines, the closing check).
- Data: `verification.tsv` gains rows with new `outcome` values and no new column. Older CLIs
  ignore them (`receipts()` keeps only `passed` and `failed`, `src/verification.ts:325-336`). The
  git directory gains `mstack-mutation.lock` while a run holds the tree and
  `mstack-mutation/<run id>/` while a run is staged or its rescue directory holds something.
- What could break: a restore that fails leaves the user's code reverted (the lock, `verify
  --restore`, `sh <lock>`, the gate, the hook and the refusals exist to make that recoverable and
  visible); every in-flight item at `verifying` with a base and a size other than `s` turns red
  until it has a killed receipt (no migration, by the design row); an item closed on the default
  branch after a merge commit may need `--base` moved to match its receipt (design.md "Open
  questions").
- Dependencies: none. No build step. Both runtimes.

## Human gate

Does not apply. The product forks were answered in the three design rows. Where this revision
had to decide something those rows leave open, `.mstack/progress/spec_mutation-check.md` says
what and why; none changes a user-visible outcome the rows decided.
