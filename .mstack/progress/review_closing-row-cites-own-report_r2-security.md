# Review round 2 - closing-row-cites-own-report (security-and-failure-paths lens)

**Verdict:** APPROVED

## Scope

Round-2 diff `dfa78f0..0a4ea73` (`c90c2dd` fix, `5b2ec33` wiki, `0a4ea73` report). Verified
against my own round-1 report's three findings by re-running my own probes against the
shipped CLI and the real predicate — not by reading the implementer's pastes — then attacked
the round-2 changes themselves independently.

## My round-1 findings, re-verified

### 1. Case-insensitivity evasion — CLOSED

`src/roles.ts:158` now carries the `i` flag. Re-ran my own `IMPL_` scratch transcript fresh
(new scratch store, not reused), plus a mixed-case + upper-extension variant I had not tried
in round 1:

```
$ mstack ledger record storage-layer $SHA live-verified --evidence ".mstack/progress/impl_storage-layer.md" --verifier implementer
$ mstack ledger record storage-layer $SHA live-verified --evidence ".mstack/progress/IMPL_storage-layer.md" --verifier reviewer
$ mstack gate
[fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)
FAILED - 1 failure, 2 warnings
EXIT=1
```

```
$ mstack ledger record storage-layer $SHA live-verified --evidence ".mstack/progress/Impl_Storage-Layer.MD" --verifier reviewer
$ mstack gate
[fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)
FAILED - 1 failure, 2 warnings
EXIT=1
```

Both refused. Rung 5 (shipped CLI, fresh scratch stores, both under
`/private/tmp/.../scratchpad/store-r2{a,b}`).

### 2. Zero-width character evasion — CLOSED

Re-ran my round-1 U+200B printf transcript fresh, plus U+FEFF (BOM, leading) and U+200D
(ZWJ, mid-token, joining `storage` and `-layer`) which I had not tried in round 1:

```
$ EV1=$(printf '.mstack/progress/impl_storage-layer\xe2\x80\x8b.md')   # U+200B
$ mstack ledger record storage-layer $SHA live-verified --evidence "$EV1" --verifier reviewer
$ mstack gate
[fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)
```

```
$ EV2=$(printf '\xef\xbb\xbf.mstack/progress/impl_storage\xe2\x80\x8d-layer.md')  # U+FEFF + U+200D
$ mstack ledger record storage-layer $SHA live-verified --evidence "$EV2" --verifier reviewer
$ mstack gate
[fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)
```

Both refused. Rung 5, fresh scratch stores `store-r2{c,d}`.

### 3. Residual comment discloses what actually remains open — CLOSED

Moved to `src/roles.ts:143-150` (was `:131-134`). Current text, read directly:

> "Like `canCloseAnItem` above, this is a floor and not a proof: it stops the default path,
> not a determined forger. What remains open: free prose that never names the file passes,
> and nothing here can tell an honest description from a dishonest one while `evidence` is
> free text; a Unicode homoglyph (a Cyrillic letter standing in for a Latin one) is a
> different string to this check and an identical-looking one to a reader; and a citation of
> a *different* item's report is invisible here, because the prefix is built from the audited
> item's own slug."

Names exactly the three residuals still open (free prose, homoglyphs, wrong-slug), matches
what I could still break below, and contains no wording that instructs how to construct an
evasion — it states the fact of the gap, not a recipe. `rg -n "without triggering|don't put
it in|bypass|evade" src/roles.ts src/gate.ts` → no output, unchanged from round 1.

## Attacking the round-2 changes themselves

### `\p{Cf}`-strip false positives

Probed for evidence where stripping invisible format characters joins unrelated fragments
into an accidental citation (rung 4, direct predicate calls):

```
"reviewed the fix​, all good, ran the suite myself" => undefined   (Cf present, no filename shape at all)
"impl detail: storage layer looks fine, no report cited" => undefined
"the impl_storage-layer.md.old backup was stale, unrelated to this review" => implementer
"grep -c impl_storage-layer_test.md fixtures/*" => implementer
"impl​_storage-layer.md" (Cf char inside the prefix) => implementer
```

The last three are all matches, but none of them are new: `...md.old` matches because a
trailing `.` was already decided as punctuation in round 1 (`decisions.tsv` row `2026-08-
22T16:14:07.640Z`, pinned by `impl_storage-layer.md.` in `tests/roles.test.ts`); the
`_test.md` suffix-arm match is the documented "not a directory read" over-inclusiveness from
round 1; and the Cf-joined case is exactly what change 2 is *for* — a citation split by an
invisible character is still a citation. The only way to trigger the join is to place Cf
characters directly inside or immediately around the literal filename characters, which is
indistinguishable from finding 2's deliberate evasion and not a shape ordinary prose produces
by accident. Refusing it is the correct, safe-direction call, not a bug — confirmed by
reasoning plus the four probes above; no accidental-prose false positive found.

### `i`-flag over-match on the real ledger

Re-ran the widened-predicate sweep myself, independently, against `.mstack/ledger.tsv` at the
current HEAD (`0a4ea73`), using the real `citesImplementingReport`/`canCloseAnItem` from
`src/roles.ts` and `readRecords` from `src/tsv.ts` — not the implementer's numbers:

```
total rows: 53
rows citing an implementing report (own item's slug): 23
of which from a closing role: 0
closing-role rows newly caught by i-flag/Cf-strip widening (vs. the case-sensitive,
no-strip round-1 predicate, same file): 0
```

