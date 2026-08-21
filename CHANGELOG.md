# Changelog

## Unreleased

The docs round, before publication.

- A verification nobody ran is no longer treated as a check. `state.verify` and an item's
  `verification` were executed by nothing but a human typing `mstack gate --full`; in one real
  session an item's field held a non-executable string from intake and stayed red for 230
  minutes across four agent passes, because `sh -n` accepts such a string and only running it
  says otherwise. `--full` now records what it ran, against which commit, and how it went, in
  a new machine-local `.mstack/verification.tsv`; the fast gate reads that back and, from
  `verifying` on, refuses to call an item green on a run that never happened here. `state set
  --status done` re-checks at the transition, because `done` is not an active status and
  relabelling the item would otherwise make the gate stop looking.
- The cost line is at `verifying` and nowhere earlier, and that is the whole design. This
  check rides the `Stop` hook, which fires at the end of every turn; held from `in_progress`
  it would go red after every commit for the phase where most commits happen, and a gate that
  is red for a normal mid-session state is a gate someone switches off. `verifying -> done` is
  the only legal transition into `done`, so it is also the earliest status that is sufficient.
  Nothing runs a test suite on a hook: the `Stop` path reads one small TSV.
- The question item 16 left open — whether wiring `--full` behind a hook could work, given
  that the verify command inherits stdio and the hook's JSON owns stdout — is answered by not
  doing it. `stdio: "inherit"` is unchanged, the characterization test that pins it is
  untouched, and a human running the full gate still sees their suite's progress live.
- `mstack gate --full` that ran no verification at all now fails and exits 1. It warned and
  exited 0, which made "you asked for the full gate and got nothing" indistinguishable from
  "you asked for it and it passed" — the same check-that-cannot-fail shape as `{"items": {}}`
  passing a gate that then enforces nothing. A reviewer who meets that failure is meeting a
  store-configuration problem, not a defect in the item under review, and
  `agents/reviewer.md` now says so.
- A receipt records the **working tree** as well as the commit, because the first version of
  it certified a commit and not a tree: a green `gate --full`, then an uncommitted edit that
  broke the very command, then a close, all at exit 0 with the verification red the whole
  time. Paths under `.mstack/` are excluded from that fingerprint, so writing your own progress
  notes does not void a run and editing code does.
- An unreadable `.mstack/verification.tsv` is a gate failure rather than an exception that
  escapes the run. It made `mstack hook stop` emit zero bytes and exit 0 — byte-identical to a
  green gate — and threw `mstack gate` out mid-run so the workspace section and the summary
  never happened. That is the same defect an unreadable `decisions.tsv` once had, reintroduced
  by the change built to close a sibling of it, and found by review rather than by us.
- Forcing an unverified close now requires `--closed-by`, and the reason is stored prefixed
  `closed unverified (forced):`. The override used to leave nothing behind but a printed line,
  so no later reader could tell a forced close from a real one.

**Upgrading an existing store.** `mstack setup` is safe to re-run and installs the new
`.mstack/.gitignore`; do that once per store. If a `.mstack/verification.tsv` was already
committed, also run `git rm --cached .mstack/verification.tsv` — `.gitignore` does not apply to
a path git is already tracking, and a committed receipt cannot vouch for the commit that
carries it. `mstack gate` warns with both commands when it finds the file unignored.

- README rewritten around the story and the on-ramp: where mstack comes from on the first
  screen, a quickstart, and a first item walked in five commands whose output — refusals
  included — is pasted from a real run.
- A wiki, as files a reviewer can read before the GitHub repository exists: nine pages plus
  `_Sidebar` and `_Footer` under `docs/wiki/`, every command block backed by a live run and
  every claim traced to the research doc, the code, or an official page. The publish route is
  itself a page, its link-rewrite commands tested against a copy, and the GitHub behaviours
  the official docs do not state — extension-free page addressing, the wiki repository not
  existing before its first page, dashes rendered as spaces in titles — are marked as
  observed and unverified rather than asserted.
- Credit to Lauren Tan (poteto) made explicit, in the README opening and in a wiki page of its
  own: pstack's authorship, its MIT license, the `poteto` → `pstack` naming convention this
  plugin keeps, and pstack's actual position — quoted, not paraphrased — that it does not
  believe in planning.
- The README's status line example dropped its "(1)": the renderer deliberately prints
  `verdict stale` without a count, because the number of rows at other SHAs grows with the age
  of the item and says nothing about how stale anything is.
- Publication prep. Machine-local absolute paths scrubbed from the research doc and the
  committed progress reports — the private harness repository is still cited by name and
  commit, but by relative path now, not by where it sat on one laptop. The quickstart
  placeholders pinned to the real URL, `romerma/mstack`, in the README and the two wiki
  pages that carried them, and `homepage` and `repository` added to `plugin.json`.
- `CONTRIBUTING.md` and `SECURITY.md`. The first carries the rules a PR would otherwise
  learn from a review comment: no build step, no runtime dependencies, both runtimes green,
  pasted output from real runs. The second says what the guardrails are honestly — speed
  bumps with an audit trail, not a sandbox — and routes vulnerability reports to GitHub's
  private advisory form rather than a public issue.
