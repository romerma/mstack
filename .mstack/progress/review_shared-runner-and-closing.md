# Review - shared-runner-and-closing (item 36)

**Verdict:** CHANGES_REQUESTED

Reviewed at HEAD `2298b54` (code in `7f5e67a`), branch `feat/shared-runner-and-closing`. I did not write this code.
The suite is green on both runtimes and `gate --full` is green. The problems are in paths the suite does not reach:
the timeout path of `runCommand` on Linux `/bin/sh` (dash, which CI uses), the captured tail under a timeout,
`inherit` plus a timeout on a terminal, the gate-side preconditions around `closingProblems`, and three matcher
properties the table test does not pin.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A1 temp-file fd, grandchild cannot block | tests/run.test.ts:10 | implementer's pipe mutation went red (their report); not repeated |
| A1 timeout returns | tests/run.test.ts:22 | passes; the name says "kills the process group" but it asserts only `timedOut`/`code` |
| A1 group kill | tests/run.test.ts:31 | M1 (delete `killGroup` call, src/run.ts:62) -> red. **Red under dash** (see Changes 1) |
| A1 code/signal | tests/run.test.ts:40 | no-timeout path only; the 128+n behaviour under a timeout is not pinned |
| A1 tail | tests/run.test.ts:50 | no-timeout path only; misses the job-control lines under a timeout (Changes 2) |
| A2 runVerification on runCommand | existing gate/cli suites, unedited | `git diff 2e975da..HEAD --diff-filter=MDR -- tests/` is empty; read src/gate.ts:676 against the old `execFileSync` |
| A3 git.ts owns headSha/defaultBranch | typecheck; import scan | src/worktree.ts:5 imports git.ts; no value-import cycle at HEAD (script below) |
| A4 gate and state set share closingProblems | tests/closing.test.ts:19 | M3 (cli side returns `[]`) -> 7 red; M4 (gate side returns `[]`) -> 16 red |
| A4 unreadable fails closed, not overridable | tests/closing.test.ts:49, cli.test.ts:794, gate.test.ts:1143 | M5 (`if (unreadable !== undefined)` -> `if (false)`) -> red, caught **only** by closing.test.ts:49 |
| A4 --force --closed-by marker | tests/cli.test.ts:677, :723 | M3 turns both red, so they run through the new path |
| A5 classifier table | tests/pathclass.test.ts | P2, P3, P5 red; **P1, P4, P6 survive** (Changes 5) |

## Acceptance, quoted

**"src/run.ts exports runCommand(cmd, {cwd, timeoutMs, output}) returning {code, signal, timedOut, tail}; output goes through a temp-file fd so grandchildren cannot block it, and a timeout test proves it returns"**
Partly met. The signature, the temp-file fd (src/run.ts:50,57) and the returning timeout test (tests/run.test.ts:22) are there. But the timeout path depends on `set -m` creating a process group, and dash does not do that without a tty. CI runs on `ubuntu-latest` (.github/workflows/ci.yml:10,46), where `/bin/sh` is dash. Under a timeout, `tail` carries the wrapper's job-control chatter. On bun, `code` is `undefined` when the spawn fails, and the type says `number | null`. See Changes 1, 2 and 6.

**"runVerification in src/gate.ts runs on runCommand with output inherited, and every existing gate --full test passes unedited"**
Met. src/gate.ts:676 calls `runCommand(command, { cwd: store.root, output: "inherit" })`. With no timeout, `needsDir` is false and the argv is `["-c", cmd]` with `stdio: "inherit"`, which is the old `execFileSync` call. A non-zero code, a null code from a signal and a spawn error all still read as `failed`. No existing test file was modified, deleted or renamed (the command printed nothing), and the full suite is green (below).

**"headSha and defaultBranch live in src/git.ts and src/worktree.ts no longer imports src/gate.ts"**
Met. src/git.ts:78-89. `rg gate src/worktree.ts` is empty. My import-graph scan prints "no value-import cycles" for HEAD's src/. It printed the same for base 2e975da, so this item removes a coupling, not a live cycle. Nit: src/worktree.ts:5-6 are two separate imports from `./git.ts`.

