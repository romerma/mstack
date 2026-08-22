# Review round 2 - closing-row-cites-own-report (lens: TESTS)

**Verdict:** APPROVED

All three round-1 findings from this lens are closed or materially improved, and I closed
them by re-running my own matrices rather than by reading the implementer's report. Every
new round-2 code path is pinned by at least one test that dies when I break it, both
runtimes are green at 284, the two originally-committed red tests are still untouched, and
the four acceptance bullets still reproduce at rung 5 against the repository's own ledger.

Four things remain unpinned. All four are the same gap - **no test anywhere puts an
implementer-citing row and a spec-citing row in the same ledger, and nothing pins the
spec-side detail string** - and all four change only *which* failure message prints, never
whether the gate is red. No verdict-affecting behaviour is uncovered, so they are
non-blocking; the fix is one test and I have written it out below.

## Round-1 findings, closed by re-running my own probes

**Finding 1 (blocking): multi-role supersession unpinned.** CLOSED. I re-applied my exact
round-1 mutation - the `latest` block at `src/gate.ts:417` replaced by a per-verifier
"failure not cleared by a later same-verifier pass" scan - to the round-2 tree:

```
### f  verifier-scoped supersession  (exit 1)
     ✖ a later pass from a different closing role supersedes a failure (192.556584ms)
```

Exactly one test dies, and it is the new one at `tests/gate.test.ts:651`. The two sides use
genuinely different verifier strings: `verifier: "reviewer"` with `verifier-failed`
(`tests/gate.test.ts:656-661`), then `verifier: "review panel"` with `test-verified`
(`tests/gate.test.ts:666-672`), then `expectPass` (`:673`). `canCloseAnItem("review panel")`
is true, so both rows really are closing rows and the test exercises the branch it claims to.

**Finding 2 (non-blocking): detail strings unpinned.** PARTIALLY CLOSED - two of three push
sites.

```
### g1 blank forgedImpl detail       (exit 1)  ✖ a closing row citing the implementer's own report does not close the item
### g3 blank unsuperseded detail     (exit 1)  ✖ an unsuperseded verifier-failed closing row does not close the item
### g2 blank forgedSpec detail       (exit 0)  NOTHING FAILED
```

`tests/gate.test.ts:591-594` and `:632-635` pin the two details that existed in round 1. The
third push site, `forgedSpec.push` at `src/gate.ts:407`, was **added this round** and is
unpinned: replacing its argument with `""` leaves the whole suite green, and the gate would
print `items closed on a verdict whose evidence cites the spec-author's own report:` with
nothing after the colon. See finding A.

**Finding 3 (non-blocking): empty-suffix arm had unit coverage only.** CLOSED.
`impl_storage-layer_.md` is now in the gate-level refused list at `tests/gate.test.ts:696`,
and mutation (c) now kills both levels:

```
### c  suffix * -> +  (exit 1)
     ✖ a citation is the exact report filename as a whole token, however punctuated   <- gate level, new
     ✖ a citation is the exact report filename as a whole token                        <- unit
```

**Round-1 note: does `tests/gate.test.ts:220` pin fail-then-blocked?** I said in round 1 it
pinned the branch "non-exclusively" and left it at that. I have now checked it properly and
I was being vague where I could have run something. Mutation (v), making
`verifier-blocked` count as a failure at `src/gate.ts:418`:

```
### v  blocked counts as failed (exit 1)
     ✖ an item closed on a failed verifier is rejected (131.317167ms)
```

Exactly and only `tests/gate.test.ts:220` dies. The branch is pinned exclusively. Round 2 did
not touch that test; my round-1 characterisation was the thing that was wrong, and it is
withdrawn.

## Revert matrix (round 2)

Worktree at HEAD `0a4ea73`, `node --test tests/gate.test.ts tests/roles.test.ts`, 70 tests in
those two files.

**src reverted to `b16aa45^` (pre-item):** 70 tests, 63 pass, **7 fail** - the same seven as
round 1. Nothing in the item's test surface survives a full revert.

**src reverted to `dfa78f0` (round-1 src)** - the sharper question, because it isolates what
round 2 bought: 70 tests, 67 pass, **3 fail**.

