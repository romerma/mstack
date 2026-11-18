# Review - close-with-no-verdict (item 95, round 1)

**Verdict:** APPROVED

Head `5ca8888`, base `23abeaf`. I did not write this code. Every probe ran in
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review95/`
(`<R>` below): clones `base/` (23abeaf) and `head/` (5ca8888), stores under `st/`, mutant clones under
`mut/`, one script per probe (`a1.sh` ... `f1.sh`, `mut.sh`, `b2.sh`). `HOME` was an empty directory
under `<R>`, `GIT_CONFIG_GLOBAL=/dev/null`. Rung: 5 for the CLI seams (the real `bin/mstack` of the head
clone on throwaway git repositories, and `./bin/mstack gate` on this repository's own store), 4 for the
suite and the mutants.

## Acceptance, quoted

**"state set --status done refuses an item with no ledger row while require_verdict_to_close is on, with
the gate's words, or the reason it stays allowed is recorded"** - met. `a1.sh`, item at `verifying`, no row:
```
=== BASE: close with no row, rule on            (23abeaf CLI)
1 demo (done)                                   [exit 0]
-- base gate after close:
[fail]  items marked done with no ledger verdict at all: demo
        fix: record it with 'mstack ledger record'; if no check could be run, that verdict is 'verifier-blocked'
=== HEAD: close with no row, rule on
mstack: demo cannot close: it has no ledger verdict at all
        record it with 'mstack ledger record'; if no check could be run, that verdict is 'verifier-blocked'
[exit 2]                                        (same with --force --closed-by "nobody looked"; status stays verifying)
```
Same words and the same fix line (one constant pair, `src/closing.ts:157-158`, used at `src/gate.ts:528-529`).
`a3.sh`: `--force` from `in_progress` and from `pending` is refused the same way (base closed the latter).
Rule off (`e1.sh`): the same store gives byte-identical `gate` output from the base and head CLIs, at
`verifying` and after the close (exit 0 both); the close succeeds. Rule on at `verifying`, the only diff
between the two gates is the new line pair and `FAILED - 1 failure`.

**"the 50 tests that close with no row are changed to record a verdict or to turn the rule off, each
deliberately; the comment at tests/verdict-reader.test.ts:113-118 is true"** - met. Base `tests/` against
head `src/` (`mut.sh T50`): `833 pass / 50 fail`, and the 50 names equal the 50 rows of the implementer's
table (`diff` empty). Every one records a verdict through `recordClosingVerdict` (`tests/helpers.ts:93`):
the real ledger writer, `reviewer`, `test-verified`, evidence `node --test tests`. The helper diff is the
import and the function only; `state()`'s `require_verdict_to_close` default is untouched. The comment
(`tests/verdict-reader.test.ts:114-117`) is true: the loop asserts `problems.length === 0` and `!report.failed`
against the same `closes` for every case, `no row at all` included (`:126`). Section B has the sample.

**"verifier names are compared after stripping zero-width and look-alike characters, as the evidence check
already does; the reason at the door matches the audit's for a lone verifier-failed row; the refusal prints
the name without the stored apostrophe"** - met as the design row scoped it (Cf characters stripped, look-alikes
not folded, as the evidence check). One definition: `withoutFormatCharacters` (`src/roles.ts:193-194`), used at
`:180` (names) and `:248` (evidence); `rg 'p\{Cf\}' src` has one hit. `c1.ts`:
```
ZWSP U+200B / ZWJ U+200D / soft hyphen U+00AD / BOM U+FEFF / RLM U+200F / LRO / U+2060 / tag U+E0041 -> "self", refused
NBSP U+00A0 inside     normalised="se lf"  closes=true     (NBSP is \s: one separator, as an ASCII space)
NBSP U+00A0 trailing   normalised="self"   closes=false
full-width s U+FF53    normalised="ｓelf"   closes=true     (not folded; the docs say look-alikes are not)
variation selector U+FE0F  "self️" closes=true          (zero-width but Mn, not Cf: non-blocking 2)
```
Through the CLI (`c3.sh`): `se<ZWSP>lf` is refused at the door and red at `verifying` ("only se​lf"); a
Cyrillic `е` closes and the gate passes. Lone `verifier-failed` (`c3.sh`), recorded by `reviewer`,
`implementer`, the empty name, `se<ZWSP>lf`, and a mix of reviewer and implementer: every door says
`demo cannot close: its only verdict is verifier-failed` / `a failed verifier is a reason to reopen the item,
not to close it`, the gate at `verifying` says the same, and the audit says `items marked done whose only
verdict is verifier-failed: demo` with that fix line. Apostrophe (`c2.sh`, prefixes `-` `=` `+` `@`, in
`ledger check`, the door, the gate at `verifying` and the audit, for author-only, impl-citing, spec-citing,
and failed-then-blocked rows): the stored cell is `'-implementer` and so on, and **zero** printed lines
carry `'[-=+@]`, e.g. `demo (only -implementer)`, `cites the implementer's own report (=rev)`,
`demo (+rev): verifier-failed at b7c46dd4 by +rev`, `the later verifier-blocked by @rev`.

