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
