# Review - gate-closes-over-a-rejection

**Verdict:** APPROVED

Item 70, round 2, reviewing alone (no lens). Branch `fix/gate-closes-over-a-rejection`, head
`28122f69c38f41482a5cd4251e1ab30772ed4dbd` (last non-chore commit `9ddd23d`). Whole change
`7283bbe...HEAD`; round 2 `cde3c2b...HEAD`. I did not write this code or the round 1 review.
Everything below was run by me with `./bin/mstack` in this checkout, or with `git archive`
copies of HEAD, `cde3c2b` and `7283bbe` driven against throwaway stores under the session
scratchpad (`.../scratchpad/review70r2/`), and mutants in six scratch clones of HEAD. Nothing was run
by hand inside this repository except the read-only `gate`, `gate --full`, `ledger check` and
the doc-link script.

The three round 1 blockers are answered. No sequence I built closes through the CLI while the
latest independent closing-role statement at the sha being closed is a rejection: B-9r now
refuses at `state set` (with and without `--force`, and from `in_progress`, `cancelled` and
`blocked` with `--force`), at the gate on `verifying` and in the Stop hook. The normal
fix-and-re-review flow closes (A3, A5, and all 31 closed items of this repository re-evaluated
through the new closing check). A lone `verifier-blocked` citing `impl_demo.md` fails the gate
again, as at `7283bbe`. The corrected reviewer prose is true in every clause I ran. Residual
risks I accept are notes 1 to 3 of "Residual risks accepted, and non-blocking notes".

## Round 1 findings: resolved or not

| # | Round 1 finding | Resolved? | Evidence (my runs) |
|---|---|---|---|
| 1 | `agents/reviewer.md:94-95`, `skills/review/SKILL.md:56-57` said a `verifier-failed` row "is not itself a gate" | yes | both now read (`agents/reviewer.md:94-97`, `skills/review/SKILL.md:56-59`) "it stands until a later independent approval at that commit: `state set --status done` refuses it (`--force` included), the gate fails, and a later `verifier-blocked` does not lift it". Each clause run: refuses and `--force` exit 2 (A1, B7, C1); gate exit 1 at `verifying` and after a hand-edited `done` (A2, B7, C1); later blocked does not lift it, genuine (B7) or citing impl (B4) or at a newer commit (A9). Edit confined to that one sentence in each file; the two files say the same thing. One precision caveat (note 1 below) |
| 2 | closing judged a rejection across every sha, so B-9r closed with a passing gate; no two-sha test | yes, for every close the CLI can perform | B-9r (A1): `close [2]`, `force [2]`, gate at `verifying` `[1]`, Stop hook carries the line; `cde3c2b` and `7283bbe` both closed it (`close [0]`). B-9s (A2) refuses and says "it was recorded against another commit than the one being closed, and only a later independent approval answers it". Tests `tests/closing.test.ts:277` (B-9r, three surfaces and `--force`), `:304` (B-9s, then a later approval closes), `:329` (fix-and-re-review closes), `:342`, `:355`; mutants N1, N2, O1, O5, O6 die on both runtimes. The audit of an item already `done` keeps the across-sha reading (A1 `gate@d [0]` after a hand edit), as decided and documented |
| 3 | regression B-12: lone reviewer `verifier-blocked` citing `impl_demo.md` closed the item and passed the gate; `7283bbe` failed it | yes | B1: gate after `done` `[1] [fail]  items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)`, identical to `7283bbe`; `cde3c2b` gave `[ok]`. `ledger check` `FAIL verifier-blocked at 1063bd89 by reviewer cites the implementer's own report (...), so it is not an independent approval`. `state set` still closes it (`close [0]`), exactly as at `7283bbe` and `cde3c2b`: the known author-only/discounted split, not new. Tests `tests/gate.test.ts:1724`, `tests/ledger.test.ts:507`; mutant N3 dies |

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| 1 rejection at the closing sha refuses, whatever its evidence cites | `tests/gate.test.ts:1657`, `tests/closing.test.ts:194`, `:277`, `:355` | C1, A1, A11-A14 refuse on the real CLI; mutants N1, N4, N6, O5 red on bun and node |
| 1 the normal flow still closes | `tests/closing.test.ts:329`, `:304` (last two assertions), `tests/gate.test.ts:1709` | A3, A5 close; O6 red; 31 closed items re-evaluated: 0 refused |
| 2 blocked after failed at the same sha does not close | `tests/gate.test.ts:1681`, `:1749`, `tests/closing.test.ts:194`, `tests/ledger.test.ts:492`, `:525` | B4, B7, A9 refuse; N5 red |
| 2 lone genuine blocked still closes (escape hatch) | `tests/closing.test.ts:242`, `tests/gate.test.ts:1698`, `:1735` | B2 closes, gate `[ok]`; round 1 M13, M23 re-run red |
| 3 one reader | `tests/verdict-reader.test.ts:87`; two shas `tests/closing.test.ts:277`, `:304` | N6, N7a, N7b (private copies in the gate) red |
| 4 abbreviated sha, empty target | `tests/ledger.test.ts`, `tests/ledger-cli.test.ts` (unchanged in round 2) | suites green; live check below; M4a-c, M5, M9 re-run red |
| 5 status line states | `tests/statusline.test.ts:531` (unchanged in round 2) | live check below; M6a-d, M18 re-run red |

## Acceptance, quoted

**"the gate refuses to close when the latest closing-role row at the closing sha is a rejection, whatever its evidence cites; a test reproduces a genuine approval followed by a rejection citing impl_<slug>.md"** -
met. At one sha (C1: implementer T, reviewer T, reviewer F whose evidence names `impl_demo.md`):
`close [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at
b0937f32 by reviewer (evidence: .mstack/progress/review_demo_r2.md; the claims in impl_demo.md do
not hold)`, same with `--force`, gate at `verifying` exit 1, Stop hook carries the line;
`7283bbe` closed it. A rejection whose only evidence is `impl_demo.md` (A12) refuses too. At two
shas, which round 1 found open: B-9r (A1) refuses at every surface, and so do A11 (a discounted
approval at HEAD in between), A13 (an implementer approval of the older commit after it) and A14
(an `orchestrator` approval of the older commit after it); `cde3c2b` closed A1, A11 and A14. The
reproducing tests are `tests/gate.test.ts:1657` and `tests/closing.test.ts:194` (one sha) and
`tests/closing.test.ts:277`, `:355` (two shas). Where it stops: a close at a commit that carries no
row at all is judged by the across-row reading only (A6, A7, A15), unchanged from `7283bbe`
(note 2 below).

**"a verifier-blocked row does not let an item close over an earlier verifier-failed at the same sha, or the report shows why it should and the decision is recorded"** -
met. B7 (F, genuine B) and B4 (F, B citing `impl_demo.md`) refuse at `state set`, `--force`, the
gate at `verifying` and the Stop hook, and the gate fails after a hand-edited `done`; A9 (F at
HEAD~1, B at HEAD) refuses too, so a blocked row at the new commit does not lift an older
rejection. Tests `tests/gate.test.ts:1681`, `:1749`, `tests/closing.test.ts:194`,
`tests/ledger.test.ts:492`, `:525`; mutant N5 (blocked lifts it) dies on both runtimes.

