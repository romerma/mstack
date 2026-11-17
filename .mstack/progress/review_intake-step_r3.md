# Review - intake-step, round 3

**Verdict:** APPROVED

I reviewed `b61b694..ebf8757` (`ebf8757fb80ec5b203bf68d20e6598f103829dd9`): the prose in `skills/router/SKILL.md`, `skills/router/references/intake.md`, `skills/router/references/principles.md` and `CHANGELOG.md`, and two seams tests. Round 2's B-1 (the fork definition) is answered: on requests the implementer had not seen, three of three under-parking runs parked the one choice that changes what the product's user gets, and asked it once, late, with a recommendation, naming the slug. Two of two fully specified requests created the item with no `decision_required` and carried on into the playbook without asking. A fresh session (no `--resume`) found the parked item in four of four runs, with and without the slug, with and without `/mstack`, and handled a partial answer the way the text says. Both mutants from round 2's N-3 now die on both halves. The suite, the typecheck, the plugin lint and the gate are green at the head.

Nothing blocks. The non-blocking findings are below. N-1 is the one the coordinator should read: it concerns how the benchmark rerun (item 45) will behave.

## Blocking

None.

## Non-blocking

**N-1. An unattended prompt takes forks instead of stalling at them (the implementer's C4). Ruling: a fork taken on the user's behalf.**
C4's prompt was `sandbox/bench/tasks/T3/issue.md` plus the bench suffix (`sandbox/bench/run.mjs:37`: "You are running unattended: nobody will answer questions. Make reasonable decisions"). The agent said "I'm taking the remaining decisions myself and recording them, because this run is unattended", and recorded:

```
--decision "Existing discount_percent stays; when both are given, discount_percent applies first (existing float behaviour), then codes"
--why      "do not change existing behaviour; request does not mention the old option"
--result   "if wrong: combined use of the old option and codes prices differently; neither alone changes"
```

Applying the recorded order:
- It is not a fact. The project's existing behaviour covers `--discount-percent` used alone, and the row itself says that stays unchanged ("neither alone changes"). The combination of `--discount-percent` with the new codes is new behaviour. T3's text says nothing about it.
- It is a fork, because the answers charge different totals. On `quote deluxe 2025-03-01 2025-03-03 --discount-percent 10 --code WELCOME20`, applying the percent first gives 30100 x 0.9 - 2000 = 25090 cents. Applying it after the codes gives (30100 - 2000) x 0.9 = 25290. Refusing the combination is also possible.
- The row's own `if wrong:` line names a price the user would see, and by `intake.md:28-29` that makes it "a fork, not a row".

Three things mitigate it, so it is not a block. The prompt told the agent nobody would answer. The answer it took matches the request's own percent-before-fixed rule applied by analogy. Only combined use is affected. The gap is in the text: `intake.md` says nothing about a request that says nobody will answer.

The review-r3 decision prices this round as "an unattended run ... stops at the fork round" and counts a stall there as a failure. C4 shows the other outcome: the agent decides the fork and records it as reversible. Item 45 should count that outcome too, or the coordinator should rule on it. Either the suffix delegates the forks (then say so, and flag them in `--result`), or it does not (then the run stalls). That is a product fork for the coordinator, not a defect in this diff.

It also weakens the implementer's over-parking evidence. C1 to C4 all carried the suffix, which tells the agent to decide. My O1 and O2 have no suffix and are the cleaner over-parking runs.

**N-2. The `--resolves` placement rule is not loaded in a fresh session that answers a fork.**
The rule is "`--resolves <slug>` goes only on the `decide` row that answers every fork left in the field: `--decision` lists the numbered answers" (`intake.md:42-43`). It lives only in `intake.md`. A session that brings the answers skips intake (`SKILL.md:21-23`), and none of B1 to B4 read `intake.md` (checked by searching each stream's tool inputs for `intake.md`). B2 and B3 each got a full answer, split it into one row per fork, and put `--resolves` on a single one: B2 on fork 1's row, B3 on fork 3's. So `decision_resolved` points at a row that names one fork out of three. No fork was left open, because the user had answered all of them. B4, a partial answer in a fresh session, followed the partial-answer rule exactly even without the text in context (Probe B). The pointer row is only less readable than the text intends. Cheap fixes: have the fork round's `current.md` note carry the rule, or have router step 2 point at `intake.md`'s "Park a fork" section when it resumes a parked fork.

**N-3. "Closing a session" contradicts the parked-fork note.**
The fork round writes the slug and forks into `current.md` "so a fresh session finds them" (`intake.md:37-39`), and the `SessionStart` hook delivers that note (`src/hooks.ts:128-131`; seen in B1, B2 and B3). A session that ends at the fork round and follows `SKILL.md:152-154` ("reset `current.md` to its empty template") erases that note, and N-2 of round 2 comes back. None of the five parked runs I saw did this (U1, U2, U3, and the implementer's A2 and B2). One clause in Closing ("unless it records a parked fork") would remove the conflict.

**N-4. The fork test is stated three ways with different scopes.**
The three statements are:
- The Map row (`intake.md:17`) enumerates "what is charged, allowed, refused, stored, deleted or shown as a value".
- The test under the decide block (`intake.md:28-29`) is wider: "if it names something the product's user would notice".
- The Autonomy clause (`SKILL.md:94-95`) says "different user-visible outcomes".

They disagree at the margin on labels, exit codes and message text. U3 shows it. It recorded "move prints 'moved #<id> ...', the same fields and format as book's line, with the verb changed" with "if wrong: one word in the output line changes". By the Map list that is a reversible decision, because a verb is not a value. By the `if wrong:` test it is a fork. The agent took it. I rule that acceptable: the request settles the fields and format ("the way book does"), and the verb is cosmetic. Two related wording points:
- In the Map row, "however cheap the code change is" sits after "or it cannot be undone", so it reads as qualifying the irreversible clause. The Autonomy clause carries the intent unambiguously.
- "stored" in the Map row could be read as covering the stored shape. No run read it that way: U2 kept the schema choice as a row.

**N-5. Router step 2 reads `current.md` only if `current.md` says so.**
"If something is in flight, or `current.md` records a parked fork, read `.mstack/progress/current.md`" (`SKILL.md:18-19`) is circular. You have to read the file to know whether it records a parked fork. It works because the `SessionStart` hook prints any non-template `current.md` (`src/hooks.ts:128-131`), and every run I watched also read the file in its first call. The skip list's "resuming an item in flight" (`SKILL.md:22`) does not literally cover a parked item, which is `pending`. B2's answer did not name the slug and is covered only by step 2's clause. It worked: the agent resumed.

**N-6. Over-parking at the margin, with no extra stop.**
U1 parked "3) Should the code match case-insensitively ... and any other code be an error?". The project already matches room names exactly and refuses an unknown one (`sandbox/bench/template/bookings/domain/pricing.py:14-18`). O2 (`search.py`'s `==`) and C4 both treated the same kind of question as settled. The run had to stop for fork 1 anyway, so the cost was one more question in the same round. No run of mine stopped only for a choice the request or project settled.

**N-7. Docs.**
- `CHANGELOG.md:5-13` does not contradict the final text. It does not say that the classification is an order, that a cheap user-visible choice is still a fork, or that the fork round names the slug and leaves a `current.md` note.
- Two wiki pages predate this item and now read differently from it. `docs/wiki/The-CLI.md:258` says "A fork is usually found while `specifying`, which is after intake", but intake now parks forks at `state add`. `docs/wiki/How-A-Work-Item-Flows.md:113` defines a fork as one "whose two answers produce different work", where `intake.md:17` defines it by the result the product's user gets.

**N-8. Observations outside this item, not for this round.**
- B1 matched the feature playbook but did not copy its steps into a todo list. It wrote a plan into `current.md` instead, the same as round 2's N-6.
- U1's agent wrote a `current.md` note naming `mstack state show`, which does not exist. B1, B3 and B4 each tried it first.
- U1 and O2 had a `state add` refused because an `--acceptance` value started with `--`. Both retried. B3 hit the same on `decide --decision`.
- C2 and C4 tried `state set --status active`.

All of these are CLI ergonomics or router step 4 matters, filed elsewhere.

## Probe A: the fork definition, live

Each project is a fresh copy of `sandbox/bench/template` (or `template-hard`). I ran `git init` and a commit, then this checkout's `bin/mstack setup`, then set `state.verify` to `python3 -m unittest discover -s tests` and committed, as `sandbox/bench/run.mjs:97-111` does (`scratchpad/review55r3/bin/prep.sh`). The wrapper is `scratchpad/review55r3/bin/run.sh`:

```
cd <project>; exec perl -e 'alarm 600; exec @ARGV' /usr/bin/env -i HOME USER LOGNAME TERM LANG TMPDIR SHELL \
  PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:<bun bin>:<claude bin dir> \
  claude -p "<prompt>" --model opus --output-format stream-json --verbose --setting-sources project \
  --strict-mcp-config --max-budget-usd 6 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto \
  > <scratchpad>/review55r3/streams/<name>.jsonl 2> <scratchpad>/review55r3/streams/<name>.err
```

The environment is rebuilt from those variable names only, and no `ANTHROPIC_*` variable is passed. Streams are written outside the project directory. A watcher (`bin/watch.py`) parses the stream and sends SIGTERM 8 s after the main thread issues `--status in_progress|specifying|spec_ready` or launches an `mstack:*` subagent. Every init event shows plugin `mstack`, `permissionMode: auto` and model `claude-opus-5-5`, with `claude` at 2.1.326. Every `.err` is empty. `pgrep -fl 'claude -p'` finds nothing after the last run.

| Run | Request (the whole prompt) | Parked (`decision_required`) | Taken, with its `if wrong:` | Stopped | My ruling on each taken row |
|---|---|---|---|---|---|
| U1 (template) | `/mstack quote should take a --promo SUMMER option that takes 15% off stays in July and August. It replaces --discount-percent for that quote: giving both is an error.` | 1) a stay crossing the season edge: discount only the July/August nights? 2) promo on a stay with no summer nights: error? 3) code case-insensitive, other codes an error? | (a) promo on `quote` only: "book would need the same flag added later, no data affected". (b) both flags is an error, exit 1, by flag presence: "a script checking for argparse exit 2 sees 1 instead". (c) months 7 and 8 of any year, a night dated by its date in `[check_in, check_out)`: "a stay checking out Sep 1 would be priced differently by one night" | final message, 60 s, $0.30, item `pending`, slug named, `current.md` note | (a) fact, from the request. (b) fact, from the request plus the CLI's `error:`/exit 1 convention (`bookings/cli.py`). (c) fact, from the README's half-open stay, though its `if wrong:` names a price; fact-first is the right row. Fork 3 is over-parking at the margin (N-6). |
| U2 (template-hard) | `/mstack orders with a discount above 20 percent need a manager's sign-off now: place should refuse them unless --approved-by NAME is given, and the approver's name is kept on the order and shown by show.` | 1) CSV import obeys the rule too (the path the request never names)? 2) keep the approver on discounts of 20% or less? 3) fix two pre-existing persistence bugs first (reproduced on the CLI)? | (a) "above" means `> 2000` bp: "20.00% orders placed without sign-off". (b) `quote` unaffected: "quotes would need an approver flag added later". (c) a blank `--approved-by` is a `ValidationError`: "a blank approver would be refused that the user meant to accept". (d) stored as `approved_by`, raw, optional key, `show` appends ` approved_by=NAME`: "show format tweak, no data loss" | final message, 72 s, $0.45, `pending`, slug named, `current.md` note | (a) fact, from the request. (b) fact, from the request and the README ("Quoting changes nothing"). (c) fact, from the request ("NAME") and convention (`README.md:232` "A blank search text is rejected"). (d) fact (`README.md:177`, `:182`) plus a reversible format choice that follows `_cmd_show`. |
| U3 (template) | ``/mstack the front desk needs to move a booking to another room type for the same dates: add a move command, `move <id> <room>`, that prints the booking the way book does. It must refuse if the new room is already taken for those dates.`` | 1) reprice at the new room's rate? 2) refuse a cancelled booking? 3) same-room move succeeds? 4) fix the pre-existing overlap bug that `move` relies on (reproduced)? | (a) prints `moved #...`, book's fields, verb changed: "one word in the output line changes". (b) `BookingService.move` holds the rule, self excluded from the conflict check, `NotFound` / `BookingError` exit 1: "code moves between layers, no user-visible change" | final message, 69 s, $0.33, `pending`, slug named, `current.md` note | (a) borderline reversible, acceptable (N-4). (b) reversible layering plus a fact by convention (`cancel` raises `NotFound`; the CLI exits 1). |
| O1 (template) | `/mstack add a total command that prints the sum of the active bookings' totals, in the same money format list uses (for example $123.45). With no active bookings it prints $0.00. An optional --room limits it to one room type, the way --room works for list. BookingService gets a matching total(room=None) method that returns integer cents.` | nothing | (a) unknown `--room` prints `$0.00`, exit 0, like `list`: "a typo'd room shows $0.00 instead of an error". (b) `total` sums `self.list(room)`: "none user-visible" | `state set --status in_progress` at 29 s (stopped there) | (a) fact, from the request ("the way --room works for list") and `list`'s behaviour. (b) reversible. |
| O2 (template-hard) | `/mstack list should also accept --sku SKU and show only the orders that have a line for that sku. It combines with --status and --customer, and StockroomService.list_orders gets a matching optional sku argument. An unknown sku is not an error: it just lists nothing.` | nothing | (a) exact, case-sensitive sku match, as `Searcher.find_orders`: "list --sku bolt would not match BOLT". (b) a design row: filter inline in `Ordering.list_orders` | `in_progress`, `current.md` "Launch mstack:implementer", at 41 s | (a) fact, by convention (`stockroom/app/search.py`). (b) reversible. |

