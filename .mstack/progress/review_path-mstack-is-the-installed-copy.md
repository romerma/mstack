# Review - path-mstack-is-the-installed-copy

**Verdict:** CHANGES_REQUESTED

Round 1, reviewing alone. Every CLI call below went through `./bin/mstack` (or an explicit
absolute path where the point was to run a *different* copy). Head at review time:
`7df41e611118609ff4d5d447f548e700a0c3af1c`.

The mechanism is the right one and the reasoning behind it is sound: keying on the resolved
root of the executing module rather than on a version string is correct, and I confirmed the
premise myself at rung 5 (both `plugin.json` files read `0.1.0`; the cached copy's gate still
prints `PASSED` over this store). Three findings stop it from being approvable as it stands,
two of them reproduced in the running system.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| Foreign copy in a checkout fails the gate | `tests/provenance.test.ts:65` (real process, real launcher), `tests/gate.test.ts:1203` (unit, un-injected `running`) | Both go red on `main`'s `src/`: process test fails with `foreign gate stayed green`; unit test fails under the mutation `checkCliProvenance(store, report)` -> `/*removed*/` at `src/gate.ts:81`. See "Verification I ran". |
| The agreeing case is stated, not silent | `tests/provenance.test.ts:53`, `tests/gate.test.ts:1218` | `tests/provenance.test.ts:53` fails on `main`'s `src/`. `tests/gate.test.ts:1218` calls `checkCliProvenance` directly with an injected `running`, so it does **not** bite the wiring mutation - the wiring is covered by `tests/provenance.test.ts:53` instead. |
| Non-gate subcommands say so without changing their result | `tests/provenance.test.ts:82` | Red on `main`'s `src/`: `actual: ''` against `/mstack: note: .*mstack checkout/`. Asserts exit 0 and clean stdout too. |
| Never fires in an ordinary repo | `tests/provenance.test.ts:100`, `tests/gate.test.ts:1231`, `tests/gate.test.ts:1249` | These are guards: they pass on `main` too, by construction. Correctly labelled as such in the impl report. Not coverage of the fix, and not claimed to be. |
| `version` prints the running copy's version and root | `tests/provenance.test.ts:122` | Red on `main`: `mstack: unknown command 'version'`, exit 2. |
| Checkout-vs-worktree behaviour | **none** | Finding 1. No test exercises a `git worktree` of this repo, which `isMstackCheckout` explicitly claims to cover (`src/paths.ts:87`). |
| Escape hatch / false-positive recovery | **none** | Finding 2. |

The `running` injection is not the only thing tested: `tests/gate.test.ts:1203` goes through
`runGate` with the default `running = runningCliRoot()`, and all five tests in
`tests/provenance.test.ts` spawn the real `bin/mstack` as a process. That part of the brief
checks out.

No test was weakened. `git diff main...HEAD -- tests/` is additions only, apart from the two
import lines in `tests/gate.test.ts:8-10`. 258 -> 267 is +9, matching 4 new gate tests and 5
new provenance tests.

## Acceptance, quoted

**"A contributor is told, where they will actually read it, how to run this checkout's CLI rather than the installed one"**

Met. `CLAUDE.md:18-22` (loaded every session in this repo), `CONTRIBUTING.md:33-41` as the
first entry under "The rules that are not obvious", and `README.md:335-343`. All three name
`./bin/mstack` and `./bin/mstack version` explicitly. Rung 2 (I read the lines); whether a
human reads them is not machine-checkable, which the impl report says out loud.

**"Running the wrong one against a store is either impossible, or it says so; a version mismatch between the CLI and the checkout is surfaced rather than silent"**

Met for the copies that carry the new code, with a caveat the diff itself states. Reproduced
at rung 5:

- foreign copy, gate: `FAILED - 1 failure`, exit 1, naming both paths (`src/gate.ts:437-440`)
- foreign copy, other subcommands: one `mstack: note:` line on stderr, result unchanged (`src/cli.ts:1015-1029`)
- own copy: `[ok] store root is an mstack checkout, and this report came from its own ./bin/mstack`

