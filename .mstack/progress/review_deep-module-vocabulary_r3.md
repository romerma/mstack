# Review - deep-module-vocabulary (item 57), round 3

**Verdict:** CHANGES_REQUESTED

Reviewed at `c53df60ec8b2bcf1fe7675778150c97da5c65c34` by an independent pass: I wrote none of the
product or the items and reviewed no earlier round. Every row below was derived from the code or
the real CLI (`./bin/mstack`, `mstack 0.2.1 at /Users/romerma/Code/mstack`). Throwaway stores are
under the session scratchpad in `review57r3/`. I did not read `impl_deep-module-vocabulary_r3.md`'s
tables or scripts, and none of them is cited as evidence. I used the report for one thing only: to
check that it pastes the current text of items 76 to 80 (criterion 3).

Of the 78 rows in the five claim tables, 76 hold. The two that fail are both in item 79 and are
one error, the same kind round 3's own decision row cut from item 77: the item calls two checks
that differ on purpose one question answered twice.

## Changes required

1. **Item 79 `workspace-facts`, description: "The same question gets separate answers: ... and
   dirty is git status --porcelain in checkWorkspace and git status --porcelain
   --ignored=matching in worktree.ts isDirty."** Both commands are quoted correctly, but they do not
   answer the same question, and the code says so. `src/worktree.ts:67-78`, above `isDirty`:

   ```
   * Anything here that would not survive `git worktree remove`.
   *
   * `--ignored` is the load-bearing flag. `git status --porcelain` excludes
   * everything in `.gitignore` by definition, so a worktree holding a `.env` and
   * a `build/` reported clean and `prune --yes` deleted it.
   ```

   The gate's check (`src/gate.ts:581-584`) asks about uncommitted work in the store root ("N
   uncommitted change(s); expected mid-session, not at close"). `isDirty` asks whether removing
   *another* worktree (`cwd: path`, `worktree.ts:82`) would lose files. Live, on one worktree
   holding an ignored `.env` (`review57r3/r79d-wt-x`):

   ```
   --- in the worktree, gate workspace:
   [ok]    working tree is clean
   --- git status --porcelain:
   (end)
   --- git status --porcelain --ignored=matching:
   !! .env
   --- worktree list from main:
   12bad230  feat/x                             merged,dirty   .../review57r3/r79d-wt-x
   ```

   Acceptance 2 carries the same premise: "the workspace module answers ... head and dirty, and
   gate.ts, statusline.ts and worktree.ts take those answers from it". Read as one `dirty` answer,
   it either brings back the prune that deleted a `.env` or makes the gate warn on every ignored
   file. No test would catch the first: `rg -n 'isDirty|prunable|"prune"|from "\.\./src/worktree' tests`
   finds nothing, so nothing tests `worktree list` or `prune`.

   **Fix, one sentence each.** In the description, replace the dirty clause with "dirty is asked
   two ways on purpose: git status --porcelain in checkWorkspace for uncommitted work, and
   --ignored=matching in worktree.ts isDirty, because a worktree remove also loses ignored files".
   In acceptance 2, replace "head and dirty" with "head, and dirty with and without ignored files".
   Alternatively, drop dirty from the item, following round 3's "state fewer things". The branch
   half of the same sentence is true and stays: both sites ask the same question and answer it
   differently on a detached head (item 79 table, row D7).

## Non-blocking findings

- **Item 76, "no test imports cli.ts".** `tests/closing.test.ts:93` writes a boot module containing
  `await import(${JSON.stringify(join(root, "cli.ts"))});` and runs it in a spawned child
  (`cliWithSecondCheck`). The conclusion stands, since that is still a spawned CLI and no test
  imports cli.ts into its own process (importing it runs `main`, `cli.ts:1238-1249`). More precise
  wording: "no test imports cli.ts into its own process".