Stream excerpts (`scratchpad/review55r3/streams/<run>.jsonl`, rendered by `bin/show.py`):

```
U2  TOOL Bash | ... P place acme BOLT=3 --discount 5 --note "café" && P show O0001 ...
      RESULT> placed O0001\nO0001 placed customer=acme discount_bp=50000 ... 'note': 'caf?'
    mstack state add --slug manager-signoff-big-discounts ... --source "user request 2026-11-17: orders with a discount above 20 percent need a manager's sign-off" \
      --seam "CLI: python3 -m stockroom place ... --discount PCT --approved-by NAME, exit code and stdout/stderr" --seam "CLI: python3 -m stockroom show ORDER stdout" \
      --seam "StockroomService.place_order(customer_id, lines, discount_bp, note, approved_by)" \
      --decision-required "1) Should the rule live in the service, so CSV import obeys it too, with an optional approved_by column in the order CSV (rows above 20 percent
      without it fail with ImportFailed naming the line)? Recommended: yes, because otherwise import is a way around the sign-off. 2) ... 3) ..."
    TEXT> ... Please answer by naming the item, for example `manager-signoff-big-discounts: yes to 1, 2, 3`:
    RESULT success 0.45035080000000005 turns 8 duration_ms 72404

U3  --decision-required "1) Reprice the moved booking at the new room's nightly rate, so the printed total changes? Recommended: yes, because book prices every booking
      from its room's rate and no discount is stored on a booking. 2) Refuse to move a cancelled booking? ... 3) ... 4) Fix the shared overlap check ..."
    TEXT> ... Reply in the form `move-booking: yes to 1, 2, 3, 4`, or say which ones you want differently.
    RESULT success 0.3268514 turns 7 duration_ms 68808

O1  TEXT> Intake: everything is settled by the request or by `list`'s existing behaviour, so there are no forks. ...
    mstack state add --slug total-command ... (5 criteria, --source, 2 --seam, no --decision-required)
    RESULT> ... added 1 total-command (pending)
    TOOL Bash | ... mstack state set total-command --status in_progress ...
      RESULT> ... 1 total-command (in_progress)\n  status: "pending" -> "in_progress"

O2  mstack state add --slug list-sku-filter ... (4 criteria, --source, 2 --seam, no --decision-required)
      RESULT> added 1 list-sku-filter (pending)
    TOOL Bash | ... mstack state set list-sku-filter --status in_progress ...
      RESULT> 1 list-sku-filter (in_progress)\n  status: "pending" -> "in_progress"
```

