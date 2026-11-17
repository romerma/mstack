# Review - state-cli-ergonomics, round 2

**Verdict:** APPROVED

Item 74, branch `fix/state-cli-ergonomics`, head `a5030ee1dee12bce4acc031376d11451e6cf0e22` (last
code commit `cd0f82d`), item base `14c2b6c`, round 1 reviewed at `a6c142f`. Judged:
`git diff a6c142f..a5030ee -- . ':!.mstack'`, 5 files, +186 -7 (`tests/state-cli.test.ts` +147
-0: no test removed or weakened). I did not write this code and did not review round 1.
Runtimes, each forced by calling `src/cli.ts` directly (`bin/mstack` always picks bun when bun
is on PATH): bun 1.3.11, node v26.13.1, node v22.6.0 (nvm). Probes ran in throwaway stores under
`scratchpad/review74r2/stores/`, mutants in a separate clone (`scratchpad/review74r2/mut`,
`git status` clean after every mutant), the a6c142f/head comparisons in clones at each commit.
Nothing in the repository was written except this report and my ledger row.

B-1 is fixed: on every duplicate-id shape I built, `state show` refuses an item whose id
another item carries, on every ref and in both flag positions, with nothing on stdout. An item
with a unique id on the same store prints itself and only itself. No ref answers for an item
other than the one it names. The writers' refusal gained a fix line and is otherwise unchanged.
Every other existing command is byte-identical to `a6c142f`, and all three runtimes print the
same bytes. The suite is green on all three, and the new tests passed 30 runs out of 30.

## Blocking

None.

## Non-blocking

- **N-1. A duplicate slug still answers for the first item, silently.** On a store with
  `{id 1, slug dup}`, `{id 2, slug dup}`, `state show dup` prints item 1 at exit 0 with no hint
  that item 2 exists. `state set dup`, `state set 1` and `state set 2` all refuse it (`an item
  with slug 'dup' already exists`, exit 2), and the gate fails it (`duplicate slug: dup`). This
  is byte-identical to `a6c142f`, so round 2 did not cause it. It is not B-1's mix: the item
  printed is wholly item 1, and `--json` deep-equals its raw object. Each item can be reached
  by id (`state show 2` prints item 2). The round 2 rationale ("refusing ... tells the reader
  the store needs fixing before any answer can be trusted") would apply here too; refusing, or a
  stderr line naming the other id, would close it. Mutant M3 shows nothing pins either choice.
- **N-2. The writers' refusal gained a fix line (asked about in the brief: yes, one line, nothing
  else).** `assertUniqueId` (`src/state.ts:88-92`) now carries `make every id unique in
  .mstack/state.json; 'mstack gate' lists the duplicates`. So `state set <ref>` on an item whose
  id another item shares prints two lines instead of one. The exit code (2) and the bytes
  written (none) are unchanged. On the 10 probe stores, 28 `state set` runs differ from
  `a6c142f` by exactly that line and 25 are identical. `state add` (10 runs) and `decide
  --resolves` (53 runs, plus one successful resolve) are byte-identical, because neither reaches
  `assertUniqueId` for an existing item. The line is true: the gate prints `duplicate id: 5` and,
  for two pairs, `duplicate id: 3, 4`. My judgement: this is the intended consequence of sharing
  one check between the readers and the writers, not an unrequested behaviour change. No test or
  caller parses that stderr (`rg "already exists" src tests` finds only the new assertion).
- **N-3. The refusal wording.** `state show second` says `an item with id 5 already exists`.
  That is the writers' sentence. Read after a `show`, it does not say that `second` is one of
  the two items. The fix line says what to do. This is wording, so per the brief it does not
  block.
- **N-4. The docs are silent on all three round 2 behaviours, and nothing they say is false.**
  `CHANGELOG.md:5-13`, `docs/wiki/The-CLI.md:185-190,233-235` and `./bin/mstack help` do not
  mention three things: the duplicate-id refusal, `--json` before the ref, and `state --help`.
  `The-CLI.md:189` says "A missing or unmatched `<ref>` exits 2", which is still true but
  incomplete now that a shared id also exits 2. `state show <ref> [--json]` in the help and the
  wiki is still accurate.
