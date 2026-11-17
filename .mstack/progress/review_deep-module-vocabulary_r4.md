# Review - deep-module-vocabulary (item 57), round 4

**Verdict:** APPROVED

Reviewed at `d3122c26d7276035c8541fcfe4008ca84fa5dc1e` by an independent pass: I wrote none of the
product or the items and reviewed no earlier round. I did not reuse round 3's table. Every row
below comes from the code at the head, the real CLI (`./bin/mstack`, `mstack 0.2.1 at
/Users/romerma/Code/mstack`), or a probe script that imports the real `src/` modules, run on node
v26.13.1 and bun 1.3.11. Throwaway repositories and probes are under the session scratchpad, in
`review57r4/`. `impl_deep-module-vocabulary_r4.md` is cited only as the claim being checked.

No blocking findings. Every assertion in item 79 holds at the head. Every "today" count is what its
own command returns. No criterion of item 79 is already true. Items 76, 77, 78 and 80 are
byte-identical to round 3. Gate, lint, typecheck and the suite on both runtimes are green.

## Blocking findings

None.

## Non-blocking findings

1. **Criterion 3's paste of item 79 is stale in the committed reports.** `impl_deep-module-vocabulary_r3.md`
   pastes item 79 as it read before this round. 10 of its 13 lines still match. The title,
   the description and acceptance 2 do not. `impl_deep-module-vocabulary_r4.md` describes the edit
   in fragments and does not paste the item (0/13). I ran a verbatim line check of
   `./bin/mstack state show 79` against each report:

   ```
   item79.txt in impl_deep-module-vocabulary_r3.md: 10/13
      missing: title: Git is run outside git.ts, which calls itself the one place that does, and gate and statusline each ask
      missing: description: The header comment of src/git.ts says "The one place this repository shells out to git.", but led
      missing: - the workspace module answers branch state (no git, no commits, detached, on a branch) and head, and gate.ts
   item79.txt in impl_deep-module-vocabulary_r4.md: 0/13
   item79.txt in deepen_2026-11-17.md: 0/13
   item79.txt in review_deep-module-vocabulary_r3.md: 0/13
   ```

   This report pastes the current text verbatim (next section), so criterion 3 is evidenced at this
   head. If the paste should live in an implementer report, this sentence fixes it: "paste
   `./bin/mstack state show 79` into `impl_deep-module-vocabulary_r4.md`."

2. **The round 4 note leaves out one edit, and the commit message names a status change that did
   not happen.** The description's last sentence went from "Claims checked in
   .mstack/progress/impl_deep-module-vocabulary_r3.md." to "... impl_deep-module-vocabulary_r3.md
   and review_deep-module-vocabulary_r3.md." (`git diff c53df60..d3122c2 -- .mstack/state.json`).
   The note says it added only one sentence. The change is harmless. The commit subject says
   "move item 57 to reviewing", but item 57 was already `reviewing` at `c53df60` and its record is
   byte-identical (Probe A). Neither touches a claim about the code.

