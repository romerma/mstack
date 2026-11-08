# Implementer report: item 48 benchmark-hard-tier

Verdict rung: test-verified (the harness self-checks and the visible suite were run and are green; no real
claude call was made, so calibration and baseline are not done and are not claimed).

## What changed

Added a hard tier to the local benchmark in `sandbox/bench/` (gitignored, never pushed). A new template,
`template-hard/`, is a multi-warehouse stockroom in hexagonal style with a README of many documented rules, a
large visible suite and four tasks, H1 to H4, each with an issue written as a symptom, a hidden module split into
reported-behaviour tests and documented-behaviour regression tests, a reference patch, and (for H2 and H3) a
naive patch. The harness was generalised: `meta.json` now carries `tier`, `template` and `pristine_pass` (T1 to
T6 gained them, with the counts `verify.mjs` used to hardcode), sentence entries carry a `source` (`issue.md` by
default, or the template `README.md`), `run.mjs` and `lib.mjs` accept any task that has a `meta.json` and copy and
score against that task's template, `verify.mjs` discovers tasks and enforces the trap rule, `summary.mjs`
prints one block per tier, `check.mjs` gained a fake-claude end-to-end run on hard tasks, and `DESIGN.md`
documents the tiers, the naive-patch rule and the leak rule. The easy tier is unchanged: same ids, same scoring,
same results columns, and `summary.mjs` still prints the existing 24 easy rows.

Structure of the tasks (values deliberately omitted, see the gitignored detail file):

| Task | Kind | Hidden tests | From issue / from README | Trap patch |
|---|---|---|---|---|
| H1 | bug, one rule in two code paths | 14 | 5 / 9 | none (not required) |
| H2 | bug, which side is wrong | 14 | 5 / 9 | naive patch, fails 3 README-mapped tests |
| H3 | bug, persistence with v1 back-compat | 14 | 6 / 8 | naive patch, fails 3 README-mapped tests |
| H4 | feature, cross-cutting (partial returns) | 21 | 7 / 14 | none (not required) |

Each trap rule is stated in `template-hard/README.md` and is exercised by no visible test; mechanically, both
naive patches keep the visible suite green and pass every issue-mapped hidden test, yet fail README-mapped ones.
The seeded bugs keep the visible suite green. Structure of the regression coverage: H1 has regression tests on the
inclusive break boundary, on the units-not-boxes comparison, on each-sold products and on price lists; H2 on
per-line rounding in both tax modes, on multi-invoice days, grouping by region and the zero day; H3 on v1 fixture
loading, byte-identical loading, v1-to-v2 on next save and optional keys; H4 on warehouse of origin, audit events,
per-line credit rounding, the `returned` status machine, restart persistence and rejected-means-unchanged.

## Files

Created (all under `/Users/romerma/Code/mstack/sandbox/bench/`):
- `template-hard/README.md`, `template-hard/stockroom/**` (30 Python modules, 1890 non-blank lines outside tests),
  `template-hard/tests/**` (13 visible test modules, `support.py`, `fixtures/v1_small.json`, `fixtures/v1_full.json`)
- `tasks/H1..H4/issue.md`, `tasks/H1..H4/meta.json`, `tasks/H1..H4/hidden/test_H<n>.py`
- `reference/H1.patch`, `reference/H2.patch`, `reference/H3.patch`, `reference/H4.patch`,
  `reference/H2.naive.patch`, `reference/H3.naive.patch`
- `evidence/impl_benchmark-hard-tier_detail.md` (gitignored, has the answers)

Modified (same directory): `lib.mjs`, `run.mjs`, `verify.mjs`, `summary.mjs`, `check.mjs`, `DESIGN.md`,
`tasks/T1..T6/meta.json` (three added fields only, sentence maps untouched).

Outside `sandbox/bench/`: this report and the ledger row only. Nothing committed. I did not touch
`.mstack/progress/current.md`; the coordinator owns it.

One deliberate edit to an existing check: the "summary leads with the solved rate" check in `check.mjs` read the
first output line as the table header. Output now starts with a tier heading, so the check finds the header line
instead, and a new assertion requires one block per tier with easy first. The column-order assertions are
unchanged.

## Commands

`bun sandbox/bench/verify.mjs` (full output):

