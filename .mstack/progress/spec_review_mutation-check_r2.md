**Verdict:** CHANGES_REQUESTED

# Spec review, round 2: item 42 mutation-check

Reviewer: spec-reviewer by hand (plugin not loaded). I did not write this spec. Reviewed at
`7dda36879b19694f247108b62c98836832f0c430` on `feat/mutation-check`. `./bin/mstack gate` was green
before the review (`./bin/mstack version`: mstack 0.2.1 at this checkout).

What I read:

- `./bin/mstack state show 42` and decisions.tsv rows 231, 232 and 233.
- The round 1 review and its `specreview42/` scripts.
- The four spec files and the author's hand-off, and the diff `fe644f5..7dda368 -- .mstack/specs`.
- The author's `spec42r2/` scripts and outputs.
- The code each claim rests on: `src/verification.ts`, `closing.ts`, `size.ts`, `pathclass.ts`,
  `hooks.ts`, `gate.ts`, `git.ts`, `run.ts`, `run-helper.mjs`, `cli.ts`, `paths.ts`, `tsv.ts` and
  `worktree.ts`; `hooks/hooks.json`; `tests/helpers.ts`, `tests/state-cli.test.ts` and
  `tests/run.test.ts`; `skills/ship/SKILL.md`.

I re-checked every `file:line` that design.md "Context" and tasks.md cite. Each is right.

Experiments are in the session scratchpad `specreview42r2/`. Each is a `bash` script that starts
`set -euo pipefail` and makes a checked `cd`, and its output sits beside it as `*.out`. They ran on
macOS (case-insensitive APFS) with git 2.54.0 (Apple Git-157), git-lfs 3.8.1, node v26.13.1 and
bun 1.3.11. No mstack code for this feature exists yet. Where an experiment emulates a planned
function, it uses the primitives design.md names. The lock script is fully specified in design.md
"The lock", so `lockscript.mjs` generates it exactly as written and `sh` runs the real thing.

## Blocking findings

### B1. `sh <lock>` silently deletes work, and the spec offers it everywhere as an equal way out

design.md:336-337 says: "No case keeps the lock with deleting work as the only way out ... and
`sh <lock>` is always available."

The spec puts `sh <lock>` beside `verify --restore` in every place a user looks:

- the run's own output (design.md:57);
- the gate line (R22, spec.md:477);
- the hook's deny reason (R21, :458);
- a failed restore (R19, :433; design.md:209);
- an unparseable lock (R43, :855);
- task 5.3 step 5.

The only warning is a comment inside the lock that it "overwrites what is at each path"
(design.md:158).

`sh-exp.sh` ran the script that design.md:160-165 specifies, after a simulated revert:

| Shape | What `sh <lock>` did |
|---|---|
| Start has the directory `src/y/` holding `b.ts`. HEAD has the file `src/y`. The run wrote an untracked `src/y/out.log`. | Exit 0, lock removed, `src/y` is HEAD's file, **`out.log` gone**, `git status` clean. `git restore` removes the directory with its untracked content, as review case b2 found. |
| Start has the file `src/x`. HEAD has `src/x/a.ts`. The user edited the reverted `src/x` during the run. | Exit 0, lock removed, **the edit is gone**: `rm -f -- 'src/x'` removes whatever is at a path HEAD lacks. `git status` clean. |
| The user edited a reverted file at a path HEAD has. | `git restore` overwrites the edit. This is the documented case. |

In every row the lock goes and git shows nothing, so nothing tells the user that anything was lost.
`verify --restore` would have kept the lock and named the directory in the first row (R30), and
rescued the edit in the second. So the "git alone" recovery is the one path in the spec that loses
work, and the spec presents it as interchangeable with the safe one. When the lock is damaged (R43),
or in this repository while `src/` is reverted (task 5.3 step 5), it is the only exit offered.

Hostile names, by contrast, are safe (`sh-exp` A). The script ran with cwd `/` and restored every
path literally:

- spaces, a quote, a newline, a leading `-`, a backslash;
- `:(top)magic.ts` and `star*.ts`: `GIT_LITERAL_PATHSPECS` held, and a modified tracked `starX.ts`
  was left alone;
- `$(touch PWNED).ts` and a backtick name: nothing executed, and no `PWNED` file was created.

Fix: make the script check before it writes anything. It already knows every path's start blob and
HEAD blob, so for each path it can test `[ -d ]`, or compare `git hash-object -- <p>` (or
`readlink`) against them. If any path holds something else, or a non-empty directory sits where
HEAD has a file, the script prints the path and exits 1 before writing. Moving such a path aside
with `mv` to a rescue name also works. Add two tests: `R31 sh refuses over an edit` and `R31 sh
refuses a non-empty directory where HEAD has a file`. Until then, design.md:336-337 is false.