- **Item 76, `--force`.** The description mentions `--force` only for the close. The fork refusal
  (`cli.ts:575`) and the transition refusal (`cli.ts:582`) are also skipped by `--force`. This is
  an omission, not a false statement.
- **Item 76 and item 71.** Item 71's acceptance 4 ("state set --status done refuses author-only
  and discounted ledgers with the reason the gate gives") is a second split between `state set`
  and the gate on the same `cmdState` path. The two items do not duplicate each other, but 76
  could name 71 as adjacent, the way 77 names 69 and 78 names 66 and 68.
- **Item 77 slug.** `item-readiness-reading` no longer fits a title about the active item. Slugs
  cannot be renamed (`cli.ts:497-502`), so this is noted only.
- **Item 78 scope.** Acceptance 2 puts the only `renameSync` "in that module", which is named the
  store-file module. Two of today's three rewrites are not of store files. `costs.ts prune` rewrites
  the marks file (its caller passes `file`, the marks path, `costs.ts:375`; `marksDir` is under
  `.git/mstack`). `hooklog.ts trim` rewrites `.mstack/hook-errors.log`. The criterion can be met,
  but the module's name is narrower than what it would own.
- **Item 79, quoted gate line.** The description quotes `"[ok] on branch HEAD"`. The gate prints
  `[ok]    on branch HEAD` with four spaces (`src/report.ts:40`). Only the whitespace differs.
  Acceptance 2 quotes `"on branch HEAD"`, which is verbatim.
- **Item 80, costs.** "writes its columns out four times" holds for ledger, decisions and
  verification, which spell every column in each of the four places. costs.ts spells some columns
  only in some places. `NewRow` (`costs.ts:643-653`) leaves out `ts`, as the item says, but it also
  carries the four token columns as one `usage` object and names `cost_usd` as `cost`.
  `summarize` (`costs.ts:877-893`) reads 9 of the 13 columns (not `ts`, `run`, `agent_id` or
  `source`). Nothing stated is false.

## The five claim tables

Rows: T is the title, D the description, A an acceptance criterion, S a seam. For each acceptance
row, "not yet true" means I ran its check at the head and it does not pass yet, so the criterion
can still tell before from after. Every `rg` was run from the repository root exactly as the item
spells it. Throwaway stores were made with `git init` plus `./bin/mstack setup`.

### Item 76 `item-transition-module`

