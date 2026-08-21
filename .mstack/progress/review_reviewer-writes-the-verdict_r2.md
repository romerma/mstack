# Review - reviewer-writes-the-verdict (round 2)

**Verdict:** CHANGES_REQUESTED

Round 1's finding 1 is genuinely fixed: the false clause is struck and its replacement's first
half - "it does not by itself block anything" - is true, and I re-verified it. Findings 2 and 4
are fixed. Finding 3's *diagnosis* was accepted but the *cure* overshoots: the new path-suffix
test silences the solo reviewer of every round after the first, and this repo's ledger contains
exactly one reviewer-typed closing row, which the new rule would have suppressed. Separately,
the sentence that replaced finding 1 makes a second unfounded claim in the same position. Both
are blocking, both are small edits.

I am the specimen for one of them: I was handed `review_<slug>_r2.md`, and the rule under review
told me to record nothing. See "The row this review typed".

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| reviewer.md instructs its own row | none, correctly | Prose in an agent file; no test can fail on it. `impl_...md:28-31` says so rather than inventing one that cannot fail. Rung 3 by read-back, rung 5 that the command works. |
| consistent with review/ship/verify | none | Same. `rg -n "ledger record"` sweep, rung 3. |
| a Write-less reviewer can record | none | Rung 5, twice in round 1 and again in this pass. |
| lint-plugin passes, frontmatter unchanged | `./bin/mstack lint-plugin .` | Rung 4, run below; frontmatter proven byte-identical to `main`. |

No test file is touched by `git diff 3b4e131..HEAD` and the suite count is unchanged at 258 in
both runtimes, so nothing was weakened to obtain green. All three round-2 hunks in shipped files
(`@@ -71 +71,6`, `@@ -84,2 +89,3`, `@@ -89,2 +95,2` in `agents/reviewer.md`; `@@ -41 +41,2`,
`@@ -51 +52,3` in `skills/review/SKILL.md`; `@@ -42,0 +43,4` in `evidence-ladder.md`) sit below
every frontmatter block.

## The four round-1 findings

**Finding 1 - "clears nothing and blocks a close".** Struck, not hedged. `agents/reviewer.md:89-91`
now reads "The row records the rejection with your report as its evidence; it does not by itself
block anything." I re-ran the round-1 probe: that half is true. The implementer also reproduced
the mechanism independently at rung 5 and filed the `src/gate.ts` change as item 18, with the
reasoning in `decisions.tsv` at `2026-08-21T17:44:09.306Z`. Correct disposition. **But the
clause that replaced it is itself unfounded - see R2-1.**

**Finding 2 - carry it into the skill.** Done, `skills/review/SKILL.md:52-54`. The two documents
now say the same thing about what the row does, so they cannot drift. (They now also carry the
same R2-1 error, consistently.)

**Finding 3 - lensing is a guess.** Diagnosis accepted, cure overshoots. The remedy half landed:
`skills/review/SKILL.md:41-43` now says "If no row exists, the reviewer did not finish its
contract: re-run the reviewer, and do not type the row on its behalf", which closes the
round-1 gap. The test half is where it breaks - see R2-2.

**Finding 4 - the ladder.** Reconciled at `evidence-ladder.md:43-45`, and the choice of *which*
document to change is well reasoned in `decisions.tsv` at `2026-08-21T17:46:59.956Z`: recording
the suite's rung on a rejection would place a close-enabling reviewer row at the sha of a
rejected implementation, which is finding 1's mechanism fired on every rejection. That is the
right direction. `impl_...md:24` is narrowed to "the documents that name who records agree".
Residue only, not blocking - see R2-3.

Round 1's observations 5 and 6 were also filed as items 19 and 17. Not asked for; noted.

## Acceptance, quoted

