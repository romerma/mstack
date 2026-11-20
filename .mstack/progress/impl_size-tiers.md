# Implementation - size-tiers (item 44)

## What changed

One reference file, `skills/router/references/size-matrix.md`, now holds the only table of
which steps each size gets, plus one paragraph per size that also says when intake picks it and
the sentence that holds at every size. The router passes `--size` at intake and links it; the
feature and bug-fix playbooks and the design, review and implement skills link it and say only
their own step. A new closing check, `lens-panel` (`src/panel.ts`, registered in
`src/closing.ts`), fails a size `l` item at `verifying` and refuses `state set --status done`
(`--force` included) while no review round of it has two or more lens reports, counted from the
file names `fanout plan --kind review --worker` allocates. `lint-plugin` fails a missing matrix,
one of the six files without its link, a router intake step without `--size`, and a copy of the
table's header row anywhere else under `skills/` or `agents/`. Docs, CHANGELOG and GLOSSARY
(`Size`) follow, with pasted output from real runs.

### Before and now

Before (read from the files at the item base `e28c452`): no skill or playbook named a size
(`rg -n -i size skills` found only the report-size and task-size lines).

| Step | Before, for every item | Source |
|---|---|---|
| understand | feature step 1 always; bug-fix step 2 when the subsystem is unfamiliar; design step 1 always | playbooks, design skill |
| design | feature step 2: two candidates always; bug-fix step 4 if the fix crosses a function boundary; design skill: fan-out and judge always | same |
| spec path | the router's triggers; `sdd` with `s` refused; spec limit 12 (`m` or none), 30 (`l`) | `src/cli.ts` assertNotSddSmall, `src/size.ts` |
| test first, delegation | every item | feature 4-5, bug-fix 3-5, implement |
| code diff | the gate holds the active `s` item to 60 lines in 3 code files | `src/gate.ts` checkSmallDiff |
| `verify --mutation` | shipped in the CLI, named by no skill | `docs/wiki/The-CLI.md` |
| review | the review skill's panel or `--solo`, no size rule; no gate check of panels | review skill |
| size at intake | not assigned: neither the router's nor intake's `state add` had `--size` | router step 3, intake End |

Now: `s` skips understand, design and the panel (one lone reviewer); `m` reads the code itself,
designs in the session with at least one rejected alternative, and adds `verify --mutation`
after the last commit; `l` adds understand, the design skill's whole procedure and a panel of two
or more lens reports in one round, which the gate holds. The s diff limit, no `sdd` at `s` and
the spec limits are in the matrix too. Intake picks `l` when the change crosses several
subsystems or carries more than 12 requirements, else `s` on the direct path within the `s`
limits, else `m`.

### Per file

- `skills/router/references/size-matrix.md` (new): the table, a paragraph per size, the
  every-size sentence, and "raise it with `state set --size`; never lower it to skip a step".
- `skills/router/SKILL.md`: step 3's `state add` passes `--size <s|m|l>` and links the matrix;
  Delegation says "at every size, `s` included".
- `skills/router/references/intake.md`: `--size` in End's `state add`, and where the rule is.
- `skills/router/playbooks/feature.md`: steps 1, 2, 6 and 8 say their size consequence.
- `skills/router/playbooks/bug-fix.md`: steps 2, 4, 6 and 8 likewise.
- `skills/design/SKILL.md`: one paragraph: every step at `l`, steps 2 and 5 in the session at
  `m`, none at `s`.
- `skills/review/SKILL.md`: step 2 opens with the shape per size and the gate's hold on `l`.
- `skills/implement/SKILL.md`: delegation at every size, and the `s` diff limit.
- `src/panel.ts` (new), `src/closing.ts` (the `lens-panel` entry), `src/lint.ts`
  (`lintSizeMatrix`, `orientSteps` shared with the intake check).

## Files

```
src/panel.ts (new)                         tests/size-tiers.test.ts (new)
src/closing.ts                             tests/lint.test.ts (tests appended at the end)
src/lint.ts
skills/router/references/size-matrix.md (new)
skills/router/SKILL.md                     skills/router/references/intake.md
skills/router/playbooks/feature.md         skills/router/playbooks/bug-fix.md
skills/design/SKILL.md                     skills/review/SKILL.md
skills/implement/SKILL.md
docs/wiki/Gates-and-Hooks.md               docs/wiki/The-CLI.md
docs/wiki/Skills-and-Playbooks.md          docs/wiki/The-Agents.md
CHANGELOG.md                               GLOSSARY.md
.mstack/decisions.tsv (rows 327 to 330)    .mstack/progress/current.md
```

