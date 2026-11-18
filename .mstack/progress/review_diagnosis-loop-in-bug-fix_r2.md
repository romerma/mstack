# Review - diagnosis-loop-in-bug-fix (round 2)

**Verdict:** CHANGES_REQUESTED

Reviewed at `42557b1820b8192df40b0f00263a7156a2ae24c4`. The round 2 diff is `c7516e0..42557b1`, and the item base is `c791f39`. I reviewed alone and did not write this work. My scratch files are under `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review59r2/`, called `review59r2/` below.

## Changes required

1. **`.mstack/progress/diagnosis_unidentified-flaky-test.md:184`: a new sentence about the mechanism is false.**
   - It reads "Taking the max of three smooths one outlier".
   - `tests/costs.test.ts:732-733` take `Math.max(...)` of three runs on each side. The max keeps the slowest run. One slow run on either side therefore goes straight into `stopMs - bare` (`:743`). A max of three is more exposed to a single outlier than one run is, not less.
   - This is the sentence that round 1 blocking 2 was about. The wrong account now points someone working on item 67 away from the first remedy to try, which is a min or median of the runs.
   - **Fix:** delete the clause, or replace it with "The max of three keeps the slowest run on each side, so one slow run on either side goes into the difference". The rest of the sentence stands.

## Non-blocking (file, do not fix in this item)

- **H1, `diagnosis…md:158`.** "Held on that count, but weakly" is true of the prediction as it was written. It says more than the data does, though:
  - At the serial rate (4 of 19), at least 6 of 24 failures comes up 39% of the time.
  - Fisher's test gives p = 1.0 for 6/24 against 4/19, and p = 1.0 for 15/60 against 4/19 pooled.
  - The pooled rates compare different runtime mixes: serial was 9 of 19 node, the parallel rounds 20 of 60 node, and `costs:698` fails mostly on node.
  - The only signal is node alone, 14 of 20 against 3 of 9 (p = 0.11).
  - Better wording: "the threshold was met, but no rise is shown; node 14/20 against 3/9 is suggestive only".
- **Shrink full-suite rows are not reported.** `impl59r2/results.tsv` rows 61 to 70 are the 10 full suites that ran beside the shrink loops.
  - In those rows a sixth test failed: `tests/run.test.ts:154` ("a timeout kills children that are being forked at that moment", node, slot s2).
  - `gate:681` failed in 3 of the 6 bun shrink suites, and in 0 of 3 in `shrink`.
  - `:7` ("Five tests ... across both passes") and item 21's description are true as scoped to the 79 runs. But `:161-162` count the shrink runs for kills and leave out their failures.
- **`diagnosis…md:8`** says both new failures were "Reproduced with a mechanism shown by runtime output". What the output shows is a failure mode, a 5 s timeout. `:176` itself says that what brings `launcher:55` on "is not shown". "Failure mode" would be accurate.
- **`diagnosis…md:47` and `:49`** repeat the same sentence ("Load is the 1-minute load average from `os.loadavg()`.").
- **`skills/router/playbooks/bug-fix.md:23`.** The example `` `pricing.py:12` `` is not marked as a placeholder.
  - It names a file of the bench template: T2's reference fix is in `bookings/domain/pricing.py` (`sandbox/bench/reference/T2.patch:1`).
  - `<file:line>` would be unambiguous and point at no bench task.
  - In my run the session wrote its own location, so it read the example as an example (n=1).
- **`bug-fix.md:13`.** In "Do not read code for a theory before it exists", the nearest antecedents of "it" are now "a clean repro" and "the rate", not the command.
- **The live run read code before the loop ran, as round 1's did.**
  - Call #2 read `bug-fix.md` and ran `grep -rn "guest" bookings` in one Bash call, 5 s before the symptom command (#3).
  - The playbook text cannot shape a call that is issued together with the read of that text.
  - Two runs (round 1 and this one) are not a rate. This belongs to the router, not to this item.
