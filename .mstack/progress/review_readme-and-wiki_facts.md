# Review - readme-and-wiki (lens: facts)

**Verdict:** CHANGES_REQUESTED

Every factual claim in the diff was treated as wrong until a source proved it. Code citations were
opened line by line, pasted command output was re-run against a fresh scratch repository, GitHub and
Claude Code claims were fetched from the pages the docs name, and the `sd` publish commands were run
against a copy of `docs/wiki/`. Most of it holds. Nineteen findings do not, six of them substantive.

---

## Acceptance, quoted

**"A first-time reader goes from clone to a first closed item by following the README in order; every command block is copy-pasteable and its output shown from a real run"**

Partly met. I created a fresh repo at `scratchpad/review-facts-demo` (git init, `greet.py`,
`test_greet.py`) and drove the README's five commands with `bin/mstack`.
Every block in *"Your first item, in five commands"* reproduced byte for byte: `added 1 greet-flag
(pending)`, `1 greet-flag (in_progress)`, the `in_progress -> done` refusal with its `--force` hint,
`recorded test-verified for greet-flag at <sha8>`, and the `only implementer` gate failure with its
`fix:` line. Output pasted under *Verification I ran*.

Two blocks are **not** what the command produces:

- `README.md:205` — the shape-check block prints the **absolute path** of `state.json`, not the bare
  name. See finding 5.
- `README.md:121-122` — the `export-json` fork refusal **truncates the quoted question** mid-way and
  closes the quote, with no ellipsis. See finding 7.

The order itself works: clone → `--plugin-dir` → `/mstack:setup` → add → open → verify → record →
close is followable end to end, and I did follow it.

**"Credit to Lauren Tan (poteto) and the pstack lineage is visible in the README opening, and the full harness-meets-pstack story has its own wiki page"**

Met. `README.md:5-16` is the second heading on the page and names Lauren Tan, links `github.com/poteto`,
states the `cursor/plugins` position and the `poteto` → `pstack` convention; `README.md:315-324`
repeats it with the MIT line, `"Copyright (c) 2026 Lauren Tan"`. All four facts match
`docs/research/pstack-port.md:27`. `docs/wiki/The-Story.md` is the dedicated page, and
`docs/wiki/_Footer.md:1` carries the credit on every wiki page. One nit at finding 17.

**"docs/wiki/ holds Home, Getting-Started, The-Story, How-A-Work-Item-Flows, Gates-and-Hooks, The-CLI, State-Files, Status-Line, Publishing-the-Wiki, _Sidebar and _Footer; every technical claim traces to the research doc, the code, or an official doc"**

First half met — `git diff main...HEAD --stat` shows exactly those 11 files and no others under
`docs/wiki/`. Second half **not** met. All fourteen `file:line` citations resolve and say what the
pages claim (table below), but the misattributed pstack quote (finding 2), four unsourced GitHub
claims (findings 3, 4, 14, 15), the contradicted subagent claim (finding 6), the harness "milliseconds"
claim (finding 8), and three Claude Code claims that do not survive their own citations (findings 9,
10, 11, 12) each fail this bullet.

**"Every relative link in README.md and docs/wiki resolves; Publishing-the-Wiki documents the exact route from these files to a live GitHub wiki"**

First half met: 53 relative links checked, 0 broken. I also swept for link forms the checker cannot
see — `[[wiki]]` links, reference-style definitions, anchor-only fragments — and there are none, so
the 53 is the whole population.

Second half **not** met as written. The route's mechanics are mostly correct against docs.github.com
(seven of eight quoted sentences are verbatim), but step 5's command **corrupts this page's own
prose** while the page claims the opposite (finding 1), and step 2's central claim is attributed to
docs that do not make it (finding 3).

**"No claim a fact-check round verified is weakened or contradicted, and the CHANGELOG records the docs round under Unreleased"**

Second half met: `CHANGELOG.md:3-22` adds only an `Unreleased` section; `git diff main...HEAD --
CHANGELOG.md` touches nothing else, and the `0.1.0` section including *"Found by the fact-check"* is
byte-identical.

