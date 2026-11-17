# Review - intake-followups (item 73), round 2

**Verdict:** APPROVED

Reviewed alone, `fix/intake-followups` at `f6469daa3ca813a3acaad1ac6abf73bc507413ec`; round 2 diff
`git diff fa54dd2..f6469da -- . ':!.mstack'` (6 files, +54 -31), item base `07646f6`. I wrote none of
it and did not review round 1. No mstack plugin was loaded in this session; I played
`agents/reviewer.md` and `skills/review/SKILL.md`, read-only on the product. Every CLI call is this
checkout's `./bin/mstack` (`mstack 0.2.1 at /Users/romerma/Code/mstack`) or its absolute path. Scratch
root, called `$R` below:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review73r2/`
(`streams/` every stream and driver log, `projects/` every sandbox, `snap/` the parked states the
partial runs were copied from, `clone/` the mutant clone, `cli/` the throwaway store, `bin/` the
scripts, `prompts/` every prompt). No claude, driver or suite process of mine is left running.

B-1 is closed: the note every parking run wrote carries both halves of the answer rule as commands,
and 3 of 3 fresh partial-answer sessions, worded three ways, wrote a plain row, re-stated the field
with only the open forks, kept `--resolves` off, and left an item the CLI refuses to build while
naming only what is open. The rest-of-answers and the full-answer sessions each wrote one `--resolves`
row and moved the item to `specifying`. Round 1's N-1, N-2, N-4, N-5, N-11 and CM14 are taken; the End
paragraph is true on the real CLI on every path I walked; lint fails every named removal and the two
new cases, and passes every tree that passed at `07646f6` except one header that is wrong by the rule.
Nothing blocks. Non-blocking notes below.

## Non-blocking

Numbered for this round; round 1's findings are written "round 1 N-x".

**N-1. End's "which cannot go back to `specifying`" is true of the move the CLI refuses, and silent
on the way round it** (`skills/router/references/intake.md:57-59`). `in_progress -> specifying` is
refused, but `in_progress -> blocked -> specifying` is two legal moves with no `--force`
(`src/lifecycle.ts:93`, `blocked: STATUSES.filter(...)`; CLI run `late` in Probe B). Round 1's N-2
asked for the case where understand finds a multi-subsystem change after `in_progress`; the sentence
now warns that the direct move is refused but does not say what to do then. My ruling: not false
(it describes the transition the CLI rejects, in the CLI's own terms), and it sends nothing down
the wrong path. One clause ("go through `blocked`, and record why") would finish it.

**N-2. The note's command template carries `--why ..`, and a resolving row needs 40 characters**
(`src/cli.ts:859-866`, `MIN_REPORT_BYTES` for `--why` and `--evidence`; a plain row has no floor).
D's park run filled the placeholder into its note as `--why "user answer"`; PA2 used it on its plain
row (accepted) and FULL used it on the resolving row, which the CLI refused ("resolving a fork needs
--why to say something; got 11 characters"); FULL's second try, with a longer `--why`, recorded the
one row. n=1 of 2 resolving rows; REST's first try passed. Pre-existing (`--why ..` was in the round 1
template too); the refused call writes nothing, so there is still one row.

**N-3. PA1 kept the answered forks inside the re-stated field as a parenthetical** ("2) Should the
surcharge be +20% ...? (Settled: 1) weekend night = night starting Fri or Sat; 3) discount applies
after surcharge.)"), so the CLI's refusal prints them next to the one open question. My ruling: it
holds (one question is open, the other two are labelled settled), but "only the open forks"
(`intake.md:40`) could be read more strictly. n=1 of 3.

**N-4. README's fork definition omits the irreversible half** (`README.md:220-221`: "a question whose
answers change what the product's user can do or get"). The Map (`intake.md:17`, "or it cannot be
undone"), the wiki (`docs/wiki/How-A-Work-Item-Flows.md:113-116`) and router step 3
(`skills/router/SKILL.md:28`, "a product fork or irreversible choice") put irreversible choices in
`decision_required` too. When a fork is parked (`README.md:227-229`) agrees with
`docs/wiki/The-CLI.md:258-259` and intake. Incomplete, not contradictory.

**N-5. CHANGELOG lags round 2.** `CHANGELOG.md:11-12` still says the note "carries the `--resolves`
rule (one `decide` row listing every answer)", the half round 1 found insufficient; the partial-answer
half, the router's skip-list clause for a named `pending` item and origin headers in `agents/` are not
in the entry. Criterion 6 is about how forks are defined and parked, and that text is still true.

**N-6. lint on a third-party plugin: an origin comment in an agent file without a `licenses/` path
now fails** (Probe C, `foreign2`: base and `fa54dd2` pass, head fails "agents/greeter.md: origin
header names no file under licenses/"). The same comment in a skill file has failed since `fa54dd2`
(`foreign3`), so this is the rule extended as written, and the header is wrong by it. A tree with no
headers is unchanged.

**N-7. Only the first origin header in a file is checked** (`src/lint.ts:431`, a non-global
`header.exec`): an agent file with a good header followed by one naming `licenses/nope-LICENSE.txt`
passes (`$R/t2`, "PASSED - 0 failures, 0 warnings"). Same class as round 1's N-6, left out on
purpose.

**N-8. One borderline classification in my park runs.** W took "stored bookings keep their saved
total_cents" as a reversible row. By the Map's reach ("stored") it is close to a fork; round 1 ruled
the cleaning-fee analogue a fork. My ruling: reversible, since the project never recomputes a stored
total and nothing in the request reaches back. The Map is unchanged in round 2. n=1.

**N-9. Outside this item, seen again.** PA2 tried `state set --acceptance-add`, got "Unknown option",
tried `mstack state set --help` ("no item matches '--help'"), then edited `.mstack/state.json` with
Python to append a criterion, telling the user "mstack has no command to append a requirement"
(`--add-acceptance` exists): item 74. SEED printed no `skip: <reason>` line for intake (router step 3
asks for one), n=1, and moved the item correctly. Briefs still ask for a `Co-Authored-By` trailer in
the sandbox (item 35).

## Probe A: B-1, the partial answer in fresh sessions

**Wrapper** (`$R/bin/drive.mjs`, round 1's driver with its scratch path set to `$R`). Per new project:
a fresh copy of `/Users/romerma/Code/mstack/sandbox/bench/template` in `$R/projects/<name>`, `git init`
and a commit, this checkout's `bin/mstack setup` under the clean environment, `state.verify` set to
`python3 -m unittest discover -s tests` (`sandbox/bench/lib.mjs:10`, as `run.mjs:107` does), committed.
The environment is built from the names `HOME USER LOGNAME TERM LANG TMPDIR SHELL PATH`, with
`PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/Users/romerma/.bun/bin:/Users/romerma/.local/bin`
(driver log); no `ANTHROPIC_*` variable. Command: `claude -p "<prompt>" --model opus --output-format
stream-json --verbose --setting-sources project --strict-mcp-config --max-budget-usd 6 --plugin-dir
/Users/romerma/Code/mstack --permission-mode auto`, its own process group, stdout to
`$R/streams/<name>.jsonl`, outside every project; killed at 600 s, or a grace after a top-level
`mstack:implementer` or `mstack:spec-author` launch. Every init event: `model=claude-opus-5-5
perm=auto cc=2.1.326`, plugin `{"name":"mstack","path":"/Users/romerma/Code/mstack","source":"mstack@inline"}`.
Every answering session is a new `claude -p` in a `cp -R` copy of a parked project (new path, so no
transcript to resume); no `--resume`, no `--continue`.

### Parking, n=2 (my requests, different from round 1's and the implementer's)

| Run | Prompt | Forks parked | Rows taken | End | Cost, time |
|---|---|---|---|---|---|
| W | `/mstack add a weekend surcharge: nights on a weekend should cost more than weeknights.` | 3: which nights, how much, does `--discount-percent` apply after it | 1 (surcharge inside `pricing.quote`; stored totals not repriced, N-8) | ended itself, `pending` | 0.234 USD, 40 s, 6 turns |
| D | `/mstack let a guest change the dates of a booking they already made.` | 3: re-price at the current rate, refuse a cancelled booking, fix `Booking.overlaps` first | 3 (found by id like `cancel`; dates only; output in `book`'s format) | ended itself, `pending` | 0.285 USD, 53 s, 6 turns |

The notes, verbatim (`## Next step` of each `current.md`):

