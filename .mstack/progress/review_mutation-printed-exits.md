# Review - mutation-printed-exits

**Verdict:** CHANGES_REQUESTED

Item 101, head `3796222` (code `96425d7`), base `7e96373`, reviewed alone, round 1. Every run of the
mechanism was in a fixture under `S/` =
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review101/`
(scripts in `S/scripts/`, output in `S/out/`); the suites ran in `S/head`, a `git archive` of the
head. `<W>` below is a fixture's directory.

Two printed ways out do not work as printed; both are what this item exists to remove, and
neither is covered by its tests. Everything else holds: no injection through any directory name I
tried, nothing written by any refusal, no line that loops in the 17 hand-edited locks, A4's forms
denied, both suites green.

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| A1 | `tests/mutation-exits.test.ts:173` | exists; runs B's line from B, A's own line, and the gone-CLI line **from A only**; the gone-CLI line from B is not run (B1) |
| A2 | `tests/mutation-exits.test.ts:230` | exists; five shapes, R1 equal to the gate's line, hook by-hand; a symlink at the lock's name is not among them (B2) |
| A3 | `tests/mutation-exits.test.ts:303`, `:345` | exist; `:345` is skipped here (case-folding APFS), so on this machine only `:303` runs |
| A4 | `tests/mutation-exits.test.ts:382`, `tests/mutation-hook.test.ts:78` | exist and assert each named form and the seven verbs |
| A5 | n/a (CHANGELOG text) | `tests/mutation-two-stores.test.ts:199` exists and pins the refusal the text names |
| A6 | `tests/mutation-exits.test.ts:424` | exists; pins the docs' claim for node and dash; passes at base by design |

## Acceptance, quoted

**"the restore command quotes the CLI path: with the CLI under a directory with a space, the printed
line run as printed exits 0 and removes the lock"** - met for every line but one. `S/scripts/a1.sh`
(`S/a1/a1.mjs`) puts a copy of the CLI under `-cli 'q "d $(touch PWN_d) `` `touch PWN_b` `` ;touch PWN_s;
&touch PWN_a& é ü $HOME !x |touch PWN_p| >PWN_r <x *`, the repository under a name of the same kind
(with `${IFS}`), store A under `a 'q" $x ;& é` and store B under `b $(touch PWN_d3)`. Each run was killed
with `kill -9` while its obligation slept on the reverted tree, and each printed line was run through
`/bin/sh -c` and `/bin/dash -c`:

```
== run (A) / gate (A) / R1 (A) / hook (A) / gate (B) / R1 (B) / hook (B) / restore refusal (B)
   via /bin/sh and /bin/dash: exit 0, lock gone, tree byte-identical, markers: none   (16 of 16)
```

A newline in the CLI path (`cli nl\ntouch PWN_n\nx`) gives the same, 16 of 16. No `PWN_*` file was
made anywhere (`S/out/a1-meta.txt`, `S/out/a1-nlcli.txt`). `shellWord` is sound for a POSIX shell, and
`rg 'verify --restore' src/` finds no restore line built outside `restoreCommand` and `inLockStore`.
On plain paths the lines are bare (`<W>/cli/bin/mstack verify --restore`, `-> run <W>/cli/bin/mstack
verify --restore`), as in the transcripts at `The-CLI.md:857`, `:865` and `Gates-and-Hooks.md:304`
(`S/out/a1-plain.txt`). A newline in the *store's* path is refused before anything is written
(`git could not hash the code and test files that changed`). The one line that does not run is the
gone-CLI line from another store, Changes required 1.

**"the hook and the R1 refusal add the cd only for a lock that validateLock accepts; for a lock with no
rootFromTop, R1 no longer says verify --restore puts the tree back when the restore then refuses it"** -
met for the lock as a file. `S/scripts/a2.sh` took a real lock from a killed run and edited
`rootFromTop` 17 ways (none, `..`, `/abs`, A's absolute path, a trailing slash, empty, upper case, NFD,
both, no such directory, a file, a FIFO, a directory inside A, `.` with no store there, a symlink to A,
a symlink to B, a newline). From A and from B, the gate, R1, the hook and `verify --restore` printed
no restore line and gave the by-hand recovery, 136 of 136 outputs (the two gate lines for the newline
case wrap it onto the next line). The tree, the lock and the run directory hashed the same before and
after each case (`S/out/a2-cases.txt`). A symlink at the lock's name is not met, Changes required 2.