- **N-5. Test gaps that surviving mutants show** (table below). Every one of these behaviours is
  correct at the head:
  - M15 (the refusal skips `done` duplicates): reintroduces B-1 for a done/active pair whose
    done half comes first. With `[{id 7, old, done}, {id 7, live, in_progress}]`, the mutant
    prints `old`'s object for `state show live --json` at exit 0. The head refuses it. The new
    test uses only `pending` items. One more pair in that test would pin it. The mutant is a
    contrived edit, so this is low.
  - M12 (`state --help` rewrites `state.json` through `updateState` when run inside a store):
    the hash of a compact `state.json` changed at exit 0. The help test runs only from `/tmp`.
    Low, because the real code returns before `requireStore()` (`src/cli.ts:391-396`).
  - M16 (the fix line dropped) and M3 (duplicate slugs refused too): both low.
- **N-6. How the ref is found is correct today and fragile tomorrow.** `src/cli.ts:424` takes
  the first argument that does not start with `-`. That is right while `STATE_SHOW` has only
  boolean flags (`src/cliopts.ts:64-70`). A string flag added to `state show` later (`--field
  x`) would have its value taken as the ref. A comment there, or a test, would hold that line.
- **N-7.** `state --help` and `state -h` exit 0. `ledger --help`, `worktree --help`, `fanout
  --help` and `gate --help` exit 2 (unchanged; none of them has help). `state list --help` and
  `state bogus --help` exit 2, as they did before. This is consistent with `state add|set|show
  --help` and `decide --help`, which are the item's convention. It is not a defect.
- **N-8. Out of scope by the brief, and identical at `a6c142f`.** A write to a unique item on a
  duplicate-id store rewrites the duplicates' unknown keys by id (`src/state.ts:293-300`).
  `state set 6 --title changed`, `state add --slug newone ...` and a successful `decide
  --resolves second` each copied `first`'s `"secret"` onto `second` and dropped `second`'s
  `"mine"`, at exit 0, on both runtimes, byte-identical to `a6c142f`. This is the brief's
  "`updateState` mapping raw items by id" exclusion. It is listed only because the writers'
  "refuse that store" story has this hole.
- **N-9.** `state show 5` on a store where item 1's slug is `5` and two items share id 5 prints
  item 1. That is the slug-first rule of `findItem` (`src/state.ts:339-345`), the same rule
  `state set` uses, and identical at `a6c142f`. It is the item the ref names by slug, so it is
  not a wrong answer.

## Acceptance, quoted

