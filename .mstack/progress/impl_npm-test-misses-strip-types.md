# Item 46 npm-test-misses-strip-types: implementation report

## What changed

`test:node` now carries `--disable-warning=ExperimentalWarning --experimental-strip-types`, the same two
flags `bin/mstack` uses, so it loads `.ts` on node 22.6.0. `test:bun` is `bun test ./tests`: with the
`./` the argument is a path, not a filter, so the gitignored `sandbox/` (6 tests in 2 files) no longer
runs. `test` is now `npm run test:bun && npm run test:node`, one definition of each half. CI calls those
scripts (`npm run test:bun`, `npm run test:node` in the test job; `npm run test:node` in the 22.6 job),
so the documented command and CI cannot drift again; the jobs and what they run are unchanged, and the
oldest-node job needs no bun because npm ships with node. The stale "112/112" comment is now 480/480.
The README floor sentence names the command that proves it. `tests/scripts.test.ts` pins the scripts
(3 tiny tests) and fails 3 of 3 on the old `package.json`.

## Files

- package.json (scripts only)
- tests/scripts.test.ts (new)
- README.md (22.6 floor sentence), CONTRIBUTING.md (test command comment)
- .github/workflows/ci.yml (calls scripts, comment)
- .mstack/progress/impl_npm-test-misses-strip-types.md, .mstack/progress/current.md

Commits: 9214b9a fix, 94bf4b2 docs, 7f8a95d ci.

## Commands

Before, `bun test tests/` (suite plus my 3 new tests present):

    486 pass / 0 fail / Ran 486 tests across 25 files      (483 / 24 files before tests/scripts.test.ts)

After, `npm run test:bun` (`bun test ./tests`):

    480 pass / 0 fail / Ran 480 tests across 23 files
    bun test ./sandbox/clima-portable/tests -> 6 pass, Ran 6 tests across 2 files   (the 486-480 gap)

Bun does not print the names of passing files, so "no sandbox path ran" is shown by the arithmetic:
25 files and 486 tests down to 23 files and 480, and the 6 tests and 2 files removed are exactly
sandbox/clima-portable/tests.

`npm test`, each Node first on PATH, run one suite at a time, exit 0 each:

    v22.6.0   bun half: 480 pass, 0 fail, 23 files | node half: tests 480, pass 480, fail 0 (21.0 s) | stderr ExperimentalWarning lines: 0
    v24.14.0  bun half: 480 pass, 0 fail, 23 files | node half: tests 480, pass 480, fail 0         | stderr Warning lines: 0
    v26.13.1  bun half: 480 pass, 0 fail, 23 files | node half: tests 480, pass 480, fail 0         | stderr Warning lines: 0

(The bun half is the same bun 1.3.11 under each, since bun does not depend on the node on PATH.)

On 22.6.0 alone: `npm run test:node` -> `# tests 480 # pass 480 # fail 0`. `npm run test:bun` ran as
the first half of `npm test` above (480 pass).

Pin test on the old package.json (`git show HEAD:package.json`): 3 of 3 fail. On the new one: 3 pass.

    npm run typecheck                -> clean
    ./bin/mstack lint-plugin .       -> PASSED - 0 failures, 0 warnings
    check-doc-links.mjs              -> 96 relative links checked, 0 broken
    ./bin/mstack gate --full         -> exit 0; [ok] npm test && npm run typecheck && bin/mstack lint-plugin .
    git status --short               -> clean apart from this report (no lockfile)

Not run: the GitHub Actions workflow itself (no push); the YAML change is a script substitution only.

## R to test

| Acceptance | Evidence |
|---|---|
| 1. npm test passes with node 22.6.0 first on PATH | `npm test` on v22.6.0: exit 0, 480/480 bun and 480/480 node, no ExperimentalWarning on stderr. Rung: live run of the real command (rung 4 for this machine). |
| 2. README's 22.6 floor claim names the command | README.md:408-410 names `PATH=~/.nvm/versions/node/v22.6.0/bin:$PATH npm run test:node`; `tests/scripts.test.ts:14` pins that the script carries both flags. |
| 3. bun half scopes to ./tests | `package.json` `test:bun`; `tests/scripts.test.ts:19` pins `bun test ./tests`; 486/25 files to 480/23 files, with sandbox alone being 6/2. |