**"ledger check and the gate's closing audit read the verdict through one function, so the two cannot disagree again on the same rows"** -
met. `rg -n "readVerdict\(" src` finds the definition (`src/ledger.ts:222`) and three callers:
`check` (`src/ledger.ts:296`), the closing check (`src/closing.ts:103`, `:110`) and the gate audit
(`src/gate.ts:421`); the status line and merge gate go through `check`. On the same rows they
agree (`tests/verdict-reader.test.ts:87`, and the closing check's at-sha reading is the same
filter `check` uses, `sameCommit`). They read different row sets on purpose, and
`docs/wiki/Gates-and-Hooks.md:213-222`, `docs/wiki/The-CLI.md:340-343` and `CHANGELOG.md:5-11` now
say so instead of "cannot disagree about one ledger". Mutants that give the gate its own copy
(N6 old citation drop, N7a latest row only, N7b round 1 blocked rule) each die.

**"an abbreviated sha given to ledger check or ledger record is resolved to the full commit or refused with a message, and ledger record refuses an empty target"** -
met. Round 2 did not touch this code (`git diff cde3c2b...HEAD -- src` changes only `isRejection`
and the `export` of `sameCommit` in `src/ledger.ts`), so as briefed I relied on the suites and one
live check instead of round 1's full probe. Live, throwaway store:
```
record [0] 55c0235 -> stored 55c02352d714dcaef15a411c4f4d3bcc0a4aa896
record [0] 55c02 -> stored 55c02352d714dcaef15a411c4f4d3bcc0a4aa896
record [2] deadbee0 -> mstack: deadbee0 is not a commit in this repository
record [2] '' -> mstack: a ledger row needs a target: the item slug it is a verdict about
check  [0] 55c0235 -> PASS test-verified at 55c02352 by implementer (the author's own verdict, not an independent approval)
```
Round 1's mutants M4a, M4b, M4c, M5, M9 re-run red on both runtimes; M10, M24, M25 still survive
(known).

**"the status line distinguishes an author-only verdict and a discounted approval from an independent approval"** -
met. Not touched in round 2; suites plus one live check (`NO_COLOR=1`, then colour with ESC as `~`):
```
author-only : Opus · fix/demo · #1 demo · verifying · test-verified (author only) · ctx 42%      ~[33mtest-verified (author only)
discounted  : Opus · fix/demo · #1 demo · verifying · test-verified (not independent) · ctx 42%  ~[31mtest-verified (not independent)
independent : Opus · fix/demo · #1 demo · verifying · test-verified · ctx 42%                    ~[32mtest-verified
```
A blocked row citing the report now renders `verifier-blocked (not independent)`, a genuine one
`verifier-blocked`. Round 1's M6a-M6d and M18 re-run red.

## Verification I ran

- `./bin/mstack gate` at `28122f6`: `[ok]    31 closed item(s) carry a ledger verdict`, `PASSED - 0 failures, 0 warnings`.
- `./bin/mstack gate --full` (store verify `npm test && npm run typecheck && bin/mstack lint-plugin .`):
  bun `529 pass`, `0 fail`, `Ran 529 tests across 25 files. [80.00s]`; node `ℹ tests 529`,
  `ℹ pass 529`, `ℹ fail 0`; `tsc --noEmit` silent; `lint-plugin` `PASSED - 0 failures, 0 warnings`;
  `[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .`; `PASSED - 0 failures, 0 warnings`,
  exit 0. None of the three item-67 tests failed in this run.
- `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`: `96 relative links checked, 0 broken`.
- `./bin/mstack ledger check gate-closes-over-a-rejection` before my row: `FAIL no verdict at
  28122f69; 3 row(s) exist at other SHAs and a new head SHA voids them`; at `4425f38` the round 1
  rejection still reads `FAIL verifier-failed at 4425f380 by reviewer rejects this commit ...`.

### E. This repository's history
- `git diff 7283bbe...HEAD --numstat -- .mstack/ledger.tsv` is `3 0`, one hunk `@@ -118,0 +119,3 @@`:
  the implementer row at `d8b944e`, the round 1 reviewer `verifier-failed` at `4425f38`, the
  implementer row at `9ddd23d`, appended. Nothing edited, reordered or removed. No row in the
  ledger is `verifier-blocked`, so the new blocked discount cannot change any closed item here.
- `ledger check <target> <sha>` over all 111 distinct pairs (the implementer reported 110; this count includes its
  row) with the `cde3c2b` CLI and with HEAD: 86 exit 0 and 25 exit 1 in both, `diff` empty. Against
  `7283bbe` the only difference is round 1's display line `9b36340` -> `9b36340a`.
- The new closing check run (through `closingProblems`, `src/closing.ts`, from the HEAD copy) on
  every one of the 31 closed items of this repository as if each were being closed now: `31
  closed items, 0 refused by ledger-verdict` (also 0 with `cde3c2b`). So every past
  fix-and-re-review of this repository would still close.

### A and B. The sequence tables, real CLI
Each case is a fresh store: `git init`, `bin/mstack setup` from the copy under test,
branch `fix/demo`, item `demo` walked to `verifying`, `current.md` naming it, five report files of
77 bytes, then three commits so `HEAD~2`, `HEAD~1` and `HEAD` exist; no `verify` command. Rows
are recorded with `ledger record demo <full sha> ...` in the order given. Per case, in this order:
`ledger check demo` (at HEAD); `gate` with the item at `verifying`; the Stop hook by hand
(`printf '{"session_id":"r70r2","transcript_path":"<store>/t.jsonl","cwd":"<store>","hook_event_name":"Stop","stop_hook_active":false}' | mstack hook stop`);
`state set demo --status done`; if refused, `--force --closed-by "review probe"`; if still not
`done`, `state.json` edited by hand to `done`; commit; `gate` again. The same script was run with
`git archive` copies of `cde3c2b` (round 1) and `7283bbe` (base). R = reviewer, I = implementer,
T = test-verified, F = verifier-failed, B = verifier-blocked. The table gives exit codes; the
exact lines follow it. Scripts: `.../scratchpad/review70r2/bin/{mkstore,seq,cases}`; raw output
`cases-new.txt`, `cases-cde3.txt`, `cases-old7283.txt` there.

