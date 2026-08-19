# Review - the plugin (adversarial)

**Verdict:** CHANGES_REQUESTED

**Tree reviewed:** the source moved four times while I was reading it. Findings were developed
against HEAD `3370d21` plus its uncommitted edits, then every one of them was re-run against
HEAD `01c1725` (`6637e56 fix: make the fork's answer an answer`,
`29d5aa2 fix: the linter must not police the store's own records`, `01c1725`). All findings below
hold at `01c1725` except finding 21, which those commits fixed and which I have left in place with
the fix noted, because it is the one that would otherwise redden CI. Where an in-flight edit
narrowed a finding, I say so in the finding.

**Disclosure:** a bug in my own verification script (`R=$(new)` in a subshell, so its `cd` did not
persist) ran six cases against this repository's real `.mstack/` instead of a scratch directory. It
added an item, appended a ledger row and a decisions row, and ran `mstack setup --force`, which
overwrote `state.json` and `progress/current.md`. I restored all four files with
`git restore -- .mstack/`, re-ran everything from `mktemp -d`, and confirmed the store byte-identical
to `HEAD`. `history.md` was never touched. No source file was modified by me at any point.

The lens was: which rules does the prose assert that no code sustains. The answer is that the
enforcement points are real and the *floors* on what satisfies them are not. Every gate in the
system can be cleared with content that says nothing, and the sequence in "Verification I ran"
walks an item to `done` with a green gate having proven nothing at all. That is the same defect the
panel closed on `closed_by`, now living in four other places at once.

## Claims I checked against code

| Claim | Where it is made | Enforced by | Holds? |
|---|---|---|---|
| A fork is answered by `mstack decide`, "which writes the reasoning to `decisions.tsv`" | README.md:63 | `src/cli.ts:373-380`, `src/gate.ts:228-232` | **No.** `--why` and `--evidence` are optional. `--decision x --result y` clears it. Finding 1 |
| "the only way to answer it is `mstack decide --resolves`" | README.md:63, CHANGELOG.md:24 | `src/cli.ts:268-273` | **No.** `--force` walks it to `done` and records nothing. Finding 5 |
| Safe means "a verdict from a pass that did not write the code" | skills/ship/SKILL.md:11 | nothing | **No.** `src/gate.ts:305-315` never reads `verifier`. Finding 2 |
| `require_verdict_to_close` | .mstack/state.json `rules` | `src/gate.ts:158`, `src/ledger.ts:50-61` | Cleared by 1 char of evidence at a SHA that is not a commit. Finding 3 |
| `require_spec_for_sdd_items` | same | `src/gate.ts:157` | Cleared by four 43-byte files. Silent when off. Findings 3, 12 |
| `one_active_item` | same | `src/gate.ts:136-154` only | Reported, never refused at write time. Finding 12 |
| "state.json ... the lifecycle the gate enforces" | README.md:120 | `src/state.ts:66-107` | Read path is shape-checked. **Write path is not.** Findings 4, 11 |
| `Stop` "never burns the eight-block budget" | README.md:103 | `src/hooks.ts:174` | **No.** hooks.md:2475 says `additionalContext` shares the same cap. Finding 14 |
| `Stop`/`SubagentStop`/`SessionStart`/`PostToolUse` output shape | `src/hooks.ts:49-53` | `hookSpecificOutput.additionalContext` | **Yes.** hooks.md:984, :994, :3374. The earlier panel's finding 1 was wrong |
| `PreToolUse` deny holds under `bypassPermissions` | README.md:104 | `src/hooks.ts:250-257` | Yes in substance (permissions.md:417). The doc's "before permission rules" sentence is scoped to exit 2; mstack uses exit 0 + JSON `deny`, which permissions.md:419 confirms is still honoured |
| "Denies force-push, hard reset, `branch -D`, `pr merge --admin`" | README.md:104 | `src/hooks.ts:205-240` | Mostly. `git branch -d --force` is allowed *and the comment above the regex claims it is covered*. Finding 9 |
| `orchestrator`, `spec-reviewer`, `reviewer` ship without `Write`/`Edit` | README.md:108 | agent frontmatter | **Yes, literally.** But orchestrator carries `Agent`, and nothing tests any of it. Finding 16 |
| `merge-gate` "Exit 0 go, 1 wait, 2 stop" | README.md:142 | `src/mergegate.ts:19` | Yes, but a `StatusContext` in `ERROR` or `EXPECTED` returns GO. Finding 7 |
| "`bin/mstack` is on `PATH` whenever the plugin is enabled" | README.md:133 | - | Overstated. plugins.md:183 scopes it to *the Bash tool's* PATH; README.md:169 gets this right |
| "Fast session gate, milliseconds" | README.md:137 | - | Yes. 60 ms measured, three runs |
| "no build step and no committed artifact" / "zero dependencies" / no lockfile | README.md | - | Yes. Every import is `node:` or relative; no lockfile tracked; 151/151 green on bun and node |
| "the excess queues silently" past 20 subagents | src/fanout.ts:27, :60 | - | **No.** sub-agents.md: the 21st spawn *fails* with an error telling Claude not to retry. Finding 10 |
| "router over ten playbooks" | CHANGELOG.md:7 | - | **No.** There are 7. Panel finding 17, still open |

