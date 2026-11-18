# Review - load-sensitive-tests, round 3

**Verdict:** APPROVED

Item 67, branch `fix/load-sensitive-tests`, head `b6fea657707ba5698b4e02627eb0a95046567634`; round 3 diff
`7fc3060..b6fea65` (`tests/costs.test.ts`, `CHANGELOG.md`, item 21's description in `.mstack/state.json`, a
decision row, `current.md`). I did not write it. Apple M5 Pro; bun 1.3.11, node 26.13.1, node 22.6.0 from nvm.
One mutant ran in a scratch worktree at `review67r3/wt` (removed); script and output in
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review67r3/`.

## Round 2 finding

1. **"4 to 14 ms" for a plain read, and "25 to 35 ms" for a read and parse**: resolved. Neither figure is in a
   committed file any more (`rg -n "4 to 14|25 to 35" tests CHANGELOG.md` finds nothing; decision row 199 still
   has "25 to 35 ms", which is history). Each new sentence, against the round 1 and round 2 figures:

- `tests/costs.test.ts:728-730` "A read and parse of these 50 MB cost more CPU than the 20 ms bounds on every
  runtime measured for item 67 (bun 1.3, node 22.6, 24 and 26)": true. Bun: M3 CPU difference 26.0 to 27.1 ms
  (r1), M4 33.9 to 36.9 against 3.8 to 4.1 (r2); node 26: M3 37.3 to 38.6 (r1); node 22.6: 63 to 66 ms (r2);
  node 24: M4 64.5 to 64.7, one read and parse about 58 ms (r2).
- `:746` "a read without a parse is caught on some runtimes only": true. M7b and M7 red on node 22.6, M7 red on
  node 24; M7, M7b green on bun and node 26 (r2).
- `:746-747` "A read of the bytes with no decode stayed under the bounds on every runtime measured": true, M8
  green on bun, node 26, 22.6 and 24 (r2), and on bun and node 26 (r1).
- `:748-749` "a decoded read stayed under them on bun 1.3 and node 26 and went over on node 22.6": true. M7b
  green bun 2/2, node 26 2/2, red node 22.6 2/2 (r2); my run below, red node 22.6 3/3.
- `:749` "What these bounds catch everywhere is a read and a parse": true for every runtime measured (first
  bullet).
- `CHANGELOG.md:13-14` "they catch a read without a parse on some runtimes only (a decoded read is over the
  20 ms bounds on node 22.6 and under them on bun 1.3 and node 26)": true, same rows.
- The sentences the edit did not touch (`:731-745`) are the ones round 2 checked one by one; the edit removed
  "(26 ms and more), not a read alone" and changed no claim they rest on. "Two limits" still names two.

## Non-blocking

- **Node 22.6's "over" is one bound by about 1 ms.** In my M7b runs `stop(no gate)` was 21.16 to 21.19 ms
  against 20 while the CPU difference stayed under its bound (26.3 - 7.0, 26.4 - 6.7, 25.5 - 7.2: 18.3 to
  19.7 ms); round 2's were 20.42 and 20.70. "over the 20 ms bounds" (`CHANGELOG.md:14`) means the test goes
  red, not that every bound is exceeded, and a slightly faster machine would pass it. Not false as measured.
- **Node 24 is left out of the decoded-read sentence.** M7 (decoded read and a split) was red there 2/2 in
  round 2; M7b was not run there. The sentences claim nothing about node 24, so nothing is false, but CI's
  `test` job runs node 24 and a reader cannot tell from the text.
- **"everywhere" (`tests/costs.test.ts:749`) is this machine.** Bun's margin on a gate-branch read and parse is
  6 to 7 ms (M3 26.0 to 27.1, r1; round 1 noted a machine about 1.3 times faster would pass it).
- **Item 21's bound drops its load.** "94 full suites run in parallel rounds had 0 failures" is true (below),
  but round 2 asked for "64 bun and 30 node, at a lighter load than the diagnosis"; the lighter load is the
  caveat whoever closes item 21's first criterion on that number needs. Item 86's description has it for its
  own tests ("which ran on a lighter machine"). Also the 94 ran at round 1's costs assertion (min-based); round
  2's re-derivation shows the max-based one would have passed on their figures (worst 1.6 ms).
- `CHANGELOG.md:15` is a short line ("The temp-directory test of") left from the edit; renders the same.

## Acceptance, quoted

**"the report says whether either one is item 21's unidentified failure, and item 21 is closed or updated
accordingly"**: met. The first half was met in round 1. Item 21 is now updated: the round 3 diff to
`.mstack/state.json` is one line, its `description`; `acceptance` (four bullets) and `"status": "pending"` are
unchanged (`git diff 7fc3060..b6fea65 -- .mstack/state.json`, one `-` and one `+` line, both `description`).
The added text, clause by clause:
- "Item 67 (2026-11-18) fixed the load-sensitive tests that diagnosis saw (tests/costs.test.ts:698,
  tests/run.test.ts:54, and the timeouts of tests/gate.test.ts:681 and tests/launcher.test.ts:55)": these are
  four of the five in the diagnosis's table (`diagnosis_unidentified-flaky-test.md:77`); the fifth, run:239, is
  named at the end.
- "of them only the launcher test existed on 2026-08-21": true, `git log -S` below: launcher 2026-08-19, gate
  2026-08-22, run 2026-11-08, costs 2026-11-08 (item 17's failing run was 2026-08-21, `e246f1c` 21:42, r1).
- "nothing ties it to the August failure": true; the August test name was never captured (item 21's own text,
  diagnosis line 7).
- "With those fixes, 94 full suites run in parallel rounds had 0 failures": true, re-derived below from the four
  `results.tsv` of round 1 (60 + 14 implementer, 6 + 14 reviewer): 94 suites, 64 bun, 30 node, 631 tests each,
  fail column sum 0, no `killed`.
- "The two hangs did not reproduce there either": true, no watchdog kill in those 94.
- "tests/run.test.ts:239 and :154 are item 86": true, `./bin/mstack state show 86` holds both, with names,
  counts and three criteria.

The other seven criteria are unchanged since round 2's review, which judged them met; round 3 touched no code.

## Verification I ran

```
$ ./bin/mstack version
mstack 0.2.1 at /Users/romerma/Code/mstack
$ ./bin/mstack gate                      # before acting, and again before writing this file
PASSED - 0 failures, 0 warnings

