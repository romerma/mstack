# Review - benchmark-hard-tier

**Verdict:** APPROVED

Reviewer pass, 2026-11-08, at HEAD `d6cc37b714cf53d4d8609a6bfb37f1137f874101`. I did not write this item. The work
sits under `sandbox/bench/` (gitignored). This report is value-free: it holds no hidden-test names, no expected values, no
assertions, no patch contents and no trap directions. The value-bearing detail (a per-test table, the mapping gaps
by test name, the stream greps) is in `sandbox/bench/evidence/review_benchmark-hard-tier_detail.md`.

Nothing blocks. Five findings are non-blocking: three are small defects in the tier or harness, one is an
observation about the leak rule, and one is a transient exposure that my own review caused during the live batch.
The coordinator has two follow-ups (see "For the coordinator").

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A1 size | Source-line floor check | `sandbox/bench/verify.mjs:101`. I ran it: 1938 non-blank lines outside tests (2367 with blanks, 40 files). |
| A1 both kinds of hidden test | Hard task needs issue- and README-mapped tests | `verify.mjs:75`. Each of the 4 modules has a reported-behaviour class and a documented-behaviour class (`tasks/H1/hidden/test_H1.py:34`/`:83`, `H2 :37`/`:87`, `H3 :47`/`:111`, `H4 :61`/`:148`). |
| A1 trap | Naive patch keeps the visible suite green, passes every issue-mapped test, fails at least one README-mapped test, and every hard task ships one | `verify.mjs:89-91`, `:105`. I mutated a copy and these guards went red (see Verification). I also ran each hidden test on its own against the naive patches (detail file). |
| A2 trace | Each sentence must appear verbatim in its source, and each hidden test must be mapped | `verify.mjs:67`, `:70`, `:73`. Mutating a copy turned both checks red. I also read all 78 hidden tests against both documents (see Fairness). |
| A2 reference passes, pristine fails | Pristine count equals the pin, and the reference passes hidden and visible | `verify.mjs:53-55`. Changing a pin on a copy turned it red. The per-test run confirms the pristine passes are exactly the guard tests. |
| A3 | Results files plus decision rows | `results-calibration.tsv` (8 rows), `results.tsv` (4 plain rows for the final tier), decision rows 2026-11-01T22:27:19, 22:43:11 and 2026-11-08T11:01:12 |
| A4 tooling | Summary shows one block per tier, with the solved rate first | `summary.mjs:31-33`, `check.mjs:183-191`. I ran it on a copy of the real results. |

## Acceptance, quoted

**"3-4 tasks on a larger template (at least ~2k lines, more than one plausible place to fix), written as symptoms a
user would report, with hidden tests for the reported behaviour plus regression tests on existing documented
behaviour, and at least one trap where the obvious fix breaks something else"** - met.
- There are four tasks, H1-H4. The template has 1938 non-blank source lines, which I read as "~2k".
- Each bug has at least two plausible fix sites: the quote path or the invoice path (H1), the report or the
  invoices (H2), and in H3 the encoder, the decoder, the v1 migration or the shared sanitiser. H4 cuts across
  domain, app, codec and CLI.
- The H1-H3 issues describe symptoms and include a guess that the reporter labels as a guess. H4 is a feature
  request that names its API.
- The trap is real. Every naive patch passes all of its issue-mapped tests and fails README-mapped ones (5, 2, 4
  and 9).
- "Breaks something else" in the strict sense means a README test that passes on pristine and fails with the
  naive patch. That holds for H2 and H3 (2 and 3 such tests), and for H4 in substance.
- H1's naive-failing README tests also fail on pristine. Its trap therefore catches agreement in the wrong
  direction rather than a regression (detail file). A1 asks for at least one trap, so this is met.

**"every hidden test traces to the issue or to behaviour the template's README or visible tests already document;
reference patches pass them and the pristine template fails them"** - met.
- verify.mjs proves verbatim sentences and full mapping. I read the tests themselves, and every assertion follows
  from a sentence in `issue.md` or `template-hard/README.md`, or from an API that the visible tests already use.
- Five tests assert more than the one sentence they are mapped to (finding 1). The extra assertions still follow
  from other README sentences.
- The reference patches pass 18/18, 16/16, 18/18 and 26/26. The pristine template passes 4, 8, 9 and 0, all pinned.
  The pristine passes are only "not affected" guards and regression tests, which is the same convention as T1.

**"a calibration run shows whether plain solves every hard task across at least two repetitions; if it does, the
tier is made harder once and recalibrated, and if plain still solves every task the user decides how the tier is
used (decision row)"** - met.
- Calibration: `results-calibration.tsv` holds 8 plain rows, H1-H4 at reps 1 and 2. All are solved, all
  `perm=auto`, all against the round-1 tier.
