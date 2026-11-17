# Review - intake-followups (item 73)

**Verdict:** CHANGES_REQUESTED

Reviewed alone, `fix/intake-followups` at `fa54dd2e87437db2a868269a16fdef728d650556` against base
`07646f6` (`git diff 07646f6..fa54dd2 -- . ':!.mstack'`, 10 files, +337 -67). No mstack plugin was
loaded in this session; I played `agents/reviewer.md` and `skills/review/SKILL.md`, read-only on the
product. Every CLI call is this checkout's `./bin/mstack` (`mstack 0.2.1 at /Users/romerma/Code/mstack`)
or its absolute path. Scratch root, called `$R` below:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review73/`
(`streams/` every live stream and driver log, `projects/` every sandbox, `clone/` and `clone2/` the
mutant clones, `bin/` the scripts, `prompts/` every prompt). No claude, suite or watcher process of
mine is left running.

One block: the parked-fork note now carries only the full-answer half of the `--resolves` placement
rule, and fresh sessions that bring a partial answer stopped following the other half. That is a
regression of item 55's behaviour measured against the base text, and it leaves criterion 1's first
clause half met. Everything else held: the lint rules fail every named removal with the cause named
and fail nothing that was green; the under-parking and over-parking runs behaved; the End line is true
on the real CLI on both paths; the suite, typecheck, lint and gate are green.

## Blocking

### B-1. A partial answer in a fresh session no longer re-states the field, and once records no row

The rule is two sentences, `skills/router/references/intake.md:42-44`: "`--resolves <slug>` goes only
on the row that answers every fork left in the field. A partial answer never gets it: record a plain
`decide --phase intake` row and re-state the field with only the unanswered forks." The note the fork
round now writes into `current.md` (`intake.md:36-39`) carries only the first: "answer every fork in
ONE row, `mstack decide --phase intake --resolves <slug> ...`". A session that brings answers skips
intake (`skills/router/SKILL.md:21-24`), so the second sentence never reaches it. This is round 3's
N-2 mechanism again, now for the partial answer.

Three fresh sessions on head (no `--resume`), n=3:

| Run | Parked item | Prompt | Plain row | Field re-stated | `--resolves` | Status after |
|---|---|---|---|---|---|---|
| U2-partial | `max-stay-length`, 3 forks | `/mstack max-stay-length: yes to 1, a 30-night maximum. I still need to think about the other questions.` | **no** | **no** | no | pending |
| U1-partial | `cleaning-fee`, 2 forks | `/mstack cleaning-fee: yes to 1. I will come back to 2 later.` | yes | **no** | no | pending |
| U1b-partial | `cleaning-fee` (copy of U1's parked state) | `/mstack cleaning-fee: 2 no, existing bookings should get the fee added too. I have not decided 1 yet.` | yes | **no** | no | pending |

The same two cleaning-fee prompts on the base text (`git archive 07646f6` as `--plugin-dir`, same
template, same wrapper; a fresh base intake run, BASE-U1, parked the same two forks), n=2, plus round
3's B4, n=1, which ran on the same `intake.md` (its last change before `07646f6` is `dfa61d9`):

| Run | Plain row | Field re-stated | `--resolves` |
|---|---|---|---|
| BASE-U1-partial | yes | yes: `state set cleaning-fee --decision-required "2) Should bookings already in the data file keep ..."` | no |
| BASE-U1b-partial | yes | yes: `state set cleaning-fee --decision-required "1) Should --discount-percent apply only to the room nights ..."` | no |
| r3 B4 (`.mstack/progress/review_intake-step_r3.md`, Probe B) | yes | yes | no |

Base 3/3, head 0/3 on the re-statement; head 2/3 on the row. None of the head sessions read
`intake.md` (tool inputs searched); the SessionStart hook delivered the note in every one. On base,
with no rule in the note, both sessions went and looked it up (BASE-U1-partial:
`grep -rn "resolves" "$(dirname $(dirname $(pwd)))/base-plugin" --include=*.md`; BASE-U1b-partial:
`sed -n 40,48p $B/skills/router/references/intake.md`). On head the agents name the note as their
reason:

```
U1-partial  hook_response (SessionStart) ... ## Next step
            When answers arrive, answer every fork in ONE row:
            `mstack decide --phase intake --resolves cleaning-fee --decision "1) <answer> 2) <answer>" --why ".." --evidence "<their words>" --result "<chosen>"`
            FINAL> **Why I held off:** mstack expects both forks to be answered in one row that marks the item resolved. ... So I logged fork 1 as a plain decision that doesn't mark the item resolved, and left the item `pending`.
U2-partial  TOOL Bash | python3 - <<'EOF' ... "- 2026-11-17: user answered fork 1 only: \"yes to 1, a 30-night maximum\" (30 accepted, 31 refused). Forks 2 and 3 still open; not recorded in decisions.tsv yet because the resolving row must carry all three answers." ...
            FINAL> I haven't put it in the decisions log yet. Answering the forks has to happen in one entry that covers all three, so a partial entry would mark all of them answered.
```

What the store says afterwards, on the real CLI (U1 after U1-partial; U1b the same):

```
$ /Users/romerma/Code/mstack/bin/mstack state set cleaning-fee --status in_progress
mstack: cleaning-fee has an unanswered decision: "1) Should the --discount-percent discount apply to the room subtotal only, with the $25 fee added after it at full price? Recommended: yes, ... 2) Should bookings already stored in the JSON file keep their old totals (no backfill), ...? Recommended: yes, ..."
        answer it with 'mstack decide --resolves cleaning-fee ...' first
