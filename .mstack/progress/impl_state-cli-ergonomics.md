# Implementation report: state-cli-ergonomics (item 74)

Verdict earned: **test-verified** (rung 4: tests that call the real CLI; the throwaway-store runs are rung 5 for the CLI itself, but no live agent session used the new commands, so not live-verified). Branch
`fix/state-cli-ergonomics`, base `14c2b6c`. Not pushed.

## What changed

`state show <ref>` exists; `--help`/`-h` works on `state add`, `state set`, `state show` and
`decide`; a value starting with `--` is stored whole as `--flag=value`, and the space-separated
form is refused in mstack's own sentence that names `--flag=value`; `state set --acceptance` on an
item that has criteria prints one line naming `--add-acceptance` (still a replace, no prompt). The
parser's options and the help are built from one table per command (`src/cliopts.ts`).

## Files (commits, oldest first)

- `798a6cb` refactor + help: `src/cliopts.ts` (new: `STATE_ADD`, `STATE_SET`, `DECIDE` tables,
  `parseFlags`, `helpText`, `wantsHelp`), `src/cli.ts` (add/set/decide parse through `parseFlags`;
  help is answered in `cmdState` before `requireStore` and before `<ref>` is read, and at the top
  of `cmdDecide`), `tests/state-cli.test.ts` (new).
- `7421156` `state show`: `STATE_SHOW` table, `showLines` and the `show` branch in `src/cli.ts`;
  `rawItem` and `unknownItemFields` in `src/state.ts` (the parse drops unknown keys, so show reads
  the file by id as `updateState` does); global help gains `state show` and the `--help` line.
- `a3d4cc2` `refuseDashedValues` in `src/cliopts.ts`, run by `parseFlags` before `parseArgs`.
- `c6c7107` the `--add-acceptance` line in the `--acceptance` branch of `state set` (`src/cli.ts`).
- `d39b165`, `656ea87` two fixes found by looking at real output: the `--help, -h` row was
  misaligned, and the `--flag=value` suggestion truncated a long value (the test for the latter
  was run red against the old code).
- `fa0753b` docs: `docs/wiki/The-CLI.md` (show, help section, hint in the transcript, transcripts
  from real runs of `./bin/mstack`), `README.md` command table, `CHANGELOG.md`,
  `skills/router/playbooks/feature.md` ("Read the item's seams with `mstack state show <ref>`").
  The other `state active` pointers in `skills/router/SKILL.md`, `agents/orchestrator.md`,
  `skills/router/playbooks/resume.md` are about the active slug and stay.
- The report, the ledger row and three `decisions.tsv` rows are in the closing commit.

## Mutants named before the code (table is final; results below)

State show omits seams / source / decision_required; prints a field the item does not carry;
`--json` drops an unknown key (and the text form drops them); a missing or unmatched ref exits 0;
`--help` falls through to the ref on set, add or decide; `--help` exits 1; help to stderr; `-h`
not recognised; a flag in the table missing from the help; refusal does not name `=`; refusal
skips multiple-valued flags or is off; `--acceptance=--x` stored without dashes; hint printed with
no criteria, never, or on `--add-acceptance`.

## Red output per slice (node half, `node --experimental-strip-types --test tests/state-cli.test.ts`)

Slice 1, `--help` on state set (before any code; the behaviour is missing, not a typo):

```
✖ --help on state set prints the flags, exits 0, and neither resolves --help as an item nor writes [node]
  AssertionError [ERR_ASSERTION]: mstack: no item matches '--help'
  2 !== 0
✖ ... [bun]   (same)
```

Slice 1b (`--help` on add and decide, the "every flag in help" pin): honest note, these passed the
first time, because the table and the three commands were wired in one step with slice 1. They are
guards until the mutants: M7b, M7c, M10 break them (killed, below). No separate red receipt.

Slice 2, `state show` (tests written first; 10 failing, 7 passing before the code):

```
✖ state show prints one item with every field it carries, one per line, in a fixed order [node]  2 !== 0
✖ state show prints nothing for a field the item does not carry [node]            2 !== 0
✖ state show --json prints the raw object, unknown keys included [node]          2 !== 0
✖ state show without a ref, or with one that matches nothing, is a usage error [node]
✖ the global help names state show and says subcommands take --help [node]
(and the same five on [bun]; stderr was "unknown 'state' subcommand 'show'")
ℹ pass 7  ℹ fail 10
```

Slice 3, refusal wording (the `--flag=value` storage test passed first time: that is existing
behaviour, so it is a guard, and M16 breaks it):

