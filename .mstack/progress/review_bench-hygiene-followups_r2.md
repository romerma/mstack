# Review - bench-hygiene-followups (round 2)

**Verdict:** APPROVED

Reviewer pass, 2026-11-18, round 2, at HEAD `be33e23f8fb19ea595ffd7a0c2c8b60c4e864cb0`. I did not write this item.
This report follows the leak rule of `sandbox/bench/DESIGN.md:163-167`. It names no hidden value, assertion or patch
content, and it does not say which side or fix is correct. Tests are named by id and line. Entries are named by their
1-based position in the task's current `meta.json` `sentences`.

| Test id | hidden module |
|---|---|
| H3-a | `test_H3.py:128` |
| H3-b | `test_H3.py:151` |
| H4-a | `test_H4.py:128` |
| H4-b | `test_H4.py:121` |
| H4-c | `test_H4.py:176` |

No blocking finding. Round 1's blocking finding 1 is closed. Two points stay non-blocking: one is new (1), and one
was already filed on item 99 and is not made worse (2).

## Non-blocking findings

1. **H4-a `:138` holds only if entry 3 stands for its whole source sentence.**
   - The implementer maps `:138` to H4 entries 3 and 11, and the report says "Entry 3 gives only the output format".
   - Entry 3's stored text is a prefix of `issue.md:7`. It ends at the command's arguments.
   - The part of `issue.md:7` that `:138` follows from comes after the end of that text.
   - `:138` also follows from H4 entry 1 (`issue.md:5`), and entry 1 does not list H4-a.
   - Under the reading DESIGN.md gives (`DESIGN.md:149`, "traceable to a sentence of `issue.md`"), entry 3 is
     `issue.md:7`, and that sentence carries what `:138` needs from the issue. Under that reading the mapping holds.
     Under the clause-by-clause reading the meta uses elsewhere, it does not: H3 entries 8 and 9 are the two halves of
     one `README.md:181` bullet, mapped to different tests.
   - The report qualifies "complete" only by the H4-b reading. This second reading is not named.
   - It does not touch criterion 3, which asks for README sentences. H4-a is already issue-mapped, so nothing a
     check counts depends on it.
   - Cheap fix, tried on a copy (`review49r2/alt2.sh`):
     - add H4-a to H4 entry 1;
     - extend entry 3's text to the whole `issue.md:7` sentence.
     `verify.mjs` then exits 0 with output byte-identical to the live run. No figure moves.
   - Apply it now or add it to item 99. That is the coordinating session's call.
2. **H4-b `:123` rests on entries 7 and 23, by the reading round 1's finding 2 describes. The reading holds.**
   - Entry 23 (`README.md:239`) entails it if an order's line, looked up by sku, counts as an id, and entry 7
     supplies the rest. The template does exactly that: `template-hard/stockroom/domain/orders.py:59-63`, where `Order.line` raises `NotFound` when no line has
     the sku.
   - The other reading also holds: entry 5 (`issue.md:11`, nothing shipped on such a line).
   - I mapped H4-b to entry 5 as well, on a copy (`review49r2/alt.sh`).
     - `verify.mjs` exits 0.
     - Only the issue-mapped denominator moves, 7 to 8: `issue-mapped tests failing 0/8`.
     - So the implementer's statement about the denominator is true, and both readings fit the naive-patch rule.
   - Item 99's third criterion already holds this ("one H4 assertion that reads two ways is settled"). Round 2 did
     not make it worse.

## Criterion 3, assertion by assertion (my own match table)

I opened each test and listed the assertion lines with `rg -n assert`. Then I read each entry's text against
`template-hard/README.md` and `tasks/H{3,4}/issue.md`. "Background" means behaviour of the pristine template that no
sentence of this task needs to state. For example, receiving adds stock, and `AppContext.record` writes an event with
the movement's warehouse and sku (`template-hard/stockroom/app/context.py:28-37`).

