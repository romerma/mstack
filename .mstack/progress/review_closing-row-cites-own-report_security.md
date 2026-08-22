# Review - closing-row-cites-own-report (security-and-failure-paths lens)

**Verdict:** CHANGES_REQUESTED

## Scope

Base `3c7e883`, fix at `b16aa45` (+ red-repro `b27240e`, + `dfa78f0` implementer report),
branch `fix/closing-row-cites-own-report`, HEAD `dfa78f0`. `git diff 3c7e883...HEAD -- src/
tests/` reviewed in full: `src/gate.ts` `checkClosedItems`, new `citesImplementingReport` in
`src/roles.ts`, `tests/gate.test.ts` (+6 tests), new `tests/roles.test.ts`.

## What I attacked and could not break

- **Catastrophic backtracking / ReDoS.** `citesImplementingReport` on 100–380KB adversarial
  strings (repeated near-matches, repeated `_` restarting the suffix arm, no match at all):
  1ms each, called directly via `node --experimental-strip-types` importing `src/roles.ts`.
  No nested quantifiers in the pattern; linear. Rung 4.
- **`REPORT_KINDS[role]` undefined guard.** Present at `src/roles.ts:139`
  (`if (kind === undefined) continue;`). Read, rung 1; behavior not independently forced
  since no role in the shipped table is missing a kind, but the guard exists and is correct.
- **`noUncheckedIndexedAccess` on `latest`.** `src/gate.ts:403`
  (`const latest = legitimate[legitimate.length - 1]!;`) is safe: `legitimate.length === 0`
  returns at `src/gate.ts:393-396` before this line, so the `!` is justified, not just typed
  around. Read, rung 1.
- **Slug-boundary / prefix collisions across items.** `impl_storage.md` does not cite
  `storage-layer`; `impl_storage-layer.md` does not cite `storage`; `impl_storage-layer-2.md`
  does not cite `storage-layer`. Verified directly via the predicate. Rung 4.
- **The real ledger's stress case, `path-mstack-is-the-installed-copy`.** Rows 38/40/42 are
  `reviewer`/`verifier-failed` citing `review_..._r2.md`/`review_..._r3.md` (not `impl_*`, so
  `legitimate`), row 44 is `reviewer`/`live-verified` citing `review_..._r4.md`. All four are
  legitimate closing rows; `latest` = row 44 = `live-verified`, so neither new list fires. `./bin/mstack
  gate` on the repo root: `[ok] 18 closed item(s) carry a ledger verdict`. Confirms the step:
  it stays green because none of its rows ever cite an `impl_*` report at all — the reviewer
  never wrote evidence naming the implementer's file, so the new check has nothing to catch
  here and nothing to break either. Rung 5 (shipped CLI on the real store).
- **`escapedSlug` dead code.** Confirmed absent (`rg -n "escapedSlug" src/` → no output); the
  comment's claim that `SLUG` (`src/state.ts:49`) admits no regex metacharacter, enforced at
  `src/state.ts:143`, is accurate — read directly.
- **Bypass-teaching prose.** `rg -n "without triggering|don't put it in|bypass|evade"
  src/roles.ts src/gate.ts` → no output. Candidate A's Trade-offs sentence that taught the
  evasion wording did not ship. Confirmed.
- **Full verification obligation** (item 18's own `verification` field:
  `npm test && npm run typecheck && ./bin/mstack lint-plugin .`, which is also what `gate
  --full` runs): 283/283 tests green on `node --test` (both runtimes exercised per
  `npm test`), typecheck clean, `lint-plugin` 0 failures/0 warnings. Rung 5, pasted below.

## Findings, by severity

### 1. Case-insensitivity evades the citation check and functionally resolves to the real file (`src/roles.ts:141`)

The regex is case-sensitive (`new RegExp(...)`, no `i` flag). On this exact development
platform — Darwin/APFS, `diskutil info /` reports `File System Personality: APFS`
(case-insensitive, case-preserving), the platform this repo's own `CONTRIBUTING.md` and
`CLAUDE.md` target — a case-altered citation is not a lookalike string, it **is** the same
file:

```
$ diskutil info / | grep -i personality
   File System Personality:   APFS
$ cat /Users/romerma/Code/mstack/.mstack/progress/IMPL_CLOSING-ROW-CITES-OWN-REPORT.md | head -1
# impl: closing-row-cites-own-report
```

Reproduced end to end through the shipped CLI in a scratch store (rung 5):

