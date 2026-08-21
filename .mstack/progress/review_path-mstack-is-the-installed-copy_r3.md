# Review - path-mstack-is-the-installed-copy (round 3)

**Verdict:** CHANGES_REQUESTED

Reviewing alone, round 3. Head at review time: `e32a86c7ff42653dc37ad6e75b5eced90186809d`.
Every CLI call went through `./bin/mstack`, or an explicit absolute path where the point was to
run a different copy.

This is a near-final round. The blocking round-2 finding is closed properly and so are all three
smaller ones; I re-measured every one rather than reading the report. The mechanism is right,
the test coverage is the strongest it has been, and the two superseding decision rows say
plainly that the earlier cost figure was wrong. What stops approval is small and specific: one
of the two new surfaces prints a sentence the code does not know to be true, on a branch that
has no test, and the diff's own stated invariant is that those two surfaces must not drift.

## Round-2 findings, one by one

**A (blocking): same repository accepted silently, with an affirmative `[ok]`, over a store the
branch's own gate calls red.** Closed. Rebuilt the exact scenario - clone as "main", worktree on
`feat/new-check` carrying one added gate check the main checkout lacks:

```
--- worktree's own CLI ---                          FAILED - 1 failure, 0 warnings   exit 1
--- main's CLI, same store ---
[warn]  this report was produced by a sibling of this repository at committed src tree
        bcd59a44, not this store's d74d810d: .../r3/main — its checks may not be this
        store's checks; run .../r3/wt/bin/mstack for a report this store's code stands behind
PASSED - 0 failures, 1 warning                                                       exit 0
```

The affirmative `[ok]` is gone, both tree ids are named, the remedy is named, and the exit code
does not flip - which is the recorded decision, not an oversight.

**B (cost comment measurably wrong).** Closed. Re-counted with a logging `git` shim on `PATH`,
not by reading the comment:

```
own copy (path-equal)             identity spawns: 0
sibling, src DIFFERS (warn)       identity spawns: 2
sibling, src SAME (ok)            identity spawns: 2
ordinary user repo                identity spawns: 0

GIT: rev-parse --git-common-dir HEAD:src        <- both facts, one spawn per root
GIT: rev-parse --git-common-dir HEAD:src
```

`src/paths.ts:228-232` now reads "once per invocation where the two roots differ - which
includes every worktree run, on every gate - and never in a user's repo or on the path-equal
path". That is exactly what I counted.

**C (manifest failure shapes: contract promised four, test covered two).** Closed.
`tests/gate.test.ts:1297` now walks differently-named, unparseable, JSON `null` and a directory;
"missing" is the wrapper-repo test above it; the blocking shape is the new fifo process test.

**D (fifo manifest hangs the gate forever).** Closed at `src/paths.ts:121`, and the guard is real
coverage - removing the `statSync(...).isFile()` line makes `tests/provenance.test.ts:280` fail
after 10.2s with "the gate had to be killed". Re-ran the live case on both paths:

```
gate:       exit=0  PASSED - 0 failures, 2 warnings   (no provenance line)
state list: exit=0  stderr=[]
```

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| `own`: the store's own launcher is its own line | `tests/provenance.test.ts:63`, `tests/gate.test.ts:1222` | Mutation F (delete the `own` fast path) fails both, plus the sibling test. |
| `same-repo` + same tree: full `[ok]` naming the tree | `tests/provenance.test.ts:150` | Mutation A (`sameSrc: true` always) fails the sibling test; this one pins the positive side. |
| `same-repo` + differing tree: **warn**, not ok, not fail | `tests/provenance.test.ts:234` | Mutation A fails it, mutation B (`warn`->`fail`) fails it, mutation C (`warn`->`ok`) fails it. The severity itself is pinned in both directions. |
| `foreign`: outside the repository is a failure | `tests/provenance.test.ts:75`, `:192` | Still red under mutation F; the clone boundary held under every mutation. |
| `not-a-checkout`: silence in a user's repo | `tests/provenance.test.ts:110`, `:209`, `tests/gate.test.ts:1276` | Guards; they pass on older code by construction and are labelled as such. |
| A blocking manifest read is silence, not a hang | `tests/provenance.test.ts:280` | Mutation D fails it, by timeout. |
| **Tree ids unavailable ("could not be compared")** | **none** | Finding 2. I reached the branch live; `src/gate.ts:465` has no test, and it is the one branch of the switch that does not. |
| **Uncommitted `src/` edits are invisible** | **none** | Finding 4. Stated in three places, pinned in none - unlike every other stated limit in this diff. |

