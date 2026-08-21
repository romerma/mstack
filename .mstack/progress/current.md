# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 14 verification-never-runs
- **Status:** in_progress
- **Branch:** feat/verification-never-runs
- **Base:** main
- **Worktree:** none

## Plan

Last of the three enforcement gaps the divergent pass surfaced, and the one that cost this
programme 230 minutes of a red gate nobody saw.

- `src/hooks.ts` wires the Stop hook to the **fast** gate, which never touches `state.verify`
  or `item.verification`. Only a human typing `mstack gate --full` executes them.
- `CLAUDE.md` and `skills/setup/SKILL.md` both say the gate must be green before a session
  closes. For the verification half of that sentence, nothing enforces it.
- Item 16 left this item a live constraint, pinned by a characterization test: `--full` runs
  the verify command with `stdio: "inherit"`, so putting `--full` behind the Stop hook as-is
  would put arbitrary test output in front of the hook's JSON on stdout. That question is
  answered before code, not after.
- The cost has to be bounded: a Stop hook that runs a full suite every turn is a Stop hook
  people disable, which is worse than the gap.

## Log

- Refinement round opened. `mstack gate` was green on main; the dogfood branch landed
  `--ff-only` so item 11's verdict SHA survives.
- Re-verified five friction claims against plugin HEAD in a throwaway store: F1 (no
  per-subcommand help), F4 (`fanout plan` doubles the slug), F6 (`--verification` not
  settable via `state set`), F9 (abbreviated SHA fails `ledger check`), F10 (`--full` warns
  it checked nothing without failing). All five reproduce.
- F9 is worse than the protocol recorded: `src/ledger.ts:136` compares SHAs with `===`, so
  an abbreviated SHA lands every row in `stale` and the message asserts "a new head SHA
  voids them" — false, it is the same commit written shorter. The diagnostic lies.
- A divergent-lens pass is running against the whole findings list; its job is to argue
  against acting. Report will land at progress/reflect_divergent.md.
- Caught a measurement error of my own before reporting it: `bun test` without a path picks
  up the sandbox's suite. The project's command is `bun test tests/`, and both runtimes are
  green at HEAD (171 pass each).

- Implementer pass done. `shellSegments` added to `src/hooks.ts`; `preToolUse` now matches
  every guard per segment rather than per line. 24/24 rows correct, was 14/24.
- Segmentation applied to all six guards, not just `rm`. Four siblings had the same `[^\n]*`
  defect, all four reproduced; only `git reset --hard` escaped, and by luck. One line, one
  call site.
- The `&` of `2>&1` is not a separator. Splitting there would have hidden a trailing
  `--force` from the push guard, turning a false deny into a false allow.

## Verification

- The defect: rung 5, reproduced against the shipped regex in a standalone script, twice by
  two passes; re-reproduced this pass, 10 wrong rows out of 24.
- The fix: rung 5. `bin/mstack hook pre-tool-use` driven as a real process with real JSON on
  stdin, 14/14 rows correct. Plus rung 4: `npm test` 174 pass on both runtimes, three
  separate mutations of the new code each caught by a named test.
- `npm run typecheck` and `./bin/mstack lint-plugin .` both clean.
- Commits: `a8e8d90` the fix, `51a79cc` and `9b951a4` the tests, `0c0c24d` the report.
  Ledger row `live-verified` at `0c0c24d`, verifier `implementer` — that is the implementer's
  own evidence, not an approval.

- Reflect triage written to progress/reflect_refinement.md. The divergent pass dropped ten of
  fourteen findings, most because the documentation already said the thing. Four accepted;
  the user chose the full scope.
- Items 13 editable-item-fields, 14 verification-never-runs and 15 reviewer-writes-the-verdict
  filed as pending. The fifth accepted finding (rung 4 must say what it ran on) shipped
  directly as one clause in evidence-ladder.md, per CONTRIBUTING's small-fix rule.
- Item 12 review came back CHANGES_REQUESTED with a **real false allow**: a separator inside
  `$(...)` or backticks splits one shell command in half, so 30 of 30 spellings regressed from
  DENY to allow across all five guards. Proved at rung 5 by letting the allowed command delete
  a real store. My own 9/9 check missed it because it never tested command substitution.
- Sent back to the implementer for depth tracking, plus the false limit statement in the module
  comment and the wiki page that now describes the pre-change behaviour.

- Round 2 done. `shellSegments` now tracks substitution depth: `$(`, `<(`, `>(`, `$((`, any
  paren nested inside one, and a backtick toggle. While depth is non-zero nothing is a
  separator. 30/30 regressed spellings back to DENY through the shipped binary.
