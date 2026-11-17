# Review - deep-module-vocabulary (item 57), round 2

**Verdict:** CHANGES_REQUESTED

Reviewed `bfe37e2..c6041be` (head `c6041be0e156bc1b5323c59c8d1c6e13e6bd2063`): 3 prose files (+29 -26) and the rewritten items 76 to 80 in `.mstack/state.json`. I wrote none of it and did not review round 1. Scratch work, clones and streams are in `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review57r2/`.

The playbook change works. I ran it twice on the final wording, once on a clone of this repository and once on `template-hard`. Neither run asked a question, implemented anything or filed more than five items. I checked every count, file, line and function in the 6 items they filed against the code, and all of them hold (n=1 per codebase). The vocabulary fixes are right, and the suite, typecheck, lint and gate (including `gate --full` in a clone) are green.

The verdict is about acceptance 3 again. The hand corrections to items 76 to 80 removed the four round-1 errors, but they added or kept four new statements that the code contradicts, in items 77, 78, 79 and 80. Each one is a sentence, and each fix is one `./bin/mstack state set <id> --description/--acceptance/--title`. Item 76 is true as stated, and its new fork criterion reproduces on the real CLI.

## Changes required

1. **Item 77 `item-readiness-reading`, description: "with three error contracts: activeItem swallows a parse error, hooks.ts:107-114 logs it, the rest let parseState throw."** This is false for five of the eight remaining sites. `gate.ts:222`, `602` and `659` work on a state that `loadOrReport` (`gate.ts:95-107`) already parsed: it catches the `UserError` and reports it. `statusline.ts:103` runs after a catch at `statusline.ts:94-101` that renders `state.json unreadable`, and `statusline.ts:326-331` catches and returns `true`. Only `cli.ts:410`, `cli.ts:1009` and `costs.ts:318` let it throw. Live, in a throwaway store whose only item has status `"bogus"` (`scratchpad/review57r2/broken77`):
   ```
   == state active (cli.ts:410):
   mstack: .../broken77/.mstack/state.json .items[0].status is "bogus"
           see the lifecycle in the mstack README for the valid set
   exit 2
   == gate (gate.ts:222/602/659 via loadOrReport):
   [fail]  .../broken77/.mstack/state.json .items[0].status is "bogus" -> see the lifecycle in the mstack README for the valid set
   exit 1
   == statusline (statusline.ts:95-103):
   main · state.json unreadable
   exit 0
   ```
   To pass, state the contracts the code has, for example: "at least five error contracts: activeItem (state.ts:354-360) and hooks.ts:107-114 return undefined, and hooks also logs it; statusline renders 'state.json unreadable' (94-101) or treats the store as ambiguous (326-331); the gate reports it as a failure through loadOrReport (gate.ts:95-107); cli.ts:410, 1009 and costs.ts:318 let parseState throw." The finding gets stronger, not weaker.

2. **Item 78 `durable-store-file`, acceptance 1: "rg 'writeFileSync|appendFileSync|renameSync' src finds them only in that module, in hooklog.ts (a log, not a store) and in run-helper.mjs (a result file); today it also finds them in costs.ts and state.ts".** Today the search also finds `setup.ts`, which writes `state.json`, `progress/current.md`, `progress/history.md`, `.gitattributes` and `.gitignore` unlocked and non-atomically. `resetCurrent` (`setup.ts:177-179`) also rewrites `current.md` at session close. `tsv.ts` matches too, which is fine if it is "that module".
   ```
   $ rg -n "writeFileSync|appendFileSync|renameSync" src
   src/tsv.ts:2 47 57 62
   src/setup.ts:1 155 160 172 178        <- 172 is write(): state.json, current.md, history.md (setup.ts:145-147)
   src/costs.ts:2 10 12 287 450 451 853
   src/run-helper.mjs:13 20
   src/hooklog.ts:1 65 80 81 106
   src/state.ts:1 313 317
   ```
   (Line numbers condensed per file from the `rg -n` listing.) To pass, name `setup.ts` in "today", and say whether setup's writes are meant to move into the module. As worded, the criterion requires them to move.

3. **Item 79 `workspace-facts`, description: "No git, no commits and detached are told apart in gate.ts:563 versus 570 (two calls), folded into one test in statusline.ts:91 (HEAD), and collapsed to UNKNOWN_TREE in verification.ts:207-253."** That is true for the statusline. For the other two it does not hold for a detached head. The gate does not tell detached apart: `rev-parse --abbrev-ref HEAD` returns `HEAD`, which is reported as a branch. `treeId` returns `clean` on a detached head, because `git diff HEAD` works there.
   ```
   == detached:                       (throwaway repo detach79, git checkout --detach)
   -- workspace
   [ok]    on branch HEAD
   [ok]    working tree is clean
   $ bun probes/tree.ts <dir>         (imports treeId and storeAt from this checkout)
   detach79 treeId = clean
   nocommit79 treeId = unknown
   nogit79 treeId = unknown
   ```
   To pass, state it the way the code behaves, for example: "gate.ts:563 and 570 tell no git from no commits and report a detached head as 'on branch HEAD'; statusline.ts:91 folds all three into one test; verification.ts:207-253 collapses no git and no commits to UNKNOWN_TREE and treats a detached head as a normal tree." The title's "three encodings" still holds.

