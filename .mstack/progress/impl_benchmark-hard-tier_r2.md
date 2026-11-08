# Implementer report, round 2: item 48 benchmark-hard-tier (hardening)

Verdict rung: test-verified. Harness self-checks and the visible suite were run and are green. No real claude call
was made; whether plain now fails some hard task is untested and is the coordinator's calibration.

## What changed (delta over round 1)

All five levers were applied in `sandbox/bench/` (gitignored; hidden tests, patches and values stay there). Issues
were rewritten as symptoms with one concrete example and a general rule, with no sentence saying which component or
figure is right. Three issues (H1, H2, H3) carry a reporter's guess phrased as a guess. Each bug task's
reported-behaviour tests gained cases that the concrete example does not exercise. The template gained two
README-documented features that the tasks lean on (deactivatable warehouses, an ASCII-only invoice rendering rule)
and a shared text helper. Every hard task now ships a naive patch and `verify.mjs` requires one per hard task. The
README grew from 105 to 264 lines of rules; that is rule-dense but short of "several hundred", so I am not
claiming the larger number. The easy tier, the results files and the scoring are untouched.

## Per task, levers in structural terms

| Task | Lever 1 symptom-only | Lever 2 misdiagnosis | Lever 3 implied cases (each mapped to an issue sentence) | Lever 4 shared helper | Lever 5 naive patch |
|---|---|---|---|---|---|
| H1 | yes, neither document is named correct | yes: one reporter guess; followed literally it violates a README rule | 4 beyond the example, each mapped to an issue sentence | no | the guess applied on one path |
| H2 | yes | yes: one reporter guess; followed literally it violates a README rule | 3 beyond the example, each mapped to an issue sentence | no | follows the guess; every issue-mapped test still passes |
| H3 | yes | yes, two reporter guesses; followed literally they violate README rules | several beyond the example, each mapped to an issue sentence | yes: two helpers are shared with features the README documents in other sections | a local fix that also changes a shared helper |
| H4 | n/a (feature issue unchanged in kind) | no | n/a | yes: the stock book's receive rule for deactivated warehouses, documented in a different README section | a quick return implementation that passes every issue test |

H4 additions, all in the README and none in the issue or any visible test: redirection of returned stock when the
origin warehouse was deactivated, the return event kind, note and on-hand-only change, rejection when no warehouse
is active, reservations untouched by a return, and deactivated warehouses taking no new stock.

## Naive-patch results (counts, from verify.mjs)

| Task | Issue-mapped tests failing | README-mapped tests failing | Visible suite |
|---|---|---|---|
| H1 | 0 of 9 | 5 of 9 | green |
| H2 | 0 of 7 | 2 of 9 | green |
| H3 | 0 of 9 | 4 of 9 | green |
| H4 | 0 of 7 | 9 of 19 | green |

Pins: pristine passes 4 of 18 (H1), 8 of 16 (H2), 9 of 18 (H3), 0 of 26 (H4). Re-pinned in each `meta.json`.

## Files

Under `/Users/romerma/Code/mstack/sandbox/bench/`.
- Template: `template-hard/README.md` (rewritten), new `stockroom/domain/text.py`; edited `domain/stock.py`,
  `adapters/codec.py`, `adapters/render.py`, `app/inventory.py`, `app/service.py`, `cli.py`; visible tests extended
  in `test_stock.py`, `test_service_inventory.py`, `test_json_repo.py`, `test_cli.py` (activation flag only, no trap rule).
- Tasks: `tasks/H1..H4/issue.md`, `tasks/H1..H4/meta.json`, `tasks/H1..H4/hidden/test_H<n>.py` rewritten or extended.
- Patches: all six round-1 patches regenerated against the new template, plus new `reference/H1.naive.patch` and `reference/H4.naive.patch`.
- Harness: `verify.mjs` (naive patch required for every hard task), `DESIGN.md` (hardening section).
- Evidence: `evidence/impl_benchmark-hard-tier_detail.md` (appended, gitignored).
Outside `sandbox/bench/`: this report and the ledger row. Nothing committed; results files untouched.

## Commands

