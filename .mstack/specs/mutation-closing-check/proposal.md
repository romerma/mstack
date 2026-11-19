> Source: item 100 (`./bin/mstack state show 100`), split from item 42 by the user's decision of
> 2026-11-19 (decisions.tsv 08:27:17Z), and `.mstack/progress/spec_review_mutation-check_r2.md`
> B3. Round 2 answers `.mstack/progress/spec_review_mutation-closing-check.md`. This spec is
> authoritative for implementation; the item remains the discussion venue.

## Why

Item 42 records whether an item's tests fail when its code is put back to the item's start.
Nothing holds an item to that record, so a run that survives changes nothing, and a run nobody
made changes nothing either. This item makes the record a closing check.

Two facts shape it. mstack merges first and closes on the default branch after
(`skills/ship/SKILL.md:31-35`), where a new run is refused (after a merge commit by item 42's R4,
after a squash or a rebase merge by its lost start), so the receipt made on the branch has to be
judged after the merge. And the record is a local file: `verification.tsv` is ignored and lives in
the store of the checkout that ran it, so "a receipt survives the merge" can only mean on the same
machine and repository, while the worktree that holds it exists, judged against the checkout that
closes (design.md Fact 2).

**What a killed receipt is worth.** It says that with the item's code put back, the item's
verification failed; it does not say a test checks what the code does (design.md Fact 3). What
the check adds is this: an item whose tests pass without its code can no longer close without
someone saying so, and that sentence is kept in `state.json`.

**What it would have done here** (design.md Fact 1). Of the 53 closed items, 9 had a base when
they closed; 6 have a code diff, and the check would have held all 6. Each changes `src/`, so its
run comes from a copy of the CLI outside the tree, about one suite run (198 s for item 42), from a
session not started with `--plugin-dir .`. Most items here add code their tests import, so the
kill mostly says the tests reach the code. The user can turn the rule off in `state.json` and keep
the mechanism. No item here is in flight; item 100 closes under its own rule (tasks.md 3.3, 3.4).

## What changes

- A closing check, `mutation`: from `verifying`, in the gate and at `state set --status done`, an
  item with a base, a size other than `s`, an obligation and a code diff needs its newest holding
  decisive row to be `mutation-killed`. The problem says which of five things is true (the last
  run survived, every run is void, only blocked runs, the verification changed, no run) and names
  `verify --mutation` and the forced close.
- When a row holds (the review's rule Qab, design.md Fact 4): with its commit on HEAD's
  first-parent history (the branch, a fast-forward), when no tracked code or test path changed
  since that commit; after a merge commit, when the item's code and test paths still hold the
  run's content and the merged branch changed nothing after the run; after a squash or a rebase
  merge, when the first commit that holds the run's content of the item's paths brought nothing
  else and nothing changed after it. A row's commit must be a full sha, and a file flagged
  `assume-unchanged` or `skip-worktree` voids every row.
- Rows are read from every worktree's store of the repository, not only this one.
- `verify --mutation` refuses while an untracked test file is in scope.
- A forced close past the check writes `closed without a killed mutation receipt (forced): <why>`
  (composed with the existing phrases), keeps it, and refuses `--clear closed-by` on it.
- `rules.require_mutation_to_close`, written `true` by `setup`; how it reads when absent is fork 1.
- `state set --status done` is refused while this checkout's mutation lock exists.

## Acceptance 2, and its one exception

Acceptance 2 is met except for one shape: a rebase merge that reorders a commit made after the run
so that it lands before the item's code (CPR). Git alone cannot tell that commit from the default
branch's own earlier work, and nothing records which commits were the item's. The rule also voids
a receipt that should hold when other work lands on the default branch between the merge and the
close, after a squash, a rebase merge or a fast-forward (C3, L); closing right after the merge, as
ship already does, avoids it. **This exception is waiting for the user's yes** (fork 2,
`.mstack/progress/spec_mutation-closing-check_r2.md`).

## A new user's first close

Getting-Started's walkthrough closes an item with code at `verifying`, and under this check that
close is refused until a run has killed. The page and its test (`tests/walkthrough.test.ts`) gain
one command: after the reviewer's `gate --full`, at `reviewing`, the reviewer runs `mstack verify
--mutation`, which puts `greet.py` back as it was at the item's start, runs the verification, sees
`test_shout` fail, puts `greet.py` back and records `mutation-killed`, in about a second
(design.md Fact 3); the close then reads that row. The first item a new user closes is an ordinary
item with code, so the page shows the check every such item meets, rather than an item it does not
hold (size `s`, or the rule off), which would teach that the check is optional.

## Impact

- New: `src/mutation-close.ts`. Changed: `src/closing.ts` (one entry), `src/size.ts`
  (`measureStart` at a given commit), `src/cli.ts` (the lock refusal at `done`, the markers, the
  refused clear), `src/gate.ts` (its lock line moved to be shared), `src/mutation.ts` (R16),
  `src/state.ts`, `src/setup.ts`, `.mstack/state.json` of this repository (the rule, `true`).
- Tests: `tests/helpers.ts` (`state()` writes the rule `false`), `tests/walkthrough.test.ts`, two
  item 42 tests moved from an untracked test file to an untracked code file.
- Docs: `docs/wiki/Gates-and-Hooks.md` (the check, the markers, the receipts paragraph at
  `:703-707`), `docs/wiki/The-CLI.md` (verify: the closing check, R16, after the merge; `--clear`),
  `docs/wiki/State-Files.md` (five rules), `docs/wiki/Getting-Started.md`, `skills/ship/SKILL.md`
  (close before removing a worktree), `CHANGELOG.md`, and two scenarios of item 42's spec.
- Data: no new file or column. Rows of other worktrees are read, never written.
- Dependencies: none. No build step. Both runtimes.

## What could break

- **Upgraded stores.** Under answer A of fork 1, a store that upgrades with an item at `verifying`
  and code gets a red gate until a run kills or a forced close records why; under answer B it sees
  nothing until it adds the key. New stores get the check under either answer.
- **The walkthrough's first close** needs the mutation run (above).
- **Item 42's two untracked-test scenarios** (its R2 "An untracked test edited during the baseline"
  and R18 "Untracked code and tests") cannot happen for a test file any more, since R16 refuses
  the run first; `tests/mutation-run.test.ts:113` would pass for R16's reason and
  `tests/mutation-changed.test.ts:90-100` would fail. Both move to an untracked code file, which
  reaches the same mechanisms, and item 42's spec is amended to say so (task 1.5). A session with a
  scratch test file must commit it or ignore it before a run.
- **`--clear closed-by` on a marked note** exits 2, for today's three markers too; today it erases
  the record with exit 0.
- **False holds** after other work lands between a squash, rebase merge or fast-forward and the
  close (C3, L): a forced close or a close made earlier.
- **This repository**: every item with code needs one copy-and-run per close.

## Human gate

Two forks, written in `.mstack/progress/spec_mutation-closing-check_r2.md` under "Forks for the
user". Fork 1: how a `state.json` without the rule reads; R21 and the two R21 tests of tasks 1.1
and 1.2 depend on it, nothing else. Fork 2: whether acceptance 2 stands with the CPR exception.
The other choices are decided with their reasons in decisions.tsv (phase `spec`, item
`mutation-closing-check`).
