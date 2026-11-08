# Review - cost-ledger (item 37)

**Verdict:** CHANGES_REQUESTED

Reviewed at HEAD 8aca6132 (`feat/cost-ledger`), delta `0a45b4d..HEAD` (code in d8e694a). I did not
write this code. The suite is green on both runtimes. Two counting defects block approval, and
both reproduce: one in real Claude Code sessions run through this checkout's hooks (rung 5), one
with the real CLI hooks on synthetic transcripts (rung 4). Real spend on probes: about $0.018 (haiku).

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A1 rung-4 note | impl report section, lines 6-82 | I re-observed (a) for `-p` and for interactive, and (c). See "Rung-4 facts" |
| A2 columns, `(none)`, no negatives | `tests/costs.test.ts:128`, `:412` | header asserted; `!/\t-/` asserted; `Math.max(0, ...)` at `src/costs.ts:685,722,725` |
| A3 marks under git path | `tests/costs.test.ts:156` | plain repo and linked worktree. I added submodule (matches) and `GIT_DIR` (differs, finding 5) |
| A3 SessionStart mark | `tests/costs.test.ts:181` | **only because the fixture pre-creates the transcript** (`tests/costs.test.ts:47`). Real fresh sessions have none (finding 1) |
| A3 Stop on change only | `tests/costs.test.ts:206` | ok |
| A3 dedupe, sidechain, delta, flush twice | `tests/costs.test.ts:239`, `:284` | I mutated the sidechain skip (1 red) and the dedupe (3 red) |
| A3 leftover at SessionStart, flush in `cost` | `tests/costs.test.ts:321`, `:343` | ok |
| A4 unattributed per model | `tests/costs.test.ts:363` | holds on real sessions. Fails for a session with no Stop (finding 1) and across branches (finding 2) |
| A5 fresh report | `tests/costs.test.ts:450`, `:474` | I also ran it against a real agent transcript, see below |
| A6 cost, record_costs, gitattributes | `tests/costs.test.ts:546`, `:595`, `:128` | ok |
| A7 isolation, budget | `tests/costs.test.ts:656`, `:693`, `:747` | I reran the budget, numbers below |
| (missing) fresh session, transcript absent at SessionStart | none | finding 1 |
| (missing) SessionEnd with no prior Stop | none | finding 1 |
| (missing) same session flushed on two branches, then merged | none | finding 2 |

## Rung-4 facts, re-run by me

Setup: a scratch git repo with an mstack store and an active item `probe`. Its
`.claude/settings.json` wired SessionStart, Stop, SubagentStop and SessionEnd to a logger (time,
transcript size, cost-state count) and to `/Users/romerma/Code/mstack/bin/mstack hook <event>`.
`claude` 2.1.319, `--model haiku`, `--setting-sources project`. The interactive runs were driven
by `expect`, with the parent session's `CLAUDE_*` variables unset. With
`CLAUDE_CODE_CHILD_SESSION` inherited, interactive transcript saving is off.

**Cost-state vs SessionEnd, interactive: observed, and the design holds.** This was the one fact
the implementer could not observe:

```
/exit            SessionEnd size=338873 cost-state=1   reason=prompt_input_exit
Ctrl-C Ctrl-C    SessionEnd size=335667 cost-state=1   reason=prompt_input_exit
pty close (HUP)  SessionEnd size=335835 cost-state=1   reason=other
```

In all three, cost-state was already on disk when SessionEnd ran. So the "ended record plus
re-read if the file grew" hedge does not carry weight on these paths. Two things remain
unobserved: SIGKILL (no SessionEnd at all) and `/clear`. Where the hedge would matter, it is
weak: it only fires at a later SessionStart or `mstack cost` *in the same worktree*. A linked
item worktree removed by `worktree prune` takes its marks with it. And a late row lands on
whatever branch is checked out at that time, which feeds finding 2.

