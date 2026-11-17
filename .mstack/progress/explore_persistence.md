# Persistence layer: where it wants to be deeper

Scope: src/tsv.ts, ledger.ts, state.ts, decisions.ts, costs.ts, hooklog.ts, paths.ts and their tests. Vocabulary from skills/design/references/deep-modules.md. Callers outside the area were grepped, not analysed.

## Findings

### 1. There is no "durable file" module: the concurrency policy is re-decided at every call site (highest value)

tsv.ts has `withLock` (tsv.ts:52 in the numbered source; about 160 lines of lock, stale-break and guard logic), but whether a write takes it is each caller's choice. Four write disciplines exist for the same store directory:

| Writer | Lock? | Atomic? | Evidence |
|---|---|---|---|
| decisions.add | yes (`withLock` around uniqueness check + append) | append | decisions.ts:53-69 |
| ledger.record | **no** | append | ledger.ts:135, `append` called bare |
| verification.record | **no** (comment admits it) | append | verification.ts:36-37, :314 |
| tsv.ensureHeader widening | no | **no** (`writeFileSync` over the whole file) | tsv.ts:~13 of the filtered listing; `ensureHeader` rewrites header+rest in place |
| state updateState | yes + tmp/rename | yes | state.ts:288-329 |
| costs appendLine | yes, append | append | costs.ts:285-287 |
| costs.prune | yes + tmp/rename with fixed name `${file}.tmp` | yes | costs.ts:425, 450-451 |
| costs.flushSession | two nested locks, then `append` per row (re-takes nothing, relies on outer `store.costs` lock) | append | costs.ts:754-764, 846, 853 |
| hooklog trim | no lock, tmp/rename `${log}.${pid}.tmp` | yes | hooklog.ts:75-85 |

Three separate tmp-then-rename implementations (state.ts:308-329 with `STATE_TMP_PREFIX` and a counter, costs.ts:449-451, hooklog.ts:79-82), each with a different tmp name scheme and different cleanup; only state.ts cleans up on failure and turns errors into `UserError`. `withLock` call sites: 6 (state.ts:289, decisions.ts:53, costs.ts:287, 425, 754, 764). Bare `append` sites: ledger.ts:135, verification.ts:314, costs.ts:846.

Interface cost: a caller has to know the lock is not re-entrant (state.ts:286, costs.ts:761-763 works around it by hand-inlining `appendFileSync`), that a check-then-write needs the lock (decisions.ts:50-52), and that `append` calls `ensureHeader` which is itself a check-then-write window (verification.ts:36-41 documents leaving it open for ledger and verification). The ledger is the file the gate trusts, and it is the unlocked one. No ledger test exercises concurrent `record` (ledger.test.ts has no concurrency case; decisions.test.ts:489-512 and state.test.ts:124 do for their stores).

Deepening: one module owning "a durable store file" (lock, header widening, append, atomic rewrite, tmp naming and sweep), so the locking decision is made once and a new store cannot forget it. Dependency category: local-substitutable (real tmpdir filesystem is the stand-in; lock-holder/probe processes become tests of this one interface).

Deletion test on `withLock` itself: complexity reappears in 6 callers, so it earns its keep as a module. The finding is about what is missing around it, not about it.

### 2. A "TSV table store" is hand-assembled four times: field list written four times per file

For each of ledger, decisions (and verification, costs) the same field list appears as interface, HEADER, positional append array, and read-back mapping with `?? ""`:
- ledger: Entry ledger.ts:43, HEADER :37, append array :135-142, `entries` mapping :146-157
- decisions: Decision decisions.ts:12, HEADER :10, append array :59-67, `all` mapping :72-81
- verification.ts:314 / :326 and costs.ts:58 (HEADER), :846 / :879 repeat the shape.
Adding a column (the one schema change tsv.ts supports, tsv.ts ensureHeader doc) means editing four places per store plus `setup.ts:149-153` which calls `ensureHeader` with each store's HEADER (3 call sites) so the header lives in setup too. Positional arrays mean reordering HEADER silently misaligns the row; nothing checks that the array matches the header. `readRecords` returns `Record<string,string>` so every consumer re-types it (costs.ts:907 and costs.ts:879 read ledger/costs rows with string keys, costs.ts:907 reaching into the ledger's file format directly instead of calling `ledger.entries`).

Deepening: a record-typed table module (header and row <-> object defined once, append and read through it). Dependency category: in-process (pure formatting) layered over the file module of finding 1. Merge `cell`/`row`/`read`/`readRecords`/`append` behind it; the callers' own mapping code disappears.

Shallow pieces: `row` (tsv.ts:31-33, one-line map/join) and `read` + `readRecords` as two exports over one parse. Deletion test: `row` is called only by `append` (the formula guard in `cell` is the real content, and tsv.test.ts:12-31 tests `cell`/`row` separately). Folding them in loses nothing; they are shallow on their own.

### 3. costs.ts reads another module's file format (ledger) and re-implements git-dir discovery that hooklog.ts also has

