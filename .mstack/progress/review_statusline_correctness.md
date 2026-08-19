# Review - statusline (correctness)

**Verdict:** CHANGES_REQUESTED

Reviewed at `src/statusline.ts` sha256 `82854eb4ed99...a537738`, `src/roles.ts` `07779e302cca...e017c65`.
Both files were modified at 19:47 and 19:54 while this review was running; every claim below was
re-verified against those checksums.

## Acceptance, quoted

**"`mstack statusline` reads the stdin payload and prints one line"** - met. `src/cli.ts:69`
dispatches the subcommand, `src/cli.ts:111-113` splits `--subagent` from the default,
`src/statusline.ts:188` reads fd 0, and `src/statusline.ts:193-199` writes exactly one line
terminated by a newline. Verified live below. The decisions row of 2026-08-19T17:15:02Z amended
this bullet away from `bin/mstack-statusline`; not re-litigated, and the launcher argument in it
holds - `bin/mstack:26-53` is the only copy of the symlink/bun/node/NODE_COMPILE_CACHE resolution.
One caveat: a newline inside `model.display_name` is passed straight through
(`src/statusline.ts:72-73`) and produces two lines. Claude Code renders each line as a separate
status row, so this is cosmetic and needs a hostile payload, but "one line" is not enforced.

**"It shows the active item, its status, and the branch, and degrades to something useful when
.mstack/ is absent"** - **partially met.** Item and status: `src/statusline.ts:114-115`. Branch:
`src/statusline.ts:85-86`, with detached `HEAD` and the empty string filtered out. Absent store:
`src/statusline.ts:77-82` prints `no .mstack`, verified. It also degrades for a directory that is
not a git repo and for an unreadable `state.json` (`src/statusline.ts:88-95`), both verified.
What is **not** met: an item in `blocked` never reaches line 114, because `isActive`
(`src/lifecycle.ts:64`, list at `src/lifecycle.ts:25-31`) excludes `blocked` from
`ACTIVE_STATUSES`. A store whose only item is blocked renders `main - idle`. See finding 2.

**"It never blocks a turn: any failure prints nothing and exits 0"** - met.
`src/statusline.ts:185-203` wraps the whole body; `render()` is evaluated as the *argument* to
`process.stdout.write`, so a throw inside it prints nothing at all rather than a partial line. A
stdin read failure is caught separately at `src/statusline.ts:189-191`. The function returns 0
unconditionally (`src/statusline.ts:202`) and `src/cli.ts:426` makes that the exit code. Verified
against garbage stdin, empty stdin, `null`, `[]`, a chmod-000 ledger and a removed `progress/`
directory - exit 0 every time. `subagentStatusline` has the same shape
(`src/statusline.ts:296-313`).
One thing I could **not** establish: `readFileSync(0, "utf8")` blocks until EOF, and I could not
allocate a tty in this sandbox to test what happens if stdin is never closed. Note that the hook
path guards this explicitly (`src/cli.ts:419`, `if (process.stdin.isTTY === true) return ""`) and
the status line path does not.

**"README documents how a user wires it up, including that a plugin cannot register one on its own
if that turns out to be true"** - met. `README.md:150-162` gives the `statusLine` settings.json
block, `README.md:164-165` explains `refreshInterval`, `README.md:167-169` covers the case where
`mstack` does not resolve on PATH. `README.md:190-195` states that a plugin *may* ship a default
`subagentStatusLine` in its own settings.json and why mstack does not. I checked that against the
official docs rather than taking it on trust: the statusline docs do say "Plugins can ship a
default `subagentStatusLine` in their settings.json", and `${CLAUDE_PLUGIN_ROOT}` substitution in a
plugin settings.json is genuinely not documented. The README is accurate on both halves.

## Verification I ran

```
$ node --test 'tests/statusline.test.ts'
tests 21 / pass 21 / fail 0

$ npm test
Ran 116 tests across 11 files. [7.65s]     (bun)
tests 116 / pass 116 / fail 0              (node)

$ npm run typecheck
> bunx --bun tsc --noEmit          (clean)

$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
```

Flakiness: in the first ~60 runs of `node --test 'tests/statusline.test.ts'` I recorded 9 failures
(transcripts saved), including `main - #1 storage-layer - in_progress - test-verified` where
`verdict stale (1)` was expected, and `implementer - #1 storage-layer - impl report written` where
the report on disk was 7 bytes. In ~340 runs afterwards, including 15 under artificial CPU load and
120 in a background sweep, there were **zero** failures. `src/statusline.ts` and `src/roles.ts`
were being edited during the failing window (mtimes 19:54:01 and 19:47:10). I therefore cannot
attribute those failures to the code as it now stands, and I am not raising them as a finding - but
they are why I re-read both files and re-ran everything afterwards.

