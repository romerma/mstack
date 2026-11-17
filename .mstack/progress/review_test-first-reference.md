# Review - test-first-reference

**Verdict:** APPROVED

Reviewed `git diff 44809a5..d13d100 -- . ':!.mstack'` (9 files, +106 -11) at head
`d13d10064fee30e116210a4f879903dfc43f8775`, branch `feat/test-first-reference`. I did not write
it. Every CLI call was `/Users/romerma/Code/mstack/bin/mstack` (`mstack 0.2.1 at
/Users/romerma/Code/mstack`). claude 2.1.326, model `claude-opus-5-5`. Scratch work, clones and
streams are under
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review56/`
(`$S` below). I did not use the implementer's report as evidence.

Six headless runs, all exited on their own with empty stderr, total 3.86 USD: A1 0.20, A2 0.12,
A3 0.09, B 1.28, R 1.16, E2 1.02. No process of mine is left running.

## Blocking findings

None.

## Non-blocking findings

**N-1. `skills/router/playbooks/feature.md:15` names a command that cannot give the seams, and
`:18` turns missing seams into "no behaviour".** The step says "Take the item's `seams`
(`mstack state active`)". That command prints only the slug, and for the `pending` item intake
leaves behind it prints `no active item` and exits 1 (`src/cli.ts:348-360`):

```
$ mstack state add --slug x --title X --acceptance "it works" --seam "CLI: x stdout" --seam "f(a) in src/x.py"
added 1 x (pending)
[exit 0]
$ mstack state active
no active item
[exit 1]
$ mstack state set x --status in_progress
1 x (in_progress)
  status: "pending" -> "in_progress"
