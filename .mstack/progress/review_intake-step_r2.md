# Review - intake-step, round 2

**Verdict:** CHANGES_REQUESTED

I reviewed `daacfbf..b61b694` (`b61b69470a06f6ee674e80587498d8768275511a`): 7 product files, checked against the six acceptance criteria in `.mstack/state.json`. Round 1's B-1 is fixed. The new "Park a fork" text cannot be followed into an open fork at `in_progress`. Two new tests pin both orders, and my mutants kill both. A live partial answer went exactly the way the text says. The seams changes (N-4, N-5) hold on the real CLI.

There is one new blocking finding, about how a fork is defined. Four live runs used this text. In two of them, the agent decided a user-visible pricing rule itself, recorded it as a reversible decision, and went on to build it. Criterion 4 fails in those two runs.

## Blocking

**B-1. `skills/router/references/intake.md:13-17` and `:26-27`: a product fork that is cheap to change reads as a reversible decision, and the agent takes it.**

The Map table has one row for a "Reversible decision" ("Take your recommended answer and record it") and one for a "Product fork (different user-visible outcomes) or irreversible choice" ("Park it on the item. Do not take it."). The two rows overlap: a choice with different user-visible outcomes that costs two lines to change fits both. Nothing says which row wins. The next section draws the line by undo-ability only: "Decisions that could not be undone are forks, not rows" (`intake.md:27`).

The router has the same overlap with no precedence. `skills/router/SKILL.md:91` says "Proceed without asking on anything reversible: branches, code, tests, ...". `SKILL.md:93-94` says "Stop and ask on ... product decisions with different user-visible outcomes". The table did not change in round 2, and runs on it have classified the same question both ways:

| Run | Text it ran on | "Is the cleaning fee discounted by `--discount-percent`?" |
|---|---|---|
| round 1 C1 (`review_intake-step.md`) | `daacfbf` | parked as fork 1, asked once |
| implementer attempt 1 (`scratchpad/impl55r2/streamA.jsonl`) | round 2: it started 10:18 local, after `faf6068` at 10:17:34 | **taken**: "the fee is added after the discount and is never discounted" |
| my r1 (Probe C) | `b61b694` | **taken**: "the discount never reduces it". A second user-visible choice was taken too. |
| my r2 (Probe C) | `b61b694` | different request: both policy forks parked, asked once |

Both runs that took the choice wrote a user-visible cost into their own `--result`. That cost is the cue the text could point them to:

```
streamA  --decision "Percent discount applies to the room subtotal only; the fee is added after the discount and is never discounted"
         --result   "if wrong: quote with a discount is off by fee*percent; swap two lines and one test"
r1       --decision "Minimum stay of 2 nights is enforced by book only; quote still prices a one-night suite"
         --result   "if wrong: one extra check in quote, plus a test"
r1       --decision "Cleaning fee is a flat 2500 cents added after any discount; the discount never reduces it"
         --result   "if wrong: quote --discount-percent on suites prints a total off by up to 25 dollars times the discount"
```

Neither run asked the user. What each did instead:

- **streamA** ran `state add` without `--decision-required`, then `state set --status in_progress`. It then launched `mstack:implementer` with "Decisions already taken (do not revisit) ... 2. The percent discount applies to the room subtotal only". It got as far as a `live-verified` ledger row before the implementer killed it.
- **r1** said "Two reversible decisions to record, no product forks left open" and set `in_progress`. It then launched `mstack:implementer` with "`quote` must still price a one-night suite (decided: min stay is book-only)". I stopped it at 81 s.

My judgement of each decision streamA took. Its request was "add a $25 cleaning fee to every stay, and let a guest cancel a booking. quote and book should both include the fee in the total they print."

| streamA decision | User-visible difference between the answers? | Verdict |
|---|---|---|
| the fee is a constant in `pricing.py`, added inside `pricing.quote` | none: it only decides where the code lives | reversible, correctly taken |
| the fee is added after the discount and never discounted | yes: `quote standard 2025-03-01 2025-03-02 --discount-percent 10` prints $114.10 or $111.60 | **product fork, decided for the user** |
| cancel stays id-based; the work is making it persist | none for this request. `cancel <id>` already exists, and the missing save is a bug the agent reproduced. | reversible, correctly taken |
| no migration of stored totals; cancelling leaves `total_cents` alone | arguably visible in `list` for old bookings. The honest reading of a price change is forward-looking, though, and round 1 accepted the same row. | reversible, acceptable |

In r1 both decisions are product forks. "Does `quote` refuse a one-night suite?" prints a price or an error. "Is the fee discounted?" prints two different totals. So criterion 4 ("a product fork ... becomes decision_required on the item") is not met in streamA or in r1.

