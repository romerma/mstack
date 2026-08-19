---
name: verify
description: Prove one claim about a change on the surface where it is actually true or false, place the result on the evidence ladder, and record a typed verdict in the ledger. Use after implementing anything, or when asked to verify, prove, or check that something works.
argument-hint: [what to prove]
---

# Verify

1. Name the claim. One sentence, falsifiable. "The endpoint works" is not a claim; "POST
   /invoices returns 422 with an empty body" is.
2. Pick the surface where the claim is actually true or false. Unit tests answer questions
   about branches. They do not answer questions about the running system.
3. Run it. Capture the real output, not a summary of it.
4. Place the result on the [evidence ladder](../router/references/evidence-ladder.md) and say where it
   stopped.
5. Record the verdict:
   `mstack ledger record <slug> "$(git rev-parse HEAD)" <verdict> --evidence <path> --verifier <role>`.
   Be honest about the rung. `type-check-only` is the correct answer when that is all you ran,
   and overstating it is the single failure this workflow exists to catch.
6. If it is inconclusive, say so. **Inconclusive is not a pass, and a negative result is a
   result.** Hiding one wastes the next person's day.

**Reply:** the claim, the rung, the command, and its real output.
