# Review - state-json-loses-concurrent-writes

**Verdict:** CHANGES_REQUESTED

Round 1, reviewed alone, at head `ee2ad50` (last code change `454a02a`). Diff reviewed:
`git diff dce98cb...HEAD -- src tests` (`-w` for `src/cli.ts`). Scratch work lived under
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review53/`.

One blocker: the temp-file write at `src/state.ts:274` ignores how many bytes it wrote. A short
write gets renamed over `state.json`, the command exits 0, and the store is left truncated. It is
reproduced with the real CLI below. Everything else the item claims held when I ran it, on both
runtimes and under load.

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| A1 twelve concurrent adds, twelve items, twelve ids | `tests/state.test.ts:56` (red at `f2f944d`), `:82` (mixed add/set/decide) | red on unmodified code: I ran `f2f944d`'s test against a `git archive dce98cb` copy and got `12 writers exited 0 and 7 item(s) are on disk`, node and bun both fail. Green at head. Killed by M1 and M3. |
| A2 temp file in same dir renamed over target | `tests/state.test.ts:151` (inode, open reader), `:172` (hard link), `:202` (leftover) | killed by M2 and M7. "Same directory" is not pinned (M16 survives). The short write is not covered at all (blocker). |
| A3 lock across read and write for every writer | `tests/state.test.ts:109` (queued writer works on the holder's write), `:134` (live holder past the timeout), `:82` | killed by M1, M3 and M13. The writer inventory and the check-then-act probes are below. |
| A4 unknown keys survive | `tests/state.test.ts:221`, `:240` | killed by M4, M5 and M6. Also checked through the real CLI (below). |

## Acceptance, quoted

**"twelve concurrent state add calls against one store leave twelve items on disk with twelve distinct ids; a test with real concurrent processes shows it and fails on unmodified code"**
Met (rung 4 and 5). `tests/state.test.ts:56` spawns 12 real `bin/mstack state add` processes
together (`together()`, `:34`) and asserts 12 exit 0, 12 slugs and 12 ids. I ran the `f2f944d`
version against `dce98cb` code: it fails on node and bun (`7 item(s) are on disk`). On the
original surface in a throwaway store, head gives: 12 → `exit0=12 items 12 ids 12`, 40 → 40/40/40,
60 → 60/60/60, 100 → 100/100/100. The node runtime (`node --experimental-strip-types src/cli.ts`)
gives 12/12 and 40/40. The base CLI on the same script: 12 → `exit0=12 items 7`, 40 → `exit0=40 items 32`.

**"a process killed mid-write cannot leave a truncated state.json: the write goes to a temporary file in the same directory and is renamed over the target"**
The kill case is met (rung 5). I preloaded a `renameSync` that parks the real CLI after the temp
file is fully written (`probes/stop-before-rename.mjs`), then SIGKILLed it. Target sha and inode
were unchanged and `state list` was fine. The leftovers were `state.json.lock` (43 bytes, dead
owner) and `state.json.tmp-94916-0` (20460 bytes). The next `state set` exited 0 and broke the
dead lock. The gate passed, with "2 uncommitted change(s)" as a warning, and `git status` listed
`?? .mstack/state.json.tmp-94916-0`. That leftover is item 66's.
Through the real CLI (bun and node launch) the inode changes and a reader that already had the
file open still reads the complete old content.
**Not met in the failure path.** `src/state.ts:274` calls `writeSync(fd, text)` once and ignores the
byte count. A short write is renamed over the target. See Changes required 1.

**"every read-modify-write of state.json (state add, state set, decide --resolves and any other saveState caller) holds the lock across the read and the write"**
Met for every `saveState` caller (rung 4). `saveState` has no definition, export or caller left
(`rg saveState src tests` is empty). `src/tsv.ts` and `src/paths.ts` are untouched (0 diff lines).
The state.json writers I found:

| Writer | Where | Inside the lock? | Atomic? | Decision taken on |
|---|---|---|---|---|
| `updateState` → `writeAtomically` | `src/state.ts:249-290` | yes, `withLock(file)` at `:250` | temp + rename, but the short write is unchecked (`:274`) | parse under the lock (`:251`) |
| `state add` | `src/cli.ts:365` | yes, via `updateState` | as above | id and slug uniqueness judged inside the lock |
| `state set` | `src/cli.ts:426` | yes, via `updateState` | as above | transition, fork gate, closing checks and `--decision-required` gate judged inside the lock |
| `decide --resolves` pointer | `src/cli.ts:857` | yes, via `updateState` | as above | the fork's existence is judged on an unlocked read at `src/cli.ts:795`; the locked closure only re-finds the item (`:858`). See the notes. |
| `setup` (state.json missing, or `--force` with 0 items or unreadable) | `src/setup.ts:131,141,168` | **no**, `writeFileSync` in place | no | an item count read at `:131` outside any lock. Not a `saveState` caller. Note 6. |
| readers only: `state list/active` `cli.ts:324,334`, `ledger record` default target `cli.ts:937`, `cost` `cli.ts:965`, gate `gate.ts:96`, statusline `statusline.ts:95,318`, costs `costs.ts:313`, PostToolUse `hooks.ts:133`, `activeItem` `state.ts:318` | | no lock, read only | | |

Check-then-act probes against the real CLI, 25 rounds each at head and 15 on base (`race.mjs`):
- pending item, concurrent `--status in_progress` and `--status specifying`. Head:
  `{"exits=2,0 status=specifying":12,"exits=0,2 status=in_progress":13}`, so exactly one wins
  every time. Base: in at least one round the file was **invalid JSON** after the race (my probe crashed parsing it).
- specifying item, concurrent `--status spec_ready` and `--decision-required ...`. Head: exactly
  one wins (14/11). Base: invalid JSON again (the probe crashed the same way).
- two concurrent `state add --slug dup`. Head: one exit 0 and one exit 2, 1 item, in 25/25
  rounds. Base: both exit 0 in 13/15.
- four concurrent edits of one item (title, description, status, add-acceptance). Head: all four
  land in 25/25. Base: 7 different lossy outcomes.
- two different pending items, both to `in_progress` at once. Head: both exit 0 and two items are
  active, 25/25. **Pre-existing, not a concurrency defect**: run one after the other, both still
  exit 0, and only the gate fails (`[fail] 2 items are active in this worktree`). `state set` has
  never enforced the one-active rule; concurrency does not make it worse.
- readers during 40 writers (each with a 4 KB description). Head: 456 direct reads, 0 torn, 40
  items. Base: 261 reads, 2 torn, 31 items.

**"a key the CLI does not know survives a state set instead of being dropped, or dropping it is refused with a message naming the key"**
Met (rung 5). I put `x_team` (an object) on the state, `x_rule` inside `rules` and `x_owner` /
`x_labels` on items, then ran `state set a`, `state set b`, `state add c`, `decide --resolves b`
and `state set a --clear description`. All keys came through with their values. `--clear` still
removed `description`. Key order: an unknown key moves to the end of its object on the first
write, a one-time diff. A second write changed one line (`"title": "A2"` → `"A3"`).

## Verification I ran
```
$ ./bin/mstack gate                          -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full                   -> bun: 411 pass, 0 fail, 23 files (includes sandbox/)
                                                node: ℹ tests 405 ℹ pass 405 ℹ fail 0
                                                typecheck clean; lint-plugin PASSED; gate PASSED - 0 failures, 0 warnings
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
                                             -> ℹ tests 405 ℹ pass 405 ℹ fail 0
