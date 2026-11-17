# Implementation report: intake-followups (item 73)

Branch `fix/intake-followups`, base `07646f6`, code head `d757279`. No mstack plugin was loaded in this session; I played the implementer from `agents/implementer.md` and `skills/test-first/SKILL.md`. Every CLI call was `./bin/mstack` (`mstack 0.2.1 at /Users/romerma/Code/mstack`). Scratch material lives under `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl73/` (`streams/` holds every live stream, `projects/` every sandbox copy).

## 1. Findings and whether they reproduced

| Finding | Reproduced? | How |
|---|---|---|
| r3 N-2, `--resolves` rule not loaded when a fresh session answers | Yes, by construction | Base `SKILL.md` step 3 skips intake for a session that brings answers, and the rule lived only in `intake.md`. No live rerun on the old text; the review's B2/B3 streams are the old-text evidence. After the change, b-2 and b-4 (below) never read `intake.md` and still wrote one row. |
| r3 N-3, Closing resets a parked note | Yes (text) | Base `SKILL.md:153-155` resets `current.md` unconditionally. |
| r3 N-4, fork test stated three ways | Yes (text) | Map row, `if wrong:` sentence and Autonomy clause had three reaches, and "however cheap" trailed the irreversible clause. |
| r3 N-5, step 2 circular; skip list misses a parked item | Yes (text) | Base step 2 reads `current.md` only "if it records a parked fork"; skip list says "an item in flight", and a parked item is `pending`. |
| r3 N-6, over-parking at the margin | Not a defect to fix | The review itself found no run that stopped only for a settled choice. The new reach (a message, label or format that follows what the project prints is reversible) covers its example; no extra change. |
| r3 N-7, docs | Yes | `The-CLI.md` said a fork is found "after intake"; `How-A-Work-Item-Flows.md` defined a fork by "two answers produce different work". CHANGELOG did not carry the order, the cheap-choice rule or the note. |
| step.md N-6, nothing pins the router step, header, licence | Yes, on the real CLI | On base `fef6690` (archive in `impl73/base`), deleting the router's step 3, the intake origin header, a licence file, misspelling the agent skill, or adding `disable-model-invocation: true` all print `PASSED - 0 failures, 0 warnings`. |
| test-first N-1, `state active` cannot give seams | Yes, on the real CLI | `state add --seam ...` then `state active` printed `no active item`, `[exit 1]`. `state show` does not exist: `mstack: unknown 'state' subcommand 'show'`. |
| test-first N-2, mutants sentence false | Yes | `git grep -i -E "mutant\|mutation" fef6690 -- agents skills ':!skills/test-first'` is empty. |
| test-first N-3, refactor not covered | Yes (text) | Base `:48` and `:60-61`. |
| test-first N-5, lint misses the wiring | Yes | Same base run as step.md N-6 (typo and hidden skill both PASSED). |
| test-first N-6, nothing moves to `in_progress` | Yes | `git grep in_progress fef6690 -- skills agents` returns only `agents/orchestrator.md:29`. Live: the first run on the new text (a-2) already moved it, so the fix is observed rather than only read. |
| test-first N-7, wording invites bulk tests | Yes, live | Run a-2, on my first wording ("requires the first test run red"), got a brief saying "write the tests first, run ..., paste the red output". I reworded and reran (a-3). |
| test-first N-9, wiki counts | Yes | `Skills-and-Playbooks.md:7` "all thirteen skills"; there are 14 `SKILL.md` files (13 commands + `test-first`). |

## 2. What changed

Commits on the branch, in order (`git log fef6690..HEAD`):

```
fcc505b feat(lint): fail on a broken origin header, a router without intake and an unresolved preloaded skill
6d37402 fix(router): state the fork test once, carry the resolves rule in the parked note and move an item to in_progress
4a943f2 fix(skills): name where seams are read, ask for the first test red and cover a refactor the brief asks for
4adcdf1 docs: describe forks as intake defines them and count the skills correctly
d757279 fix(router): name the decide flags a parked fork's answer row needs
```

Sizes: `intake.md` 77 lines (was 77), `skills/test-first/SKILL.md` 60 (was 61), `skills/router/SKILL.md` 157 (was 156). No em dash added (`git diff fef6690 HEAD -- . ':!.mstack' | rg -c '^\+.*\x{2014}'` prints nothing).

### Prose, final wording

