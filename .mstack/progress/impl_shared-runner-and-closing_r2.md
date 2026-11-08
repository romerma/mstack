# impl r2: shared-runner-and-closing (item 36), response to review CHANGES_REQUESTED

## What changed

Blocker 1: `set -m` is gone. `runCommand` with a timeout now launches `src/run-helper.mjs` (node: only, plain JS) via `spawnSync(process.execPath, ...)`, so the API stays synchronous. The helper does async `spawn("/bin/sh", ["-c", cmd], {detached: true})`, owns the timer, kills `-pid` with SIGKILL, and writes `{code, signal, timedOut, error?}` to a result file. No pid file, no race, and `code`/`signal` of the command itself are exact (a direct `kill -TERM $$` now reports `signal: "SIGTERM"` under a timeout). Blocker 2: the tail is the command's output only. Blocker 3: `RunOptions` is a discriminated union (`timeoutMs` exists only with `capture`; `inherit` has `timeoutMs?: never`) plus a runtime `UserError`. Blocker 4: `closingProblems` returns `{check, message, hint, overridable}[]`; checks are `{name, reportedAt, run}` entries in an exported mutable `CLOSING_CHECKS`; `gateProblems` filters by the active item's status. The gate calls it before any verification-specific early return, and the tree fingerprint is still computed only at `verifying` with obligations and a commit. `state set --status done` runs every check, refuses a non-overridable problem always, and `--force --closed-by` overrides only overridable ones with the marker as before. Wording: while every problem is a verification one the old strings are used unchanged; otherwise `<slug> cannot close: ...`. No docs quoted those lines, so no docs changed. Blocker 5: pathclass rows added. Blocker 6: `code ?? null` everywhere, `RunResult` doc rewritten, `error` surfaced, 128+n pinned. Also `closeSync(fd)` moved to `finally`.

Note: `run.ts` now imports `UserError` from `paths.ts` (as instructed), so it is no longer a strict `node:`-only leaf. paths.ts imports git.ts, git.ts only type-imports paths, so there is no runtime cycle.

## Files

src/run.ts, src/run-helper.mjs (new), src/closing.ts, src/gate.ts, src/cli.ts, tests/run.test.ts, tests/closing.test.ts, tests/pathclass.test.ts

## Process-group evidence (both runtimes, async spawn with detached: true)

```
node parent pgid 11965 child pid 11968 child pgid 11968
group kill ok
bun parent pgid 11965 child pid 11990 child pgid 11990
group kill ok
```
The child's pgid equals its pid and differs from the parent's on both. (bun's `spawnSync` ignores `detached`; async does not.)

## Mutation reds

Helper kills `child.pid` instead of `-child.pid`:
```
✖ the whole group dies, not just the child
✖ under dash, the command leads its own process group and the whole group dies on timeout
```
Why dash is not the variable now: the group comes from `detached` (setsid-equivalent in libuv), not from shell job control, and the dash test runs the command itself under `/bin/dash -c`.

Pathclass (each applied alone, then restored):
```
P1 (* crosses /):    pass 29 fail 2  ✖ LICENSE/x.ts is code, ✖ src/a.test.dir/x.ts is code
P4 (doc before test): pass 29 fail 2  ✖ tests/README.md is test, ✖ docs/a.test.ts is test
P6 (./ not stripped): pass 30 fail 1  ✖ ./tests/a.ts is test
```

Fail-before for the reviewer's probe: the new tests/closing.test.ts against the r1 commit 7f5e67a (no `CLOSING_CHECKS`, string problems):
```
✖ closingProblems, the gate and state set agree that an unrun verification blocks closing
✖ an unreadable receipt file is a problem, not a throw, and is the one --force does not override
✖ a second closing check is seen by the gate and refused by state set, with no verification command
✖ a check that is not overridable stays closed under --force
ℹ pass 0
ℹ fail 4
```
(Red because the API changed; the behavioural probe itself was shown red against r1's gate by the reviewer: GATE exit 0, STATE SET exit 2.)

## Commands

```
$ node --test + bun test on tests/run.test.ts tests/closing.test.ts tests/pathclass.test.ts
node: ℹ tests 47  ℹ pass 47  ℹ fail 0
bun:  47 pass  0 fail  Ran 47 tests across 3 files. [4.48s]
$ PATH=.../node/v24.14.0/bin:$PATH npm test   (exit 0, no hang)
 342 pass
 0 fail
Ran 342 tests across 21 files. [39.69s]       <- bun
ℹ tests 336  ℹ pass 336  ℹ fail 0             <- node 24
$ bun run typecheck
$ bunx --bun tsc --noEmit                     (no output)
$ ./bin/mstack lint-plugin . | tail -3
[ok]    the lifecycle enum appears only in src/lifecycle.ts
PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
93 relative links checked, 0 broken
```

## R to test

| R | Test | Where |
|---|------|-------|
| A1 grandchild cannot block | a background grandchild holding stdout... | tests/run.test.ts:13 |
| A1 timeout returns, timedOut, code null, SIGKILL | a timeout reports timedOut within a bound... | tests/run.test.ts:25 |
| A1 whole group killed | the whole group dies, not just the child | tests/run.test.ts:35 |
| A1 group killed under dash; group exists and is not ours | under dash...; a timed command runs in a process group that is not ours | tests/run.test.ts:81, :94 |
| A1 clean tail under timeout | the tail of a timed run is only the command's output | tests/run.test.ts:101 |
| A1 inherit + timeout refused | inherit with a timeout is refused | tests/run.test.ts:111 |
| A1 code/signal; 128+n pinned | exit code and signal are reported; a signal that ends the shell itself... | tests/run.test.ts:44, :116 |
| A1 spawn failure gives null code and error | a command that cannot start... | tests/run.test.ts:123 |
| A2 runVerification on runCommand | existing gate --full tests, unedited | tests/cli.test.ts, tests/gate.test.ts |
| A3 git.ts / worktree | typecheck, lifecycle and mergegate suites | bun run typecheck |
| A4 gate and state set agree | closingProblems, the gate and state set agree... | tests/closing.test.ts:19 |
| A4 unreadable non-overridable | an unreadable receipt file is a problem... | tests/closing.test.ts:49 |
| A4 second check seen by gate, refused by state set, forceable only if overridable | a second closing check is seen...; a check that is not overridable stays closed | tests/closing.test.ts:107, :144 |
| A5 table incl. three new rows | table loop | tests/pathclass.test.ts:5-37 |

Rung: test-verified (both runtimes; dash behaviour exercised by running the command under /bin/dash on macOS, not on ubuntu itself).