The CLI cannot catch this. An item with no `decision_required` passes every gate check, so only the prose can stop it. One hypothesis, **unverified**: round 2's "That round is the final message of the turn: stop there" (`intake.md:35`) makes parking more expensive than before. That may push an agent toward taking a borderline fork rather than parking it. Two samples cannot separate that from run-to-run variance.

What would make it pass is a rule that settles the overlap, using the cost line the agent already writes. For example:

- **Map table.** "**Reversible decision**: the user sees the same result whichever answer you take (where code lives, names, structure, stored shape). Take your recommended answer and record it." Then "**Product fork**: the answers give the user different results (a different total, output, error, or allowed action), however cheap the change is. Or an **irreversible choice**. Park it. Do not take it."
- **`intake.md:27`.** "If what you would write after `if wrong:` is something the user would see, it is a fork, not a row. Decisions that could not be undone are forks too."
- **`SKILL.md` Autonomy.** One clause saying a product decision stays one even when it is cheap to reverse.

Then rerun streamA's request and the r1 request through `/mstack`, unmodified. Each run should park the discount question, and in r1 the `quote` one-night-suite question, in `decision_required` and ask them in the one round.

## Non-blocking

- **N-1. `skills/router/references/principles.md:73-74` and `CHANGELOG.md:12` still call interactive mode "the one named exception" to the three-question cap.** `SKILL.md:100-102` now names two exceptions: interactive mode and the fork round. `SKILL.md:107` tells the agent to read `principles.md` at the start of a multi-step task. The agent therefore reads one rule with a single exception and another with two. The fork-round sentence itself appears only once, in `SKILL.md:100-102`, and `intake.md` does not repeat it. Fix: drop "one" in both places, or name both exceptions.
- **N-2. A fresh session that brings the answers finds nothing to pick up.** A parked item stays `pending`, which is not an active status (`src/lifecycle.ts:25-31`), and intake writes no `current.md`. In a new session (not `--resume`), router step 2 prints "no active item". The skip list (`SKILL.md:21-24`) covers the answer only if the user names the item. **Unverified** as behaviour: every resume I ran used `--resume`, and those carry the conversation. One way to close it: have the fork round name the slug, so the answer comes back as "continue with `<slug>`", which the skip list already covers.
- **N-3. Two seams lines are unpinned.** Mutant MB6 prints `+ added` only when the item had no seams before, which contradicts the implementer's recorded decision ("`--seam` prints `+ added` for each new seam on every replacement"). Mutant MB7 makes `clearField` print `- dropped <seam>` lines when *another* field is cleared on an item that has seams, so the output claims drops that did not happen. Both survive both halves of the suite. The replace test (`tests/seams.test.ts:74-87`) asserts only `dropped`. Adding `assert.match(set.stdout, /added "the only seam left"/)` there, plus one `--clear source` on an item with seams asserting no `dropped`, would pin both.
- **N-4. `state set --seam X` on an item whose only seam is already `X`** prints `1 seam(s) replaced with 1`, `- dropped "X"`, `+ added "X"`. By comparison, `--decision-required` with the same text reports that nothing changed. This is cosmetic.
- **N-5. The skip list and "why does X fail".** The list now names every route in the table that is not new work: resume, a named item, investigate, verify, review, ship, commit, cleanup. Bug-fix, feature, refactor and orchestrate go through intake, so a bug report gets an item. The tie-breaker for "why does X fail?" is the route table (`SKILL.md:39-40`: "why it is the way it is" versus "something broken"), and that question fits both rows. The failure mode is benign: an investigate run makes no item and decides nothing, and the fix request that follows goes through intake. The skip clause is keyed on the route, yet it runs before step 4 matches the route. That works, but the reader has to classify early. "A PR title" (from the commit row) is not named, but it is the commit route.
- **N-6. Observations from the live runs, outside this item.** In r3 the agent ran `state set --clear acceptance` "by mistake". The CLI refused it, because `acceptance` is not clearable. In r4 it used `--acceptance` to append a criterion, which replaced the list with one entry; it noticed and restored all six. In r4 it also moved the item to `spec_ready` before the spec review, then back to `specifying`. The gate allows that for a non-`sdd` item, as round 1 N-2 noted. r2 to r4 used no `TodoWrite`: the playbook steps went into `current.md` under Plan, not verbatim. These belong to `state set` ergonomics, the spec gate (item 40/56 territory) and router step 4, not to this diff.