[exit 2]
```

The refusal still asks the fork the user answered. In U2 the answer to fork 1 exists only in
`current.md`, which the next session rewrites; `decisions.tsv` has no row for it. A session that loses
or misreads the note asks the user again, against intake's "The user hears every fork once". What did
hold: no partial session used `--resolves`, none moved the item (in_progress refused, above), and
U2-rest, the fresh session that brought the rest, wrote one `--resolves` row listing all three answers,
including the one that lived only in the note (Probe A). Head also stopped and asked in 3/3, where
BASE-U1-partial went on to `specifying` and launched `mstack:spec-author` with fork 2 still open
(legal by `src/lifecycle.ts:40-55`), so the note is an improvement on that axis.

**What would make it pass.** The note carries both halves of the placement rule. For example, in
`intake.md:36-39`, after the ONE-row command: "a partial answer is a plain `decide --phase intake` row
with no `--resolves`, then `mstack state set <slug> --decision-required "<only the open forks>"`".
Then two or more fresh partial-answer sessions on the final text show a plain row and the field
re-stated; `node $R/bin/drive.mjs <name> <project> reuse $R/prompts/U1-partial.txt` on a parked copy
reruns one in under a minute. If the intent is instead "hold a partial answer in `current.md` and
write one row at the end", that changes `intake.md:42-44` and is the user's call, not a prose fix.

## Non-blocking

**N-1. An item that skips intake still gets a guessed status (run S, n=1).** An item seeded with
`state add` and no seams, prompt `/mstack work on list-total`. The router skipped intake ("Existing
item names it, so `skip: intake, request names existing item list-total`"), so End was never read, and
the coordinator ran `mstack state set list-total --status active --seam ...`, got
`mstack: 'active' is not a status`, then ran `--status in_progress`. Criterion 8 is scoped to "after
intake's state add", and the design row put the line in intake on purpose, so this is outside it. But
`setup` seeds items with no seams (`skills/setup/SKILL.md:35-37`), and the test-first review's E2 made
the same guess on a seeded item, so the one-place design misses the other way in. One clause on the
skip path of router step 3 ("a request that names an existing `pending` item: move it as intake's End
says") would cover it.

**N-2. An item put `in_progress` by intake cannot later take the spec path.** End (`intake.md:58-59`)
says "`--status specifying` on the spec path (an `sdd` item, or answered forks)". The router's spec
path has two more triggers, "the change crosses several subsystems, or the user will step away"
(`skills/router/SKILL.md:57-62`, also `skills/spec/SKILL.md:8-10`), and the first is often learned in
the playbook's understand step, after End has run. The lifecycle has no way back:

```
$ mstack state add --slug multi --title "crosses subsystems" --acceptance "it works across cli, service and storage" --seam "CLI: x"
added 8 multi (pending)
$ mstack state set multi --status in_progress
8 multi (in_progress)
  status: "pending" -> "in_progress"
$ mstack state set multi --status specifying
mstack: in_progress -> specifying is not a legal transition
        pass --force if you mean to skip a phase, and say why in decisions.tsv
