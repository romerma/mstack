# Item 96: walkthroughs-after-closing-checks, implementation report

## What changed

The three first-item walkthroughs now run as written. Each page shows the steps a close needs, in the order the workflow takes them, and every console block of each came from one real run per page. A new test runs the Getting-Started sequence through the CLI. Scratch scripts and outputs: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl96/` (`red_gs.sh`, `red_rd.sh`, `red_ag.sh` with `.out`; `gs.sh`, `rd.sh`, `ag.sh` with `.run`; `diffpages.sh`, `diffpages.mjs`, `fill.py`).

Flows decided (decision row filed, phase implement):
- **Getting-Started**: the implementer writes `.mstack/progress/impl_greet-flag.md` (shown, cut to the table) before the work commit, so one commit carries both. The refusal at `done` on the implementer's row alone stays, and is the real first refusal. The reviewer then runs `mstack gate --full` (red for one reason, the missing second row, which the page says), records its own row, and closes. Gate --full is the reviewer's step so the receipt and the row come from a run the reviewer saw.
- **README**: the item has no `--verification`, so no gate --full. Added: the report, the `reviewing` and `verifying` moves the `# from verifying` comment hid, the reviewer's row and the accepted close. Heading is now "end to end" (it said five commands).
- **The-Agents**: one sentence for the report and the item at `verifying`; the reviewer's block gets `mstack gate --full` before its row.

## Files

docs/wiki/Getting-Started.md, README.md, docs/wiki/The-Agents.md, tests/walkthrough.test.ts (new), CHANGELOG.md, examples/notes-cli/README.md (its `--evidence x` is refused by the ledger today; now a real command), .mstack/decisions.tsv, this report.

## Commands

First refusal each page hit, followed literally at base (red; full outputs in `red_*.out`):
- Getting-Started, at the reviewer's close: `mstack: greet-flag cannot close: \`python3 -m unittest test_greet -v\` has never been executed; it has no implementation report to read, .mstack/progress/impl_greet-flag.md or a later round of it`
- README, at the reviewer's close: `mstack: greet-flag cannot close: it has no implementation report to read, .mstack/progress/impl_greet-flag.md or a later round of it`
- The-Agents, at the reviewer's close: the same two-part line as Getting-Started.

Literal-follow table (before; "same" means the page's block matched the run):

| Page, step | Page showed | Happened | |
|---|---|---|---|
| GS `mstack setup` | 6 lines | 9 lines (costs.tsv, .gitattributes, new .gitignore text) | different |
| GS store commit | 6 files, 56 insertions | 8 files, 64 insertions | different |
| GS move to in_progress | 2 lines | adds `base:` line | different |
| GS gate, add, illegal done, reviewing, verifying, author-only refusal | as shown | as shown | same |
| GS reviewer row, then close | `done` | refused (above) | different |
| README add, illegal done, author-only refusal | as shown | as shown (plus `base:`) | same except base |
| README reviewer row, then close | `done` | refused (above) | different |
| AG implementer row, forced close | refusal | refusal | same |
| AG reviewer row, close | `done` | refused (above) | different |

Now, `bash .../diffpages.sh` (runs the three scripts fresh, then diffs):
```
docs/wiki/Getting-Started.md: 13 blocks, 0 differing
README.md: 5 blocks, 0 differing
docs/wiki/The-Agents.md: 2 blocks, 0 differing
```
Normalised: shas (hex of 7 to 40 chars with a digit, pages keep the run's real values), `Ran N tests in <t>s`, `\` continuations joined, blank lines before a `$` line ignored. A `...` line in a page matches any run of lines (the pages already elided gate output that way; kept on `gate --full` and two gates). No temporary paths or timestamps appear in any block. The same script run against the old Getting-Started: 12 of 12 blocks differ, so the diff does bite.

Cross-checks (`rg -n "state set .*--status done|closed-by" README.md docs/wiki/*.md examples`): references, not walkthroughs a reader follows, left alone: The-CLI.md:202 and How-A-Work-Item-Flows.md:76 (the illegal-transition refusal, still true); Gates-and-Hooks.md:294, 343, 579 and README's receipt block (refusals of other items with their own setup, the receipt message still matches `src/verification.ts:400`); The-CLI.md:404-421 (spec-size). `examples/notes-cli` ships a store but no closing script; its "break it on purpose" lines were run in a copy: `--evidence x` was refused, fixed. Links: `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`: 107 checked, 0 broken.

Test, red then green (bun): the main test with the report step dropped fails at the close (`closeCode` 2, `no implementation report`); with `gate --full` dropped it fails with `has never been executed`; both are now kept as tests of the refusals. Skip: with `PATH=/nonexistent` both runtimes report 3 skipped (bun ignores the `skip` option, so `test.skip` is chosen). CI is `ubuntu-latest` (`.github/workflows`, which already runs python3 at line 39), which ships python3.

Suite: bun 882 pass (879 before, plus 3), node 882 pass. typecheck, `lint-plugin .`: clean.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | the Getting-Started sequence, every step with its exit code | tests/walkthrough.test.ts:202 |
| A2 | n/a: pages checked by `diffpages.sh` run fresh, 0 of 20 blocks differ | n/a: diffpages.sh over the three pages, output above |
| A3 | the rerunning test, and its two refusal mutants | tests/walkthrough.test.ts:202, tests/walkthrough.test.ts:207, tests/walkthrough.test.ts:213 |
| A4 | the base line and the two-warning gate asserted; the setup output and commit counts by diffpages | tests/walkthrough.test.ts:120, tests/walkthrough.test.ts:103 |