```
pristine visible suite of template-hard: 197/197 OK
pristine visible suite of template: 18/18 OK
H1 [hard, template-hard]: pristine hidden 4/14 pass (pinned 4), reference hidden 14/14 pass, visible after patch 197/197
  H1 trace: 11 sentences, 14 tests (5 from issue.md, 9 from README.md), all mapped
H2 [hard, template-hard]: pristine hidden 9/14 pass (pinned 9), reference hidden 14/14 pass, visible after patch 197/197
  H2 trace: 12 sentences, 14 tests (5 from issue.md, 9 from README.md), all mapped
  H2 naive: visible 197/197, issue-mapped tests failing 0/5, README-mapped tests failing 3/9
H3 [hard, template-hard]: pristine hidden 8/14 pass (pinned 8), reference hidden 14/14 pass, visible after patch 197/197
  H3 trace: 10 sentences, 14 tests (6 from issue.md, 8 from README.md), all mapped
  H3 naive: visible 197/197, issue-mapped tests failing 0/6, README-mapped tests failing 3/8
H4 [hard, template-hard]: pristine hidden 0/21 pass (pinned 0), reference hidden 21/21 pass, visible after patch 197/197
  H4 trace: 16 sentences, 21 tests (7 from issue.md, 14 from README.md), all mapped
T1 [easy, template]: pristine hidden 5/9 pass (pinned 5), reference hidden 9/9 pass, visible after patch 18/18
  T1 trace: 5 sentences, 9 tests (9 from issue.md, 0 from README.md), all mapped
T2 [easy, template]: pristine hidden 0/9 pass (pinned 0), reference hidden 9/9 pass, visible after patch 18/18
  T2 trace: 4 sentences, 9 tests (9 from issue.md, 0 from README.md), all mapped
T3 [easy, template]: pristine hidden 0/13 pass (pinned 0), reference hidden 13/13 pass, visible after patch 18/18
  T3 trace: 12 sentences, 13 tests (13 from issue.md, 0 from README.md), all mapped
T4 [easy, template]: pristine hidden 0/9 pass (pinned 0), reference hidden 9/9 pass, visible after patch 18/18
  T4 trace: 10 sentences, 9 tests (9 from issue.md, 0 from README.md), all mapped
T5 [easy, template]: pristine hidden 0/5 pass (pinned 0), reference hidden 5/5 pass, visible after patch 18/18
  T5 trace: 5 sentences, 5 tests (5 from issue.md, 0 from README.md), all mapped
T6 [easy, template]: pristine hidden 0/9 pass (pinned 0), reference hidden 9/9 pass, visible after patch 18/18
  T6 trace: 5 sentences, 9 tests (9 from issue.md, 0 from README.md), all mapped
template-hard: 1890 non-blank source lines outside tests (minimum 1800)
hard tasks with a naive patch: 2 (minimum 2)

all checks passed
verify exit 0
```

`bun sandbox/bench/check.mjs` (hard-tier block, summary block and the tail; 90 `ok` lines, 0 `FAIL`):

```
hard tier end to end with a fake claude
  ok   H1: run succeeded and wrote a row
  ok   H1: the run output names template-hard as the template
  ok   H1: the hidden module is scored, 14/14 with the reference patch
  ok   H1: template-hard's visible suite scored ok, no regressions
  ok   H1: the saved diff is against the template-hard copy, not the easy template
  ok   H1: the copy lives in its own run dir under BENCH_HOME
  ok   H1: an untouched copy scores the pinned pristine count (4) and is not solved
  ok   H1: deleting tests/ cannot hide anything, the originals and fixtures are restored
  ok   H2: the naive patch scores 11/14: more than pristine, not solved, visible suite green
  ok   an unknown task id "H9" is refused
  ok   an unknown task id "T7" is refused
  ok   an unknown task id "../T1" is refused
  ok   an unknown task id "" is refused
  ok   dry run on a hard task prepares a template-hard copy and calls no claude
summary leads with the solved rate
  ok   one table block per tier, easy first
  ok   second column after arm/runs is solved: arm runs solved mean_hidden regressions cost_usd tokens turns errors
  ok   then hidden ratio, regressions, cost, tokens, turns
...

all harness checks passed
check exit 0
```

`bun sandbox/bench/run.mjs --arm plain --task H1 --dry-run` (prompt body elided, rest verbatim):

```
arm=plain task=H1 rep=1 version=- run_id=plain-H1-r1-20261101T215808Z
cwd:  /private/tmp/mstack-bench-home/runs/plain-H1-r1-20261101T215808Z
template: template-hard (copied from /Users/romerma/Code/mstack/sandbox/bench/template-hard)
claude 2.1.316 (Claude Code) at /Users/romerma/.local/bin/claude
child env (built from scratch):
  PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/Users/romerma/.bun/bin:/Users/romerma/.local/bin
env -i <that env> sh -c 'command -v mstack || echo no-mstack' -> no-mstack
command: env -i <that env> /Users/romerma/.local/bin/claude -p '<H1 issue text + unattended suffix, elided here>' --model opus --output-format stream-json --verbose --setting-sources project --strict-mcp-config --max-budget-usd 8 --permission-mode auto
git log in copy: e8520b7 template
no .mstack/ in the plain arm: true
dry run: claude was not invoked, no results row written
```

Source size and visible suite time, from `python3 -m unittest discover -s tests` in `template-hard/` and from
`verify.mjs`:

```
template-hard: 1890 non-blank source lines outside tests (minimum 1800)
Ran 197 tests in 0.600s
OK
(wall time about 0.66 s)
```

`bun sandbox/bench/summary.mjs` on the real `results/results.tsv` (24 easy rows, no hard rows yet):

