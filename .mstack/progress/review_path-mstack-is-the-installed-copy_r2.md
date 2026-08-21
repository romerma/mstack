# Review - path-mstack-is-the-installed-copy (round 2)

**Verdict:** CHANGES_REQUESTED

Reviewing alone, round 2. Head at review time: `da57a207b0e2cc4cd7e60c86803fd940565c99c6`.
Every CLI call went through `./bin/mstack`, or an explicit absolute path where the point was
to run a different copy.

All four round-1 findings are addressed, and three of them are closed properly. Finding 2 is
closed well: the manifest is the right identity and I could not break it. Findings 3 and 4 are
closed. Finding 1 is closed by a rule that opens a new hole in the same acceptance bullet, and
the diff describes that hole with a claim I can disprove by running it. That is the blocker,
and it is narrow.

## Round-1 findings, one by one

**Finding 1 (worktree false-red)** — the red is gone. Reproduced: main checkout's binary
against a worktree store at the same commit now gives
`[ok] ... came from within the same repository`, exit 0. But see finding A below: the rule
went from "always red" to "always silent", and the middle option was priced wrong.

**Finding 2 (false positive, self-referential fix, no override)** — closed, and closed with the
marker I suggested. `src/paths.ts:106-116`. Reproduced the round-1 false positive shape and it
is now silent:

```
$ mkdir -p userrepo/bin userrepo/src && printf '#!/bin/sh\n' > userrepo/bin/mstack
$ echo '// cli' > userrepo/src/cli.ts && cd userrepo && <this checkout>/bin/mstack gate
PASSED - 0 failures, 2 warnings          # no provenance line at all
```

**Finding 3 (bullet 3 not on the reading path)** — closed. `docs/wiki/The-CLI.md:6-9`,
`docs/wiki/Getting-Started.md:6-9`, and `README.md:69-72`, which sits at line 69 against a
first transcript at line 75. The three lines land where I asked and cost no transcript edits.

**Finding 4 (README over-claim)** — closed. `README.md:342-346` now carries the limit inline:
"but only once the installed copy is new enough to contain that check; a copy installed before
it existed still reports green and says nothing, which is why the habit, not the check, is what
protects you today." True as written, and I confirmed the second half is still the live
situation (the real cached 0.1.0 prints `PASSED - 0 failures` over this store).

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A worktree is not foreign, at any commit | `tests/provenance.test.ts:150` | Mutation A (delete the `gitCommonDir` block from `foreignCliRoot`) fails **exactly** this test and nothing else. Genuine coverage. |
| A separate clone stays foreign | `tests/provenance.test.ts:189` | Mutation C (`gitCommonDir` always answers the same repo) fails this test plus the two foreign-copy tests. The clone boundary is independently pinned, not a free rider on mutation A. |
| The manifest is the identity | `tests/provenance.test.ts:206`, `tests/gate.test.ts:1276`, `tests/gate.test.ts:1297` | Mutation B (revert `isMstackCheckout` to the round-1 two-marker form) fails exactly these three. |
| Hostile manifests stay silent | `tests/gate.test.ts:1297` covers "someone else's" and "unparseable" only | Directory, symlink loop, JSON `null`, array, `name` as an object and binary garbage are **untested**, though I verified all six behave correctly. A blocking read is neither tested nor handled - finding D. |
| Cost claim: extra spawns only on an actually-foreign run | **none** | Finding B. The claim is in a comment, is measurable, and is wrong. |
| In-repo, different code, silently accepted | `tests/provenance.test.ts:167-173` pins the *acceptance* | The decision is pinned deliberately, which is right. What is not pinned or stated is what it costs: finding A. |

The round-2 assertions bite. Byte copies from `git archive HEAD`, three targeted mutations,
never `git checkout`. No test was weakened: the two changed assertions
(`tests/gate.test.ts:1229`, `tests/provenance.test.ts:68`) track the deliberate message change
from "its own ./bin/mstack" to "within the same repository", and both still fail on round-1
code.

## Acceptance, quoted

**"A contributor is told, where they will actually read it, how to run this checkout's CLI rather than the installed one"**