`skills/router/references/intake.md` (Map, criterion 3; the test is stated once, here):
- Fork row: "its answers change what the product's user can do or get (what is charged, allowed, refused, stored, deleted or returned as a value, including an exit code a script would branch on), or it cannot be undone. A cheap code change makes neither one reversible".
- Reversible row: "the user's result is the same either way (where code lives, names, structure, internal approach), or only a message, label or format differs and follows what the project already prints".
- `if wrong:` sentence: "if it names lost data or fails the fork test above, this is a fork, not a row."
- Park a fork (criterion 1): "First write into `current.md`'s Next step the slug, its open forks and this rule, so a fresh session finds them: answer every fork in ONE row, `mstack decide --phase intake --resolves <slug> --decision "1) <answer> 2) ..." --why .. --evidence "<their words>" --result "<chosen>"`."
- End (criterion 8): "Then, with no fork open: `mstack state set <slug> --status in_progress`, or `--status specifying` on the spec path (an `sdd` item, or answered forks). A parked item stays `pending` until answered."

`skills/router/SKILL.md`:
- Step 2: "`mstack state active`, and read `.mstack/progress/current.md` (the SessionStart hook already printed it unless it is the empty template). If it records work in flight or a parked fork, resume its recorded next step rather than starting over." Not circular: the read is unconditional, the hook makes it free.
- Skip list: "resuming an item in flight, answering a parked fork, a request that names an existing item, ...".
- Autonomy: "product forks, as the Map in [references/intake.md](references/intake.md) defines them."
- Closing step 3: "reset `current.md` to its empty template, unless it records a parked fork."

Why `specifying` on the spec path (criterion 8, true on both paths). Scratch repo `impl73/cli`:

```
$ state set a --status in_progress        (plain item)        -> exit 0
$ state set b --status in_progress        (sdd item)          -> exit 0, then gate:
[fail]  sdd item b is in_progress but has no spec at .../.mstack/specs/b
$ state set c --status in_progress        (open fork)         -> mstack: c has an unanswered decision ... exit 2
$ state set c --status specifying                              -> exit 0
```

`pending` goes to `specifying` or `in_progress` (`src/lifecycle.ts:86`), but an `sdd` item at `in_progress` with no spec fails the gate, so the spec path takes the first.

`skills/router/playbooks/feature.md` step 4 (criterion 9), final: "Read the item's `seams` array in `.mstack/state.json` (`mstack state active` prints only the slug) and write them into the brief as pre-agreed ... An item that changes behaviour but has no seams gets them first: `mstack state set <slug> --seam "..."`, repeated, because it replaces the list. `skip: no behaviour` is only for a change with none, and you still delegate. The brief asks for the first test only, run red for the expected reason with the output pasted, before any code; the rest follow one slice at a time." (`state set --seam` replacing the list was checked on the CLI: a second `--seam` call dropped the first. `state show` does not exist, so the "once item 74 adds it" alternative is left out.)

`skills/test-first/SKILL.md` (criterion 10): the mutants sentence is deleted; `:48` now reads "No restructuring beyond what the test or the brief asks for"; "When it does not apply" now reads "A change with no behaviour (...), or a refactor the brief asks for that is pinned by characterization tests, has no new test to write first." The origin header's "Adapted:" clause says "refactoring is left to review unless the brief asks for it".

Docs (criteria 6, 12): `CHANGELOG.md` (new Unreleased bullet), `docs/wiki/The-CLI.md` (the "Attaching a product fork after intake" opening), `docs/wiki/How-A-Work-Item-Flows.md` (definition of `decision_required`), `docs/wiki/Skills-and-Playbooks.md` ("all fourteen skills (thirteen commands and one internal reference)").

### Code: `src/lint.ts`, `tests/lint.test.ts`

Rule set chosen (smallest that fails the five breaks):
1. Provenance: every `<!-- Origin: ... -->` under `skills/` names at least one `licenses/<file>` and each named file exists; files in `ORIGIN_REQUIRED` (declared once: `intake.md`, `test-first/SKILL.md`) must carry a header when present. One list, no licence names hard-coded.
2. Router: if `skills/router/SKILL.md` exists, its `## First, orient` section links `references/intake.md` (the Autonomy link elsewhere does not count).
3. Agents: each `skills` entry names a skill under `skills/` with no `disable-model-invocation: true`; `mstack:` entries are resolved, entries namespaced to another plugin are ignored; an agent with no `skills` field is not touched.

`tests/lint.test.ts` `copy()` now copies `licenses/` too (otherwise the clean-tree test would fail).

## 3. Red output (test-first)

