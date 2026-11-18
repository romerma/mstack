# Review - plans-for-a-contextless-executor (item 64)

**Verdict:** CHANGES_REQUESTED

Reviewer pass, alone, round 1. Head `522070085fb03cfd5989368e0437960b62386036`, base `7f77190`. I wrote none of this code. The suite is green on both runtimes and the lint check bites. One committed header and the CHANGELOG name a step of the orchestrate playbook that carries nothing, and the implementer's own report says so. That is a false statement in a committed file, and it is the only blocking finding. Criterion 2 is met on one live run (n=1), with a confound explained under Probe E.

## Blocking findings

1. **`skills/router/playbooks/orchestrate.md:1` and `CHANGELOG.md:13` say the unit-size rule is in step 2. It is not.** The header opens "the unit-size rule in steps 1 and 2", and the CHANGELOG says "in `skills/router/playbooks/orchestrate.md` steps 1, 2 and 5". Step 2 (`orchestrate.md:18-20`) is unchanged in `git diff 7f77190..5220700` (no `-`/`+` line starting `2.`), and the implementer's report says "Deviation: the size rule sits in step 1 only, not also in step 2". Fix: "in step 1" in the header and "steps 1 and 5" in the CHANGELOG. While editing that header, also fix N1 below, because the same clause leaves out a second omission.

## Non-blocking findings (to file)

- **N1. The orchestrate rule drifts from the other two places, and its header lists only part of the drift.** `orchestrate.md:14-17` leaves out "scaffolding" and also the source's last sentence ("Each task ends with an independently testable deliverable", source lines 42-43). The header (`orchestrate.md:1`) says only that "scaffolding" is left out. Neither omission has a reason. In a program, scaffolding is the unit most tempting to split off, so leaving it out changes the rule rather than shortening it. Recommend carrying the rule whole, as in `skills/spec/SKILL.md:57-60`, or giving the reason.
- **N2. The CHANGELOG describes one rule; the orchestrate text differs.** `CHANGELOG.md:5-11` says a task and a unit "have one size rule" with "setup, configuration, scaffolding and docs" and "never ... 'add error handling'". Orchestrate has neither "scaffolding" (`:15`) nor "add error handling" (`:44-45`). The fix for N1 removes this.
- **N3. `skills/spec/SKILL.md:7` calls the Size paragraph "reworded", but its first sentence is verbatim.** Compare `SKILL.md:57-58` with source lines 38-39: "A task is the smallest unit that carries its own test cycle and is worth a fresh reviewer's gate." The derivation is credited, so this is a matter of precision only. Better wording: "its first sentence kept, the rest reworded".
- **N4. `agents/spec-reviewer.md:30-34` has derived wording and no header.** It quotes the source's placeholders "TBD" and "handle edge cases" (source 131-132). It also inverts the source's split test ("a reviewer could not approve half of it and reject the rest", from source 40-42). The rule declared at `src/lint.ts:417-421` reads "Files under `skills/` and `agents/` whose text is derived from another repository ... must carry an `<!-- Origin: ... -->` header". Item 62's precedent does not cover this case: there the reviewer's wording did not appear in the source (`review_review-findings-verified-first.md:76`), and here it does. A weaker case of the same kind: `skills/spec/references/templates.md:68` ("done when `<exact command>` prints `<what it prints>`"; "its test in `tests/path`") echoes Remember 141 and Task Structure's `Test:` line (source 87). Recommend a header on spec-reviewer.md, and an ORIGIN_REQUIRED entry if it gets one.
- **N5. The rule says every task, but the template's mandatory last group cannot comply.** `SKILL.md:62-63` says "Each task gives the exact paths it touches, the exact command that shows it done and what that command prints". `templates.md:73-74` has "2.2 Independent review by a pass that did not write the code" and "2.3 PR, merge gate, close", and these have no path and no command. The implementer cannot do 2.2 at all, even though `agents/implementer.md:18` says "Execute `tasks.md` in order and tick each box". The live spec-reviewer exempted them on its own ("3.x are process steps. OK.", spec-review line 115), but nothing in the text grants that exemption. The tension existed before this item; this change sharpens it. Recommend one clause: the verification-and-close group is the exception.
- **N6. "what that command prints" (`SKILL.md:63`, `agents/spec-author.md:52-53`) drops the source's "expected".** Before the code exists, an author can state the expected line but cannot observe it. The live author handled this well by giving counts as deltas from a baseline B that it defines (tasks.md:13-16). Even so, "what it should print" says what is meant.
- **N7. The spec-author's short form drops "Each task ends in something that can be tested by itself" (`SKILL.md:59-60`).** Its header (`agents/spec-author.md:9`) sends the reader to the skill's header for what was carried, and that list is true of the skill, not of the agent. The live author did read section 4 itself (Probe C), so this cost nothing in the run.
- **N8. "Worth a fresh reviewer's gate" assumes a per-task review that mstack's spec path does not run.** The implementer executes every task, and one reviewer judges the item (`skills/implement/SKILL.md:15`, `agents/reviewer.md`). As a thought test it works. A newcomer may read it as a promise.
- **N9. Evidence about the checks, not a defect in this diff.** The live spec-reviewer approved a precondition that can never be met as written. tasks.md:9-10 says `mstack state show fix-booking-overlap` "must each print `status: closed`". A closed item prints `status: done` (`src/lifecycle.ts:79`; `./bin/mstack state show 1` prints `status: done`). One run is not enough to say whether the executability check misses this kind of error.

## Acceptance, quoted

