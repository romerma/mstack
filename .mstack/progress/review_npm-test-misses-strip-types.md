# Review - npm-test-misses-strip-types

**Verdict:** APPROVED

Round 1, reviewing alone, at `cd836732f707e41d522a492984beaa48f206fde9` (last non-chore commit
`7f8a95d`). Scope: `git diff a9f1d1d...HEAD -- package.json README.md CONTRIBUTING.md .github tests`.
Every run below is mine; the implementation report was read as a claim only. Scratch clones live under
the session scratchpad (`review46/cloneA`, `cloneB`, `cloneCI`); the user's `sandbox/` was only read.
All suites ran one at a time.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| 1. node half carries both flags | `tests/scripts.test.ts:14-17` | fails on `a9f1d1d:package.json` (`not ok 1`), passes on HEAD |
| 3. bun half is a path, `./tests` | `tests/scripts.test.ts:19-21` | fails on the old file (`not ok 2`), passes on HEAD |
| one definition of each half | `tests/scripts.test.ts:23-25` | fails on the old file (`not ok 3`), passes on HEAD |
| 2. README names the command | none (prose) | ran the README command literally, below |

Against the old `package.json` (cloneB, node 22.6.0): node `# pass 0  # fail 3`, exit 1; bun
`0 pass  3 fail`, exit 1. Against HEAD: `# pass 3  # fail 0`.

The pins are mixed. `:15-16` pin the contract: each flag is matched on its own, so reordering
is fine. `:20` is close to an exact string (`/bun test \.\/tests(\s|$)/` rejects the
equally valid `bun test ./tests/` or `bun test --timeout N ./tests`). `:24` pins the exact
string. All of them check the text of the script, not what it does. Whether `./tests` is a
path or a filter depends on bun, and nothing in the suite checks that (see note 4).

## Acceptance, quoted

**"npm test passes with node 22.6.0 first on PATH, shown with real output"** - met. `npm test` from
the repository root, `PATH=~/.nvm/versions/node/v22.6.0/bin:$PATH` (node v22.6.0, npm 10.8.2, bun 1.3.11):

    cmd: npm test | EXIT=0
    bun half:   480 pass / 0 fail / Ran 480 tests across 23 files. [71.19s]
    node half:  # tests 480  # pass 480  # fail 0  (TAP, which is node 22's non-TTY reporter, so node 22 ran it)
    stderr: 14 lines, all bun's summary and fixture output; 0 lines matching "(node:" or "ExperimentalWarning"

On its own on 22.6.0: `npm run test:node` exit 0, `# tests 480 # pass 480 # fail 0`, stderr empty;
`npm run test:bun` exit 0, `480 pass 0 fail, 23 files`. I also reverted only `package.json` to
`a9f1d1d` in cloneCI. On 22.6.0, `npm run test:node` then exits 1 with `# tests 23 # pass 0 # fail 23`
and 69 `ERR_UNKNOWN_FILE_EXTENSION` lines, which is the defect, now gone. Mechanism at
`package.json:10`.

**"the README's 22.6 floor claim names the command that proves it"** - met, `README.md:408-410` names
`PATH=~/.nvm/versions/node/v22.6.0/bin:$PATH npm run test:node`. I ran it exactly as written in zsh from
the repository root: exit 0, `# tests 480 # pass 480 # fail 0`, stderr 0 lines. The `~` in the PATH
prefix expands and finds node v22.6.0 under zsh, bash, sh and dash (probe script: `node=v22.6.0` in all four).
"which carries both flags" is true (`package.json:10`). "CI keeps a job pinned there" is true
(`.github/workflows/ci.yml:45-56`, `node-version: "22.6"`). The unchanged next sentence still holds:
on 22.6.0, `--experimental-strip-types` alone prints
`(node:5029) ExperimentalWarning: Type Stripping is an experimental feature...` on stderr. With both
flags it prints nothing.