Mutant table written before the code (the one in section 4 is its executed form, plus rows added after the first run). Red outputs, for the expected reason (the rule does not exist, so a broken tree passes):

```
AssertionError: missing licence: expected a failure, got a pass
(fail) an origin header that names a licence file the plugin does not ship is caught
AssertionError: header without a licence: expected a failure, got a pass
(fail) an origin header that names no licence file is caught
AssertionError: header removed: expected a failure, got a pass
(fail) a file that must carry an origin header and does not is caught
 16 pass / 3 fail                         (impl73/red1.txt)

AssertionError: intake step removed: expected a failure, got a pass
(fail) a router whose orient steps no longer link intake.md is caught
 20 pass / 1 fail                         (red2.txt)

AssertionError: misspelt preloaded skill: expected a failure, got a pass
(fail) an agent whose skills entry names no skill under skills/ is caught
AssertionError: hidden preloaded skill: expected a failure, got a pass
(fail) an agent that preloads a skill with disable-model-invocation: true is caught
 23 pass / 2 fail                         (red3.txt)
```

Green after each rule: 19/0, 21/0, 25/0. Slice granularity was coarser than the reference asks (three tests of rule 1 written together, then the rule); each red was read and failed for the expected reason before code.

## 4. Mutant table (applied by script, `impl73/mut.py`, each reverted)

| # | Mutant | Result |
|---|---|---|
| M1 | licence existence check dropped (missing licence passes) | killed |
| M2 | no-licence check dropped | killed |
| M3 | `ORIGIN_REQUIRED` emptied | killed |
| M4 | `ORIGIN_REQUIRED` keeps only intake.md | **survived at first**; test now loops over both files; killed |
| M5 | router rule searches the whole file, not the orient section | killed |
| M6 | router rule never fails | killed |
| M7 | unknown skills entry not reported | killed |
| M8 | hidden skill not reported | killed |
| M9 | another plugin's entry not ignored | killed |
| M10 | own-plugin prefix not stripped | **survived at first**; test `mstack:test-frist` added; killed |
| M11 | agent with an empty/absent `skills` field fails | killed |
| M12 | skills rule not called | killed |
| M13 | absent router fails | killed |

Final run: all 13 killed. The decision row for the rule set says "hand-applied"; they were applied by script, as above.

## 5. VERIFY