**"the gate's side of the two message fixes has a test (dropping the apostrophe fix at src/gate.ts:507 and
changing the fix line at :541 both survive); the list printed for an approval that cites the implementer's
report drops the stored apostrophe too (src/closing.ts:200, src/gate.ts:513)"** - met. Item 82's X1 and X2,
exactly as its round-2 `mutants.sh` wrote them, are now killed (section D). Both lists print `typedName`
(`src/closing.ts:213`, `src/gate.ts:513`), seen above as `(-rev)`, `(=rev)`.

**"docs/wiki/The-CLI.md:474-475 says what follows the last colon is compared, not 'a whole name';
docs/wiki/Gates-and-Hooks.md:283-284 names the empty name, and the long lines there and at
tests/verdict-reader.test.ts:118 are wrapped"** - met. `The-CLI.md:475-476` "What follows the last colon is
what is compared"; `Gates-and-Hooks.md:283-284` "and the empty name, which names nobody and closes nothing".
Widest prose line in `Gates-and-Hooks.md:275-320` is 100 (was 147 at `:283`); every longer line there is a
console transcript. `tests/verdict-reader.test.ts:115-118` are 96, 89, 91, 77 characters.

## A. The refusal, the gate at verifying, and every sequence

Door and gate agree on every sequence (`a2.sh`: close with the head CLI; if refused, set `done` in the
JSON and run the head gate):
```
no row                             refused | items marked done with no ledger verdict at all: demo
implementer only                   refused | items closed on a verdict from the pass that wrote the code: demo (only implementer)
reviewer then a new commit         closes  | 1 closed item(s) carry a ledger verdict
rejection then approval            closes  | 1 closed item(s) carry a ledger verdict
rejection, new commit, approval    closes  | 1 closed item(s) carry a ledger verdict
approval citing impl report        refused | ...whose evidence cites the implementer's own report: demo (reviewer)
blocked under reviewer             closes  | 1 closed item(s) carry a ledger verdict
blocked under implementer          refused | ...from the pass that wrote the code: demo (only implementer)
lone failed (reviewer|implementer) refused | items marked done whose only verdict is verifier-failed: demo
implementer pass, reviewer failed  refused | ...most recent closing verdict is verifier-failed...
failed then blocked (reviewer)     refused | ...most recent closing verdict is verifier-failed...
impl failed then impl passed       refused | ...from the pass that wrote the code: demo (only implementer)
empty verifier                     refused | ...from the pass that wrote the code: demo (only unnamed)
```
`ledger check` on the blocked-under-reviewer store: `FAIL verifier-blocked at 137f7522 by reviewer ...`, as
`Gates-and-Hooks.md:316-319` says.

The gate at `verifying` now goes red with no row (decision row of 2026-11-18T19:36:55). The order the roles
are told does not reach it: `agents/orchestrator.md:29-34` launches the reviewer at `in_progress`
and runs `merge-gate` at `verifying`; `agents/reviewer.md:113` and `skills/review/SKILL.md:51-58` record the
row before returning; `Getting-Started.md:347-366` and `The-Agents.md:96-111` record the reviewer's row at
`reviewing` and then move; the README reaches `verifying` with the implementer's row, which was already red
there (author-only) at base. `rg -- '--status verifying' skills agents` has no hit telling a role to move first.
`skills/ship/SKILL.md:31` and `skills/router/playbooks/cleanup.md:16` record a row before the close.

## B. The 50 tests

`recordClosingVerdict` writes one approving row under a closing name. It can only remove the new no-row
problem; it cannot add one, and it cannot answer a rejection the test records, because the tests that are
about verdicts (`closing-role`, `verdict-reader`, `closing.test.ts:199-370`) do not call it.

Hard check 1, `src/` refusal reverted only (`mut.sh B1`: `return []` for `reading === undefined` at
`src/closing.ts:205`): `889 pass / 2 fail`, the two that pin it:
`an item with no ledger row is refused at done ...` (`closing-role.test.ts:261`) and
`the close and the gate agree on every sequence ...` (`verdict-reader.test.ts:132`). All of `src/` at base
with head's tests (`B1all`): `886 / 5`, all five in the new tests; the 50 changed tests pass on base `src/`
too, so the added row changes nothing there.

