# impl: shared-runner-and-closing (item 36)

## What changed

Added `src/run.ts` (`runCommand`, leaf module, capture-to-temp-file or inherit, process-group kill on timeout), `src/closing.ts` (`closingProblems`, one `CHECKS` array, first member is the verification-receipt check, including the unreadable-file fail-closed case), and `src/pathclass.ts` (`classifyPath`, hand-written `**`/`*` matcher, optional overrides). `headSha` and `defaultBranch` moved from `gate.ts` to `git.ts`; `worktree.ts` no longer imports `gate.ts`; nothing outside `src/` used them, so there is no re-export. `runVerification` runs on `runCommand` with `output: "inherit"`. The gate's "one step from done" check and `state set --status done` both call `closingProblems`. Unreadable receipts are a problem string (`isUnreadable` recognises it) that `--force` still does not override; the forced path and `FORCED_UNVERIFIED` marker are untouched. User-facing messages: only the gate's unreadable-file line gains the words ", so nothing here can say whether it was verified" (state set's message is unchanged); existing tests match unchanged. No docs quoted either line.

Deviation to know about: `detached: true` does not work in bun's `spawnSync` (verified: child pgid equals bun's own). So the group kill is done in plain sh: when `timeoutMs` is set, the command runs as a `set -m` job whose pgid is written to a temp file, and on timeout `process.kill(-pgid, SIGKILL)` is sent. Cost: under a timeout a signal-killed command reports exit 128+n and `signal: null` (the wrapper exits). Without a timeout the command is exec'd directly and code/signal are exact. Not done: `inherit` plus `timeoutMs` puts the job in a background group of the tty; nothing uses that combination yet.

## Files

- src/run.ts (new), src/closing.ts (new), src/pathclass.ts (new)
- src/git.ts, src/gate.ts, src/cli.ts, src/worktree.ts (edited)
- tests/run.test.ts, tests/closing.test.ts, tests/pathclass.test.ts (new)

## Commands

```
$ PATH=.../node/v24.14.0/bin:$PATH npm test      (exit 0; no hang this run)
 328 pass
 0 fail
Ran 328 tests across 21 files. [36.39s]          <- bun
ℹ tests 322
ℹ pass 322
ℹ fail 0
ℹ duration_ms 16279.454125                       <- node 24
$ bun run typecheck
$ bunx --bun tsc --noEmit                        (no output, exit 0)
$ ./bin/mstack lint-plugin . | tail
-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts
PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
93 relative links checked, 0 broken
```

Fail-before, A1 (src/run.ts with the capture fd swapped for `"pipe"`, the old shape; restored afterwards):

```
✖ a background grandchild holding stdout does not keep the call blocked (8012.567ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /hi/. Input:
  ''
      at TestContext.<anonymous> (file:///Users/romerma/Code/mstack/tests/run.test.ts:18:10)
ℹ pass 0
ℹ fail 1
```
(8012ms is the grandchild's `sleep 8`; the pipe call only returned when it exited.)

Fail-before, A4 (new tests/closing.test.ts copied into a worktree at base 2e975da):

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../base/src/closing.ts' imported from .../base/tests/closing.test.ts
```
This is a missing-module red, not a behavioural one: the base has no `closingProblems` to disagree with. The behavioural guard for A4 is that the pre-existing cli.test.ts (632, 806) and gate.test.ts (1158) tests pass unedited through the new path.

## R to test

| R | Test | Where |
|---|------|-------|
| A1 grandchild holding stdout returns promptly | a background grandchild holding stdout does not keep the call blocked | tests/run.test.ts:10 |
| A1 timeout returns timedOut within a bound | a timeout reports timedOut within a bound and kills the process group | tests/run.test.ts:22 |
| A1 whole process group killed | the whole group dies, not just the child | tests/run.test.ts:31 |
| A1 exit code and signal reported | exit code and signal are reported | tests/run.test.ts:40 |
| A1 tail and temp-file removal; inherit | tail keeps the last lines...; inherit returns no tail... | tests/run.test.ts:50, :63 |
| A2 runVerification on runCommand, pure refactor | every existing gate --full test, unedited (e.g. cli.test.ts:600 gate --full) | tests/cli.test.ts:595-612, tests/gate.test.ts |
| A3 git.ts owns headSha/defaultBranch; worktree no gate import | typecheck + mergegate/lifecycle suites; `rg gate src/worktree.ts` empty | tests/lifecycle.test.ts, bun run typecheck |
| A4 gate and state set agree via closingProblems | closingProblems, the gate and state set agree... | tests/closing.test.ts:19 |
| A4 unreadable file fails closed, --force does not override | an unreadable receipt file is a problem, not a throw... | tests/closing.test.ts:49, tests/cli.test.ts:794, tests/gate.test.ts:1158 |
| A4 refusal and forced close messages unchanged | an item cannot be closed on a verification that never ran here | tests/cli.test.ts:624 |
| A5 classifyPath table, tricky cases, overrides | table loop (src/testing.ts code, tests/fixtures/x.json test, nested README doc); override test | tests/pathclass.test.ts:5-43 |

Evidence rung: test-verified (suites run on bun and node 24, typecheck, lint, doc links). The A4 fail-before is the weak one, noted above.
