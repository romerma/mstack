# Review - verification-never-runs

**Verdict:** CHANGES_REQUESTED

Reviewed at `26b0671d46b655ae82bda50eb9ef1a1c75e9010c` on `feat/verification-never-runs`,
eight commits ahead of `main`. I did not write this code.

The mechanism is well built and the tests are real: I killed eight independent mutations of the
new logic and every one was caught by a *named* test (below). The blocker is not the design, it
is a failure path in the new code that converts the red Stop hook back into a silent green — the
seventh instance of this repository's own "a check that cannot fail" pattern, introduced by the
change that exists to close the sixth.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| Fast gate refuses a never-executed verification | `an item one step from done whose verification never ran is red, and the command is named` | `tests/gate.test.ts:588`; mutation M1 (`src/gate.ts:74` -> `if (false)`) kills 9 tests |
| Fast gate refuses a verification that ran red | `a recorded failing run keeps the gate red, which is the 230-minute case` | `tests/gate.test.ts:617`; M9 (collapse the failed branch) kills 4 tests |
| A run at an older commit does not carry over | `a run recorded at an older commit does not carry over` | `tests/gate.test.ts:631`; M3 (drop `row.sha === sha`) kills 2 tests |
| Editing the command voids the receipt | `editing the verification string voids the receipt that vouched for the old one` | `tests/verification.test.ts:123`; M2 (match on SHA only) kills 3 tests |
| Relabelling to `done` is not a way out | `an item cannot be closed on a verification that never ran here` | `tests/cli.test.ts:625`; M4 (`src/cli.ts:505` -> `if (false)`) kills 2 tests |
| The guard is scoped to the one transition | `only the move into done is guarded; every other move and a re-close are not` | `tests/cli.test.ts:678` |
| The line falls at `verifying` and nowhere earlier | `nothing before verifying is held to a run, however loudly it is configured` | `tests/gate.test.ts:659`; M7 (widen `VERIFICATION_REQUIRED_FROM`) kills it |
| `--full` records what it ran | `--full records what it ran, and the fast gate afterwards is green` | `tests/gate.test.ts:734`; M8 (skip `recordRun`) kills 3 tests |
| `--full` that ran nothing fails | `gate --full is distinguishable, in summary and exit code, from one that verified nothing` | `tests/cli.test.ts:591`; M5 (`fail` -> `warn`) kills 2 tests |
| `--full` does not demand a receipt of its own run | `--full does not ask for a receipt of the run it is about to perform` | `tests/gate.test.ts:797`; M11 (drop the `options.full` skip) kills 3 tests |
| `setup` writes the store `.gitignore` | `setup writes a store .gitignore, because a committed receipt voids itself` | `tests/verification.test.ts:171`; M6 (drop the write) kills it |
| **Whitespace half of the command match** | **none** | M12 survives: 79 pass, 0 fail. See finding 4 |
| **Unreadable receipt file** | **none** | Implementer's own ladder table records the *write* path at rung 2; the *read* path is not named. See finding 1 |
| **Working tree changed after the run** | **none** | Reproduced green at rung 5. See finding 2 |

No test was weakened. `git diff main...HEAD --numstat -- tests/` is `136/1`, `236/0`, `187/0`;
the single deleted line is an import. The one assertion `db80b45` rewrote was strengthened, not
loosened (finding 13).

## Acceptance, quoted

**"A session cannot close green on an item whose verification has never been executed at its current state; the mechanism is a check or a hook, not prose"**

Partly met, and the gap is in "at its current state".

*Never executed* is met, by code and not prose: `checkVerificationRuns` at `src/gate.ts:409-459`
runs inside `runGate`, which `src/hooks.ts:172` already drives from the `Stop` hook, plus the
closing guard at `src/cli.ts:505-520`. Reproduced live in a scratch store:

```console
$ mstack gate | rg -i "verif|FAILED"
[fail]  1 drift-probe (verifying) is one step from done, and `sh check.sh` has never been executed
        fix: run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check
FAILED - 1 failure, 1 warning
```

*Current state* is not met on two paths:

