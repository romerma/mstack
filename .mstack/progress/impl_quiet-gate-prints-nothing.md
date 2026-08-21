# Implementation report — 16 `quiet-gate-prints-nothing`

Branch `fix/quiet-gate-prints-nothing`. Code, tests and docs through `86615b0`; this report is
the commit on top of it, and that is the SHA the ledger row is keyed to. Direct path; the
item's four `acceptance` bullets in `.mstack/state.json` are the contract.

## What changed

`mstack gate --quiet` printed nothing at all while `docs/wiki/The-CLI.md` promised it "prints
failures only", and it is the mode `src/hooks.ts:172` wires to the `Stop` hook — so a red gate
at session close had an exit code and no words. The whole fix is `Report#fail` in
`src/report.ts`: under `quiet` it now writes one line per failure, `[fail]  <message> -> <fix>`,
to **stderr**, and nothing else — no `[ok]` lines, no section headers, no warnings, no summary
count, no colour. stderr rather than stdout because `mstack hook stop` writes its
`additionalContext` JSON to stdout and failure text in front of that object would stop it
parsing, which would break the very hook this mode exists for; that is also the choice `state
active` already makes so `SLUG=$(mstack state active)` stays usable. The printed line is the
same string `report.failures` holds, so what a human sees on stderr and what the `Stop` hook
hands the model are the same bytes. A passing gate and a warning-only gate still print zero
bytes on both streams, which is what keeps a hook that fires every turn cheap. `tests/helpers.ts`
gained `captured()` — it intercepts `console.log`/`console.error` *and*
`process.stdout.write`/`process.stderr.write`, because under bun those are not one channel and
a capture that patched only half would have made every "printed exactly this" assertion
unfalsifiable. `tests/cli.test.ts`'s `run()` moved from `execFileSync` to `spawnSync` for the
same class of reason: it discarded stderr whenever the exit code was 0, which is exactly the
`Stop` hook's case.

## Files

| File | What |
|---|---|
| `src/report.ts` | `emit()` helper writing to stderr; `fail()` renders one line under quiet; doc comments on `warn()`, `fail()` and `summary()` recording why each stays silent |
| `src/gate.ts` | doc comment on `GateOptions.quiet` naming the contract |
| `src/cli.ts` | one usage line for `--quiet` |
| `tests/helpers.ts` | new `captured()` and `quiesce()` |
| `tests/gate.test.ts` | `quietGate()` capture wrapper; all existing quiet calls routed through it; 3 new tests |
| `tests/hooks.test.ts` | 1 new test; "Stop is silent when the gate is green" strengthened to assert both streams |
| `tests/cli.test.ts` | `run()` on `spawnSync` with an `input` option; 2 new tests |
| `docs/wiki/The-CLI.md` | the `gate` section rewritten around three real transcripts |
| `docs/wiki/Gates-and-Hooks.md` | `Stop` row updated; new section "What the Stop hook prints on a red gate" |
| `.mstack/decisions.tsv` | 5 rows |
| `.mstack/progress/current.md` | log kept during the pass |

Commits, each building: `40c37cf` the fix, `cc33e27` the tests, `29a7304` a comment
correction, `86615b0` the docs.

## Design decisions

Each recorded with `mstack decide --phase implement` before the code was written (rows at
`2026-08-21T13:2*` in `.mstack/decisions.tsv`).

| Question | Answer | Why, in one line |
|---|---|---|
| stdout or stderr | **stderr** | stdout carries the `Stop` hook's JSON; text in front of it makes the hook's structured output unparseable |
| does the `fix:` hint survive | **yes, on the same line** | `src/report.ts`'s own first rule is that a failure names the next action, and it makes the stderr line and the model-facing bullet the same bytes |
| does the summary count survive | **no** | criterion 1 says failures and nothing else; a count is not a failure, the exit code carries pass/fail, and a script can count lines |
| do warnings print | **no, silent** | this repo's two commonest warnings are "uncommitted changes" and "on main", both normal mid-session; a hook repeating them every turn is a hook someone switches off |
| colour | **none in quiet** | the readers are a hook transcript and `OUT=$(mstack gate --quiet 2>&1)`; escape codes are noise there, and deterministic bytes are what let the tests assert concrete text |

