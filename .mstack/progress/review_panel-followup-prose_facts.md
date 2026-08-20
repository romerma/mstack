# Review - panel-followup-prose (facts lens)

**Verdict:** CHANGES_REQUESTED

## Acceptance, quoted

**"Every mstack-authored claim about what a parent sees of a subagent matches the sub-agents
docs: the working context is what it never sees, the final reply comes back, and 'a reply is
not evidence' survives in every file that carried it"**

Partially met. The sub-agents doc (`https://code.claude.com/docs/en/sub-agents.md`, fetched
this session) says: "the subagent does that work in its own context and returns only the
summary"; "Each subagent starts with a fresh, isolated context window"; the parent gets
"only the final summary/results." So the correct shape is: working context isolated/never
seen, final reply/summary does come back.

Every reworded site checked matches this: `agents/implementer.md:61`, `agents/orchestrator.md:58`,
`agents/reviewer.md:73`, `agents/spec-author.md:60`, `agents/spec-reviewer.md:51` all now read
"your working context vanishes when you return, only your final reply comes back, and a reply
is not evidence." `skills/router/SKILL.md:71-72` now reads "The work happens in its own context
and only a summary comes back, so the file is the deliverable." `src/hooks.ts:120-124` is
comment-only and now reads "The analysis lived only in its working context, which the parent
never sees... A reply is not evidence. The file is." All six/seven sites are correct and consistent.

But the repo-wide sweep the item's own verification calls for (`rg -n "reply body"`) finds two
live, unfixed sites carrying the exact old, contradicted claim, neither of which is a record of
the finding:

- `hooks/hooks.json:40` — the `SubagentStop` hook's live, shipped description still reads: *"the
  parent never sees a subagent's reply body, so that analysis would have vanished silently."*
  This is the same claim `src/hooks.ts`'s comment carried before this fix and was corrected to
  say the working context (not "the reply body") is what the parent never sees, and that the
  final reply *does* come back. `hooks/hooks.json` was never touched by this diff or by item 9
  (`git log --oneline -- hooks/hooks.json` shows only the original `feat:` commit) and still
  contradicts the docs today, live, in the artifact Claude Code actually reads.
- `tests/hooks.test.ts:76` — a comment reading `// The parent never sees a subagent's reply
  body. A reply is not evidence.` — same uncorrected claim, in code.

Neither is a record like the CHANGELOG bullet, `history.md`, a review report, or
`docs/research/pstack-port.md:244`'s quoted primary source (all of which legitimately keep the
old wording as history/quotation, not assertion). These two are live, present-tense claims that
still say something the sub-agents docs contradict. **Not met** for "every file that carried
it."

**"README, Gates-and-Hooks and The-Story characterise the shape-check defect with one
formulation: shipped in production, pinned by the gate's own comment to two of the harness's
issue numbers"**