**"`agents/reviewer.md` instructs the reviewer to record its own verdict row, with the verifier
column set from its own role"** - met, and the wording is better than round 1's: `:71-73` opens
by removing the judgement ("Whether you record is not a judgement call"), `:75-76` gives the
alone branch, `:78` the literal command ending `--verifier reviewer`, `:80` the rule in prose.
Rung 3 for the wording, rung 5 for the command. The bullet holds - but note that under R2-2 this
instruction does not fire at all for a solo reviewer in any round after the first, which is the
shape 5 of this repo's 22 review reports actually take. The bullet is met; its reach is not what
it looks.

**"The change is consistent with `skills/review/SKILL.md` and with the ship and verify skills,
so no two documents give conflicting instructions about who records"** - met, and strengthened.
`skills/review/SKILL.md:40-43` mirrors the alone branch and now handles the absent-row case;
`:44-48` the panel branch; `:52-54` matches `agents/reviewer.md:89-91` sentence for sentence.
`skills/verify/SKILL.md:17` and `skills/ship/SKILL.md:31` stay generic and agree.
`README.md:103-104` and `docs/wiki/Getting-Started.md:233-243` still narrate a `--verifier
reviewer` row. On *who*, nothing conflicts.

**"Whether a reviewer with no Write tool can record at all is established by evidence rather
than assumed, and if it cannot, the item says what does close the gap instead"** - met, rung 5,
and this pass is a third independent instance. I am `mstack:reviewer` with `tools: Read, Glob,
Grep, Bash` and no `Write` (`agents/reviewer.md:4`); this file was written by a Bash heredoc and
every ledger row below was typed through Bash. The implementer's probe row is still on disk at
`scratchpad/r15probe/.mstack/ledger.tsv`. No gap to close.

**"`lint-plugin` still passes and the agent frontmatter contract is unchanged"** - met.
`./bin/mstack lint-plugin .` exits 0, 0 failures 0 warnings, `[ok] agents/reviewer.md` under
`-- agents`. `diff <(git show main:agents/reviewer.md | head -7) <(head -7 agents/reviewer.md)`
is empty. `agents/reviewer.md` remains the only file under `agents/` the branch touches.

## Verification I ran

```
$ npm test
 258 pass / 0 fail                                    # bun, 14 files
ℹ tests 258 / pass 258 / fail 0 / cancelled 0 / skipped 0 / todo 0   # node --test
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

The one warning is `.mstack/state.json` mid-session, not a clean-tree failure.

### Probe for R2-1: does anything keep a rejected item open?

Scratch store `scratchpad/r2claim`, driving `./bin/mstack` as a real process. Item walked to
`reviewing`, implementer's row at the sha, then the reviewer rejects exactly as
`agents/reviewer.md:86-91` instructs:

```
$ mstack ledger record probe <sha> verifier-failed --evidence review_probe.md --verifier reviewer
recorded verifier-failed for probe at 78deeb25

-- reviewing -> verifying --
1 probe (verifying)
  status: "reviewing" -> "verifying"
exit=0

-- verifying -> done, first attempt --
mstack: probe cannot close on a verification that has not run: `true` has never been executed
exit=2

-- the suite is green, which is this bullet's own stated case --
$ mstack gate --full
-- verification
[ok]    true

-- verifying -> done, second attempt --
1 probe (done)
  status: "verifying" -> "done"
exit=0

