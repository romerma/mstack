# Implementation, any-role-name-closes (item 82), round 2

Scratch directory (run scripts and raw output): `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl82r2/`
(`common.sh`, `gs.sh`/`gs.out`, `agents.sh`/`agents.out`, `readme.sh`/`readme.out`, `gh.sh`/`gh.out`, `upgrade.sh`/`upgrade.out`, `diffpages.sh`).

## What changed since round 1

Both blocking findings held and are fixed in the docs; of the non-blocking list I applied 1 (the comment), 3 (colon rule, documented), 4 (upgrade note, both claims run), 5 (spec-author fix line), 6 (way out in the fix line), 7 (apostrophe) and 8 (the changelog paragraph is wrapped). Not applied: 2 (zero-width and look-alike characters) and the zero-row close and the lone `verifier-failed` reason in 5, which are item 95.

- **Walkthroughs** (`The-Agents.md`, `Getting-Started.md`, `README.md`): each sequence was run again in a scratch repository built the way the page says (`greet-flag`, id 1, `greet.py`, `test_greet.py`). The close on the implementer's row is now shown refused (exit 2, the real lines; in The-Agents with `--force`, which does not help), the reviewer's row is recorded, the close is accepted. Getting-Started's "the item is done, and the gate still refuses" now says the close itself refuses and the gate audits every closed item for the same thing. The README block no longer shows a gate over a done item, and its prose says the close goes through.
- **`The-Agents.md:223`** and **`CHANGELOG.md:5`**: narrowed to "only verdicts are the author's" (and a closing verdict citing the author's report); an item with no row still closes and the next gate fails it.
- **CHANGELOG** upgrade note, with both claims run (below).
- **Messages** (`src/closing.ts`, `src/gate.ts`, `src/roles.ts`): `SELF_CLOSED_FIX`, shared by the door and the gate, now reads: a closing verdict has to come from a pass that did not write the code; run the verification again from one and record the row under a name that is not the author's (your own name, or `ci`), or, if no check could be run, record `verifier-blocked` under such a name. It no longer says "implementer". New `typedName` (roles.ts) drops the ledger writer's apostrophe; `normalisedRole` uses it, and so do the door's and the gate's `(only ...)` lists, so the two print the same name (the brief named the door only; leaving the gate printing `'-implementer` would have made them disagree).
- **Colon rule**: GLOSSARY.md "Closing role" (still two sentences, 14 entries) and `Gates-and-Hooks.md` now say the part after the last `:` is the name. Test pins `ci:dev` refused, `dev:ci` closes.
- `tests/verdict-reader.test.ts:113-118`: comment corrected, same line count (diff of that file: one line replaced by one line).
- Also changed, because the line it quotes changed: `Gates-and-Hooks.md` transcript fix line (from `gh.out`), the assertion at `tests/closing-role.test.ts:77` (same line).

## Files

`src/closing.ts`, `src/gate.ts`, `src/roles.ts`, `tests/closing-role.test.ts` (4 tests appended at the end, one regex at :77), `tests/verdict-reader.test.ts` (comment), `README.md`, `docs/wiki/The-Agents.md`, `docs/wiki/Getting-Started.md`, `docs/wiki/Gates-and-Hooks.md`, `GLOSSARY.md`, `CHANGELOG.md`.

## Commands

Red first (`bun test tests/closing-role.test.ts` with the 4 new tests, before the code): `9 pass 4 fail`; the three message tests failed on the old line (`actual: "... somewhere other than the implementer; run the verification again from a pass that did not write it"`, `(only '-implementer)`, spec-author text containing `implementer`). The colon test passed at once: it pins behaviour the code already had (a guard, not a red-first test). After the code: `13 pass 0 fail`, with verdict-reader `34 pass 0 fail`.

Mutants (bun, closing-role file; each restored):
```
M1 drop "verifier-blocked" from the fix line   killed: the way-out test
M2 fix line says "the implementer" again       killed: :72 and the spec-author test
M3 door keeps the apostrophe                   killed: the apostrophe test
M4 roleOf keeps the whole name (no last colon) killed: the colon test (and 13 others)
```

Page against run (`bash .../impl82r2/diffpages.sh`, which diffs, per page, the refusal's two lines, the accepted close and the gate line with `diff <(rg ... PAGE) <(rg ... RUN)`):
```
--- docs/wiki/The-Agents.md refusal            (empty)
--- docs/wiki/Getting-Started.md refusal       (empty)
--- README.md refusal                          (empty)
--- docs/wiki/The-Agents.md close              (empty)
--- docs/wiki/Getting-Started.md close         (empty)
--- docs/wiki/The-Agents.md gate               (empty)
--- docs/wiki/Getting-Started.md gate          (empty)
--- docs/wiki/Gates-and-Hooks.md refusal (slug greet-flag -> demo)   (empty)
```
The shas in the unchanged `recorded ... at <sha>` lines are the pages' old ones, not the run's; only the lines above were replaced, and none contains a sha. The README shows the refusal only (its prose says the close goes through; `readme.out` has that close: `1 greet-flag (done)`).

Refusal as printed at head (`agents.out`):
```
$ mstack state set greet-flag --status done --force --closed-by "demo: skipping review on purpose"
mstack: greet-flag cannot close: its only verdicts are from the pass that wrote the code (only implementer)
        a closing verdict has to come from a pass that did not write the code; run the verification again from one and record the row under a name that is not the author's (your own name, or `ci`), or, if no check could be run, record `verifier-blocked` under such a name
[exit 2]
```

Upgrade claims (`upgrade.out`; stores built with the CLI of a `git worktree` of `7d71f2e`, removed afterwards; head gate run on them). For `dev`, `author`, `self` and `ci:dev` alike:
```
base close under 'dev':   1 demo (done)   [base close exit 0]
base gate:                [ok]    1 closed item(s) carry a ledger verdict   PASSED - 0 failures, 2 warnings
head gate:                [fail]  items closed on a verdict from the pass that wrote the code: demo (only dev)
                                  fix: a closing verdict has to come from a pass that did not write the code; ...
                          FAILED - 1 failure, 2 warnings
one reviewer row, head:   [ok]    1 closed item(s) carry a ledger verdict   PASSED - 0 failures, 2 warnings
```
(`only author`, `only self`, `only ci:dev` the same.) At `verifying` with an implementer-only row, base gate prints no line about it; head prints `[fail]  1 demo (verifying) is one step from done, and its only verdicts are from the pass that wrote the code (only implementer)`.

Verify, after the last edit: `npm run typecheck` clean; `./bin/mstack lint-plugin .` `PASSED - 0 failures, 0 warnings`; `./bin/mstack gate` `PASSED - 0 failures, 0 warnings`, glossary `[ok] GLOSSARY.md: 14 entries, each a term with a one or two sentence definition`; `node scripts/check-doc-links.mjs README.md docs/wiki/*.md` `105 relative links checked, 0 broken`; `npm run test:bun` `879 pass 0 fail`; `npm run test:node` `tests 879 pass 879 fail 0` (875 each before, 879 now).

## R to test

| R | Test | Where |
|---|---|---|
| A1 | refused names and near misses; the colon rule | tests/closing-role.test.ts:72, tests/closing-role.test.ts:82, tests/closing-role.test.ts:231 |
| A2 | refused at done with the gate's reason, `--force` does not override; the way out, the spec-author line and the printed name | tests/closing-role.test.ts:91, tests/closing-role.test.ts:109, tests/closing-role.test.ts:187, tests/closing-role.test.ts:205, tests/closing-role.test.ts:218 |
| A3 | glossary and wiki prose; transcripts diffed by diffpages.sh | n/a: prose in GLOSSARY.md and the wiki, no test pins the wording; the gate checks the glossary format only |

Table rows cite: :72 the refused-names test, :82 the near-misses test, :91 the empty-verifier test, :109 the `--force` test, :187 the way-out test, :205 the spec-author test, :218 the apostrophe test, :231 the colon test.

## Findings not applied

- Zero-row close, zero-width and look-alike characters, and the lone `verifier-failed` reason at the door: item 95, as the brief says.
- Pre-existing, not touched: the Getting-Started close (`state set greet-flag --status done`) is also refused by the receipt and report-table checks for an item that has a `base` (`state add` records one in a git repository), before and after this change: `gs.out` ran after an implementation report with a table existed and `gate --full` had run. The page's transcript never shows either step. A reader who follows the page literally meets those refusals after the reviewer's row. Out of scope here; worth its own item.
