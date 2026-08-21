# Session history (append-only)

> One entry per closed session, appended at the end. Never edit an earlier
> entry. If it turned out to be wrong, say so in a later one.

## 2026-08-19 — item 9, readme-and-wiki

- Found at open: this file had no entries while state.json showed items 1–8 closed, and
  `current.md` still described item 5 as in_progress. The sessions that closed items 1
  through 8 ended without appending here; their real record is in the ledger, decisions.tsv
  and the review reports. Recorded rather than back-filled: entries written after the fact
  would claim a discipline those sessions did not have.
- Item 9 ran the feature playbook on branch docs/readme-and-wiki: README rewritten as an
  on-ramp with the credit to Lauren Tan (poteto) on the first screen, eleven wiki pages under
  docs/wiki/ as the GitHub wiki's in-repo source with a verified publish route, a CHANGELOG
  Unreleased section, and scripts/check-doc-links.mjs so the item's verification field runs
  as recorded.
- Implementation was delegated. The review panel — facts lens and cold-reader lens on
  different models — returned 25 findings, every one fixed; a facts follow-up re-verified
  24 of 25 by re-running the commands and re-fetching the cited pages, and specified the two
  residual one-word fixes, applied by the orchestrator per the decision row.
- Ship: merge-gate skip: no remote exists before publication, so a PR is impossible; local
  fast-forward of docs/readme-and-wiki into main instead.
