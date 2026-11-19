# Spec hand-off: item 100 mutation-closing-check

Written: `.mstack/specs/mutation-closing-check/{proposal,design,spec,tasks}.md`, and six rows in
`.mstack/decisions.tsv` (phase `spec`, item `mutation-closing-check`). Item 100 has no size, so it
reads as m: **11 requirements** (limit 12). Item status not changed. No `src/`, `tests/` or docs
touched. Every measurement below ran under the session scratchpad `spec100/`, in fixture
repositories or a separate clone, with this checkout's `./bin/mstack` and the fixture as `cwd`;
none with this checkout as `cwd` or store. The checkout's git dir has no `mstack-mutation.lock`.

## Fork for the user

**How is a `state.json` whose `rules` has no `require_mutation_to_close` read?** Only R10 depends
on it; the other ten requirements and every task fit either answer (task 1.1 reads the answer from
the `decide --resolves mutation-closing-check` row). This repository's `state.json` gets the key
`true` explicitly under both answers (decision row, task 1.1).

- **A. As `true`, like every other rule** (`src/state.ts:153-158`: absent is on). An upgraded
  store's items at `verifying` with code turn red at once, until `verify --mutation` kills or a
  forced close records why. Consistent with the other four rules; nobody has to find a key to get
  the check. Cost: every upgraded consumer pays a second suite run per item from the next close,
  and an item already merged but not closed can only close by the forced close (no run is possible
  after a merge).
- **B. As `false`; `setup` writes `true` for new stores.** An upgraded store sees no change until
  it adds the key. No surprise red on upgrade. Cost: the first rule whose absence means off, and a
  check most existing stores will never turn on.

Under either answer the first `state set` in an upgraded store writes the key out with that
answer's value, as it does for every known rule today (`updateState`, `src/state.ts:306-322`), so
the choice shows up in the store's next diff.

