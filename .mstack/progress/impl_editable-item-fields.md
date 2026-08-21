# Implementer report - 13 editable-item-fields

Direct path. The contract is the four-bullet `acceptance` array on item 13 of
`.mstack/state.json`; there is no `.mstack/specs/editable-item-fields/`.

## What changed

`mstack state set` was a status mover with a note field bolted on — `--status`, `--closed-by`,
`--force` — so every other field an item carries was write-once at `state add`. It now takes
every field `state add` takes (`--title`, `--description`, `--source`, `--verification`,
`--acceptance`, `--sdd`, `--decision-required`), plus `--add-acceptance` so the appending
half of the list semantics is reachable, and `--clear <field>` as the single spelling for
removal. A field the item does not carry yet is added rather than refused; an empty value is
refused rather than stored, because a key whose value is `""` round-trips through `state.json`
as present-but-blank and `src/gate.ts:190` already reads that as absent; and every edit prints
one line per field it touched, naming what it replaced, because the one edit whose damage the
gate cannot see is an `--acceptance` that drops three of four quoted criteria. The serious half
is `--decision-required`. `DECISION_REQUIRED_FROM` was guarded in one direction only — the CLI
refused to move an item *into* `spec_ready` or beyond with a fork unanswered — so attaching a
fork to an item already sitting there was a new way to create a state the gate reports. That is
now refused as well, with `--force` as the loud override that prints the gate failure it is
creating, and rewriting or clearing the fork prose drops `decision_resolved`, because the gate
matches an answering row on its timestamp and the slug it resolves and never on the question,
so a pointer left behind would let the next fork be born answered.

Inside one `state set` the order is: clears, then the status move, then the value flags, with
`--decision-required` last. That is what makes both single-command shapes work — dropping a
fork and moving on, and parking an item before attaching one — and it is why the attach gate
judges the status the item ends up in rather than the one it started from. Two instructions for
one field in one command are refused instead of silently ordered, and a `state set` handed
nothing to set exits 2 instead of rewriting the file unchanged and printing the label.

## Files

- `src/cli.ts` — USAGE lines 27-28; `CLEARABLE`/`UNCLEARABLE`/`preview`/`fieldChange`/
  `required`/`clearField` at 172-249; the rewritten `state set` branch at 315-513
  (802 lines, was 566).
- `tests/cli.test.ts` — nine tests, 77-297 (297 lines, was 64).
- `tests/decisions.test.ts` — six tests, 163-357 (569 lines, was 368).
- `docs/wiki/The-CLI.md` — two new subsections, 93-183.
- `docs/wiki/State-Files.md` — the `decision_resolved` row, 36.
- `README.md` — one paragraph under "A product fork is a gate, not a note", 123-126.
- `.mstack/decisions.tsv` — five rows, `2026-08-21T09:10:24.170Z` to `...09:10:57.329Z`.
- `.mstack/progress/current.md` — plan, log and next step.

Commits: `ceda13b` (CLI + tests), `a426edc` (the idempotence test), `0041e54` (docs).

## Design decisions

Each is one row in `.mstack/decisions.tsv`, phase `implement`, written before the code.

| ts | Decision | Why, in short |
|---|---|---|
| `09:10:24.170Z` | `--acceptance` replaces the whole list; `--add-acceptance` appends | Every other `set` flag states the new value, and correcting a mis-quoted criterion means replacing it, not carrying both wordings. Append is reachable through its own flag rather than being unreachable or implied. One command may not do both. |
| `09:10:32.623Z` | Clearing is `--clear <field>`; an empty string value is refused | `--description ""` reads as "set it to nothing" and stores a third state nobody asked for. The two files already disagree about it: `src/gate.ts:190` treats `decision_required: ""` as no fork. |
| `09:10:40.786Z` | Attaching a fork at or past `spec_ready` is refused, not auto-reverted; `--force` attaches and says what it created | Refusing guards the line the status move is already refused across, in the other direction, instead of inventing a second rule. Auto-reverting would have to force a transition the lifecycle forbids: `in_progress` allows only `reviewing` and `cancelled` (`src/lifecycle.ts:67`), and `done` allows nothing (`:70`). |
| `09:10:48.423Z` | Rewriting `decision_required` to different prose drops `decision_resolved` | The gate matches a row on `ts` and `resolves` only (`src/gate.ts:223`), never on the question, so the old answer would answer the new fork. Identical prose is left alone, so restating a fork stays idempotent. |
| `09:10:57.329Z` | `--title` is settable, `--slug` is refused by name, `--sdd` carries no artifact check | The slug is the only field with references outside `state.json` and none of them move with it. `--sdd` past `specifying` is only *conditionally* a gate failure — the spec may be on disk — so guarding it would mean duplicating the gate's filesystem check in the CLI. Stated as a boundary, not silence. |