| Test | Line | Entailed by entry | Implementer's row | Same? |
|---|---|---|---|---|
| H3-a | `:131` | 9 | 9 | yes |
| H3-a | `:132` | 15 | 15 | yes |
| H3-a | `:133` | 15 | 15 | yes |
| H3-a | `:134` | 16 | 16 | yes |
| H3-b | `:155` | 8, 12 (11 for the save and reload around it) | 8*, 12 | yes |
| H3-b | `:156` | 8, 12 (entry 8's wording is finding 2 of `review_benchmark-hard-tier.md`, left by the design row of 20:21:02) | 8*, 12 | yes |
| H3-b | `:157` | 15 | 15 | yes |
| H3-b | `:158` | 15 | 15 | yes |
| H3-b | `:159` | 16, 11, plus background (receiving) | 16, 11* | yes |
| H4-a | `:138` | 3 read as `issue.md:7`, 11; also 1, which does not list H4-a | 3, 11* | yes, with non-blocking 1 |
| H4-a | `:142` | 5, 7, 22 | 5*, 7*, 22 | yes |
| H4-a | `:143` | 22, 7 | 22, 7* | yes |
| H4-b | `:123` | 7, 23 (reading above), or 5 (not listed) | 7, 23 | yes, with non-blocking 2 |
| H4-b | `:125` | 23, 7 | 7, 23 | yes |
| H4-c | `:179`, `:181` | 25 | 25* | yes |
| H4-c | `:182` | 10, 8 | 10, 8 | yes |
| H4-c | `:183` | 24, 8, 10, plus background (event fields) | 24, 8, 10 | yes |
| H4-c | `:184` | 10, 8 | 10, 8 | yes |
| H4-c | `:185` | 25 | 25* | yes |

Every row of the implementer's table matches mine. The two tests of round 1's blocking finding are now covered:
- H3-b `:155-156` by entry 8;
- H4-a `:142-143` by entries 5 and 7.
The third test, H4-c, is covered at `:179`, `:181` and `:185` by entry 25.

The mappings added beyond round 1's finding:
- **H3-b on H3 entry 11 (`README.md:180`)** holds. Line `:153` saves a state loaded from a version 1 file, and
  `:154` reloads it. Entry 11 states that flow.
- **H4-a on H4 entry 11 (`README.md:163`)** holds. The total that `:138` checks is a credit note total, and entry 11
  defines how it is valued. With the module's own setup (`test_H4.py:20-58`), entry 11 is enough.
- **New H4 entry 25 (`README.md:151`)** holds for `:179`, `:181` and `:185`. Its text occurs verbatim at
  `README.md:151`, and `verify.mjs` finds it. It lists only H4-c.
- None of these changes a count. H3-b and H4-a were already README-mapped, and H4-a was already issue-mapped. See
  the `verify.mjs` comparison below.

Every other source line the report cites is right:
- H3 entry 8 is `README.md:181`, and H3 entry 11 is `README.md:180`.
- H4 entry 5 is `issue.md:11`, H4 entry 7 is `README.md:237`, and H4 entry 11 is `README.md:163`.

## Acceptance, quoted

**"check.mjs creates its scratch root outside every ancestor of a run copy (os.tmpdir() or under BENCH_HOME but not
under runs/), and check.mjs asserts it"** - met. It has not changed since round 1's review:
- `check.mjs` mtime is still 21:25:00, and `DESIGN.md` is still 21:26:04. These are the times round 1's review gives.
- My `diff -u` of the `bench49_before/` copies against both files has the same 44 changed lines as round 1's
  `impl49/diff.txt` (compared as sorted sets).
- The assertion is at `check.mjs:38`.
- `node sandbox/bench/check.mjs` exits 0 with 91 `ok` and 0 `FAIL`. It prints the scratch-root assertion as `ok`.

**"DESIGN.md states the widened leak rule: committed text names no hidden values, assertions, patch contents, nor
which side or fix is correct; and states that self-checks are not run while a batch is running"** - met.
- The text is unchanged since round 1, as shown above. The rule is at `DESIGN.md:163-167` and the self-check line at
  `:169-170`.
- The committed text of round 2 follows it. I read:
  - the round 2 report;
  - decision rows 260 and 261;
  - the subjects of the five commits `4f64623..be33e23` (subjects only, no bodies);
  - the `state.json`, `current.md` and `ledger.tsv` diffs.
- No value, assertion or patch content appears, and nothing says which side or fix is correct. The report describes
  tests in structural terms only ("selection of new events by sequence number"), the same level as finding 1.
- The pasted `diff -u` shows test ids, entry ids and public README and issue sentences, and no hidden test code.

**"the five hidden tests that check more than their mapped sentence get the extra README sentences in meta.json
(review_benchmark-hard-tier.md finding 1), verify.mjs still green"** - met.
- Every README sentence an assertion of the five tests needs now lists that test. See the table above. H4-b `:123`
  rests on a reading that holds (non-blocking 2).
- `verify.mjs` exits 0. Against the rebuilt round 1 state, only H4's sentence count moved.

**"README v1 discount wording vs the v1 fixture (finding 2) and the cosmetic items (finding 3) are fixed only if the
hard tier is re-baselined; otherwise a decision row records leaving them"** - met.
- The design row 2026-11-18T20:21:02.123Z (`.mstack/decisions.tsv:258`) records leaving them. Round 2 did not
  re-baseline.
- Of the 51 files of `bench49_before/`, all but the four that round 1 changed are byte-identical to `sandbox/bench/`.
- No file under `template/` or `template-hard/` changed after 2026-11-02.

## The claim and the rows

- **The report's claim** "No assertion of the five tests is left without an entry, with the one reading on H4-b :123
  named above. On that basis the trace of these five tests is complete." (`impl_bench-hygiene-followups_r2.md:52`)
  is true under the sentence reading of `DESIGN.md:149`. It leaves out the second reading, H4-a `:138`
  (non-blocking 1).