**Resume: confirmed cumulative, and the flush is correct.** I ran `claude -p "Say ok." --resume
89e2b3ea...`. It used the same file and the same id. Cost-state went from 2/4274/13971/63
$0.001026 to 4/10645/28574/95 $0.002463. The flush appended main 2/6371/14603/32 plus an
unattributed row of 0 tokens and $0.001437. The sums equal cost-state to the token and the cent.

**New fact: the transcript does not exist at SessionStart in a fresh session.** This held in
6/6 fresh sessions, `-p` and interactive alike:

```
== SessionStart 1794143843.740 size=missing cost-state=-     (claude -p "say hi", green gate)
== Stop         1794143845.928 size=98193  cost-state=0
== SessionEnd   1794143846.028 size=160314 cost-state=1
costs.tsv: 89e2b3ea...@158598  probe  unattributed  2  4274  13971  63  (none)  0.001026  cost-state
```

Not one `main` row. The whole turn is `unattributed`. See finding 1.

## Acceptance, quoted

**"Before building: a rung-4 note in the impl report answers whether cost-state is written before or after SessionEnd, whether it includes subagents, what --resume does to the transcript, and where /compact usage appears"**
Met. See `impl_cost-ledger.md:6-82`. I confirmed (a), now for interactive too, and (c). I did
not rerun (b) or (d). One part of the note is wrong in its explanation: line 36 attributes the
22% gap to calls no transcript records. In my runs that gap is the first turn, which sat before
the first mark (finding 1).

**"`.mstack/costs.tsv` (committed) holds ts run target role agent_id model input cache_write cache_read output messages cost_usd source, one row per model, with (none) as the no-item sentinel"**
Met. `src/costs.ts:57-71`, `.mstack/costs.tsv` (header committed), `tests/costs.test.ts:128`.
`(none)` is used for target, agent_id, messages and cost_usd (`src/costs.ts:668-669`). No cell
starts with `-`: values are floored at 0 by `num()` and `Math.max(0, ...)`.

**"SessionStart and Stop write marks under git rev-parse --git-path mstack/, Stop only when the active item changed; a flush at SessionEnd, at SessionStart for leftover runs and inside mstack cost dedupes usage by message.id, skips isSidechain, scans the session's subagents and appends only the delta per key, so flushing twice changes nothing"**
NOT met, on two counts:
(1) SessionStart writes no mark in a fresh session. The transcript is missing, and
`newMark` returns null (`src/costs.ts:245-251`). Finding 1.
(2) "Appends only the delta per key" is computed against the *checked-out branch's* costs.tsv
(`src/costs.ts:651-653`). With `merge=union`, flushing on two branches double counts. Finding 2.
Dedupe, sidechain, subagent scan and the same-branch double flush are correct and tested.

**"When a cost-state line exists, a role=unattributed source=cost-state row per model reconciles the transcript sum to it"**
Partly met. It holds on every real session that had a Stop: recorded $0.0140 equals the sum of
the six sessions' real costs. It fails when there is no Stop. `claude -p ... --max-turns 1`
ended `error_max_turns` and cost $0.00112, and cost-state was on disk at SessionEnd. It left 0
marks and 0 rows: `onSessionEnd` finds no session (`src/costs.ts:334-337`). Finding 1.

**"SubagentStop requires a report modified after the agent transcript's first timestamp, so a later-round subagent that writes nothing is caught"**
Met for the sequential case: `src/hooks.ts:193-208`, `tests/costs.test.ts:450,474`. I ran the hook
against a real agent transcript (first line 4,461 bytes, `timestamp` at byte 4,200). A round-1
report with an older mtime was caught, both with the path given and with it derived from
`transcript_path` + `agent_id`. A newly written `_r2` report passed. A subagent that wrote a
report is not wrongly failed. Residual holes are non-blocking, see finding 6.