- costs.ts:906-907 `verifierFailed` does `readRecords(store.ledger).filter(r => r["target"] === slug && r["verdict"] === "verifier-failed")`, bypassing `ledger.entries` and `isVerdict`. The knowledge "verifier-failed is a rejection" also lives in ledger.ts:202 (`isRejection`). Two places, one fact.
- `.git` walk-up with `gitdir:` file parsing exists twice: costs.ts:158-187 (`marksDir`, walks, parses `gitdir:`, falls back to a `git rev-parse` spawn) and hooklog.ts:112-135 (`gitCommonDir`, walks, parses `gitdir:`, follows `commondir`). paths.ts:186-200 (`repoIdentity`) asks git for the common dir via a spawn a third time. Three answers to "where is this repo's git dir", each with different handling of GIT_DIR (only costs.ts:162-164 honours it) and different error policy (costs calls `hooklog.tolerateAbsence`, hooklog swallows). costs.test.ts:167,176,997-998 pins costs' walk against `git rev-parse` because the two can disagree.
- Deepening: one "where does git keep state for this checkout" answer, used by costs marks and the hook log exclude. Dependency category: local-substitutable (a temp git repo is the stand-in; costs.test.ts already builds those).

### 4. costs.ts is five modules in one file; understanding it means scrolling, not bouncing

951 lines holding: the marks journal (jsonl read/append/prune, costs.ts:194-287, 422-455), hook handlers (onStop/onSessionStart/onSessionEnd 332-399), transcript scanning (eachLine/scanTranscript/firstTimestamp 477-627), flush into costs.tsv (664-860), and summarising and rendering (877-950). It also imports `parseState` just to learn the active slug (costs.ts:317-319), a fifth reimplementation of "the active item" (finding 5). The test file is 1158 lines and reaches past the interface: it calls `readSessions`, `flushSession`, `prune`, `marksDir` and builds the marks path by hand (costs.test.ts:110-123, 937-982) because the journal has no seam of its own; `prune(file, beforeLock)` takes a test-only callback (costs.ts:422-423, 947) to inject a race. A test hook in the production interface says the shape is wrong. Deepening: carve the marks journal (session marks + flushed totals + pruning) into its own module whose interface is "record, settle, forget"; the transcript scan is in-process and merges behind flush. Category for journal: local-substitutable.
Caveat: this is the least churned of the area per the brief; the cost is size and test reach, not repeated bugs.

### 5. "The active item" has five spellings; `activeItem` is bypassed

`state.activeItem(store)` exists (state.ts:354-360, tolerant of a broken store) but the same expression is written out at: cli.ts:410, cli.ts:1009, hooks.ts:109, costs.ts:319 (all `parseState(...).items.find(i => isActive(i.status))`), plus statusline.ts:103/328 and gate.ts:222,602,659 (those already hold a parsed State, so partly legitimate). Four call sites differ only in whether they swallow a parse failure, and which does is decided by try/catch around them (hooks.ts:109 inside its own try, costs.ts:317-319 inside another). Interface cost is the error mode: a caller must know whether to use the tolerant or the throwing form. Deepening is small: make the tolerant/strict choice one name. Category: in-process.

### 6. state.ts: parse and write halves each re-derive the file's shape; unknown-key preservation forces a second parse

- `updateState` reads the file twice per write: `parseState(file)` (state.ts:290, one read+parse) then `JSON.parse(readFileSync(file))` again (292) only to recover keys parseState discarded. `rawItem` (245-249) is a third reader for the same purpose, called from cli.ts:433 after a separate `parseState` at cli.ts:429, so `state show` parses twice. The known-key sets (233-238) duplicate the field list of Item/State and parseItem's per-field assignments (207-221); adding an item field means editing Item (8), parseItem (171-223), KNOWN_ITEM_KEYS (235-238) and, if it is a rule, KNOWN_RULE_KEYS. Missing one silently drops or leaks data. Deepening: make the loaded state carry its own unknown keys so write-back needs no re-read. Category: in-process.
- cli.ts calls `assertWritable`/`assertUniqueId` at the call sites (cli.ts:26 import; used inside `updateState` callbacks at 445, 489, 929) rather than `updateState` enforcing "refuse to write what you would refuse to read" itself. state.ts:60-68 states exactly that rule in prose, but the writer does not apply it. Three callers must remember. Call sites of `updateState`: 4 (cli.ts:445, 489, 929 + one more path via decide). Deepening: validate inside the write path (parse-on-write). Category: in-process.

### 7. Tests forced past the interface

