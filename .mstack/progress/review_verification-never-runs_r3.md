# Review - verification-never-runs (round 3)

**Verdict:** CHANGES_REQUESTED

Reviewed at `1a05d83b765c34b9b98cf874705788d26888f28e`. Rounds 1 and 2 are
`.mstack/progress/review_verification-never-runs.md` and `..._r2.md`. I did not write this code.

**A, B and C are all closed.** I re-ran my own round-2 transcripts rather than inheriting the
coordinator's, and each one now goes the other way. The three "equivalent by measurement"
mutants really are equivalent — I built the separating fixture myself and the phrase is not
doing work an assertion should do. Nothing from rounds 1 or 2 was weakened; every prior
mutation now kills *more* tests than it did.

One thing remains, and it is above the bar rather than below it, which is why this is not an
approval: **an ordinary untracked symlink turns the tree half of the key off for the whole
session, and the item then closes green on a verification that exits 1.** It is announced by a
warning — but the warning names a cause that is not the cause, so nobody can act on it. One
focused change fixes every symptom at once. Everything else I found is in minors.

## A, B and C at the line

**A — the tree key hashes contents.** `src/verification.ts:134-176`. My round-2 transcript,
re-run at this head with the dirty-before-the-run precondition that made it work:

```console
$ printf 'exit 0  # tweak\n' > check.sh
$ git status --porcelain
 M check.sh
$ mstack gate --full | rg "check.sh|PASSED"
[ok]    sh check.sh
PASSED - 0 failures, 2 warnings
$ tail -1 .mstack/verification.tsv
probe  a5b9236c...  sh check.sh  passed  2026-08-21T14:02:20.156Z  d4f2a660d12bcfb2

$ printf 'exit 1\n' > check.sh          # RED now; porcelain line unchanged
$ git status --porcelain
 M check.sh
$ mstack gate | rg "uncommitted|FAILED"
[fail]  1 probe (verifying) is one step from done, and `sh check.sh` last ran at a5b9236c, and an uncommitted file has changed since
FAILED - 1 failure, 2 warnings
$ mstack state set probe --status done
mstack: probe cannot close on a verification that has not run: `sh check.sh` last ran at a5b9236c, and an uncommitted file has changed since
$ status: verifying
```

And the untracked variant, which `git diff HEAD` alone would have missed — an untracked
`run.sh` calling an untracked `helper.sh`, where `ls-files -o` output is byte-identical before
and after:

```console
$ printf 'exit 1\n' > helper.sh
$ git ls-files -o --exclude-standard
helper.sh run.sh
$ mstack gate | rg "uncommitted|FAILED"
[fail]  1 probe (verifying) is one step from done, and `sh run.sh` last ran at a5b9236c, and an uncommitted file has changed since
FAILED - 1 failure, 2 warnings
```

Mutation P2 — revert `treeId` to hashing `status --porcelain` — is killed by
`editing an already-dirty tracked file voids the receipt, though its status line does not move`.
Mutation P1 — drop the untracked hashing and keep only `git diff HEAD` — kills three tests. The
message was corrected too: `src/verification.ts:305-311` now says "an uncommitted file has
changed since" instead of the round-2 claim to vouch for "the files as they are now", which is
the half of finding A that was about a message telling a reader it checked something it had not.

**B — the sampling order is pinned.** `src/gate.ts:557-573`. Mutation N10, which survived the
entire suite in round 2, is now killed by
`a verification that writes into the repository does not void its own receipt`. Verified live
with a verification that appends to a file in the repo:

```console
$ mstack gate --full | rg "check.sh|PASSED"
[ok]    sh check.sh
PASSED - 0 failures, 1 warning
$ git ls-files -o --exclude-standard
build.log
$ mstack gate   ->  verification ran and passed
$ mstack state set probe --status done  ->  1 probe (done)
```

The comment's overstatement I flagged is corrected too: `src/gate.ts:562-564` now says a second
`--full` recovers rather than claiming a permanent red.

**C — `unknown` is said out loud.** `src/gate.ts:499-508`. Mutation P5 is killed by
`a tree git cannot describe is said out loud, not passed over in silence`. Verified live, in
both directions — the fail-closed one, where a real hash cannot match `unknown`:

```console
$ chmod 000 .git/index && mstack gate
[warn]  git could not describe the working tree, so only the commit half of the verification key was checked; an uncommitted change since the run would not be noticed
[fail]  1 probe (verifying) is one step from done, and `sh check.sh` last ran at 7740286f, and an uncommitted file has changed since
FAILED - 1 failure, 3 warnings
```

