# impl: path-mstack-is-the-installed-copy (item 17)

Branch `fix/path-mstack-is-the-installed-copy`, base `main` at `c7f863f3` (item 15 merged
ff-only). Direct path: the five acceptance bullets are the contract. Every CLI call in this
session went through `./bin/mstack`.

## What changed

Inside a checkout of this plugin, `which -a mstack` resolves only to the installed cache, and
a stale copy reports green on checks it does not contain — reproduced as the cached 0.1.0
gate printing `PASSED` exit 0 over a store this checkout's gate calls `FAILED` exit 1, same
store, same commit. The fix keys on the path the running code resolves to, never on the
version string (both copies declare `0.1.0` while ten of twelve `src/` files differ; the
`item-17` rows in `.mstack/decisions.tsv` hold that reasoning): `src/paths.ts` gains
`runningCliRoot()` (the executing module's resolved root), `isMstackCheckout()` (a store root
carrying both `bin/mstack` and `src/cli.ts`), and `foreignCliRoot()`. The gate's workspace
section gains `checkCliProvenance`: in a checkout-rooted store, a foreign copy is a **failure**
naming the copy that ran and the launcher to run instead, the store's own copy is an `[ok]`
line, and in any ordinary repo the check says nothing at all, because there the plugin CLI is
supposed to be foreign. Every other subcommand gets one stderr note (`warnForeignCli` in
`src/cli.ts`) without changing its result, and a new `mstack version` subcommand prints the
manifest version plus — load-bearing — the resolved root of the running copy, needing no
store. Docs state provenance once per surface instead of editing 72 transcript lines: the
wiki footer (rendered on every page), README's Development section, CONTRIBUTING's
pasted-output rule, and CLAUDE.md; CONTRIBUTING and CLAUDE.md also record that the installed
cache governs agent and skill definitions, which `/reload-plugins` does not fix. Stated
plainly everywhere: a copy installed *before* this check existed cannot be taught to warn;
the check closes future rounds of the trap, the habit closes the current one.

## Files

- `src/paths.ts` — `runningCliRoot`, `isMstackCheckout`, `canonical`, `foreignCliRoot`
- `src/gate.ts` — `checkCliProvenance`, wired into the workspace section of `runGate`
- `src/cli.ts` — `version` subcommand, `warnForeignCli` stderr note, USAGE line
- `tests/gate.test.ts` — 4 unit tests appended (lines 1203–1266)
- `tests/provenance.test.ts` — new; 5 process-level tests through the real launcher
- `CLAUDE.md`, `CONTRIBUTING.md`, `README.md` — the contributor-facing statements
- `docs/wiki/_Footer.md` — transcript-provenance line on every wiki page
- `docs/wiki/The-CLI.md` — `## version` section with pasted output
- `docs/wiki/Gates-and-Hooks.md` — the new gate check documented with its honest limit
- `.mstack/decisions.tsv` — three `item-17` decision rows recorded before code
- `.mstack/progress/current.md` — checkpointed during the session

## Commands

Verification, exactly the item's command plus the gate (both runtimes; bun summary shown
separately because `npm test` chains bun then node):

```
$ npm test
...
ℹ tests 267
ℹ pass 267
ℹ fail 0

$ bun test tests/
 267 pass
 0 fail
Ran 267 tests across 15 files. [29.13s]

$ npm run typecheck
> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit
(exit 0)

$ ./bin/mstack lint-plugin .
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves
-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
61 relative links checked, 0 broken

$ ./bin/mstack gate
...
-- workspace
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[ok]    on branch fix/path-mstack-is-the-installed-copy
[warn]  14 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 1 warning
```

Red-without-the-change, via byte copy swap (`scratchpad/prefix-src`, never `git checkout`;
restored afterwards from `scratchpad/postfix-src` and re-verified green):

```
$ rm -rf src && cp -R $SCRATCH/prefix-src src
$ bun test tests/provenance.test.ts
 1 pass
 4 fail
$ node --test tests/provenance.test.ts
ℹ tests 5
ℹ pass 1
ℹ fail 4
$ bun test tests/gate.test.ts
 0 pass
 1 fail
 1 error        # import error: checkCliProvenance does not exist pre-fix
```

The 1 pre-fix pass is "an ordinary repository sees none of it" — a constraint guard whose
subject is silence, which the pre-fix code also delivers; it exists to catch over-firing, not
the fix itself.