| # | Assertion | Command | Output (trimmed) | Verdict |
|---|---|---|---|---|
| T1 | the transition rules "are composed inside cmdState in cli.ts, which tests can reach only by spawning the CLI" | D1, D12 | see D1, D12 | T |
| D1 | "state set --status is handled inline in cmdState (src/cli.ts)" | `rg -n '^(async )?function \w+' src/cli.ts` | `379:function cmdState`, next `794:function cmdLedger`; the status move is at 565-642 | T |
| D2 | refuses a move to a requiresDecision status while the fork is unanswered | read `cli.ts:571-581`; live in `r76` (`forky2`, empty `decision_resolved`, specifying -> spec_ready) | `mstack: forky2 has an unanswered decision: "C or D?"` exit 2 | T |
| D3 | "refuses a move canTransition rejects" | `cli.ts:582-587`; live `state set forky --status done` from in_progress | `mstack: in_progress -> done is not a legal transition` exit 2 | T |
| D4 | refuses a close closingProblems objects to, lets `--force` past an overridable one only with `--closed-by` | `cli.ts:595-638`; live in `r76f` (verification `false`, never run) | `fc cannot close on a verification that has not run`; `--force would close fc ... has to be on the record`; with `--closed-by`: `status: "verifying" -> "done"` | T |
| D5 | writes the FORCED_UNVERIFIED marker into closed_by and keeps it on a later `--closed-by` | `cli.ts:665-666, 681-684`; live `state set fc --closed-by "second reason"` | `closed unverified (forced): first reason`, then `closed unverified (forced): second reason` | T |
| D6 | lifecycle.ts holds the status lists, TRANSITIONS and six predicates, none taking an item | `bat -pp src/lifecycle.ts` | lists STATUSES, ACTIVE_STATUSES, SPEC_REQUIRED_FROM, DECISION_REQUIRED_FROM, VERIFICATION_REQUIRED_FROM, TERMINAL_STATUSES; predicates isStatus(value), isActive(status), requiresSpecArtifacts(status), requiresDecision(status), requiresVerification(status), canTransition(from, to) | T |
| D7 | "in src, cmdState is the only caller of canTransition" | `rg -n canTransition src` | `cli.ts:16` import, `cli.ts:582` call, `lifecycle.ts:83` comment, `:117` definition | T |
| D8 | "cmdState treats any non-empty decision_resolved as answered" | `cli.ts:574`; live in `r76`: `decision_resolved` set to `2026-01-01T00:00:00.000Z`, decisions.tsv header only, `state set forky --status in_progress` | `status: "pending" -> "in_progress"` exit=0 | T |
| D9 | the gate's checkOpenDecisions "also requires a decisions.tsv row with that timestamp that resolves the item" | `gate.ts:309-311`; `./bin/mstack gate` on the same store | `[fail]  1 forky (in_progress) points at decision 2026-01-01T00:00:00.000Z, and no row with that timestamp resolves forky` exit=1 | T |
| D10 | "cli.ts exports only FORCED_UNVERIFIED" | `rg -n '^\s*export\b' src/cli.ts` | `223:export const FORCED_UNVERIFIED = ...` only | T |
| D11 | "no test imports cli.ts" | `rg -n 'cli\.ts' tests` | `closing.test.ts:93` imports it inside a boot module that `spawnSync` runs (`:100`); `state-cli.test.ts:11` spawns it; nothing imports it in-process | T (note) |
| D12 | tests/cli, closing and decisions .test.ts "assert these refusals on the stderr of a spawned CLI" | A4's search, then each helper | cli.test.ts `run` = `spawnSync(BIN)` (`:24-29`); closing.test.ts `cli`/`cliWithSecondCheck` = `spawnSync` (`:15-17`, `:100`); decisions.test.ts `mstack` = `execFileSync(MSTACK)` (`:16-18`) | T |
| A1 | `rg "canTransition\(\|closingProblems\(" src/cli.ts` "finds one call of each today" | exact | 2 lines: `cli.ts:582` canTransition, `:596` closingProblems | T, not yet true |
| A2 | a decision_resolved no row resolves: "state set accepts it today and the gate refuses it" | D8, D9 | exit 0 / `[fail] ... no row with that timestamp resolves forky` | T, not yet true |
| A3 | `rg FORCED_UNVERIFIED src/cli.ts` "(four lines today)" | exact, and `-c` | `4` (lines 223, 634, 666, 682); no transition module exists to test | T, not yet true |
| A4 | the matches of `rg "stderr.*(not a legal transition\|unanswered decision\|cannot close)" tests` get an in-process test at the module | exact, `-c` | `cli.test.ts:2`, `closing.test.ts:5`, `decisions.test.ts:3`, only those three files; all spawned (D12) | T, not yet true |
| S1 | "the transition module's apply function" | matches A1's "operation that applies a status change" | - | T |

The candidate still stands. Four refusals and the marker are written inline in the 415-line
`cmdState` (379-793). The fork rule gives a different answer in two places, live (D8, D9). The only
way a test reaches the composition is through a process.

### Item 77 `item-readiness-reading`

