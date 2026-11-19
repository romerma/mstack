# mutation-run-test-dash: implementation report

Written by the coordinating session, which made the change; the review is by a pass that did not.

## What was wrong

CI run 44574734393 at `0dd6b2d` failed one test on both jobs (bun on ubuntu: 1091 pass, 1 fail;
node 22.6: 1055 pass, 1 fail): `R12 a script removed by the revert is blocked`,
`tests/mutation-run.test.ts`. The test set the obligation to `sh scripts/check.sh` and the revert
removes that script. For a script that is not there, bash (macOS's `/bin/sh`) exits 127 and dash
(ubuntu's `/bin/sh`) exits 2 with `sh: 0: cannot open scripts/check.sh: No such file`. R12 says
126 and 127 are blocked and any other non-zero code is killed, so on Linux the run was
`mutation-killed`, exit 0, and the test expected blocked, exit 2. The code follows the spec; the
fixture assumed bash.

## What changed

One test, no source change (`git diff 0dd6b2d..HEAD -- tests src`): the script is written
executable with a `#!/bin/sh` line and the obligation is `scripts/check.sh`, run by name. A
command that is not there is 127 under both shells.

Measured here: `<shell> -c 'scripts/missing.sh'` exits 127 under `/bin/dash`, `/bin/bash` and
`/bin/sh`; `<shell> scripts/missing.sh` exits 2 under dash and 127 under bash.

## The loop

`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/item104/dash-loop.sh`:
a `git archive` of `0dd6b2d` whose runner spawns `/bin/dash` and whose `PATH` starts with a
directory where `sh` is a link to `/bin/dash`. Its output:

```
== before (test at 0dd6b2d), runner on dash
  | sh: 0: cannot open scripts/check.sh: No such file
mutation-killed: `sh scripts/check.sh` failed without the change (exit 2; a build failure and an assertion failure look the same here)
(fail) R12 a script removed by the revert is blocked [1019.51ms]
 0 pass
 1 fail
ℹ pass 0
ℹ fail 1
== after (test from the working tree), runner on dash
 24 pass
 0 fail
ℹ pass 24
ℹ fail 0
```

A first version of the loop changed only the runner's shell and stayed green: the `sh` inside the
obligation was still bash. The link on `PATH` is what makes it CI's case.

In this checkout, unpatched: `bun test tests/mutation-run.test.ts` 24 pass, 0 fail; `node --test
tests/mutation-run.test.ts` pass 24, fail 0.

## Requirement to test

| R | Test | Where |
|---|------|-------|
| A1 | R12 a script removed by the revert is blocked | tests/mutation-run.test.ts:197 |
| A2 | n/a | n/a: CI is read on the pushed commit after the merge; no test file can assert it |

## Not done, and where it went

The product behaviour behind this is real and stays: an obligation written as `sh <script>` whose
script the revert removed is recorded as killed on a dash system. An exit code of 2 cannot be told
from a build failure. Item 101 carries a criterion to say so in the docs.

Not run: the whole suite with dash as `sh` (CI showed one failure per job, this one), and Linux
itself, which CI is.
