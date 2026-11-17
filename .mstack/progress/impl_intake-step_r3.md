# Implementation report: intake-step, round 3

Commits on `feat/intake-step` (from `311cbec`): `56aace8` fork definition, `c479b79` N-1, `dfa61d9` N-2, then the tests commit (N-3) and this report. Live-run artefacts (streams, projects) are under `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl55r3/` (`A1 B1 C1 C2 D1` on the round-2 text, `A2 B2 C3 C4 D2` on the final text).

## What changed

**B-1, `skills/router/references/intake.md:8-19` and `:28-29`; `skills/router/SKILL.md:93-95`.** The Map is an order and the first row that fits wins:

```
Classify each frontier node, taking the first row that fits, handle it, ...
| **Fact**: the request, the repository, its docs or tests, or a convention the project already follows settles it | Find it. Never ask the user for one. |
| **Fork**: its answers give the product's user a different result (what is charged, allowed, refused, stored, deleted or shown as a value), or it cannot be undone, however cheap the code change is | Park it on the item (below). Do not take it. |
| **Reversible decision**: the user sees the same result either way (where code lives, names, structure, internal approach) | Take your recommended answer and record it (below). |
```

Under the `decide` block: "Write the `if wrong:` line first: if it names something the product's user would notice, or data that is lost, this is a fork, not a row."
Router Autonomy: "... and product decisions with different user-visible outcomes, which stay product decisions however cheap they are to reverse."
No examples were added.

**N-1, `principles.md:73-74`, `CHANGELOG.md:12-13`.** principles: "The exceptions are intake's interactive mode and its fork round, set out in the router's Autonomy section." CHANGELOG: "turns on interactive mode, which, with the fork round, is exempt from the three-question cap (stated once, in the router's Autonomy section)." The rule itself stays only in `SKILL.md` Autonomy.

**N-2, `intake.md:37-40` and `SKILL.md:18-19`.** Fork round: "That round names the item's slug and asks for the answers to name it (`<slug>: yes to 1, ...`). Write the slug and its open forks into `current.md`'s Next step first, so a fresh session finds them. It is the final message of the turn ..." Router step 2: "If something is in flight, or `current.md` records a parked fork, read `.mstack/progress/current.md` ...". `intake.md` is 77 lines (was 73).

**N-3, `tests/seams.test.ts`.** The replace test now asserts `added "the only seam left"`; a new test clears `source` on an item with seams and asserts the seams are untouched and stdout has no `dropped`. No defect found.

## Live runs

Wrapper: `scratchpad/impl55r3/run.sh` (clean `env -i`, flags exactly as briefed, `--permission-mode auto`, perl alarm 600, stream written outside the project). Each project is a fresh copy of `sandbox/bench/template`, `git init`, commit, this checkout's `setup`, `state.verify` set, commit (`prep.sh`). A watcher killed a run once it launched a subagent, wrote `in_progress`, or used TodoWrite. No `claude -p` process is left.

| Run | Request | Text | Parked | Took | Stopped where | Expected? |
|---|---|---|---|---|---|---|
| A1 | `/mstack add a $25 cleaning fee to every stay, and let a guest cancel a booking. quote and book should both include the fee in the total they print.` (round 2 implementer's streamA) | round 2 + B-1 (before N-2) | 3 forks: 1) discount applies to room subtotal only? 2) stored bookings keep their total? 3) cancel stays id-based, no refund | fee constant in pricing.quote; cancel is a persistence fix | final message, item `pending`, asked once | yes |
| A2 | same | final | 3 forks: discount, stored bookings, re-cancel refused with exit 1; the reply asks for `cleaning-fee-and-cancel: yes to 1, 2, 3` | fee constant; cancel persistence fix | final message, item `pending`, `current.md` Next step holds slug and forks | yes |
| B1 | `/mstack suites need a minimum stay of 2 nights now, so book should refuse a one-night suite. also add a $25 cleaning fee to suite stays; quote and book should both include it in the total they print.` (reviewer r1) | round 2 + B-1 | 1) quote also refuses a one-night suite, 2) `--discount-percent` leaves the fee alone | fee is flat per stay, stored in `total_cents` (a stay-count reading of the request) | final message, `pending` | yes |
| B2 | same | final | the same two forks, slug in the reply (`suite-min-stay-cleaning-fee: yes to 1, yes to 2`) | where the rules live; stored suite bookings untouched | final message, `pending`, `current.md` note | yes |
| C1 | bench T2 issue (rounding) + the bench suffix, with `/mstack ` | round 2 + B-1 | nothing, no `decision_required` | nothing recorded; item `discount-half-up` | `in_progress`, in the bug-fix playbook | yes |
| C2 | bench T4 issue (export) + suffix | round 2 + B-1 | nothing | 4 `intake` rows (CSV dialect, JSON shape, newline, where the logic lives); item `export-command` | `in_progress`, feature playbook | yes |
| C3 | bench T1 issue (overlap) + suffix | final | nothing | plan row only | launched `mstack:implementer`, item still `pending` (agent never ran `state set in_progress`) | yes (no fork, carried on) |
| C4 | bench T3 issue (discount codes) + suffix | final | nothing | 4 `intake` rows, including "`--discount-percent` applies first, then codes" (cost: combined use prices differently) | `in_progress` | yes, with a flag below |
| D1 | `/mstack yes to 1, and for 2 keep the current behaviour`, new session, no `--resume`, in a copy of B1's project with B1's `.mstack` uncommitted | round 2 + B-1 | n/a | the hook printed only "No active work item"; the agent found the item through `git diff .mstack`, resolved the forks and moved on | killed at `in_progress` | partial repro, below |
| D2 | the same prompt, in a copy of B2's project with its `.mstack` committed (no diff to find) | final | n/a | the SessionStart hook injected the `current.md` note; the agent recorded both answers with `--resolves suite-min-stay-cleaning-fee`, wrote a design row and launched `mstack:spec-author` | killed at the spec-author launch | yes |

