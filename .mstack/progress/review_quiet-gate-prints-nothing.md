# Review - quiet-gate-prints-nothing

**Verdict:** CHANGES_REQUESTED

Item 16, branch `fix/quiet-gate-prints-nothing`, head `7493037`. I did not write this code.
The code and the tests are sound and I could not break them. Everything below is documentation
accuracy plus the ledger, and every one of them is a text edit.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| quiet prints one line per failure, `[fail]  <message> -> <fix>` | `tests/gate.test.ts:297` "quiet prints every failure with its fix, on stderr, and nothing else" | `deepEqual` on the two exact lines. Red against `main:src/report.ts` (4 of 6 new tests red, reproduced below); killed by my M1, M3, M7 |
| the stream is stderr, not stdout | `tests/gate.test.ts:297` (`out === ""`), `tests/cli.test.ts:471` (real fds), `tests/cli.test.ts:506` (`JSON.parse(stdout)` and `stdout.trimEnd() === JSON.stringify(parsed)`) | my M2 (write to stdout instead) killed by all four falsifiable tests |
| a passing gate prints zero bytes | `tests/gate.test.ts:325` | cannot go red against `main` — preservation. Killed by my M5, M6, M7 |
| a warning-only gate prints zero bytes | `tests/gate.test.ts:342` | cannot go red against `main` — preservation. Killed by my M4, M4b, M5, M6, M7 |
| the Stop hook keeps stdout parseable | `tests/hooks.test.ts:130`, `tests/cli.test.ts:506` | both red against `main`; `tests/hooks.test.ts:162` strengthened from `=== null` to both streams empty |
| no non-quiet output changed | `tests/cli.test.ts:486-494` runs the same store without the flag and pins `-- store`, `[ok]`, the `fix:` continuation and `FAILED - 1 failure` | the non-quiet branch of `Report#fail` is byte-identical in the diff |

## Acceptance, quoted

**"'gate --quiet' on a failing gate prints the failures, and nothing else, matching what The-CLI page promises"**
Met for the fast gate. `src/report.ts:72-83` renders `[fail]  <message> -> <fix>` through `emit()`
(`src/report.ts:26-28`) and returns before any other writer. Pinned byte-for-byte at
`tests/gate.test.ts:297` and, through the shipped binary with real file descriptors, at
`tests/cli.test.ts:471`. I reproduced `docs/wiki/The-CLI.md:55-58` verbatim in a scratch store.
**Qualified:** "and nothing else" is false for `mstack gate --full --quiet`, which writes the
verify command's output to **stdout** (`src/gate.ts:389`, `stdio: "inherit"`). Reproduced below.
Pre-existing, not introduced here — but the new prose at `docs/wiki/The-CLI.md:63-64` states the
absolute two lines after naming `--full`. See finding 4.

**"'gate --quiet' on a passing gate still prints nothing, so wiring it to a hook stays cheap"**
Met. `tests/gate.test.ts:325` uses the new `quiesce()` (`tests/helpers.ts:88`) to get a fixture
with `warnings.length === 0` — without it this test and the warning-only test would be the same
test twice — then asserts both streams empty. Through the binary at `tests/cli.test.ts:496-500`
(`green.stdout + green.stderr === ""`, exit 0). I reproduced the green transcript at
`docs/wiki/The-CLI.md:83-94` verbatim.

**"The Stop hook's output on a red gate is shown from a real run, in the item's report and wherever the docs describe that hook"**
Met in substance, and the transcripts are real — I re-ran the exact command from
`docs/wiki/Gates-and-Hooks.md:29` and got byte-identical output. It is met **against wording that
is wrong**: `docs/wiki/Gates-and-Hooks.md:20` and `:38-41` describe the pre-fix world in terms the
item's own corrected description says were verified false, and assert a client behaviour the
implementation report itself marks rung 2. Findings 1 and 2.
`README.md:166` also describes this hook and was not touched; nothing in it is now false, so I do
not count it against the bullet, but naming it is fairer than silence.

**"Tests cover the failing case, the passing case, and the warning-only case"**
Met. `tests/gate.test.ts:297` (failing), `:325` (passing), `:342` (warning-only), plus
`tests/hooks.test.ts:130`/`:162` and `tests/cli.test.ts:471`/`:506`. The implementer's own claim
that two of the six cannot go red against `main` is correct and I verified the substitute
argument myself — the mutation table below is mine, not theirs.

## Verification I ran

