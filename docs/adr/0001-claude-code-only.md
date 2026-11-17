# mstack targets Claude Code only

Status: accepted. Decided 2026-10-31, written down 2026-11-17.

On 2026-10-31 the maintainer dropped the branch `feat/portable-core`, and mstack stays a Claude Code plugin only. By the project's note of that day, which is kept outside this repository, the branch held Grok and Cursor hook envelopes, an Agent Plugins root manifest, a `.cursor-plugin/` directory and a setup that wrote `.grok/` and `.cursor/` hook files. The note also records that the decision came after a two-month pause, and that two defects in the port were still open: setup overwrote an existing `.cursor/hooks.json`, and it wrote absolute binary paths specific to one machine.

Given up: running mstack on Grok or Cursor. Kept: one host to target.

The note records this as a product decision and gives no further reasoning, so this ADR adds none.

## What the record shows against the three conditions

- **Hard to reverse.** The branch ref is gone. In the maintainer's working copy, when this was written, none of its four commits was on a remote branch (`git branch -r --contains 760a281` printed nothing) and all four were still in the object store (`git cat-file -t 760a281` printed `commit`).
- **Surprising without context.** The README says mstack is built on pstack, and `docs/wiki/The-Story.md` calls pstack a Cursor plugin.
- **The result of a real trade-off.** The record names what was given up and what was kept. It names no alternative that was weighed.
