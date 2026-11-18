# Review - walkthroughs-after-closing-checks (round 2)

**Verdict:** CHANGES_REQUESTED

Round 2, reviewing alone, at `73fa55b` (round diff `de06979..73fa55b`). Every run of mine is under
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review96r2/`
(called `r2r/` below). `gs.sh`, `rd.sh` and `ag.sh` follow the three pages from the page text alone. Each command is typed as the page shows it and
run through a `mstack` shim that execs this checkout's `bin/mstack`, with `HOME` and git config in `r2r/`. Each shown file is written with
exactly its content, and `current.md` is edited in place, two lines. `check.py` matches each page `$` command to the run step with the same
text and checks every shown output line. Shas and `Ran N tests in <t>s` are normalised. `...` allows a gap. With no `...`, the shown lines must be the whole output.
`probe.sh`, `claims.sh`, `mutants.sh` and `five.sh` hold the other runs.

## Changes required

1. **docs/wiki/Getting-Started.md:295, the work commit's stat and file list. They reproduce only when python3 keeps its bytecode out of the work tree.**
   Repro: `TAG=gsbrew EXTRA_PATH=r2r/bin-brew bash r2r/gs.sh`. This is the page as written, with Homebrew `python3` 3.15.2 first on PATH. Before
   `git add -A`, `git status --short --untracked-files=all` lists `?? __pycache__/greet.cpython-315.pyc` and
   `?? __pycache__/test_greet.cpython-315.pyc` (from the page's `python3 -m unittest test_greet -v`). Then:
   ```
   page: 5 files changed, 37 insertions(+), 6 deletions(-)
          create mode 100644 .mstack/progress/impl_greet-flag.md
   run:  7 files changed, 37 insertions(+), 6 deletions(-)
          create mode 100644 .mstack/progress/impl_greet-flag.md
          create mode 100644 __pycache__/greet.cpython-315.pyc
          create mode 100644 __pycache__/test_greet.cpython-315.pyc
   ```
   The page's lines appear only with this machine's `/usr/bin/python3` (Apple 3.9.6). It prints `sys.pycache_prefix` =
   `~/Library/Caches/com.apple.python`, so its bytecode lands outside the repository. CPython's default (`pycache_prefix` None, as in
   Homebrew's build here) writes `__pycache__/` next to the sources. The repository the page now shows (:43-82) has no
   `.gitignore`, so `git add -A` makes the onboarding reader commit bytecode. The test cannot see this.
   `tests/walkthrough.test.ts:22` sets `PYTHONDONTWRITEBYTECODE: "1"`, which a reader does not have. Mutant M5b removes that variable and puts
   Homebrew python3 first, and the stat assertion at `:142` fails on both runtimes with
   `actual: "... 7 files changed, 37 insertions(+), 6 deletions(-)\n create mode 100644 .mstack/progress/impl_greet-flag.md\n create mode 100644 __pycache__/greet.cpython-315.pyc ..."`.
   With the variable kept (M6) the test passes on that same python. Round 1 blocked on this line, and CHANGELOG.md:314-315 now
   says the stat is "the one a reader gets".
   Fix: put a `.gitignore` holding `__pycache__/` in "The repository this page starts from", committed in the `init` commit. Rerun the page.
   Drop `PYTHONDONTWRITEBYTECODE` from the test's `ENV`, so the test makes the commit a reader makes.

## Non-blocking findings (to file)

1. **The unittest lines (Getting-Started.md:259-260) are Python 3.9's format.** 3.15.2 prints
   `test_default (test_greet.TestGreet.test_default) ... ok` (`r2r/gsbrew/log` step 20), and the format has been the same since 3.11. This is the first
   difference with Homebrew python3, and it predates this item (`git show c6e35e9:docs/wiki/Getting-Started.md`:178 has the same
   format). One clause naming the Python the transcript came from would cover it.
2. **The dropped block's prose, and the premise of decisions.tsv:253.** Getting-Started.md:331-333 says that with only the implementer's
   row, "`state set --status done` refuses with `its only verdicts are from the pass that wrote the code (only implementer)`".
   The quote is exact: `r2r/probe/log` step 21, at `verifying`, prints `mstack: greet-flag cannot close: its only verdicts are from the pass that wrote the code (only implementer)`.
   But the page has the item at `reviewing` there, and at `reviewing` a plain close prints something else (step 14):
   `mstack: reviewing -> done is not a legal transition`. Row 253 says the refusal "can only be reached at verifying with the reviewer's
   row absent". That is not so. `done --force` at `reviewing`, before the reviewer's `gate --full`, prints the verdict refusal (step 16).
   The-Agents.md:83-85 shows exactly that, and the round 2 report says so ("at reviewing, the close check refuses on the verdict, same message").
   Restoring the block as that forced close, at `reviewing` before the reviewer runs, keeps the agents' order. It also shows the page's own
   claim "`--force` does not get past it" (:333), which the page now makes without showing. A superseding `implement` row would correct 253.
3. **The README's reviewer acts at `verifying`, where its own first command is red.** README.md:237-253 moves the item to `verifying`, refuses the close, then has
   "A reviewer that did not write the code" record its row. At that point `mstack gate` exits 1 (`r2r/rd_probe/log` step 19,
   `PROBE=1 STORE_COMMITTED=1 TAG=rd_probe bash r2r/rd.sh`):
   `[fail]  1 greet-flag (verifying) is active but progress/current.md is not: the Item line still says _none_; ...` and
   `[fail]  1 greet-flag (verifying) is one step from done, and its only verdicts are from the pass that wrote the code (only implementer)`,
   `FAILED - 2 failures, 3 warnings`. The README shows no gate, so no shown line is wrong. But `agents/reviewer.md:143` ("A red
   gate stops the session") would stop that reviewer, and the order differs from the other two pages. The README never fills `current.md`.
4. **The "1 warning" the reviewer's `gate --full` prints is not named on the page.** At `reviewing` (Getting-Started.md:345) it is
   `[warn]  2 uncommitted change(s); expected mid-session, not at close`: ledger.tsv with the implementer's row, and state.json
   (`r2r/gs/log` step 28). On The-Agents.md:100 it is `3 uncommitted change(s)`, because the reviewer's report is also uncommitted. Both are hidden under `...`. Only
   :137-138 explains warnings, and only the two after `setup`. The gate right after the close (:366) prints the same "not at close" warning,
   and the next section then commits. One clause would answer the first reader's question.
5. **The-Agents.md:75's premise has the reviewer's report written before its `gate --full`.** `agents/reviewer.md` writes the report after the
   run and records the row once the report exists. It is a premise sentence, and nothing checks the file. Minor.

## Round 1's findings

| R1 finding | State at 73fa55b | Evidence |
|---|---|---|
| blocking 1, current.md whole-file | fixed | `r2r/gs/log` step 15 diff: only `9c9` (Item) and `33c33` (Next step) change. Step 24: `5 files changed, 37 insertions(+), 6 deletions(-)`. The test edits in place (`walkthrough.test.ts:129-132`), and M1 shows it catches a whole-file write |
| nb 1, approval after a red gate | fixed on Getting-Started and The-Agents | `gate --full` at `reviewing`: rc 0, `PASSED - 0 failures, 1 warning` (gs step 28, ag step 21), then the row. The README keeps the old position without a gate (nb 3 above) |
| nb 2, README commit | fixed | rd step 12 commits the work. Both rows are `at caec4626`, `git show --stat` lists `greet.py`, `test_greet.py`, `impl_greet-flag.md`, and `ledger check` prints `PASS test-verified at caec4626 by reviewer`. Left behind: ` M .mstack/ledger.tsv`, ` M .mstack/state.json` |
| nb 3, files shown | fixed | :55-77 and :223-250. In the shown final file, line 6 is `    def test_default(self):` and line 9 is `    def test_shout(self):`. A 7-line test file is refused at the close: `test_greet.py:9 is past the end of test_greet.py, which has 7 lines` (`r2r/claims/log` step 18), as :271-272 says |
| nb 4, repository script | filed as item 97 | `./bin/mstack state show 97`: `walkthrough-pages-checked-in-repo`, pending, two acceptance bullets |
| nb 5, The-Agents premise | fixed | Built from :71-75 alone (`ag.sh`). 12/12 lines match |
| nb 6, CHANGELOG | fixed | CHANGELOG.md:307-308: "Getting-Started and the README now show the report; The-Agents links to it." True (README.md:207-216, The-Agents.md:74) |
| nb 7, `git init` | fixed | :49-51 and :79-82 ran with rc 0, and `[main (root-commit) ...] init`. With `git init -b master` the gate prints `[warn]  on master; feature work belongs on its own branch`, as :45-46 says |

Rebuttals and rows since round 1: decisions.tsv:252 (design) matches what the diff does. On row 253, see nb 2. "Findings not
applied": none, apart from nb 4, which is item 97.

## Acceptance, quoted

**"docs/wiki/Getting-Started.md, README.md and docs/wiki/The-Agents.md walkthroughs are followed literally in a fresh repository, command by command, and every step succeeds or shows the refusal the page says it shows"**
- **Met.** Every exit code is as the page has it on all three pages: Getting-Started's refusals are rc 1 (gate, step 13), rc 2 (step 26) and rc 1 (`ledger check`, step 38),
  README's are rc 2 (steps 9 and 16), and The-Agents' is rc 2 (step 20). Everything else is rc 0. This also holds with Homebrew python3. The output that differs is blocking 1.

**"each page shows the report with its table and the verification run where a close needs them, from one real run"**
- **Met.** Getting-Started shows the report at :274-287 and `gate --full` at :341-345. The README shows the report at :207-216, and its item has no verification. Its
  close goes through with no receipt (rd step 18). The-Agents links to the report (accepted in round 1 per decisions.tsv:251) and shows `gate --full`.
  My runs reproduce every shown line with the default python3. The exception for other pythons is blocking 1.

**"a test or a script in the repository reruns the Getting-Started sequence, so a new closing check that breaks it is seen before a reader does"**
- **Met** by `tests/walkthrough.test.ts:208`. Mutants M2-M4 below are red. Its ENV differs from a reader's in one way that hides a page drift
  (blocking 1).

**"the older drift a literal run shows is corrected: mstack setup prints two more lines (costs.tsv, .gitattributes) and commits 8 files and 64 insertions where the page shows 6 and 56, and the move to in_progress prints a base line; at 7d71f2e the page's own close was already refused for a missing receipt and report"**
- **Met.** `setup` (gs step 06) prints the 9 lines of :91-100, the store commit (step 09) is `8 files changed, 64 insertions(+)`, and `in_progress` (step 12)
  prints `base: (unset) -> "<40 hex>"`. The close goes through (step 31, `status: "verifying" -> "done"`).

## Per-page counts (my reader runs)

| Page | Commands | Exit codes | Shown lines matched | First difference |
|---|---|---|---|---|
| Getting-Started, :43-397, `/usr/bin/python3` 3.9.6 | 26 `$` commands, plus 3 unprompted (`git init -b main`, `git add -A`, `git commit -m "init"`) | all as the page | **76/76** | none |
| Getting-Started, Homebrew python3 3.15.2 | same | all as the page | 68/76 | :259 `test_default (test_greet.TestGreet) ... ok` against run `test_default (test_greet.TestGreet.test_default) ... ok`; then :295 (blocking 1) |
| README, :172-262 (store uncommitted; also with the store committed) | 11 | all as the page | **17/17** (and 17/17) | none |
| The-Agents, :67-121 (also with Homebrew python3) | 7 | all as the page | **12/12** (and 12/12) | none |

The work commit stat `5 files changed, 37 insertions(+), 6 deletions(-)` appears with the default python3 only. The table's `:6` and `:9` are
the `def` lines of the shown file. Both README rows name the commit with the work. The-Agents is built from its sentence and nothing else.
`check.py` can fail: it reports the Homebrew differences above.

## Verification I ran

- **The reviewer's order.** Getting-Started and The-Agents: `gate --full` at `reviewing` exits 0 with `[ok]    python3 -m unittest test_greet -v` and
  `PASSED - 0 failures, 1 warning`. Then the reviewer's row, `verifying`, `done` and `gate` (rc 0, `[ok]    1 closed item(s) carry a ledger verdict`).
  No page shows a role approving after a red gate. The README shows no gate (nb 3). This order matches `agents/orchestrator.md:32-34`.
- **The three refusal tests** pass, and each asserts its message: `it has no implementation report to read`, ``python3 -m unittest test_greet -v` has never
  been executed``, `its only verdicts are from the pass that wrote the code (only implementer)`. The probe at `verifying` prints the last one
  exactly (probe step 21).