| # | Assertion | Command | Output (trimmed) | Verdict |
|---|---|---|---|---|
| T1 | "searched for at nine sites beside activeItem, and commands answer differently when two items are active or state.json cannot be parsed" | D2, D4-D7 | see those rows | T |
| D1 | activeItem returns the first item with an active status, and undefined when state.json cannot be parsed | `rg -n -A14 'export function activeItem' src/state.ts` | `354-360`: `parseState(...).items.find(isActive)` in a `try`, `catch { return undefined; }` | T |
| D2 | nine other sites: hooks.ts activeItemOrLog, statusline.ts twice, cli.ts (state active, cmdMergeGate), costs.ts activeSlug, gate.ts three times | `rg -n "isActive\(" src`, enclosing function of each | hooks.ts:109 (activeItemOrLog), statusline.ts:103 (render), :328 (ambiguous), cli.ts:410 (state active in cmdState), :1009 (cmdMergeGate), costs.ts:319 (activeSlug), gate.ts:222, :602, :659 = 9 | T |
| D3 | "some take the first match and some count the matches" | same | `.find` at hooks 109, cli 410, 1009, costs 319, gate 602, 659; `.filter` then a count at statusline 103, 328, gate 222 | T |
| D4 | two items in_progress: state active prints the first, fanout plan fans out on it, the status line prints "2 active items" | live in `r77` (alpha, beta in_progress) | `alpha`; `review fan-out on alpha, 1 worker(s):`; `main · 2 active items` | T |
| D5 | in_progress plus a "bogus" status: fanout plan (through activeItem) says "no active item to fan out on" | live; `fanout.ts:67-68` | `mstack: no active item to fan out on` exit=2 | T |
| D6 | "mstack state active exits 2 with parseState's error" | live | `mstack: .../state.json .items[1].status is "bogus"` exit=2 | T |
| D7 | "the status line prints "state.json unreadable"" | live `statusline` | `main · state.json unreadable` | T |
| D8 | item 69: session-start prints "No active work item" on an unreadable state.json | `state show 69`; live `hook session-start` on the same store | 69: "session-start on an unreadable state.json logs the failure but still prints 'No active work item'"; hook: `"additionalContext":"mstack state for this repository:\n- No active work item."` | T |
| A1 | `rg "isActive\(" src` finds only lifecycle.ts, that function and the state list marker "(nine more sites today)" | exact | 12 lines: lifecycle.ts:101, state.ts:356 (activeItem), cli.ts:403 (list marker), plus the 9 of D2 | T, not yet true |
| A2 | "(today the first two take the first item and the status line prints "2 active items")" | D4 | as D4 | T, not yet true |
| A3 | unreadable state.json: "(today fanout plan says "no active item to fan out on")" | D5; also with state.json = `{not json` | `mstack: no active item to fan out on`; state active: `... is not valid JSON` exit 2 | T, not yet true |
| A4 | none, one, more than one, unreadable each tested once at that function | `state.ts:354` | activeItem returns `Item \| undefined`: no distinct answers exist yet | T, not yet true |
| S1 | "the active-item function" | matches A1 | - | T |

The candidate still stands. The narrowed item agrees with itself: title, description, all four
criteria and the seam are about the active item only. The only thing left over is the slug (see
the non-blocking findings).

### Item 78 `durable-store-file`

