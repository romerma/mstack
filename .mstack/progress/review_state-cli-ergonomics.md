# Review - state-cli-ergonomics

**Verdict:** CHANGES_REQUESTED

Item 74, branch `fix/state-cli-ergonomics`, head `a6c142f58ca619c27df4c2213ab880ea46c7af78` (last code
commit `656ea87`), base `14c2b6c`. Judged: `git diff 14c2b6c..a6c142f -- . ':!.mstack'`, 8 files.
Reviewer did not write this code. Runtimes, each forced by calling `src/cli.ts` directly (the
launcher `bin/mstack` always picks bun when bun is on PATH): bun 1.3.11, node v26.13.1, node
v22.6.0 (nvm, `~/.nvm/versions/node/v22.6.0`). Probes ran in throwaway stores under
`scratchpad/review74/stores/`, mutants in a separate clone (`scratchpad/review74/mut`), the
base/head matrix in clones at each commit. Nothing in the repository was written except this
report and the ledger row.

One blocking finding, narrow and cheap to fix. The four criteria are otherwise met, the
refactor changes no existing behaviour beyond what the item asked for, and every output is
byte-identical across the three runtimes.

## Blocking

### B-1. `state show <ref>` reads the raw object by id, so with two items sharing an id it prints the other one

`src/state.ts:236-240` (`rawItem` returns the first item whose `id` matches) is called from
`src/cli.ts:412` with `item.id`. `--json` prints that object (`src/cli.ts:413`), and the text
form takes its unknown keys from it (`src/cli.ts:364`). The parsed item is found by slug, the
raw one by id, and the two disagree as soon as ids are not unique.

Store: two items, both `"id": 5`; `first` carries `"secret"`, `second` carries `"mine"`.

```
== bun
$ mstack state show second
id: 5
slug: second
title: second
status: pending
acceptance:
  - y
secret: belongs to first
[exit 0]
$ mstack state show second --json
{
  "id": 5,
  "slug": "first",
  "title": "first",
  "acceptance": [
    "x"
  ],
  "status": "pending",
  "secret": "belongs to first"
}
[exit 0]
== node
(identical, both commands, exit 0)
$ mstack gate --quiet
[fail]  duplicate id: 5 -> make every id unique
gate exit 1
```

Why it blocks: the ref named `second` and `--json` printed `first`, slug included, at exit 0;
the text form drops `second`'s own `mine` and shows `first`'s `secret` as if it were
`second`'s. Criterion 1 ("prints one item with every field") is false for that item, and the
brief names show mis-resolving as blocking. The store is gate-red, but it is a real one: two
branches that each ran `state add` get the same next id, and a merge that keeps both rows
produces exactly this, at exactly the moment someone runs `state show` to tell the two apart.
Every writer refuses that store (`state set second --title x` at the base exits 2 with
`an item with id 5 already exists`, `src/state.ts:81`), so `show` is the one command that
answers it wrongly instead of refusing.

What would make it pass: find the raw object by position, not by id. `parseState` maps
`items` index for index (`src/state.ts:127`), so `rawItem(file, index)` with
`state.items.indexOf(item)` returns the right object; matching on id and slug together also
works. Pin it with a test of two items sharing an id: `state show <second-slug> --json`
deep-equals the second item, on both runtimes.

## Non-blocking

- **N-1. `decide --decision=--z` stores `'--z`: criterion 2 is met; ruling below.** The guard is
  `cell()` in `src/tsv.ts:13,27`: any cell whose first character is `=`, `+`, `-` or `@` gets a
  leading `'`, so a spreadsheet does not run it as a formula. It is older than this item and
  applies however the value arrived: the base stores the same `'--z` for the same command
  (probe C), and `-5`, `=SUM`, `+1`, `@x` become `'-5`, `'=SUM`, `'+1`, `'@x` on both runtimes.
  It applies to every `decisions.tsv` column (`'--p`, `'--w`, `'--e`, `'--r` too) and to no
  `state.json` field. Downstream: `decisions.all()` (`src/decisions.ts:72`) returns the cell
  as stored, and the only reader is the gate's fork check (`src/gate.ts:309-317`), which
  compares `ts` and `resolves` (never guarded: an ISO timestamp and a kebab slug) and tests
  `decision` against `/[a-z0-9]/i` (unchanged by a quote) and `result` against `"open"`. No
  command prints the decision text except a gate failure line. So the value is accepted (exit
  0, row written), and nothing compares or parses the stored text in a way the quote changes. An
  agent reading `decisions.tsv` sees `'--z`; the encoding is documented in
  `docs/wiki/State-Files.md:197` and is lossy (a value typed as `'--z` reads back the same).
  `docs/wiki/The-CLI.md:238` says a `--flag=value` value "is stored whole", which is exact for
  `state.json` and not for `decisions.tsv`; one clause naming the guard would make it exact.