```
W   weekend-surcharge is waiting on the user's answers to 3 forks (see `decision_required` in state.json):
    1) weekend night = night starting Fri or Sat (rec: yes) 2) surcharge +20% of nightly rate, all room types, rounded per night (rec: yes) 3) discount applies after surcharge (rec: yes).

    Partial answer: `mstack decide --phase intake --decision "<answers so far>" --why ".." --evidence "<their words>" --result "<chosen>"` then `mstack state set weekend-surcharge --decision-required "<only the open forks>"`.
    All answered: same `mstack decide` row with `--resolves weekend-surcharge`, `--decision "1) .. 2) .. 3) .."`.
    Then: item is on the spec path (`mstack state set weekend-surcharge --status specifying`), resume at router step 4 with the feature playbook. ...

D   Item `reschedule-booking` is parked on 3 forks (see its decision_required in state.json):
    1) re-price at current rate for new dates (rec: yes); 2) refuse cancelled bookings (rec: yes);
    3) fix Booking.overlaps to half-open first as its own bug-fix item (rec: yes; ...).

    Partial answer: `mstack decide --phase intake --decision "<answers so far>" --why "user answer" --evidence "<their words>" --result "<chosen>"`
    then `mstack state set reschedule-booking --decision-required "<only the open forks>"`.
    All answered: same decide row with `--resolves reschedule-booking`, then
    `mstack state set reschedule-booking --status specifying` (spec path), resume router step 4 with the feature playbook.
```

Both carry both halves as runnable commands, with the slug filled in: a partial answer is a plain row
then the field re-stated; the full answer is the same row with `--resolves`. An agent can act on
either from the note alone, which is what every answering session below did (0 reads of `intake.md`).

### Partial answers, three fresh sessions, three wordings

