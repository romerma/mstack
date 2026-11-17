<!-- Origin: the procedure in steps 1 and 2 from mattpocock/skills, skills/engineering/diagnosing-bugs/SKILL.md @ 49dd158d1076134a641b33efb035946536778336 (MIT, licenses/mattpocock-skills-LICENSE.txt). Adapted: nothing is shown to the user for re-ranking and nothing is asked, because the source proceeds on its own ranking when the user is away and here the session always does; no human-in-the-loop script; the source's redaction, regression-test and cleanup phases are not copied, because steps 3 to 8 already cover the test-first fix, and the router's stop after three failed approaches stays. -->

# Bug fix

Be scientific. Every shipped line traces to runtime evidence. Belt-and-suspenders that "might
help" is a hypothesis, not a fix, and it does not ship. When evidence refutes a hypothesis,
revert what it motivated.

1. **Reproduce it yourself**, on the surface where it actually happens. Do not hand the repro
   back to the user. No repro, no fix: say so and stop.
2. Binary-search the cause. Seed it with `/mstack:understand` over the subsystem. Confirm the
   *mechanism* with runtime evidence before designing anything.
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
