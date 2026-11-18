# Gates and hooks

This page covers the part of mstack that does not ask nicely: the checks that run by
themselves and refuse things. Read it when the gate has gone red and you want to know why,
or when you want to know what is actually enforced rather than merely written down. The
short version: hooks watch the session, `mstack gate` audits the store, and the merge gate
decides whether a change may land.

The enforcement plane has three parts: six hooks that run on Claude Code's events
(`hooks/hooks.json`, handlers in `src/hooks.ts`), the session gate (`mstack gate`,
`src/gate.ts`), and the merge gate (`mstack merge-gate`, `src/mergegate.ts`). Skills ask;
these enforce.

Two facts about Claude Code hooks shape every handler, both from the hooks reference via
[the research document](../research/pstack-port.md): exit code 2 is the only exit code that
blocks through the code alone, so a hook that means to enforce cannot rely on exit 1; and a
timed-out hook renders no decision at all, so a gate must never depend on being slow.

## The six hooks

| Event | When Claude Code fires it | What mstack's handler does |
|---|---|---|
| `SessionStart` | A session starts, including on `--resume` | Prints the active item, its open `decision_required` if any, and the last checkpoint from `progress/current.md` back into context. Resume is the case that matters: a session that resumes without its checkpoint restarts work that was already done |
| `PostToolUse` | After a matched tool call succeeds (a failed call fires `PostToolUseFailure` instead); mstack matches `Edit\|Write` | The cheapest useful check and nothing more. Re-validates `state.json` after an edit to it, and reminds that `history.md` is append-only after an edit to that. Exits 0 unconditionally: it nudges, it never blocks, because a hook that runs the test suite on every edit is a hook someone switches off |
| `SubagentStop` | A subagent finishes | Checks that the subagent left its report file on disk, and that the file says something: under 40 bytes is a stub, judged per file so one substantial lens does not excuse an empty sibling. Exists because a review subagent once returned a confident summary having written nothing. A reply is not evidence, the file is. The report must also be **newer than the subagent**: at least one `<kind>_<slug>*.md` must have been modified after the first timestamp of the agent's own transcript (`agent_transcript_path`, derived from `transcript_path` and `agent_id` when it is `""`). Before this, any earlier report for the slug passed, so a round-two reviewer that wrote nothing was excused by round one's file. With no transcript to read there is no start time and the answer stays what it was: fail open. Writes no cost rows |
| `Stop` | The main agent is about to end its turn | Runs the fast gate, quiet — never `--full`, and [never a test suite](#verification-that-actually-ran). On failures it returns feedback (`additionalContext`) rather than a block: the same loop protections apply, including the eight-continuation cap, but the transcript labels it feedback and no hook error is raised. That `additionalContext` is how the failures reach the model, and it always was. The failures are *also* written to the hook process's stderr, which Claude Code captures as its own field — what it does with that field is the client's business, not this plugin's; the measurements are [below](#what-the-stop-hook-prints-on-a-red-gate) |
| `SessionEnd` | A session ends (`reason` says why) | Flushes the session's token usage into `.mstack/costs.tsv`; see [costs.tsv](State-Files.md#coststsv). Prints nothing, fails open, 5-second timeout. Also: `SessionStart` writes a mark and settles sessions that never reached `SessionEnd`, and `Stop` writes a mark only when the active item changed |
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

- **"size s"** holds a small item to its diff. It runs only for the active item when that item
  has a `base` and a `size` of `s`; an item with no base, or a size of `m`, `l` or none, is not
  measured and the gate says nothing. It lists the paths under the store's root (the directory
  that holds `.mstack/`) that differ between the commit it measures from and the working tree
  (committed, staged, unstaged, and untracked files under that directory that git does not
  ignore). Paths are classified relative to that directory, so a store in `pkg/app` of a monorepo
  measures `pkg/app` alone and `pkg/app/tests/` holds tests. It keeps the ones the path classifier
  calls code, drops everything under `.mstack/`, and counts insertions plus deletions (a binary
  file is a file and no lines; an untracked file's lines are insertions; a renamed file is one
  file deleted and one added). More than 60 lines or more than 3 files fails; exactly 60 and
  exactly 3 pass. Tests and docs do not count, because a small fix with a thorough test is still
  small. The two limits are `SMALL_MAX_LINES` and `SMALL_MAX_FILES` in `src/size.ts`. A base git
  cannot find fails too, with a fix that names `--base`. A diff record the check cannot read
  fails the check rather than counting as nothing.

  ```console
  $ mstack gate
  [fail]  1 greet-flag (in_progress) is size s but its code diff from 1dd52334 is 24 lines in 4 files, over the limits of 60 lines and 3 files
          fix: it is not small: 'mstack state set greet-flag --size m' (or split the work)
  ```

  The commit it measures from is the item's `base`, with one exception: work the branch took in
  from the default branch is not the item's. When `HEAD` has commits of its own past the default
  branch, and `base` is no later than the point where the branch left it, the check measures from
  that point instead, so a `git rebase main` onto a `main` that moved, or a merge of `main` into
  the branch, adds nothing. The default branch is the one `origin/HEAD` names, else `main`, else
  `master`; its local branch and its `origin/` copy both count, so a local `main` left behind by
  `git fetch && git rebase origin/main` does not hold the point back. A `base` a rebase rewrote,
  which is no longer in `HEAD`'s history, is replaced by that point too; with no such point to
  use, the check fails with a fix that names `--base`. Everywhere else it measures from `base`:
  on the default branch itself, on a branch stacked on another (whose base is later than that
  point, so the parent branch's work does not count), where no default branch exists, and where
  `base` is a commit of the branch's own and `main` was merged in after it, in which case the
  merged commits do count. The line names the commit it measured from and says when that is not
  the base:

  ```console
  $ git rebase -q main
  $ mstack gate
  [ok]    one is size s: 10 lines in 1 file of code since c4557de9 (where this branch left main; base b27f89b7 is older), within 60 lines and 3 files
  ```

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
  every verdict it has came from the pass that wrote the code (`only implementer`). Three more
  refusals audit the rows that *look* closing. A closing-role row whose evidence cites the
  implementer's own report — or the spec-author's — does not count as an approval: the verifier
  column says one thing, the evidence says another, and the evidence wins. A rejection is never
  dropped for what its evidence cites. And a `done` item whose most recent closing verdict is
  `verifier-failed` stays refused until a later *independent* approval from a closing role
  answers it; a `verifier-blocked` after the failure ("could not verify") does not, and the row
  named is the failure. A `verifier-blocked` whose evidence cites the implementer's own report
  is discounted like an approval that does, so it is not the escape hatch. Every caller reads
  a verdict through one function, `readVerdict` (`src/ledger.ts`), but not the same rows:
  `mstack ledger check` answers for one sha; `state set --status done` and the gate at
  `verifying` refuse (through `ledger-verdict` in `src/closing.ts`, `--force` included) when
  a rejection stands at the sha being closed, or when a rejection recorded later against any
  other sha of the item has no independent approval after it; and this audit of an item
  already closed reads every row, because an item records no closing commit, only a free-text
  `closed_by`. So `ledger check` can pass at a sha where closing still refuses:

  ```console
  [fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)
          fix: a closing verdict needs evidence from the closing pass's own work, not a pointer to the implementer's report; re-run the check and record what actually happened
  [fail]  items closed on a verdict whose evidence cites the spec-author's own report: other-item (spec-reviewer)
          fix: a closing verdict needs evidence from the closing pass's own work, not a pointer to the spec-author's report; re-run the check and record what actually happened
  [fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: third-item (reviewer): verifier-failed at 867d13cb by reviewer (evidence: node --test tests)
          fix: the ledger is append-only, so the failed row stays; only a later independent approval from a closing role clears it, and 'could not verify' does not — re-run the review after the fix and record a fresh one
  ```

  One run, three items, one per refusal: an item lands on at most one of these lists, so
  three lines naming one slug is a state no single run can print.

  The escape hatch for "no check could be run" is not a prose note but a typed verdict:
  `verifier-blocked`, keyed to a SHA, carrying its reason.

- **"a verification run is due at verifying"** is the check described [below](#verification-that-actually-ran).
  It runs nothing; it reads a record of what `--full` ran, and from `verifying` on it refuses
  to call an item green on a verification that never executed here.

- **The requirement-to-test table** is a closing check (`r-to-test` in `src/closing.ts`). From
  `reviewing` on, and again at `state set --status done`, the gate reads the last table headed
  exactly `| R | Test | Where |` in the item's newest implementation report (`impl_<slug>.md`,
  or the highest `impl_<slug>_r<N>.md`; a later round carries the whole table again). Every id
  needs a row: `A1`, `A2`... for the acceptance bullets in order, or the `R<n>` of `spec.md`
  on the spec path. Every `Where` is one or more `path:line` citations (a `path:line-line` range
  too) of a file the path classifier calls a test, present under the store's root, with the line
  inside it, or `n/a:` and a reason of at least 12 characters. It applies only to an item with a
  `base`, so an item from before the check is never read, and never to a closed or cancelled
  item. A problem is overridable with `--force --closed-by`, like a missing verification run;
  a report that exists and cannot be read is not. It proves the citation exists, not that the
  test covers the requirement: that is still the reviewer's reading.

  The default test patterns cover the common layouts (`tests/`, `*.test.*`, `*_test.go`,
  Maven and Gradle `src/test/`, RSpec, Swift and .NET `*Tests`, Cypress and Playwright; the
  list is `TEST_PATTERNS` in `src/pathclass.ts`). A test that lives in a file the patterns
  call code, such as a Rust unit test inside `src/*.rs`, cannot be cited by path: that row
  takes `n/a:` and a reason.

  Two runs of `$ mstack gate`, with the report edited between them: first the table has no
  row for `A2`, then it has a row whose `n/a:` reason is short. The `[fail]` line and its
  `fix:` line, exactly as printed:

  ```console
  [fail]  1 greet (reviewing) cannot close as it stands, and .mstack/progress/impl_greet.md has no row for A2 ("prints bye")
          fix: the table is headed | R | Test | Where | with one row per requirement id (A<n> in acceptance order, or R<n> of the spec on the spec path); Where is path:line of test files, or n/a: and a reason of 12+ characters; agents/implementer.md defines it
  ```

  ```console
  [fail]  1 greet (reviewing) cannot close as it stands, and .mstack/progress/impl_greet.md line 6 (A2): the n/a: reason "manual" has 6 characters, and needs at least 12
          fix: the table is headed | R | Test | Where | with one row per requirement id (A<n> in acceptance order, or R<n> of the spec on the spec path); Where is path:line of test files, or n/a: and a reason of 12+ characters; agents/implementer.md defines it
  ```

  Forcing the close past that table needs a reason, and the record says which check was
  overridden (the table here, not a verification):

  ```console
  $ mstack state set greet --status done --force --closed-by "bye is checked by hand in the demo"
  1 greet (done)
    status: "verifying" -> "done"
    closed_by: (unset) -> "closed without a good requirement-to-test tab..."
    forced: closed without a good requirement-to-test table - .mstack/progress/impl_greet.md line 6 (A2): the n/a: reason "manual" has 6 characters, and needs at least 12
  ```

  `state.json` stores `closed without a good requirement-to-test table (forced): bye is checked
  by hand in the demo`. A verification that did not run keeps its own words,
  `closed unverified (forced):`, and a close past both says `closed unverified and without a
  good requirement-to-test table (forced):`.

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

  Foreign means outside the *repository*, not merely at another path, and same repository
  is necessary but not sufficient. A `git worktree` of the checkout shares its git common
  dir, so it is never a *failure* — the hooks run `${CLAUDE_PLUGIN_ROOT}/bin/mstack`, a path
  a session cannot redirect per worktree, the orchestrate flow makes worktrees the unit of
  parallel work, and a gate that is red every turn on byte-identical code is a hook people
  switch off. But identical is checked, not assumed: the same git spawn that fetches the
  common dir also fetches `HEAD:src`, git's already-stored tree object, and a sibling whose
  committed `src` tree differs gets a **warning** naming both tree ids and the launcher to
  run instead. That severity is a recorded decision — the mismatch is genuine (the sibling's
  checks may not be this store's checks), and it is also the normal state for the whole life
  of a branch that touches `src/`. Two limits, stated rather than implied. First, `HEAD:src`
  is the *committed* tree, so uncommitted edits to `src/` are invisible to the comparison —
  the adjacent "uncommitted change(s)" warning is what puts that fact one line away. Second,
  who sees the warning splits three ways. In a shell, `mstack gate` prints it and every other
  subcommand puts one note on stderr. On a hook invocation, the *model* gets nothing: the
  Stop hook composes its `additionalContext` from failures only, so a warning cannot reach it
  by construction. The note is then the only signal, and it goes to the stderr field the
  client captures verbatim — whether a person sees that field rendered is what
  [the two-streams section above](#what-claude-code-does-with-those-two-streams) already
  declines to promise. What holds either way: the copy a worktree contributor is told to run
  is that worktree's own `./bin/mstack`, which gives the branch's own verdict correctly.
  A separate clone answers with a different common dir and stays a
  failure, as does the installed cache, which is not a git repository at all. And the oldest
  limit still holds: the check ships with the code that is being missed, so a copy installed
  *before* it existed still reports nothing — it closes every future round of this trap, not
  the one already on disk.

- **"GLOSSARY.md: N entries"** appears only when a `GLOSSARY.md` exists at the repository root,
  and never otherwise: the gate does not ask for a glossary, so a repository without one gets
  no section and no line. When the file exists the check recognises `**Term**:` and `**Term:**`
  at the start of a line (also as a list item, with the definition on the same line or below it)
  and, in a file with no such entry, one `##` or `###` heading per term followed by a paragraph.
  A bold label such as `**Example:**` directly under a term, indented under its list item, or
  after the paragraph under its heading belongs to that term. An unindented one after a blank
  line under a bold term is read as a term, and so is one that is the first line under a
  heading, which then only groups. Rules, HTML comments and fenced blocks are skipped, and a comment line inside an entry
  does not end it. It reads structure and never content. Two things are failures, each naming
  the entry and its line: an entry with no definition, and a term that appears twice (case and
  a trailing colon ignored). A `GLOSSARY.md` that cannot be read, or is a directory, is a failure that says so.
  Two things are warnings and leave the gate green: a definition of more than two sentences,
  and a non-empty file in which no entry is recognised, which is how a table or any other
  style the check does not know passes. The warning lists the forms it does recognise. The
  `Stop` hook runs the gate quiet, which prints no warning, so only a failure reaches the model.

  ```console
  $ mstack gate
  ...
  -- glossary
  [fail]  GLOSSARY.md:5: entry "Receipt" has no definition
          fix: write one or two sentences under it, or remove the entry
  [warn]  GLOSSARY.md:3: entry "Order" has 3 sentences; a definition is one or two
  ```

  The format is stated once, in the reflect skill's domain-docs reference, and a test pins that
  the example there passes this check with no warning. Only the root file is read: a
  `GLOSSARY.md` in a subdirectory or under `docs/` is not.

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
| `state set --status done` re-checks at the transition | Without it the requirement has a one-command way around it: `done` is not an active status, so relabelling the item makes the gate stop looking and a store that was red a second ago goes green. `--force` still closes it — and now only with `--closed-by`, whose reason is stored in `state.json` prefixed `closed unverified (forced):` (or `closed without a good requirement-to-test table (forced):` when the table was the check overridden), because an override that leaves nothing behind is the `closed_by` shape this plugin already had to fix once |
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
