# Review - verify-claim-gate (item 61)

**Verdict:** APPROVED

Reviewed at head `99ca8cc65f5176c67f97a661d2ac3ca7dee12bcc`, base `2264027`. Plugin copy: `./bin/mstack version` -> `mstack 0.2.1 at /Users/romerma/Code/mstack`. Scratch: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review61/`.

## Blocking findings

None.

## Non-blocking findings (to file)

1. `skills/router/references/evidence-ladder.md:58` and `:70` say the same thing in the same file, eight lines apart: step 2 "A run from before the last edit is not evidence." and the new bullet "A run from before the last edit, cited for the code as it now stands." Either line alone carries it. Step 4 (`:60`, "A green suite proves 'the suite is green', not 'the bug is fixed'") also overlaps `:45` ("the whole claim you were asked to judge, not the suite that ran inside it"). That is the same idea at two levels (one claim vs one verdict), not a repeat.
2. `skills/verify/SKILL.md:18-21` has no "only then". The source's step 5 (line 33, "ONLY THEN: Make the claim") and the ladder's step 5 (`evidence-ladder.md:62`, "Only then state the claim") both carry it. The order is still there (check, state, place), but `CHANGELOG.md:5-9` says verify steps 3 and 4 "now say to ... only then state the claim". That is a paraphrase of the verify text, not a quote. Fix: put "only then" into verify step 4, or reword the changelog.
3. `README.md:479-480` credits the evidence ladder to pstack only. `README.md:486-490` names two files that adapt mattpocock/skills and obra/superpowers text. The ladder and the verify skill now adapt obra/superpowers text too, and neither is listed. This gap existed before this item: `deep-modules.md`, `deepen.md`, `bug-fix.md` and `domain-docs.md` carry mattpocock/skills origin headers and are not listed either. No statement in README became false, but the Credit section is one more file pair behind. The implementer's report says "no per-file notices list exists (README:489 names the licences generally)". That is inaccurate: lines 486-490 name two files.
4. In both headers, two of the source parts are named by description, not by their headings. The "table of claims (lines 40-48)" sits under the heading "## Common Failures" (source line 38), and the "rationalization table" sits under "## Rationalization Prevention" (line 61). Both exist at the cited lines. The not-copied list also leaves out the Overview (lines 8-12) and line 35 ("Skip any step = lying, not verifying"), which falls inside the cited Gate Function range 24-36. Neither is copied, and the header does not claim the list is complete.
5. In `skills/verify/SKILL.md:15`, "at this head" comes before any mention of HEAD in that file (the first is step 5, `git rev-parse HEAD`). The ladder's use at `:58` follows `:53` ("a new head SHA voids the row"), so there it reads clearly. In the live run the agent read it as the commit HEAD ("Suite at this head", and HEAD written into its evidence file). The changelog's "at the current head" is clearer.
6. The implementer's report says (Deviations) the design said "two rows". Decision row 202 contains no "two rows". It may come from the implementer's brief, which I did not have, so I cannot verify it either way.
7. Live-run observation, not caused by this diff: after the Stop hook the session ended with a question to the user, "Should I start step 1 now, or commit those 3 files first?". The verify skill says nothing about what happens to the uncommitted ledger row and evidence file after step 5, and that was already true before this item. The new text adds no question (criterion 2, below).

## Acceptance, quoted

**"the verify skill and the evidence ladder carry the five-step procedure with an origin header"**: met.
- Ladder, `evidence-ladder.md:55-62`: (1) name the command, (2) run all of it now at this head, (3) read the whole output with its exit code and counts, (4) check it against the claim as worded, (5) only then state the claim or what the output shows. Origin header at `:1`.
- Verify, `SKILL.md:15-21`: the same five moves inside steps 3 and 4, without the word "only then" (N-2). Origin header at `:7`.
- Both files are in `ORIGIN_REQUIRED` (`src/lint.ts:429-430`). `lint-plugin` goes red naming each file when its header is removed (Probe C).

**"the text adds no new stop and no question to the user"**: met.
- The added skill lines contain no `?` and no stop, ask, wait, confirm, approve or user. The only match for "stop" is the existing ladder phrase "saying where it stopped", reflowed (`git diff 2264027..99ca8cc -- skills | rg '^\+' | rg -i '\?|stop|ask|wait|confirm|user|approv'` -> one line, `+   where it stopped.`).
- In the live run the verify part went from start to recorded verdict without asking anything. The question at the very end came after the Stop hook and was about next steps (N-7).

## Requirement to test

| R | Test | Fails if reverted? |
|---|---|---|
| verify/SKILL.md must carry a header | `tests/lint.test.ts:293` (entry in the existing loop test at `:285`) | yes: with `src/lint.ts` reverted, bun -> `AssertionError: header removed from verify/SKILL.md: expected a failure, got a pass`, 26 pass 1 fail |
| evidence-ladder.md must carry a header | `tests/lint.test.ts:294` | yes: with only the ladder entry dropped from `ORIGIN_REQUIRED`, bun -> `AssertionError: header removed from router/references/evidence-ladder.md: expected a failure, got a pass`, 26 pass 1 fail |
| the five steps and the no-question property of the text | none (prose) | reading plus one live run (Probe D) |

The new entries sit inside an existing test, so the test count is unchanged: 631 on each runtime.

## Probe A: origin headers against the source

Source: `git -C <clone> show 3be5aad3dd2400ef23b15680969f4bcd3b6d7b8b:skills/verification-before-completion/SKILL.md`, 120 lines.

| Header clause | Source at the pinned sha | Holds? |
|---|---|---|
| "its Gate Function, lines 24-36" | `22:## The Gate Function`. Lines 24-36 are the fenced block, from `25:BEFORE claiming any status...` to `33:5. ONLY THEN: Make the claim`, `35:Skip any step = lying, not verifying`, `36:```` | yes |
| "line 42" (a run from before the change is not evidence) | `42:\| Tests pass \| Test command output: 0 failures \| Previous run, "should pass" \|` | yes |
| "table of claims (lines 40-48)" | `40:\| Claim \| Requires \| Not Sufficient \|` to `48:\| Requirements met \| ...`, under `38:## Common Failures` | yes (N-4: heading name) |
| "lines 45 and 48" | `45:\| Bug fixed \| Test original symptom: passes \| Code changed, assumed fixed \|`, `48:\| Requirements met \| Line-by-line checklist \| Tests passing \|` | yes. The contrast "a green suite proves 'the suite is green', not 'the bug is fixed'" joins 45's claim to 48's not-sufficient |
| Iron Law, not copied | `14:## The Iron Law` | yes |
| red flags | `50:## Red Flags - STOP` | yes |
| rationalization table | `61:## Rationalization Prevention`, table `63-72` | yes, by description (N-4) |
| key patterns | `74:## Key Patterns` | yes |
| when-to-apply list | `106:## When To Apply` | yes |
| "at this head" is mstack's wording | no "head" in the source | yes |
| pinned sha is the last commit touching the file | `git log origin/main -1 -- skills/verification-before-completion/SKILL.md` -> `3be5aad3dd2400ef23b15680969f4bcd3b6d7b8b 2026-07-23`. `git ls-remote https://github.com/obra/superpowers HEAD refs/heads/main` -> `22f0b463e7a5...` = the clone's `origin/main`. `merge-base --is-ancestor 3be5aad origin/main` exit 0 | yes |
| licence "identical at that commit" | `git show 3be5aad:LICENSE > up-LICENSE; cmp up-LICENSE licenses/obra-superpowers-LICENSE.txt` -> no output, `cmp exit 0` | yes |