[exit 2]
$ mstack state set multi --status spec_ready
mstack: in_progress -> spec_ready is not a legal transition
[exit 2]
```

The design row's `if wrong:` ("an item is in_progress while its playbook is still at understand and
design, which the lifecycle already allows") does not cover this. No run hit it. Pointing End's
parenthetical at "The two paths" instead of naming two of its four triggers, and saying what to do
when understand finds a multi-subsystem change (`blocked` then `specifying`, or `--force` with a
row), would close it.

**N-3. The fork test is still stated in other words outside the three places criterion 3 names.**
`agents/implementer.md:75-76`, `agents/reviewer.md:124-125`, `agents/spec-author.md:68-69`,
`agents/spec-reviewer.md:59-60`, `agents/orchestrator.md:66-67` ("Stop for authorization on ... product
decisions with different user-visible outcomes"), `agents/orchestrator.md:49`,
`skills/spec/SKILL.md:36-37` ("Bring the human only the forks the repository genuinely cannot settle:
product choices with different user-visible outcomes. Those go in `decision_required`") and
`skills/spec/references/templates.md:22`. By those, a message or label that follows the project is
"user-visible", so a fork; by the Map (`intake.md:18`) it is a reversible decision. The Map row, the
`if wrong:` test and the Autonomy clause agree, which is what criterion 3 asks, so this is not a block.
But forks are also found on the spec path, and the spec author reads `spec/SKILL.md`, not the Map.
Pointing these at the Map would finish round 3's N-4.

**N-4. "fails the fork test above, this is a fork" reads backwards** (`intake.md:28`). Failing a test
for being a fork would mean it is not one; "meets the fork test" says what is meant. No run misread it.

**N-5. README still carries both statements criterion 6 fixed in the wiki.** `README.md:220-221`: "a
question whose two answers produce different work"; `README.md:226`: "Forks are usually found while
`specifying`, which is after intake". Criterion 6 names CHANGELOG and the two wiki lines only.

**N-6. Lint inputs that pass (Probe B).** A header with both commits removed, or with repository and
path removed and the licences kept, passes; so do the intake link kept only in an HTML comment in the
orient section, an emptied licence file, `licenses/.` in a header, and a newly derived skill not listed
in `ORIGIN_REQUIRED` (by design, `src/lint.ts:417-422`). The commit and path survivors matter most:
item 55's criterion 5 asked for "repository, path, commit" in the header, and nothing pins them.
Criterion 5 here asks only for the removals, and all of them fail.

**N-7. Code mutants that survive (Probe B).** CM6 (a bare path accepted), CM7 (an absent router failing in words that do not say `intake`), CM13 (skills keyed by directory) and CM14 (only `ORIGIN_REQUIRED` files scanned) survive both halves. CM14 is the one that matters: the "every origin header names a licence that ships" half of the rule is then pinned only for the two listed files. The other ten are killed by the new tests.

**N-8. Over-parking at the margin, in the implementer's streams, never an extra stop.**
`impl73/streams/c-answered-1.jsonl` fork 3 ("use the existing rounding (apply_percent_discount: ...)?
Recommended: yes") is a convention the project already follows, so a fact. `c-direct.jsonl` fork 2
proposes changing that rounding, a fork only because the agent proposed the change. `b-3.jsonl` fork 5
(`waitlist list` in or out of scope) is scope. Each sat in a round that had a real fork, so the user
was asked once either way. In my runs U1's fork 2 ("bookings already stored keep their old totals?")
is borderline; I rule it a fork (stored charges, and "every stay" does not settle past stays), and the
base text parked it too (BASE-U1).

**N-9. Criterion 7's arithmetic is right; the labels are loose.** The answered arm's second session
emitted five result events, one per background-agent notification; the report's 316 s and 22 turns are
their sums, and its 1.790 USD is the last event's cumulative cost. The decision row says 687 s and the
report 686 s (686.6 s). "Wall time" is the sum of `duration_ms`, not wall-clock.

**N-10. Outside this item, seen again.** O1's first `state add` refused an `--acceptance` value that
starts with `--` (item 74). Coordinators tried `state show` (item 74). Every run wrote the playbook
into `current.md` rather than a todo list (round 3 N-8). Briefs ask for `Co-Authored-By` trailers in
the sandbox (item 35). `bug-fix.md:11-15` has the coordinator write the failing test and then delegate
the fix, while the preloaded test-first skill tells the implementer the test comes first; its "When it
does not apply" does not mention a test the brief supplies. Pre-existing.

**N-11. "`--seam "..."`, repeated, because it replaces the list"** (`feature.md:18-19`) means the flag
repeated in one call. Read as "run it repeatedly", each call drops the last seam (CLI below, Probe C).
S read it right. "one call, one `--seam` per seam" would not need reading twice.

## Probe A: the intake rewrite against item 55, live

**Wrapper** (`$R/bin/drive.mjs`). Per run, unless it reuses a parked project: a fresh copy of
`/Users/romerma/Code/mstack/sandbox/bench/template` in `$R/projects/<name>`, `git init` and a commit,
this checkout's `bin/mstack setup` under the clean environment, `state.verify` set to `python3 -m
unittest discover -s tests` as `sandbox/bench/run.mjs` does, committed. The environment is built from
scratch from the names `HOME USER LOGNAME TERM LANG TMPDIR SHELL PATH`, with
`PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$HOME/.bun/bin:<dir of claude>`; no
`ANTHROPIC_*` variable. The command is `claude -p "<prompt>" --model opus --output-format stream-json
--verbose --setting-sources project --strict-mcp-config --max-budget-usd 6 --plugin-dir
/Users/romerma/Code/mstack --permission-mode auto`, spawned as its own process group, stdout to
`$R/streams/<name>.jsonl` (outside every project). The driver kills the group at 600 s, or a set grace
after a top-level `mstack:implementer` launch or a stop pattern. Every init event:
`model=claude-opus-5-5 perm=auto cc=2.1.326 plugins=[{"name":"mstack","path":"/Users/romerma/Code/mstack","source":"mstack@inline","version":"0.2.1"}, ...]`.
Each prompt is `/mstack <request>` and nothing else. The base comparison runs pass
`--plugin-dir $R/base-plugin` (`git archive 07646f6`, `.mstack/` excluded; the template is unchanged
since base: `git diff --quiet 07646f6 fa54dd2 -- sandbox/bench/template`).

| Run | Kind | Prompt (after `/mstack `) | What happened | End | Cost, time |
|---|---|---|---|---|---|
| U1 | under | `add a $25 cleaning fee to every stay. quote and book should both include it in the total they print.` (item 55 round 2's failing request, unmodified) | 2 reversible rows (fee inside `pricing.quote`; single printed total), 2 forks parked, numbered, recommended, slug named, note in `current.md` | ended itself, `pending` | 0.256 USD, 42 s, 6 turns |
| U2 | under | `add a maximum stay length so nobody can book a room for too long.` | 2 reversible rows (refusal exits 1 like every other `BookingError`; constant in domain), 3 forks parked (the maximum, same for every room, does `quote` refuse too) | ended itself, `pending` | 0.228 USD, 37 s, 6 turns |
| O1 | over | `add a --guest option to the list command. It shows only the bookings whose guest name is exactly the given text (case-sensitive), in the format list already prints, and it combines with --room so both filters apply. When nothing matches it prints nothing and exits 0.` | "Intake: new work, no forks"; 1 reversible row; `state add` then `state set --status in_progress`; branch; `mstack:implementer` launched | killed 20 s after the launch, 64 s | - |
| O2 | over | `quote should refuse a --discount-percent below 0 or above 100: print "error: discount must be between 0 and 100" to stderr and exit 1, the way it already reports other errors. 0 and 100 themselves are allowed, and book is unchanged.` | 3 reversible rows (check in `pricing.quote`; NaN refused with the same message; check runs after the existing ones, "only which message prints differs"), no fork, `in_progress`, implementer launched | killed, 63 s | - |
| S | seeded, no seams | `work on list-total` | `skip: intake`; read `state.json`; `--status active` refused; `state set --status in_progress --seam ... --seam ...`; implementer launched | killed, 55 s | - |
| U2-partial, U1-partial, U1b-partial | partial answers | see B-1 | see B-1 | ended themselves, `pending` | 0.133 / 0.162 / 0.208 USD |
| U2F-full | full answer, copy of U2's parked state | `max-stay-length: 1 no, make the maximum 14 nights. yes to 2. 3 no, quote should refuse a stay that is too long as well.` | one `--resolves` row listing all three answers, first try; `state set --status specifying` with the acceptance and seams rewritten to the answers; design row; `mstack:spec-author` launched | killed 30 s after the pattern, 69 s | - |
| U2-rest | the rest, after U2-partial | `max-stay-length: yes to 2 and yes to 3.` | one `--resolves` row listing all three (fork 1's answer taken from the note); `specifying`; spec-author launched | killed, 55 s | - |
| U1c-close | close with a parked fork, copy of U1b | `I am stopping for today. Close the session.` | appended `history.md`; `current.md` byte-identical before and after | ended itself | 0.145 USD, 21 s |
| BASE-U1, BASE-U1-partial, BASE-U1b-partial | base text | as U1, U1-partial, U1b-partial | same 2 forks parked; partials: see B-1 | | 0.228 USD (BASE-U1) |

Excerpts (`node $R/bin/summ.mjs $R/streams/<name>.jsonl`):

```
U1  TOOL Bash | mstack decide --phase intake --decision "Fee is a CLEANING_FEE_CENTS = 2500 constant in bookings/domain/pricing.py, added inside pricing.quote so BookingService.quote and .book both pick it up" ... --result "if wrong: fee moves to another module; no change to what is charged" &&
            mstack decide --phase intake --decision "CLI output keeps its current shape: one total in format_cents, fee folded in, not itemized" ... --result "if wrong: a label/format change in cli.py only" &&
            mstack state add --slug cleaning-fee ... --seam "domain: bookings.domain.pricing.quote return value in cents" --seam "app: ..." --seam "CLI: python3 -m bookings quote / book stdout total" \
              --decision-required "1) Should the --discount-percent discount apply to the room subtotal only, with the \$25 fee added after it at full price? Recommended: yes, ... 2) Should bookings already stored in the JSON file keep their old totals (no backfill), ...? Recommended: yes, ..."
      RESULT> recorded / recorded / added 1 cleaning-fee (pending)
    FINAL> ... **Two questions for you on `cleaning-fee`.** Both change what a guest pays or what's in the saved booking file, so they're your call: 1. **Discount:** ... I'd say **yes**. ... 2. **Existing bookings:** ... I'd say **yes**. ... Please reply in the form `cleaning-fee: yes to 1, yes to 2` (or give different answers).
