# Review - fanout-worker-can-forge-a-round-marker

**Verdict:** CHANGES_REQUESTED

Reviewed alone, round 1, at HEAD `d3aa2a8144de9505b9219db2a890003798569b60` (delta `528cfb7..HEAD`).
The suite is green and the fix works for `r2`, `r10` and `r2-facts`. It is not approvable yet,
for one reason: the boundary this item exists to draw (`r<digits>` followed by a letter) is
neither tested nor described the way the code behaves. Two mutations at that boundary leave the
suite green, and one of them brings the forgery back (see change 1).

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| A1 refuse a round-marker worker name at allocation | `tests/fanout.test.ts:217` | Fails on base `src/fanout.ts` on bun and node (`Missing expected exception: r2`), passes at HEAD. Rung 4. Boundary not pinned, change 1 |
| A2 before and after run | my CLI runs below, base and HEAD | Rung 5, the real `./bin/mstack` |
| A3 `roundOf` table and semantics | `tests/roles.test.ts:161`, `:169`; cross-check `tests/fanout.test.ts:228-230` | Rung 4. The table has 79 of the 80 real reports (change 4). The "any other remainder" clause is only tested with lenses that do not start `r<digit>` (change 1) |
| A4 one `MIN_REPORT_BYTES` | none, structural | Rung 2: the only definition is `src/roles.ts:64`; `src/fanout.ts:5` imports it and uses it at `:126`; `rg '\b40\b' src/` finds no other literal |

## Acceptance, quoted
**"A worker name that would produce a round-marker path is refused or renamed at allocation time, not left to the reviewer to notice"** - met for every name `roundOf` reads as a marker, by `src/fanout.ts:50` and `:89-94`. I ran `r2`, `r10`, `r2-facts` and `r0`: all exit 2. `reader`, `r-team`, `r`, `rust2` and `r2x` are allocated, and `--round 2 --worker facts --worker r-team` gives `_r2-facts.md` and `_r2-r-team.md`. On names that pass `WORKER` (`src/fanout.ts:47`), `ROUND_LIKE` and the `roundOf` marker regex (`src/roles.ts:80`) accept exactly the same set: a hyphen in a `WORKER` name is always followed by `[a-z0-9]+`, so `r2-` alone cannot occur. That is rung 3, by reading the two regexes. No test pins it at `r2x`, change 1.

**"Proven by running fanout plan with such a worker and showing what it does before and after"** - met. I reproduced both sides myself (below). The before side ran in a scratch copy with the base `src/` files.

**"src/roles.ts exports roundOf(file, kind, slug) returning {round, lens}: unmarked is round 1, _r<N> and _r<N>-<lens> give N, any other remainder is round 1 with that lens; a test table covers every real report name in .mstack/progress, including review_readme-leads-with-use_readme-leads-with-use.md"** - mostly met. `src/roles.ts:74-86` follows the stated semantics, and the named file is at `tests/roles.test.ts:144`. Two gaps. (a) The table has no row for `impl_fanout-worker-can-forge-a-round-marker.md`, which is in the directory now (change 4). (b) For "any other remainder" the test uses `reader` and `r`, never a remainder starting `r<digit>`, which is the one case where the clause matters (change 1).

**"MIN_REPORT_BYTES has one definition: src/fanout.ts imports it from src/roles.ts instead of redefining it"** - met. The definition is at `src/roles.ts:64`, the import at `src/fanout.ts:5`, and the old local const is removed. Rung 2.

## The five points in the brief
1. **Regex.** It refuses no legitimate lens name: `reader`, `r-team`, `r`, `rust2` and `r2x` all pass. Run output is below.
2. **`roundOf` against existing classifiers.** No code in `src/` classifies rounds.
   - The gate decides whether a row can close an item from the verifier column (`src/gate.ts:383`, `canCloseAnItem`), never from a filename.
   - The hook and the statusline use `reportFiles`, a prefix match that ignores rounds (`src/roles.ts:44-56`, `src/hooks.ts:136`, `src/statusline.ts:356`). `citesImplementingReport` (`src/roles.ts:180`) ignores rounds too.
   - `roundOf` has no production caller; only tests import it.
   - The two readers that disagree with it are prose. `agents/reviewer.md:77` says "a leading `r<digits>` in what remains is a round marker". Read literally, `_r2x` has a leading `r2`, while `roundOf` returns `{round:1, lens:"r2x"}`. Both still end in "lens, record nothing" (`reviewer.md:78-79`), so the solo-or-panel outcome agrees and only the round number is ambiguous. `skills/review/SKILL.md:20-21` disagrees on `r2-facts` (change 3).
