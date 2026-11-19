# Implementation, item 42 `mutation-check`, the round 2 fixes

Implementer, by hand from `agents/implementer.md` ("A later round"); the plugin is not loaded.
Answers `review_mutation-check_r2.md` (CHANGES_REQUESTED): B3 and non-blocking 1 to 5 and 7 to 9
as the design row of 2026-11-19T15:19:44Z takes them. Scratch
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl42r6/`,
`S/` below. From `8481846` to `453f33d`, nine commits. `453f33d` is `aa57df3` with its subject
cut to 72 characters, the same tree `aaaf6f3`; the runs below that name `aa57df3` ran that tree.
Nothing of task group 5, no status change.

## What changed

The lock records `rootFromTop`, its store's root relative to the worktree's top level (`.` at
the top). `verify --restore` from a store whose own relative root differs refuses, exit 2, with
nothing written, and names `cd <that store's directory> && <CLI> verify --restore`. The gate's
line and R1's refusal add that `cd` when the lock is another store's, and the hook's reason always
does. Nothing is resolved against the absolute `root` any more, and the "root differs" line is
gone. A lock without the field cannot be read. R24 is amended inside the requirement, with a new
scenario. The other fixes are in the table below; twelve tests are new.

## Files

`src/mutation-lock.ts`, `src/mutation-run.ts`, `src/mutation-tree.ts`, `src/mutation.ts`,
`src/gate.ts`, `src/hooks.ts`, `src/run.ts`, `src/run-helper.mjs`, `hooks/hooks.json`;
`tests/mutation-two-stores.test.ts` (new, 3), `tests/run-async.test.ts` (+2),
`tests/mutation-changed.test.ts` (+3), `tests/mutation-gate.test.ts` (+2),
`tests/mutation-hook.test.ts` (+2 and the fixture), `tests/mutation-cli.test.ts` (fixture);
`docs/wiki/Gates-and-Hooks.md`, `docs/wiki/The-CLI.md`, `CHANGELOG.md`;
`.mstack/specs/mutation-check/{spec,design,tasks}.md`, `.mstack/decisions.tsv`,
`.mstack/ledger.tsv`, `.mstack/progress/current.md`, this file.

## Findings

| Finding | Closed by | Test |
|---|---|---|
| B3 | `52e7f87` | two-stores:199, :203, :207 |
| 1 the helper's caller | `235e63e` | run-async:251 |
| 2 a person at a terminal | `2bd3111` | gate:224, hook:173 |
| 3 l, g, j | `38da222` | changed:194 (l), gate:238 (g), changed:213 (j) |
| 3 d | `52e7f87`: its line is gone | two-stores:199, :203 (mutant B3a) |
| 3 i, k, m, a, b, n | follow-up (design row) | |
| 4 a signal in the row write | `7913e6c` (design.md) | n/a, a sentence |
| 5 `--git-dir`/`--work-tree` with a space, `hooks.json`, the one-liner claim | `53ea7f7` | hook:184 |
| 5 the plumbing commands | follow-up (design row) | |
| 6 quadratic restore | follow-up (design row) | |
| 7 `lock removed` | `7231262` | changed:230 |
| 8 the capture file | `7cea700` | run-async:279 |
| 9 docs | `453f33d` | n/a: pasted from runs, below |

`two-stores`, `run-async`, `changed`, `gate`, `hook` and `cli` below are
`tests/mutation-two-stores.test.ts`, `tests/run-async.test.ts` and `tests/mutation-{changed,gate,hook,cli}.test.ts`.

## Commands

### Red first

Each new test was run against the code before its fix. The last lines (`S/out/red-*.out`,
`S/out/nb1-red/`):

```
B3   0 pass, 3 fail: fromB "the lock names the root .../pkg/a; its paths are resolved against this
     store's root, .../pkg/b ... rescued src/new.js ... restored 4, tree verified, lock removed"
     0 !== 2 (in place and moved); the third: "running: pid ... is alive" !~ /rootFromTop/
NB1  10 of 10 red per runtime: "the caller was SIGKILLed 0 ms after the spawn, and the helper and
     its command are alive 3 s later", actual: [ 54505, 54506 ]; after the fix 0 of 10
NB2  0 pass, 2 fail: "...'mstack gate' says what to do" !~ /for a person at a terminal/; the gate too
NB5  not denied under a lock: git --git-dir .git --work-tree . commit -m x
NB7  gone: actual "mutation: restored 1, tree verified, lock removed"
NB8  removed: actual tail "" (no throw); a directory, S/scripts/nb8-probe.sh at 8481846:
     "uncaught exception: EISDIR: illegal operation on a directory, read", bun and node; at the
     head: settled, code 3, tail "(the output could not be read: EISDIR: ...)" (nb8-probe-head.out)
```

