# Review - diagnosis-loop-in-bug-fix (round 3)

**Verdict:** APPROVED

Reviewed at `a378b65bebcf9e8a39f6551ed8f23175ac66d460`. The round 3 change is `git diff 42557b1..a378b65 -- skills .mstack/progress/diagnosis_unidentified-flaky-test.md`: 5 lines changed in the diagnosis file and 3 in `skills/router/playbooks/bug-fix.md` (`git diff --numstat`: `5 5` and `3 3`). I reviewed alone and did not write this work. My scratch files are in `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review59r3/`, called `review59r3/` below.

## Round 2 blocking finding

**`diagnosis…md:184`, the max of three.** Fixed. The sentence now reads "The max of three keeps the slowest run on each side, so one slow run on either side goes whole into `stopMs - bare`, against a 50 ms margin."
- `tests/costs.test.ts:732` is `const stopMs = Math.max(...[1, 2, 3].map(() => time(() => stop(input))));`, and `:733` is `const bare = Math.max(...[1, 2, 3].map(() => time(() => stop({ cwd: box.store.root }))));`.
- `:743` is `assert.ok(stopMs - bare < 50, ...)`.
- A max returns the slowest of the three runs, so one slow run sets that side's value in full, and the difference carries it. The sentence is true.
- The round 2 clause "but the two timings still differ by hundreds of ms or more between runs" went out with it. Nothing now depends on it, and the serial messages on the same line still show the differences (75, 447, 183 ms).

## Non-blocking (file, do not fix in this item)

- **`diagnosis…md:164` names only two of the shrink suites' failures.** After the colon it gives `gate:681` (3 of 6 bun) and `run:154` (1 node). In the same 10 rows, `launcher:55` failed in 5 of 6 bun suites, `run:54` in 2 of 4 node suites, and `costs:698` in 1 of 4 node suites (`review59r3/count.py`, below). The paragraph does not say "only", so nothing in it is false. But the colon reads like a full list.
- **`:7` and `:164` both hold, but only because of their scope.**
  - `:7` says "Five tests were seen failing across both passes (table under "Failures seen")". "Both passes" means the 79 runs (`:9` "19 serial, 60 parallel"), and the table's columns cover 19, 40 and 20 runs (`:144`). Five distinct names fail there, and `run:154` is the only name that fails in the shrink rows and nowhere in the 79 (count.py). So "a sixth test" is true as well.
  - The Finding's candidates still leave out `run:154`, which `:188` ("every test seen failing is a candidate") includes.
  - Item 21's description (`./bin/mstack state show 21`, "five tests were seen failing") is scoped to the same 79 runs. It is unchanged in this round.
- **`:184` "on either side"** is true with its sign. Only a slow `stopMs` run pushes the difference toward the 50 ms bound. A slow `bare` run pulls it down.

## The other changed sentences

- **`:8` "failure mode".** The word-diff shows that `[-mechanism-]{+failure mode+}` is the only change on that line. It agrees with `:176`, which says that what brings `launcher:55` on "is not shown". `:182`'s heading "Mechanism for `costs:698`" is about a different test.
- **The removed duplicate load sentence.** The word-diff shows the old `:49` deleted with only its blank line. `:47` keeps the sentence and its node-load explanation, and `:48` is a single blank line before `:49`.
- **H1 (`:156`).** Every number matches my recount (below): 6 of 24 in rounds 1 to 4, all node; 15 of 60 (25.0%) against 4 of 19 (21.1%); 20 of 60 node runs against 9 of 19; node 14 of 20 against 3 of 9; bun 1 of 40 against 1 of 10. The claim "no rise is shown" fits my own Fisher test: pooled p = 1.000, and the first 24 runs p = 1.000. "Suggestive only" for node fits p = 0.106.
- **The new paragraph (`:164`).**
  - The 10 shrink rows are 6 bun and 4 node (`shrink` 5, `shrink2` 5).
  - `gate:681` failed in 3 of the 6 bun rows, all three in `shrink2`.
  - `run:154` failed once, in a `shrink` node row. `rg` finds the quoted name at `tests/run.test.ts:154`.
  - "Counted above for kills only" holds. H4 counts them for kills (`:159`, 40 + 6 = 46), and so does H5 (`:160`, 20 + 4 = 24). `:9`, `:157` and the table at `:144` exclude them. No row in either `results.tsv` carries the watchdog's `KILLED@` marker.
- **Contradictions elsewhere.** I found none beyond the scoping note above. `:189` ("0 kills in 79 full-suite runs plus 10 in the shrink loops") agrees with `:164`.

## `skills/router/playbooks/bug-fix.md`

- **`:13-14`** reads "Do not read code for a theory before that command exists". "That command" can only refer back to `:9`, "one command that goes red on it". A reader who has never seen the repository gets one antecedent.
- **`:23`** reads ``skip: cause shown by the loop, `<file>:<line>` ``. The angle brackets mark a placeholder, and no bench file name is left (`rg -F 'pricing.py:12'` over the repository, excluding review reports, finds nothing). The double-backtick span still closes on the final pair, as it did before.
- **Length.** `wc -l` gives `35`.
- **Docs.**
  - `README.md:93` is true of `:9`, `:14`, `:24` and `:31`.
  - `docs/wiki/Skills-and-Playbooks.md:144` is true of `:9`, `:15-17`, `:21-23`, `:24` and `:31`.
  - `CHANGELOG.md:5-11` is true of `:9-18`, and its "before any theory" matches `:13-14`. "Nothing is asked" matches `:17` "without asking" and the header.
