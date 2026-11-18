# Review - bench-hygiene-followups

**Verdict:** CHANGES_REQUESTED

Reviewer pass, 2026-11-18, round 1, at HEAD `4f646230f3c9736040558e16bf97bd41f2290406` (base `5ab0d1b`). I did not
write this item. The report follows the leak rule of `sandbox/bench/DESIGN.md:161-170`: it names no hidden value,
assertion or patch content and does not say which side or fix is correct. Tests are named by task and line: the
line of `meta.json` before the change (as finding 1 cites them) and the `def` line in the hidden module. Sentences
are named by their 1-based position in the task's current `meta.json` `sentences` list (H3 #8) and their source line.

| Ref | Task | `meta.json` line before | hidden module |
|---|---|---|---|
| H3-a | H3 | `:64` | `test_H3.py:128` |
| H3-b | H3 | `:86` | `test_H3.py:151` |
| H4-a | H4 | `:24` | `test_H4.py:128` |
| H4-b | H4 | `:49` | `test_H4.py:121` |
| H4-c | H4 | `:70` | `test_H4.py:176` |

## Where the work is: no version control (for the user)

The change is in `sandbox/bench/`, and no git repository tracks it:
```
$ git check-ignore -v sandbox/bench/check.mjs
.gitignore:20:sandbox/	sandbox/bench/check.mjs
$ git -C sandbox ls-files bench | head -1
$ git -C sandbox status --short
?? bench/
?? clima-portable/
```
The only copy of the harness as it was before this item is the session scratchpad folder
`.../scratchpad/bench49_before/`. A reboot or a routine cleanup can delete it. It holds `DESIGN.md`, the four
`.mjs` files, `tasks/`, `testing/` and `reference/`. It does not hold `template/` or `template-hard/`, which have no
file newer than 2026-11-01T23:34. No commit can restore `sandbox/bench/` if the disk copy is lost. The same is true
for item 48's baseline: `results/`, `streams/` and `evidence/` (136 files, the newest from 2026-11-08T12:33).

## Changes required

1. **Criterion 3: the trace of three of the five tests is still incomplete, but the implement row and the report
   say it is complete.**
   - H4-c is mapped to H4 #8, #10 and #24. `test_H4.py:179`, `:181` and `:185` follow from
     `template-hard/README.md:151`, which no entry of `tasks/H4/meta.json` holds. None of #8, #10 or #24 entails
     them.
   - H3-b is mapped to H3 #12, #15 and #16. `test_H3.py:155-156` follow from H3 #8 (`README.md:181`) as well as
     from #12. #12 says what happens to a stored value, and #8 says what that value is for a version 1 file. #8
     lists two other tests, not H3-b.
   - H4-a is mapped to H4 #3 and #22. `test_H4.py:141-143` also need H4 #5 (`issue.md:11`) and H4 #7
     (`README.md:237`), because #22 covers only that class of error. Neither #5 nor #7 lists H4-a.
   - The implement row of 2026-11-18T20:26:59 (`.mstack/decisions.tsv:259`) says "the extra sentences make the
     trace complete". Item 3 of `impl_bench-hygiene-followups.md` says the five tests are mapped to "the README
     sentences their extra assertions follow from". For H4-c and H3-b, a README sentence they follow from is still
     missing.
   - These gaps are not in finding 1 (`review_benchmark-hard-tier.md:197-202` and its detail file). The
     implementer applied finding 1 in full.
   - Fix:
     - add H3-b to H3 #8;
     - add H4-a to H4 #5 and #7;
     - add a `README.md` entry for line 151 with H4-c;
     - rerun `node sandbox/bench/verify.mjs`.
   - What should change: all three tests are already README-mapped, and H4-a is already issue-mapped, so only H4's
     sentence count should move (24 to 25). No README-mapped or issue-mapped denominator should change.
   - Then correct the completeness claim with a new implement row.
   - Repro:
     - open the lines above and the cited entries;
     - `node -e 'const fs=require("fs");const l=fs.readFileSync("sandbox/bench/template-hard/README.md","utf8").split("\n")[150];const m=JSON.parse(fs.readFileSync("sandbox/bench/tasks/H4/meta.json"));console.log(m.sentences.some(s=>l.includes(s.text)||s.text.includes(l.slice(2))))'`
       prints `false`.

## Non-blocking findings (file them)

