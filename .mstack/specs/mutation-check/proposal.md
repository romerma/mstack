> Source: item 42 (`./bin/mstack state show 42`) and its decision rows in `.mstack/decisions.tsv`:
> 2026-11-18T12:32:13Z (in place, not in a copy), 12:40:58Z (the key covers code and tests),
> 13:02:23Z (round 2), 2026-11-19T08:27:17Z (the user's answer to the fork: A, and the split) and
> 08:27:32Z (this round's design). This spec is authoritative for implementation; the item remains
> the discussion venue.

## Why

A green suite says the tests pass with the change. Nothing says they fail without it. Reviewers in
this program found tests that did not bite by hand in most rounds, and the requirement-to-test
table proves only that a cited test exists. `verify --mutation` asks the question: revert the
item's own code, run the obligations, and see whether they fail.

Two spec reviews found ways the earlier designs lose a user's work: in the handling of unusual
shapes (a file that became a directory, a case-only rename) and in the git-only recovery script.
None was in the plain case of a regular file that was added, deleted or modified. This round keeps
the plain case and refuses the rest before anything is touched.

## What changes

- `mstack verify --mutation [--timeout <seconds>]`: refuses an unusual shape, a dirty tree, a merge
  of other work, or a revert of its own running source; confirms a green baseline; stages the
  start's and HEAD's bytes of every reverted path in the git directory; takes a lock; reverts the
  item's committed code (tracked code paths that differ between the start and HEAD) with the
  filesystem; runs the obligations; restores, saving first anything at a reverted path that the run
  did not write; and appends `mutation-killed`, `mutation-survived` or `mutation-blocked` to
  `.mstack/verification.tsv`, keyed by a fingerprint of the code and the tests, unless the tree
  changed under the run.
- The lock, `<git dir>/mstack-mutation.lock`, is a JSON record. It is not a script, and the tool
  offers no recovery that can overwrite work.
- `mstack verify --restore` is the one way out after a SIGKILL or a power cut. It refuses while the
  run may be alive and has no `--force`. Every message that names it gives the absolute path of
  the CLI that wrote the lock.
- While the lock exists, the gate fails, `gate --full` runs nothing, and the PreToolUse hook denies
  the git commands that write the tree, the index or HEAD. The gate warns while a rescue directory
  holds anything.
- Not here: the closing check that holds an item to a killed receipt, the rule for a receipt after
  a merge, the forced-close marker and the refusal of `done` under a lock. Those are item 100;
  design.md "What item 100 needs from this spec" says what this item leaves for it.

## Impact

- New: `src/mutation.ts` (the sets, the key, the refusals), `src/mutation-lock.ts` (the lock,
  staging, liveness), `src/mutation-tree.ts` (exact names, revert, restore, rescue),
  `src/mutation-run.ts` (the run).
- Changed: `src/cli.ts` (`verify`), `src/gate.ts` (the lock line, the rescue warning, `--full`
  under a lock), `src/hooks.ts` (the lock branch), `src/verification.ts` (`recordMutation`),
  `src/size.ts` (`scopeClass` exported), `src/git.ts` (`gitToFile`), `src/run.ts`
  (`runCommandAsync`), `src/run-helper.mjs` (an opt-in parent watch; `runCommand` does not use it).
- Docs: `docs/wiki/The-CLI.md` (`verify`, the by-hand recoveries), `docs/wiki/Gates-and-Hooks.md`
  (the hook row, the gate lines), `CHANGELOG.md`.
- Data: `verification.tsv` gains rows with new `outcome` words and no new column; older CLIs ignore
  them (`src/verification.ts:325-336`). The git directory holds the lock while a run holds the
  tree, and `mstack-mutation/<run id>/` while a run is staged or its rescue directory holds
  something.
- What could break: a restore that fails leaves code reverted (the lock, `verify --restore`, the
  gate and the hook make that visible and recoverable); an item whose diff has a refused shape gets
  no receipt; and two windows the design cannot close are stated in design.md "Every state, and its
  exit".
- Dependencies: none. No build step. Both runtimes.

## Human gate

Answered. The product fork (in place with a lock, a copy of the tree, or no mutation check) went to
the user, who chose in place and the split on 2026-11-19 (row 08:27:17Z). This revision decides
nothing that changes a user-visible outcome beyond what row 08:27:32Z states; where it chose
(N9: no `--force`), `.mstack/progress/spec_mutation-check_r3.md` says what and why.