## Verification I ran

Everything below ran in `mktemp -d`, against the tree as it stood at the end of the review.

### The headline: an item reaches `done`, the gate is green, nothing was proven

```
$ mstack state add --slug export-json --title "Export JSON" --acceptance "it exports json" \
    --sdd --decision-required "Is this a stable public contract, or a dump we may change?"
$ mstack state set export-json --status specifying
$ mstack decide --resolves export-json --decision x --result y
recorded, and export-json no longer has an open fork
$ mkdir -p .mstack/specs/export-json
$ for f in proposal design tasks spec; do printf 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n' \
    > .mstack/specs/export-json/$f.md; done
$ printf 'x\ny\n' > .mstack/progress/current.md
$ mstack state set export-json --status spec_ready   # then in_progress, reviewing, verifying
$ mstack ledger record export-json 0000000000000000000000000000000000000000 live-verified --evidence x
recorded live-verified for export-json at 00000000
$ mstack state set export-json --status done
$ cat .mstack/decisions.tsv
ts	phase	decision	why	evidence	result	resolves
2026-08-19T19:03:04.498Z		x			y	fork
$ mstack gate
[ok]    1 open item(s) with a decision fork, each answered or still in specifying
[ok]    no sdd item is past specifying
[ok]    1 closed item(s) carry a ledger verdict
PASSED - 0 failures, 2 warnings
$ echo $?
0
```

The product fork was answered by the letters `x` and `y`. The spec is 172 bytes of `x`. The
checkpoint that "survives a dead context window" is four bytes. The verdict is `live-verified`
against forty zeros, with the letter `x` as its evidence. `PASSED - 0 failures`.

### An item reaches `done` with its fork never answered at all

```
$ mstack state add --slug forked --title F --acceptance a --decision-required "A or B?"
$ for s in in_progress reviewing verifying done; do mstack state set forked --status $s --force; done
$ python3 -c "...print(i['status'], i.get('decision_resolved'))"
  forked is now: done | decision_resolved: None
  any record that --force was used? decisions.tsv rows: 0
```

`src/cli.ts:272` says "pass `--force` if you mean to skip a phase, and say why in decisions.tsv".
Nothing checks that anything was said.

### A slug that starts with a digit resolves to the wrong item

```
$ mstack state list
  1 alpha (pending)      id 1
  2 bravo (pending)      id 2
  3 2fa-login (pending)  id 3
$ mstack state set 2fa-login --status in_progress
2 bravo (in_progress)
$ echo $?
0
```

Same through the gate the README headlines:

```
$ mstack decide --resolves 2fa --decision "we will use TOTP" --why cheapest --evidence docs/x.md --result decided
recorded, and beta no longer has an open fork
  1 alpha | decision_required: fork on ALPHA | resolved: None
  2 beta  | decision_required: fork on BETA  | resolved: 2026-08-19T18:49:16.604Z
  3 2fa   | decision_required: fork on 2FA   | resolved: None
```

### `state add` writes a `state.json` its own parser rejects

```
$ mstack state add --slug "Export JSON" --title T --acceptance a
added 1 Export JSON (pending)          rc=0
$ mstack state list                    rc=2
$ mstack gate --quiet                  rc=1
$ mstack state set 1 --status in_progress
mstack: .../state.json .items[0].slug must be kebab-case, got "Export JSON"
$ echo '{}' | mstack statusline
main · state.json unreadable
```

### `setup --force` destroys the queue

```
  before: 3 items
$ mstack setup --force
[ok]    state.json written
[ok]    progress/history.md already exists, left alone
PASSED - 0 failures, 0 warnings          rc=0
  after : no items
```