Round 1's non-blocking findings, rechecked: N-1 (skip list) fixed at `SKILL.md:21-24`. N-2 (what happens after the fork round) fixed at `intake.md:35-36` and confirmed live (r2 ends the turn; r4 goes to `specifying` and the spec path). N-3 (the cap) fixed at `SKILL.md:100-102`, but see N-1 above. N-4 and N-5 fixed (Probe B). N-7 fixed at `intake.md:63-64`. N-8 fixed at `docs/wiki/The-CLI.md:249-250`. N-6, N-9 and N-10 were not touched, as planned.

## Probe A: the partial-answer rule on the real CLI

Throwaway stores under `scratchpad/review55r2/probeA/<S>` (`git init`, then `/Users/romerma/Code/mstack/bin/mstack setup`). The script is `scratchpad/review55r2/probeA.sh` and the full output is `probeA.out`. Every `[FAILED - 1 failure]` below is the unrelated `current.md`-is-the-template check for an active item (pasted at the end), never the decision check.

```
=== S1 permitted: plain row, then re-state; then the final answer with --resolves
$ mstack decide --phase intake --decision 1) no: the fee is never discounted ... --result fork 1 answered no-discount; fork 2 open
recorded
$ mstack state set fee --decision-required 2) Should the fee show as its own line in quote output? ...
  decision_required: "1) Should the fee be discounted along with th..." -> "2) Should the fee show as its own line in quo..."
  state.json: status=pending decision_required='2) Should the fee show as its own line i' decision_resolved=None
$ mstack state set fee --status in_progress
mstack: fee has an unanswered decision: "2) Should the fee show as its own line in quote output? ..."
        answer it with 'mstack decide --resolves fee ...' first
[exit 2]
[ok]    1 open item(s) with a decision fork, each answered or still in specifying
$ mstack decide ... --decision 2) yes: the fee prints as its own line in quote ... --resolves fee
recorded, and fee no longer has an open fork
$ mstack state set fee --status in_progress
  status: "pending" -> "in_progress"
[exit 0]
[ok]    1 open item(s) with a decision fork, each answered or still in specifying

=== S2 permitted: re-state, then plain row; then the final answer with --resolves
(re-state, plain row) state.json: decision_resolved=None
$ mstack state set fee --status in_progress   -> unanswered decision ... [exit 2]
(final --resolves) recorded, and fee no longer has an open fork
$ mstack state set fee --status in_progress   -> status: "pending" -> "in_progress" [exit 0]

=== S3 forbidden: --resolves on the partial answer, then re-state
recorded, and fee no longer has an open fork
  decision_resolved: "2026-11-17T09:29:06.605Z" -> (unset)       <- the re-state clears it
$ mstack state set fee --status in_progress   -> unanswered decision ... [exit 2]

=== S4 forbidden: re-state, then --resolves on the partial answer
$ mstack decide --phase intake --decision 1) no: the fee is never discounted; 2) still open ... --resolves fee
recorded, and fee no longer has an open fork
  state.json: status=pending decision_required='2) Should the fee show as its own line i' decision_resolved='2026-11-17T09:29:07.093Z'
$ mstack state set fee --status in_progress
  status: "pending" -> "in_progress"
[exit 0]
[ok]    1 open item(s) with a decision fork, each answered or still in specifying

=== S5 permitted: two partial rounds over three forks, then the final answer
plain 1) ; re-state "2) ... 3) ..."  -> in_progress refused [exit 2]
re-state "3) ..." ; plain 2)          -> in_progress refused [exit 2], decision_resolved=None
--resolves "3) yes: quote refuses a one-night suite as book does"
  -> recorded, and fee no longer has an open fork; in_progress [exit 0]; decision check [ok]

=== S6 permitted: plain row only, re-state forgotten; final answer names every fork in the field
plain 1) -> in_progress refused, the message lists both forks [exit 2]
--resolves "1) no discount (answered earlier); 2) yes: own line" -> in_progress [exit 0]

$ mstack gate    (S4 store, after in_progress)
[fail]  1 fee (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template
FAILED - 1 failure, 2 warnings
```

Reading "Park a fork" (`intake.md:38-41`) as an agent holding a partial answer, the permitted sequences are S1, S2, S5 and S6, and none of them can reach `in_progress` with a fork open. After one or two partial rounds, the final `--resolves` closes the field correctly. Only S4 still reaches `in_progress` with fork 2 open, as it did in round 1, and the text forbids it twice, with no condition attached: "`--resolves <slug>` goes only on the `decide` row that answers every fork left in the field" and "A partial answer never gets `--resolves`". "In either order" attaches only to the plain row and the re-state. I found no reading that permits S3 or S4. The CLI hole is still there, but the coordinator's design row 138 leaves it to the prose. That choice is recorded and not reopened here.