First half largely met, with the deletions relocated rather than dropped. I diffed
`README.md` against `main` and traced every removed sentence:

| Removed from README | Where it went |
|---|---|
| `statusLine` from your settings + `([statusline docs](…))` citation | preserved verbatim at `docs/wiki/Status-Line.md:33-35` |
| substitution-table reasoning + `plugins-reference` citation | preserved verbatim at `docs/wiki/Status-Line.md:102-105` |
| `refreshInterval` rationale | `docs/wiki/Status-Line.md:47-50` |
| absolute-path fallback note | `docs/wiki/Status-Line.md:52-55` |
| degradation rules | `docs/wiki/Status-Line.md:57-62` |
| subagent rows + why mstack ships none | `docs/wiki/Status-Line.md:71-109` |
| "both halves of that link are load-bearing" / tabs-vs-spaces anecdote | `docs/wiki/How-A-Work-Item-Flows.md:96-99` |
| "a check that passes when its own queries break…" | claim survives in reworded form, `README.md:209-212` |

Runtime numbers survive unchanged: **21.7 / 48.0 / 23.8 / 21.5 ms** (`README.md:259-262`), the
"two milliseconds is not worth a build artifact" reasoning (`:264-267`), and the 22.6 floor paragraph
(`:271-276`, reflowed only — no words changed). The five hook table rows (`:150-156`) and the
shape-check example are untouched by the diff.

The one deliberate change is correct: `verdict stale (1)` → `verdict stale` matches
`src/statusline.ts:156-160`, whose comment says *"No count: `stale.length` is every row at any other
SHA, so it grew with the age of the item and said nothing about how stale anything was"*, and its
test — `✔ the stale marker carries no count, because the count was of history` — passes.
`CHANGELOG.md:20-22` records it.

**But:** the CHANGELOG's own new claims at `:11-15` ("every command block backed by a live run",
"the one GitHub behaviour the official docs do not state") are contradicted by findings 1, 3, 4 and 5.

---

## Citations I opened, one by one

| Cited in | Range | Verdict |
|---|---|---|
| `Gates-and-Hooks.md:25` | `src/hooks.ts:205-243` | Exact. `GUARDS` array; all six table rows match, including the `--force-with-lease` carve-out (comment at :207-209) and the `-d --force` spelling (:225-231) |
| `The-CLI.md:20` | `src/ledger.ts:17-23` | Exact. `VERDICTS`, five values |
| `Status-Line.md:18` | `src/statusline.ts:146-163` | Exact. Verdict-at-HEAD-as-itself, `verdict stale` fallback, `unverified`, and the no-count rationale |
| `Status-Line.md:85` | `src/roles.ts:14-19` | Exact. `REPORT_KINDS`, four roles |
| `Getting-Started.md:13` | `bin/mstack:43-53` | Exact. bun first, node fallback with `NODE_COMPILE_CACHE` under `${CLAUDE_PLUGIN_DATA}` |
| `State-Files.md:24` | `src/state.ts:6-33` | Exact. `interface Item`; all eleven table rows match the fields and their doc comments |
| `State-Files.md:63` | `src/roles.ts:101-106` | Exact. `IMPLEMENTING_ROLES` = `implementer`, `spec-author`; `canCloseAnItem` |
| `State-Files.md:114`, `How-A-Work-Item-Flows.md:136` | `src/roles.ts:64` | Exact. `MIN_REPORT_BYTES = 40` |
| `State-Files.md:121` | `src/gate.ts:36` | Exact. `SPEC_ARTIFACTS`, four files |
| `How-A-Work-Item-Flows.md:9` | `src/lifecycle.ts:10-20` | Exact. `STATUSES`, nine |
| `How-A-Work-Item-Flows.md:15` | `src/lifecycle.ts:63-73` | Exact. Every row of the transitions table matches `TRANSITIONS`, including `done: []` and the `blocked` filter |
| `How-A-Work-Item-Flows.md:45` | `src/lifecycle.ts:25-31` | Exact. `ACTIVE_STATUSES`, five |
| `How-A-Work-Item-Flows.md:75` | `src/lifecycle.ts:49-55` | Exact. `DECISION_REQUIRED_FROM` starts at `spec_ready`, i.e. "past `specifying`" |
| `How-A-Work-Item-Flows.md:75` | `src/cli.ts:255-265` | Exact. The unanswered-fork `UserError` and its hint string |