**"a rootFromTop that differs from this store's only in case (or Unicode normalisation) does not lead
in a loop: the message prints a way out that works, or the comparison folds as the refusals do"** - met.
For `PKG/CAFÉ`, NFD `pkg/café` and both: no `cd`, and the reason, for example
`<W>/top/PKG/CAFÉ is the store git spells pkg/café, which differs only in case or Unicode form, so its
restore refuses the lock too; by hand, ...`. No line printed, so there was nothing to run three deep.
Decision row 321 ("A3 decides by the disk, through git, not by folding") holds: `inLockStore` calls
`fold` only to pick the sentence.

**"under a lock the hook denies git --namespace foo commit, git --config-env k=v commit and git
--attr-source HEAD add; the plumbing commands round 2 left (non-blocking 5) are decided: denied, or
named in the docs as not covered"** - met. `S/scripts/a4.sh` tried 1608 forms of the 24 listed verbs
under a lock. 1512 are denied: every prefix (`-C dir`, `-c k=v`, `--git-dir`, `--work-tree`, `--namespace`,
`--config-env`, `--attr-source` with `=` and with a space, `--exec-path=`, `-p`, `-P`, `--no-pager`,
`--literal-pathspecs`, mixed and repeated, `GIT_DIR=.git git`, `command git`, `/usr/bin/git`, `env git`,
`\git`) and every wrapper (pipeline, `&&`, `;`, `||`, `$(...)`, backticks, subshell, group, `sh -c`,
newline, `&`). The 96 allowed are all `git --shallow-file x <verb>`, non-blocking 1. Without a lock,
none of the sampled forms is denied. Of 51 reads under a lock, 44 are allowed, among them `status`, `diff`,
`log`, `show`, `rev-parse`, `ls-files`, `cat-file`, `merge-base`, `worktree list`, `git log -- commit`,
`git show update-ref`, `git grep read-tree` and `git commit-graph verify`. The 7 denied are
`stash list`, `stash show`, `rg 'git commit' docs`, `echo 'git add' ...` and `git -C commit status`,
all as at base, plus two new ones a session does not need: `checkout-index --help` and
`read-tree -n HEAD`. Round 2's six are decided: `checkout-index`, `read-tree`,
`update-index` and `update-ref` are denied; `branch -f` and `sparse-checkout` are named in
`Gates-and-Hooks.md:108-112` and in R26's "Not caught".

**"CHANGELOG.md names the refusal of verify --restore under the lock of another store of the
worktree"** - met, `CHANGELOG.md:20-22`. It says what the code does.

**"the docs say that an obligation written as <interpreter> <script> whose script the revert removed is
recorded as killed, not blocked, wherever the interpreter does not exit 126 or 127 ..."** - met,
`docs/wiki/The-CLI.md:774-780`. Every exit code it names, run here (`S/out/a6.txt`): bash 127,
`/bin/dash` 2, python3 2, perl 2, node 1, bun 1, ruby 1; `scripts/check.sh` missing gives 127 under bash
and dash.

**Item 42's acceptance, "no path ... a recovery the tool prints removes or overwrites content the run
did not write without first saving it, and no state keeps the lock with deleting work as the only way
out"** - holds on every path I ran. In each state below the by-hand recovery is printed or works
(`git stash push --include-untracked` keeps everything), and no run lost a byte.

## Verification I ran

```
$ ./bin/mstack gate                      # in the checkout
PASSED - 0 failures, 0 warnings
$ bun run test:bun                       # S/head; load 6.5 at the start, 20.5 after node
 1101 pass
 3 skip
 0 fail
Ran 1104 tests across 58 files. [356.82s]
$ bun run test:node
ℹ tests 1104
ℹ pass 1103
ℹ fail 0
ℹ skipped 1
$ bun run typecheck                      # exit 0
$ ./bin/mstack lint-plugin .             # PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md   # 110 relative links checked, 0 broken
```