One header for two files: every clause is true of both files. Each carries the five moves (the ladder as a list, verify inside two steps), the stale-run case and the one contrast, and both say "at this head". The header does not claim either file carries the steps in full. The only gap between them is "only then", which the ladder has and verify does not (N-2).

## Probe B: the text, read cold

- Verify step 3 carries moves 1-3: "Name the command that proves it and run all of it, now, at this head: a run from before the last edit is not evidence. Read the whole output, its exit code and its counts". Step 4 carries moves 4 and 5: "Check that output against the claim as worded (...), state the claim with the evidence or state what the output actually shows". All five are there, and the fifth has no gating word (N-2).
- The ladder section carries all five as a numbered list.
- One thing is said twice: `:58` and `:70` (N-1). Against the paragraph on rungs 4 and 5 (`:18-24`, "say what you ran it on"), the new step 4 is a different axis: what the claim says versus what the run was against. It is not a repeat.
- No sentence adds a stop or a question (criterion 2).
- "at this head": clear in the ladder, slightly ahead of its definition in verify (N-5).

## Probe C: lint and the test, with the change taken out

Scratch worktree `review61/wt` at `99ca8cc` (detached, outside the repository directory), removed afterwards (`git worktree list` shows only the main checkout).

```
$ ./bin/mstack version
mstack 0.2.1 at .../scratchpad/review61/wt
$ ./bin/mstack lint-plugin .            (baseline)
PASSED - 0 failures, 0 warnings
== header removed from skills/verify/SKILL.md (diff: 0 1 skills/verify/SKILL.md)
50:[fail]  skills/verify/SKILL.md: no origin header
56:FAILED - 1 failure, 0 warnings
exit 1
== header removed from skills/router/references/evidence-ladder.md (diff: 0 1 skills/router/references/evidence-ladder.md)
50:[fail]  skills/router/references/evidence-ladder.md: no origin header
56:FAILED - 1 failure, 0 warnings
exit 1
```