- **Origin header, `bug-fix.md:1`.** Every clause is true (table below). Two points are left incomplete, and neither is false:
  - The `:55` ask also covers "(c) permission to add temporary production instrumentation".
  - The source's `:8` "Skip phases only when explicitly justified" allows a justified skip in general. The `skip:` token and its condition are mstack's.

## Acceptance, quoted

**"bug-fix.md steps 1 and 2 carry the loop-first procedure, with an origin header on the derived text"**: met.
- The procedure is at `skills/router/playbooks/bug-fix.md:9-23` and the header at `:1`.
- The header is checked clause by clause in Probe D.
- `lint-plugin` passes. Round 1's mutant probe for `tests/lint.test.ts:285-303` still applies: `git diff --stat c7516e0..42557b1 -- src tests` is empty.

**"the procedure is run on item 21 (unidentified-flaky-test) and either identifies the test or records the hypotheses ruled out"**: met, by its second branch.
- H2, H4 and H5 are refuted against predictions written before the runs (`diagnosis…md:57-67`, `:159-162`). I re-derived every count (Probe A).
- `:164` states what "refuted" covers.
- No test is called identified for the August run (`:7`, `:188`).
- The false sentence at `:184` (Changes required 1) is in the mechanism section, not in the hypotheses record.

## Verification I ran

`./bin/mstack gate` at head, before any write: `PASSED - 0 failures, 0 warnings`.

`./bin/mstack gate --full` (store verify `npm test && npm run typecheck && bin/mstack lint-plugin .`), with nothing else of mine running. Load was 10.49 at 02:35:29 UTC and 20.58 at 02:40:24:

```
631 pass
0 fail
Ran 631 tests across 28 files. [195.39s]
ℹ tests 631
ℹ pass 631
ℹ fail 0
> bunx --bun tsc --noEmit
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
gate_full_exit=0
```

No load-sensitive test failed in this run.

Other checks:
- `git diff --stat c7516e0..42557b1 -- src tests`: empty.
- `wc -l skills/router/playbooks/bug-fix.md`: `35`.
- `./bin/mstack lint-plugin .`: `[ok] 6 origin header(s), each naming a licence file that ships` / `PASSED - 0 failures, 0 warnings`.
- `./bin/mstack ledger check diagnosis-loop-in-bug-fix` before my row: `FAIL no verdict at 42557b18; 3 row(s) exist at other SHAs and a new head SHA voids them`.

## Probe A: the diagnosis file against its data

I wrote my own parser, `review59r2/rederive.py`, and ran it over both `results.tsv` files and the committed diagnosis file. It does not use `derive.py`. Output:

```
serial rows 19 Counter({'bun': 10, 'node': 9}) killed 0
serial red by rt {'bun': 1, 'node': 3}
serial names Counter({'costs:698': 4})
serial dur 87 217 load 9.6 27.3
round rows 60 Counter({'bun': 40, 'node': 20}) shrink rows 10 Counter({'bun': 6, 'node': 4})
killed rounds 0 killed shrink 0
bun dur 405 428 runs with >=1 fail 40 of 40
node dur 210 227 runs with >=1 fail 15 of 20
round names by rt [(('bun', 'costs:698'), 1), (('bun', 'gate:681'), 40), (('bun', 'launcher:55'), 29), (('bun', 'run:54'), 4), (('node', 'costs:698'), 14), (('node', 'run:239'), 2), (('node', 'run:54'), 8)]
shrink names by rt [(('bun', 'gate:681'), 3), (('bun', 'launcher:55'), 5), (('node', 'costs:698'), 1), (('node', 'run:154'), 1), (('node', 'run:54'), 2)]
first 24 (rounds 1-4): 24 costs fails 6 by rt Counter({'node': 6})
all 60 costs fails 15
max dur all rows incl shrink 428
fail count == len(names) everywhere: True pass+fail==631: True
round load start range 8.8 29.1 load end range 21.1 65.5
diag parallel table rows 60
parallel table mismatches 0
serial table rows 19 mismatches 0
```

