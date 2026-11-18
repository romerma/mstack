# Review - any-role-name-closes (item 82), round 1

**Verdict:** CHANGES_REQUESTED

Reviewed at `eb1180493bced4bd56c1889952ff6980b41271f8` against base `7d71f2e`. The code does what
the item asks and is well tested. Two blocking findings are about docs: committed files that this
change made false. Every probe ran through the real CLI on throwaway stores under the scratch
directory `.../scratchpad/review82/` (scripts `probeA.sh`, `probeB.sh`, `probeB2.sh`, `probeD.sh`,
`probeG.sh`, `mutants*.sh`, `zerorows.sh`, `timing2.sh`, each with a `.out` file beside it).

## Blocking findings

### 1. Three committed walkthroughs close on the implementer's row alone, and that close is now refused

The change makes `state set --status done` refuse an item whose only rows are the author's, with
no `--force`. Three committed docs still show that close succeeding, and none of them was edited:

- `docs/wiki/The-Agents.md:70` says "the close is forced past review anyway, and the gate catches it".
  `:78-81` pastes `$ mstack state set greet-flag --status done --force --closed-by "demo: skipping
  review on purpose"` -> `1 greet-flag (done)`. The same file's new paragraph at `:219-223` says
  this close is refused.
- `docs/wiki/Getting-Started.md:221-224` pastes `state set greet-flag --status done --closed-by
  "demo walkthrough"` -> `1 greet-flag (done)`. `:231-233` follows with "The item is `done`, a
  verdict exists, and the gate still refuses".
- `README.md:200-211` says "The implementer's own row is not enough", then shows `$ mstack gate
  # after moving the item to done`. That move can no longer be made.

