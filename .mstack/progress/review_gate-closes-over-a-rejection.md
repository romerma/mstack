# Review - gate-closes-over-a-rejection

**Verdict:** CHANGES_REQUESTED

Item 70, round 1, reviewing alone (no lens). Branch `fix/gate-closes-over-a-rejection`, head
`4425f3808f97cdcfd3a4dbdf15052847f8a7c393`; diff `7283bbe...HEAD`. I did not write this code.
Everything below was run by me with this checkout's `./bin/mstack` (and, for "old", a
`git worktree` / `git archive` of `7283bbe`) in throwaway stores under the session scratchpad.

The single-sha work is good: the reproduced case, failed-then-blocked, blocked-then-failed, a
discounted approval after a rejection, and the panel shapes all now refuse at `state set`, at the
gate on `verifying`, in the Stop hook and in the closed-item audit, each naming the row; this
repository's 31 closed items still pass; the status line adds no git call. Three things stop it:
a sentence every reviewer reads is now false, the new closing door judges a rejection across
every sha instead of at the closing sha (so one ordering still closes over a rejection at HEAD),
and the reader's exemption of `verifier-blocked` from discounting reopens a forged escape hatch
the old gate refused.

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| 1 reproduced case refused | `tests/gate.test.ts:1657`, `tests/closing.test.ts:194`, `tests/verdict-reader.test.ts:41` | M1a, M1b red on bun and node; B-1 refuses on the real CLI, `7283bbe` closed it |
| 1 at the closing sha, rows at two shas | none | B-9r closes over a rejection at HEAD (Changes required 2) |
| 2 blocked after failed refused | `tests/gate.test.ts:1681`, `:233-244`, `tests/closing.test.ts:228-230`, `tests/ledger.test.ts:491`, reader rows `tests/verdict-reader.test.ts:47-51` | M2a, M2b, M2c red; B-2, B-3 |
| 2 lone blocked still closes | `tests/gate.test.ts:1698`, `tests/closing.test.ts:242` | M13, M23 red; B-4 |
| 3 one reader, two callers agree | `tests/verdict-reader.test.ts:87` (one sha only) | M1b, M2c, M3 red; two-sha disagreement untested (B-9r, B-9s) |
| 4 abbreviated sha | `tests/ledger.test.ts:417, :431, :442, :455`, `tests/ledger-cli.test.ts:16` | M4a-c, M9 red; M10 (4-6 chars) survives; run F |
| 4 empty target | `tests/ledger.test.ts:468`, `tests/ledger-cli.test.ts:32` | M5 red; run G |
| 5 status line states | `tests/statusline.test.ts:531, :563` | M6a-d, M18 red; run H |

## Acceptance, quoted

**"the gate refuses to close when the latest closing-role row at the closing sha is a rejection, whatever its evidence cites; a test reproduces a genuine approval followed by a rejection citing impl_<slug>.md"** -
met for a ledger whose rows are all at the closing sha: the reproduced case now refuses at
`state set` (exit 2, `demo cannot close: a rejection stands in the ledger: verifier-failed at
7715ac5a by reviewer (evidence: .mstack/progress/review_demo_r2.md; the claims in impl_demo.md do
not hold)`), at the gate on `verifying`, in the Stop hook and in the audit; the `7283bbe` CLI
closed it and passed the gate (B-1). Tests: `tests/gate.test.ts:1657`, `tests/closing.test.ts:194`,
reader table `tests/verdict-reader.test.ts:41`; mutants M1a/M1b kill them on both runtimes.
**Not met** when rows sit at more than one sha: B-9r closes over a rejection at the closing sha
(Changes required 2).

**"a verifier-blocked row does not let an item close over an earlier verifier-failed at the same sha, or the report shows why it should and the decision is recorded"** -
met. B-2 (`F, B`) refuses at all three surfaces and names the failure, not the blocked row; B-3
(`B, F`) too; `F, B, T` closes (`tests/gate.test.ts:1709`). `tests/gate.test.ts:1681`, `tests/closing.test.ts:228-230`,
`tests/ledger.test.ts` "a verifier-blocked after a verifier-failed..."; mutants M2a/M2b/M2c die.
The lone-blocked escape hatch still closes (B-4) and is pinned by `tests/gate.test.ts:1698` and
`tests/closing.test.ts:242` (mutant M13 dies), with the caveat of Changes required 3.

**"ledger check and the gate's closing audit read the verdict through one function, so the two cannot disagree again on the same rows"** -
partly met. One function, yes: `readVerdict` (`src/ledger.ts:214`) is called by `check`
(`:288`), the gate audit (`src/gate.ts:421`) and the closing check (`src/closing.ts:95`); the
status line (`src/statusline.ts:141`) and merge gate (`src/mergegate.ts:165`) go through `check`.
No other verdict decision from rows remains in `src/` except the gate's pre-filter
`rows.every(verifier-failed)` (`src/gate.ts:405`), which only ever fails. But they read
different row sets (one sha vs every sha), and on a two-sha ledger they disagree in both
directions (B-9r, B-9s). The agreement test (`tests/verdict-reader.test.ts:87`) records every
row at one sha, so it cannot see this.

