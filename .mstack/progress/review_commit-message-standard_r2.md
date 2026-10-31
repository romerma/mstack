# Review - commit-message-standard (round 2)

**Verdict:** CHANGES_REQUESTED

Reviewed at head `7f0e498545f70734e3d01f0e611c0438a1284106`. Scope is the round-2 delta,
`git diff 6687df2..HEAD -- . ':!.mstack'` (commit `bc66346`; `7f0e498` touches only `.mstack/`),
plus the six round-1 findings. Seven files changed, 35 insertions and 26 deletions. Nothing under
`tests/`, `src/` or `hooks/` changed (`git diff --stat 6687df2..HEAD -- tests src hooks` is empty),
so no test was weakened.

Spec claims below were checked against the specification source, fetched from
`conventional-commits/conventionalcommits.org` `content/v1.0.0/index.md` into my scratchpad
(rung 2, the dependency's own text).

## Round-1 findings

| # | Round-1 finding | Status |
|---|---|---|
| 1 | `CHANGELOG.md:3` `## Unreleased` is not a version heading | **Settled.** `decisions.tsv:88` amends bullet 4 to accept `## Unreleased`. `CHANGELOG.md:3` reads `## Unreleased` |
| 2 | `README.md:27` "Six" contradicts `:132` "five" | **Fixed.** `README.md:27-28` reads "Five ... `understand`, `design`, `verify`, `review` or `ship`", and `:28-29` reads "The last six, ... `unslop` and `commit`". 1 + 5 + 6 = 12, which matches "Twelve other" (`:26`) and the 13 `SKILL.md` files on disk. `:132` "five" now agrees. `rg -o '/mstack:[a-z-]+' skills/router/playbooks/` finds exactly design, review, ship, understand and verify |
| 3 | Wiki route table missing the commit row | **Fixed.** `docs/wiki/Skills-and-Playbooks.md:105`. I diffed the 12 table lines of `skills/router/SKILL.md:29-41` against the wiki table, after normalising the link form. Identical, 11 rows in the same order |
| 4 | `The-CLI.md` lint transcript no longer reproduces | **Fixed.** `docs/wiki/The-CLI.md:468,471` read 33 / 18 / 38. A real run at HEAD and at `bc66346` (exported with `git archive`) prints the same lines (below) |
| 5 | House rules ship inside the skill | **Settled by the user** (`decisions.tsv:89`, "generalize"). **Partly done.** The attribution and trailer ban, lower case, the 72-character limit and the `Merge pull request #2` citation are gone. Imperative mood is still enforced (Changes required 1) |
| 6 | `CHANGELOG.md:10` "are enforced here" overclaims | **Fixed.** `CHANGELOG.md:11-12` now reads "Nothing enforces them yet; a commit guard in the hooks (item 35) would". Item 35 `commit-guard-in-hooks` is pending in `state.json`. Round 1's non-blocking "silent on all four" sentence is also gone |

## Requirement to test

The item is prose. Its only mechanical coverage is `lint-plugin` and the doc-link checker.

| R | Test | Evidence |
|---|---|---|
| 1 | `./bin/mstack lint-plugin .` | `[ok] skills/commit/SKILL.md (94 lines, 266 description chars)`. Rung 4. `name: commit` at `skills/commit/SKILL.md:2` is outside the delta (the hunks start at `:42`) |
| 2 | lint cross-reference check | `[ok] 18 skills and agents, every cross-reference in 38 file(s) resolves`. Row at `skills/router/SKILL.md:38`, a file the delta did not touch. Rung 2 for the row, rung 4 for resolution. Live routing was not exercised |
| 3 | none, search | Rung 2 (below) |
| 4 | none, read | `CHANGELOG.md:3`. Rung 2 |
| 5 | `npm test`, `gate`, `gate --full` | Rung 4 |
| 6 | none, read | Rung 2. **Not met** (Changes required 1 and 2) |
| 7 | lint run against the transcript, plus a count search | Rung 4 for the transcript, rung 2 for the counts |

## Acceptance, quoted

**"skills/commit/SKILL.md exists, declares name commit, and passes mstack lint-plugin"** - still
met. `skills/commit/SKILL.md:2` is `name: commit`, and lint passes with 0 failures and 0 warnings.

**"the router's route table sends commit-message work to the skill"** - still met.
`skills/router/SKILL.md:38` is unchanged, and the wiki copy now matches it
(`docs/wiki/Skills-and-Playbooks.md:105`).

**"every twelve-skills claim in README and the wiki reads thirteen, and the new row is in both tables"** -
still met. Thirteen at `README.md:130`, `README.md:460`, `docs/wiki/Home.md:63` and
`docs/wiki/Skills-and-Playbooks.md:7,20`. Rows at `README.md:149` and
`docs/wiki/Skills-and-Playbooks.md:36`.

**"CHANGELOG records the skill under ## Unreleased, which the 0.3.0 release renames"** - met.
`CHANGELOG.md:3`, entry at `:5`. Item 45 `benchmark-rerun-and-release` (pending) cuts 0.3.0.

**"both runtimes stay green and mstack gate passes"** - met. Bun 292/292, Node v24.14.0 286/286,
gate and `gate --full` exit 0 (below).

**"the shipped skill states Conventional Commits rules only; this repository's house rules live in CONTRIBUTING.md and CLAUDE.md, not in the skill"** -
**not met.** The delta's own documents name imperative mood as a house rule:
`CONTRIBUTING.md:72` lists it under "This repository adds rules of its own on top of it", and
`CHANGELOG.md:10` lists it under "This repository's own rules". The skill agrees:
`skills/commit/SKILL.md:91-93` says Conventional Commits "does not require imperative mood" and that
"a house rule is not the specification". The specification source contains no occurrence of
"imperative". Yet the skill still requires it: `skills/commit/SKILL.md:48-49` makes it item 1
under "Write the description", and `:84` makes it a mandatory pre-commit step: "Say the subject out
loud after 'this commit will'. If it does not parse, rewrite it." The skill's description says to
use it "before every git commit", so every installer's repository gets a house rule it never
adopted. The override clause at `:54-56` does not help a repository that writes no commit rules
down, which is most of them. `CHANGELOG.md:8` "It states the specification only" is false for the
same reason. Separately, `docs/wiki/Skills-and-Playbooks.md:87-88` still describes the
pre-generalization skill (Changes required 2). The other half of the bullet is met: the house
rules are in `CONTRIBUTING.md:69-74` and `CLAUDE.md:13-16`. `src/lint.ts:166-171` treats a
plugin-root `CLAUDE.md` as loaded only for this checkout, not for installers (rung 2, read, not
exercised live).

**"every count and route table in README and the wiki matches the skills and playbooks on disk, and pasted lint output is from a real run at the commit that edits it"** -
met. On disk: 13 `skills/*/SKILL.md`, 7 `skills/router/playbooks/*.md`, 5 `agents/*.md`, 4
direct-to-skill rows in the router table (`skills/router/SKILL.md:35-38`), and 5 skills named by
the playbooks. Every count I found agrees:
- skills: twelve other (`README.md:26`), thirteen (`README.md:130,460`, `Home.md:63`,
  `Skills-and-Playbooks.md:7,20`)
- router-called: five (`README.md:27,132`); typed by you: one plus six (`README.md:26,28`)
- playbook-skipping: four (`README.md:104-106`)
- playbooks: seven (`README.md:83,460`, `Home.md:63`, `Skills-and-Playbooks.md:4,8,120`)
- agents: five (`README.md:108,459`, `Home.md:62`, `The-Agents.md:3`)

`The-Story.md:21-22` and `README.md:165` count pstack's skills and playbooks, not mstack's. A
search for "skip the playbooks", "router calls", "the last five/six" and "requests" across
README, the wiki, CONTRIBUTING, CHANGELOG, `skills/` and `agents/` finds only the README lines
above. The route tables match (finding 3 above). The transcript at `docs/wiki/The-CLI.md:463-477`
matches a real run line for line, at HEAD and at `bc66346`, the commit that edits it.

## Verification I ran

`node` is not on this shell's PATH, so I prefixed `~/.nvm/versions/node/v24.14.0/bin`. Bun is
1.3.11.

```
$ ./bin/mstack version
mstack 0.2.1 at /Users/romerma/Code/mstack

$ ./bin/mstack gate                      # exit 0, before any action
[ok]    one active item: commit-message-standard (reviewing)
[warn]  on main; feature work belongs on its own branch
[ok]    working tree is clean
PASSED - 0 failures, 1 warning

$ npm test                               # exit 0
 292 pass
 0 fail
Ran 292 tests across 18 files. [31.27s]
...
ℹ tests 286
ℹ pass 286
ℹ fail 0

$ npm run typecheck                      # bunx --bun tsc --noEmit, exit 0, no output

$ ./bin/mstack lint-plugin .             # exit 0
[ok]    skills/commit/SKILL.md (94 lines, 266 description chars)
-- shipped commands
[ok]    33 file(s), no command that would hang on stdin
-- cross-references
[ok]    18 skills and agents, every cross-reference in 38 file(s) resolves
-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts
PASSED - 0 failures, 0 warnings

# bc66346 exported with git archive into the scratchpad, its own bin/mstack
$ bin/mstack lint-plugin <export>
[ok]    33 file(s), no command that would hang on stdin
[ok]    18 skills and agents, every cross-reference in 38 file(s) resolves
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
93 relative links checked, 0 broken

$ ./bin/mstack gate --full               # exit 0
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 1 warning           # the warning is "on main"

$ ./bin/mstack ledger check commit-message-standard     # before my row, exit 1
FAIL no verdict at 7f0e4985; 3 row(s) exist at other SHAs and a new head SHA voids them
```

The implementer's `test-verified` row is at `bc66346` (`ledger.tsv:66`), which is no longer HEAD.
`7f0e498` changed only `.mstack/`, and the lint results at both SHAs match.

## Changes required

1. `skills/commit/SKILL.md:84` and `:48-49`: imperative mood is still a rule in the shipped skill,
   so bullet 6 is unmet. `CONTRIBUTING.md:72`, `CHANGELOG.md:10` and the skill's own `:91-93`
   all call it a house rule. `:84` enforces it on every commit, and `:48` lists it first.
   Fix: delete step 2 at `:84`, or make it conditional ("if the repository requires imperative
   mood"). Then either drop `:48-49` or reword it as common practice the specification does not
   require, so that it no longer reads as a rule. `CHANGELOG.md:8` "states the specification
   only" becomes true with that change. Keeping imperative mood as a shipped default is round 1's
   option 2, which the user did not pick, so it would need a new `./bin/mstack decide --resolves`.

2. `docs/wiki/Skills-and-Playbooks.md:87-88`: the delta made this line stale. It says "`commit`
   never claims its house rules are the specification: imperative mood, lower case and the
   72-character subject are this repository's". The shipped skill no longer contains lower case
   or the 72-character limit, and after the generalization it should carry no house rules at
   all. Reword it to the prohibition the skill actually has (`SKILL.md:90-93`): it never presents
   a rule the specification does not make, such as imperative mood, lower case or a length
   limit, as the standard. In the same pass, align "an imperative description" at `:36` with
   whatever finding 1 settles.

## Non-blocking (file as items if wanted)

- `CONTRIBUTING.md:73` and `CHANGELOG.md:10-11` list "one change per commit" as a rule this
  repository adds on top of the standard. The specification's FAQ (`index.md:149`) says "Go back
  and make multiple commits whenever possible". The FAQ is not normative, so the claim holds for
  the numbered rules only. "on top of the normative rules" would be exact. This also covers
  `SKILL.md:51-52`: that rule has support on the specification's own page, so I did not count it
  against bullet 6.
- `SKILL.md:48,50,62-65`: the examples use mstack vocabulary ("the receipt", "the gate", "store
  root from the manifest", `MSTACK_ROOT`) in a skill that ships to every installer. They are not
  commits from this repository's history (`MSTACK_ROOT` is read nowhere in `src/`), so they are
  not the "its own commit examples" that `decisions.tsv:89` moves out. Neutral examples would
  still read better to strangers.
- The skill's description says to use it "before every git commit", but the playbook commit steps
  (`feature.md:20`, `bug-fix.md:18`, `refactor.md:13`) do not call `/mstack:commit`. README is
  accurate about this now (`commit` is typed by you or routed directly), so this is a workflow
  gap, not a docs error. Item 35's hook may be the better place to close it.
