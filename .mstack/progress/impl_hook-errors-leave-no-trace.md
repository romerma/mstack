# Implementation report: item 54 hook-errors-leave-no-trace

Branch `fix/hook-errors-leave-no-trace`. Last code commit: `66c9dc9` (tests); last `src/` commit `18e9a45`.

## What changed

A failed hook now leaves one line (`timestamp<TAB>event<TAB>message`) in `.mstack/hook-errors.log`
and still exits 0 with the same stdout/stderr as before. New leaf module `src/hooklog.ts` owns
the log: append (never throws, never creates `.mstack/`, one line, control characters
flattened, bounded lengths), the cap (`MAX_LINES` = 200, oldest dropped), the read-back used by
the gate, and `HOOK_COMMANDS`, the one list of events the CLI handles. `cmdHook` in `src/cli.ts`
resolves the store, opens a "hook in flight" context in `hooklog`, dispatches through a
`HANDLERS` record keyed by `HOOK_COMMANDS` (adding a handler without naming it is a type
error), and logs a thrown handler, a non-JSON stdin (an empty stdin is not a fault) and an
unknown event; the unknown event also writes one line to stderr. `hooks.ts`'s `safely` (the
fence around cost recording) now records what it swallows, so a cost row lost to `withLock`'s
`UserError` reaches the log. Swallowed `catch` blocks in `costs.ts` and `hooks.ts` that tolerate
a missing file now go through `tolerateAbsence`: ENOENT/ENOTDIR stay silent, anything else is
logged. `gate` warns (never fails), naming `.mstack/hook-errors.log`, when it holds lines
stamped after the mtime of `progress/history.md`. `lint-plugin` refuses a `hooks.json` entry
whose `args` are `["hook", "<name>"]` with a name outside `HOOK_COMMANDS` (with a nearest-name
suggestion). `setup` writes the log into the store's `.gitignore`; for stores created before
this change the logger appends the pattern to `.git/info/exclude` the first time it creates the
log (a hook editing the tracked `.gitignore` would dirty the tree and turn the gate's clean-tree
check red).

## Files

- `src/hooklog.ts` (new), `src/cli.ts` (`cmdHook`, `HANDLERS`; `handleHook` removed),
  `src/hooks.ts`, `src/costs.ts` (catch sites only), `src/gate.ts`, `src/lint.ts`,
  `src/paths.ts` (`HOOK_LOG`, `Store.hookErrors`), `src/setup.ts` (ignore entry),
  `.mstack/.gitignore`.
- `tests/hook-errors.test.ts` (new, 24 tests), `tests/lint.test.ts` (+2),
  `tests/verification.test.ts` (one assertion changed, see below).
- Commits: `2e054ca` red tests; `facea05` test expectation change; `18e9a45` fix; chore commit
  for `.mstack/.gitignore`; test commit `66c9dc9`; this report.

Deliberate change to an existing test, in its own commit: `tests/verification.test.ts`
"setup writes a store .gitignore" asserted the store ignores ONLY `verification.tsv`; it now
expects `verification.tsv` and `hook-errors.log` (the reason for "only" was not to ignore
durable state, and the log is machine-local). That commit also carries a two-line fix to my own
red test (session-start on a broken state.json logs two lines, not one, see "Left").

## Commands

Final suites (unmutated, after the last commit):

```
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 432
ℹ pass 432
ℹ fail 0
$ bun test ./tests
 432 pass
 0 fail
Ran 432 tests across 22 files. [67.79s]
$ bunx --bun tsc --noEmit && echo TSC-OK
TSC-OK
$ ./bin/mstack lint-plugin . | tail -2
PASSED - 0 failures, 0 warnings
```

Red state before the fix (commit `2e054ca`): 20 of 39 tests in `hook-errors.test.ts` +
`lint.test.ts` failed; the ones that passed are failure-path guards (read-only store,
log-is-a-directory gate, budget).

Hook tests repeated: `hook-errors.test.ts hooks.test.ts lint.test.ts` 20 times on node: 0
failures; 20 times on bun: 0 failures. Neither known flaky test (`run.test.ts:54`,
`costs.test.ts:698`) failed in the full runs above.

