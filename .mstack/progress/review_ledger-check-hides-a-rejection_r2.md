# Review - ledger-check-hides-a-rejection

**Verdict:** APPROVED

Round 2, reviewing alone, head `acd6b7530523bacdbdc3925ffbe91ada4babd10d` (last code/docs commit `d73b40c`).
Round 2 diff: `git diff 744226e...HEAD -- src tests docs` (4 files: `src/ledger.ts` +25/-6,
`tests/ledger.test.ts` +115/-1, `docs/wiki/The-Agents.md` +1/-1, `docs/wiki/The-CLI.md` +4/-2).

Both round 1 blockers are fixed and shown fixed with the real CLI. A rejection now counts
whatever its evidence cites, an approval that only cites the implementer's report fails with
its own message, and the regex crash is gone. Every closed item in this store still passes,
the gate is green, and both runtimes are green. I found nothing that blocks. The gaps I did
find are in the tests and the wording, and are listed under the non-blocking notes.

## Round 1 findings: resolved or not

| Round 1 finding | Status | Evidence |
|---|---|---|
| Blocker 1: `src/ledger.ts:157-159`, a rejection citing `impl_<slug>.md` dropped, so `check` printed the implementer's PASS | **resolved** | `src/ledger.ts:163-164` exempts `verifier-failed`/`verifier-blocked`. Real CLI: cases C1, C2, C3 and C7 below all FAIL and name the rejection (exit 1). Tests `tests/ledger.test.ts:315`, `:326`, `:335`, `:344` go red on node and bun when the exemption is reverted (mutant R1). With the exemption reverted, the real CLI from a patched `git archive HEAD` copy prints `PASS test-verified at 892f8a15 by reviewer` (exit 0) for C7. So the exemption matters even with the new discounted-approval branch in place |
| Blocker 2: `docs/wiki/The-Agents.md:165` stated most-favorable | **resolved** | line now reads "`ledger check` reads the latest closing-role row per item and commit, so several lens rows would collapse to whichever lens recorded last, and a split panel means its worst lens, not the last one". True (section E) |
| Non-blocking 1: `ledger check 'api(v2'` crashed with "Invalid regular expression" | **resolved** | `src/ledger.ts:161` escapes `.*+?^${}()\|[]\`. Real CLI over 9 target shapes, section C: no crash, literal matching, citation still recognised. Mutant R4 killed by 5 tests on both runtimes |
| Non-blocking 2: stale title at `tests/ledger.test.ts:57` | **partly** | Renamed, and the assertions are byte-identical (not weakened). But the new title says "with no closing-role row, the strongest author row at a SHA is the answer", and the test's two rows come from `ci` and `reviewer`, which are both closing roles (`canCloseAnItem`). It does not exercise the author-only fallback at all (mutant O14 survives). See non-blocking note 1 |
| Surviving mutant M13 (wording of the rejection reason) | **resolved** | assertion at `tests/ledger.test.ts:167`; M13 now killed by 5 tests on both runtimes |
| Surviving mutant M16 (author-only failing label) | **resolved** | new test `tests/ledger.test.ts:170`; M16 killed on both runtimes |
| Non-blocking 3 (`latest.verifier \|\| "unknown"` dead) and 4 (file-order comment) | not addressed | out of scope, unchanged, still non-blocking |

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| 1. fails and names a reviewer rejection that is the latest closing-role row, over a higher-ranked implementer row | `tests/ledger.test.ts:154`, `:176`, `:194`, `:212`, and in round 2 `:315`, `:326`, `:335`, `:344` | killed by M1, R1, M13, O1, O2. Real CLI C1-C3, C7, C8 |
| 2. benchmark-harness case: implementer test-verified then reviewer verifier-failed at one sha | `tests/ledger.test.ts:154` | killed by M1 and M13 on both runtimes. Its round 2 version with the impl report cited: `:315` |

## Acceptance, quoted

**"ledger check exits non-zero and names the rejection when a reviewer's verifier-failed row is the latest closing-role row at the checked sha, even if an implementer row at that sha ranks higher"** -
met, now also when the rejection's evidence cites the implementer's report. Real CLI with
implementer `test-verified` first and then reviewer `verifier-failed` (C1: evidence
`review_demo.md; ... impl_demo.md ...`; C2: evidence only `impl_demo.md`) prints
`FAIL verifier-failed at <sha8> by reviewer rejects this commit, whatever an implementing role recorded (evidence: ...)`,
exit 1. `src/ledger.ts:164`, `:176-182`. Tests `tests/ledger.test.ts:154`, `:315`, `:335` assert
`passing === false`, `verifier-failed`, `reviewer` and the wording. All are red under M1
(best-by-rank) and `:315`/`:335` are also red under R1 (exemption reverted), on node and bun alike.

**"a test reproduces the benchmark-harness case: implementer test-verified then reviewer verifier-failed at one sha"** -
met by `tests/ledger.test.ts:154`. It records exactly those two rows at one sha and asserts
`passing === false`, `best.verdict === "verifier-failed"`, `best.verifier === "reviewer"`, the
evidence path, and (new in round 2) `/rejects this commit, whatever an implementing role recorded/`.
It is killed by M1 and M13 on both runtimes. On the real store:
`./bin/mstack ledger check benchmark-harness a4e6c784d99536d39c132cb0d5e4d634ad34e9f2` prints
`PASS test-verified at a4e6c784 by reviewer`, exit 0.

## Verification I ran

```
$ ./bin/mstack version
mstack 0.2.1 at /Users/romerma/Code/mstack
$ ./bin/mstack gate
PASSED - 0 failures, 0 warnings                         (also after every mutant was restored)
$ ./bin/mstack gate --full                              (exit 0)
 483 pass / 0 fail / Ran 483 tests across 24 files. [71.38s]   (bun test tests/, includes the gitignored sandbox/)