1. Suite and gates, at code head `d757279`, no live run going (item 67's two tests passed on every run):

```
$ npm test            (bun half) 552 pass, 0 fail, "Ran 552 tests across 26 files. [88.89s]"
                      (node half) ℹ tests 552 / ℹ pass 552 / ℹ fail 0
$ bun test ./tests    552 pass, 0 fail   [90.87s]
$ bun run typecheck   $ bunx --bun tsc --noEmit        (no output, exit 0)
$ ./bin/mstack lint-plugin .       (provenance) [ok] 2 origin header(s), each naming a licence file that ships
                                   (router)     [ok] the router's orient steps link references/intake.md
                                   PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate                PASSED - 0 failures, 1 warning   (the warning: uncommitted .mstack rows, mid-session)
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md      96 relative links checked, 0 broken
$ ./bin/mstack lint-plugin examples/notes-cli     FAILED - 1 failure, 4 warnings   (same as at base: it is not a plugin, no plugin.json)
```

The last commit (this report and the ledger row) touches only `.mstack/`.

2. The five breaks in scratch copies (`impl73/rm/<name>`, `impl73/removals.sh`, `removals.txt`), each run with that copy's `./bin/mstack lint-plugin .`:

```
== base       PASSED - 0 failures, 0 warnings
== router     [fail]  skills/router/SKILL.md: the orient steps do not link references/intake.md        FAILED - 1 failure
== header     [fail]  skills/router/references/intake.md: no origin header                               FAILED - 1 failure
== licence1   [fail]  skills/test-first/SKILL.md: origin header names licenses/obra-superpowers-LICENSE.txt, which does not exist
              [fail]  skills/router/references/intake.md: origin header names licenses/obra-superpowers-LICENSE.txt, which does not exist
== licence2   (same for licenses/mattpocock-skills-LICENSE.txt)                                          FAILED - 2 failures
== typo       [fail]  agents/implementer.md: skills entry 'test-frist' names no skill under skills/      FAILED - 1 failure
== hidden     [fail]  agents/implementer.md: skills entry 'test-first' has disable-model-invocation: true, so it is not preloaded
```

The same five on base `fef6690` all print `PASSED - 0 failures, 0 warnings`.

3. Live runs. Wrapper `impl73/run.sh` as in the intake review's Probe C: fresh copy of `sandbox/bench/template`, `git init` and a commit, this checkout's `setup`, `state.verify = python3 -m unittest discover -s tests`, committed; `env -i` rebuilt from HOME USER LOGNAME TERM LANG TMPDIR SHELL PATH (+ bun and claude bin dirs), no ANTHROPIC_*; `claude -p "<prompt>" --model opus --output-format stream-json --verbose --setting-sources project --strict-mcp-config --max-budget-usd 6 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto`. Init event: plugin `mstack`, `permissionMode: auto`, `claude-opus-5-5`, claude 2.1.326. Streams outside the projects. No claude or watcher process of mine is left running (`pgrep` empty).

#### a (criteria 8, 9): `/mstack add a \`count\` command: ...` fully specified

Attempts:
- a-1: killed by my watcher at 60 s, a false positive: it matched the text `mstack:implementer` inside the playbook the run had just read. Discarded.
- a-2 (feature.md as first edited, "requires the first test run red"): did what 8 wants, but the brief said "write the tests first, run `python3 -m unittest discover -s tests`, and paste the red output" (N-7 reproduced on my wording). My watcher raced and exited, so the run went on; I killed it after a second implementer was launched (it set a second item `in_progress` and the gate went red with "2 items are active", which the agent repaired with `--status blocked`; see Found, not fixed). Changed: feature.md step 4 now says "the first test only ... the rest follow one slice at a time".
- a-3 (final feature.md). Stream `streams/a-3.jsonl`; killed 4 s after the implementer launch. Excerpt:

```
TOOL Bash | git checkout -b feat/count-command && mstack decide --phase intake --decision "count reuses BookingService.list(room) via a thin BookingService.count; unknown room is not validated" ... && mstack state add --slug count-command --title "Add count CLI command" --acceptance ... (3) --source "user request 2026-11-17: add a count command" --seam 'CLI: `python3 -m bookings count [--room ROOM]` stdout and exit code (cli.main with injected service/out/err)' --seam "App: BookingService.count(room=None) return value" && mstack state set count-command --status in_progress && mstack state active
  RESULT> Switched to a new branch 'feat/count-command' / recorded / added 1 count-command (pending) / 1 count-command (in_progress) / status: "pending" -> "in_progress" / count-command
TOOL Agent (mstack:implementer) | ... Seams (pre-agreed, do not ask to confirm): CLI `cli.main([...], service=..., out=..., err=...)` stdout and return code; `BookingService.count(room=None)` return value.
   ... Process: write the first test only, run it red for the expected reason, paste that output in your report, then implement slice by slice. ...
```

`state add` is followed by `in_progress` with no wrong status name (`rg -c "status active"` on the stream: 0). Seams: the item's seams were put into the brief as pre-agreed and the run's `current.md` says "seams pre-agreed in state.json". Honest limit: it did not read them back from `state.json` (it had just written them), and the "behaviour but no seams, run `state set --seam`" branch was not exercised live. n=1.

#### b (criteria 1, 2, 4): `/mstack let guests join a waitlist for a room that is booked on their dates, and when a booking is cancelled give the freed dates to the first guest waiting.`

Attempt 1 (b-1, b-2; final text except the `--why/--evidence/--result` hint added afterwards). Session 1: success, 6 turns, $0.314, 59.8 s, four numbered forks, ended the turn. `current.md` afterwards (not reset, criterion 2): "room-waitlist has 4 open forks ... When answers arrive, record ALL in ONE row: `mstack decide --phase intake --resolves room-waitlist --decision "1) ... 4) ..."` ... A partial answer gets a plain decide row, no --resolves." Session 2, NEW session, prompt only `room-waitlist: 1 yes, book them automatically. 2 yes, skip to the next guest whose whole stay is free. 3 yes, in queue order. 4 no, leave those two bugs for later.`:

```
TOOL Bash | mstack decide --phase intake --resolves room-waitlist --decision "1) auto-book promoted guest on cancel 2) skip to next guest whose whole stay is free 3) multiple promotions per cancel, in queue order 4) do not fix cancel-persistence and closed-interval overlap bugs now; defer" && mstack state set room-waitlist --status specifying
  RESULT> mstack: resolving a fork needs --result: what the answer actually is
  (two more refused attempts: --evidence empty, then ...)
  RESULT> recorded, and room-waitlist no longer has an open fork / 1 room-waitlist (specifying) / status: "pending" -> "specifying"
```

