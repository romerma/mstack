# Item 39 role-models: implementation report

## What changed
The implementer and spec-author pin `model: sonnet`; the reviewer and spec-reviewer pin `model: opus`; the orchestrator stays `inherit`. `lint-plugin` now fails an agent whose `model` is outside `inherit|sonnet|opus|haiku|fable|claude-*`, naming file and value. The router, review and design skills say what the pin gives and does not. `docs/wiki/The-Agents.md` has a Model column and a note; CHANGELOG has an entry. The tests sit at `lintPlugin` (the seam the neighbouring tests use), not at a spawned CLI.

## Commits
test(lint) red test; feat(lint) check; feat(agents) frontmatter; docs (skills, wiki, changelog); this report.

## Red, then green
Red (before the check; `node --test tests/lint.test.ts`): `AssertionError [ERR_ASSERTION]: model: sonet: expected a failure, got a pass`. Green after: `ℹ tests 30 / pass 30 / fail 0` for the file.

## Mutants (each applied to src/lint.ts, lint tests run, reverted)
| Mutant | Result |
|---|---|
| check disabled (`if (false)`) | killed (1 fail) |
| `claude-` prefix rule dropped | killed |
| empty value accepted | killed |
| missing `model` made a failure | killed |
| `fable` dropped from aliases | killed |

## Missing `model` field
Allowed, test "an agent with no model field is not held to the model rule". Source: https://code.claude.com/docs/en/sub-agents (fetched today): "When you omit it, Claude Code picks the model in the subagent model order"; "By default, a subagent you define runs on the same model as the conversation that starts it". Precedence there: per-invocation `model` parameter, then frontmatter `model`, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the parent's model; `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` ignores frontmatter. The docs I read say nothing about what an invalid value does, so the lint message does not claim a fallback. I read the first 100000 of 116382 characters of that page; the unread tail was not checked.

## Skills text (each at most +3 lines)
router/SKILL.md, review/SKILL.md, design/SKILL.md. design/SKILL.md names no agent for generators or judge, so the sentence says only that the judge differs "if you launch the judge on another" model.

## Live run (criterion 4), n=1
Project: copy of `sandbox/bench/template`, git init, this checkout's `setup`, `state.verify` = `python3 -m unittest discover -s tests`. Prompt: `/mstack add a --guest filter to the list command, the way --room works, so I can see one guest's bookings. go ahead and finish it without asking me anything.` Clean `env -i`, no ANTHROPIC_*, `--model opus --setting-sources project --strict-mcp-config --max-budget-usd 6 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto`, perl alarm 840. Stream: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl39/stream.jsonl`, empty stderr.

Result: success, 19 turns, 256.9 s, $0.9628. Session init model `claude-opus-5-5`.

Evidence is the stream's `parent_tool_use_id` field (not the subagent transcript files):
```
jq -r 'select(.type=="assistant")|[(.parent_tool_use_id//"main"),.message.model]|@tsv' stream.jsonl | sort | uniq -c
  36 main                         claude-opus-5-5
  11 toolu_01QMfSY9...(implementer) claude-sonnet-5-5
   5 toolu_014GUWC5...(reviewer)    claude-opus-5-5
```
Agent types from the main thread's Agent tool_use blocks: `toolu_01QMfSY9...` is `mstack:implementer`, `toolu_014GUWC5...` is `mstack:reviewer`; neither call passed a `model` argument. The scratch repo ended with the feature commit and the item closed.

Limits: n=1. The session was Opus, so the reviewer's opus is the same under `inherit`; only the implementer's sonnet is informative. I did not run the reviewer half under a non-Opus session. The runtime's model id is `claude-sonnet-5-5` for the alias `sonnet`.

## Verify (after final edit)
- `./bin/mstack lint-plugin .`: PASSED - 0 failures, 0 warnings
- `npm run typecheck`: clean
- `./bin/mstack gate`: PASSED - 0 failures, 0 warnings
- `npm run test:bun`: 634 pass, 0 fail; `npm run test:node`: 634 pass, 0 fail (631 before, +3)
- `rg -n "^model:" agents/*.md`: implementer sonnet, spec-author sonnet, reviewer opus, spec-reviewer opus, orchestrator inherit

## Not shown
Reviewer on a non-Opus session; spec-author and spec-reviewer live (frontmatter only); cost change vs inherit (no A/B; items 49 and 45 measure it). Whether a typo'd model value is harmful in Claude Code is unverified. README, Skills-and-Playbooks and CONTRIBUTING had no sentence the change makes untrue (`rg -n -i "inherit|different model|same model"` found none relevant).

## Deviations
Tests at `lintPlugin`, not a spawned CLI. The live prompt adds "go ahead and finish it without asking me anything" so it would not stop at intake.