No test was weakened. The two assertions that changed back to `its own ./bin/mstack`
(`tests/gate.test.ts:1229`, `tests/provenance.test.ts:68`) track round 3 restoring a distinct
`own` case, and mutation F proves they now discriminate something round 2's wording could not.
`tests/provenance.test.ts:166,176` were strengthened from "within the same repository" to
"within the same repository at the same committed src tree".

## Acceptance, quoted

**"A contributor is told, where they will actually read it, how to run this checkout's CLI rather than the installed one"**

Met, unchanged. `CLAUDE.md:22-24`, `CONTRIBUTING.md:33-42`, `README.md:339-346`. Rung 2.

**"Running the wrong one against a store is either impossible, or it says so; a version mismatch between the CLI and the checkout is surfaced rather than silent"**

Met on the surfaces the bullet can reach, and I was hard on this one. Three distinct answers,
all reproduced: outside the repository is a failure with exit 1; a sibling at a differing
committed tree says so by name; the store's own copy says so too. The exit code does not flip
for the sibling case, but the bullet asks that it *says so*, not that it refuses, and it says so
in terms that name what was compared.

Two limits sit under that "met", and both are stated rather than discovered:

- The Stop hook gets nothing. Measured, not reasoned - the diverged worktree, plugin root =
  main checkout: `stdout: []`, no `additionalContext`, and only a stderr note. The worktree's
  own copy in the same position injects the red gate. `src/hooks.ts:173` returns null unless
  `report.failed`, so a warn cannot reach the model by construction.
- `HEAD:src` is the committed tree. Finding 4.

**"The wiki and README transcripts state which binary produced them, so re-running them to satisfy the docs rule is unambiguous"**

Met. `README.md:69-72` now opens "The rule for every transcript here and in the wiki:" - which
fixes the round-2 note that the previous phrasing read as a claim about all existing
transcripts rather than a maintenance rule. `docs/wiki/The-CLI.md:6-9` and
`docs/wiki/Getting-Started.md:6-9` unchanged and still on the reading path. Rung 2.

**"Whatever mechanism is chosen is proven against a real mismatch, not only reasoned about"**

Met. Five boundary cases, my own runs, exit codes checked:

```
sibling worktree, src differs, main's CLI   [warn] ... bcd59a44, not this store's d74d810d   exit 0
worktree same commit, main's CLI            [ok]   ... same committed src tree (bcd59a44)    exit 0
foreign copy, outside the repository        [fail] ... runs from .../r3/outside              exit 1
ordinary user repo                          0 provenance lines                               exit 0
the worktree's own CLI                      [ok]   ... its own ./bin/mstack                  exit 1
```

**"The stale copy is shown to govern agent and skill definitions too, not only the CLI"**

Met, unchanged. Confirmed again: my loaded `reviewer` definition still lacks `## Record it`, so
I read `agents/reviewer.md` from the working tree for the recording rule.

## Verification I ran

```
$ npm test
 274 pass
 0 fail
Ran 274 tests across 15 files. [31.25s]
ℹ pass 274
ℹ fail 0

$ npm run typecheck        (exit 0)
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
61 relative links checked, 0 broken

$ ./bin/mstack gate --full
PASSED - 0 failures, 1 warning     (the warning is this session's uncommitted state.json)

$ ./bin/mstack ledger check path-mstack-is-the-installed-copy
FAIL no verdict at e32a86c7; 5 row(s) exist at other SHAs and a new head SHA voids them
```

