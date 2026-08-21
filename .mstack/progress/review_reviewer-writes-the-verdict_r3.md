# Review - reviewer-writes-the-verdict (round 3)

**Verdict:** APPROVED

Both round-2 blockers are fixed, and fixed at the root rather than papered over. The paragraph
that was wrong twice now makes no causal claim at all, which is the only way it could stop being
wrong. The record rule classifies all 23 real review filenames correctly, including the case
that decided round 2. Three non-blocking notes at the end; none is a false statement and none
needs a fourth round.

I applied the rule to my own path and it was not ambiguous. That is the first real test of it,
and it passed - see "The row this review typed".

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| reviewer.md instructs its own row | none, correctly | Prose; no test can fail on it, and `impl_...md:28-31` says so rather than inventing one. Rung 3 read-back, rung 5 that the instruction executes end to end (this pass). |
| consistent with review/ship/verify | none | Prose. Cross-checked by hand and by transcribing the rule to code, below. |
| a Write-less reviewer can record | none | Rung 5, now four independent times: implementer's probe, and this reviewer in rounds 1, 2 and 3. |
| lint-plugin passes, frontmatter unchanged | `./bin/mstack lint-plugin .` | Rung 4, re-run here; frontmatter proven byte-identical to `main`. |

`git diff main...HEAD --name-only -- src/` returns **0 files**: the branch has never touched
code, so no test could have been weakened and none was. Suite count unchanged at 258 in both
runtimes across all three rounds.

## The two round-2 blockers

**R2-1 - the causal clause.** Struck in both documents with nothing put in its place.
`agents/reviewer.md:94-95` and `skills/review/SKILL.md:52-54` now end at "it is not itself a
gate." I read it adversarially (item 5 below) and it asserts nothing false. The
`decisions.tsv` row at `2026-08-21T17:58:16.373Z` states the principle explicitly - "A third
causal sentence would be a third guess" - and records that the implementer reproduced the
`reviewing -> verifying -> done` walk independently, matching my round-2 probe. Correct
disposition, and the right lesson drawn rather than the narrow one.

**R2-2 - the suffix rule.** Fixed, and the fix reaches further than the finding did. The record
rule became a shape grammar (`:76-79`), and `:42-49` gained the matching filename grammar so a
solo later round writes `review_<slug>_r<N>.md` instead of overwriting round 1 - which was the
latent overwrite bug my finding only glanced at. I verified the choice of rule rather than
inheriting it (item 2 below).

## Judged, one at a time

**1. Is the record rule correct on every real name?** Yes. I did not inherit the 12/10/1: I
transcribed `agents/reviewer.md:76-79` into code (`scratchpad/r3rule.mjs`, the four sentences
as four branches) and ran it over every `review_*.md` in `.mstack/progress`, taking slugs from
`state.json`. Independently reproduced: **23 files -> 12 record, 10 lens, 1 unclassified.**

The case that decided round 2 comes out right:

```
review_verification-never-runs_r4.md   slug=verification-never-runs   alone (round marker) -> RECORDS
review_readme-and-wiki_r2-facts.md     slug=readme-and-wiki           lens -> records nothing
review_statusline_robustness.md        slug=statusline                lens -> records nothing
```

`_r4` records, which matches `.mstack/ledger.tsv:30` - the solo round-4 row that actually closed
item 14 and that the round-2 rule would have suppressed. The composed `_r2-facts` reads as a
lens. And `_robustness` reads as a lens rather than a round, because the grammar requires `r`
followed by *digits*; a lens whose name merely starts with `r` is safe.

**On `review_session_thesis.md`.** I tested the judgement rather than accepting it, and it holds
for a stronger reason than the one given. The coordinator's argument was that a reviewer always
knows its own slug. True, but the load-bearing fact is that the strip can never be ambiguous,
because `src/state.ts:61` refuses any slug that is not "lowercase words joined by hyphens".
Proven live:

```
$ mstack state add --slug widget_r2 --title t --acceptance a
mstack: 'widget_r2' is not a usable slug
        lowercase words joined by hyphens; it names the branch, the spec directory and the progress files
$ mstack state add --slug thing_correctness --title t3 --acceptance a
mstack: 'thing_correctness' is not a usable slug
```

