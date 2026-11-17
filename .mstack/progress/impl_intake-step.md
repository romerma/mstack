# impl intake-step (item 55)

## What changed

Intake is step 3 of "First, orient" in the router (matching the playbook is now step 4), with its method in `skills/router/references/intake.md`. Items gained an optional `seams: string[]` field (`state add --seam` repeatable, `state set --seam` replaces, `--clear seams`, empty refused). The two MIT notices ship under `licenses/`. The exception to the question cap is named once in the router's Autonomy section and once in principles.md.

Commits on `feat/intake-step`: 4ee764f seams field with tests and the CLI wiki page; e90e605 router step, reference, principles sentence, orchestrate command, README credit sentence, CHANGELOG, wiki router paragraph; d1bd001 the notices (the README sentence landed one commit before the files it names). The report commit follows.

## Files

- src/state.ts:38 (field), :189-191 (validation), :208 (parse), :224 (unknown-key set)
- src/cli.ts:203 (CLEARABLE seams), :306 (seamList), :405 (add), :491 (contradiction), :659-663 (set, replaced/dropped lines); preview and fieldChange accept a list
- tests/seams.test.ts (new, 9 tests, 60s spawn timeouts)
- skills/router/SKILL.md (steps 3 and 4, Autonomy exception), skills/router/references/intake.md, skills/router/references/principles.md, skills/router/playbooks/orchestrate.md
- licenses/mattpocock-skills-LICENSE.txt, licenses/obra-superpowers-LICENSE.txt
- README.md (Credit), CHANGELOG.md, docs/wiki/The-CLI.md, docs/wiki/Skills-and-Playbooks.md

Origin header (HTML comment, line 1 of intake.md): mattpocock/skills `skills/productivity/grilling/SKILL.md` @ 49dd158d1076134a641b33efb035946536778336 (verified in installed_plugins.json); obra/superpowers `skills/subagent-driven-development/SKILL.md` @ 22f0b463e7a5e579904dd6211a520321035526f7 (verified; "Rulings, not stalls" at lines 19-25). `lint-plugin` checks only links, so it accepts any header.

## Red output (tests first)

Before any src change: 8 fail, 1 pass (the pass is "no --seam writes no key"). Reasons:
```
AssertionError: mstack: Unknown option '--seam'   (state add and state set, 2 !== 0)
AssertionError: ... /an empty --seam is not a value/. Input: "mstack: Unknown option '--seam'"
AssertionError: mstack: 'seams' is not a field 'state set' can clear
seams survive ...: the parsed item has no seams (parse rebuilds from known fields)
non-array seams: seams "one string" must be refused, 0 !== 2
```
After implementing: 9 pass, 0 fail.

## Mutant table

Note: I listed the mutants from the test list before implementing but wrote the table down only afterwards. Each was applied by hand (script in the scratchpad) and reverted from a saved copy.

| Mutant | Result |
|---|---|
| M1 `--seam ""` accepted | killed (1 failing) |
| M2 `state set --seam` appends | killed (1) |
| M3 `--clear seams` leaves `seams: []` | killed (1) |
| M4 seams dropped on read | killed (7) |
| M5 `state set` does not print seams | killed (2) |
| M6 non-array seams accepted | killed (1) |
| M7 `state add` ignores `--seam` | killed (2) |
| M8 `--seam` with `--clear seams` not refused | killed (1) |
| M9 seam stored untrimmed | killed (2) |

0 survived.

## VERIFY

1. Tails: `npm test` exit 0; bun half "538 pass, 0 fail, Ran 538 tests across 26 files"; node half "tests 538, pass 538, fail 0". `bun run typecheck` printed only `$ bunx --bun tsc --noEmit`, exit 0. `./bin/mstack lint-plugin .` "PASSED - 0 failures, 0 warnings". `node scripts/check-doc-links.mjs README.md docs/wiki/*.md` "96 relative links checked, 0 broken".

2. Real CLI, throwaway store `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl55/cli/`:
```
state add (two --seam)  -> added 1 demo (pending), exit 0
on disk: "seams": ["CLI: `mstack state add` exit code and stdout", "`withLock(file, run, opts)` in src/tsv.ts"]
state set 1 --seam "only the CLI"
1 demo (pending)
  seams: 2 seam(s) replaced with 1
    - dropped "CLI: `mstack state add` exit code and stdout"
    - dropped "`withLock(file, run, opts)` in src/tsv.ts"
state set 1 --seam ""
mstack: an empty --seam is not a value
        name the public surface where a test attaches, or run 'state set <ref> --clear seams'   (exit 2)
state set 1 --clear seams       -> seams: 1 seam(s) -> (unset); key absent on disk
state set 1 --seam x --clear seams -> --seam and --clear seams in one command contradict each other (exit 2)
state add ... --seam ""         -> an empty --seam is not a value (exit 2)
```