| Run | Copy of | Answer (after `/mstack `) | Plain row | Field re-stated, open forks only | `--resolves` | `state set <slug> --status in_progress` on a copy afterwards | `intake.md` reads | Cost, time |
|---|---|---|---|---|---|---|---|---|
| PA1, slug + numbers | W | `weekend-surcharge: 1) yes 3) yes. Still deciding on 2.` | yes | yes, fork 2 (with a "Settled:" note, N-3) | no | refused, exit 2, lists fork 2 | 0 | 0.195 USD, 34 s |
| PA2, loose prose, no slug, no numbers | D | `about changing the dates of a booking: go ahead and recalculate the price for the new dates like you suggested. I haven't made up my mind about the other things you asked yet.` | yes | yes, forks 2 and 3 | no | refused, exit 2, lists 2 and 3 | 0 | 0.204 USD, 37 s |
| PA3, against the recommendation | W | `weekend-surcharge: for 2, no, make it a flat $15 extra per weekend night for every room type instead of a percentage. I'll answer 1 and 3 later.` | yes | yes, forks 1 and 3 (3 reworded to name the flat surcharge) | no | refused, exit 2, lists 1 and 3 | 0 | 0.179 USD, 26 s |

3 of 3 hold on every column (round 1 at `fa54dd2`: 0 of 3 re-stated the field). Each session stopped,
said which forks remain, kept the item `pending` and rewrote the note to the open forks; PA1 also appended `history.md`.

The executed commands (`node $R/bin/check.mjs <run> <project>`; `--resolves` checked in
`decisions.tsv` itself, where no partial row has the `resolves` column set):

```
PA1 CMD> mstack decide --phase intake --decision "weekend-surcharge forks: 1) weekend night = night starting Fri or Sat: yes. 3) --discount-percent applies after the surcharge: yes. 2) still open." --why "user answered forks 1 and 3; fork 2 deferred" --evidence "user: 'weekend-surcharge: 1) yes 3) yes. Still deciding on 2.'" --result "1 and 3 take the recommended option; 2 remains a decision_required fork" && mstack state set weekend-surcharge --decision-required "2) Should the surcharge be +20% of the room's nightly rate, ...? Recommended: yes, ... (Settled: 1) weekend night = night starting Fri or Sat; 3) discount applies after surcharge.)" && ...
    OUT> recorded
         1 weekend-surcharge (pending)
           decision_required: "1) Should a weekend night be a night that sta..." -> "2) Should the surcharge be +20% of the room's..."
PA2 CMD> mstack decide --phase intake --decision "Fork 1 answered: reschedule re-prices total_cents at the current nightly rate for the new dates. Forks 2 (refuse cancelled) and 3 (fix overlaps first) still open." --why "user answer" --evidence "user 2026-11-17: 'go ahead and recalculate the price ...'" --result "re-price at current rate" && \
         mstack state set reschedule-booking --decision-required "2) Should rescheduling a cancelled booking be refused with an error? ... 3) Booking.overlaps is wrong today: ... Should I fix overlaps ... first, as its own bug-fix item ...?"
    OUT> recorded
         1 reschedule-booking (pending)
           decision_required: "1) Should the total be re-priced at the curre..." -> "2) Should rescheduling a cancelled booking be..."
PA3 CMD> mstack decide --phase intake --decision "2) weekend surcharge is a flat \$15.00 (1500 cents) extra per weekend night, same for every room type, not a percentage. Forks 1 and 3 still open." --why "user overrode the recommended +20%; ..." --evidence "user 2026-11-17: 'for 2, no, make it a flat \$15 ...'" --result "flat 1500 cents per weekend night" && \
         mstack state set weekend-surcharge --decision-required "1) Should a weekend night be a night that starts on Friday or Saturday ...? Recommended: yes, ... 3) Should --discount-percent apply to the total after the flat \$15-per-weekend-night surcharge ...? Recommended: yes, ..."
    OUT> recorded
         1 weekend-surcharge (pending)
           decision_required: changed, and the short forms match, so both in full ...
```

The real CLI afterwards, each on a copy of the after-partial project (`$R/snap/<p>-after`):

```
[W1] $ mstack state set weekend-surcharge --status in_progress
mstack: weekend-surcharge has an unanswered decision: "2) Should the surcharge be +20% of the room's nightly rate, the same percentage for every room type, rounded to the nearest cent per night? Recommended: yes, ... (Settled: 1) weekend night = night starting Fri or Sat; 3) discount applies after surcharge.)"
        answer it with 'mstack decide --resolves weekend-surcharge ...' first
[exit 2]
[D1] $ mstack state set reschedule-booking --status in_progress
mstack: reschedule-booking has an unanswered decision: "2) Should rescheduling a cancelled booking be refused with an error? ... 3) Booking.overlaps is wrong today: ... Should I fix overlaps to true half-open semantics first, ...?"
[exit 2]
[W2] $ mstack state set weekend-surcharge --status in_progress
mstack: weekend-surcharge has an unanswered decision: "1) Should a weekend night be a night that starts on Friday or Saturday ...? 3) Should --discount-percent apply to the total after the flat $15-per-weekend-night surcharge ...?"
[exit 2]
```

### The rest, and a full answer in one go

| Run | Project | Answer | Rows | Status | End of run |
|---|---|---|---|---|---|
| REST | W2 after PA3 (forks 1, 3 open) | `weekend-surcharge: yes to 1 and yes to 3.` | one `--resolves weekend-surcharge` row, first try, `--decision` listing 1, 2 ("already decided") and 3 | `pending -> specifying` in the same command | spec-author launched; killed 20 s later, 47 s |
| FULL | D2, copy of parked D (3 open) | `reschedule-booking: 1 yes, 2 yes, 3 no: leave the overlap check as it is in this item and reuse it.` | one `--resolves reschedule-booking` row listing all three; the first attempt was refused for an 11-character `--why` and wrote nothing (N-2) | `pending -> specifying` | spec-author launched; killed, 88 s |

