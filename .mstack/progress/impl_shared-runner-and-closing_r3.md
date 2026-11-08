# impl r3: shared-runner-and-closing (item 36), six changes under decision review-r3

## What changed

1. `src/run-helper.mjs`: after the timeout kill, the `exit` handler sends the group kill again (a child mid-fork is born into the group after the first signal). 2. `src/run.ts`: the helper is started with `cwd: dir` (the temp dir) and gets the target cwd as an argument, so bun no longer loads the target's `bunfig.toml` / `.env`. 3. `timeoutMs` must be an integer in [1, 2^31-1], else `TypeError`. 4. The helper handles SIGINT, SIGTERM, SIGHUP: kills the group, exits 128+n. 5. `gateProblems` reports every check at `verifying` (`requiresVerification`), `reportedAt` only adds earlier statuses; doc on the field updated. 6. `run.ts` throws `TypeError` (inherit+timeout, bad timeout) and imports only `node:` again. Nothing else was changed.

## Files

src/run.ts, src/run-helper.mjs, src/closing.ts, tests/run.test.ts, tests/closing.test.ts

## Probe output (reviewer's fork-heavy command, 400 forks, timeoutMs 40, 10 runs, same probe after the fix)

```
node runs with survivors: 0/10
bun runs with survivors: 0/10
```
(Reviewer's numbers before the fix: bun 4/10, node 7/10.) The suite carries a 5-run version.

## Mutation reds (one per change, each applied alone then restored; files diffed identical afterwards)

```
1 remove the second killGroup (bun, 3 runs):  AssertionError: children survived the timeout   (fail) a timeout kills children that are being forked at that moment   x3
2 cwd: dir -> options.cwd (bun):               (fail) the timed path does not load the target directory's bunfig.toml or .env  (Expected values to be strictly equal)
3 validation removed:                          ✖ timeoutMs must be an integer from 1 to 2^31-1; anything else throws
4 signal handlers disabled (node and bun):     ✖ a SIGINT to the caller's group takes the timed command down with it ; "the command outlived the Ctrl-C"
5 drop `atTheDoor ||` in gateProblems:         ✖ at verifying the gate reports every check, whatever its reportedAt says
6 src/run.ts imports: only node:child_process, node:fs, node:os, node:path, node:url
```

## Commands

```
node --test run closing pathclass gate cli : ℹ tests 153  ℹ pass 153  ℹ fail 0
bun test  same files                       : 153 pass  0 fail  Ran 153 tests across 5 files. [24.43s]
PATH=.../node/v24.14.0/bin:$PATH npm test  : bun 347 pass 0 fail, Ran 347 tests across 21 files. [41.21s]
                                             node ℹ tests 341  ℹ pass 341  ℹ fail 0   (exit 0)
bun run typecheck                          : $ bunx --bun tsc --noEmit   (no output)
./bin/mstack lint-plugin .                 : PASSED - 0 failures, 0 warnings
node scripts/check-doc-links.mjs ...       : 93 relative links checked, 0 broken
```

Hang: the first full `npm test` stalled for 5+ minutes in the node phase, in tests/launcher.test.ts, on a `bun src/cli.ts statusline` child (the known intermittent hang, item 21 family; I did not diagnose it). I killed it and reran; the rerun was green with no hang. Not shown to be unrelated to this change beyond that the rerun passed.

## R to test

| R | Test | Where |
|---|------|-------|
| 1 fork race leaves no survivor | a timeout kills children that are being forked at that moment | tests/run.test.ts:154 |
| 2 no bunfig/.env from target dir in timed path | the timed path does not load the target directory's bunfig.toml or .env | tests/run.test.ts:180 |
| 3 timeoutMs validated (NaN, Infinity, -5, 0, 1.5, 2^31 throw; 2^31-1 ok) | timeoutMs must be an integer from 1 to 2^31-1... | tests/run.test.ts:132 |
| 4 Ctrl-C kills the detached command | a SIGINT to the caller's group takes the timed command down with it | tests/run.test.ts:201 |
| 5 gate reports every check at verifying; gate and state set agree | at verifying the gate reports every check, whatever its reportedAt says | tests/closing.test.ts:160 |
| 6 TypeError, node:-only imports | inherit with a timeout is refused (TypeError) | tests/run.test.ts:111 |

Rung: test-verified, on bun and node 24, macOS only (no Linux run).
