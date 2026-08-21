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
| `Stop` | The main agent is about to end its turn | Runs the fast gate, quiet — never `--full`, and [never a test suite](#verification-that-actually-ran). On failures it returns feedback (`additionalContext`) rather than a block: the same loop protections apply, including the eight-continuation cap, but the transcript labels it feedback and no hook error is raised. That `additionalContext` is how the failures reach the model, and it always was. The failures are *also* written to the hook process's stderr, which Claude Code captures as its own field — what it does with that field is the client's business, not this plugin's; the measurements are [below](#what-the-stop-hook-prints-on-a-red-gate) |
| `PreToolUse` | Before a matched tool call; mstack matches `Bash` | Denies the handful of commands that are hard or impossible to walk back. This is the only hook that blocks |

### What the Stop hook prints on a red gate

Two streams, two audiences, and they must not mix. Here is one real run against a store whose
active item never had its checkpoint written:

```console
$ echo '{"hook_event_name":"Stop","cwd":"'$PWD'"}' | mstack hook stop
[fail]  1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- 1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start"}}
```

The `[fail]` line is on stderr and the JSON is on stdout. The JSON is the hook's structured
output; anything printed in front of it would stop it parsing, which is why `--quiet` writes
where it does. The exit code is 0, because a `Stop` hook nudges and only exit 2 blocks.

Until this was fixed, the `[fail]` line was not there at all: `--quiet` printed nothing on any
stream and the page describing it said "prints failures only". Stating the cost precisely,
because the loose version of that sentence is wrong: the **model always had the failures**,
because `stop()` composes them into `additionalContext` and did so before this change too
(`git show main:src/hooks.ts`, lines 167-178). What produced nothing was every stream, so
`mstack gate --quiet` in a terminal or a script gave back an exit code and no bytes. A green
gate still prints nothing on either stream, warnings included, which is what makes it cheap to
run at the end of every turn.

### What Claude Code does with those two streams

Measured against the shipped client, 2.1.238, because the honest answer differs by stream and
this page previously asserted more than had been checked. A hook exiting 0 that writes to both:

```console
hook_response for SessionStart:startup exit_code=0 outcome=success
   output : "CANARY-ON-STDERR\n{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"CANARY-IN-CONTEXT\"}}"
   stdout : "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"CANARY-IN-CONTEXT\"}}"
   stderr : "CANARY-ON-STDERR\n"
```

Two things that settles. The JSON on stdout is parsed and its `additionalContext` honoured
**while stderr sits beside it** — so the stream split is not a theory, it is the arrangement the
client expects. And stderr is not discarded: it is captured verbatim as its own field, and
appears in `output` too.

One thing it does not settle, stated rather than glossed: whether the interactive transcript
*renders* that field to a person. Reading the client's exit-0 hook branch, the `hook_success`
message's rendered `content` is derived from `stdout`, with `stderr` carried as a sibling
field. So the failures are certainly **captured**; that they are **displayed** is the client's
behaviour and is not something this repository can promise. The audience this fix reliably
reaches is anyone running `mstack gate --quiet` themselves, plus the model, which had them all
along.

The canary above is a `SessionStart` hook rather than `Stop` only because completing a turn
was not available in that environment; the client's exit-0 handling is one shared branch across
hook events, which is what makes the substitution fair.

### What PreToolUse denies

The guard list, from `src/hooks.ts:230-271`:

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
the permission system is consulted is a deny no permission mode gets to overrule.

The guards themselves are regexes over **one shell command at a time**, not a shell parser,
and they eat git's global options on purpose: `git -C dir push --force` and `git push origin
+main` both used to slip through as spellings the patterns did not cover.

"One command at a time" is the half that took two rounds to get right, and it splits into two
rules that lean opposite ways.

Within a single command the match is loose, and the cost is accepted: `echo "do not git push
--force"` is denied, because erring toward a line the author rewrites is recoverable and the
other direction is not.

Across commands it is not loose, because there is nothing to be loose about. A separator ends
a command, so text after it cannot be an argument to what came before, and matching across one
denies work that does nothing the rule warns about — `rm -rf /tmp/x && mstack decide
--evidence ".mstack/x.md"` was denied by a pattern that read the store name out of the *next*
command. So `preToolUse` cuts the line on `&&`, `||`, `;`, `&`, `|` and newlines
first (`shellSegments`, `src/hooks.ts:273-383`) and runs each guard against each piece alone.
`git push origin main && echo 'use --force only after asking'` is therefore allowed.

The cut is where the danger moved. A separator inside `$(...)`, backticks, `<(...)` or a
quoted string does **not** end the command, and a scanner that cuts there hands each guard
half a command: the verb in one fragment, its argument in another, and no match on either.
That is a false *allow*, and it shipped for exactly one review round —
`rm -rf $(cd /r && pwd)/.mstack` was denied by the un-segmented guard and allowed by the first
segmented one, across all five rules that carry the shape. The scanner now tracks quotes,
backslash escapes, redirection operators and substitution depth, and the rule written at the
top of `shellSegments` is one-directional: a construct it cannot model must leave a segment
too long, never too short.

None of this makes the array a sandbox, and the source says so rather than implying otherwise:
an interpreter one-liner, `find -delete`, `fd -X rm`, a path arriving through a variable, or
`mv` followed by a deletion all pass, because a `PreToolUse` hook only ever sees the string.

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
[ok]    greet-flag is in_progress; a verification run is due at verifying

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

- **"a verification run is due at verifying"** is the check described [below](#verification-that-actually-ran).
  It runs nothing; it reads a record of what `--full` ran, and from `verifying` on it refuses
  to call an item green on a verification that never executed here.

- **"store root is an mstack checkout"** does not appear in the transcript above, and in your
  repository it never will: it speaks only where the store's root is a checkout of this
  plugin itself, identified by `.claude-plugin/plugin.json` naming `mstack` (plus
  `bin/mstack` and `src/cli.ts` existing, so the fix it prints is runnable — file markers
  alone false-positived on an ordinary project that happened to carry both names). There,
  the `mstack` on `PATH` is the *installed* copy, and a report it produces comes from code
  that can predate the checks under review — reproduced as an installed 0.1.0 printing
  `PASSED` exit 0 over a store whose own gate printed `FAILED` exit 1, at the same commit.
  So a gate run by a foreign copy in a checkout is a failure that names the copy that ran
  and the `bin/mstack` to run instead, and every other subcommand adds one stderr line
  saying the same; `mstack version` prints which copy is running either way.

  Foreign means outside the *repository*, not merely at another path. A `git worktree` of
  the checkout shares its git common dir and is not foreign — deliberately, at any commit,
  because the hooks run `${CLAUDE_PLUGIN_ROOT}/bin/mstack`, a path a session cannot redirect
  per worktree, and the orchestrate flow makes worktrees the unit of parallel work; a gate
  that is red every turn on byte-identical code is a hook people switch off. What that
  trades away is recorded in the decision row: a worktree at a different commit runs
  different code and is accepted, bounded by the fact that worktrees are created from,
  merged into and pruned by the same repository. A separate clone answers with a different
  common dir and stays foreign, as does the installed cache, which is not a git repository
  at all. The honest limit: the check ships with the code that is being missed, so a copy
  installed *before* it existed still reports nothing — it closes every future round of
  this trap, not the one already on disk.

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
[ok]    one active item: greet-flag (verifying)
[ok]    progress/current.md tracks the active item
[ok]    no item carries a decision fork
[ok]    no sdd item is past specifying
[ok]    no closed items to audit

-- workspace
[ok]    on branch feat/greet-flag
[warn]  1 uncommitted change(s); expected mid-session, not at close

-- verification
test_greet (test_greet.TestGreet) ... ok
test_shout (test_greet.TestGreet) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
[ok]    python3 -m unittest test_greet -v

PASSED - 0 failures, 1 warning
```

That run is from the walkthrough repository with its item at `verifying`: the fast sections
re-run, then the item's `verification` command executes with its output passed straight
through, and its success becomes the `[ok]` line. The `state` section is one line shorter than
on the fast gate, because the check that asks for a *record* of a past run stands down when a
real one is about to happen in the same process.

"Passed straight through" is literal, and it is the one place `--quiet` does not hold.
`src/gate.ts` runs the verify command with its stdio inherited, so its output lands on stdout
whether or not `--quiet` was given; `--quiet` governs the gate's own lines, not a subprocess
handed the terminal. It is shown in [The-CLI](The-CLI.md#gate), and it is why the "nothing else
on stdout" promise on that page is scoped to the fast gate. It is also why no hook runs
`--full`: stdout is the structured channel there, and arbitrary test output in front of a
hook's JSON stops it parsing.

A `--full` that ran nothing at all is a failure and exits 1:

```console
$ mstack gate --full | tail -6
-- verification
[fail]  --full ran no verification: state.json has no 'verify' command and parse-config has no 'verification' command
        fix: set one with 'mstack state set <slug> --verification "<command>"', or put a project-wide 'verify' in state.json

FAILED - 1 failure, 0 warnings
```

It used to warn and exit 0, so asking for the full gate and getting no verification was
indistinguishable from asking for it and passing. Same family as `{"items": {}}` above: a check
whose own inputs are missing has to say so, not report success.

## Verification that actually ran

The gap this closes is the one the `Stop` hook could not see. The fast gate touches only the
store and the workspace, so `state.verify` and `item.verification` were executed by nothing but
a human typing `mstack gate --full`. In one real session an item's `verification` was a
non-executable string from intake — half command, half prose — and it stayed red for 230
minutes across four agent passes. Nothing noticed, because nothing ran it:

```console
$ sh -n -c "run the unit tests for greet and confirm they pass: python3 -m unittest test_greet"
$ echo $?
0
```

`sh -n` accepts it. **The only thing that catches a non-executable verification is running it.**

So the two halves are joined by a receipt rather than by making the fast pass slow. `--full`
writes down what it ran, against which commit, and how it went; the fast gate reads that back.
Here is the whole loop against a store whose `verification` is that same string, one line per
step:

```console
$ echo '{"hook_event_name":"Stop","cwd":"'$PWD'"}' | mstack hook stop 2>&1 >/dev/null
[fail]  1 greet-flag (verifying) is one step from done, and `run the unit tests for greet and confirm they pass: python3 -m unittest test_greet` has never been executed -> run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check

$ mstack gate --full | tail -5
-- verification
/bin/sh: run: command not found
[fail]  run the unit tests for greet and confirm they pass: python3 -m unittest test_greet failed
        fix: fix it; a red verification is not a partial pass

$ column -s$'\t' -t .mstack/verification.tsv
target      sha                                       command                                                                             outcome  ts
greet-flag  2585b1f4882e76854f83d40e8e8914cdf9dc4f07  run the unit tests for greet and confirm they pass: python3 -m unittest test_greet  failed   2026-08-21T11:58:07.118Z

$ echo '{"hook_event_name":"Stop","cwd":"'$PWD'"}' | mstack hook stop 2>&1 >/dev/null
[fail]  1 greet-flag (verifying) is one step from done, and `run the unit tests for greet and confirm they pass: python3 -m unittest test_greet` ran at 2585b1f4 and failed -> run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check

$ mstack state set greet-flag --status done
mstack: greet-flag cannot close on a verification that has not run: `run the unit tests for greet and confirm they pass: python3 -m unittest test_greet` ran at 2585b1f4 and failed
        run 'mstack gate --full' at this commit; closing is the one moment the run has to be real, and --force closes it unverified
```

Note what the second `Stop` costs: nothing is executed, and it still cannot go green. That is
the whole design. The eleven rules that make it hold:

| Rule | Why it is that and not something looser |
|---|---|
| The record is keyed to `(commit, command text, tree)` | Each third of that key was a hole once. The ledger's rule, applied to a run: a new head SHA voids the row. Keying it to the *item* instead would let a green run of the old string vouch for a string edited afterwards, which is precisely the failure above. And keying it to the commit alone certifies a *commit*, not a *tree* — see the row below |
| The working tree is part of the key, minus `.mstack/` | A commit-only key made every uncommitted edit after the run invisible: a green `gate --full`, then `printf 'exit 1' > check.sh`, then a close, all at exit 0 with the verification red the whole time. The dirty-tree warning is a uniquely weak backstop here, because `state set --status done` writes `state.json` itself, so the tree is dirty at close by construction and the warning carries no signal. The store is excluded, and that exclusion is what makes the rule usable rather than merely correct: every session writes `state.json`, `current.md` and the receipt file itself while an item is open, so hashing those would go red because someone wrote a line of their own progress notes |
| That tree key hashes **contents**, not the list of dirty paths | The first version hashed `git status --porcelain`, whose lines are two status characters and a path. It therefore keyed on *which* files were dirty — so if the tree was already dirty when `--full` ran, the ordinary mid-session state, every further edit inside those same paths moved nothing and the same green-gate-on-a-red-verification came back one layer in. It is `git diff HEAD` for tracked paths plus a content hash per untracked file, because a `git diff` alone never mentions untracked ones and that would be the hole a third time. Chosen with numbers: 58ms and 34ms against 638ms for a temp-index `write-tree`, which is equally complete but writes loose objects into `.git` as a side effect of a read-only check |
| The tree is sampled **after** the commands run, not before | A verification that writes anything into the repository — a log, a coverage file, a snapshot — would otherwise void its own receipt the instant it ran, so a green `--full` would be followed immediately by a red gate. Not permanently: a second `--full` recovers, because by then the artifact exists and the tree stops moving. But "run it twice and it works" is the shape people stop running, which is the failure the cost boundary exists to bound |
| A tree git cannot describe is said out loud | `unknown` is the one tree value that switches half the key off, because both sides compute it identically and therefore match. The gate used to print "verification ran and passed" over the top of that, which is the mechanism claiming a check it did not make |
| A symlink is keyed by its target string, and nothing is read through one | `git hash-object` **follows** symlinks; git's own index does not, recording a symlink blob as the target string. Following it broke four ways at once, each an ordinary untracked link — made, not yet committed, not yet ignored. A link to a **directory** or a **dangling** one cannot be hashed at all, so the whole tree half switched off and an item closed green on a verification exiting 1. A link to a **file** hashed bytes from outside the repository. A link to **`/dev/zero`** read until the git timeout, 5.25s a call and twice a gate. Now each untracked path is `lstat`-ed and only a regular file is ever opened |
| The fingerprint is computed once per gate, not twice | It was computed once for the `unknown` warning and again inside the check, doubling the content hashing on the path that runs at the end of every turn. It is also why the `/dev/zero` link cost ten seconds rather than five: two timeouts, not one |
| The **last** run at a commit wins, not the best | A suite that passed and was then re-run red is red. "Best" is how a stale pass survives a broken build |
| It is demanded from `verifying`, and nowhere earlier | This rides the `Stop` hook, which fires at the end of every turn. Held from `in_progress` it would go red after every commit for the whole phase where most commits happen, and a gate that is red for a normal mid-session state is a gate someone switches off. `verifying -> done` is the only legal transition into `done`, so `verifying` is the earliest status that is also sufficient (`src/lifecycle.ts`) |
| `state set --status done` re-checks at the transition | Without it the requirement has a one-command way around it: `done` is not an active status, so relabelling the item makes the gate stop looking and a store that was red a second ago goes green. `--force` still closes it — and now only with `--closed-by`, whose reason is stored in `state.json` prefixed `closed unverified (forced):`, because an override that leaves nothing behind is the `closed_by` shape this plugin already had to fix once |
| An unreadable receipt file is a failure, never a pass | `receipts` reads a file, a read throws, and the hook wrapper catches every throw and exits 0 by design — so an unreadable `verification.tsv` produced zero bytes and exit 0 from `mstack hook stop`, byte-identical to a green gate, and threw `mstack gate` out mid-run so the workspace section and the summary never happened. The trigger is not exotic: this is the one store file a clone never recreates and whose ownership is purely local |

Seven of those eleven came from review, over three rounds. The first version shipped its own
instance of the defect it was built to close; the fix for that shipped a narrower version of the
same defect; and the fix for *that* one shipped a narrower version again. Each is reproduced
above, or in the store's history, from a real run. The pattern is worth naming rather than
hiding: every one of those seven was a place where this mechanism *asserted* a guarantee it had
not been measured against, and the narrowing is what a reviewer re-running the previous round's
transcript against the new code buys you.

An item at `verifying` that nothing verifies at all is a **warning**, not a failure:

```console
$ mstack gate | tail -7
[warn]  parse-config is verifying and nothing verifies it: state.json has no 'verify' command and the item has no 'verification' command

-- workspace
[ok]    on branch feat/x
[warn]  1 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 2 warnings
```

The line is deliberate and it is narrow. This check is about an item *whose* verification never
ran; whether a verification has to exist at all is `require_verdict_to_close`'s question, and
its typed answer for "no check could be run" is the `verifier-blocked` verdict. Failing here
would wedge every store still carrying the empty `verify` that `mstack setup` seeds.

`verification.tsv` is the one file in the store that is **not** committed, and `mstack setup`
writes a `.mstack/.gitignore` saying so. Two reasons, both structural: a receipt is keyed to
HEAD, so committing one moves HEAD and voids the receipt being committed; and a receipt from
another checkout would let one worktree's run stand in for a run nobody in this one ever did,
when "somebody here actually executed it" is the entire claim.

### Upgrading a store that predates this

A store created before this change has no `.mstack/.gitignore`, so its first `gate --full`
leaves an untracked `verification.tsv` that the next `git add -A` commits — and a committed
receipt cannot vouch for the commit that carries it, which is a permanent
red-gate-and-dirty-tree loop. It is fail-closed, never a false green, but it is useless without
naming the cause, so the gate names it:

```console
$ mstack gate | rg "gitignored|PASSED"
[warn]  .mstack/verification.tsv is not gitignored, and committing it voids the runs it records: run 'mstack setup' to install .mstack/.gitignore, then 'git rm --cached .mstack/verification.tsv' if it is already tracked
PASSED - 0 failures, 2 warnings
```

Both commands are in the message because `setup` alone is not enough once the file is already
tracked: `.gitignore` does not apply to a path git is already following. `mstack setup` is safe
to re-run on a populated store — it leaves every existing file alone and only installs the
missing `.gitignore`.

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