| case | rows, in recorded order | check | gate@verifying | Stop hook | state set / --force | gate, item done | cde3c2b close / gate | 7283bbe close / gate |
|---|---|---|---|---|---|---|---|---|
| A1 | R:F@HEAD, then R:T@HEAD~1 (B-9r) | 1 | 1 | carries the line | 2 / 2 | 0 | 0 / 0 | 0 / 0 |
| A2 | R:T@HEAD, then R:F@HEAD~1 (B-9s) | 0 | 1 | carries the line | 2 / 2 | 1 | 2 / 1 | 0 / 1 |
| A3 | R:F@HEAD~1, then R:T@HEAD (fix and re-review) | 0 | 0 | silent | 0 | 0 | 0 / 0 | 0 / 0 |
| A4 | R:F@HEAD~1, R:T@HEAD, then R:F@HEAD~1 again | 0 | 1 | carries the line | 2 / 2 | 1 | 2 / 1 | 0 / 1 |
| A5 | R:F@HEAD, then R:T@HEAD (later round approves the same commit) | 0 | 0 | silent | 0 | 0 | 0 / 0 | 0 / 0 |
| A6 | R:T@HEAD~1, then I:T@HEAD (HEAD judged by no closing role) | 0 | 0 | silent | 0 | 0 | 0 / 0 | 0 / 0 |
| A7 | R:F@HEAD~2, R:T@HEAD~1, HEAD has no rows | 1 | 0 | silent | 0 | 0 | 0 / 0 | 0 / 0 |
| A8 | R:F@HEAD~1, then I:T@HEAD | 0 | 1 | carries the line | 2 / 2 | 1 | 2 / 1 | 0 / 1 |
| A9 | R:F@HEAD~1, then R:B@HEAD (genuine) | 1 | 1 | carries the line | 2 / 2 | 1 | 2 / 1 | 0 / 0 |
| A10 | R:B@HEAD, then R:F@HEAD~1 | 1 | 1 | carries the line | 2 / 2 | 1 | 2 / 1 | 0 / 1 |
| A11 | R:F@HEAD, R:T@HEAD citing impl, then R:T@HEAD~1 | 1 | 1 | carries the line | 2 / 2 | 0 | 0 / 0 | 0 / 0 |
| A12 | R:T@HEAD~1, then R:F@HEAD citing only impl_demo.md | 1 | 1 | carries the line | 2 / 2 | 1 | 2 / 1 | 0 / 0 |
| A13 | R:F@HEAD, then I:T@HEAD~1 | 1 | 1 | carries the line | 2 / 2 | 1 | 2 / 1 | 0 / 1 |
| A14 | R:F@HEAD, then orchestrator T@HEAD~1 | 1 | 1 | carries the line | 2 / 2 | 0 | 0 / 0 | 0 / 0 |

| case | rows, in recorded order | check | gate@verifying | Stop hook | state set / --force | gate, item done | cde3c2b close / gate | 7283bbe close / gate |
|---|---|---|---|---|---|---|---|---|
| B1 | R:B citing impl_demo.md, alone (B-12) | 1 | 0 | silent | 0 | 1 | 0 / 0 | 0 / 1 |
| B2 | R:B genuine (`no harness in this repo`), alone (escape hatch) | 1 | 0 | silent | 0 | 0 | 0 / 0 | 0 / 0 |
| B3 | R:T genuine, then R:B citing impl_demo.md | 0 | 0 | silent | 0 | 0 | 0 / 0 | 0 / 0 |
| B4 | R:F, then R:B citing impl_demo.md | 1 | 1 | carries the line | 2 / 2 | 1 | 2 / 1 | 0 / 1 |
| B5 | R:B citing spec_demo.md, alone | 1 | 0 | silent | 0 | 1 | 0 / 0 | 0 / 1 |
| B6 | I:T, then R:B citing impl_demo.md (B-12b) | 1 | 0 | silent | 0 | 1 | 0 / 0 | 0 / 1 |
| B7 | R:F, then R:B genuine | 1 | 1 | carries the line | 2 / 2 | 1 | 2 / 1 | 0 / 0 |
| B8 | R:B citing impl_demo.md, then R:T genuine | 0 | 0 | silent | 0 | 0 | 0 / 0 | 0 / 0 |

| case | rows, in recorded order | check | gate@verifying | Stop hook | state set / --force | gate, item done | cde3c2b close / gate | 7283bbe close / gate |
|---|---|---|---|---|---|---|---|---|
| C1 | I:T, R:T, R:F whose evidence names impl_demo.md (the reproduced case) | 1 | 1 | carries the line | 2 / 2 | 1 | 2 / 1 | 0 / 0 |

