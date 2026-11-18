# Review - r-to-test-check (item 41, round 2)

**Verdict:** APPROVED

Reviewed at `8fa6fb0d9c09e2bf22c616d0b246cca54501be5e`. The round 2 diff is `cf74c6d..8fa6fb0`. I did
not write this code. Every probe ran through `./bin/mstack` from this checkout, on throwaway stores
under the session scratchpad (`review41r2/p1.sh`-`p8.sh`). Two scripts ran at function level:
`p2.ts`, the classifier, and `cost.ts`. Two scratch clones were used. `base455` holds `455f166`, and
`cf74c6d` for one probe. `headclone` holds `8fa6fb0`, for the mutants; `git status` there was clean
after each run.

All three round 1 blocking findings are fixed. I found nothing that blocks. I found a regression the
round introduced: a citation of a FIFO hangs the gate. It cannot plausibly happen in practice, so
it is filed below with the other non-blocking findings.

## Round 1 blocking findings, re-checked

### 1. The wiki transcript: fixed

`p4.sh` builds the store from scratch: two bullets, A1 cited and A2 missing, then
`| A2 | prints bye | n/a: manual |` appended, then `verifying`, then the forced close. `p4cmp.sh`
compares each of the wiki's three console blocks with the matching lines of that run, after
stripping the two-space list indent:

```
block 1: identical (2 lines)
block 2: identical (2 lines)
block 3: identical (5 lines)
```

Each `[fail]` block carries its `fix:` line. The paths came out the same, so nothing needed
normalising. The forced block, `closed without a good requirement-to-test table`, matches the
table-only case below. The `state.json` sentence under it is also true:
`"closed_by": "closed without a good requirement-to-test table (forced): bye is checked by hand in the demo"`.

### 2. The forced close: fixed

`p1.sh` covers four cases, each run plain, then with `--force`, then with `--force --closed-by`,
then with a later `--closed-by`:
- T: the table only;
- V: a verification only (`--verification false`, never run, good table);
- B: both;
- N: no report.

```
--- T --force only (state set exit 2)
mstack: --force would close greet past a failed closing check, and that has to be on the record
        add --closed-by "<why closing without the table is right here>"; it is stored in state.json as "closed without a good requirement-to-test table (forced): ...", where the next reader will find it
--- T --force --closed-by (state set exit 0)
  closed_by: (unset) -> "closed without a good requirement-to-test tab..."
  forced: closed without a good requirement-to-test table - .mstack/progress/impl_greet.md has no row for A2 ("prints bye"); .mstack/progress/impl_greet.md has no row for A3 ("exits zero")
--- B --force --closed-by (state set exit 0)
  closed_by: (unset) -> "closed unverified and without a good requirem..."
  forced: closed on a verification that did not run here - `false` has never been executed
  forced: closed without a good requirement-to-test table - .mstack/progress/impl_greet.md has no row for A2 ("prints bye"); ...
=== state.json closed_by values (after a later --closed-by "PR #5 merged as abc1234")
T: "closed_by": "closed without a good requirement-to-test table (forced): PR #5 merged as abc1234"
V: "closed_by": "closed unverified (forced): PR #5 merged as abc1234"
B: "closed_by": "closed unverified and without a good requirement-to-test table (forced): PR #5 merged as abc1234"
N: "closed_by": "closed without a good requirement-to-test table (forced): the report was lost in a rebase"
```

- **The V case keeps the old words byte for byte.** I ran the same script with the `455f166`
  binary and compared the whole V block, plain refusal, `--force` refusal, forced close, `state show`
  and later note: `V block identical (18 lines)`.
- **The cases can be told apart.** `state show greet` prints `closed_by` in full, so T, V and B read
  differently from `state show` alone, and the marker survives a later `--closed-by`.
- **No old-word assertion was dropped.**
  `git diff cf74c6d..8fa6fb0 -- tests | rg "^-.*closed unverified"` exits 1, and so does the same
  search from `455f166`. `tests/cli.test.ts:704, :751` and `tests/closing.test.ts:138` still assert
  `closed unverified (forced): `.

### 3. The test patterns: fixed within the criterion

- **Citations.** `p3.sh` cites real-layout files through the gate, item at `reviewing`:
  `src/test/java/com/x/Fixtures.java`, `spec/support/helpers.rb` and `Tests/GreetTests/Stub.swift`
  give gate exit 0, and `src/main/java/com/x/Greet.java` gives exit 1, "is not a test file".
