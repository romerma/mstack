# Review - verification-never-runs (round 4)

**Verdict:** APPROVED

Reviewed at `22e220a860a5c3c713186e7f55d17153150fb4c0`. Rounds 1-3 are
`.mstack/progress/review_verification-never-runs.md`, `..._r2.md` and `..._r3.md`. I did not
write this code.

My round-3 finding is closed, and closed properly — untracked symlinks are keyed by their
target string, which is what git itself records, so all four rows fall to one change rather
than four patches. I attacked the new code the way I attacked the last three versions and found
nothing above the bar. **The two extras the implementer reports against itself are real, and
the nested-store one was a live hole that produced a false green — neither of us had named it.**

Cost went down, not up, and I measured it myself rather than taking the number.

## The four rows, at the line

`src/verification.ts:257-286` (`classify`) and `:216-231`. Each row measured against real git on
a real filesystem, `treeId` called directly:

| Round-3 row | Round 3 | Round 4 |
|---|---|---|
| untracked symlink to a **directory** | `unknown` — tree half off | `0cd7b9bd33e5434e` |
| **dangling** symlink | `unknown` — tree half off | `41b24eb74ff3a785` |
| symlink to a **file outside the repo** | followed, hashed the target's bytes | `becec34b102d3942`, target string only |
| symlink to **`/dev/zero`** | `unknown`, **10.6s** per fast gate | `54833b4af9293932`, **0.08s** |

The third row is the one worth proving rather than asserting, so I pointed a link at a
`.gitignore`d file — invisible to the fingerprint on its own — and changed the target's
contents:

```console
$ printf 'v1\n' > payload.secret ; ln -s payload.secret peek
  link present, payload v1: df98dd9c21d0f33b
$ printf 'v2-much-longer-content\n' > payload.secret
  payload changed to v2:    df98dd9c21d0f33b
  >>> the link's TARGET STRING is the signal; nothing was read through it
```

Relinking *does* move it, which is git's model exactly:

```console
$ ln -s /etc/passwd file-link   -> becec34b102d3942
$ ln -sf /etc/hosts file-link   -> 4f541c17d286215e
```

And row 1 end to end through the shipped binary — my round-3 false-green transcript, re-run:

```console
$ ln -s /tmp/r4assets assets              # an ordinary untracked directory link
$ mstack gate --full | rg "check.sh|PASSED"
[ok]    sh check.sh
PASSED - 0 failures, 2 warnings
$ tail -1 .mstack/verification.tsv
probe  24252ff6...  sh check.sh  passed  ...  a0eee58810d48628      <- was `unknown`

$ printf 'exit 1\n' > check.sh ; sh check.sh; echo $?
1
$ mstack gate
[fail]  1 probe (verifying) is one step from done, and `sh check.sh` last ran at 24252ff6, and an uncommitted file has changed since
FAILED - 1 failure, 2 warnings                                     <- was PASSED
$ mstack state set probe --status done
mstack: probe cannot close on a verification that has not run: ...
  status: verifying                                                <- was done
```

Mutation Q1 — bypass `classify` and read every untracked entry again — kills four named tests,
including `an untracked symlink is fingerprinted, never followed and never opened`. Q2 — drop
the target string from the token — kills `a symlink's target contents are not in the key, but
its target is`. No test in the suite created a symlink before this round.

## The two self-reported extras — both real, neither a restatement

**The nested store had its tree half off unconditionally.** This is the one that sounded like it
might be a live hole, and it was. Root cause, measured rather than argued: `git ls-files -o`
prints paths relative to the **current directory**; `git hash-object --stdin-paths` resolves
them relative to the **repository root**.

```console
# cwd = <repo>/sub, where the store lives
$ printf 'check.sh\n'     | git hash-object --stdin-paths
fatal: could not open 'check.sh' for reading: No such file or directory
$ printf 'sub/check.sh\n' | git hash-object --stdin-paths
ca916d098dabfe85979d791e4534bf1def02ef84
$ git ls-files -o --exclude-standard              -> scratch.txt
$ git ls-files -o --exclude-standard --full-name  -> sub/scratch.txt
```