3. Live run (acceptance 6), one attempt, no failed attempts. Project `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl55/proj1/` (copy of sandbox/bench/template, `setup` run). Command, clean `env -i` as in sandbox/bench/run.mjs: `claude -p <prompt> --output-format stream-json --verbose --setting-sources project --strict-mcp-config --max-budget-usd 6 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto` (wrapper `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl55/run.sh`, stream `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl55/stream1.jsonl`). The init event lists plugin `mstack`; model claude-fable-5-2; result success, 7 turns, $0.58, exited on its own.

Request:
> /mstack Let guests ask for a late checkout when they book: the booking command takes it, and the quote and the booking should say so. Scope for this session: intake only. Create the queue item and present what needs the user; do not implement it.

The "intake only" sentence is mine, added to stop the run before implementation.

Item in proj1 `.mstack/state.json`:
```
id 1, slug late-checkout-request, status pending
source: "User request 2026-11-17: 'Let guests ask for a late checkout when they book: ...'"
acceptance (5): e.g. "'the booking should say so': the 'booked #...' confirmation line and the booking's 'list' line both name the late checkout when it was asked for, and neither mentions it when it was not"
seams (4): "CLI: 'bookings book ... --late-checkout' exit code and stdout, via main(argv, service, out, err) in bookings/cli.py";
           "CLI: 'bookings list' and 'bookings quote ... --late-checkout' stdout, same main() entry";
           "BookingService.book(...) / .quote(...) in bookings/app/service.py";
           "JsonFileRepository round trip in bookings/adapters/jsonfile.py"
decision_required: "1) Should a late checkout be free, so the quote and the booking total stay the same and only say that it was asked for? Recommended: yes, because the request names no fee and nothing in pricing.py charges for extras; a fee needs an amount from you. 2) Should a late checkout stay a request only, with no effect on whether the room can be booked by someone else? Recommended: yes, because ..."
```
`decisions.tsv` in proj1 has four `intake` rows, each with `result` "if wrong: ..." (for example "if wrong: the flag grows a time value later; stored booleans would need a default time"). Facts were found by reading and running the project (for example `book deluxe 03-01..03-04` then `03-04..03-06` exits 1, an existing overlap bug, recorded as a decision to leave it out).

No question asked for a fact: the final text puts two numbered questions, both forks. Weaker than the method: fork 2 is borderline (the run says neither answer changes anything observable today), and the run appended to `.mstack/progress/history.md` unprompted.

