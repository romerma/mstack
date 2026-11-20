<!-- Origin: the procedure in steps 1 and 2 from mattpocock/skills, skills/engineering/diagnosing-bugs/SKILL.md @ 49dd158d1076134a641b33efb035946536778336 (MIT, licenses/mattpocock-skills-LICENSE.txt). Adapted: the source asks the user three times (to re-rank the hypotheses, for an environment or artifact when no loop can be built, and when redacted output is not enough) and here nothing is asked: the session proceeds on its ranking, and with no loop it says what was tried and stops; no human-in-the-loop script; the redaction section is not copied; of the regression-test and cleanup phases only the removal of tagged debug lines is carried, because steps 3 to 8 cover the test-first fix; the `skip:` in step 2 is mstack's addition; the router's stop after three failed approaches stays. -->

# Bug fix

Be scientific. Every shipped line traces to runtime evidence. Belt-and-suspenders that "might
help" is a hypothesis, not a fix, and it does not ship. When evidence refutes a hypothesis,
revert what it motivated.

Steps 2, 4, 6 and 8 change with the item's size, as the
[size matrix](../references/size-matrix.md) sets out; the rest hold at every size.

1. **Build the loop first**, on the surface where the bug happens: one command that goes red
   on it, already run, with its output. It asserts the reported symptom (not
   "did not crash"), gives the same verdict every run, takes seconds, runs unattended. A
   bug that is not constant needs a higher rate, not a clean repro: loop the trigger, run it
   in parallel, add load, pin the rate. Do not read code for a theory before that command
   exists. Do not hand the repro back to the user. No loop, no fix: say what was tried and stop.
2. **Find the cause.** Shrink the repro to what is load-bearing. Write three to five ranked
   hypotheses, each with its prediction ("if X is the cause, changing Y makes it go away"),
   before testing any; take them in rank order without asking. One probe per prediction, one
   variable at a time. Tag debug lines with one unique string and remove them before review.
   A performance regression is measured against a baseline and bisected, not logged. At size
   `l`, seed the search with `/mstack:understand`; at `s` and `m`, read the code the loop runs
   through yourself. Confirm the *mechanism*
   with runtime evidence before designing anything. If the loop already shows the cause
   at one line, by a stack trace or a wrong literal or boundary on the only path the command
   takes: ``skip: cause shown by the loop, `<file>:<line>` ``.
3. Write the failing test first. It must fail without the fix. If it passes on unmodified code,
   you have not found the bug.
4. `/mstack:design` only if the fix crosses a function boundary, at the depth the matrix gives
   the size (`m` in the session, `l` designed twice). A one-line fix inside one function does
   not need a design pass; say `skip: single-site fix`. At `s`, `skip: size s`.
5. Delegate the fix to `mstack:implementer` so a different pass reviews the diff.
6. Verify on the same surface as step 1. Unit tests show a branch behaves a certain way; they
   do not prove the bug is gone. At `m` and `l`, also `mstack verify --mutation` once the fix
   is committed.
7. Stage the commits so the failing repro lands **before** the fix in history. Someone will
   want to check out the broken state.
8. `/mstack:review`, then `/mstack:ship`. At `s` one lone reviewer; at `l` a panel with two or
   more lens reports in one round.

**Reply:** the mechanism in one paragraph, the repro, and where the fix was verified.