- Hardened once: implementer round 2 and the decision row of 2026-11-01T22:27:19.
- Recalibrated: `results.tsv` has plain H1-H4 r1 at 22:37:49-22:42:45 UTC, all solved.
- The recalibration ran on the current tier. The newest file in template-hard, tasks/H* and reference/H* dates
  from 22:34:17 UTC, before the first recalibration row.
- The user decided: triage row 2026-11-08T11:01:12.899Z ("Aceptar techo"). I can see that the row exists, but I
  cannot observe the user's answer itself (rung 2).

**"the hard-tier baseline (plain and mstack-before, repetitions recorded with mstack decide) is summarised with
solved rate first, then cost"** - I checked the tooling only, as the brief scoped. `summary.mjs` prints
`== easy tier ==` and then `== hard tier ==`. Its columns are arm, runs, solved, mean_hidden, regressions,
cost_usd, tokens, turns, errors. The numbers and the decide rows for A4 belong to the coordinator.

## Brief points

1. **Fairness: met.**
   - Forward direction: every hidden test follows from its issue or the README. No test needs knowledge that
     neither document gives. Hidden tests call only APIs that the visible suite or the issue already shows.
   - No issue gives the answer away. Each H1-H3 issue says it does not know which side is wrong or what else
     depends on the code. The H2 and H3 guesses do point at where the code is, but not at the correct fix.
   - Reverse direction: each reporter guess, followed literally, contradicts a README rule that states the
     opposite. None is wrong without a README rule that says so.
   - H3 accepts several fixes: encoder-side, decoder-plus-migration, or a new discount kind. I traced each one,
     and no hidden test pins one of them.
   - One wording wrinkle can mislead: `template-hard/README.md:181` describes the v1 discount key as a
     "whole-percent number", but the visible fixture `tests/fixtures/v1_full.json:21` holds a fractional value
     (finding 2).
2. **Traps are real: met.**
   - I ran `verify.mjs` myself and ran each hidden test alone against the pristine, reference and naive variants.
     The naive patches fail 0 issue-mapped tests and 5/9, 2/9, 4/9 and 9/19 README-mapped ones. The visible suite
     stays at 202/202.
   - No visible test exercises a trap rule. Mechanically, all four naive patches keep the visible suite green. By
     reading, I found that:
     - the visible pricing tests avoid break boundaries and box lines with breaks;
     - the visible invoice and report tests use single lines or exact tax;
     - the visible rendering and v1 tests use ASCII names and never read a v1 discount;
     - no visible test receives into a deactivated warehouse.
   - `test_tax.py` does exercise per-line rounding of the tax function itself. That is a hint, not the trap,
     because the naive patch leaves the function alone.
3. **Leak hygiene: met at rest, with one transient exposure (finding 5).**
   - A run copy receives only `template-hard` (`run.mjs:98`, `lib.mjs:81` drops `__pycache__`). It gets a fresh
     `git init` and is deleted after scoring (`run.mjs:195`).
   - template-hard holds no answer files and no caches. I scanned it, hidden files included.
   - At 11:14:40 UTC an fd scan of `/private/tmp` and `/var/folders` (live `runs/` excluded) found no hidden
     module, patch, diff or solution file.
   - The answers stay in the checkout's `sandbox/bench/`, outside BENCH_HOME. That is the residual item 38
     accepted.
   - The two committed reports hold no hidden-test name, string literal or number. Every number in them is a
     count, a line number or a cost (detail file). They do state trap directions (observation 4).
4. **Harness: met.**
   - T1-T6 `meta.json` carry tier, template and pins 5/0/0/0/0/0. Their trace counts are 5/9, 4/9, 12/13, 10/9,
     5/5 and 5/9. Both match the item-38 numbers in `impl_benchmark-harness.md:45-56`.
   - Scoring is unchanged in behaviour. I rescored all 29 saved run diffs (24 easy, 5 hard) with the current
     `lib.score`, and every recorded hidden_pass, hidden_total, solved, visible_ok and regressions value came back
     identical.
   - `summary.mjs` prints one block per tier with solved first. `check.mjs` is green with 90 ok lines.
5. **A1, A2 and A3 as amended: met (above). A4: the tooling works.**

## Verification I ran

`./bin/mstack gate` passed with 0 failures and 2 warnings (on main; 6 uncommitted changes). I did not run
`gate --full`. Its store verify is the npm suite, which the brief scoped out because this item does not touch
plugin code, and node is not on PATH. The item has no `verification` field. Its real checks are the two below.

