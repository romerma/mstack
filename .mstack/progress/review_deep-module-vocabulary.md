# Review - deep-module-vocabulary (item 57)

**Verdict:** CHANGES_REQUESTED

Reviewed `9ac4e7d..bfe37e2` (head `bfe37e2f8645a071279cd19ebcfe9c302018e7ea`), 13 product files, +143 -11, and the five items 76 to 80 the implementer filed. I did not write any of it. Scratch work, clones and streams: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review57/`.

The product change is sound. The vocabulary matches its source and does not run as a procedure. A reviewer given the lens reads it, and two reviewers without the lens did not. The playbook, on its final wording, routed from two differently worded requests in fresh projects, filed 3 and 4 candidates, asked nothing and implemented nothing. On a clone of this repository it filed nothing and said why. The suite, typecheck, lint and gate are green.

The verdict is about acceptance 3. Four of the five filed items say something about the code that is not true at the head. Each core finding holds; each error is a sentence, and each fix is one `./bin/mstack state set <id> --title/--description`.

## Changes required

1. **Item 79 `workspace-facts`, title: "Git is asked from nine call sites".** There are 25 call sites in 8 files: 21 calls to `git()` and 4 direct `execFileSync("git")`. No count I can reproduce gives nine. The figure comes from `explore_checks-hooks.md:7` ("~25 times from 9 call sites"), whose list has nine entries because it counts `worktree.ts` twice.
   ```
   $ rg -c '\bgit\(' src | sort        # includes the definition at git.ts:61
   src/costs.ts:1  src/gate.ts:5  src/git.ts:4  src/paths.ts:2  src/statusline.ts:2  src/verification.ts:4  src/worktree.ts:3
   $ rg -n 'execFileSync\("git"' src
   src/git.ts:63  src/ledger.ts:57  src/ledger.ts:82  src/worktree.ts:81  src/worktree.ts:152
   ```
   That is 21 calls to `git()` outside its definition, plus the 4 direct calls outside `git.ts:63`. Fix: state the real count, for example "from 25 call sites in eight modules, four of them past git.ts".
2. **Item 77 `item-readiness-reading`, title "Five consumers each turn a ledger reading into their own verdict", and description "mergegate.ts:165 each switch over the Reading kinds".** `mergegate.ts` never reads a kind. It takes `check`'s `passing` and `reason` (`mergegate.ts:165-170`).
   ```
   $ rg -c "kind" src/mergegate.ts ; echo $?
   1                                   # no match
   $ bat -r 163:171 src/mergegate.ts
   const result = ledgerCheck(store, target, pr.headRefOid, min ?? "test-verified");
   if (result.passing) { notes.push(`ledger: ${result.reason}`); } else { stops.push(`ledger: ${result.reason}`); }
   ```
   The kinds are interpreted at `ledger.ts:312-370` (`check`), `gate.ts:422-437`, `closing.ts:104,123` and `statusline.ts:158-160`. That is four places, and the cited `ledger.ts:286-296` is the filter, not the switch. Fix: drop mergegate from the list and the count, or say it renders `check`'s verdict. The acceptance's "merge-gate render[s] from it [the active item's readiness]" also does not fit: mergegate judges a PR's head SHA, not the active item.
3. **Item 76 `item-transition-module`, description: "gate.ts:301-325 and state.ts assertWritable re-ask parts of it".** The gate half is true: `gate.ts:304,321-325` re-checks the unanswered fork. `assertWritable` (`state.ts:69-81`) asks no lifecycle question at all. It checks the slug, the title and unique slug and id. The one lifecycle predicate in `state.ts` outside `activeItem` is `isStatus` in the parse path at `state.ts:188`.
   ```
   $ rg -n "isActive|requiresDecision|canTransition|isStatus" src/state.ts
   4:import { isActive, isStatus, type Status } from "./lifecycle.ts";
   188:  if (!isStatus(value["status"])) {
   356:    return parseState(store.state).items.find((item) => isActive(item.status));
   ```
   Fix: drop the `assertWritable` clause, or name `parseItem`'s status check for what it is. (Also, `cli.ts:564-697` overshoots: the status block is 565-686, and 688-697 handle `--acceptance`.)
4. **Item 80 `tsv-record-shape`, description: "setup.ts:149-153 repeats the headers".** It does not. Setup imports each module's `HEADER` and passes it to `ensureHeader`:
   ```
   $ rg -n "LEDGER_HEADER|DECISIONS_HEADER|COSTS_HEADER" src/setup.ts
   7:import { HEADER as LEDGER_HEADER } from "./ledger.ts";
   8:import { HEADER as DECISIONS_HEADER } from "./decisions.ts";
   9:import { HEADER as COSTS_HEADER } from "./costs.ts";
   149:  ensureHeader(store.ledger, LEDGER_HEADER);
   ```
   The title's "Each TSV store writes its column list four times" holds for ledger (`ledger.ts:37,43,135-142,146-157`), decisions (`decisions.ts:10,12,59-67,72-81`) and verification. `costs.tsv` has no row interface (`CostRow` at `costs.ts:866` is a summary row). So costs has three copies: `HEADER` at 58, the positional push at 773 and string-key reads at 879-890. Fix: drop the setup clause and say "four times in ledger, decisions and verification, three in costs".

Item 78 is true as stated (table below). None of the five duplicates an open item.

Once the four items are corrected, acceptance 3 is met: the playbook ran on this repository and filed its candidates, and they are pasted in the implementer's report. Nothing in the product diff needs to change.

## Non-blocking findings

- **The vocabulary's opening sentence contradicts the playbook that reads it.** `deep-modules.md:5-6` says "Apply them to the change in front of you and to nothing else: do not go looking for more to redesign". `deepen.md:8-9` says "Read it first and use its words", and that playbook's whole job is looking for more to redesign. My runs B1 and B4 went ahead anyway (n=2). Scoping the sentence ("When judging or designing a change, apply them to that change and nothing else") would remove the contradiction without weakening the guard.
- **B2 (final wording, clone at head) printed no intake-skip line, listed no playbook steps, and did not read the vocabulary.** It also committed `chore: record a second deepen run that files nothing` onto the item's feature branch. In the real repository, that commit would move HEAD past the SHA under review. This is n=1, and router discipline is not part of this diff. B1 and B4 both printed the skip line.
- **`deepen.md` step 2 offers "Explore agents" and has each one write `.mstack/progress/explore_<topic>.md`.** The Explore agent type has no Write or Edit tool. The implementer's run 2 used `general-purpose` readers. None of my runs fanned out (0 agents in B1, B2 and B4), so this step is untested on the final wording.
- **`deepen_<date>.md` has no rule for a second run on the same day.** B2 appended, and the first run's content survived: `git diff HEAD~1` shows 0 removed lines. An agent that overwrote the file would orphan the `--source` of items 76 to 80. That was the agent's choice, not the text's.
- **B1 wrote probe scripts to `/tmp/deepen_probe/`, and B3 wrote `/tmp/gateprobe` and `/tmp/v-*.log`.** Both are outside the project. They change no repository file, and I left them in place.
- **C2: one of the design reviewer's required changes reaches outside the diff.** It asked to route `BookingService.quote` (`service.py:16-17`, untouched by the diff) through the new Quoter. The request rests on a locality finding the diff created (quote and book now price by two paths). It did not judge the pre-existing pass-through `BookingService.quote` in its own right. The reviewer has no "found, not filed" outlet for something it notices outside the diff, which the playbook has.
- **`skills/design/SKILL.md:51` describes "Shallow module" as failing the deletion test.** `deep-modules.md:14-15` defines shallow as "an interface nearly as complex as its implementation". In the source, the deletion test detects a pass-through, so the term now has two characterisations. Minor.
- **The origin header of `deep-modules.md` lists `DESIGN-IT-TWICE.md` among its sources, but no text from that file appears.** It also cites the 100k-token incident as "the source's own documentation". The incident is real; it is in `docs/engineering/codebase-design.md:54` of the source checkout, which the header does not name. Minor.
- **Two acceptance criteria are weak.** Item 76's "the forced-close marker [is] defined once" is already true at head: `FORCED_UNVERIFIED` appears only at `cli.ts:223`, so that half does not discriminate. Item 78 does not name items 66 and 68 (lock windows; `updateState`'s rename, symlink and mode), which touch the same code.
- **Implementer-listed, not blocking (per brief):** `fanout plan` needs an active item, and the Stop hook goes red in a clone with a foreign `--plugin-dir`. I avoided the second by pointing `--plugin-dir` at the clone itself for B2 and B3 (same SHA), and B2 ended cleanly.
- **Router length:** `wc -l` gives 160, up from 158, and `lint-plugin` prints "161 lines" because it counts the trailing newline as a line.

## Probe A: the five filed items against the code at bfe37e2

| Item | Claim | Check | Holds? | Overlap with open items |
|---|---|---|---|---|
| 76 | `state set --status` rules inside `cmdState` (cli.ts:379) | `rg -n "function cmdState" src/cli.ts` gives 379. Fork check at 571-581, transition at 582-587, closing policy at 595-638, forced marker at 681-686 | yes (range 564-697 overshoots to 697) | 40, 44, 71 change these rules; none extracts them. Not a duplicate |
| 76 | lifecycle.ts holds only the table and one-line predicates | `rg -n "^export" src/lifecycle.ts`: constants, `TRANSITIONS`, `isStatus`/`isActive`/`requires*`/`canTransition` | yes | |
| 76 | gate.ts:301-325 re-asks the fork rule | gate.ts:304 `requiresDecision`, 321-325 fail | yes | |
| 76 | state.ts `assertWritable` re-asks parts of it | state.ts:69-81 checks slug, title and uniqueness only | **no** | |
| 76 | reachable only by spawning the CLI | cli.ts exports only `FORCED_UNVERIFIED` (`rg -n "^export" src/cli.ts`). tests/cli.test.ts:29 uses `spawnSync(BIN)`. closing.test.ts:100 spawns a boot script that imports cli.ts | yes | |
| 77 | five consumers switch over Reading kinds: gate 375-440, closing 100-110, ledger check 286-296, statusline 134-175, mergegate:165 | gate.ts:422-437 yes; closing.ts:104 yes; ledger.ts:312-370 yes (not 286-296); statusline.ts:158-160 yes; mergegate has 0 `kind` references | **no** (four, not five) | 71 changes the closing verdict rule; adjacent |
| 77 | "kept in agreement by comments" | statusline.ts:154-157 ("The kind comes from the reader `ledger check` and the gate share") | yes | |
| 77 | active item looked up inline at about nine sites, two error contracts, state.ts:354 swallows | `rg -n "isActive\(" src`: hooks 109, statusline 103, 328, cli 410, 1009, costs 319, gate 222, 602, 659 = 9. state.ts:354-359 `catch { return undefined }` | yes | |
| 78 | `withLock` taken by state, decisions, costs, not ledger or verification | `rg -n "withLock\(" src`: decisions.ts:53, costs.ts:287,425,754,764, state.ts:289; ledger.ts:135 and verification.ts:314 call `append` bare. verification.ts:36 says so | yes | 66 (lock windows), 68 (state rename), 51 (cost flush): adjacent, not covered |
| 78 | ensureHeader widens by an unlocked whole-file write | tsv.ts:55-57 `writeFileSync` of the whole file; unlocked for ledger and verification | yes | |
| 78 | three tmp-then-rename implementations differ (state.ts:308-329, costs.ts:449-451, hooklog.ts:79-82) | state: `.tmp-<pid>-<n>`, `wx`, rm on failure; costs: `${file}.tmp`, no cleanup; hooklog: `.<pid>.tmp`, rm in finally | yes | 68 owns the state.ts symlink and mode fixes |
| 79 | git.ts says it is the one place; ledger.ts:57,82 and worktree.ts:81,152 bypass it | git.ts:6 "The one place this repository shells out to git"; the four direct calls listed above | yes | none |
| 79 | "nine call sites" | 25 call sites (21 via `git()`, 4 direct) in 8 files | **no** | |
| 79 | two incompatible ways | `git()` returns null on failure with a 5 s timeout (git.ts:21,61); worktree.ts:152 throws with no timeout | yes | |
| 79 | branch, head and dirty derived separately (gate checkWorkspace 562-590, statusline 90/134, worktree list) | gate.ts:562-588, statusline.ts:90-91,134, worktree.ts:25,79-81 | yes | |
| 79 | git dir found three ways (costs 158-187, hooklog 112-135, paths 186-200) | costs walks `.git` then asks `--git-path`; hooklog walks `.git` and `commondir`; paths asks `--git-common-dir` | yes | |
| 79 | three encodings of no-git / no-commits / detached | gate.ts:563 vs 570; statusline.ts:91 folds `HEAD`; verification `UNKNOWN_TREE` (verification.ts:63, 207-253) | yes | |
| 80 | ledger and decisions repeat interface, HEADER, positional append, read-back | ledger.ts:37,43,135-142,146-157; decisions.ts:10,12,59-67,72-81 | yes | |
| 80 | verification and costs repeat all four | verification yes (45, 77, 314-321, 325); costs has no row interface (three copies) | partly | 65 adds a column; adjacent |
| 80 | setup.ts:149-153 repeats the headers | setup.ts:7-9 imports them | **no** | |
| 80 | costs.ts:907 reads ledger rows by string key past `ledger.entries` | costs.ts:907 `readRecords(store.ledger).filter((r) => r["target"] === slug && r["verdict"] === ...)` | yes | |
| 80 | a reordered header silently misaligns rows | Live probe below | yes | |

Reordered-header probe. `ledger.tsv` with `sha` and `target` swapped in its header, then `tsv.append` with ledger's `HEADER`:
```
$ bun probe.ts ledger.tsv
append: no error
[{"sha":"abc","target":"one",...},{"sha":"two","target":"def","verdict":"live-verified",...}]
```
The appended row's target `two` landed under `sha`, with no error. `ensureHeader` returns silently on a non-prefix header (`tsv.ts:53`).

**Deletion tests and pass-throughs the items rest on.** Each is a duplication or locality finding, not a pass-through claim. The duplicated logic exists where cited, except for the four corrections above.

**Observable acceptance, seams, source.** All five have a `source` (`deepen playbook run, 2026-11-17, .mstack/progress/deepen_2026-11-17.md`, a file that exists), one seam each, and three acceptance criteria. Most are grep- or test-checkable. Item 76's marker half is vacuous, and item 77's merge-gate clause is ill-fitting (both above).

**Ranking claims.** Item 76 ranks first "because 40, 44 and 71 would each edit the closure". Item 40 records `base` "on the first move to in_progress" and item 71 records the closing commit; both edit the status block. Item 44's rule is gate-side. The claim is supported enough. I did not rank anything myself.

## Probe B: the playbook on its final wording

Wrapper `scratchpad/review57/run.sh`: `env -i` with HOME, USER, LOGNAME, TERM, LANG, TMPDIR, SHELL and a PATH of system dirs, `/opt/homebrew/bin`, the bun bin dir and the claude bin dir. No ANTHROPIC_* variable. The command was `claude -p "<prompt>" --model opus --output-format stream-json --verbose --setting-sources project --strict-mcp-config --max-budget-usd <b> --plugin-dir <dir> --permission-mode auto`. Claude was 2.1.326. Every init event lists plugin `mstack`, `auto` and `claude-opus-5-5`. Streams are in `scratchpad/review57/streams/`, outside every project. `pgrep -fl "claude -p"` printed nothing after the last run.

| Run | Project | Prompt | Route | Intake | Agents | Filed | Question? | Repo change outside .mstack | turns, USD, s |
|---|---|---|---|---|---|---|---|---|---|
| B1 | copy of `template-hard` + setup | `/mstack review the architecture` | deepen (first Bash reads `playbooks/deepen.md`, second reads `deep-modules.md`) | `Intake: \`skip: deepening, the playbook files its own items\`` | 0 ("small enough to read myself") | 3 | no | none (`git status`: only `.mstack/`; `git log` unchanged; on `main`, no branch) | 14, 1.037, 136.1 |
| B2 | `git clone` of this repo at bfe37e2, `--plugin-dir` = the clone | `/mstack review the architecture` | deepen (reads `deepen.md` first) | no line | 0 | 0, with reasons | no | none; one store-only commit `0a6f5e6` (decisions.tsv +1, deepen file +14 -0) | 8, 0.334, 57.1 |
| B3 | second clone at bfe37e2 | `/mstack why is the gate slow?` | not deepen (no `deepen.md` read: `rg -c deepen.md` = 0); investigation ("I skipped intake because this was an investigation") | stated in reply | 0 | 0 | ends with an offer ("If you want the fix, I can file it"), which is not this playbook | none | 15, 0.382, 317.4 |
| B4 | copy of `template-hard` + setup | `/mstack where should this codebase be deeper?` | deepen (reads `deepen.md` first) | `skip intake: deepening, the playbook files its own items.` | 0 | 4 | no | none | 14, 1.035, 140.6 |

Each item filed in B1 and B4 carries files and the deepening in `--description`, three or four observable criteria, the evidence-file `--source` and one or two seams. B1 #1, as filed (abridged):
```
slug: line-pricing-two-implementations
title: Quote and invoice price a line through two separate implementations that disagree
description: domain/pricing.py (unit_price, apply_discount, price_line, build_quote) prices quote lines; domain/invoice.py (_invoice_unit_price, build_invoice) re-implements ... Deepen: one module prices an order line ... In-process dependency: merge and test through the new interface.
acceptance:
  - One function in stockroom/domain prices a line ...; build_quote and build_invoice both call it and _invoice_unit_price no longer exists
  - grep finds the price-list-then-break selection in exactly one place under stockroom/domain
  - A test through StockroomService shows quote and invoice agree on unit price, tax and total ...
  - Tests of the absorbed helpers ... are replaced by tests at the new interface ...
source: deepen playbook run, 2026-11-17, .mstack/progress/deepen_2026-11-17.md
seams:  StockroomService.quote and StockroomService.invoice_order; the single line-pricing function in stockroom/domain
```
B4 filed `one-line-pricing`, `order-reservations-module`, `order-lifecycle-predicates` and `product-input-parsing`, the same shape. Both runs wrote `deepen_2026-11-17.md` and one `decide --phase deepen` row. Each ended on a statement. B1's last line: "I haven't committed those changes because you didn't ask me to." B4's: "The new queue items, report and history entry are uncommitted on `main`, and the gate passes with warnings about exactly that." B1's final message has one `?`, inside "`José` reloads as `Jos?`". Both put the defects under "Found, not filed".

B2, the duplicate check against an open queue: "I filed nothing new this time. The architecture was already reviewed earlier today in a deepen run over all of `src/`, and items 76 to 80 came out of it. No code under `src`, `tests`, `hooks` or `bin` has changed since that run's commit `ed0ff5a`". It spot-checked three findings at head and listed 76 to 80 as "already in the queue" with one line each. It also gave three rejections and "Found, not filed: nothing new." It repeated items 79's "nine places" and 77's "five separate places" without recounting them. The run did not catch errors 1 and 2 above.

All of these are n=1 per prompt and project.

## Probe C: the vocabulary stays vocabulary

**C1, against the source** (`~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1`, `gitCommitSha` `49dd158d1076134a641b33efb035946536778336` in `installed_plugins.json`):
- Deletion test (`deep-modules.md:24-25`) against `codebase-design/SKILL.md` "Principles": near-verbatim and correct.
- "The interface is the test surface" (`:26-27`) against the same: correct ("probably the wrong shape" became "the wrong shape").
- "One adapter is a hypothetical seam; two make it real" (`:28-29`) against `DEEPENING.md` "Seam discipline" ("at least two adapters ... typically production + test. A single-adapter seam is just indirection"): correct.
- The four dependency categories (`:30-38`) against `DEEPENING.md` sections 1-4 (in-process: merge, no adapter; local-substitutable: stand-in, seam internal; remote but owned: port, transport adapter in production, in-memory in tests; true external: injected port, mock adapter): all four correct.
- Module, interface, depth, leverage, locality, seam and adapter match the source glossary. Nothing is misstated.
- Procedure: none. The only imperatives are the scope limiter (`:5-6`) and "delete them" inside the replace-don't-layer test (`:39-40`, from `DEEPENING.md`). Nothing spawns agents, explores or asks; the `DESIGN-IT-TWICE` process is not carried over.
- Each term is defined once across `deep-modules.md` and `skills/design/SKILL.md`. "Pass-through method" is defined only in `SKILL.md:54`, and `deep-modules.md` only uses the word. The "shallow" double characterisation is listed above.
- The 100k-token incident is real: `docs/engineering/codebase-design.md:54`, "I pointed a session at it and it burned 100k tokens redesigning things I never asked about" (issue #449).

**C2, the lens live.** In a copy of `sandbox/bench/template`, I committed `6686977`. It adds `bookings/app/quoter.py`, a `Quoter` class whose one method forwards four arguments to `pricing.quote`, and routes `book` through it (`service.py:5,22`). The pre-existing pass-through `BookingService.quote` (`service.py:16-17`) was left as the neighbour to see whether the reviewer redesigns it. The store had item 1 `quoter` (reviewing), with a green gate. Prompt in `prompt_c2.txt`: launch one `mstack:reviewer` with the `design` lens, path from `fanout plan`, and give it only the lens, the range and the path. Stream `streams/c2.jsonl`:
```
TOOL Bash | mstack fanout plan --kind review --worker design
TOOL Agent [mstack:reviewer] | Lens: design\nDiff range: 6686977~1..6686977\nReport path: .../c2/.mstack/progress/review_quoter_design.md
SUB TOOL Bash | mstack gate; ... git show --stat 6686977
SUB TOOL Read | /Users/romerma/Code/mstack/skills/design/references/deep-modules.md
SUB TOOL Bash | git show 6686977; cat -n bookings/app/service.py bookings/app/quoter.py; ... mstack gate --full; mstack ledger check quoter
AGENTRESULT mstack:reviewer totalTokens 15744 tools 5 ms 39658 toolStats {'readCount': 1, 'bashCount': 4, ...}
RESULT success turns 4 cost 0.249 ms 57155
```
Report `c2/.mstack/progress/review_quoter_design.md`: "Deletion test fails: Quoter is a pass-through. `bookings/app/quoter.py:8-9` ...", "The seam is only hypothetical, with zero substitutable adapters. `service.py:22` constructs `Quoter()` inline", "Locality got worse: there are now two pricing paths", and "Dependency category ... category 1 ... merge and test through the interface". Every finding is anchored on a line of the diff or on what the diff caused. It did not call `BookingService.quote` shallow in its own right (see the non-blocking note on change 2).

**C3, the controls the implementer did not run.** Same project and commit in fresh copies. `c3a` uses the `correctness` lens; `c3b` is a lone reviewer with no lens.

| Run | Read of deep-modules.md | Vocabulary findings | totalTokens (last context) | Summed subagent input over 5 calls | Tools | Subagent s | Session USD |
|---|---|---|---|---|---|---|---|
| C2 design | yes (1 Read) | deletion test, hypothetical seam, locality, category 1 | 15,744 | 55,620 | 5 | 39.7 | 0.249 |
| C3a correctness | none (`rg -c deep-modules` = 0) | none; requirement-to-test gap, revert check | 13,972 | 50,782 | 4 | 35.9 | 0.243 |
| C3b no lens | none (0) | none; same gap, recorded verifier-failed in its own store | 12,660 | 47,567 | 4 | 31.0 | 0.209 |

Neither control read the file or redesigned anything. All three suggested injecting the Quoter to make `book` testable, a test-gap remedy, not a redesign. The lens costs roughly 1.8k to 3k tokens of context in this run. n=1 each.

**C4, how a consumer reaches the file.** The C2 subagent ran in a project outside the plugin and read `/Users/romerma/Code/mstack/skills/design/references/deep-modules.md`, so `${CLAUDE_PLUGIN_ROOT}` in `agents/reviewer.md:43` resolved to the `--plugin-dir` checkout. The documentation, https://code.claude.com/docs/en/plugins-reference#where-each-variable-resolves, has the table row "Skill, command, and agent content | Anywhere in the Markdown body | Not applicable". It continues: "The variables aren't present in the environment of commands Claude runs through the Bash tool, in the main session or in a subagent. In skill, command, and agent content, write the `${...}` reference in the Markdown body instead, and Claude Code substitutes the path inline when it loads the content." It also says `${CLAUDE_PLUGIN_ROOT}` "Resolves to | Absolute path of the plugin's installed version". A marketplace install therefore resolves to the cache path by the same mechanism. That is documented, but I did not run it.

**C5, a large diff.** Two sentences limit the design reviewer. `agents/reviewer.md:45`: "Judge what the diff changes and nothing around it. Without the lens, do not read that file." `deep-modules.md:5-6`: "Apply them to the change in front of you and to nothing else: do not go looking for more to redesign." Neither caps output, and the reviewer has no outlet for something noticed outside the diff. On a large diff "what the diff changes" is large, but the text gives no licence to roam. In the one run, the reviewer stayed on the diff, with the one borderline required change noted above.

## Probe D: provenance and lint

- `deep-modules.md:1`: "vocabulary and tests from mattpocock/skills, skills/engineering/codebase-design/SKILL.md, DEEPENING.md and DESIGN-IT-TWICE.md @ 49dd158d... (MIT, licenses/mattpocock-skills-LICENSE.txt). Adapted: reduced to terms and tests with no process ...". It names the repository, path, commit and licence.
- `deepen.md:1`: "the procedure from mattpocock/skills, skills/engineering/improve-codebase-architecture/SKILL.md @ 49dd158d... (MIT, ...). Adapted: ... ends with candidates filed as pending items, capped at five". It names the repository, path, commit and licence.
- `diff licenses/mattpocock-skills-LICENSE.txt <source>/LICENSE` gives "licence identical to source LICENSE".
- Closeness. The vocabulary's definitions and tests are near-verbatim paraphrases, which is right for a glossary, and the header says they are "from" the source. Playbook steps 1-3 paraphrase source lines 22-35 (scope, git log hot spots, the friction questions, the deletion test). Steps 4-7 (cap, queue check, `state add`, stop) are new, and the HTML report and grilling loop are gone. "Adapted" is accurate for both files.
- Lint at head in a clone (`scratchpad/review57/lintclone`) passes. Removing each header fails:
  ```
  PASSED - 0 failures, 0 warnings
  == header removed from skills/design/references/deep-modules.md
  [fail]  skills/design/references/deep-modules.md: no origin header
  FAILED - 1 failure, 0 warnings
  exit 1
  == header removed from skills/router/playbooks/deepen.md
  [fail]  skills/router/playbooks/deepen.md: no origin header
  FAILED - 1 failure, 0 warnings
  exit 1
  == restored
  PASSED - 0 failures, 0 warnings
  ```
- The test fails without the code change (`git checkout 9ac4e7d -- src/lint.ts` in the clone):
  ```
  AssertionError: header removed from design/references/deep-modules.md: expected a failure, got a pass
  (fail) a file that must carry an origin header and does not is caught     # bun: 0 pass 1 fail
  ℹ pass 0  ℹ fail 1                                                       # node
  ```
  After restoring `src/lint.ts`: `1 pass 0 fail`.

## Probe E: wiring and docs

- Router row `skills/router/SKILL.md:46`. The skip list at `:25-26` adds "deepening (the playbook files its own items)". Length: 160 lines by `wc -l`, 158 at base.
- `intake.md:64-69`, Proportion, still holds: it sends programs of work to orchestrate and says nothing this route contradicts.
- Counts. `fd . skills/router/playbooks -t f | wc -l` gives 8, matching "eight" in `README.md:83,468`, `Skills-and-Playbooks.md:4,8,128` and `Home.md:63`. No "seven playbooks" remains outside `.mstack/` and `CHANGELOG.md`. README states no lens count. `The-Agents.md:159-163` adds the design lens. `Skills-and-Playbooks.md` has the route, discipline and leaves-behind rows. `CHANGELOG.md` has the entry.
- No em or en dashes in added product lines (`git diff ... | rg "^\+" | rg "—|–"` exits 1).
- The source skills are named only in the two origin headers (`rg -n "codebase-design|improve-codebase-architecture" skills agents docs README.md CHANGELOG.md`).
- `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`: "96 relative links checked, 0 broken".

## Probe F: regression at head (run before any live run started)

```
$ npm test
 592 pass   0 fail   Ran 592 tests across 27 files. [103.28s]      (bun)
 ℹ tests 592  ℹ pass 592  ℹ fail 0                                  (node)
npm test  98.97s user 111.34s system 156% cpu 2:14.47 total; exit 0
$ npm run typecheck        -> typecheck exit 0
$ ./bin/mstack lint-plugin . -> PASSED - 0 failures, 0 warnings
$ ./bin/mstack gate         -> PASSED - 0 failures, 0 warnings (80 items)
$ ./bin/mstack ledger check deep-module-vocabulary
FAIL no verdict at bfe37e2f; 1 row(s) exist at other SHAs and a new head SHA voids them
```
The load-sensitive tests (item 67) were green on the first run, so I did not rerun the suite. The implementer's row is at `ed0ff5a`, before the reviewing commit.

## Per criterion

| Criterion | Verdict | Evidence | Rung |
|---|---|---|---|
| "the design skill references the vendored vocabulary, and the reviewer has it as a lens, with origin headers" | Met | `skills/design/SKILL.md:51` links `references/deep-modules.md`; `skills/review/SKILL.md:29-30` and `agents/reviewer.md:40-45`; headers at line 1 of both files; lint and test fail without them (D); C2 reads the file with the lens, C3a/C3b do not | 5 for the lens (live, n=1 each); 4 for the headers |
| "a request such as '/mstack review the architecture' routes to a playbook that ends with candidates filed as pending items, each naming files, the deepening and its test surface, and asks the user nothing" | Met | B1 and B4 (final wording, two phrasings): deepen, 3 and 4 items with files, deepening, acceptance and seams, no question, no code change; B2 files none and says why; B3 does not route here | 5 (live, n=1 per run) |
| "that playbook run on this repository files its candidates, pasted in the report" | **Not met** | Items 76 to 80 are filed and pasted, but 76, 77, 79 and 80 each state something false about the code (Changes required 1-4) | 4 (claims checked with rg, bat and a live TSV probe at head) |
