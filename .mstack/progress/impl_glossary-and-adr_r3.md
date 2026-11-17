# Implementation report, round 3 - glossary-and-adr

Implementer, round 3, on `feat/glossary-and-adr` from head `000b846`. No plugin loaded: a
general-purpose agent playing the implementer role (`agents/implementer.md`,
`skills/test-first/SKILL.md`). Brief: the round 2 review's two blocking findings (how
`src/glossary.ts` reads `GLOSSARY.md`), plus non-blocking 1 (the comment case only), 3, 7, 8, 9,
11 and 14. Scratch files are in
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl58r3/`:
`mutants.mjs`, `mut.out`, `m24.out`, `cli.sh`, `doc-claims.out`, `doc-claims-d5.out`,
`allcases.ts`, the `red*.txt` files, the suite logs, and two clones, `head/` at `000b846` and
`mut/` at `85610bc`.

## What changed

The reader now works on blocks: a block is a run of text lines ended by a blank line or a heading,
and an HTML comment line is transparent inside it. It also classifies `##`/`###` sections by
their first line, as the brief's rules 1 to 4 say. A bold `Label:` line inside an entry
belongs to that entry and is not definition text. That covers a label directly under a bold term,
one indented under a list item, and one anywhere in a term heading's section. A file with no bold
entry is read by its headings, so cases 39 and 40 fail again. A heading needs a space after its
hashes. A leading byte order mark is now stripped, because the new margin rule would otherwise
hide the first entry (red output below).

These stay the same: failures, warnings, messages, the ok line, `src/gate.ts` and the exported
shape. `git diff 000b846..HEAD -- src/gate.ts GLOSSARY.md skills/router .mstack/state.json` prints
nothing, and no `export` line of `src/glossary.ts` changed.

Every glossary test has an explicit 60 s timeout (`GATE_TEST`, the `SPAWN_TEST` pattern of
`tests/state.test.ts:21`), and the CLI spawn has a 30 s one. In the docs:

- They say what the code does, with the decided limit in one clause.
- The ADR got the two wording edits.
- The wiki's closing list has the router's five steps.

## Files

| File | Lines | Change |
|---|---|---|
| `src/glossary.ts` | 232 (was 194) | the reader, rewritten around blocks and sections |
| `tests/glossary.test.ts` | 514 (was 368) | 15 new tests, 1 strengthened (BOM), `GATE_TEST` on all 39, the CLI helper with a timeout |
| `skills/reflect/references/domain-docs.md` | 44 | bullet 1: labels, tight lists, the limit, heading sections |
| `docs/wiki/Gates-and-Hooks.md` | | the glossary paragraph |
| `CHANGELOG.md` | | one clause in this item's entry |
| `docs/adr/0001-claude-code-only.md` | | the two wording edits, nothing else |
| `docs/wiki/How-A-Work-Item-Flows.md` | | five closing steps, as `skills/router/SKILL.md:152-163` |
| `.mstack/decisions.tsv` | | one `implement` row |
| `.mstack/progress/current.md` | | status line |

The file grew by 38 lines against "near 194". Most of the growth is the two small types (`Line`,
`Part`) and the section classification, which today's code did not have. I did not compress code
I did not need to touch.

```
68df839 test(gate): pin that a #### heading is not a glossary term
7ea0e45 docs: rewrap the glossary paragraphs
198b307 docs: attribute the adr's dated facts and list the router's five closing steps
d436d29 docs: say how the glossary check reads bold labels, headings and comments
85610bc fix(gate): read a bold line inside a glossary entry as part of that entry
```

`68df839` also carries a rename of one test, to "...whatever bold lines their sections hold"
(it was "...it also has"), because a bold entry under the `#` title does switch the file to
bold reading. The mutant table below quotes the old name, as it ran at `85610bc`.

## Commands: red before green

Slice 1, case 25 (`red1.txt`, bun, at `000b846` code):

```
AssertionError: an Example label under each entry: expected a pass, got ["GLOSSARY.md:7: entry \"Example\" repeats \"Example\" from line 4 -> merge the two or rename one"]
(fail) a bold label under a bold entry belongs to that entry and is not a term [254.03ms]
```

Slice 2, case 28 and the tight list. First at `000b846` code (`red2-head.txt`), then with slice 1's
code, where the tight list read as 1 entry (`red2.txt`):