- Running `/mstack:setup` on this repository itself surfaced a contradiction: the setup
  skill tells the project to carry a `CLAUDE.md`, while `lint-plugin` warned about any
  plugin-root `CLAUDE.md`. The linter now accepts the file when `.mstack/` sits beside it —
  the store is evidence the repo is a worked-in project whose sessions do load the file —
  and this repo carries the `CLAUDE.md` the skill asks for. The call has its row in
  `decisions.tsv`.

### Found by the docs review panel

Two reviewers on the docs round, a cold reader who rebuilt the walkthrough by hand and a
fact-checker who re-derived every claim. Twenty-five findings, all fixed, the pattern familiar
from the code rounds: the enforcement was real, the transcripts mostly held, and the edges had
drifted from their sources.

- Three pasted transcripts did not reproduce when followed literally: the walkthrough said
  commit-then-gate while its output was gate-then-commit, two "Commit" instructions never
  showed the command whose staging the staleness demo depended on, and `gate --full` was
  captured with `-q` while every configuration shown uses `-v`. The demo was rebuilt from
  scratch and every block re-captured from the one run.
- The illustrative fork item was two different items with two different questions across three
  pages, and neither matched the shipped example's ids. The scratch queue now mirrors
  `examples/notes-cli`: same slug, same id, same fork text.
- The twenty-one-stale-verdicts quote was attributed to pstack's orchestration playbook; it is
  in `shipping.md`. Fixed in three pages and in both `src/` comments that carried it.
- The shape-check block showed a bare `state.json` where the command prints an absolute path;
  "a parent never sees a subagent's reply body in full" contradicted the sub-agents docs
  (what a parent never sees is the working context); the harness's fast gate finishes in
  seconds, not milliseconds — milliseconds is mstack's number; and the wiki publish command
  rewrote this documentation's own prose until its file list learned to exclude the page that
  quotes it.
- The `bypassPermissions` consequence of the PreToolUse deny is no longer on the hooks page it
  was quoted from; it is now presented as following from the two sentences the permissions
  docs do state.
- Item 9's recorded verification was prose, not a command. The link checker now ships at
  `scripts/check-doc-links.mjs` and the field runs it.
- Two findings reached files item 9 could not touch and closed as their own item: the
  reply-body phrasing in the five agent contracts and the router now matches the sub-agents
  docs (the working context is what a parent never sees; the final reply comes back), and the
  three pages that characterised the shape-check defect two different ways now share one
  sentence — shipped in production, pinned by the gate's own comment to two of the harness's
  issue numbers. The four prose lines the round-2 sweep had named as past the column
  convention are rewrapped with it.

## 0.1.0

First release.

- `/mstack` router over seven playbooks, plus eleven phase skills the router chains.
- Opt-in spec path, triggered by `sdd`, `decision_required`, or a cross-cutting change.
- Five agents. `orchestrator`, `spec-reviewer` and `reviewer` ship without `Write` or `Edit`,
  so no pass can approve its own work.
- Five hooks: `SessionStart`, `PostToolUse`, `SubagentStop`, `Stop`, `PreToolUse`.
- `mstack` CLI: gate, state, ledger, decide, worktree, merge-gate, fanout, statusline, lint-plugin.
- Durable state in `.mstack/`, with a shape-checking gate rather than a parse-checking one.
- A status line whose reason for existing is the stale verdict: a ledger row is voided by a new
  head SHA, and this is the only place that shows up before it matters. `--subagent` renders the
  agent panel rows, flagging a worker that has not written its report yet.
- Fan-out that is code rather than prose: report paths allocated before launch so parallel
  workers cannot overwrite each other, the concurrency cap refused rather than queued, and
  workers that did not report named rather than counted.
- Source playbooks for the *why* half of `understand`, each organised around what that source
  systematically lies about, and each stating the rung of the evidence ladder it can reach.
- The gate checks that `progress/current.md` says something, not merely that it exists.
- `decision_required` is enforced rather than announced: an unanswered product fork blocks every
  phase past `specifying`, and `mstack decide --resolves` is the only way to answer one.
- The status line parses its arguments leniently, because a typo in a user's settings.json must
  not turn the bar into an error message. Everywhere else a typo stays loud, and `state list`,
  `state active` and `ledger summary` now reject stray arguments instead of ignoring them.
- 169 tests, run under both `bun test` and `node --test`, plus a CI job pinned to node 22.6.

### Found by the review panel, before the first release

Four independent reviewers with fresh context, three lenses on the status line and one adversarial
pass over the whole plugin. Everything below was reproduced before being fixed.

- The status line could exit 1 with a stack trace. `process.stdout.write` is asynchronous on a
  pipe, so an EPIPE arrived after the surrounding try/catch had already returned — on the one path
  whose whole promise is that it can never break a session, in the case the docs describe as
  normal (Claude Code cancels the in-flight script when a new update triggers).
