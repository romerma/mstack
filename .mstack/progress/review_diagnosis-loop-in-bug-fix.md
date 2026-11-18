# Review - diagnosis-loop-in-bug-fix

**Verdict:** CHANGES_REQUESTED

Reviewed at `2bb47a03f5c19d89eb125f371c17fc8ce6539f2d` against item base `c791f39`. I reviewed alone, in round 1, and I did not write this work. Scratch files are under `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review59/`, called `review59/` below.

## Blocking

1. **Criterion 2 is not met as written. The diagnosis neither identifies the test nor rules out a hypothesis.**
   - `.mstack/progress/diagnosis_unidentified-flaky-test.md:61` calls the one failing test "a candidate, not an identification".
   - The five hypotheses at :51-55 end as "holds for what was seen" (H1), "not tested, not ruled out" (H2, H3), "untestable" (H4) and "consistent with the data, but this can only be bounded, not confirmed" (H5). None of them is ruled out.
   - The implementer's R-to-test table (`impl_diagnosis-loop-in-bug-fix.md`, "R to test") quotes the criterion as "the procedure is run on item 21", which drops the outcome clause.
   - Step 1 says that for a bug that is not constant you "loop the trigger, run it in parallel, add load, pin the rate" (`skills/router/playbooks/bug-fix.md:12-13`). The run did not do that. It ran one suite at a time at ambient load (`impl59/loop.sh:5-8`: one `node run.mjs $rt 420` after another). Both hangs stayed at 0 of 19, so H2 to H4 were never exercised.
   - **Fix:** raise the rate as step 1 says (parallel suites; item 67 measured with four bun and two node suites at once) until H2 to H4 have been tested. Otherwise, record through `mstack decide --resolves` that a bounded negative result closes criterion 2, and reword the criterion to say so.

2. **The diagnosis gets the mechanism of the one failure wrong.**
   - `.mstack/progress/diagnosis_unidentified-flaky-test.md:57` says "`stopMs` is the Stop hook with a 50 MB transcript and `bare` is the Stop hook without one, each measured once".
   - Both are the maximum of three runs: `tests/costs.test.ts:732` is `const stopMs = Math.max(...[1, 2, 3].map(() => time(() => stop(input))));` and `:733` is `const bare = Math.max(...[1, 2, 3].map(() => time(() => stop({ cwd: box.store.root }))));`.
   - The code is the same at `ea0b316`, the commit the suite ran at (`git show ea0b316:tests/costs.test.ts`, lines 731-733). Item 67's fourth criterion already says "each side the max of three runs".
   - Someone fixing item 67 from this file would propose a remedy the test already has.
   - **Fix:** replace "each measured once" with "each the max of three runs". The conclusion still holds: the logged numbers, which I matched below, vary by hundreds of ms from run to run, against a 50 ms margin.

3. **Step 2's skip is too narrow for a one-line bug, and the one live run skipped step 2 without saying so (n=1).**
   - The only skip is "If the loop's red output already shows the cause (a stack trace at the faulty line): `skip: cause shown by the loop`" (`bug-fix.md:22-23`).
   - A wrong boundary that a test exposes, with no trace pointing at it, is not covered. As written, the text demands three to five ranked hypotheses for a `> 1` typo.
   - The design row says the opposite was intended (`.mstack/decisions.tsv:193`: "the skip keeps a one-line bug from paying for a hypothesis round").
   - In Probe C the session wrote no hypotheses, no `skip:` line and no todo list. The tool counts are `{'Bash': 40, 'Agent': 2, 'SubagentHandback': 2}`, and `skip:`, `hypothes`, `predict`, `rank` and `cause shown` each match 0 times across every text block and tool input in the stream.
   - The router forbids a silent skip (`skills/router/SKILL.md:35-36`).
   - The missing todo copy is a router-level habit that predates this item (`.mstack/progress/review_intake-step.md:243` saw the same). The narrow skip is this item's text.
   - **Fix:** widen the skip to cover a failing assertion whose one code path shows the cause at a single line, then rerun Probe C to see whether the `skip:` line appears.

## Non-blocking

- **Origin header, `bug-fix.md:1`.**
  - "because the source proceeds on its own ranking when the user is away" covers the re-ranking (source `SKILL.md:98`). It does not cover the two asks it also drops: the no-loop ask at source :55 and the redaction ask at :16.
  - "because steps 3 to 8 already cover the test-first fix" explains why the regression-test phase was dropped, but not why redaction was. Nothing in steps 3 to 8 mentions secrets, and reports in `.mstack/progress/` are committed with pasted output.
  - The header says the cleanup phase is "not copied", but step 2's "remove them before review" is the third box of that phase (source :136).
  - The `skip:` in step 2 is an mstack addition, and the header does not mention it.