**"an abbreviated sha given to ledger check or ledger record is resolved to the full commit or refused with a message, and ledger record refuses an empty target"** -
met for abbreviations (run F): 4 (`a8ac`), 7, 12 and uppercase-7 characters resolve and `record` stores the
full 40; a 4-character prefix I made ambiguous on purpose (`587f`, two commits) and a prefix of
no commit (`deadbee0`) are refused by `record` with `is not a commit in this repository` plus a
hint that names ambiguity, and find no row in `check`; nothing crashed. `a8ac` is a prefix
shared by a commit and a blob, and resolves to the commit. Empty and whitespace targets are refused (exit 2, `a
ledger row needs a target`) where `7283bbe` recorded both (run G). Not covered by the bullet and
pre-existing (Non-blocking 1): `HEAD`, a branch name and an uppercase 40-character sha are
stored as typed.

**"the status line distinguishes an author-only verdict and a discounted approval from an independent approval"** -
met (run H): `test-verified` (green), `test-verified (author only)` (yellow),
`test-verified (not independent)` (red), distinguishable without colour at normal widths; no new
git call (2 calls before and after) and the same time. `tests/statusline.test.ts:531`; mutants
M6a-M6d die.

## Verification I ran

- `./bin/mstack gate` at `4425f38`: `[ok]    31 closed item(s) carry a ledger verdict`,
  `PASSED - 0 failures, 0 warnings`.
- `./bin/mstack gate --full`: bun `517 pass, 0 fail, Ran 517 tests across 25 files. [76.80s]`;
  node `ℹ tests 517 / ℹ pass 517 / ℹ fail 0`; typecheck clean; `lint-plugin` `PASSED - 0 failures,
  0 warnings`; `[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .`; final
  `PASSED - 0 failures, 0 warnings`, exit 0. None of the three item-67 tests failed in this run.
- `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`: `96 relative links checked, 0 broken`.

### A. This repository's history, before and after
`./bin/mstack ledger check <target> <sha>` over every distinct (target, sha) pair of
`.mstack/ledger.tsv` (109 pairs; the implementer reported 107 on an earlier ledger), with the
`7283bbe` CLI (a `git worktree`) and with HEAD: 85 exit 0 and 24 exit 1 in both; `diff` shows one
line:
```
< hook-errors-leave-no-trace 9b36340 [0] PASS test-verified at 9b36340 by implementer (the author's own verdict, not an independent approval)
> hook-errors-leave-no-trace 9b36340 [0] PASS test-verified at 9b36340a by implementer (the author's own verdict, not an independent approval)
```
Gate: `[ok]    31 closed item(s) carry a ledger verdict` with both CLIs.
`git diff 7283bbe...HEAD --numstat -- .mstack/ledger.tsv` is `1 0`: one appended row (the
item 70 implementer row at `d8b944e`), nothing edited, reordered or removed.

### B. The sequence table, real CLI
Each case is a fresh store (`git init`, `./bin/mstack setup`, branch `fix/demo`, item `demo`
walked to `verifying`, `current.md` naming it, four report files of 77 bytes, two commits so
`HEAD~1` exists; no `verify` command). Rows recorded with `ledger record demo <sha> ...` in the
order given, all at HEAD unless marked `@old` (= `HEAD~1`). Then: `ledger check demo`;
`state set demo --status done`; if refused, `state set demo --status done --force --closed-by
"review probe"`; then, with the item `done` (by `state set` or, when refused, by editing
`state.json` and committing), `mstack gate`. The `7283bbe` column is the same script with the
old CLI. R=reviewer, I=implementer, T=test-verified, F=verifier-failed, B=verifier-blocked.

