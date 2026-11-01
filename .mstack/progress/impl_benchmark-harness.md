# impl: benchmark-harness (item 38)

## What changed
Built the local benchmark under `sandbox/bench/` (gitignored; nothing outside it touched, nothing committed in
either repo). A Python 3.9 stdlib hexagonal room-booking template (327 lines of code, 18 visible tests, bugs for
T1/T2/T5 seeded and not covered by visible tests), six tasks (issue, hidden tests, `meta.json` mapping each hidden
test to a verbatim issue sentence), six reference patches, `run.mjs` (arm x task x rep, `--dry-run`), `summary.mjs`,
and `verify.mjs` (self-check of the benchmark itself). mstack-before is `git archive a4e6c78...` in
`versions/before/` with `SHA`; mstack-after is the checkout. `claude` was never invoked. The design brief is copied
to `sandbox/bench/DESIGN.md` with an "As built" section appended (deviations, caveats).

Deviations and caveats the coordinator should know:
- T1: only 4 of 9 hidden tests fail on the pristine template (back-to-back x3, new-covers-existing). The identical,
  partial-overlap x2, nested-in-existing and different-room tests pass there on purpose; they stop a shallow fix
  that trades one bug for another. T2..T6 fail entirely on the pristine template.
- `visible_ok` is 1 when the whole visible suite passes after the run (0 = regression); summary counts runs with 0.
- The stream is saved beside the copy (`runs/<arm>/<task>/stream-r<rep>.jsonl`), not inside it.
- UNVERIFIED (rung 0, needs the spike): the copy lives under `/Users/romerma/Code/mstack`, whose `CLAUDE.md` says
  "Start work with /mstack"; the plain arm may load it. `BENCH_RUNS=<dir outside>` moves all copies. Likewise
  `subagent_stats` shape is unknown, so the `subagents` column is parsed defensively (number, array length, or
  `count`/`total`/key count). The `--allowedTools` single-argument form and `/mstack # <issue heading>` as a prompt are
  untested against real `claude`.
- Parents of `runs/` hold `reference/` and `tasks/*/hidden`; an agent that walks up can find them.

## Files
All under `/Users/romerma/Code/mstack/sandbox/bench/`:
```
DESIGN.md  lib.mjs  run.mjs  summary.mjs  verify.mjs
reference/T1..T6.patch
results/                      (empty; results.tsv is created by the first run)
tasks/T1..T6/{issue.md, meta.json, hidden/test_T<n>.py}
template/{README.md, .gitignore, bookings/{cli.py,__main__.py,domain/,ports/,adapters/,app/}, tests/}
versions/before/              (git archive of a4e6c78, plus SHA)
```
Only mstack-repo additions: this report and the ledger row.

## Commands
```
$ cd sandbox/bench/template && python3 -m unittest discover -s tests
Ran 18 tests in 0.003s
OK

$ bun sandbox/bench/verify.mjs
pristine visible suite: 18/18 OK
T1: pristine hidden 5/9 pass, reference hidden 9/9 pass, visible after patch 18/18
  T1 trace: 5 sentences, 9 tests, all mapped
T2: pristine hidden 0/9 pass, reference hidden 9/9 pass, visible after patch 18/18
  T2 trace: 4 sentences, 9 tests, all mapped
T3: pristine hidden 0/13 pass, reference hidden 13/13 pass, visible after patch 18/18
  T3 trace: 12 sentences, 13 tests, all mapped
T4: pristine hidden 0/9 pass, reference hidden 9/9 pass, visible after patch 18/18
  T4 trace: 10 sentences, 9 tests, all mapped
T5: pristine hidden 0/5 pass, reference hidden 5/5 pass, visible after patch 18/18
  T5 trace: 5 sentences, 5 tests, all mapped
T6: pristine hidden 0/9 pass, reference hidden 9/9 pass, visible after patch 18/18
  T6 trace: 5 sentences, 9 tests, all mapped

all checks passed
```
Dry runs (command line abbreviated here; the full prompt and flags print in the real output):
```
$ bun sandbox/bench/run.mjs --arm plain --task T1 --dry-run
arm=plain task=T1 rep=1 version=-
copy: /Users/romerma/Code/mstack/sandbox/bench/runs/plain/T1/r1
command: env -u ANTHROPIC_API_KEY claude -p '# Back-to-back bookings are rejected, ... final state.' --model opus --output-format stream-json --verbose --setting-sources project --strict-mcp-config --max-budget-usd 8 --allowedTools 'Read Write Edit Glob Grep TodoWrite Agent Skill Bash(python3:*) Bash(git:*) Bash(mstack:*) Bash(ls:*) Bash(cat:*) Bash(echo:*) Bash(head:*) Bash(tail:*) Bash(wc:*) Bash(mkdir:*) Bash(rg:*) Bash(grep:*) Bash(find:*) Bash(sed:*) Bash(diff:*) Bash(pwd) Bash(test:*) Bash(printf:*)'
git log in copy: 892e77d template
no .mstack/ in the plain arm: true
dry run: claude was not invoked, no results row written

$ bun sandbox/bench/run.mjs --arm mstack-before --task T1 --dry-run
arm=mstack-before task=T1 rep=1 version=a4e6c784d99536d39c132cb0d5e4d634ad34e9f2
command: env -u ANTHROPIC_API_KEY claude -p '/mstack # Back-to-back bookings ... final state.' --model opus --output-format stream-json --verbose --setting-sources project --strict-mcp-config --max-budget-usd 8 --plugin-dir /Users/romerma/Code/mstack/sandbox/bench/versions/before --allowedTools '...same list...'
git log in copy: 906e0cd mstack setup | 892e77d template
.mstack/ created by .../versions/before/bin/mstack setup: .gitignore decisions.tsv ledger.tsv progress specs state.json
state.verify = "python3 -m unittest discover -s tests"
dry run: claude was not invoked, no results row written

$ bun sandbox/bench/summary.mjs results/fake.tsv   (two fabricated rows, file deleted afterwards)
arm            runs  hidden_pass  regressions  cost_usd  turns   errors
plain          1     1.00         0/1          1.50      12.0    0
mstack-before  1     0.56         1/1          3.10      30.0    0

hidden pass ratio by task (mean over reps)
arm            T1     
plain          1.00   
mstack-before  0.56
```
The dry-run copies under `runs/` were deleted afterwards.

## R to test
| R | Test | Where |
|---|------|-------|
| A1 | n/a: spike runs are the coordinating pass's step | - |
| A2 | `verify.mjs`: visible suite green on pristine template; per task hidden fails before and passes after the reference patch; every hidden test traces to a verbatim issue sentence | `sandbox/bench/verify.mjs:25-52`, `sandbox/bench/tasks/T*/meta.json` |
| A3 | `run.mjs --dry-run` for plain and mstack-before (exact command, copy, `.mstack/` from that version's `setup`, `verify` set); summary on a fabricated results file. The real-run path (stream parse, row append) is unexecuted | `sandbox/bench/run.mjs:75-103` (dry-run), `:105-142` (unexecuted run path), `sandbox/bench/summary.mjs` |
| A4 | n/a: baseline numbers are the coordinating pass's step | - |

Rung: `test-verified` for the template, tasks, patches and dry-run. The `claude` invocation and results-row path were not run (rung 0).
