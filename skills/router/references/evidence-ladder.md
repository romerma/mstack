<!-- Origin: the five steps between running a command and claiming a result (its Gate Function, lines 24-36) and the case that a run from before the change is not evidence (line 42), from obra/superpowers, skills/verification-before-completion/SKILL.md @ 3be5aad3dd2400ef23b15680969f4bcd3b6d7b8b (MIT, licenses/obra-superpowers-LICENSE.txt, identical at that commit). Adapted: the source's Iron Law, red flags, rationalization table, key patterns and when-to-apply list are not copied, its table of claims (lines 40-48) is reduced to one contrast, a passing run against the claim actually made (lines 45 and 48), and "at this head" is mstack's wording. -->

# The evidence ladder

For every fact the safety of a change depends on, get it as far down this list as is cheap,
and **say where it stopped**.

| Rung | What it means |
|---|---|
| 1 | **You said so.** Worthless on its own. |
| 2 | **You pointed at the line.** A real `file:line`, or the dependency's own source. |
| 3 | **You showed the bad case cannot happen.** You walked the failure step by step and it does not reach. |
| 4 | **You ran it.** A script or test that calls the real code and fails loudly if you are wrong. |
| 5 | **You reproduced it in the running system.** |

Any safety fact you cannot get to rung 4, say so out loud. Do not write it up as settled.

Rungs 4 and 5 carry an obligation the other three do not: **say what you ran it on.** A run
answers a question about the thing it ran against, and nothing else. A probe of a 264-byte
script was cited as rung 4 for a project whose real module graph was a hundred times that, and
three later passes inherited the conclusion without asking what had been measured. The claim
was true about the probe and false about the project. "I ran it" and "I ran it on your case"
are different rungs wearing the same number.

## Why this matters more than it looks

A write-up that sounds right is worthless. It reads as convincing whether or not it is true,
and that is the trap. The ladder exists so the reader can tell the difference without
re-deriving the whole thing.

The same rule applies to delegated work. Inspect the artifact, not the summary: the diff, the
file, the runtime behaviour. Agents report what they intended, which is not always what
happened.

## The ladder maps onto the ledger

| What happened | Verdict to record |
|---|---|
| The claim held at rung 5 | `live-verified` |
| The claim held at rung 4 | `test-verified` |
| Rungs 2-3 only, or a type check | `type-check-only` |
| Could not run the check at all | `verifier-blocked` |
| Ran it and the claim failed | `verifier-failed` |

The check in the last two rows is the whole claim you were asked to judge, not the suite that
ran inside it. A reviewer whose suite was green but whose review found a blocking defect ran
the check and the check failed: that records `verifier-failed`, never the suite's rung.

`mstack ledger record <target> "$(git rev-parse HEAD)" <verdict> --evidence <path> --verifier <role>`

Two rules travel with that command. CI green is an *input* to a verdict, never a verdict on its
own. And a new head SHA voids the row: a rebase rewrites every SHA above it and silently
invalidates verdicts without touching a single check.

## Between the run and the claim

1. Name the command that proves the claim.
2. Run all of it, now, at this head. A run from before the last edit is not evidence.
3. Read the whole output: its exit code and its counts.
4. Check that output against the claim as worded. A green suite proves "the suite is green",
   not "the bug is fixed".
5. Only then state the claim with the evidence, or state what the output actually shows.

## What does not count

- "I added the handler, it should work." No executable evidence.
- A test that only asserts nothing threw. It has to assert the concrete result, and it has to
  fail if the change is reverted.
- Pasting a *summary* of the output instead of the output. The reviewer reads the real thing.
- A run from before the last edit, cited for the code as it now stands.
- Marking something done on a partial run, or on output nobody else saw.