Criterion 6's transcript is U1, request as in the table:

```
INIT plugins: ['mstack', ...] perm: auto model: claude-opus-5-5 session: 5aad30ae-a203-4ae8-9bb4-b00bd3666f1e
TOOL Bash | mstack gate; echo "---"; mstack state active; echo "---"; cat .mstack/progress/current.md ...; git ls-files | head -50
  RESULT> ... PASSED - 0 failures, 1 warning\n---\nno active item ...
TOOL Bash | cat .../skills/router/references/intake.md .../skills/router/playbooks/feature.md; cat bookings/cli.py bookings/domain/pricing.py bookings/app/service.py ... README.md
TOOL Bash | mstack decide --phase intake --decision "Promo applies to quote only; book, list, cancel unchanged" ... --result "if wrong: book would need the same flag added later, no data affected"
mstack decide --phase intake --decision "Giving both --promo and --discount-percent reports 'error: ...' on stderr with exit 1, detected by flag presence ..." ...
mstack decide --phase intake --decision "July and August means calendar months 7 and 8 of any year; a night is dated by its check-in-side date in the half-open stay [check_in, check_out)" ...
mstack state add --slug quote-summer-promo ... --acceptance "--promo replaces ..."      <- refused: an --acceptance value starting with "--" (N-8)
TOOL Bash | mstack state add --slug quote-summer-promo --title "quote --promo SUMMER: 15% off July/August stays" \
  --acceptance "quote accepts --promo SUMMER, which takes 15% off stays in July and August" \
  "--acceptance=--promo replaces --discount-percent for that quote: giving both is an error (stderr 'error: ...', exit 1)" \
  --acceptance "quote without --promo prices exactly as before, including --discount-percent" \
  --source "user request 2026-11-17 via /mstack:router" \
  --seam 'CLI: `python3 -m bookings quote ... --promo SUMMER` stdout, stderr, exit code' \
  --seam '`pricing.quote(room, check_in, check_out, discount_percent, promo)` in bookings/domain/pricing.py' \
  --decision-required "1) For a stay crossing the season edge (e.g. Jun 29 to Jul 3), should the 15% apply only to the nights in July/August, with the other nights at
  full rate? Recommended: yes, because it prices exactly the summer nights and has no cliff at the boundary; ... 2) Should --promo SUMMER on a stay with no July/August
  nights be an error rather than a silent full-price quote? Recommended: yes, ... 3) Should the code match case-insensitively ... Recommended: yes, ..."
  RESULT> added 1 quote-summer-promo (pending)\nno active item\n  1 quote-summer-promo (pending)  quote --promo SUMMER: 15% off July/August stays
TEXT> I've added the queue item. Next I'm writing its open questions into `current.md`, then I'll put them to you.
TOOL Bash | python3 - <<'EOF' ... "Waiting on the user's answers to the 3 forks parked on `quote-summer-promo` ... When they answer, record `mstack decide --phase intake ...
  --resolves quote-summer-promo`, then router step 4: feature playbook on the spec path." ... EOF
mstack gate | tail -2
  RESULT> PASSED - 0 failures, 2 warnings
TEXT> I've added the queue item **`quote-summer-promo`** but haven't written any code yet. "Stays in July and August" can be read several ways, and each reading charges
  or refuses customers differently, so those choices are yours. ... **Three questions on `quote-summer-promo`:** 1. ... **Recommended: yes.** 2. ... 3. ...
  Reply like `quote-summer-promo: yes to 1, 2, 3`, or change any of them. ...
RESULT success 0.30110560000000003 turns 7 duration_ms 60121
```

