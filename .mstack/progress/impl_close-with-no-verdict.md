# close-with-no-verdict: implementation report

## What changed

With `rules.require_verdict_to_close` on, `state set --status done` now refuses an item with no
ledger row, in the gate's words (`it has no ledger verdict at all`) and with the gate's fix line.
It is a branch of the existing `independent-verdict` check in `src/closing.ts`, so it is not
overridable and the gate at `verifying` reports it too, as it does the author-only case. The
audit and the door share constants (`NO_VERDICT_WORDS/FIX`, `ONLY_FAILED_WORDS/FIX`). Names lose
Unicode `Cf` characters before comparison through `withoutFormatCharacters` (`src/roles.ts`), the
stripping `citesImplementingReport` already did; look-alikes are not folded. A lone
`verifier-failed` row has one reason at the door and in the audit, whoever recorded it. Every
list that named a verifier now goes through `typedName` (no leading apostrophe), including the
approval-citing-the-implementer's-report lists. The 50 tests that depended on the gap record a
verdict through `recordClosingVerdict` (`tests/helpers.ts`); none needed the rule off or the refusal.

## Files

`src/closing.ts`, `src/gate.ts`, `src/ledger.ts`, `src/roles.ts`; `tests/helpers.ts`,
`tests/closing-role.test.ts` (appended), `tests/verdict-reader.test.ts`, `tests/cli.test.ts`,
`tests/closing.test.ts`, `tests/gate.test.ts`, `tests/r-table-check.test.ts`,
`tests/review-budget-gate.test.ts`; `docs/wiki/The-CLI.md`, `Gates-and-Hooks.md`, `The-Agents.md`,
`How-A-Work-Item-Flows.md` (one sentence said a forced close with no verdict is caught later);
`CHANGELOG.md`; `.mstack/decisions.tsv` (one implement row).
Commits: tests first (green without the refusal), then src with its tests, then docs. The src
hunks for refusal, names and messages share files, so they are one commit.

## Commands

Red first (`bun test tests/closing-role.test.ts`, 16 pass, 4 fail, for the expected reasons):

```
AssertionError: 1 demo (done)                      <- the close exited 0 with no row
AssertionError: "se<ZWSP>lf": 1 demo (done)        <- zero-width self closed
AssertionError: reviewer: mstack: demo cannot close: a rejection stands in the ledger: verifier-failed at 48d3e2be by reviewer ...
AssertionError: The input did not match /cites the implementer's own report \(-reviewer\)/   <- apostrophe
```

