# State files

mstack's memory is a handful of small files in your repository, and this page reads
through them one by one. Come here when you want to know what a column means, which file to
trust after a crash, or where a verdict or a decision actually lands. Nothing in `.mstack/`
is opaque: every file is plain text.

Everything durable lives in `.mstack/`, in the repository, under version control. Chat is not
state: a context window dies mid-task, a subagent's working context vanishes with it and its
parent only ever sees the final reply, and a resumed session starts from what is on disk.
The store is small enough to read in one sitting, and that is deliberate.

```
.mstack/
├── state.json        work items and the lifecycle the gate enforces
├── ledger.tsv        target · sha · verdict · evidence · verifier · ts
├── decisions.tsv     ts · phase · decision · why · evidence · result · resolves
├── costs.tsv         ts · run · target · role · agent_id · model · input · cache_write · cache_read · output · messages · cost_usd · source
├── verification.tsv  target · sha · command · outcome · ts   (machine-local, gitignored)
├── .gitattributes    merge=union for costs.tsv, ledger.tsv and decisions.tsv
├── .gitignore        one line, and the reason it is there
├── progress/         current.md (live) · history.md (append-only) · <kind>_<slug>.md
└── specs/<slug>/     proposal · design · tasks · spec
```

Two files outside the store belong to the same practice. `GLOSSARY.md` at the repository root
defines the project's terms, one or two sentences each, and `mstack gate` checks its entry
format when the file exists. `docs/adr/` holds one numbered file per decision that was hard to
reverse, surprising without context and a real trade-off; every other decision is a row in
`decisions.tsv`. Neither is required, and both are written as part of the item that introduced
them, so the reviewer reads them in the diff.