- **N-2. Test gaps the surviving mutants show** (table below). The behaviours are correct at the
  head; nothing pins them:
  X1, `--acceptance=--help` is a value: realistic, since item 74's own criterion 4 contains
  `--help`; a `wantsHelp` that matched substrings would turn `state add --acceptance "state add
  --help, ..."` into a help print with nothing added. X2, the hint on an item with exactly one
  criterion (the test item has two). X3/X4, the continuation indent of a multi-line value. X6,
  `decide --help` outside a repository (only `state set --help` is tested there). X8, unknown
  flags refused on `state add`, `state set` and `decide`: no test in the suite asserts it, and it
  now lives in one line (`src/cliopts.ts:156`) that a test could pin for all four commands.
- **N-3. `state --help`** prints `mstack: unknown 'state' subcommand '--help'` with no fix line
  (inside a store) and `no .mstack/ found ... run 'mstack setup'` outside one. Same as the base.
  It is not false, but an agent gets no pointer to `state add|set|show --help`; it has to find
  the global help's line itself. A fix line (`run 'mstack help'; state add, set and show take
  --help`) would close it. `state list --help`, `state active --help`, `ledger --help`,
  `ledger summary --help`, `gate --help` are byte-identical to the base (probe E).
- **N-4.** The hint prints when the replacement equals the old list (`2 criterion(s) replaced
  with 2`, same two). Harmless: the line is still true advice.
- **N-5.** `state show --json <ref>` (flag first) is refused as `state show needs an item id or
  slug` although one was given (`src/cli.ts:408`). Exit 2 and nothing written, but the words
  point at the wrong fix; `state show <ref> --json` is the documented order.
- **N-6.** The text form prints the parsed item, so a known key with a type the parser drops is
  hidden: `"sdd": false`, `"description": 5`, `"closed_by": null` print nothing, while `--json`
  shows them. Only a hand-edited store has these; the text form shows what the CLI and the gate
  act on.
- **N-7.** Control characters in a title or source print raw (`\033[31m`, `\033]0;...\007`,
  `\r`), as `state list` does at the base. Slugs cannot carry them.
- **N-8.** A value that is exactly `--help` or `-h` after a space (`--title -h`, `--acceptance
  --help`) now prints help at exit 0 with nothing written; the base refused it at exit 2. Noted by
  the implementer; contrived, and `--flag=value` stores it.
- **N-9. Pointers.** `agents/implementer.md:34` ("use the item's `seams` field") and
  `skills/router/SKILL.md:79` could name `mstack state show <ref>` as the way to read it.
  `skills/setup/SKILL.md:25` ("Fill `state.json`") is about the project-level `verify` and
  `project` keys, which no command sets, so it stays. `skills/router/references/intake.md`'s
  note text names only `decide` and `state set`; nothing there tells an agent to read
  `state.json` by hand. No em dash in any added line.
- **N-10. Pre-existing, not this item.** `decide --resolves second` on the duplicate-id store
  writes through `updateState`, whose raw-item map is keyed by id (`src/state.ts:286`): at the
  base it copied `first`'s `secret` onto `second` and dropped `second`'s `mine`, exit 0. Worth
  its own item; the position-based lookup B-1 asks for would serve both.
- **N-11.** `show` reads `state.json` twice without the lock (`parseState`, then `rawItem`). A
  write between the two pairs the parsed item with a newer raw object; each read is whole
  (atomic rename). Low.

## Acceptance, quoted

| # | Criterion | Verdict | Evidence | Rung |
|---|---|---|---|---|
| 1 | "mstack state show <ref> prints one item with every field, including source, seams and decision_required" | **Not met in one case (B-1)**, met otherwise | Probe A: every known field, unknown keys, multi-line, by id and slug, three runtimes identical; `--json` deep-equals the stored item for 8 items x 2 refs x 3 runtimes, the only mismatch being ref `7` where another item's slug is `7` (slug first, the `findItem` rule `state set` uses). This repository: `./bin/mstack state show 74 --json` deep-equals item 74. Tests `tests/state-cli.test.ts:143,182,205,217`. Fails on a duplicate id, B-1; no test, and mutant X13 survives the full suite | 5 for the CLI (real CLI, real stores, this repository's own item read-only) |
| 2 | "a value that starts with -- is accepted by --acceptance, --seam and decide --decision when passed as --flag=value, and the refusal message says so" | Met | Probe C: every `state add`, `state set` and `decide` string flag stores `--x` exactly in `state.json` on bun, node 26, node 22.6; `decide` stores it under the existing `'` guard (ruling in N-1). Every space form exits 2, writes nothing, and names `--flag=value` in mstack's words, byte-identical on the three runtimes. Tests `tests/state-cli.test.ts:247,283,317` | 5 |
| 3 | "state set --acceptance on an item that already has criteria names --add-acceptance in its output, so an append meant as an append is not a silent replace" | Met | Probe D: present on a replace of 2, absent on 0 criteria, on `--add-acceptance`, on `state add`; the `dropped` lines still print. Test `tests/state-cli.test.ts:329`, which uses a two-criterion item, so the one-criterion case is unpinned (X2) | 5 |
| 4 | "state add --help, state set --help and decide --help print that command's flags and exit 0, so an agent does not hand-edit state.json after a failed --help" | Met | Probe B: 20 help invocations, stdout, empty stderr, exit 0, `state.json` and `decisions.tsv` byte-identical, no store needed, three runtimes identical; every table flag tried in probe E is accepted. Tests `tests/state-cli.test.ts:42,64,93,104`. The "so an agent does not hand-edit" clause is about agent behaviour, which no live session here exercised | 5 for the CLI; 1 for the agent clause |

