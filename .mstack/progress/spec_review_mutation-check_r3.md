**Verdict:** APPROVED

# Spec review, round 3: item 42 mutation-check

Reviewer: spec-reviewer by hand (plugin not loaded). I did not write this spec. Reviewed at
`6f8ad5e16e45ec6714d5bd4c7195055fdc5e0474` on `feat/mutation-check`. Before the review,
`./bin/mstack gate` printed `PASSED - 0 failures, 0 warnings`, and `./bin/mstack version` printed
mstack 0.2.1 at this checkout.

What I read:

- `state show 42` and `state show 100`.
- decisions.tsv lines 231, 232, 233, 262 and 263.
- The four spec files and the round 3 hand-off.
- Both earlier reviews.
- The author's `spec42r3/` scripts and outputs.
- The code behind every citation.

Every `file:line` in design.md "Context" and in tasks.md is right at this head.

Experiments are in
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/specreview42r3/`,
written below as `R3/`.

- Each experiment is a bash script that starts with `set -euo pipefail` and makes a checked `cd`.
  Its output sits beside it as `.out`.
- Where the runtime matters, each ran on node v26.13.1 and bun 1.3.11.
- The machine is macOS on APFS (case-insensitive), with git 2.54.0.
- The history count ran on a `git clone --no-local` of this checkout (`R3/hist/repo`).
- Nothing in this checkout was written except this file.

## Summary

The design holds in the plain case, and in every state the author walks:

- Content the run did not write is untouched, rescued, or left in place and reported.
- Every state that keeps the lock has an exit that deletes nothing.

I found no hole that needs the design reworked. I found four holes that lose work or make the
check useless (N1 to N4 below). Each is fixed by a sentence and a test, and all four must be applied
before code is written. The rest of the list is wording and narrower gaps.

## Grill

### Hidden assumptions

1. **H(p) and the staged copy are the same bytes.**
   - The Terms (spec.md:28) define H(p) as p's identity "when the lock is taken".
   - `prepareRun` copies `head/<n>` earlier (design.md:136).
   - Between the copy and the lock, `prepareRun` runs one `git cat-file` child per entry, each
     allowed up to 60 s for Git LFS.
   - An edit in that gap is lost (N1).
2. **The rescue lasts as long as the user needs it.** In a linked worktree it sits in
   `.git/worktrees/<name>/`. `mstack worktree prune --yes` deletes that directory once the tree is
   clean and merged (N2).
3. **The test suite does not read the checkout's own lock.** This repository's suite does (N3).
4. **Killing mstack kills only mstack.** A SIGKILL to its process group also kills the helper that
   holds the parent watch and the timeout timer (N4).
5. **Clocks and host names are stable.** Liveness takes the boot time from the wall clock, and it
   compares the host only when the boot differs (N11).

### Rejected alternatives

The list in design.md:405-437 gives real reasons. The copy of the tree lost because the user chose
A (row 262), and the record says so plainly.

One alternative is missing: run the helper in its own process group (N4). It costs nothing, because
mstack's own handler already forwards a Ctrl-C through `stop()`.

### Fail paths

Walked in the next section.

## 1. The third acceptance criterion, attacked

| Attack | Result | Evidence, rung |
|---|---|---|
| The shapes R3 refuses: symlink, gitlink, file/directory either way, case, NFC/NFD, a parent's case | All refused; plain files pass | author's `shape-exp`, re-read; rung 4 |
| A pair this filesystem treats as one name that the fold misses | **One:** `ẞ` (U+1E9E) against `ss`, and so `ẞ` against `ß`. The sweep tried 145,748 names, created with `wx` in one directory: 2,533 collisions, one of them missed by `fold`, on node and on bun. R2's `lstat` test still refuses the pair on this disk. | `R3/fold/fold-sweep.out`; rung 4 (N7) |
| Refusals that ordinary items would hit | R3: 0; R4: 1 in 38 windows with code (section 5) | rung 4 on this repository's history |
| An edit between the staged copy and the lock | **H hashed from p when the lock is written** (the Terms read literally): the revert's check passes, S is written over the edit, and the edit exists nowhere. **H hashed from `head/<n>`:** R11 blocks and the edit stays. Same on both runtimes. | `R3/hcopy/hcopy-exp.out`; rung 3 (the primitives) (N1) |
| An edit, a commit, a `git add`, a new file or a new directory at a reverted path during the run | As the state table says: rescued, left in place, or reported; no row | walk, rung 3 |
| A case-only rename of a reverted file's **directory** during the run | The restore fails on "a parent is not a directory by exact name", every time. R15 prints one fix, `git stash push -- <p>`. It writes HEAD's bytes into `src/Lib/a.ts`, and the parent is still not exact. `mv src/Lib src/lib` clears it. The state has an exit, but no message names it. | `R3/dircase/dircase-exp.out`; rung 4 for git and the filesystem, rung 3 for the restore (N8) |
| SIGKILL of mstack alone during an obligation | The obligation is gone within 2 s | author's `orphan-exp`; rung 4 |
| SIGKILL of mstack's process group during an obligation | **The obligation survives**, with no parent watch and no timer, because the helper held both. Same on both runtimes. | `R3/groupkill/groupkill-exp.out`; rung 4 (N4) |
| SIGKILL between two writes or inside one | Every row of design.md:309-324 is recoverable; the restore sweeps the temp names first | author's `ro-exp`; walk |
| A read-only directory; a full disk | The lock is kept; the exit is `chmod` or freeing space | author's `ro-exp`; ENOSPC is rung 2 |
| A linked worktree | The lock and the run directory sit in `.git/worktrees/<name>/`, which is right. Then three things go wrong: **once the restore leaves the tree clean, `git worktree remove` without `--force` deletes the rescue**; `isDirty` (`src/worktree.ts:79`, `--ignored=matching`) sees nothing in the tree; and the main checkout's gate reads `.git`, so R28 never warns there. | `R3/wt/wt-exp.out`; rung 4 (N2) |
| This repository's own suite under a lock | **A guaranteed false kill from item 100 on:** `npm test` runs `tests/hooks.test.ts` while a run holds the lock. That file calls `preToolUse` with `cwd: process.cwd()` (`:283-286`), which is the checkout. Its ALLOW list (`:276-277`) holds `git reset --soft HEAD~1` and `git reset HEAD~1`. R26's pattern (design.md:270) denies both; I checked that in node. | rung 3 (N3) |
| The window between the check and the rename | 4 to 11 ms for a 3 MiB file as designed: hashing the staged copy, the write and the fsync all fall inside it. 2 to 5 ms with a re-check after the fsync. | `R3/window/window-exp.out`; rung 4 for the primitives (N9) |

### "Every state, and its exit"

I checked each row against an experiment or the primitive. All rows are right except these four:

- **design.md:318**, "the helper kills the group within 2 s". This holds for a SIGKILL of mstack
  alone, not of its group (N4).
- **design.md:337**, "`git reset <lock HEAD>`". This is right while HEAD is still on the lock's
  branch. After a `git switch` in another terminal, it moves the other branch (N10).
- **design.md:344**, "the tree then holds HEAD's content". Suppose the restore's proof cannot pass,
  the user runs the printed `git stash push`, then `verify --restore` again. That run first rescues
  git's copy of p, then fails to write H, so p ends up **absent**. Nothing is lost: HEAD's bytes are
  in git and in `rescue/`. But the line is wrong, and after deleting the lock the user needs
  `git restore -- <p>` (N12).
- **design.md:461-462**, "the gate's warning (R28) is what tells the user first". That is false when
  prune runs from the main checkout (N2).

## 2. The three things the author says cannot be made safe

1. **A concurrent write in the window between the check and the rename is replaced.**
   - True: the author's `race-exp` shows the order, rung 4.
   - It is stated only in design.md:353-364. The task 3.4 wiki paragraphs leave it out, and the run
     prints nothing about it.
   - Acceptable. `git checkout` has the same window, and here it is a few milliseconds while the
     user has just been told the tree is reverted.
   - Not blocking. Say it in the line printed at the lock and in the wiki, and narrow it (N9).
2. **An orphaned obligation can write for up to 250 ms after mstack is SIGKILLed.**
   - True for a SIGKILL of mstack alone (`orphan-exp`).
   - After a SIGKILL of mstack's group, the window lasts until the obligation ends on its own (N4).
   - Stated in design.md only.
   - Acceptable once the helper runs in its own group. Not blocking.
3. **With the run directory deleted by hand, the proof may never pass and the lock is deleted by
   hand.**
   - True, and self-inflicted. Deleting the lock discards nothing.
   - The end state is described wrongly (N12). Not blocking.

None of the three keeps the lock with deleting work as the only way out.

## 3. Where the author departed from row 263

| Departure | Judgement |
|---|---|
| A name holding a newline or non-UTF-8 bytes (R3) | **Needed; keep.** `git()` decodes its output as UTF-8 and replaces bad bytes (`src/git.ts:61-76`), so such a name becomes a U+FFFD path that is not on disk. `hash-object --stdin-paths` cannot take a name with a newline. But the clause has no scenario and task 1.3 has no test for it (N6). |
| A path or parent on disk under another case or form than git's (R2) | **Needed; keep.** Without it, the revert stops on R11. The restore then rescues the user's `Foo.ts` and writes `foo.ts`, which renames their file. |
| A case variant where the revert puts a file back (R2) | **Needed; keep.** The author's `name-exp` b shows that a rename over a variant destroys it. |
| Temp-name prefix in the lock, with the writer's pid appended | **Needed; keep.** Round 2's N9 needs two restores not to share a temp file, it is cheap, and every temp name is still derived from the lock. |
| An opt-in parent watch in `run-helper.mjs` | **Needed; keep, and detach the helper (N4).** Without the watch, an orphaned obligation runs until the helper's timer fires, 900 s by default, on the tree that `verify --restore` is writing. On its own it misses a SIGKILL of the group. |
| The liveness rule: boot time, pid namespace, `ps` start time | **Needed, not machinery to cut.** See below. |

### The liveness rule

It exists because `verify --restore` has no `--force`. Without the start-time test, a reused pid
holds the lock until that process ends.

**Can a stale lock pass for a live run for good?** Only in rare cases, each with an exit:

- As `running`:
  - the pid is reused within the lock's own second;
  - `ps` is missing, on a host where the pid was reused;
  - the writer is a zombie nobody reaped.
- As `unknown`:
  - a restarted container, which has a new pid namespace but the same boot;
  - a host that was renamed and then rebooted.

In each case the exit is the by-hand stash, which discards nothing.

**The opposite direction is the real risk: a live run judged dead.**

- Two hosts share a repository on a network or synced disk and booted within 60 s of each other.
  Two cases:
  - both run Linux in the initial pid namespace, whose inode is the same constant on every Linux
    host;
  - both run macOS, where the pid namespace is null.
- They are then judged "same boot, same namespace", and no host test applies. `kill(pid, 0)` on the
  reader's host says ESRCH, and the restore runs under a live run.
- A step of the wall clock over 60 s makes a live run look like "another boot" in the same way.

Fix in N11. Not blocking: both cases are rare, and the result is round 2's N9 interleaving, which
wastes a run and loses no user content.

### N11 of round 2: `createdDirs`

The author's reason for not applying the wording holds:

- R2 refuses a parent that is not a directory (spec.md:84-85).
- R3 refuses file/directory swaps in the diff.
- R11 re-checks the parents before each write.

So at revert time, "absent now" and "not a directory now" mean the same thing.

## 4. The round 2 findings

| Finding | Status |
|---|---|
| B1 (`sh <lock>`) | **Closed.** R8 makes the lock JSON. R25 never names `sh` with the lock. "By hand" gives each way with what it discards. `recover-exp` b2 shows why the git-restore way is gone. |
| B2 (case-only rename) | **Closed** for renames in the diff (R3) and for variants on disk (R2, R14, exact names). Two gaps remain, neither of which keeps the lock for good: the fold miss (N7), and a directory renamed by case during the run (N8). |
| B4 (task 5.3 step 5) | **Closed.** Every call from step 2 to step 6 goes through the copy's absolute path, and step 5 decides on `test -e "$(git rev-parse --absolute-git-dir)/mstack-mutation.lock"`. I also checked that the copy's gate prints PASSED: `checkCliProvenance` (`src/gate.ts:605`) rates a copy in the same repository at the same committed src tree `ok`. |
| N1 | Closed: R19's scenario rules out `--soft`. N10 adds a case it misses. |
| N2 | Closed: `gitToFile`, the 3 MiB scenario, `stream-exp`. |
| N3 | Closed: the prefix in R8, the sweep in R13, the scenario "Killed inside a write". |
| N4 | Closed at `lock-written` and during staging. Round 2 also asked for a test at `reverted:1`, which task 3.3 does not have (N13). |
| N5 | Closed: R18 (d) and (e), and the trade-offs. One gap: an untracked test edited between the baseline and K0 (N14). |
| N6 | Closed: R4, `merge-exp`. |
| N7 | Closed: bits `0o7777`, `mode-exp`. |
| N8 | Closed: EXDEV in R14, and the rescue comes before the staged-copy check. |
| N9 | Closed: no `--force`, plus the liveness rule (see N11 below). |
| N10 | Closed: a trade-off and a wiki paragraph. |
| N11 | Closed; the `createdDirs` reason holds (section 3). |
| N12 | Closed: R11. |
| N13 | Closed: design.md gives 60 s per blob, and R1 has the scenario. |

## 5. How often it refuses

Method (`R3/hist/measure.mjs`, output `R3/hist/measure.out`). In the clone I took 51 windows:

- 40 windows from one `close item` commit on `main`'s first-parent history to the next. Items here
  are committed on main one after another, and that history holds only 3 merges.
- The 3 merges, each from its merge base to its second parent.
- The one open branch.
- The 7 closed items that recorded a base, each from the base to its close commit.

For each window I took the revert set from `git diff --raw -z --no-renames --full-index`, kept the
paths `classifyPath` calls code, and applied:

- R3's mode test, file/directory prefix test and `fold` collisions;
- the name test;
- R4's ancestry test.

Results:

- 13 windows have no code. R1 refuses them, and item 100 asks no receipt of them.
- The 38 windows with code hit **R3 0 times, the name test 0 times and R4 once**, so about 1 in 38.
- The one hit is item 34's window, which spans the two merges of `fix/mstack-front-door`. With a
  base recorded after those merges, it would pass.
- The history cannot show R2's refusals: a dirty tree and variants on disk.
- R5 refuses every run in this repository from `./bin/mstack` and none from a copy. It costs a step,
  not a receipt.

## 6. The spec as a contract

- **Acceptance.** A1, A2 and A3 each map to requirements (spec.md:9-11); I checked the mapping
  against the requirement texts.
- **Coverage.** There are 28 requirements. Each has one to seven scenarios and at least one named
  test, and every task names the R-ids it covers. Each "Done when" count equals the number of tests
  the task names (11, 16, 12, 11, 8, 17, 9, 16, 11, 8, 11, 7 and 7; 144 in all).
- **Executability.** No task has a placeholder. Every path and command exists: `bun run test`,
  `bun run typecheck`, `scripts/check-doc-links.mjs`, `tests/lock-holder.ts`, the "Your report"
  section of `agents/implementer.md`, and `skills/ship/SKILL.md`. `lockPath` is named only in task
  1.2, but its meaning is plain from the Terms.
- **Gaps:**
  - R3's name clause has no test (N6).
  - R16's text promises more than a SIGKILL of the group allows (N4).
  - R23 does not say how a null and a non-null pid namespace compare, or that a failing `ps` means
    "may be alive", and no test covers another namespace (N11).
  - R11 has no scenario for an edit between the copy and the lock (N1).
- **More than one MUST.** R14, R17, R21 and R26 carry two to four MUSTs each. Each clause has a
  scenario, so I would not split them.
- **Task 5.3.** It runs the copy by absolute path, decides on `test -e`, and states the caveat for a
  `--plugin-dir .` session. Correct.

### Size, and where to cut

The spec has 28 of the 30 requirements allowed, 13 implementation tasks and 144 tests. One
implementation can carry it. The risk sits in tasks 2.2, 2.3 and 3.3, and those are tested from the
primitives up.

If it is cut, the first half is groups 1, 2 and 4 plus `verify --restore`. That half is safe on its
own: no command can take a lock, so it cannot touch a tree, and the gate and the hook already know a
lock when `--mutation` arrives.

Cut or not, land group 4 before task 3.4 exposes `--mutation`.

## Non-blocking findings

**N1 to N4 lose work, or make a requirement unmeetable or the check useless, if skipped. Apply them
before code is written.**

- **N1.** In the Terms (spec.md:28), define H(p) as the identity of the staged copy `head/<n>`: the
  SHA-256 of the bytes copied, and the bits from an `fstat` of the descriptor read. It is not a fresh
  read of p. Add to task 2.2 the test `R11 an edit between the staged copy and the lock blocks the
  revert and keeps the edit` (`hcopy-exp`).
- **N2.** Extend R28 in two ways:
  - `mstack worktree prune` does not offer a worktree whose git directory holds the lock or a
    non-empty `mstack-mutation/*/rescue/`;
  - the gate, in any worktree, warns on every worktree's rescue
    (`<git common dir>/worktrees/*/mstack-mutation/`).
  Add `src/worktree.ts` to the Impact list and a test to task 4.1, and fix design.md:461-462
  (`wt-exp`).
- **N3.** In task 4.2, change `denied()` in `tests/hooks.test.ts:283-286` to pass a throwaway
  directory as `cwd`, so the suite never reads this checkout's lock. Otherwise the test `the safe
  forms are not denied` kills every later mutation run here.
- **N4.** When `watch-parent` is set, spawn the helper detached too. A SIGKILL of mstack's group then
  still leaves the watch running, and mstack's handler already forwards a Ctrl-C through `stop()`.
  If this is not taken:
  - R16 must say "the mstack process alone";
  - design.md:318 and "cannot be made safe" 2 must say that a SIGKILL of the group leaves the
    obligation running until it ends (`groupkill-exp`).
- **N5.** After R11, the run's own restore should skip the entries the revert never wrote; it has
  them in memory. Otherwise the save that stopped the revert is moved into `rescue/`, and the older H
  is written in its place.
- **N6.** Give R3 a scenario, and task 1.3 a test, for a name with a newline and one with non-UTF-8
  bytes; build the commit with `git update-index -z --index-info`. Say that detection works on the
  raw bytes (a Buffer, or a decoder with `fatal`), because `git()` decodes with replacement.
- **N7.** Change the fold to `s.normalize("NFD").toLowerCase().toUpperCase().toLowerCase().normalize("NFC")`,
  which joins `ẞ` with `ss`. Re-run `fold-sweep.mjs` until it reports 0 misses.
- **N8.** In R15, for "a parent that is not a directory by exact name", print the fix: rename it back
  to git's name (`mv src/Lib src/lib`). Say that `git stash` does not clear it.
- **N9.** Narrow window 1. In the revert and in the restore, re-check E with `lstat` (inode, size,
  mtime, ctime) after the fsync and immediately before the rename. On a change, unlink the temp file
  and decide again. Also state the window in the wiki (task 3.4) and in the line printed when the
  lock is taken.
- **N10.** Record HEAD's symbolic ref in the lock. R19 names `git reset <lock HEAD>` only when HEAD
  is still on that branch; otherwise it names `git switch <branch>` first.
- **N11.** Fix the liveness rule:
  - Compare the host first: a lock from another host is `unknown`, whatever its boot time.
  - A different boot time alone never makes a live pid `not-running` when that process started no
    later than `startedAt`.
  - Use `ps -o etime=` (elapsed time, no time zone) instead of `lstart`, whose local time is
    ambiguous for one hour each autumn.
  - In R23, say that a failing `ps` means "may be alive", and that a null pid namespace against a
    non-null one counts as another namespace. Add a test for that.
  - In the wiki, name a restarted container as the common way to reach `unknown`.
- **N12.** In design.md:344 and in R15's message for a missing staged copy: after the lock is deleted
  by hand, p may be absent, and `git restore -- <p>` puts HEAD's content back.
- **N13.** Add to task 3.3 the test `R17 SIGINT to the group at reverted:0: no obligation starts`
  (round 2's N4).
- **N14.** Take the key before the baseline as well, and refuse the run when it differs from K0. An
  untracked test edited while the baseline runs is invisible to R2's second check and to R18 (e).
- **N15.** In "By hand" way 3 (design.md:284-288): keep `rescue/` when deleting the run directory,
  and delete only `start/`, `head/` and the lock.
- **N16.** State three more trade-offs:
  - R4 sees only merges, so commits by others that reach the branch after the start by
    fast-forward, squash or cherry-pick are reverted as the item's, which can produce a kill on code
    that is not the item's.
  - An obligation that installs dependencies leaves ignored files (`node_modules`) at the start's
    versions.
  - An obligation that rewrites code (`--fix`) ends every run with no row and a rescue.
- **N17.** Optionally, add the lock file to the existing `rm` guard. An agent told that the gate is
  red may delete the lock.

## What I did not check

- No feature code exists, so every planned behaviour is rung 3 at best. The git and filesystem
  primitives are rung 4, on macOS APFS with git 2.54.0.
- I reasoned about these (rung 2) but did not run them: Linux, a case-sensitive disk, a second
  filesystem (EXDEV), ENOSPC, `F_FULLFSYNC`, a clock step, a container's pid namespace, NFS.
- What Claude Code sends to a background Bash command on TaskStop or at session end. That decides
  whether N4's group SIGKILL happens in task 5.3's own setting.
- The history count covers only the rules that read the diff. R2's working-tree refusals cannot be
  reconstructed from history.
- Item 100. Receipts are machine-local and gitignored (`src/setup.ts:72`). A receipt written in a
  linked worktree's store is therefore not in the main checkout's store after the merge. That is item
  100's to solve, and nothing in this spec prevents a solution.
- No ledger row: `agents/spec-reviewer.md` asks for none.