U2  --decision-required "1) Should the maximum be 30 nights (30 accepted, 31 refused)? Recommended: yes, ... 2) Should the same maximum apply to every room type (standard, deluxe, suite)? Recommended: yes, ... 3) Should 'quote' keep pricing long stays instead of refusing them? Recommended: yes, ..."
    current.md Next step: "Waiting on the user to answer the 3 forks on `max-stay-length` ... Record every answer in ONE row: `mstack decide --phase intake --resolves max-stay-length --decision \"1) ... 2) ... 3) ...\" --why .. --evidence \"<their words>\" --result \"<chosen>\"`. Then the item is on the spec path: `mstack state set max-stay-length --status specifying`, ..."
O1  TEXT> Intake: new work, no forks (the request fixes match semantics, output format, combination and exit code). One reversible decision to record.
    RESULT> added 1 list-guest-filter (pending) / 1 list-guest-filter (in_progress) /   status: "pending" -> "in_progress" / list-guest-filter
    TOOL Agent | mstack:implementer | ... Seams (pre-agreed, do not ask to confirm): ... Test-first: write the first test, run it red for the expected reason and paste the output into your report, before any production code. Then the rest one slice at a time.
O2  RESULT> recorded / recorded / recorded / added 1 quote-discount-range (pending) / 1 quote-discount-range (in_progress) / Switched to a new branch 'feat/quote-discount-range'
    TOOL Agent | mstack:implementer | ... Pre-agreed seams (no need to confirm): ... Test-first: write the first test, run it red for the expected reason, paste the output in your report, then implement; add remaining tests a slice at a time.
S   TEXT> Existing item names it, so `skip: intake, request names existing item list-total`.
    TOOL Bash | cat .mstack/state.json; cat bookings/cli.py; cat tests/test_adapters_cli.py; cat /Users/romerma/Code/mstack/skills/router/playbooks/feature.md
    RESULT> Switched to a new branch 'feat/list-total' / mstack: 'active' is not a status / one of: pending, specifying, ...
    RESULT> 1 list-total (in_progress) /   status: "pending" -> "in_progress" /   seams: 0 seam(s) replaced with 2 / + added "cli.main(argv, ..." / + added "real surface: python3 -m bookings --db <tmp>...."
    TOOL Agent | mstack:implementer | ... Seams (pre-agreed): ... Test-first: write the first test only (e.g. empty list prints exactly `0 bookings`), run it red for the expected reason and paste the output into your report, before writing code. Then add slices one at a time: ...
U2F TOOL Bash | mstack decide --phase intake --resolves max-stay-length --decision "1) maximum is 14 nights (14 accepted, 15 refused) 2) same maximum for every room type 3) quote also refuses an over-long stay" --why "user answered the parked forks; overrides recommendations 1 and 3" --evidence "user: 'max-stay-length: 1 no, make the maximum 14 nights. yes to 2. 3 no, ...'" --result "14-night cap, all rooms, enforced in book and quote"
      RESULT> recorded, and max-stay-length no longer has an open fork
    RESULT> 1 max-stay-length (specifying) /   status: "pending" -> "specifying" /   acceptance: 3 criterion(s) replaced with 4 ...
U2-rest TOOL Bash | mstack decide --phase intake --resolves max-stay-length --decision "1) Maximum is 30 nights: 30 accepted, 31 refused. 2) The same maximum applies to every room type (standard, deluxe, suite). 3) quote keeps pricing stays longer than 30 nights; only book refuses them." ... --evidence "User, 2026-11-17: 'yes to 1, a 30-night maximum' then 'yes to 2 and yes to 3'" ... && mstack state set max-stay-length --status specifying
      RESULT> recorded, and max-stay-length no longer has an open fork
U1c history.md: "- Next step and the spec concerns ... are in `current.md`, which was kept rather than reset because it holds the parked fork."
```

Who read `intake.md`, and how the rule arrived (tool inputs searched for `intake.md`; SessionStart
`hook_response` searched for "Last recorded checkpoint"):

```
U1, U2, O1, O2      intake.md read once (new work), hook printed no checkpoint (empty template)
S                   intake.md read 0, hook printed no checkpoint; wrong status guesses 1 (--status active)
U2-partial, U1-partial, U1b-partial, U2F-full, U2-rest     intake.md read 0, hook printed the note: yes
BASE-U1-partial     intake.md read 0 (grepped the plugin for "resolves"); BASE-U1b-partial: read 2 (sed -n 40,48p)
```

**Findings.** Under-parking, n=2: every open choice that changes what the user gets was parked, asked
once with a recommendation and the slug, the item stayed `pending`, the note is in `current.md`. No
user-visible choice was taken for the user; the rows taken are internal or follow what the project
prints. Over-parking, n=2: no fork parked, `in_progress` with no wrong status name, the run carried on
to the implementer. The implementer's two-to-five-fork runs were not fully specified requests (N-8).
Full answer in a fresh session, n=1 (U2F) plus the rest-after-partial, n=1 (U2-rest): one row listing
every answer, `--resolves` on it, `specifying` as End says for the spec path, no `intake.md` read, the
rule delivered by the note. Partial answer: B-1. Criteria 8 and 9 past intake, n=3 (O1, O2, S): the
brief names the seams as pre-agreed and asks for the first test red. O1 and O2 took the seams from
their own `state add` a few seconds earlier, not from `state.json` (as the implementer's a-3); S read
`state.json`, found none and ran the no-seams branch, `state set --seam` with two seams in one call,
before delegating.

## Probe B: the lint rules, in `$R/clone` at `fa54dd2`

`node $R/bin/treecases.mjs` applies each case to the clone, runs that clone's `./bin/mstack
lint-plugin .`, prints the failures, and restores (`git checkout -- . && git clean -fdq`). Full output
in `$R/treecases.txt`.

```
### N1 router intake step (step 3) removed
  exit 1: FAILED - 1 failure, 0 warnings
  [fail]  skills/router/SKILL.md: the orient steps do not link references/intake.md
