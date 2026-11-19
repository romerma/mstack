# Review - mutation-check

**Verdict:** CHANGES_REQUESTED

Round 2, the whole item: `a9b2a56..7614591`, head `76145911a050b5254a9650e561e5789a99b5447a`. Taken
by hand from `agents/reviewer.md` (the plugin is not loaded). Scratch:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review42r2/`,
written `S/` below. Every CLI run used `S/pristine`, a `git archive` of the head, in repositories
under `S/repos/`. Mutants ran in `S/copy` and `S/copy2`, and the suites in `S/clone`. The attack
driver is `S/scripts/attacks.mjs`. It writes one JSON line per scenario to
`S/out/attacks.{bun,node}.jsonl` and the CLI's output to `S/out/logs/<scenario>.<rt>.log`. Three
of those lines came from a mutant CLI; `S/out/mutant-cli-runs.txt` names them. In this checkout I
ran only `gate`, `version`, `ledger check` and `fanout plan --solo` (it wrote no row).

## Changes required

1. **B3. `src/mutation-run.ts:532-534` (`restoreRun`), as `spec.md:682-683` (R24) requires: a
   `verify --restore` run from a second store in the same worktree applies the other store's lock
   to its own tree.** A store in a package directory is a documented layout (`docs/wiki/The-CLI.md:323`).
   Two such stores, `pkg/a` and `pkg/b`, share one git directory and so one lock.
   - The setup: a run in A was SIGKILLed during its check.
   - What B is told: B's gate is red with `-> run <cli> verify --restore`. B's Stop hook and R1's
     refusal in B (`src/mutation.ts:376-397`) say the same. None of them names A's root.
   - What the restore does, run from `pkg/b`: it prints `the lock names the root .../pkg/a; its paths
     are resolved against this store's root, .../pkg/b` and goes on.
     - It **deleted B's committed `src/gone.js` and wrote A's HEAD bytes over B's committed
       `src/shared.js`, neither saved**. Both held A's start bytes, because they are boilerplate the
       two packages share.
     - It moved B's `src/x.js` and B's untracked `src/new.js` into `rescue/` and wrote A's files in
       their place.
     - It removed the lock, printed `restored 4, tree verified, lock removed`, and exited 0.
   - What is left: A's tree stays reverted (`x.js` at the start's bytes, `new.js` deleted, `gone.js`
     back), with no lock, and A's gate no longer names it.
   - The same on node and bun (`twoStores`; `S/out/logs/twoStores.bun.log`).
   - What it breaks: A3 (a recovery the tool prints removes and overwrites content the run did not
     write, without saving it) and A2 (`verify --restore` does not repair the killed run). It also
     leaves a tree reverted with no lock.
   - Fix: when the lock's `root` exists and is not this store's root by real path, refuse (exit 2,
     nothing written) and name `cd <lock root> && <CLI> verify --restore`. The gate's line, the
     hook's reason and R1's refusal name the lock's root. Resolve against the current root only when
     the lock's root is gone (a moved checkout). Amend R24, add the scenario and a test.

## Non-blocking

1. **R16's 2 s bound fails when mstack dies in the first milliseconds after a spawn**
   (`src/run-helper.mjs:63-69`).
   - The cause: the helper reads `process.ppid` when it starts. If mstack is already dead it reads
     1, `kill(1, 0)` is EPERM, and the watch takes EPERM for alive. Probe `S/scripts/ppid.mjs` prints
     `ppid read at start: 1; kill(ppid,0) EPERM` on both runtimes.
   - The run: SIGKILL of mstack alone, 3 ms and 10 ms after the line `running ... on the reverted
     tree`. The check was alive 3 s later and ran until `--timeout 20` (`helperRace-3` and `-10`,
     node and bun). At 30 ms it is caught.
   - The cost: with the default of 900 s, the orphan keeps running while the gate says "not
     running". The `verify --restore` the gate names then runs under it. Design.md:479's window
     ("cannot be made safe" 2) grows from 250 ms to `--timeout`.
   - Fix: pass the caller's pid in argv, and treat a caller that is already dead at start as gone.
     I would fix it together with B3.
2. **For an agent, a lock that cannot be read leads in a circle.**
   - The gate's line (`src/gate.ts:698-700`, so also the Stop hook) gives `BY_HAND` without the "for
     a person at a terminal" that `verify --restore` adds. Row 291 says the gate's line lacks it.
   - The hook denies both of its steps: `git stash push --include-untracked`, and `rm` of the lock.
   - The hook's reason for such a lock is `'mstack gate' says what to do` (`src/hooks.ts:453`); see
     `S/out/point5.bun.out`.
   - The way out is a person, and neither line says so. This is the one state I found where an
     agent is told to do what the hook denies, with nothing else it can do. Only a lock damaged by
     hand or by the disk reaches it.
