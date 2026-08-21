# Review - editable-item-fields

**Verdict:** CHANGES_REQUESTED

Reviewer pass. I did not write this code. Gate is green and the core mechanism is sound: the
fork can now be attached where the workflow says it is found, the guard is real, and 24 of the
27 mutations I ran independently were killed by a named test. What blocks is four things the
implementer's own standards catch: six doc transcripts the shipped CLI no longer reproduces,
two doc blocks whose command and output come from different invocations, a change line that can
print an identical before and after while silently dropping `decision_resolved`, and four of the
six clearable fields with no falsifiable test.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| Every field `state add` sets is correctable | `state set corrects every field state add can set` `tests/cli.test.ts:77` | Removing any one of the nine entries in the `set` options table (`src/cli.ts:320-334`) turns it red. Nine separate mutations, all killed |
| A field the item lacks is added, not refused | `a field the item does not carry yet is added rather than refused` `tests/cli.test.ts:128` | Fixture asserts absence first (`:133-135`), so the test cannot pass vacuously |
| Clearing has a stated spelling | `--clear removes a field, and an empty value is refused rather than stored` `tests/cli.test.ts:159` | Covers `description` only. **`source`, `verification`, `sdd`, `closed-by` are uncovered** - see required #4 |
| Clearing a fork takes its answer | `--clear decision-required drops the pointer along with the question` `tests/decisions.test.ts:334` | Mutation `DROP-resolved-on-clear` killed |
| Attach below the line works | `a fork can be attached during specifying...` `tests/decisions.test.ts:173` | Asserts a green gate at `:184`, then the refusal the fork now causes at `:186-188` |
| Attach at/past the line is refused | `attaching a fork to an item already past the line is refused, and names both routes` `tests/decisions.test.ts:194` | Mutation `GUARD-fork-attach` killed; `:204-208` asserts nothing was written |
| `--force` announces what it creates | `--force attaches it where it stands and says the gate will now fail` `tests/decisions.test.ts:231` | Mutation `FORCED-LINE` killed. Asserts the gate then fails, `:244-246` |
| A rewrite drops the old answer | `rewriting the fork drops the answer to the question it replaced` `tests/decisions.test.ts:252` | Mutation `DROP-resolved-on-rewrite` killed |
| Restating the same fork is a no-op | `restating the same fork changes nothing, even on an item past the line` `tests/decisions.test.ts:302` | Mutation `IDEMPOTENCE-off` (`fork !== item.decision_required` -> `true`) killed |
| `--acceptance` replaces, `--add-acceptance` appends | `--acceptance replaces the list and --add-acceptance appends to it` `tests/cli.test.ts:181` | Mutations `ACCEPTANCE-APPENDS` and `ADD-ACCEPTANCE-replaces` both killed |
| `--status` / `--closed-by` unchanged | `--status and --closed-by keep working exactly as before` `tests/cli.test.ts:268` | Mutation `CLOSED-BY-noop` killed. **`--closed-by ""` did change and is not exercised** - minor #2 |
| Apply order (clears, status, values, fork last) | pinned behaviourally | Moving the whole `--decision-required` block above the status move reddens 8 tests. The implementer said no test pins the order; one effectively does |
| `--sdd` set on an item past `specifying` | none | **Uncovered, and it turns a green gate red at exit 0** - required #6 |
| Preview truncation | none | Mutation `PREVIEW-no-truncate` **SURVIVED** - required #3 |

## Acceptance, quoted