| # | rows | `ledger check` | `state set done` / `--force` | gate, item done | agree? | 7283bbe close / gate |
|---|---|---|---|---|---|---|
| 1 | I:T(impl) R:T R:F(r2; cites impl_demo.md) | FAIL `verifier-failed at 7715ac5a by reviewer rejects this commit, ... (evidence: .mstack/progress/review_demo_r2.md; the claims in impl_demo.md do not hold)` | exit 2 / exit 2 `demo cannot close: a rejection stands in the ledger: verifier-failed at 7715ac5a by reviewer (evidence: ...)` | exit 1 `[fail]  items marked done whose most recent closing verdict is verifier-failed, or verifier-blocked after one: demo (reviewer): verifier-failed at 7715ac5a by reviewer (evidence: ...)` | yes | closes / `[ok]    1 closed item(s) carry a ledger verdict` |
| 2 | R:F R:B | FAIL `verifier-failed at d04f9328 by reviewer rejects this commit, ... (evidence: .mstack/progress/review_demo.md); the later verifier-blocked by reviewer (evidence: could not re-run the suite here) does not answer it` | exit 2 / exit 2 `... a rejection stands in the ledger: verifier-failed at d04f9328 by reviewer (evidence: .mstack/progress/review_demo.md); the later verifier-blocked by reviewer does not answer it` | exit 1 `[fail] ... demo (reviewer): verifier-failed at d04f9328 ...` | yes | closes / `[ok]` |
| 3 | R:B R:F | FAIL `verifier-failed at 7831fe95 by reviewer rejects this commit ...` | exit 2 / exit 2, names the F row | exit 1, names the F row | yes | closes / `[fail] ... most recent closing verdict is verifier-failed: demo (reviewer)` |
| 4 | R:B alone (escape hatch) | FAIL `verifier-blocked at 58c3bf30 by reviewer rejects this commit, whatever an implementing role recorded (evidence: no harness in this repo)` | exit 0 `1 demo (done)` | exit 0 `[ok]    1 closed item(s) carry a ledger verdict` | as documented: `docs/wiki/The-CLI.md:332-334` says a lone blocked fails `check` and is what the gate accepts | same |
| 5 | R:F R:T | PASS `test-verified at 5c02aa66 by reviewer` | exit 0 | exit 0 `[ok]` | yes | same |
| 6 | R:T R:F(evidence only `.mstack/progress/impl_demo.md`) | FAIL `verifier-failed at 0c39e92b by reviewer rejects this commit, ... (evidence: .mstack/progress/impl_demo.md)` | exit 2 / exit 2 | exit 1, names it | yes | closes / `[ok]` |
| 7 | R:F(cites impl_demo.md) R:T(cites impl_demo.md) | FAIL `verifier-failed at 762ada1f ...` | exit 2 / exit 2 | exit 1, names the F | yes | closes / `[fail] items closed on a verdict whose evidence cites the implementer's own report` |
| 8a | I:T only | PASS `test-verified at ce9f2d58 by implementer (the author's own verdict, not an independent approval)` | exit 0 | exit 1 `[fail]  items closed on a verdict from the pass that wrote the code: demo (only implementer)` | known split, unchanged | identical |
| 8b | R:T citing impl_demo.md only | FAIL `test-verified at 77f10c47 by reviewer cites the implementer's own report (evidence: .mstack/progress/impl_demo.md), so it is not an independent approval` | exit 0 | exit 1 `[fail]  items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)` | known split, unchanged | identical |
| 9 | R:F@old, R:T@HEAD | PASS `test-verified at bace278f by reviewer` | exit 0 | exit 0 `[ok]` | yes | same |
| **9r** | **R:F@HEAD, then R:T@old** | **FAIL `verifier-failed at b9b3e5bd by reviewer rejects this commit, ... (evidence: .mstack/progress/review_demo_r2.md)`** | **exit 0 `1 demo (done)`** | **exit 0 `[ok]    1 closed item(s) carry a ledger verdict`** | **no: closes over a rejection at the closing sha** | same (pre-existing in the audit) |
| 9s | R:T@HEAD, then R:F@old | PASS `test-verified at d3fba274 by reviewer` | exit 2 / exit 2 `... a rejection stands in the ledger: verifier-failed at 20e016ef by reviewer ...` | exit 1, names the old row | no (over-strict; a further R:T at HEAD clears it) | closes / `[fail]` |
| 10a | panel, synthesizer's one row: orchestrator T | PASS `test-verified at 5406e7fb by orchestrator` | exit 0 | exit 0 `[ok]` | yes | same |
| 10b | forbidden per-lens rows: R:T R:F R:T | PASS `test-verified at 8f22f1ee by reviewer` | exit 0 | exit 0 `[ok]` | yes (last lens wins, as `agents/reviewer.md:99-102` warns) | same |
| 10c | per-lens rows: R:T R:T R:F | FAIL `verifier-failed at 2d1e240f ... (evidence: .mstack/progress/review_demo_security.md)` | exit 2 / exit 2 | exit 1 | yes | closes / `[fail]` |
| 11a | R:T, then I:F | PASS `test-verified at d92f6395 by reviewer` | exit 0 | exit 0 `[ok]` | yes (implementing roles never close or reject) | same |
| 11b | R:T, then an unnamed (`--verifier ""`) F | PASS | exit 0 | exit 0 | yes | same |
| 11c | R:T, then spec-author F | PASS | exit 0 | exit 0 | yes | same |
| **12** | **R:B citing impl_demo.md only** (run on `git archive` copies) | FAIL `verifier-blocked at 85c7c7ef by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/impl_demo.md)` | exit 0 `1 demo (done)` | **exit 0 `[ok]    1 closed item(s) carry a ledger verdict`** | split, as for any lone blocked | closes / **`[fail]  items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)`** (regression: Changes required 3) |
| 12b | I:T(impl), R:B citing impl_demo.md | FAIL `verifier-blocked at 00aa3ea8 ...` | exit 0 | exit 0 `[ok]` | split | closes / `[fail] ... cites the implementer's own report` |
| 12c | R:F, R:B citing impl_demo.md | FAIL `verifier-failed at ec0f5218 ...; the later verifier-blocked by reviewer (evidence: .mstack/progress/impl_demo.md) does not answer it` | exit 2 / exit 2 | exit 1, names the F | yes | closes / `[fail] ... most recent closing verdict is verifier-failed: demo (reviewer)` |

Every refused close left the item at `verifying`. `--force --closed-by` never got past the new
check (exit 2, same message). Only 9r closes, or stays closed with a passing gate, over a
standing independent rejection at the closing sha.

### D. The three surfaces, and the way out
Store with case 1's rows, item at `verifying`:
```
$ mstack gate
[fail]  1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at b120f8ea by reviewer (evidence: .mstack/progress/review_demo_r2.md; the claims in impl_demo.md do not hold)
FAILED - 1 failure, 1 warning
$ printf '{"cwd":"...","hook_event_name":"Stop",...}' | mstack hook stop
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- 1 demo (verifying) is one step from done, and a rejection stands in the ledger: verifier-failed at b120f8ea by reviewer (evidence: ...) -> fix what it found and record an independent approval from a closing role at the new commit; 'could not verify' does not answer a rejection and --force does not close over one"}}
$ mstack state set demo --status cancelled
1 demo (cancelled)
```
`--force` today overrides the verification check's findings (`src/cli.ts:531-575`, with a
required `--closed-by`); the only non-overridable problem before this item was "could not
read the receipts" (`src/closing.ts:59-68`), a failure to look. The new check is the first
non-overridable *finding*. The decision row's reason holds (the ledger is append-only, so a
forced close would leave the gate red for good), and it is not a dead end: a later independent
approval closes (case 5, `tests/closing.test.ts:232-236`), and `--status cancelled` still works.
The interface comment `src/closing.ts:25` ("False for a failure to look") and `src/cli.ts:535`
now describe one of the two reasons only (Non-blocking 4).

