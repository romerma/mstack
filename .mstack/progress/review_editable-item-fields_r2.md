# Review - editable-item-fields (round 2)

**Verdict:** APPROVED

Closure check only. I did not re-review what round 1 approved. All six required findings and all
six minors are closed at the line, the sixteen `R2-*` mutations are real, and the six formerly
stale transcripts plus the two formerly elided commands now reproduce byte for byte against the
shipped binary. Three minors recorded below for follow-up; none of them blocks.

## Closure, finding by finding

| # | Round-1 finding | Closed at | How I confirmed it |
|---|---|---|---|
| F1 | Six doc transcripts the shipped CLI no longer reproduces | `README.md:78`, `docs/wiki/Getting-Started.md:131`, `:200`, `:203`, `:206-207`, `docs/wiki/The-CLI.md:77` | Walked the page top to bottom in a scratch store; every block reproduces exactly. Transcript below |
| F2 | Elided command paired with un-elided output | `docs/wiki/The-CLI.md:171-173`, `:196-197`, `:201-202` | Ran the wrapped commands verbatim; output matches character for character, including the 216-char refusal |
| F3 | Change line could print an identical before and after | `src/cli.ts:216-221` (`detail`), `:243-251` (`fieldChange`), `:270-274` (`required` trims) | Reproduced the exact collision case; both values now print in full with lengths. Mutations `R2-1`..`R2-4` all killed |
| F4 | Four of six clearable fields untested | `tests/cli.test.ts:312-349` | Table-driven over all six, each cleared twice. `R2-11`..`R2-15` each killed by it |
| F5 | `state add` and `state set` disagreed on validation | `src/cli.ts:344-372`, test at `tests/cli.test.ts:453` | Both doors now share `required()`. `R2-5`, `R2-6`, `R2-7` killed, and my own `X3`, `X4`, `X5` (title, source, verification - the three the R2 table does not name) killed too |
| F6 | `--sdd` took a green gate to red at exit 0, silently | `src/cli.ts:547-557`, test at `tests/cli.test.ts:414` | Both branches run in a real store. `R2-8`, `R2-9`, `R2-10` and my `X7` killed. One residue, minor 2 |

| # | Round-1 minor | Closed at | Confirmed |
|---|---|---|---|
| m1 | `required()` did not trim | `src/cli.ts:270-274` | `R2-4` and my `X6` (`trimStart` only) both killed by `tests/cli.test.ts:390` |
| m2 | `--closed-by ""` untested | `tests/cli.test.ts:299-306` | `R2-16` killed. Also asserts the previous note survives the refusal |
| m3 | `README:124` overstated "refused in both directions" | `README.md:125-127` | Now "the CLI refuses in both directions... `--force` still does it, and prints the gate failure it just created" |
| m4 | `The-CLI.md:106` said `(pending)` for an `in_progress` item | `docs/wiki/The-CLI.md:107`, `:114`, `:124` | All three now `(in_progress)`, and I reproduced them in a store that had run the page's earlier `--status in_progress` |
| m5 | Clearing an absent field untested | `tests/cli.test.ts:346-348` | `R2-15` killed |
| m6 | `assertWritable` in `set` is not load-bearing | `src/cli.ts:596-599` | Answered with a comment, not a test, and I accept it: my `X8` shows the same call **is** load-bearing in `state add` (killed by `state add refuses to write what parseState would refuse to read`), so the belt is proven where it bites and documented where it does not. A test for an unreachable branch would be the decoration this project hunts |

## Verification I ran

```console
$ ./bin/mstack gate --full
[ok]    one active item: editable-item-fields (in_progress)
[ok]    no item carries a decision fork
[ok]    no sdd item is past specifying
[ok]    on branch feat/editable-item-fields
[ok]    working tree is clean
 196 pass
 0 fail
Ran 196 tests across 13 files. [14.89s]
ℹ tests 196
ℹ pass 196
ℹ fail 0
PASSED - 0 failures, 0 warnings
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
```

