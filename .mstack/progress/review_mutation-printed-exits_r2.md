# Review - mutation-printed-exits (round 2)

**Verdict:** APPROVED

Item 101, head `c4011a8` (last code commit `ab8bafc`), base `7e96373`, reviewed alone, round 2. Round 1
(`review_mutation-printed-exits.md`, at `3796222`) asked for changes on two blocking findings; the
response is `f925e61..ab8bafc`, rows 323 to 325. Every run of the mechanism was in a fixture under
`S/` = `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review101r2/`
(scripts in `S/scripts/`, output in `S/out/`); the suites ran in `S/head`, a `git archive` of the head.
`<W>` is a fixture's directory.

Both blocking findings are closed on the real surface: every command the four printers offer for a
lock whose CLI was deleted runs as printed from either store, under both shells, and the hook now
reads every shape at the lock's name the way the gate does. The new matching denies what it should
and no ordinary command I tried. What is left is non-blocking: a CLI path that exists but cannot
run is still offered, as at the base.

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| A1 | `tests/mutation-exits.test.ts:182`, `:578` | runs 1 to 7; 4 to 7 run the gone-CLI line from B for each printer (round 1's gap); `:578` calls `shellWord` through sh and dash. Red under round 1's M1 and under a mutant offering the gone CLI |
| A2 | `:267`, `:481`, `:562` | `:481` is the symlink and the FIFO (round 1's B2, NB3); `:562` is round 1's M3. Red under M3 and under X1 below |
| A3 | `:340`, `:382`, `:543` | `:382` skipped here (case-folding APFS); `:543` is round 1's M2, red under it |
| A4 | `:419`, `:520`, `tests/mutation-hook.test.ts:78` | `:520` adds `--shallow-file x`, `GIT`/`Git`, `git COMMIT` allowed, `GIT push --force` denied |
| A5 | n/a (CHANGELOG) | `tests/mutation-two-stores.test.ts:199`, unchanged since round 1 |
| A6 | `:461` | unchanged since round 1 |

## Acceptance, quoted

**"the restore command quotes the CLI path: with the CLI under a directory with a space, the printed
line run as printed exits 0 and removes the lock"** - met, including round 1's B1. `S/scripts/b1.sh`
(`S/b1/b1.mjs`): for each case a fresh copy of the writing CLI runs `verify --mutation` in store A,
is killed with `kill -9` while A's check sleeps on the reverted tree, and is then deleted (`rm -rf`
of the whole copy). A second copy, the running CLI, is asked by the gate, R1, the hook and
`verify --restore`, from B and from A. The one command each line offers is cut from the printed
text and run through `/bin/sh -c` and `/bin/dash -c` where it was printed. Five scenarios: plain
names; `old cli 'q' "d"` / `new cli 'r' "e"` / `top dir 'x'` / `a "1"` / `b '2'`; round 1's
metacharacter names (`$(touch PWN_d)`, backticks, `;`, `&`, `|`, `>`, `<`, `*`, `!x`, `$HOME`, `${IFS}`)
in the writer, the runner, the top and both stores; a writer from the base (`7e96373`, the
version before this item) with the head running, the plugin-update order; and a newline in the
gone path (`old cli\ntouch PWN_n\nx`), which only the new lead prints.

```
plain:   15 of 15 runs exit 0, lock gone, tree byte-identical, gone CLI named and not offered, no marker
quotes:  15 of 15 ...      meta: 15 of 15 ...      version: 15 of 15 ...      nl: 15 of 15 ...
== gate (B) via /bin/sh, cli gone, the way out as printed (unescaped from the log's JSON):
   the CLI that wrote the lock, '<W>/old cli '\''q'\'' "d"/bin/mstack', is gone;
   run cd '<W>/top dir '\''x'\''/pkg/a "1"' && '<W>/new cli '\''r'\'' "e"/bin/mstack' verify --restore
   run via /bin/sh: exit 0, lock gone, tree byte-identical, markers none; "mutation: restored 1, tree verified, lock removed"
== restore (A), cli gone: no refusal, it restores: exit 0, lock gone, tree byte-identical
== whole way out of gate (B) pasted into /bin/sh: exit 127, lock stays, markers 0; "/bin/sh: the: command not found"
```

Each scenario: 8 runs from B (four printers, two shells), 6 from A (gate, R1 and hook, two
shells), and A's own restore, which does not refuse a dead run's lock. Every one of the 70 printed
lines names the gone path in its lead and none offers it as a command, asking never changed the
lock, and the whole way out pasted with its prose (four per scenario) exits 127, 2, 1 or 127 with
the lock kept and no `PWN_*` file (`S/out/b1-*.txt`). Control: the same quotes scenario with round
1's head as the running CLI gives `1 of 15` (only A's own restore), with all 14 lines offering the
gone CLI and the B-side ones exiting 2 at the parenthesis (`S/scripts/b1-control.sh`). Row 324's departure from round 1's suggested
fix holds: "the response's cd in front of each alternative still offers <gone> verify --restore,
which exits 127 as printed".

