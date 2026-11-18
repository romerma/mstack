# walkthroughs-after-closing-checks: implementation report, round 3

## What changed since round 2

Every finding of `review_walkthroughs-after-closing-checks_r2.md` was checked against the page
first. The blocking one and non-blocking 1, 2 and 4 hold and are applied; 3 and 5 are item 97's.

- **Blocking: the work commit depended on the reader's `python3`.** "The repository this page
  starts from" now has a shown `.gitignore` (`__pycache__/`), committed in the `init` commit, with
  one clause saying why. `tests/walkthrough.test.ts` writes the same file (`:99`) and no longer
  sets `PYTHONDONTWRITEBYTECODE` (`:22`). Red first: with that variable removed and the Homebrew
  `python3` first on PATH, the round 2 test failed at its stat assertion on both runtimes:
  `actual: '... 7 files changed, 37 insertions(+), 6 deletions(-)\n create mode 100644 .mstack/progress/impl_greet-flag.md\n create mode 100644 __pycache__/greet.cpython-315.pyc\n create mode 100644 __pycache__/test_greet.cpython-315.pyc\n'`.
  With the `.gitignore` step it passes with each `python3` first on PATH.
- **Non-blocking 1, Python-version lines.** In Getting-Started, `unittest -v`'s per-test lines are
  `...`; `Ran 2 tests in 0.000s` and `OK` stay. The-Agents and the README have no such lines
  (`rg -n "test_greet\." README.md docs/wiki/*.md` finds only file names, the table and the
  acceptance text), so nothing changed there.
- **Non-blocking 2, the refusal block.** Back as a console block between the move to `reviewing`
  and the reviewer's `gate --full`: `state set greet-flag --status done --force --closed-by
  "demo walkthrough"`, real lines, one sentence saying a close needs a verdict from another pass
  and `--force` does not get past it. The prose quotation is gone. The test makes the same call
  (`:158`) and asserts exit 2 and the line. Decision row 253's premise ("only reachable at
  verifying") was wrong; the design row of round 3 supersedes it.
- **Non-blocking 4, the warning.** Half a sentence on Getting-Started ("its one warning is the
  uncommitted `.mstack/` edits, expected mid-session") and on The-Agents ("the uncommitted
  changes"); the line itself is not shown (two `...` gaps would be longer). The test asserts the
  line (`:167`).
- **CHANGELOG.** The item's entry gains the round 3 sentence, which says the stat holds on both Pythons.

## Findings not applied

- Non-blocking 3 (README reviewer's row while `mstack gate` is red) and 5 (order of the reviewer's
  report and `gate --full` in The-Agents' premise): out of scope, filed on item 97 by the brief.

## Files

`docs/wiki/Getting-Started.md`, `docs/wiki/The-Agents.md`, `tests/walkthrough.test.ts`,
`CHANGELOG.md`, this report, the ledger and decisions rows.

## Evidence: two Pythons

Scripts in `.../scratchpad/impl96r3/` (`gs2.sh`, `rd2.sh`, `ag2.sh`, `diffpages2.sh`); each
command is typed as the page shows it, through a `mstack` shim that execs `./bin/mstack`, with
git config and `HOME` in the scratch directory. The `.gitignore` is written from the page's block.

| Run | python3 | Getting-Started | README | The-Agents |
|---|---|---|---|---|
| `TAG=sys` | `/usr/bin/python3`, 3.9.6 (`pycache_prefix` under `~/Library/Caches`) | 13 blocks, 0 differing | 5 blocks, 0 differing | 2 blocks, 0 differing |
| `TAG=brew EXTRA_PATH=.../review96r2/bin-brew` | Homebrew 3.15.2 (`__pycache__/*.cpython-315.pyc` written in the work tree, ignored) | 13 blocks, 0 differing | 5 blocks, 0 differing | 2 blocks, 0 differing |

Both runs print `5 files changed, 37 insertions(+), 6 deletions(-)` at the work commit; the
per-test lines differ (`test_default (test_greet.TestGreet) ... ok` on 3.9.6,
`test_default (test_greet.TestGreet.test_default) ... ok` on 3.15.2) and sit under the page's `...`.
`constcheck.mjs`: the test's `GITIGNORE`, `GREET_PY_0`, `TEST_PY_0`, `GREET_PY`, `REPORT`, `TEST_PY`
equal the page's blocks. Exit codes: the refusal is 2 on both.

## Commands

- `npm run typecheck`, `./bin/mstack lint-plugin .`, `./bin/mstack gate` (`PASSED - 0 failures, 0 warnings`), `node scripts/check-doc-links.mjs README.md docs/wiki/*.md` (109 checked, 0 broken).
- `npm run test:node`: 883 pass, 0 fail (no test added: the new steps are in the existing sequence test).
- Walkthrough test alone, each `python3` first on PATH: 4 pass, 0 fail (default PATH, then bin-brew first).
- `npm run test:bun`: 883 pass, 0 fail.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | the Getting-Started sequence, every step with its exit code; the `.gitignore` step, the forced refusal (exit 2), the work commit's stat without `PYTHONDONTWRITEBYTECODE` | tests/walkthrough.test.ts:214, tests/walkthrough.test.ts:144, tests/walkthrough.test.ts:158 |
| A2 | n/a: page against run on both Pythons, r3/diffpages2.sh over the three pages (scratchpad; item 97 files the repository script) | n/a: r3/diffpages2.sh, table above |
| A3 | the rerunning test and its three refusal mutants (no report, no gate --full, no reviewer's row) | tests/walkthrough.test.ts:214, tests/walkthrough.test.ts:219, tests/walkthrough.test.ts:225, tests/walkthrough.test.ts:231 |
| A4 | the base line, the two-warning gate and the one-warning `gate --full` asserted; setup output and commit counts by diffpages2 | tests/walkthrough.test.ts:125, tests/walkthrough.test.ts:108, tests/walkthrough.test.ts:167 |