Mutants in a clone (`scratchpad/review55r2/clone`, `node_modules` symlinked). Each ran both halves in full, then was reverted. The baseline on the clone was bun 541/0 and node 541/0. Results are in `mut.jsonl`, the script in `mutants.py`.

| Mutant | Change | Result |
|---|---|---|
| MA1 | `state set --decision-required` no longer clears `decision_resolved` (`src/cli.ts:716-719` deleted) | killed: bun 2, node 2 (`re-stating an answered fork clears the pointer and in_progress is then refused`, new; `rewriting the fork drops the answer...`) |
| MA2 | a plain `decide` sets `decision_resolved` on every item that carries a fork | killed: bun 2, node 2 (`a partial answer recorded plainly, in either order with the re-state, keeps the fork open`, new; `a decision without --resolves ... unblocks nothing`) |
| MA3 | the re-state clears the pointer only when the item is already past the line (`&& requiresDecision(item.status)`) | killed: bun 2, node 2 (the new pending-status test and the old one) |

## Probe B: seams round 2 on the real CLI

Throwaway store `scratchpad/review55r2/probeB`. The script is `probeB.sh`, the output `probeB.out`. `mstack version` printed `mstack 0.2.1 at /Users/romerma/Code/mstack`.

```
$ mstack state set 1 --seam CLI: `x` exit code --seam   fn(a) in src/x.ts       (item has no seams)
  seams: 0 seam(s) replaced with 2
    + added "CLI: `x` exit code"
    + added "fn(a) in src/x.ts"
$ mstack state set 1 --seam only one
  seams: 2 seam(s) replaced with 1
    - dropped "CLI: `x` exit code"
    - dropped "fn(a) in src/x.ts"
    + added "only one"
$ mstack state set 1 --seam only one          (same value again: N-4)
  seams: 1 seam(s) replaced with 1
    - dropped "only one"
    + added "only one"
$ mstack state set 1 --clear seams
  seams: 2 seam(s) -> (unset)
    - dropped "first"
    - dropped "second"
  state.json seams: <no key>
$ mstack state set 1 --clear seams
  seams: already unset

--- seams = [""]        -> list exit 2: .items[0].seams must not hold a blank string
                           name the surface, or delete the entry; an empty list is fine
                           gate [fail] same line
--- seams = ["  "]      -> list exit 2, same message; gate [fail]
--- seams = ["ok", ""]  -> list exit 2, same message; gate [fail]
--- seams = ["\t\n"]    -> list exit 2, same message; gate [fail]
--- seams = []          -> list exit 0; gate [ok] state.json parses and has the right shape (1 items)
```

Mutants of my own on the changed lines, run in full on both halves:

| Mutant | Change | Result |
|---|---|---|
| MB1 | no `+ added` lines (`src/cli.ts:664`) | killed: bun 1, node 1 (`state set --seam on an item with none adds them and prints them`) |
| MB2 | no `- dropped` lines on `--clear seams` (`src/cli.ts:322`) | killed: bun 1, node 1 (`--clear seams removes the key, reports it...`) |
| MB3 | blank check without `trim()` (`src/state.ts:194`) | killed: bun 1, node 1 (`a hand-edited blank seam is refused...`) |
| MB4 | the blank check also refuses `[]` | killed: bun 1, node 1 (same test, `[]` half) |
| MB5 | `every` in place of `some`, so `[A, ""]` is accepted | killed: bun 1, node 1 (same test, `[A, ""]` case) |
| MB6 | `+ added` printed only when the item had no seams | **survives** (541/0 on both halves; N-3) |
| MB7 | `clearField` prints dropped seams whatever field is cleared | **survives** (541/0 on both halves; N-3) |

No load-sensitive test failed under any mutant. The clone's `git status` at the end showed only the `node_modules` symlink.

## Probe C: live runs

Each project is a fresh copy of `sandbox/bench/template`, then `git init` and a commit, then `/Users/romerma/Code/mstack/bin/mstack setup`, then `state.verify` set to `python3 -m unittest discover -s tests` and committed, as `sandbox/bench/run.mjs:99-110` does (`scratchpad/review55r2/live/prep.sh`). Wrapper (`live/run.sh`):

```
cd <project>; exec /usr/bin/env -i HOME USER LOGNAME TERM LANG TMPDIR SHELL PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:<bun bin>:<claude bin dir> \
  claude -p "<prompt>" --model opus --output-format stream-json --verbose --setting-sources project \
  --strict-mcp-config --max-budget-usd 6 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto [--resume <session>] \
  > <stream>.jsonl 2> <stream>.err
```