### `worktree prune` deletes files git never told you about

```
$ ls -a repo-wt-feature-one
.env  build  .git  .gitignore  a  w.txt      # .env and build/ are gitignored
$ git -C repo-wt-feature-one status --porcelain
                                            # empty: "clean"
$ mstack worktree list
b96f4a42  feat/feature-one   merged   /tmp/.../repo-wt-feature-one
$ mstack worktree prune --yes
removing /tmp/.../repo-wt-feature-one - feat/feature-one is merged into the default branch
removed 1 worktree(s)                    rc=0
$ cat repo-wt-feature-one/.env
cat: No such file or directory
```

And run from *inside* that worktree, it deletes the directory the session is standing in, rc=0.

### The merge gate returns GO on two real GitHub states

`evaluate()` called directly with crafted `gh pr view --json` payloads:

```
GO   exit=0  StatusContext state=ERROR (a commit status that errored)
GO   exit=0  StatusContext state=EXPECTED (required status never reported)
GO   exit=0  mergeStateStatus absent entirely (field missing from gh output)
GO   exit=0  reviewDecision REVIEW_REQUIRED, mergeState CLEAN
STOP exit=2  control: a genuinely failing check
```

Neither `ERROR` nor `EXPECTED` appears anywhere in `verdict.reasons`. The output does not say the
check exists. Enum confirmed against GitHub's live schema:

```
$ gh api graphql -f query='{s:__type(name:"StatusState"){enumValues{name description}}}'
s	EXPECTED	Status is expected.
s	ERROR	Status is errored.
s	FAILURE	Status is failing.
s	PENDING	Status is pending.
s	SUCCESS	Status is successful.
```

`MergeStateStatus` and `CheckConclusionState` are handled exhaustively; `StatusState` is not.

### The honest verdict fails the default check

```
$ mstack ledger record thing "$(git rev-parse HEAD)" type-check-only --evidence "tsc --noEmit"
$ mstack ledger check thing
FAIL best verdict at f775e671 is type-check-only, which does not clear test-verified
  rc=1
$ rg -n -- '--min' skills/ agents/
  (no matches)
```

### The commands two skills tell you to run

```
$ mstack fanout plan --kind explore --worker a --worker b
mstack: 'explore' is not a report kind
        one of: impl, review, spec, spec_review          rc=2
$ mstack fanout check                                     # skills/review/SKILL.md:27, verbatim
mstack: fanout needs --kind                               rc=2
```

### The formula guard, defeated by a character you cannot see

```
plain formula            out: "'=cmd|'/bin/sh -c id'!A0"   guarded=true
leading ZWSP U+200B      out: "​=cmd|'/bin/sh -c id'!A0"   guarded=false
leading LRM U+200E       out: "‎=cmd|..."                  guarded=false
leading WORD JOINER      out: "⁠=cmd|..."                  guarded=false
CSV double-quoted cell   out: "\"=cmd|...\""                    guarded=false
```

Reachable through the CLI, written to disk unguarded (`e2 80 8b 3d` = ZWSP, `=`):

```
$ mstack ledger record thing "$(git rev-parse HEAD)" test-verified \
    --evidence "$(printf '​')=cmd|'/bin/sh -c id'!A0" --verifier "PR title from a stranger"
$ tail -1 .mstack/ledger.tsv | hexdump -C
00000030  65 73 74 2d 76 65 72 69  66 69 65 64 09 e2 80 8b  |est-verified....|
```

### The guards

```
DENY   git push --force origin main          DENY   git -C /repo push --force origin main
DENY   git push origin +main                 DENY   git branch -D feat/x
DENY   git reset --hard HEAD~1               DENY   gh pr merge 12 --admin
DENY   rm -rf .mstack                        ALLOW  git push --force-with-lease origin main
ALLOW  git branch -d --force feat/x     <--  the comment at src/hooks.ts:225 says this is covered
ALLOW  rm --recursive --force .mstack   <--  GNU long form
ALLOW  git clean -fdx                        ALLOW  git push --delete origin main
ALLOW  git push origin :main                 ALLOW  git branch -M main
ALLOW  tool_name=PowerShell                  DENY   tool_name=Bash
```

### The rules matrix

```
one_active_item=true     gate rc=1  [fail]  2 items are active in this worktree
one_active_item=false    gate rc=0  [warn]  2 items active with one_active_item off
one_active_item=absent   gate rc=1  [fail]  ...
one_active_item="false"  gate rc=1  [fail]  ...        (string coerces to enabled)
one_active_item=0        gate rc=1  [fail]  ...
require_verdict_to_close=false      gate rc=0  <no line at all>
require_spec_for_sdd_items=false    gate rc=0  <no line at all>
```

