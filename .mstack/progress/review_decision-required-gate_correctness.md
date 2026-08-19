# Review - decision-required-gate (correctness)

**Verdict:** CHANGES_REQUESTED

Commits `0402a42` and `f1506dc`. The gate is real — I could not walk an unanswered fork to
`done` through `state set` alone, and `--force` is caught exactly as the commit message promises.
But the *answer* it demands is not checked at all: the gate verifies that `decision_resolved`
names a row that exists, and nothing else. An empty row answers a fork, an unrelated row answers
a fork, and the `ts` used as the primary key is not unique. Findings 1-3 defeat the sentence the
commit is built on — "a boolean would let someone mark a fork answered without saying what the
answer was" — because all three reduce the pointer to exactly that boolean.

Nothing here is a reason to revert. Findings 1-3 are a day's work on the same file.

## Acceptance, quoted

**"The gate refuses to let an item with `decision_required` reach a status past `in_progress`
until the fork is answered"** - met, and stricter than asked. `DECISION_REQUIRED_FROM` is
`src/lifecycle.ts:49-55` and covers `spec_ready`, `in_progress`, `reviewing`, `verifying`, `done` —
the line is drawn past `specifying`, not past `in_progress`. Enforced in the gate at
`src/gate.ts:192` and refused up front at `src/cli.ts:244-254`. Verified: `state set fork-item
--status in_progress` and `--status spec_ready` both exit 2; `--status specifying` exits 0.
See finding 10 — the bullet's own wording no longer matches what shipped.

**"There is a recorded way to answer it that links the answer to the item, not a free-floating
decisions.tsv row"** - **NOT met.** `mstack decide --resolves` links the *item to the answer*
(`src/cli.ts:372`), but nothing links the answer to the item. `decisions.HEADER` is
`src/decisions.ts:10` — `ts, phase, decision, why, evidence, result` — no column names the item,
so a row written with `--resolves` is byte-for-byte indistinguishable from one written without
it, and `src/gate.ts:186` accepts *any* row's `ts` for *any* item. Free-floating is precisely
what the row is. Findings 2 and 3.

**"An unanswered fork is named in the failure, quoting the question"** - met.
`src/gate.ts:200` and `src/cli.ts:251` both interpolate `item.decision_required` inside literal
quotes, and `src/gate.ts:200` prefixes it with `itemLabel(item)`. Verified against the shipped
example project, output below.

**"Tests cover the refusal, the answer, and the fact that an item without the field is
unaffected"** - met, and the tests are load-bearing. Refusal: `tests/gate.test.ts:338` and
`tests/decisions.test.ts:106`. The answer: `tests/gate.test.ts:380` and
`tests/decisions.test.ts:25`. Unaffected: `tests/gate.test.ts:419`. Seven mutations, seven caught
(table below).

## Verification I ran

Baseline, on the repo as committed:

```
$ npm test           -> exit 0;  151 pass, 0 fail  (bun test, then node --test)
$ npm run typecheck  -> exit 0
$ ./bin/mstack lint-plugin .  -> exit 0;  PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate  -> exit 1;  [fail] 2 items are active in this worktree:
                        decision-required-gate (reviewing), statusline-argument-hardening
                        (in_progress)     <- the one-active-item rule, not this feature
```

**The gate holds against `--force`.** Sandbox, item carrying a fork, forced to `done`:

```
$ for s in in_progress reviewing verifying done; do mstack state set fork-item --status $s --force; done
1 fork-item (in_progress) ... 1 fork-item (done)      all exit=0
$ mstack gate ; echo "exit=$?"
[fail]  1 fork-item (done) is past specifying with its decision unanswered:
        "Stable public contract, or a dump we may change?"
[fail]  items marked done with no ledger verdict at all: fork-item
FAILED - 2 failures, 1 warning
exit=1
```

Exactly as the commit message claims. Two failures, two different facts, no double-reporting.

**The gate holds against a made-up pointer:**

