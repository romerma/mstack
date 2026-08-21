# Review - path-mstack-is-the-installed-copy (round 4)

**Verdict:** APPROVED

Reviewing alone, round 4. Head at review time: `b6e58739604eb13d69afeffa7afae845529a7d25`.
Every CLI call went through `./bin/mstack`, or an explicit absolute path where the point was to
run a different copy.

The round-3 blocker is closed the right way - not by patching two strings into agreement, but by
hoisting the clause and giving it a type that makes the wrong call impossible to write. Both
smaller asks are closed, and the committed-tree test documents the limit rather than exercising
a branch. I enumerated every arm of the switch rather than the two that were driven, mutated the
new tests in both directions, and read the whole four-round diff for accumulation. Three minors
below; I considered whether any justified a fifth round and concluded none does, for reasons I
give rather than assert.

## Round-3 findings, one by one

**1 (blocking): the CLI note said "differs" where the code knew only "unknown".** Closed, and
closed structurally. `src/paths.ts:262` is `describeSrcComparison(p: Extract<Provenance, { kind:
"same-repo" }>)` - the clause lives in one place, and its parameter type *excludes the `foreign`
arm*, which carries no tree fields at all. The coordinator asked whether "`foreign` with a null
tree" can still diverge: it cannot be written, not merely does not happen. See the enumeration
below for the empirical half.

**2: the uncomparable branch had no test.** Closed by `tests/provenance.test.ts:314`, and it
bites - see mutation A.

**3: the docs sentence lumped `hook stop` in with terminal subcommands.** Closed at
`docs/wiki/Gates-and-Hooks.md:232-239`. It now splits exactly three ways and does not re-promise
rendering:

> who sees the warning splits three ways. In a shell, `mstack gate` prints it and every other
> subcommand puts one note on stderr. On a hook invocation, the *model* gets nothing: the Stop
> hook composes its `additionalContext` from failures only, so a warning cannot reach it by
> construction. The note is then the only signal, and it goes to the stderr field the client
> captures verbatim — whether a person sees that field rendered is what [the two-streams section
> above](#what-claude-code-does-with-those-two-streams) already declines to promise.

That is my round-3 three-valued answer, and it *links* to the section that declines rather than
restating it, which is what I asked for. I checked the anchor by hand because
`scripts/check-doc-links.mjs:18` skips `#`-only targets - it resolves to
`docs/wiki/Gates-and-Hooks.md:47`, as do the other two in-page anchors on that page.

**4: the committed-tree limit was stated three times and pinned zero times.** Closed by
`tests/provenance.test.ts:354`, and it is a *documenting* test rather than a branch exercise -
see mutation B.

## Judge point 1: is the invariant held, or held by coincidence?

Held by construction, and I checked every arm rather than the two that were driven. Nine
reachable states, each run through the real launcher, gate and note compared:

| state | gate | note |
|---|---|---|
| `not-a-checkout` (ordinary user repo) | silent | silent |
| `own` | `[ok] ... its own ./bin/mstack` | silent |
| `same-repo`, trees equal | `[ok] ... same committed src tree (838da81f)` | silent |
| `same-repo`, trees equal, detached HEAD | `[ok] ... same committed src tree (838da81f)` | silent |
| `same-repo`, trees differ | `[warn] at committed src tree X, not this store's Y` | same clause |
| `same-repo`, **store** tree null | `[warn] could not be compared (git gave no answer)` | same clause |
| `same-repo`, **running** tree null | `[warn] could not be compared (git gave no answer)` | same clause |
| `same-repo`, **both** null | `[warn] could not be compared (git gave no answer)` | same clause |
| `foreign`: running outside any repo | `[fail] ... runs from <path>` (exit 1) | "a different copy from <path>" |
| `foreign`: store is a checkout but not a git repo | `[fail]` (exit 1) | note |

Round 3's repro only removed `src/` from the *store* side's HEAD. I ran the reverse and the
both-null case as well; all three produce the honest clause on both surfaces. Two structural
reasons this is not luck:

- `src/paths.ts:245` computes `sameSrc: mine.srcTree !== null && mine.srcTree === theirs.srcTree`,
  so two nulls do **not** read as "same". A naive `===` would have made both-null an
  affirmative `[ok]`.
- The silence on `own` and on equal trees is not drift. `warnForeignCli`'s contract is one note
  when something is wrong; the gate's is to say what it checked either way. They disagree about
  volume, never about facts.

## Judge point 2: do the +89 lines bite?

Byte copies of `HEAD` from `git archive`, never `git checkout`.

**Mutation A - the round-3 source restored** (`git show e32a86c:src/{cli,gate,paths}.ts` written
over the round-4 files, round-4 tests kept). This is the exact defect I reported:

```
✖ a sibling at a different committed src tree is a named warning, not an ok and not a red gate
✖ when the trees cannot be compared, both surfaces say so instead of claiming a difference
ℹ pass 10  ℹ fail 2
```

**Mutation C - only the *gate* drifts** (`describeSrcComparison(provenance)` replaced by an
inline unconditional "differs", CLI untouched). Drift is caught in that direction too:

```
✖ a sibling at a different committed src tree ...
✖ when the trees cannot be compared, both surfaces say so ...
```

**Mutation B - the comparison tightened to see the working tree** (`repoIdentity` appends the
`git status --porcelain src` state to the tree id):

```
✖ uncommitted src edits are invisible to the committed-tree comparison, as decided
ℹ pass 11  ℹ fail 1
```

Exactly one test, and it is the right one. `tests/provenance.test.ts:354`'s own comment says "If
tightening the comparison to see the working tree is ever wanted, this test is the one to change
— deliberately", and that is precisely what my mutation forced. That is the difference between
pinning a limit and exercising a branch.

I also checked the test's premise is not decorative. It appends a top-level `console.error` to
`src/cli.ts` in the worktree and asserts the marker appears on stderr - i.e. it proves the
divergence is *real code that runs*, not a string comparison. Verified live:

```
worktree's own CLI stderr: [UNCOMMITTED-ONLY-IN-WORKING-TREE]
sibling  CLI stderr marker: []
```

The sibling genuinely does not run the edit and still reports the full `[ok]`, with
`[warn] uncommitted change(s)` one line away. That is the limit, demonstrated.

## Acceptance, quoted

**"A contributor is told, where they will actually read it, how to run this checkout's CLI rather than the installed one"**

Met. `CLAUDE.md:22-24`, `CONTRIBUTING.md:33-42`, `README.md:339-346`. Unchanged since round 2 and
still accurate under round 4's severity split, because all three speak of `./bin/mstack` and of a
"foreign copy", which round 3 gave a precise meaning that excludes siblings. Rung 2.

**"Running the wrong one against a store is either impossible, or it says so; a version mismatch between the CLI and the checkout is surfaced rather than silent"**

Met, and this is the bullet four rounds were spent on. Every way of running the wrong one now
says so, in terms that name what was actually compared: outside the repository is a failure at
exit 1; a sibling at a differing committed tree names both tree ids; a sibling whose trees cannot
be compared says that instead of inventing a difference. The two limits are stated at
`src/paths.ts:165-168`, `src/gate.ts:445-448` and `docs/wiki/Gates-and-Hooks.md:229-239`, and both
are now pinned by tests rather than prose. Rung 5 - the table above is my own runs.

The Stop hook still gets nothing for a warning, by construction. What changed in round 4 is that
the decision no longer rests on that: the round-4 decision row moves the load-bearing reason onto
the instructed habit ("the signal a worktree contributor is instructed to use is that worktree's
own `./bin/mstack`, which gives the branch's own verdict correctly, exit 1 and all") and demotes
hook-field capture to "canary-verified context rather than a premise". That is the correct
response to a three-valued finding: do not build on the value you could not establish.

**"The wiki and README transcripts state which binary produced them, so re-running them to satisfy the docs rule is unambiguous"**

Met, unchanged since round 3. `README.md:69-72`, `docs/wiki/The-CLI.md:6-9`,
`docs/wiki/Getting-Started.md:6-9`, `docs/wiki/_Footer.md:3`. Rung 2.

**"Whatever mechanism is chosen is proven against a real mismatch, not only reasoned about"**

Met, and re-proven this round across nine states rather than the original two, with the
before/after for the round-3 defect reproduced by mutation A rather than inherited.

**"The stale copy is shown to govern agent and skill definitions too, not only the CLI"**

Met, unchanged. Confirmed once more this session: my loaded `reviewer` definition still lacks
`## Record it`, so I read `agents/reviewer.md` from the working tree for the recording rule -
which is bullet 5 demonstrating itself for the fourth round running.

## Verification I ran

```
$ npm test
 276 pass
 0 fail
Ran 276 tests across 15 files. [87.88s]
ℹ tests 276
ℹ pass 276
ℹ fail 0

$ npm run typecheck        (exit 0)
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
61 relative links checked, 0 broken

$ ./bin/mstack gate --full
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .
PASSED - 0 failures, 1 warning
```

The one warning is this session's uncommitted `.mstack/state.json`. Output was captured to a file
so a red run would have named the test; it was clean. Item 21 owns the flake, and I saw nothing
to add to it.

```
$ ./bin/mstack ledger check path-mstack-is-the-installed-copy
FAIL no verdict at b6e58739; 7 row(s) exist at other SHAs and a new head SHA voids them
```

Expected: the newest row is the implementer's at `a8084dc`, and `b6e5873` is the commit that added
it. My row follows this report.

## Judge point 5: what four rounds accumulated

I read the whole of `git diff main...HEAD`, not only the round-4 delta. What I looked for and
what I found:

- **Dead code from an earlier shape.** One, and it is small: minor 2 below. No stale references
  to `foreignCliRoot` or `gitCommonDir` survive anywhere in `src/`, `tests/`, `docs/` or the
  root markdown - both were removed cleanly when round 3 replaced them.
- **Comments describing a mechanism that no longer exists.** None. One comment is *coarser* than
  the docs now are - minor 3 - but nothing describes a mechanism that is gone.
- **Decision rows that were superseded but still read as current.** Checked, and this is not a
  finding: append-only supersession is the documented design (`src/decisions.ts:7` and
  `docs/wiki/State-Files.md:145`: "gets a new row that supersedes it, never an edit"), and the
  round-3 row opens with "Superseding the round-2 worktree row" and says why the earlier one was
  wrong. A reader who reads the log gets the correction with the name of what it corrects.
- **Docs stating a rule two ways.** The transcript rule is stated on four surfaces and I compared
  them: `README.md:69`, `docs/wiki/The-CLI.md:6`, `docs/wiki/Getting-Started.md:6` and
  `docs/wiki/_Footer.md:3` all say the same thing - produced and re-run by the repository's own
  `./bin/mstack` at the commit that edits the page, spelled `$ mstack` for an installed reader.
  No divergence.

## Minor - not blocking, and I am saying why

None of these is a wrong statement about what the product does to a user. All three are internal
precision nits, and after four rounds the proportionate thing is to name them for whoever touches
this file next rather than spend a fifth round on them. Fold them into the next change here.

1. **`src/paths.ts:231-232` - "One spawn per root" is not true on the fallback path.** The
   sentence reads "the identity spawns run once per invocation where the two roots differ ... One
   spawn per root, `HEAD:src` riding along with the common dir." Counted with a logging `git`
   shim on `PATH`:

   ```
   own (path-equal)                  identity spawns: 0
   same-repo, trees comparable       identity spawns: 2
   same-repo, tree UNCOMPARABLE      identity spawns: 3
        rev-parse --git-common-dir HEAD:src
        rev-parse --git-common-dir              <- the fallback, one root only
        rev-parse --git-common-dir HEAD:src
   ordinary user repo                identity spawns: 0
   ```

   The fallback itself is documented twenty lines up at `src/paths.ts:160-163`, so nothing is
   hidden; the cost sentence is just flatter than the mechanism. About 10ms on a path that
   requires a repository with no committed `src/`. A clause - "two when a root has to fall back" -
   settles it. I flag it because this exact sentence was wrong in round 2, corrected in round 3,
   and is still a shade over-stated in round 4, which is worth knowing before someone quotes it.

2. **`src/paths.ts:110` - `export function isMstackCheckout` has no consumer outside its own
   module.** Round 2's `src/gate.ts:29` imported it; round 3 folded the logic into
   `cliProvenance` and dropped the import, leaving the `export`. Its only call site is
   `src/paths.ts:235`. The references in `tests/provenance.test.ts:43`, `:285` and
   `tests/gate.test.ts:1297` are prose in comments and one test name, not calls. Dropping the
   keyword narrows the surface to what is actually used.

3. **`src/gate.ts:460-462` states hook visibility the two-way way.** "What warn gives up ... so
   this line reaches a shell gate and not the hook." Literally true of the warn line, and it
   predates the three-way split that `docs/wiki/Gates-and-Hooks.md:232-239` now insists on. A
   reader who finds the comment first gets the coarser version of a distinction the same change
   went to some trouble to draw. One sentence, or a pointer to the wiki section.

## Where the claims stopped on the ladder

- The nine-state enumeration, the spawn counts, the uncommitted-edit marker, and every transcript
  above: **rung 5**, run against clones of this repository and worktrees of those clones under
  `/private/tmp/claude-501/.../scratchpad/r4/enum`, with the real `bin/mstack` as a real process.
- "The round-4 tests bite": **rung 4**, three byte-copy mutations of `HEAD` run under node,
  including a full restore of the round-3 source rather than a synthetic edit.
- "The invariant cannot be violated for the `foreign` arm": **rung 3** - the type at
  `src/paths.ts:262` excludes it, so I walked the failure and it does not reach. `tsc --noEmit`
  exit 0 is the check that the type is enforced, which is rung 4 for enforcement.
- Acceptance bullets 1 and 3, minors 2 and 3, and the accumulation sweep: **rung 2**. Claims
  about text and about which symbols are imported where; I read the lines and grepped the
  consumers.
- "Whether a person sees the captured stderr field rendered": still **not established**, by me or
  by this repository, and round 4's text and decision row both now say so instead of building on
  it. I am recording that it stayed unestablished rather than letting four rounds of familiarity
  turn it into a settled fact.

## Cleanup

Created by this review, left in place because removing them is a destructive git command. All
self-contained under `scratchpad/`; `rm -rf` on `r4/` is sufficient and nothing in
`/Users/romerma/Code/mstack` is touched. The worktrees are registered against clones inside
`r4/`, not against this repository.

- `/private/tmp/claude-501/-Users-romerma-Code-mstack/cefb854d-5ff7-43b0-95ba-d79a53d0c4d7/scratchpad/r4/`
  - `enum/a`, `enum/b` + `enum/b-wt` (branch `nosrc-store`), `enum/c` + `enum/c-wt`
    (`nosrc-running`), `enum/d` + `enum/d-wt` (`nosrc-both`), `enum/e` + `enum/e-wt` (detached),
    `enum/outside`, `enum/nogit`, `enum/user`, `marker` + `marker-wt` (detached), and the
    `mutA`/`mutB`/`mutC` mutation copies.
- Still outstanding from earlier rounds, and these two **are** registered against this
  repository: `scratchpad/wt17` (branch `review17-wt-probe`, round 1) and `scratchpad/r2/`,
  `scratchpad/r3/` (self-contained).

Nothing tracked in `/Users/romerma/Code/mstack` was modified by this review except this report
and the reviewer row appended to `.mstack/ledger.tsv`.