And the write path normalises away everything it does not model:

```
before: rules {"one_active_item":"false","my_rule":true}  project 42  item0 has "notes"
$ mstack state set a1 --status in_progress                rc=0, no warning
after : rules {"one_active_item":true,...}  project "unnamed"  item0 keys: acceptance,id,slug,status,title
```

### The plugin's own linter is red, on a review report

```
$ ./bin/mstack lint-plugin .
[fail]  the full lifecycle enum is repeated in: .mstack/progress/review_decision-required-gate_correctness.md
FAILED - 1 failure, 0 warnings
```

### Things that hold

`bun test tests/` and `node --test 'tests/*.test.ts'`: 151 pass, 0 fail, both runners. `mstack gate`
0.06 s. Post-edit hook 0.02 s on both runtimes. Every `src/` import is `node:` or relative. No
lockfile tracked. `hooks/hooks.json` uses `args` correctly (exec form, hooks.md:449), every event
name is real, and the four `additionalContext` shapes match hooks.md:984/:994/:3374 — the earlier
panel's finding 1 was wrong and the current code is right. `roleOf` correctly strips the
`mstack:` prefix that plugin subagents report (hooks.md:2212). The `MergeStateStatus` and
`CheckConclusionState` handling is exhaustive against the live GitHub schema.

## Findings

1. **`src/cli.ts:373-380` and `src/gate.ts:228-232` — a product fork is answered by two single
   characters, and `--why` and `--evidence` are optional.** *Narrowed but not closed by `6637e56`,
   which added the `--result` requirement and the one-alphanumeric floor; re-verified at `01c1725`,
   where `--decision x --result y` still clears the fork and `state set ... --status spec_ready`
   still exits 0.* The floor on `--decision` is
   `/[a-z0-9]/i`: one alphanumeric character. `--result` need only be non-empty and not the literal
   `open`. So `mstack decide --resolves <slug> --decision x --result y` writes a row whose reasoning
   and evidence columns are empty, stamps the item, and the gate reports
   `[ok] 1 open item(s) with a decision fork, each answered`. README.md:63 says this command "writes
   the reasoning to `decisions.tsv`" and that "a boolean would have let someone mark a fork answered
   without saying what the answer was". `x`/`y` is a boolean with extra steps, which is the phrase
   `src/gate.ts:12` uses for the thing it is trying to prevent. **Fix:** require `--why` and
   `--evidence` when `--resolves` is present, and hold them to `MIN_REPORT_BYTES` the way spec
   artifacts and subagent reports already are. One number, one place, already exists in
   `src/roles.ts:64`.

2. **`src/gate.ts:305-315` — `checkClosedItems` never reads the `verifier` column, so the
   implementer's own verdict closes the item.** `agents/implementer.md:45` instructs the implementer
   to run `mstack ledger record <slug> ... --verifier implementer`. `skills/ship/SKILL.md:11` defines
   safe as "a verdict from a pass that did not write the code". The gate filters ledger rows on
   `entry.target` and inspects only `entry.verdict`. This is `closed_by` again: a field the same
   actor writes, clearing the rule that exists to stop the same actor clearing it. CHANGELOG.md:38-42
   claims that shape was fixed. **Fix:** `checkClosedItems` should require at least one row whose
   `verifier` is not the implementing role, or the `--verifier` value should not be free text.

3. **`src/ledger.ts:50-61` — the ledger's floors are one character and no SHA validation.**
   `evidence.trim() !== ""` and `sha.trim() !== ""` are the entire contract.
   `mstack ledger record <slug> 0000000000000000000000000000000000000000 live-verified --evidence x`
   exits 0 and clears `require_verdict_to_close`. The SHA is never checked against
   `git cat-file -e`, and `checkClosedItems` matches on target only, so a row at a SHA that does not
   exist in the repository is indistinguishable from a real one. README.md:144 sells rows as "typed
   verdicts keyed by `(target, sha)`"; the key half is unvalidated. **Fix:** reject a `sha` that is
   not a commit in this repository, and put a real floor on `evidence`.

