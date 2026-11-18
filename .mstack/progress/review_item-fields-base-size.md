# Review - item-fields-base-size

**Verdict:** CHANGES_REQUESTED

Reviewed head `d0a97b6f7d669665c6dccbdd149e35a73a3cebab` against base `a74361d`, alone (no lens).
Every probe ran `./bin/mstack` from this checkout (`mstack 0.2.1 at /Users/romerma/Code/mstack`)
in throwaway repositories under the session scratchpad, with `GIT_CONFIG_GLOBAL=/dev/null`.
No field of this repository's store was set.

The three criteria hold as worded, and the suites, the typecheck, lint and the gate are green.
One case a user will plausibly hit gets a false red, and the fix line it prints is wrong. That
is the blocking finding. Everything else is filed below as non-blocking.

## Blocking

1. **After a rebase onto a default branch that has moved (or a merge of it into the branch), a
   size s item fails with the advice "it is not small: --size m".** `src/size.ts:57` measures
   `git diff <base>` against the working tree, so once the branch carries commits from `main`
   that were made after `base`, those commits count as the item's own work. `src/gate.ts:309`
   then tells the session to re-size an item whose own change is 10 lines. Who hits it: anyone
   who rebases a small branch onto an updated `origin/main` before review (or clicks GitHub's
   "Update branch", which merges `main` in). That is routine whenever another PR lands while a
   small item is open, and an item that is cancelled and reopened later starts from the same
   stale base. Repro (bash, scratch dir, `M=./bin/mstack` of this checkout):

   ```
   git init -q -b main r && cd r && git config user.email t@e && git config user.name t
   echo seed > seed.txt && git add . && git commit -qm init && $M setup >/dev/null
   printf '# Current session\n\n- **Item:** x\n\n## Next step\n\ncarry on\n' > .mstack/progress/current.md
   git add -A && git commit -qm store
   $M state add --slug one --title T --acceptance x --size s
   git checkout -qb feat/one && $M state set one --status in_progress
   for i in $(seq 10); do echo "f $i"; done > fix.ts && git add -A && git commit -qm fix
   $M gate        # [ok] one is size s: 10 lines in 1 file of code since 0801f395 ...
   git checkout -q main; for n in p q r s t; do for i in $(seq 40); do echo "$n $i"; done > $n.ts; done
   git add -- '*.ts' && git commit -qm "other work on main" && git checkout -q feat/one && git rebase -q main
   $M gate
   ```
   prints (pasted from the run):
   ```
   [fail]  1 one (in_progress) is size s but its code diff from 0801f395 is 210 lines in 6 files, over the limits of 60 lines and 3 files
           fix: it is not small: 'mstack state set one --size m' (or split the work)
   ```
   The design row (decisions.tsv line 209, "compared from base to the working tree") is being
   followed. What it describes gives the wrong answer here, so this needs a `decide` row and a
   change. Options and their tradeoffs: (a) measure from `git merge-base HEAD <default branch>`
   whenever `base` is an ancestor of it. That is exact for rebases and merges, but once the
   branch has merged into `main` it measures only what is uncommitted. (b) keep the measurement,
   and when `base..HEAD` contains commits reachable from the default branch, make the fail line
   say so and name `--base <default branch>` instead of `--size m`. This is cheap and keeps the
   design, but the gate stays red until someone runs `--base`. (c) document it only. That is not
   enough, because the fix line actively gives the wrong advice. Whichever is chosen needs a test
   that rebases.

## Non-blocking (file these)

1. **Closing goes around the check.** A size s item over the limit at `verifying` closes with
   `state set --status done` and the gate turns green, with `size: s` still on record. I
   reproduced it: the gate failed at verifying with "160 lines in 4 files", then I ran
   `ledger record ... test-verified` and `state set one --status done` (exit 0), and the next
   `gate` printed `PASSED - 0 failures, 1 warning`; `state show` printed `size: s`. Ship step 7
   (`skills/ship/SKILL.md:31-33`) runs the ledger row and then `done`, with no gate in between.
   This is the "requirement with an escape hatch" shape that `src/cli.ts` already guards against
   for verification. `src/closing.ts:143` (`CLOSING_CHECKS`) is the one-entry place to refuse it.
   The design scoped the check to active items, so this is filed rather than blocking. It matters
   for items 43 and 44, which will read the recorded size.