Request texts for C are `sandbox/bench/tasks/<T>/issue.md` plus the bench `SUFFIX` ("You are running unattended: nobody will answer questions. ...") from `run.mjs:37`.

### Failed or discarded attempts

1. First launch of all four (A1 B1 C1 C2) wrote the stream into each project directory, where the agent could read it. I killed them within seconds, deleted the projects and fixed the wrapper to write outside the project. Nothing was changed in the prose.
2. No run failed its expectation, so the prose was not retuned between runs. The only prose edits after the first run set were the N-2 ones, made after D1.

### N-2: does it reproduce?

Partly. In D1 the SessionStart hook said only "No active work item" and `current.md` was the template, as the review predicted. The agent found the item anyway, but only because B1's `.mstack` changes were uncommitted, so `git diff .mstack` showed them. With committed state that route is gone. After the fix, `current.md` carries the slug and forks, and the existing `SessionStart` hook injects `current.md` into the agent's context ("Last recorded checkpoint"), so D2 saw the note in its first prompt. The router-step-2 words are a backup for sessions where the hook is off. `./bin/mstack gate` on A2 and B2 (note in `current.md`, no active item): `PASSED - 0 failures, 2 warnings` (branch and uncommitted-changes warnings only).

## Tests

```
$ npm run test:bun    -> 542 pass, 0 fail, Ran 542 tests across 26 files. [90.59s]
$ npm run test:node   -> tests 542, pass 542, fail 0
$ npm run typecheck   -> bunx --bun tsc --noEmit   (no output, exit 0)
$ ./bin/mstack lint-plugin .  -> PASSED - 0 failures, 0 warnings
```

Load average was about 8 from other work on the machine, and neither load-sensitive test (`costs.test.ts:698`, `run.test.ts:239`) failed. The `[fail] items marked done with no ledger verdict ... alpha` lines in the bun tail are fixture output from a test that asserts them.

### Mutants (scratch clone `scratchpad/impl55r3/clone`, reverted after each)

| Mutant | Change in `src/cli.ts` | Before | Now |
|---|---|---|---|
| MB6 | `+ added` only when the item had no seams (`for (const added of before.length === 0 ? next : [])`, :664) | survived | killed, bun and node: `state set --seam replaces the list, says what it dropped...` |
| MB7 | `clearField` prints dropped seams whatever field is cleared (`if (key === "seams")` removed, :322) | survived | killed, bun and node: `clearing another field on an item with seams does not report a dropped seam` |

## Decisions (also in `.mstack/decisions.tsv`, phase `implement`)

1. The fork definition is an order with the `if wrong:` test; one Autonomy clause, no examples.
2. The cap exception is stated once, in the router; the other two places point to it.
3. N-2 is prose only: slug in the round, a `current.md` Next step note, and three words in step 2. The hook already does the delivery.

## Found and not fixed

- **C4's `--discount-percent` row.** It decided how an existing option combines with the new codes and priced the combination differently if wrong. By the new rule that is arguably a fork, but its `--evidence` says "do not change existing behaviour", which is a convention the project already follows and so a fact. I left it; a reviewer should decide whether it is over- or under-parking. It did not stall the run.
- **C2's CSV line-ending row** says "if wrong: lines end CRLF instead of LF", also user-visible in a small way, and is also settled by the issue's "standard CSV rules".
- **D1/D2 added a `Co-Authored-By` trailer** to a commit made inside the throwaway project; that comes from the model, not the plugin text, and is outside this item.
- N-4, N-5, N-6 left alone as instructed.
- Sample sizes: B-1 is n=2 per request on the final text (A2, B2) plus n=1 on the text without N-2 (A1, B1); C is n=4 tasks on the over-parking side. The hypothesis in round 2 that "stop there" makes parking costlier was not tested.

## R to test

| Requirement | Test | Where |
|---|---|---|
| replace prints what it added | `state set --seam replaces the list...` | `tests/seams.test.ts:74` (MB6) |
| clearing another field prints no dropped seam | `clearing another field on an item with seams...` | `tests/seams.test.ts:90` (MB7) |
| a user-visible choice is parked, never taken (prose) | none; live only | A1, A2, B1, B2 above |
