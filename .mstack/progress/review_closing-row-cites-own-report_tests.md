# Review - closing-row-cites-own-report (lens: TESTS)

**Verdict:** CHANGES_REQUESTED

One blocking gap: a design decision the record calls settled ("identity-agnostic
supersession", i.e. a failure from verifier A cleared by a pass from verifier B) survives a
semantic mutation of the shipped code with the whole suite green and the real gate green.
Everything else on this lens is clean, and unusually so: every one of the six decided
boundary probes is pinned twice, all five requested mutations are caught, no test was
weakened, and both acceptance bullets that name `mstack gate` reproduce at rung 5 against
the repo's real ledger.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| Closing row citing `impl_<slug>.md` is refused | `tests/gate.test.ts:568` "a closing row citing the implementer's own report does not close the item" | Red against pre-fix src (rung 4); rung-5 repro below |
| ...and a genuine row rescues the same item | `tests/gate.test.ts:592-600` (`expectPass`, forged row still in ledger) | Runs the real `runGate` on a sandbox store |
| Spec-author's report counts as an implementing report | `tests/gate.test.ts:690`; `tests/roles.test.ts:36-37` | Mutation (h) `IMPLEMENTING_ROLES` -> `["implementer"]` fails both |
| Unsuperseded `verifier-failed` closing row blocks the close | `tests/gate.test.ts:603` | Red against pre-fix src; rung-5 repro below |
| fail-then-pass supersedes | `tests/gate.test.ts:625-633` | `expectPass` after a later `test-verified` |
| pass-then-fail retracts | `tests/gate.test.ts:710` | Red against pre-fix src |
| Forged row cannot supersede a genuine failure (ordering) | `tests/gate.test.ts:736` | Mutation (e) fails exactly this test |
| fail-then-blocked still closes | `tests/gate.test.ts:220-246` (pre-existing, now exercises the new `latest` path) | Green at HEAD; still green under every mutation, so it pins the branch but not exclusively |
| Citation contract, whole token however punctuated | `tests/roles.test.ts:13-63` (23 probes) + `tests/gate.test.ts:640` (7 probes end to end) | Mutations (a)(b)(c) each fail at least one |
| Free prose unaffected | `tests/roles.test.ts:55`; real-ledger sweep below | 0 false positives over all 52 rows |
| **Identity-agnostic supersession (multi-role)** | **none** | Mutation (f) below passes the entire suite |

## Acceptance, quoted

**"A done item whose only non-implementing row cites impl_<slug>.md as its evidence is
reported by mstack gate"** - met. Pinned at `tests/gate.test.ts:568` (unit-of-gate, rung 4)
and reproduced at rung 5 in a throwaway worktree by rewriting the *only* closing row of the
real closed item `panel-followup-prose`:

```
--- A1 forged sole closing row, HEAD src
    [fail]  items closed on a verdict whose evidence cites the implementer's own report: panel-followup-prose (reviewer)
    FAILED - 1 failure, 1 warning
```

**"Evidence that is free prose rather than a path is unaffected, proven against every row
currently in this repo's ledger"** - met, rung 5. Prose is pinned as a negative probe at
`tests/roles.test.ts:55` (`"read the implementer's report, all good"`), and I swept the real
`.mstack/ledger.tsv` through the shipped predicate:

```
total rows: 52 rows citing an impl report: 22 of which from a closing role: 0
```

22 rows do name an implementing report; all 22 are implementer/spec-author rows, which
`canCloseAnItem` already excludes upstream at `src/gate.ts:382`. Zero false positives. The
untouched real gate agrees: `[ok] 18 closed item(s) carry a ledger verdict`.

**"The check is proven at rung 5 by a row that passes today and is refused after"** - met.
Same forged ledger, two srcs, real `./bin/mstack` as a process:

```
--- A1 forged sole closing row, HEAD src
    [fail]  items closed on a verdict whose evidence cites the implementer's own report: panel-followup-prose (reviewer)
--- A2 same ledger, PRE-FIX src
    [ok]    18 closed item(s) carry a ledger verdict
    PASSED - 0 failures, 1 warning
```

**"A done item carrying an unsuperseded verifier-failed row from a non-implementing role is
refused by mstack gate; today that row is what satisfies the no-self-approval audit and
flips the gate green"** - met. Pinned at `tests/gate.test.ts:603`, and rung 5 by flipping
`editable-item-fields`' sole reviewer row to `verifier-failed` (its implementer row stays
passing, which is exactly the "flips the gate green today" shape):

