# Implementer report - deep-module-vocabulary (item 57), round 3

## What changed

Only the text of items 76 to 80 in `.mstack/state.json`, set through `./bin/mstack state set`
(commit `3a978df`). Each
item was split into assertions, and each assertion got a command that shows it. Anything false,
unshown or not needed was cut. Line ranges are gone: every place is named by file and function.
The two counts that are left (nine `isActive` sites, five `execFileSync("git")` calls) come
with the command that counts them. Item 77 was narrowed to its active-item half and its Reading
half was cut, because the consumers differ on purpose (decision row below). Item 78's
criteria now measure `renameSync` and a held-lock probe instead of every write call. Every
check was run again after the final edit, from one script, and its output is pasted in full in
the appendix. No item was cancelled. Nothing outside `.mstack/` changed, so I did not run the
test suite.

## Files

- `.mstack/state.json`: items 76 to 80 (title, description, acceptance, seams).
- `.mstack/progress/impl_deep-module-vocabulary_r3.md`: this report.
- `.mstack/progress/current.md`: the In flight line.
- `.mstack/decisions.tsv`: two `implement` rows (item 77 narrowed, item 78's criteria).
- `.mstack/ledger.tsv`: the implementer row.

Scratch, outside the repository, in
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl57r3/`:
`apply.sh` (the `state set` calls), `checks.sh <id>` (every check per item), `before/*.txt`,
`after/*.txt` (final `state show` and check output), and the throwaway stores `fork76`, `two77`,
`broken77`, `lock78`, `detach79` and `reorder80`. Each store is a fresh `git init` with an empty
commit and this checkout's `bin/mstack setup`.

## Method

The `#` column refers to the headings in the appendix (`C` for a claim in the description or
title, `A` for the check that an acceptance criterion is not yet true). T means the output
shows the assertion as worded. Outputs below are excerpts. The appendix has them in full.

---

## Item 76 `item-transition-module`

### Before

```
title: The rules for moving an item between statuses live inside cmdState in cli.ts, reachable only by spawning the CLI
description: state set --status (src/cli.ts, inside cmdState at 379) holds the unanswered-fork check (571-581), the legal-transition check (582-587), the closing policy (595-639) and the forced-close marker (554, 634-637, 666, 681-686); lifecycle.ts holds only the table and six one-line predicates. The fork rule is also judged twice, differently: cli.ts:571-576 refuses only while decision_resolved is empty (any non-empty value counts as answered), gate.ts checkOpenDecisions (274-325) additionally requires a decisions.tsv row that matches it (302-318). cli.ts exports only FORCED_UNVERIFIED, so tests reach the rules only by spawning the CLI (tests/state-cli.test.ts:28, tests/cli.test.ts:29). Deepen into one transition module the CLI calls and tests cross. Evidence: .mstack/progress/explore_cli-lifecycle.md findings 1, 2, 5; claims re-derived in .mstack/progress/impl_deep-module-vocabulary_r2.md.
acceptance:
  - a module outside cli.ts exports the operation that applies a status change to an item and returns the changes or a typed refusal; state set --status calls it and only parses flags and prints
  - whether an item's fork is answered is decided by one function that both state set --status and the gate call, so a decision_resolved with no matching decisions.tsv row is refused by both (cli.ts:571-576 accepts it today)
  - the forced-close handling leaves cli.ts: cli.ts no longer assigns item.closed_by for a forced close (681-686 today), and a test at the module shows a forced close stores the FORCED_UNVERIFIED marker and a later --closed-by keeps it
  - the transition rules are tested by calling that module in process; the spawned-CLI tests they replace (tests/state-cli.test.ts, tests/cli.test.ts) are deleted, and the CLI keeps only exit-code, stream and routing tests
seams:
  - the transition module's apply function
```

### Claims in the final text

| # | Assertion | Command | Output | |
|---|---|---|---|---|
| C0 | the source file exists | `fd -t f "deepen_2026-11-17.md" .mstack/progress` | `.mstack/progress/deepen_2026-11-17.md` | T |
| C1 | state set --status is handled inline in cmdState (src/cli.ts) | `rg -n "^function cmdState\|^function cmdLedger\|if \(values.status !== undefined\)" src/cli.ts` | `379:function cmdState`, `565: if (values.status !== undefined) {`, `794:function cmdLedger` | T |
| C2 | refuses a move to a status that requiresDecision while the fork is unanswered | `bat -pp --line-range 571:587 src/cli.ts` | 572 `requiresDecision(values.status) &&`, 573 decision_required non-empty, 574 decision_resolved empty, 577 `throw` | T |
| C3 | refuses a move canTransition rejects | same | 582 `if (!canTransition(item.status, values.status) && values.force !== true) {`, 583 `throw` | T |
| C4 | refuses a close closingProblems objects to; --force passes an overridable objection only with --closed-by | `bat -pp --line-range 595:638 src/cli.ts` | 596 `closingProblems(store, state, item)`; 597-600 a non-overridable problem throws whatever the flags; 607 throws without `--force`; 629-635 throws with `--force` and no `--closed-by` | T |
| C5 | writes the FORCED_UNVERIFIED marker into closed_by and keeps it on a later --closed-by | `bat` 665:667 and 681:685 | 682 ``note = `${FORCED_UNVERIFIED}${item.closed_by ?? ""}` ``, 684 `item.closed_by = note`; 666 re-prefixes when `closed_by` already starts with the marker | T |
| C6 | lifecycle.ts holds the status lists, the TRANSITIONS table and six predicates, none of which takes an item | `rg -n "^export" src/lifecycle.ts` | six `const` lists and `type Status`; `TRANSITIONS`; `isStatus(value: unknown)`, `isActive(status)`, `requiresSpecArtifacts(status)`, `requiresDecision(status)`, `requiresVerification(status)`, `canTransition(from, to)` | T |
| C7 | in src, cmdState is the only caller of canTransition | `rg -n "canTransition\(" src` | `src/cli.ts:582` (inside cmdState, 379 to 793) and the definition `src/lifecycle.ts:117` | T |
| C8 | cmdState treats any non-empty decision_resolved as answered | live, `fork76`: with `decision_resolved` empty, then set by hand to `2020-01-01T00:00:00.000Z` while decisions.tsv holds only its header | first `mstack: fork has an unanswered decision` `[exit 2]`; then `status: "specifying" -> "spec_ready"` `[exit 0]` | T |
| C9 | the gate's checkOpenDecisions also requires a decisions.tsv row with that timestamp that resolves the item | `mstack gate --quiet 2>&1 \| rg 'points at decision'`; `bat` gate.ts 307:311 | `[fail] 1 fork (spec_ready) points at decision 2020-01-01T00:00:00.000Z, and no row with that timestamp resolves fork`; 309 `row.ts === answer && row.resolves === item.slug` | T |
| C10 | cli.ts exports only FORCED_UNVERIFIED | `rg -n "^export" src/cli.ts` | `223:export const FORCED_UNVERIFIED` and nothing else | T |
| C11 | no test imports cli.ts | `rg -n "src/cli\.ts['\"]" tests \| rg import` | nothing, `[exit 1]` | T |
| C12 | tests/cli.test.ts, tests/closing.test.ts and tests/decisions.test.ts assert these refusals on the stderr of a spawned CLI | `rg -n "stderr.*(not a legal transition\|unanswered decision\|cannot close)" tests`; `rg -n "spawnSync\(BIN\|execFileSync\(MSTACK" <those three>` | 10 matches: cli.test.ts 308, 632; closing.test.ts 124, 153, 171, 222, 295; decisions.test.ts 116, 188, 331. Their helpers spawn `bin/mstack` at cli.test.ts:29, closing.test.ts:16 and decisions.test.ts:18 | T |

The "Claims checked in" sentence names this file, which exists once this commit lands.

### Acceptance criteria not yet true at the head

| # | Criterion | How it was checked | Output |
|---|---|---|---|
| A1 | rg `canTransition\(\|closingProblems\(` src/cli.ts finds nothing ("one call of each today") | `rg -n "canTransition\(\|closingProblems\(" src/cli.ts` | 582 and 596, one each |
| A2 | a decision_resolved no row resolves is refused by both ("state set accepts it today and the gate refuses it") | C8, C9 | state set exit 0, gate fail |
| A3 | rg FORCED_UNVERIFIED src/cli.ts finds nothing ("four lines today") | `rg -n FORCED_UNVERIFIED src/cli.ts` | 223, 634, 666, 682 |
| A4 | the refusals have an in-process test at the module | no such module exists (A1). The refusals are asserted only on spawned CLIs (C12) | |

### Cut, and why

- Every line range. `checkOpenDecisions (274-325)` was wrong: the function ends at 334.
- "lifecycle.ts holds only the table and six one-line predicates". canTransition is three lines,
  and the file also holds the status lists. It now reads "the status lists, the TRANSITIONS
  table and six predicates, none of which takes an item".
- "the closing policy". Replaced by what the code does (C4), since closingProblems itself lives
  in closing.ts.
- tests/state-cli.test.ts as the home of transition tests: none of the refusal texts is asserted
  there (C12). Acceptance 4 now names the three files that do assert them, through the search
  that lists them.
- The pointers to the explore files and to the round 2 report. They are not needed to verify
  the item, and this report replaces them.

### Final

```
id: 76
slug: item-transition-module
title: The rules for moving an item between statuses are composed inside cmdState in cli.ts, which tests can reach only by spawning the CLI
status: pending
source: deepen playbook run, 2026-11-17, .mstack/progress/deepen_2026-11-17.md
description: state set --status is handled inline in cmdState (src/cli.ts). There it refuses a move to a status that requiresDecision while the item's fork is unanswered, refuses a move canTransition rejects, refuses a close that closingProblems objects to and lets --force past an overridable objection only with --closed-by, and writes the FORCED_UNVERIFIED marker into closed_by and keeps it on a later --closed-by. lifecycle.ts holds the status lists, the TRANSITIONS table and six predicates, none of which takes an item; in src, cmdState is the only caller of canTransition. The fork rule is judged two ways: cmdState treats any non-empty decision_resolved as answered, while the gate's checkOpenDecisions also requires a decisions.tsv row with that timestamp that resolves the item. cli.ts exports only FORCED_UNVERIFIED and no test imports cli.ts, so tests/cli.test.ts, tests/closing.test.ts and tests/decisions.test.ts assert these refusals on the stderr of a spawned CLI. Deepen into one transition module the CLI calls and tests cross. Claims checked in .mstack/progress/impl_deep-module-vocabulary_r3.md.
acceptance:
  - a module outside cli.ts exports the operation that applies a status change to an item and returns the changes or a typed refusal; state set --status calls it and only parses flags and prints, so rg "canTransition\(|closingProblems\(" src/cli.ts finds nothing (it finds one call of each today)
  - whether an item's fork is answered is decided by one function that both state set --status and the gate call, so a decision_resolved that no decisions.tsv row resolves is refused by both (state set accepts it today and the gate refuses it)
  - the forced-close marker is applied in that module: rg FORCED_UNVERIFIED src/cli.ts finds nothing (four lines today), and a test at the module shows that a forced close stores the marker and a later --closed-by keeps it
  - each refusal that tests/cli.test.ts, tests/closing.test.ts and tests/decisions.test.ts assert today on a spawned CLI (the matches of rg "stderr.*(not a legal transition|unanswered decision|cannot close)" tests) has an in-process test at the module, and a spawned test that only restates one of them is deleted
seams:
  - the transition module's apply function
```

### Why the candidate still stands

The deletion test: if lifecycle.ts's predicates were deleted, nothing would hide the rules,
because the fork refusal, the transition refusal, the closing refusal and the marker are
composed only inside cmdState (C1 to C7), and a test reaches them only through a process
(C10 to C12). The fork rule is judged two ways, and the real CLI accepts a state the gate then
fails (C8, C9).

---

## Item 77 `item-readiness-reading`

### Before

```
title: The active item is looked up inline at nine sites, and four modules each turn a ledger Reading into their own verdict, kept in agreement by comments and one test
description: readVerdict (ledger.ts:222) is the one reader of the verdict, but four consumers interpret its Reading kind themselves: ledger.ts check (switch at 312), gate.ts checkClosedItems (421-438), closing.ts (103-123) and statusline.ts (158-160); statusline.ts:154-157 says in a comment that the kind comes from the shared reader, and tests/verdict-reader.test.ts:87 exists to pin that check and the gate agree. mergegate.ts:165 reads only check's passing and reason, so it is not a fifth consumer. Separately, the active item is found by an inline isActive lookup at nine sites (hooks.ts:109, statusline.ts:103 and 328, cli.ts:410 and 1009, costs.ts:319, gate.ts:222, 602 and 659) beside activeItem (state.ts:354), with three error contracts: activeItem swallows a parse error, hooks.ts:107-114 logs it, the rest let parseState throw. Deepen into one place that answers which item is active and what its Reading means for closing. Evidence: .mstack/progress/explore_checks-hooks.md finding 2, explore_persistence.md F5; claims re-derived in .mstack/progress/impl_deep-module-vocabulary_r2.md.
acceptance:
  - one exported function returns the active item or a typed absence under one stated error contract; rg 'isActive\(' src finds it only in lifecycle.ts, that function and the list marker at cli.ts:403
  - the mapping from a Reading kind to a closing outcome is defined once beside readVerdict; gate.ts checkClosedItems, closing.ts and statusline.ts take that outcome and none compares a Reading's kind (rg '\.kind (===|!==)' on those three files finds nothing)
  - the closing cases (author-only, discounted, rejected, passing, stale) are tested once at that mapping; the gate.test.ts and statusline.test.ts cases that restate them keep one rendering assertion each, and the agreement test at verdict-reader.test.ts:87 is deleted because the two can no longer disagree
seams:
  - the active-item function and the Reading-to-closing-outcome mapping
```

### Claims in the final text

| # | Assertion | Command | Output | |
|---|---|---|---|---|
| C1 | activeItem (src/state.ts) returns the first item with an active status, and undefined when state.json cannot be parsed | `bat -pp --line-range 354:360 src/state.ts` | 356 `parseState(store.state).items.find((item) => isActive(item.status))`, 357-358 `catch { return undefined; }` | T |
| C2 | nine other sites search or filter state.items with isActive | `rg -n "isActive\(" src` | 12 matches. Less the definition (lifecycle.ts:101), activeItem (state.ts:356) and the list marker (cli.ts:403), that leaves 9: hooks 109; statusline 103, 328; cli 410, 1009; costs 319; gate 222, 602, 659 | T |
| C3 | they are hooks.ts activeItemOrLog, statusline.ts (twice), cli.ts (state active and cmdMergeGate), costs.ts activeSlug, gate.ts (three times); the list marker is in state list | `rg -n "^function activeItemOrLog\|...\|if \(sub === \"list\"" ...` | hooks 107 `activeItemOrLog` (109); statusline 326 `ambiguous` (328) and the render at 103; cli 408 `sub === "active"` (410), 993 `cmdMergeGate` (1009; cmdCost starts at 1023); costs 317 `activeSlug` (319); cli 398 `sub === "list"` (403) | T |
| C4 | some take the first match and some count the matches | C2 output | `.find(` at hooks, cli twice, costs, gate 602 and 659; `.filter(` at statusline twice and gate 222 | T |
| C5 | with two items in_progress, state active prints the first, fanout plan fans out on it, the status line prints "2 active items" | live, `two77` | `first` `[exit 0]`; `review fan-out on first, 1 worker(s):`; `main · 2 active items` | T |
| C6 | with one item in_progress beside one whose status is "bogus": fanout plan (through activeItem) says "no active item to fan out on", state active exits 2 with parseState's error, the status line prints "state.json unreadable" | live, `broken77` (`first:bogus second:in_progress`); `rg -n "activeItem\(store\)" src/fanout.ts`; `rg -n "valid set" src/state.ts` | `mstack: no active item to fan out on` `[exit 2]`; `mstack: .../state.json .items[0].status is "bogus"` / `see the lifecycle in the mstack README for the valid set` `[exit 2]`; `main · state.json unreadable`; fanout.ts:67 `activeItem(store)`; state.ts:191 is the hint's source | T |
| C7 | item 69: session-start prints "No active work item" on an unreadable state.json | `mstack state show 69 \| rg 'No active work item'` | "session-start on an unreadable state.json logs the failure but still prints 'No active work item'" | T |

### Acceptance criteria not yet true at the head

| # | Criterion | How it was checked | Output |
|---|---|---|---|
| A1 | isActive only in lifecycle.ts, the function and the list marker ("nine more sites today") | C2 | nine more |
| A2 | two in_progress: state active, fanout plan and the status line give one answer | C5 | `first`, `first`, `2 active items` |
| A3 | unparseable state.json: fanout plan and state active give one answer, neither says no active item | C6 | fanout says "no active item to fan out on" |
| A4 | the four cases are each tested once at that function | `rg -n "activeItem" tests` | nothing, `[exit 1]` |

### Cut, and why

- **The whole Reading half** (readVerdict's consumers, the statusline comment, the agreement
  test, mergegate, and acceptance criteria 2 and 3). The four places that branch on a Reading's
  kind give different outcomes on purpose. In the CASES table in `tests/verdict-reader.test.ts`,
  "author only" is `check: "pass", gate: "fail"` and "a lone blocked row" is `check: "fail",
  gate: "pass"`. closing.ts's LEDGER_VERDICT_CHECK comment says "Only a rejection is refused
  here". readVerdict is already the one reader. A single kind-to-outcome mapping would have to
  pick one policy, which is a product decision and not a deepening. So the half is cut instead
  of reworded (decision row, phase implement).
- "three error contracts ... the rest let parseState throw": false (round 2 review, blocking 1).
  It is replaced by three live behaviours (C5, C6), which show the disagreement without
  classifying every site.
- Every line number.
- The slug `item-readiness-reading` stays because a slug cannot be renamed. It no longer matches
  the title.

### Final

```
id: 77
slug: item-readiness-reading
title: The active item is searched for at nine sites beside activeItem, and commands answer differently when two items are active or state.json cannot be parsed
status: pending
source: deepen playbook run, 2026-11-17, .mstack/progress/deepen_2026-11-17.md
description: activeItem (src/state.ts) returns the first item with an active status, and undefined when state.json cannot be parsed. Nine other sites search or filter state.items with isActive themselves: hooks.ts activeItemOrLog, statusline.ts (twice), cli.ts (state active and cmdMergeGate), costs.ts activeSlug and gate.ts (three times); some take the first match and some count the matches. With two items in_progress, mstack state active prints the first and mstack fanout plan fans out on it, while the status line prints "2 active items". With one item in_progress beside one whose status is "bogus", mstack fanout plan (through activeItem) says "no active item to fan out on", mstack state active exits 2 with parseState's error and the status line prints "state.json unreadable". Deepen into one function that says which item is active, with none, more than one and unreadable as answers, which these sites call. Adjacent: item 69, in which session-start prints "No active work item" on an unreadable state.json. Claims checked in .mstack/progress/impl_deep-module-vocabulary_r3.md.
acceptance:
  - one exported function answers which item is active, with none, more than one and an unreadable state.json as distinct answers; rg "isActive\(" src finds isActive only in lifecycle.ts, in that function and in the list marker of state list (nine more sites today)
  - on a store with two items in_progress, mstack state active, mstack fanout plan and the status line give one answer (today the first two take the first item and the status line prints "2 active items")
  - on a store whose state.json cannot be parsed, mstack fanout plan and mstack state active give one answer and neither says there is no active item (today fanout plan says "no active item to fan out on")
  - none, one, more than one and an unreadable state.json are each tested once at that function, in process
seams:
  - the active-item function
```

### Why the candidate still stands

This is duplication. activeItem is a six-line wrapper, and nine sites re-implement the search
beside it, with no shared answer for "more than one" or "unreadable" (C2 to C4). On the same
store, three commands of the real CLI say three different things about which item is active
(C5, C6). One of them, `fanout plan`, says there is no active item while one is in_progress.

---

## Item 78 `durable-store-file`

### Before

```
title: Whether a store write takes the lock is each caller's choice, and the ledger the gate trusts is written unlocked
description: withLock (src/tsv.ts:173) is taken by state (state.ts:289), decisions (decisions.ts:53) and costs (costs.ts:287, 425, 754, 764) but not by ledger.record (append at ledger.ts:135) or verification.record (append at verification.ts:314); verification.ts:34-42 records that omission as deliberate, because locking one of the two would leave the other racing, and says a lost row is fail-closed. ensureHeader widens a narrower header by an unlocked whole-file writeFileSync (tsv.ts:55-57). Three tmp-then-rename implementations differ in naming and cleanup (state.ts:308-329 .tmp-<pid>-<n> with wx and cleanup, costs.ts:449-451 ${file}.tmp with no cleanup, hooklog.ts:79-82 <file>.<pid>.tmp with cleanup in finally). Deepen into one module that owns a store file, so the choice stops being each caller's. Adjacent open items: 66 (lock follow-ups), 68 (state write follow-ups, state.ts rename, symlink and mode), 51; this item would absorb their writes, not their findings. Evidence: .mstack/progress/explore_persistence.md F1; claims re-derived in .mstack/progress/impl_deep-module-vocabulary_r2.md.
acceptance:
  - one module owns append, header widening and atomic rewrite for store files; rg 'writeFileSync|appendFileSync|renameSync' src finds them only in that module, in hooklog.ts (a log, not a store) and in run-helper.mjs (a result file); today it also finds them in costs.ts and state.ts
  - the lock decision is made inside that module, so ledger and verification writes are locked without their callers asking, and the comment at verification.ts:34-42 is deleted or replaced by the new fact
  - a concurrent-writer test at that module's interface (N parallel appends, N rows) covers every store, and the per-store concurrency tests it replaces are deleted
seams:
  - the store-file module
```

### Claims in the final text

| # | Assertion | Command | Output | |
|---|---|---|---|---|
| C1 | withLock (src/tsv.ts) is called by state.ts updateState, by decisions.ts and four times by costs.ts | `rg -n "withLock\(" src`; `bat` state.ts 288:289 | decisions.ts:53; costs.ts:287, 425, 754, 764; state.ts:289, inside `updateState` at 288 | T |
| C2 | and not by ledger.record or verification.record, which call tsv append directly | `rg -n "withLock\|append\(store\." src/ledger.ts src/verification.ts` | `ledger.ts:135 append(store.ledger, HEADER, [`; `verification.ts:314 append(store.verification, HEADER, [`; the only `withLock` is the comment at verification.ts:36 | T |
| C3 | with ledger.tsv.lock and decisions.tsv.lock held by a live process, ledger record appends at once, while decide waits and fails after 2 s naming the holder | live, `lock78`: a `sleep 30` pid writes `<pid> <uuid>` into both lock files | `recorded test-verified for demo` in `real 0m0.060s`, `[exit 0]`, and the row is in ledger.tsv; `decisions.tsv.lock is held by pid 85602 and did not let go in 2003 ms`, `real 0m2.037s`, `[exit 2]` | T |
| C4 | verification.ts says the omission is deliberate, quoted | `rg -n "Locking one of the two would leave the codebase\|inconsistent about a race present in both" src/verification.ts` | 38-39 "Locking one of the two would leave the codebase / inconsistent about a race present in both." | T |
| C5 | temporary and rename implemented three times: state.ts writeAtomically (`<name>.tmp-<pid>-<n>`, created exclusively, removed if the write fails), costs.ts prune (`<file>.tmp`, not removed if the write fails), hooklog.ts trim (`<file>.<pid>.tmp`, removed in a finally) | `rg -n "renameSync\(" src`; `bat` state.ts 308:323, costs.ts 449:452, hooklog.ts 75:85; STATE_TMP_PREFIX | three calls: costs 451, hooklog 81, state 317. state: 309 basename + `".tmp-"` + pid + `-` + counter, 311 `openSync(tmp, "wx")`, 318-320 `catch` then `rmSync(tmp)`. costs: 449 `` `${file}.tmp` ``, no rm. hooklog: 78 `` `${log}.${process.pid}.tmp` ``, 82-83 `finally { rmSync(tmp...` | T |
| C6 | adjacent: 66 (lock follow-ups) and 68, in which updateState's rename turns a symlinked state.json into a regular file | `state show 66 \| rg '^title'`; `state show 68 \| rg -o '...'` | "Lock follow-ups from the item 52 reviews ..."; "updateState renames a new file over the target, so a symlinked state.json becomes a regular file" | T |

### Acceptance criteria not yet true at the head

| # | Criterion | How it was checked | Output |
|---|---|---|---|
| A1 | ledger.record and verification.record no longer call tsv append outside the lock | C2, C3 | they do, and ledger record does not wait |
| A2 | rg `renameSync\(` src finds one call ("three today") | C5 | three |
| A3 | a test at the interface shows ledger and verification appends wait for a held lock; ledger record waits as decide does | `rg -n "withLock\|\.lock" tests/ledger.test.ts tests/ledger-cli.test.ts tests/verification.test.ts`; C3 | nothing, `[exit 1]`; ledger record appends at once |

### Cut, and why

- Acceptance 1's search over every write call. It also finds setup.ts (round 2 review,
  blocking 2). It also finds costs.ts's writes to the marks file under `.git/mstack`, which is
  not a store file. setup.ts writes a file only when it is missing, or under `--force` on a
  store with no items. Making the criterion require those moves would argue for something the
  candidate never argues for. The criterion now measures the duplication (renameSync) and the
  lock (a live probe) (decision row, phase implement).
- The ensureHeader sentence, item 51, and "this item would absorb their writes, not their
  findings". None of them is needed, and the last one cannot be shown.
- "the per-store concurrency tests it replaces are deleted". The concurrency tests that exist
  (tests/state.test.ts "concurrent state add calls each land", tests/decisions.test.ts
  "concurrent decisions do not share a timestamp") test commands end to end. Replacing them is
  not argued here.
- The paraphrase of the verification.ts comment, replaced by the quote. Every line number.

### Final

```
id: 78
slug: durable-store-file
title: Whether a store write takes the lock is each caller's choice, and ledger and verification rows are appended without it
status: pending
source: deepen playbook run, 2026-11-17, .mstack/progress/deepen_2026-11-17.md
description: withLock (src/tsv.ts) is called by state.ts updateState, by decisions.ts and four times by costs.ts, and not by ledger.record or verification.record, which call tsv append directly. With ledger.tsv.lock and decisions.tsv.lock held by a live process, mstack ledger record appends its row at once, while mstack decide waits and fails after 2 s naming the holder. verification.ts says the omission is deliberate: "Locking one of the two would leave the codebase inconsistent about a race present in both." Writing a file through a temporary and a rename is implemented three times, with different temporary names and cleanup: state.ts writeAtomically (<name>.tmp-<pid>-<n>, created exclusively, removed if the write fails), costs.ts prune (<file>.tmp, not removed if the write fails) and hooklog.ts trim (<file>.<pid>.tmp, removed in a finally). Deepen into one module that owns writing a store file, the lock included, so callers stop choosing. Adjacent open items: 66 (lock follow-ups) and 68, in which updateState's rename turns a symlinked state.json into a regular file. Claims checked in .mstack/progress/impl_deep-module-vocabulary_r3.md.
acceptance:
  - one module owns appending to, widening and atomically rewriting a store file, and takes the lock itself: ledger.record and verification.record no longer call tsv append outside the lock, and the verification.ts comment that explains the unlocked append is deleted or replaced
  - writing through a temporary and a rename is implemented once, in that module: rg "renameSync\(" src finds one call (three today: state.ts, costs.ts and hooklog.ts)
  - a test at that module's interface holds a store file's lock and shows that an append to ledger.tsv and to verification.tsv waits for it, as one to decisions.tsv does; with ledger.tsv.lock held by a live process, mstack ledger record waits as mstack decide does (today it appends at once)
seams:
  - the store-file module
```

### Why the candidate still stands

This is duplication, plus a policy that leaks to callers. The same held lock stops
`mstack decide` for 2 s and does not slow `mstack ledger record` at all (C3), because each
caller decides whether to lock (C1, C2). Rename-into-place exists three times with three
cleanup rules (C5).

---

## Item 79 `workspace-facts`

### Before

```
title: Git is asked from 22 call sites outside git.ts in two incompatible ways, and 'no git, no commits, detached' has three encodings
description: git.ts:6 says it is the one place that shells out to git, but ledger.ts:57 and 82 and worktree.ts:81 and 152 run their own execFileSync (git() returns null on failure with a 5 s timeout, git.ts:21 and 61; worktree.ts:152 throws with no timeout). Outside git.ts there are 22 call sites in seven modules: 18 calls to git() (costs 1, gate 5, paths 2, statusline 2, verification 4, worktree 4) and the 4 direct calls. Branch, head and dirty are derived separately by gate checkWorkspace (gate.ts:562-588), statusline (90-91, 134) and worktree list and isDirty (worktree.ts:25, 79-81). The git dir is found three ways, for two different questions: costs.ts:158-187 walks .git by hand for the marks dir and falls back to rev-parse --git-path, hooklog.ts:112-135 walks .git and commondir for the common dir, paths.ts:186-200 asks rev-parse --git-common-dir. No git, no commits and detached are told apart in gate.ts:563 versus 570 (two calls), folded into one test in statusline.ts:91 (HEAD), and collapsed to UNKNOWN_TREE in verification.ts:207-253. Deepen into a module that answers workspace questions. Evidence: .mstack/progress/explore_checks-hooks.md finding 1 (its count of nine sites is wrong; recounted here), explore_persistence.md F3; claims re-derived in .mstack/progress/impl_deep-module-vocabulary_r2.md.
acceptance:
  - rg 'execFileSync\("git"' src finds exactly one call, inside the workspace module (five today: git.ts:63, ledger.ts:57 and 82, worktree.ts:81 and 152)
  - branch state (no git, no commits, detached, on a branch), head, dirty and the git common dir each have one answer in that module, and gate, statusline, worktree, costs and hooklog call it
  - the three-state branch distinction and the git-dir answer are tested at that module against a temp repo; statusline formatting tests no longer need a real repo
seams:
  - the workspace module
```

### Claims in the final text

| # | Assertion | Command | Output | |
|---|---|---|---|---|
| C1 | the header comment of src/git.ts says "The one place this repository shells out to git." | `bat -pp --line-range 1:6 src/git.ts` | lines 1-3 are imports, 5 `/**`, 6 ` * The one place this repository shells out to git.` | T |
| C2 | ledger.ts (isCommit, resolveSha) and worktree.ts (isDirty, run) call execFileSync("git") themselves | `rg -n 'execFileSync\("git"' src`; `rg -n "^function isCommit\|^export function resolveSha\|^function isDirty\|^function run" src/ledger.ts src/worktree.ts` | git.ts:63, ledger.ts:57 (isCommit at 55), 82 (resolveSha at 79), worktree.ts:81 (isDirty at 79), 152 (run at 150) | T |
| C3 | git() returns null on any failure and passes a 5 s timeout; worktree.ts run throws a UserError and passes no timeout | `rg -n GIT_TIMEOUT_MS src/git.ts`; `bat` git.ts 73:75, worktree.ts 150:156 | `21:const GIT_TIMEOUT_MS = 5_000`, `68: timeout: GIT_TIMEOUT_MS`; `catch { return null; }`; 152 `execFileSync("git", args, { cwd: store.root, encoding: "utf8" })` with no timeout, 154 `throw new UserError` | T |
| C4 | the branch is read with rev-parse --abbrev-ref HEAD in gate.ts checkWorkspace and in statusline.ts; dirty is `git status --porcelain` in checkWorkspace and `git status --porcelain --ignored=matching` in worktree.ts isDirty | `rg -n "\"--abbrev-ref\", \"HEAD\"\|\"status\", \"--porcelain\"" src`; `rg -n "^function checkWorkspace" src/gate.ts` | statusline.ts:90, gate.ts:570, gate.ts:581 `["status", "--porcelain"]`, worktree.ts:81 `["status", "--porcelain", "--ignored=matching"]`; checkWorkspace runs from 562 to its closing brace at 588 | T |
| C5 | on a detached head the gate prints "[ok] on branch HEAD" while the status line shows no branch | live, `detach79`: setup committed, `checkout -b feat`, then `checkout --detach` | on feat: `[ok] on branch feat`, `feat · idle`; detached: `rev-parse --abbrev-ref HEAD` prints `HEAD`, gate `[ok] on branch HEAD`, status line `idle` | T |
| C6 | costs.ts marksDir and hooklog.ts gitCommonDir each walk up to .git and parse a gitdir: line by hand; paths.ts asks git rev-parse --git-common-dir | `rg -n "^export function marksDir\|^function gitCommonDir\|\^gitdir:\|join\(dir, \".git\"\)\|const parent = dirname\(dir\)\|--git-common-dir\"" src/costs.ts src/hooklog.ts src/paths.ts` | costs 158 marksDir, 164 `join(dir, ".git")`, 170 `/^gitdir:\s*(.+)$/m`, 180 `dirname(dir)`; hooklog 112 gitCommonDir, 115, 120, 130 the same; paths 187, 194 `["rev-parse", "--git-common-dir"...]` (paths 77 is findStore's walk for `.mstack`, not a git lookup) | T |

### Acceptance criteria not yet true at the head

| # | Criterion | How it was checked | Output |
|---|---|---|---|
| A1 | one execFileSync("git") ("five today: git.ts, ledger.ts twice and worktree.ts twice") | C2 | five, as listed |
| A2 | on a detached head the gate no longer prints "on branch HEAD" ("it does today") | C5 | `[ok] on branch HEAD` |
| A3 | rg `\^gitdir:` finds only the module ("costs.ts and hooklog.ts today"); paths.ts no longer runs --git-common-dir ("twice today") | `rg -n "\^gitdir:" src`; `rg -n "\"--git-common-dir\"" src` | costs.ts:170, hooklog.ts:120; paths.ts:187, 194 |
| A4 | the four branch states and a linked worktree's git dir are tested at the module | there is no workspace module (A1) | |

### Cut, and why

- "22 call sites in seven modules" and "two incompatible ways". The count was true only under
  its own definition, and nine more sites reach git through headSha and defaultBranch (round 2
  review). The item now names the parallel paths instead of counting them.
- "No git, no commits and detached are told apart in gate.ts ... collapsed to UNKNOWN_TREE in
  verification.ts". False for a detached head (round 2 review, blocking 3). It is replaced by
  the one difference reproduced on the real CLI (C5). The verification.ts claim is dropped
  rather than reworded: it is not needed for the candidate.
- hooklog in acceptance 2's caller list. hooklog does not run git, and its git-dir walk is
  covered by acceptance 3.
- "statusline formatting tests no longer need a real repo". Not shown.
- "opens with", which was true only after the imports, so it became "the header comment
  says". "The git dir is found three ways, for two different questions" became what each of
  the three does. Every line number.

### Final

```
id: 79
slug: workspace-facts
title: Git is run outside git.ts, which calls itself the one place that does, and gate, statusline and worktree each ask git for the branch or the dirty state on their own
status: pending
source: deepen playbook run, 2026-11-17, .mstack/progress/deepen_2026-11-17.md
description: The header comment of src/git.ts says "The one place this repository shells out to git.", but ledger.ts (isCommit, resolveSha) and worktree.ts (isDirty, run) call execFileSync("git") themselves. git() returns null on any failure and passes a 5 s timeout; worktree.ts run throws a UserError and passes no timeout. The same question gets separate answers: the branch is read with rev-parse --abbrev-ref HEAD in gate.ts checkWorkspace and in statusline.ts, and dirty is git status --porcelain in checkWorkspace and git status --porcelain --ignored=matching in worktree.ts isDirty. On a detached head the gate prints "[ok] on branch HEAD" while the status line shows no branch. costs.ts marksDir and hooklog.ts gitCommonDir each walk up to .git and parse a gitdir: line by hand, and paths.ts asks git rev-parse --git-common-dir. Deepen into one module that answers workspace questions. Claims checked in .mstack/progress/impl_deep-module-vocabulary_r3.md.
acceptance:
  - rg 'execFileSync\("git"' src finds exactly one call, inside the workspace module (five today: git.ts, ledger.ts twice and worktree.ts twice)
  - the workspace module answers branch state (no git, no commits, detached, on a branch), head and dirty, and gate.ts, statusline.ts and worktree.ts take those answers from it; on a detached head the gate no longer prints "on branch HEAD" (it does today)
  - the git directory and the common git directory are found only in that module: rg "\^gitdir:" src finds only that module (costs.ts and hooklog.ts today), and paths.ts no longer runs rev-parse --git-common-dir itself (twice today)
  - the four branch states and the git directory of a linked worktree are tested at the module's interface against temporary repositories
seams:
  - the workspace module
```

### Why the candidate still stands

git.ts is a thin pass-through, and the module it claims to be does not exist. Four calls bypass
it with their own failure and timeout rules (C2, C3), and the branch, dirty and git-dir
questions are each answered in two or three places (C4, C6). Those answers already disagree on
the real CLI for a detached head (C5).

---

## Item 80 `tsv-record-shape`

### Before

```
title: Ledger, decisions and verification each write their column list four times, costs three, and a reordered header silently misaligns rows
description: ledger (ledger.ts:37 HEADER, 43 Entry, 135-142 positional append, 146-157 read-back mapping), decisions (decisions.ts:10, 12, 59-67, 72-81) and verification (verification.ts:45, 77, 314-321, 325-333) repeat the interface, HEADER, positional append array and read-back mapping; costs has no row interface for costs.tsv (CostRow at costs.ts:866 is a summary) and repeats three: HEADER at 58, the positional array at 773 and string-key reads at 879-890. setup.ts imports each HEADER (setup.ts:7-9, used at 149-153), so it is not a copy. costs.ts:907 reads ledger rows by string key past ledger.entries. A reordered header misaligns rows with no error: with ledger.tsv's sha and target swapped in its header, tsv.append with ledger's HEADER stores the target under sha (ensureHeader returns silently on a non-prefix header, tsv.ts:53). Deepen into a record-typed table defined once per store, over the store-file module (item 78). Adjacent: 65 adds a column to verification. Evidence: .mstack/progress/explore_persistence.md F2, F3; claims re-derived in .mstack/progress/impl_deep-module-vocabulary_r2.md.
acceptance:
  - each store declares its columns once, and append and read go through that declaration; no positional row array remains in ledger.ts, decisions.ts, verification.ts or costs.ts
  - no module reads another store's rows by string key; costs uses ledger's reader instead of costs.ts:907
  - a test at the table interface appends to a file whose header is reordered and gets a refusal, not a misaligned row, and covers adding a column to an old file with the narrower header; the cell and row tests it absorbs are deleted
seams:
  - the table declaration
```

### Claims in the final text

| # | Assertion | Command | Output | |
|---|---|---|---|---|
| C1 | each of the four files writes its columns four times: HEADER, a row type (Entry, Decision, Receipt, and NewRow in costs.ts, which leaves out ts), the positional array handed to tsv append (ledger.record, decisions.add, verification.record, emit in costs.ts), the string keys its reader takes from readRecords (ledger.entries, decisions.all, verification.receipts, costs.summarize) | one `rg -n` over the four files (appendix C1); `bat` costs.ts 643:653, 772:787, ledger.ts 146:156, costs.ts 879:881 | HEADER at ledger 37, decisions 10, verification 45, costs 58. Types: Entry 43, Decision 12, Receipt 77, NewRow 643, whose fields are run to source, with no ts. Arrays: ledger 135 in record (105), decisions 59 in add (49), verification 314 in record (312), costs 773 `written.push([` in `emit` (772). Readers: entries 146-156 `r["target"]`..., all 72-73, receipts 325-326, summarize 877/879-881 `r["target"]`, `r["role"]` | T |
| C2 | costs.ts verifierFailed reads ledger.tsv by string key rather than through ledger.entries | `rg -n "readRecords\(store\.ledger\)" src`; `bat` costs.ts 906:907 | ledger.ts:147 and costs.ts:907 `readRecords(store.ledger).filter((r) => r["target"] === slug && r["verdict"] === ...)` in `verifierFailed` (906) | T |
| C3 | ensureHeader returns without a word when the file's header is not a prefix of the caller's | `bat -pp --line-range 50:53 src/tsv.ts` | 51 returns when the file's header is as long or longer, 53 `if (!isPrefix) return;` when it is shorter. There is no throw or message on either path | T |
| C4 | with sha and target swapped in ledger.tsv's header, `ledger record demo <sha>` exits 0 and stores demo under sha, and `ledger check demo` reports no verdict | live, `reorder80` | `recorded test-verified for demo` `[exit 0]`; file row `demo<TAB><40-hex sha>...` under `sha<TAB>target`; `FAIL no verdict recorded for demo` | T |
| (ref) | "the store-file module of item 78" | `state list` | `78 durable-store-file (pending)` | T |

### Acceptance criteria not yet true at the head

| # | Criterion | How it was checked | Output |
|---|---|---|---|
| A1 | no positional row array is built in the four files ("today ... each build one") | C1 | four arrays |
| A2 | rg `readRecords\(store\.ledger\)` finds only ledger.ts ("also finds costs.ts verifierFailed today") | C2 | ledger.ts:147, costs.ts:907 |
| A3 | a reordered header gets a refusal; ledger record refuses ("today it exits 0 and stores the target under sha") | C4 | exit 0, misaligned |

### Cut, and why

- "costs has no row interface ... repeats three". False: NewRow is its row type (round 2
  review, blocking 4). costs is now one of four.
- "Adjacent: 65 adds a column to verification". False (item 65 says no such thing).
- The setup.ts sentence and the CostRow note. Neither is needed.
- "the cell and row tests it absorbs are deleted". Not argued.
- Every line number.

### Final

```
id: 80
slug: tsv-record-shape
title: Ledger, decisions, verification and costs each spell their columns four times, and a reordered header silently misaligns rows
status: pending
source: deepen playbook run, 2026-11-17, .mstack/progress/deepen_2026-11-17.md
description: Each of ledger.ts, decisions.ts, verification.ts and costs.ts writes its columns out four times: a HEADER array, a row type (Entry, Decision, Receipt, and in costs.ts NewRow, which leaves out ts), the positional array it hands to tsv append (ledger.record, decisions.add, verification.record, the emit function in costs.ts), and the string keys its reader takes from readRecords (ledger.entries, decisions.all, verification.receipts, costs.summarize). costs.ts verifierFailed also reads ledger.tsv by string key rather than through ledger.entries. tsv ensureHeader returns without a word when the file's header is not a prefix of the caller's, so with ledger.tsv's sha and target swapped in its header, mstack ledger record demo <sha> exits 0 and stores demo under sha, and mstack ledger check demo then reports no verdict. Deepen into a table declared once per store that append and read go through, over the store-file module of item 78. Claims checked in .mstack/progress/impl_deep-module-vocabulary_r3.md.
acceptance:
  - each store declares its columns once, and append and read go through that declaration: no positional row array is built in ledger.ts, decisions.ts, verification.ts or costs.ts (today ledger.record, decisions.add, verification.record and emit in costs.ts each build one)
  - no module reads another store's rows by string key: rg "readRecords\(store\.ledger\)" src finds only ledger.ts (it also finds costs.ts verifierFailed today)
  - a test at the table interface appends to a file whose header is reordered and gets a refusal with the file unchanged, and appends to a file with a narrower old header and gets the header widened; with ledger.tsv's sha and target swapped, mstack ledger record refuses (today it exits 0 and stores the target under sha)
seams:
  - the table declaration
```

### Why the candidate still stands

This is duplication with no check. Each store's column order is written four times and kept in
step by hand (C1). Nothing compares the file's order with the writer's (C3), and the real CLI
records a verdict that its own `ledger check` cannot find (C4).

---

## Commands

```
$ ./bin/mstack gate
-- store
[ok]    state.json exists
[ok]    progress/current.md exists
[ok]    progress/history.md exists
[ok]    state.json parses and has the right shape (80 items)

-- state
[ok]    ids are unique
[ok]    slugs are unique
[ok]    every item has at least one acceptance criterion
[ok]    one active item: deep-module-vocabulary (in_progress)
[ok]    progress/current.md tracks the active item
[ok]    4 open item(s) with a decision fork, each answered or still in specifying
[ok]    no sdd item is past specifying
[ok]    36 closed item(s) carry a ledger verdict
[ok]    deep-module-vocabulary is in_progress; a verification run is due at verifying

-- workspace
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[ok]    on branch feat/deep-module-vocabulary
[warn]  1 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 1 warning
exit 0

$ ./bin/mstack state list | rg "^ *(76|77|78|79|80) "
  76 item-transition-module (pending)  The rules for moving an item between statuses are composed inside cmdState in cli.ts, which tests can reach only by spawning the CLI
  77 item-readiness-reading (pending)  The active item is searched for at nine sites beside activeItem, and commands answer differently when two items are active or state.json cannot be parsed
  78 durable-store-file (pending)  Whether a store write takes the lock is each caller's choice, and ledger and verification rows are appended without it
  79 workspace-facts (pending)  Git is run outside git.ts, which calls itself the one place that does, and gate, statusline and worktree each ask git for the branch or the dirty state on their own
  80 tsv-record-shape (pending)  Ledger, decisions, verification and costs each spell their columns four times, and a reordered header silently misaligns rows
```

The gate and `git diff` are run once more after the report commit. Their output is in the
closing section.

The test suite was not run. No file outside `.mstack/` changed, so there is nothing for it to
judge.

## R to test (round 3 brief)

| Requirement | Where it is shown |
|---|---|
| every assertion left in items 76 to 80 has a row marked T | the five claim tables above; the full output in the appendix, produced after the final edit |
| acceptance criteria stay observable and none is already true | the five "not yet true" tables |
| statements about other items are checked with state show | 76 none; 77 C7 (item 69); 78 C6 (66, 68); 80 (ref) (78); 79 none |
| the candidate still stands, or the item is cancelled | "Why the candidate still stands" per item; none cancelled |
| gate green; five items pending | Commands |
| nothing outside the store changed | closing section |

Evidence rung: the behavioural claims (C8 and C9 of 76, C5 and C6 of 77, C3 of 78, C5 of 79,
C4 of 80) were reproduced on this checkout's real CLI in throwaway stores (rung 5, on those
stores, not on this repository's store). Every structural claim is a search over all of `src`
or `tests`, or a read of the named lines (rung 2). A search that comes back with nothing is
exhaustive only for the pattern given, so each pattern is pasted beside its claim.

## Appendix: check output after the final edit

Produced by `checks.sh 76` to `checks.sh 80` (scratch directory above), run once after the
last `state set`. Live stores are recreated by each run, so pids and shas differ from earlier
runs.

### Item 76: checks.sh 76

```

#### C0 source file exists
$ fd -t f "deepen_2026-11-17.md" .mstack/progress
.mstack/progress/deepen_2026-11-17.md
[exit 0]

#### C1 state set --status is handled inline in cmdState (cmdState starts at 379, the next function at 794; the status block at 565)
$ rg -n "^function cmdState|^function cmdLedger|if \(values.status !== undefined\)" src/cli.ts
379:function cmdState(argv: readonly string[]): number {
565:      if (values.status !== undefined) {
794:function cmdLedger(argv: readonly string[]): number {
[exit 0]

#### C2 refuses a move to a status that requiresDecision while the fork is unanswered; C3 refuses a move canTransition rejects
$ bat -pp --line-range 571:587 src/cli.ts
571	        if (
572	          requiresDecision(values.status) &&
573	          (item.decision_required ?? "") !== "" &&
574	          (item.decision_resolved ?? "") === "" &&
575	          values.force !== true
576	        ) {
577	          throw new UserError(
578	            `${item.slug} has an unanswered decision: "${item.decision_required}"`,
579	            "answer it with 'mstack decide --resolves " + item.slug + " ...' first",
580	          );
581	        }
582	        if (!canTransition(item.status, values.status) && values.force !== true) {
583	          throw new UserError(
584	            `${item.status} -> ${values.status} is not a legal transition`,
585	            "pass --force if you mean to skip a phase, and say why in decisions.tsv",
586	          );
587	        }

#### C4 refuses a close closingProblems objects to; --force passes an overridable objection only with --closed-by
$ bat -pp --line-range 595:638 src/cli.ts
595	        if (values.status === "done" && item.status !== "done") {
596	          const problems = closingProblems(store, state, item);
597	          const stuck = problems.find((p) => !p.overridable);
598	          if (stuck !== undefined) {
599	            // Never overridable: --force vouches for a finding, not for a failure to look.
600	            throw new UserError(`${item.slug} cannot close: ${stuck.message}`, stuck.hint);
601	          }
602	          // The wording stays specific while the only problems are verification
603	          // ones, which is what every message here said before there was a second check.
604	          const verificationOnly = problems.every((p) => p.check === VERIFICATION_CHECK);
605	          const summary = problems.map((p) => p.message).join("; ");
606	          if (problems.length > 0) {
607	            if (values.force !== true) {
608	              throw new UserError(
609	                verificationOnly
610	                  ? `${item.slug} cannot close on a verification that has not run: ${summary}`
611	                  : `${item.slug} cannot close: ${summary}`,
612	                verificationOnly
613	                  ? "run 'mstack gate --full' at this commit; closing is the one moment the run has to be real, and --force closes it unverified"
614	                  : `${problems[0]?.hint ?? ""}; --force closes it anyway`,
615	              );
616	            }
617	            // The forced line used to be pushed into `changes` and nothing else,
618	            // and `changes` is only ever printed. So an override of the one check
619	            // standing between an unverified item and `done` left nothing behind
620	            // in state.json, ledger.tsv or decisions.tsv, and no later reader
621	            // could tell a forced close from a real one. That is the `closed_by`
622	            // shape this plugin already had to fix once, rebuilt inside the guard
623	            // meant to prevent it.
624	            //
625	            // `closed_by` is the right home: committed, already typed as a note
626	            // rather than a verdict, and this is exactly a note. The reason is
627	            // required rather than optional, because an override nobody has to
628	            // justify is the escape hatch with better manners.
629	            if (values["closed-by"] === undefined) {
630	              throw new UserError(
631	                verificationOnly
632	                  ? `--force would close ${item.slug} on a verification that has not run, and that has to be on the record`
633	                  : `--force would close ${item.slug} past a failed closing check, and that has to be on the record`,
634	                `add --closed-by "<why closing unverified is right here>"; it is stored in state.json as "${FORCED_UNVERIFIED}...", where the next reader will find it`,
635	              );
636	            }
637	            forcedUnverified = summary;
638	          }

#### C5 writes the FORCED_UNVERIFIED marker into closed_by, and keeps it on a later --closed-by
$ bat -pp --line-range 665:667 src/cli.ts
665	        const marked =
666	          key === "closed_by" && (item.closed_by ?? "").startsWith(FORCED_UNVERIFIED) ? `${FORCED_UNVERIFIED}${next}` : next;
667	        item[key] = marked;
$ bat -pp --line-range 681:685 src/cli.ts
681	      if (forcedUnverified !== undefined) {
682	        const note = `${FORCED_UNVERIFIED}${item.closed_by ?? ""}`;
683	        changes.push(...fieldChange("closed_by", closedByBefore, note));
684	        item.closed_by = note;
685	        changes.push(`  forced: closed on a verification that did not run here - ${forcedUnverified}`);

#### C6 lifecycle.ts holds the status lists, TRANSITIONS and six predicates, none of which takes an item
$ rg -n "^export" src/lifecycle.ts
10:export const STATUSES = [
22:export type Status = (typeof STATUSES)[number];
25:export const ACTIVE_STATUSES = [
34:export const SPEC_REQUIRED_FROM = [
49:export const DECISION_REQUIRED_FROM = [
77:export const VERIFICATION_REQUIRED_FROM = ["verifying"] as const satisfies readonly Status[];
79:export const TERMINAL_STATUSES = ["done", "cancelled"] as const satisfies readonly Status[];
85:export const TRANSITIONS: Readonly<Record<Status, readonly Status[]>> = {
97:export function isStatus(value: unknown): value is Status {
101:export function isActive(status: Status): boolean {
105:export function requiresSpecArtifacts(status: Status): boolean {
109:export function requiresDecision(status: Status): boolean {
113:export function requiresVerification(status: Status): boolean {
117:export function canTransition(from: Status, to: Status): boolean {
[exit 0]

#### C7 in src, cmdState (379-793) is the only caller of canTransition
$ rg -n "canTransition\(" src
src/cli.ts:582:        if (!canTransition(item.status, values.status) && values.force !== true) {
src/lifecycle.ts:117:export function canTransition(from: Status, to: Status): boolean {
[exit 0]

#### C8 cmdState treats any non-empty decision_resolved as answered; C9 the gate also requires a matching decisions.tsv row (live)
$ /Users/romerma/Code/mstack/bin/mstack state add --slug fork --title 'a fork item' --decision-required 'x or y' && /Users/romerma/Code/mstack/bin/mstack state set fork --status specifying
added 1 fork (pending)
1 fork (specifying)
  status: "pending" -> "specifying"
[exit 0]
$ /Users/romerma/Code/mstack/bin/mstack state set fork --status spec_ready
mstack: fork has an unanswered decision: "x or y"
        answer it with 'mstack decide --resolves fork ...' first
[exit 2]
(decision_resolved set by hand to 2020-01-01T00:00:00.000Z)
$ bat -pp .mstack/decisions.tsv
ts	phase	decision	why	evidence	result	resolves
[exit 0]
$ /Users/romerma/Code/mstack/bin/mstack state set fork --status spec_ready
1 fork (spec_ready)
  status: "specifying" -> "spec_ready"
[exit 0]
$ /Users/romerma/Code/mstack/bin/mstack gate --quiet 2>&1 | rg 'points at decision'
[fail]  1 fork (spec_ready) points at decision 2020-01-01T00:00:00.000Z, and no row with that timestamp resolves fork -> the row is the evidence; a pointer to one that does not say anything is not an answer
[exit 0]
$ bat -pp --line-range 307:311 src/gate.ts
307	    // Matched on the pair, not on the timestamp. A row has to say which fork it
308	    // answers, or any row answers any fork.
309	    const match = rows.filter((row) => row.ts === answer && row.resolves === item.slug);
310	    if (match.length === 0) {
311	      bad.push(`${itemLabel(item)} points at decision ${answer}, and no row with that timestamp resolves ${item.slug}`);

#### C10 cli.ts exports only FORCED_UNVERIFIED
$ rg -n "^export" src/cli.ts
223:export const FORCED_UNVERIFIED = "closed unverified (forced): ";
[exit 0]

#### C11 no test imports cli.ts
$ rg -n "src/cli\.ts['\"]" tests | rg import
[exit 1]

#### C12 cli.test.ts, closing.test.ts, decisions.test.ts assert these refusals on a spawned CLI's stderr
$ rg -n "stderr.*(not a legal transition|unanswered decision|cannot close)" tests
tests/cli.test.ts:308:    assert.match(illegal.stderr, /in_progress -> done is not a legal transition/);
tests/cli.test.ts:632:    assert.match(refused.stderr, /cannot close on a verification that has not run/);
tests/closing.test.ts:124:    assert.match(refused.stderr, /storage-layer cannot close: a second closing check is not satisfied/);
tests/closing.test.ts:153:    assert.match(forced.stderr, /cannot close: a second closing check is not satisfied/);
tests/closing.test.ts:171:    assert.match(refused.stderr, /cannot close: a second closing check is not satisfied/);
tests/closing.test.ts:222:    assert.ok(refused.stderr.includes(`storage-layer cannot close: ${problems[0]!.message}`), refused.stderr);
tests/closing.test.ts:295:    assert.ok(refused.stderr.includes(`storage-layer cannot close: ${found[0]!.message}`), refused.stderr);
tests/decisions.test.ts:116:    assert.match(refused.stderr, /unanswered decision/);
tests/decisions.test.ts:188:    assert.match(refused.stderr, /unanswered decision/);
tests/decisions.test.ts:331:      assert.match(refused.stderr, /unanswered decision/);
[exit 0]
$ rg -n "spawnSync\(BIN|execFileSync\(MSTACK" tests/cli.test.ts tests/closing.test.ts tests/decisions.test.ts
tests/decisions.test.ts:18:    const stdout = execFileSync(MSTACK, [...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
tests/cli.test.ts:29:  const result = spawnSync(BIN, [...args], {
tests/closing.test.ts:16:  const r = spawnSync(BIN, args, { cwd, encoding: "utf8" });
[exit 0]

#### A1 not yet true: cli.ts calls canTransition and closingProblems once each
$ rg -n "canTransition\(|closingProblems\(" src/cli.ts
582:        if (!canTransition(item.status, values.status) && values.force !== true) {
596:          const problems = closingProblems(store, state, item);
[exit 0]

#### A2 not yet true: see C8/C9 (state set exits 0, the gate fails)

#### A3 not yet true: FORCED_UNVERIFIED on four lines of cli.ts
$ rg -n FORCED_UNVERIFIED src/cli.ts
223:export const FORCED_UNVERIFIED = "closed unverified (forced): ";
634:                `add --closed-by "<why closing unverified is right here>"; it is stored in state.json as "${FORCED_UNVERIFIED}...", where the next reader will find it`,
666:          key === "closed_by" && (item.closed_by ?? "").startsWith(FORCED_UNVERIFIED) ? `${FORCED_UNVERIFIED}${next}` : next;
682:        const note = `${FORCED_UNVERIFIED}${item.closed_by ?? ""}`;
[exit 0]

#### A4 not yet true: no transition module exists to test; the refusals are asserted only on spawned CLIs (C12)
```

### Item 77: checks.sh 77

```

#### C1 activeItem returns the first active item, undefined when parseState throws
$ bat -pp --line-range 354:360 src/state.ts
354	export function activeItem(store: Store): Item | undefined {
355	  try {
356	    return parseState(store.state).items.find((item) => isActive(item.status));
357	  } catch {
358	    return undefined;
359	  }
360	}

#### C2 nine other sites search or filter state.items with isActive (12 matches minus the definition, activeItem and the list marker)
$ rg -n "isActive\(" src
src/hooks.ts:109:    return parseState(store.state).items.find((i) => isActive(i.status));
src/statusline.ts:103:  const active = state.items.filter((item) => isActive(item.status));
src/statusline.ts:328:    return parseState(store.state).items.filter((item) => isActive(item.status)).length > 1;
src/cli.ts:403:      console.log(`${isActive(item.status) ? "*" : " "} ${itemLabel(item)}  ${item.title}`);
src/cli.ts:410:    const item = parseState(store.state).items.find((i) => isActive(i.status));
src/cli.ts:1009:  const target = values.target ?? parseState(store.state).items.find((i) => isActive(i.status))?.slug;
src/lifecycle.ts:101:export function isActive(status: Status): boolean {
src/costs.ts:319:  return { on: state.rules.record_costs, slug: state.items.find((i) => isActive(i.status))?.slug ?? null };
src/gate.ts:222:  const active = state.items.filter((i) => isActive(i.status));
src/gate.ts:602:  const active = state.items.find((i) => isActive(i.status));
src/gate.ts:659:  const active = state.items.find((i) => isActive(i.status));
src/state.ts:356:    return parseState(store.state).items.find((item) => isActive(item.status));
[exit 0]

#### C3 the enclosing functions: hooks.ts activeItemOrLog, cli.ts state active and cmdMergeGate, costs.ts activeSlug, statusline.ts ambiguous
$ rg -n "^function activeItemOrLog|^function cmdMergeGate|^function cmdLedger|^function cmdCost|^function activeSlug|^function ambiguous|if \(sub === \"active\"\)|if \(sub === \"list\"" src/hooks.ts src/cli.ts src/costs.ts src/statusline.ts
src/statusline.ts:326:function ambiguous(store: Store): boolean {
src/cli.ts:398:  if (sub === "list" || sub === undefined) {
src/cli.ts:408:  if (sub === "active") {
src/cli.ts:794:function cmdLedger(argv: readonly string[]): number {
src/cli.ts:945:  if (sub === "list" || sub === undefined) {
src/cli.ts:993:function cmdMergeGate(argv: readonly string[]): number {
src/cli.ts:1023:function cmdCost(argv: readonly string[]): number {
src/hooks.ts:107:function activeItemOrLog(store: Store): Item | undefined {
src/costs.ts:317:function activeSlug(store: Store): { on: boolean; slug: string | null } {
[exit 0]

#### C4 live: two items in_progress
$ /Users/romerma/Code/mstack/bin/mstack state add --slug first --title first >/dev/null && /Users/romerma/Code/mstack/bin/mstack state add --slug second --title second >/dev/null && /Users/romerma/Code/mstack/bin/mstack state set first --status in_progress >/dev/null && /Users/romerma/Code/mstack/bin/mstack state set second --status in_progress >/dev/null
[exit 0]
$ /Users/romerma/Code/mstack/bin/mstack state active
first
[exit 0]
$ /Users/romerma/Code/mstack/bin/mstack fanout plan --kind review --worker a | head -1
review fan-out on first, 1 worker(s):
[exit 0]
$ echo {} | mstack statusline
main · 2 active items


#### C5 live: one item in_progress beside one whose status is bogus
$ node -e 'const s=JSON.parse(require("fs").readFileSync(".mstack/state.json","utf8"));console.log(s.items.map(i=>i.slug+":"+i.status).join(" "))'
first:bogus second:in_progress
[exit 0]
$ /Users/romerma/Code/mstack/bin/mstack fanout plan --kind review --worker a
mstack: no active item to fan out on
[exit 2]
$ /Users/romerma/Code/mstack/bin/mstack state active
mstack: /private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl57r3/broken77/.mstack/state.json .items[0].status is "bogus"
        see the lifecycle in the mstack README for the valid set
[exit 2]
$ echo {} | mstack statusline
main · state.json unreadable


#### C6 fanout plan reaches activeItem; the parse error comes from parseState
$ rg -n "activeItem\(store\)" src/fanout.ts
67:  const item = activeItem(store);
[exit 0]
$ rg -n "valid set" src/state.ts
191:      "see the lifecycle in the mstack README for the valid set",
[exit 0]

#### C7 item 69: session-start prints 'No active work item' on an unreadable state.json
$ /Users/romerma/Code/mstack/bin/mstack state show 69 | rg 'No active work item'
title: Hook log follow-ups from the item 54 reviews: two lint faults, a false 'No active work item', recording unproven in a real session
description: Item 54 closed with non-blocking findings, each run by a reviewer. lint-plugin refuses a foreign hook whose args start with 'hook', and crashes on a hooks.json containing null (on the base code too). session-start on an unreadable state.json logs the failure but still prints 'No active work item'. A store created before item 54 whose .git/info/exclude could not be edited shows the log as untracked and nothing says so. The isDirectory guard in src/hooklog.ts is redundant now that the exclude edit follows the append. Nothing has run these hooks inside a real Claude Code session: the evidence stops at real hook processes on throwaway stores, and .mstack/costs.tsv still holds only its header because no session since 2026-11-08 has loaded the plugin.
  - session-start on an unreadable state.json says the store could not be read instead of 'No active work item'
[exit 0]

#### A1 not yet true: nine sites besides lifecycle.ts, activeItem and the list marker (C2)

#### A2/A3 not yet true: C4 and C5

#### A4 not yet true: no test calls activeItem
$ rg -n "activeItem" tests
[exit 1]
```

### Item 78: checks.sh 78

```

#### C1 withLock is called by state.ts updateState, decisions.ts and four times by costs.ts
$ rg -n "withLock\(" src
src/decisions.ts:53:  return withLock(store.decisions, () => {
src/costs.ts:287:  withLock(file, () => appendFileSync(file, `${JSON.stringify(value)}\n`, "utf8"));
src/costs.ts:425:  withLock(file, () => {
src/costs.ts:754:  return withLock(
src/costs.ts:764:      withLock(marks, () => {
src/state.ts:289:  return withLock(file, () => {
[exit 0]
$ bat -pp --line-range 288:289 src/state.ts
288	export function updateState<T>(file: string, change: (state: State) => T): T {
289	  return withLock(file, () => {

#### C2 ledger.record and verification.record call tsv append directly, with no lock in their files
$ rg -n "withLock|append\(store\." src/ledger.ts src/verification.ts
src/ledger.ts:135:  append(store.ledger, HEADER, [
src/verification.ts:36: * `record` appends without `withLock`, unlike `decisions.add`, so it shares
src/verification.ts:314:  append(store.verification, HEADER, [
[exit 0]

#### C3 live: ledger.tsv.lock and decisions.tsv.lock held by a live process
(owner pid 86661, alive: yes)
$ time /Users/romerma/Code/mstack/bin/mstack ledger record demo $(git rev-parse HEAD) test-verified --evidence 'probe for item 78' --verifier reviewer
recorded test-verified for demo at 088ef453

real	0m0.061s
user	0m0.032s
sys	0m0.020s
[exit 0]
$ bat -pp .mstack/ledger.tsv
target	sha	verdict	evidence	verifier	ts
demo	088ef453ca464249a87cd1bb01fe98dc5d2c7176	test-verified	probe for item 78	reviewer	2026-11-17T17:38:50.591Z
[exit 0]
$ time /Users/romerma/Code/mstack/bin/mstack decide --phase probe --decision 'a probe decision' --why 'probe for item 78 lock' --evidence 'lock78 scratch store' --result 'probe only'
mstack: /private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl57r3/lock78/.mstack/decisions.tsv.lock is held by pid 86661 and did not let go in 2001 ms
        wait for pid 86661 to finish, or stop it; if it is not an mstack process, remove /private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl57r3/lock78/.mstack/decisions.tsv.lock

real	0m2.037s
user	0m0.035s
sys	0m0.047s
[exit 2]

#### C4 verification.ts says the omission is deliberate (quoted)
$ rg -n "Locking one of the two would leave the codebase|inconsistent about a race present in both" src/verification.ts
38: * same helper the same way. Locking one of the two would leave the codebase
39: * inconsistent about a race present in both. Review probed it with eight
[exit 0]

#### C5 three temporary-and-rename implementations: state.ts writeAtomically, costs.ts prune, hooklog.ts trim
$ rg -n "renameSync\(" src
src/costs.ts:451:    renameSync(tmp, file);
src/hooklog.ts:81:    renameSync(tmp, log);
src/state.ts:317:    renameSync(tmp, file);
[exit 0]
$ rg -n "STATE_TMP_PREFIX = " src/state.ts
270:export const STATE_TMP_PREFIX = ".tmp-";
[exit 0]
$ bat -pp --line-range 308:323 src/state.ts
308	function writeAtomically(file: string, text: string): void {
309	  const tmp = join(dirname(file), `${basename(file)}${STATE_TMP_PREFIX}${process.pid}-${tmpCounter++}`);
310	  try {
311	    const fd = openSync(tmp, "wx");
312	    try {
313	      writeFileSync(fd, text);
314	    } finally {
315	      closeSync(fd);
316	    }
317	    renameSync(tmp, file);
318	  } catch (error) {
319	    try {
320	      rmSync(tmp, { force: true });
321	    } catch {
322	      // the original failure is the one to report
323	    }
$ bat -pp --line-range 449:452 src/costs.ts
449	    const tmp = `${file}.tmp`;
450	    writeFileSync(tmp, lines.map((l) => `${JSON.stringify(l)}\n`).join(""), "utf8");
451	    renameSync(tmp, file);
452	  });
$ bat -pp --line-range 75:85 src/hooklog.ts
75	function trim(log: string): void {
76	  const all = readFileSync(log, "utf8").split("\n").filter((l) => l !== "");
77	  if (all.length <= MAX_LINES) return;
78	  const tmp = `${log}.${process.pid}.tmp`;
79	  try {
80	    writeFileSync(tmp, `${all.slice(-MAX_LINES).join("\n")}\n`, "utf8");
81	    renameSync(tmp, log);
82	  } finally {
83	    rmSync(tmp, { force: true });
84	  }
85	}
$ rg -n "^function writeAtomically|^export function prune|^function trim" src/state.ts src/costs.ts src/hooklog.ts
src/hooklog.ts:75:function trim(log: string): void {
src/costs.ts:422:export function prune(file: string, beforeLock?: () => void): void {
src/state.ts:308:function writeAtomically(file: string, text: string): void {
[exit 0]

#### C6 items 66 and 68 as cited
$ /Users/romerma/Code/mstack/bin/mstack state show 66 | rg '^title'
title: Lock follow-ups from the item 52 reviews: one accepted window, one unsafe cleanup, leftovers in the store
[exit 0]
$ /Users/romerma/Code/mstack/bin/mstack state show 68 | rg -o 'updateState renames a new file over the target, so a symlinked state.json becomes a regular file'
updateState renames a new file over the target, so a symlinked state.json becomes a regular file
[exit 0]

#### A1 not yet true: C2 and C3

#### A2 not yet true: three renameSync calls (C5)

#### A3 not yet true: no ledger or verification test holds a lock
$ rg -n "withLock|\.lock" tests/ledger.test.ts tests/ledger-cli.test.ts tests/verification.test.ts
[exit 1]
```

### Item 79: checks.sh 79

```

#### C1 the header comment of git.ts says 'The one place this repository shells out to git.'
$ bat -pp --line-range 1:6 src/git.ts
1	import { execFileSync } from "node:child_process";
2	
3	import type { Store } from "./paths.ts";
4	
5	/**
6	 * The one place this repository shells out to git.

#### C2 ledger.ts (isCommit, resolveSha) and worktree.ts (isDirty, run) call execFileSync("git") themselves
$ rg -n 'execFileSync\("git"' src
src/git.ts:63:    const out = execFileSync("git", args, {
src/ledger.ts:57:    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
src/ledger.ts:82:    const full = execFileSync("git", ["rev-parse", "--verify", "--quiet", `${sha}^{commit}`], {
src/worktree.ts:81:    const out = execFileSync("git", ["status", "--porcelain", "--ignored=matching"], {
src/worktree.ts:152:    return execFileSync("git", args, { cwd: store.root, encoding: "utf8" }).trim();
[exit 0]
$ rg -n "^function isCommit|^export function resolveSha|^function isDirty|^function run" src/ledger.ts src/worktree.ts
src/worktree.ts:79:function isDirty(path: string): boolean {
src/worktree.ts:150:function run(store: Store, args: readonly string[]): string {
src/ledger.ts:55:function isCommit(store: Store, sha: string): boolean {
src/ledger.ts:79:export function resolveSha(store: Store, sha: string): string | undefined {
[exit 0]

#### C3 git() returns null on any failure with a 5 s timeout; worktree.ts run throws a UserError with no timeout
$ rg -n "GIT_TIMEOUT_MS" src/git.ts
21:const GIT_TIMEOUT_MS = 5_000;
68:      timeout: GIT_TIMEOUT_MS,
[exit 0]
$ bat -pp --line-range 73:75 src/git.ts
73	  } catch {
74	    return null;
75	  }
$ bat -pp --line-range 150:156 src/worktree.ts
150	function run(store: Store, args: readonly string[]): string {
151	  try {
152	    return execFileSync("git", args, { cwd: store.root, encoding: "utf8" }).trim();
153	  } catch (error) {
154	    throw new UserError(`git ${args.join(" ")} failed`, (error as Error).message.split("\n")[0]);
155	  }
156	}

#### C4 branch read with rev-parse --abbrev-ref HEAD in gate.ts checkWorkspace and statusline.ts; dirty with different flags in checkWorkspace and worktree.ts isDirty
$ rg -n "\"--abbrev-ref\", \"HEAD\"|\"status\", \"--porcelain\"" src
src/statusline.ts:90:  const branch = git(store, ["rev-parse", "--abbrev-ref", "HEAD"]);
src/gate.ts:570:  const branch = git(store, ["rev-parse", "--abbrev-ref", "HEAD"]);
src/gate.ts:581:  const dirty = git(store, ["status", "--porcelain"]);
src/worktree.ts:81:    const out = execFileSync("git", ["status", "--porcelain", "--ignored=matching"], {
[exit 0]
$ rg -n "^function checkWorkspace" src/gate.ts
562:function checkWorkspace(store: Store, report: Report): void {
[exit 0]
$ bat -pp --line-range 586:592 src/gate.ts
586	    report.ok("working tree is clean");
587	  }
588	}
589	
590	/**
591	 * Has this item's verification actually been executed, here, at this commit?
592	 *

#### C5 live: a detached head
$ /Users/romerma/Code/mstack/bin/mstack gate | rg 'branch|working tree'
[ok]    on branch feat
[ok]    working tree is clean
[exit 0]
$ echo {} | mstack statusline
feat · idle

$ git rev-parse --abbrev-ref HEAD
HEAD
[exit 0]
$ /Users/romerma/Code/mstack/bin/mstack gate | rg 'branch|working tree'
[ok]    on branch HEAD
[ok]    working tree is clean
[exit 0]
$ echo {} | mstack statusline   (detached)
idle


#### C6 costs.ts marksDir and hooklog.ts gitCommonDir walk up to .git and parse gitdir: by hand; paths.ts asks --git-common-dir
$ rg -n "^export function marksDir|^function gitCommonDir|\^gitdir:|join\(dir, \".git\"\)|const parent = dirname\(dir\)|--git-common-dir\"" src/costs.ts src/hooklog.ts src/paths.ts
src/paths.ts:77:    const parent = dirname(dir);
src/paths.ts:187:  const combined = git(storeAt(dir), ["rev-parse", "--git-common-dir", "HEAD:src"]);
src/paths.ts:194:  const alone = git(storeAt(dir), ["rev-parse", "--git-common-dir"]);
src/hooklog.ts:112:function gitCommonDir(start: string): string | null {
src/hooklog.ts:115:    const dotGit = join(dir, ".git");
src/hooklog.ts:120:        const m = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, "utf8"));
src/hooklog.ts:130:    const parent = dirname(dir);
src/costs.ts:158:export function marksDir(store: Store): string | null {
src/costs.ts:164:    const dotGit = join(dir, ".git");
src/costs.ts:170:        const m = /^gitdir:\s*(.+)$/m.exec(text);
src/costs.ts:180:    const parent = dirname(dir);
[exit 0]

#### A1 not yet true: five execFileSync("git") calls (C2)

#### A2 not yet true: the gate prints 'on branch HEAD' on a detached head (C5)

#### A3 not yet true: gitdir: parsed in costs.ts and hooklog.ts; paths.ts runs --git-common-dir twice
$ rg -n "\^gitdir:" src
src/costs.ts:170:        const m = /^gitdir:\s*(.+)$/m.exec(text);
src/hooklog.ts:120:        const m = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, "utf8"));
[exit 0]
$ rg -n "\"--git-common-dir\"" src
src/paths.ts:187:  const combined = git(storeAt(dir), ["rev-parse", "--git-common-dir", "HEAD:src"]);
src/paths.ts:194:  const alone = git(storeAt(dir), ["rev-parse", "--git-common-dir"]);
[exit 0]

#### A4 not yet true: there is no workspace module to test
```

### Item 80: checks.sh 80

```

#### C1 four spellings per store: HEADER, row type, positional array, string-key reader
$ rg -n "^export const HEADER|^export interface (Entry|Decision|Receipt) |^interface NewRow|append\(store\.(ledger|decisions|verification), HEADER, \[|written\.push\(\[|^export function (record|add|entries|all|receipts|summarize)\(|readRecords\(store\." src/ledger.ts src/decisions.ts src/verification.ts src/costs.ts
src/decisions.ts:10:export const HEADER = ["ts", "phase", "decision", "why", "evidence", "result", "resolves"] as const;
src/decisions.ts:12:export interface Decision {
src/decisions.ts:49:export function add(store: Store, entry: Omit<Decision, "ts" | "resolves"> & { ts?: string; resolves?: string }): Decision {
src/decisions.ts:59:    append(store.decisions, HEADER, [
src/decisions.ts:72:export function all(store: Store): Decision[] {
src/decisions.ts:73:  return readRecords(store.decisions).map((r) => ({
src/verification.ts:45:export const HEADER = ["target", "sha", "command", "outcome", "ts", "tree"] as const;
src/verification.ts:77:export interface Receipt {
src/verification.ts:312:export function record(store: Store, receipt: Omit<Receipt, "ts"> & { ts?: string }): Receipt {
src/verification.ts:314:  append(store.verification, HEADER, [
src/verification.ts:325:export function receipts(store: Store): Receipt[] {
src/verification.ts:326:  return readRecords(store.verification)
src/ledger.ts:37:export const HEADER = ["target", "sha", "verdict", "evidence", "verifier", "ts"] as const;
src/ledger.ts:43:export interface Entry {
src/ledger.ts:105:export function record(store: Store, entry: Omit<Entry, "ts"> & { ts?: string }): Entry {
src/ledger.ts:135:  append(store.ledger, HEADER, [
src/ledger.ts:146:export function entries(store: Store): Entry[] {
src/ledger.ts:147:  return readRecords(store.ledger)
src/costs.ts:58:export const HEADER = [
src/costs.ts:643:interface NewRow {
src/costs.ts:773:        written.push([
src/costs.ts:877:export function summarize(store: Store, by: By, slug?: string): CostRow[] {
src/costs.ts:879:  for (const r of readRecords(store.costs)) {
src/costs.ts:907:  return readRecords(store.ledger).filter((r) => r["target"] === slug && r["verdict"] === "verifier-failed").length;
[exit 0]
$ bat -pp --line-range 643:653 src/costs.ts
643	interface NewRow {
644	  run: string;
645	  target: string;
646	  role: string;
647	  agent_id: string;
648	  model: string;
649	  usage: Usage;
650	  messages: number | null;
651	  cost: number | null;
652	  source: "transcript" | "cost-state";
653	}
$ bat -pp --line-range 772:787 src/costs.ts
772	      const emit = (r: NewRow): void => {
773	        written.push([
774	          ts,
775	          r.run,
776	          r.target,
777	          r.role,
778	          r.agent_id,
779	          r.model,
780	          String(r.usage.input),
781	          String(r.usage.cache_write),
782	          String(r.usage.cache_read),
783	          String(r.usage.output),
784	          r.messages === null ? NONE : String(r.messages),
785	          r.cost === null ? NONE : String(r.cost),
786	          r.source,
787	        ]);
$ bat -pp --line-range 146:156 src/ledger.ts
146	export function entries(store: Store): Entry[] {
147	  return readRecords(store.ledger)
148	    .filter((r) => isVerdict(r["verdict"] ?? ""))
149	    .map((r) => ({
150	      target: r["target"] ?? "",
151	      sha: r["sha"] ?? "",
152	      verdict: r["verdict"] as Verdict,
153	      evidence: r["evidence"] ?? "",
154	      verifier: r["verifier"] ?? "",
155	      ts: r["ts"] ?? "",
156	    }));
$ bat -pp --line-range 879:881 src/costs.ts
879	  for (const r of readRecords(store.costs)) {
880	    if (slug !== undefined && r["target"] !== slug) continue;
881	    const key = by === "role" ? r["role"] : by === "item" ? r["target"] : r["model"];

#### C2 costs.ts verifierFailed reads ledger.tsv by string key
$ rg -n "readRecords\(store\.ledger\)" src
src/ledger.ts:147:  return readRecords(store.ledger)
src/costs.ts:907:  return readRecords(store.ledger).filter((r) => r["target"] === slug && r["verdict"] === "verifier-failed").length;
[exit 0]
$ bat -pp --line-range 906:907 src/costs.ts
906	export function verifierFailed(store: Store, slug: string): number {
907	  return readRecords(store.ledger).filter((r) => r["target"] === slug && r["verdict"] === "verifier-failed").length;

#### C3 ensureHeader returns without a word on a header that is not a prefix
$ bat -pp --line-range 50:53 src/tsv.ts
50	  const { header: present } = read(file);
51	  if (present.length === 0 || present.length >= header.length) return;
52	  const isPrefix = present.every((name, i) => name === header[i]);
53	  if (!isPrefix) return;

#### C4 live: ledger.tsv with sha and target swapped in its header
$ /Users/romerma/Code/mstack/bin/mstack ledger record demo $(git rev-parse HEAD) test-verified --evidence 'probe for item 80' --verifier reviewer
recorded test-verified for demo at 86afd6de
[exit 0]
$ bat -pp .mstack/ledger.tsv
sha	target	verdict	evidence	verifier	ts
demo	86afd6dee4a5005d64db1d18bcf5f75b3c81c1b6	test-verified	probe for item 80	reviewer	2026-11-17T17:38:53.638Z
[exit 0]
$ /Users/romerma/Code/mstack/bin/mstack ledger check demo
FAIL no verdict recorded for demo
[exit 1]

#### A1 not yet true: positional arrays in ledger.record, decisions.add, verification.record and costs emit (C1)

#### A2 not yet true: costs.ts:907 (C2)

#### A3 not yet true: C4
```

## Closing: after the items commit and the ledger row

```
$ ./bin/mstack ledger record deep-module-vocabulary "$(git rev-parse HEAD)" test-verified --evidence .mstack/progress/impl_deep-module-vocabulary_r3.md --verifier implementer
recorded test-verified for deep-module-vocabulary at 3a978df3

$ ./bin/mstack gate | rg "PASSED|FAILED|fail"
PASSED - 0 failures, 1 warning

$ git diff 83b422c -- . ':!.mstack' | wc -l
0

$ git diff 83b422c --stat   (before this report commit)
 .mstack/decisions.tsv       |  2 ++
 .mstack/ledger.tsv          |  1 +
 .mstack/progress/current.md |  5 ++--
 .mstack/state.json          | 56 +++++++++++++++++++++++----------------------
 4 files changed, 35 insertions(+), 29 deletions(-)
```