- The receipt is keyed to HEAD, not to the tree. A green `--full`, then an uncommitted edit that
  breaks the very command, then a close: exit 0 (finding 2, reproduced below at rung 5).
- An I/O error on `.mstack/verification.tsv` makes the check throw, `cmdHook` swallows it, and
  the hook reports green (finding 1, reproduced below at rung 5).

**"'gate --full' that ran no verification is distinguishable in its summary and its exit code from one that ran and passed"**

Met, both halves, verified live through `./bin/mstack` in a scratch store rather than from the
report:

```console
$ mstack gate --full            # nothing configured
-- verification
[fail]  --full ran no verification: state.json has no 'verify' command and c2 has no 'verification' command
        fix: set one with 'mstack state set <slug> --verification "<command>"', or put a project-wide 'verify' in state.json
FAILED - 1 failure, 1 warning
exit=1

$ mstack gate --full            # verify: "true"
[ok]    true
PASSED - 0 failures, 1 warning
exit=0
```

The "did this newly break an ordinary repo" half: the **fast** gate does not. An item at
`verifying` with nothing configured warns and passes (`src/gate.ts:424-436`,
`tests/gate.test.ts:680`), verified live. The **full** gate does now fail, which is intended
(decision `2026-08-21T11:43:37.110Z`), and no hook runs `--full` — but `agents/reviewer.md:19`
does, and that path was not updated. See finding 7.

**"The cost is bounded: whatever runs the verification does not turn every Stop hook into a full test suite run, and the reasoning for where the line falls is recorded"**

Met. `checkVerificationRuns` executes no subprocess: it calls `headSha` and `receipts` only, and
`runVerification` is reachable solely under `options.full` (`src/gate.ts:88`). Walked at rung 3,
pinned at rung 4 by M11 and M7 above. The reasoning is recorded in three places that a later
reader will actually hit: `src/lifecycle.ts:57-77` above `VERIFICATION_REQUIRED_FROM`, decision
row `2026-08-21T11:43:30.446Z`, and `docs/wiki/Gates-and-Hooks.md:328-334`. I agree with
`verifying`: `TRANSITIONS` makes it the only legal predecessor of `done`, so it is both minimal
and sufficient.

**"Tests cover a red verification being caught, a green one passing, and the no-verification-configured case"**

Met for the three named cases, and they are real tests — each one is killed by a mutation named
in the table above. Red: `tests/gate.test.ts:617`, `:754`, `tests/verification.test.ts:87`.
Green: `tests/gate.test.ts:605`, `:734`, `tests/verification.test.ts:65`. None configured:
`tests/gate.test.ts:680`, `:779`, `tests/cli.test.ts:695`, `tests/verification.test.ts:158`.

## Verification I ran

`mstack gate --full` (via `./bin/mstack`, never the 0.1.0 copy on PATH):

```
PASSED - 0 failures, 0 warnings
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .

PASSED - 0 failures, 0 warnings
EXIT=0
```

`npm test`, both runtimes:

```
 230 pass
 0 fail
Ran 230 tests across 14 files. [18.99s]
ℹ tests 230
ℹ pass 230
ℹ fail 0
```

`mstack ledger check verification-never-runs` at the current head SHA:

```
FAIL no verdict at 26b0671d; 2 row(s) exist at other SHAs and a new head SHA voids them
EXIT=1
```

See finding 6: this does not block the gate (the item is not `done`), and the reason a row
cannot name its own commit is argued at `.mstack/progress/current.md:280-284`. It still has to
be resolved by the closing pass rather than carried.

Mutation testing, in a scratch copy at
`/private/tmp/claude-501/-Users-romerma-Code-mstack/cefb854d-5ff7-43b0-95ba-d79a53d0c4d7/scratchpad/mut`,
against `tests/verification.test.ts tests/gate.test.ts tests/cli.test.ts` (baseline 79 pass, 0 fail):

