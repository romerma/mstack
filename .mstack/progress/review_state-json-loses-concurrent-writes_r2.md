# Review - state-json-loses-concurrent-writes

**Verdict:** APPROVED

Round 2, reviewed alone, at head `4092af5` (last code change `4b533c8`). Diff reviewed:
`git diff 949414b...HEAD -- src tests` (round 2), against the whole change `git diff dce98cb...HEAD -- src tests`.
The round 1 report (`review_state-json-loses-concurrent-writes.md`) and the round 2 implementer report
were read as claims and checked by running. Scratch work lived under
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review53r2/`.

The round 1 blocker is fixed. `src/state.ts:274` now calls `writeFileSync(fd, text)`, which keeps writing
until every byte is out or throws. I reran round 1's reproduction with the real CLI on bun (the launcher),
bun direct and node direct. Each run exits 2 with `cannot write .../state.json: EFBIG`, `state.json` is
byte-identical and still parses, and no lock or temp file is left. Four other temp-write failures ran clean
too: a rename failure and a read-only directory (real, both runtimes), a full disk (real HFS+, both
runtimes), and close / partial-write / rename faults injected on node. The new test goes red on both
runtimes when the fix is reverted. It also now kills round 1's surviving mutant M8. `tests/state.test.ts`
did not fail once in 110 runs on unmutated code.

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| A1 twelve concurrent adds | `tests/state.test.ts:57`, `:83` | not touched in round 2. Killed by M1 on node and bun. Real CLI: 12 and 40 parallel `state add` land, both runtimes |
| A2 temp in same dir, renamed; never truncated | `:152`, `:173`, `:203`, and new `:222` | M2 killed by `:152` and `:173`. The single-`writeSync` revert (MS), M8, MQ and MR are killed by `:222` on both runtimes |
| A3 lock across read and write | `:83`, `:110`, `:135` | not touched in round 2. M1 killed by all three on both runtimes. Real-CLI races rerun (below) |
| A4 unknown keys survive | `:267`, `:286` | not touched in round 2 apart from the `finally` kill at `:302`. Real CLI `state set` keeps every key, both runtimes |

## Acceptance, quoted
For 1, 3 and 4 I relied on rerunning the tests plus one live check each. Round 1 examined them in depth,
and round 2 changed neither the lock path nor the merge code. `src/state.ts` changed its import and one line in
`writeAtomically` and lost one dead line there; `updateState` is unchanged.

**"twelve concurrent state add calls against one store leave twelve items on disk with twelve distinct ids; a test with real concurrent processes shows it and fails on unmodified code"**
Met (rungs 4 and 5). `tests/state.test.ts:57` passes on both runtimes and dies under M1 on both. Live check,
round 1's `par-add.sh` against the real CLI in throwaway stores:
```
bun launcher n=12  exit0=12 nonzero=0 items 12 ids 12 slugs 12
node         n=12  exit0=12 nonzero=0 items 12 ids 12 slugs 12
bun launcher n=40  exit0=40 nonzero=0 items 40 ids 40 slugs 40
node         n=40  exit0=40 nonzero=0 items 40 ids 40 slugs 40
lock/tmp leftovers (fd -H -I): none in any of the four stores
```
The "fails on unmodified code" half was shown in round 1 against `dce98cb`, and round 2 did not touch that
test.

**"a process killed mid-write cannot leave a truncated state.json: the write goes to a temporary file in the same directory and is renamed over the target"**
Met (rung 5), now including the failure path that blocked round 1. The write goes to
`state.json.tmp-<pid>-<n>` beside the target (`src/state.ts:270`). `writeFileSync(fd, text)` (`:274`) loops
until all bytes are written or throws. Any throw from open, write, close or rename lands in the catch
(`:279-288`), which removes the temp file and raises a `UserError`. Only the rename itself ever replaces
`state.json`. Details under A and B
below. The kill case was shown at rung 5 in round 1, and this round did not touch it. "Same directory"
is still unpinned (M16, round 1, queued).

**"every read-modify-write of state.json (state add, state set, decide --resolves and any other saveState caller) holds the lock across the read and the write"**
Met (rungs 4 and 5). `updateState` (`src/state.ts:249-267`) is unchanged since round 1. `rg saveState src tests`
is still empty. M1 is killed by `:57`, `:83`, `:110` and `:135` on both runtimes. Live check, round 1's
`race.mjs` with the real CLI (bun launcher), 15 rounds each:
```
sameitem   {"exits=0,0,0,0 title=T1 desc=D1 status=specifying acc=2":15}
transition {"exits=2,0 status=specifying":5,"exits=0,2 status=in_progress":10}
sameslug   {"exits=2,0 items=1":8,"exits=0,2 items=1":7}
```

**"a key the CLI does not know survives a state set instead of being dropped, or dropping it is refused with a message naming the key"**
Met (rungs 4 and 5). `:267` and `:286` pass on both runtimes. Live check: I put `x_team` (an object),
`rules.x_rule`, `items[0].x_owner` and `items[1].x_labels` (an array) into a real store, then ran
`state set a --title A2` and `state set b --description d`:
```
bun:  {"x_team":{"name":"core"},"x_rule":3,"x_owner":"ana","x_labels":["l",{"y":1}],"title":"A2","desc":"d"}
node: {"x_team":{"name":"core"},"x_rule":3,"x_owner":"ana","x_labels":["l",{"y":1}],"title":"A2","desc":"d"}
```

## A. The blocker, on the real surface
`repro-a.sh`: a fresh git repo, then `setup`, `state add a`, a commit and `gate`. Then
`( ulimit -f 2; exec <cli> state set a --title <3000 x> )`, then a sha256 comparison, a parse,
`fd -H -I 'lock|tmp'`, `state list` and `gate` again. The `bash` `ulimit -f 2` here caps files at 2048
bytes (1024-byte blocks); the test's `sh` caps them at 1024. Both are below the ~3.5 KB state.
```
===== launcher (bin/mstack -> bun)
state set exit=2
mstack: cannot write .../store-a-launcher/.mstack/state.json: EFBIG
        check that .../store-a-launcher/.mstack is writable