$ bun test ./tests                           -> 405 pass 0 fail, Ran 405 tests across 21 files
```
Failure paths, real CLI:
```
invalid JSON state.json: state add exit=2 "...state.json is not valid JSON: ..."; state set exit=2; file untouched; 0 leftovers
read-only .mstack (555): state set exit=2 in ~50 ms "cannot create the lock .../state.json.lock: EACCES"; state add exit=2; file untouched
live holder of state.json.lock (tests/state-holder.ts) > 2 s:
  state list / state active / statusline / hook session-start / gate all answered, 219 ms in total, while it held the lock
  state add exit=2 "...state.json.lock is held by pid 95030 and did not let go in 2003 ms"; after release: only the holder's item, nothing half-applied
disk full, HFS+ 4 MB image:  state set exit=2 "cannot write .../state.json: ENOSPC", target intact, no temp left
disk full, APFS 8 MB image:  state set exit=2 "cannot create the lock ...: ENOSPC", target intact
file-size limit (short write), real CLI:
  $ ( ulimit -f 2; ./bin/mstack state set a --title "<3000 chars>" ); echo $?   -> 0
  $ wc -c .mstack/state.json                                                     -> 1024
  $ ./bin/mstack state list   -> mstack: .../state.json is not valid JSON: JSON Parse error: Unterminated string   (exit 2)
  $ ./bin/mstack gate         -> [fail] .../state.json is not valid JSON ...
  in-process updateState, node and bun: {"before":205,"after":1024,"threw":"no","parses":"NO: ..."}
  base CLI, same limit: exit 2 "EFBIG: file too large, write", state.json 1024 bytes (it truncated too, but it said so)