Fourteen for fourteen. Rung 2 (pointed at the line) for each, rung 4 for the five whose behaviour I
also re-ran.

---

## Verification I ran

```
$ npm test
ℹ tests 169
ℹ suites 0
ℹ pass 169
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4533.47875

$ npm run typecheck
> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit
(exit 0, no output)

$ ./bin/mstack lint-plugin .
...
-- shipped commands
[ok]    32 file(s), no command that would hang on stdin

-- cross-references
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves

-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings

$ ./bin/mstack gate
...
-- workspace
[ok]    on branch docs/readme-and-wiki
[warn]  2 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 1 warning

$ node <scratch>/check-links.mjs README.md docs/wiki/*.md
53 relative links checked, 0 broken

$ ./bin/mstack ledger check readme-and-wiki
FAIL no verdict at 12aeff67; 1 row(s) exist at other SHAs and a new head SHA voids them
```

**On the ledger.** At head `12aeff678d2f442977ac1dfcf195b0231f5f2842` there is no verdict. The one row
that exists is at `06c589e5` — a *different* SHA — and its verifier is `implementer`, so even
re-recorded at head it could not close the item: `canCloseAnItem` (`src/roles.ts:103-106`) rejects
`implementer`. This item needs a verdict from a non-implementing pass at the current head, and it does
not have one.

`lint-plugin`'s three counts (`32 file(s)`, `17 skills and agents`, `37 file(s)`) match
`The-CLI.md:233-239` exactly.

### Pasted output re-run in a fresh scratch repo

Created `scratchpad/review-facts-demo` (`git init -b main`, one Python module, one test), ran
`bin/mstack` against it. Reproduced **exactly** as the docs paste them:

```
$ mstack setup                                    # Getting-Started.md:41-48, The-CLI.md:37-44
[ok]    state.json written
[ok]    progress/current.md written
[ok]    progress/history.md written
[ok]    ledger.tsv ready
[ok]    decisions.tsv ready

PASSED - 0 failures, 0 warnings

$ mstack gate                                     # Getting-Started.md:55-75 — all 14 lines identical
...
[ok]    state.json parses and has the right shape (0 items)
...
[ok]    no active item
...
[warn]  on main; feature work belongs on its own branch
[warn]  1 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 2 warnings

$ mstack gate                                     # Getting-Started.md:128-131, checkpoint untouched
[fail]  1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template
        fix: if this session dies now, nothing tells the next one where to start
FAILED - 1 failure, 1 warning

$ mstack gate                                     # Gates-and-Hooks.md:51-72 — green run, section by section
[ok]    one active item: greet-flag (in_progress)
[ok]    progress/current.md tracks the active item
...
PASSED - 0 failures, 1 warning

$ mstack state set greet-flag --status done       # README.md:79-81, Getting-Started.md:171-173,
mstack: in_progress -> done is not a legal transition        # How-A-Work-Item-Flows.md:35-37, The-CLI.md:86-88
        pass --force if you mean to skip a phase, and say why in decisions.tsv
(exit 2)

$ mstack gate                                     # README.md:92-95, Getting-Started.md:192-197
[fail]  items closed on a verdict from the pass that wrote the code: greet-flag (only implementer)
        fix: a closing verdict has to come from somewhere other than the implementer; run the verification again from a pass that did not write it
FAILED - 1 failure, 1 warning

$ mstack ledger check greet-flag                  # State-Files.md:56, Getting-Started.md:225, The-CLI.md:113
FAIL no verdict at 2d9c8199; 2 row(s) exist at other SHAs and a new head SHA voids them
(exit 1)

$ mstack decide --phase spec --decision "x" --why "y" --evidence "z" --result done --resolves export-csv
mstack: resolving a fork needs --decision to say something; got 1 characters, and a token is not an answer
        answer it properly or leave the fork open; a row nobody can read is the boolean this mechanism exists to avoid
(exit 2)                                          # How-A-Work-Item-Flows.md:92-93, The-CLI.md:133-134

$ mstack fanout check --kind review --worker correctness --worker security --worker tests
-- review fan-out on export-csv                   # The-CLI.md:200-204, including the ok/ok/fail ordering
[ok]    correctness -> review_export-csv_correctness.md (107 bytes)
[ok]    tests -> review_export-csv_tests.md (97 bytes)
[fail]  security returned without writing its report
        fix: its reply is not evidence; re-run it and have it write the file before returning

$ printf '{"model":{"display_name":"Opus"},...}' | mstack statusline    # Status-Line.md:26, The-CLI.md:218
Opus · feat/greet-flag · #2 export-csv · spec_ready · unverified · ctx 31%

$ mstack merge-gate 1                             # Gates-and-Hooks.md:154-156, The-CLI.md:177-179
mstack: gh pr view 1 failed
        Command failed: gh pr view 1 --json number,state,isDraft,mergeStateStatus,reviewDecision,headRefOid,statusCheckRollup - check 'gh auth status'
(exit 2)
```