Note the bullet says "a version mismatch between the CLI and the checkout". The
implementation deliberately does **not** compare versions, and the recorded decision
(`.mstack/decisions.tsv`, first `item-17` row) explains why: a version comparison is a check
that cannot fail here. I accept the substitution - path identity is a strictly stronger
discriminator for the failure the item describes - but it is a substitution, and it is what
produces findings 1 and 2 below.

**"The wiki and README transcripts state which binary produced them, so re-running them to satisfy the docs rule is unambiguous"**

**Partially met.** See finding 3. The purpose clause is satisfied - `CONTRIBUTING.md:57-64`,
which is where the docs rule lives, now names `./bin/mstack` as the binary that produces and
re-runs transcripts. The subject clause is not: the transcripts do not state it, and the one
surface chosen to carry the statement for the wiki (`docs/wiki/_Footer.md`) is not rendered
on the reading path `README.md:355-356` itself calls primary.

**"Whatever mechanism is chosen is proven against a real mismatch, not only reasoned about: an old binary against a new store, shown reporting the wrong thing before the fix and the right thing after"**

Met, and I reproduced the "before" half independently rather than inheriting it. Byte copy of
`main`'s `src/paths.ts`, `src/gate.ts`, `src/cli.ts` into a `git archive` extract of HEAD (no
`git checkout`), then the same tests: 4 of 5 provenance tests red, `tests/gate.test.ts` red at
import. And live, against this repository's own store right now:

```
$ ~/.claude/plugins/cache/mstack/mstack/0.1.0/bin/mstack gate
[ok]    on branch fix/path-mstack-is-the-installed-copy
[warn]  1 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 1 warning
```

The installed 0.1.0 is still green and still silent about being foreign - which is the limit
the diff states, not a defect in it. Rung 5.

**"The stale copy is shown to govern agent and skill definitions too, not only the CLI"**

Met, and I confirmed it from inside this very session at rung 5. My own loaded `reviewer`
definition lacks the `## Record it` section that `agents/reviewer.md:73-102` in the working
tree carries, along with the `--full`/"ran no verification" paragraph and the `_r<N>`
filename rule:

```
$ rg -c "^## Record it" ~/.claude/plugins/cache/mstack/mstack/0.1.0/agents/reviewer.md /Users/romerma/Code/mstack/agents/reviewer.md
/Users/romerma/Code/mstack/agents/reviewer.md:1
```

(no line for the cached file: zero matches). Recorded for a contributor at
`CONTRIBUTING.md:27-33` and `CLAUDE.md:17-20`, including the point that `/reload-plugins` does
not cross that gap. There is no test and there could not sensibly be one - the fact is about
Claude Code's plugin loading, not about mstack's code.

**"The honest limit"** (attack point 7, not an acceptance bullet)

Stated at `CONTRIBUTING.md:39-41`, `src/gate.ts:419-422` and `docs/wiki/Gates-and-Hooks.md:215-217`.
Not contradicted anywhere - but see finding 4: `README.md:338-340` states the protective claim
without the limit, in a paragraph whose own opening sentence positions it as what gets read
*instead of* CONTRIBUTING.md.

## Verification I ran

```
$ ./bin/mstack gate --full
-- workspace
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[ok]    on branch fix/path-mstack-is-the-installed-copy
[warn]  1 uncommitted change(s); expected mid-session, not at close
...
 267 pass
 0 fail
Ran 267 tests across 15 files. [29.34s]
...
PASSED - 0 failures, 1 warning
```

The one uncommitted change is `.mstack/state.json` `in_progress` -> `reviewing`, made by this
review session. Expected mid-session.

```
$ npm test
ℹ tests 267
ℹ pass 267
ℹ fail 0

$ npm run typecheck
> bunx --bun tsc --noEmit
(exit 0)

$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
61 relative links checked, 0 broken
```

Do the new tests bite? Byte copy, never `git checkout`:

```
$ git archive HEAD | tar -x -C $SCRATCH/revert
$ for f in src/paths.ts src/gate.ts src/cli.ts; do git show main:$f > $SCRATCH/revert/$f; done
$ cd $SCRATCH/revert && node --test tests/provenance.test.ts
✖ inside a checkout, the checkout's own bin/mstack stays green and says which copy ran
✖ a foreign copy's gate inside a checkout is exit 1, naming the copy that ran and the one to run
✖ every other subcommand run by a foreign copy says so on stderr without changing its result
✔ an ordinary repository sees none of it: no gate line, no stderr note, exit 0
✖ version prints the running copy's manifest version and its resolved root, store or no store
```

Wiring mutation, to isolate which gate test carries the `runGate` call
(`checkCliProvenance(store, report);` at `src/gate.ts:81` replaced by `/*removed*/`):

```
$ node --test tests/gate.test.ts
✖ a foreign CLI against a store rooted in an mstack checkout is a red gate that names both paths
ℹ pass 59
ℹ fail 1
```

`canonical()` (attack point 4), rung 5, all three green:

```
$ /users/romerma/Code/mstack/bin/mstack version      # case-folded path on APFS
mstack 0.1.0 at /Users/romerma/Code/mstack           # gate: [ok] ... its own ./bin/mstack

$ ln -sfn /Users/romerma/Code/mstack $SCRATCH/linked && cd $SCRATCH/linked && ./bin/mstack gate
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack

# /tmp -> /private/tmp: every scratch path above is under /private/tmp and compared clean.
```

`runningCliRoot` via `import.meta.url` (attack point 5), rung 5, both runtimes, invoked
without the launcher, from a symlinked cwd:

```
$ node --experimental-strip-types ./src/cli.ts version   # cwd = $SCRATCH/linked
mstack 0.1.0 at /Users/romerma/Code/mstack
$ bun ./src/cli.ts version
mstack 0.1.0 at /Users/romerma/Code/mstack
```

Both runtimes resolve the symlink in `import.meta.url`, so `canonical()` is not load-bearing
for that case but is harmless. `bin/mstack:27-35` resolving `$0` covers the
`~/.local/bin/mstack -> checkout` case.

```
$ ./bin/mstack ledger check path-mstack-is-the-installed-copy
FAIL no verdict at 7df41e61; 1 row(s) exist at other SHAs and a new head SHA voids them
```

Expected: the only row is the implementer's, at `2a1fe341`, and `7df41e6` is the commit that
added that row. My own row follows this report.

## Changes required

**1. `src/gate.ts:434` / `src/paths.ts:87-96` - a `git worktree` of this repo is red under the
launcher the hooks actually use, and nothing in the diff says so or tests it.**

Reproduced at rung 5. `git worktree add -b review17-wt-probe $SCRATCH/wt17 HEAD`, i.e. the
same commit, byte-identical `src/`:

```
$ cd $SCRATCH/wt17 && /Users/romerma/Code/mstack/bin/mstack gate
[fail]  this store's root is an mstack checkout, but the CLI producing this report runs from /Users/romerma/Code/mstack
        fix: run /private/tmp/.../wt17/bin/mstack instead; ...
FAILED - 1 failure, 0 warnings

$ cd $SCRATCH/wt17 && ./bin/mstack gate
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
PASSED - 0 failures, 0 warnings
```

And through the hook path, which is what makes it more than academic - `hooks/hooks.json`
wires every hook to `${CLAUDE_PLUGIN_ROOT}/bin/mstack`, a path a contributor cannot redirect
per worktree without launching a second `claude --plugin-dir <worktree>` session:

```
$ echo '{"cwd":"'$SCRATCH'/wt17","hook_event_name":"Stop"}' | /Users/romerma/Code/mstack/bin/mstack hook stop
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- this store's root is an mstack checkout, but the CLI producing this report runs from /Users/romerma/Code/mstack -> run .../wt17/bin/mstack instead; ..."}}
```

