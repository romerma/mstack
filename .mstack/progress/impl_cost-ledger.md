# Implementation report: cost-ledger (item 37)

Branch `feat/cost-ledger`, base 0a45b4d. Verdict: **test-verified**, with one rung-4 caveat
spelled out under "Where this stopped".

## Rung-4 note (A1): run before any design

Real `env -u ANTHROPIC_API_KEY claude -p ... --model haiku --setting-sources project` sessions
in a throwaway git project whose `.claude/settings.json` logged a timestamp and the transcript's
size and `cost-state` count at SessionStart, Stop, SubagentStop and SessionEnd. Spend: about
$0.03 in total (four sessions, haiku).

**(a) cost-state is written BEFORE the SessionEnd hook fires.** One session, one subagent:

```
== Stop       1794142486.561  size=191072 lines=42 cost-state-lines=
== SessionEnd 1794142486.608  size=194428 lines=46 cost-state-lines=1
   ..."claude-haiku-5-5":{"inputTokens":10,"outputTokens":358,"thinkingTokens":203,"cacheReadInputTokens":53323,"cacheCreationInputTokens":22303,...,"costUSD":0.00429858}},"hasUnknownModelCost":false}
```

The line was already the tail of the file when the SessionEnd hook stat'ed it, 47 ms after the
last Stop. The hook input there was `{"hook_event_name":"SessionEnd","reason":"other",...}`. The
design works as written. Caveat: this is `-p`. I did not run an interactive session, so the
interactive ordering is unobserved; the design copes anyway, see the "settled at size" decision.

**(b) modelUsage includes subagent usage.** Main transcript and the one subagent transcript summed
by `message.id` against that cost-state (all haiku, so the sum is the check):

```
subagents/agent-a5eff0872a810922b.jsonl  {"claude-haiku-5-5":{"in":2,"cw":11670,"cr":0,"out":4,"n":1}}
a6691e7f-....jsonl (main)                {"claude-haiku-5-5":{"in":8,"cw":10633,"cr":53323,"out":354,"n":3}}
cost-state                               {"claude-haiku-5-5":{"in":10,"cw":22303,"cr":53323,"out":358}}
```

8+2=10, 10633+11670=22303, 53323+0=53323, 354+4=358. Exact. (In the later end-to-end run main
plus subagent was short of cost-state by 22% of cache reads; that gap is the `unattributed` row.)

**(c) `--resume` appends to the same file, same session id, and cost-state is cumulative.**

```
$ claude -p "Say ok." --resume a6691e7f-...        (one .jsonl before, one after; 190 KB -> 202 KB)
SessionStart input: "source":"resume"      size=194428 cost-state-lines=1
SessionEnd   hook :                        size=206443 cost-state-lines=2
cost-state #1: input 10 / output 358 / cache_read 53323 / cache_write 22303
cost-state #2: input 12 / output 362 / cache_read 75339 / cache_write 22702   <- includes #1
```

No new file, no new session id, two cost-state lines, the second the whole-session total. So a
flush must reconcile against the session's total (all `session@*` rows), not the resume's slice.

**(d) `/compact` usage appears only in cost-state.** `claude -p "/compact" --resume ...`:

```
appended to the main transcript (46->81 lines): system/compact_boundary, isCompactSummary user line,
  attachments, ... , cost-state. Zero assistant lines, zero usage objects.
cost-state before: input 12  / output 362 / cache_read 75339  / cache_write 22702
cost-state after : input 4876/ output 622 / cache_read 119388 / cache_write 22719
hooks fired: SessionStart source=resume, SubagentStop x2 (agent_type "", agent_transcript_path set
  but the file never exists), SessionStart source=compact, SessionEnd
```

Two consequences built in: compaction tokens can only land in the `unattributed` row, and
SessionStart fires again with `source:"compact"` (and SubagentStop fires with `agent_type ""`
and a transcript path that does not exist), so neither may double-mark or accuse.

Also confirmed: subagent transcripts live at `<session>/subagents/agent-<id>.jsonl`, with
`agent-<id>.meta.json` holding `agentType` (`"general-purpose"` here; plugin agents are
`mstack:<role>`), and repeated usage per `message.id` was identical in every transcript checked.

End-to-end through this checkout's `./bin/mstack hook ...` (real session, one subagent, rung 4
for the whole path), `.mstack/costs.tsv` after SessionEnd, then after a real `/compact` resume:

```
role           input cache_write cache_read output messages cost_usd source
main              12       3793     112503   2173        5  (none)   transcript
general-purpose    2      11688          0      4        1  (none)   transcript
unattributed       4       9910      32147    123   (none)  0.0068   cost-state
   -> 12+2+4=18, 3793+11688+9910=25391, 112503+0+32147=144650, 2173+4+123=2300 == claude's modelUsage
   -> total_cost_usd 0.0068 == costs.tsv cost_usd
unattributed    2130        833      24119   2874   (none)  0.001995 cost-state   <- the /compact
   -> total_cost_usd 0.008795 == 0.0068 + 0.001995
```

## Design adjustments the facts forced