**"'mstack state set <ref>' can correct every field 'state add' can set, including --decision-required, --verification, --description, --source and --acceptance"**
Met. `tests/cli.test.ts:77-126` passes all eight value flags in one command and reads every one
back from the parsed store, including `--sdd` and `--decision-required`. I removed each of the
nine option-table entries at `src/cli.ts:320-334` one at a time and each removal reddened a
named test (`OPT-title-in-set`, `OPT-description`, `OPT-acceptance`, `OPT-add-acceptance`,
`OPT-sdd`, `OPT-source`, `OPT-verification`, `OPT-decision-required`, `OPT-clear`), and the same
for each row of the value-flag loop at `src/cli.ts:434-440`. The one `state add` field `state
set` refuses is `--slug` (`src/cli.ts:345-350`), recorded as a decision at
`.mstack/decisions.tsv` `2026-08-21T09:10:57.329Z`. I accept it: `src/gate.ts:256` joins
`store.specs` with the slug, `src/ledger.ts` keys rows by target slug and `src/fanout.ts` names
reports from it, and none of those move. Refusing by name beats an unknown-option error.

**"Correcting a field an item does not have yet adds it; clearing one is possible and has a stated spelling"**
Partially met. The adding half is met and the test is honest about it - `tests/cli.test.ts:133-135`
asserts the fixture starts without the fields, so the test cannot pass vacuously. The clearing
half works for all six fields; I ran every one (evidence below). But only two of the six are
covered by any test. Deleting `source`, `verification`, `sdd` or `closed-by` from `CLEARABLE`
(`src/cli.ts:174-179`) leaves all 34 tests in the two files green. See required #4.

**"The decision fork gate still refuses: adding --decision-required to an item already past in_progress is either refused or forces the item back, and the choice is recorded rather than implied"**
Met, and it is the strongest part of the change. Refused at `src/cli.ts:485-490`; the guard
judges the status the item *ends up in*, because the fork block runs after the status move, which
is what makes the one-command park-and-attach work (`tests/decisions.test.ts:213-225`, gate green
at `:225`). The choice is recorded, not implied: `.mstack/decisions.tsv` `2026-08-21T09:10:40.786Z`
argues refusing over auto-reverting because `in_progress -> specifying` and `done -> anything`
are not legal (`src/lifecycle.ts:63-73`), which I checked and is correct. I also followed the
`--force` path to its end on a `done` item - the worst case, since `done` has no transitions -
and it is defensible: the command prints the failure it creates, the gate reports it, and
`mstack decide --resolves` clears it without a status move. Transcript below.

**"Tests cover setting each field on an existing item, the interaction with the decision gate, and that --status and --closed-by keep working exactly as before"**
Partially met. Setting each field: covered, proven by mutation rather than by reading. Decision
gate interaction: six tests at `tests/decisions.test.ts:173-357`, every guard mutation killed.
"Exactly as before": one input changed. On `main`, `state set X --closed-by ""` exits 0 and writes
`closed_by: ""`; on this branch it exits 2. The implementer disclosed this in its report and I
agree the new behaviour is better - but the test named "keep working exactly as before" does not
exercise the one input that stopped working the same way. Minor #2.

## Verification I ran

`mstack gate --full`, which runs the item's own `verification` field
(`npm test && npm run typecheck && ./bin/mstack lint-plugin .`):

```console
$ ./bin/mstack gate --full
-- state
[ok]    one active item: editable-item-fields (in_progress)
[ok]    no item carries a decision fork
[ok]    no sdd item is past specifying
[ok]    11 closed item(s) carry a ledger verdict
-- workspace
[ok]    on branch feat/editable-item-fields
[ok]    working tree is clean
-- verification
 191 pass
 0 fail
Ran 191 tests across 13 files. [13.11s]
ℹ pass 191
ℹ fail 0
PASSED - 0 failures, 0 warnings
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
```

Green on both runtimes. No new dependency (`package.json` has only `@types/node` and
`typescript` in `devDependencies`), `src/cli.ts` imports `node:util` and relative modules only,
and no debug leftover in the diff.

### Ledger

```console
$ ./bin/mstack ledger check editable-item-fields
FAIL no verdict at 01ce70e1; 1 row(s) exist at other SHAs and a new head SHA voids them
```

