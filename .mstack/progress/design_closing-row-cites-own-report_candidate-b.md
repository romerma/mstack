# Candidate B — one predicate, one ordering rule, no new list shape

## Problem

`checkClosedItems` in `src/gate.ts` decides whether a `done` item is legitimately closed by
scanning its ledger rows twice, independently: once with `rows.every(verdict === "verifier-failed")`
to catch an all-failed item, once with `rows.some(canCloseAnItem(verifier))` to catch a
self-closed item. Both scans look at the wrong thing. The `every` scan counts the implementer's
own passing row as a reason the item is *not* all-failed, so one implementer row plus one failed
reviewer row survives it. The `some` scan reads only the `verifier` column, so a row whose
`verifier` says `reviewer` but whose `evidence` is `.mstack/progress/impl_<slug>.md` — the
implementer's own report, re-cited under someone else's name — satisfies it. Both holes have the
same shape: the audit asks "does a qualifying row exist anywhere in the set" instead of "what is
the most recent state this item's closing rows actually establish." This candidate replaces both
scans with that single question.

## Usage

No CLI surface changes. `mstack gate` (fast or `--full`) still calls
`checkClosedItems(store, state, report)` with the same signature, from the same call site. What
changes is the output on the two forged shapes, and the wording is fixed by what the ledger
actually holds — no new flags, no new ledger columns.

**Hole A, reproduced today** (item closed on a review row whose evidence is the implementer's own
report):

```
$ mstack gate
[fail]  items closed on a verdict citing the implementer's own report as evidence: storage-layer (reviewer)
        fix: the evidence has to be an independent check by that role, not a pointer to the report of the pass that wrote the code
```

**Hole B, reproduced today** (item closed on an unsuperseded `verifier-failed` row from a
non-implementing role):

```
$ mstack gate
[fail]  items marked done whose only verdict is verifier-failed: storage-layer
        fix: a failed verifier is a reason to reopen the item, not to close it
```

**After the fix, once a real independent pass records a real verdict** (either hole, once the
item is re-reviewed with real evidence, or the failure is superseded by a later passing row from
any non-implementing role):

```
$ mstack gate
[ok]    4 closed item(s) carry a ledger verdict
```

Quiet mode (`--quiet`, what the `Stop` hook runs) prints the same failure lines to stderr with no
`[ok]`/`fix:` framing, per `Report#fail`'s existing contract — unchanged by this design.

## Shape

### New predicate — `src/roles.ts`

The `impl_<slug>` naming contract already lives in one place (`REPORT_KINDS`, `reportFiles`). This
predicate is added next to `canCloseAnItem`, in the same module, and is built from the same table
rather than a hardcoded string:

```ts
/**
 * Does this evidence point at the implementer's own report for this item,
 * rather than an independent check?
 *
 * Mirrors reportFiles' own naming contract instead of re-deriving it: a match
 * is the exact report (`impl_<slug>.md`) or one file in its fan-out family
 * (`impl_<slug>_<suffix>.md`), named as a whole path component. Trailing
 * prose after the `.md` is fine ("impl_x.md round-2 section" still matches);
 * a slug that merely shares a prefix ("impl_foobar.md" against slug "foo")
 * does not.
 */
export function citesOwnReport(evidence: string, slug: string): boolean {
  const prefix = `${REPORT_KINDS["implementer"]}_${slug}`; // "impl_<slug>"
  const pattern = new RegExp(
    `(^|[\\s/])${prefix}(\\.md|_[^\\s/]*\\.md)(?=$|[^A-Za-z0-9_-])`,
  );
  return pattern.test(evidence);
}
```

No escaping helper is needed: `slug` is validated on write against `SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/`
(`src/state.ts`), and `REPORT_KINDS["implementer"]` is the literal `"impl"` — neither contains a
regex metacharacter, so interpolating them directly into the pattern is safe by construction, not
by convention. This is checked, not assumed: `REPORT_KINDS` is a fixed table in this module, and
`SLUG`'s charset excludes every regex-special byte.

