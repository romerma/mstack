# Review - r-to-test-check (item 41, round 5)

**Verdict:** APPROVED

Reviewed at `9d292236de489af097a7c8f7cce0bd86f4545842` against `f7075c5` (round 4's head). I did
not write this change.

## Findings

None blocking, none non-blocking.

1. The change has the scope it claims. `git diff --stat f7075c5..9d29223 -- . ':!.mstack'` prints
   nothing, so no code, test or doc changed. The diff of `.mstack/progress/impl_r-to-test-check_r3.md`
   is one hunk on line 52 (row A2), and the only change in it is `tests/pathclass.test.ts:37` ->
   `tests/pathclass.test.ts:38`. The rest of the commit range is round 4's own bookkeeping
   (`decisions.tsv`, `ledger.tsv`, `current.md`, `review_r-to-test-check_r4.md`).
2. Round 4's one finding is closed. `tests/pathclass.test.ts:38` is
   `["src/test/java/com/x/GreetTest.java", "test"],`, a row of `table`. It is the first row of the
   Maven/Gradle block that item 41 added (`git diff 455f166..HEAD -- tests/pathclass.test.ts`), so it
   stands for "the new layouts". `:77` is `["config/locales/devise.cy.yml", "code"],`, the first
   Welsh-locale row. The loop at `tests/pathclass.test.ts:92-94` turns each row into one test.
3. The sentence after the table (`impl_r-to-test-check_r3.md:55-57`) is now true. All 27
   citations, printed below, are a `test(` line, except `tests/r-table-check.test.ts:204` (the
   `for (const p of problems)` loop whose body at `:205` makes one test per problem) and the two
   `tests/pathclass.test.ts` rows.
4. Small wording point in the brief, not in the file: the brief calls `tests/pathclass.test.ts:92`
   "the loop at the end of that file", but one more test comes after it (`:96`). The committed
   sentence says only "rows of the table that makes one test per path", which is accurate, so
   there is nothing to fix.

## Citations, printed at this tree

| R | Citation | Line content | Named as |
|---|---|---|---|
| A1 | `tests/rtable.test.ts:54` | `test("an escaped pipe stays inside its cell, unescaped", ...` | escaped pipe |
| A1 | `tests/rtable.test.ts:58` | `test("a pipe inside a backtick code span does not split the cell", ...` | pipe in a code span |
| A1 | `tests/rtable.test.ts:64` | `test("a backtick with no closing one is a literal and the pipe after it splits", ...` | unclosed backtick |
| A1 | `tests/rtable.test.ts:68` | `test("with two tables the last one wins", ...` | last table wins |
| A1 | `tests/r-table-check.test.ts:317` | `test("the highest round wins: round 1 good, round 2 missing a row fails; round 2 good passes", ...` | highest round wins |
| A2 | `tests/r-table-check.test.ts:98` | `test("a good table passes the gate at reviewing and at verifying, and the item may close", ...` | good table passes |
| A2 | `tests/r-table-check.test.ts:111` | `test("the spec path reads R-ids from spec.md, and a good table over them passes", ...` | spec path |
| A2 | `tests/r-table-check.test.ts:204` | `for (const p of problems) {` (body `:205`: `test(\`${p.name}: the gate at reviewing and at verifying, and state set done, say so\``) | every problem at reviewing/verifying/done |
| A2 | `tests/r-table-check.test.ts:223` | `test("a citation may carry a column, which is ignored: the line is what is checked", ...` | column |
| A2 | `tests/r-table-check.test.ts:238` | `test("a citation that names a directory says so, and one that names a file it cannot read says that", ...` | directory and unreadable file |
| A2 | `tests/r-table-check.test.ts:255` | `test("a symlink inside tests/ that points out of the store's root is outside it", ...` | symlink out of root |
| A2 | `tests/r-table-check.test.ts:270` | `test("the last line of a file with no trailing newline is a line", ...` | unterminated last line |
| A2 | `tests/r-table-check.test.ts:281` | `test("an n/a reason of 12 characters passes, and the count is of the trimmed reason", ...` | n/a of 12 |
| A2 | `tests/r-table-check.test.ts:292` | `test("an item with no report at all fails and names the file it looked for", ...` | no report |
| A2 | `tests/r-table-check.test.ts:300` | `test("every problem is reported, not only the first", ...` | all problems listed |
| A2 | `tests/r-table-check.test.ts:368` | `test("--force past the table only: the refusal, the printed line and closed_by name the table, not a verification", ...` | forced close past the table |
| A2 | `tests/r-table-check.test.ts:386` | `test("--force past a verification only keeps its existing words, with a good table", ...` | past verification |
| A2 | `tests/r-table-check.test.ts:396` | `test("--force past both says both, verification first, and a later note keeps the marker", ...` | past both |
| A2 | `tests/r-table-check.test.ts:426` | `test("on the spec path an id with no row and an id the spec lacks are both reported", ...` | spec ids |
| A2 | `tests/r-table-check.test.ts:434` | `test("on the spec path the acceptance bullets are not ids: A1 is not an id of the item", ...` | spec ids |
| A2 | `tests/r-table-check.test.ts:481` | `test("a citation that names a FIFO is refused without being opened, so the gate cannot block on it", ...` | FIFO refused without being read |
| A2 | `tests/pathclass.test.ts:38` | `["src/test/java/com/x/GreetTest.java", "test"],` (row of `table`; loop `:92-94`) | classification of the new layouts |
| A2 | `tests/pathclass.test.ts:77` | `["config/locales/devise.cy.yml", "code"],` (row of `table`; loop `:92-94`) | Welsh-locale near misses |
| A2 | `tests/item-size-base.test.ts:393` | `test("a change under src/test/ (Maven and Gradle) does not count as code", ...` | the size check |
| A3 | `tests/r-table-check.test.ts:337` | `test("an item with no base is never checked, whatever its report says", ...` | no base never checked |
| A3 | `tests/r-table-check.test.ts:350` | `test("a done item with a report that has no table is left alone: its note can be edited, unmarked", ...` | closed item left alone |
| A3 | `tests/r-table-check.test.ts:458` | `test("closingProblems reads nothing for a done or cancelled item, whatever its report says", ...` | closed item read nothing |

27 citations, each the test, loop or row its row names.

## Acceptance, quoted

This round changed no code, test or doc, so each criterion stands as round 4 judged it at
`f7075c5`. The proof here is the empty diff stat, the green gate, and the tests that cover it,
which pass under both runtimes at this head.

**"src/rtable.ts parses the last | R | Test | Where | table of the highest-round impl report, splitting cells on unescaped pipes outside backticks"** - A1's citations above; `tests/r-table-check.test.ts` passes under bun and node.

**"For the active item with base, from reviewing and at the done transition, every acceptance index A<n> or spec R<n> has a row, and every Where cites existing test-classified files at in-range lines or says n/a: with a reason of at least 12 characters"** - A2's citations above; the gate at this head ran the check on item 41's own table and passed.

**"Closed items and items without base are never checked, and the implementer prose defines the one table header"** - A3's citations above; nothing under `agents/` or `skills/` changed since round 4.

## Verification I ran

```
$ git diff --stat f7075c5..9d29223 -- . ':!.mstack'
(empty)
$ ./bin/mstack version
mstack 0.2.1 at /Users/romerma/Code/mstack
$ ./bin/mstack gate
[ok]    one active item: r-to-test-check (reviewing)
[ok]    r-to-test-check is reviewing; a verification run is due at verifying
[ok]    working tree is clean
PASSED - 0 failures, 0 warnings
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ bun test tests/pathclass.test.ts tests/r-table-check.test.ts
 115 pass
 0 fail
Ran 115 tests across 2 files. [18.52s]
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test tests/pathclass.test.ts tests/r-table-check.test.ts
ℹ tests 115
ℹ pass 115
ℹ fail 0
$ ./bin/mstack ledger check r-to-test-check
FAIL no verdict at 9d292236; 7 row(s) exist at other SHAs and a new head SHA voids them
```

The ledger result is expected before this review records its row.

## Not checked

- The full suite, `npm run typecheck` and `gate --full`. The brief scoped them out because round 4
  ran them at `f7075c5`, and since then only `.mstack/` files have changed.
- `tests/rtable.test.ts` and `tests/item-size-base.test.ts` were not run this round. I printed and
  read their cited lines, but did not execute them. Neither file changed since `f7075c5`.
- Earlier rounds' non-blocking findings, which are being filed separately.
- Evidence rung: test-verified (rung 3) for the two files run. The change itself is a citation,
  checked by reading it back (rung 4 for the claim "line 38 is a row").
