# Review - any-role-name-closes (item 82), round 2

**Verdict:** APPROVED

Reviewed at `aa09c28713f1ab3ad2898fbb44497178a2638947`: the round 2 diff `07bccd0..aa09c28` against the
item's base `7d71f2e`. Every probe ran through the real CLI in throwaway repositories under the scratch
directory `.../scratchpad/review82r2/` (each script `X.sh` with its `X.out`). The base CLI is a scratch
clone of `7d71f2e` (`review82r2/base/`), the mutants ran in a second clone (`mut/`), so this checkout's
`.git` gained nothing.

Both round 1 blocking findings are fixed. I found no new blocking finding. The Getting-Started gap that
was filed as item 96 is real, and it predates this item: at the base, the same page was refused at its
close by the same two checks.

## Round 1 blocking 1: the three walkthroughs (fixed)

I built each repository from the page: `greet.py` and `test_greet.py` committed on `main`, `mstack
setup`, the page's own `state add` flags, the `--shout` work, and the commits (`gs.sh`, `readme.sh`,
`agents.sh`, `common.sh`). Then I diffed every block the round touched against my run, output lines
only, with the shas normalised (`cmp.sh`, `cmp2.sh`):

| Page block | My run | Result |
|---|---|---|
| `Getting-Started.md:214-221` (reviewing, verifying) | `gs-head.out:154-162` | identical |
| `Getting-Started.md:232-236` (the refusal) | `gs-head.out:164-167` | identical |
| `Getting-Started.md:242-257` (reviewer row, close, gate) | `gs-head.out:169-205` | row identical; the close is refused (point 2) |
| `README.md:202-210` (implementer row, refusal) | `readme-head.out:17-35` | identical, once `reviewing`/`verifying` are run as `# from verifying` says |
| `The-Agents.md:73-81` (implementer row, forced close) | `agents-head-report.out:1-9` | identical |
| `The-Agents.md:89-100` (reviewer row, close, gate) | `agents-head-report.out:20-44` | identical (the gate line is at `:44`) |
| `Gates-and-Hooks.md:289-297` (new fix line) | `gh.out:1-13` | identical apart from the block's two-space indent |

The refusal, exactly as a literal follower gets it (`gs-head.out:164-167`):
```
$ mstack state set greet-flag --status done --closed-by "demo walkthrough"
mstack: greet-flag cannot close: its only verdicts are from the pass that wrote the code (only implementer)
        a closing verdict has to come from a pass that did not write the code; run the verification again from one and record the row under a name that is not the author's (your own name, or `ci`), or, if no check could be run, record `verifier-blocked` under such a name
[exit 2]
```
It reproduces even while the receipt and the table are missing. `src/cli.ts:716` reports the first
non-overridable problem, and `independentVerdict` comes before `requirementTable` in `CLOSING_CHECKS`
(`src/closing.ts:259`).

- **What the pages teach.** I read the paragraph around each block. The-Agents still makes the point
  "nobody approves their own work", and now with the stronger form: `--force` does not help. Getting-Started's
  "the author's word is not enough" holds: the close refuses, and a second pass's row closes it. The
  README's "Both refusals are the product behaving as designed" still counts two refusals.
- **`rg -n "closed_by|--closed-by|status done" README.md docs/wiki/*.md`.** I read every hit: README
  194/207/257, Getting-Started 207/233/248, The-Agents 78/94/222, The-CLI 202/404-421/467,
  How-A-Work-Item-Flows 76/190, Gates-and-Hooks 258-263/294/343/579/598, and State-Files 60. None
  shows or says that an item closes on the implementer's row alone. `How-A-Work-Item-Flows.md:83-85`
  ("a forced close with no verdict is caught on the next run") is the zero-row case, and it is still
  true (`msgs.out`, zero rows).
- **Neighbouring blocks.**
  - Getting-Started: commit `4b63888`, both rows at `4b63888b`, then `ccb9e2e` and `542ac0c`.
  - The-Agents: both rows at `62849b5a`.
  - README: `4b63888b`.
  - All three: id 1, slug `greet-flag`. Nothing named later went stale.

