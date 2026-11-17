# Explore: command surface and item lifecycle

Vocabulary from skills/design/references/deep-modules.md. Scope: src/cli.ts, cliopts.ts, lifecycle.ts, closing.ts, setup.ts, roles.ts, report.ts, frontmatter.ts, run.ts, run-helper.mjs, bin/mstack and their tests. Churn in cli.ts is treated as a hint only; the findings below are from reading the code.

## Findings

### 1. The item-transition rules have no module; cli.ts's `state set` closure is that module, and it is not callable (the main finding)

What "move an item to status X" means is spread across four files, and the largest share sits inside one closure in the CLI.

- src/lifecycle.ts (121 lines) holds the status table and six one-line predicates (`isStatus`, `isActive`, `requiresSpecArtifacts`, `requiresDecision`, `requiresVerification`, `canTransition`, lines 94-121). This is a table plus accessors. It is shallow: each predicate is `list.includes(status)`, and callers must still know which predicate to ask, in what order, and what to do with the answer.
- src/cli.ts:564-697 (the `--status` branch of `state set`) is the actual transition rule, in this order:
  1. status validity (566)
  2. unanswered-fork check (572-580)
  3. legal-transition check (582-587)
  4. closing checks (596-642)
  5. forced-close reason and marker (619-641, 666, 682)

  Then:
  - 700-736: `--sdd` on an item past `specifying` (`requiresSpecArtifacts`, disk probe `existsSync`)
  - 750-775: attaching a fork to an item past `specifying` (`requiresDecision`)
- Those same predicates are re-asked in src/gate.ts:304, 336, 611, 619, 653 and src/state.ts:188 (`assertWritable`, called at cli.ts:317-ish and cli.ts:784). The unanswered-fork rule exists twice (cli.ts:572-580 and gate.ts:301-325), and the code says so ("Refused here as well as in the gate", cli.ts:569).
- src/closing.ts (160 lines) is the one part that did get deepened: `closingProblems` and `gateProblems` hide a check list. But the *use* of its result (overridable vs not, verification-only wording, `--force` needs `--closed-by`, marker prefix) is the policy in cli.ts:596-642 and stays in the CLI. A caller of `closingProblems` still has to implement "what do I do with a problem list".

Call sites for the transition rule: one writer (`state set`, cli.ts:564-697). Two other readers re-derive parts of it (gate.ts, state.ts). Two files hold the marker string: `FORCED_UNVERIFIED` is defined and consumed only in cli.ts (223, 634, 666, 682), yet it is exported, and the comment at 218-222 says it is "written in one place and matched in another". Nothing outside cli.ts reads it, so a reader of `closed_by` in gate or ship has no accessor.

Deletion test on lifecycle.ts's predicates: delete the six one-liners and the complexity does not vanish, it reappears as `(X as readonly Status[]).includes(s)` at roughly 13 call sites (cli.ts 5, gate.ts 7, state.ts 1, others for `isActive`). So they pass, narrowly, but only as vocabulary, not as behaviour. The table (`TRANSITIONS`, `*_FROM`) earns its keep as the single definition (lint enforces it).

Cost today: understanding "close an item" means reading lifecycle.ts:56-101, cli.ts:564-697, closing.ts, gate.ts:600-660 and state.ts `assertWritable`. Five files for one status transition.

Deepening: a transition module that takes (store, state, item, requested status, force, closed-by note) and returns the mutations plus the report lines or a typed refusal, so the CLI only parses flags and prints. It would absorb the lifecycle predicates' use sites in the CLI and the CLI's half of the closing policy. Dependency category: in-process for the rules; the closing checks read ledger.tsv, verification receipts and git (local-substitutable: tests already use a sandbox store and a real git repo). Test at that interface rather than through the CLI.

### 2. `cmdState` is a 420-line function that holds three commands' worth of domain logic plus formatting

src/cli.ts:379-792 (`cmdState`), of which `set` alone is 457-788 (about 330 lines inside an `updateState` callback). Mixed in it:

- Field validation: `required()` (cli.ts:302) is called 11 times (lines 319 via `seamList`, 442-466 in `add`, 656, 705-ish, 700-760, 744 in `set`). Each call carries its own hand-written `fix` string; three of them are copies of "a criterion has to say something; quote it from the source" (lines 445, 700, 712).
- Item construction: `state add` builds an `Item` field by field (cli.ts:431-461), `state set` copies the same fields field by field (653-668, 689-720). The same field list is therefore in four places: `STATE_ADD` / `STATE_SET` flag tables (cliopts.ts:34-69), the `add` body, the `set` body, `CLEARABLE` (cli.ts:204), and `showLines` (cli.ts:345-364). Adding an item field means editing all of them. (src/state.ts also parses it at 217-237, outside this area.)
- Output formatting: `preview`, `detail`, `fieldChange`, `showLines`, `clearField` (cli.ts:228-364) are about 140 lines of change-report formatting. `changes: string[]` is built by domain code and printed by the caller (cli.ts:786-787), so the domain result is a list of English sentences. No test can assert "status changed" without matching prose; the tests in cli.test.ts and seams.test.ts do exactly that.
- Instruction counting and contradiction checks (cli.ts:506-546): a 12-element manual count of which flags were given, then a 7-row table of flag/clear pairs. This is per-flag knowledge that the flag table in cliopts.ts already holds (the `FlagSpec`s) but cannot express.

Call-site counts in cli.ts: `UserError(` 44, `console.log` 36, `parseArgs(` 9 direct plus `parseFlags` 3, `requireStore()` 8, `takesNothing` 4.

Deepening: split by concept, not by length. (a) an item-edit module that applies a parsed edit to an item and returns a structured change list (the formatter stays at the edge), absorbing `required`, `clearField`, the contradiction table and the instruction count; (b) the transition module from finding 1. Dependency category: in-process.

### 3. Option parsing is two modules, one of which only three commands use

src/cliopts.ts is a real module for `state add/set/show` and `decide`: one table drives parsing, `--help` and a dashed-value refusal (cliopts.ts:127-157). Per its own comment it exists so a flag cannot be in one place and missing from the other. But nine other command paths still call `node:util` `parseArgs` directly with an inline options literal: `setup` (cli.ts:181), `gate` (186), `fanout` (115), `ledger record` (801), `ledger check` (816), `worktree new` (958), `worktree prune` (975), `merge-gate` (1000), `cost` (1024). These skip `refuseDashedValues`, skip `--help` handling, and are absent from the generated help. `mstack help` (cli.ts:35-66) is a hand-written USAGE string the module's comment calls out as the problem ("The global help was hand-written", cliopts.ts:10). `ledger record --evidence --foo` therefore behaves differently from `state set --title --foo`. Missing `wantsHelp`: only `state` and `decide` answer `--help` (cli.ts:386, 849).

Deletion test on cliopts.ts: delete it and `parseFlags`/`helpText` complexity reappears across 4 call sites (state add, set, show, decide); passes. But its depth stops at four of fourteen commands, so the interface (a `CommandSpec`) is learned and paid for by only a third of the surface.

Deepening: make `CommandSpec` the way every subcommand is declared (flags, positionals, help, handler), with the dispatch switch at cli.ts:68-107 and USAGE derived from it. The `parseArgs` call sites go away. Dependency category: in-process. Note one caveat: `statusline` is deliberately lenient (cli.ts:166-178, launcher.test.ts:72-110) and `hook` takes stdin, so the spec needs a "lenient" and a "reads stdin" case.

### 4. Domain rules that live in the CLI and have no caller but the CLI

- `decide --resolves` validation (cli.ts:852-939): fork must exist, decision must contain `[a-z0-9]` (cli.ts:881, a copy of `SUBSTANTIAL` in gate.ts:29), result not blank or `open` (cli.ts:884-889, copy of gate.ts:316), floors on four columns (895-913), and the two-phase write (row, then pointer under a separate lock, 918-935). The comment at 880 says "the gate refuses the same shapes". So the rule "what counts as an answered fork" is in cli.ts and gate.ts, with the thresholds `MIN_PHRASE` (cli.ts:31, defined in the middle of the import block) and `MIN_REPORT_BYTES` (roles.ts:76, a spec/report file-size floor reused for decision prose). Deepening: a decisions-owned "record and resolve" operation whose validity check is the same function the gate calls. (Dependency category: local-substitutable, since it writes decisions.tsv and state.json under locks.) src/decisions.ts is out of scope, but note `decisions.add` is a bare row-append called with data cli.ts has already validated.
- `cost` (cli.ts:1023-1089) does store reading, slug resolution, flush policy, three aggregations and two output formats inline; the per-item `review_rounds`/`verifier_failed` shaping is computed twice (`perItem` and `single`, 1054-1060). One caller (the CLI), seven `costs.*` calls. Likely a missing `costs.report(store, {by, slug})` returning the structure that `--json` prints.
- `merge-gate` (cli.ts:993-1021) resolves the target as "the active item's slug" with a copy of the `find(isActive)` lookup; that lookup is repeated 9 times across cli.ts (410, 1009), gate.ts (602, 659), hooks.ts:109, state.ts:356, costs.ts:319, statusline.ts:103/328. One `activeItem(state)` accessor beside `isActive` would be the cheapest depth gain in the area; call sites counted by grep for `isActive(` outside lifecycle.ts: 14.
- `ledger check` and `merge-gate` each repeat `ledger.isVerdict(min)` with `?? "test-verified"` (cli.ts:828-829, 1004-1005); the default lives in two places.

