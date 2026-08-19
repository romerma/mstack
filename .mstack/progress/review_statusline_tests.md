# Review - statusline (tests)

**Verdict:** CHANGES_REQUESTED

## Method

Every mutation below was applied to the real source file with the Edit tool, run against the
real suite with `node --test`, observed, and reverted with `git checkout -- <file>` before the
next one. Nothing below is inferred from reading the code — each row is a rung-4 result (evidence
ladder, `skills/router/references/evidence-ladder.md`): I ran it and it either failed loudly or it
didn't. `git diff` on the three source files was empty at the end of every cycle.

## Mutations I injected

| What I broke | file:line | Did a test catch it? |
|---|---|---|
| Stale verdict branch: paint the stale row GREEN using `result.stale[0].verdict` instead of RED `verdict stale (N)` | `src/statusline.ts:122-124` | **Yes** — "a stale verdict is called out..." failed (expected `/verdict stale \(1\)/`, got `test-verified`) |
| `active.length > 1` branch: removed the push+return, fell through to render `active[0]` as if it were the only item | `src/statusline.ts:108-111` | **Yes** — "more than one active item is surfaced..." failed (expected `/2 active items/`, got `...unverified`) |
| `join()`: always join with the coloured `SEP`, ignoring the `colours` flag (NO_COLOR would still emit escapes) | `src/statusline.ts:148` | **Yes** — 3 tests failed: "NO_COLOR leaves no escape sequence...", "truncation counts printable characters...", "token counts are compacted..." |
| `truncateVisible`: removed the ANSI-skip branch so escape bytes now consume the visible-character budget | `src/statusline.ts:161-177` | **Yes** — exactly "truncation counts printable characters, so colour never eats width" failed |
| `roles.ts reportFiles`: `startsWith(\`${prefix}_\`)` → `startsWith(prefix)`, dropping the separator (`cli` would claim `cli-search` files) | `src/roles.ts:53` | **No** — 32/32 in `tests/statusline.test.ts` + `tests/fanout.test.ts` stayed green. (Caught only by `tests/hooks.test.ts:184`, which is outside this review's scope — see Findings §1.) |
| `renderSubagents` 40-byte floor: `size >= 40` → `size >= 0` | `src/statusline.ts:277` | **Yes** — exactly "an essentially empty report is not a report, matching the SubagentStop floor" failed |
| `fanout.ts plan()`: removed the `if (seen.has(name)) throw ...` duplicate-worker guard | `src/fanout.ts:74` | **Yes** — exactly "two workers with the same name are refused before anything launches" failed |
| `fanout.ts plan()`: removed the `options.workers.length > CONCURRENCY_CAP` block entirely | `src/fanout.ts:57-62` | **Yes** — exactly "the concurrency cap is enforced by code, not mentioned in prose" failed |
| `fanout.ts plan()`: `suffix = round > 1 ? \`r${round}-${name}\` : name` → always `name` | `src/fanout.ts:76` | **Yes** — exactly "a later round does not collide with the first" failed |
| *(bonus, beyond the requested list)* passing-verdict colour: `paint(GREEN, ...)` → `paint(RED, ...)` — a passing verdict now renders as if failing | `src/statusline.ts:121` | **No** — 21/21 `tests/statusline.test.ts` stayed green |
| *(bonus)* deleted the git-branch line entirely (`const branch = git(...); if (...) parts.push(branch)`) | `src/statusline.ts:85-86` | **No** — 21/21 `tests/statusline.test.ts` stayed green |

**7 of 9 requested behaviours are genuinely pinned** by a test that fails when the behaviour breaks.
**2 of 9 are not** (`reportFiles` separator, in scope; the concurrency cap and duplicate-name and
round-suffix checks ARE pinned, so `src/fanout.ts` is fully covered by the 3 fanout-specific
mutations — the only in-scope miss is the shared `roles.ts` dependency).

## Findings

1. **`src/roles.ts:53` (reached from both `src/statusline.ts:276` and `src/fanout.ts:123`) — the
   prefix/separator boundary in `reportFiles` has no test in either file under review.**
   Neither `tests/statusline.test.ts` nor `tests/fanout.test.ts` constructs two slugs that share a
   prefix (e.g. `cli` / `cli-search`) to prove the `_` separator matters. Both files call into this
   function (`renderSubagents` for the subagent row, `check` for fan-out accounting and stray-file
   detection), so a regression here silently misattributes one role's/item's report files to
   another's. It happens to be caught elsewhere in the repo (`tests/hooks.test.ts:184`), which is
   why the *codebase* isn't blind to it — but that test is not part of what was submitted for this
   review, so as far as `statusline.test.ts`/`fanout.test.ts` are concerned this is an unguarded
   dependency. A test belongs in one of the two reviewed files (most naturally `fanout.test.ts`,
   since `check()`'s stray-file detection is exactly the code path this would corrupt): two items
   with adjacent slugs, one worker each, and assert the stray/']`written` count doesn't cross over.

2. **Colour selection is entirely unverified, everywhere in `src/statusline.ts`.** `rg` over
   `tests/statusline.test.ts` for `RED|GREEN|YELLOW|CYAN|DIM` or any ANSI code literal returns zero
   hits. Every test either forces `colours: false` (`plain()` helper) or, in the one `colours: true`
   test ("truncation counts printable characters"), only checks that the line ends in `RESET` and
   that the stripped length is 24 — never which colour wrapped which segment. Proven concretely:
   swapping the passing-verdict colour from GREEN to RED (`src/statusline.ts:121`, mutation table
   row 10) — i.e. making a passing verdict display as if it were failing — left all 21 tests green.
   The same blindness covers every other `paint()` call: model CYAN, no-store/idle DIM, malformed-state
   RED, `>1 active` RED, status YELLOW/RED, verdict GREEN/YELLOW/RED/DIM, and the `ctx` RED/YELLOW/DIM
   thresholds at `src/statusline.ts:134`. None of these are pinned to a specific colour by any test.
   A single test asserting the real ANSI codes for a passing vs. a stale vs. an unverified line (with
   `colours: true`) would close most of this at once.

3. **`src/statusline.ts:53-59` `parseInput` — the `"[]"` case in the "hostile stdin" test is
   unverified.** The test iterates `["", "not json", "null", "[]", "3", '{"model":']` but only calls
   `assert.doesNotThrow`; the `deepEqual(..., {})` checks that follow only cover `"null"` and `"3"`.
   Verified directly: `parseInput("[]")` returns an actual `Array` (`Array.isArray === true`), not
   `{}` — `typeof [] === "object"` passes the guard on line 56 and the array is returned as-is. The
   test's own name ("yields an empty payload") is not true for this input and nothing catches that.

4. **`src/statusline.ts:115` — the `item.status === "blocked" ? RED : YELLOW` branch is dead code,
   and no test exposes the resulting product gap.** `"blocked"` is not in `ACTIVE_STATUSES`
   (`src/lifecycle.ts:25-31`), so `isActive("blocked")` is always `false`, so a blocked item never
   enters the `active` array this line reads from — the RED half of the ternary can never execute.
   Verified directly: a state containing only a `"blocked"` item renders as plain `"main · idle"`,
   identical to having no items in progress at all. Nothing on the status line indicates a blocked
   item exists. No test in `tests/statusline.test.ts` constructs a blocked-only state, so this gap
   (arguably the more important bug — a blocked item is invisible, not just wrongly coloured) has no
   test that would catch a fix or a further regression either way.

5. **`src/statusline.ts:261-284` `renderSubagents` — the "store exists but no active item" path is
   untested.** Every subagent-row test sets an active item first. Verified directly: with a store
   present but only a `"pending"` item, the row for a matching task collapses to `{id, content:
   "implementer"}` — same shape as the "no store at all" case tested at line 264-271 of the test
   file, but reached through a different branch (`item === undefined` vs. `store === null`). No test
   distinguishes "idle project, store present" from "no store."

6. **`src/statusline.ts:279-283` — the plural branch (`written.length > 1` → `"${n} ${kind}
   reports"`) has zero coverage.** Every test that reaches this code writes at most one matching
   report file. Verified directly: writing two `impl_storage-layer*.md` files does correctly produce
   `"2 impl reports"` — the code is right — but no shipped test exercises it, so a regression there
   (e.g. always using the singular string, or an off-by-one on the `> 1` threshold) would pass
   unnoticed.

## Runner parity

`npm run test:node` and `npm run test:bun` were both run against the untouched tree (full suite,
all 11 test files): **116/116 pass under both runners**, and specifically 32/32 for
`tests/statusline.test.ts` + `tests/fanout.test.ts` under both. No test name passed under one runner
and not the other. The suite is honest across runners.

## Working tree

```
 M .mstack/progress/current.md
```

`src/statusline.ts`, `src/roles.ts`, and `src/fanout.ts` are byte-identical to HEAD (`git diff` on
all three is empty). One unexpected drift was caught and handled during the review: a run mid-session
left `.mstack/state.json` with a fabricated extra item (id 5, slug "x") that none of my sandboxed
test runs could have written (they all operate in `mkdtemp`'d OS temp dirs, never this repo's own
`.mstack/`) — almost certainly this project's own hooks self-tracking the review session. It was
reverted with `git checkout -- .mstack/state.json` and stayed reverted for the remainder of the
session. `.mstack/progress/current.md` is the same kind of harness self-tracking and was left as
found, per the task's own instruction.
