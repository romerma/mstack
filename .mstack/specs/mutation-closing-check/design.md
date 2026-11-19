## Context

Each fact was read at the cited line on `feat/mutation-closing-check` at `ea36a61`, or measured by
a script under the session scratchpad `spec100/` (macOS 26 on APFS; git 2.54.0; node v26.13.1),
each a `bash` file that starts `set -euo pipefail` with a checked `cd`, its output beside it as
`*.out`. Every fixture ran this checkout's `./bin/mstack` with a fixture repository as its working
directory and an empty `HOME`; none ran with this checkout as its working directory or store.

- A closing check is one entry in `CLOSING_CHECKS` (`src/closing.ts:272`). The gate runs every
  entry for the active item at `verifying` (`gateProblems`, `:284-289`; `src/gate.ts:748`, printed
  at `:783-788` as `<id> <slug> (<status>) is one step from done, and <message>`), and `state set
  --status done` runs all of them (`src/cli.ts:758-819`). A problem is `overridable` or not
  (`src/closing.ts:28-29`); an overridable one closes with `--force --closed-by`, which writes one
  of three markers into `closed_by` (`src/cli.ts:294-299`, chosen at `:772-775`, carried across a
  later note at `:860-861`). The forced line for anything that is not the table reads `forced:
  closed on a verification that did not run here` (`:810-812`), so a mutation problem forced
  today would be recorded as an unverified close. `done` reads no lock (`rg readLock src/cli.ts`:
  no match).
- Item 42's row: `target` the slug, `sha` the HEAD the obligations ran at (`src/mutation-run.ts:457`,
  `lock.head`), `command` the obligations joined with ` && ` (`:260`), `outcome`, `ts`, `tree`
  `mutation:<key>`. `receipts()` ignores these rows (`src/verification.ts:341-352`).
- The key (`mutationKey`, `src/mutation.ts:121-167`) covers tracked and untracked code and test
  paths that differ from the start at HEAD, so it depends on which untracked files the checkout
  holds (`notes.txt` is code: `src/pathclass.ts:50-55`).
- After a merge a new run is refused: a merge commit by R4 (`src/mutation.ts:270-276`), a squash or
  rebase merge of a branch whose base is a branch commit by R1's lost start (`:233-236`).
- `verification.tsv` is ignored (`src/setup.ts:72`) and each checkout has its own store, a linked
  worktree included (`src/paths.ts:46-56`). The docs state why receipts are local
  (`docs/wiki/Gates-and-Hooks.md:703-707`).
- R5 compares each reverted path with the running copy's root (`src/mutation.ts:308-315, 506-512`);
  from `./bin/mstack` that root is this checkout, so every run here with code is refused.
- Rules default to on when absent (`src/state.ts:153-158`), and the first rewrite of `state.json`
  writes each known rule's parsed value (`updateState`, `:306-322`), so an absent key becomes the
  default written out; keys the CLI does not know are carried through (`extras`, `:317`);
  `seedState` writes four (`src/setup.ts:111-116`). CI runs no gate (`.github/workflows/ci.yml`).

### Fact 1: what the check would have met here (`fact1.mjs`, `fact1b.mjs`)

`fact1.mjs` replays every committed `state.json` to find each item's close commit, takes the
closed items that had a `base` there, and applies item 42's refusals to `git diff --raw -z
--no-renames --no-abbrev <base> <close>` (classes from `classifyPath`, `fold` from
`src/mutation-lock.ts`). Every close commit touched only `.mstack/`, so its code is the item's last.

```
closed items (status done now): 53
closed items with a base at their close: 9
  no code diff: 3                      (49, 96, 104)
  with a code diff: 6                  (40, 41, 42, 43, 82, 95)
    of which size s: 0
    the check applies (size not s, code diff): 6
    R3 refuses: 0
    R4 refuses: 0
    change src/ or bin/: 6
    reach R5 (every one refused from ./bin/mstack): 6