196 on both runtimes. `src/cli.ts` gained `node:fs` and `node:path`, both builtins; no new
dependency. No test was weakened - `git diff --numstat 01ce70e..HEAD -- tests/` is `183 1`, and
the single deleted line is an import.

### The `R2-*` mutations are real

I did not take the implementer's table on trust. Fresh `git clone` of the branch into the
scratchpad so the working tree was never touched, byte copy first, `SETUP-ERROR` rather than a
silent pass when a pattern is missing or ambiguous, and sha256 re-checked after every restore.
Twenty-four mutations - the sixteen `R2-*` reconstructed independently from their descriptions,
plus eight of my own aimed at code that had never been reviewed:

```
   R2-1 .. R2-16                                        all 16 killed
   X2    collision test inverted                        killed (4 tests)
   X3    state add --title raw                          killed
   X4    state add --source raw                         killed
   X5    state add --verification raw                   killed
   X6    required trims only the start                  killed
   X7    --sdd existsSync inverted                      killed
   X8    assertWritable dropped from state add          killed
>> X1    detail drops JSON.stringify                    SURVIVED
restored, sha256 5aecb2e28e643c4b matches
```

Each `R2-*` was killed by exactly the test the implementer named. The one survivor is minor 1.

### F1 and F2: the page, walked end to end

Scratch store, `bin/mstack` driven as a process, ids 1/2/3 as the page's header promises:

```console
$ mstack state set greet-flag --status in_progress
1 greet-flag (in_progress)
  status: "pending" -> "in_progress"          # The-CLI.md:77, README.md:78, Getting-Started.md:131

$ mstack state set greet-flag --description "the flag is off by default" \
    --acceptance '`python3 greet.py --shout world` prints HELLO, WORLD!'
1 greet-flag (in_progress)
  description: (unset) -> "the flag is off by default"
  acceptance: 2 criterion(s) replaced with 1
    - dropped "`python3 greet.py --shout world` prints HELLO..."
    - dropped "test_greet.py covers the flag and the default"

$ mstack state set export-json --decision-required "Is this a stable public contract other tools may \
depend on, or a convenience dump we are free to change? The two answers produce different work: \
one needs a version field and a compatibility rule, the other does not."
3 export-json (specifying)
  decision_required: (unset) -> "Is this a stable public contract other tools ..."

$ mstack state set export-json --status spec_ready
mstack: export-json has an unanswered decision: "Is this a stable public contract other tools may depend on, or a convenience dump we are free to change? The two answers produce different work: one needs a version field and a compatibility rule, the other does not."
        answer it with 'mstack decide --resolves export-json ...' first
```

Identical to `docs/wiki/The-CLI.md:75-77`, `:104-115` and `:166-180`. The `cli-search` refusal and
park-and-attach at `:191-206` reproduce the same way. Getting-Started's close block at `:197-208`
reproduces including both new lines under `--status done --closed-by`.

The `:182` claim - "the one `examples/notes-cli` ships, character for character" - is true, and I
checked it rather than read it:

```console
$ node -e '...'
example len 216 doc len 216 identical: true
```

### F3: the collision case, with its precondition asserted

The coordinator's caution applies here, so I asserted the precondition before measuring rather
than after:

```console
$ echo "precondition decision_resolved = $(node -e ...)"
precondition decision_resolved = 2026-08-21T10:11:47.698Z

$ mstack state set export-json --decision-required "Should the export be a stable public contract \
we are free to reshape at will?"
3 export-json (specifying)
  decision_required: changed, and the short forms match, so both in full
    was (72 chars) "Should the export be a stable public contract other tools may depend on?"
    now (77 chars) "Should the export be a stable public contract we are free to reshape at will?"
  decision_resolved: "2026-08-21T10:11:47.698Z" -> (unset)
```