R15's line after a failed restore, the writer deleted and A's `src/` read-only (`S/scripts/r15.sh`,
`S/out/r15.txt`): `the lock stays; the CLI that wrote the lock, '<W>/old cli '\''q'\''/bin/mstack', is
gone; once each path above is cleared: '<W>/new cli "r"/bin/mstack' verify --restore`, exit 3; after
the `chmod` back, that command exits 0 and removes the lock, via sh and via dash.

Neighbours (`S/scripts/nb.sh`, `S/out/nb.txt`), from B: a dangling symlink at the writer's path is
gone (4 of 4 commands exit 0). The writer gone and A's directory moved away: all four printers from
B and from the moved store give the by-hand recovery and no command. "Gone" is decided by
existence (`existsSync`, `src/mutation-lock.ts:736`): a directory, a mode-644 file or a copy with
`src/` deleted at the writer's path is offered and fails, non-blocking 1. No state I ran prints
neither a command nor the by-hand way out.

**"the hook and the R1 refusal add the cd only for a lock that validateLock accepts; ..."** - met,
including round 1's B2. `S/scripts/b2.sh` (`S/b2/b2.mjs`) put nine things at the lock's name after a
killed run, and asked the hook (its own process, SIGKILL after 10 s), the gate, R1 and the restore:

```
head:  a valid lock (control): hook 77 ms RESTORE, gate RESTORE, R1 RESTORE, restore RESTORE: agree
       a symlink to a valid lock: hook 53 ms UNREADABLE, gate UNREADABLE, R1 UNREADABLE, restore UNREADABLE: agree
       a FIFO 52 ms / a directory 52 / a socket 54 / a valid lock, mode 000 52 / an empty file 52 /
       50 MB of garbage 78: all UNREADABLE in all four: agree
       50 MB, a valid lock with a padding field: hook 89 ms RESTORE, ... restore RESTORE: agree
r1:    a symlink to a valid lock: hook 78 ms RESTORE, gate UNREADABLE, R1 UNREADABLE, restore UNREADABLE: DISAGREE
       a FIFO: hook 10005 ms OTHER (killed), gate UNREADABLE, R1 UNREADABLE, restore UNREADABLE: DISAGREE
```

The lock's name and the tree were unchanged by every unreadable case (`S/out/b2-run.log`). The
hook's reading cannot be made to throw by a lock with a NUL, a lone surrogate or 5000 characters in
`cli`, a NUL in `rootFromTop` (by-hand reason) or `host`, or a pid of 2^53: each denied, in process
and through the CLI, bun and node (`S/out/throws.txt`). If something under
`lockReason` did throw, `src/cli.ts:1355-1360` catches it and the hook fails open, as at the base;
`:562` pins the one throw round 1 found.

**"a rootFromTop that differs from this store's only in case (or Unicode normalisation) does not lead
in a loop ..."** - met; round 1's runs stand, and `:543` now gives "wait for it to end; " before the
by-hand way in the gate, equal to R1's fix (round 1's NB5).

**"under a lock the hook denies git --namespace foo commit, git --config-env k=v commit and git
--attr-source HEAD add; the plumbing commands round 2 left (non-blocking 5) are decided ..."** - met.
`S/scripts/match.sh` (`S/out/match.txt`), in process, head against round 1's head, with and without a
lock:

```
git's name in mixed case (GIT Git gIt giT GiT), each of the 24 verbs:  lock 120 of 120 denied, no lock 0 denied
mixed case with -C, -c, --no-pager and --shallow-file x:                lock 15 of 15, no lock 0
git --shallow-file x <verb>:                                            lock 24 of 24 (r1: 0), no lock 0
git --shallow-file=x <verb>:  allowed; git: "unknown option: --shallow-file=x", exit 129
git COMMIT / git Commit, each verb (48):  allowed with and without a lock; git: "fatal: cannot handle COMMIT as a builtin", exit 128
words that hold git (legit commit, ./git-helper add, digit add, src/git/commit.ts, cat src/git/commit.ts,
  vim src/GIT/commit.ts, gitk add, git-lfs push --force, GITHUB_TOKEN=x gh pr list, Legit add -A, ...): 16 of 16 allowed
the non-lock rules (force push, -f, +refspec, reset --hard, branch -D / -d --force / --delete --force),
  plain and with --shallow-file x, in git and the five other spellings:  66 of 66 denied, with and without a lock
safe forms (push --force-with-lease, push origin main, branch -d, reset --soft): allowed without a lock
```

In a fixture, `git COMMIT -am x`, `git ADD`, `git STASH`, `git RESET --hard`, `git CHECKOUT`,
`git UPDATE-INDEX` all exit 128 and wrote nothing (one commit, empty index, no stash); `GIT status`
exits 0. The case change adds one denial class: prose with a capitalised `Git` before a guarded
phrase, such as `git commit -m "docs: say why Git reset --hard is denied"`, which the lower-case
form already got at the base by design (`src/hooks.ts:326`, "loose within a command"). The only
new denial among my "words" is `echo $GIT commit` under a lock, where `$GIT commit` can run git.
`git read-tree -n HEAD` is denied under a lock, `git fast-import` and `git hash-object -w` allowed,
as the corrected `Gates-and-Hooks.md:108-116`, `src/hooks.ts:429-437` and `design.md` say.

**"CHANGELOG.md names the refusal ..."** and **"the docs say that an obligation written as
<interpreter> <script> ..."** - met; not touched since round 1, which ran them.

**Item 42's acceptance, "no path ... a recovery the tool prints removes or overwrites content the run
did not write without first saving it, and no state keeps the lock with deleting work as the only way
out"** - holds on every path above: 75 restores byte-identical, nothing written by any refusal, and
where the printed command fails (non-blocking 1) the running CLI's restore and the by-hand stash
still work, though neither is printed.

## Verification I ran

```
$ ./bin/mstack gate                                     # the checkout, 0.2.1 at /Users/romerma/Code/mstack
PASSED - 0 failures, 0 warnings
$ bun run test:bun                                      # S/head; load 7.3 at the start
 1106 pass
 3 skip
 0 fail
Ran 1109 tests across 58 files. [362.53s]
$ bun run test:node                                     # load 22.6 after
ℹ tests 1109
ℹ pass 1108
ℹ fail 0
ℹ skipped 1
$ bun run typecheck                                     # exit 0
$ ./bin/mstack lint-plugin .                            # PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md   # 110 relative links checked, 0 broken
$ ./bin/mstack gate --full                              # S/head, exit 0; its obligation's suites: bun 1106/3/0 of 1109, node 1108/0/1 of 1109
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 1 warning                          # "on main": the copy's own branch
```

1109 is round 1's 1104 plus the five new tests of `mutation-exits` (6 to 11); 58 of the 58
`*.test.ts` files load in the green run. Ten times per runtime (`S/scripts/ten.sh`, a fixed `for`,
`S/out/ten.txt`, mutants running alongside, load 6.9 at the start and 10.8 at the end):
`mutation-exits` bun 0 of 10 failed (10 pass each run), node 0 of 10; `mutation-gate` 0 and 0 (10
each); `mutation-hook` 0 and 0 (10 each); `mutation-refusals` 0 and 0 (21 each). Eighty runs, 0
failures.

