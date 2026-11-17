# Explore: checks, hooks and git surface

Vocabulary from skills/design/references/deep-modules.md. Read-only on code. All paths relative to the repo root.

## Findings

### 1. "The repository's state" is a fact nobody owns: git is asked ~25 times from 9 call sites, in two incompatible ways

Evidence (every git question in src/, excluding tests):
- Through `git()` (src/git.ts:61, timeout, env hardening, null on failure): gate.ts:166,167,563,570,581; statusline.ts:90,134; worktree.ts:26,31,117(x2); verification.ts:206,218,232,249; git.ts:79,83,86; costs.ts:184; paths.ts:187,194.
- Past it, with their own `execFileSync("git")`: worktree.ts:81 (`isDirty`, own 5_000 timeout, own stdio), worktree.ts:152 (`run`, no timeout, no env hardening, throws instead of null), ledger.ts:57,82.
- git.ts:6-13 states "The one place this repository shells out to git" and gives the reason (no second timeout/env copy). That claim is false: worktree.ts and ledger.ts hold exactly the duplicates it warns about. `worktree.ts:81` repeats the 5s constant as a literal (`GIT_TIMEOUT_MS` is unexported, git.ts:15).
- "Which branch / is the tree clean / what is HEAD" is derived separately by gate `checkWorkspace` (gate.ts:562-590: git-dir, abbrev-ref, defaultBranch, status --porcelain), statusline `render` (statusline.ts:90, 134: abbrev-ref, rev-parse HEAD), and worktree `list` (worktree.ts:25-60: its own porcelain parse plus `isDirty` with different semantics, `--ignored=matching`). `headSha` has exactly 3 callers in my area (gate.ts:608,675; closing.ts:50,101; cli.ts:831) while statusline.ts:134 and gate.ts:570 hand-write the same `rev-parse` strings; so even the one helper that exists is bypassed by its own neighbours.
- "No git / no commits / detached HEAD" are three states; gate distinguishes two (gate.ts:563 vs 570, comment 566-569 says conflating them was a bug), statusline folds them (statusline.ts:91 `branch !== "HEAD"`), verification collapses to the string `unknown` (verification.ts, `UNKNOWN_TREE`, consumed gate.ts:640). Three encodings of one fact.

Interface cost: `git(store, args, {raw, stdin})` is a shallow module: its interface is "git's whole CLI plus null-on-failure", and each caller must know which args and what null means. The 40-line comment on `raw` (git.ts:22-48) documents an option that, by its own admission, "No current behaviour distinguishes" (git.ts:33-36); the interface carries a parameter nothing needs.

Deepening: a workspace module that answers the questions (branch state, head, dirty, tree identity, default branch) and owns every git invocation including worktree and ledger's. Dependency category: local-substitutable (git on a temp dir is the stand-in), so the seam stays internal and tests run real git there once, not in every consumer's test.

### 2. "Is this item ready to close / what is its verdict" is re-derived in five places across four modules

- Active item: `state.items.find(isActive)` is written out at gate.ts:222,602,659; statusline.ts:103,328; hooks.ts:109; costs.ts:319; cli.ts:410,1009; and `activeItem(store)` (state.ts:354) is a sixth variant that swallows parse errors, used by fanout.ts:67 and statusline.ts:360. hooks.ts:100-110 comments that `activeItem` "answers none for an unreadable state.json ... a false one", then writes its own copy to log the failure. 9 inline copies + 1 helper with a different error contract.
- Verdict at a commit: closing.ts:100-110 (`ledgerEntries` filter, `headSha`, `sameCommit`, `readVerdict` at HEAD then across all shas), ledger.ts `check` (ledger.ts:286-296, same filter/readVerdict), gate.ts:375-440 `checkClosedItems` (a third `ledgerEntries(...).filter(target)` plus its own switch over `reading.kind`, gate.ts:421-440), statusline.ts:134-175 (calls `check` then re-switches on `result.kind`/`best`/`stale` to render), mergegate.ts:165 (calls `check` with a PR sha). Five consumers, each interpreting the `Reading` kinds (`author-only`, `discounted`, `rejected`, `passing`) into prose. A new kind means editing gate, statusline and closing together; gate.ts:395-405 and statusline.ts:150-157 both carry comments saying they "share the reader so they cannot disagree", which is the symptom: agreement is maintained by comment, and what is shared is the reader, not the interpretation.
- Closing readiness: `gateProblems` (closing.ts:155) is the right shape, a deep module called from `state set --status done` and the gate. But `checkVerificationRuns` (gate.ts:598-656) still re-derives `obligations` (gate.ts:607, again at 660 and inside closing.ts:49, verification.ts:391), `headSha` (608 and closing.ts:50), and computes `treeId` itself to hand it down (gate.ts:611, closing.ts `tree?` parameter). The caller threads an expensive fact through the module's interface to avoid computing it twice, i.e. the interface leaks a performance concern (see the `tree` param in closing.ts:155 and the comment gate.ts:609-610). To read "is this item ready to close" you open gate.ts, closing.ts, verification.ts, ledger.ts, lifecycle.ts, state.ts: 6 files.

