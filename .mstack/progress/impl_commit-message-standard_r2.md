# Implementer report, round 2: commit-message-standard

## What changed
Generalized `skills/commit/SKILL.md` to Conventional Commits 1.0.0 only: removed the "this
repository's rules" framing, the lower-case/no-full-stop/72-char rules, the AI-attribution and
Co-Authored-By ban, and the sentence on merge commits being "left alone here". Added a sentence
that a repository's own CLAUDE.md or CONTRIBUTING.md extends or overrides the skill. House rules
(Conventional Commits, imperative, lower case, 72 chars, one change per commit, no AI attribution,
no Co-Authored-By) now live in `CONTRIBUTING.md` and a new `## Commits` section in `CLAUDE.md`.
README counts now true: five router-called steps (understand, design, verify, review, ship; the
playbooks call all five), six typed-by-you (implement, spec, orchestrate, reflect, unslop,
commit), four requests skip the playbooks (commit added). Wiki route table gained the commit
row. `The-CLI.md` lint transcript now matches real output (33 files, 18 skills and agents, 38
files). CHANGELOG no longer claims enforcement and no longer says the skill separates house
rules. No wiki page repeats the five/six/three claims (rg). Version heading untouched.

## Files
README.md, CHANGELOG.md, CLAUDE.md, CONTRIBUTING.md, skills/commit/SKILL.md,
docs/wiki/Skills-and-Playbooks.md, docs/wiki/The-CLI.md, this report. No src/ or tests/.

## Commands
```
$ npm test (bun half)
 292 pass
 0 fail
Ran 292 tests across 18 files.
(node half, v24.14.0)
ℹ tests 286
ℹ pass 286
ℹ fail 0
$ npm run typecheck   -> bunx --bun tsc --noEmit, exit 0, no output
$ ./bin/mstack lint-plugin . | tail
[ok]    33 file(s), no command that would hang on stdin
[ok]    18 skills and agents, every cross-reference in 38 file(s) resolves
[ok]    the lifecycle enum appears only in src/lifecycle.ts
PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md   (node via nvm v24.14.0)
93 relative links checked, 0 broken
$ ./bin/mstack gate | tail -3
[warn]  11 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 2 warnings
```
## R to test
| R | Test | Where |
|---|---|---|
| A1 | lint-plugin passes with the skill | `skills/commit/SKILL.md:2` |
| A2 | router route row, lint cross-reference | `skills/router/SKILL.md:38` |
| A3 | counts read against `fd SKILL.md skills` and rg | `README.md:27` |
| A4 | CHANGELOG under `## Unreleased` (acceptance amended) | `CHANGELOG.md:3` |
| A5 | npm test both runtimes, gate | n/a: command output above |
| A6 | skill states the spec only; house rules moved | `CONTRIBUTING.md:69` |
| A7 | README, wiki tables, lint transcript, changelog wording reconciled | `docs/wiki/Skills-and-Playbooks.md:106` |

Rung: 2 for prose claims (read and searched), 4 for the commands pasted.
