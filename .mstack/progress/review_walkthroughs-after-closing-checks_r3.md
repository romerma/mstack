# Review - walkthroughs-after-closing-checks, round 3

**Verdict:** APPROVED

Reviewed at `63436fdd8ac0ef54fd35cff8faff04e6efe3871f`. The round's change is `git diff fe64878..63436fd -- README.md docs tests CHANGELOG.md`.
I ran everything from scripts in the session scratchpad, `review96r3/`: `gs.sh` (Getting-Started), `ag.sh` (The-Agents), `rd.sh` (README),
`check.py` (page against run), `crossdiff.py` (run against run), `consts.mjs`, `test4.sh` (the test and its mutant) and `suite.sh`.
Their outputs are in `run_*/`, `checkall.out`, `test4.out` and `suite_*.out`. `mstack` on the scratch `PATH` is a shim that
execs this checkout's `./bin/mstack` (`mstack 0.2.1 at /Users/romerma/Code/mstack`). `HOME` and the global git config live in
the scratch directory. Every command is taken from the page by line number and run as typed, and every file comes from
its page block (`lines.py`). The current.md edit changes two lines in place (`edit_current.py`; the diff is `9c9` and `33c33` only).

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A1 | three pages followed literally; `tests/walkthrough.test.ts:214` | Getting-Started 27 commands, 76/76 shown lines, on 3 Pythons; README 11 commands, 17/17; The-Agents 7 commands, 12/12 |
| A2 | page blocks against the runs | Getting-Started `:281-292` report and `:353-357` gate --full; README `:207-216` report (its item has no verification); The-Agents `:96-101` |
| A3 | `tests/walkthrough.test.ts:214,219,225,231` | 4 pass, 0 fail on bun and node with each python3 first on PATH; the `.gitignore` mutant goes red |
| A4 | Getting-Started `:103-104`, `:152`, `:202`; test `:108`, `:125`, `:167` | setup's two lines, 8 files and 64 insertions, and the base line all reproduce; the close goes through |

## Acceptance, quoted

**"docs/wiki/Getting-Started.md, README.md and docs/wiki/The-Agents.md walkthroughs are followed literally in a fresh repository, command by command, and every step succeeds or shows the refusal the page says it shows"**: met. Runs below. Every step exits as the page implies, and every shown line appears.

**"each page shows the report with its table and the verification run where a close needs them, from one real run"**: met. Getting-Started `:274-293` and `:352-357`; The-Agents links the report (`:73-74`) and shows `gate --full` (`:96-101`). The README's item has no `--verification`, and its close went through without one (rd run, step 15, rc=0).

**"a test or a script in the repository reruns the Getting-Started sequence, so a new closing check that breaks it is seen before a reader does"**: met. `tests/walkthrough.test.ts`; see check 4.

**"the older drift a literal run shows is corrected: ..."**: met. All three runs print the setup lines `:98-107`, `8 files changed, 64 insertions(+)` and `base: (unset) -> "<sha>"`, and the base equals `git rev-parse main` (`084dc5b...` = `084dc5b...` on the brew run). The page's own close goes through.

## Check 1: Getting-Started from the page alone

| Run | python3 | Commands | Shown lines matched | Work commit | .pyc committed |
|---|---|---|---|---|---|
| sys | `/usr/bin/python3` 3.9.6, `pycache_prefix` under `$HOME/Library/Caches` | 27 | 76/76 | `5 files changed, 37 insertions(+), 6 deletions(-)` | 0 (none written in the tree) |
| brew | `review96r2/bin-brew/python3` -> Homebrew 3.15.2, `pycache_prefix` None | 27 | 76/76 | `5 files changed, 37 insertions(+), 6 deletions(-)` | 0 (2 on disk, `!! __pycache__/*.cpython-315.pyc`) |
| uv312 (extra) | uv-managed stock CPython 3.12.13 | 27 | 76/76 | same | 0 (2 on disk, ignored) |

