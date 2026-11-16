# Implementation report, round 2: ledger-check-hides-a-rejection (item 47)

## What changed

`ledger check` (`src/ledger.ts:154-190`) now exempts `verifier-failed` and `verifier-blocked` rows from the report-citation filter: a rejection counts whatever its evidence cites, and only APPROVALS that cite an implementing role's own report are discounted (as in the gate). Decision taken for an approval that cites the author's report: when every closing-role approval at the sha is discounted, `check` FAILS and names it: `<verdict> at <sha8> by <verifier> cites the implementer's own report (evidence: ...), so it is not an independent approval`. The gate refuses to close on exactly that ledger (`src/gate.ts:421-437`), so the direction agrees; a fallback label would still exit 0. If a genuine closing approval exists, it stays the answer and the discounted row is ignored (as the gate does). The target is regex-escaped before it reaches `citesImplementingReport` (`src/ledger.ts:161`), so `api(v2`, `a.b`, `x[1]`, `a+b` are literals. The wiki sentence is corrected. Decision row recorded (`decide --phase implement`).

## Files

`src/ledger.ts`, `tests/ledger.test.ts`, `docs/wiki/The-Agents.md` (line 165), `docs/wiki/The-CLI.md` (one paragraph: rejection counts even when citing the report; discounted approval fails), `.mstack/decisions.tsv`, `.mstack/progress/current.md`, this report.

Commits: af657c8 red tests (4 red); 75cf441 fix; 6acad54 red regex tests (5 red); ed3e66a escape; 972bc52 wording tests + rename; 9110485 docs; d73b40c extra test (found by the exemption mutant, see below).

## Commands

Throwaway store, real CLI, ledger = implementer `test-verified`, then the row named (`/private/tmp/.../scratchpad/impl47r2/cases.sh`; before = `git archive 744226e`):

```
BEFORE (744226e)
R1 rejection citing impl + own report  [exit 0] PASS test-verified at c8437eda by implementer (the author's own verdict, not an independent approval)
R2 rejection, evidence impl_demo.md    [exit 0] PASS test-verified at c8437eda by implementer (the author's own verdict, not an independent approval)
R3 verifier-blocked citing impl        [exit 0] PASS test-verified at c8437eda by implementer (the author's own verdict, not an independent approval)
R4 approval citing impl                [exit 0] PASS test-verified at fdd9dab3 by implementer (the author's own verdict, not an independent approval)
AFTER
R1 CHECK [exit 1] FAIL verifier-failed at 9818b492 by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md; the claims in .mstack/progress/impl_demo.md do not hold)
R2 CHECK [exit 1] FAIL verifier-failed at fa53d5ac by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/impl_demo.md)
R3 CHECK [exit 1] FAIL verifier-blocked at fa53d5ac by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/impl_demo.md)
R4 CHECK [exit 1] FAIL test-verified at 2c39cf4b by reviewer cites the implementer's own report (evidence: .mstack/progress/impl_demo.md), so it is not an independent approval
Gate, item moved to done on the same four ledgers, committed, `mstack gate`:
R1..R4 GATE [exit 1] [fail]  items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)
```
(The gate refuses all four, via its forged-citation list; `check` now fails all four. Same direction.)

```
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'  -> tests 477 / pass 477 / fail 0
$ bun test ./tests                                                                                -> 477 pass, 0 fail, Ran 477 tests across 22 files [72.15s]
$ bunx --bun tsc --noEmit                                                                         -> exit 0
$ ./bin/mstack lint-plugin .                                                                      -> PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md                                       -> 96 relative links checked, 0 broken
$ ./bin/mstack gate                                                                               -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack ledger check benchmark-harness a4e6c784d99536d39c132cb0d5e4d634ad34e9f2            -> PASS test-verified at a4e6c784 by reviewer
```
Red states: after af657c8, `ℹ pass 24 / ℹ fail 4` (the 4 new); after 6acad54, `ℹ pass 32 / ℹ fail 5`. Load-sensitive tests did not fail.

## Findings answered