The pointer existed before the command, so the drop is a deletion and not the absence of a value
nobody wrote. Matches `docs/wiki/The-CLI.md:137-145` exactly apart from the timestamp.

## Attacking the new code

**The collision branch on values shorter than the truncation limit.** It works, and the case that
proves it is sharper than the long-prefix one. `preview()` collapses `\s+`, so a tab and a space
render identically at any length:

```console
$ mstack state set t-item --description "$(printf 'a\tb')"
  description: (unset) -> "a b"
$ mstack state set t-item --description "a b"
  description: changed, and the short forms match, so both in full
    was (3 chars) "a\tb"
    now (3 chars) "a b"
```

Three characters against three characters: the length distinguishes nothing here, and
`JSON.stringify` is the only thing that does. That is what makes minor 1 worth writing down.

**Is the collision branch reachable with two genuinely equal values?** No, and I checked every
call site rather than trusting the docstring at `src/cli.ts:231-232`. `clearField` (`:285`) has
already established `before !== undefined` and passes `undefined` as the target, and no quoted
string can render as the bare `(unset)`; the status push (`:496`) is guarded by `!==`; the value
loop (`:515`) by `item[key] !== next`; the `sdd` push (`:534`) by `item.sdd !== true` where
`parseItem` only ever stores `true`; the fork push (`:578`) by `fork !== item.decision_required`.
The invariant the branch depends on holds at all five.

**Trimming: does it break a field whose legitimate value has meaningful leading whitespace?** I
could not construct one. The seven fields `required()` now guards are a title, four prose fields,
a quoted criterion and a command. The command is the only one anything executes, at
`src/gate.ts:385` via `/bin/sh -c`, where leading and trailing whitespace is already discarded by
the shell and `src/gate.ts:377` already `.trim()`s it to decide whether it is empty. Internal
newlines and indentation survive `.trim()` untouched, so a multi-line description keeps its shape;
only the outer edges go. Nothing compares these fields against an untrimmed source anywhere in
`src/`.

**The `--sdd` disk read: TOCTOU and path assumptions.** No security surface - the command reads,
never creates, and the line is advisory. The window between `existsSync` and the next `mstack
gate` is unbounded but harmless, and no worse than the gate's own read of the same path a moment
later. The path cannot diverge from the gate's: both derive it as `join(store.specs, item.slug)`
from the same `requireStore()` walk (`src/paths.ts:31`), so in a worktree the CLI and the gate
resolve the same directory by construction. One residue, minor 2.

## Minors, for follow-up rather than for this round

1. **`src/cli.ts:216-221` - `detail()`'s escaping is untested.** Replacing `JSON.stringify(value)`
   with `"${value}"` leaves all 196 tests green (`X1`, the one survivor of my sweep). The character
   count is pinned (`R2-3` kills it), but in the tab-versus-space case above both counts are 3 and
   the escaping is the *only* thing that distinguishes them - which is the example the function's
   own docstring names. One extra case in `tests/cli.test.ts:351` closes it.

2. **`src/cli.ts:551-555` - the `--sdd` announcement is silent about a failure it did create when
   the spec directory exists but is incomplete.** The recorded decision
   (`.mstack/decisions.tsv` `2026-08-21T10:01:59.983Z`) scopes its guarantee honestly - "names a
   failure only when the spec directory is absent" - so the code matches its claim and I am not
   asking for a behaviour change. What is wrong is the test's premise. `tests/cli.test.ts:443-450`
   creates an **empty** directory with `mkdirSync` and labels the assertion "no failure was created
   here". A failure was:

   ```console
   $ mstack gate --quiet                       # green
   exit=0
   $ mkdir -p .mstack/specs/storage-layer      # exactly what the test does
   $ mstack state set storage-layer --sdd
     sdd: (unset) -> true
     forced: storage-layer is in_progress, so 'mstack gate' now holds it to a complete spec at .../specs/storage-layer
   $ mstack gate
   [fail]  spec for storage-layer is missing or empty: proposal.md, design.md, tasks.md, spec.md
   ```

   The assertions are all true and `R2-9` proves they bite; it is the justification that is false,
   and a later reader would take it as licence. Either seed the four artifacts so the premise holds
   and add `assert.equal(gate.code, 0)`, or relabel it to say what it actually means: the command
   names the obligation it created, not the failure, because completeness is the gate's judgement.

