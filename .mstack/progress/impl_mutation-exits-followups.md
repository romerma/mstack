# Implementation - mutation-exits-followups (item 105)

Direct path, A1 to A4. Base `819c9a3`, start `1c36e03`, code head `9f39f15`. Scratch `S` =
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl105/`
(scripts in `S/scripts/`, fixtures in `S/fx/`, output in `S/out/`). `<W>` is a fixture's directory.

## What changed

**A1.** `restoreCommand` (`src/mutation-lock.ts`) no longer decides by existence. A new
`cannotRun(cli)` asks what `bin/mstack` needs before it execs a runtime: `stat` follows the path to
a regular file, `access(X_OK)` passes, and `src/cli.ts` is a regular file at
`<its directory>/../src/` once the file's own symlinks are followed the way the launcher's `[ -L ]`
loop follows them. It uses `stat`, `access` and `readlink`, and starts no child process. When the
writer can run, it is still the command. Otherwise the lead names it, `is gone` or `cannot run (it
is a directory | it is not executable | its src/cli.ts is missing)`, and the running CLI is the one
command. The gate, R1, the hook, the restore's refusals, the run's own lines and R15's line all go
through `restoreCommand`, so all of them changed together.

**A2.** `rootDisagrees(lock, dir, top)` checks the lock's `root` against its `rootFromTop`. It
says nothing in these cases: `root` is the store's directory (by name, or by device and inode),
nothing is at `root`, or git places `root` outside this worktree. It is a disagreement only when
git places `root` in this worktree somewhere other than `rootFromTop`. `inLockStore`,
`fromLockStore` and `restoreRun` call it. With a disagreement, the restore refuses from either store
(exit 2, nothing written, the by-hand recovery), and the gate, R1 and the hook give the by-hand way
with no `cd`.

**A3.** Six tests built the running CLI's path bare, and now build it with `shellWord`.

**A4.** Both `rm` guards match in any case: rm's name, its flags and the path. The `gh` guard
matches gh's name in any case and keeps `pr merge` and `--admin` as gh spells them. Item 42's
spec and design are amended (list below), along with the wiki and the CHANGELOG.

## Design row for A2, and the cases walked

Row of 2026-11-20T02:09:45Z (`design`), recorded before any code. Proof: **the lock's own two
records of its store must agree**. The run writes `root` and `rootFromTop` together
(`prepareRun`), so they disagree only after an edit. The review's edit changes `rootFromTop` and
leaves `root` on A.

- (a) A real dead run, restored from the right store. The check reads two lock fields and two
  directories and never the tree, so the tree state cannot change its answer. In every state of
  the walk `root` is this store's directory, string-equal, and the restore behaves as before. Run
  below after a SIGKILL at six steps: before the revert, between two revert writes, inside a revert
  write, obligations running, between two restore writes, inside a restore write.
- A moved checkout: `root` names no directory, so the lock is accepted, as R24 requires. The test
  `tests/mutation-two-stores.test.ts:203` stays green, and mutant M2d (a gone `root` counts as a
  disagreement) is killed by it.
- A copied checkout, or a path reused after a move: git places `root` in another worktree, so the
  lock is accepted (test control; mutant M2c killed).
- `root` spelled through a symlink: the same inode, so the lock is accepted (test control).
- (b) Old locks: there is no new field, so a lock written before this change is read by the same
  rule. Ran below: a lock written by `1c36e03`, restored by the head, exit 0.
- Lost, recorded in the row: a check of the tree. It refuses a real dead run whose paths were edited
  after the death, or whose item only deletes files and died before the revert, and it passes a
  store that commits the same bytes (`twoStores` does). Also lost: a new field in the store, which
  writes in the store and needs a second rule for old locks.
- Not caught: an edit of both fields so they agree, and an edit of `rootFromTop` after the
  checkout moved (`root` then names nothing).
- Cost: under a lock no one edited, the hook starts 3 git processes at the base and 3 at the head,
  from A and from B. Under the edited lock it starts 4 (`S/scripts/hook-git-calls.sh`).

## Red first

```
A1 (bun, tests at 2973b73, code at 3fc73c3; S/out/red-exits-bun.txt)
(fail) A1 (item 105) restoreCommand offers the writer's CLI only when it can run, ...
  AssertionError: a directory
  +   command: `'<T>/writer dir'\''s "q" x/bin/mstack' verify --restore`,  lead: ''
  -   command: '/opt/running/bin/mstack verify --restore', lead: `the CLI that wrote the lock, ..., cannot run (it is a directory); `