So any store in a subdirectory, with any untracked file at all, fingerprinted `unknown`. I ran
the consequence at round-3 code and at round-4 code in the same store:

```console
### round-3 code (1a05d83), nested store
receipt tree: unknown
verification really exits: 1
[ok]    verification ran and passed at 911b5b2e: sh check.sh
PASSED - 0 failures, 3 warnings
1 probe (done)                        <- closed green on a failing verification

### round-4 code (HEAD), same store
receipt tree: 20a224c5b0cb4f92
[fail]  ... last ran at 911b5b2e, and an uncommitted file has changed since
FAILED - 1 failure, 2 warnings
mstack: probe cannot close on a verification that has not run: ...
```

Same class as my round-3 finding, reachable by nothing more exotic than where the store sits,
and found by the implementer rather than by review. Mutation Q5 (drop `--full-name`) is killed
by `a store in a subdirectory fingerprints its repository, rather than giving up`.

**`treeId` computed twice per gate** — my round-3 minor 1. Counted with a `git` shim on `PATH`,
one fast gate at `verifying`:

```
round 3:  2 diff HEAD ...        2 ls-files -o ...
round 4:  1 diff HEAD --full-index ...   1 ls-files -o ... --full-name ...
```

`src/gate.ts:489-494` computes it once and threads it into `status()`
(`src/verification.ts:375-390`, defaulted so `cmdState`'s single-use call is unaffected —
`src/cli.ts:521` is unchanged and still computes it once for itself).

**The self-correction is accurate.** The implementer's `classify` docstring retracts its own
justification: it had argued the file-kind branch closed a class because "a fifo or a device
node would block `hash-object` the same way with no symlink involved". It would not. I checked
with a fifo, a unix socket and an empty directory in one worktree:

```console
$ ls-files -o --exclude-standard  -> []
$ status --porcelain             -> []
$ treeId                         -> clean
```

Git lists neither. The `/dev/zero` stall only ever arrived *through* a link, the branch is
unreachable through today's `ls-files`, and it is kept as one defensive line with that stated.
There is even a test pinning the unreachability (`git never offers a fifo as untracked, so only
files and symlinks reach the fingerprint`), which is the right way to handle a branch you cannot
reach. Mutation Q4 survives, and it survives *because* the branch is unreachable — an equivalent
mutant, correctly labelled.

## Attacking the symlink handling

| Attack | Result | Right? |
|---|---|---|
| target string contains a **newline** | `c21ea81c53dd3756` | yes — no `hash-object` involved, and `\0` joins the parts |
| symlink to a path **inside `.mstack/`** | fingerprinted; **unchanged** when that store file then changes | yes — the target string is the only signal, so store churn cannot leak back in |
| symlink **loop** (a→b→a) | `5773a1d6bf4b2e4f` | yes — `lstat` does not follow |
| symlink whose **name** contains a newline | fingerprinted (round 3: `unknown`) | yes, and narrower than before |
| regular file whose **name** contains a newline | `unknown` | yes — documented, pinned, warns |
| path **vanishes** between listing and stat | `gone` token, fingerprint moves | yes — the tree really did change |
| **tracked** symlink | goes through `git diff HEAD`, git's own model | yes; relinking captured, nothing read |
| tracked symlink, relinked | `a665b7dc37e1945e`, diff shows `+/etc/hosts` | yes |
| fifo / socket / empty directory | invisible to git, `clean` | yes |
| **non-UTF-8** target string | **collides** — see minor 1 | no, but below the bar |

Tracked symlinks confirmed still on git's path: `git cat-file -p HEAD:tracked` prints
`/etc/passwd`, the target string, and the fingerprint only moves when the link is repointed.

The residual ways the tree half can still turn off are now: git itself failing, a **regular**
file whose name contains a newline, and a regular file vanishing between `lstat` and
`hash-object`. All three warn (`src/gate.ts:505-511`), all three are exotic or transient, and
none is the ordinary `venv` symlink that made round 3 blocking. I accepted "warn" as the
resolution for finding C in round 2 and I hold to that here.

