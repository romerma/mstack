# Review - walkthroughs-after-closing-checks

**Verdict:** CHANGES_REQUESTED

Round 1, reviewing alone, at `55401b1` (base `c6e35e9`). Every run of mine is under
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review96/`
(called `review96/` below): `gs.sh`, `rd.sh`, `ag.sh` follow the three pages from the page text,
with outputs in `gs.out`, `rd.out` and `ag.out`. `mstack` there is `/Users/romerma/Code/mstack/bin/mstack`.

## Changes required

1. **docs/wiki/Getting-Started.md:219 shows a line a reader following the page does not get, and
   the run behind it skipped one of the page's steps.** The page says (line 172) "Fill in the Item line and
   the Next step in `.mstack/progress/current.md`". The implementer's run replaced the whole
   template with a 7-line file instead (`impl96/gs.sh:21`, `printf '# Current session\n\n- **Item:** ...' > .mstack/progress/current.md`),
   and that is where the page's `32 deletions` comes from. I used the implementer's own `greet.py` and
   `test_greet.py` (`impl96/lib.sh` `fresh`, `impl96/write_work.sh`) and filled in the two lines as the page
   says (`review96/stat.sh`):
   ```
   page:  5 files changed, 37 insertions(+), 32 deletions(-)
   run:   5 files changed, 37 insertions(+), 6 deletions(-)
   ```
   My own reader run (`review96/gs.out` step 13) prints the same `37 insertions(+), 6 deletions(-)`. This is the first
   place on any of the three pages where the output differs from the page. `diffpages.sh` cannot catch it,
   because its run deviates from the page in the same way. `tests/walkthrough.test.ts:125-128` copies the
   same deviation (it writes the whole file), so the test mirrors the run, not the page.
   Fix: rerun with the two lines edited in place (or change line 172 to say what the run does), paste
   the stat it prints, and make the test do the same edit. Non-blocking finding 3 below makes the stat
   reproducible for a reader as well.

## Non-blocking findings (to file)

1. **The reviewer approves right after a red `gate --full`, which `agents/reviewer.md` forbids.**
   `agents/reviewer.md:138` says "Never approve on a red gate.", and `:143` says "A red gate stops the session; never work around it."
   Its only exceptions (`:27-35`) are a bad requirement-to-test table and the budget. The pages
   (Getting-Started.md:268-281, The-Agents.md:88-103) put the reviewer's run at `verifying`, where the
   author-only finding is reported, and the reviewer records its row and closes straight after `FAILED`.
   The page also says "In a real session the reviewer is the `mstack:reviewer` agent" (`:301`). That
   agent, following its own file, would stop at this point. `agents/orchestrator.md:32-33` launches the reviewer while the item is
   `in_progress`/`reviewing`, and there the same `gate --full` is green. `review96/alt.sh`, from the same repository:
   `state set --status reviewing`, then `gate --full`, prints `PASSED - 0 failures, 1 warning`. Then
   `--status verifying`, then `done`, is refused with `its only verdicts are from the pass that wrote the code (only implementer)`.
   After the reviewer's row, `done` prints `status: "verifying" -> "done"`. The receipt survives the move. Running the reviewer at
   `reviewing` keeps the page's refusal and drops the red gate that needs explaining. The other way out is to add the
   author-only line at `verifying` to reviewer.md's list of exceptions. The page's explanation is
   accurate (the gate is red for that one reason only), and a first-time reader can follow it.
2. **README verdicts are recorded against a commit that does not contain the work.** The README run
   never commits. `review96/rd.out` steps 10-11: `git log` has the store commit at HEAD, both rows
   are `at 2e0cc864` (the README itself shows `60351430`, which equals its `base:` line at README.md:190), and
   `git status --short` lists `M greet.py`, `M test_greet.py` and `?? .mstack/progress/impl_greet-flag.md`. The item still closes and
   `gate` passes (`on main` plus 5 uncommitted changes, both warnings). The evidence text "2 tests, OK" is bound to
   a sha whose `test_greet.py` has one test. Getting-Started teaches the opposite ("Commit the work and the
   report, then record the verdict against the head SHA"). A new user should not be shown this.
   One `git add -A` / `git commit` step before the implementer's row fixes it and adds no explanation.
3. **Getting-Started does not show the code that its new table depends on.** The page never shows
   `greet.py` or `test_greet.py`. The table it now shows cites `test_greet.py:6` and `test_greet.py:9`, and the
   close checks that those lines exist in a test file. A reader whose test file is shorter is refused, and the
   page does not show that refusal (`review96/short.sh`, with a 7-line test file):
   `mstack: greet-flag cannot close: .mstack/progress/impl_greet-flag.md line 11 (A1): test_greet.py:9 is past the end of test_greet.py, which has 7 lines; ...`.
   The page also does not say that `Where` means a line in *your* test file. Showing the two files
   (about 10 lines each) would fix this and make the commit stat reproducible.
4. **Only the scratchpad compares page text against a run.** The test checks exit codes and the lines that carry the
   point of each step, for Getting-Started only. `diffpages.sh` and `diffpages.mjs`, and the README and The-Agents reruns, exist only in
   `impl96/`. When the scratchpad is cleared, the next output drift like the one criterion 4 fixed
   (new `setup` lines, commit counts) goes unseen again. So does any closing check that breaks only the README flow,
   which has no verification and no commit. A committed `scripts/` check, or a test that reads the page's
   blocks, would keep both.
5. **The-Agents' premises are not on the page.** The reader needs Getting-Started's item, *with* its
   `--verification`, so that the `[ok] python3 -m unittest test_greet -v` line appears, and a filled `current.md`, so that the gate
   is red for one reason. The page says only "the item is at `verifying` and the implementer's report ... is on
   disk". The reviewer's evidence `.mstack/progress/review_greet-flag.md` (The-Agents.md:103) is a file the page never
   writes. The implementer's run wrote it off the page (`impl96/ag.sh`, a `printf ... > .mstack/progress/review_greet-flag.md`). The ledger does not
   check it, so my run passes without it (`review96/ag.out` step 04). That evidence string predates this item.
6. **CHANGELOG.md:307 says "Each page now shows the report".** The-Agents names the report and links to it
   (The-Agents.md:71-73); it does not show it. "shows or links" would be accurate.
7. **Older gaps the brief asked about.** "Takes a clean repository from nothing" (Getting-Started.md:9) needs a
   `git init`, the two files, and an initial commit that the page does not show. `[main 160a631]` is not a root commit,
   and the `1 uncommitted change(s)` warning requires the two files to be committed already. The page also assumes the default branch
   is `main`, while a stock git config gives `master`, and the gate's line then reads `on master`.

## Acceptance, quoted

**"docs/wiki/Getting-Started.md, README.md and docs/wiki/The-Agents.md walkthroughs are followed literally in a fresh repository, command by command, and every step succeeds or shows the refusal the page says it shows"**
- **Met** for exit codes and refusals. On all three pages every command succeeds or refuses exactly as
  shown (tables below). One shown output line does not reproduce (blocking finding 1), and the off-page prerequisites are listed in
  non-blocking findings 3, 5 and 7.

**"each page shows the report with its table and the verification run where a close needs them, from one real run"**
- **Met** for Getting-Started (lines 194-211 and 274-281) and the README (lines 201-214; the README item has no verification, and its close goes through
  without a run, `rd.out` step 09). The-Agents shows `gate --full` and links to the report rather than showing it. I accept
  that per the `implement` row (decisions.tsv:251). "From one real run" is true, but in Getting-Started's run one step was not the page's step
  (blocking finding 1).

**"a test or a script in the repository reruns the Getting-Started sequence, so a new closing check that breaks it is seen before a reader does"**
- **Met** by `tests/walkthrough.test.ts:202`. Tightening a closing check in `src/` turns it red (mutant M4 below). The
  scripts that compare page text with a run are scratchpad-only (non-blocking finding 4).

**"the older drift a literal run shows is corrected: mstack setup prints two more lines (costs.tsv, .gitattributes) and commits 8 files and 64 insertions where the page shows 6 and 56, and the move to in_progress prints a base line; at 7d71f2e the page's own close was already refused for a missing receipt and report"**
- **Met.** `gs.out` lines 2-11 match Getting-Started.md:50-59, lines 44-53 match :103-112 (`8 files changed, 64 insertions(+)`), and line 71 has the `base:`
  line, as do the README (:190) and `rd.out` step 02. The close now goes through: `gs.out` step 21 prints `status: "verifying" -> "done"`.

## Requirement to test (implementer's table, checked)

| R | Cited | Line printed | Holds? |
|---|---|---|---|
| A1 | walkthrough.test.ts:202 | `walk(\`Getting-Started, every command in order, ends in the accepted close and a green gate${SKIPPED}\`, ...` | yes, it is the main test, red under M1-M4 |
| A2 | n/a: diffpages.sh | (not in the repository) | the scratchpad run agrees with the page except :219 (blocking finding 1) |
| A3 | :202, :207, :213 | the main test and the two refusal tests | yes |
| A4 | :120, :103 | `assert.match(open.out, /base: \(unset\) -> "[0-9a-f]{40}"/);` and `assert.match(mstack("gate").out, /PASSED - 0 failures, 2 warnings/);` | the base line and the gate summary only; the setup lines and the 8/64 counts are checked by the scratchpad scripts alone |

## Per-page steps (my reader runs)

Off-page setup I had to supply, because a reader would have to: `git init -b main`, `greet.py` and `test_greet.py`
(my own versions; the table's :6 and :9 happen to fit them), an initial commit, the two `current.md` lines, and the work.

**Getting-Started** (`gs.out`, 28 steps). "ok" means every line the page shows is in the output, shas and timings apart.

| Step | Exit (as page) | Lines |
|---|---|---|
| setup; gate; add and commit the store | 0; 0; 0 | ok (9 setup lines, 2 warnings, 8 files and 64 insertions) |
| state add; switch; in_progress | 0; 0; 0 | ok, `base:` line |
| gate (current.md untouched) | 1 | ok (`[fail]` line, `FAILED - 1 failure, 1 warning`) |
| greet.py --shout; unittest | 0; 0 | ok |
| add and commit the work | 0 | **differs**: `37 insertions(+), 6 deletions(-)` against the page's `32 deletions(-)` |
| ledger record, implementer | 0 | ok |
| done (shortcut); reviewing; verifying | 2; 0; 0 | ok |
| done (author-only) | 2 | ok |
| gate --full | 1 | ok; the `...` hides the workspace warning and the unittest output |
| ledger record, reviewer; done; gate | 0; 0; 0 | ok (`PASSED - 0 failures, 1 warning`) |
| commit close; README.md; commit; ledger check | 0; 0; 0; 1 | ok (`2 files changed, 5 insertions(+), 2 deletions(-)`, `FAIL no verdict at ...`) |

**README** (`rd.out`): state add 0, in_progress 0 (`base:`), done 2, ledger 0, reviewing 0, verifying 0,
done 2 (author-only), reviewer ledger 0, done 0. Every line ok; see non-blocking finding 2 for the state the run leaves.
**The-Agents** (`ag.out`, from Getting-Started's item at `verifying`, report committed): ledger 0, forced done 2, gate --full 1,
ledger 0, done 0, gate 0. Every line ok.

Every output line on each page, looked up in my run (`review96/lines.py`): Getting-Started has 80 lines and 1 missing (:219),
README 16 and 0, The-Agents 12 and 0. The implementer's `diffpages.sh`, run from a copy in `review96/dp/`, reports
`13 blocks, 0 differing` / `5 blocks, 0 differing` / `2 blocks, 0 differing`. It agrees with my run on everything but :219,
for the reason in blocking finding 1. What it does not compare, which I checked by hand:
- **The `...` lines** hide only `[ok]` lines, the `[warn] N uncommitted change(s)` lines, the `-- verification` header and the
  unittest output. No `[fail]` line is hidden, and each block's `PASSED`/`FAILED` count pins that.
- **Normalisations**: shas, `Ran N tests in <t>s`, whitespace inside command lines, and blank lines before a `$`. All are cosmetic.
- **Not compared at all**: exit codes (its `sh_expect` checks them), the prose, and whether a sha means the same commit in
  every block. By hand: Getting-Started 160a631 → a397721c → 5ebbdfb → c0d7f3ff, README 60351430 three times,
  The-Agents e2defa4e twice. All are consistent.
- **The markdown block** is compared with the script's own heredoc copy, so that comparison cannot fail.

## Verification I ran

- `tests/walkthrough.test.ts`, with `HOME=` and `GIT_CONFIG_GLOBAL=/dev/null`, five times per runtime: bun exited 0 in 4.07-4.12s each run,
  `3 pass`; node exited 0 in 6.06-6.11s (`duration_ms 6099.6` ...). The timeouts are 180s per test and 30s per spawn.
- With python3 off PATH (PATH holding only git, bun, node and `/bin`): bun reports `0 pass 3 skip 0 fail`, and outside Claude Code's agent mode
  prints `(skip) Getting-Started, every command in order, ... [skipped: python3 is not on PATH, and the page's verification command is python3 -m unittest]`.
  node reports `ℹ skipped 3`, with the same names marked `# SKIP`.
- Mutants, in a copy under `review96/copy`, each run on both runtimes (`mutants.out`). All four turn the main test red:
  - M1, the main walk writes no report: `AssertionError: The input did not match the regular expression /FAILED - 1 failure, 1 warning/` (gate --full gains a second failure); node `ℹ fail 1`.
  - M2, `gate --full` removed: `AssertionError: mstack: greet-flag cannot close on a verification that has not run: \`python3 -m unittest test_greet -v\` has never been executed`; node `ℹ fail 1`.
  - M3, the reviewer's row removed: `AssertionError: mstack: greet-flag cannot close: its only verdicts are from the pass that wrote the code (only implementer)`; all 3 tests red on both runtimes.
  - M4, `MAX_REPORT_BYTES = 100` in `src/budget.ts`: the main test fails at `/FAILED - 1 failure, 1 warning/`, and the gate --full refusal test sees `its report .mstack/progress/impl_greet-flag.md is 288 bytes, over the 100 byte limit`; node `ℹ fail 2`.
- `examples/notes-cli`, in a copy: `--evidence x` gives `mstack: a ledger row needs evidence, and "x" is not any` (exit 2). The new line gives
  `recorded test-verified for cli-search at 23fc0558` (exit 0), and `ledger check ... 0000...` prints `FAIL no verdict at 00000000` (exit 1).
  `python3 -m unittest` there: `Ran 10 tests`, `OK`, so the new evidence is a real command.
- Other places that show a close, which I read: The-CLI.md:202 and How-A-Work-Item-Flows.md:76 (the illegal-transition refusal), and
  Gates-and-Hooks.md:294, :343, :579 and README.md:296 (refusals of other items, each with its own setup). These are reference
  lines, not walkthroughs. README's receipt text matches `src/cli.ts:736` and `src/verification.ts:400`, hand-wrapped at :297-300 before this item.
- `rg -n -i "five commands|in-five-commands|first-item-end-to-end|your-first-item" --glob '!.mstack/**' .` finds only
  CHANGELOG.md:433, a past release's prose and not a link. The README grew by 39 lines (497 to 536). Each new block is a command
  the close needs.
- Suite: `npm run typecheck` exits 0. `./bin/mstack lint-plugin .` prints `PASSED - 0 failures, 0 warnings`. The doc-link check prints `107 relative links checked, 0 broken`.
  `npm run test:bun` gives `882 pass 0 fail` in 199s, with the walkthrough taking about 4s of that. `npm run test:node` gives `ℹ pass 882 ℹ fail 0` in 43s.
- `./bin/mstack gate` here exits 0 with `PASSED - 0 failures, 0 warnings`. `ledger check` at 55401b1 printed `FAIL no verdict at 55401b1f` before
  my row; the implementer's row is at 1fb70c7.
- The implementer's report is 5839 bytes.

## Not checked

- `gate --full` in this checkout. It writes the receipt file, and my brief limits me to read-only commands here, so I ran both suites directly instead.
- Node 22.6, the version CI pins; locally I have node v26.13.1 and bun 1.3.11.
- Ubuntu CI.
- `/mstack:setup` inside Claude Code, where the README begins. Its seeding could make `added 1` print a different id.
- The implementer's claim that the old Getting-Started gives "12 of 12 blocks differ".
