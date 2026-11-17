<!-- Origin: structure from mattpocock/skills, skills/productivity/grilling/SKILL.md @ 49dd158d1076134a641b33efb035946536778336 (MIT, licenses/mattpocock-skills-LICENSE.txt); the ruling pattern from obra/superpowers, skills/subagent-driven-development/SKILL.md @ 22f0b463e7a5e579904dd6211a520321035526f7 (MIT, licenses/obra-superpowers-LICENSE.txt). Adapted: the agent answers its own reversible decisions, which grilling leaves to the user. -->

# Intake

Turn the request into one queue item. Intake is not grilling: grilling hands every decision
to the user, and here the agent takes the reversible ones and records them.

## Map

Write the request as a design tree. The **frontier** is every node whose prerequisites are
settled. Classify each frontier node, handle it, recompute, and stop when the frontier is empty.

| Kind | Handle it by |
|---|---|
| **Fact** | Find it: the repository, its docs, `git log`, or run something. Never ask the user for one. |
| **Reversible decision** | Take your recommended answer and record it (below). |
| **Product fork** (different user-visible outcomes) or **irreversible choice** | Park it on the item (below). Do not take it. |

## Record a reversible decision

```
mstack decide --phase intake --decision "<what was decided>" --why "<why>" \
  --evidence "<where the fact came from>" --result "if wrong: <what it costs>"
```

`--result` carries the cost: it is the column a later reader scans for what the decision left
behind. Decisions that could not be undone are forks, not rows.

## Park a fork

All forks of one request go on the item as one `--decision-required` string, numbered, each
with its recommended answer and worded so "yes" accepts it:
`1) Should X also do Y? Recommended: yes, because Z. 2) ...`. The user hears every fork once,
in one numbered round after `state add`, and only once no fact or reversible decision is open.
That round is the final message of the turn: stop there. When the answers arrive, resume at
router step 4 (match and copy the playbook); an item with a fork is on the spec path.

`--resolves <slug>` goes only on the `decide` row that answers every fork left in the field:
`--decision` lists the numbered answers, `--result` says what was chosen. A partial answer never
gets `--resolves`: record it as a plain `mstack decide --phase intake ...` row and re-state the
field with only the unanswered forks, in either order.

## End

When the frontier is empty:

```
mstack state add --slug <s> --title "<t>" \
  --acceptance "<observable criterion, quoting the user's words>" [...] \
  --source "<the request and its date, or the document it came from>" \
  --seam "<public surface where a test attaches>" [...] \
  [--decision-required "<numbered forks>"]
```

A **seam** is where the behaviour is observed, such as ``CLI: `mstack state add` exit code and
stdout`` or ```withLock(file, run, opts)` in src/tsv.ts``. A request that changes no behaviour
carries no seam, and the `--description` says why.

## Proportion

A one-line request with nothing ambiguous costs a couple of lookups and one `state add`, not a
study. If the request is a program of work (several changes, several tracks), do not make it one
item: hand it to the [orchestrate](../playbooks/orchestrate.md) playbook, which adds its own items. The forks of that
request still reach the user in one round, each parked on the item it blocks.

## Interactive mode

Only when the request asks to be questioned or to have a plan stress-tested, in any language
("grill me", "stress-test this plan", "hazme preguntas", "cuestiona este plan"). The decisions are then
the user's. Each round puts the whole frontier: numbered, each with a recommended answer, then
wait. Recompute from the answers and go again, with no cap on questions. Done when the frontier
is empty and the user confirms. Facts are still never asked, and nothing is decided on the user's
behalf. End with the same `state add`.
