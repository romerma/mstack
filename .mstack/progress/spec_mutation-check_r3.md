# Spec hand-off, round 3: item 42 mutation-check

Author pass: spec-author by hand (plugin not loaded), not a reviewer of this spec. Written at
13ca783 on `feat/mutation-check`. `./bin/mstack version`: `mstack 0.2.1 at
/Users/romerma/Code/mstack`. Gate before starting, last line: `PASSED - 0 failures, 0 warnings`.

Read: `state show 42` and `100`; decisions.tsv lines 231, 232, 233, 262, 263; both spec reviews in
full; the round 2 spec and hand-off; the code at the lines design.md "Context" cites, each re-read
at 13ca783 (`main` is now `src/cli.ts:72-111`, `measureStart` `src/size.ts:81`, `counted`
`:149-152`, `runVerification` `src/gate.ts:744`, `sandbox` `tests/helpers.ts:30`; the rest had
not moved).

Requirement count, as `rg -c '^### Requirement:' .mstack/specs/mutation-check/spec.md` prints it:
**28**. Tasks: 13 implementation tasks in 4 groups, then 4 in "Verification and close".

## Where this message and row 263 differ, and what I did

- **Temp names "in the lock".** Row 263 (4) says every temp name is in the lock; N9 says to put
  the pid in tree temp names so two restores do not share one. A restorer's pid is not known when
  the lock is written, so the lock holds each entry's prefix (`.mstack-mutation-<run>-<n>.`) and a
  writer appends its own pid and `.tmp`. Every temp name is derived from the lock, and the restore
  sweeps exactly those (`spec42r3/ro-exp`).
- **Renumbering.** `skills/spec/references/ears.md` says ids are never renumbered; the brief says
  renumber from R1 because no code exists. I followed the brief.
- **Beyond the row's list of refusals** I added three, all refusals: a path whose name holds a
  newline or bytes that are not UTF-8 (R3); a path of the set, or a parent, that is on disk under
  another case or normalisation than git's (R2); and a case variant where the revert puts a file
  back (R2, by `lstat`). The first because the key and `git()`'s UTF-8 decoding cannot name such a
  path; the other two because `spec42r3/name-exp` b shows a rename over a variant destroys it.
- **Two pieces of machinery the row does not name**, which the reviewer or the owner may cut:
  1. a parent watch in `src/run-helper.mjs` (opt-in fifth argument; `runCommand` unchanged), so an
     obligation does not outlive a SIGKILLed mstack and write on the tree after `verify --restore`
     (`spec42r3/orphan-exp`: with it, gone 2 s after the kill on node and bun; without, alive);
  2. a liveness rule (boot time, pid namespace, `ps` start time) behind R23. Without `--force`
     (my N9 choice) a reused pid or a reboot would otherwise keep the lock until that process
     ends.

## Round 2's R1 to R43

| Round 2 | Now |
|---|---|
| R1 the command, one active item | R1 |
| R2 what is reverted | R9; its file/directory swap and symlink parts dropped: R3 refuses those shapes |
| R3 nothing outside the set; submodules listed | R10; the submodule listing dropped: a submodule in the set is refused (R3) |
| R4 empty code diff | R1 (empty revert set; "code diff" as a separate term dropped, item 100 defines its own) |
| R5 repository refusals | R1 |
| R6 working-tree refusals | R2; its "case-only rename is allowed" scenario is reversed (R3 refuses it) |
| R7 one run at a time | R1 (a lock exists) and R8 (two at once, one wins) |
| R8 the baseline | R6 |
| R9 red baseline | R7 |
| R10 killed, R11 survived, R12 blocked | R12 (one classification, three outcomes); `--timeout` range to R1 |
| R13 the receipt row | R20 |
| R14 the key | R21 |
| R15 the lock first | R8, now a JSON document, not a script |
| R16 restore proven per path | R13 |
| R17 signals during obligations | R16 |
| R18 `verify --restore` | R22 |
| R19 a failed restore keeps the lock | R15 |
| R20 HEAD moved | R19 (the report), `git reset` mixed |
| R21 the hook | R26 |
| R22 the gate on a lock | R27 |
| R23, R24, R25 | item 100 |
| R26 output lines in order | dropped: the lines that carry an obligation are R12 (final line, tail) and R25 (lock and restore command before the revert); the order of every phase line was a sentence nothing else needed |
| R27 cost and exit codes | dropped as its own: each exit code is in the requirement it belongs to (R7, R12, R15, R16, R22-R24); "at most twice" follows from R6 and R12 and R6's scenario tests it |
| R28 the running CLI | R5 |
| R29 changed under the run | R18, with (d) widened and (e) added (N5) |
| R30 restore writes only over what the revert wrote | R14 |
| R31 `sh <lock>` | dropped: row 263 (2); the by-hand ways are in design.md "By hand", each with what it discards |
| R32 other changes reported | R19 |
| R33 a merge after a base start | R4, with the review's N6 rule |
| R34 a revert that cannot complete | R11 |
| R35 nothing interrupts | R17 |
| R36 a signal during the baseline | R16 |
| R37 nothing to restore | R22 |
| R38 no restore under a live run, `--force` | R23, no `--force` |
| R39 the hook asks git only when it must | R26 |
| R40 `gate --full` under a lock | R27 |
| R41 `done` under a lock | item 100 |
| R42 rescued content reported | R28 |
| R43 the lock checked before a restore writes | R24 |

