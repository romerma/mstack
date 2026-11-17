# Implementer report, round 2 - state-cli-ergonomics (item 74)

Branch `fix/state-cli-ergonomics`, started at `a8fb659`. Code commits: `7b13abf`, `e665bab`,
`604e184`, `cd0f82d`. Seam: "CLI: mstack state show, state add, state set and decide exit codes
and stdout" (tests spawn the CLI under bun and node, `tests/state-cli.test.ts`).

## What changed

`state show` now refuses an item whose id another item shares (exit 2,
`an item with id 5 already exists`, one fix line), through the writers' own check, extracted from
`assertWritable` into `assertUniqueId`. It is item-scoped like the writers: an item with a unique id
on the same store is still shown, and `state list` on that store keeps working (nothing else
changed). `state show` takes `--json` on either side of the ref. `state --help` / `state -h`
print a pointer and exit 0 with no store. Three guard tests pin X1, X2, X8. Docs sentence and the
implementer line are corrected.

## Findings

| Finding | Reproduced on the real CLI first | Fix |
|---|---|---|
| B-1 duplicate id | yes: `show second` printed `second`'s header with `first`'s `secret`, exit 0; `show second --json` printed `first`, exit 0 | `src/state.ts:76-91` (`assertUniqueId`), `src/cli.ts` show branch (`assertUniqueId(item, state)`) |
| N-5 `--json <ref>` | yes: `needs an item id or slug`, exit 2 | `src/cli.ts` show branch: the ref is the first non-dash argument |
| N-3 `state --help` | yes: `unknown 'state' subcommand '--help'`, exit 2 | `src/cli.ts` `STATE_USAGE`, handled before `requireStore()` |
| N-1 doc sentence | n/a (prose) | `docs/wiki/The-CLI.md:237-238` |
| N-9 implementer pointer | n/a (prose) | `agents/implementer.md:34-35` |

## Red output / proved guards

- B-1 test (`state show refuses an item whose id another item shares ...`): red first, both runtimes:
  `AssertionError: 5 : id: 5 / slug: first ... secret: belongs to first   0 !== 2`. Green after the fix.
- Test that each of 3 unique items deep-equals itself by slug and id: passed on first run (the
  behaviour existed); guarded by the neighbour mutant below.
- `--json` position and `state --help` tests: red first on both runtimes (4 failing in the file:
  `state show takes --json before or after the ref`, `state --help and state -h ...`), green after.
- X1, X2, X8 tests: passed on first run because the behaviour already exists. They are guards that I
  proved by applying the mutant, not red receipts (table below).

## Mutants (scratch clone `scratchpad/impl74r2/mut`, `tests/state-cli.test.ts` only, 35 tests per half at that point)

| Mutant | Result bun | Result node |
|---|---|---|
| X1 `wantsHelp` uses `arg.includes("--help")` | killed, 2 fail | killed, 2 fail |
| X2 hint only when `acceptance.length > 1` | killed, 2 fail | killed, 2 fail |
| X8 `parseFlags` `strict: false` | killed, 2 fail | killed, 2 fail |
| X13 as the review wrote it (`rawItem` uses `findLast`) | survives, 29/0 | survives, 29/0 |
| X13b `rawItem` returns the first item (a neighbour) | killed, 6 fail | killed, 6 fail |
| X13c `state show` without the refusal | killed, 2 fail | killed, 2 fail |

X13 as written is now an equivalent mutant: after the refusal, at most one item carries the id the
lookup receives, so `find` and `findLast` agree. I replaced it with X13b (what X13 was meant to catch:
a wrong neighbour) and X13c (the refusal itself). Both die; the test of X13b is the
"prints exactly the item asked for when several items exist" test (deep-equal per item, by slug and id).
X1 was run against a test that includes `--acceptance=--help`, `--seam=-h` and a criterion that
contains `state add --help`. The X8 test names `--acceptence`, `--josn`, `--resutl` on add, set, show, decide
and asserts the stores are byte-identical.

## VERIFY

1. Suites at `cd0f82d` (the docs commit; the decisions rows are uncommitted at this point):

