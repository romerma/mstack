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

Round 2 complete: all four review findings addressed. Worktrees stop being foreign via the
git common dir (decision row recorded), the manifest is the checkout identity (decision row
recorded), the transcript convention sits on the pages that carry the transcripts, and the
README claim carries its limit. +5 tests (272), each new one shown red against the round-1
byte copy; live before/after transcripts for the worktree and false-positive cases are in
the round-2 section of the impl report. If this session stops now: nothing is left for the
implementer — the item awaits a review pass that did not write this code. Do not close it
on the implementer's row.

- Round 1 landed the mechanism: `runningCliRoot()` off `import.meta.url`, `isMstackCheckout`
  on two markers, `foreignCliRoot` canonicalising both sides. 267 tests, was 258.
- Verified the five rows myself at rung 5: own CLI ok exit 0, a foreign copy of the same code
  fails exit 1, the actually-stale 0.1.0 says nothing and exits 0 (the honest limit), an
  ordinary user repo silent both ways, and `version` printing the resolved path.
- Round 1 review: CHANGES_REQUESTED, two blocking findings, both reproduced here before
  sending them back.
  - A `git worktree` of this repo at the SAME commit is a red gate when run with the main
    checkout's binary, which is what `hooks/hooks.json` wires. This plugin ships worktree
    tooling and an orchestrate playbook that mandates worktrees, so the check as written turns
    a normal program session red every turn on byte-identical code.
  - The two-marker heuristic fires on any project carrying `bin/mstack` and `src/cli.ts`, and
    the `fix:` line then tells a stranger to run their own unrelated script. No way to switch
    it off.
- Two docs findings: the transcript convention is stated where the transcripts are not, and
  README claims a red gate that today's foreign copy does not produce.
- Round 2: foreign now means outside the repository (`git rev-parse --git-common-dir`
  equality), the manifest (`.claude-plugin/plugin.json` naming mstack) is the checkout
  identity, the agreeing `[ok]` line says "within the same repository" because in a worktree
  the store's own launcher did not run, and the docs findings are fixed at their sites.
  Worktree fixture removed from `git worktree list` after capture; the reviewer's
  `review17-wt-probe` branch left alone as instructed.

## Verification

- Round 1: `npm test` 267/267 under bun and node, typecheck exit 0, `lint-plugin` PASSED,
  doc links 0 broken, gate PASSED — pasted in the impl report; implementer row
  `live-verified` at 2a1fe341.
- Round 2: `npm test` 272/272 under bun and node, typecheck exit 0, `lint-plugin` PASSED,
  doc links 0 broken, gate PASSED — pasted in the impl report's round-2 section; fresh
  implementer row at the round-2 head.
