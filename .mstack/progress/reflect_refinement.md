# Reflect — the refinement round driven by the dogfood protocol

The output of a retro is not a list of observations. It is a decision, per lesson, about where
that lesson now lives. This file is that decision.

Three lenses ran. **Tooling** was the dogfood session's own friction list in
`sandbox/PROTOCOL.md`. **Judgment** was that document's list of the operator's own errors.
**Divergent** was an independent pass whose brief was to argue against acting at all;
its report is `.mstack/progress/reflect_divergent.md`.

## The headline, stated plainly

**The divergent pass dropped ten of the fourteen findings, and most of them were dropped for
the same reason: the documentation already said the thing.** `--acceptance`, `--verification`,
`--sdd` and `--decision-required` are documented at `docs/wiki/The-CLI.md:67-69,86`. The
report-path convention is in every agent file. The status order is in
`docs/wiki/How-A-Work-Item-Flows.md` and `README.md:88`. The `ledger check` FAIL line the
protocol called an unlabelled trap appears verbatim at `docs/wiki/The-CLI.md:115-116`.

Two friction claims had already been withdrawn by an earlier fact-check for exactly this
reason. Ten more went the same way. That is twelve of sixteen claims about this plugin's
usability that were really claims about one operator not reading `docs/wiki/` before `src/`.

The finding worth keeping from that is not a feature. It is that **a first-time operator with
strong incentives to read the docs still did not**, and produced a confident write-up either
way. Whether the answer is an onboarding change, a discoverability change, or nothing at all,
is not something one session can tell you.

## What actually survived, and where each lesson goes

| # | Lesson | Verdict | Absorbed by |
|---|---|---|---|
| 1 | The `rm` guard matched across shell command boundaries: four false denials, two trivial bypasses. | **Accepted, shipped** | `src/hooks.ts` + `tests/hooks.test.ts`. Item 12. |
| 2 | **Nothing automatic ever runs `gate --full`.** The `Stop` hook is `runGate(store, {quiet:true})` (`src/hooks.ts:172`), which never touches `state.verify` or `item.verification`. | **Accepted** | A check, not prose. This is the real cause of the 230-minute red gate. |
| 3 | **`state set` is write-once on every field but `status` and `closed_by`** (`src/cli.ts:242`), so `decision_required` cannot be attached at the moment `skills/spec/SKILL.md:33-38` says forks are discovered. | **Accepted** | `src/cli.ts` + `tests/cli.test.ts`. |
| 4 | **The reviewer is never told to write the ledger row.** `agents/implementer.md:45` is the only agent file that instructs `ledger record`, and it hardcodes `--verifier implementer`. `agents/reviewer.md:30` says `ledger check` only. | **Accepted, needs the human** | `agents/reviewer.md`, and possibly the gate. Touches an agent contract. |
| 5 | Rung 4 says "you ran it" without saying **what you ran it on**. A probe of a 264-byte script was cited as rung 4 for a project whose module graph is 25 kB. | **Accepted, needs the human** | One clause in `skills/router/references/evidence-ladder.md`. |
| 6 | For a closed item the gate filters ledger rows by target only, never by SHA (`src/gate.ts:311`). The careful record-then-fast-forward dance the session performed is not a property the gate checks. | **Backlog** | Deliberate per the comment at `:303-306`. But the docs should stop implying otherwise. |
| 7 | **Nothing anywhere signals that a spec is too large.** R1–R64 and 116 scenarios for a static weather page, through six adversarial passes whose instructions are entirely about finding more. | **Backlog** | Would be a calibration change to the `sdd` trigger, not a stopping rule for reviews. |
| 8 | Four CLI surfaces were never exercised: worktrees, review panels, `blocked`/`cancelled`, a two-item queue, a resume after a dead context. The protocol claims "todas las fases". | **Backlog** | A second session shaped to hit them. |
| 9 | `--description` is the one `state add` flag documented nowhere. | **Backlog** | One line in `docs/wiki/The-CLI.md`. |
| 10 | `fanout check` warns that a canonical report "was not in the plan; nothing will read it", which `src/roles.ts:53` disproves. | **Backlog** | One string. |

## Rejected, with the reason

- **F1** (no per-subcommand `--help`) — premise false; four of five flags are in the wiki.
- **F3** (report-path contract only in code) — false; it is in every agent file.
- **F4** (fanout doubles the slug) — used as documented the tool emits the convention. Operator error.
- **F5 / O5** (no rule for when to stop reviewing) — one finding wearing two hats, and a written
  stopping rule is the pstack escape hatch `README.md:32-34` exists to reject.
- **F7** (`merge-gate` needs a PR) — generalised from a constraint the exercise imposed on
  itself. Four of merge-gate's five inputs cannot exist without a remote; the fifth already
  ships as `ledger check`.
- **F8** (playbook vs lifecycle order) — the order is documented in two places; the playbook
  never names a status. Conflating its prose verbs with lifecycle statuses was the error.
- **F9** (abbreviated SHA fails `ledger check`) — documented three times. On a team that rebases,
  the strict key is the feature; softening the message optimises for the case where nothing
  rewrites history.
- **O1** (`mstack brief` generator) — `skills/router/SKILL.md:67-72` already specifies the
  skeleton and the report path.
- **O2** (nothing pushes to rung 5) — `skills/verify/SKILL.md:11-12`, `principles.md:58-59` and
  `evidence-ladder.md:3,12` all do.
- **O3** (recording decisions is expensive) — premise wrong twice at rung 5: 30 rows, not ten,
  and zero of them needed `--resolves`.
- **O6** (proof exists but is unfindable) — the same item as 2 and 3 above, wearing a third hat.

## The one a retro on this plugin should be most uncomfortable with

Across the whole session the plugin issued three refusals. One illegal transition, one guard
false positive, and one `ledger record` missing `--evidence`. **Two of the three were wrong,
and the third was a usage error. Not one gate refused a substantive claim.**

Everything that mattered — the ARIA failures read out of axe-core, the predicate that could not
fail, the undefended guard line, the falsified toolchain probe, the two Lighthouse audits a
correct page fails by default — was caught by **an agent reading something**, never by a check.

`README.md:35-36` is the claim that tests: *"Anything that must hold whether or not the model
remembers it lives in a hook or in a gate that is code."* On this session's evidence the prose
caught everything and the code caught nothing that mattered. Whether that is because the gates
cover the right things and nothing violated them, or because they cover the cheap things, is
the question the next session should be designed to answer.

Items 2, 3 and 4 above are the three places where a check could have caught something real and
did not. They are accepted for that reason and not because they were the loudest.

## The strongest argument against this whole round

One operator, one greenfield static page, no team, no CI, no remote, one item in the queue.
Run the same protocol on a brownfield repo with a PR flow and F7 inverts, F9 inverts, F5
shrinks, F1 and F8 vanish, and F10 vanishes in any repo with CI because
`skills/setup/SKILL.md:27-29` fills `state.verify` from `.github/workflows/`.

**Only item 1 is shape-independent**, which is exactly why it is the only one shipped without
further discussion. Items 2, 3 and 4 survive the argument because they are properties of the
plugin's own contracts rather than of the work it was pointed at — but a second session on a
different shape of repository would cost a fraction of this one and would be the honest way to
decide the rest.
