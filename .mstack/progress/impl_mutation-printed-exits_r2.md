# Implementation, round 2 - mutation-printed-exits (item 101)

Direct path, A1 to A6. Branch `fix/mutation-printed-exits`, round 1 head `efe02e4`, base
`7e96373`. This round answers `review_mutation-printed-exits.md` as decision row 323 takes it.
Scratch, `S/` below:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl101r2/`
(scripts in `S/scripts/`, output in `S/out/`). Every run of the mechanism and every lock shape was
in a repository under `S/` (tests with `TMPDIR=S/tmp`). The lock test before each commit found no
lock, file or link, in this checkout's git directory.

## What changed since round 1

- **B1, one rule for a CLI that is gone.** `restoreCommand` now returns `{ command, lead }`. A
  CLI that is gone cannot run, so it is never offered as a command. It is named in `lead`
  (`the CLI that wrote the lock, <path>, is gone; `), which goes in front of the way out. The one
  command offered is the running CLI's, with the `cd` in front of it, never in front of prose.
  `inLockStore` and `fromLockStore` carry the `lead` through, and the run's lines, the gate, R1,
  the restore's refusals and the hook all print `lead` then the command.
- **B2.** `readLock` became `readLock(store)` over `readLockAt(file)`, the one reader. The hook's
  `readLockRecord` reads through `readLockAt` (`READ_FLAGS`: `O_NOFOLLOW | O_NONBLOCK`, then
  `fstat().isFile()`) and then `checkLock`, the gate's check. So a symlink or a FIFO at the lock's
  name is a lock that cannot be read, and the hook gives the by-hand reason. This also ends the
  FIFO hang (NB3).
- **NB1.** `GIT` takes `--shallow-file` with a space. git's own name is matched in any case
  (`\b[gG][iI][tT]`); the subcommand still is not, since `git COMMIT` exits 128. `GIT` is the
  shared prefix, so `GIT push --force` is denied too (row 325).
- **NB2.** Three passages are corrected: `Gates-and-Hooks.md` (the lock rows are for the
  accidental save; `fast-import` fed a stream written for it is not covered), `src/hooks.ts`'s
  comment and `design.md`'s bullet (`read-tree -n`, the dry run, is denied with the rest).
  `fast-import` is not added to the list.
- **NB5.** The gate's *cannot be told* case with no restore line now says
  `wait for it to end; <why>; by hand ...`, which is R1's fix word for word.
- **NB6.** One test for each of the reviewer's three mutants.

## Findings

| Finding | What was done | Where |
|---|---|---|
| B1 gone-CLI line from another store | the gone CLI is named, not offered; one command, the running CLI's, behind the `cd`; A1 runs it from B for the gate, R1, the hook and the restore's refusal; R25 amended | `f925e61`; `src/mutation-lock.ts` `restoreCommand`, `inLockStore`, `fromLockStore`; `tests/mutation-exits.test.ts:182` runs 3 to 7; row 324 |
| B2 symlink at the lock's name | the hook reads through `readLockAt` and `checkLock`; new test with a symlink and a FIFO | `ea7cb01`; `src/hooks.ts` `readLockRecord`; `tests/mutation-exits.test.ts:481` |
| NB1 `--shallow-file x`, `GIT` | spaced `shallow-file`; `git` in any case | `5730661`; `src/hooks.ts` `GIT`; `tests/mutation-exits.test.ts:520`; row 325 |
| NB2 two false sentences | rewritten as above | `e6bf5bb` |
| NB3 FIFO blocks the hook | falls with B2; the test bounds the hook with a SIGKILL timeout | `tests/mutation-exits.test.ts:481` |
| NB4 hand-edited lock names another real store | not mine: row 323 sends it to a follow-up item | none |
| NB5 gate's `unknown` with no way drops "wait" | `wait for it to end; ` in front | `9652401`; `src/gate.ts` `lockProblem`; `tests/mutation-exits.test.ts:543` |
| NB6 M1, M2, M3 unpinned | a test for each, shown red under each mutant | `tests/mutation-exits.test.ts:578` (M1), `:543` (M2), `:562` (M3) |

## Files

`src/mutation-lock.ts`, `src/gate.ts`, `src/mutation.ts`, `src/mutation-run.ts`, `src/hooks.ts`,
`tests/mutation-exits.test.ts`, `tests/mutation-gate.test.ts` (R25 test),
`tests/mutation-hook.test.ts` (R25 test), `tests/mutation-refusals.test.ts` (R1 lock test),
`.mstack/specs/mutation-check/spec.md`, `.mstack/specs/mutation-check/design.md`,
`docs/wiki/Gates-and-Hooks.md`, `.mstack/decisions.tsv`, `.mstack/progress/current.md`.

## Commands

### Red first

Each new assertion was run before its fix. `<T>` is the test's temporary directory.

```
B1, A1 at efe02e4's code (bun):
AssertionError: Expected values to be strictly equal:
+ `run '<T>/gone dir'\''s "q" x/bin/mstack' verify --restore (that file is gone), or '<T>/cli dir'\''s "q" x/bin/mstack' verify --restore`
- `the CLI that wrote the lock, '<T>/gone dir'\''s "q" x/bin/mstack', is gone; run '<T>/cli dir'\''s "q" x/bin/mstack' verify --restore`
(fail) A1 every printed restore line runs as printed ... [4234.64ms]

