# Implementation report, round 2 - state-json-loses-concurrent-writes

Branch `fix/state-json-loses-concurrent-writes`, started at `949414b`. Last code-changing commit: `4b533c8`.

## What changed
The review's one blocker is fixed. `writeAtomically` called `writeSync(fd, text)` once and ignored the byte
count, so a write cut short (file-size limit) was renamed over `state.json` and the command exited 0. It now
calls `writeFileSync(fd, text)`, which loops until everything is written or throws; the catch removes the temp
file and raises `UserError("cannot write <file>: EFBIG")`, and the target is never renamed over. A test runs
`updateState` in a child under `ulimit -f 2` and was red on the round 1 code before the fix (separate commit).
Two cheap notes are done: the dead `instanceof UserError` rethrow is gone, and the `state set` child is killed in a
`finally`. The reviewer's suggested fix was used as is; I found no reason not to.

## Files
- `src/state.ts` (`writeFileSync` in place of `writeSync`, import, dead line removed)
- `tests/state.test.ts` (new test at `:222`, `finally` kill in the test at `:286`)
- `tests/state-bigwriter.ts` (new child helper, not a `*.test.ts`)
- `.mstack/progress/impl_state-json-loses-concurrent-writes_r2.md`, `.mstack/progress/current.md`, ledger row

Commits: `1df7891` test (red), `acf1e8a` fix, `448fc54` dead code, `4b533c8` kill in finally.

## Behaviour under the file-size limit (found by running)
Both runtimes ignore SIGXFSZ (it is not delivered as a fatal signal here): with the fix, bun and node both throw
EFBIG, the `UserError` is raised, exit 2, target 461 bytes (unchanged), no temp file left. Before the fix both
returned normally ("wrote", exit 0, 1024-byte truncated file). So the test could assert the leftover check on
both runtimes; it still only checks leftovers when the child was not killed by a signal, so it stays valid on a
platform that does deliver SIGXFSZ.

## Commands
Reproduction with the real CLI, throwaway store (title of 3000 chars), before (head `949414b` code):
```
$ ( ulimit -f 2; ./bin/mstack state set a --title <3000 x> ); echo exit=$?
exit=0
$ wc -c .mstack/state.json            -> 1024   (was 461)
$ ./bin/mstack state list
mstack: .../state.json is not valid JSON: JSON Parse error: Unterminated string
```
After (head `4b533c8`):
```
$ ( ulimit -f 2; ./bin/mstack state set a --title <3000 x> ); echo exit=$?
mstack: cannot write .../store2/.mstack/state.json: EFBIG
        check that .../store2/.mstack is writable
exit=2
$ wc -c .mstack/state.json            -> 462 (unchanged)
$ ./bin/mstack state list             -> 1 a (pending)  A
$ fd -H . .mstack -d 1                -> .gitattributes .gitignore costs.tsv decisions.tsv ledger.tsv progress/ specs/ state.json   (no lock, no tmp)
```
Red test on the round 1 code (child said `wrote`, exit 0):
```
node: ✖ a write that cannot be completed leaves ... AssertionError: a write that was cut short must not report success (exit 0, signal null, said "wrote\n")
bun:  (fail) a write that cannot be completed leaves ... [83.61ms]
```
Suites at `4b533c8`:
```
node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'  -> tests 406, pass 406, fail 0
bun test ./tests                                                                               -> 406 pass, 0 fail, Ran 406 tests across 21 files
bunx --bun tsc --noEmit                                                                        -> exit 0
./bin/mstack lint-plugin .                                                                     -> PASSED - 0 failures, 0 warnings
```
`tests/state.test.ts` alone: 12 pass on node, 12 pass on bun. 20 repeats per runtime: 0 failures on node, 0 on bun (unmutated code).

## Findings answered
| Finding | Reproduced | What I did | Test |
|---|---|---|---|
| Blocker: `writeSync` ignores the count (`state.ts:274`) | yes, CLI and in-process, node and bun | `writeFileSync(fd, text)`; UserError EFBIG, target intact, temp removed | `tests/state.test.ts:222`, fix at `src/state.ts:274` |
| Note 10: child not killed in `finally` (`:240`) | yes, no `kill()` | `writers?.kill()` in the `finally` | `tests/state.test.ts:286` |
| Note 9 / M10: dead `instanceof UserError` rethrow (`:285`) | confirmed unreachable: the `try` holds only `openSync`, `writeFileSync`, `closeSync`, `renameSync`, which throw plain `Error`s with `.code`, never a `UserError`; the round 1 mutant M10 survived | removed. The "read twice" half of note 9 is left alone, as asked | n/a (dead code); full suite green |

## Mutants (applied to the repository, restored with `git checkout src/state.ts`, `git status --short` empty)
| Mutant | Edit | Killed by (node / bun) |
|---|---|---|
| MS | back to the single `writeSync(fd, text)` | `:222` / `:222` |
| M1 | no `withLock` | `:57`, `:83`, `:110`, `:135` / same |
| M2 | direct write instead of rename | `:152`, `:173` / same |

## Acceptance to test
| Acceptance | Test | file:line |
|---|---|---|
| 1. twelve concurrent adds, twelve ids, red on unmodified code | concurrent state add calls each land | `tests/state.test.ts:57` (and `:83`) |
| 2. kill mid-write cannot truncate; temp file in the same dir renamed over; and now a write cut short never reaches the target | rename/inode, hard link, leftover, cut-short write | `:152`, `:173`, `:203`, `:222` |
| 3. every read-modify-write holds the lock | queued writer, live holder, mixed add/set/decide | `:83`, `:110`, `:135` |
| 4. unknown keys survive | unknown keys, `state set` CLI | `:267`, `:286` |

## Evidence ladder
The blocker: rung 4 (real CLI and in-process, both runtimes, under `ulimit -f`). A short write at ENOSPC on a
filesystem that returns one (Linux) is still rung 3: argued from the `writeFileSync` loop, not run here.