- **Size s.** 60 lines in 3 code files, plus 500 lines in `src/test/java/...`,
  `spec/models/greet_spec.rb` or `Tests/GreetTests/Stub.swift`, gives gate exit 0 with
  `small is size s: 60 lines in 3 files`. The same 500 lines in `src/greet.ts` gives exit 1,
  `560 lines in 4 files`.
- **Each pattern alone.** `p2.ts` takes, for each of the 13 patterns, one path it should catch and
  the nearest production path. All 26 are classified right. Some pairs: `core/src/test/...` against
  `core/src/main/...`, `spec/support/factory_bot.rb` against `specs/greet.rb`,
  `cypress/fixtures/user.json` against `cypress.config.ts`, `e2e/pages/login.page.ts` against
  `src/e2e/login.page.ts`, and `playwright/fixtures/auth.ts` against `src/playwright-helpers.ts`.

The over-matching is judged in non-blocking finding 2.

## The rebuttals of this round (decision rows of 2026-11-18T11:19)

- **Markers.** "every non-table check keeps 'closed unverified (forced): '" holds (point 2 above).
  The other checks it covers are only verification problems: the ledger check is never overridable
  (`src/closing.ts`), so `otherProblems` holds only verification ones in production.
- **Patterns.** The row holds, with the over-matching listed below.
- **"a done item" kept as a characterization.** This holds. I mutated the closed-item guard
  (`src/rcheck.ts:143`) three ways. Each mutant turned only the function-level test red:
  ```
  == guard: done not excluded: bun test exit 1, 1 failing test(s) KILLED
     (fail) closingProblems reads nothing for a done or cancelled item, whatever its report says
  == guard: cancelled not excluded: ... 1 failing test(s) KILLED   (same test)
  == guard: neither excluded: ... 1 failing test(s) KILLED          (same test)
  ```
  `:350` never went red. One correction to the row's reason, "a done item is never active, so no
  single mutant of the closed-item guard reaches it". That is true of `done`, but the `cancelled`
  half is reachable from the CLI (`p8.sh`). With that half removed,
  `cancelled -> done --force` with no report and no `--closed-by` goes from exit 0 to exit 2,
  "--force would close greet past a failed closing check". `:458` kills it either way, so the
  conclusion stands.

## Non-blocking findings (file them)

1. **A cited FIFO hangs the gate. This is new in round 2 (`src/rcheck.ts:103`).** Round 2 replaced
   `if (!statSync(file).isFile()) throw ...` with `if (statSync(file).isDirectory()) return ...`.
   A non-regular file now reaches `lineCount`, and `readFileSync` blocks on a FIFO. `p5b.sh` cites
   `tests/pipe.test.ts:1`, made with `mkfifo`, and bounds each run with a 15 s alarm:
   ```
   .../base455/bin/mstack (cf74c6d): gate exit 1 after 0.1 s: (A1): tests/pipe.test.ts:1 names a file that does not exist
   /Users/romerma/Code/mstack/bin/mstack: gate exit 142 after 15.0 s: (no A1 line)
   ```
   Nobody cites a FIFO named like a test, so this does not block. The Stop hook runs this gate,
   though, so a hang is the worst failure shape. Fix: keep the `isDirectory()` message and refuse
   any other `!isFile()`, for example "is not a regular file".
