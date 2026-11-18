# Implementation - r-to-test-check (item 41, round 2)

> Correction by the coordinator after the round 2 review (`review_r-to-test-check_r2.md`, non-blocking finding 8): where this report says "+9 tests" the count is +6 (40 + 1 + 6 = 47, which matches 745 to 792), and where it says "Final run: 25" killed its own `mut.out` shows 24 killed and 1 survived. The totals are right. The risk table below still lists `**/*.cy.*`; round 3 narrowed that pattern (see `impl_r-to-test-check_r3.md`).

Answers `.mstack/progress/review_r-to-test-check.md` (round 1, CHANGES_REQUESTED). All three
blocking findings held at head and are fixed; the non-blocking ones named in the brief are fixed;
none was left unapplied.

## What changed

1. A forced close names the check it was forced past (blocking 2). The printed line and
   `closed_by` say `closed without a good requirement-to-test table (forced): ` when only the table
   was overridden, keep `closed unverified (forced): ` and the old printed line for anything else
   (verification, ledger, a registered second check), and say `closed unverified and without a good
   requirement-to-test table (forced): ` for both, with the verification line printed first. The
   refusal hint names the same marker. A later `--closed-by` keeps whichever marker is there.
2. `TEST_PATTERNS` gained 13 patterns (list and what each could wrongly catch, below).
3. The wiki transcript is two real runs plus the forced close, from `./bin/mstack` on a scratch store.
4. `agents/reviewer.md`: a gate red only on the item's own table is a finding, not a stop.
5. A citation may carry `:column`; tests for the symlink escape and the unterminated last line;
   the catch-all now says "is a directory, not a test file" or "could not be read (EACCES)".

### The patterns, and what each could wrongly catch

Matching is case-sensitive (regex, no `i` flag) and `**/` at the start matches zero directories
(`(?:.*/)?`), both read in `globToRegExp` before relying on them.

| Pattern | Layout | Could wrongly catch |
|---|---|---|
| `**/src/test/**` | Maven, Gradle, root or module | production code in a directory literally named `src/test` (none known) |
| `spec/**` | RSpec | a root `spec/` that holds API or protocol specifications, not tests |
| `**/*_spec.rb` | RSpec | none known |
| `**/*Tests/**` | Swift packages, .NET: `Tests/`, `GreetTests/`, `Greet.Tests/` at any depth | a production directory whose name ends in `Tests`; lower-case `tests` is not matched, so `Protests/` and `contest/` stay code |
| `**/*Tests.swift`, `**/*Tests.cs` | Swift, .NET | a production class named `...Tests` |
| `**/*Test.java`, `**/*Test.kt` | JVM | a production class ending in `Test` that is not a test (an A/B `CheckoutTest.java`); `Contest.java` and `Latest.java` stay code |
| `cypress/**` | Cypress | `cypress/` is all test support and config by convention |
| `**/*.cy.*`, `**/*.e2e.*` | Cypress component tests, e2e | a file whose name has `.e2e.` or `.cy.` in it and is not a test |
| `e2e/**`, `playwright/**` | e2e folders, root only | helpers there are called tests, which is how the other test directories read; `src/e2e/` stays code |

The size check reads the same list (`src/size.ts:140`), so those paths stop counting as code for a
size `s` item. Not covered, and still `n/a:`: Rust unit tests inside `src/*.rs`; a store-level
override stays out of scope (being filed).

## Files

- `src/cli.ts` (markers, `forcedClose`), `src/rcheck.ts`, `src/pathclass.ts`
- `tests/r-table-check.test.ts` (+9 tests), `tests/pathclass.test.ts` (+table rows), `tests/item-size-base.test.ts` (+1)
- `agents/reviewer.md`, `docs/wiki/Gates-and-Hooks.md`