Rung 4 for the script as specified.

### B2. A case-only rename on this machine's default filesystem keeps the lock for good

- R6 (spec.md:184-187) explicitly lets the run go ahead: the refusal compares by dev/ino
  (design.md:117-118).
- The Terms then define "absent" as "no file and no symlink at it" (spec.md:32-35).
- The proof (R16) and R29 (a) both read paths that way.

`case-exp.sh` walked the revert, the restore and the proof with the design's primitives. The item
renamed `src/Foo.ts` to `src/foo.ts`, and git lists that as `D src/Foo.ts` plus `A src/foo.ts`.
Under node and under bun:

- R29 (a) fires: `src/foo.ts`, whose S is absent, "holds" the reverted `Foo.ts`.
- The proof fails for `src/Foo.ts` (H absent): `lstat` finds the restored `foo.ts`.
- So the lock is kept and the run exits 3, while `git status` is clean.

Every later `verify --restore` classifies `foo.ts` as "another file" at `src/Foo.ts` and moves it
into rescue (design.md:207). It then writes it back and fails the proof again. The tool has no exit,
and the gate stays red until someone runs `sh` (which happens to work here) or deletes the lock.

Fix: decide "absent" and "holds" by the exact name of the directory entry (read the parent
directory and match the name exactly), or treat case-variants with the same dev/ino as one entry.
Add a restore test for the case-only rename, not only the refusal test. The task 1.2 test skips on
case-sensitive systems, so CI on Linux would never run either; say that 5.1 runs it here.

Rung 4 for the filesystem behaviour, rung 3 for the planned restore.

### B3. The ship order is broken: a killed receipt proven on the branch does not survive the merge

`skills/ship/SKILL.md` step 7 merges and then closes on the default branch. The spec leaves this to
the user: design.md:500-504, proposal.md:56-58, and task 5.4 for item 42 only. Under the
coordinator's position (merge, then close, must keep working in a consumer project), it is blocking.

`close-exp.sh` emulated `measureStart` and design.md's `mutationKey` with real git:

- The run was on the item's branch, in a linked worktree as `mstack worktree new` makes one.
- The base was recorded after a spec commit, as `src/cli.ts:700-707` does.
- That worktree held one untracked `notes.txt`. The classifier calls it code
  (`src/pathclass.ts:50-55`).

| Case | Exact key on main | Task 5.4 workaround (`--base HEAD^1`) | Rule C' below |
|---|---|---|---|
| V1: main did not move, `--no-ff` merge | **differs**, only because `notes.txt` is in the branch checkout and not in main's. Copying it in makes the key match. | differs (same reason) | holds |
| V2: main moved (`src/other.ts`), `--no-ff` merge | **differs** (`src/other.ts` is in the set) | differs (`notes.txt`) | holds |
| V3: main did not move, squash merge | **no key: the start is `lost`**, so R24 gives a refusal `--force` cannot override (spec.md:536-538) | differs (`notes.txt`) | holds |
| V4: main also changed another region of `src/m.ts`, which the item changed | differs | differs | void (correct) |
| V5: after the run, `tests/helpers.ts` added on the branch, then merged | differs | differs | **holds (wrong)** |

What this means:

- A consumer who squash-merges can never close an item of size m or l without `state set --base`.
- One who merges with a merge commit can close only if both checkouts hold byte-identical untracked
  code and test files and the default branch did not move.
- Task 5.4's workaround works for item 42 only because this repository's checkout has no untracked
  files.

Two rules were named as candidates. Each was judged against the cases above.

1. **The receipt holds while its commit is an ancestor of HEAD and no later change touches the
   item's paths.** It fixes V1 and V2. It does not fix V3 (a squash or rebase merge has no
   ancestry). It lets V5 through and weakens the branch too: a new test file added after the run
   no longer voids, which contradicts R14 and row 232.
2. **A key built from the item's own code and test paths.** The paths can be recovered from the
   row's own `sha`, so no new column is needed. I call this C' below. It fixes V1, V2 and V3, and
   voids V4 correctly.

The smallest rule that delivers is **C'**, applied as a fallback in R23 and only on the default
branch, so that the branch keeps the exact key. It reads: a `mutation-killed` row with the current
command still holds when

- HEAD is on the default branch;
- the item's base is an ancestor of the row's `sha`;
- every code or test path that differs between the base and the row's `sha` holds, in the working
  tree, that commit's content and mode (absent where that commit lacks it).