## Cost, measured independently

This repository, fast gate, three runs: **0.06s, 0.07s, 0.08s** — matches the claimed 0.07s.

Synthetic 30k-file repository, whole fast gate at `verifying`, against my own round-3 numbers:

| Dirty set | Round 3 | Round 4 |
|---|---|---|
| clean tree | — | 0.16s |
| 500 modified + 200 untracked | 0.28s | **0.20s** |
| 20,000 untracked, not-yet-ignored files | 0.91s | **0.55s** |
| one 500 MB untracked file | 1.40s | **0.77s** |
| 5,000 untracked symlinks (the new path) | — | **0.19s** |
| untracked symlink to `/dev/zero` | 10.6s | **0.08s** |

And criterion 3's actual claim — that nothing on the `Stop` path executes a verification —
re-checked by side effect rather than by reading the code. With `verify` set to
`touch /tmp/r4-PROOF-IT-RAN`:

```console
$ for i in 1 2 3; do mstack hook stop >/dev/null 2>&1; done
  ok: 3 Stop hooks, the command never executed
$ mstack gate --full >/dev/null 2>&1
  ok: --full executed it
```

Criterion 3 holds, with margin, and round 4 improved it.

## Nothing from rounds 1-3 was weakened

Every earlier mutation re-run at this head. All still killed; several kill more than before:

| Mutation | R1 | R2 | R3 | R4 |
|---|---|---|---|---|
| R1-M1 fast-gate check disabled | 9 | 14 | 17 | **18** |
| R1-M4 closing guard removed | 2 | 4 | 5 | 5 |
| R1-M2 command text ignored in the match | 3 | — | 4 | 4 |
| R1-M7 cost line widened past `verifying` | 1 | 1 | 1 | 1 |
| R2-N1 fail-open catch removed | — | 2 | 2 | 2 |
| R2-N2 tree ignored in the match | — | 3 | 5 | **7** |
| R2-N4 `--force` needs no reason | — | 1 | 1 | 1 |
| R3-P2 back to hashing porcelain | — | — | 1 | 1 |
| R3-P5 `UNKNOWN_TREE` warning removed | — | — | 1 | 1 |
| R3-P7 `.mstack/` exclusion removed | — | — | 3 | **4** |
| R3-N10 tree sampled before the run | — | — | 1 | 1 |

Test diff is 241 added, 2 removed; both removals are `import` lines. No assertion was loosened.

## The four criteria, at this head

**"A session cannot close green on an item whose verification has never been executed at its
current state; the mechanism is a check or a hook, not prose"** — met. `checkVerificationRuns`
(`src/gate.ts:441-520`) on the `Stop` path, plus the closing guard (`src/cli.ts:515-560`). Every
false-green transcript from rounds 1, 2 and 3 now goes red; I re-ran all of them at this head
rather than trusting the reports.

**"`gate --full` that ran no verification is distinguishable in its summary and its exit code
from one that ran and passed"** — met, both halves, live:

```console
[fail]  --full ran no verification: state.json has no 'verify' command and c2 has no 'verification' command
FAILED - 1 failure, 1 warning        exit=1
[ok]    true
PASSED - 0 failures, 1 warning       exit=0
```

**"The cost is bounded ... and the reasoning for where the line falls is recorded"** — met. Side
effect proves the hook runs nothing; the numbers above bound it; the reasoning is at
`src/lifecycle.ts:57-77`, decision `2026-08-21T11:43:30.446Z`, and the wiki rules table.

**"Tests cover a red verification being caught, a green one passing, and the no-verification-
configured case"** — met. 258 tests, and every one I mutated against died by name.

## Verification I ran

```console
$ ./bin/mstack gate --full
PASSED - 0 failures, 0 warnings
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .

PASSED - 0 failures, 0 warnings          exit=0

$ npm test
 258 pass
 0 fail
Ran 258 tests across 14 files. [24.46s]
ℹ tests 258
ℹ pass 258
ℹ fail 0

$ ./bin/mstack ledger check verification-never-runs
FAIL no verdict at 22e220a8; 5 row(s) exist at other SHAs and a new head SHA voids them
```

