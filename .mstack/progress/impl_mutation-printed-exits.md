# Implementation - mutation-printed-exits (item 101)

Direct path; the six acceptance bullets are A1 to A6. Branch `fix/mutation-printed-exits`, base
`7e96373`, code head `96425d7`. Scratch, written `S/` below:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl101/`.
Every run of the mechanism was in a repository under `S/` (tests with `TMPDIR=S/tmp`); none
in this checkout, and the lock test before each commit found no lock here.

## What changed

- **A1.** `restoreCommand` puts each CLI path through `shellWord`, the one quoting rule that
  already quoted the `cd` directory. It leaves a plain path bare, so no transcript in the docs
  changes. Every restore line goes through those two:
  - the run's `if this process dies` line and its failed-restore line;
  - the gate, R1's refusal and the hook;
  - `verify --restore`'s own refusals.
- **A1, R1's damaged-lock fix.** That line printed `'<here> verify --restore'` inside quotes. It
  is gone with A2.
- **A2.** `checkLock` (`src/mutation-lock.ts`) gives the gate's words for a lock `validateLock`
  rejects, damaged included: cannot be read as a run's record, then the by-hand recovery.
  - R1's refusal now returns those words, so it names no restore and no `cd`.
  - The hook names the restore only when `validateLock` accepts the lock (and its `cli` is
    absolute, as before); otherwise it gives the by-hand reason.
- **A3.** `inLockStore` prints `cd <dir> &&` only when the store a restore finds from `<dir>` is
  the one git names `rootFromTop` in the same worktree. It asks git there, one `rev-parse`.
  Otherwise it says why and gives the by-hand recovery:
  - no directory;
  - no store of this worktree;
  - `<dir>` is the store git spells otherwise, only in case or Unicode form.
  The gate, R1, the restore's refusal and the hook all use it, and nothing folds a name (decision
  row 321).
- **A4.**
  - `GIT` takes `--namespace`, `--config-env` and `--attr-source` with a space; `--attr-source`
    also takes `=`.
  - `LOCKED_GIT` adds seven plumbing commands.
  - `tests/mutation-hook.test.ts:85`'s control `git commit-tree HEAD^{tree}` (allowed) became
    `git merge-base HEAD HEAD`, a read that starts with a listed word, on the same line.
- **A5, A6.** `CHANGELOG.md` names the other-store refusal. `docs/wiki/The-CLI.md` says that
  `<interpreter> <script>` with the script removed exits with the interpreter's code (dash 2,
  python3 and perl 2, node, bun and ruby 1: killed; bash 127: blocked), and to run the script by
  name. The hook's table, the gate's text and `hooks/hooks.json` follow A2 to A4.
- **Fixtures, own commit `cd09a53`.** The hook tests' `lockText` (`tests/mutation-hook.test.ts:39`)
  and R1's lock test (`tests/mutation-refusals.test.ts:188`) wrote locks no run writes, and they
  asserted R25's line for them. Now they write every field `validateLock` checks; the
  assertions are unchanged, and both files are green at base (decision row 320).

## Files

`src/mutation-lock.ts`, `src/gate.ts`, `src/mutation.ts`, `src/mutation-run.ts`, `src/hooks.ts`,
`tests/mutation-exits.test.ts` (new), `tests/mutation-hook.test.ts` (lines 39, 85),
`tests/mutation-refusals.test.ts` (line 188), `.mstack/specs/mutation-check/spec.md`,
`.mstack/specs/mutation-check/design.md`, `CHANGELOG.md`, `docs/wiki/The-CLI.md`,
`docs/wiki/Gates-and-Hooks.md`, `hooks/hooks.json`, `.mstack/decisions.tsv`,
`.mstack/progress/current.md`.

## Commands

### Red first

Each test of the head ran against the source of the commit before its fix (`S/scripts/red-at.sh`);
full output in `S/red/`. Trimmed:

```
A1 at a1c933c (bun; node the same):
AssertionError: cd '<T>/top dir'\''s "q" x/pkg/a' && <T>/cli dir's "q" x/bin/mstack verify --restore
/bin/sh: -c: line 0: unexpected EOF while looking for matching `''
2 !== 0
A2 at 4d946fd: AssertionError: the parent: R1 does not say what the gate says
+ 'a mutation run holds the tree: lock <T>/.git/mstack-mutation.lock, pid 43066, ..., not running (no such process)
   -> cd S/tmp && <cli> verify --restore puts the tree back and removes the lock'
- `a mutation lock exists and cannot be read as a run's record: the lock <T>/.git/mstack-mutation.lock:
   its rootFromTop ".." has a .. segment -> by hand, for a person at a terminal (...)`
A3 at 67fbd41: AssertionError: in upper case
mutation: run it from that store: cd '<T>/PKG/CAFÉ' && <cli> verify --restore
A4 at 504b2a5: AssertionError: not denied under a lock: git --namespace foo commit -m x
```

