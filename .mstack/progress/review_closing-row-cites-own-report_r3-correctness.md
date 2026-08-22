# Review round 3 - closing-row-cites-own-report (lens: correctness and requirement coverage)

**Verdict:** APPROVED

Both of my round-2 findings are closed by tests I killed mutants against myself, and the docs
nit is closed at a stricter standard than I asked for. `src/` did not move, so nothing I
verified in rounds 1 and 2 needs re-deriving; I re-confirmed that mechanically rather than by
reading the diff, and spot-checked the shipped behaviour anyway.

## `src/` is byte-identical to 0a4ea73

Not "the diff looks empty" — the tree object hash:

```
=== src/ diff 0a4ea73..HEAD ===
(empty)
=== hash check on src/ tree object ===
0a4ea73: a8a6acae410d529e0d9df0cc4f3141bd9804401b
HEAD:    a8a6acae410d529e0d9df0cc4f3141bd9804401b
```

Same hash means same bytes, recursively. My scratch clone at `70a5e30` reports the same
`HEAD:src` hash, so the tree I ran mutations against is the tree under review. Every
correctness conclusion from rounds 1 and 2 — the four acceptance bullets at rung 5, the
sentence-truth table, the ledger trace, the `\p{Cf}` and case semantics — carries forward
unchanged by construction.

## My round-2 findings, re-verified by mutation

