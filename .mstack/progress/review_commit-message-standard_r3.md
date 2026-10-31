# Review - commit-message-standard (round 3)

**Verdict:** APPROVED

Reviewed at head `958f9ecd2c72ab8659404b6f837766c2b44538ca`. Authorized by `decisions.tsv:90`
(phase `review-r3`), scoped to the two "Changes required" items of
`review_commit-message-standard_r2.md` plus the suite. Scope is the delta
`git diff 7f0e498..HEAD -- . ':!.mstack'`, which is commit `ff2e49a` only: 2 files, 7 insertions,
8 deletions (`skills/commit/SKILL.md`, `docs/wiki/Skills-and-Playbooks.md`). `958f9ec` touches
only `.mstack/`. `git diff --stat 7f0e498..HEAD -- tests src hooks` is empty, so no test was
weakened. No new scope opened.

## Round-2 findings

| # | Round-2 finding | Status |
|---|---|---|
| 1 | `skills/commit/SKILL.md:48-49,84` make imperative mood a rule | **Fixed.** The mandatory step ("Say the subject out loud after 'this commit will'...", old `:84`) is deleted; "Before you commit" is now 3 steps (`:83-85`). `:48-49` now reads "**Imperative mood** is a common habit, not a rule ... Follow it where the repository does." The only other mention is `:89-90`, "does not require imperative mood". Rung 2 (read) plus a search run at both revisions (below) |
| 2 | `docs/wiki/Skills-and-Playbooks.md:36,87-88` describe removed rules | **Fixed.** `:36` reads "the type the change earns, the description, breaking changes marked" (was "an imperative description"). `:87-88` reads "`commit` states Conventional Commits only and never presents a house rule as the specification; it defers to a repository's own `CLAUDE.md` or `CONTRIBUTING.md` for those." That matches `SKILL.md:54-56` (defer), `:85` (check repo rules) and `:89-92` (house rule is not the spec). The page has no hit left for `imperative`, `72-character` or `lower case`. Rung 2 |

## Requirement to test

The item is prose. Its mechanical coverage is `lint-plugin`, the doc-link checker and the suite.
No committed test covers bullets 3, 4 or 6. For bullet 6 I used a search that tells the pre-delta
revision apart from HEAD, so the check would fail if the change were reverted.

| R | Test | Evidence |
|---|---|---|
| 1 | `./bin/mstack lint-plugin .` | `[ok] skills/commit/SKILL.md (93 lines, 266 description chars)`; `name: commit` at `SKILL.md:2`, outside the hunks (`:45`, `:81`). Rung 4 |
| 2 | lint cross-reference check | `skills/router/SKILL.md:38` untouched; `[ok] 18 skills and agents, every cross-reference in 38 file(s) resolves`. Rung 2 for the row, rung 4 for resolution. Live routing not exercised (no rung 5) |
| 3 | search | Untouched by the delta. Rung 2 |
| 4 | read | `CHANGELOG.md` untouched by the delta. Rung 2 |
| 5 | `bun test tests/`, node half on 22.6.0, `npm test` on 24.14.0, typecheck, `gate`, `gate --full` | Rung 4 (below) |
| 6 | `rg -i 'imperative\|this commit will'` at `7f0e498` and at HEAD; wiki search for the removed rules | Before: `:48-49` "reads best ... *this commit will*", `:84` mandatory step. HEAD: only `:48` "not a rule" and `:90` "does not require". Rung 2 for the semantic judgement, rung 4 for "the mandatory wording is gone" |
| 7 | lint transcript compared against `docs/wiki/The-CLI.md:463-477`; count search | Transcript matches a real run line for line; the delta edits no pasted output (no `93 lines`/`94 lines`/`commit/SKILL.md` line pasted anywhere in README or docs). Rung 4 for the transcript, rung 2 for counts |

## Acceptance, quoted