### E. The rewritten test
`tests/gate.test.ts:233-244`: at `7283bbe` a `verifier-failed` then `verifier-blocked`, both by
verifier `test`, ended `expectPass(gate(sb), "blocked is a verdict")`; now
`expectFail(gate(sb), /verifier-blocked after one/, ...)`. That assertion encoded the hole
acceptance 2 names, and the decision row says so; it is not a weakening. The escape hatch is
still pinned (`tests/gate.test.ts:1698`, `tests/closing.test.ts:242`, reader table row "a lone
blocked row" with `gate: "pass"`), and mutant M13 / M23 prove those fail if blocked stops
closing. No other existing assertion changed: the rest of the test diff is the import line of
`tests/ledger.test.ts` and appended tests.

### C. One reader
`rg -n "readVerdict|ledger\.check\(|\.best\b|\.passing\b|citesImplementingReport|canCloseAnItem" src`
finds `readVerdict` in `src/ledger.ts:214` (defined, called by `check` at `:288`),
`src/gate.ts:421` and `src/closing.ts:95`; `.best`/`.passing` only in `src/statusline.ts:152-163`
and `src/mergegate.ts:166`, both on a `check` result; `canCloseAnItem`/`citesImplementingReport`
only inside `readVerdict`. `src/hooks.ts` reads no ledger (the Stop hook is `runGate`). The one
row-reading rule left outside the reader is `src/gate.ts:405` (`rows.every(verifier-failed)` ->
"only verdict is verifier-failed"), which can only fail. Merge gate: not run through
`mstack merge-gate` (needs a PR); I called the real `evaluate()` (`src/mergegate.ts:109`) with a
hand-built OPEN/CLEAN PR whose `headRefOid` is the store HEAD, on my scratch ledgers:
```
h-indep GO ["ledger: test-verified at 2cfbee46 by reviewer"]
h-disc STOP ["ledger: test-verified at ee27b340 by reviewer cites the implementer's own report (evidence: .mstack/progress/impl_demo.md), so it is not an independent approval"]
h-author GO ["ledger: test-verified at 8e192853 by implementer (the author's own verdict, not an independent approval)"]
h-rejblk STOP ["ledger: verifier-failed at 4ef18513 by reviewer rejects this commit, whatever an implementing role recorded (evidence: .mstack/progress/review_demo.md); the later verifier-blocked by reviewer (evidence: could not re-run) does not answer it"]
h-blk STOP ["ledger: verifier-blocked at 11299db0 by reviewer rejects this commit, whatever an implementing role recorded (evidence: no harness in this repo)"]
```
So it reads through the reader (rung 4 on `evaluate`, not on the `gh` path). The "private copy"
mutants (M1b, M2c, M3) are each killed by the agreement test and the gate tests; an identical
copy would be an equivalent mutant no behavioural test can see.

### F. Shas, real CLI (store with 837 commits, two of them sharing the prefix `587f`)
```
record [2] 587f -> mstack: 587f is not a commit in this repository
        pass the output of 'git rev-parse HEAD'; a verdict against a SHA that does not exist proves nothing, and an abbreviation that matches two commits is refused like one that matches none
record [0] 587f28d -> recorded test-verified for demo at 587f28de
record [0] 587f28de5380 -> recorded test-verified for demo at 587f28de
record [0] 587f28de53801b20cc8795f4cba292e769ccb58d -> recorded test-verified for demo at 587f28de
record [0] a8ac -> recorded test-verified for demo at a8ac45ec        (prefix shared by a commit and a blob)
record [2] 587 -> mstack: 587 is not a commit in this repository
record [2] deadbee0 -> mstack: deadbee0 is not a commit in this repository
record [2] zzzzzzz -> mstack: zzzzzzz is not a commit in this repository
record [0] HEAD -> recorded test-verified for demo at HEAD
record [0] fix/demo -> recorded test-verified for demo at fix/demo
record [0] 587F28D -> recorded test-verified for demo at 587f28de
record [0] 587F28DE53801B20CC8795F4CBA292E769CCB58D -> recorded test-verified for demo at 587F28DE
record [0] 9a0c85fc0522f11732c726ffe25c3f06bcd48d8f -> recorded test-verified ... (a commit on another branch, not an ancestor)
--- stored sha column: 4x 587f28de...(full, lower), 1x 587F28DE...(full, UPPER), 2x 9a0c85fc...(full), 1x a8ac45ec...(full), 1x fix/demo, 1x HEAD
check  [1] "587f" -> FAIL no verdict at 587f; 10 row(s) exist at other SHAs and a new head SHA voids them
check  [0] "587f28d" / "587f28de5380" / full / "587F28D" -> PASS test-verified at 587f28de by reviewer
check  [0] "HEAD" -> PASS test-verified at HEAD by reviewer
check  [0] "fix/demo" -> PASS test-verified at fix/demo by reviewer
```
Every abbreviation of 4 to 39 hex characters is resolved or refused with a message; nothing
crashed. Not abbreviations, and identical at `7283bbe` (I ran the old CLI on `HEAD`, a 7-char
sha and an uppercase 40-char sha): `HEAD` and branch names are stored as the literal string,
and an uppercase full sha is stored uppercase. A store holding only the uppercase row answers
`ledger check demo` with `FAIL no verdict at 112d5ca9; 1 row(s) exist at other SHAs` although
the row is at that commit, while the gate (which ignores shas) counts it. A row stored as
`HEAD` matches `ledger check <slug> HEAD` at every future commit, so it never goes stale.
The legacy short row: `sameCommit` (`src/ledger.ts:100-103`) matches a 7+ character row as a
string prefix of the full sha. A wrong match needs another commit sharing those 28 bits; a short
row cannot shadow a full row (both are kept, in file order). `record` can no longer write a
short row (M4c, M10 below).
Status line and hooks gained no git call (a `git` shim on PATH logging every call): status line
2 calls (`rev-parse --abbrev-ref HEAD`, `rev-parse HEAD`) with HEAD and with a `git archive` of
`7283bbe`; `hook stop` with `stop_hook_active` 0 calls; `gate` 6 and 6. Time for 30 status-line
renders from the same stdin: 1.55 / 1.53 / 1.54 s (HEAD) against 1.54 / 1.54 / 1.53 s (old).

### G. Targets
```
record [2] target='' -> mstack: a ledger row needs a target: the item slug it is a verdict about
record [2] target='   ' -> mstack: a ledger row needs a target: the item slug it is a verdict about
record [0] target='not-an-item' -> recorded test-verified for not-an-item at 7edd3ef2
record [0] target='Demo Item With Spaces' -> recorded test-verified for Demo Item With Spaces at 7edd3ef2
```
`7283bbe` recorded all four (the empty one as `recorded test-verified for  at 7edd3ef2`). A
target that names no item is still accepted; the bullet asks only for the empty one.

### H. The status line (`NO_COLOR=1`, then colour with ESC shown as `~`)
```
independent : Opus · fix/demo · #1 demo · verifying · test-verified · ctx 42%                     ~[32mtest-verified
author-only : Opus · fix/demo · #1 demo · verifying · test-verified (author only) · ctx 42%       ~[33mtest-verified (author only)
discounted  : Opus · fix/demo · #1 demo · verifying · test-verified (not independent) · ctx 42%   ~[31mtest-verified (not independent)
spec cited  : ... · verifying · test-verified (not independent)                                   ~[31m
rejected    : Opus · fix/demo · #1 demo · verifying · verifier-failed · ctx 42%                   ~[31mverifier-failed
F then B    : ... · verifying · verifier-failed                                                   ~[31m   (7283bbe showed verifier-blocked)
blocked     : Opus · fix/demo · #1 demo · verifying · verifier-blocked · ctx 42%                  ~[33mverifier-blocked
```
`7283bbe` rendered the first three as the same plain `test-verified` (green, green, yellow).
Without colour the three are distinct by their words. Width: `join()` still truncates to
`COLUMNS` (`tests/statusline.test.ts:118-138, 432-436` still green), but at `COLUMNS=50` all
three render `Opus · fix/demo · #1 demo · verifying · test-veri…`, so on a narrow terminal
without colour the label is the first thing cut (Non-blocking 6).

### J. Prose
Checked by running: `docs/wiki/The-CLI.md:319-339` (sha resolution, empty target, standing
rejection, blocked after failed, lone blocked, spec-author naming, `state set` refusal) - true,
see B, F, G. `docs/wiki/Status-Line.md:23` - true (H), and `src/statusline.ts:146-172` is the
right range. `docs/wiki/Gates-and-Hooks.md:207-216` - true for one-sha ledgers; "so the two
commands and the gate cannot disagree about one ledger" is false (B-9r, B-9s). `CHANGELOG.md:5-15`
- its headline ("no longer lets an item close, or stay closed, over a standing rejection") and "so they cannot disagree about the same rows" are false for B-9r; "still passes for all 31
closed items" - true. `README.md:229,259` and `docs/wiki/Gates-and-Hooks.md:387,404` describe
`--force` for the verification check and the decision fork, still true. `agents/reviewer.md:95`
and `skills/review/SKILL.md:57` - false now (Changes required 1). `agents/reviewer.md:99-102`,
`skills/review/SKILL.md:47-52`, `docs/wiki/The-Agents.md:165` ("latest closing-role row ... a
split panel means its worst lens, not the last one") - still a correct warning; B-10b shows the
last lens wins.

### K. Scope and rules
`git diff --stat 7283bbe...HEAD -- src/tsv.ts src/state.ts src/hooks.ts src/hooklog.ts
src/costs.ts hooks/hooks.json package.json` is empty. No new dependency, no `Bun.*` in `src/`,
both runtimes green. The one new git spawn (`resolveSha`, `src/ledger.ts:82-87`) has a 5 s
timeout like `isCommit`. The new test helper `tests/ledger-cli.test.ts:11-14` spawns
`bin/mstack` with no `timeout` (Non-blocking 5); `tests/closing.test.ts:16`, which the new
closing test reuses, is the pre-existing helper of the same shape.

### I. Mutants
Each applied alone to this checkout's `src/` by an exact-string replacement (refused unless the
string occurs once), then `bun test` and `node --experimental-strip-types --test` over
`tests/{verdict-reader,gate,closing,ledger,ledger-cli,statusline,mergegate,roles,cli}.test.ts`,
then `git checkout -- <file>`. Baseline of that set at HEAD: bun `233 pass, 0 fail`, node `ℹ tests 233 / ℹ pass 233 /
ℹ fail 0`. Counts are failing tests per runtime. The two FIX rows are
not mutants: they are the fixes suggested in Changes required 2 and 3, run against the same
suites to show what they would break.

| mutant | bun / node failing tests | killed by (first two) |
|---|---|---|
| M1a reader drops a rejection that cites impl | 8 / 8 | "a rejection citing the implementer's report retracts an earlier genuine approval"; "a rejection that cites the implementer's report stands over an earlier genuine approval" |
| M1b gate drops a closing rejection citing impl before reading (old private rule) | 3 / 3 | "a closing row citing the implementer's own report does not close the item"; "a rejection that cites the implementer's report stands over an earlier genuine approval" |
| M2a reader: blocked after failed answers it | 8 / 8 | "a standing rejection is refused by closingProblems, the gate and state set, and named in each"; "a verifier-blocked after a verifier-failed fails the check, naming the failure and saying the blocked row does not answer it" |
| M2b closing check: blocked after failed closes | 1 / 1 | "a standing rejection is refused by closingProblems, the gate and state set, and named in each" |
| M2c gate audit: blocked after failed closes (private copy drifts) | 3 / 3 | "a verifier-blocked row after a verifier-failed does not let the item close"; "an item closed on a failed verifier is rejected" |
| M3 gate reads through a private copy: only the latest closing row | 5 / 5 | "a forged passing row cannot supersede a genuine failure"; "a verifier-blocked row after a verifier-failed does not let the item close" |
| M4a drop sha resolution everywhere | 2 / 2 | "an abbreviated sha given to ledger record is stored as the full sha"; "an abbreviated sha is resolved to the full commit by ledger check" |
| M4b drop sha resolution in check only | 2 / 2 | "an abbreviated sha is resolved to the full commit by ledger check"; "ledger check answers at an abbreviated sha, and ledger record stores the full one" |
| M4c drop sha resolution in record only | 1 / 1 | "an abbreviated sha given to ledger record is stored as the full sha" |
| M5 accept the empty target | 2 / 2 | "ledger record refuses an empty or blank target"; "ledger record refuses an empty target at exit 2 and says what to pass" |
| M6a status line: collapse author-only | 1 / 1 | "an independent approval, an author-only verdict and a discounted approval are three different things" |
| M6b status line: collapse discounted | 1 / 1 | "an independent approval, an author-only verdict and a discounted approval are three different things" |
| M6c status line: collapse all three (both) | 1 / 1 | "an independent approval, an author-only verdict and a discounted approval are three different things" |
| M6d status line: labels kept, colours collapsed to the old ones | 1 / 1 | "an independent approval, an author-only verdict and a discounted approval are three different things" |
| M7 --force overrides the ledger-verdict check | 1 / 1 | "a standing rejection is refused by closingProblems, the gate and state set, and named in each" |
| M8 ledger-verdict removed from CLOSING_CHECKS | 1 / 1 | "a standing rejection is refused by closingProblems, the gate and state set, and named in each" |
| M9 short legacy rows no longer match | 1 / 1 | "a row recorded with a short sha before sha resolution existed is still found at its full sha" |
| M10 abbreviations of 4-6 chars not resolved | **SURVIVES** | - |
| M11 reader keeps the FIRST unanswered failure | **SURVIVES** | - |
| M12 lone blocked reads as approved | 5 / 5 | "a reviewer verifier-blocked row fails the check and is named"; "a verifier-blocked row that cites the implementer's report still fails" |
| M13 closing check also refuses a lone blocked | 1 / 1 | "a lone verifier-blocked row does not stop state set from closing" |
| M14 gate message no longer names the row | 2 / 2 | "a rejection that cites the implementer's report stands over an earlier genuine approval"; "a verifier-blocked row after a verifier-failed does not let the item close" |
| M15 closing check unreadable ledger becomes overridable | **SURVIVES** | - |
| M16 closing check swallows an unreadable ledger | **SURVIVES** | - |
| M17 citesImplementingReport no longer escapes the slug | 6 / 6 | "a dot in the target is not a wildcard: impl_axb.md is not the report for a.b"; "a target with regex metacharacters (api(v2) gets an ordinary answer" |
| M18 status line: author verifier-failed labelled author only | 1 / 1 | "an author's own verifier-failed stays a plain red failure, not an author-only label" |
| M19 check drops the later-blocked clause | 1 / 1 | "a verifier-blocked after a verifier-failed fails the check, naming the failure and saying the blocked row does not answer it" |
| M20 closing message drops the later-blocked clause | **SURVIVES** | - |
| M21 check reads every row of the target, any sha | 6 / 6 | "a new head SHA voids the row, and says so"; "a stale verdict is called out, because that is the only signal this file exists for" |
| M22 discounted spec-author named as implementer | 1 / 1 | "an approval that cites a spec-author's report names the spec-author, not the implementer" |
| M23 gate audit fails a lone verifier-blocked | 2 / 2 | "a lone verifier-blocked row still closes an item nothing can verify"; "ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict" |
| M24 resolveSha drops the ^{commit} peel | **SURVIVES** | - |
| M25 sameCommit compares case-sensitively | **SURVIVES** | - |
| (not a mutant) FIX-A: discount a verifier-blocked citing impl, exempt only verifier-failed | 1 / 1 | "a verifier-blocked row that cites the implementer's report still fails" |
| (not a mutant) FIX-B: closing check also judges the rows at the closing sha | 0 / 0 (nothing tests two shas) | - |

Survivors, each with the exact edit (all restored; `git status --short` empty afterwards):
- **M10** `src/ledger.ts:77` `/^[0-9a-f]{4,39}$/i` -> `/^[0-9a-f]{7,39}$/i`. On a copy with it, `ledger
  record demo <5 hex chars>` stored the row as `9bcca` and `ledger check demo` answered `FAIL no
  verdict at 9bccaaa4; 1 row(s) exist at other SHAs`; HEAD stores the full sha. Tests use 7, 8
  and 12 characters only. A 4- or 5-character case would kill it.
- **M11** `src/ledger.ts:237` `standing = e;` -> `standing = standing ?? e;` (names the first of two
  unanswered failures instead of the latest). Only the named row changes; no reader-table row has
  two failures in a row.
- **M15 / M16** the unreadable-ledger branch of the closing check (`src/closing.ts:99-108`):
  `overridable: false` -> `true`, or `return [ ... ]` -> `return [];`. The branch works on the
  real CLI (ledger `chmod 000`: `state set` exit 2 `demo cannot close: the ledger could not be
  read, so nothing here can say whether a rejection stands: EACCES ...`, also with `--force`; the
  gate at `verifying` prints the same `[fail]`), but no test pins "fails closed".
- **M20** `src/closing.ts:111-114` the `; the later verifier-blocked by ... does not answer it`
  clause -> `""`: the `state set` / gate wording for blocked-after-failed is unpinned (the
  `check` wording is, M19).
- **M24** `src/ledger.ts:82` `` `${sha}^{commit}` `` -> `sha`: the `^{commit}` peel is what resolves a prefix
  shared by a commit and a blob (`a8ac` in run F); untested.
- **M25** `src/ledger.ts:102` case-insensitive prefix -> `sha.startsWith(rowSha)`: equivalent on
  this repository (its one short row is lower case).
None of the survivors lets an item close over a rejection.

## Where each claim stopped on the evidence ladder

- Rung 5 (real CLI on throwaway stores and on this repository): every line of B, D, F, G, H, the
  history comparison of A, the unreadable-ledger refusal, the fix-probe behaviour on copies.
- Rung 4: the suites on both runtimes, every mutant row, `evaluate()` of the merge gate.
- Rung 2-3 only: `mstack merge-gate` through `gh` (needs a PR; `evaluate` is the code it calls,
  `src/cli.ts:945`); the claim that a wrong short-row match needs a 28-bit prefix collision.

## Changes required

1. **`agents/reviewer.md:94-95` and `skills/review/SKILL.md:56-57` are now false.** Both say a
   `verifier-failed` row "is the typed record of your rejection ... it is not itself a gate".
   That wording was chosen in `.mstack/decisions.tsv:63` (item 15) precisely because, then, a
   reviewer's `verifier-failed` did not stop a close ("Item 18 owns making a gate exist"). After
   this change it is exactly the gate: the `ledger-verdict` closing check
   (`src/closing.ts:89-124`) refuses `state set --status done` on it, `--force` included, the
   gate fails at `verifying`, and the Stop hook carries it (run D below). A reviewer deciding
   between `verifier-failed` and an approval-with-notes needs to know that the row blocks the
   close until a later independent approval at the closing commit, and that a later
   `verifier-blocked` does not lift it. Fix: replace "it is not itself a gate" in both files
   with what is now true, e.g. "it stops the item closing - `state set --status done` refuses
   it, `--force` included, and the gate fails - until a later independent approval answers it;
   a later `verifier-blocked` does not". The implementer's prose sweep did not search for this
   phrase (`impl_gate-closes-over-a-rejection.md`, "Prose hits").

2. **The closing door judges every sha, not the closing sha, so a rejection AT the closing sha
   is answered by an approval of an OLDER commit recorded later (acceptance 1 and 3).**
   `src/closing.ts:95-98` feeds `readVerdict` every row of the item in file order, as
   `src/gate.ts:400,421` does for the audit. Real CLI, case B-9r below: reviewer
   `verifier-failed` at HEAD, then a reviewer `test-verified` at `HEAD~1` appended after it:
   - `ledger check demo` -> `FAIL verifier-failed at b9b3e5bd by reviewer rejects this commit, ...` (exit 1)
   - `state set demo --status done` -> `1 demo (done)` (exit 0)
   - `mstack gate` -> `[ok]    1 closed item(s) carry a ledger verdict` (exit 0)

   The item closed, and stays closed with a passing gate, while the latest independent
   closing-role statement at its closing sha is a rejection, and `ledger check` and the gate
   disagree about the same ledger. The mirror (B-9s: approval at HEAD, then a rejection at
   `HEAD~1` appended) gives `ledger check` PASS while `state set` refuses (unforceable) naming
   the older commit's row. The gate-audit half is pre-existing (the `7283bbe` CLI gives the same
   B-9r result), but the acceptance says "at the closing sha", the recorded design
   (`.mstack/decisions.tsv`, item 70 design row) says "a rejection stands until a later
   independent approval *at that sha*", and the `ledger-verdict` check is new code that knows
   the closing sha (`headSha(store)`, as `verificationReceipts` already uses at
   `src/closing.ts:50`). The implementer's row 17 tested only the forward ordering. Fix: make
   the closing check judge the rows at the closing sha through the same reader (e.g.
   `check(store, slug, headSha(store)).kind === "rejected"`, or `readVerdict` over the rows
   `sameCommit` matches), keep the all-rows reading too if the audit is to stay consistent
   after close, and record a decision for how the audit of an already-closed item, which does
   not store its closing sha, should treat rows at other shas (store the closing sha on close,
   or let only an approval at the same or a descendant commit answer a rejection). A test for
   B-9r on the real CLI. I ran the closing-door half against the suites (FIX-B in the mutant
   table: the check also reads the rows at `headSha`): no test goes red, which is itself the
   evidence that no test covers a two-sha ledger; on a copy of HEAD with it, B-9r is refused at
   `state set` (exit 2, naming the HEAD row), every other case of B is unchanged, and this
   repository's 31 closed items and 109 ledger pairs read exactly as before. The prose that says
   the surfaces "cannot disagree about one ledger"
   (`docs/wiki/Gates-and-Hooks.md:213-216`, `CHANGELOG.md:5-8`) is false until then.