2. **Over-matching by the new patterns (`src/pathclass.ts:16-20`).** `p2.ts`, with "want" being what
   the file really is:
   ```
   BAD  pkg/ABTests/config.ts               test  (want code) matched by: **/*Tests/**
   BAD  spec/openapi.yaml                   test  (want code) matched by: spec/**
   BAD  spec/schema.json                    test  (want code) matched by: spec/**
   BAD  e2e/README.md                       test  (want doc ) matched by: e2e/**
   BAD  src/GreetTest.java                  test  (want code) matched by: **/*Test.java
   BAD  config/locales/views.cy.yml         test  (want code) matched by: **/*.cy.*
   BAD  public/locales/common.cy.json       test  (want code) matched by: **/*.cy.*
   BAD  src/Resources/Strings.cy.resx       test  (want code) matched by: **/*.cy.*
   BAD  src/main/java/.../CheckoutABTest.java test (want code) matched by: **/*Test.java
   BAD  src/main/kotlin/.../SelfTest.kt     test  (want code) matched by: **/*Test.kt
   BAD  Sources/Experiments/SplitTests/Variant.swift test (want code) matched by: **/*Tests/**
   ok   src/latest/x.ts, src/attest/x.ts, app/Contests/x.cs, cypress.config.ts, tests.ts: code
   ok   lib/LoadTests/runner.swift, contest.spec.ts: test (both are tests)
   ```
   - **Who is hurt.** The size check under-counts: +500 lines in `pkg/ABTests/config.ts` or
     `spec/openapi.yaml` still reads `60 lines in 3 files` (`p3.sh`). A citation of a wrongly caught
     file also passes as a test: `spec/openapi.yaml:3`, `pkg/ABTests/config.ts:3` and
     `config/locales/devise.cy.yml:3` each give gate exit 0 (`p3.sh`).
   - **`e2e/README.md`** follows the existing rule that a test pattern beats a doc pattern
     (`tests/README.md` already does), and it costs nothing.
   - **Why none blocks.** The citation check proves only that a file exists, and the reviewer reads
     every cited line anyway. The size under-count needs a size-`s` item, which nothing in the
     intake or the skills picks yet (`rg "size s" agents skills` is empty), plus production code in
     one of these paths.
   - **The report's risk list is honest but incomplete.** It names the `spec/` API-spec case and the
     A/B `CheckoutTest.java` case. For `**/*.cy.*` it says only "a file whose name has `.cy.` in it
     and is not a test", and the likely case is Welsh-locale files (`cy` is Welsh), such as
     `devise.cy.yml`. Narrowing to `**/*.cy.ts`, `.tsx`, `.js` and `.jsx` would avoid it.
3. **Two "root only" or error branches have no test.** Both mutants survive:
   ```
   == mine spec/** matched at any depth: bun test exit 0, 0 failing test(s) SURVIVED
   == mine ENOTDIR reported as unreadable: bun test exit 0, 0 failing test(s) SURVIVED
   ```
   `e2e/**` is pinned to the root by `src/e2e/login.ts` (`tests/pathclass.test.ts:79`). `spec/**` is
   not: `specification/readme.ts` does not test depth, and neither does any `playwright` row. Nothing
   cites a path through a file, so the `ENOTDIR` branch (`src/rcheck.ts:110`) is untested.
   `tests/a.test.ts/x:3` prints "names a file that does not exist" (`p5.sh`).
4. **`path:line:col-col` is misread (`src/rcheck.ts:90`).** The lazy match backtracks into the path:
   ```
   tests/a.test.ts:3:5-9   gate exit 1   line 4 (A1): tests/a.test.ts:3:5-9 names a file that does not exist
   tests/a.test.ts:12:     gate exit 1   line 4 (A1): "tests/a.test.ts:12:" is not path:line
   tests/a.test.ts::3      gate exit 1   line 4 (A1): tests/a.test.ts::3 names a file that does not exist
   tests/a.test.ts:3:5, :3-4:9, `tests/a.test.ts:3:5`   gate exit 0
   tests/a.test.ts:21:5    ... is past the end of tests/a.test.ts, which has 20 lines
   ```
   The column forms the report promises work. Only the `:col-col` message is wrong, since that file
   exists.
5. **CHANGELOG.md was not touched in round 2.** It is not false, but it misses three user-visible
   changes:
   - the two new `closed_by` markers;
   - the 13 test patterns, which also change what the size-`s` check counts for every store;
   - the `:column` citation.
6. **The reviewer exception's recognition text matches only at `reviewing`
   (`agents/reviewer.md:27-30`).** The same bad table at `verifying` prints "is one step from done,
   and ...", not "cannot close as it stands" (`p6.sh`). Reviews run at `reviewing`, so this is a
   wording nit. Related: `agents/orchestrator.md:16, :55` and `skills/router/SKILL.md:17` still stop
   a coordinating pass on that same red. A session resumed at `reviewing` with a bad table stops
   before it launches the reviewer. That is the half of round 1 non-blocking 1 that this round did
   not take, and it is being filed; it is listed here only because the exception does not reach it.
7. **The both-case refusal hint** says `<why closing unverified is right here>` and then names the
   both-marker (`p1.sh`, B `--force only`). This is minor.