## Round 1 blocking 2: `The-Agents.md:223` and the CHANGELOG headline (fixed)

Both now say: author-only verdicts are refused (and so is an approval citing the author's report); an
item with no row still closes, and the next gate fails it. One run for each half (`msgs.sh`):
```
=== A-implementer: door      mstack: demo cannot close: its only verdicts are from the pass that wrote the code (only implementer)   [exit 2]
=== D-cites-impl: door       mstack: demo cannot close: its closing verdict cites the implementer's own report (reviewer)   [exit 2]
######## zero rows            1 demo (done) [close exit 0]
                             [fail]  items marked done with no ledger verdict at all: demo   [gate exit 1]
```

## Point 2: item 96 is older than this item, so it is non-blocking here

I followed `docs/wiki/Getting-Started.md` command by command (`gs.sh head`, `gs-head.out`):

- **The first output that differs from the page** is `mstack setup` itself.
  - It prints two more lines: `costs.tsv ready` and `.mstack/.gitattributes ready`.
  - The store commit is `8 files changed, 64 insertions(+)`, where the page says 6 and 56.
  - `state set --status in_progress` prints a `base:` line that the page does not show.
  - All three are older drift, which this round did not touch.
- **The first step that refuses where the page succeeds** is the close after the reviewer's row
  (`gs-head.out:173-176`):
  ```
  mstack: greet-flag cannot close: `python3 -m unittest test_greet -v` has never been executed; it has no implementation report to read, .mstack/progress/impl_greet-flag.md or a later round of it
          run 'mstack gate --full'; nothing else executes it, and a verification nobody runs is not a check; --force closes it anyway
  ```
- **The two steps the page leaves out** are an `impl_greet-flag.md` with its table, and then
  `gate --full`. With both added, the page's close and gate lines come out exactly (`gsfix.out:20-22`,
  `:40`, `:47`).
- **At the base.** The base CLI on the base page (`gs.sh base`) is refused at the base page's close.
  That close came straight after `verifying`, and the page showed it as `1 greet-flag (done)`. The
  refusal names the same two problems (`gs-base.out`, the close after `verifying`).
- **Judgement.** The page already showed a close that a literal follower could not get, for the
  receipt and the table. This round moved that close after the reviewer's row and changed nothing
  about why it fails. The part this round added, the refusal, reproduces literally. So it is not a
  false transcript of this item's making, and it belongs to item 96.

The README is the same case:
- At the base, its `$ mstack gate    # after moving the item to done` could not be reached: the move is
  refused for the missing report (`readme-base.out`).
- At head, the refusal block reproduces.
- The new prose, "the close goes through", fails on the same table check (`readme-head.out:41-44`).

The-Agents reproduces at head when the report that its implementer row cites
(`.mstack/progress/impl_greet-flag.md`) exists (`agents-head-report.out`). Without that report:
- the base's forced close prints `closed_by: (unset) -> "closed without a good requirement-to-test tab..."`
  and a `forced:` line (`agents-base-bare.out`);
- the head's close is refused on the table (`agents-head-bare.out`).

The page names that report itself, so I count it as reproducible. Item 96's acceptance already covers
all three pages.

## Point 4: the upgrade note in the CHANGELOG holds