```
✖ a value that starts with -- and follows its flag after a space is refused in mstack's words, naming --flag=value [node]
  AssertionError: The input did not match the regular expression /--acceptance was followed by '--needs the equals'/. Input:
  "mstack: Option '--acceptance' argument is ambiguous.\nDid you forget to specify the option argument for '--acceptance'?\nTo specify an option argument starting with a dash use '--acceptance=-XYZ'.\n"
✖ ... [bun]   (identical text: bun 1.3.11 uses node's util.parseArgs wording)
```

Slice 4, the hint:

```
✖ state set --acceptance on an item that has criteria names --add-acceptance; otherwise it stays quiet [node]
    actual: '1 storage-layer (pending)\n  acceptance: 2 criterion(s) replaced with 1\n    - dropped "one"\n    - dropped "two"\n'
✖ ... [bun]
```

(a first green attempt then failed on my own wrong literal `added #3 new-one`; the real label is
`added 3 new-one (pending)`; the test, not the code, was wrong, fixed in the same slice.)

Follow-up fix `656ea87`: long-value suggestion test, red against the old `cliopts.ts` (git stash of
that file): 2 failing, 23 passing; green after.

## Mutant results (`scratchpad/impl74/mut.py`, each applied, `tests/state-cli.test.ts` run on node, reverted)

```
KILLED   M1 show omits seams ℹ fail 2 | ['state show prints one item with every field it carries, on']
KILLED   M2 show omits source ℹ fail 2 | ['state show prints one item with every field it carries, on']
KILLED   M3 show omits decision_required ℹ fail 2 | ['state show prints one item with every field it carries, on']
KILLED   M4 show prints an uncarried field ℹ fail 2 | ['state show prints nothing for a field the item does not ca']
KILLED   M5 --json drops unknown keys ℹ fail 2 | ['state show --json prints the raw object, unknown keys incl']
KILLED   M5b text drops unknown keys ℹ fail 2 | ['state show prints one item with every field it carries, on']
KILLED   M6 missing ref exits 0 ℹ fail 2 | ['state show without a ref, or with one that matches nothing']
KILLED   M6b no-match ref exits 0 ℹ fail 2 | ['state show without a ref, or with one that matches nothing']
KILLED   M7 state set --help falls through to ref ℹ fail 5 | ['--help on state set prints the flags, exits 0, and neither', "every flag the parser takes is in that command's help, bec"]
KILLED   M7b state add --help falls through ℹ fail 3 | ['--help on state add and decide prints their flags to stdou', "every flag the parser takes is in that command's help, bec"]
KILLED   M7c decide --help falls through ℹ fail 3 | ['--help on state add and decide prints their flags to stdou', "every flag the parser takes is in that command's help, bec"]
KILLED   M8 help exits 1 ℹ fail 6 | ['--help on state add and decide prints their flags to stdou', '--help on state set prints the flags, exits 0, and neither']
KILLED   M9 help on stderr ℹ fail 7 | ['--help on state add and decide prints their flags to stdou', '--help on state set prints the flags, exits 0, and neither']
KILLED   M9b -h not recognised ℹ fail 2 | ['--help on state set prints the flags, exits 0, and neither']
KILLED   M10 help drops a flag ℹ fail 3 | ['--help on state add and decide prints their flags to stdou', "every flag the parser takes is in that command's help, bec"]
KILLED   M11 refusal does not name the = form ℹ fail 2 | ['a value that starts with -- and follows its flag after a s']
KILLED   M12 refusal skips multiple flags ℹ fail 2 | ['a value that starts with -- and follows its flag after a s']
KILLED   M12b refusal off ℹ fail 2 | ['a value that starts with -- and follows its flag after a s']
KILLED   M13 hint even with no criteria ℹ fail 2 | ['state set --acceptance on an item that has criteria names ']
KILLED   M14 hint never ℹ fail 2 | ['state set --acceptance on an item that has criteria names ']
KILLED   M15 hint on --add-acceptance too ℹ fail 2 | ['state set --acceptance on an item that has criteria names ']
KILLED   M16 value stored without its dashes ℹ fail 4 | ['a flag followed by an ordinary value, a boolean flag, or a', 'a value that starts with -- is stored whole when passed as']
```

22 mutants, 22 killed, 0 survivors. Each test runs once per runtime, so every kill is a pair.

## VERIFY

1. Suite on the final code commit (`656ea87`): `npm test` runs both halves.