The item afterwards has `status: pending`, 3 criteria, `source`, 2 seams, the 3 numbered forks, and `decision_resolved: None`.

**The implementer's bench streams, read raw.**
- **C2** (T4 export, round-2-plus-B-1 text): "Intake: new work, no forks (the request settles every user-visible choice)". It ran `state add` with 6 criteria, a source and 2 seams, and no `--decision-required`, then `state set --status in_progress` ("pending" -> "in_progress"). The stop file says `killed-at-playbook`.
- **C4** (T3 discount codes, final text): 4 intake rows, then `state add` with no `--decision-required`, then `in_progress`, and `current.md` set to "Launch implementer with brief". The stop file says `killed-at-playbook`.

Nothing was parked in either run, and both carried on. C4 shows the unattended suffix at work (N-1).

**Rulings on the flagged rows.**
- **C4, "`--discount-percent` applies first, then codes"**: a fork taken on the user's behalf. See N-1 for the order applied step by step.
- **C4's other rows.** "Code matching is exact and case-sensitive", with "if wrong: guests typing lower case get 'unknown code'", is a fact. The request gives the codes as exact strings and calls an unknown code an error. Recording a fact as a row is harmless. "Validation order", with "if wrong: a request breaking two rules reports a different one of them; still refused", is correctly reversible: the result is the same refusal.
- **C2, "CSV uses Python csv module defaults (QUOTE_MINIMAL, CRLF line terminator per RFC 4180)"**, with "if wrong: lines end CRLF instead of LF", is a fact settled by the request: "quoted according to standard CSV rules", and RFC 4180 is the standard and ends records with CRLF. Recording it as a row is harmless. C2's JSON-whitespace and trailing-newline rows are correctly reversible: the parsed values and the text are the same.