$ mstack state active
x
[exit 0]
$ mstack state active --json
mstack: state active takes no arguments, got '--json'
[exit 2]
```

Read literally, the step's command never shows a seam, so it always reaches the `:18` rule ("An
item with no seams is a change with no behaviour: say `skip: no behaviour`"). That rule is also
wrong for items that have behaviour but no seams. `skills/setup/SKILL.md:35-37` seeds items with
no `--seam`. The shipped example's direct-path feature item has none either:
`examples/notes-cli/.mstack/state.json` items 2 `cli-search` and 3 `export-json` have
`seams` absent. Neither live coordinator took it literally. B already knew its seams from its own
`state add`. E2 (below) read `state.json` and added seams with `state set --seam`. Both are n=1,
so this is not blocking. To fix it: point at the item's `seams` array in `.mstack/state.json`
until item 74 adds a `state show`. Then say that an item that changes behaviour but has no seams
gets them named with `state set <ref> --seam` before delegation. Only a change with no
behaviour says `skip: no behaviour`.

**N-2. `skills/test-first/SKILL.md:54-56` makes a claim that is false wherever it gets injected.**
The sentence is "A reviewer will run its own mutants, and in this repository the blocks came from
the ones the suite missed." First, nothing tells a reviewer to run mutants:
`rg -n -i 'mutant|mutation' agents/ skills/ --glob '!skills/test-first/**'` finds no hit in
`agents/reviewer.md` or `skills/review/SKILL.md`. Second, the text reaches the implementer inside
the user's project (A1 ran it in the `bookings` sandbox), so "this repository" means that project
and the history it cites is mstack's. Every implementer start pays for this sentence. Delete it.

**N-3. A delegated refactor is not covered.** `SKILL.md:48` says "No restructuring beyond what
the test needs: review owns refactoring." `:60-61` exempts only "docs, prose, config with nothing
to observe". `refactor.md:13` still delegates the mechanical restructuring to the implementer. In
run R (n=1) the conflict did not bite. The coordinator's brief said "No new tests are needed: the
pinning tests are the proof", and the implementer did the extraction and wrote: "This is a
refactor with no behaviour change, so I wrote no new test." One clause would remove the
ambiguity: add "a refactor the brief asks for, pinned by characterization tests" to "When it
does not apply", and change `:48` to "beyond what the test or the brief needs".

**N-4. The main session can still auto-invoke the skill.** This is documented behaviour and it
does not matter here. A3 shows the main session's Skill listing includes `mstack:test-first`,
and the Skill tool loads the whole body. The init event's `skills` and `slash_commands` arrays
both leave it out, so the init list is not a model-invocation list. The only flag that blocks
model invocation also blocks preloading (quotes under A4), so `user-invocable: false` is the
right choice. The cost is one 155-character description in every session's skill listing.

**N-5. Lint misses the two ways this wiring can silently break.** Both of these pass `lint-plugin`
with `PASSED - 0 failures, 0 warnings`: `skills: [test-frist]` in `agents/implementer.md`, and
`disable-model-invocation: true` added to `skills/test-first/SKILL.md` (Probe E). Per the docs a
missing preloaded skill is "skipped" with a warning "to the debug log", so either break would
quietly remove the reference. This calls for a lint rule (each agent `skills` entry resolves to a
skill under `skills/` with no `disable-model-invocation: true`). The acceptance does not ask for
one, and no listed item owns it.

**N-6. Item 55 gap, confirmed: nothing moves the item to `in_progress`.** B: `state add` printed
`added 1 max-stay-30-nights (pending)`, `state active` printed `no active item` (exit 1), the
coordinator tried `state set ... --status active` and got `'active' is not a status`, and then it
ran `--status in_progress`. E2 made the same `--status active` guess on a seeded `pending` item.
Neither run stopped. `rg -n 'in_progress' skills/ agents/` returns only
`agents/orchestrator.md:29`. Intake's End (`intake.md` "## End") leaves the item `pending`, and
neither the router nor `feature.md` says to move it. This belongs to item 55's text (item 73).
The `--status active` guess and B's `--acceptance "--discount-percent ..."` refusal ("Option
'--acceptance' argument is ambiguous") belong to item 74.

**N-7. The step's wording invites bulk tests.** `feature.md:17` says "The brief requires a test
run red ... before any code". B's brief turned that into "write the tests first and run them red
... Then implement". The implementer wrote 15 tests at three seams, then one 5-line code change.
For a single behaviour that is arguably one slice, and the reference's vertical-slice rule was not
plainly broken. E2's implementer, given similar wording, worked in four vertical slices. "the
first test run red" would match the reference's loop.

**N-8. Cost.** The preload adds about 1.7k tokens per implementer start: subagent tokens were
8043 with the skill (A1) and 6309 without it (A2) for the same task. The mutant pass now runs on
every item. Item 44 (size tiers) is where scaling that belongs.

**N-9. Docs nits.** `docs/wiki/Skills-and-Playbooks.md:7` still says "This page introduces all
thirteen skills", but the page now introduces a fourteenth at `:20-23`. `skills/router/SKILL.md:77`
and `docs/wiki/The-Agents.md:136` were left as unwrapped long lines.

**N-10. Already known, not this item:** `claude plugin validate --strict` fails (item 50).
`tests/costs.test.ts:698` and `tests/run.test.ts:239` are load-sensitive (item 67); they did not
fail here because the suite ran with no live run alongside.

## Probe A: injection, with a control

Wrapper `$S/run.sh <run dir> <plugin dir> <prompt file>`. It copies `sandbox/bench/template` to
`<run dir>/proj`, runs `git init` and a commit, runs this checkout's `bin/mstack setup` under the
clean environment, sets `state.verify` to `python3 -m unittest discover -s tests` and commits, as
`sandbox/bench/run.mjs` does. Streams go to `<run dir>/stream.jsonl`, outside `proj`.

```
/usr/bin/env -i HOME="$HOME" USER="$USER" LOGNAME="$LOGNAME" TERM="${TERM:-xterm}" LANG="${LANG:-en_US.UTF-8}" TMPDIR="$TMPDIR" SHELL="$SHELL" PATH="$CLEANPATH" \
  /usr/bin/perl -e 'alarm shift; exec @ARGV' 600 \
  /Users/romerma/.local/bin/claude -p "$PROMPT" --model opus --output-format stream-json --verbose \
  --setting-sources project --strict-mcp-config --max-budget-usd 6 --plugin-dir "$PLUGIN" --permission-mode auto
CLEANPATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/Users/romerma/.bun/bin:/Users/romerma/.local/bin
```

The environment is rebuilt from HOME USER LOGNAME TERM LANG TMPDIR SHELL PATH only, with no
ANTHROPIC_* variable. `mstack` is not on that PATH. The alarm stops a run at 600 s; none
reached it.

### Task text (identical in A1 and A2; I chose the sentences, by position only)

```
This is a context check, not an implementation task. Do not use any tool at all: no Read, no Bash, no Glob, no Grep, no Write, no file access of any kind. Answer only from what is already in your context at this moment.

If a test-first reference was placed in your context when you started, give the following, each copied word for word from it:
1. Every second-level heading in it (the lines that start with "## "), in order.
2. The full sentence that comes immediately before its first numbered list.
3. The full last sentence of the whole reference.
Then say exactly where in your context that text sits (your system prompt, the message carrying this task, a separate message, or somewhere else) and what marks or tags it.

