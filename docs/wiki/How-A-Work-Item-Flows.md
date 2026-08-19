# How a work item flows

A work item is a row in `.mstack/state.json` with a slug, an acceptance array quoted from its
source, and a status. The status machine is defined once, in `src/lifecycle.ts`, and `mstack
lint-plugin` fails the build if a second copy of the enum appears anywhere in the repository.

## The lifecycle

Nine statuses (`src/lifecycle.ts:10-20`):

```
pending · specifying · spec_ready · in_progress · reviewing · verifying · done · blocked · cancelled
```

The legal transitions, from `TRANSITIONS` (`src/lifecycle.ts:63-73`):

| From | To |
|---|---|
| `pending` | `specifying`, `in_progress`, `cancelled` |
| `specifying` | `spec_ready`, `pending`, `cancelled` |
| `spec_ready` | `in_progress`, `specifying`, `cancelled` |
| `in_progress` | `reviewing`, `cancelled` |
| `reviewing` | `in_progress`, `verifying`, `cancelled` |
| `verifying` | `done`, `in_progress`, `cancelled` |
| `done` | nothing; done is terminal |
| `blocked` | any status except `done` and `blocked` |
| `cancelled` | `pending` |

`blocked` is reachable from any status except the two terminal ones, so it is handled in
`canTransition` rather than listed nine times. Note what the table refuses: there is no edge
from `in_progress` to `done`. Work passes through `reviewing` and `verifying` or it does not
close, and `mstack state set` rejects the skip:

```console
$ mstack state set greet-flag --status done
mstack: in_progress -> done is not a legal transition
        pass --force if you mean to skip a phase, and say why in decisions.tsv
```

`--force` exists because a state machine you cannot override is a state machine someone edits
by hand. The gate still audits the result, so a forced close with no verdict is caught on the
next run (see [Gates-and-Hooks](Gates-and-Hooks.md)).

Five statuses count as **active**: `specifying`, `spec_ready`, `in_progress`, `reviewing`,
`verifying` (`src/lifecycle.ts:25-31`). One active item per worktree is a gate rule, and it is
enforced against mstack itself: this repository's own `decisions.tsv` records a session that
built three things at once on main, got caught by its own gate ("2 items are active in this
worktree"), and reverted two items to `pending` rather than back-dating the state to claim a
discipline the session did not have.

## Direct path or spec path

Most work takes the direct path: the item's `acceptance` array is the contract, and the
implementer must not widen it. The spec path turns on when any of three things is true
(`skills/router/SKILL.md`):

- the item has `sdd: true`,
- the item carries a `decision_required` field,
- the change crosses several subsystems, or the user will step away and trust it later.

On the spec path, no code is written before `.mstack/specs/<slug>/` holds four artifacts
(`proposal.md`, `design.md`, `tasks.md`, `spec.md`) and a **different pass** has approved them.
The gate refuses to let an `sdd` item sit past `specifying` with the artifacts missing or
empty; four zero-byte files stopped counting as "complete" after a review panel produced
exactly that.

Both paths end identically: verify, then review by a pass that did not write the code, then
the merge gate. The route changes how work is planned. It never changes what counts as proof.

## decision_required is a gate, not an announcement

An item can carry `decision_required`: prose naming a product fork whose two answers produce
different work. While the item is `pending` or `specifying`, the fork is allowed to be open;
investigating it is the work. From `spec_ready` onward the CLI and the gate both refuse to move
the item until the fork is answered (`src/lifecycle.ts:49-55`, `src/cli.ts:255-265`):

```console
$ mstack state set export-json --status spec_ready
mstack: export-json has an unanswered decision: "Is this a stable public contract other tools
        may depend on, or a convenience dump we are free to change? The two answers produce
        different work: one needs a version field and a compatibility rule, the other does not."
        answer it with 'mstack decide --resolves export-json ...' first
```

Answering it means `mstack decide --resolves <slug>`: one command writes a `decisions.tsv` row
that **names the item it answers** and stamps the item with a pointer back to that row, so
neither can exist alone. The answer has to say something; a one-character decision or a result
of `open` is refused:

```console
$ mstack decide --phase spec --decision "x" --why "y" --evidence "z" --result done --resolves export-json
mstack: resolving a fork needs --decision to say something; got 1 characters, and a token is not an answer
        answer it properly or leave the fork open; a row nobody can read is the boolean this mechanism exists to avoid
```

Both halves of the link are load-bearing. Before the `resolves` column existed, any row could
close any fork, because no column said what a row was about, and a whitespace decision with the
default result of `open` passed. A reviewer demonstrated both. The refusal above is those
findings, fixed.

## The example repository, item by item

`examples/notes-cli/` ships with a seeded queue that covers the three shapes an item takes:

**Item 1, `storage-layer`, is already closed.** It exists so the store starts in a legal state:
`done`, with the ledger row that closing an item actually requires (`test-verified`, evidence
"python3 -m unittest tests.test_storage -q: 4 tests, OK"). Delete that row and the gate goes
red on its own store.

**Item 2, `cli-search`, takes the direct path.** Four acceptance bullets, no spec. The router
copies the feature playbook's steps into the todo list, delegates to `mstack:implementer`, and
a reviewer that did not write the code judges the result against each bullet individually.

**Item 3, `export-json`, takes the spec path.** It carries `sdd: true` and a real fork:

> Is this a stable public contract other tools may depend on, or a convenience dump we are
> free to change? The two answers produce different work: one needs a version field and a
> compatibility rule, the other does not.

The same `/mstack implement the next pending item` that breezed through item 2 now writes and
grills a spec, stops at the fork, and cannot pass `specifying` until someone answers it. This
is not hypothetical: an independent headless run drove this item from `pending` to `done`
through the full spec path, four artifacts, fifteen requirement ids, and the fork answered via
`mstack decide --resolves`, and mstack's own ledger records that run as `live-verified`.

The example's README also lists ways to break the gate on purpose, which is the fastest way to
see the enforcement plane work.

## How a session closes

Closing is a checklist, and the gate checks the parts that can be checked
(`skills/router/SKILL.md`):

1. `mstack gate` green.
2. The report files for every pass that ran exist and say something. A file under 40 bytes is
   a stub, not a report (`src/roles.ts:64`).
3. The session summary is **appended** to `.mstack/progress/history.md`, and `current.md` is
   reset to its empty template. The two files have opposite disciplines on purpose:
   `current.md` is overwritten and answers "if this dies now, what should the next session do
   first"; `history.md` is append-only, and a wrong entry is corrected by a later entry, never
   edited.
4. `mstack state set <ref> --status done` only after a reviewer that did not write the code
   approved, and the ledger holds a verdict at the current head SHA. The gate audits every
   closed item for exactly that, and refuses a close whose only verdict came from the
   implementer.

The reviewing itself is described in [Gates-and-Hooks](Gates-and-Hooks.md); the files this page
kept naming are described column by column in [State-Files](State-Files.md).