```

## Mutants
Each one was applied to a `git archive HEAD` copy, never to the repository. I ran
`tests/state.test.ts`, or the whole suite where marked, on node and bun, then restored the copy.
Kills were the same on both runtimes.

| Mutant | Edit | Killed by |
|---|---|---|
| M1 | `return withLock(file, () => {` → `return ((run: () => T) => run())(() => {` | state.test.ts:56, :82, :109, :134 |
| M2 | `renameSync(tmp, file);` → `rmSync(tmp); writeFileSync(file, text);` | :151, :172 |
| M3 | `parseState(file)` moved above `withLock` | :56, :82, :109 |
| M4 | drop `...extras(raw, KNOWN_STATE_KEYS),` | :221, :240 |
| M5 | `items: state.items.map(... extras ...)` → `items: state.items,` | :221, :240 |
| M6 | `rules: { ...state.rules, ...extras(...) }` → `rules: state.rules,` | :221 |
| M7 | temp name → `` `${basename(file)}.tmp` `` | :202 |
| M7b | temp name → `` `${basename(file)}${STATE_TMP_PREFIX}fixed` `` | **survived** (a leftover then fails the next write once with EEXIST; see note 2) |
| M8 | drop `rmSync(tmp, { force: true })` in the catch | **survived** (no test fails a write after the temp exists) |
| M9 | `openSync(tmp, "wx")` → `"w"` | **survived**, equivalent (and it would fix note 2) |
| M10 | drop `if (error instanceof UserError) throw error;` (`:285`) | **survived**, equivalent: nothing in the `try` throws a UserError, so the line is dead |
| M11 | drop `decision_resolved` from `KNOWN_ITEM_KEYS` (full suite) | decisions.test.ts:252, :334 |
| M12 | drop `description` from `KNOWN_ITEM_KEYS` (full suite) | cli.test.ts:105, :187, :347 |
| M13 | `decide`: write the stale pre-row `state` under the lock (`fresh.items.splice(0, fresh.items.length, ...state.items)`) (full suite) | state.test.ts:82 (a concurrency kill, so probabilistic; one run each) |
| M14 | drop `rules` from `KNOWN_STATE_KEYS` (full suite) | **survived**, equivalent: no CLI path changes rules |
| M15 | re-read `raw` before `change(state)` | **survived**, equivalent under the lock |
| M16 | temp file in another directory on the same filesystem | **survived**: the "same directory" half of A2 is not pinned |
| M17 | last duplicate id wins in `rawItems` | **survived**, equivalent unless ids are duplicated, which the gate rejects |
| (gap) | short write at `:274` | no test. This is the blocker. |

## Load runs
- `tests/state.test.ts` run alone: 30 times on node, **0 failures**; 30 times on bun, **0 failures**.
- Two rounds, each with four full `bun test ./tests` suites, two full node suites, and five
  `state.test.ts` runs per runtime beside them, all at once:
  - `state.test.ts`, standalone or inside a full suite: **0 failures** in 20 standalone runs and
    12 full suites.
  - Known item-67 tests: `tests/costs.test.ts:698` failed 1 of 12 suites (node, round 1) and
    `tests/run.test.ts:54` failed 2 of 12 (bun, round 2). Nothing else failed.
- Not one `tests/state.test.ts` failure on unmutated code across 30+30 alone, 20 standalone
  under load, and 15 full suites (3 plain, 12 under load).

## Changes required
1. `src/state.ts:274`: `writeSync(fd, text)` writes once and ignores the count it returns. POSIX
   lets `write(2)` return short "at the physical end of a medium" or at the process file-size
   limit. Here the temp file then holds part of the JSON, `renameSync` at `:278` puts it over
   `state.json`, and the command exits 0.
   - I reproduced it with the real CLI under `ulimit -f 2`: exit 0, a 1024-byte `state.json`,
     then every command, the gate and the hooks fail on "not valid JSON". This is the outcome the
     temp-and-rename design exists to rule out, and the old code at least exited 2.
   - Disk-full short writes did not happen on this Mac: the HFS+ and APFS images returned ENOSPC
     and the target stayed intact. On filesystems that return short writes at ENOSPC (Linux, for
     one) this is rung 3: argued, not run.
   - Fix: write through `writeFileSync(fd, text)`, which loops and throws on the follow-up write,
     or compare the count with `Buffer.byteLength(text)` and throw. I checked the `writeFileSync`
     version in a scratch copy on node and bun: `cannot write .../state.json: EFBIG`, target
     unchanged at 205 bytes and still parses.
   - Pin it with a test that runs `updateState` in a child under `sh -c 'ulimit -f 2; exec <runtime> <script>'`
     and asserts a UserError and an unchanged target. That fails on the current line.

## Non-blocking notes
1. **`decide --resolves` window** (`src/cli.ts:795` vs `:857-861`). I made it repeatable: a live
   pid holds `decisions.tsv.lock`, `decide` validates and waits, `state set` changes the fork, then
   the lock is released (`decide-race.sh`).
   - **Fork rewritten in between.** Head: the item ends up with fork B and a pointer to the row
     written for A, the gate reports it answered, and `--status spec_ready` exits 0. That is the
     same outcome as running `state set` and then `decide` one after the other, because `decide`
     never records which question it answers, so it is linearizable and not a concurrency defect.
     Base lost the `state set` write (fork A came back, exit 0), so head is better.
   - **Fork cleared in between.** Head: `decision_resolved` lands on an item with no fork and
     `decide` prints "no longer has an open fork". No serial order gives that. It does nothing
     harmful: the gate only looks at items carrying a fork (`gate.ts:248-250`), and attaching a
     fork later drops the pointer (`cli.ts:687-690`).
   - **State lock times out after the row is written.** Exit 2 naming `state.json.lock`, one row
     that resolves `x`, no pointer, fork still open. That fails safe, but the message does not say
     the row was recorded, so a retry adds a second row.
   - Cheap hardening: in the closure, refuse when `target.decision_required !== item.decision_required`,
     and say in the timeout message that the row is in.
2. **Temp-name collision on pid reuse** (`src/state.ts:270-272`, and the comment at `:228` that
   says "a leftover never blocks the next write"). A leftover `state.json.tmp-<pid>-0` from a killed
   writer fails the next write by a process with that pid: `cannot write .../state.json: EEXIST`.
   The catch then deletes the leftover and the write after that succeeds (shown in-process on node
   and bun). It is rare and loud, and nothing is lost. `"w"` instead of `"wx"` (the lock already
   serialises writers), or bumping the counter on EEXIST, removes it.
3. **Symlinked `state.json` is replaced by a regular file** (`renameSync` at `:278`). After
   `state set` the link is gone and the link's target keeps the old content. Base followed the
   link. Unusual setup, but a regression. `realpathSync(file)` before the temp and rename would
   keep it.
4. **File mode is not kept.** A `0600` `state.json` becomes `0644` (umask) after one write, and a
   `0444` file is replaced instead of refusing the write. Base kept both.
5. **Known fields with the wrong type are normalised or dropped on any write.** A `state set` on a
   different item turned `rules.one_active_item: "no"` into `true` and `version: "2"` into `1`, and
   dropped `verify: 7`, `sdd: "yes"`, `description: 42`, `closed_by: ["x"]` and
   `decision_required: 123`. Base does the same, so this is pre-existing and outside A4. A fork
   with the wrong type disappearing without a word deserves its own item.
6. **`setup` writes `state.json` outside `updateState`** (`src/setup.ts:131,141,168`). It does a
   plain `writeFileSync` with no lock, and only when the file is missing or on `--force` against
   0 items or an unreadable file. A `state add` that lands between the count at `:131` and the
   write would be lost, which is rung 3: 30 races with a fresh store each round never hit the
   microsecond window. It is a deliberate reset, not a `saveState` caller, but it is the one writer
   that does not go through "the only way `state.json` changes" (`src/state.ts:236`).
7. **`KNOWN_ITEM_KEYS` and `KNOWN_STATE_KEYS` duplicate `parseItem` and `parseState`**
   (`src/state.ts:210-215`). A field items 40 or 55 adds to `parseItem` but not to the set would be
   restored from the raw file on every write, so a `--clear` or a change to it would not stick. The
   existing CLI tests caught the version of this for `description` and `decision_resolved`
   (M11, M12). A test that parses a fully populated item and asserts every key it produces is in
   the set would catch the next one.
8. **Slow work under the lock.** `state set --status done` runs `closingProblems` → `headSha` and
   the verification tree fingerprint inside `updateState` (`src/closing.ts:45-52`). On a big repo
   that can make concurrent writers hit the 2 s timeout. They fail loudly and nothing is lost
   (rung 2, not measured).
9. **Dead line** `src/state.ts:285` (M10). `state.json` is read twice under the lock (`:251` and
   `:253`). One read feeding both `parseState` and the extras would remove the second parse, and
   with it an unguarded `JSON.parse` that fires only if a writer that ignores the lock (an older
   CLI on PATH, an editor) changes the file in between.
10. **Tests.** `tests/state.test.ts:240-256` spawns through `together()` and never calls `kill()`
    in a `finally`. It has an explicit timeout, and it awaits the child before asserting, so the
    only way a child outlives it is a hang. Every other spawning test kills its children in a
    `finally`, and `tests/state-holder.ts` gives up after 15 s on its own. No existing test was
    weakened or deleted: the diff against `dce98cb` only adds `tests/state.test.ts` (the red test is
    unchanged since `f2f944d`) and `tests/state-holder.ts`. Runtime rules hold: `src/state.ts`
    imports only `node:fs`, `node:path` and relative files, there is no `Bun.*`, and no dependency
    was added.

## Suggested follow-ups
- Make `state set --status` refuse a second active item when `rules.one_active_item` is true,
  judged inside `updateState` like the transition check. Today only the gate catches it, at once
  and one after the other alike.
- Notes 1 (re-check the fork in the closure), 2, 3 and 6 (move `setup`'s seed write to
  `writeAtomically` under the lock) fit item 66 or a small follow-up item. Note 5 needs its own item.

## Evidence ladder
- A1, the A2 kill case, the A3 races and A4: rungs 4 and 5, run through the real CLI in throwaway
  stores on this Mac (bun launcher, and the node runtime for the 12 and 40 runs and the inode
  check).
- Short-write truncation: rung 4 under `ulimit -f` (CLI and in-process, both runtimes). Disk-full
  truncation: rung 3, because HFS+ and APFS here return ENOSPC instead.
- The `setup` window and the lock-held cost of the closing checks: rung 3 and rung 2.
