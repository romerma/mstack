# Review round 2 - closing-row-cites-own-report (lens: correctness and requirement coverage)

**Verdict:** CHANGES_REQUESTED

All three of my round-1 blocking findings are closed, and I re-ran every probe that produced
them rather than reading the change map. The kind split is the right resolution and it is
executed cleanly: every sentence the gate can now print is literally true of the shape that
produced it, including the both-kinds row, which I probed live as asked. The full chain is
green.

What I cannot approve is the coverage of the new behaviour. Two claims the round-2 diff
introduces - the both-kinds tie-break, and the role labels the kind split is keyed on - are
defended by no test at all: I mutated each one and the suite stayed 70/70 green. One of them
ships a visibly broken message when mutated, and it is broken in exactly the way an assertion
added *in this same commit* was written to prevent on the other two lists. That is a bounded
ask - one assertion and one test - not a re-do.

## My round-1 findings, re-verified

| # | Round-1 finding | Status | My own evidence |
|---|---|---|---|
| 1 | `forgedEvidence` message/remedy said "the implementer's own report" on a spec citation | **closed** | rung 5, re-ran my `r2_spec` scratch store - see below |
| 2 | `tests/gate.test.ts:704` pinned the false wording | **closed** | now `tests/gate.test.ts:754`, `/spec-author's own report/`; mutation-confirmed as the kind split's only defence |
| 3 | `docs/wiki/Gates-and-Hooks.md` enumerated 3 of the refusals | **closed** (one nit, finding C) | 6 classes counted in `src/gate.ts` by me; wiki block diffs byte-identical against real runs |
| 4 | detail built from all `closingRows`, not the citing subset | **closed** | `src/gate.ts:401-402` filters `cited` by role; rung-5 probe below shows only that kind's verifiers |
| 5 | partial diagnosis on forged-pass-after-genuine-fail (left open as residual) | **unchanged; strictly better in the mixed-kind shape** | see finding B |
| 7 (note) | predicate case-sensitive while `canCloseAnItem` lowercases | **closed** | `i` flag at `src/roles.ts:158`; rung-5 probe below |

**Finding 1 and 2, re-run.** Same scratch store shape as round 1: one done item, one row
`--evidence ".mstack/progress/spec_storage-layer.md" --verifier spec-reviewer`, nothing else.

```
[fail]  items closed on a verdict whose evidence cites the spec-author's own report: storage-layer (spec-reviewer)
        fix: a closing verdict needs evidence from the closing pass's own work, not a pointer to the spec-author's report; re-run the check and record what actually happened
exit=1
```

Both the message and the remedy now name the pass whose report was actually cited. The
committed red test's regex `/implementer's own report/` (`tests/gate.test.ts:588`) is
untouched, and the impl-only shape still prints the round-1 sentence verbatim - I re-ran it:
`items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)`.

**Finding 4, at the code level as asked.** `src/gate.ts:401-402` builds the detail from
`cited.filter((c) => c.role === role)`, not from `closingRows`. Confirmed live: with two forged
rows, `alice` citing the impl report and `bob` citing the spec report, the detail is `(alice)`
alone - only the verifiers whose rows cited that kind.

## The kind split, judged

**The resolution.** Splitting by kind rather than widening to one generic sentence is the
better of the two: it keeps the committed red test's regex load-bearing (a widened message
would have forced that regex to move, which is the one string in this item nobody should have
to touch), and it gives a maintainer the actual filename family to go look for. `report.ok`
covers all six lists (`src/gate.ts:459-466`); I counted the declarations (`:365-370`), the fail
blocks (`:423, :429, :435, :441, :447, :453`) and the guard conditions (`:460-465`) - six,
six, six, balanced.

**The execution, sentence by sentence, all rung 5 in scratch stores I built:**

| Shape | What the gate prints | Literally true? |
|---|---|---|
| impl citation only | `...cites the implementer's own report: storage-layer (reviewer)` | yes |
| spec citation only | `...cites the spec-author's own report: storage-layer (spec-reviewer)` | yes |
| **one row citing both kinds** | `...cites the implementer's own report: storage-layer (reviewer)` | yes - the row does cite the implementer's report, among others |
| **two rows, alice=impl bob=spec** | `...cites the implementer's own report: storage-layer (alice)` | yes - alice's row does cite it; bob is simply unmentioned (finding B) |
| uppercase `IMPL_STORAGE-LAYER.MD` | `...cites the implementer's own report: storage-layer (reviewer)` | yes |
| zero-width `impl_storage-layer<U+200B>.md` | `...cites the implementer's own report: storage-layer (reviewer)` | yes |
| legitimate `review_<slug>.md` | `[ok] 1 closed item(s) carry a ledger verdict` | yes |