A5 and A6 change docs only. A6's test pins what the docs now say, and it passed before as well.

### Mutants

`S/scripts/mutants.sh`: each mutant goes into a fresh `git archive` of HEAD's `src` under
`S/mut`, and the criterion's tests run under bun. `S/out/mutants.txt` has the rows.

| Mutant | Test that fails | Result |
|---|---|---|
| M1 `restoreCommand` leaves the CLI path bare | A1 (B's line: unexpected EOF) | killed |
| M2 the `cd` directory bare | A1 | killed |
| M3 the running CLI bare when the lock's is gone | A1 (third run) | killed |
| M4 the hook takes any lock with a string `rootFromTop` | A2 | killed |
| M5 R1 checks only a damaged lock | A2 | killed |
| M6 `checkLock` accepts a lock with problems | A2 | killed |
| M7 `inLockStore` takes any store it finds | A3 | killed |
| M8 `inLockStore` folds the two names | A3 | killed |
| M9, M10, M11, M12 the restore, hook, gate, R1 print the old `cd` | A3 | killed, 4 of 4 |
| M13 no spaced `namespace`, `config-env`, `attr-source` | A4 | killed |
| M14 no `attr-source=` | A4 | killed |
| M15 each plumbing verb removed in turn (7) | A4, naming that verb | killed, 7 of 7 |

That is 21 of 21 killed. M8 differs from the head only on a disk that folds case, so on Linux it
is an equivalent mutant: there both spellings cannot name one directory.

### Real surface

`S/scripts/realsurface.sh`. HOME was a new empty directory, the repositories were under
`S/repos/real/`, and the host is written `devbox` here. Part 1 used a copy of HEAD's CLI under
`cli dir's "q" x/` and stores `pkg/a` and `pkg/b` under `top dir's "q" x/`. Part 2 used this
checkout's `./bin/mstack` on plain paths. Full output: `S/out/realsurface.txt`.

`R` is `S/repos/real`, and `<BY_HAND>` is the stash line:

```
=== Part 1 (the copy; the lines run from B and from A)
$ kill -9 61842
mutation: if this process dies: 'R/cli dir'\''s "q" x/bin/mstack' verify --restore
$ mstack gate --quiet   (in pkg/a)
[fail]  the mutation lock R/top dir's "q" x/.git/mstack-mutation.lock is held by pid 61842 on devbox, ...: the run is
  not running (no such process) -> run 'R/cli dir'\''s "q" x/bin/mstack' verify --restore
$ mstack verify --mutation   (in pkg/b)
mutation: cd 'R/top dir'\''s "q" x/pkg/a' && 'R/cli dir'\''s "q" x/bin/mstack' verify --restore puts the tree back and removes the lock
$ mstack hook pre-tool-use <<< git commit -m x   (cwd pkg/b)
mstack: ... It is held by pid 61842: wait for it, or if it is not running, run cd 'R/top dir'\''s "q" x/pkg/a' && 'R/cli dir'\''s "q" x/bin/mstack' verify --restore
$ mstack verify --restore   (in pkg/b)
mutation: refused: the lock is the run's of the store at pkg/a in this worktree, and this store is at pkg/b; nothing was written, and the lock stays
mutation: run it from that store: cd 'R/top dir'\''s "q" x/pkg/a' && 'R/cli dir'\''s "q" x/bin/mstack' verify --restore
$ (in R/top dir's "q" x/pkg/b) /bin/sh -c <the line above>
mutation: restored 1, tree verified, lock removed
exit 0; lock: gone; src/x.js: NEW
--- runs 2 to 5, each killed the same way, each line run as printed:
the run's own line from pkg/a, R1's from pkg/a, the hook's from pkg/b, the gate's from pkg/a:
exit 0; lock: gone; src/x.js: NEW   (4 of 4)
=== Part 2 (./bin/mstack, plain paths: the line is bare, as in the docs' transcripts)
mutation: if this process dies: /.../mstack/bin/mstack verify --restore
--- A3: rootFromTop edited to PKG/A
$ mstack verify --restore   (in pkg/a)
mutation: refused: the lock is the run's of the store at PKG/A in this worktree, and this store is at pkg/a; nothing was written, and the lock stays
mutation: no verify --restore takes this lock: it names its store PKG/A, and R/plain/PKG/A is the store git spells pkg/a,
  which differs only in case or Unicode form, so its restore refuses the lock too
mutation: by hand, for a person at a terminal (...): <BY_HAND>
exit 2
(the gate, R1 and the hook: the same sentence and the by-hand way out, no cd)
lock unchanged: yes; tree unchanged: yes
--- A2: rootFromTop edited to ..
$ mstack verify --mutation   (in pkg/a)
mutation: refused: a mutation lock exists and cannot be read as a run's record: the lock R/plain/.git/mstack-mutation.lock: its rootFromTop ".." has a .. segment
mutation: by hand, for a person at a terminal (...): <BY_HAND>
(the hook from pkg/b: "The lock cannot be read as a run's record, so the way out is by hand ...; 'mstack gate' says the same")
--- A4, the hook under the lock
denied: git --namespace foo commit -m x, git --config-env core.editor=EDITOR commit -m x, git --attr-source HEAD add -A,
        git update-index --add src/x.js, git commit-tree HEAD^{tree} -m x, git update-ref refs/heads/main HEAD~1
allowed: git hash-object -w src/x.js, git cat-file -p HEAD
--- the lock put back as written: verify --restore: restored 1, tree verified, lock removed; git status clean
```

### Suites and checks

At the code head `96425d7`; outputs in `S/out/suite-{bun,node}.txt` and `S/out/checks.txt`:

```
$ bun run test:bun      # load 7.0 at the start, 9.7 at the end
 1101 pass
 3 skip
 0 fail
Ran 1104 tests across 58 files. [354.92s]
$ bun run test:node     # load 9.3 to 19.1
ℹ tests 1104
ℹ pass 1103
ℹ fail 0
ℹ skipped 1
$ bun run typecheck                                            # exit 0
$ ./bin/mstack lint-plugin .                                   # PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md    # 110 relative links checked, 0 broken
```

The new skip on each runtime is the case-sensitive A3 test, which ran green on the case-sensitive
image. Ten runs per runtime (`S/scripts/ten.sh`, `S/out/ten.txt`):

```
tests/mutation-exits.test.ts  bun 0 of 10 failed, node 0 of 10 failed
tests/mutation-hook.test.ts  bun 0 of 10 failed, node 0 of 10 failed
tests/mutation-refusals.test.ts  bun 0 of 10 failed, node 0 of 10 failed
```

That is 60 runs with 0 failures, at load 16.2 at the start and 8.2 at the end, with the
real-surface script running alongside for part of it. Afterwards `pgrep -fl 'mutation-holder|run-helper'`
found nothing of mine, and there was no lock in this checkout's git directory.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | the run's, the gate's, R1's, the restore's and the hook's lines run as printed through `/bin/sh -c`, the CLI copy and the repository under `dir's "q" x` | tests/mutation-exits.test.ts:173 |
| A2 | the hook and R1 for `..`, `/abs`, `pkg/a/`, no `rootFromTop` and `garbage`: no `cd`, no restore, R1 equal to the gate's line | tests/mutation-exits.test.ts:230 |
| A3 | upper case and NFD: no `cd` and the by-hand way out from the restore, the gate, R1 and the hook, nothing written; on a case-sensitive disk `PKG/A` and `pkg/a` are two stores and the `cd` runs | tests/mutation-exits.test.ts:303, tests/mutation-exits.test.ts:345 |
| A4 | the three spaced options and the seven plumbing commands denied under a lock, the reads and the not-covered writes allowed | tests/mutation-exits.test.ts:382, tests/mutation-hook.test.ts:78 |
| A5 | CHANGELOG prose | n/a: CHANGELOG.md text only; the refusal it names is pinned by tests/mutation-two-stores.test.ts:199 |
| A6 | `node` (exit 1) and `/bin/dash` (exit 2) given a script the revert removed: killed | tests/mutation-exits.test.ts:424 |

## The plumbing, decided

Denied under a lock (each is a listed write spelled low, and none has a form that only reads):

- `update-index`: writes the tree's files, the reverted ones, into the index, and the next
  commit carries them even after the restore.
- `read-tree`: writes a tree object into the index, and with `-u`/`--reset` the tree as well.
  `read-tree <start>` is the reverted state of every code path.
- `checkout-index`: `git checkout`'s plumbing. `-f` writes the index's (HEAD's) content over a
  reverted file and over an edit made to it during the run. This one is beyond the plan's "into
  the index, a tree or a commit"; R26 denies `checkout` for this same reason (row 322).
- `write-tree`, `mktree`: make the tree object that `commit-tree` turns into a commit.
- `commit-tree`: makes a commit of a tree; `git commit` in plumbing.
- `update-ref`: points a branch at a commit, the last step of a plumbing commit, or deletes it.

Named in `Gates-and-Hooks.md` as not covered, since none can save the reverted tree:

- `hash-object -w`: a reverted file hashes to the start's blob, which already exists (10 loose
  objects before and after, `S/scripts/plumbing-exp.sh`).
- `symbolic-ref`, `branch -f`, `tag`: each points a ref at a commit that exists, and each has a
  form that reads.
- `sparse-checkout`: it left a modified `src/a.ts` in place ("not up to date and were left").
- Every other command git has.

## Spec and design sentences amended

These went into the commit of their code:

- `spec.md` R1, scenario "A lock exists": a lock that fails R24's check gets the gate's words
  (A2).
- `spec.md` R24: a directory is named only where its restore takes the lock, else the by-hand
  recovery (A3).
- `spec.md` R25: each path is one shell word (A1).
- `spec.md` R26: the plumbing joins the list, and the plumbing that is not listed joins "Not
  caught" (A4).
- `design.md`, the `rootFromTop` bullet: `inLockStore` (A3).
- `design.md`, the gate bullet: R1 says the same words, `checkLock` (A2).
- `design.md`, the `preToolUse` bullet: the new regex and options (A4); "the hook checks no more
  of it", now `validateLock` (A2); the third `git rev-parse` (A3).

## Decision rows

These are rows 320 to 322 of `.mstack/decisions.tsv`:

- 320: the fixtures.
- 321: A3 is decided by the disk through git, not by folding (the plan said "matches only after
  folding").
- 322: A4's list, with `checkout-index` added and the edited control at `mutation-hook.test.ts:85`.

No review finding was left unapplied. Round 2's non-blocking 5, third bullet (a `node -e` that
spells `git commit` is denied), asked for nothing; the docs already say it.

## What I did not do

- I did not run Linux. The case-sensitive test ran on a case-sensitive APFS image instead
  (`S/scripts/cs-volume.sh`, both A3 tests green on bun and node).
- The dash check (`S/scripts/dash-check.sh`, `S/out/dash-check.txt`): the runner, the launcher's
  `#!` and the test's `/bin/sh` were swapped for `/bin/dash`, with `sh` on `PATH` linked to dash.
  `mutation-exits` (5 pass, 1 skip), `mutation-hook`, `mutation-two-stores` and `mutation-run`
  were green under it on both runtimes.
- The hook still reads the lock with `readFileSync`, which follows a symlink and blocks on a FIFO
  at the name. That was not in these findings.
- From inside `.git`, where git gives no top level, the hook still prints `from <rootFromTop>
  under this worktree's top level`, without A3's check.
- I wrote the first part of `tests/mutation-exits.test.ts` with a shell `head >` redirect from my
  scratch draft, not the Write tool. Every later change used Edit.
- I did not push, and the item's status is unchanged.