```
$ # hand-edit state.json: decision_resolved = "I decided it myself"
$ mstack gate ; echo "exit=$?"
[fail]  1 fork-item (done) points at decision I decided it myself, which is not in decisions.tsv
exit=1
```

**The gate does not hold against a real pointer to an unrelated row** (finding 2):

```
$ mstack decide --decision "an unrelated decision about tabs vs spaces" --why taste --evidence none --result tabs
recorded
$ # hand-edit state.json: decision_resolved = that row's ts
$ mstack gate ; echo "exit=$?"
[ok]    1 item(s) with a decision fork, each answered or still in specifying
PASSED - 0 failures, 2 warnings
exit=0
```

**The gate does not hold against an empty answer** (finding 1), and this needs no hand-editing:

```
$ mstack decide --resolves ship --decision " " ; echo "exit=$?"
recorded, and ship no longer has an open fork
exit=0
$ cat .mstack/decisions.tsv
ts	phase	decision	why	evidence	result
2026-08-19T18:54:52.812Z					open
$ for s in in_progress reviewing verifying done; do mstack state set ship --status $s; done   # all exit=0
$ mstack gate
[ok]    2 item(s) with a decision fork, each answered or still in specifying
```

The row that answers the product fork is a timestamp and the word `open`.

**`ts` collides under concurrency** (finding 3):

```
$ for i in $(seq 1 12); do mstack decide --decision "conc $i" --why w --evidence e --result r & done; wait
rows now: 14
duplicate ts values:
2026-08-19T18:46:09.629Z
2026-08-19T18:46:09.630Z
2026-08-19T18:46:09.631Z
2026-08-19T18:46:09.635Z
```

And the consequence — one pointer, two contradictory answers, gate green:

```
ts	phase	decision	why	evidence	result
2026-08-19T18:46:27.243Z		STABLE: it is a public contract	w	e	stable
2026-08-19T18:46:27.243Z	p	DUMP: we are free to change it	w	e	dump
$ mstack gate
[ok]    1 item(s) with a decision fork, each answered or still in specifying
```

**Partial write** (finding 7), `state.json` chmod 444:

```
$ mstack decide --resolves half --decision "we chose A" --why w --evidence e --result A ; echo "exit=$?"
mstack: EACCES: permission denied, open '.../.mstack/state.json'
exit=2
$ cat .mstack/decisions.tsv     -> the row IS there
$ rg decision_resolved .mstack/state.json  -> (no pointer)
$ # chmod 644, retry:
$ cat .mstack/decisions.tsv
2026-08-19T18:46:39.452Z		we chose A	w	e	A
2026-08-19T18:46:39.481Z		we chose A	w	e	A     <- append-only; the orphan is permanent
```

**Unreadable `decisions.tsv`** (finding 4), the file replaced with a directory:

```
$ mstack gate ; echo "exit=$?"
[ok]    no active item
mstack: EISDIR: illegal operation on a directory, read
exit=2                          <- and no workspace section, no summary
```

**Statuses below the line, and the pass line's claim** (finding 5). One `cancelled` item and one
`blocked` item, both carrying unanswered forks, plus one answered:

```
$ mstack gate
[ok]    3 item(s) with a decision fork, each answered or still in specifying
PASSED - 0 failures, 1 warning
```

Two of the three are neither answered nor in `specifying`.

**Nothing at all when no item carries a fork** (finding 6):

```
$ mstack gate | rg -c -i decision
0
$ mstack gate | rg "no sdd item|no closed items"
[ok]    no sdd item is past specifying
[ok]    no closed items to audit
```

**Empty vs whitespace `decision_required`** (finding 12) — empty is consistent everywhere,
whitespace is a fork with an unreadable question:

```
$ mstack state add --slug blank-fork ... --decision-required ""
$ mstack state set blank-fork --status in_progress   -> exit 0 (not a fork anywhere)
$ mstack decide --resolves blank-fork --decision x   -> exit 2, "carries no decision_required"
$ mstack state set ws-fork --status in_progress      -> exit 2
mstack: ws-fork has an unanswered decision: "   "
```