- **Tests.** No test or doc quotes the changed text. `rg -F` for `before it exists`, `before that command`, `cause shown by the loop` and `<file>:<line>` finds only `bug-fix.md:13` and `:23`. The one test that reads this file (`tests/lint.test.ts:285-303`) strips line 1, which round 3 did not touch.

## Acceptance, quoted

**"bug-fix.md steps 1 and 2 carry the loop-first procedure, with an origin header on the derived text"**: met.
- The procedure is at `skills/router/playbooks/bug-fix.md:9-23` and the header at `:1`, which this round's diff leaves alone.
- `./bin/mstack lint-plugin .` passes with `6 origin header(s)`.
- The header-removal test `tests/lint.test.ts:285` passes on bun and on node.

**"the procedure is run on item 21 (unidentified-flaky-test) and either identifies the test or records the hypotheses ruled out"**: met, by the second branch.
- H2, H4 and H5 (`:157`, `:159`, `:160`) are unchanged since round 2, which re-derived them. My recount finds 0 `KILLED@` rows in both data files.
- No test is called identified for the August run (`:7`, `:188`).
- H1's new wording (`:156`) says no more than its data does.

## Verification I ran

`./bin/mstack gate` at head, before any write:

```
mstack 0.2.1 at /Users/romerma/Code/mstack
[ok]    one active item: diagnosis-loop-in-bug-fix (reviewing)
[ok]    working tree is clean
PASSED - 0 failures, 0 warnings
exit=0
```

`git diff --stat 42557b1..a378b65 -- src tests`: empty.

`./bin/mstack lint-plugin .`:

```
[ok]    6 origin header(s), each naming a licence file that ships
[ok]    the router's orient steps link references/intake.md
PASSED - 0 failures, 0 warnings
lint_exit=0
```

`bun test tests/lint.test.ts -t "must carry an origin header"`: `1 pass` / `26 filtered out` / `0 fail`, exit 0. Node, `--test-name-pattern="must carry an origin header" tests/lint.test.ts`: `ℹ tests 1` / `ℹ pass 1` / `ℹ fail 0`, exit 0.

`./bin/mstack ledger check diagnosis-loop-in-bug-fix`, before my row: `FAIL no verdict at a378b65b; 4 row(s) exist at other SHAs and a new head SHA voids them`.

`python3 -I review59r3/count.py <scratchpad>`. It is my own parser over `impl59/results.tsv` and `impl59r2/results.tsv`, mapping each test name to its `file:line` with `rg -n -F` over `tests/`:

```
serial rows 19 Counter({'bun': 10, 'node': 9})
round rows 60 Counter({'bun': 40, 'node': 20}) rounds [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
shrink rows 10 Counter({'bun': 6, 'node': 4}) Counter({'shrink': 5, 'shrink2': 5})
costs:698 all rounds 15 of 60; serial 4 of 19
costs:698 node rounds 14 of 20; serial 3 of 9
costs:698 bun rounds 1 of 40; serial 1 of 10
rounds 1-4 rows 24 costs fails (6, 24) Counter({'node': 6})
shrink rows by test/runtime [(('bun', 'gate:681'), 3), (('bun', 'launcher:55'), 5), (('node', 'costs:698'), 1), (('node', 'run:154'), 1), (('node', 'run:54'), 2)]
shrink bun gate:681 by round [('shrink', False), ('shrink', False), ('shrink', False), ('shrink2', True), ('shrink2', True), ('shrink2', True)]
shrink node run:154 [('shrink', 'node')]
distinct tests failing in serial+rounds (79 runs): ['costs:698', 'gate:681', 'launcher:55', 'run:239', 'run:54'] 5
distinct tests failing in shrink rows: ['costs:698', 'gate:681', 'launcher:55', 'run:154', 'run:54']
tests in shrink not in 79 runs: ['run:154']
unknown names: []
```

`rg -c 'KILLED@'` on both `results.tsv` files: no match (exit 1). `KILLED@` is the marker `impl59r2/run.mjs:48` writes on a watchdog kill.

`python3 -I review59r3/fisher.py`. It is my own two-sided Fisher test and binomial tail, standard library only:

```
pooled 15/60 vs 4/19 p=1.000
first24 6/24 vs 4/19 p=1.000
node 14/20 vs 3/9 p=0.106
bun 1/40 vs 1/10 p=0.363
P(X>=6 | n=24, q=4/19)=0.394
pct 15/60=25.0% 4/19=21.1%
```

## What I did not check

- I did not run the full suite or `gate --full`, as the brief said. `src` and `tests` are unchanged since `42557b1`, where round 2 ran `gate --full` green. The rung for this round is 4: lint-plugin and the header test ran the real code, and count.py checked the claims against the recorded data. That is not a reproduction of the runs.
- I did not run a live headless session. Round 2's run used the earlier skip line with the `pricing.py:12` example. How a session reads the `<file>:<line>` placeholder has not been observed (rung 2, read only).
- I did not re-open the run logs. All numbers above come from the two `results.tsv` files.
- I did not review the other files in `42557b1..a378b65` (`.mstack/decisions.tsv`, `ledger.tsv`, `current.md`, the round 2 report).