**"mstack cost [slug] [--by role|item|model] [--json] prints tokens, review rounds via roundOf and verifier-failed rows; rules.record_costs false turns recording off; .mstack/.gitattributes sets merge=union on costs.tsv, ledger.tsv and decisions.tsv"**
Met. `src/cli.ts:942-1008`, `tests/costs.test.ts:546,595,128`. With `record_costs: false`,
`onStop`, `onSessionStart` and `onSessionEnd` all return early (`src/costs.ts:281,303,331`), and
`cost` skips `flushAll` (`src/cli.ts:964-972`). The test asserts no rows and no marks file. A
non-boolean is a `UserError` (`src/state.ts:144-153`). Setup writes `.gitattributes`
(`src/setup.ts:146`), and `git check-attr` agrees.

**"Hook paths stay within budget on a 50 MB synthetic transcript and a throwing parser never changes another hook's output"**
Met. I reran the budget: bun onStop 0.11 ms, Stop 53.8 ms vs 60.5 ms bare, SessionEnd 29 ms,
repeat 0.1 ms, dense 84 ms. Node: 0.21 ms, 98.0 vs 97.6 ms, 43 ms, 0.2 ms, dense 141 ms.
Isolation: the cost work runs after the output is built, inside `safely()` (`src/hooks.ts:78,243,266`).
`tests/costs.test.ts:656` breaks both costs.tsv and the marks dir and compares the outputs. Not
covered: the budget has no subagent-heavy session, and every subagent file is re-read in full
on every flush (`src/costs.ts:617-631`).

## Verification I ran

```
$ PATH=/Users/romerma/.nvm/versions/node/v24.14.0/bin:$PATH npm test
 368 pass
 0 fail
Ran 368 tests across 22 files. [47.84s]
ℹ tests 362
ℹ pass 362
ℹ fail 0
exit=0                       (no item-21 hang this run)
$ bun run typecheck          -> exit 0
$ ./bin/mstack lint-plugin . -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full   -> PASSED - 0 failures, 0 warnings
$ claude plugin validate . --strict   (HEAD and a detached worktree at 0a45b4d)
  both: root CLAUDE.md warning + ICON_MISSING, "Validation failed" -> no new warning from this item
$ ./bin/mstack ledger check cost-ledger
FAIL no verdict at 8aca6132; 1 row(s) exist at other SHAs and a new head SHA voids them
```

Mutations, in a detached worktree at HEAD with `bun test tests/costs.test.ts`. Removing the
sidechain skip gave 18 pass / 1 fail. Breaking the dedupe gave 16 pass / 3 fail. The worktree
was removed afterwards, and the main checkout is clean.

`mstack cost probe` after six real sessions shows how far finding 1 skews the role split:

```
role          input  cache_write  cache_read  output  messages     usd
unattributed    514       27,497     130,637     242         0  0.0140
main             14       23,670     124,174   2,004         6  (none)
```

## Changes required