```
REST CMD> mstack decide --phase intake --decision "1) a weekend night is a night starting Friday or Saturday (check out Sat or Sun morning) 2) flat \$15/weekend night, 1500 cents, every room type (already decided) 3) --discount-percent applies to the total after the weekend surcharge" --why "user accepted the recommendations for 1 and 3; 2 was settled earlier" --evidence "user 2026-11-17: 'weekend-surcharge: yes to 1 and yes to 3.'" --result "Fri/Sat nights +1500 cents each; discount taken off the surcharged total" --resolves weekend-surcharge && mstack state set weekend-surcharge --status specifying && mstack state active
     OUT> recorded, and weekend-surcharge no longer has an open fork
          1 weekend-surcharge (specifying)
            status: "pending" -> "specifying"
FULL CMD> mstack decide --phase intake --decision "1) re-price at current rate for new dates: yes. 2) refuse rescheduling a cancelled booking: yes. 3) do not fix Booking.overlaps first; ..." --why "user answer" ... --resolves reschedule-booking && ...
     OUT> mstack: resolving a fork needs --why to say something; got 11 characters, and this is the column a reader consults later
FULL CMD> mstack decide --phase intake --decision "1) re-price at current rate for new dates: yes. 2) refuse rescheduling a cancelled booking: yes. 3) do not fix Booking.overlaps first; reschedule reuses it unchanged, so the known containment miss and back-to-back rejection stay" --why "User chose all three. ..." --evidence "reschedule-booking: 1 yes, 2 yes, 3 no: ..." --result "forks resolved; overlaps untouched in this item" --resolves reschedule-booking && mstack state set reschedule-booking \ ...
     OUT> recorded, and reschedule-booking no longer has an open fork
          1 reschedule-booking (specifying)
            status: "pending" -> "specifying"
```

`decisions.tsv` afterwards: W2 holds one row with `resolves=weekend-surcharge` (13:03:13.246Z, which
`decision_resolved` points at) and PA3's plain row; D2 holds one row with
`resolves=reschedule-booking` (13:03:32.162Z). Both move as End says for an answered fork, the spec path.

## Probe B: the End line and the status phrase (round 1 N-1, N-2)

