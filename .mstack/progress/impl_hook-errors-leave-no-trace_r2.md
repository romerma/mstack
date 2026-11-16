# Implementation report, round 2 - hook-errors-leave-no-trace

Round 2 after CHANGES_REQUESTED. Branch `fix/hook-errors-leave-no-trace`, started at `9a1f28d`,
last code-changing commit `9b36340`. Scratch (repro, mutant harness, raw output) under
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl54r2/`.

## What changed

Blocker 1: `subagentStop` now reads the active item through `activeItemOrLog`, so an unreadable
`state.json` leaves a `subagent-stop` line; its output is unchanged (still nothing). Blocker 2:
two tests drive real non-absence faults through real hooks (a `current.md` that is a directory
for session-start, an ENAMETOOLONG transcript path for the cost mark) and their plain-absence
twins, so `tolerateAbsence` can no longer go silent with the suite green. Exclude path:
`appendHookError` requires `statSync(storeDir).isDirectory()`, and the `.git/info/exclude` edit
now runs only after the log line was appended. Four pinning tests cover the commondir, the
idempotence, the newline and the store-less repository. `src/state.ts` was not touched.

## Files

- `src/hooks.ts` (subagent-stop call, unused `activeItem` import dropped)
- `src/hooklog.ts` (directory guard, exclude after append)
- `tests/hook-errors.test.ts` (all tests; `tests/hooks.test.ts` unchanged)
- `.mstack/progress/current.md`, this report, ledger row

Commits: `4e42578` red tests, `08910c4` fix (green), `d7f294e` blocker 2 tests (pin existing
behaviour), `9b36340` exclude pinning tests (pin existing behaviour).

## Reproduction of blocker 1 (throwaway stores, `repro.sh`, six hooks by hand, `state.json` = `{ nope`)

Before (head `9a1f28d` code; raw in `before.txt`; the stop input there had no `transcript_path`):

```
session-start exit=0 stdout=[{"hookSpecificOutput":{"hookEventName":"SessionStart",...] log=2
post-edit exit=0 stdout=[] log=0
subagent-stop exit=0 stdout=[] log=0
stop exit=0 stdout=[{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The...] log=0
session-end exit=0 stdout=[] log=1
pre-tool-use exit=0 stdout=[] log=0
```

After (`after.txt`, stop input now carries a `transcript_path`, as the harness sends one):

```
session-start exit=0 stdout=[{"hookSpecificOutput":{"hookEventName":"SessionStart",...] log=2
session-start	state.json could not be read: ...
session-start	cost recording: ...
post-edit exit=0 stdout=[] log=0
subagent-stop exit=0 stdout=[] log=1
subagent-stop	state.json could not be read: ...
stop exit=0 stdout=[{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The...] log=1
stop	cost recording: ...
session-end exit=0 stdout=[] log=1
session-end	cost recording: ...
pre-tool-use exit=0 stdout=[] log=0
```

stdout is identical before and after for every hook. `post-edit` is 0 on purpose: for another
file it never reads the store, and for `state.json` itself it prints "state.json no longer
validates" (not hidden, test at `:191`). `stop` on the unreadable file also prints the gate's red
report on stdout and its own failure on stderr, as before.

## Every hook handler checked for the blocker 1 pattern (`activeItem`, `parseState` in a bare catch, helper that turns a failure into "nothing")

| handler | reads the store through | verdict |
|---|---|---|
| `session-start` (`src/hooks.ts:91`) | `activeItemOrLog` (`:118`), `costs.onSessionStart` inside `safely` | already logged (round 1) |
| `subagent-stop` (`:190`) | was `activeItem`; now `activeItemOrLog` (`:197`) | **the one hit, fixed** |
| `post-edit` (`:159`) | `parseState` only when the edited file is `state.json`; its catch returns the error text as the nudge | visible on stdout, not hidden |
| `stop` (`:279`) | `runGate` (reports the unparseable file as a failure), `costs.onStop` inside `safely` (`activeSlug` -> `parseState` throws -> logged) | not hidden |
| `session-end` (`:304`) | `costs.onSessionEnd` inside `safely` | logged |
| `pre-tool-use` (`:537`) | no store access | n/a |
| callees | `activeItem` has no other caller under `src/` hooks path (`rg` for `activeItem\b`: the definition and the doc comment at `:102`); `roles.ts:49,104` count as empty and the hook says so; `paths.ts:136,151` identity checks (round 1) | none hidden |

Other handlers with the blocker 1 pattern: **0**.

## Findings answered

| finding | reproduced | what I did | test |
|---|---|---|---|
| B1 subagent-stop silent on unreadable state.json | yes (`before.txt`: `subagent-stop ... log=0`) | `activeItemOrLog` at `src/hooks.ts:197` | `tests/hook-errors.test.ts:170` (table, one test per hook; `subagent-stop` case red in `4e42578`, green in `08910c4`) |
| B1 "every other hook" | yes, checked above | no other hit | `:170` covers all six, `:191` post-edit of state.json |
| B2 `tolerateAbsence` fault branch unpinned (O1) | yes (O1 survived in round 1) | tests, no code change | `:244` (EISDIR on `current.md`, ENOENT silent), `:265` (ENAMETOOLONG transcript logs, missing transcript silent) |
| X1 `.mstack` as a file gets the exclude edited | yes (round 1) | `statSync(...).isDirectory()` at `src/hooklog.ts:60` | `:612` (exit 0, exclude byte-identical, red in `4e42578`) |
| X2 exclude before append | yes (round 1) | exclude edit moved after the append (`src/hooklog.ts:67`) | `:627` (read-only store, exclude byte-identical, red in `4e42578`) |
| O5 commondir | yes (survived) | pinned | `:702` (real `git worktree add`; entry in common exclude; `git check-ignore` from the worktree) |
| O6 idempotence | yes | pinned | `:666` (three "first" failures, one entry) |
| O6b newline | yes | pinned | `:683` (exact bytes, user's `*.swp` still matches) |
| H8c store-less git repository | yes | pinned; see the mutant note | `:651` |

## Commands and results

```
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 447   ℹ pass 447   ℹ fail 0
$ bun test ./tests
 447 pass   0 fail   Ran 447 tests across 22 files. [69.67s]
$ bunx --bun tsc --noEmit            -> no output, exit 0
$ ./bin/mstack lint-plugin .         -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate                  -> PASSED - 0 failures, 0 warnings  (before work)
```

Load: `tests/hook-errors.test.ts` + `tests/hooks.test.ts`, 20 runs on node (`ℹ fail 0` x20) and 20 on
bun (`0 fail` x20), unmutated code. No failure. The three known load-sensitive tests did not fail
in the full runs.

## Mutants (each applied by exact single-occurrence replacement, run on `hook-errors`, `hooks`, `lint`, `gate` tests under bun and node, restored; `git status --short` clean afterwards; harness `mut.mjs`, raw `mut.txt`)

| id | mutation | bun | node | killed by |
|---|---|---|---|---|
| B1 | revert blocker 1 (inline swallowing catch in subagent-stop) | killed | killed | `:170` subagent-stop case |
| O1 | `tolerateAbsence` never records | killed | killed | `:244`, `:265` |
| O5 | worktree `commondir` not followed | killed | killed | `:702` |
| O6 | no idempotence check | killed | killed | `:666` |
| O6b | no newline before the entry | killed | killed | `:683` |
| ORDER | exclude edit before the append | killed | killed | `:627` |
| G2 | no directory guard AND exclude before append | killed | killed | `:612`, `:627` |
| H8c-full | store falls back to `<cwd>/.mstack`, no guard, store dir created, exclude before append | killed (5) | killed (5) | `:350`, `:612`, `:627`, `:651` (5 failing in all) |
| R1 | remove the append in the handler catch | killed | killed | `:98` |
| R2 | unknown event silent | killed (13) | killed (13) | `:298` first |
| R3 | drop the gate warning | killed (3) | killed (3) | `:471`, `:496`, `:530` |
| G1 | remove the directory guard alone | **survives** | **survives** | none |
| H8c-literal | store falls back to `<cwd>/.mstack`, directory guard removed | **survives** | **survives** | none |

G1 and H8c-literal survive because they are equivalent now, not because of a missing test:
with the exclude edit after the append, a store path that is a file or does not exist makes
`appendFileSync` throw (ENOTDIR / ENOENT) before the exclude is reached, so the output is the
same with or without the guard (rung 4 for the run, rung 3 for the argument). I kept the guard:
it was asked for, it states the rule where a reader looks for it, and it costs one `stat`. The
behaviour is pinned by `:612` and `:651`, and the three layers (store resolution, guard,
append-before-exclude) are each killed only when all are removed (G2, H8c-full). This is the
one place I chose "keep the code" over "remove the code no test can distinguish"; say if you
prefer the guard deleted.

## Acceptance to test

| acceptance | test (`tests/hook-errors.test.ts`) |
|---|---|
| 1 exception in any hook leaves one line, exit 0, inside budget | `:98`, `:116`, `:132`, `:170` (six hooks), `:204` (lock, `< 5 s`), `:227`, `:244`, `:265`, `:728` |
| 1 never dirties git / exclude path | `:567`, `:580`, `:612`, `:627`, `:651`, `:666`, `:683`, `:702` |
| 1 bounded, log failures silent | `:371`, `:388`, `:403`, `:420`, `:436`, `:739` |
| 2 gate warning names the log | `:471`, `:485`, `:496`, `:517`, `:530` |
| 3 unknown event on stderr, lint refuses | `:298`, `:314`, `:326`; `tests/lint.test.ts` (unchanged) |
| 4 costs.tsv cause | round 1 report (unchanged, not re-run) |

## Where the claims stopped on the ladder

Blocker 1, blocker 2 and the exclude cases: rung 4, real `bin/mstack` processes against throwaway
repositories (`git init`, `git worktree add`). Not rung 5: no Claude Code session ran the hooks.
G1 and H8c-literal equivalence: rung 4 plus a rung 3 argument. Ledger row: `test-verified`.

## Left undone (queued by the reviewer as follow-ups, untouched on purpose)

O4, O14, O17, O21, O22, O23-O25 survivors; the lint's foreign-hook false positive; `null`
hooks.json crash; gate warning for a non-ignored log; `tests/hook-errors.test.ts:26` header
overclaim (the new `git`/`chmod` calls also have no timeout, like the rest of the suite).