(fail) A1 (item 105) the writer's CLI path holds a directory | a file without the execute bit | a copy whose src/ is gone ...
  AssertionError: the gate in A, the writer a directory
  + `run '<T>/writer dir'\''s "q" x/bin/mstack' verify --restore`
A2 (same run)
(fail) A2 (item 105) a lock edited so its rootFromTop names another real store ...
  AssertionError: B, which the edit names: mutation: lock from pid 2900 (not running: no such process), ... 1 path(s)
  mutation: 0 at HEAD, 0 as the revert wrote them, 1 other
  mutation: restored 1, tree verified, lock removed            0 !== 2
A3 (the whole suite from S/spaced/my code/base at 1c36e03; S/out/spaced-base-meta.txt)
  bun 1124 pass 3 skip 6 fail; node 1126 pass 6 fail 1 skipped; on both:
  R25 the run prints the lock ... | R15 exit 3 when the restore fails ... | R25 the deny reason names the lock's CLI |
  R25 the gate line names the lock's CLI ... | A2 from inside the git directory ... | R1 an existing lock is refused naming its pid
A4 (bun; S/out/red-hooks-bun.txt)
  AssertionError: allowed, though on a disk that folds case each one runs
  + "RM -rf .mstack", "Rm -rf .mstack", "/bin/RM -rf .mstack", "rm -rf .MSTACK", "RM -RF .Mstack*",
  + "RM .git/mstack-mutation.lock", "rm .git/MSTACK-MUTATION.LOCK", "cd x && Rm -f /repo/.git/Mstack-Mutation.lock",
  + "GH pr merge 3 --admin", "Gh pr merge 3 --admin"