2. **H4-b, one assertion read two ways.**
   - The added H4 #23 (`README.md:239`) entails one of its two assertions directly.
   - The other follows from #23 only if an order line counts as an id. The template's code treats it as one
     (`template-hard/stockroom/domain/orders.py:63`).
   - Finding 1's detail file names H4 #5 as its source, and #5 does not list H4-b.
   - If H4-b is also mapped to an issue sentence, the naive-patch rule (`verify.mjs:86-90`) applies to it.
     `verify.mjs` will say whether that is compatible.
3. **The new assertion compares the root only with the check's own `runs/`** (`check.mjs:32-39`).
   - With `TMPDIR` unset, `os.tmpdir()` is `/tmp`. The root is then `/private/tmp/bench-check-*`, next to
     `DEFAULT_HOME` (`lib.mjs:13`). That is the directory finding 5 (`review_benchmark-hard-tier.md:227`) named,
     and the assertion still prints `ok` (run below).
   - Here `TMPDIR` is a `/var/folders` path, and `DESIGN.md:169` now rules out self-checks during a batch. The
     environment and the procedure cover this case; the check does not.
   - Fix: also assert that the root's parent is not an ancestor of `DEFAULT_HOME`.
4. **`DESIGN.md:169-170` gives "can disturb a run in progress" as the reason for the rule.**
   - Finding 5 gave a different reason: the checks put hidden-test files in a temp directory that a running agent
     can reach.
   - The sentence states the rule the criterion asks for. It says less than the reason the rule exists.
5. **`DESIGN.md:166-167` keeps the old example next to the new "refer to tests and sentences by id or number".**
   - The example names the subject of a group of hidden tests.
   - Item 3 of the implementer's report follows the example: it names the added README sentences by subject, not
     by number.
   - Neither is a value, an assertion or patch content. Finding 1 already named the same subjects in a committed
     report, so nothing new is disclosed.
   - Whether the example stays is the user's call.
6. **"Added as extra sentence entries"** (report item 3, implement row) is not exact. Five of the six additions are
   new entries; the sixth appends H4-c to the existing H4 #8 (the first hunk of the `tasks/H4/meta.json` diff).
7. **The design row of 2026-11-18T20:21:02 is wrong about the root.**
   - It says "the scratch root under runs/ lets a self-check walk into a run copy's ancestors".
   - Before the change, the root contained `runs/` (`BENCH_HOME` was `<root>/home`, before copy `check.mjs:13`).
     It was an ancestor of `runs/`, not under it.
   - The implement row and the report describe it correctly.
8. **The implementer's ledger token is too low.**
   - The row records `type-check-only` at `ea01881`, but the report claims rung 4 for points 1 to 3.
   - By `skills/router/references/evidence-ladder.md` ("The ladder maps onto the ledger"), a claim that held at
     rung 4 records `test-verified`. The checks were real scripts run after the last edit, and my reruns give the
     same counts.
   - The row under-claims. It closes nothing, so it does no harm, but it contradicts the report.
   - Criteria 2 and 4 are prose and a decision row, so they are rung 2 by nature.
9. **Already there before this item:** `DESIGN.md:53` and `:97-99` still place run copies under
   `sandbox/bench/runs/`. They have lived under `BENCH_HOME` since item 38 (`lib.mjs:13`, `run.mjs:94`).

## The moved figures

These are `verify.mjs` lines that differ between the rebuilt before tree and the current tree. All other lines are
identical, including every pass count:
```
<   H3 trace: 14 sentences, 18 tests (9 from issue.md, 9 from README.md), all mapped
>   H3 trace: 16 sentences, 18 tests (9 from issue.md, 9 from README.md), all mapped
<   H4 trace: 21 sentences, 26 tests (7 from issue.md, 19 from README.md), all mapped
<   H4 naive: visible 202/202, issue-mapped tests failing 0/7, README-mapped tests failing 9/19
>   H4 trace: 24 sentences, 26 tests (7 from issue.md, 20 from README.md), all mapped
>   H4 naive: visible 202/202, issue-mapped tests failing 0/7, README-mapped tests failing 9/20
```
H4 now counts 27 test mappings for 26 tests because H4-a is in both sets.

Places that quote the old figures:
- Committed: `.mstack/progress/review_benchmark-hard-tier.md:86`, `:132`, `:135-136`, and
  `.mstack/progress/impl_benchmark-hard-tier_r2.md:37`, `:67`, `:70-71`.
- Baseline evidence (untracked): `sandbox/bench/evidence/impl_benchmark-hard-tier_detail.md:46`, and
  `impl_benchmark-hard-tier_r2.full.md:37`, `:67`, `:70-71`.
