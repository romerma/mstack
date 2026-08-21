# State files

Everything durable lives in `.mstack/`, in the repository, under version control. Chat is not
state: a context window dies mid-task, a subagent's working context vanishes with it and its
parent only ever sees the final reply, and a resumed session starts from what is on disk.
The store is small enough to read in one sitting, and that is deliberate.

```
.mstack/
├── state.json      work items and the lifecycle the gate enforces
├── ledger.tsv      target · sha · verdict · evidence · verifier · ts
├── decisions.tsv   ts · phase · decision · why · evidence · result · resolves
├── progress/       current.md (live) · history.md (append-only) · <kind>_<slug>.md
└── specs/<slug>/   proposal · design · tasks · spec
```

## state.json

The schema lives in one place, `src/state.ts`, and the gate checks the shape, not just that
the file parses. Top level: `version`, `project`, an optional `verify` command (what `mstack
gate --full` runs), the three `rules` booleans (`one_active_item`,
`require_verdict_to_close`, `require_spec_for_sdd_items`), and `items`.

An item's fields (`src/state.ts:6-33`):

| Field | What it is |
|---|---|
| `id` | Numeric, unique. `state set` accepts it as a ref |
| `slug` | Kebab-case, unique. Names the spec directory, the branch, and the progress files |
| `title` | One line |
| `description` | Optional context for the next reader |
| `acceptance` | Array, **quoted from the source, never paraphrased**. The gate rejects an empty list, because a paraphrase is where scope quietly changes |
| `status` | One of the nine lifecycle statuses; see [How-A-Work-Item-Flows](How-A-Work-Item-Flows.md) |
| `sdd` | Optional. `true` opts into the spec path |
| `decision_required` | Optional. Prose naming an unresolved product fork; its presence triggers the human gate and, past `specifying`, blocks the item |
| `decision_resolved` | The `ts` of the `decisions.tsv` row that answered the fork. A pointer, not a copy: the row carries the reasoning, and duplicating it here would give it somewhere to drift to. Written only by `mstack decide --resolves`, which writes the row and the pointer in one step so neither can exist alone. Dropped when `state set` rewrites or clears the `decision_required` it answered, because the row named that question and would otherwise answer the next one too |
| `source` | Where the work came from: an issue reference, or "direct request" |
| `verification` | The exact command that proves this item works |
| `closed_by` | A note for the next reader. **Not a verdict**: the gate does not accept it in place of a ledger row, a lesson recorded in the changelog |

## ledger.tsv

The verification ledger, one row per verdict:

```
target	sha	verdict	evidence	verifier	ts
```

The key is `(target, sha)`. A verdict is a claim about one target **at one commit**, and a new
head SHA voids the row; that is not housekeeping pedantry but the mechanism that catches a
rebase silently invalidating every verdict above it without touching a single check. `mstack
ledger check <target>` evaluates against the current head by default:

```console
$ mstack ledger check greet-flag
FAIL no verdict at 542ac0cf; 2 row(s) exist at other SHAs and a new head SHA voids them
```

The write path validates what used to be trusted: the SHA must name a commit that exists in
the repository (forty zeros used to record fine), the evidence must be at least a phrase, and
the verdict must be one of the five in the enum. The `verifier` column is read by the gate:
an item cannot close on rows written only by `implementer` or `spec-author`
(`src/roles.ts:101-106`). The column is free text, so this is a floor, not a proof; it stops
the default path, which is the one everybody takes.

### The verdict enum and the evidence ladder

The ladder, from `skills/router/references/evidence-ladder.md`: for every fact the safety of a
change depends on, get it as far down this list as is cheap, and **say where it stopped**.

| Rung | What it means | Verdict it maps to |
|---|---|---|
| 1 | You said so. Worthless on its own | — |
| 2 | You pointed at the line: a real `file:line` | `type-check-only` |
| 3 | You walked the failure step by step and it does not reach | `type-check-only` |
| 4 | You ran it: a test that calls the real code and fails loudly if you are wrong | `test-verified` |
| 5 | You reproduced it in the running system | `live-verified` |
| — | Could not run the check at all | `verifier-blocked` |
| — | Ran it and it failed | `verifier-failed` |

Two rules travel with the ledger: CI green is an *input* to a verdict, never a verdict on its
own; and anything you cannot get to rung 4 you say out loud rather than writing up as settled.

## decisions.tsv

One row per decision, append-only:

```
ts	phase	decision	why	evidence	result	resolves
```

TSV because GitHub renders it as a sortable table and a row appends with one command. One row
is one decision; if it does not fit on one line, the decision is not crisp yet. A wrong call
gets a new row that supersedes it, never an edit. The `resolves` column is empty for ordinary
decisions and names an item's slug when the row answers that item's `decision_required` fork;
the gate matches the pair `(ts, resolves)` against the item's `decision_resolved` pointer, so
a row has to say which fork it answers, or no fork is considered answered.

## progress/

Two files with opposite disciplines, plus one report per pass:

- **`current.md` is live and overwritten.** It tracks the active item, the plan, a running
  log, and closes with the only section that matters when things go wrong: "if this session
  dies right now, the first thing the next one should do". The gate checks that it says
  something while an item is active, not merely that it exists; an untouched template fails.
- **`history.md` is append-only and never edited.** One summary per closed session. If an
  earlier entry turned out to be wrong, a later entry says so. The record of what you believed
  at the time is part of what makes a retro possible.
- **`<kind>_<slug>.md` is a pass's report**: `impl_`, `review_`, `spec_`, `spec_review_`,
  `explore_`, `design_`. A panel writes one file per lens (`review_<slug>_<lens>.md`) because
  parallel reviewers sharing one filename overwrite each other silently. The `SubagentStop`
  hook and `mstack fanout check` both hold workers to these paths, with a 40-byte floor
  (`src/roles.ts:64`) so an empty stub does not count. The rule they enforce has a history:
  a review subagent once returned a confident summary having written nothing, and a reply is
  not evidence.

## specs/<slug>/

Present only for items on the spec path. Four artifacts, all required before the item leaves
`specifying`: `proposal.md`, `design.md`, `tasks.md`, `spec.md` (`src/gate.ts:36`).
Requirements carry stable ids (`R1`, `R2`, ...) in EARS form, every task names the
requirements it covers, and the implementation report maps each requirement to the test that
proves it. The chain is greppable end to end: requirement to task to test to review.

## Reading the store

The store is data, so the ordinary tools work: `column -s$'\t' -t < .mstack/ledger.tsv` for
the ledger, `git log -p .mstack/state.json` for how an item got here, and GitHub renders both
TSVs as tables. The point of files over chat is exactly that nothing about them is special.
