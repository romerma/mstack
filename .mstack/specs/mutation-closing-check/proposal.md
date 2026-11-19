> Source: item 100 (`./bin/mstack state show 100`), split from item 42 by the user's decision of
> 2026-11-19 (decisions.tsv 08:27:17Z), and `.mstack/progress/spec_review_mutation-check_r2.md`
> B3. This spec is authoritative for implementation; the item remains the discussion venue.

## Why

Item 42 records whether an item's tests fail when its code is put back to the item's start.
Nothing holds an item to that record, so a run that survives changes nothing, and a run nobody
made changes nothing either. This item makes the record a closing check.

Two facts shape it. mstack merges first and closes on the default branch after
(`skills/ship/SKILL.md:31-35`), where item 42's key no longer matches once other work is in, and a
new run is refused: after a merge commit by item 42's R4, after a squash or a rebase merge by its
lost start. And the record is a local file: `verification.tsv` is ignored (`src/setup.ts:72`) and
lives in the store of the checkout that ran it. A linked worktree's run leaves no row in the main
checkout (measured: 1 row there, 0 here), and `git worktree remove` deletes it with exit 0. So "a
receipt survives the merge" can only mean: on the same machine and repository, while the
worktree that holds it exists, judged against the checkout that closes. CI and other clones have
no rows and need none: CI runs no gate (`.github/workflows/ci.yml`).

**What a killed receipt is worth.** It says that with the item's code put back, the item's
verification failed; it does not say a test checks what the code does. A test that only imports
the item's new module and asserts nothing kills; a verification that fails on any change (`git
diff --quiet HEAD -- src`) kills; on a dash system `sh <script>` whose script the revert removed
kills (exit 2), where bash would be blocked (127) (all four measured, design.md Fact 3; item 104).
What the check adds is this: an item whose tests pass without its code can no longer close
without someone saying so, and that sentence is kept in `state.json`.

**What it would have done here** (design.md Fact 1, from diffs, no run). Of the 53 closed items, 9
had a base when they closed. 6 of those have a code diff, none is size `s`, so the check would
have held all 6; R3 and R4 refuse none of them, and all 6 change `src/`. From `./bin/mstack`, R5
refuses every one of them, because the running CLI's root is this checkout; from a copy of the
CLI outside the tree none is refused. Over the round 3 review's wider windows, 1 window with code
in 41 hits a refused shape (R4, across the merges of `fix/mstack-front-door`), not 1 in 38. No item
here is in flight: item 100 is the only active item, and it closes under its own rule (tasks.md
4.3, 4.4).

So for this repository the check is not a forced close per item; it is a copy step per item: the
gate's line names the commands (`git worktree add --detach`, the copy's `verify --mutation`, `git
worktree remove`), the run takes about as long as one suite (198 s for item 42), and it has to come
from a session not started with `--plugin-dir .`, whose hooks would run the reverted `src/`. Most
items here add code that their tests import, so the run kills by an import or a type error: the
receipt then says the tests reach the code, not that they check it. That is the price; the user
can turn the rule off for this repository in `state.json` and keep the mechanism.

## What changes

- A closing check, `mutation`: from `verifying`, in the gate and at `state set --status done`, an
  item with a base, a size other than `s`, an obligation and a code diff needs its newest holding
  decisive row to be `mutation-killed`. The problem says which of five things is true (no run,
  only blocked runs, the verification changed, a path changed since, survived) and names `verify
  --mutation` and the forced close.
- When a row holds: with its commit on HEAD's first-parent history (the branch, a fast-forward),
  when no tracked code or test path changed since that commit; otherwise (a merge commit, a squash,
  a rebase), when every code and test path the item changed up to that commit still holds that
  commit's content, and, after a merge commit, the merged branch changed no code or test path
  after it. This is B3's rule C-prime, computed from the start at the row's commit rather than the
  base, with its first companion; design.md has the 19 shapes measured.
- Rows are read from every worktree's store of the repository, not only this one.
- `verify --mutation` refuses while an untracked test file is in scope (B3's second companion).
- A forced close past the check writes `closed without a killed mutation receipt (forced): <why>`
  (combined with the existing phrases when it overrides more than one check), and keeps it.
- `rules.require_mutation_to_close`, written `true` by `setup`; its meaning when absent is the fork.
- `state set --status done` is refused while the mutation lock exists.

## Impact

- New: `src/mutation-close.ts`. Changed: `src/closing.ts` (one entry), `src/size.ts`
  (`measureStart` at a given commit), `src/cli.ts` (the lock refusal at `done`, the markers),
  `src/gate.ts` (its lock line moved to be shared), `src/mutation.ts` (R8), `src/state.ts`,
  `src/setup.ts`, `.mstack/state.json` of this repository (the rule, `true`).
- Docs: `docs/wiki/Gates-and-Hooks.md` (the check, the markers), `docs/wiki/The-CLI.md` (verify:
  the closing check, R8, what survives a merge), `docs/wiki/State-Files.md` (five rules),
  `skills/ship/SKILL.md` (close before removing a worktree), `CHANGELOG.md`.
- Data: no new file or column. Rows of other worktrees are read, never written.
- What could break: a store that upgrades with an item at `verifying` and code gets a red gate
  under answer A of the fork, until a run or a forced close; an item closed after other work
  fast-forwarded onto the default branch, or with no code of its own after a squash, is held
  (design.md "Trade-offs accepted"). A false hold is possible after a squash or rebase merge of a
  branch changed after its run (V5C).
- Dependencies: none. No build step. Both runtimes.

## Human gate

One fork, written in `.mstack/progress/spec_mutation-closing-check.md` under "Fork for the user":
whether a store whose `state.json` lacks the rule is held (it changes what every upgraded store
sees). R10 is the one requirement that depends on it. The other choices are decided with their
reasons in decisions.tsv (phase `spec`, item `mutation-closing-check`): the rule for a receipt
after a merge, rows from other worktrees, the untracked-test refusal, and an overridable problem
when the code diff cannot be computed.
