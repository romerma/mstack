# Item 38 benchmark-harness: easy-tier baseline

Run 2026-11-01 20:01–21:31 local, one sequential batch, arms alternating.

- Harness: `sandbox/bench/run.mjs`, as approved in `review_benchmark-harness_r4.md`.
- Settings: model opus, `--permission-mode auto` for every arm, claude 2.1.316.
- mstack-before = `a4e6c784d99536d39c132cb0d5e4d634ad34e9f2`.
- Raw rows: `sandbox/bench/results/results.tsv` (gitignored, local only).

## Result

`bun sandbox/bench/summary.mjs`, pasted:

```
arm            runs  solved   mean_hidden  regressions  cost_usd  tokens      turns   errors
plain          12    12/12    1.00         0/12         0.24      149219      6.2     0
mstack-before  12    12/12    1.00         0/12         1.49      1332343     15.2    0

solved by task (solved/reps)
arm            T1     T2     T3     T4     T5     T6
plain          2/2    2/2    2/2    2/2    2/2    2/2
mstack-before  2/2    2/2    2/2    2/2    2/2    2/2
```

These columns were computed from the same file:

| arm | mean wall | median wall | max wall | cost range | total cost | subagents per run | denials |
|---|---|---|---|---|---|---|---|
| plain | 46 s | 49 s | 63 s | $0.18–0.30 | $2.88 | 0 | 0 |
| mstack-before | 403 s | 358 s | 948 s | $0.69–3.09 | $17.90 | 2–4 | 0 |

## Reading

- **Quality: no separation.** Both arms solve every task with no regressions. The easy tier
  sits at the ceiling, as the spike predicted, so it cannot show whether mstack improves
  outcomes. Item 48 (hard tier) exists to answer that.
- **Overhead, the thing this tier measures:**
  - cost 6.2× per run;
  - tokens 8.9×;
  - wall time 8.8×.
- **Cost variance comes from extra rounds.** The most expensive run (T2 r2: $3.09, 948 s)
  spawned 3 subagents against the usual 2. Two to four subagents per run, all on
  `model: inherit` (opus), on tasks that plain solves in about 6 turns.
- **Auto mode fixed the denial handicap.** The allowlist spike had 15 denials in the
  mstack arm against 2 in plain. Auto mode had 0 in both arms.

## Checkpoint

Decision row `verify` of 2026-11-01: continue the program.
- Quality is judged on the hard tier.
- This tier is the overhead baseline that items 39 (role models), 43 (review budget) and
  44 (size tiers) have to bring down without losing the 12/12.