- Finding 2 closed by rewriting the comment rather than deleting it: it now leads with the
  one-directional rule (a construct it cannot model must leave a segment too long, never too
  short), names the incident that proves the asymmetry, and lists every unmodelled construct
  with the direction it fails in.
- Finding 3 closed: `docs/wiki/Gates-and-Hooks.md` cited a moved line range and described the
  pre-change guard. All 17 behavioural claims on the page re-run through both shipped binaries.
- Process error worth keeping: my first mutation driver restored with `git checkout`, which
  discarded the uncommitted fix and made six of seven mutations report SETUP-ERROR against
  unmodified code. Re-applied, committed first, driver now restores from a byte copy.

## Verification

- Round 2, rung 5: differential over **528** destructive spellings across two shipped
  binaries (`main` and this branch) - **0** false allows introduced, and all 17 false
  positives including the four acceptance rows stay allowed.
- Round 2, rung 4: 7 per-construct mutations of the depth tracking, all killed by a named
  test. `npm test` 176 pass on both runtimes; typecheck and lint clean.
- Commits: `7b81823` the depth fix and its tests, `5b8397f` the wiki.

- Implementer pass started on item 13. Five design decisions recorded up front in
  decisions.tsv: `--acceptance` replaces / `--add-acceptance` appends; `--clear <field>` is
  the removal spelling and an empty value is refused; attaching a fork at or past
  `spec_ready` is refused with `--force` as the loud override; rewriting the fork prose drops
  a stale `decision_resolved`; `--title` yes, `--slug` refused, `--sdd` unguarded.
- Order inside one `state set`: clears, then `--status`, then the value flags, with
  `--decision-required` last so the attach gate judges the status the item ends up in. That
  makes both "drop the fork and move on" and "move it back and attach the fork" single
  commands.

- Implementer pass done. `state set` now takes nine value flags plus `--clear <field>`;
  the fork line `spec_ready..done` is guarded in both directions, with `--force` printing the
  gate failure it creates; a rewritten or cleared fork drops `decision_resolved`.
- 15 new tests. 14 go red against `main:src/cli.ts` (swapped in and restored from a byte
  copy, sha256 checked). The 15th is the criterion-4 regression test, green by construction,
  and its bite is shown by mutation M10 instead.
- 12 targeted mutations of the new logic, all killed by a named test. M6 and M8 both keep
  exit 2 and change only the reason printed, so a test asserting only the exit code would
  have let them through.
- One input changed that criterion 4 might be read to protect: `--closed-by ""` used to
  store an empty string and now exits 2. Called out in the report for the reviewer to rule on.
- `docs/wiki/The-CLI.md` gained two subsections, both transcripts from one real scratch-repo
  run; `State-Files.md` and `README.md` each gained one clause.

## Verification

- Rung 5 for the CLI and the gate: the shipped `bin/mstack` driven as a process in real
  scratch stores, with `mstack gate` exiting 0 and 1 exactly where the CLI said it would.
- Rung 4: `npm test` 191 pass on bun and on node, `npm run typecheck` clean,
  `./bin/mstack lint-plugin .` 0 failures 0 warnings.
- Rung 2 and stated as such: the `--sdd` boundary. Setting `--sdd` on an item past
  `specifying` can still leave the gate reporting missing spec artifacts. Read, not run,
  deliberately out of scope, recorded as the `09:10:57.329Z` decision row.
- Commits: `ceda13b` the CLI and its tests, `a426edc` the idempotence test, `0041e54` docs.

- Round 2. Review came back CHANGES_REQUESTED with six required findings and six minors; all
  twelve are answered, and the round-2 section of the impl report maps each one to its fix,
  its test and the mutation that proves the test bites.
- The two that mattered were both a claim the code was making that was not true. The change
  line printed an identical before and after for two forks sharing a 45-char prefix, while the
  same command dropped `decision_resolved`; and `required()` validated trimmed but stored raw,
  so a trailing space was a different fork. Reproduced live against `9a4dc59^`'s own cli.ts,
  swapped in and restored by byte copy.
- `--sdd` now announces what it does to the gate, and reads the disk so it claims a failure
  only when it made one. The decision row whose reason the reviewer demolished is superseded
  rather than edited; decisions.tsv is append-only.
- `state add` now shares `required()` with `state set`, so the empty-string rule holds at both
  doors instead of one.
- Six doc transcripts re-run and pasted; two wiki blocks now show the command that actually
  ran, verified by reading the stored value back out of state.json.