4. **`src/cli.ts:203-227` — `mstack state add` writes a `state.json` its own parser rejects, exit 0.**
   `slug: values.slug` is never tested against the `SLUG` regex at `src/state.ts:49`; `saveState`
   writes it; the next `parseState` throws. One command bricks the store: `state list` and
   `state active` exit 2, the gate exits 1, the status line degrades to `state.json unreadable`, and
   `state set` cannot fix it because it parses before it writes. Recovery requires hand-editing JSON.
   README.md:149-161 makes the shape check the plugin's centrepiece — it guards the read path only,
   and the writer walks straight past it. **Fix:** validate on the way in. `parseItem`'s checks
   already exist; call them from `state add`.

5. **`src/cli.ts:268-273` — `--force` walks an item with an unanswered fork all the way to `done`,
   and nothing records that it happened.** CHANGELOG.md:24 says `mstack decide --resolves` "is the
   only way to answer one". The fix string tells you to "say why in decisions.tsv"; I ran the four
   forced transitions and `decisions.tsv` had zero rows. Panel finding 12 named this and it is
   unfixed. **Fix:** have `--force` append its own decisions row, or refuse without `--why`.

6. **`src/setup.ts:90` — `mstack setup --force` silently destroys the work queue.** `history.md` is
   protected by a literal `false` at `src/setup.ts:92`, so the author thought about which files must
   not be clobbered and left `state.json` out. Three items became zero, `rc=0`,
   `PASSED - 0 failures, 0 warnings`. The ledger survives, leaving verdicts pointing at items that no
   longer exist — the dangling-pointer shape `src/gate.ts:242` calls "worse than no pointer". Also,
   `skills/setup/SKILL.md:16-17` says `--force` overwrites "an existing file", which is false of
   `history.md`. **Fix:** refuse when `.items` is non-empty unless a second flag is passed, or back
   the file up first.

7. **`src/worktree.ts:66-77` and `:117-121` — `prune` deletes gitignored files and the worktree you
   are standing in.** `isDirty` runs `git status --porcelain`, which by definition excludes
   everything in `.gitignore`. A worktree holding a `.env` and a `build/` reports clean, is listed
   without a `dirty` tag, and `--yes` removes it — `git worktree remove` does not protect ignored
   files either. The list the user is told to read (`src/cli.ts:421`) does not contain the
   information needed to decide. Separately, `prunable` does not exclude the worktree containing
   `process.cwd()`, so running prune inside a merged worktree deletes it out from under the session,
   rc=0. Also `isDirty`'s `catch { return false }` reads any git error as "clean". **Fix:**
   `--ignored` in the status call, surface it in the list, and skip the cwd's own worktree.

8. **`src/mergegate.ts:25-32` and `:145-155` — a `StatusContext` in `ERROR` or `EXPECTED` returns GO
   and is not even mentioned in the output.** `FAILING_CONCLUSIONS` covers `CheckConclusionState`
   exhaustively and `PENDING_STATUSES` covers `CheckStatusState` exhaustively, but `StatusState` has
   five values and only `FAILURE` and `PENDING` are handled. `ERROR` ("Status is errored") falls into
   no bucket: not failing, not pending, not skipped, so it is dropped from `reasons` entirely.
   `EXPECTED` ("Status is expected" — declared and never reported) is the case
   `src/mergegate.ts:24`'s "a job that never started is not a failure" comment is reasoning about,
   and it silently reads as a pass. In practice `mergeStateStatus: UNSTABLE` usually masks `ERROR`,
   but the mask is a field the code does not validate — see finding 9. **Fix:** classify by an
   explicit switch over both enums and treat an unrecognised value as STOP, which is what listing
   `UNKNOWN` in `BLOCKING_MERGE_STATE` shows was the intent.

9. **`src/mergegate.ts:78` — `JSON.parse(raw) as PullRequest` with no shape check.** In the file
   whose header comment is "green is not safe", and in the plugin whose README makes a shape check
   its load-bearing example. `BLOCKING_MERGE_STATE.has(undefined)` is `false`, so a payload missing
   `mergeStateStatus` skips the merge-state test entirely and returns GO. `pr.state !== "OPEN"`
   happens to catch a fully empty object; a partial one is not caught. The comparison is also
   case-sensitive while `normalizeConclusion` uppercases, so `"blocked"` returns GO. `fetchPr` also
   has no `timeout`, unlike `git()` at `src/gate.ts:364-378` which got one for exactly this reason.
   **Fix:** validate the parsed object the way `parseState` validates `state.json`, and treat a
   missing `mergeStateStatus` as STOP.