Met. `README.md:217-219`: "That defect is a real one: it shipped, in production, in the harness
this was drawn from, and the gate's own comment pins it to two of the harness's issue numbers."
`docs/wiki/Gates-and-Hooks.md:94-97`: "That defect shipped, in production, in the harness this
was drawn from, and the gate's own comment pins it to two of the harness's issue numbers."
`docs/wiki/The-Story.md:69-71`: "...so the gate must check shape, not parseability. The defect
shipped there, in production, and the gate's own comment pins it to two of the harness's issue
numbers." All three now carry both halves of the same formulation. `docs/research/pstack-port.md`
section 2.4 (line 193) is the source for the gate-comment/issue-number half: *"this gate reports
success while enforcing nothing... (see #395, #396)."* The newest `.mstack/decisions.tsv` row
(`2026-08-20T10:40:55.519Z`) records why the "shipped" half was kept rather than dropped to the
weaker claim: it is the author's own standing first-hand record of their harness, present in the
README through two prior review panels, and the research doc only adds corroboration, so
unifying on the weaker claim "would silently retract a standing claim."

**"The four lines the round-2 sweep named as past the ~100-column convention are rewrapped:
The-Story.md:49 and :59, Home.md:9, State-Files.md:5"**

Met, verified against the actual finding
(`review_readme-and-wiki_r2-facts.md:221-222`, which named `The-Story.md:49` at 150 cols, `:59`
as an orphaned short line reading `nobody waits for is a gate nobody runs."* Its`, `Home.md:9`
at 118 cols, `State-Files.md:5` at 130 cols). Confirmed against `c5de4fb^` (the pre-fix blob):
all four matched exactly. Post-fix: `The-Story.md:49` is now 89 cols, `:59` is now 93 cols and
no longer an orphan ("Its" is folded back into "reviewer roles ship without..."), `Home.md:9` is
now 88 cols, `State-Files.md:5` is now 89 cols. I also diffed every added (`+`) line across all
13 touched prose/doc/comment files for length > 100 and found zero — the rewrap introduced no
new violations. Remaining >100-char lines in the touched files (checked with
`awk 'length > 100'` per file) are all table rows, YAML frontmatter `description:` lines, or
quoted command/tool output (e.g. `README.md:161-162`, `docs/wiki/Gates-and-Hooks.md:17-21`,
`agents/*.md:3`) — the convention's documented exceptions — plus one pre-existing,
untouched-by-this-diff line (`README.md:19`, a prose+link line predating this item) that is out
of this item's scope.

**"docs/research/pstack-port.md and every quoted primary source stay byte-identical: they are
records, not claims"**

Met. `git diff main -- docs/research/pstack-port.md` is empty; the file is untouched by
`c5de4fb`. Its line 244 (`sec-395` quote) still carries the old "reply bodies" phrasing
verbatim, correctly, as a quotation of a primary source rather than an mstack claim.

**"The verification field runs green and the CHANGELOG Unreleased section records the round"**

Met for the first half — see Verification below, all green. The CHANGELOG bullet
(`CHANGELOG.md:53-58`) is accurate as far as it goes ("the reply-body phrasing in the five agent
contracts and the router now matches the sub-agents docs... the three pages... now share one
sentence") but only describes two of the three fixes this diff makes; it does not mention the
four-line rewrap. This is an omission, not an overclaim — nothing in it is false — so I am not
blocking on it, but it means a reader of the CHANGELOG alone would not know the rewrap happened.

## Verification I ran

```
$ npm test
...
ℹ tests 169
ℹ pass 169
ℹ fail 0

$ npm run typecheck
> bunx --bun tsc --noEmit
(clean, no output)

$ bin/mstack lint-plugin .
...
PASSED - 0 failures, 0 warnings

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
54 relative links checked, 0 broken

$ bin/mstack gate --full
...
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin . && node scripts/check-doc-links.mjs README.md docs/wiki/*.md
PASSED - 0 failures, 1 warning
```

The one warning on both `bin/mstack gate` and `gate --full` is `[warn] 1 uncommitted change(s);
expected mid-session, not at close` — `.mstack/state.json`'s working-tree diff (status flipped to
`reviewing`), expected while a review is in flight and not a defect.

`bin/mstack ledger check panel-followup-prose` → `FAIL no verdict recorded for
panel-followup-prose`, expected: this is the first review pass, not yet recorded.

`git show c5de4fb --stat` confirms every touched file traces to this item's acceptance: the five
agent contracts, `skills/router/SKILL.md`, `README.md`, `docs/wiki/{Gates-and-Hooks,Home,
State-Files,The-Story}.md`, `CHANGELOG.md`, `src/hooks.ts` (confirmed comment-only — every `+`/`-`
line in its hunk is a `*` comment line, `export function subagentStop` is unchanged context), and
`.mstack/{decisions.tsv,progress/current.md,state.json}` bookkeeping. `docs/research/pstack-port.md`
is absent from the stat, confirmed untouched.

## Changes required

1. `hooks/hooks.json:40` — the live `SubagentStop` hook description still says "the parent never
   sees a subagent's reply body," the exact claim this item exists to fix, unchanged since the
   file's original commit. Reword to match the formulation now used everywhere else (working
   context vanishes/is never seen; the final reply does come back; a reply is not evidence). No
   test pins this string (`rg -n "hooks.json" tests/*.test.ts` finds only a path existence check
   in `tests/lint.test.ts:99`), so this is a safe one-line fix.
2. `tests/hooks.test.ts:76` — the comment `// The parent never sees a subagent's reply body. A
   reply is not evidence.` carries the same uncorrected claim; reword for consistency with the
   rest of the codebase now that every other site has been fixed.
3. (Non-blocking) `CHANGELOG.md:53-58` — consider adding a clause for the four-line rewrap so the
   Unreleased entry covers all three things this diff did, not two.

## Checked and held

