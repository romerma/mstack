# Review - reviewer-writes-the-verdict

**Verdict:** CHANGES_REQUESTED

The four acceptance bullets are all met. The change is rejected on the diff itself: the
single most load-bearing sentence in it, `agents/reviewer.md:84-85`, asserts a behaviour the
code does not have, and in the configuration this workflow always produces the row it
instructs has the *opposite* effect - it flips `mstack gate` from red to green. Live proof
below, rung 5, driving the shipped `./bin/mstack` as a real process.

## Requirement to test
| R | Test | Evidence |
|---|---|---|
| reviewer.md instructs its own row | none, and correctly so | Prose in an agent file. No test can fail on it; `impl_reviewer-writes-the-verdict.md:28-31` says so out loud rather than inventing one that cannot fail. Verified by reading, rung 3, plus rung 5 that the instructed command works (below). |
| consistent with review/ship/verify | none | Same: prose. Verified by `rg -n "ledger record"` sweep, rung 3. |
| a Write-less reviewer can record | none | Verified at rung 5 twice - the implementer's probe, and this pass. |
| lint-plugin passes, frontmatter unchanged | `./bin/mstack lint-plugin .` | Rung 4-5, run below. Frontmatter proven byte-identical to `main`. |

No test file is touched by this diff (`git diff main...HEAD --name-only` matches nothing
containing "test"), so no test was weakened to obtain green. The suite count is unchanged at
258 in both runtimes.

## Acceptance, quoted