The environment is rebuilt from those variable names only, and no ANTHROPIC_* variable is passed. A `perl alarm 600` caps each run at 10 minutes. claude is version 2.1.326. Every init event lists plugin `mstack`, `permissionMode: auto` and model `claude-opus-5-5`, and every `.err` is empty. No `claude -p` process is left running.

### streamA (the implementer's attempt 1, read, not rerun)

Judged under B-1. Excerpt of its one intake call, from `scratchpad/impl55r2/streamA.jsonl`:

```
TOOL Bash | set -e
mstack decide --phase intake --decision "Cleaning fee is a flat 2500 cents per stay, a named constant in bookings/domain/pricing.py, added inside pricing.quote so quote and book share it" ... --result "if wrong: move the constant; one-line change"
mstack decide --phase intake --decision "Percent discount applies to the room subtotal only; the fee is added after the discount and is never discounted" --why "a cleaning fee is a fixed cost; discounting it is the less common convention" ... --result "if wrong: quote with a discount is off by fee*percent; swap two lines and one test"
mstack decide --phase intake --decision "Cancel stays id-based (existing CLI 'cancel <id>'); the work is making it persist: JsonFileRepository.update must save" ...
mstack decide --phase intake --decision "No migration: bookings already stored keep their stored total_cents; cancelling does not change total_cents" ...
mstack state add --slug cleaning-fee-and-cancel ... --acceptance "the fee is not discounted: 'quote standard 2025-03-01 2025-03-02 --discount-percent 10' prints \$114.10" ... (no --decision-required)
TOOL Bash | mstack state set cleaning-fee-and-cancel --status in_progress ...
TOOL Agent | {"subagent_type": "mstack:implementer", ... "## Decisions already taken (do not revisit) ... 2. The percent discount applies to the room subtotal only. Add the fee after the discount, and ...
```

The user-facing text in that stream is two lines ("Cancel already exists, so I'll check whether it actually works through the CLI the guest uses." and "The diff is small and matches the brief. Now step 5: ..."). Neither mentions the discount.

### r1: a request with two soft forks (`live/r1.jsonl`, project `live/p1`)

Request (the whole prompt): `/mstack suites need a minimum stay of 2 nights now, so book should refuse a one-night suite. also add a $25 cleaning fee to suite stays; quote and book should both include it in the total they print.`

I built it around two choices the request leaves open, each with a different user-visible outcome: whether `quote` also refuses a one-night suite, and whether `--discount-percent` discounts the fee.

```
INIT plugins: ['mstack', ...] perm: auto model: claude-opus-5-5 session: 55985ad0-2336-4708-860f-06f166239052
TOOL Bash | mstack gate; ...; cat .../skills/router/references/intake.md; cat .../playbooks/feature.md
TOOL Bash | cat README.md bookings/domain/*.py bookings/app/service.py bookings/cli.py; ...
TEXT> skip intake? No: this is new work, so intake runs. Two reversible decisions to record, no product forks left open.
TOOL Bash | git switch -c feat/suite-min-stay-cleaning-fee && \
mstack decide --phase intake --decision "Minimum stay of 2 nights is enforced by book only; quote still prices a one-night suite" --why "Request names book as the command that refuses; it names quote only for the fee" --evidence "request 2026-11-17; service.book and pricing.quote are separate call sites" --result "if wrong: one extra check in quote, plus a test" && \
mstack decide --phase intake --decision "Cleaning fee is a flat 2500 cents added after any discount; the discount never reduces it" --why "Request says to add the fee to the total; a flat fee is not a nightly rate" --evidence "request 2026-11-17; pricing.quote applies discount_percent to the nightly subtotal" --result "if wrong: quote --discount-percent on suites prints a total off by up to 25 dollars times the discount" && \
mstack state add --slug suite-min-stay-cleaning-fee --title "Suites: 2-night minimum on book, 25 dollar cleaning fee in quote and book totals" \
  --acceptance "book refuses a one-night suite: CLI exits 1 and prints an error, and no booking is stored" ... (5 criteria) \
  --source "user request 2026-11-17: suites need a minimum stay of 2 nights now, ..." \
  --seam "CLI: python3 -m bookings book/quote exit code and stdout/stderr" \
  --seam "BookingService.book / BookingService.quote in bookings/app/service.py" && mstack state active
TOOL Bash | ... mstack state set suite-min-stay-cleaning-fee --status in_progress ...
TOOL Agent | {"subagent_type": "mstack:implementer", ... "Call it from `BookingService.book` only. `quote` must still price a one-night suite (decided: min stay is book-only)." ... "quote suite with --discount-percent applies the discount to nights only (e.g. 2 nights, 10% -> round(49998*0.9)+2500 = 47498)."
```

