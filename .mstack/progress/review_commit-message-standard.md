# Review - commit-message-standard

**Verdict:** CHANGES_REQUESTED

Reviewed at head `6687df2370ef5f4bbb90877a02ccaaef3aa2521d`. The change under review is
`a83b23d` plus store bookkeeping (`97886ce`, `6687df2`), diffed as
`git diff 50ca450..HEAD -- . ':!.mstack'`. I judged the history rewrite only where an
acceptance bullet depends on it, and none does.

## Requirement to test

The item is prose and docs. It adds no tests, and nothing under `tests/`, `src/` or `hooks/`
changed (`git diff --stat 50ca450..HEAD -- tests src hooks` is empty), so no test was
weakened. The only mechanical coverage is `lint-plugin`.

| R | Test | Evidence |
|---|---|---|
| 1 skill exists, `name: commit`, lints | `./bin/mstack lint-plugin .` (front matter, description cap, cross-references) | `[ok] skills/commit/SKILL.md (93 lines, 266 description chars)`. The name is checked only as non-empty with no colon (`src/lint.ts:216-219`), so `name: commit` rests on reading `skills/commit/SKILL.md:2`. Rung 2 for the name, rung 4 for the lint. |
| 2 router routes commit work | lint cross-reference check (`src/lint.ts:266-313`) | It fails if `/mstack:commit` in the router names no skill. It does not prove the row exists or that a request routes there. Row read at `skills/router/SKILL.md:38`, rung 2. Live routing was not exercised. |
| 3 count claims and table rows | none | Checked by search (below), rung 2 |
| 4 CHANGELOG version heading | none | Read, rung 2. **Not met** |
| 5 runtimes and gate | `npm test`, `./bin/mstack gate`, `gate --full` | Ran all three, rung 4 |

## Acceptance, quoted

**"skills/commit/SKILL.md exists, declares name commit, and passes mstack lint-plugin"** -
met. The file exists, `skills/commit/SKILL.md:2` reads `name: commit`, and
`./bin/mstack lint-plugin .` returns `PASSED - 0 failures, 0 warnings` with the skill listed.
`argument-hint: [what you are committing]` (`:4`) uses the same flow-sequence form as the
other twelve skills.

**"the router's route table sends commit-message work to the skill"** - met as written.
`skills/router/SKILL.md:38` reads `| Writing the commit message, or a PR title | /mstack:commit |`,
and the lint cross-reference check resolves it. But the wiki's copy of the same table was not
updated (Changes required 3).

**"every twelve-skills claim in README and the wiki reads thirteen, and the new row is in both tables"** -
met to the letter, but the adjacent counts are now wrong. `fd SKILL.md skills` lists 13. Every
twelve-skills claim now reads thirteen: `README.md:130`, `README.md:460`, `docs/wiki/Home.md:63`,
`docs/wiki/Skills-and-Playbooks.md:7` and `:20`. `README.md:26` "Twelve other" is correct
(13 minus the router). Every other "twelve" or "eleven" in README, docs and skills counts units,
worktrees, src files or rules, not skills. The new row is in both skills tables
(`README.md:149`, `docs/wiki/Skills-and-Playbooks.md:36`), and the wiki also gained rows at
`:57` and `:87-88`. The brief asked me to check every count of skills or commands, and two
fail: `README.md:27` and `README.md:132` contradict each other (Changes required 2), and
`docs/wiki/The-CLI.md:471` no longer reproduces (Changes required 4).

**"CHANGELOG records the skill under a new version heading"** - **not met.** `CHANGELOG.md:3`
is `## Unreleased`, which is not a version heading. The implementer says so in
`.mstack/decisions.tsv:85`: "Item 34's acceptance said 'a new version heading'; recorded here
as a deliberate deviation rather than met". That row's `resolves` column is empty, so no human
has accepted the deviation. Not cutting a release unilaterally was the right instinct. It
still leaves this bullet unmet.

**"both runtimes stay green and mstack gate passes"** - met. Bun: 292 pass, 0 fail. Node
v24.14.0: 286 pass, 0 fail. `npm test` exit 0, `gate` PASSED with 0 failures, and `gate --full`
exit 0 (output below). The bun/node count difference does not come from this item, which
touches no tests.

## Verification I ran

`node` is not on this shell's PATH, so I prefixed `~/.nvm/versions/node/v24.14.0/bin`. Bun is
1.3.11.

```
$ ./bin/mstack version
mstack 0.2.1 at /Users/romerma/Code/mstack

$ npm test                      # exit 0
 292 pass
 0 fail
Ran 292 tests across 18 files. [32.76s]
...
ℹ tests 286
ℹ pass 286
ℹ fail 0

$ npm run typecheck             # bunx --bun tsc --noEmit, exit 0, no output

$ ./bin/mstack lint-plugin .    # exit 0
[ok]    skills/commit/SKILL.md (93 lines, 266 description chars)
[ok]    33 file(s), no command that would hang on stdin
[ok]    18 skills and agents, every cross-reference in 38 file(s) resolves
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
93 relative links checked, 0 broken

$ ./bin/mstack gate             # exit 0
[ok]    one active item: commit-message-standard (reviewing)
[ok]    20 closed item(s) carry a ledger verdict
[warn]  on main; feature work belongs on its own branch
PASSED - 0 failures, 1 warning

$ ./bin/mstack gate --full      # exit 0
[warn]  on main; feature work belongs on its own branch
[warn]  2 uncommitted change(s); expected mid-session, not at close
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 2 warnings

$ ./bin/mstack ledger check commit-message-standard     # before my row, exit 1
FAIL no verdict at 6687df23; 1 row(s) exist at other SHAs and a new head SHA voids them

# the parent revision, exported with git archive into the scratchpad
$ ./bin/mstack lint-plugin .    # at 50ca450
[ok]    32 file(s), no command that would hang on stdin
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves
```

