# The CLI

`bin/mstack` is on `PATH` for every Bash call while the plugin is enabled. It is a small `sh`
launcher over `src/cli.ts`; there is no build step, and the CLI uses only `node:` builtins.
Every output block below is from a real run in a scratch repository, except where a command is
shown refusing for a documented reason.

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
0
```

Fast, milliseconds, safe as a `Stop` hook. `--full` also runs the project's `verify` command
and the active item's `verification` command. `--quiet` prints failures only. The full
walkthrough of every check is in [Gates-and-Hooks](Gates-and-Hooks.md).

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

$ mstack state active
greet-flag
```

`state list` marks active items with `*`. `state active` prints the slug alone to stdout so
`SLUG=$(mstack state active)` works, and exits 1 with a stderr note when nothing is active.
`state set` accepts an id or a slug, refuses illegal transitions and unanswered forks (exit 2),
and takes `--force` for the deliberate exception, which the gate will still audit. Other flags:
`--sdd` to opt into the spec path, `--decision-required "<the fork>"`, `--closed-by "<note>"`.

```console
$ mstack state set greet-flag --status done
mstack: in_progress -> done is not a legal transition
        pass --force if you mean to skip a phase, and say why in decisions.tsv
```

## ledger record / check / summary

```console
$ mstack ledger record greet-flag "$(git rev-parse HEAD)" test-verified \
    --evidence "python3 -m unittest test_greet -v: 2 tests, OK" --verifier implementer
recorded test-verified for greet-flag at 2f059b9c

$ mstack ledger check greet-flag
PASS test-verified at 2f059b9c by implementer

$ mstack ledger summary
2026-08-19T20:19:53.173Z  greet-flag  2f059b9c  test-verified  python3 -m unittest test_greet -v: 2 tests, OK
2026-08-19T20:20:30.651Z  greet-flag  2f059b9c  test-verified  reviewer re-ran python3 -m unittest test_greet: 2 tests, OK; diff read against both acceptance bullets
```

The SHA must name a commit that exists in this repository, and the evidence must be at least a
phrase; forty zeros and a one-character evidence both used to record fine, and no longer do.
`check` takes an optional SHA (default: the current head) and `--min <verdict>` for a floor.
The row is keyed by `(target, sha)`, so a new commit voids it:

```console
$ mstack ledger check greet-flag        # after one more commit
FAIL no verdict at 021024f8; 2 row(s) exist at other SHAs and a new head SHA voids them
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
$ mstack decide --phase spec --decision "x" --why "y" --evidence "z" --result done --resolves export-csv
mstack: resolving a fork needs --decision to say something; got 1 characters, and a token is not an answer
        answer it properly or leave the fork open; a row nobody can read is the boolean this mechanism exists to avoid

$ mstack decide --phase spec --decision "The CSV is a one-off dump; the finance tool imports it manually once a quarter" \
    --why "The consumer is a human pasting into a spreadsheet, not a pipeline" \
    --evidence "Asked the requester; their reply is quoted in the item source thread" \
    --result "no version field; the shape may change with notice" \
    --resolves export-csv
recorded, and export-csv no longer has an open fork
```

## worktree new / list / prune

```console
$ mstack worktree new export-csv --base main
Preparing worktree (new branch 'feat/export-csv')
/private/tmp/.../demo-repo-wt-export-csv
branch feat/export-csv from main at 0a1eec12
record that base SHA in .mstack/progress/current.md before you start

$ mstack worktree list
021024f8  feat/greet-flag                    main,dirty     /private/tmp/.../demo-repo
0a1eec12  feat/export-csv                    merged         /private/tmp/.../demo-repo-wt-export-csv

$ mstack worktree prune
would remove /private/tmp/.../demo-repo-wt-export-csv - feat/export-csv is merged into the default branch

nothing was removed. Re-run with --yes once you have read the list.

$ mstack worktree prune --yes
removing /private/tmp/.../demo-repo-wt-export-csv - feat/export-csv is merged into the default branch
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
review fan-out on export-csv, 3 worker(s):
  correctness	/private/tmp/.../demo-repo/.mstack/progress/review_export-csv_correctness.md
  security	/private/tmp/.../demo-repo/.mstack/progress/review_export-csv_security.md
  tests	/private/tmp/.../demo-repo/.mstack/progress/review_export-csv_tests.md

Give each worker its own path. Two workers with one filename lose a report silently.

$ mstack fanout check --kind review --worker correctness --worker security --worker tests
-- review fan-out on export-csv
[ok]    correctness -> review_export-csv_correctness.md (124 bytes)
[ok]    tests -> review_export-csv_tests.md (117 bytes)
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
Opus · feat/greet-flag · #2 export-csv · spec_ready · unverified · ctx 31%
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