The bullet-4 differential, real runs in scratch stores. Demo A — the reproduced silent
inversion, one ordinary store at one commit, item at `verifying` whose `sh check.sh` exits 1
and never ran (`scratchpad/demo-a-ordinary-store`):

```
$ ~/.claude/plugins/cache/mstack/mstack/0.1.0/bin/mstack gate
...
PASSED - 0 failures, 0 warnings
exit=0

$ /Users/romerma/Code/mstack/bin/mstack gate
[fail]  1 stale-gate-demo (verifying) is one step from done, and `sh check.sh` has never been executed
        fix: run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check
FAILED - 1 failure, 0 warnings
exit=1
```

Demo B — the mechanism, one checkout-rooted store (`scratchpad/demo-b-checkout-store`), the
same foreign position before and after the fix:

```
# BEFORE (pre-fix byte copy, foreign): the wrong thing — green, and silent about it
$ $SCRATCH/old-cli/bin/mstack gate
PASSED - 0 failures, 0 warnings
exit=0

# AFTER (post-fix copy, same foreign position): the right thing
$ /Users/romerma/Code/mstack/bin/mstack gate
[fail]  this store's root is an mstack checkout, but the CLI producing this report runs from /Users/romerma/Code/mstack
        fix: run .../demo-b-checkout-store/bin/mstack instead; a copy installed elsewhere can predate the checks this store's code expects, and 'mstack version' prints which copy is running
FAILED - 1 failure, 0 warnings
exit=1

# AFTER, the store's own copy
$ ./bin/mstack gate
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
PASSED - 0 failures, 0 warnings
exit=0

# The actually-installed 0.1.0 against the same store: still green, still silent.
# Nothing shipped today reaches a binary already on disk; stated, not papered over.
$ ~/.claude/plugins/cache/mstack/mstack/0.1.0/bin/mstack gate
PASSED - 0 failures, 0 warnings
exit=0

# A non-gate command from the foreign post-fix copy: one stderr note, result unchanged
$ /Users/romerma/Code/mstack/bin/mstack state list
mstack: note: this store's root is an mstack checkout, and this command ran a different copy from /Users/romerma/Code/mstack; prefer .../demo-b-checkout-store/bin/mstack
no items
exit=0

$ /Users/romerma/Code/mstack/bin/mstack version
mstack 0.1.0 at /Users/romerma/Code/mstack
```

Bullet-5 evidence, run this session:

```
$ rg -c "Record it|ledger record" --include-zero ~/.claude/plugins/cache/mstack/mstack/0.1.0/agents/reviewer.md
0
$ rg -c "Record it|ledger record" agents/reviewer.md
2
$ diff -rq skills ~/.claude/plugins/cache/mstack/mstack/0.1.0/skills
Files skills/review/SKILL.md and .../skills/review/SKILL.md differ
Files skills/router/playbooks/cleanup.md and .../skills/router/playbooks/cleanup.md differ
Files skills/router/references/evidence-ladder.md and .../skills/router/references/evidence-ladder.md differ
```

## Acceptance bullet → evidence

