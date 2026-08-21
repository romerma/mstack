# Review - verification-never-runs (round 2)

**Verdict:** CHANGES_REQUESTED

Reviewed at `85c231176a2f0da25b8d061bab3f2f6c9d997125`. Round 1's report is
`.mstack/progress/review_verification-never-runs.md`. I did not write this code.

**Six of my eight findings closed cleanly, and the two blocking ones closed as demoed.** I
re-ran both of the coordinator's demonstrations myself rather than inheriting them, and both
hold. The new verdict rests on one thing: the tree key added to close finding 2 fingerprints
*which paths are dirty*, not *what is in them*. If the tree was already dirty when
`gate --full` ran — the ordinary mid-session state — every further edit confined to those same
paths is invisible, the fast gate says "verification ran and passed", and the item closes at
exit 0 with the verification red. That is finding 2 again, one layer in, and the code, the
wiki and the runtime message all state the opposite guarantee.

Everything else below is either closed, or a smaller item I would not block on alone.

## The eight findings, at the line

| # | Round-1 finding | Closed? | Evidence |
|---|---|---|---|
| 1 | Unreadable receipt turns the Stop hook silently green | **Yes** | `src/gate.ts:488-497`; re-verified live; mutation N1 kills 2 named tests |
| 2 | Receipt certifies a commit, not a tree | **Partly** | `src/verification.ts:134-150`; closes the clean-tree case, not the dirty-tree case. See finding A |
| 3 | Pre-existing stores get no migration and no warning | **Yes** | `src/gate.ts:120-138`; both recovery branches verified live; `CHANGELOG.md` upgrade note |
| 4 | Whitespace half of the command match untested | **Yes** | `tests/verification.test.ts:180-215`; mutation N3d kills it. My round-1 claim was overstated — see the correction below |
| 5 | `--force` leaves no durable trace | **Yes** | `src/cli.ts:528-582`; `closed_by` is written and marked; verified live |
| 6 | Ledger stale at HEAD | **No, and correctly deferred** | Still `FAIL` at `85c23117`. Not the implementer's to close. See finding D |
| 7 | Reviewer path starts red with no `verify` configured | **Yes** | `agents/reviewer.md:21-26` |
| 8 | `db80b45` scope judgement | n/a | I ruled it in scope in round 1; unchanged |

Plus the round-1 nits: dedupe landed (`src/verification.ts:95-107`, mutation N8 kills a named
test), `Status` renamed `RunStatus` (`src/verification.ts:213`), the `obligations` guard order
fixed, the concurrency rung recorded honestly in the module docstring
(`src/verification.ts:32-40`), and the cleanup playbook updated
(`skills/router/playbooks/cleanup.md:22-29`).

### Correction to my own round-1 finding 4