## Verification I ran

All at head `a6c142f` in a clone (`scratchpad/review74/head`) unless it says the repository.

```
bun half   (npm run test:bun):   578 pass  0 fail  Ran 578 tests across 27 files. [109.13s]
node half  (npm run test:node, v26.13.1):  ℹ tests 578  ℹ pass 578  ℹ fail 0
node half on v22.6.0 (PATH=~/.nvm/versions/node/v22.6.0/bin):  # tests 578  # pass 578  # fail 0
  (the state-cli tests under it spawn the CLI with process.execPath, so the CLI ran on 22.6.0:
   "ok 448 - state show prints one item ... [node]")
repository: bunx --bun tsc --noEmit                -> exit 0
repository: ./bin/mstack lint-plugin .             -> PASSED - 0 failures, 0 warnings
repository: ./bin/mstack gate                      -> PASSED - 0 failures, 0 warnings
repository: ./bin/mstack ledger check state-cli-ergonomics a6c142f...
            -> FAIL no verdict at a6c142f5; 1 row(s) exist at other SHAs and a new head SHA voids them
            (the implementer's row is at 656ea87; this review's row is the first at the head)
```

No load-sensitive test failed in any run (`tests/costs.test.ts:698`, `tests/run.test.ts:239`, the
`launcher.test.ts` "hostile stdin" case). `gate --full` was not run in the repository because it
writes a receipt into `.mstack/verification.tsv`; the suite it would run is the two halves above.

New tests, ten runs each, in a row:

```
node run 1..10: ℹ pass 25 ℹ fail 0, 5.3s to 5.5s each
bun  run 1..10:  25 pass  0 fail, 5.2s to 5.5s each
```

Not slow, not flaky.

## Probes

Runtimes forced through `scratchpad/review74/bin/mx`: `bun src/cli.ts`, or
`node --disable-warning=ExperimentalWarning --experimental-strip-types src/cli.ts` with node
26.13.1 or 22.6.0. Every probe's transcript is identical across the runtimes unless a line here
says otherwise (`diff` of the transcripts, timestamps masked where a command prints one).

### A. `state show`

Store with an item carrying every known key (`src/state.ts:226-229`), a minimum item, unknown
keys, multi-line and tab text, hostile title, a slug `7` next to an id 7, and wrongly typed known
keys.