ℹ tests 477 / ℹ pass 477 / ℹ fail 0                              (node --test 'tests/*.test.ts')
> bunx --bun tsc --noEmit                                          (clean)
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test 'tests/*.test.ts'   (node v26.13.1, exit 0)
ℹ tests 477 / ℹ pass 477 / ℹ fail 0
$ bun test ./tests                                       (bun 1.3.11, exit 0)
 477 pass / 0 fail / Ran 477 tests across 22 files. [72.60s]
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
96 relative links checked, 0 broken                      (exit 0)
$ ./bin/mstack ledger check ledger-check-hides-a-rejection "$(git rev-parse HEAD)"   (before my row)
FAIL no verdict at acd6b753; 3 row(s) exist at other SHAs and a new head SHA voids them
```
The load-sensitive tests (`tests/run.test.ts:54`, `:239`, `tests/costs.test.ts:698`) did not fail in any run.

### A. Case table: real CLI, real gate, real status line

Each case: a fresh throwaway store (`git init -q .`, empty commit,
`/Users/romerma/Code/mstack/bin/mstack setup`, item `demo`). Rows are recorded at the full HEAD
sha in the order given, then `ledger check demo <sha>`. Then the item is moved to `in_progress`
and `mstack statusline` is rendered. Then it is moved reviewing -> verifying -> done, committed,
and `mstack gate` is run. `P` = `.mstack/progress`. Default `--min test-verified`.

| # | Rows at the sha (file order) | `ledger check` (exact line) | exit | status line | gate on the same ledger |
|---|---|---|---|---|---|
| C1 | implementer test-verified; reviewer verifier-failed `P/review_demo.md; the claims in P/impl_demo.md do not hold` | `FAIL verifier-failed at ef3a25fe by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md; the claims in .mstack/progress/impl_demo.md do not hold)` | 1 | `<RED>verifier-failed` | exit 1 `[fail] items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)` |
| C2 | implementer test-verified; reviewer verifier-failed `P/impl_demo.md` | `FAIL verifier-failed at e837e13b by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/impl_demo.md)` | 1 | `<RED>verifier-failed` | exit 1, same `[fail]` |
| C3 | implementer test-verified; reviewer verifier-blocked `P/impl_demo.md` | `FAIL verifier-blocked at 1a252dc9 by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/impl_demo.md)` | 1 | `<YELLOW>verifier-blocked` | exit 1, same `[fail]` |
| C4 | implementer test-verified; reviewer APPROVAL test-verified `P/impl_demo.md` | `FAIL test-verified at e3b719c3 by reviewer cites the implementer's own report (evidence: .mstack/progress/impl_demo.md), so it is not an independent approval` | 1 | `<YELLOW>test-verified` | exit 1, same `[fail]` |
| C5 | reviewer test-verified `P/review_demo.md`; reviewer live-verified `P/impl_demo.md` | `PASS test-verified at 0741e436 by reviewer` (the genuine row is the answer) | 0 | `<GREEN>test-verified` | exit 0 `[ok] 1 closed item(s) carry a ledger verdict` |
| C6 | reviewer test-verified `P/impl_demo.md`; reviewer test-verified `P/review_demo_r2.md` | `PASS test-verified at 30519f7f by reviewer` | 0 | `<GREEN>test-verified` | exit 0 `[ok]` |
| C7 | reviewer test-verified `P/review_demo.md`; reviewer verifier-failed `P/review_demo_r2.md: P/impl_demo.md is wrong` | `FAIL verifier-failed at cba865c8 by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo_r2.md: .mstack/progress/impl_demo.md is wrong)` | 1 | `<RED>verifier-failed` | exit 0 `[ok]`: the gate drops the citing rejection and closes. This is a gate defect, and `check` disagrees in the safe direction (follow-up 1) |
| C8 | reviewer verifier-failed `P/review_demo.md`; reviewer test-verified `P/impl_demo.md` | `FAIL verifier-failed at 133abccc by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md)` | 1 | `<RED>verifier-failed` | exit 1 `[fail] items marked done whose most recent closing verdict is verifier-failed: demo (reviewer)` |
| C9 | reviewer verifier-failed `P/review_demo.md`; reviewer test-verified `P/review_demo_r2.md` | `PASS test-verified at a9c0da75 by reviewer` | 0 | `<GREEN>test-verified` | exit 0 `[ok]` |

