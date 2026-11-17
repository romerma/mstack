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