```console
$ ./bin/mstack gate --full        # streams captured separately
EXIT=0
...
PASSED - 0 failures, 0 warnings
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .

PASSED - 0 failures, 0 warnings
```
(stderr held only bun's own `202 pass / 0 fail / Ran 202 tests across 13 files` lines.)

```console
$ npm test                        # the item's verification field
 202 pass   0 fail   Ran 202 tests across 13 files. [15.38s]     (bun)
ℹ tests 202  ℹ pass 202  ℹ fail 0  ℹ duration_ms 5311.9          (node v26.7.0)

$ npm run typecheck
> bunx --bun tsc --noEmit
(clean, exit 0)

$ ./bin/mstack lint-plugin .
PASSED - 0 failures, 0 warnings
```

```console
$ git rev-parse HEAD
74930373bf41e0f51f968de71c51bc286d01b9e8
$ ./bin/mstack ledger check quiet-gate-prints-nothing
FAIL no verdict at 74930373; 1 row(s) exist at other SHAs and a new head SHA voids them
```

### The new tests against `main:src/report.ts`

Isolated copy of the checkout (`git archive HEAD`), sha256 of `src/report.ts` confirmed
`696ff6e2...79d0a3` — the same pristine hash the implementer reports — then `main`'s file swapped
in and restored, hash re-verified.

```console
not ok 18 - gate --quiet prints its failures on stderr and leaves stdout empty
not ok 19 - hook stop keeps its JSON on stdout and the gate's failures on stderr
not ok 37 - quiet prints every failure with its fix, on stderr, and nothing else
not ok 61 - Stop puts the gate's failures on stderr while its JSON stays clean
# pass 70
# fail 4
```

Four red, two green. The two green are the preservation requirements, exactly as claimed.

### My own mutations, to settle whether the two preservation tests bite

Driver in the isolated copy, byte copy restored and sha256 re-verified after each. Baseline with
no mutation run first and confirmed 0 failures, so the harness itself is falsifiable.

```console
pristine sha256 696ff6e2fdf432cf32b1a43af484b422bb02257e7a5fbe45c24f59d1dc79d0a3

SURVIVED M0 BASELINE (no mutation)
KILLED   M1 the original defect: quiet prints nothing at all            (4 tests)
KILLED   M2 quiet prints its failures to stdout instead of stderr       (4 tests)
KILLED   M3 quiet drops the fix and prints the message alone            (4 tests)
KILLED   M4 quiet also prints warnings (stdout)
         by: warnings alone print nothing in quiet mode, and do not turn the gate red
         by: Stop is silent when the gate is green                      (+4)
KILLED   M4b quiet prints warnings on stderr        [not in the implementer's set]
         by: warnings alone print nothing in quiet mode, and do not turn the gate red
         by: Stop is silent when the gate is green                      (+4)
KILLED   M5 quiet keeps the FAILED/PASSED summary
         by: a green gate in quiet mode prints exactly nothing, on either stream
         by: warnings alone print nothing in quiet mode, and do not turn the gate red (+5)
KILLED   M6 quiet also prints the [ok] lines
         by: a green gate in quiet mode prints exactly nothing, on either stream
         by: warnings alone print nothing in quiet mode, and do not turn the gate red (+5)
KILLED   M7 quiet also prints section headers       [not in the implementer's set]
         by: a green gate in quiet mode prints exactly nothing, on either stream
         by: warnings alone print nothing in quiet mode, and do not turn the gate red (+5)
final sha256 696ff6e2fdf432cf32b1a43af484b422bb02257e7a5fbe45c24f59d1dc79d0a3
```

**The reasoning is correct, and this is not the sixth non-falsifiable check.** `tests/gate.test.ts:325`
is killed by M5, M6 and M7; `tests/gate.test.ts:342` by M4, M4b, M5, M6 and M7. M4 correctly does
*not* kill `:325`, because `quiesce()` leaves that fixture with zero warnings — which is the whole
reason `quiesce()` exists rather than the two tests being one test run twice. Both preservation
tests have a mutation that only they catch (M4/M4b for `:342`), so neither is carried by a sibling.

### Docs transcripts, re-run rather than read (CONTRIBUTING.md:43-46)

Scratch repo, branch `feat/greet-flag`, item 1 `greet-flag` in_progress, `current.md` untouched.

```console
$ mstack gate --quiet; echo $?
[fail]  1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start
1

$ mstack gate --quiet 2>/dev/null | wc -c
       0

$ echo '{"hook_event_name":"Stop","cwd":"'$PWD'"}' | mstack hook stop
[fail]  1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- 1 greet-flag (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start"}}
(exit 0)
```

Then checkpoint written, committed, three files touched:

```console
$ mstack gate --quiet; echo $?
0

$ mstack gate | tail -6

-- workspace
[ok]    on branch feat/greet-flag
[warn]  3 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 1 warning
```

All three blocks in `docs/wiki/The-CLI.md` and the one in `docs/wiki/Gates-and-Hooks.md` reproduce
byte for byte. **No stale transcripts.** `mstack help` also still matches `docs/wiki/The-CLI.md:12`,
and the new usage line at `src/cli.ts:33-34` prints.

### `gate --full --quiet` leaks to stdout

```console
$ mstack gate --full --quiet 2>/dev/null
VERIFY-STDOUT-CANARY
$ mstack gate --full --quiet 2>&1 1>/dev/null
[fail]  1 export-json (in_progress) is active but progress/current.md is not: ...
```

### Where each caller went

`src/fanout.ts`, `src/lint.ts`, `src/setup.ts`, `src/mergegate.ts` and `src/hooks.ts` are untouched
by this branch (`git diff main...HEAD --stat` on those paths is empty) and the only `new Report`
that ever passes `quiet` is `src/gate.ts:43`. The non-quiet branch of `fail()` is byte-identical,
so every other caller's stdout is unchanged. `bin/mstack` `exec`s and redirects nothing.
No consumer in the repository parses `mstack gate --quiet` stdout; the only two consumers are
`cmdGate` (exit code, `src/cli.ts:169-179`) and `stop()` (`report.failures`, `src/hooks.ts:172-178`),
and `src/cli.ts:846` still puts hook output on stdout alone. The `[fail]  security ...` noise in the
suite output comes from `src/fanout.ts:105` building a non-quiet `Report` and is present on `main`.

### The `run()` swap in `tests/cli.test.ts`

`execFileSync` → `spawnSync` (`tests/cli.test.ts:24-35`). I checked every one of the ~35 call sites.
No assertion was weakened:

- The old helper returned `stderr: ""` on exit 0 unconditionally, so the swap can only *add*
  observable output. Every pre-existing `.stderr` assertion (`:57`, `:69`, `:79`, `:188`, `:225`,
  `:239`, `:253`, `:271`, `:295`, `:308`, `:316`, `:551`) is on a non-zero exit, where the old
  path already produced real stderr. Nothing passes for a new reason.
- The `assert.equal(x.code, 0, x.stderr)` idiom (12 sites) previously interpolated `""` into the
  failure message and now interpolates the real diagnostic. Strictly better, and it cannot mask.
- Exit semantics match: `result.status ?? 1` reproduces the old `e.status ?? 1`, and a signal kill
  is 1 in both.
- Stdin is the one real change: `stdio: ["ignore","pipe","pipe"]` became a pipe closed immediately.
  I checked it does not hang — `spawnSync(BIN, ["hook","stop"])` with no `input` returned in 78ms,
  status 0, both streams empty.

## Changes required

1. **`docs/wiki/Gates-and-Hooks.md:38-40`** ships the framing the item's own corrected description
   says was verified false. It reads "a red gate at session close came down to an exit code nobody
   displays." `git show main:src/hooks.ts:167-178` shows `stop()` on `main` already composed
   `report.failures` into `additionalContext`, so the model always received them — and the same
   page states that behaviour ten lines above, at `:20`. **The correction in `.mstack/state.json`
   item 16 is right and this page contradicts it.** What is true: the failures always reached the
   model; what nobody received was human-visible output on a stream. The same sentence lives in
   three more places and should move with it: `src/report.ts:68-70`, `tests/gate.test.ts:292`,
   `.mstack/progress/current.md:24` (the Plan section, still uncorrected while the item's
   `description` was fixed in `7493037`).

2. **`docs/wiki/Gates-and-Hooks.md:20`** states as fact the single claim the implementation report
   marks rung 2: "The failures also go to stderr, so the session shows them rather than only an
   exit code." The report's own ladder table puts "Claude Code renders a hook's stderr in the
   transcript at exit 0" at **rung 2, not verified**. The docs state it flatly, and it is the
   sentence that makes the fix sound like it reaches a human. I could not settle it either — a
   headless `claude -p` run with a canary Stop hook was refused ("Credit balance is too low"), so
   the claim stays unverified from here too. What I did get to **rung 3**: reading the exit-0 hook
   branch in the shipped client (`/Users/romerma/.local/bin/claude`, 2.1.238), the rendered
   `content` for a successful hook is derived from **stdout** —
   `if(me.status===0){...let Ne=await gTt(me.stdout.trim(),oe,"stdout");yield{message:gc({type:"hook_success",...,content:Ne,stdout:me.stdout,stderr:me.stderr,...})}}`
   — with stderr carried as a sibling field, not as the content. So the honest reading is the
   opposite of the doc's confidence. **The implementer's caveat is honestly placed; the docs
   overrode it.** Fix: say what is verified (the bytes reach fd 2 of the hook process, and stdout
   stays a single parseable object) and mark the surfacing as the client's behaviour, the way the
   report does. This is the finding I would not waive: it is the one sentence that decides whether
   this fix reaches anyone, and it is asserted without evidence.

3. **No ledger verdict at head.** `./bin/mstack ledger check quiet-gate-prints-nothing` at
   `74930373` returns `FAIL no verdict at 74930373; 1 row(s) exist at other SHAs and a new head SHA
   voids them`. The only row is the implementer's, keyed to `2ebd5c5`, and `3c0db43` and `7493037`
   landed after it. The item cannot close until a reviewer row exists at the head SHA, and it must
   not be the implementer's row re-pointed.

4. **`docs/wiki/The-CLI.md:63-64` and `:73-76` overstate.** "`--quiet` prints one line per failure
   and nothing else" and "leaves stdout free for a hook's structured output" are both false under
   `--full`, which `:60-61` names two lines earlier. `src/gate.ts:389` runs the verify command with
   `stdio: "inherit"`, so its output goes to the terminal's stdout regardless of `quiet`; I
   reproduced `VERIFY-STDOUT-CANARY` on stdout above. Pre-existing, not introduced here — but the
   new prose makes it an absolute, and the decision row
   `2026-08-21T10:23:55.039Z` promises "hook JSON on stdout stays byte-identical and
   JSON.parse-able", which stops being true the moment item 14 puts `--full` in the Stop hook.
   Scope the sentence to the fast gate and record the `--full` stdio question as item 14's, or
   `--full` will land on top of a guarantee that no longer holds.

## The five design decisions, judged

- **stderr as the stream** (`2026-08-21T10:23:55.039Z`). **Correct, and the only one with a real
  consequence.** stdout genuinely is the hook's structured channel — `src/cli.ts:846` writes the
  hook output there and nothing else — and `tests/cli.test.ts:513-515` pins it with
  `stdout.trimEnd() === JSON.stringify(parsed)`, which no amount of prefix text survives. The
  `state active` precedent is real (`docs/wiki/The-CLI.md:119`). The caveat about what the client
  does with fd 2 belongs to the decision, not against it — but see finding 2 for where it was
  dropped.
- **the fix on the same line** (`10:24:09.935Z`). **Correct.** It makes the stderr line and the
  `additionalContext` bullet the same bytes, which `tests/hooks.test.ts:139-142` asserts by
  checking every stderr line appears in the context. That is a real invariant, not a preference,
  and it is now enforced.
- **no summary count** (`10:24:09.964Z`). **Correct and cheap.** The exit code carries pass/fail
  and criterion 1 says "nothing else". Killed by my M5, so it is a decision with a test behind it.
- **silence on warnings** (`10:24:09.992Z`). **Correct.** The evidence is concrete: the two
  commonest warnings here are mid-session states, and the hook fires every turn. `report.warnings`
  is still there for a caller who wants them. Killed by M4 and M4b.
- **no colour** (`10:24:10.016Z`). **Correct, and it fixes a latent bug in passing:**
  `src/report.ts:7` derives `useColor` from `process.stdout.isTTY`, which is the wrong stream for
  stderr output. Refusing colour sidesteps it rather than fixing it; that is the right call for
  this item, but `useColor` remains keyed to the wrong fd for anything that later wants colour on
  stderr.

All five were recorded at `10:23:55Z`–`10:24:10Z`, six minutes before the fix commit `40c37cf`
(`12:30:25+02:00`), so "recorded before the code was written" is true.

## Minor

1. `.mstack/progress/current.md:24` — the Plan still says the pre-correction sentence. The item's
   `description` was corrected in `7493037`; the checkpoint that a resuming session reads first was
   not.
2. `.mstack/progress/impl_quiet-gate-prints-nothing.md:53-54` cites the decision rows as
   "`2026-08-21T13:2*`". They are at `10:23:55.039Z` and `10:24:*Z`; `13:2*` is neither UTC nor
   local (+02:00). A reader grepping for `13:2` finds nothing.
3. `tests/helpers.ts:109-110,126-127` — `captured()` saves `process.stdout.write.bind(...)` and
   restores the bound copy, so after the first call the property is no longer the original
   function object. Harmless for this suite; save the unbound reference and it stays exact.
4. `tests/cli.test.ts:29-34` — `spawnSync`'s `result.error` is discarded, so a spawn failure (a
   moved `bin/mstack`) now reads as exit 1 with two empty streams instead of throwing. One line,
   `if (result.error) throw result.error`, restores the old loudness without touching anything else.
