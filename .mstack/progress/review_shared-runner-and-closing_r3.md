# Review r3 - shared-runner-and-closing (item 36)

**Verdict:** CHANGES_REQUESTED

Delta `b7894e6..7fefdd1`, code in `141eb01`, scoped by decision `review-r3` (decisions.tsv:105) to six changes. I did not write this code.

Five of the six are fixed, and each has a test that goes red without it. Change 4 (signal forwarding) works for an ordinary command and its grandchildren. It still has the fork race on its own path, the race change 1 closed for timeouts. A Ctrl-C while the command is forking leaves a survivor: 8/10 runs on bun, 5/10 on node. My round-2 suggestion ("kill `-child.pid` and exit 128+n") had the same gap; the implementer applied it as written. A tested one-line fix is below.

## The six changes

| # | Change | Fixed? | My probe at HEAD (rung 4, macOS, both runtimes) | Red without it (my mutation) |
|---|---|---|---|---|
| 1 | second group kill on exit | **Yes** | fork-heavy probe (400 forks, `timeoutMs: 40`, 10 runs): `runs with survivors: 0/10` on bun and node. It was 4/10 and 7/10 in round 2 | removing src/run-helper.mjs:54 -> red at tests/run.test.ts:154 (node 1/1; bun 2/2 runs) |
| 2 | helper starts in the temp dir | **Yes** | bunfig preload + `.env` probe: timed `"env=unset"` on bun, with no `PRELOAD RAN`. It was `"PRELOAD RAN ...\nenv=from-dotenv"` in round 2 | `cwd: dir` -> `cwd: options.cwd` (src/run.ts:93) -> red at :180 on bun. It cannot go red on node, which never loads bunfig; CI runs bun |
| 3 | `timeoutMs` validated | **Yes** | src/run.ts:73-74 rejects NaN, Infinity, -5, 0, 1.5 and 2^31; 2^31-1 runs | disabling the guard -> red at :132 |
| 4 | SIGINT/SIGTERM/SIGHUP forwarded | **Partly** | Ctrl-C (`kill(-victim, SIGINT)`) on the command itself: 0/3 survivors. On a background grandchild in the group: 0/3 on both runtimes. On a **forking** command: **8/10 (bun), 5/10 (node)** | handlers removed -> red at :201 on node and bun |
| 5 | gate reports every check at verifying | **Yes** | `reportedAt: ["reviewing"]` probe at verifying: `GATE exit 1 ... one step from done, and a second closing check is not satisfied`, and `STATE SET exit 2`. It was gate exit 0 in round 2 | dropping `atTheDoor ||` (src/closing.ts:87) -> red at tests/closing.test.ts:160 |
| 6 | `TypeError`, run.ts `node:`-only | **Yes** | `rg '^import' src/run.ts` shows only `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:url` | `TypeError` -> `Error` -> red at :111 and :132 |

Safety check on the new `killGroup` in signal and error paths: if the spawn failed, `child.pid` is `undefined`, and `process.kill(-undefined, ...)` must not become `kill(0)`, which would hit the caller's own group. In an isolated group, both runtimes give `threw ERR_INVALID_ARG_TYPE / still alive`, so it is safe.

## Verification I ran

```
$ PATH=.../node/v24.14.0/bin:$PATH node --test tests/run.test.ts tests/closing.test.ts tests/pathclass.test.ts tests/gate.test.ts tests/cli.test.ts
ℹ tests 153
ℹ pass 153
ℹ fail 0
$ bun test  (same five files)
 153 pass
 0 fail
Ran 153 tests across 5 files. [24.39s]
$ bun run typecheck
$ bunx --bun tsc --noEmit                                  exit=0
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings                            exit=0
$ ./bin/mstack ledger check shared-runner-and-closing      (before my row)
FAIL no verdict at 7fefdd1a; 5 row(s) exist at other SHAs and a new head SHA voids them
```

Ctrl-C probe at HEAD: the victim process leads its own group, the command writes a flag file, and `kill(-victim, SIGINT)` follows (30 ms after the flag for the forking case). I check survivors 700 ms later.

```
bun : direct 0/3   grandchild 0/3   forking (1000 forks): runs with survivors 8/10, survivors 8
node: direct 0/3   grandchild 0/3   forking (1000 forks): runs with survivors 5/10, survivors 5
```

## The launcher.test.ts stall

This item's code is very unlikely to be the cause (rung 3, not reproduced).
- `bun src/cli.ts statusline` never runs any of it. src/statusline.ts imports paths, state, ledger, git, lifecycle and roles, but not run, closing or gate.
- cli.ts loads gate.ts, and through it run.ts and closing.ts, but loading them runs nothing.
- Nothing in `src/` passes `timeoutMs` (`rg timeoutMs src` finds only tsv.ts's lock and the helper), so the helper and its signal handlers never start outside tests/run.test.ts.
- Nothing in run.test.ts signals anything but its own detached victim group and processes matching its unique markers.
- The same hang family was logged at tests/gate.test.ts:1618 during item 38's round 3 (decisions.tsv:93, 2026-11-01), before item 36's first commit (2026-11-08).

Leave it to item 21.

## Changes required

1. **src/run-helper.mjs:39-44 - the signal path kills the group once and exits at once, so a child that is mid-fork survives.** The second kill from change 1 never runs on this path: `process.exit` comes before the child's `exit` event.
   - **What I tested:** in a scratch copy I replaced `process.exit(128 + number)` with `timedOut = true; setTimeout(() => process.exit(128 + number), 2000).unref?.()`. That makes the existing `exit` handler do the second kill. The same probe gave `forking ... runs with survivors 0/10` on both bun and node, with direct and grandchild still 0/3.
   - **The real fix** should not borrow `timedOut`. Use its own flag or exit code: stop on the signal, let `exit` do the second kill, then exit 128+n, with a short fallback timer in case `exit` never comes.
   - **Test:** extend tests/run.test.ts:201 with a forking command, the way :154 does for the timeout path.

## Noted, not blocking (outside the six, or inherent)

- A grandchild that detaches itself (a new session) cannot be reached by any group kill. Probe: a `spawn(..., {detached: true}).unref()` grandchild survived a Ctrl-C while the in-group command died. That is inherent to process groups. src/run.ts:23 ("its whole process group") should say so, so item 42 knows its limit.
- From round 2, still open and outside this round: at a non-verifying `reportedAt`, the gate still says `(reviewing) is one step from done` (src/gate.ts:633).