3. **A3 table against the directory.** The table has 79 rows, no duplicates, and all 79 exist on disk. `comm` against the 82 files in `.mstack/progress/` leaves `current.md` and `history.md` (not reports) and `impl_fanout-worker-can-forge-a-round-marker.md` (missing). Four table slugs are not item slugs (`bare-names-wording`, `session`, `divergent`, `refinement`). Each is the only possible parse, because slugs cannot contain `_` (`src/state.ts:49`).
4. **Fail-before.** The refusal test fails on base `src/fanout.ts`, with `roundOf` kept present so the failure is the assertion and not an import error. Output below. With both base `src/` files the roles test also fails, trivially: `Export named 'roundOf' not found`.
5. **Docs.** The block at `docs/wiki/The-CLI.md:422-425` is byte-identical to a real run (`diff` is empty). The prose around it states the rule wider than the code does (change 2).

Tests were not weakened. The only `-` line in `git diff 528cfb7..HEAD -- tests/` is the widened import at `tests/roles.test.ts:4`. No debug leftovers.

## Verification I ran
```
$ ./bin/mstack fanout plan --kind review --worker r2      # HEAD
mstack: 'r2' is not a usable worker name: it would be read as a round marker
        names starting r<digits> are reserved for review rounds; pick a lens name like 'reader' or 'security'
exit 2
$ ./bin/mstack fanout plan --kind review --worker r2      # scratch copy, base 528cfb7 src/
  r2	.../scratchpad/old/.mstack/progress/review_fanout-worker-can-forge-a-round-marker_r2.md
exit 0
$ ./bin/mstack fanout plan --kind review --worker reader  # HEAD; same for r-team, r, rust2, r2x
  reader	/Users/romerma/Code/mstack/.mstack/progress/review_fanout-worker-can-forge-a-round-marker_reader.md
exit 0
$ ./bin/mstack fanout plan --kind review --round 2 --worker facts --worker r-team
  facts	.../review_fanout-worker-can-forge-a-round-marker_r2-facts.md
  r-team	.../review_fanout-worker-can-forge-a-round-marker_r2-r-team.md
exit 0
```
`plan` only prints. The listing of `.mstack/progress/` was identical before and after, so there
was nothing to clean up.

Fail-before, base `src/fanout.ts` with HEAD `src/roles.ts`, in a scratch copy (the working tree was not touched):
```
bun:  AssertionError: Missing expected exception: r2   at tests/fanout.test.ts:221:14
      13 pass / 1 fail
node: ✖ a worker named like a round marker is refused, because roundOf would read it as one
      AssertionError [ERR_ASSERTION]: Missing expected exception: r2
```
Mutations, in the scratch copy, running `bun test tests/fanout.test.ts tests/roles.test.ts`:
```
M1 ROUND_LIKE = /^r\d/                              17 pass 0 fail   (survives)
M2 roundOf marker /^_r(\d+)(?:-(.+))?/  (no $)      17 pass 0 fail   (survives)
M3 ROUND_LIKE = /^r\d+$/                            13 pass 1 fail   (killed)
```
Full suite, no hang this run:
```
$ PATH=.../node/v24.14.0/bin:$PATH npm test
 295 pass
 0 fail
Ran 295 tests across 18 files. [34.39s]
ℹ tests 289
ℹ pass 289
ℹ fail 0
exit=0
$ bun run typecheck            -> exit 0
$ ./bin/mstack lint-plugin .   -> PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md -> 93 relative links checked, 0 broken
$ ./bin/mstack gate --full     -> [ok] npm test && npm run typecheck && ./bin/mstack lint-plugin .
                                  PASSED - 0 failures, 1 warning (uncommitted state.json)
$ ./bin/mstack ledger check fanout-worker-can-forge-a-round-marker
FAIL no verdict at d3aa2a81; 1 row(s) exist at other SHAs   (the implementer's row at 84e0e9e)
```