| # | Bullet | Evidence | Rung |
|---|---|---|---|
| 1 | Told where they will read it | `CLAUDE.md` (read every session), `CONTRIBUTING.md` rule "The `mstack` on your PATH is not this checkout", `README.md` Development | 3 — prose placed where the existing rules live; whether a human reads it is not machine-checkable |
| 2 | Wrong copy says so; mismatch surfaced | Gate failure: `tests/provenance.test.ts:65`, `tests/gate.test.ts:1203`; stderr note on other commands: `tests/provenance.test.ts:82`; agreeing case says so: `tests/provenance.test.ts:53`, `tests/gate.test.ts:1218`; Demo B pasted above | 5 — real launcher, real processes, scratch stores |
| 3 | Transcripts state the producing binary | `docs/wiki/_Footer.md` (every wiki page), `README.md`, CONTRIBUTING pasted-output rule; decision row records the 72-edit alternative and its cost | 3 for past transcripts (the statement binds re-runs; the pages' history cannot be re-derived), 5 for the one new transcript (`The-CLI.md` `version` output is a pasted real run, path elided per the page's own convention) |
| 4 | Proven against a real mismatch, before and after | Demo A and Demo B above: installed 0.1.0 `PASSED` exit 0 vs checkout `FAILED` exit 1 on one store; pre-fix foreign copy green+silent vs post-fix foreign copy red naming both paths, same store | 5 — pasted from real runs this session |
| 5 | Stale copy governs agents and skills too | `rg` and `diff -rq skills` output above (0 vs 2 matches in `agents/reviewer.md`; three skill files differ); recorded in CONTRIBUTING and CLAUDE.md with the `/reload-plugins` limit | 5 for the artifact gap (observed on disk this session); 4→3 for "the subagent ran the 0.1.0 contract" — inferred from the cache being the enabled copy, the launch itself was a prior session's |
| — | Constraint: never fires in a user's repo | `tests/provenance.test.ts:100` (real `./bin/mstack setup` + `gate` + `state list` in an ordinary repo: exit 0, no line either way), `tests/gate.test.ts:1231` and `:1249` (single markers do not fire) | 5 |
| — | Constraint: installed 0.1.0 cannot be taught | Demo B's fourth block: 0.1.0 against the checkout-rooted store, still `PASSED`, still silent; stated in CONTRIBUTING, Gates-and-Hooks and the code comments | 5 that it stays silent; the limit itself is a fact about deployment, not fixable here |

Honest limits, out loud: (a) nothing written today reaches the already-installed 0.1.0 — its
green over this repository's store remains wrong and silent until the user updates or
disables it; the docs say so rather than implying the gap closed. (b) The claim that *past*
transcripts were produced by `./bin/mstack` is not re-derivable; the footer states the
binding rule for what produces and re-runs them, and the one transcript added by this item
was produced that way. (c) Path equality is a conservative key: two checkouts at the same
commit still trip the check; the failure costs one command (`./bin/mstack`) and the
alternative — content-hashing two source trees on every gate run — buys accuracy the Stop
hook would pay for on every turn.

## Verdict

`live-verified` — every new behaviour was driven through the shipped `./bin/mstack` as a
real process in scratch stores, the differential was reproduced before and after from byte
copies, and the full suite (267 × 2 runtimes), typecheck, lint-plugin, doc links and the
session gate are green at this head.

---

# Round 2

Review verdict CHANGES_REQUESTED at `7df41e6`
(`.mstack/progress/review_path-mstack-is-the-installed-copy.md`), four findings, two
blocking. All four addressed. Base for this round: `de38c59` (round-1 review artifacts
committed). The pre-fix byte copy for this round is round 1's code
(`scratchpad/r1-src`, identical to HEAD `src/` at `de38c59`); every swap and restore below
was `rm -rf src && cp -R`, never `git checkout`.

## Finding 1 (blocking): a worktree of this repo at the same commit was a red gate

**Fix.** Foreign now means *outside the repository*, not merely at another path:
`foreignCliRoot` returns null when both roots resolve the same canonical
`git rev-parse --git-common-dir`. Every worktree of this repo, at any commit, stops being
foreign; the installed cache (not a git repository) and separate clones keep their different
(or absent) common dir and stay foreign. Decision row recorded (phase item-17) with what the
alternatives give up: comparing commits stays red for every worktree on its own branch,
which is every worktree the orchestrate flow creates; comparing content prices a src-tree
hash into the Stop hook every turn. What the chosen rule gives up — a worktree at a
different commit runs different code and is accepted silently — is priced in the row and
pinned by a test so it is a decision, not an accident. The common dirs are only consulted
after the cheap path comparisons disagree, so no git spawn is added in user repos or on the
agreeing path.

The `[ok]` line was also rewording-forced by this finding: round 1 printed "came from its
own ./bin/mstack", which in the worktree case is not what happened. It now prints "came
from within the same repository". Three test assertions were updated to the new wording in
the same commit as the message — a deliberate message change, not a weakening; the old
regex would have shipped a claim the mechanism no longer makes.

**Live before/after, real runs (`git worktree add --detach scratchpad/wt17-r2 HEAD`,
removed from `git worktree list` after capture):**

