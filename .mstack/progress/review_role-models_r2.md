# Review - role-models (round 2)

**Verdict:** APPROVED

Reviewed at `c4b53a2c18bd7d5edae7c5275cb36af04ecbfa65`. Scope: `git diff c2f057f..c4b53a2 -- docs src tests`
(`docs/wiki/The-Agents.md` +4/-2, `src/lint.ts` +3/-2, `tests/lint.test.ts` +1/-1; the rest of
the range is `.mstack/` bookkeeping). The agent files are unchanged since round 1
(`rg -n "^model:" agents/`: implementer and spec-author `sonnet`, reviewer and spec-reviewer
`opus`, orchestrator `inherit`).

## Round 1's blocking finding

Closed. The wiki sentence, the lint comment and the test title no longer say a missing line
means `inherit`, and the anchor now points at a section that exists. Each is checked against
the page below.

## The docs passage

Fetched 2026-11-18 as `https://code.claude.com/docs/en/sub-agents.md` (HTTP 200, 116388
bytes), section "### Choose a model" (line 347 of the markdown):

> By default, a subagent you define runs on the same model as the conversation that starts it.
> To choose its model yourself, set the `model` field in its definition to one of these values:
> [...] **`inherit`**: the main conversation's model, or the spawning subagent's model for a
> nested subagent
>
> When more than one source sets a model, Claude Code uses the first in this order:
>
> 1. The per-invocation `model` parameter, which Claude can pass when it starts the subagent.
>    On an Agent tool call, the parameter takes a model alias, not a full model ID or `inherit`.
> 2. The `model` field in the subagent's definition, including `inherit`
> 3. The `CLAUDE_CODE_SUBAGENT_MODEL` environment variable
> 4. The main conversation's model, or the spawning subagent's model for a nested subagent

Frontmatter table, `model` row: "When you omit it, Claude Code picks the model in the
subagent model order".

"#### Run every subagent on one model": "While `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is on, Claude
Code ignores the `model` field in subagent definitions, and Claude can't pass a model when it
starts a subagent. The following subagents still run on their parent conversation's model: A
fork; A skill that runs in a subagent with `model: inherit`". And: "If you set only
`CLAUDE_CODE_SUBAGENT_MODEL_FORCE`, subagents run on the main conversation's model".

Anchor: the HTML page (`curl -sSL https://code.claude.com/docs/en/sub-agents`) carries
`id="choose-a-model"` (line 626) and no `id="precedence"`.

## Each changed claim against the page

- `docs/wiki/The-Agents.md:28-29` "a model passed when an agent is launched [has] precedence
  over the frontmatter": order item 1 before item 2. True.
- `:29-30` "`CLAUDE_CODE_SUBAGENT_MODEL` gives way to it": item 3 after item 2. True.
- `:30` "`CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` overrides the frontmatter for every agent": the
  FORCE passage ignores the `model` field in subagent definitions; its two exceptions (a fork,
  a skill run in a subagent) are not agent definitions. With FORCE alone, agents run on the
  main conversation's model, which still overrides the frontmatter. True.
- `:31` link `#choose-a-model`: exists (above).
- `:33-35` "A missing line is allowed: the agent then runs on `CLAUDE_CODE_SUBAGENT_MODEL` when
  that is set and on the session's model otherwise, where `model: inherit` takes the session's
  model ahead of that variable": a missing field skips item 2 and lands on item 3, then item 4;
  `inherit` is item 2 ("including `inherit`") and resolves to the main conversation's model.
  True. See N-r2-1 for what it leaves out.
- `src/lint.ts:243-244` "An absent `model` is allowed: Claude Code then runs the agent on
  CLAUDE_CODE_SUBAGENT_MODEL when that is set, and on the conversation's model otherwise.":
  same reading. True.
- `tests/lint.test.ts:437` title "Claude Code takes its model from the environment or the
  conversation": items 3 and 4. True.

Rung: 2 (pointed at the documented line). I did not run a live session with
`CLAUDE_CODE_SUBAGENT_MODEL` set; the brief excludes a live session.

## The lint hint

`src/lint.ts:250`: "use one of these values; the check catches a typo before a session runs".
True of what the check does: it is a static read of the frontmatter, run by
`./bin/mstack lint-plugin` and in CI (`.github/workflows/ci.yml:30`), with no session. "These
values" has a referent: it prints right after the failure line that lists them. Real output
from a `git archive HEAD` copy in the scratchpad with `model: sonnet` changed to `model: sonet`
in `agents/implementer.md` (copy deleted afterwards):