The ledger FAIL is expected: the newest row is the implementer's at `6653bc0` and `e32a86c` is
the commit that added it. My row follows this report.

**Attack 1, does the warning reach a human.** I did not accept either answer. Measured the
`hook stop` path in the diverged worktree:

```
$ cd <worktree> && echo '{"cwd":"<worktree>","hook_event_name":"Stop"}' | <main>/bin/mstack hook stop
exit=0
stdout: []
stderr: [mstack: note: this command ran a sibling copy from <main> whose committed src tree
         differs from this store's; prefer <worktree>/bin/mstack]

$ ... same, plugin root = the worktree itself
stdout: [{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. ..."}}]
```

Then the client side, with my own canary rather than the page's, on the installed 2.1.238 -
the same build the page was measured against, so its finding is current, not stale:

```
$ claude -p "hi" --output-format stream-json --verbose      # hook writes to stderr, exits 0
{
  "hook_name": "SessionStart:startup",
  "output": "CANARY-ON-STDERR-EXIT0\n",
  "stdout": "",
  "stderr": "CANARY-ON-STDERR-EXIT0\n",
  "exit_code": 0,
  "outcome": "success"
}
```

(The Stop-hook version of the canary could not complete a turn - "Credit balance is too low" -
so this is the same `SessionStart` substitution `docs/wiki/Gates-and-Hooks.md:72-74` already
argues for, and for the same reason.)

So the honest answer, and it is three-valued rather than yes/no: the **model** does not get the
warning on the hook path, by construction. The **client** captures the stderr verbatim as its
own field. Whether a **person** sees that field rendered is not established, and
`docs/wiki/Gates-and-Hooks.md:64-70` already says so in this repository's own words: the
`hook_success` message's rendered content derives from `stdout`, with `stderr` a sibling field.

Judging the fork the coordinator asked me to judge: the decision row's reasoning survives *and*
so does its conclusion, for a reason the row does not lean on. The signal a contributor in a
worktree is told to use is `./bin/mstack` from that worktree - the store's own copy - which
gives the branch's own verdict, correctly, exit 1 and all. The warning exists for the person
who runs the wrong binary in a shell, and there it is loud. What the hook loses is automatic
coverage, not a correct answer replaced by a wrong one. `fail` would buy that coverage at the
price round 1 already established, and `warn` is the right rung. I would not ask for the
severity to change. I would ask that the sentence describing it be as careful as the section
200 lines above it in the same file - finding 3.

**Attack 4, do the round-3 tests bite.** `git archive HEAD | tar -x`, one surgical edit each,
never `git checkout`:

```
A  sameSrc forced true (drop the HEAD:src test)  ✖ a sibling at a different committed src tree ...
B  report.warn -> report.fail                     ✖ a sibling at a different committed src tree ...
C  report.warn -> report.ok                       ✖ a sibling at a different committed src tree ...
D  statSync(...).isFile() guard removed           ✖ a fifo at the manifest path is silence, not a hang  (10.2s, killed)
F  the "own" fast path removed                    ✖ inside a checkout, the checkout's own bin/mstack ...
                                                  ✖ a sibling at a different committed src tree ...
                                                  ✖ the store's own CLI in its own checkout is an [ok] line
```

All four states of the `Provenance` union are independently pinned, and the severity is pinned
against both neighbours.

**Attack 3, re-counted.** Above under round-2 finding B. Not inherited from the report.

## Changes required

**1. `src/cli.ts:1039-1041` - the stderr note says "differs" on the branch where the code knows
only "unknown", and that is the drift the diff's own invariant forbids.**

`src/gate.ts:463-466` splits the two cases and says the honest thing for each. `warnForeignCli`
branches on `!provenance.sameSrc` alone, and `sameSrc` is false both when the trees differ and
when either tree id is `null`. Reproduced live - a worktree whose HEAD has no committed `src/`
(`git rm -r --cached src`), `src/` still on disk, so both roots are still checkouts:

```
gate:  [warn]  ... whose committed src tree could not be compared (git gave no answer): .../main
note:  mstack: note: this command ran a sibling copy from .../main whose committed src tree
       differs from this store's; prefer .../wt/bin/mstack
```

Two surfaces, one situation, and one of them asserts a comparison that never happened.
`src/paths.ts:188-190` states the contract this breaks in as many words: "the gate says it
loudly, `warnForeignCli` quietly, and both must agree or the two surfaces drift." And a message
claiming more than what happened is the defect class this entire item exists to close - the
same reasoning `src/gate.ts:445-448` applies to the `[ok]` line one screen earlier.

The fix is the gate's own three lines: branch on
`provenance.runningSrc === null || provenance.storeSrc === null` and say "could not be compared"
there. Better still, hoist the phrase so the two surfaces cannot drift again by construction,
which is what the invariant is asking for.

**2. `src/gate.ts:463-466` - the "could not be compared" branch has no test.**

Every other branch of that switch gained one this round, and mutations A, B, C and F prove they
bite. This one is reachable - I reached it above with `git rm -r --cached src` in a worktree,
and it is also what a checkout with no commits yet produces. It is currently the only place in
the provenance code where a wrong string could ship green, which is exactly what finding 1 is.
One case appended to `tests/provenance.test.ts:234`'s shape closes both findings at once.

**3. `docs/wiki/Gates-and-Hooks.md:230-233` - "a stderr note on every other subcommand" is true
of a terminal and not of the hook, and this page already knows the difference.**

The sentence lists where the warning goes: "a shell `mstack gate` (and a stderr note on every
other subcommand) but not the hook's injected context." `hook stop` *is* an "other subcommand",
and on that invocation the note is the **only** signal - but it goes to a captured client field,
not to a terminal. Lines 64-70 of this same page draw that distinction carefully for the
`[fail]` line and refuse to promise rendering. Round 3's paragraph is less careful than the
section above it. A clause fixes it: name `hook stop` as the case where the note is the only
signal, and point at the existing "what Claude Code does with those two streams" section rather
than restating it.

**4. `src/gate.ts:444-451` - the committed-tree limit is stated three times and pinned zero
times, and I reproduced it biting.**

A worktree at the same commit as main, with the branch's new gate check **uncommitted** in
`src/gate.ts`:

```
--- worktree's own CLI ---
[fail]  the branch's new uncommitted check fires
FAILED - 1 failure, 1 warning                                              exit 1

--- main's CLI, same store (what the hooks run) ---
[ok]    ... within the same repository at the same committed src tree (bcd59a44)
[warn]  1 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 1 warning                                             exit 0
```

I am not asking for the mechanism to change, and I want to be explicit about why: the `[ok]`
names *committed* tree and nothing more, the adjacent `[warn] 1 uncommitted change(s)` puts the
missing fact one line away, and the limit is written at `src/paths.ts:165-168`,
`src/gate.ts:445-448` and `docs/wiki/Gates-and-Hooks.md:229-231`. Nothing in the diff implies the
gap is closed - I looked, including `README.md:342-346` and `CONTRIBUTING.md:42`, and both still
speak only of a "foreign copy", which round 3 gives a precise meaning that excludes siblings.

What I am asking for is the discipline this diff applies everywhere else: a stated limit that is
not pinned is a limit that stops being a decision the moment someone tightens the comparison.
Round 2 pinned its worktree concession for exactly this reason. One assertion on top of the
existing sibling test - uncommitted `src/` edits do not change the `[ok]` - makes it a decision.

**Answering the second half of attack 2 directly: yes, there is a configuration where the dirty
tree bites, and it is the ordinary orchestrate one** - a worker editing `src/` in a worktree for
most of a session, hooks running the main checkout's copy. The contributor-mid-edit-in-the-main-
checkout case the brief names is indeed fine, because there the running copy *is* the edited
working tree. The gap needs two roots, and worktrees are where two roots come from.