Also reproduced verbatim and not listed above: `mstack state list`, `state active`, `gate --quiet`
exit 0, `ledger record` / `check` / `summary`, `worktree new` / `list` / `prune` / `prune --yes`,
`decide --resolves` success line, `mstack help`'s exit-codes line, `statusline --subagents` (the typo)
exiting 0 silently, and the two subagent panel rows — `implementer · #2 export-csv · no impl report
yet · 12k` and `reviewer · #2 export-csv · 2 review reports · 3.2k`, with the `Explore` worker getting
no row, exactly as `Status-Line.md:77-83` describes.

### The `sd` publish commands, run against a copy

```
$ cp docs/wiki/*.md <scratch>/publish-check/ && git init && git commit
$ sd '\]\(([A-Za-z-][A-Za-z_-]*)\.md\)' ']($1)' *.md
$ sd -F '](../research/pstack-port.md)' '](https://github.com/<owner>/<repo>/blob/main/docs/research/pstack-port.md)' The-Story.md Gates-and-Hooks.md

$ git diff --stat
 Gates-and-Hooks.md       |  2 +-
 Getting-Started.md       | 12 ++++++------
 Home.md                  | 22 +++++++++++-----------
 How-A-Work-Item-Flows.md |  6 +++---
 Publishing-the-Wiki.md   |  2 +-      <-- prose, not a link target
 State-Files.md           |  2 +-
 The-CLI.md               |  6 +++---
 The-Story.md             |  4 ++--
 _Sidebar.md              | 18 +++++++++---------
 9 files changed, 37 insertions(+), 37 deletions(-)

$ git diff Publishing-the-Wiki.md
-In the repository, pages link to each other as `](Page.md)` so the links resolve for a reader
+In the repository, pages link to each other as `](Page)` so the links resolve for a reader
```

Afterwards: zero residual `](Page.md)` links, and both code fences (`:63` and `:72`) survive intact —
the `-F` two-file scoping does protect the page's own example, exactly as `:75-77` claims. It is
command **1**, not command 2, that damages the page.

---

## Changes required

1. **`docs/wiki/Publishing-the-Wiki.md:57`, `:63`, `:77`** — the documented publish command corrupts
   this page's own prose, and the page asserts that it does not. Running step 5's
   `sd '\]\(([A-Za-z-][A-Za-z_-]*)\.md\)' ']($1)' *.md` over a copy of `docs/wiki/` rewrites line 57
   to *"pages link to each other as `](Page)`"*, which says the opposite of what the sentence exists
   to say. Line 77 claims *"Both commands were run against a copy of these files and the result
   inspected; the diff touches only link targets."* The diff I produced touches one prose line. Fix:
   scope command 1 the way command 2 is scoped (name the eight content pages, or exclude
   `Publishing-the-Wiki.md` and rewrite its links by hand), and correct the claim at :77. Rung 4:
   reproduced, diff pasted above.

