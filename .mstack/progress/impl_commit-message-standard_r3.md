# Implement round 3: commit-message-standard

## What changed
Imperative mood is now optional practice in `skills/commit/SKILL.md`. The "Before you commit" step that said to read the subject after "this commit will" is deleted, and the remaining steps are renumbered 1-3. The advice in "Write the description" is a recommendation: "a common habit, not a rule ... Follow it where the repository does." `CHANGELOG.md:8-9` ("states the specification only") is now true, so it is unchanged. In `docs/wiki/Skills-and-Playbooks.md`, the `/mstack:commit` row (line 36) says "the description" in place of "an imperative description". The note at lines 87-88 now says the skill states Conventional Commits only and defers to a repository's own CLAUDE.md or CONTRIBUTING.md for house rules. The lint numbers in The-CLI.md are excerpted and unaffected: the commit skill went from 94 to 93 lines, and that line is not pasted there.

## Files
- skills/commit/SKILL.md
- docs/wiki/Skills-and-Playbooks.md
- .mstack/progress/impl_commit-message-standard_r3.md

## Commands
`node` and `npm` are not installed on this machine, so I ran the package.json scripts with bun. The Node half of `npm test` did not run (rung 3 for that half).
```
$ bun test tests/        (the bun half of npm test)
 292 pass
 0 fail
Ran 292 tests across 18 files.
$ bun run typecheck
$ bunx --bun tsc --noEmit        (no errors)
$ ./bin/mstack lint-plugin .
[ok]    skills/commit/SKILL.md (93 lines, 266 description chars)
[ok]    18 skills and agents, every cross-reference in 38 file(s) resolves
[ok]    the lifecycle enum appears only in src/lifecycle.ts
PASSED - 0 failures, 0 warnings
$ bun scripts/check-doc-links.mjs README.md docs/wiki/*.md
93 relative links checked, 0 broken
$ ./bin/mstack gate
[warn]  on main; feature work belongs on its own branch
[warn]  6 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 2 warnings
```
A bare `bun test` also picks up `sandbox/test/format.test.ts`. Its R15 timezone test fails, and it is outside `npm test`'s scope (`tests/`). I did not touch it.

## R to test
| R | Test | Where |
|---|---|---|
| A1 | lint-plugin (skill exists, name commit) | n/a: unchanged since round 2; lint ok above |
| A2 | lint cross-reference check | n/a: unchanged since round 2 |
| A3 | count/read | n/a: unchanged since round 2 |
| A4 | read | n/a: unchanged since round 2 (CHANGELOG.md:8-9 still true) |
| A5 | bun tests, typecheck, gate | Commands above; Node half not run |
| A6 | read: skill holds no house rules | skills/commit/SKILL.md:48-49 (recommendation), :81-85 (steps), docs/wiki/Skills-and-Playbooks.md:36, :87-88. Rung 2, read |
| A7 | lint-plugin, doc-link checker | Commands above |