**"`agents/reviewer.md` instructs the reviewer to record its own verdict row, with the
verifier column set from its own role"** - met. `agents/reviewer.md:69` opens a `## Record it`
section; `:71` names the mechanism ("through Bash, once the report exists"); `:73` gives the
literal command ending `--verifier reviewer`; `:75` states the rule in prose ("The verifier
column is your own role"). Read start to finish as a stranger, I end up with a row and I know
which verdict string goes in it - the mapping at `:80-87` is exhaustive over the three
outcomes. Rung 3 for the wording, rung 5 for the command: I ran exactly that form against six
scratch stores and it recorded every time.

**"The change is consistent with `skills/review/SKILL.md` and with the ship and verify skills,
so no two documents give conflicting instructions about who records"** - met, on the question
the bullet asks, which is *who*. `skills/review/SKILL.md:40-42` says the lone reviewer has
already recorded and forbids the coordinator typing a second row on its behalf, which is the
mirror image of `agents/reviewer.md:71`. `skills/review/SKILL.md:43-47` covers the panel and
the lens carve-out at `agents/reviewer.md:89-92` agrees with it. `skills/verify/SKILL.md:17`
(`--verifier <role>`) and `skills/ship/SKILL.md:31` (`--verifier <who ran it>`) are generic and
say whoever types the row signs it, so neither contradicts. `README.md:103-104` and
`docs/wiki/Getting-Started.md:233-243` already narrate a `--verifier reviewer` row, so the
walkthroughs were ahead of the agent file and are now caught up. On *which verdict* rather than
who, two documents do now disagree - see finding 3 - but that is outside this bullet's words.

**"Whether a reviewer with no Write tool can record at all is established by evidence rather
than assumed, and if it cannot, the item says what does close the gap instead"** - met, at rung
5, twice and independently. The implementer's probe store
`scratchpad/r15probe/.mstack/ledger.tsv` holds
`greet-name / e382833f / test-verified / .mstack/progress/review_greet-name.md / reviewer`,
typed by a real `mstack:reviewer`. Independently: this pass is a real `mstack:reviewer` with
`tools: Read, Glob, Grep, Bash` and no `Write` (`agents/reviewer.md:4`), and every ledger row in
this report was recorded by me through Bash, and this report file itself was written by a Bash
heredoc. Nothing blocks it: `hooks/hooks.json` has a `PreToolUse` matcher on `Bash`, but it
denies only hard-to-walk-back commands, and `mstack ledger record` is not among them. The
capability is real; no gap needs closing.

**"`lint-plugin` still passes and the agent frontmatter contract is unchanged"** - met.
`./bin/mstack lint-plugin .` exits 0 with 0 failures and 0 warnings at this head (output
below), and `agents/reviewer.md` is listed `[ok]` under `-- agents`. Frontmatter proven
unchanged rather than asserted: `diff <(git show main:agents/reviewer.md | head -7) <(head -7
agents/reviewer.md)` is empty, and `git diff -U0` reports a single hunk `@@ -68,0 +69,25 @@`,
a pure insertion 62 lines below the closing `---`. `agents/reviewer.md` is the only file under
`agents/` the diff touches.

## Verification I ran

The item's `verification` field, verbatim:

```
$ npm test
 258 pass
 0 fail
Ran 258 tests across 14 files. [29.69s]          # bun
ℹ tests 258 / pass 258 / fail 0 / cancelled 0 / skipped 0 / todo 0   # node --test
exit=0

$ npm run typecheck
> bunx --bun tsc --noEmit
exit=0

$ ./bin/mstack lint-plugin .
-- agents
[ok]    agents/reviewer.md
...
-- cross-references
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves
PASSED - 0 failures, 0 warnings
```

```
$ ./bin/mstack gate --full
[ok]    one active item: reviewer-writes-the-verdict (reviewing)
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .
PASSED - 0 failures, 1 warning
EXIT=0
```
The one warning is the expected mid-session uncommitted-change warning (`.mstack/state.json`,
`in_progress -> reviewing`).

```
$ ./bin/mstack ledger check reviewer-writes-the-verdict
FAIL no verdict at 3b4e1315; 1 row(s) exist at other SHAs and a new head SHA voids them
EXIT=1
```
Expected before this row: the implementer recorded at `2c2b367` and then committed the ledger
row as `3b4e131`, which moved HEAD past its own verdict. See observation 4.

### The probe: what a CHANGES_REQUESTED row actually does

Scratch store built under `scratchpad/revF`, driving `./bin/mstack` as a real process. One
item, walked to `done`, implementer's row recorded first exactly as `agents/implementer.md:45`
instructs, then the reviewer's row exactly as `agents/reviewer.md:73` and `:82` instruct:

```
### BEFORE the reviewer's row (implementer's test-verified only) ###
[fail]  items closed on a verdict from the pass that wrote the code: probe (only implementer)
FAILED - 1 failure, 2 warnings

### the reviewer now records CHANGES_REQUESTED exactly as agents/reviewer.md:73+82 instructs ###
$ mstack ledger record probe <sha> verifier-failed --evidence review_probe.md --verifier reviewer
recorded verifier-failed for probe at 8b95876a

### AFTER ###
[ok]    1 closed item(s) carry a ledger verdict
PASSED - 0 failures, 2 warnings

### and ledger check still says pass ###
$ mstack ledger check probe
PASS test-verified at 8b95876a by implementer
ledger check exit=0
```

Supporting probes, same method:

```
### reviewer verifier-failed ONLY, item done (scratchpad/revC) ###
[fail]  items marked done whose only verdict is verifier-failed: probe
FAILED - 1 failure, 2 warnings

### panel: three lens rows at one sha, split verdicts (scratchpad/revD) ###
$ mstack ledger check probe
PASS live-verified at f81ff2c1 by reviewer
```

Rung 5 (live, against the shipped binary). Nothing in this section is reasoned; all of it was
executed.

## Changes required

1. **`agents/reviewer.md:84-85`** - "`verifier-failed` clears nothing and blocks a close, which
   is exactly what your verdict means" is false, and in the standard configuration the row is
   worse than inert: it *unblocks* a close that was blocked. `src/gate.ts:371` fails a done item
   only when `rows.every((entry) => entry.verdict === "verifier-failed")`. `agents/implementer.md:45`
   guarantees an implementer row already exists at that sha for every item that reaches review,
   so `every` is false and the branch never fires. Control then reaches `src/gate.ts:373`, which
   needs only `rows.some((entry) => canCloseAnItem(entry.verifier))`, and `canCloseAnItem("reviewer")`
   is true (`src/roles.ts:101-106`) - so the reviewer's *rejection* is what satisfies the
   no-self-approval audit. `src/ledger.ts:151` takes the best row by RANK at the sha, so
   `mstack ledger check` reports `PASS test-verified` over the top of it too. Proven live above:
   FAILED -> PASSED with the failing row as the only change. Note that the implementer's own
   `.mstack/decisions.tsv` row of `2026-08-21T17:26:25.743Z` states the correct, qualified fact -
   "gate.ts fails a done item **whose only verdict** is verifier-failed" - and the qualifier was
   dropped on the way into the agent file, where it becomes an unqualified promise. Fix: strike
   the claim and replace it with what is true - the row records the rejection and carries the
   report as its evidence, it does not by itself block anything, and what keeps the item open is
   that it does not move past `reviewing` (`agents/orchestrator.md:30`). If the intended
   behaviour is the one the sentence promises, that is a `src/gate.ts` change and needs its own
   item; item 18 `closing-row-cites-own-report` is about the evidence column and does not cover
   it. Either way the sentence cannot ship as written.

2. **`skills/review/SKILL.md:50`** - carries the same `CHANGES_REQUESTED` -> `verifier-failed`
   mapping. It states no consequence, so it is not false, but it must move with whatever
   finding 1 resolves to or the two documents drift.

3. **`agents/reviewer.md:89`** - "Given a lens, skip this step" leaves the reviewer to infer
   from the phrasing of its brief, and the two wrong guesses are not equally safe. Guessing
   "alone" when lensed: N rows land at one sha, `src/ledger.ts:151` collapses them to the most
   favorable, and `src/gate.ts:373`'s `rows.some` lets one approving lens close over a rejecting
   one - probe `revD` above returns `PASS live-verified` for a panel that contained a
   `verifier-failed`. Nothing detects this; `mstack fanout check` (`skills/review/SKILL.md:27-29`)
   covers reports, not ledger rows, and there is no equivalent for rows. Guessing "lensed" when
   alone fails safe (the gate catches the missing row at close) but deadlocks, because
   `skills/review/SKILL.md:41-42` forbids the coordinator typing one and, unlike step 4, offers
   no remedy for the absent case. Fix: replace the judgement with an observable test - the
   reviewer knows it was lensed iff the report path it was handed carries a lens suffix,
   `review_<slug>_<lens>.md`, which is what `mstack fanout plan` prints
   (`skills/review/SKILL.md:14-18`) and what `src/roles.ts:44-56` documents - and add a remedy at
   `skills/review/SKILL.md:41` for "`ledger check` shows no row": re-run the reviewer, do not
   type it yourself.

## Observations, not blocking

4. **`skills/router/references/evidence-ladder.md:41` vs `agents/reviewer.md:82`.** The ladder
   maps "Ran it and it failed" to `verifier-failed`. The new wording says record `verifier-failed`
   "even when the suite was green". `agents/reviewer.md:107-109` names that ladder as the standard
   for every claim a reviewer makes, so a reviewer looking up "green suite, uncovered requirement"
   now gets `test-verified` from one document and `verifier-failed` from the other. Acceptance
   bullet 2 is scoped to *who records* and to the review/ship/verify skills, so this sits outside
   it - but `impl_reviewer-writes-the-verdict.md:24` claims "no document now contradicts another",
   which is broader than what holds. Worth either extending the ladder's table with the review
   case or saying in `agents/reviewer.md` that the review verdict overrides the rung mapping.

5. **The row voids itself on commit.** `mstack ledger check reviewer-writes-the-verdict` is red
   at HEAD right now, because the implementer recorded at `2c2b367` and the commit that carried
   that row into git became `3b4e131`. `skills/review/SKILL.md:41` now tells the coordinator to
   "Confirm the row exists with `mstack ledger check <slug>`", which passes at the instant of
   recording and goes red the moment anything is committed. The hazard predates this diff
   (pre-existing step 7 has it too) and is out of the item's scope, but the new step makes it
   load-bearing in a second place. Worth its own item.

6. **The change does not reach a plugin-loaded reviewer yet.** This pass is running the agent
   from `~/.claude/plugins/cache/mstack/mstack/0.1.0/agents/reviewer.md`, which has no
   `Record it` section - `rg -n "Record it|ledger record"` against it returns nothing. I knew to
   record only because the launching brief told me to, not because my agent file did. Same root
   cause as item 17 `path-mstack-is-the-installed-copy`, whose description covers the CLI; the
   agent files ship from the same stale cache and are arguably in its scope.

## Where this stopped on the ladder

Rung 5 for every mechanical claim about the gate and the ledger: built scratch stores under
`scratchpad/rev{A,B,C,D,F}` and drove the shipped `./bin/mstack` as a real process, and rung 5
again for "a Write-less reviewer can record", which this pass performed rather than argued.
Rung 4 for `npm test`, `npm run typecheck`, `./bin/mstack lint-plugin .` and `./bin/mstack gate
--full`, all re-run here rather than taken from the implementer's paste. Rung 3, read-back only,
for the prose claims in acceptance bullets 1 and 2: no test can fail on the wording of an agent
file, which is exactly what makes finding 1 possible - a false sentence in an instruction file
is invisible to a green suite, and the suite was green.

## The row this review typed

Following `agents/reviewer.md:73` and `:82` verbatim, including the mapping finding 1 rejects,
because the instruction under review is the one a reviewer is meant to obey:

```
$ ./bin/mstack ledger record reviewer-writes-the-verdict "$(git rev-parse HEAD)" verifier-failed \
    --evidence ".mstack/progress/review_reviewer-writes-the-verdict.md" --verifier reviewer
recorded verifier-failed for reviewer-writes-the-verdict at 3b4e1315

$ ./bin/mstack ledger check reviewer-writes-the-verdict
FAIL best verdict at 3b4e1315 is verifier-failed, which does not clear test-verified
EXIT=1
```

That FAIL is finding 1 seen from the other side, and it is an accident of this branch rather
than the rule the wording claims. It reads FAIL only because HEAD `3b4e131` carries no other
row - the implementer's `test-verified` sits at `2c2b367`, one commit back. Put the two rows at
one sha, which is what every item that has not committed its ledger yet looks like, and probe
`revF` above shows the same rejection reading `PASS test-verified` and turning the close audit
green. The instruction is harmless here by coincidence, not by design.