- **Mutants**, in a copy `r2r/copy`, each on bun and node (`r2r/mutants.out`). M0, unmutated: `4 pass 0 fail`, and node `ℹ pass 4`.
  - M1, the in-place edit swapped for round 1's whole-file write: the main test is red at `:142` with `actual: "... 5 files changed, 37 insertions(+), 32 deletions(-)..."`.
    The gate --full and reviewer's-row tests are red the same way. Bun `1 pass 3 fail`, node `ℹ fail 3`.
  - M2, the reviewer's `gate --full` removed from the main walk: `mstack: greet-flag cannot close on a verification that has not run: `python3 -m unittest test_greet -v` has never been executed`.
    Bun `3 pass 1 fail`, node `ℹ fail 1`.
  - M3, `src/closing.ts:195` author-only refusal shrunk away (`&& false`): the reviewer's-row test is red at `gate after the close: exit 1, wanted 0`.
    The close went through, and the gate's closed-item audit caught it. Red either way. Bun `3 pass 1 fail`, node `ℹ fail 1`.
  - M4, `src/rcheck.ts:161` missing-report refusal shrunk away (`return []`): the no-report test is red with `actual: 0, expected: 2`. Bun `3 pass 1 fail`, node `ℹ fail 1`.
  - M5a, no `PYTHONDONTWRITEBYTECODE`, Apple python3: green. M5b, the same with Homebrew python3 first: red at `:142` with `7 files changed` (blocking 1).
    M6, unmutated, Homebrew python3 first: green.
