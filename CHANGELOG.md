# Changelog

## 0.1.0

First release.

- `/mstack` router over ten playbooks, plus eleven phase skills the router chains.
- Opt-in spec path, triggered by `sdd`, `decision_required`, or a cross-cutting change.
- Five agents. `orchestrator`, `spec-reviewer` and `reviewer` ship without `Write` or `Edit`,
  so no pass can approve its own work.
- Five hooks: `SessionStart`, `PostToolUse`, `SubagentStop`, `Stop`, `PreToolUse`.
- `mstack` CLI: gate, state, ledger, decide, worktree, merge-gate, lint-plugin.
- Durable state in `.mstack/`, with a shape-checking gate rather than a parse-checking one.
- 68 tests, run under both `bun test` and `node --test`.
- No build step and no committed artifact: `src/` is what ships and what runs, kept cheap
  with `NODE_COMPILE_CACHE`.