The matcher compares the shown lines with the run's output. Commit shas (hex runs of 7 to 40 characters) and the time in `Ran 2 tests in Xs` are normalised before comparing.
A block without a leading `...` must start the output, and a block without a trailing `...` must end it.

The work commit's files (`git show --name-only`) are the same on both runs: `.mstack/progress/current.md`,
`.mstack/progress/impl_greet-flag.md`, `.mstack/state.json`, `greet.py`, `test_greet.py`. At the end, `git ls-files` lists 13 paths, none of them a `.pyc`.
`git log --all --name-only` finds no `.pyc` path in either repository.

**Exit codes**, the same in sys, brew and uv312: 0 for every step except four. The gate at `:210` exits 1. `state set ... done` at `:317` exits 2.
The forced close at `:342` exits 2. `ledger check` at `:403` exits 1. The gate I ran for the claim at `:222-223` ("The gate goes green")
exits 0 with `PASSED - 0 failures, 1 warning`.

**What the `...` lines hide.** In the `unittest -v` block (`:266`), the `...` covers exactly two lines:
```
sys : 'test_default (test_greet.TestGreet) ... ok', 'test_shout (test_greet.TestGreet) ... ok'
brew: 'test_default (test_greet.TestGreet.test_default) ... ok', 'test_shout (test_greet.TestGreet.test_shout) ... ok'
```
I compared every step's full normalised output between sys and brew (`crossdiff.py`). Of 31 steps, 3 differ:
```
step 01  git init -b main        the scratch path in "Initialized empty Git repository" (the page shows no output there)
step 14  python3 -m unittest ... the two per-test lines above
step 21  mstack gate --full      the same two per-test lines, in its "-- verification" section, under the page's leading `...` (:354)
```
Nothing else differs under any `...`.

## Check 2: the restored refusal block

- **Output.** `Getting-Started.md:342` prints exactly `:343-344` and exits 2 on both runs. The check is anchored at both ends: `shown=2 ok`, and no further lines.
- **Nothing changes.** `shasum` of every file under `.mstack/` and `git status --porcelain` were byte-identical before and after the forced close ("forced close left .mstack and the status unchanged", both runs).
  The item stays at `reviewing`: the next `gate --full` prints `[ok]    one active item: greet-flag (reviewing)`.
- **The sentence at `:337-339` is true.** The refusal is `independentVerdict` (`src/closing.ts:195-197`), which runs only while `rules.require_verdict_to_close` is on (`:182`).
  It is built with `overridable: false` (`:190`), so `--force` does not get past it.
  This is also why the shown refusal is the only one. The missing receipt at that point is `overridable: true` (`:60`), and `--force` passes it.
  The gate audits closed items under the same rule (`src/gate.ts:284`), and the author-only case is part of that audit (`:497`).
- **The order is one the agent files allow.** The refused attempt leaves no trace, so what follows is the reviewer's own sequence:
  `gate --full` (`agents/reviewer.md:19`), green at `reviewing`, then its own row (`:111-113`), then `verifying`, then `done`.
  The close goes through only after the reviewer's row, as `skills/router/SKILL.md:171` requires.
  The-Agents (`:83`) shows the same forced attempt.
- **The prose quotation is gone.** `rg "only implementer" docs/wiki/Getting-Started.md` finds only `:343`. At `fe64878` the same search found the prose at `:333`.

## Check 3: the warning sentence

Getting-Started (`:348-349`, "its one warning is the uncommitted `.mstack/` edits, expected mid-session"): true on both runs. The only `[warn]` line `gate --full` prints is:
```
[warn]  2 uncommitted change(s); expected mid-session, not at close
```
`git status --porcelain --ignored` just before it shows ` M .mstack/ledger.tsv` and ` M .mstack/state.json`. The brew run also shows
`!! __pycache__/greet.cpython-315.pyc` and `!! __pycache__/test_greet.cpython-315.pyc`, which are ignored and not counted.

