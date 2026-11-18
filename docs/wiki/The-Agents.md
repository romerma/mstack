# The agents

mstack splits work across five agents so that whoever writes a change is never the one who
approves it. Each agent is a role with its own instructions and its own tool list, launched to
do one job and hand the result to the next pass. A pass is one launch of one agent: it starts
clean, does its one job, and only what it wrote to disk survives it. This page introduces each one: what it is
for, when it runs, what it writes, and what it is built to refuse. The one thing to take away
is that the separation is enforced by which tools an agent is given and by a gate that is
code, not by asking anyone to behave.

The definitions live in `agents/*.md`, one file per role. Each file's frontmatter names the
tools; the body is the role's contract. The transcripts on this page were produced by the
repository's own `./bin/mstack` at the commit that last edited it, in a scratch repository,
and are spelled `$ mstack` per the convention in [The-CLI](The-CLI.md).

## The cast

| Agent | Model | One job | Writes | Must never |
|---|---|---|---|---|
| `orchestrator` | session's (`inherit`) | Owns one item from intake to close and picks who runs next | State moves, [decision rows](State-Files.md) | Write application code, or approve its own work |
| `spec-author` | `sonnet` | Writes the spec for one item on the spec path | `.mstack/specs/<slug>/`, `spec_<slug>.md` | Review its own spec |
| `spec-reviewer` | `opus` | Grills a spec before any code exists | `spec_review_<slug>.md` | Edit the spec, or review a spec it wrote |
| `implementer` | `sonnet` | Implements one item with the tests that prove it | The code, `impl_<slug>.md`, its own [ledger](State-Files.md) row | Mark its own work approved or done |
| `reviewer` | `opus` | Judges an implementation it did not write | `review_<slug>.md`, its own ledger row when reviewing alone | Edit the code, or approve on a red gate |

The Model column is the `model:` line in each agent's frontmatter. The two passes that write
run on Sonnet and the two that judge run on Opus, so a review is a different model from the
work it judges whatever model the session itself runs on. Claude Code gives a model passed
when an agent is launched precedence over the frontmatter, and `CLAUDE_CODE_SUBAGENT_MODEL`
gives way to it; `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` overrides the frontmatter for every agent
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#choose-a-model)).
`mstack lint-plugin` refuses a value outside `inherit`, `sonnet`, `opus`, `haiku`, `fable` or a
`claude-*` id. A missing line is allowed: the agent then runs on `CLAUDE_CODE_SUBAGENT_MODEL`
when that is set and on the session's model otherwise, where `model: inherit` takes the
session's model ahead of that variable.

Report files live under `.mstack/progress/`. Every agent writes its result to disk and
returns one line naming the path, because a subagent's working context vanishes when it
returns and only the file survives; a `SubagentStop` hook checks the file exists (see
[Gates-and-Hooks](Gates-and-Hooks.md)).

## When each one runs

The orchestrator reads the item's status and dispatches (`agents/orchestrator.md`):

| Status | Launch |
|---|---|
| `pending` | `spec-author` (spec path) or `implementer` (direct path) |
| `specifying` | `spec-reviewer`, once the spec artifacts exist |
| `spec_ready` | `implementer` |
| `in_progress` | `reviewer`, once the implementer reports done |
| `reviewing` | back to `implementer` on CHANGES_REQUESTED |
| `verifying` | `mstack merge-gate <pr>` |

The statuses themselves, and what puts an item on the spec path rather than the direct path,
are in [How-A-Work-Item-Flows](How-A-Work-Item-Flows.md).

## Nobody approves their own work

Three of the five ship **without `Write` and without `Edit`**: `orchestrator`,
`spec-reviewer`, `reviewer`. The rule "the reviewer does not fix it themselves" is not a
request; the tool is not there. They keep `Bash`, because a reviewer has to run the
verification itself, so the reviewer's report file and its ledger row are typed as visible
shell commands rather than as edits that look like ordinary work. That makes the separation a
speed bump with an audit trail, not a sandbox, and that is the honest strength of the claim.

