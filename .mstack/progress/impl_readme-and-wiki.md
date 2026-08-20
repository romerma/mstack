# Implementation report - readme-and-wiki (item 9)

## What changed

The README was rewritten as an on-ramp: the lineage and the credit to Lauren Tan (poteto) on
the first screen, a numbered quickstart, and a first-item tour whose five command blocks and
two refusals are pasted from a real run in a scratch repository. A wiki now exists as eleven
reviewable files under `docs/wiki/`: Home, Getting-Started (clone to first closed item, every
block followed by its live output), The-Story (the lineage and credit page, every claim traced
to `docs/research/pstack-port.md`), How-A-Work-Item-Flows (the `TRANSITIONS` table quoted from
`src/lifecycle.ts`, the fork gate with real refusals, the example repo walked item by item),
Gates-and-Hooks (the five hooks, the guard list, a green gate walked line by line, the merge
gate's rules), The-CLI (every subcommand with real output), State-Files, Status-Line, and
Publishing-the-Wiki (the GitHub route, checked against four docs.github.com pages, with the
two `sd` link-rewrite commands actually run against a copy). The CHANGELOG gained an
Unreleased section for the round. One kept README example was corrected against the code: the
status line renders `verdict stale` with no count (`src/statusline.ts:156-160`, pinned by the
test "the stale marker carries no count, because the count was of history"); the correction
has its own decision row and CHANGELOG line. No verified claim was weakened; the numbers,
the runtime table and the enforcement claims moved verbatim.

## Files

- `README.md` (rewritten, 327 lines)
- `docs/wiki/Home.md` (new)
- `docs/wiki/Getting-Started.md` (new)
- `docs/wiki/The-Story.md` (new)
- `docs/wiki/How-A-Work-Item-Flows.md` (new)
- `docs/wiki/Gates-and-Hooks.md` (new)
- `docs/wiki/The-CLI.md` (new)
- `docs/wiki/State-Files.md` (new)
- `docs/wiki/Status-Line.md` (new)
- `docs/wiki/Publishing-the-Wiki.md` (new)
- `docs/wiki/_Sidebar.md` (new)
- `docs/wiki/_Footer.md` (new)
- `CHANGELOG.md` (Unreleased section added)
- `.mstack/progress/current.md`, `.mstack/decisions.tsv` (two rows), this report, and the
  ledger row (bookkeeping)

Commits: `a35ba42` readme · `3ce1096` wiki · `06c589e` changelog · bookkeeping follows.

## Commands

Demo evidence was generated in a scratch repository
(`<session scratchpad>/demo-repo`), driven with the real `bin/mstack`:
setup, gate green and red, the `current.md` tracking failure, the illegal-transition refusal,
the self-close refusal and its reviewer resolution, the stale `ledger check`, the fork refusal
and its `decide --resolves` answer, a refused one-character decision, `fanout plan/check` with
a named dropout, `worktree new/list/prune` (demo repo only), `statusline` main and
`--subagent`, and `merge-gate`'s no-remote stop. Every output pasted in the README and wiki is
from those runs; ANSI colour stripped and long scratch paths elided as `...`, nothing else
trimmed.

The verify battery, from the repository root:

```console
$ node /private/tmp/.../scratchpad/check-links.mjs README.md docs/wiki/*.md
53 relative links checked, 0 broken

$ npm test
...
ℹ tests 169
ℹ suites 0
ℹ pass 169
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0

$ npm run typecheck
> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit
(exit 0)

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
[ok]    one active item: readme-and-wiki (in_progress)
[ok]    progress/current.md tracks the active item
[ok]    7 closed item(s) carry a ledger verdict
-- workspace
[ok]    on branch docs/readme-and-wiki
PASSED - 0 failures, 1 warning
```

The publish route was itself executed against a copy of the wiki files:

```console
$ sd '\]\(([A-Za-z-][A-Za-z_-]*)\.md\)' ']($1)' *.md
$ sd -F '](../research/pstack-port.md)' '](https://github.com/<owner>/<repo>/blob/main/docs/research/pstack-port.md)' The-Story.md Gates-and-Hooks.md
$ rg -n '\]\([^)h][^)]*\.md\)' . --glob '*.md'
./Publishing-the-Wiki.md:72:sd -F '](../research/pstack-port.md)' ...   # the quoted example itself, intact
```

## Acceptance map

**1. "A first-time reader goes from clone to a first closed item by following the README in
order; every command block is copy-pasteable and its output shown from a real run"**
README in order: the Quickstart with both install routes, setup, and start
(`README.md:33-61`), then "Your first item, in five commands" with real output including both
refusals (`README.md:62-100`), linking at that exact point to the full path. The complete clone-to-closed-item sequence with
every block's live output is `docs/wiki/Getting-Started.md`, linked from the README's
quickstart (`README.md:59-60`) and documentation map (`README.md:306`). Every block in both
files is copy-pasteable (prompt lines carry `$`, output follows), and every output is from the
demo-repo run described above.

**2. "Credit to Lauren Tan (poteto) and the pstack lineage is visible in the README opening,
and the full harness-meets-pstack story has its own wiki page"**
`README.md:5-16` ("Where this comes from") names pstack, Lauren Tan with the `poteto` handle
linked, the naming convention, and the harness, and links The-Story and the research doc; the
expanded Credit section is `README.md:315-324`. The story page is `docs/wiki/The-Story.md`:
pstack and its author, the not-spec-driven correction quoted, the escape-hatch quote, the
unnamed harness, the five convergences, the disagreement and its opt-in resolution, the fix
table, and the credit block. `docs/wiki/_Footer.md` carries the one-line credit on every
published page.

**3. "docs/wiki/ holds Home, Getting-Started, The-Story, How-A-Work-Item-Flows,
Gates-and-Hooks, The-CLI, State-Files, Status-Line, Publishing-the-Wiki, _Sidebar and
_Footer; every technical claim traces to the research doc, the code, or an official doc"**
All eleven files exist with exactly those names (commit `3ce1096`, 11 files, 1329 lines).
Tracing: lineage claims cite `docs/research/pstack-port.md` (linked from The-Story and
Gates-and-Hooks); code claims carry `file:line` (`src/lifecycle.ts:63-73`,
`src/hooks.ts:205-243`, `src/roles.ts:64` and `:101-106`, `src/state.ts:6-33`,
`src/statusline.ts:146-163`, `src/gate.ts:36`, `bin/mstack:43-53`); official docs are linked
where used (code.claude.com statusline and plugins-reference pages, four docs.github.com wiki
pages, named and dated in Publishing-the-Wiki); command behaviour is pasted live output. The
one claim that could not be verified against an official page (dash rendered as space in wiki
titles) is explicitly marked unverified rather than asserted
(`docs/wiki/Publishing-the-Wiki.md:96-99`).

**4. "Every relative link in README.md and docs/wiki resolves; Publishing-the-Wiki documents
the exact route from these files to a live GitHub wiki"**
Link check: `53 relative links checked, 0 broken` (output above; script at
`scratchpad/check-links.mjs`, resolves each target on disk). `mstack lint-plugin .` separately
verifies the 20 reference files and all cross-references. Publishing-the-Wiki gives the route
end to end: enable (Settings → Features → Wikis, per GitHub's docs), first page in the web UI
(quoting the docs on why), `git clone https://github.com/<owner>/<repo>.wiki.git`, the copy,
both exact `sd` commands (run for real against a copy, result quoted above), commit and push,
the `_Sidebar`/`_Footer` special-file rule quoted from GitHub's docs, and the title rules.

**5. "No claim a fact-check round verified is weakened or contradicted, and the CHANGELOG
records the docs round under Unreleased"**
Kept sections moved verbatim or tightened without touching claims or numbers: the one idea,
the hooks table, the roles framing ("a speed bump with an audit trail"), the runtime table
(21.7/48.0/23.8/21.5 ms, the 22.6 floor, the lockfile rationale), the shape-check example, the
statusline non-shipping decision and its documentation links, the fork refusal example. The
single changed example, `verdict stale (1)` → `verdict stale`, moves the README toward the
reviewed code, not away from it: the renderer deliberately prints no count
(`src/statusline.ts:156-160`) and the suite pins it ("the stale marker carries no count,
because the count was of history", 169/169 green). The change is recorded in `decisions.tsv`
(2026-08-19T20:34Z row) and in the CHANGELOG. `## Unreleased` sits above `## 0.1.0`
(`CHANGELOG.md:3`) and records the README rewrite, the wiki with its publish route, and the
explicit credit to poteto.

## Ledger

Recorded after the last content commit:

```
mstack ledger record readme-and-wiki 06c589e50e312a3fb2f184ff149e888da53113c0 test-verified \
  --evidence .mstack/progress/impl_readme-and-wiki.md --verifier implementer
```

Verdict honesty, per the ladder: the pasted command outputs, the link check, the sd publish
transformation and the full battery are rung 4 to 5 for the commands shown (they ran, against
the real binary and the real files, and fail loudly). Prose claims sourced from files (the
lineage story, the hook behaviour descriptions, the panel-finding histories) are rung 2:
`file:line` or a quoted document, not re-executed here. The dash-to-space title rendering
stopped at rung 1 and the page says so. `test-verified` is the rung-4 verdict; nothing here
claims `live-verified` because no reader has walked the on-ramp yet, and this row cannot close
the item: a pass that did not write these pages decides that.

## Fixes after review

Both panel reports returned CHANGES_REQUESTED (reader: 6 findings; facts: 19). Every finding
was applied. The scratch demo was rebuilt from zero and the whole walkthrough replayed as one
coherent run, so every pasted block traces to a single store whose ids mirror
`examples/notes-cli`: `greet-flag` id 1, `cli-search` id 2 (a filler that says it is one),
`export-json` id 3 with `sdd: true` and the fixture's exact `decision_required` text. New run
constants: work commit `4b63888b`, close commit `ccb9e2e`, staleness commit `542ac0cf`, ledger
timestamps `21:08:48.016Z`/`21:08:56.136Z`.

### Reader findings

- **R1 (split identity of the fork item).** The demo store now mirrors the example, and every
  affected block was re-captured, not renamed: the fork refusal
  (`How-A-Work-Item-Flows.md:78-84`, full fixture question), the 1-char decide refusal and a
  real answer that answers the JSON fork (`The-CLI.md`, decide section), worktree
  new/list/prune on `feat/export-json`, fanout on `review_export-json_*` (127/121 bytes), the
  main statusline (`#3 export-json · spec_ready`) and both subagent rows (`#3 export-json`).
  `rg export-csv` over README, CHANGELOG and docs/wiki returns nothing.
- **R2+R6 (unshown commits).** Getting-Started now shows `git add -A` + `git commit` with real
  output at both points: the store commit (`[main cf92869] ... 5 files changed`) and the work
  commit (`[feat/greet-flag 4b63888]`), plus the close-bookkeeping and readme commits the
  staleness demo depends on (`[feat/greet-flag ccb9e2e]`, `[feat/greet-flag 542ac0c]`),
  followed by the re-captured `FAIL no verdict at 542ac0cf` payoff.
- **R3 (gate --full captured with -q).** The demo's `verify` is now
  `python3 -m unittest test_greet -v`, matching every configuration the docs show, and
  `Gates-and-Hooks.md` pastes the full literal transcript, dashed rule included, ending
  `[ok] python3 -m unittest test_greet -v`. Also closes facts finding 18.
- **R4 (instruction/transcript order).** Getting-Started now runs the gate straight after
  `setup` — the pasted two-warning output is the state the reader is actually in — and the
  commit follows with its own real output.
- **R5 (jargon-dense opening).** README opens with two plain-language sentences reusing
  Home.md's formulation (durable store on disk, typed verdicts keyed to a commit SHA, rules as
  code) before "Where this comes from"; credit stays on the first screen.
- **R-verify (verification not executable).** The checker ships at
  `scripts/check-doc-links.mjs` (node builtins only); item 9's `verification` field is now
  `npm test && npm run typecheck && bin/mstack lint-plugin . && node scripts/check-doc-links.mjs README.md docs/wiki/*.md`,
  executed as recorded below (exit 0); README's Development block carries the same line.
  Decision row recorded.

### Facts findings

- **F1.** sd command 1 is scoped to ten named files, excluding `Publishing-the-Wiki.md`, whose
  only `](Page.md)`-shaped text is the prose the old sweep rewrote; the page explains the
  exclusion and what to do if it ever gains intra-wiki links. Route re-run on a fresh copy:
  8 files changed, every changed line a link rewrite, `Publishing-the-Wiki.md` untouched, zero
  residual intra-wiki `.md` links; the ":77" claim now states exactly that.
- **F2.** "orchestration playbook" → "shipping playbook" in `The-Story.md`, `Status-Line.md`,
  `README.md`, and the one comment word in `src/ledger.ts:12`. The twelve-unit counter-datum
  stays attributed to orchestrate.md, where it lives. Decision row records that a docs finding
  deliberately reached one src/ comment line; no behaviour changed.
- **F3.** Publishing step 2 quotes the cloning precondition in full ("...with the provided
  URL") and marks repository-non-existence as observed, unverified.
- **F4.** "addressed without the extension" marked observed-unverified; ":13" reworded to
  plural; CHANGELOG bullet lists all three unverified behaviours.
- **F5.** Shape-check blocks in README and Gates-and-Hooks show `.../.mstack/state.json` with
  the elision stated; the command prints an absolute path.
- **F6.** `State-Files.md:4-6` and `The-Story.md` reworded to the working-context formulation
  (a parent sees the final reply; it never sees the working context); the incident and "a
  reply is not evidence, the file is" kept; `agents/*.md` and the research doc untouched.
- **F7.** README's fork refusal now pastes the full fixture question, re-captured live.
- **F8.** The harness's fast gate "finishes in seconds", with mstack's milliseconds attributed
  to mstack.
- **F9.** The plugin-settings claim now cites plugins-reference ("only the `agent` and
  `subagentStatusLine` keys"); the statusline docs link moved to the wiring sentence it
  supports.
- **F10.** EPIPE reworded: the docs call the in-flight cancellation normal; the EPIPE is what
  it produces mid-write.
- **F11.** PostToolUse row: fires after a call succeeds; failures fire `PostToolUseFailure`.
- **F12.** Gates-and-Hooks quotes the two documented permissions sentences and derives the
  `bypassPermissions` consequence from the ordering, labelled as following from it; README's
  hook row rests on the documented ordering the same way.
- **F13.** The-Story attributes the shape-check defect to the two issue numbers the harness's
  gate comment pins it to.
- **F14.** "forbid" → "advise against", with the OS-compatibility reason.
- **F15.** `_Sidebar`/`_Footer`: "special files, rendered as the footer and sidebar rather
  than as ordinary pages".
- **F16.** The-Story uses the research's sourced formulation: the orch ledger is "the only
  real gate in the plugin, because it is code".
- **F17.** Home.md matches the README's convention wording (`poteto` → `pstack`).
- **F18.** Closed by R3's full literal transcript.
- **F19.** Subagent sample rows unpadded, matching the renderer.
- **CHANGELOG.** The contradicted Unreleased bullets now describe the corrected state, and a
  "Found by the docs review panel" subsection records the round in the file's voice.

### Verification of the fix round

```console
$ npm test
ℹ tests 169
ℹ pass 169
ℹ fail 0

$ npm run typecheck
(exit 0)

$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
54 relative links checked, 0 broken

$ ./bin/mstack gate
[ok]    one active item: readme-and-wiki (reviewing)
[ok]    progress/current.md tracks the active item
PASSED - 0 failures, 1 warning

$ sh -c "<item 9 verification field, read from state.json>"
PASSED - 0 failures, 0 warnings
54 relative links checked, 0 broken
(exit 0)
```

Corrected publish route, fresh copy, diffed: 8 files changed 37/37, `git diff -U0` filtered
for changed lines without a link form returns none, `Publishing-the-Wiki.md` untouched.

No ledger row was recorded for the fix round and the item status was not touched; the closing
verdict belongs to a pass that did not write this.
