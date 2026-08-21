# Implementation — item 12 `rm-guard-command-boundary`

**Branch** `fix/rm-guard-command-boundary` · **Commits** `a8e8d90` (the fix), `51a79cc` and `9b951a4` (tests) · **Verdict** `live-verified`
**This pass did not change the item's status and did not approve its own work.**

## What changed

`preToolUse` used to hand each guard the whole `command` string. Every pattern in `GUARDS`
but one is shaped `verb` + `[^\n]*` + `the thing it forbids`, and `[^\n]*` walks straight
through `&&`, `||`, `;`, `&` and `|`, so a guard could take its verb from one command and its
argument from a completely different one. `src/hooks.ts` now grows `shellSegments`, a
character scanner that cuts a command line where the shell would start a new command, and
`preToolUse` matches each guard against each segment alone. The scanner tracks three things
and nothing else: quotes and backslash escapes, so a separator inside a filename does not
split the line (that leaves a segment longer, which denies rather than allows — the
recoverable direction); and redirection operators, so the `&` of `2>&1` and of `&>log` and the
`|` of `>|out` do not cut a command in half and hide its tail from every rule (that direction
would be a false *allow*, which does not recover). The `GUARDS` doc comment was rewritten to
say which way each half of the tradeoff leans and, per acceptance criterion 4, to list what
these guards cannot see at all — interpreter one-liners, `-delete`/`-X rm`, a path arriving
through a variable, and two-step move-then-delete — with the plain statement that no regex
closes those and that the array is a speed bump, not a sandbox. The rm pattern itself is
byte-for-byte unchanged; only the input it is fed changed.

## Files

| File | What |
|---|---|
| `src/hooks.ts` | `shellSegments` (299) and `isSeparator` (332) added; `preToolUse` (344) matches per segment at line 354; `GUARDS` doc comment (185-221) rewritten to state the lean and the limits; the rm guard's inline comment (263-267) now points at `shellSegments` as part of its contract |
| `tests/hooks.test.ts` | `CROSS_SEGMENT_ALLOW` (274) and `CROSS_SEGMENT_DENY` (302) tables; three new tests at 326, 334, 342 |
| `.mstack/progress/current.md` | checkpoint kept live during the pass |
| `.mstack/decisions.tsv` | three decisions recorded during implementation |

Nothing else was touched. `sandbox/` was not entered, no other pass's report was edited, and
no dependency was added: `shellSegments` (299-330) and `isSeparator` (332-342) are 43 lines of plain string scanning with no imports.

## Commands

### The defect, re-reproduced against the shipped regex

Same 24 rows run twice: once with `src/hooks.ts` at `HEAD` (`git stash push src/hooks.ts`),
once with the fix. Ten rows were wrong before, every one of them a false denial.

```
$ node tests/.baseline-table.mjs        # against the shipped pattern
-- must be ALLOWED (a separator ends the command)
 WRONG  deny   later flag value                              "rm -rf /tmp/x && mstack decide --evidence \".mstack/evidence/x.md\""
 WRONG  deny   after a semicolon                             "rm -rf build; echo see .mstack/state.json"
 WRONG  deny   after a pipe                                  "rm -rf dist | grep .mstack"
 WRONG  deny   inside a commit message                       "rm -rf node_modules && git commit -m \"docs: .mstack notes\""
 WRONG  deny   after ||                                      "rm -rf /tmp/x || echo .mstack survived"
  ok    allow  on the next line                              "rm -rf /tmp/x &\necho .mstack"
 WRONG  deny   after a backgrounding &                       "rm -rf /tmp/scratch & mstack gate .mstack"
 WRONG  deny   redirection then pipe                         "rm -rf /tmp/x 2>&1 | grep .mstack"
 WRONG  deny   sibling: --force in a later echo              "git push origin main && echo 'use --force only after asking'"
 WRONG  deny   sibling: --admin in a later echo              "gh pr merge 3 --squash && echo skipped --admin"
 WRONG  deny   sibling: -D in a later echo                   "git branch -a && echo remember -D deletes unmerged work"

-- must be DENIED (the deletion is real)
  ok    deny   bare store name                               "rm -rf .mstack"
  ok    deny   nested path                                   "rm -rf /repo/.mstack/progress"
  ok    deny   glob named in the comment                     "rm -rf .mstack*"
  ok    deny   single-char wildcard named in the comment     "rm -rf ./.mstac?"
  ok    deny   shorter glob                                  "rm -rf .msta*"
  ok    deny   rm in the second segment                      "cd /repo && rm -rf .mstack"
  ok    deny   innocent rm first, real one second            "rm -rf build; rm -rf .mstack"
  ok    deny   rm past a pipe                                "echo cleaning | rm -rf .mstack"
  ok    deny   quoted semicolon is not a separator           "rm -rf \"a;b/.mstack\""
  ok    deny   store named before the separator              "rm -rf .mstack && echo done"
  ok    deny   rm mid-chain                                  "cd /repo && rm -rf .mstack && git status"
  ok    deny   redirection is not a separator                "rm -rf .mstack 2>&1"
  ok    deny   sibling: redirection is not a separator       "git push origin main 2>&1 --force"

10 row(s) wrong out of 24
exit: 1
```