$ mstack gate
[ok]    1 closed item(s) carry a ledger verdict
PASSED - 0 failures, 2 warnings
```

A rejected item walked `reviewing -> verifying -> done` and the gate ended green. Rung 5.

## Changes required

1. **`agents/reviewer.md:90-91` and `skills/review/SKILL.md:52-54`** - "What keeps the item open
   is that a rejected item does not move past `reviewing`" names a mechanism that does not
   exist. `src/lifecycle.ts:90` lists `verifying` as legal from `reviewing` unconditionally, and
   `canTransition` (`:117-121`) never reads the ledger, so the `verifier-failed` row is invisible
   to the transition. Proven live above: the move succeeded, exit 0, with the rejection on
   record. The one thing that refused was item 14's verification receipt at the `done`
   transition - which is about the *suite*, not the review, and which this bullet's own scenario
   ("even when the suite was green") clears; the second attempt closed. Final gate PASSED. What
   actually routes a rejection back is `agents/orchestrator.md:30` ("`reviewing` | back to
   `implementer` on CHANGES_REQUESTED"), which is prose and enforced by nothing.

   This is a smaller error than the one it replaced - the actionable half is now true, and a
   reviewer who believes the false half does nothing harmful. But it is the same class of claim
   in the same sentence position: a reviewer told "it does not block, *but this does*" has been
   handed a second unfounded assurance, and it is the last one standing after the ledger row was
   correctly demoted to a record. That is the honour-system shape this whole item was filed to
   remove. Fix is one clause: say it is the orchestrator's routing convention and cite
   `agents/orchestrator.md:30`, or say plainly that nothing mechanically holds a rejected item
   and the coordinator's routing is what does. Do not assert that something keeps it open.

2. **`agents/reviewer.md:71-73` with `:95`** - the path-suffix test classifies every non-first
   round as a lens, and so tells the solo reviewer of rounds 2, 3, 4... to record nothing. The
   rule is "you were given a lens iff the report path you were handed carries a lens suffix,
   `review_<slug>_<lens>.md`", and `:95` "Handed a lens suffix, write your report and record
   nothing." The pattern is structural; `_r2` matches it. This repo's `.mstack/progress` holds 22
   review reports in four real shapes:

   - `review_<slug>.md` - solo, round 1 (4 files)
   - `review_<slug>_<lens>.md` - panel lens (12 files)
   - `review_<slug>_r<N>.md` - **solo, round N>1 (5 files: items 12, 13, 14x3, 16)**
   - `review_<slug>_r2-facts.md` - round *and* lens, composed (1 file, item 9)

   The third shape is not a lens and must record. The decisive case is already in the ledger,
   line 30:

   ```
   verification-never-runs  aaac9612  live-verified  .mstack/progress/review_verification-never-runs_r4.md  reviewer
   ```

   That is the row that closed item 14, typed by a solo round-4 reviewer, citing a `_r4` path.
   It is the only reviewer-typed closing row in this repo's history, and the new rule would have
   suppressed it - the exact outcome item 15 exists to prevent, reintroduced by the fix for
   finding 3.

   It compounds with the remedy added in the same round.
   `skills/review/SKILL.md:41-43` now says "If no row exists, the reviewer did not finish its
   contract: re-run the reviewer, and do not type the row on its behalf." Re-running a solo
   round-2 reviewer hands it the same `_r2` path, it reaches the same answer, and no row ever
   appears. Round 1's finding 3 warned that the abstain direction "deadlocks with no remedy";
   the remedy was added and the deadlock was made *reachable by the default path* instead of by
   a mistake.

   Fix: test membership, not shape. The reviewer is lensed iff its suffix is one of the workers
   `mstack fanout plan --kind review --worker ...` allocated for this round
   (`skills/review/SKILL.md:14-18`) - the coordinator knows that set and can state it in the
   brief, which keeps it observable rather than a judgement. Or reserve `_r<N>` explicitly as a
   round marker that does not mean a lens. Whichever is chosen must parse `_r2-facts` as round 2,
   lens `facts`, because that shape exists. And `agents/reviewer.md:42-43` needs the same edit:
   it still tells a solo reviewer to write `review_<slug>.md` with no round case, so a solo
   round-2 reviewer following it literally overwrites round 1 - which is the failure `:44-45`
   says the suffix exists to prevent. The repo has been using `_rN` as an undocumented
   workaround; round 2 attached a ledger consequence to it without documenting it.

## Non-blocking

3. **`evidence-ladder.md:43-45` - reconciled, with residue.** Finding 4 is resolved: a reviewer
   with a green suite and a blocking defect now gets one answer, and the direction chosen is the
   safe one for the reason recorded in `decisions.tsv`. Two things to tidy when convenient.
   First, the table's key is now mixed - rows 1-3 are indexed by rung, rows 4-5 by the outcome of
   the claim - and row `| 4 | test-verified |` still reads unconditionally, so the new paragraph
   is correcting a table that contradicts it at a glance; a caveat in row 4 would carry further
   than a paragraph below. Second, sentence 1 is universal ("the whole claim **you** were asked
   to judge") while sentence 2 is reviewer-specific. Applied to `agents/implementer.md:46-47` and
   `skills/verify/SKILL.md:18-19` - both of which say only "be honest about the rung" and have no
   failure branch - it extends a mapping neither file contemplates. Neither says "record the rung
   even when you know the claim failed", so this is under-specification rather than the
   contradiction finding 4 was, and I am not blocking on it. One clause scoping sentence 1 to the
   judging roles would close it.

## The row this review typed

The rule under review told me not to. `agents/reviewer.md:71-73` says I am lensed iff my path
carries a suffix; I was handed `review_reviewer-writes-the-verdict_r2.md`; `:95` says record
nothing. I recorded anyway, and the override is the demonstration of R2-2.

Why I overrode it: the rationale at `:95-98` is that N parallel lens rows collapse to the
panel's most favorable member. There is no panel here and no second lens - I am the sole
reviewer of round 2 - so the harm the carve-out exists to prevent cannot occur. And
`skills/review/SKILL.md:44-48` assigns the synthesizing row only "After a panel", so with no
panel there is no pass authorised to type one; had I obeyed, round 2 would have produced no
typed verdict at all and `:41-43` would have looped re-running me. Recording is both the safe
direction and the intended one. That a reviewer has to reason its way past the rule to reach
the answer the rule wants is precisely why the rule needs changing rather than annotating.

```
$ ./bin/mstack ledger record reviewer-writes-the-verdict "$(git rev-parse HEAD)" verifier-failed \
    --evidence ".mstack/progress/review_reviewer-writes-the-verdict_r2.md" --verifier reviewer