Two boundaries this pass did **not** cross, both deliberate: `decision_resolved` stays
writable only by `mstack decide --resolves`, which is what `src/state.ts:19-27` promises; and
`CHANGELOG.md` is untouched because no skill, agent file or CONTRIBUTING rule assigns it to the
implementer and item 12's fix is not in it either.

## Commands

### The new tests are red against `main`

Driver: `scratchpad/against-main.mjs`. It takes a byte copy of the branch's `src/cli.ts`,
writes `git show main:src/cli.ts` over it, runs the two test files, restores **from the byte
copy**, and aborts unless the restored file reproduces the original sha256.

```console
$ SCRATCH=.../scratchpad node $SCRATCH/against-main.mjs
swapped in main:src/cli.ts (21740 bytes) over the branch copy (32489 bytes)

red against main: 14 test(s)
  (fail) a fork can be attached during specifying, which is where the workflow says it is found
  (fail) attaching a fork to an item already past the line is refused, and names both routes
  (fail) --force attaches it where it stands and says the gate will now fail
  (fail) rewriting the fork drops the answer to the question it replaced
  (fail) restating the same fork changes nothing, even on an item past the line
  (fail) --clear decision-required drops the pointer along with the question
  (fail) state set corrects every field state add can set
  (fail) a field the item does not carry yet is added rather than refused
  (fail) --clear removes a field, and an empty value is refused rather than stored
  (fail) --acceptance replaces the list and --add-acceptance appends to it
  (fail) acceptance cannot be cleared, because the gate fails an item with none
  (fail) the slug is refused by name, because nothing that references it moves with it
  (fail) a set that was handed nothing to do says so instead of reporting success
  (fail) two instructions for one field in one command are refused, not ordered

20 pass
 14 fail
restored, sha256 757ec4e0d2e80269 matches the byte copy
```

Fourteen of the fifteen new tests. The fifteenth — `--status and --closed-by keep working
exactly as before` — is a regression test for criterion 4, so it is green against `main` by
construction; that is the point of it. Its bite is proven instead by mutation M10 below, which
is the only honest way to show a regression test can fail.

### Mutation runs

Driver: `scratchpad/mutate.mjs`. Same discipline, and for the reason recorded in this repo's
own log: a previous driver here restored with `git checkout`, discarded an uncommitted fix, and
reported results against unmodified code. This one takes a byte copy first, refuses to run a
mutation whose pattern is not found (`SETUP-ERROR` rather than a silent pass), asserts the file
on disk actually changed before running the suite, restores with `copyFileSync` from the byte
copy, and re-checksums after every single mutation.

```console
$ SCRATCH=.../scratchpad node $SCRATCH/mutate.mjs
byte copy of src/cli.ts at .../scratchpad/cli.ts.bytes, sha256 757ec4e0d2e80269
M1  killed      the fork-attach gate never fires
      killed by: attaching a fork to an item already past the line is refused, and names both routes
M2  killed      rewriting the fork keeps the old decision_resolved pointer
      killed by: rewriting the fork drops the answer to the question it replaced
M3  killed      --acceptance appends instead of replacing
      killed by: state set corrects every field state add can set
      killed by: --acceptance replaces the list and --add-acceptance appends to it
M4  killed      --clear decision-required leaves the pointer behind
      killed by: --clear decision-required drops the pointer along with the question
M5  killed      an empty value is stored instead of refused
      killed by: --clear removes a field, and an empty value is refused rather than stored
M6  killed      acceptance drops off the unclearable list
      killed by: acceptance cannot be cleared, because the gate fails an item with none
M7  killed      a set with no instructions reports success again
      killed by: a set that was handed nothing to do says so instead of reporting success
M8  killed      --slug stops being refused by name
      killed by: the slug is refused by name, because nothing that references it moves with it
M9  killed      a forced attach stops saying what it created
      killed by: --force attaches it where it stands and says the gate will now fail
M10  killed      --closed-by becomes a no-op
      killed by: --status and --closed-by keep working exactly as before
M11  killed      contradictory instructions are silently ordered instead of refused
      killed by: two instructions for one field in one command are refused, not ordered
M12  killed      the idempotence guard fires on every write
      killed by: restating the same fork changes nothing, even on an item past the line

restored, sha256 757ec4e0d2e80269 matches the byte copy
all mutations killed
```