B2, the new A2 test at f925e61's hook (symlink half):
actual: "mstack: <T>/.git/mstack-mutation.lock exists, ... It is held by pid 7075: wait for it, or if it is not
         running, run cd <T> && /.../mstack/bin/mstack verify --restore"   expected: /\bcd |verify --restore/  (doesNotMatch)

NB3, the FIFO half alone (S/scripts/red-fifo.sh, S/out/red-fifo.txt):
== at f925e61 (the hook reads with readFileSync)
AssertionError: the hook blocked on a FIFO at the lock's name until it was killed, after 20005 ms
(fail) FIFO at the lock's name: the hook answers and does not block [20271.80ms]
== with the working tree's src (readLockAt)
 1 pass   0 fail

NB1 at ea7cb01's regex:
AssertionError: git --shallow-file x commit -m x   actual: "not denied under a lock: git --shallow-file x commit -m x"

NB5 at e6bf5bb's gate:
AssertionError: The input did not match the regular expression /^wait for it to end; no verify --restore takes
this lock: it names its store pkg\/gone, and there is no directory /
```

The M1 and M3 tests pass on the code as it is: they pin branches that the code already gets
right. Their red is under the mutants below.

### Mutants

`S/scripts/mutants.sh` (`S/mut/mutate.mjs`) puts each mutant in a fresh `git archive` of `9652401`
and runs the four files that pin the lines (`mutation-exits`, `mutation-gate`, `mutation-hook`,
`mutation-refusals`) under bun. The unmutated copy passes 51, 0 fail. Rows are in `S/out/mutants.txt`.

| Mutant | Failing test(s) | Result |
|---|---|---|
| R-M1 `shellWord`'s safe set also takes `` $ ` ; & \| ( ) ! * < > ~ `` | A1 shellWord (`:578`) | killed |
| R-M2 the gate's `unknown` case with no way: `run ${way.none} where the run started` | A3 cannot be told (`:543`) | killed |
| R-M3 the hook's `top === null` guard gone | A2 from inside `.git` (`:562`) | killed |
| O-M4 the gone CLI offered as the command | A1, R25 gate, R25 hook | killed |
| O-M5 the gone CLI not named (`lead` empty) | A1, R25 gate, R25 hook | killed |
| O-M6 the gone path bare in the `lead` | A1 (its exact line) | killed |
| O-M7 the hook reads with `readFileSync` again | A2 symlink/FIFO (`:481`) | killed |
| O-M8 no spaced `--shallow-file` | A4 (`:520`) | killed |
| O-M9 `git` matched in lower case only | A4 (`:520`) | killed |
| O-M10 R1 drops the `lead` | A1 | killed |
| O-M11 the hook drops the `lead` | A1, R25 hook | killed |
| O-M12 the restore's refusal drops the `lead` | A1 | killed |
| O-M13 the gate (not running) drops the `lead` | A1, R25 gate | killed |
| O-M14 the gate (cannot be told, no way) gives only the by-hand way again | A3 (`:543`) | killed |

