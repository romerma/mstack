# Review - quiet-gate-prints-nothing (round 2)

**Verdict:** APPROVED

Closure check against head `63d6c9e64bd041687b282a52eee54d44fb92a8ad`. Round 1 is at
`.mstack/progress/review_quiet-gate-prints-nothing.md` (CHANGES_REQUESTED, four findings).
**This approval is keyed to that SHA.** Any further commit voids it and needs a fresh pass;
that is the same rebase hazard the ledger exists to catch.

Scope as briefed: did the four findings close, and did closing them break anything. I re-ran
everything rather than reading the round-2 report's numbers.

## Did anything break

| Check | Result |
|---|---|
| `./bin/mstack gate --full` | exit 0, `PASSED - 0 failures, 0 warnings` |
| `npm test` | 203 pass / 0 fail on bun, 203 pass / 0 fail on node v26.7.0 |
| `npm run typecheck` | clean |
| `./bin/mstack lint-plugin .` | `PASSED - 0 failures, 0 warnings` |
| `node scripts/check-doc-links.mjs README.md docs/wiki/*.md` | 57 links, 0 broken |
| assertions removed or loosened in `tests/` this round | none — `git diff 7493037..HEAD -- tests/ \| rg "^-\s*assert"` is empty |
| product code changed | none. Every changed line under `src/` is a comment line, checked mechanically, not by eye |
| dependencies | `package.json` and `plugin.json` untouched; the one new import is `node:util`, a builtin, and it is in `tests/` |
| `tests/hooks.test.ts` | untouched this round |

The coordinator's "no product code changed" holds under a mechanical check, not just a claim.

## Finding 1 — the false framing. **Closed in every shipped artefact.**

Independent grep across the repository, not only the four places I named:

```console
$ rg --hidden -g '!.git' -g '!node_modules' -g '!*.jsonl' \
    "no words|nobody displays|only signal|silent by construction|reached nobody|nobody received" .
.mstack/state.json:253                                   <- the correction itself, quoting the error
.mstack/progress/impl_quiet-gate-prints-nothing.md:11    <- residue, see minor 1
.mstack/progress/history.md:165                          <- append-only, see minor 2
tests/statusline.test.ts:17                              <- unrelated ("the only signal this file exists for")
.mstack/progress/review_readme-and-wiki_facts.md:83      <- unrelated ("no words changed")
```

**Zero occurrences in `docs/`, `src/` or `tests/`.** The corrections read true against the
evidence: `src/report.ts:68-73`, `tests/gate.test.ts:291-295`, `docs/wiki/Gates-and-Hooks.md:39-43`
and `.mstack/progress/current.md:23-26` now all say the model always had the failures and the
streams were empty, which is what `git show main:src/hooks.ts` (lines 167-178) shows.

The fifth site the implementer found on its own — `tests/cli.test.ts:528`, an assertion message
reading "the human watching the session sees the failure, not just an exit code" — was a real
one I missed, and it was the same overclaim as finding 2 hiding inside a test. It now reads
"the failure reaches fd 2 of the hook process; what the client renders is the client's business."
That is the correct wording and I would not have caught it from the diff alone.

## Finding 2 — **closed, and it went two rungs past where I stopped.**

### Is the `SessionStart`-for-`Stop` substitution sound? **Yes, for the claim actually made.**

It rests on my round-1 read that the exit-0 branch is shared across hook events, so I went back
to the shipped binary (`/Users/romerma/.local/bin/claude`, 2.1.238) and tested that inference
three ways rather than re-reading the same line:

1. **The spawn is event-independent.** In the hook runner `UGi(...)`, the child is created by
   the same `FGi.spawn(...)` call regardless of event. The only place the event name changes the
   spawn is `if(!w&&(t==="SessionStart"||t==="Setup"||t==="CwdChanged"||t==="FileChanged")&&c!==void 0)F.CLAUDE_ENV_FILE=...`
   — an environment variable, not stdio. Capture is done by a shared reader (`NXo(J,a,D,z)`).
2. **No per-event branch precedes the exit-0 handling.** I extracted the 3000 characters
   immediately preceding `if(me.status===0){Gq(` and grepped it for any hook-event comparison:

   ```console
   $ rg -o 'f==="[A-Za-z]+"|t==="[A-Za-z]+"|hookEvent==="[A-Za-z]+"' region.txt | sort | uniq -c
   (no matches)
   ```

   Every `f===` event test in that function is inside an **exit-2** branch
   (`if(me.status===2&&(f==="Stop"||f==="SubagentStop"||...))`). The exit-0 path has none.
3. **The record the canary produced is emitted from that shared path.** `Gq({hookId, hookName,
   hookEvent, output, stdout, stderr, exitCode, outcome})` is called identically in the
   `status===0` branch, which is why the quoted `hook_response` carries `stdout` and `stderr` as
   separate fields.

So for **capture and the stream split** — which is all the docs now claim — the substitution is
sound and I would have accepted it as evidence had I produced it myself.

