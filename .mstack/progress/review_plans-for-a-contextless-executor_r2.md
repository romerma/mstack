# Review - plans-for-a-contextless-executor (round 2)

**Verdict:** APPROVED

Head reviewed: `32a7b246aaa61e29991fbaaef98f6cd3aa52f70d`. Change under review: `git diff 5220700..32a7b24 -- skills CHANGELOG.md`
(four clauses in three files). Decision row: `.mstack/decisions.tsv:206` (`review-r2`, item 64).

## Round 1's blocking finding

**"`skills/router/playbooks/orchestrate.md:1` and `CHANGELOG.md:13` say the unit-size rule is in step 2. It is not."**
Closed. The header now reads "the unit-size rule in step 1 and the no-placeholder rule in step 5", and the
CHANGELOG reads "`skills/router/playbooks/orchestrate.md` steps 1 and 5". Both are true (clauses 1 and 3 below).

## The four changed clauses, each against the text

1. **orchestrate.md:1, "the unit-size rule in step 1 and the no-placeholder rule in step 5"**: true.
   Step 1 (`orchestrate.md:13-17`) has the unit definition: "A unit is the smallest piece that carries its own
   test cycle and deserves a fresh reviewer's gate; setup, configuration and docs fold into the unit whose
   deliverable needs them, and two units are separate only where a reviewer could reject one and approve the other."
   Step 2 (`:18-20`) is "Seed the state" and has no size rule. Step 5 (`:42-45`) has "never 'TBD', 'handle edge
   cases', 'as in unit 3', or a name the brief and the repository do not define".
2. **orchestrate.md:1, "and without its last sentence (each task ends with an independently testable deliverable)"**: true.
   The source's last Task Right-Sizing sentence, at the pinned sha, lines 42-43: "Each task ends with an
   independently testable deliverable." No line of the orchestrate body below the header carries it, and none
   carries "scaffolding" either (the earlier clause beside it still holds):
   ```
   $ bat -p --color=never -r 2: skills/router/playbooks/orchestrate.md | rg -n -i "testable|tested by itself|independent|scaffold"; echo "rg exit: $?"
   rg exit: 1
   ```
3. **CHANGELOG.md:13, "in `skills/router/playbooks/orchestrate.md` steps 1 and 5"**: true, for the same lines as clause 1.
   The sentence names where "the text" of both rules lives: size in step 1, the no-context and no-placeholder rule in step 5.
4. **skills/spec/SKILL.md:7, "Task Right-Sizing is the Size paragraph, its first sentence unchanged and the rest reworded"**: true.
   First sentence, compared as strings after joining the wrapped lines (source lines 38-43 at the pinned sha, `SKILL.md:57-60`):
   ```
   SRC: A task is the smallest unit that carries its own test cycle and is worth a fresh reviewer's gate.
   SPEC: A task is the smallest unit that carries its own test cycle and is worth a fresh reviewer's gate.
   IDENTICAL
   ```
   The rest is reworded. The source has "When drawing task boundaries: fold setup, configuration, scaffolding, and
   documentation steps into ...", "split only where a reviewer could meaningfully reject one task while approving its
   neighbor" and "Each task ends with an independently testable deliverable". The skill has "Setup, configuration,
   scaffolding and docs fold into ...", "Split only where a reviewer could reject one task and approve its neighbour"
   and "Each task ends in something that can be tested by itself".

**Other clauses of the two edited headers.** The edits replaced "steps 1 and 2" with "step 1", added the omission
clause to the orchestrate header, and in the spec header replaced "reworded" with "its first sentence unchanged and
the rest reworded" (see the diff). The new orchestrate clause sits inside the Task Right-Sizing clause and does not
touch the No Placeholders, Overview or Remember clauses. The new spec clause narrows "reworded" and leaves the rest of
the spec header as it was. No other clause changed, and neither addition contradicts a neighbouring clause.

## Leftovers of the old claim