`bun sandbox/bench/verify.mjs`, exit 0, 13.8 s (hard and tail lines; the easy lines match the counts above):
```
pristine visible suite of template-hard: 202/202 OK
pristine visible suite of template: 18/18 OK
H1 [hard, template-hard]: pristine hidden 4/18 pass (pinned 4), reference hidden 18/18 pass, visible after patch 202/202
  H1 trace: 13 sentences, 18 tests (9 from issue.md, 9 from README.md), all mapped
  H1 naive: visible 202/202, issue-mapped tests failing 0/9, README-mapped tests failing 5/9
H2 [hard, template-hard]: pristine hidden 8/16 pass (pinned 8), reference hidden 16/16 pass, visible after patch 202/202
  H2 trace: 14 sentences, 16 tests (7 from issue.md, 9 from README.md), all mapped
  H2 naive: visible 202/202, issue-mapped tests failing 0/7, README-mapped tests failing 2/9
H3 [hard, template-hard]: pristine hidden 9/18 pass (pinned 9), reference hidden 18/18 pass, visible after patch 202/202
  H3 trace: 14 sentences, 18 tests (9 from issue.md, 9 from README.md), all mapped
  H3 naive: visible 202/202, issue-mapped tests failing 0/9, README-mapped tests failing 4/9
H4 [hard, template-hard]: pristine hidden 0/26 pass (pinned 0), reference hidden 26/26 pass, visible after patch 202/202
  H4 trace: 21 sentences, 26 tests (7 from issue.md, 19 from README.md), all mapped
  H4 naive: visible 202/202, issue-mapped tests failing 0/7, README-mapped tests failing 9/19
T1 [easy, template]: pristine hidden 5/9 pass (pinned 5), reference hidden 9/9 pass, visible after patch 18/18
...
template-hard: 1938 non-blank source lines outside tests (minimum 1800)
hard tasks with a naive patch: 4 of 4 (every hard task needs one)

all checks passed
```

To check that the guards fail when the work is reverted, I mutated an rsync copy of `sandbox/bench` under
`/var/folders` and ran `verify.mjs` on it. The copy is deleted. Each mutation exited 1 with its named failure, and
the unmutated copy exited 0:
```
M1 naive := reference (H2)              FAIL ... passes every README-mapped test, so there is no trap
M2 H1 naive removed                     FAIL only 3 of 4 hard tasks ship a naive patch
M3 H1 pin off by one                    FAIL H1: pristine hidden pass count is 4, meta.json pins 5
M4 a test left unmapped (H4)            FAIL ... has no sentence in meta.json
M5 a README sentence edited (H3)        FAIL H3: sentence not found in README.md: ...
M6 H2 naive = the reporter's guess only FAIL H2: the naive patch fails issue-mapped test(s): ...
M7 H1 naive plus a visible break        FAIL H1: the naive patch breaks the visible suite ...
M0 unmutated copy                       exit 0
```

`bun sandbox/bench/check.mjs`: exit 0, 90 `ok`, 0 `FAIL`, ending in `all harness checks passed`. Hard block:
```
  ok   H1: the hidden module is scored, 18/18 with the reference patch
  ok   H1: an untouched copy scores the pinned pristine count (4) and is not solved
  ok   H1: deleting tests/ cannot hide anything, the originals and fixtures are restored
  ok   H2: the naive patch scores 14/16: more than pristine, not solved, visible suite green
  ok   an unknown task id "../T1" is refused
  ok   dry run on a hard task prepares a template-hard copy and calls no claude
  ok   one table block per tier, easy first
  ok   second column after arm/runs is solved: arm runs solved mean_hidden regressions cost_usd tokens turns errors
```

I rescored the saved diffs with `bun rescore.mjs` (a scratch script that calls `lib.score` on every saved
`streams/<run_id>.diff` applied to a fresh template copy, using a scratch BENCH_HOME):
```
rescored: 29 identical, 0 different, 0 skipped
```

`bun sandbox/bench/summary.mjs <scratch copy of results.tsv>`. This is a snapshot at about 11:07 UTC: the batch
had one mstack-before row at the time. Hard block:
```
== hard tier ==
arm            runs  solved   mean_hidden  regressions  cost_usd  tokens      turns   errors
plain          4     4/4      1.00         0/4          0.45      374015      11.5    0
mstack-before  1     1/1      1.00         0/1          1.02      1218006     23.0    0
```
The easy block matches the item-38 baseline exactly: 12/12 and 12/12, $0.24 against $1.49.