I also checked the implementer's A2 and B2 raw streams (the round 2 failure requests, final text). Both put the discount question into `--decision-required` and ended the turn: A2 at $0.29 in 51 s, B2 at $0.22 in 33 s.

## Probe B: a fresh session brings the answers

**While parked**, before any answer, in the U1 and U2 projects:

```
$ /Users/romerma/Code/mstack/bin/mstack gate        (U1; U2 identical)
[ok]    no active item
[ok]    1 open item(s) with a decision fork, each answered or still in specifying
[warn]  on main; feature work belongs on its own branch
[warn]  4 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 2 warnings                     [exit 0]
$ mstack state active  -> no active item [exit 1]
current.md: "- **Item:** quote-summer-promo (pending, intake done, forks open)" ... Next step: "Waiting on the user's answers to the 3 forks parked on `quote-summer-promo` ..."
```

I snapshotted each parked `.mstack/` (`streams/U1.parked`, `streams/U2.parked`) and committed it in the project (`parked fork state`), so the agent could not find the item through `git diff`. Then I started a **new** session in the same project. The wrapper is the same, with no `--resume` and no `--continue` (`bin/resume.sh`). The watcher stops a run at an `mstack:*` subagent or `--status in_progress`.

| Run | Project | Prompt | Found it via | Recorded | Then | Stopped |
|---|---|---|---|---|---|---|
| B1 | U1 | `/mstack quote-summer-promo: yes to 1, 2, 3` (the form the round asked for) | the SessionStart hook printed the `current.md` note; the agent said "Intake: skip, resuming parked item `quote-summer-promo`." | one row listing all three answers, `--resolves quote-summer-promo` (the first try was refused by the `--evidence` floor, the second recorded) | `git checkout -b feat/quote-summer-promo`, `state set --status specifying`, `current.md` updated, `mstack:spec-author` launched with the three answers as settled decisions | at the spec-author launch, 68 s |
| B2 | U2 | `/mstack yes, go with your recommendation` (does not name the slug) | the SessionStart hook's `current.md` note | fork 1's row with `--resolves`, then forks 2 and 3 as plain rows (N-2) | fork 3's answer ("fix the persistence bugs first, as a separate item") became item 2 `fix-discount-note-persistence`, reproduced on the CLI and set `in_progress`; item 1 stays `pending`, resolved, with "Then feature item on spec path" in `current.md` | at `in_progress`, 101 s |
| B3 (extra) | copy of U1's parked state | `quote-summer-promo: yes to 1, 2, 3` (exactly as asked, no `/mstack`) | the hook and `state.json` | three rows, `--resolves` on fork 3's (N-2) | "Fork resolved. Moving to the spec path.", invoked `mstack:spec`, launched `mstack:spec-author` | at the spec-author launch, 59 s |
| B4 (extra) | copy of U1's parked state | `/mstack quote-summer-promo: yes to 1. I have not decided 2 and 3 yet.` | the hook | a plain row for fork 1, the field re-stated with forks 2 and 3 only, no `--resolves` | asked 2 and 3 again and ended the turn; `current.md` Next step updated | ended by itself, 34 s, $0.19 |