- Sub-agents docs fetched live this session; every reworded site (5 agent contracts, the router
  bullet, the `src/hooks.ts` comment) matches it exactly.
- Shape-check defect formulation unified identically across README, Gates-and-Hooks, The-Story;
  traced to `docs/research/pstack-port.md` section 2.4 and the newest `decisions.tsv` row.
- All four named rewrap lines (`The-Story.md:49`, `:59`, `Home.md:9`, `State-Files.md:5`)
  confirmed fixed against the pre-fix blob and the original finding; no new >100-col line
  introduced anywhere in the diff.
- `docs/research/pstack-port.md` byte-identical to `main`; its quoted primary source at line 244
  correctly left untouched.
- `git show c5de4fb --stat` — every touched file accounted for by the item's acceptance; nothing
  extraneous moved.
- Full verification battery green: 169/169 tests, clean typecheck, lint-plugin 0/0, 54/54 links,
  `gate --full` passed (1 expected warning, no failures).

## Round 2

**Verdict:** APPROVED

Fix commit `3a38bab` addresses both round-1 findings and nothing else of substance.

**Check 1 — repo-wide `rg -n "reply body"` sweep.** Re-ran it clean:

```
$ rg -n "reply body" -g '!node_modules' -g '!.git'
CHANGELOG.md:43:  "a parent never sees a subagent's reply body in full" contradicted the sub-agents docs
```

One hit, and it is a record: `CHANGELOG.md:43` is the historical bullet describing the item-9
follow-up finding, quoting the old wrong phrasing as the thing that was contradicted — not an
assertion. `hooks/hooks.json:40` and `tests/hooks.test.ts:76` no longer match this pattern at
all (see check 2/3). No live claim remains anywhere in the repo.

**Check 2 — hooks.json validity and lint.** `hooks/hooks.json` now reads: *"...the analysis
lived only in its working context, which the parent never sees, so it would have vanished
silently. A reply is not evidence, the file is."* This is the same corrected formulation used
everywhere else in the diff (working context is what's never seen; the file, not the reply, is
the evidence). `node -e "JSON.parse(readFileSync('hooks/hooks.json'))"` confirms it still
parses. `bin/mstack lint-plugin .` → `PASSED - 0 failures, 0 warnings`, including the `hooks`
section validating every hook event, `SubagentStop` among them.

**Check 3 — `npm test` tail.** Full suite: `169/169 pass, 0 fail`. Ran `tests/hooks.test.ts` in
isolation as well: `17/17 pass, 0 fail`, including `"SubagentStop catches a subagent that
returned without writing its report"` — the test whose comment was edited (now: *"The analysis
lives in the subagent's working context, which the parent never sees. A reply is not
evidence."*) — still green.

**Check 4 — diff scope.** `git diff c5de4fb 3a38bab --stat`:

```
 .mstack/progress/current.md                        |  22 ++-
 .../progress/review_panel-followup-prose_facts.md  | 165 +++++++++++++++++++++
 .mstack/state.json                                 |   2 +-
 CHANGELOG.md                                       |   3 +-
 hooks/hooks.json                                   |   2 +-
 tests/hooks.test.ts                                |   3 +-
 6 files changed, 187 insertions(+), 10 deletions(-)
```

`hooks/hooks.json` and `tests/hooks.test.ts` are the two fixes. `CHANGELOG.md` now adds *"The
four prose lines the round-2 sweep had named as past the column convention are rewrapped with
it"* — closing the non-blocking gap noted in round 1 (the Unreleased bullet now covers all three
things this diff did, not two). The rest is bookkeeping: `.mstack/state.json` flips the item's
status from `in_progress` to `reviewing`, `.mstack/progress/current.md` logs the session
narrative (including an honest note that `sd` silently no-opped on the multi-line `src/hooks.ts`
comment during round 1 and the Edit tool was used instead — a tooling note, not a content
change), and `.mstack/progress/review_panel-followup-prose_facts.md` is this report's round-1
content being committed to disk — not new prose subject to review. Nothing outside the three
named sites plus bookkeeping was touched.

Final battery re-run clean: `npm test` 169/169, `npm run typecheck` clean, `bin/mstack
lint-plugin .` 0/0, `node scripts/check-doc-links.mjs` 54/54, `bin/mstack gate --full` →
`PASSED - 0 failures, 0 warnings` (the round-1 uncommitted-state warning is gone now that
`state.json`'s change is committed).

All five acceptance bullets are now met without qualification.
