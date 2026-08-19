---
name: design
description: Design the shape of a change before writing it, by generating structurally distinct candidates, judging them against criteria fixed in advance, and recording the decision with its rejected alternatives. Use before implementing anything non-trivial, or when asked to design, architect, or choose an approach.
argument-hint: [what to design]
---

# Design

## 1. Ground

`/mstack:understand` the subsystems this touches. Designing against a guess about the current
shape produces a design that fits a system nobody has.

## 2. Fix the criteria before you see the candidates

Three to six concrete criteria for this specific problem. Write them down now, and do not show
them to the candidate generators. Criteria invented after the fact select for whichever
candidate you already liked.

## 3. Design it twice

At least two **structurally distinct** candidates, not two flavours of the same shape. If the
constraints genuinely forced one answer, say so and name the constraint: "this was the only
viable shape because X" is a legitimate outcome, and it is different from not having looked.

Fan them out in one message so they cannot see each other. Each writes to its own path. If they
diverge wildly, the framing was underspecified: reframe and rerun rather than averaging the
divergence.

## 4. Judge, then graft

One judge, on a **different model** from the generators, scoring against the criteria from step
2. Pick a base, graft what is better from the others, and say what you rejected and why.

## 5. Write it down

`.mstack/specs/<slug>/design.md`, or a decision row if there is no spec:

- **Problem.** What makes the shape non-obvious. One paragraph.
- **Usage.** The caller's view, written **first**. The type sketch derives from this, and when
  the two disagree you reconcile the sketch to the usage. The caller's experience is the spec;
  the types serve it.
- **Shape.** Data structures, then how data moves through the signatures.
- **Rejected alternatives.** Required. A design with no rejected alternative is a first idea.
- **Trade-offs accepted.** In the form "we accept X in exchange for Y."
- **Open questions.** Phrased as questions. Only genuinely deferrable ones: if the answer would
  change the shape, resolve it now.

## Red flags

- **Shallow module.** The interface costs as much to learn as the implementation it hides.
- **Information leakage.** The same design decision appears in two places.
- **Temporal decomposition.** Modules split by execution order rather than by what they hide.
- **Pass-through method.** A method that does nothing but call another with the same signature.

A deep module concentrates capability behind one interface. A deep call chain scatters
understanding across layers. They look similar in a diagram and are opposites in practice.
