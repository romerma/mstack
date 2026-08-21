# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 17 path-mstack-is-the-installed-copy
- **Status:** in_progress
- **Branch:** fix/path-mstack-is-the-installed-copy
- **Base:** main
- **Worktree:** none

## Plan

`which -a mstack` resolves only to the installed plugin cache, so a contributor validates a
change against a CLI that does not contain it, and nothing says so.

- Reproduced at rung 5: same store, same commit, an item whose verification exits 1 and has
  never run. The cached 0.1.0 gate says PASSED exit 0; this checkout says FAILED exit 1.
- The trap inside the fix, decided before any code: both copies declare `"version": "0.1.0"`
  while ten of twelve files in `src/` differ, `git.ts` and `verification.ts` exist only here,
  and 19 commits have landed in `src/` since the release. A version comparison reports
  "identical" for two binaries whose gate disagrees. The check keys on the path the running
  script resolves to.
- Widened mid-session by the item 15 review: the stale copy governs **agent and skill files**
  too. `agents/reviewer.md` in the cache has no `Record it` section, so every subagent this
  session launched ran the 0.1.0 contract, and the claim that item 15's instruction worked
  unaided was wrong for that reason.
- Honest limit to state rather than paper over: an already-installed 0.1.0 cannot be taught to
  warn. What the current CLI can do is surface the trap on the good path.

## Log

- Item opened on `fix/path-mstack-is-the-installed-copy` after item 15 merged to main ff-only.
- 72 transcript lines across `README.md` and `docs/wiki/` are written as `$ mstack ...`, which
  is correct for a reader who installed the plugin. Acceptance 3 is about naming the producing
  binary, not 72 edits.
- Three decision rows recorded (phase item-17): check keyed to the executing module's resolved
  root, gate failure + stderr note split; provenance stated once per surface (footer, README,
  CONTRIBUTING) instead of 72 edits; `version` subcommand prints manifest version + path.
- Code landed: `runningCliRoot`/`isMstackCheckout`/`foreignCliRoot` in `src/paths.ts`,
  `checkCliProvenance` in the gate's workspace section, `warnForeignCli` + `cmdVersion` in
  `src/cli.ts`. Pre-fix bytes at scratchpad/prefix-{bin,src}, post-fix at scratchpad/postfix-src.
- Tests: 4 unit tests appended to `tests/gate.test.ts`, 5 process tests in
  `tests/provenance.test.ts`. Shown red against the pre-fix byte copy (4/5 process tests fail,
  gate.test.ts import error; the ordinary-repo silence test is a guard and passes both ways).
  Green after restore. Restores were byte copies, never git checkout.
- Differential captured at rung 5 in scratchpad/demo-a-ordinary-store (installed 0.1.0 PASSED
  exit 0 vs checkout FAILED exit 1, same store same commit) and demo-b-checkout-store (pre-fix
  foreign copy green+silent; post-fix foreign copy red naming both paths; own copy green with
  ok line; installed 0.1.0 still green+silent — the copy nothing shipped today can teach).

## Next step

Implementation complete: code, tests (red pre-fix from byte copies, green after), docs,
differential at rung 5, report at `.mstack/progress/impl_path-mstack-is-the-installed-copy.md`,
implementer ledger row recorded. If this session stops now: nothing is left for the
implementer — the item awaits a review pass that did not write this code. Do not close it on
the implementer's row.

## Verification

- Pending.