- **Names to lines.** `rg -n` finds `tests/gate.test.ts:681`, `tests/launcher.test.ts:55`, `tests/run.test.ts:54`, `:239` and `tests/costs.test.ts:698` under the exact names in the rows. The sixth name is at `tests/run.test.ts:154`.
- **The timeout text.**
  - Across the 40 bun round logs, `rg -c "this test timed out after 5000ms"` sums to `69` (40 + 29). The node logs have `0`.
  - The timed-out tests took 5008.07 to 6914.06 ms.
  - Spot checks: `1794962574480_bun_b1.log:4-5` is `(fail) hostile stdin ... [6382.92ms]` / `^ this test timed out after 5000ms`, and `:28-29` is `(fail) a citation is the exact report filename ... [5278.75ms]`. `1794966428561_bun_b4.log:24-25` is `gate:681` only, matching the row.
  - Both names are stated with their condition, "under parallel load" (`:8`, item 21's description).
- **Quoted numbers.**
  - `took 3351.0894…ms against 2102.328…ms` is in `1794963947985_node_n2.log`. `took 3506.997…ms against 3270.156…ms` is in `1794963128965_node_n1.log:671`.
  - `costs_alone.log:6` has `stop(hook)=132.3ms stop(no transcript)=123.3ms`, with `1 pass` / `0 fail`. Its `uptime` reads 11.20.
  - `mstack-run-1Iznj3` is in `1794963947982_node_n1.log`.
  - The shrink logs match the table at `:170-174`: 5015.78 to 20899.67 ms, and 1 failure of 3 at 8782.30 ms.
  - `rounds.log` gives round starts from 8.81 to 29.11 and ends from 21.30 to 29.11.
- **Hypotheses written first.**
  - `stat` on `impl59r2/hypotheses.md` gives birth = mtime = `01:42:49 +0100` (00:42:49 UTC). It was never modified afterwards.
  - The first parallel run started at 00:42:54. `results.tsv` was born at 00:46:24, when the first run ended.
  - The playbook commit `683e7a5` is at 00:42:09 UTC, so the hypotheses followed the round 2 text.
- **Each verdict against its written prediction.**
  - H2: max 428 < 434, refuted. H4: 0 of 40 bun runs killed, refuted. H5: 0 of 20 node runs killed, refuted. H3: names outside item 67's list failed, held.
  - H1: met at exactly 6 of 24. See the non-blocking note: `review59r2/h1.py` prints `P(X>=6 | n=24, p=4/19) = 0.394`, `pooled 15/60 vs 4/19 Fisher p = 1.0`, `node 14/20 vs 3/9 Fisher p = 0.106`.

## Probe B: round 1 blocking 2

- `rg -n "measured once" .mstack/progress/diagnosis_unidentified-flaky-test.md .mstack/state.json` exits 1.
- `:184` now says "each the max of three runs (`tests/costs.test.ts:732-733`)". That matches `:732` `const stopMs = Math.max(...[1, 2, 3].map(() => time(() => stop(input))));` and `:733` `const bare = Math.max(...`.
- The clause added after it in round 2 is the new error (Changes required 1).

## Probe C: the widened skip, and one headless run (n=1)

**The text, read cold (`bug-fix.md:21-23`).**
- When the skip applies is clear enough: one line holds the cause, shown by a trace, or by a wrong literal or boundary on the single path the command runs.
- What the line must say is clear: the fixed phrase plus a location.
- The location is shown only as a concrete example (non-blocking above).

**Setup** (`review59r2/live/proj`):
- A fresh `cp -R sandbox/bench/template`.
- One planted bug in a file other than `pricing.py`, so that the playbook's example could not point at it: `bookings/app/service.py:19` `if not guest.strip():` became `if len(guest.strip()) < 2:`. It is a boundary bug of the same kind as round 1's `> 1`.
- With the bug in place, the template's tests pass (`Ran 18 tests ... OK`). `book standard Q 2025-03-01 2025-03-02` prints `error: guest name is required` and exits 1, and `Ada` books.
- The plant is folded into the `template` commit. Then `/Users/romerma/Code/mstack/bin/mstack setup`, `state.verify = "python3 -m unittest discover -s tests"`, and the commit `mstack setup`, as `sandbox/bench/run.mjs:99-110` does.

**Wrapper** (`review59r2/live/run.sh`):
- `env -i`, built from the names HOME USER LOGNAME TERM LANG TMPDIR SHELL, with PATH covering the system, homebrew, bun and claude bin dirs. No ANTHROPIC_* variable is passed.
- `perl -e 'alarm 780; exec @ARGV'` running `claude -p ... --model opus --output-format stream-json --verbose --setting-sources project --strict-mcp-config --max-budget-usd 6 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto`, which was the script's own child, then `wait $pid`.
- The stream is at `review59r2/live/stream.jsonl`, outside the project. claude is 2.1.327.
- Prompt: ``/mstack a one-letter guest name is refused: `python3 -m bookings book standard Q 2025-03-01 2025-03-02` prints `error: guest name is required` and exits 1, though a name was given. It should book like any other name.``

**Result:**
- `INIT plugins: ['mstack', ...] perm: auto model: claude-opus-5-5`.
- `exit=0 wall=350s`, stderr empty.
- The three result events (the session went on after subagent hand-backs) give the same total: `total_cost_usd 1.4547534`, turns 13 + 4 + 8 = 25, `duration_api_ms 337585`.

**Order (main thread unless marked SUB, UTC):**

```
#2 02:28:43 Bash  cat .../references/intake.md .../playbooks/bug-fix.md; grep -rn "guest" bookings | head -30
#3 02:28:48 Bash  cat README.md; grep ... tests/*.py; ...; python3 -m bookings book standard Q 2025-03-01 2025-03-02; echo "exit=$?"
   TEXT 02:28:52 "Loop is red: exit 1 with `error: guest name is required`."
#4 02:28:56 Bash  git checkout -b fix/one-letter-guest-name; mstack decide --phase intake ...; state add; state set in_progress
#5 02:29:05 Bash  current.md Plan, the eight playbook steps copied:
   "2. Find the cause. skip: cause shown by the loop, the only raiser of that message is `bookings/app/service.py:19` (`len(guest.strip()) < 2`)."
   "4. /mstack:design. skip: single-site fix."
#6 02:29:16 Agent mstack:implementer
#8 02:29:25 SUB first test edit (tests/test_service.py, tests/test_adapters_cli.py); result ".F.................E"
#9 02:29:30 SUB commit 429032e "test(service): reproduce refusal of one-letter guest names", then the one-line fix
#11 02:29:39 SUB commit 5710e90 "fix(service): accept one-letter guest names"
#21 02:31:06 Agent mstack:reviewer -> CHANGES_REQUESTED (no test of the blank-name message); #30 SUB 100993d adds it; re-review APPROVED
```

**Answers:**
- **Symptom command before editing?** Yes. It ran at #3, 8 s before the first state change (#4) and 37 s before the first test or source edit (#8; #5 had already written `current.md`). It exits 1 with the reported message, so it can go red. But `grep -rn "guest" bookings` at #2 read code first (non-blocking above).
- **`skip:` line or hypotheses?** The `skip:` line, with its own `file:line` (`service.py:19`, the right line). `hypothes`, `predict` and `rank` match 0 times across every text block and tool input. `pricing.py:12` matches 0 times.
- **Failing test committed before the fix?** Yes. `git log`: `429032e` (tests only, `2 files changed, 11 insertions(+)`) comes before `5710e90` (`bookings/app/service.py | 2 +-`). In my own worktree at `429032e`, `python3 -m unittest discover -s tests` gives `FAILED (failures=1, errors=1)`.
- **Outside the playbook:**
  - The auto-mode classifier denied the implementer's own `ledger record` (`permission_denials` 1, "[Undermining Oversight]"). The session did not record a row on its behalf.
  - The session committed `.mstack` bookkeeping, then undid it with `git reset --soft HEAD~1` because the new head voided the verdicts. It ended with 8 uncommitted `.mstack` changes.

**What one run can and cannot show:**
- It shows that this text, read by one session, produced the `skip:` line in the copied plan with a real location, a red command before any edit, and the repro commit before the fix.
- It cannot give a rate.
- It cannot separate the effect of the new wording from the different bug and session. Round 1 planted the discount bug in `pricing.py`. I planted a different one, to keep the example's file name out of it.

## Probe D: the origin header against the source at the pinned sha

**Source identity.**
- `git -C scratchpad/up cat-file -t 49dd158d…` gives `commit`.
- `git show 49dd158d…:skills/engineering/diagnosing-bugs/SKILL.md | shasum -a 256` gives `849198df…118d`. The plugin-cache copy has the same digest.
- `LICENSE` at that sha is byte-identical to `licenses/mattpocock-skills-LICENSE.txt` (`diff` is empty).

| Header clause | Source at the sha | Verdict |
|---|---|---|
| asks the user three times: to re-rank | :98 "Show the ranked list to the user before testing ... proceed with your ranking if the user is AFK" | true |
| ... for an environment or artifact when no loop | :55 "Ask the user for: (a) access ..., (b) a redacted captured artifact ..., or (c) permission ..." | true; omits (c) |
| ... when redacted output is not enough | :16 | true |
| nothing is asked; proceeds on its ranking; with no loop says what was tried and stops | playbook :17 "without asking", :14 | true |
| no human-in-the-loop script | :35, :64 `scripts/hitl-loop.template.sh` | true |
| redaction section not copied | :12-16, absent from the playbook | true |
| of regression-test and cleanup only tagged-line removal carried | :114, :130, :136; playbook :18 | true (steps 3 and 6 predate this item, `git show c791f39:...bug-fix.md`) |
| `skip:` is mstack's addition | no `skip:` token in the source; :8 allows a justified skip in general | true as worded |
| router's stop after three failed approaches stays | `skills/router/SKILL.md:107-108` | true |

The implementer's line numbers (:16, :55, :98, :35, :64, :12, :114, :130, :136, :8) all check out.

## Probe E: item 21 and item 67

From `review59r2/items.py`, run on `git show <rev>:.mstack/state.json`:

```
c791f39 item21 status pending n_acc 4 acc sha 7b4146955c119c1b ... | item67 sha 5d446b22449f0aac
c7516e0 item21 status pending n_acc 5 acc sha 0cc9c72f55e2da40 ... | item67 sha 5d446b22449f0aac
42557b1 item21 status pending n_acc 4 acc sha 7b4146955c119c1b ... | item67 sha 5d446b22449f0aac
item21 acceptance byte-identical c791f39 vs head: True
item21 old description is a prefix of new: True
item21 other keys changed: ['description']
item67 identical c791f39 vs head: True
items changed c791f39..head: [21, 59]
```

## Probe F: docs

- `README.md:93` ("Build a command that goes red on the bug first or stop, no loop no fix. Failing test before the fix, and the repro commit lands before the fix in history") is true of `bug-fix.md:9-14`, `:24` and `:31`.
- `docs/wiki/Skills-and-Playbooks.md:144` now has "(unless the loop already shows the cause)", which is true of `:21-23`.
- `CHANGELOG.md:5-11` describes the default path and the header, and both are true.
- The playbook is 35 lines.

## Round 1 non-blocking findings

All six were addressed:
- The header's asks, redaction, cleanup and skip (`bug-fix.md:1`).
- "Candidate" now leads the Finding (`diagnosis…md:7`).
- The solo-run log exists (`logs/costs_alone.log`).
- Item 21's extra criterion moved to its description.
- The wiki has its condition.
- Both clause trims are in (`bug-fix.md:10`, `:13`). The second one left an unclear "it" (non-blocking above).

Still open: the router-level habit of reading code in the same call as the playbook.

## What I did not check

- I did not re-run the 60 parallel or 19 serial runs. Probe A re-derives the recorded data and spot-checks logs (rung 4 on the records, not a reproduction).
- I did not check the round 1 lint mutant again, since `src` and `tests` are unchanged.
- The live run is n=1 (rung 5 for that one session).
- The `git status --porcelain` claim at `diagnosis…md:73` has no artifact. I could not check it after the fact.