The only ledger row for this item is the implementer's, at `a83b23d` (`ledger.tsv:64`). That
SHA is no longer HEAD.

**Environment note, not this item's fault.** Between my first `gate` (35 items, clean tree)
and `gate --full` (45 items), another session wrote uncommitted changes to
`.mstack/state.json` and `.mstack/decisions.tsv`: items 36-38 added, 26 and 27 cancelled, and
a triage row stamped `2026-10-31T14:45:11Z`. Those changes are the source of the "2
uncommitted change(s)" warning. I did not touch them.

## Changes required

1. `CHANGELOG.md:3`: acceptance bullet 4 is unmet. `## Unreleased` is not a version heading,
   and the deviation (`.mstack/decisions.tsv:85`) has an empty `resolves`. This is a release
   fork with outward-facing consequences, so a human answers it. One option: accept the
   Unreleased heading by amending the bullet through `./bin/mstack decide --resolves`. The
   other: put the entry under a real version heading, keeping `.claude-plugin/plugin.json` in
   step if that is the project's practice. Either one closes the bullet. Leaving it as is
   does not.

2. `README.md:27-28` against `README.md:132`: the counts now contradict each other. Line 27
   says "Six are steps the router calls for you as a playbook needs them" and adds `commit`.
   Line 132, unchanged, still says "The router calls five of the others for you". Line 27 is
   also false as written: no playbook invokes `/mstack:commit`. Searching `/mstack:` across
   `skills/router/playbooks/` finds only understand, design, verify, review and ship
   (`feature.md:3,5,18,21`, `refactor.md:8,10,16`, `bug-fix.md:9,13,20`, `investigate.md:5`).
   The commit steps in `feature.md:20`, `bug-fix.md:18` and `refactor.md:13` do not name the
   skill. Fix one of two ways. Either restore "Five", put `commit` in the "last six" list on
   lines 29-30, and leave line 132 alone. Or add a `/mstack:commit` step to those playbooks and
   make line 132 read six.

3. `docs/wiki/Skills-and-Playbooks.md:96-107`: the wiki's copy of the router's route table is
   missing the row that `skills/router/SKILL.md:38` gained. `README.md:153` and `README.md:460`
   both send readers to this page as "the route table". Add
   `| Writing the commit message, or a PR title | /mstack:commit |` between the ship row
   (`:104`) and the orchestrate row (`:105`).

4. `docs/wiki/The-CLI.md:468` and `:471`: this change broke the pasted `lint-plugin`
   transcript. It reads `32 file(s)` and `17 skills and agents, every cross-reference in 37
   file(s)`. I reproduced exactly those numbers at `50ca450`, and HEAD now prints 33, 18 and
   38. `CONTRIBUTING.md:57-60` treats a transcript that no longer reproduces as a bug.
   Re-run `./bin/mstack lint-plugin .` and paste the new output.

5. `skills/commit/SKILL.md:45-46`, `:84`, `:90-91`: house rules ship to every installer under
   the wrong label. This needs a human decision. The skill ships to every repository that
   installs mstack (`/mstack:setup` is "once per repository", `README.md:26-27`), and its
   description (`:3`) says to use it "before every git commit". Three lines assume they run in
   this repository:
   - `:45-46` calls imperative mood, lower case, 72 characters and one change per commit "this
     repository's rules". In an installer's checkout, "this repository" means their repo,
     which adopted none of them.
   - `:84` forbids AI attribution and `Co-Authored-By` trailers in every installer's commits.
     That overrides Claude Code's default and the user's own choice. `decisions.tsv` has no
     row on it.
   - `:90-91` cites this repository's own `Merge pull request #2` history.

   Which rules a shipped skill imposes on other people's repositories is a product fork with
   user-visible outcomes, so it goes through `./bin/mstack decide --resolves`. One option:
   keep the house rules in `CONTRIBUTING.md` and have the skill defer to the target repo's own
   convention (commitlint config, CONTRIBUTING), with the specification as the fallback. The
   other: label them plugin defaults that a repo's convention overrides, and drop the
   attribution rule or make it conditional.

6. `CHANGELOG.md:10`: "are enforced here" overclaims. Nothing enforces these rules.
   `hooks/hooks.json` has no commit guard, `rg -i 'git commit|conventional|imperative' hooks/ src/`
   finds nothing, and item 35 `commit-guard-in-hooks` (pending) exists to add that
   enforcement. Say "are required here" or "are this repository's rules".

Not blocking, and unverified (rung 1, from memory; I had no tool to fetch the spec):
`CHANGELOG.md:10-11` says the specification "is silent on all four", and `CONTRIBUTING.md:72-73`
says one change per commit is added "on top of the standard". As I recall, the
conventionalcommits.org 1.0.0 FAQ answers "conforms to more than one of the commit types" with
"Go back and make multiple commits whenever possible". If so, the claim is true of the 16
normative rules and false of the page. The skill's own list at `SKILL.md:88-89` correctly
leaves one change per commit out. Check against the fetched text before keeping "silent on
all four".

The skill's statements about the specification (the shape, `feat`/`fix` as the only fixed
types, `!` and the footer, the case rules for `BREAKING CHANGE` and `BREAKING-CHANGE`, footer
separators, blank-line placement) agree with the 1.0.0 rules as I know them. That check is also
rung 1 on my side, from memory. The implementer reports checking them against fetched text.
