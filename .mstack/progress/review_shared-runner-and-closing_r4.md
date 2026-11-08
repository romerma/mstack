# Review r4 - shared-runner-and-closing (item 36)

**Verdict:** APPROVED

Delta `7fefdd1..c152068`, code in `b9242e9`, scoped by decision `review-r4` to three changes. I did not write this code. All three hold at rung 4 on macOS (bun 1.3.11 and node 24). I did not run anything on Linux.

## 1. Signal path - fixed

src/run-helper.mjs:42-48,60-61: the signal handler records `signalExit`, clears the timeout timer and sends the first kill. The child's `exit` handler then sends the second kill and exits with 128+n.

My forking Ctrl-C probe at HEAD (1000 forks, SIGINT 30 ms after the flag, survivors checked 700 ms later):

```
bun : direct 0/3   grandchild 0/3   forking: runs with survivors 0/10, survivors 0
node: direct 0/3   grandchild 0/3   forking: runs with survivors 0/10, survivors 0
```

At round 3 the forking case was 8/10 on bun and 5/10 on node.

**The 2 s fallback timer is sound.** I SIGTERMed the helper directly:

```
bun  real helper      : helper exited after 44ms   code=143; command dead
bun  exit never comes : helper exited after 2046ms code=143; command still running
node real helper      : helper exited after 41ms   code=143; command dead
node exit never comes : helper exited after 2045ms code=143; command still running
```

"Exit never comes" is a scratch copy with the kill disabled, so the command surviving there is expected. The point is that the helper does not hang. `unref()` is harmless: the child's handle keeps the event loop alive until `exit`, so the timer either fires or `exit` wins. A repeated signal only re-arms the same timer. Because the handler clears the timeout timer, an interrupted run is never reported as a timeout.

**Red without it.** tests/run.test.ts:239:
- Second kill dropped from the signal path (`if (timedOut) killGroup()`): red on node 1/1 and bun 3/3.
- Round-3 shape restored (`process.exit` straight from the handler): red on node 1/1 and bun 3/4.

The one green mutant run is the nature of a race test with 4 runs, not a hole in it. The green side was 0/10 in my probe.

## 2. setsid doc - accurate

src/run.ts:23-27 now says a grandchild that detaches into its own session (setsid, or `spawn` with `detached: true`) is out of reach of any group kill. That matches my round-3 probe: such a grandchild survived Ctrl-C while the command itself died.

## 3. Gate wording - fixed and pinned both ways

At src/gate.ts:635, `is one step from done` appears only when `requiresVerification(status)` is true; every other status reads `cannot close as it stands`.
- Old wording everywhere: red at tests/closing.test.ts:177, the new test, which checks an `in_progress` item and rules out "one step from done".
- New wording everywhere: red at 3 tests that pin the verifying wording (closing.test.ts:20, :107, :160).

## Verification I ran

```
$ PATH=.../node/v24.14.0/bin:$PATH node --test tests/run.test.ts tests/closing.test.ts tests/gate.test.ts
ℹ tests 94
ℹ pass 94
ℹ fail 0
$ bun test tests/run.test.ts tests/closing.test.ts tests/gate.test.ts
 94 pass
 0 fail
Ran 94 tests across 3 files. [23.29s]
$ bun run typecheck
$ bunx --bun tsc --noEmit                                  exit=0
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings                            exit=0
$ ./bin/mstack ledger check shared-runner-and-closing      (before my row)
FAIL no verdict at c1520684; 7 row(s) exist at other SHAs and a new head SHA voids them
```

I did not run the full suite; the coordinator runs `gate --full` after this verdict. Recorded as `test-verified`, the rung this review reached.