### N2 origin header of intake.md removed
  exit 1: FAILED - 1 failure, 0 warnings
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
### N5 implementer skills block list names test-frist
  [fail]  agents/implementer.md: skills entry 'test-frist' names no skill under skills/
### N6 test-first gets disable-model-invocation: true
  [fail]  agents/implementer.md: skills entry 'test-first' has disable-model-invocation: true, so it is not preloaded
### F1 intake header names a licence file that does not exist
  [fail]  skills/router/references/intake.md: origin header names licenses/obra-LICENSE.txt, which does not exist
### F2 intake header with both commits removed                              exit 0: PASSED
### F2b intake header with repository and path removed, licences kept     exit 0: PASSED
### F3 step 3 removed, intake link kept only in an HTML comment in orient  exit 0: PASSED
### F3b step 3 removed, link moved under ## Route
  [fail]  skills/router/SKILL.md: the orient steps do not link references/intake.md
### F3c step 3 replaced by a bare path, no markdown link
  [fail]  skills/router/SKILL.md: the orient steps do not link references/intake.md
### F3d orient heading renamed
  [fail]  skills/router/SKILL.md: the orient steps do not link references/intake.md
### F4 implementer skills inline [test-frist]
  [fail]  agents/implementer.md: skills entry 'test-frist' names no skill under skills/
### F4b implementer skills scalar test-frist
  [fail]  agents/implementer.md: skills entry 'test-frist' names no skill under skills/
### F4c implementer skills block list, two entries, second misspelt
  [fail]  agents/implementer.md: skills entry 'reviw' names no skill under skills/
### F5 implementer skills mstack:test-first (must pass)                    exit 0: PASSED
### F5b implementer skills mstack:test-frist
  [fail]  agents/implementer.md: skills entry 'mstack:test-frist' names no skill under skills/
  [fail]  mstack:test-frist is referenced in agents/implementer.md but no such skill or agent exists
### F5c implementer skills other-plugin:anything (must pass)              exit 0: PASSED
### F6 implementer with no skills field (must pass)                        exit 0: PASSED
### F7 skill directory without SKILL.md, named by the agent
  [fail]  agents/implementer.md: skills entry 'ghost' names no skill under skills/
### F7b skill directory without SKILL.md, named by nobody (must pass)      exit 0: PASSED
### F8 disable-model-invocation: "true" (quoted)
  [fail]  agents/implementer.md: skills entry 'test-first' has disable-model-invocation: true, so it is not preloaded
### F9 intake.md deleted outright
  [fail]  skills/router/SKILL.md: broken link to references/intake.md (x2)
  [fail]  skills/router/playbooks/orchestrate.md: broken link to ../references/intake.md
### F10 licence file emptied                                               exit 0: PASSED
### F11 header names licenses/. (a directory)                              exit 0: PASSED
### F12 new derived skill with no header (not in ORIGIN_REQUIRED)          exit 0: PASSED
### F13 skill entry naming the router by directory (router)
  [fail]  agents/implementer.md: skills entry 'router' names no skill under skills/
### F14 skill entry naming the router by name (mstack), which has disable-model-invocation
  [fail]  agents/implementer.md: skills entry 'mstack' has disable-model-invocation: true, so it is not preloaded