| Round-2 test / assertion | vs. round-1 src | Why |
|---|---|---|
| `roles.test.ts:41-42` case probes, `:45-46` zero-width probes, `:36-37` role-valued spec assertions | RED (`a citation is the exact report filename as a whole token`) | round-1 predicate returns `true`/`false` and is case- and Cf-sensitive |
| `gate.test.ts:691` `IMPL_STORAGE-LAYER.MD`, `:694` U+200B, `:696` `impl_storage-layer_.md` | RED (`a citation is the exact report filename as a whole token, however punctuated`) | same |
| `gate.test.ts:754` `/spec-author's own report/` | RED (`a closing row citing the spec-author's own report does not close the item`) | round-1 printed the implementer wording for a spec citation |
| `gate.test.ts:651` multi-role supersession | **GREEN** | correct behaviour, not new behaviour |
| `gate.test.ts:591-594`, `:632-635` detail assertions | **GREEN** | same |

The last two rows are not a defect and I want to be explicit about why, because "green
against old src" was my own round-1 test for whether something pins anything. These two pin
behaviour round-1 code already had; a revert cannot distinguish them. Their proof is the
mutation matrix - (f) kills the first, (g1)/(g3) kill the second - and that proof is
sufficient. Restored to HEAD: 70 pass, 0 fail.

## Mutation matrix (round 2)

One at a time in a worktree, `git checkout HEAD -- src/` between each,
`node --test tests/gate.test.ts tests/roles.test.ts`. Seventeen mutations: my five round-1
ones re-run, the four the coordinator named, and eight of my own on the new code.

| # | Mutation | Caught by |
|---|---|---|
| a | leading class -> `[\s/]` | gate `:679`, roles `:13` |
| b | trailing lookahead -> `[\s,;:]` | gate `:679`, roles `:13` |
| c | suffix `*` -> `+` | gate `:679` (**new this round**), roles `:13` |
| d | drop the forged filter (`legitimate = closingRows`) | gate `:568`, `:679`, `:737`, `:786` |
| e | `latest` from `closingRows` | gate `:786` |
| f | verifier-scoped supersession | gate `:651` (**new this round**) |
| g1 | blank `forgedImpl` detail | gate `:568` (**new this round**) |
| g2 | blank `forgedSpec` detail | **NOTHING FAILED** - finding A |
| g3 | blank `unsupersededFailure` detail | gate `:609` (**new this round**) |
| h | loop only `implementer` | gate `:737`, roles `:13` |
| i | drop the `i` flag (`src/roles.ts:158`) | gate `:679`, roles `:13` |
| ii | drop the `\p{Cf}` strip (`src/roles.ts:153`) | gate `:679`, roles `:13` |
| iii | predicate returns constant `"implementer"` for any match | gate `:737`, roles `:13` - the two kind lists **are** distinguished |
| iv | swap the two kind messages (`src/gate.ts:441-452`) | gate `:568`, `:679`, `:737` |
| v | `verifier-blocked` counts as failed | gate `:220` |
| vi | force every forged item onto the spec list | gate `:568`, `:679` |
| vii | `IMPLEMENTING_ROLES` order flipped (`src/roles.ts:101`) | **NOTHING FAILED** - finding B |
| viii | both-kinds tie-break routes to the spec list | **NOTHING FAILED** - finding B |
| ix | detail ignores the cited kind entirely | gate `:737` (via routing, not via the detail text) |
| x | impl detail lists every cited verifier, routing untouched | **NOTHING FAILED** - finding C |

Every mutation the coordinator named - (i), (ii), (iii), (iv) - is caught, and (iii)
answers its own question: the two kind lists are distinguished, by `tests/gate.test.ts:737`
end to end and by `tests/roles.test.ts:36-37` as a unit.

## Suite hygiene at HEAD

- Both runtimes, `npm test` in the main checkout, exit 0:

```
 284 pass
 0 fail
Ran 284 tests across 16 files. [36.10s]
...
ℹ tests 284
ℹ pass 284
ℹ fail 0
```

  284, up 1 from round 1's 283 - the single new test is `tests/gate.test.ts:651`. The
  other round-2 additions are probes and assertions inside existing tests, which is why the
  count moved by one and not by six.
- `git diff b27240e HEAD -- tests/`: **still zero deleted lines.** The two originally
  committed red tests (`tests/gate.test.ts:568`, `:609`) took additions only.
