# Implementation report: state-json-loses-concurrent-writes (item 53)

Code head: `454a02a` (fix at `8f79a96`, extra test at `454a02a`).

## What changed

`saveState` is gone. `src/state.ts` now exports `updateState(file, change)`: it takes `withLock` on
`state.json`, parses the file under the lock, runs the caller's `change(state)`, and writes the result
to `state.json.tmp-<pid>-<n>` (exclusive create, same directory) that is renamed over the target. If
`change` throws, nothing is written. Keys the CLI does not know are carried through on the state
object, on `rules`, and on each item (matched by id), because `parseState` itself still rebuilds from
known fields. A failure to create the temp file or rename gives a `UserError` naming `state.json`,
and the temp file is removed; a read-only `.mstack/` fails earlier, at lock creation, with the
existing `cannot create the lock ...` `UserError`.

The three callers in `src/cli.ts` (`state add`, `state set`, `decide --resolves`) moved to it. The
bodies of `state add` and `state set` are now closures passed to `updateState` (re-indented, so the
diff is large; `git diff -w` is small). `decide --resolves` keeps its unlocked validation, writes the
`decisions.tsv` row under that file's lock, and then sets the pointer in a second `updateState` that
re-finds the item in a fresh read. The two locks are taken one after the other, never nested, so no
order can invert and `updateState` is never entered twice.

## Files

- `src/state.ts` (updateState, writeAtomically, removed saveState)
- `src/cli.ts` (import and the three sites)
- `tests/state.test.ts` (10 new tests beside the committed red one)
- `tests/state-holder.ts` (child helper: holds the state lock inside a real `updateState`)
- `.mstack/decisions.tsv` (one `implement` row), `.mstack/progress/current.md`, this report

No other test called `saveState`.

## Commands (real output)

```
$ bunx --bun tsc --noEmit            -> no output (clean)
$ ./bin/mstack lint-plugin .         -> PASSED - 0 failures, 0 warnings
$ node ... --test 'tests/*.test.ts'  -> ℹ tests 405 / ℹ pass 405 / ℹ fail 0
$ bun test ./tests                   -> 405 pass / 0 fail / Ran 405 tests across 21 files. [61.75s]
```

Original surface, throwaway store `.../scratchpad/impl53/`:

```
n=12 exit0=12 items=12 12        (items, distinct ids)
n=40 exit0=40 items=40 40
mix: 8 state add + 5 state set (different items) + 1 decide --resolves, at once:
  exit0=14 of 14
  22 items; titles 'Second 1'..'Second 5'; resolved= 2026-11-16T20:00:12.987Z; new= 8
```

(The first mix run exited 13 of 14: my `--evidence` text was under the 40-byte floor and `decide`
refused it; that is the existing floor, not the change. The rerun with a long text is the one above.)

Unknown keys, real CLI (state key `future_key`, item keys `owner`):

```
after 13-process mix:  future_key {'a': 1} owners ['ana', 'bo']
after state set o2:    future_key {'a': 1} owners ['ana', 'bo']
after state set o3:    owners ['ana', 'bo'] {'a': 1}
```

Read-only `.mstack/` (chmod 555, restored afterwards), 0.027 s, exit 2:

```
mstack: cannot create the lock .../impl53/.mstack/state.json.lock: EACCES: permission denied, open '.../state.json.lock'
        check that .../.mstack exists and is writable, and that its disk is not full
```

No lock or temp file remained in `.mstack/` after any run (`fd -H 'lock|tmp' .mstack -d 1` empty).

## Acceptance to test

