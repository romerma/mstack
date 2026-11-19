Sections moved unchanged from `.mstack/progress/spec_review_mutation-check.md` on 2026-11-19.

## Grill

### Hidden assumptions

1. **The only files that differ from the start are the item's committed code.** Untracked code
   files fall inside the spec's own definition of the revert set and inside the lock, and the
   restore removes them. See B2.
2. **Only the restore changes the tree while the lock exists.** The proof requires the whole
   tracked tree to equal the current HEAD. A commit, a `git add`, a snapshot the suite rewrites,
   or the user's own edit makes it fail for good. See B3.
3. **The CLI that recovers is not the CLI being reverted.** It is, in this repository, on the
   run task 5.3 plans for item 42. See B5.
4. **The size check's start is right for a revert.** `measureStart` documents that it counts
   merged default-branch commits when the base is a branch commit with the default branch merged
   in after it (`src/size.ts:66-68`). For the size check that over-count fails closed. For a
   revert it makes the revert wider than the item, and the wider revert can kill tests that are
   not the item's, which fails open. This repository records the base when the item enters
   `in_progress` (`src/cli.ts:700-707`), after the spec commits on the branch, which is that
   shape. (N7)
5. **A signal is handled by mstack alone.** A terminal Ctrl-C goes to the whole foreground
   group. In both runtimes it killed the synchronous child of a parent that ignored SIGINT
   (`sig-exp.sh`: `child FAILED ... signal=SIGINT`), and every `git()` call is such a child.
   (N1)
6. **One run gets to finish.** This repository's `npm test` took about 46 s on bun plus 24 s on
   node in recent reports (`impl_closing-row-cites-own-report.md:53,61`), before typecheck. Two
   runs (baseline plus the reverted run) pass the Bash tool's 120 s default. The 900 s
   `--timeout` default is above the tool's 600 s ceiling. How the harness kills a command at its
   timeout was not checked. (N13)
7. **An exit code answers the question.** Three cases undercut it.
   - Every item that adds a module and a test that imports it is killed by the import error,
     whatever its tests assert. That includes item 42's own receipt.
   - A shell exits 128+n when its child dies of a signal (`src/run.ts:47-53`). An OOM kill (137)
     therefore classifies as a failure and becomes a kill.
   - This repository has load-sensitive tests: `gate.test.ts:681` timed out 40 of 40 times under
     parallel load (`.mstack/progress/diagnosis_unidentified-flaky-test.md`).

   All three produce a `mutation-killed` that says nothing about the tests. The design accepts
   build failures as kills (design.md:205-208). It does not state the other two. (N8, N9)
8. **A recorded `gate --full` green is the same baseline.** That run inherits the terminal and
   has no timeout (`src/gate.ts:763`). The reverted run is captured to a file and timed. A suite
   that behaves differently without a TTY gives a false kill. (N10)

### Rejected alternatives

The rejections of stash, whole-tree reset, an in-memory list, a watchdog and per-file mutants
are real reasons. The scratch-worktree rejection (design.md:170-176) is right in its conclusion
and weak in its stated reason. Symlinking the ignored dependency directories into a worktree is
not "a second in-place edit": it never touches the user's source files. The stronger reasons
are in the same paragraph: a per-ecosystem list of what to link, and absolute paths in tool
caches. Lead with those. One alternative is missing: keep each new file as an empty stub instead
of deleting it. That is the one cheap way to stop "the suite imports a file the revert removed"
counting as a kill. It is deferrable, but it is the honest answer to assumption 7.

### Fail paths: the sequence, boundary by boundary