If no such reference is in your context, reply with exactly: NO REFERENCE IN CONTEXT
Do not reconstruct, guess or paraphrase. A guess is worse than NO REFERENCE IN CONTEXT.
```

The A1 session prompt was: "Use the Agent tool to launch the subagent type mstack:implementer,
passing the task between the two marker lines below as its prompt, character for character, with
nothing added or removed. Then use the Agent tool again to launch the subagent type
mstack:reviewer with the same task, also character for character. Do not read any file and do not
run any other tool yourself. When both have returned, print each reply verbatim, labelled with
its subagent type, and stop.", followed by the task between `-----BEGIN TASK-----` and
`-----END TASK-----`. A2 was the same without the reviewer sentence.

### A1: `--plugin-dir /Users/romerma/Code/mstack` (stream `$S/A1/stream.jsonl`, 25.3 s)

```
INIT model: claude-opus-5-5 perm: auto cc: 2.1.326
INIT plugins: [{"name":"mstack","path":"/Users/romerma/Code/mstack","source":"mstack@inline","version":"0.2.1"},{"name":"cc-plugin-agents-md","path":"builtin",...},{"name":"cc-plugin-telemetry","path":"builtin",...},{"name":"cc-plugin-privacy","path":"builtin",...},{"name":"cc-plugin-plugin-authoring","path":"builtin",...}]
TOOL Agent id=EmnnPt {"description":"Implementer context check","subagent_type":"mstack:implementer","run_in_background":false,"prompt":"This is a context check, not an implementation task. ... A guess is worse than NO REFERENCE IN CONTEXT."}
TOOL Agent id=ZiLUBG {"description":"Reviewer context check","subagent_type":"mstack:reviewer",...same prompt...}
  [SUB ZiLUBG] TOOL SubagentHandback {"message":"NO REFERENCE IN CONTEXT"}
  RESULT(ZiLUBG)> ... <usage>subagent_tokens: 6653 tool_uses: 0 duration_ms: 4478</usage>
  [SUB EmnnPt] TOOL SubagentHandback {"message":"The test-first reference is in my context. I answered from context only and read no files. This hand-off is the only tool I called, because it is the only way the answer reaches you.

1. Second-level headings, in order:
- ## Seams
- ## A good test
- ## The loop, one slice at a time
- ## Before you report: mutants
- ## When it does not apply

2. Sentence immediately before the first numbered list:
\"Do not write all the tests first and then all the code: tests written in bulk check an imagined shape.\"

3. Last sentence of the whole reference:
\"Say so in one line in the report instead of inventing a test.\"

Where it sits: the reference is not in my system prompt. My system prompt only says the reference is \"already in your context\". The text is in the same user message that carries this task, appended after your instructions. It is marked by these tags: `<command-message>test-first</command-message>`, `<command-name>test-first</command-name>` and `<skill-format>true</skill-format>`. Next comes the line \"Base directory for this skill: /Users/romerma/Code/mstack/skills/test-first\", then an HTML comment naming where it came from (mattpocock/skills and obra/superpowers). The body starts at the heading \"# Test-first\". ..."}
  RESULT(EmnnPt)> ... <usage>subagent_tokens: 8043 tool_uses: 0 duration_ms: 9123</usage>
RESULT success cost=0.1996 turns=3 ms=25270
```

The prompts in both Agent calls equal the task text character for character, so the coordinator
pasted nothing. The implementer subagent's only tool call is `SubagentHandback`, the harness's
delivery channel. `tool_uses: 0`, and it made no Read, Bash, Glob or Grep call. I checked the
reply against the file with a script (whitespace normalised):

```
headings file : ['## Seams', '## A good test', '## The loop, one slice at a time', '## Before you report: mutants', '## When it does not apply']
headings reply: ['## Seams', '## A good test', '## The loop, one slice at a time', '## Before you report: mutants', '## When it does not apply'] equal: True
in file: True | Do not write all the tests first and then all the code: tests written in bulk check an imagined shape.
in file: True | Say so in one line in the report instead of inventing a test.
file lines before first numbered list: ['A slice is one behaviour. Do not write all the tests first and then all the code: tests', 'written in bulk check an imagined shape.', '']
file last non-empty line: first. Say so in one line in the report instead of inventing a test.
```

The position-based answers are correct too: that sentence is the one right before `1.`, and the
last-sentence quote is the file's last sentence.

### A2: control, a clone with the `skills:` lines removed (stream `$S/A2/stream.jsonl`, 12.6 s)

```
$ git clone -q /Users/romerma/Code/mstack $S/clone-control   (HEAD d13d10064fee30e116210a4f879903dfc43f8775, feat/test-first-reference)
$ git -C $S/clone-control diff
-skills:
-  - test-first
```

```
INIT plugins: [{"name":"mstack","path":".../scratchpad/review56/clone-control","source":"mstack@inline","version":"0.2.1"}, ...the same four builtins...]
TOOL Agent id=pX4KL3 {"description":"Context check for implementer","subagent_type":"mstack:implementer","prompt":"This is a context check, ... A guess is worse than NO REFERENCE IN CONTEXT.","run_in_background":false}
  [SUB pX4KL3] TOOL SubagentHandback {"message":"NO REFERENCE IN CONTEXT"}
  RESULT(pX4KL3)> ... <usage>subagent_tokens: 6309 tool_uses: 0 duration_ms: 4848</usage>