**"the shipped skill states Conventional Commits rules only; this repository's house rules live in CONTRIBUTING.md and CLAUDE.md, not in the skill"** -
**met.** Imperative mood is advice now, not a rule. `skills/commit/SKILL.md:48-49` calls it "a
common habit, not a rule" and makes it conditional on the repository. The step that enforced it
on every commit is gone (`:83-85` are the diff, type and repo-rules checks). `:54-56` and `:85`
defer to the repository's own `CLAUDE.md`/`CONTRIBUTING.md`, and `:89-92` says Conventional
Commits does not require imperative mood, lower case or a length limit. A search of
`skills agents hooks commands` for `imperative` or `this commit will` finds only `SKILL.md:48`
and `:90`. `SKILL.md` has no `72`, `Co-Authored`, `attribution` or lower-case rule; its only
`lower case` hit is `:90`, inside "does not require". The house rules are in
`CONTRIBUTING.md:71-74` ("imperative mood, lower case, a subject of 72 characters or fewer, one
change per commit, no AI attribution and no `Co-Authored-By` trailer") and `CLAUDE.md:13-16`.
With this fix, `CHANGELOG.md:8-9` ("It states the specification only") is true. The writing
guidance at `:50-54` (name the change, one commit one change, short subject) was judged not to be
a house rule in round 2 and is unchanged.

Bullets 1-5 and 7, against the delta only:

**"skills/commit/SKILL.md exists, declares name commit, and passes mstack lint-plugin"** - not
broken. `SKILL.md:2` `name: commit`; lint 0 failures, 0 warnings, the skill now 93 lines.

**"the router's route table sends commit-message work to the skill"** - not broken.
`skills/router/SKILL.md:38` and its wiki copy `docs/wiki/Skills-and-Playbooks.md:105` are outside
the delta.

**"every twelve-skills claim in README and the wiki reads thirteen, and the new row is in both tables"** -
not broken. Thirteen still at `README.md:130,460`, `docs/wiki/Home.md:63`,
`docs/wiki/Skills-and-Playbooks.md:7,20`. The wiki row `:36` was edited in place and is still
there; README row `:149` untouched. 13 `skills/*/SKILL.md` on disk. The remaining "twelve" hits
(`README.md:26,101`, `The-Story.md:55-56,83,118`, `The-CLI.md:447`) are "Twelve other" or about
other things, as in round 2.

**"CHANGELOG records the skill under ## Unreleased, which the 0.3.0 release renames"** - not
broken. `CHANGELOG.md` untouched; `:3` `## Unreleased`, entry `:5`.

**"both runtimes stay green and mstack gate passes"** - met. Bun 292/292; Node 22.6.0 286/286
(CI flags); `npm test` on Node 24.14.0 exit 0 (292 + 286); typecheck exit 0; `gate` exit 0;
`gate --full` exit 0 with Node on PATH. One caveat, pre-existing and outside the delta: on
22.6.0 the `npm test` script itself fails (see Non-blocking 1).

**"every count and route table in README and the wiki matches the skills and playbooks on disk, and pasted lint output is from a real run at the commit that edits it"** -
not broken. The delta adds or removes no skill, playbook or table row. The only lint value it
changes is the commit skill's line count (94 to 93), and no pasted transcript contains that
line. `docs/wiki/The-CLI.md:463-477` matches this run's lint output (33 / 18 / 38, lifecycle,
PASSED).

## Verification I ran

Bun 1.3.11. `node` is not on this shell's PATH. The node half ran twice: once directly with
`/Users/romerma/.nvm/versions/node/v22.6.0/bin/node` using the CI oldest-node flags
(`.github/workflows/ci.yml:56`), and once as `npm test` with Node 24.14.0 prefixed. `npm test`
with 22.6.0 prefixed, as the brief suggested, fails before running any test (output below).

