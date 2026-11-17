# Review - intake-step

**Verdict:** CHANGES_REQUESTED

Reviewed `b9a12f7..daacfbf` (`daacfbffb03c61709963aa12d2b8f0e129198983`), 13 product files. One blocking finding: the partial-answer instruction for a multi-fork item, followed in one of its two readings, silently marks an unanswered fork as answered, and the CLI then lets the item go to `in_progress` with the gate green on decisions. The seams code, the provenance and the live intake behaviour held up under every probe I ran.

## Blocking

**B-1. `skills/router/references/intake.md:33-36` - a partly answered fork list can slip past the gate.**

The reference says one `--decision-required` string carries all forks, "one `decide --resolves <slug>` row answer them all", and "If the user answers only some, re-state the field with the rest." It does not say how the partial answer is recorded or in which order. `state set --decision-required` clears `decision_resolved` (`src/cli.ts:712-717`), and `decide --resolves` sets it (`src/cli.ts:884-888`) without knowing which forks the row covers. So the order decides the outcome:

- Resolve, then re-state (order A): correct. The re-state clears the pointer, the rest reads as open, `--status in_progress` is refused.
- Re-state, then record the partial answer with `--resolves` (order B): `decide` prints "fee no longer has an open fork" while fork 2 is open, `state set --status in_progress` succeeds, and the gate's decision check says `[ok]`.

Command and output (order B, real CLI, throwaway store `probeB/orderB`):

```
$ mstack state add --slug fee --title Fee --acceptance quote includes the fee --decision-required 1) Should the fee be discounted along with the nights? Recommended: no, because a flat fee is a fixed cost. 2) Should the fee show as its own line in quote output? Recommended: yes, because a guest should see what they pay for.
added 1 fee (pending)
[exit 0]
$ mstack state set fee --decision-required 2) Should the fee show as its own line in quote output? Recommended: yes, because a guest should see what they pay for.
1 fee (pending)
  decision_required: "1) Should the fee be discounted along with th..." -> "2) Should the fee show as its own line in quo..."
[exit 0]
$ mstack decide --phase intake --decision 1) yes: the fee is not discounted; 2) still open --why the user answered fork 1 in the chat on 2026-11-17 and left fork 2 for later --evidence user reply in session: 'yes to 1, I need to think about 2' --result fork 1 answered no-discount; fork 2 open --resolves fee
recorded, and fee no longer has an open fork
[exit 0]
[ok]    1 open item(s) with a decision fork, each answered or still in specifying
PASSED - 0 failures, 1 warning
$ mstack state set fee --status in_progress
1 fee (in_progress)
  status: "pending" -> "in_progress"
[exit 0]
[ok]    1 open item(s) with a decision fork, each answered or still in specifying
FAILED - 1 failure, 1 warning
in_progress | 2) Should the fee show as its own line in quote output? Recommended: yes, because a guest should see what they pay for. | 2026-11-17T08:46:12.829Z
```

The one gate failure is unrelated (`progress/current.md` still the empty template for an active item); the decision check passes with fork 2 open at `in_progress`. A user who answers some of the forks is the ordinary case: the implementer's own interactive run produced 13 questions. Criterion 4 depends on the field staying a guard.

What would make it pass: `intake.md` states the order and the rule. For example: "Record the answers you have with `mstack decide --resolves <slug>`, then re-state the field with only the unanswered forks; the re-state clears the answer pointer, so the rest reads as open. Never pass `--resolves` for a partial answer after the re-state." Better still, also guard it in code or pin it with a test (order A: `state set --status in_progress` exits 2 after the re-state). Either way, rerun order B against the new prose and show that following it cannot reach `in_progress` with a fork open.

## Non-blocking