**"closingProblems(store, state, item) lives in a module that does not import gate.ts; the gate calls it for the active item and state set --status done refuses on any problem it returns, overridable only by --force --closed-by; the verification receipt check is its first member"**
Partly met. src/closing.ts imports only git, paths, state and verification. `CHECKS[0]` is the receipt check (src/closing.ts:35). state set refuses on any problem, and only the unreadable one cannot be forced (src/cli.ts:524-559). But the gate calls it only behind verification-specific early returns (src/gate.ts:589-616): status `verifying`, a non-empty `obligations`, and a HEAD. So "the gate calls it for the active item" holds only for an active item that has a verification command. That is invisible with one check, and it breaks the module's own claim (src/closing.ts:9-11, "the two cannot disagree ... adding a check is one line in `CHECKS`") the moment item 41 adds its member. Demonstrated in Changes 4.

**"src/pathclass.ts classifies a repo-relative path as test, doc or code with a hand-written ** and * matcher (no path.matchesGlob), covered by a table test"**
Partly met. The matcher is hand-written and correct on every edge case I tried (below). But the table test does not pin the one property that separates `*` from `**`: a mutation that lets `*` cross `/` passes all 25 tests (Changes 5).

## Points judged

**1a. Race-free?** No, but the window is narrow (rung 4, both runtimes). If spawnSync's SIGKILL lands between the fork and `echo $! > "$2"`, the pid file is missing or empty. `Number("")` is 0, `killGroup` skips silently (src/run.ts:72-77) and the job leaks. Measured with 10 runs per timeout of `sleep 7.78 & sleep 7.78`:

```
bun : timeoutMs=2: 7/10 runs leaked   =5: 1/10   =1,3,10,20,50,100: 0/10
node: timeoutMs=2: 5/10 runs leaked   =3: 2/10   =1,5,10,20,50,100: 0/10
```

This does not matter at realistic timeouts, but the catch comment "No pid was written, or the group is already gone" hides a leak. Pgid reuse (rung 3, not run): a pgid cannot be reissued while any member of the group lives. Once the group is empty, `kill(-pgid)` hits something else only if an unrelated process got that pid *and* made itself a group leader in the few ms before `killGroup`. Negligible.

**1b. 128+n with `signal: null`.** Under a timeout, `kill -TERM $$` and a genuine `exit 143` both return `{"code":143,"signal":null}` (rung 4, both runtimes). The no-timeout path already loses this for compound commands: `true; sh -c 'kill -TERM $$'; exit $?` gives `{"code":143,"signal":null}`. So `signal` is best-effort on both paths. For item 42 that is acceptable, because the kill it needs to detect is the *timeout*, and `timedOut` is reliable (always `true` with `signal: "SIGKILL"` in my probes). A crashed mutant reading as "failed" is the right bucket. What is not acceptable is the interface doc at src/run.ts:26 ("null when the command was killed by a signal"), which promises more than either path delivers. See Changes 6.

**1c. inherit + timeoutMs.** Broken on a terminal (rung 4, `script` pty, both runtimes). `read x` stops on SIGTTIN, and `echo` with `stty tostop` stops on SIGTTOU. Both sat until the 4 s timeout and came back `{"code":null,"signal":"SIGKILL","timedOut":true}`, a pass misreported as a timeout. It should be refused, not left latent (Changes 3).

**1d. Runtimes.** Behaviour matches except a spawn failure (missing cwd): node gives `code: null`, bun gives `code: undefined` (`typeof` is `undefined`) (Changes 6).

**3. Gate message clause.** Justified. One problem string now feeds both surfaces, and state set's wording already carried ", so nothing here can say whether it was verified". gate.test.ts:1158 matches unchanged, and nothing outside src/tests quotes it (`rg 'could not be read'` is empty). The hint was preserved through `isUnreadable` (src/gate.ts:645).