Zero closing-role false positives, and the widening (case-fold + Cf-strip) catches nothing
on real history that the round-1 predicate did not already miss for other reasons. Rung 4
(real module, real ledger file, my own script). `./bin/mstack gate` at the repo root
independently confirms: `[ok] 18 closed item(s) carry a ledger verdict`, rung 5.

### Forged list split by kind — truthfulness

Both-kinds row (evidence citing both `impl_storage-layer.md` and `spec_storage-layer.md` in
one string), rung 5:

```
$ mstack ledger record storage-layer $SHA live-verified \
    --evidence "see .mstack/progress/impl_storage-layer.md and .mstack/progress/spec_storage-layer.md" \
    --verifier reviewer
$ mstack gate
[fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)
```

True: the row does cite the implementer's report (`IMPLEMENTING_ROLES` is a `Set` with
`implementer` inserted first, so it is checked first and wins ties — deterministic, not a
race). It does not claim the row cites *only* the implementer's report, so it is not false by
omission either.

Pure spec-only citation, verifier `spec-reviewer`, no implementer-citing row anywhere in the
ledger for this item, rung 5:

```
$ mstack ledger record storage-layer $SHA live-verified \
    --evidence ".mstack/progress/spec_storage-layer.md" --verifier spec-reviewer
$ mstack gate
[fail]  items closed on a verdict whose evidence cites the spec-author's own report: storage-layer (spec-reviewer)
```

Correctly names the spec-author, not the implementer — a maintainer reading this is pointed
at the file that actually exists.

### Cyrillic homoglyph and other lookalike-character probes

Re-confirmed the round-1 Cyrillic probe still evades and is now disclosed (quoted above).
Additionally probed the classes the coordinator named — combining characters, fullwidth
letters, NFKC-distinct forms — rung 4, direct predicate calls, plus a check of what NFKC
normalization alone would have done:

```
Cyrillic і (U+0456) for latin i:        raw => undefined   NFKC => undefined  (no NFKC relation; disclosed)
i + combining dot above (U+0307):       raw => undefined   NFKC => undefined  (does not compose; weak visual disguise, same residual)
fullwidth i (U+FF49):                   raw => undefined   NFKC => implementer (!)
ł (U+0142) for l:                       raw => undefined   NFKC => undefined  (no NFKC relation; disclosed)
```

Three of the four are the same disclosed class (a different codepoint, no relation to the
ASCII one that any normalization would recover) — consistent with "a Unicode homoglyph... is
a different string to this check," not new.

The fullwidth form is the one worth naming precisely: Unicode defines it as a *compatibility*
variant of ASCII `i` (its NFKC form is literally `i`), which is a narrower, more mechanical
relationship than "a different script's lookalike letter" — the comment's own example is
specifically "a Cyrillic letter," and a fullwidth Latin letter is not that, even though the
practical effect (a string that evades the check while reading close to the real filename) is
the same category the comment already accepts as open. I judge this **covered by the
disclosed residual in substance, not a new undisclosed class**, but flagging it precisely
because closing it is unusually cheap relative to the other two open items (free prose and
cross-script homoglyphs, which are open by hard necessity): `evidence.normalize("NFKC")`
before the existing `\p{Cf}` strip would close the fullwidth case for the cost this round
already paid for case-folding, without touching the free-prose or cross-script residuals. Not
blocking — noting it for the coordinator to decide whether it is worth a follow-up item,
since round 2 already went further than the panel required.

## Verification I ran (independent of the implementer's pastes)

```
$ git log --oneline dfa78f0..HEAD
0a4ea73 docs: round-2 implementer report section and ledger row for item 18
5b2ec33 docs: all six closed-item refusal classes in Gates-and-Hooks
c90c2dd fix: close case, zero-width, and wrong-kind holes in the citation audit

$ ./bin/mstack gate            (repo root, HEAD 0a4ea73)
[ok]    18 closed item(s) carry a ledger verdict
PASSED - 0 failures, 1 warning

$ npm test                      (fresh run, this session)
ℹ tests 284
ℹ pass 284
ℹ fail 0
ℹ duration_ms 19403.742958

$ node --experimental-strip-types perf probe: 100-150KB adversarial strings
  (long near-miss runs, and Cf-character-heavy strings) through the widened
  predicate (i-flag + \p{Cf} strip): 2ms each. No ReDoS regression from the
  new `.replace(/\p{Cf}/gu, "")` or the `i` flag.
```

Evidence ladder: findings 1-2 re-verification and the both-kinds/spec-only message probes at
rung 5 (shipped CLI, fresh scratch stores under
`/private/tmp/claude-501/-Users-romerma-Code-mstack/33ba8c18-6800-402f-bd97-2847ea6fb0ac/scratchpad/store-r2{a,b,c,d,e,f}`).
The Cf-false-positive sweep, the i-flag real-ledger sweep, the performance probe and the
homoglyph/combining/fullwidth/NFKC probes at rung 4 (real `src/roles.ts` module called
directly, real `.mstack/ledger.tsv`). The comment re-read at rung 1.

## Changes required

None blocking. Optional follow-up, not requested of this round and not a condition of
approval: `evidence.normalize("NFKC")` before the `\p{Cf}` strip at `src/roles.ts:153` would
close the fullwidth-Latin variant noted above at the same low cost as the case-fold; leave
open otherwise as part of the disclosed homoglyph residual.