## Reported, not blocking, but do not let it disappear

**The suite failed once and I could not make it fail again.** The first `npm test` of this
session:

```
 273 pass
 1 fail
Ran 274 tests across 15 files. [51.21s]
```

I then ran the suite 19 more times - 12 plain `bun test tests/`, 3 full `npm test`, 6 under
saturating CPU load - all `274 pass 0 fail`. I did not capture the failing test name on that
first run, which is my error and I am not going to dress it up: **rung 5 that it happened, rung 1
for what it was.** What I can rule out is the obvious suspect: `tests/provenance.test.ts:280`'s
10-second spawn guard has 0.38s mean wall time, 26x headroom, so it is not a timeout flake. What
I cannot rule out is that round 3's additions are involved - this round is what pushed the suite
to a second `git worktree add` plus a `git clone` in the shared tmpdir, and that first run took
51s against a 31s steady state. The implementer should try to reproduce it and, failing that,
say so in the report rather than leave a one-in-twenty flake in the item's own `verification`
field unremarked.

## Minor

- `src/cli.ts:1017-1022` now documents the `process.cwd()` versus `input.cwd` split I raised as a
  round-2 minor. Accurate, and I re-confirmed the divergence only appears when `hook stop` is
  driven by hand with a mismatched `cwd`.
- `src/paths.ts:5-8` documents the `git.ts` import that stopped `paths.ts` being a leaf module,
  and pins the no-runtime-cycle claim on the suite rather than asserting it. That is the right
  rung for it.
- `gate --quiet` on a sibling warn prints nothing on either stream, exit 0 - item 16's contract
  held, verified rather than assumed.

## Where the claims stopped on the ladder

- Findings 1 and 4, every boundary-case transcript, the spawn counts, the fifo fix and the
  `hook stop` streams: **rung 5**, run against a clone of this repository, two worktrees of that
  clone (one with a committed added check, one with an uncommitted one), a third with `src/`
  removed from HEAD, and scratch repos under `/private/tmp/claude-501/.../scratchpad/r3`.
- The client's stderr handling: **rung 5** for *captured* - my own canary against the installed
  2.1.238. **Rung 2** for *not rendered to a person*: I read this repository's recorded reading
  of the client's exit-0 branch and could not independently confirm it, because a Stop-hook turn
  would not complete. I am not writing that half up as settled.
- "The round-3 tests bite": **rung 4**, five byte-copy mutations of `HEAD`, run under node.
- Finding 2 (no test on that branch) and finding 3 (doc phrasing): **rung 2**, read off the
  files, with the branch itself reached at rung 5.
- The flake: **rung 5** that the run failed, **rung 1** for the cause. Said out loud rather than
  written up as settled, and not counted against the diff.

## Cleanup

Created by this review, left in place because removing them is a destructive git command. All
self-contained; `rm -rf` on each is sufficient and nothing in `/Users/romerma/Code/mstack` is
touched.

- `/private/tmp/claude-501/-Users-romerma-Code-mstack/cefb854d-5ff7-43b0-95ba-d79a53d0c4d7/scratchpad/r3/`
  - `main` + `wt` (branch `feat/new-check`, committed added check), `d/main` + `d/wt` (branch
    `feat/dirty`, uncommitted added check), `nosrc/main` + `nosrc/wt` (branch
    `no-src-committed`), the `mutA`-`mutF` mutation copies, `outside`, `user`, `fifo`, and
    `canary` (a scratch project with a stderr-canary hook in its own `.claude/settings.json`).
  - The worktrees are registered against the clones inside `r3/`, not against this repository.
- Still outstanding from earlier rounds, registered against **this** repository:
  `scratchpad/wt17` (branch `review17-wt-probe`, round 1) and `scratchpad/r2/` (self-contained).

Nothing tracked in `/Users/romerma/Code/mstack` was modified by this review except this report
and the reviewer row appended to `.mstack/ledger.tsv`.
