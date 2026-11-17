<!-- Origin: structure from mattpocock/skills, skills/productivity/grilling/SKILL.md @ 49dd158d1076134a641b33efb035946536778336 (MIT, licenses/mattpocock-skills-LICENSE.txt); the ruling pattern from obra/superpowers, skills/subagent-driven-development/SKILL.md @ 22f0b463e7a5e579904dd6211a520321035526f7 (MIT, licenses/obra-superpowers-LICENSE.txt). Adapted: the agent answers its own reversible decisions, which grilling leaves to the user. -->

# Intake

Turn the request into one queue item. Unlike grilling, which hands every decision to the user,
the agent takes the reversible ones and records them.

## Map

Write the request as a design tree; the **frontier** is every node whose prerequisites are
settled. Classify each by the first row that fits, handle it, recompute, and stop when the
frontier is empty.

| Kind | Handle it by |
|---|---|
| **Fact**: the request, the repository, its docs or tests, or a convention the project already follows settles it | Find it. Never ask the user for one. |
| **Fork**: its answers change what the product's user can do or get (what is charged, allowed, refused, stored, deleted or returned as a value, including an exit code a script would branch on), or it cannot be undone. A cheap code change makes neither one reversible | Park it on the item (below). Do not take it. |
| **Reversible decision**: the user's result is the same either way (where code lives, names, structure, internal approach), or only a message, label or format differs and follows what the project already prints | Take your recommended answer and record it (below). |

## Record a reversible decision

```
mstack decide --phase intake --decision "<what was decided>" --why "<why>" \
  --evidence "<where the fact came from>" --result "if wrong: <what it costs>"
```

`--result` is the column a later reader scans for the cost. Write the `if wrong:` line first: if
it names lost data or meets the fork test above, this is a fork, not a row.

## Park a fork

All forks of one request go on the item as one `--decision-required` string, numbered, each with
its recommended answer, worded so "yes" accepts it: `1) Should X also do Y? Recommended: yes,
because Z. 2) ...`. The user hears every fork once, in one numbered round after `state add`, and
only once no fact or reversible decision is open. The round names the slug and asks the answers to
name it (`<slug>: yes to 1, ...`). First write into `current.md`'s Next step the slug, its open
forks and both commands below, so a fresh session can act on the note alone. A partial answer: a
plain `mstack decide --phase intake --decision "<answers so far>" --why .. --evidence "<their
words>" --result "<chosen>"` row with no `--resolves`, then `mstack state set <slug>
--decision-required "<only the open forks>"`. The answer to every fork left: the same row with
`--resolves <slug>`, its `--decision` listing each answer (`"1) <answer> 2) ..."`). The round is
the final message of the turn: stop there. When the answers arrive, resume at router step 4; an
item with a fork is on the spec path.

## End

When the frontier is empty:

```
mstack state add --slug <s> --title "<t>" \
  --acceptance "<observable criterion, quoting the user's words>" [...] \
  --source "<the request and its date, or the document it came from>" \
  --seam "<public surface where a test attaches>" [...] \
  [--decision-required "<numbered forks>"]
```

Then choose the path by the triggers in the router's "The two paths" (an answered fork is one):
`mstack state set <slug> --status specifying` on the spec path, else `--status in_progress`,
which cannot go back to `specifying`. A parked item stays `pending` until answered.

A **seam** is where the behaviour is observed, such as ``CLI: `mstack state add` exit code and
stdout``. No behaviour change, no seam: say why in `--description`.

## Proportion

A one-line request with nothing ambiguous costs a couple of lookups and one `state add`. A
program of work (several changes or tracks) is not one item: hand it to the
[orchestrate](../playbooks/orchestrate.md) playbook, whose forks still reach the user in one
round, each parked on the item it blocks.

## Interactive mode

Only when the request asks to be questioned or to have a plan stress-tested, in any language
("grill me", "stress-test this plan", "hazme preguntas", "cuestiona este plan"). The decisions
are then the user's: each round puts the whole frontier, numbered, each with a recommended
answer, then waits. Recompute and go again with no cap on questions, until the frontier is empty
and the user confirms. Facts are never asked. End with the same `state add`.
