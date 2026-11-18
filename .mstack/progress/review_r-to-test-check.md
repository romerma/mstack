# Review - r-to-test-check (item 41, round 1)

**Verdict:** CHANGES_REQUESTED

Reviewed at `2c168344f7216098818cc327e57cd648fa375d60` (base `455f166`). Product files are identical
between the implementer's verdict sha `321ad58` and head (`git diff --quiet 321ad58 2c16834 -- src
tests agents skills docs CHANGELOG.md` exits 0). Every probe ran through `./bin/mstack` from this
checkout on throwaway stores under the session scratchpad (`review41/probes/*.sh`), except the
parser table (function level, `probes/parse.ts`) and the mutants (a scratch clone, since removed).

The code is careful and the three criteria hold as written. Three things block: a docs transcript
that no run can print, a forced close past this check that is recorded as a close "unverified", and
real test files in common layouts that the check rejects as "not a test file".

## Changes required

1. **`docs/wiki/Gates-and-Hooks.md:297-302` shows output no single run can print.** It shows two
   `[fail]` lines as one `$ mstack gate`: "has no row for A2" and "line 8 (A2): the n/a: reason". A2
   cannot both have no row and have a row on line 8. The second line is also missing the `fix:`
   line that `src/report.ts:86` prints under every failure. The implementer's own session
   (`impl_r-to-test-check.md:55-61`) shows them as two runs with an edit in between. Re-running that
   session script (`probes/p8.sh`) gives:
   ```
   --- run 1: $ mstack gate (full output from the first [fail])
   [fail]  1 greet (reviewing) cannot close as it stands, and .mstack/progress/impl_greet.md has no row for A2 ("prints bye")
           fix: the table is headed | R | Test | Where | with one row per requirement id (A<n> in acceptance order, or R<n> of the spec on the spec path); Where is path:line of test files, or n/a: and a reason of 12+ characters; agents/implementer.md defines it
   --- run 2: $ mstack gate (full output from the first [fail])
   [fail]  1 greet (reviewing) cannot close as it stands, and .mstack/progress/impl_greet.md line 8 (A2): the n/a: reason "manual" has 6 characters, and needs at least 12
           fix: the table is headed | R | Test | Where | ...
   ```
   CONTRIBUTING.md:57 requires pasted output from real runs. Fix: show one real run, or two
   `$ mstack gate` blocks with the report edit between them, each with its `fix:` line.

2. **A forced close past a table problem is recorded as a close "unverified" (`src/cli.ts:666,
   727-730`).** Before this item, verification was the only check that could be overridden, so
   "unverified" was true. `src/rcheck.ts:171` now makes every table problem overridable, and the
   wording was updated only in the refusal (`src/cli.ts:665`, "past a failed closing check"). The
   hint, the stored note and the printed line still say a verification did not run. Probe B3
   (`probes/p4.sh`): an item at `verifying`, nothing to verify, report missing two rows:
   ```
   --- bad table, --force only (state set done exit 2)
   mstack: --force would close greet past a failed closing check, and that has to be on the record
           add --closed-by "<why closing unverified is right here>"; it is stored in state.json as "closed unverified (forced): ...", where the next reader will find it
   --- bad table, --force --closed-by (state set done exit 0)
     closed_by: (unset) -> "closed unverified (forced): A2 and A3 are cov..."
     forced: closed on a verification that did not run here - .mstack/progress/impl_greet.md has no row for A2 ("prints bye"); .mstack/progress/impl_greet.md has no row for A3 ("exits zero")
   ```
   A later reader of `state.json` sees "closed unverified" on an item that may have been verified.
   Nothing durable says which check was overridden: the summary is printed and not stored. Probe B2
   shows the same for "no report", and a later `--closed-by "PR #5 ..."` keeps the false marker.
   No test caught this. `tests/r-table-check.test.ts:298` is named "and says it was forced" but
   asserts only exit codes and that stderr contains `--closed-by`. Fix: word the hint, the marker
   and the printed line by the check that was overridden (the `verificationOnly` split already
   exists at `src/cli.ts:636`). Then assert the stored `closed_by` and the printed line in that
   test.

3. **Real test files are rejected as "not a test file" in common layouts.** The check uses
   `classifyPath` (`src/rcheck.ts:96`) with the default `TEST_PATTERNS`
   (`src/pathclass.ts:11-14`). Store configuration cannot change them (no caller passes
   overrides). An implementer in a JVM, Ruby, Swift, .NET or Cypress repository who follows
   `agents/implementer.md:73` ("`Where` is `path:line` of a test file") cites the real test, and
   the gate goes red at `reviewing`. The only ways out are an `n/a:` row or `--force --closed-by`,
   and finding 2 then records the forced close as unverified. Probe `probes/p9.sh` (each file
   10 lines, cited at line 3, as the only row for A1-A3):
   ```
   src/test/java/com/x/GreetTest.java       gate exit 1 is not a test file (the path classifier calls it code)
   spec/models/greet_spec.rb                gate exit 1 is not a test file (the path classifier calls it code)
   Tests/GreetTests/GreetTests.swift        gate exit 1 is not a test file (the path classifier calls it code)
   Greet.Tests/GreetTests.cs                gate exit 1 is not a test file (the path classifier calls it code)
   cypress/e2e/greet.cy.ts                  gate exit 1 is not a test file (the path classifier calls it code)
   playwright/greet.e2e.ts                  gate exit 1 is not a test file (the path classifier calls it code)
   src/greet.test.ts                        gate exit 0
   pkg/greet_test.go                        gate exit 0
   test/greet_test.exs                      gate exit 0
   tests/integration.rs                     gate exit 0
   ```
   Criterion A2 says "test-classified", so it is met as written. The behaviour is still wrong for
   these repositories. Fix within the criterion: add the common patterns to `TEST_PATTERNS`, such
   as `**/src/test/**`, `spec/**`, `**/*_spec.*`, `**/Tests/**`, `**/*Test.*`/`**/*Tests.*`,
   `**/*.Tests/**`, `**/*.cy.*`, `**/*.e2e.*`. Trade-off: the size check
   (`src/size.ts:140`) uses the same list, so those files would stop counting as code for an `s`
   item, which is also the correct reading. Store-configurable patterns cover more but are a
   larger change that needs a decision row. Rust unit tests inside `src/*.rs` cannot be told apart
   by path either way. Say so in the docs, where `n/a:` is their way out.

## Non-blocking findings (file them)

1. **A red check at `reviewing` stops the reviewer.** `agents/reviewer.md:124` and
   `agents/orchestrator.md:17` say a red gate stops the session. A bad table at `reviewing` is red,
   so the pass whose job is to reject the table is told to stop. An unattended run that used to
   loop back to the implementer now waits for a human. `reviewer.md:21-25` already carves out
   "ran no verification". One sentence there would do the same for an `r-to-test` failure on the
   item under review: it is a finding, and it means CHANGES_REQUESTED.
2. **`cancelled -> done --force` skips the check and needs no `--closed-by`.** This comes from
   `src/rcheck.ts:138`. The gate never runs closing checks for an item that is not active, so the
   `cancelled` guard has one effect: this bypass. Probe `p9.sh`:
   ```
   --- cancelled -> done --force, no report, no --closed-by (state set done exit 0)
   1 greet (done)
     status: "cancelled" -> "done"
   ```
3. **`tests/r-table-check.test.ts:289` "a done item is not checked" cannot fail.** A done item is
   never the active item. With the done/cancelled guard removed, only `:351` goes red:
   ```
   (fail) closingProblems reads nothing for a done or cancelled item, whatever its report says [168.59ms]
   ```
4. **Branches with no test.** Two of my mutants survived:
   - The symlink escape check removed (`src/rcheck.ts:103`). The report says this is not tested.
   - The last line of a file with no trailing newline not counted (`src/rcheck.ts:82`).

   Also untested: an absolute path, the `spec.md` missing branch and the unreadable-spec branch.
   The test at `:339-346` says "the spec file is gone" but writes an empty file, so it runs the
   no-ids branch.
5. **Some messages are false.** The catch at `src/rcheck.ts:106-108` reports any error as "names
   a file that does not exist", including for a directory (`tests/fixtures:3`), an unreadable file
   (mode 000) and `tests/a.test.ts:3:5`. An absolute path inside the root is reported as "outside
   the store's root" (`:94`).
6. **Parser edge cases**, function level (`probes/parse.ts`, 34 shapes; the template's shape is
   read correctly):
   - A table inside `<!-- -->` is read.
   - An earlier round's table quoted after the real one wins, because the last table wins.
   - A line starting with inline code, such as "```x``` is inline", opens a fence that hides the
     rest of the file.
   - A tab-indented table, rows with no leading pipe and CR-only endings are not read.
   - Rejected with a clear message: `N/A:`, `n/a` with no colon, `A1-A3`, `A1 A2`, bold ids.
   - Accepted: `A1,A2,A3`, backticked ids, `./tests/...`.
7. **Spec ids.** The regex `^###[ \t]+Requirement:[ \t]+(R\d+)\b` reads the template shape and
   `R10`.
   - It also reads ids under `## REMOVED Requirements` and inside fenced code in spec.md.
   - It ignores `#### Requirement: R3`, `### R4`, `### Requirement R5` and `**R6**`. This is
     silent unless no id matches at all.
   - It collapses `R1.1` and `R1.2` to `R1`, so a row naming `R1.1` is "an id this item does not
     have".
8. **The gate prints nothing for this check when it passes or does not apply.** That goes against
   the "said out loud" rule at `src/gate.ts:680-682`. `./bin/mstack gate` here has no line for it.
9. **Item 41's own table shows the limit the docs state.**
   - A1's row (`impl_r-to-test-check.md:76`) lists "pipes in code spans, CRLF, no trailing
     newline, wrong cell count" but cites none of those tests (`tests/rtable.test.ts:58, :82, :90,
     :99`). It also omits `:58`, the test for "outside backticks", which A1 names.
   - A3's row says "checked by the grep below", and the report has no grep.
   - The gate passes the table.
10. **Cost.** No size limit is set (whole-file reads). Measured, gate exit codes as shown, and the
    Stop hook within 5 ms of the gate:

    | Report | Gate time |
    |---|---|
    | 2 MB of prose and other tables | 0.139 s |
    | 2 MB of R rows | 1.731 s |
    | 200 kB single line of `|` | 0.128 s |
    | 200 kB of backticks | 0.121 s |
    | 200 kB of `` `| `` | 0.130 s |
    | 200 kB of unclosed runs of distinct lengths | 0.198 s |
    | 200 kB citations | 0.125-0.127 s |

    `realpathSync(store.root)` runs once per citation (`src/rcheck.ts:102`) and could be hoisted. A
    failure quotes the whole cell, so a 200 kB citation becomes a 200 kB gate line and Stop-hook
    context. Stop hook on a normal store: 118.3/116.9 ms at base against 119.5/119.9 ms at head,
    10 runs each.
11. **The outside check misreads one name.** At `src/rcheck.ts:103`, `inside.startsWith("..")`
    has no separator, so a directory named `..x` inside the root reads as outside.
12. **The `tests/cli.test.ts:296` change (`ae231e3`).** The assertions are unchanged and the
    reason is recorded (decision 223, comment at `:311-315`). The guarantee still holds: a forced
    close of an item with a base and a good table needs no `--closed-by` (probe B1, exit 0). That
    test no longer pins it, and the new forced path is pinned for exit codes only (see Changes
    required 2). Not weakened without a reason, so not blocking.
13. **`agents/reviewer.md:68` keeps `| R | Test | Evidence |`.** It does not say the gate ignores
    it. The parser is not fooled by it quoted after the real table (`parse.ts` "quoted reviewer
    table after own").
14. **`claude plugin validate . --strict` fails** on the root `CLAUDE.md` warning, which predates
    this item (the file is not in the diff).

## Acceptance, quoted

**"src/rtable.ts parses the last | R | Test | Where | table of the highest-round impl report,
splitting cells on unescaped pipes outside backticks"** - met.
- The last table wins: `src/rtable.ts:89-120`, `tests/rtable.test.ts:68`.
- `\|` and code spans are handled: `:35-83`, tests `:54`, `:58`, `:64`.
- Fenced blocks are skipped.
- The highest round is picked by `src/rcheck.ts:36-44` through `roles.ts`. `_r10` beats `_r2`,
  lens files are ignored, and `greet` against `greet-followups` is told apart (`p3.sh`).

**"For the active item with base, from reviewing and at the done transition, every acceptance index
A<n> or spec R<n> has a row, and every Where cites existing test-classified files at in-range lines
or says n/a: with a reason of at least 12 characters"** - met as written. `p2.sh` ran 42 cells
through the gate. Missing file, non-test file, line 0, line 21 of 20 and range past the end all
fail. A directory, `..`, a symlink out of the root and 11 characters fail. Line 20 of 20, a space
in the path, comma and `<br>` lists, and 12 characters pass. Spec ids are checked (`p3.sh`). For
the behaviour see Changes required 3.

**"Closed items and items without base are never checked, and the implementer prose defines the
one table header"** - met. Not checked:
- no base: `tests/r-table-check.test.ts:276`, my mutant I2;
- done and cancelled: `:351`;
- an item at `blocked`: `p4.sh` B7.

The header appears only at `agents/implementer.md:70` and `skills/implement/SKILL.md:54`, plus the
docs that describe them. `rg -n -i "\| R \|" agents skills docs README.md` also finds
`agents/reviewer.md:68` (`Evidence`, a different header for the review file).

## Requirement to test

The gate does not read this table. It reads only the implementer's `| R | Test | Where |` table.

| R | Test | Evidence |
|---|---|---|
| A1 | `tests/rtable.test.ts:14, :25, :54, :58, :64, :68, :73, :82`; `tests/r-table-check.test.ts:256, :366` | Opened each. Mutants O5 (unclosed backtick runs to the end of the line) and I4 (lowest round wins) are killed. I5 (CRLF) is equivalent, confirmed through the CLI. |
| A2 | `tests/r-table-check.test.ts:95, :108, :201-217, :220, :319` | The loop at `:201` asserts the gate at reviewing and verifying and `state set done` with literal messages. Mutants I1, I3, O1 and O4 are killed. O2 (symlink) and O3 (no trailing newline) survive, see non-blocking 4. |
| A3 | `tests/r-table-check.test.ts:276, :351` | I2 is killed by `:276`. Removing the done/cancelled guard is killed only by `:351`; `:289` cannot fail. The prose part was checked by `rg` (above). |

## Verification I ran

The suite ran with `HOME` set to an empty directory and `GIT_CONFIG_GLOBAL=/dev/null`. I did not
run `gate --full` (the brief allows only read-only CLI commands in this checkout). I ran its parts,
the store's `verify` (`npm test && npm run typecheck && bin/mstack lint-plugin .`), one by one:
```
$ npm run typecheck                 -> bunx --bun tsc --noEmit, exit 0
$ bun test ./tests                  -> 745 pass, 0 fail, Ran 745 tests across 31 files. [152.00s]
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 745 / ℹ pass 745 / ℹ fail 0 / ℹ duration_ms 31119.8
$ ./bin/mstack lint-plugin .        -> PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 100 relative links checked, 0 broken
$ ./bin/mstack gate                 -> PASSED - 0 failures, 0 warnings  (0.127 s)
$ ./bin/mstack ledger check r-to-test-check 2c16834...
FAIL no verdict at 2c168344; 1 row(s) exist at other SHAs and a new head SHA voids them
```
I ran the two new files 5 times per runtime. All passed every time.

| Runtime | Total per run | Slowest test (each run) | Limit |
|---|---|---|---|
| bun 1.3.11 | 15.48-15.60 s | 0.769-0.781 s | 5 s default |
| node 26.13.1 | 19.0-19.2 s | 0.914-0.935 s | `T` 120 s |
| node 22.6.0 | 21.0 s (1 run) | 1.022 s | `T` 120 s |

On every runtime the slowest test was "the highest round wins".

Mutants, each applied alone in a scratch clone at `2c16834`, `bun test` on the named file:
```
== I1-reportedAt-emptied: bun test exit 1, 25 failing test(s)
(fail) no table with that header: the gate at reviewing and at verifying, and state set done, say so [262.23ms]
== I2-no-base-guard-removed: bun test exit 1, 1 failing test(s)
(fail) an item with no base is never checked, whatever its report says [277.06ms]
== I3-na-minimum-11: bun test exit 1, 2 failing test(s)
(fail) an n/a reason of 12 characters passes, and the count is of the trimmed reason [518.17ms]
== I4-lowest-round-wins: bun test exit 1, 1 failing test(s)
(fail) the highest round wins: round 1 good, round 2 missing a row fails; round 2 good passes [259.99ms]
== I5-crlf-split: bun test exit 0, 0 failing test(s)
== O1-range-end-unchecked: bun test exit 1, 1 failing test(s)
(fail) a range that ends past the file: the gate at reviewing and at verifying, and state set done, say so [258.54ms]
== O2-symlink-escape-unchecked: bun test exit 0, 0 failing test(s)
== O3-last-line-without-newline: bun test exit 0, 0 failing test(s)
== O4-table-never-overridable: bun test exit 1, 1 failing test(s)
(fail) --force with --closed-by closes past a table problem, and says it was forced [197.74ms]
== O5-unclosed-backtick-runs-to-eol: bun test exit 1, 1 failing test(s)
(fail) a backtick with no closing one is a literal and the pipe after it splits [0.98ms]
```
I5 (`\r?\n` to `\n`) is equivalent. Head and the mutant CLI printed the same output on five CRLF
reports: good table, rows with no closing pipe, short `n/a:` at the end of a line, a fence and then
the table, and a header and separator with no closing pipe. Every cell is trimmed, and `line.trim()`
closes a fence that ends in `\r`.

Behaviour (`p4.sh`):
- A report that does not exist yet at `reviewing` is red, then green once written (B4).
- A later round's `_r2` with only the changed row is red, as the prose says (B5).
- The Stop hook carries the failure into `additionalContext` (B6).
- `merge-gate` does not run closing checks (`src/cli.ts:1054-1082`).

## What I did not check

- `gate --full` in this checkout, by the brief's rule. Its three parts ran separately.
- A live Claude session: whether a reviewer subagent actually stops on a red `r-to-test` line
  (non-blocking 1 is read from the prose, not observed).
- Windows paths. A backslash citation is reported as a missing file.
- The full suite on node 22.6. Only the two new files ran there.