`bun sandbox/bench/verify.mjs` (easy-tier lines omitted here, they passed unchanged; the run ended in `all checks passed`):

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
template-hard: 1938 non-blank source lines outside tests (minimum 1800)
hard tasks with a naive patch: 4 of 4 (every hard task needs one)

all checks passed
```

`bun sandbox/bench/check.mjs` (90 `ok`, 0 `FAIL`; hard block and tail):

```
hard tier end to end with a fake claude
  ok   H1: run succeeded and wrote a row
  ok   H1: the run output names template-hard as the template
  ok   H1: the hidden module is scored, 18/18 with the reference patch
  ok   H1: template-hard's visible suite scored ok, no regressions
  ok   H1: the saved diff is against the template-hard copy, not the easy template
  ok   H1: the copy lives in its own run dir under BENCH_HOME
  ok   H1: an untouched copy scores the pinned pristine count (4) and is not solved
  ok   H1: deleting tests/ cannot hide anything, the originals and fixtures are restored
  ok   H2: the naive patch scores 14/16: more than pristine, not solved, visible suite green
  ok   an unknown task id "H9" is refused
  ok   an unknown task id "T7" is refused
  ok   an unknown task id "../T1" is refused
  ok   an unknown task id "" is refused
  ok   dry run on a hard task prepares a template-hard copy and calls no claude
summary leads with the solved rate
...


all harness checks passed
```

Source lines and visible suite:

```
template-hard: 1938 non-blank source lines outside tests (minimum 1800)
Ran 202 tests in 0.670s
OK
```

## R to test

| R | Test | Where |
|---|---|---|
| A1: 3-4 hard tasks on a larger template, symptom issues, hidden reported plus README regression tests, a trap | Source-size floor; both kinds of test per hard task; naive patch keeps visible green, passes every issue-mapped test, fails a README-mapped one; every hard task needs a naive patch | `sandbox/bench/verify.mjs:101`, `sandbox/bench/verify.mjs:75`, `sandbox/bench/verify.mjs:90`-`sandbox/bench/verify.mjs:91`, `sandbox/bench/verify.mjs:105`; hidden classes `sandbox/bench/tasks/H1/hidden/test_H1.py:34` and `:83`, `H2/hidden/test_H2.py:37` and `:87`, `H3/hidden/test_H3.py:47` and `:111`, `H4/hidden/test_H4.py:61` and `:148` |
| A2: every hidden test traces to the issue or README; reference passes; pristine fails | Sentence presence in its source and full mapping; reference passes hidden and visible; pristine count equals the pinned value | `sandbox/bench/verify.mjs:67`, `sandbox/bench/verify.mjs:70`, `sandbox/bench/verify.mjs:73`, `sandbox/bench/verify.mjs:53`-`sandbox/bench/verify.mjs:55`; `sandbox/bench/check.mjs:150`-`sandbox/bench/check.mjs:160` |
| A3: calibration shows plain does not solve every hard task | n/a: coordinator runs calibration and baseline with real claude calls | n/a |
| A4: hard-tier baseline, solved rate first | n/a: coordinator runs calibration and baseline with real claude calls | n/a |
| Round 2 lever 5: a naive patch for every hard task | `verify.mjs` fails when a hard task lacks one or when it does not fail a README-mapped test | `sandbox/bench/verify.mjs:105`, `sandbox/bench/verify.mjs:91` |
| Round 2 lever 3: implied cases mapped to issue sentences | `meta.json` source-checked sentence trace; every hard task keeps tests from both the issue and the README | `sandbox/bench/verify.mjs:67`, `sandbox/bench/verify.mjs:75` |
| Round 2 keep: easy tier, check.mjs green | `check.mjs` (90 ok) and the easy lines of `verify.mjs` | `sandbox/bench/check.mjs:150`-`sandbox/bench/check.mjs:189` |

## Could not do, or worth knowing

- Lever 4 for H4 is weaker than for H3: the naive H4 patch relaxes the stock book's receive rule, which only the
  hidden README test catches; whether a real solver would take that route is my judgement.
- Whether plain still solves everything is untested. The levers are written against the failure modes in the
  calibration streams, not against new evidence.
- H1 and H2 have no shared-helper trap; only H3 and H4 meet lever 4.
- The README is 264 lines, not several hundred.