3. **`docs/wiki/The-CLI.md:137-145` breaks the page's own "one real run" promise.** The header at
   `:5-6` says every output block is from one run in a scratch repository. The collision block shows
   `export-json` at `specifying` carrying a 72-character fork with an answer, while `:167-169` -
   thirty lines *later* - shows the same item moving `pending -> specifying` and `:175` shows its
   fork going from `(unset)`. Both blocks reproduce individually; they cannot both be true in page
   order. Round 1 had the same class of defect at `:106` and it was fixed; this is a new one in the
   block that replaced it. Cheapest fix: move the collision block after the fork section, or give it
   a fourth slug so it is not the item the page tracks.

## Nitpick

`src/cli.ts:552`, `:554` - the `--sdd` announcement is prefixed `forced:`, borrowed from the fork
path where it follows an actual `--force`. Nothing is forced here; `--sdd` is not an override.
`note:` or `now:` would not imply a flag the user did not pass.

## Before this item closes

`mstack ledger check editable-item-fields` FAILs at head `dd74249e`, and the only row for the slug
is the round-1 implementer row at `3a269781`, whose evidence line reads "npm test 191 pass... 12
mutations all killed" - numbers that no longer describe this tree (196 and 16). Round 2 shipped no
implementer row of its own, where item 12 recorded one per round (`0c0c24d`, `739870c`, then the
reviewer's `e362a0f`). This is disclosed, not hidden - `.mstack/progress/current.md:166-167` says
so in as many words - and item 13 is still `in_progress` so nothing enforces it. It just has to
happen before `done`, together with the reviewer row this report is the evidence for.

## Where each claim stopped on the evidence ladder

| Claim | Rung | What backs it |
|---|---|---|
| Gate green, 196/196 both runtimes, typecheck and lint clean | 4 | `mstack gate --full` run here |
| All sixteen `R2-*` mutations are real and killed by the named test | 4 | Reconstructed independently from a fresh clone, byte-copy restore, sha256 verified |
| The round-2 code has one uncovered mechanism (`detail`'s escaping) | 4 | `X1` survived a full-suite run |
| Six formerly stale transcripts and two formerly elided commands reproduce | 5 | Shipped `bin/mstack` driven as a process, page walked in order |
| The `examples/notes-cli` fidelity claim at `:182` | 5 | 216 chars against 216, string equality, not eyeballed |
| The collision fix works on short values differing only in a collapsed character | 5 | Real store, tab against space, both 3 chars |
| `--sdd` still lets a green gate go red without saying "fails" when the dir exists | 5 | Real store, gate 0 then 1, the test's own fixture reproduced |
| The collision branch cannot fire on two equal values | 3 | Read all five call sites and their guards; not exhaustively fuzzed |
| Trimming breaks no field with meaningful leading whitespace | 3 | Reasoned over the seven guarded fields and the one execution path at `src/gate.ts:385`; I could not construct a counterexample, which is weaker than proving none exists |
| The `--sdd` path assumption holds in a worktree | 3 | Both paths derive from the same `requireStore()` walk by construction; not run inside an actual `git worktree` |

## Out of scope, found while attacking the `--sdd` disk read

If `.mstack/specs/<slug>` is a regular file rather than a directory, `mstack gate` dies on an
unhandled `ENOTDIR` out of `src/gate.ts:269` and every check below the spec check silently never
runs - the same shape `src/gate.ts:202-210` already guards `decisions.tsv` against. Reproduced on
`main`'s binary too, so it predates this branch and is not this item's to fix. Worth its own item
alongside 16.
