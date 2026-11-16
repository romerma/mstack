# Review - hook-errors-leave-no-trace

**Verdict:** CHANGES_REQUESTED

Round 1, reviewing alone, at `9f96d9b` (last code-changing commit `66c9dc9`). Diff judged:
`git diff 8dac2fd...HEAD -- src tests .mstack/.gitignore`. Every run below was made by me in
this pass; nothing is copied from the implementation report. Scratch stores and scripts live
under `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review54/`
(`scripts/a.sh`, `b.mjs`, `c.mjs`, `f.mjs`, `mut.mjs` + `mutants.py`, `load.sh`, `load4.sh`;
raw output in `runs/`). Base for byte comparisons: `git archive 8dac2fd` into `base/`.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| 1 throw in a handler leaves one line, exit 0 | `tests/hook-errors.test.ts:98` | killed H1 on both runtimes; fails on the pre-change source |
| 1 fenced cost failure leaves a line | `tests/hook-errors.test.ts:116`, `:150` (lock held) | killed O2 |
| 1 session-start unreadable state.json | `tests/hook-errors.test.ts:132` | killed O3 |
| 1 non-JSON stdin | `tests/hook-errors.test.ts:173` | killed O11 |
| 1 tolerated-absence catch sites log non-ENOENT faults (14 sites in `src/costs.ts`, `src/hooks.ts`) | **none** | O1 (`tolerateAbsence` never logs) survives both runtimes; so do O17, O23, O24, O25 |
| 1 subagent-stop on an unreadable state.json | **none, and the code does not log** | see Changes required 1 |
| 1 bounded | `tests/hook-errors.test.ts:296`, `:329` | killed H3, O7, O8, O9, O26 |
| 1 log write failures stay silent | `tests/hook-errors.test.ts:243`, `:264`, `:281`, `:503` | killed H2b, O12, O13 |
| 1 never dirties the tree | `tests/hook-errors.test.ts:440`, `:460`, `:473` | killed H9; exclude-path details unpinned (O4, O5, O6, O6b, H8c survive) |
| 1 budget | `tests/hook-errors.test.ts:150`, `:492` | measured below |
| 2 gate warning naming the log | `tests/hook-errors.test.ts:364`, `:378`, `:389`, `:410`, `:423` | killed H4, H6, H7, O10, O19, O20 |
| 3 unknown event on stderr + log | `tests/hook-errors.test.ts:191`, `:207` | killed H2, H2b, H2c |
| 3 lint refuses | `tests/lint.test.ts:140`, `:158` | killed H5 |
| 3 one list | `tests/hook-errors.test.ts:219` + `tsc` | O15 killed by test and tsc; O16 killed by tsc only (in the store's verify) |
| 4 cause of header-only costs.tsv | no test; report evidence | re-checked below |

Revert check: HEAD's `tests/hook-errors.test.ts`, `tests/lint.test.ts` and
`tests/verification.test.ts` run against the `8dac2fd` source: 22 of 61 fail on bun and 22 of
61 on node. The tests are real coverage for what they cover.

## Acceptance, quoted

**"an exception inside any mstack hook appends one line (timestamp, event, message) to a bounded log under .mstack/, and the hook still exits 0 inside its time budget"** - met for an exception that escapes a handler (`src/cli.ts:1049-1056`), for everything behind `safely` (`src/hooks.ts:142-149`, including both `withLock` failures, which I ran: a live holder logs `... is held by pid 97517 and did not let go in 2002 ms` at 2055 ms; an uncreatable lock logs `cannot create the lock ... EACCES` at 46 ms), for session-start's state read (`src/hooks.ts:107-114`) and for non-JSON stdin. Bounded (200 lines, about 1.5 KB per line worst case) and exit 0 everywhere I ran it. **Not met for subagent-stop**: `src/hooks.ts:197` still calls `activeItem` (`src/state.ts:315-320`), which swallows the same parse error session-start now logs, so on an unreadable `state.json` the hook skips its report check and leaves nothing (run below). And the 14 tolerated-absence sites have no test that fails when they go silent again (O1).

**"mstack gate reports hook errors recorded since the last session close as a warning naming the log"** - met. `src/gate.ts:133-145`; ran it: `[warn] 4 hook errors recorded since the last session close; newest: session-start: cost recording: ... Read .mstack/hook-errors.log`, `PASSED - 0 failures, 2 warnings`, exit 0; after appending to `history.md` the warning is gone. It gives the count, the newest line and the path, never fails (O10 killed), and is not printed by `gate --quiet` (the Stop hook's mode), which prints nothing and exits 0.

**"mstack hook with an event the CLI does not handle says so on stderr, and lint-plugin refuses a hooks.json entry that names one"** - met. `mstack hook sesion-start` prints `mstack hook: unknown event 'sesion-start'; handled: session-start, post-edit, subagent-stop, stop, session-end, pre-tool-use`, writes the log line, exits 0. `lint-plugin` refuses a misspelt, miscased, underscored, far-off, missing or numeric argument (exit 1) and never crashed on 21 `hooks.json` variants. One list: `HOOK_COMMANDS` (`src/hooklog.ts:29`) keys `HANDLERS` (`src/cli.ts:1061`) and feeds `lintHookArguments` (`src/lint.ts:274`).

**"the cause of the header-only .mstack/costs.tsv is identified with runtime evidence, or recorded as unknown together with what was tried"** - met, with the unknown part stated. Re-checked: the item 37 transcript `b5ee4aa1-....jsonl` holds 169 `PreToolUse:Bash`, 126 `Stop`, 3 `SessionStart` (plus 2 `:compact`, 1 `:startup`), 0 `SessionEnd`, matching the report; its Stop hook stdout names the CLI as `/Users/romerma/.claude/plugins/cache/mstack/mstack/0.2.1`, i.e. the cached install, not this checkout. The cost code landed in `d8e694a` (2026-11-08 13:10Z); Stop hooks kept running from the cache until 14:03Z and a SessionStart ran at 14:58Z, and this repository has no `.git/mstack/` marks directory at all, so no copy that ran here ever wrote a cost mark. Since then: only one session file in this project changed after 2026-11-08 besides that one (the current session, 0 hook records); no mstack in the plugin cache, `installed_plugins.json`, `known_marketplaces.json` or `settings.json`; `mstack` not on PATH. By hand, this checkout's hooks write a row (session-start, transcript grows, session-end): `2026-11-16T21:38:36.592Z s1@0 demo main (none) claude-x 9 0 0 4 1 (none) transcript`. Unknown, and the report says so: whether a `claude --plugin-dir .` session writes rows end to end, and whether the cached copy lacked the cost code or only never got an active item (the absent marks directory is consistent with both; the conclusion "nothing in this checkout's cost code is at fault" does not depend on which).

## Verification I ran

```
$ ./bin/mstack gate
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full          (npm test && npm run typecheck && bin/mstack lint-plugin .)
 438 pass  0 fail  Ran 438 tests across 24 files. [66.96s]     (bun, includes sandbox/)
ℹ tests 432  ℹ pass 432  ℹ fail 0                               (node)
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings    exit=0
```

The three original reproductions, throwaway store `review54/repro`:

```
== 1 misspelt
mstack hook: unknown event 'sesion-start'; handled: session-start, post-edit, subagent-stop, stop, session-end, pre-tool-use
exit=0
== 2 session-end, state not json
exit=0
== 3 session-start
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"mstack state for this repository:\n- No active work item."}}
exit=0
== log (tabs shown as fields)
...Z  sesion-start   event is not handled by the CLI (handled: ...)
...Z  session-end    cost recording: .../state.json is not valid JSON: JSON Parse error: Unexpected identifier "nope"
...Z  session-start  state.json could not be read: .../state.json is not valid JSON: ...
...Z  session-start  cost recording: .../state.json is not valid JSON: ...
== git status
 M .mstack/state.json
```

The gap in acceptance 1, on HEAD, store with item `demo` reviewing:

```
== healthy state, no report
exit=0 stdout=[{"hookSpecificOutput":{"hookEventName":"SubagentStop","additionalContext":"The reviewer subagent finished without writing ...] log=0
== unreadable state.json, no report
exit=0 stdout=[] log=0
== same store, session-start for comparison
session-start   state.json could not be read: ...
session-start   cost recording: ...
```

## B. Fail-open, measured (bun via `bin/mstack`, each hook a real process)

Healthy path, base `8dac2fd` against HEAD, fresh copy of the same store per side, stdout
compared byte for byte, median of 9 runs (unloaded machine):

| hook (input) | exit b/h | stdout identical | stderr b/h | log lines | base ms | head ms | added |
|---|---|---|---|---|---|---|---|
| session-start (active item, checkpoint) | 0/0 | yes (264 B) | empty/empty | 0 | 29 | 32 | 3 |
| post-edit (history.md) | 0/0 | yes (180 B) | empty/empty | 0 | 28 | 30 | 2 |
| post-edit (other file) | 0/0 | yes (0 B) | empty/empty | 0 | 29 | 30 | 1 |
| subagent-stop (reviewer, no report) | 0/0 | yes (444 B) | empty/empty | 0 | 29 | 31 | 2 |
| stop (runs the gate) | 0/0 | yes (0 B) | empty/empty | 0 | 100 | 101 | 2 |
| stop (stop_hook_active) | 0/0 | yes (0 B) | empty/empty | 0 | 28 | 31 | 2 |
| session-end | 0/0 | yes (0 B) | empty/empty | 0 | 29 | 31 | 2 |
| pre-tool-use (`git push --force`, deny) | 0/0 | yes (213 B) | empty/empty | 0 | 28 | 31 | 2 |
| pre-tool-use (`ls`) | 0/0 | yes (0 B) | empty/empty | 0 | 28 | 30 | 3 |

Failure cases, same prepared store per side. Every row: exit 0, stdout identical to base,
stderr identical to base except where the unknown-event line is the point, no stack trace,
no `.mstack/` created in the store-less repository.

| case | head stderr | log lines | base ms | head ms |
|---|---|---|---|---|
| read-only `.mstack/`, handler throws (`stop`, `{"cwd":5}`) | empty | 0 (not writable) | 28 | 31 |
| read-only `.mstack/`, unknown event | unknown-event line | 0 | 26 | 31 |
| read-only `.mstack/`, session-start on broken state | empty | 0 | 28 | 30 |
| directory at the log path, throws | empty | n/a | 29 | 30 |
| directory at the log path, session-end on broken state | empty | n/a | 28 | 31 |
| no store, each of the six hooks | empty | 0, no `.mstack/` | 27-29 | 29-32 |
| no store, unknown event / throw / empty stdin | unknown-event line / empty / empty | 0, no `.mstack/` | 27-28 | 29-31 |
| subdirectory cwd, session-start / unknown event | empty / unknown-event line | 0 / 1 (store root) | 29-30 | 30-31 |
| 1 MB `transcript_path` (ENAMETOOLONG) on session-end | empty | 2 bounded lines | 33 | 35 |
| 1 MB garbage stdin on post-edit | empty | 1 | 30 | 33 |
| 500 KB event name | unknown-event line, 196 B | 1 | 48 | 51 |
| event `=HYPERLINK("http://x")<TAB>A<LF>B` | unknown-event line, flattened | 1, three fields | 31 | 31 |
| session-start / stop, broken state.json | empty / gate failures as before | 2 / 1 | 28 / 91 | 32 / 92 |
| subagent-stop, broken state.json | empty | **0** (Changes required 1) | 27 | 31 |
| post-edit on state.json, broken | empty (nudge on stdout, as before) | 0 (correct: not hidden) | 27 | 31 |
| full disk (4 MB HFS+ image filled to 0 bytes free), unknown event / throw | unknown-event line / empty | 0, no file created | n/a | 44 / 45 |
| closed stdin (`<&-`), stop | empty | 0 | exit 0 both | |
| 20 concurrent failing hooks below the cap | | 20 of 20 | | max 57 |
| live lock holder on session-end / session-start | empty | 1 each | | 2055 / 2061 |

Added cost: 1-4 ms on every hook, healthy or failing, about 3 ms median; the worst case is
the documented 2 s `withLock` wait, under the 5 s budget. `mstack hook stop` on a 50 MB
externally grown log: 46 ms, and the log is trimmed to 200 lines.

## A. The `.git/info/exclude` edit, run on every layout

| layout | result |
|---|---|
| plain repo, store made by the `8dac2fd` CLI | one entry, `git status` clean; 30 delete-and-refail cycles still one entry |
| `git worktree add` by hand | entry in the common `.git/info/exclude`, status clean |
| `mstack worktree new demo` (origin remote) | same; `git check-ignore -v` resolves through the common exclude |
| submodule (`.git` file -> `../.git/modules/sub`) | entry in `modules/sub/info/exclude`; sub and super status clean |
| store in a subdirectory of the repo | entry at the repo root; `**/.mstack/...` matches; clean |
| `--separate-git-dir` | entry in the separate dir; clean |
| no git at all | log written, nothing else touched |
| `.git/info/` missing | created, entry written, clean |
| `.git/info/` read-only | no entry, log shows as `?? .mstack/hook-errors.log`, exit 0 |
| exclude without trailing newline | `keep-me`, `*.swp` preserved, newline added before the entry, `*.swp` still matches |
| repo with no `.mstack` | untouched |
| repo where `.mstack` is a FILE | **entry written** by an ordinary session-start |
| 20 concurrent first failures, old store | **two** entries (cosmetic) |
| per-worktree `info/exclude` | confirmed git ignores it, so the commondir branch at `src/hooklog.ts:122-123` is load-bearing |

Judgement: acceptable, and I would keep it over the alternatives. It is confined to the
repository that contains the store (the walk starts at the store root and only goes up),
writes one narrow, commented pattern into a local untracked file git already reserves for
exactly this, preserves what is there, and runs only for a store whose own `.gitignore` does
not list the log, i.e. until `mstack setup` is re-run. The alternative of letting the log show
as untracked costs a dirty `git status`, a gate warning about uncommitted changes, and the
real risk of a `git add -A` committing a machine-local file that then warns on every other
machine; a gate warning in the style of `checkReceiptIsIgnored` (`src/gate.ts:161-171`) is
the no-side-effect option and worth adding beside it, not instead. Nothing here corrupts a
file, surprises a repository without a store, or fails on a layout mstack creates. The
`.mstack`-file case is the one write in a repository with no store directory; I do not block
on it because mstack already treats such a repository as a broken store (the `8dac2fd` Stop
hook there prints "The mstack gate is red ... state.json is missing" on every turn), but the
guard should be a directory check (non-blocking note 1). `GIT_DIR` overrides are not honoured,
as the report says; the result there is a log that shows as untracked, not a wrong write.

## C. The cap

Bounded by `MAX_LINES` = 200 lines (`src/hooklog.ts:38`), each line at most 24 + 83 + 403
UTF-16 units, trimmed after every append that crosses it. Reproduced the documented loss: 200
lines seeded, 20 hooks failing at once, 16 of 20 new lines kept (twice); 2 at once, 2 of 2;
below the cap, 20 of 20. No malformed line, no `.tmp` left behind in any run. A truncated or
interleaved line cannot break the gate: `errorsSince` (`src/hooklog.ts:183-201`) skips any
line whose first field does not parse and never throws. Ran the gate on an empty log, a line
without tabs, a line cut mid-field, binary bytes, `2099\t\t`, a future timestamp, CRLF, ANSI
escapes, a line of only tabs, an unreadable (mode 000) log, a directory at the log path and a
50 MB log (109 ms): exit 0 and PASSED every time; the worst outcome is a warning reading
`newest: : .`. A SIGKILL between `writeFileSync(tmp)` and `renameSync` would leave
`hook-errors.log.<pid>.tmp`, which neither ignore rule covers; that belongs to item 66.

## D. The gate rule

By mtime of `progress/history.md` (`src/gate.ts:135-137`) against the line's own ISO stamp.
Missing `history.md`: every line counts, and the gate is red for the missing file as before.
Fresh clone: the log is not cloned, so nothing to warn about. Clock stepped back after errors:
the warning persists until a later close, never red. Empty, unreadable or malformed log: no
warning or a harmless one, never a crash. `gate --quiet`: prints nothing for a warning,
exit 0, so the Stop hook is unaffected. Gap worth knowing: anything that rewrites
`history.md` without a session close (`git checkout`, `git pull`, a rebase) resets the window
and silently marks earlier errors as read (non-blocking note 4).

## E. Every `catch` on the hook path, checked against the code

The report's tables for `src/hooks.ts` (61, 70, 110, 145, 168, 238, 564) and `src/costs.ts`
(176, 224, 234, 271, 303, 406, 546, 592, 615, 636, 670, 705, 724) match the code. What they
leave out is the callees:

| site | reached from | judgement |
|---|---|---|
| `src/state.ts:315-320` `activeItem` | subagent-stop, `src/hooks.ts:197` | **hidden failure**: the same parse error session-start now logs; the hook silently skips its report check. Changes required 1 |
| `src/roles.ts:49` `reportFiles` readdir | subagent-stop | not hidden: `[]` makes the hook say the report is missing |
| `src/roles.ts:104` `substantialReports` stat | subagent-stop | not hidden: counts as empty and the hook says so |
| `src/gate.ts:100,137,190,288,358,721` | stop (`runGate`) | not hidden: the gate reports the condition or it is expected absence |
| `src/paths.ts:136,151` | every hook (store and provenance) | identity checks whose documented safe direction is silence |
| `src/git.ts:73` | stop | a null answer the gate reports in its own terms |
| `src/tsv.ts:234-339` | cost hooks via `withLock` | lock internals; the failures that lose a row surface as `UserError` through `safely` (both ran, both logged) |
| `src/cli.ts:1155` `warnForeignCli` | every hook, before `cmdHook` | a provenance note; silent by design, acceptable |

`src/costs.ts:224` (marks line parse): I agree with leaving it silent. `prune`
(`src/costs.ts:422-454`) drops an unparseable line only when it rewrites the file, so a
per-line log would repeat on every hook until then, and the loss is one mark. Logging once
when `prune` does drop lines would be the cheap way to see it (follow-up).
`src/costs.ts:546` (last transcript line half written): expected, agree.
The `withLock` cases leave a line (run above). session-start on an unreadable `state.json`
logs two lines and still prints "No active work item": outside this item, follow-up.

## F. The lint

Scratch plugin copies of HEAD with 21 `hooks.json` variants (`scripts/f.mjs`), `./bin/mstack lint-plugin <dir>`:

| variant | result |
|---|---|
| real file | ACCEPT |
| `["hook","sesion-start"]`, `"Session-Start"`, `"session_start"`, `"xyz"`, `["hook"]`, `["hook",5]` | REFUSE, exit 1, with the handled list (and "did you mean 'session-start'" for the near misses) |
| `args` as a string, with a leading flag, `[]`, `null`; `command` inlining `hook sesion-start`; a foreign hook with no `args`; `null` entry, group without `hooks`, `null` group, event value an object, `hooks` an array or `null`, top-level array | ACCEPT, no crash |
| foreign hook `{"command":"git","args":["hook","run","pre-commit"]}` | **REFUSE**, a false positive: the check keys on `args[0] === "hook"` and not on the command being this plugin's (non-blocking note 2) |

One source: `HOOK_COMMANDS` (`src/hooklog.ts:29`) types `HANDLERS` (`src/cli.ts:1061`) and is
read by `lintHookArguments` (`src/lint.ts:274`). Mutant O15 (a name with no handler) fails
`tests/hook-errors.test.ts:219` on both runtimes and `tsc` (TS2741). Mutant O16 (a handler
with no name) passes both test runs and fails only `tsc` (TS2353); `npm run typecheck` is in
this store's verify, so `gate --full` catches it. The help text at `src/cli.ts` USAGE still
spells the six names by hand (follow-up). Separately, `hooks.json` containing `null` crashes
`lint-plugin` (`mstack: null is not an object (evaluating 'data.hooks')`) on base and head
alike: pre-existing, follow-up.

## H. Mutants

Each applied through Bash (`scripts/mut.mjs`, exact single-occurrence replacement), then
`tests/hook-errors.test.ts`, `tests/hooks.test.ts`, `tests/lint.test.ts`, `tests/gate.test.ts`
run on bun and node, then restored. Every row gave the same result on both runtimes.
`git status --short` is empty afterwards.

| id | mutation | killed by (bun = node) |
|---|---|---|
| H1 | `cmdHook` catch does not append | `hook-errors:98` |
| H2 | unknown event silent (no stderr, no log) | 9 tests, first `:191` |
| H2b | unknown event: no stderr | 4, `:191`, `:207`, `:243`, `:264` |
| H2c | unknown event: no log line | 7, first `:191` |
| H3 | drop the cap | `:329` |
| H4 | drop the gate warning | `:364`, `:389`, `:423` |
| H5 | drop the lint check | `lint:140` |
| H6 | newer-than always true | `:378`, `:389` |
| H7 | newer-than always false | `:364`, `:389`, `:423` |
| H8a | remove `if (!existsSync(storeDir)) return` | **survives**; equivalent on the CLI path, since `findStore` only returns a directory that exists, so `storeDir` is never a missing path there (rung 3) |
| H8b | remove `if (storeDir === null) return` | **survives**; equivalent: `join(null, ...)` throws inside the same try |
| H8c | no store falls back to `<cwd>/.mstack`, plus H8a | **survives**: a store-less git repository would then get `.git/info/exclude` edited and no test notices, because `:243` runs in a non-git directory. Current code is right (A, "repo with no .mstack": untouched) |
| H9 | remove the exclude edit | `:473` |
| O1 | `tolerateAbsence` never logs | **survives**: none of the 14 sites has a test for its non-ENOENT branch (Changes required 2) |
| O2 | `safely` does not log | `:116`, `:132`, `:150` |
| O3 | `activeItemOrLog` does not log | `:132` |
| O4 | exclude edited even when `.gitignore` lists the log | **survives** (needless edit for every new store) |
| O5 | worktree `commondir` not followed | **survives**: the entry would land in a file git does not read, on the layout `mstack worktree new` creates |
| O6 | exclude idempotence check removed | **survives** (duplicate entries) |
| O6b | no newline before the appended entry | **survives**: an exclude file without a trailing newline would have its last pattern merged with the comment line, i.e. the user's own pattern stops working |
| O7 | control characters kept | `:296` |
| O8 | message unbounded | `:296` |
| O9 | trim keeps the oldest | `:329` |
| O10 | warning becomes a failure | `:364`, `:389`, `:423` |
| O11 | non-JSON stdin not logged | `:173` |
| O12 | unknown event exits 1 | 10 tests |
| O13 | `isHookCommand` always true | `:191`, `:243`, `:264` |
| O14 | lint judges any `args` | survives (no test for foreign hooks) |
| O15 | name in `HOOK_COMMANDS` without a handler | `:219` and `tsc` |
| O16 | handler without a name | `tsc` only |
| O17 | `firstTimestamp` read failure not logged | survives (as O1) |
| O18 | append becomes overwrite | `:132`, `:313`, `:329` |
| O19 | warning does not name the log | `:364`, `:389`, `:423` |
| O20 | count capped at 1 | `:389` |
| O21 | missing `history.md` means nothing counts | survives (minor) |
| O22 | store resolved from `process.cwd()` only | survives (tests always spawn in the store root) |
| O23, O24, O25 | report stat / `readIfPresent` / subagent scan failure not logged | survive (as O1) |
| O26 | event field unbounded | `:296` |

## I. Tests and rules

- `tests/verification.test.ts:577-584` (`facea05`): correctly updated, not weakened. It still
  asserts the exact list of non-comment lines, so an over-broad rule still fails it; the only
  removed lines in the whole test diff are that comment and the old one-element list.
- No test deleted: `lint.test.ts` 14 -> 16, `verification.test.ts` 21 -> 21, `hook-errors.test.ts` new with 24.
- Every `mstack` process the new file starts has `timeout: 20_000` + `SIGKILL`
  (`tests/hook-errors.test.ts:44-50`) or a kill timer (`:61`). Its `git` and `chmod` calls
  (`:91`, `:284`, `:291`) have none, like the rest of the suite, which makes the header at `:26`
  ("Every test that starts a process has a timeout") overclaim (non-blocking note 5).
- Runtime rules hold: `node:` builtins only, no `Bun.` in the diff, no build step, both
  runtimes green. Scope: `src/tsv.ts`, `src/state.ts`, `hooks/hooks.json` untouched; no docs changed.
- Ledger before my row: `./bin/mstack ledger check hook-errors-leave-no-trace` -> `FAIL no
  verdict at 9f96d9b0; 1 row(s) exist at other SHAs` (the implementer's row at `66c9dc9`).

## J. Load, unmutated code at `9f96d9b`

| run | result |
|---|---|
| the four hook files (`hook-errors`, `hooks`, `lint`, `gate`), 20 times on bun and 20 times on node, the two loops running at the same time | 40 of 40 green, 134 pass 0 fail each |
| four concurrent full bun suites (`bun test ./tests`), two rounds | 7 of 8 green (432 pass); 1 failure: `tests/run.test.ts:54` (item 67) |
| four concurrent full node suites | `tests/costs.test.ts:698` failed 4 of 4 (3.9-4.2 s against its budget; item 67), `tests/run.test.ts:54` 1 of 4, and `tests/run.test.ts:239` "a SIGINT while the command is forking leaves no survivor" 2 of 4 ("run 3: children survived the Ctrl-C") |

No failure in a hook-related file. `tests/run.test.ts:239` is a third load-sensitive test not
listed in item 67; it is untouched by this diff (`tests/run.test.ts` last changed in
`b9242e9`) and exercises the command runner, not the hooks. Not a blocker here; it belongs
with item 67. No test process was left running afterwards (`ps` checked), and
`git status --short` is empty.

## Changes required

1. `src/hooks.ts:197` - subagent-stop still reads the active item through `activeItem`
   (`src/state.ts:315-320`), which swallows the `state.json` parse error. On an unreadable
   `state.json` the hook skips its whole report check, exits 0 and leaves no line (run above,
   rung 4: `exit=0 stdout=[] log=0`, while session-start on the same store logs two lines).
   That is an exception inside an mstack hook with no trace, which acceptance 1 says cannot
   happen, and it is the exact case the change already fixed for session-start
   (`src/hooks.ts:101-114`). Fix: call `activeItemOrLog(store)` there, keep the output
   unchanged, and add a test beside `tests/hook-errors.test.ts:132` that runs subagent-stop
   on an unreadable `state.json` and expects one line naming it.
2. `src/hooklog.ts:167-171` - nothing pins the branch of `tolerateAbsence` that records a
   fault. Mutant O1 (`if (code !== "__") return;`, i.e. never record) survives on both runtimes,
   so all 14 catch sites this change converted in `src/costs.ts` and `src/hooks.ts` could go
   silent again with the suite green; only the opposite direction (ENOENT stays quiet) is
   tested. The behaviour is right today (I ran it: a 1 MB `transcript_path` on session-end
   leaves two bounded `cannot stat transcript ...: ENAMETOOLONG` lines). Add one test that
   drives a real non-ENOENT fault through a hook, for example that `transcript_path`, or a
   `progress/current.md` that is a directory for session-start, and asserts the line.

## Non-blocking notes

1. `src/hooklog.ts:59` guards with `existsSync(storeDir)`, so a repository whose `.mstack`
   is a FILE gets `.git/info/exclude` edited by an ordinary session-start (ran it), and
   `keepOutOfGit` runs before the append (`:62`), so a store that cannot take the log still
   gets the exclude entry. Checking `statSync(storeDir).isDirectory()` and moving the exclude
   edit after a successful append closes both. Twenty concurrent first failures in an old store
   wrote the entry twice (cosmetic).
2. `src/lint.ts:281` refuses any hook whose `args` start with `"hook"`, including a foreign
   one (`git hook run pre-commit` was refused); key it on the command being this plugin's
   `bin/mstack`. A `command` that inlines `hook sesion-start` is accepted unjudged.
3. Exclude-path survivors O5 (worktree `commondir`), O6 (idempotence), O6b (newline before
   the entry: losing it merges the user's last pattern into the comment line) and H8c (a
   store-less git repository): the code is right today on every layout I ran, but nothing
   pins those lines, and O5 and O6b are the two ways this edit could break something outside
   the store. Worth four small tests in the same round as the two changes above.
4. `src/gate.ts:135-137`: anything that rewrites `history.md` without a close (`git checkout`,
   `git pull`, a rebase) resets the window and silently treats earlier errors as read.
   Acceptable for a warning; worth one sentence in the docstring.
5. `tests/hook-errors.test.ts:26` says every process the file starts has a timeout; the `git`
   and `chmod` calls at `:91`, `:284`, `:291` have none (the same as the rest of the suite).
6. The gate prints the newest message raw; a hand-edited log with ANSI escapes or a `\r`
   reaches the terminal as-is (lines the hooks write are flattened). An unreadable log
   produces no warning at all rather than "cannot read".

## Suggested follow-ups

- session-start on an unreadable `state.json` still tells the model "No active work item"
  (now logged; the output change is outside this item).
- A gate warning like `checkReceiptIsIgnored` (`src/gate.ts:161-171`) for a log that is not
  ignored, so an old store learns to re-run `mstack setup` without relying only on the hook's
  exclude edit.
- `src/costs.ts:422-454`: log once when `prune` drops marks lines it cannot parse.
- `hooks/hooks.json` containing `null` crashes `lint-plugin` with
  `null is not an object (evaluating 'data.hooks')`, at `8dac2fd` and at HEAD.
- The `USAGE` text in `src/cli.ts` spells the six hook names by hand; derive it from
  `HOOK_COMMANDS`.
- Add `tests/run.test.ts:239` to item 67's list (2 of 4 concurrent node suites).
- A SIGKILL inside `trim` leaves `hook-errors.log.<pid>.tmp`, which no ignore rule covers
  (item 66's family).

## Where each claim stopped on the evidence ladder

- Fail-open (exit 0, stdout and stderr byte-identical to `8dac2fd`, no `.mstack/` created,
  1-4 ms added, `withLock` cases under 2.1 s): rung 4, on real `bin/mstack` processes against
  real throwaway stores, including a full HFS+ image. Not rung 5: no Claude Code session ran
  these hooks.
- The exclude edit on the twelve layouts: rung 4, on throwaway repositories; the
  `.mstack`-file write and the duplicate entry: rung 4.
- The cap and the lost lines at the cap: rung 4 (16 of 20 kept, twice).
- The gate on malformed logs: rung 4. H8a and H8b being equivalent: rung 3 (argued from
  `findStore`, `src/paths.ts:73-81`).
- Acceptance 4: the hook counts and the cached-CLI path are rung 4 on the transcript; "the
  cached copy had no cost code" is rung 3 inference; an end-to-end session writing rows is
  unproven, as the report says.
- The subagent-stop gap: rung 4.