**"the bun half of npm test scopes to ./tests/ so a local gitignored sandbox/ cannot add or fail tests (today 'bun test tests/' also runs sandbox/clima-portable/tests)"** -
met, shown with a list of paths and not by arithmetic. In cloneA I put two failing tests
outside `tests/`: `sandbox/fake-portable/tests/marker.test.ts` (gitignored, like the real one) and
`other/tests/marker.test.ts`. Each one prints a marker and throws. Bun's junit reporter gave me
the list of files each command ran:

    npm run test:bun -- --reporter=junit ...   EXIT=0   480 pass, 0 fail, Ran 480 tests across 23 files
      junit file list == `fd -g '*.test.ts' tests` (diff empty, 23 == 23, tests/scripts.test.ts included)
      no MARKER output, no sandbox/ or other/ path in the junit file
    bun test tests/  (the old script)           EXIT=1   480 pass, 2 fail, Ran 482 tests across 25 files
      OTHER_MARKER ran from .../cloneA/other/tests/marker.test.ts
      SANDBOX_MARKER ran from .../cloneA/sandbox/fake-portable/tests/marker.test.ts
      files only in the old run: other/tests/marker.test.ts, sandbox/fake-portable/tests/marker.test.ts

I also ran the real repository with its real `sandbox/` present, where `sandbox/clima-portable/tests`
holds `format.test.js` and `wmo.test.js`: `bun test ./tests` reports 480 tests across 23 files on every run.