- state.test.ts:141 hardcodes the lock file name `state.json.lock`, :210-211 the tmp names `state.json.tmp-1-0` and `state.json.tmp`, and :124 uses external holder scripts (state-holder.ts, state-bigwriter.ts). The tests know the lock and tmp naming conventions because there is no interface for "is this store busy" or "sweep leftovers". decisions.test.ts:512 also asserts `${decisions}.lock` is gone.
- tsv.test.ts:120-537 (about 20 lock tests, 550 lines) test `withLock` through two helper processes (lock-holder.ts 37 lines, lock-probe.ts 14 lines) and a `step` callback (tsv.ts LockStep/`options.step`) that exists only so tests can pause the implementation at four points. Those hooks are in the production interface for test use. This is the right test surface for the locking module (it crosses the real seam, a process boundary), but the hook shows the lock is a module being tested alone while its users test it again incidentally (decisions.test.ts:489-512, state.test.ts:124-146).
- decisions.test.ts:10,550 imports `ensureHeader` directly and costs.test.ts:26,108 uses `readRecords` for assertions: tests of high-level modules reach into the tsv primitives. With a record-typed interface (finding 2) they would assert through it.
- helpers.ts `sandbox()` (helpers.ts:29) is the shared setup and `item()`/`state()` (164-190) build state.json shapes by hand as raw JSON, not through `updateState`, so tests write the file format directly and the parse/write pair is never exercised together by fixtures. Fine for malformed-input tests, wasteful for ordinary ones.
- ledger.test.ts is 539 lines for a module whose 15 `git`/commit setups (grep count 15) re-create repositories; verdict-reader.test.ts imports `runGate` from gate.ts to test `readVerdict`, i.e. the reader is tested through its caller.

### 8. paths.ts is three modules under one name (locality)

paths.ts:16-72 (Store layout), 99-146 (is this the mstack checkout), 148-280 (repo identity and CLI provenance, 130 lines with a doc comment about benchmarks), 282-300 (`UserError`, `requireStore`). `tsv.ts` imports `UserError` from paths.ts (tsv.ts:5) and paths.ts is imported by every persistence module, so the lowest layer depends on a module that also spawns git and compares source trees. Understanding "where do files live" does not need provenance, but they change together in the file list. This is a cohesion issue rather than depth; `UserError` as a one-class home for exit-code semantics is fine on its own. Low priority.

## Earns its keep (looks shallow, passes the deletion test)

- `cell` (tsv.ts:24-29): 5 lines, but removing it re-spreads the spreadsheet formula guard and tab/newline stripping across every writer; it is the injection defence. Keep the behaviour (`row` is the shallow part, finding 2).
- `storeAt` / `Store` (paths.ts:16-72): a record of path strings, nearly zero logic, but deleting it makes every module re-join `.mstack/...` names (about 10 callers) and the tests reach for the same strings. The seam is the path set; tests build stores through it (helpers.ts sandbox). Keep.
- `findItem` (state.ts:339-345): 6 lines, but its doc records a real wrong-item bug (`parseInt("2fa-login")`); deleting it reintroduces that at each of its callers (cli `state set`, `decide --resolves`).
- `assertUniqueId` / `assertWritable` (state.ts:69-92): small, but they hold invariants that would be copied per writer (see finding 6 for where they should live, not whether).
- `decisions.freeTimestamp` + `add` under lock (decisions.ts:40-70): one critical section hiding a real concurrency fix; deletion spreads the race to every `decide` caller. Deep relative to its interface (one `add`).
- `appendHookError` (hooklog.ts:56-73): one function hides statSync guard, O_APPEND write, git-exclude registration and trim, behind "never throws". Interface is minimal; exceptions are the point. The internal duplication with costs (finding 3) is its flaw, not its depth.
- `ledger.record` validation (ledger.ts:105-134): long, but callers (CLI, gate paths) get one call that refuses unreal SHAs and empty evidence. Deep. The missing lock is the finding, not the module.
- `withLock`'s `step` hook and stale-break machinery: complex but a single interface hiding a hard cross-process problem; 6 callers; the tests at tsv.test.ts cross the real seam (processes). Keep.

## Open questions

1. Is the unlocked `ledger.record` deliberate? verification.ts:36-41 argues consistency with ledger and says losing a row is fail-closed there, but a lost ledger row loses a verdict the gate relies on. Does the ledger need the same guarantee as `decisions.add`? (Churn in tsv/ledger/state suggests the locks were added file by file as races were found.)
2. `ensureHeader`'s header widening rewrites the whole file non-atomically (tsv.ts, `ensureHeader`): is a crash mid-widen reachable (costs.tsv is committed and written from hooks), and is there a test? tsv.test.ts has none for widening; decisions.test.ts:522-551 covers the result, not the interruption.
3. Does anything outside src/costs.ts need `readSessions`/`flushSession`/`prune` exported, or are the exports only for costs.test.ts (costs.ts exports; grep outside costs found only hooks.ts using the handlers)? If tests only, finding 4's journal module would remove them from the public surface.
4. Is `rules.record_costs` plus `parseState` in the Stop hook path (costs.ts:317-319) the reason costs imports state, or would a smaller question ("is recording on, and which item") be better answered by state itself?
5. Should the three hand-rolled atomic-rewrite sites share one tmp naming scheme and sweep (state.ts:270 documents a "later sweep" that I did not find implemented)?