- None in `sandbox/bench/DESIGN.md`, `docs/`, `README.md`, `CHANGELOG.md` or `.mstack/decisions.tsv`
  (`rg -n "9/19|14 sentences|21 sentences|of 19\b|19 from README|README-mapped tests failing"`).

All of these are pasted output from runs at their own commit, and they were true for that tree. A rerun of
`verify.mjs` now prints different numbers. The change is recorded in `impl_bench-hygiene-followups.md:40-43`, so I
would not rewrite history.

Item 45's comparison is unaffected, because nothing that produces or summarises results reads `sentences`:
- `run.mjs` uses meta only through `hasTask` and `templateOf` (`run.mjs:23`, `:97`; `lib.mjs:71`, `:77`);
- scoring counts the `def test_` lines of the hidden module (`lib.mjs:66`);
- `summary.mjs` reads `tier` and `pristine_pass` (`summary.mjs:23`, `:42-43`).

I ran `summary.mjs` on `results.tsv` and `results-calibration.tsv` with the before tree and with the current tree.
The output is identical: 30 and 12 lines.

## Acceptance, quoted

**"check.mjs creates its scratch root outside every ancestor of a run copy (os.tmpdir() or under BENCH_HOME but not
under runs/), and check.mjs asserts it"** - met.
- `check.mjs:11-12` creates the root and `BENCH_HOME` as two `mkdtemp` directories under `realpath(os.tmpdir())`.
- `check.mjs:32-39` asserts that neither the root nor the runs directory contains the other.
- The mutants go red. The real run gives 91 ok and leaves nothing behind.
- After replacing `join(root, "home")` with `home`, all 57 earlier `ok(...)` calls are textually unchanged; only
  the new one is added (script below).
- One gap remains: non-blocking 3.

**"DESIGN.md states the widened leak rule: committed text names no hidden values, assertions, patch contents, nor
which side or fix is correct; and states that self-checks are not run while a batch is running"** - met.
- `DESIGN.md:163-167` names all four and adds reviews and decision rows to what the rule covers.
- `DESIGN.md:169-170` states the self-check rule.
- What I read for this item's committed text:
  - the report;
  - decision rows 258 and 259;
  - the four commits `git log 5ab0d1b..4f64623 --format=%B` (subjects only, no bodies, no trailer);
  - the `state.json`, `current.md` and `ledger.tsv` diffs.
- None of it holds a hidden value, an assertion, patch content, or which side or fix is correct.
- Two gaps remain: non-blocking 4 and 5.

**"the five hidden tests that check more than their mapped sentence get the extra README sentences in meta.json
(review_benchmark-hard-tier.md finding 1), verify.mjs still green"** - unmet (blocking 1).
- What holds: each added sentence entails the assertions that finding 1 named for its test:
  - H3 #15 and #16 for H3-a and H3-b (for H3-b's stock figure, together with receiving, which the visible suite
    exercises);
  - H4 #22 for H4-a;
  - H4 #23 for one of H4-b's two assertions;
  - H4 #8 and #24 for two parts of H4-c (#8 holds for it given the module's own setup, `test_H4.py:20-53`).
- `verify.mjs` exits 0.
- The other `meta.json` keys (`tier`, `template`, `pristine_pass`, ...) are unchanged in both files, and every
  earlier entry is kept verbatim except H4 #8, which gains one test.

**"README v1 discount wording vs the v1 fixture (finding 2) and the cosmetic items (finding 3) are fixed only if the
hard tier is re-baselined; otherwise a decision row records leaving them"** - met.
- The design row 2026-11-18T20:21:02.123Z (`.mstack/decisions.tsv:258`) records leaving both, because the tier is
  not re-baselined.
- `diff -rq` of the snapshot against `sandbox/bench`: under `tasks/`, only `H3/meta.json` and `H4/meta.json`
  differ. `reference/` and `testing/` are identical. `template/` and `template-hard/` are not in the snapshot, and
  none of their files changed after 2026-11-01.

## Requirement-to-test table and gate

The report's table has four `n/a:` rows, and `n/a:` is honest here.
- The checks are untracked scripts under `sandbox/`.
- `src/rcheck.ts` (`citationProblem`) accepts only an existing, test-classified path inside the store, and such a
  citation would name a file that no commit holds.

Each reason is true as written:
- A1: I saw the same geometry go red (mutant m1). I did not see the implementer's transient pre-move red.
- A2: true.
- A3: true about pass counts. But `verify.mjs` proves only that each sentence is verbatim and each test is mapped,
  not that a mapping is complete, so it could not catch blocking 1.