2. **A store in a sub-directory of the git top level is measured inconsistently.** `setup` uses
   cwd (`src/cli.ts:183`), so `mstack setup` in `pkg/app` of a monorepo gives this layout.
   `git diff` covers the whole repository, but `ls-files --others` (`src/size.ts:58`, run with
   cwd = store root) lists only the sub-directory. So a 50-line untracked `other.ts` at the top
   level is not counted (`60 lines in 3 files`, pass). Once it is committed it is counted
   (`110 lines in 4 files`, fail). The classifier also sees top-level-relative paths, so
   `pkg/app/tests/helper.ts` counts as code (`160 lines in 4 files`). Two statements are wrong
   for this layout: the implementer's report (line 135) says it "is handled by realpath and
   `--full-name`", and `docs/wiki/Gates-and-Hooks.md:194` says "untracked files git does not
   ignore". Passing `:/` as the pathspec to `ls-files` (or running it from the top level) and
   classifying store-relative paths would fix both.
3. **`--no-renames` is load-bearing and untested.** A pure `git mv` of a 100-line file counts
   as `200 lines in 2 files` and fails a size s item. Whether a rename is "small" is a product
   question worth a row. Separately, I mutated `--no-renames` to `-M`: the rename record
   `0\t0\t\0old\0new\0` then parses into `NaN` lines, so every comparison is false and the gate
   passes anything. That mutant survived all 49 tests (M9 below). Add a rename test.
4. **Git's answer and the untracked-file count disagree** (`src/size.ts:96` `countLines`). Each
   case below was measured untracked, then staged:
   - a NUL after byte 8000 gives `0 lines`, then `31 lines`;
   - a `*.dat binary` attribute gives `40 lines`, then `0 lines`;
   - an untracked symlink to a 500-line file outside the repository counts `500 lines` (git counts 1);
   - an untracked nested repository counts as 1 file;
   - a `.mstack` that is a symlink to a directory outside the repository counts as a code file
     (the realpath comparison at `src/size.ts:70` misses the link itself).

   `git diff --no-index --numstat /dev/null <path>` per untracked file, or an intent-to-add in a
   temporary index, would make both sides git's own answer.
5. **"git could not measure its diff" sends the user to `--base`** (`src/gate.ts:294`) even when
   the base is fine. `git()` has node's default `maxBuffer` (1 MiB) and a 5 s timeout. With
   30,000 untracked, non-ignored files the listing is 1,579,070 bytes, and both runtimes print
   `[fail] ... git could not measure its diff from f637d48b` with
   `fix: 'mstack state set one --base <commit>' points it at a commit that exists`. The verdict
   is still red, which is right, but the remedy it names is wrong. A 5 MB changed file is fine,
   because numstat output is one line per file.
6. **`state.json` accepts any string as `base`** (`src/state.ts:219`). A hand-edited
   `"base": "HEAD"` is measured against a moving ref (`code diff from HEAD is 160 lines`), and
   `""` prints `its base  is not a commit git can find`. A 40- or 64-hex check would close both.
7. **Coverage gaps found by mutation** (my mutants M5 to M7, below):
   - decision 5 (a bad `size` in `state.json` is a read error) has no test, so M6 survived;
   - decision 6's `[ok]` line has no test, so M7 survived;
   - the last line of an untracked file without a newline has no test, so M5 survived.
8. **Smaller points:**
   - `DEFAULT_SIZE` (`src/size.ts:24`) is exported and never read.
   - The `--clear` help at `src/cliopts.ts:62` hand-copies `CLEARABLE` (`src/cli.ts:200`), so a
     field added in one place will drift from the other.
   - `parseSize` trims, so `--size " s "` is accepted.
   - `--size s --size l` takes the last value; this is existing parseArgs behaviour, as with `--title`.
   - Outside any repository, `--base HEAD` says `'HEAD' is not a commit in this repository`.
   - Lockfiles, `.gitignore`, CI YAML and `package.json` count as code, so a size s dependency
     bump fails on its lockfile. That is a classifier choice and should be said in the wiki.
   - Commit `1273254` is red: 8 of the 49 new tests fail there. That breaks bisect. It was disclosed.
   - Every git sandbox test (`tests/helpers.ts`, an existing helper) fails under a global
     `commit.gpgsign=true`: 45 of 49 in the new file, 78 of 78 in `tests/gate.test.ts`. This is
     not a regression from this item.

## Acceptance, quoted

**"size s|m|l is accepted by state add and state set, clearable (absent means m), and an invalid
value is refused rather than dropped"**: met.
- `state add --size s`: `added 1 one (pending)`, and `state show` prints `size: s`.
- `state set one --size l`: `size: "s" -> "l"`.
- `--clear size`: `size: "l" -> (unset)`, and again `size: already unset`.
- Absent: `state show --json` has no `size` key, and no write adds one. I checked this with
  `rg '"size"'`, and with the old version writing back to the new one, which was byte-identical.