```

Item 42's window gives 14 code paths, the count its own run reverted (`history.md`, item 42).
The round 3 review's method (`fact1b.mjs`: windows from one close commit to the next on HEAD's
first-parent history, and each merge from its merge base to its second parent), re-run:

```
close commits on first-parent history: 50; windows: 53 (49 close-to-close, 4 merges)
windows with code: 41; R3 refuses 0; R4 refuses 1 (of those R3 passes); windows changing src/ or bin/: 37
close 18 -> close 29  9a0b09f2..53a08655  code=2  src/bin=0  R4[1e2580dc,d7e38c5a,017d34e7,4f5f33ed]
```

So 1 refused window in 41 (the review had 1 in 38 over a different set: 40 close windows, 3
merges, the open branch and 7 base items); the one is the window across the merges of
`fix/mstack-front-door`. R5 refuses all 41 from `./bin/mstack`; from a copy, none is refused by a
shape. Rung 3: diffs read, no run.

R5 as printed, from a separate clone (`r5.sh`; the clone's own CLI, a commit to `src/size.ts`):

```
mutation: refused: the revert would change the source of the mstack that is running, <clone>: src/size.ts
mutation: run it from a copy of the CLI outside the tree: git worktree add --detach "${TMPDIR:-/tmp}/mstack-cli" HEAD, then "${TMPDIR:-/tmp}/mstack-cli/bin/mstack" verify --mutation, then git worktree remove "${TMPDIR:-/tmp}/mstack-cli"
exit=2
no lock in the clone
```

### Fact 2: where a receipt lives (`worktree.sh`)

A run in a linked worktree, then a merge commit in the main checkout:

```
mutation: lock <fixture>/main/.git/worktrees/branch/mstack-mutation.lock, run ...
mutation-killed: `node --test tests/` failed without the change (...)
-- rows in the linked worktree's store: 1
-- rows in the main checkout's store: 0
-- main checkout after the merge, this store only
{"head":"282bfa14 Merge feat/greet","start":"base 261786b6",...,"row":"none"}
-- main checkout after the merge, with the linked worktree's store read too
{... "rule":"HOLDS"}
-- git status --ignored in the linked worktree
!! .mstack/verification.tsv
-- git worktree remove (no --force)
removed: exit 0
receipt file gone with the worktree
```

So "survives the merge" can mean only: the same machine and repository, the row in a store of one
of its worktrees that still exists, judged against the checkout that closes. A clone, CI and a
removed worktree have no row. Rung 4.

### Fact 3: what a kill proves (`kills.sh`)

```
== import-only: verification `node --test tests/`         (the test imports src/farewell.js and asserts nothing)
mutation-killed: `node --test tests/` failed without the change (exit 1; a build failure and an assertion failure look the same here)
== clean-tree-check: verification `git diff --quiet HEAD -- src`
mutation-killed: `git diff --quiet HEAD -- src` failed without the change (exit 1; ...)
== sh-script-bash: verification `/bin/bash scripts/check.sh`   (the item added scripts/check.sh)
mutation-blocked: `/bin/bash scripts/check.sh` exit 127 (the command was not found) on the reverted tree, so it says nothing about the change
== sh-script-dash: verification `/bin/dash scripts/check.sh`
mutation-killed: `/bin/dash scripts/check.sh` failed without the change (exit 2; ...)
```

Rung 4. The proposal says what the check is then worth.

### Fact 4: the merge shapes (`shapes.sh`, `eval.mjs`)

A fixture with `src/greet.js`, `src/other.js`, `tests/greet.test.mjs`; item `greet` started on
`feat/greet` (its base the branch's first commit, as `state set --status in_progress` records it),
`src/greet.js` and its test changed, a real `verify --mutation` (`mutation-killed`, key
`b572db0a3e9f1a11`), then each shape in a copy of the fixture (same store). "Main moved" means
another item's `src/other.js` and `tests/other.test.mjs` landed on `main` first; a rebase merge is
`git cherry-pick` onto `main` with a later committer date. `eval.mjs` computes item 42's key now,
R4 (tracked code and test paths that differ between S and the working tree, when S is on HEAD's
first-parent history), R5 (the item's paths of the row against the working tree) and R6.

| Shape | Start at HEAD | Key now | S on first-parent | Start at S | Not holding (R4 / R5 / R6) | Result |
|---|---|---|---|---|---|---|
| on the branch, right after the run | base | b572db0a… (same) | yes | base | - | holds |
| A fast-forward | base | same | yes | base | - | holds |
| B merge commit, main not moved | base | same | no | base | - | holds |
| C squash, main not moved | lost | none | no | base | - | holds |
| D rebase merge, main not moved | lost | none | no | base | - | holds |
| E merge commit, main moved | base | fc50264d… | no | base | - | holds |
| C2 squash, main moved | lost | none | no | base | - | holds |
| D2 rebase merge, main moved | lost | none | no | base | - | holds |
| V4 main edited line 1 of the item's file, merge commit | base | f17244de… | no | base | R5: src/greet.js | void |
| V5B test added after the run, main moved, merge commit | base | bf9cda6f… | no | base | R6: tests/helpers.test.mjs | void |
| V5C the same, squash | lost | none | no | base | - | **holds** |
| V5A the same, fast-forward | base | 9ac5032f… | yes | base | R4: tests/helpers.test.mjs | void |
| V6 code edit after the run, on the branch | base | 84299c38… | yes | base | R4: src/greet.js | void |
| V7 docs commit after the run, main moved, squash | lost | none | no | base | - | holds |
| L fast-forward, then other work on main before the close | base | 64101d0c… | yes | base | R4: src/other.js | void |
| U untracked notes.txt and test after the run | base | 3f9e1290… | yes | base | - | holds |
| R1 branch rebased onto moved main after the run | rewritten | same | no | base | - | holds |
| R2 rebased before the run, then squash | lost | none | no | rewritten | - | holds |
| R3 rebased before the run, then merge commit | lost | none | no | rewritten (M^1) | - | holds |

And from `worktree.sh`: a linked worktree's row read in the main checkout after a merge commit
holds (key equal); after a fast-forward, with an untracked `notes.txt` in the linked worktree at
the run, the key differs (`2c63a070…` there, `f5d6dd16…` here) and R4 holds. Rung 4 for git's
answers; the rule is emulated in `eval.mjs`, not yet code.

## Usage

The gate at `verifying`, and `done`, as the shape below would print them (a sketch, not a run;
task 1.2 pastes real output into the wiki):

```
$ mstack gate --quiet
[fail]  1 greet (verifying) is one step from done, and it has no mutation run, so nothing has shown that its tests fail without its code -> run 'mstack verify --mutation' alone and last (it runs the verification twice); where it is refused, or the tests cannot notice the code (a refactor), 'mstack state set greet --status done --force --closed-by "<why>"' closes it on the record
$ mstack verify --mutation
...
mutation-killed: `sh tests/check.sh` failed without the change (exit 1; a build failure and an assertion failure look the same here)
$ git switch main && git merge --squash feat/greet && git commit -m "feat: shout (#1)"
$ mstack gate --quiet          # nothing about the mutation check: the row holds by R5
$ mstack state set greet --status done --closed-by "PR #1 merged as 7588b18"
1 greet (done)
  status: "verifying" -> "done"
