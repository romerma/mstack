# Implementation - bench-hygiene-followups (item 49)

The harness lives in `sandbox/bench/`, which is gitignored here and untracked in the nested sandbox repository: nothing
below is under version control. A copy of the files as they were before is in the session scratchpad
(`.../scratchpad/bench49_before/`); the full `diff -ru` of the four changed files is
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl49/diff.txt` (171 lines). This report names no hidden values, assertions or patch contents; tests are not named.

## What changed

1. `check.mjs`: the scratch root is `mkdtemp` under the real path of `os.tmpdir()`, and `BENCH_HOME` is a second, separate
   temp dir (it used to be `<root>/home`, so the root was the parent of `runs/`). A new assertion fails if the root is
   an ancestor of, equal to, or under the runs directory. Both dirs are removed at the end.
2. `DESIGN.md`, "Leak rule": now covers reviews and decision rows, forbids naming hidden values, assertions, patch
   contents and which side or fix is correct, says to refer to tests by id or number, and states that self-checks are
   not run while a batch is running.
3. `tasks/H3/meta.json` and `tasks/H4/meta.json`: the five tests of finding 1 (H3 two, H4 three) are also mapped to the
   README sentences their extra assertions follow from (names and notes, version 1 stock, the CLI error convention,
   unknown ids, movement order id, and the warehouse sentence), as extra sentence entries. No test file changed.
4. Criterion 4: nothing changed. The design row of 2026-11-18T20:21:02Z records that the hard tier is not
   re-baselined, so the README wording against the v1 fixture (finding 2) and the cosmetic items (finding 3) are left
   ("a re-baseline costs a full calibration run and changes the numbers item 45 compares against").

Diff sizes (changed lines, + and -): `check.mjs` 33, `DESIGN.md` 9, `tasks/H3/meta.json` 16, `tasks/H4/meta.json` 24.

## Commands

Both checks run local only (fake claude, no model session); `check.mjs` writes under the temp dir, `verify.mjs` under the
temp dir; neither writes outside `sandbox/bench/` and temp. check about 24 s, verify about 16 s.

```
before:  node sandbox/bench/check.mjs   exit 0, 90 ok lines, "all harness checks passed"
         node sandbox/bench/verify.mjs  exit 0, "all checks passed"
red:     FAIL scratch root is neither an ancestor of nor under the runs directory: /private/tmp/bench-check-tIDuIV vs /private/tmp/bench-check-tIDuIV/home/runs
after:   node sandbox/bench/check.mjs   exit 0, 91 ok lines, "all harness checks passed"
         node sandbox/bench/verify.mjs  exit 0, "all checks passed"
mutant:  scratch copy of check.mjs with BENCH_HOME back at <root>/home:
         FAIL scratch root is neither an ancestor of nor under the runs directory: .../bench-check-yT5Lpg vs .../bench-check-yT5Lpg/home/runs
```

Verify output before and after differs only in trace lines, as expected from the added mappings: sentence counts 14 to 16
(H3) and 21 to 24 (H4); H4 README-mapped tests 19 to 20 (one test that was issue-mapped only is now also README-mapped)
and the naive patch's README-mapped failures "9/19" to "9/20" (same 9 failing). Pristine and reference pass counts, the
naive patches' visible and issue-mapped lines are identical. The mutant was a temporary file in the bench directory,
deleted afterwards.

`./bin/mstack gate`: PASSED, 0 failures, 0 warnings. `git -C sandbox status --short`: `?? bench/`, `?? clima-portable/`
(unchanged). Rung: 4 for points 1 to 3 (the checks were run after the last edit); the new assertion was seen red, and
killed by the mutant.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | scratch-root assertion | n/a: node sandbox/bench/check.mjs exits 0 with the new assertion, red before the move and red on the mutant; file is untracked under sandbox/ |
| A2 | DESIGN.md leak rule | n/a: prose in sandbox/bench/DESIGN.md, nothing to execute; read the Leak rule section |
| A3 | meta.json mapping | n/a: node sandbox/bench/verify.mjs exits 0 with the same pass counts; files are untracked under sandbox/ |
| A4 | left by decision | n/a: nothing changed, the design row of 2026-11-18T20:21:02Z records leaving the README wording and the cosmetic items |