**Status line arguments** (finding 9), payload `{cwd, tasks:[{id:"a",type:"mstack:implementer"}]}`:

```
--subagent       rc=0  SUBAGENT-rows      --no-subagent    rc=0  MAIN-bar
--subagents      rc=0  SUBAGENT-rows      --help           rc=0  MAIN-bar
--subagent=true  rc=0  SUBAGENT-rows      -h               rc=0  MAIN-bar
--subagent=false rc=0  SUBAGENT-rows  <-  gate             rc=0  MAIN-bar
--subagent=no    rc=0  SUBAGENT-rows  <-  --full           rc=0  MAIN-bar
--subagent-off   rc=0  SUBAGENT-rows  <-
--subagentless   rc=0  SUBAGENT-rows
$ mstack statusline -- --subagent   -> SUBAGENT-rows (the -- marker does not stop the scan)
```

Every argument exits 0 with an empty stderr, which is the whole point of the commit and it works.
What the old parser did with the same input, for the record:

```
--subagent=false -> THREW ERR_PARSE_ARGS_INVALID_OPTION_VALUE
--subagents      -> THREW ERR_PARSE_ARGS_UNKNOWN_OPTION
```

**Strict parsing elsewhere** (finding 8):

```
state list --nope        rc=2  mstack: state list takes no arguments, got '--nope'
state active --nope      rc=2  mstack: state active takes no arguments, got '--nope'
ledger summary --x       rc=2  mstack: ledger summary takes no arguments, got '--x'
worktree list --nope     rc=0  00000000  main  main,dirty  /private/tmp/.../sbCj3A
worktree list garbage    rc=0  00000000  main  main,dirty  /private/tmp/.../sbCj3A
```

**The README example, reproduced verbatim** against `examples/notes-cli`:

```
$ mstack state set export-json --status spec_ready ; echo "exit=$?"
mstack: export-json has an unanswered decision: "Is this a stable public contract other tools may
        depend on, or a convenience dump we are free to change? The two answers produce different
        work: one needs a version field and a compatibility rule, the other does not."
        answer it with 'mstack decide --resolves export-json ...' first
exit=2
```

**Mutation testing.** Repo copied to a scratch dir (`git archive HEAD | tar -x`), one mutation at
a time, `npm test` after each, source restored between runs. The real repo was never edited.

| # | Mutation | Caught |
|---|---|---|
| M1 | drop `"spec_ready"` from `DECISION_REQUIRED_FROM` | yes, 1 fail |
| M2 | drop `"done"` from `DECISION_REQUIRED_FROM` | yes, 1 fail |
| M3 | `arg.startsWith("--subagent")` -> `arg === "--subagent"` | yes, 1 fail |
| M4 | `} else if (!rows.has(answer))` -> `} else if (false)` | yes, 1 fail |
| M5 | `requiresDecision(values.status) &&` -> `false &&` in `state set` | yes, 1 fail |
| M6 | delete the `checkOpenDecisions` call from `checkInvariants` | yes, 4 fail |
| M7 | `takesNothing`: `if (rest.length > 0)` -> `if (false)` | yes, 1 fail |

7 of 7. The tests genuinely pin what the commits claim; they simply do not test the three things
below, because nobody thought to ask what is *in* the row.

## Findings

1. `src/cli.ts:363-369` and `src/gate.ts:186` - **an empty row answers a product fork.**
   `--decision` is required to be present but never required to be non-empty, `--why`,
   `--evidence` and `--phase` all default to `""` (`src/cli.ts:364-367`), and `--result` defaults
   to the literal string `"open"` (`src/cli.ts:368`). `mstack decide --resolves ship --decision " "`
   writes `2026-08-19T18:54:52.812Z\t\t\t\t\topen` — `cell()` trims the space away
   (`src/tsv.ts:21`) — and the gate reports the fork answered. The item then walks to `done`
   unimpeded. This is the boolean the commit message says it refused to build: a way to mark a
   fork answered without saying what the answer was. Fix: in `cmdDecide`, reject
   `values.decision.trim() === ""`, and when `--resolves` is present require `--why` and a
   `--result` other than the `open` default; in `checkOpenDecisions`, look the row up rather than
   only testing membership and fail when its `decision` cell is empty.