```

Every named removal fails with a message naming the cause; every must-pass input passes. Survivors are
in N-6. F13 is a judgement the rule makes: it resolves an entry by the skill's declared name, so the
router is `mstack`, not `router`; nobody preloads the router, so I leave it.

Trees that were green stay green. Each tree under base's and head's `lint-plugin`:

```
base mstack (this repo at head):           PASSED - 0 failures, 0 warnings
head mstack (this repo at head):           PASSED - 0 failures, 0 warnings
head lint on the 07646f6 tree ($R/basetree): PASSED - 0 failures, 0 warnings   ([ok] 2 origin header(s) ...; [ok] the router's orient steps link references/intake.md)
base/head examples/notes-cli:              FAILED - 1 failure, 4 warnings   ([fail] missing .claude-plugin/plugin.json, identical at base)
base/head setup-fresh consumer ($R/consumer): FAILED - 1 failure, 4 warnings (same single failure, identical at base)
base/head foreign plugin ($R/foreign: no router, no licenses/, no headers, agent skills: [hello]): PASSED - 0 failures, 2 warnings
```

Lint is not meant to pass on a consumer or on `examples/notes-cli` (neither is a plugin), and the new
rules add nothing to those reports. `examples/` holds only `notes-cli`.

**Code mutants**, `node $R/bin/codemut.mjs` in two clones: each `src/lint.ts` mutant applied, `bun test
./tests` and the node half (`node --disable-warning=ExperimentalWarning --experimental-strip-types
--test 'tests/*.test.ts'`) run in full, failing test names recorded, mutant reverted. Raw output in
`$R/codemut-clone.txt` and `$R/codemut-clone2.txt`.

| # | Mutant of `src/lint.ts` | bun half | node half | Result | Matters? |
|---|---|---|---|---|---|
| CM1 | no-licence check dropped | 551/1: "an origin header that names no licence file is caught" | same | killed | |
| CM2 | licence existence check dropped | 551/1: "an origin header that names a licence file the plugin does not ship is caught" | same | killed | |
| CM3 | `ORIGIN_REQUIRED` keeps only intake.md | 551/1: "a file that must carry an origin header and does not is caught" | same | killed | |
| CM4 | a missing header never fails | 550/2: the same test, plus `run.test.ts:54` (load, below) | 550/2: the same, plus `costs.test.ts:698` (load) | killed | |
| CM5 | router rule reads the whole file | 551/1: "a router whose orient steps no longer link intake.md is caught" | same | killed | |
| CM6 | router rule accepts a bare path, not a link | 552/0 | 551/1: `costs.test.ts:698` only (load) | **survives** | little: a bare `references/intake.md` mention left in orient would pass (F3c fails today only because of the link syntax) |
| CM7 | an absent router fails, with the text "no router" | 552/0 | 551/1: load only | **survives** | little: "a plugin with no router is not held to the router rule" asserts only that no failure mentions `intake`, so a failure in other words passes it |
| CM8 | hidden skill not reported | 551/1: "an agent that preloads a skill with disable-model-invocation: true is caught" | same | killed | |
| CM9 | own-plugin prefix not stripped | 550/2: "a skills entry namespaced to this plugin is resolved, so a misspelt one is caught" + load | same + load | killed | |
| CM10 | other plugins' entries not skipped | 551/1: "a skills entry that resolves, or that names another plugin's skill, passes" | same | killed | |
| CM11 | `disable-model-invocation` compared to `"true"` | 551/1: the hidden-skill test | 550/2: same + load | killed | |
| CM12 | skills rule not called | 549/3: the three skills tests | 548/4: same + load | killed | |
| CM13 | shipped skills keyed by directory, not declared name | 552/0 | 551/1: load only | **survives** | little: only the router's name differs from its directory, and nothing preloads it |
| CM14 | only `ORIGIN_REQUIRED` files scanned for headers | 552/0 | 552/0 | **survives** | some: today only the two listed files carry headers, so nothing changes, but "every origin header names a licence that ships" is unpinned for any other derived file |

The load failures are `tests/costs.test.ts:698` ("hook paths stay within budget on a 50 MB
transcript") and `tests/run.test.ts:54` ("tail keeps the last lines of stdout and stderr, and the temp
file is removed", which compares two listings of the shared temp directory). They came from running
two suites at once, appeared on mutants that touch nothing those tests reach, and both files pass
serially on head: `bun test tests/costs.test.ts tests/run.test.ts` 48 pass 0 fail, node half 48 pass
0 fail. No kill above rests on them. The implementer's own 13 (`impl73/mutants.txt`) overlap with
CM1-CM5, CM8-CM12; CM6, CM7 (as worded), CM13 and CM14 are new.

## Probe C: the prose as executed

Read as the coordinator and the implementer that follow them: `skills/router/SKILL.md` (157 lines,
was 156), `references/intake.md` (77, was 77), `playbooks/feature.md` (32), `skills/test-first/SKILL.md`
(60 by `wc -l`, was 61; `lint-plugin` counts 61). No added line carries an em or en dash
(`git diff 07646f6..fa54dd2 -- . ':!.mstack' | rg -c '^\+.*(\x{2014}|\x{2013})'` prints nothing).

- **The fork test, once (criterion 3).** Stated in the Map's Fork row (`intake.md:17`) with its
  complement in the Reversible row (`:18`), classified "by the first row that fits" in the order
  fact, fork, reversible (`:10-18`). The `if wrong:` test (`:27-28`) and the Autonomy clause
  (`SKILL.md:94-96`) point at it. Labels, message text and exit codes: an exit code a script would
  branch on is a fork, a message, label or format that follows what the project prints is
  reversible; the three places now agree. "A cheap code change makes neither one reversible" is its
  own sentence, so it qualifies both clauses. Outside the three: N-3. Wording: N-4. Live, the reach
  held at the margin: U2's "refusal exits 1 like every other refusal" and O2's "check order: only which
  message prints differs" were taken as rows, correctly by the new reach.
- **Step 2 (criterion 4).** `SKILL.md:18-20` reads `current.md` unconditionally; the parenthesis is true
  (`src/hooks.ts:128-131` prints it unless `isEmptyTemplate`). The skip list (`:22-24`) names
  "answering a parked fork". Live: all five answering sessions skipped intake and resumed from the note.
- **Closing (criterion 2).** `SKILL.md:153-155`, "unless it records a parked fork". Live, n=1: U1c-close.
- **End, on the real CLI** (`intake.md:58-59` against `src/lifecycle.ts:85-89` and the gate), scratch
  store `$R/cli`:

```
direct  $ mstack state set direct --status in_progress   -> 1 direct (in_progress)             [exit 0]
sdd     $ mstack state set spec --status specifying      -> 2 spec (specifying)                [exit 0]
        (the other way) $ mstack state set sdd2 --status in_progress -> [exit 0], then gate:
        [fail]  sdd item sdd2 is in_progress but has no spec at .../.mstack/specs/sdd2 -> run '/mstack:spec' or move the item back to specifying
open    $ mstack state set fork --status in_progress     -> mstack: fork has an unanswered decision: "1) Q? ... 2) R? ..."   [exit 2]
partial $ mstack decide --phase intake --decision "1) yes" ... -> recorded
        $ mstack state set fork --decision-required "2) R? Recommended: yes." -> decision_required: "1) Q? ..." -> "2) R? ..."
        $ mstack state set fork --status in_progress     -> mstack: fork has an unanswered decision: "2) R? Recommended: yes."  [exit 2]
answered $ mstack decide --phase intake --resolves fork4 --decision "1) yes, Q is done the recommended way" ... -> recorded, and fork4 no longer has an open fork
        $ mstack state set fork2 --status specifying     -> 4 fork2 (specifying)  [exit 0]; gate --quiet [exit 0]
        $ mstack state set fork4 --status in_progress    -> 7 fork4 (in_progress) [exit 0]; gate --quiet [exit 0]
```

  The line is true on both paths, and a parked item cannot leave `pending` for building (it can go to
  `specifying` with the fork open, which the lifecycle allows by design). Its parenthetical is narrower
  than the router's spec path: N-2.
- **`feature.md` step 4 (criterion 9).** `:15-22` names the `seams` array in `.mstack/state.json` and
  why not `state active`; gives an item with behaviour and no seams `state set <slug> --seam` before
  delegation; keeps `skip: no behaviour` for a change with none; asks for "the first test only, run
  red ... the rest follow one slice at a time". `state set --seam` replaces the list (CLI, `$R/cli`):

```
$ mstack state set seams --seam "CLI: list stdout"               ->  seams: 0 seam(s) replaced with 1
$ mstack state set seams --seam "Service: list() return value"   ->  seams: 1 seam(s) replaced with 1 / - dropped "CLI: list stdout"
$ mstack state set seams --seam "CLI: list stdout" --seam "Service: list() return value"  ->  seams: 1 seam(s) replaced with 2
$ mstack state active                                            ->  no active item [exit 1]
```

- **test-first (criterion 10).** The mutants sentence is gone (`:50-54`); `:48` reads "beyond what the
  test or the brief asks for"; `:56-60` exempt "a refactor the brief asks for that is pinned by
  characterization tests". This matches `refactor.md:5-7` (characterization tests committed first) and
  `:13` (delegate the mechanical work). 60 lines.
- **Against the neighbours.** `principles.md:73-74` (fork round is the router's Autonomy exception):
  consistent. `orchestrate.md:14-15` cites intake for how fields are derived; End's `in_progress`
  applied to every orchestrate item would break one-active-item, and End does not say it is for the one
  item intake made (folded into N-2). `agents/implementer.md:32-34` (seams from the brief, else the
  item's `seams` field): consistent. `agents/implementer.md:75-76`: N-3. `bug-fix.md:11-15`: N-10.

## Probe D: docs against the final text (criteria 6, 12)

- `CHANGELOG.md:5-23`: each clause checked against the text and Probe B: the Map statement and reach,
  the pointers, the note carrying the `--resolves` rule ("one `decide` row listing every answer", which
  is the half B-1 is about), step 2, the skip list, Closing, End's two statuses, the feature step, the
  test-first changes, and the four lint failures (all reproduced in Probe B). True as written.
- `docs/wiki/The-CLI.md:258-261`: "Intake parks the forks it finds when it adds the item, with `state
  add --decision-required`. A fork can also turn up later, usually while `specifying`". True.
- `docs/wiki/How-A-Work-Item-Flows.md:113-117`: the fork defined by the Map's reach, parked at `state add`
  numbered with a recommended answer, a reversible choice recorded instead. True. (`:119` is now a
  136-character line.)
- `docs/wiki/Skills-and-Playbooks.md:7-8`: "all fourteen skills (thirteen commands and one internal
  reference)". `fd -t f '^SKILL.md$' skills | wc -l` = 14; only `skills/test-first/SKILL.md` carries
  `user-invocable: false`; the page introduces the router and 12 commands in its table (`:26-42`) and
  test-first at `:21-24`. True. `README.md`: N-5.
- `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`: "96 relative links checked, 0 broken".

## Probe E: criterion 7's measurement

From the result events in `impl73/streams/` (`$R/bin` script, last event per session, and every event
for `c2-answered-2`, which has five):

```
c2-answered-1  RESULT cost 0.2457872 duration_ms 38959  turns 6   launches 0
c2-answered-2  RESULT cost 1.7904408 duration_ms 257224 turns 12 | 10635 t2 | 15736 t3 | 9653 t2 | 23038 t3   launches mstack:spec-author, mstack:spec-reviewer, SendMessage x4
c2-answered-3  RESULT cost 1.4004132 duration_ms 331312 turns 13  launches mstack:implementer, mstack:reviewer
c2-direct-2    RESULT cost 1.1251448 duration_ms 296070 turns 15  launches mstack:implementer, mstack:reviewer
```

Answered arm: 0.2458 + 1.7904 + 1.4004 = 3.437 USD; 39.0 + 316.3 + 331.3 = 686.6 s; 6 + 22 + 13 = 41 turns;
4 launches. Direct arm: 1.125 USD, 296 s, 15 turns, 2 launches. The claim holds (N-9 for the labels).
Same request in substance: the answered arm parked "1) ... --discount-percent apply only to the room
nights and leave the $25 cleaning fee undiscounted? 2) ... bookings already stored keep their saved
totals ...?" and got `cleaning-fee: yes to 1, yes to 2`; the direct arm's stream carries both answers
in the request ("bookings already saved keep the totals they have"). The worktree stop is disclosed
(report section 5c, "Caveats"): session 2 ends at `spec_ready` with "I couldn't create the separate
working copy for the change. The setup step expects a remote `origin/main`", and session 3 is the
nudge. How much it explains: session 3 did the same work the whole direct arm did (implement, review)
for 1.400 against 1.125 USD; charging even that whole 0.275 USD and the 35 s to the stop leaves the
answered arm at about 3.16 USD and 650 s, 2.8x and 2.2x. The spec phase (1.79 USD) is the difference.
Nothing shipped narrows the rule: `SKILL.md:60-61` still lists `decision_required` as a spec-path
trigger, `intake.md:40` "an item with a fork is on the spec path", `intake.md:59` "answered forks"
go to `specifying`. The recommendation is recorded, not taken (decision row 148).

## Probe F: regression on the head

With no live run going (`pgrep -fl 'claude -p'` empty), in the working tree at `fa54dd2`:

```
$ npm test
 552 pass
 0 fail
Ran 552 tests across 26 files. [88.76s]
ℹ tests 552
ℹ pass 552
ℹ fail 0
npm test exit 0
$ bun run typecheck
$ bunx --bun tsc --noEmit
typecheck exit 0
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full
...
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
(exit 0; inside it: " 552 pass", " 0 fail", "Ran 552 tests across 26 files. [89.58s]", "ℹ tests 552", "ℹ pass 552", "ℹ fail 0")
$ ./bin/mstack ledger check intake-followups
FAIL no verdict at fa54dd2e; 1 row(s) exist at other SHAs and a new head SHA voids them
```

The load-sensitive tests passed in both serial runs. Under my two parallel mutant suites
`tests/costs.test.ts:698` and `tests/run.test.ts:54` failed on some mutants; rerun serially on head,
both files pass in both runtimes (Probe B). The ledger row at another SHA is the implementer's; this review records
the first verdict at `fa54dd2`.

## Requirement to test

| Criterion | Test or run that would fail if it were reverted |
|---|---|
| 5, 11 (lint) | `tests/lint.test.ts:248-370`, ten new tests; each was red before its rule (implementer's red outputs) and mutants CM1-CM5 and CM8-CM12 are killed by them, CM6, CM7, CM13, CM14 are not (Probe B). Removing `licenses/mattpocock-skills-LICENSE.txt` has no test of its own; the same code path is pinned by the obra test (CM2) and N3 fails on the tree. |
| 1, 2, 3, 4, 8, 9, 10 (prose) | No test; the runs in Probe A are the evidence, as intended for prose (seam: "skills/router/SKILL.md and references/intake.md as read by a headless claude -p run"). |
| 6, 7, 12 | Docs and a measurement: read and recomputed (Probes D, E). |

No existing test was weakened: the only change to an existing line in `tests/lint.test.ts` is `copy()`
also copying `licenses/` (`:16`), which the new origin rule needs for the clean tree to pass.

## Acceptance, quoted

| # | Criterion | Met | Evidence | Rung |
|---|---|---|---|---|
| 1 | "a session that answers a parked fork has the --resolves placement rule in context: the current.md note carries it or router step 2 points at intake.md's Park a fork section, and a fresh headless session with a full answer to three forks writes one row that lists all three" | **Not met** (first clause half met) | The note carries the full-answer half only (`intake.md:36-39` vs `:42-44`); partial answers on head 0/3 re-state the field, 2/3 write a row, base 3/3 both (B-1). Second clause met: U2F-full, three forks, one `--resolves` row listing all three, first try, `intake.md` not read; U2-rest the same after a partial. | 5 (n=1 full, n=1 rest, n=3 partial head, n=2 partial base) |
| 2 | "Closing a session does not reset a current.md that records a parked fork" | Met | `SKILL.md:153-155`; U1c-close kept `current.md` byte-identical and said why in `history.md`. | 2 for the clause, 5 n=1 live |
| 3 | "the fork test is stated once and the Map row, the if-wrong test and the Autonomy clause agree on labels, message text and exit codes; 'however cheap the code change is' cannot be read as qualifying only the irreversible clause" | Met | `intake.md:17-18`, `:27-28`, `SKILL.md:94-96`; the cheap-change sentence stands alone. Other statements remain outside the three (N-3); wording N-4. | 2 (text), 5 for the reach on U1, U2, O1, O2 (n=4) |
| 4 | "router step 2 no longer needs current.md read to know whether to read it, and the skip list covers a parked item, which is pending" | Met | `SKILL.md:18-24`; `src/hooks.ts:128-131`; five answering sessions skipped intake and resumed. | 2 + 5 (n=5) |
| 5 | "lint-plugin fails when the router's intake step, the origin header of intake.md or either licence file is removed" | Met | Probe B N1-N4, each failing with the cause named; the same removals on copies of the 07646f6 tree under base lint each print `PASSED - 0 failures, 0 warnings` (router step, intake header, mattpocock licence); CM1-CM5 killed, CM6 and CM7 survive (N-7). | 4 |
| 6 | "CHANGELOG.md, docs/wiki/The-CLI.md:258 and docs/wiki/How-A-Work-Item-Flows.md:113 describe forks as intake now defines and parks them" | Met | Probe D. README not updated (N-5). | 2 |
| 7 | "the cost of sending every item with an answered intake fork down the spec path is measured on one small request, and the rule is kept or narrowed with the decision recorded" | Met | Probe E: numbers recomputed from the result events, same request, the stop disclosed and bounded, rule kept, decision row 148. | 4 (recomputed from the streams; I did not rerun, as briefed) |
| 8 | "after intake's state add something moves the item to in_progress before work starts: intake's End or the playbook says so, and a headless /mstack run does it without guessing a status" | Met | `intake.md:58-59`; O1, O2 `in_progress` straight after `state add`, U2F-full and U2-rest `specifying` on the spec path, no wrong status name in any of the four; CLI true on both paths (Probe C). A seeded item that skipped intake still guessed (N-1, outside the criterion); End vs the spec path's other triggers (N-2). | 5 (n=2 direct, n=2 spec) + 4 (CLI) |
| 9 | "feature.md's test-first step names where the seams are read (the item's seams array in .mstack/state.json, or state show once item 74 adds it), says an item that changes behaviour but has no seams gets them with state set --seam before delegation, keeps 'skip: no behaviour' for changes with no behaviour, and asks for the first test run red, not all tests" | Met | `feature.md:15-22`; O1, O2, S briefs name the seams pre-agreed and ask for the first test red; S ran the no-seams branch live; `state set --seam` checked on the CLI. Wording N-11. | 5 (n=3; n=1 for the no-seams branch) + 4 (CLI) |
| 10 | "skills/test-first/SKILL.md drops the sentence about a reviewer's mutants and this repository's history, and says a refactor the brief asks for, pinned by characterization tests, writes no new test" | Met | `skills/test-first/SKILL.md:48`, `:50-54`, `:56-60`; 60 lines, not longer than 61. | 2 |
| 11 | "lint-plugin fails when an agent's skills entry names no skill under skills/ or names one with disable-model-invocation: true" | Met | Probe B N5, N6, F4-F8; CM8-CM12 killed, CM13 survives (N-7). | 4 |
| 12 | "docs/wiki/Skills-and-Playbooks.md counts the skills it introduces correctly" | Met | Probe D: 14 `SKILL.md`, one internal; the page says fourteen, thirteen commands and one internal reference. | 4 (counted by command) |

## Ledger

`./bin/mstack ledger record intake-followups fa54dd2e87437db2a868269a16fdef728d650556 verifier-failed
--evidence .mstack/progress/review_intake-followups.md --verifier reviewer`:

```
recorded verifier-failed for intake-followups at fa54dd2e
$ ./bin/mstack ledger check intake-followups
FAIL verifier-failed at fa54dd2e by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_intake-followups.md)
```