I sent SIGTERM at 81 s (`exit 143`). The store afterwards: item 1 is `in_progress` with `source`, 5 criteria and 2 seams, and no `decision_required`. `decisions.tsv` holds the two `intake` rows above.

### r2: a request with hard forks (`live/r2.jsonl`, project `live/p2`)

Request (the whole prompt): `/mstack cancelling a booking should refund the guest, and cancel should print the refund amount. guests who cancel at the last minute should get less back.`

The run succeeded: 5 turns, $0.26, 49.6 s.

```
INIT ... session: e1346670-b8b1-450c-bcf9-059509df3efc
TOOL Bash | mstack gate; ...; mstack state active; ...
TOOL Bash | cat README.md ... ; cat .../references/intake.md .../playbooks/feature.md
TOOL Bash | ... python3 -m bookings --db /tmp/p2probe.json book deluxe "Ada" ... && ... cancel 1 && ... list; ... cancel 1; ...
TOOL Bash | set -e
mstack decide --phase intake --decision "Fix JsonFileRepository.update to persist, as part of this item" ... --result "if wrong: one-line fix splits into its own item, no behaviour lost"
mstack decide --phase intake --decision "Cancelling an already-cancelled booking raises BookingError instead of succeeding again" ... --result "if wrong: drop the guard; callers relying on idempotent cancel see exit 1"
mstack decide --phase intake --decision "Refund stored as refund_cents on Booking, persisted in JSON with default 0 for old files" ...
mstack decide --phase intake --decision "Cancellation date is injected: service.cancel(id, today) and CLI --today defaulting to date.today()" ...
mstack decide --phase intake --decision "Refund math is integer cents, rounded down in the house's favour, in domain/pricing.py; no floats" ... --result "if wrong: at most one cent difference per refund"
mstack decide --phase intake --decision "CLI prints 'cancelled #<id> refund <\$amount>'" ...
mstack state add --slug cancel-refund --title "Refund the guest on cancel, smaller refund for last-minute cancellations" \
  --acceptance ... (5 criteria) --source "user request 2026-11-17: '...'" \
  --seam "CLI: python3 -m bookings --db <f> cancel <id> [--today YYYY-MM-DD] exit code and stdout" --seam "BookingService.cancel(booking_id, today) in bookings/app/service.py" --seam "refund function in bookings/domain/pricing.py" \
  --decision-required "1) Is the policy 100% refund when cancelled 7 or more days before check-in, and 50% when fewer than 7 days? Recommended: yes, a common hotel default, and 'less back' reads as reduced rather than nothing. 2) Should cancelling on or after the check-in date be refused (error, no refund) rather than refunding 0%? Recommended: yes, because a stay in progress or past is not a cancellation."
TEXT> I've added the work item as `cancel-refund`, but nothing is built yet. Before writing code I need your answer on two policy questions.
  ... **Decisions I made myself** (logged in `.mstack/decisions.tsv`, easy to change): ...
  **Your call:**
  1. Should guests get a 100% refund when they cancel 7 or more days before check-in, and 50% when they cancel with less than 7 days to go? Recommended: yes. ...
  2. Should cancelling on or after the check-in date be refused with an error, instead of going through with a 0% refund? Recommended: yes, ...
  You can answer "yes, yes", or give your own cutoff (days) and percentages. Once I have them, a separate reviewer checks the spec first, then the code gets written and reviewed.
RESULT success 0.2647 turns 5 duration_ms 49590
```

This run parked both forks and asked them once, late, in the final message of the turn. No playbook work followed, and no code was written. It took six reversible rows. One of them, "an already-cancelled booking raises BookingError", changes a user-visible exit code. I read it as a guard against a double refund the request implies, not a policy fork, but it sits close to the line B-1 is about.

### r3: resume with an answer to one fork only (`live/r3.jsonl`)

Prompt: `for 1: no, make the cutoff 14 days before check-in instead of 7, still 50% below that. I have not decided 2 yet.` The run succeeded: 5 turns, $0.35, 28.4 s.

```
TOOL Bash | set -e
mstack decide --phase intake --decision "Fork 1 answered by user: 100% refund when cancelled 14 or more days before check-in, 50% when fewer than 14 days" --why "user rejected the recommended 7-day cutoff and chose 14" --evidence "user reply 2026-11-17" --result "partial answer; fork 2 (cancel on/after check-in) still open"
mstack state set cancel-refund --decision-required "2) Should cancelling on or after the check-in date be refused (error, no refund) rather than refunding 0%? Recommended: yes, because a stay in progress or past is not a cancellation."
mstack state set cancel-refund --clear acceptance 2>/dev/null || true        <- refused by the CLI (N-6)
TEXT> I've recorded your 14-day cutoff ... Question 2 is now the only open question on the item, so I haven't started the spec or any code.
  ... Either answer changes what a guest sees, which is why I'm not choosing for you.
```