```
B1  SYS hook_response ... "- No active work item.\n\nLast recorded checkpoint (.mstack/progress/current.md):\n\n# Current session ... Waiting on the user's answers to the 3 forks parked on `quote-summer-promo` ..."
    TEXT> Intake: skip, resuming parked item `quote-summer-promo`. The user answered yes to all three forks, so I record that and resolve the fork.
    TOOL Bash | mstack decide --phase intake --decision "Forks resolved as recommended: 1) 15% applies only to July/August nights, ...; 2) --promo SUMMER with no July/August nights is an error; 3) codes match case-insensitively, unknown codes are an error" ... --resolves quote-summer-promo
      RESULT> recorded, and quote-summer-promo no longer has an open fork
    TOOL Bash | git checkout -b feat/quote-summer-promo && mstack state set quote-summer-promo --status specifying ...
      RESULT> Switched to a new branch 'feat/quote-summer-promo'\n1 quote-summer-promo (specifying)\n  status: "pending" -> "specifying"
    TOOL Agent | {"subagent_type": "mstack:spec-author", "description": "Spec quote-summer-promo", ... "Settled decisions (user approved, do not reopen): 1. ..."}

B4  TOOL Bash | mstack decide --phase intake --decision "Fork 1 answered yes: ..." ... --result "if wrong: edge-crossing stays priced per-night instead of all-or-nothing" &&
      mstack state set quote-summer-promo --decision-required "2) Should --promo SUMMER on a stay with no July/August nights be an error ... 3) Should the code match case-insensitively ..."
      RESULT> recorded\n1 quote-summer-promo (pending)\n  decision_required: "1) For a stay crossing the season edge (e.g. ..." -> "2) Should --promo SUMMER on a stay with no Ju..." ... gate=0
    RESULT> I recorded your answer to fork 1. The other two forks are still open, so I haven't started any work on `quote-summer-promo`. ...
$ mstack state set quote-summer-promo --status in_progress        (my check, in B4 afterwards)
mstack: quote-summer-promo has an unanswered decision: "2) Should --promo SUMMER on a stay ... (Fork 1 answered yes 2026-11-17, see decisions.tsv.)"
        answer it with 'mstack decide --resolves quote-summer-promo ...' first
[exit 2]
```

The store after B1 and B2:

```
U1  * 1 quote-summer-promo (specifying)   resolved= 2026-11-17T10:13:20.436Z   branch feat/quote-summer-promo   gate exit 0
U2    1 manager-signoff-big-discounts (pending)   resolved= 2026-11-17T10:13:25.344Z
    * 2 fix-discount-note-persistence (in_progress)                            branch fix/discount-note-persistence   gate exit 0
U2 decisions.tsv: 10:13:25.344Z intake resolves=[manager-signoff-big-discounts] | fork 1: sign-off rule lives in StockroomService.place_order; ...
                  10:13:32.245Z intake resolves=[] | fork 2: --approved-by on discount <=20% is kept and shown
                  10:13:32.276Z intake resolves=[] | fork 3: fix discount 100x reload and non-ASCII note persistence bugs first, as a separate item
```