### Finding 1, reproduced live

```
$ ./bin/mstack ledger record widget aaaa...aaaa test-verified --evidence "old suite"
$ ./bin/mstack ledger record widget $(git rev-parse HEAD) verifier-failed --evidence "suite red"
$ echo '{"workspace":{"current_dir":"'$W'"},"model":{"display_name":"Opus"}}' | NO_COLOR=1 ./bin/mstack statusline
Opus - main - #7 widget - in_progress - verdict stale (1)

$ ./bin/mstack ledger check widget $(git rev-parse HEAD)
FAIL best verdict at 0b451982 is verifier-failed, which does not clear test-verified
```

### Finding 2, reproduced live

```
items = [ {id:7, slug:"widget", status:"blocked"} ]
$ echo '{"workspace":{"current_dir":"'$W'"}}' | NO_COLOR=1 ./bin/mstack statusline
main - idle

items = [ blocked widget, pending other ]
main - idle, 1 pending
```

### Finding 3, reproduced live

```
$ ln -sf /nonexistent/nope.md .mstack/progress/review_widget_ghost.md

$ echo '{"cwd":"'$W'","tasks":[{"id":"t1","type":"mstack:implementer"},
                               {"id":"t2","type":"mstack:reviewer"}]}' | ./bin/mstack statusline --subagent
                      (no output at all; exit 0 - both rows lost, not just the reviewer's)

$ echo '{"cwd":"'$W'","agent_type":"mstack:reviewer"}' | ./bin/mstack hook subagent-stop
                      (no output; exit 0 - the guard is disabled)

# same input with the symlink removed and no reviewer report:
{"hookSpecificOutput":{"hookEventName":"SubagentStop","additionalContext":"The reviewer subagent
 finished without writing .../review_widget.md ..."}}
```

### Finding 4, reproduced live

```
five commits, each with a test-verified row, then one more commit with no row
$ echo '{"workspace":{"current_dir":"'$W'"}}' | NO_COLOR=1 ./bin/mstack statusline
main - #7 widget - in_progress - verdict stale (5)

$ ./bin/mstack ledger check widget $(git rev-parse HEAD)
FAIL no verdict at bc2f077c; 5 row(s) exist at other SHAs and a new head SHA voids them
```

### Finding 5, reproduced live

```
items = [ #7 widget in_progress, #8 gadget reviewing ]
main line:     main - 2 active items
subagent row:  {"id":"t1","content":"implementer - #7 widget - impl report written"}
```

### Finding 6, reproduced live

```
branch = feat/U+1F680-rocket
$ COLUMNS=7 NO_COLOR=1 ./bin/mstack statusline | xxd
00000000: 6665 6174 2fef bfbd e280 a60a            feat/.......
                    ^^^^^^^^ U+FFFD - the surrogate pair was cut in half

render({model:{display_name: ESC + "[?25lhello more text here"}}, {colours:false, columns:10})
 -> the output still contains that raw ESC, and its length after stripAnsi is 23, not 10

render({model:{display_name:"AAAA" + U+1F600 + "ZZZZZZZZ"}}, {colours:false, columns:6})
 -> "AAAA\ud83d" + ellipsis    (lone surrogate)

CJK: render(..., {columns:12}) -> 12 code points of output occupying 16 terminal columns
```

### Subagent contract (question 4 of the brief)

```
$ echo '{"cwd":"'$W'","tasks":[{"id":"t1","type":"mstack:implementer","tokenCount":12400},
        {"id":"t2","type":"mstack:reviewer"},{"id":"t3","type":"Explore"},
        {"type":"mstack:reviewer"}]}' | NO_COLOR=1 ./bin/mstack statusline --subagent
{"id":"t1","content":"implementer - #7 widget - impl report written - 12k"}
{"id":"t2","content":"reviewer - #7 widget - no review report yet"}
```