```
$ mstack state show everything          (and `state show 1`, byte-identical)
id: 1
slug: everything
title: every field
status: blocked
source: issue #1
description: prose
sdd: true
decision_required: fork?
decision_resolved: 2026-11-01T10:00:00.000Z
verification: npm test
closed_by: note
acceptance:
  - a1
  - a2
seams:
  - CLI: x
  - CLI: y
[exit 0]
$ mstack state show minimum
id: 2
slug: minimum
title: min
status: pending
acceptance: (empty)
[exit 0]
$ mstack state show unknown-keys
...
acceptance:
  - x
zeta: {"nested":[1,null,"s"]}
alpha: null
review_round: 2
flag: false
multi: line1
  line2
[exit 0]
$ mstack state show multiline
id: 4
slug: multiline
title: line one
  line two
status: pending
description: tab	here
  next
  
acceptance:
  - crit
    with newline
  - tab	crit
  -   - looks like a list item
seams:
  - seam
    multi
[exit 0]
$ mstack state show 7            -> id: 6 / slug: 7   (slug first, as state set)
$ mstack state show wrong-types  -> prints decision_required: (empty string); sdd:false, description:5, closed_by:null not printed (N-6)
$ mstack state show nope         -> mstack: no item matches 'nope'              [exit 2]
$ mstack state show              -> mstack: state show needs an item id or slug [exit 2]
$ mstack state show 1 2          -> mstack: Unexpected argument '2'. This command does not take positional arguments [exit 2]
$ mstack state show everything --bogus   -> mstack: Unknown option '--bogus'    [exit 2]
$ mstack state show everything --json=x  -> mstack: Option '--json' does not take an argument [exit 2]
$ mstack state show --json everything    -> mstack: state show needs an item id or slug [exit 2]  (N-5)
$ mstack state show -1 / " 1" / EVERYTHING -> refused, exit 2;  `01` resolves to id 1 (Number("01"), as state set)
sha before: d0e378a8bd8d042527492a437b45f1604947a2b7  .mstack/state.json
sha after:  d0e378a8bd8d042527492a437b45f1604947a2b7  .mstack/state.json   (mtime unchanged)
```

Hostile title, bytes (`od -c`): `title: 033 [ 3 1 m R E D 033 [ 0 m ... \r carriage`, `source: 033 ] 0 ; p w n e d \a`
(N-7).

`--json` round trip, a script that runs `state show <slug|id> --json` for every item and
compares with `util.isDeepStrictEqual` against `JSON.parse(state.json).items[i]`:

```
bun ref="7" id=7 exit=0 deepEqual=false got.id=6
node ref="7" id=7 exit=0 deepEqual=false got.id=6
node22 ref="7" id=7 exit=0 deepEqual=false got.id=6
(every other item x ref x runtime: deepEqual=true)
```

The lock: a live process's pid and a valid token written into `state.json.lock`.

```
== bun
$ state show minimum         -> printed, [exit 0];  --json [exit 0]
$ state set minimum --title t2
mstack: .../state.json.lock is held by pid 13892 and did not let go in 2001 ms
[set exit 2]
== node  (same)
```

`show` takes no lock and works beside a holder; the writer waits and refuses as before.
Duplicate ids: B-1.

### B. `--help`

```
$ mstack state add --help                               [exit 0] stdout=16 lines, stderr=0 bytes
$ mstack state add -h                                   [exit 0] 16 lines
$ mstack state set --help | -h | 1 --help | --help 1 | 1 -h | nope --help    [exit 0] 21 lines each
$ mstack state show --help | -h | 1 --help | --help 1   [exit 0] 8 lines each
$ mstack decide --help | -h                             [exit 0] 13 lines
$ mstack decide --decision=x --phase=p --help           [exit 0]
$ mstack decide --phase p --decision x --help           [exit 0]
$ mstack state add --slug new-thing --title t --acceptance a --help   [exit 0]
$ mstack state set 1 --status done --force --help       [exit 0]
$ mstack state set 1 --title --help                     [exit 0]
$ mstack state set 1 --clear description --help        [exit 0]
state.json and decisions.tsv byte-identical across all help calls
(bun, node 26, node 22.6: identical transcripts)
```

Outside any repository (`/private/tmp`), `state add --help`, `state set --help`, `state show -h`,
`decide --help` all print and exit 0; at the base `state set --help` there said
`no .mstack/ found`. Full text of `state set --help`:

```
mstack state set <ref> [flags]
  move or correct an item; <ref> is an id or a slug

flags:
  --status <status>             move the item to this status
  --closed-by <note>            why or how the item closed
  --title <title>               replace the title
  --description <text>          replace the description
  --acceptance <criterion>      REPLACE the whole acceptance list with these criteria; to append use --add-acceptance
  --add-acceptance <criterion>  append a criterion to the existing list; repeat for each
  --sdd                         take the spec path
  --source <ref>                replace the source
  --verification <command>      replace the verification command
  --decision-required <fork>    attach a product fork, or replace the one the item carries
  --seam <surface>              REPLACE the seams with these; repeat for each
  --clear <field>               remove a field the item carries; repeat for each
  --slug <slug>                 refused: a slug cannot be renamed
  --force                       skip a phase, or close past a failed check; --closed-by must say why
  --help, -h                    print this and exit 0

A value that starts with a dash is written --flag=value, in one argument; after a space it is read as the next flag.
```

`--help` as a value: `--acceptance=--help`, `--title=-h`, `--seam=-h` are stored as values
(probe C), and `--acceptance "state add --help, state set --help and decide --help print ..."`
(a criterion containing `--help`) is stored whole on both runtimes.

Table versus parser: `rg -n "parseArgs\(" src/cli.ts` leaves only fanout, setup, gate, ledger,
worktree, merge-gate and cost; `state add`, `state set`, `state show` and `decide` parse only
through `parseFlags` (`src/cliopts.ts:154-157`), so the accepted set is the table by
construction. Every table flag was tried in probe E and accepted (or, for `--slug` on
`state set`, refused by name as before). Unknown flags stay refused (`--acceptence` ->
`Unknown option '--acceptence'`, exit 2, both runtimes).

Other commands, base versus head, byte-identical: `state --help` (`unknown 'state' subcommand
'--help'`), `state list --help`, `state active --help`, `ledger --help`, `ledger summary --help`,
`gate --help` (N-3).

### C. Values that start with `--`

`=` form, then `state.json` read back (bun shown; node 26 and 22.6 identical):

```
$ mstack state add --slug=dashed --title=--t --description=--d --acceptance=--a1 --acceptance=-a2 --acceptance=--help --source=--s --verification=--v --decision-required=--f --seam=--s1 --seam=-h
added 1 dashed (pending)
$ mstack state set dashed --add-acceptance=--x --add-acceptance=-5
  acceptance: 2 added, now 5
$ mstack state set dashed --title=-h --closed-by=--c
  title: "--t" -> "-h"
  closed_by: (unset) -> "--c"
$ mstack state set dashed --acceptance=--only --acceptance=--help
  acceptance: 5 criterion(s) replaced with 2
  ...
{ "title": "-h", "acceptance": ["--only", "--help"], "description": "--d", "decision_required": "--f",
  "source": "--s", "verification": "--v", "closed_by": "--why", "seams": ["--s1", "-h"] }
$ mstack decide --phase=--p --decision=--z --why=--w --evidence=--e --result=--r
recorded
$ mstack decide --phase=p --decision=-5 --why==SUM --evidence=+1 --result=@x
recorded
$ mstack decide --phase=p --decision="'already quoted" --result=ok
recorded
decisions.tsv:
<ts>	'--p	'--z	'--w	'--e	'--r	
<ts>	p	'-5	'=SUM	'+1	'@x	
<ts>	p	'already quoted			ok	
```

The base, same commands (bun and node): `decide --phase=p --decision=--z --result=--r` ->
`<ts>	p	'--z			'--r	`; `state add --title=--t --acceptance=--a --seam=--s` stores
`--t`, `['--a']`, `['--s']`. So the `=` form already worked at the base and the quote is not
new. The implementer's own decision row shows the guard in this repository too: the last
`implement` row in `.mstack/decisions.tsv` begins `'--help and -h are recognised`. Ruling: N-1.

Space form, every string flag of the three commands (bun shown; node 26 and 22.6 byte-identical):

