# mstack

Rigorous, verifiable agent workflows for Claude Code.

mstack is a port of the ideas in Cursor's [`pstack`](https://github.com/cursor/plugins/tree/main/pstack),
rebuilt on Claude Code's primitives and joined to the enforcement machinery of a
spec-driven harness that had been running in production. The research behind it, with sources,
is in [docs/research/pstack-port.md](docs/research/pstack-port.md).

## The one idea

Claude Code's documentation states the constraint plainly:

> Claude Code does not re-read the skill file on later turns [...] use hooks to enforce
> behavior deterministically.

Skill content enters the conversation once and stays there. So a rule written in a skill is a
rule the model may drift from, and every workflow built purely out of prose has the same
ceiling. pstack ships 44 skills, 23 playbooks and **zero hooks**; its own feature playbook says
a design pass is required and then supplies the escape hatch two lines later.

mstack splits the two. Judgment lives in skills. Anything that must hold whether or not the
model remembers it lives in a hook or in a gate that is code.

## Install

```bash
/plugin marketplace add <owner>/mstack     # once this repository is pushed
/plugin install mstack@mstack
```

Before it is published, or while developing it:

```bash
claude --plugin-dir /path/to/mstack
```

Then, in a repository:

```
/mstack:setup
/mstack <what you want done>
```

## What you get

### A router, not an orchestrator

`/mstack` matches the request to a playbook and copies its steps into the todo list **verbatim**
before reasoning about the task. A step you decline stays in the list with `skip: <reason>`.
Skipping silently is not allowed, because the failure mode is reading a playbook and then
writing a bespoke plan that quietly drops its named steps.

### Two paths, one bar for proof

Most work goes straight to implementation. The spec path turns on when the item is marked
`sdd`, carries a `decision_required` field, or crosses several subsystems. The route changes how
work is planned. It never changes what counts as evidence.

```
/mstack
   ├─ small, obvious ──────────────────────────────┐
   └─ sdd | decision_required | cross-cutting      │
          └─ spec ─► grill ─► review (different pass)
                                    │              │
                                    ▼              ▼
                            implement (subagent)
                                    ▼
                        verify ─► ledger(target, sha, verdict)
                                    ▼
                        review (agent with no Write, no Edit)
                                    ▼
                            merge gate (code, not prose)
```

### Enforcement that runs whether the model cooperates or not

| Hook | What it does |
|---|---|
| `SessionStart` | Puts the active item and the last checkpoint back in context. Runs again on `--resume`, which is the case that matters |
| `PostToolUse` | The cheapest useful check. Exits 0 unconditionally: it nudges, it never blocks |
| `SubagentStop` | Confirms the subagent left its report on disk. **A reply is not evidence, the file is** |
| `Stop` | Runs the fast gate. Returns feedback rather than a block, so it never burns the eight-block budget |
| `PreToolUse` | Denies force-push, hard reset, `branch -D`, `pr merge --admin`. Hooks are evaluated before the permission mode, so this holds even under `bypassPermissions` |

### Roles that cannot quietly approve themselves

`orchestrator`, `spec-reviewer` and `reviewer` ship **without `Write` and without `Edit`**. The
rule is not "please do not edit the code you are reviewing". The tool is not there.

They do carry `Bash`, because a reviewer has to run the verification itself — so this is a speed
bump with an audit trail, not an impossibility. Editing a file still takes a visible shell command
that a human reads in the transcript, rather than an edit that looks like ordinary work. That is
the honest strength of the claim, and it is worth having; it is not a sandbox.

### State that survives a dead context window

```
.mstack/
├── state.json      work items and the lifecycle the gate enforces
├── ledger.tsv      target · sha · verdict · evidence · verifier · ts
├── decisions.tsv   ts · phase · decision · why · evidence · result
├── progress/       current.md (live) · history.md (append-only) · <kind>_<slug>.md
└── specs/<slug>/   proposal · design · tasks · spec
```

Two files with opposite disciplines: `current.md` is overwritten every session and its last
section answers "if this dies now, what should the next session do first". `history.md` is
append-only and never edited; if an entry turned out to be wrong, a later one says so.

## The CLI

`bin/mstack` is on `PATH` whenever the plugin is enabled.

| Command | |
|---|---|
| `mstack gate` | Fast session gate, milliseconds. `--full` also runs the project's verification |
| `mstack state add\|set\|list\|active` | The work queue |
| `mstack ledger record\|check\|summary` | Typed verdicts keyed by `(target, sha)` |
| `mstack decide` | One row per decision, append-only |
| `mstack worktree new\|list\|prune` | Including the prune that nobody ever gets round to |
| `mstack merge-gate <pr>` | Exit 0 go, 1 wait, 2 stop |
| `mstack fanout plan\|check` | Allocates a report path per parallel worker, then names the ones that did not return |
| `mstack statusline` | One line of session state, for your `statusLine` setting |
| `mstack lint-plugin` | Validates the prose: front matter, links, size caps, single source of truth |

### What the gate actually catches

The load-bearing check is a shape check, not a parse check:

```bash
$ echo '{"items": {}}' > .mstack/state.json && mstack gate
[fail]  state.json parses but has the wrong shape: .items must be an array, got an object
        fix: this is the shape that silently disables every check below it
```