```
$ node tests/.baseline-table.mjs        # against the fix
-- must be ALLOWED (a separator ends the command)
  ok    allow  later flag value                              "rm -rf /tmp/x && mstack decide --evidence \".mstack/evidence/x.md\""
  ok    allow  after a semicolon                             "rm -rf build; echo see .mstack/state.json"
  ok    allow  after a pipe                                  "rm -rf dist | grep .mstack"
  ok    allow  inside a commit message                       "rm -rf node_modules && git commit -m \"docs: .mstack notes\""
  ok    allow  after ||                                      "rm -rf /tmp/x || echo .mstack survived"
  ok    allow  on the next line                              "rm -rf /tmp/x &\necho .mstack"
  ok    allow  after a backgrounding &                       "rm -rf /tmp/scratch & mstack gate .mstack"
  ok    allow  redirection then pipe                         "rm -rf /tmp/x 2>&1 | grep .mstack"
  ok    allow  sibling: --force in a later echo              "git push origin main && echo 'use --force only after asking'"
  ok    allow  sibling: --admin in a later echo              "gh pr merge 3 --squash && echo skipped --admin"
  ok    allow  sibling: -D in a later echo                   "git branch -a && echo remember -D deletes unmerged work"

-- must be DENIED (the deletion is real)
  ok    deny   bare store name                               "rm -rf .mstack"
  ok    deny   nested path                                   "rm -rf /repo/.mstack/progress"
  ok    deny   glob named in the comment                     "rm -rf .mstack*"
  ok    deny   single-char wildcard named in the comment     "rm -rf ./.mstac?"
  ok    deny   shorter glob                                  "rm -rf .msta*"
  ok    deny   rm in the second segment                      "cd /repo && rm -rf .mstack"
  ok    deny   innocent rm first, real one second            "rm -rf build; rm -rf .mstack"
  ok    deny   rm past a pipe                                "echo cleaning | rm -rf .mstack"
  ok    deny   quoted semicolon is not a separator           "rm -rf \"a;b/.mstack\""
  ok    deny   store named before the separator              "rm -rf .mstack && echo done"
  ok    deny   rm mid-chain                                  "cd /repo && rm -rf .mstack && git status"
  ok    deny   redirection is not a separator                "rm -rf .mstack 2>&1"
  ok    deny   sibling: redirection is not a separator       "git push origin main 2>&1 --force"

0 row(s) wrong out of 24
exit: 0
```

`tests/.baseline-table.mjs` was a throwaway and is deleted; every one of its rows is now a
row in `CROSS_SEGMENT_ALLOW` / `CROSS_SEGMENT_DENY`, so the shipped suite covers all 24.

### Mutation A — revert the fix, keep the tests

`src/hooks.ts:354`, `const segments = shellSegments(command)` → `const segments = [command]`.
That is the shipped behaviour, one line, and it is how a reviewer reproduces this in ten
seconds.

```
$ node --test 'tests/hooks.test.ts'
node exit: 1
ℹ tests 20
ℹ suites 0
ℹ pass 19
ℹ fail 1

✖ failing tests:

test at tests/hooks.test.ts:326:1
✖ a store name in a later command does not deny the rm in an earlier one (0.678125ms)
  AssertionError [ERR_ASSERTION]: denied, though none of these deletes or rewrites anything the guards are about
  + actual - expected

  + [
  +   `the store named in a later command's flag value: "rm -rf /tmp/x && mstack decide --evidence \\".mstack/evidence/x.md\\""`,
  +   'the store named after a semicolon: "rm -rf build; echo see .mstack/state.json"',
  +   'the store named after a pipe: "rm -rf dist | grep .mstack"',
  +   'the store named only inside a commit message: "rm -rf node_modules && git commit -m \\"docs: .mstack notes\\""',
  +   'the store named after ||: "rm -rf /tmp/x || echo .mstack survived"',
  +   'the store named after a backgrounding &: "rm -rf /tmp/scratch & mstack gate .mstack"',
  +   'a redirection before the pipe does not glue the two together: "rm -rf /tmp/x 2>&1 | grep .mstack"',
  +   `--force named in a later echo: "git push origin main && echo 'use --force only after asking'"`,
  +   `a + refspec named in a later echo: "git push origin main && echo 'the +main spelling forces too'"`,
  +   '--admin named in a later echo: "gh pr merge 3 --squash && echo skipped --admin"',
  +   '-D named in a later echo: "git branch -a && echo remember -D deletes unmerged work"'
  + ]
  - []

    operator: 'deepStrictEqual',
```

Eleven of the twelve `CROSS_SEGMENT_ALLOW` rows go red. The twelfth is honest to name: the
newline row (`rm -rf /tmp/x &\necho .mstack`) passes with or without the fix, because `[^\n]*`
already stopped at a newline. It is in the table as a control, not as evidence.

`bun test tests/hooks.test.ts` under the same mutation also exits 1.

### Mutation B — make the scanner redirection-blind

`isSeparator` body replaced with `return true`, so `2>&1` and `&>log` split.

```
$ node --test 'tests/hooks.test.ts'
node exit: 1
ℹ pass 18
ℹ fail 2

✖ failing tests:

test at tests/hooks.test.ts:334:1
✖ segmenting the command does not let a real deletion of the store through (0.565459ms)
  AssertionError [ERR_ASSERTION]: allowed, though each one really does reach the thing its guard protects
  + actual - expected

  + [
  +   'the & of a redirection does not end the command: "git push origin main 2>&1 --force"'
  + ]
  - []

test at tests/hooks.test.ts:342:1
✖ shellSegments cuts where the shell would and nowhere else (0.153041ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
  +   'git push --force 2>',
  +   '1'
  -   'git push --force 2>&1'
    ]
```

This is the one that matters most: the naive splitter turns a false deny into a false
**allow**. `bash` strips `2>&1` wherever it appears, so `git push origin main 2>&1 --force`
really is a force push, and cutting at the `&` hides `--force` from the rule that exists to
catch it.

### Mutation C — make the scanner quote-blind

The opening-quote branch of `shellSegments` removed.

```
$ node --test 'tests/hooks.test.ts'
node exit: 1
ℹ pass 18
ℹ fail 2

✖ failing tests:

test at tests/hooks.test.ts:334:1
✖ segmenting the command does not let a real deletion of the store through (0.594458ms)
  AssertionError [ERR_ASSERTION]: allowed, though each one really does reach the thing its guard protects
  + actual - expected

  + [
  +   'a semicolon inside quotes is a filename character, not a separator: "rm -rf \\"a;b/.mstack\\""'
  + ]
  - []

test at tests/hooks.test.ts:342:1
✖ shellSegments cuts where the shell would and nowhere else (0.131708ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
  +   'rm -rf "a
  +   'b"'
  -   'rm -rf "a;b"'
    ]
