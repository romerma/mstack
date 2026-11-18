# Implementation report: any-role-name-closes (item 82)

## What changed

The rule for who may close an item is stated once in `src/roles.ts` (`canCloseAnItem`): the set stays open on purpose, and a verdict closes unless its verifier is, as a WHOLE name after normalisation (case, runs of spaces/hyphens/underscores, the `mstack:` prefix, the ledger writer's formula-guard apostrophe), one of `implementer`, `spec-author`, `impl`, `implementor`, `author`, `developer`, `dev`, `coder`, `self`, `me`, or empty. `dev-ci`, `self-hosted runner`, `impl review bot` keep closing. A new closing check `independent-verdict` (`src/closing.ts`) makes `state set --status done` refuse, with the gate's words and fix line, an item whose rows read (through `readVerdict`, every row of the item) as `author-only` or `discounted`. The gate's three fix strings are now shared constants so the two cannot drift. GLOSSARY.md, Gates-and-Hooks, The-CLI, The-Agents and CHANGELOG describe it.

Decisions (rows in `.mstack/decisions.tsv`, phase implement):
1. New check, not a correction of `standingRejection`: that one answers rejections only. `require_verdict_to_close` (read as `state.rules.require_verdict_to_close`, enforced by the gate's `checkClosedItems`) gates the new check too.
2. Not overridable by `--force`, so no `FORCED_*` marker: the gate audits every closed item forever and does not read `closed_by`, so a forced close would only leave the store red with the item out of the active set (the reason `standingRejection` gives). The way out is `verifier-blocked` or an independent approval.
3. Reads every row of the item, not only the head commit: the gate's audit does, an item records no closing commit, and requiring head would refuse the usual reviewer-then-chore-commit sequence. Tested ("approval at an older commit").
4. An item with NO row is not refused at `done`: 51 existing tests close with no ledger row, the brief names rows that are the author's, and a zero-row close is left to the gate's "no ledger verdict at all" as before. Follow-up, not done here.
5. Found on the way: the TSV writer prefixes `'` to a cell starting with `-`, `=`, `+`, `@` and the reader keeps it, so `--verifier=-self-` read back as `'-self-` and closed. `normalisedRole` drops that one apostrophe.

## Files

src/roles.ts, src/closing.ts, src/gate.ts, tests/closing-role.test.ts (new), tests/verdict-reader.test.ts (appended), GLOSSARY.md, CHANGELOG.md, docs/wiki/Gates-and-Hooks.md, The-CLI.md, The-Agents.md. skills/ship and skills/review: no sentence became untrue.

## Commands

Reproduction before the change (scratch repo, `repro.sh`): `ledger record demo <sha> test-verified --verifier=implementer`, then
```
$ ./bin/mstack state set demo --status done
1 demo (done)
  status: "verifying" -> "done"
exit=0
[fail]  items closed on a verdict from the pass that wrote the code: demo (only implementer)
```
Red, before the code (bun, `tests/closing-role.test.ts`): 4 pass 5 fail: the refused-names, empty/whitespace, evidence-cites-impl, `--force`, and rejection tests (near-miss/closing-names tests passed, as they must).
After: bun 875 pass 0 fail (865 before, +10: 9 in closing-role.test.ts, 1 in verdict-reader.test.ts); node 875 pass 0 fail
`npm run typecheck` clean; `./bin/mstack lint-plugin .` PASSED; `./bin/mstack gate` PASSED.

Real session (`session.sh`, full output in the scratch dir):
```
$ ledger record ... --verifier implementer
$ state set demo --status done
mstack: demo cannot close: its only verdicts are from the pass that wrote the code (only implementer)
        a closing verdict has to come from somewhere other than the implementer; run the verification again from a pass that did not write it
exit=2
$ ledger record ... --verifier self
$ state set demo --status done
mstack: demo cannot close: its only verdicts are from the pass that wrote the code (only implementer, self)
exit=2
$ ledger record ... --verifier session
$ state set demo --status done
1 demo (done)
exit=0
$ gate: [ok] 1 closed item(s) carry a ledger verdict; PASSED
```

This repository's own store (`ownledger.ts`, read-only, calls `readVerdict`): `{ closedItems: 47, unclosed: 0 }`. Verifier names in the ledger and `canCloseAnItem`: session, review panel, e2e session, adversarial reviewer, fact-check reviewer, release check, reviewer, orchestrator, verifier: true; implementer: false.

Mutants (bun, the two test files; `mutants.out`, `mutants2.out`):

| Mutant | Red test |
|---|---|
| no separator/case normalisation | refused-names (closing-role), agree (verdict-reader) |
| no lower-casing | same two |
| formula-guard apostrophe kept | refused-names (`-self-`, `_me_`) |
| name removed: impl, implementor, author, developer, me | refused-names |
| name removed: dev, coder, self | refused-names, agree |
| whole-name match -> substring | keeps-closing (`dev-ci`, `self-hosted runner`...), agree |
| new refusal removed | `--force` test, evidence-cites-impl test |
| `spec author` removed | equivalent: it normalises to `spec-author`, so the entry was dropped as redundant |

## R to test

| R | Test | Where |
|---|---|---|
| A1 | refused names and near misses | tests/closing-role.test.ts:72, tests/closing-role.test.ts:82 |
| A2 | refused at done with the gate's reason, `--force` does not override | tests/closing-role.test.ts:91, tests/closing-role.test.ts:109 |
| A3 | docs describe the rule | n/a: prose in GLOSSARY.md and wiki; gate checks the glossary format |