```
$ rg -n "steps 1 and 2|steps 1, 2" skills agents docs CHANGELOG.md README.md
skills/router/playbooks/bug-fix.md:1:<!-- Origin: the procedure in steps 1 and 2 from mattpocock/skills, skills/engineering/diagnosing-bugs/SKILL.md @ 49dd158... -->
```
The one hit is the bug-fix playbook's own origin header, which describes a different source (mattpocock
`diagnosing-bugs`). It is not about orchestrate and not part of item 64. No claim that orchestrate's rule sits in step 2
is left, `docs/wiki/` included. A wider search for any orchestrate step number:
```
$ rg -n -i "orchestrate[^\n]{0,80}step|step[s]? [0-9][^\n]{0,60}orchestrate" skills agents docs CHANGELOG.md README.md
CHANGELOG.md:13:  spec skill), in `skills/router/playbooks/orchestrate.md` steps 1 and 5, and in the `tasks.md`
```

## Verification I ran

```
$ git diff --stat 5220700..32a7b24 -- src tests agents
(empty)

$ git diff --stat 5220700..32a7b24
 .mstack/decisions.tsv                              |   1 +
 .mstack/ledger.tsv                                 |   1 +
 .mstack/progress/current.md                        |   2 +-
 .../review_plans-for-a-contextless-executor.md     | 481 +++++++++++++++++++++
 CHANGELOG.md                                       |   2 +-
 skills/router/playbooks/orchestrate.md             |   2 +-
 skills/spec/SKILL.md                               |   2 +-
 7 files changed, 487 insertions(+), 4 deletions(-)

$ ./bin/mstack version
mstack 0.2.1 at /Users/romerma/Code/mstack

$ ./bin/mstack lint-plugin .
...
-- provenance
[ok]    12 origin header(s), each naming a licence file that ships
...
PASSED - 0 failures, 0 warnings
lint-plugin exit: 0

$ ./bin/mstack gate
...
[ok]    one active item: plans-for-a-contextless-executor (reviewing)
...
[ok]    working tree is clean
PASSED - 0 failures, 0 warnings
gate exit: 0

$ ./bin/mstack ledger check plans-for-a-contextless-executor     (before this round's row)
FAIL no verdict at 32a7b246; 2 row(s) exist at other SHAs and a new head SHA voids them
```
The ledger FAIL is expected before this review records its row at the new head.

## Acceptance, quoted (item 64, `./bin/mstack state show 64`)

**"the spec skill and the orchestrate playbook carry the task-sizing rule with an origin header"**: still met.
`SKILL.md:57-60` and `orchestrate.md:13-17` carry the rule, each file opens with an origin header, and lint-plugin
reports "12 origin header(s), each naming a licence file that ships". Round 2 touched only header and CHANGELOG
wording, not the rule text.

**"one spec written with it has tasks a stranger could execute, judged by the spec-reviewer"**: met in round 1
(live run, Probe E of `review_plans-for-a-contextless-executor.md`). No code, agent or rule text changed since
(`git diff --stat 5220700..32a7b24 -- src tests agents` is empty, and the skills diff touches only line 1 of
orchestrate.md and line 7 of SKILL.md), so that result still holds. I did not re-run it.

## Rebuttals

The `review-r2` row (`decisions.tsv:206`) rebuts nothing. It applies the blocking finding and round 1's N1 (header half)
and N3. All three hold, as shown above.

## Non-blocking (not re-raised)

Round 1's N1 to N9 are being filed. The change made none of them worse. N3 is resolved. N1's header half is resolved:
the header now lists both omissions. Its other half, that no reason is given for either omission, stays with the filed
finding. N2 (the CHANGELOG's "one size rule" against orchestrate's shorter text) is unchanged by this diff.

## Evidence ladder

- Clauses 1 to 4 and the leftover search: rung 4 (read and compared directly, commands pasted).
- lint-plugin and gate: rung 4 (run at head 32a7b24).
- Acceptance criterion 2: carried over from round 1's live run at 5220700, not re-observed this round.

## What I did not check

- The full suite and a live session (out of scope by brief; round 1 ran both at 5220700, and no code changed since).
- The unchanged clauses of the origin headers against the source, beyond confirming that the edit did not falsify them
  (round 1 Probe A covered them).
- The accuracy of `skills/router/playbooks/bug-fix.md:1` "steps 1 and 2" for its own source (not item 64).