| Mutation | Result |
|---|---|
| M1 `src/gate.ts:74` never calls `checkVerificationRuns` | 9 fail |
| M2 `src/verification.ts:101` matches on SHA only | 3 fail |
| M3 `src/verification.ts:101` ignores the SHA | 2 fail |
| M4 `src/cli.ts:505` closing guard removed | 2 fail |
| M5 `src/gate.ts:465` `fail` -> `warn` for a `--full` that ran nothing | 2 fail |
| M6 `src/setup.ts:131` stops writing the store `.gitignore` | 1 fail |
| M7 `src/lifecycle.ts:76` widened to `in_progress, reviewing` | 1 fail |
| M8 `src/gate.ts:487` `--full` runs but records nothing | 3 fail |
| M9 `src/verification.ts:124` collapses "ran and failed" into "never ran" | 4 fail |
| M11 `src/gate.ts:74` `--full` also demands a prior receipt | 3 fail |
| **M12 `src/verification.ts:59-62` stops normalising the matched command text** | **0 fail — survives** |

## Changes required

### 1. BLOCKING - an unreadable `.mstack/verification.tsv` turns a red Stop hook silently green

`src/gate.ts:447` calls `verificationStatus` -> `receipts` (`src/verification.ts:72`) ->
`readRecords` -> `readFileSync` with **no try/catch**. Its sibling twenty lines up,
`checkOpenDecisions` at `src/gate.ts:227-238`, wraps exactly this read and its comment names
exactly this bug: *"The gate reports; it does not become the failure. An unreadable
decisions.tsv used to throw out of the middle of the run, so every check below this one silently
never happened."* The new check does not do that, and `cmdHook` at `src/cli.ts:867-874` catches
every throw and returns 0 by design ("it fails open").

Reproduced at rung 5, same store, one `chmod` apart:

```console
$ mstack hook stop 2>/dev/null                       # receipt file readable
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- 1 perm (verifying) is one step from done, and `true` has not run at 7a71f983; 1 earlier run(s) exist at other commits, and a new commit voids them -> run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check"}}
[exit=0]

$ chmod 000 .mstack/verification.tsv
$ mstack hook stop 2>/dev/null
[exit=0]
$ mstack hook stop 2>&1 >/dev/null
                                                     # nothing on either stream
```

Empty output plus exit 0 is byte-identical to "the gate is green, close away". The same trigger
on the guarded siblings does not do this — control runs in the same store:

```console
$ chmod 000 .mstack/decisions.tsv && mstack gate | tail -1
FAILED - 1 failure, 2 warnings
$ chmod 000 .mstack/ledger.tsv && mstack gate | tail -1
FAILED - 1 failure, 2 warnings
$ chmod 000 .mstack/verification.tsv && mstack gate | tail -2
[ok]    no closed items to audit
mstack: EACCES: permission denied, open '.../.mstack/verification.tsv'   # exit 2, no summary line, workspace section never ran
```

`EISDIR` (a directory where the file should be) does the same. This is not a contrived trigger:
`verification.tsv` is the one store file that is never recreated by a clone and whose ownership
is purely local, so a `mstack` run as root in a container followed by one as the normal user
produces it directly.

**Fix:** wrap the read in `checkVerificationRuns` (`src/gate.ts:447`) in a try/catch and
`report.fail` on it, in the shape of `src/gate.ts:227-238`. The closing guard at
`src/cli.ts:506-507` already fails closed (exit 2, status unchanged, verified), so it needs
nothing beyond a clearer message. Add a test: an unreadable receipt file is a `[fail]`, not a
green gate, and `mstack hook stop` still blocks. Without that test this is unpinned again on the
next refactor.

### 2. BLOCKING (or argue it explicitly) - the receipt certifies a commit, not a tree

`src/verification.ts:97-104` keys a receipt to `(sha, command)`. Nothing observes the working
tree, so every uncommitted edit made after `gate --full` is invisible to both the fast gate and
the closing guard. Reproduced at rung 5:

```console
$ mstack gate --full | rg "check.sh|PASSED"
[ok]    sh check.sh
PASSED - 0 failures, 1 warning

$ printf 'exit 1\n' > check.sh          # the verification is now red, uncommitted

$ mstack gate | rg "verification|uncommitted|PASSED"
[ok]    verification ran and passed at c57e172b: sh check.sh
[warn]  1 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 2 warnings

$ mstack state set drift-probe --status done; echo "EXIT=$?"
1 drift-probe (done)
  status: "verifying" -> "done"
EXIT=0
```

This is the item's own defect wearing a different hat: a verification that is red *right now* is
invisible, and the only thing standing in the way is a `[warn]` at exit 0 — which is precisely
the shape the item's description calls out ("`gate --full` with nothing configured warns that it
checked nothing and still exits 0"). The dirty-tree warning is a particularly weak backstop
here, because `state set --status done` writes `state.json` itself, so the tree is dirty at
close by construction and the warning carries no signal.

Decision row `2026-08-21T11:43:17.817Z` cites `src/gate.ts:369-375` ("warns on a dirty tree at
close") as supporting evidence for gitignoring the file, so the implementer had this line in
view — but the drift consequence is named nowhere: not in `src/verification.ts`, not in
`docs/wiki/Gates-and-Hooks.md:325-334`, not in the report's rung table, not in the four rules
table.

**Fix, one of:** (a) refuse — not warn — when a satisfying receipt exists and
`git status --porcelain` is non-empty in the files the verification could touch; (b) key the
receipt to a tree id alongside the SHA (`git write-tree` on a temporary index, or a hash of
`git status --porcelain` plus the SHA) so an edit voids it exactly as an edit to the command
does; or (c) if you judge the cost too high, say so where a reader will find it — a decision row
plus a fifth line in the `Gates-and-Hooks` rules table stating that the receipt proves the
commit and not the tree. What is not acceptable is leaving criterion 1's "at its current state"
reading as satisfied when it is satisfied only for committed state.

### 3. REQUIRED - stores created before this change get no migration and no warning

`sandbox/.mstack/` in this checkout is exactly such a store: `decisions.tsv`, `ledger.tsv`,
`state.json`, no `.gitignore`. Reproduced the whole path at rung 5 in a store built to match:

```console
$ mstack gate --full >/dev/null 2>&1
$ git status --porcelain
?? .mstack/verification.tsv
$ git check-ignore -v .mstack/verification.tsv
NOT IGNORED
$ git add -A && git commit -qm session && git ls-files .mstack | rg verification
.mstack/verification.tsv
$ mstack gate | tail -1
FAILED - 1 failure, 1 warning      # the commit that carried the receipt voided it
```

That is the exact loop `src/setup.ts:58-68` says must not happen, running on every existing
store. It is fail-closed — a committed receipt cannot vouch for the commit that carries it, so
there is no false green — but it is a permanent red-gate-and-dirty-tree loop with nothing naming
the cause.

`mstack setup` is a working migration (verified: on a populated store it leaves every file alone
and installs the `.gitignore`), but:

- nothing tells anyone to run it. `CHANGELOG.md:7-27` describes the feature and never says
  "existing stores: run `mstack setup`". `docs/wiki/The-CLI.md:51-54` mentions the rewrite only
  inside the `setup` section, where someone who already has a store will not look.
- it is incomplete once the file is tracked. Verified: after `setup` installs the `.gitignore`,
  `git ls-files .mstack` still lists `verification.tsv`. `git rm --cached .mstack/verification.tsv`
  is required and is documented nowhere.

**Fix:** an upgrade line in `CHANGELOG.md` naming both commands, and — better, because this
repository's standard is that a rule nobody sustains is not a rule — a gate check that warns
when `.mstack/verification.tsv` exists and `git check-ignore` does not match it.

### 4. REQUIRED - the whitespace half of the command-match boundary is untested

Where it landed, verified live through `./bin/mstack`:

| Variation on a receipt for `true` | Result |
|---|---|
| trailing newline and spaces | same command, receipt honoured |
| trailing single space | same command, receipt honoured |
| `/bin/true` (semantically identical) | `has never been executed` |
| `true && true` vs `true  &&  true` | `has never been executed` |

That is a defensible place to land — strict, and strictness here fails closed. But the tolerant
half is emergent from `.trim()` in `obligations` (`src/verification.ts:59,61`) plus `cell()`'s
`[\t\r\n]+` collapse (`src/tsv.ts:22`), and **nothing pins it**. M12 keeps the emptiness test
but stops trimming the emitted command text, so a trailing newline in a `verification` field
would void every receipt: the full suite stays green, 79 pass, 0 fail. The item's own history is
a `verification` field typed by hand at intake; a trailing newline in one is not exotic.

**Fix:** one test in `tests/verification.test.ts` asserting that a trailing newline/space
variant of a recorded command is still satisfied, and that an internal whitespace change is not.
Confirm it kills M12.

### 5. REQUIRED - `--force` on the close leaves no durable trace

`src/cli.ts:514-518` pushes a `forced:` line into `changes`, and `changes` is only ever
`console.log`ed (`src/cli.ts:627`). The `--sdd` and `--decision-required` precedents it is
modelled on both leave *observable state* behind that the gate then reports — a spec directory
the gate holds the item to, a fork the gate refuses to let past `specifying`. This one leaves
none: the item is `done`, `checkVerificationRuns` stops looking because `done` is not active
(`src/gate.ts:414-417`), and nothing in `state.json`, `ledger.tsv` or `decisions.tsv` records
that the close was unverified. The error message advertises the flag
(`src/cli.ts:512`: "and `--force` closes it unverified") with no matching audit surface.

`require_verdict_to_close` is a partial backstop — verified: a forced close still leaves
`items marked done with no ledger verdict at all` red — but a ledger row cannot distinguish a
forced unverified close from a real one, which is the `closed_by` shape `src/roles.ts:88-99`
already had to fix once.

The implementer raised this as a product call in the report's "For the reviewer" #1. My ruling:
the flag stays, the silence does not. **Fix, cheapest first:** refuse `--force` on this
transition unless `--closed-by` is also given and write the reason into `closed_by`; or write a
`decisions.tsv` row, which is what the sibling force message at `src/cli.ts:502` already tells
people to do ("say why in decisions.tsv"). `verification.tsv` cannot be the audit trail — it is
gitignored by design.

### 6. REQUIRED before close - the ledger is stale at HEAD

`mstack ledger check verification-never-runs` fails at `26b0671d`; the newest row is at
`90b6e88`, two commits back. The structural reason is real and well argued at
`.mstack/progress/current.md:280-284` — a row cannot name the commit that carries it — and the
gate does not fail on it because the item is not `done`. I am recording it rather than waiving
it: whoever closes this item must land a verdict at the SHA it closes on, from a pass that did
not write the code. Both existing rows carry `--verifier implementer`, so neither can close it
(`src/roles.ts:103`).

### 7. MODERATE - the reviewer path now starts red in any project with no `verify` configured

`agents/reviewer.md:19` instructs every reviewer to run `mstack gate --full`, and
`skills/review/SKILL.md:9-16` launches several in parallel. `mstack setup` seeds `verify: ""`
(`src/setup.ts:86`), so in any project that has not configured one, that command now exits 1 for
a reason that has nothing to do with the item under review — against a rule that says never
approve on a red gate. The change is intended (decision `2026-08-21T11:43:37.110Z`) and I agree
with it, but neither `agents/reviewer.md` nor `skills/review/SKILL.md` nor the `CHANGELOG.md`
entry tells a reviewer what to do when `--full` is red because nothing is configured.

**Fix:** one line in `agents/reviewer.md` near line 19 — a `--full` that ran nothing is a
store-configuration failure to be reported, not an item defect and not a reason to hand-wave.

### 8. Judgement on `db80b45` - it belongs in this item

Asked to rule on whether it is scope-widening: it is not. Both files it touches
(`.mstack/.gitignore`, `src/setup.ts:69`) were created by this same branch three commits
earlier, so it corrects the item's own footprint rather than riding along. The factual claim is
verified at rung 2: `withLock` is imported only by `src/decisions.ts:2` and called only at
`src/decisions.ts:53`; `verification.record` (`src/verification.ts:66-70`) calls `append`
directly, so `verification.tsv.lock` genuinely never exists and the comment justifying the line
was false. It also *strengthened* the test it touched — `assert.match(body, /^verification\.tsv\.lock$/m)`
became a `deepEqual` on the whole non-comment line list, which is the assertion M6 kills. Keep it.

## Nitpicks

1. `src/verification.ts:57-63` - `obligations` does not deduplicate identical commands, while
   `status` at `:114-133` effectively does (both entries resolve to the same receipt). This
   store pays it: `state.verify` and item 14's `verification` differ only by a `./`, so every
   `gate --full` here runs the suite twice and writes two receipts. An exact-text dedupe in
   `obligations` would be free and would not weaken the check.
2. `src/verification.ts:106` - `export interface Status` collides with `src/lifecycle.ts`'s
   `Status` (the lifecycle enum) for an unrelated concept, forcing the alias at `src/gate.ts:15`.
   In a codebase whose own gate enforces "the lifecycle enum appears only in src/lifecycle.ts",
   `RunStatus` or `ReceiptStatus` would cost nothing.
3. `src/verification.ts:66` - `record`'s `ts?: string` override exists only so tests can pin
   timestamps (`tests/verification.test.ts:104-105`). Harmless, but it is production signature
   surface bought by test convenience; a separate `recordAt` in the test helper would keep it out.
4. `src/verification.ts:61` - `if (own !== "" && item !== undefined)`: the second conjunct is
   pure TypeScript narrowing and reads backwards, since the first already implies it. Reorder.
5. `src/verification.ts:66-70` - `record` appends without `withLock`, unlike `decisions.add`.
   `skills/review/SKILL.md:9-16` plus `agents/reviewer.md:19` do put several `gate --full` runs
   in one store at once, and `ensureHeader` (`src/tsv.ts:44-47`) is a check-then-write. I tried
   to reproduce a lost row with eight concurrent `gate --full` on a store with no receipt file
   and **could not** — 8 of 8 rows survived, so this stops at rung 3, a walked window rather
   than an observed loss. Losing a row is fail-closed (a re-run is demanded), so it is a nit.
6. `src/tsv.ts:22` flattens `[\t\r\n]+` to a single space, so a multi-line `verification` is
   stored on one line and `column -s$'\t' -t .mstack/verification.tsv` shows a command that
   cannot be pasted back. Matching stays consistent because both sides go through `cell`, so
   there is no bug — only a receipt that is less useful as evidence than it looks.
7. `skills/router/playbooks/cleanup.md:16-22` closes long-dormant items and explicitly
   accommodates a ledger verdict at an older SHA. It now also needs a run of that item's
   verification at *today's* HEAD, or `--force`, and the playbook says nothing about either.

## Where my claims stopped on the ladder

| Claim | Rung | What got it there |
|---|---|---|
| An unreadable receipt file turns the Stop hook silently green | 5 | `chmod 000`/`mkdir` on `.mstack/verification.tsv`, `./bin/mstack hook stop` as a real process, with guarded-sibling controls in the same store |
| A green receipt survives arbitrary uncommitted edits, and the item closes | 5 | Scratch store, `./bin/mstack gate --full` then `state set --status done`, exit 0 |
| A pre-change store commits its receipt and loops | 5 | Store built without `.mstack/.gitignore`, real `git add -A && git commit` |
| The whitespace half of the match is unpinned | 4 | M12 applied to a scratch copy; full suite 79 pass, 0 fail |
| Every other new behaviour is enforced by code, not prose | 4 | 230 tests on bun and node; ten mutations, each killed by a named test |
| The Stop hook executes no subprocess | 3 | `checkVerificationRuns` calls `headSha` and `receipts` only; `runVerification` is reachable only under `options.full` (`src/gate.ts:88`). Walked, not timed |
| `record` without a lock can lose a row under concurrency | **3** | The `ensureHeader` check-then-write window is real; **8 concurrent `gate --full` runs lost nothing**, so this is not settled and is written up as a nit, not a defect |