```
--- B1 unsuperseded reviewer failure, HEAD src
    [fail]  items marked done whose most recent closing verdict is verifier-failed: editable-item-fields (reviewer)
--- B2 same ledger, PRE-FIX src
    [ok]    18 closed item(s) carry a ledger verdict
    PASSED - 0 failures, 1 warning
```

## Revert matrix

`git checkout b27240e^ -- src/` in a worktree at HEAD. `git diff b27240e^ b16aa45^ -- src/`
is empty (0 lines), so pre-repro src and pre-fix src are the same tree; the revert is honest.
`node --test tests/gate.test.ts tests/roles.test.ts`: **tests 69, pass 62, fail 7.**

| Test | vs. pre-fix src |
|---|---|
| `gate.test.ts:568` a closing row citing the implementer's own report does not close the item | RED - "self-citing close: expected a failure, got a pass" |
| `gate.test.ts:603` an unsuperseded verifier-failed closing row does not close the item | RED |
| `gate.test.ts:640` a citation is the exact report filename as a whole token, however punctuated | RED |
| `gate.test.ts:690` a closing row citing the spec-author's own report does not close the item | RED - "spec-citing close: expected a failure, got a pass" |
| `gate.test.ts:710` a later verifier-failed closing row retracts an earlier pass | RED - "pass then fail: expected a failure, got a pass" |
| `gate.test.ts:736` a forged passing row cannot supersede a genuine failure | RED - "forged supersession: expected a failure, got a pass" |
| `roles.test.ts:13` a citation is the exact report filename as a whole token | RED - `SyntaxError: The requested module '../src/roles.ts' does not provide an export named 'citesImplementingReport'` |

Every test added in b27240e and b16aa45 goes red. Nothing pins nothing. (Note the
`roles.test.ts` failure is a module-load error, not an assertion - it still fails loudly, but
it proves only that the export exists; the *contract* is what mutations (a)-(c) prove.)
Restored with `git checkout HEAD -- src/`: full suite green (see "Verification I ran").

## Mutation matrix

One at a time in the worktree, `git checkout HEAD -- src/` between each,
`node --test tests/gate.test.ts tests/roles.test.ts`.

| # | Mutation (`src/roles.ts:141`, `src/gate.ts:392,403`) | Caught by |
|---|---|---|
| a | leading class `(^\|[^A-Za-z0-9_-])` -> `(^\|[\s/])` | `gate.test.ts:640`, `roles.test.ts:13` |
| b | trailing lookahead `(?=$\|[^A-Za-z0-9_])` -> `(?=$\|[\s,;:])` | `gate.test.ts:640`, `roles.test.ts:13` |
| c | suffix arm `_[^\s/]*\.md` -> `_[^\s/]+\.md` | `roles.test.ts:13` only (the `impl_storage-layer_.md` probe at `roles.test.ts:34`; no gate-level test covers the empty suffix) |
| d | drop the `citesImplementingReport` filter (`legitimate = closingRows`) | `gate.test.ts:568`, `:640`, `:690`, `:736` - including the committed red test |
| e | `latest` from `closingRows` instead of `legitimate` | `gate.test.ts:736` "a forged passing row cannot supersede a genuine failure" |
| f | supersession scoped to the same `verifier` string (see below) | **NOTHING FAILED - exit 0** |
| g | `forgedEvidence.push(...)` detail -> `""` | **NOTHING FAILED - exit 0** |
| h | `for (const role of IMPLEMENTING_ROLES)` -> `["implementer"]` | `gate.test.ts:690`, `roles.test.ts:13` |

All five requested spot-checks (a-e) are caught. (f) and (g) are mine and are the findings.

## Boundary probes from the decision, mapped