- "Absent means m" is consulted in only two places: the gate's `item.size !== "s"`
  (`src/gate.ts:291`) and the sdd refusal. `DEFAULT_SIZE` is never read.
- Refused with exit 2 and the file byte-identical (`cmp`): `S`, `xl`, `""`, `" "`, `medium`,
  `s m` at `set`, and `S`, `""` at `add`.
- `--size s --clear size` gives `contradict each other`, exit 2, byte-identical.

**"base is recorded automatically on the first move to in_progress only, editable with --base,
and refused by --clear"**: met.
- The first move prints `base: (unset) -> "9e88cea8..."`, which equals `git rev-parse HEAD`.
- No change after a second commit followed by `reviewing -> in_progress`. A no-op
  `--status in_progress` and a `--force` skip to `reviewing` record nothing.
- `--base` accepts and stores in full:
  - a short sha, which becomes the full one;
  - `main~1`;
  - a light tag `v1`;
  - an annotated tag `v2`, which resolves to its commit;
  - `HEAD@{0}`.
- `--base` refuses with exit 2, byte-identical:
  - a tree id and a blob id;
  - `HEAD^{tree}`;
  - a sha that is not in this repository;
  - `--base=--output=x` (no file was created) and `--base=-n`;
  - `""` (`an empty --base is not a value`).
- `--clear base` gives `base cannot be cleared`, exit 2, byte-identical. It is also refused when
  combined with `--status in_progress`.
- No repository, or no commit yet: the move succeeds and prints
  `base: not recorded (not a git repository, or no commit yet); 'state set --base <commit>' sets one`.
- A detached HEAD records the detached sha.
- A linked worktree (`./bin/mstack worktree new one --base main`) records the worktree's HEAD,
  and the gate there measures `20 lines in 4 files` (fail), then `15 lines in 3 files` (pass).
- Where "first move" and "the move that finds no base" differ:
  - a base removed by hand-editing `state.json` is re-recorded at the next move (`base: (unset) -> "c9eb..."`);
  - an item cancelled, reopened and restarted keeps its original base, as the design's
    "written once" says, which feeds blocking finding 1.

  Both results follow the design. The second one is stale.

**"The gate fails an item with base and size s whose code diff from base exceeds 60 lines or 3
files, and sdd with size s is refused"**: met as worded, with the false red in blocking finding 1
and the escape in non-blocking finding 1.
- Limits:
  - `60 lines in 3 files` passes with `[ok]`, exit 0;
  - `61 lines in 3 files` fails, exit 1;
  - `4 lines in 4 files` fails, exit 1.
- Not counted:
  - `tests/x.ts`, `sub/__tests__/q.ts`, `x.test.js`, `docs/x.txt`, `README.md`, `LICENSE.txt`
    and `.mstack/junk.ts`, 500 lines each, leave the count at `60 lines in 3 files`;
  - an ignored `gen/o.ts` is not counted.
- Counted:
  - committed, staged, unstaged and untracked changes together: 59, then 60 (pass), then 61 (fail);
  - a deleted 100-line file counts `100 lines in 1 file`.
- CRLF files and files without a final newline count the same as git counts them, untracked and
  staged, and also with `core.autocrlf=true`.
- Paths with a space, a tab, `ñandú.ts` and `日本.ts` count correctly: `61 lines in 4 files`
  after the fourth file.
- A submodule add counts `.gitmodules` and the gitlink: `4 lines in 2 files`.
- Not measured, and the gate says nothing: size `m`, `l`, absent, an item with no base, and
  inactive items.
- `reviewing` and `verifying` items are measured. That is right, because it is the same work
  and the gate holds it until close.
- An unresolvable base gives
  `base ffff... is not a commit git can find` with `fix: 'mstack state set one --base <commit>' ...`.
  So do a tree id and `-n` written by hand into `state.json`. `--output=<path>` is refused and
  nothing is written.
- A repository reached through `/tmp` rather than `/private/tmp`, with a 200-line `.mstack/junk.ts`,
  counts `0 lines in 0 files`, so the store exclusion holds.
- Unusual git config changes nothing: `color.ui=always`, `color.diff=always`, `diff.relative`,
  `diff.noprefix`, `diff.mnemonicPrefix`, `core.quotePath` and `diff.ignoreSubmodules=all` all
  give the same `100 lines in 1 file`.
- sdd with size s is refused with exit 2 and the file byte-identical in five ways:
  `add --sdd --size s`, `add --size s --sdd`, `set <sdd item> --size s`, `set <s item> --sdd`
  and `set <s item> --sdd --size s`. `set <s item> --sdd --clear size` is allowed.

