# Review round 2 - readme-and-wiki (lens: facts, carrying the reader lens)

**Verdict:** CHANGES_REQUESTED

24 of the 25 findings are fixed, most of them re-verified by re-running the command or re-fetching
the page rather than reading the diff. One is fixed in four of its five locations, and the fix
round's own CHANGELOG asserts it was fixed everywhere. That claim is false, and the surviving
instance is a one-word change.

The fix round is otherwise strong: the walkthrough was genuinely rebuilt from scratch and every
block re-captured from one run — I replayed it end to end in a fresh repository and the new
`git commit` blocks, the `gate --full` transcript and the staleness payoff now reproduce line for
line, including output that was previously wrong in three places.

---

## Finding by finding

### Facts lens (my 19)

| # | Location | Verdict | Evidence |
|---|---|---|---|
| 1 | `Publishing-the-Wiki.md:63-79` | **FIXED** | Re-ran the corrected route against a fresh copy. Command 1 now names ten files and excludes `Publishing-the-Wiki.md`; `git diff --name-only -- Publishing-the-Wiki.md` returns nothing, and every changed line in the whole diff contains a link target. The `](Page.md)` sentence at `:59` survives intact. Full output below. |
| 2 | `The-Story.md:48`, `Status-Line.md:6`, `README.md:226`, `src/ledger.ts:12` | **NOT FIXED** | Four of five instances now say "shipping playbook". **`src/statusline.ts:16` still reads *"pstack's own orchestration playbook records the cost"*** followed by the quote at `:17`. See Changes required. |
| 3 | `Publishing-the-Wiki.md:24-27` | **FIXED** | Quote now carries its full tail. Re-fetched the source: *"Once you've created an initial page on GitHub, you can clone the repository to your computer with the provided URL"* — verbatim. The non-existence claim is now explicitly *"observed behaviour, unverified against the docs, which speak only of when you can clone."* |
| 4 | `Publishing-the-Wiki.md:58-60`, `:13` | **FIXED** | Extension-free addressing is now *"observed behaviour, and the wiki links here rely on it, but it is not stated on the docs pages checked"*. `:13` changed from "One claim" to *"Claims those pages do not state are marked as unverified where they appear."* Re-fetched the source: it says only *"the file extension determines how your wiki content is rendered"* — nothing about addressing, confirming the marker is correct. |
| 5 | `README.md:211`, `Gates-and-Hooks.md:87` | **FIXED** | Re-ran the command. Real output ends `…/.mstack/state.json parses but has the wrong shape: .items must be an array, got an object`; both pages now show `.../.mstack/state.json …`, which is exactly that tail, and `Gates-and-Hooks.md:91` adds *"The path is printed absolute; it is elided here."* |
| 6 | `State-Files.md:5`, `The-Story.md:69-72` | **FIXED** | Now *"a subagent's working context vanishes with it and its parent only ever sees the final reply"* and *"The analysis lived in the subagent's own working context, which a parent never sees"*. Both match `code.claude.com/docs/en/sub-agents` (*"Claude Code scans each subagent's final report before Claude reads it"*), which the old wording contradicted. |
| 7 | `README.md:126-129` | **FIXED** | Replayed against a queue mirroring the fixture: the refusal prints the whole two-sentence fork, and the README block now carries every word of it across three wrapped lines, in order. |
| 8 | `The-Story.md:57-58` | **FIXED** | Now *"the fast pass finishes in seconds (mstack's own fast gate gets that down to milliseconds)"*, matching `pstack-port.md:185` ("Seconds.") and attributing the millisecond number to mstack. |
| 9 | `Status-Line.md:33-37` | **FIXED** | Claim re-pointed at the page that carries it. Re-fetched `plugins-reference`: *"Only the `agent` and `subagentStatusLine` keys are supported"* — verbatim. The statusline docs are still cited, now for the wiring, which is what they do state. |
| 10 | `Status-Line.md:69-72` | **FIXED** | Now *"the docs describe Claude Code cancelling the in-flight script when a new update triggers as normal operation, and the EPIPE is what that cancellation produces when it lands mid-write"* — the documented fact and the inference are separated. |
| 11 | `Gates-and-Hooks.md:18` | **FIXED** | Now *"After a matched tool call succeeds (a failed call fires `PostToolUseFailure` instead)"*. |
| 12 | `Gates-and-Hooks.md:36-42`, `README.md:162` | **FIXED** | Re-fetched `code.claude.com/docs/en/permissions.md`. Both quoted sentences are verbatim: *"PreToolUse hooks run before the permission prompt, for every tool except EndConversation"* (line 417) and *"A hook that exits with code 2 stops the tool call before permission rules are evaluated, so the block applies even when an allow rule would otherwise let the call proceed"* (line 423). The page now says *"The docs do not spell out the `bypassPermissions` case, but it follows from that ordering"* — the inference is labelled. |
| 13 | `The-Story.md:69` | **FIXED** | Now *"the gate's own comment pins that defect to two of the harness's issue numbers"*, which is what `pstack-port.md:193` supports ("see #395, #396"). See the sweep for a residual inconsistency this leaves on two other pages. |
| 14 | `Publishing-the-Wiki.md:106-108` | **FIXED** | Now *"advise against these characters in titles, because users on some operating systems cannot work with filenames containing them"*. Re-fetched the source: *"Don't use the following characters… Users on certain operating systems won't be able to work with filenames containing these characters."* Faithful, and the character list is unchanged and still correct. |
| 15 | `Publishing-the-Wiki.md:52-53` | **FIXED** | Now *"special files, rendered as the footer and sidebar rather than as ordinary pages"*. |
| 16 | `The-Story.md:47-48` | **FIXED** | Now *"its `orch ledger` is the only real gate in the plugin, because it is code"* — the non-inference phrasing from `pstack-port.md:87` rather than the `[inference]`-marked sentence at `:122`. |
| 17 | `Home.md:7-8` | **FIXED** | Now *"(the name follows her convention, `poteto` → `pstack`, and mstack keeps it)"*, matching `README.md:14` and `The-Story.md:15`. |
| 18 | `Gates-and-Hooks.md:126-155` | **FIXED** | The whole `gate --full` block was re-captured, separator rule included. My replay is byte-identical — see below. |
| 19 | `Status-Line.md:81-82` | **FIXED** | Padding removed; `reviewer · #3 export-json · …` matches the unpadded string `join()` actually emits, which I re-rendered. |

