# Implementation report — 14 `verification-never-runs`

Implementer pass. Branch `feat/verification-never-runs`. **Not approved**: a reviewer that did
not write this code decides that, and the item stays `in_progress`.

## What changed

`state.verify` and an item's `verification` were executed by nothing but a human typing `mstack
gate --full`, so the half of "the gate must be green before a session closes" that concerns
verification was enforced by no code at all. This pass joins the two halves with a **receipt**
rather than by making the fast pass slow: `gate --full` now writes down which command it ran,
against which commit, and how it went, into a new machine-local `.mstack/verification.tsv`
owned by a new module `src/verification.ts`; and the fast gate — the one the `Stop` hook runs at
the end of every turn — reads that back and, from `verifying` on, refuses to call an item green
on a verification that has no passing run at the current commit. Because `done` is not an active
status, relabelling the item would otherwise make the gate stop looking, so `state set --status
done` re-checks at the transition and exits 2, with `--force` still closing it and printing on
the record that it did. Separately, `gate --full` that ran no verification at all is now a
failure and exit 1 instead of a warning and exit 0. The stdio constraint item 16 left behind is
answered by not wiring `--full` to anything: `stdio: "inherit"` is untouched, the
characterization test at `tests/cli.test.ts` that pins it is untouched and still green, and a
human running the full gate keeps live progress output from their own suite. The cost line sits
at `verifying` because `verifying -> done` is the only legal transition into `done`, so it is
the earliest status that is also sufficient; held any earlier the gate would go red after every
commit for the phase where most commits happen, which is the version of this feature people
switch off.

## Files

| File | What |
|---|---|
| `src/verification.ts` | **New.** Owns the receipt: `HEADER`, `obligations`, `record`, `receipts`, `status`, and `lastRun`'s (commit, command-text) matching |
| `src/lifecycle.ts` | `VERIFICATION_REQUIRED_FROM` and `requiresVerification`. The cost line, with the reasoning written where the line is |
| `src/paths.ts` | `Store.verification` -> `.mstack/verification.tsv` |
| `src/setup.ts` | `STORE_GITIGNORE`, and `setup` writes `.mstack/.gitignore` every run |
| `src/gate.ts` | `checkVerificationRuns` (new fast check, skipped under `--full`); `runVerification` records outcomes and fails when it ran nothing |
| `src/cli.ts` | `state set --status done` refuses on an unrun verification; `--force` prints the override |
| `tests/verification.test.ts` | **New.** 10 tests for the module and the store `.gitignore` |
| `tests/gate.test.ts` | 12 new tests |
| `tests/cli.test.ts` | 5 new tests plus a `commitAll` fixture helper |
| `docs/wiki/Gates-and-Hooks.md` | New section "Verification that actually ran"; `--full` transcript and Stop-hook row updated |
| `docs/wiki/State-Files.md` | `verification.tsv` section, store tree, `verification` field row |
| `docs/wiki/The-CLI.md` | `setup` transcript, `gate` section, the answer to the `--full` stdio question |
| `docs/wiki/Getting-Started.md` | `setup` and first-gate transcripts |
| `README.md` | New "A verification nobody ran is not a check"; store tree; CLI table |
| `CHANGELOG.md` | Four Unreleased bullets |
| `.mstack/.gitignore` | **New.** Byte-identical to what `setup` writes |

Commits, each building: `ddac8e3` module, `fd1b27a` gate, `ae40ab2` closing guard, `f2e9308`
the boundary test the first mutation round demanded, `db00832` docs, `028e3bd` changelog,
`db80b45` one correction of my own (below).

### A false claim of mine, caught before the reviewer had to

`STORE_GITIGNORE` first carried a second line, `verification.tsv.lock`, and the test asserting
it said the lock "appears exactly when two mstack processes overlap". That is not true.
`withLock` is used by `src/decisions.ts` alone, because `decisions.add` reads before it appends;
`verification.record` appends directly and takes no lock, so the file never exists. `db80b45`
removes the line and replaces the assertion with the opposite and more useful one — **exactly**
one ignored path, so an over-broad rule here could not silently stop committing a ledger row.
Noted rather than quietly fixed, because a false sentence in a test comment is how a check that
cannot fail gets written.

## Design decisions

Six rows in `decisions.tsv`, all recorded **before** any code was written.

| Row | Decision | The cost it accepts |
|---|---|---|
| `11:43:05.977Z` | **The stdio answer.** Keep `--full` out of the `Stop` hook; the fast gate reads a receipt of a past run instead | Nothing detects a red verification *the instant* it goes red — only at `verifying` or when someone runs `--full`. Bought: `stdio: "inherit"` unchanged, live suite output preserved, hook stdout still parseable, `tests/cli.test.ts:560` green untouched |
| `11:43:17.792Z` | Receipts go in `.mstack/verification.tsv`, not the ledger | A second store file. Avoided: a gate-written ledger row carries a `verifier` that `canCloseAnItem` accepts, so `gate --full` would close the item it was meant to prove |
| `11:43:17.817Z` | The receipt is machine-local, gitignored by a `.mstack/.gitignore` that `setup` writes | A fresh worktree must run the verification itself. That is the point: committing a receipt moves HEAD and voids the receipt being committed, and a receipt from another checkout is not evidence anything ran here |
| `11:43:30.446Z` | **The cost boundary.** Fast gate demands a fresh run only from `verifying`; `state set --status done` re-checks at the transition | A red verification at `in_progress` stays unnoticed until `verifying`. Bought: the `Stop` hook stays a file read, and the whole `in_progress` phase costs nothing |
| `11:43:37.110Z` | `--full` with nothing to run fails and exits 1; the fast gate only warns about it | Asymmetric on purpose. Failing in the fast gate too would wedge every store still carrying the empty `verify` that `setup` seeds, and criterion 1 is about an item *whose* verification never ran |
| `11:43:44.567Z` | A receipt is matched on the exact command **text**, not just (item, sha) | Editing the string voids the proof — which is right: the incident was a `verification` field that did not execute, and a receipt keyed to the item alone would let the old string's green run vouch for whatever replaced it |

Two boundaries stated rather than papered over:

- **Items already `done` are not judged.** Holding them to today's HEAD would turn all 13 closed
  items in this store red for a fact that was true but not recorded, and `require_verdict_to_close`
  already governs them. `done -> done` is likewise not re-judged; that is pinned by a test.
- **`--force` remains an override.** `state set --status done --force` closes an unverified item.
  It prints the fact on the record, the way `--sdd` does, and the ledger check still applies.

## Commands

### Baseline, taken before anything was touched

```console
$ npm test 2>&1 | rg "^\s*(\d+ pass|\d+ fail)|ℹ (tests|pass|fail)"
27: 203 pass
28: 0 fail
251:ℹ tests 203
253:ℹ pass 203
254:ℹ fail 0

$ npm run typecheck; ./bin/mstack lint-plugin . | tail -3
> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit

[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings
```

### The defect, reproduced at rung 5 before the fix

The bypass the CLI guard closes, driven through the shipped binary in a scratch store. The item
sits at `verifying` with a verification nothing ever executed:

```console
### 1. the gate at verifying, verification never executed
[fail]  1 greet-flag (verifying) is one step from done, and `pytest -q tests/test_greet.py` has never been executed
        fix: run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check

-- workspace
[ok]    on branch feat/x
[ok]    working tree is clean

FAILED - 1 failure, 0 warnings

### 2. flip it to done - nothing runs, nothing objects
1 greet-flag (done)
  status: "verifying" -> "done"
recorded test-verified for greet-flag at df3d4373

### 3. the gate now

-- workspace
[ok]    on branch feat/x
[warn]  2 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 1 warning
```

Red to green with nothing having run, in one command. That run used the fast-gate check already
in place (step 1 is the new check working) and shows the hole it still had; step 2 is what
`ae40ab2` now refuses.

### The mechanism catching a red verification, end to end, rung 5

Shipped `bin/mstack` and `bin/mstack hook stop` as real processes. The item's `verification` is
the shape that cost 230 minutes — half command, half prose:

```console
$ sh -n -c "run the unit tests for greet and confirm they pass: python3 -m unittest test_greet"
sh -n: exit 0, syntactically fine

### 1. the Stop hook, at the end of a turn, without running anything
[fail]  1 greet-flag (verifying) is one step from done, and `run the unit tests for greet and confirm they pass: python3 -m unittest test_greet` has never been executed -> run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- 1 greet-flag (verifying) is one step from done, and `run the unit tests for greet and confirm they pass: python3 -m unittest test_greet` has never been executed -> run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check"}}  <- exit 0

### the two streams are still separate: stdout alone, then stderr alone
stdout parsed as JSON, 384 bytes, nothing in front of it

### 2. gate --full - the first thing that ever executes the string
-- verification
/bin/sh: run: command not found
[fail]  run the unit tests for greet and confirm they pass: python3 -m unittest test_greet failed
        fix: fix it; a red verification is not a partial pass

FAILED - 1 failure, 0 warnings
  <- exit 1

### 3. the receipt it left behind
target      sha                                       command                                                                             outcome  ts
greet-flag  2585b1f4882e76854f83d40e8e8914cdf9dc4f07  run the unit tests for greet and confirm they pass: python3 -m unittest test_greet  failed   2026-08-21T11:58:07.118Z

### 4. the next turn's Stop hook. Nothing is executed, and it still cannot go green
[fail]  1 greet-flag (verifying) is one step from done, and `run the unit tests for greet and confirm they pass: python3 -m unittest test_greet` ran at 2585b1f4 and failed -> run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check

### 5. and the item cannot be relabelled out of the problem
mstack: greet-flag cannot close on a verification that has not run: `run the unit tests for greet and confirm they pass: python3 -m unittest test_greet` ran at 2585b1f4 and failed
        run 'mstack gate --full' at this commit; closing is the one moment the run has to be real, and --force closes it unverified
  <- exit 2
```

Recovery, in the same store: a real command is set, the code is committed, and the loop clears.

```console
1 greet-flag (verifying)
  verification: "run the unit tests for greet and confirm they..." -> "python3 -m unittest test_greet"

### git ignores the receipt, so committing cannot void the receipt being committed
(clean above means verification.tsv is not staged)
.mstack/.gitignore:4:verification.tsv	.mstack/verification.tsv

### 6. gate --full again, at the new commit
.
----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
-- verification
[ok]    python3 -m unittest test_greet

PASSED - 0 failures, 0 warnings

### 7. the Stop hook now says nothing, on either stream, and the close is allowed
(exit 0, zero bytes above)
recorded test-verified for greet-flag at a7af6d1e
1 greet-flag (done)
  status: "verifying" -> "done"

### 8. and the receipt file, both runs
target      sha                                       command                                                                             outcome  ts
greet-flag  2585b1f4882e76854f83d40e8e8914cdf9dc4f07  run the unit tests for greet and confirm they pass: python3 -m unittest test_greet  failed   2026-08-21T11:58:07.118Z
greet-flag  a7af6d1e73ae0a0901eda60950f07a4186d01562  python3 -m unittest test_greet                                                      passed   2026-08-21T11:58:26.374Z
```

### This repository, verifying itself

```console
$ ./bin/mstack gate | tail -6
[ok]    verification-never-runs is in_progress; a verification run is due at verifying

-- workspace
[ok]    on branch feat/verification-never-runs
[ok]    working tree is clean

PASSED - 0 failures, 0 warnings

$ ./bin/mstack gate --full | tail -3
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .

PASSED - 0 failures, 0 warnings

$ column -s$'\t' -t .mstack/verification.tsv
target                   sha                                       command                                                      outcome  ts
(project)                028e3bd082c2a79ab9cf90a3ff3ceaf38d9647ca  npm test && npm run typecheck && bin/mstack lint-plugin .    passed   2026-08-21T12:04:32.681Z
verification-never-runs  028e3bd082c2a79ab9cf90a3ff3ceaf38d9647ca  npm test && npm run typecheck && ./bin/mstack lint-plugin .  passed   2026-08-21T12:05:00.545Z

$ git status --porcelain
(clean above = the receipt is ignored)
```

### New tests red against the pre-change code, restored by byte copy

`src/gate.ts` swapped for `fd1b27a~1:src/gate.ts`, restored from a copy taken beforehand and
checked by sha256. No `git checkout` anywhere in this pass.

```console
== swapped in the pre-change gate ==
4a1ff309b30b9597074122e8b93a9a21f98dd4324260d05556fe3605d98fa370  src/gate.ts
21:(fail) an item one step from done whose verification never ran is red, and the command is named [106.31ms]
39:(fail) a recorded failing run keeps the gate red, which is the 230-minute case [106.01ms]
57:(fail) a run recorded at an older commit does not carry over [174.56ms]
75:(fail) nothing before verifying is held to a run, however loudly it is configured [285.85ms]
92:(fail) an item at verifying with nothing configured warns rather than wedging [104.71ms]
110:(fail) both configured commands have to have run, not just one [107.99ms]
151:(fail) with no active item the check says so instead of staying silent [106.78ms]
169:(fail) --full records what it ran, and the fast gate afterwards is green [107.66ms]
191:(fail) --full records a failure too, and the fast gate keeps saying it [109.96ms]
209:(fail) --full that ran nothing fails instead of reporting a pass [103.19ms]
211: 33 pass
212: 10 fail
== restoring from the byte copy ==
64451a6872e36883624a96c3757b5887c6b6c73be2c88533bf1ec9bbdcf51e9b  src/gate.ts
```

The same for the CLI tests, against each pre-change file in turn:

```console
64451a6872e36883624a96c3757b5887c6b6c73be2c88533bf1ec9bbdcf51e9b  src/gate.ts
5852d4b3284a81b949cf61ab0b35c74acdeb46b02a7b526a7bd290d5e7ece589  src/cli.ts

=== BASELINE (must be green, or every kill below is meaningless) ===
 25 pass
 0 fail

=== KILL A: pre-change src/gate.ts ===
(fail) gate --full is distinguishable, in summary and exit code, from one that verified nothing [160.95ms]
(fail) an item cannot be closed on a verification that never ran here [261.56ms]
 23 pass
 2 fail
64451a6872e36883624a96c3757b5887c6b6c73be2c88533bf1ec9bbdcf51e9b  src/gate.ts

=== KILL B: pre-guard src/cli.ts ===
(fail) an item cannot be closed on a verification that never ran here [77.95ms]
(fail) --force closes it anyway, and says on the record that it did [77.69ms]
 23 pass
 2 fail
5852d4b3284a81b949cf61ab0b35c74acdeb46b02a7b526a7bd290d5e7ece589  src/cli.ts

=== RESTORED, re-running baseline ===
 25 pass
 0 fail
```

Four of the 25 new tests cannot go red this way, because they are preservation requirements: a
green run staying green, `--full` not demanding a receipt of the run it is about to perform, an
empty obligation list staying satisfiable, and the closing guard staying out of every other
transition. Their bite is shown by mutations M5, M15, M8 and M20 below.

### Mutations: baseline first, 20 of 20 killed

The driver runs the full suite **before** any mutation and stops if it is red; every target is
restored from a byte copy and the restore is verified by sha256; a mutation whose anchor is not
found, or whose named test does not actually run, is reported as a setup error rather than a
survivor. Driver at `mutate.mjs` in the session scratch directory.

```console
=== BASELINE (must be green, or nothing below means anything) ===

 230 pass
 0 fail
M1  src/verification.ts  lastRun keeps the FIRST match instead of the last
      killed by 1 test(s) matching "the last run at a commit wins"   (restored ok, sha256 5582d0bb2702)
M2  src/verification.ts  lastRun stops caring which commit the run was at
      killed by 1 test(s) matching "a run recorded at an older commit does not carry over"   (restored ok, sha256 5582d0bb2702)
M3  src/verification.ts  lastRun stops caring which command was run
      killed by 1 test(s) matching "editing the verification string voids the receipt"   (restored ok, sha256 5582d0bb2702)
M4  src/verification.ts  any recorded run counts, pass or fail
      killed by 1 test(s) matching "a recorded failing run keeps the gate red"   (restored ok, sha256 5582d0bb2702)
M5  src/verification.ts  a passing run no longer satisfies the command
      killed by 1 test(s) matching "a recorded passing run at this commit turns it green"   (restored ok, sha256 5582d0bb2702)
M6  src/verification.ts  the item's own verification drops out of the obligation list
      killed by 1 test(s) matching "both configured commands have to have run"   (restored ok, sha256 5582d0bb2702)
M7  src/verification.ts  the project verify command drops out of the obligation list
      killed by 1 test(s) matching "the obligation list is exactly what --full would run"   (restored ok, sha256 5582d0bb2702)
M8  src/verification.ts  an empty obligation list reads as unsatisfied
      killed by 1 test(s) matching "closing an item nothing verifies is not blocked by this guard"   (restored ok, sha256 5582d0bb2702)
M9  src/verification.ts  'never ran' and 'ran at another commit' collapse into one message
      killed by 1 test(s) matching "a run recorded at an older commit does not carry over"   (restored ok, sha256 5582d0bb2702)
M10  src/gate.ts  the receipt problem becomes a warning instead of a failure
      killed by 1 test(s) matching "whose verification never ran is red"   (restored ok, sha256 64451a6872e3)
M11  src/gate.ts  the run is demanded from every active status, not just verifying
      killed by 1 test(s) matching "nothing before verifying is held to a run"   (restored ok, sha256 64451a6872e3)
M12  src/gate.ts  --full runs the commands but records nothing
      killed by 1 test(s) matching "--full records what it ran"   (restored ok, sha256 64451a6872e3)
M13  src/gate.ts  --full records every run as a pass
      killed by 1 test(s) matching "--full records a failure too"   (restored ok, sha256 64451a6872e3)
M14  src/gate.ts  --full that ran nothing goes back to warn-and-exit-0
      killed by 1 test(s) matching "gate --full is distinguishable"   (restored ok, sha256 64451a6872e3)
M15  src/gate.ts  --full also demands a receipt of the run it is about to perform
      killed by 1 test(s) matching "--full does not ask for a receipt"   (restored ok, sha256 64451a6872e3)
M16  src/gate.ts  the check stays silent when nothing is due
      killed by 1 test(s) matching "with no active item the check says so"   (restored ok, sha256 64451a6872e3)
M17  src/gate.ts  verifying with nothing configured becomes a hard failure
      killed by 1 test(s) matching "with nothing configured warns rather than wedging"   (restored ok, sha256 64451a6872e3)
M18  src/cli.ts  the closing guard is consulted and its answer ignored
      killed by 1 test(s) matching "an item cannot be closed on a verification that never ran here"   (restored ok, sha256 5852d4b3284a)
M19  src/cli.ts  --force closes it silently, with nothing on the record
      killed by 1 test(s) matching "--force closes it anyway"   (restored ok, sha256 5852d4b3284a)
M20  src/cli.ts  the guard fires on every status move, not only into done
      killed by 1 test(s) matching "only the move into done is guarded"   (restored ok, sha256 5852d4b3284a)

=== SUMMARY ===
20 mutations, 20 killed, 0 survived, 0 setup errors

=== POST-RUN BASELINE (proves every restore landed) ===

 230 pass
 0 fail
git status --porcelain src/:
(clean)
```

**The first round was 19/20, and the survivor mattered.** M20 — letting the closing guard fire
on every status move, not only into `done` — survived, which meant nothing in the suite stopped
a version of this feature that demands a full verification run just to advance an item from
`in_progress` to `reviewing`. That is the opposite of the cost boundary criterion 3 asks for.
It is a gap in my tests, not a bad mutation, so `f2e9308` added
`tests/cli.test.ts:678` and the run above is the re-run with it in place.

### Final state

```console
$ npm test
> mstack@0.1.0 test
> bun test tests/ && node --test 'tests/*.test.ts'

bun test v1.3.11 (af24e281)
 230 pass
 0 fail
Ran 230 tests across 14 files. [20.08s]
ℹ tests 230
ℹ suites 0
ℹ pass 230
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7640.928958

$ npm run typecheck
> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit

$ ./bin/mstack lint-plugin .
-- manifest
[ok]    plugin name: mstack
[ok]    plugin-root CLAUDE.md is project memory for this checkout; .mstack/ shows the repo is worked in

-- skills
[ok]    skills/design/SKILL.md (58 lines, 307 description chars)
[ok]    skills/verify/SKILL.md (24 lines, 260 description chars)
[ok]    skills/understand/SKILL.md (56 lines, 281 description chars)
[ok]    skills/reflect/SKILL.md (59 lines, 247 description chars)
[ok]    skills/setup/SKILL.md (72 lines, 251 description chars)
[ok]    skills/spec/SKILL.md (71 lines, 305 description chars)
[ok]    skills/review/SKILL.md (41 lines, 212 description chars)
[ok]    skills/implement/SKILL.md (64 lines, 280 description chars)
[ok]    skills/ship/SKILL.md (38 lines, 190 description chars)
[ok]    skills/orchestrate/SKILL.md (57 lines, 240 description chars)
[ok]    skills/unslop/SKILL.md (71 lines, 216 description chars)
[ok]    skills/router/SKILL.md (145 lines, 310 description chars)

-- agents
[ok]    agents/orchestrator.md
[ok]    agents/reviewer.md
[ok]    agents/spec-reviewer.md
[ok]    agents/spec-author.md
[ok]    agents/implementer.md

-- hooks
[ok]    hook event SessionStart
[ok]    hook event PostToolUse
[ok]    hook event SubagentStop
[ok]    hook event Stop
[ok]    hook event PreToolUse

-- references
[ok]    20 reference file(s), every relative link resolves

-- shipped commands
[ok]    32 file(s), no command that would hang on stdin

-- cross-references
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves

-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
60 relative links checked, 0 broken
```

## Acceptance criterion to test

Direct path: the four criteria in `.mstack/state.json`, item 14.

### C1 — "A session cannot close green on an item whose verification has never been executed at its current state; the mechanism is a check or a hook, not prose"

The mechanism is `checkVerificationRuns` in `src/gate.ts`, which the `Stop` hook already runs
via `runGate(store, { quiet: true })`, plus the guard in `src/cli.ts` that closes the
relabelling bypass. No prose anywhere is load-bearing.

| Fact | Test | Where |
|---|---|---|
| Never executed -> red, naming the command and the fix | `an item one step from done whose verification never ran is red, and the command is named` | `tests/gate.test.ts:588` |
| Executed and failed -> still red, without re-running it | `a recorded failing run keeps the gate red, which is the 230-minute case` | `tests/gate.test.ts:617` |
| "Current state" means this commit; an older run does not carry over | `a run recorded at an older commit does not carry over` | `tests/gate.test.ts:631` |
| ...and neither does an edit to the command it vouched for | `editing the verification string voids the receipt that vouched for the old one` | `tests/verification.test.ts:123` |
| One green command does not carry the other | `both configured commands have to have run, not just one` | `tests/gate.test.ts:700` |
| Relabelling to `done` is not the way out | `an item cannot be closed on a verification that never ran here` | `tests/cli.test.ts:625` |
| `--force` still closes it, and says so on the record | `--force closes it anyway, and says on the record that it did` | `tests/cli.test.ts:650` |
| The check speaks even when nothing is due | `with no active item the check says so instead of staying silent` | `tests/gate.test.ts:717` |

Rung 5, additionally: the end-to-end transcript above, through `bin/mstack hook stop` and
`bin/mstack` as real processes.

### C2 — "`gate --full` that ran no verification is distinguishable in its summary and its exit code from one that ran and passed"

| Fact | Test | Where |
|---|---|---|
| Exit code **and** summary line differ, through the shipped binary | `gate --full is distinguishable, in summary and exit code, from one that verified nothing` | `tests/cli.test.ts:591` |
| It is a `[fail]` naming which of the two places is empty, and nothing is recorded | `--full that ran nothing fails instead of reporting a pass` | `tests/gate.test.ts:779` |

The CLI test asserts `exit 1` + `FAILED - 1 failure, 0 warnings` against `exit 0` +
`PASSED - 0 failures, 0 warnings`, from one quiesced store so the warning counts cannot differ
for an unrelated reason.

### C3 — "The cost is bounded ... and the reasoning for where the line falls is recorded"

Nothing on the `Stop` path executes a command; `checkVerificationRuns` reads one TSV. The line
is at `verifying`, the reasoning is in `src/lifecycle.ts` above `VERIFICATION_REQUIRED_FROM`, in
the `decisions.tsv` row `2026-08-21T11:43:30.446Z`, and in the wiki table.

| Fact | Test | Where |
|---|---|---|
| No status before `verifying` owes a run, however loudly configured | `nothing before verifying is held to a run, however loudly it is configured` | `tests/gate.test.ts:659` |
| The writer's guard belongs to the one transition, and a re-close is not re-judged | `only the move into done is guarded; every other move and a re-close are not` | `tests/cli.test.ts:678` |
| `--full` is never asked for a receipt of the run it is about to perform | `--full does not ask for a receipt of the run it is about to perform` | `tests/gate.test.ts:797` |
| The expensive half stays where it was, and records | `--full records what it ran, and the fast gate afterwards is green` | `tests/gate.test.ts:734` |

That the `Stop` hook runs no subprocess is rung 2-3, not 4: it follows from
`checkVerificationRuns` calling only `headSha` and `receipts`, and from `runVerification` being
reachable only under `options.full`. M11 and M15 pin the two ways that could regress.

### C4 — "Tests cover a red verification being caught, a green one passing, and the no-verification-configured case"

| Case | Test | Where |
|---|---|---|
| **Red caught** — a real `false`/broken command run by `--full`, recorded, and still red on the next fast gate | `--full records a failure too, and the fast gate keeps saying it` | `tests/gate.test.ts:754` |
| **Red caught** — from a receipt alone, with nothing executed | `a recorded failing run keeps the gate red, which is the 230-minute case` | `tests/gate.test.ts:617` |
| **Red caught** — the module-level fact | `a run that failed here is a different fact from one that never ran` | `tests/verification.test.ts:87` |
| **Green passing** — a real `true` run by `--full`, then a green fast gate | `--full records what it ran, and the fast gate afterwards is green` | `tests/gate.test.ts:734` |
| **Green passing** — from a receipt alone | `a recorded passing run at this commit turns it green` | `tests/gate.test.ts:605` |
| **Green passing** — and only at this commit | `a passing run at this commit satisfies the command, and only at this commit` | `tests/verification.test.ts:65` |
| **Green passing** — the last run wins in both directions | `the last run at a commit wins, in both directions` | `tests/verification.test.ts:100` |
| **None configured** — the fast gate warns rather than wedging | `an item at verifying with nothing configured warns rather than wedging` | `tests/gate.test.ts:680` |
| **None configured** — `--full` fails and exits 1 | `--full that ran nothing fails instead of reporting a pass` / `gate --full is distinguishable...` | `tests/gate.test.ts:779`, `tests/cli.test.ts:591` |
| **None configured** — closing is not blocked by this guard | `closing an item nothing verifies is not blocked by this guard` | `tests/cli.test.ts:695` |
| **None configured** — the module says the list was empty | `nothing configured is vacuously satisfied, and says the list was empty` | `tests/verification.test.ts:158` |

Supporting module tests not tied to one criterion: `tests/verification.test.ts:17` (the
obligation list is what `--full` runs — one function, two callers, so the check cannot demand a
command `--full` never runs), `:38` (round trip), `:53` (never-run message), `:142` (one green
does not carry the other), `:171` (the store `.gitignore` ignores exactly one path).

The mutation run above predates `db80b45`, which touched `src/setup.ts` and one assertion and
no logic in `src/verification.ts`, `src/gate.ts` or `src/cli.ts` — the three files every
mutation targets. The suite is 230 pass on both runtimes at that commit and at this one.

## Where each claim stopped on the ladder

| Claim | Rung | What got it there |
|---|---|---|
| The gap is real: nothing automatic executed `state.verify` or `item.verification` | 5 | `src/hooks.ts:172` runs the fast gate, and the pre-change scratch run above shows a `verifying` item closing green with nothing run |
| Only running a verification catches a non-executable one | 5 | `sh -n -c "<the string>"` exits 0; `sh -c` on the same string is `command not found` |
| The fix catches a red verification and keeps catching it | 5 | Shipped `bin/mstack` and `bin/mstack hook stop` as real processes, full transcript above |
| The relabelling bypass existed and is closed | 5 | Reproduced before the guard, refused after, both through the shipped binary |
| The receipt is not committed, and git agrees | 5 | `git check-ignore -v` and a clean `git status --porcelain` after two real `--full` runs in this repository |
| The hook's JSON is still alone and parseable on stdout | 5 | `mstack hook stop 2>/dev/null \| JSON.parse` — 384 bytes, nothing in front |
| `tests/cli.test.ts:560`'s stdio boundary is unchanged | 5 | The canary transcript re-run and byte-identical to what the wiki already published |
| Every behaviour above holds in code, not by inspection | 4 | 230 tests on bun and node; 25 new; 20/20 mutations killed with a green baseline before and after |
| The `Stop` hook runs no subprocess | 3 | `checkVerificationRuns` calls `headSha` and `receipts` only; `runVerification` is reachable only under `options.full`. Walked, not timed |
| A store whose filesystem refuses the receipt write reports usefully | **2** | The failure path is written and typechecked. **Not exercised by any test**, and stated as such rather than written up as settled |
| Whether Claude Code *renders* a hook's stderr to a person | **2** | Unchanged from item 16, and still unverified. The bytes reach fd 2; the model gets them through `additionalContext` regardless |

## For the reviewer

Three things worth a deliberate ruling rather than a skim.

1. **`--force` on `state set --status done` still closes an unverified item.** It is loud and it
   is consistent with every other guard in that file, but it is an override on the criterion-1
   mechanism. If you want it gone, that is a product call, not a bug fix.
2. **Items already `done` are never held to a receipt**, deliberately, so this change turns none
   of the 13 closed items in this store red. `require_verdict_to_close` still governs them. The
   consequence is that an item forced straight to `done` past `verifying` is judged by the
   ledger and not by this check.
3. **`mstack setup` now rewrites `.mstack/.gitignore` on every run**, unlike every other file it
   touches. The reasoning is in the code; if you disagree, the alternative is that older stores
   silently start committing receipts that void themselves.

When you move this item to `verifying`, the gate will demand a `gate --full` at that commit
before it goes green — which is this feature verifying itself, and worth watching.

---

# Round 2 — response to CHANGES_REQUESTED

Reviewed at `26b0671`. Eight findings, two blocking. All eight addressed below; the reviewer's
ruling on finding 5 is followed rather than re-argued, and finding 6 is left where the reviewer
put it. **Both blocking findings were reproduced by me first, at rung 5, before any fix.**

## What changed

The two blocking findings were both cases of the receipt claiming more than it could prove.
Finding 1: `receipts` reads a file, a read throws, and `cmdHook` catches every throw and returns
0 by design, so an unreadable `verification.tsv` made `mstack hook stop` produce zero bytes and
exit 0 — byte-identical to a green gate — and threw `mstack gate` out mid-run so the workspace
section and the summary never happened. That is the seventh instance of this repository's
check-that-cannot-fail pattern, shipped by the change built to close the sixth, and it is now
wrapped in the shape of the sibling twenty lines above it whose comment already named the bug.
Finding 2: a receipt keyed to `(sha, command)` certified a *commit* and not a *tree*, so an
uncommitted edit after a green `--full` was invisible to the fast gate and to the closing guard
alike; receipts now carry a sixth `tree` column holding a fingerprint of `git status
--porcelain` with paths under `.mstack/` removed, which voids a run when code changes and does
not when someone writes a line of their own progress notes. Around those, finding 3 added a gate
warning naming both commands an existing store needs, finding 4 pinned the whitespace boundary
that a surviving mutation showed was emergent, finding 5 made `--force` on an unverified close
demand `--closed-by` and store the reason prefixed `closed unverified (forced):`, finding 7 told
`agents/reviewer.md` what a red `--full` that ran nothing actually means, and nitpicks 1, 2 and
4 were applied. `git()` moved to `src/git.ts` so `verification.ts` could use it without a cycle,
and gained a `raw` option — which turned out to be load-bearing rather than cosmetic, below.

## Finding by finding

| # | Verdict | What landed |
|---|---|---|
| 1 BLOCKING | fixed | `checkVerificationRuns` wraps the read and reports it (`src/gate.ts:481-500`); the closing guard reports it too instead of a bare errno (`src/cli.ts:513-522`). Three tests, four mutations |
| 2 BLOCKING | fixed, option (b) | `tree` column + `treeId` (`src/verification.ts:117-152`), matched in `lastRun` and explained in `why`. Four tests, six mutations. Rules table row added, as option (c) would have required anyway |
| 3 REQUIRED | fixed, both halves | `CHANGELOG.md` upgrade paragraph naming `mstack setup` **and** `git rm --cached`, plus the gate check the reviewer preferred: `checkReceiptIsIgnored` (`src/gate.ts:117-140`). Two tests, two mutations |
| 4 REQUIRED | fixed | `tests/verification.test.ts:180` pins five tolerated spellings and three refused ones. Kills the reviewer's M12 (my R2-4b) |
| 5 REQUIRED | fixed, reviewer's ruling followed | `--force` on this transition now exits 2 without `--closed-by`, and stores `closed unverified (forced): <reason>` in `state.json`. Two tests, three mutations |
| 6 REQUIRED before close | left for the closing pass, as the reviewer directed | A fresh implementer row is recorded at the round-2 head. It cannot close the item: `--verifier implementer` is refused by `canCloseAnItem`, which is the point |
| 7 MODERATE | fixed | `agents/reviewer.md:19-26`. Also `skills/router/playbooks/cleanup.md` for nitpick 7 |
| 8 | agreed | `db80b45` kept |

### Nitpicks

| # | Action |
|---|---|
| 1 dedupe | **Done.** `obligations` dedupes on exact text (`src/verification.ts:98-108`), pinned at `tests/verification.test.ts:220`, mutation R2-1n. It does **not** fire in this store: `state.verify` and item 14's `verification` differ by a `./`, and aligning them is store data, not code — flagged below for whoever closes the item |
| 2 `Status` collision | **Done.** `RunStatus`; the alias at the gate's import is gone |
| 3 `ts?` override | **Kept**, and it is not test-only surface: `ledger.record` has the identical `Omit<Entry, "ts"> & { ts?: string }` signature for the identical reason. Divergence would be the cost here |
| 4 backwards conjunct | **Done.** Restructured into an `add()` helper that does the empty check once |
| 5 `withLock` | **Not changed**, deliberately, decision `2026-08-21T12:38:06.357Z`. `ledger.record` shares the identical window through the same `append` helper; locking one of two would leave the codebase inconsistent about a race present in both. Documented in the module header at rung 3, with the reviewer's 8-of-8 result quoted |
| 6 `cell` flattening | **Not changed.** Agreed as described: consistent on both sides, so not a bug. Now visible in the `tree`-column table in the wiki |
| 7 cleanup playbook | **Done.** It now says a dormant item needs a run at today's HEAD, names `--force`+`--closed-by` for a harness that no longer exists, and forbids the obvious cheat of editing the `verification` field to something trivial |

## Decisions

| Row | Decision |
|---|---|
| `2026-08-21T12:37:42.179Z` | An unreadable `verification.tsv` is a gate failure, not an exception that escapes the run |
| `2026-08-21T12:37:54.676Z` | A receipt is keyed to the working tree as well as the commit — option (b), with (a) rejected because `state set --status done` writes `state.json` itself so the tree is dirty at close by construction, and (c) rejected because it leaves criterion 1 overclaimed |
| `2026-08-21T12:37:54.702Z` | The fingerprint excludes `.mstack/`, and that exclusion is the whole reason it is usable rather than merely correct |
| `2026-08-21T12:38:06.331Z` | Forcing an unverified close requires `--closed-by`, and the stored note is prefixed so a reader can tell |
| `2026-08-21T12:38:06.357Z` | `record` still appends without `withLock`, and the reason is consistency rather than confidence |

## Commands

### Baseline, before any round-2 change

```console
$ npm test 2>&1 | rg "^\s*(\d+ pass|\d+ fail)|ℹ (tests|pass|fail)"
27: 230 pass
28: 0 fail
278:ℹ tests 230
280:ℹ pass 230
281:ℹ fail 0
```

### Finding 1, reproduced by me before the fix

```console
### readable receipt file: the hook blocks
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- 1 perm (verifying) is one step from done, and `true` has not run at a9897f4f; 1 earlier run(s) exist at other commits, and a new commit voids them -> run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check"}}  [exit 0]

### chmod 000, same store, one command later
hook stop exit 0
stdout bytes:        0   stderr bytes:        0

### and the gate itself
[ok]    no sdd item is past specifying
[ok]    no closed items to audit
mstack: EACCES: permission denied, open '.../scratchpad/f1/.mstack/verification.tsv'
gate exit 2
```

Zero bytes and exit 0 is what a green gate looks like. Note also that the gate never reached
`-- workspace` and never printed a summary.

### Finding 1, after the fix

```console
### FINDING 1, after the fix: chmod 000 on the receipt file
hook stop exit 0
stdout bytes:      501, stderr bytes:      387
--- stderr ---
[fail]  1 perm (verifying) is one step from done, and its verification runs could not be read: EACCES: permission denied, open '.../scratchpad/r2f1/.mstack/verification.tsv' -> fix the file or delete it and re-run 'mstack gate --full'; an unreadable record of what ran is not a record that anything did
--- the hook's JSON still parses, alone on stdout ---
The mstack gate is red. Fix these before closing:
- 1 perm (verifying) is one step from done, and its verification runs could not be read: EACCES: permission denied, open '.../scratchpad/r2f1/.mstack/verification.tsv' -> fix the file or delete it and re-run 'mstack gate --full'; an unreadable record of what ran is not a record that anything did

### and the gate reaches its workspace section and its summary

-- workspace
[ok]    on branch feat/x
[ok]    working tree is clean

FAILED - 1 failure, 0 warnings
gate exit 1

### and the close is refused with something a reader can act on
mstack: perm's verification runs could not be read, so nothing here can say whether it was verified: EACCES: permission denied, open '.../scratchpad/r2f1/.mstack/verification.tsv'
        fix the file or delete it and re-run 'mstack gate --full'; an unreadable record of what ran is not a record that anything did
exit 2
```

### Finding 2, reproduced by me before the fix

```console
[ok]    sh check.sh
PASSED - 0 failures, 0 warnings

### the verification is now red, uncommitted. sh check.sh exits 1
[ok]    verification ran and passed at 63086310: sh check.sh
[warn]  1 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 1 warning

1 drift-probe (done)
  status: "verifying" -> "done"
EXIT=0
```

### Finding 2, after the fix — including the usability half

```console
[ok]    sh check.sh
PASSED - 0 failures, 0 warnings

### the verification is now red, uncommitted (sh check.sh exits 1)
[fail]  1 drift-probe (verifying) is one step from done, and `sh check.sh` last ran at c2ef219e against a different working tree, so it does not vouch for the files as they are now
[warn]  1 uncommitted change(s); expected mid-session, not at close
FAILED - 1 failure, 1 warning

### and the close
mstack: drift-probe cannot close on a verification that has not run: `sh check.sh` last ran at c2ef219e against a different working tree, so it does not vouch for the files as they are now
        run 'mstack gate --full' at this commit; closing is the one moment the run has to be real, and --force closes it unverified
EXIT=2

### store churn alone does NOT void it: revert the code, edit the store
[ok]    verification ran and passed at c2ef219e: sh check.sh
PASSED - 0 failures, 1 warning

### the receipt, with the tree it ran against
target       sha                                       command      outcome  ts                        tree
drift-probe  c2ef219e6b92fcf0bb5f0bb117eb810b4c2488a2  sh check.sh  passed   2026-08-21T12:52:29.382Z  clean
```

The last block is the half that decides whether this ships or gets disabled. Reverting the code
edit and then editing the store restores the green: store churn is not code churn, so the check
does not fire on the thing every session does every turn.

### Finding 3, the migration path, end to end

```console
### the gate now names the cause
[warn]  .mstack/verification.tsv is not gitignored, and committing it voids the runs it records: run 'mstack setup' to install .mstack/.gitignore, then 'git rm --cached .mstack/verification.tsv' if it is already tracked
PASSED - 0 failures, 2 warnings

### and the documented recovery works
[ok]    .mstack/.gitignore ready (verification.tsv is machine-local)
0 warnings about it now
?? .mstack/.gitignore
```

### Mutations: 36, all killed, baseline green before and after

Round 1's nineteen re-anchored against the new code, plus seventeen for round 2. Every `R2-*`
entry reverts one round-2 fix to exactly the behaviour the reviewer reproduced at `26b0671`, so
the same run is the "red against the code as it was" evidence for every new test.

```console
=== BASELINE (must be green, or nothing below means anything) ===

 242 pass
 0 fail
M1     src/verification.ts    lastRun keeps the FIRST match instead of the last
       killed (1 of 1 matching "the last run at a commit wins" went red)   (restored ok, sha256 5dc7541370f4)
M2     src/verification.ts    lastRun stops caring which commit the run was at
       killed (1 of 1 matching "a run recorded at an older commit does not carry over" went red)   (restored ok, sha256 5dc7541370f4)
M3     src/verification.ts    lastRun stops caring which command was run
       killed (1 of 1 matching "editing the verification string voids the receipt" went red)   (restored ok, sha256 5dc7541370f4)
M4     src/verification.ts    any recorded run counts, pass or fail
       killed (1 of 1 matching "a recorded failing run keeps the gate red" went red)   (restored ok, sha256 5dc7541370f4)
M5     src/verification.ts    a passing run no longer satisfies the command
       killed (1 of 1 matching "a recorded passing run at this commit turns it green" went red)   (restored ok, sha256 5dc7541370f4)
M6     src/verification.ts    the item's own verification drops out of the obligation list
       killed (1 of 1 matching "both configured commands have to have run" went red)   (restored ok, sha256 5dc7541370f4)
M7     src/verification.ts    the project verify command drops out of the obligation list
       killed (1 of 1 matching "the obligation list is exactly what --full would run" went red)   (restored ok, sha256 5dc7541370f4)
M8     src/verification.ts    an empty obligation list reads as unsatisfied
       killed (1 of 1 matching "closing an item nothing verifies is not blocked by this guard" went red)   (restored ok, sha256 5dc7541370f4)
M9     src/verification.ts    'never ran' and 'ran at another commit' collapse into one message
       killed (1 of 1 matching "a run recorded at an older commit does not carry over" went red)   (restored ok, sha256 5dc7541370f4)
M10    src/gate.ts            the receipt problem becomes a warning instead of a failure
       killed (1 of 1 matching "whose verification never ran is red" went red)   (restored ok, sha256 a11818f53599)
M11    src/gate.ts            the run is demanded from every active status, not just verifying
       killed (1 of 1 matching "nothing before verifying is held to a run" went red)   (restored ok, sha256 a11818f53599)
M12    src/gate.ts            --full runs the commands but records nothing
       killed (1 of 1 matching "--full records what it ran" went red)   (restored ok, sha256 a11818f53599)
M13    src/gate.ts            --full records every run as a pass
       killed (1 of 1 matching "--full records a failure too" went red)   (restored ok, sha256 a11818f53599)
M14    src/gate.ts            --full that ran nothing goes back to warn-and-exit-0
       killed (1 of 1 matching "gate --full is distinguishable" went red)   (restored ok, sha256 a11818f53599)
M15    src/gate.ts            --full also demands a receipt of the run it is about to perform
       killed (1 of 1 matching "--full does not ask for a receipt" went red)   (restored ok, sha256 a11818f53599)
M16    src/gate.ts            the check stays silent when nothing is due
       killed (1 of 1 matching "with no active item the check says so" went red)   (restored ok, sha256 a11818f53599)
M17    src/gate.ts            verifying with nothing configured becomes a hard failure
       killed (1 of 1 matching "with nothing configured warns rather than wedging" went red)   (restored ok, sha256 a11818f53599)
M18    src/cli.ts             the closing guard is consulted and its answer ignored
       killed (1 of 1 matching "an item cannot be closed on a verification that never ran here" went red)   (restored ok, sha256 f0ea8a46bfb5)
M20    src/cli.ts             the guard fires on every status move, not only into done
       killed (1 of 1 matching "only the move into done is guarded" went red)   (restored ok, sha256 f0ea8a46bfb5)
R2-1a  src/gate.ts            F1: the receipt read is unguarded again, as at 26b0671
       killed (1 of 1 matching "an unreadable receipt file is a failure" went red)   (restored ok, sha256 a11818f53599)
R2-1b  src/gate.ts            F1: the same, seen from the checks below it
       killed (1 of 1 matching "does not stop the checks below it" went red)   (restored ok, sha256 a11818f53599)
R2-1c  src/cli.ts             F1: the closing guard's read reports a raw errno again
       killed (1 of 1 matching "an unreadable receipt file refuses the close" went red)   (restored ok, sha256 f0ea8a46bfb5)
R2-2a  src/verification.ts    F2: the receipt certifies a commit again, not a tree
       killed (1 of 1 matching "an uncommitted edit after the run voids the receipt" went red)   (restored ok, sha256 5dc7541370f4)
R2-2b  src/verification.ts    F2: the same, against a modified tracked file
       killed (1 of 1 matching "a modified tracked file voids the receipt too" went red)   (restored ok, sha256 5dc7541370f4)
R2-2c  src/verification.ts    F2: the fingerprint stops excluding the store
       killed (1 of 1 matching "edits inside .mstack/ do not void a run" went red)   (restored ok, sha256 5dc7541370f4)
R2-2d  src/verification.ts    F2: a pre-migration row is blamed on a tree it never had
       killed (1 of 1 matching "before the tree column existed" went red)   (restored ok, sha256 5dc7541370f4)
R2-2e  src/verification.ts    F2: a clean tree is hashed rather than named, so the TSV is unreadable
       killed (1 of 1 matching "the tree fingerprint ignores the store and nothing else" went red)   (restored ok, sha256 5dc7541370f4)
R2-2f  src/git.ts             F2: git() trims porcelain again, so the first line's path parse shifts by one
       killed (1 of 1 matching "edits inside .mstack/ do not void a run" went red)   (restored ok, sha256 fb1d422c2071)
R2-3a  src/gate.ts            F3: a receipt file git would commit is not called out
       killed (1 of 1 matching "a receipt file that git would commit is called out by name" went red)   (restored ok, sha256 a11818f53599)
R2-3b  src/gate.ts            F3: the warning fires even when the store is correctly ignored
       killed (1 of 1 matching "the ignored case says nothing at all" went red)   (restored ok, sha256 a11818f53599)
R2-4a  src/verification.ts    F4: obligations stop trimming, so a whitespace-only verify becomes a command
       killed (1 of 1 matching "the obligation list is exactly what --full would run" went red)   (restored ok, sha256 5dc7541370f4)
R2-4b  src/verification.ts    F4: the match stops normalising, so internal whitespace becomes tolerated
       killed (1 of 1 matching "surrounding whitespace is the same command" went red)   (restored ok, sha256 5dc7541370f4)
R2-1n  src/verification.ts    nitpick 1: identical project and item commands run twice again
       killed (1 of 1 matching "identical project and item commands are one obligation" went red)   (restored ok, sha256 5dc7541370f4)
R2-5a  src/cli.ts             F5: --force closes unverified with no reason demanded
       killed (1 of 1 matching "refused without a reason on the record" went red)   (restored ok, sha256 f0ea8a46bfb5)
R2-5b  src/cli.ts             F5: the reason is stored unmarked, indistinguishable from an ordinary note
       killed (1 of 1 matching "the reason is durable and marked" went red)   (restored ok, sha256 f0ea8a46bfb5)
R2-5c  src/cli.ts             F5: the note is never written to state.json, only printed
       killed (1 of 1 matching "the reason is durable and marked" went red)   (restored ok, sha256 f0ea8a46bfb5)

=== SUMMARY ===
36 mutations, 36 killed, 0 survived, 0 setup errors

=== POST-RUN BASELINE (proves every restore landed) ===

 243 pass
 0 fail
```

Read the driver's closing `git status --porcelain src/` line with care: it lists my *uncommitted
round-2 work*, not a failed restore. The restore proof is the per-mutation sha256, which is
compared against the byte copy taken immediately before that mutation and printed on every line.

**The first run of this driver was 31 of 36, and two of the five gaps were mine, not the code's.**
Both survivors were tests pointed at the wrong behaviour, and finding them corrected two things
I had believed:

- **R2-2f survived**, so my "modified tracked file" test did not pin the `raw` option at all. The
  trim bug does not make the fingerprint miss a code change; it makes it *over-count a store
  change*, because the eaten leading space shifts `.mstack/...` to `stack/...` and the store
  filter stops matching. Re-pointed at `edits inside .mstack/ do not void a run`, where it kills.
  The comment in `src/git.ts` was rewritten to say the true consequence.
- **R2-4a survived**, so `obligations`' `.trim()` is not what makes surrounding whitespace
  tolerated — `cell()` trims on both sides of the comparison, so the match is already immune.
  What that `.trim()` really guards is the empty check: without it a `verify` of `"   "` becomes
  a command. Re-pointed at the obligations test, where it kills.

Three more were setup errors of the same kind — a stale anchor after the rewrite, and two
mutations aimed at tests that were in a different file or did not exist yet (the missing one is
now `tests/cli.test.ts:742`).

### Final state

```console
$ npm test
> bun test tests/ && node --test 'tests/*.test.ts'
 243 pass
 0 fail
ℹ pass 243
ℹ fail 0

$ npm run typecheck
> bunx --bun tsc --noEmit

$ ./bin/mstack lint-plugin . | tail -3
[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
60 relative links checked, 0 broken
```

This repository, verifying itself at `2c61061`:

```console
$ ./bin/mstack gate | tail -6
[ok]    verification-never-runs is in_progress; a verification run is due at verifying

-- workspace
[ok]    on branch feat/verification-never-runs
[ok]    working tree is clean

PASSED - 0 failures, 0 warnings

$ ./bin/mstack gate --full | tail -3
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .

PASSED - 0 failures, 0 warnings

$ column -s$'\t' -t .mstack/verification.tsv | tail -3
verification-never-runs  26b0671d46b655ae82bda50eb9ef1a1c75e9010c  npm test && npm run typecheck && ./bin/mstack lint-plugin .  passed   2026-08-21T12:17:46.438Z
(project)                2c61061500c2269b0810d29e97ec6127120d69bc  npm test && npm run typecheck && bin/mstack lint-plugin .    passed   2026-08-21T12:57:10.948Z  clean
verification-never-runs  2c61061500c2269b0810d29e97ec6127120d69bc  npm test && npm run typecheck && ./bin/mstack lint-plugin .  passed   2026-08-21T12:57:10.948Z  clean
```

The round-1 row has no `tree` value and the round-2 rows do: that is `ensureHeader` widening the
file in place, live, in this store. The old row is voided rather than trusted, and
`tests/gate.test.ts:945` pins the message it produces.

## Round-2 requirement to test

| Finding | Test | `file:line` | Mutation that proves it bites |
|---|---|---|---|
| 1 — unreadable file is a failure, not a green gate | `an unreadable receipt file is a failure, not a green gate` | `tests/gate.test.ts:822` | R2-1a |
| 1 — and the checks below it still run | `an unreadable receipt file does not stop the checks below it either` | `tests/gate.test.ts:847` | R2-1b |
| 1 — the closing guard says what it is refusing | `an unreadable receipt file refuses the close, and says what it is refusing` | `tests/cli.test.ts:742` | R2-1c |
| 2 — an uncommitted edit voids the run, and reverting restores it | `an uncommitted edit after the run voids the receipt` | `tests/gate.test.ts:878` | R2-2a |
| 2 — the same for a modified tracked file | `a modified tracked file voids the receipt too, leading space and all` | `tests/gate.test.ts:909` | R2-2b |
| 2 — store churn does **not** void a run | `edits inside .mstack/ do not void a run, or the gate would be red every turn` | `tests/gate.test.ts:926` | R2-2c, R2-2f |
| 2 — a pre-migration row says what it is | `a run recorded before the tree column existed says so rather than blaming a tree` | `tests/gate.test.ts:945` | R2-2d |
| 2 — the fingerprint itself | `the tree fingerprint ignores the store and nothing else` | `tests/verification.test.ts:242` | R2-2e |
| 3 — an unignored receipt file is named, with both commands | `a receipt file that git would commit is called out by name` | `tests/gate.test.ts:963` | R2-3a |
| 3 — and silent when correctly ignored | `the ignored case says nothing at all, on the path that runs every turn` | `tests/gate.test.ts:985` | R2-3b |
| 4 — the whitespace boundary, both directions | `surrounding whitespace is the same command; internal whitespace is not` | `tests/verification.test.ts:180` | R2-4b (the reviewer's M12) |
| 5 — `--force` alone is refused | `--force on an unverified close is refused without a reason on the record` | `tests/cli.test.ts:662` | R2-5a |
| 5 — the reason is durable and marked | `--force with a reason closes it, and the reason is durable and marked` | `tests/cli.test.ts:677` | R2-5b, R2-5c |
| nitpick 1 — dedupe | `identical project and item commands are one obligation, not two runs` | `tests/verification.test.ts:220` | R2-1n |

## Where each round-2 claim stopped on the ladder

| Claim | Rung | What got it there |
|---|---|---|
| Finding 1 was real: the unreadable file turned a red hook silently green | 5 | My own repro before any fix — `hook stop` 0 bytes exit 0, `gate` EACCES exit 2 with no summary |
| Finding 1 is fixed: the hook blocks, the JSON still parses alone on stdout, the gate finishes | 5 | Same store, shipped `bin/mstack hook stop` as a real process; 501 bytes of parseable JSON, 387 on stderr |
| Finding 2 was real: a green receipt survived an edit that broke the command, and the item closed | 5 | My own repro before any fix, exit 0 throughout |
| Finding 2 is fixed, **and store churn still does not void a run** | 5 | Scratch store: code edit → red; revert code, edit `.mstack/` → green again |
| Finding 3's warning fires on a pre-change store and clears after `mstack setup` | 5 | Store built without `.mstack/.gitignore`, through the shipped binary |
| The tree key does not break this repository's own gate | 5 | `./bin/mstack gate --full` green at `2c61061`, two rows recorded `clean`, tree still clean afterwards |
| Every round-2 behaviour is enforced by code rather than prose | 4 | 243 tests on bun and node; 36 mutations, all killed, baseline green before and after, restores byte-verified |
| `record` under concurrency can lose a row | **3** | Unchanged from the reviewer's finding: the `ensureHeader` window is real, 8 of 8 concurrent runs lost nothing. Not settled, and not written up as settled |
| A store on a filesystem that refuses the **write** reports usefully | **2** | Still only read and typechecked. The read path is now rung 4; the write path is not, and I am not claiming otherwise |
| Whether Claude Code renders a hook's stderr to a person | **2** | Unchanged since item 16 |

## For the reviewer, round 2

1. **Process, and it is worse than round 1.** Round 1 landed as five ordered commits. Round 2's
   code landed as **one** (`db80ca9`), because the fixes interleave inside the same functions and
   splitting them cleanly needed per-hunk staging, which is not available here. I did not rewrite
   history to fake it. The docs are a separate commit; the code is not separable after the fact.
2. **The dedupe does not help this store**, because `state.verify` says `bin/mstack lint-plugin .`
   and item 14's `verification` says `./bin/mstack lint-plugin .`, so every `gate --full` here
   still runs the suite twice. Aligning them is a one-character edit to `state.json` and it is
   store data, not code — I left it rather than editing the item under review. Worth doing.
3. **`--closed-by` is now mandatory on a forced unverified close only.** Every other use of
   `--closed-by` and of `--force` is untouched. If you would rather it were a `decisions.tsv`
   row, that is the reviewer's alternative and it is a larger change: `decide` writes a row and
   `state set` would have to compose with it.
4. **Finding 6 stands.** Both ledger rows for this item are `--verifier implementer`, and a third
   one at the round-2 head is too. None of them can close it, by design.
5. **One transcript in this report was wrong when first written**, and I caught it re-running the
   command rather than trusting what I had typed: the third receipt row's target is
   `verification-never-runs`, not `(project)`. Recording it because a pasted-output rule that
   only holds when nobody slips is not a rule.

---

# Round 3 — response to the second CHANGES_REQUESTED

Reviewed at `85c2311`. Three items left: A blocking, B and C required, D carried. All three
addressed; **A was reproduced by me first, at rung 5, before any fix**, and the coordinator's
invitation to answer with a measurement instead of a change was taken up for one sub-question
and declined for the main one, with numbers either way.

## What changed

The tree key now hashes **contents**. The first version hashed `git status --porcelain`, whose
lines are two status characters and a path, so it keyed on *which* files were dirty — and if the
tree was already dirty when `--full` ran, which is the ordinary mid-session state, every further
edit inside those same paths moved nothing. `treeId` now hashes `git diff HEAD` for tracked
paths plus a content hash per untracked file, both scoped by a pathspec that removes every
`.mstack/` in the repository. `git diff HEAD` alone would not have been enough: it never
mentions untracked files, so an untracked `check.sh` edited after a green run would have been
the same hole a fourth time. Alongside that, the sampling order is pinned by a test whose
verification really does write into the repository (finding B), an `unknown` tree now warns that
only the commit half of the key was checked (finding C), and the three statements that asserted
the guarantee the old key did not provide — the module docstring, the runtime message, and
`State-Files` — now say what is actually compared.

## The measurement, since it decided the design

Three candidates, timed on a synthetic 30k-file repository with 500 modified and 200 untracked
files, three runs each, matching the reviewer's methodology so the numbers are comparable:

```console
$ tracked files: 30000   dirty: 500   untracked: 200
status --porcelain            : 50 ms      <- what the old version paid
diff HEAD                     : 58 ms
ls-files -o | hash-object     : 34 ms
temp-index write-tree         : 638 ms
```

And each one against the reproduced case — an edit inside an already-dirty path:

```console
A: porcelain=ff9c205520ad  diffHEAD=b8cdfcfcef03  writeTree=28c6ec89f3f5dca5
B: porcelain=ff9c205520ad  diffHEAD=7641246219f1  writeTree=d4c33f825a95d0d8
```

`write-tree` is equally complete and **twelve times** the cost, and it writes loose objects into
`.git` as a side effect of a read-only check. `diff HEAD` plus untracked hashing is complete for
the same set of files at 92ms, the same order as the `git status` that was already being paid.
That is the trade, decision `2026-08-21T13:24:06.143Z`.

The end cost, measured on both repositories after the change:

```console
$ fast gate, this repository
in_progress (as it stands): 57 ms      <- treeId does not run
verifying   (treeId runs): 88 ms

$ treeId alone
this repo (clean)                      20 ms   -> clean
30k files, 500 dirty, 200 untracked   109 ms   -> 48cac967c5d5ff91
```

31ms extra on this repository, about 110ms on a 30k-file one, and only inside the `verifying`
window. Criterion 3 holds with numbers rather than with an argument.

## Finding by finding

| # | Verdict | What landed |
|---|---|---|
| A BLOCKING | fixed, not deferred | `treeId` hashes content (`src/verification.ts:118-206`). Four tests, five mutations. The three statements that overclaimed are corrected in all three places |
| B REQUIRED | fixed | `tests/gate.test.ts:976` runs a verification that appends to `build.log` and asserts the next fast gate is green. Kills the corrected N10 (`R3-B1`). The "permanently red" overstatement in the comment is fixed too — a second `--full` recovers, and the comment now says so |
| C REQUIRED | fixed, warn not refuse | `src/gate.ts:499-511` warns whenever the computed tree is `unknown`. `tests/gate.test.ts:1001`, mutation `R3-C1`. Decision `2026-08-21T13:24:19.151Z` records why warn rather than refuse |
| D CARRIED | still the closing pass's | A fresh implementer row is recorded at the round-3 head; it cannot close the item, which is the point |
| nit 1 | fixed | A later `--closed-by` no longer erases the forced-close marker (`src/cli.ts:583-586`), pinned both ways: the marker survives, and an ordinary note is **not** marked |
| nit 2 | fixed | One `closed_by` change line on a forced close, not two |
| nit 3 | resolved as a side effect | `treeId` no longer runs `git status --porcelain` at all, so the duplicate read the nit named is gone. The fast gate at `verifying` now runs `status` once (in `checkWorkspace`) plus `diff` and `ls-files` |
| nit 4 | nothing to change | The concurrency rung stays recorded as rung 3 |
| nit 5 | agreed, still store data | `state.verify` and item 14's `verification` still differ by a `./`. Named again below for the closing pass |

## Where I answered with a measurement instead of a change

The coordinator offered that route explicitly. I used it once, and it is the honest outcome
rather than a dodge.

**Three mutations survive, and all three are equivalent mutants — measured, not asserted.**

`R3-C2` (drop the newline guard) and `R3-A4` (drop the hash-count check) each survive *alone*,
because each masks the other. I built the fixture that separates them — an untracked path
`two<newline>lines.js` in a store where `two` and `lines.js` also exist, so
`hash-object --stdin-paths` **succeeds**, returning two hashes for one listed path — and ran the
three variants through the real `treeId`:

```console
shipped        -> unknown
R3-C2 alone    -> unknown            (newline guard removed; count check still there)
C2 + A4 both   -> b93263a7d6dcf356   (both removed: a real-looking fingerprint that quietly ignores a file)
```

So the pair is load-bearing and each half is redundant given the other. `R3-CA` removes both and
**is** killed, by `tests/verification.test.ts:329`, which now uses that exact fixture.

`R3-C3` (drop the `raw` option) survives, and my own comment justifying `raw` was wrong. I
claimed it was load-bearing for `ls-files -z` because trimming would eat the trailing NUL and a
trailing space with it. Measured:

```console
ls-files raw : "trailing space  "
ls-files trim: "trailing space  "
ls-files differ? false
diff differ? true | raw ends "+b\n" trim ends "\n+b"
JS trim treats NUL as whitespace? false
```

JS `trim()` stops at the NUL, so it never reaches the space. The diff *does* differ, but both
sides of every comparison call the same function, so nothing observable changes. `raw` is kept —
hashing content that has been silently trimmed is wrong in principle and free to avoid — and the
comment now says at rung 4 that no current behaviour distinguishes it, instead of claiming it is
load-bearing. `-z` on `ls-files` genuinely is load-bearing, for the different reason that without
it git quotes special paths and a quoted path is not the path.

## Commands

### Baseline, before any round-3 change

```console
$ npm test 2>&1 | rg "^\s*(\d+ pass|\d+ fail)|ℹ (tests|pass|fail)"
27: 243 pass
28: 0 fail
291:ℹ tests 243
293:ℹ pass 243
294:ℹ fail 0
```

### Finding A, reproduced by me before the fix

```console
### precondition: the tree is ALREADY dirty when --full runs
 M check.sh
[ok]    sh check.sh
PASSED - 0 failures, 1 warning
receipt: e5ab4f4c9929cb0b

### the verification is now RED (sh check.sh exits 1), same porcelain line:
 M check.sh
[ok]    verification ran and passed at 53204f38: sh check.sh
PASSED - 0 failures, 1 warning

1 probe (done)
  status: "verifying" -> "done"
EXIT=0
```

### Finding A, after the fix — the same three commands

```console
### tree ALREADY dirty when --full runs
 M check.sh
[ok]    sh check.sh
PASSED - 0 failures, 1 warning
receipt tree: d4f2a660d12bcfb2

### verification now RED; porcelain line is IDENTICAL:
 M check.sh
[fail]  1 probe (verifying) is one step from done, and `sh check.sh` last ran at dffbcbb9, and an uncommitted file has changed since
FAILED - 1 failure, 1 warning

mstack: probe cannot close on a verification that has not run: `sh check.sh` last ran at dffbcbb9, and an uncommitted file has changed since
        run 'mstack gate --full' at this commit; closing is the one moment the run has to be real, and --force closes it unverified
EXIT=2
```

### The untracked variant, which `git diff HEAD` alone would have missed

```console
[ok]    sh helper.sh
PASSED - 0 failures, 1 warning
porcelain:  M .mstack/state.json;?? helper.sh;
porcelain after:  M .mstack/state.json;?? helper.sh;  <- identical
git diff HEAD bytes: 301  <- untracked never appears in it
[fail]  1 probe (verifying) is one step from done, and `sh helper.sh` last ran at dffbcbb9, and an uncommitted file has changed since
FAILED - 1 failure, 1 warning
```

### Finding C, live

```console
### finding C: an index git cannot read
rev-parse still works: dffbcbb9
[warn]  git could not describe the working tree, so only the commit half of the verification key was checked; an uncommitted change since the run would not be noticed
FAILED - 1 failure, 2 warnings
```

### Mutations: 35, 32 killed, 3 measured-equivalent, baseline green both sides

Round 1 and round 2 guarantees are re-run here as well, because `treeId` was rewritten wholesale
and "I did not break what was already pinned" is a claim that needs measuring.

```console
=== BASELINE (must be green, or nothing below means anything) ===

 252 pass
 0 fail
...
R3-A1   src/verification.ts   A: the fingerprint goes back to WHICH paths are dirty, not what is in them
        killed (1 of 1 matching "editing an already-dirty tracked file voids the receipt" went red)   (restored ok, sha256 734324435544)
R3-A2   src/verification.ts   A: untracked contents drop out, leaving only their paths
        killed (1 of 1 matching "editing an already-dirty untracked file voids it too" went red)   (restored ok, sha256 734324435544)
R3-A3   src/verification.ts   A: untracked paths drop out of the pairing, so two empty files are one state
        killed (1 of 1 matching "which untracked files exist is part of the tree" went red)   (restored ok, sha256 734324435544)
R3-A4   src/verification.ts   A: a mismatched hash count is paired up anyway
        SURVIVED   (restored ok, sha256 734324435544)
R3-B1   src/gate.ts           B: the tree is sampled BEFORE the commands, so a run voids its own receipt
        killed (1 of 1 matching "does not void its own receipt" went red)   (restored ok, sha256 6f993c0c4749)
R3-C1   src/gate.ts           C: an unknown tree is passed over in silence again
        killed (1 of 1 matching "a tree git cannot describe is said out loud" went red)   (restored ok, sha256 6f993c0c4749)
R3-C2   src/verification.ts   C: a newline in an untracked path is hashed partially instead of refused
        SURVIVED   (restored ok, sha256 734324435544)
R3-C3   src/git.ts            C: raw dropped, so ls-files -z loses its trailing NUL and diff loses whitespace
        SURVIVED   (restored ok, sha256 d3ce7acf59f9)
R3-CA   src/verification.ts   C+A: BOTH the newline guard and the hash-count check removed - the pair, which is not equivalent
        killed (1 of 1 matching "a newline in an untracked path" went red)   (restored ok, sha256 734324435544)

=== SUMMARY ===
35 mutations, 32 killed, 3 survived, 0 setup errors
  R3-A4: SURVIVED / restored ok
  R3-C2: SURVIVED / restored ok
  R3-C3: SURVIVED / restored ok

=== POST-RUN BASELINE (proves every restore landed) ===

 252 pass
 0 fail
Per-mutation sha256 above is the restore proof; the diff below is this round's uncommitted work.
(clean)
```

**The first run of this driver was 29 of 34, and two of the five gaps were mine again.** The one
that mattered: my `R3-B1` moved `treeId` into the *recording* loop, which still runs after every
command — so it did not reproduce finding B at all and its survival meant nothing. Corrected to
sample before the execution loop, it is killed by the new test. `R3-A3` and `R3-C3` were pointed
at a test that could not distinguish them, which is how the two missing fixtures above were
found: two untracked files with **identical** contents under different names, and a filename
ending in a space. Both are now real tests rather than re-pointings.

### Final state

```console
$ npm test
 252 pass
 0 fail
ℹ pass 252
ℹ fail 0

$ npm run typecheck
> bunx --bun tsc --noEmit

$ ./bin/mstack lint-plugin . | tail -2
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
60 relative links checked, 0 broken
```

## Round-3 requirement to test

| Finding | Test | `file:line` | Mutation |
|---|---|---|---|
| A — a content edit inside an already-dirty **tracked** path voids the receipt | `editing an already-dirty tracked file voids the receipt, though its status line does not move` | `tests/gate.test.ts:920` | R3-A1 |
| A — the same for an **untracked** path, which `git diff` never mentions | `editing an already-dirty untracked file voids it too, which git diff alone would miss` | `tests/gate.test.ts:944` | R3-A2, R3-A4 |
| A — *which* untracked files exist is part of the tree, not only their bytes | `which untracked files exist is part of the tree, not just what is in them` | `tests/verification.test.ts:287` | R3-A3 |
| A — an awkward filename does not silently disable the key | `an untracked filename ending in a space is still fingerprinted` | `tests/verification.test.ts:314` | (equivalent; `-z` is what earns it) |
| A/C — a path that cannot be hashed unambiguously is refused, not partly hashed | `a newline in an untracked path yields an unknown tree, not a partial one` | `tests/verification.test.ts:329` | R3-CA |
| B — the sampling order | `a verification that writes into the repository does not void its own receipt` | `tests/gate.test.ts:976` | R3-B1 |
| C — the disabled half is named | `a tree git cannot describe is said out loud, not passed over in silence` | `tests/gate.test.ts:1001` | R3-C1 |
| nit 1 — the marker survives a later note | `a later note cannot quietly erase the forced-close marker` | `tests/cli.test.ts:723` | R3-N1, R3-N3 |
| nit 1 — and an ordinary note is not marked | `an ordinary note is not marked, so the marker keeps meaning something` | `tests/cli.test.ts:753` | R3-N2 |

## Where each round-3 claim stopped on the ladder

| Claim | Rung | What got it there |
|---|---|---|
| Finding A was real: a content edit inside an already-dirty path left the gate green and the item closed | 5 | My own repro before any fix, through `./bin/mstack`, exit 0 throughout |
| Finding A is fixed, for tracked **and** untracked paths | 5 | The same three commands after the fix: `[fail]` and a refused close, in both variants |
| `git diff HEAD` does not cover untracked contents | 5 | 301 bytes of diff that never mention `helper.sh`, in the transcript above |
| Content hashing costs 92ms where `write-tree` costs 638ms | 5 | Synthetic 30k-file repo, three runs each, both distinguishing the repro |
| The cost stays bounded, and only inside the `verifying` window | 5 | 57ms against 88ms on this repository; `treeId` alone 20ms here and 109ms at 30k files |
| Finding C's warning fires, and stays silent when git answers | 5 | Unreadable `.git/index` with `rev-parse` still working |
| Finding B's ordering is now pinned | 4 | A verification that appends to `build.log`; R3-B1 kills it |
| The three surviving mutants are equivalent, not gaps | 4 | Each variant run through the real `treeId` on a fixture built to separate them; the pair `R3-CA` is killed |
| Nothing round 1 or round 2 pinned was weakened by rewriting `treeId` | 4 | Their mutations re-run against this head, all still killing |
| `raw` is not load-bearing today | 4 | Measured on both calls; my own comment claiming otherwise is corrected |
| Losing a receipt row under concurrent `gate --full` | **3** | Unchanged: the `ensureHeader` window is real, 8 of 8 concurrent runs lost nothing |
| A store on a filesystem that refuses the receipt **write** reports usefully | **2** | Still only read and typechecked. Not claimed as more |
| Ignored files are correctly outside the fingerprint | **2-3** | `--exclude-standard` and the pathspec, read and reasoned; a `.gitignore`d edit not voiding a receipt was mapped live by the reviewer in round 2, not re-run by me |

## For the reviewer, round 3

1. **Commits are three this round** — code, docs, and the report — rather than round 2's one.
   Better than round 2, still not round 1's five; the code commit is one because the content
   hashing, the warning and the sampling comment all sit inside the same two functions.
2. **Three mutants survive and I am calling them equivalent rather than fixing them.** The
   evidence is above and it is rung 4, not an argument. If you disagree with the equivalence for
   `R3-C3` specifically, the honest alternative is to delete the `raw` option rather than keep an
   option nothing can distinguish.
3. **Untracked *directories*.** `git ls-files -o` lists files, not directories, so an empty
   untracked directory is not in the fingerprint. Nothing a verification can execute lives in an
   empty directory, so I left it; recording it because it is the kind of gap this item keeps
   finding one layer in.
4. **Still store data, still not mine to edit**: `state.verify` says `bin/mstack lint-plugin .`
   and item 14's `verification` says `./bin/mstack lint-plugin .`, so the dedupe does not fire
   here and every `gate --full` in this repository still runs the suite twice.
5. **Finding D stands.** Every ledger row for this item is `--verifier implementer`, including
   the one recorded at this head.
