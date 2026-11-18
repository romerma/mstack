# Spec hand-off: item 42 mutation-check

Author pass: spec-author by hand (plugin not loaded). Four files in `.mstack/specs/mutation-check/`:
27 requirements (R1-R27), 9 tasks in 5 groups. Evidence: every cited file:line was read in this
checkout; one scratch experiment (git 2.54) for `git restore --source --worktree`. Nothing else was
run, so behaviours of the new code are rung 2 (read), not rung 4.

## Settled (and why)

- **`verify` does not exist yet.** The dispatcher has 13 commands, none `verify` (`src/cli.ts:72-107`).
  It is new, with `--mutation`, `--restore [--force]`, `--timeout <s>` (default 900).
- **Revert = list of paths, never the tree.** Revert set = code paths differing between the start
  (`measureStart`) and the working tree, same predicate as the size check (exported, not copied).
  Index never written. Restore touches the lock's list only, to the lock's HEAD sha, so an edit
  the user made to a test after a crash is not overwritten, and a commit made despite the hook is
  undone in the tree and left in history (R20).
- **Lock** = complete temp file, fsync, `link()` into `<git dir>/mstack-mutation.lock`, fsync dir,
  before the first file is touched. Never half-written, so an unparseable lock is damage and is
  refused with manual recovery. Linked worktrees get their own.
- **Restore states per path**: at HEAD / at start / neither; "neither" is copied to a rescue dir
  first. Idempotent; covers all four SIGKILL points. Proof before unlink of the lock: listed paths
  match HEAD and no tracked file outside the store dir differs. Untracked output of the obligations
  is listed and left. A failed restore keeps the lock, continues, exits 2, records no row.
- **Outcomes**: killed = first obligation exits other than 0/126/127 on the reverted tree (a build
  failure counts, and the output says it cannot be told apart); survived = all exit 0; blocked =
  timeout, signal, spawn error, 126/127 (the shell could not run it: e.g. the item added the
  verify script and the revert removed it), or a red baseline. Exits 0 / 1 / 2; refusals are 2.
- **Baseline**: all obligations have a green receipt at the current sha+treeId (tree not
  `unknown`) -> not re-run; else run and record `passed`/`failed` like `gate --full`. Re-check the
  tree after the baseline. Runs per invocation: at most 2 per obligation.
- **Receipt**: six existing columns, no new column; outcomes `mutation-*`; `tree` = `code:<16 hex>`
  over (path, start mode+blob, working mode+content) of the revert set; `command` = obligations
  joined with ` && ` and must match at check time (so editing `verification` voids it). Older
  readers drop the rows (`receipts()` filters on outcome), so a mutation row can never satisfy a
  verification obligation. The reverted runs are never recorded as passed/failed.
- **Closing check** `mutation` (gate at `verifying`, `state set done` always), overridable except
  when git cannot answer; plus `mutation-lock` (never overridable) and a gate line that is red with
  no active item; `gate --full` runs nothing under a lock. Forced close: new marker naming the check;
  marker logic becomes a function of the overridden set (3 hardcoded combos would become 7).
- **Hook**: new branch in `preToolUse`, one `git rev-parse --absolute-git-dir` only when a segment
  matches `git (opts) commit|add|stash`; fail-open. Aliases, `git-commit`, interpreters not caught;
  stated in R21 and the docs. No status-line change (renders every message, no new git calls).

## Where the decided design is wrong or thin (spec follows the design row)

1. **Tests are not in the key.** The row keys the receipt by code only. Edit a test to be vacuous
   after a killed run and the receipt still holds and the gate stays green: the exact hole the
   command exists to close. I added the obligation text to the match as a cheap partial fix (R23),
   but did not add test paths to the fingerprint because the row says code only. Recommend adding
   test paths of the item's own diff to the key (docs and store stay out); one line in `codeKey`.
2. **"Restore on SIGINT/SIGTERM" is not possible with `runCommand`.** It is `spawnSync`
   (`src/run.ts:81,92`); a handler cannot run while it blocks, so SIGTERM to `mstack` alone waits
   for the obligation. The spec needs an async runner (task 2.1), reusing `run-helper.mjs`.
3. **"Restore is exactly put HEAD back" is not literally true**: the store directory is dirty by
   construction (`state.json`), and a whole-tree reset would also be unsafe after a crash. The spec
   restores the list instead (same observable result when the tree was clean).
4. `git restore --source=<c> --worktree -- a b` fails whole when one path is absent from `<c>`
   (tried), so restore is one call per path, `unlink` for paths HEAD lacks.
5. Every in-flight item at `verifying` with a base and no/other size than `s` turns red (item 42
   itself has no size). No migration, per the row; flagging for the reviewer.

## Left open

- `--timeout` default of 900s: a ceiling for hangs; the baseline's duration is not recorded.
- Whether a blocked row should carry its reason (a 7th column is the only schema change
  `ensureHeader` takes). Reason is printed only.
- Case-only rename on a case-insensitive FS: handled by the precondition rule in design.md; the test
  skips itself on case-sensitive filesystems, so it is unproven on CI's Linux.
- Submodule entries are listed as "not reverted" and excluded from the key; not otherwise handled.