### Reader lens (the 6 I carry)

| # | Location | Verdict | Evidence |
|---|---|---|---|
| R1 | three pages | **FIXED** | `rg export-csv` over `README.md docs/ examples/ src/ skills/ agents/ CHANGELOG.md` returns nothing. The fork item is `export-json` everywhere, at `#3`, with the fixture's exact question. `examples/notes-cli` is `1 storage-layer / 2 cli-search / 3 export-json`, and `Status-Line.md:26` and `The-CLI.md:221` now both say `#3 export-json`. `The-CLI.md:5-9` adds a preamble stating the scratch queue mirrors the example — same slug, same id, same question — which is honest about it being a scratch run rather than the shipped fixture. |
| R2 | `Getting-Started.md:241-258` | **FIXED** | Replayed at the exact point in the walkthrough. `git add -A` is now shown before both commits, and both new blocks reproduce **exactly**: `2 files changed, 5 insertions(+), 2 deletions(-)` for the close commit, and `1 file changed, 1 insertion(+)` + `create mode 100644 README.md` for the readme commit. `mstack ledger check greet-flag` then gives the promised `FAIL … 2 row(s) exist at other SHAs and a new head SHA voids them`. |
| R3 | `Gates-and-Hooks.md:126-155` | **FIXED** | Re-captured against an item configured with `-v`. My replay is byte-identical to the page, all 30 lines: the two per-test lines, the separator rule, `[ok]    python3 -m unittest test_greet -v`, `[ok]    working tree is clean`, and `PASSED - 0 failures, 0 warnings`. |
| R4 | `Getting-Started.md:51-52` | **FIXED** | Prose and transcript now agree: *"Straight after `setup`, with `.mstack/` not yet committed, the gate passes with two warnings"*. Reproduced exactly, including both warning lines and `PASSED - 0 failures, 2 warnings`. The commit is shown after, not before. |
| R5 | `README.md:5-8` | **FIXED** | New plain-language opening before the lineage section: *"work items live in a durable store on disk, every claim about the work carries a typed verdict keyed to a commit SHA, and the rules that must hold are enforced by hooks and gates that are code rather than prose."* Credit is still on the first screen — `## Where this comes from` is `:10`, Lauren Tan and the `poteto` link at `:12-14`. |
| R6 | `Getting-Started.md:82-92`, `:172-176` | **FIXED** | Both previously-prose "Commit" steps now show the commands. The store-commit block reproduces exactly, including `5 files changed, 51 insertions(+)` and all five `create mode 100644` lines. |