- `cost_usd` rides on the `unattributed` row as the model's whole real session cost, so the
  column's sum equals real spend (it matched `total_cost_usd` to the digit). The per-role split is
  tokens only. Recorded as a decision row.
- Reconciliation is per session across all runs, not per mark, because cost-state is cumulative
  over `--resume`.
- A mark is skipped when the session's last mark has the same item and transcript (resume and
  `source:"compact"` re-fire SessionStart). `run = session@offset` of the first mark of a stretch.
- Not forced by facts but needed because (a) is `-p` only: a flush appends an `ended` record
  carrying the transcript size, and a settled session is re-read only if the file later grows.
  A cost-state written after SessionEnd in interactive mode is then caught by the next
  SessionStart or `mstack cost`.
- The marks directory is found by walking up for `.git` (dir, or `gitdir:` file in a worktree)
  instead of spawning `git rev-parse --git-path mstack`, since Stop runs every turn. A test pins
  the two equal in a plain repo and a linked worktree; git is the fallback.

## What changed

New `src/costs.ts` holds marks, the streaming flush, reconciliation and the summary used by the
new `mstack cost [slug] [--by role|item|model] [--json]`. `src/hooks.ts` gains `sessionEnd`,
the wider `HookInput`, cost work fenced by `safely()` after each hook's own output is built
(SessionStart, Stop), and the SubagentStop freshness rule: at least one report must be
modified after the first timestamp of the agent's own transcript (path derived from
`transcript_path` + `agent_id` when `agent_transcript_path` is `""`; no transcript means fail
open, as before). `src/state.ts` parses `rules.record_costs` (non-boolean is a `UserError`);
`src/setup.ts` creates `costs.tsv` and `.mstack/.gitattributes` (merge=union for the three
tables); `src/paths.ts` gains `Store.costs`; `src/cli.ts` dispatches `session-end` and `cost`;
`hooks/hooks.json` gains SessionEnd (5 s). README, The-CLI, State-Files and Gates-and-Hooks are
updated with output pasted from real runs. 19 new tests in `tests/costs.test.ts`.

## Files

```
M  README.md                        M  src/cli.ts
M  docs/wiki/Gates-and-Hooks.md     M  src/hooks.ts
M  docs/wiki/Getting-Started.md     M  src/paths.ts
M  docs/wiki/Home.md                M  src/setup.ts
M  docs/wiki/State-Files.md         M  src/state.ts
M  docs/wiki/The-CLI.md             M  hooks/hooks.json
M  docs/wiki/The-Story.md           A  src/costs.ts
A  .mstack/.gitattributes           A  tests/costs.test.ts
A  .mstack/costs.tsv                A  .mstack/progress/impl_cost-ledger.md
M  .mstack/decisions.tsv, .mstack/progress/current.md, .mstack/state.json (bookkeeping)
```

## R to test

| R | Test | Where |
|---|---|---|
| A1 rung-4 note before building | the section above, run on this machine | this file, top |
| A2 costs.tsv columns, `(none)` sentinel, no negatives | setup creates costs.tsv with the agreed columns...; a transcript that exceeds cost-state never produces a negative or a minus sign | tests/costs.test.ts:128, :412 |
| A2/A6 `.gitattributes` merge=union for the three tables | same setup test, also asks `git check-attr` | tests/costs.test.ts:128 |
| A3 marks under `git rev-parse --git-path mstack/`, never in `.mstack/` | marks live under git's own path (plain repo and worktree) | tests/costs.test.ts:156 |
| A3 SessionStart mark; repeat adds nothing | SessionStart writes a mark at the transcript's current size... | tests/costs.test.ts:181 |
| A3 Stop marks only on item change, segments attributed | Stop appends a mark only when the active item changed... | tests/costs.test.ts:206 |
| A3 dedupe by message.id, skip isSidechain, delta only, flush twice changes nothing | a flush counts each message.id once... | tests/costs.test.ts:239 |
| A3 subagents scanned, role from meta.json | subagent transcripts are scanned... | tests/costs.test.ts:284 |
| A3 flush for crashed sessions at SessionStart | a session that never reached SessionEnd is settled... | tests/costs.test.ts:321 |
| A3 flush inside `mstack cost` | mstack cost flushes the live session before it reads | tests/costs.test.ts:343 |
| A4 unattributed cost-state row per model, resume growth, no double write | cost-state reconciles the transcript sum... | tests/costs.test.ts:363 |
| A5 stale report caught | SubagentStop catches a later-round reviewer that wrote nothing... | tests/costs.test.ts:450 |
| A5 empty `agent_transcript_path` derived; no transcript fails open | SubagentStop derives the transcript path... | tests/costs.test.ts:474 |
| A5 SubagentStop writes no cost rows | SubagentStop writes no cost rows | tests/costs.test.ts:505 |
| A6 `mstack cost` tokens, rounds via roundOf, verifier-failed, --by, --json | mstack cost prints tokens by role... | tests/costs.test.ts:546 |
| A6 `record_costs` false off; non-boolean is an error | rules.record_costs: false turns every write off... | tests/costs.test.ts:595 |
| A6 SessionEnd hook wired (hooks.json, cli) | the session-end hook is wired... | tests/costs.test.ts:626 |
| A7 throwing cost layer never changes another hook's output | a cost layer that throws never changes what another hook says | tests/costs.test.ts:656 |
| A7 budget, 50 MB | hook paths stay within budget on a 50 MB transcript; ...nothing but assistant turns | tests/costs.test.ts:693, :747 |