```
AssertionError: a nested Synonyms label under each item: expected a pass, got ["GLOSSARY.md:6: entry \"Synonyms\" repeats \"Synonyms\" from line 4 -> merge the two or rename one"]
(fail) in a list, each unindented bold item is an entry and an indented bold label belongs to the item above [244.85ms]
AssertionError: The input did not match the regular expression /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/. Input:
(fail) in a list, each unindented bold item is an entry and an indented bold label belongs to the item above [262.33ms]
```

The BOM, with slice 2's margin rule and no strip (`red-bom.txt`). At `000b846` this assertion
passes, because `trim()` there removed the mark:

```
AssertionError: the entry behind the mark is counted
(fail) a byte order mark does not hide the first entry [643.26ms]
```

Slice 3, cases 26, 27, 39 and 40 (`red3.txt`). These ran with slice 2's code. With the label
directly under the paragraph (gap `""`), case 26 already passed there, so the gap `"\n"` form is
the red one:

```
AssertionError: an Example label under each heading term (gap "\n"): expected a pass, got ["GLOSSARY.md:13: entry \"Example\" repeats \"Example\" from line 7 -> merge the two or rename one"]
(fail) a bold label under a heading term belongs to that term, directly under its paragraph or after a blank line [688.63ms]
AssertionError: The input did not match the regular expression /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/. Input:
(fail) a file whose terms are headings is read by its headings whatever bold lines it also has [319.40ms]
```

Cases 11 and 31 (`red5-6.txt`). These were written and run before the restructure that turned them
green:

```
AssertionError: a comment between the term line and its definition: expected a pass, got ["GLOSSARY.md:3: entry \"Order\" has no definition -> write one or two sentences under it, or remove the entry"]
(fail) an HTML comment line inside an entry neither ends it nor counts as its definition [266.19ms]
AssertionError: a definition line that starts with a hashtag: expected a pass, got ["GLOSSARY.md:1: entry \"Tag\" has no definition -> write one or two sentences under it, or remove the entry"]
(fail) a line starting with #word is text, not a heading: a heading needs a space after the hashes [291.99ms]
```

The CLI test against `000b846`'s own `bin/mstack`. The test file was copied into the `head/` clone
(`red-cli.txt`, trimmed):

```
AssertionError:
...
-- glossary
[fail]  GLOSSARY.md:7: entry "Example" repeats "Example" from line 4
```

These were added from the mutant analysis and are red at `000b846` (`red-extra-at-head.txt`):

```
AssertionError: a Synonyms list item under each entry: expected a pass, got ["GLOSSARY.md:5: entry \"Synonyms\" repeats \"Synonyms\" from line 2 -> merge the two or rename one"]
(fail) a list-item label under a non-list bold entry belongs to that entry [315.30ms]
AssertionError: Expected values to be strictly deep-equal:
(fail) a bold phrase that starts a later line of a paragraph is not named as an entry missing its colon [298.72ms]
```

Here is the whole final test file at `000b846`'s code: `head/` clone, bun,
`red-all-at-head.txt` (summary lines). It ran before the last four tests were added:

```
(fail) a bold label under a bold entry belongs to that entry and is not a term
(fail) in a list, each unindented bold item is an entry and an indented bold label belongs to the item above
(fail) a bold label under a heading term belongs to that term, directly under its paragraph or after a blank line
(fail) a file whose terms are headings is read by its headings whatever bold lines it also has
(fail) an HTML comment line inside an entry neither ends it nor counts as its definition
(fail) a line starting with #word is text, not a heading: a heading needs a space after the hashes
(fail) the CLI reads bold labels as part of their entry and heading terms by their headings
 28 pass
 7 fail
```

Some tests passed the first time they ran, so they are guards. Each one was then seen to fail
under a mutant (table below):