$ rg -n "4 to 14|25 to 35" tests CHANGELOG.md
(no output, exit 1)
$ rg -n "25 to 35" .mstack/decisions.tsv
199:2026-11-18T03:49:00.060Z	implement	item 67: the whole-ho...

$ git diff --stat 7fc3060..b6fea65 -- tests src bin hooks
 tests/costs.test.ts | 12 +++++++-----
$ git diff -U0 7fc3060..b6fea65 -- tests | rg '^[+-]' | rg -v '^(\+\+\+|---)' | rg -v '^[+-]\s*//'
(no output, exit 1)                      # 12 changed lines, all `//` comments

$ npm run typecheck                      # bunx --bun tsc --noEmit
typecheck exit=0
$ bun test tests/costs.test.ts -t "hook paths stay within budget on a 50 MB"
budget: ... onStop=0.16ms stop(no gate)=0.09ms stop(hook) cpu max=4.5ms of [4.5,3.0,3.6,3.1,3.1] ... stop(no transcript) cpu max=4.0ms of [3.2,2.9,3.5,4.0,3.0] ...
 1 pass
 0 fail
bun exit=0
$ node --experimental-strip-types --test ... --test-name-pattern "hook paths stay within budget on a 50 MB" tests/costs.test.ts   # v26.13.1
budget: ... onStop=0.23ms stop(no gate)=0.20ms stop(hook) cpu max=8.5ms of [8.5,6.5,8.0,6.2,6.7] ... stop(no transcript) cpu max=6.6ms of [6.2,5.9,6.1,6.0,6.6] ...
ℹ pass 1
ℹ fail 0
node exit=0

$ bash review67r3/mutants.sh 1 node22 none; bash review67r3/mutants.sh 3 node22 M7b    # worktree at b6fea65, load 7.9
none  node22 1 green  stop(no gate)=0.07ms stop(hook) cpu max=7.9ms ... stop(no transcript) cpu max=7.0ms
# M7b: +  if (input.transcript_path) void readFileSync(input.transcript_path, "utf8").length;
M7b   node22 1 RED  AssertionError [ERR_ASSERTION]: the Stop hook without its gate took 21.162457999999987ms   stop(hook) cpu max=26.3ms  stop(no transcript) cpu max=7.0ms
M7b   node22 2 RED  AssertionError [ERR_ASSERTION]: the Stop hook without its gate took 21.193084ms            stop(hook) cpu max=26.4ms  stop(no transcript) cpu max=6.7ms
M7b   node22 3 RED  AssertionError [ERR_ASSERTION]: the Stop hook without its gate took 21.176500000000004ms   stop(hook) cpu max=25.5ms  stop(no transcript) cpu max=7.2ms
$ git worktree remove .../review67r3/wt; git worktree list
/Users/romerma/Code/mstack b6fea65 [fix/load-sensitive-tests]

$ for s in <the four test names>; do git log -S"$s" --format='%h %ad %s' --date=iso --reverse -- tests | head -1; done
hostile stdin never produces                         32f0265 2026-08-19 20:26:54 +0200 fix: address every finding from the review panel
tail keeps the last lines of stdout and stderr       7f5e67a 2026-11-08 12:58:45 +0100 feat: add shared command runner, closing checks and path classifier
hook paths stay within budget on a 50 MB transcript  d8e694a 2026-11-08 14:10:07 +0100 feat: record tokens per item, role and model in .mstack/costs.tsv
a citation is the exact report filename as a whole token  0f6d972 2026-08-22 18:27:43 +0200 fix: refuse closing rows that cite an implementing role's own report
(names read at the branch base 5c05f6c, lines run:54, costs:698, gate:681, launcher:55)

$ awk -F'\t' '...' impl67/rounds_final/results.tsv impl67/round_heavy_after/results.tsv review67/round1/results.tsv review67/round_heavy/results.tsv
suites=94 fail_sum=0 bun=64 node=30 not631=0
$ rg -c killed <same four files>          # 0 in each

$ ./bin/mstack state show 86
title: tests/run.test.ts:239 and :154 report a child still alive after the signal ...

$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings          # exit 0
$ ./bin/mstack ledger check load-sensitive-tests b6fea657707ba5698b4e02627eb0a95046567634   # before my row
FAIL no verdict at b6fea657; 4 row(s) exist at other SHAs and a new head SHA voids them
$ pgrep -fl 'node --test|bun test|rounds.sh|run.mjs'
no test processes
```

## What I did not check

- The full suite, the load rounds and `mstack gate --full`, as briefed; round 3 changed comments and store text
  only, so the test-verified rung rests on the budget test once per runtime, the typecheck and round 2's suite.
- M7b on node 24 and bun, and M7 or M8 again on any runtime: I re-ran only the one claim whose margin was
  under 1 ms (node 22.6 decoded read).
- The 94 suites' logs one by one (round 1 did); I re-derived the count from the four `results.tsv` files.
- CI (rung 2).

Evidence rung: 4 for the mutant, the budget runs, typecheck, lint and gate on this machine; 3 for the 94-suite
count re-derived from the round 1 tables and for every figure quoted from the round 1 and round 2 reviews.