It would **not** be sound for display, and the implementer did not use it for display. Evidence
I can add that sharpens this in the docs' favour: the `Stop` event's renderer is
`stop_hook_summary`, and its component destructures exactly
`{hookCount, hookInfos, hookErrors, hookAdditionalContext, preventedContinuation, stopReason}` —
**no `stdout`, no `stderr`**. For the Stop path the summary row never receives the field at all.
That does not make any current sentence wrong; it means the refusal to claim display is not
merely cautious, it is probably the correct answer. Recording it so the next pass does not have
to re-derive it.

### Is the three-audience table honest, and did any sentence creep back past it?

The table at `.mstack/progress/impl_quiet-gate-prints-nothing.md` — CLI user "yes, and this is
new"; model "yes, and it always was, this fix adds nothing here"; session watcher "captured,
display unverified" — is accurate on every row, and rows 1 and 2 I verified myself at rung 5 in
round 1 and again here. Saying plainly that the fix "adds nothing" for the model is the sentence
a flattering report would not contain.

I checked every doc sentence that could have crept back:

- `docs/wiki/Gates-and-Hooks.md:20` — "captures as its own field — what it does with that field
  is the client's business, not this plugin's". Matches the evidence exactly. The round-1
  sentence "so the session shows them" is gone.
- `docs/wiki/Gates-and-Hooks.md:47-74` — the new section states capture as measured and display
  as unverified, and discloses the `SessionStart` substitution and why, in the page itself
  rather than only in the report. That disclosure is the right call: a reader of the transcript
  can see what was and was not run.
- `README.md:166` — "The failures go into that feedback, and onto the hook's stderr." No display
  claim.
- `docs/wiki/The-CLI.md:66-67` — see minor 3. Not a display claim, but the loosest wording left.

**No claim outruns its evidence.**

## Finding 4 — **closed, scoped, and made executable.**

Reproduced the canary myself against the shipped binary, byte-for-byte against
`docs/wiki/The-CLI.md:83-91`:

```console
$ mstack gate --full --quiet 2>/dev/null; echo "exit $?"      # stdout only
VERIFY-STDOUT-CANARY
exit 1

$ mstack gate --full --quiet 2>&1 1>/dev/null; echo "exit $?" # stderr only
[fail]  1 export-json (in_progress) is active but progress/current.md is not: the Item line still says _none_; Next step is still the empty template -> if this session dies now, nothing tells the next one where to start
exit 1
```

`docs/wiki/The-CLI.md:63` and `:69` are now scoped to the fast gate, `:96-97` states the boundary
as a rule, and `docs/wiki/Gates-and-Hooks.md:247-254` says the same where `--full` is described.
The decision row `2026-08-21T10:23:55.039Z` is superseded by `2026-08-21T11:16:06.989Z` rather
than edited, which is the right handling for an append-only file and matches how
`10:01:59.983Z` superseded `09:10:57.329Z` earlier in the same file.

### Is a characterization test the right instrument here?

**Yes.** The alternative instruments are both worse: prose in a wiki page cannot go red, and
changing the behaviour now would be item 14's design decision taken by item 16 without the fork
being put to anyone. A test that pins today's behaviour is exactly what converts "someone should
remember this" into "item 14 cannot change this by accident."

I confirmed it bites, on three separate axes, with my own driver — baseline first, byte copies of
both files, sha256 verified after every restore:

```console
pristine gate   4a1ff309b30b9597074122e8b93a9a21f98dd4324260d05556fe3605d98fa370
pristine report 3e38b57864bc0d952a1ad52455e2328ddf6c3dfe3c2700fab8250a51888229a1

SURVIVED N0 BASELINE (no mutation)          <- the harness is falsifiable
KILLED   N1  --full captures the verify command's stdio instead of inheriting it
         by: --full lets the verify command's output onto stdout, quiet or not
KILLED   N2  --full stops running the verify command at all
         by: --full lets the verify command's output onto stdout, quiet or not
KILLED   N5b --full quietly drops quiet, so the gate's lines land on stdout
         by: --full lets the verify command's output onto stdout, quiet or not
KILLED   N3  regression: quiet prints nothing at all, as before the fix        (5 tests)
KILLED   N4  regression: quiet writes to stdout instead of stderr             (5 tests)

final gate   4a1ff309... == pristine
final report 3e38b578... == pristine
```

N5b is mine and was not in the implementer's set: it makes `--full` silently drop `quiet`, and
the new test catches it through the `!full.stdout.includes("[fail]")` assertion. So the test pins
the boundary in both directions, not only the subprocess half. The two pristine hashes also match
the ones the round-2 report quotes, so its driver ran against the committed files.

One qualification, recorded as minor 4 rather than a change: the test mixes one assertion that
**should** change under item 14 with four that should not.

## Finding 3 — still open, and it is the only thing left

```console
$ git rev-parse HEAD
63d6c9e64bd041687b282a52eee54d44fb92a8ad
$ ./bin/mstack ledger check quiet-gate-prints-nothing
FAIL no verdict at 63d6c9e6; 1 row(s) exist at other SHAs and a new head SHA voids them
```