The store afterwards, plus my own check:

```
2026-11-17T09:35:56.298Z resolves=[]       <- the partial-answer row: plain, no --resolves
state.json: status "pending", decision_required "2) Should cancelling on or after ...", decision_resolved null
$ mstack state set cancel-refund --status in_progress
mstack: cancel-refund has an unanswered decision: "2) Should cancelling on or after the check-in date be refused ..."
        answer it with 'mstack decide --resolves cancel-refund ...' first
[exit 2]
[ok]    1 open item(s) with a decision fork, each answered or still in specifying
state.json unchanged by the refused move (cmp)
```

### r4: resume with the rest answered (`live/r4.jsonl`)

Prompt: `2: yes, refuse it. that settles everything, go ahead.`

```
TOOL Bash | mstack decide ... --why "user answers 2026-11-17" ... --resolves cancel-refund
  RESULT> mstack: resolving a fork needs --why to say something; got 23 characters, ...
TOOL Bash | mstack decide ... --evidence "user replies 2026-11-17" ... --resolves cancel-refund
  RESULT> mstack: resolving a fork needs --evidence to say something; got 23 characters, ...
TOOL Bash | mstack decide --phase intake --decision "1) 14-day cutoff: 100% refund when cancelled 14+ days before check-in, 50% when fewer. 2) yes: cancelling on or after the check-in date is refused with an error and no refund" --why "User chose a 14-day cutoff over the recommended 7 ..." --evidence "User replies in session 2026-11-17: '...14 days...' and '2: yes, refuse it'" --result "chosen: tiers 100%/50% split at 14 days; refuse on/after check-in" --resolves cancel-refund && mstack state active
  RESULT> recorded, and cancel-refund no longer has an open fork
(git switch -c feat/cancel-refund; state set --status specifying; .mstack/specs/cancel-refund/{proposal,design,requirements,tasks}.md written)
(current.md: "Feature playbook, spec path (item carried forks, now resolved)." ... "Next step: Run mstack:spec-reviewer")
TOOL Agent | {"subagent_type": "mstack:spec-reviewer", "description": "Review cancel-refund spec", ...
```

I sent SIGTERM at 90 s, once the spec-reviewer launched (`exit 143`). The store afterwards:

```
2026-11-17T09:36:54.890Z intake resolves=[cancel-refund] 1) 14-day cutoff: ...
state.json: status "specifying", decision_required "2) Should cancelling ...", decision_resolved "2026-11-17T09:36:54.890Z"
[ok]    1 open item(s) with a decision fork, each answered or still in specifying
PASSED - 0 failures, 1 warning
```

After the final answer the agent used `--resolves` on the row that answers every remaining fork, and the field reads as answered. It then took the spec path that `intake.md:36` and `SKILL.md:56-61` name: `specifying`, a spec directory, and an independent spec reviewer. The `--resolves` floors refused two thin rows before the third was accepted. The CLI working as designed.

## Probe D: the prose as executed

- **Step 3, Autonomy, the two paths, intake and orchestrate.** These agree on what happens after the fork round. It is the last message of the turn (`intake.md:35`). On the answer, the agent resumes at step 4, and a forked item takes the spec path (`intake.md:36`, `SKILL.md:59`). r2 to r4 show both. `intake.md:63-64` (orchestrate) is consistent with `orchestrate.md:13-15`, which defers field derivation to intake. The overlap between "reversible" and "product decision" is B-1. The stale "one named exception" is N-1.
- **The skip list** is complete against the route table, and new work, bug reports included, still goes through intake. "Why does X fail" is separable from "X fails" only by the route table's wording. See N-5.
- **The fork-round exception to the cap** is stated once (`SKILL.md:100-102`). `principles.md:73-74` contradicts it (N-1).
- **Em dashes.** `git diff b9a12f7..b61b694 -- . ':!.mstack' | rg '^\+' | rg '—'` finds nothing, so no added line in the whole item has one.

## Probe E: regression on the head

On the checkout, head `b61b69470a06f6ee674e80587498d8768275511a`, clean tree, with none of my processes running. The load average was about 10 from other work on the machine.

```
$ npm run test:bun      -> 541 pass, 0 fail, Ran 541 tests across 26 files. [89.62s]   exit 0
$ npm run test:node     -> tests 541, pass 541, fail 0                                  exit 0
$ npm run typecheck     -> bunx --bun tsc --noEmit                                      exit 0
$ ./bin/mstack lint-plugin .  -> PASSED - 0 failures, 0 warnings                        exit 0
$ ./bin/mstack gate     -> PASSED - 0 failures, 0 warnings                              exit 0
$ ./bin/mstack ledger check intake-step   (before my row)
FAIL no verdict at b61b6947; 3 row(s) exist at other SHAs and a new head SHA voids them
```