```
$ mstack ledger record storage-layer $SHA live-verified \
    --evidence ".mstack/progress/impl_storage-layer.md" --verifier implementer
recorded live-verified for storage-layer at 54dfcf7b
$ mstack ledger record storage-layer $SHA live-verified \
    --evidence ".mstack/progress/IMPL_storage-layer.md" --verifier reviewer
recorded live-verified for storage-layer at 54dfcf7b
$ mstack gate
...
[ok]    1 closed item(s) carry a ledger verdict
PASSED - 0 failures, 2 warnings
exit: 0
```

Direct predicate check (rung 4), same result:
`citesImplementingReport(".mstack/progress/IMPL_storage-layer.md", "storage-layer")` → `false`.

This is exactly the forgery the check exists to catch — a reviewer row whose evidence is
literally the implementer's own report — evading detection with a one-line case change, on
the reference platform. It is not covered by the documented residual ("free prose that never
names the file") — the string *does* name the file, byte-for-byte on this filesystem — and it
is not in the judge's or the design docs' list of open-by-decision residuals
(`.mstack/progress/design_closing-row-cites-own-report_judge.md` "Holes both leave open" §1-5;
none mention case).

**Fix:** case-fold both sides before building/testing the pattern, or add the `i` flag to the
`RegExp` (kind/prefix strings are fixed-case constants, so `i` is safe and cheap), and add a
`tests/roles.test.ts` boundary case pinning it.

### 2. Unicode zero-width characters defeat the check *and* human review simultaneously (`src/roles.ts:141`)

```
$ EVIDENCE=$(printf '.mstack/progress/impl_storage-layer\xe2\x80\x8b.md')   # U+200B before .md
$ mstack ledger record storage-layer $SHA live-verified --evidence "$EVIDENCE" --verifier reviewer
recorded live-verified for storage-layer at 0844c3f5
$ mstack gate
...
[ok]    1 closed item(s) carry a ledger verdict
PASSED - 0 failures, 2 warnings
exit: 0
```

`impl_storage-layer​.md` renders visually identical to `impl_storage-layer.md` in every
terminal, editor and GitHub's TSV render (the reason this project chose TSV,
`src/tsv.ts:4-6`) that any of the personas in this workflow would use to review the ledger.
This is worse than finding 1: it is not merely a filter bypass, it is a string engineered to
look like a citation to a human reviewer while being a different string to the regex — the
exact double-blind spot `checkClosedItems` exists to close (the whole point being that a
human staring at the row and an automated check should agree). Confirmed via the shipped CLI,
rung 5.

Also confirmed via direct predicate call (rung 4): a Cyrillic homoglyph
(`іmpl_storage-layer.md`, U+0456 for the leading `i`) and a mid-token zero-width space both
return `false`.

**Fix:** at minimum, strip zero-width/format Unicode characters (`\p{Cf}` category, or the
specific `U+200B/U+200C/U+200D/U+FEFF` set) from `evidence` before testing, the same way
`src/tsv.ts:21` already strips tabs/newlines for a different injection concern. Full
confusable-normalization (NFKC + skeleton matching) is a larger effort and may be
legitimately out of scope, but the residual should then be stated in the comment — it
currently is not (see next finding).

### 3. Comment does not disclose the residual it actually has (`src/roles.ts:131-134`)

The judge's report explicitly required (`design_..._judge.md` "Also do" §2): *"State the
residual (hole 3 above) honestly in the code comment... this check stops the default path,
not a determined forger."* The shipped comment does state a residual, but only one:

```
 * Like `canCloseAnItem` above, this is a floor and not a proof: it stops the
 * default path, not a determined forger. Free prose that never names the file
 * passes, and nothing here can tell an honest description from a dishonest
 * one — that residual is irreducible while `evidence` is free text.
```

This is honest about *free prose*, which is indeed irreducible while evidence is free text.
But findings 1 and 2 above are not free prose — they are strings that *do* name the file
(exactly, on a case-insensitive filesystem, or visually to a human) while evading the check
for a reducible reason: the regex is case-sensitive and Unicode-naive, not because naming the
file in free text is inherently undetectable. Framing the residual as only "free prose passes"
implies a narrower, better-understood gap than the one that exists. A reader trusting this
comment would not know to distrust a case- or homoglyph-varied citation.

**Fix:** either close findings 1-2 (case-fold, strip zero-width/format characters) or extend
this comment to name them as open residuals, the way the "Holes both leave open" section of
the judge's report does for the ones it accepts.

