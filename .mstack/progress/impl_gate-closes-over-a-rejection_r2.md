# Implementation report, round 2 - gate-closes-over-a-rejection (item 70)

Branch `fix/gate-closes-over-a-rejection`, last non-chore commit `9ddd23d72fedd6eb4d88e0217785401519c5ca84`.

## What changed

Three review blockers, red tests first. (1) The two sentences that called a `verifier-failed` row
"not itself a gate" now say it stands until a later independent approval at that commit and that
`state set --status done` (`--force` included) and the gate refuse it. (2) The `ledger-verdict`
closing check now reads the verdict AT the sha being closed through `readVerdict`, and keeps the
all-rows reading as well, so B-9r refuses and B-9s still refuses (naming that the row is at another
commit). (3) `readVerdict` discounts a `verifier-blocked` that cites the author's own report; only
`verifier-failed` stays exempt. The docs and CHANGELOG no longer say the surfaces "cannot disagree
about one ledger"; they say `ledger check` answers for one sha and closing also looks across the
item's rows.

Does an item record its closing commit? No. `closed_by` (`src/state.ts:34`, set at `src/cli.ts:585-620`)
is a free-text note, and the gate (`src/gate.ts:375-440`) has no sha for a `done` item. So the audit
of ALREADY closed items keeps the across-sha rule (a rejection at the closing sha followed by an
approval of an older commit still passes the audit once the item is closed, see case B9r gate line
below). No field added (item 40). The closing door, which knows `headSha`, is where B-9r is stopped.

## Files

- `src/closing.ts` (two-reading check, message suffix for another commit)
- `src/ledger.ts` (`isRejection` is `verifier-failed` only; `sameCommit` exported; comments)
- `tests/closing.test.ts`, `tests/gate.test.ts`, `tests/ledger.test.ts`
- `agents/reviewer.md`, `skills/review/SKILL.md`, `docs/wiki/Gates-and-Hooks.md`, `docs/wiki/The-CLI.md`, `CHANGELOG.md`
- this report, `.mstack/progress/current.md` untouched, ledger row appended.

Commits: `18594db` test (two-sha), `b1f3d06` test (blocked), `35b74e2` fix closing, `ddccd21` fix blocked,
`d9f5094` test (item 47 assertion, own commit, body cites the decision row), `603a058` docs, `9ddd23d` fix (message).

## Commands (real output, abridged to the lines that matter)

```
$ npm run test:bun      -> 529 pass, 0 fail, Ran 529 tests across 25 files. [79.22s]
$ npm run test:node     -> ℹ tests 529 / ℹ pass 529 / ℹ fail 0
$ npm run typecheck     -> (no output after tsc)
$ ./bin/mstack lint-plugin .                      -> PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 96 relative links checked, 0 broken
$ ./bin/mstack gate     -> [ok]    31 closed item(s) carry a ledger verdict / PASSED - 0 failures, 0 warnings
```
Before the changes, the new tests were red: `bun test tests/closing.test.ts` 2 fail (11 pass),
`tests/gate.test.ts tests/ledger.test.ts` 3 fail (125 pass). After the src changes one item 47
assertion went red (`tests/ledger.test.ts:346`), updated in `d9f5094`.
The three item-67 tests did not fail in my sequential runs.

## Findings answered

| # | Reproduced | What I did | Test / file:line |
|---|---|---|---|
| 1 prose | yes (`rg` showed `agents/reviewer.md:95`, `skills/review/SKILL.md:57`) | corrected both sentences, swept the repo | `./bin/mstack lint-plugin .` green; hits list below |
| 2 closing sha | yes, B-9r: old CLI `check` FAIL, `close [0]`, gate `[0]` | closing reads rows at `headSha()` through `readVerdict`, plus all rows | `tests/closing.test.ts:277` (B-9r, three surfaces + force), `:304` (B-9s refuses, says another commit, later approval closes), `:329` (fix-and-re-review closes), `:342` (implementer-only older row), `:355`; `src/closing.ts:95-122` |
| 3 blocked | yes, B-12: old CLI `close [0]`, gate `[0]` | `isRejection` is `verifier-failed` only | `tests/gate.test.ts:1724,1735,1749`; `tests/ledger.test.ts:507,515,525,535`; assertion updated `:346`; `src/ledger.ts:196-203` |

## Case table, real CLI in throwaway stores (old = `cde3c2b`, new = HEAD)

Per case: `ledger check` / `state set done` / `--force` / `gate` with the item done (by hand when refused).
Full output in the scratchpad `impl70r2/out-old.txt`, `out-new.txt`.

