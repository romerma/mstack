# Security

## What this is

mstack is a Claude Code plugin that runs entirely on your machine, with your permissions.
It makes no network calls, collects no telemetry, and has zero runtime dependencies; the
CLI is `node:` builtins only, and the TypeScript in `src/` is what executes, so the code
you can read is the code that runs.

## What the guardrails are, honestly

The `PreToolUse` hook denies force-push, hard reset, `branch -D`, and `pr merge --admin`,
and the reviewer roles ship without `Write` and `Edit`. These are speed bumps with an
audit trail, not a sandbox — the README says this in the same words. Do not rely on them
as a security boundary; rely on Claude Code's own permission system for that.

## Reporting a vulnerability

If you find a way for this plugin to do something its user did not sanction — a hook
bypass that the design claims to prevent, command injection through a crafted work-item
field, a path escape in the worktree or fanout tooling — report it privately:

- GitHub: [Report a vulnerability](https://github.com/romerma/mstack/security/advisories/new)

Do not open a public issue for it. You will get an answer within a week, and credit in the
fix's release notes unless you prefer otherwise.

## Supported versions

The latest release, and `main`. There is no backporting.