Hard check 2, the helper removed from five tests with `src/` intact (`b2.sh`): `127 pass / 5 fail`, each on
the new refusal:
```
--force with a reason closes it ...  (cli.test.ts:691)       => storage-layer cannot close: it has no ledger verdict at all
a check that is not overridable ...  (closing.test.ts:152)   => storage-layer cannot close: it has no ledger verdict at all
... nothing configured warns rather than wedging (gate:1018) => expected a pass, got ["... one step from done, and it has no ledger ver...
both configured commands have to have run (gate.test:1036)   => both green: expected a pass, got ["... it has no ledger verdict at ...
closing is refused over a round 3 report (review-budget:132) => bud cannot close: it has no ledger verdict at all
```

Read, every changed test in `closing.test.ts` (5) and `cli.test.ts` (7), and 14 of the 36 in `gate.test.ts`
and `r-table-check.test.ts`. What each still proves, with the row in place:
- `closing.test.ts:20` unrun verification blocks closing in all three surfaces: now sharper, it asserts
  `problems.length === 1` (only the receipts problem) before the receipt and `[]` after.
- `:51` unreadable receipts are the non-overridable problem: still `problems.length === 1`, `check: verification`.
- `:109`, `:147`, `:164` a second closing check is seen by both surfaces, a non-overridable one survives
  `--force`, and the gate reports every check at `verifying`: unchanged; without the row the first stuck
  problem would be the no-row one (order in `CLOSING_CHECKS`, `src/closing.ts:272`) and hide the subject.
- `cli.test.ts:317` plain forced transition and note; `:637`, `:675`, `:691`, `:738`, `:769` the receipts guard,
  `--force` needing `--closed-by`, the durable marker, the ordinary note; `:836` the receipts guard does not
  block an item nothing verifies. Each asserts the receipts' own words or the marker; the row clears only
  the non-overridable no-row problem that `src/cli.ts:715-719` would print first.
- `gate.test.ts:937`, `:964`, `:1018`, `:1037`, `:1070`, `:1136`, `:1160`, `:1217`, `:1314`, `:1430`: receipts and
  tree key at `verifying`. Every `expectFail` keeps its own regex (`has never been executed`, `earlier run(s)
  exist at other commits`, `an uncommitted file has changed since`, `could not be read`); every `expectPass`
  needed the row only for the no-row line (hard check 2). `:1018` still asserts the `nothing verifies it` warning.
- `r-table-check.test.ts:80` (`world()`), read through `:99` good table, `:206-221` the 17 problem cases (gate at
  `reviewing` and `verifying` and the door each name the table problem), `:338` no base, `:369`, `:387`, `:397`
  forced-past markers, `:416` unreadable report: each still asserts the table's words; the door shows only the
  first non-overridable problem, which without the row is the no-row one.
No changed test was about closing without a verdict; those subjects live in the new `closing-role` tests and
`verdict-reader.test.ts:126`. Unchanged tests at `verifying` with no row (`gate.test.ts:915`, `:945`, `:988`,
`:1086`, `:1181`, `:1372`, `:1445`, `cli.test.ts:806`) now carry the extra no-row failure; each asserts its own
message, and the one that asserts only `report.failed` (`:1181`) already had the receipts failure behind it.

## D. Mutants (node, full suite, a fresh clone each; baseline `891 / 0`; output in `<R>/mut/<name>.txt`)
```
X1  item 82: gate.ts:507 prints r.verifier            890 / 1  no list prints the apostrophe ... (closing-role:346)
X2  item 82: gate.ts:541 fix line drifts (its string) 890 / 1  no list prints the apostrophe ...
B1  no-row refusal removed (implementer's)            889 / 2  closing-role:261, verdict-reader:132
M4  format stripping removed from names (impl's)      890 / 1  a zero-width or format character ... (closing-role:311)
M5  audit no-row fix line changed (impl's)            890 / 1  the gate's audit of a closed item with no row ... (:372)
M9  audit lone-failed fix line changed (mine)         890 / 1  the door and the gate's audit give the same reason ... (:326)
M6  loneFailure uses some() for every() (mine)        886 / 5  closing.test.ts:199, :282, :309, :360; closing-role:152
M2b gate.ts:541 keeps the first clause, edits the
    rest ("(your own name, or `ci`)" -> "(a reviewer)") 891 / 0  SURVIVES (non-blocking 3)
M7  Cf narrowed to U+200B-200D, U+2060, U+FEFF (mine)  891 / 0  SURVIVES (non-blocking 4)
M8  ledger check prints row.verifier (mine)            891 / 0  SURVIVES (non-blocking 4)
```

## E-G. Docs, walkthroughs, this repository

- `Gates-and-Hooks.md:306-313` reproduces from one run (`a1.sh` door lines, `a0.sh` gate lines), and
  `:316-320` (blocked under a closing name closes and the gate passes, `ledger check` fails it, the author's
  name is refused) from `a2.sh`. `The-Agents.md:245-247` and `How-A-Work-Item-Flows.md:81-84` are true (`a3.sh`).
