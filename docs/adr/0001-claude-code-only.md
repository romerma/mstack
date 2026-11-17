# mstack targets Claude Code only

Status: accepted. Decided 2026-10-31, written down 2026-11-17.

On 2026-10-31 the maintainer dropped `feat/portable-core`, a branch begun on 2026-08-25 that added Grok and Cursor hook envelopes, a root manifest for the Agent Plugins format, a `.cursor-plugin/` directory and a setup step that wrote `.grok/` and `.cursor/` hook files. mstack stays a Claude Code plugin: its enforcement lives in hooks and subagents, which belong to the host, so a second host means a second hook and agent contract to keep correct beside the first.

The trade-off is reach against upkeep. Users of Cursor and Grok are given up; in return there is one contract, and every hook, agent and setup change is checked against one host. The branch also had open defects when it was dropped: setup overwrote an existing `.cursor/hooks.json` and wrote absolute binary paths specific to one machine.

All three conditions hold. Reversing it is hard because the branch no longer exists in the repository, so a port starts again from nothing. It is surprising because mstack is built on pstack, a Cursor plugin, and the research notes under `docs/` still discuss Cursor. It is a real trade-off because the port was built, worked on for two months, and weighed against its upkeep before it was dropped.