3. **Acceptance 1 moves `isDirty`'s git call, and no test exercises `worktree.ts`.** The criterion
   asks only for routing, and routing can keep the flags (row A1-isDirty). But `git()` returns
   `null` on failure, and `isDirty` maps failure to *dirty* (`src/worktree.ts:88-89`). A routing
   written as `(git(...) ?? "") !== ""` would map it to clean. A routing that dropped
   `--ignored=matching` would bring back the `.env` deletion. The suite would stay green either way:
   `rg -n "src/worktree|worktree\.ts|worktree prune|worktree list" tests` prints nothing. The item
   points at the comment above `isDirty`, which covers both points ("A worktree we cannot inspect
   counts as dirty", `src/worktree.ts:75-77`). A sentence that would make this explicit: "isDirty's
   call moves into the module with its arguments and its fail-as-dirty fallback unchanged, pinned
   first by a test with an ignored .env and an uninspectable path."

4. **Acceptance 3's prose is broader than its two measures.** "Found only in that module" would also
   cover `src/costs.ts:184` (`rev-parse --git-path mstack`, the fallback spawn) and the
   `rev-parse --git-dir` probes at `src/gate.ts:167,563`. Neither measure checks those. This is
   wording only: the measures it names are true today and discriminate.

5. **`run` gets a timeout only if the implementer chooses one.** The item says correctly that
   `worktree.ts run` passes no timeout (row D7). Routing `git worktree add` through `git()` as it
   stands would give it the 5 s limit. The item does not say which way to go, and that is a design
   choice for the implementer, not an error.

6. **Do not "fix" the `\^` in acceptance 3.** The brief paraphrases the command as
   `rg "^gitdir:" src`, which finds nothing (exit 1). The item's own `rg "\^gitdir:" src` escapes
   the caret, so it matches the regex literal `/^gitdir:\s*(.+)$/` in the source. The item's
   command is the right one.

The slug `workspace-facts` still fits the narrowed item.

## Item 79 as it reads at the head

`./bin/mstack state show 79`, verbatim:

```
id: 79
slug: workspace-facts
title: Git is run outside git.ts, which calls itself the one place that does, and gate and statusline each ask git for the branch on their own
status: pending
source: deepen playbook run, 2026-11-17, .mstack/progress/deepen_2026-11-17.md
description: The header comment of src/git.ts says "The one place this repository shells out to git.", but ledger.ts (isCommit, resolveSha) and worktree.ts (isDirty, run) call execFileSync("git") themselves. git() returns null on any failure and passes a 5 s timeout; worktree.ts run throws a UserError and passes no timeout. The same question gets separate answers: the branch is read with rev-parse --abbrev-ref HEAD in gate.ts checkWorkspace and in statusline.ts. On a detached head the gate prints "on branch HEAD" while the status line shows no branch. costs.ts marksDir and hooklog.ts gitCommonDir each walk up to .git and parse a gitdir: line by hand, and paths.ts asks git rev-parse --git-common-dir. Deepen into one module that answers workspace questions. Dirty state is not part of this item: worktree.ts isDirty passes --ignored=matching on purpose, and the comment above it says why. Claims checked in .mstack/progress/impl_deep-module-vocabulary_r3.md and review_deep-module-vocabulary_r3.md.
acceptance:
  - rg 'execFileSync\("git"' src finds exactly one call, inside the workspace module (five today: git.ts, ledger.ts twice and worktree.ts twice)
  - the workspace module answers branch state (no git, no commits, detached, on a branch) and head, and gate.ts and statusline.ts take those answers from it; on a detached head the gate no longer prints "on branch HEAD" (it does today)
  - the git directory and the common git directory are found only in that module: rg "\^gitdir:" src finds only that module (costs.ts and hooklog.ts today), and paths.ts no longer runs rev-parse --git-common-dir itself (twice today)
  - the four branch states and the git directory of a linked worktree are tested at the module's interface against temporary repositories
seams:
  - the workspace module
```

## Item 79, every assertion

Row ids: T is the title, D the description, A an acceptance criterion, S the seam. On an
acceptance row, "not yet true" means I ran its check at the head and it does not pass yet. `$M` is
`/Users/romerma/Code/mstack/bin/mstack`, run from a throwaway repository.

| # | Assertion | Command | Output | Verdict |
|---|---|---|---|---|
| T1 | "Git is run outside git.ts" | `rg 'execFileSync\("git"' src` | besides `src/git.ts`: `src/ledger.ts` twice, `src/worktree.ts` twice (A1-today) | T |
| T2 | "git.ts, which calls itself the one place that does" | `bat -pp -n src/git.ts` | `6  * The one place this repository shells out to git.` | T |
| T3 | "gate and statusline each ask git for the branch on their own" | `rg -n "abbrev-ref" src` | `src/statusline.ts:90:  const branch = git(store, ["rev-parse", "--abbrev-ref", "HEAD"]);` and `src/gate.ts:570:  const branch = git(store, ["rev-parse", "--abbrev-ref", "HEAD"]);`. No other site in `src` | T |
| D1 | the header comment of src/git.ts says "The one place this repository shells out to git." | as T2 | verbatim, period included | T |
| D2 | ledger.ts (isCommit, resolveSha) call execFileSync("git") themselves | `bat -pp -n -r 40:100 src/ledger.ts` | `55 function isCommit` then `57 execFileSync("git", ["cat-file", "-e", ...`; `79 export function resolveSha` then `82 ... execFileSync("git", ["rev-parse", "--verify", "--quiet", ...` | T |
| D3 | worktree.ts (isDirty, run) call execFileSync("git") themselves | `bat -pp -n -r 55:165 src/worktree.ts` | `79 function isDirty` then `81 execFileSync("git", ["status", "--porcelain", "--ignored=matching"], {`; `150 function run` then `152 return execFileSync("git", args, { cwd: store.root, encoding: "utf8" }).trim();` | T |
| D4 | git() returns null on any failure | `src/git.ts:73-74` `catch { return null; }`; `probe79.ts fail` calls the real `git()` with `rev-parse --verify --quiet no-such-ref` | `git() on failing command -> null` (node and bun) | T, rung 4 |
| D5 | git() passes a 5 s timeout | `src/git.ts:21` `const GIT_TIMEOUT_MS = 5_000;`, `:68` `timeout: GIT_TIMEOUT_MS`; `probe79.ts slow` with a `git` on PATH that sleeps 8 s | `git() with an 8 s git -> null after 5 s` (node and bun) | T, rung 4 |
| D6 | worktree.ts run throws a UserError | `src/worktree.ts:153-154`; `probe79.ts run` calls the real exported `remove()`, which calls `run` | `remove threw UserError instanceof UserError: true msg: git worktree remove /nonexistent/worktree failed after 0 s` | T, rung 4 |
| D7 | run passes no timeout | `src/worktree.ts:152` options are `{ cwd, encoding }` only; `probe79.ts run` with the 8 s git | `remove returned after 8 s` | T, rung 4 |
| D8 | "The same question gets separate answers" | D11 and D12, on the same detached HEAD | the gate says "on branch HEAD"; the status line shows no branch | T, rung 5 |
| D9 | the branch is read with rev-parse --abbrev-ref HEAD in gate.ts checkWorkspace | `bat -pp -n -r 550:600 src/gate.ts` | `562 function checkWorkspace(...)`, `570 const branch = git(store, ["rev-parse", "--abbrev-ref", "HEAD"]);` | T |
| D10 | ... and in statusline.ts | as T3 | `src/statusline.ts:90` | T |
| D11 | on a detached head the gate prints "on branch HEAD" | throwaway repository: `git init -b feat/x`, `$M setup`, two commits, `git checkout --detach HEAD~0`, `$M gate` | `branch: HEAD` ... `-- workspace` / `[ok]    on branch HEAD` / `[ok]    working tree is clean` / `PASSED - 0 failures, 0 warnings`. The item's quote, now without `[ok]`, is a literal substring of the line | T, rung 5 |
| D12 | while the status line shows no branch | `printf '{"cwd":"%s","model":{"display_name":"M"}}' "$PWD" \| NO_COLOR=1 $M statusline`, detached and then on `feat/x` | detached: `M · idle`; on the branch: `M · feat/x · idle`. `src/statusline.ts:91` drops `"HEAD"` | T, rung 5 |
| D13 | costs.ts marksDir walks up to .git and parses a gitdir: line by hand | `bat -pp -n -r 145:195 src/costs.ts` | `162 let dir = resolve(store.root);`, `163 for (; !overridden;) {`, `164 const dotGit = join(dir, ".git");`, `170 const m = /^gitdir:\s*(.+)$/m.exec(text);`, `180 const parent = dirname(dir);` | T |
| D14 | hooklog.ts gitCommonDir does the same | `bat -pp -n -r 95:140 src/hooklog.ts` | `112 function gitCommonDir(start: string)`, `114 for (;;) {`, `115 const dotGit = join(dir, ".git");`, `120 const m = /^gitdir:\s*(.+)$/m.exec(...)`, `130 const parent = dirname(dir);` | T |
| D15 | paths.ts asks git rev-parse --git-common-dir | `rg -n 'git-common-dir' src` | `src/paths.ts:187: ... ["rev-parse", "--git-common-dir", "HEAD:src"]`, `src/paths.ts:194: ... ["rev-parse", "--git-common-dir"]` (`:161` is a comment) | T |
| D16 | "Deepen into one module that answers workspace questions." | none: a prescription | - | n/a; agrees with S1 |
| D17 | "Dirty state is not part of this item" | `rg -n -i -o ".{0,60}dirty.{0,60}"` over the `state show 79` output | two hits: `(isDirty, run) call execFileSync("git")` and this sentence. Title and all four criteria have no dirty state | T (consistent) |
| D18 | worktree.ts isDirty passes --ignored=matching | `src/worktree.ts:81` | `execFileSync("git", ["status", "--porcelain", "--ignored=matching"], {` | T |
| D19 | "on purpose, and the comment above it says why" | `bat -pp -n -r 67:91 src/worktree.ts`; `dirty79.ts` on a repository whose only change is an ignored `.env` | `70 * \`--ignored\` is the load-bearing flag. \`git status --porcelain\` excludes` / `71 * everything in \`.gitignore\` by definition, so a worktree holding a \`.env\` and` / `72 * a \`build/\` reported clean and \`prune --yes\` deleted it.`; probe: isDirty's args `"!! .env"`, the gate's args `""` (direct git agrees: `[!! .env]`, `[]`) | T, rung 4 |
| D20 | "Claims checked in ... impl_deep-module-vocabulary_r3.md and review_deep-module-vocabulary_r3.md" | `rg -c "79\|workspace-facts"` on both | 32 and 16 | T as a pointer. D17 to D19 are new this round, and neither file checks them; they are checked here |
| A1 target | "rg 'execFileSync\(\"git\"' src finds exactly one call, inside the workspace module" | the command as given | 5 lines | not yet true |
| A1 today | "five today: git.ts, ledger.ts twice and worktree.ts twice" | `rg -c 'execFileSync\("git"' src` | `src/git.ts:1`, `src/ledger.ts:2`, `src/worktree.ts:2` | T |
| A1 isDirty | meeting A1 forces nothing on isDirty beyond routing | `dirty79.ts`: the real `git(storeAt(path), ["status", "--porcelain", "--ignored=matching"])`, as `paths.ts:187` already calls `git(storeAt(dir), ...)` | `-> "!! .env"`; on a missing path `-> null` | T: the arguments and the answer survive routing. `git()` already uses isDirty's 5 s timeout and ignores stderr (`worktree.ts:84-85`). Its extra env does not change the output. `null` must map to dirty (note 3). The item asks for no flag change |
| A2 target | the workspace module answers branch state and head, and gate.ts and statusline.ts take those answers from it | `fd -t f . src tests \| rg -i "workspace\|git"` | `src/git.ts` only; `gate.ts:563,570` and `statusline.ts:90` call `git()` themselves | not yet true |
| A2 today | "on a detached head the gate no longer prints "on branch HEAD" (it does today)" | as D11 | `[ok]    on branch HEAD` | T today, so not yet true |
| A2 states | the four states named are real and distinct | throwaway repositories, `$M gate \| rg -A3 -- "-- workspace"` | no git: `[warn]  not a git repository, skipping workspace checks`; no commits: `[warn]  git repository with no commits yet, skipping branch checks` (`git rev-parse --abbrev-ref HEAD`: exit 128); detached: `[ok]    on branch HEAD`; branch: `[ok]    on branch feat/x` | T; the gate tells three of the four apart today |
| A3 target | the git directory and the common git directory are found only in that module | - | two hand walks and paths.ts's spawn exist | not yet true |
| A3 today 1 | "rg "\^gitdir:" src finds only that module (costs.ts and hooklog.ts today)" | `rg "\^gitdir:" src`, as given | `src/hooklog.ts:        const m = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, "utf8"));` and `src/costs.ts:        const m = /^gitdir:\s*(.+)$/m.exec(text);` | T |
| A3 today 2 | "paths.ts no longer runs rev-parse --git-common-dir itself (twice today)" | as D15 | two call sites, `:187` and `:194` | T |
| A4 | the four branch states and the git directory of a linked worktree are tested at the module's interface against temporary repositories | `fd` as in A2; `rg -ln "detached" tests src` | no module. The only test hit, `tests/run.test.ts`, is about process groups (`spawn(..., { detached: true, ...`) | not yet true |
| S1 | "the workspace module" | read against D16 and A1 to A4 | the same name in A1 and A2, "that module" in A3, "the module's interface" in A4 | T (consistent) |

34 rows: 29 true, 1 n/a (D16), and the four target rows (A1, A2, A3 and A4 targets) not yet true, which is what keeps each criterion able to discriminate.

### After the dirty state was dropped

- **Title, description, acceptance and seam agree.** The title names git run outside git.ts and the
  branch read twice. The description backs both and adds the git-dir walks. A1 measures the first,
  A2 the second, A3 the third, A4 tests the module, and S1 names it.
- **Nothing still implies that the two dirty checks should merge.** The only dirty mentions are
  `isDirty` in the list of direct `execFileSync` callers, which is about routing, and the exclusion
  sentence (D17). A2 lists no dirty answer and drops `worktree.ts` from the consumers. The gate's own
  `status --porcelain` at `src/gate.ts:581` goes through `git()`, so A1 does not touch it.
- **A1 forces only routing on `isDirty`** (row A1 isDirty). Note 3 covers the risk that routing
  carries without a test.
- **The candidate still stands on three things.**
  - Three files hold their own `execFileSync("git")` with diverging hardening. `ledger.ts:57-61,82-87`
    set a timeout but not `git.ts:70`'s `GIT_TERMINAL_PROMPT`/`GIT_OPTIONAL_LOCKS` env, and
    `worktree.ts:152` sets neither.
  - One branch read gives two answers on a detached head, and that disagreement is user-visible
    (rung 5).
  - Git-dir discovery is written by hand twice, beside paths.ts's spawn.

  The deletion test passes. Without the module, the timeout and env policy, the failure semantics
  and the reading of branch state go back into at least four callers.

## Probe A: the change is what it says

```
$ git log --oneline c53df60..d3122c2
d3122c2 chore: narrow item 79 and move item 57 to reviewing for round 4
$ git diff --stat c53df60..d3122c2 -- . ':!.mstack'
(empty)
$ git diff --stat c6041be..d3122c2 -- . ':!.mstack'
(empty)
$ git diff --stat c53df60..d3122c2 -- .mstack
 .mstack/decisions.tsv                              |   1 +
 .mstack/ledger.tsv                                 |   1 +
 .mstack/progress/impl_deep-module-vocabulary_r4.md |  18 ++
 .../progress/review_deep-module-vocabulary_r3.md   | 299 +++++++++++++++++++++
 .mstack/state.json                                 |   6 +-
```

`git diff c53df60..d3122c2 -- .mstack/state.json` is one hunk that changes item 79's `title`,
`acceptance[1]` and `description`, three lines each way. No other item and no top-level field
changed. Per-item sha256 of `JSON.stringify(item)`, via `git show <rev>:.mstack/state.json`:

```
== c53df60                     == d3122c2
57 reviewing 2c5879657a073417  57 reviewing 2c5879657a073417
76 pending 4409e34699b2feb9    76 pending 4409e34699b2feb9
77 pending 2bc8ef8d3d805a78    77 pending 2bc8ef8d3d805a78
78 pending ee83f2370caeffea    78 pending ee83f2370caeffea
79 pending 8f3351d4d3a3d5c7    79 pending a64b2d370c803afd
80 pending eac8716815589129    80 pending eac8716815589129
```

Items 76, 77, 78 and 80 are byte-identical. Item 57 did not change: it was already `reviewing` at
`c53df60` (note 2). The other `.mstack` lines are the `review-r4` decision row, round 3's
`verifier-failed` ledger row at `c53df60`, the round 3 review file and the round 4 note.

## Probe C: for the record

```
$ ./bin/mstack gate
...
-- workspace
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[ok]    on branch feat/deep-module-vocabulary
[ok]    working tree is clean

PASSED - 0 failures, 0 warnings          (exit 0)

$ ./bin/mstack lint-plugin .
...
[ok]    23 reference file(s), every relative link resolves
[ok]    19 skills and agents, every cross-reference in 42 file(s) resolves
[ok]    the lifecycle enum appears only in src/lifecycle.ts
[ok]    4 origin header(s), each naming a licence file that ships
[ok]    the router's orient steps link references/intake.md

PASSED - 0 failures, 0 warnings          (exit 0)

$ npm test                               (exit 0, run once)
 592 pass
 0 fail
Ran 592 tests across 27 files. [103.28s]
> mstack@0.2.1 test:node
ℹ tests 592
ℹ pass 592
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 29792.0545

$ npm run typecheck
> bunx --bun tsc --noEmit                (exit 0, no output)
```

The load-sensitive tests from item 67 passed on the first run, so I did not rerun anything.
`git status --short` was empty after the suite.

`./bin/mstack ledger check deep-module-vocabulary d3122c2...` before my row:
`FAIL no verdict at d3122c26; 6 row(s) exist at other SHAs and a new head SHA voids them`.

What I did not run:
- `gate --full`. It writes `.mstack/verification.tsv`, and this brief forbids every write to the
  store except my ledger row. `npm test` and typecheck stand in for it.
- The headless `/mstack review the architecture` run for criterion 2 (see the table below).

## Item 57, per criterion

| Criterion | Verdict | Evidence | Rung |
|---|---|---|---|
| "the design skill references the vendored vocabulary, and the reviewer has it as a lens, with origin headers" | Met, carried over | Verified by round 1 (`review_deep-module-vocabulary.md`, Per criterion: the lens live, the headers by lint and test) and round 2 (`review_deep-module-vocabulary_r2.md`, Per criterion: met, not undone, at `c6041be`). I confirmed that the product files are unchanged since then: `git diff c6041be..d3122c2 -- . ':!.mstack'` is empty. At the head, `lint-plugin` prints `4 origin header(s), each naming a licence file that ships` and every cross-reference resolves | 2 for "unchanged" (the empty diff); 4 for the lint run and the suite at the head; round 1's live lens run (5) was not repeated |
| "a request such as '/mstack review the architecture' routes to a playbook that ends with candidates filed as pending items, each naming files, the deepening and its test surface, and asks the user nothing" | Met, carried over | Round 2 ran it headless twice at `c6041be` (`review_deep-module-vocabulary_r2.md`, Per criterion, rung 5). I confirmed that the router and `deepen.md` are unchanged (the same empty diff) | 2 here (unchanged files); round 2 reached 5 |
| "that playbook run on this repository files its candidates, pasted in the report" | **Met** | *Filed:* items 76 to 80 are pending, with source `deepen playbook run, 2026-11-17`. *Pasted:* 76, 77, 78 and 80 match verbatim in `impl_deep-module-vocabulary_r3.md` (13/13, 13/13, 12/12, 12/12; they are byte-identical to round 3). Item 79 as it now reads is pasted verbatim in this report (note 1). *True:* every assertion in item 79 holds (the table above). Round 3 found 76, 77, 78 and 80 sound, and their bytes have not changed | 5 for item 79's behaviour rows (real CLI, throwaway repositories); 4 for its counts and for the probes that call the real `git()` and `remove()` |

Ledger: `test-verified`. My own runs reached rung 5 for item 79's behaviour claims. But the item as
a whole rests in part on criterion 2's headless routing run, which I did not repeat, and on rung 4
for the suite, the lint and the counts. So I record rung 4, not 5.
