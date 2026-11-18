# Implementation - r-to-test-check (item 41, round 3)

Written by the coordinator, who made the round 3 change; a fresh reviewer judges it. Answers the
non-blocking findings of `review_r-to-test-check_r2.md` that were taken, and the three blocking
findings of `review_r-to-test-check_r3.md`.

## What changed

- `src/rcheck.ts:106`: a cited path that is not a regular file is refused before it is read. Round
  2 had turned an `isFile()` test into `isDirectory()`, and a FIFO named like a test blocked the
  gate, which the Stop hook runs.
- `src/pathclass.ts`: `**/*.cy.*` became `.cy.ts`, `.cy.tsx`, `.cy.js`, `.cy.jsx`, so Welsh locale
  files (`devise.cy.yml`, `common.cy.json`, `Strings.cy.resx`) stay code.
- `CHANGELOG.md`: round 2's user-visible changes, all three `closed_by` markers, and an entry on
  the classifier.
- `tests/r-table-check.test.ts`: the FIFO test, at the end of the file. Its first placement in the
  middle of the file moved every later test ten lines and made fifteen citations of the round 2
  table point at the wrong test while the gate stayed green; that was the coordinator's error, found
  by the round 3 review. It is the limit the docs state: the check proves a cited line exists, not
  that it is the right one.
- `impl_r-to-test-check_r2.md`: a correction note at the top (two counts; finding 8 of the round 2
  review).

## Files

`src/rcheck.ts`, `src/pathclass.ts`, `tests/r-table-check.test.ts`, `tests/pathclass.test.ts`,
`CHANGELOG.md`, `.mstack/progress/impl_r-to-test-check_r2.md`.

## Commands

Red, before the code change (run at the tree with only the tests added):

```
$ bun test tests/r-table-check.test.ts -t "FIFO"
AssertionError: the gate did not finish: signal SIGTERM
(fail) a citation that names a FIFO is refused without being opened, so the gate cannot block on it [10170.07ms]
$ bun test tests/pathclass.test.ts
(fail) config/locales/devise.cy.yml is code [0.80ms]
(fail) public/locales/common.cy.json is code [0.04ms]
(fail) Resources/Strings.cy.resx is code [0.06ms]
 72 pass
 3 fail
```

Green, after the final edit: see "Verify" below.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | parser: last table wins, escaped pipe, pipe in a code span, unclosed backtick; highest round wins | `tests/rtable.test.ts:54`, `tests/rtable.test.ts:58`, `tests/rtable.test.ts:64`, `tests/rtable.test.ts:68`, `tests/r-table-check.test.ts:317` |
| A2 | CLI: good table passes (gate and state set done), spec path, every problem at reviewing/verifying/done, column, directory and unreadable file, symlink out of root, unterminated last line, n/a of 12, no report, all problems listed, spec ids, forced close past the table, past verification, past both; a FIFO refused without being read; classification of the new layouts, the Welsh-locale near misses and the size check | `tests/r-table-check.test.ts:98`, `tests/r-table-check.test.ts:111`, `tests/r-table-check.test.ts:204`, `tests/r-table-check.test.ts:223`, `tests/r-table-check.test.ts:238`, `tests/r-table-check.test.ts:255`, `tests/r-table-check.test.ts:270`, `tests/r-table-check.test.ts:281`, `tests/r-table-check.test.ts:292`, `tests/r-table-check.test.ts:300`, `tests/r-table-check.test.ts:368`, `tests/r-table-check.test.ts:386`, `tests/r-table-check.test.ts:396`, `tests/r-table-check.test.ts:426`, `tests/r-table-check.test.ts:434`, `tests/r-table-check.test.ts:481`, `tests/pathclass.test.ts:37`, `tests/pathclass.test.ts:77`, `tests/item-size-base.test.ts:393` |
| A3 | no base never checked; closed item read nothing and left alone. The header defined once in prose: `rg -n "exactly \`\| R \| Test \| Where \|\`" agents skills` (below) | `tests/r-table-check.test.ts:337`, `tests/r-table-check.test.ts:350`, `tests/r-table-check.test.ts:458` |

Every citation above was read back at this tree: each line is the `test(` line of the test named
(or, for `tests/r-table-check.test.ts:204`, the loop that makes one test per problem, and for the
two `tests/pathclass.test.ts` lines, rows of the table that makes one test per path).

## Verify

Run after the last edit to `src/`, `tests/` and `CHANGELOG.md`:

```
$ npm run typecheck          exit 0
$ npm run test:bun            797 pass, 0 fail
$ npm run test:node           pass 797, fail 0
$ ./bin/mstack lint-plugin .  PASSED - 0 failures, 0 warnings
```

797 is 792 plus four `pathclass` rows and the FIFO test.

## Not shown

- No live session ran the reviewer exception in `agents/reviewer.md`.
- `.cy.mjs`, `.cy.cjs`, `.cy.mts` and `.cy.coffee` outside a root `cypress/` are code now; the
  round 3 review checked that Cypress's default spec pattern accepts only the four extensions kept.
- The FIFO test passes without checking anything where `mkfifo` is missing.