- **Wording in the diagnosis, line 7.** The Finding opens with "Identified, with runtime evidence:". What is identified (the only failing test in these 19 runs) is supported, but as the first word it reads like the first outcome of criterion 2. The file's own :61 says "candidate". Lead with "Candidate".
- **Evidence for the solo run.** "The test run alone, load 10.3 at the time: `1 pass 0 fail`" (diagnosis :57) has no log: `impl59/logs/` holds 19 logs, one per table row.
- **Item 21's new last criterion** is a record of what happened, not a criterion. It is already true and can never fail. It says no more than the file shows (checked in Probe D).
- **Wiki, `docs/wiki/Skills-and-Playbooks.md:144`.** It states "rank three to five hypotheses with their predictions" with no condition, but the playbook has a skip. The sentence is true of the default path.
- **Clause economy in steps 1 and 2.**
  - "already run once, invocation and output in hand" could become "already run, with its output".
  - "Reading code for a theory before this command exists is the failure this step prevents" could become "Do not read code for a theory before it exists."
  - Every other clause carries a rule. Removing any one of them drops one of the five properties, the rate rule, the ranked hypotheses, one variable per probe, the tagging and its removal, the performance branch or the skip.

## Acceptance, quoted

**"bug-fix.md steps 1 and 2 carry the loop-first procedure, with an origin header on the derived text"**: met.
- The text is at `skills/router/playbooks/bug-fix.md:9-23` and the header at `:1`.
- The header's path, sha and licence are correct (Probe A), and every point in the design row is present (Probe A table).
- `lint-plugin` enforces the header on the real CLI, and `tests/lint.test.ts:291` kills the list-entry mutant on both runtimes (Probe B).

**"the procedure is run on item 21 (unidentified-flaky-test) and either identifies the test or records the hypotheses ruled out"**: not met, because the outcome is neither of the two kinds (Blocking 1).

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| Header present on bug-fix.md | `tests/lint.test.ts:285-303`, "a file that must carry an origin header and does not is caught" (entry at :291) | Mutant: list entry removed from `src/lint.ts:427`. Killed on bun and node: "header removed from router/playbooks/bug-fix.md: expected a failure, got a pass" |
| Steps 1 and 2 carry the procedure | Prose, so no test. Seam 2 is the live run | Probe C, n=1. Step 2 was not followed (Blocking 3) |
| Diagnosis on item 21 | `.mstack/progress/diagnosis_unidentified-flaky-test.md` | Probe D. Table matches `results.tsv`; outcome is neither kind |

## Verification I ran

- `./bin/mstack gate` at head, before any write: `PASSED - 0 failures, 0 warnings`.
- `./bin/mstack lint-plugin .`: `[ok] 6 origin header(s), each naming a licence file that ships`, `PASSED - 0 failures, 0 warnings`.
- `npm run typecheck`: exit 0.
- `wc -l skills/router/references/intake.md`: `77`. `bug-fix.md` has 35 lines, against 22 at `c791f39`.
- `npm test`, run once with nothing else of mine running (load 8.7 at start, 21.6 at end):
  - bun: `631 pass`, `0 fail`, `Ran 631 tests across 28 files. [166.20s]`.
  - node: `ℹ pass 630`, `ℹ fail 1`, `✖ hook paths stay within budget on a 50 MB transcript`, `AssertionError [ERR_ASSERTION]: Stop with a 50 MB transcript took 1099.106375000003ms against 989.0519160000003ms without one ... tests/costs.test.ts:743:12`.
  - The file alone under node, at load 18.9: `ℹ pass 30`, `ℹ fail 1`, the same test (`stop(hook)=189.6ms stop(no transcript)=139.4ms`).
  - This failure is on the known load-sensitive list (`costs.test.ts:698`, assertion :743). `git diff --stat c791f39..2bb47a0 -- tests/costs.test.ts src/costs.ts src/hooks` is empty. No failure outside the list.