Round 1 said mutation M12 surviving meant "a trailing newline in a `verification` field would
void every receipt". That consequence was inferred, not run, and it was **wrong**: `cell()`
trims both sides (`src/tsv.ts:22`), so the trim in `obligations` is redundant for matching. I
re-ran it: N3b (stop trimming the stored text) survives, N3c (remove `cell`'s trim) survives,
and **N3d (remove both) kills `surrounding whitespace is the same command; internal whitespace
is not`**. The behaviour is genuinely pinned; the two single-site mutants are equivalent
mutants, not coverage gaps. The finding was right that the boundary was unpinned; my stated
consequence was a rung-2 inference written as settled, which is the thing this ladder exists
to stop. Recording it because a rule that only holds when the reviewer does not slip is not a
rule.

## Changes required

### A. BLOCKING - the tree fingerprint is a hash of dirty *paths*, not of their contents

`src/verification.ts:134-150` hashes the sorted lines of `git status --porcelain` with
`.mstack/` paths removed. A porcelain line is two status characters and a path. Editing an
already-modified file's contents does not change its line, so the fingerprint does not move.

Reproduced at rung 5 through `./bin/mstack`, three commands after a green run:

```console
$ printf 'exit 0  # tweak\n' > check.sh      # tree already dirty, verification still passes
$ git status --porcelain
 M check.sh

$ mstack gate --full | rg "check.sh|PASSED"
[ok]    sh check.sh
PASSED - 0 failures, 2 warnings

$ column -s$'\t' -t .mstack/verification.tsv | tail -1
probe  21bdc768...  sh check.sh  passed  2026-08-21T13:06:32.925Z  e5ab4f4c9929cb0b

$ printf 'exit 1\n' > check.sh               # the verification is now RED, uncommitted
$ git status --porcelain
 M check.sh                                  # same line, so the same fingerprint

$ mstack gate | rg "verification|PASSED"
[ok]    verification ran and passed at 21bdc768: sh check.sh
PASSED - 0 failures, 2 warnings

$ mstack state set probe --status done; echo "EXIT=$?"
1 probe (done)
  status: "verifying" -> "done"
EXIT=0
```

That is byte-for-byte the finding-2 transcript from round 1, with one extra precondition: the
tree had to be dirty when `--full` ran. It is a strictly narrower hole than round 1's, and the
change is a real improvement — but it is still a green gate on a stale verification, which is
the coordinator's own stated bar.

Three statements assert the guarantee this does not provide:

- `src/verification.ts:112` - *"A fingerprint of everything uncommitted, outside the store."*
- `src/verification.ts:~215`, the runtime message a user reads - *"against a different working
  tree, so it does not vouch for the files as they are now."* It does not vouch for the files;
  it vouches for the list of which files are dirty.
- `docs/wiki/State-Files.md` - *"`tree` is `clean` when nothing outside `.mstack/` was
  uncommitted, and otherwise a hash of what was."*

No test covers the dirty-at-run-time case. `an uncommitted edit after the run voids the
receipt` and `a modified tracked file voids the receipt too` (`tests/gate.test.ts`) both start
from a quiesced, clean tree, so both exercise clean -> dirty, which does move the fingerprint.

**Fix.** Hash content alongside the path set. `git diff HEAD` with the store excluded covers
the reproduced case, and I measured its cost so the recommendation is grounded rather than
asserted — on a synthetic 30k-file repository with 500 modified files it is **50ms**, the same
order as the `git status` already being paid:

```console
$ tracked files: 30001
$ /usr/bin/time -p env GIT_OPTIONAL_LOCKS=0 git diff HEAD >/dev/null      # 1 modified file
real 0.03
$ /usr/bin/time -p env GIT_OPTIONAL_LOCKS=0 git diff HEAD >/dev/null      # 500 modified files
real 0.05
```

And it distinguishes the repro, where porcelain does not:

```console
porcelain A:  M check.sh    diffhash A: e8665817b16c
porcelain B:  M check.sh    diffhash B: fe3fcf1186e2
```

Residual, so the fix is not written up as complete: `git diff HEAD` does not cover the
*contents* of untracked files, only their paths. A temp-index `git read-tree HEAD; git add -A;
git write-tree` covers everything at roughly the cost of a `git add`, if you want the whole
thing.

**I will also accept the honest-limit alternative**, and this is not a formality — if you judge
content hashing the wrong trade, then correct the three statements above to say what the key
actually proves ("which paths are uncommitted", not "the files as they are now"), add a test
that pins the dirty-at-run-time case as *known and permitted*, and put the limit in the
`Gates-and-Hooks` rules table next to the row that currently claims the opposite. What is not
acceptable is a mechanism whose message tells a reader it checked something it did not.

### B. REQUIRED - the tree is sampled after the run, and nothing pins that

`src/gate.ts:545-552` samples `treeId` once, after every command, and the comment above it
carries the reasoning. **Mutation N10 — move the sample before the loop — leaves the entire
suite green: 92 pass, 0 fail.**

The ordering is load-bearing and the consequence is real. A verification that writes anything
into the repository voids its own receipt the moment it runs, and the gate goes red
immediately after a green `--full`:

```console
### shipped code (sampled after): verification is `sh check.sh`, which appends to build.log
$ mstack gate --full | rg "check.sh|PASSED"
[ok]    sh check.sh
PASSED - 0 failures, 1 warning
$ mstack gate      -> verification ran and passed

### same store, tree sampled BEFORE the commands
$ mstack gate --full | rg "check.sh|PASSED"
[ok]    sh check.sh
PASSED - 0 failures, 1 warning
receipt tree = clean
$ mstack gate      -> against a different working tree
```

A red gate straight after a green full run is the disable-it failure criterion 3 exists to
bound, and it is one line from returning with no test to catch it. (The comment slightly
overstates in the other direction: it says "leaving the gate permanently red", and a second
`--full` recovers, because the artifact exists by then. Worth correcting while you are there.)

**Fix:** a test with a verification that writes a file into the repository, asserting the fast
gate is green immediately afterwards. Confirm it kills N10.

### C. REQUIRED - `UNKNOWN_TREE` silently disables the tree half

`src/verification.ts:141` returns `UNKNOWN_TREE` when git cannot be asked, and the comment
says "Both sides compute it, so it still matches." They do — which means a receipt recorded
while git was unavailable is satisfied by a check while git is unavailable, with the tree
entirely unchecked and **no warning anywhere**.

It is reachable with one chmod, and `rev-parse` keeps working so `headSha` does not
short-circuit it:

```console
$ chmod 000 .git/index
$ git rev-parse HEAD          -> ccfbf031d68b70b8c7991f64d5c14de227d6d013
$ git status --porcelain      -> fatal: .git/index: index file open failed: Permission denied

$ mstack gate --full >/dev/null 2>&1
$ tail -1 .mstack/verification.tsv
probe  ccfbf031...  sh check.sh  passed  2026-08-21T13:07:58.950Z  unknown

$ printf 'exit 1\n' > check.sh          # verification now red, uncommitted
$ mstack gate      -> verification ran and passed at ccfbf031: sh check.sh
$ mstack state set probe --status done  -> 1 probe (done), exit 0
```

Likelihood, measured rather than guessed: I timed `git status --porcelain` on a 30k-file
repository at **40ms**, so the 5-second `GIT_TIMEOUT_MS` is not a realistic trigger and I am
not claiming it is. The unreadable-index path is exotic. What makes this worth fixing is not
the odds but the silence — `unknown` is the one value that turns the key off, and the gate
prints `verification ran and passed` while it does.

**Fix:** `report.warn` from `checkVerificationRuns` when the computed tree is `UNKNOWN_TREE`,
saying the tree half could not be checked. One line, and the existing `no commit to check a
verification run against` warning three lines up is the shape.

### D. CARRIED - the ledger is still stale at HEAD

```console
$ ./bin/mstack ledger check verification-never-runs
FAIL no verdict at 85c23117; 3 row(s) exist at other SHAs and a new head SHA voids them
```

All three rows are `--verifier implementer`, so none of them can close the item
(`src/roles.ts:103`). The implementer's round-2 note #4 says this stands by design and I agree
— a row cannot name the commit that carries it. Recorded, not waived: whoever closes this item
needs a verdict at the closing SHA from a pass that did not write the code.

## What round 2 did *not* weaken

I re-ran round 1's mutations against the round-2 head. Every guarantee round 1 established is
still pinned, and the counts went up rather than down:

| Round-1 mutation | Round 1 | Round 2 |
|---|---|---|
| M1 fast-gate check disabled (`src/gate.ts:74`) | 9 fail | **14 fail** |
| M4 closing guard removed (`src/cli.ts:508`) | 2 fail | **4 fail** |
| M5 `--full` that ran nothing warns again | 2 fail | 2 fail |
| M7 cost line widened past `verifying` | 1 fail | 1 fail |

Specifically on the three the coordinator asked about:

- **Bounded cost.** Still `verifying` only (`src/lifecycle.ts:76`, M7 kills a named test).
  Measured on the 30k-file repository: fast gate **0.10s at `in_progress`** (no `treeId`)
  against **0.15s at `verifying`** (with it). The extra `git status --porcelain` costs ~50ms
  and only inside the `verifying` window. Criterion 3 holds, at rung 5 with numbers.
- **Exact-command match.** Unchanged and now pinned end to end (N3d). Strict past the edges,
  tolerant of surrounding whitespace, and the strict direction fails closed.
- **Closing-transition-only demand.** Unchanged; `only the move into done is guarded` still
  passes, and M4 still kills it.

## The tree key, attacked

Behaviour mapped live in one store, each row a separate `mstack gate` run after a green
`--full`:

| Change | Voids the receipt? | Right? |
|---|---|---|
| `.gitignore`d file edited | no | yes — porcelain excludes ignored paths |
| anything under `.mstack/` | no | yes, and essential: `state set --status done` writes `state.json` itself |
| unrelated `README.md` edited | **yes** | defensible, see below |
| untracked file added | yes | yes |
| file mode change only | yes | yes |
| tracked file *re-edited while already dirty* | **no** | **no — finding A** |
| detached HEAD | works | yes |
| empty repo, no commits | `headSha` is null, warns and skips | yes, unchanged from round 1 |
| submodule pointer moved | yes (` M sub`) | yes |

On "editing an unrelated README voids the receipt and re-runs the suite": I do not think this
is the disable-it failure. Committing the README also voids it (new SHA), so the friction is
not new in kind, and the `.mstack/` exclusion — which I confirmed is what keeps
`state set --status done` from voiding its own receipt — removes the one case that would have
fired every turn. Scoping the fingerprint to files a verification "could touch" is undecidable
and would be a worse mechanism. Recorded as considered and accepted, not overlooked.

## The fail-open fix, given a hard look

Shape, against the sibling at `src/gate.ts:227-238`: identical. Same
`let x: ReturnType<typeof f>` declaration outside the block, same `try`, same
`catch (error)` -> `report.fail(<what it is stopping>: ${(error as Error).message}, <how to get
past it>)` -> `return`. Rung 2, read side by side.

Genuinely pinned, not decorative — **mutation N1 (remove the catch) kills two named tests**:

```
✖ an unreadable receipt file is a failure, not a green gate
✖ an unreadable receipt file does not stop the checks below it either
```

The second one is the half that is easy to miss and it is there: it asserts the workspace
section still runs and quiet mode still prints, which is the "threw out of the middle" symptom
rather than the "reported wrong" one.

Coverage of the read: every `receipts()` call goes through `status()`
(`src/verification.ts:229`), and `status()` has exactly two callers, `src/gate.ts:490` and
`src/cli.ts:511`. Both are now wrapped. No unguarded read remains — checked by grep, rung 2.

Re-verified live at the round-2 head, the same `chmod` that produced silence in round 1:

```console
$ chmod 000 .mstack/verification.tsv
$ mstack gate | tail -1
FAILED - 1 failure, 1 warning
$ mstack hook stop 2>/dev/null | head -c 110
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before cl
$ mstack hook stop 2>&1 >/dev/null | head -c 130
[fail]  1 probe (verifying) is one step from done, and its verification runs could not be read: EACCES: permission denied, open '/
```

Finding 1 is closed.

## Verification I ran

```console
$ ./bin/mstack gate --full
PASSED - 0 failures, 0 warnings
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .

PASSED - 0 failures, 0 warnings
exit=0

$ npm test
 243 pass
 0 fail
Ran 243 tests across 14 files. [20.70s]
ℹ tests 243
ℹ pass 243
ℹ fail 0

$ ./bin/mstack ledger check verification-never-runs
FAIL no verdict at 85c23117; 3 row(s) exist at other SHAs and a new head SHA voids them
```

Mutation run, scratch copy at `scratchpad/mut2`, baseline 92 pass / 0 fail confirmed before
and after:

| Mutation | Result |
|---|---|
| N1 fail-open catch removed (`src/gate.ts:488`) | 2 fail |
| N2 tree ignored in the match (`src/verification.ts:207`) | 3 fail |
| N3b stored command text not trimmed | 0 fail (equivalent mutant) |
| N3c `cell()` no longer trims (`src/tsv.ts:22`) | 0 fail (equivalent mutant) |
| N3d both trims removed | 1 fail — the behaviour is pinned |
| N4 `--force` no longer needs a reason (`src/cli.ts:537`) | 1 fail |
| N5 migration warning removed (`src/gate.ts:114`) | 1 fail |
| N6 `.mstack/` no longer excluded from the tree id | 2 fail |
| N7 `raw` dropped, porcelain's leading space trimmed | 2 fail |
| N8 obligation dedupe removed | 1 fail |
| **N10 tree sampled before the commands, not after** | **0 fail — finding B** |
| R1-M1 / M4 / M5 / M7 (round-1 guarantees) | 14 / 4 / 2 / 1 fail |

## Nitpicks

1. `src/cli.ts:573-580` - the `closed unverified (forced):` marker is the only durable record
   of a forced close, and a later plain `--closed-by` erases it. Reproduced:
   `state set probe --closed-by "PR #12 merged"` leaves `closed_by = "PR #12 merged"`, marker
   gone. Not contrived — `skills/ship/SKILL.md:33` instructs exactly that command after a
   merge. Preserving the prefix when it is already present would cost one line.
2. `src/cli.ts:573-578` - a forced close prints two consecutive `closed_by:` change lines, the
   user's value and then the marked one. Honest, but it reads like a bug.
3. `src/gate.ts:~385` and `src/verification.ts:137` - the fast gate now runs
   `git status --porcelain` twice per invocation while an item is at `verifying`, once in
   `checkWorkspace` and once in `treeId`, and `GIT_OPTIONAL_LOCKS=0` means neither can reuse
   the other's index refresh. 40ms each at 30k files, so this is a nit and not a defect;
   threading one porcelain read through the report would remove it.
4. `src/verification.ts:32-40` - thank you for recording the concurrency rung as rung 3 rather
   than rounding it up. Nothing to change.
5. Implementer's round-2 note #2 is right: `state.verify` says `bin/mstack lint-plugin .` and
   item 14's `verification` says `./bin/mstack lint-plugin .`, so the dedupe does not fire in
   this store and every `gate --full` here still runs the suite twice — visible in
   `.mstack/verification.tsv`, two rows per run. It is store data, and they were right not to
   edit the item under review.

## Where each round-2 claim stopped on the ladder

| Claim | Rung | What got it there |
|---|---|---|
| The tree key is blind to content changes within already-dirty paths | 5 | Scratch store, shipped `./bin/mstack`, green gate and exit-0 close on a red verification |
| Finding 1 is closed | 5 | `chmod 000` re-run at the round-2 head, both streams; plus N1 killing two named tests |
| Finding 2 is closed for the clean-tree case | 5 | Coordinator's demo independently re-run; close refused, status unchanged |
| Finding 3 is closed, including the already-tracked branch | 5 | Legacy store built without `.mstack/.gitignore`, receipt committed, then both prescribed commands |
| Finding 5 is closed and the marker is erasable | 5 | Shipped binary; `closed_by` read back from `state.json` after each command |
| The tree-sample ordering is unpinned, and the ordering matters | 5 | N10 survives the suite; and a verification that writes an artifact goes red under the mutant, green under shipped code |
| `UNKNOWN_TREE` silently disables the tree half | 5 | Unreadable `.git/index`; `rev-parse` succeeds, `status` fails, close at exit 0 |
| Cost is bounded | 5 | 30k-file synthetic repo: 0.10s at `in_progress` vs 0.15s at `verifying` |
| The catch matches its sibling's shape | 2 | Read side by side; behaviour is rung 4 via N1 |
| No unguarded receipt read remains | 2-3 | `status()` has two callers, both wrapped; walked, not fuzzed |
| A `git status` timeout could reach `UNKNOWN_TREE` in the wild | **2** | 40ms at 30k files against a 5s timeout. **I could not construct a realistic repo where this fires** and I am not claiming it does |