The only row is still the implementer's `live-verified` at `2ebd5c5`, four commits behind head.
The coordinator owns recording the reviewer row; this report is the evidence for it. The row must
be keyed to `63d6c9e6` and carry a reviewer verifier, or `src/gate.ts`'s self-close check will
refuse the item — correctly.

## Acceptance, re-checked at head

**"'gate --quiet' on a failing gate prints the failures, and nothing else, matching what The-CLI page promises"**
Holds, and the round-1 qualification is now resolved rather than waived: the page promises it of
the fast gate and shows the `--full` exception, and `tests/cli.test.ts:552` makes the boundary
executable. Reproduced `docs/wiki/The-CLI.md:55-57` byte-for-byte in a fresh scratch store at head.

**"'gate --quiet' on a passing gate still prints nothing, so wiring it to a hook stays cheap"**
Holds. `tests/gate.test.ts:325` and `tests/cli.test.ts:496-500` unchanged and green; killed by N3
and N4 among others. Reproduced `The-CLI.md:104-115` at head.

**"The Stop hook's output on a red gate is shown from a real run, in the item's report and wherever the docs describe that hook"**
Holds, and the wording it is shown under is now true. Re-ran `echo '{"hook_event_name":"Stop","cwd":"'$PWD'"}' | mstack hook stop`
in a fresh store and got `docs/wiki/Gates-and-Hooks.md:29-31` byte-for-byte. `README.md:166` — my
round-1 minor 6 — now carries a calibrated clause.

**"Tests cover the failing case, the passing case, and the warning-only case"**
Holds. 203 pass on both runtimes, one more than round 1, and the extra one is the `--full`
characterization test. The two preservation tests still bite: N3 and N4 kill five tests each,
and my round-1 M4/M5/M6/M7 results stand since neither test changed.

**All four criteria hold. The docs reproduce. No claim outruns its evidence.**

## Minor (none blocking, none needing another round)

1. `.mstack/progress/impl_quiet-gate-prints-nothing.md:11` still reads "a red gate at session
   close had an exit code and no words" — the finding-1 overclaim, in the round-1 section of the
   report that retracts it 380 lines further down. The coordinator's grep covered `docs/`,
   `src/`, `tests/` and `current.md`, and this file was outside that scope. The report already
   proves it will edit round-1 text in place with a marker (the `13:2*` line at `:50`), so the
   same treatment fits. Not shipped to any user; a reader of the report is one heading away from
   the correction.
2. `.mstack/progress/history.md:165` carries the same framing, inside item 13's closing entry.
   That file is append-only and the `PostToolUse` hook says so, so **it should not be edited.**
   The correction belongs in item 16's own close entry. Naming it here so it is not lost between
   this review and that append.
3. `docs/wiki/The-CLI.md:66-67` — "the exact text the `Stop` hook hands the model, so the
   transcript and the context cannot drift apart." The byte-identity claim is true and tested
   (`tests/hooks.test.ts:139-142`). "Transcript" is the loose word on a page that now separates
   captured from displayed; on a CLI page the terminal reading is the natural one and that
   audience is verified at rung 5, so this is wording, not a claim. Round-1 text, carried forward.
4. `tests/cli.test.ts:552` — the test's first assertion (`full.stdout` matches the canary) pins
   behaviour item 14 is expected to change; the other four pin invariants that must survive it.
   When item 14 lands, the risk is the whole test gets rewritten rather than that one line. The
   docstring's "characterization, not endorsement" mitigates it; splitting the invariants into a
   second test would remove the ambiguity entirely. A preference, not a defect.
5. `.mstack/state.json:268` — item 17's description gives the path as
   `~/.claude/plugins/cache/mstack/mstack/0.1.0/bin/bin/mstack`. The real path has one `bin/`.
   It is a durable record someone will grep; worth correcting when item 17 is opened.

## Where my round-2 claims stopped on the ladder

| Claim | Rung |
|---|---|
| gate green, 203/203 both runtimes, typecheck, lint, doc links | **4** — all run here |
| the four doc transcripts reproduce byte-for-byte at head | **5** — fresh scratch stores, shipped `bin/mstack` |
| `gate --full --quiet` puts verify output on stdout | **5** — canary reproduced in both stream directions |
| the new characterization test bites | **4** — N1, N2, N5b, baseline confirmed falsifiable, restores sha256-verified |
| round 1's behaviour did not regress | **4** — N3 and N4, five kills each |
| no assertion was weakened this round | **4** — mechanical diff check, not reading |
| the change under `src/` is comment-only | **4** — mechanical diff check |
| the client's exit-0 hook path has no per-event branch, so `SessionStart` stands in for `Stop` on capture | **3** — read the spawn, the shared reader and the 3000 characters before the exit-0 branch in the shipped binary; could not run a Stop-hook turn |
| the `stop_hook_summary` renderer never receives `stderr` | **3** — read the component's destructuring in the shipped binary |
| the transcript displays a hook's stderr at exit 0 | **still unverified, by anyone** — and correctly claimed nowhere |