Round-4 mutations, scratch copy at `scratchpad/mut4`, baseline 107 pass / 0 fail before and
after:

| Mutation | Result |
|---|---|
| Q1 `classify` bypassed, untracked entries read again | 4 fail |
| Q2 symlink target string dropped from the token | 1 fail |
| Q5 `--full-name` removed (the nested-store fix) | 1 fail |
| Q3 `gone` token collapsed into `not-a-regular-file` | 0 fail — equivalent, see minor 3 |
| Q4 non-regular files read instead of described | 0 fail — equivalent, branch unreachable, self-reported |
| Q6 `--full-index` removed | 0 fail — equivalent, a hardening change by construction |

Three survivors, all genuinely equivalent, and one of them the implementer flagged against
itself before I got there.

## Minors

1. `src/verification.ts:272` - `readlinkSync` decodes as UTF-8, so two different non-UTF-8
   symlink targets collide. Reproduced on APFS: targets `b'/tmp/\xff\xfe-x'` and
   `b'/tmp/\xfe\xff-x'` both fingerprint `99845f460c773f07`. Relinking between two such targets
   would not void a receipt. Requires deliberately crafted invalid-UTF-8 targets; the same
   lossy decode applies to filenames out of `ls-files -z` and predates this round. `"buffer"`
   encoding plus a hex token would close it if it ever matters.
2. `src/verification.ts:250` - a regular file that vanishes between `lstat` and `hash-object`
   still yields `UNKNOWN_TREE` for the whole tree. Much narrower than the round-3 window, it
   warns, and the next gate recovers — but it is the one remaining path where a transient turns
   the key off rather than moving the fingerprint, and `classify`'s `gone` token already shows
   the better answer.
3. `src/verification.ts:266,286` - `gone` and `not-a-regular-file` are distinct tokens that no
   caller distinguishes (mutation Q3 collapses them with the suite green). Harmless; collapsing
   them would make "deleted" and "replaced by a socket" fingerprint alike, which is why keeping
   them apart is right even though nothing pins it.
4. Ledger still `FAIL` at HEAD, now 5 rows, all `--verifier implementer`. Structural and
   correctly deferred across all four rounds: the closing pass needs a verdict at the closing
   SHA from a pass that did not write the code. **This is the one thing still outstanding on the
   item**, and it is process, not code.
5. `.mstack/state.json`'s `verify` says `bin/mstack lint-plugin .` while item 14's
   `verification` says `./bin/mstack lint-plugin .`, so the dedupe still does not fire here and
   every `gate --full` in this repository runs the suite twice. Store data; the implementer was
   right not to edit the item under review.

## Where each round-4 claim stopped on the ladder

| Claim | Rung | What got it there |
|---|---|---|
| All four symlink rows are closed | 5 | `treeId` against real git per row, plus row 1 end to end through `./bin/mstack` |
| Nothing is read through a link | 5 | Link to a gitignored file; target contents changed, fingerprint did not move |
| The nested-store hole was live and is fixed | 5 | Round-3 code closed an item `done` on a verification exiting 1 in a subdirectory store; round-4 code refuses |
| `treeId` runs once per gate now | 5 | `git` shim on `PATH`, invocations counted |
| The fifo/device branch is unreachable | 5 | fifo, unix socket and empty directory, invisible to both `ls-files -o` and `status --porcelain` |
| The Stop hook executes no verification | 5 | Side-effect test: `verify` set to `touch <path>`, three hooks, file never created |
| Cost is bounded and went down | 5 | 30k-file repo, five dirty-set shapes, plus this repository three times |
| Nothing from rounds 1-3 was weakened | 4 | Eleven earlier mutations re-run; all killed, three killing more |
| The three round-4 survivors are equivalent | 4 | Q4 verified unreachable; Q3 and Q6 verified as value-only changes with symmetric application |
| Non-UTF-8 filenames collide the same way as targets | **3** | Walked from the same `encoding: "utf8"` decode; **not reproduced on APFS**, which enforces UTF-8 filenames, so not written up as settled |