`decisions.tsv` ends with one row whose decision column lists all four answers; `state.json` has `decision_resolved`. The run never read `intake.md` (checked in the tool inputs) and the SessionStart context carried `current.md`. Killed 45 s after the `--resolves` call.
What it did next: moved to `specifying`, read the code to write the spec. It took three attempts because the note did not name `--why/--evidence/--result`, so I added them to the note (last commit, no extra line).

Attempt 2 on the final text (b-3, b-4): session 1 success, 7 turns, $0.319, 74 s, five forks; `current.md` Next step: "Answer every fork in ONE row: `mstack decide --phase intake --resolves room-waitlist --decision "1) <answer> 2) ..." --why .. --evidence "<their words>" --result "<chosen>"`." Session 2, new session, prompt `room-waitlist: yes to 1, 2 and 3. 4 yes, fix both bugs. 5 no, skip the list command as well.`:

```
TOOL Bash | mstack decide --phase intake --resolves room-waitlist --decision "1) yes: ... 2) yes: ... 3) yes: ... 4) yes: ... 5) no: no 'waitlist list' command; leaving the waitlist stays out of scope" --why "user answered all five forks" --evidence "yes to 1, 2 and 3. ..." --result "1-4 as recommended; 5 declined ..."
  RESULT> mstack: resolving a fork needs --why to say something; got 28 characters
TOOL Bash | (same, longer --why)   RESULT> recorded, and room-waitlist no longer has an open fork
TOOL Bash | mstack state set room-waitlist --status specifying
TOOL Skill | mstack:spec  (args room-waitlist)
```

