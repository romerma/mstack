# Review - r-to-test-check (item 41, round 3)

**Verdict:** CHANGES_REQUESTED

Reviewed `git diff 8fa6fb0..43f34c4` at head `43f34c4baa938bf435a0b745a2d3736df2e8f06d`. The code change is correct and fully tested. The FIFO no longer blocks the gate, the narrowed Cypress pattern matches Cypress's documented defaults, and both suites are green at 797. Two committed files now say false things because of this commit, and a third gets a reference wrong. Each fix is a few lines of text and needs no code change.

Scratch: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review41r3/` (scripts `p1.sh` to `p6.ts`, `clones.sh`, `verify.sh`, each with its `.out`).

## Changes required

1. **The item's newest implementation report no longer says where the tests are (`.mstack/progress/impl_r-to-test-check_r2.md:105-107`).** 43f34c4 inserts the FIFO test at `tests/r-table-check.test.ts:238-247`. Every `tests/r-table-check.test.ts` citation in the R table from `:238` on now points 10 lines early. That is 15 citations, and the gate still reads this report at `done`. `p3.sh` prints each cited line at the commit the report was written for and at head:
   ```
   line  | at 27b7159                                                   | at 43f34c4
   238   | test("a citation that names a directory says so, and one tha | test("a citation that names a FIFO is refused without being
   255   | test("a symlink inside tests/ that points out of the store's |   if (process.getuid?.() === 0) return; // root reads mode 0
   270   | test("the last line of a file with no trailing newline is a  |       symlinkSync(join(away, "real.test.ts"), join(box.store
   281   | test("an n/a reason of 12 characters passes, and the count i |   const body = "one\ntwo\nthree"; // 3 lines, the last unter
   292   | test("an item with no report at all fails and names the file |   inWorld({ reports: { "impl_tbl.md": GOOD.replace("`tests/a
   300   | test("every problem is reported, not only the first", T, ()  | });
   317   | test("the highest round wins: round 1 good, round 2 missing  | });
   337   | test("an item with no base is never checked, whatever its re |   // 10 is later than 2: a name sort would read r2.
   350   | test("a done item with a report that has no table is left al |     assert.equal(cli(box, "state", "set", "tbl", "--status",
   368   | test("--force past the table only: the refusal, the printed  |     assert.ok(!note.stdout.includes("forced"), note.stdout);
   386   | test("--force past a verification only keeps its existing wo |     assert.equal(forced.code, 0, forced.stderr);
   396   | test("--force past both says both, verification first, and a | test("--force past a verification only keeps its existing wo
   426   | test("on the spec path an id with no row and an id the spec  |   inWorld({ status: "verifying", reports: {} }, (box) => {
   434   | test("on the spec path the acceptance bullets are not ids: A | // ---------------------------------------------------------
   458   | test("closingProblems reads nothing for a done or cancelled  |     const spec = join(box.store.root, ".mstack/specs/tbl/spe
   ```
   None of A3's three citations lands on its test. They are now at `:347`, `:360` and `:468`. A1's `:317` lands on a `});`, and the test it means is at `:327`. The new FIFO test is in no row. The gate stays green (`PASSED - 0 failures, 0 warnings`) because it proves only that each line exists, so only a reader would catch this. The same report's pattern table (`impl_r-to-test-check_r2.md:37`) still lists `**/*.cy.*`, which head no longer has. The correction note at `:3` mentions neither.
   **Fix:** write `impl_r-to-test-check_r3.md` with the whole table again (the gate reads the highest round). Use the current lines (+10 for each `tests/r-table-check.test.ts` citation at or after `:238`), add `:238` under A2, and give the narrowed `.cy.` row. Shifting the lines in place and extending the correction note would also work.

2. **CHANGELOG.md names two `closed_by` markers and the code writes three (`CHANGELOG.md:18-20`).** It says `closed_by` "starts `closed without a good requirement-to-test table (forced): ` when the table was the check overridden, and keeps `closed unverified (forced): ` when a verification did not run". `src/cli.ts:226-230` defines `FORCED_UNVERIFIED`, `FORCED_TABLE` and `FORCED_BOTH = "closed unverified and without a good requirement-to-test table (forced): "`. `src/cli.ts:649` picks `FORCED_BOTH` whenever the table and another check were both overridden. `tests/r-table-check.test.ts:406-423` asserts exactly that (`closedBy(box) === ${BOTH_FORCED}checked by hand`), and that test is green. So the second clause is false in the both case: a verification did not run, and `closed_by` does not start with `closed unverified (forced): `. Someone searching for that prefix to find unverified closes misses those items. The wiki already names the third marker (`docs/wiki/Gates-and-Hooks.md:330`).
   **Fix:** add "and `closed unverified and without a good requirement-to-test table (forced): ` when both were".

3. **The correction note cites the wrong finding (`.mstack/progress/impl_r-to-test-check_r2.md:3`).** It says "finding 7". The counts are finding 8 (`review_r-to-test-check_r2.md:188`); finding 7 (`:186`) is the both-case hint. The note also says the report claims 25 kills "on the first run", while the report says "Final run: 25 killed" (`impl_r-to-test-check_r2.md:119`). Both counts in the note are right (`p5.out`):
   ```
   cf74c6d: 17        <- ^test\( declarations in tests/r-table-check.test.ts
   8fa6fb0: 23        <- +6, not +9
   KILLED lines: 24   <- impl41r2/mut.out
   SURVIVED lines: 1
   ```
   **Fix:** say finding 8, and quote "Final run". Under this brief's rule this counts as a false statement in a committed file, so I list it here, but it is a one-word fix.

## Non-blocking

4. **The decision row for this change numbers the findings wrongly (`.mstack/decisions.tsv`, the `item 41 round 3` row).** It gives "non-blocking 1, 4 and 7 and its over-matching list" as the reason. What was taken is round 2's findings 1 (FIFO), 2 (over-matching), 5 (CHANGELOG) and 8 (counts). Finding 4 (`:col-col`) was not taken: the regex at `src/rcheck.ts:90` is unchanged. Neither was finding 7: the hint at `src/cli.ts:678` is unchanged. If the log is append-only, the fix is a correcting row, or nothing.
5. **Cypress specs with non-default extensions are now code outside a root `cypress/`.** Cypress's documentation, fetched for this review, gives the e2e default `specPattern` as "`cypress/e2e/**/*.cy.{js,jsx,ts,tsx}`" and the component default as "`**/*.cy.{js,jsx,ts,tsx}`". `writing-and-organizing-tests` lists `.js`, `.jsx`, `.ts`, `.tsx` as the accepted flavours, and neither page names `.mjs`, `.cjs`, `.mts` or `.coffee` for specs. The narrowed list is exactly the defaults, so a default Cypress project loses nothing. Specs with those other extensions need a custom `specPattern`. Under a root `cypress/` they are still tests. Outside it, for example a component spec next to its component or a nested `apps/web/cypress/`, they are now code, where 27b7159 called them tests (`p6.out`). The outcome is the one the wiki already describes (`docs/wiki/Gates-and-Hooks.md:299-301`): the row takes `n/a:`. Wiki line 298 ("Cypress and Playwright") is still true. The report's risk list is stale; see finding 1.
6. **Nit: the FIFO test passes silently without `mkfifo` (`tests/r-table-check.test.ts:241`).** `return` reports a pass, not a skip. CI is `ubuntu-latest` only (`.github/workflows/ci.yml:10`, `:46`), so this does not matter today.

## Check 1: the FIFO through the real CLI

`p1.sh` runs the gate in a scratch store with A1 citing each path, under a 15 s alarm, with three binaries: head, the previous commit `27b7159`, and head with the new line removed (`mut.diff`).
```
=== /Users/romerma/Code/mstack/bin/mstack (43f34c4)
  tests/c.test.ts:7          exit 0     0.1s  (no A1 line)
  tests/toc.test.ts:7        exit 0     0.1s  (no A1 line)
  tests/toc.test.ts:8        exit 1     0.1s  (A1): tests/toc.test.ts:8 is past the end of tests/toc.test.ts, which has 7 lines
  tests/out.test.ts:1        exit 1     0.1s  (A1): tests/out.test.ts:1 is outside the store's root
  tests/fixtures:1           exit 1     0.1s  (A1): tests/fixtures:1 is a directory, not a test file
  tests/pipe.test.ts:1       exit 1     0.1s  (A1): tests/pipe.test.ts:1 is not a regular file
  tests/topipe.test.ts:1     exit 1     0.1s  (A1): tests/topipe.test.ts:1 is not a regular file
  tests/outpipe.test.ts:1    exit 1     0.1s  (A1): tests/outpipe.test.ts:1 is not a regular file
  tests/null.test.ts:1       exit 1     0.1s  (A1): tests/null.test.ts:1 is not a regular file
  tests/sock.test.ts:1       exit 1     0.1s  (A1): tests/sock.test.ts:1 is not a regular file
  tests/tosock.test.ts:1     exit 1     0.1s  (A1): tests/tosock.test.ts:1 is not a regular file
=== .../review41r3/prev/bin/mstack (27b7159)
  tests/c.test.ts:7          exit 0     0.4s  (no A1 line)
  tests/toc.test.ts:7        exit 0     0.1s  (no A1 line)
  tests/toc.test.ts:8        exit 1     0.1s  (A1): tests/toc.test.ts:8 is past the end of tests/toc.test.ts, which has 7 lines
  tests/out.test.ts:1        exit 1     0.1s  (A1): tests/out.test.ts:1 is outside the store's root
  tests/fixtures:1           exit 1     0.1s  (A1): tests/fixtures:1 is a directory, not a test file
  tests/pipe.test.ts:1       exit 142  15.0s  (no A1 line)
  tests/topipe.test.ts:1     exit 142  15.0s  (no A1 line)
  tests/outpipe.test.ts:1    exit 1     0.1s  (A1): tests/outpipe.test.ts:1 is outside the store's root
  tests/null.test.ts:1       exit 1     0.1s  (A1): tests/null.test.ts:1 is outside the store's root
  tests/sock.test.ts:1       exit 1     0.1s  (A1): tests/sock.test.ts:1 could not be read (EOPNOTSUPP)
  tests/tosock.test.ts:1     exit 1     0.1s  (A1): tests/tosock.test.ts:1 could not be read (EOPNOTSUPP)
=== .../review41r3/mut/bin/mstack (43f34c4, mutant)
  (identical to 27b7159, both FIFO rows exit 142 after 15.0 s)
=== the whole table good, head binary
gate exit 0
PASSED - 0 failures, 1 warning
=== leftover processes blocked on the store (expect none)
none
```
- **Fixed.** A FIFO, a symlink to a FIFO inside the root and one outside it now each give exit 1 in 0.1 s with the message. A socket, a symlink to a socket, and `/dev/null` behind a symlink in the store are also refused.
- **No regression.** A regular file and a symlink to a regular file inside the root pass as before, and the out-of-range, outside-root and directory messages are unchanged.
- **Message changes.** `/dev/null` reached by a symlink used to be "outside the store's root" and is now "is not a regular file". A socket used to be "could not be read (EOPNOTSUPP)" and is now "is not a regular file". `statSync` follows the link before the root check, so a special file is refused before anything is read. Both cases were refused before and still are. I do not count this as a finding.
- **`state set --status done` refuses the same FIFO in time (`p4.out`).** `cannot close: .mstack/progress/impl_greet.md line 4 (A1): tests/pipe.test.ts:1 is not a regular file`. With `--force --closed-by` it closes, and `closed_by` reads `closed without a good requirement-to-test table (forced): probe reason`.

`p2.sh` runs the new test alone on the mutant and at head:
```
##### .../review41r3/mut (43f34c4, mutant)
--- bun: exit 1 after 10.2 s
AssertionError: the gate did not finish: signal SIGTERM
(fail) a citation that names a FIFO is refused without being opened, so the gate cannot block on it [10171.91ms]
--- node v26.13.1: exit 1 after 10.3 s
✖ a citation that names a FIFO is refused without being opened, so the gate cannot block on it (10175.994791ms)
  AssertionError [ERR_ASSERTION]: the gate did not finish: signal SIGTERM
##### /Users/romerma/Code/mstack (43f34c4)
--- bun: exit 0 after 0.3 s
--- node v26.13.1: exit 0 after 0.5 s
=== leftover gate processes (expect none)
none
```
The test kills the mutant. It cannot hang the suite: `spawnSync(..., { timeout: 10_000 })` at `tests/r-table-check.test.ts:242` sends SIGTERM to the runtime process itself, not through the `sh` launcher, and the test then fails on `r.status === null`. `T = { timeout: 120_000 }` (`:25`) is the outer bound.

## Check 2: the pattern (`p6.ts`, `classifyPath` at head)
```
ok  web/greet.cy.ts                          test  by **/*.cy.ts
ok  web/greet.cy.tsx                         test  by **/*.cy.tsx
ok  web/greet.cy.js                          test  by **/*.cy.js
ok  web/greet.cy.jsx                         test  by **/*.cy.jsx
ok  config/locales/devise.cy.yml             code
ok  public/locales/common.cy.json            code
ok  Resources/Strings.cy.resx                code
    src/components/Button.cy.mjs             code
    src/components/Button.cy.cjs             code
    src/components/Button.cy.mts             code
    src/components/Button.cy.coffee          code
ok  cypress/e2e/login.cy.mjs                 test  by cypress/**
ok  cypress/e2e/login.cy.coffee              test  by cypress/**
ok  cypress/component/Button.cy.mts          test  by cypress/**
ok  apps/web/cypress/e2e/login.cy.ts         test  by **/*.cy.ts
    apps/web/cypress/e2e/login.cy.mjs        code
    apps/web/cypress/support/commands.ts     code
ok  src/GreetTest.java                       test  by **/*Test.java
    src/GreetTest.ts                         code
ok  pkg/ABTests/config.ts                    test  by **/*Tests/**
ok  spec/openapi.yaml                        test  by spec/**
```
See finding 5 for what the documentation says and for the misses.

## Check 3: CHANGELOG.md, sentence by sentence
- "A citation may carry a column (`path:line:col`), which is ignored": true. The regex at `src/rcheck.ts:90` is `(?::\d+)?`, and the test at `:223` is green.
- "a directory, a file that is not a regular file and one that cannot be read each get their own message": true. The messages are "is a directory, not a test file", "is not a regular file" (`p1.out`), and "could not be read (CODE)" (`src/rcheck.ts:115`).
- The two `closed_by` markers: the strings match `src/cli.ts:226` and `:228` byte for byte, but the third marker is missing (finding 2).
- "`agents/reviewer.md` says a gate that is red only on the item's own table does not stop the review": true (`agents/reviewer.md:27-30`).
- The classifier entry against `TEST_PATTERNS` (`src/pathclass.ts:11-22`): every pattern is named, and nothing is named that the list lacks. The pre-existing `tests/`, `test/`, `__tests__/`, `*.test.*`, `*.spec.*` and the Python and Go names match `git show 455f166:src/pathclass.ts`. The new ones are `**/src/test/**`, root `spec/**`, `**/*_spec.rb`, `**/*Tests/**`, `**/*Tests.swift`, `**/*Tests.cs`, `**/*Test.java`, `**/*Test.kt`, root `cypress/**`, `e2e/**`, `playwright/**`, the four `.cy.` extensions, and `**/*.e2e.*`.
- "Matching is case-sensitive": true. `globToRegExp` builds the regex with no `i` flag.
- The over-match examples: `GreetTest` is caught only as `.java` or `.kt` (`src/GreetTest.ts` is code), which "with such a name" covers. `ABTests` and `spec/` are confirmed in `p6.out`. The size check counts only `code` (`src/size.ts:140`).

## Check 4: the correction note
The counts are right and the finding number is wrong. See finding 3.

## Acceptance, quoted
**"src/rtable.ts parses the last | R | Test | Where | table of the highest-round impl report, splitting cells on unescaped pipes outside backticks"**: untouched by 43f34c4 (the diff stat has no `src/rtable.ts`). `tests/rtable.test.ts` is green on both runtimes.

**"For the active item with base, from reviewing and at the done transition, every acceptance index A<n> or spec R<n> has a row, and every Where cites existing test-classified files at in-range lines or says n/a: with a reason of at least 12 characters"**: met, and tightened. A non-regular file is now refused without blocking (`p1.out`, `p4.out`). The item's own table still passes this check, but its lines are wrong (finding 1).

**"Closed items and items without base are never checked, and the implementer prose defines the one header"**: untouched by this change. The tests at `tests/r-table-check.test.ts:347`, `:360` and `:468` are green.

## Verification I ran (`verify.sh`, at head)
```
HEAD 43f34c4baa938bf435a0b745a2d3736df2e8f06d; mstack 0.2.1 at /Users/romerma/Code/mstack
=== npm run typecheck: exit 0 after 1 s
=== ./bin/mstack lint-plugin .: exit 0 after 0 s
PASSED - 0 failures, 0 warnings
=== ./bin/mstack gate: exit 0 after 0 s
PASSED - 0 failures, 0 warnings
=== ./bin/mstack ledger check r-to-test-check: exit 1 after 0 s
FAIL no verdict at 43f34c4b; 4 row(s) exist at other SHAs and a new head SHA voids them
=== npm run test:bun: exit 0 after 155 s
 797 pass
 0 fail
Ran 797 tests across 31 files. [154.58s]
=== npm run test:node: exit 0 after 34 s
ℹ tests 797
ℹ pass 797
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```
- **Count.** 797 = 792 + 5 new tests: 4 `pathclass` table rows, each its own `test(` (`tests/pathclass.test.ts:92-94`), and 1 FIFO test.
- **Failures.** No test failed on either runtime (bun 1.3.11, node v26.13.1).
- **Ledger.** `ledger check` is red only because nobody has recorded a verdict at the new head yet. This review's row is the first.

## What I did not check
- `./bin/mstack gate --full`: it records a run, and this pass may change only its two files. The suites were run directly instead.
- A FIFO as the implementation report itself, or as the spec. This change does not touch those reads.
- A cited FIFO under node 22.6 or 24. The CLI probes ran under the launcher's runtime (bun), and the test ran on bun 1.3.11 and node 26.13.1.
- Round 2's other non-blocking findings (3, 4, 6, 7, 9, 10): out of scope by the brief. This change does not make any of them worse.
