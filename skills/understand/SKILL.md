---
name: understand
description: Build a traced mental model of a subsystem before changing it, covering both how it works now and why it ended up this way. Use before designing or fixing anything in unfamiliar code, or when asked how something works, why a decision was made, or to explain a part of the codebase.
argument-hint: [subsystem or question]
---

# Understand

Two questions, and they have different sources.

**How does it work** is answered by the code. **Why is it like this** is answered by history:
`git log -p` and `git blame` on the seam, the commit messages, whatever issue tracker or chat
the repo is wired to. Code cannot tell you what was rejected, and that is usually the part that
matters.

## Scale the effort

| Scope | Approach |
|---|---|
| One file, one function | Read it. No fan-out. |
| One subsystem | One pass, direct. |
| Crosses subsystems, or nobody knows the answer | Two or three readers in parallel, each with a narrow disjoint question |

When you fan out, each reader writes to `.mstack/progress/explore_<topic>.md` and returns the
path. Narrow questions, disjoint scopes. Three readers given the same broad question return the
same shallow answer three times.

## The account

Present it in this order, and omit any section with nothing in it:

- **Overview.** What this is for, in a paragraph.
- **Key concepts.** The three to five nouns you need before the rest makes sense.
- **How it works.** The path a request or a value actually takes, with `file:line`.
- **Where things live.** The map, so the next person does not repeat this.
- **Gotchas.** What is surprising, and what has already bitten someone.

## Say what you did not establish

The failure mode of an explanation is that it reads as authoritative whether or not it is true.
Mark every claim with where it stopped on the
[evidence ladder](../router/references/evidence-ladder.md). A claim about structure needs a real
`file:line`. A claim about behaviour needs rung 4: you ran it.

Anything you inferred but did not confirm gets said out loud as an inference.