The-Agents (`:91-93`, "its one warning is the uncommitted changes, expected mid-session"): true.
I built the page's premise from Getting-Started's own commands and blocks, then ran the two console blocks as typed. On both Pythons the run matched 7 commands and 12/12 lines.
The only `[warn]` line of its `gate --full` is:
```
[warn]  3 uncommitted change(s); expected mid-session, not at close
```
The three changes are `ledger.tsv`, `state.json` and the untracked `review_greet-flag.md`. The page names no count, so the sentence holds.

## Check 4: the test

- `rg -c PYTHONDONTWRITEBYTECODE tests/walkthrough.test.ts` finds 0. `ENV` (`:22`) is `{ ...process.env, HOME: "", GIT_CONFIG_GLOBAL: "/dev/null" }`.
- **The sequence matches the page:** `.gitignore` written before the init commit (`:99`); the forced close after `reviewing`, with exit 2 and the line (`:158-159`); the warning asserted in `gate --full` (`:167`).
  All the other steps are in the page's order. The test also runs `mstack gate` twice at `:107-108` where the page runs it once (read-only, harmless).
  It does not run the gate between the current.md edit and the work; the page shows no command there.
- `consts.mjs` evaluates the test's constants and compares them with the page blocks. `GREET_PY_0` `:57-65`, `TEST_PY_0` `:71-77`, `GITIGNORE` `:83`, `GREET_PY` `:231-241`, `TEST_PY` `:247-256` and `REPORT` `:281-292` are all equal.
- **Passes** in this checkout, with `TMPDIR` set to scratch:

| python3 first on PATH | bun | node |
|---|---|---|
| `/usr/bin/python3` | 4 pass, 0 fail | pass 4, fail 0 |
| Homebrew `python3` | 4 pass, 0 fail | pass 4, fail 0 |

- **Mutant:** the `.gitignore` line (`:99`) deleted in an rsync copy, run with the Homebrew `python3`. It is red at the stat assertion (`:144`) on both runtimes: bun 1 pass, 3 fail; node pass 1, fail 3.
  The one test that passes is the no-report mutant, which skips the stat assertion.
```
actual: "[feat/greet-flag ecdc2e2] feat: greet --shout uppercases the greeting\n 7 files changed, 37 insertions(+), 6 deletions(-)\n create mode 100644 .mstack/progress/impl_greet-flag.md\n create mode 100644 __pycache__/greet.cpython-315.pyc\n create mode 100644 __pycache__/test_greet.cpython-315.pyc\n",
expected: / 5 files changed, 37 insertions\(\+\), 6 deletions\(-\)/,
```
  The same mutant stays green with `/usr/bin/python3` first (4 pass on both runtimes), because that Python writes no bytecode in the tree.
  The guard is therefore live only with a python3 that writes `__pycache__` beside the files. CI runs on `ubuntu-latest` (`.github/workflows/*.yml:10`), whose python3 is expected to be one, but I did not run CI.

## Check 5: README and The-Agents

`git diff fe64878..63436fd -- README.md` is empty. In `docs/wiki/The-Agents.md` the only change is the `gate --full` parenthetical (`:91-94`), as the context says.

`README.md:174-177` says it runs "in a repository where `/mstack:setup` has run and `greet.py` and its test exist (the two files
[Getting-Started] shows, committed)". That is true of the README's own walkthrough. I ran it twice: once from those two files
alone (no `.gitignore`) and once with the `.gitignore` as well. Both runs matched 11 commands and 17/17 lines.
The only difference between them is the init commit, which the README does not show (`2 files changed, 16 insertions(+)` against `3 files changed, 17 insertions(+)`).
The README's item has no `--verification`, and nothing in its run invokes Python, so no bytecode is written and the `.gitignore` changes nothing it shows.
The phrase "the two files Getting-Started shows" now points at a section that shows three files. It still names the right two, so this is wording only.