| # | Assertion | Command | Output (trimmed) | Verdict |
|---|---|---|---|---|
| T1 | the lock is each caller's choice; ledger and verification rows are appended without it | D1, D2 | see those rows | T |
| D1 | withLock is called by state.ts updateState, by decisions.ts and four times by costs.ts | `rg -n 'withLock\(' src`, enclosing functions | decisions.ts:53 (add), costs.ts:287, 425, 754, 764, state.ts:289 (updateState) | T |
| D2 | not by ledger.record or verification.record, which call tsv append directly | `rg -n '\bappend\(' src`; enclosing functions | ledger.ts:135 in `record` (105), verification.ts:314 in `record` (312); neither inside withLock | T |
| D3 | with ledger.tsv.lock and decisions.tsv.lock held by a live process, `ledger record` appends at once | `review57r3/scripts/hold-locks.mjs` takes both locks as `withLock` does (`openSync(lock, "wx")`, `"<pid> <uuid>\n"` written through the fd) and stays alive 8 s; timed `ledger record` | lock content `89248 1b181c4e-...`; `recorded test-verified for demo at a3d52799` exit=0 `elapsed=.054 s`; the row is in ledger.tsv | T |
| D4 | while `decide` waits and fails after 2 s naming the holder | timed `decide` under the same holder | `... decisions.tsv.lock is held by pid 89248 and did not let go in 2003 ms` exit=2 `elapsed=2.048 s`; decisions.tsv header only | T |
| D5 | verification.ts calls it deliberate: "Locking one of the two would leave the codebase inconsistent about a race present in both." | `rg -n -B3 -A10 'Locking one of the two' src/verification.ts` | `36-42`, verbatim across the wrap at 38-39 | T |
| D6 | temporary-and-rename is implemented three times | `rg -n 'rename(Sync)?\(\|\.tmp\b'` outside tests, docs, .mstack | state.ts:317, costs.ts:451, hooklog.ts:81 only | T |
| D7 | state.ts writeAtomically: `<name>.tmp-<pid>-<n>`, created exclusively, removed if the write fails | `bat -pp -r 286:330 src/state.ts` | `${basename(file)}${STATE_TMP_PREFIX}${process.pid}-${tmpCounter++}` with `STATE_TMP_PREFIX = ".tmp-"` (270); `openSync(tmp, "wx")`; `rmSync(tmp)` in the catch | T |
| D8 | costs.ts prune: `<file>.tmp`, not removed if the write fails | `costs.ts:449-451` | `` const tmp = `${file}.tmp`; writeFileSync(tmp, ...); renameSync(tmp, file); `` with no try | T |
| D9 | hooklog.ts trim: `<file>.<pid>.tmp`, removed in a finally | `hooklog.ts:78-84` | `` `${log}.${process.pid}.tmp` ``, `finally { rmSync(tmp, { force: true }); }` | T |
| D10 | adjacent 66 (lock follow-ups) and 68, in which updateState's rename turns a symlinked state.json into a regular file | `state show 66`, `state show 68`; live in `r78s` | 66 "Lock follow-ups from the item 52 reviews"; 68 "updateState renames a new file over the target, so a symlinked state.json becomes a regular file"; live `before: symlink` -> `after: regular file` | T |
| A1 | ledger.record and verification.record no longer append outside the lock; the comment explaining it is deleted or replaced | D2, D5 | both unlocked today; comment present | T, not yet true |
| A2 | `rg "renameSync\(" src` "finds one call (three today: state.ts, costs.ts and hooklog.ts)" | exact | 3 lines: costs.ts, hooklog.ts, state.ts | T, not yet true |
| A3 | "with ledger.tsv.lock held by a live process, mstack ledger record waits as mstack decide does (today it appends at once)" | D3, D4 | 0.054 s vs 2.048 s | T, not yet true |
| S1 | "the store-file module" | - | (scope note) | T |

The candidate still stands. Live, one store write waits for the lock and another ignores it
(D3, D4). Three rename implementations clean up in three different ways (D7-D9). Since round 3
dropped the all-writes search, the item no longer depends on what setup.ts does.

### Item 79 `workspace-facts`