size before=472 after=472 identical=yes
parses: yes
lock/tmp leftovers: 0
  1 a (pending)  A
state list exit=0
gate after exit=0
gate output unchanged
===== bun direct (bun src/cli.ts)
state set exit=2   ... EFBIG   size before=467 after=467 identical=yes   parses: yes   lock/tmp leftovers: 0
state list exit=0   gate after exit=0   gate output unchanged
===== node direct (node --disable-warning=ExperimentalWarning --experimental-strip-types src/cli.ts)
state set exit=2   ... EFBIG   size before=468 after=468 identical=yes   parses: yes   lock/tmp leftovers: 0
state list exit=0   gate after exit=0   gate output unchanged
```
The same script against a copy with the round 1 line restored (mutant MS) shows the defect is real at the
same limit. Bun and node both gave `state set exit=0` and `after=2048 identical=NO` (before was 469 and 470), and
`SyntaxError: Unterminated string in JSON at position 2048`.

## B. Every way the temp write can end short or fail
| Failure | How | Runtimes | Exit / error | Target | Temp | Lock |
|---|---|---|---|---|---|---|
| short write, then EFBIG | `ulimit -f`, real CLI (A) | bun, node | 2, `EFBIG` | identical, parses | none | released |
| disk full during the temp write | 4 MB HFS+ image filled to 4, 8 and 12 KB free, a 20 KB title, real CLI | bun, node | 2, `ENOSPC` | identical, parses | none | released |
| rename fails | `chflags uchg .mstack/state.json`, real CLI (the rename is the only call in the write that touches `state.json` itself) | bun, node | 2, `EPERM` | identical | none | released; the retry after `nouchg` exits 0 |
| temp location unwritable | `.mstack` chmod 0555 inside `change`, after the lock is taken; in-process `updateState` | bun, node | `UserError ... EACCES` | identical, parses | none | **left** (cannot unlink in a read-only dir); the next CLI write breaks it and exits 0 |
| write error part-way | `writeFileSync` patched to write 100 bytes, then throw `EIO` | node only | `UserError ... EIO` | identical, parses | none | released |
| close fails | `closeSync` patched to throw `EIO` on the temp fd | node only | `UserError ... EIO` | identical, parses | none | released |
| rename fails | `renameSync` patched to throw `EXDEV` | node only | `UserError ... EXDEV` | identical, parses | none | released |
| open fails | `openSync` patched to throw `EIO` on the temp path | node only | `UserError ... EIO` | identical, parses | none | released |
| rename and cleanup both fail | `renameSync` throws `EXDEV`, `rmSync` throws `EBUSY` | node only | `UserError ... EXDEV` | identical, parses | **left** | released |
| fsync | not called (round 1 follow-up) | - | - | - | - | - |

The faults are injected through `fs` plus `syncBuiltinESMExports()`, which reaches `src/state.ts`'s named
imports on node. Bun does not propagate it: the probe printed `node fake:true`, `bun closeSync:false`. So on
bun only the real failures ran, and four of them did. The `cannot write ...state.json: EIO/EXDEV` messages
can only come from `writeAtomically`, so each injection did reach the code under review.
Argued, not run (rung 3):
- **A runtime killed by SIGXFSZ.** Neither runtime here receives it; both get EFBIG. Death comes before the
  rename, so the target stays untouched and the temp is left, the same as A2's kill case.
- **A short write at ENOSPC on a filesystem that returns one (Linux).** It goes through the same
  `writeFileSync` loop that ran under `ulimit`. HFS+ here may refuse the whole write rather than part of
  it, so the disk-full row does not prove a part-way write.
- **A `write(2)` that returns 0 for a non-zero count without an error.** I could not produce one, and both
  runtimes' string path is native (node's `writeFileSync` goes to `binding.writeFileUtf8`; bun prints
  `[native code]`). POSIX regular files return EFBIG or ENOSPC when no byte fits.

## C. The new test (`tests/state.test.ts:222-265`, `tests/state-bigwriter.ts`)
- Red on the reverted fix, both runtimes (mutant MS: the single `writeSync(fd, text)` and its import put back):
  `AssertionError: a write that was cut short must not report success (exit 0, signal null, said "wrote\n")`,
  node `ℹ fail 1` and bun `1 fail`. Every other test still passed.
- It has an explicit timeout, `{ timeout: 30_000 }` at `:222`. The child is killed in a `finally` (`:261-263`).
  `child` is assigned inside the Promise executor, which runs synchronously, so the `finally` always sees
  it.
- It asserts the contract, not one runtime's mechanism. `:251` requires a non-zero exit, `:252` requires no
  `wrote`, `:253` a byte-identical target and `:254` that it still parses. All four hold whether the child
  throws or dies by a signal.
- The conditional at `:257` is sound. A signal death means the process could not clean up, so it can leave
  the temp file and the lock. Those are exactly what A2's kill case leaves: round 1 showed the next writer
  breaks the dead lock, and the temp is item 66's sweep. `:253` still proves no rename happened. On this Mac the full branch runs on both runtimes: M8 (no cleanup
  in the catch) dies on `:259`, `a failed write must remove its temporary file`, on node and bun. It
  survived round 1. Non-blocking note 1 covers the one weakness.
- MQ (the catch returns instead of throwing) and MR (the write error is swallowed and the partial temp is
  renamed) also die on `:222`, on both runtimes.
- `state-bigwriter.ts` does not match `*.test.ts`, so neither runner collects it. The file count stayed at
  21, and the test count went from 405 to 406.

## D. The two notes
- `448fc54` deletes only `if (error instanceof UserError) throw error;`. The `try` it guarded
  (`src/state.ts:271-278`) holds only `openSync`, `writeFileSync`, `closeSync` and `renameSync`, imported from
  `node:fs` (`:1`). None of them can produce a `UserError`, so nothing that reaches the catch can be
  double-wrapped (rung 3; round 1's M10 survived, which is rung 4 that the line was dead). Every injected
  and real failure above surfaced as exactly one `cannot write <file>: <code>`.
- `4b533c8`: `writers` is hoisted and `writers?.kill()` is in the `finally` (`tests/state.test.ts:288`,
  `:294`, `:302`). The assertions are unchanged.

## E. Regression on round 1's ground
| Mutant | Edit | Killed by (node / bun) |
|---|---|---|
| NONE | none | 12/12 pass on both |
| MS | single `writeSync`, the round 1 line | `:222` / `:222` |
| M1 | `withLock` replaced by a direct call | `:57`, `:83`, `:110`, `:135` / the same |
| M2 | `rmSync(tmp); writeFileSync(file, text)` instead of the rename | `:152`, `:173` / the same |
| M8 | no `rmSync(tmp)` in the catch | `:222` / `:222` (survived round 1) |
| MQ | catch returns without throwing | `:222` / `:222` |
| MR | write error swallowed, partial temp renamed | `:222` / `:222` |

Every mutant was applied to a `git archive HEAD` copy in the scratch dir, never to the repository. The
12/40 adds, the races and the unknown keys are under the acceptance bullets above.

## F. Load
- `tests/state.test.ts` alone: 25 runs on node, **0 failures**; 25 on bun, **0 failures**.
- Two rounds, each starting all of this at once: four `bun test ./tests` suites, two node suites, and ten
  `tests/state.test.ts` runs per runtime.
  - `tests/state.test.ts` standalone under load: 0 of 20 node runs and 0 of 20 bun runs failed.
  - Inside the 12 suites under load (8 bun, 4 node), `tests/state.test.ts` never failed.
  - Item 67: `tests/run.test.ts:54` failed 2 of 8 bun suites, both in round 1. `tests/costs.test.ts:698`
    failed 0 of 12. Nothing else failed.
- Total on unmutated code: **0 failures** of `tests/state.test.ts` in 110 runs. That is 50 alone, 40
  standalone under load, 12 suites under load, 4 plain suites (`gate --full` bun and node, plain node,
  plain bun), 2 NONE runs in the mutant harness and 2 timing runs.

## G. Scope and rules
- Round 2 touched only `src/state.ts` (+2/-3), `tests/state.test.ts` (+50/-1) and the new
  `tests/state-bigwriter.ts`. `598be68` and `4092af5` touch only `.mstack/`.
- No test was weakened. `git diff dce98cb...HEAD -- tests` removes no line, because `tests/state.test.ts`
  and both helpers are new files. In round 2 the one removed line is the `const [exit]` line that
  `4b533c8` split in two. No assertion was removed or loosened.
- The runtime rules hold. `src/state.ts` and the helper import only `node:` builtins and relative files.
  There is no `Bun.*`, `package.json` is unchanged, and both runtimes are green. `writeFileSync` accepts an fd
  on every node from 22.6 onward.

## Verification I ran
```
$ ./bin/mstack gate
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full            (verify: npm test && npm run typecheck && bin/mstack lint-plugin .)
 412 pass
 0 fail
