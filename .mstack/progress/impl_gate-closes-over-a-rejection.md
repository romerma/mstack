# impl: gate-closes-over-a-rejection (item 70)

## What changed

One function, `readVerdict(rows, slug)` in `src/ledger.ts`, now reads the verdict from a list of ledger rows and returns the deciding row and a kind: `approved`, `rejected`, `blocked`, `discounted` or `author-only`. `ledger check` (rows at one sha) and the gate's closed-item audit (every row of the item, file order) both call it; the gate's private copy of the rule (`src/gate.ts` old lines 411-448) is deleted. A `verifier-failed` from a role that can close an item stands until a later independent approval; it is never dropped for what its evidence cites; a `verifier-blocked` after it does not answer it (kind `rejected`, deciding row is the failure, `blockedAfter` names the blocked row). A lone `verifier-blocked` is kind `blocked`: the gate lets it close (escape hatch, unchanged), `ledger check` fails it (unchanged). `src/closing.ts` gets a second closing check, `ledger-verdict`, that refuses only kind `rejected`, non-overridable, so `state set --status done`, the gate on the active item at `verifying`, and the Stop hook (which carries gate failures) all refuse with the same message naming the row. Also: abbreviated shas (4-39 hex) are resolved through git by `record` and `check` (rows recorded with a 7+ char prefix, like `9b36340`, are matched as a prefix of the full sha by string, no git call); `record` refuses an empty/blank target; `check` names the spec-author when its report is cited; the status line gets the kind from `CheckResult.kind` (author-only yellow `(author only)`, discounted red `(not independent)`, independent green, no new git call); `citesImplementingReport` now escapes the slug itself.

Decisions recorded (`mstack decide --phase implement`, 4 rows): sha resolution and the short row; ledger-verdict check refuses only rejections and is not overridable; the old gate test that closed over failed-then-blocked was rewritten (it encoded the hole); status line labels.

## Files

- src/ledger.ts (readVerdict, describeRow, resolveSha, sameCommit, empty target, CheckResult.kind)
- src/gate.ts (audit calls readVerdict; message names the row)
- src/closing.ts (`ledger-verdict` check)
- src/roles.ts (escape slug inside citesImplementingReport)
- src/statusline.ts
- tests/verdict-reader.test.ts (new), tests/ledger-cli.test.ts (new), tests/gate.test.ts, tests/closing.test.ts, tests/ledger.test.ts, tests/statusline.test.ts
- docs/wiki/The-CLI.md, docs/wiki/Gates-and-Hooks.md, docs/wiki/Status-Line.md, CHANGELOG.md
- .mstack/decisions.tsv (4 rows), this report, .mstack/progress/current.md
- Not needed: src/cli.ts (the refusal reaches `state set` through CLOSING_CHECKS; `record` validation lives in ledger.ts), src/mergegate.ts (it already reads through `ledger.check`, hence through the reader).

Commits: d5956c9 red tests; ce436ae refactor (reader + check); 169a7f4 fix (gate + closing); a3d5e33 sha + empty target; 98c6c6e status line; 70292d3 test; d8b944e docs.

## Commands

```
$ npm run test:bun        -> 517 pass, 0 fail (Ran 517 tests across 25 files. [76.36s])   (480 before, +37)
$ npm run test:node       -> ℹ tests 517  ℹ pass 517  ℹ fail 0
$ npm run typecheck       -> clean
$ ./bin/mstack lint-plugin .                      -> PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 96 relative links checked, 0 broken
$ ./bin/mstack gate       -> [ok]    31 closed item(s) carry a ledger verdict ... PASSED - 0 failures (1 warning: uncommitted .mstack rows)
```
Red-first: at d5956c9 the new tests failed (gate: 2 red incl. the reproduced case; closing 1; ledger 5; ledger-cli 2; statusline 1; verdict-reader file failed to load). All green from 169a7f4/98c6c6e on.

### Closed items, before and after (31 done items, 107 distinct (target, sha) pairs, `./bin/mstack ledger check <slug> <sha>`)
`diff before.txt after.txt`: exactly one line differs, `hook-errors-leave-no-trace 9b36340`: `... at 9b36340 by implementer (...)` became `... at 9b36340a by implementer (...)` (the short sha is now resolved, same PASS, same exit). 84 exit 0, 23 exit 1, identical before and after. No already-closed item has a shape the new rule refuses; the gate is unchanged green. (`ledger check hook-errors-leave-no-trace <full 9b36340 sha>` used to say "no verdict at"; it now finds the short row.)

### Sequence table (throwaway store, real `./bin/mstack`; I=implementer R=reviewer T=test-verified F=verifier-failed B=verifier-blocked; evidence default `node --test tests`)
"state set done" = `state set demo --status done` at `verifying`; "gate" = `./bin/mstack gate` with the item then written as done in state.json. Kind = what readVerdict returns (asserted in tests/verdict-reader.test.ts for every row below).