Replayed at head (`probeG.sh`; a fresh store, `state add`, `in_progress`, one `--verifier
implementer` row):
```
$ mstack state set greet-flag --status done --force --closed-by demo: skipping review on purpose
mstack: greet-flag cannot close: its only verdicts are from the pass that wrote the code (only implementer)
        a closing verdict has to come from somewhere other than the implementer; run the verification again from a pass that did not write it
[exit 2]
$ mstack state set greet-flag --status reviewing / --status verifying      (both exit 0)
$ mstack state set greet-flag --status done --closed-by demo walkthrough
mstack: greet-flag cannot close: its only verdicts are from the pass that wrote the code (only implementer)
[exit 2]
```
At `7d71f2e` the forced close printed `1 greet-flag (done)` with exit 0 (`probeG-old.out`). The new
refusal cannot be overridden, so no store setup reproduces any of the three transcripts. Under
CONTRIBUTING.md ("Pasted output is from real runs ... the ones that did not reproduce were treated
as bugs") these are false statements in committed files. The implementer's report checked
`skills/ship` and `skills/review` only.

**Fix:** rewrite each walkthrough to show the refusal at the door, as the new transcript at
`docs/wiki/Gates-and-Hooks.md:290-297` does, followed by the reviewer row and a close that passes.
Keep the gate's audit line as the backstop for stores closed by an older version. Paste the output
from real runs.

### 2. `docs/wiki/The-Agents.md:223` says the close refuses an item that it lets through

The line reads: "`state set --status done` refuses an item without such a verdict, as the gate
does." An item with no row at all has no such verdict, and it closes:
```
=== 10 zero rows                       (probeB.out)
  close rc=0
  gate after rc=1
    [fail]  items marked done with no ledger verdict at all: demo
```
The CHANGELOG states the opposite, and correctly: "an item with no verdict at all still does".

**Fix:** "refuses an item whose only verdicts are the author's, as the gate does". Also, the
CHANGELOG headline (`CHANGELOG.md:5`, "Closing an item needs a verdict from a role that did not
write the work, and `state set --status done` says so up front") is contradicted by its own
parenthetical. Narrow it the same way.

## Acceptance, quoted

**"the roles whose verdict may close an item are decided by a rule the code states, and a verdict
recorded as self, coordinator or an unknown name does not close an item, or the report shows why an
open set is intended and the decision is recorded"**: **met, by the "or" branch.**
- The rule is stated once, at `src/roles.ts:126-167` (`WROTE_THE_WORK`, `canCloseAnItem`,
  `normalisedRole`). Running `rg '"(implementer|spec-author|self|me|dev|author|impl)"' src/*.ts`
  finds no second list. The other `"implementer"`/`"spec-author"` literals are the report kinds
  in `REPORT_KINDS`, and the labels at `closing.ts:200,203`, `gate.ts:515,519` and `ledger.ts:271`.
- The open set is argued in decision row 245, the implementer's report and `roles.ts:146-162`.
- `self` is refused and `coordinator` closes, as the design row says it should.
- In probeA, every name behaved as the stated rule says: case, spaces, hyphens, underscores,
  the prefix and the formula guard. Exceptions are below.

**"an item whose only verdict is the implementer's is refused at state set --status done with the
reason the gate gives, instead of closing and turning the gate red afterwards"**: **met.**
- probeB case 1: the close exits 2 with `its only verdicts are from the pass that wrote the code
  (only implementer)`.
- The gate's audit says `items closed on a verdict from the pass that wrote the code: demo (only
  implementer)`, with the same fix line. Both use `SELF_CLOSED_FIX` (`closing.ts:147`, `gate.ts:541`).
- At `verifying`, the gate prints the close's own sentence: `1 demo (verifying) is one step from
  done, and its only verdicts are from the pass that wrote the code (only implementer)`.
- Base `7d71f2e`: the close exited 0, then the gate exited 1 (`probeB-old.out`).

**"GLOSSARY.md's Closing role entry and docs/wiki describe the rule as the code then implements
it"**: **not met.**
- The new text in `GLOSSARY.md:37`, `Gates-and-Hooks.md:277-297`, `The-CLI.md:470-475` and
  `The-Agents.md:219-222` is true of the code, apart from the colon rule (non-blocking 3).
- `docs/wiki/The-Agents.md:66-84` and `:223`, and `docs/wiki/Getting-Started.md:205-237`, describe
  the rule the code no longer implements (blocking 1 and 2).

## The implementer's decisions

**Not overridable by `--force` (row 246): agree.**
- The brief's premise does not hold. The design row (245) does not say a forced close "must leave
  a marker a later reader can see". `rg -n "later reader can see"` over `.mstack docs skills agents
  src` finds that phrase nowhere.
- The reasoning is true. `gate.ts:284` runs `checkClosedItems` over every `done` item while
  `require_verdict_to_close` is on, and nothing in `gate.ts` reads `closed_by` (only the comments
  at `:351` and `:465-472`).
- At `7d71f2e`, `--force` did nothing for this case: the close succeeded without it (probeB-old
  cases 1 and 15, `close rc=0`, `gate rc=1`).
- An overridable refusal could only (a) leave the store red with the item out of the active set,
  or (b) make the gate honour a `FORCED_*` marker, which brings back the `closed_by` escape that
  `gate.ts:465-472` removed. Non-overridable is the better answer.
- The way out for a solo developer: a row under any non-author name (their own name, `ci`), or a
  `verifier-blocked` under such a name. probeB case 12 closes; case 13, the same row under
  `implementer`, is refused. The refusal's fix line names neither way out (non-blocking 6).

**A close with no ledger row is still allowed (row 247): agree to leave it out of this item, but
it must be filed.**
- Reproduced: see blocking 2. The gate then prints `[fail] items marked done with no ledger
  verdict at all: demo`, with the fix `record it with 'mstack ledger record'; if no check could be
  run, that verdict is 'verifier-blocked'`.
- Acceptance bullet 2 does not cover zero rows, and the title is about names. Leaving it open does
  not defeat the item: no author verdict passes as an independent one. But it is the same "close,
  then red" shape that row 245 names as the item's hole.
- No follow-up item exists. `state list` has none; the follow-up is only in row 247's "if wrong"
  column.
- The count: with the refusal added (`zerorows.sh`), bun gives `825 pass 50 fail` (the
  implementer said 51).
- The refusal only fires while `require_verdict_to_close` is on, so all 50 tests close with the
  rule on. `tests/helpers.ts:179` defaults it to true, so they rely on the gap; none closes
  through a path that turns the rule off.
- The follow-up should say: "`state set --status done` closes an item with no ledger row while
  `require_verdict_to_close` is on, and the gate then fails it; refuse it at the door with the
  audit's words. The 50 tests that close with no row record a row in their fixture, or turn the
  rule off where the test is about another check."
- `tests/verdict-reader.test.ts:113-118` claims "An item the close lets through must be one the
  gate then passes". That is untrue for zero rows, which its table leaves out.

**All rows, not head only (row 247): agree.**
- This is the audit's own reading. `gate.ts:483` filters rows by target only, and the comment at
  `:474-478` gives the reason.
- Reading head only would refuse this repository's own flow, where the review row's sha comes
  before the coordinator's chore commits. Item 71 (pending) owns "the closing commit is not
  recorded".
- The receipts check still requires a passing run at the closing HEAD and tree.
- probeB case 3 (reviewer, new commit, close): closes and the gate passes. Case 4 (reviewer, new
  commit, implementer row at the new head): closes and the gate passes. The close and the gate
  agree.

## Probe A: names (`probeA.out`, head next to base, each close followed by gate)

Refused at head, gate red after a forced state; at base each one closed:
- `implementer` and the same name in other cases, padded with spaces, or behind a colon prefix:
  `IMPLEMENTER`, `  implementer  `, `mstack:implementer`, `MSTACK:Implementer`,
  `foo:bar:implementer`.
- Spellings of spec author: `Spec Author`, `spec__author`, `spec - author`, `spec-_-author`,
  `spec<NBSP>author`.
- The other refused names: `impl`, `Implementor`, `author`, `developer`, `dev`, `coder`, `self`,
  `SELF`, `me`, `ME`.
- Leading or trailing whitespace: `self `, ` self`, `\tself`, `self\t`, `self\n`, and NBSP, BOM,
  EM SPACE, IDEOGRAPHIC SPACE or NNBSP before `self`/`me`.
- Formula-guarded names and empty roles: `-self-`, `--me`, `-implementer`, `'-self`,
  `implementer:`, `:`, `mstack:`, `reviewer:self`, `ci:dev`, `github-actions:dev`.

Close at head, gate green:
- Near misses and closing names: `dev-ci`, `dev ci`, `dev_ci`, `self-hosted runner`,
  `impl review bot`, `coordinator`, `session`, `review panel`, `orchestrator`, `Maycol`, `claude`,
  `reviewer`.
- Names with punctuation the rule does not ignore: `self.`, `self!`, `(self)`, `"self"`, `'self'`,
  `=self`, `+self`, `@me`, `@self`, `'self`, `''-self`.
- A separator inside the name: `se\tlf` and `se\nlf`, both stored as `se lf`.
- Longer names: `self-review`, `myself`, `my-self`, `the implementer`, `implementer agent`,
  `implementer2`.
- Other Unicode: `spec<EN DASH>author`, `se<ZWSP>lf`, `self<ZWSP>`, `s<ZWJ>elf`,
  `se<SOFT HYPHEN>lf`, full-width `ｓelf`, Cyrillic `sеlf`, `İmplementer`.

The TSV apostrophe:
- At `7d71f2e`, `--verifier=-implementer` is stored as `'-implementer` and gives `old close=0
  gate=0`: a green close under the implementer's own name. At head it gives `close=2 gate=1`. So
  the formula-guard bypass predates this item, and covered the two names that were refused then.
- `-self-` at base gives close 0 and gate 0, but `self` itself closed there.
- Siblings: the writer (`tsv.ts:24-29`) turns tab, CR and LF into one space, trims, and prefixes
  `'` before `-=+@`. The reader removes exactly that one `'`.
- So `=self`, `+self` and `@me` read back as typed and close, because `=+@` are not separators in
  the stated rule. That is consistent with the rule.
- `'-self` typed literally is refused, as row 248's "if wrong" column says.
- No value the writer escapes reads back as a refused name it was not, and none hides one.

## Probe B: every sequence through the CLI (`probeB.out`, `probeB2.out`)

| # | rows | close | gate after |
|---|---|---|---|
| 1 | implementer | 2, author-only | 1, same finding |
| 2 | implementer, reviewer | 0 | 0 |
| 3 | reviewer; new commit | 0 | 0 |
| 4 | reviewer; commit; implementer at new head | 0 | 0 |
| 5 | reviewer failed, reviewer approved | 0 | 0 |
| 6 | reviewer approved, reviewer failed | 2, rejection stands | 1 |
| 7/8 | reviewer citing `impl_demo.md` / `spec_demo.md` | 2, cites own report | 1 |
| 9 | `require_verdict_to_close` off, implementer | 0 | 0 |
| 10 | none (also with `--force --closed-by`) | **0** | **1, no ledger verdict at all** |
| 12/13 | `verifier-blocked` by reviewer / by implementer | 0 / 2 | 0 / 1 |
| 15 | implementer + `--force --closed-by` | 2 | 1 |
| 16/17 | discounted + session approval, either order | 0 | 0 |
| 18 | reviewer `verifier-blocked` citing `impl_demo.md` | 2 | 1 |
| 19 | sdd item, `spec-author` row only | 2, author-only | 1 |

My two sequences against the audit of the same rows on a done item (`probeB2.out`):
- (b) an implementer `verifier-failed` alone. The close says `its only verdicts are from the pass
  that wrote the code (only implementer)`. The audit says `items marked done whose only verdict is
  verifier-failed`. Both refuse, with different reasons.
- (c) a reviewer approval, then the implementer's own `verifier-failed`. Both pass.
- Zero rows (a) is the one sequence where they disagree.

## Probe D: nothing in flight breaks

`ownstore.ts` (read-only; the checkout's porcelain count was 0 before and after) judged every item
with both rules:
```
{ "closedItems": 47, "unclosedNow": [], "unclosedBefore": [], "closedWithNoRows": [], "kindChanged": [] }
"session" true / true  rows=7      "review panel" true / true  rows=5     "reviewer" true / true rows=88
"orchestrator" true / true rows=3  "implementer" false / false rows=86    (+4 single-row names, all true)
```
`./bin/mstack gate` here: `PASSED - 0 failures, 0 warnings`.

A consumer store closed by the base version (`probeD.out`):
- Closed under `dev`, `author` or `self`, the base gate exits 0 and the head gate exits 1:
  `[fail] items closed on a verdict from the pass that wrote the code: demo (only dev)`.
- One reviewer row on the done item turns it green again. `coordinator` stays green.
- The CHANGELOG says which names closed before. It does not say that such stores go red on
  upgrade, or how to clear them (non-blocking 4).

## Probe E: tests

**Seam and environment.**
- `tests/closing-role.test.ts` goes through the CLI (`spawnSync`, explicit `timeout: 30_000` per
  call, `HOME: ""`, `GIT_CONFIG_GLOBAL: "/dev/null"`), and every test has an explicit timeout.
- The appended test is appended, not inserted: its hunks are `@@ -1,6 +1,7 @@` (the import) and
  `@@ -109,3 +110,42 @@`. It uses the module seam (`closingProblems`, `runGate`).
- Both files pass with `HOME=` and `GIT_CONFIG_GLOBAL=/dev/null`, five times per runtime: bun
  `30 pass 0 fail` (about 26.1 s each run), node `pass 30 fail 0` (about 25.3 s each run).

**Durations.**
- bun's slowest tests: `:72` at 9.10-9.16 s, the verdict-reader test at 6.52-6.58 s, `:82` at
  4.40-4.47 s.
- node's slowest: `:72` at 13.5-13.6 s, verdict-reader at 6.9-7.0 s, `:82` at 6.8 s.
- Two tests run longer than bun's 5 s default and pass only through their explicit 300 s and
  120 s timeouts. The margin is wide.

**Red before.** The head test files run against the base src (`timing.out`) give `25 pass 5
fail`, the five tests the report names.

**Mutants** (bun, the two files, in a scratch clone at eb11804, restored after each):
```
I1 no separator normalisation   28 pass 2 fail  "spec author" must not close / Spec_Author alone
I2 formula apostrophe kept      29 pass 1 fail  "-self-" must not close: 1 demo (done)
I3 whole name -> substring      28 pass 2 fail  "dev-ci" must close / dev-ci alone
I4 new refusal removed          25 pass 5 fail  "implementer" must not close: 1 demo (done)
R1 require_verdict_to_close ignored   29 pass 1 fail  with require_verdict_to_close off, ...
R2 refusal overridable by --force     29 pass 1 fail  --force with --closed-by ...: 1 demo (done)
R3 head-only reading                  29 pass 1 fail  only the implementer's row at the new commit ...
R4 no trim in normalisedRole          29 pass 1 fail  "-self-" must not close
```
R3 is caught only by `:138`. `:124` passes under it, because a head with no rows is let through.

## Probe F: the implementer's table

| R | cited | what the line is |
|---|---|---|
| A1 | `closing-role.test.ts:72` | `test("a verdict recorded under a name for the pass that wrote the work is refused at done, with the gate's reason"` |
| A1 | `:82` | `test("a verdict under any other name closes, and the gate agrees afterwards: near misses, ..."` |
| A2 | `:91` | `test("an empty verifier and a whitespace verifier do not close"` |
| A2 | `:109` | `test("--force with --closed-by does not close an item with no independent verdict, ..."` |
| A3 | n/a | prose |

- Each cited line is the test its row names. For A2, `:72` fits better than `:91`, and `:72` is
  already cited under A1.
- A3 as `n/a` is accepted by the gate. But no test pins the wiki's name list to `WROTE_THE_WORK`,
  and the repository does pin wiki promises elsewhere (`tests/cli.test.ts:343`). A test was
  possible; blocking 1 is what one would have caught.
- The implementer's report is 5464 bytes.

## Probe G: docs

- **`GLOSSARY.md:37`:** the gate's glossary line reads `[ok] GLOSSARY.md: 14 entries`. The entry
  is true, except that "compared whole" leaves out the colon rule.
- **The `Gates-and-Hooks.md:290-297` transcript:** it reproduces from one real run. The output
  matches byte for byte apart from the sha, including the 8-space fix line (`probeG.out`, third
  block).
- **The wiki's name list:** it equals the code's ten names. Its extra `spec author` is
  `spec-author` once normalised.
- **`The-CLI.md:470-475`:** true.
- **`skills/ship/SKILL.md:31-35`** ("it will not accept the implementer's own row either") and
  **`skills/review/SKILL.md:52-68`:** still true.

## Verification I ran

- `npm run typecheck`: exit 0.
- `./bin/mstack lint-plugin .`: `PASSED - 0 failures, 0 warnings`.
- `./bin/mstack gate`: `PASSED - 0 failures, 0 warnings`.
- `npm run test:bun`: `875 pass 0 fail`, `Ran 875 tests across 42 files. [194.83s]`.
- `npm run test:node`: `tests 875 pass 875 fail 0`.
- `./bin/mstack ledger check any-role-name-closes` before my row: `FAIL no verdict at eb118049`.
  The only existing row is the implementer's, at 9104c2f.

## Non-blocking (file them)

1. **Zero-row close:** file the follow-up item worded as above. Correct the comment at
   `tests/verdict-reader.test.ts:113-118`.
2. **`normalisedRole` (`roles.ts:178-184`) does not strip format characters, or fold compatibility
   forms.**
   - `se<ZWSP>lf`, `self<ZWSP>`, `s<ZWJ>elf` and `se<SHY>lf` close, and every viewer shows them
     as `self`.
   - `citesImplementingReport` strips `\p{Cf}` for exactly that reason (`roles.ts:212-216,232`).
   - Full-width, Cyrillic and `İ` look-alikes also close.
   - By the stated rule these are different names, and a forger gains nothing over typing
     `reviewer`. Strip `\p{Cf}` and NFKC for parity, or say in the doc comment that it is not
     done.
3. **The colon rule is undocumented.** `roleOf` keeps only the text after the last `:`
   (`roles.ts:25-27`).
   - So `ci:dev`, `github-actions:dev` and `reviewer:self` are refused, and `self:reviewer`
     closes.
   - `GLOSSARY.md:37` says "compared whole", and `Gates-and-Hooks.md:284-285` says "a CI job
     closes".
   - It fails closed. Say "the part after the last `:`", or strip only `mstack:`.
4. **The CHANGELOG has no upgrade note.** Stores closed under `dev`, `author`, `self` or `impl`
   turn red, and one independent row on the done item clears them (probe D).
   - The CHANGELOG also does not say that the gate at `verifying` now fails on author-only rows,
     where the base said nothing (probeB, compared with probeB-old).
   - Nor that `--verifier=-implementer` closed green at the base.
5. **The reason at the door differs from the audit's in two cases:** an implementer
   `verifier-failed` alone (probeB2 b), and a reviewer `verifier-failed` alone (pre-existing).
   Also, the fix line for a `spec-author`-only item says "other than the implementer" (probeB 19;
   the wording is shared with the gate).
6. **The refusal's fix line names no way out.** Row 246 says the way out is `verifier-blocked` or
   an independent approval, but the hint names neither. It also does not say that the row must be
   under a name other than the author's. Suggested: "...; or, if nothing can be run,
   `verifier-blocked` from a pass that did not write it".
7. **The refusal prints the stored cell:** `(only '-implementer)`. Printing the normalised name, or
   the typed one, would read better.
8. **`CHANGELOG.md:7` is one unwrapped long line.**

## What I did not check

- `./bin/mstack gate --full`: the brief reserves it, because it records a run.
- `claude plugin validate . --strict` and `scripts/check-doc-links.mjs`.
- The suite on node 22.6: only node 26.13.1 and bun 1.3.11 are here.
- Other transcripts in the wiki that this change does not touch.
- Concurrent closes.