## Probe C: the prose, read as the agent that executes it

- **What ends the turn.** The fork round is "the final message of the turn: stop there" (`intake.md:39`), and interactive mode says "then wait" (`intake.md:75`). All three parked runs ended there. The only conflict is "Closing a session" (N-3).
- **The cap exceptions.** These are stated once, at `SKILL.md:101-103`. `principles.md:73-74` and `CHANGELOG.md:12-13` point to them and no longer say "one". Round 2's N-1 is fixed.
- **The skip list.** This is `SKILL.md:21-24`, with step 2's parked-fork clause covering an answer that does not name the slug (N-5).
- **The spec path.** `intake.md:40` and `SKILL.md:60` agree, and `--resolves` leaves `decision_required` in place, so the item stays on the spec path. B1 and B3 took it.
- **The fork definition.** It is stated three times with different scopes (N-4). The order ("taking the first row that fits", `intake.md:11`) is what kept facts with user-visible `if wrong:` lines out of the fork round in U1, U2, O1, O2 and C4.
- **Length.** `intake.md` is 77 lines, against 68 in round 1 and 73 in round 2. It is still cheap to read on every new request. The sentence I would cut first is `intake.md:27-28` ("`--result` carries the cost: it is the column a later reader scans for what the decision left behind."), since the `decide` block's `--result "if wrong: <what it costs>"` already says it. Nothing else is redundant enough to drop without losing a rule.
- **Em dashes.** `git diff b61b694..ebf8757 -- . ':!.mstack' | rg '^\+' | rg '—|–'` finds nothing (exit 1). Over the whole item, `git diff b9a12f7..ebf8757 -- . ':!.mstack' | rg '^\+' | rg -c '—'` finds none.
- **`CHANGELOG.md` and `docs/wiki/`.** No contradiction in `CHANGELOG.md`, but it omits round 3's rule. Two older wiki sentences read differently (N-7).

## Probe D: tests

**Mutants.** I applied each to a clone at the head (`scratchpad/review55r3/clone`, `node_modules` symlinked) with `bin/mutants.py`, ran both halves in full, then reverted. `git status --porcelain` afterwards showed only `?? node_modules`.

| Mutant | Change in `src/cli.ts` | bun | node |
|---|---|---|---|
| MB6 | `:664` `for (const added of next)` -> `for (const added of before.length === 0 ? next : [])` | killed: 541 pass, 1 fail, `(fail) state set --seam replaces the list, says what it dropped, and counts as an instruction` | killed: `ℹ tests 542`, `ℹ pass 541`, `ℹ fail 1`, `✖ state set --seam replaces the list, says what it dropped, and counts as an instruction` |
| MB7 | `:322` `if (key === "seams") for (...)` -> `for (...)` (drops printed whatever field is cleared) | killed: 541 pass, 1 fail, `(fail) clearing another field on an item with seams does not report a dropped seam` | killed: `ℹ pass 541`, `ℹ fail 1`, `✖ clearing another field on an item with seams does not report a dropped seam` |

The two tests are `tests/seams.test.ts:84` (`assert.match(set.stdout, /added "the only seam left"/, ...)`) and `tests/seams.test.ts:90-101` (`--clear source` on an item with seams: seams untouched, `doesNotMatch(/dropped/)`). Neither weakens an existing assertion.

**Regression on the head.** I ran this on the checkout at `ebf8757fb80ec5b203bf68d20e6598f103829dd9`, with a clean tree and none of my live runs going. The load average was 9 to 10 from other work on the machine.

```
$ npm run test:bun          -> 542 pass, 0 fail, Ran 542 tests across 26 files. [88.05s]   exit 0
$ npm run test:node         -> ℹ tests 542, ℹ pass 542, ℹ fail 0                          exit 0
$ npm run typecheck         -> bunx --bun tsc --noEmit                                     exit 0
$ ./bin/mstack lint-plugin . -> PASSED - 0 failures, 0 warnings                            exit 0
$ ./bin/mstack gate          -> [ok] on branch feat/intake-step, [ok] working tree is clean, PASSED - 0 failures, 0 warnings   exit 0
$ ./bin/mstack gate --full   -> ... 542 pass / 0 fail (bun), ℹ pass 542 / ℹ fail 0 (node), lint PASSED,
                                [ok] npm test && npm run typecheck && bin/mstack lint-plugin .  PASSED - 0 failures, 0 warnings   exit 0
$ ./bin/mstack ledger check intake-step      (before my row)
FAIL no verdict at ebf8757f; 5 row(s) exist at other SHAs and a new head SHA voids them
```