- Caught one of my own false claims mid-report: I wrote that the page's fork was byte-identical
  to the shipped example's before checking. It was the first sentence of two. Fixed the page so
  the claim is true rather than softening the sentence.

## Verification

- 16 round-2 mutations, each reverting one fix to its round-1 behaviour, all killed by a named
  test. The first run reported one survivor and the survivor was my mutation, not the test:
  it substituted `" "` for `""`, which `required()` trims and refuses either way.
- `npm test` 196 pass on bun and node; typecheck clean; lint-plugin 0 failures 0 warnings.
- Commits: `9a4dc59` code and tests, `d62e32b` docs.

- Item 16 implementer pass. Defect re-reproduced at rung 5 in a scratch store first: two real
  failures, `gate --quiet` emitted 0 bytes on both streams and exited 1.
- Four design decisions recorded up front in decisions.tsv before any code: failures go to
  **stderr** (stdout carries the Stop hook's JSON and text in front of it would stop that
  parsing); one line per failure **with** its `fix`, byte-identical to what the hook already
  hands the model; **no** summary count line; **silent** on warnings.
- The fix is `src/report.ts#fail` only. Quiet writes through `process.stderr.write`, not
  `console.error`: under bun a patched `process.stderr.write` never sees `console.error`, so
  the assertions pinning this output would have measured nothing on one of the two runtimes.
- `tests/cli.test.ts`'s `run()` moved from `execFileSync` to `spawnSync` because it discarded
  stderr on exit 0 — the exact case the Stop hook is.

- Implementer pass done. Six new tests: three in gate.test.ts for the failing, passing and
  warning-only cases, one in hooks.test.ts for the Stop hook's two streams, two in cli.test.ts
  driving the shipped binary. Four go red against `main:src/report.ts`; the other two are
  preservation requirements, so they cannot, and their bite is shown by mutations M4/M5/M6.
- 8 mutations, 8 killed by a named test, restores byte-verified by sha256 each time.
- Two wiki pages rebuilt from real runs: the `gate` section of The-CLI, and a new
  "What the Stop hook prints on a red gate" in Gates-and-Hooks.