The tests for the review's mutants l, g and j pass on the code: each one's red is its mutant
(below).

### Mutants

`S/scripts/mutants.sh`: an rsync of the checkout to `S/mut/copy`, one replacement, the named file
run under bun, the file put back and hashed. `diff -rq` of `src` was clean afterwards
(`S/out/mutants.txt`, logs `S/out/mutants/`).

| Mutant | Killed by |
|---|---|
| B3a no relative-root comparison in the restore | two-stores:199, :203 |
| B3b the review's fix: absolute real roots compared, a root that is gone falls back | two-stores:203 (moved) |
| B3c the refusal restores first (writes to the tree) | two-stores:199, :203 |
| B3d the gate compares this store with itself | two-stores:199, :203 |
| B3e R1's refusal without the directory | two-stores:199, :203 |
| B3f the hook's reason without the directory | two-stores:199, :203 |
| B3g a lock without `rootFromTop` accepted | two-stores:207 |
| N1a the helper reads `process.ppid` | run-async:251 |
| N1b no check at start, only the 250 ms poll | **survived**: decision row; R16's 2 s holds either way |
| N2a the gate's by-hand line bare | gate:224 |
| N2b the hook's old reason | hook:173 |
| N5 the prefix without the space form | hook:184 |
| N7 the line always says `lock removed` | changed:230 |
| N8a the read throws again | run-async:279 |
| N8b a gone file gives an empty tail | run-async:279 |
| l (a) blind to an added path: `mutation-killed`, exit 0 | changed:194 |
| g `gate --full` runs under a lock that does not parse | gate:238 |
| j (c) blind to another run's lock: `mutation-killed`, exit 0 | changed:213 |

### The review's `twoStores`, at the head

`S/scripts/attack.sh` runs the review's `attacks.mjs` and `lib.mjs`, copied under `S/rv/` with
only their scratch root changed, against a `git archive` of the head
(`S/out/twoStores-head-{bun,node}.out`). Then `S/scripts/twostores-finish.sh` runs the restore from
`pkg/a` (`S/out/twoStores-finish.out`). On bun (node is the same):

```
"restoreFromB": { "code": 2, "out": "mutation: refused: the lock is the run's of the store at pkg/a in this
  worktree, and this store is at pkg/b; nothing was written, and the lock stays\nmutation: run it from that
  store: cd S/rv/repos/twoStores-bun/pkg/a && S/rv/cli-aa57df3/bin/mstack verify --restore\n" },
"bX": "B's own committed x\n", "bNew": "B's untracked work\n", "bShared": "export const shared = 1;\n",
"bGone": "export const gone = 1;\n",
"gateB": ["[fail]  the mutation lock ... 4 path(s): the run is not running (no such process) -> run cd
  S/rv/repos/twoStores-bun/pkg/a && S/rv/cli-aa57df3/bin/mstack verify --restore"]
== bun: verify --restore from pkg/a
mutation: restored 4, tree verified, lock removed
-- git status --short (the store's own files left out)
?? ../b/src/new.js
-- lock: gone
-- B: tracked files as committed; src/new.js: B's untracked work
```

The script's `lost` lists A's three files: the script stops with A still reverted under its lock,
and their HEAD content is in the run's staging until the restore from `pkg/a`. The review's
`plain`, `editA`, `editNew` and `lockDeleted`, bun and node, at the head: as the review found (killed; (a);
(a); (c)), nothing lost, and `lockDeleted` now ends its restore with `no lock of this run's was at
its name, so none was removed` (`S/out/attacks-head-{bun,node}.out`). Its `helperRace-3` and
`-10`, both runtimes: the check is killed before it writes its pid, and the restore is 0, then
"nothing to restore" (`S/out/helperRace-head-{bun,node}.out`).

### The docs

- **Gates-and-Hooks.** The transcript comes from `S/scripts/wiki-gate.sh` (`S/wiki/gate.txt`,
  `S/wiki/{rescue,kill}.run.txt`). A run's reverted file was saved to during its tests, so the
  restore rescued it; a second run was then killed with `kill -9`. The CLI is an archive of the
  head. The page says `<scratch>` stands for the scratch directory and the host is `devbox`.