Everything there is committed except `verification.tsv`, which is the one file whose whole
claim is about *this* checkout. See [below](#verificationtsv).

## state.json

The schema lives in one place, `src/state.ts`, and the gate checks the shape, not just that
the file parses. Top level: `version`, `project`, an optional `verify` command (what `mstack
gate --full` runs), the four `rules` booleans (`one_active_item`,
`require_verdict_to_close`, `require_spec_for_sdd_items`, `record_costs`), and `items`.
`record_costs` is the only one that is an error rather than a default when it is not a boolean,
because a `"false"` string read as "on" would keep recording for someone who asked it off.

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
| `verification` | The exact command that proves this item works. From `verifying` on, the gate requires that it has actually been executed at the current commit; see [verification.tsv](#verificationtsv) |
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

## verification.tsv

One row per verification command `mstack gate --full` actually executed:

```
target	sha	command	outcome	ts	tree
```

A ledger row is a *verdict* by a pass that looked at the work; a row here is a *fact* about one
command exiting, and the two are kept apart on purpose. Writing these into `ledger.tsv` would
hand them a `verifier` column the gate accepts, so running `gate --full` would close the item
it was meant to prove — the self-closing shape `require_verdict_to_close` exists to refuse.

`target` is the item's slug, or `(project)` for the `verify` command from `state.json`; a slug
is kebab-case, so the parentheses cannot collide with one.

`tree` is `clean` when nothing outside `.mstack/` was uncommitted, `unknown` when git could not
be asked, and otherwise a hash of the **contents** of everything uncommitted — `git diff HEAD`
for tracked paths, plus a content hash per untracked file. Contents and not the list of dirty
paths, and the difference is a defect this shipped once: hashing `git status --porcelain` keys
on *which* files are dirty, so if the tree was already dirty when the run happened, a further
edit inside those same paths moved nothing and the gate called a red verification green. So an
edit to code after a green run voids the run exactly as an edit to the command does, while
writing your own progress notes does not.

An untracked **symlink** contributes its target string, which is what git itself stores for one,
and is never read through. That is not a detail: `git hash-object` follows links, and following
them meant a link to a directory or a dangling link could not be hashed at all, which switched
the whole tree half off and let an item close green on a failing verification.

Two costs worth knowing, both measured. Untracked files are re-read on every fast gate while an
item sits at `verifying`, so a large untracked artifact — a 500 MB build output that is not yet
in `.gitignore` — costs about 0.7s a turn until you ignore it, which is what you would do
anyway. And ignored files are in neither half of the fingerprint, deliberately: build output is
not the project. On this repository the whole fast gate is 0.06-0.08s.

The fast gate reads these back and, from `verifying` on, refuses to call an item green on a
command that never ran here; the rules and the reasoning are in
[Gates-and-Hooks](Gates-and-Hooks.md#verification-that-actually-ran).

**This is the one file in the store that is not committed**, and `mstack setup` writes a
`.mstack/.gitignore` saying so. A receipt is keyed to HEAD, so committing one moves HEAD and
voids the receipt being committed; and a receipt from another checkout would let one worktree's
run stand in for a run nobody in this one ever did, when "somebody here actually executed it"
is the entire claim being made.

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
Requirements carry stable ids (`R1`, `R2`, ...) in EARS form (Easy Approach to Requirements
Syntax), every task names the
requirements it covers, and the implementation report maps each requirement to the test that
proves it. The chain is greppable end to end: requirement to task to test to review.

## costs.tsv

Tokens per run, role and model, one row per model per key:

```
ts	run	target	role	agent_id	model	input	cache_write	cache_read	output	messages	cost_usd	source
```

- `(none)` is the sentinel for "no item" (`target`), "no agent" (`agent_id`) and "no figure"
  (`messages`, `cost_usd`). It is never `-`, because `cell()` in `src/tsv.ts` rewrites a leading
  `-` to `'-` as a formula guard. No cell is ever negative.
- `run` is `<session>@<byte offset>`: the stretch of one session's transcript that one mark
  opened. `role` is `main`, a subagent's role read from its `meta.json` (`mstack:reviewer`
  becomes `reviewer`), or `unattributed`. `source` is `transcript` or `cost-state`.
- `cost_usd` is filled only on `source=cost-state` rows, and holds the model's whole real cost
  for the session, minus what earlier rows already carried. There is no price table here.

**How rows get there.** Nothing parses a transcript on a hot path. Two kinds of record make
that possible:

- A **mark** says "from this byte offset of this transcript, usage belongs to this item". Marks
  are machine-local: they live in `costs-marks.jsonl` under `git rev-parse --git-path mstack/`
  (per worktree, inside `.git`), never in `.mstack/`, because an offset into a file on one
  machine means nothing on another. `SessionStart` writes one at the transcript's current size, or at offset 0 when the file
  does not exist yet, which it does not in a fresh session (everything later written to it
  belongs to this one). `SessionEnd` marks a session that has no mark at all, from offset 0, so
  one that ended before any `Stop` (`--max-turns 1`) is still recorded.
  `Stop` writes one only when the active item changed; the unchanged case is the marks file, a
  parse of `state.json` and a compare, and the transcript is not opened.
- A **flush** reads the transcript from the mark's offset by streaming (never the whole file),
  counts usage once per `message.id` (the API response's usage repeats on each content block),
  skips sidechain lines, scans the session's `subagents/` directory, and appends only
  `total - flushed so far` per key, where "flushed so far" is kept in the same machine-local
  marks file and **never read back from `costs.tsv`**. Flushing twice changes nothing. It runs at `SessionEnd`,
  at the next `SessionStart` for a session that never reached one (a crash), and inside
  `mstack cost`.

**Reconciliation.** When the transcript carries a `cost-state` line, an `unattributed` row per
model holds the difference between that and the transcript sum. It is the honest place for the
calls a transcript never records and for compactions.

**What was measured before this was built** (real `claude -p --model haiku` sessions on this
machine): the `cost-state` line is already on disk when the `SessionEnd` hook runs; its
`modelUsage` includes subagent usage (main plus subagent transcript sums matched it to the
token); `--resume` appends to the same file and session id and `cost-state` is cumulative,
so the last line is the whole session; `/compact` writes no usage to any transcript, only to
`cost-state`. The first was also observed for interactive `/exit`, Ctrl-C and a closed terminal (review of
this item); a SIGKILL runs no `SessionEnd` at all and is what the next `SessionStart` settles.

**Budget.** On a 50 MB synthetic transcript the `SessionEnd` flush took 29 ms on a realistic mix (tool
results dominate the bytes, 11,400 assistant turns) and 82 ms on 74,500 assistant turns, every
one of them parsed (bun; node measured 33 and 109 ms), an unchanged re-flush 0.2 ms,
and the cost part of `Stop` 0.11 ms. All cost work in a hook is wrapped so that a throw is
swallowed: the cost of a failure is a missing row, which the next flush recomputes, and it
never changes what another hook says.

`.gitattributes` gives the three append-only tables `merge=union`. Two branches that both
append to one of them conflict on the last line under git's default merge though nothing is in
dispute, and the union keeps both sides' lines. For the ledger and the decisions that is
enough. For `costs.tsv` it is only right because a row is a *delta*, and a delta is correct
across a union only if it was never computed against a copy of the table missing some of the
rows: flushing a session on `feat/a`, switching to `main` (which lacks those rows) and
flushing the same session there would write its whole total a second time, and the merge would
keep both. That is why the flushed totals are machine-local state and not a read of the file; a
test runs exactly that scenario and the merged table equals the session's real usage and cost.
Run `mstack setup` once on an older store to get the file.

**Per-item `cost_usd`.** A session's cost goes to the one real item that carried usage, to
`(none)` when none did, and to a `target=(multi-item)` row when two or more did; never split by
token share. The decision comes from the stretches that carry usage, not from the marks, so a
trailing `(none)` mark left by closing the item, or a leading one before it was picked, does
not make a session multi-item. Tokens stay per stretch. See [The-CLI](The-CLI.md#cost).

The marks file keeps a session's flushed totals for as long as its transcript exists, however
old; they are dropped only once the transcript is gone, plus a day. Dropping them earlier
re-emitted the whole session on a `--resume` after two weeks.

**Known limits.** A subagent panel: `SubagentStop` passes a lens that wrote nothing once a
sibling's report is newer than its start (`mstack fanout check` is the guard that names the
lens); a subagent resumed later keeps its first timestamp. The Stop hook's `stat` can land one
message before the turn's last line, so an item boundary can wobble by one message. A crash
between appending the rows and recording the flushed totals writes that delta twice. The
marks lock is taken before the rows, and both writes happen inside it with nothing that can wait
between them, so what is left is two adjacent writes; a hook killed while it waits for a lock
writes nothing.

## Reading the store

The store is data, so the ordinary tools work: `column -s$'\t' -t < .mstack/ledger.tsv` for
the ledger, `git log -p .mstack/state.json` for how an item got here, and GitHub renders both
TSVs as tables. The point of files over chat is exactly that nothing about them is special.