Deepening: one "item readiness" module returning a structured reading (item, head, tree, verdict kind, obligations met) that gate, statusline, closing, hooks session-start and mergegate render from. In-process category (pure over ledger rows, receipts and a head/tree value passed in); the head/tree comes from finding 1's module.

### 3. verification.ts mixes a filesystem fingerprint with a receipt ledger; gate.ts is 726 lines of unrelated checks

- verification.ts holds `treeId` (verification.ts:201, 100+ lines of git and symlink/FIFO handling, lines 130-310) and the receipt store (`record` 312, `receipts` 325, `status` 384, `why` 415). Callers need the second; the first is an implementation detail of "does this receipt still describe the workspace". `treeId` is exported only so gate.ts:611,708 and tests/helpers.ts can pass it back into `record`/`status` (verification.ts:389 defaults it, so the parameter exists for the gate's performance, finding 2).
- gate.ts: `runGate` (gate.ts:66-93) is a good deep entry point (one call, a `Report`). But behind it are 14 `check*` functions, several unrelated to each other (provenance 521, hook errors 133, receipt gitignore 161, spec artifacts 335, closed-item audit 375), all with signature `(store, state?, report)`. The `Report` object is the seam and it is real: gate.ts, lint.ts, fanout.ts:114 all produce one. Not shallow, but the file is a list, and its tests (tests/gate.test.ts, ~94 sandbox/commit/git-state hits) enter only through `runGate`, which is correct for locality.
- worktree.ts `list` -> `isDirty` (worktree.ts:79) -> `prunable` (131) -> cli.ts:977: dirty means different things in `checkWorkspace` (`status --porcelain`, gate.ts:581, "expected mid-session") and `isDirty` (`--ignored=matching`, worktree.ts:81, "would not survive removal"). Two meanings of "workspace is clean", named the same, in two modules that cannot see each other.

Deepening: split off treeId behind "does this receipt still describe the tree", so callers stop holding a tree id. In-process once git comes from finding 1; local-substitutable for the filesystem part.

### 4. Pass-throughs and zero-caller modules (deletion test)

- src/pathclass.ts (47 lines, `classifyPath`, `matchesGlob`, `TEST_PATTERNS`): no importer in src/ (grep over src finds none; only tests/pathclass.test.ts and .mstack progress notes mention it). Deletion test: complexity vanishes, along with its test file. A leaf with zero callers is dead code or a seam waiting for a caller; one adapter is a hypothetical seam, zero is none. Candidate to delete or to wire into its intended consumer.
- `headSha` (git.ts:78-80): one-line wrapper over `git(store, ["rev-parse","HEAD"])`. Interface as complex as the implementation. Deletion test: the string reappears at 3 call sites that already write it by hand (statusline.ts:134, gate.ts:570-style). It would earn its keep only if the "no commits" vs "no git" distinction were behind it (finding 1); today it is a pass-through.
- mergegate.ts `fetchPr` (mergegate.ts:80-95): wraps `gh pr view` with an error message. One adapter (`execFileSync("gh")`, hard-coded at 83), no injected port; `evaluate` (109) is separated from it and takes a `PullRequest` value, so tests (tests/mergegate.test.ts, 3 git/sandbox hits) cross the seam correctly by constructing the value. That seam is real in practice (production gh, test literal), but it is a function parameter, not a declared port. True-external dependency; fine as is.
- hooks.ts `postEdit` (hooks.ts:159-180): two special-cased paths, each a one-line parse or message; shallow in isolation, but the hook surface forces one function per event (`HOOK_COMMANDS`, hooklog.ts:29; hooks.json). The shell-command policy part (hooks.ts:320-460, `shellSegments`, the `GIT` regex at 359) is the deep part.
- hooks.ts and statusline.ts each open with `findStore(input.cwd ?? process.cwd())` (hooks.ts:92,162,195,280,305; statusline.ts:63 area): 5 + 2 call sites, then `parseState` (hooks.ts:109,167; statusline.ts:92,328) with differing failure handling (log, message, swallow). "Open the store, tolerate it being broken, say so once" is repeated 7+ times. Deepening: an entry that returns the store and its state or a typed failure, in-process category.

### 5. Tests forced past the interface

- Real git repos for everything: `sandbox()` (tests/helpers.ts:29-60) runs `git init`, config, commit for each test; `quiesce` (helpers.ts:110-117) checkouts and commits. Counts of sandbox/commit/git setup hits: gate.test.ts 94, statusline.test.ts 42, hooks.test.ts 12, mergegate.test.ts 3, fanout.test.ts 2. statusline tests need a real repo only to get a sha and branch name that `render` fetches through `git()` (statusline.ts:90,134) because `render(input, options)` has no way to be handed them. Given finding 1, this is local-substitutable and real git is acceptable, but `render` mixes git lookup with formatting, so the 42 tests exercise pure string formatting through process-level git state.
- Tests bypass the CLI/hook interface with raw git and file pokes: tests/gate.test.ts:33 (`git status --porcelain` re-implemented in the test to assert the gate did not dirty the tree), verification.test.ts:3,436,493,509 (own `execFileSync("git")`, `mkfifo`, nested repos), statusline.test.ts:98 (`sh -c printf '{' > state.json` to corrupt state).
- tests/provenance.test.ts: 24 `git worktree` calls, 4 in hook-errors.test.ts; they spawn the real `bin/mstack` (provenance.test.ts:25,307) because `checkCliProvenance(store, report, running)` (gate.ts:521) takes `running` as an injectable parameter yet the file also does full clones (provenance.test.ts:206). Heavy but justified: the thing under test is the git topology.
- hook-errors.test.ts spawns the real binary via `spawnSync` (hook-errors.test.ts:44) and `chmod 555` the store (391,632): it reaches past `hooks.ts` functions into process behaviour because the fail-open policy lives in cli.ts `cmdHook`, outside my area (cli.ts:1114), not in `hooks.ts`. The policy (catch everything, exit 0, log) is split between cli.ts and hooklog.ts and hooks.ts, so its tests can only reach it at the outermost seam.
- The test for ordering in `runVerification` (gate.ts:693-708 comment: "pins it with a verification that really does write into the repository") is a good test through the interface. Keep.
- lint.ts (624 lines, tests/lint.test.ts copies the plugin tree with `cpSync`, lint.test.ts:3,15): `lintPlugin(root)` is a deep, single-entry module over a directory; copying a tree is the stand-in, correctly local-substitutable.

## Earns its keep

- `runGate(store, options)` (gate.ts:66): one call, one `Report`; behind it ordering of sections, `--full`, quiet mode. Deletion: hooks.ts `gateFeedback` (hooks.ts:288), cli and tests would each reassemble it.
- `Report` (report.ts, used by gate, lint, fanout): the seam with two real adapters in production (loud and quiet, plus a structured read for tests via `expectFail`/`expectPass` in tests/helpers.ts). Not mine to analyse deeply.
- `gateProblems` (closing.ts:155): one list of closing problems consumed by `state set --status done` and the gate; the comment gate.ts:612-616 records a bug it prevented. Deepen around it (finding 2), do not remove it.
- `treeId` (verification.ts:201): shallow-looking (string out), but behind it sits symlink/FIFO/untracked/diff handling; deletion spreads that over gate and tests. Its interface is small, its implementation large.
- `lintPlugin` (lint.ts:101): single entry, 20 internal checks; deletion would put them in CI scripts.
- `shellSegments` and the GIT pattern (hooks.ts:359-461): the policy for destructive-command matching is hard, specific and used by one hook; deep.
- `pathclass.matchesGlob`'s hand-written glob (pathclass.ts:20-35): replaces an experimental node API for one reason it documents (pathclass.ts:3-5). Earns its keep only if a caller exists (finding 4).
- `fanout.plan`/`check` (fanout.ts:58,114): deep enough: report allocation, reserved names, concurrency cap behind two functions; tests call both directly (tests/fanout.test.ts:6).
- `worktree.isDirty`'s `--ignored=matching` (worktree.ts:70-90): the extra flag is a deliberate data-safety difference from `checkWorkspace`; the semantic difference must stay, only the invocation should merge (finding 1).
- `evaluate` vs `fetchPr` split (mergegate.ts:80,109): a pure decision function with a test-supplied value is the cheap seam.

## Open questions

1. pathclass.ts has no importer in src/. Is the consumer still planned (e.g. a test-first or review check), or should it go? Grep only covered src/, tests and .mstack; I did not check skills/ markdown or bin/.
2. Does the fail-open policy for hooks belong in hooks.ts (a `runHook` wrapper) so hook-errors.test.ts can test it without spawning the binary? It is in cli.ts:1100-1120, outside my area, so I could not judge cost.
3. Is "dirty" intentionally two concepts (gate's mid-session warning vs worktree's data-loss test)? If so they want two names, not one module.
4. `GitOptions.raw` is admitted unneeded (git.ts:33-36). Remove, or keep for the stated bug class? Removal changes no behaviour per the comment's own mutant measurement.
5. Counts for `ledger.ts` and `paths.ts` git calls come from grep only; those modules were not analysed.