- `git diff dfa78f0 HEAD -- tests/` does delete 19 lines, and I checked each. Eighteen are
  the `roles.test.ts` array refactor from `string[]` to `[string, role][]`, plus the two
  assertions moving from `true`/`false` to a role name/`undefined` (`tests/roles.test.ts:67`,
  `:70`) - strictly stronger, and I verified programmatically that **all 15 round-1 probe
  literals survive verbatim at HEAD** (`deleted probe literals: 15 | still present at HEAD:
  15 | gone: none`). The nineteenth is the spec test's regex swap at `tests/gate.test.ts:754`,
  which mutations (iii) and (iv) prove is a discriminating assertion, not a loosened one.
  Nothing was weakened to get green.
- No `.only`, `.skip`, `TODO`, `FIXME` or `XXX` anywhere in `tests/gate.test.ts` or
  `tests/roles.test.ts`.
- `./bin/mstack gate --full` at `0a4ea73`: `[ok] 18 closed item(s) carry a ledger verdict`,
  verification `[ok] npm test && npm run typecheck && ./bin/mstack lint-plugin .`,
  `PASSED - 0 failures, 1 warning` (the warning is the mid-session uncommitted tree),
  exit 0.

## Acceptance, quoted (re-verified at rung 5 on the round-2 tree)

I re-ran the round-1 rung-5 procedure against the round-2 code rather than assuming it
carried over: real `./bin/mstack` as a process, real `.mstack/ledger.tsv` in a throwaway
worktree, the sole closing row of the real closed item `panel-followup-prose` rewritten.

**"A done item whose only non-implementing row cites impl_<slug>.md as its evidence is
reported by mstack gate"** - met. Plus the two shapes that escaped in round 1:

```
--- 0 untouched real ledger, round-2 src
    [ok]    18 closed item(s) carry a ledger verdict
--- 2 upper-case impl citation
    [fail]  items closed on a verdict whose evidence cites the implementer's own report: panel-followup-prose (reviewer)
--- 3 zero-width U+200B inside the filename
    [fail]  items closed on a verdict whose evidence cites the implementer's own report: panel-followup-prose (reviewer)
--- 4 BOM + U+200D joiner
    [fail]  items closed on a verdict whose evidence cites the implementer's own report: panel-followup-prose (reviewer)
--- 2' upper-case, ROUND-1 src
    [ok]    18 closed item(s) carry a ledger verdict
--- 3' zero-width, ROUND-1 src
    [ok]    18 closed item(s) carry a ledger verdict
```

Green before, red after, in the running system, for each new hole.

**"Evidence that is free prose rather than a path is unaffected, proven against every row
currently in this repo's ledger"** - met. I re-ran the sweep with the *widened* predicate,
since `i` and `\p{Cf}` both widen what matches:

```
rows: 53 | cite an implementing report: 23 {"implementer":23} | from a closing role: 0
```

Zero false positives. My 53/23 reconciles with the implementer's 52/22 (`impl_...md:324-327`)
by exactly the round-2 ledger row they appended after running theirs; the conclusion is
unchanged. The untouched real gate agrees: `[ok] 18 closed item(s) carry a ledger verdict`.

**"The check is proven at rung 5 by a row that passes today and is refused after"** - met,
transcript above, both srcs, both new shapes.

**"A done item carrying an unsuperseded verifier-failed row from a non-implementing role is
refused by mstack gate..."** - met and untouched this round; `tests/gate.test.ts:609` still
goes red against pre-item src, mutation (g3) now also pins its detail, and the round-1
rung-5 transcript on `editable-item-fields` stands.

New this round and also reproduced at rung 5 - the spec-author message path:

```
--- 1 spec-author citation (new message path)
    [fail]  items closed on a verdict whose evidence cites the spec-author's own report: panel-followup-prose (reviewer)
```

## Findings (all non-blocking)

**A. The spec-author detail string is unpinned** - `src/gate.ts:407`. Blanking it
(`forgedSpec.push("")`) leaves all 70 tests in the two files green. `tests/gate.test.ts:754`
asserts only `/spec-author's own report/`; the sibling impl and unsuperseded tests both got a
`storage-layer \(reviewer\)` assertion this round (`:591-594`, `:632-635`) and this one did not. It
is the newest of the three push sites and the only one still open. **Fix:** add to
`tests/gate.test.ts:754` the same two lines used at `:591-594`:
`assert.ok(gate(sb).failures.some((f) => /storage-layer \(reviewer\)/.test(f)), ...)`.

Related accuracy note, not a code defect: the round-2 report's change 7
(`impl_closing-row-cites-own-report.md:245`) says the detail assertions "kill tests-report
mutation (g)". That is true of mutation (g) exactly as I wrote it in round 1, which targeted
the then-single `forgedEvidence.push`. It reads as though the class is closed, and the class
is not - the same commit added a third site and left it open. Worth a sentence at close.