C8, "is it right?": yes. The discounted approval is not an independent statement, so the latest
independent closing verdict is the rejection. `check` answers with that rejection, and the gate
refuses on the same ledger. With C9, a genuine later approval answers it: PASS, and the gate closes.

Further cases run the same way:

| # | Rows | `ledger check` | gate |
|---|---|---|---|
| X1 | reviewer test-verified citing `P/spec_demo.md` only | `FAIL test-verified at ab20c60b by reviewer cites the implementer's own report (evidence: .mstack/progress/spec_demo.md), so it is not an independent approval` (exit 1; wording names the wrong role, note 2) | `[fail] ... cites the spec-author's own report: demo (reviewer)` |
| X2 | C4 with `--min type-check-only` | `FAIL test-verified at 251a9788 by reviewer cites the implementer's own report ...` | `[fail]` forged |
| X3 | discounted approval, then implementer live-verified | `FAIL test-verified at 28cf9e19 by reviewer cites the implementer's own report ...` | `[fail]` forged |
| X4 | implementer pass; `orchestrator` test-verified citing `P/review_demo_correctness.md, P/review_demo_tests.md` | `PASS test-verified at c588954b by orchestrator` | `[ok]` |
| X5 | reviewer test-verified `P/review_demo_r2.md (answers P/impl_demo_r2.md)` | `FAIL test-verified at 2d5ab975 by reviewer cites the implementer's own report ...` | `[fail]` forged |
| X6 | reviewer fail; discounted approval; genuine reviewer approval | `PASS test-verified at eb9ce933 by reviewer` | `[ok]` |
| X7 | reviewer fail; reviewer verifier-blocked citing `P/impl_demo.md` | `FAIL verifier-blocked at 7ae89a44 by reviewer rejects this commit, ...` | `[fail] ... most recent closing verdict is verifier-failed` |
| X8 | reviewer type-check-only; reviewer test-verified citing `P/impl_demo.md` | `FAIL latest closing verdict at 135368c8 is type-check-only by reviewer, which does not clear test-verified` | `[ok]` (pre-existing `--min` difference, safe direction) |
| X9 | `mstack:implementer` pass; `mstack:reviewer` approval citing `P/impl_demo.md` | `FAIL test-verified at c815fc5e by mstack:reviewer cites the implementer's own report ...` | `[fail]` forged |
| X10 | discounted approval; reviewer verifier-failed `P/review_demo_r2.md` | `FAIL verifier-failed at 05b63233 by reviewer rejects this commit, ...` | `[fail]` most recent closing verdict is verifier-failed |
| Y1 | implementer only | `PASS test-verified at c2722f7f by implementer (the author's own verdict, not an independent approval)` | `[fail] ... the pass that wrote the code: demo (only implementer)` |
| Y2 | implementer pass; implementer verifier-failed | `PASS test-verified at 39e5b82a by implementer (the author's own verdict, not an independent approval)` | `[fail] ... (only implementer)` |