3. **Ten of my mutants have no test that fails** (y is equivalent). The behaviour is right in each; the table is
   below. The test worth adding first is **l**. With `(a)` blind to an added path, an edit made to
   `src/new.js` during the run is rescued, and the run then writes a **`mutation-killed` row**
   (exit 0; `S/scripts/mutant-l.sh`). The head's code writes no row for that edit (`editNew`: exit
   2, `(a)`). The other nine:
   - **i**: without the stdout `error` handler, a closed stdout ends the run with no row on node and
     with exit 1 on bun (`S/scripts/mutant-i.sh`).
   - **d**: R24's line for a differing root.
   - **g**: `gate --full` under a lock that cannot be parsed.
   - **j**: R18 (c), a lock that names another run.
   - **k**: a refusal printed before the signal check.
   - **m**: R19's reset after a switch.
   - **a**, **b**: R12's tail, printed and 20 lines.
   - **n**: the 900 s default.
4. **A signal during the final row write** (the stage 4 report's open item). I reproduced it at rung
   3. `S/scripts/rowsignal.mjs` has the run's shape: a handler, a synchronous write, and the handler
   removed in `finally`. It exits 0 and its handler never runs, 3 of 3 per runtime
   (`S/out/rowsignal.out`). The signal is swallowed and the row is written. This does not block: by
   then the restore is proved and R18 has been read, so the row is earned. R20's "no signal reached
   it" is not true for that window, so add it to design.md "cannot be made safe".
5. **The hook.** The wiki's table names the verbs exactly. Three gaps beside it:
   - `git --git-dir .git --work-tree . commit` passes, because the shared `GIT` prefix
     (`src/hooks.ts:361`) takes only `--git-dir=`.
   - `hooks/hooks.json:81` says "the git commands that write the tree, the index or a ref". These
     pass: `checkout-index -f -a`, `read-tree -u --reset HEAD`, `update-index`, `branch -f`,
     `update-ref`, `sparse-checkout set`.
   - A `node -e` one-liner that spells `git commit` is denied, although the wiki says the hook does
     not see interpreter one-liners. Denying more is safe.
6. **The restore is quadratic in the size of a directory.** For 3005 paths in one directory, staging
   took 41.5 s, the revert 3.8 s and the restore 12.3 s. For 305 paths: 4.5 s, 0.16 s and 0.33 s
   (`S/out/timing.bun.*.out`). `sweepTemps` lists p's directory once per entry, and `entryAt`
   re-reads every parent's listing on each call (`src/mutation-tree.ts:487-509`, `:75`).
7. `restored N, tree verified, lock removed` is printed when the lock at the name was gone, or was
   another run's and stays (`src/mutation-run.ts:411`; the `lockDeleted` log).
8. `runCommandAsync`'s `finish` reads the capture file in a `close` handler, with no catch around
   that read (`src/run.ts:172`). A temp file that vanished is then an uncaught exception, with the
   tree reverted. The lock stays and `verify --restore` is the way out.
9. **Docs.**
   - `Gates-and-Hooks.md:285-286`: the CLI path `/home/u/.claude/plugins/cache/mstack/0.3.0/...` and
     the run id `...-4000-abcd` are invented, not shortened.
   - `The-CLI.md:836-837` (gone within 2 s) and `:882` (250 ms) do not hold in item 1's window.
   - `design.md:172` still says "one `setImmediate`".
   - `CHANGELOG.md:24` says "nothing changes for a store that does not run it", but each listed git
     command now costs the hook one `git rev-parse`.
   - A verification that only checks the tree is clean kills: `git diff --quiet HEAD -- src` gave
     `mutation-killed` (`S/out/gitkill.out`). It belongs beside the wiki's TTY note.

## Round 1's findings (point 2)

- **B1 is closed.**
  - `e1-sweep.ts` at this head (`S/r1scripts`, `S/out/r1rerun.out`, both runtimes) gives `A revert
    {"ok":false,...start/0 cannot be read...,"written":[]}` and nothing lost. Its last step then
    fails reading a lock the clean restore removed, as r3 says.
  - New attack, `S/r1scripts/b1new.ts`. After the lock and before the revert, in turn: a `head/<n>`
    deleted; a `start/<n>` rewritten at the same size; a copy replaced by a FIFO; one by a
    directory; one by a symlink to the right bytes. Each stops the revert within 1 ms with
    `written []`, the tree unchanged, on both runtimes (`S/out/b1new.out`).
  - Through the CLI (`runDirDeleted`, both runtimes): the run directory deleted during the check,
    plus an edit. The exit is 3, the lock stays, and the edit is in `rescue/`. The printed `git
    stash push -- <p>` four times, then `verify --restore`, exits 0, with nothing lost.
- **B2 is closed.**
  - `e11` is refused: `tracked files whose changes git does not show: src/conf.ts (skip-worktree)`.
    `e11b` loses nothing.
  - New attack through the CLI (`b2DuringBaseline`, both runtimes): `--assume-unchanged` set on
    `src/a.js` and the file edited while the baseline runs. The run is refused `after the
    baseline`, with no receipt, no run directory, and the edit intact.
  - `core.fileMode=false` hiding an executable bit is not refused, and the bit is back after the run
    (`fileModeOff`).
- **Non-blocking 1 to 12 are closed** as `impl_mutation-check_r3.md:49-67` says, by its 21 mutants. I
  did not rerun those mutants. I reran round 1's `e4-hostile.ts` and `e5-tmp-prefix.ts` at this
  head (`S/out/e4e5.node.out`):
  - (a) the folded duplicate is refused;
  - (b) the file outside the root is kept;
  - (c) B's lock stays;
  - (e) a FIFO reads as damaged at once;
  - e5 is refused.

  13 is `The-CLI.md:885-888`, 14 is `src/mutation-run.ts:332-335`, and 15 is kept.
- **4, second half (row 276): does not stand as argued.** The row rests on the claim that only a lock
  edited by hand names a file outside the revert set. B3 is a lock nobody edited doing exactly that,
  with no rescue for files that hold the start's bytes. Once B3 refuses a root that differs, what
  is left needs a crafted lock and a crafted staged copy that hashes to H, and that I accept.

## A receipt that is not earned (point 3)

None found.
- A red baseline gives a blocked row and a failed receipt, and nothing is reverted (R7's tests). A
  timed-out baseline is blocked, with no receipt.
- A recorded green counts only at this sha and `treeId`, which covers the tracked diff and the
  untracked files. Ignored files are outside it, a trade-off the design accepts.
- On the reverted tree, these are blocked (`classify`, `src/mutation-run.ts:41-46`): a timeout, exit
  126 or 127, a death by a signal mstack did not send, and a spawn that fails. In `timeout` the
  row is blocked and the check is gone. Every other code is a kill, 128+n included.
- A build failure after the revert: the spec makes it a kill (R12, `spec.md:357-360`). The code does
  the same, and its final line says a build failure and an assertion failure look alike.
- A tree changed under the run wrote no row in every case I made. The only gap is the untested
  branch in non-blocking 3 (l).

## Requirement to test (point 4)

r5's table has 28 rows, one for each of R1 to R28, and 196 citations. Each citation is a `test(`,
`caseTest(` or `nodeOnly(` line (`S/scripts/table.mjs`, `S/out/table.out`). My mutants
(`S/scripts/mutants.mjs`) ran against every mutation test file plus run-async and hooks, 216 tests
under bun. Results are in `S/out/mutants.txt`, logs in `S/out/mutants/`; `diff -rq` of `src` was
clean afterwards.

| Mutant | Result |
|---|---|
| a. no tail printed on a kill; b. `TAIL` 3 | survived |
| c. the restore line after `reverting` | killed: cli:137 |
| d. no line for a differing root | survived |
| e. no "left in place" | killed: changed:176 |
| f. no by-hand recovery for cannot-tell | killed: gate:74 |
| g. `gate --full` runs under a lock that cannot be parsed | survived |
| h. the `rm` guard without quotes | killed: hook:138 |
| i. no stdout `error` handler | survived |
| j. R18 (c) ignores another run's lock | survived |
| k. refusal printed before the signal check | survived |
| l. R18 (a) blind to an added path | **survived** (a row: non-blocking 3) |
| m. never the reset after a switch | survived |
| n. default `--timeout` 9 s | survived |
| q. no R18 line on a failed restore | killed: changed:114 |
| v. the run's restore takes no entry | killed: changed:33 and more |
| x. `verify --restore` restores no entry | killed: cli:189, cli:281 |
| y. `gate --full` loses its own line under a lock | survived; equivalent: the `return` stays and the workspace line fails the gate |
| Y3. one `setImmediate` (node, `S/scripts/y3.sh`) | killed 3 of 3: signals:169, :186 |

## Acceptance, quoted

**"verify --mutation reverts the code part of the item diff in place (store, tests and docs
excluded), confirms a green baseline first, runs the obligations and records mutation-killed,
mutation-survived or mutation-blocked in verification.tsv keyed by the code and test tree"** - met:
- `plain` writes a killed row, with `tests/` and `docs/` untouched.
- The wiki's survived run writes a survived row; `timeout` and a red baseline (`run:125`) write
  blocked rows.
- The key is the wiki's to the digit, on both runtimes.

**"A lock under the git dir holds the restore list; restore runs in finally and on SIGINT/SIGTERM,
the tree is as it was afterwards, verify --restore repairs a SIGKILLed run, PreToolUse denies git
commit/add/stash while the lock exists, and the gate fails on a lock"** - met with one store in a
worktree; see the attacks and the gate below. Not met with two stores (B3). After a SIGKILL in
non-blocking 1's window, an obligation outlives mstack.

**"No path through the run, the restore or a recovery the tool prints removes or overwrites content
the run did not write without first saving it, and no state keeps the lock with deleting work as the
only way out"** - not met: B3. Every other path I made kept every byte in place, in `rescue/`, or in
a stash the tool named. Every lock that stayed had a way out that deletes nothing: `chmod u+w`,
`mv`, or `git stash push -- <p>`, then `verify --restore`.

## Attacks (point 1)

Both runtimes, unless marked bun. "No row" means `verification.tsv` gained no mutation row. "Status
as before" means `git status` matches what it was before the run.

| Attack | Result |
|---|---|
| plain run | killed row; status as before |
| an edit to a reverted file, or to an added path | rescued; no row, (a) |
| an edit to a path HEAD lacks | left in place; no row, (a) |
| new untracked code; a file in a directory the revert removed | left in place; no row, (e) |
| from another process: `commit -am`, `add`, `add -A`, `stash -u`, `reset --hard`, `switch -c` + commit | tree back at H; no row, (a)/(b)/(d); nothing lost, and the stash holds S |
| a symlink, or a directory, at a reverted path; a case rename plus an edit; the parent moved away | rescued or left; no row |
| the parent replaced by a symlink | exit 3, lock kept, `move src aside`; after the `mv`, restore 0 |
| the lock deleted | (c); no row |
| the lock deleted, plus a read-only directory | lock written again, exit 3; after `chmod`, restore 0 |
| a read-only `src/` or `src/deep` | exit 3, lock kept, `chmod u+w`; restore 0, then "nothing to restore" |
| a second `verify --mutation`, `verify --restore` and the gate during a run | refused, naming the live pid; refused; "running ... wait" |
| the check rewrites a tracked test and a reverted file, deletes a tracked doc and a reverted file, writes `out.log` | no row, (a)(d)(e), each named, with the `.gitignore` hint |
| `--timeout 2` on a check that never ends | blocked row; the check is gone |
| SIGINT twice, SIGTERM or SIGHUP, to mstack alone and to its group, during the check | 130, 143 or 129; restored; no row; check gone by 2.5 s |
| SIGKILL, alone and to the group, during the check | lock kept, gate names the restore, check gone; restore 0, then "nothing to restore" |
| SIGKILL or SIGINT at the lock line | restore removes the lock; SIGINT exits 130, clean |
| bun: SIGKILL 300, 800 or 1500 ms into a 3005-path revert | 137, 507 or 1133 paths at S; restore 0, status as before |
| bun: 5 s into a 3005-path restore, SIGKILL / SIGINT to the group / SIGTERM alone | 2034 paths still at S; restore 0 / exit 130, restored / exit 143, restored |
| bun: SIGKILL of `verify --restore` itself, 3 s and 6 s in | 2860 or 199 paths still at S; the next restore 0, then "nothing" |
| stdout closed during the run | exit 0, row written, tree fine |
| a linked worktree | the lock is in its own git dir, the main gate is green, the rescue warns from main, prune offers nothing |
| two stores; SIGKILL just after a spawn | B3; non-blocking 1 |

The two claims of stage 4:
- **The throw after the lock** (`56f2ff8`): the `try` opens at `src/mutation-run.ts:346`, right after
  `acquireLock`, and nothing between them can throw.
- **A third of the same kind:** I looked and found none. Every step that cannot be undone (a
  receipt, a row, the first write, a spawn) is either sync code only or comes after a `tick` and a
  signal check (`:267`, `:303`, `:353`, `:375`, `:444`). The two checks with no tick before them
  (`:275`, `:383`) each meet one before any such step.
- **Two `setImmediate`s:** with one (Y3), two tests fail under node 3 of 3, so two are needed and a
  test pins them.

## The gate and the hook (point 5)

`S/scripts/point5.mjs` (`S/out/point5.bun.out`) ran on a repository whose run was SIGKILLed during
its check. With the lock there, the gate prints:

```
[fail]  the mutation lock .../.git/mstack-mutation.lock is held by pid 98644 on <host>, started 2026-11-19T14:51:52.801Z, 5 path(s): the run is not running (no such process)
        fix: run .../pristine/bin/mstack verify --restore
FAILED - 1 failure, 1 warning
```

- `gate --full` exits 1 with `--full ran no verification: a mutation lock exists`. The check did not
  run, and `verification.tsv` is unchanged. The Stop hook's context carries the gate's line.
- Denied: every R26 shape, and also `env git`, `/usr/bin/git`, `command git stash`, `git --no-pager
  stash`, `git --git-dir=.git commit`, `(git stash)` and `$(git stash)`.
- Allowed, as the wiki says: `git ci`, `"git" commit`, `git -C "dir with space" commit` and `npm
  version`.
- The `rm` guard denies `rm .git/...lock`, `rm -f /repo/...lock` and `rm '...lock'`, with a lock and
  without one. It allows the `.tmp` name. `unlink`, `mv`, a glob and `find -delete` pass, as the
  wiki's "rm of a path" implies.
- `worktree prune` offers a merged worktree whose git directory holds nothing, and does not offer
  one that holds a lock.
- The rescue warns in the main worktree and in the linked one.
- After stage 4, non-blocking 2 is the only state that leaves an agent stuck. For a staged copy that
  is missing, `verify --restore` says the git commands are "for a person at a terminal".

## The docs (point 6)

- `S/wiki/run-wiki.sh` is stage 4's script, pointed at `S/pristine`. Every line of the four
  transcripts under "verify" in `The-CLI.md` appears in the real output, up to ids, pids, shas,
  times and paths.
- The two keys match the wiki's to the digit: `mutation:708df9d8b0f7ac81` and
  `mutation:12b5aef8361b07f7`.
- The bun and node outputs are identical after normalising (`S/out/wiki-{bun,node}.norm`).
- The Gates-and-Hooks transcript has the gate's real line shapes; its CLI path and run id are
  invented (non-blocking 9).
- `CHANGELOG.md` and `mstack help` match the code, apart from non-blocking 9's sentence.

## Verification I ran (point 7)

```
$ ./bin/mstack gate                        # checkout, at the start: PASSED - 0 failures, 0 warnings
$ bun run typecheck                        # S/clone: exit 0
$ ./bin/mstack lint-plugin .               # S/clone: PASSED - 0 failures, 0 warnings
$ bun test ./tests                         # S/clone: 1084 pass, 2 skip, 0 fail [313.65s]
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 1086 / ℹ pass 1086 / ℹ fail 0
$ ./bin/mstack ledger check mutation-check # FAIL no verdict at 76145911 (before my row)
```

The suite outputs are in `S/out/suite-{bun,node}.txt`. I did not run `gate --full`, because it
appends receipts and my writes are limited to this report and the row; the three commands above
are the project's `verify`. `S/scripts/repeat.sh` ran each `tests/mutation-*.test.ts` file and
`tests/run-async.test.ts` 5 times per runtime: 13 files x 5 runs x 2 runtimes = 130 runs, with 0
failures (`S/out/repeat.txt`). Neither earlier single failure came back, so there is no output to
capture. The machine's load average was 5 to 9 during this.

## What I did not check

- **Not run:** Linux, a case-sensitive volume, a second filesystem (EXDEV), ENOSPC, a power cut, a
  container or another pid namespace.
- **Bun only:** the 3005-path kills, mid-revert and mid-restore. The kills during the restore landed
  only at 5 s and 6 s. I did not aim for each phase inside `putBack`: rescue, the temp write, the
  rename.
- **Not rerun:** r3's 21 mutants.
- **No mutants of mine** in `src/mutation-tree.ts` or `src/mutation-lock.ts` beyond those of round 1
  and of r3.
- **Not traced line by line:** `measureStart`, and the gate outside `checkMutationLock`.
- **The design lens** was not given, so not read.
- **Not reproduced:** a loss from non-blocking 1's orphan, which needs an obligation that writes the
  tree after the restore.