- Follow-up candidates recorded, not acted on: the "reply body" phrasing in agents/*.md and
  the research doc contradicts the sub-agents docs (the panel fixed it in the wiki only);
  README and Gates-and-Hooks say the shape-check defect "shipped" while The-Story pins it to
  two issue numbers — three pages, two characterisations of one defect; four prose lines sit
  past the ~100-column convention after the fix round's reflow.

## 2026-08-20 — item 10, panel-followup-prose

- The two follow-ups item 9 recorded, closed as their own item on the bug-fix playbook's
  shape: the reply-body claim now matches the sub-agents docs everywhere it appears as a live
  claim (five agent contracts, the router, a src/hooks.ts comment, the hooks.json description,
  a test comment), and README, Gates-and-Hooks and The-Story share one characterisation of the
  shape-check defect, with the decision row recording why the shipped half stands.
- The orchestrator implemented (eight prose lines; delegation skipped with the reason in the
  plan) and an independent reviewer judged the diff: round 1 CHANGES_REQUESTED after its
  repo-wide sweep caught two live sites the item's own sweep had missed, round 2 APPROVED at
  3a38bab. The record files (CHANGELOG, research doc, history, item-9 reports) keep the old
  wording deliberately: they are records of the finding, not claims.
- Ship: merge-gate skip: no remote exists before publication; local fast-forward into main.

## 2026-08-21 — item 11 sandbox-weather-dogfood, closed

Ran mstack end to end against real work, in a gitignored nested repository, to find out how
easy it actually is. The deliverable is `sandbox/PROTOCOL.md`: a command-by-command record
of every phase, with the friction found. The app that carried the exercise is an
Apple-Weather-style web client on Open-Meteo — Astro static, zero runtime dependencies, 248
unit tests, 140 browser drills, Lighthouse 100 in all five categories across four runs.

**What the exercise found in this plugin.** Eight friction points survived fact-checking:
no per-subcommand `--help` (F1); a brief can name a report path the contract rejects and
nothing catches it (F3, reduced to operator error); `fanout plan` doubles the slug and
`fanout check` then calls the canonical report unplanned (F4); nothing says when to stop
reviewing (F5); `--verification` is settable at intake, never correctable by CLI, and never
validated as executable (F6); `merge-gate` requires a GitHub PR so a local repo cannot use
it (F7); the feature playbook orders verify→review while `lifecycle.ts:68` requires
reviewing→verifying→done (F8); a bare `ledger check` reads FAIL after a correct close, and
only the full 40-char SHA passes (F9); and `gate --full` stops covering an item the moment
it closes, warns that it checked nothing, and exits 0 (F10).

One real defect is queued as **item 12 rm-guard-command-boundary**: the shipped `rm` guard's
pattern crosses `&&`, `;` and `|`, so four reproduced false positives deny legitimate work
while two trivial indirections walk past it. The fact-check pass hit it unplanned.

**What it found in me.** Nine errors by the orchestrating pass, every one caught by another
pass or by re-verification: a false claim about an API field, a defect report that was an
artifact of a mistyped `rg` flag, an over-general conclusion from a minimal probe, a
misattributed exit code, a non-executable `verification` field that left the gate red for
four hours, stale figures quoted in the file that was those figures' evidence, a byte
measurement taken with the wrong compressor, a superseded test count, and an undercount of
this very list. Two of the nine friction claims first written up were also mine rather than
the plugin's, and were withdrawn after fact-checking.

That last part is the finding worth acting on. A single-pass workflow would have shipped a
refinement round built on two defects that do not exist.

**Honest remainder.** The agent timings and token counts in PROTOCOL.md come from task
notifications and are not verifiable from either repository; the document says so. Six
minors on the app itself are unfixed and listed in `sandbox/.mstack/progress/review_weather-app_r2.md`.

## 2026-08-21 — item 12 rm-guard-command-boundary, closed

Found by the dogfood session in `sandbox/PROTOCOL.md`: the `PreToolUse` guard matched its
patterns against the whole command line, so `[^\n]*` crossed `&&`, `;` and `|`. Four false
denials reproduced, and two trivial bypasses. The harm was never the inconvenience — whoever
hits a false positive learns to route around the guard, which is the behaviour it exists to
prevent.

**Shipped wider than filed, deliberately.** The fix segments the command and applies the
match per segment at one call site, so all six guards get it, not only `rm`. The item's title
and its four acceptance criteria still say `rm`; the shipped behaviour is wider, and the
reviewer's closing answer is that the widening was right on evidence it did not have when it
first raised the scope question: over a 736-spelling corpus the widening closes **three real
bypasses `main` shipped with** (`git push origin main -f` followed immediately by `;`, `|` or
`&`, where the lookahead failed against an unsegmented line), and it removed four sibling
false positives of the same kind the item was filed about. Recorded as a decision row rather
than slipped in.

**Two rounds, and round 1 was wrong in the dangerous direction.** The first fix introduced a
real false allow: a separator inside `$(...)` or backticks split one shell command in half,
the verb landed in one fragment and its argument in the other, and **30 of 30 spellings
regressed from DENY to allow across all five guards**. The reviewer proved it at rung 5 by
letting the allowed command delete a real store directory. Two of the spellings were everyday
idioms, not contrivances. Round 2 closed it with substitution-depth tracking.

The orchestrating pass's own check missed that entirely — 9/9 green on cases that never
included command substitution. It tested the hypothesis, not the change. That is the reason
this item took two rounds and it is worth remembering: the direction to attack a guard fix is
false *allows*, and the pass that wrote the brief is the one least likely to think of them.

**Closed on:** 528-spelling differential across both shipped binaries with zero false allows
introduced; 50 further adversarial cases against the new depth tracking, five of which looked
like regressions and were each run through real bash before being dismissed — none was a real
deletion or force push, and one was `main` over-denying a file literally named with a
backtick. Seven per-construct mutations each killed by a named test. 176 tests on both
runtimes, typecheck and lint clean.

**One process note kept on the record.** The implementer's first mutation driver restored with
`git checkout`, which discarded the uncommitted fix and made six of seven mutations run
against unmodified code. It caught that itself, re-ran after committing, and reported it. A
mutation suite that silently tests nothing is the fourth instance of the same shape this
programme has caught: a spec predicate that could not fail, a drill disjunct that was always
false, an accessibility audit that cannot fail over gradients, and now this.

## 2026-08-21 — item 13 editable-item-fields, closed

`mstack state set` accepted only `--status`, `--closed-by` and `--force`, so every other item
field was write-once at intake. The serious consequence was not ergonomic: `README.md:116-129`
leads with `decision_required` as the plugin's human gate and shows it stopping a status move,
while `skills/spec/SKILL.md:33-38` says product forks are found during `specifying` — after
intake. **The README's own narrative was unexecutable.** The dogfood run proved it: two textbook
product forks arrived, both were answered with plain `mstack decide` rows, and
`sandbox/.mstack/decisions.tsv` carries 30 rows with zero `resolves` values. The gate never had
an opinion because the field was unreachable, and two rounds of fact-check did not notice.

**Closed on:** the README's narrative driven end to end in a scratch store — intake with no
fork, attach it during `specifying`, the gate refusing `spec_ready` with the message the README
prints, `mstack decide --resolves` answering it, the move succeeding, and the item carrying a
pointer back to the row. 196 tests on both runtimes; typecheck and lint clean; sixteen `R2-*`
mutations each killed by a named test; the six formerly stale doc transcripts and two formerly
elided commands reproduce byte for byte against the shipped binary.

**Four design decisions were the implementer's to make and are recorded**, one of them
superseded during review: clearing is `--clear <field>` and an empty string is refused;
attaching a fork at or past `spec_ready` is refused unless `--force`; rewriting a fork's prose
drops its `decision_resolved` pointer, because the answer names the question; and `state set`
takes `--title` but refuses `--slug`.

**Two rounds. Round 1's own change line was the bug.** The implementer added a per-field change
line precisely so that "a write nobody sees is indistinguishable from a no-op" — its docstring
says so — and then truncated it at 48 characters, so two different forks sharing a prefix
printed identically **while the command silently dropped the answer to one of them**. A trailing
space did the same, because `required()` validated with `.trim()` and stored untrimmed. The
function's own stated purpose, defeated on the one field where it mattered most.

Round 2's fix on `--sdd` is worth keeping as a pattern: asked for a line announcing the gate
failure the command had just created, the implementer made it **read the disk first** so it
names a failure only when it made one, on the grounds that a line claiming a failure that did
not happen is the confidently wrong output the gate exists to catch. Both branches asserted.

**Turned up and filed separately:** item 16, `gate --quiet` prints nothing on failure while the
wiki says it prints failures only — and it is the mode `src/hooks.ts:172` wires to the Stop
hook, so a red gate at session close is silent by construction. Reproduced independently by
three passes.

**Left open, non-blocking:** `detail()`'s escaping is untested — replacing `JSON.stringify(value)`
with a bare template leaves all 196 tests green, and in the tab-versus-space case the escaping is
the only thing distinguishing two values whose character counts match. One extra case closes it.

**And one on the orchestrating pass.** Its first check of the trailing-space case reported the
fork had been re-opened. That was false: its own `mstack decide` had failed silently, so
`decision_resolved` never existed and it was measuring the absence of a value nobody deleted.
Caught by asking whether the test measured anything. Fifth instance in this programme of a check
that could not fail, and the first one caught in flight rather than by a later pass.

## 2026-08-21 — item 16 quiet-gate-prints-nothing, closed

`docs/wiki/The-CLI.md:60` said "`--quiet` prints failures only". It printed nothing: empty on
both streams, exit 1, against a store with two real failures. The fix lives in `Report#fail` —
under `quiet` it writes one `[fail]` line per failure to **stderr**, and nothing else. stderr
because `mstack hook stop` writes its `additionalContext` JSON to stdout, and failure text in
front of that object would stop it parsing.

**The filing pass overstated the finding, and the record says so.** The original description
claimed a red gate at session close was "silent by construction, and the exit code is the only
signal anyone gets." False: `main`'s `stop()` already composed the failures into
`additionalContext`, so the model always received them. What nobody received was human-visible
output on a stream. The correction was made with `state set --description` — the first real use
of what item 13 shipped, an hour after it merged — and the same false framing then had to be
chased out of four more places, one of which the review missed and the implementer found: an
assertion message in `tests/cli.test.ts`.

**The load-bearing claim went from rung 2 to rung 5, through three passes each refusing to
stop where the last one did.** The implementer marked "Claude Code renders a hook's stderr" as
rung 2 and said so. The reviewer would not let the docs state it flatly, and got to rung 3 by
reading the shipped client (2.1.238): on the exit-0 branch the rendered content derives from
stdout, with stderr a sibling field. The implementer then reproduced that read independently,
hit the same credit refusal on a Stop turn the reviewer had hit, and instead of stopping
re-ran the canary on `SessionStart` — the same shared exit-0 branch — producing a real
`hook_response` with stdout parsed, `additionalContext` honoured, and stderr captured verbatim
beside it.

So the stream split is confirmed as the arrangement the client expects. **Display remains
unverified and the docs now say exactly that.** The report separates three audiences rather
than one: the CLI user, newly reached; the model, reached all along, so this fix adds nothing
there; and a session watcher, captured but display unproven. Its own sentence: "I did not write
the version that sounds better."

**Turned up and filed:** item 17, `which mstack` resolves to the installed 0.1.0 plugin rather
than the checkout, so a contributor validates changes against the old CLI. The loud failure is
benign (an unknown flag); the dangerous one is an old gate reporting green against a new store.

**Left for item 14:** `--quiet` does not leave stdout free under `--full`, because
`src/gate.ts` runs the verify command with `stdio: "inherit"`. Both wiki pages are now scoped
to the fast gate, the decision row promising byte-identical hook JSON was superseded rather
than left standing, and a characterization test pins the boundary so item 14 cannot land on a
guarantee that stopped holding.

**Closed on:** 203 tests on both runtimes; typecheck, lint and doc links clean; four cases
verified by the coordinating pass with streams captured separately; 4/4 round-2 mutations
killed with a green baseline confirmed first, byte copies restored to pristine sha256.

## 2026-08-21 — item 14 verification-never-runs, closed

The Stop hook ran the fast gate, which never touched `state.verify` or `item.verification`.
Only a human typing `gate --full` executed them. `CLAUDE.md` and `skills/setup/SKILL.md` both
say the gate must be green before a session closes; for the verification half of that sentence
nothing enforced it, and in a real session an item's verification was a non-executable string
that stayed red for 230 minutes across four agent passes. `sh -n` accepts that string, so
validation would not have caught it. Only running it does.

**What shipped: a verification receipt.** `verification.tsv`, machine-local and gitignored,
recording that a command ran, at which commit, against which working tree, and with what
result. The fast gate demands a fresh receipt only from `verifying`; `state set --status done`
demands one at the closing SHA. A receipt is keyed to the exact command text, so changing the
command voids it — which is precisely the incident that started this.

**Four review rounds, and every one found something real.**

1. The new check **failed open**: an unreadable `verification.tsv` threw through a hook handler
   that catches everything and returns 0, producing empty output and exit 0 — byte-identical to
   a green gate. The guarded sibling twenty lines above already wraps that read, and its comment
   names exactly this bug. **The seventh instance of this defect class in this programme, and
   the first created by the fix for the sixth.**
2. The receipt certified a **commit, not a tree**: an uncommitted edit after a green run was
   invisible. Offered three answers including "document the limitation"; the implementer took
   the strongest and keyed the receipt to the tree.
3. The tree fingerprint hashed the **paths** of dirty files rather than their contents, so
   editing an already-modified file did not move it. Round 1's transcript reproduced verbatim
   with one extra precondition. Fixed by hashing contents, chosen over `git write-tree` on a
   measurement — 92 ms against 638 ms — rather than on an argument.
4. `git hash-object --stdin-paths` **follows symlinks**, which is not git's model; git records a
   symlink as its target string. An untracked symlink to a directory switched the tree half off
   entirely, restoring the false green, and one to `/dev/zero` cost 10.6 s per fast gate. Fixed
   by keying symlinks to their target string, closing all four failure rows at once.

**Cost, which is criterion 3 and the thing that decides whether anyone leaves the hook on:**
the fast gate is 0.07 s in this repository and the `verifying` gate 77 ms — *lower* than before
round 4, because fixing the symlinks also surfaced two more instances of the same class the
implementer found against itself: a nested store had its tree half off unconditionally, and
`treeId` was being computed twice per gate.

**Closed on:** 258 tests on both runtimes, typecheck and lint clean, the four symlink rows and
the tree-drift and fail-open cases verified by the coordinating pass through the shipped
binary, and mutation runs with a green baseline confirmed on both sides.

The lesson worth carrying: this item spent four rounds because each fix for a "reports green
when it should not" defect introduced a narrower version of the same thing. A pass hunting a
pattern is entirely capable of reintroducing it twenty lines below the comment describing it.

## Item 15 reviewer-writes-the-verdict, 2026-08-21

Three review rounds on a change that touched no source file at all.

The gap: `src/gate.ts:373` already refused to close an item on a row from the pass that wrote
the code, and nobody was ever told to produce the row it looks for. `agents/implementer.md:45`
was the only `ledger record` in any agent file. The review path ended at "synthesize into one
verdict" and wrote nothing, so the coordinating pass typed the reviewer's row on its behalf.
Every closing row in this repo's ledger up to this point was produced that way.

Rounds 1 and 2 each shipped a false promise in the same paragraph, and both were caught at
rung 5 rather than by reading:

- Round 1 claimed `verifier-failed` "clears nothing and blocks a close". It unblocks one.
  `:371` needs `rows.every` and `:373` needs only `rows.some`, so the reviewer's own rejection
  is what satisfies the no-self-approval audit. Adding it flipped a scratch store's gate from
  FAILED exit 1 to PASSED exit 0. The implementer's own decision row had stated the fact
  correctly, with the qualifier "whose only verdict"; the qualifier was dropped on the way into
  the agent file.
- Round 2 replaced it with "what keeps the item open is that a rejected item does not move past
  `reviewing`". Nothing keeps it. `src/lifecycle.ts:90` allows `reviewing -> verifying`
  unconditionally and `canTransition` never reads the ledger. A rejected item walked to `done`
  with no `--force` and the gate ended PASSED. Two passes reproduced this independently, before
  either saw the other's result.
- Round 2 also introduced a cure that overshot: any report suffix meant "lens", and a lensed
  reviewer records nothing. Six of this repo's review reports carry `_r<N>` round suffixes, and
  `review_verification-never-runs_r4.md` is the evidence on the row that closed item 14 - the
  only reviewer-typed closing row in the repo's history at that point. The rule would have
  suppressed exactly the row this item exists to produce.

Round 3 stopped guessing. The causal clause is struck with nothing in its place, because
nothing true was available to say. `_r<digits>` is reserved as a round marker, lenses are
words, and the two compose. The rule was run as code over all 23 real report names by two
passes separately: 12 record, 10 lens, 1 unclassified.

What this cost and what it bought: three rounds, no source changed, and four new items filed
rather than folded in (17 gained a bullet, 18 gained a bullet, 19 and 20 are new). The closing
row is the first in this repo typed by the pass that judged the code.

Two things this session got wrong and had to correct out loud. The claim that the new
instruction had been proven to work unaided was false: the reviewer subagent loaded
`agents/reviewer.md` from the plugin cache, which has no `Record it` section, so it recorded
because the brief pointed it there. That test cannot run until item 17 lands and the plugin is
reloaded from this checkout. And the merge to main aborted once on a dirty `state.json`, which
the transcript shows rather than hides.

## Item 17 path-mstack-is-the-installed-copy, 2026-08-21

Four review rounds. The mechanism was rewritten three times, and each rewrite fixed the previous
round's defect by introducing the opposite one.

The gap: `which -a mstack` resolves only to the installed plugin cache. Reproduced before any
code, same store and same commit, an item whose verification exits 1 and had never run - the
cached 0.1.0 gate printed PASSED exit 0 where the checkout's gate printed FAILED exit 1.

The trap inside the fix, caught before writing it: both copies declare `"version": "0.1.0"`
while ten of twelve `src/` files differ and two modules exist only in the checkout. A version
comparison reports "identical" for two binaries whose gate disagrees on an exit code. The check
keys on the path the running code resolves to, never on a version string.

- Round 1 keyed on two file markers and a path equality. Loud false positives both ways: a
  `git worktree` of this repo at the SAME commit was a red gate under the launcher
  `hooks/hooks.json` actually wires, and an ordinary project carrying `bin/mstack` and
  `src/cli.ts` failed with a `fix:` line telling a stranger to run their own unrelated script.
- Round 2 fixed both by making the manifest the identity and "foreign" mean outside this git
  repository. That inverted the failure: a worktree on a feature branch whose `src` tree
  genuinely differed got `[ok] came from within the same repository`, PASSED exit 0, over a
  store its own code called FAILED. That is verbatim the item's own description, printed with an
  affirmative `[ok]` over it. Round 1 was a loud false positive; round 2 was a silent false
  negative.
- The round-2 decision row's cost argument was refuted at rung 5 by two passes separately:
  `git rev-parse --git-common-dir HEAD HEAD:src` returns git's stored tree object in the same
  two spawns already being made, measured at 19.7ms against 21.4ms for the common dir alone. The
  comparison it was priced out of is free.
- Round 3 made same-repository necessary and the committed `src` tree sufficient, splitting
  severity: `fail` outside the repository, `warn` for a sibling whose tree differs. Its blocker
  was narrow and exactly this item's defect class - the CLI note said "differs" where the gate
  said "could not be compared", so one surface asserted more than had happened.
- Round 4 closed that structurally rather than by patching two strings: the shared helper is
  typed to the `same-repo` arm, so the divergent state cannot be written at all. All nine
  reachable provenance states were enumerated through the real launcher.

Two things worth keeping. The severity question - does a `warn` reach a human when `--quiet` is
what the Stop hook runs - was answered three-valued rather than guessed: the model gets nothing
by construction, the client captures exit-0 hook stderr, and whether a person sees it rendered
is something this repo already declines to promise. The round-4 decision row then moved its
argument off the value that could not be established. And the honest limit is stated rather than
papered over: this check ships with the code that was being missed, so a copy installed before it
existed still says nothing.

Bullet 5 was added mid-item and widened it. The stale copy governs agent and skill definitions,
not only the CLI. `agents/reviewer.md` in the cache has no `Record it` section, so every subagent
launched in this session ran the 0.1.0 contract - which is why this session's earlier claim that
item 15's instruction "worked unaided" was false, and was corrected out loud rather than quietly.

Left behind and not cleaned: branch `review17-wt-probe` from a round-1 review probe. Its worktree
is removed; the force-delete spelling is refused by this plugin's own guard, which is the guard
working. Filed separately: writing that spelling inside this very history entry tripped the
guard, because it scans the whole invocation including heredoc bodies.

## Item 23 docs-for-newcomers, 2026-08-22

Three panel rounds on a docs item, two lenses per round, and the lenses earned their
separation every time: neither ever found the other's blockers.

The request came from the user directly: the docs were accurate but not friendly, and nothing
explained the cast. Measured before deciding: no wiki page documented the 5 agents, 12 skills
or 7 playbooks as topics; zero diagrams anywhere; every page opened at mechanism level.
Decided and recorded: additive, not a rewrite - item 9's panel had verified the existing
~2400 lines, and the problem was structure, not accuracy.

Shipped: The-Agents.md and Skills-and-Playbooks.md; a lifecycle stateDiagram matching
TRANSITIONS edge for edge; a request-flow flowchart with the three passes framed in an
orchestrator subgraph and merge-gate as the landing decision; opening summaries on all 8
existing pages; a README concept map; and a jargon pass that defines or links every term at
first use. 100 relative links, 0 broken.

What the rounds caught, by lens:

- Reader, round 1: the four promised dimensions existed for agents but not skills; the flow
  diagram taught mstack gate as the landing decision and omitted the orchestrator; 11
  unglossed terms. Facts, round 1: the Skills page's opening contradicted its own route table
  30 lines down; a summary contradicted its own page; two stale line cites.
- Round 2 fixed all of it and reintroduced the jargon defect inside the fix's own tables, and
  added a caption asserting the session gate runs at SessionStart - refuted at rung 5, one
  runGate hook call site, in Stop, per turn. The fifth true-sounding connective sentence this
  refinement has caught asserting behaviour the mechanism does not have.
- The reader's round-2 structural worry - subgraph members bound to top level by earlier edge
  references - was settled at rung 4 by driving mermaid 11.17.0's own parser db: shipped
  membership [spec, impl, review], and a true-failure mutant returning [review] proves the
  probe can fail. The diagram was not restructured for a hedge against an unknown.

Honest residuals, stated rather than swept: GitHub's own mermaid render was observed by no
pass (the probe pins 11.17.0, GitHub pins its own) - closable only by looking at the pushed
page; and the wiki-publish rewrite leaves Page.md#anchor links 404ing on the published wiki,
a pre-existing class now counted at seven instances and filed as item 24.

Process notes: both round-2 lenses were killed at launch by a usage limit and resumed with
context intact, nothing repeated. The panel rows followed item 15's grammar throughout - the
lenses recorded nothing, the synthesizing pass recorded one row per round under its own role,
and the composed r<N>-<lens> report names classified correctly at every step. Item 24's
instance count was corrected five-to-seven from the round-3 facts sweep before close.