- **The round 2 implement row** (`.mstack/decisions.tsv:261`) does not repeat the word "complete". It points to the
  report's match. It corrects the earlier claim in its own words ("the earlier claim that the extra sentences made
  the trace complete was wrong for three tests and is corrected here"). The round 2 design row (`:260`) also corrects
  the first design row's "under runs/" (round 1's non-blocking 7). So the earlier claim does not stand alone.
- **The implementer's ledger row** (`.mstack/ledger.tsv:208`) is `test-verified` at `6f15657`, with its report as
  evidence. That matches what the report says it ran: two real self-check scripts, run after its last edit, both
  exit 0. By the evidence ladder ("The claim held at rung 4"), `test-verified` is the right token. My reruns give the
  same output.

## Requirement-to-test table and gate

The report carries the whole `| R | Test | Where |` table, A1 to A4, each `n/a:`. Each reason is true:
- A1: `check.mjs` is unchanged and gives 91 ok.
- A2: `DESIGN.md` is unchanged, and the report follows it.
- A3: `verify.mjs` exits 0 with the same pass counts, and the files are untracked under `sandbox/`.
- A4: the design row is at the time cited.

The round 2 report is 7898 bytes (`wc -c`), under the cap.

## Verification I ran

No batch was running: `pgrep -f run.mjs` found nothing before each script. Everything ran at HEAD `be33e23`.
Scripts and outputs are in the session scratchpad folder `.../scratchpad/review49r2/`.
```
diffs.sh       meta.json vs bench49_r1/: the same hunks as the report's pasted diff (H3 entries 8, 11; H4 entries 5, 7, 11, new 25)
               bench49_before/ vs sandbox/bench, minus check.mjs, DESIGN.md, H3/H4 meta.json: 47 files, all identical
               files under sandbox/bench changed in the last 3 h (fd -HI, minus results/streams/evidence): only those 4
run_checks.sh  node verify.mjs  exit 0, "all checks passed"
                 H3 trace: 16 sentences, 18 tests (9 from issue.md, 9 from README.md), all mapped
                 H3 naive: visible 202/202, issue-mapped tests failing 0/9, README-mapped tests failing 4/9
                 H4 trace: 25 sentences, 26 tests (7 from issue.md, 20 from README.md), all mapped
                 H4 naive: visible 202/202, issue-mapped tests failing 0/7, README-mapped tests failing 9/20
               node check.mjs   exit 0, 91 ok, 0 FAIL, "all harness checks passed"
               sha1 of all 306 files under sandbox/bench before and after both runs: identical; no bench-* temp entry left
r1_compare.sh  round 1 state rebuilt in a copy (sandbox/bench minus results/streams/evidence, plus bench49_r1/'s two files)
               verify.mjs exit 0; the only differing line of the whole output:
               <   H4 trace: 24 sentences, 26 tests (7 from issue.md, 20 from README.md), all mapped
               >   H4 trace: 25 sentences, 26 tests (7 from issue.md, 20 from README.md), all mapped
               summary.mjs over results/results.tsv and results-calibration.tsv, round 1 meta vs round 2 meta:
               identical, 30 and 12 lines
alt.sh         copy with H4-b also on H4 entry 5: verify exit 0; H4 issue-mapped 0/7 -> 0/8, nothing else moves
alt2.sh        copy with H4-a also on H4 entry 1, entry 3 = whole issue.md:7: verify exit 0, output identical
r1files2.sh    check.mjs + DESIGN.md vs bench49_before/: same 44 changed lines as round 1's impl49/diff.txt
./bin/mstack gate         PASSED - 0 failures, 0 warnings
./bin/mstack gate --full  exit 0; store verify: tests 891, pass 891, fail 0; PASSED - 0 failures, 0 warnings
./bin/mstack ledger check bench-hygiene-followups   (before my row)
  FAIL no verdict at be33e23f; 3 row(s) exist at other SHAs and a new head SHA voids them
```
The `gate --full` suite proves only that nothing in the repository broke. This item changes no plugin code.

## Where each claim stopped on the evidence ladder

- Rung 4, all run by me:
  - `verify.mjs` on the live tree, on the rebuilt round 1 state and on two altered copies;
  - `check.mjs`;
  - the `summary.mjs` comparison;
  - the hash and temp-entry snapshots;
  - the file comparisons;
  - both gates.
- Rung 3: the entailment judgement in the match table. It is a reading of the five tests against `README.md`,
  `issue.md` and `meta.json`. No check can execute it, and `verify.mjs` proves only that each text occurs and each
  test is mapped.

## What I did not check

- The other 39 hidden tests of H3 and H4. Item 99 holds them.
- Whether a solver reading the README alone would infer the background behaviour I leaned on. I took it from the
  template's own code.
- The implementer's own run outputs in `impl49r2/`, beyond confirming they exist. I reran both checks myself.
