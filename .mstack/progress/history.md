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
  973f8a5. The record files (CHANGELOG, research doc, history, item-9 reports) keep the old
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

## Item 25 provenance-fixtures-lack-package-json, 2026-08-22

CI red on main, reported by the user. One round, and the whole thing closed at rung 5 on the
surface the defect lives on.

Four provenance tests from item 17 failed only on the oldest-node CI job: the checkout
fixtures copied bin/, src/ and the manifest but not package.json, so node 22.6's
type-stripping path printed MODULE_TYPELESS_PACKAGE_JSON on stderr, and the tests assert
empty stderr. Invisible to every local run and all four item-17 review rounds because bun and
node 26 never emit the warning; the only warning runtime was the one CI pins. Reproduced on
the exact binary (the machine's nvm had v22.6.0), fix direction proven before filing: the
same fixture with {"type":"module"} goes silent.

The fix copies the real package.json into every checkout-shaped fixture, swept across both
test files rather than patched at the four sites. The reviewer independently re-ran the
red-first proof (4 red with main's test file on 22.6.0, 276/276 with the fix) and confirmed
the installed plugin cache ships package.json with type module, so the fixture is now
faithful rather than masking a shipping defect. Its approval carried the honest caveat that
acceptance 3's CI half was unproven; the push closed it: run 32581440487 green on main at
57aa3bc.

Second fixture-identity omission in this defect's family: item 17 round 2 added the manifest
to these same fixtures, this item adds package.json. A fixture that stands in for a real
shape drifts from it one forgotten file at a time, and each file is found by the one
environment that cares.

## Follow-up to item 23, 2026-08-22

The one residual its close left open is now shut at rung 5: both diagrams were observed
rendered by GitHub's own mermaid on the pushed main. The README flowchart draws the
orchestrator frame containing exactly the three pass boxes, with APPROVED leaving the frame
to ledger, merge-gate, merged - agreeing with the 11.17.0 parser-db probe - and the lifecycle
stateDiagram renders all nine statuses with the blocked note as a note box. Screenshots taken
in a live browser session against github.com/romerma/mstack at e018413.

## Item 18 closing-row-cites-own-report, 2026-08-22

The gate's no-self-approval audit read only the verifier column, so a row recorded
--verifier reviewer --evidence impl_<slug>.md closed an item on the implementer's own
report, and its all-rows-failed guard let one passing implementer row hide an unsuperseded
verifier-failed reviewer verdict. Both holes reproduced at rung 5 before any fix: forged
rows against this repo's real ledger through ./bin/mstack gate, green then, ledger restored
bit-for-bit. Red tests committed before the fix (b446aa5) so the broken state stays
checkoutable.

Design ran as two blind sonnet candidates judged by opus, which transcribed both predicates
and traced them over the real ledger and 17 adversarial probes: tie 10/12, base candidate A
for message truthfulness, four grafts from B. The judge's open boundary question was resolved
before implementation and recorded in decisions.tsv: a citation is the exact report filename
as a whole token however punctuated.

Three implementation rounds, three review lenses, five verdicts. Round 1 shipped the
six-step audit and the citesImplementingReport predicate; the panel then earned its keep:
security proved case-evasion is not theoretical on APFS (IMPL_*.md is the same file) and
that a U+200B citation reads identically to a human and differently to the regex, both at
rung 5; correctness caught the new message committing the exact nearby-falsehood the judge
made the deciding criterion (it said "implementer's own report" while firing on the
spec-author's), plus the wiki's refusal enumeration going stale; tests proved by mutation
that multi-role supersession, a decision stated twice in the design record, was pinned by
nothing. Round 2 closed all of it (i flag, \p{Cf} strip, kind-split messages each literally
true, the mutation-killing test); round 3 added the two coverage tests correctness's own
round-2 mutations demanded and replaced a wiki paste no single run could produce with one
from a real three-item run. Final: 286 tests green on both runtimes, all six boundary probes
pinned twice, panel verdict at 487abdf7, ff-merged to main as 9a0b09f, CI run 32587889133
green, and a session row at the merge SHA whose src tree hash is byte-identical to the
panel-verified one.

Erratum for the design record: candidate A justifies identity-agnostic supersession by
citing docs-for-newcomers as the real-ledger multi-role case, but that item's three closing
rows all carry verifier orchestrator - same-verifier supersession. The decision stands on
its own reasoning and is now pinned by a test with genuinely different verifier strings; the
cited backing was wrong and the doc stays as written per append-only discipline, corrected
here.

Residuals stated rather than swept: Unicode homoglyphs still evade and the predicate's
comment now says so; free prose that never names the file is irreducible while evidence is
free text; wrong-slug citations out of scope. Two findings filed instead of left in report
prose: item 26 (ledger record accepts the forged shape at write time) and item 27 (the
unsuperseded-failure message misdescribes the ledger when a forged row follows the failure).
Item 19's shape bit twice in the flesh: the implementer's row was voided by its own report
commit every round and re-recorded each time.

Process notes: ship ran without a PR - this repo has zero PRs and every prior branch landed
as a fast-forward, so the PR and merge-gate steps were skipped for the repo's real
convention and CI was watched on main's own run. The panel grammar held: lenses recorded no
rows across five reports, the coordinator recorded one verdict per terminal round.

## 2026-08-23 — items 28, 29; 0.2.0 tagged

Started from "mstack needs one entry point like pstack's /poteto-mode".

**Item 28 `mstack-front-door`: cancelled, reverted, and the most useful thing that
happened.** It was filed on the finding that `/mstack` was not a registered command, evidenced
by `claude plugin details` listing the skill as `router` and a transcript `lastPrompt` of
`/mstack:router`. Both observations were real and both were consistent with the opposite
conclusion, which is the lesson: three documents agreeing is one claim counted three times, not
corroboration. The reviewer read the loader in the installed `claude 2.1.241` binary and found
that a declared `name` with no colon is registered as a bare alias. `/mstack` had always
worked. Reverted byte-clean against `b31d93b`; the item carries its reasoning in
`decisions.tsv`.

Two process facts worth keeping. The reviewer's round-1 pass had *approved* the same false
mechanism, and what made it recoverable was that it labelled the claim rung 2 and said out loud
it could not reach rung 4. That sentence is what told a later pass where to push. And the
review was launched only because a release was requested; had the branch been tagged when it
was green, the refuted claim would have been the headline of 0.2.0.

**PR #1 was merged by hand at `b96a474` while the branch was still under review**, so `main`
carried the refuted work for about three hours. Recovery was PR #2 with the three missing
commits, no history rewritten. This is the one time in this repository that a merge got ahead
of its review, and it is named in the 0.2.0 tag rather than left out.

**Item 29 `readme-leads-with-use`: done.** The README explained the machinery for 84 lines
before showing anyone a command, and named neither the seven playbooks nor the five agents.
Rewritten to open on `/mstack <request>`, then install, then the flow, with new sections for
every playbook, every agent with what it cannot do, and all twelve skills. Three rounds of
review found: a claim that contradicted the README twenty lines later, a playbook row that
deleted its playbook's escape hatch sixty lines from where the README criticises pstack for
exactly that, an unconditional claim the playbook conditions, and an acceptance criterion whose
command nothing executed at close. Approved at `f57ad03`, closed at `1e2580d`.

**Released 0.2.0**, annotated tag on `53a0865`, CI green on main. Follow-ups filed: **31**
`lint-plugin` never scans README or the wiki, so a dead `/mstack:<x>` reference there stays
green; **32** the `lintReferences` name-resolution line is uncovered; **33** every mstack skill
declares a colon-free name, so `/setup`, `/verify` and `/design` resolve with no prefix, which
is an undocumented cross-plugin collision surface.

Still at rung 3, and cheap to close: nobody typed `/mstack` in a live session. Every claim here
about the resolver comes from reading it and running its expressions, not from using it.

## 2026-08-23 — 0.2.1

A patch release correcting two things 0.2.0 shipped. No behaviour changed.

The 0.2.0 changelog claimed the alias mechanism "is documented in neither Claude Code's skill
docs nor this project's research". Only the second half had been checked; the first is a
negative claim about documentation this session never read. Caught by the reviewer *after* the
tag was pushed, which is why it needed a release rather than an edit.

That is the third instance in one episode of the same sentence-shape: something consistent with
what was already believed, stated as fact, unchecked against the source. The other two were
"the command is named after the directory" and "a directory called anything else would leave
`/mstack` unanswered", and between them they cost a rename that reached `main` and had to be
reverted. Worth stating plainly because the pattern was invisible at each individual instance
and obvious across three.

The wiki's "both spellings" became three. The verification method is the part worth keeping:
the reviewer ran the bundle's real dispatch chain, `PFt` into `yb` into `JUS`, over the real
skill directories rather than reading the resolver and inferring. The binary carries a second
matcher, `al`, that never consults `userFacingName`; had dispatch used that one,
`/mstack:mstack` would resolve to nothing and the replacement sentence would have been as wrong
as the sentence it replaced.

`## 0.2.0` in the changelog was restored to exactly what its tag carries, verified against
`git show v0.2.0:CHANGELOG.md`, and the correction lives in `## 0.2.1`. The v0.2.0 tag message
still carries the overclaim and was not rewritten.

Item 33 gained the sharpest form of its question, and the reviewer flagged it **unverified**
rather than assuming it: an exact `name` match outranks any alias in `yb`, so if the user- and
project-command loaders use unprefixed names, a user's own `/verify` displaces mstack's
`/verify` alias outright. That has to be settled before the keep-or-drop decision, not after.

## 2026-10-31 — item 34 commit-message-standard, closed; validation program filed

Three review rounds, each by a reviewer that did not write the change, on Opus; rounds 2 and 3
implemented on Sonnet, the first items built under the role split the user chose (Sonnet
implements, Opus reviews; item 39 makes it the agents' default).

- Round 1 (CHANGES_REQUESTED): bullet 4 unmet (`## Unreleased`, settled by decision row), README
  counts disagreeing, a stale wiki route table and lint paste, a CHANGELOG overclaim, and the
  finding that mattered: the shipped skill imposed this repository's trailer policy on every
  user. The user chose to generalize; the house rules now live in CONTRIBUTING.md and CLAUDE.md.
- Round 2 (CHANGES_REQUESTED): imperative mood was still a mandatory step in the shipped skill.
- Round 3, authorized by a `review-r3` decision row scoped to two line edits: APPROVED.
  `gate --full` green with node 24.14 on PATH.

Cost, from the task notifications (subagent tokens, not yet from costs.tsv, which item 37
builds): reviewer r1 71k, implementer r2 29k, reviewer r2 74k, implementer r3 21k, reviewer r3
51k. The delta reports were 2.8 KB and similar, against 24-98 KB for earlier single-file
reports. Reviewers cost 2.5x the implementer per round, mostly re-running both suites.

Also this session: items 26 and 27 cancelled by decision row (forgery hardening, no verdict
changes); items 36-45 filed from the approved plan; item 38 re-scoped by the user to a local
sandbox benchmark comparing plain, mstack-before and mstack-after; item 46 filed (npm test
fails on node 22.6 because package.json omits the strip-types flag CI adds).

## 2026-11-01 — item 38 benchmark-harness, closed; easy-tier baseline recorded

The harness lives in `sandbox/bench/` (gitignored, local, never pushed). It has:
- a Python stdlib bookings app;
- six tasks, each with an issue, hidden tests and a reference patch;
- `run.mjs` for three arms (plain, mstack-before, mstack-after);
- `summary.mjs`, `verify.mjs` and `check.mjs`.

The brief was built on Sonnet and reviewed on Opus over four rounds; rounds 3 and 4 were
authorized by decision rows. What the reviewers caught, and why it took four rounds:
- **Round 1:** 8 blockers. They were contamination, answers reachable from the run directory,
  the parent env leaking into the child, and scoring that ranked a partial fix over a full one.
- **Round 2:** two remaining paths to the answers. Finished runs sat as siblings, and `.mstack`
  was inside the plugin archives.
- **Round 3:** the permission flags were not tested. Reverting to the allowlist left
  `check.mjs` green.
- **Round 4:** APPROVED.

Every arm runs `--permission-mode auto` in a rebuilt `env -i`, from a run directory under
`/private/tmp/mstack-bench-home` that is deleted after the diff is saved.

Easy-tier baseline: T1–T6 × 2 reps × plain and mstack-before, opus, 24 runs.

| arm | solved | regressions | cost/run | tokens/run | wall/run |
|---|---|---|---|---|---|
| plain | 12/12 | 0 | $0.24 | 149k | 46 s |
| mstack-before | 12/12 | 0 | $1.49 | 1.33M | 403 s |

What the table says:
- **No quality separation.** Both arms hit the ceiling.
- **The overhead is measured:** 6.2× cost, 8.9× tokens and 8.8× time, with 2–4 subagents per run.
- **Checkpoint decision:** continue. Quality is judged on the hard tier (item 48). Items 39,
  43 and 44 must bring this overhead down and keep the 12/12.

Three report lines quoted concrete hidden-test values. They were redacted in place, and the
full text moved to `sandbox/bench/evidence/` (decision row).

Found along the way:
- **Item 47:** `ledger check` hides a reviewer's verifier-failed row behind the implementer's row
  at the same sha.
- **Item 21 note:** a full-suite hang at `tests/gate.test.ts:1618`.

## 2026-11-08 — item 48 benchmark-hard-tier, closed; the quality ceiling, accepted

The hard tier is `sandbox/bench/template-hard/`: a stockroom app with 1938 source lines and
202 visible tests, and tasks H1–H4. Each task's hidden tests cover the reported behaviour and
the documented behaviour next to it. Each task also ships a naive patch, which `verify.mjs`
proves passes every test mapped to the issue and fails tests mapped to the README. It was
built on Sonnet in two rounds and approved by an Opus review with no blockers.

**Calibration never got plain below 1.0:**
- Round 1: plain solved 8/8.
  - It reads the whole README before touching code.
  - One issue said which figure was correct.
- One bounded hardening round followed:
  - issues that describe only the symptom;
  - reporter misdiagnoses;
  - edge cases implied by the issue's general rule;
  - shared-helper traps;
  - a naive patch for every task.
- After it, plain solved 4/4. It declined each misdiagnosis after reading the README rule it
  broke.

At about 2k lines with every rule documented, the fair traps are exactly the ones a model that
reads the README avoids. The user accepted the ceiling. Acceptance A3 was amended to record
that outcome (decision row), and the program's measurable claim is now *the same solved rate
at much lower overhead*. Nothing claims "better quality" without proof.

**Baseline on both tiers:** 16/16 solved in each arm, 0 regressions.

| tier | plain cost/run | mstack-before cost/run | ratio | wall ratio |
|---|---|---|---|---|
| easy | $0.24 | $1.49 | 6.2× | 8.8× |
| hard | $0.45 | $2.13 | 4.7× | 5.3× |

The widest gap was on H4, the cross-cutting feature: $4.46 against $0.73, and 950 s against 114 s.

**Leak rule widened** (decision row). Committed text now names no hidden values, no
assertions, no patch contents, and not which side or fix is correct. Two uncommitted decision
rows and one table were rewritten in structural terms; the full copies are in
`sandbox/bench/evidence/`.

**Review finding 5.** The reviewer's self-checks put answers under `/private/tmp` for a few
minutes while the batch ran, three levels above every run copy, because `check.mjs` has used
that root since item 38. Every stream was scanned and none reached an answer path. The root
fix is item 49, which must land before the item 45 rerun.

## 2026-11-08 — item 20 fanout-worker-can-forge-a-round-marker, closed

Two rounds. Sonnet implemented, and each round was reviewed on Opus.

**What changed:**
- `fanout plan` refuses any worker name that starts with `r<digit>`.
- `roundOf(file, kind, slug)` lives in `src/roles.ts`, with a table test over every report
  name in `.mstack/progress/`.
- `MIN_REPORT_BYTES` has one definition.

**Round 1 (CHANGES_REQUESTED).** The reviewer made two one-character mutations, and the suite
stayed green through both:
- dropping the `$` anchor in `roundOf` brought the forgery back;
- widening the name check went unnoticed.

The stated rule was also wider than the code, and two descriptions were wrong.

**Round 2 (APPROVED).** Each mutation fails a named test, on both runtimes. The fanout rule was
widened to `/^r\d/` on the reviewer's recommendation.

**Cost.**

| | Round 1 | Round 2 |
|---|---|---|
| Implementer (Sonnet) | 32k | 44k |
| Reviewer (Opus) | 74k | about 20k |

The round-2 reviewer was resumed with its round-1 context and scoped to the delta and the
touched test files, so it cost about a quarter of round 1. That is evidence for item 43's
delta-review design.

The mutation the reviewer ran by hand is the check item 42 automates.

**Carried to item 43 as an acceptance bullet.** `roundOf` reads `_r2x` as a lens, while
`agents/reviewer.md:77` reserves any leading `r<digit>`. Those two rules must become one before
`roundOf` decides solo versus panel.

## 2026-11-08 — item 36 shared-runner-and-closing, closed

**Delivered:**
- `src/run.ts` with `runCommand`;
- the `node:`-only helper `src/run-helper.mjs`, which does a detached spawn, a group kill
  with a second kill on exit, and signal forwarding;
- `src/git.ts`;
- `src/closing.ts`, holding structured `closingProblems` with per-check `reportedAt`, which
  the gate and `state set --status done` both call;
- `src/pathclass.ts`.

Implemented by Sonnet over four rounds, each reviewed by Opus. Rounds 3 and 4 were authorized
by `review-r3` and `review-r4` decision rows.

The suite was green from round 1. Every blocker came from the reviewer's probes and mutations,
never from the suite itself:
- **Round 1.** `set -m` job control does nothing under dash without a tty, and CI's `/bin/sh`
  is dash. The reviewer simulated this on macOS. Two more problems:
  - a pgid race at timeouts of 2–5 ms;
  - job-control noise in the captured tail.

  The gate and `state set` would also have disagreed as soon as a second closing check
  existed, and three pathclass mutants survived.
- **Round 2.** The node helper fixed all six blockers, but brought four defects of its own:
  - a child forked at kill time survived;
  - bun loaded the target directory's `bunfig.toml` and `.env`;
  - invalid `timeoutMs` was not rejected;
  - Ctrl-C dropped the timeout bound.
- **Round 3.** On the signal path, the second kill never ran.
- **Round 4.** APPROVED. Forking probes left 0/10 survivors on each runtime, and every change
  has a test that goes red without it.

**Not proven:** everything ran on macOS only. The Linux claim rests on swapping in `/bin/dash`,
so the first CI run on ubuntu is the real check, and nothing has been pushed yet.

**Cost** (subagent tokens, cumulative per agent):
- implementer 131k;
- reviewer 222k.

The reviewer cost about 1.7× the implementer, but found every defect. This is the item the
plan's review budget (43) is about. Four rounds were worth paying here because items 37, 41
and 42 run on this path. On a leaf change they would not have been.

**Carried forward:**
- The item 21 hang has a second observed site, `tests/launcher.test.ts`, on a statusline child.
- `closing.ts` checks are one-line `CLOSING_CHECKS` entries. Items 41 and 42 add theirs there.

## 2026-11-08 — item 37 cost-ledger, closed

**What it does.** `.mstack/costs.tsv` records tokens per item, role and model. The pieces:
- marks under the git dir;
- idempotent flushes at SessionEnd, at SessionStart for leftover runs, and in `mstack cost`;
- reconciliation to cost-state;
- `merge=union` via `.mstack/.gitattributes`;
- a `rules.record_costs` switch.

It also fixes the SubagentStop hole: a stale report no longer passes. Sonnet implemented it in
three rounds and Opus reviewed each one. A `review-r3` decision row authorized round 3.

**Rung-4 facts** (real haiku sessions):
- cost-state is written before SessionEnd: with `-p`, `/exit`, Ctrl-C and a closed terminal;
- it includes subagents;
- it is cumulative across `--resume`;
- `/compact` usage appears only in cost-state.

**What the reviewer caught** with real sessions and the real CLI hooks, not the suite:
- **Round 1.**
  - Fresh sessions have no transcript at SessionStart, so the first turn was lost. Single-turn
    `-p` sessions (the benchmark's shape) had no `main` rows.
  - A session with no Stop recorded nothing.
  - `merge=union` double counted a session flushed on two branches.
  - Per-item usd went to the last item.
- **Round 2.**
  - The 14-day prune dropped flushed totals while transcripts live 30 days, so a resume
    counted the session twice.
  - The multi-item rule misfired on every item-closing session.
  - The lock wait sat inside the crash window.
- **Round 3:** APPROVED. Every reproduction gives the real figures, and a live session matches
  cost-state to the token and the cent.

**Two decision rows set the money rule.** A session's usd goes to the one real item that
carried usage. It goes to `(multi-item)` when two or more did. Stretches with no item never
count. No split is made by token share, and no price table is kept.

**Cost** (subagent tokens, cumulative per agent):
- implementer 261k;
- reviewer 253k;
- real-session probes: about $0.05 in total.

**Not yet exercised:**
- **Recording itself.** This session runs the cached plugin, so its own hooks write no costs.
  Recording starts once the session is relaunched with `claude --plugin-dir .`, which item 39
  needs anyway.
- **Linux.** Unproven, as for item 36.

**Filed:**
- item 50: `plugin validate --strict` is red on two warnings that claude 2.1.316 added. This
  predates item 37.
- item 51: a single-append flush and marks compaction.

## 2026-11-16 — improvement program seeded, item 52 opened

**What ran.** A research pass over the plugin, the mattpocock/skills plugin, the wider skill
collections and Claude Code's integration mechanisms. Report: `reports/Mejoras mstack con skills
Pocock.md`. The user approved its plan and its one product fork in the session.

**Decided:**
- The plan runs as an orchestrate program in five phases. Row of 2026-11-16, phase `plan`.
- Intake is autonomous by default, with an interactive mode only when the request asks for it.
  Recorded with `--resolves intake-step`.
- Third-party skill text is vendored and adapted under MIT, not depended on. A missing plugin
  dependency disables the dependent plugin, and 16 of the 27 mattpocock skills, `grill-with-docs`
  among them, carry `disable-model-invocation: true`.

**Filed:** items 52 to 65.

**Item 52, in flight.** Reproduced, mechanism located, two failing tests committed at `bb73baa`
ahead of the fix. Red on node and on bun for the stated reason.

**Not done, and why.** The session was launched as plain `claude`, with no mstack plugin loaded.
There were no `mstack:*` agents to delegate to, no hooks and no cost rows, so the work stopped
at the delegation step. `current.md` carries the next step.

**Found on the way:**
- `lint-plugin` does not read `.gitignore`: a gitignored notes directory at the root failed the
  single-source-of-truth check. The notes moved under `docs/`, which the lint skips.
- The item 37 entry above says that session ran the cached plugin and wrote no cost rows. That
  is the first thing to check for item 54.

## 2026-11-16 — item 52 withlock-enters-without-the-lock, closed

**What changed.** `withLock` in `src/tsv.ts` no longer enters without the lock. The lock names
its owner (pid and token), is taken with an exclusive create and entered only after reading the
caller's own token back; a dead owner's lock is broken under a `.lock.break` guard and taken
again; a live holder past the timeout makes the waiter throw a `UserError` naming the lock; any
other failure to create the lock is thrown, not waited out. An `options.step` seam drives
deterministic interleavings in tests.

**Rounds: 3.** Implementer on Sonnet, reviewer on Opus, each a fresh general-purpose agent
briefed with `agents/implementer.md` or `agents/reviewer.md`, because the session had no plugin
loaded. So no hooks ran and no cost rows were written.
- Round 1, rejected: the acquire loop span forever when the lock could not be created (exFAT,
  read-only store); a mutant that breaks a live holder's old lock passed every test; the race
  test could not see the race.
- Round 2, rejected: moving to exclusive create opened a window where a creator stopped 2 s
  before writing its owner resumed inside beside the breaker (341 ms overlap, real processes);
  the empty-guard branch was untested; two new tests failed on correct code under load.
- Round 3, approved: `review_withlock-enters-without-the-lock_r3.md`, `test-verified` at
  `4dbb41c` by reviewer. 0 failures of `tests/tsv.test.ts` in 399 loaded executions.

**What the rounds say about the workflow.** The suite was green in every round. Every blocker
came from the reviewer running real processes and mutants, as on item 36. Round 2's blocker was
introduced by round 2's own fix. The statistical race test was written, measured and deleted
inside the item: 7 s per runtime, one false failure in 213 runs.

**Accepted, on the record.** A creator resuming between a breaker's re-check and its removal
loses a live lock. It needs two stops landing in two microsecond windows. Filed in item 66.

**Filed:**
- item 66: lock follow-ups (the accepted window in Known limits, the unsafe cleanup in
  `tryCreate`, lock leftovers in the store, monotonic wait, the timeout message).
- item 67: `tests/run.test.ts:54` and `tests/costs.test.ts:698` fail under load; maybe item 21.

**Carried to item 53:** move `UserError` out of `src/paths.ts`, which `src/state.ts` imports.

## 2026-11-16 — item 53 state-json-loses-concurrent-writes, closed

**What changed.** `state.json` changes go through `updateState` in `src/state.ts`: it holds
`withLock` across parse, change and write, writes a temp file in the same directory and renames
it over the target, and carries keys the CLI does not know through the write. `state add`,
`state set` and `decide --resolves` moved to it and `saveState` is no longer exported.

**Rounds: 2.** Same arrangement as item 52: Sonnet implements, Opus reviews, general-purpose
agents briefed from `agents/*.md`, no plugin loaded, no hooks, no cost rows.
- Round 1, rejected on one blocker: the temp write used one `writeSync` and ignored its byte
  count, so under `ulimit -f 2` a truncated file was renamed over `state.json` and the command
  exited 0.
- Round 2, approved: `review_state-json-loses-concurrent-writes_r2.md`, `live-verified` at
  `4092af5` by reviewer. Real failures run on both runtimes (EFBIG, EPERM on rename, ENOSPC on a
  full image, EACCES): target untouched every time. 0 failures of `tests/state.test.ts` in 110
  loaded runs.

**Did the item 52 lessons carry?** The brief asked for explicit timeouts, deterministic tests
and the mutant table up front. Round 1 came back with one blocker instead of three, and no test
failed under load. One data point, not a measurement.

**Filed:** item 68, state write follow-ups (the half-done `decide --resolves`, symlink and file
mode, a recurring temp pid, key lists kept by hand, git work under the lock).

## 2026-11-17 — item 54 hook-errors-leave-no-trace, closed

**What changed.** A hook that throws, a hook called with an event the CLI does not handle, and
every swallowed failure on the hook path that is not a plain absence now append one line to
`.mstack/hook-errors.log` (machine-local, capped at 200 lines). Hooks still exit 0 and print
what they printed before. `mstack gate` warns when the log has lines newer than `history.md`.
`lint-plugin` refuses a `hooks.json` entry whose hook argument the CLI does not handle, from
the one list the dispatcher reads. For stores created before this change the log's name is
appended to `.git/info/exclude`, only after a successful append and only in a store directory.

**Rounds: 2.** Sonnet implements, Opus reviews, general-purpose agents briefed from
`agents/*.md`. No plugin loaded, so none of these hooks ran in a real session.
- Round 1, rejected: subagent-stop still swallowed an unreadable `state.json`; no test pinned
  the branch that records a fault, so a "never record" mutant passed.
- Round 2, approved: `review_hook-errors-leave-no-trace_r2.md`, `test-verified` at `9adb4b9`
  by reviewer. Six hooks by hand on both runtimes against four kinds of unreadable store, 24
  fail-open rows and 120 concurrent hooks: exit 0, stdout unchanged, 2 to 3 ms added.

**Why `costs.tsv` holds only its header.** Not a bug in this checkout. The item 37 session ran
the cached 0.2.1 copy, which predates the cost code, and no session since 2026-11-08 has loaded
the plugin. Run by hand, this checkout's hooks write a cost row. A real `claude --plugin-dir .`
session writing rows end to end is still unproven and is in item 69.

**Filed:** item 69, hook log follow-ups. Item 67 gained a third load-sensitive test,
`tests/run.test.ts:239`.

**Phase 0 so far:** 52, 53 and 54 closed in 3, 2 and 2 rounds. In all three the suite was green
in every round and each blocker came from the reviewer running real processes or mutants.
Briefs that asked for the mutant table up front cut the first-round blockers from three to one
or two, and did not get any item through in one round.

## 2026-11-17 — item 47 ledger-check-hides-a-rejection, closed

**What changed.** `ledger check` answers with the latest row at the sha from a role that can
close an item. A rejection there fails the check and names itself, whatever an implementing role
recorded and whatever the rejection cites. An approval whose evidence cites the author's own
report fails as not independent. With no closing-role row the old best-by-rank answer stays,
labelled the author's own verdict. A target is matched literally. Three prose copies of the old
"most favorable" rule were corrected (`agents/reviewer.md`, `skills/review/SKILL.md`, two wiki
pages).

**Rounds: 2.** Sonnet implements, Opus reviews, as before.
- Round 1, rejected: the citation filter also dropped rejections, so a reviewer's
  `verifier-failed` that mentioned `impl_<slug>.md` gave PASS on the author's row; one wiki
  sentence still stated the old rule; and the change introduced a crash on a slug with regex
  metacharacters.
- Round 2, approved: `review_ledger-check-hides-a-rejection_r2.md`, `live-verified` at
  `acd6b75` by reviewer. All 29 closed items pass at their closing sha, and all 105 (target,
  sha) pairs in the ledger answer the same before and after.

**The gate has the hole this item closed in `ledger check`.** Two shapes still close an item
over a standing rejection. Filed as item 70; the disagreement is in the safe direction for
`ledger check` and the unsafe one for the gate.

**Filed:** item 70.

## 2026-11-17 — item 46 npm-test-misses-strip-types, closed

**What changed.** `npm test` is `npm run test:bun && npm run test:node`. The node half carries
`--disable-warning=ExperimentalWarning --experimental-strip-types`; the bun half is
`bun test ./tests`, so the gitignored `sandbox/` no longer adds or fails tests. CI calls the
same scripts. `tests/scripts.test.ts` pins them. The README names the command that proves the
22.6 floor.

**Rounds: 1.** The first item of this program to pass review first time. It is also the only
one with no concurrency and no failure paths in it.
- Approved: `review_npm-test-misses-strip-types.md`, `test-verified` at `cd83673` by reviewer.
  480 of 480 on bun and on node with 22.6.0, 24.14.0 and 26.13.1 first on PATH, stderr clean.
  The sandbox scoping was shown with a file list in a scratch clone, not by subtraction.

**Unproven until a push.** Both GitHub Actions jobs on ubuntu-latest, with whatever bun is
current there and whatever "22.6" resolves to. `main` is local only since 2026-11-08.

**Notes left, not filed:** `README.md:424` describes `bun run test` the old way (still true);
the README command assumes nvm's install path; the "480/480" comment in `ci.yml` will go stale
as "112/112" did; bun searches `tests/` recursively and node's glob reads only the top level.
They belong with item 30 (README counts drift).

**Phase 0 is done except item 50**, which needs the user's answer on the plugin icon. Closed:
52, 53, 54, 47, 46, in 3, 2, 2, 2 and 1 rounds. Filed on the way: 66 to 70.

## 2026-11-17 — item 70 gate-closes-over-a-rejection, closed

**What changed.** `readVerdict` in `src/ledger.ts` is the one reader of a verdict at a sha;
`ledger check`, the gate's closed-item audit and a new `ledger-verdict` closing check call it.
`state set --status done`, the gate at `verifying` and the Stop hook refuse a standing
rejection and name the row; `--force` does not get past it. Closing judges at the sha being
closed and also across the item's rows. A `verifier-blocked` row never lifts a rejection, and
one that cites the author's own report is discounted. Abbreviated shas resolve through git;
`ledger record` refuses an empty target; the status line shows three verdict states. The
sentence every reviewer reads, that a `verifier-failed` row "is not itself a gate", now says
the opposite, because it is one.

**Rounds: 2.**
- Round 1, rejected: that sentence was now false; the closing check judged across shas and not
  at the closing sha, so a rejection at HEAD followed by an approval recorded later at HEAD~1
  closed with a passing gate; and a lone `verifier-blocked` citing `impl_<slug>.md` closed an
  item the old gate refused.
- Round 2, approved: `review_gate-closes-over-a-rejection_r2.md`, `live-verified` at `28122f6`
  by reviewer. 23 sequences on the real CLI: nothing closes over a standing independent
  rejection at the sha being closed, and the normal fix-and-re-review flow still closes. The new
  check refuses none of this repository's 31 closed items; 111 ledger pairs answer the same.

**Accepted limit.** The audit cannot know the commit an item was closed on. Filed as item 71,
next to item 40.

**Session tally, 2026-11-16 and 17.** Closed: 52, 53, 54, 47, 46, 70, in 3, 2, 2, 2, 1 and 2
rounds. Filed: 52 to 71. Suite: 374 tests at the start, 529 now, green on bun and on node
22.6.0, 24.14.0 and 26.13.1. None of it has run on CI: `main` is local only since 2026-11-08.
No session loaded the plugin, so no hook ran for real and `costs.tsv` is still header-only.

## 2026-11-17 — item 55 intake-step, closed

**What changed.** `/mstack <prose>` now runs intake as step 3 of the router's orient list,
between `state active` and copying the playbook. The method is `skills/router/references/intake.md`
(77 lines), adapted from the structure of `mattpocock/skills` grilling and the ruling pattern of
`obra/superpowers`, with an origin header naming both commits and both MIT notices under
`licenses/`. Each node of the request is classified in order: a fact (found, never asked), else a
fork (its answers give the product's user a different result, or it cannot be undone, however
cheap the change), else a reversible decision (taken and recorded with `decide --phase intake`
and an `if wrong:` cost). Intake ends with `state add` carrying acceptance, a source and seams;
forks ride on `decision_required` and reach the user in one numbered round that ends the turn,
names the slug and leaves a note in `current.md`. A partial answer never gets `--resolves`. An
interactive mode with no cap on questions turns on only when the request asks to be questioned.
Items gained a `seams` field (`state add --seam`, `state set --seam`, `--clear seams`).

**Rounds: 3**, recorded in the `review-r3` decision row.
- Round 1, rejected: a partly answered fork list could be marked answered, depending on the
  order of two commands, and the item then reached `in_progress`.
- Round 2, rejected: "reversible" and "product fork" overlapped, and in 2 of 4 live runs the
  agent decided a user-visible pricing choice itself and launched the implementer.
- Round 3, approved: `review_intake-step_r3.md`, `live-verified` at `ebf8757` by reviewer.
  Three under-specified requests parked their open choice and asked once; two fully specified
  requests parked nothing and reached `in_progress` within 41 s; fresh sessions picked up a
  parked item from the `current.md` note.

**Measured.** Every review ran headless `claude -p --plugin-dir .` sessions, the first time this
program saw the plugin really loaded. Intake on an unmodified request: 3 tool calls, about 22 s,
0.22 USD up to `state add`. Commit and investigate requests skip it without reading the
reference.

**Accepted limits.** A request that says nobody will answer makes the agent take forks and record
them as reversible: item 72, which carries a fork for the user. The rule on where `--resolves`
goes is not in context when a fresh session answers a fork, Closing a session can erase the
parked-fork note, and nothing executable pins the router step, the header or the licences: item
73. Agents trip on the state CLI (`state show` does not exist): item 74.

**Outside the item.** `main` was pushed on 2026-11-17 at `b9a12f7` after the user's standing
yes; CI run 44045047755 was green on `test` and `oldest-node`, the first CI run since
2026-08-24. Suite: 529 tests at the start of the item, 542 now.

## 2026-11-17 — item 56 test-first-reference, closed

**What changed.** A new internal skill, `skills/test-first/SKILL.md` (61 lines,
`user-invocable: false`), holds the test-first reference: what a good test is (from
`mattpocock/skills` tdd), the loop of one slice at a time with the red output pasted in the
report (from `obra/superpowers` test-driven-development), seams taken from the item and never
confirmed with the user, refactoring left to review, and the mutant check before reporting. It
carries an origin header for both sources. `agents/implementer.md` preloads it through
`skills: [test-first]`; `feature.md` has a test-first step before delegation; the router's
Delegation list names the seams. No code changed and no hook was built.

**Rounds: 1.** Approved: `review_test-first-reference.md`, `live-verified` at `d13d100` by
reviewer. The preload was proved with a control: with the plugin loaded the implementer quoted
two sentences of the reference with no tool call, and with the `skills` line removed in a clone
it answered `NO REFERENCE IN CONTEXT`. So claude-code issue 25834 does not bite on claude
2.1.326 with the bare name `test-first`; the documentation does not state the name form, so this
is empirical. In a live `/mstack` run the brief carried the seams as pre-agreed and the
implementer showed red for the expected reason, then green, then killed its mutants.

**Measured.** The preload costs about 1.7k tokens per implementer start (8043 against 6309
subagent tokens for the same task). The review's six headless runs cost 3.86 USD.

**Accepted limits, all added to item 73.** `feature.md` points at `mstack state active` for the
seams, which prints only the slug; nothing moves an item to `in_progress` after intake's
`state add`, and two coordinators guessed `--status active` first; one sentence of the reference
is false inside a consumer project; a delegated refactor is not exempted in so many words; lint
does not catch a misspelled `skills` entry or a skill that blocks model invocation, either of
which silently removes the reference.

**Session tally, 2026-11-17.** Closed: 55 in 3 rounds, 56 in 1. Filed: 72, 73, 74. Suite: 542
tests, green on both runtimes. `main` pushed twice with CI green on `test` and `oldest-node`.
Phase 1 of the program (front end) is closed.

## 2026-11-17 — item 73 intake-followups, closed

**What changed.** The loose ends of items 55 and 56, twelve criteria. Lint gained three rules:
the router must link `references/intake.md` from its orient steps, every origin header in a
skill or agent file must name a licence file that ships under `licenses/`, and each agent
`skills` entry must name a skill of this plugin that does not block model invocation. Intake's
End now moves the item on after `state add` (`in_progress` on the direct path, `specifying` on
the spec path, by the triggers of the router's "The two paths"). The fork test is stated once,
in intake's Map; its reach is what the product's user can do or gets, and message wording,
labels and formatting are not forks. The note intake leaves in `current.md` for a parked fork
carries the whole answer rule as commands, so a session that skips intake can act on it. The
router's step 2 reads `current.md` whenever it is not the empty template, Closing keeps a note
that records a parked fork, and `feature.md` says where seams are read and asks for the first
test red. The test-first skill lost a sentence that was false in a consumer project and gained
the delegated refactor.

**Rounds: 2.**
- Round 1, rejected: a regression made in the same round. The note carried only the
  full-answer half of the rule, and 0 of 3 fresh partial-answer sessions re-stated the field,
  against 3 of 3 at the base.
- Round 2, approved: `review_intake-followups_r2.md`, `live-verified` at `f6469da` by reviewer.
  Three partial answers in fresh sessions, worded three ways, each wrote a plain row and
  re-stated only the open forks; no session read `intake.md`.

**Measured (criterion 7), n=1 per arm.** The same request: answered forks then the spec path,
3.44 USD, 686 s, 41 turns, 4 subagent launches; direct path, 1.13 USD, 296 s, 15 turns, 2
launches. The rule was kept. Narrowing it is the user's call: item 75.

**Accepted limits.** Small notes of the approving review went to item 75; `--help` on the state
subcommands to item 74. Seen again and owned elsewhere: headless agents in a consumer project
add `Co-Authored-By` trailers (item 35), and `tests/costs.test.ts:698` failed once under load
(item 67).

**Session tally, 2026-11-17.** Closed: 55 (3 rounds), 56 (1), 73 (2). Filed: 72 to 75. Suite:
553 tests, green on both runtimes.

## 2026-11-17 — item 74 state-cli-ergonomics, closed

**What changed.** `mstack state show <ref> [--json]` prints one item with every field it
carries, unknown keys included; `--json` is the raw object, accepted before or after the ref.
`--help` and `-h` on `state add`, `state set`, `state show` and `decide` print that command's
flags from option tables in a new `src/cliopts.ts` that the parsers also read, so help and
parser cannot drift; `state --help` points at them. A value that starts with `--` is refused in
mstack's own words, the same on bun and node, naming the `--flag=value` form. `state set
--acceptance` that replaces existing criteria prints a line naming `--add-acceptance`.
`feature.md` and `agents/implementer.md` now name `state show` as the way to read seams.

**Rounds: 2.**
- Round 1, rejected: on a store where two items share an id, `state show <second-slug>` printed
  the first item at exit 0.
- Round 2, approved: `review_state-cli-ergonomics_r2.md`, `live-verified` at `a5030ee` by
  reviewer. `state show` refuses an item whose id another item shares, the way the writers do.
  Ten duplicate-id stores on bun, node 26 and node 22.6: every shared-id item refused, every
  unique one printing itself; at the round 1 head the same calls answered for the wrong item in
  8 of 10 stores. A 109-command matrix of existing commands differs only where the item asked.

**Accepted limits, added to item 68.** `state show` on a shared slug still prints the first
item; `updateState` copies unknown keys between duplicates on a duplicate-id store (both
unchanged from before); a done duplicate and `state --help` writing nothing are unpinned; the
docs do not mention the refusal. `decide --decision=--z` is stored as `'--z` by the older
formula guard in `src/tsv.ts`; nothing reads that field, and the wiki sentence was corrected.

**Session tally, 2026-11-17.** Closed: 55 (3 rounds), 56 (1), 73 (2), 74 (2). Filed: 72 to 75.
Suite: 529 tests at the start of the day, 592 now, green on bun, node 26 and node 22.6.

## 2026-11-17 — item 57 deep-module-vocabulary, closed

**What changed.** `skills/design/references/deep-modules.md` (40 lines) holds the deep-module
vocabulary adapted from `mattpocock/skills` codebase-design: module, interface, depth, the
deletion test, the interface as the test surface, seams and adapters, the dependency
categories. It is vocabulary and contains no procedure. The design skill points at it and
defines each term once. `design` is a review lens: a reviewer given it reads the reference
through `${CLAUDE_PLUGIN_ROOT}`, and a reviewer without it never does. A new playbook,
`skills/router/playbooks/deepen.md` (56 lines), is routed from "review the architecture": it
skips intake, finds candidates with the vocabulary, keeps at most five, re-derives every count,
file, line and function by search just before filing, files each with `state add`, asks the user
nothing and implements nothing.

**Rounds: 4**, recorded in the `review-r3` and `review-r4` decision rows. The product was sound
from round 2; three rounds were about the truth of what the playbook filed on this repository.
- Round 1, rejected: four of the five filed items (76 to 80) stated something false about the
  code, such as nine git call sites where there were more, and a switch that does not exist.
- Round 2, rejected: the corrections introduced new false statements. The playbook gained its
  check before filing, which took three wordings and then held on the reviewer's two runs: six
  items, every claim true.
- Round 3, rejected: 76 of 78 assertions true; item 79 treated two dirty checks as one question,
  while `worktree.ts` `isDirty` includes ignored files on purpose.
- Round 4, approved: `review_deep-module-vocabulary_r4.md`, `test-verified` at `d3122c2` by
  reviewer. Item 79 dropped the dirty state; 34 assertions re-derived.

**What the rounds showed.** An agent that files work items states counts and line numbers it has
not checked, and correcting them by rewriting adds new ones. What worked was stating less:
every assertion kept only with the command that shows it, re-run after the edit. Round 3 was
written by Opus and reviewed by Opus in a fresh context; round 4's edit was made by the
coordinator and only deleted claims.

**Measured.** A deepen run costs about 1 USD and two to three minutes. On a queue that already
holds the candidates it files nothing (0.33 USD).

**Filed.** Items 76 to 80 from the playbook; item 81 `cli-help-everywhere` from what the runs
found beyond them. A third further candidate, the report filename grammar with no builder, is
true by the round 2 review and left for the next deepen run to file with its own check.

**Session tally, 2026-11-17.** Closed: 55 (3 rounds), 56 (1), 73 (2), 74 (2), 57 (4). Filed: 72
to 81. Suite: 529 tests at the start of the day, 592 now, green on bun, node 26 and node 22.6.

## 2026-11-18 - item 58 glossary-and-adr closed (4 rounds)

`GLOSSARY.md` (14 terms), `docs/adr/0001-claude-code-only.md`, the format reference
`skills/reflect/references/domain-docs.md`, and a gate check for the glossary's entry format
(`src/glossary.ts`, wired in `src/gate.ts`). Intake and `understand` read the glossary; a term or
an ADR is written before the review of the item that introduced it.

- Round 1, rejected: six blocking findings. The coordinator's brief had invented a trade-off for
  the ADR, and the implementer wrote "worked on for two months" where the record says a two-month
  pause; two glossary entries were wrong; the check failed hand-written glossaries.
- Round 2, rejected: glossary, ADR and criteria 1 to 3 sound. The check failed a repeated bold
  label (`**Example:**`) as a repeated term, and one bold line stopped a heading-per-term file
  from being read.
- Round 3, rejected: the code matched the decided design in 77 cases; two docs said a bold label
  anywhere under a term heading belongs to it, which the label-first layout contradicts.
- Round 4, approved: `review_glossary-and-adr_r4.md`, `test-verified` at `af2edff` by reviewer.
  Two doc sentences, written by the coordinator, each clause checked against `readGlossary`.

**What the rounds showed.** A format check on free-form Markdown has no rule that reads every
hand-written layout; each round found a new one. What ended it was one stated rule (a bold line
inside an entry belongs to it), the limits written into the docs, and the rest filed. The ADR
states only what the record shows and gives no reason for the decision; that is the user's to add.

**Closing.** `gate --full` was red four times before it was green: once on
`tests/verdict-reader.test.ts` (about 6 s under load against bun's 5 s default; the coordinator
gave it a 60 s timeout, unreviewed, no assertion changed) and three times on
`tests/costs.test.ts:743` in node at load average 19 to 24 from processes outside this work. It
passed on the next run with nothing changed. Both are now in item 67.

**Filed.** Item 82 `any-role-name-closes`; item 83 `glossary-check-followups` (the non-blocking
findings of rounds 2 to 4); two criteria added to item 67.

## 2026-11-18 - item 59 diagnosis-loop-in-bug-fix closed (3 rounds)

**What shipped.** `skills/router/playbooks/bug-fix.md` steps 1 and 2 carry the loop-first
procedure from mattpocock/skills `diagnosing-bugs` (origin header, pinned sha): build one command
that goes red on the symptom before reading code for a theory, then three to five ranked
hypotheses with predictions, or `skip: cause shown by the loop, <file>:<line>` when the loop
already shows the cause at one line. `lint-plugin` requires the header on that file. The procedure
was run on item 21: 19 serial and 60 parallel full-suite runs. Nothing is identified for the
August failure and neither hang reproduced; three of five hypotheses were refuted against
predictions written before the runs, and two tests not on item 67's list were seen timing out at
bun's 5 s default beside other suites (`tests/gate.test.ts:681`, `tests/launcher.test.ts:55`).

**What the rounds taught.** Round 1's diagnosis ran the suite serially while the step it was
following says to raise the rate; a procedure run on a real item is the check that its own text is
followed. Twice a sentence about `tests/costs.test.ts:732-733` was false (measured once; the max
smooths): a mechanism sentence needs the lines read, not recalled. The live headless run (n=1 per
round) wrote the skip line with the right location in round 2 and committed the red test before
the fix in both rounds; in both it searched the code in the same call that read the playbook.

**Closing.** `gate --full` was red three times on `tests/costs.test.ts:698` in node at load
average 19 to 23 from processes outside this work, and green on the fourth run with nothing
changed (bun 631/0, node 631/0). Round 3's edits were made by the coordinator and read by a fresh
reviewer.

**Filed.** Item 84 `redact-secrets-in-pasted-evidence`; item 85 `bug-fix-loop-followups`; three
criteria added to item 67, which goes next because this is the second closing it has held up.

## 2026-11-18 - item 67 load-sensitive-tests closed (3 rounds)

**Why now.** `tests/costs.test.ts:698` held up the closing gates of items 58 and 59 (three red
runs of four each) and failed CI on `main` at `5c05f6c` in `oldest-node`, twice with the same
figures (94.5 against 37.0 ms; 91.4 against 37.5 ms).

**What shipped.** The Stop budget test compares the test process's CPU time, the slowest of five
alternating runs per side, under 20 ms, with a new in-process bound on the Stop path without its
gate; wall time is printed, not asserted. `tests/run.test.ts:54` gives its command a temp
directory of its own. The citation gate test and the hostile-stdin launcher test have timeouts
sized from runs under load (35 s, 10 s). `scripts/load/` holds the harness: rounds of four bun and
two node suites under a watchdog, and a table of failures per test. `tests/run.test.ts:239` and
`:154` moved to item 86: their red is a pid alive after the signal, which may be the code's.

**What the rounds taught.** The remedy decided up front (best of five in wall time) still failed
under load; the gate's git children swing a single run by hundreds of ms, and only CPU time of
the process is free of that. Best-of-N then hid a read made on some Stops (two mutants green 18
of 18): the mutant table has to include the defect the new statistic is blind to, and the slowest
run is the bound. A figure measured on two runtimes was written as a fact and was false on the
two CI runs; the comment now names runtimes.

**Not shown.** Why CI's `oldest-node` had a steady gap: no local run on node 22.6 reproduced it.
The rounds ran on a machine less loaded than during the item 21 diagnosis (bun suites 150 s
against 405 to 428 s), so they do not exercise the old 5 s timeouts.

**Closing.** `gate --full` green on the first run (bun 631/0, node 631/0). Round 3's edits were
made by the coordinator and read by a fresh reviewer. Item 21's description carries the result; it
stays open on the two hangs.

**Filed.** Item 86 `run-survivor-checks-under-load`; item 87 `stop-budget-test-followups`.

## 2026-11-18 - item 61 verify-claim-gate closed (1 round)

**What shipped.** The evidence ladder has a section "Between the run and the claim": name the
command that proves the claim, run all of it now at this head, read the whole output with its exit
code and counts, check it against the claim as worded, only then state the claim or what the
output shows. Steps 3 and 4 of the verify skill carry the same moves in short. Both files have an
origin header to obra/superpowers `verification-before-completion` at a pinned sha and are in
`ORIGIN_REQUIRED`. No new stop and no question.

**Evidence.** One live headless run (n=1, 12 turns, 0.34 USD, 77 s) on a commit whose tests pass
while the reported CLI bug still reproduces: the session ran the real repro and the suite at HEAD,
rejected a pasted older green run, wrote that a green suite does not prove the bug fixed, and
recorded `verifier-failed`. The old text was not run against the same state (the reviewer's second
run was denied by the permission classifier and not retried), so whether the text changed the
reply is not shown.

**Closing.** `gate --full` green on the first run (bun 631/0, node 631/0). First item of the
program to close in one round.

**Filed.** Item 88 `verify-claim-gate-followups`.

## 2026-11-18 - item 62 review-findings-verified-first closed (2 rounds)

**What shipped.** `agents/implementer.md` has a section "A later round": read the review, check
each finding against the code at head before acting, fix what holds, and for one that does not
hold change nothing and record a `mstack decide` row listed in the report under "Findings not
applied"; a real defect whose proposed fix would break something is fixed another way. An unclear
finding takes the reading the code supports. `agents/reviewer.md` reads those rows and judges
each rebuttal on its evidence. Origin header to obra/superpowers `receiving-code-review` at a
pinned sha; `agents/implementer.md` is in `ORIGIN_REQUIRED`. Nothing asks the user.

**What the rounds taught.** The header said every ask in the source became a decide row; one of
six did. A summary clause over a source ("every place it asks") is a claim per place, and only a
per-place list survives a reviewer with the source open. The live run (n=1) did what the text
says, but the coordinator had already ruled on both findings in the brief, so it does not show
the implementer checking on its own.

**Closing.** `gate --full` green on the first run (bun 631/0, node 631/0). Round 2's edits were
made by the coordinator and read by a fresh reviewer.

**Filed.** Item 89 `later-round-followups`.

## 2026-11-18 - item 64 plans-for-a-contextless-executor closed (2 rounds)

**What shipped.** Section 4 of the spec skill has two rules for `tasks.md`: size (the smallest
unit with its own test cycle that is worth a fresh reviewer's gate; setup and docs fold into the
task that needs them; split only where a reviewer could reject one and approve its neighbour) and
no context (exact paths, the exact command and what it prints, no placeholder, no undefined
name). `agents/spec-author.md` carries both in short because it does not preload the skill;
`agents/spec-reviewer.md` checks both; the orchestrate playbook defines a unit by the size rule
in step 1 and bans placeholders in step 5. Origin headers to obra/superpowers `writing-plans` at
a pinned sha on three files, all in `ORIGIN_REQUIRED`.

**Evidence.** One live spec per side. With the rule: 3 implementation tasks, each with paths,
command and expected output; the spec-reviewer rejected round 1 over an undefined name and
approved the revision. At the base sha: 14 tasks, tests split from code, no commands. The new
run's coordinator brief already asked for paths and commands, so the difference is not isolated.
The reviewer found an expected output the spec-reviewer missed (`status: closed` for `done`).

**What the rounds taught.** The header and the changelog named a step the diff never touched.
A location claim ("in steps 1 and 2") is checked against the diff, not against the plan.

**Closing.** `gate --full` green on the first run (bun 631/0, node 631/0). Round 2's edits were
made by the coordinator and read by a fresh reviewer. Phase 2 is done except item 60, which waits
on the user's yes to open a real PR.

**Filed.** Item 90 `task-sizing-followups`.

## 2026-11-18 - item 39 role-models closed (2 rounds)

**What shipped.** `agents/implementer.md` and `agents/spec-author.md` declare `model: sonnet`;
`agents/reviewer.md` and `agents/spec-reviewer.md` declare `model: opus`; the orchestrator stays
`inherit`. `lint-plugin` refuses a model outside `inherit`, `sonnet`, `opus`, `haiku`, `fable` or
a `claude-*` id and names the file and the value. The router, review and design skills say what
the pin gives (the review is a different model from the implementation) and what it does not
(two lenses of a panel are the same model). The wiki shows each agent's model.

**Evidence.** Two live runs: with the session on Opus the implementer ran on Sonnet; with the
session on Sonnet the reviewer ran on Opus. No Agent call passed a model. First phase 3 item.

**What the rounds taught.** "A missing line means inherit" was written from a docs page read to
100,000 of 116,000 characters and was false: the frontmatter value, inherit included, ranks above
`CLAUDE_CODE_SUBAGENT_MODEL`, and a missing line ranks below it. A precedence claim is quoted
from the page, not paraphrased.

**Closing.** `gate --full` green on the first run (bun 634/0, node 634/0). Round 2's edits were
made by the coordinator and read by a fresh reviewer. A stray `current.md` from the reviewer's
live run is left under `/private/tmp/claude-501/` outside any project; its removal was denied to
the reviewer and not retried.

**Filed.** Item 91 `role-models-followups`.

## 2026-11-18 - item 40 item-fields-base-size closed (2 rounds)

**What shipped.** An item carries `size` (`s`, `m`, `l`; absent reads as `m`; an invalid value
is refused) and `base` (the commit HEAD was at on its first move to `in_progress`; changed with
`--base`, never cleared). The gate measures an active size-s item: code files under the store's
root, base or fork point to working tree, more than 60 changed lines or 3 files fails with a fix
naming `--size m`. `sdd` with size s is refused in either order. New module `src/size.ts`; 64
tests in `tests/item-size-base.test.ts`.

**What the rounds taught.** The design row said "from base", and a reviewer rebased: five files
landing on main turned a 10-line item into 210 lines with advice to re-size. A measurement
against a recorded commit has to say what happens when history moves under it; the rule now
takes the later of base and the point where the branch left the default branch, and the line
names the commit it used. The implementer departed from the brief (local and origin main
together, not local first) and was right: after `fetch` and `rebase origin/main` local main is
behind. One false red is left and documented: a base on the branch itself with main merged in.

**Incident.** The round 1 reviewer's probe script broke on a zsh alias and its commands ran in
this checkout: two commits on the item's branch, `.gitignore` replaced, `README.md` overwritten,
14 files written. It undid all of it; the coordinator checked that tracked files matched the
reviewed head, that the ignored directories were present and that nothing was pushed. The two
commits remain in the reflog. Briefs now require probes in `bash` script files with a checked
`cd` into the scratch directory.

**Closing.** `gate --full` green on the first run (bun 698/0, node 698/0).

**Filed.** Item 92 `size-check-followups`.