Met, unchanged from round 1 and improved. `CLAUDE.md:22-24`, `CONTRIBUTING.md:33-41`,
`README.md:339-346`. Rung 2.

**"Running the wrong one against a store is either impossible, or it says so; a version mismatch between the CLI and the checkout is surfaced rather than silent"**

**Regressed in round 2 for one case, and it is the case the item's own description names.** See
finding A. For the installed-cache shape, a separate clone, and any copy outside the
repository, this is met at rung 5 and I re-ran all three.

**"The wiki and README transcripts state which binary produced them, so re-running them to satisfy the docs rule is unambiguous"**

Met. Reading `docs/wiki/The-CLI.md` cold, the third sentence of the page tells me the binary
behind every `$ mstack` on it and why my `PATH` copy is a different one. Same for
`Getting-Started.md`. `README.md:69-72` reaches a reader before the first transcript rather
than 260 lines after it. Rung 2, and it is the right rung for a claim about text placement.

**"Whatever mechanism is chosen is proven against a real mismatch, not only reasoned about: an old binary against a new store, shown reporting the wrong thing before the fix and the right thing after"**

Met, and re-proven this round with the round-2 rule in place - the installed-cache shape (a
byte copy of this checkout in a non-git directory) still goes `FAILED` exit 1 against this
store, and the real cached 0.1.0 still goes `PASSED`, which is the stated limit.

**"The stale copy is shown to govern agent and skill definitions too, not only the CLI"**

Met, unchanged. Confirmed again this session: my loaded `reviewer` definition still lacks the
`## Record it` section at `agents/reviewer.md:73`, so I read the working-tree file for the
recording rule, as instructed.

## Verification I ran

```
$ npm test
 272 pass
 0 fail
Ran 272 tests across 15 files. [38.81s]

ℹ tests 272
ℹ pass 272
ℹ fail 0

$ npm run typecheck
> bunx --bun tsc --noEmit
(exit 0)

$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings

$ ./bin/mstack gate --full
[ok]    store root is an mstack checkout, and this report came from within the same repository
...
PASSED - 0 failures, 1 warning
```

The one warning is the uncommitted `.mstack/state.json` this review session is holding.

```
$ ./bin/mstack ledger check path-mstack-is-the-installed-copy
FAIL no verdict at da57a207; 3 row(s) exist at other SHAs and a new head SHA voids them
```

Expected: the newest row is the implementer's at `9490d77`, and `da57a20` is the commit that
added it. My row follows this report.

**Attack 4, do the round-2 tests bite.** `git archive HEAD | tar -x`, then one surgical edit
each:

```
mutation A: gitCommonDir block deleted from foreignCliRoot
✖ a git worktree of the repository is not foreign, at the same commit or any other
  (the other 7 provenance tests pass)

mutation B: isMstackCheckout reverted to the round-1 two-marker form
✖ bin/mstack plus src/cli.ts without the mstack manifest is a user's repo: silent, exit 0
✖ both file markers without the plugin manifest are a user's repo, and the check stays silent
✖ a manifest that is someone else's, or unparseable, does not make a checkout either

mutation C: gitCommonDir always answers "/SAME"
✖ a foreign copy's gate inside a checkout is exit 1, naming the copy that ran and the one to run
✖ every other subcommand run by a foreign copy says so on stderr without changing its result
✖ a separate clone stays foreign even at the same commit
```

**Attack 5, the trap must still be caught.** Rung 5:

```
$ git -C ~/.claude/plugins/cache/mstack/mstack/0.1.0 rev-parse --git-common-dir
fatal: not a git repository (or any of the parent directories): .git

$ cp -R bin src .claude-plugin $SCRATCH/fakecache      # a post-fix copy in the cache's position
$ $SCRATCH/fakecache/bin/mstack gate
[fail]  this store's root is an mstack checkout, but the CLI producing this report runs from .../fakecache
FAILED - 1 failure, 1 warning
```

A separate clone: `tests/provenance.test.ts:189`, and mutation C proves it is really pinned.
Both boundaries hold.