```
=== BEFORE (round-1 code): main checkout's bin/mstack against its own worktree, same commit ===
[fail]  this store's root is an mstack checkout, but the CLI producing this report runs from /Users/romerma/Code/mstack
        fix: run .../wt17-r2/bin/mstack instead; ...
FAILED - 1 failure, 0 warnings
exit=1

=== AFTER (round-2 code): same binary, same worktree ===
[ok]    store root is an mstack checkout, and this report came from within the same repository
PASSED - 0 failures, 0 warnings
exit=0

=== AFTER: worktree moved to a different commit, still the same repository ===
PASSED - 0 failures, 0 warnings
exit=0

=== AFTER: a separate clone of this repo, same commit, still foreign ===
[fail]  this store's root is an mstack checkout, but the CLI producing this report runs from /Users/romerma/Code/mstack
FAILED - 1 failure, 1 warning
exit=1
```

## Finding 2 (blocking): the two-marker heuristic false-positived, with a looping fix line

**Fix.** `isMstackCheckout` now requires `.claude-plugin/plugin.json` at the store root to
parse with `"name": "mstack"`, on top of `bin/mstack` and `src/cli.ts` existing (the file
markers stay because the failure's `fix:` line must point at something runnable). The
manifest is tracked, so every clone and every worktree carries it, and the false-positive
repo has none. Missing, unreadable, unparseable and differently-named manifests all read as
not-a-checkout: silence is the only safe failure direction in a stranger's repo, and
mstack's own manifest going bad is `lint-plugin`'s problem. Decision row recorded.
`tests/provenance.test.ts`'s `scratchCheckout` now byte-copies `.claude-plugin/` too — the
review predicted exactly that edit, and it doubles as proof the identifying markers changed.

**Live before/after, real runs (reviewer's recipe: wrapper `bin/mstack` that echoes
"my own tool", unrelated `src/cli.ts`, store from real `setup`):**

```
=== BEFORE (round-1 code) ===
$ ./bin/mstack        # the user's own script
my own tool
$ /Users/romerma/Code/mstack/bin/mstack gate
[fail]  this store's root is an mstack checkout, but the CLI producing this report runs from /Users/romerma/Code/mstack
        fix: run .../userproj-r2/bin/mstack instead; ...
FAILED - 1 failure, 1 warning
exit=1

=== AFTER (round-2 code) ===
$ /Users/romerma/Code/mstack/bin/mstack gate
[warn]  on main; feature work belongs on its own branch
PASSED - 0 failures, 1 warning
exit=0
```

## Finding 3: the transcript convention now sits where the transcripts are

Three placements, not 72 edits (decision row amends the round-1 answer): the intro of
`docs/wiki/The-CLI.md` (40 transcript lines) and of `docs/wiki/Getting-Started.md` (14),
and a parenthetical ahead of README's first transcript at the "Your first item" section
rather than 180 lines after its last. The footer line stays for the published wiki.

## Finding 4: the README claim now carries its limit

"a red gate that says so" became: the gate turns red *once the installed copy is new enough
to contain that check; a copy installed before it existed still reports green and says
nothing, which is why the habit, not the check, is what protects you today*. Same limit
CONTRIBUTING already carried.

## Minor review notes

- `current.md`'s `## Verification` no longer says "Pending"; it now mirrors both rounds.
- The double `isMstackCheckout` call in `checkCliProvenance` has the explanatory comment the
  review asked for: `foreignCliRoot` folds "not a checkout" and "own copy" into one null for
  `warnForeignCli`, while the gate must split silence from a said-out-loud `[ok]`.
- The `warnForeignCli`-on-every-hook cost note stands as a note; the round-2 change adds git
  spawns only on the actually-foreign path, never on hooks in user repos.
- The orchestrate playbook was left untouched on purpose: with worktrees no longer foreign,
  the failure mode the suggested paragraph would have documented no longer exists.

## Files (round 2)

- `src/paths.ts` — manifest requirement in `isMstackCheckout`, `gitCommonDir`, common-dir
  rule in `foreignCliRoot`
- `src/gate.ts` — reworded agreeing line, comment on the double check
- `tests/gate.test.ts` — manifest in `checkoutMarkers`, 2 new unit tests (`:1276`, `:1297`),
  1 assertion updated to the new wording (`:1229`)
- `tests/provenance.test.ts` — manifest + commit in `scratchCheckout`, 3 new process tests
  (`:150` worktree, `:189` clone guard, `:206` false positive), 3 assertions updated to the
  new wording (`:68`, `:164`, `:173`)
- `README.md`, `docs/wiki/The-CLI.md`, `docs/wiki/Getting-Started.md`,
  `docs/wiki/Gates-and-Hooks.md` — findings 3, 4 and the mechanism description
- `.mstack/decisions.tsv` — three round-2 rows (worktree rule, manifest identity, bullet-3
  placement amendment)

## Commands (round 2)

```
$ npm test
 272 pass
 0 fail
Ran 272 tests across 15 files. [46.26s]
ℹ tests 272
ℹ pass 272
ℹ fail 0

$ npm run typecheck
> bunx --bun tsc --noEmit
(exit 0)

$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
61 relative links checked, 0 broken
```

Red against the round-1 byte copy (`rm -rf src && cp -R scratchpad/r1-src src`, restored
from `scratchpad/r2-src` afterwards and re-verified green):

```
$ node --test tests/provenance.test.ts
✖ a git worktree of the repository is not foreign, at the same commit or any other
✔ a separate clone stays foreign even at the same commit        # boundary guard: red in
✖ bin/mstack plus src/cli.ts without the mstack manifest ...    #   neither round, on purpose
ℹ tests 8  pass 6  fail 2

$ bun test tests/gate.test.ts
(fail) both file markers without the plugin manifest are a user's repo, and the check stays silent
(fail) a manifest that is someone else's, or unparseable, does not make a checkout either
 60 pass
 2 fail
```

The clone test passes in both rounds by construction: it pins the boundary the worktree rule
must not erase, and round 1 already treated a clone as foreign. The two red process tests and
two red unit tests are the behaviour changes.

## Finding → evidence (round 2)

| Finding | Fix | Test | Rung |
|---|---|---|---|
| 1: worktree red on identical code | common-dir rule in `foreignCliRoot` | `tests/provenance.test.ts:150` (same commit, different commit, own copy — red on r1 code); clone boundary `:189`; live before/after pasted above | 5 |
| 2: false positive + looping fix line | manifest identity in `isMstackCheckout` | `tests/provenance.test.ts:206` (red on r1), `tests/gate.test.ts:1276` and `:1297` (red on r1) | 5 |
| 3: convention not on the reading path | intros of The-CLI.md and Getting-Started.md, README parenthetical before first transcript | prose placement; verified `rg -n '\$ mstack'` pages carry the statement | 2 — text placement, same rung the review assigned it |
| 4: README over-claim | limit stated inline | prose; the claim now matches the Demo B transcript in round 1 (installed 0.1.0 green and silent) | 2 for the wording; the underlying fact was rung 5 in round 1 |

## Verdict (round 2)

`live-verified` — both blocking findings reproduced live before the fix and shown fixed
after, through real `bin/mstack` processes against a real worktree of this repository and a
real false-positive repo; every behaviour-change test shown red against the round-1 byte
copy; full suite (272 × 2 runtimes), typecheck, lint-plugin, doc links and the gate green at
this head.

---

# Round 3

Review verdict CHANGES_REQUESTED at `da57a20`
(`.mstack/progress/review_path-mstack-is-the-installed-copy_r2.md`): one blocker (round 2
inverted the failure direction — a loud false positive became a silent false negative) and
three located findings. All addressed. Base for this round: `79bb74a` (round-2 review
artifacts committed). The pre-fix byte copy is round 2's code (`scratchpad/r2-src`, verified
identical to `src/` before any edit); every swap and restore was `rm -rf src && cp -R`,
never `git checkout` or `git reset`.