```
$ mstack state add --slug x --title t --acceptance --x
mstack: --acceptance was followed by '--x', which starts with a dash and so reads as another flag, not as its value
        if it is the value, pass it as one argument: --acceptance=--x
[exit 2]
(same shape, exit 2, for state add --slug --title --description --source --verification
 --decision-required --seam; state set --status --closed-by --title --description --acceptance
 --add-acceptance --source --verification --decision-required --seam --clear --slug;
 decide --phase --decision --why --evidence --result --resolves)
$ mstack state add --slug x --title t --acceptance -x     -> refused, names --acceptance=-x
$ mstack state set base-item --title -5                   -> refused, names --title=-5
$ mstack state set base-item --title --status             -> refused, names --title=--status
$ mstack state set base-item --title --                   -> refused, names --title=--
$ mstack decide --decision --phase                        -> refused, names --decision=--phase
$ mstack state add --slug x --title "--two words"
mstack: --title was followed by '--two words', which starts with a dash and so reads as another flag, not as its value
        if it is the value, pass it as one argument: --title=--two words (quote the whole argument, it has spaces)
$ mstack state add ... --acceptance --yyyy(60 y)
mstack: --acceptance was followed by '--yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy...', ...
        if it is the value, pass it as one argument: --acceptance=--yyyy...(all 60)
state.json and decisions.tsv byte-identical across every refusal
--- accepted, not refused:
$ mstack state set base-item --title -                    -> title: "t" -> "-"   [exit 0]
$ mstack state add --slug lone --title t --acceptance - --sdd --source -   -> added [exit 0]
```

At the base the same space forms were refused at exit 2 with the runtime's text (`Option
'--acceptance' argument is ambiguous. ... use '--acceptance=-XYZ'.`), identical on bun and node.
The pre-scan (`src/cliopts.ts:136-152`) uses the parser's own rule (`length > 1`, leading `-`),
so the set of refused inputs is unchanged; only the words are.

### D. The `--add-acceptance` line

```
$ mstack state add --slug has-two --title t --acceptance one --acceptance two   -> added (no hint)
$ mstack state add --slug has-none --title t                                     -> added (0 criteria; the gate fails it: "items with an empty acceptance list")
$ mstack state set has-two --acceptance one --acceptance two
  acceptance: 2 criterion(s) replaced with 2
    - dropped "one"
    - dropped "two"
    to append instead of replace, use --add-acceptance; the dropped criteria are listed above if this was meant as one
$ mstack state set has-two --acceptance only            -> same three lines + hint
$ mstack state set has-none --acceptance first
  acceptance: 0 criterion(s) replaced with 1              (no hint)
$ mstack state set has-two --add-acceptance more
  acceptance: 1 added, now 2                              (no hint)