Expected shape, not a finding. The only row is the implementer's, at `3a269781`, and
`git diff --stat 3a26978 01ce70e` is `.mstack/ledger.tsv | 1 +` - the commit that recorded the
verdict is what moved the head. No source file differs. `ledger check` at head FAILs the same way
for `rm-guard-command-boundary`, an item already closed and approved; `src/gate.ts:303-306`
documents that the gate deliberately does not hold closed items to today's HEAD. There is no
reviewer verdict yet, which is correct - this pass produces it.

### Tests were not weakened

```console
$ git diff --numstat c2dbba8..01ce70e -- tests/
233	0	tests/cli.test.ts
202	1	tests/decisions.test.ts
```

The single deleted line is an import reorder. No assertion was removed or loosened.

### Mutation sweep, run independently

Driver at `scratchpad/mutate.mjs` and `scratchpad/mutate2.mjs`, against a `git clone` of the
branch in the scratchpad so the working tree was never touched. Byte copy first, `SETUP-ERROR`
rather than a silent pass when a pattern is missing or ambiguous, sha256 re-checked after every
restore. 27 mutations, 24 killed:

```
   OPT-title-in-set / OPT-description / OPT-acceptance / OPT-add-acceptance /
   OPT-sdd / OPT-source / OPT-verification / OPT-decision-required / OPT-clear   killed
   VALUE-title / VALUE-description / VALUE-source / VALUE-verification           killed
   GUARD-fork-attach                                                             killed
   DROP-resolved-on-rewrite / DROP-resolved-on-clear                             killed
   EMPTY-allowed / SLUG-allowed / NOTHING-TO-SET                                 killed
   CONTRADICTION / BOTH-LISTS                                                    killed
   ACCEPTANCE-APPENDS / ADD-ACCEPTANCE-replaces                                  killed
   UNCLEARABLE-acceptance / FORCED-LINE / IDEMPOTENCE-off / CLOSED-BY-noop        killed
   SDD-set-true / CLEARABLE-description / CHANGE-LINES-silent                    killed
   ORDER-fork-before-status                                                      killed
>> CLEARABLE-source / CLEARABLE-verification / CLEARABLE-sdd / CLEARABLE-closed-by  SURVIVED
>> PREVIEW-no-truncate                                                             SURVIVED
>> REQUIRED-trims                                                                  SURVIVED
>> CLEAR-already-unset                                                             SURVIVED
>> ASSERT-WRITABLE-set                                                             SURVIVED
restored, sha256 757ec4e0d2e80269 matches
```

### The `--force` path on a `done` item, end to end

```console
$ mstack gate --quiet                     # clean done item, ledger row present
exit=0
$ mstack state set d-item --decision-required "A brand new question with two different answers." --force
1 d-item (done)
  decision_required: (unset) -> "A brand new question with two different answers."
  forced: d-item is done and now carries an unanswered fork, so 'mstack gate' fails until 'mstack decide --resolves d-item ...' answers it
exit=0
$ mstack gate --quiet
exit=1
$ mstack state set d-item --status blocked
mstack: done -> blocked is not a legal transition
exit=2
$ mstack decide --resolves d-item --phase ship --decision "..." --why "..." --evidence "..." --result "..."
recorded, and d-item no longer has an open fork
exit=0
$ mstack gate --quiet
exit=0
```

Recoverable, announced, and the announcement names the exact command that works. I accept this
decision as argued.

## Changes required

### 1. Six doc transcripts the shipped CLI no longer reproduces

`README.md:76-77`, `docs/wiki/Getting-Started.md:129-130` and `:197-202`,
`docs/wiki/The-CLI.md:75-76`.

Every one of them shows `state set --status X` printing the label line alone. `src/cli.ts:512`
now prints a change line per field touched, so all six are stale. Real runs, this branch's
binary, a scratch store built by the same `state add` the pages show:

```console
$ mstack state set greet-flag --status in_progress
1 greet-flag (in_progress)
  status: "pending" -> "in_progress"          <- docs show only the first line

$ mstack state set greet-flag --status reviewing
1 greet-flag (reviewing)
  status: "in_progress" -> "reviewing"

$ mstack state set greet-flag --status done --closed-by "demo walkthrough"
1 greet-flag (done)
  status: "verifying" -> "done"
  closed_by: (unset) -> "demo walkthrough"    <- Getting-Started.md:202 shows one line
```

`CONTRIBUTING.md:43-46` makes this a bug, not a nit: "If a README or wiki change shows command
output, run the command and paste what it printed... the ones that did not reproduce were treated
as bugs." `docs/wiki/The-CLI.md:75-76` is the sharpest case - it sits three lines above the
section commit `0041e54` added, on the page that commit rewrote. Nothing in `mstack gate` or
`lint-plugin` checks transcripts, so review is the only thing standing between this and the wiki.

**What would satisfy me:** re-run each of the six and paste what they print.

### 2. `docs/wiki/The-CLI.md:150-152` and `:170-173` pair an elided command with un-elided output

The page prints `--decision-required "Is this a stable public contract ..."` and then shows the
output of a command that passed the full sentence. Running exactly what the page shows:

```console
$ mstack state set export-json --decision-required "Is this a stable public contract ..."
3 export-json (specifying)
  decision_required: (unset) -> "Is this a stable public contract ..."

$ mstack state set export-json --status spec_ready
mstack: export-json has an unanswered decision: "Is this a stable public contract ..."
        answer it with 'mstack decide --resolves export-json ...' first
```

The page shows `"Is this a stable public contract other tools ..."` on the preview line and the
full question in the refusal. Same shape at `:170-173` for `cli-search`. The implementer's report
claims rung 5 for "Every console block added to `docs/wiki/The-CLI.md` is pasted from the
scratch-repo run above, not retyped" - true of the output lines, not of the `$` lines.

**What would satisfy me:** paste the real command, or elide the output to match. A reader who
copies the block must get the block back.

### 3. `src/cli.ts:191-197` - the change line can print an identical before and after while dropping the answer

`preview()` collapses whitespace and truncates at 48 characters, so two genuinely different forks
that share a 45-character prefix produce the same string on both sides of the arrow:

```console
$ mstack state set p-item --decision-required "Should the export be a stable public contract we are free to reshape at will?"
1 p-item (specifying)
  decision_required: "Should the export be a stable public contract..." -> "Should the export be a stable public contract..."
  decision_resolved: "2026-08-21T09:40:18.366Z" -> (unset)
exit=0
```

The previous question was `"Should the export be a stable public contract other tools may depend
on?"`. The line that exists to make the write visible shows no change. Same for a whitespace-only
edit, since `required()` at `src/cli.ts:223-226` validates with `.trim()` but stores the value
untrimmed, so `"Q "` and `"Q"` are a rewrite:

```console
$ mstack state set storage-layer --decision-required "$Q " --force
1 storage-layer (in_progress)
  decision_required: "Is this a stable public contract other tools ..." -> "Is this a stable public contract other tools ..."
  decision_resolved: "2026-08-21T09:34:32.582Z" -> (unset)
  forced: ...
```

This is precisely the failure `fieldChange`'s own docstring at `src/cli.ts:200-208` says the
function exists to prevent - "a write nobody sees is indistinguishable from a no-op, and what it
overwrote is gone" - landing on the one field where the same command silently un-answers a fork.
On an item below the line with no answer yet, the `decision_resolved` line is absent too, so the
whole command prints nothing distinguishable.

**What would satisfy me:** when the two previews are equal and the values are not, print the full
values (or the diverging tail, or an explicit `(prose changed)` marker), plus a test with two long
forks sharing a prefix. `PREVIEW-no-truncate` survived, so nothing pins preview behaviour today.

### 4. `src/cli.ts:174-179` - four of the six clearable fields have no test