Each store was built and closed with the base CLI, then checked with head's gate. One `--verifier
reviewer` row was then added with head's CLI (`upgrade.sh`, `upgrade.out`):

| closed under | base close / base gate | head gate | + one reviewer row |
|---|---|---|---|
| `dev`, `author`, `self`, `ci:dev`, `impl`, `me` | `1 demo (done)` / exit 0, `[ok] 1 closed item(s) carry a ledger verdict` | exit 1, `[fail]  items closed on a verdict from the pass that wrote the code: demo (only dev)` (and `only author`, `only ci:dev` and so on), with the new fix line | exit 0, `PASSED - 0 failures, 2 warnings` |

At `verifying`, with only an `implementer` row or only a `dev` row, the base gate exits 0 with nothing
about it. The head gate exits 1 with `[fail]  1 demo (verifying) is one step from done, and its only
verdicts are from the pass that wrote the code (only implementer)`. The note is true as written.

## Point 5: the door and the gate print the same thing

Each case was run twice: at `verifying` through the door, and as a done item through the gate's audit.
For the audit, the item was closed with zero rows and the row was added afterwards (`msgs.sh`,
`msgs.out`):

| rows | door, and gate at `verifying` | gate audit of the done item | fix line, in all three |
|---|---|---|---|
| `implementer` | `... (only implementer)` | `items closed on a verdict from the pass that wrote the code: demo (only implementer)` | `SELF_CLOSED_FIX` |
| `spec-author` | `... (only spec-author)` | `... demo (only spec-author)` | `SELF_CLOSED_FIX`, with no "implementer" |
| `-implementer` (stored as `'-implementer`) and `Spec_Author` | `(only -implementer)`, `(only Spec_Author)` | `(only -implementer)`, `(only Spec_Author)` | `SELF_CLOSED_FIX` |
| `reviewer` citing `impl_demo.md` | `its closing verdict cites the implementer's own report (reviewer)` | `items closed on a verdict whose evidence cites the implementer's own report: demo (reviewer)` | `FORGED_IMPL_FIX` |

- At `verifying`, the gate prints the door's reason word for word.
- The fix line names the way out. Under `ci`, a `verifier-blocked` row closes, and so do `coordinator`
  and `Some Person` (`gh.out`).
- `rg -n "typedName|normalisedRole" src` finds only `roles.ts:143,165,178-186`, `closing.ts:196` and
  `gate.ts:507`.
- `normalisedRole` runs the same regex as before, moved into `typedName`. Nothing else reads the
  stripped name.

## Point 6: the colon rule

What happens at the door, and at the gate after the close (`msgs.out`):
```
[ci:dev]           close=2 gate=1  ... (only ci:dev)
[dev:ci]           close=0 gate=0  1 demo (done)
[a:b:implementer]  close=2 gate=1  ... (only a:b:implementer)
[implementer:]     close=2 gate=1  ... (only implementer:)
[:]                close=2 gate=1  ... (only :)
[mstack:reviewer]  close=0 gate=0      [self:reviewer]  close=0 gate=0
```
- **GLOSSARY.md:37.** Still two sentences. `./bin/mstack gate` prints `[ok]    GLOSSARY.md: 14 entries,
  each a term with a one or two sentence definition`.
- **What the glossary predicts.** It says "compared as the whole part after the last colon". With its
  list's "an empty name", that predicts all five lines above: `implementer:` and `:` leave an empty
  name.
- **`Gates-and-Hooks.md:283-284`.** It says "the whole name after its last `:`". Its list leaves out the
  empty name, so by its "every other name ... closes", `implementer:` would close. That omission is
  older than this round (see non-blocking 4).

## Point 7: tests

- **Hunks.** `git diff 07bccd0..aa09c28 -- tests | rg "^@@"` gives:
  - `closing-role.test.ts`: `@@ -74,7 +74,7 @@` (the regex at `:77`) and `@@ -180,3 +180,57 @@` (four
    tests appended at the end);
  - `verdict-reader.test.ts`: `@@ -115,7 +115,7 @@`, one comment line for one, 151 lines before and
    after.
- **Cited lines.** I printed every line the two implementer reports' tables cite: `:72`, `:82`, `:91`,
  `:109`, `:187`, `:205`, `:218` and `:231`. Each is the `test(` line of the test its row names. `:72`,
  `:82`, `:91` and `:109` are the same lines at `07bccd0`, so no cited line moved.
- **The regex at `:77`.** It asserts the new fix line, just as before it asserted the old one. It is
  no weaker.