### 5. Tests are forced past the interface because the CLI is the only interface to the transition rules

- src/cli.ts runs `main` at module top level (cli.ts:1237-1249) and exports nothing but `FORCED_UNVERIFIED`. There is no function a test can call for `state set` semantics, so every test of an item-lifecycle rule spawns a process through bin/mstack.
- Count: tests/cli.test.ts has 30 tests, 59 `run(` calls; tests/seams.test.ts 17 `run(` calls; tests/state-cli.test.ts, ledger-cli.test.ts and closing.test.ts add more. Domain rules tested only by spawning the CLI: forced-close marker survival (cli.test.ts:677-767), "only the move into done is guarded" (769), the `--clear` rules (187, 347), change-line rendering (377), trimming (416), contradiction refusal (277), `--sdd` announcement (440). Each is a rule of the item (when may it close, what may it carry), not of the command line.
- closing.test.ts:85-105 is the sharpest case. To register a second closing check it writes a boot script to a temp dir that imports `CLOSING_CHECKS` (an exported mutable array: "Exported mutable so a test can register a second check", closing.ts:146) and then dynamically imports cli.ts so the CLI runs inside the same process. That is a test reaching past the interface twice: a mutable export whose only caller is a test, and a process spawn to get at the CLI. A seam with one real adapter plus one test adapter is a legitimate seam, but it is injected through global mutation instead of a parameter.
- The same file shows the good side: `closingProblems` is called directly (closing.test.ts:29, 57, 209) and the agreement tests at 20, 194 then re-run the same case through `state set` and `gate` to check "all three agree". That agreement test is itself evidence that the closing policy has three consumers and no single owner (finding 1).
- tests/state-cli.test.ts:23-28 runs each CLI test under both bun and node. That is intended (both runtimes green, per CONTRIBUTING), but it multiplies the cost of every domain test written at the CLI seam. Domain tests at a transition module would run in process under `npm test`'s two runtimes without a spawn each.
- Replace, do not layer: once item edit and transition exist as modules with their own tests, roughly 20 of the 30 cli.test.ts tests (those at 105-480 and 625-832) become redundant to keep; the CLI keeps only exit-code, stream and routing tests (50-104, 484-620).

### 6. `lifecycle.test.ts` tests the table against itself

tests/lifecycle.test.ts:7-62: 9 tests, 62 lines. Of them, "every status has a transition entry" (7) and "every transition target is itself a status" (13) are what the `Record<Status, ...>` type and `as const satisfies` already guarantee at typecheck, but there is no typecheck step (no build), so they stand in for it; the rest assert individual table entries (`canTransition("verifying","done") === true`), which restate the table. They are cheap and they pin the lifecycle, but they are low leverage. Deepening would turn them into behaviour tests of finding 1's transition module (illegal move refused, forced move needs a reason). Minor.

### 7. Small shallow modules in the area