| Boundary | SIGKILL / power loss | SIGINT / SIGTERM | Another actor (2nd run, `--restore`, git, editor) | Gap |
|---|---|---|---|---|
| Preconditions, baseline (no lock) | Nothing reverted. The baseline obligation (its own process group) keeps running as an orphan. | R17: exit, nothing touched | A second run's baseline overlaps the first. The first can take the lock and revert while the second's baseline is still running. The second then records `passed`/`failed` at the `treeId` it samples afterwards, which can be `clean`. | N5 |
| Temp lock written, not linked | `<lock>.<pid>.tmp` is left behind. Nothing removes it. | default action | - | N16 |
| Lock linked, handlers not yet installed (design.md:124-125 installs them after `acquireLock`) | lock, nothing reverted: `--restore` recovers | **Default action: dies with the lock.** Recoverable, but it is the SIGKILL case without a SIGKILL. | refused (R7) | N2 |
| Reverting | Partial. The three states in `--restore` cover it. | The group Ctrl-C kills the in-flight `git restore` (N1). The handler runs after the synchronous revert. | A path that cannot be reverted is **unspecified**: the obligations then run on a partial revert. | N3 |
| Obligations running | The orphaned helper and obligation keep running on the reverted tree. `--restore` restores under them, and their later writes land after the proof. | async runner: kills the group, restores | `git commit -a` from another terminal: B3 (R20 cannot finish). `git stash` or `checkout .` from another terminal, an editor save, or Claude's Edit/Write (the PreToolUse matcher is `Bash` only, `hooks/hooks.json`): the tree changes under the run and **a row is still recorded**. `--restore --force` under a live run: the same. | B3, N4 |
| Restoring | lock: `--restore` recovers, idempotent | **R17 is not met:** a group Ctrl-C kills the `git restore` child (rung 4 with `sh -c sleep` standing in for git). R19 then keeps the lock. | A directory in the way is deleted by git with its untracked contents. | B4, N1 |
| Proof fails | - | - | **No terminal state.** | B3 |
| Proof passed, lock present | `--restore` passes the proof and removes the lock. No row. | - | - | fine |
| Lock removed, no row | No row. Fail-closed. | - | - | fine |
| Afterwards | - | - | Rescue copies sit in a fixed per-path location that nothing reports, and the next incident overwrites them. | B4 |

In this repository, during item 42's own run, the signal column is empty from "Reverting" on.
See B5.

## Completeness

Every acceptance bullet maps to requirements:

- A1 maps to R2-R14 and R26-R27.
- A2 maps to R15-R22.
- A3 maps to R22-R25.

Every requirement has at least one WHEN/THEN scenario and at least one task:

| R | Task | Named tests | Note |
|---|---|---|---|
| R1 | 3.1 | 2 | |
| R2 | 1.1 | 2 | Cannot be observed in 1.1 (N19). The index scenario is reached only through the R16 test. |
| R3 | 1.1 | 3 | Contradicted by Terms, R2 and R16 (B2) |
| R4 | 1.1 | 1 | "empty" defined twice (B2) |
| R5 | 1.1, 3.1 | 6 | |
| R6 | 1.1, 3.1 | 5 | HEAD-moved clause (N6), directory in the way (B4) |
| R7 | 2.2 | 1 | Two processes tested at module level only |
| R8 | 3.1 | 2 | |
| R9 | 3.1 | 1 | |
| R10 | 3.1 | 2 | |
| R11 | 3.1 | 1 | |
| R12 | 2.1, 3.1 | 2 | 128+n (N8) |
| R13 | 3.1 | 2 | Precedence against R17 (N18) |
| R14 | 1.1, 4.1 | 4 | Amendment (B1). "Does not move its own key" has no test (N14). |
| R15 | 2.2 | 2 | |
| R16 | 2.2 | 3 | Proof (B3) |
| R17 | 2.1, 3.1 | 3 + 4 async | Group signal (N1) |
| R18 | 2.2 | 7 | CLI contract untested (N19) |
| R19 | 2.2 | 1 | Scenario inconsistency (N18) |
| R20 | 2.2 | 1 | Unreachable under the proof (B3) |
| R21 | 4.2 | 6 | Misses not listed (N16) |
| R22 | 4.1 | 4 | |
| R23 | 4.1 | 5 | Add the test-edit case (B1) |
| R24 | 4.1 | 4 | |
| R25 | 4.1 | 4 | |
| R26 | 3.1 | 1 | |
| R27 | 3.1 | 2 | |

Executability:

- Every path, script and command the tasks name exists: `scripts/check-doc-links.mjs`,
  `tests/lock-holder.ts`, `tests/helpers.ts:29`, `docs/wiki/Gates-and-Hooks.md:83` and `:136`,
  and the `test` and `typecheck` scripts.
- The tasks lean on named sections of design.md. That is acceptable, because the implementer
  works from the spec directory (`agents/implementer.md:16-18`).
- No "TBD" and no undefined names.
- Failure and security paths: partly explicit (refusals, R19). The missing ones are in B2-B5,
  N3 and N16.
- Verification against the risk: one gap is that no CLI-level kill-then-restore test exists (N19).
- No approval boundary is crossed: the design row records the in-place decision and the absence
  of a migration.

No ledger row: `agents/spec-reviewer.md` asks for none, and the ledger's verdict words are code
verdicts (`./bin/mstack help`: live-verified | test-verified | type-check-only |
verifier-blocked | verifier-failed). None of them is a spec verdict.