**Attack 3, hostile manifests.** Six shapes, each in a scratch repo carrying both file markers,
gate run by this checkout's binary. All silent, exit 0, nothing thrown out of `runGate`:

```
manifest is a directory      exit=0   PASSED - 0 failures, 2 warnings
manifest is a symlink loop   exit=0   PASSED - 0 failures, 2 warnings
name is an object            exit=0   PASSED - 0 failures, 2 warnings
manifest is JSON null        exit=0   PASSED - 0 failures, 2 warnings
manifest is an array         exit=0   PASSED - 0 failures, 2 warnings
binary garbage               exit=0   PASSED - 0 failures, 2 warnings
manifest 50MB, name=mstack   exit=1   FAILED - 1 failure, 2 warnings   <- correct: it is a valid mstack manifest
```

The 50MB case is correct behaviour, not a bug: a repo whose manifest declares `"name":
"mstack"` is an mstack checkout. It does get read twice per gate run - see the minor notes.
The one shape the `catch` does not cover is finding D.

## Changes required

**A. `docs/wiki/Gates-and-Hooks.md:223-226` and the first round-2 decision row - "bounded" is
asserted, and the mechanism does not provide the bound. Reproduced at rung 5, and what it
produces is this item's originating defect.**

The claim: "a worktree at a different commit runs different code and is accepted, bounded by
the fact that worktrees are created from, merged into and pruned by the same repository."
Lifecycle provenance is not a bound on code divergence, and the divergence is exactly what the
check exists to catch. Built it rather than reasoned about it - a clone of this repo as "main",
a `git worktree` on `feat/new-check`, and one new gate check added on that branch (the
ordinary shape of items 18-20, which modify `src/gate.ts`):

```
--- A: the WORKTREE's own CLI (the branch under development) ---
-- workspace
[fail]  current.md records the verification as Pending
        fix: run the item's verification and paste what it printed
[ok]    store root is an mstack checkout, and this report came from within the same repository
FAILED - 1 failure, 0 warnings

--- B: the MAIN checkout's CLI (what ${CLAUDE_PLUGIN_ROOT}/bin/mstack is), same store ---
-- workspace
[ok]    store root is an mstack checkout, and this report came from within the same repository
PASSED - 0 failures, 0 warnings
exit=0
```

And through the hook, which is the path that matters:

```
$ echo '{"cwd":"<worktree>","hook_event_name":"Stop"}' | <main>/bin/mstack hook stop
[exit=0]                                    # no additionalContext at all

$ echo '{"cwd":"<worktree>","hook_event_name":"Stop"}' | <worktree>/bin/mstack hook stop
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. ..."}}
```

Read that against the item's own description in `.mstack/state.json`: "The dangerous one is
silent and inverted - a gate or hook change the cached copy does not implement, run against
the new store, reporting green." That is what run B is. Round 1 failed loudly here; round 2
prints `[ok] ... came from within the same repository` over it. The `[ok]` is literally true
and reads as "provenance checked, fine", which is the confidently-wrong output
`src/gate.ts:416-418` says the check exists to prevent.

This is not exotic. `worktree.create()` in `src/worktree.ts:120` defaults the branch prefix to
`feat`, so every worktree it makes is on its own branch; `skills/orchestrate/SKILL.md:25-28`
makes worktrees the unit of parallel work; and this repository's own next queued items touch
`src/gate.ts`. The cost lands entirely on mstack development itself, which is the one
repository where the item says the trap matters.

The decision row pre-empts the obvious fix and prices it wrong on both counts. It says
comparing commits "would stay red for any worktree on its own branch" - that assumes the only
alternative to silence is `report.fail`. `Report` has `warn`, and the same gate section already
uses it ("[warn] 1 uncommitted change(s)"), so a warning is visible every turn without the red
gate the row correctly refuses. It says comparing content "prices a full src tree hash into the
Stop hook on every turn" - `git rev-parse HEAD:src` returns git's already-stored tree object;
nothing is hashed. And it costs **zero extra spawns**, because the two spawns are already being
made on precisely this path:

```
$ git -C <worktree> rev-parse --git-common-dir HEAD HEAD:src
<main>/.git
d8f14adb1e8e442cc7c69ab3f2379279e3c236ab
268bb084795f1036c68b59be24e403e578e75a48

$ git -C <main> rev-parse --git-common-dir HEAD HEAD:src
.git
da57a207b0e2cc4cd7e60c86803fd940565c99c6
60d60f7ea54078e058e3f70e4d56f13ee5a566d2

current  (--git-common-dir)          : 19.8 ms   (both roots, mean of 20)
proposed (--git-common-dir HEAD HEAD:src) : 22.4 ms
```

2.6ms, on a path that only runs when the roots already disagree. The two `src` trees differ,
which is the case that reported green.

What would fix it, in order of preference:

1. Fold `HEAD:src` into the spawn already made and `report.warn` when the common dirs agree but
   the trees differ: "this report came from a copy of the same repository at a different
   `src/` tree - <path>". Gate stays green, hook stays quiet, the mismatch stops being silent,
   and acceptance bullet 2 is honestly met. Note `src/hooks.ts:173` returns null unless
   `report.failed`, so a warn is visible in the shell gate but not in the hook's
   `additionalContext`; say which of those you intend rather than leaving it implicit.
2. If you keep unconditional acceptance, then the documentation and the decision row must stop
   claiming a bound. Replace "bounded by the fact that worktrees are created from, merged into
   and pruned by the same repository" with what is actually true: a worktree on its own branch
   at a different commit runs different code and is accepted **silently**, so inside a worktree
   the gate's provenance line says nothing about whether the checks that ran are the branch's
   own. And say it in `README.md:342-346` too, where the honest limit is currently framed as
   purely temporal ("a copy installed before it existed") when this hole is permanent and no
   update closes it.

Either way, pin the *stated* behaviour with a test. `tests/provenance.test.ts:167-173` already
pins acceptance at a different commit; what it does not pin is that the diverged code is what
gets run, which is the part a reader needs.

**B. `src/paths.ts:174-176` - the cost comment is measurably wrong.**

"the two extra git spawns are paid exactly once per actually-foreign run and never in a user's
repo or on the agreeing path". Counted with a `git` shim on `PATH` that logs every invocation:

```
1) agreeing path  (worktree's own CLI, own store)      git-common-dir spawns: 0   ✓
2) worktree store, main checkout's CLI (NOT foreign)   git-common-dir spawns: 2   ✗
3) ordinary user repo                                   git-common-dir spawns: 0   ✓
```

Case 2 is not an actually-foreign run - it is the case the whole round-2 change exists to make
*not* foreign - and it pays both spawns, on every gate run, which on the Stop hook is every
turn. Measured end to end: 119.1 ms/run for the agreeing path against 134.9 ms/run for the
worktree path, mean of 5. The magnitude is fine; the sentence is not. In a repository whose
`src/git.ts:32-35` corrects a comment that "asserted more than had been
checked", this one should say "once per run where the two roots differ, which includes every
worktree run".

**C. `tests/gate.test.ts:1297` - the hostile-manifest test covers two shapes and the doc comment
promises four.**

`src/paths.ts:98-99` states the contract as "missing, unreadable, unparseable or differently
named all read as 'not a checkout'". The test covers differently-named and unparseable.
*Unreadable* - the `catch` on `readFileSync` rather than on `JSON.parse` - has no test. I
verified a directory and a symlink loop both work, so this is a coverage gap rather than a bug;
one loop entry with a directory at `.claude-plugin/plugin.json` closes it.

**D. `src/paths.ts:107-114` - the `catch` turns throws into silence, but a blocking read is not
a throw, and the gate hangs forever.**

```
$ mkfifo <repo>/.claude-plugin/plugin.json
$ <checkout>/bin/mstack gate
HUNG: no output after 12s -- readFileSync on a fifo blocks with no timeout
```

