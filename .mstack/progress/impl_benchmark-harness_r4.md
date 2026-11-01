# Implementation delta - benchmark-harness (item 38, round 4)

## What changed
Scoped by decision row `review-r4`, three changes. (1) `testing/fake-claude.sh` writes its argv, one arg per line, to `$FAKE_ARGV_FILE`; `check.mjs` asserts per arm (plain, mstack-before, mstack-after) that the default has `--permission-mode auto` and no `--allowedTools`, and that `--perm allowlist` has `--allowedTools` and no `--permission-mode`/`auto`. (2) The `perm` column now comes from the init event's `permissionMode`, falling back to the flag value plus `?` (`auto?` / `allowlist?`) when there is no init event. The fake emits an init event whose `permissionMode` it derives from its own argv (`default` when no flag). A check runs a no-init fake to cover the fallback. (3) `DEFAULT_HOME` is now `/private/tmp/mstack-bench-home`. The old scratchpad `bench-home` was deleted and `versions/` rebuilt at the new path (before, after-a4e6c784...). `check.mjs` asserts the default is not under /Users/romerma, the home, or any claude scratchpad.

## Files
- sandbox/bench/testing/fake-claude.sh
- sandbox/bench/check.mjs
- sandbox/bench/run.mjs (perm column, one line)
- sandbox/bench/lib.mjs (DEFAULT_HOME)

(sandbox/ is gitignored.)

## Commands
Revert proofs ran in a scratch copy at `sandbox/bench/.scratch-r4` (no hidden tests outside sandbox/bench; deleted afterwards). Output filtered to FAIL lines.
```
== revert 1: always --allowedTools      (run.mjs:119 -> ...(["--allowedTools", ALLOW.join(" ")]))
  FAIL plain: default argv has --permission-mode auto and no --allowedTools
  FAIL plain: perm column comes from the init event's permissionMode (default)
  FAIL mstack-before: run succeeded and wrote a row
  FAIL mstack-after: run succeeded and wrote a row
  FAIL perm column is auto by default
  ...(7 FAIL lines in total, check exits non-zero)
== revert 2: drop --permission-mode auto   (["--permission-mode","auto"] -> [])
  FAIL plain: default argv has --permission-mode auto and no --allowedTools
  FAIL plain: perm column comes from the init event's permissionMode (default)
  FAIL mstack-before: run succeeded and wrote a row
  FAIL mstack-after: run succeeded and wrote a row
  FAIL perm column is auto by default
  ...(same 7 FAIL lines)
```
Note: after the first FAIL the later arms report "run succeeded and wrote a row" failures, and the script then crashes on the missing argv file. So the red is real but cascades. The two direct argv assertions are the first lines.

Real tree:
```
$ bun sandbox/bench/verify.mjs | tail -3
T6: pristine hidden 0/9 pass, reference hidden 9/9 pass, visible after patch 18/18
  T6 trace: 5 sentences, 9 tests, all mapped

all checks passed
$ bun sandbox/bench/check.mjs   (75 ok lines, 0 FAIL)
default BENCH_HOME
  ok   default BENCH_HOME is outside the home and every claude scratchpad: /private/tmp/mstack-bench-home
all harness checks passed
$ bun sandbox/bench/run.mjs --arm plain --task T1 --rep 1 --allow-dirty --dry-run
cwd:  /private/tmp/mstack-bench-home/runs/plain-T1-r1-20261101T195237Z
command: env -i <that env> /Users/romerma/.local/bin/claude -p '# Back-to-back bookings ...
dry run: claude was not invoked, no results row written
$ fd . /private/tmp/mstack-bench-home/versions -d 1
.../versions/after-a4e6c784d99536d39c132cb0d5e4d634ad34e9f2/
.../versions/before/
$ ./bin/mstack gate | tail -2
PASSED - 0 failures, 2 warnings
```
The real `claude` was never invoked with a prompt. No real run, so the real init event's `permissionMode` field is taken from the caller's description, not observed here (rung: fake-driven integration).

## R to test
| R | Test | Where |
|---|---|---|
| A1 argv recorded by the fake | `FAKE_ARGV_FILE` read back in each arm's check | sandbox/bench/testing/fake-claude.sh:5, sandbox/bench/check.mjs (end-to-end loop) |
| A2 default: `--permission-mode auto`, no `--allowedTools`, all 3 arms | "default argv has --permission-mode auto and no --allowedTools" | sandbox/bench/check.mjs (end-to-end loop) |
| A3 allowlist: `--allowedTools`, no `--permission-mode auto`, all 3 arms | "--perm allowlist passes --allowedTools and no --permission-mode auto" | sandbox/bench/check.mjs ("guards" block) |
| A4 perm from init event, `?` fallback | "perm column comes from the init event", "allowlist run reports ... (default)", "no init event: perm falls back to ... ?" | sandbox/bench/check.mjs (loop and guards block); run.mjs `perm:` row field |
| A5 BENCH_HOME default moved | "default BENCH_HOME is outside the home and every claude scratchpad" | sandbox/bench/check.mjs ("default BENCH_HOME" block, top) |