| # | Assertion | Command | Output (trimmed) | Verdict |
|---|---|---|---|---|
| T1 | git is run outside git.ts, which calls itself the one place; gate, statusline and worktree each ask git for the branch or the dirty state | D1, D2, D5, D6 | see those rows | T |
| D1 | git.ts's header: "The one place this repository shells out to git." | `bat -pp src/git.ts` | line 6, verbatim | T |
| D2 | ledger.ts (isCommit, resolveSha) and worktree.ts (isDirty, run) call `execFileSync("git")` | `rg -n 'execFileSync\("git"' src`, enclosing functions | ledger.ts:57 (isCommit), :82 (resolveSha), worktree.ts:81 (isDirty), :152 (run) | T |
| D3 | git() returns null on any failure and passes a 5 s timeout | `git.ts:21, 61-76` | `GIT_TIMEOUT_MS = 5_000`, `timeout: GIT_TIMEOUT_MS`, `catch { return null; }` | T |
| D4 | worktree.ts run throws a UserError and passes no timeout | `worktree.ts:150-155` | `execFileSync("git", args, { cwd: store.root, encoding: "utf8" })`, `throw new UserError(...)` | T |
| D5 | the branch is read with `rev-parse --abbrev-ref HEAD` in gate.ts checkWorkspace and statusline.ts | `rg -n 'abbrev-ref' src` | gate.ts:570, statusline.ts:90, nothing else | T |
| D6 | dirty is `git status --porcelain` in checkWorkspace and `--porcelain --ignored=matching` in worktree.ts isDirty | `rg -n -- '--porcelain' src` | gate.ts:581, worktree.ts:81 | T (the commands) |
| D6b | "The same question gets separate answers" for dirty | `worktree.ts:67-78`; live in `r79d` (ignored `.env` in a linked worktree) | the comment: porcelain without `--ignored` "reported clean and `prune --yes` deleted it"; live: gate `[ok]    working tree is clean`, `worktree list` `merged,dirty` | **F** (Changes required 1) |
| D7 | on a detached head the gate prints "[ok] on branch HEAD" while the status line shows no branch | live in `r79` (`git checkout --detach HEAD~1`) | gate `[ok]    on branch HEAD`; statusline `idle`; control on `feat/x`: `feat/x · idle`, `[ok]    on branch feat/x` | T (whitespace note) |
| D8 | costs.ts marksDir and hooklog.ts gitCommonDir each walk up to .git and parse a gitdir: line by hand | `costs.ts:158-185`, `hooklog.ts:112-134` | both loop `dirname` up from the start, `statSync(join(dir, ".git"))`, `/^gitdir:\s*(.+)$/m` | T |
| D9 | paths.ts asks `git rev-parse --git-common-dir` | `rg -n -- '--git-common-dir' src/paths.ts` | 187 (with `HEAD:src`), 194 | T |
| A1 | `rg 'execFileSync\("git"' src` "(five today: git.ts, ledger.ts twice and worktree.ts twice)" | exact | 5 lines: git.ts, ledger.ts x2, worktree.ts x2 | T, not yet true |
| A2a | the module answers "head and dirty", and gate.ts, statusline.ts and worktree.ts "take those answers from it" | D6b | the two dirty checks answer different questions on purpose | **F** (Changes required 1) |
| A2b | "on a detached head the gate no longer prints "on branch HEAD" (it does today)" | D7 | `[ok]    on branch HEAD` | T, not yet true |
| A3 | `rg "\^gitdir:" src` "(costs.ts and hooklog.ts today)", paths.ts "(twice today)" | exact; D9 | `costs.ts: const m = /^gitdir:...`, `hooklog.ts: const m = /^gitdir:...`; paths.ts 187, 194 | T, not yet true |
| A4 | four branch states and a linked worktree's git dir tested at the module | - | no module exists | T, not yet true |
| S1 | "the workspace module" | - | - | T |

The candidate still stands on the rest of the evidence. Git is called in five places with two
different failure contracts (D2-D4). One branch question gets two renderings, live (D7). The git
directory is found by three separate routines (D8, D9). Only the dirty half rests on a false
premise.

### Item 80 `tsv-record-shape`