## Fail-before reds

Existing code has no cost layer, so a stash cannot isolate the tests (they import `src/costs.ts`).
Instead each behaviour was broken in a scratch copy (`scratchpad/mutate.py`, 18 mutations) and
`tests/costs.test.ts` run against it. Every mutation is red, the real tree is restored:

```
A3 dedupe by message.id:              RED (4 tests: flush, subagents, both budget tests)
A3 skip isSidechain:                  RED (flush test)
A3 delta only (write totals):         RED (flush, subagents, reconcile)
A3 Stop marks only on change:         RED (Stop mark test)
A3 flush leftovers at SessionStart:   RED (crashed-session test)
A3 marks under .mstack:               RED (marks location test)
A4 reconcile unattributed:            RED (reconcile, negative-number test)
A5 SubagentStop fresh report:         RED (stale-report test, derive-path test)
A5 derive empty path:                 RED (derive-path test)
A6 record_costs off:                  RED (record_costs test)
A6 record_costs non-boolean:          RED (record_costs test)
A6 gitattributes:                     RED (setup test)
A6 review rounds via roundOf:         first STILL GREEN, test fixed (4 files, 3 rounds), then RED
A6 session-end wired in cli:          RED (wired test)
A7 isolation (Stop):                  RED (isolation test)
A7 isolation (SessionStart):          RED (isolation test)
A7 Stop reads the transcript:         RED (50 MB budget test)
```

The one that was green is worth saying out loud: the first `cost` fixture had three review files
and three rounds, so counting files passed. I added `review_x_r2-security.md` (four files, three
rounds) and the mutation went red.

## Commands

Full suite (bun then node), PATH with node 24.14.0:

```
$ PATH=/Users/romerma/.nvm/versions/node/v24.14.0/bin:$PATH npm test
 368 pass
 0 fail
Ran 368 tests across 22 files. [48.17s]
ℹ tests 362
ℹ pass 362
ℹ fail 0
ℹ cancelled 0
exit=0
```

(bun runs 368, node 362: node does not collect a handful of bun-only cases. My 19 ran on both.
No item-21 hang occurred this run.) An earlier full run overlapped a `git stash` I did to check
`plugin validate`, so it was discarded and the run above is a clean second one.

```
$ bun run typecheck
$ bunx --bun tsc --noEmit
(no output, exit 0)

$ ./bin/mstack lint-plugin .
-- cross-references
[ok]    18 skills and agents, every cross-reference in 38 file(s) resolves
-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
95 relative links checked, 0 broken

$ claude plugin validate . --strict
Validating plugin: /Users/romerma/Code/mstack/CLAUDE.md
⚠ Found 1 warning:
  ❯ root: CLAUDE.md at the plugin root is not loaded as project context. ...
⚠ Found 1 plugin directory warning:
  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). ...
✘ Validation failed (--strict treats warnings as errors)
```

`validate --strict` is **red, and it was red before this change**: I stashed my work and the
same two warnings (root `CLAUDE.md`, missing icon) printed with the same failure. Neither is
touched by this item; the manifest and hooks.json validate (no errors). Not claimed green.

Budget, 50 MB synthetic transcript (printed by the tests; bun, then node):

```
budget: transcript=50.3MB messages=11400 onStop=0.11ms stop(hook)=54.6ms stop(no transcript)=52.3ms session-end=29ms repeat=0.2ms
budget (dense): transcript=50.1MB messages=74500 session-end=82ms
node: ... onStop=0.11ms ... session-end=33ms repeat=0.1ms / dense session-end=109ms
```

`stop(hook)` is the whole hook, gate included: 54.6 ms with a 50 MB transcript against 52.3 ms
without one, so the transcript adds nothing; the cost part (`onStop`) is 0.11 ms. SessionEnd is
the only transcript reader and the hook timeout is 5 s. The assertions are 20 ms for onStop,
+50 ms for the whole Stop, 2.5 s for the flush.

## Where this stopped on the evidence ladder

- Rung 4 (real runs): the four facts, the end-to-end flush against a real `claude -p` session
  with a real subagent and a real `/compact` resume, and the reconciliation to the cent.
- Rung 3 (suite, both runtimes) for every behaviour bullet; red-before shown by mutation.
- Not run: an interactive session (cost-state ordering relative to SessionEnd is observed for
  `-p` only; the settled-at-size record is the hedge), Linux, and the benchmark itself. The
  `plugin validate --strict` failure above is pre-existing.

## Open for the reviewer

- `unattributed` rows for a resumed session absorb any earlier usage mstack never marked. That
  is true to the data (it is what cost-state holds) but a resumed session that predates the
  install will show a large `unattributed` row once.
- Marks pruning (14 days after settle, or transcript gone) is untested beyond not breaking the
  flush tests; it only ever drops settled sessions.