One correction made mid-pass and committed separately (`29a7304`): the comment justifying
`process.stderr.write` claimed it was "the only spelling a test can intercept in both
runtimes". False — patching `console.error` works in both too. The true, narrower fact is that
the two are not the same channel under bun, which is what `tests/helpers.ts` is built on.

## Commands

### The defect, before the fix (rung 5)

Scratch store, two real failures, `.mstack` at plugin HEAD:

```console
$ mstack gate
-- state
[ok]    one active item: export-json (spec_ready)
[fail]  1 export-json (spec_ready) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template
        fix: if this session dies now, nothing tells the next one where to start
[ok]    no item carries a decision fork
[fail]  sdd item export-json is spec_ready but has no spec at /private/tmp/.../.mstack/specs/export-json
        fix: run '/mstack:spec' or move the item back to specifying
[ok]    no closed items to audit

-- workspace
[ok]    on branch feat/x
[warn]  2 uncommitted change(s); expected mid-session, not at close

FAILED - 2 failures, 1 warning
exit=1

$ mstack gate --quiet
stdout+stderr: []
exit=1
```

Same store, `bin/mstack hook stop` driven as a real process with real JSON on stdin, streams
split:

```console
=== BEFORE FIX: bin/mstack hook stop, streams split ===
exit=0
stdout: [{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- 1 export-json (spec_ready) is active but progress/current.md is not: ... -> if this session dies now, nothing tells the next one where to start\n- sdd item export-json is spec_ready but has no spec at ... -> run '/mstack:spec' or move the item back to specifying"}}]
stderr: []
```

That is the shape the fix had to preserve: stdout is one JSON object and must stay one.

### After the fix (rung 5), same scratch store

```console
=== AFTER: gate --quiet, streams split ===
exit=1
stdout: []
stderr:
[fail]  1 export-json (spec_ready) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start
[fail]  sdd item export-json is spec_ready but has no spec at /private/tmp/claude-501/-Users-romerma-Code-mstack/cefb854d-5ff7-43b0-95ba-d79a53d0c4d7/scratchpad/repro/.mstack/specs/export-json -> run '/mstack:spec' or move the item back to specifying
=== AFTER: hook stop, streams split ===
exit=0
stdout:
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- 1 export-json (spec_ready) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start\n- sdd item export-json is spec_ready but has no spec at /private/tmp/claude-501/-Users-romerma-Code-mstack/cefb854d-5ff7-43b0-95ba-d79a53d0c4d7/scratchpad/repro/.mstack/specs/export-json -> run '/mstack:spec' or move the item back to specifying"}}
stderr:
[fail]  1 export-json (spec_ready) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start
[fail]  sdd item export-json is spec_ready but has no spec at /private/tmp/claude-501/-Users-romerma-Code-mstack/cefb854d-5ff7-43b0-95ba-d79a53d0c4d7/scratchpad/repro/.mstack/specs/export-json -> run '/mstack:spec' or move the item back to specifying
=== stdout still parses as JSON ===
parsed ok, event = Stop
```

Warning-only case, same binary, a store on the default branch with a dirty tree:

```console
=== warning-only store: normal mode ===
-- workspace
[warn]  on main; feature work belongs on its own branch
[warn]  9 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 2 warnings
exit=0
=== warning-only store: --quiet, streams split ===
exit=0
stdout: []  (0 bytes)
stderr: []  (0 bytes)
```

### Criterion 3 — the Stop hook's output on a red gate, from a real run

Walkthrough store (`greet-flag`, branch `feat/greet-flag`), both streams to the same terminal,
run twice to check the ordering is stable. This is the transcript now pasted into
`docs/wiki/Gates-and-Hooks.md`:

```console
===== run 1, both streams to the same place =====
[fail]  1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- 1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start"}}(exit 0)
===== run 2, identical, to check the ordering is stable =====
[fail]  1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- 1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start"}}(exit 0)
```

### The new tests go red against the shipped pre-change file

`main:src/report.ts` swapped in, the suite run, then **restored from a byte copy taken before
the swap** and the sha256 compared:

```console
swapping in main:src/report.ts (the pre-change file)
=== bun test, new tests only ===
(fail) quiet prints every failure with its fix, on stderr, and nothing else [99.41ms]
(fail) Stop puts the gate's failures on stderr while its JSON stays clean [96.02ms]
(fail) gate --quiet prints its failures on stderr and leaves stdout empty [132.44ms]
(fail) hook stop keeps its JSON on stdout and the gate's failures on stderr [150.03ms]
 70 pass
 4 fail
=== restoring from byte copy ===
restored sha256 696ff6e2fdf432cf32b1a43af484b422bb02257e7a5fbe45c24f59d1dc79d0a3
expected sha256 696ff6e2fdf432cf32b1a43af484b422bb02257e7a5fbe45c24f59d1dc79d0a3
RESTORE OK
```

The red is the defect itself, not an incidental mismatch — `actual: []`:

```console
AssertionError: quiet is exactly one line per failure: the fix stays, the [ok] lines, section headers, warnings and summary do not
+ actual - expected

+ []
- [
-   '[fail]  1 storage-layer (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start',
-   "[fail]  sdd item storage-layer is in_progress but has no spec at /var/folders/.../mstack-test-ix44bv/.mstack/specs/storage-layer -> run '/mstack:spec' or move the item back to specifying"
- ]
      at /Users/romerma/Code/mstack/tests/gate.test.ts:308:12
(fail) quiet prints every failure with its fix, on stderr, and nothing else [109.09ms]

 30 pass
 1 fail
```

**Two of the six new tests stay green against the pre-change file, and that is expected rather
than a gap.** Criterion 2 (a passing gate prints nothing) and the warning-only half of
criterion 4 are *preservation* requirements: the old code printed nothing in every case, so no
test for them can go red against it. Their bite is shown by mutation instead — M4, M5 and M6
below each kill them.

### Mutation runs

Driver at `scratchpad/mutate.mjs`. It takes a byte copy of `src/report.ts` first, restores
from that copy after every mutation, and verifies the sha256 each time; the fix was committed
before the driver ran. Full output:

```console
byte copy at /private/tmp/claude-501/-Users-romerma-Code-mstack/cefb854d-5ff7-43b0-95ba-d79a53d0c4d7/scratchpad/report.ts.byte-copy
sha256 pristine 696ff6e2fdf432cf32b1a43af484b422bb02257e7a5fbe45c24f59d1dc79d0a3

killed   M1 the original defect: quiet prints nothing at all
         by: quiet prints every failure with its fix, on stderr, and nothing else
         by: Stop puts the gate's failures on stderr while its JSON stays clean
         by: gate --quiet prints its failures on stderr and leaves stdout empty
         by: hook stop keeps its JSON on stdout and the gate's failures on stderr
         restore: ok
killed   M2 quiet prints its failures to stdout instead of stderr
         by: quiet prints every failure with its fix, on stderr, and nothing else
         by: Stop puts the gate's failures on stderr while its JSON stays clean
         by: gate --quiet prints its failures on stderr and leaves stdout empty
         by: hook stop keeps its JSON on stdout and the gate's failures on stderr
         restore: ok
killed   M3 quiet drops the fix and prints the message alone
         by: quiet prints every failure with its fix, on stderr, and nothing else
         by: Stop puts the gate's failures on stderr while its JSON stays clean
         by: gate --quiet prints its failures on stderr and leaves stdout empty
         by: hook stop keeps its JSON on stdout and the gate's failures on stderr
         restore: ok
killed   M4 quiet also prints warnings
         by: quiet prints every failure with its fix, on stderr, and nothing else
         by: warnings alone print nothing in quiet mode, and do not turn the gate red
         by: Stop puts the gate's failures on stderr while its JSON stays clean
         by: Stop is silent when the gate is green
         by: gate --quiet prints its failures on stderr and leaves stdout empty
         by: hook stop keeps its JSON on stdout and the gate's failures on stderr
         restore: ok
killed   M5 quiet keeps the FAILED/PASSED summary line
         by: quiet prints every failure with its fix, on stderr, and nothing else
         by: a green gate in quiet mode prints exactly nothing, on either stream
         by: warnings alone print nothing in quiet mode, and do not turn the gate red
         by: Stop puts the gate's failures on stderr while its JSON stays clean
         by: Stop is silent when the gate is green
         by: gate --quiet prints its failures on stderr and leaves stdout empty
         by: hook stop keeps its JSON on stdout and the gate's failures on stderr
         restore: ok
killed   M6 quiet also prints the [ok] lines
         by: quiet prints every failure with its fix, on stderr, and nothing else
         by: a green gate in quiet mode prints exactly nothing, on either stream
         by: warnings alone print nothing in quiet mode, and do not turn the gate red
         by: Stop puts the gate's failures on stderr while its JSON stays clean
         by: Stop is silent when the gate is green
         by: gate --quiet prints its failures on stderr and leaves stdout empty
         by: hook stop keeps its JSON on stdout and the gate's failures on stderr
         restore: ok
killed   M7 quiet prints the failures without the [fail] marker
         by: quiet prints every failure with its fix, on stderr, and nothing else
         by: Stop puts the gate's failures on stderr while its JSON stays clean
         by: gate --quiet prints its failures on stderr and leaves stdout empty
         by: hook stop keeps its JSON on stdout and the gate's failures on stderr
         restore: ok
killed   M8 quiet paints the line red when stderr is not a TTY either
         by: quiet prints every failure with its fix, on stderr, and nothing else
         by: Stop puts the gate's failures on stderr while its JSON stays clean
         by: gate --quiet prints its failures on stderr and leaves stdout empty
         by: hook stop keeps its JSON on stdout and the gate's failures on stderr
         restore: ok

8/8 killed, 0 survivor(s)
final sha256 696ff6e2fdf432cf32b1a43af484b422bb02257e7a5fbe45c24f59d1dc79d0a3
pristine     696ff6e2fdf432cf32b1a43af484b422bb02257e7a5fbe45c24f59d1dc79d0a3
```