Commits: `4f7c074` feat (check and tests), `e8699cc` docs(skills), `b135331` feat(lint),
`aa02d17` fix (a cancelled `l` item forced to done), `a7f1b72` docs, then this report.

## Commands

### Red first

`tests/size-tiers.test.ts` before `src/panel.ts` existed (node; full output in the scratch file
`red.txt`):

```
✖ an l item at verifying with no review report fails the gate, naming the next round's panel
✖ an l item with a lone review only fails, and the fix names round 2
✖ an l item whose round has one lens report fails, naming the lens
✖ one lens report in each of two rounds is not a round of two
✖ a lens report under the stub floor does not count
✖ another item's lens reports are not this item's
✔ an l item with a round of two lens reports passes the gate and closes
✔ a later round with two lens reports passes, after a lone round 1
✔ two rounds where only the earlier one had two lens reports pass: any round counts
✔ an m item, an s item and an item with no size are not held, in the same states
✔ an l item before verifying is not reported
✔ an l item already done on lone reviews still reads as closed
✖ closing an l item with a lone review is refused, and --force does not close over it
✖ a forced close from reviewing, past verifying, is refused by the same check
ℹ tests 14
ℹ pass 6
ℹ fail 8
...
  PASSED - 0 failures, 2 warnings
  0 !== 1
```

The six that passed are the "not held" and "passes" cases, which pass with no check by
construction; mutants G2, G5 and G9 below fail them, and the closed-item case at line 136 stays
a guard (the gate never reads a closed item, so no mutant of the check reaches it). The test at line 55
was first red on the review budget as well (its round 3 report had no row); it now records the
`review-r3` row so only the panel can fail it. The cancelled case, added after the first commit,
red against the committed guard (`red2.txt`):

```
✖ a cancelled l item forced to done is held to the panel too
  0 !== 2
```

The lint tests before `lintSizeMatrix` existed (`red-lint.txt`):

```
✔ the plugin as shipped links the size matrix from each of the six files, and says so
✖ a missing size matrix is caught
  AssertionError [ERR_ASSERTION]: matrix removed: failed silently. Nothing matched /^skills\/router\/references\/size-matrix\.md is missing -> /. Got ["skills/design/SKILL.md: broken link to ../router/references/size-matrix.md", ...
✖ each of the six files that stops linking the size matrix is caught, by name
  AssertionError [ERR_ASSERTION]: link removed from skills/router/SKILL.md: expected a failure, got a pass
✖ a router that links the matrix only outside its orient steps is caught
✖ a router whose intake step does not pass --size is caught
✖ a second copy of the size table is caught, in a skill and in an agent
✔ a plugin with no router is not held to the size matrix rule
ℹ pass 3
ℹ fail 5
```

### Mutants

In a clone of this checkout at `aa02d17` under the scratch directory (`mutants.sh`,
`mutant-g9.sh`), each applied with `sd -F`, the named test file run under node, then reverted.

| Mutant | Test that fails | Result |
|---|---|---|
| G1 `lensPanel` left out of `CLOSING_CHECKS` | the six held cases, both forced closes, the cancelled case | killed |
| G2 `>= PANEL_MIN_LENSES` to `>` | a round of two passes and closes; later round of two; any round counts | killed |
| G3 `PANEL_MIN_LENSES = 1` | one lens report fails; stub floor; forced closes | killed |
| G4 every lens counted in round 1 | one lens report in each of two rounds is not a round of two | killed |
| G5 `size !== "l"` to `size === "s"` | m, s and no size are not held | killed |
| G6 `substantialReports` to `reportFiles` | a lens report under the stub floor does not count | killed |
| G7 a lone review counted as a lens | a lone review and one lens report in one round are not a panel | killed |
| G8 `overridable: true` | --force does not close over it; forced from reviewing; cancelled | killed |
| G9 `reportedAt: ["reviewing"]` | an l item before verifying is not reported | killed |
| G10 next round `highest` | fix names round 2; round 3 and its row; round 1 | killed |
| G11 `next >= JUSTIFY_FROM_ROUND` to `>` | after two lone rounds the fix names round 3 and its row | killed |
| G12 cancelled exempted again | a cancelled l item forced to done is held too | killed |
| L1 the unlinked-file failure removed | each of the six files; router outside orient | killed |
| L2 router link read anywhere, not in orient | a router that links the matrix only outside its orient steps | killed |
| L3 the `--size` failure removed | a router whose intake step does not pass --size | killed |
| L4 duplicate search skips `agents/` | a second copy of the size table, in a skill and in an agent | killed |
| L5 the missing-matrix failure removed | a missing size matrix is caught | killed |
| L6 the no-router guard removed | a plugin with no router is not held to the size matrix rule | killed |

