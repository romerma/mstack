# Review - hook-errors-leave-no-trace

**Verdict:** APPROVED

Round 2, reviewing alone, at `9adb4b9` (last code-changing commit `9b36340`). Round 2 diff judged:
`git diff 9a1f28d...HEAD -- src tests` (`4e42578`, `08910c4`, `d7f294e`, `9b36340`); whole change
re-checked where round 2 could reach it: `git diff 8dac2fd...HEAD -- src tests .mstack/.gitignore`.
Every run below is mine, made in this pass. The implementer's and the round 1 reviewer's reports
were read as claims. Scratch, scripts and raw output:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review54r2/`
(`scripts/a.mjs` blocker 1 surface, `c.sh` exclude layouts, `b.mjs` round 1 fail-open table
re-pointed, `d.mjs` concurrency, `mut.mjs` + `mutants.json` + `withmut.mjs` mutants, `load.sh`,
`load4.sh`; raw in `runs/`). Base for byte comparison: round 1's `git archive 8dac2fd` copy
(`review54/base`, every `src/*.ts` checked equal to `git show 8dac2fd:src/<f>`).

## Round 1 findings: resolved or not

| # | round 1 finding | status | evidence (mine) |
|---|---|---|---|
| B1 | `src/hooks.ts:197` subagent-stop read the item through `activeItem`, which swallows the parse error: no report check, no line | **resolved** | `src/hooks.ts:197` now `activeItemOrLog(store)` (`:107-114`). Real surface, 4 kinds of unreadable `state.json` x node and bun: exit 0, stdout and stderr byte-identical to `8dac2fd`, one `subagent-stop\tstate.json could not be read: ...` line (table A). Fix reverted (mutant B1): `tests/hook-errors.test.ts:170` (subagent-stop case) fails on bun and node |
| B2 | `src/hooklog.ts:167-171` the recording branch of `tolerateAbsence` unpinned; O1 survived | **resolved** | O1 now fails 2 tests on both runtimes (`:244`, `:265`); the opposite mutant O1x (record ENOENT too) fails 4 on both. Both tests spawn a real `bin/mstack hook session-start` and assert a line for the fault and none for the absence (B below) |
| n1 | `existsSync` guard let a `.mstack` FILE get the exclude edited; exclude edited before the append | **resolved** | `src/hooklog.ts:60` `isDirectory`, `:67` exclude after append. `.mstack` file and read-only store: exclude byte-identical on both runtimes (table C); round 1 code exactly (mutant G1e+ORDER) fails `:612` and `:627` |
| n3 | O5, O6, O6b, H8c unpinned | **resolved** (H8c: equivalent, see E) | O5 killed by `:702`, O6 by `:666`, O6b by `:683`, both runtimes; H8c with the old order killed by `:651` |
| others | lint foreign-hook false positive, `null` hooks.json, gate warning for an unignored log, session-start "No active work item", O4/O14/O17/O21-O25, two entries under concurrent first failures, line lost at the cap, test header overclaim | unchanged, non-blocking as agreed | not touched by round 2 (`git diff --numstat 9a1f28d...HEAD`: only `src/hooklog.ts` 4+/2-, `src/hooks.ts` 2+/2-, `tests/hook-errors.test.ts` 236+/0-) |

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| 1 subagent-stop on unreadable state.json leaves a line, output unchanged | `tests/hook-errors.test.ts:170` (table of all six hooks, `:155-168`) | B1 mutant red on both runtimes; O3 now fails 3 tests (`:132`, `:170` x2) |
| 1 `tolerateAbsence` records a fault, stays silent on absence | `:244` (EISDIR `current.md` vs ENOENT), `:265` (ENAMETOOLONG transcript vs missing) | O1 killed (2), O1x killed (4), O1e killed (4); O1n survives (note 1) |
| 1 exclude only with a log line, only in a store directory | `:612` (`.mstack` file), `:627` (read-only store), `:651` (no store) | ORDER killed by `:627`; G2, G1e+ORDER by `:612`+`:627`; H8c-ord by `:612`, `:627`, `:651` |
| 1 exclude details | `:666` once, `:683` newline, `:702` worktree commondir | O6, O6b, O5 killed |
| post-edit of state.json says so and does not also log | `:191` | reads as specified; not mutated (round 1 code) |
| 1, 2, 3 (round 1 coverage) | unchanged tests | H1, H2, H4 still killed on both runtimes |

## Acceptance, quoted

**"an exception inside any mstack hook appends one line (timestamp, event, message) to a bounded log under .mstack/, and the hook still exits 0 inside its time budget"** - met. Round 1's one hole is closed: subagent-stop now leaves `subagent-stop	state.json could not be read: ...` on every unreadable `state.json` I made (not JSON, mode 000, a directory, wrong shape), on node and bun, with stdout and stderr byte-identical to `8dac2fd` (table A). I read every handler and its callees for the same pattern (table "Handler audit"): no other hook turns a store failure into silence. The 14 tolerated-absence sites are now pinned in both directions (O1 and O1x killed). Exit 0 in every one of the 56 rows of A, the 24 failure rows of D, 120 concurrent hooks, and every exclude layout; slowest hook in A 129 ms (node, stop, which runs the gate), concurrent max 125 ms; added cost 2-3 ms median against base (D). Bounded: unchanged since round 1 (`:403` one bounded line, `:436` oldest dropped; both green 20 times per runtime under load).

**"mstack gate reports hook errors recorded since the last session close as a warning naming the log"** - met. Round 2 did not touch `src/gate.ts`; I re-ran the tests (green, full suite, both runtimes, and H4 still killed by 3 tests) and one live check in a throwaway store: `[warn]  2 hook errors recorded since the last session close; newest: stop: handler threw: The "paths[0]" property must be of type string, got number. Read .mstack/hook-errors.log`, `PASSED - 0 failures, 2 warnings`, exit 0; after appending to `history.md` the warning is gone (exit 0), and one new failure brings it back as `1 hook error recorded ...`.

**"mstack hook with an event the CLI does not handle says so on stderr, and lint-plugin refuses a hooks.json entry that names one"** - met. Not touched in round 2 (`src/lint.ts` and the `cmdHook` dispatch identical to `9a1f28d`). Tests re-run (H2 still kills 13 tests on both runtimes) and one live check each: `mstack hook sesion-start` prints `mstack hook: unknown event 'sesion-start'; handled: session-start, post-edit, subagent-stop, stop, session-end, pre-tool-use`, exit 0; `./bin/mstack lint-plugin` on round 1's misspelt plugin copy exits 1 with `[fail]  hooks.json: 'SessionStart' runs 'mstack hook sesion-start', and the CLI does not handle that event ... did you mean 'session-start'?`; on the copy of the real `hooks.json` (same JSON as the repo's) it passes.

**"the cause of the header-only .mstack/costs.tsv is identified with runtime evidence, or recorded as unknown together with what was tried"** - met, as round 1 found; round 2 did not touch it. One live re-check: `b5ee4aa1-47a5-426c-90f7-8e7d4724795e.jsonl` holds 169 `PreToolUse:Bash`, 126 `Stop`, 3 `SessionStart` (+2 `:compact`, 1 `:startup`) and 0 `SessionEnd` hook records, 360 mentions of `plugins/cache/mstack/mstack/0.2.1`; this repository still has no `.git/mstack/`; `.mstack/costs.tsv` is still 1 line. The unknowns round 1 named (an end-to-end `claude --plugin-dir .` session writing rows) remain unknown and stated.

## Verification I ran

```
$ ./bin/mstack gate
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full        (npm test && npm run typecheck && bin/mstack lint-plugin .)
 453 pass  0 fail  Ran 453 tests across 24 files. [68.61s]     (bun, includes the gitignored sandbox/)
ℹ tests 447  ℹ pass 447  ℹ fail 0                               (node)
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings        exit=0
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 447  ℹ pass 447  ℹ fail 0     exit=0
$ bun test ./tests
 447 pass  0 fail  Ran 447 tests across 22 files. [70.30s]     exit=0
$ ./bin/mstack ledger check hook-errors-leave-no-trace          (before my row)
FAIL no verdict at 9adb4b9b; 3 row(s) exist at other SHAs and a new head SHA voids them
```

## A. Blocker 1 on the real surface (`scripts/a.mjs`, raw `runs/a.txt`)

Throwaway store (`git init`, head `mstack setup`, item `demo` in_progress, checkpoint, a real
transcript), reset from a snapshot before every run. `state.json` broken four ways; seven hook
inputs carrying `hook_event_name`, `session_id`, `transcript_path`, `cwd`, `permission_mode`;
each run on node (`node --experimental-strip-types src/cli.ts`) and bun (`bun src/cli.ts`), head
against `8dac2fd` on the same runtime. 56 rows; every row exit 0/0, stdout identical, stderr
identical, no stack trace. Summary per hook (identical across the four breakages and both runtimes):

| hook (input) | stdout (B, node/bun) | stderr | head log lines |
|---|---|---|---|
| session-start (`source: startup`) | 248, "No active work item" as before | empty | 2, `session-start` (state read, cost recording) |
| subagent-stop (`mstack:reviewer`, `agent_transcript_path: ""`) | 0 | empty | **1, `subagent-stop	state.json could not be read: ...`** (was 0 in round 1) |
| stop (`stop_hook_active: false`) | gate red report, 305-427 | gate's own failure report, identical to base | 1, `stop` (cost recording) |
| session-end (`reason: other`) | 0 | empty | 1, `session-end` |
| post-edit (another file) | 0 | empty | 0: never reads the store |
| post-edit (`state.json` itself) | "state.json no longer validates", 256-333 | empty | 0: visible on stdout |
| pre-tool-use (`git push --force`) | deny, 213 | empty | 0: no store access |

### Handler audit (every handler, what it calls, read in `src/hooks.ts`, `src/costs.ts`, `src/roles.ts`, `src/state.ts`)

| handler | store reads | a failure becomes | verdict |
|---|---|---|---|
| session-start `:91` | `activeItemOrLog` `:118`; `readIfPresent` `:561` (tolerateAbsence); `safely(costs.onSessionStart)` -> `activeSlug` `costs.ts:317` throws | a line each | logged |
| subagent-stop `:190` | `activeItemOrLog` `:197` (fixed); `reportFiles` `roles.ts:49` and `substantialReports` `roles.ts:104` (catch -> empty); `statSync` `:237-239` (tolerateAbsence); `firstTimestamp` `costs.ts:592,615` | empty listing makes the hook say the report is missing (visible); the rest logged | no hidden failure left |
| post-edit `:159` | `parseState` only for `state.json`, catch returns the error as the nudge | stdout | visible |
| stop `:279` | `runGate` (reports the bad file); `safely(costs.onStop)` -> `activeSlug` (reached whenever `session_id` and `transcript_path` are present, i.e. every real Stop input) | stdout + a line | logged/visible |
| session-end `:304` | `safely(costs.onSessionEnd)` -> `activeSlug` after the `session_id` check | a line | logged |
| pre-tool-use `:537` | none | - | n/a |
| `activeItem` (`src/state.ts:315`) | callers left: `src/statusline.ts:350`, `src/fanout.ts:67`, neither a hook | - | out of scope |

## B. Blocker 2

`tests/hook-errors.test.ts:244` spawns `bin/mstack hook session-start` twice: `current.md` removed
(ENOENT, asserts 0 lines) then a directory at that path (EISDIR, asserts exit 0, empty stderr, the
same "No active work item" answer, exactly one line matching `\tsession-start\tcannot read .*current\.md: .*EISDIR`).
`:265` does the same for `newMark`'s `statSync` (`src/costs.ts:302`): a missing transcript gives 0
lines, a 300-character file name (ENAMETOOLONG) gives at least one `cannot stat transcript` line,
bounded to 403 characters. Both reach `tolerateAbsence` through a real hook process. Mutants:
O1 (never record) fails both tests on bun and node; O1x (record everything, ENOENT included) and
O1e (record ENOENT) each fail 4 tests on both runtimes (`:204` lock test, `:244`, `:265`, `:326`).

## C. The exclude path on real git layouts (`scripts/c.sh`, raw `runs/c.txt`)

Old stores made by the `8dac2fd` CLI (their `.gitignore` does not list the log, the case the edit
exists for). Each "failing set" is, on bun and on node: unknown event, a throwing handler
(`{"cwd":5}` to stop), non-JSON stdin, and an ENAMETOOLONG transcript on session-end.

| layout | result |
|---|---|
| `.mstack` is a FILE (committed) | failing set + all six hooks with realistic input, both runtimes: every exit 0; `.git/info/exclude` byte-identical (`cmp`); `.mstack` still the same file; status clean |
| git repository, no store | same runs: exclude byte-identical, no `.mstack` created, status clean |
| old store, `.mstack` mode 555 | exit 0 x8; no log; exclude byte-identical |
| old store, directory at the log path | exit 0 x8; exclude byte-identical |
| old store, log path a dangling symlink into a missing directory | exit 0 x8; exclude byte-identical |
| linked worktree, `git worktree add` | entry in the common `.git/info/exclude` (1), no per-worktree `info/exclude` created; `git check-ignore -v` from the worktree resolves to `<common>/info/exclude:8`; status clean in both trees |
| `./bin/mstack worktree new demo` (bare origin) | three first failures (bun and node): 1 entry in the common exclude, none per-worktree, `check-ignore` resolves, both trees clean |
| 50 sequential first failures (log deleted each time), alternating node/bun, then 50 more with the log kept | 1 entry after each batch; log 51 lines; status clean |
| exclude without trailing newline (`keep-me\n*.swp`) | file becomes exactly `keep-me␊*.swp␊# mstack: machine-local hook error log␊**/.mstack/hook-errors.log␊`; `git check-ignore` matches `a.swp`, `keep-me` and the log |
| new store (head `setup`) | exclude byte-identical: the store's own `.gitignore` covers it |
| 20 concurrent failures x3 rounds, old store (`scripts/d.mjs`) | 1 entry each round (round 1's two-entry case did not recur in 3 tries; still possible by construction) |

Did moving the edit after the append make anything worse? I ran the sequences that could show it:
- first failure in an old store: `git status --short` empty right after the hook exits, 1 entry.
- read-only store, then writable: no entry and no log while read-only; the first failure after it writes the log and the entry, status clean (round 1 code wrote the entry while no log existed).
- `.git/info` and `exclude` read-only at the first failure, writable for the second: `?? .mstack/hook-errors.log` stays visible after both, because `fresh` is false the second time. I ran the same sequence on the round 1 code (`git archive 9a1f28d`): identical outcome. Not a regression; it is round 1's known read-only-info case.
- The only new ordering window is a process killed between the `appendFileSync` and `keepOutOfGit` (microseconds); the log would then stay unignored, as above. Accepted residual, rung 3.

G1 and H8c-literal: the implementer's equivalence claim holds. Rung 3: `keepOutOfGit` is reached
only after `appendFileSync(join(storeDir, HOOK_LOG))` returns, and that open cannot succeed unless
`storeDir` resolves to a directory (a file gives ENOTDIR, a missing path ENOENT, both caught at
`src/hooklog.ts:69`). Rung 4: with G1 applied, and separately with H8c-literal applied, I re-ran
the whole of `c.sh`: every layout above gave the same result as unmutated head (0 changed
excludes, 0 non-zero exits, no `.mstack` created). The guard is redundant with the ordering, not
an unguarded reachable path: non-blocking note 2.

## D. Fail-open regression (round 1 `b.mjs` re-pointed, raw `runs/b.txt`; `d.mjs`)

Healthy path, bun, median of 9, base vs head on fresh store copies: 9 of 9 rows exit 0/0,
stdout byte-identical, stderr empty, 0 log lines; added 2-3 ms (29 -> 31/32 ms; stop with gate
101 -> 103 ms). Failure rows (24), same prepared store per side:

| case | exit b/h | stdout identical | head stderr | log lines | `.mstack` created | ms b/h |
|---|---|---|---|---|---|---|
| read-only store: throw / unknown event / session-start on broken state | 0/0 | yes | empty / unknown-event line / empty | 0 | no | 29/32, 29/31, 28/32 |
| directory at the log path: throw / session-end broken state | 0/0 | yes | empty | n/a | no | 28/32, 28/31 |
| no store, each of the six hooks, unknown event, throw, empty stdin | 0/0 | yes | empty or the unknown-event line | 0 | no | 27-30 / 29-32 |
| subdirectory cwd: session-start / unknown event | 0/0 | yes | empty / unknown-event line | 0 / 1 | no | 31/32, 30/30 |
| 1 MB `transcript_path` on session-end | 0/0 | yes | empty | 2 | no | 32/36 |
| 1 MB garbage stdin | 0/0 | yes | empty | 1 | no | 30/33 |
| 500 KB event name; event with tab, newline, `=` | 0/0 | yes | unknown-event line, 196 B / flattened | 1, three fields | no | 48/51, 29/32 |
| broken state.json: session-start / subagent-stop / stop / post-edit(state.json) | 0/0 | yes | empty / empty / gate report as before / empty | 2 / **1** / 1 / 0 | no | 28/32, 28/32, 91/93, 28/32 |

Concurrency (`d.mjs`): 20 hooks at once (half bun, half node; unknown events and throws), 3 rounds
in a head store and 3 in an old store: exit 0 for all 120, no stdout, no stack trace, 20/20 lines
every round, 0 malformed lines, status clean, max 125 ms.

## E. Mutants (`scripts/mut.mjs` on `hook-errors`, `hooks`, `lint`, `gate` tests, bun and node at once; raw `runs/mutants.txt`)

Every edit is an exact single-occurrence replacement, restored in a `finally`. Same result on both
runtimes for every row. `git status --short` empty afterwards.

| id | edit | result (bun = node) |
|---|---|---|
| B1 | `src/hooks.ts`: re-import `activeItem`; `const item = activeItemOrLog(store);\n  if (item === undefined) return null;` -> `const item = activeItem(store);...` | killed: `:170` subagent-stop |
| O1 | `if (code === "ENOENT" \|\| code === "ENOTDIR") return;` -> `if (code !== "__") return;` | killed: `:244`, `:265` |
| O1x | same line -> `if (code === "__never__") return;` (record everything) | killed (4) |
| O1e | same line -> `if (code === "ENOTDIR") return;` | killed (4) |
| O1n | same line -> `if (code === "ENOENT") return;` (ENOTDIR recorded) | **survives** (note 1) |
| O3 | `activeItemOrLog` catch does not log | killed (3) |
| ORDER | exclude edit moved back before the append | killed: `:627` |
| G2 | guard removed and ORDER | killed: `:612`, `:627` |
| G1e+ORDER | round 1 code exactly (`existsSync` guard, exclude first) | killed: `:612`, `:627` |
| G1 | `    if (!statSync(storeDir).isDirectory()) return;` removed | **survives**: equivalent (C) |
| G1e | guard -> `if (!existsSync(storeDir)) return;` | **survives**: equivalent, same argument |
| H8c-lit | `src/cli.ts` store falls back to `process.cwd() + "/.mstack"`, guard removed | **survives**: equivalent (C, re-run of every layout) |
| H8c-ord | H8c-lit plus ORDER | killed: `:612`, `:627`, `:651` |
| FRESH-T | `const fresh = !existsSync(log);` -> `const fresh = log !== "";` (exclude checked on every append) | **survives**: behaviour-neutral thanks to the idempotence check; costs two reads per failure (note 3) |
| FRESH-F | `const fresh = log === "";` (never edit) | killed (4) |
| H9 | `keepOutOfGit` returns at once | killed (4) |
| O5 | `commondir` not followed | killed: `:702` |
| O6 | idempotence check removed | killed: `:666` |
| O6b | no newline before the entry | killed: `:683` |
| H1 | `cmdHook` catch does not append | killed: `:98` |
| H2 | unknown event silent (no stderr, no log) | killed (13) |
| H4 | `checkHookErrors(store, report);` dropped | killed (3) |

## F. Tests and scope

- Nothing weakened or deleted: `git diff 9a1f28d...HEAD -- tests` has 236 added lines and no removed line; `tests/hooks.test.ts` and `tests/lint.test.ts` untouched (23 and 16 tests, as at `9a1f28d`); `tests/hook-errors.test.ts` 24 -> 34 test declarations (one is a six-case loop).
- Every new `mstack` spawn goes through `hook()` (`spawnSync`, `timeout: 20_000`, `SIGKILL`, `:42-53`). The new `git` calls (`initRepo`, `worktree add`, `check-ignore`, `status`) and `chmod` go through `execFileSync` with no timeout, like the rest of the suite (round 1 note 5, now a few more call sites). The read-only test restores the mode in `finally`; the worktree test removes both directories in `finally`; I found no stray `mstack-git-*`/`mstack-wt-*` growth issue in 40 load runs (all green).
- Scope: round 2 touched `src/hooks.ts`, `src/hooklog.ts`, `tests/hook-errors.test.ts`, and `.mstack/` bookkeeping only. `src/state.ts` untouched, as reported.
- Runtime rules (`CONTRIBUTING.md:48-54`): `node:` builtins only (`statSync` was already imported), no `Bun.` in the diff, no build step, both runtimes green.

## G. Load, unmutated code at `9adb4b9`

| run | result |
|---|---|
| `tests/hook-errors.test.ts` + `tests/hooks.test.ts`, 20 times on bun and 20 times on node, the two loops concurrently (`load.sh`) | **40 of 40 green**, 62 pass 0 fail each; 0 failures of either hook file |
| four concurrent full bun suites (`bun test ./tests`), two rounds (`load4.sh`) | 5 of 8 green (447 pass); 3 failures, all `tests/run.test.ts:54` "tail keeps the last lines of stdout and stderr, and the temp file is removed" (its tmpdir listing races with the other suites; item 67). 0 failures in a hook file |

`tests/run.test.ts:239` and `tests/costs.test.ts:698` did not fail in these runs. No test process
left running (`ps` checked); `git status --short` empty.

## Non-blocking notes

1. `src/hooklog.ts:171` - mutant O1n (only ENOENT silent, so ENOTDIR would be recorded) survives: no test drives an ENOTDIR absence through a hook. Reading the 14 sites I found no hook path where ENOTDIR is the normal case, so the cost of the mutant would be spurious gate warnings, not a failing hook. One test with a file where a parent directory should be (for example `progress` as a file for session-start's `readIfPresent`) would pin it.
2. `src/hooklog.ts:60` - the `isDirectory` guard is redundant with the append-before-exclude order (G1, G1e, H8c-lit equivalent, rung 3 plus a rung 4 re-run of every layout). Keeping it as a statement of the rule is reasonable; it costs one `stat` per failure.
3. `src/hooklog.ts:62` - `fresh` decides once, before the append, whether the exclude is ever tried; a first failure that could not edit the exclude (read-only `info/`) is never retried, so the log stays `??` until `mstack setup`. Same as round 1 (ran it on `9a1f28d`). FRESH-T (try on every append) shows the retry would be behaviour-neutral thanks to the idempotence check, at two small reads per failure.
4. `tests/hook-errors.test.ts:26` still claims every process has a timeout; round 2 adds more untimed `git`/`chmod` `execFileSync` calls (`:90-92`, `initRepo`, the worktree test).
5. Implementer's ledger row (`.mstack/ledger.tsv:111`) is keyed by the short SHA `9b36340`, where the other rows use full SHAs. Harmless here (a new head voids it anyway).

## Suggested follow-ups

- Everything round 1 queued stays queued (lint foreign hook, `null` hooks.json crash, gate warning for an unignored log, session-start "No active work item" on an unreadable state, O4/O14/O17/O21-O25, two entries under concurrent first failures, line lost at the cap, USAGE names, `prune` logging, the trim `.tmp` under SIGKILL).
- Pin O1n (note 1) and decide the `fresh` retry (note 3).
- `tests/run.test.ts:54` failed 3 of 8 concurrent bun suites here: item 67.

## Residual risks accepted

- A hook killed between the log append and the exclude edit leaves the log unignored in an old store, never retried (note 3). Microsecond window, cosmetic outcome (`??` in `git status`, fixed by `mstack setup`), never a non-zero exit or a write outside the store.
- No Claude Code session ran these hooks (rung 4, not 5), as in round 1. The inputs I used carry the fields the harness sends, and the transcript counts in acceptance 4 show which events it does send.

## Where each claim stopped on the evidence ladder

- Blocker 1 fixed, and fail-open intact for it: rung 4, real `node`/`bun` processes on throwaway stores, byte-compared with `8dac2fd`. Handler audit: rung 2-3 (read every handler and callee) backed by rung 4 for each hook in table A.
- Blocker 2 pinned: rung 4 (O1, O1x, O1e killed on both runtimes).
- Exclude path on every layout in C: rung 4 on throwaway repositories (`git init`, `git worktree add`, `mstack worktree new` with a bare origin). G1/G1e/H8c-literal equivalence: rung 3 argument plus rung 4 re-run of all layouts under each mutant.
- Added cost: rung 4, bun medians of 9; node absolute times from table A only (no node base timing).
- Load: rung 4 on this machine (40 hook-file runs, 8 concurrent full suites).
- Nothing here is rung 5.
