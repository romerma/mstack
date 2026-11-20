# Review - mutation-test-pins

**Verdict:** APPROVED

Item 102, round 2, head `d10504017fd23b9b39e111472a3145831523e901`, base `113e784`, round 1 at `69e6c04`. Scope: the
diff `69e6c04..HEAD` over `tests/` and `.mstack/specs/`. Both blocking findings of round 1 are closed, the sweep is
mechanical, and nothing failed on the head in 748 test-file runs under load. No blocking finding; three
non-blocking. `S` = `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review102r2/`;
every run below was in a `git archive` copy under `S`, and nothing of the mechanism ran in the checkout.

## 1. The 900 s pin (round 1 blocking 1): closed

`S/scripts/mut900.sh`, `S/out/mut900.txt`. The new test is `tests/mutation-cli.test.ts:361`, and its assertions are
at `:373-374`. I rebuilt both mutants in copies of the head with `sd` on `src/cli.ts:219`. I ran the named test
in four configurations: bun; node 26 with bun on PATH (the CLI child is then bun, as in CI's test job); node 26
with no bun; node 22.6 with no bun (as in CI's oldest-node job).

```
head  DEFAULT_TIMEOUT_S = 900  GREEN GREEN GREEN GREEN
n     = 9                      RED   RED   RED   RED    the helper was given 9000 (2 of 2 lines)
n2    = 60                     RED   RED   RED   RED    the helper was given 60000 (2 of 2 lines)
```

Each RED is the `:374` `assert.match`. At the head the helper's line reads (`S/out/probe-tree-*.log`, both runtimes):
`run-helper.mjs <T>/mstack-run-JvLFjZ/result.json 900000 /private<T>/mstack-test-5QS1CV ...`, once for the baseline
and once for the reverted run.

**Ubuntu with procps and dash, bun and node 22.6.** I reasoned it through and probed what this machine has. I ran
nothing on Linux.

- **What `$PPID` is.** dash(1) here (`/usr/share/man/man1/dash.1`) says: "PPID The process ID of the parent
  process of the shell." bash(1) says: "PPID The process ID of the shell's parent. This variable is readonly."
  The `-c` shell sets it once, at start, from its parent. `"$PPID"` is expanded by that shell before `ps` is
  started. In the obligation, `ps` is not the last command, because `; ${r.command}` follows it, so the shell
  forks it. If `ps` were last and exec'd, as this machine's dash does for a `-c` string's last simple command
  (`dash -c 'echo ...; ps -o pid=,ppid=,args= -p $$'` printed `ps` under the shell's own pid), `ps` would be the
  helper's direct child and `$PPID` would already be the helper's pid. The answer is the same either way.
- **Whether the helper can be a grandparent.** The helper spawns `/bin/sh` itself
  (`spawn("/bin/sh", ["-c", cmd], { cwd, detached: true, ... })`, `src/run-helper.mjs:24`). The run spawns the
  helper through `runCommandAsync` only (`src/mutation-run.ts:282`, `:391` -> `src/run.ts:154`, `process.execPath`
  directly). `detached` is `setsid` in the child. setsid(2) here says: "The calling process is the session leader
  of the new session, is the process group leader of a new process group". So it changes the group and the
  session, not the parent. Measured (`S/scripts/probe-ps.sh`, `S/out/probe-ps.txt`): sh pid 38311, ppid 38310,
  pgid 38311; the helper 38310, ppid 38274, pgid 38310; 38274 is the CLI (`bun .../src/cli.ts verify
  --mutation`). On ubuntu `/bin/sh` is a link to the dash binary, so no wrapper sits in between. Neither libuv nor
  bun double-forks for `detached`. That last point is from my knowledge of both, not from a source I could open
  here.
- **procps.** It has no man page on this machine (`man -w ps` is BSD's), so I cannot quote it. BSD's says of
  `-w`: "If the -w option is specified more than once, ps will use as many columns as necessary without regard
  for your window size. When output is not to a terminal, an unlimited number of columns are always used." For
  procps I rely, unverified, on `-ww` being unlimited width and on an all-empty `-o` header printing no header
  line. The second of these is already exercised on CI by older tests: `tests/run.test.ts:110` parses `ps -o
  pgid= -p $$`, and `tests/mutation-lock.test.ts:222` needs `ps -o etime= -p` to parse, or `liveness` answers
  "running" and the test fails. If main's CI is green, procps does both there. I could not check CI from here.
- **The pattern** `/run-helper\.mjs .*\/result\.json 900000 /` starts after the interpreter, so the path of bun
  or node does not matter. `.*` takes any directory, including one with a space: the spaced copies ran it, and
  the load table below has them. The trailing space separates `900000` from the cwd argument, which always follows
  (argv `<result> <timeout ms> <cwd> <cmd> watch-parent <pid>`, `src/run-helper.mjs:10`). Both ps implementations
  join argv with single spaces, and no quoting is involved.
- **ps missing, silent or truncating** (fake `ps` first on PATH, `S/out/probe-ps.txt`). In each case the test is
  RED on bun and on node, and it never passes vacuously:

  ```
  missing  (stderr "ps: not found", exit 127)   bun exit=1  node exit=1   :373 lines.length 0 != 2
  empty    (no output, exit 1)                  bun exit=1  node exit=1   :373
  trunc80  (/bin/ps "$@" | cut -c1-80)          bun exit=1  node exit=1   :374 (the line is cut before 900000)
  ```

  A vacuous pass would need two lines that carry `result.json 900000 ` after `run-helper.mjs`. Only the
  helper's own argv has that, and `-p "$PPID"` reads one process. The failure message for a missing `ps` is
  bare, though (non-blocking 1).

**Residual risk:** a procps that rendered `args` differently, by width or by escaping, would turn this test red on
ubuntu with a correct head; nothing I found makes it pass on a broken default, and the parentage and `$PPID`
semantics are the same there as here.

## 2. The sweep (round 1 blocking 2): mechanical, complete, honoured

`S/scripts/sweep-check.mjs` parses both versions of all 15 `tests/mutation-*.test.ts` files and
`tests/run-async.test.ts`. It also checks multi-line call heads. `S/scripts/sweep-lines.sh` checks the line
numbers. Output is in `S/out/sweep-check.txt` and `S/out/sweep-lines.txt`.

- **Declarations, names and order.** 235 declarations before and 235 after (`test`, `userTest`, `caseTest`,
  `nodeOnly`, `caseSensitiveTest`). In every file the names and order are equal, and the line moved count is 0.
  The only rename is the rewritten `cli:361`.
- **Every changed line.** Each changed line pairs by index (equal line counts everywhere but `mutation-cli`) and
  is one of these:
  - `, SPAWN_TEST` added on a declaration line (140);
  - `...SPAWN_TEST, ` spread into an existing options object (2, `lock:279`, `:320`);
  - `SPAWN_TEST` added to the fixture import (gate, revert);
  - `import { SPAWN_TEST } from "./mutation-fixture.ts";` on the blank line after the imports (hook, refusals,
    set, shapes).

  There are no other changed lines.
- **mutation-cli.** Its two hunks are the helpers import (`recordReceipt` dropped, used only by the old test) and
  `:358-377`, the rewritten last test, which grew by 3 lines.
- **numstat.** Insertions equal deletions in every other file.
- **The report's list.** The 142 lines by file (`impl_mutation-test-pins.md:87-96`) match the changed declaration
  lines exactly, file for file.

**Did it miss any?** One declaration in the swept files has no timeout option: `tests/mutation-run.test.ts:400`
(`R12 classify`). It calls `classify` on plain objects. Starting a process was checked dynamically, not only by
reading. `S/scripts/spawn-trace.mjs` is a `node --import` preload. It wraps `node:test`'s `test` and every
`child_process` function (with `syncBuiltinESMExports`). An `AsyncLocalStorage` scope records which declaration's
body started each process. I ran all 59 test files under it (`S/scripts/trace.sh`, `S/out/trace-summary.txt`):

```
swept files: 237 tests at run time (235 declarations; the template at exits:688 makes 3), 1 skipped here
  (exits' caseSensitiveTest on a case-insensitive disk); 235 start a process, and all 235 have a timeout option;
  1 has none and starts none: mutation-run.test.ts:400 spawned=0 R12 classify
```

The same trace at `69e6c04` (`S/scripts/trace-base.sh`, `S/out/trace-base.txt`) finds 142 process-starting tests
with no timeout option, file for file the sweep's counts (exits 14, gate 10, hook 10, lock 16, refusals 21, restore
23, revert 16, set 14, shapes 13, run-async 5). At the head there are 0. This confirms the implementer's account.

**The option on both runtimes** (`S/probe/timeout.test.ts`, `S/out/timeout-probe.txt`):

```
bun 1.3.11 --timeout 1000: { timeout: 1 } async FAIL, sync spawnSync FAIL, { ...{ timeout: 1 }, skip: false } FAIL;
                           1.5 s async/sync with { timeout: 90_000 } and { ...SPAWN_TEST, skip: false } pass,
                           the same with no option FAIL "timed out after 1000ms"
node 26.13.1, 24.14.0, 22.6.0: { timeout: 1 } async: cancelled 'test timed out after 1ms', exit 1;
                           { timeout: 1 } on a sync spawnSync body: passes (312 ms)
```

On bun, the option governs sync and async bodies alike and overrides `--timeout`, which is what the sweep needs.
Node honours it on async bodies. It cannot pre-empt a sync body, so there it is inert. That is harmless: node has
no default bound to raise, and an inert bound cannot fail a correct head.

**Outside the swept files** (older than this item, for a follow-up, not blocking). Same trace, node 26 on this
machine; a test that branches on the runtime or the platform may count differently elsewhere. In the other 44
files, **704 of 916 tests start a process, and 436 of those have no timeout option**, in 19 files:

| File | Untimed | File | Untimed | File | Untimed |
|---|---|---|---|---|---|
| gate | 77 | ledger | 50 | state-cli | 39 |
| hook-errors | 38 | statusline | 32 | cli | 30 |
| costs | 30 | decisions | 23 | verification | 21 |
| run | 16 | hooks | 15 | fanout | 14 |
| closing | 13 | provenance | 12 | seams | 11 |
| state | 5 | launcher | 5 | mergegate | 3 |
| ledger-cli | 2 | | | | |

## 3. Flakiness on the new head: none

`S/scripts/load.sh`, counted by `S/scripts/load-count.mjs` (`S/out/load-count.txt`; logs `S/out/load/logs/`). Each
loop ran in its own copy with its own empty `HOME` and `TMPDIR`:

- bun: 6 loops of 5 iterations;
- node: 6 loops of 5 iterations, 3 on node 24 with bun on PATH (CI's test job) and 3 on node 22.6 with no bun
  (CI's oldest-node job);
- 4 more loops of 2 iterations alongside: dash and spaced, each on bun and on node 24.

All 16 loops ran at once on 18 cores.

```
bun:   330 runs, 0 failed | each of the 11 files 0/30
node:  330 runs, 0 failed | each of the 11 files 0/30 (15 runs per file on node 24 + bun on PATH, 15 on node 22.6 no bun)
dash-bun 22, dash-node 22, space-bun 22, space-node 22: 0 failed (each file 0/2)
all: 748 runs, 0 failed; 1-min load at run starts: min 7.56 (the first sample), median 26.3, max 33.02, 18 cores;
     11:49:24 to 12:08:42; logs that name a failure, a timeout or a cancel: 0
```

That makes 34 runs of each file per runtime (30 asked for), 374 per runtime. The same eleven files also ran once
more in each of two configurations, both 181 pass, 1 skipped, 0 fail, with every file exiting 0:

- dash with node 22.6 and no bun, which is CI's oldest-node job with dash (`S/out/oldest-dash.txt`);
- the spaced copy on node 22.6 (`S/out/oldest-space.txt`).

In the dash copy, the 900 s test alone ran 10 of 10 green on node 22.6 with no bun and 10 of 10 on bun
(`S/out/ps-dash-repeat.txt`).

**The option governs** (`S/scripts/bound-probe.sh`, `S/out/bound-probe.txt`, bun `--timeout 1000`, load 27):

```
69e6c04 exits:268 (A2)   exit=1 killed 1 dangling process [1022.06ms] timed out after 1000ms
69e6c04 exits:720        exit=1 killed 1 dangling process [1044.68ms] timed out after 1000ms
69e6c04 cli:361 (old)    exit=0 1 pass [12.21s]   (it already had SPAWN_TEST)
head    exits:268 (A2)   exit=0 1 pass [4.10s]
head    exits:720        exit=0 1 pass [3.77s]
head    cli:361          exit=0 1 pass [2.74s]
```

Under that load A2 took 4.10 s, near bun's 5000 ms default; round 1's two failures were at 5018 and 5065 ms.

## 4. The ceiling above the store, for a follow-up (not a finding)

`S/scripts/ceil.sh`, `S/out/ceil.txt`. The fixture had stores at pkg/a and pkg/b. A real `verify --mutation` in A
was SIGKILLed on the reverted tree, `rootFromTop` was edited to pkg/b, and the commands ran with
`GIT_CEILING_DIRECTORIES=<top>/pkg`:

```
from B: restore exit 0 "mutation: nothing to restore: the store is not in a git repository" | gate --quiet exit 0,
        no line | R1 exit 2 "refused: the store is not in a git repository" | hook: no output (allows git commit) |
        git rev-parse --git-dir exit 128 | lock present, unchanged; A's x.js OLD
from A: the same (restore 0, gate 0)
without the ceiling: restore 2 (the root refusal), gate 1 (the lock), R1 2, hook denies
the edit undone, under the ceiling: restore exit 0 "nothing to restore", gate 0, lock present, A OLD
the edit undone, no ceiling: restored 1, tree verified, lock removed; A NEW
```

The implementer's account holds, and `design.md:219-224` says what the restore does. The last two lines show
something broader, though: the ceiling hides an **unedited** lock just as well. So the case belongs to any lock,
not to the edit.

My reading, in two sentences. The hook allowing is fine, since git under that variable cannot write either, but
the restore's "nothing to restore" with exit 0 is a claim it never checked (it found no git directory in which to
look for a lock), and R1 refuses the same situation with exit 2, so silence over a reverted tree is not acceptable
just because git agrees there is no repository. A follow-up should ask that when git finds no repository from a
store, the restore and the gate say that no lock could be looked for, naming `GIT_CEILING_DIRECTORIES` (or
`GIT_DIR`, `GIT_WORK_TREE`) when one is set, and that the restore exit 2 as R1 does rather than 0.

## Requirement to test

Round 1 confirmed the 17-row mutant table and A2 to A6; round 2 changes only these rows.

| R | Test | Evidence |
|---|---|---|
| A1 (n) | `tests/mutation-cli.test.ts:361` (`:373-374`) | n and n2 RED in 4 configurations, head GREEN; ps missing, empty or truncated RED |
| A2 | `tests/mutation-exits.test.ts:268`, now `SPAWN_TEST` | 0 failed in 68 runs of `mutation-exits` under load; `--timeout 1000` RED at `69e6c04`, GREEN at the head |

## Acceptance, quoted

**"a test fails for each of round 2's mutants i, k, m, a, b and n, or the report says why one is equivalent"**:
met. i, k, m, a and b are as round 1 found them. n is now killed with n2, and with the wider class of a wrong
default (§1), see `tests/mutation-cli.test.ts:361`.

**"a test fails for each of round 3's three mutants of the B3 path; first D, under which the hook allows git commit
under a lock with no rootFromTop (join(top, undefined) throws and the hook fails open)"**: met. This is unchanged
since round 1, and the killing test `tests/mutation-exits.test.ts:268` no longer times out (§3).

**"the helper's check at start is pinned: given a pid that is already dead and the command sleep 0.15 then write a
file, the file is never written; the decision row that says it cannot be tested is answered"**: met, unchanged.
`tests/run-async.test.ts:311` gained no option, since it already had one. It ran inside `run-async`, which failed 0
of 68 times under load.

**"the R12 blocked test matches the whole phrase 'exit 127 (the command was not found)', not a bare 127 that a short
sha could carry (item 104 review, non-blocking 1)"**: met, unchanged, `tests/mutation-run.test.ts:209`.

**"a test covers the two lines that name a gone CLI and have none: R15's line (src/mutation-run.ts:88) and the hook's
line from inside .git (src/hooks.ts:468) (item 101 review round 2, non-blocking 4); and a test fails for that
review's mutants X2 and X3"**: met, unchanged. `tests/mutation-exits.test.ts:1063` and `:1086`, now with
`SPAWN_TEST`.

**"from the item 105 review round 2: a test fails for its mutants V1 ... and V2 ...; the message at
src/mutation-lock.ts:175 does not say 'the lock was edited' for a moved checkout nobody edited; design.md's
not-caught list gains the edit under GIT_CEILING_DIRECTORIES between the root and the top; the test comment near
tests/mutation-exits.test.ts:924 states the rule in the code"**: met. The design item now also bounds the ceiling
below the store (`design.md:219-224`), as round 1's non-blocking 1 asked, and it matches the fixture (§4).

## Decision rows

Row 2026-11-20T09:55:19.744Z: "blocking 1 taken (... either pins 900 s by reading what the helper was given, or is
renamed ...); blocking 2 taken, and widened to a sweep". Row 2026-11-20T10:08:53.269Z: "the 900 s default is
pinned, not renamed ... if wrong: on a ps that truncates or rewrites the argv the test fails on a correct head;
this was not run on Linux". Both hold. That row's "if wrong" is the right direction: §1 shows a truncating `ps`
fails the test and cannot pass it. Every claim of the report's "Round 1 review" section that I checked holds:
the 142 lines, the 235 declarations, `:400` alone untimed, the equal numstat, n and n2 RED, and the ceiling's
outputs.

## Verification I ran

`S/scripts/suites.sh`, `S/out/suites.txt`. The run was in a fresh copy of the head with an empty `HOME` and
`TMPDIR` and the checkout's `node_modules` linked. It started at load 23 and ran alongside the last loops:

```
bun run test (bun 1.3.11, node 26.13.1): exit 0 in 545 s
  bun:  1150 pass  3 skip  0 fail   Ran 1153 tests across 59 files. [463.17s]
  node: ℹ tests 1153  ℹ pass 1152  ℹ fail 0  ℹ cancelled 0  ℹ skipped 1
node 22.6, no bun on PATH (CI's oldest-node): exit 0 in 93 s
  # tests 1115  # pass 1114  # fail 0  # cancelled 0  # skipped 1
typecheck (bunx --bun tsc --noEmit): exit 0, no output
./bin/mstack lint-plugin .: PASSED - 0 failures, 0 warnings
node scripts/check-doc-links.mjs README.md docs/wiki/*.md: 112 relative links checked, 0 broken
```

On node 22.6 with no bun, 38 fewer tests are declared. `tests/state-cli.test.ts:20-23` and
`tests/item-size-base.test.ts` declare one per runtime and keep only the runtimes that answer `--version`.

The eleven files with dash as `sh`, and from the spaced copy, are in §3: 22 runs each on bun and on node 24, plus
one pass each on node 22.6, 0 failed.

In the checkout: `./bin/mstack version` gave `mstack 0.2.1 at /Users/romerma/Code/mstack`. `./bin/mstack gate` gave
`PASSED - 0 failures, 0 warnings`. `ledger check mutation-test-pins` gave
`FAIL no verdict at d1050401; 3 row(s) exist at other SHAs` before my row, and `PASS test-verified at d1050401 by
reviewer` after it. After the row, the gate gave `PASSED - 0 failures, 1 warning`, the warning being "2 uncommitted
change(s)", which are this report and the ledger row. I did not run `gate --full` in the
checkout, because it writes receipts; the suites above are its obligations. After every run, `pgrep -fl
'mutation-holder|run-helper'` printed nothing, and no `sleep 4x.` of mine was left. The lock test
`test -e "$L" || test -L "$L"` was false.

## Changes required

**Blocking:** none.

**Non-blocking**

1. `tests/mutation-cli.test.ts:373`. With `ps` absent or silent, the test fails with the message "the baseline and
   the reverted run, each read once:" and nothing after it. Nothing in that message says `ps` printed nothing.
   Smallest change: name it in the message, e.g. `` `ps -o args= -p $PPID printed ${lines.length} line(s), not 2: ...` ``.
2. `tests/mutation-fixture.ts:25`. The comment says "so a stuck holder fails its test instead of the suite". On
   node that holds only for async bodies: a 1 ms `timeout` on a sync `spawnSync` body passes at 312 ms on 22.6, 24
   and 26 (§2). Smallest change: add to the comment "(on node, async bodies only; on bun, both)". Alternatively,
   leave it, since the swept holder tests are async.
3. Outside the swept files, 436 process-starting tests in 19 files have no timeout option, with the exposure round
   1 found (§2). Smallest change: a follow-up item that gives them the same option, in the same mechanical way.