The other half is enforced by the gate. An item may only close on a ledger verdict from a
pass that did not write the code. A verdict is one of five typed values, `test-verified`
below among them; the enum lives on [The-CLI](The-CLI.md). Here is a scratch-repository run where the implementer
records its own honest verdict, the close is forced anyway, and the close itself refuses. The
item is [Getting-Started](Getting-Started.md#a-first-item-end-to-end)'s `greet-flag`, at
`reviewing` with the work committed: it has the `--verification` `python3 -m unittest test_greet -v`,
a filled `.mstack/progress/current.md`, and the implementer's report
(`.mstack/progress/impl_greet-flag.md`, [shown there](Getting-Started.md#do-the-work-and-verify-it))
committed with the work; the reviewer has written its own report, `.mstack/progress/review_greet-flag.md`.
Output is trimmed to the lines that matter:

```console
$ mstack ledger record greet-flag "$(git rev-parse HEAD)" test-verified \
    --evidence ".mstack/progress/impl_greet-flag.md" --verifier implementer
recorded test-verified for greet-flag at 2c3d65c0

$ mstack state set greet-flag --status done --force --closed-by "demo: skipping review on purpose"
mstack: greet-flag cannot close: its only verdicts are from the pass that wrote the code (only implementer)
        a closing verdict has to come from a pass that did not write the code; run the verification again from one and record the row under a name that is not the author's (your own name, or `ci`), or, if no check could be run, record `verifier-blocked` under such a name
```

The implementer's row is not worthless; it is evidence the code works, recorded at the rung
of [the evidence ladder](Skills-and-Playbooks.md#the-evidence-ladder) the implementer
honestly reached. It is just not sufficient to close, and `--force` does not change that. A
reviewer re-runs the verification at `reviewing` (`gate --full` executes it and keeps the receipt
the close reads; the gate is green) and records its own row at the same SHA; the item moves to
`verifying`, and the close goes through:

```console
$ mstack gate --full
...
[ok]    python3 -m unittest test_greet -v

PASSED - 0 failures, 1 warning

$ mstack ledger record greet-flag "$(git rev-parse HEAD)" test-verified \
    --evidence ".mstack/progress/review_greet-flag.md" --verifier reviewer
recorded test-verified for greet-flag at 2c3d65c0

$ mstack state set greet-flag --status verifying
1 greet-flag (verifying)
  status: "reviewing" -> "verifying"

$ mstack state set greet-flag --status done
1 greet-flag (done)
  status: "verifying" -> "done"

$ mstack gate
...
[ok]    1 closed item(s) carry a ledger verdict
...

PASSED - 0 failures, 1 warning
```

## orchestrator

Owns one item end to end. Its job is to decompose and coordinate, not to implement, and its
tool list (`Read`, `Glob`, `Grep`, `Bash`, `Agent`) enforces that: it can launch the other
agents and move state, and it cannot edit a file. It arrives by running `mstack gate`,
reading the active item and `progress/current.md`, and resuming recorded work rather than
restarting it. It moves items with `mstack state set`, and the CLI refusing illegal
transitions is how "no self-approval" survives a long session. When a launched agent returns,
the orchestrator checks for the report file rather than trusting the one-line summary. It
pauses for a human only at a real product fork: an item with `decision_required`, a direct
request with no issue behind it, or a fork a spec pass surfaced.

### The report cap, for every role

Every role that writes a report (spec-author, spec-reviewer, implementer, reviewer) is told in its
own agent file that a report stays under 24 KB (24576 bytes): paste the lines that matter, name the
file that holds the rest, check the size before returning. The gate fails an item whose report is
over it ([Gates and hooks](Gates-and-Hooks.md)), and that red does not stop the next role: a
gate red **only** on the budget of the item under review (a report over the cap, a review round
without its decision row) is a finding for the reviewer and for an implementer of a later round, and
a coordinating session launches the role that fixes it. When the author of an over-cap report is
gone, the coordinating session moves the pasted output, unchanged, to
`.mstack/progress/attachments/<report file name>` and leaves a pointer in the report; it edits no
finding and no verdict line ([A report over the cap](Gates-and-Hooks.md#a-report-over-the-cap)).

## spec-author

Writes the spec for one item into `.mstack/specs/<slug>/`: `proposal.md`, `design.md`,
`tasks.md`, `spec.md`, all four required before the item may leave `specifying`. Before
writing, it re-verifies every `file:line` the item's source references, because an issue
written weeks ago names code that has moved. Requirements get stable ids (`R1`, `R2`, ...)
and EARS statements (Easy Approach to Requirements Syntax, a small kit of fixed sentence
forms; the kit is `skills/spec/references/ears.md`), every requirement gets a WHEN/THEN
scenario, `design.md` records at
least one rejected alternative, and every task names the R-ids it covers. Each task is the smallest unit that carries its own test cycle and is worth a fresh reviewer's gate, and is written for an implementer who has only `tasks.md`: exact paths, the exact command that shows it done and what it prints, no placeholders. It hands off with
`.mstack/progress/spec_<slug>.md` and does not review its own spec; a different pass will
reject a spec whose author reviewed it.

## spec-reviewer

Reviews one spec, adversarially, before any code is written. No `Write`, no `Edit`, and it
must not be the pass that wrote the spec. It attacks first: hidden assumptions, whether the
rejected alternatives are real, and the fail paths a happy-path spec leaves out. Then
completeness: every acceptance bullet maps to a requirement, every requirement is testable
and covered by a task, every task is sized by that rule and could be executed from `tasks.md` alone (it names the oversized or undersized task and the placeholder or undefined name), failure and security paths are explicit. Its verdict opens
`.mstack/progress/spec_review_<slug>.md` as `APPROVED` or `CHANGES_REQUESTED`, with findings
cited to files and lines. Approval does not start implementation; the orchestrator does that,
after the human gate if one applies.

## implementer

Implements exactly one item, with the full tool list (`Read`, `Write`, `Edit`, `Glob`,
`Grep`, `Bash`). On the spec path it executes `tasks.md` in order; on the direct path the
item's `acceptance` array is the contract and it must not widen it. Every behaviour change
gets a test that fails without the change, and it never weakens an existing test to obtain
green. Its frontmatter carries `skills: [test-first]`, so the internal test-first reference is
in its context from the first turn: one test per behaviour, watched red for the expected
reason, then the least code, then a mutant check before it reports. The seams in its brief
are pre-agreed, and it asks no one to confirm them. It keeps `progress/current.md` updated while it works, writes its report to
`.mstack/progress/impl_<slug>.md` with a requirement-to-test table (the one header `| R | Test | Where |` that the gate reads, see [Gates and hooks](Gates-and-Hooks.md)), and records its own ledger
row with `--verifier implementer` at the rung it honestly reached; `type-check-only` is the
right answer when that is all it ran. It does not mark the item done. A reviewer that did not
write the code decides that. In a later round its brief names the review report, and it checks
each finding against the code before applying it: a finding that does not hold is not applied
but recorded as a `mstack decide` row with its evidence and listed in the report under
"Findings not applied", and it asks no one. A later round writes its own file,
`impl_<slug>_r<N>.md`, and does not rewrite the earlier one: what changed since the last round,
then the whole `| R | Test | Where |` table again (the gate reads the newest round's file alone). The wording derives from obra/superpowers
`receiving-code-review`, with an origin header.

## reviewer

Judges one implementation and does not edit it. It runs the verification itself, because the
implementer's pasted output would carry the first pass's assumptions. It checks traceability
(would each test fail if the change were reverted), answers every acceptance bullet
individually with evidence, reads the diff, compares the tests against the previous revision
for weakening, and runs `mstack ledger check <slug>` at the current head SHA, because a
rebase silently invalidates every verdict without touching a single check. In a later round it
also reads the implementer's "Findings not applied" and the decision rows since the previous
review, and judges each rebuttal on the evidence it cites.

Its report name carries a small grammar, and the grammar is load-bearing. A panel is several
reviewers run in parallel over the same diff, each with a lens, one assigned focus such as
correctness or security. Reviewing alone the reviewer writes `review_<slug>.md`; as one lens
of a panel, `review_<slug>_<lens>.md`; a later round
alone, `review_<slug>_r<N>.md`; a lensed later round, `review_<slug>_r<N>-<lens>.md`. Panels
run in parallel, so one shared filename would mean every reviewer but the last overwrites the
others, and losing a review silently is the failure the report exists to prevent.

In what follows `review_<slug>`, a leading `r<digits>` is a round marker only when nothing
follows it or a dash does: `_r2` and `_r2-facts` are round 2, `_r2x` is a lens named `r2x` in
round 1. `mstack fanout plan` refuses any worker name starting `r<digit>` anyway, so the
planner never produces the second reading. A lone reviewer takes its path from the tool, never from
its own arithmetic: `mstack fanout plan --kind review --solo` allocates one more than the highest
round of any review report of the item, lone or lensed (a round-1 panel makes the next lone
review round 2), and from round 3 on wants a reason (`--justify`), which it records as the
item's `review-r<N>` decision row. See
[The CLI](The-CLI.md#fanout-plan--check).

One lens reads a file: `design`, which the coordinator gives when the diff adds or changes a
module's interface or moves a seam. That reviewer reads
`skills/design/references/deep-modules.md` (the deletion test, the interface as the test
surface, one adapter against two) and judges the diff with it; a reviewer without the lens
never loads the file.

## Who records which ledger row

The ledger is the typed record of who verified what (columns in
[State-Files](State-Files.md)). Who types the row is part of the separation:

| Pass | The row it records |
|---|---|
| implementer | Its own row, `--verifier implementer`, at the rung it honestly reached |
| reviewer, alone | Its own row, `--verifier reviewer`, typed through Bash once the report exists. APPROVED records the rung its run reached; CHANGES_REQUESTED records `verifier-failed` even when the suite was green, because the check that ran is the review and the item failed it; a verification it could not run at all records `verifier-blocked` |
| reviewer, as one lens of a panel | Nothing. `ledger check` reads the latest closing-role row per item and commit, so several lens rows would collapse to whichever lens recorded last, and a split panel means its worst lens, not the last one. The pass that synthesizes the panel's verdict records the one row, under its own name |
| spec-author, spec-reviewer | No ledger rows. Their artifacts are the spec and `spec_review_<slug>.md` |

The `--verifier` name is free text, and the rule for it is open on purpose: any name closes an
item except the names for the pass that wrote the work (`implementer`, `spec-author`, their
common spellings, `self`, `me`, or nothing at all), so a panel's synthesising session, an
orchestrator, a person or a CI job each close under their own name. `state set --status done`
refuses an item whose only verdicts are from the pass that wrote the work, or whose closing verdict
cites that pass's own report, as the gate does; an item with no row at all still closes, and the next
gate fails it.

Nobody types a row on another pass's behalf. A row ghost-written by the coordinating pass is
prose separation with no typed artifact behind it, which is the exact failure the verifier
column exists to catch.