## Verification I ran

    ./bin/mstack gate                       PASSED - 0 failures, 0 warnings
    ./bin/mstack gate --full (node 26.13.1) [ok] npm test && npm run typecheck && bin/mstack lint-plugin .
                                            PASSED - 0 failures, 0 warnings, EXIT=0
                                            (inside: bun 480 pass/23 files; node "ℹ tests 480 ℹ pass 480 ℹ fail 0")
    npm test, node first on PATH, one at a time:
      v22.6.0   EXIT=0  bun 480/0 fail/23 files  node # tests 480 pass 480 fail 0   stderr: 0 node warnings
      v24.14.0  EXIT=0  bun 480/0 fail/23 files  node ℹ tests 480 pass 480 fail 0   stderr: 0 node warnings
      v26.13.1  EXIT=0  bun 480/0 fail/23 files  node ℹ tests 480 pass 480 fail 0   stderr: 0 node warnings
    npm run typecheck                       EXIT=0
    ./bin/mstack lint-plugin .              PASSED - 0 failures, 0 warnings, EXIT=0
    node scripts/check-doc-links.mjs README.md docs/wiki/*.md   96 relative links checked, 0 broken

Both flags are accepted on all three versions, stderr is clean on all three, and the count is 480
for the node half on each and for bun.

Invocation (B), from cloneB with the suite cut down to `tests/scripts.test.ts`, plus one full run:

    bun run test, real repo, 22.6.0 first   EXIT=0  "$ bun run test:bun && bun run test:node" (bun rewrites
                                            npm run to bun run), bun 480/23 files, node # tests 480 pass 480
    bun run test, npm NOT on PATH           EXIT=0  (PATH = symlinked node 22.6.0 + bun + /usr/bin:/bin)
    npm test, npm NOT on PATH               EXIT=127 "sh: npm: command not found" (expected)
    npm test / bun run test from tests/     EXIT=0  both runners use the package root as the working
                                            directory (probe printed the clone root for both)
    npm test, bun NOT on PATH               EXIT=127 after "> bun test ./tests" / "sh: bun: command not found":
                                            the message names both the script and the missing tool; the old
                                            script fails the same way (127)
    npm test, a test failing only under bun  EXIT=1, node half skipped by && (same as before)
    npm test, a test failing only under node EXIT=1 (bun "4 pass 0 fail", node "# fail 1"); bun run test EXIT=1

Glob quoting (C): dash, which is `sh` on ubuntu-latest, hands node the literal argument
`[tests/*.test.ts]`, and node expands it. `npm run test:node` with `npm_config_script_shell=/bin/dash` on
22.6.0 and no bun on PATH: EXIT=0, `# tests 480 # pass 480 # fail 0`, stderr empty.

CI (D): parsed with PyYAML (`safe_load`), and compared with `a9f1d1d`'s workflow:

    same triggers: True        same job names: ['test', 'oldest-node']
    test        steps 10 -> 10, runs-on same   CHANGED "bun test tests/" -> "npm run test:bun"
                                               CHANGED "node --test 'tests/*.test.ts'" -> "npm run test:node"
    oldest-node steps 4 -> 4,   runs-on same   CHANGED "node --disable-warning=... --test 'tests/*.test.ts'"
                                               -> "npm run test:node"

In `test`, `oven-sh/setup-bun` (`ci.yml:14`) and `setup-node` "24", which brings npm (`ci.yml:17`),
both run before `ci.yml:27-28`. In `oldest-node`, `setup-node` "22.6" brings npm 10.8.2 and the script
needs no bun. I copied that job in a fresh clone with
`env -i PATH=<node 22.6.0 bin>:/usr/bin:/bin` (bun: none): `./bin/mstack help` EXIT=0, then
`npm run test:node` EXIT=0, `# tests 480 # pass 480 # fail 0`, stderr 0 lines. The only change to
what the jobs run: the `test` job's node half on 24 now gets both flags too. Stripping is already
on by default in 24, so they change nothing there, and 24.14.0 above is clean.

Scope (G): `git diff a9f1d1d...HEAD --stat -- src bin hooks skills agents` is empty. The only file
touched under `tests/` is `A tests/scripts.test.ts`, so no existing assertion changed. Only `scripts`
changed in `package.json`: dependencies and devDependencies are byte-identical. `fd -H -d 1 "bun.lock|package-lock" .`
finds nothing, no lockfile is tracked, and `git status --short` was clean before this report.

Evidence ladder: acceptance 1-3 reached rung 4. I ran the real commands on this checkout, plus
copies of it in scratch clones, with node 22.6.0, 24.14.0 and 26.13.1 and bun 1.3.11 on
macOS. The CI part stops at rung 3 plus a local copy of each job (dash, no bun on PATH). I
cannot run GitHub Actions.

## Not proven until CI runs on a push

- That both jobs go green on ubuntu-latest. `test` uses `bun-version: latest` (whatever bun is
  current, not 1.3.11) and the newest 24.x; `oldest-node` uses whatever "22.6" resolves to.
- That `bun test ./tests` is still read as a path, not a filter, on the bun that CI installs.

## Non-blocking notes

1. `README.md:424` still says `bun run test  # bun test AND node --test`. That is still true, but it
   now reads differently from `CONTRIBUTING.md:19` (`bun test ./tests AND node --test (with the 22.6 flags)`).
2. `README.md:409`: the command uses the nvm install path. It is true here, but a reader on fnm,
   volta or a system node cannot paste it as is. "`npm run test:node` with node 22.6.0 first on PATH,
   for example ..." would survive other node managers.
3. `.github/workflows/ci.yml:53`: "480/480" is a hard-coded count in a comment. It will go stale on
   the next test added, just as "112/112" did, and nothing checks it. Dropping the number
   ("the full node suite") would fix that for good.
4. `tests/scripts.test.ts:20,24` check the string, not the behaviour. A bun release that changed how
   `./tests` is read would pass these pins and CI, and the sandbox tests would be back.
5. This change did not cause this one: bun walks `tests/` recursively and also picks up
   `*.spec.*` and `*_test.*`, while node's `tests/*.test.ts` only looks at the top level. Today both
   find the same 23 files, but a test file in a subfolder of `tests/` would run only under bun.

## Suggested follow-ups

- Replace the count in `ci.yml:53`, and reconcile `README.md:424` with `CONTRIBUTING.md:19`, in
  the next docs-touching item.