3. **A lone `verifier-blocked` whose evidence is the implementer's own report now closes an
   item the old gate refused.** `src/ledger.ts:224` exempts both `verifier-failed` and
   `verifier-blocked` from the citation filter (`isRejection`, `:196`). That exemption came from
   item 47, where it only mattered to `ledger check`, and there a blocked row fails anyway. In
   the gate a `verifier-blocked` is a closing verdict (the escape hatch), so exempting it from
   discounting lets "the implementer's report wearing a reviewer's name" close an item.
   Real CLI, case B-12 (one reviewer `verifier-blocked`, evidence `.mstack/progress/impl_demo.md`),
   on a `git archive` of HEAD and of `7283bbe`:
   - HEAD: `state set demo --status done` -> `1 demo (done)`; `mstack gate` -> `[ok]    1 closed item(s) carry a ledger verdict` (exit 0)
   - `7283bbe`: same close, then `[fail]  items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)` (exit 1)

   The same with an implementer row before it (B-12b). No test pins it, so the suite stayed green.
   Fix: discount a `verifier-blocked` that cites an implementing report the way an approval is
   (exempt only `verifier-failed`); a `[F, B citing impl]` sequence still reads as the standing
   failure. I ran that change against the suites (FIX-A in the mutant table): one test goes red,
   `tests/ledger.test.ts:346-353`, which still asserts FAIL but pins item 47's wording
   (`verifier-blocked.*reviewer rejects this commit`); on a copy of HEAD with it, B-12 fails the
   gate again and every other case of B is unchanged. Whether `check` keeps that wording (exempt
   blocked there, discount it only for the gate's close) is the fixer's call, with a decision row.

## Non-blocking notes

1. `ledger record` stores `HEAD`, a branch name, or an uppercase 40-character sha as typed
   (run F; identical at `7283bbe`). A `HEAD` row never goes stale for `ledger check <slug>
   HEAD`; an uppercase row is invisible to `ledger check` at its own commit but counted by the
   gate. `resolveSha` only canonicalises 4-39 hex characters (`src/ledger.ts:77-80`), and its
   own comment says why an unresolved key is "a row nobody can find again". Canonicalising every
   input through `git rev-parse --verify <x>^{commit}` in `record` would close all three.
2. The 4-6 character range of `ABBREVIATED` is not pinned (mutant M10): tests use 7, 8 and 12
   characters, so narrowing the regex to `{7,39}` lets `record` store a 4- to 6-character row as
   typed, which `check` then never matches (shown on a copy, M10 below).
3. `docs/wiki/Gates-and-Hooks.md:223` was spliced into a block introduced as "One run, three
   items" (`:227`): `third-item ... verifier-failed at 867d13cb` is the implementer's `demo`
   store from its sequence table row 3, renamed. The shape is exactly what the gate prints (I
   saw it in B), but `CONTRIBUTING.md:57-64` asks for pasted output from one real run.
4. `src/closing.ts:25` ("False for a failure to look, which `--force` cannot vouch for") and
   `src/cli.ts:535` now describe only one of the two kinds of non-overridable problem.
5. `tests/ledger-cli.test.ts:11-14` spawns the CLI with no `timeout`, so a hung child hangs the
   suite (node has no default test timeout and `spawnSync` blocks bun's). `timeout: 30_000`
   makes `spawnSync` kill it.
6. At narrow widths the label is the first thing truncated (`COLUMNS=50`: all three states read
   `test-veri…`). Colour still differs; without colour they collapse.
7. The gate's audit message for blocked-after-failed names only the failure, where `check` and
   `state set` also name the later blocked row (the implementer noted it).

## Suggested follow-ups

1. Record the closing sha on an item when it closes, so the audit of closed items can judge the
   verdict at that sha instead of across every row (Changes required 2 is the closing-door half).
2. Canonical shas in `ledger record` for every input form (Non-blocking 1), and a test per form.
3. `ledger record` accepts a target that names no item (`not-an-item`); a warning, or a refusal
   outside `--force`, would catch a typo that otherwise records a verdict nobody reads.
4. Already known and not this item: `state set --status done` closes author-only and
   discounted ledgers (B-8a, B-8b: identical to `7283bbe`, not made worse; the blocked variant,
   B-12, is made worse and is Changes required 3); `merge-gate` says GO
   on an author-only ledger (`h-author GO` in C) because `check` PASSes it.
5. A `verifier-failed` from an implementing role or an unnamed verifier after a reviewer
   approval is ignored (B-11a-c, unchanged). By design today; worth a decision row if the author
   finding their own bug after approval should hold the close.