A slug cannot contain `_`. So for any reviewer holding its own slug, everything after
`review_<slug>` is suffix and never more slug, and the strip at `:76-77` is total rather than
heuristic. The one unclassified row is an artifact of *my scanner* not knowing the slug set -
`session` was never an item - not of the rule. A reviewer is never in my scanner's position. No
hole.

**2. Is the new filename grammar safe?** Yes, and it does not reintroduce round 1's failure
mode. "the first `N` from 2 upward whose file does not exist" only ever writes to a name that is
absent, so unlike the rule it replaces it *cannot* destroy a previous round's report. Silent
loss is not reintroduced; that is the important half of the answer.

The residual hazards are all mislabels, and all detected:

- *Two racers.* Requires two solo reviewers of one slug concurrently. A solo round is by
  definition one reviewer, and `.mstack/state.json` allows one active item per worktree with
  the gate enforcing it. Not reachable through the sanctioned flow.
- *Crash after choosing, before writing.* The file is still absent, the next reviewer picks the
  same `N`. Benign.
- *Crash after writing a stub.* This one is real and worth knowing: existence and the report
  contract use different thresholds. A 9-byte stub occupies the name but fails
  `MIN_REPORT_BYTES` (`src/roles.ts:64`), so the next solo reviewer takes `_r3` and the round
  numbers skew by one. It is caught, not silent:

  ```
  -- a crashed 9-byte stub at _r2 --
  [fail]  r2 wrote a stub, not a report
          fix: an empty file is indistinguishable from no work
  -- a substantial report at the same name --
  [ok]    r2 -> review_widget_r2.md (92 bytes)
  ```

So: the same hazard class moved from "destroys a report" to "may misnumber a round, visibly".
That is a strict improvement, not a hazard moved sideways.

I also confirmed the new shape does not break the machinery that already existed for reports:
`mstack fanout check --kind review --worker r2` resolves `review_<slug>_r2.md`, and the
`SubagentStop` hook exits 0 against it. The `_r<N>` name is a first-class report path, not a
name the tooling merely tolerates.

**3. Does anything contradict?** No. The filename rule at `:42-49` can produce exactly four
shapes; I ran all four through the record rule at `:76-79`:

| Produced by `:42-49` | Read by `:76-79` | Agree |
|---|---|---|
| `review_<slug>.md` (alone, round 1) | alone -> records | yes |
| `review_<slug>_<lens>.md` (lens, round 1) | lens -> records nothing | yes |
| `review_<slug>_r<N>.md` (alone, round N) | alone -> records | yes |
| `review_<slug>_r<N>-<lens>.md` (lens, round N) | lens -> records nothing | yes |

The two halves are exact inverses of each other with no gap and no overlap.

*The ladder residue is fixed.* Round 2 flagged that the table mixed two keys and that row 4 read
unconditionally. The whole first column is now outcome-shaped - "What happened", with "The claim
held at rung 5 / at rung 4", "Rungs 2-3 only", "Could not run the check at all", "Ran it and the
claim failed" (`evidence-ladder.md:35-41`). "The claim held at rung 4" no longer matches a
reviewer whose claim failed, so the paragraph at `:43-45` is now reinforcing the table rather
than correcting it. This also retires my round-2 note about sentence 1 being universal while
sentence 2 is reviewer-specific: with the table keyed on whether the claim held, the universal
sentence is consistent with every role that records. Finding 4 is fully closed.

**4. Acceptance bullets, against the round-3 text.**

**"`agents/reviewer.md` instructs the reviewer to record its own verdict row, with the verifier
column set from its own role"** - met, and now it fires on every shape a solo reviewer can be
handed rather than only the first round. `:75-79` removes the judgement and gives the shape
test; `:81` "Reviewing alone, in any round, type your own ledger row, through Bash"; `:83` the
command ending `--verifier reviewer`; `:85` "The verifier column is your own role". The round-2
caveat on this bullet - that the instruction failed to fire for 5 of the repo's 22 solo later
rounds - is gone, verified by the classification run above.