Dash as `sh` (`S/scripts/dash.sh`, `S/out/dash.txt`: a copy of the head whose `src/run.ts`,
`src/run-helper.mjs`, `bin/mstack`'s `#!` and the A1 test's `"/bin/sh"` are `/bin/dash`, `sh` first on
`PATH` linked to dash): `mutation-exits` bun 10 pass 1 skip, node 10/1 skipped; `mutation-gate` 10/10;
`mutation-hook` 10/10; `mutation-refusals` 21/21; `mutation-two-stores` 3/3; `mutation-run` 24/24; 0
fail anywhere. The B1 runs above ran every command through `/bin/dash -c` as well. With bun taken
off `PATH`, so the launcher runs node (`S/scripts/node-cli.sh`, `S/out/node-cli.txt`): the quotes
scenario 15 of 15, and the nine shapes agree in all four printers (hook 57 to 116 ms).

**The hook's cost** (`S/scripts/timing.sh`, round 1's harness, median of 15 in process and of 9
through the CLI, load 10):

```
                                   in process r1 -> head      CLI r1 -> head
valid lock, git commit (deny)      34.2 -> 34.0 ms            77 -> 77 ms
garbage lock, git commit           11.1 -> 11.2               53 -> 53
symlink to a valid lock            34.3 -> 11.4 (by hand)     77 -> 54
no lock, git commit                11.4 -> 11.7               54 -> 53
valid lock or none, ls              0.0 ->  0.0               40 -> 40/41
```

`readLockAt` and `checkLock` cost nothing measurable; round 1's +13 ms per deny was `inLockStore`'s
git call, still there. The budget tests (`tests/hook-errors.test.ts`) pass, bun 39/0 and node 39/0;
"a failing hook stays well inside the smallest timeout in hooks.json (5 s)" took 120 ms.

**The three changed tests** (`S/scripts/t4.sh`, `S/out/t4.txt`). Round 1's code with the head's
files, and the head's code with round 1's: each direction fails exactly the one changed test per
file (R25 gate, R25 hook, R1 lock), bun and node. Each new assertion is at least as strict as the
old: the gate's is an exact suffix (`tests/mutation-gate.test.ts:161`), the hook's a suffix with the
`cd` (`tests/mutation-hook.test.ts:165`), R1's an anchored match (`tests/mutation-refusals.test.ts:193`),
and each adds a negative assertion on the gone path followed by `verify --restore`. Nothing is
weaker than the rule change needs. R25 and its scenario, R1's scenario and R15 describe the code;
what they drop, the gone path offered as a command, is what B1 showed cannot run, and the gone path
is still named. R25's "so every command a line offers runs as printed" over-claims for
non-blocking 1's states.

**Docs.** The corrected sentences match the code and the runs above. The transcripts at
`The-CLI.md:850-873` and `Gates-and-Hooks.md:307-316`, rerun on plain paths with a copy of the head
(`S/scripts/transcripts.sh`, `S/out/transcripts.txt`), print the same lines in the same form,
`-> run <scratch>/mstack/bin/mstack verify --restore` and `fix: run <scratch>/mstack/bin/mstack verify
--restore` included.

**Mutants** (`S/scripts/mutants.sh`, `S/mut/mutate.mjs`, `S/out/mutants.txt`), each in a fresh
archive of the head, the four files that pin the lines under bun, together and one by one; the
whole bun suite on a survivor. The unmutated copy: 51 pass, 1 skip, 0 fail, 52 tests across 4 files.