```
bun test ./tests:                       592 pass  0 fail  Ran 592 tests across 27 files. [107.67s]
npm run test:node (node v26.13.1):      ℹ tests 592  ℹ pass 592  ℹ fail 0
node v22.6.0 (nvm, PATH=~/.nvm/versions/node/v22.6.0/bin):  # tests 592  # pass 592  # fail 0
bunx --bun tsc --noEmit:                exit 0
./bin/mstack lint-plugin .:             PASSED - 0 failures, 0 warnings
./bin/mstack gate:                      [warn] 1 uncommitted change(s) ... PASSED - 0 failures, 1 warning
                                        (the warning is the decisions rows; gate re-run after the commit below)
```

No load-sensitive test (`costs.test.ts:698`, `run.test.ts:239`, launcher) failed. The two `[fail] items
marked done with no ledger verdict` lines inside the bun output are a test's own expected output.

2. Real CLI, throwaway stores under `scratchpad/impl74r2/` (`dup`: items id 5 `first`, id 5 `second`, id 6
`third`). Same transcript on bun and node 26:

```
$ state show 5 | first | second   (each with and without --json)
mstack: an item with id 5 already exists
        make every id unique in .mstack/state.json; 'mstack gate' lists the duplicates
[exit 2]  stdout empty, six of six
$ state show third          [exit 0]   (id 6, shown)
$ state list                [exit 0]   3 lines: "5 first", "5 second", "6 third" (unchanged, still readable)
$ gate --quiet              [fail]  duplicate id: 5 -> make every id unique   [exit 1]
```

Unique store `uniq`:

```
$ state show --json a      -> the JSON of item a, exit 0        $ state show a --json   -> identical
$ state --help  (and -h)   [exit 0]
mstack state <subcommand>
  state list                          every item
  state active                        the slug of the active item
  state show <ref> [--json]           one item with every field it carries
  state add --slug S --title T [...]  add an item
  state set <ref> [...]               move or correct an item

state add, state set and state show take --help for that command's flags.
$ state add --slug b --title B --acceptance=--help   -> added 2 b (pending)
$ state set b --acceptance=--help --acceptance=-h     -> "acceptance": ["--help", "-h"] stored
```

3. Mutants: table above, both halves.
4. No existing test touched; no existing assertion changed. The only visible change to a writer is one
added fix line under `an item with id N already exists` (stderr of `state add`/`state set` on a duplicate id);
no existing test asserted its absence.

## Decisions (also in `decisions.tsv`, `--phase implement`)

- The refusal is item-scoped, like the writers' `assertWritable`, not store-wide: unrelated items stay readable.
  If you want store-wide, move the call before `findItem`; it is one line.
- X13 is equivalent after the fix; replaced by X13b and X13c.
- One thing I did first wrongly: commit 1 had a type error in the test (`it.slug` is `unknown`); caught by
  `tsc` before anything else and fixed by amending the unpushed commit, so `7b13abf` is typecheck-green.

## Found and not fixed (left to the coordinator, as listed)

N-4 hint when the replacement equals the old list; N-7 control characters in a title; N-8 a bare `-h`
after a space; N-6 wrongly typed known keys in the text form; N-10 `decide --resolves` and `updateState`
still map raw items by id on a duplicate-id store (it can copy `first`'s unknown keys onto `second`).
New, minor: `state show` with an id-shared item says "already exists" (the writers' wording), which reads
oddly for a reader; I kept it because the decision said to reuse the message shape.

## R to test

| Requirement | Test (`tests/state-cli.test.ts`) |
|---|---|
| B-1 refuse by id / either slug, text and json, both runtimes | "state show refuses an item whose id another item shares ..." |
| unique ids, each item answered for | "state show --json prints exactly the item asked for when several items exist" |
| X1 | "--help as the value of a flag is stored ..." |
| X2 | "state set --acceptance on an item with exactly one criterion ..." |
| X8 | "an unknown flag is refused, naming it, on state add, state set, state show and decide ..." |
| `--json` position | "state show takes --json before or after the ref" |
| `state --help` | "state --help and state -h point at the subcommands ..." |
