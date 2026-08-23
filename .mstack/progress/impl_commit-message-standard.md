# Item 34, commit-message-standard, implementer report

Head: `a83b23dd56f3fb13b40d48660d3ec513b17d2e4c`

## What was asked

Two things, in one session. Hold this repository's existing commits to
Conventional Commits 1.0.0, and add a skill so future commits stay there.

## What the premise turned out to be

The starting claim was that commit names did not make sense. Measured before
touching anything: 198 of 201 commits already carried a valid type prefix, and
`CONTRIBUTING.md` already required the convention. The three exceptions were
merge commits, which the specification does not cover.

The real defect was the description half. 143 subjects were noun phrases or
declarative sentences rather than imperative summaries of a change:
`chore: the reviewer's round-4 report and its row at the final head` names an
artefact, not an edit. That is what was rewritten.

## The rewrite

`git filter-repo --commit-callback`, keyed on `commit.original_id` because 11
subjects were textually identical across different items and a text-keyed map
would have collapsed them. 143 new subjects, all validated before the run
against the type grammar and a 72-character ceiling.

Proof that nothing but messages moved: the full `%T %an %ae %aI %cI` sequence
over all 201 commits is byte-identical to the pre-rewrite mirror.

303 commit SHAs cited in `ledger.tsv`, `decisions.tsv`, the progress reports and
`state.json` were translated through `.git/filter-repo/commit-map`, preserving
each citation's abbreviation length and refusing any prefix that matched more
than one old commit. Zero were ambiguous, and zero token that resolved to a
commit in the mirror fails to resolve now.

The three `Merge pull request` subjects were deliberately left alone.

## The skill

`skills/commit/SKILL.md`, routed from the router's route table. Its content was
checked against the specification text rather than recalled, which corrected the
rule count from 17 to 16 and confirmed that imperative mood, lower case, subject
length and merge-commit handling are absent from the standard. The skill says
so explicitly, so it cannot be cited for a house rule.

## Verification

- `./bin/mstack lint-plugin .` PASSED, 0 failures, 0 warnings.
- `npm test` 286 tests, 286 pass, 0 fail, on bun and node.
- `./bin/mstack gate` PASSED, 0 failures, 1 warning (on main).
- 20 closed items still carry a ledger verdict after the SHA translation.

## Not done, and deliberately

- No release. `plugin.json` still reads 0.2.1 and no tag was cut, so the
  changelog entry sits under `Unreleased`. Recorded as a decision.
- Not force-pushed. `origin/main` still holds the old history.
- The work was done on main rather than its own branch, which the gate warns
  about, because the rewrite targets main itself.
- A skill is prose. This project's own principle is that anything enforceable
  belongs in `hooks/` or `mstack gate`, so a pre-tool-use guard that refuses a
  malformed `git commit -m` is the follow-up, filed as its own item.