**On the real CLI**, throwaway store `$R/cli` (`git init`, this checkout's `setup`):

```
direct     state add --slug direct ...                 -> added 1 direct (pending)
           state set direct --status in_progress       -> 1 direct (in_progress)            [exit 0]
sdd        state add --slug sdd1 ... --sdd; --status specifying -> (specifying) [exit 0]; --status spec_ready -> (spec_ready) [exit 0]
           gate --quiet -> [fail] sdd item sdd1 is spec_ready but has no spec at .../specs/sdd1   [exit 1]
           (four spec files written) gate --quiet -> only the current.md check left           [exit 1, no spec failure]
parked     state add --slug fork ... --decision-required "1) Q? ... 2) R? ... 3) S? ..."
           state set fork --status in_progress -> mstack: fork has an unanswered decision: "1) Q? ... 2) R? ... 3) S? ..."  [exit 2]
           state set fork --status spec_ready  -> same refusal                                 [exit 2]
partial    decide --phase intake --decision "1) yes, Q the recommended way" ...  -> recorded
           state set fork --decision-required "2) R? ... 3) S? ..."  -> decision_required: "1) Q? ..." -> "2) R? ... 3) S? ..."
           state set fork --status in_progress -> mstack: fork has an unanswered decision: "2) R? Recommended: yes. 3) S? Recommended: yes."  [exit 2]
answered   (fork4, same shape) decide --resolves fork4 --decision "1) yes, Q (earlier row) 2) no, R done the other way" ... -> recorded, and fork4 no longer has an open fork
           state set fork4 --status specifying -> (specifying) [exit 0]; --status spec_ready -> (spec_ready) [exit 0]; gate --quiet [exit 0]
           state set fork4 --status in_progress -> (in_progress) [exit 0]; gate --quiet [exit 0]
judgement  state add --slug multi ... (no sdd, no field); --status specifying [exit 0]; --status spec_ready [exit 0]; --status in_progress [exit 0]
late       state set late --status in_progress [exit 0]; --status specifying ->
           mstack: in_progress -> specifying is not a legal transition
                   pass --force if you mean to skip a phase, and say why in decisions.tsv   [exit 2]
           state set late --status blocked [exit 0]; state set late --status specifying -> 7 late (specifying) [exit 0]
answered, direct  (fork3) decide --resolves fork3 ...; state set fork3 --status in_progress [exit 0]; gate --quiet [exit 0]
```

Read against `src/lifecycle.ts:85-95` (transitions), `:49-55` (decision from `spec_ready`) and the gate
(`src/gate.ts:274-333` decisions, `:335-373` spec artifacts, `sdd` items only), End (`intake.md:57-59`) and "The two
paths" (`SKILL.md:56-63`) agree:

- A direct item goes to `in_progress`; nothing refuses it. Every spec-path item (`sdd`, a resolved
  fork, a judgement trigger) goes to `specifying` and reaches `spec_ready` without `--force`. An `sdd`
  item at `spec_ready` with no spec fails the gate until the four files exist, which is the spec path
  working. An answered fork still carries `decision_required` (REST and FULL keep the field next to
  `decision_resolved`), so "an answered fork is one" matches the router's "the item carries a
  `decision_required` field".
- A parked item: `in_progress` and `spec_ready` are refused while a fork is open, so "a parked item
  stays `pending` until answered" cannot be broken toward building; `pending -> specifying` with the
  fork open is legal (lifecycle comment at `:41-48`) and End's sentence is the only thing against it,
  which is item 55's design.
- The judgement triggers (several subsystems, the user stepping away) are not a field: the CLI takes
  whatever the coordinator picks, and for a non-`sdd` item nothing checks for a spec at `spec_ready`
  (`multi` above), so End's "choose the path by the triggers" is the whole of it. Learned after
  `in_progress`, the direct move back is refused as End says; `blocked` is the legal way round, which
  End does not name (N-1).
- Nothing in the paragraph contradicts itself: "(an answered fork is one)" and "A parked item stays
  `pending` until answered" do not collide, which was the implementer's first-draft problem.

**Live, n=1 each:**

| Run | Setup | Prompt | What happened | Status calls | Time |
|---|---|---|---|---|---|
| SEED | new project; `state add --slug rooms-command --title "a rooms command lists room types and rates" --acceptance "python3 -m bookings rooms prints one line per room type, ..." --source "backlog, seeded by hand, 2026-11-17"` (no intake, no seams) | `/mstack continue with rooms-command` | read `state.json` and `feature.md`; `git checkout -b feat/rooms-command && mstack state set rooms-command --status in_progress --seam "BookingService.rooms() ..." --seam "cli.main(['rooms'], ...)"`; design row; brief with seams "pre-agreed, do not ask to confirm" and "write the first test ... run it red"; `mstack:implementer` launched | `--status in_progress`, first try; 0 "is not a status", 0 "not a legal transition" in the stream | killed 15 s after the launch, 59 s |
| SPEC | new project | `/mstack cancel should refuse a booking that is already cancelled: it prints "error: booking <id> is already cancelled" to stderr and exits 1, like the other errors, and leaves the data file unchanged. Cancelling an active booking, and an unknown id, behave as they do today.` | read `intake.md`; "Intake: everything is specified by the request (message, stream, exit code, file untouched), so no forks. One reversible decision to record."; 1 row (`AlreadyCancelled(BookingError)` in the service); `state add` then `state set --status in_progress`; branch; `mstack:implementer` launched | `--status in_progress`, first try | killed 15 s after the launch, 62 s |

```
SEED CMD> git checkout -b feat/rooms-command && mstack state set rooms-command --status in_progress --seam "BookingService.rooms() returns a list of (room, nightly_rate_cents) tuples in ROOM_RATES insertion order, read from bookings.domain.pricing.ROOM_RATES" --seam "cli.main(['rooms'], service=..., out=..., err=...) is the CLI test seam, same as the existing CliTests.run_cli helper" && mstack decide --phase design ...
     ITEM rooms-command status=in_progress
SPEC CMD> mstack decide --phase intake --decision "Refuse in BookingService.cancel via a new AlreadyCancelled(BookingError) in domain/errors.py; CLI keeps its single BookingError handler" ... --result "if wrong: a class rename or move, no user-visible change" && \
          mstack state add --slug cancel-already-cancelled --title "cancel refuses an already-cancelled booking" \
          mstack state set cancel-already-cancelled --status in_progress && mstack state active
     OUT> recorded / added 1 cancel-already-cancelled (pending) / 1 cancel-already-cancelled (in_progress) / status: "pending" -> "in_progress"
```

SEED read neither `intake.md` nor any End text; the router's new skip-list clause (`SKILL.md:23-24`)
is the only text it read that names the status (`rg in_progress` over `feature.md`, `principles.md` and the router finds only `SKILL.md:24`), and it took it. Round 1's S, same shape, guessed
`--status active` first; one run each, so this is a comparison, not a controlled pair. SPEC is the
over-parking check on the reworded `intake.md`: nothing parked, carried on to the implementer.

## Probe C: lint, in `$R/clone` at `f6469da`

`node $R/bin/trees.mjs $R/clone` breaks the clone's tree per case, runs that clone's `./bin/mstack
lint-plugin .`, prints the failures, and restores (`git checkout -- . && git clean -fdq`). Output in
`$R/trees.txt`.

```
### T1 agents/spec-author.md, header after front matter, licence missing
  exit 1: FAILED - 1 failure, 0 warnings
  [fail]  agents/spec-author.md: origin header names licenses/nope-LICENSE.txt, which does not exist
### T1b agents/orchestrator.md, header appended at the end, licence missing
  [fail]  agents/orchestrator.md: origin header names licenses/nope-LICENSE.txt, which does not exist
### T2 skills/ship/SKILL.md, header after front matter, licence missing
  [fail]  skills/ship/SKILL.md: origin header names licenses/nope-LICENSE.txt, which does not exist
### T2b skills/spec/references/templates.md (a non-SKILL file), licence missing
  [fail]  skills/spec/references/templates.md: origin header names licenses/nope-LICENSE.txt, which does not exist
### T3 agents/spec-author.md, header naming no licences/ path
  [fail]  agents/spec-author.md: origin header names no file under licenses/
### T4 agents/spec-author.md, header naming a licence that ships (must pass)
  exit 0: PASSED - 0 failures, 0 warnings
### N1 router intake step (step 3) removed
  [fail]  skills/router/SKILL.md: the orient steps do not link references/intake.md
### N2 origin header of intake.md removed
  [fail]  skills/router/references/intake.md: no origin header
### N2b origin header of test-first removed
  [fail]  skills/test-first/SKILL.md: no origin header
### N3 licenses/mattpocock-skills-LICENSE.txt removed
  exit 1: FAILED - 2 failures, 0 warnings
  [fail]  skills/test-first/SKILL.md: origin header names licenses/mattpocock-skills-LICENSE.txt, which does not exist
  [fail]  skills/router/references/intake.md: origin header names licenses/mattpocock-skills-LICENSE.txt, which does not exist
### N4 licenses/obra-superpowers-LICENSE.txt removed
  [fail]  skills/test-first/SKILL.md: origin header names licenses/obra-superpowers-LICENSE.txt, which does not exist
  [fail]  skills/router/references/intake.md: origin header names licenses/obra-superpowers-LICENSE.txt, which does not exist
### N5 implementer skills entry test-frist
  [fail]  agents/implementer.md: skills entry 'test-frist' names no skill under skills/
### N6 test-first gets disable-model-invocation: true
  [fail]  agents/implementer.md: skills entry 'test-first' has disable-model-invocation: true, so it is not preloaded
### N7 intake.md deleted outright
  exit 1: FAILED - 3 failures, 0 warnings
  [fail]  skills/router/SKILL.md: broken link to references/intake.md (x2)
  [fail]  skills/router/playbooks/orchestrate.md: broken link to ../references/intake.md
```

The two new cases (an agent file and a skill file outside `ORIGIN_REQUIRED`, each naming a licence
that does not exist) fail and name the file and the missing licence, in both placements; round 1's
removals still fail, each naming its cause; a good header in an agent file passes.

**Trees**, each under `07646f6`'s lint (`git archive`), `fa54dd2`'s, and head's (`$R/trees-compare.txt`):

```
base  mstack: exit 0 | PASSED - 0 failures, 0 warnings          r1 same   head same
base  notes-cli: exit 1 | FAILED - 1 failure, 4 warnings | [fail] missing .claude-plugin/plugin.json    r1 same   head same
base  consumer: exit 1 | FAILED - 1 failure, 4 warnings | [fail] missing .claude-plugin/plugin.json     r1 same   head same
base  foreign: exit 0 | PASSED - 0 failures, 2 warnings         r1 same   head same
base  foreign2: exit 0 | PASSED - 0 failures, 2 warnings        r1 same   head: exit 1 | FAILED - 1 failure | [fail] agents/greeter.md: origin header names no file under licenses/
base  foreign3: exit 0 | PASSED                                 r1: exit 1 [fail] skills/hello/SKILL.md: origin header names no file under licenses/   head same as r1
```

`consumer` is a `git init` plus this checkout's `setup`; `foreign` is a plugin with a manifest,
`skills/hello/SKILL.md`, `agents/greeter.md` (`skills: [hello]`), no router, no `licenses/`, no
headers; `foreign2` and `foreign3` add `<!-- Origin: adapted from someone/else @ abc123 (MIT, see
LICENSE at the repository root) -->` to the agent and to the skill. The only difference from `07646f6`
on a tree that passed there is `foreign2`, a header that names no licence file, which is wrong by the
rule and fails the same way in a skill file since `fa54dd2` (N-6). Lint does not pass on `notes-cli` or
a consumer at any revision (neither is a plugin), and round 2 adds nothing to those reports.

**Mutants of the changed lines** (`src/lint.ts:434-436`, the `files` set), `node $R/bin/mutants.mjs
$R/clone`: each applied, `bun test ./tests` and the node half (`node --disable-warning=ExperimentalWarning
--experimental-strip-types --test 'tests/*.test.ts'`) in full, failing tests recorded, reverted
(`restored: true`). Output in `$R/mutants.txt`.

| # | Mutant | bun half | node half | Result |
|---|---|---|---|---|
| CM14 (round 1) | `const files = new Set<string>();`, only `ORIGIN_REQUIRED` scanned | 552/1: "an origin header outside the required list that names a missing licence is caught" | 552/1: same | killed |
| MA (mine) | `skills/` dropped, only `agents/` scanned | 551/2: the same test, plus "inside a checkout, the checkout's own bin/mstack stays green ..." [5002 ms, a timeout] | 551/2: the same test, plus `costs.test.ts:698` | killed |
| MB (mine) | `agents/` dropped, only `skills/` (the `fa54dd2` line, a revert) | 552/1: same test | 552/1: same test | killed |
| MC (mine) | only files named `SKILL.md` scanned | 552/1: same test | 552/1: same test | killed |

MA's extra failures are load timeouts (a 5 s test timeout and the 50 MB hook budget) that touch nothing
in `lintOrigins`; no kill rests on them, and both files pass serially on head (Probe E). MB shows the
new test fails on a revert of the code change; MA and MC show both of its halves are needed.


## Probe D: the prose

- **Round 1 N-4, `intake.md:27-28`**: "Write the `if wrong:` line first: if it names lost data or meets the
  fork test above, this is a fork, not a row." "Meets the fork test" can only mean "is a fork by the
  Map's Fork row" (`:17`); there is no backwards reading left.
- **Round 1 N-11, `feature.md:17-19`**: "`mstack state set <slug> --seam "..." --seam "..."`, every seam in that
  one call, because `--seam` replaces the list." One call, every seam. SEED did exactly that (two
  `--seam` in one `state set`, Probe B). The rest of step 4 (seams array named, `skip: no behaviour`
  kept, first test red) is the round 1 text rewrapped: `git diff fa54dd2..f6469da --
  skills/router/playbooks/feature.md` changes no other clause.