## The blocker: same repository is necessary, the committed src tree is sufficiency

**Fix.** `foreignCliRoot` is replaced by `cliProvenance`, one classification consumed by
both surfaces (which also removes the doubled manifest read per gate run, the first minor
note). Four answers: a user's repo is silence; the store's own path is the plain `[ok] ...
its own ./bin/mstack`; outside the repository stays the failure; and a same-repository
sibling is judged by `HEAD:src` — git's already-stored tree object, fetched **in the same
`rev-parse` spawn as the common dir**, at zero extra spawns. Equal trees get
`[ok] ... within the same repository at the same committed src tree (<sha8>)`; unequal trees
get a warning naming both tree ids, the sibling's path, and the store's own launcher, echoed
as one stderr note by non-gate commands.

**Two superseding decision rows, recorded before the code:**

- The round-2 cost/bound row is superseded: its "full src tree hash into the Stop hook"
  figure was wrong (the reviewer measured the combined spawn at 22.4ms against 19.8ms, means
  of 20, and nothing is hashed — git returns a stored object id), and its "bounded by
  worktree lifecycle" claim asserted a bound the mechanism never provided.
- The severity fork is decided and owned: **warn, not fail**, for a differing sibling. What
  fail would have bought: the Stop hook would inject the mismatch. What it would have cost:
  a red gate every turn for the entire life of any branch touching `src/` — items 18–20 in
  this queue touch `src/gate.ts` — through hooks wired to a `${CLAUDE_PLUGIN_ROOT}` no
  session can redirect per worktree, which is the switch-off failure that produced round 2's
  silence in the first place. What warn gives up is stated in the row and below.