```

### Rung 5 — the shipped hook binary, real process, real JSON on stdin

Not the exported function: `bin/mstack hook pre-tool-use` spawned per case with the payload
Claude Code sends, stdout read back and parsed.

```
$ node scratch/live-hook.mjs
  ok    allow exit=0  "rm -rf /tmp/x && mstack decide --evidence \".mstack/evidence/x.md\""
           (no output, i.e. allowed)
  ok    allow exit=0  "rm -rf build; echo see .mstack/state.json"
           (no output, i.e. allowed)
  ok    allow exit=0  "rm -rf dist | grep .mstack"
           (no output, i.e. allowed)
  ok    allow exit=0  "rm -rf node_modules && git commit -m \"docs: .mstack notes\""
           (no output, i.e. allowed)
  ok    allow exit=0  "git push origin main && echo 'use --force only after asking'"
           (no output, i.e. allowed)
  ok    allow exit=0  "gh pr merge 3 --squash && echo skipped --admin"
           (no output, i.e. allowed)
  ok    deny  exit=0  "rm -rf .mstack"
           mstack: that would delete the durable state this workflow runs on
  ok    deny  exit=0  "rm -rf /repo/.mstack/progress"
           mstack: that would delete the durable state this workflow runs on
  ok    deny  exit=0  "rm -rf .mstack*"
           mstack: that would delete the durable state this workflow runs on
  ok    deny  exit=0  "rm -rf ./.mstac?"
           mstack: that would delete the durable state this workflow runs on
  ok    deny  exit=0  "rm -rf .msta*"
           mstack: that would delete the durable state this workflow runs on
  ok    deny  exit=0  "cd /repo && rm -rf .mstack"
           mstack: that would delete the durable state this workflow runs on
  ok    deny  exit=0  "rm -rf \"a;b/.mstack\""
           mstack: that would delete the durable state this workflow runs on
  ok    deny  exit=0  "git push origin main 2>&1 --force"
           mstack: force-push rewrites history other people may have pulled; use --force-with-lease, or ask first

0 row(s) wrong out of 14
exit: 0
```

There is a second live datapoint nobody staged. Midway through this pass the *installed*
plugin's guard denied one of my own `mstack decide` invocations, because its `--evidence`
value contained the string `git push origin main 2>&1 --force`:

```
$ ./bin/mstack decide --phase implement --decision "..." --evidence "... git push origin main 2>&1 --force ..." ...
mstack: force-push rewrites history other people may have pulled; use --force-with-lease, or ask first
```

That is the within-a-command looseness the comment describes and it is working as designed —
it cost one rewritten line. The cross-command denials this item removes cost the same to the
author and buy nothing at all, which is the distinction the fix rests on.

### `npm test` — both runtimes

```
$ npm test

> mstack@0.1.0 test
> bun test tests/ && node --test 'tests/*.test.ts'

bun test v1.3.11 (af24e281)

tests/fanout.test.ts:

-- review fan-out on storage-layer
[ok]    correctness -> review_storage-layer_correctness.md (43 bytes)
[fail]  security returned without writing its report
        fix: its reply is not evidence; re-run it and have it write the file before returning

-- review fan-out on storage-layer
[ok]    correctness -> review_storage-layer_correctness.md (43 bytes)
[fail]  security wrote a stub, not a report
        fix: an empty file is indistinguishable from no work

-- review fan-out on storage-layer
[ok]    correctness -> review_storage-layer_correctness.md (57 bytes)
[ok]    security -> review_storage-layer_security.md (54 bytes)

-- review fan-out on storage-layer
[ok]    correctness -> review_storage-layer_correctness.md (43 bytes)
[warn]  review_storage-layer_freelance.md was not in the plan; nothing will read it

 174 pass
 0 fail
Ran 174 tests across 13 files. [11.46s]
...
✔ a store name in a later command does not deny the rm in an earlier one (0.086542ms)
✔ segmenting the command does not let a real deletion of the store through (0.069958ms)
✔ shellSegments cuts where the shell would and nowhere else (0.055167ms)
...
ℹ tests 174
ℹ suites 0
ℹ pass 174
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4588.705584

npm test exit: 0
```

The `[fail]` and `[warn]` lines inside the bun half are fixture output from `fanout.test.ts`
printing a red report on purpose; the run is `174 pass / 0 fail` on both halves. 171 before,
174 after — three new tests.

### `npm run typecheck`

```
$ npm run typecheck

> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit

typecheck exit: 0
```

### `./bin/mstack lint-plugin .`

```
$ ./bin/mstack lint-plugin .

-- manifest
[ok]    plugin name: mstack
[ok]    plugin-root CLAUDE.md is project memory for this checkout; .mstack/ shows the repo is worked in

-- skills
[ok]    skills/design/SKILL.md (58 lines, 307 description chars)
[ok]    skills/verify/SKILL.md (24 lines, 260 description chars)
[ok]    skills/understand/SKILL.md (56 lines, 281 description chars)
[ok]    skills/reflect/SKILL.md (59 lines, 247 description chars)
[ok]    skills/setup/SKILL.md (72 lines, 251 description chars)
[ok]    skills/spec/SKILL.md (71 lines, 305 description chars)
[ok]    skills/review/SKILL.md (41 lines, 212 description chars)
[ok]    skills/implement/SKILL.md (64 lines, 280 description chars)
[ok]    skills/ship/SKILL.md (38 lines, 190 description chars)
[ok]    skills/orchestrate/SKILL.md (57 lines, 240 description chars)
[ok]    skills/unslop/SKILL.md (71 lines, 216 description chars)
[ok]    skills/router/SKILL.md (145 lines, 310 description chars)

-- agents
[ok]    agents/orchestrator.md
[ok]    agents/reviewer.md
[ok]    agents/spec-reviewer.md
[ok]    agents/spec-author.md
[ok]    agents/implementer.md

-- hooks
[ok]    hook event SessionStart
[ok]    hook event PostToolUse
[ok]    hook event SubagentStop
[ok]    hook event Stop
[ok]    hook event PreToolUse

-- references
[ok]    20 reference file(s), every relative link resolves

-- shipped commands
[ok]    32 file(s), no command that would hang on stdin

-- cross-references
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves

-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings
lint exit: 0
```

## R to test

| # | Acceptance criterion | Covered by | Where |
|---|---|---|---|
| 1 | The guard evaluates only the shell segment containing the `rm`, so a store name in a later `&&`, `;` or `\|` segment does not deny it | `shellSegments cuts where the shell would and nowhere else` — pins the cut points directly, including the ones that must *not* be cut | `tests/hooks.test.ts:342` |
| 1 | …and the guard actually consumes those segments | `a store name in a later command does not deny the rm in an earlier one` — red on 11 of 12 rows under mutation A | `tests/hooks.test.ts:326` |
| 2 | The four reproduced false positives are covered by tests that fail against the current pattern | rows 1-4 of `CROSS_SEGMENT_ALLOW`, all four named in the mutation-A failure above | `tests/hooks.test.ts:276`, `:279`, `:280`, `:282` |
| 3 | True positives keep denying: bare store name, nested path, and the glob spellings the comment names (`.mstac?`, `.msta*`) | `segmenting the command does not let a real deletion of the store through` — bare `:303`, nested `:304`, `.mstack*` `:305`, `.mstac?` `:306`, `.msta*` `:307`; plus the pre-existing `DENY` table, still green | `tests/hooks.test.ts:334`, table at `:302`; `DENY` at `:207` asserted at `:253` |
| 3 | …and segmenting does not open a hole where the `rm` sits in a later segment or behind a quoted separator | same test, rows `:308`-`:314`; quoted-separator row red under mutation C | `tests/hooks.test.ts:334` |
| 4 | Where the guard cannot see a deletion at all, that limit is stated in the module comment rather than implied away | Prose, not a test — a comment cannot have one. Four classes listed: interpreter one-liner, `find -delete` / `fd -X rm` / `git clean -xdf`, path via variable or substitution, two-step `mv` then delete; closes with "a speed bump in front of the obvious spelling, not a sandbox" | `src/hooks.ts:207-220` |

Criterion 4 is the one claim in this report with no executable evidence, and it cannot have
any: it asks for honesty in a comment. A reviewer should read `src/hooks.ts:207-220` and judge
whether the list is complete and whether the closing sentence overclaims. The bypasses named
in the item description (`node -e "fs.rmSync(...)"` and `fd . .mstack -X rm`) are both in it,
still allowed, and now said out loud.

## The sibling guards

Checked, as instructed. Four of the five non-`rm` guards had the identical defect; one did
not. Both runs below are the same script, once with `src/hooks.ts` stashed at `HEAD` and once
with the fix.

```
### AGAINST THE SHIPPED PATTERN (HEAD)
DENIED   push --force          "git push origin main && echo 'use --force only after asking'"
DENIED   push +refspec         "git push origin main && echo 'the +main spelling forces too'"
allowed  reset --hard          "git reset --soft HEAD~1 && echo 'never --hard here'"
allowed  reset --hard          "git status && echo 'git reset --soft not --hard'"
DENIED   branch -D             "git branch -a && echo remember -D deletes unmerged work"
DENIED   gh pr merge --admin   "gh pr merge 3 --squash && echo skipped --admin"
DENIED   rm store              "rm -rf /tmp/x && mstack decide --evidence \".mstack/x.md\""