`JSON.parse` accepts that file. So does `jq empty`. Every query downstream then reads
`undefined`, every comparison sees an empty string and never fires, and a gate without this
check reports green while enforcing nothing. A check that passes when its own queries break is
the exact defect the gate exists to catch, and it is a real one: it shipped, in production, in
the harness this was drawn from.

## The status line

The status line exists for one signal nothing else can deliver in time: **a verdict going
stale**. A ledger row is keyed by `(target, sha)`, and a new head SHA voids it. The gate catches
that, but only when something runs the gate, and by then the work has usually moved on. pstack's
own orchestration playbook records what that costs — *"twenty-one verdicts went stale this way in
one run with no signal at all"*. A row re-read every turn is where that signal belongs.

```
Opus · fix/cli-search · #2 cli-search · in_progress · verdict stale (1) · ctx 31%
```

Claude Code takes `statusLine` from **your** settings, not from a plugin — the plugin manifest has
no such field ([statusline docs](https://code.claude.com/docs/en/statusline)). So wire it up
yourself, in `~/.claude/settings.json` or the project's `.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "mstack statusline",
    "refreshInterval": 10
  }
}
```

`refreshInterval` matters here: the event-driven triggers go quiet exactly when a coordinator is
waiting on background subagents, which is when the state is changing most.

If the bar comes up empty, `mstack` is not resolving. The plugin's `bin/` is documented as being
on `PATH` for the Bash tool; whether the status line process inherits it is not. Point the command
at an absolute path instead — `which mstack` inside a Claude Code Bash call prints it.

The line degrades rather than lies. No `.mstack/` says `no .mstack`; an unparseable `state.json`
says so instead of rendering a confident blank; two active items are reported as a violation
rather than silently showing the first. Any failure at all prints nothing and exits 0, because a
status line that can break a session is a status line you will delete.

### Subagent rows

`mstack statusline --subagent` renders the agent panel rows, and shows while the work is still
running what `SubagentStop` can only report once it is too late: which worker has not written its
report yet.

```
implementer · #2 cli-search · impl report written · 12k
reviewer    · #2 cli-search · no review report yet · 3.2k
```

Rows are emitted only for roles mstack has a report contract with; everything else keeps Claude
Code's default rendering. Wire it the same way, as `subagentStatusLine`.

A plugin *may* ship a default `subagentStatusLine` in its own `settings.json`, and mstack does
not. Neither `${CLAUDE_PLUGIN_ROOT}` nor the plugin's `bin/` is documented as reaching that
file — the [substitution table](https://code.claude.com/docs/en/plugins-reference) lists skills,
agents, hooks, monitors, MCP and LSP, and `settings.json` is not among them. Shipping a command
that cannot name its own script would be a claim we have no evidence for, which is the one thing
this plugin exists to stop. It is tracked as an open item instead.

## Runtime

There is **no build step and no committed artifact**. The TypeScript in `src/` is what runs, so
the file you review is the file that executes.

`bin/mstack` is a small `sh` launcher. Claude Code ships as a native binary and hands plugins no
runtime, so it resolves against whatever is already on the machine: `bun` runs `.ts` natively,
and `node` strips types from 22.6 onward.

Running source directly is normally the slow choice. It is not here, because the launcher sets
`NODE_COMPILE_CACHE`, pointed at `${CLAUDE_PLUGIN_DATA}` so it survives plugin updates. Measured
on an M-series Mac, on the post-edit hook, which is the hottest path in the plugin:

| | |
|---|---|
| bun, `src/cli.ts` | 21.7 ms |
| node, `src/cli.ts`, cold | 48.0 ms |
| node, `src/cli.ts`, cached | **23.8 ms** |
| node, pre-bundled `dist/cli.js` | 21.5 ms |

Two milliseconds is not worth a build artifact in version control. A committed bundle cannot be
reviewed, drifts from its source, and puts a diff in every commit that nobody reads. The cache
invalidates itself when the source changes, and it costs 180 KB in a directory Claude Code
already manages.

The CLI uses only `node:` builtins with zero dependencies, so both runtimes execute it
identically, and CI runs the tests under both plus the node branch of the launcher, so the
fallback cannot rot.

The 22.6 floor is a measured claim, not an inherited one: the full suite runs green on 22.6.0 and
CI keeps a job pinned there. `--experimental-strip-types` is a silent no-op on versions where
stripping is already the default, so passing it always widens support rather than narrowing it,
and `--disable-warning=ExperimentalWarning` goes with it because on 22.6 the stripper writes to
stderr on every invocation — which, on the post-edit hook, means on every edit.

No lockfile is committed, deliberately: Claude Code auto-installs plugin dependencies when it
finds a `package.json` **and** a lockfile together, and there is nothing here for a user to
install.

## Development

```bash
bun install                       # types only, for the typechecker
bun run test                      # bun test AND node --test
bun run typecheck
./bin/mstack lint-plugin .
claude --plugin-dir .             # then /reload-plugins after editing hooks or agents
claude plugin validate . --strict
```

`examples/notes-cli/` is a working repository with a seeded queue: one closed item, one that
takes the direct path, and one carrying a real product fork so you can watch the same command
take the longer route. Its README includes the ways to break the gate on purpose.

## Credit

The router, playbooks, evidence ladder, decision log and verification ledger come from
[pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan (MIT). The gate,
checkpoints, verification ladder, requirement traceability and lean human gate come from a
spec-driven harness of my own. What is new here is joining them and making the gates
executable.

## License

MIT