- `./bin/mstack ledger check diagnosis-loop-in-bug-fix` before my row: `FAIL no verdict at 2bb47a03; 1 row(s) exist at other SHAs` (the implementer's row is at `ea0b316`).
- Evidence-ladder rungs: Probes B and D are at rung 4 (run). Probe C is at rung 5 (running system), but n=1. The source identity in Probe A is at rung 4 (`git show` against a clone).

## Probe A: the playbook text against the source

**Is the source real?**
- A clone of `https://github.com/mattpocock/skills` is in the session scratchpad at `scratchpad/up`. It was made earlier; I fetched nothing from the network. The implementer's `impl59/` holds no clone.
- `git cat-file -t 49dd158d1076134a641b33efb035946536778336` gives `commit`. It is an ancestor of the clone's `main`.
- `git show 49dd158…:skills/engineering/diagnosing-bugs/SKILL.md | shasum -a 256` gives `849198df88cdb65fd0d97236604c1fca7ff2f22d2f705f9724a800d0266b118d`. That is the same digest as the plugin-cache copy (`mattpocock-skills/1.3.1/.../SKILL.md`).
- `LICENSE` at that sha starts with `MIT License` / `Copyright (c) 2026 Matt Pocock`. `diff` against `licenses/mattpocock-skills-LICENSE.txt` is empty.

**The "Adapted:" clause, sentence by sentence**

| Header says | Source | Verdict |
|---|---|---|
| nothing is shown to the user for re-ranking | :98 "Show the ranked list to the user ... proceed with your ranking if the user is AFK" | True. The playbook says "take them in rank order without asking" |
| nothing is asked | :16 ask if redacted output is not enough; :55 ask for access, an artifact or permission | True of the playbook ("say what was tried and stop"). The reason given covers only :98 |
| no human-in-the-loop script | :35, :64 `scripts/hitl-loop.template.sh` | True ("runs unattended") |
| redaction, regression-test and cleanup phases not copied, because steps 3 to 8 cover the test-first fix | :12-16, :114-128, :130-138 | Redaction and regression-test: true. Cleanup: partly copied (the debug-line removal, :136). The reason does not cover redaction |
| the router's stop after three failed approaches stays | `skills/router/SKILL.md:107-108` | True |

**What the design row asks for (`decisions.tsv:193`), and where it is**

| Point in the design | Where |
|---|---|
| one command, already run, invocation and output | :9-10 |
| asserts the reported symptom, not "did not crash" | :10-11 |
| same verdict every run | :11 |
| seconds | :11 |
| unattended | :11 |
| rate for a bug that is not constant | :11-13 "loop the trigger, run it in parallel, add load, pin the rate" |
| no theory before the command exists | :13-14 |
| shrink the repro | :16 |
| three to five ranked hypotheses with predictions, in order, without asking | :16-18 |
| one probe per prediction, one variable at a time | :18-19 |
| tagged debug lines removed before review | :19 |
| performance regression measured and bisected | :20 |
| skip when the loop shows the cause | :22-23 (too narrow, Blocking 3) |

**Contradictions:** none found.
- Two stop rules exist, with different triggers, and they are compatible. Step 1 says "No loop, no fix: say what was tried and stop"; the router says "After three failed approaches ... record the diagnostics in `current.md` and stop" (`SKILL.md:107-108`).
- Who writes the failing test (step 3, and `agents/implementer.md:37`) is unchanged by this diff, and steps 1 and 2 do not touch it.
- `skills/test-first/SKILL.md:11` ("The red output is the receipt") agrees with the loop.
- `bug-fix.md:29` (step 6 "Verify on the same surface as step 1") still has the surface to refer to, because step 1 keeps "on the surface where the bug happens".

## Probe B: the lint rule, real CLI, copy of the plugin

The copy is `git archive 2bb47a0` extracted into `review59/plugin`.

| Case | Exit | Output |
|---|---|---|
| unmodified | 0 | `[ok] 6 origin header(s), each naming a licence file that ships` / `PASSED - 0 failures, 0 warnings` |
| header line removed from `skills/router/playbooks/bug-fix.md` | 1 | `[fail]  skills/router/playbooks/bug-fix.md: no origin header` / `FAILED - 1 failure, 0 warnings` |
| header restored | 0 | `PASSED - 0 failures, 0 warnings` |
| header names `licenses/mattpocock-skills-LICENCE.txt` | 1 | `[fail]  skills/router/playbooks/bug-fix.md: origin header names licenses/mattpocock-skills-LICENCE.txt, which does not exist` |
| mutant (list entry deleted, `diff`: `427d426 < "skills/router/playbooks/bug-fix.md",`) plus header removed | 0 | `[ok] 5 origin header(s)...` / `PASSED`: the mutant survives at the CLI |
| same mutant, `bun test ./tests/lint.test.ts -t "must carry an origin header"` | 1 | `AssertionError: header removed from router/playbooks/bug-fix.md: expected a failure, got a pass`, `0 pass 1 fail` |
| same mutant, node `--test-name-pattern` | 1 | `AssertionError [ERR_ASSERTION]: header removed from router/playbooks/bug-fix.md: expected a failure, got a pass` |
| mutant reverted, bun | 0 | `1 pass 0 fail` |

## Probe C: one headless run, plugin loaded (n=1)

**Project setup** (`review59/live/proj`):
- A copy of `sandbox/bench/template` with one planted bug: `bookings/domain/pricing.py` `if discount_percent:` became `if discount_percent > 1:`.
- With the bug in place, the template's 18 tests pass (`Ran 18 tests ... OK`). `quote standard 2025-03-01 2025-03-02 --discount-percent 1` prints `$99.00`, and `--discount-percent 10` still prints `$89.10`.
- I folded the plant into the first commit (`template`) rather than a separate commit, so that `git log -p` would not give the cause away.
- Then `/Users/romerma/Code/mstack/bin/mstack setup`, `state.verify = "python3 -m unittest discover -s tests"`, and a commit (`mstack setup`), as `run.mjs:101-110` does.

**Wrapper** (`review59/live/run.sh`):
- `env -i` with HOME, USER, LOGNAME, TERM, LANG, TMPDIR, SHELL and `PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:~/.bun/bin:~/.local/bin`. No ANTHROPIC_* variable.
- `claude -p ... --model opus --output-format stream-json --verbose --setting-sources project --strict-mcp-config --max-budget-usd 6 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto`.
- A 720 s process-group timeout (`tmo.py`). The stream goes to `review59/live/streamC.jsonl`, outside the project. claude 2.1.327.

**Prompt:** `/mstack the 1% discount does nothing: `python3 -m bookings quote standard 2025-03-01 2025-03-02 --discount-percent 1` prints $99.00, and one night at $99.00 with 1% off should be $98.01.`

**Result:**
- `INIT plugins: ['mstack', ...] perm: auto model: claude-opus-5-5`.
- `RESULT success cost 1.2083572 turns 25 duration_ms 303184`. Wall time 304.3 s, exit 0, stderr empty apart from the timeout wrapper's own line.

**Tool-call order (main thread unless marked SUB, UTC):**

```
#1 00:22:34 Bash  mstack gate; mstack state active; cat .mstack/progress/current.md; ls -R ...
#2 00:22:38 Bash  cat .../skills/router/playbooks/bug-fix.md; cat .../references/intake.md | head -80
#3 00:22:39 Bash  cat bookings/domain/money.py bookings/domain/pricing.py; grep -n -i discount bookings/cli.py bookings/app/service.py; python3 -m bookings quote standard 2025-03-01 2025-03-02 --discount-percent 1
   result: ...subtotal = nightly_rate(room) * nights\n    if discount_percent > 1:\n ... $99.00
   (#2 and #3 are two tool_use blocks of the same assistant message, msg_011Ch9SRzpnVGdrVtihYPmvt: the source was read before the playbook's text had come back)
#4 00:22:47 Bash  grep -n -i -B2 -A8 discount tests/*.py; ...; python3 -m pytest -q
#5 00:22:54 Bash  mstack decide --phase intake --decision "Treat any positive discount_percent as a discount (guard becomes > 0), ..."; mstack state add --slug one-percent-discount ...; state set --status in_progress
#6 00:23:00 Bash  current.md Plan: "Cause: `pricing.quote` guards with `discount_percent > 1`. Fix to `> 0`."
#7 00:23:06 Bash  first edit: test_quote_with_one_percent_discount into tests/test_money_pricing.py
#9 00:23:14 Bash  CLI test, then commit e60581c "test(pricing): add failing tests for ignored 1% discount"
#10 00:23:20 result: FAIL: test_quote_one_percent_discount ... FAIL: test_quote_with_one_percent_discount ... Ran 20 tests ... FAILED (failures=2)  (then main: OK)
#11 00:23:30 Agent mstack:implementer
#15 00:23:47 SUB Bash  first edit to app source: sed 's/if discount_percent > 1:/if discount_percent > 0:/' bookings/domain/pricing.py; commit 45c334a
#30 00:25:27 Bash  verify on the CLI: $98.01, $99.00, $89.10
#31 00:25:37 Agent mstack:reviewer -> "APPROVED"
```

**Answers:**
- **Did a command that goes red on the symptom run before the first source edit?** Partly.
  - The symptom command ran at #3 and printed `$99.00`, 27 s before the first edit (#7) and 68 s before the first app-source edit (#15).
  - It prints a value rather than asserting one.
  - It ran in the same call as `cat pricing.py`, issued alongside the read of `bug-fix.md`, so step 1 could not have shaped it.
  - The cause was written down at #5 and #6, before any asserting command existed. The first asserting red run is #10.
- **Hypotheses or the skip?** Neither. There are no ranked hypotheses and no `skip:` line anywhere in the stream (Blocking 3).
  - Skipping the round was right in substance: the cause is one visible `> 1`.
  - But the text does not license that skip, because no stack trace shows the cause, and the router does not allow a silent skip.
- **Failing test before the fix?** Yes. `e60581c` is red, with 2 failures at #10, before `45c334a`, and the session said "Writing the failing test and committing it before the fix, as step 7 asks."
- **Outside the playbook:** at #10 the session ran `git stash` before `git checkout main`. That stashed the uncommitted `.mstack/state.json`, so the implementer found "no item matches 'one-percent-discount'". The session restored it from the stash at #27. This is a session error, not a playbook one.
- This is one run (n=1). It shows what one session did with this text, not a rate.

## Probe D: the diagnosis against criterion 2

**Table against `impl59/results.tsv`:** I parsed both with a script, giving `tsv rows 19 table rows 19`, `mismatches 0` on every column (UTC, runtime, both loads, duration, pass/fail, failing name). Other checks from the same script:
- bun ran 10 times with 1 red, and node 9 times with 3 red. That matches "bun 1 of 10 runs, node 3 of 9".
- Load ranges from 9.6 to 27.3 and duration from 87 to 217 s, matching :8, :9 and :21.
- The distinct failing values are `{'[hook paths stay within budget on a 50 MB transcript]', '[]'}`, matching :9.
- The "first run, as printed" line at :18 is `results.tsv` row 1.

**Numbers quoted from the logs:** `rg -o` over `impl59/logs/` finds every number at :57:
- node failures: `1008.879…ms against 933.672…ms`, `1524.411…ms against 1077.579…ms`, `829.175…ms against 645.867…ms`.
- passing runs: `stop(hook)=910.0ms stop(no transcript)=951.6ms`, `740.1ms ... 1078.0ms`.
- bun failure: `205.0ms ... 148.8ms`.
- The one false sentence is "each measured once" (Blocking 2).

**Were the hypotheses written first?**
- `impl59/hypotheses.md` was created at 23:30:48 UTC, and its first line reads "Written before any test file was read and before the first loop result was looked at".
- `results.tsv` was created at 23:31:02, when the first run ended, so the timestamps agree with that line.
- Each of H1 to H5 states a prediction.

**How the key words are used:**
- "ruled out" appears only negated ("not ruled out", :52-53).
- The hangs are "not tested" and "untestable" (:52-54), which is right for a hang that never reproduced.
- "candidate" (:61) is right for a test that fails under load today.
- "Identified" (:7) is used for "the only failing test in 19 loaded suite runs", which is supported but placed so that it reads as criterion 2's first outcome (non-blocking).

**Item 21's last criterion** ("19 full suite runs (10 bun, 9 node) at load 9.6 to 27.3 failed only on tests/costs.test.ts:698 (assertion at :743, item 67's), 4 times, and neither hang reproduced") says no more than the file shows.