---

## The walkthrough, replayed

Fresh repo at `scratchpad/r2-demo` (`git init -b main`, one module, one test), everything through
`bin/mstack`. SHAs differ from the docs, as expected; shape and text
are what I judged.

```
$ git add -A && git commit -m "chore: add the mstack store"     # Getting-Started.md:84-92
[main a8accea] chore: add the mstack store
 5 files changed, 51 insertions(+)
 create mode 100644 .mstack/decisions.tsv
 create mode 100644 .mstack/ledger.tsv
 create mode 100644 .mstack/progress/current.md
 create mode 100644 .mstack/progress/history.md
 create mode 100644 .mstack/state.json

$ git add -A && git commit -m "chore: close greet-flag"          # Getting-Started.md:246-248
[feat/greet-flag 414595a] chore: close greet-flag
 2 files changed, 5 insertions(+), 2 deletions(-)

$ printf '# demo\n' > README.md && git add -A && git commit -m "docs: add a readme"
[feat/greet-flag 902e79a] docs: add a readme                     # Getting-Started.md:251-254
 1 file changed, 1 insertion(+)
 create mode 100644 README.md

$ mstack ledger check greet-flag                                 # Getting-Started.md:257
FAIL no verdict at 902e79a6; 2 row(s) exist at other SHAs and a new head SHA voids them

$ mstack gate --full                                             # Gates-and-Hooks.md:126-155
-- store
[ok]    state.json exists
[ok]    progress/current.md exists
[ok]    progress/history.md exists
[ok]    state.json parses and has the right shape (1 items)

-- state
[ok]    ids are unique
[ok]    slugs are unique
[ok]    every item has at least one acceptance criterion
[ok]    no active item
[ok]    no item carries a decision fork
[ok]    no sdd item is past specifying
[ok]    1 closed item(s) carry a ledger verdict

-- workspace
[ok]    on branch feat/greet-flag
[ok]    working tree is clean

-- verification
test_greet (test_greet.TestGreet) ... ok
test_shout (test_greet.TestGreet) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
[ok]    python3 -m unittest test_greet -v

PASSED - 0 failures, 0 warnings
```

That `gate --full` block is identical to the page, line for line.

```
$ mstack state set export-json --status spec_ready               # How-A-Work-Item-Flows.md:78-83
mstack: export-json has an unanswered decision: "Is this a stable public contract other tools may depend on, or a convenience dump we are free to change? The two answers produce different work: one needs a version field and a compatibility rule, the other does not."
        answer it with 'mstack decide --resolves export-json ...' first

$ mstack decide … --result done --resolves export-json           # The-CLI.md:135-137
mstack: resolving a fork needs --decision to say something; got 1 characters, and a token is not an answer
        answer it properly or leave the fork open; a row nobody can read is the boolean this mechanism exists to avoid

$ mstack decide … --resolves export-json                         # The-CLI.md:145
recorded, and export-json no longer has an open fork

$ printf '{"model":…}' | mstack statusline                       # Status-Line.md:26, The-CLI.md:221
Opus · feat/greet-flag · #3 export-json · spec_ready · unverified · ctx 31%

$ mstack fanout check --kind review --worker correctness --worker security --worker tests
-- review fan-out on export-json                                 # The-CLI.md:202-206
[ok]    correctness -> review_export-json_correctness.md (92 bytes)
[ok]    tests -> review_export-json_tests.md (88 bytes)
[fail]  security returned without writing its report
        fix: its reply is not evidence; re-run it and have it write the file before returning

$ mstack statusline --subagent                                   # Status-Line.md:81-82
implementer · #3 export-json · no impl report yet · 12k
reviewer · #3 export-json · 3 review reports · 3.2k
```

Byte counts and the reviewer row's count differ with my file contents; the strings are the code's.

### The corrected publish route, re-run

