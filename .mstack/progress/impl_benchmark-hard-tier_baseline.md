# Item 48 benchmark-hard-tier: hard-tier baseline

## Setup

- **Tasks:** `sandbox/bench/template-hard/` (1938 source lines, 202 visible tests), tasks H1–H4
  after the round-2 hardening, as approved in `review_benchmark-hard-tier.md`.
- **Runs:** model opus with `--permission-mode auto`, budget $8 per run, 1 rep per arm, set by
  a decision row.
- **Plain rows:** 2026-11-01 22:36–22:42.
- **mstack-before rows:** 2026-11-08 11:01–11:34, at
  `a4e6c784d99536d39c132cb0d5e4d634ad34e9f2`.
- **Raw rows:** `sandbox/bench/results/results.tsv`.
- **Calibration:** the rows from before the hardening are in `results-calibration.tsv`, all of
  them solved by plain.

## Result

Output of `bun sandbox/bench/summary.mjs`, hard-tier block:

```
arm            runs  solved   mean_hidden  regressions  cost_usd  tokens      turns   errors
plain          4     4/4      1.00         0/4          0.45      374015      11.5    0
mstack-before  4     4/4      1.00         0/4          2.13      2978322     15.0    0
```

Per run, from the same file:

| task | plain cost | plain wall | mstack-before cost | mstack-before wall | subagents |
|---|---|---|---|---|---|
| H1 | $0.34 | 72 s | $1.02 | 241 s | 2 |
| H2 | $0.28 | 66 s | $1.14 | 270 s | 2 |
| H3 | $0.46 | 110 s | $1.91 | 459 s | 2 |
| H4 | $0.73 | 114 s | $4.46 | 950 s | 3 |

- 0 permission denials in either arm.
- The mstack-before streams were checked for paths outside their run directories. The only
  hits were scratch files the agent wrote itself under `/tmp`, plus its own `.mstack/evidence/`.
  No path reached the tasks, the reference patches or the evidence.

## Reading

- **Quality:** no separation, as on the easy tier. Plain solved every hard task, including
  the reporter misdiagnoses.
  - The user accepted the ceiling (decision row, 2026-11-08). This tier now tests whether
    mstack loses quality on harder tasks. On this baseline it loses none.
- **Overhead:**
  - 4.7× cost ($2.13 vs $0.45 per run);
  - 8.0× tokens;
  - about 5.3× wall time (480 s vs 91 s mean).
- **Scaling with task size:** the gap grows with the task. On H4, the cross-cutting feature,
  mstack-before costs 6.1× ($4.46 vs $0.73) and takes 8.3× the wall time, with 3 subagents.
- **Combined baseline** across both tiers:
  - 16/16 solved per arm;
  - mstack-before costs 4.7–6.2× plain and takes 5–9× the wall time.

## Target for item 45

mstack-after must keep 16/16 on both tiers and cut this overhead. Items 39, 43 and 44 are
the levers: role models, the review budget, and size tiers for s-sized changes.
