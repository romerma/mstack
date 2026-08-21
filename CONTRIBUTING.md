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
hooks or agents. If the marketplace-installed copy of mstack is also enabled, disable it
first — and not only because the hooks would load twice. Agent and skill definitions come
from whichever plugin copy is enabled, so with the installed copy active, every subagent you
launch runs the *cached* contract no matter what your checkout says; `/reload-plugins`
refreshes a live session, it does not cross that gap. This is not hypothetical: a session on
this repository drew a false conclusion from a reviewer subagent that was running the cached
`agents/reviewer.md`, which lacked a section the checkout had.

## The rules that are not obvious

- **The `mstack` on your PATH is not this checkout.** `which -a mstack` resolves to the
  installed plugin cache, so the habit-formed `mstack gate` in this repository runs a copy
  that predates your change — and the dangerous failure is silent: a gate check your change
  adds is one the cached copy simply does not run, so it reports green over a store your own
  code calls red. Use `./bin/mstack` for every CLI call here; `./bin/mstack version` prints
  which copy is running. The current gate turns red when a foreign copy runs against this
  repository's store, but that check ships with the code being missed, so a copy installed
  before it existed still says nothing — the habit is the only guard against those.
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
- **Pasted output is from real runs, and the run is `./bin/mstack`.** If a README or wiki
  change shows command output, run the command and paste what it printed. The docs review
  that shaped these pages rebuilt every transcript by hand, and the ones that did not
  reproduce were treated as bugs. Transcripts stay spelled `$ mstack ...` because the reader
  has the plugin installed, but the binary that produces and re-runs them is this checkout's
  `./bin/mstack` at the commit that edits the page — re-running them against the copy on
  `PATH` exercises whatever release is installed, and a mismatch there says nothing about
  the transcript.
- **This repository dogfoods itself.** `.mstack/` is the real queue for real work on the
  plugin. For a small fix you do not need to touch it; for a feature, `mstack state add`
  and the lifecycle are how the work is tracked, and `mstack gate` must pass.

## Commits

Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`), in the style `git log` shows.

## Where things are decided

Product forks and their answers live in `.mstack/decisions.tsv`, one row per decision.
If your PR reverses one, add the row that supersedes it and say why.