- src/report.ts (121 lines) is a console writer with `ok/warn/fail/section` and counters. 4 callers (gate.ts, fanout.ts, setup.ts, lint.ts). It carries real behaviour (quiet mode sends failures to stderr, warnings muted under quiet), so it passes, but `setup.ts` imports it only to print (setup.ts:5) and the gate/fanout/lint callers each decide `process.exit` code from `report.failed`; the CLI repeats `report.failed ? 1 : 0` at cli.ts:182, 196, 1143, 1158 via different wrappers. Low priority.
- src/roles.ts (201 lines) mixes four concerns: role to report-kind map, report file discovery/size floor, round parsing (`roundOf`), and "may this verifier close an item" (`canCloseAnItem`, `citesImplementingReport`, roles.ts:128-185, 50 lines of comment around a regex). The last pair is consumed only by ledger.ts:4, 225, 232, and is the review-independence rule, not a role mapping. It is out of place by name and a reader of ledger.ts has to cross to roles.ts to learn the rule. Deepening candidate for the ledger/verdict reader module (outside this area's analysis). In-process.
- `MIN_PHRASE` (cli.ts:31) is the only constant sitting between imports, with its import of `./setup.ts` below it; cosmetic, but it marks where a floor belongs in a shared module with `MIN_REPORT_BYTES`.

## Earns its keep

- src/closing.ts (`closingProblems`, `gateProblems`, `CLOSING_CHECKS`): deletion test passes. Without it the two consumers (`state set`, gate) each walk the checks, and the claim that they "agree" (closing.test.ts:20, 194) would have no single source. The `overridable` flag and fail-closed behaviour are behaviour behind a two-function interface. It is deep; the gap is who owns the policy applied to its result (finding 1).
- src/lifecycle.ts's tables (`STATUSES`, `TRANSITIONS`, `*_FROM`): a single definition, enforced by lint. Deleting them multiplies the enum into every caller, which is the failure the header comment names.
- src/run.ts plus src/run-helper.mjs: one caller (gate.ts:682 for `output: "inherit"` only; the timeout path is used by verification code outside this area). Interface is one function and one options type; behind it are the temp-file capture, process-group kill, Ctrl-C relay and node/bun differences (run.ts:50-100, run-helper.mjs:28-60). The helper is a separate file because `spawnSync` cannot kill a group (comment at run-helper.mjs:1-9). Deletion makes every caller re-solve the pipe-holding grandchild problem. Tests (run.test.ts, 13 tests) cross the same interface, no reach-past. Passes strongly. The 135-line interface cost is mostly TypeScript doc comments.
- bin/mstack (57 lines): runtime selection and compile cache are things every hook invocation needs; one adapter per runtime (bun, node) is two real adapters. Tests: launcher.test.ts crosses the process boundary, which is the true interface there. Passes.
- src/cliopts.ts: passes the deletion test for the four commands that use it (finding 3), and `refuseDashedValues` hides node/bun wording differences. The criticism is coverage, not depth.
- src/frontmatter.ts (102 lines): one caller, lint.ts. It looks like a pass-through but is a small hand parser whose limits are documented (frontmatter.ts:1-8) and tested (frontmatter.test.ts, 47 lines). Deleting it moves a YAML subset parser into lint.ts. Marginal pass; it earns its keep because the "no runtime dependencies" rule rules out a YAML library, and the parser reports what it cannot read rather than guessing.
- src/setup.ts: one function behind `setup(cwd, {force})`, hides template writing, TSV headers and idempotence; callers: one. Passes (the complexity would go to cli.ts).
- `takesNothing` (cli.ts:160-164, 4 call sites): 4 lines, but it makes a guarantee at four commands; deleting spreads the guard. Earns its keep, though it would vanish if finding 3 were done.
- `cmdHook` (cli.ts:1091-1139) and `warnForeignCli` (1204-1229): thick for a CLI file, but they are fail-open policy at the process edge, and both are tested through the true interface (hook-errors.test.ts, provenance.test.ts).

## Open questions

1. Is `state set` meant to stay agent-facing prose-only? If its change lines are an interface agents parse (the repo says it is "run by agents"), a structured result returned beside the sentences would be a design decision; today the sentences are both.
2. Does the gate want to reuse the transition rules (refuse an item sitting in a status the CLI would not allow it to reach), or is the duplication in cli.ts:572 and gate.ts:301 deliberate belt-and-braces? cli.ts:569 says "the gate is the authority; this is the cheapest place to say so", which reads as intentional, but the shapes are copied, not shared.
3. `closed_by` carries a marker prefix (cli.ts:223) that signals "forced unverified". Is a string prefix in a free-text field the intended durable representation, or would a separate field be acceptable? That is a product-level question for the state-file format, outside this area.
4. Should `cli.ts` be importable without side effects (guard the top-level `main` call)? Not itself a deepening but it is what finding 5 depends on, and the closing.test.ts boot-script hack (closing.test.ts:85-105) suggests the answer has been "no" only by omission.
5. Out of area, not analysed: src/gate.ts, state.ts, decisions.ts, ledger.ts and costs.ts are where finding 1 and 4's counterparts live. A cross-reader pass should check whether their halves of the duplicated rules have the same shape before a deepening is chosen.
