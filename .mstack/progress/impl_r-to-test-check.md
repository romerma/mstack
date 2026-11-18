# Implementation - r-to-test-check (item 41)

## What changed

The gate now reads the requirement-to-test table. `src/rtable.ts` (a leaf) parses the last
`| R | Test | Where |` table of a report; `src/rcheck.ts` picks the newest implementation report
(reusing `reportFiles` and `roundOf` from `src/roles.ts`), computes the ids (`A1..An` on the
direct path, the `R<n>` of `### Requirement: R<n>` lines in `spec.md` on the spec path) and checks
every row and citation (path classified `test` by `src/pathclass.ts`, file exists under the
root, line or `line-line` range inside it, or `n/a:` with 12+ characters after trimming). It is
registered in `src/closing.ts` as `r-to-test`: reported by the gate at `reviewing` (and so at
`verifying`) and run at `state set --status done`, for items with a `base` only; done and
cancelled items are never read. `agents/implementer.md` (103 lines) and `skills/implement/SKILL.md`
define the one header; wiki pages and CHANGELOG describe it.

## Files

- `src/rtable.ts`, `src/rcheck.ts` (new); `src/closing.ts` (new `requirementTable` entry)
- `tests/rtable.test.ts` (14 tests), `tests/r-table-check.test.ts` (33 tests, new);
  `tests/cli.test.ts` (one deliberate change, see Deviations)
- `agents/implementer.md`, `skills/implement/SKILL.md`
- `docs/wiki/Gates-and-Hooks.md`, `docs/wiki/The-Agents.md`, `docs/wiki/The-CLI.md`, `CHANGELOG.md`

`agents/reviewer.md` keeps its own `| R | Test | Evidence |` table: it is the reviewer's report, not
read by the gate, and not a different header for this table.

## Commands

Red first (stub parser returning "not found"; check absent). Counts, from the saved runs:

```
$ bun test tests/rtable.test.ts      -> 2 pass 12 fail   (the 2 are the "not found" cases a stub satisfies)
$ bun test tests/r-table-check.test.ts -> 5 pass 26 fail  (the 5 are the good-path and not-checked cases)
```

Green, after the final edit (HOME an empty temp dir, `GIT_CONFIG_GLOBAL=/dev/null`):

```
$ bun test ./tests
 745 pass
 0 fail
Ran 745 tests across 31 files. [152.20s]
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 745
ℹ pass 745
ℹ fail 0
$ npm run typecheck        (no output past the tsc banner: clean)
$ ./bin/mstack lint-plugin .   -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate            -> PASSED - 0 failures, 0 warnings
```

Real session in a scratch repository (`scratchpad/impl41/session.sh`, item with a base):

```
--- gate, A2 has no row
[fail]  1 greet (reviewing) cannot close as it stands, and .mstack/progress/impl_greet.md has no row for A2 ("prints bye")
        fix: the table is headed | R | Test | Where | with one row per requirement id (A<n> in acceptance order, or R<n> of the spec on the spec path); Where is path:line of test files, or n/a: and a reason of 12+ characters; agents/implementer.md defines it
FAILED - 1 failure, 0 warnings
--- gate, short n/a
[fail]  1 greet (reviewing) cannot close as it stands, and .mstack/progress/impl_greet.md line 8 (A2): the n/a: reason "manual" has 6 characters, and needs at least 12
FAILED - 1 failure, 0 warnings
--- gate, fixed
[ok]    working tree is clean
PASSED - 0 failures, 0 warnings
1 greet (verifying)
  status: "reviewing" -> "verifying"
--- done
1 greet (done)
  status: "verifying" -> "done"
```

## R to test

| R | Test | Where |
|---|---|---|
| A1 | the parser: header variants, escaped pipes, pipes in code spans, last table wins, fence, CRLF, no trailing newline, wrong cell count | `tests/rtable.test.ts:14`, `tests/rtable.test.ts:25`, `tests/rtable.test.ts:54`, `tests/rtable.test.ts:68`, `tests/rtable.test.ts:73` |
| A2 | CLI seams: every problem at reviewing, verifying and state set done; good table passes; highest round; both paths | `tests/r-table-check.test.ts:95`, `tests/r-table-check.test.ts:201`, `tests/r-table-check.test.ts:256`, `tests/r-table-check.test.ts:319` |
| A3 | no base and done/cancelled never checked; the header defined in prose (no test: prose, checked by the grep below) | `tests/r-table-check.test.ts:276`, `tests/r-table-check.test.ts:351` |

Self-check, calling the check on this store (one-off, state untouched), run after this report was
written:

```
$ bun self.ts   # rTableProblems(store, item 41)
item 41 r-to-test-check base=455f1660 status=in_progress
problems: []
```

## Mutants

34 mutants, each applied alone to `src/` and run against the named test file, then reverted
(`scratchpad/impl41/mutants.mjs`, results in `mutants.txt`). 33 killed, 1 survived.

| Mutant | Killed by |
|---|---|
| closing: `reportedAt` emptied / check unregistered | `tests/r-table-check.test.ts:201` problems, every one |
| closing: every problem un-overridable / unreadable report overridable | `:289` done item (forced close), `:308` |
| no `base` guard removed; done/cancelled guard removed | `:276`; `:351` |
| lowest round wins; lens files read | `:256`; `:366` |
| classification removed; line bound `+1`, `>=`; line 0; backwards range | `:201` (not a test, range, zero, backwards cases); `:95` for `>=` |
| `../` path not refused as outside | `:201` (leaves the root) |
| n/a minimum 11, 13; reason not trimmed | `:220`, `:201` (too short) |
| missing-row and unknown-id reports removed; spec path reads acceptance | `:201`, `:108` |
| `<br>` not a separator; several ids per row unread | `:95` |
| empty Where passes; parse problems dropped; row naming no id passes | `:201` |
| parser: fence ignored, first table wins, `\|` splits, code span unread, separator not required, header case-insensitive, wrong cell count is a row, table does not end at a non-row | `tests/rtable.test.ts` (one test each) |
| parser: CRLF (`split(/\n/)` instead of `/\r?\n/`) | SURVIVED: equivalent, every cell is trimmed so a trailing `\r` is absorbed; the CRLF test still pins the behaviour |

## Decisions

Four `./bin/mstack decide --phase implement` rows: newest report through `roles.ts` (lens files
ignored, numeric rounds); overridable for table problems, not for unreadable files; parsing
choices (fenced table not read, leading pipe, separator required, ranges accepted, spec ids from
`### Requirement: R<n>`); the `tests/cli.test.ts` change.

## Verify

See Commands: typecheck clean, lint-plugin and gate PASSED, bun 745/745 and node 745/745 (698
before, 47 new: 14 parser, 33 check).

## What is not shown

- Tests spawn the CLI under the runtime that runs the suite, not both per test.
- The check proves a citation exists in a test file at a line in range, not that the test covers
  the requirement; the docs say so. A table whose cells are comma-split cannot cite a path that
  contains a comma.
- A table without leading pipes is not read (the gate then says there is no such table).
- Symlinked citations are resolved and must stay under the root; not separately tested.

## Deviations

- `tests/cli.test.ts` "--status and --closed-by keep working exactly as before": the move to
  `in_progress` records a base, so its forced close to done is now held to the table and prefixes
  `closed_by`. I rewrote the item to one with no base before that step (commit ae231e3, reason
  recorded) rather than weaken the assertions.
- `--force` with a base now needs `--closed-by` when the report is missing or bad: a behaviour
  change, in the CHANGELOG.
