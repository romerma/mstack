# Review - the session's work (thesis)

**Verdict:** CHANGES_REQUESTED

The thesis is "judgment lives in skills, enforcement lives in hooks and in a gate that is
code." Two of the five hooks emit a field Claude Code documents as ignored, so the gate that
runs on `Stop` and the report contract on `SubagentStop` deliver nothing to the model. The
gate's `require_verdict_to_close` is satisfied by a free-text string the same actor writes.
Both defects are covered by green tests, because the tests assert what the functions return
rather than what the runtime consumes. That is the pstack failure mode with a test suite
bolted on: prose promising enforcement, and nothing behind it.

The engineering is good and the intent is real. Findings 1, 2 and 3 are what stand between
this and the claim it makes.

## Claims I checked against code

| Claim | Where it is made | Enforced by | Holds? |
|---|---|---|---|
| `Stop` "runs the fast gate", returns feedback | README.md:83 | `src/hooks.ts:164` emits `hookSpecificOutput.additionalContext` | **No.** Docs: for `Stop`, "`additionalContext` is ignored" |
| `SubagentStop` "confirms the subagent left its report" | README.md:82, agents/orchestrator.md:43 | `src/hooks.ts:126`, same field | **No.** Same doc sentence covers `SubagentStop` |
| `PostToolUse` nudges, never blocks | README.md:81 | `src/hooks.ts:104`, `additionalContext` | Yes. Documented for `PostToolUse` |
| `PreToolUse` deny holds under `bypassPermissions` | README.md:84 | `src/hooks.ts:214` | Deny form and ordering: yes. Coverage: see finding 6 |
| `SessionStart` restores state, incl. `--resume` | README.md:80 | `src/hooks.ts:65` | Fires on resume: yes. Output shape: undocumented, see finding 13 |
| "no pass can approve its own work" | CHANGELOG.md:9 | nothing | **No.** Finding 2 |
| ledger verdict required to close | state.json `require_verdict_to_close`, skills/router/SKILL.md:143 | `src/gate.ts:194` | **No.** Any non-empty `closed_by` clears it |
| merge gate = "code, not prose", green is not safe | README.md:59, skills/ship/SKILL.md:5 | `src/cli.ts:376` | **Partly.** Ledger check silently skipped with no active item |
| Roles "structurally cannot approve themselves ... the tool is not there" | README.md:86-89 | agent front matter | **Overstated.** All three ship `Bash`; orchestrator also ships `Agent` |
| spec path triggers on `sdd`, `decision_required`, cross-cutting | README.md:48, skills/router/SKILL.md:60 | `src/gate.ts:160` | **Partly.** Only `sdd` is checked |
| gate "refuses ... without all four artifacts on disk" | skills/spec/SKILL.md:71 | `src/gate.ts:171` | Existence only. Four 0-byte files pass |
| "the CLI refuses illegal transitions, which is how no self-approval survives" | agents/orchestrator.md:38 | `src/cli.ts:213` | Refuses, but `--force` skips it and nothing records that |
| every `mstack:<name>` cross-reference resolves | `src/lint.ts:257` docstring | `src/lint.ts:126` | **No.** Playbooks are not scanned. Finding 8 |
| lifecycle enum lives in exactly one file | src/lifecycle.ts:3 | `src/lint.ts:302` | Yes. Verified |
| shape check catches `{"items": {}}` | README.md:128 | `src/state.ts:80` | Yes. Verified, exit 1 |
| 116 tests under both runners | CHANGELOG.md:23 | `npm test` | Count right; suite not deterministic under bun. Finding 12 |
| router over "ten playbooks" | CHANGELOG.md:7 | `skills/router/playbooks/` | **No.** Seven files |
| 20 concurrent subagents is a Claude Code limit | src/fanout.ts:26, skills/orchestrate/SKILL.md:48 | enforced as a hard refusal | Not found in the docs. Finding 14 |
| `args`, `statusMessage`, `description`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `bin/` on PATH, 10,000-char cap | hooks/hooks.json, README.md | Claude Code | All confirmed true |

## Verification I ran