`docs/wiki/The-CLI.md:131-132` promises six: `description`, `source`, `verification`,
`decision-required`, `sdd`, `closed-by`. All six work - I ran them:

```console
--clear description  1 c-item (pending) |   description: "d" -> (unset)     exit=0
--clear source       1 c-item (pending) |   source: "s" -> (unset)          exit=0
--clear verification 1 c-item (pending) |   verification: "v" -> (unset)    exit=0
--clear sdd          1 c-item (pending) |   sdd: true -> (unset)            exit=0
--clear closed-by    1 c-item (pending) |   closed_by: "note" -> (unset)    exit=0
```

But deleting `source`, `verification`, `sdd` or `closed-by` from `CLEARABLE` leaves the suite
green - four surviving mutations. `--clear source` would then exit 2 with "'source' is not a field
'state set' can clear" and no test would notice, while the wiki page kept promising it. Acceptance
bullet 2 is the requirement this leaves uncovered.

**What would satisfy me:** one table-driven test over all six entries of `CLEARABLE`, asserting
the key is removed and exit 0.

### 5. `src/cli.ts:277-312` - `state add` and `state set` now write the same fields under different rules

The recorded decision `2026-08-21T09:10:32.623Z` argues the empty string is a data-model trap: "a
key whose value is the empty string survives a round trip through state.json and reads back as
present-but-blank, which is a third state nobody asked for." The fix landed in one of the two
writers:

```console
$ mstack state add --slug empty-fields --title "Empty everywhere" --acceptance "" \
    --description "" --source "" --verification "" --decision-required ""
added 1 empty-fields (pending)
exit=0
$ node -e "..."
{"id":1,"slug":"empty-fields","title":"Empty everywhere","acceptance":[""],"status":"pending",
 "description":"","source":"","verification":"","decision_required":""}
$ mstack gate --quiet
exit=0

$ mstack state set empty-fields --description ""
mstack: an empty --description is not a value
exit=2
```

`state add` writes every shape `state set` now refuses, including the `decision_required: ""` that
`src/gate.ts:190` reads as no fork at all, and the gate calls it green. The trap the decision row
describes is still fully open through the other door.

**What would satisfy me:** either route `state add`'s value flags through the same `required()`
helper, or amend the decision row to say it scopes to `state set` and open an item for `state
add`. What is not acceptable is a recorded decision that claims to close a hole it closed halfway.

### 6. `src/cli.ts:468-471` - `--sdd` takes a green gate to red at exit 0, with no warning and no `--force`

```console
$ mstack gate --quiet ; echo exit=$?          # item at in_progress, no spec dir
exit=0
$ mstack state set storage-layer --sdd
1 storage-layer (in_progress)
  sdd: (unset) -> true
exit=0
$ mstack gate
[fail]  sdd item storage-layer is in_progress but has no spec at .../.mstack/specs/storage-layer
        fix: run '/mstack:spec' or move the item back to specifying
FAILED - 1 failure
```

This contradicts the principle this commit states in its own test comment,
`tests/decisions.test.ts:210-211`: "The whole point of refusing: the CLI must not create a state
its own gate reports." The recorded reason (`2026-08-21T09:10:57.329Z`: "guarding it would mean
duplicating the gate's filesystem check inside the CLI") does not survive contact with
`src/cli.ts:411-412`, where this same command deliberately duplicates the gate's decision check
and says so in a comment: "Refused here as well as in the gate. The gate is the authority; this is
the cheapest place to say so."

