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
