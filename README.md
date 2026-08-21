# mstack

Rigorous, verifiable agent workflows for Claude Code.

In practice that means three things: work items live in a durable store on disk, every claim
about the work carries a typed verdict keyed to a commit SHA, and the rules that must hold
are enforced by hooks and gates that are code rather than prose. The rest of this README is
those three things, shown running.

## Where this comes from

mstack is a port of the ideas in [`pstack`](https://github.com/cursor/plugins/tree/main/pstack)
by [Lauren Tan](https://github.com/poteto), the only plugin in Cursor's `cursor/plugins`
monorepo not authored by Cursor itself; the name follows her convention, `poteto` → `pstack`.
pstack contributed the router, the playbooks, the evidence ladder, the TSV decision log and the
typed verification ledger; it ships 44 skills, 23 playbooks and zero hooks, so nearly every rule
it has lives in prose. mstack joins that with the enforcement machinery of a spec-driven harness
that had been running in production: a lifecycle gate, hooks, roles whose tool lists are the
permission, and state that survives a dead context window. The full story is in [docs/wiki/The-Story.md](docs/wiki/The-Story.md), and the
research behind the port, with sources, is in
[docs/research/pstack-port.md](docs/research/pstack-port.md).

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

## Quickstart

There is nothing to install and no build step; the TypeScript in `src/` is what runs.

1. Point Claude Code at a clone:

   ```bash
   git clone https://github.com/romerma/mstack.git
   claude --plugin-dir "$PWD/mstack"
   ```

   Or skip the clone and install through the marketplace:

   ```bash
   /plugin marketplace add romerma/mstack
   /plugin install mstack@mstack
   ```

2. In the repository you want to work on, create the durable store, then start work:

   ```
   /mstack:setup
   /mstack <what you want done>
   ```

The step-by-step version, with the output of every command, is
[docs/wiki/Getting-Started.md](docs/wiki/Getting-Started.md).

## Your first item, in five commands

The output below is from a real run. Both refusals are the product behaving as designed.

```bash
$ mstack state add --slug greet-flag --title "greet --shout uppercases the greeting" \
    --acceptance '`python3 greet.py --shout world` prints HELLO, WORLD' \
    --acceptance "test_greet.py covers the flag and the default"
added 1 greet-flag (pending)

$ mstack state set greet-flag --status in_progress
1 greet-flag (in_progress)
  status: "pending" -> "in_progress"
```

Do the work, then try to close it directly:

```bash
$ mstack state set greet-flag --status done
mstack: in_progress -> done is not a legal transition
        pass --force if you mean to skip a phase, and say why in decisions.tsv
```

The lifecycle goes through `reviewing` and `verifying`, and the close needs a ledger verdict.
The implementer's own row is not enough:

```bash
$ mstack ledger record greet-flag "$(git rev-parse HEAD)" test-verified \
    --evidence "python3 -m unittest test_greet -v: 2 tests, OK" --verifier implementer
recorded test-verified for greet-flag at 4b63888b

$ mstack gate    # after moving the item to done
[fail]  items closed on a verdict from the pass that wrote the code: greet-flag (only implementer)
        fix: a closing verdict has to come from somewhere other than the implementer; run the
        verification again from a pass that did not write it
```

A reviewer that did not write the code re-runs the verification, records its own row, and the
gate goes green. The whole walkthrough, including the product-fork refusal, is
[docs/wiki/How-A-Work-Item-Flows.md](docs/wiki/How-A-Work-Item-Flows.md).

## What you get

### A router, not an orchestrator

`/mstack` matches the request to a playbook and copies its steps into the todo list **verbatim**
before reasoning about the task. A step you decline stays in the list with `skip: <reason>`.
Skipping silently is not allowed, because the failure mode is reading a playbook and then
writing a bespoke plan that quietly drops its named steps.

### A product fork is a gate, not a note

An item can carry `decision_required`: prose naming a question whose two answers produce
different work. Past `specifying` the gate refuses to let it move until the fork is answered, and answering it
means `mstack decide --resolves <slug>`: the reasoning goes to `decisions.tsv` in a row that
**names the item it answers**, and the item gets a pointer back to that row. A blank decision,
or one whose result is still `open`, is refused by the CLI and rejected by the gate.

Forks are usually found while `specifying`, which is after intake, so `mstack state set <ref>
--decision-required "<the question>"` attaches one there. Past that line the CLI refuses in both
directions: an item already building cannot have a fork bolted on, because it would be past a
gate it never passed. `--force` still does it, and prints the gate failure it just created.

```bash
$ mstack state set export-json --status spec_ready
mstack: export-json has an unanswered decision: "Is this a stable public contract other tools
        may depend on, or a convenience dump we are free to change? The two answers produce
        different work: one needs a version field and a compatibility rule, the other does not."
        answer it with 'mstack decide --resolves export-json ...' first
```

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
| `Stop` | Runs the fast gate. Returns feedback rather than a block: the same loop protections apply, including the eight-continuation cap, but the transcript labels it feedback and no hook error is raised |
| `PreToolUse` | Denies force-push, hard reset, `branch -D`, `pr merge --admin`. PreToolUse hooks run before the permission prompt, and it follows from that ordering that the deny holds even under `bypassPermissions` |

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
├── decisions.tsv   ts · phase · decision · why · evidence · result · resolves
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
[fail]  .../.mstack/state.json parses but has the wrong shape: .items must be an array, got an object
        fix: this is the shape that silently disables every check below it
```

`JSON.parse` accepts that file. So does `jq empty`. Every query downstream then reads
`undefined`, every comparison sees an empty string and never fires, and a gate without this
check reports green while enforcing nothing. That defect is a real one: it shipped, in
production, in the harness this was drawn from, and the gate's own comment pins it to two of
the harness's issue numbers. Every check is walked in
[docs/wiki/Gates-and-Hooks.md](docs/wiki/Gates-and-Hooks.md).

## The status line

The status line exists for one signal nothing else can deliver in time: **a verdict going
stale**. A ledger row is keyed by `(target, sha)`, and a new head SHA voids it. The gate catches
that, but only when something runs the gate, and by then the work has usually moved on. pstack's
own shipping playbook records what that costs — *"twenty-one verdicts went stale this way in
one run with no signal at all"*. A row re-read every turn is where that signal belongs.

```
Opus · fix/cli-search · #2 cli-search · in_progress · verdict stale · ctx 31%
```

Claude Code takes `statusLine` from **your** settings, not from a plugin, so wire it up
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

The subagent panel rows, the degradation rules, the absolute-path note and the reason mstack
does not ship a `subagentStatusLine` of its own are in
[docs/wiki/Status-Line.md](docs/wiki/Status-Line.md).

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
fallback cannot rot. The 22.6 floor is a measured claim, not an inherited one: the full suite
runs green on 22.6.0 and CI keeps a job pinned there. `--experimental-strip-types` is a silent
no-op on versions where stripping is already the default, so passing it always widens support
rather than narrowing it, and `--disable-warning=ExperimentalWarning` goes with it because on
22.6 the stripper writes to stderr on every invocation — which, on the post-edit hook, means on
every edit.

No lockfile is committed, deliberately: Claude Code auto-installs plugin dependencies when it
finds a `package.json` **and** a lockfile together, and there is nothing here for a user to
install.

## Development

```bash
bun install                       # types only, for the typechecker
bun run test                      # bun test AND node --test
bun run typecheck
./bin/mstack lint-plugin .
node scripts/check-doc-links.mjs README.md docs/wiki/*.md
claude --plugin-dir .             # then /reload-plugins after editing hooks or agents
claude plugin validate . --strict
```

The contribution rules that are not obvious from the code — no build step, no runtime
dependencies, both runtimes green, output pasted from real runs — are in
[CONTRIBUTING.md](CONTRIBUTING.md). The security posture, and where to report a
vulnerability privately, is in [SECURITY.md](SECURITY.md).

`examples/notes-cli/` is a working repository with a seeded queue: one closed item, one that
takes the direct path, and one carrying a real product fork so you can watch the same command
take the longer route. Its README includes the ways to break the gate on purpose.

## Documentation

The wiki lives in this repository, under [docs/wiki/](docs/wiki/), so it can be reviewed like
code and read before the GitHub wiki exists. These files are the wiki's source; the mechanical
publish route is [docs/wiki/Publishing-the-Wiki.md](docs/wiki/Publishing-the-Wiki.md).

| Page | |
|---|---|
| [Home](docs/wiki/Home.md) | What mstack is, and the map of every page |
| [Getting-Started](docs/wiki/Getting-Started.md) | Clone to first closed item, every command with its real output |
| [The-Story](docs/wiki/The-Story.md) | pstack, the harness, where they agree, and what the join fixed |
| [How-A-Work-Item-Flows](docs/wiki/How-A-Work-Item-Flows.md) | The lifecycle, the two paths, and the walkthrough of the example repo |
| [Gates-and-Hooks](docs/wiki/Gates-and-Hooks.md) | The five hooks, every gate check, and the merge gate's rules |
| [The-CLI](docs/wiki/The-CLI.md) | Every subcommand with real output, exit codes, the verdict enum |
| [State-Files](docs/wiki/State-Files.md) | The anatomy of `.mstack/`, column by column |
| [Status-Line](docs/wiki/Status-Line.md) | Wiring, the stale-verdict signal, degradation rules |
| [Publishing-the-Wiki](docs/wiki/Publishing-the-Wiki.md) | How these files become the GitHub wiki |

## Credit

mstack is built on [pstack](https://github.com/cursor/plugins/tree/main/pstack) by
[Lauren Tan](https://github.com/poteto) (MIT, "Copyright (c) 2026 Lauren Tan"). The name keeps
her convention: `poteto` → `pstack`, so this Claude Code port is `mstack`. From pstack: the
router, the playbooks, the evidence ladder, the TSV decision log and the typed verification
ledger. From a spec-driven harness of my own that had been running in production: the lifecycle
gate, hooks that enforce, tool-list-as-permission roles, the progress-file discipline,
`decision_required` as a data field, and the fast/slow gate split. What is new here is joining
them and making the gates executable on Claude Code's primitives.

## License

MIT