### Changed decision procedure — `src/gate.ts`, `checkClosedItems`

Four accumulator lists instead of three. `missing` is untouched. `selfCited` is new. `failed` and
`selfClosed` keep their variable names and their message text, because their *meaning* narrows to
the same shared concept below rather than growing a parallel one:

```ts
const missing: string[] = [];
const failed: string[] = [];
const selfClosed: string[] = [];
const selfCited: string[] = [];

for (const item of closed) {
  const rows = ledgerEntries(store).filter((entry) => entry.target === item.slug);
  if (rows.length === 0) {
    missing.push(item.slug);
    continue;
  }

  // A row closes an item only if it is (a) from a role that did not write
  // the thing, and (b) not just that role's re-citation of the report the
  // role that *did* write the thing produced. Order-preserving: `entries()`
  // returns file order, which is chronological, and `filter` keeps it.
  const candidates = rows.filter(
    (entry) => canCloseAnItem(entry.verifier) && !citesOwnReport(entry.evidence, item.slug),
  );

  if (candidates.length === 0) {
    const disqualified = rows.filter(
      (entry) => canCloseAnItem(entry.verifier) && citesOwnReport(entry.evidence, item.slug),
    );
    if (disqualified.length > 0) {
      selfCited.push(
        `${item.slug} (${[...new Set(disqualified.map((r) => r.verifier || "unnamed"))].join(", ")})`,
      );
    } else {
      selfClosed.push(
        `${item.slug} (only ${[...new Set(rows.map((r) => r.verifier || "unnamed"))].join(", ")})`,
      );
    }
    continue;
  }

  // The operative state of a closed item is whatever its most recent
  // candidate row says. An earlier failure that a later candidate row
  // superseded is exactly what "closed" is supposed to mean; a later failure
  // means the item regressed after passing, and does not get waved through
  // because it once passed.
  const last = candidates[candidates.length - 1];
  if (last.verdict === "verifier-failed") {
    failed.push(item.slug);
  }
}
```

Reporting block gains one clause and one term in the final `ok` guard; nothing else moves:

```ts
if (missing.length > 0) {
  report.fail(
    `items marked done with no ledger verdict at all: ${missing.join(", ")}`,
    "record it with 'mstack ledger record'; if no check could be run, that verdict is 'verifier-blocked'",
  );
}
if (failed.length > 0) {
  report.fail(
    `items marked done whose only verdict is verifier-failed: ${failed.join(", ")}`,
    "a failed verifier is a reason to reopen the item, not to close it",
  );
}
if (selfCited.length > 0) {
  report.fail(
    `items closed on a verdict citing the implementer's own report as evidence: ${selfCited.join(", ")}`,
    "the evidence has to be an independent check by that role, not a pointer to the report of the pass that wrote the code",
  );
}
if (selfClosed.length > 0) {
  report.fail(
    `items closed on a verdict from the pass that wrote the code: ${selfClosed.join(", ")}`,
    "a closing verdict has to come from somewhere other than the implementer; run the verification again from a pass that did not write it",
  );
}
if (missing.length === 0 && failed.length === 0 && selfCited.length === 0 && selfClosed.length === 0) {
  report.ok(`${closed.length} closed item(s) carry a ledger verdict`);
}
```

`selfCited` is checked before `selfClosed` only so the more specific diagnosis (there *was* a
non-implementing row, but its evidence disqualified it) prints ahead of the generic one (no
non-implementing row touched it at all) when a reader scans top to bottom — both still run
unconditionally every pass, same as today's three.

### Data flow, end to end

`state.items` (done) → per item, `ledgerEntries(store)` filtered to `target === slug` (unfiltered
by SHA, as today) → partitioned by `canCloseAnItem` (role) and `citesOwnReport` (evidence) into
`candidates` → the last element of `candidates`, by ledger file order, decides pass/fail/self-shape
for that one item → one of four accumulator arrays, or none → up to four `report.fail` calls plus
one `report.ok`, matching the module's existing "accumulate offenders, one fail per class" style
exactly.

## Edge cases

Walking `## What your design must decide`:

**1. Evidence matching.** Exact path, or exact path with an arbitrary trailing-prose suffix after
`.md` (` round-2 section`, ` - shipped ...`), both match; free prose that never mentions the
filename does not (`citesOwnReport` requires the literal `impl_<slug>` token as a path component).
A different item's `impl_<other-slug>.md` does not match this item's audit, by construction — the
prefix is built from `item.slug`, so citing another item's report is invisible to this check (see
Rejected Alternatives for why that is deliberate, not an oversight). Spec-author reports
(`spec_<slug>.md`) are *not* checked — `citesOwnReport` only looks at `REPORT_KINDS["implementer"]`
— see Rejected Alternatives. The predicate lives in `src/roles.ts`, the one module that already
owns `REPORT_KINDS` and the `reportFiles` fan-out contract it mirrors.

**2. Supersession.** Defined purely by ledger file order (`entries()`'s chronological order),
never by SHA and never by verifier identity: the operative verdict for an item is whichever
candidate row is *last* in that order.

- fail-then-pass: last candidate passes → item closes. (Test: "an unsuperseded verifier-failed
  closing row does not close the item", second half.)
- pass-then-fail: last candidate fails → item does not close, even though an earlier row passed.
  Not covered by a pinned test, but the same one rule produces it — see Trade-offs on the message
  text this shares with the always-failed case.
- fail-then-blocked: last candidate's verdict is `verifier-blocked`, which is not the literal
  string `"verifier-failed"`, so the item closes. This is not new behavior — it is exactly what
  today's `rows.every(verdict === "verifier-failed")` already permitted, and the pinned green test
  ("an item closed on a failed verifier is rejected", second half) requires it to keep passing.
- multiple closing roles: a `reviewer` failure superseded by a later `session` pass closes the
  item; the rule does not care that the two rows named different verifiers. Verifier is free text
  with no identity guarantee across rows (`reviewer`, `review panel`, `mstack:reviewer` are all
  seen in this ledger) — see Rejected Alternatives for why identity-matching was not chosen.
- rows at different SHAs: irrelevant to ordering. `checkClosedItems` already does not filter
  ledger rows by the current HEAD SHA for closed items (pinned green test: "a verdict recorded at
  an older SHA still closes an item") — that stays true here; a later row at an older SHA than an
  earlier row cannot occur because the ledger is append-only and chronological, so "later in the
  file" and "later in time" are the same fact regardless of which SHA either row names.

**3. Composition with the existing lists.** Two new refusal *paths*, but the `selfCited` message
is the only genuinely new message. `failed`'s message text is reused unmodified (see Trade-offs).
`selfClosed`'s message and detail-string logic are reused unmodified — it now fires only when
`candidates` is empty *and* no row was disqualified specifically for self-citation, which is a
strict narrowing of when it used to fire, not a behavior change on the shapes that still make it
fire (a done item with only an implementer row, or only an `implementer`-equivalent qualified role
like `mstack:implementer`). Exact new message + remedy:

```
items closed on a verdict citing the implementer's own report as evidence: <slug> (<verifiers>)
fix: the evidence has to be an independent check by that role, not a pointer to the report of the pass that wrote the code
```

**4. Full decision procedure**, precisely: see the `Shape` section's code block — it is written to
be transcribed directly, not paraphrased further.

## Rejected alternatives

- **Generalize `citesOwnReport` to both `IMPLEMENTING_ROLES` kinds (`impl` and `spec`).** Would
  close a structurally identical, but *unreproduced*, hole for spec-author's own report. Rejected
  as scope creep past the acceptance criteria and the fact-check, both of which speak only to
  `impl_<slug>.md`; the item calls this "a tightening of one audit, not a redesign." Left as an
  Open Question below — the change, if ever wanted, is one more table lookup, not a new shape.
- **Exact-string evidence comparison** (`evidence === reportPath`). Fails the acceptance
  criterion outright: the ledger already has 4 rows of the form `impl_x.md round-2 section`, and
  exact match would let evidence dodge the check by appending a single character.
- **Loose substring match** (`evidence.includes("impl_")` or `.includes(kind)`). Too loose in both
  directions: it flags prose that merely mentions the word, and it does not reject the
  slug-prefix collision (`impl_foo` as a substring-match against `impl_foobar.md`, a different
  item's report) that the whole-path-component regex rejects by requiring the character after the
  prefix be `.` or `_`, mirroring `reportFiles`'s own two-armed check exactly.
- **Same-verifier-identity supersession** (a failed row is only cleared by a later row with the
  identical `verifier` string). Rejected: the ledger's `verifier` column is free text with no
  identity model — `reviewer`, `review panel`, `session`, `mstack:reviewer` all appear for
  different literal writers of the same role. Requiring string equality would be arbitrary
  (`reviewer` failing, then `mstack:reviewer` passing, is the same role by `roleOf`'s own logic and
  should supersede) and does not correspond to anything the ledger actually tracks.
- **RANK-based supersession** (best verdict ever recorded for the target, using `ledger.ts`'s
  `RANK` table, rather than most-recent). Rejected: `RANK` ties `verifier-blocked` and
  `verifier-failed` at 0 and is designed for "does this clear a bar," not "what happened last." A
  max-based read would let an old high-ranked pass permanently outrank a later failure — exactly
  the pass-then-fail shape this design needs to catch — reopening a variant of the original hole
  under a different implementation.
- **New, separate lists/messages for "always failed" vs "regressed after passing."** Both are the
  same rule (`last candidate failed`) and no acceptance criterion or pinned test distinguishes
  them. Splitting them is exactly the kind of complexity growth the item asks to resist; folded
  into the one `failed` list instead.
- **Filter ledger rows by current HEAD SHA before auditing closed items**, mirroring
  `ledger.check`'s SHA-scoping used for open-item verification. Rejected: an explicitly pinned
  green test says the opposite is intended for *closed* items — history stays valid as the branch
  moves on. Out of scope for this item regardless of merit.

## Trade-offs accepted

- We accept that the `failed` message ("...whose only verdict is verifier-failed") is literally
  imprecise for the pass-then-fail sub-case (there the *only* candidate verdict is not
  verifier-failed — an earlier one passed) in exchange for zero new message surface, an unbroken
  pinned-green test ("an item closed on a failed verifier is rejected"), and one shared code path
  for a case with no test or acceptance criterion demanding it read differently.
- We accept that supersession is identity-agnostic (any later non-implementing, non-self-citing
  row clears an earlier failure, regardless of which specific verifier wrote either row) in
  exchange for not inventing a verifier-identity concept the ledger does not have.
- We accept that `citesOwnReport` recognizes only the implementer's report kind, not
  spec-author's, in exchange for staying inside the reproduced hole and the acceptance criteria as
  written.
- We accept a hand-built regex over free-text evidence (rather than, say, parsing evidence as a
  filesystem path) in exchange for handling the real trailing-prose shapes already in this
  repository's ledger without adding path-parsing machinery for a field that is not guaranteed to
  be a path at all.

## Open questions

- Should `citesOwnReport` eventually cover `spec_<slug>.md` too, once (if) a reviewer citing a
  spec-author's report as its own evidence is reproduced the way the implementer version was here?
- Should the `failed` message split into two distinct sentences (never-passed vs
  regressed-after-passing) if a real session hits the pass-then-fail shape and the shared wording
  turns out to send someone down the wrong remedy?