The both-kinds tie-break is documented at `src/roles.ts:111-114` as "the set's first entry" and
I confirmed the mechanism directly: `citesImplementingReport("spec_storage-layer.md impl_storage-layer.md", "storage-layer")`
returns `"implementer"` even with the spec name first in the string, because the loop iterates
`IMPLEMENTING_ROLES` insertion order, not string position. The comment is accurate.

**`\p{Cf}` verified rather than assumed.** I checked the category memberships myself rather
than trusting the report's probe: U+200B `true`, U+200D `true`, U+FEFF `true`, and - the part
worth knowing - U+00A0 `false` and U+0301 `false`. NBSP is not stripped but does not need to be
(it is already a valid leading boundary character), and combining marks are not stripped, which
is the homoglyph residual `src/roles.ts:143-151` discloses. I confirmed the residual is real:
a Cyrillic-a homoglyph returns `undefined`. Disclosed, not hidden.

**No false positives introduced by the widening.** Re-traced the predicate over the whole real
`.mstack/ledger.tsv` with the new tri-state return (`scratchpad/trace2.ts`):

```
total rows: 54
citesImplementingReport(evidence, own target) -> {"undefined":31,"implementer":23}
rows that would trip the gate (cited AND closing verifier): 0
verifier values on the impl-cited rows: ["implementer"]
free-prose rows (no .md): 9 -> any cited? false
review_*.md rows: 22 -> any cited? false
```

The `i` flag and the Cf strip cost nothing on real data: still zero closing-role rows match,
and the 23 impl-citing rows are all `--verifier implementer` and discarded by `canCloseAnItem`
before the predicate is reached.

## Verification I ran

`./bin/mstack gate --full` at the repo root - exit 0.

```
[ok]    18 closed item(s) carry a ledger verdict
[ok]    one active item: closing-row-cites-own-report (reviewing)
[warn]  9 uncommitted change(s); expected mid-session, not at close

bun test v1.3.11 (af24e281)
 284 pass
 0 fail
Ran 284 tests across 16 files. [50.09s]

ℹ tests 284
ℹ pass 284
ℹ fail 0

[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .

PASSED - 0 failures, 1 warning
EXIT=0
```

Standalone: `npm run typecheck` clean, no diagnostics. `./bin/mstack lint-plugin .` ->
`PASSED - 0 failures, 0 warnings`. `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`
-> `100 relative links checked, 0 broken`.

`./bin/mstack ledger check closing-row-cites-own-report` at head `0a4ea73`:
`FAIL no verdict at 0a4ea73c; 2 row(s) exist at other SHAs and a new head SHA voids them`.
Structural, same as round 1 - the report commit voids the row inside it. Recorded no row myself.

### Mutation testing (this is what the verdict rests on)

Run in a scratch clone at `0a4ea73`, `node --test tests/gate.test.ts tests/roles.test.ts`,
baseline 70 pass / 0 fail. Shipped tree restored after each.

| Mutation | Result | Reading |
|---|---|---|
| drop the `i` flag (`src/roles.ts:158`) | **2 fail** | covered |
| drop the `\p{Cf}` strip (`src/roles.ts:153`) | **2 fail** | covered |
| drop the verifier detail from `forgedImpl` (`src/gate.ts:405`) | **1 fail** | covered - the round-2 assertion at `tests/gate.test.ts:592` earns its place |
| drop the verifier detail from `unsupersededFailure` (`src/gate.ts:419`) | **1 fail** | covered - `tests/gate.test.ts:633` earns its place |
| revert `src/gate.ts` to `dfa78f0`, keep round-2 tests | **1 fail** (the spec-author test) | the kind split's entire test surface is one assertion |
| **prefer spec when both kinds are cited** (`src/gate.ts:404`) | **70 pass / 0 fail** | **uncovered - finding A** |
| **typo the role label to `verifiers("spec_author")`** (`src/gate.ts:407`) | **70 pass / 0 fail** | **uncovered - finding D** |