Neither load-sensitive test (`tests/costs.test.ts:698`, `tests/run.test.ts:239`) failed, on the head or under any of the 10 mutants.

Criteria 1, 5 and 6 were not undone by round 2:

- `git diff --quiet daacfbf..b61b694 -- licenses/` exits 0.
- The origin header on `intake.md:1` is untouched.
- The licence sha1s are `f8360150...` and `5f09b052...`, the same values round 1 matched against upstream.
- `licenses/` is not git-ignored, and the plugin source is `./`.
- Router step 3 is still between orient (steps 1-2) and the playbook (step 4).

## Requirement to test (round 2 changes)

| R | Test | Fails if broken? |
|---|---|---|
| a partial answer as a plain row, in either order with the re-state, leaves the fork open and refuses `in_progress` | `tests/decisions.test.ts:308` | yes (MA2) |
| a re-state of an answered fork clears the pointer, and `in_progress` is then refused | `tests/decisions.test.ts:339` | yes (MA1, MA3) |
| `--seam` on an item with none prints each added seam | `tests/seams.test.ts:89` | yes (MB1) |
| `--seam` on a replacement prints the added seams | none | no (MB6 survives, N-3) |
| `--clear seams` names each dropped seam | `tests/seams.test.ts:104` | yes (MB2) |
| blank seams refused on read, `[]` accepted | `tests/seams.test.ts:164` | yes (MB3, MB4, MB5) |
| a product fork is parked, never taken (prose) | none; live only | the live runs: fails in streamA and r1 (B-1) |

## Acceptance, quoted

| # | Criterion | Met? | Evidence | Rung |
|---|---|---|---|---|
| 1 | "the router runs intake between orient and copying the playbook, and it ends with mstack state add carrying acceptance derived from the request, a source, and the test seams" | Met | `SKILL.md:20-27`. r1 and r2: orient call, then intake, then `state add` with criteria quoting the request, `--source` and 2-3 `--seam`. | 5 (n=2 on bench template copies) |
| 2 | "intake finds facts in the repository and its documents and never asks the user for one" | Met | r1 read the pricing and service code. r2 reproduced the persistence bug and the double cancel on the CLI. Neither asked a fact. | 5 (n=2) |
| 3 | "a reversible decision is taken with its recommended answer and recorded with mstack decide: what was decided, why, and what it costs if wrong" | Met | r2: 6 `intake` rows, each with `--why`, `--evidence` and `if wrong: ...`. r1: 2 rows of the same shape, though both should have been forks (criterion 4). | 5 |
| 4 | "a product fork or an irreversible choice becomes decision_required on the item, and all forks of one request reach the user once, late, each with a recommended answer" | **Not met** | Met in r2 (two forks, one round, recommendations, a partial answer and a full answer handled exactly as `intake.md:38-41` says) and in the implementer's streamB. Not met in streamA and r1: user-visible pricing choices were taken as reversible decisions and built without asking (B-1). The partial-answer carrier is now sound (Probe A, MA1-MA3). | 5 for both outcomes (2 of 4 runs on this text failed) |
| 5 | "text derived from mattpocock/skills or obra/superpowers carries an origin header (repository, path, commit), and both MIT notices ship inside the plugin directory" | Met | Unchanged since round 1's upstream comparison: `git diff --quiet` on `licenses/`, header line untouched, same sha1s. | 4 |
| 6 | "one real request driven through /mstack in the sandbox produces an item with source, acceptance and seams; the transcript is pasted in the report" | Met | r2 transcript above. Item `cancel-refund` has `source`, 5 criteria and 3 seams. | 5 |

## Ledger

My row: `./bin/mstack ledger record intake-step b61b69470a06f6ee674e80587498d8768275511a verifier-failed --evidence .mstack/progress/review_intake-step_r2.md --verifier reviewer`. The suite, the typecheck, the lint and the gate are green. The live check of criterion 4 failed in two of four runs (B-1), so this records `verifier-failed`.

## What would turn this into an approval

1. B-1: one rule in `intake.md`'s Map (and one clause in the router's Autonomy section) that settles the overlap. A choice whose answers the user would see is a fork however cheap it is to change, with the `if wrong:` cost as the test. Then rerun streamA's request and the r1 request through `/mstack`, unmodified, and show the user-visible choices parked and asked in the one round.
2. Same round, because it touches the same rule: N-1 (the "one named exception" sentences).

Everything else can go to follow-ups.
