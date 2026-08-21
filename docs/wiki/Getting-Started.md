# Getting started

This page takes a clean repository from nothing to a first closed work item. Every command
block below is followed by the output it actually produced; the run was done in a scratch
repository containing one Python file and one test. Where a command is refused, the refusal is
the product working, and it is shown rather than edited out. The binary that produces and
re-runs these transcripts is the mstack repository's own `./bin/mstack` at the commit that
last edited this page; for you, with the plugin installed, `mstack` on `PATH` is the right
spelling, which is why the blocks are written that way.

## Prerequisites

- Claude Code.
- `bun`, or `node` 22.6 or newer. There is no build step: the TypeScript in `src/` is what
  runs. The launcher prefers bun and falls back to node, where types are stripped natively from
  22.6 onward (`bin/mstack:43-53`).

## Install

Point Claude Code at a clone. There is nothing to build and nothing to install:

```bash
git clone https://github.com/romerma/mstack.git
claude --plugin-dir "$PWD/mstack"
```

The marketplace route works too:

```bash
/plugin marketplace add romerma/mstack
/plugin install mstack@mstack
```

Either way, `mstack` is now on `PATH` for every Bash call Claude Code makes, and the five hooks
in `hooks/hooks.json` are active.

## Create the store

Inside Claude Code, `/mstack:setup` walks this for you and seeds the queue from what the
repository already says. Underneath it is the CLI, which you can also drive directly:

```console
$ mstack setup
[ok]    state.json written
[ok]    progress/current.md written
[ok]    progress/history.md written
[ok]    ledger.tsv ready
[ok]    decisions.tsv ready
[ok]    .mstack/.gitignore ready (verification.tsv is machine-local)

PASSED - 0 failures, 0 warnings
```

Every file in the store is durable state under version control except one. `verification.tsv`
records which verification command was executed *here* and against which commit, so a copy
from another checkout proves nothing about this one — and committing it would move HEAD and
void the very receipt being committed. That is what the store's own `.gitignore` is for.

Prove the store is healthy. Straight after `setup`, with `.mstack/` not yet committed, the
gate passes with two warnings:

```console
$ mstack gate
-- store
[ok]    state.json exists
[ok]    progress/current.md exists
[ok]    progress/history.md exists
[ok]    state.json parses and has the right shape (0 items)

-- state
[ok]    ids are unique
[ok]    slugs are unique
[ok]    every item has at least one acceptance criterion
[ok]    no active item
[ok]    no item carries a decision fork
[ok]    no sdd item is past specifying
[ok]    no closed items to audit
[ok]    no active item, so no verification run is due

-- workspace
[warn]  on main; feature work belongs on its own branch
[warn]  1 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 2 warnings
```

Warnings do not stop a session; failures do, and these two warnings are the gate telling the
truth about the state you are in: the store is uncommitted and you are on the default branch.
Commit the store; it is durable state and belongs in version control:

```console
$ git add -A
$ git commit -m "chore: add the mstack store"
[main 4ef311d] chore: add the mstack store
 6 files changed, 56 insertions(+)
 create mode 100644 .mstack/.gitignore
 create mode 100644 .mstack/decisions.tsv
 create mode 100644 .mstack/ledger.tsv
 create mode 100644 .mstack/progress/current.md
 create mode 100644 .mstack/progress/history.md
 create mode 100644 .mstack/state.json
```

## Wire the status line

Claude Code takes `statusLine` from your settings, not from a plugin, so add it yourself in
`~/.claude/settings.json` or the project's `.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "mstack statusline",
    "refreshInterval": 10
  }
}
```

If the bar comes up empty, point `command` at the absolute path `which mstack` prints inside a
Claude Code Bash call. The full wiring, including the subagent rows, is in
[Status-Line](Status-Line.md).

## A first item, end to end

The scratch repository has `greet.py` and `test_greet.py`. The item: a `--shout` flag.

### Add it and open it

```console
$ mstack state add --slug greet-flag --title "greet --shout uppercases the greeting" \
    --acceptance '`python3 greet.py --shout world` prints HELLO, WORLD' \
    --acceptance "test_greet.py covers the flag and the default" \
    --verification "python3 -m unittest test_greet -v" \
    --source "direct request"
added 1 greet-flag (pending)

$ git switch -c feat/greet-flag
Switched to a new branch 'feat/greet-flag'

$ mstack state set greet-flag --status in_progress
1 greet-flag (in_progress)
  status: "pending" -> "in_progress"
```

### The gate holds you to the checkpoint discipline

Run the gate with the item open and `progress/current.md` untouched:

```console
$ mstack gate
...
[ok]    one active item: greet-flag (in_progress)
[fail]  1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template
        fix: if this session dies now, nothing tells the next one where to start