- **Five runs per runtime** of `tests/walkthrough.test.ts` in this checkout, with `HOME=` and `GIT_CONFIG_GLOBAL=/dev/null` (`r2r/five.out`). Bun: rc 0, `4 pass 0 fail`
  every run, 5-9s. Node 26.13.1: rc 0, `ℹ pass 4 ℹ fail 0 ℹ skipped 0` every run, 7-17s. Node 22.6.0 once: `# pass 4`, `# fail 0`.
  With python3 off PATH (`git`, `bun`, `node` and `/bin` only): bun prints `0 pass 4 skip 0 fail`, with each name ending
  `[skipped: python3 is not on PATH, and the page's verification command is python3 -m unittest]`. Node prints `ℹ skipped 4`, with the same names marked `# SKIP`.
- **Suite** (`r2r/suite_summary.txt`): `npm run typecheck` rc 0. `npm run test:bun` rc 0, `883 pass`, `0 fail`, `Ran 883 tests across 43 files. [202.86s]`.
  `npm run test:node` rc 0, `ℹ pass 883`, `ℹ fail 0`. `./bin/mstack lint-plugin .` rc 0, `PASSED - 0 failures, 0 warnings`.
  `node scripts/check-doc-links.mjs README.md docs/wiki/*.md` rc 0, `109 relative links checked, 0 broken`. `./bin/mstack gate` rc 0,
  `PASSED - 0 failures, 0 warnings`. `git status --short` here was empty before and after the suite. `./bin/mstack ledger check walkthroughs-after-closing-checks`
  printed `FAIL no verdict at 73fa55bb; 3 row(s) exist at other SHAs` before my row. The implementer's round 2 row is at 45a3a1d.
- **The round 2 report** is 8044 bytes, under the cap. I printed its citations, and they match its text: `:106` `assert.match(mstack("gate").out, /PASSED - 0 failures, 2 warnings/);`,
  `:123` the `base:` match, `:142` the stat match, and `:208`/`:213`/`:219`/`:225` the four `walk(` lines. I spot-checked its
  Getting-Started instruction-to-line list against `impl96r2/gs2.sh`, and all 25 entries are at the lines named: `:9` git init, `:31`/`:32` the two
  `sd -F` edits, `:51` `gate --full`, `:57` verifying, `:62-64`. Its `git init` and `git commit` carry `-q` where the page has none, and no output is shown for either.
  Its numbers (883 and 883, 109 links, lint and gate PASSED) match mine.

## Not checked

- Linux, Ubuntu CI, and distro Pythons. That they write `__pycache__/` into the tree follows from CPython's default `pycache_prefix`.
  I ran only Homebrew's build.
- `gate --full` in this checkout. It writes a receipt, and my brief limits me to read-only commands here, so I ran both suites directly instead.
- `/mstack:setup` inside Claude Code, where the README starts. Its seeding could change `added 1`.
- The implementer's `diffpages2.sh` output. I compared the pages with my own runs, not with theirs.
