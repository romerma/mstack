# Review - mutation-exits-followups

**Verdict:** CHANGES_REQUESTED

Reviewer pass of item 105 at `d49c4b0ff59daa6a43cdaea85200546c71cd542c` (base `819c9a3`). I did not
write this code. Scratch `S` =
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review105/`
(scripts in `S/scripts/`, output in `S/out/`). Every run that touches a lock ran in fixtures under
`S/fx/`, from `git archive` copies of the head (`S/head`) and the base (`S/base`). Nothing ran
against the checkout except `./bin/mstack gate` and `ledger`.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A1 | `tests/mutation-exits.test.ts:652`, `:680` (three states), `tests/mutation-gate.test.ts:143` | Each line exists and asserts the exact printed line, then runs it. The implementer's M1a-f are killed by them. My X1 (relative link resolved from the cwd) and X3 (one hop) survive, see NB2 |
| A2 | `tests/mutation-exits.test.ts:712`, `tests/mutation-two-stores.test.ts:203` | Refused from both stores, with tree, lock and run directory compared. My X2 (top store unchecked) survives, see NB2. No test covers B1's layout |
| A3 | `mutation-refusals:179`, `mutation-exits:563`, `mutation-gate:143`, `mutation-hook:159`, `mutation-cli:137`, `:281` | Read in the diff. Two `\S+` regexes became exact strings, which is stronger. The other four gained `shellWord` on the positive and the negative form alike, so none is weaker |
| A4 | `tests/hooks.test.ts:511` | Deny and allow lists. They match my run of 59 commands, base against head |

## Acceptance, quoted

**"when the path of the CLI that wrote the lock holds a directory, a file that is not executable or a copy with src/ gone, the printers still offer a command that runs (the running CLI's restore) or the by-hand recovery"** - met.
`S/out/a1-all.txt`: the writer is a copy at `<FX>/writer's "w" cli/` and the worktree is at
`<FX>/w o'rld/`, both with a quote in the path. A real run was killed with `kill -9`. Then I asked
8 printers: the gate, R1 and the hook in A and in B, the restore's refusal in B, and the hook from
`.git`. Each one cut out and ran its offered command through `/bin/sh -c` and `/bin/dash -c`.

- For a directory, a mode-644 file and a copy with `src/` removed, each printer named the writer
  ("cannot run (it is a directory)", "(it is not executable)", "(its src/cli.ts is missing)") and
  offered the running CLI. 16 of 16 lines per state exited 0, the lock was gone, and `A/src/x.js`
  held `"NEW\n"`.
- The same 16/16 held for nothing at the path, a dangling link, a link loop ("cannot run (it
  cannot be read: ELOOP …)"), a FIFO, and a FIFO at `src/cli.ts`, which did not hang.
- A link to a CLI that runs, relative or a two-link chain: the writer was offered, 16/16.
- npm-link layout (`prefix/bin/mstack -> ../lib/node_modules/mstack/bin/mstack`, which in turn
  links to a dev copy; `S/out/a1-link.txt`): `lock.cli` is the dev copy's real path. 16/16 across
  four states: intact, link removed, dev copy removed, `src/` removed.

**"a lock hand-edited to name another real store of the worktree does not restore into that store: the restore proves the lock's paths belong to the store it names, or refuses"** - met for the edit it names, but the proof also refuses a lock nobody edited (B1).
`S/out/a2.txt`, the review's repro: A's real run killed, `rootFromTop` edited to `pkg/b`.

```
restore (B): exit 2; nothing changed   (tree, lock and run-directory hashes identical)
   mutation: refused: the lock <FX>/repro/.git/mstack-mutation.lock names this store, at pkg/b, and its root <FX>/repro/pkg/a is the store at pkg/a in this worktree, so the lock was edited ...; nothing was written, and the lock stays
restore (A): exit 2; nothing changed
gate, R1 (exit 2), hook, from B and from A: by hand, no cd, nothing changed
by hand from A: git stash push --include-untracked exit 0; lock deleted; status ""; A/src/x.js "NEW\n"; the stash: ["-NEW","+OLD","-new z","+old z"]
```