and the fail-open one, where the receipt itself was recorded as `unknown` — green, with the
warning attached, which is exactly the fix I asked for in round 2:

```console
$ tail -1 .mstack/verification.tsv
probe  7740286f...  sh check.sh  passed  ...  unknown
$ mstack gate
[warn]  git could not describe the working tree, so only the commit half of the verification key was checked; ...
[ok]    verification ran and passed at 7740286f: sh check.sh
PASSED - 0 failures, 3 warnings
```

I accepted "warn" over "fail" here in round 2 and I stand by it. The finding below is not a
reversal of that; it is that the warning's *cause* is wrong and its *trigger* is far broader
than "git could not be asked".

## Changes required

### 1. An untracked symlink turns the tree key off, and the warning blames the wrong thing

`src/verification.ts:152-166` hashes untracked files with `git hash-object --stdin-paths`. That
command **follows symlinks and hashes the target's bytes**, which is not git's own model — git
stores a symlink's blob as its *target string*. Measured side by side:

```console
$ ln -s /etc/passwd untracked-link
$ git hash-object untracked-link                   = 1fcfce0273748836c782be7fa7abbc0cebc610cb   # /etc/passwd's contents
$ printf '/etc/passwd' | git hash-object --stdin   = 3594e94c04db171e2767224db355f514b13715c5   # the target string
$ git add untracked-link; git ls-files -s          -> 3594e94c04db171e2767224db355f514b13715c5   # what git actually records
```

Tracked symlinks are fine — they go through `git diff HEAD`, which uses git's model, and
relinking is captured correctly. The whole exposure is **untracked, non-ignored** symlinks,
which is a narrow class but an ordinary transient one: you make the link, you have not yet
committed it or added it to `.gitignore`. Three failure modes, all reproduced:

| Untracked symlink | `treeId` | Cost |
|---|---|---|
| to a directory (a `venv`, a shared assets dir, a package link) | `unknown` | 0.07s |
| dangling (an artifact not built yet, a pruned worktree) | `unknown` | 0.07s |
| to a file | follows it, hashes bytes **outside the repository** | size of the target |
| to `/dev/zero` or similar | `unknown` | **10.6s per fast gate** |

The first row is the one that matters, and it produces a false green through the shipped binary
in two commands:

```console
$ mkdir -p /tmp/shared-assets && ln -s /tmp/shared-assets assets
$ git ls-files -o --exclude-standard
assets

$ mstack gate --full | rg "check.sh|PASSED"
[ok]    sh check.sh
PASSED - 0 failures, 2 warnings
$ tail -1 .mstack/verification.tsv
probe  93962bb5...  sh check.sh  passed  ...  unknown         <- the tree half is now off

$ printf 'exit 1\n' > check.sh
$ sh check.sh; echo $?
1                                                             <- the verification really is red

$ mstack gate
[warn]  git could not describe the working tree, so only the commit half of the verification key was checked; an uncommitted change since the run would not be noticed
[ok]    verification ran and passed at 93962bb5: sh check.sh
PASSED - 0 failures, 3 warnings

$ mstack state set probe --status done
1 probe (done)
  status: "verifying" -> "done"
```

Git described that working tree perfectly. One path could not be fed through `hash-object`. A
reader who takes the message at its word will go looking for a broken git installation, find
nothing wrong, and leave the tree key off for the rest of the session — which is a message that
misdirects on the one path where the mechanism admits it did not check. Round 3's own
contribution to this item was fixing exactly that shape in `why()`.

**Fix, one change for all four rows.** Do not follow the link: for an untracked symlink, hash
its target string, which is what git itself records. Then a dangling link and a directory link
fingerprint normally instead of disabling the key, `/dev/zero` is never opened, and nothing
outside the repository is read on a hook that fires every turn. `git ls-files -o` already
distinguishes them, or `lstat` does.

If you would rather keep following links, then the minimum is the other half: make the warning
name the actual cause ("a path could not be hashed: `<path>`") so the degradation is
actionable, and add a test for an untracked symlink so the behaviour is pinned either way.
Right now no test in the suite creates a symlink.

## The three "equivalent by measurement" mutants — they really are equivalent

Asked to say plainly whether that phrase is doing work an assertion should do. **It is not.** I
rebuilt the separating fixture myself — an untracked path `two<newline>lines.js` in a store
where `two` and `lines.js` both exist, so `hash-object --stdin-paths` *succeeds* and returns two
hashes for one listed path — and ran all four variants through the real `treeId`:

```console
untracked, NUL-separated: lines.js|two|two\nlines.js|
hash-object on those two lines:  f70f10e4...  223b7836...     (two hashes, one path)

shipped                    -> unknown
R3-C2 alone (no nl guard)  -> unknown        (the count check catches it)
R3-A4 alone (no count chk) -> unknown        (the newline guard catches it)
BOTH removed               -> b15bf7f35741ccc9   <- a real fingerprint that silently drops a file
```

Two guards, each redundant given the other, and the *behaviour* — a newline path yields
`unknown`, never a partial fingerprint — is pinned by
`a newline in an untracked path yields an unknown tree, not a partial one`, which kills the pair
`R3-CA`. What is unpinned is only which of two redundant guards enforces it. That is the
textbook definition of an equivalent mutant, and calling it one is right.

`R3-C3` (drop `raw` on the diff) survives, and the reasoning holds: both the record path
(`src/gate.ts:573`) and the check path (`src/verification.ts:230`) call the same `treeId`, so
any normalisation applies to both sides of every comparison. I could not construct two working
trees whose diffs differ only in leading or trailing whitespace. The implementer also corrected
its own false claim in `src/git.ts:24-48` — the comment used to assert `raw` was load-bearing
for `ls-files -z`, and now states at rung 4 that no current behaviour distinguishes it, with the
original reason kept as history. That is the right way to retire a wrong comment.

I looked for an eighth check-that-cannot-fail and did not find one in the round-3 code. The
three survivors are the only ones, and all three are accounted for.

## Attacking the content hashing

Behaviour matrix, each row a separate `treeId` against real git on a real filesystem:

| Change | Captured? | Right? |
|---|---|---|
| tracked **binary** file, contents changed | yes, via the `index <old>..<new>` blob line | yes |
| tracked file, **mode changed, bytes identical** | yes, via `old mode`/`new mode` | yes |
| tracked file deleted | yes | yes |
| untracked file, contents changed | yes | yes — this is what `git diff HEAD` alone would miss |
| untracked file deleted, tree restored | back to `clean` | yes, and reversible |
| two empty untracked files, different names | distinct | yes — paths are in the key (mutation P6 kills its test) |
| `.gitignore`d file created or changed | ignored | yes — build output is not the project |
| filename containing a newline | `unknown` | yes, deliberate and pinned |
| filename ending in a space | fingerprinted | yes — `-z` earns it |
| untracked symlink | see finding 1 | **no** |

Cost, measured on a synthetic 30k-file repository rather than argued:

| Scenario | `treeId` | whole fast gate |
|---|---|---|
| clean tree | 0.09s | — |
| 500 modified + 200 untracked (the implementer's own case) | 0.13s | **0.28s** |
| 20,000 untracked, not-yet-ignored files (a fresh `node_modules`) | 0.44s | 0.91s |
| one 500 MB untracked, non-ignored file | 0.70s | 1.40s |
| ...after `.gitignore`ing it | 0.11s | — |
| this repository at HEAD | — | **0.06-0.07s** (matches the coordinator's 0.07s) |

Criterion 3 holds. The pathological cases are ~1s on the Stop hook and the remedy — gitignore
the artifact — is what a user does anyway. The one case that does not hold is the endless
symlink at 10.6s, which finding 1 removes.

## Nothing from rounds 1 and 2 was weakened

Every earlier mutation re-run at this head, and the counts went up rather than down:

| Mutation | R1 | R2 | R3 |
|---|---|---|---|
| R1-M1 fast-gate check disabled | 9 | 14 | **17** |
| R1-M4 closing guard removed | 2 | 4 | **5** |
| R1-M2 command text ignored in the match | 3 | — | **4** |
| R1-M5 `--full` that ran nothing warns again | 2 | 2 | 2 |
| R1-M7 cost line widened past `verifying` | 1 | 1 | 1 |
| R2-N1 fail-open catch removed | — | 2 | 2 |
| R2-N2 tree ignored in the match | — | 3 | **5** |
| R2-N4 `--force` no longer needs a reason | — | 1 | 1 |
| R2-N5 migration warning removed | — | 1 | 1 |

Round 3 also closed a round-2 nit I did not require: `src/cli.ts:579-583` now carries the
`closed unverified (forced):` marker across a later `--closed-by`, so
`skills/ship/SKILL.md`'s post-merge command can no longer erase the only durable record of a
forced close. Mutation P8 is killed by `a later note cannot quietly erase the forced-close
marker`. The double `closed_by:` change line is gone too.

## Verification I ran

```console
$ ./bin/mstack gate --full
PASSED - 0 failures, 0 warnings
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .

PASSED - 0 failures, 0 warnings

$ npm test
 252 pass
 0 fail
Ran 252 tests across 14 files. [23.76s]
ℹ tests 252
ℹ pass 252
ℹ fail 0

$ ./bin/mstack ledger check verification-never-runs
FAIL no verdict at 1a05d83b; 4 row(s) exist at other SHAs and a new head SHA voids them
```

Mutation run, scratch copy at `scratchpad/mut3`, baseline 101 pass / 0 fail confirmed before and
after:

| Mutation | Result |
|---|---|
| N10 tree sampled before the commands (round-2 finding B) | **1 fail — now killed** |
| P5 `UNKNOWN_TREE` warning removed (round-2 finding C) | 1 fail |
| P1 untracked content hashing dropped | 3 fail |
| P2 back to hashing porcelain (round-2 behaviour) | 1 fail |
| P6 untracked paths dropped from the key | 1 fail |
| P7 the `.mstack/` exclusion removed | 3 fail |
| P8 forced marker no longer survives a later note | 1 fail |
| P9 `CLEAN_TREE` sentinel removed | 2 fail |
| R3-C2 newline guard alone / R3-A4 count check alone / R3-C3 `raw` | 0 fail — equivalent, verified above |
| R3-CA both guards removed | 1 fail |

Also counted git invocations with a shim on `PATH` — see minor 1.

## Minors

1. `src/gate.ts:502` and `src/verification.ts:230` - `treeId` is computed **twice** per fast
   gate. Counted with a `git` shim on one gate run: `2 diff HEAD ...`, `2 ls-files -o ...`. It
   doubles the whole content-hashing cost on the Stop-hook path — 0.28s instead of 0.14s at
   30k files, 1.40s instead of 0.70s with a large untracked file. Computing it once and passing
   it into `status()` halves it for free.
2. `src/verification.ts:134` - `git diff HEAD` abbreviates the `index` blob hashes to 7 hex
   characters, which is the entire content signal for binary files. Fine against accidental
   drift, and I am not claiming an attack; `--full-index` would remove the question for nothing.
3. `src/verification.ts:152` - `hash-object --stdin-paths` re-reads every untracked file on
   every fast gate. Bounded (measured above) and correct, but a 500 MB untracked artifact costs
   0.7s per turn until someone gitignores it. Worth a sentence in the wiki so the remedy is
   obvious when it happens.
4. Ledger still `FAIL` at HEAD, now 4 rows, all `--verifier implementer`. Unchanged from rounds
   1 and 2, structural, and correctly deferred — the closing pass needs a verdict at the closing
   SHA from a pass that did not write the code.
5. `.mstack/state.json` still has `verify: "... bin/mstack lint-plugin ."` against item 14's
   `verification: "... ./bin/mstack lint-plugin ."`, so the dedupe does not fire here and every
   `gate --full` in this repository runs the suite twice. Store data, not code; the implementer
   was right to leave it.

## Where each round-3 claim stopped on the ladder

| Claim | Rung | What got it there |
|---|---|---|
| Finding A is closed, tracked and untracked | 5 | My round-2 transcripts re-run through `./bin/mstack`; gate red, close refused, status unchanged |
| Finding B is closed | 5 | Verification that appends to a repo file; green fast gate immediately after, and N10 now dies |
| Finding C is closed | 5 | Unreadable `.git/index`, both the fail-closed and the fail-open direction |
| An untracked symlink produces a false green | 5 | Shipped binary, directory symlink, verification exiting 1, item closed `done` |
| `hash-object` follows symlinks where git's index does not | 5 | Hashes compared against `git add`'s recorded blob |
| The three survivors are equivalent mutants | 4 | Separating fixture built and all four variants run through the real `treeId` |
| Nothing from rounds 1-2 was weakened | 4 | Nine earlier mutations re-run; every one still killed, most killing more |
| Cost is bounded | 5 | 30k-file synthetic repo, four dirty-set shapes, plus a `git` call count |
| `R3-C3` is equivalent for all inputs | **3** | Symmetric application walked, and I could not construct a counterexample. **Not exhaustive**, and not written up as settled |