**"the spec skill and the orchestrate playbook carry the task-sizing rule with an origin header"**: **met** in substance. The rule is at `skills/spec/SKILL.md:57-60` and `skills/router/playbooks/orchestrate.md:14-17`, with headers at `SKILL.md:7` and `orchestrate.md:1`. Both are in `ORIGIN_REQUIRED` (`src/lint.ts:432-433`), and removing either header turns `lint-plugin` red and names the file (Probe D). The orchestrate header contains the false clause in blocking finding 1. Rung 4 for the lint behaviour; the wording has no test (prose).

**"one spec written with it has tasks a stranger could execute, judged by the spec-reviewer"**: **met, on one run (n=1)**. The live run's spec-reviewer applied both new checks and cited section 4. It returned CHANGES_REQUESTED on an undefined name in a task, and approved after the revision. My own pass over every task found them executable from the file alone, except one wrong expected output in the preamble (N9) and two `...` stand-ins (details under Probe E). The confound: in the new run, the coordinator's brief to the author and to the reviewer already asked for "exact paths, the exact command ... and expected output, with no placeholders or undefined names". The plugin files the coordinator read do not contain that wording; where the coordinator got it is not shown. The base-sha brief did not ask for it. So part of the difference in executability may come from the brief rather than the agent text. The sizing difference cannot come from the brief, which said nothing about size.

**Seam 1, "CLI: mstack lint-plugin output and exit code on a plugin whose skills/spec/SKILL.md or skills/router/playbooks/orchestrate.md has no origin header"**: exercised (Probe D).
**Seam 2, "the spec path as followed by a headless /mstack run on an sdd item in a copy of sandbox/bench/template"**: exercised (Probe E).

## Probe A: the three origin headers against the source

Source: the clone `scratchpad/impl61/up`, `git -C up log -1 --format='%H %ad' -- skills/writing-plans/SKILL.md` prints `8e1262a3bae92b640d87fa81c51c53b65e490590 Wed Jun 10 20:44:48 2026 -0700`, and `git cat-file -t` prints `commit`. Licence check:

```
$ git -C up show 8e1262a3...:LICENSE | cmp - licenses/obra-superpowers-LICENSE.txt; echo "cmp exit $?"
cmp exit 0
```

Source headings, with line numbers (`rg -n`): Overview 8 (body 10, 12; Announce 14, Context 16, Save 18-19), Scope Check 21, File Structure 25, Task Right-Sizing 36 (body 38-43), Bite-Sized 45, Plan Document Header 54 (Global Constraints 69), Task Structure 79 (Files 84-87, Interfaces 89-91, commit step 120), No Placeholders 128 (bullets 131-136), Remember 138 (139-142), Self-Review 144, Execution Handoff 156.

