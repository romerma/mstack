# Implementation report - item 57 deep-module-vocabulary

Branch `feat/deep-module-vocabulary`. Streams and scratch projects:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl57/`
(`streams/*.jsonl`, `proj1`, `proj1b`, `clone2`, `run.sh`, `sum.py`).

## What changed

- `skills/design/references/deep-modules.md` (new, 40 lines, origin header at line 1): module,
  interface, depth, leverage, locality, seam, adapter; the deletion test; the interface is the
  test surface; one adapter is hypothetical and two are real; the four dependency categories;
  replace, do not layer. Terms and tests only, and it says to apply them to the change in front
  of you and nothing else.
- `skills/design/SKILL.md:51` points at it from "Shallow module" and drops its own definition of
  shallow and deep (57 lines before and after).
- Lens: `skills/review/SKILL.md:29-30` names `design` (coordinator gives it when the diff adds or
  changes a module's interface or moves a seam); `agents/reviewer.md:40-45` says what a reviewer
  given it reads (`${CLAUDE_PLUGIN_ROOT}/skills/design/references/deep-modules.md`) and that a
  reviewer without it does not.
- `skills/router/playbooks/deepen.md` (new, origin header at line 1), seven steps: scope,
  explore (at most three readers, none on a small repo), find by the deletion test, rank and keep
  at most five, check the queue, file with `state add`, stop. Router: route row
  `skills/router/SKILL.md:46`, skip list `:26`. Router grew 158 to 160 lines. Intake's Proportion
  paragraph still reads true (it routes programs of work to orchestrate, unchanged).
- Lint: `src/lint.ts:422` `ORIGIN_REQUIRED` gains both files; `tests/lint.test.ts:289-290` extends
  the existing "header removed" table. No rule about playbook links or reachability exists beyond
  `lintLinks` and the cross-reference check, which both pass.
- Docs: `README.md` (playbook table, count, wiki row), `docs/wiki/Skills-and-Playbooks.md`
  (route table, discipline and leaves-behind tables, counts), `docs/wiki/Home.md`,
  `docs/wiki/The-Agents.md` (the lens), `CHANGELOG.md`.

Commits: c1f55b5 reference and design skill; 7620141 lens; 80f0709 playbook and row; 1808c8f lint
and test; 19487b2 docs; 8b676e9 playbook wording fix after run 1; the candidate items and this
report follow as `chore:` commits.

Test-first: the lint change is the only behaviour. The extended test failed first with
`header removed from design/references/deep-modules.md: expected a failure, got a pass`, then
passed after `ORIGIN_REQUIRED` was extended. The vocabulary, lens, playbook and docs have no
behaviour to test first; they are proved live below.

## Documentation relied on

- https://code.claude.com/docs/en/plugins-reference#where-each-variable-resolves : table row
  "Skill, command, and agent content | Anywhere in the Markdown body"; and "In skill, command, and
  agent content, write the `${...}` reference in the Markdown body instead, and Claude Code
  substitutes the path inline when it loads the content." Also "`${CLAUDE_PLUGIN_ROOT}` | Absolute
  path of the plugin's installed version | Scripts, binaries, and config files bundled with the
  plugin", and "The variables aren't present in the environment of commands Claude runs through
  the Bash tool", so a path in the body is the right form, not `$CLAUDE_PLUGIN_ROOT` in Bash.
- https://code.claude.com/docs/en/skills : "`${CLAUDE_SKILL_DIR}` ... For plugin skills, this is
  the skill's subdirectory within the plugin, not the plugin root"; and for subagents with the
  `skills` field "the full skill content is injected at startup" (the preload route, rejected
  because every review would pay for it).
- Existing practice: `agents/reviewer.md` already cites `${CLAUDE_PLUGIN_ROOT}/skills/router/references/evidence-ladder.md`.

Delivery decision (also recorded with `decide`): path in the reviewer's body, by evidence. Run 3b
below shows a reviewer in a project outside the plugin reading the file with a brief that named no
path.

## Live attempts

Wrapper `run.sh`: `env -i` with HOME USER LOGNAME TERM LANG TMPDIR SHELL and a PATH of system
dirs, homebrew, bun and the claude bin dir, no ANTHROPIC_* variable; `claude -p ... --model opus
--output-format stream-json --verbose --setting-sources project --strict-mcp-config
--max-budget-usd 8 --plugin-dir /Users/romerma/Code/mstack --permission-mode auto`. claude 2.1.326,
model claude-opus-5-5, plugin `mstack` in every init event. No process left running (checked with
`pgrep`).

### Run 1 (acceptance 2, small project, first wording) - stream `streams/run1.jsonl`

Project: copy of `sandbox/bench/template-hard`, `git init`, commit, `./bin/mstack setup`, committed
(base `53750be`). Prompt: `/mstack review the architecture`.

```
TEXT Intake skip: the deepen playbook files its own items.
     Playbook steps: 1 Scope, 2 Explore, 3 Find candidates, 4 Rank (max five), 5 Check the queue, 6 File each, 7 Stop.
TEXT Small repo (about 2,600 lines of source) with a single init commit ... I will read it all myself.
TOOL Bash | mstack state add --slug one-line-pricing --title "Quote and invoice price a line with two separate implementations that disagree" ...
RESULT success turns 14 cost $0.899 duration 131.4 s
```

Route: deepen (the first Bash read `playbooks/deepen.md` and `deep-modules.md`), intake skipped with
one line. Four items filed (`one-line-pricing`, `reservations-one-owner`, `order-status-questions`,
`import-error-mapping`), each with files and deepening in `--description`, three acceptance
criteria and a seam; the author also put "Rejected" and "defects found" in the reply. Nothing
implemented: `git status` in the project showed only `.mstack/` files, `git log` unchanged.
**Failure:** the reply ended with "Want me to file them as bug-fix items?", which violates "asks the
user nothing". Fix, commit 8b676e9: step 7 now says not to offer further work, to end on a
statement, and that a defect met on the way is a line under "found, not filed"; the evidence file
`deepen_<date>.md` is named and cited in `--source`.

### Run 1b (acceptance 2, new wording) - stream `streams/run1b.jsonl`

Fresh copy (base `9810d75`). Same prompt. `intake skip` line again, four items (`one-line-pricing`,
`reservations-in-stock-book`, `codec-round-trip`, `order-status-groups`), evidence file
`.mstack/progress/deepen_2026-11-17.md`, `--source "deepen playbook run, 2026-11-17,
.mstack/progress/deepen_2026-11-17.md"`. The reply ends "I left them uncommitted because you didn't
ask for a commit": a statement, no question. `git status` in the project: only `.mstack/`;
`git log` unchanged. `RESULT success turns 15 cost $1.100 duration 163.4 s`. One item as filed:

```
id: 3  slug: codec-round-trip  status: pending
title: Stored-document encode and decode are written separately and do not mirror each other, losing discounts and non-ASCII text
source: deepen playbook run, 2026-11-17, .mstack/progress/deepen_2026-11-17.md
description: adapters/codec.py: discount is encoded as basis points under kind percent and decoded times 100 (1250 bp reloads as 125000); _text/ascii_safe stores names and notes lossily (Zoe reloads as Zo?); decode_state writes StockBook.levels/.inactive directly. Deepening: each entity's encode and decode live together so the round trip is the test surface.
acceptance: decode_state(encode_state(s)) equals s, shown by a round-trip test through JsonFileRepository ...; a 1250 bp discount and non-ASCII names survive ...; decode_state builds the stock book through StockBook's own interface ...
seams: encode_state/decode_state round trip via JsonFileRepository
```

### Run 2 (acceptance 3, this repository) - stream `streams/run2a.jsonl`

`git clone` of this repository into `clone2`, branch `feat/deep-module-vocabulary` (head 1808c8f,
before the 8b676e9 wording fix, so first wording), real `.mstack/` queue of 75 items. Same prompt.

```
TEXT Intake: `skip: deepening, the playbook files its own items`. Route: deepen. Playbook steps 1 to 7 are my todo list, in order.
TEXT Step 2, explore. 8.5k lines of `src/` across 27 modules is more than I should read alone, so three readers on disjoint areas, each writing to disk.
TOOL Agent x3   (explore_persistence, explore_cli-lifecycle, explore_checks-hooks)
TOOL Write | .../clone2/.mstack/progress/deepen_2026-11-17.md
TEXT I reviewed the architecture and filed five places where the code should be deeper as `pending` items 76 to 80.
RESULT success, final of two result events: turns 13, total cost $1.826, 118.5 s
```

There are two `result` events: the first (turn 10, 61 s) came while the readers were still
running, the second after their notifications. The Stop hook went red during the run because the
hook binary was this checkout's `bin/mstack` against a store root in a different checkout (the
"runs from elsewhere" check, an artefact of running in a clone). The session said so and stopped
after filing, ending on "waiting on your answer about where to commit them": a mild ask, caused by
the hook and not by the playbook. Not rerun: the wording that ends the reply was already fixed
and proved in 1b, and this run's filing was sound. Nothing implemented: the clone's `git log` is
unchanged, `git status` shows only `.mstack/` files.

Candidates, with my judgement (I read the named code in this checkout):

| Item | Candidate | Real? | Covered by an open item? |
|---|---|---|---|
| 76 `item-transition-module` | `state set --status` rules (fork check, transitions, closing policy) live in a closure in `cmdState`, `src/cli.ts:379`, `:564-697`; the unanswered-fork test is repeated there and in the gate | Yes: confirmed the fork check at `cli.ts:564-580` duplicates the gate's; cli.ts exports only the forced-unverified marker | No. 40, 44, 71 change what the command does, none extracts it; this ranks first because they would each edit the closure |
| 77 `item-readiness-reading` | five consumers switch over the ledger reading kinds | Mostly: gate (`gate.ts:422-437`), closing (`closing.ts:104`), statusline (`statusline.ts:158-160`) confirmed; ledger and mergegate not checked by me | No; 71 changes the verdict-at-commit rule these share |
| 78 `durable-store-file` | `withLock` taken by state, decisions, costs, not ledger or verification | Yes: `rg withLock src` has no hit in ledger.ts or verification.ts, `ledger.record` calls `append` (`tsv.ts:60`, no lock) and `verification.ts:36` says it appends without it | Adjacent, not a duplicate: 66 is about the lock's own windows, 51 about one flush, 68 about state writes |
| 79 `workspace-facts` | git asked outside `git.ts` | Yes for the bypass: `execFileSync("git"` at `ledger.ts:57,82`, `worktree.ts:81,152` besides `git.ts:63`, while git.ts claims to be the one place. "Nine call sites" and "three encodings" I did not count | No |
| 80 `tsv-record-shape` | each TSV store repeats column list, positional append, read-back | Yes: `HEADER` plus positional arrays at `ledger.ts:37,135`, `decisions.ts:10,59`; not counted for all four stores | No; item 65 adds a column and would pay it |

All five are real and none duplicates an open item, so all five were replayed with
`./bin/mstack state add` into the real queue, with the title, acceptance, source, seams and
description the run produced. The three reader reports and the evidence file are copied to
`.mstack/progress/` (`explore_*.md`, `deepen_2026-11-17.md`), since the items cite them.
Pasted from the real queue:

```
$ ./bin/mstack state list | tail -5
  76 item-transition-module (pending)  The rules for moving an item between statuses live in a closure inside cli.ts, reachable only by spawning the CLI
  77 item-readiness-reading (pending)  Five consumers each turn a ledger reading into their own verdict, kept in agreement by comments
  78 durable-store-file (pending)  Whether a store write takes the lock is each caller's choice, and the ledger the gate trusts is written unlocked
  79 workspace-facts (pending)  Git is asked from nine call sites in two incompatible ways, and 'no git, no commits, detached' has three encodings
  80 tsv-record-shape (pending)  Each TSV store writes its column list four times, and a reordered header silently misaligns rows
```

`./bin/mstack state show 76` .. `80` print the same fields as in the run (the clone's `state show`
output is reproduced by the replay; ids matched).

Note on the items' scope: 76 to 80 are not in the "first clients" only; `src/cli.ts`
(76), `src/gate.ts` (77) and `src/costs.ts` (78 touches its write path) are named. Item 79
(a git-asking module) overlaps the git work item 71 may touch; whoever picks it up should read 71
first.

### Run 3a (the lens) - stream `streams/run3a.jsonl`

In `proj1b` I committed `959d13d` adding `stockroom/app/line_pricer.py`, an 11-line `LinePricer`
whose one method forwards the same four arguments to `domain.pricing.price_line`. Prompt asked the
session to launch one `mstack:reviewer` on HEAD with the design lens as `skills/review/SKILL.md`
describes. It read that skill, hit that `fanout plan` needs an active item (created `line-pricer`),
launched `subagent_type: mstack:reviewer`. The stream shows the subagent's Read:

```
sub=True Read {'file_path': '/Users/romerma/Code/mstack/skills/design/references/deep-modules.md'}
```

Report `review_line-pricer_design.md`: "shallow pass-through module; it fails the deletion test",
"hypothetical seam", "dependency category 1 ... merge and test through the domain interface",
"the interface is not the test surface", all with `file:line` in the diff. Weakness: the
coordinator's brief hinted at the location ("look under /Users/romerma/Code/mstack") and at
item `one-line-pricing`, and the reviewer's findings 3 and 6 went to that item and to the store
(gate failed on the empty acceptance of the `line-pricer` item the session created). `RESULT
success turns 14 cost $0.677 duration 174.0 s`.

### Run 3b (the lens, brief without a path) - stream `streams/run3b.jsonl`

Rerun to isolate delivery: the prompt told the coordinator to give the reviewer only the lens name,
the diff range and the report path, with no path or item hint. (A first try used `HEAD~1..HEAD`
after a store commit, so the diff was not the code commit; killed and rerun with `959d13d~1..959d13d`;
`run3b-killed.jsonl`.) The Agent brief was exactly: `You have the "design" lens. Review the diff
959d13d~1..959d13d. Write your report to .../review_line-pricer_r2-design.md`. The subagent:

```
sub=True Read {'file_path': '/Users/romerma/Code/mstack/skills/design/references/deep-modules.md'}
RESULT turns 5 cost $0.356 duration 111.4 s
```

So the reviewer reached the plugin file through the `${CLAUDE_PLUGIN_ROOT}` line in
`agents/reviewer.md` from a project that is not the plugin tree. Its report uses the vocabulary on
the diff ("Shallow module / pass-through (deletion test fails)", "Hypothetical seam ... one adapter
is a hypothetical seam", "Interface is not the test surface", category 1). It also mentions item 1
(`one-line-pricing`) because the item was in the store it ran `gate` in; its findings are anchored
on `line_pricer.py`. Not proven: that it would not have read the file without the lens (no
negative run), and `n=1` per run.

## Verification

```
$ bun run test                      # both halves
 592 pass / 0 fail   Ran 592 tests across 27 files. [104.50s]
 ℹ tests 592  pass 592  fail 0                     (node --test half)
$ bun run typecheck
$ bunx --bun tsc --noEmit            (no output)
$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate | tail -3
PASSED - 0 failures, 0 warnings      (one warning mid-session: uncommitted changes)
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
96 relative links checked, 0 broken
```

The suite ran while no live run was going; the load-sensitive tests were green (item 67).
`claude plugin validate . --strict` not run (no change to the manifest).

Header removal in a scratch clone (`scratchpad/impl57/lintclone`), each file in turn:

```
== removed header from skills/design/references/deep-modules.md
[fail]  skills/design/references/deep-modules.md: no origin header
FAILED - 1 failure, 0 warnings
== removed header from skills/router/playbooks/deepen.md
[fail]  skills/router/playbooks/deepen.md: no origin header
FAILED - 1 failure, 0 warnings
== restored: PASSED - 0 failures, 0 warnings
```

## Decisions (recorded with `./bin/mstack decide --phase implement`)

1. Reviewer reads the vocabulary by `${CLAUDE_PLUGIN_ROOT}` path in its body, not pasted and not a
   skill; evidence above.
2. `deepen` writes `deepen_<date>.md` and ends on a statement; evidence run 1 vs 1b.
3. All five run-2 candidates replayed as items 76 to 80.

## Found, not fixed

- `skills/review/SKILL.md` step 2 and `mstack fanout plan`: it takes the slug only from the active
  item and has no `--slug`; a coordinator reviewing a commit outside an item has to invent one
  (run 3a did, and left the gate red until it gave the item acceptance). Not in scope.
- The Stop hook reports red in any clone run with `--plugin-dir` pointing at another checkout, and
  the session read it as a blocker and stopped to ask (run 2). Known as "runs from elsewhere"
  (CONTRIBUTING.md); unattended runs in a clone hit it every time.
- Both deepen runs found real defects outside the architecture question in `sandbox/bench/template-hard`
  (discount x100 on reload, non-ASCII stored as `?`, invoice break priced on boxes); those are
  benchmark-template facts, not mstack's.
- `agents/reviewer.md:23` and `README.md:177,246,266` carry em dashes that predate this item.

## Per criterion

| Criterion | Evidence | Rung |
|---|---|---|
| "the design skill references the vocabulary, and the reviewer has it as a lens, with origin headers" | `skills/design/SKILL.md:51` links it; `skills/review/SKILL.md:29`, `agents/reviewer.md:40-45`; headers at line 1 of both new files; lint test fails when either header is removed (test `tests/lint.test.ts:289-290`, and the scratch-clone run). Lens delivery proved live in 3b | live-verified for the lens (n=1, no negative run); test-verified for the headers |
| "a request such as '/mstack review the architecture' routes to a playbook that ends with candidates filed as pending items, each naming files, the deepening and its test surface, and asks the user nothing" | Runs 1b and 2: route deepen, intake skipped with a reason, items filed with files, deepening, acceptance, seam; run 1b ended on a statement. Run 1 asked a question and was fixed; run 2 ended with a hook-induced ask and was not rerun | live-verified, n=1 each; one clean run on the final wording (1b), and run 2 ran the pre-fix wording |
| "that playbook run on this repository files its candidates, pasted in the report" | Run 2, five candidates, judged above, replayed as items 76 to 80 in the real queue | live-verified; judgement of 77, 79, 80 partly from reading, not every count (nine call sites, five consumers) re-derived |