```
$ cp docs/wiki/*.md <scratch>/publish-check-r2/ && git init && git commit
$ sd '\]\(([A-Za-z-][A-Za-z_-]*)\.md\)' ']($1)' \
    Home.md Getting-Started.md The-Story.md How-A-Work-Item-Flows.md Gates-and-Hooks.md \
    The-CLI.md State-Files.md Status-Line.md _Sidebar.md _Footer.md
$ sd -F '](../research/pstack-port.md)' '](https://github.com/<owner>/<repo>/blob/main/docs/research/pstack-port.md)' The-Story.md Gates-and-Hooks.md

$ git diff --stat
 Gates-and-Hooks.md       |  2 +-
 Getting-Started.md       | 12 ++++++------
 Home.md                  | 22 +++++++++++-----------
 How-A-Work-Item-Flows.md |  6 +++---
 State-Files.md           |  2 +-
 The-CLI.md               |  8 ++++----
 The-Story.md             |  4 ++--
 _Sidebar.md              | 18 +++++++++---------
 8 files changed, 37 insertions(+), 37 deletions(-)

$ git diff --name-only -- Publishing-the-Wiki.md
(nothing — UNTOUCHED)

$ git diff -U0 | rg '^[-+]' | rg -v '^(\+\+\+|---)' | rg -v '\]\('
(no output — every changed line contains a link target)
```

I also checked the page's new claim that it *"carries no intra-wiki links of its own to lose by
being excluded"*: `rg -o '\]\([^)]*\)'` over `Publishing-the-Wiki.md` returns only the four
docs.github.com URLs, the `sd` project URL, and its own inline-code examples (`](Page.md)` ×2,
`]($1)`, and the `](../research/pstack-port.md)` inside the step-6 fence). No real intra-wiki link.
The claim holds. `Home.md` and `_Sidebar.md` still link *to* it, and both of those were rewritten.

---

## Regression sweep

`git diff 12aeff6..55f241f --stat` touches 17 files. Every one is explained by the fix list:
8 wiki pages, `README.md`, `CHANGELOG.md`, the new `scripts/check-doc-links.mjs`, `src/ledger.ts`,
and four `.mstack/` bookkeeping files (`state.json`, `decisions.tsv`, `progress/current.md`,
`progress/impl_readme-and-wiki.md`). Nothing unexplained.

- **`src/ledger.ts` is exactly one comment word.** The whole hunk is
  `- * voids the row. pstack's own orchestrate playbook records twenty-one verdicts`
  `+ * voids the row. pstack's own shipping playbook records twenty-one verdicts`. No code, no
  behaviour. Confirmed.
- **`scripts/check-doc-links.mjs` does what it says.** 29 lines, imports only `node:fs` and
  `node:path`, so its "Only node: builtins" header holds. Its claim that *"`mstack lint-plugin`
  covers skills/ and agents/; this covers README.md and docs/wiki/"* is true — lint-plugin's
  sections are manifest, skills, agents, hooks, references, shipped commands, cross-references and
  single-source-of-truth, and none of them reads `README.md` or `docs/wiki/`. I checked its one
  plausible false-positive surface: the `](Page.md)`, `]($1)` and fenced
  `](../research/pstack-port.md)` strings in `Publishing-the-Wiki.md` are not preceded by a `[…]`
  label, so the `LINK` regex does not match them and they are not counted — I re-ran the regex
  standalone over that file to confirm it yields nothing but http targets. It is not fence-aware,
  which is a real limitation but one the header does not claim away.
- **`README.md:295` adds the checker to the Development block**, and `state.json`'s `verification`
  field now reads `npm test && npm run typecheck && bin/mstack lint-plugin . && node
  scripts/check-doc-links.mjs README.md docs/wiki/*.md` — a real command, which I ran verbatim
  (below). The reader's finding that the field was unrunnable prose is resolved.
- **`.mstack/decisions.tsv` gains two rows**, both accurate to what changed, both naming the review
  report they came from. The second explicitly justifies reaching into `src/` on a docs item.
- **New CHANGELOG section, one overclaim.** `CHANGELOG.md:26-51` is accurate on the transcripts, the
  fork item, the shape check, the subagent claim, the milliseconds, the publish command and the
  permissions rewording. `:41-42` — *"Fixed in three pages and in the one `src/` comment that
  carried it"* — is false: two `src/` comments carried it. See Changes required.