- the upstream layout (M11)
- colons only (M18, the review's M26)
- a heading with only `_Avoid_` (M10, M19, the review's M43)
- this repository's glossary (M03, M20)
- the prose section first (M14)
- `####` (M24)

## R to test

All tests are in `tests/glossary.test.ts`.

| Expected result | Test (line) |
|---|---|
| case 25 passes, 2 entries | "a bold label under a bold entry belongs to that entry and is not a term" (381); CLI (462) |
| case 26, label directly under the paragraph and after a blank line, 2 entries | "a bold label under a heading term belongs to that term, ..." (402) |
| case 28 passes, 2 entries | "in a list, each unindented bold item is an entry ..." (391) |
| case 27 passes, counts the headings (2) | "a file whose terms are headings is read by its headings ..." (411) |
| case 39 fails `GLOSSARY.md:7: entry "Invoice" has no definition` | the same (411); CLI (462) |
| case 40 fails as a repeated term (`:7` repeats `:3`) | the same (411); CLI (462) |
| case 11 passes | "an HTML comment line inside an entry neither ends it ..." (422) |
| case 31 passes | "a line starting with #word is text, not a heading ..." (428) |
| tight list: 2 entries; repeated: fails at `:2` | "in a list, each unindented bold item ..." (391) |
| `**Order**:` / `**Example:** order 1042.` fails "has no definition" | "a bold label under a bold entry ..." (381), the `bare` case |
| upstream layout passes, 2 entries, no warning | "the upstream layout passes ..." (434) |
| this repository's `GLOSSARY.md`, green, no warning | "this repository's own GLOSSARY.md ..." (453); see the decide row; `./bin/mstack gate` prints 14 below |
| the reference's example passes | existing "the example in the reference passes ..." (172) |
| `**Order:**:` alone fails "has no definition" (review M26) | "a term line followed only by colons has no definition" (441) |
| a `##` term with only `_Avoid_:` fails "has no definition" (review M43) | "a heading term whose only line is an _Avoid_ line ..." (447) |
| 3 CLI tests: cases 25, 39, 40, exit code and the exact `-- glossary` section | "the CLI reads bold labels as part of their entry ..." (462) |
| non-blocking 8: explicit timeouts | `GATE_TEST = { timeout: 60_000 }` (line 15) on all 39 tests; `run()` spawns with `timeout: 30_000, killSignal: "SIGKILL"` |

## Mutants

`mutants.mjs` ran on the `mut/` clone at `85610bc`. It applies one single-line mutant at a time,
runs `tests/glossary.test.ts` on bun and on node, and restores the file after each one
(`restored: true`, and `git -C mut status --short` prints nothing). M24 survived that run. It was
re-run by hand after its test was added (`m24.out`). Every kill below happened on both runtimes,
with the same tests failing.

| Mutant | Rule | Killed by |
|---|---|---|
| M01 comment lines blank again | 1, transparent comments | "an HTML comment line inside an entry ..." |
| M21 a comment line ends a block | 1 | the same |
| M02 `HEADING` with `\s*` after the hashes | heading needs a space | "a line starting with #word is text ..." |
| M03 a heading followed by a bold entry is term-led | 2, classification | "a well-formed GLOSSARY.md ..."; the reference example; this repository's glossary; "a section of prose ..." |
| M15 a deeper heading does not make a heading group | 2 | "one heading per term followed by a paragraph ..." (the grouped file) |
| M22 a level-1 heading can be a term | 2 | "a file in which no entry is recognised warns once ..."; "a bold term with no colon ..." |
| M23 the term-led flag never set | 2 | "a bold label under a heading term ..."; "a file whose terms are headings ..."; CLI |
| M04 a term-led section holds bold entries | 2/3 | the same three |
| M14 a heading does not reset the term-led flag | 2 | "a section of prose under a ## heading does not hide ..." |
| M24 a `####` heading is a section | 2 | "a #### heading is not a term heading: only ## and ### are" (bun `38 pass 1 fail`, node `pass 38 fail 1`, `m24.out`) |
| M05 a block's first line never starts an entry | 3, bullet 1 | 27 tests |
| M06 a later list item never starts an entry | 3, bullet 2 | the forms test; "in a list, each unindented bold item ..." |
| M07 a list item under a non-list entry starts an entry | 3, bullet 2's "unless" | "a list-item label under a non-list bold entry ..." |
| M08 an indented line can start an entry | 3, bullet 3 | "in a list, each unindented bold item ..." (case 28) |
| M09 a bold label counts as definition text | 3, bullet 3, labels excluded | "a bold label under a bold entry ..." (the `bare` case) |
| M10 an `_Avoid_` line counts as definition text | 3, bullet 3 | "the _Avoid_ line is not part of the definition ..."; "a heading term whose only line is an _Avoid_ line ..." |
| M16 the no-colon warning on any unowned line | 3, bullet 4 | "a bold phrase that starts a later line of a paragraph ..." |
| M11 headings win over bold entries | 4, bold branch | "the _Avoid_ line ... a heading ends the entry above it"; upstream layout; "a section of prose ..." |
| M12 no heading reading | 4, heading branch | 5 tests, among them the heading test, cases 26/27/39/40 and the CLI |
| M13 an empty heading is not an entry | 4, empty heading | the heading test; "a file whose terms are headings ..."; CLI |
| M19 a heading definition keeps labels and `_Avoid_` | 4, definition minus labels | "a heading term whose only line is an _Avoid_ line ..." |
| M20 a heading does not end a block | blocks | 8 tests |
| M17 the byte order mark not stripped | BOM | "a byte order mark does not hide the first entry" |
| M18 leading colons of the rest not stripped (review M26) | | "a term line followed only by colons has no definition" |

There are no survivors, so I did not run the full suite under a mutant.

## Commands: verify

Everything below ran at `68df839`, the last commit with code or tests. The machine was under
load the whole time: `uptime` showed load averages from 9.3 to 14.7.

**Full suite.** `npm run test:bun` and `npm run test:node` ran separately, so the node half ran
even after bun's failure (`suite-bun-final.log`, `suite-node-final.log`):

```
$ npm run test:bun
(fail) ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict [5722.14ms]
  ^ this test timed out after 5000ms, before its done callback was called. ...
 630 pass
 1 fail
Ran 631 tests across 28 files. [221.43s]
$ npm run test:node
ℹ tests 631
ℹ pass 631
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 100121.683416
```

The one bun failure is `tests/verdict-reader.test.ts`, which is not among the three
load-sensitive tests the brief names. No test outside `tests/glossary.test.ts` mentions the
glossary: `rg -l 'GLOSSARY|glossary' tests` printed only `tests/glossary.test.ts` in round 2, and I
added none. Here is that file alone, in this checkout and in the `head/` clone at `000b846`
(without this round's code):

```
$ bun test tests/verdict-reader.test.ts            # this checkout
(fail) ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict [6142.05ms]
 19 pass
 1 fail
Ran 20 tests across 1 file. [6.18s]
$ bun test tests/verdict-reader.test.ts            # head/ clone, 000b846
(fail) ledger check and the gate's closing audit agree on every sequence, because both read through readVerdict [6029.25ms]
 19 pass
 1 fail
Ran 20 tests across 1 file. [6.06s]
```

The round 2 review records the same test timing out at its head (`[23334.58ms]`). It passes on
node in the full run above. I did not touch it.

**The glossary tests alone** (39 tests), and the type check:

```
$ bun test tests/glossary.test.ts
 39 pass
 0 fail
Ran 39 tests across 1 file. [22.82s]
$ node --disable-warning=ExperimentalWarning --experimental-strip-types --test tests/glossary.test.ts
ℹ tests 39
ℹ pass 39
ℹ fail 0
$ npm run typecheck
> bunx --bun tsc --noEmit                  (no output)
```

**Gate and lint.** `./bin/mstack lint` does not exist: it prints `mstack: unknown command 'lint'`,
so the lint ran as `./bin/mstack lint-plugin .`:

```
$ ./bin/mstack version
mstack 0.2.1 at /Users/romerma/Code/mstack
$ ./bin/mstack gate
...
-- glossary
[ok]    GLOSSARY.md: 14 entries, each a term with a one or two sentence definition

-- workspace
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[ok]    on branch feat/glossary-and-adr
[warn]  3 uncommitted change(s); expected mid-session, not at close

PASSED - 0 failures, 1 warning
$ ./bin/mstack lint-plugin .
...
-- references
[ok]    24 reference file(s), every relative link resolves
...
PASSED - 0 failures, 0 warnings
```

The gate's one warning is this report, `current.md` and `decisions.tsv`, which were uncommitted
when the gate ran. The next commit carries them. Every other line was `[ok]` (`gate-final.out`).

**Cases 25, 39 and 40 through the CLI, both runtimes.** Each ran in a fresh copy of a throwaway
repository (`git init`, a commit, this checkout's `setup`, branch `feat/x`, `GLOSSARY.md`
committed). The gate ran as `bun src/cli.ts gate` and as
`node --disable-warning=ExperimentalWarning --experimental-strip-types src/cli.ts gate` from this
checkout, with the copy as the working directory (`cli.sh`, `cli-final.out`):

```
== case25
bun rc=0 PASSED - 0 failures, 0 warnings
    [ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
node rc=0 PASSED - 0 failures, 0 warnings
    [ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
== case39
bun rc=1 FAILED - 1 failure, 0 warnings
    [fail]  GLOSSARY.md:7: entry "Invoice" has no definition
            fix: write one or two sentences under it, or remove the entry
node rc=1 FAILED - 1 failure, 0 warnings
    [fail]  GLOSSARY.md:7: entry "Invoice" has no definition
            fix: write one or two sentences under it, or remove the entry
== case40
bun rc=1 FAILED - 1 failure, 0 warnings
    [fail]  GLOSSARY.md:7: entry "Order" repeats "Order" from line 3
            fix: merge the two or rename one
node rc=1 FAILED - 1 failure, 0 warnings
    [fail]  GLOSSARY.md:7: entry "Order" repeats "Order" from line 3
            fix: merge the two or rename one
```

**Each sentence the docs now state about the check**, through the same script on both runtimes
(`doc-claims.out`, `doc-claims-d5.out`; the two runtimes agreed on every case, and bun's line is
shown):

| Doc statement | Input | Gate |
|---|---|---|
| a line that *starts with* `**Term**:` | `  **Order**: A request ...` (indented) | rc 0, `[warn] no entry recognised ...` |
| entries are separated by blank lines | `**Order**: ...` / `**Invoice**: ...` on consecutive lines | rc 0, `1 entry` |
| list items may follow each other directly | tight `- **Order**:` / `- **Invoice**:` | rc 0, `2 entries`; repeated: rc 1, `:2: entry "Order" repeats "Order" from line 1` |
| a label directly under a term's lines belongs to it and is not its definition | case 25; `**Order**:` / `**Example:** order 1042.` | rc 0, `2 entries`; rc 1, `:1: entry "Order" has no definition` |
| or indented under its list item | case 28 | rc 0, `2 entries` |
| after a blank line it is read as a term, so the same label under two terms is a repeated term | `**Order**: ...` / blank / `**Example:** ...` x2 | rc 1, `:7: entry "Example" repeats "Example" from line 3` |
| one heading per term followed by a paragraph | case 04 | rc 0, `2 entries` |
| a bold line under such a heading belongs to that term | case 26, both ways; case 27 | rc 0, `2 entries` each |
| headings only in a file with no bold entry | the upstream layout | rc 0, `2 entries` (Relationships not counted) |
| a comment line inside an entry does not end it | case 11 | rc 0, `2 entries` |
| (non-blocking 3) `#word` is text | case 31 | rc 0, `1 entry` |

**Line counts:**

```
$ wc -l src/glossary.ts skills/router/references/intake.md
     232 src/glossary.ts
      77 skills/router/references/intake.md
```

**The ADR and the wiki:** wording only. `git diff 000b846..HEAD -- docs/adr` shows the two
sentences changed and nothing else. The wiki's closing list now has the router's step 1 and step
4's clause "unless it records a parked fork" (`skills/router/SKILL.md:154-161`). The memory note
behind the ADR's defect sentence holds both the pause and the defects ("after a 2-month pause;
the port also had open defects ..."). The round 2 review read the same note (its Probe B table).

## Decisions recorded

```
$ tail -1 .mstack/decisions.tsv
2026-11-17T21:50:38.347Z	implement	item 58 r3: the test on this repository's own GLOSSARY.md expects as many entries as the file has lines starting with '**' (14 today), not the literal 14	a literal 14 would turn the suite red on every term a later item adds, which domain-docs.md asks items to do; the line count is the file's own shape, not the reader's logic	tests/glossary.test.ts, test 'this repository's own GLOSSARY.md passes with no warning, and each of its bold term lines is an entry'; ./bin/mstack gate prints 14 entries	if wrong: a later glossary line starting with '**' that is not an entry makes the test fail, and the expected value becomes a literal
$ rg -c '^\*\*' GLOSSARY.md
14
```

This departs from the brief's "literal expected values" for this one test. The oracle is the
file's shape, not the reader.

No rule turned out ambiguous on a real input, so no `implement` row was needed for a reading.
Three points come from a literal reading of the rules, and each is shown by a command above:

- An indented `**Term**:` line is not an entry. D1 gives the no-entry warning.
- A non-list bold line after a prose first line of a block starts no entry.
- Lines after a later `#` heading are outside every `##`/`###` section, so they can hold bold
  entries.

## What I could not show, or left alone

- `./bin/mstack lint` does not exist (`mstack: unknown command 'lint'`). The lint is
  `./bin/mstack lint-plugin .` (`npm run lint`), pasted above.
- ADR line 13's first sentence still says "none of its four commits in this clone is on a remote
  branch". The brief named only the second sentence, so I left the first as it was.
- Cases 10 (definition after a blank line), 12 (after a rule) and 36 (a four-backtick fence) read
  as at `000b846`. They are out of scope (non-blocking 1's blank-line and rule halves, and
  non-blocking 4). `allcases.ts` runs every reviewer case through `readGlossary`, and its output
  matches the review's table except for the cases this round fixes.