The three original reproductions, throwaway store
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl54/store`:

```
== 1 misspelt event
mstack hook: unknown event 'sesion-start'; handled: session-start, post-edit, subagent-stop, stop, session-end, pre-tool-use
exit=0
== 2 session-end, state.json not JSON
exit=0
== 3 session-start same store
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"mstack state for this repository:\n- No active work item."}}
exit=0
== log
2026-11-16T21:24:40.047Z	sesion-start	event is not handled by the CLI (handled: ...)
2026-11-16T21:24:40.081Z	session-end	cost recording: .../.mstack/state.json is not valid JSON: JSON Parse error: Unexpected identifier "nope"
2026-11-16T21:24:40.113Z	session-start	state.json could not be read: .../.mstack/state.json is not valid JSON: ...
2026-11-16T21:24:40.113Z	session-start	cost recording: .../.mstack/state.json is not valid JSON: ...
== git status (state.json changed on purpose)
 M .mstack/state.json            <- only the file I broke; the log is not listed
== gate
[warn]  4 hook errors recorded since the last session close; newest: session-start: cost recording: ... Read .mstack/hook-errors.log
PASSED - 0 failures, 2 warnings
== gate after history.md changes (touched +1 min)
PASSED - 0 failures, 1 warning       <- the hook-errors warning is gone
== no .mstack at all (cd bare/)
session-start exit=0      stop exit=0
mstack hook: unknown event 'sesion-start'; ...   sesion-start exit=0
(no .mstack created)
```

Timing, median of 7 process runs, bun, ms (before at `06eed39`, after at HEAD):

| hook | before | after |
|---|---|---|
| session-start | 29 | 32 |
| stop | 68 | 70 |
| session-end | 29 | 32 |
| pre-tool-use | 29 | 33 |
| unknown `sesion-start` | 29 | 32 |
| thrown (`{"cwd":5}` on stop) | 29 | 32 |

Added cost: about 3 ms on the failing paths (log write), 0 to 4 ms noise on the healthy ones.
The lost-lock case waits `withLock`'s own 2 s and is asserted under 5 s.

## Mutant table

Each row: the line was mutated, tests run on both runtimes
(`hook-errors`, `lint`, `gate`, `hooks` files), then restored. `git status --short` clean after.
Every row is killed on both node and bun.

| mutation | killed by (first of N) |
|---|---|
| remove the log append in the `cmdHook` catch | "a hook that throws appends one line" (1) |
| unknown event: no stderr | "a missing event is an unknown event too" etc. (4) |
| unknown event: no log line | "an unknown event says so on stderr, leaves a line" etc. (7) |
| unknown event returns silently (old behaviour) | (9) |
| `safely` no longer logs | "a cost failure that the hook fences off still reaches the log" (3) |
| `activeItemOrLog` no longer logs | "session-start on an unreadable state.json" (1) |
| drop the cap (no trim) | "the log is bounded" (1) |
| keep `MAX_LINES * 2` | "the log is bounded" (1) |
| drop the gate warning | "the gate warns, naming the log" (3) |
| drop the lint check | "a hooks.json entry whose argument names an event..." (1) |
| "newer than history.md" always true | "the gate counts only the lines newer", "stops warning once history.md changes" (2) |
| "newer than history.md" always false | "the gate warns, naming the log" (3) |
| `keepOutOfGit` skipped | "a store created before this change does not show the log" (1) |
| `tolerateAbsence` logs ENOENT too | "every event the CLI handles is accepted" (log noise on a healthy store) (2) |
| no tab/newline flattening | "a message with tabs, newlines and enormous length" (1) |
| `session-end` dropped from `HOOK_COMMANDS` | (9) |
| `appendHookError` creates a missing store dir | survived the first run (unreachable through the CLI: no store means `storeDir` is null); killed by the added test "appending to a store directory that does not exist creates nothing" |
| empty stdin counted as a fault | "hook input that is not JSON is logged, and an empty stdin is not" (2) |

## Every `catch` on the hook path

`src/hooks.ts`

| line | what | kind | now |
|---|---|---|---|
| 61 | `inputProblem` JSON.parse | is the report itself | returns "hook input is not JSON"; `cmdHook` logs it (empty stdin excluded) |
| 70 | `readInput` JSON.parse | hidden failure (garbage stdin read as `{}`) | covered by `inputProblem` at the call site, behaviour of `readInput` unchanged |
| 110 | `activeItemOrLog` (new) | hidden failure: `activeItem` answers "none" for an unreadable `state.json` | logged; output text unchanged |
| 145 | `safely` (the cost fence) | hidden failure (also every `withLock` UserError) | logged as `cost recording: ...` |
| 168 | `postEdit` parseState | not hidden: the failure is the nudge sent to the model | unchanged |
| 238 | `statSync` of a report in `subagentStop` | expected absence (report vanished) when ENOENT; fault otherwise | ENOENT silent, other codes logged |
| 564 | `readIfPresent` (`current.md`) | expected absence when ENOENT; fault otherwise | ENOENT silent, other codes logged |

(The sixth `catch` match in `hooks.ts` before the change was a comment.)

`src/costs.ts` (13 before; 12 now use a handler, listed by current line)

| line | what | kind | now |
|---|---|---|---|
| 176 | `marksDir` walk, stat/read of `.git` | expected absence (no `.git` here, keep walking) | ENOENT/ENOTDIR silent; other codes logged |
| 224 | `parseMarkLine` | tolerated corruption: a torn or foreign line in the marks file | left silent on purpose: it is per line, repeats on every hook, and the next flush recomputes the row (the file's own documented design) |
| 234 | `readSessions` read | expected absence (no marks yet) | ENOENT silent; other codes (EISDIR, EACCES) logged |
| 271 | `lastMarkFor` read | expected absence | same |
| 303 | `newMark` stat | expected absence (fresh session has no transcript yet, measured) | same |
| 406 | `needsFlush` stat | expected absence (transcript gone) | same |
| 546 | `scanTranscript` JSON.parse of a line | expected: the last line of a live transcript can be half written | left silent, per line |
| 592 | `firstTimestamp` open | expected absence | same as above |
| 615 | `firstTimestamp` read | hidden failure (read error mid-file) | always logged |
| 636 | `agentRole` meta read | expected absence (no meta file); a corrupt meta is a fault | ENOENT silent; parse errors logged |
| 670 | `flushSession` stat | expected absence | ENOENT silent; others logged |
| 705 | `flushSession` readdir of `subagents/` | expected absence (no subagents) | same |
| 724 | `flushSession` scan of one subagent transcript | hidden failure when not ENOENT: that subagent's rows are lost | ENOENT silent; others logged with the path |

Two `catch`es are deliberately silent per-line parse tolerances (224, 546); I judge them
expected, not hidden. A reviewer may disagree for 224.

The four `withLock` sites (costs.ts `appendLine`, `prune`, and the two in `flushAll`/flush) all
run under `safely`, so a `UserError` from a live holder or an uncreatable lock is logged
(test "a cost row lost to a lock that a live process holds leaves a line").

`cmdHook`: the bare `catch {}` now calls `hooklog.noteFailure("handler threw", error)`.

## R to test (acceptance bullets)

| acceptance | test | file:line |
|---|---|---|
| 1. exception inside a hook appends one line, hook exits 0 inside budget | a hook that throws appends one line | `tests/hook-errors.test.ts:98` |
| 1 (fenced cost failure) | a cost failure that the hook fences off still reaches the log | `tests/hook-errors.test.ts:116` |
| 1 (state unreadable) | session-start on an unreadable state.json | `tests/hook-errors.test.ts:132` |
| 1 (lost row, withLock throws; under 5 s) | a cost row lost to a lock that a live process holds | `tests/hook-errors.test.ts:150` |
| 1 (bounded) | the log is bounded | `tests/hook-errors.test.ts:329` |
| 1 (log failure paths) | not writable / directory at log path / outside any store / huge+tabs / two at once | `tests/hook-errors.test.ts:243`, `:264`, `:281`, `:296`, `:313`, `:503` |
| 1 (never dirties the tree) | new store / old store `git status` | `tests/hook-errors.test.ts:460`, `:473`; setup ignore `:440` |
| 1 (budget) | a failing hook stays well inside 5 s | `tests/hook-errors.test.ts:492` |
| 2. gate warns naming the log | the gate warns; counts only newer lines; stops once history.md changes; warning never fails | `tests/hook-errors.test.ts:364`, `:389`, `:378`, `:423` |
| 3. unknown event on stderr | an unknown event says so on stderr, leaves a line | `tests/hook-errors.test.ts:191` (and `:207` for no event) |
| 3. lint refuses a hooks.json entry | a hooks.json entry whose argument names an event the CLI does not handle is refused | `tests/lint.test.ts:140` |
| 3. one source of names | every event the CLI handles is accepted, and the lint reads the same list | `tests/hook-errors.test.ts:219` |
| 4. cause of header-only costs.tsv | evidence below, not a test | n/a |

## Acceptance 4: why `.mstack/costs.tsv` holds only its header

Answer: two causes, one measured on the item 37 session and one that is current, and nothing in
this checkout's cost code is at fault. This is not rung 5: I did not launch `claude`.

1. This checkout's hooks DO write rows (rung 4, ran on a throwaway store with an active item,
   `rules.record_costs: true`, as in this repo's `state.json`): `hook session-start` then
   `hook session-end` with an assistant line in the transcript produced

   ```
   2026-11-16T21:24:53.011Z	sess1@57	demo	main	(none)	claude-sonnet-x	9	0	0	4	1	(none)	transcript
   ```
   and exit 0. This repo's `state.json` has `record_costs: true`, so the switch is not the cause.
2. Item 37's own session ran an installed copy that predates the cost code (rung 4 on
   artifacts, inference on the rest). `~/.claude/projects/-Users-romerma-Code-mstack/b5ee4aa1-...jsonl`
   (2026-10-31 to 2026-11-08, the item 37 session; item 37 closed 2026-11-08) records mstack
   hooks running from `${CLAUDE_PLUGIN_ROOT}`: 169 `PreToolUse:Bash`, 126 `Stop`, 3
   `SessionStart`, 0 `SessionEnd`. The `SessionEnd` entry was added to `hooks/hooks.json` in
   `d8e694a` on 2026-11-08 14:10, inside that session, and the cost modules were written in
   the same session, so the copy those hooks came from could not contain them. That matches the
   history entry ("this session runs the cached plugin").
3. Since then no session records anything: the current session transcript
   (`4aadee9d...jsonl`, 2026-11-16) contains no hook records at all; `~/.claude/plugins/installed_plugins.json`
   lists only `figma` and `mattpocock-skills`; `~/.claude/settings.json` `enabledPlugins` lists
   only those two; there is no mstack marketplace in `known_marketplaces.json`, no mstack under
   `~/.claude/plugins/cache`, and `mstack` is not on PATH. So the plugin is not loaded when
   Claude runs in this repo unless started with `claude --plugin-dir .`, and no session since
   2026-11-08 was (consistent with `current.md`: "Sessions launched as plain `claude` have no
   mstack plugin").

Unknown, stated rather than settled: whether a `claude --plugin-dir .` session would write
rows end to end. Tried: the by-hand run above; not tried (not allowed): a real session.

## Ledger

Recorded below at `66c9dc9` as `test-verified` (rung 4: real CLI processes against real stores
on both runtimes, plus the mutant table). Not `live-verified`: no Claude Code session ran these
hooks.

## Left / deviations

- `session-start` on an unreadable `state.json` still prints "No active work item" (now logged,
  text unchanged: changing hook output is outside the acceptance). Recorded in a decision row.
  That case logs two lines (the state read, then the cost recording that fails on the same file).
- `.git/info/exclude` (for pre-change stores) is an edit outside `.mstack/`, local and
  untracked; chosen over editing the tracked `.gitignore` (decision row). `GIT_DIR`
  overrides are not honoured by that path.
- A concurrent append during a trim rewrite can lose a line, only at the cap.
- `tests/verification.test.ts` assertion changed deliberately (see Files).
- My test run of the 20x repeat covered `hook-errors`, `hooks` and `lint` files, not the
  whole suite 20 times.
- A stray `ls` in one shell line (output piped to `head -0`); harmless.