- CHANGELOG upgrade: a store closed with no row by the base CLI, rule on: base and head `gate` outputs are
  identical (`items marked done with no ledger verdict at all: demo`, exit 1); one `verifier-blocked` row
  under `maintainer` turns head's gate to `PASSED`. That matches the note.
- `f1.sh`: the README's steps (`README.md:196-256`) and The-Agents' (`The-Agents.md:79-119`) in a scratch
  repository close exactly where each page says (implementer-only refused, reviewer's row, close exit 0,
  `1 closed item(s) carry a ledger verdict`). `walkthrough.test.ts` 4/4 pass (node output lines 918-921).
- The implementer's table: every cited line printed and matched to its row (`closing-role.test.ts:261`,
  `:281`, `:291`, `:311`, `:320`, `:326`, `:346`, `:372` are the named tests; `helpers.ts:93` the helper;
  `r-table-check:80`, `cli:317`, `gate:937`, `closing:25`, `review-budget-gate:120` helper calls;
  `verdict-reader:126` the no-row case). Report 8710 bytes.
- This store, read-only (`<R>/g1.ts`, the door's `ledger-verdict` and `independent-verdict` checks over every
  done item): `done items: 49; with zero rows: 0; refused by the door's verdict checks: 0; rule on: true`.
  `./bin/mstack gate`: `PASSED - 0 failures, 0 warnings`.

## H. Suite (this checkout, `HOME` an empty directory under `<R>`, `GIT_CONFIG_GLOBAL=/dev/null`)
```
npm run test:bun     891 pass, 0 fail  (Ran 891 tests across 43 files. [206.92s])
npm run test:node    tests 891, pass 891, fail 0
npm run typecheck    exit 0
./bin/mstack lint-plugin .                         PASSED - 0 failures, 0 warnings
node scripts/check-doc-links.mjs README.md docs/wiki/*.md   109 relative links checked, 0 broken
```

## Non-blocking (file as follow-ups)

1. `CHANGELOG.md:23`, the item-82 bullet in the same `Unreleased` section, still says "(an item with no
   verdict at all still does, and the gate still flags it)". After this item that is false for the release
   the section describes; the new bullet above it says the opposite. Drop or amend the parenthetical.
2. "ignoring case, spaces, hyphens and underscores" (`The-CLI.md:478-479`, `Gates-and-Hooks.md:287`,
   `GLOSSARY.md:37`) is wider than the code: a run of them is one separator, not nothing (`c5.ts`:
   `se lf`, `s-elf`, `se_lf` and `specauthor` close; `spec author` is refused). Pre-existing wording, kept in
   the sentences this item rewrote. Separately, zero-width characters outside Cf (U+FE0F, U+034F, U+180B)
   are not stripped from names or evidence (`c3.sh`: `self` + each closes). The docs scope the rule to Cf, so
   they are true; `Default_Ignorable_Code_Point` would cover these in both checks at once.
3. M2b: the gate's self-closed fix line is pinned only by its first clause (`closing-role.test.ts:365`); the
   rest of `SELF_CLOSED_FIX` can drift at `gate.ts:541` with the suite green. Assert `fix: ${SELF_CLOSED_FIX}`.
4. M7, M8: only ZWSP, ZWJ, U+2060 and BOM are tested (`closing-role.test.ts:312`), so the soft hyphen, the
   bidi marks and the tag characters the docs claim are untested in both checks; and `ledger check`'s
   `typedName` (`src/ledger.ts:311`, `:325`, `:349`, `:360`) has no test (it works: `c2.sh`).
5. The door lost the pointer for a lone `verifier-failed` from a closing role: it used to print
   `a rejection stands in the ledger: verifier-failed at <sha> by reviewer (evidence: review_demo.md)` with
   the way out, and now prints `its only verdict is verifier-failed` (criterion 3 asks for the audit's
   words). Carrying the row in both the audit and the door would keep parity and the evidence path.
6. `NO_VERDICT_FIX` says "that verdict is 'verifier-blocked'" without "under a name that is not the
   author's"; a user who records it as `implementer` meets the next refusal, which does say it.
7. A verifier made only of format characters prints as an invisible name (`(only ​)`, `c4.sh`), not
   `unnamed`. `=implementer`, `+me`, `@self` close (pre-existing; door and gate agree).
8. The upgrade note does not say an item already at `verifying` with no row turns the gate red on upgrade
   (the bullet's body says the gate at `verifying` reports it). `cli.test.ts:836` and `gate.test.ts:1018`
   say `verifier-blocked` is the typed answer for "nothing verifies it", and the helper records
   `test-verified` there; a `verifier-blocked` row would match their comments.

## What I did not check

The mutants under bun (node only); the 22.6 node pin (node 26.13.1 and bun 1.3.11 here);
`claude plugin validate . --strict`; repeated suite runs for flakiness.
