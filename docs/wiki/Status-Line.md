# The status line

The status line is an optional one-line display in Claude Code's status bar, showing where
the work stands on every turn. Read this page to wire it up, and for the one signal it exists to deliver:
that a recorded verdict no longer applies to the commit you are on. Setup is one block in
your own settings file.

The status line exists for one signal nothing else can deliver in time: **a verdict going
stale**. A ledger row is keyed by `(target, sha)`, and a new head SHA voids it. The gate
catches that, but only when something runs the gate, and by then the work has usually moved
on. pstack's own shipping playbook records what that costs — *"twenty-one verdicts went
stale this way in one run with no signal at all"*. A row re-read every turn is where that
signal belongs.

```
Opus · fix/cli-search · #2 cli-search · in_progress · verdict stale · ctx 31%
```

The segments: model, branch, active item, its status, the verdict state for that item at the
current head, and context usage. The verdict segment reports a verdict at HEAD as itself,
whatever it says — a `verifier-failed` at HEAD renders red as the failure it is, not as
"stale" — falls back to `verdict stale` when rows exist only at older SHAs, and says
`unverified` when there are no rows at all (`src/statusline.ts:146-163`). Deliberately no
count on "stale": the count of rows at other SHAs grows with the age of the item and says
nothing about how stale anything is. Here is a real render against a scratch repository whose
active item has no verdict yet:

```console
$ printf '{"model":{"display_name":"Opus"},"workspace":{"current_dir":"%s"},"context_window":{"used_percentage":31}}' "$PWD" \
    | mstack statusline
Opus · feat/greet-flag · #3 export-json · spec_ready · unverified · ctx 31%
```

Colour is ANSI, stripped in this document.

## Wiring

Claude Code takes `statusLine` from **your** settings, not from a plugin — the settings a
plugin can ship support only the `agent` and `subagentStatusLine` keys
([plugins-reference](https://code.claude.com/docs/en/plugins-reference)). So wire it up
yourself, in `~/.claude/settings.json` or the project's `.claude/settings.json`, per the
[statusline docs](https://code.claude.com/docs/en/statusline):

```json
{
  "statusLine": {
    "type": "command",
    "command": "mstack statusline",
    "refreshInterval": 10
  }
}
```

`refreshInterval` matters here: the event-driven triggers go quiet exactly when a coordinator
is waiting on background subagents, which is when the state is changing most. Ten seconds
keeps the stale-verdict signal at most ten seconds late for the cost of one
milliseconds-cheap process.

If the bar comes up empty, `mstack` is not resolving. The plugin's `bin/` is documented as
being on `PATH` for the Bash tool; whether the status line process inherits it is not. Point
the command at an absolute path instead — `which mstack` inside a Claude Code Bash call prints
it.

## Degradation rules

The line degrades rather than lies. No `.mstack/` says `no .mstack`; an unparseable
`state.json` says so instead of rendering a confident blank; two active items are reported as
a violation rather than silently showing the first. Any failure at all prints nothing and
exits 0, because a status line that can break a session is a status line you will delete.

That last promise is why `statusline` is the one subcommand that parses its arguments
leniently: `mstack statusline --subagents` (a typo) still exits 0 with nothing on stderr,
where every other subcommand keeps strict parsing because there a typo should be loud. Both
halves of that split were review findings. The bar could exit 1 with a stack trace on an
EPIPE: the docs describe Claude Code cancelling the in-flight script when a new update
triggers as normal operation, and the EPIPE is what that cancellation produces when it lands
mid-write. And it could exit 2 on a typo'd flag. Its tests now drive the real binary.

## Subagent rows

`mstack statusline --subagent` renders the agent panel rows, and shows while the work is still
running what `SubagentStop` can only report once it is too late: which worker has not written
its report yet.

```
implementer · #3 export-json · no impl report yet · 12k
reviewer · #3 export-json · 2 review reports · 3.2k
```

That render is real: the reviewer panel had two lens reports on disk, the implementer none,
and a third running subagent (an `Explore` worker) got no row at all. Rows are emitted only
for roles mstack has a report contract with — `spec-author`, `spec-reviewer`, `implementer`,
`reviewer` (`src/roles.ts:14-19`) — and everything else keeps Claude Code's default rendering.
If more than one item is active, the rows report the violation rather than guessing which item
a worker belongs to.

Wire it the same way, as `subagentStatusLine`:

```json
{
  "subagentStatusLine": {
    "type": "command",
    "command": "mstack statusline --subagent"
  }
}
```

## Why mstack does not ship this for you

A plugin *may* ship a default `subagentStatusLine` in its own `settings.json`, and mstack does
not. Neither `${CLAUDE_PLUGIN_ROOT}` nor the plugin's `bin/` is documented as reaching that
file — the [substitution table](https://code.claude.com/docs/en/plugins-reference) lists
skills, agents, hooks, monitors, MCP and LSP, and `settings.json` is not among them. Shipping
a command that cannot name its own script would be a claim we have no evidence for, which is
the one thing this plugin exists to stop. The decision is recorded in this repository's own
`decisions.tsv` with both documentation links, and it stands until either mechanism becomes
documented.