- **The-CLI.** The timings come from `S/scripts/timing.sh` (`S/out/timing-head.out`). The caller
  was SIGKILLed 0, 3, 10, 30, 100, 300 and 1000 ms after the spawn, 5 times each per runtime. No
  process of the command was left after at most 264 ms; kills at 0 to 10 ms took 18 to 46 ms.
  At `8481846` the same kills at 0 to 10 ms left it alive past 5 s, 15 of 15 per runtime
  (`S/out/timing-base.out`).
- **The tree-clean note** rests on the review's `review42r2/out/gitkill.out`, beside `impl42r6/`.
- **The four `verify` transcripts** were rerun at the head with stage 4's script
  (`S/scripts/wiki-cli.sh`, `S/out/wiki-cli.out`). They give the same lines, up to ids, pids,
  shas, times and paths, and the keys `mutation:708df9d8b0f7ac81` and `mutation:12b5aef8361b07f7`.

### Checks, at the head (`S/scripts/final.sh`, `S/out/final-*`)

```
$ bun run typecheck                            # bunx --bun tsc --noEmit: exit 0
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
110 relative links checked, 0 broken
$ bun run test:bun                             # S/out/final-suite-bun.txt
 1096 pass
 2 skip
 0 fail
Ran 1098 tests across 57 files. [341.46s]
$ bun run test:node                            # S/out/final-suite-node.txt
ℹ tests 1098
ℹ pass 1098
ℹ fail 0
$ pgrep -fl 'mutation-holder|run-helper'       # after both suites: nothing (exit 1)
```

1086 + 12 new = 1098; the 2 bun skips are stage 2's node-only fsync tests. Nothing failed, so
nothing was rerun. The suites ran on the working tree of `aa57df3` plus this report.

### Ten runs (`S/scripts/ten.sh`, `S/ten/<rt>.<file>.<n>.out`)

```
tests/mutation-two-stores.test.ts: bun failures 0 of 10, node failures 0 of 10
tests/run-async.test.ts: bun failures 0 of 10, node failures 0 of 10
tests/mutation-gate.test.ts: bun failures 0 of 10, node failures 0 of 10
tests/mutation-hook.test.ts: bun failures 0 of 10, node failures 0 of 10
tests/mutation-changed.test.ts: bun failures 0 of 10, node failures 0 of 10
tests/mutation-cli.test.ts: bun failures 0 of 10, node failures 0 of 10
pgrep after the ten runs: nothing (exit 1)
```

## Where the code differs from the design row or `design.md`, and why

The brief and the design row agree on every point I took; nothing of the row was overridden.
"(row)" marks a decision row of this pass; where an item changes what design.md describes, the
commit that made it changed design.md too.

1. **Where the directory is named** (row). The gate and R1 add `cd <dir> &&` only when the lock is
   another store's, so the one-store lines the wiki pastes stay as they are. The hook always adds
   it, since it has no store of its own. When `--show-toplevel` fails (a `cwd` inside `.git`),
   the reason names the store relative to the top level instead.
2. **The refusal comes before `liveness`** (row). Whether the run is alive is decided in the
   lock's own store, and both refusals write nothing.
3. **`shellWord` moved** from `mutation-tree.ts` to `mutation-lock.ts`, so the gate, R1 and the
   hook can quote the directory without an import cycle. This is detail.
4. **NB8's reading** (row). The review says a vanished temp file throws. A capture file that is
   gone did not throw, because `existsSync` guarded it, but its tail was empty, which reads as
   "printed nothing". One that exists and cannot be read did throw. The text goes in `tail`, not
   in `error`, because `classify` reads `error` as blocked and the exit code is still the
   command's answer.
5. **The hook's reason for an unreadable lock** still ends `'mstack gate' says the same`, as
   design.md and `hook:125` have it.
6. **`Restored.lockRemoved`** is the one field added, for NB7.
7. **N1b survives** (row). See the mutant table.

## R to test

All 28 rows of `impl_mutation-check_r5.md` are carried over with every citation; this pass's
tests are added to R12, R13, R16, R18, R24, R26 and R27. `S/scripts/checklines.mjs` was run on this
file and found every cited line to be a `test(`, `caseTest(`, `nodeOnly(` or `userTest(` line
(output below the table). No `test(` line of an earlier test moved: new tests are appended, and
the fixtures were changed in place.

