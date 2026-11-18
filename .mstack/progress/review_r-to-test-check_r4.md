# Review - r-to-test-check (item 41, round 4)

**Verdict:** CHANGES_REQUESTED

Reviewed `git diff 43f34c4..f7075c5` at head `f7075c5d0bac664185ccb4316c965a14f9744218`. All three round 3 findings are fixed. The FIFO test moved and its body is unchanged. It still kills the mutant on bun and node. The CHANGELOG names all three markers correctly, and the note is right. Every check is green at 797. One sentence in the new round 3 report is false: it calls a comment line a table row. The fix is one character.

Scratch: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review41r4/` (`p1.sh` to `p6.sh`, `p4.ts`, `p6.ts`, `verify.sh`, each with its `.out`).

## Changes required

1. **`.mstack/progress/impl_r-to-test-check_r3.md:52` cites `tests/pathclass.test.ts:37`, and `:55-57` says both `tests/pathclass.test.ts` citations are "rows of the table that makes one test per path". Line 37 is not a row. It is a comment:**
   ```
   A2  tests/pathclass.test.ts:37           // Maven and Gradle: **/src/test/**, which also matches with zero directories before src
   A2  tests/pathclass.test.ts:77           ["config/locales/devise.cy.yml", "code"],
   ```
   The table loop (`tests/pathclass.test.ts:92-94`) makes a test from each `[path, expected]` element, and a comment makes none. So the report says it read back every citation and found each one a test, a loop or a row, and for `:37` that is false. The gate passes because the line exists, which is the limit this report itself describes at `:19-20`. The citation is unchanged since round 2 (`impl_r-to-test-check_r2.md:106` cites the same line). That report never calls it a row, so it is not false there and is not a regression of the move.
   **Fix:** cite `tests/pathclass.test.ts:38` (`["src/test/java/com/x/GreetTest.java", "test"]`, the first new-layout row) in the round 3 table. The alternative is to say in `:55-57` that `:37` is the comment opening the new-layout rows. The round 2 table may keep `:37`.

## Check 1: every citation, read back at head (`p1.out`)

The round 3 report, the one the gate reads:
```
A1  tests/rtable.test.ts:54            test("an escaped pipe stays inside its cell, unescaped", () => {
A1  tests/rtable.test.ts:58            test("a pipe inside a backtick code span does not split the cell", () => {
A1  tests/rtable.test.ts:64            test("a backtick with no closing one is a literal and the pipe after it splits", () => {
A1  tests/rtable.test.ts:68            test("with two tables the last one wins", () => {
A1  tests/r-table-check.test.ts:317    test("the highest round wins: round 1 good, round 2 missing a row fails; round 2 good passes", T, () => {
A2  tests/r-table-check.test.ts:98     test("a good table passes the gate at reviewing and at verifying, and the item may close", T, () => {
A2  tests/r-table-check.test.ts:111    test("the spec path reads R-ids from spec.md, and a good table over them passes", T, () => {
A2  tests/r-table-check.test.ts:204    for (const p of problems) {
A2  tests/r-table-check.test.ts:223    test("a citation may carry a column, which is ignored: the line is what is checked", T, () => {
A2  tests/r-table-check.test.ts:238    test("a citation that names a directory says so, and one that names a file it cannot read says that", T, () =>
A2  tests/r-table-check.test.ts:255    test("a symlink inside tests/ that points out of the store's root is outside it", T, () => {
A2  tests/r-table-check.test.ts:270    test("the last line of a file with no trailing newline is a line", T, () => {
A2  tests/r-table-check.test.ts:281    test("an n/a reason of 12 characters passes, and the count is of the trimmed reason", T, () => {
A2  tests/r-table-check.test.ts:292    test("an item with no report at all fails and names the file it looked for", T, () => {
A2  tests/r-table-check.test.ts:300    test("every problem is reported, not only the first", T, () => {
A2  tests/r-table-check.test.ts:368    test("--force past the table only: the refusal, the printed line and closed_by name the table, not a verificat
A2  tests/r-table-check.test.ts:386    test("--force past a verification only keeps its existing words, with a good table", T, () => {
A2  tests/r-table-check.test.ts:396    test("--force past both says both, verification first, and a later note keeps the marker", T, () => {
A2  tests/r-table-check.test.ts:426    test("on the spec path an id with no row and an id the spec lacks are both reported", T, () => {
A2  tests/r-table-check.test.ts:434    test("on the spec path the acceptance bullets are not ids: A1 is not an id of the item", T, () => {
A2  tests/r-table-check.test.ts:481    test("a citation that names a FIFO is refused without being opened, so the gate cannot block on it", T, () =>
A2  tests/pathclass.test.ts:37           // Maven and Gradle: **/src/test/**, which also matches with zero directories before src
A2  tests/pathclass.test.ts:77           ["config/locales/devise.cy.yml", "code"],
A2  tests/item-size-base.test.ts:393   test("a change under src/test/ (Maven and Gradle) does not count as code", GATE, () => {
A3  tests/r-table-check.test.ts:337    test("an item with no base is never checked, whatever its report says", T, () => {
A3  tests/r-table-check.test.ts:350    test("a done item with a report that has no table is left alone: its note can be edited, unmarked", T, () => {
A3  tests/r-table-check.test.ts:458    test("closingProblems reads nothing for a done or cancelled item, whatever its report says", T, () => {
```
- 26 of 27 citations land on the test, loop or row their Test cell names. `:204` is the loop that makes one test per problem at reviewing, verifying and `done` (`tests/r-table-check.test.ts:204-221`), and `pathclass:77` is a Welsh-locale row. `:37` is the exception (finding 1).
- Every id has a row, and each row's tests exercise its criterion. `./bin/mstack state show 41` lists three acceptance bullets. A1 is the parser: escaped pipe, a pipe in a code span, an unclosed backtick, last table wins, highest round wins. A2 is the gate and `done` check over each problem kind, including the FIFO test now at `:481`. A3 is no base, a closed item, and `closingProblems` for done or cancelled. The prose half of A3 is the `rg` command quoted in the round 2 report.
- The gate reads this report (`p6.out`, on a scratch copy of HEAD). As committed: `[]`. With `:481` changed to `:9999`: `.mstack/progress/impl_r-to-test-check_r3.md line 52 (A2): tests/r-table-check.test.ts:9999 is past the end of tests/r-table-check.test.ts, which has 489 lines`. `./bin/mstack gate` in this checkout: `PASSED - 0 failures, 0 warnings`.

The round 2 report: all 25 citations print the same lines as above, without `:481` and `pathclass:77` (`p1.out`, second half). The file at head differs from `27b7159`, the tree that report was written for, only by the FIFO test appended after line 479 (`p2.out`), so every round 2 citation is back on its test.

## Check 2: the FIFO test after the move (`p2.out`, `p3b.out`)
```
removed lines:        9  added lines:        9
bodies identical
numstat: 10	10	tests/r-table-check.test.ts
=== the file at f7075c5 vs at 27b7159 (the round 2 tree): expect only the FIFO test appended
@@ -477,3 +477,13 @@ test("a report file for a lens is not the implementation report", T, () => {
+
+test("a citation that names a FIFO is refused without being opened, so the gate cannot block on it", T, () => {
...
```
The mutant is a copy of `f7075c5` (`git archive`) with only `src/rcheck.ts:106` (`if (!stat.isFile()) return ...`) removed:
```
##### mut: the FIFO test alone
--- mut bun-fifo: exit 1 after 10 s
AssertionError: the gate did not finish: signal SIGTERM
(fail) a citation that names a FIFO is refused without being opened, so the gate cannot block on it [10168.80ms]
--- mut node-fifo: exit 1 after 10 s
✖ a citation that names a FIFO is refused without being opened, so the gate cannot block on it (10173.801417ms)
  AssertionError [ERR_ASSERTION]: the gate did not finish: signal SIGTERM
```
The unmodified copy (`p3.out`): bun `1 pass 0 fail`, node `✔ ... (322.395292ms)`. No gate process was left running after either run (`pgrep -fl 'cli.ts gate'`: none).

## Check 3: CHANGELOG.md (`p5.out`)
`p4.ts` reads the three constants out of `src/cli.ts` as text and the code spans out of the CHANGELOG sentence. It joins each line break and its indent to one space, which is how the `BOTH` span wrapped across `CHANGELOG.md:20-21` renders:
```
code spans with (forced) in the CHANGELOG sentence: 3
FORCED_UNVERIFIED  "closed unverified (forced): "  in CHANGELOG: true
FORCED_TABLE       "closed without a good requirement-to-test table (forced): "  in CHANGELOG: true
FORCED_BOTH        "closed unverified and without a good requirement-to-test table (forced): "  in CHANGELOG: true
```
The "when" clauses match `src/cli.ts:646-649`. `FORCED_TABLE` is written when only table problems exist ("the table was the only check overridden"). `FORCED_BOTH` is written when there are table problems and any other closing problem. `FORCED_UNVERIFIED` is written when there are no table problems. The CHANGELOG calls every non-table problem "a verification did not run", which is how the code's own printed line says it (`src/cli.ts:685`: `forced: closed on a verification that did not run here`).

## Check 4: the note and the round 3 report, sentence by sentence (`p5.out`, `p3b.out`)
- **The note (`impl_r-to-test-check_r2.md:3`).** It cites "non-blocking finding 8". That is right: `review_r-to-test-check_r2.md:188` is item 8 under `## Non-blocking findings` (`:111`). "+9 tests" is at `:47`, and "Final run: 25" is quoted from `:119`. The counts check out. The pathclass table had 30 rows at `cf74c6d` and 70 at `8fa6fb0` (+40). `item-size-base` went from 27 `test(` to 28 (+1). `r-table-check` went from 18 to 24 (+6). 40 + 1 + 6 = 47. `impl41r2/mut.out` shows `KILLED 24  SURVIVED 1`. The risk table still lists `**/*.cy.*` (`:37`), as the note says.
- **"What changed".** `src/rcheck.ts:106` is the guard. Round 2's `5f57636` (in `cf74c6d..27b7159`) replaced `if (!statSync(file).isFile()) throw ...` with `if (statSync(file).isDirectory()) ...`. The Stop hook runs `mstack hook stop` ("Running the mstack gate", `hooks/hooks.json:45-53`). The `.cy.` pattern diff is as stated. In `tests/r-table-check.test.ts`, the first placement moved later tests 10 lines, and the round 3 review lists 15 shifted citations. The limit is stated in the docs (`CHANGELOG.md:14-15`, `docs/wiki/Gates-and-Hooks.md:294`). The CHANGELOG gained round 2's citation and marker changes, all three markers, and the classifier entry (`git diff 8fa6fb0..43f34c4 -- CHANGELOG.md`).
- **"Files".** `git diff --name-only 8fa6fb0..f7075c5`, leaving out decisions, ledger, `current.md` and reviews, gives exactly the six listed files plus the report itself.
- **"Commands".** I reproduced the red with both `src/` lines reverted in a scratch copy:
  ```
  --- red bun-fifo: exit 1 after 10 s
  AssertionError: the gate did not finish: signal SIGTERM
  (fail) a citation that names a FIFO is refused without being opened, so the gate cannot block on it [10174.83ms]
  --- red bun-pathclass: exit 1 after 0 s
  (fail) config/locales/devise.cy.yml is code [0.61ms]
  (fail) public/locales/common.cy.json is code
  (fail) Resources/Strings.cy.resx is code
   72 pass
   3 fail
  ```
  This matches the quoted red: the same tests, the same 72/3, about 10.17 s.
- **"Verify".** The figures match my run below. 797 = 792 + 4 pathclass rows (70 to 74: `web/greet.cy.jsx` and the three Welsh locales) + 1 FIFO test.
- **"Not shown".** The Cypress claim matches round 3 review finding 5. The silent pass without `mkfifo` is `tests/r-table-check.test.ts:484`.
- **The `review-r4` decision row.** Its correction of round 3's finding numbers ("1, 2, 5 and 8") matches round 3 review finding 4.

## Verification I ran (`verify.sh`, at head)
```
HEAD f7075c5d0bac664185ccb4316c965a14f9744218; mstack 0.2.1 at /Users/romerma/Code/mstack; bun 1.3.11; node v26.13.1
=== npm run typecheck: exit 0 after 1 s
(no output besides the npm banner)
=== ./bin/mstack lint-plugin .: exit 0 after 0 s
PASSED - 0 failures, 0 warnings
=== ./bin/mstack gate: exit 0 after 1 s
PASSED - 0 failures, 0 warnings
=== ./bin/mstack ledger check r-to-test-check: exit 1 after 0 s
FAIL no verdict at f7075c5d; 6 row(s) exist at other SHAs and a new head SHA voids them
=== npm run test:bun: exit 0 after 154 s
 797 pass
 0 fail
Ran 797 tests across 31 files. [154.40s]
=== npm run test:node: exit 0 after 35 s
ℹ tests 797
ℹ pass 797
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```
No test failed. `ledger check` is red only because nothing has been recorded at this head yet; this review's row is the first.

## Acceptance, quoted
**"src/rtable.ts parses the last | R | Test | Where | table of the highest-round impl report, splitting cells on unescaped pipes outside backticks"**: met. This change does not touch `src/`. `tests/rtable.test.ts:54-68` and `tests/r-table-check.test.ts:317` are green, and `p6.out` shows the round 3 report being the one read.

**"For the active item with base, from reviewing and at the done transition, every acceptance index A<n> or spec R<n> has a row, and every Where cites existing test-classified files at in-range lines or says n/a: with a reason of at least 12 characters"**: met. The FIFO test, now at `:481`, still kills its mutant (check 2).

**"Closed items and items without base are never checked, and the implementer prose defines the one header"**: met. The tests at `tests/r-table-check.test.ts:337`, `:350` and `:458` are green and now cited at the right lines.

## What I did not check
- `./bin/mstack gate --full`: it records a run, and this pass may change only its two files. I ran the suites directly instead.
- Round 2's 25 mutants. I ran only the FIFO mutant and the two-line red.
- A cited FIFO under node 22 or 24. I ran it only on bun 1.3.11 and node 26.13.1.
- Earlier rounds' non-blocking findings, which are out of scope by the brief. This change makes none of them worse.