**"the suite passes from a checkout whose path contains a space: the four tests ... assert the quoted form"** - met.
A copy under `S/spaced/my code/head`: bun 1136 pass, 3 skip, 0 fail of 1139; node 1138 pass,
0 fail, 1 skipped. A copy under `S/quoted/it's/head` gave the same numbers on both runtimes, so the
suite also stands a `'` in the path.

**"the hook's any-case match of a command name is decided for the other commands it guards"** - met.
`S/out/a4.txt`: 59 commands through base and head `preToolUse`, with and without a lock. The only
answers that changed are new denials of upper- or mixed-case forms of what the hook already denies:

- `RM -rf .mstack`, `rm -RF .MSTACK`, `/bin/RM -rf .mstack`, `Rm <git dir>/Mstack-Mutation.LOCK`,
  `RM -f <PATH IN UPPER CASE>/.GIT/MSTACK-MUTATION.LOCK`, `GH pr merge 3 --admin`, `gH pr merge --admin`.
- Text that holds such a form: `echo 'RM -rf .MSTACK'`, `git commit -m 'GH pr merge --admin is banned'`
  (outside a lock). Their lower-case forms were already denied at the base.

The base and head agree on all 37 ordinary commands, including `RM -rf dist`, `Rm build.log`,
`docker RM web`, `NPM RM lodash`, `make RM='rm -f' clean`, `cd 'ARM -r' && ls .mstack`,
`gh PR merge 3 --admin`, `gh pr merge 3 --ADMIN` and `gh pr merge 3`. `trash`, `unlink`, `UNLINK`
and `mv` of the lock are allowed at the base and at the head. That gap is older than this item.

## Verification I ran

**A2 first: legitimate restores across layouts** (`S/scripts/layouts.mjs`, `S/out/layouts-all.txt`).
Each case is a fresh fixture whose item modifies 2 files, adds 1 and deletes 1. It got a
SIGKILL at 7 points:

- before the revert (`lock-written`);
- between two revert writes (`reverted:0`) and inside one (`revert-written:2`);
- during the obligations (`obligations-running`, and a real `bin/mstack` run whose check sleeps);
- between two restore writes (`restored:0`) and inside one (`restore-written:2`).

Then came the layout's change and a restore as a person would run it. Every file outside `.git`
was compared with the snapshot taken before the run. The run's own `.mstack/verification.tsv` row
is excluded from the comparison.

The head passed 7 of 7 in each of these 17 layouts:

- one store at the top; a store in a subdir; two stores (from B: exit 2, nothing written; from A: restored);
- a symlinked top, the run through it (the holder recording the symlink spelling as `root`) and the restore through it;
- the checkout moved; moved, with a fresh clone at the old path;
- copied with `cp -R` (the copy and then the original);
- a linked worktree (from main: "nothing to restore", nothing changed; from linked: restored);
- case-variant cwd at the restore and at the run;
- `it's a "q" dir ñ/pkg/café b` with the `é` in NFD;
- `GIT_DIR`/`GIT_WORK_TREE` set; the same env with the checkout moved;
- `--separate-git-dir`; `GIT_DIR` with `core.worktree` in a bare-ish git dir;
- a submodule's store.

The head failed the 18th layout in 7 of 7: **B1** below.

macOS `getcwd` gives the on-disk case and resolves symlinks (`S/scripts/probe-paths.sh`), so
case-variant and symlinked cwds reach the restore as the run's own spelling.

**Edits not caught** (`a2.txt` Part 2, with B holding its own committed `x.js` and an uncommitted
`z.js`):

- Two edits are refused: `root` alone set to B (exit 2 from both stores), and `root` set to B's
  `src/` (exit 2).
- Every other edit with `rootFromTop` set to `pkg/b` is restored from B with exit 0 and A's files
  written into B: `root` set to B, to nothing, to a directory outside the worktree, to a file, or
  to `.`.
- In each of those, B's own content was rescued, `["B's own x\n","B's uncommitted z\n"]`, and A
  was left reverted with the lock gone. Nothing was lost: A's content is in the item commit.