| # | rows (file order) | kind | ledger check | state set done | gate (closed) |
|---|---|---|---|---|---|
| 1 | I:T | author-only | PASS (author's own) exit 0 | closes (existing behaviour) | FAIL `items closed on a verdict from the pass that wrote the code: demo (only implementer)` |
| 2 | I:T R:T | approved | `PASS test-verified at e97a130b by reviewer` | closes | `[ok] 1 closed item(s) carry a ledger verdict` |
| 3 | I:T R:F | rejected | `FAIL verifier-failed at 867d13cb by reviewer rejects this commit, whatever an implementing role recorded (evidence: node --test tests)` | exit 2 `mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 867d13cb by reviewer (evidence: node --test tests)` | `[fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: demo (reviewer): verifier-failed at 867d13cb by reviewer (evidence: node --test tests)` |
| 4 | R:F I:T | rejected | FAIL (same shape, names R:F) | exit 2 same | same fail |
| 5 | R:F R:T | approved | `PASS test-verified at a8dcdb94 by reviewer` | closes | ok |
| 6 | R:T R:F | rejected | FAIL | exit 2 | fail |
| 7 | I:T(impl) R:T R:F(cites impl_demo.md) [reproduced] | rejected | `FAIL verifier-failed at 435663b0 by reviewer rejects this commit, ... (evidence: .mstack/progress/review_demo_r2.md; the claims in impl_demo.md do not hold)` | exit 2 `demo cannot close: a rejection stands in the ledger: verifier-failed at 435663b0 by reviewer (evidence: ...r2.md; ...)` | fail naming the same row (was PASSED before this change) |
| 8 | I:T R:T(cites impl) | discounted | `FAIL test-verified at 28830b02 by reviewer cites the implementer's own report (evidence: .mstack/progress/impl_demo.md), so it is not an independent approval` | closes (existing) | `[fail]  items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)` |
| 9 | R:T(cites spec_demo.md) | discounted | `FAIL test-verified at 3689e7be by reviewer cites the spec-author's own report (evidence: .mstack/progress/spec_demo.md), so it is not an independent approval` (was "implementer's") | closes (existing) | `[fail]  items closed on a verdict whose evidence cites the spec-author's own report: demo (reviewer)` |
| 10 | R:F R:T(cites impl) | rejected | FAIL names R:F | exit 2 | fail |
| 11 | R:B | blocked | `FAIL verifier-blocked at 79c3390b by reviewer rejects this commit, ...` | closes (escape hatch) | ok |
| 12 | R:T R:B | blocked | FAIL verifier-blocked ... | closes | ok (unchanged) |
| 13 | R:F R:B (blocked-after-failed) | rejected | `FAIL verifier-failed at 91658016 by reviewer rejects this commit, ... (evidence: node --test tests); the later verifier-blocked by reviewer (evidence: node --test tests) does not answer it` | exit 2 `... a rejection stands in the ledger: verifier-failed at 91658016 by reviewer (evidence: node --test tests); the later verifier-blocked by reviewer does not answer it` | fail naming the failure (was ok before) |
| 14 | R:B R:F (failed-after-blocked) | rejected | FAIL names R:F | exit 2 | fail |
| 15 | R:T R:F R:B | rejected | FAIL, names F and the later B | exit 2 | fail (was ok before) |
| 16 | R:F R:B R:T | approved | `PASS test-verified at 0d368fe6 by reviewer` | closes | ok |
| 17 | F at OLDER sha, T at closing sha | approved (check reads the closing sha; gate reads all rows in file order, latest closing row is T) | `PASS test-verified at 2d227638 by reviewer` | closes | ok. Unchanged: the gate audits all shas in file order and does not contradict the acceptance, so I left it. |

Agreement of check and the gate on rejected/discounted is also a test over 17 sequences with the real `check` and the real gate (tests/verdict-reader.test.ts:87). Where they map the same kind differently it is documented: author-only (check PASS labelled, gate fail), blocked (check FAIL, gate ok).

### Mutant table (each applied alone, targeted suites run under bun AND node, then restored; `git status` shows no src/tests mutations)

| mutant | red tests (bun / node) |
|---|---|
| M1 restore the citation drop for rejections (in reader) | 8 / 9: reproduced-case reader test, agreement test, gate "rejection that cites the implementer's report" |
| M2 blocked after failed answers the rejection | 7 / 8: reader table rows, gate test, ledger tests |
| M3a gate keeps its own copy of the old citation drop | 2 / 3: agreement test, gate reproduced-case test |
| M3b gate lets a later blocked answer a failure (own copy) | 3 / 4: agreement test, old failed-then-blocked test, gate blocked-after-failed |
| M3c closing check lets a later blocked answer a failure | 1 / 2: closing.test.ts standing rejection |
| M4 drop sha resolution | 2 / 3: ledger check and record abbreviated tests (cli test too) |
| M5 accept the empty target | 2 / 3: lib and cli tests |
| M6 collapse author-only status line state | 1 / 2: three-state test |
| M6b collapse discounted state | 1 / 2: three-state test |
| M7 closing check not registered | 1 / 2: closing.test.ts |
| M8 closing check overridable | 1 / 2: closing.test.ts (--force) |
| M9 short rows no longer match | 1 / 2: short-row test |
| M10 spec-author naming reverted | 1 / 2 |
| M11 discounted rows count as closing | 19 / 20 |
| M12 drop the later-blocked clause from check's message | 1 / 2 (after adding a test; it survived first) |
First-pass survivors: my initial M3 (an equivalent mutant: filtering blocked rows leaves the same kind) and M12 (message clause untested); M3 was replaced with M3a/b/c, and M12 got tests/ledger.test.ts "verifier-blocked after a verifier-failed...". (node counts include one suite-level line per failing file.)

## R to test (acceptance bullets)

| # | Acceptance | Test | file:line |
|---|---|---|---|
| 1 | gate refuses a rejection citing impl_<slug>.md after a genuine approval | "a rejection that cites the implementer's report stands over an earlier genuine approval" | tests/gate.test.ts:1657 (and reader table row, tests/verdict-reader.test.ts) |
| 2 | verifier-blocked does not close over verifier-failed; lone blocked still closes; later independent approval closes | "a verifier-blocked row after a verifier-failed does not let the item close"; "a lone verifier-blocked row still closes..."; "a rejection followed by a later independent approval closes" | tests/gate.test.ts:1681, :1698, :1709 |
| 3 | one function; state set, gate and Stop surface refuse and name the row | "ledger check and the gate's closing audit agree on every sequence..."; "a standing rejection is refused by closingProblems, the gate and state set..." | tests/verdict-reader.test.ts:87; tests/closing.test.ts:194 |
| 4 | abbreviated sha resolved; empty target refused | "an abbreviated sha is resolved..."; "...given to ledger record is stored as the full sha"; "ledger record refuses an empty or blank target"; cli variants | tests/ledger.test.ts:417, :431, :468; tests/ledger-cli.test.ts:16, :32 |
| 5 | status line distinguishes the three | "an independent approval, an author-only verdict and a discounted approval are three different things" (+ author verifier-failed stays red) | tests/statusline.test.ts:531 |
| extra | spec-author named | "an approval that cites a spec-author's report names the spec-author..." | tests/ledger.test.ts:484 |

## Abbreviated shas and the short row
Chosen: resolve through git (rev-parse of `<hex>^{commit}`, only for 4-39 hex chars) in `record` (stores the full sha) and `check`; unknown or ambiguous: `record` refuses ("is not a commit in this repository"), `check` finds no row ("no verdict at"). The one short row (`hook-errors-leave-no-trace  9b36340`, ledger.tsv line 111) is untouched (append-only); `check` matches a row sha of 7+ hex chars as a prefix of the full sha by string comparison, and the gate never compared shas, so it still passes. Non-hex input such as `HEAD` is still passed through as before (not widened).

## Prose hits (`rg -n -i "verifier-blocked|escape hatch|cites the implementer|most favorable|latest closing|closing role|independent approval" README.md CHANGELOG.md CONTRIBUTING.md docs skills agents hooks`)
- CHANGELOG.md:249-250 (historic: escape hatch lives in the ledger as verifier-blocked): still true. New Unreleased entry added.
- README.md:166, docs/wiki/The-Story.md:49 (about pstack's design pass "escape hatch"): unrelated, still true.
- agents/reviewer.md:25 and :96 (verifier-blocked for what cannot be run): still true.
- agents/reviewer.md:100, skills/review/SKILL.md:50, docs/wiki/The-Agents.md:165 ("ledger check reads the latest closing-role row per (target, sha)... lens rows collapse to the last lens"): still true as stated for approvals (a later independent approval answers a rejection); a panel of lenses still must record nothing. Not edited.
- docs/wiki/Gates-and-Hooks.md:205-227: corrected (rule prose, real `[fail]` line and fix line pasted from the real gate; escape hatch sentence still true).
- docs/wiki/The-CLI.md:39-42 (verdict table), State-Files.md:92, evidence-ladder.md:40: still true.
- docs/wiki/The-CLI.md:304-330 (ledger check prose): corrected (sha resolution, empty target, standing rejection, blocked-after-failed, spec-author, state set refusal). The `PASS ... (the author's own verdict...)` sample is still true.
- docs/wiki/Gates-and-Hooks.md:426 (warn for empty verify, verifier-blocked): still true.
- docs/wiki/Status-Line.md: corrected (new states; file:line `src/statusline.ts:146-172`).
- docs/research/*.md: historical research, not edited.

## Findings and left undone
- `state set --status done` still closes author-only and discounted-approval ledgers (the gate then fails them). That is existing behaviour; acceptance only asks for the rejection; refusing those would change every flow that closes before its row exists. Recorded in the decision row; a candidate follow-up item.
- Gate message for blocked-after-failed names only the failing row (check and `state set` also name the later blocked row).
- The 3 known flaky tests (item 67) did not fail in these single-suite runs.
