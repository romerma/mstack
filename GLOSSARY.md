# mstack

The words the code and the skills use as terms of art, so a newcomer reads them the way they are meant.

## The work

**Item**:
A unit of work in the project's queue, with a title, acceptance criteria quoted from its source and, when it changes behaviour, the seams where it is tested. By default only one item is active at a time in a working copy.

**Intake**:
The step that turns a request into a queue item. Facts are found, reversible decisions are recorded and forks are parked.

**Fork**:
A decision whose answer changes what the product's user can do or get, or that cannot be undone, so it is put to the user instead of being taken by the agent.

**Seam**:
The public surface where a behaviour is observed and a test attaches. In design vocabulary it is also a place where behaviour can change without editing there.

**Playbook**:
A short numbered list of steps for one kind of request, copied whole into the todo list. A step that is not done stays listed with the reason it was skipped.

**Spec path**:
The opt-in route on which a specification is written and approved by a different pass before any code. On the direct path the item's acceptance criteria are the contract.

## The proof

**Pass**:
One role's run over an item, such as implementing or reviewing. A verdict is meant to come from a pass that did not write the work.

**Lens**:
A distinct angle, such as correctness or security, from which one pass examines the same work. Each reviewer on a panel is given its own.

**Verdict**:
A pass's recorded judgement of the work at one commit: that it holds, that it failed, or that it could not be checked. It is a judgement of the work, where a receipt is only a fact about a command.

**Closing role**:
A role whose verdict can close an item: any named role except the implementer and the spec author, whose verdicts are recorded but leave a closed item red at the gate. The rule goes by the role's name, not by who wrote what.

**Receipt**:
A recorded fact that a verification command ran, against which commit and working tree, and whether it passed. It shows that something ran, not that the work is good.

**Ledger**:
The append-only record of verdicts, each tied to the commit it judged. A failed verdict stays in it, and only a later independent approval answers it.

**Rung**:
One of the five levels of the evidence ladder, from having said so up to having reproduced it in the running system. A claim is reported together with the rung where it stopped.

**Gate**:
A check that is code instead of prose, and that goes red when the work breaks a rule. The session gate checks the working copy, and the merge gate decides whether a change may land.