4. **Item 80 `tsv-record-shape`, title "... costs three" and description "costs has no row interface for costs.tsv (CostRow at costs.ts:866 is a summary) and repeats three".** costs does have a row interface. `interface NewRow` (`costs.ts:643-653`) is the shape that `emit` (`costs.ts:772-787`) flattens into a `costs.tsv` row. It names run, target, role, agent_id, model, usage (input, cache_write, cache_read, output), messages, cost and source, which is every column except `ts`.
   ```
   $ rg -n "^(export )?(interface|type) " src/costs.ts
   78:export interface Mark {  88:interface Ended {  105:export interface Flushed {  114:interface FlushedRecord {
   120:export interface SessionMarks {  130:interface Usage {  510:interface Scan {  643:interface NewRow {
   864:export type By = ...  866:export interface CostRow {
   $ bat -pp -r 643:653 src/costs.ts
   interface NewRow { run; target; role; agent_id; model; usage: Usage; messages; cost; source }
   $ bat -pp -r 772:787 src/costs.ts
   const emit = (r: NewRow): void => { written.push([ts, r.run, r.target, r.role, r.agent_id, r.model, String(r.usage.input), ..., r.source]); };
   ```
   So costs spells its columns four times too: HEADER at 58-72, NewRow at 643-653, the positional array at 773-787 and string-key reads at 879-890. The wording came from round 1's own suggested fix (`review_deep-module-vocabulary.md:46`), which missed NewRow. It is still a false statement in a filed item. To pass, make it "all four stores four times (costs: HEADER 58, NewRow 643 without ts, the positional array at 773, string-key reads at 879-890)", or say why NewRow does not count.

Once these four sentences are corrected, acceptance 3 is met. Nothing in the product diff has to change.

## Non-blocking findings

- **Item 80 also says "Adjacent: 65 adds a column to verification."** Item 65 says no such thing (`./bin/mstack state show 65`: "verification.tsv already records outcome and tree, so the gate can require ... a failed row"). It is a claim about an item, not about code, which is the case step 6 has the playbook `state show` for. The same `state set` can fix it.
- **Item 79's 22** is true by the description's own definition (18 calls to `git()` plus 4 direct calls). Nine more sites ask git through `headSha` and `defaultBranch`: `closing.ts:50,101`, `cli.ts:831,977`, `gate.ts:575,608,675` and `worktree.ts:29,116`. Acceptance 2's list of callers ("gate, statusline, worktree, costs and hooklog") leaves out `closing.ts` and `cli.ts`, which ask for head. It also leaves out `verification.ts`, `paths.ts` and `ledger.ts`.
- **Item 77, "readVerdict ... is the one reader of the verdict"** is true for the Reading. Outside it, `gate.ts:405` marks an item `failed` from raw rows before `readVerdict` runs, and `costs.ts:907` counts `verifier-failed` rows. Acceptance 3's "because the two can no longer disagree" does not fit the code: `ledger check` and the gate disagree on purpose for author-only (check pass, gate fail) and blocked (check fail, gate pass), at `tests/verdict-reader.test.ts:35,45,46`. Acceptance 2's single mapping leaves `ledger check` out, so the agreement test may still have work to do. Item 77 does not name item 69, which is about `session-start` on an unreadable state.json and is the same error-contract area.
- **Item 76 ranges and lists:** `checkOpenDecisions` spans 274-334, not 274-325. `canTransition` is three lines, not "one-line". Acceptance 4 names only `tests/state-cli.test.ts` and `tests/cli.test.ts`, but `tests/closing.test.ts` (20 `"--status"`) and `tests/decisions.test.ts` (13) also spawn the CLI for transitions.
- **B2 printed no `skip:` line** although `deepen.md:10` asks for one (n=1). B1 printed it. B2 also wrote `/tmp/deepen_probe/probe.py` outside the project, as round 1's B1 did. It ran the project's tests and deleted the `__pycache__` they left.
- **"Just before each `state add`" happened per batch, not per item.** B1 ran its searches (tools 16-19) and then filed both items in one command (tool 21). B2 re-derived everything in one command (tool 10), wrote the report, then filed all four in one command (tool 12). The claims were still true.
- **Step 2 is still untested on my runs.** Neither run launched a reader (B1: "src/ is 8441 lines; read directly"). As raw material, the implementer's three streams each launched 3 `general-purpose` readers, and in r2 two of them wrote `explore_*.md`. The type exists in a plugin session: the init event lists `general-purpose` beside `Explore`.
- **B1's reply** rejects "duplicate active-item lookups at four places". It counts only the sites that re-parse state.json (`cli.ts:410,1009`, `hooks.ts:109`, `costs.ts:319`). Nine sites are inline. This is in the reply, not an item, and step 6 covers items only.
- **B1 committed** `e8ad04c chore: file items 81 and 82 from a second deepen run` (store only) on the feature branch. This is allowed by the brief; in the real repository it would move HEAD past the SHA under review.
- **`investigate.md:8-10`** has the same "each writes to explore_<topic>.md" instruction without naming an agent type that can write. It is outside this diff.
- **The origin header of `deep-modules.md`** still credits the 100k-token incident to "the source's own documentation" without naming `docs/engineering/codebase-design.md` (round 1 minor note, unchanged).