## The implementer's decisions, judged

1. "No pattern overrides exist." True. `rg -n "classifyPath|PatternOverrides|TEST_PATTERNS" src`
   finds only `src/pathclass.ts` and the one call at `src/size.ts:73`. Neither the merge gate nor
   any other check classifies paths, so there is nothing to match.
2. "First move" is read as "the move that finds no base". It is defensible: the two sequences
   where this differs are under acceptance 2 above. The stale base on reopen belongs to blocking
   finding 1.
3. The no-base notice on stdout is consistent with the change list and true.
4. The full sha is stored. That is right, and verified for short shas, tags and annotated tags.
5. A bad `size` is a read error, consistent with the other shape checks:
   - `state list` and `state show` exit 2 naming `.items[0].size must be s, m or l, got "xl"`;
   - `gate` fails, the Stop hook reports the gate red, and the status line shows `state.json unreadable`;
   - `hook session-start` says "No active work item", the same as for an existing shape error
     such as a bad `status`.

   The previous version (`a74361d`, run from a scratch worktree) does not reject unknown item
   keys. It shows `size: s` and `base: ...`, its gate passes, and its writes keep both keys.
   Writing back through this version was byte-identical. Untested (M6).
6. The gate prints nothing for an item it does not measure, `[ok]` within the limits, and `[fail]`
   with one fix line over them. Verified. The `[ok]` line is untested (M7).

## The code

- `src/size.ts` goes through `src/git.ts` (`execFileSync`, an argv array, no shell). A value
  starting with `-` is refused before git sees it. M10 shows the guard is a belt: `rev-parse
  --verify` refuses those values anyway. `measureDiff` only ever receives a base that has
  already resolved.
- git errors become a `[fail]`, never a pass, but the fix line names `--base` for every cause
  (non-blocking 5).
- The two limits are named constants in one place (`src/size.ts:27,29`). The gate, the fail
  line and the `--help` text read them.
- `src/cli.ts`: every refusal is thrown inside `updateState` before the write. Byte-identical
  checks hold for invalid sizes, bad `--base` values, the sdd conflicts and `--clear base`, alone
  and combined with `--status in_progress`. The help text lists `--size` and `--base`, and
  `--clear` names `size` and says `base` is refused.
- `src/state.ts`: `size` and `base` are known keys, and a store holding both round-trips
  byte-identical.

## Tests

`tests/item-size-base.test.ts` has 49 tests:
- State tests are spawned at the CLI under node and bun, as `onEach` does.
- Gate tests run `runGate` in-process over real git repositories, plus one spawned `gate` that
  checks the exit code.
- Timeouts are explicit: `SPAWN` is 120 s and `GATE` is 60 s.
- I saw nothing nondeterministic.
- They do not depend on the developer's git config. With `HOME` an empty directory,
  `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_NOSYSTEM=1`: bun `49 pass 0 fail`, node
  `pass 49 fail 0`. With `core.autocrlf=true` and `init.defaultBranch=trunk`: `49 pass 0 fail`.
  The only dependency is gpgsign, which is in the existing helper.

Mutants, each applied in a scratch worktree of `d0a97b6`, run with
`bun test tests/item-size-base.test.ts`, then restored:

| Mutant | Result | Red lines |
|---|---|---|
| M1 lines `>` to `>=` | killed, 5 fail | `(fail) exactly 60 changed lines in exactly 3 code files passes`, `(fail) test files, doc files and everything under .mstack/ do not count`, `(fail) a code file under .mstack/ is dropped by the store exclusion and not by the classifier`, `(fail) an uncommitted edit to a tracked file counts insertions plus deletions`, `(fail) an untracked file that git ignores does not count` |
| M2 files `>` to `>=` | killed, 6 fail | `(fail) exactly 60 changed lines in exactly 3 code files passes`, `(fail) test files, doc files and everything under .mstack/ do not count`, `(fail) a code file under .mstack/ is dropped by the store exclusion and not by the classifier`, `(fail) an untracked file that git ignores does not count`, `(fail) a binary file counts as a file and as zero lines`, `(fail) a tracked binary file that changed counts as a file and as zero lines` |
| M3 store-directory exclusion removed | killed, 11 fail | `(fail) exactly 60 changed lines ...`, `(fail) 61 changed lines fails with both counts, both limits and the fix`, `(fail) 4 code files fails even when they hold 4 lines`, ... `(fail) mstack gate exits 1 over the limit and prints the [fail] line, then 0 once the item is size m` |
| M4 "first move only" (`item.base === undefined`) removed | killed, 2 fail | `(fail) a later return to in_progress leaves the base alone [node]`, `(fail) a later return to in_progress leaves the base alone [bun]` |
| M5 (mine) last line without newline not counted | **survived**, 49 pass | none |
| M6 (mine) bad `size` in `state.json` silently accepted | **survived**, 49 pass | none |
| M7 (mine) the `[ok]` line for a measured item dropped | **survived**, 49 pass | none |
| M8 (mine) `--exclude-standard` removed | killed, 1 fail | `(fail) an untracked file that git ignores does not count` |
| M9 (mine) `--no-renames` replaced by `-M` | **survived**, 49 pass | none (rename record parses as NaN; non-blocking 3) |
| M10 (mine) leading-dash guard removed | survived, equivalent | `rev-parse --verify` refuses the same values |