Ran 412 tests across 23 files. [61.24s]          <- bun test tests/, includes the gitignored sandbox/ (item 46)
ℹ tests 406
ℹ pass 406
ℹ fail 0                                          <- node --test
> bunx --bun tsc --noEmit                         <- clean
PASSED - 0 failures, 0 warnings                   <- lint-plugin
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'
ℹ tests 406
ℹ pass 406
ℹ fail 0
$ bun test ./tests
 406 pass
 0 fail
Ran 406 tests across 21 files. [62.06s]
```
node v26.13.1, bun 1.3.11, macOS. `git status --short` was empty at the start, after `gate --full` and at the end.

## Non-blocking notes
1. **`tests/state.test.ts:257` accepts any signal.** A runtime that crashed by SIGSEGV or SIGABRT before
   writing would pass with only the contract asserts. Safer: `null` gets the full check, `"SIGXFSZ"` gets
   the contract only, and any other signal fails.
2. **A directory that turns read-only after the lock is taken leaves the lock.** `rmIfOwner` swallows the
   EACCES (`src/tsv.ts:335-341`). The next writer breaks the dead lock and succeeds (run, both runtimes).
   Nothing can avoid this when the lock lives in that directory.
3. **A rename failure whose cleanup also fails leaves the temp file** (injected on node). The original
   error is reported and the target is untouched. This is item 66's leftover class.

## Suggested follow-ups
- Note 1 (narrow the signal condition), as a small test-only change.
- Everything round 1 queued stays queued as it was: the `decide --resolves` window and its message, a
  leftover temp whose pid recurs, a symlinked `state.json` replaced by a regular file, the file mode not
  kept, `--status done` doing git work under the lock, the hand-kept known-key lists, mutants M7b and M16,
  store leftovers (item 66), no fsync before the rename, and the EFBIG hint's wording ("check that ... is
  writable" for EFBIG and EPERM). M8 is no longer on that list: the new test kills it.

## Residual risks accepted
- **SIGXFSZ on a runtime or platform that delivers it.** The process dies before the catch, so the temp is
  left and the target untouched (rung 3). Acceptable: it is exactly A2's kill case.
- **A short write at ENOSPC on Linux** (rung 3). It runs through the loop shown at rung 4 under `ulimit`.
- **Close, write-part-way and injected-rename faults on bun** (bun had only the real failures, rung 4).
  Acceptable: the catch is runtime-independent code, and bun's real EFBIG, ENOSPC, EPERM and EACCES paths
  all ran clean.
- **A zero-byte `write(2)` with no error** (rung 3, not produced). POSIX regular files do not return it.

## Evidence ladder
- The blocker fix: rung 5, through the real CLI in throwaway stores on bun (launcher and direct) and node,
  with the round 1 line restored as the control.
- Rename failure, disk full and the read-only directory: rung 5 or rung 4 on real filesystem conditions,
  both runtimes. Close, part-way write and injected rename: rung 4 on node with injected syscalls.
- SIGXFSZ delivery, Linux ENOSPC short writes and zero-byte writes: rung 3, said here rather than settled.
- A1, A3 and A4: rung 4 and a rung 5 live check each, on round 1's in-depth work, which round 2 did not
  touch.