2. `src/gate.ts:186,193` and `src/decisions.ts:10` - **the pointer is checked for existence,
   never for relevance.** `rows` is a `Set` of every `ts` in `decisions.tsv`, so any row satisfies
   any item. Proven above: a row recorded *without* `--resolves`, about tabs versus spaces, closes
   a fork about a public API contract once `decision_resolved` names it. Nothing in the row
   records which item it answers, so `--resolves` leaves no trace in `decisions.tsv` at all and
   README.md:63 ("the only way to answer it is `mstack decide --resolves <slug>`") is not true —
   any pre-existing row plus a text editor does the same job, and unlike `--force` the gate stays
   green. Fix: add a `resolves` column to `HEADER` (`src/decisions.ts:10`), have `cmdDecide` write
   `item.slug` into it when `--resolves` is given, and require `row.resolves === item.slug` in
   `checkOpenDecisions`. `readRecords` keys by header and drops unknown columns
   (`src/tsv.ts:54-63`), so old rows read back with `resolves: ""` and fail closed, which is the
   right direction.

3. `src/decisions.ts:23` - **`ts` is a millisecond timestamp used as a primary key, and it
   collides.** Twelve concurrent `mstack decide` processes produced four duplicated timestamps out
   of twelve rows. This is not a stunt: `mstack fanout plan` ships a twenty-worker parallel
   fan-out (`skills/orchestrate/SKILL.md:48`, `src/fanout.ts`) and the playbooks tell those
   workers to record decisions, so concurrent `decide` is the designed workflow. A duplicated `ts`
   makes `decision_resolved` ambiguous — I made one pointer resolve to both "STABLE: it is a public
   contract" and "DUMP: we are free to change it" and the gate called the fork answered. Nothing
   notices: `reportDuplicates` (`src/gate.ts:155`) is wired only to item ids and slugs
   (`src/gate.ts:117-118`). Fix: make the id collision-proof (`${iso}-${randomUUID().slice(0,8)}`,
   or a monotonic counter within the process plus a re-read of the last row), and report duplicate
   `ts` from the gate the way duplicate slugs are reported.

4. `src/gate.ts:186` - **an unreadable `decisions.tsv` kills the gate mid-report and exits 2.**
   `decisionsFor(store)` is unguarded, so an `EISDIR`/`EACCES` from `readFileSync`
   (`src/tsv.ts:47`) escapes `runGate` entirely: the workspace section never runs, no summary is
   printed, and `bin/mstack`'s top-level handler (`src/cli.ts:512-513`) exits **2** — the
   usage-error code per `USAGE` (`src/cli.ts:38`) — where a broken store should be a gate failure,
   exit 1. This is a new exposure; the gate never read `decisions.tsv` before this commit, and it
   now reads it on every run where any item carries a fork. The project already fixed exactly this
   shape once next door: `src/statusline.ts:139-144` wraps the equivalent ledger read because "an
   unreadable ledger.tsv used to throw past every part already computed and print an empty line".
   Fix: `try { rows = ... } catch { report.fail("decisions.tsv is unreadable", ...); return; }`.

5. `src/gate.ts:211` - **the pass line states a fact that is false.** `"${carrying.length} item(s)
   with a decision fork, each answered or still in specifying"` counts every item carrying the
   field, but the `open` list is filtered by `requiresDecision(item.status)` at `src/gate.ts:192` —
   so `pending`, `blocked` and `cancelled` items with unanswered forks are counted into a sentence
   that says they are answered or specifying. Reproduced: three carrying items, two of them
   `cancelled` and `blocked` with nothing answered, and the gate prints "each answered or still in
   specifying". This is the same defect this file already caught and fixed at `src/gate.ts:131-137`
   — "it printed the wrong fact rather than a permitted one". Fix: "each answered, or in a phase
   that does not require an answer", or report the two counts separately.