### 4. Minor: `gate --full` (and bare `npm test`) is slow enough on this machine to trip a 120s harness timeout under mild concurrency

Not a defect in the reviewed diff — `--full` runs the item's own `verification` command
(`npm test && npm run typecheck && ./bin/mstack lint-plugin .`), unrelated to
`checkClosedItems`. Noted only because two concurrent invocations from this session (mine,
overlapping with a stray retry) stalled past 120s; a single clean run completed in ~40s
(`ℹ duration_ms 39434.638584`, pasted below) with everything green. Not a finding against this
change; recorded so the coordinator does not read the earlier timeout as a red gate.

## Acceptance, quoted

**"A done item whose only non-implementing row cites `impl_<slug>.md` as its evidence is
reported by `mstack gate`"** — met by `src/gate.ts:382-396` (`forgedEvidence` list) for the
literal-case, non-Unicode-adversarial form; confirmed by `tests/gate.test.ts:568-598` and the
scratch-A transcript in the implementer report. Not met for the case- and Unicode-varied forms
in findings 1-2 above, which the acceptance bullet's plain reading does not exclude.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| Forged self-citation refused | `tests/gate.test.ts:568` "a closing row citing the implementer's own report does not close the item" | Reverting `src/roles.ts`/`src/gate.ts` to `b27240e` and re-running fails this test (pasted in impl report, `.mstack/progress/impl_closing-row-cites-own-report.md:117-132`) — real regression check, not just presence |
| Unsuperseded verifier-failed refused | `tests/gate.test.ts:603` "an unsuperseded verifier-failed..." | Same red-without-fix proof |
| Boundary table (punctuation, quoting, spec-author) | `tests/roles.test.ts:11-63` | Direct unit table, 23 strings each way |
| Case-insensitivity / Unicode confusables | **none** | No test exists; findings 1-2 above are uncovered by design, not by omission of a planned test — no design doc or decision row mentions them |

## Verification I ran

```
$ ./bin/mstack gate
...
[ok]    18 closed item(s) carry a ledger verdict
...
PASSED - 0 failures, 1 warning
exit: 0

$ npm test && npm run typecheck && ./bin/mstack lint-plugin .
...
ℹ tests 283
ℹ pass 283
ℹ fail 0
...
> tsc --noEmit         (exit 0, no output)
...
PASSED - 0 failures, 0 warnings   (lint-plugin)
```
(Full pasted transcript for the `--full` obligation run, 283/283 green, typecheck clean, lint
clean: `/private/tmp/claude-501/-Users-romerma-Code-mstack/33ba8c18-6800-402f-bd97-2847ea6fb0ac/tasks/bw10sf1lf.output`.)

```
$ node --disable-warning=ExperimentalWarning --experimental-strip-types <probe importing src/roles.ts>
"IMPL_storage-layer.md" => false        # finding 1
"impl_storage-layer​.md" => false  # finding 2 (zero-width space)
"іmpl_storage-layer.md" => false        # finding 2 variant (Cyrillic і)
100KB/380KB adversarial strings: 1ms each, no ReDoS
```

Evidence ladder: findings 1-2 confirmed at rung 5 (shipped CLI, scratch store, pasted output
above and in this file); the homoglyph variant and the boundary/performance checks at rung 4
(real predicate called directly); the stress-case trace and dead-code/comment checks at rung 1
(read, cross-checked against the real ledger file).

## Changes required

1. `src/roles.ts:141` — the citation regex is case-sensitive; on the case-insensitive
   filesystem this repo's own dev environment runs on, a case-altered evidence string
   resolves to the identical file and is not caught. Add the `i` flag (or fold both sides)
   and pin it with a `tests/roles.test.ts` case.
2. `src/roles.ts:141` — no stripping of zero-width/format Unicode characters (U+200B and
   siblings) before matching, so a citation that renders visually identical to the real
   filename in every viewer this project's own TSV choice targets evades the check. Strip
   `\p{Cf}` (or the specific zero-width set) from `evidence` before testing, mirroring the
   tab/newline stripping already done for a different injection concern at `src/tsv.ts:21`.
3. `src/roles.ts:131-134` — the residual comment states only "free prose passes" as the gap;
   after fixing (or if knowingly leaving open) findings 1-2, update the comment to name them
   honestly, per the judge's explicit requirement to state the residual rather than let a
   reader believe the gap is narrower than it is.