- Called out for the reviewer: `run()` in cli.test.ts moved to `spawnSync` (execFileSync threw
  stderr away on exit 0, which is the Stop hook's case), and the pre-existing `[fail] security`
  noise from fanout.test.ts, confirmed identical on main.

## Verification

- Rung 5 for the behaviour: the shipped `bin/mstack` in scratch stores, and `bin/mstack hook
  stop` as a real process with real JSON on stdin. Before: 0 bytes, exit 1. After: the failure
  lines on stderr, the hook's JSON still alone and parseable on stdout.
- Rung 4: `npm test` 202 pass on bun and on node; typecheck clean; lint-plugin 0 failures 0
  warnings; check-doc-links 56 links, 0 broken.
- Rung 2 and stated as such in the report: whether Claude Code surfaces a hook's stderr in the
  transcript at exit 0. The bytes reach fd 2; what the client does with them is the client's.
- Commits: `40c37cf` fix, `cc33e27` tests, `29a7304` comment correction, `86615b0` docs.

- Round 2. Review came back CHANGES_REQUESTED with four findings, all prose; the code and all
  five design decisions were confirmed sound and no product code changed this round.
- Finding 1 was mine and real: four places said the failures reached nobody. `main`'s `stop()`
  already put them in `additionalContext`, so the **model always had them**; what was empty was
  every stream. Corrected in the wiki, `src/report.ts`, `tests/gate.test.ts` and here — plus a
  fifth site the review did not name, an assertion message in `tests/cli.test.ts`.
- Finding 2 moved two rungs rather than being softened. A live canary against claude 2.1.238
  proves at rung 5 that the client parses hook stdout as JSON **while stderr sits beside it**,
  captured verbatim as its own field. Whether the transcript *renders* that field is still
  unverified (a Stop turn was refused for credit, as it was for the reviewer), and the docs now
  say exactly that instead of claiming the session shows it.
- Finding 4: `--full` runs the verify command with `stdio: "inherit"`, so it writes to stdout
  through `--quiet`. Both wiki pages scoped to the fast gate, a characterization test added at
  `tests/cli.test.ts:552`, and the `10:23:55.039Z` decision row superseded by `11:16:06.989Z`.
- **Item 14 inherits the `--full` stdio question** and must answer it before writing code.

## Verification

- Round 2 rung 5: `git show main:src/hooks.ts` for the framing; the `--full` canary in both
  stream directions; a live `claude -p` run whose `hook_response` event shows stdout parsed and
  stderr captured separately.
- Round 2 rung 4: 4 mutations, 4 killed, **baseline run first and confirmed green** so the
  harness is falsifiable; both byte copies restored to pristine sha256. `npm test` 203 pass on
  bun and node; typecheck, lint-plugin and check-doc-links clean.
- Still unverified and stated as such: whether Claude Code displays a hook's stderr at exit 0.
- Commits: `2ee2fda` finding 1 + the new test + minors, `878e92b` findings 2 and 4.

- Item 14 implementer pass started. Baseline confirmed green **before** anything was touched:
  `npm test` 203 pass on bun and 203 on node, typecheck clean, `lint-plugin` 0 failures 0
  warnings.
- Six design decisions recorded in decisions.tsv before any code, the first of them the stdio
  question item 16 left behind.
- **The stdio answer**: `--full` stays out of every hook. `stdio: "inherit"` is unchanged, the
  characterization test at `tests/cli.test.ts:552` stays green untouched, and criterion 1 is
  enforced by the *fast* gate reading a **receipt** of a past run instead of running anything.
- The receipt is a new store file, `.mstack/verification.tsv` (`target/sha/command/outcome/ts`),
  written by `gate --full` and read by the fast gate. Not the ledger: a ledger row is a verdict
  by a pass, and a gate-written row would satisfy `canCloseAnItem` and close the item itself.
- **Where the cost line falls** (criterion 3): the fast gate demands a fresh receipt only from
  `verifying`, because `verifying -> done` is the only legal path to `done`. The whole
  `in_progress` phase costs one file read. `state set --status done` re-checks at the
  transition so flipping the status cannot be the way out.
- Criterion 2: `gate --full` with nothing to run becomes a `[fail]` and exit 1 instead of a
  warn and exit 0.

- Implementer pass done. `src/verification.ts` (new) owns `.mstack/verification.tsv`; `--full`
  records every command it ran; the fast gate reads it back and refuses a green gate from
  `verifying` on; `state set --status done` re-checks at the transition so relabelling is not
  the way out.
- 25 new tests. 10 of the 12 new gate tests go red against `fd1b27a~1:src/gate.ts`, and 2 of
  the 5 new CLI tests against each of the two pre-change files; the rest are preservation
  requirements and their bite is shown by mutation instead.
- 20 mutations, 20 killed by a named test. The first round had 19/20: the survivor let the
  closing guard fire on every status move, which would have demanded a full run just to
  advance an item. That is a real gap in my tests, not a bad mutation, and it is now pinned.
- The bypass the CLI guard closes was reproduced first, at rung 5 against the shipped binary:
  an item at `verifying` with a red gate went green the instant its status became `done`.
- `--full` with nothing to run is now `[fail]` and exit 1 rather than a warn and exit 0.
- Four wiki pages, the README and the changelog updated; every block is pasted from a real run.

## Verification

- Rung 5 for the whole loop: the shipped `bin/mstack` and `bin/mstack hook stop` driven as real
  processes in scratch stores. A non-executable `verification` (accepted by `sh -n`, exit 0)
  goes: Stop red -> `gate --full` executes it and records `failed` -> the next Stop is still red
  without running anything -> `state set --status done` exits 2 -> fixed command, `gate --full`
  green -> Stop silent -> the close is allowed.
- Rung 5 for this repository too: `./bin/mstack gate --full` at `028e3bd` recorded two `passed`
  rows, and `git status --porcelain` stays clean because `.mstack/.gitignore` covers them.
- Rung 4: `npm test` 230 pass on bun and on node, `npm run typecheck` clean, `./bin/mstack
  lint-plugin .` 0 failures 0 warnings, `check-doc-links` 60 links 0 broken. 20/20 mutations
  killed, baseline confirmed green before and after, restores byte-verified by sha256.
- Rung 2 and stated as such: whether a store on a filesystem that refuses the receipt write
  reports usefully. The failure path is written and typechecked; it is not exercised by a test.
- Commits: `ddac8e3` the module, `fd1b27a` the gate, `ae40ab2` the closing guard, `f2e9308` the
  boundary test, `db00832` docs, plus the changelog.

## Next step

- If this dies: item 14's implementation is complete on feat/verification-never-runs and the
  report is at `.mstack/progress/impl_verification-never-runs.md`. It is **not** approved —
  a reviewer that did not write it decides that, and the item stays `in_progress` until then.
  Note for whoever moves it to `verifying`: the gate will then demand a `gate --full` run at
  that commit, which is this feature verifying itself. Items 15 and 17 still pending.
