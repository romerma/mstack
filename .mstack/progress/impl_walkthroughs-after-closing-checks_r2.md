# walkthroughs-after-closing-checks: implementation report, round 2

Scratch directory (called `r2/` below): `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl96r2/`.
It holds `gs2.sh`, `rd2.sh`, `ag2.sh` (the run scripts), `gs.run`, `rd.run`, `ag.run` (raw output),
`fill.py` (pastes a run into a page), `diffpages.mjs`, `diffpages2.sh` and `diffpages2.out`
(page against run), `blk.py`, `constcheck.mjs`, `round1.test.ts`, `red_round1.test.ts`.

## What changed since round 1

Every finding of `review_walkthroughs-after-closing-checks.md` was checked against the pages
first; all eight hold, none is left unapplied except the repository script of non-blocking 4,
which is item 97.

- **Blocking 1 (current.md).** The run now edits the two lines in place (`gs2.sh:31-32`) and the
  page says exactly which two (`- **Item:** _none_` and the italic line under `## Next step`).
  The work commit prints `5 files changed, 37 insertions(+), 6 deletions(-)` and the page shows
  that. The test does the same edit (`tests/walkthrough.test.ts:131-132`) and asserts the stat (`:142`).
- **Reviewer on a green gate (non-blocking 1).** In Getting-Started and The-Agents the reviewer
  runs `gate --full` at `reviewing`, where it prints `PASSED - 0 failures, 1 warning`, records its
  row, and only then does the item move to `verifying` and close. No red gate is left on any page.
  Consequence: Getting-Started no longer shows the author-only refusal as a command block (it can
  only be reached by trying the close between the reviewer's run and its row); it is quoted in
  prose and asserted by the new test. Decision row recorded. The-Agents keeps its
  `done --force` refusal (at `reviewing`, the close check refuses on the verdict, same message).
- **README (non-blocking 2).** `git add -A` and `git commit` come before the implementer's row,
  so both rows name the commit that has the work. The commit output is elided to its first line.
  The intro says the two files are Getting-Started's, committed.
- **Getting-Started shows what its table cites (3, 7).** A section "The repository this page
  starts from": `git init -b main`, `greet.py`, `test_greet.py`, `git add -A`, `git commit -m "init"`
  (and the `master` caveat). "Do the work" shows both final files in full; the table's `:6`
  and `:9` are `def test_default` and `def test_shout` in the shown file, and the page says
  `Where` is a line of the reader's own test file.
- **The-Agents (5).** One sentence: `greet-flag` at `reviewing`, with its `--verification`, a filled
  `current.md`, the implementer's report committed with the work, and the reviewer's report written.
- **CHANGELOG (6).** Says Getting-Started and the README show the report, The-Agents links to
  it; covers round 2.
- **Test.** Follows the page step for step (below).

## Files

`docs/wiki/Getting-Started.md`, `docs/wiki/The-Agents.md`, `README.md`, `CHANGELOG.md`,
`tests/walkthrough.test.ts`, `.mstack/decisions.tsv` (one implement row), this report.

## Commands

Red first. `red_round1.test.ts` is the round 1 test with only the corrected order (reviewing,
`gate --full`, row, verifying, close), run with `bun test` (`r2/`):

```
AssertionError: gate --full: exit 0, wanted 1
[ok]    one active item: greet-flag (reviewing)
[ok]    python3 -m unittest test_greet -v
PASSED - 0 failures, 1 warning
```

The round 1 assertions that change: the `gate --full` exit code (1 to 0), its `[fail] ... (verifying)`
and `FAILED - 1 failure, 1 warning` lines (to `[ok]` unittest and `PASSED - 0 failures, 1 warning`),
the author-only close step (removed), the whole-file `current.md` write (now an in-place edit), `symbolic-ref`
(now `git init -b main`), and the commit stat (new assertion). Then the new test, `bun test
tests/walkthrough.test.ts`: `4 pass 0 fail`; `node --test`: `ℹ pass 4 ℹ fail 0 ℹ skipped 0`. Mutants kept:
no report, no `gate --full`; new: no reviewer's row (`closeCode 2`, `its only verdicts are from the pass that wrote the code (only implementer)`).

Page against run, after the last edit (`bash r2/diffpages2.sh`, reruns all three scripts):

```
docs/wiki/Getting-Started.md: 12 blocks, 0 differing
README.md: 5 blocks, 0 differing
docs/wiki/The-Agents.md: 2 blocks, 0 differing
GREET_PY_0 / TEST_PY_0 / GREET_PY / REPORT / TEST_PY: same as the page
```

The last five lines compare the test's constants with the page's fenced blocks. Shas and `Ran N tests in <t>s`
are normalised; `...` on a page matches any lines (the elided lines are `[ok]` lines, the store and state
sections, and the unittest output).

Verify: `npm run typecheck` exit 0; `./bin/mstack lint-plugin .` `PASSED - 0 failures, 0 warnings`;
`./bin/mstack gate` `PASSED - 0 failures, 0 warnings`; `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`
`109 relative links checked, 0 broken`; `npm run test:bun` `883 pass 0 fail`; `npm run test:node` `ℹ pass 883 ℹ fail 0` (882 before, 883 now).

Where the reviewer's `gate --full` sits: Getting-Started, block "The close is audited", after the
`reviewing` move; The-Agents, second block, same place. Both print `[ok]    python3 -m unittest test_greet -v`
and `PASSED - 0 failures, 1 warning` (the README has no `gate --full`: its item has no verification).

### Page instructions against the script, in page order

**Getting-Started** (`r2/gs2.sh`): `git init -b main` `:9`; `greet.py`, `test_greet.py` as shown (python blocks 1, 2) `:10`;
`git add -A`, `git commit -m "init"` `:11`; `mstack setup` `:13`; `mstack gate` `:14`; add and commit the store `:15`;
`state add` `:25`; `git switch -c` `:26`; `state set in_progress` `:27`; `mstack gate` (red) `:29`; edit the Item line `:31`;
edit the Next step line `:32`; replace `greet.py`, `test_greet.py` (python blocks 3, 4) `:34`; run flag and unittest `:35`;
the report (markdown block) `:37`; commit work `:40`; implementer's row `:41`; `done` refused `:47`; `reviewing` `:48`;
`gate --full` `:51`; reviewer's row `:52`; `verifying` `:57`; `done --closed-by` `:58`; `mstack gate` `:59`;
commit the close, add README, commit, `ledger check` `:62-64`.

**README** (`r2/rd2.sh`): the starting point (Getting-Started's two files, committed, `setup` run) `:10-13`; `state add` `:20`;
`in_progress` `:21`; the work (Getting-Started's final files) `:23`; `done` refused `:24`; the report (markdown block) `:26`;
`git add -A`, `git commit` `:29`; implementer's row `:30`; `reviewing` `:35`; `verifying` `:36`; `done` refused `:37`;
reviewer's row `:39`; `done` `:44`. Left at the end: `M .mstack/ledger.tsv`, `M .mstack/state.json`, both rows at the commit with the work (`git log`: 5ff174a, 6035143).

**The-Agents** (`r2/ag2.sh`): premises = Getting-Started's steps up to the `reviewing` move, plus the reviewer's report file (the
sentence on the page); implementer's row; `done --force` refused `:50`; `gate --full` `:52`; reviewer's row `:53`;
`verifying` `:57`; `done` `:58`; `mstack gate` `:59`.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | the Getting-Started sequence, every step with its exit code; the work commit's stat | tests/walkthrough.test.ts:208, tests/walkthrough.test.ts:142 |
| A2 | n/a: page against run, r2/diffpages2.sh over the three pages (scratchpad, item 97 files the repository script) | n/a: r2/diffpages2.sh, output above |
| A3 | the rerunning test and its three refusal mutants (no report, no gate --full, no reviewer's row) | tests/walkthrough.test.ts:208, tests/walkthrough.test.ts:213, tests/walkthrough.test.ts:219, tests/walkthrough.test.ts:225 |
| A4 | the base line and the two-warning gate asserted; setup output and commit counts by diffpages2 | tests/walkthrough.test.ts:123, tests/walkthrough.test.ts:106 |

Lines printed back: `:106` `assert.match(mstack("gate").out, /PASSED - 0 failures, 2 warnings/);`, `:123` `assert.match(open.out, /base: \(unset\) -> "[0-9a-f]{40}"/);`,
`:142` the `5 files changed, 37 insertions(+), 6 deletions(-)` assertion, `:208`, `:213`, `:219`, `:225` the four `walk(` lines.
