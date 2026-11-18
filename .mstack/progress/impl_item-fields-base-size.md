# Implementation report: item 40, item-fields-base-size

Branch `feat/item-size-and-base`, base `a74361d`. Direct path (acceptance and the two seams are the contract).

## What changed

An item now carries `size` (`s`, `m`, `l`; absent reads as `m`, never written) and `base` (the commit `HEAD` resolved to when the item moved to `in_progress` and had none). `state add --size`, `state set --size`, `--clear size`, `state set --base <commit>` (must resolve to a commit, stored in full), and `--clear base` is refused with the reason and `--base`. `state show` prints both (text and `--json`). The gate measures the active item when it has a `base` and size `s`: paths differing between `base` and the working tree (committed, staged, unstaged, untracked-not-ignored), kept when `classifyPath` says `code`, minus `.mstack/`, lines = insertions + deletions (binary = file, 0 lines; untracked = all insertions). More than 60 lines or more than 3 files fails with one `[fail]` line and a fix naming `mstack state set <slug> --size m`; an unresolvable base fails with a fix naming `--base`. Limits are `SMALL_MAX_LINES` and `SMALL_MAX_FILES` in `src/size.ts`, read by the gate and by the `--help` text. `sdd` + size `s` is refused at `state add --sdd --size s`, `state set --size s` on an sdd item and `state set --sdd` on a size-s item (one check, `assertNotSddSmall`, run after the command's changes are applied, so `--clear sdd --size s` in one command works).

## Files

- new `src/size.ts` (sizes, limits, `resolveCommit`, `measureDiff`)
- `src/state.ts` (item shape, parse checks, `KNOWN_ITEM_KEYS`), `src/cliopts.ts` (flags and help), `src/cli.ts` (add/set/show, clear, base recording, sdd refusal), `src/gate.ts` (`checkSmallDiff`)
- new `tests/item-size-base.test.ts` (49 tests; the state half runs once per runtime)
- `docs/wiki/The-CLI.md` ("Size and base", `--clear` list), `docs/wiki/Gates-and-Hooks.md` (the check, a pasted failure line), `CHANGELOG.md`
- `.mstack/decisions.tsv` (4 implement rows)

Commits: `1273254 feat(state)`, `39e5ce2 feat(gate)`, then `docs:`, then this report. (The gate tests are red at the first commit and green at the second; the test file went in with the state commit.)

## Red first

Test file written before any source change. Run with `bun test tests/item-size-base.test.ts`: `9 pass / 39 fail` (48 tests then). Reasons, e.g. `mstack: Unknown option '--size'` for the state tests; the gate tests failed on a missing `[fail]` (no check existed). Full list: `scratchpad/impl40/red.txt`. The 9 that passed red were guards for behaviour that held by absence (for example "exactly 60 passes", "size m not measured", "status move records no base"); each is killed by a mutant below. After the code: `48 pass 0 fail`; a 49th test (tracked binary) was added after the mutant run showed a survivor.

## Mutants

Script `scratchpad/mut.py`, each mutant applied to the source, `bun test tests/item-size-base.test.ts` run, source restored.

| Mutant | Red tests | First red test |
|---|---|---|
| lines `>` to `>=` | 5 | exactly 60 changed lines in exactly 3 code files passes |
| files `>` to `>=` | 5 | exactly 60 changed lines in exactly 3 code files passes |
| classifier filter removed (`return true`) | 1 | test files, doc files and everything under .mstack/ do not count |
| store-directory exclusion removed | 10 | exactly 60 changed lines ... (the sandbox's own `.mstack/` is untracked) |
| untracked files not counted | 5 | 61 changed lines fails with both counts, both limits and the fix |
| deletions not counted | 1 | an uncommitted edit to a tracked file counts insertions plus deletions |
| binary tracked file not counted as a file | 0 on first run: SURVIVED; 1 after adding the test | a tracked binary file that changed counts as a file and as zero lines |
| "first move only" (`item.base === undefined`) removed | 2 | a later return to in_progress leaves the base alone |
| base recorded on any status move (`moved && in_progress` to `moved`) | 2 | a status move to anything else records no base |
| `--clear base` allowed | 2 | --clear base is refused, says why and names --base, and writes nothing |
| `--base` not validated | 2 | state set --base replaces the base with a commit that resolves, and refuses one that does not |
| sdd refusal removed at `state add` | 2 | sdd with size s is refused at state add ... |
| sdd refusal removed at `state set` (covers both set refusals) | 4 | state set --size s on an sdd item is refused and writes nothing |
| invalid size not refused | 2 | an invalid size is refused with the value and the three allowed ones ... |
| size m measured too | 2 | size m, size l, an absent size, an item with no base and an inactive item are not measured |
| unresolvable base passes | 1 | a base git cannot resolve fails with a fix that names --base |

"Red tests" counts per runtime where the test is per runtime (a state test counts twice). I did not mutate "untracked ignored files"; its test covers the `--exclude-standard` flag by construction (a 500-line ignored file would fail the gate without it), not run as a mutant.

## Real session (scratch repo `scratchpad/impl40/repo`, `./bin/mstack`; full file `scratchpad/impl40/session.txt`)

```
$ mstack state add --slug greet-flag --title "greet --shout" --acceptance "shout uppercases" --size s
added 1 greet-flag (pending)
$ mstack state set greet-flag --status in_progress
1 greet-flag (in_progress)
  status: "pending" -> "in_progress"
  base: (unset) -> "1dd52334ac0095c95d3a76d7b00dd8e746ff4ee0"
$ mstack state show greet-flag
id: 1
slug: greet-flag
title: greet --shout
status: in_progress
size: s
base: 1dd52334ac0095c95d3a76d7b00dd8e746ff4ee0
acceptance:
  - shout uppercases
$ mstack gate   # four code files, 6 lines each
[fail]  1 greet-flag (in_progress) is size s but its code diff from 1dd52334 is 24 lines in 4 files, over the limits of 60 lines and 3 files
        fix: it is not small: 'mstack state set greet-flag --size m' (or split the work)
FAILED - 1 failure, 1 warning
$ mstack state set greet-flag --size m
1 greet-flag (in_progress)
  size: "s" -> "m"
$ mstack gate
PASSED - 0 failures, 1 warning
$ mstack state set greet-flag --size xl; echo exit $?
mstack: 'xl' is not a size
        the sizes are s, m or l; nothing was written
exit 2
$ mstack state set greet-flag --clear base; echo exit $?
mstack: base cannot be cleared
        the gate measures a size s item's diff from it, so an item without one would escape the check; replace it with --base <commit> instead
exit 2
```

## R to test

All in `tests/item-size-base.test.ts`; state tests run under node and bun.

| Requirement | Test (line) |
|---|---|
| AC1 size s/m/l accepted by add and set, shown | 61 (add, show text and json), 75 (set) |
| AC1 clearable, absent means m, not written | 104 (`--clear size`, already unset), 128 (old item: no size shown, no write adds one), 117 (`--size` with `--clear size` contradicts) |
| AC1 invalid value refused, not dropped, file byte-identical | 85 (add and set; four bad values) |
| AC2 base on first in_progress, equal to HEAD | 146 |
| AC2 first move only | 158 (return from reviewing), 172 (other status records none) |
| AC2 `--base` good and bad | 180 (abbreviation stored in full, four bad values, file identical) |
| AC2 `--clear base` refused | 202 |
| AC2 no git / no commit | 215, 226 |
| AC3 gate at 60 lines and 3 files passes | 325 |
| AC3 61 lines fails, with counts, limits, fix | 333 |
| AC3 4 files fails | 350 |
| AC3 tests, docs, `.mstack/` not counted | 362, 377 |
| AC3 uncommitted, committed, untracked counted; deletions counted | 386, 400 |
| AC3 ignored untracked not counted; binary | 415, 426, 439 |
| AC3 size m/l/absent, no base, inactive not measured | 454 |
| AC3 unresolvable base | 465 |
| AC3 gate exit code and `[fail]` text, green after `--size m` | 475 |
| AC3 sdd with s refused (three ways) | 239 (add), 252 (set --size s), 264 (set --sdd); 276 (allowed combinations) |
| Design 5 help text | 285 |
| Design 6 docs, CHANGELOG | no test (prose); `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`: 97 links, 0 broken |

## Decisions (also `./bin/mstack decide --phase implement` rows)

1. **No pattern overrides exist.** `classifyPath` has no call site outside its tests and no store config feeds it; `measureDiff` uses the defaults. The brief expected an existing call site to reuse.
2. **"First move only" is "the move that finds no base".** History is not stored per item, so a move to `in_progress` records a base only when the item has none and the status actually changed (`--status in_progress` on an item already there records nothing). Consequence: an item that started outside git, or predates this field, gets its base at a later move to `in_progress`; `--base` corrects it. An explicit `--base` in the same command wins.
3. **No-base notice goes to stdout in the change list**: `base: not recorded (not a git repository, or no commit yet); 'state set --base <commit>' sets one`.
4. **`--base` stores the full resolved commit**, so an abbreviation is normalised; a value starting with `-` is refused without calling git.
5. **A `size` in `state.json` that is not `s`/`m`/`l` is a read error** (shape check, like the neighbours), and a non-string `base` too.
6. **Gate output**: silent for an item it does not measure; one `[ok]` line for a measured size-s item within the limits.
7. **`--clear`'s refusal for `base` reuses the `UNCLEARABLE` table**, so the message is `base cannot be cleared` plus the reason and `--base` on the next line.

## Verify (after the final edit)

- `npm run typecheck`: exit 0, no output.
- `./bin/mstack lint-plugin .`: `PASSED - 0 failures, 0 warnings`.
- `./bin/mstack gate` (this repository, item 40 active, no size, no base): `PASSED - 0 failures, 0 warnings`.
- `npm run test:bun`: `683 pass 0 fail` (634 before; 49 new).
- `npm run test:node`: `tests 683 pass 683 fail 0`.
- `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`: 97 relative links checked, 0 broken.
- Before and after the final edit nothing is left running; no field of any item in this repository's store was set.

## Not shown

- `claude plugin validate . --strict` and the pinned node 22.6 job were not run (node here is whatever `npm run test:node` uses; the code uses only `node:fs`, `node:path`, `node:child_process`).
- `git diff` behaviour under unusual git config (`diff.external`, `core.quotePath`) is untested; `-z` and `--no-renames` are passed to avoid quoting and rename pairs. A repository whose `.mstack` is a symlink or whose store is in a sub-directory of the git top-level is handled by realpath and `--full-name` but has no test.
- Submodules and nested repositories (listed by `ls-files --others` as a directory) are unverified here.

## Deviations

- The brief said to reuse the store config's pattern overrides; there are none (decision 1).
- Report numbers: 49 new tests, not the 48 first written (one added for a surviving mutant).
- The gate tests are red at commit `1273254` and green at `39e5ce2`.