```
bun half:   578 pass, 0 fail, "Ran 578 tests across 27 files. [111.50s]"
node half:  ℹ tests 578  ℹ pass 578  ℹ fail 0   (node v26.13.1)
node 22.6.0 half (PATH=~/.nvm/versions/node/v22.6.0/bin, run before the last two small commits): ℹ pass 578, fail 0;
  its test CLI runs spawn process.execPath, so the CLI itself ran under 22.6.0 for state-cli.test.ts.
typecheck:  bunx --bun tsc --noEmit -> exit 0
lint:       ./bin/mstack lint-plugin .  -> PASSED - 0 failures, 0 warnings
gate:       ./bin/mstack gate --quiet   -> exit 0 (full gate before the report: PASSED - 0 failures, 0 warnings)
docs:       node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 96 relative links checked, 0 broken
```

I did not run `claude plugin validate . --strict` (the CLI is not what I changed; not run).
One unrelated hang seen once: in the first full run `tests/launcher.test.ts` "hostile stdin..." sat for
349 s on a `bun src/cli.ts statusline` child until I killed it, failing that one node-half test (559/560).
The same file passes alone (6/6, 12 s) and the next two full runs (with stdin from /dev/null) were
578/578. Not load-sensitive tests named in the brief (costs 698, run 239) did not fail.

