# The CLI

`bin/mstack` is on `PATH` for every Bash call while the plugin is enabled. It is a small `sh`
launcher over `src/cli.ts`; there is no build step, and the CLI uses only `node:` builtins.
Every output block below is from one real run in a scratch repository, except where a command
is shown refusing for a documented reason. The scratch queue mirrors `examples/notes-cli`:
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

PASSED - 0 failures, 0 warnings
```

Never overwrites an existing file unless you pass `--force`.

## gate

```console
$ mstack gate --quiet; echo $?
[fail]  1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start
1
```

Fast, milliseconds, safe as a `Stop` hook. `--full` also runs the project's `verify` command
and the active item's `verification` command.

`--quiet` prints one line per failure and nothing else: no `[ok]` lines, no section headers,
no warnings, no summary count. The fix stays on the line, because a failure that does not name
the next action sends the reader to the source, and this is the mode where they are least able
to ask. It is also the exact text the `Stop` hook hands the model, so the transcript and the
context cannot drift apart.

The stream is deliberate. Failures go to **stderr**, which leaves stdout free for a hook's
structured output — `mstack hook stop` writes JSON there, and failure text in front of it would
stop that JSON parsing:

```console
$ mstack gate --quiet 2>/dev/null | wc -c
       0
```

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

## state add / list / set / active

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
```

`state list` marks active items with `*`. `state active` prints the slug alone to stdout so
`SLUG=$(mstack state active)` works, and exits 1 with a stderr note when nothing is active.
`state set` accepts an id or a slug, refuses illegal transitions and unanswered forks (exit 2),
and takes `--force` for the deliberate exception, which the gate will still audit.

```console
$ mstack state set greet-flag --status done
mstack: in_progress -> done is not a legal transition
        pass --force if you mean to skip a phase, and say why in decisions.tsv
```

### Correcting a field after intake

`state set` takes every field `state add` takes: `--title`, `--description`, `--source`,
`--verification`, `--acceptance`, `--add-acceptance`, `--sdd`, `--decision-required` and
`--closed-by`. A field the item does not carry yet is added rather than refused, and every
edit prints what it replaced, because a write nobody sees is indistinguishable from a no-op.

`--acceptance` **replaces** the whole list and names each criterion it dropped;
`--add-acceptance` appends. One command may not do both.

```console
$ mstack state set greet-flag --description "the flag is off by default" \
    --acceptance '`python3 greet.py --shout world` prints HELLO, WORLD!'
1 greet-flag (in_progress)
  description: (unset) -> "the flag is off by default"
  acceptance: 2 criterion(s) replaced with 1
    - dropped "`python3 greet.py --shout world` prints HELLO..."
    - dropped "test_greet.py covers the flag and the default"

$ mstack state set greet-flag --add-acceptance "test_greet.py covers the flag and the default"
1 greet-flag (in_progress)
  acceptance: 1 added, now 2
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

`--clear` takes `description`, `source`, `verification`, `decision-required`, `sdd` and
`closed-by`. `acceptance` is not among them — the gate fails an item with no criteria, so
replace them instead — and `--slug` is refused outright, because it names the branch, the spec
directory, the progress files and every ledger and decision row already written for the item,
and none of those move with it. Two instructions for one field in one command (`--description
X --clear description`) are refused rather than silently ordered, and a `state set` given
nothing to set exits 2 instead of reporting success.

### Attaching a product fork after intake

A fork is usually found while `specifying`, which is after intake, so `--decision-required` has
to be attachable there. That is the whole reason these flags exist: the gate the README leads
with could previously only be attached by hand-editing `state.json`.

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

## ledger record / check / summary

```console
$ mstack ledger record greet-flag "$(git rev-parse HEAD)" test-verified \
    --evidence "python3 -m unittest test_greet -v: 2 tests, OK" --verifier implementer
recorded test-verified for greet-flag at 4b63888b

$ mstack ledger check greet-flag
PASS test-verified at 4b63888b by implementer

$ mstack ledger summary
2026-08-19T21:08:48.016Z  greet-flag  4b63888b  test-verified  python3 -m unittest test_greet -v: 2 tests, OK
2026-08-19T21:08:56.136Z  greet-flag  4b63888b  test-verified  reviewer re-ran python3 -m unittest test_greet: 2 tests, OK; diff read against both acceptance bullets
```

The SHA must name a commit that exists in this repository, and the evidence must be at least a
phrase; forty zeros and a one-character evidence both used to record fine, and no longer do.
`check` takes an optional SHA (default: the current head) and `--min <verdict>` for a floor.
The row is keyed by `(target, sha)`, so a new commit voids it:

```console
$ mstack ledger check greet-flag        # after one more commit
FAIL no verdict at 542ac0cf; 2 row(s) exist at other SHAs and a new head SHA voids them
```

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
A decision that says nothing is refused:

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

## lint-plugin

```console
$ mstack lint-plugin .
-- manifest
[ok]    plugin name: mstack
...
-- shipped commands
[ok]    32 file(s), no command that would hang on stdin

-- cross-references
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves

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
