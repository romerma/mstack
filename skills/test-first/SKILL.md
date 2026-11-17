---
name: test-first
description: How the implementer writes tests before code, what a good test is, and the mutant check before reporting. Preloaded into mstack:implementer; not a command.
user-invocable: false
---

<!-- Origin: what a good test is, from mattpocock/skills, skills/engineering/tdd/SKILL.md, tests.md and mocking.md @ 49dd158d1076134a641b33efb035946536778336 (MIT, licenses/mattpocock-skills-LICENSE.txt); the process, from obra/superpowers, skills/test-driven-development/SKILL.md @ 5bf4e78011075bcfc0dc295f0724994cd123ee71 (MIT, licenses/obra-superpowers-LICENSE.txt, identical at that commit). Adapted: seams come from the item and are never confirmed with the user, refactoring is left to review, and the mutant check is added. -->

# Test-first

The red output is the receipt: no receipt, no code. For any change that has behaviour, the
test comes first and you show it failing.

## Seams

The brief names the item's seams as pre-agreed. Test at those, and do not ask anyone to
confirm them. If a seam is wrong or missing, test at the one you needed, record it with
`mstack decide --phase implement`, and say so in the report.

## A good test

- It goes through the public interface at a seam. It would still pass after a rewrite of the
  internals; one that breaks on a refactor with no behaviour change is coupled to the wrong
  thing.
- Its expected value is a literal or a worked example from the spec, never computed by the
  logic under test. `expect(add(a, b)).toBe(a + b)` passes by construction.
- It asserts what a caller observes. It does not read a private field, count calls on your own
  collaborators, or query the database to check what the interface should have shown.
- It mocks only what the project does not own (network, clock, randomness, a third-party
  service), and never your own modules.

## The loop, one slice at a time

A slice is one behaviour. Do not write all the tests first and then all the code: tests
written in bulk check an imagined shape.

1. Write one test for one behaviour.
2. Run it and read the failure. It must fail for the expected reason: the behaviour is
   missing. A typo, a missing import or a crash in setup is not red; fix the test and rerun.
   Paste the red output in your report.
3. Write the least code that passes. No code for a test you have not written.
4. Run it again and watch it pass, then run the project's whole suite.
5. Next slice.

A test that passed the first time it ran has proved nothing. Break the code to see it fail,
or call it a guard and not coverage.

No restructuring beyond what the test needs: review owns refactoring.

## Before you report: mutants

List the mutants your tests should kill: flip a condition, drop a branch, return a constant,
skip a write, change a boundary. Apply each one, run the tests, record killed or survived,
then revert it. A survivor is a missing test, so write it or say why it does not matter. A
reviewer will run its own mutants, and in this repository the blocks came from the ones the
suite missed.

## When it does not apply

A change with no behaviour (docs, prose, config with nothing to observe) has no test to write
first. Say so in one line in the report instead of inventing a test.