**The loop script, run once per runtime:** a byte-identical copy at `review59/loop/run.mjs`, so the implementer's `results.tsv` stays untouched. Each run appended exactly one line, and the node run captured the failing name:

```
00:33:25	node	load_start=16.5	load_end=27.1	73s	pass=630	fail=1	failing=[hook paths stay within budget on a 50 MB transcript]		log=1794962005718_node.log
00:34:43	bun	load_start=26.4	load_end=13.8	172s	pass=631	fail=0	failing=[]		log=1794962083936_bun.log
```

The watchdog branch was not exercised.

**Criterion 2: neither kind.** The test is not identified (:61 "a candidate, not an identification"), and no hypothesis is ruled out (:51-55).

## Probe E: docs and regression

- `README.md:93`, "Build a command that goes red on the bug first or stop, no loop no fix. Failing test before the fix, and the repro commit lands before the fix in history": true of `bug-fix.md:9-15`, `:24` and `:31`.
- `docs/wiki/Skills-and-Playbooks.md:144`: true of the default path. It leaves out the skip (non-blocking).
- `CHANGELOG.md:5-11`: true. Every clause maps to `bug-fix.md:1` and `:9-20`, and to `src/lint.ts:427`.
- `rg` for the old wording ("Reproduce it yourself", "Binary-search the cause", "no repro") outside `.mstack` and the CHANGELOG finds nothing (exit 1).
- The gate, lint-plugin, line counts and `npm test` results are under Verification above.

## Ledger

Recorded with `./bin/mstack ledger record diagnosis-loop-in-bug-fix 2bb47a03f5c19d89eb125f371c17fc8ce6539f2d verifier-failed --evidence .mstack/progress/review_diagnosis-loop-in-bug-fix.md --verifier reviewer`.