## Round 2 review findings

Each was checked against the code or an experiment before it was applied.

| Finding | Closed by | Evidence |
|---|---|---|
| B1 `sh <lock>` deletes work | R8 (the lock is one JSON document), R25 (only `<absolute CLI> verify --restore`, never `sh` with the lock), design.md "By hand" | `recover-exp`: the stash way keeps the edit and the start's file; `git restore` plus `rm` (round 2's script) loses an unstaged edit (b2) |
| B2 case-only rename keeps the lock | R3 refuses case-only and normalisation-only renames, and parents that differ so, on every filesystem; R13, R14 and the Terms decide holds and absent by exact name, and a variant is rescued before H is written | `shape-exp` (found from the diff alone), `name-exp` (a, b, c, d, e) |
| B4 task 5.3 step 5 cannot fire | task 5.3: every call from step 2 to 6 through `"${TMPDIR:-/tmp}/mstack-42-cli/bin/mstack"`; step 5 tests `test -e "$(git rev-parse --absolute-git-dir)/mstack-mutation.lock"` | `spec42r2/copy-exp` (the start has no `verify`) |
| N1 `reset --soft` | R19: `git reset <lock HEAD>`, mixed; its scenario asserts no `--soft` | `specreview42r2/reset-exp` |
| N2 1 MiB buffer | R9 scenario (3 MiB); design `gitToFile` streams to the staged file's descriptor | `stream-exp`: ENOBUFS with `execFileSync`, byte-equal with a descriptor, both runtimes |
| N3 temp files left by a SIGKILL | R8 (each entry's temp prefix in the lock), R13 (sweep first; scenario "Killed inside a write") | `ro-exp` |
| N4 yield before the signal check | R17 (a signal before the first write is acted on before any write or spawn; Ctrl-C while staging exits 130); design "The run" 6, 8, 10 | `yield-exp`: null right after the synchronous section, SIGINT after one `setImmediate`, zero spawns, both runtimes |
| N5 untracked edits unseen | R18 (d) any tracked change outside the store after the restore (catches H taken after an edit), (e) the key before the lock against after the restore; design trade-offs say ignored files and docs a test reads are not watched | walk |
| N6 sibling merge with a fork-point start | R4: a merge whose non-first parent is not an ancestor of the start | `merge-exp`, seven shapes; also refuses the item's own sub-branch merged back (accepted, stated) |
| N7 only the exec bit | Terms: identity includes `st_mode & 0o7777`; R13 scenario 0600 and 0444; trade-off: owners, hard links, xattrs, ACLs not kept | `mode-exp`: exact round trip, hard link split |
| N8 EXDEV, rescue order | R14 (copy, fsync, compare, unlink for a file or symlink; anything else R15); R15 and design "Write H" rescue before the staged-copy check | `mode-exp` (forced copy path, mode kept); EXDEV itself not reproduced, rung 2 |
| N9 `--force` under a live run | **No `--force`** (R23), chosen over a run that re-checks the lock: a re-check leaves a check-then-write window in which a forced restore strands S(p) with no lock. Writers' temp names carry their pid | `live-exp` for the liveness primitives |
| N10 TTY baseline | design "Trade-offs accepted"; the wiki paragraph in task 3.4 | `src/gate.ts:768` (`output: "inherit"`) |
| N11 wording | acceptance quoted verbatim from `state show 42`; the R13/R9 conflict gone (R20: "its restore (if a lock was taken)"); R31 gone; the empty directory is R9 "Directories". Not applied: "createdDirs = not directories now", because R2 now refuses a parent that is not a directory, so "absent now" is exact | read |
| N12 parents not re-checked | R11 (immediately before each write, p and its parents by exact name) | walk |
| N13 LFS in prepare | design "The lock and the run directory" (network, 60 s per blob); R1 scenario | `specreview42r2/filter-exp` |

B3 is item 100's. Round 1's findings stay closed as round 2's review table says, except B5's
git-only recovery, which is gone.

## The state walk

design.md, section "Every state, and its exit", walks each step of the revert and the restore, a
SIGKILL between and inside writes, and eighteen actors and conditions (an edit, a commit, a `git add`, a new file,
a case-only rename, a stash, the lock deleted, the run directory deleted, a second run, two
restores, a full disk, a read-only directory, Ctrl-C, another host). In every row the tree's
content that the run did not write is either untouched, rescued into `rescue/<k>/`, or left in
place and reported; and every row that keeps the lock has an exit that deletes nothing:
`verify --restore` after `chmod`, freeing space or waiting, or the by-hand stash, which discards
nothing.

## What I could not make safe

1. **A concurrent write in the check-then-rename window.** Between the tool's last check of a path
   and its rename, a write by another process is replaced and lost, whether it writes in place or
   renames its own temp file; so is a later write through a descriptor opened on the replaced file;
   and, for an EXDEV rescue, a write between the comparison and the unlink. `spec42r3/race-exp`
   plays the order on node and bun: the user's save is gone both ways. POSIX has no exchange
   primitive node exposes. A hard link kept to the replaced file would save the in-place case only,
   so it was not added (design.md "Rejected alternatives").
2. **The orphan's last 250 ms.** After a SIGKILL of mstack the helper needs up to one poll to kill
   the obligation's group; a `verify --restore` started in that window can be written over by it.
3. **Not unsafe, but by hand:** when someone deletes the run directory and git's checkout of HEAD
   is not the bytes the tree held (an `eol` setting, a mode other than 0644), R15's `git stash push
   -- <p>` cannot satisfy the proof, and the lock is deleted by hand. That discards nothing: the
   tree then holds HEAD's content and the stash holds the rest.

None of the three keeps the lock with deleting work as the only exit.

## Left open

- The default `--timeout` (900 s) and a reason column for blocked rows (design "Open questions").
- How many past items a refusal would hit: row 263 asks for that count before item 100 is
  specified; not counted here.
- SessionStart says nothing about a lock; the Edit and Write tools are not denied under one (the
  rescue saves what they write).
- Not run: Linux, EXDEV, ENOSPC, `F_FULLFSYNC`; the case-insensitive tests skip on Linux CI, so
  5.1 runs them here.
- Hooks of a `--plugin-dir .` session run the reverted `src/` during this repository's own run;
  R5 cannot see that, task 5.3 step 1 states it.

## Experiments

All under `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/spec42r3/`,
each a `bash` script starting `set -euo pipefail` with a checked `cd`, output beside it as
`*.out`, node and bun where the runtime matters: `shape-exp`, `merge-exp`, `name-exp`,
`stream-exp`, `yield-exp`, `orphan-exp`, `recover-exp`, `mode-exp`, `ro-exp`, `race-exp`,
`live-exp`. One line each is in design.md "Experiments this round". Still cited from earlier:
`spec42r2/` `crlf-exp`, `copy-exp`, `hash-exp`, `sig-exp`, `fs-exp`; `specreview42r2/`
`filter-exp`, `reset-exp`, `buf-exp`.

Rungs: git and filesystem behaviour rung 4 on macOS APFS; the planned modules rung 3 at best (the
experiments emulate them with the primitives design.md names); EXDEV and ENOSPC rung 2.

## What the reviewer should try to break first

1. R14's table against the third acceptance bullet: a state where the restore overwrites or
   removes what the run did not write, other than the window above.
2. R23's liveness: a state where `verify --restore` runs under a live run, or a dead run's lock
   stays with no exit but by hand.
3. R3's fold: a pair this filesystem treats as one name that the fold misses (`name-exp` e tried
   nine).
4. R18: a change under the run that (a) to (e) all miss and that leaves a row certifying a tree
   that did not run.

## Gate

- Before starting: `PASSED - 0 failures, 0 warnings`.
- Just before the commit, with these five files uncommitted: `PASSED - 0 failures, 1 warning`
  (the warning is `5 uncommitted change(s)`).
- After the commit: this file is inside that one commit, so its last line could only be pasted here
  by a second git write, which this session's rules forbid; it is in the author's return line.