```

In a checkout of mstack the fix also says: `this checkout's own CLI refuses to revert its source:
git worktree add --detach "${TMPDIR:-/tmp}/mstack-cli" HEAD, then "${TMPDIR:-/tmp}/mstack-cli/bin/mstack"
verify --mutation from this directory, then git worktree remove "${TMPDIR:-/tmp}/mstack-cli"` (the
text of R5's fix, `src/mutation.ts:310-313`, as one constant).

## Shape

- `src/size.ts`: `measureStart(store, base, at?)` with `at = { head?: string; against?: string[] }`;
  the defaults are `HEAD` and the default branch's refs (`forkPoint`, `:102-109`), so the existing
  callers do not change. The start at S is `measureStart(store, base, { head: S, against })`,
  `against` M's first parent when a merge brought S in.
- `src/mutation-close.ts` (new):
  - `MUTATION_CHECK = "mutation"` and `mutationCheck: ClosingCheck`, `reportedAt: []`, appended to
    `CLOSING_CHECKS`. `run` returns `[]` when the rule is off, the item has no base, size `s` or no
    obligation, the lock exists (`lockExistsIn(gitDirOf(store))`), or the code diff is computed
    and empty (`git diff --raw -z --no-renames --relative <start> --`, kept to `scopeClass(store)`
    `code`). Every problem is `overridable: true`: an unreadable `verification.tsv` of this store
    is already the verification check's non-overridable problem (`src/closing.ts:62-71`), which
    runs whenever there is an obligation.
  - `storesRead(store)`: this store's `verification` path, then for each `worktree <path>` record of
    `git worktree list --porcelain` other than this one, `<path>/<prefix>/.mstack/verification.tsv`
    (`prefix` from `git rev-parse --show-prefix`). `rowsFor(store, slug)` reads each with
    `readRecords` (`src/tsv.ts:79`) in a `try`, so a missing or unreadable one gives `[]`.
  - `holds(store, item, row)`: `{ holds: true } | { holds: false; paths: string[] }`. S on HEAD's
    first-parent history: walk `git rev-list --first-parent HEAD ^S` and test that the last one
    listed has S as first parent (or HEAD is S); then R4 is `git diff --name-only --no-renames
    --relative S --` kept to `code` and `test`. Otherwise: the merge that brought S in (the first
    commit, walking that list from the oldest, whose first parent lacks S and another parent has
    it: `git merge-base --is-ancestor`); the start at S; the item's paths from `git diff
    --name-only --no-renames --relative <start at S> S --`; each judged by `git ls-tree S -- <p>`
    against `lstat` and `git hash-object --stdin-paths` (absolute paths, as `mutationKey` does);
    then R6 from `git diff --name-only S <M's parent with S>`.
  - `answer`: the rows, newest `ts` first, of the joined command and decisive, until one holds;
    then the precedence of R3. At most every row of the slug is judged; a gate after one run
    judges one.