**Did any ledger make `ledger check` pass where the gate refuses on the verdict at that sha?** Of
the round 2 shapes, none: C1-C4, C8, X1-X3, X5, X7, X9 and X10 are FAIL/refuse, and C5, C6, C9, X4
and X6 are PASS/close. The only PASS/refuse pairs are Y1/Y2, where every row is the author's
own. That behaviour predates this round and comes from the design row (`.mstack/decisions.tsv:126`),
and the message carries the "author's own verdict" label. Round 2 does not touch it. I walked the
code (rung 3): `byCloser` non-empty means `check` returns from the closing branch or the forged
branch and never reaches the author fallback. PASS requires the last row in `closing` to be a
genuine approval, so no rejection, cited or not, comes after it at that sha. The forged branch
always FAILs. So at one sha, `check` PASS with closing-role rows present implies that the latest
independent closing statement is an approval.

Reverting the exemption (R1), applied to `src/ledger.ts` and restored: 4 tests go red on
node and on bun (`:315`, `:326`, `:335`, `:344`). On the real CLI from a patched
`git archive HEAD` copy (with the `different copy` note filtered out), C1, C2 and C3 still FAIL,
but they are misreported as `... cites the implementer's own report ..., so it is not an independent approval`.
C7 becomes `PASS test-verified at 892f8a15 by reviewer`, exit 0.

### B. Readers of the result

`rg -n "ledger\.check|ledgerCheck|\.best\b|\.passing\b" src`. There are three readers, and none
of them changed in round 2 (`git diff --quiet 744226e HEAD -- src/cli.ts src/statusline.ts src/mergegate.ts`).
- `src/cli.ts:756-758`: prints `PASS|FAIL <reason>` and exits on `passing`; that is table A.
- `src/mergegate.ts:165-170`, `evaluate()` called on the real case stores with `headRefOid` = the row sha:
  C1/C2/C3/C7/C8 `STOP | ledger: verifier-... rejects this commit, ...`; C4/X1/X3/X5
  `STOP | ledger: test-verified at <sha8> by reviewer cites the implementer's own report (...), so it is not an independent approval`;
  X8 `STOP | ledger: latest closing verdict ... type-check-only ...`; C5/C6/C9 `GO | ... ledger: test-verified at <sha8> by reviewer`.
- `src/statusline.ts:141,152-155` reads `best.verdict` and `passing`. A discounted approval
  renders `<YELLOW>test-verified` (C4, X1-X3, X5, X9). Round 1 rendered it green, so this is better
  now but still does not say why (note 4). A rejection renders `<RED>verifier-failed` (C1, C2,
  C7, C8) and `<YELLOW>verifier-blocked` (C3, X7).

`best` keeps its type (`Entry | undefined`). In the new branch it is the discounted row with
`passing: false`, and every reader handles that. No reader crashed or reported PASS/GO for a
discounted approval.

### C. The regex fix: real CLI, throwaway store

Empty ledger, targets `api(v2`, `a.b`, `x[1]`, `a+b`, `a\b`, `a$`, `^a`, `""` and a
40,001-character `a(a(...b`: every one prints `FAIL no verdict recorded for <target>`, exit 1, with
no crash. Then I recorded genuine reviewer approvals for the look-alikes `axb`, `x1`, `aab`, `ab`,
`a`, `xa`. Checking `a.b`, `x[1]`, `a+b`, `a$`, `^a` and `a\b` still prints
`FAIL no verdict recorded for <target>`, so no target sees another target's rows. With a genuine
row each: `PASS test-verified at 76d42d41 by reviewer` for all seven metacharacter targets. With
an approval citing `impl_F<target>.md` for `Fapi(v2`, `Fa.b`, `Fx[1]`, `Fa+b`, `Fa\b`, `Fa$` and
`F^a`, each one prints `FAIL test-verified at 76d42d41 by reviewer cites the implementer's own report (evidence: .mstack/progress/impl_F<target>.md), so it is not an independent approval`,
so the citation is still recognised. Look-alike reports are not citations: `b.c` citing
`impl_bxc.md`, `d+e` citing `impl_dde.md`, `g^h` citing `impl_gh.md` and `ab2` citing
`impl_a\b2.md` all PASS. The 40,001-character forged target answers FAIL (cites) in under 1 s.
`ledger record ""` is accepted (pre-existing: `record` does not validate the target), and
`check ""` then PASSes.