That is 14 of 14 killed: the reviewer's 3 and 11 of mine. Where A1 fails, the pass count drops
from about 50 to 27-29, and the fail count holds one more than the tests named. That is bun's
`node:test` shim: once an async test rejects, the next file (`mutation-refusals`) fails to load
with `NotImplementedError: test() inside another test()`, counted as one error
(`S/scripts/mutant-one.sh`, `S/out/mut-one.log`). No process is left behind (`pgrep` empty), and
the kill is the named failure.

### Real surface

`S/scripts/repro.mjs`, run by `repro-before.sh` (a copy of `efe02e4`) and by `repro-after.sh` (a
copy of the working tree). HOME is a new empty directory. The repository is `<W>/top dir`, with
stores `pkg/a` and `pkg/b`. For each case a fresh copy of the CLI, `<W>/old cli 'q'`, runs
`verify --mutation` in A. It is killed with `kill -9` while A's check sleeps on the reverted tree,
and then that copy is deleted (`rm -rf`). The running CLI is `<W>/new "cli"`. From B, each of the
four printers is read, and every command it offers is run as printed through `/bin/sh -c` and
`/bin/dash -c` from B. Below, `<OLD>` is `'<W>/old cli '\''q'\''/bin/mstack'`, `<NEW>` is
`'<W>/new "cli"/bin/mstack'` and `<A>` is `'<W>/top dir/pkg/a'`.