| # | Bullet | Test | file:line |
|---|--------|------|-----------|
| 1 | twelve concurrent adds leave twelve items, twelve ids | `concurrent state add calls each land in state.json` (red at f2f944d) | tests/state.test.ts:56 |
| 1 | same, mixed add, set, decide --resolves | `concurrent add, set and decide --resolves all land` | tests/state.test.ts:82 |
| 2 | write goes to a temp file renamed over the target | `a write replaces the file by rename: a new inode, and an open reader keeps the old content` | tests/state.test.ts:151 |
| 2 | target never opened for writing | `a hard link to state.json keeps the old content ...` | tests/state.test.ts:172 |
| 2 | failed change leaves nothing, leftover temp never blocks | `a failing change writes nothing ...`, `a successful write leaves no lock or temporary file, and a leftover one does not block it` | tests/state.test.ts:187, 202 |
| 3 | lock held across the read and the write | `a writer queued behind a live holder works on what the holder wrote` (parse inside lock), `a live holder past the timeout fails the writer with a UserError naming the lock` (lock taken at all) | tests/state.test.ts:109, 134 |
| 3 | all callers | the mix test above plus the existing decisions and state CLI tests (all green) | tests/state.test.ts:82 |
| 4 | unknown key survives | `keys the CLI does not know survive a write, on the state, rules and every item`; `state set keeps an unknown key on the item it changes and on the one it does not` | tests/state.test.ts:221, 240 |
| extra | read-only store fails promptly | `a read-only .mstack directory fails promptly with a UserError, not a hang` | tests/state.test.ts:258 |

## Mutants (each applied to `src/state.ts`, `tests/state.test.ts` run on node and bun, then restored)

| Mutant | Killed by (identical on node and bun) |
|--------|----------------------------------------|
| M1 remove the `withLock` call | `concurrent state add...`, `concurrent add, set and decide...`, `a writer queued behind a live holder...`, `a live holder past the timeout...` |
| M2 `renameSync` replaced by direct `writeFileSync(file)` | `a write replaces the file by rename...`, `a hard link to state.json keeps the old content...` |
| M3 drop item extras | `keys the CLI does not know survive...`, `state set keeps an unknown key...` |
| M4 drop state-level extras | same two |
| M5 drop `rules` extras | `keys the CLI does not know survive a write...` |
| M6 parse before `withLock` | `concurrent state add...`, `concurrent add, set and decide...`, `a writer queued behind a live holder...` |
| M7 fixed temp name `state.json.tmp` (a leftover blocks the next write) | `a successful write leaves no lock or temporary file, and a leftover one does not block it` |

My first M7 (rename the counter to a constant inside a pid-unique name) was not killed because the
name was still unique; the test was then extended with a stray `state.json.tmp` and the mutant
redone as above. `git status --short` is clean of mutations (`src/` untouched).

## Load

- `tests/state.test.ts` x30 on node: 0 failures. x30 on bun: 0 failures.
- Four full `bun test ./tests` suites at once, plus `tests/state.test.ts` three times beside them:
  all four suites 405 pass, 0 fail, all three state runs exit 0. The two known item-67 flakes
  (`run.test.ts:54`, `costs.test.ts:698`) did not fail in this run either. Failures of the new
  tests on unmutated code: 0.

## Limits

- A writer killed between creating the temp file and the rename leaves `state.json.tmp-<pid>-<n>`
  beside `state.json`. The target is untouched, the name is unique per attempt so it never blocks a
  later write, and nothing sweeps it: item 66 can match the `state.json.tmp-` prefix
  (`STATE_TMP_PREFIX` in `src/state.ts`). The lock file `state.json.lock` of a killed writer is the
  existing `withLock` behaviour (dead owner broken at once).
- The rename is atomic against a kill of the process, not against power loss: no `fsync` of the file
  or the directory (not asked; it costs latency on every write).
- Readers (`parseState` alone: gate, `state list`, hooks) do not take the lock, so they see the old
  or new file whole, never a mix. A reader that parses, then acts on a stale view, is not covered.
- `decide --resolves` validates before it writes the row, and sets the pointer in a second locked
  update. Another process could clear the fork in between; the pointer is then written to an item
  with no fork. Same window as before, not widened; making it atomic would nest the two locks.
- Unknown keys on items are matched by `id`; two items with the same id (already invalid under
  `assertWritable`) share the first one's extras. Key order of extras is after the known keys.
- Waiters give up after `withLock`'s 2 s: 40 parallel adds passed here, but a slow disk with many
  more writers can get a `UserError` (retryable, nothing lost).
- Deviation: the new tests import `updateState`, so they cannot be red against the old code in the
  way the committed test is; fix and tests landed together in `8f79a96`, with the only test that
  pins a distinct property (stray temp file) in a follow-up commit `454a02a`.
