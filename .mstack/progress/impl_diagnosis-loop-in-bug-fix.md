# Implementation report: item 59, diagnosis-loop-in-bug-fix

## What changed

`skills/router/playbooks/bug-fix.md` steps 1 and 2 now carry the loop-first procedure (build one red-capable command, raise the rate for a non-constant bug, then shrink, three to five ranked hypotheses with predictions, one probe per prediction, tagged debug lines, perf bisected, `skip: cause shown by the loop`), under an origin header with an "Adapted:" clause. `src/lint.ts` lists the playbook in `ORIGIN_REQUIRED`, with a case added to the existing test. README and the wiki each had one sentence that said "reproduce it first"; both now say the loop. `CHANGELOG.md` has one entry under Unreleased. Part B ran the new steps on item 21 (see the diagnosis file). Playbook is 35 lines, not about 30 (the 1-line header and a blank are 2 of them); I did not cut further without dropping a required clause. Steps 3 to 8 and the Reply line are unchanged (no contradiction found: `rg "binary|reproduce"` matches only step 7's and the Reply's use of "repro").

## Files

skills/router/playbooks/bug-fix.md, src/lint.ts, tests/lint.test.ts, README.md, docs/wiki/Skills-and-Playbooks.md, CHANGELOG.md, .mstack/progress/diagnosis_unidentified-flaky-test.md, .mstack/state.json (one criterion on item 21), this report.
Commits: e92404a feat(lint) (test, rule and the header line), 2e588d2 feat(router) (the prose), ea0b316 docs, 2773449 chore (diagnosis and item 21).

## Upstream check

A clone of https://github.com/mattpocock/skills was made in the scratchpad; `git show 49dd158d1076134a641b33efb035946536778336:skills/engineering/diagnosing-bugs/SKILL.md` exists (138 lines) and `diff` against the local plugin-cache copy printed IDENTICAL.

## Commands

Red lint test (new entry in the list, `ORIGIN_REQUIRED` unchanged, header absent):

```
AssertionError: header removed from router/playbooks/bug-fix.md: expected a failure, got a pass
(fail) a file that must carry an origin header and does not is caught [191.92ms]
 0 pass
 26 filtered out
 1 fail
```

After the rule and header: `bun test tests/lint.test.ts` gave `27 pass 0 fail`.

Mutant (entry removed from `ORIGIN_REQUIRED` in a scratchpad copy, new test copied in): killed.

```
AssertionError: header removed from router/playbooks/bug-fix.md: expected a failure, got a pass
(fail) a file that must carry an origin header and does not is caught
 0 pass
 1 fail
```

CLI on a copy with the header line deleted:

```
[fail]  skills/router/playbooks/bug-fix.md: no origin header
FAILED - 1 failure, 0 warnings
exit=1
```

Final playbook (`bat -pp skills/router/playbooks/bug-fix.md`, `wc -l` 35; `skills/router/references/intake.md` 77):

```
<!-- Origin: the procedure in steps 1 and 2 from mattpocock/skills, skills/engineering/diagnosing-bugs/SKILL.md @ 49dd158d1076134a641b33efb035946536778336 (MIT, licenses/mattpocock-skills-LICENSE.txt). Adapted: nothing is shown to the user for re-ranking and nothing is asked, because the source proceeds on its own ranking when the user is away and here the session always does; no human-in-the-loop script; the source's redaction, regression-test and cleanup phases are not copied, because steps 3 to 8 already cover the test-first fix, and the router's stop after three failed approaches stays. -->

# Bug fix

Be scientific. Every shipped line traces to runtime evidence. Belt-and-suspenders that "might
help" is a hypothesis, not a fix, and it does not ship. When evidence refutes a hypothesis,
revert what it motivated.

1. **Build the loop first**, on the surface where the bug happens: one command that goes red
   on it, already run once, invocation and output in hand. It asserts the reported symptom
   (not "did not crash"), gives the same verdict every run, takes seconds, runs unattended. A
   bug that is not constant needs a higher rate, not a clean repro: loop the trigger, run it
   in parallel, add load, pin the rate. Reading code for a theory before this command exists
   is the failure this step prevents. Do not hand the repro back to the user. No loop, no
   fix: say what was tried and stop.
2. **Find the cause.** Shrink the repro to what is load-bearing. Write three to five ranked
   hypotheses, each with its prediction ("if X is the cause, changing Y makes it go away"),
   before testing any; take them in rank order without asking. One probe per prediction, one
   variable at a time. Tag debug lines with one unique string and remove them before review.
   A performance regression is measured against a baseline and bisected, not logged. Seed the
   search with `/mstack:understand` when the subsystem is unfamiliar. Confirm the *mechanism*
   with runtime evidence before designing anything. If the loop's red output already shows
   the cause (a stack trace at the faulty line): `skip: cause shown by the loop`.
3. Write the failing test first. It must fail without the fix. If it passes on unmodified code,
   you have not found the bug.
4. `/mstack:design` only if the fix crosses a function boundary. A one-line fix inside one
   function does not need a design pass; say `skip: single-site fix`.
5. Delegate the fix to `mstack:implementer` so a different pass reviews the diff.
6. Verify on the same surface as step 1. Unit tests show a branch behaves a certain way; they
   do not prove the bug is gone.
7. Stage the commits so the failing repro lands **before** the fix in history. Someone will
   want to check out the broken state.
8. `/mstack:review`, then `/mstack:ship`.

**Reply:** the mechanism in one paragraph, the repro, and where the fix was verified.
```

`./bin/mstack lint-plugin .` ends `PASSED - 0 failures, 0 warnings`. `./bin/mstack gate` at 2773449:

```
-- glossary
[ok]    GLOSSARY.md: 14 entries, each a term with a one or two sentence definition

-- workspace
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[ok]    on branch feat/diagnosis-loop
[warn]  1 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 1 warning
```

Suite at the final code commit (ea0b316; 2773449 only adds .mstack files): the last bun run (run 19) was `631 pass, 0 fail`, the last node run (run 18) `631 pass, 0 fail`. The four failures in the loop were all `hook paths stay within budget on a 50 MB transcript` (tests/costs.test.ts:698, item 67); run alone it printed `1 pass 0 fail` at load 10.3. No test outside item 67's list failed.

`pgrep -fl "bun test|node --test"` at the end printed nothing.

## Part B

Diagnosis: `.mstack/progress/diagnosis_unidentified-flaky-test.md`. Conclusion:
- 19 full runs (10 bun, 9 node) at load 9.6 to 27.3: the only failing test was `costs.test.ts:698`, at its line 743 (`stopMs - bare < 50`, two noisy timings), 4 times; no other name.
- Neither hang reproduced (no run reached the 420 s watchdog), so H2, H3 and H4 are untested, not ruled out.
- Whether the 698 test is the August 273/1 failure is not shown.

## R to test

| Acceptance | Covered by |
|---|---|
| steps 1 and 2 carry the loop-first procedure with an origin header | the playbook text above; header enforced by tests/lint.test.ts "a file that must carry an origin header and does not is caught" (new entry at tests/lint.test.ts:291) |
| the procedure is run on item 21 | the diagnosis file; item 21 has one new criterion pointing at it |

## Decisions recorded

None.

## Not shown

- The prose of the playbook was not run through a headless `/mstack` session on a bug-shaped request (seam 2 of the item): there is no test for prose, and I did not run that bench.
- The playbook is 35 lines, over the "about 30" target.
- The run scripts for Part B are in the scratchpad (`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl59/`), not committed.