**B. The both-kinds tie-break is documented but unpinned** - `src/roles.ts:111-113` ("a row
citing both kinds reports `implementer`, the set's first entry") and `src/gate.ts:396-402`
("an item whose rows cite both kinds lands on the implementer list"). Two mutations, each
targeting exactly one of those two sentences, leave the suite green: flipping
`IMPLEMENTING_ROLES` to `new Set(["spec-author", "implementer"])` (`src/roles.ts:101`), and
routing the both-kinds case to the spec list (`src/gate.ts:404`). No test string cites both
kinds, so nothing can tell. **Fix:** one tuple in `tests/roles.test.ts` -
`["impl_storage-layer.md and spec_storage-layer.md", "implementer"]` - kills the first; a
gate test with two forged closing rows, one citing each kind, asserting the message names the
implementer, kills the second.

**C. Kind-scoped detail contents are unpinned on the mixed shape** - `src/gate.ts:405`.
Making the impl detail list *every* cited verifier while leaving routing alone (mutation x)
leaves the suite green, because every test with a forged row has rows of one kind only, where
the two expressions coincide. This is precisely the correctness lens's finding 4 that the
implementer folded in at `src/gate.ts:401-402`; the code is right and nothing holds it there.
Mutation (ix) does die, but via the routing condition, not the detail text, so it is not
cover for this. **Fix:** the same mixed-kind gate test as B, asserting the impl detail names
only the impl-citing verifier.

A, B and C are one test apart: a single gate test whose ledger holds an impl-citing row from
`reviewer` and a spec-citing row from `spec-reviewer`, plus a detail assertion on the spec
test and one both-kinds tuple in the unit table, closes all three.

## Evidence rungs

- Revert matrices, mutation matrix (all 17), suite counts, hygiene, deleted-line audit:
  **rung 4** - ran the real code in a throwaway worktree and read failures by name. The
  probe-literal survival check and the zero-deletions check are **rung 2** (`git diff` and a
  string containment scan over the two revisions).
- The four acceptance bullets, the two new holes (case, zero-width) and the new spec-author
  message path: **rung 5** - shipped `./bin/mstack` driven as a process against the
  repository's own store, green-before / red-after in both src directions.
- Findings A, B, C: **rung 4** - each mutation ran and the suite stayed green at exit 0. That
  the shipped *behaviour* is correct in each case is **rung 3** (read `src/gate.ts:396-409`
  and `src/roles.ts:152-161`, and rung 5 for the spec message via the transcript above); what
  is missing is the test, which is the finding.
- Withdrawal of my round-1 note about `tests/gate.test.ts:220`: **rung 4** - mutation (v) kills
  exactly that test.
- Not established at rung 4, said plainly: I did not fuzz `\p{Cf}` beyond the four code points
  the implementer's probe covers (U+200B/C/D, U+FEFF, `impl_...md:250-257`), and I did not
  test any non-Cf invisible or homoglyph class. The predicate's comment now names homoglyphs
  as open residual (`src/roles.ts:143-151`), which is the honest place to leave it, but the
  boundary of `\p{Cf}` itself is a rung-3 reading of the Unicode category on my part, not
  something I ran exhaustively. Security lens' territory; flagging rather than settling.
- `./bin/mstack ledger check closing-row-cites-own-report` at `0a4ea73`:
  `FAIL no verdict at 0a4ea73c; 2 row(s) exist at other SHAs and a new head SHA voids them`.
  Both existing rows are the implementer's own (`b16aa45`, `5b2ec33`) and commit `0a4ea73`
  moved head past the second. Expected mid-panel and the coordinator's to resolve; per my
  instructions I recorded no row. Whatever the panel lands must be recorded at `0a4ea73` or
  later, and the implementer's row needs re-recording at head if anything downstream reads it.

## What I checked that was clean

The two originally-committed red tests are byte-identical apart from added assertions; the
gate-level tests still go through the real `runGate` on a per-probe sandbox
(`tests/gate.test.ts:703-735`, fresh `sandbox()` inside each loop iteration, so no row leaks
between probes); `expectFail` still asserts both failure and message match
(`tests/helpers.ts:193-199`); `tsconfig.json:16` still covers `tests/**/*.ts` and both
runners report the same 284; no debug output, no dead code, and no test in the item's surface
that passes against every mutation of the thing it names.