| # | Criterion | Verdict | Evidence | Rung |
|---|---|---|---|---|
| 1 | "mstack state show <ref> prints one item with every field, including source, seams and decision_required" | Met, including the B-1 store | Probe A: 10 stores (duplicate ids in 2s, 3s, two pairs, done/active, `1`/`1.0`/`1e0`, `0`/`-0`, a string id, a duplicate slug, a slug equal to a shared id). Each ref by id and slug, text, `--json` after and before the ref: 159 calls per runtime per tree. At the head, every exit-0 call (63 per runtime) printed an item the ref names. The 42 `--json` ones deep-equal that item's raw object, and its id is unique. No non-zero exit printed stdout, and every shared-id ref was refused. At `a6c142f` the same calls answered for another item (B-1) in 8 of the 10 stores. Each item of this repository's own 75-item store (read-only): `show <slug> --json`, `show --json <id>` and text, 225/225 correct on each of bun, node 26 and node 22.6, `state.json` unchanged. Tests `tests/state-cli.test.ts:357,390,473`; mutants M1, M2, M4, M5, M14 die on them | 5 (real CLI, real stores, this repository's store read-only) |
| 2 | "a value that starts with -- is accepted by --acceptance, --seam and decide --decision when passed as --flag=value, and the refusal message says so" | Met, not undone | Round 2 touches only the docs sentence. Probe B: `--acceptance=--help`, `--seam=--help`, `--title=--help` stored whole in `state.json`; `decide --decision=--help` stored as `'--help` (the existing tsv guard, now stated by `The-CLI.md:238-239`). Probe D: the space form `--acceptance --x` refusal is byte-identical to `a6c142f` on both runtimes. Test `:411` (X1 dies) | 5 |
| 3 | "state set --acceptance on an item that already has criteria names --add-acceptance in its output, so an append meant as an append is not a silent replace" | Met, not undone | Probe D: `state set plain --acceptance replaced` (one criterion) prints the hint, byte-identical to `a6c142f`. Probe B: `state set dashed --acceptance=--help` on a one-criterion item prints it. New test `:435` pins the one-criterion case (X2 dies) | 5 |
| 4 | "state add --help, state set --help and decide --help print that command's flags and exit 0, so an agent does not hand-edit state.json after a failed --help" | Met, not undone | Probe D: `state add -h`, `state add --help`, `state set --help`, `decide -h`, `decide --help`, `state show --help` byte-identical to `a6c142f`, exit 0. Probe B: outside any repository `state show --help` prints and exits 0, and `state --help`/`-h` now also do. Hashes of `state.json` and `decisions.tsv` are unchanged across every read and help call. Test `:448` pins the unknown-flag refusal on all four commands (X8 dies) | 5 for the CLI. 1 for the agent clause, which no live session here exercised |

## Verification I ran (probe F)

At head `a5030ee` in a clone (`scratchpad/review74r2/head`) unless it says the repository.

```
npm run test:bun                                   ->  592 pass  0 fail  Ran 592 tests across 27 files. [111.02s]   exit 0
npm run test:node (v26.13.1)                       ->  ℹ tests 592  ℹ pass 592  ℹ fail 0                             exit 0
npm run test:node (PATH=~/.nvm/versions/node/v22.6.0/bin, node v22.6.0, npm from that dir)
                                                   ->  # tests 592  # pass 592  # fail 0                             exit 0
  (the state-cli tests spawn the CLI with process.execPath, so it ran on 22.6.0 too:
   "ok 478 - state --help and state -h point at the subcommands ... [node]")
repository: bunx --bun tsc --noEmit                -> typecheck exit 0
repository: ./bin/mstack lint-plugin .             -> PASSED - 0 failures, 0 warnings
repository: ./bin/mstack gate                      -> PASSED - 0 failures, 0 warnings
repository: node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 96 relative links checked, 0 broken
repository: ./bin/mstack ledger check state-cli-ergonomics a5030ee1...
            -> FAIL no verdict at a5030ee1; 3 row(s) exist at other SHAs and a new head SHA voids them
            (before my row; rows at 656ea87, a6c142f verifier-failed, 69b5dc4)
```

`tests/state-cli.test.ts`, ten runs in a row on each runtime (39 tests each, both CLI runtimes
spawned inside every run):

```
node 26  run 1..10:  ℹ pass 39 ℹ fail 0   9-10s each
bun      run 1..10:   39 pass 0 fail      9-10s each
node22.6 run 1..10:  # pass 39 # fail 0   12-14s each
```

Not flaky. No load-sensitive test failed in the head runs. One mutant run (M12, full suite) failed
`tests/costs.test.ts:698` "hook paths stay within budget on a 50 MB transcript" on node while
other work loaded the machine. On a quiet rerun M12 passed 592/0 on both halves, so that
failure was load and not the mutant (item 67). `gate --full` was not run in the repository,
because it writes a receipt into `.mstack/verification.tsv`. The suite it runs is the two halves
above.

## Probes

Runtimes are forced through `scratchpad/review74r2/bin/mx` (`bun src/cli.ts`, or `node
--disable-warning=ExperimentalWarning --experimental-strip-types src/cli.ts` on 26.13.1 or
22.6.0). Transcripts are compared with `diff` after masking store paths and ISO timestamps.

### A. B-1 and duplicate ids

`scratchpad/review74r2/probeA.mjs`: 10 stores. Per store and ref: `state show REF`, `state show
REF --json` and `state show --json REF`, then `state list`, `state active` and `gate`, then on a
fresh copy each of `state set REF --title changed`, `state add --slug newone ...` and `decide
... --resolves REF`. Run at `a6c142f` and at the head, on bun, node 26 and node 22.6. All three
runtimes' transcripts are identical within each tree (`diff -q`: no output).

Result per ref at the head (`exit 2` = refused; `0:x` = printed the item with slug x):

```
pair          5=exit 2  6=0:third  first=exit 2  second=exit 2  third=0:third
triple        5=exit 2  9=0:d9  a5=exit 2  b5=exit 2  c5=exit 2  d9=0:d9
twopairs      3=exit 2  4=exit 2  10=0:u10  p1=exit 2  p2=exit 2  q1=exit 2  q2=exit 2  u10=0:u10
donepair      7=exit 2  8=0:other  live=exit 2  old=exit 2  other=0:other
dupslug       1=0:dup  2=0:dup  3=0:solo  dup=0:dup  solo=0:solo
slugisid      1=0:5  5=0:5  x5=exit 2  y5=exit 2
forkpair      5=exit 2  6=0:third  first=exit 2  second=exit 2  third=0:third
stringid      5=exit 2  6=exit 2  strid=exit 2  numid=exit 2
onepointzero  1=exit 2  2=0:01  int-one=exit 2  float-one=exit 2  exp-one=exit 2  01=0:01
zeros         0=exit 2  3=0:three  zero=exit 2  negzero=exit 2  three=0:three
head show calls (bun): 159, exit 0: 63, exit 2: 96; non-zero with stdout: 0;
exit-0 --json not deep-equal to the named item: 0
```

The same `--json` calls at `a6c142f`, for contrast:

```
pair          5=0:first  first=0:first  second=0:first ...
forkpair      second=0:first ...
triple        b5=0:a5  c5=0:a5 ...
twopairs      p2=0:p1  q2=0:q1 ...
donepair      old=0:live ...
slugisid      y5=0:x5 ...
onepointzero  float-one=0:int-one  exp-one=0:int-one ...
zeros         negzero=0:zero ...
```

At the head, the refusal and a unique neighbour on the same store (bun; node 26 and 22.6
identical):

```
$ mstack state show second
[stderr]
mstack: an item with id 5 already exists
        make every id unique in .mstack/state.json; 'mstack gate' lists the duplicates
[exit 2]
(same for 5, first, second x text, REF --json, --json REF)
$ mstack state show --json 6
{
  "id": 6,
  "slug": "third",
  "title": "third",
  "acceptance": [
    "crit of third"
  ],
  "status": "pending",
  "own": "third's"
}
[exit 0]
$ mstack state show third
id: 6
slug: third
title: third
status: pending
acceptance:
  - crit of third
own: third's
[exit 0]
$ mstack state show float-one          (ids 1, 1.0 and 1e0 in state.json)
mstack: an item with id 1 already exists ...   [exit 2]
$ mstack state show strid              ("id": "5" in state.json)
mstack: <STORE>/.mstack/state.json .items[0].id must be an integer, got "5"   [exit 2]
(state list says the same; identical at a6c142f)
state.json unchanged by reads: true    (every store, every runtime)
```

`state list`, `state active` and `gate` on those stores, compared with `a6c142f` command by
command (`scratchpad/review74r2/cmpA.mjs`):

```
{ 'state list SAME': 10, 'state active SAME': 10, 'gate SAME': 10,
  'state add SAME': 10, 'decide --phase SAME': 53,
  'state set SAME': 25, 'state set DIFF onlyFixLine=true': 28,
  'state show SAME': 50, 'state show DIFF': 109 }
state show differences, classified:
  'ref-first  old:exit0     -> new:dup-refused': 56
  'json-first old:needs-ref -> new:dup-refused': 28
  'json-first old:needs-ref -> new:exit0':       21
  'json-first old:needs-ref -> new: .items[0].id must be an integer': 4   (stringid store)
same classification on node
```

The gate lists the duplicates, as the fix line says: `[fail] duplicate id: 5`, `[fail]
duplicate id: 3, 4`, `[fail] duplicate id: 0` (ids `0` and `-0`), `[fail] duplicate slug: dup`.
`decide --resolves second` with a real answer on the pair store prints `recorded, and second no
longer has an open fork` with exit 0, identical at `a6c142f` and the head on both runtimes
(N-8).

So no ref answers for an item other than the one it names. On a healthy store, including this
repository's own store, the refusal never fired.

### B. The small changes

`scratchpad/review74r2/probeB.sh`, head, bun (node 26 and 22.6 identical apart from
`decisions.tsv` timestamps):

```
hash before: 6f7456537f73 1073d9f53dd9          (state.json, decisions.tsv)
$ mstack state show --json alpha        -> alpha's raw object, extra_key included   [exit 0]
$ mstack state show alpha --json        -> the same bytes                            [exit 0]
$ mstack state show --json              -> mstack: state show needs an item id or slug [exit 2]
$ mstack state show --json --json alpha -> alpha's object                            [exit 0]
$ mstack state show alpha --json --json -> alpha's object                            [exit 0]
$ mstack state show --json alpha --json -> alpha's object                            [exit 0]
$ mstack state show -- --json           -> mstack: state show needs an item id or slug [exit 2]
$ mstack state show -- alpha            -> alpha, text                               [exit 0]
$ mstack state show alpha beta          -> mstack: Unexpected argument 'beta'. This command does not take positional arguments [exit 2]
$ mstack state show --json alpha beta   -> same                                      [exit 2]
$ mstack state show --bogus alpha       -> mstack: Unknown option '--bogus'          [exit 2]
$ mstack state show -x alpha            -> mstack: Unknown option '-x'               [exit 2]
$ mstack state show --json=yes alpha    -> mstack: Option '--json' does not take an argument [exit 2]
$ mstack state show --json 2            -> beta's object                             [exit 0]
$ mstack state show --json nope         -> mstack: no item matches 'nope'            [exit 2]
$ mstack state --help                   (and state -h, state --help list, state -h bogus)
mstack state <subcommand>
  state list                          every item
  state active                        the slug of the active item
  state show <ref> [--json]           one item with every field it carries
  state add --slug S --title T [...]  add an item
  state set <ref> [...]               move or correct an item

state add, state set and state show take --help for that command's flags.
[exit 0]
$ mstack state                          -> the item list                             [exit 0]
$ mstack state bogus                    -> mstack: unknown 'state' subcommand 'bogus' [exit 2]
$ mstack state bogus --help             -> same                                      [exit 2]
$ mstack state list --help              -> mstack: state list takes no arguments, got '--help' / run 'mstack help' [exit 2]
$ mstack state show -h alpha            -> state show help                           [exit 0]
$ mstack ledger --help                  -> unknown 'ledger' subcommand '--help'      [exit 2]
$ mstack gate --help                    -> Unknown option '--help'                   [exit 2]
hash after reads/help: 6f7456537f73 1073d9f53dd9
$ mstack state add --slug dashed --title=--help --acceptance=--help --seam=--help -> added 3 dashed (pending) [exit 0]
$ mstack state set dashed --acceptance=--help --title=-h
3 dashed (pending)
  title: "--help" -> "-h"
  acceptance: 1 criterion(s) replaced with 1
    - dropped "--help"
    to append instead of replace, use --add-acceptance; the dropped criteria are listed above if this was meant as one
$ mstack state set dashed --title=--help      -> title: "-h" -> "--help"   [exit 0]
$ mstack decide --phase=p --decision=--help --why=w --evidence=e --result=ok -> recorded [exit 0]
$ mstack state show dashed --json   -> "title": "--help", "acceptance": ["--help"], "seams": ["--help"]
decisions.tsv last row: p	'--help	w	e	ok
=== outside any repository
$ mstack state --help / state -h    -> the usage above      [exit 0]
$ mstack state / state bogus / state show --json alpha -> no .mstack/ found ... run 'mstack setup' [exit 2]
$ mstack state show --help          -> state show help      [exit 0]
```

The same script at `a6c142f`: every `--json`-first call there said `state show needs an item id
or slug` (exit 2), `state show -- alpha` too, `--bogus`/`-x`/`--json=yes`/`alpha beta` before the ref
gave that same wrong-fix sentence, and `state --help`/`-h` gave `unknown 'state' subcommand`
(exit 2, `no .mstack/ found` outside a repository). Everything else, including the writes of the
`--help` values (`state.json` hash `4a1a85afe304` in both trees), is identical.

### C. Mutants

`scratchpad/review74r2/mutants.mjs` applies each mutant in the clone and runs both halves of the
six CLI-facing test files (`state-cli`, `cli`, `seams`, `state`, `decisions`, `closing`: 128 tests
per half, unmutated baseline 128/0 each), then reverts. Survivors were rerun against the full
suite on both halves.

| Mutant | Change | Result | node pass/fail, bun pass/fail | Matters? |
|---|---|---|---|---|
| X1 (round 1) | `wantsHelp` matches `arg.includes("--help")` | KILLED | 126/2, 126/2 | test `:411` |
| X2 (round 1) | hint only when `item.acceptance.length > 1` | KILLED | 126/2, 126/2 | test `:435` |
| X8 (round 1) | `parseFlags` with `strict: false` | KILLED | 124/4, 124/4 | tests `:448`, `:473` |
| X13 (round 1) | `rawItem` uses `findLast` | SURVIVED, full suite 592/0 each half | 128/0, 128/0 | No: equivalent at the head, see below |
| M1 | refusal fires only for the first of the duplicates (checks the items after it) | KILLED | 126/2, 126/2 | test `:357` |
| M2 | refusal fires only for the last (checks the items before it) | KILLED | 126/2, 126/2 | test `:357` |
| M3 | `show` also refuses a duplicate slug | SURVIVED, full suite 592/0 | 128/0, 128/0 | Low: nothing pins either choice (N-1) |
| M4 | the refusal prints its message and exits 0 | KILLED | 126/2, 126/2 | test `:357` |
| M5 | prints the item, then refuses | KILLED | 126/2, 126/2 | test `:357` (stdout must be empty) |
| M6 | `--json` accepted only before the ref | KILLED | 118/10, 118/10 | the show tests |
| M7 | `--json` accepted only after the ref (the round 1 parse) | KILLED | 126/2, 126/2 | test `:473` |
| M8 | flags before the ref dropped (`rest.slice(at + 1)`) | KILLED | 126/2, 126/2 | test `:473` |
| M9 | `state --help` exits 1 | KILLED | 126/2, 126/2 | test `:494` |
| M10 | `state --help` after `requireStore()` | KILLED | 126/2, 126/2 | test `:494` (runs in `/tmp`) |
| M11 | `state --help` prints to stderr | KILLED | 126/2, 126/2 | test `:494` |
| M12 | `state --help` rewrites `state.json` through `updateState` inside a store | SURVIVED, full suite 592/0 on a quiet rerun | 128/0, 128/0 | Low (N-5): real, the hash changes; the code returns before the store today |
| M13 | `assertUniqueId` without `other !== item` (refuses a healthy store) | KILLED | 60/68, 43/51 | most CLI tests |
| M14 | the refusal only in the text form, `--json` skips it | KILLED | 126/2, 126/2 | test `:357` |
| M15 | the refusal ignores `done` duplicates | SURVIVED, full suite 592/0 | 128/0, 128/0 | Some (N-5): brings back B-1 for a done-first pair, shown by hand |
| M16 | the fix line dropped from the refusal | SURVIVED, full suite 592/0 | 128/0, 128/0 | Low: wording |

X13, by reasoning. `rawItem` has one caller, `src/cli.ts:433`, which runs after
`assertUniqueId(item, state)`. `parseState` maps `items` one for one: `parseItem` throws on any
non-object or malformed entry (`src/state.ts:136,171-205`) and copies `value["id"]` as it is. So
the raw items and the parsed items are the same list with the same id values, and the refusal
leaves exactly one raw item with `id === item.id`. `find` and `findLast` return the same object.
The one exception is the unlocked double read (round 1's N-11): a writer between `parseState`
and `rawItem` that introduced a duplicate could make the two differ. That is a race, not a
case the suite can hold. By running it: 128/0 on the subset and 592/0 on the full suite, each
half. The implementer's claim holds.

### D. No behaviour change

`scratchpad/review74r2/probeD.sh`, round 1's 96-command matrix plus 13 `state show` and help
reads: 109 invocations. They cover every `state add` flag in both spellings, every empty-value
refusal, unknown flags, bad and duplicate slugs, every `state set` value flag, `--clear` of each
field (13), the contradictions, the transition and fork refusals, `decide` plain, with refusals
and with `--resolves`, list, active and the help forms. Run in clones at `a6c142f` and at the
head, stdout, stderr and exit code captured, paths and timestamps masked:

```
=== r1 vs head, bun
383,384c383,391   state --help:            unknown 'state' subcommand '--help' [exit 2] -> the usage [exit 0]
487,488c494,508   state show --json full:  state show needs an item id or slug [exit 2] -> full's object [exit 0]
506,507c526,534   state -h:                unknown 'state' subcommand '-h' [exit 2]     -> the usage [exit 0]
=== r1 vs head, node
(identical to the bun diff)
=== head bun vs head node
SAME
final state.json r1 vs head: identical except the decision_resolved timestamp (bun and node)
final decisions.tsv r1 vs head: identical with the ts column dropped (bun and node)
```

The round 2 brief asked for all three differences. Probe A adds the one other difference, the
fix line in N-2.

### E. Docs and the agent line

- `docs/wiki/The-CLI.md:237-239`: "`--flag=value`, and `state.json` stores it whole
  (`decisions.tsv` puts a quote in front of a value that starts with `=`, `+`, `-` or `@`)".
  This is true against the files. `state.json` held `"--help"` for title, acceptance and seams
  (probe B). `decisions.tsv` held `'--help` (probe B), and `FORMULA_LEADERS` is exactly `=`,
  `+`, `-`, `@` (`src/tsv.ts:13,24-29`). The guard runs after tabs and newlines are replaced and
  the value is trimmed, which the sentence does not need to say.
- `agents/implementer.md:34-35`: "`mstack state show <ref>` prints the seams and the
  acceptance". This is true (probes A and B), and `mstack` without `./bin/` matches the other
  agent files.
- `./bin/mstack help`, `CHANGELOG.md` and the wiki: accurate where they speak, and silent on the
  refusal, `--json` before the ref and `state --help` (N-4).
- No em dash or en dash in any added line: `git diff a6c142f..a5030ee -- . ':!.mstack' | rg
  '^\+.*[—–]'` finds nothing.

### F. Regression

See "Verification I ran" above.

## Ledger

Recorded from the repository root after this report:
`./bin/mstack ledger record state-cli-ergonomics a5030ee1dee12bce4acc031376d11451e6cf0e22
live-verified --evidence .mstack/progress/review_state-cli-ergonomics_r2.md --verifier reviewer`.
`live-verified` is the rung the CLI claims reached: the real CLI in real stores and in this
repository's own store, read-only. The agent-behaviour clause of criterion 4 stays at rung 1.
