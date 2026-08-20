# Review - readme-and-wiki (reader lens)

**Verdict:** CHANGES_REQUESTED

I read as the stranger the docs claim to serve, then actually built the Getting-Started
walkthrough by hand in a fresh scratch repo and ran every command against the real
`bin/mstack`, rather than trusting the pasted transcripts. Three of the pasted transcripts do
not reproduce when followed literally, and the same illustrative work item is told two
different, contradictory ways across pages (once within a single page). These are the kind of
stumbles this lens exists to catch, not style nits, so I am requesting changes.

## Acceptance, quoted

**"A first-time reader goes from clone to a first closed item by following the README in
order; every command block is copy-pasteable and its output shown from a real run"**
Partially met. The README's own five-command tour (`README.md:62-100`) matches a real run
exactly (verified below). But the promise extends to the linked "step-by-step version"
(`README.md:59-60` -> `docs/wiki/Getting-Started.md`), and that page's own pasted output does
**not** reproduce when its own instructions are followed literally, in two places
(`docs/wiki/Getting-Started.md:51-76` and `:220-226`, both detailed under Changes required). A
first-time reader following the page in order hits a real command failure the page does not
warn about. Not met as written.

**"Credit to Lauren Tan (poteto) and the pstack lineage is visible in the README opening, and
the full harness-meets-pstack story has its own wiki page"**
Met. Credit is the README's very first content section, `## Where this comes from`
(`README.md:5-16`), naming Lauren Tan, linking `github.com/poteto`, and stating the `poteto` ->
`pstack` convention, reinforced by a dedicated `## Credit` section at the end
(`README.md:315-324`) and `docs/wiki/_Footer.md:1` on every wiki page. I confirmed
`github.com/poteto` is a real account (`name: "lauren"`) and `cursor/plugins/pstack` is a real
path in that repo via `gh api`. `docs/wiki/The-Story.md` delivers the full story: what each
parent contributed, where they agree (five points, `The-Story.md:81-91`), where they disagree
and how mstack resolved it (`:93-100`), and a fix table (`:107-117`). Its pulled quote from
pstack's real README ("why are there no planning skills?") is verbatim-accurate against the
live file — I fetched it and diffed it by hand. This bullet is fully earned; see the caveat on
bullet 1's ordering below, which is a clarity finding, not a credit-visibility finding.

**"docs/wiki/ holds Home, Getting-Started, The-Story, How-A-Work-Item-Flows, Gates-and-Hooks,
The-CLI, State-Files, Status-Line, Publishing-the-Wiki, _Sidebar and _Footer; every technical
claim traces to the research doc, the code, or an official doc"**
Met on the file list: all eleven names exist at `docs/wiki/`, nothing more, nothing missing.
Largely met on tracing: I sampled seven `file:line` citations across
How-A-Work-Item-Flows.md, State-Files.md and Status-Line.md against the real source
(`src/lifecycle.ts:10-20`, `:25-31`, `:63-73`; `src/cli.ts:255-265`; `src/roles.ts:64`,
`:101-106`; `src/gate.ts:36`; `src/statusline.ts:146-163`) and every one matched exactly,
including the reasoning in the source comments. `docs/wiki/Status-Line.md:107-109`'s claim that
the no-subagentStatusLine decision is recorded in `decisions.tsv` is also verified — the row is
there, dated `2026-08-19T19:04:49.706Z`, with both documentation links. I did not check every
citation exhaustively (a fact-check pass is a different lens); the sample is uniformly accurate.
Where this bullet is not met: the "example repository" content on
`docs/wiki/How-A-Work-Item-Flows.md` and the CLI/status-line examples on `The-CLI.md` and
`Status-Line.md` do not trace to the same item, and one of the two versions does not trace to
anything shipped in this repository at all — see Changes required #1.

