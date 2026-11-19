Sections moved unchanged from `.mstack/progress/spec_review_mutation-check_r2.md` on 2026-11-19.

## The mechanism, attacked

| Attack | Result | Evidence |
|---|---|---|
| An edit to a reverted file during the run | Rescued byte for byte, lock removed, no row | design.md:207; R30 scenario |
| A directory where HEAD has a file, and the reverse | `verify --restore`: lock kept and contents named, or rescued. `sh`: silent loss in both directions | B1 above, `sh-exp` B and C |
| A symlinked parent | Restore: "a parent that is not a directory" leaves it and keeps the lock. Say it uses `lstat` on every parent. Revert: the parents are checked by R6 only, so a parent swapped between R6's re-check and the revert writes is followed by `mkdir` and the temp write (N12 below) | design.md:185-189 |
| File modes | The exec bit round-trips (`fs-exp` f). Other bits do not: a 0600 or 0444 file comes back with the umask's mode, and a hard link is split (N7 below) | design.md:125, 205 |
| A file larger than memory, or just over 1 MiB | `gitBytes` with git()'s options hits execFileSync's 1 MiB `maxBuffer`: **ENOBUFS on node and bun** for a 1.5 MiB `package-lock.json`, which the classifier calls code (N2 below) | `buf-exp` |
| `--restore --force` against a live run | Ends with no row (R29 c). It can strand paths at S(p) with no lock and no staged copy if it lands during the live revert (N9 below) | walk |
| SIGKILL between steps | Every state between entries is recoverable from the lock and the staged copies. **Inside one entry**, between the temp write and the rename, `<dir>/.mstack-mutation-<run>-<n>.tmp` is left in the tree, and neither the restore nor `sh` removes it (N3 below) | design.md:186-187, 194-216 |
| Staged copies deleted | Restore records a failure, keeps the lock, and names `sh`. With an edit at that path, `sh` overwrites it (B1 above). Rescue the edit before checking the copy (N8 below) | design.md:209 |
| Git directory on another filesystem | Tree writes stay atomic: temp and rename are in p's own directory. Rescue is a rename into the git directory, which fails EXDEV, and the spec does not say what happens (N8 below). Rung 2 (rename(2) semantics, not tried) | design.md:207 |
| A linked worktree | The lock and run directory are in `<main>/.git/worktrees/<name>/` (checked: `git rev-parse --absolute-git-dir` in `close-v1-wt`). They go when that worktree is removed (design.md:482-484) | `close-exp` repos |
| A read-only file | rename over it works, and the restore drops its read-only bit (N7 below). A read-only directory: R19 and R34 | |
| A case-only rename | **B2 above** | `case-exp` |
| A group Ctrl-C after the lock is written, mid-revert, mid-restore | Mid-restore: safe (pure fs). After the lock and mid-revert: the handler does not run until the first yield, so step 5's "if no signal yet" check and step 6's spawn both happen first. **The obligation is started on the reverted tree, then stopped.** The end state is right, but R35's "restores (nothing to do)" is false as designed (N4 below) | `yield-exp`: `seen=null` right after the synchronous section and `SIGINT` after one `setImmediate`, on node and bun |
| Hostile path names in `sh <lock>` | Safe: no injection, literal pathspecs, leading `-` | `sh-exp` A |
| A change no R29 condition sees | An edit to an untracked code or test file that existed before the run. An edit to a revert path between the R6 re-check and the lock. A doc a test reads (this repository's `lint-plugin` reads `SKILL.md`, which the classifier calls a doc) (N5 below) | walk |
| `git cat-file --filters` | A smudge filter is applied (rot13: blob `uryyb`, `--filters` `hello`). LFS with the object present gives the content. **LFS object missing and no remote: exit 128 at once, so an R5 refusal.** With a remote it downloads under git()'s 5 s timeout. A required filter that cannot run: exit 128, refusal. A path the start lacks is never read (mode 000000), and would fail if it were. `eol`: the author's `fs-exp` d | `filter-exp` |
| `hash-object --stdin-paths` with absolute paths (the key) | Attributes apply: under `sub/*.txt eol=crlf`, the relative path, the absolute path and the index agree. A clean filter (rot13) gives the index blob. R14's claim holds | `filter-exp` |

On the untracked edit the author left undetected "by design": **it is not acceptable as stated, and
it is not stated.** It appears only in the hand-off; spec.md and design.md say nothing (`rg -i
'existed before|pre-existing'` finds only R32's "did not exist when the run began"). The key holds
untracked code and test files precisely so that an untracked test cannot be swapped after a kill. An
edit to one during the run is that swap, and the row then certifies a test that never ran. The fix
is cheap (N5 below).

## Completeness

- Acceptance: A1 maps to R1-R14, R26-R29, R33 and R34; A2 to R15-R22, R30-R32 and R35-R43; A3 to
  R23-R25 and R41.
- Scenarios, tasks, tests: every requirement has at least one scenario, a covering task, and a named
  test (`matrix.mjs` over spec.md and tasks.md; table below).
- Counts: every "Done when" count matches the tests the task names (14, 19, 8, 7, 15, 14, 3+3, 15,
  5, 6, 14, 12, 10, 5 and 4+4). `onEach` names a test `<name> [<runtime>]`
  (`tests/state-cli.test.ts:34-36`), so `-t "^R25 "` gives 10.
- Node output: node's `# fail 0` is the TAP reporter, which is what a non-TTY Bash tool gets.
- One-obligation rule: still broken by R3, R13, R25, R29, R30, R35 and R39 (two to five MUSTs
  each), but each clause has a scenario.

| R | Scen. | Task | Note |
|---|---|---|---|
| R1 | 2 | 3.5 | |
| R2 | 5 | 2.2 | An empty directory left by removing an added file is not the start's tree (N11) |
| R3 | 4 | 1.1, 2.2 | Temp files left by a SIGKILL break "gone before the lock is" (N3) |
| R4 | 2 | 1.1, 1.2 | |
| R5 | 3 | 1.2, 2.1 | A blob over 1 MiB is refused for good (N2) |
| R6 | 7 | 1.2, 3.2 | The case-only scenario passes here and then fails R16 (B2) |
| R7 | 2 | 1.2, 2.1 | |
| R8 | 2 | 3.2 | A recorded TTY green plus a captured reverted run: the design's TTY trade-off is false on this path (N10) |
| R9 | 2 | 3.2 | Its blocked row has no restore, while R13 requires one (N11) |
| R10-R12 | 3, 1, 2 | 2.4, 3.2, 3.5 | |
| R13 | 3 | 3.1-3.3 | |
| R14 | 4 | 1.1, 3.2 | |
| R15 | 3 | 2.1 | |
| R16 | 3 | 2.3 | B2 |
| R17 | 2 | 2.4, 3.4 | |
| R18 | 4 | 2.3, 3.5 | The "half reverted" status-as-before scenario fails if the kill lands inside an entry (N3) |
| R19 | 1 | 2.3 | |
| R20 | 1 | 2.3, 3.3 | The `--soft` advice is wrong (N1) |
| R21 | 2 | 4.4 | |
| R22 | 4 | 4.3 | Offers `sh` (B1) |
| R23 | 6 | 3.1, 4.1 | Needs B3's fallback |
| R24 | 2 | 4.1 | A `lost` start after a squash merge is non-overridable (B3) |
| R25 | 4 | 4.2 | `forcedMarker` reproduces the three existing markers byte for byte, and none of the seven is a prefix of another (generated the seven from design.md's rule in a node one-liner: 0 prefix pairs) |
| R26-R28 | 1, 2, 2 | 1.2, 3.2, 3.5 | |
| R29 | 4 | 3.3 | N5 |
| R30 | 4 | 2.3 | B2; N8 |
| R31 | 2 | 2.1, 2.3, 3.5 | B1 |
| R32 | 2 | 3.3 | Name `git restore --staged` for an index change |
| R33 | 3 | 1.2 | N6 |
| R34 | 1 | 2.2, 3.2 | |
| R35 | 3 | 2.3, 3.4 | No group-SIGINT test at `lock-written` or `reverted:<n>` (N4) |
| R36-R43 | 1-4 | 2.1, 3.4, 3.5, 4.3, 4.4 | |

Executability: no TBD, no undefined names, and every path and command exists. The exception is
task 5.3 step 5 (B4 above). A SIGKILL test that kills mid-run and then restores exists at the CLI
level (3.5, `R18 kill -9 mid-run, then verify --restore`) and at module level (2.3). No step seam
falls between one entry's temp write and its rename, so N3 has no test.