**Old locks** (`a2.txt` Part 3): a lock written by the base CLI and restored by the head, and a
lock written by the head and restored by the base, each from A, and from B through the printed
`cd … &&` line run by `/bin/sh`. All four exit 0, the lock is gone and the files are as before the
run.

**M2b**, the device-and-inode check removed (`S/mut/M2b-no-inode`, `S/out/layouts-m2b.txt`): the
layouts where `root` is another spelling of the store's (symlink, case variant, NFD, copy, re-clone)
gave 56 of 56 restores. git places the other spelling at `rootFromTop` in each, so the check only
saves one `git rev-parse`. It is a shortcut, not a guard, and keeping it or dropping it is style.

**My mutants** (`S/scripts/mutants.sh`, `S/out/mutants.txt`): bun runs the five pinning files
(`mutation-exits`, `-gate`, `-two-stores`, `hooks`, `mutation-hook`) on each mutant. M2b, X1, X2
and X3 each gave 62 pass 1 skip 0 fail. All survived.

**The hook's cost** (`S/scripts/timing.ts`, `S/out/timing.txt`, load 17): the median of 15 runs in
process and of 9 runs through the CLI.

```
                                     in process base -> head      CLI base -> head
valid lock, git commit from A (deny)  34.4 -> 34.1 ms             78 -> 78 ms
valid lock, git commit from B (deny)  34.1 -> 33.9                78 -> 78
writer a directory, from A            34.6 -> 34.5                78 -> 78
edited lock, from A / from B          34.5 -> 45.9 / 33.9 -> 44.8 78 -> 90 / 78 -> 91
no lock, git commit                   11.8 -> 11.5                53 -> 54
valid lock, ls                         0.0 ->  0.0                40 -> 40
```

That matches item 101's 34 ms. The budget tests in `tests/hook-errors.test.ts` gave bun 39/0 and
node 39/0, and "a failing hook stays well inside the smallest timeout" took 121 ms.

**A launcher that passes `cannotRun` and does not restore**: a mode-755 empty `bin/mstack` beside
`src/`, a script that exits 1, or a copy whose `src/cli.ts` is empty. The printers offer only the
writer, and 24 of 24 such lines exit 0 or 1 with the lock kept (`a1-all.txt`). These states are
outside A1's three, and row 02:26:56Z records them: "not covered: a launcher that passes". So this
is not a finding.

**Suites**, each copy under `S/`, `HOME` a new empty directory:

```
head                 bun test ./tests: 1136 pass 3 skip 0 fail (1139, 379 s) | node --test: 1139, pass 1138, fail 0, skipped 1
"spaced/my code"     bun 1136/3/0 | node 1138/0/1
"quoted/it's"        bun 1136/3/0 | node 1138/0/1
tsc --noEmit (node_modules linked)          exit 0
./bin/mstack lint-plugin .                  PASSED - 0 failures, 0 warnings
node scripts/check-doc-links.mjs README.md docs/wiki/*.md   112 relative links checked, 0 broken
the R25 gate test at 0b39697 on the base's code   bun 1 pass 0 fail, node pass 1 fail 0
./bin/mstack gate (checkout)               PASSED - 0 failures, 0 warnings
```

**Ten runs per runtime** of each new or changed test file, in a copy of the head with a fixed-count
`for` (`S/scripts/ten.sh`, `S/out/ten-plain.txt`, load 12 to 8). Every file failed 0 of 10 on bun
and 0 of 10 on node:

```
mutation-exits 15 pass 1 skip | hooks 24 | mutation-gate 10 | mutation-hook 10
mutation-refusals 21 | mutation-cli 12 | mutation-two-stores 3
```

That is 140 runs.

**Dash as `sh`** (`DASH=1`, `S/out/ten-dash.txt`). `sh` first on `PATH` links to `/bin/dash`, and
`/bin/dash` replaces `/bin/sh` in `src/run.ts`, `src/run-helper.mjs`, `bin/mstack`'s `#!` and
`tests/mutation-exits.test.ts`. The same 7 files ran 10 times per runtime, 140 runs, 0 failures,
with the same counts. The A1 lines above also ran under `/bin/dash -c`.