6. `src/gate.ts:184` - **the check is invisible when it does not apply.** The early return emits
   no report line, so a gate run over a store with no forks contains zero lines mentioning
   decisions — verified, `rg -c -i decision` on the output returns 0. Both sibling checks always
   speak: `src/gate.ts:218` "no sdd item is past specifying", `src/gate.ts:258` "no closed items
   to audit". A check that says nothing when it finds nothing is indistinguishable from a check
   that is not wired up, which is the failure mode this whole commit exists to correct. Fix:
   `report.ok("no item carries a decision fork")` before the return.

7. `src/cli.ts:346-348` and `src/state.ts:24-25` - **"neither can exist alone" is not true.** The
   write is two non-atomic steps: `decisions.add` appends at `src/cli.ts:363`, `saveState` writes
   at `src/cli.ts:373`. With `state.json` unwritable, `decide --resolves` exits 2 having already
   appended the row; `decisions.tsv` is append-only by design, so the orphan is permanent, and the
   retry appends a second identical row. The direction is fail-closed — the item stays blocked, a
   row nobody points at unblocks nothing — so this is a false comment and a durability wart, not a
   hole. `saveState` also uses a bare `writeFileSync` (`src/state.ts:164`) rather than
   write-then-rename, so a crash mid-write truncates `state.json`; `decide` is a new caller of it.
   Fix: `accessSync(store.state, constants.W_OK)` before appending, and either make `saveState`
   atomic or soften both comments to say what is true.

8. `src/cli.ts:385` - **`worktree list` was left out of the `takesNothing` sweep.** `takesNothing`
   was added to `state list` (`src/cli.ts:166`), `state active` (`src/cli.ts:176`) and
   `ledger summary` (`src/cli.ts:318`), but `cmdWorktree`'s list branch has the identical
   `[sub, ...rest]` shape and swallows anything: `worktree list --nope` and `worktree list garbage`
   both exit 0 and print the list. `f1506dc`'s claim that "everywhere else a typo stays loud" is
   one subcommand short, and the test at `tests/launcher.test.ts:102-109` iterates exactly the
   three fixed cases, so nothing would catch the omission. Fix: one more `takesNothing("worktree
   list", rest)` and a fourth entry in that test's array.

9. `src/cli.ts:139` - **`--subagent=false` turns subagent mode on.** The prefix match reads a
   flag's negation as its affirmation: `--subagent=false`, `--subagent=no` and `--subagent-off` all
   render subagent rows, and the scan covers all of argv including anything after a `--`
   end-of-options marker. The old strict parser threw `ERR_PARSE_ARGS_INVALID_OPTION_VALUE` on
   `--subagent=false` — wrong, but honestly wrong. Exit 0 on every input is right and is the point
   of the commit; silently choosing the opposite mode is not, and `tests/launcher.test.ts:84-99`
   asserts `--subagent=true` but never `=false`. Fix: keep the prefix scan, but when the matched
   argument carries an `=value`, treat `false`/`0`/`no`/`off` as false.

10. `.mstack/state.json:74` vs `src/lifecycle.ts:49-55` - **acceptance bullet 1 and the shipped
    line disagree about where the line is.** The bullet says "past `in_progress`"; the code blocks
    at `spec_ready` and `in_progress` as well, and README.md:62 says "Past `specifying`". The code
    being stricter harms nobody, but the bullet as written asserts that an `in_progress` item may
    carry an open fork, and it may not. Fix: rewrite the bullet to say `specifying`, since the
    code is right (see the note on question 3 below).

11. `src/state.ts:138-152` with `src/cli.ts:373` - **`decide --resolves` silently strips unknown
    fields from `state.json`.** `parseItem` copies only the fields it knows and `saveState` writes
    the result back, so one `mstack decide --resolves` deleted a top-level `owner` key, an extra
    entry under `rules`, and an item-level `priority`. Pre-existing behaviour shared with
    `state add`/`state set`, but `decide` did not touch `state.json` at all before this commit, so
    the blast radius is new. Fix: out of scope for these commits, but it should be an issue —
    round-trip unknown keys, or document that `state.json` is owned exclusively by `mstack`.