Timing, five runs of the new file on each runtime (bun's per-test times from
`--reporter=junit`). The slowest test every time was "size m, size l, an absent size, an item
with no base and an inactive item are not measured": bun 948 to 977 ms, node 972 to 990 ms. The
whole file takes about 12.3 s on bun and 12.5 s on node. Both are well under bun's 5 s per-test
default.

## Docs

- I reproduced the transcripts in `docs/wiki/The-CLI.md` ("Size and base") and
  `docs/wiki/Gates-and-Hooks.md` ("size s"). They match line for line except the sha:
  `1dd52334` on the page, `68084c7b` in my run. The wiki's failure line is what the gate prints now:
  `[fail]  1 greet-flag (in_progress) is size s but its code diff from 68084c7b is 24 lines in 4 files, over the limits of 60 lines and 3 files` /
  `fix: it is not small: 'mstack state set greet-flag --size m' (or split the work)`.
- The CHANGELOG entry is true of the code, including "Nothing in the intake or the skills
  chooses a size yet" (`rg -n "\-\-size|size s" skills agents` finds nothing).
- One sentence is false for a sub-directory store (non-blocking 2).

## Verification I ran

- `npm run typecheck`: exit 0, no output.
- `./bin/mstack lint-plugin .`: `PASSED - 0 failures, 0 warnings`.
- `./bin/mstack gate`: `PASSED - 0 failures, 0 warnings`, with item 40 `reviewing`, no size, no base.
- `./bin/mstack gate --full`: `[ok] npm test && npm run typecheck && bin/mstack lint-plugin .` /
  `PASSED - 0 failures, 0 warnings`.
- `npm run test:bun`: `683 pass` / `0 fail` / `Ran 683 tests across 29 files. [127.47s]`.
- `npm run test:node`: `ℹ tests 683` / `ℹ pass 683` / `ℹ fail 0`.
- `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`: `97 relative links checked, 0 broken`.
- Node 22.6.0 (`~/.nvm/versions/node/v22.6.0`), new file only: `# tests 49` / `# pass 49` /
  `# fail 0`. `gate` on 22.6 prints the same `[fail]` line.
- `claude plugin validate . --strict`: exit 1, on `root: CLAUDE.md at the plugin root is not
  loaded as project context`. This diff touches neither `CLAUDE.md` nor `.claude-plugin/`, so it
  is not this item's.
- `./bin/mstack ledger check item-fields-base-size` before this review: `FAIL no verdict at
  d0a97b6f; 1 row(s) exist at other SHAs`.

## Not checked

- `merge-gate` against a real PR.
- A store in CI with a shallow clone, where `base` would be missing and the gate would say so.
  Nothing in this repository runs the gate in CI.
- Windows paths.
- A real `diff.external`.
- A 1 GB untracked file (`countLines` reads the whole file).
- Submodule content changes beyond the add.

## Note on my own run

My first attempt at the gate probe ran under zsh: an alias named `g` broke a sourced helper, and
its commands ran in this checkout. That made two commits on `feat/item-size-and-base` (`327dfd6
ig`, which replaced `.gitignore`, and `1138506 a`) and wrote 14 generated files and a 500-line
`README.md`. I confirmed each file held my generated content, then undid all of it:
`git reset --soft d0a97b6`, `git restore --source=d0a97b6 --staged --worktree -- .gitignore
README.md`, `git rm --cached` on the two staged files, and `rm` on the named paths. `git status`
was clean at `d0a97b6` afterwards. Previously ignored files (`node_modules/`, `bun.lock`,
`sandbox/`, `docs/research/notes-2026-11-16/`) were not touched. Both suites were rerun from the
clean tree, and the numbers above are from that rerun. Nothing was pushed. Both stray commits are
still in the reflog.