**Recommendation: A.** The check is the reason item 42 exists, the forced close is always there
for an item in flight (R3's problem names it), and the rule is one key to set `false`. If the
consumer base is larger than this program knows, B is the safer release.

## The facts asked for, each with where it was measured

1. **What the check would have met here** (rung 3: diffs read with `git diff --raw`, no run;
   `fact1.mjs` replays every committed `state.json` to find each close commit). Of 53 closed items,
   9 had a base at their close (40, 41, 42, 43, 49, 82, 95, 96, 104). 3 have no code diff (49, 96,
   104); 6 have one (40, 41, 42, 43, 82, 95), none of size s, so the check would hold 6. R3 refuses
   0, R4 refuses 0; all 6 change `src/`, and R5 refuses all 6 from `./bin/mstack`, because R5
   compares with the running copy's root (`src/mutation.ts:506-512`), which is this checkout; from a
   copy, none is refused. Item 42's window has 14 code paths, the number its own run reverted. The
   round 3 review's method re-run (`fact1b.mjs`): 53 windows, 41 with code, R3 0, **R4 1 in 41**
   (close 18 -> close 29, across the four merges of `fix/mstack-front-door`), 37 of 41 change
   `src/` or `bin/`. The review's "1 in 38" was over a different window set; the one refusal is the
   same window. R5 as printed, from a separate clone's own CLI (rung 4, `r5.sh`):
   ```
   mutation: refused: the revert would change the source of the mstack that is running, <clone>: src/size.ts
   mutation: run it from a copy of the CLI outside the tree: git worktree add --detach "${TMPDIR:-/tmp}/mstack-cli" HEAD, then "${TMPDIR:-/tmp}/mstack-cli/bin/mstack" verify --mutation, then git worktree remove "${TMPDIR:-/tmp}/mstack-cli"
   exit=2
   ```
2. **Where a receipt lives** (rung 4, `worktree.sh`). A run in a linked worktree: 1 row in its
   store, 0 in the main checkout's; after a merge commit the main checkout sees `"row":"none"`;
   `git worktree remove` without `--force` exits 0 with the ignored `verification.tsv` present and
   the row is gone. So "survives the merge" means: same machine, same repository, a store of one of
   its worktrees that still exists, judged against the checkout that closes. CI and clones have no
   rows; CI runs no gate.
3. **What a kill proves** (rung 4, `kills.sh`): a test that imports the new module and asserts
   nothing, `mutation-killed`; `git diff --quiet HEAD -- src`, `mutation-killed`; `/bin/bash
   scripts/check.sh` with the script reverted away, `mutation-blocked` (127); `/bin/dash
   scripts/check.sh`, `mutation-killed` (exit 2). The proposal's sentence: a kill says the
   verification failed with the code put back, not that a test checks what the code does; the check
   makes "nothing noticed" a recorded decision.
4. **The merge shapes** (rung 4 for git's answers, rule emulated in `eval.mjs`; `shapes.sh`). Key
   at the run `b572db0a3e9f1a11`:

| Shape | Key now | Rule |
|---|---|---|
| A fast-forward | same | holds (R4) |
| B merge commit, main not moved | same | holds (R5) |
| C squash, main not moved | none, start lost | holds (R5) |
| D rebase merge, main not moved | none, start lost | holds (R5) |
| E merge commit bringing another item's code | `fc50264d1e7efcb5` | holds (R5) |
| C2, D2 squash, rebase merge after main moved | none, start lost | holds (R5) |
| V4 main edited the item's file | `f17244defec5d8ee` | void (R5) |
| V5B test added after the run, merge commit | `bf9cda6fc336bb34` | void (R6) |
| V5C the same, squash | none | **holds: accepted hole** |
| V5A the same, fast-forward | `9ac5032f3ee0949f` | void (R4) |
| L fast-forward, then other work before the close | `64101d0cdbbcffe0` | void (R4, fail-closed) |
| U untracked notes.txt and test after the run | `3f9e1290563af3ac` | holds (R4) |
| R1-R3 rebased after the run; before it, then squash or merge commit | same / none / none | holds |

The full 19-row table, with the start at HEAD and at S, is design.md Fact 4.

## What I settled, and why (rows in decisions.tsv)

- **The rule for a receipt.** R4: S on HEAD's first-parent history (the branch, a fast-forward):
  holds when no tracked code or test path differs between S and the working tree. R5: otherwise,
  B3's C-prime computed from *the start at S* (measureStart with S as HEAD, and the first parent of
  the merge that brought S in as the default branch when there is one), so a rebased branch works
  (R2, R3 above) and a merge commit does not lose the start. R6: B3's first companion, the merged
  branch changed no code or test path after S. Item 42's key is not compared: same answer on 18 of
  19 shapes, but it counts untracked code files, so a linked worktree's row read in the main
  checkout after a fast-forward was void by the key (`2c63a070...` there, `f5d6dd16...` here, an
  untracked `notes.txt` in the worktree) and holds by R4.
- **Rows of every worktree's store** (R7). Without it the `mstack worktree new` flow can never
  answer the check where it closes. A row is judged against this tree path by path. This bends
  the documented rule "a receipt from another checkout is not evidence" (`Gates-and-Hooks.md:703-707`)
  for mutation rows only; a reviewer should look at that.
- **B3's second companion** (R8): `verify --mutation` refuses an untracked test file in scope. The
  closing check never voids for an untracked file, so an uncommitted test must not earn a kill.
- **What counts as "a code diff"** (Terms): tracked code paths that differ between the start at
  HEAD and the working tree. After a merge commit on main that start is the base, so base..HEAD may
  hold others' code: an item with code is held either way; an item with **no code of its own** is
  then held wrongly, and after a squash of a branch-based item the start is lost (R2: held,
  overridable, names `state set --base`). The way out for a code-less item is `--base <the commit
  before the merge>` (R2 scenario) or the forced close. Accepted trade-off.
- **No obligation, not held** (R1), as the verification check only warns there. Every problem is
  overridable; a non-overridable lost start (the round 2 draft's R24) would wedge every squash close.
- **The forced close** (R9) reuses `closing.ts`'s `overridable` and `--force --closed-by`; no second
  mechanism. Written: `closed_by` in `state.json`, marker `closed without a killed mutation receipt
  (forced): <why>`, composed with the existing phrases (seven markers, none a prefix of another,
  the three of today byte-identical); printed: `  forced: closed without a killed mutation receipt -
  <problem>`. The gate afterwards prints nothing new: the closed-items audit reads the ledger only,
  and `state show` prints `closed_by`. Today a mutation problem forced through the existing code
  would be recorded as "closed unverified", which R9 fixes.
- **`done` under a lock** (R11): exit 2 whatever `--force`, `--closed-by` and the rule say, with the
  gate's own lock line (message and fix, through the same function), so it names `<CLI that wrote
  the lock> verify --restore`, "wait", or the by-hand recovery.
- **In flight.** Here: none (item 100 is the only active item; tasks 3.3 and 3.4 close it under its
  own rule, no `--force`). Elsewhere: R3's problem names both ways, `verify --mutation` before the
  merge and the forced close after it; and the fork decides whether upgraded stores see it at all.
- **This repository.** The gate's line, in an mstack checkout, also names the copy commands (R3,
  reusing R5's text); each item then needs one copy and one run (198 s for item 42) from a session
  not started with `--plugin-dir .`. Not ceremony by count (0 of 6 would need a forced close), but
  most items here add code their tests import, so the kill mostly proves the tests reach the code.

## Deliberately left open

- V5C: a path first changed on the branch after the run is not seen after a squash or rebase
  merge; git keeps no record of which commits were the item's. Accepted (design.md trade-offs).
- L: other work fast-forwarded onto the default branch before the close voids the receipt.
- Whether `worktree prune` should keep a worktree holding a row of an open item, and whether the
  gate should say which rule held a receipt: design.md "Open questions".
- Items 101-103 are not folded in.
- Linux was not run; the fixtures are macOS on APFS. Rung 4 for git's answers on every shape; the
  rule itself is rung 3 until the code exists (emulated in `eval.mjs`, which imports `measureStart`,
  `mutationKey` and `scopeClass` from this checkout).

## Where the rest is

Scratchpad `spec100/` (session scratchpad of this run): `fact1.mjs` + `fact1.out`, `fact1b.mjs` +
`fact1b.out`, `r5.sh` + `r5.out`, `worktree.sh` + `worktree.out`, `kills.sh` + `kills.out`,
`shapes.sh` + `shapes.out` + `shapes.md` (the 19-row table), `eval.mjs`, `files/` (fixture sources).

## Gate, before the commit

```
[ok]    one active item: mutation-closing-check (specifying)
[ok]    6 open item(s) with a decision fork, each answered or still in specifying
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[warn]  2 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 1 warning
```