**"Every relative link in README.md and docs/wiki resolves; Publishing-the-Wiki documents the
exact route from these files to a live GitHub wiki"**
Met on link resolution: I extracted every `](...)` target from `README.md` and all eleven
`docs/wiki/*.md` files and resolved each non-`http` target against disk myself (not the
implementer's script). Zero broken links; my checker's two initial hits were both false
positives — inline-code and a regex-replacement string inside `docs/wiki/Publishing-the-Wiki.md`
that only look like links. Met, and unusually well, on the publish route: I copied the real
`docs/wiki/*.md` into a scratch directory and ran both `sd` commands from
`docs/wiki/Publishing-the-Wiki.md:63` and `:72` verbatim. The result matched the page's claim
exactly — every intra-wiki `](Page.md)` link became `](Page)`, the one repo-relative link
(`../research/pstack-port.md`, in `The-Story.md` and `Gates-and-Hooks.md`) was rewritten to the
GitHub blob URL, and `Publishing-the-Wiki.md` itself (excluded from that command's file list on
purpose, per its own text at `:75-77`) correctly kept its own quoted example intact. `diff`
against the originals touched only link targets, as claimed.

**"No claim a fact-check round verified is weakened or contradicted, and the CHANGELOG records
the docs round under Unreleased"**
Not this lens's job to re-run the fact-check, but nothing I read contradicts it, and
`CHANGELOG.md:3-21` has the `## Unreleased` section with the docs round, above `## 0.1.0`, and
its bullet points (README on-ramp, the wiki, credit to poteto, the `verdict stale` count
removal) match what I actually found in the files. No finding here.

## Verification I ran

I built the Getting-Started walkthrough by hand rather than trusting the pasted output. Scratch
repo: `<session scratchpad>/review-reader-demo`,
`git init`, seeded with a trivial `greet.py` (prints `Hello, <name>`, default `world`) and
`test_greet.py`, matching what Getting-Started.md:101 assumes ("The scratch repository has
`greet.py` and `test_greet.py`"). Ran every command through
`bin/mstack` (the real binary; the page says bare `mstack` because
the plugin puts it on `PATH` for Claude Code's own Bash calls, and it does say this once,
clearly, at `docs/wiki/Getting-Started.md:32` — "`mstack` is now on `PATH` for every Bash call
Claude Code makes").

Matched exactly: `mstack setup` output, `mstack state add/set/active`, `mstack gate` after the
`current.md` checkpoint is filled in, the illegal `in_progress -> done` refusal, the full legal
transition sequence (`reviewing` -> `verifying` -> `done`), the implementer-only close refusal,
the reviewer verdict fixing it, and the `unittest -v` per-test output and ordering.

Diverged, both reproduced twice to rule out a fluke:

1. `docs/wiki/Getting-Started.md:51` says "Commit `.mstack/`... Then prove the store is
   healthy," immediately followed by the `mstack gate` block at `:54-76`, whose pasted output
   is `[warn] 1 uncommitted change(s)...` and `PASSED - 0 failures, 2 warnings`. I ran it both
   ways: gate run **after** committing `.mstack/` (as the prose instructs) gives
   `[ok] working tree is clean` and `PASSED - 0 failures, 1 warning`; gate run **without**
   committing first reproduces the page's exact pasted output. The instruction and the
   transcript describe two different states.

2. `docs/wiki/Getting-Started.md:223` shows `$ git commit -q -m "docs: add a readme"` succeeding
   directly, with no `git add` shown anywhere since the previous commit. I ran the command
   exactly as printed, at the exact point in the walkthrough the page reaches it (right after
   the reviewer's `ledger record`, which leaves `.mstack/ledger.tsv` and `.mstack/state.json`
   modified but unstaged): it exits 1, prints "no changes added to commit", and HEAD does not
   move.
   ```
   $ git commit -q -m "docs: add a readme"
   On branch feat/greet-flag
   Changes not staged for commit:
     modified:   .mstack/ledger.tsv
     modified:   .mstack/state.json
   no changes added to commit (use "git add" and/or "git commit -a")
   ```
   The next command the page shows, `mstack ledger check greet-flag`, then reports
   `PASS test-verified at <unchanged sha> by implementer` — not the `FAIL ... voids them` line
   the page promises as the payoff of this whole section. Staging first (`git add -A`) before
   the same commit line produces exactly the page's claimed behaviour. The page is missing the
   `git add -A` step it depends on.

3. `docs/wiki/Gates-and-Hooks.md:120-130`'s `gate --full` example shows a `-- verification`
   block of `Ran 2 tests in 0.000s` / `OK` / `[ok]    python3 -m unittest test_greet -q`. Every
   other place in these docs that sets this item's `verification` field uses `-v`
   (`docs/wiki/Getting-Started.md:109`, `docs/wiki/The-CLI.md:66`). I reproduced `gate --full`
   against an item configured with `-v`, exactly as the rest of the docs instruct, and got:
   ```
   -- verification
   test_greet (test_greet.TestGreet) ... ok
   test_shout (test_greet.TestGreet) ... ok

   ----------------------------------------------------------------------
   Ran 2 tests in 0.000s

   OK
   [ok]    python3 -m unittest test_greet -v
   ```
   Two extra lines and a different command echo than what Gates-and-Hooks.md shows. A reader
   who set up the item as instructed everywhere else in the docs will not see the transcript
   this page promises.

Also ran, matching the item's own `verify` field literally as prose (not as a command):
`bin/mstack gate --full` on the mstack repo itself passes the `lint-plugin` and test/typecheck
legs, but the final clause of item 9's `verification` field in `.mstack/state.json`
("`node scratch link check over README.md and docs/wiki`") is not an executable command — run
literally it throws `Cannot find module '<repo>/scratch'`. I did the link
check by hand instead (see bullet 4 above), so this did not block the review, but it means the
item's own recorded verification string cannot be re-run as given by the next person either.

## Changes required

1. `docs/wiki/How-A-Work-Item-Flows.md:78-91` vs `:114-124`, and `docs/wiki/The-CLI.md:132-218`,
   and `docs/wiki/Status-Line.md:26,78-79` — **the same illustrative work item is two different
   items with two different names, and the page contradicts itself.** Twenty-six lines apart on
   one page, `How-A-Work-Item-Flows.md` first shows a fork-refusal demo for an item called
   `export-csv` ("Is the CSV a stable contract the finance tool depends on, or a one-off dump?
   A stable contract needs a header-version rule; a dump does not.", `:79-81`), then describes
   "Item 3" of `examples/notes-cli/` as `export-json` with a different question entirely ("Is
   this a stable public contract other tools may depend on, or a convenience dump we are free
   to change?", `:116-118`). I checked the actual shipped fixture,
   `examples/notes-cli/.mstack/state.json:43-58`: the real item is `export-json`, id 3, with the
   exact decision text quoted in the "Item 3" narrative and in `README.md:121`. `export-csv`
   does not exist anywhere in this repository — it is a leftover name from a second, undisclosed
   scratch repo (the implementer's own report names it `scratchpad/demo-repo`) used to generate
   the `decide`/`worktree`/`fanout`/`statusline` transcripts in `The-CLI.md` and `Status-Line.md`,
   never reconciled with the real example the rest of the docs point readers at. A reader who
   goes to `examples/notes-cli/` as instructed (`docs/wiki/Getting-Started.md:237`,
   `docs/wiki/How-A-Work-Item-Flows.md:103`) to try the `decide --resolves export-csv` or
   `worktree new export-csv` commands from `The-CLI.md` will find no such item, and the id shown
   (`#2 export-csv`, `Status-Line.md:26`) doesn't even match — id 2 in the real fixture is
   `cli-search`, not the fork item, which is id 3. Fix: either rename the second scratch item to
   `export-json` throughout `The-CLI.md` and `Status-Line.md` and align the decision text and id,
   or replace those transcripts with output from `examples/notes-cli/` itself, or add one
   sentence at first use naming this a separate, throwaway scratch item distinct from
   `examples/notes-cli/`. Highest severity: it spans three pages, self-contradicts within one of
   them, and breaks reproducibility for a reader using the example the docs tell them to use.

2. `docs/wiki/Getting-Started.md:220-226` — the "What a new commit does to that verdict" section
   depends on `git commit -q -m "docs: add a readme"` succeeding, but at that point in the
   walkthrough there is nothing staged (the preceding `ledger record` only modifies files on
   disk). Reproduced: the shown command exits 1 and does not move HEAD, so the section's whole
   payoff — the `FAIL no verdict at <sha>; ... voids them` staleness line — never appears if a
   reader follows the page literally. Fix: add `git add -A &&` before the commit, or show the
   `git add -A` step separately, matching the fidelity the rest of the page has everywhere else.

3. `docs/wiki/Gates-and-Hooks.md:113-130` — the `gate --full` "-- verification" transcript shows
   `python3 -m unittest test_greet -q` and abbreviated output, but the item's `verification`
   field is set to `-v` everywhere else it is shown being configured
   (`Getting-Started.md:109`, `The-CLI.md:66`), and running `-v` for real produces two extra
   per-test lines and echoes `-v`, not `-q`, in the `[ok]` line. Fix: re-capture this transcript
   against an item actually configured with `-v` (matching the rest of the docs), or note
   explicitly that this example uses a different, quieter verification command on purpose.

4. `docs/wiki/Getting-Started.md:51-76` — the page instructs "Commit `.mstack/`... Then prove
   the store is healthy," but the pasted `mstack gate` output right after it
   (`[warn] 1 uncommitted change(s)...`, `PASSED - 0 failures, 2 warnings`) is what the command
   prints when `.mstack/` has **not** been committed; committing first (as instructed) produces
   `[ok] working tree is clean` and only 1 warning. Lower severity than #2/#3 because it doesn't
   block the walkthrough — the gate still passes either way — but it is a real, reproducible gap
   between the instruction and the transcript on the very first command block a reader runs.
   Fix: either drop the "commit first" sentence, or re-paste the gate output that follows an
   actual commit, or show the two-warning version as what happens if you have not yet committed
   and separately show the clean-tree version.

5. `README.md:5-16` ("Where this comes from") — this is the README's first content section
   after the tagline, and it is dense with terms a first-time reader cannot yet know: "router,"
   "playbooks," "evidence ladder," "TSV decision log," "typed verification ledger," "lifecycle
   gate," "hooks," "roles whose tool lists are the permission," none defined before or in this
   paragraph. None of `gate`, `ledger`, or `item` is ever given a plain-language definition
   anywhere in the README — the reader is expected to infer them from the "Your first item, in
   five commands" demonstration at `:62-100`, which works reasonably well on its own but comes
   fifty lines after the jargon-heavy lineage paragraph. Contrast with
   `docs/wiki/Home.md:3-10`, whose opening paragraph states what mstack concretely does (work
   items on disk, typed verdicts keyed to a commit SHA, hooks and gates as code) in the same
   breath as the credit, which reads far more clearly to a stranger. This does not compromise
   bullet 2 — credit is unambiguously visible — but it does mean a first-time reader's very
   first substantial paragraph in the README teaches them almost nothing about what mstack does
   before asking them to absorb ten unfamiliar terms. Low-medium severity, and a real one for
   this lens. Fix: consider a one- or two-sentence plain-language statement of what mstack does
   (items, gates, verdicts, in one line each) before or alongside the lineage section, the way
   `Home.md` already does.

6. `docs/wiki/Getting-Started.md:51` and `:156` — both instruct "Commit" in prose without ever
   showing the `git add`/`git commit` command, the only two steps in an otherwise
   command-by-command page that are not shown. Minor on its own (this audience is presumably
   git-literate), but worth fixing alongside #2 and #4 above since the fix for those needs a
   real, shown `git add -A && git commit ...` line in both places anyway.

## Checked and held

- README's "Your first item, in five commands" (`:62-100`): every command and every refusal
  matches a real run exactly, including exit-code-driving failure text.
- `mstack setup`, `mstack state add/set/active`, the illegal-transition refusal, the full legal
  transition path, the implementer-only close refusal, and the reviewer's fix all reproduce
  exactly as pasted throughout Getting-Started.md once the checkpoint file is filled in.
- `python3 -m unittest test_greet -v` output format and per-test ordering (`test_greet` before
  `test_shout`) matches the page exactly.
- Every relative link in `README.md` and all eleven `docs/wiki/*.md` files resolves; I checked
  by hand, not by trusting the implementer's script output.
- The `sd` link-rewrite commands in `docs/wiki/Publishing-the-Wiki.md:63,72` produce exactly
  the claimed result when run against the real files, including the deliberate exclusion of
  `Publishing-the-Wiki.md` itself from the second command.
- Credit to Lauren Tan (poteto) is unambiguous and appears four times: `README.md:5-16`, the
  `README.md:315-324` Credit section, `docs/wiki/The-Story.md`'s own Credit section, and
  `docs/wiki/_Footer.md` on every page. `github.com/poteto` and `cursor/plugins/pstack` are
  real, and The-Story.md's pulled quote from pstack's README is verbatim-accurate.
- `docs/wiki/` holds exactly the eleven named files the acceptance bullet lists, no more, no
  fewer; `Home.md`'s page table lists them in the bullet's exact order.
- Seven sampled `file:line` code citations across three wiki pages are all accurate to the
  exact lines cited.
- `docs/wiki/Status-Line.md`'s "why mstack does not ship this for you" section is corroborated
  word for word by the real `decisions.tsv` row and item 2 (`subagent-statusline-shipping`) in
  `.mstack/state.json`.
- `CHANGELOG.md:3-21` records the docs round under `## Unreleased`, above `## 0.1.0`, matching
  what actually changed.
- Each wiki page (`Gates-and-Hooks.md`, `The-CLI.md`, `State-Files.md`, `Status-Line.md`,
  `Publishing-the-Wiki.md`) opens with enough framing to stand alone; none assumes the reader
  arrived from a specific other page.