This is not a hypothetical corner. `src/worktree.ts` ships `mstack worktree new`,
`skills/orchestrate/SKILL.md:25-28` makes an isolated worktree of this repository the unit of
parallel work, and `skills/router/playbooks/orchestrate.md:15-18` repeats it. `src/paths.ts:87`
already names the case - "a clone or worktree of this plugin itself" - so the behaviour is
intentional, but the consequence is documented nowhere the person hitting it will look, and
`git diff main...HEAD | rg -i worktree` returns exactly that one doc-comment line and nothing
else. The impl report's honest limit (c) covers "two checkouts at the same commit still trip
the check" in the abstract; it never connects that to the worktree tooling in the same repo.

What would fix it: (a) a paragraph in `docs/wiki/Gates-and-Hooks.md` beside the new one at
:207-216, and/or in the worktree section of the orchestrate playbook, stating that a worktree
of this repo is its own checkout, that the CLI to run inside it is that worktree's
`./bin/mstack`, and that a session that wants green hooks inside a worktree must be launched
with `--plugin-dir <that worktree>`; and (b) a test pinning it, so the decision is a decision
rather than a side effect - the shape is already there in
`tests/provenance.test.ts:44-49`, which byte-copies a second checkout for exactly this reason.

**2. `src/gate.ts:437-440` / `src/paths.ts:94-96` - the two-marker heuristic false-positives on
an ordinary project, the "fix" it prints is the command that just ran, and there is no
override.**

Reproduced at rung 5, in a project that is not mstack:

```
$ mkdir -p userproj/bin userproj/src && git init -q userproj
$ printf '#!/bin/sh\nexec /Users/romerma/Code/mstack/bin/mstack "$@"\n' > userproj/bin/mstack
$ echo '// my project cli' > userproj/src/cli.ts
$ cd userproj && ./bin/mstack gate
[fail]  this store's root is an mstack checkout, but the CLI producing this report runs from /Users/romerma/Code/mstack
        fix: run /private/tmp/.../userproj/bin/mstack instead; a copy installed elsewhere can predate the checks this store's code expects, and 'mstack version' prints which copy is running
FAILED - 1 failure, 2 warnings
```

The remedy names the launcher the user just invoked. Following it loops forever, and
`checkCliProvenance` has no flag, env var or store setting to turn off, so the gate is red
until a marker file is deleted. This is reachable by a user who generalises the advice this
item adds - `README.md:337-338` and `CONTRIBUTING.md:37-38` both say "use `./bin/mstack`, not
the copy on `PATH`", and a pinning wrapper at `bin/mstack` is the obvious way to apply that in
your own repo, where `src/cli.ts` is an unremarkable name. `tests/gate.test.ts:1231-1266` shows the risk was considered (one
marker must not fire) but stops one step short of the case where both are present and the
project still is not mstack.

What would fix it: make the marker unambiguous instead of circumstantial - require
`.claude-plugin/plugin.json` at `store.root` to parse with `"name": "mstack"`. That file is
tracked, so every real clone and every `git worktree` has it (verified: `$SCRATCH/wt17/.claude-plugin/plugin.json`
exists), and no unrelated project does. Note `tests/provenance.test.ts:46-47` only copies
`bin/` and `src/` into its scratch checkout, so it would need `.claude-plugin/` added.
Failing that, at minimum the failure must not print a `fix:` that is the path that produced
it - detect `canonical(store.root + "/bin/mstack")` being unrunnable-as-a-remedy and say
something a reader can act on.

**3. `docs/wiki/_Footer.md:3` and `README.md:335-343` - acceptance bullet 3's subject clause is
not met on the reading path this repo calls primary.**

The recorded decision (`.mstack/decisions.tsv`, second `item-17` row) is defensible on cost:
72 mechanical edits reviewers must re-verify, to fix a contributor's problem by misdescribing
every user's environment. I am not asking for the 72 edits. I am pointing at where the chosen
substitute does not reach:

- `docs/wiki/_Footer.md` is a GitHub-wiki rendering convention. `README.md:355-356` says
  plainly: "The wiki lives in this repository, under docs/wiki/, so it can be reviewed like
  code and read before the GitHub wiki exists." On that reading path the footer is a separate
  file that nothing includes.