M6 and M8 are worth reading twice: both leave the exit code at 2 and change only the reason
printed, so they are killed by the message assertions rather than by the status check. A test
that only asserted "exit 2" would have let both through.

### `npm test`, both runtimes

```console
$ npm test

> mstack@0.1.0 test
> bun test tests/ && node --test 'tests/*.test.ts'

bun test v1.3.11 (af24e281)

tests/fanout.test.ts:

-- review fan-out on storage-layer
[ok]    correctness -> review_storage-layer_correctness.md (43 bytes)
[fail]  security returned without writing its report
        fix: its reply is not evidence; re-run it and have it write the file before returning

-- review fan-out on storage-layer
[ok]    correctness -> review_storage-layer_correctness.md (43 bytes)
[fail]  security wrote a stub, not a report
        fix: an empty file is indistinguishable from no work

-- review fan-out on storage-layer
[ok]    correctness -> review_storage-layer_correctness.md (57 bytes)
[ok]    security -> review_storage-layer_security.md (54 bytes)

-- review fan-out on storage-layer
[ok]    correctness -> review_storage-layer_correctness.md (43 bytes)
[warn]  review_storage-layer_freelance.md was not in the plan; nothing will read it

 191 pass
 0 fail
Ran 191 tests across 13 files. [15.58s]
```