### AGAINST THE FIX
allowed  push --force          "git push origin main && echo 'use --force only after asking'"
allowed  push +refspec         "git push origin main && echo 'the +main spelling forces too'"
allowed  reset --hard          "git reset --soft HEAD~1 && echo 'never --hard here'"
allowed  reset --hard          "git status && echo 'git reset --soft not --hard'"
allowed  branch -D             "git branch -a && echo remember -D deletes unmerged work"
allowed  gh pr merge --admin   "gh pr merge 3 --squash && echo skipped --admin"
allowed  rm store              "rm -rf /tmp/x && mstack decide --evidence \".mstack/x.md\""
```

`git reset --hard` is the exception, and by luck rather than design: its pattern is
`reset\s+(?:--hard\b|--\S+\s+)*--hard\b`, and every repetition must be a `--token` followed by
whitespace, so the chain cannot walk across a `&&` or a `;`. That is a rung-3 argument (I
walked the pattern) backed by the two rung-4 negative rows above; I did not find a false
positive for it and I am not claiming there is none.

**What I did about it, and why.** I fixed them, because the fix is literally the same
mechanism at the same call site: `preToolUse` segments once and every guard is judged per
segment. The alternative — a per-guard `segmented: true` flag so only the `rm` rule changes —
would be strictly more code, would leave a known-identical defect in the same array, and would
make the next rule someone adds default to the broken behaviour. It does not widen the
item's acceptance: criteria 1-4 are all about the `rm` guard and all four are met on their own
terms. It does mean the diff touches behaviour the acceptance does not name, so I added three
sibling rows to `CROSS_SEGMENT_ALLOW` (`tests/hooks.test.ts:291-294`) and one to
`CROSS_SEGMENT_DENY` (`:318`) — not to widen scope, but because changing the evaluator for
five rules and only testing one of them would be the kind of untested side effect this
workflow exists to catch. The existing `DENY`/`ALLOW` tables (21 + 14 rows, `:207` and `:231`)
are untouched and green, which is the regression evidence for the other four.

**If the reviewer disagrees**, the smaller change is a two-line revert of the comment at
`src/hooks.ts:349-353` plus a `segmented` flag on the `Guard` interface, and the sibling
defect becomes its own item. I lean the way I did, recorded it in `decisions.tsv`, and will
not defend it past a reviewer's call.

## Where each claim stopped on the ladder

| Claim | Rung | How |
|---|---|---|
| The shipped pattern denies the four reported false positives | **5** | Re-reproduced against `HEAD` in two ways: the 24-row table above, and the shipped `bin/mstack hook pre-tool-use` binary |
| Segmentation removes all ten reproduced false denials | **5** | The same binary, spawned as a real process with real hook JSON on stdin, 14/14 correct |
| Each new test fails without the change | **4** | Three independent mutations (A: the evaluator; B: redirection blindness; C: quote blindness), each caught by a named test, all output pasted above |
| Every true positive the old comment claims still denies | **4** + **5** | `CROSS_SEGMENT_DENY` rows `:303`-`:307` plus the pre-existing `DENY` table; the same five rows also re-run through the live binary |
| Both runtimes are green | **4** | `npm test` in full, `174 pass / 0 fail` on bun *and* on node, exit 0 |
| No new dependency, no `Bun.*` in `src/` | **4** | `shellSegments` has no imports; `rg "Bun\.\|import .*bun" src/` is empty, and the node half of `npm test` passes |
| Four sibling guards had the same defect; `git reset --hard` did not | **4** for the four, **3** for the exception | Before/after table above; the `reset` claim is a walk through its pattern plus two negative rows, not a proof of absence |
| The stated limits (criterion 4) are honest and complete | **1** | Prose. A comment has no executable evidence. Read `src/hooks.ts:207-220` and judge it |
| `shellSegments` is correct on shell constructs it does not model (`$(...)` with a separator, heredocs) | **3** | Walked, not tested: an unmodelled construct leaves the segment too long, so the failure mode is a denial, not an allow. Not asserted anywhere; a reviewer who wants it at rung 4 should say so |

## For the reviewer

- The item's status is unchanged and no ledger verdict above `live-verified` is claimed for
  anything the implementer ran. The verdict recorded is the implementer's own, on the
  implementer's own evidence; it is not an approval.
- The one judgement call worth a second opinion is the sibling-guard scope, argued above.
- The one thing not at rung 4 is the honesty of the comment, which is what criterion 4 asks a
  human to check.

---

# Round 2 — the three review findings

**Review:** `.mstack/progress/review_rm-guard-command-boundary.md`, CHANGES_REQUESTED at `b99857b`.
**Commits:** `7b81823` (findings 1 and 2), `5b8397f` (finding 3).
**Still not approving my own work.** Item status untouched; a reviewer closes this.

> Read every `file:line` above this divider against the tree at `0c0c24d`, not against head.
> Round 2 inserted ~57 lines into `src/hooks.ts` and ~11 into `tests/hooks.test.ts`, so the
> round-1 pointers have shifted: `shellSegments` 299 → 330, `preToolUse` 344 → 406, the
> `GUARDS` doc comment 185-221 → unchanged, `CROSS_SEGMENT_DENY` 302 → 310 and its rows
> `:303-:307` → `:311-:315`, and the three round-1 tests 326/334/342 → 361/369/385. Nothing
> above the divider was edited to hide that; every pointer in **this** section is against head.

The reviewer was right, and the finding is the worst kind: my change turned a denial into an
allow. Round 1's own report claimed at rung 3 that "an unmodelled construct leaves the segment
too long, so the failure mode is a denial, not an allow", flagged that it was walked rather
than tested, and invited a reviewer to take it to rung 4. They took it to rung 5 and it was
false. That is exactly the transaction the ladder exists for, and the round-1 claim was wrong
in the direction that costs most.

## Finding 1 — a separator inside `$(...)` cut one command in half

### Re-reproduced first, against both shipped binaries

The same 30 spellings the review names, `bin/mstack hook pre-tool-use` spawned as a real
process against `main` and against the round-1 branch build:

```
$ node scratch/subst.mjs                     # round-1 build
REGRESSION  main=DENY  branch=allow  "rm -rf $(cd /r && pwd)/.mstack"
REGRESSION  main=DENY  branch=allow  "git push origin $(cd /r && pwd) --force"
REGRESSION  main=DENY  branch=allow  "git push origin $(cd /r && pwd) -f"
REGRESSION  main=DENY  branch=allow  "git branch $(cd /r && pwd) -D feature"
REGRESSION  main=DENY  branch=allow  "gh pr merge $(cd /r && pwd) --admin"
REGRESSION  main=DENY  branch=allow  "rm -rf $(cd /r ; pwd)/.mstack"
REGRESSION  main=DENY  branch=allow  "git push origin $(cd /r ; pwd) --force"
REGRESSION  main=DENY  branch=allow  "git push origin $(cd /r ; pwd) -f"
REGRESSION  main=DENY  branch=allow  "git branch $(cd /r ; pwd) -D feature"
REGRESSION  main=DENY  branch=allow  "gh pr merge $(cd /r ; pwd) --admin"
REGRESSION  main=DENY  branch=allow  "rm -rf $(ls /r | head -1)/.mstack"
REGRESSION  main=DENY  branch=allow  "git push origin $(ls /r | head -1) --force"
REGRESSION  main=DENY  branch=allow  "git push origin $(ls /r | head -1) -f"
REGRESSION  main=DENY  branch=allow  "git branch $(ls /r | head -1) -D feature"
REGRESSION  main=DENY  branch=allow  "gh pr merge $(ls /r | head -1) --admin"
REGRESSION  main=DENY  branch=allow  "rm -rf $(git rev-parse --show-toplevel 2>/dev/null || echo .)/.mstack"
REGRESSION  main=DENY  branch=allow  "git push origin $(git rev-parse --show-toplevel 2>/dev/null || echo .) --force"
REGRESSION  main=DENY  branch=allow  "git push origin $(git rev-parse --show-toplevel 2>/dev/null || echo .) -f"
REGRESSION  main=DENY  branch=allow  "git branch $(git rev-parse --show-toplevel 2>/dev/null || echo .) -D feature"
REGRESSION  main=DENY  branch=allow  "gh pr merge $(git rev-parse --show-toplevel 2>/dev/null || echo .) --admin"
REGRESSION  main=DENY  branch=allow  "rm -rf `cd /r && pwd`/.mstack"
REGRESSION  main=DENY  branch=allow  "git push origin `cd /r && pwd` --force"
REGRESSION  main=DENY  branch=allow  "git push origin `cd /r && pwd` -f"
REGRESSION  main=DENY  branch=allow  "git branch `cd /r && pwd` -D feature"
REGRESSION  main=DENY  branch=allow  "gh pr merge `cd /r && pwd` --admin"
REGRESSION  main=DENY  branch=allow  "rm -rf $(a & wait)/.mstack"
REGRESSION  main=DENY  branch=allow  "git push origin $(a & wait) --force"
REGRESSION  main=DENY  branch=allow  "git push origin $(a & wait) -f"
REGRESSION  main=DENY  branch=allow  "git branch $(a & wait) -D feature"
REGRESSION  main=DENY  branch=allow  "gh pr merge $(a & wait) --admin"