- `rg -c '^\$ mstack' README.md docs/wiki/*.md` gives 73 lines. 54 of them are on
  `docs/wiki/The-CLI.md` (40) and `docs/wiki/Getting-Started.md` (14). Neither page states the
  convention anywhere. `The-CLI.md`'s new `## version` section at :428-450 describes the trap
  but does not say what produced the page's own transcripts.
- In `README.md` the seven transcripts are at lines 71-153; the statement is at 335, and its
  own first clause is "One rule is worth stating here because it bites before CONTRIBUTING.md
  gets read".

What would fix it, cheaply: one line at the top of `docs/wiki/The-CLI.md` and
`docs/wiki/Getting-Started.md` (the two pages carrying 74% of the transcripts), and moving or
mirroring the README sentence so a reader meets it before line 71 rather than at 335. Three
lines, not 72 edits.

**4. `README.md:338-340` - states the protection without the limit that makes it false today.**

"`mstack gate` run by a foreign copy against this repository's store is a red gate that says
so." As of this head that is not true of the foreign copy a contributor actually has: the
installed 0.1.0 prints `PASSED - 0 failures` over this store, which I ran above.
`CONTRIBUTING.md:39-41` carries the caveat, but the README paragraph explicitly exists for the
reader who has not got to CONTRIBUTING.md yet. Add the half-sentence ("...once the installed
copy is new enough to contain the check; a copy installed before it still says nothing"), or
drop the protective claim from the README and keep only the instruction.

## Minor, not blocking

- `.mstack/progress/current.md:9` still reads `**Status:** in_progress` and
  `## Verification` still reads `- Pending.` while the impl report records `live-verified` and
  pastes the runs. The gate's "current.md tracks the active item" check only matches the slug,
  so this drifted without being caught. Worth a line at close.
- `src/gate.ts:431` calls `isMstackCheckout(store.root)` and `src/paths.ts:125` calls it again
  one line later. Not dead code - the outer guard is what separates "not a checkout, say
  nothing" from "checkout and agreeing, say `[ok]`" - but it is worth a word, because it reads
  as redundant.
- `src/cli.ts:61` runs `warnForeignCli` for every command including `hook post-edit` and
  `hook pre-tool-use`, which fire on every edit and every Bash call. The added cost is a
  `findStore` walk plus two `existsSync` and two `realpathSync`; measured impact was not
  visible against the 23.8ms cached hook, so this is a note, not a finding.

## Where the claims stopped on the ladder

- Findings 1 and 2, and every "before/after" claim in the acceptance section: **rung 5**, run
  against this repository and against scratch repos under
  `/private/tmp/claude-501/.../scratchpad/`, with the real `bin/mstack` as a real process.
- "The new tests bite": **rung 4/5** - byte-copied `main` sources into a `git archive` extract
  of HEAD and ran both runners; plus a targeted source mutation for the `runGate` wiring.
- Findings 3 and 4, and acceptance bullet 1: **rung 2**. They are claims about text placement.
  I read the lines and counted the transcripts; I did not and cannot run a reader.
- Acceptance bullet 5's artifact half: **rung 5** (observed on disk, and in my own loaded
  agent definition, this session). The "a subagent therefore ran the 0.1.0 contract" half is
  rung 5 for *this* session and rung 3 for the prior session the impl report cites, which the
  impl report itself already downgrades.

## Cleanup

The probe worktree
`/private/tmp/claude-501/-Users-romerma-Code-mstack/cefb854d-5ff7-43b0-95ba-d79a53d0c4d7/scratchpad/wt17`
and its branch `review17-wt-probe` were created by this review and left in place: removing
them is a destructive git command, which this pass is not permitted to run. Remove with
`git worktree remove <that path>` followed by `git branch -d review17-wt-probe` (the branch
points at this head, so the safe form suffices).

Reproduce finding 1 with `git worktree add -b <name> <path> HEAD`, then run the main
checkout's `bin/mstack gate` from inside it. Nothing tracked in `/Users/romerma/Code/mstack`
was modified by this review except this report and the reviewer row appended to
`.mstack/ledger.tsv`.