- `src/cli.ts`, the `done` branch: before `closingProblems`, `readLock(store) !== null` throws a
  `UserError` whose message and fix are the gate's lock line (`lockProblem`, moved from
  `src/gate.ts:698-719` to `src/mutation-lock.ts` and used by both). The marker becomes
  `forcedMarker(checks)` over the overridden checks in the order verification, table, mutation;
  `FORCED_MARKERS` lists the seven; none is a prefix of another (`unverified (` / `unverified,` /
  `unverified and`, `table (` / `table and`), so the `find` at `:861` stays right. One forced line
  per overridden check; the verification line keeps its words, and the mutation one is `forced:
  closed without a killed mutation receipt - <messages>`.
- `src/mutation.ts`, `refusals`: R8 after the tracked-change refusals, from the `ls-files --others
  --exclude-standard -z` output `mutationKey` already reads, kept to `test`.
- `src/state.ts`: `require_mutation_to_close` in `State.rules` and `KNOWN_RULE_KEYS`, read per the
  fork's answer; `src/setup.ts`: `seedState` writes it `true`. This repository's `state.json`
  gets the key `true` explicitly, whatever the answer.

Cost, at `verifying` only: one `git worktree list`, one TSV read per worktree, one `measureStart`
and one `git diff --raw` for the code diff, and per row judged a `rev-list`, two or three `git
diff --name-only`, one `ls-tree` and one `hash-object` per path of the item.

## Rejected alternatives