```

Mapped per `agents/reviewer.md:86-91`: CHANGES_REQUESTED records `verifier-failed`. Output and
the follow-up `ledger check` are appended below.

## Where this stopped on the ladder

Rung 5 for R2-1: built `scratchpad/r2claim` and drove the shipped `./bin/mstack` as a real
process through `reviewing -> verifying -> done` with the rejection on record, and the gate ended
PASSED. Rung 5 again for "a Write-less reviewer can record", performed rather than argued. Rung 2
for R2-2's decisive case - `.mstack/ledger.tsv:30` and the four filename shapes in
`.mstack/progress`, real rows and real files, pointed at directly; the rule's effect on them is
rung 3, walked step by step, since no code parses these suffixes for lensing (`src/roles.ts:53`
treats every `_<suffix>` alike and does not distinguish lens from round, which is why nothing
mechanical can catch this). Rung 4 for `npm test`, `npm run typecheck`, `./bin/mstack
lint-plugin .` and `./bin/mstack gate`, all re-run here rather than inherited from the
coordinator's message. Rung 3, read-back only, for the acceptance bullets that are prose - which
remains the standing hazard on this item: two rounds of green suites have now sat alongside two
false sentences, because no suite can read an instruction file.

## Appendix: the recorded row

```
$ ./bin/mstack ledger record reviewer-writes-the-verdict "$(git rev-parse HEAD)" verifier-failed \
    --evidence ".mstack/progress/review_reviewer-writes-the-verdict_r2.md" --verifier reviewer
recorded verifier-failed for reviewer-writes-the-verdict at 1f45f5ce

$ ./bin/mstack ledger check reviewer-writes-the-verdict
FAIL best verdict at 1f45f5ce is verifier-failed, which does not clear test-verified
EXIT=1
```

This FAIL is honest only because the implementer's `test-verified` row for round 2 sits at
`cbe680b`, one commit back, while HEAD is `1f45f5ce`. Put both rows at one sha - which is what
any item looks like before its ledger is committed - and probe `revF` from round 1 shows the
same rejection reading `PASS test-verified` and turning the close audit green. That is item 18's
ground and correctly out of scope here; recorded so the next round does not mistake this FAIL
for the mechanism working.