| case | old (`cde3c2b`) | new |
|---|---|---|
| B9r F@HEAD then T@HEAD~1 | check `[1] FAIL verifier-failed ... rejects this commit`; close `[0] 1 demo (done)`; gate `[0] [ok]    1 closed item(s)...` | check `[1] FAIL` same; close `[2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 35b019cc by reviewer (evidence: .mstack/progress/review_demo_r2.md)`; force `[2]` same; item stays verifying |
| B9r gate at verifying | `[ok]` PASSED, exit 0 | `[fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 2a723343 ...` FAILED, exit 1 |
| B9s T@HEAD then F@old | check `[0] PASS`; close `[2]`, gate `[1]` | check `[0] PASS test-verified at 37493b55 by reviewer`; close `[2] ... a rejection stands in the ledger: verifier-failed at 1126ef3a by reviewer (evidence: ...review_demo_r2.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it`; gate (by hand done) `[1] [fail] ... most recent closing verdict is verifier-failed` |
| B12 lone blocked citing impl_demo.md | check `[1] ... rejects this commit`; close `[0]`; gate `[0] [ok]` | check `[1] FAIL verifier-blocked at 131e9b1a by reviewer cites the implementer's own report (evidence: .mstack/progress/impl_demo.md), so it is not an independent approval`; close `[0]`; gate `[1] [fail]  items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)` |
| lone genuine blocked | check `[1]`, close `[0]`, gate `[0] [ok]` | identical |
| fix-and-re-review F@old, T@HEAD | check `[0] PASS`, close `[0]`, gate `[0]` | identical |
| original F citing impl_x after approval, one sha | close `[2]`, gate `[1]` | identical |
| B12c F then blocked citing impl | close `[2]`, gate `[1]` naming F | close `[2]` naming F (no "later blocked" clause: the blocked row is now discounted), gate `[1]` |
| B12d T then blocked citing impl | check `[1]`, close `[0]`, gate `[0]` | check `[0] PASS test-verified`, close `[0]`, gate `[0]` (the approval stays the answer, as decided) |

Note: in B9r the gate `[0]` after the item is forced done by hand remains: the audit of an already
closed item reads every row and an item records no closing commit. The refusal happens at `state set` and at the gate while
the item is at `verifying`, which is the only way an item closes through the CLI.

## Prose hits (the `rg` from the brief)

| hit | verdict |
|---|---|
| `agents/reviewer.md:95` "not itself a gate" | corrected |
| `skills/review/SKILL.md:56-57` same | corrected |
| `CHANGELOG.md:7` "cannot disagree about the same rows" | corrected (one function, different row sets, stated) |
| `docs/wiki/Gates-and-Hooks.md:216` "cannot disagree about one ledger" | corrected |
| `docs/wiki/Gates-and-Hooks.md:212,224,230`, `docs/wiki/The-CLI.md:331` blocked / "could not verify" | still true; blocked-citing-report sentence added in both |
| `CHANGELOG.md:10` lone blocked is the escape hatch | still true, qualified (unless it cites the implementer's report) |
| `CHANGELOG.md:261`, `README.md:166`, `docs/wiki/The-Story.md:49` "escape hatch" | still true (history of closed_by) |
| `skills/review/SKILL.md:42`, `docs/wiki/Skills-and-Playbooks.md:51-52`, `docs/wiki/The-Agents.md:158` "ledger"/"typed record" | still true (describe the ledger, not a rejection) |
| `docs/research/pstack-port.md:405,449` | still true (unrelated) |

`./bin/mstack lint-plugin .` PASSED and doc links 96/0 after the edits.

## Mutants (applied alone to `src/`, restored; bun and node over closing, gate, ledger, verdict-reader, ledger-cli, statusline, cli tests)

| mutant | bun / node failing | first failing test |
|---|---|---|
| M1 closing reads across shas only again | 1 / 1 | "a rejection at the closing sha is not answered by an approval of an older commit recorded after it" |
| M2 drop the across-sha rule | 1 / 1 | "a rejection recorded later against an older commit still refuses the close..." |
| M3 blocked exempt from discounting again | 4 / 4 | "a lone verifier-blocked row that cites the implementer's report does not close the item" |
| M4 discount verifier-failed too | 7 / 7 | "readVerdict: the reproduced case..."; "ledger check and the gate's closing audit agree on every sequence..." |
| M5 blocked lifts an earlier rejection | 8 / 8 | "readVerdict: blocked after failed does not answer it is rejected" |
| M6 gate drops a rejection citing impl (old rule) | 2 / 2 | "a rejection that cites the implementer's report stands over an earlier genuine approval" |
| M7 gate reads through a private copy (latest closing row) | 11 / 11 | "an item closed on a failed verifier is rejected" |

`git status --short` empty afterwards. Not re-run this round: round-1 mutants M4-M25 outside this table.

## This repository before / after

`./bin/mstack ledger check <target> <sha>` over all 110 distinct (target, sha) pairs of `.mstack/ledger.tsv`
(110 now, the reviewer counted 109), old CLI from a `git worktree` of `cde3c2b` (removed afterwards) vs HEAD:
`diff` is empty (85 PASS, 25 FAIL in both). `./bin/mstack gate` PASSED, 31 closed items carry a verdict.
No already-closed item's ledger has a shape the new rule refuses (the closing rule applies to items
being closed, the audit only gained the blocked-citing-report discount, which no row of this repository hits).

## Acceptance to test

| acceptance | test |
|---|---|
| 1 gate refuses a close over a rejection at the closing sha | `tests/gate.test.ts:1657`, `tests/closing.test.ts:194`, `:277` |
| 2 blocked does not close over an earlier failure | `tests/gate.test.ts:1681,1749`, `tests/closing.test.ts:194` |
| 3 one reader, and where the row sets differ | `tests/verdict-reader.test.ts:87`; `tests/closing.test.ts:277,304` (two shas) |
| 4 abbreviated sha, empty target | unchanged from round 1 (`tests/ledger.test.ts`, `tests/ledger-cli.test.ts`) |
| 5 status line states | unchanged (`tests/statusline.test.ts:531`) |

## Evidence rung

Rung 5 for the case table, ledger pairs and repository gate (real CLI, throwaway stores and this repository);
rung 4 for the suites and mutants. Not run: the Stop hook by hand (it calls the same `runGate` the gate
line above exercises); `claude plugin validate`.