2. **`docs/wiki/The-Story.md:49`, `docs/wiki/Status-Line.md:6`** (and pre-existing at
   `README.md:219-220`, `src/ledger.ts:12`) — the twenty-one-stale-verdicts quote is attributed to
   pstack's **orchestration** playbook. It is in `shipping.md`. Verified at rung 4 against the primary
   source: `pstack/skills/poteto-mode/playbooks/shipping.md` contains *"**Twenty-one verdicts went
   stale this way in one run with no signal at all.**"* under *"Re-check that the verdicts still
   describe the code"*; the same search over `orchestrate.md` returns nothing. The research doc agrees
   — `docs/research/pstack-port.md:100-106` places it under the shipping.md bullet, and only the
   12-unit counter-datum (`:142-144`) is orchestrate.md's. Fix: say "shipping playbook". Note the two
   wiki pages are new text, so this is a new error even though `src/ledger.ts:12` already carried it.

3. **`docs/wiki/Publishing-the-Wiki.md:24-26`** (and `:5-6`) — *"The wiki's git repository does not
   exist until a first page is created on github.com. The docs put it directly:"* — the docs do not
   put it directly. The quoted sentence (*"Once you've created an initial page on GitHub, you can
   clone the repository to your computer"*) states a precondition on **cloning**, not the
   non-existence of the repository, and the quote silently drops its tail (*"…with the provided
   URL:"*) without an ellipsis. Fix: either mark the non-existence claim unverified alongside the
   dash-rendering one, or reword to what the source says. Rung 4 (page fetched).

4. **`docs/wiki/Publishing-the-Wiki.md:58`** — *"On the wiki, pages are addressed without the
   extension"* is the premise the whole of step 5 rests on, and none of the four cited docs.github.com
   pages states it. It carries no unverified marker, while `:13` claims *"One claim the docs do not
   state is marked as unverified where it appears."* That count is wrong by at least three (this, plus
   findings 3, 14, 15). Same overcount is repeated in `CHANGELOG.md:13-15`. Fix: mark it unverified,
   or cite a page that states it, and correct "One claim" in both places.

5. **`README.md:205`, `docs/wiki/Gates-and-Hooks.md:82`** — the shape-check block is not the output
   the command produces. Real output:
   `[fail]  /abs/path/to/.mstack/state.json parses but has the wrong shape: .items must be an array, got an object`.
   `src/state.ts:114` interpolates `${file}`, which is `join(dir, "state.json")` from
   `src/paths.ts:25` over a root produced by `resolve()` at `src/paths.ts:44` — so the path is always
   absolute, never elidable to a bare `state.json`. Both pages frame the block as literal output
   (`README.md:64`, `Gates-and-Hooks.md:47`, `:77-79`) and neither marks an elision. Fix: paste the
   real line, or elide the path with `…` the way `The-CLI.md:149` does. Rung 4: reproduced.

6. **`docs/wiki/State-Files.md:4`, `docs/wiki/The-Story.md:71`** — *"a parent never sees a subagent's
   reply body in full"* is contradicted by Claude Code's own documentation. I fetched
   `code.claude.com/docs/en/sub-agents`, which says *"Claude Code scans each subagent's final report
   **before Claude reads it**"* — the parent reads the final report. What it never sees is the
   subagent's **intermediate context** (*"the subagent does that work in its own context and returns
   only the summary"*). The `SubagentStop` argument is unaffected, because it rests on a subagent
   finishing *without writing a file*. Fix: "a parent never sees a subagent's working context", or
   drop the mechanism and keep the recorded incident. Note the phrasing is inherited from
   `docs/research/pstack-port.md:244` and `agents/reviewer.md:72`, so it traces to the authority — but
   the authority is wrong here. Rung 4 (page fetched).

7. **`README.md:121-122`** — the `export-json` refusal block truncates the quoted fork at *"…free to
   change?"* and closes the quote. Run against a copy of `examples/notes-cli`, the real output prints
   the whole field: *"…free to change? The two answers produce different work: one needs a version
   field and a compatibility rule, the other does not."* Fix: paste it in full, or mark the elision.
   (Pre-existing text, unchanged by this diff, but acceptance bullet 1 covers every README block.)
   Rung 4: reproduced.

8. **`docs/wiki/The-Story.md:57-58`** — *"split fast/slow so the fast pass finishes in milliseconds"*
   is asserted of **the harness**. The harness's own gate header, quoted at
   `docs/research/pstack-port.md:185`, says *"Fast gate: toolchain, harness files, feature_list,
   workspace hygiene. **Seconds.**"* Milliseconds is mstack's number, not its parent's. Fix: "in
   seconds", or attribute the milliseconds to mstack.

9. **`docs/wiki/Status-Line.md:34`** — the claim *"Claude Code takes `statusLine` from your settings,
   not from a plugin — the plugin manifest has no such field"* cites
   `code.claude.com/docs/en/statusline`, which does not carry it. I fetched the page: it says only
   *"Add a `statusLine` field to your user settings … or project settings"*, and its single mention of
   plugins is the **opposite** direction (*"Plugins can ship a default `subagentStatusLine` in their
   `settings.json`"*). The claim is supported by `plugins-reference`, whose settings row reads *"Only
   the `agent` and `subagentStatusLine` keys are supported"* — the page already cites that URL
   seventy lines later. Fix: cite `plugins-reference` here, or both. Rung 4 (page fetched).

10. **`docs/wiki/Status-Line.md:67-68`** — *"an EPIPE the docs describe as normal operation"*. The
    statusline page never uses EPIPE, "broken pipe" or SIGPIPE. What it describes as normal is the
    cancellation: *"If a new update triggers while your script is still running, Claude Code cancels
    the in-flight script."* Fix: cite the cancellation, not an EPIPE the docs never name.

11. **`docs/wiki/Gates-and-Hooks.md:18`** — `PostToolUse` is described as firing *"After a matched
    tool call"*. The hooks reference says it fires after a tool call **succeeds**; failures fire
    `PostToolUseFailure`. Fix: add "succeeds".

12. **`docs/wiki/Gates-and-Hooks.md:36`** — *"Hooks are evaluated before the permission mode, so these
    denials hold even under `bypassPermissions`."* The precedence half is documented (*"PreToolUse
    hooks run before the permission prompt, for every tool except `EndConversation`"*, and *"A hook
    that exits with code 2 stops the tool call before permission rules are evaluated"*). The
    `bypassPermissions` conclusion is nowhere stated; it is a deduction. Fix: cite the two documented
    sentences and mark the `bypassPermissions` clause as inferred, or drop it. (Same sentence
    pre-exists at `README.md:156`.)

13. **`docs/wiki/The-Story.md:68-69`** — *"that defect had actually shipped there."* The research doc
    says only *"the exact defect this harness exists to catch (see #395, #396)"*
    (`docs/research/pstack-port.md:193`); it never says the defect shipped. Rung 2 at best. Fix:
    attribute it to the two issue numbers, or soften to what the source supports. Note `README.md:211`
    makes the same claim and is pre-existing.

14. **`docs/wiki/Publishing-the-Wiki.md:94`** — *"The docs also forbid these characters in titles"*.
    The source phrases it as advice with an OS-compatibility rationale (*"Don't use the following
    characters… Users on certain operating systems won't be able to work with filenames containing
    these characters"*), not a platform prohibition. The character set and its order are exactly
    right; only "forbid" overstates. Fix: "advise against".

15. **`docs/wiki/Publishing-the-Wiki.md:51`** — *"They are special files, not pages"*. The cited page
    says of the same two files *"Like every other wiki page, the extension you choose for these files
    determines how we render them"* — the docs treat them as pages. Fix: "special files, rendered as
    the footer and sidebar rather than as ordinary pages".

16. **`docs/wiki/The-Story.md:48`** — *"the one place pstack achieves real gating is its `orch ledger`,
    because that is code with a typed enum"* is stated as settled fact; the research doc marks that
    exact sentence **[inference]** at `docs/research/pstack-port.md:122`. There is unmarked support at
    `:87` (*"the only real gate in the plugin, because it is code"*), so this is a nit, but a page that
    opens *"Every claim here traces to the research document"* should carry the marker.

17. **`docs/wiki/Home.md:7`** — *"(`poteto`, which is where the `-stack` naming comes from)"*. The
    handle supplies the leading letter, not `-stack`: `poteto` → `pstack`, and mstack keeps the shape,
    not the `p`. `README.md:9` and `The-Story.md:15` both get this right. Fix: match their wording.

18. **`docs/wiki/Gates-and-Hooks.md:123-124`** — inside a block otherwise pasted literally, unittest's
    `----------------------------------------------------------------------` rule between
    `-- verification` and `Ran 2 tests in 0.000s` is dropped with no marker. Cosmetic; listed for
    completeness because the page's contract is literal output.

19. **`docs/wiki/Status-Line.md:79`** — the sample row pads `reviewer` with spaces to align the two
    rows. `join()` in `src/statusline.ts:368` emits no padding; the real content strings are
    unpadded (confirmed above). Cosmetic.

---

## Checked and held

Findings I went after adversarially and could not break, one line each.

- All fourteen `file:line` citations open to exactly what the pages claim — see the table above.
- `The-Story.md:17` "156 files, 44 skill directories (23 workflow, 21 single-rule principles), 23
  playbooks, and two TypeScript CLIs with real tests" — `pstack-port.md:44` verbatim.
- `The-Story.md:22-24` router quote, `[...]` elision honest — `pstack-port.md:52`.
- `The-Story.md:33-35` "why are there no planning skills?" quote — `pstack-port.md:21`, verbatim.
- `The-Story.md:44-46` zero hooks + the `architect skipped: <reason>` escape — `pstack-port.md:46, :122`.
- `The-Story.md:50-53` twelve-unit counter-datum, attributed to orchestrate.md — correct; confirmed at
  rung 4 against the primary source, which is where it lives.
- `The-Story.md:52-53` "mstack quotes that number in its own `orchestrate` skill" —
  `skills/orchestrate/SKILL.md:11`.
- `The-Story.md:60-65` harness roles, progress-file discipline, three-trigger human gate —
  `pstack-port.md:174-179, :232-240, :273-278`.
- `The-Story.md:70-73` the `sec-395` incident and *"a reply is not evidence, the file is"* —
  `pstack-port.md:244`, verbatim.
- `The-Story.md:76-77` merge gate as prose, six lifecycle copies, 17 worktrees / 12 stale, no status
  line — `pstack-port.md:294-299`, all four.
- `The-Story.md:85-91` all five convergences — `pstack-port.md:438-444`, point for point, including
  "only pstack's `orch ledger` and the harness's gate script actually were" = "…and enxvo's `init.sh`".
- `The-Story.md:95-100` the sdd/decision_required/cross-cutting resolution — `pstack-port.md:448`.
- `The-Story.md:107-117` all nine fix-table rows — `pstack-port.md:478-487`; "1 of 23 playbooks" is the
  complement of the research's "22 of 23", and "125 Markdown files, zero validation" matches `:482`.
- `README.md:5-16` and `:315-324` credit block — every fact in `pstack-port.md:27`.
- `Gates-and-Hooks.md:9-11` exit-2 and hook-timeout facts — verbatim on `code.claude.com/docs/en/hooks`
  (the "For most hook events" hedge is dropped; harmless for mstack's five events).
- `Gates-and-Hooks.md:20`, `README.md:155` `additionalContext` + the eight-continuation cap — verbatim
  in the hooks docs, unusually precisely.
- `Gates-and-Hooks.md:27-34` PreToolUse guard table — all six rows against `src/hooks.ts:205-243`.
- `Gates-and-Hooks.md:138-141` merge-gate rules — `skills/ship/SKILL.md:23-26`, verbatim, all four.
- `Gates-and-Hooks.md:146-147` `ERROR`/`EXPECTED` and the missing-target regression —
  `src/mergegate.ts:26-46`.
- `Gates-and-Hooks.md:19` "judged per file so one substantial lens does not excuse an empty sibling" —
  `src/hooks.ts:144`, same words.
- `The-CLI.md:9` exit-code line — `mstack help` prints it verbatim.
- `The-CLI.md:23-29` and `State-Files.md:71-79` rung→verdict mapping —
  `skills/router/references/evidence-ladder.md:28-34`.
- `The-CLI.md:207-208` fan-out concurrency cap — `src/fanout.ts:68-72`, including "fails outright
  rather than queueing".
- `The-CLI.md:244-249` lint-plugin's `rg` ban — corroborated by commit `a3c8022` and the `0.1.0`
  changelog; `[ok] 32 file(s), no command that would hang on stdin` in my run.
- `How-A-Work-Item-Flows.md:46-49` the two-active-items incident — `.mstack/decisions.tsv:4` records
  the exact gate string and the revert to `pending`.
- `How-A-Work-Item-Flows.md:57-59` spec-path triggers — `skills/router/SKILL.md:50-52`, verbatim.
- `How-A-Work-Item-Flows.md:105-118` the three seeded example items — `examples/notes-cli/.mstack/`:
  item 1 `done` with that exact ledger evidence string, item 2 four bullets no spec, item 3
  `sdd: true` with the fork quoted verbatim.
- `Status-Line.md:47-50` `refreshInterval` rationale — the statusline docs give the same reason
  ("while a coordinator waits on background subagents") almost word for word.
- `Status-Line.md:52-54` "`bin/` is documented as being on `PATH` for the Bash tool; whether the status
  line process inherits it is not" — correct and correctly cautious; `bin/` on PATH **is** officially
  documented, scoped exactly to the Bash tool.
- `Status-Line.md:102-105` substitution table omits `settings.json` — the plugins-reference table lists
  skills/agents, hooks/monitors, MCP stdio, MCP http-sse-ws, LSP; `settings.json` is absent.
- `Status-Line.md:64-69` lenient `statusline` parsing — `--subagents` (typo) exits 0 silently in my run.
- `README.md:227-238` and `Getting-Started.md:82-93` statusLine JSON block — every field
  (`model.display_name`, `workspace.current_dir`, `context_window.used_percentage`) is documented.
- `README.md:254`, `:278-280` `${CLAUDE_PLUGIN_DATA}` survives updates; deps auto-install on
  package.json + lockfile — both verbatim in plugins-reference.
- `README.md:41`, `:48-49`, `:289-290` install and dev commands — all five documented.
- Publishing-the-Wiki quotes A, E, F, G, H, I and the character list J — verbatim or exact-in-form
  against docs.github.com (the `_Footer`/`_Sidebar` sentence matches to the backtick).
- `Publishing-the-Wiki.md:68` "the one repo-relative link these pages carry … in `The-Story.md` and
  `Gates-and-Hooks.md`" — correct; and the `-F` scoping does protect this page's own copy at `:72`.
- `Publishing-the-Wiki.md:96-99` marks the dash-to-space rendering unverified, explicitly and in the
  page's own voice.
- The `[warn] N uncommitted change(s)` and byte counts that differ between doc and my run are
  environment-dependent, not drift.
- `examples/notes-cli/.mstack/ledger.tsv` holds forty zeros for its SHA while `State-Files.md:59-60`
  says forty zeros no longer record — no contradiction: that file is seeded by hand, and the claim is
  about the `ledger record` write path, which I confirmed rejects them.
- Line-width re-wraps of long single-line refusals (`README.md:94-95`,
  `How-A-Work-Item-Flows.md:79-81`) preserve every word; noted, not counted as findings.

---

## Where this stopped on the evidence ladder

Rung 4 (ran it) for: every `file:line` citation whose behaviour I re-executed, all twelve pasted
command blocks reproduced in a fresh repo, the two `sd` publish commands run against a copy, and the
shipping.md-vs-orchestrate.md attribution checked against the primary source. Rung 4 (fetched the page)
for the docs.github.com and code.claude.com claims. Rung 2 (pointed at the line) for the research-doc
lineage claims, since the research doc is the designated authority and its own primary sources were
spot-checked rather than re-derived in full. Nothing in this report rests on rung 1.