One mutation deliberately not run, and named rather than quietly skipped: swapping
`process.stderr.write` for `console.error` inside `emit()`. It would survive, correctly — both
reach fd 2, and `tests/helpers.ts` patches both spellings. It is a style choice with a bun
caveat, not a behaviour, and the comment in `src/report.ts` now says only that.

### The project's own verification (rung 4)

```console
$ npm test

> mstack@0.1.0 test
> bun test tests/ && node --test 'tests/*.test.ts'

bun test v1.3.11 (af24e281)
 202 pass
 0 fail
Ran 202 tests across 13 files. [15.25s]

ℹ tests 202
ℹ suites 0
ℹ pass 202
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5334.923042
```

```console
$ npm run typecheck

> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit

```

```console
$ ./bin/mstack lint-plugin .

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
```

```console
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
56 relative links checked, 0 broken
```

## Acceptance to test

| # | Acceptance bullet | Test | `file:line` |
|---|---|---|---|
| 1 | `gate --quiet` on a failing gate prints the failures, and nothing else | "quiet prints every failure with its fix, on stderr, and nothing else" — `deepEqual` on the exact two lines, so the `[fail]` prefix, the ` -> fix`, the absence of `[ok]`/section/warning/summary lines and the count are all pinned at once; plus `out === ""` | `tests/gate.test.ts:297` |
| 1 | same, through the shipped binary with real file descriptors | "gate --quiet prints its failures on stderr and leaves stdout empty" — asserts `stderr` byte for byte, `stdout === ""`, exit 1, and that the same store without `--quiet` does print the section headers, `[ok]` lines, `fix:` continuation and count that quiet drops | `tests/cli.test.ts:471` |
| 2 | `gate --quiet` on a passing gate still prints nothing | "a green gate in quiet mode prints exactly nothing, on either stream" — `quiesce()` makes the fixture genuinely warning-free (`warnings.length === 0`), then both streams asserted empty | `tests/gate.test.ts:325` |
| 2 | same, through the shipped binary | last third of "gate --quiet prints its failures on stderr and leaves stdout empty" (`stdout + stderr === ""`, exit 0) | `tests/cli.test.ts:496` |
| 3 | the `Stop` hook's output on a red gate, from a real run | "Stop puts the gate's failures on stderr while its JSON stays clean" — `out === ""`, exact stderr line, and every stderr line proved present in `additionalContext` | `tests/hooks.test.ts:130` |
| 3 | same, as a real process | "hook stop keeps its JSON on stdout and the gate's failures on stderr" — `JSON.parse(stdout)` and `stdout.trimEnd() === JSON.stringify(parsed)`, so nothing may precede the object; exact stderr; exit 0 | `tests/cli.test.ts:506` |
| 3 | shown in the docs | `docs/wiki/Gates-and-Hooks.md` "What the Stop hook prints on a red gate", pasted from the two-run transcript above | `docs/wiki/Gates-and-Hooks.md:23` |
| 4 | tests cover the failing case | as row 1 | `tests/gate.test.ts:297`, `tests/cli.test.ts:471` |
| 4 | tests cover the passing case | as row 2, plus "Stop is silent when the gate is green" strengthened from `=== null` to asserting both streams are empty | `tests/gate.test.ts:325`, `tests/hooks.test.ts:162` |
| 4 | tests cover the warning-only case | "warnings alone print nothing in quiet mode, and do not turn the gate red" — asserts the fixture really warns (`/uncommitted change/`), that the gate is not red, and that both streams are empty | `tests/gate.test.ts:342` |