TEXT> NO REFERENCE IN CONTEXT
RESULT success cost=0.1247 turns=2 ms=12590
```

The control gives the expected reply, even though the clone's implementer body still says "The
test-first reference is already in your context". So the method does detect the text, and the
text arrives through the `skills` field and nothing else. Without that field nothing else
supplied it: not the coordinator, not model invocation (the implementer's `tools` has no `Skill`),
and not a marketplace copy.

### A3: init event, and one copy of mstack

Both A1 and A2 list exactly one `mstack`, `source: mstack@inline`, at the `--plugin-dir` path,
plus four `@builtin` plugins. `~/.claude/plugins/installed_plugins.json` holds only
`figma@claude-plugins-official` and `mattpocock-skills@claude-plugins-official`, there is no mstack
marketplace install, and `command -v mstack` prints nothing. Neither user plugin loads under
`--setting-sources project`, so the `mattpocock-skills:tdd` skill was not available to supply
similar text.

### A4: `user-invocable: false`

https://code.claude.com/docs/en/skills (fetched 2026-11-17), frontmatter table:

> `user-invocable`: "Set to `false` when only Claude should invoke the skill: Claude Code hides it from the `/` menu and doesn't run it when you type `/name`. Use for background knowledge users shouldn't invoke directly. Default: `true`."

> `disable-model-invocation`: "Set to `true` to prevent Claude from automatically loading this skill. ... Also prevents the skill from being preloaded into subagents ..."

> | `user-invocable: false` | No | Yes | Description in context, full skill loads when invoked |

> "With `user-invocable: false`, you can't invoke the skill, but Claude still can. To keep Claude from invoking it through the Skill tool, set `disable-model-invocation: true`."

https://code.claude.com/docs/en/sub-agents (fetched 2026-11-17), "Preload skills into subagents":

> "The full content of each listed skill is injected into the subagent's context at startup, up to the first 32 distinct names in the list."

> "You can't preload skills that set `disable-model-invocation: true`, since preloading draws from the same set of skills Claude can invoke."

> "If a listed skill is missing or disabled, for example by your organization's policy, Claude Code skips it and logs a warning to the debug log."

Init event (A1): `skills` lists `mstack:commit ... mstack:router ... mstack:verify` with no
`mstack:test-first`, and `slash_commands` also has no `mstack:test-first`. So the skill is kept
out of the user's slash commands, as the docs say.

A3 checked the main session's model-invocable list (prompt: list every `mstack:` name in the
Skill tool's listing with no tool call, then call Skill once with `mstack:test-first`). Stream
`$S/A3/stream.jsonl`, 7.4 s:

```
TEXT> **Step 1:** mstack:commit mstack:design mstack:implement mstack:orchestrate mstack:reflect mstack:review mstack:setup mstack:ship mstack:spec mstack:test-first mstack:understand mstack:unslop mstack:verify
A skill named test-first does appear, as `mstack:test-first`. Its listing says "Preloaded into mstack:implementer; not a command."
TOOL Skill id=y2S6wU {"skill":"mstack:test-first"}
  RESULT(y2S6wU)> Launching skill: mstack:test-first