Exact lines, HEAD CLI (the shared hint after `->` is shortened to `(hint)`; `[n]` is the exit code; `stop` is the hook's additionalContext line):

```
### A1  R:F@HEAD, then R:T@HEAD~1 (B-9r)
  check  [1] FAIL verifier-failed at e8fff29b by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo_r2.md)
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at e8fff29b by reviewer (evidence: .mstack/progress/review_demo_r2.md)
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at e8fff29b by reviewer (evidence: .mstack/progress/review_demo_r2.md) -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at e8fff29b by reviewer (evidence: .mstack/progress/review_demo_r2.md)
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at e8fff29b by reviewer (evidence: .mstack/progress/review_demo_r2.md)
  gate@d [0] [ok]    1 closed item(s) carry a ledger verdict
### A2  R:T@HEAD, then R:F@HEAD~1 (B-9s)
  check  [0] PASS test-verified at 3a246939 by reviewer
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at ab4f99a7 by reviewer (evidence: .mstack/progress/review_demo_r2.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at ab4f99a7 by reviewer (evidence: .mstack/progress/review_demo_r2.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at ab4f99a7 by reviewer (evidence: .mstack/progress/review_demo_r2.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at ab4f99a7 by reviewer (evidence: .mstack/progress/review_demo_r2.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it
  gate@d [1] [fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: demo (reviewer): verifier-failed at ab4f99a7 by reviewer (evidence: .mstack/progress/review_demo_r2.md)
### A3  R:F@HEAD~1, then R:T@HEAD (fix and re-review)
  check  [0] PASS test-verified at 9997a57f by reviewer
  gate@v [0] (no ledger line)
  stop   [0] (no output)
  close  [0] 1 demo (done)
  gate@d [0] [ok]    1 closed item(s) carry a ledger verdict
### A4  R:F@HEAD~1, R:T@HEAD, then R:F@HEAD~1 again
  check  [0] PASS test-verified at f2c8c7f4 by reviewer
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at b226bf4c by reviewer (evidence: .mstack/progress/review_demo_r3.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at b226bf4c by reviewer (evidence: .mstack/progress/review_demo_r3.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at b226bf4c by reviewer (evidence: .mstack/progress/review_demo_r3.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at b226bf4c by reviewer (evidence: .mstack/progress/review_demo_r3.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it
  gate@d [1] [fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: demo (reviewer): verifier-failed at b226bf4c by reviewer (evidence: .mstack/progress/review_demo_r3.md)
### A5  R:F@HEAD, then R:T@HEAD (later round approves the same commit)
  check  [0] PASS test-verified at 8d603e38 by reviewer
  gate@v [0] (no ledger line)
  stop   [0] (no output)
  close  [0] 1 demo (done)
  gate@d [0] [ok]    1 closed item(s) carry a ledger verdict
### A6  R:T@HEAD~1, then I:T@HEAD (HEAD judged by no closing role)
  check  [0] PASS test-verified at 533a55df by implementer (the author's own verdict, not an independent approval)
  gate@v [0] (no ledger line)
  stop   [0] (no output)
  close  [0] 1 demo (done)
  gate@d [0] [ok]    1 closed item(s) carry a ledger verdict
### A7  R:F@HEAD~2, R:T@HEAD~1, HEAD has no rows
  check  [1] FAIL no verdict at 45f9bc2c; 2 row(s) exist at other SHAs and a new head SHA voids them
  gate@v [0] (no ledger line)
  stop   [0] (no output)
  close  [0] 1 demo (done)
  gate@d [0] [ok]    1 closed item(s) carry a ledger verdict
### A8  R:F@HEAD~1, then I:T@HEAD
  check  [0] PASS test-verified at ff5eec32 by implementer (the author's own verdict, not an independent approval)
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at dbea857e by reviewer (evidence: .mstack/progress/review_demo.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at dbea857e by reviewer (evidence: .mstack/progress/review_demo.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at dbea857e by reviewer (evidence: .mstack/progress/review_demo.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at dbea857e by reviewer (evidence: .mstack/progress/review_demo.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it
  gate@d [1] [fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: demo (reviewer): verifier-failed at dbea857e by reviewer (evidence: .mstack/progress/review_demo.md)
### A9  R:F@HEAD~1, then R:B@HEAD (genuine)
  check  [1] FAIL verifier-blocked at 6b4ed8da by reviewer rejects this commit, whatever an implementing role recorded (evidence: could not re-run the suite here)
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 50dc2209 by reviewer (evidence: .mstack/progress/review_demo.md); the later verifier-blocked by reviewer does not answer it; it was recorded against another commit than the one being closed, and only a later independent approval answers it
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 50dc2209 by reviewer (evidence: .mstack/progress/review_demo.md); the later verifier-blocked by reviewer does not answer it; it was recorded against another commit than the one being closed, and only a later independent approval answers it -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 50dc2209 by reviewer (evidence: .mstack/progress/review_demo.md); the later verifier-blocked by reviewer does not answer it; it was recorded against another commit than the one being closed, and only a later independent approval answers it
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 50dc2209 by reviewer (evidence: .mstack/progress/review_demo.md); the later verifier-blocked by reviewer does not answer it; it was recorded against another commit than the one being closed, and only a later independent approval answers it
  gate@d [1] [fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: demo (reviewer): verifier-failed at 50dc2209 by reviewer (evidence: .mstack/progress/review_demo.md)
### A10  R:B@HEAD, then R:F@HEAD~1
  check  [1] FAIL verifier-blocked at 8c2f9cea by reviewer rejects this commit, whatever an implementing role recorded (evidence: could not re-run the suite here)
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 37e348c1 by reviewer (evidence: .mstack/progress/review_demo.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 37e348c1 by reviewer (evidence: .mstack/progress/review_demo.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 37e348c1 by reviewer (evidence: .mstack/progress/review_demo.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 37e348c1 by reviewer (evidence: .mstack/progress/review_demo.md); it was recorded against another commit than the one being closed, and only a later independent approval answers it
  gate@d [1] [fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: demo (reviewer): verifier-failed at 37e348c1 by reviewer (evidence: .mstack/progress/review_demo.md)
### A11  R:F@HEAD, R:T@HEAD citing impl, then R:T@HEAD~1
  check  [1] FAIL verifier-failed at 06b1fd38 by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md)
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 06b1fd38 by reviewer (evidence: .mstack/progress/review_demo.md)
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 06b1fd38 by reviewer (evidence: .mstack/progress/review_demo.md) -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 06b1fd38 by reviewer (evidence: .mstack/progress/review_demo.md)
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 06b1fd38 by reviewer (evidence: .mstack/progress/review_demo.md)
  gate@d [0] [ok]    1 closed item(s) carry a ledger verdict
### A12  R:T@HEAD~1, then R:F@HEAD citing only impl_demo.md
  check  [1] FAIL verifier-failed at 5f7ab1ce by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/impl_demo.md)
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 5f7ab1ce by reviewer (evidence: .mstack/progress/impl_demo.md)
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 5f7ab1ce by reviewer (evidence: .mstack/progress/impl_demo.md) -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 5f7ab1ce by reviewer (evidence: .mstack/progress/impl_demo.md)
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 5f7ab1ce by reviewer (evidence: .mstack/progress/impl_demo.md)
  gate@d [1] [fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: demo (reviewer): verifier-failed at 5f7ab1ce by reviewer (evidence: .mstack/progress/impl_demo.md)
### A13  R:F@HEAD, then I:T@HEAD~1
  check  [1] FAIL verifier-failed at cc84713b by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md)
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at cc84713b by reviewer (evidence: .mstack/progress/review_demo.md)
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at cc84713b by reviewer (evidence: .mstack/progress/review_demo.md) -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at cc84713b by reviewer (evidence: .mstack/progress/review_demo.md)
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at cc84713b by reviewer (evidence: .mstack/progress/review_demo.md)
  gate@d [1] [fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: demo (reviewer): verifier-failed at cc84713b by reviewer (evidence: .mstack/progress/review_demo.md)
### A14  R:F@HEAD, then orchestrator T@HEAD~1
  check  [1] FAIL verifier-failed at 9ac674bf by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md)
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 9ac674bf by reviewer (evidence: .mstack/progress/review_demo.md)
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 9ac674bf by reviewer (evidence: .mstack/progress/review_demo.md) -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 9ac674bf by reviewer (evidence: .mstack/progress/review_demo.md)
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 9ac674bf by reviewer (evidence: .mstack/progress/review_demo.md)
  gate@d [0] [ok]    1 closed item(s) carry a ledger verdict
### B1  R:B citing impl_demo.md, alone (B-12)
  check  [1] FAIL verifier-blocked at 1063bd89 by reviewer cites the implementer's own report (evidence: .mstack/progress/impl_demo.md), so it is not an independent approval
  gate@v [0] (no ledger line)
  stop   [0] (no output)
  close  [0] 1 demo (done)
  gate@d [1] [fail]  items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)
### B2  R:B genuine (`no harness in this repo`), alone (escape hatch)
  check  [1] FAIL verifier-blocked at c81d06fe by reviewer rejects this commit, whatever an implementing role recorded (evidence: no harness in this repo)
  gate@v [0] (no ledger line)
  stop   [0] (no output)
  close  [0] 1 demo (done)
  gate@d [0] [ok]    1 closed item(s) carry a ledger verdict
### B3  R:T genuine, then R:B citing impl_demo.md
  check  [0] PASS test-verified at 11d036db by reviewer
  gate@v [0] (no ledger line)
  stop   [0] (no output)
  close  [0] 1 demo (done)
  gate@d [0] [ok]    1 closed item(s) carry a ledger verdict
### B4  R:F, then R:B citing impl_demo.md
  check  [1] FAIL verifier-failed at 677eac4f by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md)
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 677eac4f by reviewer (evidence: .mstack/progress/review_demo.md)
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 677eac4f by reviewer (evidence: .mstack/progress/review_demo.md) -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 677eac4f by reviewer (evidence: .mstack/progress/review_demo.md)
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 677eac4f by reviewer (evidence: .mstack/progress/review_demo.md)
  gate@d [1] [fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: demo (reviewer): verifier-failed at 677eac4f by reviewer (evidence: .mstack/progress/review_demo.md)
### B5  R:B citing spec_demo.md, alone
  check  [1] FAIL verifier-blocked at 3890233e by reviewer cites the spec-author's own report (evidence: .mstack/progress/spec_demo.md), so it is not an independent approval
  gate@v [0] (no ledger line)
  stop   [0] (no output)
  close  [0] 1 demo (done)
  gate@d [1] [fail]  items closed on a verdict whose evidence cites the spec-author's own report: demo (reviewer)
### B6  I:T, then R:B citing impl_demo.md (B-12b)
  check  [1] FAIL verifier-blocked at 968e3307 by reviewer cites the implementer's own report (evidence: .mstack/progress/impl_demo.md), so it is not an independent approval
  gate@v [0] (no ledger line)
  stop   [0] (no output)
  close  [0] 1 demo (done)
  gate@d [1] [fail]  items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)
### B7  R:F, then R:B genuine
  check  [1] FAIL verifier-failed at 5aad0c3c by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md); the later verifier-blocked by reviewer (evidence: could not re-run the suite here) does not answer it
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 5aad0c3c by reviewer (evidence: .mstack/progress/review_demo.md); the later verifier-blocked by reviewer does not answer it
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at 5aad0c3c by reviewer (evidence: .mstack/progress/review_demo.md); the later verifier-blocked by reviewer does not answer it -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 5aad0c3c by reviewer (evidence: .mstack/progress/review_demo.md); the later verifier-blocked by reviewer does not answer it
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 5aad0c3c by reviewer (evidence: .mstack/progress/review_demo.md); the later verifier-blocked by reviewer does not answer it
  gate@d [1] [fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: demo (reviewer): verifier-failed at 5aad0c3c by reviewer (evidence: .mstack/progress/review_demo.md)
### B8  R:B citing impl_demo.md, then R:T genuine
  check  [0] PASS test-verified at 0549571d by reviewer
  gate@v [0] (no ledger line)
  stop   [0] (no output)
  close  [0] 1 demo (done)
  gate@d [0] [ok]    1 closed item(s) carry a ledger verdict
### C1  I:T, R:T, R:F whose evidence names impl_demo.md (the reproduced case)
  check  [1] FAIL verifier-failed at b0937f32 by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo_r2.md; the claims in impl_demo.md do not hold)
  gate@v [1] [fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at b0937f32 by reviewer (evidence: .mstack/progress/review_demo_r2.md; the claims in impl_demo.md do not hold)
  stop   [0] 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at b0937f32 by reviewer (evidence: .mstack/progress/review_demo_r2.md; the claims in impl_demo.md do not hold) -> (hint)
  close  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at b0937f32 by reviewer (evidence: .mstack/progress/review_demo_r2.md; the claims in impl_demo.md do not hold)
  force  [2] mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at b0937f32 by reviewer (evidence: .mstack/progress/review_demo_r2.md; the claims in impl_demo.md do not hold)
  gate@d [1] [fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: demo (reviewer): verifier-failed at b0937f32 by reviewer (evidence: .mstack/progress/review_demo_r2.md; the claims in impl_demo.md do not hold)
```

Reading the A table. No row closes through the CLI over a rejection that stands at HEAD among
independent closing-role rows (A1, A11-A14, B4, B7, C1 all refuse at `state set`, `--force`, the
gate at `verifying` and the Stop hook). The normal flow closes (A3) and a later round approving
the same commit closes (A5). B-9s (A2), A4, A8 and A10 refuse by the across-row rule, and the
message says the row is at another commit and what answers it. A6 and A7 (and A15 below) close on
a commit no closing role judged; identical at `7283bbe` and `cde3c2b`, so not worse. A1, A11 and
A14 forced to `done` by hand then pass the audit: the documented limit (the audit reads every row
because an item records no closing commit). The CLI cannot produce that state: on a fresh A1
store I also tried `--status done --force --closed-by ...` from `in_progress`, `cancelled` and
`blocked`, and each gave `[2] mstack: demo cannot close: a rejection stands in the ledger:
verifier-failed at 7137154c by reviewer (...)`; `src/cli.ts:531` is the only code that sets
`done` and it always runs `closingProblems`.

Reading the B table. B1 and B6 (blocked citing `impl_demo.md`) and B5 (citing `spec_demo.md`):
`ledger check` fails with the not-independent wording, the gate fails once the item is done
(`items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)`,
or `the spec-author's own report`), as at `7283bbe`; `state set` closes them, as at both older
versions (the known split for discounted ledgers). B2, the genuine lone blocked: `check` FAIL
`verifier-blocked at c81d06fe by reviewer rejects this commit, whatever an implementing role
recorded (evidence: no harness in this repo)`, the gate passes at `verifying` and after `done`,
`state set` closes: exactly what `docs/wiki/The-CLI.md:332-334` says ("A lone
`verifier-blocked` fails the check (nothing was verified) but is what the gate accepts"), and
pinned by `tests/closing.test.ts:242`, `tests/gate.test.ts:1698` and `:1735`, which round 1's
M13 and M23 (re-run below) turn red. B3, a genuine approval then a blocked row citing the report:
the approval stays the answer (`check` PASS, closes); `cde3c2b` and `7283bbe` made `check` FAIL
there, so this is a behaviour change of `ledger check` (and so of merge-gate and the status line),
the one decision row 133 asked for. B4: the rejection stands, and the blocked row is no longer
named as a later answer attempt (it is discounted).

Extra probes on the HEAD CLI:
```
### A15  R:F@HEAD~1, then R:T@HEAD~2 recorded later; HEAD (one more commit) has no rows
  check   [1] FAIL no verdict at 2a68cacf; 2 row(s) exist at other SHAs and a new head SHA voids them
  gate@v  [0]
  stop    [0] (no output)
  close   [0] 1 demo (done)
  gate@d  [0] [ok]    1 closed item(s) carry a ledger verdict
  (7283bbe: identical, close [0], gate [0])
### the B-9r ordering with the rejection typed as a non-canonical sha (rejection at HEAD, then R:T@HEAD~1)
  typed 'HEAD'      -> stored HEAD      check [1] FAIL no verdict at 12d5ac2c; 2 row(s) exist at other SHAs ...   close [0] 1 demo (done)
  typed upper-case  -> stored 819997941C6A50E05FE2BA35895422BE6C7D6203   check [1] FAIL no verdict at 81999794; ...   close [0] 1 demo (done)
  typed 'fix/demo'  -> stored fix/demo  check [1] FAIL no verdict at 9b76988d; ...   close [0] 1 demo (done)
```
These are notes 2 and 3 of "Residual risks accepted, and non-blocking notes".

### C. The prose
`agents/reviewer.md:94-97` and `skills/review/SKILL.md:56-59` (identical claim; "your" vs "the"),
each clause against a run:
- "it stands until a later independent approval at that commit": true for `ledger check` at that
  commit, and A5 (approval at the same commit) closes. For closing it is narrower than the
  behaviour: an approval at another commit recorded later also answers it (A3, the normal flow;
  A15, an older commit). See note 1 below.
- "`state set --status done` refuses it (`--force` included)": A1, B7, C1 `[2]` / `[2]`.
- "the gate fails": at `verifying` `[1]` (A1, B7, C1) and with the item done `[1]` (B7, C1).
- "a later `verifier-blocked` does not lift it": B7 (genuine), B4 (citing impl), A9 (at a newer commit).

The edits replaced exactly the one false clause in each file (`git diff cde3c2b...HEAD --
agents skills` is 4 lines each); the panel sentences next to them (`agents/reviewer.md:101-104`,
`skills/review/SKILL.md:47-52`) are untouched and still true. `docs/wiki/The-Agents.md:164` says
only which verdict to record and makes no gating claim, so the three agree.

Sentences this item wrote, run:
- `docs/wiki/Gates-and-Hooks.md:213-214` "A `verifier-blocked` whose evidence cites the
  implementer's own report is discounted ... so it is not the escape hatch": B1 gate after done
  `[1] [fail]  items closed on a verdict whose evidence cites the implementer's own report`. True.
- `:214-222` one function, different rows; `state set` and the gate at `verifying` refuse at the
  closing sha or on a later unanswered rejection at another sha, `--force` included; the audit
  reads every row because an item records no closing commit; "So `ledger check` can pass at a sha
  where closing still refuses": A1, A2, A4, A8 (check `[0]`, close `[2]`), A1 hand-edited `[0]`. True.
- `docs/wiki/The-CLI.md:338-343`: B1 check wording; A2 (`check` PASS, close refused). True.
- `docs/wiki/The-CLI.md:332-334` (round 1, lone blocked fails `check`, gate accepts it): B2. True.
- `docs/wiki/Status-Line.md:23` (round 1): the live check above. True.
- `CHANGELOG.md:5-20`: one function and no private copy (rg above); the three row sets; the
  blocked escape hatch "unless its evidence cites the implementer's own report" (B1, B2); `state set`
  names the row (A1); "still passes for all 31 closed items" (gate). True. The headline "no longer
  lets an item close, or stay closed, over a standing rejection" is qualified two lines later by
  "the audit of an already closed item reads every row" (note 4 below).

The sweep `rg -n -i "not itself a gate|is not a gate|typed record of|does not block|could not
verify|escape hatch|cannot disagree|same answer|one ledger|closing sha|another commit" README.md
CHANGELOG.md CONTRIBUTING.md docs skills agents hooks`, every hit read: `CHANGELOG.md:14` true
(B1, B2); `CHANGELOG.md:266`, `README.md:166`, `docs/wiki/The-Story.md:49` are about `closed_by` and
pstack, unrelated and true; `docs/wiki/Gates-and-Hooks.md:212, 214, 229, 235` true (B7, B1, B2);
`skills/review/SKILL.md:42` ("One ledger row per review round") and `:56` true; `docs/wiki/The-CLI.md:331,
339, 342` true (B7, B1, A2); `docs/wiki/Skills-and-Playbooks.md:51-52`, `docs/wiki/State-Files.md:109`,
`docs/wiki/The-Agents.md:158` describe the ledger, true; `docs/research/pstack-port.md:405, 449` are
pstack research notes, unrelated. No "not itself a gate", "cannot disagree", "same answer" or
"closing sha" is left anywhere. `agents/reviewer.md` has no hit only because "typed\n record"
breaks across a line; I read it above. In `src/`, "cannot disagree about the same rows"
(`src/gate.ts:410`, `src/ledger.ts:207`) is qualified by "the same rows" and true.

### D. The changed item 47 assertion
`git diff cde3c2b...HEAD -- tests | rg "^-[^-]"` is two lines: the title and the one assertion of
`tests/ledger.test.ts:346`. Before: `passing === false` and `/verifier-blocked.*reviewer rejects
this commit/`. After: `passing === false`, `/verifier-blocked.*reviewer cites the implementer's
own report/` and `/not an independent approval/`. The pass/fail assertion is kept and the wording
follows the decided rule: decision row 133 (`.mstack/decisions.tsv`, "item 70 round 2") ends "The
item 47 wording assertion for a blocked row citing the author's report changes with it", and
`d9f5094` changes only that test, its body citing the row. Not a weakening; mutant N3 (blocked
exempt from discounting again) turns it red. Every other round 2 test change is appended
(`tests/closing.test.ts` +113, `tests/gate.test.ts` +39, `tests/ledger.test.ts` +36).

### G. Scope and rules
`git diff --stat cde3c2b...HEAD -- src/cli.ts src/statusline.ts src/mergegate.ts src/roles.ts
src/state.ts src/tsv.ts src/hooks.ts src/gate.ts package.json hooks/hooks.json` is empty. Round 2
touched `src/closing.ts`, `src/ledger.ts`, three test files, `agents/reviewer.md`,
`skills/review/SKILL.md`, `docs/wiki/Gates-and-Hooks.md`, `docs/wiki/The-CLI.md`, `CHANGELOG.md`
and `.mstack/` chores. The only new import is `sameCommit`; no `Bun.` in `src/`; no new dependency;
both runtimes green. The closing check now calls `headSha` once per `state set --status done` and
per gate run on a `verifying` item (the Stop hook included); the status line does not run closing
checks, so it gains no git call. No new console block was pasted into the docs in round 2.

### F. Mutants
Each mutant is an exact-string replacement (refused unless the string occurs once) applied to
`src/` of a scratch clone of HEAD `28122f6`, then `bun test` and `node --experimental-strip-types
--test` over `tests/{verdict-reader,gate,closing,ledger,ledger-cli,statusline,mergegate,roles,cli}.test.ts`,
then `git checkout -- src`. Baseline of that set: bun `245 pass`, `0 fail`; node `ℹ tests 245`,
`ℹ pass 245`, `ℹ fail 0`. Counts are failing tests per runtime. N = the mutants the brief asked for;
O = mine on the round 2 lines of `src/closing.ts` and `src/ledger.ts`; M = round 1's set re-run in
full on the round 2 code (round 2 touched the lines or the logic of M1a, M2a/b, M7, M8, M9, M12,
M13, M15, M16, M19, M20, M21, M23, M25; I re-ran all of them rather than pick). Scripts and raw
output: `.../scratchpad/review70r2/scripts/{r2mutants,r1all}.mjs`, `mutout/`. N5, N6, N7a and N8 are
round 1's M2a, M1b, M3 and M7, so those four are not repeated in the M rows.

| mutant | bun / node failing tests | killed by (first two, bun) |
|---|---|---|
| N1 closing reads across shas only (no at-sha reading) | 1 / 1 | "a rejection at the closing sha is not answered by an approval of an older commit recorded after it" |
| N2 drop the across-sha rule (at-sha only) | 1 / 1 | "a rejection recorded later against an older commit still refuses the close, and says it is at another commit" |
| N3 exempt blocked rows from discounting again | 4 / 4 | "a lone verifier-blocked row that cites the implementer's report does not close the item"; "a verifier-blocked row that cites the implementer's report still fails, as not independent" |
| N4 discount verifier-failed rows too | 7 / 7 | "readVerdict: the reproduced case: approval then a rejection citing the implementer's report is rejected"; "ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict" |
| N5 a blocked row lifts an earlier rejection | 8 / 8 | "readVerdict: blocked after failed does not answer it is rejected"; "readVerdict: approval, failed, blocked is rejected" |
| N6 gate drops a closing rejection citing impl before reading (old private rule) | 3 / 3 | "ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict"; "a closing row citing the implementer's own report does not close the item" |
| N7a gate reads through a private copy: only the latest closing row | 7 / 7 | "ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict"; "an item closed on a failed verifier is rejected" |
| N7b gate reads through a private copy of the round-1 rule (blocked never discounted) | 1 / 1 | "a lone verifier-blocked row that cites the implementer's report does not close the item" |
| N8 --force gets past the ledger-verdict check | 2 / 2 | "a standing rejection is refused by closingProblems, the gate and state set, and named in each"; "a rejection at the closing sha is not answered by an approval of an older commit recorded after it" |
| O1 the at-sha reading wins whenever rows exist at the closing sha | 1 / 1 | "a rejection recorded later against an older commit still refuses the close, and says it is at another commit" |
| O2 an at-sha rejection is worded as at another commit | 0 / 0 | **SURVIVES** |
| O3 the another-commit clause is dropped | 1 / 1 | "a rejection recorded later against an older commit still refuses the close, and says it is at another commit" |
| O4 at-sha rows by exact string only (no legacy prefix match) | 0 / 0 | **SURVIVES** |
| O5 at-sha rows inverted (every other sha) | 3 / 3 | "a rejection at the closing sha is not answered by an approval of an older commit recorded after it"; "a rejection recorded later against an older commit still refuses the close, and says it is at another commit" |
| O6 across reading skips the rows at the closing sha | 2 / 2 | "a rejection recorded later against an older commit still refuses the close, and says it is at another commit"; "a rejection at an older commit followed by an approval at the closing sha recorded later closes" |
| O7 at-sha reading only refuses a rejection with no blocked row after it | 0 / 0 | **SURVIVES** |
| O8 a blocked row citing the spec-author's report is not discounted | 0 / 0 | **SURVIVES** |
| M1a reader drops a rejection that cites impl | 7 / 7 | "readVerdict: the reproduced case: approval then a rejection citing the implementer's report is rejected"; "ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict" |
| M2b closing check: blocked after failed closes | 1 / 1 | "a standing rejection is refused by closingProblems, the gate and state set, and named in each" |
| M2c gate audit: blocked after failed closes (private copy drifts) | 3 / 3 | "ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict"; "an item closed on a failed verifier is rejected" |
| M4a drop sha resolution everywhere | 2 / 2 | "an abbreviated sha is resolved to the full commit by ledger check"; "an abbreviated sha given to ledger record is stored as the full sha" |
| M4b drop sha resolution in check only | 2 / 2 | "an abbreviated sha is resolved to the full commit by ledger check"; "ledger check answers at an abbreviated sha, and ledger record stores the full one" |
| M4c drop sha resolution in record only | 1 / 1 | "an abbreviated sha given to ledger record is stored as the full sha" |
| M5 accept the empty target | 2 / 2 | "ledger record refuses an empty or blank target"; "ledger record refuses an empty target at exit 2 and says what to pass" |
| M6a status line: collapse author-only | 1 / 1 | "an independent approval, an author-only verdict and a discounted approval are three different things" |
| M6b status line: collapse discounted | 1 / 1 | "an independent approval, an author-only verdict and a discounted approval are three different things" |
| M6c status line: collapse all three (both) | 1 / 1 | "an independent approval, an author-only verdict and a discounted approval are three different things" |
| M6d status line: labels kept, colours collapsed to the old ones | 1 / 1 | "an independent approval, an author-only verdict and a discounted approval are three different things" |
| M8 ledger-verdict removed from CLOSING_CHECKS | 4 / 4 | "a standing rejection is refused by closingProblems, the gate and state set, and named in each"; "a rejection at the closing sha is not answered by an approval of an older commit recorded after it" |
| M9 short legacy rows no longer match | 1 / 1 | "a row recorded with a short sha before sha resolution existed is still found at its full sha" |
| M10 abbreviations of 4-6 chars not resolved | 0 / 0 | **SURVIVES** |
| M11 reader keeps the FIRST unanswered failure | 0 / 0 | **SURVIVES** |
| M12 lone blocked reads as approved | 5 / 5 | "readVerdict: a lone blocked row is blocked"; "readVerdict: approval then blocked is blocked" |
| M13 closing check also refuses a lone blocked | 1 / 1 | "a lone verifier-blocked row does not stop state set from closing" |
| M14 gate message no longer names the row | 2 / 2 | "a rejection that cites the implementer's report stands over an earlier genuine approval"; "a verifier-blocked row after a verifier-failed does not let the item close" |
| M15 closing check unreadable ledger becomes overridable | 0 / 0 | **SURVIVES** |
| M16 closing check swallows an unreadable ledger | 0 / 0 | **SURVIVES** |
| M17 citesImplementingReport no longer escapes the slug | 6 / 6 | "readVerdict of no rows is undefined, and a target with regex metacharacters is read literally"; "a target with regex metacharacters (api(v2) gets an ordinary answer" |
| M18 status line: author verifier-failed labelled author only | 1 / 1 | "an author's own verifier-failed stays a plain red failure, not an author-only label" |
| M19 check drops the later-blocked clause | 1 / 1 | "a verifier-blocked after a verifier-failed fails the check, naming the failure and saying the blocked row does not answer it" |
| M20 closing message drops the later-blocked clause | 0 / 0 | **SURVIVES** |
| M21 check reads every row of the target, any sha | 6 / 6 | "a new head SHA voids the row, and says so"; "rows at another sha only keep the unchanged stale message" |
| M22 discounted spec-author named as implementer | 1 / 1 | "an approval that cites a spec-author's report names the spec-author, not the implementer" |
| M23 gate audit fails a lone verifier-blocked | 3 / 3 | "ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict"; "a lone verifier-blocked row still closes an item nothing can verify" |
| M24 resolveSha drops the ^{commit} peel | 0 / 0 | **SURVIVES** |
| M25 sameCommit compares case-sensitively | 0 / 0 | **SURVIVES** |

Every kill is on both runtimes with the same count. Two bun-only failures I saw first (O7, O8:
`ledger check and the gate's closing audit agree on every sequence` "timed out after 5000ms",
8.5 s under six parallel runs, 1-2 s otherwise) were load, not kills: re-run alone, both survive,
and the table shows the alone run.

Survivors on round 2 lines, each with the exact edit (all restored; every clone's `git status
--short` empty afterwards):
- **O2** `src/closing.ts:106` `atClosingSha = true;` -> `atClosingSha = false;`: an at-sha rejection
  gets the "recorded against another commit" clause. Wording only; see note 7.
- **O4** `src/closing.ts:102` `rows.filter((e) => sameCommit(e.sha, sha))` -> `rows.filter((e) => e.sha === sha)`:
  equivalent unless an at-sha rejection row is a legacy 7-character abbreviation (the one in this
  ledger is an implementer row) or upper case. No safety effect today.
- **O7** `src/closing.ts:104` `if (atHead?.kind === "rejected") {` -> `if (atHead?.kind === "rejected" && atHead.blockedAfter === undefined) {`:
  F then B at the closing sha falls through to the across-row reading, which also refuses, so the
  only change is the wrong "another commit" clause. Wording only; see note 7.
- **O8** `src/ledger.ts:202` `const isRejection = (e: Entry) => e.verdict === "verifier-failed";` ->
  `... === "verifier-failed" || (e.verdict === "verifier-blocked" && e.evidence.startsWith(".mstack/progress/spec_"));`:
  a lone blocked row citing `spec_<slug>.md` would be the escape hatch again. Every new blocked test
  cites `impl_`; B5 shows the code discounts `spec_` today. See note 9.
Round 1's survivors M10, M11, M15, M16, M20, M24 and M25 still survive (known, queued); none of
them lets an item close over a rejection. None of the round 2 survivors does either.

## Where each claim stopped on the evidence ladder

- Rung 5 (real CLI in throwaway stores, and on this repository): every line of the A and B tables
  and the extra probes, including the Stop hook by hand in each throwaway store; the B-9r
  `--force` paths from three statuses; the live checks for acceptance 4 and 5; this repository's
  `gate`, `gate --full`, 111 ledger pairs and ledger diff.
- Rung 4: the suites on both runtimes; every mutant row (on scratch clones of HEAD); the closing
  check run through `closingProblems` on all 31 closed items of this repository.
- Rung 2-3 only: that `src/cli.ts:531` is the only code path that sets `done` (read, plus the three
  `--force` attempts); merge-gate's change for B3 (it goes through `check`, `src/mergegate.ts`, not
  run through `gh` this round).

## Residual risks accepted, and non-blocking notes

1. **The corrected sentence is narrower than the behaviour.** `agents/reviewer.md:95-96` and
   `skills/review/SKILL.md:57-58` say the row "stands until a later independent approval at that
   commit". For closing, any later independent approval answers it unless the close happens at the
   rejected commit itself: A3 (approval at the fix commit) closes, which is the intended flow, and
   A15 (approval of an older commit, recorded later) closes too. A reviewer reading it overrates
   its rejection only in that contrived ordering; every action it implies is right. Accepted.
   A wording that matches the code: "it stands until a later independent approval answers it
   (at the commit being closed, or recorded after it at any commit)".
2. **The at-sha half protects only a close at the commit that carries the rejection row.** One
   commit later (A15: `F@HEAD~1`, then `T@HEAD~2` recorded after it, close at HEAD with no rows),
   the B-9r ordering closes through the CLI and passes the gate, exactly as at `7283bbe`. In this
   repository a row is normally committed before the close (item 19), so a close usually happens at
   a commit with no rows; what still guards it there is the across-row rule, which only an approval
   recorded after the rejection answers. Not a blocker by the brief's definition (no statement
   stands at the sha being closed) and not worse than base. Accepted, because it needs an approval
   of an older commit recorded after a rejection of a newer one; the fix is the closing commit
   on the item plus an ancestry rule (item 40, follow-up 1).
3. **A rejection at the closing commit typed as `HEAD`, upper case or a branch name is not seen by
   the at-sha half** (`sameCommit` is a string comparison and `record` stores those forms as typed,
   round 1 Non-blocking 1). With the B-9r ordering the close goes through (extra probes). Identical
   at `cde3c2b` and `7283bbe`, outside the documented `"$(git rev-parse HEAD)"` path. Accepted;
   follow-up 2 closes it.
4. The audit's limit is documented as a mechanism ("this audit of an item already closed reads
   every row, because an item records no closing commit", `docs/wiki/Gates-and-Hooks.md:220-221`;
   `CHANGELOG.md:10-11`) but not as its consequence: a rejection at the closing sha answered by a
   later approval of an older commit passes the audit once the item is hand-edited to `done` (A1).
   One clause would say it, and would also qualify the headline "or stay closed" (`CHANGELOG.md:5`).
5. The A9 message reads "...; the later verifier-blocked by reviewer does not answer it; it was
   recorded against another commit than the one being closed, ..." The second "it" is the
   rejection, but it follows a clause about the blocked row, which is at the closing commit.
   "the rejection was recorded against another commit" would be unambiguous (`src/closing.ts:128-130`).
6. `tests/ledger.test.ts:525` is titled "the blocked row is not named as an answer attempt" but
   does not assert it; `assert.doesNotMatch(r.reason, /does not answer it/)` would.
7. Mutants O2 and O7 survive (see the table): no test pins that an at-sha rejection is not worded as "at
   another commit". `tests/closing.test.ts:277` compares the gate and `state set` messages with
   `found[0].message`, which carries the same wrong clause. One `assert.doesNotMatch(found[0]!.message,
   /another commit/)` there kills O2; the same assertion in `tests/closing.test.ts:194` (F then B at one sha) kills O7.
8. A discounted blocked row reads "verifier-blocked ... cites the implementer's own report (...),
   so it is not an independent approval" (B1), although a blocked row is not an approval. True in
   effect; slightly odd wording (`src/ledger.ts:340-349`).
9. The docs say a blocked row citing "the implementer's own report" is discounted; one citing the
   spec-author's report is discounted too (B5). Incomplete, not false
   (`docs/wiki/Gates-and-Hooks.md:213`, `docs/wiki/The-CLI.md:338`, `CHANGELOG.md:14`), and no test
   pins it: mutant O8 survives. A copy of `tests/gate.test.ts:1724` with `spec_storage-layer.md`
   would kill it.
10. The `readVerdict` comment (`src/ledger.ts:205-207`) still names two callers, `ledger check`
    and the gate's audit; the closing check (`src/closing.ts:103, 110`) is a third.
11. Already known and not this item: `state set --status done` closes discounted and author-only
    ledgers that the gate then fails (B1, B5, B6, identical to `7283bbe`); round 1's surviving
    mutants M10, M11, M15, M16, M20, M24, M25 still survive (table).

## Suggested follow-ups

1. Record the closing commit on the item when it closes (item 40 owns item fields), then judge the
   audit at that sha and let only an approval at the same or a descendant commit answer a rejection
   (closes notes 2 and 4, and the hand-edit limit).
2. Canonical shas in `ledger record` for every input form (`git rev-parse --verify <x>^{commit}`,
   lower case), and a case-insensitive `sameCommit` (closes note 3 and round 1 Non-blocking 1).
3. The test assertions in notes 6, 7 and 9.