2. Real CLI in a throwaway store (`scratchpad/impl74/store-bun`, `store-node`), forced runtimes
(`bin/mstack` runs `bun` if on PATH, else node; I called `bun src/cli.ts` and
`node --experimental-strip-types src/cli.ts` directly, script `scratchpad/impl74/verify.sh`).
The two transcripts are identical after dropping timestamps and the state.json md5 lines. The
bun transcript, in full (node: `scratchpad/impl74/verify-node.txt`; its before/after md5 of
state.json across `state set --help` and `state set 1 -h` are `8a5849f2e7d7d87c1af857a6998717bd`
twice, bun's are `901ff511c5bbac694899e08dd6d75987` twice, so state.json is byte-identical):

```
$ mstack state add --slug full --title all fields --description prose --acceptance first --acceptance second --source issue 1 --verification npm test --seam CLI: show --decision-required a fork? --sdd
added 1 full (pending)
[exit 0]
$ mstack state add --slug few --title few --acceptance one
added 2 few (pending)
[exit 0]
$ mstack state show full
id: 1
slug: full
title: all fields
status: pending
source: issue 1
description: prose
sdd: true
decision_required: a fork?
verification: npm test
acceptance:
  - first
  - second
seams:
  - CLI: show
review_round: 2
[exit 0]
$ mstack state show 2
id: 2
slug: few
title: few
status: pending
acceptance:
  - one
[exit 0]
$ mstack state show full --json
{
  "id": 1,
  "slug": "full",
  "title": "all fields",
  "acceptance": [
    "first",
    "second"
  ],
  "status": "pending",
  "description": "prose",
  "sdd": true,
  "decision_required": "a fork?",
  "source": "issue 1",
  "verification": "npm test",
  "seams": [
    "CLI: show"
  ],
  "review_round": 2
}
[exit 0]
$ mstack state show
mstack: state show needs an item id or slug
[exit 2]
$ mstack state show nope
mstack: no item matches 'nope'
[exit 2]
$ mstack state add --help
mstack state add --slug S --title T [flags]
  add an item; its id is the next free one and its status is pending

flags:
  --slug <slug>               kebab-case name of the item (required)
  --title <title>             one line saying what the item is (required)
  --description <text>        longer prose about the item
$ mstack state set --help
mstack state set <ref> [flags]
  move or correct an item; <ref> is an id or a slug

flags:
  --status <status>             move the item to this status
  --closed-by <note>            why or how the item closed
  --title <title>               replace the title
$ mstack state show --help
mstack state show <ref> [--json]
  print one item with every field it carries; <ref> is an id or a slug

flags:
  --json      print the item's raw object from state.json as JSON instead
  --help, -h  print this and exit 0

$ mstack decide --help
mstack decide --phase P --decision D --why W --evidence E --result R [--resolves <ref>]
  append one row to .mstack/decisions.tsv; --resolves also answers that item's fork

flags:
  --phase <phase>    where in the work the decision was taken, e.g. design or implement
  --decision <text>  the decision, on one line (required)
  --why <text>       the reasoning, including the alternative that lost
901ff511c5bbac694899e08dd6d75987
901ff511c5bbac694899e08dd6d75987
--- = form
$ mstack state add --slug dashed --title=--t --acceptance=--x --seam=--y --description=--d --source=--s --decision-required=--f
added 3 dashed (pending)
[exit 0]
id: 3
slug: dashed
title: --t
status: pending
source: --s
description: --d
decision_required: --f
acceptance:
  - --x
seams:
  - --y
$ mstack decide --phase=implement --decision=--z --result=--r
recorded
[exit 0]
2026-11-17T13:53:52.396Z	implement	'--z			'--r	
--- space form
$ mstack state add --slug nope --title t --acceptance --x
mstack: --acceptance was followed by '--x', which starts with a dash and so reads as another flag, not as its value
        if it is the value, pass it as one argument: --acceptance=--x
[exit 2]
$ mstack state set 1 --add-acceptance --x
mstack: --add-acceptance was followed by '--x', which starts with a dash and so reads as another flag, not as its value
        if it is the value, pass it as one argument: --add-acceptance=--x
[exit 2]
$ mstack decide --decision --z
mstack: --decision was followed by '--z', which starts with a dash and so reads as another flag, not as its value
        if it is the value, pass it as one argument: --decision=--z
[exit 2]
--- hint
$ mstack state set few --acceptance replacement
2 few (pending)
  acceptance: 1 criterion(s) replaced with 1
    - dropped "one"
    to append instead of replace, use --add-acceptance; the dropped criteria are listed above if this was meant as one
[exit 0]
$ mstack state set few --add-acceptance appended
2 few (pending)
  acceptance: 1 added, now 2
[exit 0]
$ mstack state add --slug fresh --title f --acceptance a
added 4 fresh (pending)
[exit 0]
```

Observation: `decide --decision=--z` is accepted, and `decisions.tsv` stores it as `'--z`: an existing
spreadsheet-formula guard prefixes a quote to values that start with a dash. Not changed here.

3. This repository's own queue, read only: `./bin/mstack state show 74` printed the item with its
description, four acceptance criteria and its one seam; `./bin/mstack state list` printed all items
with `* 74 state-cli-ergonomics (in_progress)` (last lines: 73 done, 74 active, 75 pending).

## Decisions taken (`.mstack/decisions.tsv`, phase implement)

1. Tables and help in a new `src/cliopts.ts`, one file beyond the brief's scope list: `cli.ts` runs
   `main()` on import, so a test cannot read its tables, and the "every parser key is in the help"
   pin needs them importable.
2. Dashed values are refused by a pre-scan of the args, not by rewording `parseArgs`'s error; both
   runtimes print node's text, which varies by version, so nothing depends on it.
3. `--help`/`-h` is recognised as a whole argument anywhere after the command; `state show` with a
   first argument starting with `-` is a missing ref.

## Found, not fixed

- `decide` stores a value that starts with a dash as `'--z` (formula guard in `decisions.add`).
  Accepted and recorded, but the stored text is not byte-identical to the input. The acceptance
  bullet is about acceptance of the value, so I left it; worth its own item if it matters.
- `state --help` (no subcommand) still says `unknown 'state' subcommand '--help'`. The brief names
  the four commands; adding a `state` overview would be a small follow-up.
- `state list` stays label and title only (out of scope).
- The one-off `launcher.test.ts` statusline hang described above (EPIPE test neighbourhood, node 26
  with bun child, stdin inherited from the harness); possibly an item beside 67.
- Not covered: `state set 3 --title -h` (a flag value that is exactly `-h`) now prints help rather
  than the earlier "ambiguous" refusal; it never could have been a value without `=`.

## Per-criterion table

| Criterion | Evidence | Rung | Unproven |
|---|---|---|---|
| 1. `state show <ref>` prints every field incl. source, seams, decision_required | `tests/state-cli.test.ts` "state show prints one item with every field..." (exact stdout on a full item, by slug and by id), "...nothing for a field the item does not carry", `--json` raw-object test, usage-error test; M1-M6b killed; real run on both runtimes | 4 (tests through the real CLI on bun, node 26 and node 22.6), plus rung 5 for the CLI itself in a throwaway store | Multi-line values print with continuation indent; not pinned by a test |
| 2. `--flag=value` accepted for `--acceptance`, `--seam`, `decide --decision`; refusal says so | "a value that starts with -- is stored whole..." (also title, description, source, verification, decision-required, add-acceptance, decide), "...refused in mstack's words, naming --flag=value" on both runtimes incl. a long value; M11, M12, M12b, M16 killed | 4 | `decide` stores `'--z` (see Found); `--flag --x` for a boolean flag is not a refusal case |
| 3. `state set --acceptance` on an item with criteria names `--add-acceptance` | "state set --acceptance on an item that has criteria names --add-acceptance; otherwise it stays quiet" (hint present, absent for empty list, absent on `--add-acceptance` and `state add`; list still replaced); M13-M15 killed | 4 | none |
| 4. `--help` on add, set, decide prints flags, exits 0 | help tests: stdout, empty stderr, exit 0, no write (state.json and decisions.tsv byte-identical), `--help` and `-h`, with and without a ref, outside a repository; table pin per command; M7-M10 killed; real run md5 identical before/after | 4 | none |