| # | Assertion | Command | Output (trimmed) | Verdict |
|---|---|---|---|---|
| T1 | the four stores spell their columns four times; a reordered header silently misaligns rows | D1-D4, D7 | see those rows | T (costs note) |
| D1 | a HEADER array each | `rg -n 'HEADER\b.*='` | ledger.ts:37, decisions.ts:10, verification.ts:45, costs.ts:58 | T |
| D2 | a row type: Entry, Decision, Receipt, and costs.ts NewRow, "which leaves out ts" | the four definitions | ledger.ts:43, decisions.ts:12, verification.ts:77, costs.ts:643 (`run, target, role, agent_id, model, usage, messages, cost, source`) | T (note: also `usage` and `cost`) |
| D3 | the positional array handed to tsv append: ledger.record, decisions.add, verification.record, costs.ts emit | read each | ledger.ts:135-142, decisions.ts:59-67, verification.ts:314-321, costs.ts:772-787 `written.push([ts, r.run, ...])` -> `append(store.costs, HEADER, values)` at 846 | T |
| D4 | the string keys each reader takes from readRecords: ledger.entries, decisions.all, verification.receipts, costs.summarize | `rg -n 'readRecords\(' src` | ledger.ts:147, decisions.ts:73, verification.ts:326, costs.ts:879 | T |
| D5 | costs.ts verifierFailed reads ledger.tsv by string key, not through ledger.entries | `costs.ts:906-907` | `readRecords(store.ledger).filter((r) => r["target"] === slug && r["verdict"] === "verifier-failed")` | T |
| D6 | ensureHeader returns without a word when the file's header is not a prefix of the caller's | `tsv.ts:45-58` | `if (present.length === 0 \|\| present.length >= header.length) return;` ... `if (!isPrefix) return;` | T |
| D7 | sha and target swapped: `ledger record demo <sha>` exits 0 and stores demo under sha | live in `r80`, header `sha	target	verdict	evidence	verifier	ts` | `recorded test-verified for demo at 55ba065c` exit=0; row `demo	55ba065c6a89...	test-verified	...` | T |
| D8 | "and mstack ledger check demo then reports no verdict" | live | `FAIL no verdict recorded for demo` exit=1 | T |
| D9 | "over the store-file module of item 78" | `state show 78` | seam `the store-file module` | T |
| A1 | "(today ledger.record, decisions.add, verification.record and emit in costs.ts each build one)" | D3 | four positional arrays | T, not yet true |
| A2 | `rg "readRecords\(store\.ledger\)" src` "(it also finds costs.ts verifierFailed today)" | exact | `src/ledger.ts:  return readRecords(store.ledger)`, `src/costs.ts:  return readRecords(store.ledger).filter(...)` | T, not yet true |
| A3 | reordered header refused with the file unchanged; "(today it exits 0 and stores the target under sha)" | D6, D7 | silent return; exit 0, misaligned row | T, not yet true |
| S1 | "the table declaration" | - | - | T |

The candidate still stands. Each column list is kept in step by hand in four places per store,
and a reordered header misaligns rows with no error, live (D7, D8).

### Overlap with open items

I read `./bin/mstack state list` and `state show` for 40, 51, 66, 68, 69 and 71, and also 19 and
65. None of 76 to 80 duplicates an open item. 77 names 69 as adjacent, and 78 names 66 and 68.
51 (cost flush as one append) and 65 (a column added to verification.tsv) touch files that 78 and
80 would move, but neither restates a criterion of theirs. 76 and 71 both deal with a split between
`state set` and the gate, on different rules (see the non-blocking findings). 40 (size and base
fields) does not overlap.

## The three short checks

**1. Only the store changed in round 3.**

```
$ git diff c6041be..c53df60 -- . ':!.mstack' | wc -l
       0
$ git diff c6041be..c53df60 --stat
 .mstack/decisions.tsv                              |    3 +
 .mstack/ledger.tsv                                 |    2 +
 .mstack/progress/current.md                        |    5 +-
 .mstack/progress/impl_deep-module-vocabulary_r3.md | 1147 ++++++++++++++++++++
 .../progress/review_deep-module-vocabulary_r2.md   |  325 ++++++
 .mstack/state.json                                 |   56 +-
 6 files changed, 1509 insertions(+), 29 deletions(-)
$ git diff c6041be..c53df60 -- .mstack/state.json | rg '^@@|"id"|"status"'
@@ -1070,15 +1070,15 @@
       "id": 76,
       "status": "pending",
@@ -1087,30 +1087,31 @@
       "id": 77,
       "status": "pending",
       "id": 78,
       "status": "pending",
@@ -1119,14 +1120,15 @@
       "id": 79,
       "status": "pending",
@@ -1135,14 +1137,14 @@
       "id": 80,
       "status": "pending",
$ jq .status of item 57 at c6041be, then at the head
"reviewing"
"reviewing"
```