A fifo cannot be committed to git, so this is not an attack path a stranger reaches through a
clone; the realistic shape is `.claude-plugin/plugin.json` on a stalled network mount. What
makes it worth fixing rather than noting is where it runs: `runGate` on the `Stop` hook every
turn, and `warnForeignCli` at `src/cli.ts:61` on *every* subcommand including
`hook pre-tool-use`, which fires on every Bash call under a 5-second timeout. This repository
already made exactly this call once, at `src/git.ts:16-19`: "Every caller treats a git failure
as 'no answer', so a hang has to become one too. Without a timeout a slow or prompting git
blocked the status line indefinitely, on the one path that runs on every assistant message."
A `statSync(...).isFile()` guard before the read, inside the same `try`, is the whole fix.

## Minor, not blocking

- The manifest is read and parsed twice on every gate run inside a checkout:
  `src/gate.ts:437` calls `isMstackCheckout(store.root)`, then `src/paths.ts:179` calls it
  again. `src/gate.ts:430-435` explains why the *call* is repeated and the explanation is
  right, but it does not mention that the round-2 body now does file I/O, so the repetition
  went from free to a doubled `readFileSync` + `JSON.parse`. With the 50MB manifest above that
  is 100MB read per gate run. Passing the already-computed answer down, or hoisting the
  `foreignCliRoot` body, removes it.
- `src/paths.ts` now imports a value from `src/git.ts`, which imports `type Store` back from
  `src/paths.ts`. Type-only, so it is erased under both runtimes and there is no runtime cycle
  - confirmed by 272 green tests on bun and node - but `paths.ts` was a leaf module before this
  round and is not one now. Worth a line in the module comment.
- `warnForeignCli` at `src/cli.ts:1020` resolves its store from `process.cwd()` while
  `src/hooks.ts:169` resolves the gate's store from `input.cwd`. On a hook invocation those can
  name different stores, and I saw them disagree: running `hook stop` with a scratch worktree
  in the JSON, from a shell sitting in this repository, printed a note about *this* store and a
  gate about the other one. In a real hook run cwd matches, so this is a note rather than a
  finding.
- `README.md:69-70` says "Every transcript here and in the wiki **is produced and re-run by**
  the mstack repository's own `./bin/mstack`". Read as a maintenance rule it is fine, and the
  wiki pages' "at the commit that last edited this page" phrasing makes that reading explicit.
  The README's phrasing is a shade more like a claim about all existing transcripts, which
  round 1's impl report conceded is not re-derivable. Matching the wiki wording would remove
  the ambiguity.

## Where the claims stopped on the ladder

- Findings A, B and D, and every before/after transcript above: **rung 5**, run against a clone
  of this repository, a `git worktree` of that clone with a real added gate check, scratch
  repos under `/private/tmp/claude-501/.../scratchpad/r2`, and this repository's own store.
  Spawn counts came from a logging `git` shim on `PATH`, not from reading the code.
- "The round-2 tests bite": **rung 4**, three byte-copy mutations of `HEAD`, run under node.
- Finding C: **rung 4 for the shapes I ran** (directory, symlink loop, null, array, object
  name, binary), **rung 2** for the claim that the shipped test suite does not cover them.
- Acceptance bullets 1 and 3, and the minor doc notes: **rung 2**. They are claims about text
  placement and wording. I read the lines and counted the transcripts; I did not run a reader.
- The `src/git.ts` cycle being erased at runtime: **rung 4** - 272 tests green on both
  runtimes is the check, and it is the only one I ran for it.

## Cleanup

Created by this review, left in place because removing them is a destructive git command:

- `/private/tmp/claude-501/-Users-romerma-Code-mstack/cefb854d-5ff7-43b0-95ba-d79a53d0c4d7/scratchpad/r2/`
  contains a clone of this repository (`r2/main`), a worktree of that clone (`r2/wt`, branch
  `feat/new-check`, carrying the demo gate check), and the mutation copies. All self-contained
  under `scratchpad/`; `rm -rf` on `r2/` is sufficient and touches nothing in
  `/Users/romerma/Code/mstack`.
- The round-1 probe worktree `scratchpad/wt17` and its branch `review17-wt-probe` are still
  registered against **this** repository, from round 1.
  `git worktree remove <path>` then `git branch -d review17-wt-probe`.

Nothing tracked in `/Users/romerma/Code/mstack` was modified by this review except this report
and the reviewer row appended to `.mstack/ledger.tsv`.