It must be evaluated before R24 calls a `lost` start "git cannot answer". Add two companions:

- When HEAD's first-parent history holds a merge whose second parent contains the row's `sha`,
  require that no code or test path differs between the row's `sha` and that second parent. This
  closes V5 for merge commits, which this repository uses (`git log --merges main`).
- Refuse a run while an untracked file that the classifier calls a test is in scope. Otherwise a
  kill earned by a test that was never committed would hold on main without the test. This is
  narrower than the refusal the design rejected (design.md:445-447), which also covered untracked
  code.

What C' lets through wrongly, stated so the coordinator can weigh it:

1. Other work on the default branch, outside the item's paths, that changes whether the item's tests
   bite. Examples: another item adds the same function to a shared module, or changes the test
   runner's configuration.
2. With a squash merge, a code or test file added to the branch after the run. The branch's own
   gate shows that red before the merge, but nothing enforces it.
3. Untracked files in the closing checkout are ignored. That is the intent.

The other way out is to close before merging, which changes `skills/ship/SKILL.md`. The coordinator
has said no to that.

Rung 3-4: real git, emulated key and start.

### B4. Task 5.3 step 5 cannot detect the case it exists for

Step 5 (tasks.md:299) reads: "If it did not end that way and `./bin/mstack gate --quiet` names a
lock that is not running".

While `src/` is reverted, `./bin/mstack` is the start's code. The same step says so of
`verify --restore` (`copy-exp`: "unknown command 'verify'"). The start's gate has no lock check
either, so the condition can never be true when the tree is reverted, and the restore branch is
skipped. "Repeat from 3" then runs `./bin/mstack gate --full` on the reverted tree. That is again
the start's code, with no R40, so it runs the obligations there and records receipts. A later
`verify --mutation` is refused by the lock (R7), so this fails closed, but the step as written
misleads the operator.

Fix: from step 2 to step 6, make every mstack call through `"${TMPDIR:-/tmp}/mstack-42-cli/bin/mstack"`,
and decide step 5 on `test -e "$(git rev-parse --absolute-git-dir)/mstack-mutation.lock"`. In
step 5's `sh` fallback, use that absolute git-dir path rather than `.git/`, which is a file in a
linked worktree.

Rung 3.

## Round 1 findings