- A4: the time matches the design row.

`./bin/mstack gate`: `PASSED - 0 failures, 0 warnings`.

`./bin/mstack ledger check bench-hygiene-followups`: `FAIL no verdict at 4f646230; 1 row(s) exist at other SHAs`.
The implementer's row is at `ea01881`; the row at this head is mine.

`./bin/mstack gate --full`: exit 0. The store verify `npm test && npm run typecheck && bin/mstack lint-plugin .` passed: `tests 891`, `pass 891`, `fail 0`, and then `PASSED - 0 failures, 0 warnings`. It ran partly while my `check.mjs` runs were going. This item changes no plugin code, so the suite proves only that nothing in the repository broke.

## Verification I ran

No batch was running (`pgrep -fl run.mjs` printed nothing). Everything ran at HEAD `4f64623`, on this checkout's
`sandbox/bench` unless a copy is named. Scripts are in `.../scratchpad/review49/`.
```
node sandbox/bench/check.mjs     exit 0, 91 ok, 0 FAIL, "all harness checks passed"
  ok   scratch root is neither an ancestor of nor under the runs directory: /private/var/folders/.../T/bench-check-d9FpS4 vs /private/var/folders/.../T/bench-check-home-CqZs4u/runs
node sandbox/bench/verify.mjs    exit 0, "all checks passed"
sha1 of every file under sandbox/bench before and after both runs: identical
bench-* entries in os.tmpdir() and /private/tmp before and after: identical, none left
TMPDIR=<symlink to a scratch dir> node sandbox/bench/check.mjs: exit 0, 91 ok, 0 FAIL; both dirs printed as the link target's real path
```
The mutants of `check.mjs` ran on truncated copies in `review49/mut/`: the file up to the end of the scratch-root
block, plus its own cleanup and exit, next to a copy of `lib.mjs`.
```
m0 unmutated                         exit 0  ok
m1 BENCH_HOME = <root>/home          exit 1  FAIL ... /T/bench-check-kKyPDi vs /T/bench-check-kKyPDi/home/runs
m2 root = <BENCH_HOME>/runs/scratch  exit 1  FAIL
m3 root = <BENCH_HOME>/runs          exit 1  FAIL
m4 root = <BENCH_HOME>               exit 1  FAIL
m0, TMPDIR unset                     exit 0  ok   /private/tmp/bench-check-4Je0VA vs /private/tmp/bench-check-home-FlsjiM/runs
m0, TMPDIR a symlink                 exit 0  ok   (the link target's real path)
```
Assertions compared before and after (`node` script, `join(root, "home")` normalised to `home`): 57 `ok(` lines
before and 58 after. The only new line is the scratch-root assertion; no line exists only in the before copy.

For `verify.mjs` on the before tree, I rebuilt a before tree in `review49/before_tree/` from `sandbox/bench` minus
`results/`, `streams/` and `evidence/`, overlaid with the snapshot. `diff -rq` against the snapshot is clean. The
run exits 0, and its output differs from the current run only in the lines shown under "The moved figures".

I compared the implementer's `impl49/diff.txt` with my own `diff -ru`: the content is the same, and only the hunk
alignment differs. The changed files' mtimes (21:25:00 to 21:26:04) are older than `diff.txt` (21:26:54).

## Where each claim stopped on the evidence ladder

- Rung 4, all run by me:
  - `check.mjs` (plain, and with a symlinked `TMPDIR`) and the mutants;
  - `verify.mjs`, now and on the before tree;
  - the `summary.mjs` comparison;
  - the no-leftover snapshots;
  - the gate.
- Rung 3: the mapping judgement, from reading the five tests against `README.md`, `issue.md` and `meta.json`.
- Rung 2: the `DESIGN.md` wording, the leak reading of committed text, and the durability fact (shown by the
  commands above).

## What I did not check

- The implementer's pre-move red run, which was a transient state. Mutant m1 reproduces the same geometry.
- A full `check.mjs` run under a mutant. A copy's `../..` is not a git repository, so its mstack arms cannot
  archive a version. The rest of `check.mjs` differs from before only by the root/home renames, which I read line
  by line.
- Whether other hard tests have the same kind of gap. I read the five tests of finding 1, not the other 39 of H3
  and H4.
- Whether a running agent would ever walk up to a sibling temp dir. That is the leak geometry, not this item.