- **Red first** (`red.sh`: head's tests on round 1's `src`): `9 pass 4 fail`. The four are `:72`,
  `:187`, `:205` and `:218`, as the report says.

Mutants (bun; `closing-role`, `verdict-reader` and `gate.test.ts`; baseline `112 pass 0 fail`;
`mutants.sh`):
```
M1 fix line loses verifier-blocked          111 pass 1 fail   the refusal names the way out ...
M3 door prints the stored cell              111 pass 1 fail   the refusal prints the name as typed ...
M4 roleOf keeps the whole name              109 pass 3 fail   a plugin-qualified role ...; :72; the colon test
X1 gate audit prints the stored cell (mine) 112 pass 0 fail   survives
X2 gate audit fix line drifts (mine)        112 pass 0 fail   survives
```
X1 and X2 are non-blocking 1. The implementer wrote that M4 is killed by "the colon test (and 13
others)". Over these three files it fails 3 tests.

Five runs per runtime, of the two changed files only, with `HOME=` and `GIT_CONFIG_GLOBAL=/dev/null`.
They ran in a scratch clone at `aa09c28`, because bun run with an empty `HOME` writes `Library/Caches/bun`
into its working directory (`timing.sh`):
```
bun  runs 1-5: 34 pass 0 fail each, 27.26-27.37 s     node runs 1-5: pass 34 fail 0 each, 27.1-27.3 s
slowest, bun (junit, runs 1-5): :72 9.06-9.16 s, verdict-reader :131 6.52-6.56 s, :82 4.43-4.49 s
slowest, node:                  :72 13.61-13.69 s, verdict-reader 6.94-7.02 s, :82 6.82-6.92 s
the four new tests, bun / node: :187 0.28-0.29 / 0.42-0.43 s, :205 0.17 / 0.26-0.27 s, :218 0.16-0.17 / 0.26-0.27 s, :231 0.53-0.55 / 0.83-0.84 s
```
- The four new tests are far under bun's 5 s default, and each declares `{ timeout: 60_000 }`.
- Three older tests run past 5 s: `:72`, `:82` on node, and verdict-reader. Each declares 120-300 s,
  as in round 1.
- The only two tests without a timeout are the pure `readVerdict` tests at verdict-reader `:75` and
  `:82`.

## The round 2 report and its rebuttals

`impl_any-role-name-closes_r2.md` is 8732 bytes, and its table has a row for each of A1, A2 and A3. Its
claims that I checked hold:
- red first, the colon test passing at once, the upgrade runs, the messages, and the line count;
- the claims against the pages hold where they compare refusal lines.

"Findings not applied":
- **The zero-row close, the zero-width and look-alike names, and the lone `verifier-failed` reason, all
  left to item 95.** That holds: item 95's acceptance names all three, and this round made none of them
  worse.
- **The Getting-Started gap, left to item 96.** That holds, for the reason in point 2. The report
  discloses that its `prep` step was run off the page (`impl82r2/common.sh`, the comment on `prep()`).

Decision rows since round 1: the round 2 `design` row, 249. It adds no `implement` row, and the round
made no decision that needed one.

## Acceptance, quoted

**"the roles whose verdict may close an item are decided by a rule the code states, and a verdict
recorded as self, coordinator or an unknown name does not close an item, or the report shows why an
open set is intended and the decision is recorded"**: met, by the "or" branch.
- The rule is stated once (`src/roles.ts:126-188`), and decision row 245 argues the open set.
- CLI (`gh.out`): `[self] close=2 gate=1`, `[coordinator] close=0 gate=0`, `[Some Person] close=0 gate=0`.

**"an item whose only verdict is the implementer's is refused at state set --status done with the reason
the gate gives, instead of closing and turning the gate red afterwards"**: met.
- CLI (`msgs.out`, case A): the door exits 2 with `its only verdicts are from the pass that wrote the
  code (only implementer)` and `SELF_CLOSED_FIX`.
- The gate at `verifying` prints the same reason and the same fix line.
- At the base, the close exited 0 and the gate went red afterwards (`upgrade.out`, verifying rows; round 1
  `probeB-old.out`).