Scratch clone at `70a5e30` (a clone rather than a worktree: strictly more isolated, and it
never touches the repo's `.git`). `node --test tests/gate.test.ts tests/roles.test.ts`,
baseline **72 pass / 0 fail**, `git checkout HEAD -- src/` between every run.

**Finding A — both-kinds tie-break.** My exact r2 mutation, `src/gate.ts:404`
`if (implVerifiers.length > 0)` → `if (implVerifiers.length > 0 && verifiers("spec-author").length === 0)`:

```
########## MUTATION: my r2 finding A - prefer SPEC when both kinds are cited
✖ mixed-kind citing rows land on the implementer list, naming its citers (144.986917ms)
ℹ pass 71
ℹ fail 1
```

Was 70/70 green in round 2. The test that now dies is **`tests/gate.test.ts:790`**, "mixed-kind
citing rows land on the implementer list, naming its citers".

**Finding B — role label typo.** My exact r2 mutation, `src/gate.ts:407`
`verifiers("spec-author")` → `verifiers("spec_author")`:

```
########## MUTATION: my r2 finding B - role label typo spec_author
✖ a closing row citing the spec-author's own report does not close the item (225.53ms)
ℹ pass 71
ℹ fail 1
```

Was 70/70 green in round 2. The test that now dies is **`tests/gate.test.ts:737`**, via the new
assertion at `tests/gate.test.ts:758` (`/storage-layer \(spec-reviewer\)/`). That is exactly the
`storage-layer ()` empty-detail shape I demonstrated at rung 5 in r2, now caught.

**Two further mutations of my own, to check the fix is not narrower than it looks:**

| Mutation | Result | Test that dies |
|---|---|---|
| reverse `IMPLEMENTING_ROLES` insertion order (`src/roles.ts:101`) | **2 fail** | `a row citing both kinds lands on the implementer list` (`tests/gate.test.ts:766`) + the roles table (`tests/roles.test.ts:40`) |
| drop the verifier detail from `forgedSpec` (`src/gate.ts:407`) | **1 fail** | `a closing row citing the spec-author's own report...` (`tests/gate.test.ts:737`) |

**The two-layer point is real, and round 3 got it right.** The tie-break exists at two layers,
and my r2 prescription named only one of them. A single row citing both kinds is resolved
inside the predicate (set order, `src/roles.ts:137-143`), so it never reaches the gate's
`else` — my swap mutation cannot kill a single-row test, and the single-row test cannot kill
the order flip. Round 3 pinned each layer at the layer that owns it: `tests/roles.test.ts:40`
and `tests/gate.test.ts:766` for the predicate, `tests/gate.test.ts:790` for the gate. I
verified the split by running both mutations and watching different tests die. The round-3
report states this complication rather than papering over it, and its pasted mutation counts
(71/1, 70/2, baseline 72/0) reproduce exactly against my independent runs.

**Finding C — the wiki block, held to my r2 standard.** I built a fresh three-item scratch
store and took the output of **one** `./bin/mstack gate` invocation:

```
=== ONE real gate run, three items ===
[fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)
        fix: a closing verdict needs evidence from the closing pass's own work, not a pointer to the implementer's report; re-run the check and record what actually happened
[fail]  items closed on a verdict whose evidence cites the spec-author's own report: other-item (spec-reviewer)
        fix: a closing verdict needs evidence from the closing pass's own work, not a pointer to the spec-author's report; re-run the check and record what actually happened
[fail]  items marked done whose most recent closing verdict is verifier-failed: third-item (reviewer)
        fix: the ledger is append-only, so the failed row stays; a later verdict from a closing role is what clears it — re-run the review after the fix and record a fresh one
=== exit code of that single run ===
exit=1
=== diff: wiki block (left) vs that one real run (right) ===
IDENTICAL byte-for-byte, from ONE run
```

`docs/wiki/Gates-and-Hooks.md:214-219` is now reproducible by a single run, not assembled from
three. The added sentence at `:222` — "an item lands on at most one of these lists, so three
lines naming one slug is a state no single run can print" — is true: `continue` at
`src/gate.ts:409` and the `if`/`else` at `:404-408` make the lists mutually exclusive per item.
Closed at a stricter standard than I asked for, since I only required either fixing the slugs
*or* adding a caveat, and the change does both.

## Verification I ran

`./bin/mstack gate --full` at the repo root — exit 0.

```
[ok]    one active item: closing-row-cites-own-report (reviewing)
[ok]    18 closed item(s) carry a ledger verdict
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[warn]  12 uncommitted change(s); expected mid-session, not at close

 286 pass
 0 fail
Ran 286 tests across 16 files. [37.62s]

ℹ tests 286
ℹ pass 286
ℹ fail 0

PASSED - 0 failures, 0 warnings
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .

PASSED - 0 failures, 1 warning
EXIT=0
```

Both runtimes at **286/286** (was 284 in round 2; +2 gate tests). Typecheck clean, `lint-plugin`
`PASSED - 0 failures, 0 warnings`, `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`
→ `100 relative links checked, 0 broken`.

**No test weakened.** The entire round-3 test diff contains exactly one deletion line:

```
=== all deletion lines in the round-3 test diff ===
-      verifier: "reviewer",
```

That is `tests/gate.test.ts:741` changing to `spec-reviewer` so the spec list's detail is
distinguishable from the impl list's — a strengthening, and it is what makes the finding-B
mutation detectable. `tests/gate.test.ts` went from 69 tests to 71; nothing was removed.

**Shipped behaviour spot-check** (rung 5, my round-2 scratch stores replayed against the
current `./bin/mstack`, since a byte-identical `src/` should behave identically and I would
rather see it than assume it):

```
r2_spec:           ...cites the spec-author's own report: storage-layer (spec-reviewer)
r2_impl:           ...cites the implementer's own report: storage-layer (reviewer)
r2_both_one_row:   ...cites the implementer's own report: storage-layer (reviewer)
r2_both_two_rows:  ...cites the implementer's own report: storage-layer (alice)
r2_clean:          1 closed item(s) carry a ledger verdict
```

Identical to round 2, every line.

## Residuals, unchanged and now better disposed

- **My r2 finding D** (mixed-kind rows: `bob`'s spec-citing row goes unmentioned) is
  behaviourally unchanged — `r2_both_two_rows` still prints `(alice)` alone. But it has moved
  from undocumented incidental behaviour to a **pinned contract**: `tests/gate.test.ts:790` now
  asserts it deliberately, and `src/gate.ts:396-400` explains it. That is the right disposition
  for an accepted residual — it can no longer change by accident. I still think pushing to both
  lists would be truer *and* complete, but as a recorded, tested decision it is not a defect and
  I am not holding the item for it.
- **My r2 finding E** (`|| "unnamed"` unreachable on the two forged lists, `src/gate.ts:405,407`)
  is unchanged and remains cosmetic.
- The residuals disclosed in `src/roles.ts:143-151` — free prose, homoglyphs, wrong-slug
  citations — are unchanged and honestly stated.

## Not a code finding, for the coordinator

`./bin/mstack ledger check closing-row-cites-own-report` is red at head `70a5e30`:
`FAIL no verdict at 70a5e30f; 3 row(s) exist at other SHAs and a new head SHA voids them`.
Structural and now in its third round — the report commit voids the row it contains. I recorded
no row, per the panel protocol. The synthesized verdict needs recording at whatever SHA is head
when the panel lands.

## Evidence ladder

Mutation results and the named dying tests: **rung 3**, run by me against a clone of the tree
under review. The wiki one-run reproduction, the exit code, and the shipped-behaviour
spot-check: **rung 5**, through `./bin/mstack` against scratch stores I built. The
byte-identity of `src/`: **rung 4** — a git tree-object hash comparison, which is stronger than
reading the diff and is why rounds 1 and 2 carry forward without re-derivation. The test-count
delta and deletion sweep: **rung 1**, read against the diff, and I say so.