No acceptance bullet was widened. The `--quiet` output format is the only behaviour changed;
the non-quiet path is byte-identical, which the "same store without the flag" half of
`tests/cli.test.ts:471` pins.

## Where each claim stopped on the evidence ladder

| Claim | Rung | What was run |
|---|---|---|
| `gate --quiet` printed nothing before this change | **5** | shipped `bin/mstack` in a scratch git repo with two real failures; 0 bytes on both streams, exit 1 |
| `gate --quiet` now prints exactly the failure lines on stderr | **5** | same binary, same store, streams captured to separate files; plus `tests/cli.test.ts:471` as a process at rung 5 in CI terms |
| stdout stays a single parseable JSON object for `hook stop` | **5** | real process, real JSON on stdin, `JSON.parse` of the captured stdout; asserted again in `tests/cli.test.ts:506` |
| a passing gate prints zero bytes | **5** | walkthrough store, `mstack gate --quiet; echo $?` → `0` with no output; unit-level at `tests/gate.test.ts:325` |
| a warning-only gate prints zero bytes | **5** | store on `main` with a dirty tree: 2 warnings without `--quiet`, 0 bytes with it |
| the `Stop` hook's real output on a red gate | **5** | `bin/mstack hook stop` twice, unredirected, ordering stable |
| the new tests fail without the change | **4** | `main:src/report.ts` swapped in: 4 of 6 red, restore verified by sha256 |
| the assertions bite | **4** | 8 mutations, 8 killed, each by a named test; restores byte-verified |
| both runtimes green | **4** | `npm test`: 202 pass under bun, 202 pass under node |
| types and plugin lint clean | **4** | `npm run typecheck`, `./bin/mstack lint-plugin .`, `check-doc-links.mjs` |
| **Claude Code renders a hook's stderr in the transcript at exit 0** | **2, and stated as such** | not verified from here. What is verified is that the bytes reach fd 2 of the hook process and that stdout stays parseable. The model-facing path is unchanged and was already carrying the failures in `additionalContext`; stderr is the added human-facing channel, and whether the client surfaces it is the client's behaviour, not this repository's. A reviewer with a live session can settle it in one turn |

## Two things a reviewer should rule on

1. **`tests/cli.test.ts` `run()` changed from `execFileSync` to `spawnSync`.** It silently
   returned `stderr: ""` on exit 0, which would have made criterion 3 untestable. Every
   existing caller asserts `.code`, `.stdout` or `.stderr` and none changed meaning, but the
   helper is shared by 20-odd tests and the swap is mine to justify, not to slip in.
2. **Pre-existing noise, not introduced here:** `tests/fanout.test.ts` prints `[fail]  security
   returned without writing its report` into the runner's output, because `src/fanout.ts:105`
   builds a non-quiet `Report`. Confirmed identical on `main` in a detached worktree, so it is
   out of scope for this item; filing it is a call for whoever owns the queue.