Contract respected. One JSON object per line, exactly the keys `id` and `content`
(`src/statusline.ts:310`, checked by parsing each line back). `t3` (Explore, no report contract)
and the task with no `id` are omitted rather than emitted blank, which the docs confirm is the
right move: "Omit a task's `id` to keep the default rendering for that row; emit an empty
`content` string to hide it." `SubagentTask` (`src/statusline.ts:216-225`) declares a subset of the
documented task fields, all optional, so a field the docs add later cannot break it. `COLUMNS` is
also confirmed by the docs ("Claude Code sets these to the current terminal dimensions before
running your script. Requires Claude Code v2.1.153 or later"), so the comment at
`src/statusline.ts:64` is accurate - though on an older Claude Code `COLUMNS` is simply unset and
truncation silently does not happen, which is a safe default.

## Findings

1. `src/statusline.ts:122` - **a verdict that exists at HEAD but failed is reported as "verdict
   stale".** The `else if (result.stale.length > 0)` branch is tested before
   `result.best !== undefined`, so any target that has ever been verified at an older SHA reports
   staleness even when `check()` found a row *at the current HEAD*. Reproduced above: a
   `verifier-failed` row at HEAD plus one old row renders `verdict stale (1)`, while
   `ledger check` on the same store says `best verdict at 0b451982 is verifier-failed`. This is not
   a cosmetic mislabel - "stale" tells the reader "nothing has been verified here, go run the
   verifier", when the truth is "the verifier ran here and failed". The same swallowing happens for
   `verifier-blocked` and `type-check-only`. It is reachable by the most ordinary sequence there
   is: verify, commit, verify again, fail. Fix: gate the stale branch on there being no verdict at
   HEAD - `} else if (result.best === undefined && result.stale.length > 0) {` - or move the
   `result.best !== undefined` branch above it. Either ordering makes the four branches mutually
   exclusive on `best`, which is what `CheckResult` already models (`src/ledger.ts:83-90`).

2. `src/statusline.ts:98` and `src/statusline.ts:115` - **a blocked item renders as `idle`.**
   `isActive` (`src/lifecycle.ts:64`, list at `src/lifecycle.ts:25-31`) excludes `blocked`, so the
   filter at line 98 drops it, line 100 counts only `pending`, and the line reads `idle` or
   `idle, N pending`. Line 115 (`item.status === "blocked" ? RED : YELLOW`) is unreachable dead
   code, which is the clearest possible evidence that showing a blocked item was the intent. A
   blocked item is the one state where a human is required, and the status line currently says the
   opposite of the truth about it. Fix: after the `active.length === 0` test, look for a `blocked`
   item and render its `#id slug` and `blocked` in RED before falling back to `idle`; line 115 then
   starts doing the job it was written for.

3. `src/statusline.ts:277` and `src/hooks.ts:146` - **an unreadable entry in `progress/` silently
   disables both the subagent rows and the SubagentStop guard.** `statSync` is called unguarded
   inside a `.filter`, on a path that came from a separate `readdirSync` (`src/roles.ts:47-55`).
   A dangling symlink - or any file removed in the window between the two calls, which is exactly
   the window a fan-out of parallel writers lives in - throws ENOENT. In `renderSubagents` the
   throw escapes to the catch at `src/statusline.ts:311`, so **every** row is dropped, including
   rows for workers that had nothing wrong with them. In `subagentStop` it escapes to the catch at
   `src/cli.ts:389`, so the hook that exists to catch a worker returning without a report reports
   nothing. Reproduced above for both. This is also the answer to "confirm they cannot diverge":
   `reportFiles` is properly shared, but the emptiness rule is not - the literal `40` and the
   unguarded `statSync` are copy-pasted into `src/statusline.ts:277` and `src/hooks.ts:146`, and
   the two comparisons are written in opposite directions (`>= 40` vs `< 40`). Fix: put the whole
   rule in `src/roles.ts` next to `reportFiles` - e.g. a `substantialReports(progressDir, kind,
   slug)` that stats inside a try and treats an unreadable entry as size 0 - and have both callers
   use it. Then the floor cannot drift and neither caller can be taken down by one bad directory
   entry.

4. `src/statusline.ts:124` - **`verdict stale (N)` counts history, not staleness.** `N` is
   `result.stale.length`, which `src/ledger.ts:110` defines as every row for this target at any
   other SHA. After five verified commits the line reads `verdict stale (5)` (reproduced above)
   although only one verdict meaningfully went stale; the number grows monotonically with the age
   of the item and carries no signal. `ledger check` gets the wording right - "5 row(s) exist at
   other SHAs and a new head SHA voids them". Fix: drop the count, or show something that decays -
   the shortest form that is true is just `verdict stale`, and if a number is wanted it should be
   commits since the newest stale row, not the row count.

5. `src/statusline.ts:98-111` vs `src/statusline.ts:265` - **the two halves of the file disagree
   about what to do with more than one active item.** `render` refuses to pick one and reports
   `2 active items`, with a comment and a test saying that picking one "would report a violation as
   normal work" (`tests/statusline.test.ts:90`). `renderSubagents` silently picks the first
   (`.find(...)`) and prints its slug next to every worker. Reproduced above: the main bar says
   `2 active items` while the panel rows confidently name `#7 widget`. Fix: reuse `activeItem`
   (`src/state.ts:169-175`) or, better, apply the same refusal - if more than one item is active,
   drop the `#id slug` and the report claim from the row rather than attributing a worker's report
   to a guessed item. Note that `renderSubagents` hand-inlines the body of `activeItem` including
   its try/catch; that is the second place where these two consumers can drift apart independently
   of `reportFiles`.

6. `src/statusline.ts:161-176` - **the truncation counts UTF-16 code units, not printable
   characters**, contrary to the doc comment at `src/statusline.ts:141-144` and the test name at
   `tests/statusline.test.ts:116`. Four distinct consequences, all reproduced above:
   (a) a non-BMP character is split at the boundary, leaving a lone surrogate that reaches the
   terminal as U+FFFD - shown live with a branch named `feat/<rocket emoji>-rocket` at `COLUMNS=7`.
   Git permits emoji in ref names, so this needs no hostile input. In the subagent path the same
   string goes through `JSON.stringify` (`src/statusline.ts:310`), which emits a
   well-formed-but-lone `\ud83d` escape; Node and Python accept that, a strict reader such as
   serde_json rejects it - I could not establish which parser Claude Code uses, so I am not
   claiming the row is dropped, only that it is a needless risk. (b) a non-BMP character spends 2
   of the width budget, so the line is truncated earlier than it needs to be. (c) a wide character
   (CJK) spends 1 of the budget but 2 terminal columns, so the line overflows - `columns: 12`
   produced 16 columns of output. (d) a decomposed combining mark is separated from its base. Fix
   for (a), (b) and (d): iterate `for (const ch of text)` (or over `Array.from`) instead of
   `text[i]`; `bare.length` at `src/statusline.ts:151` needs the same treatment. (c) needs an
   east-asian-width table and is probably not worth it - but the doc comment should stop claiming
   the truncation is about printable characters when it is about code units.

7. `src/statusline.ts:166` - **`truncateVisible` and `stripAnsi` disagree about what an escape
   sequence is.** `stripAnsi` uses the regex at `src/statusline.ts:154`, which requires digits and
   semicolons then `m`. `truncateVisible` accepts any `ESC[` and then takes `indexOf("m", i)`,
   which for a non-SGR sequence such as `ESC[?25l` runs on to the next literal `m` anywhere in the
   string and copies everything in between into the output **without counting it**. Reproduced: a
   payload of that shape at `columns: 10` produced a line whose stripped length is 23. The same
   input also proves the `NO_COLOR` contract documented at `src/statusline.ts:43-46` is not
   enforced - a raw ESC from the payload is emitted verbatim with `colours: false`. To be fair to
   the author, well-formed SGR sequences are never split across the boundary, which is the thing
   the design was aiming at, and the only vector here is Claude Code's own payload. Fix: use the
   same `ANSI` regex in both, and strip remaining C0 control characters out of payload-derived
   strings (`model.display_name`) before they are joined.

8. `src/roles.ts:45` and `src/roles.ts:53` - **the report-file prefix grammar is ambiguous between
   kinds.** `reportFiles(progress, "spec", "review")` builds the prefix `spec_review` and therefore
   also matches every `spec_review_<other-slug>.md` written by the *spec-reviewer* for a different
   item, because both the panel-lens suffix and the kind separator are `_`. It needs an item
   slugged `review`, which `SLUG` (`src/state.ts:39`) permits. Both consumers share the function,
   so they cannot disagree with each other - they would just both be wrong. Low severity; worth a
   comment at minimum, or make the panel separator something a kind cannot contain.

9. `src/statusline.ts:270-283` and `tests/statusline.test.ts:264-271` - **a row that knows nothing
   still overrides Claude Code's default rendering.** When the store is absent, unreadable, or has
   no active item, the row is emitted anyway with only the role name in it (`implementer`),
   replacing a default row that would have carried the task's status, description and token count.
   That contradicts the principle stated in this file's own comment at `src/statusline.ts:245-248`
   and enforced for unknown roles at `src/statusline.ts:257`. I am flagging this as a design
   objection rather than a bug, because it is deliberate and pinned by a test whose message spells
   out the reasoning ("outside a store the role is still worth showing"). I disagree with it: the
   default row already names the role, so mstack is trading real information for a duplicate.
   Verified: with an unparseable `state.json` the main bar says `state.json unreadable` while the
   panel row degrades all the way to the bare word `implementer`.

10. `README.md:183-184` - the subagent example shows column-aligned rows (`reviewer` padded out to
    match `implementer`). The code pads nothing. Trivial, but the README is otherwise exact about
    what this prints.