5. `tests/helpers.ts:111-112` — the `console.log` stand-in is `args.join(" ")`, not `util.format`.
   Fine for every current caller (all pass one string), but a future `console.log("%s", x)` would be
   captured wrong and the assertion would read as a product bug.
6. `README.md:166` describes the `Stop` hook and was not updated. Nothing in it is false; noting it
   only because criterion 3 says "wherever the docs describe that hook".

## Where my claims stopped on the ladder

| Claim | Rung |
|---|---|
| `gate --quiet` prints the failure lines on stderr and nothing on stdout | **5** — shipped `bin/mstack` in scratch stores, streams split |
| `hook stop` keeps stdout a single parseable object with the fix in place | **5** — real process, real JSON on stdin |
| every docs transcript reproduces byte for byte | **5** — re-ran all four command blocks |
| `gate --full --quiet` writes verify output to stdout | **5** — canary reproduced |
| `main`'s Stop hook already carried the failures to the model | **5** — read `main:src/hooks.ts:167-178` and the pre-fix transcript in the report; the correction in the item description is **right** |
| the two preservation tests bite | **4** — 8 mutations of my own, baseline confirmed falsifiable, restores sha256-verified |
| 4 of 6 new tests red against `main:src/report.ts` | **4** — swap and restore in an isolated copy |
| both runtimes green, types and plugin lint clean | **4** — `npm test`, `npm run typecheck`, `lint-plugin` run here |
| no caller's stream moved | **3** — read every `new Report` site and the diff; no test exercises fanout/lint/setup stdout as a stream |
| Claude Code renders a hook's stderr at exit 0 | **3, and it is the weak point** — read the exit-0 branch of the shipped client binary; the rendered content comes from stdout. A live run was refused for credit, so nobody in this pass got to 4 |