| R | Test | Where |
|---|---|---|
| R1 | refusals with no staging; an unreadable start blob; an operation in progress in a linked worktree; neither flag or both; `--timeout`; a lock taken after the staging | tests/mutation-refusals.test.ts:102, tests/mutation-refusals.test.ts:110, tests/mutation-refusals.test.ts:121, tests/mutation-refusals.test.ts:131, tests/mutation-refusals.test.ts:147, tests/mutation-refusals.test.ts:157, tests/mutation-refusals.test.ts:168, tests/mutation-refusals.test.ts:179, tests/mutation-refusals.test.ts:196, tests/mutation-lock.test.ts:176, tests/mutation-refusals.test.ts:376, tests/mutation-cli.test.ts:104, tests/mutation-cli.test.ts:118, tests/mutation-run.test.ts:380 |
| R2 | before the baseline; skip-worktree; assume-unchanged; flagged under the store; the cap of ten; the tree moved during the baseline; an untracked test or a tracked doc edited during it; HEAD moved before the staging | tests/mutation-refusals.test.ts:211, tests/mutation-refusals.test.ts:224, tests/mutation-refusals.test.ts:237, tests/mutation-refusals.test.ts:251, tests/mutation-refusals.test.ts:265, tests/mutation-refusals.test.ts:278, tests/mutation-refusals.test.ts:330, tests/mutation-refusals.test.ts:340, tests/mutation-refusals.test.ts:350, tests/mutation-refusals.test.ts:360, tests/mutation-run.test.ts:98, tests/mutation-run.test.ts:113, tests/mutation-run.test.ts:347, tests/mutation-run.test.ts:436 |
| R3 | the refused shapes | tests/mutation-shapes.test.ts:90, tests/mutation-shapes.test.ts:103, tests/mutation-shapes.test.ts:112, tests/mutation-shapes.test.ts:127, tests/mutation-shapes.test.ts:139, tests/mutation-shapes.test.ts:161, tests/mutation-shapes.test.ts:178, tests/mutation-shapes.test.ts:191, tests/mutation-shapes.test.ts:208 |
| R4 | merges | tests/mutation-shapes.test.ts:229, tests/mutation-shapes.test.ts:248, tests/mutation-shapes.test.ts:267, tests/mutation-shapes.test.ts:284 |
| R5 | the running CLI; `bin/mstack verify --mutation` in a copy of the CLI | tests/mutation-refusals.test.ts:297, tests/mutation-cli.test.ts:303 |
| R6 | a recorded green; a stale one | tests/mutation-run.test.ts:74, tests/mutation-run.test.ts:87 |
| R7 | a red baseline; a timed-out one | tests/mutation-run.test.ts:125, tests/mutation-run.test.ts:139 |
| R8 | the lock first; a linked worktree; two at once; leftovers; a rescue kept; a swept staging writes nothing; a directory the sweep cannot remove; `discard` | tests/mutation-lock.test.ts:38, tests/mutation-lock.test.ts:66, tests/mutation-lock.test.ts:91, tests/mutation-lock.test.ts:119, tests/mutation-lock.test.ts:142, tests/mutation-revert.test.ts:246, tests/mutation-lock.test.ts:320, tests/mutation-lock.test.ts:337 |
| R9 | the set; 3 MiB; added, deleted, modified, renamed; bytes and bits; line endings; the index; directories; a 100755 start file | tests/mutation-set.test.ts:119, tests/mutation-lock.test.ts:157, tests/mutation-revert.test.ts:40, tests/mutation-revert.test.ts:63, tests/mutation-revert.test.ts:87, tests/mutation-revert.test.ts:101, tests/mutation-revert.test.ts:114, tests/mutation-revert.test.ts:330 |
| R10 | not in the set; untouched files; an untracked file in a removed or a made directory; nothing through a symlinked parent | tests/mutation-set.test.ts:72, tests/mutation-set.test.ts:91, tests/mutation-set.test.ts:106, tests/mutation-revert.test.ts:134, tests/mutation-revert.test.ts:315, tests/mutation-restore.test.ts:478, tests/mutation-revert.test.ts:345, tests/mutation-restore.test.ts:570 |
| R11 | unwritable; changed since the lock; before the lock; before the rename; an added file edited; a staged copy changed or deleted; the run runs nothing and is blocked; its restore keeps the change | tests/mutation-revert.test.ts:161, tests/mutation-revert.test.ts:191, tests/mutation-revert.test.ts:205, tests/mutation-revert.test.ts:218, tests/mutation-revert.test.ts:231, tests/mutation-revert.test.ts:277, tests/mutation-run.test.ts:230, tests/mutation-run.test.ts:261 |
| R12 | the async runner; killed; a build failure; 128+n; survived; 127; a hang; `classify`; a capture file gone or unreadable | tests/run-async.test.ts:111, tests/run-async.test.ts:121, tests/run-async.test.ts:136, tests/run-async.test.ts:143, tests/run-async.test.ts:153, tests/mutation-run.test.ts:155, tests/mutation-run.test.ts:168, tests/mutation-run.test.ts:177, tests/mutation-run.test.ts:186, tests/mutation-run.test.ts:197, tests/mutation-run.test.ts:213, tests/mutation-run.test.ts:398, tests/run-async.test.ts:279 |
| R13 | clean; whole bits; another file; SIGKILL in a write; the proof; S at a path HEAD lacks; another run's lock; fsync before the unlink (node); an error right after the lock; the restore's line says lock removed only when it removed it | tests/mutation-restore.test.ts:69, tests/mutation-restore.test.ts:96, tests/mutation-restore.test.ts:120, tests/mutation-restore.test.ts:138, tests/mutation-restore.test.ts:458, tests/mutation-restore.test.ts:512, tests/mutation-restore.test.ts:556, tests/mutation-restore.test.ts:664, tests/mutation-run.test.ts:410, tests/mutation-changed.test.ts:230 |
| R14 | rescued; before the rename; a directory; a case variant; left where HEAD lacks; a second incident; the EXDEV copy; its fsync (node) | tests/mutation-restore.test.ts:160, tests/mutation-restore.test.ts:175, tests/mutation-restore.test.ts:195, tests/mutation-restore.test.ts:214, tests/mutation-restore.test.ts:231, tests/mutation-restore.test.ts:254, tests/mutation-restore.test.ts:286, tests/mutation-restore.test.ts:642 |
| R15 | read-only; missing staged copy; parent by case; a staged copy not H; a rescue that cannot be made; the lock written again; exit 3 over every other code, a signal included | tests/mutation-restore.test.ts:305, tests/mutation-restore.test.ts:339, tests/mutation-restore.test.ts:359, tests/mutation-restore.test.ts:498, tests/mutation-restore.test.ts:675, tests/mutation-changed.test.ts:114, tests/mutation-cli.test.ts:281, tests/mutation-signals.test.ts:270 |
| R16 | the runner: stop(), SIGINT, the handler, SIGKILL alone and of the group; the run: SIGTERM alone, SIGINT to the group, SIGHUP in the baseline, SIGKILL; a caller killed in the first milliseconds after the spawn | tests/run-async.test.ts:163, tests/run-async.test.ts:182, tests/run-async.test.ts:198, tests/run-async.test.ts:219, tests/run-async.test.ts:235, tests/mutation-signals.test.ts:93, tests/mutation-signals.test.ts:111, tests/mutation-signals.test.ts:127, tests/mutation-signals.test.ts:145, tests/run-async.test.ts:251 |
| R17 | no child in the restore; SIGINT in the restore, once and twice; at `lock-written`; at `reverted:0`; in prepare | tests/mutation-restore.test.ts:386, tests/mutation-signals.test.ts:169, tests/mutation-signals.test.ts:186, tests/mutation-signals.test.ts:205, tests/mutation-signals.test.ts:223, tests/mutation-signals.test.ts:241 |
| R18 | (a) an edit; (b) a commit; (c) the lock deleted; (d) a git add, a tracked test rewritten; (e) an untracked test edited, an output file; an added path edited; another run's lock | tests/mutation-changed.test.ts:33, tests/mutation-changed.test.ts:47, tests/mutation-changed.test.ts:57, tests/mutation-changed.test.ts:69, tests/mutation-changed.test.ts:79, tests/mutation-changed.test.ts:90, tests/mutation-changed.test.ts:102, tests/mutation-changed.test.ts:194, tests/mutation-changed.test.ts:213 |
| R19 | HEAD moved; another branch; the index line; left in place and changed, without a cause | tests/mutation-changed.test.ts:139, tests/mutation-changed.test.ts:152, tests/mutation-changed.test.ts:165, tests/mutation-changed.test.ts:176 |
| R20 | six cells; receipts() and status() ignore the rows; no row after a failed restore; a survived row | tests/mutation-run.test.ts:286, tests/mutation-run.test.ts:299, tests/mutation-run.test.ts:314, tests/mutation-run.test.ts:428 |
| R21 | the key; a newline; git cannot list; a name not UTF-8; the run does not move its own key | tests/mutation-set.test.ts:167, tests/mutation-set.test.ts:188, tests/mutation-set.test.ts:206, tests/mutation-set.test.ts:218, tests/mutation-set.test.ts:234, tests/mutation-set.test.ts:254, tests/mutation-set.test.ts:281, tests/mutation-set.test.ts:295, tests/mutation-set.test.ts:307, tests/mutation-set.test.ts:336, tests/mutation-run.test.ts:336 |
| R22 | killed at four steps; no lock; `kill -9` of the CLI, then `verify --restore` | tests/mutation-restore.test.ts:420, tests/mutation-restore.test.ts:428, tests/mutation-restore.test.ts:437, tests/mutation-restore.test.ts:445, tests/mutation-cli.test.ts:174, tests/mutation-cli.test.ts:189 |
| R23 | liveness; the R1 refusal says alive or not; EPERM; a live run refused, no `--force`; another host refused | tests/mutation-lock.test.ts:222, tests/mutation-lock.test.ts:236, tests/mutation-lock.test.ts:249, tests/mutation-refusals.test.ts:179, tests/mutation-lock.test.ts:279, tests/mutation-cli.test.ts:215, tests/mutation-cli.test.ts:326 |
| R24 | bad paths; damaged; a temp prefix; folded duplicates; a symlink or FIFO; the restore's own check; a path outside the root; an unparseable lock and git stash; two stores, in place and moved; a lock with no rootFromTop | tests/mutation-lock.test.ts:195, tests/mutation-lock.test.ts:210, tests/mutation-lock.test.ts:268, tests/mutation-lock.test.ts:285, tests/mutation-lock.test.ts:296, tests/mutation-restore.test.ts:539, tests/mutation-cli.test.ts:245, tests/mutation-cli.test.ts:269, tests/mutation-two-stores.test.ts:199, tests/mutation-two-stores.test.ts:203, tests/mutation-two-stores.test.ts:207 |
| R25 | the gate's line; the hook's reason; the lines printed at the lock; no `sh` with the lock | tests/mutation-gate.test.ts:142, tests/mutation-hook.test.ts:158, tests/mutation-cli.test.ts:137, tests/mutation-cli.test.ts:158 |
| R26 | shapes caught; every listed command; shapes not caught; no git for an unrelated command; no lock or git cannot answer; an unparseable lock; rm of the lock; an unreadable lock's reason; --git-dir and --work-tree with a space | tests/mutation-hook.test.ts:67, tests/mutation-hook.test.ts:78, tests/mutation-hook.test.ts:91, tests/mutation-hook.test.ts:101, tests/mutation-hook.test.ts:113, tests/mutation-hook.test.ts:125, tests/mutation-hook.test.ts:138, tests/mutation-hook.test.ts:173, tests/mutation-hook.test.ts:184 |
| R27 | a lock and no active item; running, not running, cannot tell; unparseable; the Stop hook; gate --full; an unreadable lock's line; gate --full under an unparseable lock | tests/mutation-gate.test.ts:60, tests/mutation-gate.test.ts:74, tests/mutation-gate.test.ts:98, tests/mutation-gate.test.ts:109, tests/mutation-gate.test.ts:123, tests/mutation-gate.test.ts:224, tests/mutation-gate.test.ts:238 |
| R28 | a rescue that holds anything; a linked worktree's rescue; prune | tests/mutation-gate.test.ts:179, tests/mutation-gate.test.ts:196 |

```
$ node S/scripts/checklines.mjs .mstack/progress/impl_mutation-check_r6.md
28 rows, 208 citations, 0 not a test line, ids missing: none
```

Rung: the run, the restore, the gate and the hook are at rung 4 on macOS (APFS, case-insensitive;
git 2.54.0; node v26.13.1; bun 1.3.11). Every test drives the real code on a real repository,
and the CLI tests run `bin/mstack` as a child. The gate transcript, the timings and `twoStores`
are rung 5, from real runs of an archive of the head. Not run: Linux, a case-sensitive disk, a
second filesystem.