- `require_verdict_to_close` did not require a verdict. Any non-empty `closed_by` cleared it, so
  `--closed-by "I checked it myself"` closed an item against an empty ledger, and the shipped
  example taught the shortcut. That is the requirement-with-an-escape-hatch shape this project
  criticises pstack for, shipped inside the check meant to prevent it. The escape hatch now lives
  where it belongs: `verifier-blocked` in the ledger, typed, keyed to a SHA, carrying its reason.
- A `verifier-failed` verdict *at the current head* rendered as "verdict stale" — the status line
  saying nobody had verified this, when the verifier had run and failed.
- A `blocked` item rendered as `idle`.
- One unreadable file in `progress/` blanked every subagent row and silently disabled the
  `SubagentStop` guard, because the same unguarded `statSync` was copy-pasted into both with the
  comparisons written in opposite directions.
- The `PreToolUse` guards matched spellings rather than operations: `git -C dir push --force`,
  `git push origin +main` and `git branch --delete --force` all passed.
- `merge-gate` dropped the ledger check and returned `GO` when it could not find a target.
- Four zero-byte files satisfied "the spec is complete".
- The linter checked `mstack:` cross-references in skills and agents only, leaving the playbooks
  where those names are actually written — the same scope bug already fixed for links.
- Colour was unverified everywhere: repainting a passing verdict red left every test green.

### Found by the second panel

Two more reviewers on the fork gate and on the plugin as a whole. Twenty-six findings, every one
reproduced here before being fixed. The pattern they named: the enforcement points were real, the
floors on what satisfies them were not — an `sdd` item could reach `done` with `PASSED` and exit 0
having proven nothing.

- **`closed_by` relocated.** The gate never read the ledger's `verifier` column while
  `agents/implementer.md` tells the implementer to record `--verifier implementer`, so the pass
  that wrote the code closed the item — inside the check built to stop exactly that.
- `Number.parseInt` stops at the first non-digit, so `mstack state set 2fa-login` moved whichever
  item happened to be id 2, and `mstack decide --resolves 2fa` attached reasoning to another
  item's fork. Both exited 0.
- `mstack state add` never checked the slug it was handed, so one command wrote a `state.json`
  its own parser rejects, with no CLI route back. The shape check guarded the read path while the
  writer walked past it.
- `mstack setup --force` emptied the work queue and reported success, leaving ledger rows pointing
  at items that no longer existed.
- Half of "keyed by `(target, sha)`" was unvalidated: forty zeros recorded fine and read back
  indistinguishable from a real commit. `evidence` needed one character.
- A product fork was answered by the letters `x` and `y`, because `--why` and `--evidence` were
  optional and no column said which fork a row was about. Twelve concurrent `decide` calls
  produced eight distinct timestamps, so the key was not a key.
- `mstack worktree prune` used `git status --porcelain`, which excludes gitignored files by
  definition, so a worktree holding a `.env` reported clean and was deleted. It also offered the
  worktree you are standing in.
- In the merge gate, a `StatusContext` of `ERROR` or `EXPECTED` passed through as green. Anything
  unrecognised now stops the merge.
- Prose corrected where it was false: the README claimed the `Stop` hook "never burns the
  eight-block budget" when the hooks reference says `additionalContext` keeps the same loop
  protections; a guard comment claimed `-d --force` was covered when the pattern did not cover it;
  the fan-out error said the excess "queues silently" when spawning past the cap fails outright.

### Found by the fact-check

A third reviewer checked every factual claim in the eight `why` playbooks against the tools' own
documentation — which the evidence ladder demands and writing them from knowledge skipped.

- **One command hung the agent that ran it.** `rg PATTERN --glob '*.md'` with no path takes
  ripgrep's stdin form and blocks forever when stdin is not a terminal, which is how a subagent
  runs a command. It shipped in the playbook whose job is to *start* an investigation. The linter
  refuses that shape now.
- "The branch commits, which no longer exist" is false: a squash merge removes them from the
  trunk only, and they survive on the PR at `refs/pull/<n>/head`. Inherited from pstack and
  strengthened in the rewrite.
- Grafana and Datadog dashboards both keep dated, attributed version history — the one telemetry
  artifact that reads like a commit, and the page said it did not exist.
- Datadog keeps metrics 15 months, not weeks; Slack DMs are searchable by the participant; Linear
  moves an issue to Done automatically on PR merge; a Sentry issue resolves from a commit in a
  release as well as by hand; Notion's comments API returns un-resolved comments only; missing
  telemetry is interpolated away rather than plotted as zero.

### Deliberately not shipped

- A plugin `settings.json` with `subagentStatusLine`. A plugin may ship one, but neither
  `${CLAUDE_PLUGIN_ROOT}` nor the plugin's `bin/` is documented as reaching that file, so the
  command could not name its own script. The renderer ships as `mstack statusline --subagent` and
  the README documents wiring it from settings a user controls.

### Runtime

- No build step and no committed artifact: `src/` is what ships and what runs, kept cheap
  with `NODE_COMPILE_CACHE`.