## Separately: `which mstack` resolves to the installed plugin, not the checkout

Reproduced at rung 5, and my judgement is **worth its own item**, not just a `CONTRIBUTING` line.

```console
$ which -a mstack
/Users/romerma/.claude/plugins/cache/mstack/mstack/0.1.0/bin/mstack

$ /Users/romerma/.claude/plugins/cache/mstack/mstack/0.1.0/bin/mstack help | rg "state set"
  state set <ref> --status S [...]    move an item
```

That is the pre-item-13 usage line — no `--clear`, no `--description` — so the copy on `PATH` is
older than `main`. Three reasons it is an item and not a note:

1. **It collides with this repository's own docs rule.** `CONTRIBUTING.md:43-46` says pasted output
   comes from real runs, and the wiki blocks are written as `$ mstack gate --quiet`. A contributor
   who validates those transcripts with the `mstack` on `PATH` gets 0.1.0 and the transcript does
   not reproduce — for a reason that has nothing to do with the transcript. I only got the four
   reproductions above by driving the absolute path to this checkout's `bin/mstack`.
2. **The failure is silent in the direction that matters.** Your `state set --description` case was
   loud ("Unknown option"). The dangerous case is the opposite: a *gate* change that the cached
   0.1.0 gate does not implement, run against the new store, reporting green. That is the same
   shape as every defect this queue has caught — a check that passes for the wrong reason.
3. **There is nothing to diagnose it with.** `mstack` has no `--version` and `mstack help` prints
   no resolved root, so the only way to find out which copy answered is `which`.

So: a `CONTRIBUTING.md` line under "Development" naming the trap and the `./bin/mstack` habit is
the immediate half, and it is not enough on its own. The item is the guard — `mstack --version`
printing the resolved root, or the gate warning when the `mstack` on `PATH` resolves outside the
store's repository. That is design work with a user-visible outcome, which makes it an item with an
acceptance bullet, not a doc edit. Not fixed here.