In state.json only items 76 to 80 changed, and item 57 reads `reviewing` at both ends. decisions.tsv gains the `review-r3` row and
two `implement` rows, and ledger.tsv gains the round 2 `verifier-failed` row and the round 3
implementer's `test-verified` row at `3a978df`.

**2. The gate, the lint and the suite pass at the head.**

- `./bin/mstack gate`: `PASSED - 0 failures, 0 warnings`, with `[ok] one active item:
  deep-module-vocabulary (reviewing)` and `[ok] working tree is clean`.
- `./bin/mstack lint-plugin .`: `PASSED - 0 failures, 0 warnings`.
- `npm test`, one run: bun `592 pass / 0 fail / Ran 592 tests across 27 files. [103.50s]`, then
  node `tests 592 / pass 592 / fail 0 / cancelled 0`, `npm test exit=0`. None of the
  load-sensitive tests (item 67) failed, so nothing needed a rerun.
- `npm run typecheck` (`bunx --bun tsc --noEmit`): exit 0.

That is the whole store `verify` (`npm test && npm run typecheck && bin/mstack lint-plugin .`),
run by hand. I did not run `gate --full`, because it appends a receipt to `.mstack/verification.tsv`,
and my brief allows one write to this store: the ledger row. `./bin/mstack ledger check
deep-module-vocabulary c53df60e...` before my row: `FAIL no verdict at c53df60e; 5 row(s) exist at
other SHAs`.

**3. Item 57's criteria.** See the table below. The product files are unchanged since `c6041be`
(check 1), so the round 2 probes of criteria 1 and 2 still apply to the same bytes. I did not
redo them.

## Item 57, per criterion

| Criterion | Verdict | Evidence | Rung |
|---|---|---|---|
| "the design skill references the vendored vocabulary, and the reviewer has it as a lens, with origin headers" | Met, carried over | No product file changed since `c6041be`, where round 2 verified it (`review_deep-module-vocabulary_r2.md`, Per criterion). `lint-plugin` at the head: `4 origin header(s), each naming a licence file that ships` and every cross-reference resolves | 2 for "unchanged" (the empty diff); 4 for the lint run at the head; the lens run itself was round 1's and was not repeated |
| "a request such as '/mstack review the architecture' routes to a playbook that ends with candidates filed as pending items, each naming files, the deepening and its test surface, and asks the user nothing" | Met, carried over | `skills/router/SKILL.md` and `skills/router/playbooks/deepen.md` are unchanged since `c6041be`, where round 2 ran it headless twice | 2 here (unchanged files); round 2 reached 5 |
| "that playbook run on this repository files its candidates, pasted in the report" | **Not met** | Filed: items 76 to 80 are pending with source `deepen playbook run, 2026-11-17`. Pasted: every line of `state show 76` to `80` appears verbatim in `impl_deep-module-vocabulary_r3.md`, 13/13, 13/13, 12/12, 13/13 and 12/12. 76 of the 78 rows above hold. Item 79's dirty claim (D6b) and acceptance 2a's premise are contradicted by `worktree.ts:67-78` and by the CLI (Changes required 1) | 5 for the behaviour rows (real CLI, throwaway stores and repositories, a live process holding the lock); 4 for the counts (`rg` as each item spells it) |

Once item 79 carries the one-sentence fix, criterion 3 needs only a re-read of that one item. Every
other row in the five tables is already true, and no product file is involved.
