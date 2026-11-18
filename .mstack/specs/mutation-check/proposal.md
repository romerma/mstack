> Source: item 42 (`./bin/mstack state show 42`) and its design row in
> `.mstack/decisions.tsv` (2026-11-18T12:32:13Z, "item 42: verify --mutation works in the
> user's tree, not in a copy"). This spec is authoritative for implementation; the item
> remains the discussion venue.

## Why

A green suite says the tests pass with the change. Nothing says they fail without it. In the
review rounds of this program the reviewers found tests that did not bite (unkilled mutants)
by hand in most rounds, and the requirement-to-test table (item 41) proves only that a cited
test exists and is a test file, not that it covers anything. `verify --mutation` is the
check that the tests bite: revert the item's own code, run the obligations, and require that
they fail.

## What changes

- New command `mstack verify --mutation`: reverts the code part of the item's own work in the
  user's working tree, confirms a green baseline first, runs the item's obligations on the
  reverted tree, restores, and records `mutation-killed`, `mutation-survived` or
  `mutation-blocked` in `.mstack/verification.tsv`, keyed by a fingerprint of the code part.
- New command `mstack verify --restore`: repairs a tree left reverted by a run that was
  SIGKILLed or lost to a power cut, from a lock under the git directory.
- New closing check `mutation`: from `verifying`, an item with a base, a size other than `s`
  and a code diff needs a `mutation-killed` receipt at the current code fingerprint, in the
  gate and at the `done` transition. Overridable by a forced close that names it.
- New closing check `mutation-lock` and a gate failure: while the lock exists the gate is red
  and the item cannot close.
- The PreToolUse hook denies `git commit`, `git add` and `git stash` while the lock exists.
- A forced close past the mutation check records that fact in `closed_by`.

## Impact

- New files: `src/mutation.ts`, `src/mutation-lock.ts`, `src/mutation-run.ts`.
- Changed: `src/cli.ts` (the `verify` command, the forced-close marker), `src/closing.ts`,
  `src/gate.ts`, `src/hooks.ts`, `src/verification.ts` (mutation rows), `src/size.ts`
  (the code-path predicate is exported, not copied), `src/run.ts` (an async runner).
- Docs: `docs/wiki/The-CLI.md` (`verify`), `docs/wiki/Gates-and-Hooks.md` (the hook row, the
  gate check, the closing check).
- Data: `verification.tsv` gains rows with new `outcome` values and no new column. Older
  CLIs ignore such rows (`receipts()` keeps only `passed` and `failed`, `src/verification.ts:325-336`).
- What could break: a restore that fails leaves the user's code reverted (the whole of
  design.md exists to make that recoverable); every in-flight item at `verifying` with a base
  and a size other than `s` turns red until it has a killed receipt (no migration, by the
  design row).
- Dependencies: none. No build step. Both runtimes.

## Human gate

Does not apply. The product forks were answered in the design row. Three places where the
decided design is thin are recorded in `.mstack/progress/spec_mutation-check.md` for the spec
reviewer; none changes a user-visible outcome the design row decided.