**Live before/after, real runs** — the reviewer's exact shape rebuilt from byte copies
(`scratchpad/r3-before` from `r2-src`, `scratchpad/r3-after` from `r3-src`): a scratch main,
a `git worktree` on `feat/new-check`, one gate check added only on that branch.

```
=== BEFORE (round-2 code) — the worktree's OWN CLI ===
[ok]    store root is an mstack checkout, and this report came from within the same repository
[fail]  a check only this branch contains
FAILED - 1 failure, 0 warnings          exit=1

=== BEFORE — the MAIN checkout's CLI, same store: the silent false negative ===
[ok]    store root is an mstack checkout, and this report came from within the same repository
PASSED - 0 failures, 0 warnings         exit=0

=== BEFORE — hook stop, main's CLI ===
[exit=0]                                # no additionalContext at all

=== AFTER (round-3 code) — the worktree's OWN CLI ===
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[fail]  a check only this branch contains
FAILED - 1 failure, 0 warnings          exit=1

=== AFTER — the MAIN checkout's CLI, same store ===
[warn]  this report was produced by a sibling of this repository at committed src tree bcd59a44, not this store's 10c7e8ef: .../r3-after/main — its checks may not be this store's checks; run .../r3-after/wt/bin/mstack for a report this store's code stands behind
PASSED - 0 failures, 1 warning          exit=0

=== AFTER — a non-gate command from main's CLI ===
mstack: note: this command ran a sibling copy from .../r3-after/main whose committed src tree differs from this store's; prefer .../r3-after/wt/bin/mstack

=== AFTER — hook stop, main's CLI ===
mstack: note: this command ran a sibling copy from .../r3-after/main whose committed src tree differs ...   (stderr)
[exit=0]                                # still no additionalContext — the stated limit

=== AFTER — hook stop, the worktree's own CLI ===
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- a check only this branch contains -> demo of item-17 round-3"}}
```

**Limits, stated rather than implied.** (a) `HEAD:src` is the *committed* tree: uncommitted
edits to `src/` are invisible to the comparison, and `src/` is dirty for most of a working
session. Nothing here closes that, and the ok line says "committed" for exactly that reason.
(b) `src/hooks.ts:176` composes `additionalContext` from `report.failures` only, so the
sibling warning reaches a shell `mstack gate` and the hook process's stderr (the
`warnForeignCli` note, visible above), but not the context injected back into the model.
Closing that would mean either failing (the fatigue this row refuses) or changing quiet-mode
semantics, which is `Report`'s contract, not this item's. Both limits are in the decision
row, the code comments, and `docs/wiki/Gates-and-Hooks.md`.

## Finding B: the cost comment was measurably wrong

Rewritten at the `cliProvenance` doc comment, saying what the reviewer measured: the
identity spawns run once per invocation where the two roots differ — **which includes every
worktree run, on every gate** — and never in a user's repo or on the path-equal path.

## Finding C: the manifest-shape test now covers the promised contract

`tests/gate.test.ts:1297` is rewritten over four shapes — someone else's name, unparseable,
JSON `null`, and a directory at the manifest path (the unreadable case, `EISDIR` out of
`readFileSync`) — with "missing" covered by the wrapper-repo test and the blocking-read
shape delegated to the fifo process test. These are guards: round-2 code already handled
all four (the reviewer verified six shapes by hand), so they pin coverage rather than prove
the fix; the report says so instead of counting them as red-provers.

## Finding D: a fifo manifest no longer hangs the gate