One row listing all five answers, `--resolves` on it, one refusal for a 28-character `--why` (the CLI's own length floor), then the spec skill. I wrote "three forks" in the brief; the model parked four and five, and I answered all of them, which tests the same rule. n=2.

#### c (criterion 7): one small request with one fork, run to the end twice

Request: `/mstack add a $25 cleaning fee to every stay. quote and book should both include it in the total they print.`

Attempts:
- c-answered-1 / c-direct (a "long-stay discount" request): both parked two to three forks even with the percentage written in the request (compounding with `--discount-percent`, rounding), so neither was a one-fork request. Costs $0.277 and $0.271, discarded.
- Cleaning-fee request. It parks two forks (discount applies to the fee? stored bookings?), not one; I answered both.
  - Answered path: c2-answered-1 (intake and park), c2-answered-2 (`cleaning-fee: yes to 1, yes to 2`), c2-answered-3 (a third message, see below). Two earlier launches of c2-answered-2 went to the wrong directory because of two bugs in my wrapper and were killed within seconds; their streams are deleted and their cost is not counted.
  - Direct path: c2-direct-2, request plus " The --discount-percent option of quote applies to the room nights only, not to the fee, and bookings already saved keep the totals they have." Intake parked nothing and the run went `in_progress` straight away.
  - c2-direct (only the first fork answered in the request, the second taken as a reversible decision): $1.33, 304 s, 19 turns, 2 subagents; extra data point.

| | Answered, spec path (3 sessions) | Direct (1 session, answer in the request) |
|---|---|---|
| Cost (USD, result events) | 0.246 + 1.790 + 1.400 = **3.436** | **1.125** |
| Wall time (sum of `duration_ms`) | 39 + 316 + 331 = **686 s** | **296 s** |
| Turns | 6 + 22 + 13 = **41** | **15** |
| Subagent launches | 4 (spec-author, spec-reviewer, implementer, reviewer; plus 4 SendMessage rounds, the spec went through 3 review rounds) | 2 (implementer, reviewer) |
| Ended | item `done`, on main, reviewer approved | item `done`, on its branch, reviewer approved |
| Ratio answered/direct | cost 3.1x, wall 2.3x, turns 2.7x, subagents 2x | |

Caveats. n=1 per arm. The answered path stopped at `spec_ready` in session 2 asking about a worktree (`origin/main` missing, the sandbox has no remote), so session 3 is a nudge from me ("base it on local main ... carry on to the end"): that is $1.40 and a user message the direct path did not need, but its spec cost ($1.79 for the second session, mostly spec author and reviewer rounds) is the larger part either way. Both finished with a reviewer's approval, and I did not compare the code quality of the two results. Round 3 of item 55's review (`review_intake-step_r3.md`, Probe B) holds a partial observation; this table replaces it only for a request this size.

Recommendation (not taken): narrow the rule so an item whose forks were answered goes direct, and the spec path stays for `sdd`, several subsystems, or a user stepping away. On a request of this size the answer already is the acceptance criterion, and the spec path tripled the cost for no result the direct run lacked. The counter-case this does not measure is a larger change where a spec reviewer would catch something. The rule is kept in this item, as decided; the decision row is recorded (`--phase implement`), pending the user's answer.

## 6. Decisions recorded

Three `--phase implement` rows in `.mstack/decisions.tsv`: criterion 7 (rule kept, narrowing recommended), the lint rule set, and `specifying` rather than `in_progress` on the spec path.

## 7. Found, not fixed

- `state set --seam` replaces the whole list (checked; feature.md now says so). `state show` does not exist (item 74).
- `decide --resolves` refuses a `--why` under about 30 characters; both runs hit refusals before succeeding. The CLI messages are clear; not changed.
- a-2: a coordinator that finds a second bug and opens a second item sets it `in_progress` while the first is active, and the gate goes red (one active item). It recovered with `--status blocked`. The router does not say how to park an item when a blocker needs its own item.
- c2-answered-2: the spec path ends needing a `mstack worktree` and an `origin/main`; a repository with no remote stops there and asks the user. Not a text bug in this item, but it is a real stop on the answered path.
- Sandbox agents added `Co-Authored-By` trailers to commits in their sandbox copies (they have no commit rules in those projects). Sandbox only.
- Router step 3 and `orchestrate` still tell an agent to "copy playbook steps into the todo list"; the runs wrote them into `current.md`. Known (r3 N-8), not this item.

## 8. Per criterion

| # | Criterion | Evidence | Rung |
|---|---|---|---|
| 1 | answering session has the `--resolves` rule; one row for all forks | Note carries the rule (`intake.md:36-41`); b-2 (4 forks) and b-4 (5 forks), fresh sessions, one row each, no `intake.md` read | 5 (n=2, model behaviour) |
| 2 | Closing does not reset a parked note | Closing step 3 clause (`SKILL.md:153-155`); b-1 and b-3 ended the turn with `current.md` intact. Not exercised through a session that tries to close with a parked fork | 2 for the clause, 5 for the park turns |
| 3 | fork test once; labels, messages, exit codes agree | Map row and reversible row in `intake.md`; the `if wrong:` sentence and Autonomy clause point at it. Live: no wrong-reach run; the cleaning-fee and waitlist runs parked product forks and took internal ones | 2 (text) plus 5 (n=4 runs behaved) |
| 4 | step 2 not circular; skip list names answering a fork | `SKILL.md:18-24`; b-2 and b-4 skipped intake when answering | 5 (n=2) |
| 5 | lint fails on router step, header, licences | `lint.ts`, 8 tests, 13 mutants killed, the 5 breaks fail with a cause, the same 5 pass on base | 4 |
| 6 | docs describe forks as intake does | CHANGELOG bullet, `The-CLI.md`, `How-A-Work-Item-Flows.md`; doc link check green | 2 (prose) |
| 7 | cost measured, rule kept with decision recorded | table in section 5c; row recorded | 5, n=1 per arm, a nudge in the answered arm |
| 8 | End moves to `in_progress`, no guess | `intake.md:58-59`; a-3, c2-direct-2, c2-direct moved to `in_progress` with no `--status active` guess; the spec path ran through `specifying` in c2-answered-2 and b-2/b-4; CLI behaviour for both paths checked in the scratch repo | 5 (n=3 direct, n=3 spec), 4 for the CLI facts |
| 9 | feature.md seams, no-seam rule, first test red | `feature.md:15-22`; a-3 brief says "write the first test only, run it red". a-2 on the older wording reproduced the bulk wording. Seams were not read back from `state.json` and the no-seams branch was not exercised live | 5 (n=1) for the first test red, 2 for the rest |
| 10 | test-first drops sentence, covers a refactor; no growth | `SKILL.md` 61 to 60 lines, text above | 2 |
| 11 | lint on agent `skills` entries | see 5; `typo` and `hidden` breaks fail naming the cause, pass on base | 4 |
| 12 | wiki counts skills | `Skills-and-Playbooks.md:7`, 14 `SKILL.md` files (`fd SKILL.md skills`) | 4 |

Unproven: that the narrower fork wording changes behaviour at the margin (no run sat at the margin); that a session which tries to close with a parked fork keeps the note; that seams are read from `state.json` when the item came from an earlier session; the quality difference between the two paths in 5c.

Verdict I earned: `test-verified`. The code is at rung 4 and every check is green at `d757279`; the prose criteria are rung 5 with n between 1 and 3 and are model behaviour.
