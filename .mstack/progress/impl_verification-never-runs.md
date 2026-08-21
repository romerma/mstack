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
the boundary test the first mutation round demanded, `db00832` docs, `028e3bd` changelog.

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
does not carry the other), `:171` (the store `.gitignore`).

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