```
$ npm test          # first run of the session
  115 pass / 1 fail   REAL_EXIT captured on the next run: 1, 113 pass / 3 fail
$ node --test 'tests/*.test.ts'
  tests 116  pass 116  fail 0      (green on every one of ~20 runs)
$ bun test tests/    # 30+ subsequent runs, all green; flake did not reproduce on demand
```

```
$ ./bin/mstack help                      -> exit 0
$ ./bin/mstack gate                      -> PASSED, 0 failures, 2 warnings, exit 0
$ ./bin/mstack lint-plugin .             -> PASSED, 0 failures, 0 warnings, exit 0
$ claude plugin validate . --strict      -> Validation passed
$ claude plugin validate skills --strict -> Validation passed
$ claude plugin validate agents --strict -> Validation passed
```

The example repository's three documented failure modes all behave as advertised:

```
$ echo '{"items": {}}' > .mstack/state.json && mstack gate
[fail]  .../.mstack/state.json parses but has the wrong shape: .items must be an array, got an object
        fix: this is the shape that silently disables every check below it
FAILED - 1 failure, 1 warning                                            exit=1

$ mstack state set 2 --status in_progress && mstack state set 3 --status specifying && mstack gate
[fail]  2 items are active in this worktree: cli-search (in_progress), export-json (specifying)
FAILED - 1 failure, 1 warning                                            exit=1

$ mstack ledger check cli-search 0000000000000000000000000000000000000000
FAIL no verdict at 00000000; 1 row(s) exist at other SHAs and a new head SHA voids them   exit=1
```

Self-approval, in a fresh repo, as one actor, `require_verdict_to_close: true`:

```
$ mstack state set demo --status in_progress
$ mstack state set demo --status reviewing
$ mstack state set demo --status verifying
$ mstack state set demo --status done --closed-by "I checked it myself"
$ mstack gate
[ok]    1 closed item(s) carry proof
PASSED - 0 failures, 1 warning                                           exit=0
```

Guard evasion, via `mstack hook pre-tool-use` on stdin:

```
DENIED   : git push --force origin main
ALLOWED  : git -c user.name=x push --force origin main
ALLOWED  : git push origin +HEAD:main
ALLOWED  : git push \n  --force origin main
DENIED   : git branch -D feature
ALLOWED  : git branch --delete --force feature
DENIED   : rm -rf .mstack
ALLOWED  : rm -rf .mstac*
```

Three active items with `rules.one_active_item: false`:

```
$ mstack gate      -> [ok] no active item          PASSED, exit 0
$ mstack statusline -> feat/x · 3 active items
```

Four zero-byte spec artifacts, and `current.md` containing the single character `x`:

```
[ok]    progress/current.md tracks the active item
[ok]    spec for spec-item is complete
PASSED - 0 failures
```

`decision_required` without `sdd`, `in_progress`, no `.mstack/specs/` at all:

```
[ok]    no sdd item is past specifying
PASSED - 0 failures
```

Lint, with `mstack:renamed-implementer` planted in `skills/router/playbooks/bug-fix.md`:

```
-- cross-references
[ok]    17 skills and agents, every cross-reference resolves
```

Lint, with one unrelated manifest failure present:

```
-- manifest
[fail]  skills/ is inside .claude-plugin/
-- skills
                      <- 12 skills validated, nothing printed
-- agents
                      <- 5 agents validated, nothing printed
```

`merge-gate` with no active item and no `--target`, calling `evaluate` directly:

```
decision: GO   reasons: []
```

Doc sources: hooks reference decision-control table (`Stop` -> `continue`, `stopReason`;
`SubagentStop` -> `continue`, `stopReason`; `PostToolUse` -> `additionalContext`;
`PreToolUse` -> `permissionDecision`, `permissionDecisionReason`, `additionalContext`), and
the Stop/SubagentStop section: *"Exit code 2 is ignored ... `additionalContext` is ignored."*

## Findings