```

The gate's R25 test (`tests/mutation-gate.test.ts:143`) also went red under A1's code:
`cannot run (it is not executable)`. Its writer was a mode-644 file with no `src/` beside it. The
fixture became a CLI that can run and the assertions stayed the same; that change is its own commit
(`0b39697`, decision row 02:26:17Z) and passes at the base.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | restoreCommand per state, a symlink to a runnable copy; each printer from A and B, three states, line run via sh; the gate's R25 | tests/mutation-exits.test.ts:652, tests/mutation-exits.test.ts:680, tests/mutation-gate.test.ts:143 |
| A2 | edited lock refused from B and A by the restore, gate, R1 and hook, nothing written; symlink and other-worktree controls; the moved checkout | tests/mutation-exits.test.ts:712, tests/mutation-two-stores.test.ts:203 |
| A3 | the six tests that now assert the quoted form | tests/mutation-refusals.test.ts:179, tests/mutation-exits.test.ts:563, tests/mutation-gate.test.ts:143, tests/mutation-hook.test.ts:159, tests/mutation-cli.test.ts:137, tests/mutation-cli.test.ts:281 |
| A4 | rm and gh in any case, deny and allow lists | tests/hooks.test.ts:511 |

Each `Where` printed back with `bat -pp -r`, for example
`tests/mutation-exits.test.ts:680:   test(\`A1 (item 105) the writer's CLI path holds ${kind}: ...`
and `tests/mutation-cli.test.ts:281: userTest("R15 exit 3 when the restore fails, ...`.

## Mutants

Each mutant ran in a fresh archive of `9f39f15`, under `S/mut/<name>`, against the five files that
pin the item (`mutation-exits`, `mutation-gate`, `mutation-two-stores`, `hooks`, `mutation-hook`)
under bun (`S/scripts/mutants.sh`, `S/scripts/mutate.mjs`, `S/out/mutants.txt`).

| Mutant | Test that fails (`tests/mutation-exits.test.ts` unless named) | Result |
|---|---|---|
| M1a `cannotRun` skips the regular-file check | `:652`, `:680` (a directory) | killed |
| M1b skips `access(X_OK)` | `:652`, `:680` (mode 644) | killed |
| M1c skips the `src/cli.ts` check | `:652`, `:680` (src/ gone) | killed |
| M1d does not follow the file's symlinks | `:652` (the symlink to a runnable copy) | killed |
| M1e always offers the running CLI, the rejected plan | `:652`, `tests/mutation-gate.test.ts:143`, item 101's A1 (`:183`) | killed |
| M1f decides by existence again, as at the base | `:652`, `:680` (all three) | killed |
| M2a `rootDisagrees` always null | `:712` | killed |
| M2b drops the device and inode check | none: 5 files 62 pass 1 skip 0 fail; whole bun suite 1136 pass 3 skip 0 fail of 1139 | survived |
| M2c drops the other-worktree check | `:712` (the other-worktree control) | killed |
| M2d a `root` that is gone counts as a disagreement | `tests/mutation-two-stores.test.ts:203` (moved checkout), `tests/mutation-hook.test.ts:159` | killed |
| M2e `fromLockStore` skips the check (the gate and R1 in B) | `:712` | killed |
| M2f `inLockStore` skips it (the hook, and every printer in A) | `:712` | killed |
| M2g `restoreRun` skips it | `:712` | killed |
| M4a the store rule without `i` | `tests/hooks.test.ts:511` | killed |
| M4b the lock rule without `i` | `tests/hooks.test.ts:511` | killed |
| M4c gh's name lower case only | `tests/hooks.test.ts:511` | killed |
| M4d the whole gh rule folded | `tests/hooks.test.ts:511` (`GH PR merge` denied) | killed |

16 of 17 are killed. M2b is equivalent in behaviour. When `root` is another spelling of this
store's directory, git places it at `rootFromTop` anyway, so the answer is the same. The inode
check only saves that one `git rev-parse`, and no test asserts the number of git calls.

## Real surface

**A1** (`S/fx/a1.mjs` through `S/scripts/surface-a1.sh`; `S/out/a1-before.txt`, `S/out/a1-after.txt`).
For each case, a copy of the CLI at `<W>/old cli` ran `verify --mutation` in store A and was killed
with `kill -9` while A's check slept on the reverted tree. The writer's path was then made a
directory, a mode-644 file, or a copy with `src/` removed. A second copy, the running CLI, was
asked by the gate, R1 and the hook from A, and by those three plus `verify --restore` from B. The
one command each line offers was cut from the printed text and run through `/bin/sh -c` and
`/bin/dash -c` from where it was printed. That makes 21 printers per runner and 42 lines.

```
before (runner 1c36e03): 0 of 42 ran: 28 exit 126 ("is a directory", "Permission denied"), 14 exit 127 ("src/cli.ts is missing"), lock kept
after  (runner 9f39f15): 42 of 42 offered lines ran as printed, exit 0, lock gone, A back at NEW, nothing in B
== a directory at the writer's path: R1 (B), run via /bin/sh: mutation: the CLI that wrote the lock, '<W>/old cli/bin/mstack',
   cannot run (it is a directory); cd '<W>/top/pkg/a' && '<S>/fx/new cli head/bin/mstack' verify --restore puts the tree back ...
   offered "cd '<W>/top/pkg/a' && '<S>/fx/new cli head/bin/mstack' verify --restore": exit 0, lock gone; "mutation: restored 1, tree verified, lock removed"
== a file at the writer's path, mode 644: hook (B): ... the CLI that wrote the lock, '<W>/old cli/bin/mstack', cannot run (it is not executable); wait for it, or if it is not running, run cd '<W>/top/pkg/a' && '<S>/fx/new cli head/bin/mstack' verify --restore
   the run's own line, printed before the kill: mutation: if this process dies: '<W>/old cli/bin/mstack' verify --restore
```

**A2** (`S/fx/a2.mjs` through `S/scripts/surface-a2.sh`; `S/out/a2-before.txt`, `S/out/a2-after.txt`).
This is the review's repro: a real run in A, killed with `kill -9`, then its lock's `rootFromTop`
edited to `pkg/b`.

```
before (runner 1c36e03): restore (B): exit 0: ... 0 at HEAD, 0 as the revert wrote them, 2 other | restored 2, tree verified, lock removed
   after (B): status "M pkg/a/src/x.js\n M pkg/a/src/z.js\n?? pkg/b/src/x.js\n?? pkg/b/src/z.js" | lock none | A/x "OLD\n" B/x "NEW\n"
after (runner 9f39f15):
   gate (B): -> no verify --restore takes this lock: it names its store pkg/b, and its root <W>/top/pkg/a is the store at pkg/a in this
      worktree, so the lock was edited and whose it is cannot be told; by hand, for a person at a terminal (...): 'git stash push --include-untracked' ...
   restore (B): exit 2: mutation: refused: the lock <W>/top/.git/mstack-mutation.lock names this store, at pkg/b, and its root <W>/top/pkg/a
      is the store at pkg/a in this worktree, so the lock was edited and whose it is cannot be told; nothing was written, and the lock stays | mutation: by hand, ...
   restore (A): exit 2: mutation: refused: the lock is the run's of the store at pkg/b in this worktree, and this store is at pkg/a; ... | mutation: no verify --restore takes this lock: ... | mutation: by hand, ...
   R1 (B), R1 (A): exit 2, the gate's words; hook (B), hook (A): "... so the way out is by hand, ...; 'mstack gate' says the same"
   after (B) and after (A): status, lock hash, run directory listing, A/x "OLD\n", B/x absent  [unchanged]
   by hand: git stash push --include-untracked: exit 0; rm the lock; then: A/src/x.js "NEW\n", the stash holds: ["-NEW","+OLD","-new z","+old z"], status ""
== SIGKILL at lock-written: x "NEW\n", z "new z\n", lock there; from B: exit 2; from A: exit 0: 2 at HEAD, 0 as the revert wrote them, 0 other | restored 0, tree verified, lock removed; tree as before the run: true
== SIGKILL at reverted:0: x "OLD\n", z "new z\n"; from B: exit 2; from A: exit 0: 1 at HEAD, 1 as the revert wrote them | restored 1 ...; true
== SIGKILL at revert-written:1: x "OLD\n", z "new z\n", temps 1; from B: exit 2; from A: exit 0: restored 1 ...; true
== SIGKILL at obligations-running: x "OLD\n", z "old z\n"; from B: exit 2; from A: exit 0: 0 at HEAD, 2 as the revert wrote them | restored 2 ...; true
== SIGKILL at restored:0: x "NEW\n", z "old z\n"; from B: exit 2; from A: exit 0: restored 1 ...; true
== SIGKILL at restore-written:1: x "NEW\n", z "old z\n", temps 1; from B: exit 2; from A: exit 0: restored 1 ...; true
== a lock written by 1c36e03 (16 fields), restored from A by the head: exit 0: mutation: restored 2, tree verified, lock removed; A/src/x.js "NEW\n"
```

The SIGKILL states come from `tests/mutation-run-holder.ts` of the head archive: `runMutation` in
a process group of its own, blocked at the step, then the group SIGKILLed. That is the run's own
code, driven by the test seam rather than by the `bin/mstack` binary.

**A4** (`S/scripts/surface-a4.sh`), the hook's answer from the base and from the head:

```
RM -rf rmx/.mstack, rm -rf rmx/.MSTACK, RM .git/mstack-mutation.lock, rm .git/MSTACK-MUTATION.LOCK, GH pr merge 1 --admin:  base allowed, head denied
GH PR merge 1 --admin, gh pr MERGE 1 --admin, RM -rf node_modules:  base allowed, head allowed
RM -rf rmx/.MSTACK: exit 0; rmx/.mstack/state.json is gone afterwards (this disk folds case)
```

## Suites

```
checkout, 9f39f15 (S/out/suites-meta.txt; load 6.8 at the start, 24.3 after, the mutants running alongside)
  bun run test:bun    1136 pass  3 skip  0 fail   Ran 1139 tests across 59 files. [393.96s]
  bun run test:node   tests 1139  pass 1138  fail 0  skipped 1
  bun run typecheck   exit 0
  ./bin/mstack lint-plugin .   PASSED - 0 failures, 0 warnings
  node scripts/check-doc-links.mjs README.md docs/wiki/*.md   112 relative links checked, 0 broken
copy of 9f39f15 under "S/spaced/my code/head" (S/out/spaced-head-meta.txt; base at 1c36e03 had 6 fail per runtime)
  bun test ./tests    1136 pass  3 skip  0 fail   Ran 1139 tests across 59 files. [386.43s]
  node --test         tests 1139  pass 1138  fail 0  skipped 1
```

1139 tests is 1133 plus the six new ones (A1: one unit test and three per-state tests; A2: one; A4:
one).

Dash as `sh` (`S/scripts/dash.sh`, `S/out/dash.txt`): a copy of the head in which `src/run.ts`,
`src/run-helper.mjs`, `bin/mstack`'s `#!` and `tests/mutation-exits.test.ts`'s `"/bin/sh"` are
`/bin/dash`, with `sh` first on `PATH` linked to dash. The results: `mutation-exits` bun 15 pass
1 skip and node 15/1 skipped; `hooks` 24/24; `mutation-gate` 10/10; `mutation-hook` 10/10;
`mutation-refusals` 21/21; `mutation-cli` 12/12; `mutation-two-stores` 3/3; 0 fail anywhere.

Ten runs per runtime of each new or changed test file, a fixed-count `for` in a copy of the head
(`S/scripts/ten.sh`, `S/out/ten.txt`; load 8.2 at the start, 8.5 at the end). Every file failed
0 of 10 on bun and 0 of 10 on node: `mutation-exits` (15 pass each run), `hooks` (24),
`mutation-gate` (10), `mutation-hook` (10), `mutation-refusals` (21), `mutation-cli` (12). That
is 120 runs with 0 failures.

Each commit was checked in its own archive (`S/scripts/per-commit.sh`, `S/out/per-commit.txt`).
`tsc` exits 0 at every commit, and every touched file passes under bun at every commit.

## The commands the hook guards, and what each matches

From `src/hooks.ts` (`GUARDS`, then `LOCKED_GIT` under a lock):

| Guard | Name | Rest |
|---|---|---|
| `git push --force` / `-f`; `git push +refspec`; `git reset --hard`; `git branch -D` and its spellings | git's in any case since item 101 (row 325) | as git spells it: `git COMMIT` exits 128, `--HARD` is an unknown option |
| under a lock, the 24 listed git writes | the same | the same |
| `gh pr merge --admin` | **any case** (item 105) | as gh spells it: `gh PR` is "unknown command", `--ADMIN` is "unknown flag" (gh 2.104.0 here) |
| `rm -r` of the store | **any case** | **any case**: the flags already took both, and the path folds on such a disk (`rm -rf .MSTACK` deleted the store above) |
| `rm` of the lock | **any case** | **any case**: `MSTACK-MUTATION.LOCK` is the lock on such a disk |

Effect on false denials: the only commands newly denied are ones where the word `rm`, `RM` or `gh`
stands alone before the guarded phrase, and the lower-case rules already deny those loosely within
a command. `perm -r .mstack` and `FORM .git/mstack-mutation.lock` stay allowed, and both are pinned
in the test. On a disk that is not case-folding, `rm -rf .MSTACK` names a different directory and
is now denied. Nobody uses that name.

## Spec and design sentences amended (commit 9f39f15)

- `spec.md` R1 "A lock exists" and R15: "the running CLI's when that file is gone" now reads "gone
  or cannot run".
- `spec.md` R24: a lock whose `root` git places in this worktree elsewhere than `rootFromTop` is
  refused from either store, with the by-hand recovery and no directory. New scenario: "A lock
  edited to name another store".
- `spec.md` R25: "when no file exists at that path" now reads "when what is at that path cannot run
  (nothing; a directory, a file without the execute bit, or one without `src/cli.ts` beside it)".
  New scenario: "The writing CLI cannot run".
- `spec.md` R26: the rm of the lock and the `rm -r` of the store match "in any case, rm's name and
  the path alike".
- `design.md`: "`root`, absolute, is kept for a reader and nothing is resolved against it" now
  reads "never resolved against ... checked against `rootFromTop` instead (`rootDisagrees`)", and
  names what is not caught. The `restoreCommand` bullet gains `cannotRun`. The `GUARDS` bullet gains
  the case rule. The state table gains the row "The lock edited so its `rootFromTop` names another
  store".
- Wiki: `Gates-and-Hooks.md` (the deny table, a paragraph on case, the gate's lock paragraph);
  `The-CLI.md` (what `verify --restore` refuses). `CHANGELOG.md`: one entry under Unreleased.

## Decision rows

- 02:09:45Z `design`: A2's proof (above).
- 02:26:17Z `implement`: the R25 gate test's fixture becomes a CLI that can run; its assertions are
  unchanged.
- 02:26:44Z `implement`: A3, the six tests and why none of them is weaker.
- 02:26:56Z `implement`: A1, the "can run" test, and the alternative that lost (spawning the writer).
- 02:27:17Z `implement`: A4, rm and gh in any case, and gh's subcommands not folded.

No finding was left unapplied.

## Not done

- In the *cannot be told* case (a lock from another host), "can run" is still decided on this host,
  as "gone" was before (review r2 NB1, the second half). It was not reproduced on a second host and
  is outside A1's three states.
- The hook's branch for a cwd inside `.git` (no top level) does not call `rootDisagrees`, because it
  has no directory to compare. For an edited lock it names the store to run from, and the restore
  there then refuses with the by-hand way, so it does not loop.
- Review r2 NB4 (X2 and X3, the gone-CLI clause unpinned in R15's line and in the hook from inside
  `.git`) is not in item 105's acceptance and was not touched.