## Changes required
1. **The `r<digit><letter>` boundary is unpinned.** The places are `tests/fanout.test.ts:228` and `tests/roles.test.ts:169-174`.
   - M2 survives. With `roundOf`'s marker regex unanchored, `fanout plan` still allocates `r2x` as `review_<slug>_r2x.md`, and `roundOf` now reads that file as `{round: 2}` with no lens. That is a lone reviewer's round 2, the exact forgery this item closes, and all 17 tests stay green.
   - M1 survives too: refusing `r2x` would also go unnoticed.
   - Fix: add a name like `r2x` to the plan at `tests/fanout.test.ts:228`. Its existing `roundOf(...).lens === w.name` cross-check then kills M2, and the call kills M1. Also add `roundOf("review_s_r2x.md", ...)` -> `{round:1, lens:"r2x"}` at `tests/roles.test.ts:169`.
   - If you take the widening fix in change 2, assert that `r2x` is refused instead.
2. **The stated rule is wider than the code.** The places are `src/fanout.ts:92` (the hint) and `docs/wiki/The-CLI.md:418` and `:424`.
   - All three say names "starting r<digits>" are refused or reserved. `r2x` starts with `r2` and is accepted, as my run above shows.
   - Fix, either way:
     - (a) Widen `ROUND_LIKE` to `/^r\d/`. The code then matches the hint, the wiki and the literal reading of `agents/reviewer.md:77`, and refusal stays a safe superset of what `roundOf` reads as a marker. Reword the `src/fanout.ts:49` comment to say it is a superset.
     - (b) Narrow the three texts to "`r<digits>` alone or followed by a hyphen".
   - I'd pick (a): it gives one rule across code, error, wiki and agent prose, and the only cost is refusing names like `r2x`.
3. **What a refused name would turn into is described wrongly.**
   - `skills/review/SKILL.md:20-21` says `r2-facts` "would be read as round 2 of a lone reviewer, never as a lens". `_r2-facts` is read as round 2, lens `facts`, by `roundOf` and by `agents/reviewer.md:79`. The real harm is a collision: `plan --round 2 --worker facts` allocates the same `review_<slug>_r2-facts.md`, which my run shows. Reword it to cover both cases.
   - Same at `src/fanout.ts:87-88`: "`r2` or `r2-x` becomes `..._r2.md`". `r2-x` becomes `..._r2-x.md`.
4. **One real report is missing from the table.** `tests/roles.test.ts:79-159` has no row for `impl_fanout-worker-can-forge-a-round-marker.md`, and A3 says "every real report name". Add `["impl_fanout-worker-can-forge-a-round-marker.md", "impl", "fanout-worker-can-forge-a-round-marker", 1, undefined]`. Once this file lands, its row is `["review_fanout-worker-can-forge-a-round-marker.md", "review", ..., 1, undefined]`.

## Non-blocking notes
- `ROUND_LIKE` (`src/fanout.ts:50`) is a second regex for a fact that `roundOf` (`src/roles.ts:80`) owns, and only the test cross-check ties them together. Deriving the refusal from `roundOf` would make drift impossible, for example by refusing when `roundOf(join(store.progress, `${kind}_${item.slug}_${name}.md`), kind, item.slug).lens !== name`. The tradeoff: one source of truth, but the rule is less obvious when you read `plan`.
- `roundOf` validates nothing. `review_s_r0.md` gives `{round:0}`. A file outside the prefix (`review_other_x.md` with slug `s`) gives lens `review_other_x`. No caller reaches either case today.
- Evidence ceiling: A1 to A3 reached rung 4, A2 rung 5, and A4 only rung 2, being structural with no test.

CHANGES_REQUESTED