**"The change is consistent with `skills/review/SKILL.md` and with the ship and verify skills,
so no two documents give conflicting instructions about who records"** - met. `skills/review/
SKILL.md:40-43` mirrors the alone branch and keeps the no-row remedy; `:44-48` the panel branch;
`:52-54` matches `agents/reviewer.md:94-95` clause for clause. `skills/verify/SKILL.md:17` and
`skills/ship/SKILL.md:31` stay generic and agree. `README.md:103-104` and
`docs/wiki/Getting-Started.md:233-243` still narrate a `--verifier reviewer` row.

**"Whether a reviewer with no Write tool can record at all is established by evidence rather
than assumed, and if it cannot, the item says what does close the gap instead"** - met, rung 5,
and this pass is the fourth instance. `agents/reviewer.md:4` gives me `Read, Glob, Grep, Bash`
and no `Write`; this file is a Bash heredoc and the row below went through the CLI.

**"`lint-plugin` still passes and the agent frontmatter contract is unchanged"** - met.
`./bin/mstack lint-plugin .` exits 0, 0 failures 0 warnings, `[ok] agents/reviewer.md`.
`diff <(git show main:agents/reviewer.md | head -7) <(head -7 agents/reviewer.md)` is empty.
`git diff main...HEAD --name-only -- src/` is empty, so no contract anywhere in code moved.

**5. The paragraph that has been wrong twice - read adversarially.** "The row is the typed
record of your rejection, carrying your report as its evidence; it is not itself a gate."

Clause by clause: *the typed record of your rejection* - true, `verifier-failed` is the enum
member for a failed claim. *carrying your report as its evidence* - true, `--evidence <the
report path you wrote>` at `:83`. *it is not itself a gate* - true, and the one I attacked
hardest in rounds 1 and 2; the row is an input to `checkClosedItems`, not a check.

No causal sentence remains, so there is no mechanism to be wrong about. The strongest objection
I can raise is an implicature rather than an assertion: "not *itself* a gate" faintly suggests
something else is one. But the sentence names nothing, and a reader cannot act on an
unstated mechanism - which is exactly the difference from rounds 1 and 2, where the reader was
handed a specific false mechanism and told to rely on it. I do not think a fourth round is
warranted for a word. One omission is worth recording, at 6 below, but it is an omission and not
a promise.

## Verification I ran

```
$ npm test
 258 pass / 0 fail                                                    # bun, 14 files
ℹ tests 258 / pass 258 / fail 0 / cancelled 0 / skipped 0 / todo 0    # node --test
exit=0

$ npm run typecheck
> bunx --bun tsc --noEmit
exit=0

$ ./bin/mstack lint-plugin .
-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts
PASSED - 0 failures, 0 warnings