...
FAILED - 1 failure, 1 warning
```

Fill in the Item line and the Next step in `.mstack/progress/current.md` and the gate goes
green. This is the file that survives a crashed context window, and the gate checks that it
says something, not merely that it exists.

### Do the work and verify it

Add the flag and its test, then run the verification the item names:

```console
$ python3 greet.py --shout world
HELLO, WORLD

$ python3 -m unittest test_greet -v
test_greet (test_greet.TestGreet) ... ok
test_shout (test_greet.TestGreet) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Commit the work, then record the verdict against the head SHA:

```console
$ git add -A
$ git commit -m "feat: greet --shout uppercases the greeting"
[feat/greet-flag 4b63888] feat: greet --shout uppercases the greeting
 4 files changed, 34 insertions(+), 11 deletions(-)

$ mstack ledger record greet-flag "$(git rev-parse HEAD)" test-verified \
    --evidence "python3 -m unittest test_greet -v: 2 tests, OK" --verifier implementer
recorded test-verified for greet-flag at 4b63888b
```

`test-verified` is rung 4 on the evidence ladder: a test that calls the real code and fails
loudly if you are wrong. The verdict enum and the ladder are in
[State-Files](State-Files.md).

### The lifecycle refuses the shortcut

```console
$ mstack state set greet-flag --status done
mstack: in_progress -> done is not a legal transition
        pass --force if you mean to skip a phase, and say why in decisions.tsv
```

The legal route is `in_progress -> reviewing -> verifying -> done`:

```console
$ mstack state set greet-flag --status reviewing
1 greet-flag (reviewing)
  status: "in_progress" -> "reviewing"
$ mstack state set greet-flag --status verifying
1 greet-flag (verifying)
  status: "reviewing" -> "verifying"
$ mstack state set greet-flag --status done --closed-by "demo walkthrough"
1 greet-flag (done)
  status: "verifying" -> "done"
  closed_by: (unset) -> "demo walkthrough"
```

Every `state set` prints one line per field it touched. It is the same mechanism that names each
acceptance criterion a `--acceptance` replaces, and the reason is the same: a write nobody sees
is indistinguishable from a no-op.

### The close is audited, and the author's word is not enough

The item is `done`, a verdict exists, and the gate still refuses:

```console
$ mstack gate
...
[fail]  items closed on a verdict from the pass that wrote the code: greet-flag (only implementer)
        fix: a closing verdict has to come from somewhere other than the implementer; run the verification again from a pass that did not write it
...
FAILED - 1 failure, 1 warning
```

This is `require_verdict_to_close` doing its job. A reviewer that did not write the code runs
the verification itself and records its own row:

```console
$ mstack ledger record greet-flag "$(git rev-parse HEAD)" test-verified \
    --evidence "reviewer re-ran python3 -m unittest test_greet: 2 tests, OK; diff read against both acceptance bullets" \
    --verifier reviewer
recorded test-verified for greet-flag at 4b63888b

$ mstack gate
...
[ok]    1 closed item(s) carry a ledger verdict
...
PASSED - 0 failures, 1 warning
```

In a real session the reviewer is the `mstack:reviewer` agent, which ships without `Write` or
`Edit` and re-runs the verification rather than trusting pasted output. The point survives
either way: the item closed on a second pass's evidence, not the author's.

### What a new commit does to that verdict

The close touched `.mstack/`, so commit the bookkeeping, then make any further commit and ask
the ledger again:

```console
$ git add -A
$ git commit -m "chore: close greet-flag"
[feat/greet-flag ccb9e2e] chore: close greet-flag
 2 files changed, 5 insertions(+), 2 deletions(-)

$ printf '# demo\n' > README.md
$ git add -A
$ git commit -m "docs: add a readme"
[feat/greet-flag 542ac0c] docs: add a readme
 1 file changed, 1 insertion(+)
 create mode 100644 README.md

$ mstack ledger check greet-flag
FAIL no verdict at 542ac0cf; 2 row(s) exist at other SHAs and a new head SHA voids them
```

A verdict is keyed by `(target, sha)`. This staleness is the one signal the status line exists
to surface while there is still time to act on it; see [Status-Line](Status-Line.md).

## Where to go next

- [How-A-Work-Item-Flows](How-A-Work-Item-Flows.md) for the full lifecycle, the spec path, and
  the `decision_required` gate this walkthrough did not trigger.
- [The-CLI](The-CLI.md) for every subcommand, including the ones a first item does not need:
  worktrees, fan-out, the merge gate.
- `examples/notes-cli/` in the repository is a seeded playground with three items, one of them
  carrying a real product fork, and a README section on breaking the gate on purpose.
- [The-Story](The-Story.md) for why the plugin is shaped like this.