I used a precise tie-break mutation on purpose: a coarse one (`implVerifiers.length > 99`) does
kill 2 tests, but only because it also breaks the impl-only path. Changing behaviour *only* in
the both-kinds case is invisible to the suite.

## Changes required

**A. `src/gate.ts:396-408` - the both-kinds tie-break is a documented contract with no test.**
The comment at `:396-400` states "an item whose rows cite both kinds lands on the implementer
list", and the round-2 report cites that comment as the proof (change map row 3: "set order;
comment at src/gate.ts:398-402"). A comment is not coverage. Reversing the tie-break so both-
kinds items land on the spec list leaves the suite fully green, so a future edit to
`IMPLEMENTING_ROLES`' order or to this `if`/`else` changes documented behaviour silently. Add
one gate test with a done item whose only closing row is
`--evidence "impl_<slug>.md and spec_<slug>.md"`, asserting `/implementer's own report/`; or a
`roles.test.ts` entry asserting `citesImplementingReport("spec_x.md impl_x.md", "x") === "implementer"`,
which pins the mechanism at its source and is the cheaper of the two.

**B. `src/gate.ts:407` - the role label is stringly typed and unpinned, and the failure mode is
the exact shape this commit added assertions to prevent.** `verifiers` takes `role: string`
(`src/gate.ts:401`) and `citesImplementingReport` returns `string | undefined`
(`src/roles.ts:152`), so nothing connects `"spec-author"` at `:407` to the role names the
predicate can return. I mutated it to `"spec_author"`: the suite stays 70/70 green, and the
shipped CLI prints, at rung 5 -

```
[fail]  items closed on a verdict whose evidence cites the spec-author's own report: storage-layer ()
```

- a refusal with an empty parenthesis. `tests/gate.test.ts:590-591` says, in this commit's own
words, "so a refusal is never a headline with nothing after the colon", and asserts exactly
that for `forgedImpl`; `tests/gate.test.ts:631-632` does it for `unsupersededFailure`. The one
new list those assertions were written for does not have one. Mirror it into the spec test at
`tests/gate.test.ts:754`:
`assert.ok(gate(sb).failures.some((f) => /storage-layer \(spec-reviewer\)/.test(f)), ...)`.
Narrowing `citesImplementingReport`'s return to `"implementer" | "spec-author" | undefined` and
`verifiers`' parameter to match would make the typo a compile error instead, and `npm run
typecheck` already runs in the gate - that is the stronger fix and costs two type annotations.

## Findings that do not block

**C. `docs/wiki/Gates-and-Hooks.md:212-219` - the pasted block is a composite of three runs
presented as one.** Every line is genuinely real: I extracted the fenced block, generated the
six lines from three scratch stores through `./bin/mstack`, and diffed them -

```
=== diff: wiki block (left) vs three real gate runs (right) ===
IDENTICAL byte-for-byte
```

But all three `[fail]` lines name `storage-layer`, and no single gate run can print that: an
item lands on at most one list (`continue` at `src/gate.ts:409`, `if`/`else` at `:404-408`), so
one slug on three mutually exclusive lines depicts an impossible state. `CONTRIBUTING.md:57-58`
asks for output from real runs, and one real run does produce this block if the three items get
distinct slugs. I generated it, ready to paste:

```
[fail]  items closed on a verdict whose evidence cites the implementer's own report: storage-layer (reviewer)
        fix: a closing verdict needs evidence from the closing pass's own work, not a pointer to the implementer's report; re-run the check and record what actually happened
[fail]  items closed on a verdict whose evidence cites the spec-author's own report: other-item (spec-reviewer)
        fix: a closing verdict needs evidence from the closing pass's own work, not a pointer to the spec-author's report; re-run the check and record what actually happened
[fail]  items marked done whose most recent closing verdict is verifier-failed: third-item (reviewer)
        fix: the ledger is append-only, so the failed row stays; a later verdict from a closing role is what clears it — re-run the review after the fix and record a fresh one
