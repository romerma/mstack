# The CLI

Every command mstack ships, each one shown doing its job with real output. Read it as a
reference rather than in order: when a command refuses something and you want to know what
the refusal means, this is the page. Day to day you type few of these yourself; the router
and [the agents](The-Agents.md) run them for you.

`bin/mstack` is on `PATH` for every Bash call while the plugin is enabled. It is a small `sh`
launcher over `src/cli.ts`; there is no build step, and the CLI uses only `node:` builtins.
Every output block below is from one real run in a scratch repository, except where a command
is shown refusing for a documented reason. The binary behind every `$ mstack` on this page is
the repository's own `./bin/mstack` at the commit that last edited it — inside the mstack repo
the `mstack` on `PATH` is the installed plugin, a different copy, and re-running these blocks
against it exercises whatever release is installed rather than the transcripts. The scratch queue mirrors `examples/notes-cli`:
`greet-flag` is the [Getting-Started](Getting-Started.md) walkthrough item, and ids 2 and 3
are the example's `cli-search` and `export-json`, so the fork item here is the same item, same
id, same question you will meet in the shipped example.

```
Exit codes: 0 pass, 1 gate failure or wait, 2 usage error or stop.
```

That line is from `mstack help`, and it is exact: 1 means "this told you something is wrong"
(a red gate, a stale verdict, a merge gate saying wait), 2 means "this command did not run"
(bad arguments, an illegal transition, an unanswered fork). The one deliberate exception is
`mstack statusline`, which parses leniently and exits 0 on anything, because a typo in your
settings must not turn the status bar into an error message.

## Verdicts and the ladder

Five verdicts, defined in `src/ledger.ts:17-23`, mapped from the evidence ladder in
`skills/router/references/evidence-ladder.md`:

| Rung reached | Verdict |
|---|---|
| 5 — you reproduced it in the running system | `live-verified` |
| 4 — you ran a test that fails loudly if you are wrong | `test-verified` |
| 2–3 — you pointed at the line, or walked the failure, or type-checked | `type-check-only` |
| could not run the check at all | `verifier-blocked` |
| ran it and it failed | `verifier-failed` |

`verifier-blocked` and `verifier-failed` clear nothing; they exist so "I could not check" and
"it failed" are recorded facts instead of silence.

## setup

```console
$ mstack setup
[ok]    state.json written
[ok]    progress/current.md written
[ok]    progress/history.md written
[ok]    ledger.tsv ready
[ok]    decisions.tsv ready
[ok]    costs.tsv ready
[ok]    .mstack/.gitattributes ready (the append-only tables merge as a union)
[ok]    .mstack/.gitignore ready (verification.tsv is machine-local)

PASSED - 0 failures, 0 warnings
```

Never overwrites an existing file unless you pass `--force`. The store's own `.gitignore` is
one of two exceptions, rewritten every run (the other is `.gitattributes`, below): an older store predates it, and a store that silently
loses that rule starts committing verification receipts, which void themselves the moment they
are committed.

## gate

```console
$ mstack gate --quiet; echo $?
[fail]  1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start
1
```

