# Gates and hooks

The enforcement plane has three parts: five hooks that run on Claude Code's events
(`hooks/hooks.json`, handlers in `src/hooks.ts`), the session gate (`mstack gate`,
`src/gate.ts`), and the merge gate (`mstack merge-gate`, `src/mergegate.ts`). Skills ask;
these enforce.

Two facts about Claude Code hooks shape every handler, both from the hooks reference via
[the research document](../research/pstack-port.md): exit code 2 is the only exit code that
blocks through the code alone, so a hook that means to enforce cannot rely on exit 1; and a
timed-out hook renders no decision at all, so a gate must never depend on being slow.

## The five hooks

| Event | When Claude Code fires it | What mstack's handler does |
|---|---|---|
| `SessionStart` | A session starts, including on `--resume` | Prints the active item, its open `decision_required` if any, and the last checkpoint from `progress/current.md` back into context. Resume is the case that matters: a session that resumes without its checkpoint restarts work that was already done |
| `PostToolUse` | After a matched tool call succeeds (a failed call fires `PostToolUseFailure` instead); mstack matches `Edit\|Write` | The cheapest useful check and nothing more. Re-validates `state.json` after an edit to it, and reminds that `history.md` is append-only after an edit to that. Exits 0 unconditionally: it nudges, it never blocks, because a hook that runs the test suite on every edit is a hook someone switches off |
| `SubagentStop` | A subagent finishes | Checks that the subagent left its report file on disk, and that the file says something: under 40 bytes is a stub, judged per file so one substantial lens does not excuse an empty sibling. Exists because a review subagent once returned a confident summary having written nothing. A reply is not evidence, the file is |
| `Stop` | The main agent is about to end its turn | Runs the fast gate. On failures it returns feedback (`additionalContext`) rather than a block: the same loop protections apply, including the eight-continuation cap, but the transcript labels it feedback and no hook error is raised |
| `PreToolUse` | Before a matched tool call; mstack matches `Bash` | Denies the handful of commands that are hard or impossible to walk back. This is the only hook that blocks |

### What PreToolUse denies

The guard list, from `src/hooks.ts:205-243`:

| Denied | Why |
|---|---|
| `git push --force` / `-f` | rewrites history other people may have pulled; `--force-with-lease` stays allowed |
| `git push` with a `+refspec` | a leading `+` is a force push spelled differently, and it is the spelling that reads as harmless |
| `git reset --hard` | discards uncommitted work with no undo |
| `git branch -D` (and the `--delete --force` spellings) | deleting an unmerged branch loses the work on it; `-d` refuses when that would happen |
| `gh pr merge --admin` | merges past a check `gh` would otherwise refuse; fix the check instead |
| `rm -r` on `.mstack` | deletes the durable state this workflow runs on |

Two sentences in Claude Code's permissions documentation carry this table's weight: "PreToolUse
hooks run before the permission prompt, for every tool except EndConversation", and "A hook
that exits with code 2 stops the tool call before permission rules are evaluated, so the block
applies even when an allow rule would otherwise let the call proceed". The docs do not spell
out the `bypassPermissions` case, but it follows from that ordering: a deny rendered before
the permission system is consulted is a deny no permission mode gets to overrule. The guards
themselves are regexes over the command string, not a shell parser, and
they eat git's global options on purpose: `git -C dir push --force` and `git push origin
+main` both used to slip through as spellings the patterns did not cover. The cost is accepted
and documented in the source: `echo "do not git push --force"` is denied too, and erring in
that direction is recoverable while the other direction is not.

## What `mstack gate` checks

The gate is split fast/slow on purpose. The fast pass touches only the store and the
workspace, finishes in milliseconds, and is what the `Stop` hook runs; the design rule it
inherits is "a gate nobody waits for is a gate nobody runs". Here is a green run from a real
repository, section by section:

```console
$ mstack gate
-- store
[ok]    state.json exists
[ok]    progress/current.md exists
[ok]    progress/history.md exists
[ok]    state.json parses and has the right shape (1 items)

-- state
[ok]    ids are unique
[ok]    slugs are unique
[ok]    every item has at least one acceptance criterion
[ok]    one active item: greet-flag (in_progress)
[ok]    progress/current.md tracks the active item
[ok]    no item carries a decision fork
[ok]    no sdd item is past specifying
[ok]    no closed items to audit