```

Either swap the slugs, or say in the lead-in that these are the three messages shown one per
refusal. The prose itself is accurate and the enumeration now covers all six classes.

**D. My round-1 finding 5, as the coordinator asked: unchanged in its original shape, strictly
better in the new one, and one line from being fixed.** In the original shape (forged passing
row appended after a genuine failure) `legitimate` is non-empty, so neither forged list fires
and the output still mentions only the unsuperseded failure - I re-ran it and got the identical
line. In the mixed-kind shape the kind split *improved* truthfulness and *reduced* completeness,
which I measured by running both CLIs against one store:

```
### same store, ROUND-1 CLI (dfa78f0):
[fail]  ...cites the implementer's own report: storage-layer (alice, bob)
### same store, ROUND-2 CLI (HEAD):
[fail]  ...cites the implementer's own report: storage-layer (alice)
```

Round 1 named both offenders but said something false about bob, whose row cited the spec
report. Round 2 says nothing false and says nothing about bob. That is the better trade, and
the comment at `src/gate.ts:398-400` takes it deliberately ("one list is enough"). It is still
one line from being both true and complete: push to `forgedSpec` as well when
`verifiers("spec-author")` is non-empty, instead of using `else`. Worth doing if finding A is
being touched anyway, since the same test would cover both.

**E. `src/gate.ts:405, :407` - `|| "unnamed"` is unreachable on these two lists.** A row with an
empty verifier never survives `canCloseAnItem` (`src/roles.ts:104-105` returns false on the
empty role), so it is never in `closingRows`. Harmless and consistent with the `selfClosed`
line above it, where it *is* reachable. Noting it only so it is not mistaken for a guarantee.

## Checked and clean

- **Other docs pages.** I swept `README.md`, `docs/`, `skills/` and `agents/` for anything
  enumerating the refusal set. Only `Gates-and-Hooks.md` does.
  `docs/wiki/How-A-Work-Item-Flows.md:184-187` and `docs/wiki/State-Files.md:105` describe the
  self-closing refusal in prose without claiming completeness - narrower than reality now, but
  not stale. `README.md:149`, `docs/wiki/Getting-Started.md:238,255` and
  `docs/wiki/The-Agents.md:73,88` paste the `(only implementer)` output, which I re-ran and
  confirmed byte-identical.
- **Round-1 regressions.** Every round-1 probe re-run at rung 5: impl-only wording, fail-then-
  blocked, pass-then-fail, multi-role supersession, plugin-qualified verifier, SHA ignored,
  every-row-failed, implementer-only, legitimate-review-closes. All unchanged.
- **Design fidelity where round 2 diverges.** The kind split is a deliberate divergence from
  candidate A's single `forgedEvidence` list. It is clean: the six-step order, the
  `continue`-per-outcome shape, the `(verifiers)` detail style and the `IMPLEMENTING_ROLES` loop
  all survive; only the fourth outcome is split in two, and the divergence is recorded in the
  round-2 report's change map.
- **Tests weakened.** No. `git diff dfa78f0..HEAD -- tests/` deletes only the round-1 spec
  assertion that finding 2 required be changed, and the boolean/tri-state rewrite of the
  `roles.test.ts` table, which strengthens it (it now pins *which* role, not just that some
  role matched).
- **Debug leftovers, dead code, layering.** None. The naming contract stayed in `src/roles.ts`.
- **`\p{Cf}` regex safety.** `u` flag present, both runtimes agree (284/284 each).

## Evidence ladder

Findings 1, 2, 4, 7 closed and every row of the sentence-truth table: **rung 5** - the shipped
`./bin/mstack` against scratch stores I built, plus the round-1 CLI from a `dfa78f0` clone for
the comparison in finding D. Finding C's byte comparison: **rung 5** (real generated output
diffed against the file). Mutation table and findings A and B: **rung 3** for the surviving
mutations, **rung 5** for the `storage-layer ()` output the role-label typo ships. Ledger
re-trace: **rung 4** (real module, real ledger, my driver). Cf category and homoglyph checks:
**rung 4**. Six-list counting, `|| "unnamed"` reachability and design fidelity: **rung 1**, read
against the diff, and I say so rather than dressing them up.