**"GLOSSARY.md's Closing role entry and docs/wiki describe the rule as the code then implements it"**:
met.
- The glossary, `Gates-and-Hooks.md`, `The-Agents.md:219-225` and the three walkthroughs are now true
  of the code. CLI: the walkthrough runs above, and the gate's glossary line.
- One sentence in `The-CLI.md:475` still leaves out the colon rule (non-blocking 2). It fails closed,
  and round 1 judged that same paragraph true.

## Verification I ran (in this checkout)
- **`npm run typecheck`**: exit 0.
- **`./bin/mstack lint-plugin .`**: `PASSED - 0 failures, 0 warnings`.
- **`node scripts/check-doc-links.mjs README.md docs/wiki/*.md`**: `105 relative links checked, 0
  broken`.
- **`npm run test:bun`**: `879 pass` and `0 fail`, `Ran 879 tests across 42 files. [195.52s]`.
- **`npm run test:node`**: `tests 879`, `pass 879`, `fail 0`. No test failed, so there was none to
  rerun alone.
- **`./bin/mstack gate`**: `PASSED - 0 failures, 0 warnings`, including `[ok]    GLOSSARY.md: 14
  entries, ...`.
- **`./bin/mstack ledger check any-role-name-closes`** before my row: `FAIL no verdict at aa09c287; 3
  row(s) exist at other SHAs and a new head SHA voids them`.

The rung I record:
- **`live-verified`** for the CLI claims. That is rung 5: this checkout's `./bin/mstack` at `aa09c28`,
  run in fresh git repositories built from the pages, and on stores the base CLI wrote.
- **Rung 4** for the tests and the mutants.

## Non-blocking

1. **The gate's side of two message guarantees has no test** (mutants X1 and X2 survive).
   - `gate.ts:507` (the audit prints `typedName`) and `gate.ts:541` (the audit's fix line is
     `SELF_CLOSED_FIX`) can each be reverted with all of `closing-role`, `verdict-reader` and
     `gate.test.ts` green.
   - `:187` compares the door with the gate at `verifying`, which is `closing.ts`'s own problem, not the
     audit. `:218` checks the door only.
   - A test that closes with zero rows, adds a `-implementer` row and asserts the audit's line and fix
     line would pin both.
2. **`docs/wiki/The-CLI.md:474-475`** still says "a whole name is compared, ignoring case, spaces,
   hyphens and underscores (`dev-ci` is not `dev`)".
   - By that sentence `ci:dev` closes, and it is refused (point 6).
   - Row 249 says the wiki would state the colon rule. GLOSSARY and Gates-and-Hooks now do, and this is
     the one place left.
   - One clause fixes it.
3. **The discounted lists still print the stored cell.** A `-rev` row citing `impl_demo.md` prints
   `('-rev)` at the door, at `verifying` and in the audit (`disc.sh`). They agree with each other, but
   not with the author-only lists, which this round fixed (`closing.ts:200`, `gate.ts:513`). Item 95's
   apostrophe criterion should name these too.
4. **`Gates-and-Hooks.md:283-284`.**
   - Its list leaves out the empty name, which the glossary includes, so `implementer:` reads as closing.
   - The two lines run to 147 and 137 characters in a paragraph wrapped at about 100.
   - The new comment line at `tests/verdict-reader.test.ts:118` is 168 characters.
5. **Older drift in blocks this round did not touch, for item 96.**
   - The README's `state set --status in_progress` block has no `base:` line.
   - Getting-Started's `setup` output and its store commit (6 files and 56 insertions, where a run gives
     8 and 64).
   - Getting-Started's `chore: close greet-flag` commit becomes 3 files once the report exists.

## What I did not check

- `./bin/mstack gate --full`, which records a run, and `claude plugin validate . --strict`.
- Node 22.6. Only node 26.13.1 and bun 1.3.11 are here.
- Concurrent closes, and wiki transcripts outside the blocks named above.