| Mutant | Result |
|---|---|
| M1, round 1's: `shellWord`'s safe set also takes `` $ ` ; & \| ( ) ! * < > ~ `` | killed: `:578` (50 pass, 1 fail) |
| M2, round 1's on the head's code: the gate's *cannot be told* case prints `run <why> where the run started` when no restore takes the lock | killed: `:543` |
| M3, round 1's on the head's code: the hook's `top === null` guard removed (`src/hooks.ts:467-469`) | killed: `:562` |
| X1: the hook reads through `readLockAt` but skips `checkLock` (`src/hooks.ts:501`) | killed: `:267` |
| X2: R15's line after a failed restore drops the clause naming a gone CLI (`src/mutation-run.ts:88`) | survived: the four files 51/1/0, the whole bun suite 1106 pass 3 skip 0 fail |
| X3: the hook's line from inside `.git` drops the same clause (`src/hooks.ts:468`) | survived: the four files 51/1/0, the whole bun suite 1106 pass 3 skip 0 fail |
| X4: "gone" decided by the CLI's directory (`existsSync(join(cli, ".."))`, `src/mutation-lock.ts:736`) | killed: `tests/mutation-gate.test.ts:142` (R25) |

On the real surface the head does print the clause in both lines: R15's in `S/out/r15.txt` above,
and the hook from inside `.git` with a gone `cli` gives `the CLI that wrote the lock, '/gone/old
cli/bin/mstack', is gone; wait for it, or if it is not running, run from . under this worktree's top
level: <R>/head/bin/mstack verify --restore` (`S/scripts/insidegit.sh`).

The implementer's account of bun's shim holds (`S/scripts/shim.sh`, `S/out/shim.txt`): with the gone
CLI offered as the command, bun on the four files together reports `27 pass 1 skip 4 fail 1 error,
Ran 32 tests across 4 files` and `NotImplementedError: test() inside another test()`; each file
alone gives 10, 10, 10 and 21 tests, and node on the four gives 52. A green run loads every file.

## The implementer's account

The claims I checked hold: the suite and dash numbers, "five tests more", 8 of 8 on the real
surface (I got 75 of 75 over five scenarios), the whole lines' exit codes, rows 324 and 325 (git
2.54.0 here: `GIT status` 0, `git COMMIT` 128, `--shallow-file x` 0, `--shallow-file=x` 129), NB5
"word for word" (`:543` asserts equality), and the shim account. I found no false claim.

## Non-blocking

1. **`src/mutation-lock.ts:736`: "gone" is existence, so a CLI path that exists but cannot run is still
   the one command offered.** From B, with the writer killed and then a directory, a mode-644 file, or
   the copy with `src/` deleted left at its path, all four printers offer only
   `cd <W>/top/pkg/a && '<W>/old cli/bin/mstack' verify --restore`, which exits 126 (`is a directory`,
   `Permission denied`) or 127 (`... src/cli.ts is missing. This plugin install is incomplete.`); the
   lock stays, nothing is written, and neither the running CLI's command nor the by-hand way is
   printed (`S/out/nb.txt`). Base and round 1 print the same. No run, update or cleanup I know of
   leaves these states, which is why it is not blocking. Related, not reproduced on a second host: in
   the *cannot be told* case the existence test runs on this host, so a lock from another host is
   called gone and this host's CLI path is the one offered "where the run started"
   (`S/out/otherhost.txt`); the by-hand way is printed there. Fix: decide by `statSync(cli).isFile()`
   and `accessSync(cli, X_OK)` (with `src/cli.ts` beside it), and say "cannot run" rather than "gone".
2. **Four tests fail from a checkout whose path has a space** (`S/scripts/spaced.sh`, `S/out/spaced.txt`).
   They expect the running CLI's path bare, while the code quotes it: `tests/mutation-gate.test.ts:161`
   and `tests/mutation-hook.test.ts:165` (also red at round 1's head), and, new in this round,
   `tests/mutation-refusals.test.ts:193` (`\S+\/bin\/mstack`) and `tests/mutation-exits.test.ts:570,574`
   (`\S+ verify --restore$`). Fix: build the expected text with `shellWord(running)`.
3. **The case rule stops at git.** On this disk `RM -rf rmx/.mstack` exits 0 and deletes it, and `GH`
   resolves to `/opt/homebrew/bin/GH`; the hook allows `RM .git/mstack-mutation.lock`, `RM -rf .mstack`
   and `GH pr merge 1 --admin`, with a lock or without (`S/out/more.txt`, `src/hooks.ts:406`, `:413`).
   Row 325's reason ("a force push spelled GIT is the same force push") applies to them as well. Not
   changed by this item.
4. **The clause that names a gone CLI is unpinned in two lines** (X2, X3 above):
   `src/mutation-run.ts:88` (R15's line, as amended) and `src/hooks.ts:468` (the hook from inside
   `.git`). The command each offers stays right under the mutant, since it comes from
   `restoreCommand`, which A1 pins; only the naming goes untested. A failed restore with the writer
   deleted, as in `S/out/r15.txt`, and the `:562` case with a gone `cli` would pin both.

Lock check before returning: `L="$(git -C /Users/romerma/Code/mstack rev-parse --absolute-git-dir)/mstack-mutation.lock"; test -e "$L" || test -L "$L"` exits 1 (no lock, no link).