Fast, milliseconds, safe as a `Stop` hook. `--full` also runs the project's `verify` command
and the active item's `verification` command, and **records what it ran** so the fast gate can
hold an item at `verifying` to a run that really happened. The whole mechanism is in
[Gates-and-Hooks](Gates-and-Hooks.md#verification-that-actually-ran).

`--full` reports the same closing checks the plain gate reports (the requirement-to-test table, the
review budget) and leaves out only the verification receipts, which it is about to write itself. A
`--full` used to skip all of them and print `PASSED` over a 30 KB report and over a missing table,
where `gate` failed. Now it is red exactly where `gate` is, and still runs the verification.

`--full` that runs nothing is a failure, not a pass. It used to warn and exit 0, which made
"you asked for the full gate and got no verification at all" indistinguishable from "you asked
for it and it passed":

```console
$ mstack gate --full | tail -6
-- verification
[fail]  --full ran no verification: state.json has no 'verify' command and parse-config has no 'verification' command
        fix: set one with 'mstack state set <slug> --verification "<command>"', or put a project-wide 'verify' in state.json

FAILED - 1 failure, 0 warnings
```

On the fast gate, `--quiet` prints one line per failure and nothing else: no `[ok]` lines, no
section headers, no warnings, no summary count. The fix stays on the line, because a failure
that does not name the next action sends the reader to the source, and this is the mode where
they are least able to ask. It is also the exact text the `Stop` hook hands the model, so the
transcript and the context cannot drift apart.

The stream is deliberate. Failures go to **stderr**, which leaves the fast gate's stdout free
for a hook's structured output — `mstack hook stop` writes JSON there, and failure text in
front of it would stop that JSON parsing:

```console
$ mstack gate --quiet 2>/dev/null | wc -c
       0
```

**`--full` is the exception, and it is not a small one.** The verify command runs with its
stdio inherited (`src/gate.ts`), so whatever it prints goes straight to stdout no matter what
`--quiet` says. `--quiet` suppresses the gate's *own* output; it does not and cannot muzzle a
subprocess it hands the terminal to:

```console
$ mstack gate --full --quiet 2>/dev/null; echo "exit $?"      # stdout only
VERIFY-STDOUT-CANARY
exit 1

$ mstack gate --full --quiet 2>&1 1>/dev/null; echo "exit $?" # stderr only
[fail]  1 export-json (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start
exit 1
```

(`verify` in that store is a one-line canary, so `VERIFY-STDOUT-CANARY` is the whole of the
subprocess's output.)

So "nothing else on stdout" is a promise about `mstack gate --quiet`, not about
`mstack gate --full --quiet`. Anything that wires `--full` to a hook has to solve that first,
and the answer this repository reached is **not to**: no hook runs `--full`, `stdio: "inherit"`
stays exactly as it is, and a human running the full gate keeps live progress output from
their own test suite. The rule that a session cannot close on an unverified item is enforced
instead by the fast gate reading a *record* of a past run, which costs a small file read and
nothing else. Both halves are in
[Gates-and-Hooks](Gates-and-Hooks.md#verification-that-actually-ran).

A gate with warnings but no failures prints nothing at all and exits 0. That is what keeps it
cheap to fire on every turn: "uncommitted changes" and "on main" are normal mid-session states,
and a hook that repeats them every turn is a hook someone switches off. The same run without
`--quiet` shows what it held back:

```console
$ mstack gate --quiet; echo $?
0

$ mstack gate | tail -6

-- workspace
[ok]    on branch feat/greet-flag
[warn]  3 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 1 warning
```

The full walkthrough of every check is in [Gates-and-Hooks](Gates-and-Hooks.md).

## state add / list / show / set / active

```console
$ mstack state add --slug greet-flag --title "greet --shout uppercases the greeting" \
    --acceptance '`python3 greet.py --shout world` prints HELLO, WORLD' \
    --acceptance "test_greet.py covers the flag and the default" \
    --verification "python3 -m unittest test_greet -v" --source "direct request"
added 1 greet-flag (pending)

$ mstack state list
  1 greet-flag (pending)  greet --shout uppercases the greeting

$ mstack state set greet-flag --status in_progress
1 greet-flag (in_progress)
  status: "pending" -> "in_progress"

$ mstack state active
greet-flag

$ mstack state show greet-flag
id: 1
slug: greet-flag
title: greet --shout uppercases the greeting
status: in_progress
source: direct request
verification: python3 -m unittest test_greet -v
acceptance:
  - `python3 greet.py --shout world` prints HELLO, WORLD
  - test_greet.py covers the flag and the default
```

`state list` marks active items with `*` and prints only a label and a title. `state show <ref>`
prints one item with every field it carries, one per line, in a fixed order, lists as indented
lines, unknown keys that `state.json` preserves last; a field the item does not carry is not
printed. `state show <ref> --json` prints the item's raw object from `state.json` instead. A
missing or unmatched `<ref>` exits 2. `state active` prints the slug alone to stdout so
`SLUG=$(mstack state active)` works, and exits 1 with a stderr note when nothing is active.
`state set` accepts an id or a slug, refuses illegal transitions and unanswered forks (exit 2),
and takes `--force` for the deliberate exception, which the gate will still audit. Moving an
item that has a `base` to `done` also reads the requirement-to-test table of its implementation
report and refuses on a missing or bad one; see [Gates and hooks](Gates-and-Hooks.md).

```console
$ mstack state set greet-flag --status done
mstack: in_progress -> done is not a legal transition
        pass --force if you mean to skip a phase, and say why in decisions.tsv
```

### Correcting a field after intake

`state set` takes every field `state add` takes: `--title`, `--description`, `--source`,
`--verification`, `--acceptance`, `--add-acceptance`, `--seam`, `--sdd`, `--size`,
`--decision-required` and `--closed-by`; `state set` also takes `--base`. A field the item does not carry yet is added rather than refused, and every
edit prints what it replaced, because a write nobody sees is indistinguishable from a no-op.

`--acceptance` **replaces** the whole list, names each criterion it dropped, and, when there
were any, says that `--add-acceptance` is how to append; `--add-acceptance` appends. One command
may not do both. Neither one asks first: the CLI is run by agents and does not block.

`--seam "<text>"` names a public surface where the behaviour is observed and a test attaches,
for example ``CLI: `mstack state add` exit code and stdout``. It repeats on `state add`; on
`state set` it **replaces** the list and names each seam it dropped. An item that changes no
behaviour carries none.

```console
$ mstack state set greet-flag --description "the flag is off by default" \
    --acceptance '`python3 greet.py --shout world` prints HELLO, WORLD!'
1 greet-flag (in_progress)
  description: (unset) -> "the flag is off by default"
  acceptance: 2 criterion(s) replaced with 1
    - dropped "`python3 greet.py --shout world` prints HELLO..."
    - dropped "test_greet.py covers the flag and the default"
    to append instead of replace, use --add-acceptance; the dropped criteria are listed above if this was meant as one

$ mstack state set greet-flag --add-acceptance "test_greet.py covers the flag and the default"
1 greet-flag (in_progress)
  acceptance: 1 added, now 2
```

### Help, and values that start with `--`

`state add`, `state set`, `state show` and `decide` take `--help` (or `-h`): it prints that
command's flags with one line each to stdout, exits 0, needs no store and changes nothing. The
help and the parser read one table, so a flag cannot be in one and missing from the other.

A value that starts with a dash is read as the next flag. Write it as one argument,
`--flag=value`, and `state.json` stores it whole (`decisions.tsv` puts a quote in front of a
value that starts with `=`, `+`, `-` or `@`); with a space, the command exits 2 and says so:

```console
$ mstack state add --slug x --title t --acceptance --nope
mstack: --acceptance was followed by '--nope', which starts with a dash and so reads as another flag, not as its value
        if it is the value, pass it as one argument: --acceptance=--nope

$ mstack state add --slug x --title t --acceptance=--nope
added 2 x (pending)
```

Removal has one spelling, and an empty value is refused rather than stored: a key whose value
is `""` reads back as present-but-blank, a third state nobody asked for, and the gate already
treats a `decision_required` of `""` as no fork at all.

```console
$ mstack state set greet-flag --clear description
1 greet-flag (in_progress)
  description: "the flag is off by default" -> (unset)

$ mstack state set greet-flag --description ""
mstack: an empty --description is not a value
        to remove a field, say so: 'mstack state set greet-flag --clear description'
```

Values are stored trimmed. `--decision-required "$FORK "` and `--decision-required "$FORK"` are
the same fork, which matters because a rewrite drops the answer to the question it replaced, and
a trailing space is not a new question. When two values are long enough that the abbreviation
above would render them identically, the command prints both in full with their lengths instead:

```console
$ mstack state set export-json --decision-required "Should the export be a stable public contract \
we are free to reshape at will?"
3 export-json (specifying)
  decision_required: changed, and the short forms match, so both in full
    was (72 chars) "Should the export be a stable public contract other tools may depend on?"
    now (77 chars) "Should the export be a stable public contract we are free to reshape at will?"
  decision_resolved: "2026-08-21T10:00:53.883Z" -> (unset)
```

Both halves of that block matter. The two questions share a 45-character prefix, so the
abbreviated form printed them identically on either side of an arrow while the same command
dropped the answer — the line that exists to make a write visible, showing no change, on the
field where this command silently un-answers a fork.

`--clear` takes `description`, `source`, `verification`, `decision-required`, `sdd`, `size`,
`closed-by` and `seams`; `base` is refused, for the reason under "Size and base" below. `acceptance` is not among them (the gate fails an item with no criteria, so
replace them instead), and `--slug` is refused outright, because it names the branch, the spec
directory, the progress files and every ledger and decision row already written for the item,
and none of those move with it. Two instructions for one field in one command (`--description
X --clear description`) are refused rather than silently ordered, and a `state set` given
nothing to set exits 2 instead of reporting success.

### Size and base

`--size s|m|l` says how big the work is. An item with no size reads as `m` wherever size is
consulted, and nothing writes that `m` into `state.json`, so items written by an older mstack
are read and rewritten unchanged. `--clear size` removes it. Anything else is refused with the
value and the three allowed ones, and nothing is written. `state show` prints the size when the
item has one. Only `s` is checked by anything today: the gate holds a size-`s` item to its diff
(see "What `mstack gate` checks" in [Gates and hooks](Gates-and-Hooks.md)), and an `sdd` item cannot be
`s`, because `s` is the small item on the direct path and `sdd` is the spec path. Both flag
orders are refused at `state add` and at `state set`, naming both fields and writing nothing.

`base` is the commit `HEAD` resolved to when the item first moved to `in_progress`; the move
prints it with the other changes. A later return to `in_progress` after review keeps the one the
item has. `state set <ref> --base <commit>` replaces it, and the value has to resolve to a commit
in this repository or the command refuses, naming the value. `--clear base` is refused, because
the gate measures a size-`s` item from it. Outside a git repository, or before the first commit,
the move still succeeds and the change list says `base: not recorded`.

The gate does not always measure from `base`. When the branch has commits of its own past the
default branch and `base` is no later than the point where it left that branch, the gate measures
from that point, so rebasing onto a `main` that moved, or merging `main` in, does not count other
people's commits as the item's. A `base` a rebase rewrote is replaced by that point, or, with no
such point, the gate fails and names `--base`. It measures only what lies under the directory
that holds `.mstack/`, with paths read relative to it, so a store in `pkg/app` of a monorepo
measures `pkg/app`. The gate's line names the commit it measured from and says when that is not
the base; the full rule and a real line are under "size s" in [Gates and hooks](Gates-and-Hooks.md).

```console
$ mstack state add --slug greet-flag --title "greet --shout" --acceptance "shout uppercases" --size s
added 1 greet-flag (pending)
$ mstack state set greet-flag --status in_progress
1 greet-flag (in_progress)
  status: "pending" -> "in_progress"
  base: (unset) -> "1dd52334ac0095c95d3a76d7b00dd8e746ff4ee0"
$ mstack state set greet-flag --size xl
mstack: 'xl' is not a size
        the sizes are s, m or l; nothing was written
$ mstack state set greet-flag --clear base
mstack: base cannot be cleared
        the gate measures a size s item's diff from it, so an item without one would escape the check; replace it with --base <commit> instead
```

### Attaching a product fork after intake

Intake parks the forks it finds when it adds the item, with `state add --decision-required`. A
fork can also turn up later, usually while `specifying`, so `state set --decision-required` has
to attach one there. That is the whole reason these flags exist: the gate the README leads with
could previously only be attached by hand-editing `state.json`.

```console
$ mstack state set export-json --status specifying
3 export-json (specifying)
  status: "pending" -> "specifying"

$ mstack state set export-json --decision-required "Is this a stable public contract other tools may \
depend on, or a convenience dump we are free to change? The two answers produce different work: \
one needs a version field and a compatibility rule, the other does not."
3 export-json (specifying)
  decision_required: (unset) -> "Is this a stable public contract other tools ..."

$ mstack state set export-json --status spec_ready
mstack: export-json has an unanswered decision: "Is this a stable public contract other tools may depend on, or a convenience dump we are free to change? The two answers produce different work: one needs a version field and a compatibility rule, the other does not."
        answer it with 'mstack decide --resolves export-json ...' first
```

The question in that block is the one `examples/notes-cli` ships, character for character, which
is what the promise at the top of this page is worth: same item, same id, same fork.

`spec_ready` and beyond is now guarded in **both** directions. Moving an item across that line
with a fork unanswered was already refused; attaching a fork to an item already sitting past it
is refused too, because it would put the item past a gate it never passed and leave `mstack
gate` reporting a state this command had just created. Park it, or pass `--force` and the
command prints the failure it is creating:

```console
$ mstack state set cli-search --status in_progress
2 cli-search (in_progress)
  status: "pending" -> "in_progress"

$ mstack state set cli-search --decision-required "Does search match the body as well as the title? \
The two answers produce different work."
mstack: cli-search is in_progress, at or past the point where a fork must already be answered
        park it first ('mstack state set cli-search --status blocked --decision-required ...'), or pass --force to attach it where it stands and let the gate report it

$ mstack state set cli-search --status blocked --decision-required "Does search match the body as well \
as the title? The two answers produce different work."
2 cli-search (blocked)
  status: "in_progress" -> "blocked"
  decision_required: (unset) -> "Does search match the body as well as the tit..."
```

Rewriting the fork prose drops `decision_resolved`, and `--clear decision-required` drops both.
The row that answered the old question does not answer the new one, and the gate matches a row
on its timestamp and the slug it resolves, never on the question — so a pointer left behind
would let the next fork be born answered.

### The size of a spec

A spec has a size too. `state set <ref> --status spec_ready` from `specifying` is refused, and so is every
other move that lands an sdd item at or past `spec_ready` from before it (`specifying -> in_progress` and `pending
-> spec_ready` with `--force`, `pending -> in_progress`, `blocked -> in_progress`), when
`.mstack/specs/<slug>/spec.md` declares more requirements than the item's size allows: 12 for
`m` or no size, 30 for `l` (`s` cannot be sdd). The count is the number of distinct
`### Requirement: R<n>` ids, the same ones the requirement-to-test table is checked against.
The refusal names the count and the limit and the two ways out. `--force` alone is refused
too, because the move has to be on the record: it needs `--closed-by "<why>"`, and with both the
item moves and the reason is written as a `spec-size` decision row (item column set). The reason is
that row's and nothing else's: an open item does not get a `closed_by`, so no later close picks it up as its note:

```console
$ mstack state set greet --status spec_ready
mstack: .mstack/specs/greet/spec.md declares 13 requirements, and a size m item may have 12
        cut the spec to 12 or fewer, or pass --force with --closed-by "<why this many is right>"

$ mstack state set greet --status spec_ready --force
mstack: --force would move greet to spec_ready past the 12 requirement limit, and that has to be on the record
        add --closed-by "<why this many is right>"; it is written to decisions.tsv as a spec-size row

$ mstack state set greet --status in_progress --force
mstack: --force would move greet to in_progress past the 12 requirement limit, and that has to be on the record
        add --closed-by "<why this many is right>"; it is written to decisions.tsv as a spec-size row

$ mstack state set greet --status spec_ready --force --closed-by "the 13 parts ship as one release and cannot be split"
1 greet (spec_ready)
  forced: greet has 13 requirements, over the 12 a size m item may have; the reason is recorded as a spec-size decision row
  status: "specifying" -> "spec_ready"
```

Each of the first three is run on the item at `specifying`; from `spec_ready` the move to
`in_progress` is not asked again. This block is from a scratch store of its own, where `greet` is
an sdd item with a spec of 13 requirements.

## ledger record / check / summary

```console
$ mstack ledger record greet-flag "$(git rev-parse HEAD)" test-verified \
    --evidence "python3 -m unittest test_greet -v: 2 tests, OK" --verifier implementer
recorded test-verified for greet-flag at 4b63888b

$ mstack ledger check greet-flag
PASS test-verified at 4b63888b by implementer (the author's own verdict, not an independent approval)

$ mstack ledger summary
2026-08-19T21:08:48.016Z  greet-flag  4b63888b  test-verified  python3 -m unittest test_greet -v: 2 tests, OK
2026-08-19T21:08:56.136Z  greet-flag  4b63888b  test-verified  reviewer re-ran python3 -m unittest test_greet: 2 tests, OK; diff read against both acceptance bullets
```

The SHA must name a commit that exists in this repository, the target must not be empty, and
the evidence must be at least a phrase; forty zeros, a blank target and a one-character
evidence all used to record fine, and no longer do. An abbreviated SHA (4 to 39 hex characters)
is resolved through git to the one commit it names, to the full 40 characters, by both `record`
(which stores the full one) and `check`; one that names no commit, or two, is refused by
`record` and finds no row in `check`. A row recorded with 7 characters before that
(this repository's ledger has one) is still read as the commit it is a prefix of.
`check` takes an optional SHA (default: the current head) and `--min <verdict>` for a floor.
It judges a SHA through `readVerdict`, the one function the gate's closing audit also calls,
by the latest row from a role that can close an item: a `verifier-failed` from a reviewer fails
the check and names itself, whatever an implementer recorded at that SHA (a rejection counts
even when its evidence cites the implementer's report), and it stands until a later
*independent approval* answers it. A `verifier-blocked` after it does not: "could not verify"
is not an answer to "this is wrong", and the check names both rows. A lone `verifier-blocked`
fails the check (nothing was verified) but is what the gate accepts for an item nothing can
verify. An approval whose evidence cites the implementer's own report, or the spec-author's, is
not independent, so when every closing-role row is of that kind the check fails and names the
role whose report it cites, as the gate does. Only when every row at the SHA is the author's
own does it fall back to the best one, and then it says so, as above.
A `verifier-blocked` whose evidence cites the implementer's own report is discounted the same
way, so it does not count as that escape hatch.
`state set --status done` refuses an item whose standing verdict is a rejection, and says which
row, with the same function. It reads the rows at the commit being closed and, too, every row
of the item, so a rejection recorded later against another commit also refuses the close
where `check` at the current head passes. It also refuses, with the gate's own words and fix
line, an item with no ledger row at all, and an item whose rows are all the author's: only rows
under a name for the pass that wrote the work (`implementer`, `spec-author`, their spellings,
`self`, `me`, or an empty `--verifier`), or an approval citing that pass's report; `--force`
does not override it, and with `rules.require_verdict_to_close` off none of these is asked.
Any other `--verifier` name closes: the set is open on purpose. What follows the last colon is
what is compared (`mstack:implementer` and `ci:dev` are the author's, `dev:ci` closes), as a
whole name, after zero-width and other format characters (Unicode category Cf) are removed, as
the evidence check removes them from a filename, and ignoring case, spaces, hyphens and
underscores (`dev-ci` is not `dev`; `self` with a zero-width space inside is still `self`).
Look-alike letters are not folded, here or in the evidence check: a Cyrillic `е` in `self` is
another name, and closes.
The row is keyed by `(target, sha)`, so a new commit voids it:

```console
$ mstack ledger check greet-flag        # after one more commit
FAIL no verdict at 542ac0cf; 2 row(s) exist at other SHAs and a new head SHA voids them
```

## cost

```console
$ mstack cost
item   input  cache_write  cache_read  output  messages     usd  rounds  failed
demo      20       18,478     178,698   2,274         9  0.0066       0       0
total     20       18,478     178,698   2,274         9  0.0066

$ mstack cost demo
role          input  cache_write  cache_read  output  messages     usd
main             20       18,478     178,698   2,274         9  (none)
unattributed      0            0           0       0         0  0.0066
total            20       18,478     178,698   2,274         9  0.0066
review rounds: 0
verifier-failed rows: 0
```

Both outputs are from a real single-turn `claude -p --model haiku "say hi"` session, the
`SessionStart`, `Stop` and `SessionEnd` hooks wired to this checkout's `mstack hook ...`, and `cost`
run afterwards. The `main` row equals claude's own `modelUsage` for the session to the token
(20 / 18,478 / 178,698 / 2,274) and `unattributed` carries no tokens and the whole `$0.006622`.
`mstack cost [slug] [--by role|item|model] [--json]`: with no slug the rows are items (default
`--by item`), with a slug they are roles (default `--by role`). `--json` prints the same rows
plus `total`, and for one item `review_rounds` and `verifier_failed`.

What the columns are:

- **tokens** come from `.mstack/costs.tsv`, which `cost` first brings up to date by flushing every
  session whose transcript has grown since its last flush, the live one included. The shape of
  the file and the recording rules are in [State-Files](State-Files.md#coststsv).
- **`usd`** is not computed. There is no price table in this repository. The figure is the one
  Claude Code itself wrote into the transcript (`cost-state`, `costUSD` per model), and it is
  attached to the `unattributed` row, so the column's *sum* is what the session really cost
  while the per-role split is tokens only. `(none)` means no real figure exists for the group.
  **Per item**, the cost of a session goes to the one real item that carried usage in it, to
  `(none)` when no item did, and to `multi-item sessions` when two or more did. It is decided
  from the stretches that hold usage, not from the marks: a session that closes its item in the
  last turn leaves a trailing `(none)` stretch with nothing in it, and a session can open with
  no item, and neither is a second item. A session that really worked on `alpha` and then
  `beta` has one cost and no honest way to split it (token share is not cost share: cache reads
  and output are priced very differently), so `--by item` prints it as its own line carrying the
  whole session cost, while the tokens stay with the item each stretch belonged to.
  `mstack cost alpha` therefore shows alpha's tokens and no `usd` for that session, and the
  column still sums to real spend.
- **`unattributed`** is the part of the real total that no transcript line accounts for: calls
  a transcript never records (an internal subagent call with no transcript file, seen in
  interactive sessions) and whatever a `/compact` spent (its usage appears in `cost-state` and
  in no transcript). A session whose usage predates its first mark, such as one resumed from
  before mstack was installed, shows up here too.
- **`rounds`** (and `review rounds:` for one item) is the highest review round on disk,
  read with `roundOf` from the report names: `review_<slug>.md` is round 1, `_r2` the next.
  **`failed`** counts `verifier-failed` rows in `ledger.tsv`. Both are what a cost number needs
  beside it: tokens spent per round that did not close the item.

`rules.record_costs: false` in `state.json` turns recording off: no marks, no flushes, and
`cost` says so on stderr and shows only the rows already on disk. Any value that is not a
boolean is an error, not a silent default.

## decide

```console
$ mstack decide --phase implement --decision "Ship the status line as 'mstack statusline'" \
    --why "A second executable would duplicate the whole launcher" \
    --evidence "bin/mstack:20-53 is the entire runtime resolution" \
    --result "acceptance bullet amended"
recorded
```

One row per decision, append-only, TSV so GitHub renders it as a table. With `--resolves
<ref>`, the same command answers an item's `decision_required` fork: it writes the row with a
`resolves` column naming the item and stamps the item with the row's timestamp, atomically.
Every row also carries the item it was written for, in a trailing `item` column: the active
item's slug, or empty when none is active. `--item <slug>` files it under another item, and a
slug that is not an item is refused with nothing written:

```console
$ mstack decide --phase implement --decision d --item nope
mstack: no item matches 'nope'
        --item takes the slug (or id) of an item in state.json
```

`item` is not `resolves`: `resolves` names the item whose fork the row answers and is usually
empty; `item` says whose work the row belongs to, which is what the gate matches a review round
to. A `decisions.tsv` written before the column has a seven-column header; the first `decide`
rewrites that header line in place, and every old row, which has no eighth cell, reads with an
empty item and is not touched. A decision that says nothing is refused:

```console
$ mstack decide --phase spec --decision "x" --why "y" --evidence "z" --result done --resolves export-json
mstack: resolving a fork needs --decision to say something; got 1 characters, and a token is not an answer
        answer it properly or leave the fork open; a row nobody can read is the boolean this mechanism exists to avoid

$ mstack decide --phase spec --decision "The export is a stable public contract; the envelope carries a version field and a compatibility rule" \
    --why "The consumer is another tool running unattended, so a silent shape change breaks it; versioning turns that break into a detectable one" \
    --evidence "Asked the requester; the consuming tool parses the output in CI, quoted in the item source thread" \
    --result "versioned envelope; breaking changes bump the version" \
    --resolves export-json
recorded, and export-json no longer has an open fork
```

## worktree new / list / prune

```console
$ mstack worktree new export-json --base main
Preparing worktree (new branch 'feat/export-json')
/private/tmp/.../demo-repo-wt-export-json
branch feat/export-json from main at cf928696
record that base SHA in .mstack/progress/current.md before you start

$ mstack worktree list
542ac0cf  feat/greet-flag                    main,dirty     /private/tmp/.../demo-repo
cf928696  feat/export-json                   merged         /private/tmp/.../demo-repo-wt-export-json

$ mstack worktree prune
would remove /private/tmp/.../demo-repo-wt-export-json - feat/export-json is merged into the default branch

nothing was removed. Re-run with --yes once you have read the list.

$ mstack worktree prune --yes
removing /private/tmp/.../demo-repo-wt-export-json - feat/export-json is merged into the default branch
removed 1 worktree(s)
```

The default base is `origin/main`; in a repository with no remote, pass `--base main`
explicitly, or `worktree new` fails on the missing reference. `--prefix fix` changes the
`feat/` branch prefix. Each worktree carries its own `.mstack/`, which is what makes "one
active item" mean one active item *here*. Prune is a dry run until `--yes`, refuses a dirty
worktree (checked including ignored files, because a `.env` is exactly what `--porcelain`
alone misses), and never offers the worktree you are standing in.

## merge-gate

```console
$ mstack merge-gate 1
mstack: gh pr view 1 failed
        Command failed: gh pr view 1 --json number,state,isDraft,mergeStateStatus,reviewDecision,headRefOid,statusCheckRollup - check 'gh auth status'
```

That run is from a repository with no remote, and the refusal is the documented behaviour:
without a PR to inspect it stops (exit 2) rather than deciding on nothing. Against a real PR it
prints `GO`, `WAIT` or `STOP` with every reason, and exits 0, 1 or 2 respectively. `--target
<slug>` names the ledger row to require and `--min <verdict>` sets the floor. Its rules are in
[Gates-and-Hooks](Gates-and-Hooks.md).

## fanout plan / check

```console
$ mstack fanout plan --kind review --worker correctness --worker security --worker tests
review fan-out on export-json, 3 worker(s):
  correctness	/private/tmp/.../demo-repo/.mstack/progress/review_export-json_correctness.md
  security	/private/tmp/.../demo-repo/.mstack/progress/review_export-json_security.md
  tests	/private/tmp/.../demo-repo/.mstack/progress/review_export-json_tests.md

Give each worker its own path. Two workers with one filename lose a report silently.

$ mstack fanout check --kind review --worker correctness --worker security --worker tests
-- review fan-out on export-json
[ok]    correctness -> review_export-json_correctness.md (127 bytes)
[ok]    tests -> review_export-json_tests.md (121 bytes)
[fail]  security returned without writing its report
        fix: its reply is not evidence; re-run it and have it write the file before returning
```

Worker names are lowercase words joined by hyphens, and a name starting `r<digit>` (`r2`, `r2-facts`, `r2x`)
is refused, so no planned path can be misread as a round marker (a file already on disk is read by the narrower rule in [The agents](The-Agents.md#reviewer): `_r2x` is a lens named `r2x`):

```console
$ mstack fanout plan --kind review --worker r2
mstack: 'r2' is not a usable worker name: it would be read as a round marker
        names starting r<digit> are reserved for review rounds; pick a lens name like 'reader' or 'security'
```

A lone reviewer asks for its path with `--solo`, and the tool counts the rounds. The path is
`review_<slug>.md` for round 1 and `review_<slug>_r<N>.md` after, where N is one more than the
highest round of any review report of the item on disk, lone or lensed: a round-1 panel is round 1, so
the next lone review is round 2, and with only `_r3` on disk the next is `_r4`. Round 3 or
later is refused without `--justify "<why>"`, and with it the command writes the item's
`review-r<N>` decision row itself, which `mstack gate` asks for ([Gates and
hooks](Gates-and-Hooks.md)); asking again for a round that has its row writes no second one.
It prints the path and, on its own line, the last commit a reviewer recorded in the ledger for
the item that is still an ancestor of `HEAD` (a ledger row of any verifier other than the
implementer or the spec author; a row whose commit a rebase dropped is skipped), or says there
is none. `--solo` takes no `--worker` and no `--round`, only `--kind review`, and only `plan`:

```console
$ mstack fanout plan --kind review --solo
review round 2 of greet, one lone reviewer; the report goes to:
/private/tmp/.../.mstack/progress/review_greet_r2.md
last reviewed commit, still an ancestor of HEAD:
beb01d1a139af19dc4918630327944f80ce25e56

$ mstack fanout plan --kind review --solo
mstack: round 3 of a lone review of greet needs a reason
        rounds from 3 on are written down; pass --justify "<why another round is worth it>" and the decision row (phase review-r3) is written for you

$ mstack fanout plan --kind review --solo --justify "round 2 left the empty-flag case open; one more pass on that only"
review round 3 of greet, one lone reviewer; the report goes to:
/private/tmp/.../.mstack/progress/review_greet_r3.md
last reviewed commit, still an ancestor of HEAD:
beb01d1a139af19dc4918630327944f80ce25e56
recorded the review-r3 decision row for greet
```

`plan` allocates one report path per parallel worker **before** launch and refuses a fan-out
past the session's concurrency cap, because spawning past it fails outright rather than
queueing. `check` names the workers that did not report, rather than counting them: "security
did not report" tells you what to re-run. Kinds cover the roles with report contracts plus
`explore` and `design`.

## statusline

```console
$ printf '{"model":{"display_name":"Opus"},"workspace":{"current_dir":"%s"},"context_window":{"used_percentage":31}}' "$PWD" \
    | mstack statusline
Opus · feat/greet-flag · #3 export-json · spec_ready · unverified · ctx 31%
```

Reads Claude Code's status-line JSON on stdin, prints one line (with ANSI colour, stripped
here), exits 0 no matter what. `--subagent` renders the agent-panel rows instead. Wiring and
the full behaviour are in [Status-Line](Status-Line.md).

## version

```console
$ mstack version
mstack 0.1.0 at /.../mstack
```

The path is printed absolute; it is elided here.

One line: the version from the running copy's own `.claude-plugin/plugin.json`, and the
resolved root that copy executes from. The path is the load-bearing half. Two copies of this
plugin have been observed declaring the same version string while ten of their twelve `src/`
files differed and their gates disagreed on an exit code, so when a transcript or a bug
report needs to say *which* `mstack` ran, the path is the part that answers. It needs no
store, and an unreadable manifest prints `(version unknown)` rather than exiting non-zero —
the path still identifies the copy on its own.

The line exists for one trap in particular: inside a checkout of this plugin itself, the
`mstack` on `PATH` is the *installed* copy, not the code being edited. The gate catches that
case by itself ([Gates-and-Hooks](Gates-and-Hooks.md#what-mstack-gate-checks)); `version` is
how any other run says which copy produced it. A copy installed before this subcommand
existed refuses it with `unknown command 'version'` — that refusal is itself the answer,
because it means the copy predates everything on this page that mentions the subcommand.

## lint-plugin

```console
$ mstack lint-plugin .
-- manifest
[ok]    plugin name: mstack
...
-- shipped commands
[ok]    35 file(s), no command that would hang on stdin

-- cross-references
[ok]    19 skills and agents, every cross-reference in 40 file(s) resolves

-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings
```

Validates the prose the way tests validate the code: front matter and description caps on
every skill, every relative link in the reference files, every `mstack:` cross-reference,
hook events against the handler list, a ban on shipping any command shaped like `rg PATTERN
--glob '*.md'` with no path (which blocks forever on a subagent's stdin; one such command
shipped and hung the agent that ran it), and a check that the lifecycle enum exists in exactly
one file.