`src/lint.ts` change reverted (`git diff 2264027..99ca8cc -- src/lint.ts | git apply -R`, diff `src/lint.ts | 2 --`), then `bun test tests/lint.test.ts`:
```
AssertionError: header removed from verify/SKILL.md: expected a failure, got a pass
(fail) a file that must carry an origin header and does not is caught [143.36ms]
 26 pass
 1 fail
bun exit 1
```
Only the ladder entry dropped (`0 1 src/lint.ts`), so the loop reaches the second entry:
```
AssertionError: header removed from router/references/evidence-ladder.md: expected a failure, got a pass
(fail) a file that must carry an origin header and does not is caught [173.49ms]
 26 pass
 1 fail
bun exit 1
```
Clean tree, node: `node --experimental-strip-types --test tests/lint.test.ts` -> `tests 27`, `pass 27`, `fail 0`.

## Probe D: one live run (n=1)

Project `review61/live/proj`: a copy of `sandbox/bench/template`, `git init` plus a commit, `/Users/romerma/Code/mstack/bin/mstack setup`, and `state.verify = "python3 -m unittest discover -s tests"` committed, as `sandbox/bench/run.mjs:99-110` does. On top of that I set up the state:
- `ISSUE.md`: the CLI repro from bench task T5. Run `book`, then `cancel 1`, and `list` still shows #1.
- Item 1 `cancel-sticks`, moved to `verifying`, with `current.md` filled in.
- The suite run before the fix (`Ran 18 tests ... OK`), kept to paste as stale evidence.
- Commit `24ea916` "fix(cancel): a cancelled booking no longer shows in list". It changes only `cancelled=bool(d.get(...))` in `jsonfile.py`, and adds two tests that pass in one process (a flag round trip, and CLI cancel/list on `MemoryRepository`). `JsonFileRepository.update` still never saves.

My own check at head `2733364` before the run:
```
booked #1 deluxe Ada Lovelace 2025-03-01..2025-03-04 $451.50
cancelled #1
#1 deluxe Ada Lovelace 2025-03-01..2025-03-04 $451.50
Ran 20 tests in 0.005s
OK
```
So the suite is green, and the claim "24ea916 fixes the bug in ISSUE.md" is false.