Ten times per runtime, a fixed `for` in `S/scripts/ten.sh` (load 6.2 at the start, 8.9 at the end,
with the mutants running alongside): `mutation-exits` bun 0 of 10 failed, node 0 of 10;
`mutation-hook` 0 and 0; `mutation-refusals` 0 and 0. Sixty runs, 0 failures (`S/out/ten.txt`).

Under dash (`S/scripts/dash.sh`, `S/out/dash.txt`), in a copy whose `src/run.ts`, `src/run-helper.mjs`,
`bin/mstack`'s `#!` and the new test's `sh()` use `/bin/dash`, with `sh` first on `PATH` linked to dash:
`mutation-exits` bun 5 pass 1 skip, node 5/1 skipped; `mutation-hook` 10/10; `mutation-refusals` 21/21;
`mutation-two-stores` 3/3; `mutation-run` 24/24; 0 fail anywhere.

**Changed tests** (`S/scripts/t4.sh`, `S/out/t4.txt`). No assertion was changed; `cd09a53` changes
only the fixtures and `6dd505b` swaps one allowed control.

```
base src + base tests:      mutation-hook bun 10 pass 0 fail, node 10/0; mutation-refusals bun 21/0, node 21/0
base src + cd09a53 tests:   mutation-hook bun 10/0, node 10/0;           mutation-refusals bun 21/0, node 21/0
base src + head tests:      mutation-hook bun 10/0, node 10/0;           mutation-refusals bun 21/0, node 21/0
head src + base tests:      mutation-hook bun 7 pass 3 fail;             mutation-refusals bun 20 pass 1 fail
```

So decision row 320's "both files green at base with the new fixtures" holds. The old fixtures fail
at the head because they wrote locks `validateLock` rejects. The control line in `:85`
(`git commit-tree HEAD^{tree}` became `git merge-base HEAD HEAD`) is a consequence of A4:
`commit-tree` is now denied, and `:398` asserts that.

**Spec and design.** R1's scenario, R24, R25, R26 and the three `design.md` bullets each describe the
code. R24's "MUST name that directory" became "named only when the restore run there takes the
lock ..., else the by-hand recovery". That is the fix A3 asks for, not a weaker guarantee. Two
sentences are contradicted by runs: R25's "so the line runs as printed" (B1) and the `preToolUse`
bullet's "R25's command when `validateLock` accepts the lock" (B2).

**The hook's cost** (`S/scripts/timing.sh`, in process, median of 15). A3 adds one `git rev-parse`,
only on a deny under a lock `validateLock` accepts:

```
base: valid lock, git commit 25.4 ms   garbage lock 13.4 ms   no lock 13.6 ms   valid lock, ls 0.0 ms
head: valid lock, git commit 38.8 ms   garbage lock 13.4 ms   no lock 12.8 ms   valid lock, ls 0.0 ms
```

Through the CLI (bun), a deny under a valid lock takes a median of 77 ms of 9. `ls` and `git status`
take 40 ms with a lock or without, and start no git. `inLockStore` cannot be made to hang or throw
with a FIFO, a file, a symlink loop or a newline as `rootFromTop`: `statSync` does not open, and
`findStore` only tests names. If it threw, `cli.ts:1360` catches it and the hook fails open (M3 below).

**Three mutants of my own**, each in a fresh archive of the head (`S/scripts/mutants.sh`, `S/mut/mutate.mjs`),
the whole bun suite on each (`S/out/mutants.txt`). All three survive:

| Mutant | Effect, shown | bun suite |
|---|---|---|
| M1 `shellWord`'s safe set also takes `` $ ` ; & \| ( ) ! * < > ~ `` | `/opt/a;touch;b/bin/mstack` and `/home/$USER/bin/mstack` printed bare (`S/out/mut-demo1.txt`) | 1101 pass, 3 skip, 0 fail: survived |
| M2 the gate's `unknown` case prints `run ${way.none} where the run started` when no restore takes the lock | `src/gate.ts:715`, the by-hand branch of the new code | 1101 / 3 / 0: survived |
| M3 the hook's `top === null` guard (`src/hooks.ts:460`) removed | from inside `.git`, with a lock of store `pkg/a`, `git -C .. commit -am x` throws `ERR_INVALID_ARG_TYPE`, and the CLI fails open (`S/out/m3demo.txt`) | 1101 / 3 / 0: survived |