10. **`src/cli.ts:316`, `:465` and `src/mergegate.ts:129` — the default `--min` is `test-verified`,
    which fails the verdict the prose calls honest.** `skills/verify/SKILL.md:18` and
    `agents/implementer.md:46` both say "`type-check-only` is the correct answer when that is all you
    ran"; `src/ledger.ts:29-31` ranks it below `test-verified`. So `mstack ledger check <slug>`, which
    `agents/reviewer.md:30`, `skills/review/SKILL.md:34` and
    `skills/router/playbooks/resume.md:13` all tell you to run bare, prints
    `FAIL ... does not clear test-verified` and exits 1, and `merge-gate` returns STOP. **`--min` is
    named in zero files under `skills/` or `agents/`.** Following the instructions produces a red
    check, which teaches the reader to stop being honest about the rung. **Fix:** name `--min` in the
    prose, or make the default the item's own recorded expectation.

11. **`src/gate.ts:157-158` — two of the three `rules.*` flags produce no output at all when off.**
    `one_active_item: false` emits a warning naming the fact, which is the panel's fix. The other two
    are bare `if (...)` with no `else`, so with `require_verdict_to_close: false` an item marked
    `done` against an empty ledger produces zero lines and `PASSED`. A reader cannot tell "checked
    and green" from "not checked". That is the exact defect the panel forced fixed at
    `src/gate.ts:137-143`, applied to one of three. **Fix:** the same `report.warn` in both places.