30/30 spellings regressed from DENY to allow
exit: 1
```

### The fix

`shellSegments` now carries a `depth` counter and a `backtick` flag
(`src/hooks.ts:330-383`). `$(`, `<(`, `>(` and any `(` nested inside an already-open construct
increment it; the matching `)` decrements; a backtick toggles the flag; and while depth is
non-zero or the flag is set, `isSeparator` is never consulted. An opener with no closer holds
the rest of the line in one segment, which denies. Six lines of state, no parser, no
dependency, `node:` builtins untouched.

### The same 30 rows after

```
$ node scratch/subst.mjs                     # round-2 build
  ok        main=DENY  branch=DENY   "rm -rf $(cd /r && pwd)/.mstack"
  ok        main=DENY  branch=DENY   "git push origin $(cd /r && pwd) --force"
  ok        main=DENY  branch=DENY   "git push origin $(cd /r && pwd) -f"
  ok        main=DENY  branch=DENY   "git branch $(cd /r && pwd) -D feature"
  ok        main=DENY  branch=DENY   "gh pr merge $(cd /r && pwd) --admin"
  ok        main=DENY  branch=DENY   "rm -rf $(cd /r ; pwd)/.mstack"
  ok        main=DENY  branch=DENY   "git push origin $(cd /r ; pwd) --force"
  ok        main=DENY  branch=DENY   "git push origin $(cd /r ; pwd) -f"
  ok        main=DENY  branch=DENY   "git branch $(cd /r ; pwd) -D feature"
  ok        main=DENY  branch=DENY   "gh pr merge $(cd /r ; pwd) --admin"
  ok        main=DENY  branch=DENY   "rm -rf $(ls /r | head -1)/.mstack"
  ok        main=DENY  branch=DENY   "git push origin $(ls /r | head -1) --force"
  ok        main=DENY  branch=DENY   "git push origin $(ls /r | head -1) -f"
  ok        main=DENY  branch=DENY   "git branch $(ls /r | head -1) -D feature"
  ok        main=DENY  branch=DENY   "gh pr merge $(ls /r | head -1) --admin"
  ok        main=DENY  branch=DENY   "rm -rf $(git rev-parse --show-toplevel 2>/dev/null || echo .)/.mstack"
  ok        main=DENY  branch=DENY   "git push origin $(git rev-parse --show-toplevel 2>/dev/null || echo .) --force"
  ok        main=DENY  branch=DENY   "git push origin $(git rev-parse --show-toplevel 2>/dev/null || echo .) -f"
  ok        main=DENY  branch=DENY   "git branch $(git rev-parse --show-toplevel 2>/dev/null || echo .) -D feature"
  ok        main=DENY  branch=DENY   "gh pr merge $(git rev-parse --show-toplevel 2>/dev/null || echo .) --admin"
  ok        main=DENY  branch=DENY   "rm -rf `cd /r && pwd`/.mstack"
  ok        main=DENY  branch=DENY   "git push origin `cd /r && pwd` --force"
  ok        main=DENY  branch=DENY   "git push origin `cd /r && pwd` -f"
  ok        main=DENY  branch=DENY   "git branch `cd /r && pwd` -D feature"
  ok        main=DENY  branch=DENY   "gh pr merge `cd /r && pwd` --admin"
  ok        main=DENY  branch=DENY   "rm -rf $(a & wait)/.mstack"
  ok        main=DENY  branch=DENY   "git push origin $(a & wait) --force"
  ok        main=DENY  branch=DENY   "git push origin $(a & wait) -f"
  ok        main=DENY  branch=DENY   "git branch $(a & wait) -D feature"
  ok        main=DENY  branch=DENY   "gh pr merge $(a & wait) --admin"

0/30 spellings regressed from DENY to allow
exit: 0
```

### Widened, because 30 rows is a sample and not a property

528 destructive spellings — 22 genuinely destructive commands across all six guards, times 24
wrappers including five substitution shapes — through both shipped binaries. Section B is the
other half of the bargain: the item's own false positives must not come back.

```
$ node scratch/differential.mjs
-- A. differential over 528 destructive spellings (22 commands x 24 wrappers)
   main DENIED, branch allows (FALSE ALLOWS introduced): 0
   main allowed, branch denies (bypasses closed):        0

-- B. the false positives item 12 exists to remove, through the branch binary
     ok    main=DENY  branch=allow  acceptance FP 1: a later flag value            "rm -rf /tmp/x && mstack decide --evidence \".mstack/evidence/x.md\""
     ok    main=DENY  branch=allow  acceptance FP 2: after a semicolon             "rm -rf build; echo see .mstack/state.json"
     ok    main=DENY  branch=allow  acceptance FP 3: after a pipe                  "rm -rf dist | grep .mstack"
     ok    main=DENY  branch=allow  acceptance FP 4: inside a commit message       "rm -rf node_modules && git commit -m \"docs: .mstack notes\""
     ok    main=DENY  branch=allow  after ||                                       "rm -rf /tmp/x || echo .mstack survived"
     ok    main=allow branch=allow  on the next line                               "rm -rf /tmp/x &\necho .mstack"
     ok    main=DENY  branch=allow  after a backgrounding &                        "rm -rf /tmp/scratch & mstack gate .mstack"
     ok    main=DENY  branch=allow  redirection then pipe                          "rm -rf /tmp/x 2>&1 | grep .mstack"
     ok    main=DENY  branch=allow  a closed substitution before the separator     "rm -rf $(mktemp -d) && echo .mstack"
     ok    main=DENY  branch=allow  the backtick spelling of the same              "rm -rf `mktemp -d` && echo .mstack"
     ok    main=allow branch=allow  a substitution holding the store, no rm at all "mstack decide --evidence \"$(pwd)/.mstack/x.md\""
     ok    main=DENY  branch=allow  sibling: --force in a later echo               "git push origin main && echo 'use --force only after asking'"
     ok    main=DENY  branch=allow  sibling: + refspec in a later echo             "git push origin main && echo 'the +main spelling forces too'"
     ok    main=DENY  branch=allow  sibling: --admin in a later echo               "gh pr merge 3 --squash && echo skipped --admin"
     ok    main=DENY  branch=allow  sibling: -D in a later echo                    "git branch -a && echo remember -D deletes unmerged work"
     ok    main=allow branch=allow  the safe form the guard recommends             "git push --force-with-lease origin main"
     ok    main=allow branch=allow  an ordinary cleanup                            "rm -rf node_modules"

   0 of 17 still denied by the branch

PASS - 0 false allow(s), 0 unfixed false positive(s)
exit: 0
```

Rows 9 and 10 of section B are what decides between the two fixes the reviewer offered.
`rm -rf $(mktemp -d) && echo .mstack` must stay allowed: the substitution closes before the
separator, so the `&&` really does end the command. The reviewer's smaller alternative — also
match every guard against the whole line whenever it contains a `$(` — provably cannot regress
anything `main` caught, but it re-denies that row and `mstack decide --evidence
"$(pwd)/.mstack/x.md"`, which is a line this project's own workflow tells people to write.
Depth tracking costs a false denial only when the destructive argument is *inside* the
substitution (`rm -rf /tmp/x $(grep -l . .mstack/*)`), which is the recoverable direction.
Recorded in `decisions.tsv`.

### Mutation testing — one construct removed at a time

Each row deletes exactly one thing the scanner models, runs `node --test tests/hooks.test.ts`,
and restores. A surviving mutation would mean that construct is asserted nowhere.

```
$ bash scratch/mutate.sh
killed       drop $( tracking :: a separator inside a substitution does not end the command that contains it; shellSegments keeps a whole substitution inside one segment
killed       drop backtick tracking :: a separator inside a substitution does not end the command that contains it; shellSegments keeps a whole substitution inside one segment
killed       drop <( tracking :: shellSegments keeps a whole substitution inside one segment
killed       drop >( tracking :: shellSegments keeps a whole substitution inside one segment
killed       drop nested-paren depth (breaks $(( and $( ( ) )) :: a separator inside a substitution does not end the command that contains it; shellSegments keeps a whole substitution inside one segment
killed       never give the depth back :: a store name in a later command does not deny the rm in an earlier one; shellSegments keeps a whole substitution inside one segment
killed       ignore depth entirely (the shipped round-1 behaviour) :: a separator inside a substitution does not end the command that contains it; shellSegments keeps a whole substitution inside one segment

src/hooks.ts restored: yes
```

Seven mutations, seven killed, and not by accident of a neighbouring assertion: `<(` and `>(`
are killed **only** by the `shellSegments` unit test. That is why that test exists — neither
has a destructive one-liner anyone would actually write, so the cut points are the only honest
place to assert them.

**A process error in this run, recorded because it nearly cost the whole fix.** My first
mutation driver restored with `git checkout -- src/hooks.ts`. The fix was not committed yet,
so the first mutation's restore silently discarded it, and the next six reported
`SETUP-ERROR :: pattern did not match` against un-mutated code — a result that reads like
"nothing to mutate" rather than "your work is gone". Caught by an `rg` for the new identifiers
coming back empty. The fix was re-applied, verified, and **committed before** any mutation ran;
the driver now takes a byte copy under a `trap` and asserts the file matches at the end (the
`src/hooks.ts restored: yes` line above). Recorded in `decisions.tsv`.

## Finding 2 — the stated limit was false in the unsafe direction

The sentence the reviewer quoted is gone as a claim and kept as a section. `shellSegments`'s
doc comment (`src/hooks.ts:273-329`) now opens with the rule rather than a feature list:

> A construct it cannot model must leave a segment too **long**, never too short.

followed by why the two directions are not symmetric, and then by the incident itself — that
this scanner shipped splitting inside `$(...)`, and that `rm -rf $(cd /r && pwd)/.mstack` went
from denied to allowed — so the next person to touch it cannot read the rule as decoration.
"What it does not model" is now a list where **every entry names its direction**:

| Unmodelled | Direction | Why that is the direction |
|---|---|---|
| a heredoc body scanned as command text | long | each body line is already whole, so nothing is hidden; a body line that reads destructive is denied even though it is data |
| `[[ a && b ]]`, `((i && j))`, `case` patterns spelled with `\|` | **short** | said plainly rather than implied away. None of them is a command with a destructive verb and an argument to separate, so nothing the guards look for straddles the cut. Written as an argument, and named as the first place to look if a bypass appears |
| `isSeparator` cannot see that a preceding `>` was escaped | long | review minor 2, carried into the comment |

The accurate list at `src/hooks.ts:207-220` — the one the reviewer verified at rung 5 — is
untouched. All seven of its forms were re-run against the round-2 binary and all seven are
still allowed (the `wiki-claims` table below, rows 7-12).

## Finding 3 — `docs/wiki/Gates-and-Hooks.md`

- `:25` now cites `src/hooks.ts:230-271`, which is where `GUARDS` actually is.
- The paragraph at `:42-46` is replaced. It said the guards are "regexes over the command
  string" and used `echo "do not git push --force"` to justify the false-positive cost — one
  sentence made obsolete by this change and one still true. The page now separates them: loose
  within a command (with that same `echo` example, still denied), not loose across commands,
  the substitution false allow and what closed it, and a closing paragraph saying the array is
  not a sandbox.

Per `CONTRIBUTING.md:43-44`, every behavioural claim the page makes was re-run before the
sentence was written, through the shipped binary on both revisions:

```
$ node scratch/wiki-claims.mjs
  ok            branch=DENY   the guards eat git's global options                  "git -C dir push --force"
  ok            branch=DENY   a + refspec is a force push                          "git push origin +main"
  ok            branch=DENY   within a command the match is loose, cost accepted   "echo \"do not git push --force\""
  ok    main=DENY  branch=allow  matching across a separator denied harmless work     "rm -rf /tmp/x && mstack decide --evidence \".mstack/x.md\""
  ok            branch=allow  ...is therefore allowed                              "git push origin main && echo 'use --force only after asking'"
  ok    main=DENY  branch=DENY   the substitution false allow, now closed             "rm -rf $(cd /r && pwd)/.mstack"
  ok            branch=allow  an interpreter one-liner passes                      "node -e \"fs.rmSync('.mstack',{recursive:true})\""
  ok            branch=allow  find -delete passes                                  "find .mstack -delete"
  ok            branch=allow  fd -X rm passes                                      "fd . .mstack -X rm"
  ok            branch=allow  a path arriving through a variable passes            "rm -rf \"$STORE\""
  ok            branch=allow  mv followed by a deletion passes (step 1)            "mv .mstack /tmp/x"
  ok            branch=allow  mv followed by a deletion passes (step 2)            "rm -rf /tmp/x"
  ok    main=DENY  branch=DENY   the table row: rm -r on the store                    "rm -rf .mstack"
  ok            branch=DENY   the table row: git reset --hard                      "git reset --hard HEAD~1"
  ok            branch=DENY   the table row: the --delete --force spelling         "git branch --delete --force feature"
  ok            branch=DENY   the table row: gh pr merge --admin                   "gh pr merge 3 --admin"
  ok            branch=allow  --force-with-lease stays allowed                     "git push --force-with-lease origin main"

0 claim(s) wrong out of 17
exit: 0
```

One claim the page does *not* make: I cut a "denied for a year" phrase from my own draft. I
have no evidence for the duration and did not go looking for it.

## The four minors

| # | What | Done |
|---|---|---|
| 1 | the newline row documents rather than falsifies | a comment at `tests/hooks.test.ts:286-289` says so, and says it does not count toward criterion 2 |
| 2 | `isSeparator` cannot see an escaped `>` | now the third entry in the comment's unmodelled list, with its direction |
| 3 | "Five of the six patterns" reads as if the sixth is one of the five | reworded to "All but one of the patterns above ... the exception is `git reset --hard`", `src/hooks.ts:411-416` |
| 4 | `shellSegments` is exported only for the test | said, and why, at `src/hooks.ts:281-283` |

## Round-2 commands

```
$ npm test
> bun test tests/ && node --test 'tests/*.test.ts'
bun test v1.3.11 (af24e281)
 176 pass
 0 fail
Ran 176 tests across 13 files. [12.43s]
...
ℹ tests 176
ℹ suites 0
ℹ pass 176
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
npm test exit: 0

$ npm run typecheck
> bunx --bun tsc --noEmit
typecheck exit: 0

$ ./bin/mstack lint-plugin .
[ok]    20 reference file(s), every relative link resolves
PASSED - 0 failures, 0 warnings
lint exit: 0
```

174 tests before this round, 176 after: two new tests, and one existing table grew by two rows.

## Round-2 R to test

| Finding | Covered by | Where |
|---|---|---|
| 1 — a separator inside `$(...)` or a backtick must not end the command | `a separator inside a substitution does not end the command that contains it`, 11 rows across all five affected guards, including the idiom that really deleted a store | `tests/hooks.test.ts:377`, table at `:342` |
| 1 — the cut points themselves, for `<(`, `>(`, `$((` and a nested paren | `shellSegments keeps a whole substitution inside one segment` | `tests/hooks.test.ts:415` |
| 1 — a closed substitution gives the depth back, so later separators still separate | `a store name in a later command does not deny the rm in an earlier one`, rows `:301` and `:302` | `tests/hooks.test.ts:361` |
| 1 — a bare `(` is a subshell and *should* split | `shellSegments keeps a whole substitution inside one segment`, the `(cd /r && rm -rf x)` assertion | `tests/hooks.test.ts:415` |
| 1 — nothing round 1 fixed came back | `a store name in a later command...` (14 rows) and `segmenting the command...` (13 rows), both green; plus the 528-spelling differential | `tests/hooks.test.ts:361`, `:369` |
| 2 — the limit is stated, and stated in the right direction | Prose. Not testable, and that is the point of the criterion | `src/hooks.ts:273-329` |
| 3 — the wiki page matches the code | Prose plus a 17-claim re-run through both binaries | `docs/wiki/Gates-and-Hooks.md:25`, `:43-74` |

## Where the round-2 claims stopped on the ladder

| Claim | Rung | How |
|---|---|---|
| The false allow was real, and mine | **5** | 30/30 reproduced against both shipped binaries as real processes, before touching anything |
| All 30 are back to DENY | **5** | Same script, same two binaries, after |
| No *new* false allow was introduced by depth tracking | **4** | 528-spelling differential, 22 commands x 24 wrappers, both binaries. A large sample against a fixed corpus, not a proof of absence — I say so, the same way the reviewer did about theirs |
| Every false positive the item exists to remove is still removed | **5** | Section B, 17 rows through the shipped binary, all four acceptance rows among them |
| Each modelled construct is asserted by a test that fails without it | **4** | 7 mutations, 7 killed, each by a named test, driver verified to restore |
| Both runtimes, typecheck and lint green | **4** | `npm test` 176/176 on bun and node, exit 0; `tsc --noEmit` exit 0; `lint-plugin` 0 failures |
| Every behavioural claim in the wiki page is true | **5** | 17 claims re-run through the shipped binaries; the page was written from that output, not the other way round |
| The unmodelled `[[ ]]` / `((` / `case` class cannot hide a destructive verb from its argument | **3** | Argued, not tested. The comment says so in the comment itself and names it as the first place to look. If a reviewer wants it at rung 4, the shape is a differential over those three wrappers — say so and I will run it |

## For the reviewer, round 2

- Round 1's rung-3 claim was wrong and the reviewer's rung-5 check is what caught it. I have
  not quietly amended round 1's ladder table; it stands as written, and this section says it
  was false. A report that edits its own history to look better is worse than one that was
  wrong once.
- The scope question is still open and still yours. The four sibling guards were segmented as
  a side effect of this item, and the reviewer correctly noted that this diff therefore
  *created* four of the five false allows. They are closed now and verified per guard, but if
  the judgement is that segmenting the siblings belongs in its own item, the revert is small
  and I will not argue past your call.
