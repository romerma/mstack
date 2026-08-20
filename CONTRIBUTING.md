# Contributing

Contributions are welcome. This file is the short list of things that are different here,
so a first PR does not learn them from a review comment.

## Setup

```bash
git clone https://github.com/romerma/mstack.git
cd mstack
bun install        # types only, for the typechecker; the CLI has zero runtime dependencies
```

## Before you open a PR

Run what CI runs:

```bash
bun run test                      # bun test AND node --test — both, every time
bun run typecheck
./bin/mstack lint-plugin .
node scripts/check-doc-links.mjs README.md docs/wiki/*.md
claude plugin validate . --strict
```

To try your change live: `claude --plugin-dir .`, then `/reload-plugins` after editing
hooks or agents.

## The rules that are not obvious

- **There is no build step.** `src/` is what ships and what runs. Do not add a bundler, a
  `dist/`, or a compile script; the reasoning, with measurements, is in the README under
  Runtime.
- **The CLI uses `node:` builtins only.** A new runtime dependency changes the plugin's
  install story for every user, so it is a decision to argue for in the PR description, not
  a habit. `devDependencies` for tooling are fine.
- **Both runtimes stay green.** The launcher prefers bun and falls back to node 22.6+. A
  `Bun.*` call in `src/` breaks that fallback silently, which is why CI runs the suite under
  both and keeps a job pinned to 22.6.
- **No lockfile at the repository root.** Claude Code auto-installs plugin dependencies when
  it finds a `package.json` and a lockfile together; the `.gitignore` comment carries the
  full reason.
- **Pasted output is from real runs.** If a README or wiki change shows command output,
  run the command and paste what it printed. The docs review that shaped these pages
  rebuilt every transcript by hand, and the ones that did not reproduce were treated as
  bugs.
- **This repository dogfoods itself.** `.mstack/` is the real queue for real work on the
  plugin. For a small fix you do not need to touch it; for a feature, `mstack state add`
  and the lifecycle are how the work is tracked, and `mstack gate` must pass.

## Commits

Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`), in the style `git log` shows.

## Where things are decided

Product forks and their answers live in `.mstack/decisions.tsv`, one row per decision.
If your PR reverses one, add the row that supersedes it and say why.