The decision (`.mstack/decisions.tsv`, last row: "probes: quoted impl_x.md, [impl_x.md],
impl_x.md-round-2 must refuse; re-impl_x.md, impl_x.mdx, impl_other.md must not") names six.
All six are pinned twice - once as a unit and once through the real gate.

| Probe | Unit | Gate |
|---|---|---|
| quoted path refused | `tests/roles.test.ts:23` | `tests/gate.test.ts:646` |
| `[bracketed]` refused | `tests/roles.test.ts:24` | `tests/gate.test.ts:647` |
| trailing `-round-2` refused | `tests/roles.test.ts:29` | `tests/gate.test.ts:648` |
| `re-impl_x.md` allowed | `tests/roles.test.ts:42` | `tests/gate.test.ts:652` |
| `impl_x.mdx` allowed | `tests/roles.test.ts:45` | `tests/gate.test.ts:653` |
| `impl_<other-slug>.md` allowed | `tests/roles.test.ts:47` | `tests/gate.test.ts:654` |

Beyond the six, `roles.test.ts` also pins `=`/`(` punctuation (`:25-26`), `.md.` and
`.md#tests` (`:30-31`), the fan-out suffix family including the empty suffix (`:33-34`),
`spec_` kind (`:36-37`), `ximpl_` (`:43`), `impl_<slug>-extra.md` (`:49`),
`.mstack/specs/<slug>/spec.md` (`:51`) and `review_<slug>.md` (`:53`). That last pair is the
false-positive class that matters most and it is covered.

## Were the committed red tests weakened?

No. `git diff b27240e HEAD -- tests/gate.test.ts` is **additions only, all after line 637** -
the two red tests' bodies (`:568-601` and `:603-638`), their `expectFail` regexes
(`/implementer's own report/`, `/verifier-failed/`) and their `expectPass` calls survive
byte-for-byte. Across the whole item, `git diff 3c7e883...HEAD -- tests/` contains **zero
deleted lines**. Nothing was loosened to get green.

## Test quality

- The gate-level tests go through the real gate. `gate(sb)` in `tests/helpers.ts` calls
  `runGate` on a sandbox store, and the boundary test at `tests/gate.test.ts:640` builds a
  fresh sandbox per probe (`:655-687`) rather than reusing one - so a leaked row cannot make
  a later probe pass. `expectFail` (`tests/helpers.ts:193-199`) asserts both that the report
  failed and that a message matched, so no test can pass on an unrelated failure.
- `tests/roles.test.ts` unit-covers the spec-author kind (`:36-37`), and mutation (h)
  confirms it is load-bearing.
- Design-record edge cases: exact-vs-prefix (`roles.test.ts:17-21`), prose-that-mentions
  (`roles.test.ts:20-21`), spec-author (pinned), other items' reports (pinned),
  fail-then-pass (`gate.test.ts:625`), pass-then-fail (`gate.test.ts:710`), fail-then-blocked
  (`gate.test.ts:220`, pre-existing and still green), forged-cannot-supersede
  (`gate.test.ts:736`), SHA-agnostic (`gate.test.ts:603` records everything at `sb.sha`, so
  strictly this one is not differentiated - low value, the pre-existing `historic verdict`
  test at `:207` already covers the stance). **Multi-role supersession: not pinned.** See
  finding 1.
- Plugin-qualified verifier: `gate.test.ts:769` is pre-existing and unaffected. The new
  predicate does not read the verifier column, so there is nothing role-shaped to pin there.
- No debug leftovers, no `.only`, no `.skip`, no `TODO` in either new block. The only
  `console.log` in `tests/gate.test.ts` is the pre-existing stdout capture at `:266-271`.
- `tsconfig.json:16` includes `tests/**/*.ts`, and both runners report 283 tests, so the new
  file is picked up by node, bun and `tsc` alike.

## Verification I ran

`./bin/mstack gate --full` (main checkout, HEAD `dfa78f09`):

```
[ok]    one active item: closing-row-cites-own-report (reviewing)
[ok]    18 closed item(s) carry a ledger verdict
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[ok]    on branch fix/closing-row-cites-own-report
[warn]  6 uncommitted change(s); expected mid-session, not at close
...
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .
PASSED - 0 failures, 1 warning
```

The item's own `verification` field is `npm test && npm run typecheck && ./bin/mstack
lint-plugin .` - that is the command the gate executed above, and I also ran it standalone.
`npm test` (bun then node), main checkout, exit 0:

```
 283 pass
 0 fail
Ran 283 tests across 16 files. [53.81s]
...
ℹ tests 283
ℹ pass 283
ℹ fail 0
```

Both runtimes green at 283/283. `npm run typecheck` and `./bin/mstack lint-plugin .` are
green inside the gate run above (`PASSED - 0 failures, 0 warnings`).

`./bin/mstack ledger check closing-row-cites-own-report`:

```
FAIL no verdict at dfa78f09; 1 row(s) exist at other SHAs and a new head SHA voids them
```

Expected mid-panel - the only row is the implementer's, at `b16aa45`, and commit `dfa78f0`
(the implementer's report) moved head after it. Flagged for the coordinator, not for this
lens to fix: whatever verdict the panel lands has to be recorded at `dfa78f09` or later, and
the implementer's own row will need re-recording at head if anything downstream reads it.

All experiments ran in `git worktree add .../wt18 HEAD`, removed with `git worktree remove
--force` at the end (`git worktree list` shows only the main checkout). The main checkout's
`.mstack/state.json` shows modified because `gate --full` writes its verification receipt
there; I edited nothing.

## Changes required

1. **No test pins identity-agnostic supersession** - `src/gate.ts:397-406`. The design record
   states it twice as a decision: candidate A "Multiple closing roles" (`design_..._candidate-a.md:200-206`)
   -- "the most recent row among all closing-eligible, non-forged rows, **regardless of who
   wrote it**" -- and its Rejected alternatives (`design_..._candidate-a.md:238-242`)
   explicitly reject verifier-scoped supersession. Nothing enforces the choice. Replacing the
   `latest` block at `src/gate.ts:403-406` with verifier-scoped semantics --

   ```ts
   const blocked = legitimate.some(
     (e, i) =>
       e.verdict === "verifier-failed" &&
       !legitimate.slice(i + 1).some((l) => l.verifier === e.verifier && l.verdict !== "verifier-failed"),
   );
   ```

   -- leaves `node --test tests/gate.test.ts tests/roles.test.ts` at **exit 0, nothing
   failed**. Every existing supersession test uses one verifier string on both sides:
   `gate.test.ts:603` is `reviewer` -> `reviewer`, `:710` is `reviewer` -> `reviewer`,
   `:220` is `test` -> `test`. Nor does dogfooding cover it: I checked every closed item's
   rows, and no `verifier-failed` in `.mstack/ledger.tsv` is cleared by a *different*
   verifier string (`path-mstack-is-the-installed-copy` and `reviewer-writes-the-verdict` are
   `reviewer` throughout; `docs-for-newcomers` is `orchestrator` throughout). **Fix:** add a
   gate test in the `:603` neighbourhood where `verifier: "reviewer"` records
   `verifier-failed` and a later `verifier: "review panel"` (or `"orchestrator"`) records a
   pass, asserting `expectPass`. That one test kills mutation (f).

   Side finding, same location: `design_..._candidate-a.md:203-206` justifies the decision by
   citing `docs-for-newcomers` -- "`orchestrator` fails twice, passes on the third panel
   round". That item's three closing rows are all `verifier: orchestrator`
   (`.mstack/ledger.tsv:46,48,50`), so it is an example of same-verifier supersession and
   does not demonstrate the multi-role case it is cited for. The design record should not
   claim real-ledger backing it does not have.

## Non-blocking

2. **Failure-detail strings are unpinned** - `src/gate.ts:394` and `:405`. Replacing the
   `forgedEvidence.push(...)` argument with `""` leaves the whole suite green (mutation g):
   the gate would print `items closed on a verdict whose evidence cites the implementer's own
   report:` with nothing after the colon and no test would notice. Both new `expectFail`
   regexes match only the headline. The judge report picked this detail shape deliberately
   (`design_..._judge.md:155-157`, graft 3: "`${item.slug} (${verifiers.join(", ")})`"), so it
   is a decided-but-unpinned string. Cheap fix: add
   `assert.ok(gate(sb).failures.some((f) => /storage-layer \(reviewer\)/.test(f)))` to
   `tests/gate.test.ts:568`. Non-blocking because the pre-existing sibling test
   (`tests/gate.test.ts:553`) pins its message the same shallow way -- this matches house
   style rather than departing from it.

3. **The empty-suffix arm has only unit coverage** - `src/roles.ts:141`. Mutation (c) (`*` ->
   `+`) is caught by `tests/roles.test.ts:34` alone; no gate-level probe uses
   `impl_<slug>_.md`. Adequate, and noted only so the next person knows the `*` is held up by
   exactly one string.

## Evidence rungs

- Revert matrix, mutation matrix, boundary-probe map, "no test was weakened": **rung 4** -
  ran the real code in a worktree and read the failures by name; the weakening check is
  rung 2 (`git diff` with zero deleted lines).
- Acceptance bullets 1, 3 and 4, and the "no false positives on the real ledger" half of
  bullet 2: **rung 5** - shipped `./bin/mstack` driven as a process against the repository's
  own store, red before / green after, in both src directions.
- Finding 1 (multi-role supersession unpinned): **rung 4** - the mutation ran and the suite
  stayed green at exit 0. That the shipped *behaviour* is correct is rung 3 (read
  `src/gate.ts:403`, which never touches `entry.verifier`); no test proves it, which is the
  finding.
- Finding 1's side note (the `docs-for-newcomers` citation): **rung 2** -
  `.mstack/ledger.tsv:46,48,50`.
- Findings 2 and 3: **rung 4** - mutations run, outcomes observed.
- Not established at rung 4 and stated plainly: whether `citesImplementingReport` is safe
  against every slug the loader admits. I did not fuzz it; the docstring's argument
  (`src/roles.ts:125-128`: `SLUG` at `src/state.ts:49` admits no regex metacharacter,
  enforced at `src/state.ts:143`) is a rung-3 walk I read but did not execute. Out of this
  lens' scope; flagging it for the security lens rather than writing it up as settled.