Refusal added, suite run: bun 840 pass, 50 fail. Per file: r-table-check 22, gate 14, cli 7,
closing 5, review-budget-gate 2. All 50: way 1 (record a verdict). 14 gate tests do not close:
they sit at `verifying`, where the gate now reports the no-row case. Table of the 50 (file, name,
subject, way): `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl95/fifty.md` (10 KB). Full red output: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl95/full2.txt`.
`tests/walkthrough.test.ts` needed no change (it was not in the failing list; it closes with a
reviewer's row).

After the last edit: `npm run typecheck` clean; `./bin/mstack lint-plugin .` PASSED;
`node scripts/check-doc-links.mjs README.md docs/wiki/*.md` 109 links, 0 broken;
`npm run test:bun` and `test:node` both 891 pass, 0 fail (883 before, +8 tests in
`closing-role.test.ts`; `verdict-reader.test.ts` gained a case in an existing loop), run with
`HOME` an empty directory and `GIT_CONFIG_GLOBAL=/dev/null`.

Real session in a scratch repository (`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl95/session.sh`, item at `verifying`):

```
$ mstack state set demo --status done
mstack: demo cannot close: it has no ledger verdict at all
        record it with 'mstack ledger record'; if no check could be run, that verdict is 'verifier-blocked'
$ mstack gate        # [fail] 1 demo (verifying) is one step from done, and it has no ledger verdict at all
$ mstack state set demo --status done --force --closed-by x      # same refusal, exit 2
$ mstack ledger record demo <sha> verifier-blocked --evidence "no check could be run" --verifier implementer
$ mstack state set demo --status done      # refused: its only verdicts are from the pass that wrote the code (only implementer)
$ mstack ledger record demo <sha> verifier-blocked --evidence "no check could be run" --verifier reviewer
$ mstack state set demo --status done      # closes; mstack gate then PASSED (the gate lets blocked close)
```

So the fix line does not over-promise: `verifier-blocked` closes only under a name that is not the
author's, and the author's name gets its own refusal, which says so. `mstack ledger check` still
fails a blocked row (documented). The README close steps were followed in a scratch repository
(`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl95/readme.sh`): no row refused, implementer row refused, reviewer row passes the verdict
check (then the table check, as the README says); `examples/` has no close steps.

Mutants (bun, `closing-role`, `verdict-reader`, `ledger` tests; `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl95/mutants.py`):

| Mutant | Killed by |
|---|---|
| no-row refusal removed | `closing-role.test.ts:261`, `verdict-reader.test.ts:126` |
| rule-off branch inverted | `closing-role.test.ts:281` and the author-only tests |
| format-character stripping removed | `closing-role.test.ts:311` |
| door lone-failed reason reverted | `closing-role.test.ts:326` |
| audit lone-failed words changed | `closing-role.test.ts:326` |
| audit no-row fix line changed | survived the first run; `closing-role.test.ts:372` added, now killed |
| gate's `typedName` dropped, forged list / rejected list / self-closed list | `closing-role.test.ts:346` (each) |
| `describeRow` and door forged list `typedName` dropped | `closing-role.test.ts:346` |
| gate's self-closed fix line changed | `closing-role.test.ts:346` |

## R to test

| R | Test | Where |
|---|---|---|
| A1 | no-row refusal, rule off, blocked row, door/gate/audit parity | tests/closing-role.test.ts:261, tests/closing-role.test.ts:281, tests/closing-role.test.ts:291, tests/closing-role.test.ts:372, tests/verdict-reader.test.ts:126 |
| A2 | the 50 tests record a verdict; the helper; the comment at 113-117 is true | tests/helpers.ts:93, tests/r-table-check.test.ts:80, tests/cli.test.ts:317, tests/gate.test.ts:937, tests/closing.test.ts:25, tests/review-budget-gate.test.ts:120, tests/verdict-reader.test.ts:126 |
| A3 | format characters, look-alike, lone-failed parity, no apostrophe at the door | tests/closing-role.test.ts:311, tests/closing-role.test.ts:320, tests/closing-role.test.ts:326, tests/closing-role.test.ts:346 |
| A4 | gate side of both message fixes; approval-citing list | tests/closing-role.test.ts:346, tests/closing-role.test.ts:372 |
| A5 | n/a: docs and a comment only; ran check-doc-links (0 broken) and the scratch session above | n/a: docs only; check-doc-links.mjs 109 links, 0 broken, plus the scratch session |

## Decisions and things to read first

- Table of the 50: all way 1; none needed the rule off or the refusal, because the new tests in
  `closing-role.test.ts` own those subjects. The helper uses the real ledger writer, `reviewer`,
  evidence `node --test tests`; the helper's `require_verdict_to_close` default is unchanged.
- Lines added (old citations moved): `tests/helpers.ts` +15 (import at 8, helper at 83-93, so
  everything after line ~79 moved by 1 then 15), `tests/gate.test.ts` +14, `tests/cli.test.ts` +7,
  `tests/closing.test.ts` +5, `tests/review-budget-gate.test.ts` +3 (an import at line 8, then two
  calls), `tests/r-table-check.test.ts` +1 (line 80), `tests/verdict-reader.test.ts` net +1 from
  line 126 on (the comment went from 4 lines to 4, wrapped; one case added). Imports were
  edited in place. `closing-role.test.ts` only grew at the end.
- Decision row: the gate at `verifying` reports the no-row case. Cost: an item at `verifying` with
  no row is red until a verdict is recorded, as it already was with only the implementer's row.
- Lone `verifier-failed`: at the door the author-named case also gets the audit's reason (it used
  to say "only verdicts are from the pass that wrote the code"); the audit gives the same for both.
- `ledger check` messages also print names through `typedName`.
- Doc fix outside the list: `How-A-Work-Item-Flows.md` said a forced close with no verdict is
  caught on the next run; it is now refused.
- Reviewer, first: `src/closing.ts` `independentVerdict` and `standingRejection` (lone-failed
  routing), then `tests/helpers.ts:93` against a sample of the 50 changed tests.