Is there a second unescaped use on the path? `citesImplementingReport` (`src/roles.ts:174-183`)
still interpolates the slug unescaped, and its only other caller is the gate
(`src/gate.ts:421`, with `item.slug`). The gate cannot be crashed by a slug. `state add --slug 'api(v2'`
is refused (`'api(v2' is not a usable slug`, exit 2). A hand-edited `state.json` with slug
`api(v2`, status `done`, and a ledger row for `api(v2` makes the gate report
`[fail] .../state.json .items[0].slug must be kebab-case, got "api(v2"`, exit 1, with no regex
error, because `parseItem` validates `SLUG` (`src/state.ts:165`) before the closing audit runs.
`rg -n "new RegExp" src` shows no other pattern built from a slug or target (the rest are
`hooks.ts` constants, `pathclass.ts` globs and `statusline.ts` ANSI).

### D. Closing unaffected

I scripted `./bin/mstack ledger check <slug> <sha of its latest closing-role row>` over all 29
`done` items of this store: **29 PASS, 0 not passing**. Examples:
`statusline -> PASS test-verified at 32f02656 by review panel`,
`benchmark-hard-tier -> PASS test-verified at d6cc37b7 by reviewer`,
`hook-errors-leave-no-trace -> PASS test-verified at 9adb4b9b by reviewer`.
`./bin/mstack ledger check benchmark-harness a4e6c784d99536d39c132cb0d5e4d634ad34e9f2`:
`PASS test-verified at a4e6c784 by reviewer`, exit 0. In this store's 114 ledger rows, the number
of closing-role rows whose evidence `citesImplementingReport` recognises is **0**. The
`review_<slug>_r2.md` paths are not citations, because the prefix is `impl_`/`spec_`. So no real
closing row is discounted. I also compared all 105 `(target, sha)` pairs between `744226e`
(`git archive`) and HEAD: 105 of 105 give identical `passing` and identical `reason`.

### E. Prose

- `docs/wiki/The-Agents.md:165`: true. The edit stayed inside the sentence that was false, and
  it matches `agents/reviewer.md:99-101` and `skills/review/SKILL.md:50-52`.
- `docs/wiki/The-CLI.md:322-328`: true against table A. A rejection counts even when it cites the
  report (C1, C2, C7). When every closing-role row is an approval citing the report, `check`
  fails and says so, as the gate does (C4, X1, X3, X9). The author-only fallback (Y1) and the
  transcript at `:311-312` (Y1 prints the same shape) are unchanged and still true. The edit
  stayed inside the paragraph. Line 327 is not re-wrapped (about 170 characters); that is cosmetic.
- `rg -n -i "most favorable|most favourable|best row|by rank|best verdict|keeps the best|highest[- ]rank|favorable member" README.md CHANGELOG.md CONTRIBUTING.md docs skills agents hooks`:
  **no hits**. A wider search (`winning row|strongest|best-ranked|ranks? higher|outrank|preferring the|keeps? one (winning )?row`)
  found only `docs/wiki/The-Story.md:89`, `skills/understand/references/sources.md:24` and
  `skills/understand/references/sources/incidents.md:40`, all unrelated. Every other prose
  mention of `ledger check` or its labels (`agents/reviewer.md:36,99`,
  `skills/review/SKILL.md:38,44,50`, `skills/router/playbooks/resume.md:13`,
  `docs/wiki/The-Agents.md:145`, `Getting-Started.md:282`, `State-Files.md:66-71`,
  `Gates-and-Hooks.md:204-220`, which describes the gate (unchanged), and `CHANGELOG.md:259`) is
  still true.

### F. Mutants

I applied each mutant to `src/ledger.ts` through Bash with an exact-string replacement from a
saved copy of HEAD (M1 is the whole `5b2714c` file). Each was run with `node --test` and
`bun test` over `tests/ledger.test.ts tests/statusline.test.ts tests/mergegate.test.ts tests/cli.test.ts tests/gate.test.ts tests/verification.test.ts tests/roles.test.ts`
and then restored, with `git diff --quiet src/ledger.ts` true after each. The unmutated baseline
had 0 failures on both runtimes. Both runtimes killed the same tests in every case. `L:<n>` is
`tests/ledger.test.ts:<n>`, and `L:394/400` covers the four looped tests each.