USER> Base directory for this skill: /Users/romerma/Code/mstack/skills/test-first ... # Test-first ...
```

The main session can auto-invoke the skill, as documented. The only flag that would stop it
also stops the preload, so this is the right trade. N-4 has the assessment.

### A5: other agents

The reviewer in A1 replied `NO REFERENCE IN CONTEXT` with `tool_uses: 0`.
`rg -n '^skills:|^  - ' agents/` shows the field only at `agents/implementer.md:5-6`.
`orchestrator.md`, `reviewer.md`, `spec-author.md` and `spec-reviewer.md` have no `skills` field.

## Probe B: behaviour, `/mstack <request>` and nothing else

Prompt (the whole prompt, a different feature from the implementer's `--guest` run):

```
/mstack quote and book must refuse a stay longer than 30 nights. A stay of 31 or more nights fails with the message `error: a stay can be at most 30 nights` on stderr and exit code 1, for both commands, checked before pricing, before the overlap check and before anything is stored; --discount-percent does not change this. A stay of exactly 30 nights is still accepted and priced as it is today. Nothing else changes.
```

Stream `$S/B/stream.jsonl`, extracted to `$S/B/detail.txt`. Result: success, 19 turns, 343 s,
1.28 USD. The run went through implementer, coordinator CLI check, reviewer APPROVED, and done.

**Playbook copy.** The coordinator ran `cat .../skills/router/references/intake.md
.../skills/router/playbooks/feature.md`. It made no TodoWrite call, and the session's init `tools`
list has no TodoWrite (`['Task', 'Bash', ..., 'Skill', 'TaskStop', ..., 'Write']`). It did not
list the steps in text either. Its `current.md` plan names "Tests at all three seams" and
"Delegate to mstack:implementer". So the playbook was not copied verbatim, a router-compliance
matter outside this item, but step 4's content did reach the brief.

**Seams and no confirmation.** `TEXT> Intake: new work. The request settles every fork itself
..., so nothing needs to go back to you. Route: feature.` `state add` carried three `--seam`s.
No turn asked the user anything.

**The brief** (the relevant part, verbatim):

```
Pre-agreed seams (tests attach here; do not ask to confirm):
- pricing.quote(room, check_in, check_out, discount_percent) in bookings/domain/pricing.py (tests/test_money_pricing.py)
- BookingService.book / .quote in bookings/app/service.py with MemoryRepository (tests/test_service.py)
- CLI: cli.main(argv, service=..., out=..., err=...) exit code, stdout and stderr (tests/test_adapters_cli.py, CliTests.run_cli helper)
...
Process: write the tests first and run them red. Paste the failing output in your report, showing they fail for the expected reason (no error raised / wrong message). Then implement. Then do the mutant check (e.g. change > 30 to > 31 or >= 30 and confirm a test fails).
```

**The implementer**, in order (16 tool calls, no question to anyone):

1. It added the pricing tests and ran them red: `AssertionError: BookingError not raised`, and
   `AssertionError: 'unknown room type: penthouse' != 'a stay can be at most 30 nights'`.
2. It added the service and CLI tests and ran the whole suite: `FAILED (failures=13)`. The first
   overlap test was red for the wrong reason (`no error raised for a 31-night booking`, because
   `Booking.overlaps` misses containment). It read the failure, rewrote the test so the check-in
   falls inside the existing stay, and reran. The red was then for the expected reason:
   `AssertionError: got BookingConflict; max-stay check must run before overlap`. This is the
   reference's step 2 at work.
3. It made one code change, `bookings/domain/pricing.py` +5 lines (`MAX_NIGHTS = 30` and the
   check), then ran `python3 -m unittest discover -s tests -v`: `Ran 33 tests ... OK`.
4. It ran 7 mutants and reverted each: `M1 boundary > 31: KILLED`, `M2 boundary >= 30: KILLED`,
   `M3 drop the check: KILLED`, `M4 check after nightly_rate: KILLED`, `M5 check only when no
   discount: KILLED`, `M6 wrong message: KILLED`, `M7 check moved from pricing to service after
   overlap loop: KILLED`, then `reverted-ok` and the suite OK again.
5. Its handback says: "The 30-night tests passed before the change. They protect today's pricing
   and do not prove the new check." That applies the reference's guard rule.

**Restructuring.** None. The final diff against main outside `.mstack` is `pricing.py | 5 +++++`
plus three test files with lines added only (`git diff tests` removed 0 lines). It reported the
`Booking.overlaps` bug and left it unfixed.

**Slicing.** All 15 tests came before the single code change. N-7 has the assessment.

**`no active item`.** It reproduced: `added 1 max-stay-30-nights (pending)` then `no active
item`. The coordinator tried `--status active` (refused), then `--status in_progress`, and went
on. It did not stop the run. N-6 has the details.

This is one run. It shows what happened once, not a rate.

### Extra run R: the refactor playbook (for Probe C's contradiction question)

Prompt: `/mstack refactor bookings/cli.py: the book and list branches of main build the same
booking line ("#id room guest check_in..check_out total") with two copies of one format call.
Extract one helper that both branches use. Behaviour must not change: every command prints
exactly what it prints today, byte for byte.` Stream `$S/R/stream.jsonl`, success, 26 turns,
345 s.

The coordinator committed exact-output characterization tests first, then briefed the
implementer: "Seam: bookings.cli.main(argv, service, out, err). ... No new tests are needed: the
pinning tests are the proof. Do run a mutant check". The implementer did the extraction. It
killed 3 mutants (`FAILED (failures=4)`, `(failures=1)`, `(failures=4)`, then `Ran 25 tests ...
OK`), and its report says "This is a refactor with no behaviour change, so I wrote no new test."
Its `mstack ledger record` was refused by the auto-mode classifier. That is an environment
matter, not this item. This is n=1 for N-3.

### Extra run E2: a seeded item with no seams (for N-1)

`examples/notes-cli` was copied with its seeded store, `git init` and a commit. Prompt:
`/mstack implement the next pending item`, the documented demo in
`docs/wiki/How-A-Work-Item-Flows.md:153,162`. Stream `$S/E2/stream.jsonl`, success, 18 turns,
281 s.

```
[MAIN] TOOL Bash: git checkout -b feat/cli-search && mstack state set cli-search --status active 2>&1; mstack state active; ...
[MAIN]   => mstack: 'active' is not a status ... no active item
[MAIN] TOOL Bash: mstack state set cli-search --status in_progress --seam "src.cli.main(argv) with --store <tmp>/notes.json, stdout captured (TestCli.run_cli)" --seam "main() return value as exit code" ...
[MAIN]   =>   status: "pending" -> "in_progress"
[MAIN]        seams: 0 seam(s) replaced with 2
[MAIN] TEXT> Picked up item 2 `cli-search` (direct path: no sdd, no fork). Skip intake: the item already exists. ...
brief: "Seams (pre-agreed, do not ask to confirm): src.cli.main(argv) with --store <tmp>/notes.json and captured stdout (TestCli.run_cli); main() return value as exit code. ... Write the tests first and run them red for the expected reason (no 'search' subcommand), paste that output into the report, then implement."
```

The coordinator named seams itself and did not write `skip: no behaviour`. The implementer then
worked in vertical slices, each red for the expected reason and each followed by the whole suite:

```
slice 1: argparse.ArgumentError: argument command: invalid choice: 'search' (choose from 'add', 'list')   FAILED (errors=1)  -> least code (title only, case-sensitive) -> Ran 11 tests OK
slice 2: AssertionError: 'Buy BREAD' not found in ''          FAILED (failures=1) -> casefold -> OK
slice 3: AssertionError: 'groceries' not found in ''          FAILED (failures=1) -> body clause -> OK
slice 4: AssertionError: '' != 'no matches\n'                 FAILED (failures=1) -> "no matches" -> Ran 14 tests OK
mutants: M1..M8 all killed (term not casefolded, drop body clause, drop title clause, or -> and, miss exits 1, filter always true, miss prints nothing, always no matches)
```

## Probe C: the reference as text

**Executable.** Every instruction names an action the implementer can take with its tools: run,
read the failure, paste, apply and revert mutants, and `mstack decide --phase implement`. B and
E2 show each of these being done.

**Self-contained.** It names no file to open. The only paths are inside the origin comment, which
is attribution. `mstack decide` is a command.

**Coverage of the item description:**

| Item description | Where in `SKILL.md` |
|---|---|
| public interface | `:22-24` |
| seams from the item, never confirmed | `:14-18` |
| independent expected values | `:25-26` |
| vertical slices | `:34-35`, `:37-43` |
| red for the expected reason | `:38-40` |
| green, then the whole suite | `:42` |
| refactoring out of the loop, review owns it | `:48` |
| asserts what a caller observes; mocks at boundaries only | `:27-28`, `:29-30` (from tests.md, mocking.md) |
| mutant check | `:50-56` |

**Against the other files:**
- `agents/implementer.md:32-38` and `skills/implement/SKILL.md` ("fails without the change",
  "revert the change locally and watch it go red") agree with the reference and add to it.
- `bug-fix.md:11` (step 3) has the coordinator write the failing test before delegating. The reference's
  loop accepts a test that already exists and is red, so there is no conflict.
- `refactor.md` conflicts on paper only (N-3). R shows it did not bite once.
- `agents/reviewer.md` does not mention mutants or refactoring, so `:55`'s promise is unbacked
  (N-2). It does not contradict the reviewer's instructions.

**Dead weight.** `:54-56` (N-2). The rest earns its place.

**Style.** `git diff 44809a5..d13d100 -- . ':!.mstack' | rg -n '^\+.*\x{2014}'` exits 1, so no em dash
was added. The file never calls itself TDD or red-green-refactor. `tdd` appears only in the
source path inside the origin comment, and the wiki says "the red-then-green loop".

**Size.** 61 lines, 3227 bytes, about 1.7k tokens per start (N-8).

## Probe D: provenance

```
$ for f in SKILL.md tests.md mocking.md; do gh api "repos/mattpocock/skills/contents/skills/engineering/tdd/$f?ref=49dd158d1076134a641b33efb035946536778336" --jq .content | base64 -d > $S/prov/pocock_$f; cmp $S/prov/pocock_$f ~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/engineering/tdd/$f && echo "$f cache==commit"; done
SKILL.md cache==commit
tests.md cache==commit
mocking.md cache==commit
$ (installed_plugins.json) "mattpocock-skills@claude-plugins-official": ... "version": "1.3.1", "gitCommitSha": "49dd158d1076134a641b33efb035946536778336"
$ cmp ~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/LICENSE licenses/mattpocock-skills-LICENSE.txt && echo POCOCK_LICENSE_IDENTICAL
POCOCK_LICENSE_IDENTICAL
$ gh api "repos/obra/superpowers/contents/skills/test-driven-development/SKILL.md?ref=5bf4e78011075bcfc0dc295f0724994cd123ee71" --jq .content | base64 -d > sp_tdd.md     (330 lines)
$ gh api "repos/obra/superpowers/contents/LICENSE?ref=5bf4e78011075bcfc0dc295f0724994cd123ee71" --jq .content | base64 -d > sp_LICENSE
$ shasum sp_LICENSE licenses/obra-superpowers-LICENSE.txt
5f09b05242b8b94f400ae8a5b27422c489e40bbb  sp_LICENSE
5f09b05242b8b94f400ae8a5b27422c489e40bbb  /Users/romerma/Code/mstack/licenses/obra-superpowers-LICENSE.txt
$ cmp sp_LICENSE licenses/obra-superpowers-LICENSE.txt && echo IDENTICAL
IDENTICAL
$ gh api repos/obra/superpowers/commits/5bf4e78011075bcfc0dc295f0724994cd123ee71 --jq '.sha+" "+.commit.committer.date'
5bf4e78011075bcfc0dc295f0724994cd123ee71 2026-09-19T00:31:35Z Release v6.4.1 ...
```

The header names the right files at the right commits, and both licences match byte for byte.

**Is "adapted" fair?** Yes. The closest passages:
- `` `expect(add(a, b)).toBe(a + b)` `` is copied verbatim from Pocock's SKILL.md "Tautological"
  bullet. It is one short example, covered by the header and the MIT notice.
- `:25-26` "a literal or a worked example from the spec" condenses Pocock's "a known-good
  literal, a worked example, the spec".
- `:34-35` "tests written in bulk check an imagined shape" condenses "Bulk tests verify
  _imagined_ behavior: you test the _shape_ of things".
- `:38-40` reworks superpowers' "Fails because feature missing (not typos)" and "Test errors?
  Fix error, re-run".
- `:45` "A test that passed the first time it ran has proved nothing" reworks "Tests written
  after pass immediately, which proves nothing".

Everything else is rewritten or new: the seams inversion, `decide`, guard versus coverage, and
the mutants section.

**Derived text without a header.** The `feature.md` step and the implementer lines share only
the two-word term "pre-agreed" with Pocock's "Test only at pre-agreed seams", and they invert its
meaning (no confirmation). That needs no header.

## Probe E: wiring and docs

- `feature.md`: the new step 4 sits before "5. Delegate implementation", and steps 5 to 8 are
  renumbered. A stale-reference search
  (`rg -n -i 'feature(\.md)?[^\n]{0,40}step [0-9]|step [0-9][^\n]{0,30}feature' skills/ agents/ docs/ README.md hooks/ src/ tests/ CONTRIBUTING.md`)
  finds only `docs/research/pstack-port.md:63,122`, which cite pstack's own feature.md by URL.
- Router Delegation, `skills/router/SKILL.md:77`: "the item's seams (pre-agreed)". Present.
- Docs agree with the files. `docs/wiki/The-Agents.md:133` describes `skills: [test-first]`.
  `docs/wiki/Skills-and-Playbooks.md:20-23` and `:136`, and `README.md:94` and `:483-484`, match.
  `docs/wiki/The-CLI.md`'s transcript counts (35 files, 19 skills and agents, 40 files) match my
  lint run. `README.md:130` "The thirteen skills" is the command list, so it is consistent. Nits
  are in N-9. The `CHANGELOG.md` entry says what shipped and matches A1 and A2.
- Lint accepts `user-invocable` for a real reason: it is in `SKILL_KEYS` (`src/lint.ts:27`), and
  `skills` is in `AGENT_KEYS` (`src/lint.ts:52`). It does not resolve entries. In the clone
  `$S/clone-lint`:

```
$ (agents/implementer.md: "  - test-first" -> "  - test-frist") mstack lint-plugin . | rg 'implementer|PASSED|FAILED|fail'
28:[ok]    agents/implementer.md
50:PASSED - 0 failures, 0 warnings
$ (skills/test-first/SKILL.md: + "disable-model-invocation: true") mstack lint-plugin . | rg 'test-first|PASSED|FAILED|fail'
11:[ok]    skills/test-first/SKILL.md (63 lines, 155 description chars)
50:PASSED - 0 failures, 0 warnings
```

  This calls for a lint rule (N-5), not a blocker.

## Probe F: regression on the head (suite run alone, before any live run)

```
$ npm test
 542 pass
 0 fail