| # | Reproduced | What I did | Test / file:line |
|---|---|---|---|
| 1 | yes (R1-R3 PASS exit 0 before) | rejections exempt from the citation filter; discounted approvals fail the check and say why; decision recorded | `src/ledger.ts:157-190`; tests `tests/ledger.test.ts:315` (rejection + own report), `:326` (retracts a genuine approval), `:335` (only impl_x.md), `:344` (blocked), `:353` (approval citing impl), `:366` (genuine approval beats discounted one) |
| 2 | yes (`The-Agents.md:165`) | corrected to "`ledger check` reads the latest closing-role row per item and commit ... whichever lens recorded last, and a split panel means its worst lens"; wider search below; CLI page paragraph updated | `docs/wiki/The-Agents.md:165`, `docs/wiki/The-CLI.md:322-328` |
| 3 | yes (`api(v2` exit 2 in the review; the new tests were red, 5 of them) | slug escaped in `ledger.ts` (cannot touch `roles.ts`; the escaped slug is interpolated into the regex there, so it matches literally) | `src/ledger.ts:161`; `tests/ledger.test.ts:394` and the loop after it (4 targets x 2 tests), `:407` (`a.b` does not match `impl_axb.md`) |
| 4 | yes | renamed `:57` to "with no closing-role row, the strongest author row at a SHA is the answer"; M13 pinned (`/rejects this commit, whatever an implementing role recorded/`, `:154`); M16 pinned (`:170`) | `tests/ledger.test.ts:57`, `:154`, `:170` |

## Prose hits of the wider search

`rg -n -i "most favou?rable|best row|by rank|best verdict|keeps the best|highest[- ]rank|favou?rable member" README.md CHANGELOG.md CONTRIBUTING.md docs skills agents hooks`
- `docs/wiki/The-Agents.md:165` "most favorable verdict ... most favorable member": corrected.
Also searched `winning row|strongest`: `docs/wiki/The-Agents.md:165` "winning row": corrected (same sentence); `docs/wiki/The-Story.md:89`, `docs/research/pstack-port.md:439`, `skills/understand/references/sources/incidents.md:40` ("strongest signal/finding"): unrelated, still true.
Every other prose mention of `ledger check` (`agents/reviewer.md:36,99`, `skills/review/SKILL.md:38,44,50`, `skills/router/playbooks/resume.md:13`, `docs/wiki/The-Agents.md:145`, `Getting-Started.md:282`, `State-Files.md:66`, `The-CLI.md:311,332`, `CHANGELOG.md:259`): read, still true. `agents/reviewer.md:99-102` and `skills/review/SKILL.md:50` already say latest closing-role row: still true.

## Mutant table

Applied to `src/ledger.ts`, run on `tests/ledger.test.ts` with node and bun, restored (`git checkout`); `git status --short` shows only my test change before commit, clean after. Tests killed (same count on both runtimes unless noted).

| Mutant | Killed |
|---|---|
| remove the rejection exemption | 4 on both (the first suite killed 0: a dropped rejection fell into the discounted branch and still failed; the extra test at `:326` and the `rejects this commit` assertions fixed that) |
| remove the citation filter entirely | 7 |
| remove the regex escaping | 5 |
| M13 drop "whatever an implementing role recorded" | 1 |
| M16 drop "(the author's own verdict)" from the failing message | 1 (`:170`) |
| discounted approvals not failed (fall back to author's own) | 5 |
| latest of any role (`byCloser = here`) | 4 node / 5 bun |
| revert to best-by-rank (`5b2714c` file) | 23 node / 22 bun |

## Closed items

`./bin/mstack ledger check <slug> <sha of its latest closing row>` for all 29 `done` items (script `.../impl47r2/closed.mjs`): 29 PASS, 0 non-passing. `benchmark-harness` -> `PASS test-verified at a4e6c784 by reviewer`. `./bin/mstack gate` green.

## Acceptance to test

| Acceptance | Test | file:line |
|---|---|---|
| 1. exits non-zero and names a reviewer rejection that is the latest closing row, even over a higher implementer row (also when it cites the report) | rejection tests | `tests/ledger.test.ts:154`, `:176`, `:315`, `:335`, `:344` |
| 2. benchmark-harness case: implementer test-verified then reviewer verifier-failed | | `tests/ledger.test.ts:154` |

## Honest rung

Rung 5 for the CLI behaviour (real CLI and real gate in throwaway stores, before and after), rung 4 for the tests (red first, killed by mutants, both runtimes). Not done: the other non-blocking notes (queued follow-ups).