- **N-1. The skip list leaves out review, verify, ship and investigate** (`skills/router/SKILL.md:20-23`; the only examples are "a commit message, a cleanup"). In the live runs, commit and investigate skipped with a one-line reason. Review skipped intake without the one-line note. The `mstack:review` skill then registered and activated an item itself, because `fanout plan` needs an active item. That second part is the review skill's behaviour, not this item's. Naming those routes in the skip clause would close the gap.
- **N-2. After parking the fork, the live run stopped without copying the playbook into a todo list** (no `TodoWrite` in the stream, and no `skip:` line for step 4). The prose does not say whether intake ending on a fork ends the turn or whether step 4 and work the fork does not block (understand, the spec while in `specifying`) continue. The run's reply also said it would "hand the work to the implementer" after the answer, while `SKILL.md:55-63` puts a `decision_required` item on the spec path. Unverified as behaviour, because the run stopped there. Only `sdd` items have a spec gate today.
- **N-3. More than three forks in autonomous mode.** `intake.md:31-37` puts every fork in one round. `SKILL.md:99` caps questions at three, except in interactive mode. A request with four forks puts the two rules in conflict. Say which wins.
- **N-4. Seams writes report less than the values they replace.** `--clear seams` prints only `seams: 1 seam(s) -> (unset)` (`src/cli.ts:227`, `preview`), while `--seam` names every seam it drops. `state set --seam` on an item with none prints `seams: 0 seam(s) replaced with 2` and not the new values, although the test is titled "adds them and prints them" (`tests/seams.test.ts:89-99` asserts only the count). Mutant X7 below shows the count line itself is unpinned when the counts match.
- **N-5. A hand-edited `seams: []` or `seams: [""]` is accepted** by `parseItem` (`src/state.ts:189-192`), while the CLI refuses an empty `--seam`. Real output: `--- seams = []` -> `state list` exit 0, gate `[ok] state.json parses and has the right shape`. The same for `[""]`.
- **N-6. Criterion 5 and the router step are pinned by nothing executable.** Mutants P1 (delete the router's intake step), P2 (delete the origin header) and P3 (delete a licence file) leave both halves of the suite and `lint-plugin` green (table below). Candidates for a lint rule (close to item 31). A prose step being live-verified rather than tested is normal here, so this is not a block.
- **N-7. Orchestrate:** `intake.md:56-58` hands a program of work to orchestrate, and "all forks of one request go on the item" does not say what happens when the forks of one request land on several items. They should still reach the user once.
- **N-8. `docs/wiki/The-CLI.md:249`** re-wraps a line that already had an em dash, so the house rule is still broken on a touched line. The dash itself predates this item.
- **N-9. Nothing prints an item's `seams` or `source`** except `state.json` (`state list` shows label and title). The implementer already noted this.
- **N-10. Load-sensitive tests** `tests/costs.test.ts:698` and `tests/run.test.ts:239` failed in some of my runs while other suites or claude sessions ran. Also seen: a `spawnSync` with no timeout at `tests/launcher.test.ts:59` that hung once. Both belong to item 67 and do not come from this diff. My quiet-machine run on the head is green (probe F).

## Acceptance, quoted

| # | Criterion | Met? | Evidence | Rung |
|---|---|---|---|---|
| 1 | "the router runs intake between orient and copying the playbook, and it ends with mstack state add carrying acceptance derived from the request, a source, and the test seams" | Met | `SKILL.md:20-28` (step 3 between orient and playbook). C1: orient call, then intake, then `state add` with 3 criteria, `--source`, 2 `--seam`. No test pins the step (P1 survives, N-6). | 5 (n=1, on a sandbox copy of the bench template) |
| 2 | "intake finds facts in the repository and its documents and never asks the user for one" | Met | `intake.md:15`. C1 looked up the pricing path, stored totals and tests, ran the suite, and asked only the fork. | 5 (n=1 unmodified request; model behaviour, not enforced) |
| 3 | "a reversible decision is taken with its recommended answer and recorded with mstack decide: what was decided, why, and what it costs if wrong" | Met | `intake.md:19-27`. C1 `decisions.tsv`: two `intake` rows with decision, why, evidence and `if wrong: ...` in `result`. | 5 (n=1) |
| 4 | "a product fork or an irreversible choice becomes decision_required on the item, and all forks of one request reach the user once, late, each with a recommended answer" | Met for a single round; the carrier is unsafe on a partial answer | C1: numbered fork with "Recommended: yes, because ..." on `decision_required`, asked once, after `state add`. Probe B: following `intake.md:35-36` in order B un-guards the remaining fork (B-1). | 5 for the round; 4 for the CLI path, which fails in order B |
| 5 | "text derived from mattpocock/skills or obra/superpowers carries an origin header (repository, path, commit), and both MIT notices ship inside the plugin directory" | Met | `intake.md:1`. Both commits and paths exist upstream, the grilling file is byte-identical to the installed cache, and both licence files are byte-identical to upstream at the cited commits (probe D). Plugin source is `./`. Nothing executable pins it (P2, P3 survive, N-6). | 4 (cmp and gh api runs) |
| 6 | "one real request driven through /mstack in the sandbox produces an item with source, acceptance and seams; the transcript is pasted in the report" | Met | The implementer's run 1 added its own scope sentence to the prompt. My C1 used the unmodified `/mstack <request>` and produced an item with source, acceptance and seams. The transcript is pasted under Probe C here and in `impl_intake-step.md`. | 5 |
| - | seams field (`src/cli.ts`, `src/state.ts`) | Met | Probe A on the real CLI. `tests/seams.test.ts` 9/9 on both runtimes. Mutants X1, X2 and X3 killed. X4 to X7 survive, all cosmetic or a hand-edit edge. | 4 |

## Requirement to test

| R | Test | Fails if reverted? |
|---|---|---|
| `state add --seam` repeats, keeps order, trims | `tests/seams.test.ts:26` | yes (`--seam` is an unknown option without the change) |
| no `--seam`, no key | `tests/seams.test.ts:40` | passes with or without the change (a guard, not coverage) |
| empty `--seam` refused by both writers | `tests/seams.test.ts:51` | yes |
| `state set --seam` replaces, names dropped, counts as an instruction | `tests/seams.test.ts:74` | yes (X1, X3) |
| `--seam` on an item with none | `tests/seams.test.ts:89` | yes, though it asserts only the count (N-4) |
| `--clear seams` removes the key | `tests/seams.test.ts:102` | yes (X1) |
| `--seam` with `--clear seams` refused | `tests/seams.test.ts:120` | yes |
| seams survive other writes | `tests/seams.test.ts:133` | yes |
| non-array or non-string seams refused on read | `tests/seams.test.ts:146` | yes (X2) |
| router intake step, intake.md method, origin header, licences | none | no test; live-verified only (P1, P2, P3 survive) |

## Probe A: seams on the real CLI

Throwaway store `scratchpad/review55/probeA` (`git init`, `/Users/romerma/Code/mstack/bin/mstack setup`), with `mstack version` printing `mstack 0.2.1 at /Users/romerma/Code/mstack`.

```
$ mstack state add --slug a-thing --title A thing --acceptance it works --seam CLI: `x` exit code --seam   fn(a) in src/x.ts   --seam third seam
added 1 a-thing (pending)
[exit 0]
['CLI: `x` exit code', 'fn(a) in src/x.ts', 'third seam']
$ mstack state set 1 --seam only one
1 a-thing (pending)
  seams: 3 seam(s) replaced with 1
    - dropped "CLI: `x` exit code"
    - dropped "fn(a) in src/x.ts"
    - dropped "third seam"
[exit 0]
$ mstack state set 1 --seam
mstack: an empty --seam is not a value
        name the public surface where a test attaches, or run 'state set <ref> --clear seams'
[exit 2]
$ mstack state set 1 --seam "   "        -> same refusal, [exit 2]
$ mstack state add --slug b-thing --title B --acceptance ok --seam ""   -> same refusal, [exit 2]
$ mstack state set 1 --clear seams
1 a-thing (pending)
  seams: 1 seam(s) -> (unset)
[exit 0]
False                                  <- 'seams' in item, read back from state.json
$ mstack state set 1 --clear seams
  seams: already unset
[exit 0]
$ mstack state set 1 --seam s1 --seam s2
  seams: 0 seam(s) replaced with 2
$ mstack state set 1 --source a request --description desc
  description: (unset) -> "desc"
  source: (unset) -> "a request"
$ mstack state set 1 --status in_progress
  status: "pending" -> "in_progress"
$ mstack state set 1 --add-acceptance more
  acceptance: 1 added, now 2
['s1', 's2']                           <- seams survived three unrelated writes
$ mstack state set 1 --seam x --clear seams
mstack: --seam and --clear seams in one command contradict each other
        run one or the other; which one won would depend on an order this CLI does not promise
[exit 2]
$ mstack state set 1 --clear seams --seam x     -> same refusal, [exit 2]
['s1', 's2']
```

Hand-edited `seams` in `state.json`, then `state list` and `gate`:

```
--- seams = "one string"   -> list exit 2: .items[0].seams must be an array of strings, got "one string"; gate [fail] same line
--- seams = {"a":1}        -> list exit 2: ... got an object; gate [fail]
--- seams = ["ok", 3]      -> list exit 2: ... got an array of 2; gate [fail]
--- seams = null           -> list exit 2: ... got null; gate [fail]
--- seams = [["nested"]]   -> list exit 2: ... got an array of 1; gate [fail]
--- seams = []             -> list exit 0; gate [ok] state.json parses and has the right shape   (N-5)
--- seams = [""]           -> list exit 0; gate [ok] state.json parses and has the right shape   (N-5)
```

Concurrent writers (item 53's lock path), `scratchpad/review55/conc.sh` under bash: 8 `state add` with two `--seam` each, racing 8 `state set base --description`, on a store whose item `base` has two seams:

```
16 lines "exit 0" (8 add, 8 set)
1 base ['base seam 1', 'base seam 2'] desc 8
2 c1 ['seam of c1', 'second of c1'] None
3 c4 ['seam of c4', 'second of c4'] None
4 c2 ['seam of c2', 'second of c2'] None
5 c5 ['seam of c5', 'second of c5'] None
6 c8 ['seam of c8', 'second of c8'] None
7 c3 ['seam of c3', 'second of c3'] None
8 c6 ['seam of c6', 'second of c6'] None
9 c7 ['seam of c7', 'second of c7'] None
9 items
PASSED - 0 failures, 1 warning
```

## Probe B: the multi-fork path

Order B is pasted under B-1. Order A, same item and the same two forks, in a fresh store:

```
$ mstack state add --slug fee ... --decision-required "1) ... 2) ..."
added 1 fee (pending)
[ok]    1 open item(s) with a decision fork, each answered or still in specifying
$ mstack decide --phase intake --decision 1) yes: the fee is not discounted; 2) still open ... --result fork 1 answered no-discount; fork 2 open --resolves fee
recorded, and fee no longer has an open fork
[ok]    1 open item(s) with a decision fork, each answered or still in specifying
$ mstack state set fee --decision-required 2) Should the fee show as its own line in quote output? Recommended: yes, because a guest should see what they pay for.
1 fee (pending)
  decision_required: "1) Should the fee be discounted along with th..." -> "2) Should the fee show as its own line in quo..."
  decision_resolved: "2026-11-17T08:46:12.505Z" -> (unset)
[ok]    1 open item(s) with a decision fork, each answered or still in specifying
$ mstack state set fee --status in_progress
mstack: fee has an unanswered decision: "2) Should the fee show as its own line in quote output? Recommended: yes, because a guest should see what they pay for."
        answer it with 'mstack decide --resolves fee ...' first
[exit 2]
```

So the instruction can be followed, and order A works. Order B, the other plausible reading, reaches `in_progress` with fork 2 open, and the gate's decision check passes (B-1). At `pending` the gate says `[ok]` at every step in both orders, which is correct: the field only blocks from `spec_ready` up (`src/lifecycle.ts:49-55`).

## Probe C: live runs with the plugin loaded

Projects are copies of `sandbox/bench/template`, `git init` plus a commit, `/Users/romerma/Code/mstack/bin/mstack setup`, and `state.verify` set to `python3 -m unittest discover -s tests` and committed, as `sandbox/bench/run.mjs` does. Wrapper `scratchpad/review55/live/run.sh`:

```
cd <project>; exec /usr/bin/env -i HOME USER LOGNAME TERM LANG TMPDIR SHELL PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:<bun bin>:<claude bin dir> \
  claude -p "<prompt>" --model opus --output-format stream-json --verbose --setting-sources project \
  --strict-mcp-config --max-budget-usd 6 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto > <stream> 2> <stream>.err
```

The environment is rebuilt from those variable names only, and no ANTHROPIC_* variable is passed, so it authenticates with the claude.ai login. claude 2.1.326. The init event of every run lists plugin `mstack`, `permissionMode: auto` and model `claude-opus-5-5`. All runs exited on their own, with empty stderr.

### C1: the intake request, unmodified

Request (the whole prompt): `/mstack add a $25 cleaning fee to every stay. quote and book should both include it in the total they print.`

I built the tree around one fact (`book` and `quote` both price through `pricing.quote`, money in integer cents), reversible decisions (where the fee lives, what happens to stored totals) and one product fork (whether `--discount-percent` discounts the fee).

Stream `scratchpad/review55/live/streamC.jsonl`. Result: success, 5 turns, $0.22, 41.3 s. Excerpt (tool inputs in full where they matter, results cut):

```
INIT plugins: ['mstack', 'cc-plugin-agents-md', 'cc-plugin-telemetry', 'cc-plugin-privacy', 'cc-plugin-plugin-authoring'] perm: auto model: claude-opus-5-5
08:44:28 TOOL Bash | mstack gate; echo "---"; mstack state active; echo "---"; git ls-files; cat .mstack/progress/current.md 2>/dev/null
  RESULT> -- store\n[ok]    state.json exists ... (0 items) ...
08:44:33 TOOL Bash | cat /Users/romerma/Code/mstack/skills/router/references/intake.md /Users/romerma/Code/mstack/skills/router/playbooks/feature.md; cat README.md bookings/domain/pricing.py bookings/domain/money.py bookings/domain/booking.py bookings/app/service.py bookings/cli.py
  RESULT> <!-- Origin: structure from mattpocock/skills, ...
08:44:45 TOOL Bash | grep -n "quote\|total\|discount" tests/*.py | head -50; python3 -m unittest discover -s tests 2>&1 | tail -3
08:44:55 TOOL Bash | set -e
git checkout -b feat/cleaning-fee
mstack decide --phase intake --decision "Fee is a flat 2500 cents per stay, added inside pricing.quote so service.quote and service.book share it" --why "book already prices through pricing.quote; one place keeps quote and book totals equal" --evidence "bookings/app/service.py book() and quote() both call pricing.quote" --result "if wrong: fee lives in one constant and one line, cheap to move"
mstack decide --phase intake --decision "Existing stored bookings keep their stored total_cents; no data migration" --why "total_cents is persisted at booking time; rewriting history is not asked for" --evidence "bookings/domain/booking.py total_cents field; adapters/jsonfile.py persists it" --result "if wrong: old bookings list without the fee until a migration is written"
mstack state add --slug cleaning-fee --title "Add a \$25 cleaning fee to every stay" \
  --acceptance "quote prints a total that includes the \$25 cleaning fee (e.g. standard 2 nights prints \$223.00)" \
  --acceptance "book prints and stores a total that includes the \$25 cleaning fee, equal to the quote for the same stay" \
  --acceptance "the fee is charged once per stay, not per night" \
  --source "user request 2026-11-17: add a \$25 cleaning fee to every stay. quote and book should both include it in the total they print." \
  --seam "CLI: python3 -m bookings quote / book stdout" \
  --seam "pricing.quote(room, check_in, check_out, discount_percent) in bookings/domain/pricing.py" \
  --decision-required "1) Should --discount-percent apply only to the room nights, with the \$25 fee added after the discount (standard 1 night at 10% off = \$89.10 + \$25.00 = \$114.10)? Recommended: yes, because a flat cleaning fee is a fixed cost and discounting it is unusual."
mstack state active
  RESULT> Exit code 1\nSwitched to a new branch 'feat/cleaning-fee'\nrecorded\nrecorded\nadded 1 cleaning-fee (pending)\nno active item
08:45:03 TEXT> I've done intake for the cleaning fee. There's one question I need you to answer before I write any code.
  ... (states the branch, the two recorded decisions, the three criteria) ...
  **The question:**
  1. Should `--discount-percent` apply only to the room nights, with the $25 fee added after the discount? For example, one standard night at 10% off would be $89.10 + $25.00 = $114.10, not $111.60. **Recommended: yes.** A flat cleaning fee is a fixed cost, and discounting it would be unusual.
  Answer "yes" or tell me the other rule, and I'll record it on the item and hand the work to the implementer.
  **Two bugs I found while reading, outside this change:** (Booking.overlaps inclusive checkout; float discount)
RESULT success 0.2216 turns 5 duration_ms 41278
```

(The `Exit code 1` comes from the trailing `mstack state active` with nothing active, under `set -e`, after every write succeeded.)

The store afterwards: `state.json` item 1 `cleaning-fee` (pending) carries `source`, the three criteria, two `seams` and the numbered `decision_required` above. `decisions.tsv` holds two `intake` rows whose `result` starts `if wrong:`. `mstack gate` gives `PASSED - 0 failures, 1 warning`.

Answers to the brief's questions:

| Question | Answer, from the stream |
|---|---|
| Intake before the playbook was copied into the todo list? | Yes, though trivially: the playbook was never copied (no `TodoWrite` in the stream, no `skip:` line). The agent read `feature.md` in the same `cat` as `intake.md`, then ran intake and stopped (N-2). |
| Source, acceptance, seams on the item? | Yes, all three, plus `decision_required`. |
| Acceptance observable and derived from the request? | Yes. "quote ... prints \$223.00" (2 x 9900 + 2500 cents is right), "book prints and stores ... equal to the quote", "once per stay, not per night" (from "every stay"). |
| Reversible decision recorded with a cost if wrong? | Yes, two rows, `--result "if wrong: ..."`. |
| Fork parked with a recommendation, put once, late? | Yes. Numbered, "Recommended: yes, because ...", worded so yes accepts it, asked once in the final message after `state add`. |
| Did it ask for a fact? | No. It looked up the pricing path, the stored totals and the tests, and ran the suite. |
| After parking the fork | It stopped. It neither continued unblocked work nor implemented. |
| Cost of intake | 3 tool calls (read, look up facts, decide + `state add`) after the 1 orient call, about 22 s (08:44:33.751 to the `state add` result at 08:44:55.771). |

### C2: requests intake should skip

Each ran in a fresh copy with the same wrapper.

- **Commit**, with a staged one-line fix to `Booking.overlaps`: `/mstack write the commit message for the staged change`. Success, 5 turns, $0.14. `intake.md` appears 0 times in the stream, `state list` prints `no items`, and the only tool uses are `Bash` x2 and `Skill` (`mstack:commit`). Its words: `Gate is green with two warnings (on main, one uncommitted change). Nothing is in flight. I skipped intake because a commit message is not a queue item. Routing to /mstack:commit.`
- **Investigate**: `/mstack why does booking a room from the day another stay ends get rejected?`. Success, 6 turns, $0.20. `intake.md` appears 0 times, `no items`. Its words: `Intake skipped: this is a question, not a change request. Playbook is investigate, steps 1 to 5. Step 2 (fan-out) skip: ...`
- **Review**, extra, for N-1: `/mstack review the staged change before I commit it`. `intake.md` appears 0 times, and there is no one-line skip note. Inside `mstack:review`, `fanout plan` refused with "no active item", so the agent ran `state add --slug booking-overlap-half-open ... --source "user: review the staged change before commit" --seam "..."` and `--status in_progress`, and then launched two lens reviewers. The item comes from the review skill's need for an active item, not from intake.

## Probe D: provenance

```
installed_plugins.json  mattpocock-skills@claude-plugins-official  version 1.3.1  gitCommitSha 49dd158d1076134a641b33efb035946536778336
gh api repos/mattpocock/skills/commits/49dd158...  -> 49dd158d1076134a641b33efb035946536778336 2026-10-09T10:56:49Z
gh api repos/obra/superpowers/commits/22f0b46...   -> 22f0b463e7a5e579904dd6211a520321035526f7 2026-11-03T22:17:07Z
cmp (gh contents skills/productivity/grilling/SKILL.md @49dd158) (installed cache SKILL.md)  -> identical
cmp ~/.claude/plugins/cache/.../mattpocock-skills/1.3.1/LICENSE licenses/mattpocock-skills-LICENSE.txt -> identical
cmp (gh contents LICENSE @49dd158) licenses/mattpocock-skills-LICENSE.txt   -> identical  (sha1 f8360150ebbd5ba0a9c824db0f201ae1c87cbcbd)
cmp (gh contents LICENSE @22f0b46) licenses/obra-superpowers-LICENSE.txt    -> identical  (sha1 5f09b05242b8b94f400ae8a5b27422c489e40bbb)
Copyright lines: "Copyright (c) 2026 Matt Pocock", "Copyright (c) 2025 Jesse Vincent"
```

The cited superpowers file at `22f0b46` carries "Rulings, not stalls" at lines 19-25, including "`Ruling: <what you decided> — <why> — <what it costs if wrong>`". That is what `intake.md`'s `decide ... --result "if wrong: ..."` adapts. The grilling text supplies the design tree, the frontier, the recommended answer worded for "yes", and "Finding facts is your job". All of it sits in `intake.md`, under the header on line 1, which names the repository, path and commit for both sources and points at both licence files. The plugin source is `./` (`.claude-plugin/marketplace.json`), so `licenses/` ships, and `git check-ignore` does not ignore it.

Naming: `rg -i grill` over shipped files finds `intake.md:5` ("Intake is not grilling: grilling hands every decision to the user", which names the source to say what intake is not) and the interactive-mode trigger phrase "grill me" (`intake.md:64`). The rest is the pre-existing spec-reviewer wording ("grills a spec"). Nothing calls intake grilling. `SKILL.md:25-26` summarises the method in one sentence ("Facts are found, reversible decisions are taken and recorded, forks reach the user once, late"). I read that as a summary pointing at the headed file, not as derived text that needs its own header.

## Probe E: the prose

- The exception to the question cap is in both places and limited to interactive mode: `SKILL.md:99-100` ("except in intake's interactive mode, which the request has to ask for and which has no cap") and `principles.md:73-74` ("The one named exception is intake's interactive mode, when the request asks to be questioned"). `intake.md:63-68` turns interactive mode on only on request and keeps "Facts are still never asked".
- It is consistent with Autonomy (`SKILL.md:92-93`, stop on product decisions) and with the two paths (`SKILL.md:59`, `decision_required` means the spec path): intake parks forks rather than taking them. The only open conflict is N-3 (more than three forks).
- Skip conditions: resume ("an item is already in flight and you are resuming it") and "continue with item N" ("the request names an existing item") are covered. Commit is named. Verify, review, ship and investigate are not named (N-1). In the live runs investigate and commit skipped correctly, and review skipped silently.
- The partial-answer sentence is B-1.
- The docs match the code. The CHANGELOG entry, `The-CLI.md:187-198` and `:248-250`, and `Skills-and-Playbooks.md:94-95` all describe the behaviour I observed in probe A (repeat on add, replace with dropped names on set, `--clear seams`, empty refused, the gate requiring neither source nor seams). Line 30 of SKILL.md, "That fourth step", was renumbered correctly. No other file cites the step number.
- Em dashes in added lines: one, carried on a re-wrapped pre-existing line in `The-CLI.md:249` (N-8).

## Probe A, continued: mutants

Applied one at a time in a clone (`git clone` of the checkout, `feat/intake-step` at `daacfbf`, `node_modules` symlinked), both halves run every time (`npm run test:bun; npm run test:node`), then reverted with `git checkout -- .`. None of these is in the implementer's M1-M9 table. Script: `scratchpad/review55/mutants.py`. Results: `scratchpad/review55/mutA.jsonl`, `mutB.jsonl`.

| Mutant | Change | Result (seams-related failing tests) | Matters? |
|---|---|---|---|
| X1 | drop `"seams"` from `KNOWN_ITEM_KEYS` (`src/state.ts:224`), so the raw old value overrides each write | killed: bun 2, node 2 (`--clear seams removes the key...`, `state set --seam replaces the list...`) | - |
| X2 | keep `Array.isArray`, drop the per-element string check (`src/state.ts:190`) | killed: 1 per half (`a seams value that is not an array of strings...`) | - |
| X3 | drop `values.seam` from the instruction count (`src/cli.ts:473`) | killed: bun 3, node 3 | - |
| X4 | `preview` of a list prints `(a list)` instead of `N seam(s)` (`src/cli.ts:227`) | **survives** | no, cosmetic |
| X5 | `parseItem` drops `[]` and blank seams on read (`src/state.ts:208`) | **survives** | barely: hand-edited edge (N-5) |
| X6 | the "given nothing to set" hint omits `seam` (`src/cli.ts:481`) | **survives** | no, message only |
| X7 | omit `seams: N seam(s) replaced with M` when N equals M (`src/cli.ts:661`) | **survives** | minor (N-4) |
| P1 | delete step 3 (intake) from `skills/router/SKILL.md` | **survives** (suite and lint green) | yes for criterion 1's durability (N-6) |
| P2 | delete the origin header from `intake.md` | **survives** | yes for criterion 5 (N-6) |
| P3 | delete `licenses/obra-superpowers-LICENSE.txt` | **survives** (both halves 0 fail) | yes for criterion 5 (N-6) |
| P4 | delete the exception sentence from `principles.md` | **survives** | prose (N-6) |

Other failures under the mutants were all known load-sensitive tests, which do not touch seams: `tests/costs.test.ts:698` under X1, X3, P1 and P2, and `tests/run.test.ts:239` under P2 (both item 67). Under X4 one `spawnSync` child (`bun src/cli.ts statusline`, from `tests/launcher.test.ts:59`, no timeout) hung at 0% CPU for six minutes. I killed it, which failed that one test. This is a pre-existing hang, and I would add it to item 67. The baseline run on the clone at `daacfbf` (no mutant, two claude sessions running alongside) was bun 538/0 and node 537/1, the one failure being `tests/costs.test.ts:698`.

## Probe F: regression on the head

On the checkout, head `daacfbffb03c61709963aa12d2b8f0e129198983`, clean tree, machine otherwise idle:

```
$ ./bin/mstack gate --full          (verify = npm test && npm run typecheck && bin/mstack lint-plugin .)
 538 pass
 0 fail
Ran 538 tests across 26 files. [92.03s]
ℹ tests 538
ℹ pass 538
ℹ fail 0
> bunx --bun tsc --noEmit
PASSED - 0 failures, 0 warnings          <- lint-plugin
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
gate --full exit 0

$ bun run typecheck                    -> $ bunx --bun tsc --noEmit ; exit 0
$ ./bin/mstack lint-plugin .           -> PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 96 relative links checked, 0 broken
$ ./bin/mstack gate                    -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack ledger check intake-step (before my row)
FAIL no verdict at daacfbff; 1 row(s) exist at other SHAs and a new head SHA voids them
```

The suite is green, but it does not cover B-1, which is prose plus a CLI path no test exercises.

## Ledger

My row: `./bin/mstack ledger record intake-step daacfbffb03c61709963aa12d2b8f0e129198983 verifier-failed --evidence .mstack/progress/review_intake-step.md --verifier reviewer`. The suite is green, but the check of criterion 4's carrier failed (B-1), so the evidence ladder maps this to `verifier-failed`.

## What would turn this into an approval

1. B-1: `intake.md` names the order for a partial answer (resolve, then re-state with the rest) and forbids `--resolves` on a partial answer after the re-state. Rerun probe B order B against the new text and show it cannot reach `in_progress`. A code guard or a pinning test is optional but preferred.

The non-blocking items can go to follow-ups: N-1 to N-3 and N-7 are prose, N-4 and N-5 are CLI polish, N-6 is a lint rule (close to item 31), N-10 is item 67.