12. `src/gate.ts:183`, `src/cli.ts:246`, `src/cli.ts:355` - **whitespace-only `decision_required`
    is a fork whose question cannot be read.** All three predicates test `!== ""` without trimming,
    so `--decision-required "   "` produces the refusal `has an unanswered decision: "   "` —
    a fork that satisfies acceptance bullet 3 only in the letter. The empty string is handled
    consistently in all three places (not a fork anywhere, and `decide --resolves` refuses it), so
    only the whitespace case is inconsistent with it. Fix: `.trim()` in all three, which collapses
    whitespace into the empty case.

## Answers to the specific questions

**Can an unanswered fork reach `done`?** Through `state set` alone, no — every route I tried was
refused at `src/cli.ts:244-254` because the check tests the *target* status, so no chain helps:
`blocked -> verifying` and `cancelled -> pending -> in_progress` are both stopped at the step that
lands in `DECISION_REQUIRED_FROM`. `--force` moves it and the gate reports it, as designed. An item
that gains the field after `in_progress` (only reachable by hand-editing; there is no CLI for it)
is reported by the gate and is recoverable, because `decide --resolves` has no status precondition.
An empty-string `decision_required` is not a fork anywhere, consistently. What *does* get an item
to `done` with the gate green is findings 1, 2 and 3 — a content-free row, an unrelated row, and a
colliding `ts`.

**`decide --resolves` on a `cancelled` item** succeeds (`recorded, and gone no longer has an open
fork`). There is no status precondition at `src/cli.ts:351-361`. I would leave that alone: the same
absence is what lets a `pending` item record its answer before entering `in_progress`, which is the
only reason the line at `specifying` is survivable on the direct path (`specifying` cannot
transition to `in_progress` — `src/lifecycle.ts:65`). Resolving a cancelled item's fork is harmless.

**Is `specifying` the right line?** Against: it is stricter than the acceptance bullet, and for a
direct-path item — "most work goes straight to implementation" — it means the fork must be answered
before any code is written, which front-loads a decision that implementation sometimes clarifies.
For: `in_progress` *is* building, and drawing the line past it would let a whole implementation be
written across an unanswered fork and stop it only at `reviewing` — an announcement with a late
alarm, which is the exact failure this commit set out to kill. `specifying` is the last phase whose
job is finding the answer; everything after it consumes one. **I would ship `specifying`** and
change acceptance bullet 1 to match (finding 10).

**Ordering and double-reporting.** Fine. `checkOpenDecisions` runs first (`src/gate.ts:150`), which
is right — the fork binds earliest. It reports a different fact from `checkSpecArtifacts` (missing
spec) and `checkClosedItems` (missing verdict); a `done` item with an open fork and no verdict
yields exactly two failures, one from each, with no overlap. One asymmetry worth knowing: the two
siblings are switchable via `rules.require_spec_for_sdd_items` / `rules.require_verdict_to_close`
and this one is not, and `parseState` hard-codes the three-rule shape at `src/state.ts:101-105`, so
the asymmetry is structural. Defensible — a gate you can switch off is not a gate — but it is worth
one line in the README so nobody goes looking for the flag.

## Working tree

```
$ git status --porcelain
 M README.md
?? .mstack/progress/review_decision-required-gate_correctness.md   (this file)
```

`README.md` was already modified when I started and is not mine — it rewrites the Install section
to the `--plugin-dir` route, which is unrelated to either commit under review. Another session is
editing this repo concurrently; the earlier `.mstack/decisions.tsv` and `.mstack/ledger.tsv`
modifications I saw at the start of my run disappeared mid-review. All my own work ran in
`mktemp -d` sandboxes and in a `git archive` copy for the mutation testing; no source file in this
repo was touched.