| Finding | Closed? | Requirement and evidence |
|---|---|---|
| **B1** the key covers code and tests | **Closed** | Terms "key set" (spec.md:29-31); R13 prefix `mutation:` (:294); R14 voids on a test edit and on an added code or test file (:321-325); R23 "a test edited after the run" (:528-530); R24's exemption stays on the code diff (:532-534). Tasks 1.1 and 4.1 name the tests. Only the quoted acceptance text is stale (see the author's point 3). |
| **B2** nothing untracked is reverted; one meaning of "empty" | **Closed** | The revert set is tracked start..HEAD (:25-28); the code diff is tracked start..working tree, and its emptiness is the single "empty" used by R4, R23 and R24 (:22-24). R3's "untracked files stay" scenario (:113-115) and R4's "only code is untracked" scenario (:130-132) pin it. |
| **B3** the per-path proof | **Closed for `verify --restore`** | Walked below. Two remaining holes: B2 above (case-only rename) and B1 above (the `sh` exit). |
| **B4** restore never overwrites what it did not write; unique rescue; refuse collisions | **Closed for `verify --restore`** | R30 (:656-683), a run directory per run with a non-recursive `mkdir`, exclusive names, R42. R6 (:153-192) refuses before anything is touched: an untracked file or a directory with one in the way, a symlinked parent. Not closed for `sh <lock>` (B1 above). |
| **B5** a git-only recovery, printed and stored; this repository runs from a copy | **Partly** | R31 prints it before the revert, and the lock is the script; R28 refuses to revert the running CLI's source. But the recovery loses work (B1 above), and task 5.3 step 5 cannot fire (B4 above). |
| **N1** a group Ctrl-C cannot kill the restore | **Closed** | No child process from lock to removal (R35, :750-754; design.md:196). `sig-exp` (the author's) shows a group SIGINT handled after a pure-fs loop on both runtimes. One gap: N4 below. |
| **N4** no receipt when the tree changed | **Mostly** | R29 (a)-(d). Gaps: N5 below. |
| **N7** merged code is not reverted as the item's | **Mostly** | R33. Misses a sibling branch merged with a fork-point start (N6 below). |

Walk of the four B3 cases through design.md "Restore" and "The run":

- **A commit from another terminal.** Paths at S(p) get H(p), and the proof passes, so the lock is
  removed. R29 (b) means no row. R20 prints both shas. The advice it prints is wrong (N1 below).
- **A `git add`.** The working tree is restored and the index is never written, so the lock is
  removed. R29 (d) means no row. R32 prints `git diff --cached -- <p>`. It should also name the fix,
  `git restore --staged -- <p>`: a plain `git commit` would record the reverted content.
- **The user's edit to a reverted file.** The edit goes to `rescue/<p>`, H(p) is written, and the
  lock is removed. No row. The gate warns (R42).
- **A tracked file the obligations rewrite.** It is left alone, and the lock is removed. R29 (d)
  means no row when it is code or test. R32 names it without a cause.

Through `verify --restore`, no case leaves deleting work as the only way out. The states that keep
the lock (a directory with content where HEAD has a file, EACCES) are cleared by moving files or by
`chmod`. The exceptions are B2 above, and N8 below (EXDEV on rescue, or a missing staged copy),
where the exit the spec offers is `sh`, which is B1 above.

## The mechanism, attacked

Moved unchanged to `.mstack/progress/attachments/spec_review_mutation-check_r2.md` on 2026-11-19, to bring this report under the 24576 byte cap. No finding and no verdict line was edited.

## The author's four points

1. **Hooks of a `--plugin-dir .` session run the reverted `src/`.**
   - Judgement: right. The CLI cannot see which plugin directory a session loaded. A stated
     precondition is enough for a one-off run in the plugin's own repository, because R28 already
     forces the run itself onto the copy and the hooks only guard the model's git commands.
   - Is anything a consumer could hit hidden behind it? Barely. A consumer's hooks run from the
     plugin's install directory, which is outside the reverted tree. Only a vendored plugin loaded
     with `--plugin-dir` from inside the tree shares the problem.
   - Recommend: accept, fix step 5 (B4 above), and add one sentence to the task 3.5 docs paragraph:
     R28 covers the CLI, not hooks loaded from inside the tree.
2. **The closing order.** The spec does not deliver it. This is blocking (B3 above). Recommend R23's
   fallback C', with its two companions.
3. **The acceptance wording.** `state show 42` now reads "keyed by the code and test tree (design
   amendment of 2026-11-18 ...)" for A1 and "at the current code and test tree" for A3. spec.md:6-8
   and the table (:12, :14) still quote "code tree" and say the item does. The author's point is
   moot. Update the quotes and drop the sentence. Non-blocking.
4. **H(p) is the working tree's bytes at lock time.**
   - Judgement: right. The author's `crlf-exp` shows that regenerating HEAD from git is not the
     user's tree, and `fs-exp` c and d show the byte copy comes back clean.
   - Does any requirement still say otherwise? Only the git-only path: R31's `git restore` writes
     HEAD's checkout form, so R31's scenario "status as before" (spec.md:695-696) is false in the
     `crlf-exp` case. The Terms' gloss "HEAD's content as checked out in this tree" (:37) is loose
     but harmless. Row 233 (2) reads fine either way. Non-blocking.

## Size and risk

Going from 27 to 43 requirements and from 9 to 19 tasks did not change what a reviewer must judge,
which is the restore. A reviewer can still judge the whole of it. It is more than one
implementation round should carry, and the two halves have different risks:

- **The mechanism** is A1 and A2: R1-R22 and R26-R43, tasks 1.1-3.5, 4.3, 4.4 and 5.1-5.3. It can
  lose work, and it is where B1, B2 and B4 above sit.
- **The policy** is A3: R23-R25 with tasks 4.1, 4.2 and 5.4. It is where B3 above sits, and it is
  the part that turns every in-flight item red with no migration.

**Recommend cutting.** Land the mechanism first. Its receipts are written but hold no item, so it
can be exercised on real items, including item 42's own run, before anyone is held to it. Then land
the closing check, with B3's rule, as its own item. The smallest safe first slice is exactly A1 plus
A2. Moving A3 to a new item changes item 42's acceptance, so it needs a `decide --resolves` from
the user.

Machinery the acceptance does not need: little. The requirements that look optional are small and
cheap, or are asked for by row 233:

- R38's other-host refusal;
- R43's "the root differs" line;
- R36;
- R42, which row 233 (3) asks for.

The async runner's 14 tests match the risk: `tests/run.test.ts` pins the same guarantees for the
sync runner. The size is the price row 231 accepted for working in place.

## Completeness

Moved unchanged to `.mstack/progress/attachments/spec_review_mutation-check_r2.md` on 2026-11-19, to bring this report under the 24576 byte cap. No finding and no verdict line was edited.

## Non-blocking findings

