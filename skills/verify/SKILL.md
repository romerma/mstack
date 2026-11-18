---
name: verify
description: Prove one claim about a change on the surface where it is actually true or false, place the result on the evidence ladder, and record a typed verdict in the ledger. Use after implementing anything, or when asked to verify, prove, or check that something works.
argument-hint: [what to prove]
---

<!-- Origin: the five steps between running a command and claiming a result (its Gate Function, lines 24-36) and the case that a run from before the change is not evidence (line 42), from obra/superpowers, skills/verification-before-completion/SKILL.md @ 3be5aad3dd2400ef23b15680969f4bcd3b6d7b8b (MIT, licenses/obra-superpowers-LICENSE.txt, identical at that commit). Adapted: the source's Iron Law, red flags, rationalization table, key patterns and when-to-apply list are not copied, its table of claims (lines 40-48) is reduced to one contrast, a passing run against the claim actually made (lines 45 and 48), and "at this head" is mstack's wording. -->

# Verify

1. Name the claim. One sentence, falsifiable. "The endpoint works" is not a claim; "POST
   /invoices returns 422 with an empty body" is.
2. Pick the surface where the claim is actually true or false. Unit tests answer questions
   about branches. They do not answer questions about the running system.
3. Name the command that proves it and run all of it, now, at this head: a run from before the
   last edit is not evidence. Read the whole output, its exit code and its counts, and capture
   the real output, not a summary of it.
4. Check that output against the claim as worded (a green suite proves "the suite is green",
   not "the bug is fixed"), state the claim with the evidence or state what the output actually
   shows, and place it on the [evidence ladder](../router/references/evidence-ladder.md), saying
   where it stopped.
5. Record the verdict:
   `mstack ledger record <slug> "$(git rev-parse HEAD)" <verdict> --evidence <path> --verifier <role>`.
   Be honest about the rung. `type-check-only` is the correct answer when that is all you ran,
   and overstating it is the single failure this workflow exists to catch.
6. If it is inconclusive, say so. **Inconclusive is not a pass, and a negative result is a
   result.** Hiding one wastes the next person's day.

**Reply:** the claim, the rung, the command, and its real output.