Ran 542 tests across 26 files. [96.56s]
ℹ tests 542
ℹ pass 542
ℹ fail 0
exit 0
$ bun run typecheck
$ bunx --bun tsc --noEmit
typecheck exit 0
$ ./bin/mstack lint-plugin .
[ok]    skills/test-first/SKILL.md (62 lines, 155 description chars)
[ok]    agents/implementer.md
[ok]    19 skills and agents, every cross-reference in 40 file(s) resolves
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate
[ok]    one active item: test-first-reference (reviewing)
[ok]    working tree is clean
PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate --full          (after the live runs ended; verify = npm test && npm run typecheck && bin/mstack lint-plugin .)
 542 pass / 0 fail / Ran 542 tests across 26 files. [101.57s]
ℹ pass 542
ℹ fail 0
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
gate --full exit 0
```

`tests/costs.test.ts:698` and `tests/run.test.ts:239` passed both times. No test was changed by
this diff, and no code changed (`git diff --stat` lists only markdown files).

## Acceptance, quoted

**"an internal skill with user-invocable: false holds the test-first reference, self-contained in
its SKILL.md, with origin headers"**: met. `skills/test-first/SKILL.md:1-7` has the frontmatter
and the origin comment. Probe C covers self-containment, Probe D the provenance, and A4 shows the
skill is hidden from slash commands (main-session auto-invocation is documented, N-4).

**"the implementer has that text in context when it starts: a subagent quotes a sentence from it
without reading files. If skills: preload does not inject for plugin agents (claude-code issue
25834), a SubagentStart hook matched to the implementer delivers it and the failed attempt is
recorded"**: met. In A1 the implementer gave all five headings and two position-chosen sentences
verbatim with `tool_uses: 0`. In A2 the control without the field replied `NO REFERENCE IN
CONTEXT`. The preload works, so the hook branch does not apply.

**"feature.md names a test-first step before delegation, and the implementer brief declares the
item's seams as pre-agreed"**: met. The step is at `feature.md:15-20`. The B and E2 briefs both
carry "pre-agreed ... do not ask to confirm" and red-first, and the implementers followed them.
N-1 notes that the step's command pointer is wrong.

**"lint-plugin and both suites green"**: met. Probe F.

| # | Criterion | Evidence | Rung |
|---|---|---|---|
| 1 | internal skill, `user-invocable: false`, self-contained, origin header | file read (2); lint and licence/source byte checks run (4); slash-command absence seen in the init event (5) | 4 (5 for the hiding) |
| 2 | text in the implementer's context at start, quoted without reading | A1 verbatim quotes with `tool_uses: 0`, A2 control negative, reviewer negative; claude 2.1.326, one run each | 5 |
| 3 | feature.md test-first step before delegation; brief declares seams pre-agreed | step read (2); B and E2 briefs and implementer behaviour in live runs, n=1 each | 5 (n=1) |
| 4 | lint-plugin and both suites green | `npm test` 542/542 on bun and node, typecheck, lint, gate, `gate --full` | 4 |

## Ledger

`./bin/mstack ledger check test-first-reference` before recording:
`FAIL no verdict at d13d1006; 1 row(s) exist at other SHAs and a new head SHA voids them`.
I record `live-verified` at `d13d10064fee30e116210a4f879903dfc43f8775` with `--verifier
reviewer`, because criterion 2, the one that carries the item, was shown in the running system
with a control.