-- workspace
[ok]    on branch feat/greet-flag
[warn]  2 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 1 warning
```

Walking the lines that carry the weight:

- **"parses and has the right shape"** is a shape check, not a parse check. The load-bearing
  case:

  ```console
  $ echo '{"items": {}}' > .mstack/state.json && mstack gate
  [fail]  .../.mstack/state.json parses but has the wrong shape: .items must be an array, got an object
          fix: this is the shape that silently disables every check below it
  ```

  The path is printed absolute; it is elided here.

  `JSON.parse` accepts that file. So does `jq empty`. Every query downstream then reads
  `undefined`, every comparison sees an empty string and never fires, and a gate without this
  check reports green while enforcing nothing. That defect shipped, in production, in the
  harness this was drawn from, and the gate's own comment pins it to two of the harness's
  issue numbers.

- **"one active item"** enforces the rule that makes worktrees meaningful. Two active items in
  one worktree is a failure that names both.

- **"current.md tracks the active item"** checks that the live checkpoint says something, not
  merely that it exists. An active item with the template's `_none_` line still in place fails,
  because if the session dies now, nothing tells the next one where to start.

- **"no item carries a decision fork"** turns into a named failure the moment an item with an
  unanswered `decision_required` sits past `specifying`, quoting the question itself. A fork
  answered by a row that says nothing, or whose result is still `open`, is also a failure: the
  row is the evidence.

- **"no sdd item is past specifying"** requires all four spec artifacts on disk and
  non-trivially sized once an `sdd` item advances. Four zero-byte files used to satisfy it;
  they do not now.

- **"closed items to audit"** is `require_verdict_to_close`. An item marked `done` fails the
  gate if the ledger holds no verdict for it, if its only verdict is `verifier-failed`, or if
  every verdict it has came from the pass that wrote the code (`only implementer`). The escape
  hatch for "no check could be run" is not a prose note but a typed verdict:
  `verifier-blocked`, keyed to a SHA, carrying its reason.

### `gate --full`

`mstack gate --full` runs everything above plus the project's own verification: the `verify`
command from `state.json`, and the active item's `verification` command if it has one. That is
the reviewer's obligation, not the implementer's shortcut; the fast gate stays fast so it can
run on every `Stop`.

```console
$ mstack gate --full
-- store
[ok]    state.json exists
[ok]    progress/current.md exists
[ok]    progress/history.md exists
[ok]    state.json parses and has the right shape (1 items)

-- state
[ok]    ids are unique
[ok]    slugs are unique
[ok]    every item has at least one acceptance criterion
[ok]    no active item
[ok]    no item carries a decision fork
[ok]    no sdd item is past specifying
[ok]    1 closed item(s) carry a ledger verdict

-- workspace
[ok]    on branch feat/greet-flag
[ok]    working tree is clean

-- verification
test_greet (test_greet.TestGreet) ... ok
test_shout (test_greet.TestGreet) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
[ok]    python3 -m unittest test_greet -v

PASSED - 0 failures, 0 warnings
```

That run is from the walkthrough repository after its item closed: the fast sections re-run,
then the `verify` command from `state.json` executes with its output passed straight through,
and its success becomes the `[ok]` line.

## The merge gate

`mstack merge-gate <pr>` decides whether a PR is safe to merge, prints **every** reason rather
than the first, and exits 0 to go, 1 to wait, 2 to stop. Its rules, from
`skills/ship/SKILL.md`:

- `UNSTABLE` and `BLOCKED` are not green.
- A completed failure stops the merge, including an infrastructure one.
- A job that never started is not a failure.
- A verdict at an older SHA does not carry over.

The premise it encodes: green is not safe. Safe means a verdict from a pass that did not write
the code, recorded against **this** head SHA; CI green is an input to that verdict, and an
approving bot review is not one. Anything the gate cannot classify stops the merge: a
`StatusContext` of `ERROR` or `EXPECTED` used to pass through as green, and a missing ledger
target used to drop the verdict check and return `GO`. Both were review-panel findings; both
now stop.

Since it inspects a PR, it needs `gh` and a pushed branch. Run before a remote exists, it
refuses loudly rather than deciding on nothing:

```console
$ mstack merge-gate 1
mstack: gh pr view 1 failed
        Command failed: gh pr view 1 --json number,state,isDraft,mergeStateStatus,reviewDecision,headRefOid,statusCheckRollup - check 'gh auth status'
```

The refusals this page keeps showing are the point. Every one of them is a rule that used to
live in prose somewhere, drifting; here each is a few lines of code that does not care whether
the model remembers it.