**Each commit** (`S/out/per-commit.txt`): `tsc --noEmit` exits 0 at all 9 commits.

## Changes required

**Blocking**

1. `src/mutation-lock.ts:166` (`const there = placeOfDir(lock.root)`). **A legitimate restore is
   refused.**

   The layout: store `pkg/a` and a run in `w`, killed. Then `cp -R w copy`, and a restore from
   `copy/pkg/a` with `GIT_DIR=copy/.git GIT_WORK_TREE=copy` set (L10c).

   The head exits 2 at all 7 kill points with:

   > refused: the lock …/copy/.git/mstack-mutation.lock names this store, at pkg/a, and its root
   > …/w/pkg/a is the store at the worktree's top level in this worktree, so the lock was edited

   The base, same layout (L10b), restores 7 of 7 with the files as before the run.

   In that layout the head's R1 and hook also give only the by-hand way. The base's hook offers
   `run cd …/copy/pkg/a && …/bin/mstack verify --restore`, and its restore exits 0
   (`S/out/l10c-printers.txt`). With bun off `PATH`, so the launcher runs node, the head still
   exits 2 and the base exits 0 (`S/out/l10c-node.txt`).

   The cause is that git, run from `lock.root`, inherits `GIT_DIR` and `GIT_WORK_TREE`. From a cwd
   outside `GIT_WORK_TREE` it answers the env's worktree with an empty prefix
   (`probe-paths.sh: GIT_DIR+GIT_WORK_TREE, cwd outside the worktree: [<P>/Top||]`). So
   `there.top === top`, and `.` is not `pkg/a`.

   The implementation report's claim at line 48, "A copied checkout ... git places `root` in another
   worktree, so the lock is accepted", does not hold with these two variables set.

   Nothing is lost, and the by-hand line works. But it contradicts the 02:09:45Z row ("a directory
   git places outside this worktree (a moved or copied checkout) is taken as today"). It also makes
   several documents false:
   - `design.md:188` ("so no dead run restores differently");
   - `Gates-and-Hooks.md:293` and `The-CLI.md:896` ("which only an edit makes");
   - `CHANGELOG.md:14` ("A lock no one edited reads as before");
   - `spec.md:696`, R24's "THEN the lock was edited".

   Smallest change: before the git call, say nothing for a `root` that is not under `top`:

   ```ts
   const inside = relative(top, lock.root);
   if (inside === ".." || inside.startsWith("../") || inside.startsWith("/")) return null;
   ```

   Then add L10c as a test. I tried this in a copy (`S/scripts/fix-b1.sh`): L10c, L03, L05b and L06
   gave 35 of 35, and `mutation-exits` plus `mutation-two-stores` gave 18 pass, 1 skip, 0 fail.

**Non-blocking**

1. `design.md:189` and the implementation report's "Not caught" list fewer edits than slip
   through. Any `rootFromTop` edit whose `root` is not another directory of this worktree also
   restores into the named store: `root` names nothing, a file, an outside directory, or `.`
   (`a2.txt` Part 2). Nothing is lost there, since B's content is rescued. Smallest change: "an edit
   of `rootFromTop` whose `root` is the store it names or no directory of this worktree".
2. Three gaps the tests leave open; each mutant survives all five pinning files.
   - **X2.** `rootDisagrees` returns null when `rootFromTop` is `.`. The edit to `.` then restores
     A's file into the top store, as the base did (`S/out/x2.txt`): the head exits 2; X2 and the
     base exit 0 with `top/src/x.js WRITTEN`. Fix: `:712` also edits to `.` with a store at the top.
   - **X1 and X3.** X1 resolves a relative link from the cwd, and X3 follows one hop only. Each says
     "cannot run (its src/cli.ts is missing)" of a writer that runs (`S/out/a1-links-X1.txt`,
     `-X3.txt`). Fix: `:652` also gets a relative link and a two-link chain.