```
== easy tier ==
arm            runs  solved   mean_hidden  regressions  cost_usd  tokens      turns   errors
plain          12    12/12    1.00         0/12         0.24      149219      6.2     0
mstack-before  12    12/12    1.00         0/12         1.49      1332343     15.2    0

solved by task (solved/reps)
arm            T1     T2     T3     T4     T5     T6     
plain          2/2    2/2    2/2    2/2    2/2    2/2    
mstack-before  2/2    2/2    2/2    2/2    2/2    2/2    

hidden pass ratio by task (mean over reps; T1 starts at 0.56, their guard tests pass untouched)
arm            T1     T2     T3     T4     T5     T6     
plain          1.00   1.00   1.00   1.00   1.00   1.00   
mstack-before  1.00   1.00   1.00   1.00   1.00   1.00
```

## R to test

Acceptance bullets of item 48 (the reference to a code line is the check that enforces it; the hidden modules
are the tests):

| R | Test | Where |
|---|---|---|
| A1: 3-4 tasks on a larger template (about 2k lines or at least the 1800 floor), more than one plausible fix place, symptom-style issues, hidden tests for reported behaviour plus README regression tests, and a trap where the obvious fix breaks something | Source-size check (1890 lines, floor 1800); both-kinds-of-test check per hard task; naive patch keeps visible green, passes every issue-mapped test and fails at least one README-mapped test; at least two hard tasks need a naive patch | `sandbox/bench/verify.mjs:100`, `sandbox/bench/verify.mjs:75`, `sandbox/bench/verify.mjs:89`-`sandbox/bench/verify.mjs:91`, `sandbox/bench/verify.mjs:104`; hidden modules `sandbox/bench/tasks/H1/hidden/test_H1.py:33` and `:73`, `H2/hidden/test_H2.py:37` and `:76`, `H3/hidden/test_H3.py:47` and `:86`, `H4/hidden/test_H4.py:61` and `:148` (the two classes in each are the reported-behaviour and the documented-behaviour tests) |
| A2: every hidden test traces to the issue or to README/visible-test behaviour; reference patches pass them; the pristine template fails them | Every `meta.json` sentence must occur verbatim in its source (`issue.md` or the template README) and every hidden test must be mapped; reference passes hidden and visible; pristine hidden pass count equals the pinned `pristine_pass` (so the rest fail) | `sandbox/bench/verify.mjs:67`, `sandbox/bench/verify.mjs:70`, `sandbox/bench/verify.mjs:73`, `sandbox/bench/verify.mjs:53`-`sandbox/bench/verify.mjs:55`; fake-claude end-to-end: reference scores full, untouched copy scores the pinned count, `sandbox/bench/check.mjs:150`-`sandbox/bench/check.mjs:160` |
| A3: calibration run shows plain does not solve every hard task over at least two repetitions | n/a: coordinator runs calibration and baseline with real claude calls | n/a |
| A4: hard-tier baseline for plain and mstack-before, summarised solved rate first then cost | n/a: coordinator runs calibration and baseline with real claude calls. The tooling for it is in place: per-tier `summary.mjs` with solved rate first, `sandbox/bench/check.mjs:187`-`sandbox/bench/check.mjs:189` | n/a |

Harness requirements from the brief (Part 3), for the reviewer:

| Brief item | Where it is checked |
|---|---|
| 1 meta fields, pins removed from verify | `verify.mjs:43`, `verify.mjs:53` (pin comes from meta); T1 5, T2 to T6 0 in `tasks/T*/meta.json` |
| 2 sentence map with `source` | `verify.mjs:60`-`verify.mjs:73` |
| 3 run and score any task id with its template; visible modules run by name | `run.mjs` usage and copy, `lib.mjs` `score`/`runOriginalVisible`; `check.mjs:177` (unknown ids refused), `check.mjs:150`-`check.mjs:160` |
| 4 verify discovers tasks, pinned count, reference, trace, naive rule, two naive minimum, source lines | `verify.mjs:30`-`verify.mjs:104` |
| 5 summary per tier, derived "starts at" note | `summary.mjs`; `check.mjs:187` |
| 6 fake-claude end-to-end on a hard task | `check.mjs:150`-`check.mjs:181` |
| 7 DESIGN.md | `DESIGN.md`, section "Hard tier (item 48, 2026-11-01)" |

## Could not do, or worth knowing

- Calibration (A3) and the baseline (A4) need real claude calls and are the coordinator's. Nothing here says plain
  fails any hard task; that is untested. If plain solves everything, the tier needs hardening before any comparison.
- H1 and H4 ship no naive patch (only H2 and H3 are required to). H1 is the weakest trap: its regression tests
  catch a partial fix, but I did not write the partial-fix patch to prove it.
- The seeded H1 bug lives in the template that H4 also uses. The H4 hidden tests avoid box products with
  quantity breaks so the H1 bug cannot affect H4 scoring; a solver who fixes H1 while doing H4 is not penalised.
- Both naive patches were written by me, not observed from a model; "what a fast engineer would write" is my judgement.
- The visible suite is not checked line by line against the trap rules; the mechanical proof is that both naive
  patches keep it green. Other trap rules (H1, H4) are only covered by my own review of the visible tests.
- `template-hard` has no `.mstack/` and no `CLAUDE.md`; run copies get `git init` as for the easy tier.
