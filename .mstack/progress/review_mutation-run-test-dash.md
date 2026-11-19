# Review - mutation-run-test-dash

**Verdict:** APPROVED

Head `145b4d6fd5a2424f9db15f4290d1803257a38c8e`, base `0dd6b2d`. The only change under `tests src` is the
R12 blocked test (`tests/mutation-run.test.ts:197-213`). Scripts and copies are in
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review104/`.

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| R12, Blocked scenario (spec.md:366-370) | `R12 a script removed by the revert is blocked`, tests/mutation-run.test.ts:197 | red under a dash stand-in at `0dd6b2d`, green at the head on bun and node; red at the head when 127 classifies as killed (`mutant.sh`) |
| R12, 127 is blocked (unit) | `R12 classify: ...`, tests/mutation-run.test.ts | also goes red under the same mutant |

## Acceptance, quoted
**"the R12 blocked test passes under a /bin/sh that is dash and under one that is bash: its obligation is a command both shells answer with 127 when the revert removed it"** - met. The obligation is `scripts/check.sh`, run by name (tests/mutation-run.test.ts:205). `dash -c` and `bash -c` both exit 127 for it once it is gone (`shells.sh` below). The test passes on macOS bash (`loop.sh`, 5 runs on each runtime) and under the dash stand-in (`dash.sh`, `wide.sh`).

**"CI is green on both jobs at the commit that carries the fix"** - not reachable from here. There is no Linux and no Docker. My evidence stops at a macOS dash stand-in, which is not rung 4 for CI. CI has to be read on the pushed commit.

## The diagnosis
It is right. The runner is `/bin/sh -c <cmd>` (src/run-helper.mjs:24, src/run.ts:81,92). `classify` makes 126 and 127 blocked and every other non-zero code failed (src/mutation-run.ts:42-47). That matches R12 (spec.md:344-351): exit 2 is killed by name in the "build failure" scenario (spec.md:357-360). The Blocked scenario itself says "and the shell exits 127" (spec.md:367).

Changing the code would be wrong. Making exit 2 blocked breaks the build-failure scenario. Reading dash's `cannot open` from stderr goes beyond R12's text. The decision row (decisions.tsv:298) weighed that and rejected it. The real product gap, `sh <removed script>` on dash being recorded as killed, is carried by item 101's docs criterion (`state show 101`, acceptance line 14).

## Is the implementer's loop fair
Yes, for this test. It replaces `"/bin/sh"` in the only two spawn sites in `src/` (`rg` found no others) and puts `sh -> /bin/dash` first on `PATH`. That reproduces both halves of ubuntu: `/bin/sh` is dash and `sh` on `PATH` is dash. Without the `PATH` link, `dash -c 'sh missing'` still exits 127 here, because macOS's `sh` is bash (`shells.sh`). So the link is what makes it CI's case.

Limits of the stand-in:
- `#!/bin/sh` shebangs still exec bash on macOS. They only touch the baseline's `exit 0` and the fake-git scripts, which are POSIX.
- It is macOS's dash build, not ubuntu's.
- Node is v26.13.1 here, while CI runs 22.6.

My own version (`dash.sh`) gives the same red and green, and the red prints exactly CI's line.

## Verification I ran
`bash shells.sh` (macOS `/bin/sh` is bash 3.2.57; `/private/var/select/sh -> /bin/bash`):
```
/bin/dash scripts/check.sh                 exit 2    | /bin/dash: 0: cannot open scripts/check.sh: No such file
/bin/bash scripts/check.sh                 exit 127  | /bin/bash: scripts/check.sh: No such file or directory
/bin/dash -c sh scripts/check.sh           exit 127  | sh: scripts/check.sh: No such file or directory   (sh on PATH = bash)
PATH=shbin:... /bin/dash -c sh scripts/check.sh  exit 2 | sh: 0: cannot open scripts/check.sh: No such file
/bin/dash -c scripts/check.sh              exit 127  | /bin/dash: 1: scripts/check.sh: not found
/bin/bash -c scripts/check.sh              exit 127  | /bin/bash: scripts/check.sh: No such file or directory
present, 0755, #!/bin/sh: dash 0, bash 0;  present, 0644: dash 126, bash 126;  dir gone too: dash 127, bash 127
```

`bash dash.sh` (git archive copies, runner on `/bin/dash`, `sh -> /bin/dash` on PATH):
```
== base (0dd6b2dc...)
-- bun
  | sh: 0: cannot open scripts/check.sh: No such file
mutation-killed: `sh scripts/check.sh` failed without the change (exit 2; a build failure and an assertion failure look the same here)
(fail) R12 a script removed by the revert is blocked [1008.39ms]
 0 pass
 1 fail
-- node
✖ R12 a script removed by the revert is blocked (1080.812333ms)
== head (145b4d6f...)
-- bun
 1 pass
 0 fail
-- node
✔ R12 a script removed by the revert is blocked (1291.002542ms)
```

`bash mutant.sh`: a copy of the head with `if (result.code === 126) return "blocked";` at src/mutation-run.ts:45, so 127 is killed:
```
(fail) R12 a script removed by the revert is blocked [1147.89ms]
(fail) R12 classify: 0 passes; 126, 127, a timeout, an error and a signal are blocked; any other code is a kill [0.87ms]
 5 pass
 2 fail
node: ✖ R12 a script removed by the revert is blocked ... actual: 0, expected: 2
```

`bash wide.sh bun|node`: every `tests/mutation-*.test.ts` plus `tests/run-async.test.ts` at the head under the dash stand-in:
```
bun:  205 pass, 2 skip, 0 fail. Ran 207 tests across 14 files. [124.71s]
node: tests 207, pass 207, fail 0
```

`bash loop.sh`, in the checkout (bun 1.3.11, node v26.13.1). Each `bun test tests/mutation-run.test.ts` run gave 24 pass and 0 fail; each `node --test` run gave pass 24 and fail 0. Five runs on each runtime, ten in total, all green. `git status --porcelain` was empty afterwards.

`./bin/mstack gate`: `PASSED - 0 failures, 0 warnings`.

I did not run `gate --full`. It records a receipt in the checkout's `verification.tsv` (tests/mutation-run.test.ts:55), which is outside the two writes this review may make there.

## Findings (non-blocking)
1. tests/mutation-run.test.ts:209 - `assert.match(text, /127/)` is the only assertion that tells this test's 127 apart from a red baseline. I ran a probe with the script written without `0o755`: the baseline exits 126 and ends `mutation-blocked: the baseline is red: ... exit 126`. Code 2, the `^mutation-blocked: ` match, the file read and `nothingLeft` all still pass, and the test fails only on `/127/`. A bare `127` can also appear inside the short sha printed in `start <sha>`. Matching `/exit 127 \(the command was not found\)/`, or asserting the `baseline: ... passed` line, would pin it. This is pre-existing, but the change made the baseline depend on the exec bit.
2. No other fixture has the bash assumption. I checked `tests/mutation-*.test.ts`, `tests/mutation-fixture.ts` and `tests/run-async.test.ts` for `source`, `[[`, `echo -e`, `$'`, `&>`, arrays and an interpreter given a file the revert removes. The only `sh <file>` obligation is `sh tests/check.sh` (mutation-fixture.ts:227, mutation-two-stores.test.ts:111), and `tests/` is never reverted. All 207 tests pass under the stand-in (above).