1. `src/hooks.ts:164` and `src/hooks.ts:126` - `stop()` and `subagentStop()` both return
   `{"hookSpecificOutput":{"hookEventName":"Stop"|"SubagentStop","additionalContext":"..."}}`.
   The hooks reference lists the supported output fields for both events as `continue` and
   `stopReason`, and states plainly: "Exit code 2 is ignored ... `additionalContext` is
   ignored." So the fast gate runs on every Stop, computes its failures, serialises them, and
   the text reaches nobody; the report-contract check does the same. These are the two rows the
   README sells as "enforcement that runs whether the model cooperates or not"
   (README.md:82-83), the mechanism `agents/orchestrator.md:43`, `skills/router/SKILL.md:81`,
   `src/fanout.ts:19` and `src/statusline.ts:216` all name as the backstop. Fix: emit
   `hookSpecificOutput.continue = false` with `stopReason` carrying the gate failures. The
   header comment at `src/hooks.ts:18` ("`exit 1` does not block. Only `exit 2` does") is also
   wrong for these two events, where exit 2 is explicitly ignored.

2. `tests/hooks.test.ts:76` and `tests/hooks.test.ts:104` - the suite locks in the shape from
   finding 1. `contextOf()` at line 11 reads `hookSpecificOutput.additionalContext`, and
   line 107 asserts `decision` is `undefined` with the message "must not use decision:block".
   116 green tests, a green lint and a green `claude plugin validate` all pass over two inert
   hooks, because every test asserts the function's return value and none asserts the contract
   with the runtime. That is the same gap the plugin diagnoses in pstack, one level up. Fix:
   assert the field the event actually honours, and note in the test why.

