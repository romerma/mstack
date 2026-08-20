# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 11 sandbox-weather-dogfood
- **Status:** in_progress
- **Branch:** chore/sandbox-dogfood
- **Base:** main
- **Worktree:** none (sandbox/ is a nested, gitignored repository, not a worktree)

## Plan

- Add `sandbox/` to .gitignore so nothing in it can reach GitHub; commit that plus this state change.
- Create sandbox/ as its own git repository, run `mstack setup` inside it, and start `sandbox/PROTOCOL.md` logging every command from zero.
- Inside the sandbox, run the weather app through the feature playbook, copied verbatim into the sandbox current.md: understand, design, throughput checkpoint, delegate to mstack:implementer, verify, rebase, review, ship. Spec path is on (user steps away and trusts it later).
- Verification target: Lighthouse 100/100/100/100 against the built app, report saved under sandbox/.mstack/ as evidence, verdict recorded in the sandbox ledger.
- Close both stores green: sandbox gate, then this repo's gate; append history here.

## Log

- `mstack gate` green (1 warning: on main), no active item. Branched chore/sandbox-dogfood.
- Added item 11 sandbox-weather-dogfood, set in_progress.
- Friction for PROTOCOL.md: subcommands have no `--help` (`mstack state add --help` exits 2; `state set --help` tries to resolve '--help' as an item ref). Flag syntax only discoverable from src/cli.ts.

## Verification

- Nothing yet. Target: rung 5 (Lighthouse against the running built app) for the sandbox app; rung 4 (gate runs) for the workflow itself.

## Next step

- If this dies: sandbox/ may exist without its own .mstack. Re-run `mstack setup` inside sandbox/, read sandbox/PROTOCOL.md for where the app work stopped.
