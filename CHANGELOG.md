# Changelog

## 0.1.0

First release.

- `/mstack` router over ten playbooks, plus eleven phase skills the router chains.
- Opt-in spec path, triggered by `sdd`, `decision_required`, or a cross-cutting change.
- Five agents. `orchestrator`, `spec-reviewer` and `reviewer` ship without `Write` or `Edit`,
  so no pass can approve its own work.
- Five hooks: `SessionStart`, `PostToolUse`, `SubagentStop`, `Stop`, `PreToolUse`.
- `mstack` CLI: gate, state, ledger, decide, worktree, merge-gate, fanout, statusline, lint-plugin.
- Durable state in `.mstack/`, with a shape-checking gate rather than a parse-checking one.
- A status line whose reason for existing is the stale verdict: a ledger row is voided by a new
  head SHA, and this is the only place that shows up before it matters. `--subagent` renders the
  agent panel rows, flagging a worker that has not written its report yet.
- Fan-out that is code rather than prose: report paths allocated before launch so parallel
  workers cannot overwrite each other, the concurrency cap refused rather than queued, and
  workers that did not report named rather than counted.
- Source playbooks for the *why* half of `understand`, each organised around what that source
  systematically lies about, and each stating the rung of the evidence ladder it can reach.
- 112 tests, run under both `bun test` and `node --test`.
- No build step and no committed artifact: `src/` is what ships and what runs, kept cheap
  with `NODE_COMPILE_CACHE`.
