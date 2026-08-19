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
- The gate checks that `progress/current.md` says something, not merely that it exists.
- `decision_required` is enforced rather than announced: an unanswered product fork blocks every
  phase past `specifying`, and `mstack decide --resolves` is the only way to answer one.
- The status line parses its arguments leniently, because a typo in a user's settings.json must
  not turn the bar into an error message. Everywhere else a typo stays loud, and `state list`,
  `state active` and `ledger summary` now reject stray arguments instead of ignoring them.
- 156 tests, run under both `bun test` and `node --test`, plus a CI job pinned to node 22.6.

### Found by the review panel, before the first release

Four independent reviewers with fresh context, three lenses on the status line and one adversarial
pass over the whole plugin. Everything below was reproduced before being fixed.

- The status line could exit 1 with a stack trace. `process.stdout.write` is asynchronous on a
  pipe, so an EPIPE arrived after the surrounding try/catch had already returned — on the one path
  whose whole promise is that it can never break a session, in the case the docs describe as
  normal (Claude Code cancels the in-flight script when a new update triggers).
- `require_verdict_to_close` did not require a verdict. Any non-empty `closed_by` cleared it, so
  `--closed-by "I checked it myself"` closed an item against an empty ledger, and the shipped
  example taught the shortcut. That is the requirement-with-an-escape-hatch shape this project
  criticises pstack for, shipped inside the check meant to prevent it. The escape hatch now lives
  where it belongs: `verifier-blocked` in the ledger, typed, keyed to a SHA, carrying its reason.
- A `verifier-failed` verdict *at the current head* rendered as "verdict stale" — the status line
  saying nobody had verified this, when the verifier had run and failed.
- A `blocked` item rendered as `idle`.
- One unreadable file in `progress/` blanked every subagent row and silently disabled the
  `SubagentStop` guard, because the same unguarded `statSync` was copy-pasted into both with the
  comparisons written in opposite directions.
- The `PreToolUse` guards matched spellings rather than operations: `git -C dir push --force`,
  `git push origin +main` and `git branch --delete --force` all passed.
- `merge-gate` dropped the ledger check and returned `GO` when it could not find a target.
- Four zero-byte files satisfied "the spec is complete".
- The linter checked `mstack:` cross-references in skills and agents only, leaving the playbooks
  where those names are actually written — the same scope bug already fixed for links.
- Colour was unverified everywhere: repainting a passing verdict red left every test green.
- No build step and no committed artifact: `src/` is what ships and what runs, kept cheap
  with `NODE_COMPILE_CACHE`.
