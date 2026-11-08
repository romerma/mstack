# impl r4: shared-runner-and-closing (item 36), three changes under decision review-r4

## What changed

1. `src/run-helper.mjs`: on SIGINT/SIGTERM/SIGHUP the helper records `signalExit = 128+n` in its own variable (not `timedOut`), clears the timeout, kills the group, and lets the child's `exit` handler send the second group kill and then `process.exit(signalExit)`; a 2 s unref'd timer is the fallback if `exit` never comes. 2. `src/run.ts`: the `timeoutMs` doc now says a grandchild that detaches into its own session (setsid, or `spawn` with `detached: true`) is out of reach of any group kill. 3. `src/gate.ts`: at `verifying` the gate still says "is one step from done, and ..."; at any other status where a check reports (via `reportedAt`) it says "cannot close as it stands, and ...". No existing test pinned the old text at a non-verifying status, so none was edited; I added one test for the new wording.

## Files

src/run-helper.mjs, src/run.ts, src/gate.ts, tests/run.test.ts, tests/closing.test.ts

## Probe (reviewer's forking Ctrl-C probe: 1000 forks, SIGINT 30 ms after start, 10 runs per runtime, survivors checked 700 ms later)

```
node forking Ctrl-C: runs with survivors 0/10, survivors 0
bun  forking Ctrl-C: runs with survivors 0/10, survivors 0
```
(Reviewer's numbers before: bun 8/10, node 5/10.)

## Red without the fix

Second kill removed from the signal path (`if (timedOut || signalExit !== null)` back to `if (timedOut)`), bun twice and node once:
```
AssertionError: run 0: children survived the Ctrl-C        (bun, run 1)
AssertionError: run 0: children survived the Ctrl-C        (bun, run 2)
✖ a SIGINT while the command is forking leaves no survivor (node)
```
Wording: with src/gate.ts reverted, `✖ a check reporting before verifying does not claim the item is one step from done`.

## Commands

```
node --test run closing pathclass gate cli : ℹ tests 154  ℹ pass 154  ℹ fail 0   (before the one extra closing test)
bun test same files                        : 154 pass  0 fail  Ran 154 tests across 5 files. [27.56s]
tests/closing.test.ts after the wording test: node pass 6 fail 0; bun 6 pass 0 fail
PATH=.../node/v24.14.0/bin:$PATH npm test  : bun 348 pass 0 fail, Ran 348 tests across 21 files. [44.36s]
                                             node ℹ tests 342  ℹ pass 342  ℹ fail 0   (exit 0, no hang)
bun run typecheck                          : $ bunx --bun tsc --noEmit  (no output)
./bin/mstack lint-plugin .                 : PASSED - 0 failures, 0 warnings
node scripts/check-doc-links.mjs ...       : 93 relative links checked, 0 broken
```
(The full-suite count was taken before the added wording test; that test was run alone on both runtimes afterwards, above.)

## R to test

| R | Test | Where |
|---|------|-------|
| 1 signal path leaves no survivor while forking | a SIGINT while the command is forking leaves no survivor | tests/run.test.ts:239 |
| 1 (earlier) plain Ctrl-C still kills the command | a SIGINT to the caller's group takes the timed command down with it | tests/run.test.ts:201 |
| 2 doc only | none (comment) | src/run.ts:23 |
| 3 wording true at non-verifying statuses | a check reporting before verifying does not claim the item is one step from done | tests/closing.test.ts:177 |

Rung: test-verified, bun and node 24, macOS only.