## Check 6: CHANGELOG

`CHANGELOG.md:318-323` (the round 3 sentences), claim by claim:
- "the starting repository has a `.gitignore` with `__pycache__/`": `Getting-Started.md:46-48, 80-84`.
- "`git add -A` does not commit bytecode (it did with stock CPython and Homebrew's)": Homebrew 3.15.2 without the `.gitignore` commits the two `.pyc` files (the mutant output above).
  Stock CPython 3.12.13 (uv) writes `__pycache__/*.cpython-312.pyc` beside the files, which the `.gitignore` now ignores. Rung 4 for Homebrew; rung 3 for stock CPython, because I did not run it without the `.gitignore`.
- "the test no longer sets `PYTHONDONTWRITEBYTECODE`": true.
- "The per-test lines of `unittest -v`, which differ between Python 3.9 and 3.11 and later, are elided": elided at `:266`.
  3.9.6 prints the old form; 3.12.13 and 3.15.2 print the new one. 3.10 and 3.11 are not installed here, so the exact boundary at 3.11 is not run.
- "the refusal on the author's row alone is a console block again, as the forced close at `reviewing`": `:341-345`.
- "the one warning of `gate --full` is named": Getting-Started `:348-349` and The-Agents `:92-93`.

The rest of the entry is earlier rounds' text. I read it against head and found no false statement. The round 2 sentence's
"(`git init -b main`, `greet.py`, `test_greet.py`)" is completed by the round 3 sentence that follows it.

## Check 7: verification I ran

Every command ran in the checkout with `TMPDIR` set to scratch, through `suite.sh`. `git status --short` and HEAD were the same before and after.
```
./bin/mstack gate                      rc=0  PASSED - 0 failures, 0 warnings
./bin/mstack lint-plugin .             rc=0  PASSED - 0 failures, 0 warnings
node scripts/check-doc-links.mjs README.md docs/wiki/*.md   rc=0  109 relative links checked, 0 broken
npm run typecheck                      rc=0
npm run test:bun                       rc=0  883 pass / 0 fail / Ran 883 tests across 43 files. [199.17s]
npm run test:node                      rc=0  tests 883 / pass 883 / fail 0 / cancelled 0 / skipped 0
./bin/mstack ledger check walkthroughs-after-closing-checks   FAIL no verdict at 63436fdd; 5 row(s) exist at other SHAs (before my row)
```

## Rung

Rung 5, recorded as `live-verified`. Each page's claims were reproduced by running the page's own commands through the real CLI in fresh git repositories, with three real Python installs.
The test, its mutant and the suites add rung 4. The ran-on caveat is that the CLI was this checkout's `./bin/mstack` at `63436fd`, not a plugin-installed copy.

## Non-blocking

1. `docs/wiki/Getting-Started.md:10-11`: "Every command block is followed by the output it actually produced". The `bash` blocks of the starting repository (`:50-52`, `:86-89`) show no output, although `git init` and `git commit` print some.
   The convention predates item 96 (the Install `bash` blocks `:28-38`, the same sentence at `66028f9^`): `bash` is what to type, `console` is a transcript. "Every console block" would say so. This round did not change that sentence.

## Not checked

- `mstack gate --full` in this checkout. The brief limits me to read-only CLI commands, and `--full` writes `verification.tsv`. I ran the parts of the store's `verify` separately: `npm test` on both runtimes, `npm run typecheck`, and `bin/mstack lint-plugin .`.
- `claude plugin validate . --strict`, CI, and a plugin-installed `mstack`. My runs use this checkout's `./bin/mstack` at `63436fd`, as CONTRIBUTING prescribes for transcripts.
- Python 3.10 and 3.11.
- The content of The-Agents' reviewer report: the page does not show it, so I wrote a stub. Earlier rounds' findings filed on item 97 are not re-raised.