- **Round 1 N-5, `README.md:220-231`**: the fork is now "a product fork, a question whose answers change what
  the product's user can do or get", and parking is "Intake parks the forks it finds with `state add
  --decision-required`. One that turns up later, usually while `specifying`, is attached with ...",
  which matches `docs/wiki/The-CLI.md:258-259` and `intake.md:32-36`. The two round-1 statements ("two
  answers produce different work"; "Forks are usually found while `specifying`, which is after
  intake") are gone. The definition leaves out "or it cannot be undone" (N-4 above).
- **The 22 changed lines of `intake.md`** (hunks at `:28`, `:37-43`, `:57-59`): the Map (`:8-18`), so
  the classification order (fact, fork, reversible, "by the first row that fits") and the fork reach,
  is untouched; "The round is the final message of the turn: stop there." is still in the Park
  paragraph (`:41-42`), now after the two commands instead of before the rule paragraph. Live, the
  reach held where the round 2 text was read: W and D parked 3 forks each and took reversible rows;
  SPEC parked none. Every answering session stopped after its row.
- **The router phrase (round 1 N-1), `SKILL.md:23-24`**: "a request that names an existing item (a `pending`
  one that work starts on moves as intake's End says: `in_progress` or `specifying`)". It names both
  statuses and defers the choice to End, so it does not restate the triggers in a second place.
- **Sizes**: `intake.md` 77, `skills/router/SKILL.md` 158, `skills/test-first/SKILL.md` 60
  (`wc -l`). **Dashes**: `git diff fa54dd2..f6469da -- . ':!.mstack' | rg -c '^\+.*(\x{2014}|\x{2013})'`
  finds nothing, and the same over `07646f6..f6469da` finds nothing.

## Probe E: regression on the head

With no live run, driver or mutant suite going (`pgrep -fl 'claude -p|bun test|node
--disable-warning|drive.mjs'` empty), in the working tree at `f6469da`:

```
$ npm test
 553 pass
 0 fail
Ran 553 tests across 26 files. [93.19s]
ℹ tests 553
ℹ pass 553
ℹ fail 0
npm test exit 0
$ bun run typecheck
$ bunx --bun tsc --noEmit
typecheck exit 0
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full            (first run)
ℹ tests 553 / ℹ pass 552 / ℹ fail 1
✖ hook paths stay within budget on a 50 MB transcript (2290.351958ms)
  AssertionError [ERR_ASSERTION]: Stop with a 50 MB transcript took 413.0167080000001ms against 240.13512499999888ms without one
[fail]  npm test && npm run typecheck && bin/mstack lint-plugin . failed
FAILED - 1 failure, 0 warnings          (exit 1)
$ node ... --test tests/costs.test.ts tests/run.test.ts   ->  ℹ tests 48 / ℹ pass 48 / ℹ fail 0
$ bun test tests/costs.test.ts tests/run.test.ts          ->  48 pass / 0 fail
$ ./bin/mstack gate --full            (rerun)
 553 pass / 0 fail / Ran 553 tests across 26 files. [109.83s]
ℹ tests 553 / ℹ pass 553 / ℹ fail 0
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings          (exit 0)
$ ./bin/mstack ledger check intake-followups   (before my row)
FAIL no verdict at f6469daa; 3 row(s) exist at other SHAs and a new head SHA voids them
```

The one red was `tests/costs.test.ts:698`, the load-sensitive timing test (item 67), in the suite run
inside `gate --full`; round 2 touches no hook or cost code, the same test passed in the plain `npm
test` a few minutes earlier, both its files pass serially in both runtimes, and the rerun of `gate
--full` is green. I conclude nothing from it. 553 tests is round 1's 552 plus the new lint test.

## Requirement to test

| Criterion | Test or run that would fail if it were reverted |
|---|---|
| 5, 11 (lint) | `tests/lint.test.ts`; round 2 adds "an origin header outside the required list that names a missing licence is caught" (`:258-272`), which kills CM14, MA, MB and MC in both halves (Probe C). MB is the `fa54dd2` line, so the agent half fails on a revert; the skills half was green at `fa54dd2` and is a guard against CM14. No existing test changed: the diff to `tests/lint.test.ts` is 16 added lines. |
| 1, 2, 3, 4, 8, 9, 10 (prose) | No test, by the item's seam ("skills/router/SKILL.md and references/intake.md as read by a headless claude -p run"); the live runs in Probes A and B are the evidence. |
| 6, 7, 12 | Docs and a measurement; round 2 touches none of their files (`git diff --stat fa54dd2..f6469da -- docs CHANGELOG.md skills/test-first agents hooks` is empty). |

## Acceptance, quoted