- **A residual inconsistency, not a regression.** `The-Story.md:69` now says the shape defect is
  pinned to two issue numbers, while `README.md:216-217` and `Gates-and-Hooks.md:93` still say *"it
  shipped, in production, in the harness this was drawn from."* Both were pre-existing and only the
  location I cited was in scope, so I am not counting this against the round — but three pages now
  characterise the same defect two different ways, and the stronger claim is the one the research
  doc does not support. Worth reconciling next time either page is touched.
- **Cosmetic reflow artifacts.** Four edits left prose lines past the ~100-column convention the
  rest of the files keep, plus one orphaned short line: `The-Story.md:49` (150 cols) and `:59`
  (`nobody waits for is a gate nobody runs."* Its`), `Home.md:9` (118), `State-Files.md:5` (130).
  Content is correct; only the wrapping is untidy. No action required for correctness.
- No test was weakened: 169 tests before, 169 after, same names, `0 fail`.

---

## Verification I ran

The item's `verification` field, run verbatim from the repository root:

```
$ npm test && npm run typecheck && bin/mstack lint-plugin . && node scripts/check-doc-links.mjs README.md docs/wiki/*.md

 169 pass
 0 fail
Ran 169 tests across 13 files. [12.41s]
ℹ tests 169
ℹ suites 0
ℹ pass 169
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4888.968

> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit

-- references
[ok]    20 reference file(s), every relative link resolves

-- shipped commands
[ok]    32 file(s), no command that would hang on stdin

-- cross-references
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves

-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings
54 relative links checked, 0 broken
=== EXIT: 0 ===
```

54 links, up from 53 — `The-CLI.md:7` gained a link to `Getting-Started.md`. The whole chain exits 0,
which is the first time this field has been runnable.

The surviving misattribution:

```
$ rg -n -i 'twenty-one|21 verdicts' README.md docs/ src/ skills/ CHANGELOG.md
README.md:226:own shipping playbook records what that costs — …          [fixed]
docs/wiki/The-Story.md:48:code. Its own shipping playbook records …      [fixed]
docs/wiki/Status-Line.md:6:on. pstack's own shipping playbook records …  [fixed]
src/ledger.ts:12: * voids the row. pstack's own shipping playbook …      [fixed]
src/statusline.ts:17: * "twenty-one verdicts went stale this way …"      [NOT fixed — see :16]

$ bat --line-range 16:17 src/statusline.ts
 16  * has usually moved on. pstack's own orchestration playbook records the cost:
 17  * "twenty-one verdicts went stale this way in one run with no signal at all".
```

---

## Changes required

1. **`src/statusline.ts:16`** — the twenty-one-stale-verdicts quote is still attributed to
   *"pstack's own orchestration playbook"*. It is in `shipping.md`; I confirmed that at rung 4 in
   round 1 by fetching both playbooks from the primary source, and `docs/research/pstack-port.md:100-106`
   places it under the shipping.md bullet. The fix round corrected the other four instances and
   reached into `src/ledger.ts` deliberately to do it, so this is an omission rather than a
   disagreement. One word: `orchestration` → `shipping`.

2. **`CHANGELOG.md:41-42`** — *"Fixed in three pages and in the one `src/` comment that carried
   it"* asserts a completeness the repository does not have: two `src/` comments carried it, and
   one still does. Either fix finding 1 and change "the one" to "both", or the sentence stands as a
   new unverified claim in a changelog whose whole subject is unverified claims being caught. Fix
   1 first; then this reads as "in both `src/` comments that carried it".

Nothing else blocks. Every other finding from both lenses is fixed, and the ones I could re-run —
the publish route, the shape check, the permissions quotes, the whole Getting-Started walkthrough,
`gate --full`, the fork refusals, the status line and the fan-out — reproduce as pasted.

## Where this stopped on the evidence ladder

Rung 4 for findings 1, 5, 7, 18, 19 and R1–R6 (re-ran the command and diffed the output), and for
3, 4, 9, 12, 14 (re-fetched the cited page and compared the sentence). Rung 2 for 2, 6, 8, 10, 11,
13, 15, 16, 17 (read the new line against a source already established at rung 4 in round 1).
Finding 1 above is rung 4: the surviving line was located by ripgrep and read directly.
