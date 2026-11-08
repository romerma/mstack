# Review r2 - shared-runner-and-closing (item 36)

**Verdict:** CHANGES_REQUESTED

Delta `2298b54..b7894e6`, code in `a98a5d0`. I did not write this code.

All six round-1 blockers are fixed. I checked each one by rerunning my own probes and mutations (below).

The new helper brings four defects of its own, all in `src/run-helper.mjs` / `src/run.ts`, all reproduced on both runtimes, and each a few lines to fix:
- a group kill that misses a child being forked at that moment;
- bun loading the target project's `bunfig.toml` and `.env` into the timed path only;
- unvalidated `timeoutMs` turning into a 1 ms kill;
- Ctrl-C removing the timeout bound.

Item 42 depends on exactly this path, so they block.

## Round-1 blockers

| # | Blocker | Status | Evidence (rung 4 unless noted) |
|---|---|---|---|
| 1 | dash timeout kills nothing | **Fixed** | Copy of HEAD with `/bin/sh` -> `/bin/dash` in run.ts and run-helper.mjs, no tty: tests/run.test.ts 12/12 on node and bun. My round-1 probe: `{"timedOut":true,"tail":"64774"} grandchild 64774 was killed`, the same on both runtimes, and nothing left alive. That is a simulation on macOS /bin/dash, not ubuntu itself. |
| 2 | tail polluted by job control | **Fixed** | `tailLines:1` under a timeout -> `"line2"`. A self-TERM -> `"before"`. Same on both runtimes. Test: tests/run.test.ts:101 |
| 3 | inherit + timeout | **Fixed** | Type: `tsc` on a probe file gives `TS2345 ... Type 'number' is not assignable to type 'undefined'` for that one call only. Runtime: `UserError runCommand: output 'inherit' cannot have a timeout`. Test: tests/run.test.ts:111 |
| 4 | gate/state set disagree with a 2nd check | **Fixed** for the case I reported | Copy of HEAD with a hardcoded second `CLOSING_CHECKS` entry, `reportedAt: ["verifying"]`, item at verifying, `verify: ""`. The gate exits 1 with `... one step from done, and a second closing check is not satisfied`. State set exits 2. Mutation G1 (gate skips `gateProblems` when there are no obligations) -> red at tests/closing.test.ts:107. One configuration gap remains (R1) |
| 5 | 3 pathclass mutants | **Fixed** | P1 -> 2 red (`LICENSE/x.ts`, `src/a.test.dir/x.ts`). P4 -> 2 red (`tests/README.md`, `docs/a.test.ts`). P6 -> 1 red (`./tests/a.ts`) |
| 6 | `RunResult` contract | **Fixed** | A missing cwd now gives `code: null` plus `error` on both runtimes and on both paths. Mutation G5 (drop `?? null`) -> red on bun at tests/run.test.ts:123. The 128+n case is pinned at :116, and the doc at src/run.ts:44-52 now says what both paths do |

Other mutations, all caught:
- G2 (`overridable` ignored in src/cli.ts:527) -> red at closing.test.ts:50 and :144.
- G3 (`reportedAt` filter removed, src/closing.ts:81) -> red at gate.test.ts "nothing before verifying is held to a run...".
- G4 (helper kills `child.pid` and not the group) -> red at run.test.ts:35 and :81.

## New points asked about

**`.mjs` helper under `src/`: fine.** `marketplace.json` uses `"source": "./"`, and the installed 0.2.1 cache is a whole-tree copy, so `src/run-helper.mjs` ships. The helper is found through `import.meta.url` (src/run.ts:62), not through cwd. I put a `git archive HEAD` copy under a path with a space (`.../plugins cache/mstack/mstack/0.2.2`) and ran a timed `runCommand` from another cwd. It reported `timedOut:true` and killed the grandchild on bun, node 24, and node 22.6 with the launcher's flags. tests/run, closing and pathclass are 47/47 on node 22.6 from that copy. `lint-plugin` passes; it does not look at file types in `src/`. Two costs:
- `tsconfig.json` includes only `src/**/*.ts`, so the helper is not type-checked at all.
- `process.execPath` makes the helper run under bun on bun. See N2 for what that pulls in.

**`UserError` from `paths.ts`: works, no cycle.** My import-graph scan prints "no value-import cycles" at HEAD, because paths.ts -> git.ts and git.ts only type-imports paths. It is the wrong class, though. Passing `inherit` together with a timeout is a mistake in the calling code, not something the user did. As a `UserError` it reaches the CLI handler (src/cli.ts:1067) and prints a hint the user cannot act on. A plain `TypeError` is the honest class and would keep run.ts importing only `node:` modules. Not blocking, since the coordinator chose it.

## Verification I ran

```
$ bun test tests/run.test.ts tests/closing.test.ts tests/pathclass.test.ts
 47 pass
 0 fail
Ran 47 tests across 3 files. [4.45s]
$ PATH=.../node/v24.14.0/bin:$PATH node --test tests/run.test.ts tests/closing.test.ts tests/pathclass.test.ts
ℹ tests 47
ℹ pass 47
ℹ fail 0
$ (gate.ts and cli.ts changed, so their unedited suites too)  node: ℹ tests 101 ℹ pass 101 ℹ fail 0 | bun: 101 pass 0 fail [18.03s]
$ bun run typecheck
$ bunx --bun tsc --noEmit                                    exit=0
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings                              exit=0
$ ./bin/mstack ledger check shared-runner-and-closing        (before my row)
FAIL no verdict at b7894e6a; 3 row(s) exist at other SHAs and a new head SHA voids them
```