`isMstackCheckout` now runs `statSync(manifest).isFile()` inside the same `try` before
`readFileSync` — a blocking read is not a throw, and the precedent is this repo's own
`src/git.ts` timeout rationale, which the code comment cites. Pinned by
`tests/provenance.test.ts:280` as a real process with a 10s spawn timeout, so the pre-fix
red is a killed child rather than a hung suite.

## Minor notes from the review

- Doubled manifest read: gone (single `cliProvenance` call).
- `paths.ts` no longer a leaf module: noted at the `git.ts` import, with the type-only
  back-edge and the both-runtimes pin.
- `warnForeignCli` cwd vs hook `input.cwd`: a comment at the function now states the
  divergence and when it is visible.
- README "produced and re-run by" ambiguity: rephrased as the rule it is ("The rule for
  every transcript here and in the wiki: ...").

## Files (round 3)

- `src/paths.ts` — `statSync` guard, `repoIdentity` (combined spawn + fallback),
  `Provenance` type, `cliProvenance`; `foreignCliRoot` and `gitCommonDir` removed
- `src/gate.ts` — `checkCliProvenance` over the four answers; severity ladder comment
- `src/cli.ts` — `warnForeignCli` over `cliProvenance`, sibling note, cwd comment
- `tests/provenance.test.ts` — sibling warning test (`:234`, red on r2), fifo test (`:280`,
  red on r2), wording assertions updated (`:68` back to "its own", `:164`/`:173` to "same
  committed src tree" — both red on r2)
- `tests/gate.test.ts` — manifest shapes rewrite (`:1297`, guards), ok-line assertion
  (`:1229`, red on r2)
- `README.md`, `docs/wiki/Gates-and-Hooks.md` — mechanism, severity, both limits
- `.mstack/decisions.tsv` — two superseding rows

## Commands (round 3)

```
$ npm test
 274 pass
 0 fail
Ran 274 tests across 15 files. [37.00s]
ℹ tests 274
ℹ pass 274
ℹ fail 0

$ npm run typecheck
> bunx --bun tsc --noEmit
(exit 0)

$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
61 relative links checked, 0 broken

$ ./bin/mstack gate
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
PASSED - 0 failures, 1 warning     # the warning is this session's uncommitted store files
```

Red against the round-2 byte copy (`rm -rf src && cp -R scratchpad/r2-src src`, restored
from `scratchpad/r3-src` and re-verified green):

```
$ node --test tests/provenance.test.ts
✖ inside a checkout, the checkout's own bin/mstack stays green and says which copy ran
✖ a git worktree of the repository is not foreign, at the same commit or any other
✖ a sibling at a different committed src tree is a named warning, not an ok and not a red gate
✖ a fifo at the manifest path is silence, not a hang   (10.1s — the killed child)
ℹ tests 10  pass 6  fail 4

$ bun test tests/gate.test.ts
(fail) the store's own CLI in its own checkout is an [ok] line, not silence
 61 pass
 1 fail
```

The two wording reds track the deliberate message split (own vs same-src sibling); the
sibling and fifo reds are the behaviour changes. The manifest-shape guards pass on both
rounds by design, as stated above.

## Finding → evidence (round 3)

| Finding | Fix | Test | Rung |
|---|---|---|---|
| Blocker: silent false negative on a differing sibling | `HEAD:src` sufficiency + warn | `tests/provenance.test.ts:234` (red on r2); before/after transcripts above; superseding decision rows | 5 |
| B: wrong cost comment | rewritten with the measured truth | comment; the zero-extra-spawn claim is the reviewer's own rung-5 measurement, adopted | 2 for the wording, 5 for the underlying numbers (reviewer's, cited not re-derived) |
| C: manifest shapes under-covered | four-shape rewrite | `tests/gate.test.ts:1297` (guards, pass both rounds — said, not hidden) | 4 |
| D: fifo hang | `statSync().isFile()` guard | `tests/provenance.test.ts:280` (red on r2 as a killed child) | 5 |

## Verdict (round 3)

`live-verified` — the blocker reproduced live on a byte-copy pair before the fix and shown
warned after, through real `bin/mstack` processes including the hook path; every
behaviour-change test shown red against the round-2 byte copy; full suite (274 × 2
runtimes), typecheck, lint-plugin, doc links and the gate green at this head.
