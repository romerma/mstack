# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 1 statusline — Ship a statusline that renders the active item
- **Status:** reviewing. Built and live-verified; not reviewed by anyone who did not write it.
- **Branch:** main (the session that built this broke its own branch rule; see decisions.tsv)
- **Base:** main
- **Worktree:** none

## Plan

- Close the six gaps named after the dist removal: commits, a real end-to-end run, the status
  line, dogfooding, the source playbooks, fan-out tooling.
- Prove the cycle with real agents in a throwaway copy of `examples/notes-cli`, both paths.
- Record what the runs break rather than papering over it.

## Log

- Repository committed in seven units. Nothing was tracked before this session.
- End-to-end run 1 on `cli-search`: design used a judge agent on a different model, the
  implementer injected a regression and confirmed the new tests fail without the fix.
- That run exposed a three-way inconsistency: `review` fans out, `agents/reviewer.md` sent every
  lens to one filename, and `SubagentStop` demanded exactly that name. Report contract is now a
  prefix; each file judged on its own.
- Run 2 closed `cli-search` to `done`. The review panel caught the stale-verdict rule firing and
  blocked closure until a verdict existed at the real head SHA — twice.
- Run 3 on `export-json` took the spec path on `sdd: true`, hit `decision_required`, and stopped
  to ask instead of guessing. It left `current.md` untouched, which is why the gate now checks it.
- Status line, source playbooks and fan-out tooling built. The linter now validates links in
  reference files, which it never did.
- Node 22.6 floor verified rather than asserted: 112/112 there, and the launcher now suppresses
  the ExperimentalWarning it was writing to stderr on every hook invocation.

## Verification

- 116 tests green under `bun test` and `node --test`, plus 112 on node 22.6.0.
- `mstack lint-plugin .` clean; `claude plugin validate` clean on both manifests, skills, agents.
- Rung 5 for the status line: rendered against a live store mid-cycle, showing one worker's
  report present and another's missing.

## Next step

Review panel is running on item 1: correctness, robustness, tests-by-mutation, plus one
adversarial pass over the whole session asking whether the plugin lives up to its own thesis.
Paths allocated by `mstack fanout plan`. When they return, `mstack fanout check`, then act on the
findings before moving item 1 past `reviewing`.