**3. Behavioural test for A4.** closing.test.ts:19 *is* behavioural at HEAD. It runs the real gate and the real `state set` on the same unverified item, and M3/M4 show that dropping `closingProblems` from either side goes red. A bypass that calls `verification.status` directly in one surface is an equivalent mutant today, and no behavioural test can see it while `CHECKS` has one member. The probe in Changes 4 is the test that would. The implementer's "missing-module red" fail-before is honest: at base the two already agreed, through two copies of the same call.

## Verification I ran

```
$ PATH=.../node/v24.14.0/bin:$PATH npm test        (no item-21 hang this run)
 328 pass
 0 fail
Ran 328 tests across 21 files. [36.41s]                     <- bun 1.3.11
ℹ tests 322
ℹ pass 322
ℹ fail 0
npm test  36.79s user 44.71s system 151% cpu 53.663 total   exit=0
$ bun run typecheck
$ bunx --bun tsc --noEmit                                   exit=0
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings                             exit=0
$ ./bin/mstack gate --full                                  (store verify: npm test && npm run typecheck && bin/mstack lint-plugin .)
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings                             exit=0
$ ./bin/mstack ledger check shared-runner-and-closing       (before my row)
FAIL no verdict at 2298b54f; 1 row(s) exist at other SHAs and a new head SHA voids them
```

The implementer's row is at 7f5e67a, not HEAD. Mutations ran on a `git archive HEAD` copy in my scratchpad (node 24), one at a time:

```
[M1 no killGroup]                      pass 5  fail 1   the whole group dies, not just the child
[M3 state set skips closingProblems]   pass 25 fail 7   incl. closingProblems...agree; --force with a reason...; unreadable ... --force does not override
[M4 gate skips closingProblems]        pass 57 fail 16  incl. closingProblems...agree; an unreadable receipt file is a failure...
[M5 unreadable becomes overridable]    pass 31 fail 1   an unreadable receipt file is a problem, not a throw, and is the one --force does not override
[P1 * crosses /]                       pass 25 fail 0   <- survives
[P2 **/ needs a dir]                   pass 22 fail 3
[P3 . unescaped]                       pass 23 fail 2
[P4 doc before test]                   pass 25 fail 0   <- survives
[P5 unanchored]                        pass 22 fail 3
[P6 ./ not stripped]                   pass 25 fail 0   <- survives
```

Matcher edge cases, all as documented: `**/a.ts` matches `a.ts` and `x/y/a.ts` but not `xa.ts`. `a/**/b` matches `a/b` and `a/x/y/b` but not `a/xb`. `a/**` matches `a/x/y` but not `a` or `ab/x`. `*.ts` does not match `d/a.ts`. `src/*` does not match `src/a/b`. `**/*.md` matches `.github/x.md`, so dotfiles match. `a.b` does not match `aXb`. `[ab]` and `{a,b}` are literals.

## Changes required

1. **src/run.ts:43, :54-62 - the timeout path does not kill anything on Linux `/bin/sh`.** dash ignores `set -m` without a tty. I reproduced it with macOS `/bin/dash` swapped in for `/bin/sh` and no tty, which is rung 4 on that simulation and not run on ubuntu itself. The wrapper prints `sh: 1: set: can't access tty; job control turned off`, no group is created, `process.kill(-pid)` gets ESRCH, it is swallowed, and both `sleep`s survive the timeout. tests/run.test.ts:31 run against that copy:

   ```
   ✖ the whole group dies, not just the child (302.744417ms)
     AssertionError [ERR_ASSERTION]: no grandchild pid in "sh: 1: set: can't access tty; job control turned off\n49512"
   ```

   CI (`ubuntu-latest`, no tty) should go red on this test in all three jobs. Item 42's "killed" would also leave the killed suite running into the next mutant. Fix: stop relying on shell job control. One option that works under both runtimes is a small `node:`-only helper run with `spawnSync(process.execPath, [helper, ...])`. It uses async `spawn({ detached: true })`, which knows the pid synchronously, so the pid-file race is gone too. It owns the timer, kills `-pid`, and writes `{code, signal, timedOut}` to the temp dir, which keeps `code` and `signal` exact. Whatever the fix, add a test that fails if no process group was created.