In fairness, I checked whether this is a new class of defect and it is not. The same gate-red
state is reachable on `main` through `mstack state set <sdd item> --status spec_ready` with no
spec on disk, and through `mstack state add` with no `--acceptance` at all (both verified against
`main`'s binary, both exit 0, both red gate). So this item widened a pre-existing hole by one
door rather than digging a new one, and the implementer flagged it honestly at rung 2. That is
why I am asking for the cheap fix, not the expensive one.

**What would satisfy me:** the one-line symmetry - when `--sdd` is set on an item where
`requiresSpecArtifacts(item.status)` is true (`src/lifecycle.ts:34-39`), push the same shape of
`forced:` line the fork path already prints at `src/cli.ts:501-505`, naming the gate failure it
just created. A test that asserts the line, plus a correction to the decision row's stated reason.
If you prefer to leave the code alone, the decision row still needs rewriting: the "would mean
duplicating the gate" argument is contradicted three functions up in the same file.

## Minor

1. `src/cli.ts:223-226` - `required()` checks `value.trim() === ""` but returns `value`. Nothing
   trims on the way in, and nothing pins the choice: adding `.trim()` to the return breaks no test
   (`REQUIRED-trims` survived). It is the untested half of this pair that makes a trailing space a
   different fork.
2. `--closed-by ""` went from exit 0 + `closed_by: ""` on `main` to exit 2 here. Disclosed by the
   implementer, better behaviour, but `tests/cli.test.ts:268` - the test literally named "keep
   working exactly as before" - does not exercise the one input that stopped working the same way.
   One assertion would close the loop against acceptance bullet 4.
3. `README.md:124` says the line is "refused in both directions" without qualification, while the
   same commit added `--force` and `docs/wiki/The-CLI.md:161-164` documents it. The neighbouring
   sentence at `:118` has the same habit for the status move, so this is consistent with the page -
   but "refused" is a stronger word than the code earns.
4. `docs/wiki/The-CLI.md:106` prints `1 greet-flag (pending)` for an item the same page moved to
   `in_progress` at `:76` and confirmed as `in_progress` at `:89`. A reader following top to bottom
   gets a different status.
5. `src/cli.ts:236` - `--clear <field>` on a field the item does not carry prints
   `  <field>: already unset` and exits 0. Reasonable, untested (`CLEAR-already-unset` survived).
6. `src/cli.ts:509` - `assertWritable(item, state)` in the `set` path is killed by no mutation.
   With `--slug` refused and `--title ""` caught by `required()`, nothing `set` can write violates
   it. Keep the belt, but a one-line comment saying it is a guard against a future `--slug` would
   stop the next reader from thinking it is load-bearing today.

## Out of scope, found while reviewing

`mstack gate --quiet` prints nothing at all on failure - it only sets the exit code
(`src/report.ts:31` suppresses `fail` under quiet). `docs/wiki/The-CLI.md:60` says "`--quiet`
prints failures only". Reproduced on `main`'s binary too, so this predates the branch and is not
this item's to fix. It is the "failed silently" shape `tests/helpers.ts:101-107` exists to hunt,
and it deserves its own item.

## Where each claim stopped on the evidence ladder

| Claim | Rung | What backs it |
|---|---|---|
| Gate green, both runtimes, item's own verification passes | 4 | `mstack gate --full` run here, 191/191, typecheck and lint clean |
| Every new option, guard and drop is covered by a falsifiable test | 4 | 27 mutations run from a clone in the scratchpad, byte-copy restore, sha256 verified |
| Four clearable fields, preview truncation, trimming, `assertWritable` are uncovered | 4 | The surviving mutations, named above |
| Six doc transcripts no longer reproduce | 5 | Shipped `bin/mstack` driven as a process against scratch stores built by the commands the pages show |
| The two new fork blocks pair an elided command with real output | 5 | Ran the command as printed; output differs |
| `--sdd` turns a green gate red at exit 0 | 5 | Real store, gate exit 0 before and 1 after |
| The `--sdd` hole is pre-existing rather than new | 5 | Same red gate reached through `main`'s binary two other ways |
| `state add` still writes the empty strings `state set` refuses | 5 | Real store, state.json read back, gate green |
| The forced attach at `done` is recoverable | 5 | Followed to the end: refused park, successful `decide --resolves`, gate back to 0 |
| No test was weakened | 4 | `git diff --numstat`, 435 added, 1 import line changed |