Transcript (tool calls abbreviated, results cut at 160 characters, final text in full):
```
INIT plugins: ['mstack', 'cc-plugin-agents-md', 'cc-plugin-telemetry', 'cc-plugin-privacy', 'cc-plugin-plugin-authoring', 'cc-plugin-easel'] perm: auto model: claude-fable-5-2
TOOL Bash | mstack gate; echo "--- exit $?"; mstack state active; echo "--- exit $?"; cat /Users/romerma/Code/mstack/skills/router/references/intake.md; echo ---; git ls-files | head -100
  RESULT> -- store\n[ok]    state.json exists\n[ok]    progress/current.md exists\n[ok]    progress/history.md exists\n[ok]    state.json parses and has the right shape (0 it
TOOL Bash | cat README.md bookings/cli.py bookings/app/service.py bookings/domain/booking.py bookings/domain/pricing.py bookings/adapters/jsonfile.py; grep -rn -i "late\|checkout\|check.out\|fee\|surcharge" --include=*.py --include=*.md . | grep -v "^./.mstack" | head -40; cat .mstack/progress/current.md
  RESULT> # bookings\n\nA small room-booking system in hexagonal style, Python 3.9, standard library only.\n\n    bookings/domain/    money (integer cents), Booking, pricing,
TOOL Bash | grep -n -i "overlap\|conflict\|back\|booked #\|def test" tests/*.py | head -60; python3 -m unittest discover -s tests 2>&1 | tail -4; cat .mstack/progress/history.md; cat .mstack/decisions.tsv; mstack state add --help 2>&1 | head -40; git log --oneline -5 -- bookings | cat
  RESULT> tests/test_adapters_cli.py:14:    def test_bookings_survive_reload(self):\ntests/test_adapters_cli.py:24:    def test_ids_continue_after_reload(self):\ntests/test
TOOL Bash | d=$(mktemp -d); python3 -m bookings --db $d/b.json book deluxe "A" 2025-03-01 2025-03-04; python3 -m bookings --db $d/b.json book deluxe "B" 2025-03-04 2025-03-06; echo "exit $?"; python3 -m bookings --db $d/b.json quote deluxe 2025-03-01 2025-03-04
  RESULT> booked #1 deluxe A 2025-03-01..2025-03-04 $451.50\nerror: deluxe is already booked from 2025-03-01 to 2025-03-04\nexit 1\n$451.50
TOOL Bash | set -e
mstack decide --phase intake --decision "Late checkout is a yes/no request: an optional --late-checkout flag on 'book', default off, with no time of day" --why "The request says guests 'ask for a late checkout'; nothing names a time, and the domain models dates only" --evidence "bookings/cli.py book parser; bookings/domain/booki
  RESULT> recorded\nrecorded\nrecorded\nrecorded\nadded 1 late-checkout-request (pending)\n  1 late-checkout-request (pending)  Guests can ask for a late checkout when booking
TOOL Bash | cat >> .mstack/progress/history.md <<'EOF'

## 2026-11-17: intake for late-checkout-request (item 1)

- Scope was intake only. No code was written and no playbook ran.
- Added item 1 `late-checkout-request` (pending) with five acceptance criteria and four seams.
- Four reversible decisions recorded in `decisions.tsv` under phase `intake`.
- Two forks parked on the item's `decision_required`: wheth
  RESULT> [warn]  3 uncommitted change(s); expected mid-session, not at close\n\nPASSED - 0 failures, 2 warnings
TEXT> The queue item is created: item 1, `late-checkout-request`, pending. No code was written, and it needs two answers from you before it can be built.

## What needs you

Both are worded so "yes" accepts my recommendation.

1. **Should a late checkout be free?** The quote and the booking total would stay the same and only say that it was asked for. Recommended: yes, because your request names no fee and nothing in `bookings/domain/pricing.py` charges for extras. If no, I need the amount.
2. **Should a late checkout stay a request only, with no effect on whether someone else can book the room?** Recommended: yes, because the guest "asks" for it. A same-day arrival in that room is already rejected today, so neither answer changes anything observable yet.

## What the item says

Acceptance, as recorded:

- `book ... --late-checkout` exits 0 and creates the booking. Without the flag, `book` behaves and prints exactly as today.
- The `booked #...` confirmation line and the `list` line both name the late checkout when it was asked for, and neither mentions it otherwise.
- The request survives a reload from the JSON file, and data files written before this change load as no late checkout.
- `quote ... --late-checkout` prints the price and names the late checkout. Without the flag, quote output is unchanged.
- The existing 18 tests still pass.

## Decisions I took

These are reversible and recorded in `.mstack/decisions.tsv`:

- **Yes/no flag:** late checkout is `--late-checkout` with no time of day, since the domain only models dates.
- **Quote takes the flag too:** `quote` has no booking to read the request from, so it has to be told.
- **Where the booking says so:** the confirmation line, the `list` line and the stored record.
- **Same-day turnover left out:** booking a room from the day another stay ends is rejected today, which contradicts the half-open stay described in `README.md`. I confirmed this by running it. It is not queued; say if you want it as its own item.

## State

- The gate passes with two warnings: the branch is `main`, and there are uncommitted changes.
- The uncommitted changes are `.mstack/state.json`, `.mstack/decisions.tsv` and `.mstack/progress/history.md`. I did not commit them.
- Because the item carries a decision fork, it goes down the spec path once you answer.
RESULT success 0.5819272 7