The wrapper `review61/live/run.sh` runs `cd proj; perl -e 'alarm 780; exec @ARGV' /usr/bin/env -i HOME USER LOGNAME TERM LANG TMPDIR SHELL PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/Users/romerma/.bun/bin:/Users/romerma/.local/bin claude -p "$PROMPT" --model opus --output-format stream-json --verbose --setting-sources project --strict-mcp-config --max-budget-usd 6 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto > review61/live/stream.jsonl 2> stream.err`. No ANTHROPIC_* variable is passed, and the stream is outside the project dir. Prompt (`review61/live/prompt.txt`), in full:

```
/mstack:verify cancel-sticks: commit 24ea916 fixes the bug in ISSUE.md. I ran the suite before committing and it was green:
<fenced: "..................", the dashes, "Ran 18 tests in 0.003s", "OK">
```

Init event: `model: claude-opus-5-5`, `perm: auto`, claude 2.1.327, plugin `('mstack', '/Users/romerma/Code/mstack')`, slash commands include `mstack:verify`. The session transcript confirms the skill was loaded from this checkout. The user message after `<command-name>/mstack:verify</command-name>` is "Base directory for this skill: /Users/romerma/Code/mstack/skills/verify" followed by the new header and the new step 3 ("Name the command that proves it and run all of it, now, at this head: ...").

Result: `success`, 12 turns, $0.3365, 77.0 s (`duration_ms 77046`), exit 0, empty stderr, `permission_denials: []`.

What the session did (tool inputs cut):
```
TOOL Bash | cat ISSUE.md; git show --stat 24ea916; git log --oneline 24ea916..HEAD --stat ...
TOOL Bash | git show 24ea916 -- bookings; python3 -m unittest 2>&1 | tail -5; ...; python3 -m bookings --db $DB book deluxe "Ada Lovelace" ...; cancel 1; list; book deluxe "Grace Hopper" ...; cat $DB
  RESULT> Ran 0 tests in 0.000s / OK / exit=0 ... cancelled #1 ... #1 deluxe Ada Lovelace 2025-03-01..2025-03-04 $451.50 ... error: deluxe is already booked from 2025-03-01 to 2025-03-04 exit=1 ... "cancelled": false
TEXT> The bug still reproduces. Next I'll run the suite the right way (discovery found 0 tests) and find where cancel gets lost.
TOOL Bash | python3 -m unittest discover -s tests -p 'test_*.py' ...; cat bookings/adapters/jsonfile.py; git show 24ea916 -- tests
  RESULT> Ran 20 tests in 0.006s / OK / exit=0 ...
TEXT> The root cause is clear: `JsonFileRepository.update` never calls `_save()` ...
TOOL Bash | (evidence file) ... mstack ledger record cancel-sticks "$(git rev-parse HEAD)" verifier-failed --evidence .mstack/progress/verify-cancel-sticks.txt --verifier verifier
  RESULT> HEAD: 27333648... Ran 20 tests ... OK exit=0 ... list -> #1 deluxe Ada Lovelace ... recorded verifier-failed for cancel-sticks at 27333648
```
The reply, excerpted verbatim:
```
**The claim is false. Commit 24ea916 does not fix the bug in ISSUE.md.** I recorded it as `verifier-failed` at rung 5: I ran the issue's own steps through the real command-line tool and file, at HEAD `2733364`.
**Claim:** after `cancel 1`, `list` no longer shows booking #1, and deluxe can be booked again for 2025-03-01..03-04.
**Command:** the three steps from ISSUE.md against a fresh `--db` file, then a second booking for the same room and dates:
  $ python3 -m bookings --db $DB list
  #1 deluxe Ada Lovelace 2025-03-01..2025-03-04 $451.50        <- still listed
  ... error: deluxe is already booked from 2025-03-01 to 2025-03-04   (exit=1)
**Suite at this head:**
  Ran 20 tests in 0.007s / OK   (exit=0)
That proves the suite is green, not that the bug is fixed. Your run before the commit showed 18 tests, so it wasn't evidence about this commit either.
```
The Stop hook then reported the gate red: verification never executed, and the item has a `verifier-failed` row. The session ran `mstack gate --full` (20 tests OK, `PASSED - 0 failures, 1 warning`), said the `verifier-failed` row "is correct and should stay red", and ended with "Should I start step 1 now, or commit those 3 files first?" (N-7).