```
=== before (efe02e4), blocking 1; the same for sh and dash, and for all four printers
== gate (B): ... the run is not running (no such process) -> run cd <A> && <OLD> verify --restore (that file is gone), or <NEW> verify --restore
   whole: exit 2 <- /bin/sh: -c: line 0: syntax error near unexpected token `('   (dash: Syntax error: "(" unexpected)
   alternative 1: exit 127, lock STAYS <- /bin/sh: <W>/old cli 'q'/bin/mstack: No such file or directory
   alternative 2: exit 2, lock STAYS <- mutation: run it from that store: cd <A> && <OLD> verify --restore (that file is gone), or <NEW> verify --restore
== R1 (B): mutation: cd <A> && <OLD> verify --restore (that file is gone), or <NEW> verify --restore puts the tree back and removes the lock
== hook (B): ... It is held by pid 31150: wait for it, or if it is not running, run cd <A> && <OLD> verify --restore (that file is gone), or <NEW> verify --restore
== restore refusal (B): mutation: run it from that store: cd <A> && <OLD> verify --restore (that file is gone), or <NEW> verify --restore
   (each: whole exit 2, alternative 1 exit 127, alternative 2 exit 2 and the same line again; 8 of 8)

=== after, blocking 1 (S/out/repro-after-b1.txt)
== gate (B): [fail]  the mutation lock <W>/top dir/.git/mstack-mutation.lock is held by pid 97735 on <host>, started 2026-11-19T23:17:52.047Z, 1 path(s): the run is not running (no such process) -> the CLI that wrote the lock, <OLD>, is gone; run cd <A> && <NEW> verify --restore
   whole: exit 0, lock gone, src/x.js NEW <- mutation: restored 1, tree verified, lock removed
== R1 (B): mutation: the CLI that wrote the lock, <OLD>, is gone; cd <A> && <NEW> verify --restore puts the tree back and removes the lock
== hook (B): mstack: <W>/top dir/.git/mstack-mutation.lock exists, ... It is held by pid 98424: the CLI that wrote the lock, <OLD>, is gone; wait for it, or if it is not running, run cd <A> && <NEW> verify --restore
== restore refusal (B): mutation: the CLI that wrote the lock, <OLD>, is gone; run it from that store: cd <A> && <NEW> verify --restore
   (each, via sh and via dash: exit 0, lock gone, src/x.js NEW; 8 of 8; final git status "")

=== before (efe02e4), blocking 2 and non-blocking 3
== symlink, hook from A: 76 ms, exit 0: ... It is held by pid 31808: wait for it, or if it is not running, run cd <A> && <OLD> verify --restore
   gate from A: [fail]  a mutation lock exists and cannot be read as a run's record: the lock ... cannot be read: ELOOP: too many symbolic links encountered, ... -> by hand, ...
   the hook's line run: exit 2, lock stays <- mutation: refused: the lock ... cannot be read: ELOOP ...; nothing was written, and the lock stays
   (from B the same)
== FIFO, hook from A (killed at 10 s): 10006 ms, exit null, signal SIGKILL
== FIFO, hook from B (killed at 10 s): 10005 ms, exit null, signal SIGKILL

=== after, blocking 2 and non-blocking 3 (S/out/repro-after-b2.txt)
== symlink, hook from A: 53 ms, exit 0: mstack: ... exists, ... The lock cannot be read as a run's record, so the way out is by hand, for a person at a terminal (...): 'git stash push --include-untracked' saves every change and discards nothing; then delete the lock; 'mstack gate' says the same
   gate from A: [fail]  a mutation lock exists and cannot be read as a run's record: ... ELOOP ... -> by hand, ...
   the hook names no restore line   (from B the same, 52 ms)
== FIFO, hook from A (killed at 10 s): 52 ms, exit 0, signal null: ... The lock cannot be read as a run's record, so the way out is by hand, ...
== FIFO, hook from B (killed at 10 s): 52 ms, exit 0, signal null: (the same)
the lock as written put back, verify --restore from A: exit 0, lock gone, src/x.js NEW
pgrep -fl 'mutation-holder|run-helper': nothing
```

I also reran the reviewer's metacharacter attack (`S/a1/a1.mjs`, copied from `review101` and
pointed at the working tree, `S/scripts/a1.sh`). Scenario `meta` puts `$(touch PWN_d)`,
backticks, `;`, `&`, `|`, `>`, `<`, `*`, `$HOME` and `!x` in the names of the CLI, the repository
and the stores. Scenario `nlcli` puts a newline in the CLI's path. For each scenario, the run's,
the gate's, R1's, the hook's and the restore's lines from A and B, run through sh and dash, gave
16 of 16: exit 0, lock gone, tree byte-identical, no marker. The five gone-CLI lines from A and
B gave 5 of 5: the command exits 0, lock gone, tree byte-identical. Running each whole way out
as printed, the prose with the gone path in it included, exits 1, 2 or 127 with the lock kept
and no `PWN_*` file anywhere. The gone path is a `shellWord` in the prose too, so pasting the
whole line cannot run it (`S/out/a1-meta.txt`, `S/out/a1-nlcli.txt`).

### Suites and checks

Run at `ab8bafc`, the last code commit (`S/scripts/suites.sh`). Outputs are in
`S/out/suite-{bun,node}.txt` and `S/out/checks.txt`:

```
$ bun run test:bun      # load 7.2 at the start, 8.4 after
 1106 pass
 3 skip
 0 fail
Ran 1109 tests across 58 files. [360.20s]
$ bun run test:node     # load 17.3 after
ℹ tests 1109
ℹ pass 1108
ℹ fail 0
ℹ skipped 1
$ bun run typecheck                                            # exit 0
$ ./bin/mstack lint-plugin .                                   # PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md    # 110 relative links checked, 0 broken
```

There are five tests more than round 1's 1104, all in `tests/mutation-exits.test.ts`. The skips
are the same as before: the case-sensitive A3 test, skipped on this case-folding disk.

**Dash as `sh`** (`S/scripts/dash.sh`, `S/out/dash.txt`). This is a copy of HEAD. `src/run.ts`,
`src/run-helper.mjs`, the `#!` of `bin/mstack` and every `"/bin/sh"` in
`tests/mutation-exits.test.ts` (A1's `sh()`, the `shellWord` test) became `/bin/dash`, and the
first directory on `PATH` links `sh` to `/bin/dash`:

```
tests/mutation-exits.test.ts    | bun: 10 pass, 1 skip, 0 fail | node: pass 10, fail 0, skipped 1
tests/mutation-hook.test.ts     | bun: 10 pass, 0 fail         | node: pass 10, fail 0
tests/mutation-gate.test.ts     | bun: 10 pass, 0 fail         | node: pass 10, fail 0
tests/mutation-refusals.test.ts | bun: 21 pass, 0 fail         | node: pass 21, fail 0
```

**Ten runs per runtime** (`S/scripts/ten.sh`, a fixed `for i in 1 .. 10`, `S/out/ten.txt`):

```
ten runs at ab8bafc; load at start: 9.92 10.49 9.16
tests/mutation-exits.test.ts  bun 0 of 10 failed, node 0 of 10 failed
tests/mutation-gate.test.ts  bun 0 of 10 failed, node 0 of 10 failed
tests/mutation-hook.test.ts  bun 0 of 10 failed, node 0 of 10 failed
tests/mutation-refusals.test.ts  bun 0 of 10 failed, node 0 of 10 failed
load at end: 7.61 8.24 8.55
pgrep: nothing
```

## R to test

| R | Test | Where |
|---|---|---|
| A1 | the run's, the gate's, R1's, the restore's and the hook's lines run as printed through `/bin/sh -c`, the CLI copy and the repository under `dir's "q" x`, the lock's CLI gone included: from A, and from B for each of the four printers; `shellWord` through `sh` and `dash` for 25 shell characters | tests/mutation-exits.test.ts:182, tests/mutation-exits.test.ts:578 |
| A2 | the hook and R1 for `..`, `/abs`, `pkg/a/`, no `rootFromTop` and `garbage`, and for a symlink and a FIFO at the lock's name: no `cd`, no restore, the gate's words, no blocking; from inside `.git` the hook still denies | tests/mutation-exits.test.ts:267, tests/mutation-exits.test.ts:481, tests/mutation-exits.test.ts:562 |
| A3 | upper case and NFD: no `cd` and the by-hand way out from all four, nothing written; on a case-sensitive disk the `cd` runs; a run that cannot be told alive with no restore line: wait, then by hand, in the gate as in R1 | tests/mutation-exits.test.ts:340, tests/mutation-exits.test.ts:382, tests/mutation-exits.test.ts:543 |
| A4 | the spaced options (`--shallow-file` included), `git` in any case and the seven plumbing commands denied under a lock; reads, `git COMMIT` and the not-covered writes allowed | tests/mutation-exits.test.ts:419, tests/mutation-exits.test.ts:520, tests/mutation-hook.test.ts:78 |
| A5 | CHANGELOG prose | n/a: CHANGELOG.md text only; the refusal it names is pinned by tests/mutation-two-stores.test.ts:199 |
| A6 | `node` (exit 1) and `/bin/dash` (exit 2) given a script the revert removed: killed | tests/mutation-exits.test.ts:461 |

Each `Where`, printed back (`S/scripts/where.sh`, `bat -pp -r N:N`, cut at 110 columns):

```
tests/mutation-exits.test.ts:182: test("A1 every printed restore line runs as printed when the CLI's path and the store's hold a space, a ' and
tests/mutation-exits.test.ts:578: test("A1 shellWord: a path run through the shell comes back as it was, whatever shell character it holds, and
tests/mutation-exits.test.ts:267: test("A2 the hook and R1 name the restore only for a lock validateLock accepts, and otherwise say what the gat
tests/mutation-exits.test.ts:481: test("A2 a symlink or a FIFO at the lock's name: the hook reads it as readLock does, names no restore, and doe
tests/mutation-exits.test.ts:562: test("A2 from inside the git directory, where git names no top level, the hook still denies under a lock and n
tests/mutation-exits.test.ts:340: test("A3 a rootFromTop that differs from this store's only in case or Unicode form prints no cd that loops but
tests/mutation-exits.test.ts:382: caseSensitiveTest("A3 where the disk tells case apart, PKG/A and pkg/a are two stores and the cd to the lock's
tests/mutation-exits.test.ts:543: test("A3 a run that cannot be told alive, under a lock whose store no restore takes: the gate says wait, as R1
tests/mutation-exits.test.ts:419: test("A4 under a lock the hook denies git's options given with a space and the plumbing that writes the index,
tests/mutation-exits.test.ts:520: test("A4 under a lock the hook denies git --shallow-file with its value after a space, and git's own name in a
tests/mutation-hook.test.ts:78: test("R26 every listed git command is denied under a lock", () => {
tests/mutation-two-stores.test.ts:199: test("R24 a restore from another store of the worktree refuses, names the lock's store, and the restore there
tests/mutation-exits.test.ts:461: test("A6 an obligation that runs a script the revert removed through an interpreter is killed wherever the int
```

## Spec and docs sentences amended

Each one is in the commit of its code:

- `spec.md` R25 (`f925e61`). It said "also the absolute path of the CLI that is running". It now
  says the running CLI's path instead, with the gone path named in front of the way out and not
  offered as a command, so every command a line offers runs as printed. The scenario "The writing
  CLI is gone" says the same.
- `spec.md` R1's scenario "A lock exists" and R15 (`ab8bafc`). Each named `<CLI that wrote the
  lock> verify --restore` outright, which is no longer printed for a gone CLI. Each now adds "R25's
  command, the running CLI's when that file is gone". I found these after `f925e61`, so they are
  in a commit of their own and not in the code's.
- `Gates-and-Hooks.md`, the gate's *not running* text (`f925e61`). The table row on the lock
  (`ea7cb01`) also says the hook reads the lock as the gate does, and that the running CLI's
  command replaces a gone one. The plumbing paragraph is rewritten (`e6bf5bb`), and *cannot be
  told* with no restore line now says wait (`9652401`).
- `design.md` (`ea7cb01`): the `preToolUse` bullet (`readLockAt`) and the `acquireLock`/`readLock`
  bullet. The spaced options and `git` in any case (`5730661`). The plumbing sentences
  (`e6bf5bb`).
- `src/hooks.ts`: the comments on `GIT` and on `LOCKED_GIT`.

## Decision rows

- 324: B1 as one rule. A gone CLI is not offered as a command, against the response's "cd in front
  of each alternative", which still offers `<gone> verify --restore` (exit 127 as printed). It
  also changes three existing tests that pinned the two-command form:
  - `mutation-gate.test.ts` R25;
  - `mutation-hook.test.ts` R25;
  - `mutation-refusals.test.ts` R1 (its lock names `/opt/mstack/bin/mstack`, which does not
    exist).
  Each now asserts the new rule, that the gone path is named, and that it is not followed by
  `verify --restore`.
- 325: NB1. `git` in any case, in the shared prefix; the subcommand stays case-sensitive.

## Findings not applied

- NB4 (a lock hand-edited to name another real store restores into it): left as row 323 decides,
  for a follow-up item. Nothing in this round touches it.

## What I did not do

- I did not run Linux. Dash stood in for ubuntu's `sh`, as above.
- The hook's line from inside `.git` (`run from <rootFromTop> under this worktree's top level:
  <cmd>`) names the directory in prose and the command bare, as before. The M3 test pins that the
  hook denies there and does not throw. Making that line a `cd` would need the top level from
  another git call, and nothing asked for it.
- The M1 and M3 tests went into `9652401`, NB5's commit, and not into a commit of their own. The
  R1/R15 amendment (`ab8bafc`) is in a commit apart from the code it follows (`f925e61`). I did not
  rewrite history to merge them, since interactive rebase is not available here.
- I did not push, and the item's status is unchanged.