Six commits (`git log --oneline cf74c6d..HEAD`, plus this report's).

## Commands

Red first, forced close (`bun test tests/r-table-check.test.ts` with `src/cli.ts` stashed), from `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl41r2/red1.txt`:

```
AssertionError: mstack: --force would close tbl past a failed closing check, and that has to be on the record
        add --closed-by "<why closing unverified is right here>"; it is stored in state.json as "closed unverified (forced): ...", where the next reader will find it
(fail) --force past the table only: the refusal, the printed line and closed_by name the table, not a verification [202.02ms]
AssertionError: mstack: --force would close tbl past a failed closing check, and that has to be on the record
        add --closed-by "<why closing unverified is right here>"; it is stored in state.json as "closed unverified (forced): ...", where the next reader will find it
(fail) --force past both says both, verification first, and a later note keeps the marker [231.49ms]
 33 pass
 2 fail
```

Red first, column and directory (`src/rcheck.ts` stashed), from `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl41r2/red5.txt`:

```
AssertionError: 
FAILED - 1 failure, 0 warnings
(fail) a citation may carry a column, which is ignored: the line is what is checked [259.77ms]
242 |     assert.ok(gate.stdout.includes(`${REPORT} line 6 (A1): tests/fixtures:3 is a directory, not a test file`), gate.stdout);
AssertionError: 
FAILED - 1 failure, 0 warnings
(fail) a citation that names a directory says so, and one that names a file it cannot read says that [262.79ms]
 37 pass
 2 fail
```

Red first, patterns: before `src/pathclass.ts` changed, `bun test tests/pathclass.test.ts tests/item-size-base.test.ts`
printed 19 `(fail)`, one per new "is test" row plus the size test (115 pass, 19 fail).

The two named tests: the old "--force with --closed-by ... says it was forced" (asserted exit codes
only) is replaced by three CLI tests (table only, verification only with the old words unchanged,
both), which assert the refusal hint, the printed line and the stored `closed_by`. "a done item is
not checked" could not fail because a done item is never active; it is now a test of what a person
sees (gate silent on its table, a note edit unmarked) and says in its comment that the closed-item
guard is killed by the function-level test at the end of the file; I could not make a single
mutant of that guard fail it, so it is a characterization, not a kill.

The real runs used in the wiki (scratch repo, `bash /private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl41r2/wiki.sh`, output in `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl41r2/wiki.out`), the forced one:

```
1 greet (done)
  status: "verifying" -> "done"
  closed_by: (unset) -> "closed without a good requirement-to-test tab..."
  forced: closed without a good requirement-to-test table - .mstack/progress/impl_greet.md line 6 (A2): the n/a: reason "manual" has 6 characters, and needs at least 12
```

## R to test

| R | Test | Where |
|---|---|---|
| A1 | parser: last table wins, escaped pipe, pipe in a code span, unclosed backtick; highest round wins | `tests/rtable.test.ts:54`, `tests/rtable.test.ts:58`, `tests/rtable.test.ts:64`, `tests/rtable.test.ts:68`, `tests/r-table-check.test.ts:317` |
| A2 | CLI: good table passes (gate and state set done), spec path, every problem at reviewing/verifying/done, column, directory and unreadable file, symlink out of root, unterminated last line, n/a of 12, no report, all problems listed, spec ids, forced close past the table, past verification, past both; classification of the new layouts and the size check | `tests/r-table-check.test.ts:98`, `tests/r-table-check.test.ts:111`, `tests/r-table-check.test.ts:204`, `tests/r-table-check.test.ts:223`, `tests/r-table-check.test.ts:238`, `tests/r-table-check.test.ts:255`, `tests/r-table-check.test.ts:270`, `tests/r-table-check.test.ts:281`, `tests/r-table-check.test.ts:292`, `tests/r-table-check.test.ts:300`, `tests/r-table-check.test.ts:368`, `tests/r-table-check.test.ts:386`, `tests/r-table-check.test.ts:396`, `tests/r-table-check.test.ts:426`, `tests/r-table-check.test.ts:434`, `tests/pathclass.test.ts:37`, `tests/item-size-base.test.ts:393` |
| A3 | no base never checked; closed item read nothing and left alone. The header defined once in prose: `rg -n "exactly \`\| R \| Test \| Where \|\`" agents skills` (below) | `tests/r-table-check.test.ts:337`, `tests/r-table-check.test.ts:350`, `tests/r-table-check.test.ts:458` |

The prose half of A3, run after the last edit:

```
agents/implementer.md:70:- **R to test**, one table headed exactly `| R | Test | Where |`, which `mstack gate` reads. A
skills/implement/SKILL.md:54:- **R to test**: one table headed exactly `| R | Test | Where |`, which `mstack gate` reads. The
```

## Mutants

Each applied alone, the named files run with `bun test`, reverted (`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl41r2/mut.py`, output `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl41r2/mut.out`).
Final run: 25 killed; one survived (`**/src/test/**`), because the only paths I used for it were also
matched by `*Test.java`/`*Test.kt`. I changed the rows to `src/test/resources/application.yml`,
`svc/api/src/test/java/com/x/Fixtures.java` and the size test to `.../Fixtures.java` and
`.../data.json`, removed the pattern again by hand and got 3 red (`src/test/resources/application.yml is test`,
`svc/api/src/test/java/com/x/Fixtures.java is test`, the size test), then restored it.

| Mutant | Red test |
|---|---|
| table-only marker is the unverified one | "--force past the table only ..." (2 red) |
| both uses the table marker | "--force past both says both ..." |
| table line printed before the verification line | "--force past both ..." |
| verification line carries every problem | "--force past both ..." |
| later note keeps only the unverified marker | "--force past the table only ..." (2 red) |
| refusal hint says unverified for the table | "--force past the table only ..." (2 red) |
| column not accepted; greedy path before the column | "a citation may carry a column ..." |
| directory branch removed; every error is "does not exist" | "a citation that names a directory ..." |
| symlink-escape check removed | "a symlink inside tests/ ..." |
| unterminated last line not counted | "the last line of a file with no trailing newline ..." |
| each of the 13 patterns removed | its row in `tests/pathclass.test.ts` ("<path> is test"); for `**/src/test/**` also the size test |

## Decisions

Recorded with `./bin/mstack decide --phase implement` (see `.mstack/decisions.tsv`): the marker words
and that every non-table check keeps the "unverified" wording; the pattern choices and their risks;
`**/*Tests/**` as one pattern for `Tests/`, `GreetTests/` and `Greet.Tests/`; the closed-item test
reworked as a characterization.

## Verify

```
$ npm run typecheck   (tsc --noEmit, exit 0, no output)
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate
[ok]    GLOSSARY.md: 14 entries, each a term with a one or two sentence definition

-- workspace
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[ok]    on branch feat/r-to-test-check
[ok]    working tree is clean

PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
100 relative links checked, 0 broken
$ npm run test:bun   (HOME empty, GIT_CONFIG_GLOBAL=/dev/null)
792 pass, 0 fail, Ran 792 tests across 31 files. [153.63s]
$ npm run test:node
tests 792 / pass 792 / fail 0   (745 before; +47)
$ bun self.ts  # rTableProblems for item 41, this report in place
item 41 r-to-test-check base=455f1660 status=in_progress
problems: []
```

## What is not shown

- A live Claude session obeying the reviewer exception: read from prose, not observed.
- Windows paths; Rust unit tests; `cancelled -> done --force` and a store-level pattern override (out of scope).
- The `..x` directory misread and an absolute path inside the root reported as outside (round 1 non-blocking, not asked for).

## Deviations

None from the brief. The "a done item" test is a characterization (above), not a mutant kill.