```
$ ./bin/mstack version
mstack 0.2.1 at /Users/romerma/Code/mstack

$ ./bin/mstack gate                                   # exit 0, before acting
[ok]    one active item: commit-message-standard (reviewing)
[warn]  on main; feature work belongs on its own branch
[ok]    working tree is clean
PASSED - 0 failures, 1 warning

$ bun test tests/                                     # exit 0
 292 pass
 0 fail
Ran 292 tests across 18 files. [31.61s]

$ PATH=~/.nvm/versions/node/v22.6.0/bin:$PATH npm test    # exit 1, pre-existing
# TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for .../tests/verification.test.ts
# Node.js v22.6.0
# tests 16
# pass 0
# fail 16

$ ~/.nvm/versions/node/v22.6.0/bin/node --disable-warning=ExperimentalWarning \
    --experimental-strip-types --test 'tests/*.test.ts'   # exit 0, the CI oldest-node command
1..286
# tests 286
# pass 286
# fail 0

$ PATH=~/.nvm/versions/node/v24.14.0/bin:$PATH npm test   # exit 0
 292 pass
 0 fail
Ran 292 tests across 18 files. [31.24s]
ℹ tests 286
ℹ pass 286
ℹ fail 0

$ bun run typecheck                                   # exit 0
$ bunx --bun tsc --noEmit

$ ./bin/mstack lint-plugin .                          # exit 0
-- manifest
[ok]    plugin name: mstack
[ok]    skills/commit/SKILL.md (93 lines, 266 description chars)
[ok]    20 reference file(s), every relative link resolves
-- shipped commands
[ok]    33 file(s), no command that would hang on stdin
-- cross-references
[ok]    18 skills and agents, every cross-reference in 38 file(s) resolves
-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md     # node 22.6.0, exit 0
93 relative links checked, 0 broken

$ ./bin/mstack gate --full                            # exit 1, no node on PATH
-- verification
/bin/sh: npm: command not found
[fail]  npm test && npm run typecheck && bin/mstack lint-plugin . failed
FAILED - 1 failure, 1 warning

$ PATH=~/.nvm/versions/node/v24.14.0/bin:$PATH ./bin/mstack gate --full   # exit 0
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 1 warning                        # the warning is "on main"

# revert sensitivity for bullet 6
$ git show 7f0e498:skills/commit/SKILL.md | rg -n -i 'imperative|this commit will'
48:1. **Imperative mood** reads best: "add the receipt", not "adds" or "added". Read it as
49:   *this commit will* `<description>`.
84:2. Say the subject out loud after "this commit will". If it does not parse, rewrite it.
91:imperative mood, lower case, a subject length limit, ...
$ rg -n -i 'imperative|this commit will' skills/commit/SKILL.md
48:1. **Imperative mood** is a common habit, not a rule: "add the receipt" rather than "adds" or
90:imperative mood, lower case, a subject length limit, ...
$ git show 7f0e498:docs/wiki/Skills-and-Playbooks.md | rg -n -i 'imperative|72-character|lower case'
36:| `/mstack:commit` | ... an imperative description, breaking changes marked | ...
87:- `commit` never claims its house rules are the specification: imperative mood, lower case
88:  and the 72-character subject are this repository's, not Conventional Commits'.
$ rg -n -i 'imperative|72-character|lower case' docs/wiki/Skills-and-Playbooks.md
(no hits)

$ ./bin/mstack ledger check commit-message-standard   # before my row, exit 1
FAIL no verdict at 958f9ecd; 5 row(s) exist at other SHAs and a new head SHA voids them
```

The implementer's round-3 `test-verified` row is at `ff2e49a` (`ledger.tsv:68`), not HEAD;
`958f9ec` changes only `.mstack/`. The implementer did not run the node half (rung 3 in their
report). I ran it, so the runtimes claim is now rung 4 on both.

## Non-blocking (file as items if wanted)

1. `package.json` scripts `test` and `test:node` (`node --test 'tests/*.test.ts'`) fail on Node
   22.6.0 with `ERR_UNKNOWN_FILE_EXTENSION`, 0/16 files, because they leave out
   `--experimental-strip-types`. The CI oldest-node job passes it (`.github/workflows/ci.yml:56`).
   22.6 is the stated floor (`CONTRIBUTING.md:51-53`, `README.md:404-405`), and the store's verify
   command starts with `npm test`, so `gate --full` only passes locally on a Node that strips
   types by default. This predates the item.
2. `SKILL.md:49` "Follow it where the repository does" could mean the repository's log or its
   written rules. Both readings are conditional, so bullet 6 holds either way. Naming both would
   be clearer, for example "where the repository's rules or its log do".
3. Bullet 6 has no committed regression guard. It held here by reading plus an ad hoc search. If
   house rules creep back into the shipped skill, nothing mechanical will catch it.
