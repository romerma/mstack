# Review - role-models

**Verdict:** CHANGES_REQUESTED

Item 39 at `c2f057f0c6cec3bfddb87e0705066eea685e9509` (base `d3ae7d9`). All four acceptance
criteria are met and every check is green. The verdict comes from one false statement about
model precedence. The brief's proportion rule makes a false statement in a committed file
blocking, and the brief said precedence claims must match the docs page. The fix is one
sentence in the wiki, plus the same claim in one code comment and one test title.

## Changes required

1. `docs/wiki/The-Agents.md:33`: "a missing line is allowed and means `inherit`" is false
   in a case the docs describe. The sub-agents page
   (https://code.claude.com/docs/en/sub-agents.md, fetched 2026-11-18, read in full: 116382
   characters) says:
   - frontmatter table: "When you omit it, Claude Code picks the model in the
     [subagent model order](#choose-a-model)"
   - "When more than one source sets a model, Claude Code uses the first in this order: 1.
     The per-invocation `model` parameter ... 2. The `model` field in the subagent's
     definition, including `inherit` 3. The `CLAUDE_CODE_SUBAGENT_MODEL` environment variable
     4. The main conversation's model"

   `model: inherit` is step 2, which beats `CLAUDE_CODE_SUBAGENT_MODEL`. A missing field skips
   step 2 and lands on step 3. With `CLAUDE_CODE_SUBAGENT_MODEL=haiku` set, an agent with no
   `model` line runs Haiku, while one with `model: inherit` runs the session's model. The same
   claim appears in `src/lint.ts:243` ("Claude Code then runs the agent on the conversation's
   model") and in the test title at `tests/lint.test.ts:437` ("because Claude Code then
   inherits").

   Fix: say a missing line follows Claude Code's model order
   (`CLAUDE_CODE_SUBAGENT_MODEL`, else the session's model), and change the comment and the
   title to match. In the same edit, fix the anchor at `docs/wiki/The-Agents.md:31`:
   `#precedence` does not exist on the page. The section is `#choose-a-model`
   (`rg -o 'id="(precedence|choose-a-model)"' sub-agents.html` finds only `choose-a-model`).
   Rung: documented. I quote the page; I did not run it live.

## Non-blocking (file these)

- N1. **No test exercises the item's CLI seam, and none ever exercised `lint-plugin`'s exit
  code.** `rg -n "lint-plugin" tests/` finds only a comment at `tests/gate.test.ts:1626`.
  `cmdLint` (`src/cli.ts:1141-1143`) is `lintPlugin(dir).failed ? 1 : 0`. CI
  (`.github/workflows/ci.yml:30`) only proves exit 0 on a clean plugin. The new tests call
  `lintPlugin` directly, a deviation the report declares. This does not block: criterion 2
  asks for "a test", and my CLI probe below shows exit 1 with the message. One spawned-CLI
  test that expects a non-zero exit on any lint failure would cover every lint check.
- N2. `src/lint.ts:246` `startsWith("claude-")` accepts `claude-` on its own and
  `claude-anything`, so a typo such as `claude-sonet-5` passes. This matches the
  criterion's `claude-*` glob, so it is a note, not a defect.
- N3. `model: opus # pinned` is refused (`'opus # pinned'`), although YAML reads it as
  `opus`. This is a false positive from the frontmatter reader, which never strips trailing
  comments (`src/frontmatter.ts`, `scalar`). The behaviour predates this item, and the
  message shows the value, so the cause is easy to see.
- N4. The lint hint at `src/lint.ts:249`, "this check exists so a typo is not discovered by
  a bill", is unverified, and the docs point the other way. errors.md, "Unrecognized model
  ID on a request": "Claude Code still sends the request with the ID as you configured it".
  "There's an issue with the selected model" is then the error: "The configured model name
  was not recognized". So a typo probably surfaces as an error, not a bill. I tried a
  live typo probe, but a Claude Code safety check refused my command (a parse check, not a
  user denial), so I did not run it. Suggest a reason that holds, such as "a typo fails
  only when the agent is launched".
- N5. The docs disagree with the criterion's list, which I report and did not change. The
  page defines a full model ID as "a value the [`--model`] flag accepts, such as
  `claude-opus-5-5` or `claude-sonnet-5`". `--model` also takes provider IDs (errors.md
  names "Amazon Bedrock `us.anthropic.claude-...` IDs", inference profile ARNs and
  "Microsoft Foundry deployment names"). model-config.md also lists `best`, `sonnet[1m]`,
  `opus[1m]` and `opusplan`. The lint refuses all of these. The frontmatter's alias list
  itself ("`sonnet`, `opus`, `haiku`, or `fable`") matches the criterion exactly. The lint
  only checks this plugin's own agents, and none uses these values.
- N6. The CHANGELOG and wiki name two overrides: the per-launch model and
  `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`. Both match the page ("While
  `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is on, Claude Code ignores the `model` field in
  subagent definitions"). The page names others, which go unmentioned:
  - "If an installed mod sets a model in its `agent.spawn` hook, Claude Code uses that model
    in place of the per-invocation parameter".
  - An `availableModels` allowlist that blocks the model can substitute another.
  - Fallback model chains.
  - "Same family": "if your main conversation runs on `claude-opus-4-7`, a subagent with
    `model: opus` runs on that version too".

  "Still overrides" does not claim the list is complete, and the CHANGELOG's "whatever
  model your session runs on" holds at family level. So nothing here is false, only
  incomplete.
- N7. `skills/review/SKILL.md:26`: "the panel differs from the code's author by default" is
  true when `mstack:implementer` wrote the code. `/mstack:review` also reviews "a branch, a
  PR, or a diff" written by anyone, including an Opus session. Suggest "from code the
  `implementer` wrote".
- N8. The existing file `docs/research/pstack-port.md:385` says "`model` defaults to
  `inherit`". It has the same inaccuracy as the blocking finding, and the diff does not
  touch it.
- N9. Seen in my Sonnet-session run, not a defect of this diff: the orchestrator wrote
  `current.md` to a mangled path outside its project,
  `/private/tmp/claude-501/-Users-romerma-Code-mstack-4aadee9d-d352-4d5b-825b-4d11a47e2193-scratchpad-review39-live-proj/.mstack/progress/current.md`.
  It then tried to `rm -r` the file, auto mode denied it, and it said so. The file is still
  there.

## Acceptance, quoted

**"agents/implementer.md and agents/spec-author.md declare model: sonnet;
agents/reviewer.md and agents/spec-reviewer.md declare model: opus; agents/orchestrator.md
stays inherit"**: met.
```
$ rg -n "^model:" agents/*.md
agents/spec-reviewer.md:5:model: opus
agents/spec-author.md:5:model: sonnet
agents/reviewer.md:5:model: opus
agents/orchestrator.md:5:model: inherit
agents/implementer.md:7:model: sonnet
```
At the base, all five were `model: inherit` (`git show d3ae7d9:agents/<a>.md`).

**"lint-plugin rejects a model value outside inherit, sonnet, opus, haiku, fable or a
claude-* id, with a test"**: met. The check is at `src/lint.ts:243-252`, and the tests are
at `tests/lint.test.ts:405-445`. See the CLI probe and the mutant below. N1 covers the
untested CLI seam.

**"The router, review and design skills say what is now true about cross-model second
opinions, and docs/wiki/The-Agents.md shows each agent's model"**: met.
- `skills/router/SKILL.md:88-91` is true for delegated work.
- `skills/review/SKILL.md:25-27` is true when the implementer wrote the code (see N7). The
  panel's lenses are `mstack:reviewer` (step 5 and the lens contract in `agents/reviewer.md`).
- `skills/design/SKILL.md:32-34` ("No agent here pins a model for either role") is true:
  the skill names no agent for the generators or the judge, and the playbooks invoke
  `/mstack:design` from the session (`skills/router/playbooks/feature.md:5`).
- Growth: router 163 to 165 lines, review 63 to 65, design 57 to 58. Each is within three.
- The wiki has a Model column (`docs/wiki/The-Agents.md:18-24`). The false sentence is the
  blocking finding above.

**"A live subagent transcript shows message.model sonnet for the implementer and opus for
the reviewer, pasted in the impl report"**: met. The table is pasted in
`.mstack/progress/impl_role-models.md:33-38`. I re-derived it from the implementer's stream
and got the same result (below). Because that session ran on Opus, only its implementer row
tells us anything. My own run with the session on Sonnet supplies the reviewer half.

## Verification I ran

### Gate, lint, typecheck, suites
```
$ ./bin/mstack version          -> mstack 0.2.1 at /Users/romerma/Code/mstack
$ ./bin/mstack gate             -> PASSED - 0 failures, 0 warnings   (exit 0)
$ ./bin/mstack lint-plugin .    -> PASSED - 0 failures, 0 warnings   (exit 0)
$ npm run typecheck             -> bunx --bun tsc --noEmit           (exit 0)
$ npm run test:bun              -> 634 pass / 0 fail, "Ran 634 tests across 28 files. [114.99s]" (exit 0)
$ npm run test:node             -> ℹ tests 634 / ℹ pass 634 / ℹ fail 0 (exit 0)
$ ./bin/mstack ledger check role-models
FAIL no verdict at c2f057f0; 2 row(s) exist at other SHAs and a new head SHA voids them
```
The `[fail]` lines in the bun output come from fixtures that tests print on purpose. Both
runtimes exit 0. The store's `verify` is `npm test && npm run typecheck && bin/mstack
lint-plugin .`, and the item has no `verification` field. I ran the pieces separately and
did not run `gate --full`.

### Probe B: lint through the CLI seam
This ran on a scratch copy of the plugin (`skills agents hooks .claude-plugin src licenses`,
the same set `tests/lint.test.ts` copies). Each case replaces the `model:` line of
`agents/implementer.md` and runs `/Users/romerma/Code/mstack/bin/mstack lint-plugin <copy>`:
```
[model: sonet]                     exit=1 | [fail]  agents/implementer.md: model 'sonet' is not inherit, sonnet, opus, haiku, fable or a claude-* id FAILED - 1 failure, 0 warnings
[model:]                           exit=1 | [fail]  agents/implementer.md: model '' is not inherit, sonnet, opus, haiku, fable or a claude-* id FAILED - 1 failure, 0 warnings
[model: gpt-4o]                    exit=1 | [fail]  agents/implementer.md: model 'gpt-4o' is not ... FAILED - 1 failure, 0 warnings
[model: gemini-2.5-pro]            exit=1 | [fail]  agents/implementer.md: model 'gemini-2.5-pro' is not ... FAILED - 1 failure, 0 warnings
[model: Opus]                      exit=1 | [fail]  agents/implementer.md: model 'Opus' is not ... FAILED - 1 failure, 0 warnings
[model: SONNET]                    exit=1 | [fail]  agents/implementer.md: model 'SONNET' is not ... FAILED - 1 failure, 0 warnings
[model: "opus"]                    exit=0 | PASSED - 0 failures, 0 warnings
[model: 'sonnet']                  exit=0 | PASSED - 0 failures, 0 warnings
[model: opus   ]                   exit=0 | PASSED - 0 failures, 0 warnings
[model: opus # pinned]             exit=1 | [fail]  agents/implementer.md: model 'opus # pinned' is not ... FAILED - 1 failure, 0 warnings
[model: claude-]                   exit=0 | PASSED - 0 failures, 0 warnings
[model: claude-anything]           exit=0 | PASSED - 0 failures, 0 warnings
[model: inherit]                   exit=0 | PASSED - 0 failures, 0 warnings
[model: sonnet]                    exit=0 | PASSED - 0 failures, 0 warnings
[model: opus]                      exit=0 | PASSED - 0 failures, 0 warnings
[model: haiku]                     exit=0 | PASSED - 0 failures, 0 warnings
[model: fable]                     exit=0 | PASSED - 0 failures, 0 warnings
[model: claude-opus-5-5]           exit=0 | PASSED - 0 failures, 0 warnings
[model: claude-sonnet-5-5[1m]]     exit=0 | PASSED - 0 failures, 0 warnings
[model: true]                      exit=1 | [fail]  agents/implementer.md: model 'true' is not ... FAILED - 1 failure, 0 warnings
[model: [opus]]                    exit=1 | [fail]  agents/implementer.md: model '[opus]' is not ... FAILED - 1 failure, 0 warnings
[line deleted]                     exit=0 | PASSED - 0 failures, 0 warnings
```
The output shortens some messages with `...`; the first two show the full text. The full
output for the typo case:
```
-- agents
[fail]  agents/implementer.md: model 'sonet' is not inherit, sonnet, opus, haiku, fable or a claude-* id
        fix: use one of the documented values; this check exists so a typo is not discovered by a bill
FAILED - 1 failure, 0 warnings
exit=1
```
The message names the file and the value.

### Tests: red first, and a mutant
- The test commit `8cb512d` (archived into scratch), `node --test tests/lint.test.ts`:
  `ℹ tests 30 / ℹ pass 29 / ℹ fail 1`,
  `AssertionError [ERR_ASSERTION]: model: sonet: expected a failure, got a pass`.
- Mutant on an archive of `c2f057f`: `if (false && "model" in data)` at `src/lint.ts:244`.
  Result: `ℹ tests 30 / ℹ pass 29 / ℹ fail 1`, same assertion. Killed.
- Not covered by any test: `claude-` alone (N2), a quoted value, trailing whitespace. The
  "no model field" test (`tests/lint.test.ts:437`) is a guard, and passes with or without
  the change.

### Probe C: the docs
I fetched `https://code.claude.com/docs/en/sub-agents.md` (116388 bytes; Python counts 116382
characters), read it in full, and fetched `model-config.md` and `errors.md` too. Character
100000 falls on line 1188. The unread tail has no precedence text, only `autoCompactWindow`,
the fork table ("Model | Same as the parent conversation | Follows the subagent model order")
and examples. Each claim checked:
- CHANGELOG, "A model named when an agent is launched ... still overrides the frontmatter".
  Matches step 1: "The per-invocation `model` parameter, which Claude can pass when it starts
  the subagent".
- CHANGELOG and wiki, `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` overrides the frontmatter.
  Matches: "While `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is on, Claude Code ignores the `model`
  field in subagent definitions, and Claude can't pass a model when it starts a subagent."
- Wiki, "`CLAUDE_CODE_SUBAGENT_MODEL` gives way to it". Matches the order (step 3, below
  steps 1 and 2).
- Wiki, "a missing line ... means `inherit`". False, as described under Changes required.
- Lint hint "a typo is not discovered by a bill". Unsupported; see N4.
- Allowed list. The frontmatter values are "`sonnet`, `opus`, `haiku`, `fable`, a full model
  ID such as `claude-opus-5-5`, or `inherit`", which matches the criterion except for the
  provider IDs in N5.

### Probe D: live evidence
**Implementer's stream, re-derived**
(`.../scratchpad/impl39/stream.jsonl`):
```
-- init
model=claude-opus-5-5 perm=auto plugins=mstack,cc-plugin-agents-md,cc-plugin-telemetry,cc-plugin-privacy,cc-plugin-plugin-authoring
-- Agent calls (main thread)          id  subagent_type  model-arg  input keys
toolu_01QMfSY9vQs4D2KsMdoB6u1V	mstack:implementer	NO_MODEL_ARG	description,prompt,run_in_background,subagent_type
toolu_014GUWC5UBNriEThxCVW2WWm	mstack:reviewer	NO_MODEL_ARG	description,prompt,run_in_background,subagent_type
-- distinct models per parent_tool_use_id
  36 main	claude-opus-5-5
   5 toolu_014GUWC5UBNriEThxCVW2WWm	claude-opus-5-5
  11 toolu_01QMfSY9vQs4D2KsMdoB6u1V	claude-sonnet-5-5
-- result
success turns=19 secs=256.93 cost=0.962761
-- tool_use inputs carrying a model key: none
```
This matches the implementer's table.

**My run, with the session on Sonnet.** The project was a fresh copy of
`sandbox/bench/template` at
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review39/live/proj`.
I ran `git init`, committed the template, ran this checkout's `setup`, set `state.verify` to
`python3 -m unittest discover -s tests`, and committed. The wrapper is
`.../review39/live/run.sh`. It rebuilds the environment from the variable names only (the
env inside is exactly `HOME USER LOGNAME TERM LANG TMPDIR SHELL PATH`, with no ANTHROPIC_* and
no CLAUDE_CODE_SUBAGENT_MODEL). PATH is `/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin` plus
the bun and claude bin dirs, under `perl -e 'alarm 840'`:
`claude -p "/mstack add a --guest filter to the list command, the way --room works, so I can
see one guest's bookings. go ahead and finish it without asking me anything." --model sonnet
--output-format stream-json --verbose --setting-sources project --strict-mcp-config
--max-budget-usd 6 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto`. The stream
went to `.../review39/live/stream.jsonl`, and stderr was empty (0 bytes). claude 2.1.327.
```
-- init (x5, one per wake-up)
model=claude-sonnet-5-5 perm=auto cc=2.1.327 plugins=mstack,cc-plugin-agents-md,cc-plugin-telemetry,cc-plugin-privacy,cc-plugin-plugin-authoring
-- Agent calls (main thread)
toolu_01Nf3jfrw8Lu8RW9DgtfM48F	mstack:implementer	NO_MODEL_ARG	description,prompt,subagent_type
toolu_01Ut51Ezq7mi7XxHDM3W7zys	mstack:reviewer	NO_MODEL_ARG	description,prompt,subagent_type
toolu_0194phm6HUR4PR9LjuoorueA	mstack:implementer	NO_MODEL_ARG	description,prompt,subagent_type
toolu_01UcxAbofGdPY815fuy9AiBn	mstack:reviewer	NO_MODEL_ARG	description,prompt,subagent_type
-- distinct models per parent_tool_use_id
  74 main	claude-sonnet-5-5
   5 toolu_0194phm6HUR4PR9LjuoorueA	claude-sonnet-5-5
  15 toolu_01Nf3jfrw8Lu8RW9DgtfM48F	claude-sonnet-5-5
  21 toolu_01UcxAbofGdPY815fuy9AiBn	claude-opus-5-5
  12 toolu_01Ut51Ezq7mi7XxHDM3W7zys	claude-opus-5-5
-- tool_use inputs carrying a model key: none
-- modelUsage: claude-sonnet-5-5 $0.5883, claude-opus-5-5 $0.4889
-- result events (5): success x5; turns 13+8+2+4+10 = 37; total_cost_usd 1.0772254; wall 354 s (start/end stamps)
```
The subagent transcript files agree
(`~/.claude/projects/<that project>/dfcad5c7-867f-4854-b1b6-c136ca49204e/subagents/`):
```
agent-af65059597430fb7d.jsonl	  15 claude-sonnet-5-5 	{"agentType":"mstack:implementer","description":"Implement list --guest filter"}
agent-abd557d123f4fcbc2.jsonl	  12 claude-opus-5-5 	{"agentType":"mstack:reviewer","description":"Review list --guest filter"}
agent-a44e4b204dc0884d2.jsonl	   5 claude-sonnet-5-5 	{"agentType":"mstack:implementer","description":"Add exact-match guest tests"}
agent-a60ba01b804317661.jsonl	  21 claude-opus-5-5 	{"agentType":"mstack:reviewer","description":"Re-review list --guest filter"}
```
On a Sonnet session, both reviewer passes ran `claude-opus-5-5` with no `model` argument on
the Agent call. Only the frontmatter can have chosen it, so the reviewer half of criterion 4
is shown, n=1. The run finished on its own. The first review asked for changes (the tests
did not pin exact matching), an implementer added tests, and the second review approved.
The item ended `done` at `826b0de`. Two calls were denied (both main thread, Bash, including
the `rm -r` in N9), and nothing retried them.

### Probe E and F
- Skills: see criterion 3 above.
- `rg -n -i "inherit" docs README.md CONTRIBUTING.md skills agents` finds model-related hits
  only at `agents/orchestrator.md:5`, `docs/wiki/The-Agents.md:20,32,33` and
  `docs/research/pstack-port.md:385` (N8). Every other hit is about stdio or prose.
  `rg -i "different model|same model|second opinion"` turns up nothing new that is now
  untrue.
- CHANGELOG (`CHANGELOG.md:5-19`) tells a user on another session model what changes: "an
  Opus session spends less on implementation, a Sonnet or Haiku session spends more on
  review". That follows from the pin and per-token prices. It is not measured, and
  items 49 and 45 are meant to measure it.

## What I did not check
- What Claude Code does with an invalid frontmatter `model` (N4). A safety check refused my
  probe command, so I did not retry it.
- The missing-field versus `inherit` difference live (blocking finding). It rests on the
  docs page, not on a run.
- spec-author and spec-reviewer at runtime. Neither was dispatched in either run; their
  models are shown in frontmatter only.
- `gate --full` (I ran its parts separately), and any cost A/B against `inherit`.