18 mutants, 18 killed. The tests at lines 172, 180 and 189 were written for G7, G11 and G12
before the mutants ran; G12's was red first (above), the other two pass on the real code and
fail on their mutant.

### Real surface

A throwaway repository under the scratch directory, set up with this checkout's
`bin/mstack setup`, `HOME` a new empty directory (`surface.sh`; whole transcript in
`surface.txt`). The scratch path is shortened to `<s>`; `[exit N]` is the script's.

```
$ mstack state add --slug greet --title "greet in capitals" --size l --acceptance "greet --shout uppercases" --verification "node --test tests/"
added 1 greet (pending)
$ mstack fanout plan --kind review --solo
review round 1 of greet, one lone reviewer; the report goes to:
<s>/surface/repo/.mstack/progress/review_greet.md
...
$ mstack state set greet --status verifying
1 greet (verifying)
  status: "reviewing" -> "verifying"
$ mstack gate --full
...
[fail]  1 greet (verifying) is one step from done, and it is size l, and no review round of it has 2 or more lens reports: round 1 has a lone review
        fix: a size l item closes on a review panel: 'mstack fanout plan --kind review --round 2 --worker correctness --worker tests' allocates 2 lens reports for round 2; launch one reviewer per path
...
[ok]    node --test tests/

FAILED - 1 failure, 0 warnings
[exit 1]
$ mstack gate
...
[ok]    verification ran and passed at 2cf31721: node --test tests/
[fail]  1 greet (verifying) is one step from done, and it is size l, and no review round of it has 2 or more lens reports: round 1 has a lone review
...
FAILED - 1 failure, 0 warnings
[exit 1]
$ mstack state set greet --status done
mstack: greet cannot close: it is size l, and no review round of it has 2 or more lens reports: round 1 has a lone review
        a size l item closes on a review panel: 'mstack fanout plan --kind review --round 2 --worker correctness --worker tests' allocates 2 lens reports for round 2; launch one reviewer per path
[exit 2]
$ mstack state set greet --status done --force --closed-by "one reviewer was enough"
mstack: greet cannot close: it is size l, and no review round of it has 2 or more lens reports: round 1 has a lone review
        ...
[exit 2]
$ mstack fanout plan --kind review --round 2 --worker correctness --worker tests
review fan-out on greet, 2 worker(s):
  correctness	<s>/surface/repo/.mstack/progress/review_greet_r2-correctness.md
  tests	<s>/surface/repo/.mstack/progress/review_greet_r2-tests.md
$ mstack fanout check --kind review --round 2 --worker correctness --worker tests
-- review fan-out on greet
[ok]    correctness -> review_greet_r2-correctness.md (95 bytes)
[ok]    tests -> review_greet_r2-tests.md (95 bytes)
[warn]  review_greet.md was not in the plan; nothing will read it
$ mstack ledger record greet 2cf31721eeed46c3ca5773599de88dfa00ff76d3 test-verified --evidence ".mstack/progress/review_greet_r2-correctness.md .mstack/progress/review_greet_r2-tests.md" --verifier session
recorded test-verified for greet at 2cf31721
$ mstack gate --full
...
PASSED - 0 failures, 0 warnings
[exit 0]
$ mstack gate
...
PASSED - 0 failures, 0 warnings
[exit 0]
$ mstack state set greet --status done
1 greet (done)
  status: "verifying" -> "done"
[exit 0]
$ mstack gate
...
[ok]    1 closed item(s) carry a ledger verdict
PASSED - 0 failures, 1 warning
```

### Suites

At `a7f1b72` (the code is unchanged after it), from `suite.sh`:

```
bun test ./tests            1130 pass, 3 skip, 0 fail; Ran 1133 tests across 59 files. [371.75s]   exit 0
node --test 'tests/*.test.ts'  tests 1133, pass 1132, fail 0, cancelled 0, skipped 1            exit 0
bun run typecheck           exit 0
./bin/mstack lint-plugin .  PASSED - 0 failures, 0 warnings                                      exit 0
node scripts/check-doc-links.mjs README.md docs/wiki/*.md   112 relative links checked, 0 broken  exit 0
```

### Ten runs

`ten.sh`, a fixed `for i in 1 ... 10` per file and runtime, after the suites:

```
tests/size-tiers.test.ts: node 10/10, bun 10/10
tests/lint.test.ts: node 10/10, bun 10/10
```