```

4. Interactive run, `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl55/proj2/`, stream `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl55/stream2.jsonl`. Request:
> /mstack Stress-test my plan before we build anything: I want guests to be able to get a late checkout on a booking, charged as a flat fee, and I think it should just be a flag on the book command. Hazme todas las preguntas que hagan falta.

Success, 5 turns, $0.46. It said "Because you asked to be questioned, intake is in interactive mode", found facts itself (two real bugs, by running the CLI), and ended with 13 numbered questions each with a recommended answer, then "Answer by number". In proj2 `state list` prints "no items", decisions.tsv holds only the header, and the stream has no `state add` or `decide`. Question 2 asks for a price, a product decision rather than a findable fact. The first launch of this run did not start (the auto-mode classifier gave no verdict on the setup command); I retried once as is.
```
INIT plugins: ['mstack', 'cc-plugin-agents-md', 'cc-plugin-telemetry', 'cc-plugin-privacy', 'cc-plugin-plugin-authoring'] perm: auto model: claude-fable-5-2
TOOL Bash | mstack gate; echo "gate exit: $?"; mstack state active; echo "---"; cat /Users/romerma/Code/mstack/skills/router/references/intake.md; echo "---"; git ls-files | head -100
TOOL Read | /Users/romerma/Code/mstack/skills/router/playbooks/feature.md
  RESULT> -- store\n[ok]    state.json exists\n[ok]    progress/current.md exists\n[ok]    progress/history.md exists\n[ok]    state.json parses and has the right shape (0 it
  RESULT> 1	# Feature\n2	\n3	1. `/mstack:understand` over the subsystems this touches. Skipping this on unfamiliar code is\n4	   how a feature ends up parallel to the one th
TOOL Bash | cat README.md bookings/cli.py bookings/app/service.py bookings/domain/*.py bookings/ports/repository.py bookings/adapters/jsonfile.py; wc -l tests/*; grep -n "def test" tests/*
  RESULT> # bookings\n\nA small room-booking system in hexagonal style, Python 3.9, standard library only.\n\n    bookings/domain/    money (integer cents), Booking, pricing,
TOOL Bash | cd "$PWD" && rm -f /tmp/lc_probe.json && python3 -m bookings --db /tmp/lc_probe.json book deluxe "A" 2025-03-01 2025-03-04; python3 -m bookings --db /tmp/lc_probe.json book deluxe "B" 2025-03-04 2025-03-06; echo "exit $?"; python3 -m bookings --db /tmp/lc_probe.json cancel 1; python3 -m bookings --db /tmp/lc_probe.js
  RESULT> booked #1 deluxe A 2025-03-01..2025-03-04 $451.50\nerror: deluxe is already booked from 2025-03-01 to 2025-03-04\nexit 1\ncancelled #1\n#1 deluxe A 2025-03-01..2025
TEXT> Gate is green (one warning: we are on `main`), nothing is in flight, and this routes to the feature playbook. Because you asked to be questioned, intake is in interactive mode: I looked up the facts myself, the decisions are yours, and nothing is built or queued until the questions are settled.

## What I found in the code

- **A flag on `book` fits mechanically.** `book` in `bookings/cli.py` takes four positionals and calls `BookingService.book`, which prices via `pricing.quote` and stores a single `total_cents`.
- **There is no time of day anywhere.** A stay is two dates. "Late" has nothing to be late relative to, so today it can only be a boolean plus a fee.
- **There is no way to change a booking after creation.** The commands are `book`, `cancel`, `list`, `quote`. A flag on `book` means a guest who asks at the front desk mid-stay cannot get late checkout without cancel and rebook.
- **Same-day turnover is already rejected, by a bug.** The README says stays are half-open, but `Booking.overlaps` compares inclusively. I ran it: booking deluxe 03-01..03-04 and then 03-04..03-06 fails with "already booked". So the conflict a late checkout would create with the next arrival is currently hidden behind this bug.
- **Cancel does not persist.** `JsonFileRepository.update` never saves. I ran it: `cancel 1` prints "cancelled #1" and the next `list` still shows it. Any "add late checkout to an existing booking" design would hit the same hole.
- **There are no line items.** The fee would be folded into `total_cents` unless we store it separately. Old JSON files have no such field, so the loader needs a default.
- **Rooms are types, not units.** `deluxe` is one bookable thing with one rate.
- The 18 existing tests pass.

## Questions, round 1

Each has my recommendation, worded so "yes" accepts it.

1. **Only at booking time?** Should late checkout be available only when the booking is created, with no way to add it later? Recommended: yes for this item, as you proposed. Adding it later needs a new command plus the persistence fix, which is a separate item. The cost is that mid-stay requests are not served.
2. **How much is the fee?** Is it one flat amount for every room type, a constant next to `ROOM_RATES`? Recommended: yes, one constant in integer cents. I need the number from you. I will not invent a price.
3. **Per booking, not per night?** Is the fee charged once per booking regardless of length? Recommended: yes, since it only affects the last day.
4. **Stored separately?** Should the booking record a `late_checkout` flag and the total include the fee, with the fee recoverable as its own amount? Recommended: yes, store the flag and the fee charged at booking time, so a later price change does not rewrite old bookings.
5. **Shown in output?** Should the `book` and `list` lines mark late-checkout bookings? Recommended: yes, a short suffix such as `+late`, otherwise staff cannot see who has it.
6. **Should `quote` get the same flag?** Recommended: yes, otherwise a quote and the booking it precedes disagree on price.
7. **Does the percent discount apply to the fee?** Recommended: no, discount the nights only and add the fee after. Only `quote` has a discount today, so this only matters if you say yes to 6.
8. **Does late checkout block a same-day arrival in that room?** This is the real product fork. Options: (a) a late checkout makes the checkout date unavailable to the next booking, while normal checkouts allow same-day turnover; (b) no availability effect, the flag is fee only. Recommended: (a), because selling late checkout an
9. **Fix the overlap bug as part of this?** If you choose 8(a), the half-open rule has to actually work first, or the distinction is meaningless. Recommended: fix it as a separate bug-fix item that lands first, not folded into this feature.
10. **What if the next day is already booked?** If a guest asks for late checkout and another booking starts on their checkout date, should `book` fail with a conflict error? Recommended: yes, reject it rather than sell it and silently double-book. Only applies under 8(a).
11. **Fee on cancel?** Cancel has no refund logic today, it just hides the booking. Recommended: leave it alone, the fee goes away with the booking and no refund rules are added here.
12. **Do you want an actual checkout time recorded?** For example "14:00 instead of 11:00". Recommended: no, keep it a boolean. The system has no times, and adding them is a larger change than the feature.
13. **Fix the cancel persistence bug?** It is unrelated to a flag on `book`. Recommended: queue it as its own bug-fix item, not part of this one.

Answer by number, "yes" where you accept the recommendation. Question 2 needs an amount. Once the answers leave nothing open I will recompute, ask anything they uncover, and then add the queue item.
RESULT success 0.45890200000000003 5

```

## Decisions taken (decisions.tsv, phase implement)

1. Shipped prose says bare `mstack`, not `./bin/mstack` as the brief's design text did: a consumer repository has no `./bin/mstack`, and the router already says `mstack gate`. The live run resolved bare `mstack` through the plugin.
2. The cost if wrong goes in `decide --result` as "if wrong: ..."; several forks share the one `decision_required` string (numbered) and one `decide --resolves` row, because an item has one `decision_resolved` pointer and the gate matches one row.
3. Seams are validated in `parseItem`, so a non-array value fails every reader instead of being dropped silently on the next write.

## Found, not fixed

- Sandbox template: `Booking.overlaps` compares inclusively, so same-day turnover is rejected against its README (both live runs found it).
- Sandbox template: `JsonFileRepository.update` never saves, so `cancel` does not persist (run 2).
- `state list` prints only label and title; nothing prints an item's full fields except reading state.json.
- Intake adds a read of about 55 lines to every new request; its effect on the benchmark's cost ratio is unmeasured.

## Per criterion

| # | Evidence | Rung |
|---|---|---|
| 1 intake between orient and playbook, ends with state add (acceptance, source, seams) | SKILL.md step 3; run 1 called `state add` with all three | 4, one run |
| 2 facts found, never asked | intake.md table; no fact question in runs 1 and 2 | 4, n=2, model behaviour, not enforced |
| 3 reversible decision recorded with what, why, cost if wrong | four `intake` rows in proj1 | 4 |
| 4 forks become decision_required, all at once, late, each recommended | run 1 item with two numbered forks, shown in one round after `state add` | 4, n=1; the single-string carrier is untested through `decide --resolves` |
| 5 origin header and both MIT notices in the plugin | intake.md line 1; licenses/*.txt copied from the local LICENSE and from the API at the pinned commit | 3, read by eye, no test |
| 6 one real request through /mstack in the sandbox | run 1 above | 4 |
| seams field | tests/seams.test.ts 9 pass, 9 mutants killed, CLI output above | 4 |
| interactive mode | run 2 | 4, n=1 |

Verdict: live-verified (rung 4 for the code and the live runs). Self-assessed by the implementer, so it is evidence and not an approval; item 55 stays at its current status for an independent reviewer.