```
27:[fail]  agents/implementer.md: model 'sonet' is not inherit, sonnet, opus, haiku, fable or a claude-* id
28-        fix: use one of these values; the check catches a typo before a session runs
56:FAILED - 1 failure, 0 warnings
```

No test asserted the old string. `rg -n "bill" tests src` hits only `tests/glossary.test.ts`
fixtures ("A bill.", "A bill sent after delivery."), which are glossary-entry text and have
nothing to do with the hint. `rg -n "documented values|discovered by a bill|means .inherit"`
over the repository finds nothing outside round 1's review report. This closes round 1's N4.

## CHANGELOG

`CHANGELOG.md:5-19` (the item 39 entry) says "A model named when an agent is launched, or
`CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`, still overrides the frontmatter" and "an agent with no
`model` line passes". It makes no claim about what a missing line resolves to, and nothing in
it contradicts the corrected wiki sentence.

## Verification I ran

```
$ ./bin/mstack version
mstack 0.2.1 at /Users/romerma/Code/mstack

$ ./bin/mstack gate
[ok]    one active item: role-models (reviewing)
[ok]    role-models is reviewing; a verification run is due at verifying
[ok]    working tree is clean
PASSED - 0 failures, 0 warnings
exit=0

$ ./bin/mstack lint-plugin .
[ok]    agents/orchestrator.md
[ok]    agents/reviewer.md
[ok]    agents/spec-reviewer.md
[ok]    agents/spec-author.md
[ok]    agents/implementer.md
...
PASSED - 0 failures, 0 warnings
lint-exit=0

$ npm run typecheck
> mstack@0.2.1 typecheck
> bunx --bun tsc --noEmit
tc-exit=0

$ bun test ./tests/lint.test.ts
 30 pass
 0 fail
Ran 30 tests across 1 file. [1144.00ms]
bun-exit=0

$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test tests/lint.test.ts
✔ an agent model outside the allowed set is caught, naming the file and the value (104.00025ms)
✔ an agent with no model field is not held to the model rule: Claude Code takes its model from the environment or the conversation (32.48425ms)
ℹ tests 30
ℹ pass 30
ℹ fail 0
node-exit=0

$ ./bin/mstack ledger check role-models   (before recording)
FAIL no verdict at c4b53a2c; 3 row(s) exist at other SHAs and a new head SHA voids them
```

The gate excerpt is trimmed to the relevant lines; every line it printed was `[ok]`.

## Acceptance, quoted

Round 1 judged all four met; round 2 touches none of the files they rest on except the wiki
paragraph under criterion 3, whose Model column (`docs/wiki/The-Agents.md:18-24`) is
unchanged.

**"agents/implementer.md and agents/spec-author.md declare model: sonnet; agents/reviewer.md and agents/spec-reviewer.md declare model: opus; agents/orchestrator.md stays inherit"** - unchanged, `rg -n "^model:" agents/` above.

**"lint-plugin rejects a model value outside inherit, sonnet, opus, haiku, fable or a claude-* id, with a test"** - `src/lint.ts:245-253`, tests `tests/lint.test.ts:405-445` pass on bun and node; the scratch-copy probe shows the failure.

**"The router, review and design skills say what is now true about cross-model second opinions, and docs/wiki/The-Agents.md shows each agent's model"** - the wiki paragraph is now accurate (above); the skills are not in this diff.

**"A live subagent transcript shows message.model sonnet for the implementer and opus for the reviewer, pasted in the impl report"** - not touched by this round; round 1's judgement stands.

## Non-blocking

- N-r2-1. `docs/wiki/The-Agents.md:33-34`, `src/lint.ts:243-244` and `tests/lint.test.ts:437`
  leave out two parts of the order for a missing line. A model passed at launch (item 1) still
  wins over `CLAUDE_CODE_SUBAGENT_MODEL`. For a nested subagent, "the session's model" is the
  spawning subagent's model (item 4, and `inherit`'s definition). The wiki sentence two lines
  above already says a launch-time model beats the frontmatter, so a reader gets the first
  part from context. mstack's agents that a subagent might launch all declare a model, so the
  nested case does not change any mstack outcome. This is incomplete, not false, in the same
  way as round 1's N6.
- Round 1's N1 to N3 and N5 to N9 are not made worse. N8 (`docs/research/pstack-port.md:385`,
  "`model` defaults to `inherit`") is still there and is still not in this diff. N4 is closed
  by the new hint.

## What I did not check

- The full suite and a live session, as the brief excludes; round 1 ran both and recorded its verdict at `c2f057f`.
- What Claude Code actually does at runtime with `CLAUDE_CODE_SUBAGENT_MODEL` set and an agent
  with no `model` line: documented only (rung 2), not run.
- The router, review and design skill text (criterion 3), which this round does not touch.