1. **`src/costs.ts:245-251`, `:308-313`, `:334-337`: a fresh session's first turn is never
   `main`, and a session with no Stop records nothing at all.** At SessionStart the transcript
   does not exist yet (observed 6/6), so no mark is written. The first mark then comes from Stop
   (`:284-287`) at the end of the first turn. As a result:
   - every message of the first turn is outside every range and falls into `unattributed`;
   - a single-turn `claude -p` run has no main rows at all. That was 3 of 4 single-turn
     sessions, the benchmark's own shape. In the fourth, the Stop stat won a race;
   - a session that ends without a Stop (`error_max_turns`, an interrupt then exit, or a crash
     in the first turn) has no marks, so SessionEnd and every later flush skip it. That session
     gets 0 rows, even with cost-state on disk, and its spend silently leaves `costs.tsv`.

   Fix: when the transcript is missing at SessionStart, write the mark at offset 0. Everything
   later written to that file belongs to this session. In `onSessionEnd`, also mark a session
   that has no marks (offset 0, from `input.transcript_path`) before flushing. Tests: a fixture
   whose transcript does not exist at `begin()`, a test where SessionEnd comes without a Stop,
   and a test that the crash-at-first-turn case is settled by the next SessionStart.
   Then correct the docs: `docs/wiki/The-CLI.md:362-363` ("no transcript line accounts for: here
   about 20%") and `docs/wiki/State-Files.md:210` ("SessionStart writes one at the transcript's
   current size").

2. **`src/costs.ts:651-653` with `src/setup.ts:75-87`: `merge=union` double counts any session
   flushed on two branches.** The "already written" figure is read from the costs.tsv of the
   branch that is checked out. Rows committed on another branch are invisible to it, so a later
   flush there rewrites the session's full totals, and the union merge keeps both. I
   reproduced it with the real CLI hooks:
   - flush on `feat/a` and commit;
   - `git checkout main`, then `hook session-start` (resume) and more usage;
   - `hook session-end` and commit;
   - `git merge feat/a`.

   ```
   mstack cost total: {'input': 250, 'output': 25, 'cost_usd': 2.5}   real: input 150 output 15 usd 1.5
   ```

   This also breaks the decision row's invariant that "the column sum equals real spend". The
   trigger paths are ordinary:
   - `mstack cost` mid-session, a chore commit, then switching branches;
   - a leftover flush by another session, followed by a resume on another branch.

   Fix: record what has been flushed per session and key in machine-local state (the marks
   file is the natural place), and write `total - flushed_so_far_here`. Then each row is a
   distinct delta and a union of branches sums correctly. Or make rows cumulative and dedupe
   at read time. Add a two-branch merge test. Then correct "every row stands alone" at
   `src/setup.ts:80` and `docs/wiki/State-Files.md:240`: under the current scheme it is false
   for costs.tsv.

3. **`src/costs.ts:727-737`: the session's whole `cost_usd` is billed to the item active at the
   last mark.** `mstack cost` (default `--by item`) prints it as that item's `usd`. A session
   that worked on `alpha` and ended on `beta` shows beta with the full cost and alpha with
   `(none)`. The per-role caveat is documented (`docs/wiki/The-CLI.md:358-361`); the per-item one is not.
   Either split `cost_usd` across items in proportion to their tokens, or leave `usd` off the
   per-item rows (total only). Whichever you pick, state it where `--by item` is documented. A
   per-item cost headline would read this column.

Non-blocking. Fix them in this round if cheap, otherwise file them:

4. `src/costs.ts:316-323,352-366`: `prune` rewrites the file from the snapshot taken before the
   flush loop. Observed: the `ended` record that the same pass's flush appended for a leftover
   session was dropped. That costs a needless re-flush, not a miscount. It also drops any mark
   another live session appended during the up-to-3 s window, which misattributes that stretch.
   Re-read the file under the lock before rewriting.
5. `src/costs.ts:129-154`: the walk ignores `GIT_DIR`. With `GIT_DIR` set, `git rev-parse
   --git-path mstack` gave `.../subsrc/.git/mstack` and the walk gave `.../subrepo/.git/mstack`.
   Submodules (`gitdir: ../.git/modules/sub`) and linked worktrees match. Use the spawn when
   `GIT_DIR`/`GIT_COMMON_DIR` is set. The marks are never in `.mstack/` in any of these cases.
6. `src/hooks.ts:195`: `found.some(...)` means a panel lens that writes nothing passes once any
   sibling's report is newer than its start. `fanout check` is the real guard there, so say so
   in the comment. A subagent resumed later keeps its original first timestamp. Neither case is
   the sequential one in A5.
7. The Stop stat races the turn's last assistant line. In the same Stop, the logger saw 98,193
   and 191,897 bytes, while the marks landed at 158,598 and 191,897. So the item boundary
   wobbles by one message. Low impact once finding 1 is fixed.