3. `src/gate.ts:194` - `if (item.closed_by !== undefined && item.closed_by.trim() !== "") return false;`
   short-circuits the ledger lookup, so `require_verdict_to_close` is cleared by any non-empty
   string. Verified above: one actor took an item `pending -> done` with
   `--closed-by "I checked it myself"`, no review report, empty ledger, gate green. This
   contradicts CHANGELOG.md:9 ("no pass can approve its own work"),
   `skills/router/SKILL.md:143` ("only after a reviewer that did not write the code approved,
   and the ledger holds a verdict at the current head SHA"), and the rule's own name. The
   shipped example teaches the bypass: `examples/notes-cli/.mstack/state.json:29` closes item 1
   with a `closed_by` sentence against an empty `ledger.tsv`, and the gate reports "1 closed
   item(s) carry proof". This is structurally the thing the README criticises at line 19: a
   requirement, and the escape hatch two lines later. Fix: require the ledger row, and make
   `closed_by` an annotation rather than an alternative; if a manual override must exist, name
   it that way and have the gate report it as an override rather than as proof.

4. `src/cli.ts:376` - `evaluate(data, target === undefined ? {} : {...})`. With no active item
   and no `--target`, the ledger arm is dropped and `merge-gate` returns `GO` with an empty
   reasons list. Nothing in the output says the ledger was not consulted, while the same
   function takes care to emit notes for skipped checks and for a PR with no checks at all
   (`src/mergegate.ts:143-148`). `skills/ship/SKILL.md:5` makes the ledger the entire
   definition of safe. `skills/orchestrate/SKILL.md:52` states the rule this breaks: "silent
   truncation reads as full coverage." Fix: push a `WAIT` or a loud note when no target can be
   resolved.

5. `src/gate.ts:129-138` - with `rules.one_active_item: false`, three active items fall through
   to `report.ok("no active item")`. The gate prints a false statement and passes; the status
   line, on the same state, correctly prints "3 active items" (`src/statusline.ts:112`). The
   same branch is the only caller of `checkCurrent`, so turning off `one_active_item` also
   silently turns off the `current.md` check that commit 21e6ebf was written to add. Fix: count
   the actives independently of the rule, report the count either way, and hang `checkCurrent`
   off "there is at least one active item" rather than off "there is exactly one".

6. `src/hooks.ts:192-208` - the guards match spellings, not operations. Verified allowed:
   `git -c user.name=x push --force` (any global flag defeats `\bgit\s+push\b`),
   `git push origin +HEAD:main` (the refspec force form), `git push` followed by a newline and
   `--force` (`[^\n]*` cannot cross a line, and multi-line Bash commands are routine),
   `git branch --delete --force` (exactly `-D`, which `skills/router/playbooks/cleanup.md:14`
   calls out by name as the thing the hook denies), and `rm -rf .mstac*`. The ordering claim in
   README.md:84 is true and doc-confirmed; the coverage claim around it is not. Fix: match the
   subcommand and scan the argument vector rather than the raw string, or reword the README to
   "denies the common spellings" and say so in the hook's own message.

7. `README.md:86-89` - "Roles that structurally cannot approve themselves ... The rule is not
   'please do not edit the code you are reviewing'. The tool is not there." `agents/reviewer.md:4`,
   `agents/spec-reviewer.md:4` and `agents/orchestrator.md:4` all ship `Bash`, which creates and
   rewrites files with one redirect; the docs confirm `tools` is an allowlist over tools and
   places no such restriction on Bash. `agents/orchestrator.md:4` also ships `Agent`, so it can
   launch `implementer`, which has `Write` and `Edit`. What is true is narrower and still worth
   saying: no reviewer role has a file-editing tool, so editing requires an out-of-character
   shell command that is visible in the transcript. Fix: word it as a speed bump with an audit
   trail, not as an impossibility, and consider `disallowedTools` if a harder boundary is wanted.

8. `src/lint.ts:126` (with `:108`) - `lintReferences` receives only `skills/**/SKILL.md` and
   `agents/*.md`, so the ten playbooks and ten reference files are never scanned for
   `mstack:<name>`. A planted `mstack:renamed-implementer` in `skills/router/playbooks/bug-fix.md`
   passes with "[ok] 17 skills and agents, every cross-reference resolves". The function's own
   docstring at `src/lint.ts:257` describes exactly this defect in pstack: "a reference to a
   role that was renamed reads exactly like a working one." Commit 891e533 fixed the identical
   scope bug for links by adding `lintReferenceFiles`; the cross-reference half was left behind.
   Fix: pass `collectAll(join(dir, "skills"))` plus the agents into `lintReferences`.

9. `src/lint.ts:194` and `src/lint.ts:224` - `if (!report.failed) report.ok(...)` tests the
   report-global failure flag, not this file's. One unrelated manifest failure blanks the entire
   skills and agents sections: 12 skills and 5 agents are validated and nothing is printed, which
   reads as "no skills found". `lintReferenceFiles` at `src/lint.ts:346` already does this
   correctly with a `report.failures.length` delta, and `tests/helpers.ts:88` names the defect
   class ("a check that returns non-zero while printing nothing is the 'failed silently'
   defect"). Fix: use the delta in both places.

10. `src/gate.ts:171-179` - `checkSpecArtifacts` tests filenames only. Four zero-byte files pass
    as "spec for spec-item is complete", so `skills/spec/SKILL.md:71` ("what stops 'we will write
    the spec after' from becoming the norm") stops nothing but `touch`. Both neighbouring checks
    already know better: `src/hooks.ts:147` and `src/fanout.ts:87` apply a 40-byte floor, and
    CHANGELOG.md:22 advertises precisely this reasoning for `current.md`. Also, `done` is absent
    from `SPEC_REQUIRED_FROM` (`src/lifecycle.ts:36`), so the spec directory may be deleted once
    the item closes. Fix: apply the same floor the rest of the codebase uses.

11. `src/gate.ts:92-113` - `checkCurrent` only greps for two template strings, so
    `printf 'x' > current.md` yields "[ok] progress/current.md tracks the active item". Its own
    failure message says "`<item>` is active but progress/current.md is not", which the check
    cannot actually determine: it never looks for the slug. Fix: require the active slug to
    appear, and require the "Next step" section to be non-empty rather than merely non-template.

12. `src/cli.ts:213` - `--force` skips the transition graph entirely, and nothing records that it
    was used: the fix text asks the operator to "say why in decisions.tsv" and no code checks
    whether they did. `agents/orchestrator.md:38` leans on this graph: "The CLI refuses illegal
    transitions, which is how 'no self-approval' survives a long session." A graph with an
    unlogged `--force` is the escape hatch pattern this plugin was written against. Fix: have
    `--force` append a `decisions.tsv` row itself, or require `--why`.

13. `src/hooks.ts:65` - `sessionStart` also returns `hookSpecificOutput.additionalContext`. Unlike
    finding 1 I could not settle this one: `SessionStart` is absent from the decision-control
    table, and the documented path for it is plain-text stdout ("Claude Code adds plain-text
    stdout as context"). I could not run the empirical probe (no API credit), so treat this as
    unverified rather than broken. Worth ten minutes with `claude --debug` before release, since
    the same fix as finding 1 may apply.

14. `npm test` - the suite is not deterministic. It exited 1 twice at the start of this session
    (3 failures, then 1) and has been green in 30-plus runs since; `node --test` was green every
    time, so the flake is on the bun path. The signature in all five observed failures was
    `render`/`renderSubagents` behaving as though their second argument were absent: colours on
    despite `{ colours: false }`, no truncation despite `columns: 24`. It did not reproduce under
    CPU load, under concurrent test processes, or with `node_modules` removed. CHANGELOG.md:23
    offers the suite as evidence, and evidence that is red one run in fifteen is the "twenty-one
    verdicts went stale with no signal" problem in miniature. Fix: at minimum add a repeat run to
    CI so it surfaces; the failing assertions are `tests/statusline.test.ts:112`, `:127`, `:89`
    and `:257`.

15. `src/gate.ts:246` - `execFileSync("/bin/sh", ["-c", command])` runs `state.verify` and
    `item.verification` straight out of `.mstack/state.json`. `agents/reviewer.md:16` instructs
    the reviewer to run `mstack gate --full` against code it did not write, which is the
    untrusted-input case. The plugin is careful about this elsewhere: `src/tsv.ts:14` neutralises
    spreadsheet formulas because "evidence is often attacker-influenced text", and
    `skills/ship/SKILL.md:16` says never to build a shell command out of review-comment text. The
    inconsistency should at least be a stated, deliberate trade-off in the file.

16. `src/fanout.ts:26-30` - "Claude Code runs at most twenty concurrent subagents per session" is
    asserted in three places (also `skills/orchestrate/SKILL.md:48`, `skills/router/SKILL.md:76`)
    and enforced as a hard `UserError` that refuses the fan-out. I could not find that limit in
    the Claude Code documentation. A number the plugin refuses work over should carry a citation
    like every other claim in `docs/research/pstack-port.md`, or become a soft warning.

17. `CHANGELOG.md:7` - "router over ten playbooks". There are seven files in
    `skills/router/playbooks/`. The router's route table has ten rows, three of which point at
    skills rather than playbooks.

18. `README.md:128-133` - the `$ mstack gate` block is presented as a shell transcript but is not
    the real output: the gate prints the absolute path to `state.json`, not the bare filename.
    Trivial on its own, except that `agents/implementer.md:35` requires "real output pasted. Not a
    summary of the output," and `skills/verify/SKILL.md:9` calls overstating evidence "the single
    failure this workflow exists to catch."

19. `hooks/hooks.json:16` - the `PostToolUse` matcher `Edit|Write` misses `NotebookEdit`, and
    nothing catches a `.mstack/state.json` rewritten through `Bash`. Low impact, since this hook
    only nudges and the Stop gate is the real check, but the header comment at `src/hooks.ts:79`
    says the hook "notices edits to files the harness owns", which is narrower than it reads.

## What holds

Worth recording, because most of it does. The state-shape check is real and catches the defect
it was written for. The lifecycle single-source rule is enforced and passes. The ledger's
`(target, sha)` keying, the stale-verdict signal in the status line, and the fan-out path
allocation are all code doing what the prose says. Every `mstack <subcommand>` invocation in
every skill, agent, playbook and reference resolves to a real command with real flags. All
twenty relative links resolve. `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, the `args`
array form, `statusMessage`, `description`, `bin/` on `PATH`, the `PreToolUse` deny shape, hooks
running ahead of the permission mode, the 10,000-character output cap and `SessionStart` firing
on `--resume` are all confirmed against the documentation. The three "break it on purpose"
exercises in `examples/notes-cli/README.md` behave exactly as written, exit codes included.