- **Item 42's key on the branch, the review's C' only after a merge** (B3 as written: exact key,
  then C' "only on the default branch"). The same answer as R4 to R6 on 18 of the 19 shapes. It
  differs on U, voiding a receipt for an untracked test created after the run (a file that is not
  the item's), and the key depends on the checkout's untracked files: a linked worktree's row
  read in the main checkout after a fast-forward was void by the key with an untracked
  `notes.txt` there, and holds by R4 (`worktree.sh`). R4 is the same comparison on tracked paths.
- **C' from the base**, as the review stated it ("the item's base is an ancestor of the row's
  sha"). A branch rebased before its run has a base outside S's history (R2, R3 above), so it
  would never hold after any merge of a rebased branch; and with the default branch as it is now,
  after a merge commit the start at S is lost, since `main` then holds S. Hence the start at S
  against M's first parent (R3: holds).
- **Rows of this store only** (the receipts' rule, `Gates-and-Hooks.md:703-707`). The run in a
  linked worktree, the `mstack worktree new` flow, would then never answer the check where the
  merge lands (0 rows there, measured), and no new run is possible there. Rows of the other
  worktrees are judged path by path against this working tree, so what they certify is this
  tree's content, not that worktree's.
- **Closing before the merge** (changing `skills/ship/SKILL.md` step 7). Refused by the coordinator
  in item 42's round 2 (B3: "The coordinator has said no to that"); a squash-merge consumer's close
  commit would then need a second merge.
- **Writing the start into the row** (a seventh column, or `mutation:<key>@<start>`). Exact for
  rows written from now on, but item 42's rows (this repository's included) have none, and the
  start at S gives the same answer on every shape measured.
- **Recording which commits are the item's**, to close V5C. Git keeps nothing of it after a squash
  or a rebase merge; a record would be a new file or a commit trailer, a mechanism this item does
  not need for its acceptance.
- **The CLI making its own copy in an mstack checkout.** It changes item 42's R5, and the hooks of
  a session started with `--plugin-dir .` would still run the reverted `src/`.
- **A gate line that counts forced closes.** The three markers that exist have none; `closed_by`
  is the record and `state show` prints it.
- **A non-overridable problem when the code diff cannot be computed** (the round 2 draft's R24).
  After a squash merge of a branch-based item that is every close (fact 4, C), with no way out but
  `--base`; a forced close says only what is true, "closed without a killed mutation receipt".

## Trade-offs accepted

- V5C: a code or test path first added or changed on the branch after the run is not seen after a
  squash or a rebase merge; git cannot say which commits were the item's. The branch's gate at
  `verifying` showed the receipt void before the merge (V5A, V6).
- L: a fast-forward and then other work on the default branch before the close voids the receipt
  (first-parent history cannot tell whose commits came after S). Close right after the merge;
  otherwise the forced close.
- Other work outside the item's paths that changes whether its tests bite (a shared helper, a
  runner setting) is not seen (B3's own list, item 1).
- An item with no code of its own, merged with a merge commit after the default branch gained
  other code, or squash- or rebase-merged from a base on its branch, is held after the merge (its
  code diff includes others' code, or cannot be computed). The way out is `state set <slug> --base
  <the commit before the merge>` or the forced close.
- `git worktree remove` deletes a linked worktree's receipts, with exit 0 (fact 2). Close first.
- Untracked files never void a receipt at closing; R8 keeps an untracked test from earning one, and
  a scratch test file must be committed or ignored before the run.
- A kill does not say the tests check behaviour (fact 3); this check only makes "nothing noticed"
  a recorded decision.
- In this repository, every item with code runs from a copy of the CLI outside the tree (fact 1),
  about 200 s on top of `gate --full` (item 42's run: 198 s), from a session not started with
  `--plugin-dir .`.

## Open questions

- Should `mstack worktree prune` leave out a worktree whose store holds a row for an item that is
  not closed? Deferrable: the gate says "no mutation run" after the loss, and the forced close is
  the way out.
- Should the gate say which rule held the receipt (R4 or R5)? Deferrable: no closing check prints
  a line when it passes today.