- **N1.** R20 and design.md:325 advise `git reset --soft <lock HEAD>`. That leaves the reverted
  content staged. `reset-exp`: after `--soft`, `MM src/a.ts`, the index holds `start`, and a plain
  `git commit` records the reverted code again. With `git reset <lock HEAD>` (mixed), only the
  user's own edit remains, unstaged. Use mixed, in spec.md:443 and :451 and in task 3.3's test name.
  (The `--soft` advice came from the round 1 review's B3 proposal.)
- **N2.** `gitBytes` must set `maxBuffer`, or better, `spawnSync` git with stdout to the staged
  file's descriptor. That also removes the in-memory copy. As written, every item that touched a
  lockfile over 1 MiB is refused (R5) for good and closes only by force (`buf-exp`).
- **N3.** The restore, and the `sh` script, must remove `<dir>/.mstack-mutation-<run>-<n>.tmp` for
  every entry: the names are known. Until then a SIGKILL inside an entry leaves an untracked code
  file in the tree. That file keeps a created directory, enters the key, and breaks R3 and R18.
- **N4.** Yield once (`await` a `setImmediate`) before step 5's signal check and before each spawn
  (`yield-exp`). Add group-SIGINT tests at `lock-written` and `reverted:1` that assert no
  `reverted:` step was journalled and no obligation started. These are the author's own named
  points. Also, a Ctrl-C during `prepareRun` kills a `git cat-file` child, and that reports as an
  R5 "cannot be read" refusal, not as exit 130.
- **N5.** R29 should snapshot the identities of the untracked key-set files in `prepareRun` and
  compare them at step 8. Its condition (d) should also count revert-set paths that differ from
  HEAD after a successful restore: that means H was captured after an edit made between R6's
  re-check and the lock. State in design.md that ignored files, and docs a test reads, are not
  watched.
- **N6.** R33 checks only when `why` is `base`. `r33-exp`: a sibling branch merged in, with a
  fork-point start (`older`), puts `src/sib.ts` in the revert set, and R33 does not refuse. That is
  a kill for code that is not the item's. A rule that catches both shapes: refuse when a merge in
  `<start>..HEAD` has a non-first parent that is not an ancestor of the start. It refuses the sibling
  merge and passes a merge of the default branch whose parent is the fork point.
- **N7.** Record `st_mode` (not only the exec bit) at prepare time, and restore it. Say that hard
  links and extended attributes are not kept.
- **N8.** When renaming into the rescue directory fails EXDEV, fall back to copy, fsync, unlink, or
  say what the user does. Rescue an unrecognised file before the "staged copy missing" check, so
  that `sh` never meets the edit.
- **N9.** `--restore --force` against a live run should not delete `start/` and `head/` of a run
  that may still be reverting. The live run should re-check the lock before each revert write. Put
  the pid in tree temp names, so that two restores do not share one temp file.
- **N10.** design.md:469-471 says a TTY-dependent suite "gives a red baseline here (blocked, not a
  false kill)". That is false when R8 counts a recorded `gate --full` green, which inherits the
  terminal, and that is task 5.3's path. Say so.
- **N11.** Wording:
  - The quoted acceptance text (point 3 above).
  - `createdDirs` is "parents of start paths that do not exist now" (design.md:149). It should be
    "that are not directories now": in the directory-to-file case the parent exists as HEAD's file.
  - R13's "restore passed the proof" against R9's blocked row, which has no restore.
  - R31's scenario in the `crlf-exp` case.
  - An empty directory is left where the item added files.
- **N12.** The revert's step 3 checks p but not its parents. Re-check the parents with `lstat`
  immediately before each write.
- **N13.** State that `prepareRun` can download LFS objects (network, 5 s per object) and that a
  missing one refuses the run (`filter-exp`).

## What I did not check

- No feature code exists. Every planned behaviour is rung 3 at best, except the lock script (rung 4,
  generated as specified) and the git and fs primitives (rung 4).
- Linux, and case-sensitive filesystems. A second filesystem (EXDEV is rung 2). Unicode
  normalisation on APFS.
- What Claude Code sends to a background command on `TaskStop`, or at session end.
- Whether a write to a hung-up TTY raises EIO (not EPIPE) through `out` during a restore. If it can,
  `out` must swallow every write error, not only EPIPE.
- `F_FULLFSYNC` and power-loss ordering.
- A real LFS remote.
- The emulated key in `close-exp` simplifies the classifier to `tests/` = test, `*.md` = doc and
  `.mstack/` = store. The rows depend only on which paths enter the set, not on the exact format.

No ledger row: the agent file asks for none.