| # | Mutant (exact edit in `src/ledger.ts`) | Killed by (node = bun) |
|---|---|---|
| R1 | remove the rejection exemption: `:164` `isRejection(e) \|\| citesImplementingReport(...)` -> `citesImplementingReport(...)` | 4: L:315, L:326, L:335, L:344 |
| R2 | remove the citation filter: `:164` -> `const closing = byCloser;` | 7: L:277, L:353, L:366, L:400 x4 |
| R3a | discounted approval PASSes again: `:199` `if (forged !== undefined) {` -> `if (false) {` | 5: L:353, L:400 x4 |
| R3b | discounted approval PASSes again: `:201` `passing: false` -> `passing: RANK[forged.verdict] >= RANK[min]` | 5: L:353, L:400 x4 |
| O13 | `:201` `passing: false` -> `passing: true` | 5: L:353, L:400 x4 |
| R4 | remove the escaping: `:161` -> `const literal = target;` | 5: L:394 (api(v2), L:400 (api(v2, x[1], a+b), L:407 |
| M13 | drop ` rejects this commit, whatever an implementing role recorded` (`:181`) | 5: L:154, L:315, L:326, L:335, L:344 |
| M16 | `:219` `, which does not clear ${min} (the author's own verdict)` -> `, which does not clear ${min}` | 1: L:170 |
| M1 | revert to best-by-rank (whole `5b2714c` file) | 22: L:154, L:170, L:176, L:194, L:203, L:212, L:231, L:238, L:248, L:255, L:264, L:277, L:315, L:326, L:335, L:344, L:353, L:366, L:400 x4 |
| M2a | latest of any role: `:162` -> `const byCloser = here;` | 5: L:170, L:176, L:231, L:248, L:353 |
| M2b | latest of any row: `:173` -> `const latest = here[here.length - 1];` | 11: L:170, L:176, L:231, L:248, L:277, L:353, L:366, L:400 x4 |
| O1 | `isRejection` only `verifier-failed` (`:163`) | 2: L:212, L:344 |
| O2 | exempt only `verifier-failed` from the filter (`:164`) | 1: L:344 |
| O5 | forged reason drops ` (evidence: ${forged.evidence})` (`:204`) | 1: L:353 |
| O6 | forged reason drops ` cites the implementer's own report` (`:204`) | 5: L:353, L:400 x4 |
| O7 | `:165` -> `const discounted: Entry[] = [];` | 5: L:353, L:400 x4 |
| O8 | discounted rows win over a genuine approval: `:173` -> `const latest = discounted.length > 0 ? undefined : closing[closing.length - 1];` | 2: L:277, L:366 |
| O9 | `:165` -> `const discounted = byCloser;` | **survives, equivalent**: `discounted` is read only when `closing` is empty, which means `byCloser` holds no rejection, so it equals `byCloser` there |
| O3 | `:198` `discounted[discounted.length - 1]` -> `discounted[0]` | **survives**: only changes which discounted row is named when there are several (cosmetic) |
| O4 | `:202` `best: forged,` -> `best: undefined,` | **survives**: nothing pins `best` in the forged branch. The status line would then show `verdict stale`/`unverified` instead of `<YELLOW>test-verified` (note 4) |
| O10 | `:161` escape class -> `/[.+()[\]]/g` (only the four tested groups) | **survives**: `$ ^ * ? { } \| \` are not pinned by a test (note 3). The real code handles them (section C, rung 5) |
| O11 | `:161` escape class drops `$` and `^`: `/[.*+?{}()\|[\]\\]/g` | **survives**, same reason |
| O14 | author-only fallback takes the latest row: `:211` -> `const best = here[here.length - 1]!;` | **survives**: no test pins best-by-rank among author rows, though the renamed L:57 says it does (note 1) |

`git status --short` was empty after the mutant run and at the end, apart from this report and my ledger row.

### G. Tests and scope

`git diff --numstat 744226e...HEAD -- tests src docs`: `tests/ledger.test.ts 115/1`, `src/ledger.ts 25/6`,
`docs/wiki/The-Agents.md 1/1`, `docs/wiki/The-CLI.md 4/2`. The only removed test line is the old
title `test("the strongest verdict at a SHA wins", () => {`. The renamed test's body and
assertions are byte-identical between `744226e` and HEAD, so nothing was weakened or deleted.
Round 2 changed no other file under `src`, `tests` or `docs`. `git diff --quiet 744226e HEAD -- src/roles.ts src/gate.ts src/cli.ts src/statusline.ts src/mergegate.ts src/closing.ts`
is true, and so is `git diff --stat 5b2714c...HEAD` for the same files. The runtime rules from
`CONTRIBUTING.md:45-54` hold: no new import, no `Bun.*`, type annotations only (`(e: Entry) =>`),
both runtimes green, no build step, no lockfile.

## Non-blocking notes

1. `tests/ledger.test.ts:57`: the renamed title "with no closing-role row, the strongest author
   row at a SHA is the answer" is false about its own body. Its rows come from `ci` and
   `reviewer`, which are both closing roles, and it passes because the latest closing row is the
   `live-verified` one. The author-only best-by-rank fallback that the title names is unpinned:
   mutant O14 survives on both runtimes. Fix: retitle it to what it pins ("a later stronger
   closing approval is the answer"). Then add an author-only test, for example implementer
   `live-verified` followed by implementer `type-check-only`, with
   `assert.equal(r.best?.verdict, "live-verified")`.
2. `src/ledger.ts:204`: the discounted-approval reason always says "cites the implementer's own
   report", even when the citation is `spec_<slug>.md` (X1). The gate says "the spec-author's own
   report" for the same ledger. `citesImplementingReport` returns the role, so the message could
   use it. The evidence is printed next to it, so nothing is hidden.
3. `tests/ledger.test.ts:393`: the metacharacter loop covers `( . [ ] +`. Mutants O10/O11 show
   that narrowing the escape class to those survives. The real code handles `$ ^ \` correctly
   (section C). Adding `a$`, `a|b` and `a*` to the loop would pin the rest.
4. `src/statusline.ts:152-155` (unchanged): a discounted approval renders as yellow
   `test-verified`. That is no longer green, but it does not say why, and the `best: forged` it
   relies on is unpinned (O4). It sits in the same family as the queued status-line follow-up
   about author-only verdicts.
5. `docs/wiki/The-CLI.md:327`: not re-wrapped (about 170 characters against the page's ~95).

## Suggested follow-ups

1. Gate: a closing-role rejection whose evidence cites the impl report is still dropped by
   `src/gate.ts:421-422`, so a genuine approval followed by such a rejection closes the item (C7:
   `check` FAIL, gate `[ok]`). This is round 1 follow-up 2, now visible from the other side.
   `check` is right and the gate is not. It is outside this item (`src/gate.ts` untouched) and in
   the safe direction for `check`. The fix is the same exemption in the gate's `legitimate` filter.
2. `ledger record` accepts an empty target (`recorded test-verified for  at 76d42d41`), and
   free-text targets generally. That predates this change; the regex crash it fed is now fixed.

## Residual risk accepted

- Author-only ledgers (Y1/Y2) still give `check` PASS, labelled "the author's own verdict, not an
  independent approval", where the gate refuses to close. I accept it: it is the recorded design
  (`.mstack/decisions.tsv:126`), it is unchanged since round 1, the label is in every reader that
  prints `reason`, and the status-line side is already queued. Round 2 introduced no new PASS/refuse pair.
- The tests leave three things unpinned: the author-only ranking (O14), the forged branch's
  `best` (O4), and part of the escape class (O10/O11). I accept it because each was checked at
  rung 5 on the real CLI, none can turn a rejection or a discounted approval into a PASS on a
  SLUG-valid item, and they are listed above with exact edits.

## Evidence ladder

Blockers resolved, acceptance 1 and 2, the agreement with the gate, the regex fix and closing
unaffected: rung 5. That is the real `./bin/mstack` (and the real gate and status line) run on
throwaway stores and on this repository's own store, with each run named above. Test coverage
is rung 4 (mutants on both runtimes, baseline green). "check PASS implies the latest independent
closing statement is an approval" is rung 3 (walked in section A) and is backed at rung 5 by the
case table. The merge-gate reader is rung 4 (`evaluate()` on the real case stores, not through `gh`).