8. **Two counts in the round 2 report are wrong.** It says "`tests/r-table-check.test.ts` (+9
   tests)". The file went from 18 to 24 `test(` declarations, +6. The total is +47: 40
   `pathclass` rows, 1 size test and 6 here, which matches 745 -> 792. It also says "Final run: 25
   killed; one survived", while its own `mut.out` has 24 `KILLED` and 1 `SURVIVED`. These are
   false statements in a committed file, so I weighed whether to block. I did not: they are counts
   in the round's evidence file, the totals it reports are right, and no reader acts on them.
9. **Nit, the wiki forced-close block** shows `status: "verifying" -> "done"` after two gate runs at
   `reviewing`. The move to `verifying` is neither shown nor said.
10. **Cost.** The classifier compiles each glob per call. 20000 code paths take 67-72 ms at
    `455f166` and 147-157 ms at head (`cost.ts`). This does not matter at size-`s` diff sizes.

## Acceptance, quoted

**"src/rtable.ts parses the last | R | Test | Where | table of the highest-round impl report,
splitting cells on unescaped pipes outside backticks"** - met. CLI check `p7.sh`:
- An r1 with no table and an r2 whose earlier table cites `src/x.ts` give gate exit 0. The r2's last
  table has `a \| b and `x | y`` in its Test cell.
- The same row with a bare pipe gives exit 1, "line 4: a row has 4 cells, the table has 3".
- Adding an `_r10` with no table gives exit 1, "impl_greet_r10.md has no table headed".
- Tests: `tests/rtable.test.ts:54, :58, :64, :68`, `tests/r-table-check.test.ts:317`. I opened
  each.

**"For the active item with base, from reviewing and at the done transition, every acceptance index
A<n> or spec R<n> has a row, and every Where cites existing test-classified files at in-range lines
or says n/a: with a reason of at least 12 characters"** - met. CLI check `p7.sh`:
- At `reviewing`, the gate fails `src/x.ts:3 is not a test file` and `the n/a: reason "12345678901"
  has 11 characters`, and lets the 12-character reason pass.
- At `verifying`, `state set --status done` exits 2 with the same two problems.
- Tests: `tests/r-table-check.test.ts:98-434` as cited, `tests/pathclass.test.ts:37` and
  `tests/item-size-base.test.ts:393`. I opened each.
- The new layouts are covered in Round 1 blocking finding 3, above.

**"Closed items and items without base are never checked, and the implementer prose defines the
one table header"** - met. CLI check `p7.sh`:
- An item moved to `reviewing` with `--force` and no base, with no report: gate exit 0.
- After a forced close, the gate's only red is the ledger audit, "items marked done with no ledger
  verdict at all", with no table line.
- `rg -n 'exactly `\| R \| Test \| Where \|`' agents skills` finds `agents/implementer.md:70` and
  `skills/implement/SKILL.md:54`.
- Tests: `:337`; `:458` kills the guard (above); `:350` is a characterization.

## Requirement to test

The gate does not read this table. It reads only the implementer's `| R | Test | Where |`.

| R | Test | Evidence |
|---|---|---|
| A1 | `tests/rtable.test.ts:54, :58, :64, :68`; `tests/r-table-check.test.ts:317` | Opened; each exercises one clause of A1 (escaped pipe, code span, unclosed backtick, last table, highest round). |
| A2 | `tests/r-table-check.test.ts:98, :111, :204, :223, :238, :255, :270, :281, :292, :300, :368, :386, :396, :426, :434`; `tests/pathclass.test.ts:37`; `tests/item-size-base.test.ts:393` | Opened. Mutants killed: column, greedy path, symlink escape, last line, markers, `**/src/test/**`, case-insensitive globbing. |
| A3 | `tests/r-table-check.test.ts:337, :350, :458` | All three guard mutants are killed by `:458` only; `:350` is a characterization, as the report says. |

## Verification I ran

The suites ran with `HOME` set to an empty directory and `GIT_CONFIG_GLOBAL=/dev/null`. I did not
run `gate --full` here, because the brief allows only read-only CLI commands in this checkout. I
ran its parts, the store's `verify` (`npm test && npm run typecheck && bin/mstack lint-plugin .`),
one by one:

```
$ npm run typecheck                -> bunx --bun tsc --noEmit, exit 0
$ npm run test:bun                 -> 792 pass, 0 fail, Ran 792 tests across 31 files. [154.12s]
$ npm run test:node                -> ℹ tests 792 / ℹ pass 792 / ℹ fail 0 / ℹ duration_ms 34264.67
$ ./bin/mstack lint-plugin .       -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate                -> exit 0, PASSED - 0 failures, 0 warnings
                                      [ok] one active item: r-to-test-check (reviewing)  (item 41's own table passes)
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 100 relative links checked, 0 broken
$ ./bin/mstack ledger check r-to-test-check 8fa6fb0... (before my row)
FAIL no verdict at 8fa6fb0d; 3 row(s) exist at other SHAs and a new head SHA voids them
```

No test failed, so nothing needed a rerun alone.

The three changed test files (`r-table-check`, `pathclass`, `item-size-base`) ran five times per
runtime (`timing.sh`; bun per-test times from `--reporter=junit`):

| Runtime | Per run | Tests | Slowest test (every run) | Limit |
|---|---|---|---|---|
| bun 1.3.11 | 39.14-39.41 s | 175 pass, 0 fail | 0.944-0.967 s, a size test ("size m, size l, an absent size, ...") | 5 s default |
| node 26.13.1 | 22.61-22.68 s | 175 pass, 0 fail | 1.004-1.021 s, the same test | `T` 120 s |

The slowest round 2 test under bun is "a citation may carry a column", at 0.776-0.778 s.

Mutants, each applied alone in `headclone`. Re-run here: the two round 1 survivors and four of the
implementer's round 2 mutants. My own: case-insensitive globbing, `ENOTDIR`, and `spec/**` at any
depth.

```
== R1-O2 symlink escape check removed: KILLED
   (fail) a symlink inside tests/ that points out of the store's root is outside it
== R1-O3 unterminated last line not counted: KILLED
   (fail) the last line of a file with no trailing newline is a line
== I table-only marker is the unverified one: KILLED (2: --force past the table only ..., --force past both ...)
== I later note keeps only the unverified marker: KILLED (same 2)
== I greedy path before the column: KILLED
   (fail) a citation may carry a column, which is ignored: the line is what is checked
== I pattern **/src/test/** removed: KILLED (3)
   (fail) a change under src/test/ (Maven and Gradle) does not count as code
   (fail) src/test/resources/application.yml is test
   (fail) svc/api/src/test/java/com/x/Fixtures.java is test
== mine case-insensitive glob matching (per file): pathclass exit 1, 3 failing
   (fail) src/Protests/x.cs is code / app/src/Contest.java is code / app/src/Latest.java is code
== mine ENOTDIR reported as unreadable: SURVIVED      (non-blocking 3)
== mine spec/** matched at any depth: SURVIVED        (non-blocking 3)
```

The first run of the case-insensitive mutant ran all three files in one `bun test` process. It spun
with no output, and I killed it after about 4 minutes. Rerun one file at a time, it was killed by
`pathclass`, and `item-size-base` (65 pass) and `r-table-check` (39 pass) were green. At head the
same three files in one process pass in 39 s (above), so the stall belonged to the mutant run.

Point 4, the reviewer exception (`p6.sh`). With only the table red at `reviewing`, every `[fail]`
line reads "cannot close as it stands, and .mstack/progress/impl_greet.md ...", and the `fix:` line
names the `| R | Test | Where |` header. At `reviewing` no other closing check reports, so the line
can be recognised. With a second red as well (two active items), that red is its own line, "2 items
are active in this worktree", so "only" can be decided from the output. The new paragraph weakens
nothing else: it ends "Any other red still stops you", and `:124` "Never approve on a red gate"
still holds.

Point 5, other messages (`p5.sh`):
- `tests/fixtures:3 is a directory, not a test file`;
- `tests/locked.test.ts:3 could not be read (EACCES)` (mode 000);
- `tests/noexec/x.test.ts:3 could not be read (EACCES)` (directory mode 000);
- `tests/null.test.ts:1 is outside the store's root` (a link to `/dev/null`).

## What I did not check

- `gate --full` in this checkout, by the brief's rule. Its three parts ran separately.
- A live Claude session. Whether a reviewer subagent goes on past a red table line is read from the
  prose and the gate output, not observed.
- node 22.6. Windows paths. Rust unit tests in `src/*.rs`, which take `n/a:` by the docs.
- Round 1 non-blocking findings that round 2 did not take: `cancelled -> done --force`, `..x`,
  absolute paths inside the root, the parser edge cases, and silence on a pass. None is worse after
  this round.