$ mstack state set has-two --acceptance a --add-acceptance b  -> still refused, exit 2
```

Base versus head on this transcript: the only difference is the three hint lines. Identical on
bun and node.

### E. The refactor did not change behaviour

A 96-command matrix (`scratchpad/review74/probeE.sh`): every `state add` flag in both
spellings, every empty-value refusal, unknown flag, bad and duplicate slug, `--sdd=yes`, stray
positional, missing value; every `state set` value flag, `--clear` of each clearable and each
unclearable field and an unknown one, the three contradictions, nothing to set, `--slug`, bad
status, the fork and transition refusals; `decide` plain, missing `--decision`, unknown flag,
positional, `--resolves` with no fork, unknown ref, each floor refusal, a full resolve; `state
list`, `state active`, `state`, `state bogus`, the `--help` forms of other commands, `help`.
Run in clones at `14c2b6c` and `a6c142f`, stdout, stderr and exit code captured, timestamps and
paths masked:

```
=== base vs head, bun
79,80c79,95   state add -h:   base "Unknown option '-h'" [exit 2]  -> head prints state add help [exit 0]
82,84c97,98   state add --slug a13 --title t --acceptance --x: node's "ambiguous" text -> mstack's sentence (both exit 2)
125a140       state set plain --acceptance "replaced": + the --add-acceptance hint line
333,334c348,361  decide -h:   base "Unknown option '-h'" [exit 2]  -> head prints decide help [exit 0]
382a410, 389a418  help: + "state show <ref> [--json]" and "state add|set|show, decide --help" lines
=== base vs head, node
node diff identical to bun diff
=== head bun vs head node
SAME
```

Final `state.json` base versus head: identical except the store's `project` name (the directory
name differs); `decisions.tsv` identical with the `ts` column dropped, on both runtimes. Every
difference is one the item asked for.

### F. Mutants

Mine, none of them in the implementer's table (M1-M16). Each applied in
`scratchpad/review74/mut`, run against both halves of the CLI-facing test files
(`state-cli`, `cli`, `seams`, `state`, `decisions`, `closing`, `launcher`: 120 tests per half;
unmutated baseline 120/0 on each), then reverted; `git status` clean after. X1, X8 and X13 were
also run against the full suite on both halves.

| Mutant | Change | Result | node pass/fail, bun pass/fail | Matters? |
|---|---|---|---|---|
| X1 | `wantsHelp` matches `arg.includes("--help")` | SURVIVED (full suite too: 578/0 each half) | 120/0, 120/0 | Yes, N-2: a criterion that mentions `--help` would print help and add nothing |
| X2 | hint only when `item.acceptance.length > 1` | SURVIVED | 120/0, 120/0 | Yes, N-2: replacing a single criterion would be silent again |
| X3 | scalar continuation lines not indented | SURVIVED | 120/0, 120/0 | Some: a description line `status: done` would print flush left |
| X4 | list continuation lines not indented | SURVIVED | 120/0, 120/0 | Some, as X3 |
| X5 | empty list prints `acceptance:` without `(empty)` | SURVIVED | 120/0, 120/0 | Low |
| X6 | `decide --help` calls `requireStore()` first | SURVIVED | 120/0, 120/0 | Some: the docs say help needs no store |
| X7 | `state add/set/show --help` call `requireStore()` first | KILLED | 118/2, 118/2 | "help works outside an mstack repository" |
| X8 | `parseFlags` with `strict: false` | SURVIVED (full suite too: 578/0 each half) | 120/0, 120/0 | Yes, N-2: a typo'd flag would be ignored silently on all four commands; no test asserts the refusal, also not at the base |
| X9 | pre-scan refuses a lone `-` | KILLED | 118/2, 118/2 | "... or a lone dash is not refused" |
| X10 | pre-scan also inspects boolean flags | KILLED | 113/7, 113/7 | existing `--force --closed-by` tests |
| X11 | pre-scan does not stop at `--` | SURVIVED | 120/0, 120/0 | No: positionals after `--` are refused by the parser anyway, exit 2 either way |
| X12 | `state show` takes a dashed first argument as a ref | SURVIVED | 120/0, 120/0 | No: `no item matches '--json'`, exit 2 either way |
| X13 | `rawItem` takes the last item with the id (`findLast`) | SURVIVED (full suite too: 578/0 each half) | 120/0, 120/0 | Yes: nothing pins which item a duplicate id resolves to, B-1 |
| X14 | unknown keys judged against the state-level key set | KILLED | 116/4, 116/4 | the exact-stdout show tests |
| X15 | help omits its own `--help, -h` row | SURVIVED | 120/0, 120/0 | Low |
| X16 | refusal drops "(quote the whole argument, it has spaces)" | SURVIVED | 120/0, 120/0 | Low |
| X17 | `state set` table drops `--slug` | KILLED | 119/1, 119/1 | "the slug is refused by name ..." |
| X18 | known fields printed only when truthy | SURVIVED | 120/0, 120/0 | Low: hides a `decision_required: ""` |
| X19 | pre-scan does not skip the value after a string flag | SURVIVED | 120/0, 120/0 | No: equivalent, a non-dashed value is never a flag name and a dashed one has already thrown |
| X20 | control: `--json` prints the parsed item (the implementer's M5) | KILLED | 118/2, 118/2 | confirms the runner sees kills |

### G. Docs and pointers

- `docs/wiki/The-CLI.md`: every command of the `state add / list / show / set / active`
  transcript and the new help section replayed in a fresh store on bun and node; the output
  matches the page line for line (both runtimes identical). The "stored whole" sentence at
  line 238 is exact for `state.json`, not for `decisions.tsv` (N-1).
- `README.md:327`, `CHANGELOG.md` Unreleased, and the global `./bin/mstack help` (two new lines)
  match what I observed.
- `skills/router/playbooks/feature.md:15` now names `mstack state show <ref>`. Other pointers:
  N-9. No em dash in any added line (`git diff ... | rg "^\+.*—"`: no hits).

### H. Regression

Under "Verification I ran". Green on bun, node 26.13.1 and node 22.6.0; typecheck, lint and
gate green; no load-sensitive failure in any run.

## Changes required

1. `src/state.ts:236-240`, `src/cli.ts:412` - `state show` locates the raw object by `id`, so
   with two items sharing an id it prints the first one's object (`--json`) or its unknown keys
   (text) for the second one's ref, exit 0, on every runtime (B-1). Locate it by position
   (`parseState` maps `items` index for index, `src/state.ts:127`) or by id and slug, and add a
   test with two items sharing an id asserting `state show <second-slug> --json` deep-equals
   the second item. Optional, same pass: pin X1 (`--acceptance=--help` is stored) and X2 (the
   hint on a one-criterion item), one assertion each.
