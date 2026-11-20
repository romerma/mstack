# Review - size-tiers

**Verdict:** APPROVED

Head `a5c87ef491d09910caf31723a83d38f395942795`, base `e28c452`, 24 files. Lone review, round 1.
Every transcript cited below is under
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review44/`
(called `<s>` from here): `exp.txt`, `s17.txt`, `lint.txt`, `mut.txt`, `ten.txt`, `out/`.

No blocking finding. Ten non-blocking ones under "Changes required"; the first three matter most.

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| A1 | tests/lint.test.ts:461, 474, 484, 500, 525, 538 | Each cited line is a `test(` line. I removed the link from each of the six files in a copy: six separate reds naming the file (`<s>/lint.txt` lines 5-40); matrix deleted: red; header row copied into a skill: red. The tests pin the structure (one table, six links), not what the table says; the impl report says so (rung 2 for behaviour). |
| A2 | tests/lint.test.ts:512; tests/size-tiers.test.ts:29, 38, 47, 55, 86, 103, 114, 136, 147 | All ten lines exist and assert literals. My mutant M3 (no size read as `l`) is killed by :114. Reverting `src/panel.ts` turns 8 of 14 red (impl red run; the rest are guards). |

## Acceptance, quoted

**"The router, the feature and bug-fix playbooks and the design, review and implement skills
carry one matrix: s skips design candidates and the panel, m adds mutation, l adds understand,
design twice and a lens panel; delegation and an independent review hold at every size"** - met.
`skills/router/references/size-matrix.md:9-18` is the one table; the six files link it
(`lint-plugin` holds the links: `<s>/lint.txt`). I walked an `s`, an `m` and an `l` item through
router steps 3-4 and feature.md 1-8, then bug-fix.md 1-8:

- `s`: understand skipped (feature.md:6-8, bug-fix.md:22-24), design `skip: size s`
  (feature.md:11, bug-fix.md:32, design/SKILL.md:12), no mutation (feature.md:34,
  bug-fix.md:35), one lone reviewer (feature.md:36, bug-fix.md:39, review/SKILL.md:13).
- `m`: reads the code itself, designs in the session with a rejected alternative
  (design/SKILL.md:10-11, feature.md:10-11), adds `verify --mutation`, lone reviewer or panel.
- `l`: understand, the whole design procedure, a panel of two or more lens reports in one round,
  held by the gate.
- Every size: delegation (router/SKILL.md:79, implement/SKILL.md:9-10, feature.md:29, bug-fix.md:33)
  and an independent review (size-matrix.md:33-34, review/SKILL.md:9).

No two of the seven files tell a session to do contradictory things (finding 10 is the one tension), and none promises a check the gate does not run. The `m` text
does not imply the close enforces a mutation receipt: size-matrix.md:29-32 calls a survived or
blocked run "a finding the review answers". Docs say the same: The-CLI.md:309 says "Two sizes are
checked by code", `s` and `l`. Item 100 keeps the enforcement.

**"The router assigns a size at intake, and the gate fails an l item at verifying with no review
round of two or more lens reports"** - met. router/SKILL.md:30 and intake.md:51 pass
`--size <s|m|l>`, by the rule at size-matrix.md:4-5 (`l` if its paragraph fits, else `s`, else
`m`). That rule is as deterministic as "crosses several subsystems", which is the router's own
spec-path trigger. An `s` estimate that turns out wrong is backstopped by the gate; an `m` that
should have been `l` is not (finding 8). The gate side I ran on the real CLI, below.

## Verification I ran

**The lens-panel check, real CLI.** Each case is a throwaway repository set up with this
checkout's `./bin/mstack setup`, `HOME` a new empty directory, the item at `verifying` with an
independent `reviewer` row (`<s>/exp.sh`, output `<s>/exp.txt`):

| Case | gate | `state set --status done` |
|---|---|---|
| l, no review report | exit 1, `it has no review report`, fix names round 1 | exit 2; `--force --closed-by` exit 2 |
| l, lone round 1 | exit 1, `round 1 has a lone review` | exit 2; `--force` exit 2 |
| the fix line run as printed (`plan --round 2 --worker correctness --worker tests`), the two paths written | exit 0 | exit 0 |
| l, one lens report | exit 1, `round 1 has 1 lens report (correctness)` | |
| l, two lens reports | exit 0 | exit 0; gate afterwards exit 0 |
| two rounds, only round 1 had two | exit 0 | |
| two lens reports of 39 bytes | exit 1 | |
| two of exactly 40 bytes | exit 0 | exit 0 |
| two `touch`ed files | exit 1 | |
| two files of 42 bytes, two lines of filler | **exit 0** | **exit 0** (finding 2) |
| `review_bud_notes.md` + `review_bud_draft.md` | **exit 0** (finding 2) | |
| another item's lens reports; slug `size-tiers` with `review_size-tiers-2_*`; slug `size-tiers-2` with `review_size-tiers_*` | exit 1 each, `it has no review report` | |
| two CHANGES_REQUESTED lens reports | exit 0; red only once the `verifier-failed` row is recorded (`a rejection stands`) | exit 2 |
| m item, lone review, then `--size l` at verifying | 0, then 1 | |
| l, lone review, then `--size m` at verifying | 1, then **0**; no decisions.tsv row, only `state.json` changed | (finding 1) |
| l, lone review: `--status done --clear size` | | **exit 0, closed** (finding 1) |
| l, lone review: `--status done --size m` | | exit 2 (the size is applied after the status move) |
| m, s, no size; each with no report, a lone review, one lens report | exit 0, all nine | |
| l item already `done` on a lone review | exit 0 | |
| l, two lone rounds; fix line `--round 3` run as printed | 1, then 1 on the review budget (`round 3 and has no decision row`); after the printed `mstack decide --phase review-r3 --item bud ...`: 0 | |
| l at verifying: `--status cancelled`; `--status blocked` | both exit 0, gate 0 | cancelled then `done --force`: exit 2 |
| `_r0-a` + `_r0-b`; `_r2-` + `_correctness`; `_r02-a` + `_r2-b`; `__x` + `_R2-y` | exit 0 each (only a hand-made file gets those names: `plan` refuses them) | |
| two lens reports under `progress/attachments/` | exit 1 | |
| `gate --full`, l with a lone review (`<s>/s17.txt`) | exit 1 on the panel line; exit 0 after a round 2 panel | |

The pasted gate output in docs/wiki/Gates-and-Hooks.md:510-514 matches my run word for word,
with `greet` for `bud`.

**No wedge.** Every `l` state I built has a way out that works as printed: the panel round the
fix line names (for round 3 or later, plus the decision row it also names), `--size m`, or
`--status cancelled` / `blocked` from `verifying`. An item whose lone reviews came before this
check needs one panel round (case "two lone rounds"). A spike with no code and a superseded item
are cancelled, which no closing check reads.

**Non-overridable, judged against closing.ts.** It is consistent with the file:
`standingRejection`, `independentVerdict` and `reviewBudget` are not overridable either, and the
forced path (`src/cli.ts:775`) would have stamped `FORCED_UNVERIFIED`, a false record. Row
329: "not overridable because cli.ts gives every overridable problem other than the table the
'closed unverified' marker, which would be a false record ... the way out for an item that is not
l is state set --size, which state set prints and git keeps". The cost: re-sizing is now the only
exit that needs no panel, and it writes less than the `--force` path would have. No reason is
required, and nothing goes to decisions.tsv or `closed_by` (finding 1).

**This checkout.** `./bin/mstack gate`: `PASSED - 0 failures, 0 warnings`, including `[ok]    54
closed item(s) carry a ledger verdict`. Item 42 (`l`, `done`, three lone review rounds) is among
them. `./bin/mstack ledger check size-tiers` before my row: `FAIL no verdict at a5c87ef4; 1 row(s)
exist at other SHAs`. **Item 100** (`l`, `sdd`, `pending`, two forks parked) has no `review_`
report today; its `spec_review_*` files are another kind and do not count. At `verifying` it will
need a round-1 panel: `mstack fanout plan --kind review --worker <a> --worker <b>`, two reports,
and the coordinating session's synthesized row. It needs no `review-rN` row while that panel is
round 1 or 2. The CHANGELOG Upgrading note (CHANGELOG.md:22-26) is true as far as it goes: an `l`
item at `verifying` goes red, `--size m` clears it, closed items are not read, and `s`/`m`/none
are not held (all run above). It leaves out the round-3 row (finding 9).

**lint-plugin** (`<s>/lint.sh`, `<s>/lint.txt`): the six link removals, the deleted matrix
(8 failures: 7 broken links plus the missing file) and the router without `--size` are all red.
A header row copied into a skill is red; the same row copied into `docs/wiki/Home.md` passes, and
so does a capitalised header. A link only inside an HTML comment or a code fence passes, and so
does `--size` only inside a comment (finding 4). A minimal consumer plugin of mine
(manifest plus one skill): `PASSED - 0 failures, 3 warnings`, so there is no false failure on a
plugin without a router. One with its own `skills/router/SKILL.md`: 9 failures at head, 1 at the
base (the intake link, which predates this item). A bare `skills/router/` directory: 7 at head,
0 at base (finding 6).

**Mutants** (my own, each in its own `git archive` copy, `<s>/mut.sh`, `<s>/mut.txt`):

| Mutant | size-tiers.test.ts | elsewhere |
|---|---|---|
| M1 `roundOf` dash made optional (`_r2x` reads as round 2, lens `x`) | survives, 17/17 | killed by roles.test.ts (1 fail) and round-remainder.test.ts (2 fail): the panel's reading of odd names is pinned by `roundOf`'s own tests |
| M2 the stub floor `>=` to `>` in `substantialReports` (a 40-byte report stops counting) | survives, 17/17 | survives roles, fanout, review-budget-gate; and the whole node suite (1133 tests, 1132 pass, 0 fail) (finding 7) |
| M3 an item with no size read as `l` | killed: `an m item, an s item and an item with no size are not held` | |

**Suites**, in a `git archive` copy of the head with `HOME` a new empty directory (`<s>/suite.sh`,
`<s>/out/`). Typecheck used the bun cache's typescript 5.9.3 and @types/node 24.13.3; nothing was
fetched.

```
bun test ./tests      1130 pass, 3 skip, 0 fail; Ran 1133 tests across 59 files. [372.80s]  exit 0
node --test           tests 1133, pass 1132, fail 0, cancelled 0, skipped 1 (66.6s)        exit 0
tsc --noEmit          exit 0
lint-plugin .         PASSED - 0 failures, 0 warnings                                       exit 0
check-doc-links       112 relative links checked, 0 broken                                  exit 0
```

Ten runs each in a fixed-count `for` (`<s>/ten.sh`, `<s>/ten.txt`): `tests/size-tiers.test.ts` node 10/10 and bun 10/10 (17 tests); `tests/lint.test.ts` node 10/10 and bun 10/10 (37 tests). With `sh` linked to `/bin/dash` first on `PATH`: size-tiers node 17/17 and bun 17/17, lint node 37/37 and bun 37/37, all exit 0.

The implementer's suite numbers match mine exactly. I re-ran only my 3 mutants, not its 18.

## Changes required

None blocking. Non-blocking, each with the smallest change that settles it:

1. `src/cli.ts:694` (clears before the status move) and `skills/router/references/size-matrix.md:5`.
   Lowering the size is the one way past the panel, and it is silent. `state set <slug> --size m`
   at `verifying` turns the gate green with no row. `state set <slug> --status done --clear size`
   closes an `l` item in one command. `--status done --size m` is refused. The matrix says
   "never lower it to skip a step"; nothing records whether that happened. Fix: when `state set`
   lowers or clears an `l` size at `reviewing` or `verifying`, require a reason and write it as a
   `size` decision row, the way `spec-size` does. Failing that, apply `--clear size` after the
   status move, as `--size` is.
2. `src/panel.ts:34` counts any `review_<slug>_<x>.md` of 40 bytes or more. Two 42-byte filler
   files, or `_notes` and `_draft`, close an `l` item. That is the trust `fanout check` and the
   SubagentStop hook place in files. It is weaker than `r-to-test`, which resolves each cited test
   line, and weaker than the ledger checks, which need a row typed by a closing role. Fix: count a
   lens report only if it carries the `**Verdict:**` line `agents/reviewer.md:82` prescribes.
3. Items that skip intake are never sized. `skills/router/playbooks/orchestrate.md:19`, `deepen.md:38`
   and `skills/setup/SKILL.md:35` print `state add` without `--size`, and router step 3 skips intake
   for an existing item. In this store 42 of the 47 open items have no size, so they will run as
   `m`. Fix: add `--size <s|m|l>` to those three commands, plus one router sentence: an item with
   no size gets `state set --size` by the matrix rule when work starts on it.
4. `src/lint.ts:582` (`linksTo`) and `:560` also count a link or `--size` that sits inside
   `<!-- -->` or a code fence, which a reader never sees as a link. Fix: strip comments and fenced
   blocks before matching. Make `SIZE_TABLE_HEADER` (`:535`) case-insensitive.
5. `docs/wiki/Skills-and-Playbooks.md:190-197` restates each size's paragraph, and
   `docs/wiki/The-CLI.md:307-309` restates the s/m/l steps. Neither is linted, so both can drift.
   Fix: cut the Skills-and-Playbooks bullets to the link and the every-size sentence.
6. `src/lint.ts:545` guards on the `skills/router` directory. A consumer plugin with its own
   `router` skill goes from 1 failure to 9, and a bare `skills/router/` from 0 to 7. Fix: guard
   on `skills/router/SKILL.md`, as `lintRouterIntake` does, and on a manifest named `mstack`.
7. `tests/size-tiers.test.ts:14-15` uses 200-byte and 7-byte reports, so nothing pins the 40-byte
   boundary that Gates-and-Hooks.md:498 states (M2 survives). Fix: add a 39-byte and a 40-byte
   lens pair.
8. `size-matrix.md:5-6` says to raise the size when the work grows, but not what happens to the
   steps already passed. An `m` raised to `l` after design meets only the panel; nothing sends it
   back through understand or design twice. Fix: one sentence on which of the new size's steps
   the item still owes.
9. `CHANGELOG.md:22-26`: the Upgrading line does not say that a panel in round 3 or later also
   needs its `review-rN` row. The gate's fix line says it. Fix: add the clause.
10. `skills/router/playbooks/bug-fix.md:30-32` keeps "only if the fix crosses a function
    boundary", so an `m` single-site fix skips the in-session design that size-matrix.md:12 gives
    every `m`. It reads as depth (matrix) against trigger (playbook). Say so in the matrix's
    Design cell for `m`: "when the playbook's design step applies".