Neither load-sensitive test (`tests/costs.test.ts:698`, `tests/run.test.ts:239`) failed in any of the four full runs: the head twice, and both mutants.

**Criteria 1, 2, 3, 5 and 6 were not undone by round 3.**
- `git diff --quiet b61b694..ebf8757 -- licenses/` exits 0.
- No `<!--` line in `intake.md` changed.
- The licence sha1s are still `f8360150...` and `5f09b052...`.
- `licenses/` is not git-ignored, and the plugin source is `./`.
- Router step 3 is still between orient (steps 1-2) and the playbook (step 4), at `SKILL.md:17-29`.
- The live runs above exercised criteria 1, 2, 3 and 6 again.

## Requirement to test (round 3 changes)

| R | Test | Fails if broken? |
|---|---|---|
| a replacement of `--seam` names what it added | `tests/seams.test.ts:84` | yes (MB6) |
| clearing another field prints no dropped seam | `tests/seams.test.ts:90` | yes (MB7) |
| a user-visible choice nothing settles is parked, however cheap (prose) | none; live only | U1, U2, U3 parked; impl A2, B2 parked |
| a fully specified request is not parked (prose) | none; live only | O1, O2 not parked; C2, C4 not parked, under the unattended suffix |
| the fork round names the slug and leaves a `current.md` note; a fresh session finds it (prose plus the existing hook) | none; live only | U1, U2, U3 wrote it; B1 to B4 found it |

## Acceptance, quoted

| # | Criterion | Met? | Evidence | Rung |
|---|---|---|---|---|
| 1 | "the router runs intake between orient and copying the playbook, and it ends with mstack state add carrying acceptance derived from the request, a source, and the test seams" | Met | `SKILL.md:17-29`. In U1, U2, U3, O1 and O2: gate and `state active`, then intake, then `state add` with criteria quoting the request, `--source` and 2 to 3 `--seam`. | 5 (n=5 on bench template copies) |
| 2 | "intake finds facts in the repository and its documents and never asks the user for one" | Met | U2 and U3 reproduced pre-existing bugs on the CLI before asking anything. O2 found the sku-match convention in `search.py`. U1 found the night-dating rule in the README. No fork round asked a fact. | 5 |
| 3 | "a reversible decision is taken with its recommended answer and recorded with mstack decide: what was decided, why, and what it costs if wrong" | Met | Every taken row in U1 (3), U2 (4), U3 (2), O1 (2) and O2 (1 + 1 design) has `--why`, `--evidence` and `if wrong: ...`. | 5 |
| 4 | "a product fork or an irreversible choice becomes decision_required on the item, and all forks of one request reach the user once, late, each with a recommended answer" | Met | **U1, U2, U3:** the target fork and the related ones went into one numbered `--decision-required`, each with "Recommended:", asked in one final message that names the slug, with the item `pending`. **O1, O2:** no fork, carried on. **B1 to B4:** a fresh session picks the item up, and a partial answer keeps the rest open (`in_progress` refused). **C4:** a borderline fork taken under the unattended suffix (N-1, non-blocking). | 5 (n=3 under, n=2 over, n=4 fresh sessions) |
| 5 | "text derived from mattpocock/skills or obra/superpowers carries an origin header (repository, path, commit), and both MIT notices ship inside the plugin directory" | Met | Untouched since round 1's upstream comparison: `git diff --quiet` on `licenses/`, header line unchanged, same sha1s. | 4 |
| 6 | "one real request driven through /mstack in the sandbox produces an item with source, acceptance and seams; the transcript is pasted in the report" | Met | The U1 transcript above. Item `quote-summer-promo` has `source`, 3 criteria and 2 seams. | 5 |

## Ledger

My row: `./bin/mstack ledger record intake-step ebf8757fb80ec5b203bf68d20e6598f103829dd9 live-verified --evidence .mstack/progress/review_intake-step_r3.md --verifier reviewer`. The prose behaviour this round changes was checked in the running system (rung 5): 9 live runs on bench template copies. The CLI tests were checked at rung 4: both halves, plus 2 mutants killed.

## Artefacts

Everything is under `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review55r3/`:
- `bin/`: `prep.sh`, `run.sh`, `go.sh`, `resume.sh`, `watch.py`, `show.py`, `mutants.py`
- `streams/`: `<run>.jsonl`, `.err`, `.prompt`, `.stop`, the parked snapshots, `mutants.out`, `node_MB6.out`, `node_MB7.out`, `head_bun.out`, `head_node.out`, `gate_full.out`
- `live/`: the projects
- `clone/`: the mutant clone