## Probe A: items 76 to 80, every claim at c6041be

Each claim is checked by the command shown. "T" means true and "F" means false.

### Item 76 `item-transition-module`

| Claim | Command / evidence | Result |
|---|---|---|
| cmdState at cli.ts:379 | `rg -n "function cmdState" src/cli.ts` gives `379:function cmdState` | T |
| fork check 571-581 | `bat -r 565:700 src/cli.ts`: 571 `if (` ... 581 `}` | T |
| legal-transition check 582-587 | 582 `if (!canTransition(...` ... 587 `}` | T |
| closing policy 595-639 | 595 `if (values.status === "done" && item.status !== "done") {` ... 639 `}` | T |
| forced-close marker 554, 634-637, 666, 681-686 | 554 `let forcedUnverified`, 634 hint naming FORCED_UNVERIFIED, 637 `forcedUnverified = summary`, 666 marker carried, 681-686 note written | T |
| lifecycle.ts holds the table and six one-line predicates | `rg -n "export" src/lifecycle.ts`: STATUSES, ACTIVE_STATUSES, SPEC/DECISION/VERIFICATION_REQUIRED_FROM, TERMINAL_STATUSES, TRANSITIONS; isStatus, isActive, requiresSpecArtifacts, requiresDecision, requiresVerification, canTransition | T (canTransition is 3 lines) |
| cli.ts:571-576 refuses only while decision_resolved is empty | line 574 `(item.decision_resolved ?? "") === ""` | T |
| gate checkOpenDecisions (274-325) also requires a matching decisions.tsv row (302-318) | gate.ts:274 `function checkOpenDecisions`; 309 `rows.filter((row) => row.ts === answer && row.resolves === item.slug)`; 310-318 fail on no match, duplicates, empty decision, open result | T (function ends at 334) |
| cli.ts exports only FORCED_UNVERIFIED | `rg -n "^export" src/cli.ts` gives `223:export const FORCED_UNVERIFIED` | T |
| tests reach the rules only by spawning (state-cli.test.ts:28, cli.test.ts:29) | 28 `spawnSync(rt.exe, [...rt.flags, CLI, ...args]`; 29 `spawnSync(BIN, [...args]` | T |
| acceptance 2: "cli.ts:571-576 accepts it today" | live, below | T |
| acceptance 3: "681-686 today" assigns item.closed_by | 684 `item.closed_by = note;` | T |