(The `[fail]` lines above are a fan-out fixture's own report output under test, not test
failures; the counts on the next lines are the suite's.) The node half, with the block covering
the new tests kept whole and the other 167 `✔` lines cut where marked:

```console
✔ `state active` prints the slug alone, so command substitution works (186.573792ms)
✔ with nothing active, stdout stays empty and the note goes to stderr (185.1065ms)
✔ an unknown command exits 2 and says what to run instead (176.672958ms)
✔ outside an mstack repository the error names the fix (31.964083ms)
✔ state set corrects every field state add can set (148.979375ms)
✔ a field the item does not carry yet is added rather than refused (143.019833ms)
✔ --clear removes a field, and an empty value is refused rather than stored (174.029042ms)
✔ --acceptance replaces the list and --add-acceptance appends to it (170.405959ms)
✔ acceptance cannot be cleared, because the gate fails an item with none (146.537375ms)
✔ the slug is refused by name, because nothing that references it moves with it (123.527875ms)
✔ a set that was handed nothing to do says so instead of reporting success (136.237042ms)
✔ two instructions for one field in one command are refused, not ordered (129.096542ms)
✔ --status and --closed-by keep working exactly as before (212.786166ms)
✔ --resolves writes the row and the pointer together (181.359583ms)
✔ --resolves on an item with no fork is refused, not silently accepted (186.149959ms)
✔ --resolves naming an item that does not exist writes nothing (177.820292ms)
✔ a decision without --resolves is still recorded, and unblocks nothing (152.641042ms)
✔ state set refuses to move an item past its open fork (213.969083ms)
✔ --force still moves it, because the gate is the authority and this is the speed bump (256.909667ms)
✔ a fork can be attached during specifying, which is where the workflow says it is found (277.185125ms)
✔ attaching a fork to an item already past the line is refused, and names both routes (225.751917ms)
✔ --force attaches it where it stands and says the gate will now fail (197.745334ms)
✔ rewriting the fork drops the answer to the question it replaced (180.233916ms)
✔ restating the same fork changes nothing, even on an item past the line (232.32525ms)
✔ --clear decision-required drops the pointer along with the question (150.700959ms)
✔ the row says which fork it answers, so no other row can close it (180.972208ms)
✔ resolving a fork demands an answer that says something (251.861083ms)
[... 167 more ✔ lines, tests/decisions.test.ts:227 through tests/tsv.test.ts ...]
ℹ tests 191
ℹ suites 0
ℹ pass 191
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5197.61375
```

191 on both runtimes, up from 176 at the start of this pass: 15 new tests.

### `npm run typecheck`

```console
$ npm run typecheck

> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit

$ echo $?
0
```

### `./bin/mstack lint-plugin .`

```console
$ ./bin/mstack lint-plugin . | tail -12
[ok]    20 reference file(s), every relative link resolves

-- shipped commands
[ok]    32 file(s), no command that would hang on stdin

-- cross-references
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves

-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings
```

### `./bin/mstack gate`

```console
$ ./bin/mstack gate
-- store
[ok]    state.json exists
[ok]    progress/current.md exists
[ok]    progress/history.md exists
[ok]    state.json parses and has the right shape (15 items)

-- state
[ok]    ids are unique
[ok]    slugs are unique
[ok]    every item has at least one acceptance criterion
[ok]    one active item: editable-item-fields (in_progress)
[ok]    progress/current.md tracks the active item
[ok]    no item carries a decision fork
[ok]    no sdd item is past specifying
[ok]    11 closed item(s) carry a ledger verdict

-- workspace
[ok]    on branch feat/editable-item-fields
[warn]  2 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 1 warning
```

The two uncommitted files at the time of that run are `decisions.tsv` and `current.md`,
committed with this report.

### The running system, in a scratch repository

Everything below is one continuous session against a real store, driving the shipped
`bin/mstack` launcher as a process. This is also where the docs transcripts come from.

```console
$ mstack state set export-json --status specifying
3 export-json (specifying)
  status: "pending" -> "specifying"

$ mstack state set export-json --decision-required "Is this a stable public contract ..."
3 export-json (specifying)
  decision_required: (unset) -> "Is this a stable public contract other tools ..."

$ mstack state set export-json --status spec_ready
mstack: export-json has an unanswered decision: "Is this a stable public contract other tools may depend on, or a convenience dump we are free to change?"
        answer it with 'mstack decide --resolves export-json ...' first

$ mstack state set cli-search --status in_progress
2 cli-search (in_progress)
  status: "pending" -> "in_progress"

$ mstack state set cli-search --decision-required "Does search match the body ..."
mstack: cli-search is in_progress, at or past the point where a fork must already be answered
        park it first ('mstack state set cli-search --status blocked --decision-required ...'), or pass --force to attach it where it stands and let the gate report it

$ mstack state set cli-search --status blocked --decision-required "Does search match the body ..."
2 cli-search (blocked)
  status: "in_progress" -> "blocked"
  decision_required: (unset) -> "Does search match the body as well as the tit..."
```

And the `--force` branch, from the same kind of run, with the gate's answer immediately after:

```console
$ mstack state set 1 --decision-required "A third question entirely, one whose two answers produce different work." --force
1 export-json (in_progress)
  decision_required: "Is the sort order part of the public contract..." -> "A third question entirely, one whose two answ..."
  forced: export-json is in_progress and now carries an unanswered fork, so 'mstack gate' fails until 'mstack decide --resolves export-json ...' answers it
   exit 0

$ mstack gate --quiet
   exit 1
```

## R to test

Direct path, so the map is over the four `acceptance` bullets of item 13.

| # | Acceptance bullet | Test | Where |
|---|---|---|---|
| 1 | `state set <ref>` can correct every field `state add` can set, including `--decision-required`, `--verification`, `--description`, `--source` and `--acceptance` | `state set corrects every field state add can set` (all eight flags in one command, each read back from the parsed store) | `tests/cli.test.ts:77` |
| 1 | ...and the fork field in particular, which is the reason the item exists | `a fork can be attached during specifying, which is where the workflow says it is found` | `tests/decisions.test.ts:173` |
| 2 | Correcting a field an item does not have yet **adds** it | `a field the item does not carry yet is added rather than refused` (asserts the fixture starts without them, or the test proves nothing) | `tests/cli.test.ts:128` |
| 2 | Clearing is possible and has a stated spelling | `--clear removes a field, and an empty value is refused rather than stored` (the key is removed, not blanked; `--source ""` exits 2 and the message names `--clear source`) | `tests/cli.test.ts:159` |
| 2 | ...and the stated spelling has stated limits | `acceptance cannot be cleared, because the gate fails an item with none`; `the slug is refused by name, because nothing that references it moves with it` | `tests/cli.test.ts:204`, `tests/cli.test.ts:218` |
| 2 | ...and clearing a fork takes its answer with it | `--clear decision-required drops the pointer along with the question` | `tests/decisions.test.ts:334` |
| 3 | Adding `--decision-required` past `in_progress` is refused **or** forces the item back — refused, here | `attaching a fork to an item already past the line is refused, and names both routes` (nothing written on refusal; the park-and-attach one-liner then leaves `mstack gate` green) | `tests/decisions.test.ts:194` |
| 3 | The choice is **recorded rather than implied** | `--force attaches it where it stands and says the gate will now fail` (asserts the `forced:` line naming the item, its status and what would clear it, then asserts the gate reports exactly that) | `tests/decisions.test.ts:231` |
| 3 | The gate agrees with the CLI: no new state the CLI creates is reported by `src/gate.ts` unless `--force` said so | green gate asserted after an attach below the line and after park-and-attach; red gate asserted after a forced attach | `tests/decisions.test.ts:184`, `:225`, `:244` |
| 3 | The old answer does not survive a new question | `rewriting the fork drops the answer to the question it replaced`; `restating the same fork changes nothing, even on an item past the line` | `tests/decisions.test.ts:252`, `:302` |
| 4 | Tests cover setting **each** field on an existing item | `tests/cli.test.ts:77` (title, description, source, verification, acceptance, decision-required, sdd), `:181` (acceptance and add-acceptance separately), `:268` (status, closed-by) | above |
| 4 | ...the interaction with the decision gate | `tests/decisions.test.ts:173`, `:194`, `:231`, `:252`, `:302`, `:334` | above |
| 4 | ...and that `--status` and `--closed-by` keep working exactly as before | `--status and --closed-by keep working exactly as before` (legal move, label line unchanged, illegal move refused with the same message, `--force` allows it, `--closed-by` note written, bad status refused) | `tests/cli.test.ts:268` |

One input under bullet 4 changed and I am not going to bury it: `--closed-by ""` used to
succeed and write `closed_by: ""`; it now exits 2 and names `--clear closed-by`. Nothing in
this repository passes it, and exempting one flag from the empty-value rule would have made
`--closed-by` the odd one out. It is the same decision as the `09:10:32.623Z` row, applied
uniformly, and a reviewer who reads "exactly as before" strictly should see it and rule on it.

## Where each claim stopped on the ladder

| Claim | Rung | What backs it |
|---|---|---|
| The defect: `state set` could not reach any field but status, so `decision_required` was unreachable at the moment the workflow says the fork appears | 5 | `main`'s binary, real store: 14 of the 15 new tests fail against `main:src/cli.ts`, and the reasons are unknown-option errors and unwritten fields |
| Every field `state add` sets can now be corrected, added and cleared | 5 | Driven through the shipped `bin/mstack` as a process in scratch repositories (transcripts above), plus rung 4 across both runtimes |
| The fork gate refuses an attach past the line, and `--force` announces what it creates | 5 | Refusal, park-and-attach and forced attach all run in a real store, with `mstack gate` exiting 0 and 1 as the CLI said it would |
| Rewriting the fork does not inherit the old answer | 4 | `tests/decisions.test.ts:252` proves it end-to-end (pointer gone, and the next status move refused, quoting the *new* question); mutation M2 kills the test |
| Every new test fails without the change | 4 | 14 red against `main`; the 15th is a regression test whose bite is shown by mutation M10 |
| The new logic is not over-tested against itself | 4 | 12 targeted mutations, all killed by a named test, byte-copy restore verified by sha256 after each |
| Both runtimes green, types clean, plugin lint clean | 4 | `npm test` 191/191 on bun and node, `tsc --noEmit` exit 0, `lint-plugin` 0 failures 0 warnings |
| The docs describe the shipped behaviour | 5 | Every console block added to `docs/wiki/The-CLI.md` is pasted from the scratch-repo run above, not retyped |
| `--sdd` past `specifying` can still produce a state the gate reports (missing spec artifacts) | 2 | Read at `src/gate.ts:250-286`; **not** run, and deliberately out of scope — recorded as the `09:10:57.329Z` decision rather than fixed |

The one thing I could not take past rung 2 is the `--sdd` boundary in the last row. It is a
pre-existing shape (`state add --sdd` on an item that is later moved forward does the same
thing), it is not in any of the four acceptance bullets, and I would rather it be visible here
than quietly widened into this item.

## What a reviewer should poke at

- The empty-value rule applied to `--closed-by`, called out under the R-to-test table.
- The order inside one `state set` (clears, status, values, fork last). It is asserted
  behaviourally at `tests/decisions.test.ts:194` and `:334`, but no test pins the order as
  such, because the order is only observable through those two shapes.
- Whether refusing the attach past the line is the right half of criterion 3's "either/or".
  The argument is in the `09:10:40.786Z` decision row; the alternative is a bigger behaviour
  change and would have to force transitions `src/lifecycle.ts:63-73` forbids.