For criteria round 1 found met and round 2 does not touch, I confirmed the text they rest on is
unchanged and re-ran only what round 2 could have moved.

| # | Criterion | Met | Evidence | Rung |
|---|---|---|---|---|
| 1 | "a session that answers a parked fork has the --resolves placement rule in context: the current.md note carries it or router step 2 points at intake.md's Park a fork section, and a fresh headless session with a full answer to three forks writes one row that lists all three" | **Met** (B-1 closed) | `intake.md:36-41` now puts both halves in the note; W and D wrote both as commands. Partial answers, fresh sessions, n=3, three wordings: 3/3 plain row, 3/3 field re-stated with only the open forks, 0/3 `--resolves`, 3/3 refused at `in_progress` listing only the open forks; 0 `intake.md` reads. Full answer to three forks, fresh session (FULL): one `--resolves` row listing all three (one earlier call refused by the CLI, no row, N-2). The rest after a partial (REST): one `--resolves` row listing all three. | 5 (n=2 park, n=3 partial, n=1 rest, n=1 full) |
| 2 | "Closing a session does not reset a current.md that records a parked fork" | Met | `SKILL.md:154-155` unchanged since `fa54dd2`; none of my sessions closed one (PA1 appended `history.md` and kept the note). | 2 (text unchanged); round 1's live close stands |
| 3 | "the fork test is stated once and the Map row, the if-wrong test and the Autonomy clause agree on labels, message text and exit codes; 'however cheap the code change is' cannot be read as qualifying only the irreversible clause" | Met | Map rows `intake.md:17-18` unchanged; the `if wrong:` test now reads "meets the fork test above" (`:28`, round 1 N-4); Autonomy `SKILL.md:95-97` unchanged. Live reach on the round 2 text: W, D, SPEC (N-8 one borderline row). | 2 + 5 (n=3) |
| 4 | "router step 2 no longer needs current.md read to know whether to read it, and the skip list covers a parked item, which is pending" | Met | `SKILL.md:18-26`; the skip list still names "answering a parked fork" and now also says how a named `pending` item moves. All five answering sessions skipped intake (PA1, PA3 printed `skip: answering a parked fork`) and resumed from the note the SessionStart hook printed. | 2 + 5 (n=5) |
| 5 | "lint-plugin fails when the router's intake step, the origin header of intake.md or either licence file is removed" | Met | Probe C N1-N4 and N2b fail with the cause named at head; the trees that passed at `07646f6` still pass. | 4 |
| 6 | "CHANGELOG.md, docs/wiki/The-CLI.md:258 and docs/wiki/How-A-Work-Item-Flows.md:113 describe forks as intake now defines and parks them" | Met | Files untouched by round 2; round 1's reading stands. The CHANGELOG's note clause now describes half of the note (N-5); README aligned (N-4 for its one gap). | 2 |
| 7 | "the cost of sending every item with an answered intake fork down the spec path is measured on one small request, and the rule is kept or narrowed with the decision recorded" | Met | Untouched; round 2's End keeps the rule ("an answered fork is one", `intake.md:57`), consistent with decision row 148. REST and FULL took the spec path as kept. | 4 (round 1, recomputed from streams) |
| 8 | "after intake's state add something moves the item to in_progress before work starts: intake's End or the playbook says so, and a headless /mstack run does it without guessing a status" | Met | `intake.md:57-59`, true on the real CLI for every path (Probe B); SPEC `state add` then `in_progress` first try; REST and FULL `specifying` first try; SEED, a named `pending` item with no intake, `in_progress` first try via `SKILL.md:23-24`. N-1 for the `blocked` route. | 5 (n=4) + 4 (CLI) |
| 9 | "feature.md's test-first step names where the seams are read (the item's seams array in .mstack/state.json, or state show once item 74 adds it), says an item that changes behaviour but has no seams gets them with state set --seam before delegation, keeps 'skip: no behaviour' for changes with no behaviour, and asks for the first test run red, not all tests" | Met | `feature.md:15-23`; SEED read `state.json`, found no seams, set two in one call, and briefed "Seams (pre-agreed, do not ask to confirm)" and "write the first test ... run it red". | 5 (n=1 for the no-seams branch) |
| 10 | "skills/test-first/SKILL.md drops the sentence about a reviewer's mutants and this repository's history, and says a refactor the brief asks for, pinned by characterization tests, writes no new test" | Met | File untouched by round 2; 60 lines. | 2 |
| 11 | "lint-plugin fails when an agent's skills entry names no skill under skills/ or names one with disable-model-invocation: true" | Met | Probe C N5, N6 at head. | 4 |
| 12 | "docs/wiki/Skills-and-Playbooks.md counts the skills it introduces correctly" | Met | Untouched; `fd -t f '^SKILL.md skills` still 14, the page still says fourteen (`:7`). | 4 (counted) |

## Ledger

`./bin/mstack ledger record intake-followups f6469daa3ca813a3acaad1ac6abf73bc507413ec live-verified --evidence .mstack/progress/review_intake-followups_r2.md --verifier reviewer`, recorded after this report was written. Rung 5 for the prose criteria (live headless runs on this checkout, n stated per row), rung 4 for lint and the CLI.

```
recorded live-verified for intake-followups at f6469daa
$ ./bin/mstack ledger check intake-followups
PASS live-verified at f6469daa by reviewer
```