The new criterion on the real CLI, in a throwaway store (`fork76`):
```
$ mstack state set fork --status spec_ready          # decision_resolved empty
mstack: fork has an unanswered decision: "x or y"
        answer it with 'mstack decide --resolves fork ...' first
exit 2
# decision_resolved set by hand to 2020-01-01T00:00:00.000Z; decisions.tsv has only its header
$ mstack state set fork --status spec_ready
1 fork (spec_ready)
  status: "specifying" -> "spec_ready"
exit 0
$ mstack gate --quiet
[fail]  1 fork (spec_ready) points at decision 2020-01-01T00:00:00.000Z, and no row with that timestamp resolves fork -> the row is the evidence; a pointer to one that does not say anything is not an answer
exit 1
```
The criterion states the difference correctly. The only way to that state is a hand edit or a later edit of the row: `decide --resolves --result open` is refused (`resolving a fork needs --result`), so `decide` cannot produce it. The deepening still holds: the rules are composed only inside `cmdState`, and no criterion is already true at head. Item 76 is adjacent to 40, 44, 68 and 71 (which change this block) but none of them duplicates it. The seam (the transition module's apply function) is a test surface.

### Item 77 `item-readiness-reading`

| Claim | Command / evidence | Result |
|---|---|---|
| readVerdict at ledger.ts:222 is the one reader | `rg -n "readVerdict" src`: one definition, callers closing.ts:103,110, ledger.ts:296, gate.ts:421 | T for the Reading (see the non-blocking note on gate.ts:405) |
| ledger check switch at 312 | ledger.ts:312 `switch (kind) {` | T |
| gate checkClosedItems 421-438 | 421 `readVerdict(rows, item.slug)!`, 422/424/437 `reading.kind ===` | T |
| closing.ts 103-123 | 104 `atHead?.kind === "rejected"`, 123 `reading?.kind !== "rejected"` | T |
| statusline 158-160 | 158 `result.kind === "author-only"`, 160 `result.kind === "discounted"` | T |
| statusline.ts:154-157 comment | 156-157 "The kind comes from the reader `ledger check` and the gate share" | T |
| verdict-reader.test.ts:87 pins check and gate | 87 `test("ledger check and the gate's closing audit agree on every sequence, ...` | T as a paraphrase of its name (see the non-blocking note) |
| mergegate.ts:165 reads only passing and reason | `rg -c kind src/mergegate.ts` exits 1; 165-170 use `result.passing`, `result.reason` | T |
| nine inline isActive lookups at hooks 109, statusline 103/328, cli 410/1009, costs 319, gate 222/602/659 | `rg -n "isActive\(" src`: those 9 plus cli.ts:403 (list marker), lifecycle.ts:101 (definition), state.ts:356 (activeItem) | T |
| activeItem at state.ts:354 swallows | 354-360 `try { ... } catch { return undefined; }` | T |
| hooks.ts:107-114 logs it | 111 `hooklog.noteFailure("state.json could not be read", error)` | T |
| "three error contracts ... the rest let parseState throw" | live probe in Changes required 1; gate.ts:95-107, statusline.ts:94-101, 326-331 | **F** |
| acceptance 2: rg '\.kind (===\|!==)' on gate, closing, statusline finds nothing after | today: gate 422, 424, 437; closing 104, 123; statusline 158, 160 | not yet true, so it discriminates |

### Item 78 `durable-store-file`

| Claim | Command / evidence | Result |
|---|---|---|
| withLock at tsv.ts:173 | `173:export function withLock<T>(` | T |
| taken by state.ts:289, decisions.ts:53, costs.ts:287, 425, 754, 764 | `rg -n "withLock\(" src` lists exactly these | T |
| not by ledger.record (append at ledger.ts:135) or verification.record (append at verification.ts:314) | 135 `append(store.ledger, HEADER, [`; 314 `append(store.verification, HEADER, [`; neither is inside withLock | T |
| verification.ts:34-42 records the omission as deliberate, fail-closed | 36-42 "`record` appends without `withLock` ... Locking one of the two would leave the codebase inconsistent ... Losing a row is fail-closed" | T |
| ensureHeader widens by an unlocked whole-file writeFileSync (tsv.ts:55-57) | 55-57 read whole file, `writeFileSync(file, ...)`; no lock in ensureHeader | T |
| state.ts:308-329 `.tmp-<pid>-<n>`, wx, cleanup | 309 `${basename(file)}${STATE_TMP_PREFIX}${process.pid}-${tmpCounter++}`, STATE_TMP_PREFIX = ".tmp-" (270), 311 `"wx"`, 320 `rmSync(tmp...)` | T |
| costs.ts:449-451 `${file}.tmp`, no cleanup | 449 `const tmp = \`${file}.tmp\``, 450-451 write and rename, no rm | T |
| hooklog.ts:79-82 `<file>.<pid>.tmp`, cleanup in finally | 78 `${log}.${process.pid}.tmp`, 82-84 `finally { rmSync(tmp...` | T |
| adjacent 66, 68, 51 | `state show 66`, `68`: lock follow-ups; state write follow-ups (rename, symlink, mode); 51 cost ledger follow-ups | T |
| acceptance 1 "today it also finds them in costs.ts and state.ts" | `rg -n "writeFileSync\|appendFileSync\|renameSync" src` also finds setup.ts:1,155,160,172,178 and tsv.ts:2,47,57,62 | **F** (setup.ts) |

### Item 79 `workspace-facts`

| Claim | Command / evidence | Result |
|---|---|---|
| git.ts:6 says it is the one place | 6 " * The one place this repository shells out to git." | T |
| direct execFileSync at ledger.ts:57, 82, worktree.ts:81, 152 | `rg -n 'execFileSync\("git"' src`: git.ts:63, ledger.ts:57, 82, worktree.ts:81, 152 | T |
| git() null on failure, 5 s timeout (git.ts:21, 61) | 21 `GIT_TIMEOUT_MS = 5_000`, 61-75 catch returns null | T |
| worktree.ts:152 throws, no timeout | 152 `execFileSync("git", args, { cwd, encoding })`, 154 `throw new UserError` | T |
| 22 call sites outside git.ts in seven modules: 18 git() (costs 1, gate 5, paths 2, statusline 2, verification 4, worktree 4) + 4 direct | `rg -n "\bgit\(" src \| rg -v "^src/git.ts"` gives 17 lines, and worktree.ts:117 has two calls, so 18. `rg -c`: verification 4, paths 2, statusline 2, costs 1, gate 5, worktree 3 lines (4 calls). Plus ledger 2 and worktree 2 direct = 22, in seven modules | T by its definition (9 more via headSha/defaultBranch, non-blocking) |
| gate checkWorkspace 562-588, statusline 90-91 and 134, worktree 25 and 79-81 | gate.ts:562-588; statusline.ts:90-91, 134; worktree.ts:25 `list`, 79-91 `isDirty` | T |
| git dir three ways: costs 158-187 walk + `--git-path`; hooklog 112-135 walk + commondir; paths 186-200 `--git-common-dir` | costs.ts:163-184; hooklog.ts:112-134; paths.ts:187, 194 | T |
| no git / no commits / detached told apart in gate 563 vs 570 | live: detached gives `[ok] on branch HEAD` | **F** for detached |
| statusline.ts:91 folds into one test (HEAD) | 91 `branch !== null && branch !== "" && branch !== "HEAD"` | T |
| collapsed to UNKNOWN_TREE in verification.ts:207-253 | live: detached gives `clean`; no commits and no git give `unknown` | **F** for detached |
| acceptance 1 "five today" | same rg, 5 lines | T |

### Item 80 `tsv-record-shape`

| Claim | Command / evidence | Result |
|---|---|---|
| ledger.ts:37 HEADER, 43 Entry, 135-142 append, 146-157 read-back | as read | T |
| decisions.ts:10, 12, 59-67, 72-81 | 10 HEADER, 12 `interface Decision`, 59-67 positional, 72-81 `all` | T |
| verification.ts:45, 77, 314-321, 325-333 | 45 HEADER, 77 `interface Receipt`, 314-321, 325 `receipts` | T |
| costs has no row interface for costs.tsv; "repeats three" | `interface NewRow` at costs.ts:643-653, used by `emit` at 772 | **F** |
| costs HEADER 58, positional 773, string-key reads 879-890 | as read | T |
| setup.ts imports each HEADER (7-9, used 149-153) | 7-9 `import { HEADER as ... }`, 149/151/153 `ensureHeader` | T |
| costs.ts:907 reads ledger rows by string key | 907 `readRecords(store.ledger).filter((r) => r["target"] === slug && r["verdict"] === "verifier-failed")` | T |
| reordered header misaligns silently; ensureHeader returns at tsv.ts:53 | live, below; 53 `if (!isPrefix) return;` | T |
| "Adjacent: 65 adds a column to verification" | `state show 65`: no column | F (an item, not code; non-blocking) |

```
$ bun probes/reorder.ts tsv80/ledger.tsv     # header: sha target verdict ...; append with ledger's HEADER
append: no error
sha	target	verdict	evidence	verifier	ts
abc	one	live-verified	e	reviewer	t0
two	def	live-verified	e	reviewer	t1
[{"sha":"abc","target":"one",...},{"sha":"two","target":"def","verdict":"live-verified",...}]
```

For all five, the deepening still rests on something real. 76: the rules are composed in one closure, and the fork rule is judged two ways. 77: active-item lookups are duplicated, and Reading interpretation is spread across four modules. 78: lock choice and tmp-rename are each implemented three ways. 79: there are 22 sites and two failure modes. 80: there are four copies of each schema. No acceptance criterion is already true at head. None duplicates an open item; the adjacent ones are named above. Each seam is a module interface a test can cross.

## Probe B: the playbook on its final wording

The wrapper (`scratchpad/review57r2/run.sh`) runs `env -i` with HOME, USER, LOGNAME, TERM, LANG, TMPDIR, SHELL, and a PATH of the bun bin dir, the claude bin dir, `/opt/homebrew/bin` and the system dirs. It sets no ANTHROPIC_* variable. It runs `perl -e 'alarm shift; exec @ARGV' 1200 claude -p "/mstack review the architecture" --model opus --output-format stream-json --verbose --setting-sources project --strict-mcp-config --max-budget-usd 8 --plugin-dir <dir> --permission-mode auto`. claude was 2.1.326. Both init events show model `claude-opus-5-5`, permission mode `auto` and plugin `mstack` at the given dir. The streams are in `scratchpad/review57r2/streams/`, outside both projects. `pgrep -fl "claude -p"` printed nothing after the runs. The suite was not running during them.

- **B1** used a `git clone` of this repository at c6041be. Items 76 to 80 were set to `cancelled` in the clone only, as commit `5a768f8`. `--plugin-dir` pointed at the clone.
- **B2** used a fresh copy of `sandbox/bench/template-hard`, with `git init`, one commit, this checkout's `setup` (committed as `c2f98b7`), and `--plugin-dir /Users/romerma/Code/mstack`.

| Run | Route | Intake line | Readers | Searches before filing | Filed | Question? | Outside .mstack/ | turns, USD, s |
|---|---|---|---|---|---|---|---|---|
| B1 | deepen (tool 1 reads `skills/router/playbooks/deepen.md`, tool 2 `deep-modules.md`) | `skip: deepening, the playbook files its own items.` at the start of the first text and of the final reply | 0 ("src/ is 8441 lines; read directly") | tools 16-19 (counts, `state show 68/71/40/44`, writer and lock greps), then tool 21 files both | 2 (81, 82) | none (0 `?` in final) | nothing; store-only commit `e8ad04c` (decisions.tsv +1, deepen file +37, state.json +32); `git diff c6041be..HEAD -- . ':!.mstack'` is 0 lines | 24, 1.019, 197.4 |
| B2 | deepen (tool 1 reads `deepen.md`, tool 2 `deep-modules.md`) | none | 0 (3k lines, read itself) | tool 10 ("re-deriving every count each item will cite": `state list` and greps), tool 11 writes the report, tool 12 files all four | 4 | none (one `?`, inside `"Zo?"`) | nothing in the project (`git status`: only `.mstack/`, HEAD unchanged on `main`); wrote `/tmp/deepen_probe/probe.py` | 15, 1.108, 164.5 |

B1 kept the same-day rule: it appended `# Deepen run, 2026-11-17, second run ("review the architecture")` to the existing file, and its `--source` says "(second run)". It also said 76 to 80 "are cancelled in this clone, so they don't count as covered". Both runs ended on a statement and listed what they rejected. Each wrote one or two `decide --phase deepen` rows.

### Claims in what B1 filed, against this repository at c6041be

| Item | Claim | Check | Result |
|---|---|---|---|
| 81 | state set at cli.ts:485-791 | `rg -n 'if \(sub === "set"\)' src/cli.ts` gives 485; branch returns at 788-789, 791 is the unknown-subcommand throw | T (end loose by 2) |
| 81 | holds fork guard, transition check, closing refusal with --force --closed-by, forced-close marker, sdd and fork announcements | 571-581, 582-587, 595-639, 681-686; sdd at 717-720, fork at 750 | T |
| 81 | decide --resolves at cli.ts:852-939 holds what answers a fork | 852 `function cmdDecide`, 882-913 the checks, 939 `}` | T |
| 81 | gate re-states the fork rule at gate.ts:274-333 with a weaker floor (SUBSTANTIAL, gate.ts:29) than MIN_PHRASE and MIN_REPORT_BYTES | gate.ts:29 `/[a-z0-9]/i`, 314 the only decision test; cli.ts:31 `MIN_PHRASE = 12`, roles.ts:64 `MIN_REPORT_BYTES = 40`; live, below | T |
| 81 | closing.test.ts spawns the CLI for every close and boots a custom script (cliWithSecondCheck) | 16 `spawnSync(BIN`, 81 `function cliWithSecondCheck`, 100 `spawnSync(process.execPath, [...flags, boot`; in-process calls are closingProblems only (29, 42, 57, 209, 234, 272) | T |
| 82 | ledger HEADER :37, record :135-142, entries :147-156 | as in item 80 | T |
| 82 | decisions HEADER :10, add :59-67, all :73-81 | as in item 80 | T |
| 82 | verification HEADER :45, record :314-321, receipts :326-335 | 325 `export function receipts`, body 326-335 | T |
| 82 | columns in header, writer and reader ("three times") | the three named places exist; the row interfaces (Entry, Decision, Receipt) are a fourth | T by its own enumeration |
| 82 | tsv.ts append (:60) calls ensureHeader, which can rewrite the file (:55-57) | 60-62, 55-57 | T |
| 82 | decisions and costs wrap it in withLock; ledger.record and verification.record do not | decisions.ts:53; costs.ts:754 withLock around 846 `append(store.costs, HEADER, values)` | T |
| 82 | costs.ts:907 reads ledger.tsv with readRecords directly | 907 | T |

The weaker-floor claim live (`fork81`):
```
$ mstack decide --phase spec --decision "ab" --why "<41 chars>" --evidence "<44 chars>" --result "take x now ok" --resolves fork
mstack: resolving a fork needs --decision to say something; got 2 characters, and a token is not an answer
exit 2
# the same row hand-appended to decisions.tsv, decision_resolved pointed at it, item moved to spec_ready
$ mstack gate
[ok]    1 open item(s) with a decision fork, each answered or still in specifying
```

### Claims in what B2 filed, against its copy of template-hard

| Item | Claim | Check | Result |
|---|---|---|---|
| 1 | domain/pricing.py:65-96 (build_quote/price_line) | 65 `def unit_price`, 74 `def price_line`, 81 `def build_quote`, 96 return | T |
| 1 | domain/invoice.py:46-71 (_invoice_unit_price/build_invoice) | 46 `def _invoice_unit_price`, 57 `def build_invoice`, 71 return | T |
| 1 | each chooses the unit price, applies the discount, splits tax | pricing 71/77/91; invoice 51-53/67/68 | T |
| 1 | the invoice copy compares breaks with qty, not units | invoice.py:52 `if qty >= min_units` vs catalog.py:45 `if units >= min_units` | T |
| 1 | 2-box line, 6-unit box, 12-unit break: quote 80, invoice 100 | `python3 -I probes/b2_pricing.py b2`: `quote unit 80 net 960` / `invoice unit 100 net 1200` | T |
| 2 | StockLevel.reserved in StockBook and State.reservations are separate | stock.py:9 `class StockLevel`, 11 `reserved`; state.py:29 `reservations` | T |
| 2 | ordering.py updates both in confirm (69-70), cancel (83-84), ship (113-118) | as read | T |
| 2 | codec.py:66,124 persists them separately | 61 reserved counts, 66 reservations encoded, 124 decoded | T |
| 3 | 6 ctx.record sites: inventory.py:28,33,38 and ordering.py:69,83,113 | `rg -n "\.record\(" stockroom` gives exactly these 6 | T |
| 3 | StockBook mutations return Movements | stock.py:83, 99, 110, 132, 139, 148 `return [Movement(` | T |
| 4 | uom from box_size at cli.py:148 and app/service.py:190 | both `uom = "box" if ... > 1 else "each"` | T |
| 4 | MIN_UNITS=PRICE parsed at cli.py:144 and adapters/csv_catalog.py:57 | both `partition("=")` with the same error text | T |

Every count, file, line and function in the six items these two runs filed holds. The check before filing did its job on this wording, n=1 per codebase.

## Probe C: the small fixes

- **`deep-modules.md:5-7`**: "When judging or designing a change, apply them to that change and to nothing else: do not go looking for more to redesign." The rule is now scoped to judging or designing a change, so the playbook, which looks for candidates, is no longer forbidden. There is still no procedure: no steps, nothing spawns, explores or asks. The only imperatives are "Use these words exactly", the per-category test advice and "delete them" (`:39-40`).
- **"Shallow" is defined once.** `rg -n -i shallow` finds the definition at `deep-modules.md:14-15`. The other matches are `SKILL.md:51` "As [deep modules] defines it", `deepen.md:22` "looks shallow" and `deep-modules.md:40` "shallow modules", which use the word without redefining it.
- **The origin header now lists `codebase-design/SKILL.md and DEEPENING.md`.** Against `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/engineering/codebase-design/`, the dependency categories (`DEEPENING.md:9-25`), the seam discipline (`:29`) and replace-don't-layer (`:34-35`) are used. Nothing from `DESIGN-IT-TWICE.md` (process, sub-agents, compare) is used. Correct.
- **Lint at head** in a clone (`lintclone`, c6041be):
  ```
  PASSED - 0 failures, 0 warnings
  == header removed from skills/design/references/deep-modules.md
  [fail]  skills/design/references/deep-modules.md: no origin header
  FAILED - 1 failure, 0 warnings
  exit 1
  == header removed from skills/router/playbooks/deepen.md
  [fail]  skills/router/playbooks/deepen.md: no origin header
  FAILED - 1 failure, 0 warnings
  exit 1
  == restored
  PASSED - 0 failures, 0 warnings
  ```
- **`deepen.md` step 2** names `general-purpose` agents, "which can write files; Explore agents cannot". In this harness Explore has no Write or Edit, and general-purpose has all tools. Both appear in the headless init event (`agents: ['claude', 'Explore', 'general-purpose', 'mstack:implementer', ...]`). The fallback "findings in its reply if the write is refused" covers auto mode refusing a subagent Write. No reader ran in my runs.
- **Same-day rule** (`:49-50`): "a second run that day appends under a new heading". B1 did exactly that.
- **Intake line** (`:10`): B1 printed it, B2 did not (n=1 each).
- **Length:** `wc -l` gives 56.
- **Contradictions:** none found. The router's skip list (`SKILL.md:25-27`, "deepening (the playbook files its own items). Say which in one line (`skip: <reason>`)") agrees with `deepen.md:10`. `intake.md` (lines 34, 50, 66, 76) has nothing a deepen item contradicts: deepen files no fork. `investigate.md:8-10` sends readers without naming a type, which is outside the diff. The deletion test in `deepen.md:22-24` matches `deep-modules.md:24-25` word for word in substance.
- **No em or en dashes** in the three files: `rg -n "—|–"` on them prints nothing, and on the added lines of the diff it exits 1.

## Probe D: regression at head (no live run going)

```
$ npm test
 592 pass   0 fail   Ran 592 tests across 27 files. [103.23s]        (bun)
 ℹ tests 592  ℹ pass 592  ℹ fail 0                                    (node)
npm test  98.82s user 111.02s system 155% cpu 2:14.66 total; exit 0
$ npm run typecheck        -> exit 0
$ ./bin/mstack lint-plugin . -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate         -> PASSED - 0 failures, 0 warnings (80 items)
$ ./bin/mstack ledger check deep-module-vocabulary
FAIL no verdict at c6041be0; 3 row(s) exist at other SHAs and a new head SHA voids them
```
The load-sensitive tests (item 67) were green on the first run, so I drew nothing from them.

The store's `verify` is `npm test && npm run typecheck && bin/mstack lint-plugin .`. `gate --full` writes `verification.tsv`, so I ran it in the `lintclone` at c6041be, not against the real store. The first attempt failed at typecheck because the clone had no `node_modules` (`Entry point of type library 'node' specified in compilerOptions`), which is an environment problem. With `node_modules` symlinked from this checkout, then removed:
```
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 2 warnings      (on feat/deep-module-vocabulary: the clone's default branch; 1 uncommitted: the symlink)
exit 0
```

## Probe E: the three further candidates (for the coordinator; not part of the verdict)

| Candidate | Claim | Check | Result | Open item covering it |
|---|---|---|---|---|
| cliopts half adopted | 9 raw `parseArgs` in 7 handlers vs 4 `parseFlags` | `rg -n "parseArgs\(\|parseFlags\(" src`: raw at cli.ts:114, 181, 186, 806, 826, 959, 974, 997, 1024 (cmdFanout, cmdSetup, cmdGate, cmdLedger x2, cmdWorktree x2, cmdMergeGate, cmdCost = 7 handlers); parseFlags at 428, 440, 488, 857 | T | none (68 only pins that `state --help` writes nothing) |
| | `ledger record --help` exits 2 | `mstack: ledger record needs <target> <sha> <verdict>`, exit 2 | T | |
| | `worktree new x --base -foo` prints node's raw error | `mstack: Option '--base' argument is ambiguous. Did you forget to specify the option argument for '--base'? ...`, exit 2 | T (prefixed with `mstack:`) | |
| | `state set --help` exits 0 | prints `mstack state set <ref> [flags]`, exit 0 | T | |
| verification question answered in three places | gate.ts:607-611 mirrors closing.ts:49-50 | gate 607 `obligations(state, active)`, 608 `headSha(store)`; closing 49 `verification.obligations(...)`, 50 `headSha(store)` | T | none (42 and 71 touch neighbours, not this) |
| | headSha again at closing.ts:101 | 101 `const sha = headSha(store);` | T | |
| | verification.ts:389-391 recomputes obligations | 391 `const required = obligations(state, item);` (389 is the tree default) | T | |
| | gate.ts:19 imports verificationStatus, never used | `rg -n verificationStatus src` gives only `src/gate.ts:19` | T | |
| report filename grammar has no builder | built at fanout.ts:102 | 101-102 `${kind}_${item.slug}_${suffix}.md` | T | partly adjacent to 43 (fanout `--solo` allocates `review_<slug>_r<N>.md`, roundOf rules) and 41 (reads the highest-round impl report); neither proposes one builder |
| | matched at roles.ts:44-58, parsed at 74, regex at 175-195 | reportFiles 44-56, roundOf 74-80, citesImplementingReport 175-185 | T (ranges loose) | |
| | hand-spelled at hooks.ts:202, 205, 246 | 202 `${kind}_${item.slug}.md`, 205 `..._<lens>.md`, 246 `..._r<N>.md` | T | |
| | "126 test lines" | `rg -n 'review_[^ ]*\.md' tests` gives 127; adding `impl_` gives 217 and `spec_` 223 | roughly T for review names only; the count depends on the pattern | |

## Per criterion

| Criterion | Verdict | Evidence | Rung |
|---|---|---|---|
| "the design skill references the vendored vocabulary, and the reviewer has it as a lens, with origin headers" | Met, not undone | Round 2 touches only `skills/design/SKILL.md:51` (the link stays), `deep-modules.md` and `deepen.md`. `agents/reviewer.md:40-45` and `skills/review/SKILL.md:29-30` are unchanged in `git diff bfe37e2..c6041be`. The trimmed header is correct against the source, and lint passes and fails as it should (Probe C) | 4 (lint run); the lens live run from round 1 was not re-run because its files did not change |
| "a request such as '/mstack review the architecture' routes to a playbook that ends with candidates filed as pending items, each naming files, the deepening and its test surface, and asks the user nothing" | Met | B1 and B2 on the final wording route to deepen and file 2 and 4 pending items, each with files and the deepening in the description, observable criteria and a seam. No question, nothing outside `.mstack/` changed in either project, and every claim holds | 5 (headless runs with the plugin, n=1 per codebase) |
| "that playbook run on this repository files its candidates, pasted in the report" | **Not met** | Items 76 to 80 are filed and pasted. 77, 78, 79 and 80 each still state something false about the code (Changes required 1-4) | 4 to 5 (real CLI and a throwaway store for 77, 79 and 80; rg for 78) |
