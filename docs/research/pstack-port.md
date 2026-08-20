# Research — porting Cursor's `pstack` to Claude Code

**Date:** 2026-08-19
**Question:** What is Cursor's [`pstack`](https://github.com/cursor/plugins/tree/main/pstack) plugin, what can be improved about it, and can the `enxvo` harness serve as the model for that improvement in a Claude Code plugin?

**Method.** Three parallel investigations against primary sources only. For pstack: the GitHub tree API and raw file contents, plus `cursor.com/docs` for every Cursor primitive it relies on. For the harness: direct reads of a local checkout of `enxvo` — a private repository — at `main@99cb205c`, read-only. For Claude Code: the official docs, plus real installed plugin sources under `~/.claude/plugins/cache/`. No blog posts, no secondary write-ups. Every claim below carries the source that owns it. Statements marked **[inference]** are analysis, not sourced fact.

**Headline.** The premise needed correcting twice.

1. **pstack is not spec-driven development. It is explicitly the opposite.** Its README states: *"personally, i don't believe in planning. the best spec is code."*
2. **Claude Code merged slash commands into skills.** New plugins build on `skills/`, not `commands/`.

---

## Part 1 — What pstack actually is

### 1.1 Not a document pipeline

The README section *"why are there no planning skills?"* says it outright ([README.md](https://raw.githubusercontent.com/cursor/plugins/main/pstack/README.md)):

> cursor already has a great plan mode which works great with pstack. but personally, i don't believe in planning. the best spec is code. if you do want to make a plan, `/poteto-mode` covers it, but it's not a default.

Planning exists as one 89-byte playbook that delegates to a reference file ([multi-phase-plan.md](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/playbooks/multi-phase-plan.md)), and that reference opens by telling you not to plan ([plan.md](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/references/plan.md) §0):

> Skip the plan when the change is one or two files with an obvious approach. Say so and stop.

The name is the author's handle (`poteto` → `pstack`), not "product stack". The plugin is MIT, "Copyright (c) 2026 Lauren Tan", and is the only plugin in `cursor/plugins` not authored by Cursor itself.

### 1.2 What it is instead

Four layers, per the README:

| Layer | Content |
|---|---|
| One front door | `/poteto-mode` — reads the request, picks a playbook, runs other skills as steps need them |
| Playbooks | 23 files, steps **copied verbatim** into the todo list |
| Principles | 21 leaf skills, one rule each, indexed inline in the mode skill |
| Model routing | Work split by model strength across a four-model panel |

**The artifact it standardizes is evidence, not specs**: repro output, traces, runtime proof, a typed verification ledger, and a TSV decision log.

### 1.3 By the numbers

156 files, 750,691 bytes of content (plus 2.3 MB of guide JPEGs). 125 Markdown files. 44 skill directories (23 workflow + 21 principle). 23 playbooks. 2 TypeScript CLIs with 46,041 bytes of tests. Version `0.14.1`; latest commit touching `pstack/` is [`63d938c2`](https://github.com/cursor/plugins/commit/63d938c2e4a165a0fec1bd0f61a8e325f0cb751e), 2026-08-13, *"chore(pstack): bump Grok default from 4.5 to 4.6"*.

Component inventory, verified against the tree: **zero** commands, **zero** rules, **zero** hooks, **zero** declared MCP servers, **zero** `AGENTS.md`. Two agents, 44 skills.

### 1.4 The router

The routing contract, from [poteto-mode/SKILL.md](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/SKILL.md):

> Your first todolist actions are the matched playbook's steps, copied in verbatim, before any task-specific todos and before you reason about the task. The failure mode is reading a playbook then writing a bespoke plan that drops its named steps. **A step you choose not to do stays in the list with a one-line `skip: <reason>`; skipping silently is not allowed.**

Critically, **the router does not call anything programmatically.** Playbook steps are text that names other skills ("run `architect`"); the agent invokes them on reaching each step. It is a routing table, not an orchestrator. **[inference]** This is the single most important mechanical fact for a port.

### 1.5 The three cross-cutting invariants

These recur in nearly every file and are the genuinely portable core.

**Evidence over assertion** — [principle-prove-it-works](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/principle-prove-it-works/SKILL.md):
> Verify every task output by checking the real thing directly. Do not infer from proxies, self-reports, or 'it compiles.' […] **Agents report what they intended, not always what happened.**

**Author ≠ reviewer** — [feature.md](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/playbooks/feature.md) step 4 mandates delegating implementation so the parent can review the diff: *"Mandatory: no skip-with-reason escape, and Laziness Protocol does not override it (the gain is review separation, not lines saved)"*.

**Model diversity as the adversarial signal** — [interrogate](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/interrogate/SKILL.md):
> The adversarial signal comes from model diversity, not assigned personas. Models differ in blind spots, priors, and reasoning patterns. Agreement across models is high-confidence signal.

### 1.6 The best artifacts in the plugin

**The evidence ladder** — [blast-radius](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/blast-radius/SKILL.md). **[inference]** the single most reusable thing here:

> For each fact the change's safety depends on, get it as far down this list as is cheap, and say where it stopped.
> 1. You said so. Worthless on its own.
> 2. You pointed at the line. A real `file:line`, or the library's own source.
> 3. You showed the bad case can't happen. You walked the failure step by step and it doesn't reach.
> 4. You ran it. A script or test that calls the real code and fails loud if you're wrong.
> 5. You reproduced it in the running app.
>
> Any safety fact you can't get to step 4, say so out loud. Don't write it up as settled.

Its framing is equally good: *"A blast-radius writeup that sounds right is worthless. It reads as convincing whether or not it's true, and that is the trap you are walking into."*

**The TSV decision log** — [show-me-your-work](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/show-me-your-work/SKILL.md). Header is one line: `ts	phase	decision	why	evidence	result`. Rationale: *"TSV because GitHub renders it as a sortable table, `column -s$'\t' -t` and spreadsheets read it, and a row appends with one command."* Rules: one row per decision (*"If it doesn't fit on one line, the decision isn't crisp yet"*), append-only, *"A wrong call gets a new row that supersedes it."*

Its helper [`log.sh`](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/show-me-your-work/scripts/log.sh) carries a real CSV-injection defense — it prefixes any cell starting with `=`, `+`, `-`, or `@` with a quote, because *"attacker-controlled evidence (PR titles, filenames, generated text) must not become formula execution when a reviewer opens the file."*

**The typed verification ledger** — the only real gate in the plugin, because it is code. [store.ts](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/scripts/orch/store.ts) lines 21–26:

```ts
export type Verdict =
  | "live-ui-verified"
  | "unit-test-verified"
  | "type-check-only"
  | "verifier-blocked"
  | "verifier-failed";
```

Rules over that enum, from [orchestrate.md](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/playbooks/orchestrate.md): *"CI green is an input to a verdict, not a verdict. Behavioral work needs better than `type-check-only`. `verifier-blocked` is not a pass… **A new head SHA voids the row.**"*

**The ship state machine.** [shipping.md](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/playbooks/shipping.md) opens with the load-bearing claim:

> Babysit makes a stack mergeable. Shipping decides what is actually safe to merge and lets Graphite drain it. **Green is not safe, and the gap between those two words is where this playbook lives.**
>
> Safe means a verdict from an agent that did not write the code. CI green is not a verdict, and an approving bot review is not a verdict.

Plus a real invalidation mechanic: *"A restack rewrites every SHA above it and silently invalidates every verdict without touching a single check… **Twenty-one verdicts went stale this way in one run with no signal at all.**"*

And [babysit.md](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/playbooks/babysit.md)'s ordering rule, which encodes an expensive lesson: *"Order is conflicts, then review threads, then CI. Conflicts and thread fixes both require a push that restarts checks, so CI work ahead of them is thrown away."*

**The brief template** — from orchestrate.md, with the best single sentence about delegation in the plugin:

> **The brief is the product. A vague brief fails quietly, because a worker cannot ask you a question.** […] Missing fields are a refuse-to-spawn condition.

Fields: `GOAL SCOPE CONTEXT ACCEPTANCE VERIFY TIMEBOX FORBIDDEN REPORT STANDING`.

### 1.7 What is wrong with it

Every item below is observed directly from source.

**Zero hooks, so zero enforcement.** No `hooks/` directory and no `hooks` key in the manifest. Every rule — "read the principles first", "no em dashes", "no narrating comments", "the throughput checkpoint is four todo items" — is enforced only by prose, while Cursor supports `preToolUse`, `afterFileEdit`, `beforeSubmitPrompt`, `stop`, and `subagentStop` ([Cursor: Hooks](https://cursor.com/docs/hooks)). The plugin's own `eval.md` playbook exists because nobody trusts self-reported compliance: *"Verify the chain from transcripts, not self-report… Citing a principle is not reading its leaf skill, and reading it is not applying it."*

**Every hard gate is advisory.** [feature.md](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/playbooks/feature.md) step 2 says `architect` is required, then immediately supplies the escape: *"Skipping stays as `architect skipped: <reason>`."* `visual-parity.md` step 1: *"No baseline, no parity claim. A blocking prerequisite, not a follow-up."* — nothing blocks anything. **[inference]** The one place pstack achieves real gating is `orch ledger`, because it is code with a typed enum.

**No tests for 125 of 129 prose files.** Four test files exist, all for the two TypeScript CLIs. Zero validation for the Markdown that constitutes 98% of the plugin's behavior. `authoring-a-skill.md` asks for a validator that is never shipped, and `reflect` step 5 says *"If your environment ships a SKILL.md validator, run it… **Skip this step if it doesn't.**"*

**Model slugs hardcoded in 9+ places** despite `/setup-pstack` existing precisely to make them configurable. The proof this costs real maintenance: the most recent commit is a Grok version bump that had to touch every site. It violates the plugin's own `principle-encode-lessons-in-structure` and its own `authoring-a-skill.md` rule: *"Point at structural sources (types, READMEs, config); hardcoded details go stale."*

**No resume or idempotency for 22 of 23 playbooks.** Only Orchestrate persists state. [pause-safely.md](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/playbooks/pause-safely.md) admits the failure mode — *"write it to a file like `/tmp/<slug>-resume.md`, because the in-context plan won't survive summarization"* — but the note has no schema and no fixed path. `principle-make-operations-idempotent` is preached, not practiced on itself.

**Parallelism is prescribed but unmanaged.** No concurrency limit anywhere (`swarm` acknowledges a cloud limit exists while providing no way to respect it). No cost or budget accounting beyond a prose `TIMEBOX`. No retry or timeout for dropouts, only *"note it"*. And `/tmp/arena-<slug>/` collides across concurrent runs with the same slug — the exact failure `principle-separate-before-serializing-shared-state` exists to prevent.

**Hard third-party dependencies.** Graphite `gt` is required by the four playbooks that actually land code. Both CLIs require Bun specifically (`#!/usr/bin/env bun`, `bun.lock`, `Bun.spawnSync`). `worktree-cleanup.md` hardcodes macOS/Xcode paths. The `~/.cursor/rules/pstack-models.mdc` path is literal in 9 files with no override.

**A self-installing bootstrap that re-execs.** [bootstrap.ts](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/scripts/bootstrap.ts) runs `bun install --frozen-lockfile` on first use and then re-executes the whole process. **[inference]** An unexpected write for a tool a babysitting agent invokes in a polling loop, with no `--no-install` escape.

**Undocumented API surface.** `poteto-mode/SKILL.md` uses `mode: true`, `icon`, `color`, and `reminder` — none documented at [cursor.com/docs/skills](https://cursor.com/docs/skills), and a repo-wide code search shows pstack is the only plugin in `cursor/plugins` using `mode: true`. Its skills also reference `subagent_type: "generalPurpose"` and `"plan"`, neither of which appears in [Cursor: Subagents](https://cursor.com/docs/agent/subagents) (which lists only Explore, Bash, Browser). `interrogate` already ships a prose workaround for slug rot.

**An unresolved internal contradiction.** `poteto-mode/SKILL.md` says *"Any PR-status request → the Babysit playbook, **and not Cursor's built-in babysit skill**"*, while `opening-a-pr.md` and `plan.md` both say *"run Cursor's built-in babysit skill"*. **[inference]** Exactly the drift `principle-encode-lessons-in-structure` predicts when a rule lives as prose in three files.

**Context cost.** `poteto-mode/SKILL.md` is 18,858 bytes and instructs reading itself in full, plus the matched playbook, plus every applicable leaf principle — roughly 30 KB before the first tool call, loading `principle-guard-the-context-window` along the way.

**Its own honest counter-datum**, from orchestrate.md:

> Work one agent could finish inside the session's budget is not a program; **measured head-to-head, this playbook's ceremony turned a half-hour 12-unit job into 1 landed unit while a plain agent landed all 12.**

---

## Part 2 — The `enxvo` harness

Read from a local checkout at `main@99cb205c`. The repository is private; paths below are
relative to its root.

### 2.1 The structural insight

The harness is **not** primarily a `.claude/` harness. `.claude/` is a thin *compatibility surface*. The authority is a set of root-level, runtime-agnostic Markdown and shell contracts: `AGENTS.md`, `init.sh`, `CHECKPOINTS.md`, `feature_list.json`, `docs/specs.md`, `docs/verification.md`, `.openclaw/agents/`, `openspec/`.

Every `.claude/agents/<role>.md` is 29 lines and says, verbatim:

> **The authoritative contract for this role is `.openclaw/agents/orchestrator.md`. Read it first and follow it. This file exists so Claude Code can run the OpenClaw Engineering Harness; it deliberately defines no separate workflow.**

One workflow, N runtimes, zero drift. **[inference]** This is the most portable idea in the repo.

### 2.2 The lifecycle

```
pending → specifying → spec_ready → in_progress → reviewing → verifying → done | blocked | cancelled
```

Five roles: `orchestrator`, `spec-author`, `spec-reviewer`, `implementer`, `reviewer`. Three specialists: `backend-tech-lead`, `frontend-tech-lead`, `security-guardian`.

### 2.3 Tool-list-as-permission

The enforcement mechanism is the frontmatter, not the prose.

| Role | `tools` | Consequence |
|---|---|---|
| `orchestrator` | `Read, Glob, Grep, Bash, Agent` | **No Write/Edit** → structurally cannot implement |
| `spec-reviewer` | `Read, Glob, Grep, Bash` | **No Write/Edit.** *"Never review a spec you wrote."* |
| `reviewer` | `Read, Glob, Grep, Bash` | **No Write/Edit.** *"the implementer's pasted output is not a substitute"* |
| `implementer` | `Read, Write, Edit, Glob, Grep, Bash` | *"Never weaken a test to obtain green output."* |

### 2.4 The gate

`enxvo/init.sh`, three modes, rationale in the file header:

> `./init.sh` Fast gate: toolchain, harness files, feature_list, workspace hygiene. Seconds. Safe as a Stop hook.
> `./init.sh --tests` Fast gate + `make test`.
> `./init.sh --full` Fast gate + `make verify` (exactly what CI runs).
>
> The fast gate deliberately does NOT run tests: `make verify` takes minutes and **a gate nobody waits for is a gate nobody runs.** The reviewer agent is the one required to run `--full`.

The `feature_list.json` block contains the best single argument in either repo for shape-checking:

> `jq empty` only proves the file parses. Without a shape check, a file like `{"features": {}}` passes it, every query below then errors to stderr, the shell comparisons receive empty strings and never fire, and this gate reports success while enforcing nothing — no one-feature-at-a-time, no spec-presence. **A check that passes when its own queries break is the exact defect this harness exists to catch** (see #395, #396).

### 2.5 Negative tests for the gate itself

`enxvo/scripts/harness-openspec-gate_test.sh` — the `expect_fail` helper asserts **both** non-zero exit **and** that a failure message was emitted:

```bash
expect_fail() {
  local name="$1"; shift
  local before=$FAILS
  if "$@"; then
    printf 'FAIL %s (expected non-zero)\n' "$name"; FAILS=$((FAILS + 1)); return
  fi
  if [ "$FAILS" -eq "$before" ]; then
    printf 'FAIL %s (failed silently)\n' "$name"; FAILS=$((FAILS + 1)); return
  fi
  printf 'OK   %s (failed as required)\n' "$name"
  FAILS=$before
}
```

**[inference]** Catching "failed silently" is precisely the class of bug the gate exists to prevent. Any plugin shipping a validator should ship this.

### 2.6 Hooks that nudge, never block

`enxvo/scripts/harness-postedit.sh` header states the design constraint:

> "Cheapest" is the whole design constraint: a hook that runs `make verify` on every edit is a hook that gets switched off.
> **Exits 0 unconditionally. This nudges, it never blocks.**

It also fails open: `command -v jq >/dev/null 2>&1 || exit 0`.

### 2.7 State on disk, never in chat

Artifact ownership, from the README:

| File | Written by |
|---|---|
| `openspec/changes/<kebab>/` | spec-author |
| `progress/current.md` | orchestrator (live, overwritten) |
| `progress/grill_<f>.md` | spec-author + spec-reviewer |
| `progress/spec_review_<f>.md` | spec-reviewer |
| `progress/impl_<f>.md` | implementer |
| `progress/review_<f>.md` | reviewer |
| `progress/history.md` | orchestrator (append-only) |
| `feature_list.json` | orchestrator |

`progress/current.md`'s template closes with the best prompt line in the repo: *"If this session dies right now, the first thing the next one should do."* `progress/history.md`'s header: *"Never edit an earlier entry — if it turned out to be wrong, say so in a later one."*

The rule has a documented origin, from `history.md`:

> **`sec-395` went idle without writing its report.** The leader never sees subagent reply bodies, so that analysis would have vanished silently; it was caught only because the leader checked for the file rather than trusting the one-line reply. **Lesson: a reply is not evidence, the file is.**

### 2.8 CHECKPOINTS — evaluate the destination, not the path

`enxvo/CHECKPOINTS.md` opens:

> In a multi-agent system you do not evaluate the path, you evaluate the destination. These are the objective checks a reviewer (human or agent) walks to decide whether the repository is healthy enough to close a feature.
>
> The reviewer marks every box `[x]` or `[ ]` in `progress/review_<feature>.md` and refuses the close if anything in C1–C6 is empty.

Six groups, ~40 boxes. The two highest-leverage details: **conditional gates** (*"If the change touched repositories, adapters, migrations or tenant scoping: `make verify-postgres` is also green"*) and the mandate to **quote evidence per acceptance bullet, not in aggregate**.

### 2.9 The verification ladder

`enxvo/docs/verification.md`. Thesis: *"an agent does not say it works, it shows that it works."* And: *"Climb only as far as the change requires — **but the reviewer decides that, not the implementer.**"*

L0 harness gate · L1 unit · L2 CI equivalence · L3 real Postgres · L4 full stack · L5 user-facing · L5b object storage, with a dispatch table mapping *what the change touches* → *required levels*. Its anti-patterns list is short and every entry is a real past failure:

> - ❌ "I added the handler, it should work." — no executable evidence.
> - ❌ A test that only asserts no exception is raised. It must assert the concrete result, and it must fail without the change.
> - ❌ Marking a feature `done` on a partial suite, or on L2 output the reviewer never saw.
> - ❌ Pasting a summary of the test output instead of the output. The reviewer reads the real thing.

It also carries a **"Not covered locally, by anyone"** section enumerating known gaps with dates and issue numbers. **[inference]** This exists so a green run is not over-read, and it is unusually honest.

### 2.10 The lean human gate

`enxvo/docs/specs.md`. **[inference]** The mechanism that lets 17 features close autonomously without being reckless:

> Human plan approval is required only when:
> - the source is a direct request (no GitHub issue), or
> - the feature has `decision_required`, or
> - a spec pass hits a material product fork (different user-visible outcomes)
>
> and only after grill-me `APPROVED`. Well-specified issues stay agent-only after grill-me.

`decision_required` as a **data field on the work item** is the clever bit: it makes "when to interrupt the human" declarative.

### 2.11 Traceability, four greppable links

`R<n>` stable requirement id → task that names the `R` it covers → `R<n> → test` table in the implementation report → reviewer re-derives it with `file:line`. Plus the falsifiability rule from CHECKPOINTS C4:

> Every behaviour change has a test that fails without the change. A test that only asserts "does not panic" does not count.

EARS kit from `docs/specs.md`: `The system MUST` / `WHEN` / `WHILE` / `WHERE` / `IF…THEN`, with *"One requirement contains one obligation."*

And the source-citation header every spec carries, with two derived rules: re-verify the issue's `file:line` before writing from them, because issues rot; and *"If the spec and the issue disagree, the issue is the newer intent. Stop and reconcile. Implementing an outdated spec correctly is still the wrong outcome."*

### 2.12 What is wrong with it

- **No worktree tooling at all.** `rg -n "worktree" Makefile scripts/ .claude/` returns nothing operational. `git worktree list` shows 17 worktrees, 12 of them merged and never cleaned up.
- **The merge gate is prose, not code.** The policy is excellent (`UNSTABLE`/`BLOCKED` is a stop; a completed `FAILURE` including infra is a stop; skipped-never-started is not a failure; *"The label is a contract, not decoration"*; *"Do not merge via API to bypass a red check that `gh pr merge` would refuse"*; *"A running CI job is owned work, not a hand-off"*) but it lives in a skill and a runbook, and an agent must choose to obey it.
- **No JSON Schema for the state file.** The schema lives as scattered `jq -e` expressions in `init.sh`.
- **The lifecycle enum is duplicated in six places** — `AGENTS.md`, `docs/specs.md`, `feature_list.json:rules.valid_status`, two `init.sh` queries, and four in `harness-openspec-gate.sh`.
- **Slash commands have no frontmatter** and hardcode `git diff main...HEAD`.
- **No statusline**, despite machine-readable state that would render perfectly in one.
- `skills-lock.json` tracks 1 of 2 vendored skills.
- Hard dependency on the `openspec` CLI pinned to exactly 1.9.0.

---

## Part 3 — Claude Code primitives

**⚠️ The docs moved.** Every `docs.claude.com/en/docs/claude-code/*` URL now 301s to `code.claude.com/docs/en/*` (verified 2026-08-19). Machine-readable index: `https://code.claude.com/docs/llms.txt`. Append `.md` to any page for raw Markdown.

Three pages named in older references no longer exist as such: `plugin-reference` → [`plugins-reference`](https://code.claude.com/docs/en/plugins-reference); `plugins-marketplaces` → [`plugin-marketplaces`](https://code.claude.com/docs/en/plugin-marketplaces); `hooks-reference` → merged into [`hooks`](https://code.claude.com/docs/en/hooks). And `slash-commands.md` now serves the Skills page verbatim.

### 3.1 Commands merged into skills

From [Skills](https://code.claude.com/docs/en/skills):

> **Custom commands have been merged into skills.** A file at `.claude/commands/deploy.md` and a skill at `.claude/skills/deploy/SKILL.md` both create `/deploy` and work the same way. Your existing `.claude/commands/` files keep working. Skills add optional features: a directory for supporting files, frontmatter to control whether you or Claude invokes them, and the ability for Claude to load them automatically when relevant.

And the [file-locations table](https://code.claude.com/docs/en/plugins-reference#file-locations-reference) annotates `commands/` as: *"Skills as flat Markdown files. **Use `skills/` for new plugins**"*.

### 3.2 The constraint that decides the architecture

From [Skills § Skill content lifecycle](https://code.claude.com/docs/en/skills#skill-content-lifecycle):

> When you or Claude invoke a skill, the rendered `SKILL.md` content enters the conversation as a single message and **stays there for the rest of the session**… **Claude Code does not re-read the skill file on later turns**, so write guidance that should apply throughout a task as standing instructions rather than one-time steps.
>
> If a skill seems to stop influencing behavior after the first response, the content is usually still present and the model is choosing other tools or approaches. Strengthen the skill's `description` and instructions… **or use hooks to enforce behavior deterministically.**

**[inference]** Two consequences. First, this gives for free the "sticky mode" that pstack achieves through Cursor's undocumented `mode: true`. Second, it is the docs stating the exact thesis of this research: prose asks, hooks enforce.

### 3.3 Who can invoke what

From [Skills § Control who invokes a skill](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill):

| Frontmatter | You can invoke | Claude can invoke | Description in context |
|---|---|---|---|
| (default) | Yes | Yes | Always |
| `disable-model-invocation: true` | Yes | **No** | No |
| `user-invocable: false` | No | Yes | Always |

**[inference]** pstack sets `disable-model-invocation: true` on 40 of 44 skills. Copied literally into Claude Code, that would leave the router unable to chain anything.

### 3.4 Naming and namespacing

From [Skills § How a skill gets its command name](https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name):

| Location | Command name |
|---|---|
| Plugin `skills/` subdirectory | Frontmatter `name` or the directory name, namespaced by plugin → `/my-plugin:review` |
| Plugin root `SKILL.md` | Frontmatter `name`, plugin directory name as fallback |

> In a plugin skill, the frontmatter `name` replaces the directory name in the last segment of the command… **The bare `/fancy` also invokes the skill unless another command already uses that name.**

Important: *"If a plugin has **no `skills/` directory** and no `skills` manifest field, a `SKILL.md` at the plugin root is loaded as a single skill."* — a root `SKILL.md` is ignored once `skills/` exists ([plugins-reference](https://code.claude.com/docs/en/plugins-reference#skills)).

### 3.5 Context budget

| Limit | Value |
|---|---|
| `description` + `when_to_use` combined | **1,536 characters**, truncated in the listing |
| Skill listing budget | **1% of the context window**; on overflow, descriptions are dropped starting with least-invoked skills |
| Post-compaction retention | 5,000 tokens per skill, **25,000 total**, most-recent-first |
| SKILL.md length | guidance only: **under 500 lines** |
| Skill stacking | first skill + **5** more |

**[inference]** This is the argument against shipping 21 principles as 21 skills.

### 3.6 Plugin anatomy

Required: only `name` in `.claude-plugin/plugin.json`, and the manifest itself is optional. Discovery defaults: `skills/`, `commands/`, `agents/`, `hooks/hooks.json`, `.mcp.json`, `bin/`, `.lsp.json`, `output-styles/`, `workflows/`.

> **Warning:** The `.claude-plugin/` directory contains the `plugin.json` file. All other directories must be at the plugin root, **not** inside `.claude-plugin/`.

> **A `CLAUDE.md` file at the plugin root is not loaded as project context.** Plugins contribute context through skills, agents, and hooks rather than CLAUDE.md. To ship instructions that load into Claude's context, put them in a skill.

Path-field semantics differ per field: `skills` **adds to** the default scan; `commands`, `agents`, `workflows`, `outputStyles` **replace** it.

`bin/` is worth noting: *"Executables added to the Bash tool's `PATH`. Files here are invokable as bare commands in any Bash tool call while the plugin is enabled."*

Substitutions: `${CLAUDE_PLUGIN_ROOT}` (install dir, **changes on update**), `${CLAUDE_PLUGIN_DATA}` (persists across updates), `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_SKILL_DIR}`.

Node dependency auto-install fires only when the plugin root has a `package.json` **and** a supported lockfile: `bun.lock`/`bun.lockb` → `bun install --frozen-lockfile --ignore-scripts`; `package-lock.json`/`npm-shrinkwrap.json` → `npm ci --ignore-scripts`. Yarn and pnpm lockfiles are skipped for security.

### 3.7 Subagents

Only `name` and `description` are required. `model` defaults to `inherit`. Plugin-shipped agents support `name`, `description`, `model`, `effort`, `maxTurns`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, `isolation`.

> **For security reasons, `hooks`, `mcpServers`, and `permissionMode` are not supported for plugin-shipped agents.**

> Project and user `.claude/agents/` definitions **override same-named plugin agents**.

Limits: **20 concurrent subagents** per session (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); nesting depth **3** as of v2.1.219. Subagent `name` cannot contain `:` — reserved for plugin scoping.

Context isolation: *"Each subagent starts with a fresh, isolated context window. It doesn't see your conversation history, the skills you've already invoked, or the files Claude has already read."*

### 3.8 Hooks

The event list is far larger than commonly assumed — 30+ events including `SessionStart`, `Setup`, `UserPromptSubmit`, `UserPromptExpansion`, `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `Stop`, `StopFailure`, `PreCompact`, `PostCompact`, `FileChanged`, `WorktreeCreate`, `WorktreeRemove`, `SessionEnd`.

Plugins declare hooks in `hooks/hooks.json`. Five handler types: `command`, `http`, `mcp_tool`, `prompt`, `agent`.

**The exit-code trap**, verbatim:

> For most hook events, **exit code 2 is the only exit code that blocks through the code alone.** Without valid JSON on stdout, Claude Code treats exit code 1 as a non-blocking error and proceeds with the action, even though 1 is the conventional Unix failure code. If your hook is meant to enforce a policy, use `exit 2`.

And: a timed-out hook renders no decision and **does not block** — *"don't count on a stalled hook to act as a gate."*

**Hooks outrank permission modes:**

> A hook that returns `permissionDecision: "deny"` blocks the tool even in `bypassPermissions` mode or with `--dangerously-skip-permissions`. The reverse is not true… **Hooks can tighten restrictions but not loosen them past what permission rules allow.**

**Stop-hook loop guard:** Claude Code overrides a Stop hook after it blocks **eight times in a row** without progress. The preferred non-error variant returns `hookSpecificOutput.additionalContext` instead of `decision: "block"` — *"It keeps the conversation going through the same loop protections… but the transcript labels it `Stop hook feedback` and no hook error notification is shown."*

Skills may declare `hooks` in frontmatter (registered on invocation, kept for the session; `once: true` for one-shot). Plugin **agents** may not.

Output caps: `additionalContext`, `systemMessage`, and plain stdout are capped at **10,000 characters**.

### 3.9 State persistence

**There is no documented plugin state API or key-value store.** The documented durable primitives are `${CLAUDE_PLUGIN_DATA}`, files in the repo, subagent `memory: user|project|local`, and `SessionStart` + `reloadSkills`. **[inference]** For a workflow plugin the docs point clearly at repo files, re-injected via `` !`cat …` `` or a `SessionStart` `additionalContext` hook.

Checkpointing has a limitation that matters here: *"**Subagent edits not restored.** …Any other subagent: rewinding doesn't restore the edits. **Use git to revert them.**"*

### 3.10 Local development

```bash
claude --plugin-dir ./mstack        # local copy takes precedence over an installed same-named plugin
/reload-plugins                     # picks up hooks, agents, MCP without restart
claude plugin validate ./mstack --strict
```

`SKILL.md` text changes take effect immediately in-session; changes to `hooks/`, `agents/`, `.mcp.json` need `/reload-plugins`.

---

## Part 4 — Synthesis

### 4.1 Where the two sources agree

Despite being philosophically opposed on planning, pstack and enxvo converge on five things. **[inference]** That convergence is the strongest signal in this research:

1. Evidence over assertion. *"a reply is not evidence, the file is"* (enxvo) and *"Agents report what they intended, not always what happened"* (pstack) are the same lesson learned twice.
2. Author ≠ reviewer, enforced structurally.
3. Typed verdict enums, invalidated by a new SHA.
4. State on disk, because context windows die.
5. Gates must be code. Both repos say so; only pstack's `orch ledger` and enxvo's `init.sh` actually are.

### 4.2 Where they disagree, and the resolution

pstack routes straight to evidence; enxvo routes through a spec. The resolution is already latent in enxvo: it carries an `sdd: true` flag **per work item**. So the spec path becomes opt-in rather than mandatory, triggered by that flag, by `decision_required`, or by the change being cross-cutting. Both paths then share one ledger, one set of gates, and one durable state.

### 4.3 Port list

| Take | From | Why |
|---|---|---|
| Evidence ladder, 5 rungs | pstack `blast-radius` | Applies to every claim any agent makes |
| TSV decision log + formula-injection guard | pstack `show-me-your-work` | Cheap, append-only, renders in GitHub |
| Typed verdict enum keyed by `(target, sha)` | pstack `orch ledger` | The only real gate in pstack, because it is code |
| Babysit ordering + shipping contiguity | pstack playbooks | Encode expensive, measured lessons |
| Brief template, missing fields = refuse to spawn | pstack `orchestrate` | *"a worker cannot ask you a question"* |
| Author ≠ reviewer; model diversity as signal | both | Structural, not advisory |
| Runtime-agnostic authority + thin shims | enxvo `.openclaw/` ↔ `.claude/` | One workflow, N runtimes, zero drift |
| Fast/slow gate split wired to `Stop` | enxvo `init.sh` | *"a gate nobody waits for is a gate nobody runs"* |
| Shape-check, not parse-check | enxvo `init.sh` | *"A check that passes when its own queries break…"* |
| Tool-list-as-permission | enxvo agents | Don't ask the model not to edit; don't give it the tool |
| CHECKPOINTS + conditional gates + quote-per-bullet | enxvo | Evaluate the destination, not the path |
| Verification ladder + dispatch table + anti-patterns | enxvo `docs/verification.md` | Reviewer decides the level, not the implementer |
| `current.md` live + `history.md` append-only | enxvo `progress/` | Two files, opposite disciplines |
| Lean human gate, 3 declarative triggers | enxvo `docs/specs.md` | `decision_required` as a data field |
| EARS + `R<n>` + four-link traceability + falsifiability | enxvo | Every link greppable |
| Nudge-never-block PostToolUse that fails open | enxvo `harness-postedit.sh` | Hooks that block on every edit get switched off |
| `expect_fail` negative tests | enxvo gate tests | Catches "failed silently" |
| Anti-stall caps | both | 3 questions max; 3 approaches then persist and stop |
| `## Memory` epilogue naming the absorbing document | enxvo agents | The missing half of most memory schemes |

### 4.4 Fix list

| Fix | Present in |
|---|---|
| Ship real hooks; every non-negotiable becomes enforcement | pstack has zero |
| Ship the merge gate as code with a decision table | enxvo has it as prose |
| Ship worktree create / list / **prune-after-merge** | enxvo has none; 12 stale worktrees |
| One JSON Schema for state; lifecycle enum in one source | enxvo duplicates it 6× |
| Validate the prose: frontmatter, links, size caps | pstack: 125 files, 0 tests |
| Move model routing into config, read at runtime | pstack hardcodes it 9+ places |
| Persist state for every long path, not just orchestrate | pstack: 22 of 23 playbooks |
| Concurrency caps, timeouts, unique run ids for fan-out | pstack: none; `/tmp/<slug>/` collides |
| Keep the router small; principles as references | pstack: ~30 KB before the first tool call |
| No hard runtime lock-in | pstack ties to Bun; enxvo to bash + jq |

### 4.5 Drop list

pstack's `openspec`-equivalent hard dependency, Graphite `gt`, `bro`, `typescript-best-practices`, `teach`, `automate-me`, the Comment Sicko persona, and the specialist agents' project-context blocks. Enxvo's Go/Bun/Railway/Stripe/KoSIT specifics and its permission allowlists. **[inference]** In every case the *pattern* is portable and the *binding* is not.

---

## Sources

**pstack (primary):** [tree](https://api.github.com/repos/cursor/plugins/git/trees/main?recursive=1) · [plugin.json](https://raw.githubusercontent.com/cursor/plugins/main/pstack/.cursor-plugin/plugin.json) · [README](https://raw.githubusercontent.com/cursor/plugins/main/pstack/README.md) · [poteto-mode](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/SKILL.md) · [playbooks](https://github.com/cursor/plugins/tree/main/pstack/skills/poteto-mode/playbooks) · [orch store.ts](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/poteto-mode/scripts/orch/store.ts) · [watch-pr](https://github.com/cursor/plugins/tree/main/pstack/skills/poteto-mode/scripts/watch-pr) · [all 44 skills](https://github.com/cursor/plugins/tree/main/pstack/skills) · [plugin.schema.json](https://raw.githubusercontent.com/cursor/plugins/main/schemas/plugin.schema.json)

**Cursor docs:** [Plugins](https://cursor.com/docs/plugins) · [Plugins Reference](https://cursor.com/docs/reference/plugins) · [Skills](https://cursor.com/docs/skills) · [Rules](https://cursor.com/docs/rules) · [Subagents](https://cursor.com/docs/agent/subagents) · [Hooks](https://cursor.com/docs/hooks)

**Claude Code docs:** [plugins](https://code.claude.com/docs/en/plugins) · [plugins-reference](https://code.claude.com/docs/en/plugins-reference) · [plugin-marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) · [discover-plugins](https://code.claude.com/docs/en/discover-plugins) · [skills](https://code.claude.com/docs/en/skills) · [sub-agents](https://code.claude.com/docs/en/sub-agents) · [hooks](https://code.claude.com/docs/en/hooks) · [hooks-guide](https://code.claude.com/docs/en/hooks-guide) · [settings](https://code.claude.com/docs/en/settings) · [permissions](https://code.claude.com/docs/en/permissions) · [memory](https://code.claude.com/docs/en/memory) · [checkpointing](https://code.claude.com/docs/en/checkpointing) · [env-vars](https://code.claude.com/docs/en/env-vars) · [headless](https://code.claude.com/docs/en/headless)

**enxvo (read-only, `main@99cb205c`):** `AGENTS.md` · `CLAUDE.md` · `CHECKPOINTS.md` · `init.sh` · `feature_list.json` · `skills-lock.json` · `Makefile` · `.claude/{agents,commands,skills,settings.json}` · `.openclaw/agents/` · `.grok/skills/` · `scripts/harness-*.sh` · `openspec/{config.yaml,schemas/enxvo/}` · `progress/` · `docs/{specs.md,verification.md,adr/,runbooks/}` · `.github/{workflows,actions}/` · `tests/`

**Also read:** `ejemplo-harness-subagentes` — a portable distillation of the enxvo harness, also a private local repository · `~/.claude/plugins/cache/claude-plugins-official/{mattpocock-skills,figma}/` — real installed plugin manifests and skills

**Measured locally (2026-08-19):** bun 1.3.11 vs node v24.14.0 cold start and a representative gate workload; Claude Code v2.1.235 distribution format.