Each one needs an unusual path, host or cwd. Together they show what the tests do not pin: the
quoting set beyond a space and the two quotes, the `unknown` liveness with no way out, and the
hook from a cwd with no top level.

## Changes required

1. **`src/mutation-lock.ts:171-174` with `:714-717`: with the lock's CLI gone, the line printed in
   another store has no runnable alternative.** `fromLockStore` and `inLockStore` put
   `cd <dir> &&` in front of the whole of `restoreCommand`. When the lock's `cli` is gone, that is
   `<gone> verify --restore (that file is gone), or <running> verify --restore`, so the `cd` binds
   only to the alternative that cannot run. The gate, R1, the hook and the restore's refusal in B all
   print it (`S/out/a1-plain.txt`, the same in `a1-meta.txt` and `a1-nlcli.txt`):

   ```
   == gate, cli gone (B): printed "cd <W>/top/pkg/a && '<W>/gone cli/bin/mstack' verify --restore (that file is gone), or <W>/cli/bin/mstack verify --restore"
      whole via /bin/sh: exit 2   -> syntax error near unexpected token `('
      first via /bin/dash: exit 127 -> <W>/gone cli/bin/mstack: not found
      second via /bin/sh: exit 2  -> mutation: refused: the lock is the run's of the store at pkg/a in this worktree, and this store is at pkg/b; ...
                                     mutation: run it from that store: cd <W>/top/pkg/a && '<W>/gone cli/bin/mstack' verify --restore (that file is gone), or <W>/cli/bin/mstack verify --restore
   ```

   The second alternative, run from B where it was printed, refuses and prints the same line again:
   the loop A3 removes, reached by another way. It happens when a run is killed in one store of a
   monorepo and the plugin is updated before the restore, which moves the versioned cache path R25's
   gone branch exists for. The `A1` test runs the gone-CLI line only from A (`:199-205`). Fix: put the
   `cd` in front of each alternative (`cd D && <running> verify --restore`), and run B's gone-CLI line
   in the A1 test. This is not new in item 101 (base's `fromLockStore` composed it the same way), but
   A1 and R25 as amended claim every line runs as printed.
2. **`src/hooks.ts:483-490`: for a symlink at the lock's name, the hook names a restore that refuses.**
   `readLockRecord` reads with `readFileSync`, which follows the link, and validates the target. The
   gate, R1 and the restore read with `READ_FLAGS` (`O_NOFOLLOW`) and call the lock unreadable
   (`S/out/a2-links.txt`):

   ```
   gate:    [fail]  a mutation lock exists and cannot be read as a run's record: the lock <W>/top/.git/mstack-mutation.lock cannot be read: ELOOP ... -> by hand, ...
   hook:    ... It is held by pid 60338: wait for it, or if it is not running, run cd '<W>/top/pkg/café' && <W>/cli/bin/mstack verify --restore
   the hook's line run: -> exit 2, lock stays: mutation: refused: the lock ... cannot be read: ELOOP ...; nothing was written, and the lock stays
   ```

   The implementer says this is outside the criteria. It is not, for the symlink. A2 removes exactly
   this disagreement: the hook naming a restore for a lock the gate calls unreadable. The amended
   `design.md` bullet ("R25's command when `validateLock` accepts the lock ... and otherwise ... the
   by-hand recovery ..., whose line says the same") and `Gates-and-Hooks.md:96` ("for a lock the
   restore would refuse, the by-hand recovery instead, as the gate gives it") both say it does not
   happen. Nothing is written and the restore's refusal prints the by-hand way, so it does not loop.
   Fix: open with `READ_FLAGS` and require `fstat().isFile()`, as `readLock` does (or share its
   reader), and add the symlink to A2's cases. The same change ends the FIFO hang, non-blocking 3.

## Non-blocking

1. **`src/hooks.ts:363`: `--shallow-file` also takes its value after a space.** Under a lock, `git
   --shallow-file x commit` (and each of the 24 verbs) is allowed. git accepts the form: `git
   --shallow-file x status` exits 0, `--shallow-file=x` exits 129 (`S/out/a4.txt`). The comment says the
   list follows git.c's `handle_options`. This is the same class as round 3's non-blocking 1. Fix: add
   `shallow-file` to the spaced alternation. Also outside the regex: `GIT commit`, since `GIT status`
   exits 0 on this case-folding disk. It is the same kind of miss as `"git"`, and is not named in the
   docs.
2. **Docs that over-claim the plumbing.** `Gates-and-Hooks.md:112`: "None of these can save the reverted
   tree" covers "every other command git has". `git fast-import`, under a lock with a reverted file, is
   allowed and wrote `refs/heads/saved` holding it (`S/out/plumbing.txt`:
   `refs/heads/saved:src/x.js = "OLD", a commit on top of HEAD with the reverted file`). `src/hooks.ts:426`
   ("None of them has a form that only reads") and `design.md` ("has no form that only reads") are
   both wrong: `git read-tree -n HEAD` (dry run)
   is denied. The five named commands behave as the implementer says: `hash-object -w` added no
   object (9 before, 9 after), `branch -f` and `tag` point at `NEW`, `symbolic-ref` touches no file, and
   `sparse-checkout set docs` left `src/x.js` reverted in place. Fix: say what the hook denies and that
   the rest is not covered, and drop the absolute claim.
3. **A FIFO at the lock's name blocks the hook** (`readFileSync`, `src/hooks.ts:485`). `hook
   pre-tool-use` for `git commit` was still blocked when my 12 s timeout killed it; `hooks.json` gives it
   5 s. The gate (185 ms), `verify --restore` (53 ms) and `verify --mutation` (172 ms) answered "not a
   regular file". R26's "decide by the lock's existence alone" then depends on what Claude Code does
   with a timed-out hook, which I did not verify. Not new in this item; the fix for item 2 above ends it.
4. **A lock hand-edited to name another real store is restored into that store.** With `rootFromTop`
   set to `pkg/b` on A's lock, all four print `cd <W>/top/pkg/b && <cli> verify --restore`. Run as
   printed, it exits 0 with `0 at HEAD, 0 as the revert wrote them, 1 other / restored 1, tree verified,
   lock removed`. It wrote `NEW` to B's new `src/x.js`, left A's `src/x.js` at `OLD` and removed the
   lock (`S/out/a2-cases.txt`, "after the last case"). Nothing was lost: B's path was empty, and HEAD
   holds `NEW`. But the record that A is reverted is gone, and A's tree only shows as dirty. Base
   printed the same `cd`, and `validateLock` cannot tell. A guard would compare the lock's `root` or its
   entries' identities with the store found at the directory.
5. **The gate's `unknown` case with no way out drops "wait".** `src/gate.ts:715` gives only `byHand`,
   while R1 (`src/mutation.ts:395`) gives `wait for it to end; ${byHand}`. A run that may be alive on
   another host gets "stash, then delete the lock" from the gate with no caution. See M2 for the test.
6. **Branches the tests do not pin** (M1 to M3 above). No test calls `shellWord`, and every odd path
   in the A1 test holds a space or a quote. No test reaches `src/gate.ts:715`'s by-hand branch, or the
   hook's `top === null` branch: without that guard the hook fails open, though nothing in this
   item removes it.

## The implementer's account

The claims I checked hold, with one exception: the hook's `readFileSync` is "not in these findings" is
true of the findings list, but for the symlink it falls inside A2 and the amended design, as Changes
required 2 shows. The rest checked out against the code or a run: 21 mutants, the `checkout-index`
reason (row 322: "`-f` writes the index's (HEAD's) content over a reverted file"), the
not-covered list, and "both files green at base". `checkout-index` breaks no recovery: the only
printed advice that names the newly denied plumbing is `git update-index --no-skip-worktree`
(`src/mutation.ts:282`). R1 gives it after the lock refusal (`:250`), so it is never printed under a
lock. `BY_HAND` and the failed-restore lines name only `git stash`, `git restore` (after the lock is
gone), `mv` and `chmod`.

Lock check before returning: `test -e "$(git -C /Users/romerma/Code/mstack rev-parse
--absolute-git-dir)/mstack-mutation.lock"` exits 1 (no lock).