12. **`src/cli.ts:238-262` — `one_active_item` is not enforced at write time.** Two consecutive
    `mstack state set <ref> --status in_progress` both exit 0. `decision_required` *is* refused here,
    with a comment at `src/cli.ts:246-247` explaining why ("the cheapest place to say so, before
    anything is built on the answer"); the same reasoning is not applied to the other rule. The gate
    catches it afterwards, but the gate only reaches the model as `Stop` feedback. Five agent files
    (`agents/implementer.md:59`, `orchestrator.md:56`, `reviewer.md:71`, `spec-author.md:58`,
    `spec-reviewer.md:49`) all say "the gate enforces it". **Fix:** refuse the transition, as the
    fork check already does.

13. **`src/state.ts:96-107` and `:110-153` with `:163-165` — the write path silently normalises away
    everything the parser does not model.** `rules["one_active_item"] !== false` means any non-boolean
    reads as enabled — a safe direction, but silent: `"one_active_item": "false"` (a plausible `jq`
    or template typo) is read as `true` *and rewritten to `true`* by the next mutating command, so
    the evidence of the user's intent is destroyed with no warning. The same pass drops unknown keys
    under `rules`, drops unknown fields on every item, and rewrites `"project": 42` to `"unnamed"`.
    **Fix:** warn on a non-boolean rule, and preserve unrecognised keys on the round trip.

14. **README.md:103 — "Returns feedback rather than a block, so it never burns the eight-block
    budget" is false, and the code's own comment says so.** hooks.md:2475: `additionalContext` "keeps
    the conversation going through the same loop protections as `decision: \"block\"`, namely the
    `stop_hook_active` input and the 8-consecutive-continuation cap". `src/hooks.ts:161-165` states
    this correctly ("Both keep the conversation going through the same loop protection, but this one
    is labelled as feedback instead of raising a hook error"). Only the README claims the budget
    benefit. **Fix:** delete the clause; the real benefits — the label and no hook-error
    notification — are already stated in the code.

15. **`src/tsv.ts:21-24` — the formula guard is defeated by a leading zero-width character.**
    `.trim()` strips JS whitespace only, so `U+200B`, `U+200E`, `U+2060`, `U+0000` and `U+0001` all
    carry a `=` past `FORMULA_LEADERS`. The doc comment's own threat model is "PR titles, branch
    names, filenames, generated output" — a PR title with a leading zero-width space is set by
    anyone who can open a PR, and I wrote one through `mstack ledger record --evidence` into
    `ledger.tsv` unguarded. `tests/tsv.test.ts:6-13` asserts "None of it may execute" while
    exercising four bare leaders. Whether a given importer then evaluates it depends on the importer;
    the guard nonetheless does not guard. **Fix:** strip or reject non-printing leading characters
    before the leader test, and add the invisible-leader cases to the test.

16. **`src/hooks.ts:225-228` — `git branch -d --force` is allowed, and the comment directly above the
    regex says it is covered.** The comment reads "Long and short spellings, and the `-d --force`
    pair that means the same thing as `-D`"; the alternation is `--delete\s+--force|--force\s+--delete`
    and has no `-d` form. This is a claim-versus-code defect inside the fix the panel already forced.
    Alongside it: `rm --recursive --force .mstack` is allowed (`src/hooks.ts:237` anchors on
    `rm\s+-[a-zA-Z]*[rR]`, so every GNU long-option spelling escapes), and `git clean -fdx`,
    `git push --delete`, `git push origin :main` and `git branch -M` are all allowed while each
    guard's own `why` string describes exactly what they do. **Fix:** add `-d\s+--force` and a
    long-option branch to the `rm` guard.

17. **`src/hooks.ts:243` and `hooks/hooks.json:61` — the guards only ever see `Bash`.**
    `PowerShell` is a documented standard tool that "Executes PowerShell commands natively"
    (tools-reference.md:41). Both the matcher and the early return name `Bash` literally, so on any
    machine where the PowerShell tool is enabled none of the seven guards apply, and README.md:104's
    claim is platform-conditional without saying so. **Fix:** `"Bash|PowerShell"` in both places.

18. **`src/fanout.ts:26-30` and `:60` — the stated consequence of exceeding the cap is the opposite
    of the documented one.** Both the comment and the user-facing error say "the excess queues
    silently and reads as a dropout". sub-agents.md: "when 20 subagents are running in a session,
    spawning another with the Agent tool **fails** with `Concurrent subagent limit reached`, and the
    error tells Claude not to retry". There is no queue. The cap is also configurable via
    `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, while `CONCURRENCY_CAP` is hardcoded, so mstack refuses
    at 21 on a machine configured for more. And the check counts one `plan` call, not a session, so
    two calls of 15 both pass — while `skills/router/SKILL.md:76` and
    `skills/orchestrate/SKILL.md:48` both say "per session". **Fix:** correct the sentence, read the
    env var, and stop claiming a session-wide count the code does not keep.

19. **`skills/router/playbooks/investigate.md:10`, `skills/understand/SKILL.md:30` and
    `skills/design/SKILL.md:26` — three fan-out paths the tooling does not cover.**
    `mstack fanout plan --kind explore` exits 2 (`'explore' is not a report kind`), and there is no
    `--kind design`, though `src/fanout.ts:16` names `design` as half the reason the module exists.
    Those workers are also invisible to `SubagentStop` (`src/hooks.ts:129` returns null for an
    unmapped role), so the silent-overwrite failure the module was built to prevent is unguarded on
    exactly the paths its own comment cites. Separately, `skills/review/SKILL.md:27` quotes
    `mstack fanout check` without `--kind`, which exits 2, and `:26` tells you to skip a lens that
    `src/fanout.ts` will then report as a missing report. **Fix:** add the kinds, or stop telling
    people to fan out where the tooling cannot follow.

20. **`skills/router/playbooks/cleanup.md:16` and `skills/ship/SKILL.md:31` still lead with
    `--closed-by` at the close step and never mention `mstack ledger record`.** CHANGELOG.md:40 says
    `--closed-by "I checked it myself"` was the shipped defect and that "the shipped example taught
    the shortcut". The examples that taught it are still shipped, and `cleanup.md` applies them to
    items whose "work landed long ago", i.e. at a SHA that is not HEAD. **Fix:** rewrite both steps
    around the ledger.

21. **`src/lint.ts:386` — FIXED IN `29d5aa2` DURING THIS REVIEW.** `.mstack/` was not in
    `SKIP_DIRS`, so the durable store and every review report were linted as plugin prose, and
    `./bin/mstack lint-plugin .` was red because another reviewer's report named the lifecycle —
    with `.github/workflows/ci.yml:30` running exactly that command. It is now
    `SKIP_DIRS = {".git", ".mstack", "node_modules", "dist", "docs", "examples"}` at
    `src/lint.ts:393` and the linter passes. Recorded because it shaped how I wrote this file.

22. **`agents/orchestrator.md:4` — `tools: Read, Glob, Grep, Bash, Agent`.** README.md:111-114 states
    the honest strength of the no-`Write` claim: "Editing a file still takes a visible shell command
    that a human reads in the transcript, rather than an edit that looks like ordinary work." The
    orchestrator can spawn `mstack:implementer`, which carries `Write` and `Edit`, and nesting is on
    by default to three layers (sub-agents.md). That route produces precisely an edit that looks like
    ordinary work. The README's concession covers `Bash` and is silent on `Agent`. Separately,
    nothing tests or lints the tool lists: `src/lint.ts:49` accepts `tools` as a permitted key and
    never inspects its value, so the plugin's headline safety claim is enforced by prose, in a plugin
    whose thesis is that prose does not enforce. **Fix:** assert the three tool lists in
    `tests/`, and say what `Agent` means in the honesty paragraph.

23. **`src/setup.ts:113` — `resetCurrent` is dead code, and two skills instruct agents to perform the
    operation it would have provided.** `rg resetCurrent src/ tests/ bin/` returns one hit: the
    definition. `skills/router/SKILL.md:139-140` and `skills/ship/SKILL.md:32` both say to reset
    `current.md` to its empty template, so agents must reproduce a 33-line template by hand — and
    three of the five agents have no `Write` tool, so the only route is a `Bash` heredoc. **Fix:**
    wire it to a subcommand, or delete it and stop asking.

24. **`skills/router/SKILL.md:67-68`, `skills/router/playbooks/orchestrate.md:24-32` and
    `skills/orchestrate/SKILL.md:32-33` give a subagent brief 7, 8 and 9 fields respectively**, and
    all three say a missing field is a reason not to launch. `standing constraints`, named only by
    the nine-field version, appears in no template in the repo. Related contradictions: who marks an
    item `done` has three different owners across `agents/implementer.md:51`,
    `agents/orchestrator.md:33` and `skills/ship/SKILL.md:31`, and the reviewer — the role
    `implementer.md:51` says decides it — is never told it has the job. And
    `skills/router/SKILL.md:24-25` grants every playbook step a `skip: <reason>` escape that
    `skills/router/playbooks/feature.md:15-17` then has to explicitly revoke, which is the
    escape-hatch-on-the-next-line shape README.md:19-20 criticises pstack for, inverted.

25. **`src/state.ts:167-170` — `findItem` resolves a slug to the wrong item.**
    `Number.parseInt("2fa-login", 10)` is `2`, and the `.find` predicate is
    `i.slug === ref || i.id === byId`, so whichever matches first in array order wins.
    `2fa-login`, `3d-viewer` and `2x-speedup` are all valid under the project's own `SLUG` regex.
    `mstack state set 2fa-login --status in_progress` moved item 2 `bravo` and exited 0; and
    `mstack decide --resolves 2fa` attached the reasoning to `beta`'s fork and left `2fa`'s open.
    **Fix:** try slug first and only fall back to the numeric form when `ref` is entirely digits.

26. **Smaller, all still open from the previous panel or newly noted.**
    `src/lint.ts:194` and `:224` still use `if (!report.failed)`, which tests the whole report rather
    than this file — panel finding 9, unfixed, while the correct before/after pattern sits 130 lines
    below at `src/lint.ts:356-360`. `CHANGELOG.md:7` still says "ten playbooks"; there are 7 files in
    `skills/router/playbooks/` — panel finding 17, unfixed. README.md:133 says `bin/mstack` "is on
    `PATH` whenever the plugin is enabled" while plugins.md:183 scopes that to the Bash tool's PATH,
    which README.md:169 states correctly — the two halves of the same document disagree.
    `hooks/hooks.json` puts `description` on each individual handler, which is documented only at the
    file's top level. `claude plugin validate . --strict` in this repository validates
    `.claude-plugin/marketplace.json` and not the plugin, so the README development step proves less
    than it appears to. `skills/unslop/SKILL.md:41` bans em dashes and the corpus contains 22 of them
    under `skills/`. `mstack:orchestrator` is referenced by no skill or agent, and
    `src/lint.ts:263-306` catches dangling references but not orphaned agents. All five agents pin
    `model: inherit`, so `skills/review/SKILL.md:20-21` and `skills/design/SKILL.md:32` ask for a
    different model with no mechanism to get one.

## Working tree

```
$ git status --porcelain
 M README.md
 M src/cli.ts
 M src/decisions.ts
 M src/gate.ts
 M src/lint.ts
 M src/tsv.ts
 M tests/decisions.test.ts
 M tests/gate.test.ts
?? .mstack/progress/review_decision-required-gate_adversarial.md
```

The only untracked path is this report. Everything else that was dirty during the review was
someone else's in-flight work, already present before I ran anything, and has since been committed
as `6637e56`, `29d5aa2` and `01c1725`. The four `.mstack/` files my script contaminated were
restored to `HEAD` and verified clean. I modified no source file, left no background process, and
removed every scratch directory I created.