$ ./bin/mstack gate
[ok]    one active item: reviewer-writes-the-verdict (reviewing)
[ok]    14 closed item(s) carry a ledger verdict
[warn]  1 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 1 warning
```

The warning is `.mstack/state.json` mid-session, not a clean-tree failure.

Probes, all driving the shipped `./bin/mstack` as a real process, in scratch stores under
`scratchpad/r3slug` and `scratchpad/r3rule.mjs`: the classification run over all 23 real
filenames; the two slug refusals; `fanout plan --worker r2`; the stub/substantial `fanout check`
pair; the `SubagentStop` hook against a `_r2` report.

## Non-blocking

6. **`agents/reviewer.md:77-78` reserves `_r<digits>`; `skills/review/SKILL.md` step 2 does
   not.** The reservation is stated in the file that *parses* the name and not in the file that
   *hands names out*, and nothing enforces it:

   ```
   $ mstack fanout plan --kind review --worker r2 --worker correctness
     r2           .../progress/review_widget_r2.md
     correctness  .../progress/review_widget_correctness.md
   ```

   A lens handed `review_widget_r2.md` applies `:76-79`, reads `_r2` as a round marker,
   concludes it is alone, and records - a lens recording, which is the unsafe direction the
   carve-out at `:99-102` exists to prevent. Zero of the 23 real files hit this and it takes a
   deliberately odd worker name, so it is not blocking. But the implementer's own decision row
   at `2026-08-21T18:01:44.417Z` names the residual ("a lens deliberately named r<digits> or
   r<digits>-x would misparse, so that shape is reserved"), and the reservation did not travel
   to where lens names are chosen. One clause in `skills/review/SKILL.md` step 2 - a worker name
   may not be `r<digits>`, that shape is reserved for round markers - closes it in prose.
   Teaching `mstack fanout plan` to refuse the name would close it in code and is a candidate
   item, not this one's scope.

7. **"it is not itself a gate" is true but understates.** Until item 18 lands, the row is not
   merely non-gating: it *positively satisfies* the no-self-approval audit, because
   `src/gate.ts:373` needs only `rows.some(canCloseAnItem)` and `reviewer` qualifies. Recording
   a rejection is what makes a `done` item pass a check it would otherwise fail - proven at rung
   5 in round 1. "Not itself a gate" reads as "inert", and the row is not inert. Saying so is
   optional and arguably belongs with item 18's fix rather than in front of it; I raise it only
   so a fourth round does not rediscover it as new.

8. **Round-numbering is by filename, not by content.** Nothing checks that
   `review_<slug>_r3.md` says "round 3", and nothing checks that rounds are contiguous. A
   deleted `_r2` makes the next reviewer reuse `_r2`. Harmless today because each report states
   its own round in its heading, and worth nothing more than knowing.

## The row this review typed

The coordinator asked whether applying the rule to my own path is ambiguous. It is not, and
that is the substantive result of this round. Executing `:76-79` on myself:

```
path   review_reviewer-writes-the-verdict_r3.md
slug   reviewer-writes-the-verdict
strip  "review_reviewer-writes-the-verdict" and ".md"   ->  "_r3"
match  "_r3" is a leading r<digits> and nothing follows ->  only a round marker
read   "Nothing left, or only a round marker such as `_r2`: you are reviewing alone"
so     reviewing alone, in any round -> I record
```

One reading, reached mechanically, no override needed. Contrast round 2, where the rule told me
to record nothing and I had to reason past it from the rationale to get to the right answer.
That is the difference between a rule and a hint, and it is the thing this round actually fixed.

Verdict APPROVED, so per `:90-91` the row carries the rung my run reached rather than the tone
of this report. Recording `live-verified`, and stating what it was run on as `:16-21` of the
ladder requires: I reproduced the item's central mechanism in the running system - a reviewer
classifying its own handed path and typing its own row - by being that reviewer, and I drove the
real `./bin/mstack` through the rule's edges (slug refusal, `fanout plan`, `fanout check`, the
`SubagentStop` hook). What I could *not* run is the prose itself; the classification pass ran my
transcription of `:76-79`, not the sentences, and a transcription can differ from its source.
That claim is rung 4 against a transcription and I am not dressing it as more.

## Where this stopped on the ladder

Rung 5, running system, for: the slug grammar refusing `_` (`src/state.ts:61`, two live
refusals), `fanout plan` allocating a round-shaped worker name, `fanout check` separating a stub
from a report, the `SubagentStop` hook accepting a `_r<N>` path, and this pass performing the
instruction end to end. Rung 4 for the classification of all 23 real filenames - a real run over
real artifacts, against a transcription of the rule, which is the caveat above. Rung 4 for `npm
test`, `npm run typecheck`, `./bin/mstack lint-plugin .` and `./bin/mstack gate`, re-run here
rather than inherited. Rung 2 for the four-shape agreement table, walked by construction from
`:42-49` and checked by execution.

Rung 3, read-back only, for whether the prose *means* what three rounds of reading say it means.
That is the standing hazard on this item and it does not go away by approving: no suite can read
an instruction file, which is why two green suites sat beside two false sentences. What changed
in round 3 is that the sentences left standing are the ones that were executed.

## Appendix: the recorded row

```
$ ./bin/mstack ledger record reviewer-writes-the-verdict "$(git rev-parse HEAD)" live-verified \
    --evidence ".mstack/progress/review_reviewer-writes-the-verdict_r3.md" --verifier reviewer
recorded live-verified for reviewer-writes-the-verdict at 112ffc3c

$ ./bin/mstack ledger check reviewer-writes-the-verdict
PASS live-verified at 112ffc3c by reviewer
EXIT=0
```

This is the first round in which `ledger check` passes at head on a row the reviewer typed
itself, under its own role, from a path it classified without help. That is the item's whole
thesis, executed rather than described.

Two things the next pass should expect rather than rediscover. This row goes stale the moment
it is committed, because the commit that carries it moves HEAD - item 19 owns that, and the
`PASS` above should not be read as durable. And the close it enables is still governed by
`src/gate.ts:373`, which item 18 owns; nothing in this round changed what a row does, only what
the documents claim it does.
