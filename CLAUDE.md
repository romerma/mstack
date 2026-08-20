# mstack

This repository is the mstack plugin, and it uses mstack on itself: `.mstack/` is the real
work queue for real work on the plugin, which is the only way an unused workflow gets found
out.

## Workflow

Start work with `/mstack`. Durable state is in `.mstack/`; `mstack gate` must be green
before a session closes. One item active at a time, a verdict from a pass that did not
write the code to close it, and product forks answered through `mstack decide --resolves`.

## Development

The dev loop, the runtime rules (no build step, no runtime dependencies, both runtimes
green), and the docs discipline (pasted output from real runs) are in
[CONTRIBUTING.md](CONTRIBUTING.md). Run the plugin from this checkout with
`claude --plugin-dir .`; if the marketplace-installed copy is also enabled, disable one or
the hooks load twice.