The requirement table below, read by the gate's own `rTableProblems` against this store before
the commit (`rtable-check.mts`): `r-to-test: no problems`.

### This checkout's gate

Before the report commit (the warning is this report, `current.md` and row 331, not yet
committed); item 42 (size `l`, closed on lone reviews) is among the 54:

```
[ok]    54 closed item(s) carry a ledger verdict
[ok]    size-tiers is in_progress; a verification run is due at verifying
...
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[ok]    on branch feat/size-tiers
[warn]  3 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 1 warning
```

## R to test

| R | Test | Where |
|---|---|---|
| A1 | the six files link the one matrix, a removed link, a missing matrix and a copied table are caught | tests/lint.test.ts:461, tests/lint.test.ts:474, tests/lint.test.ts:484, tests/lint.test.ts:500, tests/lint.test.ts:525, tests/lint.test.ts:538 |
| A2 | intake passes --size; an l item at verifying is held without a round of two lens reports, m, s and no size are not, a closed l item reads as closed, --force does not close over it | tests/lint.test.ts:512, tests/size-tiers.test.ts:29, tests/size-tiers.test.ts:38, tests/size-tiers.test.ts:47, tests/size-tiers.test.ts:55, tests/size-tiers.test.ts:86, tests/size-tiers.test.ts:103, tests/size-tiers.test.ts:114, tests/size-tiers.test.ts:136, tests/size-tiers.test.ts:147 |

`test(` lines printed back:

```
tests/lint.test.ts:461: test("the plugin as shipped links the size matrix from each of the six files and lints clean", () => {
tests/lint.test.ts:474: test("a missing size matrix is caught", () => {
tests/lint.test.ts:484: test("each of the six files that stops linking the size matrix is caught, by name", () => {
tests/lint.test.ts:500: test("a router that links the matrix only outside its orient steps is caught", () => {
tests/lint.test.ts:512: test("a router whose intake step does not pass --size is caught", () => {
tests/lint.test.ts:525: test("a second copy of the size table is caught, in a skill and in an agent", () => {
tests/lint.test.ts:538: test("a plugin with no router is not held to the size matrix rule", () => {
tests/size-tiers.test.ts:29: test("an l item at verifying with no review report fails the gate, naming the next round's panel", SPAWNING, () => {
tests/size-tiers.test.ts:38: test("an l item with a lone review only fails, and the fix names round 2", SPAWNING, () => {
tests/size-tiers.test.ts:47: test("an l item whose round has one lens report fails, naming the lens", SPAWNING, () => {
tests/size-tiers.test.ts:55: test("one lens report in each of two rounds is not a round of two", SPAWNING, () => {
tests/size-tiers.test.ts:86: test("an l item with a round of two lens reports passes the gate and closes", SPAWNING, () => {
tests/size-tiers.test.ts:103: test("two rounds where only the earlier one had two lens reports pass: any round counts", SPAWNING, () => {
tests/size-tiers.test.ts:114: test("an m item, an s item and an item with no size are not held, in the same states", SPAWNING, () => {
tests/size-tiers.test.ts:136: test("an l item already done on lone reviews still reads as closed", SPAWNING, () => {
tests/size-tiers.test.ts:147: test("closing an l item with a lone review is refused, and --force does not close over it", SPAWNING, () => {
```

## Decision rows

Rows 327 to 330 of `.mstack/decisions.tsv`, phase design: the matrix file, its shape and the
lint check (327); the size rule at intake and each size's steps (328); the `lens-panel` check,
which round counts, stubs, the fix line, not overridable (329); `l` items already at
`verifying` or beyond (330). Row 331, phase implement: no status is exempt, so a cancelled `l`
item forced to `done` is held too, which narrows row 330's "done or cancelled is never read" to
the gate's side.

## What the acceptance asks that this does not show

- A1's matrix content (that a session skips or adds the steps) is prose for other sessions.
  `lint-plugin` proves the six links, the one table and the router's `--size`; that a session
  follows the text was not run, because starting `claude` sessions was not authorised here. It
  stops at rung 2 (read) for behaviour and rung 4 for the structure.
- "m adds mutation" is a step the skills name; no check reads the receipt (item 100 decides
  that), and nothing here says one does.
- The size rule is as deterministic as its inputs: "crosses several subsystems" is the router's
  existing spec-path trigger, and the line and file counts are an estimate made at intake.

## What I did not do

- No `verify --mutation` run of this item's own diff (the brief forbids it in this checkout);
  the 18 hand mutants above stand in.
- No change to the item's status, and no push.
- `tests/budget-helpers.ts` is reused unchanged; no existing test was edited.