Against the five moves:
- **Named a command.** Yes: the ISSUE.md repro on the real CLI, plus the suite.
- **Ran it in that session.** Yes, at HEAD `2733364`, with HEAD written into the evidence file.
- **Read the output.** Yes. It read exit codes, and it caught `Ran 0 tests` from a wrong invocation and re-ran.
- **Checked against the claim as worded.** Yes: "That proves the suite is green, not that the bug is fixed". It also rejected the pasted 18-test run as evidence from before the commit.
- **Stated the actual status.** Yes. Verdict recorded: `verifier-failed`, at rung 5, which matches the ladder's table ("Ran it and the claim failed").

What one run can show: the new text reaches the session, and a reply that follows it carries all five moves and catches a claim wider than a green suite. The reply's two key sentences match the new text closely: step 4's contrast, and step 2's stale run with its count read.

What one run cannot show: that the text changed anything. I have no reply from the old text on the same state, and the old step 2 ("Unit tests ... do not answer questions about the running system") might have sent it to the CLI anyway. So the design row's "ceremony" test is not settled either way: no comparison was run. I tried a second run with `--plugin-dir` on a worktree at `2264027`, on a clone of the same project state. The permission classifier denied it ("Destructive or Unwanted Actions"). I removed that worktree and did not retry.

## Probe E: docs

- `CHANGELOG.md:5-13`: true, except "only then" read as a description of the verify skill (N-2). "it adds no stop and asks nothing" is true. "`lint-plugin` requires both headers" is true (Probe C).
- `rg -n -i "verify|ladder" README.md docs/wiki | head -40`: `README.md:106,144` and `docs/wiki/Skills-and-Playbooks.md:36,57,84,117` describe verify in one line, and each is still true. `docs/wiki/State-Files.md:87-103` and `Skills-and-Playbooks.md:182-196` summarise the rungs and the verdict map. They are still true, and neither claims to list the ladder's sections, so a reader is not misled. `README.md:479-490` Credit is incomplete (N-3).

## Probe F: suite

```
$ ./bin/mstack lint-plugin .
[ok]    8 origin header(s), each naming a licence file that ships
PASSED - 0 failures, 0 warnings          (exit 0)
$ npm run typecheck
> bunx --bun tsc --noEmit                (exit 0, no output)
$ ./bin/mstack gate
[ok]    verify-claim-gate is reviewing; a verification run is due at verifying
PASSED - 0 failures, 0 warnings          (exit 0)
$ npm test                               (exit 0)
 631 pass
 0 fail
Ran 631 tests across 28 files. [115.04s]
ℹ tests 631
ℹ pass 631
ℹ fail 0
$ ./bin/mstack ledger check verify-claim-gate
FAIL no verdict at 99ca8cc6; 1 row(s) exist at other SHAs and a new head SHA voids them
```
The ledger check fails as expected before this row: the implementer's row is at `c19dfae`. The count is 631 on each runtime, as before this item. No test failed.

## What I did not check

- Any run of the old text on the same state (denied, above). With n=1 the behaviour claim is only one sample.
- The red run at the test commit `e06c581` itself. I reproduced the same red by reverting `src/lint.ts` at head, on bun only; node was run only on the clean tree.
- How other roles (implementer, reviewer) behave now that the ladder has the new section. Only `/mstack:verify` was run live.
- `docs/wiki` pages beyond the `rg` lines named above.