2. **src/run.ts:43 - under a timeout the captured `tail` ends with the wrapper's job-control output, not the command's.** Both runtimes, rung 4. `printf 'line1\nline2\n'; exit 1` with `tailLines: 1` returns `"[1]+  Done(1)  /bin/sh -c \"$1\""` with a timeout and `"line2"` without one. A self-signal adds `sh: line 1: NNN Terminated: 15 ...`. This is exactly the combination item 42 will use. Fix the wrapper (or replace it per 1), and run the tail test at tests/run.test.ts:50 with a `timeoutMs` as well.
3. **src/run.ts:15-23 - `output: "inherit"` with `timeoutMs` should be refused.** On a pty, a command that reads stdin, or writes with `tostop` set, stops in its background group and is reported `timedOut: true` after the full timeout (1c). Nothing uses it. Make it unrepresentable: a discriminated `RunOptions` where `timeoutMs` exists only with `output: "capture"`, or a thrown error. Cover it with a test.
4. **src/gate.ts:589-616 and src/closing.ts:9-11 - the gate reaches `closingProblems` only through verification-specific early returns, so the "cannot disagree" claim fails at item 41's first line.** Rung 4: in a copy with one extra member, `CHECKS = [verificationReceipts, () => ["a second closing check (item 41 style) is not satisfied"]]`, an item at `verifying` with no verification command gives:

   ```
   GATE exit 0   [warn] storage-layer is verifying and nothing verifies it ... PASSED - 0 failures, 1 warning
   STATE SET exit 2   mstack: storage-layer cannot close on a verification that has not run: a second closing check (item 41 style) is not satisfied
           run 'mstack gate --full' at this commit; ...
   ```

   The wording is verification-specific on both surfaces too: src/cli.ts:536-537 ("cannot close on a verification that has not run", the `gate --full` hint) and src/gate.ts:647. Overridability is a message-prefix sniff (`isUnreadable`, plus `unreadable.slice("its ".length)` at src/cli.ts:530). Fix: make a problem structured, e.g. `{ text, hint, overridable }`. Have the gate call `closingProblems` for the active item at `verifying` independent of `obligations`, and keep the receipt check's own vacuous-when-empty behaviour (src/verification.ts:392) inside the check. Let both surfaces print each problem's own hint. The alternative is to narrow the docstring and A4's wording to "for an item with a verification command" and put the restructuring in item 41's acceptance explicitly. Either is fine, but the current text claims something already false at rung 4.
5. **tests/pathclass.test.ts:5-30 - three properties the module states are not pinned.**
   - P1: `*` crossing `/` survives. Add `LICENSE/x.ts` -> code and `src/a.test.dir/x.ts` -> code.
   - P4: test-over-doc precedence survives, though src/pathclass.ts:41 documents it. Add `tests/README.md` -> test.
   - P6: `./` stripping survives, because `./src/gate.ts` is code either way. Use `./tests/a.ts` -> test.
6. **src/run.ts:26-28, :65 - the `RunResult` contract is not what either runtime returns.**
   - Return `code: result.status ?? null`: bun gives `undefined` on a spawn failure.
   - Document on the interface, not only on the constant at :40, that `code` is 128+n and `signal` is null whenever a shell, not the signal, ended the run.
   - Consider surfacing `result.error` so "never started" is distinguishable for item 42.
   - Add a test that pins the 128+n behaviour, so a later fix shows up as a diff.

Recommended, not blocking:
- src/run.ts:63 `closeSync(fd)` belongs in the `finally`.
- src/run.ts:49 computes `pidFile` on the capture path, which has no timeout and never uses it.
- tests/run.test.ts:22 is named "kills the process group", but :31 is the test that checks it.
- On normal exit, stragglers in the job's group are not killed. The run.test.ts:10 test leaks its `sleep 8` every run. Item 42 should decide whether a finished verification run reaps its group.
- `TEST_PATTERNS` only matches root `tests/` and `test/`, so `packages/x/tests/helpers.ts` is code. Worth deciding before item 41 relies on it.