Dry runs used a scratch BENCH_HOME and BENCH_OUT. `plain` on H1 and H4, `plain` on T1 and `mstack-before` on H2
each printed `template: template-hard` (or `template` for T1). They showed `git log in copy: <sha> template` and
`dry run: claude was not invoked, no results row written`. For mstack-before, `.mstack/` came from
`versions/before` setup with `state.verify` set to the unittest command.

`./bin/mstack ledger check benchmark-hard-tier` returned `PASS test-verified at d6cc37b7 by implementer`. Both
implementer rows are at the current HEAD.

## Non-blocking findings

1. **The trace is incomplete for five tests**: `tasks/H3/meta.json:64`, `:86` and `tasks/H4/meta.json:24`,
   `:49`, `:70`.
   - Each of these tests also asserts behaviour from README sentences that are not in its mapping: names and
     notes kept exactly, v1 stock read as on-hand, the CLI error convention, and event warehouse and order id.
   - Fairness holds, because every assertion still has a source.
   - Fix: add those sentences to each test's mapping. This changes neither the tests nor anything a solver sees.
     Test names and sentences are in the detail file.
2. **README wording**: `template-hard/README.md:181` ("whole-percent") against the fractional value in
   `tests/fixtures/v1_full.json:21`.
   - A solver who converts as an integer fails two hidden README-mapped tests.
   - The risk is low, because the pristine decoder already shows the right conversion and plain solved H3 in all
     3 calibration runs.
   - Rewording now would change the tier mid-baseline. Fix it only if the tier is ever re-run.
3. **Cosmetic**:
   - The H1 regression test at `tasks/H1/hidden/test_H1.py:93` is named for a one-unit gap but tests a one-box
     gap. The assertion is right; only the name is wrong.
   - New-file headers in `reference/H4.patch:86,:203` and `reference/H4.naive.patch:1,:106` carry a stray `a/pb/`
     prefix. They still apply.
   - `summary.mjs:42` derives the "starts at" note from the current meta, so it is stale for the archived
     `results-calibration.tsv`.
   - Optional: have `verify.mjs:86-91` also print how many README tests pass on pristine and fail with the naive
     patch. That separates true-regression traps (H2 and H3) from wrong-direction ones (H1).
4. **Observation: committed text states trap directions.**
   - Neither committed report contains values, assertions or patch contents, so the rule in `DESIGN.md:161-166`
     holds.
   - But `impl_benchmark-hard-tier_r2.md` (the "Per task" table) names which README rule each guess violates,
     and what the naive patches do.
   - The uncommitted decision rows of 2026-11-01T22:27:19 and 22:43:11 say which side of H2 is right.
   - None of this is a value. Whether "answer direction" belongs under the leak rule is the user's call before
     these rows are committed.
5. **A transient exposure, caused by this review.**
   - While the mstack-before batch was running, my per-test runs, my rescoring and `check.mjs` put hidden modules,
     solved diffs and test names under `/private/tmp`. That directory is `../../..` of every run copy, and each
     window lasted seconds to minutes.
   - `check.mjs:10` hardcodes `/private/tmp/bench-check-` as its root. It also does this whenever it runs during a
     batch, and that root predates item 48.
   - I grepped the streams read-only for any path outside each run's own dir (detail file). H1 (finished), H2
     (finished, overlapped the windows) and H3 (finished) show none.
   - Fix (harness): create the check.mjs root under `os.tmpdir()` (a `/var/folders` path here, not an ancestor
     of the runs), or do not run self-checks during a batch.

## For the coordinator

- Before trusting the H4 baseline row, grep the finished `streams/mstack-before-H4-r1-20261108T111807Z.jsonl` the
  same way. Its start overlapped by seconds with the last scratch file being deleted.
- Decide observation 4 before you commit the decision rows.

## Where each claim stopped on the evidence ladder

- Rung 4, run by me on this checkout's real `sandbox/bench`:
  - verify.mjs and its seven mutations;
  - the per-test pristine/reference/naive outcomes;
  - check.mjs;
  - the rescoring of all 29 saved diffs;
  - summary.mjs on the real results;
  - the dry runs;
  - the temp-dir answer scan;
  - the stream greps (H1, H2, H3).
- Rung 3, by walking the code, not by running a solver:
  - the fairness reading of all 78 hidden tests against the issues and the README;
  - the alternative-fix analysis for H3;
  - "no visible test exercises a trap rule", beyond the mechanical naive-green proof.
- Rung 2: the user's answer behind the 2026-11-08 triage row. I see the row, not the answer.
- Not checked: the A4 numbers, which are the coordinator's and still being produced.