`git diff 2e975da..HEAD --name-status -- tests/` lists only `A` for closing, pathclass and run. No existing test was touched in either round. I did not run the full suite: the coordinator runs `gate --full`.

## Changes required

1. **src/run-helper.mjs:27 - one `kill(-pid)` misses a child forked at that instant.** Rung 4, macOS, both runtimes. The command `i=0; while [ $i -lt 400 ]; do sleep 7.81 & i=$((i+1)); done; wait` with `timeoutMs: 40`, run 10 times:

   ```
   bun : runs with survivors: 4/10, survivors total: 4    62364  ppid 1  pgid 62256  sleep 7.81
   node: runs with survivors: 7/10, survivors total: 8    63473  ppid 1  pgid 63365  sleep 7.81
   ```

   The survivor is still in the group, so a second kill reaches it. With `if (timedOut) { try { process.kill(-child.pid, "SIGKILL") } catch {} }` added in the `exit` handler before `finish`, I got `runs with survivors: 0/10` on both runtimes. Real test suites fork constantly, including this repo's own, and a survivor from item 42's run keeps executing against a mutated tree. I did not run this on Linux. Add a test with a forking command.
2. **src/run.ts:85-86 - under bun, the timed path loads the target directory's `bunfig.toml` and `.env`.** The helper is started with `cwd: options.cwd`, and bun reads both from its cwd. Probe with a dir containing `bunfig.toml` (`preload = ["./pre.mjs"]`) and `.env` (`MSTACK_PROBE_ENV=from-dotenv`), parent cwd elsewhere:

   ```
   bun : untimed: "env=unset"   timed: "PRELOAD RAN in 84766\nenv=from-dotenv"
   node: untimed: "env=unset"   timed: "env=unset"
   ```

   So under bun the timed path runs project code inside the helper, injects env vars the untimed path never sees, and puts the preload's output in `tail`. Both differences break "both runtimes behave the same". The helper already gets the command's cwd in argv (src/run.ts:85), so start it with `cwd: dir` (the temp dir). In a scratch copy that change gave `timed: "env=unset"` on bun, and tests/run.test.ts stayed 12/12 on bun, missing-cwd case included. Add the probe as a test.
3. **src/run-helper.mjs:24 - `timeoutMs` is not validated.** Same on both runtimes:

   ```
   timeoutMs=2147483648 took 13ms {"code":null,"signal":"SIGKILL","timedOut":true,"tail":"TimeoutOverflowWarning: 2147483648 does not fit into a 32-bit signed integer.\nTimeout duration was set to 1. ..."}
   ```

   The same happens for `Infinity`, `NaN` and `-5` (TimeoutNegativeWarning). A caller using `Infinity` or `Number.MAX_SAFE_INTEGER` to mean "no limit" gets a 1 ms kill reported as a timeout, with the runtime's own warning as the tail. That is the killed/failed mix-up item 42 must not have. Reject non-integers, values <= 0 and values > 2_147_483_647 in `runCommand` (next to the check at src/run.ts:66), and test it.
4. **src/run-helper.mjs - Ctrl-C removes the timeout bound.** The command is detached and the helper is not. The terminal's SIGINT kills the parent and the helper, never reaches the command, and the command then runs with no bound at all. Probe: victim process in its own group, `kill(-victim, SIGINT)` after 1.5 s, check 0.8 s later:

   ```
   bun : timed    SIGINT -> command SURVIVED (pid 81367)    untimed SIGINT -> command died
   node: timed    SIGINT -> command SURVIVED (pid 81462)    untimed SIGINT -> command died
   ```

   A SIGTERM to the parent alone leaves the helper alive, and its timer still fires, so that case is bounded. Fix: in the helper, handle SIGINT, SIGTERM and SIGHUP by killing `-child.pid` and exiting 128+n. Test it the way the probe does.

## Recommended, not blocking

- **R1, src/closing.ts:31,81 (item 43 should pin this).** `reportedAt` can leave out `verifying`. A check with `reportedAt: ["reviewing"]` brings the round-1 disagreement back through configuration. I ran it: at verifying, `GATE exit 0` and `STATE SET exit 2`. At reviewing the gate says `(reviewing) is one step from done` (src/gate.ts:633). Add a test that every `CLOSING_CHECKS` entry includes `VERIFICATION_REQUIRED_FROM`, or make `reportedAt` extra statuses on top of `verifying`.
- src/cli.ts:542 shows only `problems[0]`'s hint when there is more than one problem. src/cli.ts:565 stores a second-check override under the `closed unverified (forced)` marker, which says "unverified" for something that is not about verification.
- The r2 report says the old strings are unchanged while every problem is a verification one. The non-overridable refusal did change: from `<slug>'s verification runs could not be read...` to `<slug> cannot close: its verification runs could not be read...` (src/cli.ts:528). The new wording is fine and the tests match by regex.
- tests/run.test.ts:81 fails rather than skips where `/bin/dash` is missing (Fedora, Arch, Alpine). Skip it when `existsSync("/bin/dash")` is false.
- src/gate.ts:590 now runs `git rev-parse` at every status, not only at verifying. The cost is negligible.
- `CLOSING_CHECKS` is an exported mutable array used as a test seam. Acceptable, because the test registers its extra check in a child process, so bun's single-process runner never sees it.
