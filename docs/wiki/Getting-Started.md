# Getting started

Start here the first time you use mstack. You need Claude Code, `bun` or `node` 22.6 or
newer, and a repository you can experiment in; by the end the plugin is installed and one
work item has gone from filed to closed. If you would rather meet the moving parts before running anything, read
[The-Agents](The-Agents.md) and [Skills-and-Playbooks](Skills-and-Playbooks.md) first and
come back.

This page takes a git repository with one commit, on a branch named `main`, to a first closed
work item; the scratch repository it starts from is shown below. Every command block is
followed by the output it actually produced, in that repository. Where a command is refused,
the refusal is the product working, and it is shown rather than edited out. The binary that
produces and re-runs these transcripts is the mstack repository's own `./bin/mstack` at the
commit that last edited this page; for you, with the plugin installed, `mstack` on `PATH` is
the right spelling, which is why the blocks are written that way.

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

Either way, `mstack` is now on `PATH` for every Bash call Claude Code makes, and the six hooks
in `hooks/hooks.json` are active.

## The repository this page starts from

A git repository with at least one commit, on a branch named `main` (on `master` the gate's
workspace line below reads `on master`). The scratch one used here has `greet.py`,
`test_greet.py` and a `.gitignore`, so the `__pycache__/` that Python writes beside the files
never lands in a commit:

```bash
git init -b main
```

`greet.py`:

```python
import sys


def greet(name):
    return f"Hello, {name}"


if __name__ == "__main__":
    print(greet(sys.argv[1]))
```

`test_greet.py`:

```python
import unittest
from greet import greet


class TestGreet(unittest.TestCase):
    def test_default(self):
        self.assertEqual(greet("world"), "Hello, world")
```

`.gitignore`:

```text
__pycache__/
```

```bash
git add -A
git commit -m "init"
```

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
[ok]    costs.tsv ready
[ok]    .mstack/.gitattributes ready (the append-only tables merge as a union)
[ok]    .mstack/.gitignore ready (verification.tsv and hook-errors.log are machine-local)

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
[main 160a631] chore: add the mstack store
 8 files changed, 64 insertions(+)
 create mode 100644 .mstack/.gitattributes
 create mode 100644 .mstack/.gitignore
 create mode 100644 .mstack/costs.tsv
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

The item: a `--shout` flag for `greet.py`.

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
  base: (unset) -> "160a631e8e6efeff93aa064857b790005569f186"
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

Edit two lines of `.mstack/progress/current.md` in place and leave the rest of the template as
it is: change `- **Item:** _none_` to `- **Item:** greet-flag, the --shout flag`, and replace the
italic line under `## Next step` with `add the flag and its test, then verify`. The gate goes
green. This is the file that survives a crashed context window, and the gate checks that it
says something, not merely that it exists.

### Do the work and verify it

Replace `greet.py` with:

```python
import sys


def greet(name, shout=False):
    text = f"Hello, {name}"
    return text.upper() if shout else text


if __name__ == "__main__":
    args = sys.argv[1:]
    print(greet([a for a in args if a != "--shout"][0], "--shout" in args))
```

and add `test_shout` to `test_greet.py`, which is now:

```python
import unittest
from greet import greet


class TestGreet(unittest.TestCase):
    def test_default(self):
        self.assertEqual(greet("world"), "Hello, world")

    def test_shout(self):
        self.assertEqual(greet("world", shout=True), "HELLO, WORLD")
```

Then run the flag and the verification the item names:

```console
$ python3 greet.py --shout world
HELLO, WORLD

$ python3 -m unittest test_greet -v
...

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Write the implementation report, `.mstack/progress/impl_greet-flag.md`. The close reads its
`| R | Test | Where |` table, one row per acceptance bullet in order (`A1`, `A2`);
`agents/implementer.md` defines it. `Where` is a line of your own test file: `test_greet.py:6`
is `def test_default` and `:9` is `def test_shout` in the file above, and a line past the end
of your file is refused at the close. Cut to the part the close reads:

```markdown
# greet-flag: implementation report

## What changed

`greet.py` takes `--shout`; `test_greet.py` covers the flag and the default.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | test_shout | test_greet.py:9 |
| A2 | test_default, test_shout | test_greet.py:6, test_greet.py:9 |
```

Commit the work and the report, then record the verdict against the head SHA:

```console
$ git add -A
$ git commit -m "feat: greet --shout uppercases the greeting"
[feat/greet-flag 2c3d65c] feat: greet --shout uppercases the greeting
 5 files changed, 37 insertions(+), 6 deletions(-)
 create mode 100644 .mstack/progress/impl_greet-flag.md

$ mstack ledger record greet-flag "$(git rev-parse HEAD)" test-verified \
    --evidence ".mstack/progress/impl_greet-flag.md: python3 -m unittest test_greet -v, 2 tests, OK" \
    --verifier implementer
recorded test-verified for greet-flag at 2c3d65c0
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

The legal route is `in_progress -> reviewing -> verifying -> done`. The implementer is finished,
so the item moves to review:

```console
$ mstack state set greet-flag --status reviewing
1 greet-flag (reviewing)
  status: "in_progress" -> "reviewing"
```

Every `state set` prints one line per field it touched. It is the same mechanism that names each
acceptance criterion a `--acceptance` replaces, and the reason is the same: a write nobody sees
is indistinguishable from a no-op.

### The close is audited, and the author's word is not enough

The close needs a verdict from a pass that did not write the code. With only the
implementer's row, the close is refused, and `--force` does not get past it (this is
`require_verdict_to_close` doing its job; the gate audits every closed item for the same thing):

```console
$ mstack state set greet-flag --status done --force --closed-by "demo walkthrough"
mstack: greet-flag cannot close: its only verdicts are from the pass that wrote the code (only implementer)
        a closing verdict has to come from a pass that did not write the code; run the verification again from one and record the row under a name that is not the author's (your own name, or `ci`), or, if no check could be run, record `verifier-blocked` under such a name
```

The item is at `reviewing`, which is where the reviewer runs. It runs the verification itself:
`gate --full` executes it and keeps the receipt the close reads. The gate is green; its one
warning is the uncommitted `.mstack/` edits, expected mid-session. Then the reviewer records its
own row at the same SHA, and the item moves to `verifying` and closes:

```console
$ mstack gate --full
...
[ok]    python3 -m unittest test_greet -v

PASSED - 0 failures, 1 warning

$ mstack ledger record greet-flag "$(git rev-parse HEAD)" test-verified \
    --evidence "reviewer ran mstack gate --full: python3 -m unittest test_greet -v, 2 tests, OK; diff read against both acceptance bullets" \
    --verifier reviewer
recorded test-verified for greet-flag at 2c3d65c0

$ mstack state set greet-flag --status verifying
1 greet-flag (verifying)
  status: "reviewing" -> "verifying"

$ mstack state set greet-flag --status done --closed-by "demo walkthrough"
1 greet-flag (done)
  status: "verifying" -> "done"
  closed_by: (unset) -> "demo walkthrough"

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
[feat/greet-flag 41c8555] chore: close greet-flag
 2 files changed, 5 insertions(+), 2 deletions(-)

$ printf '# demo\n' > README.md
$ git add -A
$ git commit -m "docs: add a readme"
[feat/greet-flag 1bd370d] docs: add a readme
 1 file changed, 1 insertion(+)
 create mode 100644 README.md

$ mstack ledger check greet-flag
FAIL no verdict at 1bd370dc; 2 row(s) exist at other SHAs and a new head SHA voids them
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