| Header clause | Source | True of that file? |
|---|---|---|
| spec: "Task Right-Sizing is the Size paragraph, reworded" | 38-43 | carried in full (`SKILL.md:57-60`); first sentence verbatim (N3) |
| spec: Overview premise only; "questionable taste", skilled-developer, test-design, docs to check, "DRY. YAGNI. TDD. Frequent commits" not carried | 10, 12 | each exists at 10 or 12; none is in the file |
| spec: "TBD" of the first bullet | 131 | yes (`:64`); TODO, implement later, fill in details absent, consistent with "of its first bullet" |
| spec: "add error handling", "handle edge cases", without "add validation" | 132 ("Add appropriate error handling") | yes (`:63-64`); "appropriate" dropped, as a paraphrase |
| spec: names defined in no task, files added, existing files count | 136 | yes (`:64-65`) |
| spec: "Similar to Task N" as "as in task N", remedy differs | 134 | yes (`:64`) |
| spec: "Write tests for the above", "Steps that describe ..." not carried | 133, 135 | absent: true |
| spec: Remember 139 and 141 carried, 140 not | 139-141 | yes (`:62-63`); 142 not mentioned under Remember (it is listed under Overview's copy) |
| spec: Bite-Sized, Plan Header (Global Constraints), Task Structure (Files, Interfaces, steps, commit), Scope Check, File Structure, Self-Review, Execution Handoff not copied; announcement, Context, save path not copied | 45, 54/69, 79/84/89/120, 21, 25, 144, 156, 14, 16, 18 | all exist; none in the file |
| orchestrate: "unit-size rule in steps 1 and 2" | - | **false for step 2** (blocking 1) |
| orchestrate: TRS "carried as the definition of a unit, reworded, with 'scaffolding' left out" | 38-43 | scaffolding is left out, and so is 42-43 (N1) |
| orchestrate: "TBD"; "handle edge cases" without "add validation" and "add error handling" | 131, 132 | yes (`:44-45`) |
| orchestrate: "Similar to Task N" as "as in unit N"; names defined in no task | 134, 136 | yes (`:45`: "a name the brief and the repository do not define") |
| orchestrate: 133, 135 not carried; Overview premise; Remember 139 and 141 as paths and VERIFY, 140 not | | yes (`:43-44`) |
| orchestrate: not copied list, announcement, save path | as above | all exist; none in the file |
| spec-author: rules in "Design and tasks", "the short form of the two paragraphs of section 4 ... whose header says what of the source was carried" | - | the heading exists (`agents/spec-author.md:44`); the short form omits `SKILL.md:59-60` (N7) |

Nothing that a file took is listed as not copied. `agents/spec-reviewer.md` has no header, but its new wording is derived (N4).

## Probe B: the text, read cold

- **Is the size rule usable?** Its operational part is "split only where a reviewer could reject one task and approve its neighbour", together with the fold list, and it reads clearly. In the live spec it produced 3 implementation tasks. The 1.1/1.2 split cuts one function in two, and the author had to add a note that two tests are vacuous until 1.2 (tasks.md:72-73). A second author could reasonably merge those two tasks, so I expect authors to land near each other within about one task. That is a judgement from one sample, not a measurement.
- **"What that command prints":** see N6. It can be known for output the spec itself defines and for `OK`/`Ran N tests`; the live author solved the count with a baseline B.
- **Conflict with "verification and close", and with "execute tasks.md in order and tick each box":** yes (N5).
- **Same rule, same words?** No: see N1 and N2 for orchestrate, and N7 for the spec-author. The reviewer's list of placeholders is an example list and drops "add error handling", which is fine.
- **A new stop or question to the user?** None. No added sentence asks the user anything or stops for them. Orchestrate's "Missing fields are a reason not to launch it yet" (`:43`) predates this item.

## Probe C: does each role see the rule?

The implementer's claim checks out. `agents/spec-author.md` and `agents/spec-reviewer.md` have no `skills:` in their frontmatter (only `tools`, `model`, `color`), and `agents/implementer.md:5-6` has `skills: - test-first`. The spec-author carries both rules itself (`:49-55`). The spec-reviewer carries the failure shapes (`:30-34`) and points to section 4 for the rule.

Does the pointer resolve? Yes, in the live run, from a consumer project loaded with `--plugin-dir`. The coordinator's briefs did not name the plugin path, yet each agent resolved `${CLAUDE_PLUGIN_ROOT}` and read section 4:

```
mstack:spec-author   | Bash | awk '/^## 4/,/^## 5/' /Users/romerma/Code/mstack/skills/spec/SKILL.md   ("Read EARS kit, evidence ladder, spec skill section 4")
mstack:spec-reviewer | Bash | sed -n '/## 4/,/## 5/p' /Users/romerma/Code/mstack/skills/spec/SKILL.md | head -30   ("Read evidence ladder and task sizing rule")
```

"Section 4" resolves to the heading `## 4. Tasks` (`SKILL.md:52`). I did not test a marketplace install, where the plugin root is the cache directory.

## Probe D: lint, in a scratch worktree (`scratchpad/review64/wt`, detached at 5220700, removed afterwards)

```
baseline: PASSED - 0 failures, 0 warnings, exit 0
== header removed from skills/spec/SKILL.md
[fail]  skills/spec/SKILL.md: no origin header
FAILED - 1 failure, 0 warnings
exit 1
== header removed from skills/router/playbooks/orchestrate.md
[fail]  skills/router/playbooks/orchestrate.md: no origin header
FAILED - 1 failure, 0 warnings
exit 1
== header removed from agents/spec-author.md
[fail]  agents/spec-author.md: no origin header
FAILED - 1 failure, 0 warnings
exit 1
== header removed from agents/implementer.md        (an older entry)
[fail]  agents/implementer.md: no origin header
FAILED - 1 failure, 0 warnings
exit 1
restored: PASSED - 0 failures, 0 warnings
```

Then `src/lint.ts` reverted to `7f77190`, first all three entries together, then each one alone:

```
all three reverted: bun exit 1   AssertionError: header removed from skills/spec/SKILL.md: expected a failure, got a pass   26 pass / 1 fail
                    node exit 1  AssertionError [ERR_ASSERTION]: header removed from skills/spec/SKILL.md: expected a failure, got a pass
entry skills/spec/SKILL.md dropped:                 bun exit 1  ... skills/spec/SKILL.md: expected a failure, got a pass
entry skills/router/playbooks/orchestrate.md dropped: bun exit 1  ... skills/router/playbooks/orchestrate.md: expected a failure, got a pass
entry agents/spec-author.md dropped:                bun exit 1  ... agents/spec-author.md: expected a failure, got a pass
entry agents/implementer.md (older) dropped:        bun exit 1  ... agents/implementer.md: expected a failure, got a pass
```

Unmodified, `bun test ./tests/lint.test.ts` gives 27 pass, 0 fail. `git worktree remove` succeeded, and `git worktree list` shows only the checkout.

## Probe E: criterion 2, live (one run, n=1)

**Setup.** `scratchpad/review64/live/proj` is a copy of `sandbox/bench/template`, with `git init`, commit `template`, then `/Users/romerma/Code/mstack/bin/mstack setup` (PASSED). Then `state.verify = "python3 -m unittest discover -s tests"` was set and committed (`aceb468 mstack setup`), as `sandbox/bench/run.mjs:101-110` does. The wrapper is `scratchpad/review64/live/run.sh`:

```
/usr/bin/perl -e 'alarm 840; exec @ARGV' /usr/bin/env -i HOME USER LOGNAME TERM LANG TMPDIR SHELL PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:<bun bin>:<claude bin> \
  claude -p "$PROMPT" --model opus --output-format stream-json --verbose --setting-sources project \
  --strict-mcp-config --max-budget-usd 6 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto > <stream outside the project> 2> <stream>.err
```

No ANTHROPIC_* variable was set. The init event shows plugin `mstack`, the agents `mstack:spec-author` and `mstack:spec-reviewer`, `permissionMode: auto`, model `claude-opus-5-5`, claude 2.1.327. The run exited 0, stderr was empty, and no call was denied.

**Prompt** (the whole of it):

```
/mstack guests keep asking to move a booking to other dates. I'd like a reschedule command: `python3 -m bookings reschedule <id> <new check_in> <new check_out>` keeps the same room and guest, re-prices the stay for the new dates, and refuses with an error if the new dates clash with another active booking in the same room (the booking being moved shouldn't count as a clash with itself). A cancelled booking can't be rescheduled. It should print the updated booking the way `book` does.

Please do this on the spec path: write the spec and have it reviewed before any code is written. It's fine to stop once the spec is approved, before implementing. You are running unattended: nobody will answer questions, so make reasonable decisions and leave the repository in its final state.
```

**What happened.** The coordinator created item `reschedule-booking` with `--sdd`. It filed two template bugs it found as prerequisite items, `fix-booking-overlap` and `fix-json-update-persist`, and later a third, `json-store-concurrency`. It briefed `mstack:spec-author`, sent one revision, briefed `mstack:spec-reviewer` (CHANGES_REQUESTED, 3 blocking findings), had the author revise, and got the re-review APPROVED. It then set `spec_ready`, committed (`0308925 docs(spec): specify the booking reschedule command`, `12c8205`), and stopped before implementing.

**Cost: $3.19, 25 main turns (four result events: 11+6+2+6), 781 s wall (07:30:54Z to 07:43:55Z).**

### The resulting tasks.md, in full (`.mstack/specs/reschedule-booking/tasks.md`, 193 lines)

```
> Source: direct request, 2026-11-18 (item #1 `reschedule-booking`). This spec is
> authoritative for implementation; the request and `.mstack/decisions.tsv` remain the
> discussion venue.

Every command runs from the repository root. The suite runner is unittest (pytest is not
installed).

**Preconditions, before task 1.1:**
1. Both prerequisite items are closed. `mstack state show fix-booking-overlap` and
   `mstack state show fix-json-update-persist` must each print `status: closed`.
2. Both prerequisites' PRs are merged into `main`, and `feat/reschedule-booking` is rebased
   onto `main` (`git fetch && git rebase main`, or `git rebase origin/main` if a remote exists).
3. Run `python3 -m unittest discover -s tests` and note the count it prints as **B**.

Counts below are deltas from B, because both prerequisites add their own tests. On
2026-11-18, before either prerequisite, the suite ran 18 tests.

Test fixtures used below:
- "booking 1" means `service.book("suite", "Ada", date(2025, 3, 1), date(2025, 3, 5))`,
  which gives id 1 and `total_cents == 99996`.
- "booking 2" means a second `service.book("suite", "Bob", ...)` with the dates the test
  names.

## 1. Reschedule use case

- [ ] 1.1 Add `reschedule(self, booking_id: int, check_in: date, check_out: date) -> Booking`
  to `BookingService` in `bookings/app/service.py`. It runs steps 1-4 and 6 of design.md
  "Shape": look up the booking, refuse if missing, refuse if cancelled, price the new dates,
  build a copy with the new values, then store and return it. Use these exact names, because
  task 1.2 refers to them:
  - `current = self._repo.get(booking_id)`. If `current is None`, raise
    `NotFound("no booking with id {}".format(booking_id))`.
  - If `current.cancelled`, raise `BookingError("booking {} is cancelled".format(booking_id))`.
  - `total = pricing.quote(current.room, check_in, check_out)`.
  - `candidate = dataclasses.replace(current, check_in=check_in, check_out=check_out,
    total_cents=total)`.
  - `self._repo.update(candidate)`, then `return candidate`.

  Add `import dataclasses` at the top of that file. Leave the clash loop out; task 1.2 adds
  it between `candidate = ...` and `self._repo.update(candidate)`. Add a
  `RescheduleTests(unittest.TestCase)` class to `tests/test_service.py`, with
  `setUp` creating `self.repo = MemoryRepository()` and
  `self.service = BookingService(self.repo)`, and these 12 tests:
  - `test_reschedule_moves_dates`: booking 1 rescheduled to 2025-03-10..2025-03-13. Both the
    return value and `self.repo.get(1)` have the new dates. (R1)
  - `test_reschedule_keeps_id_room_guest`: same call. `id == 1`, `room == "suite"`,
    `guest == "Ada"`, `cancelled is False`, `len(self.service.list()) == 1`. (R2)
  - `test_reschedule_reprices`: same call. `total_cents == 74997`. (R3)
  - `test_reschedule_overlapping_own_old_dates_allowed`: booking 1 to 2025-03-03..2025-03-08
    succeeds with those dates. (R9)
  - `test_reschedule_to_same_dates_allowed`: booking 1 to 2025-03-01..2025-03-05 succeeds with
    `total_cents == 99996`. (R9)
  - `test_reschedule_unknown_id`: `reschedule(99, ...)` raises `NotFound` and
    `str(exc) == "no booking with id 99"`. (R4)
  - `test_reschedule_cancelled_refused`: cancel booking 1, then reschedule it. The raised
    exception has `type(exc) is BookingError` and `str(exc) == "booking 1 is cancelled"`. (R5)
  - `test_reschedule_zero_nights_refused`: to 2025-03-10..2025-03-10. It raises
    `BookingError`, is not an instance of `BookingConflict`, and
    `str(exc) == "a stay needs at least one night"`. (R6)
  - `test_reschedule_reversed_dates_refused`: to 2025-03-13..2025-03-10. Same assertions as
    the zero-night test. (R6)
  - `test_bad_dates_leave_booking_unchanged`: after the zero-night refusal, `self.repo.get(1)`
    has 2025-03-01..2025-03-05 and `total_cents == 99996`. (R11)
  - `test_cancelled_beats_bad_dates`: cancel booking 1, then reschedule it to
    2025-03-10..2025-03-10. The message is `booking 1 is cancelled`. (R12)
  - `test_unpriceable_room_leaves_booking_unchanged`: after booking 1, set
    `self.repo.get(1).room = "penthouse"`. This stands in for a hand-edited file or a removed
    rate. Then reschedule booking 1 to 2025-03-10..2025-03-13. It raises `BookingError` with
    `str(exc) == "unknown room type: penthouse"`, and `self.repo.get(1)` still has
    2025-03-01..2025-03-05 and `total_cents == 99996`. (R11)

  Note: until task 1.2 adds the clash loop, the two R9 tests pass without exercising
  anything. They only start testing R9 after 1.2. Keep them.

  Done when `python3 -m unittest discover -s tests -k Reschedule` prints `Ran 12 tests` and
  `OK`, and `python3 -m unittest discover -s tests` prints `Ran B+12 tests` and `OK`.
  (covers R1, R2, R3, R4, R5, R6, R9, R11, R12)

- [ ] 1.2 **Precondition probe, run first.** This checks that `fix-booking-overlap`
  delivered the full half-open rule. From the repository root, run:

  ```
  python3 -c "from datetime import date as d; from bookings.domain.booking import Booking as B; y=B('suite','y',d(2025,3,10),d(2025,3,15),0); print(B('suite','x',d(2025,3,7),d(2025,3,10),0).overlaps(y), B('suite','x',d(2025,3,15),d(2025,3,18),0).overlaps(y), B('suite','x',d(2025,3,8),d(2025,3,16),0).overlaps(y), B('suite','x',d(2025,3,11),d(2025,3,13),0).overlaps(y))"
  ```

  It must print exactly `False False True True`. The four values are: check-out on the
  other's check-in day, check-in on the other's check-out day, containing the other stay,
  and lying inside it. On 2026-11-18, before the fix, it printed `True True False True`. **If
  the output differs from `False False True True`, stop.** Record the output in the
  implementation report and ask the coordinator to reopen `fix-booking-overlap`. Do not
  change `Booking.overlaps`, and do not write a local overlap predicate in this item.

  Then add step 5 of design.md "Shape" to `BookingService.reschedule` in
  `bookings/app/service.py`, between `candidate = ...` and `self._repo.update(candidate)`
  (the names from task 1.1):

  ```python
  for existing in self.list(room=current.room):
      if existing.id == booking_id:
          continue
      if candidate.overlaps(existing):
          raise BookingConflict("{} is already booked from {} to {}".format(
              current.room, existing.check_in, existing.check_out))
  ```

  Add these 9 tests to `RescheduleTests` in `tests/test_service.py`:
  - `test_reschedule_partial_overlap_conflict`: booking 2 is 2025-03-10..2025-03-15. Booking 1
    to 2025-03-08..2025-03-12 raises `BookingConflict`. (R7)
  - `test_reschedule_containing_other_conflict`: booking 2 is 2025-03-10..2025-03-12. Booking 1
    to 2025-03-08..2025-03-15 raises `BookingConflict`. (R7)
  - `test_reschedule_inside_other_conflict`: booking 2 is 2025-03-10..2025-03-20. Booking 1 to
    2025-03-12..2025-03-14 raises `BookingConflict`. (R7)
  - `test_cancelled_and_other_room_do_not_clash`: after booking 1, run
    `c = self.service.book("suite", "Cy", date(2025, 3, 10), date(2025, 3, 15))`, then
    `self.service.cancel(c.id)`, then
    `self.service.book("deluxe", "Dee", date(2025, 3, 10), date(2025, 3, 15))`. Booking 1 to
    2025-03-10..2025-03-15 succeeds. (R7)
  - `test_conflict_message_names_room_and_dates`: the partial-overlap setup.
    `str(exc) == "suite is already booked from 2025-03-10 to 2025-03-15"`. (R8)
  - `test_reschedule_back_to_back_after_allowed`: booking 2 is 2025-03-10..2025-03-15.
    Booking 1 to 2025-03-15..2025-03-18 succeeds. (R10)
  - `test_reschedule_back_to_back_before_allowed`: booking 2 is 2025-03-10..2025-03-15.
    Booking 1 to 2025-03-07..2025-03-10 succeeds. (R10)
  - `test_clash_leaves_booking_unchanged`: after the partial-overlap refusal,
    `self.repo.get(1)` has 2025-03-01..2025-03-05 and `total_cents == 99996`. (R11)
  - `test_bad_dates_beat_clash`: booking 2 is 2025-03-10..2025-03-15. Booking 1 to
    2025-03-12..2025-03-11 raises an exception that is not a `BookingConflict`, with
    `str(exc) == "a stay needs at least one night"`. (R12)

  Done when the probe printed `False False True True`,
  `python3 -m unittest discover -s tests -k Reschedule` prints `Ran 21 tests` and `OK`, and
  `python3 -m unittest discover -s tests` prints `Ran B+21 tests` and `OK`.
  (covers R7, R8, R9, R10, R11, R12)

## 2. CLI

- [ ] 2.1 In `bookings/cli.py`:
  - In `build_parser`, add a `reschedule` subparser with help `"move a booking to new
    dates"` and arguments `id` (`type=int`), `check_in` (`type=_date`) and `check_out`
    (`type=_date`).
  - In `main`, add a dispatch branch that calls
    `service.reschedule(args.id, args.check_in, args.check_out)` and prints
    `"rescheduled #{} {} {} {}..{} {}".format(b.id, b.room, b.guest, b.check_in,
    b.check_out, format_cents(b.total_cents))` to `out`.

  In `README.md`, add `reschedule` to the `bookings/app/` and `bookings/cli.py` lines of the
  layout block, and add the usage line
  `python3 -m bookings --db /tmp/b.json reschedule 1 2025-03-10 2025-03-13`.

  Add a `RescheduleCliTests(unittest.TestCase)` class to `tests/test_adapters_cli.py`. Keep
  it as a separate class; do not merge these tests into the existing `CliTests`. The separate
  class name is what makes `-k RescheduleCli` select exactly these 5 tests. Its helper
  `run_cli(*argv, service=None)` returns `(code, out, err)` from
  `cli.main(list(argv), service=service, out=out, err=err)` with `io.StringIO` streams. It
  differs from `CliTests.run_cli`, and that is intended. In the two file tests, `path` is
  `os.path.join(tmp, "db.json")`, with `tmp` from `with tempfile.TemporaryDirectory() as
  tmp:`, as in `JsonRepositoryTests`. Add these 5 tests:
  - `test_reschedule_prints_updated_booking`: use an in-memory service with booking 1 and run
    `reschedule 1 2025-03-10 2025-03-13`. Assert `out == "rescheduled #1 suite Ada
    2025-03-10..2025-03-13 $749.97\n"`, `err == ""` and `code == 0`. (R13)
  - `test_reschedule_clash_error`: use an in-memory service with booking 1 and booking 2 at
    2025-03-10..2025-03-15, and run `reschedule 1 2025-03-08 2025-03-12`. Assert
    `err == "error: suite is already booked from 2025-03-10 to 2025-03-15\n"`, `out == ""`
    and `code == 1`. (R14)
  - `test_reschedule_unknown_id_error`: use an empty in-memory service and run
    `reschedule 99 2025-03-10 2025-03-13`. Assert
    `err == "error: no booking with id 99\n"`, `out == ""` and `code == 1`. (R14)
  - `test_reschedule_persists_to_db`: in a `tempfile.TemporaryDirectory()`, book booking 1
    through `BookingService(JsonFileRepository(path))`. Then call
    `cli.main(["--db", path, "reschedule", "1", "2025-03-10", "2025-03-13"], out=..., err=...)`
    with no `service` argument, and assert it returns 0. Assert that
    `JsonFileRepository(path).get(1)` has room `suite`, guest `Ada`, 2025-03-10..2025-03-13,
    `total_cents == 74997` and `cancelled is False`. (R15)
  - `test_refused_reschedule_keeps_db`: the same file setup, plus booking 2 at
    2025-03-10..2025-03-15. Run `--db path reschedule 1 2025-03-08 2025-03-12` with no
    `service` argument and assert it returns 1. Assert that `JsonFileRepository(path).get(1)`
    still has 2025-03-01..2025-03-05 and `total_cents == 99996`. (R11, R15)

  Done when `python3 -m unittest discover -s tests -k RescheduleCli` prints `Ran 5 tests` and
  `OK`, and `python3 -m unittest discover -s tests` prints `Ran B+26 tests` and `OK`. Also:
  in a shell, set `D=$(mktemp -d)`, then run `python3 -m bookings --db $D/b.json book suite Ada 2025-03-01
  2025-03-05`, then `python3 -m bookings --db $D/b.json reschedule 1 2025-03-10 2025-03-13`.
  It prints `rescheduled #1 suite Ada 2025-03-10..2025-03-13 $749.97`. After that,
  `python3 -m bookings --db $D/b.json list` prints
  `#1 suite Ada 2025-03-10..2025-03-13 $749.97`. (covers R11, R13, R14, R15)

## 3. Verification and close

- [ ] 3.1 Run `python3 -m unittest discover -s tests` at the final head. It prints
  `Ran B+26 tests` and `OK` with exit code 0. Record the R-to-test mapping (R1-R15, each to
  the test names above) in the implementation report.
- [ ] 3.2 Independent review by a pass that did not write the code
- [ ] 3.3 PR, merge gate, close
```

### My judgement, task by task

I checked every name against the template code at `sandbox/bench/template`.

- **Preamble (lines 5-22).** These are setup notes, not a task. Precondition 1 expects `status: closed`, but mstack prints `status: done` (`src/lifecycle.ts:79`; `./bin/mstack state show 1` gives `status: done`). An executor that follows the file literally would wait forever. **This is the one executability defect, and the spec-reviewer missed it (N9).** B is defined (line 13). `git fetch` with no remote exits 0 in this repository (I ran it), so the rebase line works.
- **1.1: sized acceptably; executable.** Its paths exist (`bookings/app/service.py`, `tests/test_service.py`). Every name is defined either by the template or by the task: `BookingService`, `self._repo`, `NotFound`/`BookingError`/`BookingConflict` (imported at `service.py:7`), `pricing.quote(room, check_in, check_out, discount_percent=0)`, `dataclasses.replace` on the `@dataclass` `Booking`, and `MemoryRepository` and `date` (imported at `test_service.py:2-4`). The prices check out: 4 x 24999 = 99996 and 3 x 24999 = 74997. `-k Reschedule` is a case-sensitive substring match on `module.Class.method`, so it selects the class `RescheduleTests`. Before the change it runs nothing: `python3 -m unittest discover -s tests -k Reschedule` printed `Ran 0 tests` and `OK`. Mutating `self.repo.get(1).room` works because `MemoryRepository.get` returns the stored object (`memory.py:19-20`). The pointer to "steps 1-4 and 6 of design.md" goes outside the file, but every step is spelled out below it, so the file stands alone. One minor stand-in: `reschedule(99, ...)` leaves the dates unstated.
- **1.2: sized acceptably but borderline; executable.** By the rule's test, a reviewer could reject the clash loop and its dependency on the prerequisite while approving 1.1. On the other hand, 1.1 and 1.2 build one function, and the vacuous-R9 note shows the cut runs through one behaviour, so a second author could merge them. The probe is exact and gives its expected output. The code block uses only `current`, `candidate`, `booking_id` (defined in 1.1) and `self.list`/`overlaps` (template). The expected counts are 21 and B+21. Its "stop" goes to the coordinator, not the user.
- **2.1: sized well, with README folded in as the rule asks; executable.** `build_parser`, `_date`, `main`, `format_cents` and `out` are in `cli.py`. `CliTests.run_cli` exists (`test_adapters_cli.py:35`), as does `JsonRepositoryTests` (`:13`), and `io`/`os`/`tempfile`/`JsonFileRepository` are imported there (`:1-9`). The README layout lines it names exist. `D` and `path` are defined. Stand-ins: `out=..., err=...` at line 170, and the shell command wraps across lines 181-182 inside one code span, so a literal copy breaks.
- **3.1: executable.** **3.2 and 3.3** have no path and no command and cannot be done by the implementer. This is the template's fixed close group (N5), and the reviewer exempted it as "process steps".

None of the forbidden placeholders ("TBD", "handle edge cases", "add error handling", "as in task N") appears. "As in `JsonRepositoryTests`" points to existing code, which the rule allows, and the task says the thing in full anyway.

### What the spec-reviewer said about the tasks (`.mstack/progress/spec-review_reschedule-booking.md`)

It applied both new checks and named section 4:

```
114:- Sizing (SKILL.md section 4): 1.1 and 1.2 split at a point a reviewer could reject one
115:  and approve the other. README folds into 2.1, as required. 3.x are process steps. OK.
116:- Command and expected output: `python3 -m unittest discover -s tests`, with `-k` filters and
117:  `Ran N tests` / `OK`, appears in every task. OK.
148:3. **tasks.md:62-64: undefined and inconsistent names in task 1.2.** The `BookingConflict`
149:   format call uses `room`, but `reschedule(self, booking_id, check_in, check_out)` has no
150:   `room` in scope, so copying it as written raises NameError. ...
152:   looked-up booking. tasks.md has to stand alone (SKILL.md section 4). Fix: in 1.1, name the
168:- N4. tasks.md:120-129: `path` is not defined. ... tasks.md:133: `$D` is not defined. State
169:  `D=$(mktemp -d)`.
197:**Verdict:** APPROVED            (Re-review 1, after the author's Revision 2)
220:3. **F3: resolved.** tasks.md:31-37 fixes the names `current`, `total`, `candidate`, ...
```

Round 1 was CHANGES_REQUESTED, with 3 blocking findings. One of them (F3) was the undefined-name check biting on a real NameError, and N4 was the same check on `path` and `$D`. The re-review was APPROVED. Line 115 shows the template conflict (N5) being settled by the reviewer's own judgement.

### The same prompt under the old text (second run, plugin = `git archive 7f77190` excluding `.mstack`, project `scratchpad/review64/old/proj`; n=1)

Exit 0, stderr empty, init shows plugin `mstack@.../review64/old/plugin`. **Cost $2.02, 17 main turns (13+2+2), 552 s wall (07:39:24Z to 07:48:36Z).** The scope differs: here the coordinator folded both template bugs into the spec rather than filing them as items. Its brief to the author asked for nothing about paths, commands or output. Its tasks.md, in full:

```
> Source: direct request, 2026-11-18 (item #1 `reschedule-booking`). This spec is
> authoritative for implementation; the request and `.mstack/decisions.tsv` remain the
> discussion venue.

Order matters: group 1 fixes the two shared defects that the feature depends on. Write
each test first and watch it fail against `bc3a3ee` before making the fix.

## 1. Shared defects
- [ ] 1.1 Tests: `book` refuses a containing stay, a contained stay, a partial overlap and identical dates, and accepts back-to-back stays in both directions. Include the CLI exit-1 case. (covers R1, R2)
- [ ] 1.2 Make `Booking.overlaps` half-open (same room AND `a.in < b.out` AND `b.in < a.out`); keep the existing tests green (covers R1, R2)
- [ ] 1.3 Test: a CLI `cancel` survives a reload of the same `--db` path (covers R3)
- [ ] 1.4 `JsonFileRepository.update` calls `_save()` (covers R3)

## 2. Service
- [ ] 2.1 Add `BookingCancelled(BookingError)` to `bookings/domain/errors.py` (covers R8)
- [ ] 2.2 Move book's clash loop into a shared helper that can skip one id; `book` uses it with no skip (covers R1, R10, R11)
- [ ] 2.3 Tests for `reschedule` success: identity kept, re-priced, in place with no duplicate or new id (covers R4, R5, R6)
- [ ] 2.4 Tests for refusals: unknown id, cancelled, zero and negative nights, a stored booking whose room has no rate (`penthouse` put straight into the repository; expect `unknown room type: penthouse` and an unchanged booking), clash with another active booking, containing clash, several clashes naming the lowest id (covers R7, R8, R9, R10, R16)
- [ ] 2.5 Tests for non-refusals: own old dates (shift, extend, same dates), cancelled booking's nights, other room, back-to-back both ways (covers R11, R12, R13, R14)
- [ ] 2.6 Tests: order of refusals; refused reschedule leaves `get(id)` and a pre-call reference unchanged on `MemoryRepository` (covers R15, R16)
- [ ] 2.7 Implement `BookingService.reschedule` as copy, validate, commit (design.md Candidate A) (covers R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16)

## 3. Persistence and CLI
- [ ] 3.1 Tests on `JsonFileRepository`: a successful reschedule survives reload; a refused one leaves the file's bytes unchanged; an unknown id with no file creates no file (covers R17, R18)
- [ ] 3.2 Tests via the CLI: exact success line; `error: ...` with exit 1 for unknown id, cancelled, zero nights, clash (covers R19, R20)
- [ ] 3.3 Subprocess tests (`python3 -m bookings`): non-integer id, malformed date, missing argument and an extra room argument each exit 2 and leave the file unchanged; `reschedule -h` usage line (covers R21, R22)
- [ ] 3.4 Add the `reschedule` subparser and success branch to `bookings/cli.py` (covers R19, R20, R21, R22)
- [ ] 3.5 README.md: list `reschedule` among the CLI commands and service use cases, with one usage example (covers R19)

## 4. Verification and close
- [ ] 4.1 `python3 -m unittest discover -s tests`; record R-to-test in the implementation report (R1-R22, each mapped to at least one named test) (covers R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R21, R22)
- [ ] 4.2 Independent review by a pass that did not write the code (covers R1-R22)
- [ ] 4.3 PR, merge gate, close (covers R1-R22)
```

Measured against the new rules, this file has 14 implementation tasks and most fail them:

- Tests are split from their implementation: 1.1/1.2, 1.3/1.4, 2.3-2.6/2.7, 3.1-3.3/3.4. A test-only task does not carry its own test cycle.
- 2.1 is a setup step on its own, and 3.5 is a docs step on its own.
- No task gives a command or what it prints, several name no test file, and 2.7 points to "design.md Candidate A".

The old spec-reviewer said nothing about size or executability. Its completeness section covers only R-id coverage and the close group:

```
22:All 7 acceptance bullets map to requirements. Every requirement has a scenario except R9's unknown-room clause. Every R1-R22 covered by a task; last group is verification and close. ...
45:5. R1-R22 unchanged, 43 scenarios, all requirements covered by tasks, last group is verification and close.
```

**What two runs can and cannot show.** They show four things:
- The new text reaches both agents in a live session, and the agents read section 4.
- The reviewer applies both checks, and the undefined-name check caught a real NameError.
- Under the new text, one sample spec has fewer, larger tasks, each with paths, commands and outputs.
- Under the old text, one sample spec splits tests from code and folds in nothing.

They cannot show four things:
- Whether the difference is stable. Each side is n=1.
- How much of the executability came from the coordinator's brief. The new-run brief asked for exact paths, commands and expected output, and the old one did not.
- How much came from a different scope. The old spec covers 22 requirements including two bug fixes; the new one covers 15.
- Whether an implementer working only from this tasks.md would succeed. No implementation was run.

The design row's "if wrong" risk is that tasks grow into prose plans. The new tasks.md is 193 lines with a code block and every test named, against 33 lines, and the run cost $3.19 against $2.02. That is close to a prose plan. Both specs total about 600 lines across their four files.

## Probe F: docs

- `CHANGELOG.md:5-19`: the step 2 claim is false (blocking 1), and "one size rule" with scaffolding and "add error handling" overstates what orchestrate carries (N2). The other claims are true: section 4, the short form in spec-author ("which does not preload the spec skill", confirmed in Probe C), the template's example task, the spec-reviewer's two checks, the not-copied list, and lint requiring the three headers.
- `docs/wiki/The-Agents.md:112` and `:122`: true of `agents/spec-author.md:49-55` and `agents/spec-reviewer.md:30-34`.
- `docs/wiki/Skills-and-Playbooks.md:150`: true of `orchestrate.md:14-17` and `:43-45`.

## Probe G: suite (my runs, at 5220700, after the last edit)

```
$ ./bin/mstack lint-plugin .            -> PASSED - 0 failures, 0 warnings   (exit 0)
$ npm run typecheck                     -> exit 0, tsc printed nothing
$ ./bin/mstack gate                     -> PASSED - 0 failures, 0 warnings   (exit 0, before this report existed)
$ ./bin/mstack gate --full              -> PASSED - 0 failures, 0 warnings   (exit 0; ran store verify: npm test && npm run typecheck && bin/mstack lint-plugin .)
$ npm run test:bun                      -> 631 pass, 0 fail, "Ran 631 tests across 28 files. [114.06s]"   (exit 0)
$ npm run test:node                     -> tests 631, pass 631, fail 0   (exit 0)
$ ./bin/mstack ledger check plans-for-a-contextless-executor
FAIL no verdict at 52207008; 1 row(s) exist at other SHAs and a new head SHA voids them
```

The `[fail] items marked done with no ledger verdict at all: alpha` lines in the bun output come from test fixtures, not from failures. No test failed.

## Rebuttals and implementer claims checked

This is round 1, so there are no rebuttals. I checked the implementer's report against what I could run. The pin and licence hold. The missing `skills:` holds. The red-then-green and mutant results reproduce. The counts of 631/631 hold. Its "Look first 3" (the step 2 deviation) is right about the text, but the header and CHANGELOG still contradict it.

## Where claims stopped on the evidence ladder

- Lint behaviour, test counts, the LICENSE cmp, the source line numbers, and the template names in tasks.md: rung 4 (run or opened here).
- Agents resolving `${CLAUDE_PLUGIN_ROOT}` and reading section 4: rung 4 for `--plugin-dir` in a consumer project. A marketplace install was not run.
- "tasks a stranger could execute": rung 3. I read every task against the code and ran `-k Reschedule` (0 tests now) and `git fetch` with no remote, but nobody executed the tasks.
- Old versus new text: two runs, n=1 each, with the brief confound above.

## What I did not check

- An implementer executing the live tasks.md. The prerequisites do not exist, so it could not run as written.
- Repeat runs, or a run where the coordinator's brief is held fixed between old and new text.
- A marketplace-installed plugin.
- Whether upstream `writing-plans` has moved past the pin. I used the existing clone, with no network fetch.
- The pre-existing parts of the wiki pages that were not edited.
