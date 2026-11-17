**Verdict:** CHANGES_REQUESTED

# Review - glossary-and-adr, round 3

Reviewed alone, round 3, at `eef0991035986f4fe68b522233d96fa87fff64ee`, diff
`git diff 3a6fab4..eef0991 -- . ':!.mstack'` (7 files, +302 -112). Every claim below comes from a
command I ran; the implementer's report was not used as evidence. CLI probes ran in throwaway
repositories under the scratchpad (`review58r3/`): a template made with `git init`, a commit, this
checkout's `setup`, a commit and a `feat/x` branch (gate green, 0 warnings), copied once per case
with the glossary committed. Each case ran as `bun src/cli.ts gate` and `node
--disable-warning=ExperimentalWarning --experimental-strip-types src/cli.ts gate` from this checkout
(`run.sh`); the glossary section was identical on both runtimes in every case below. Mutants ran
in clones (`review58r3/head`, `head2`, `head3`), never in this working tree. Load averages were 8.5
to 24 during the run (`uptime`).

The code matches the decided design (rows 188 and 189 of `.mstack/decisions.tsv`, the brief's
bullets) on every input I tried: 8 in probe A, 32 in probe B, 3 more in X, 34 in probe C. Both
round 2 blocking findings are closed. The one blocking finding is in the docs, and the fix is one
clause.

## Blocking findings

### 1. skills/reflect/references/domain-docs.md:23 and docs/wiki/Gates-and-Hooks.md:286-287: they say a bold line under a term heading belongs to that term, but as the first line under the heading it is read as a term

`domain-docs.md:23`: "A file may use one `##` or `###` heading per term followed by a paragraph
instead, and a bold line under such a heading belongs to that term." `Gates-and-Hooks.md:286-287`:
"A bold label such as `**Example:**` directly under a term, indented under its list item, or under
its heading belongs to that term". By the decided rule, a heading whose first non-blank line is an
unindented bold-colon line only groups, and that line becomes a bold entry
(`src/glossary.ts:164`). So the same label first under two term headings is a repeated term. The
file below has no missing definition and no repeated term, and it follows the sentence above:

```
$ bat -pp GLOSSARY.md                     # case x5
# G

## Order

**Also known as:** purchase order.

A request to buy something.

## Invoice

**Also known as:** bill.

A request for payment.
$ bun src/cli.ts gate                      # node: same section
-- glossary
[fail]  GLOSSARY.md:11: entry "Also known as" repeats "Also known as" from line 5
        fix: merge the two or rename one
FAILED - 1 failure, 0 warnings             # rc 1 on bun and on node
```

The same happens with a label written on the line just above the definition: case b21
(`## Order` / `**Category:** Sales` / `A request to buy something.`, the same under `## Invoice`)
gives `[fail] GLOSSARY.md:10: entry "Category" repeats "Category" from line 5`, rc 1 on both
runtimes. The Stop hook carries it to the model:
`{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The mstack gate is red. Fix these before closing:\n- GLOSSARY.md:10: entry \"Category\" repeats \"Category\" from line 5 -> merge the two or rename one"}}`.

This is the decided limit "a heading-per-term file whose first paragraph under each heading is a
bold label", so the code is not the finding. The finding is that the format reference, which is
where a writer learns the format, says this layout is fine. How ordinary it is: a metadata or
alias line first under each term heading (`**Also known as:**`, `**Synonyms:**`, `**Category:**`)
is less common than a label under the definition. It is a recognisable style, not a contrived one.
At `3a6fab4` both cases failed the same way (`bun review58r3/direct.ts` with the base's
`src/glossary.ts`), so the round did not cause the failure. It did write the sentence that
contradicts it.

**Fix:** add one clause to both sentences, for example "...belongs to that term, except as the
first line under the heading: a heading followed directly by a bold label only groups, and the
label is read as a term." The same edit can make the blank-line clause exact (non-blocking 3).

## Non-blocking findings

1. **The decision itself: one bold line before the first `##` still turns a heading glossary off.**
   Case b19 (`# G` / `**Status:** draft` / `## Order` / `A request.` / `## Invoice` / `## Order` /
   `Again.`) passes with `[ok] GLOSSARY.md: 1 entry, each a term with a one or two sentence
   definition` on both runtimes. The glossary has an empty `Invoice` and a repeated `Order`. The
   design says so ("At least one bold entry: entries are the bold entries and headings are free"),
   and `Gates-and-Hooks.md:285` states it ("in a file with no such entry"), so it is not a defect of
   this round. It is round 2 blocking 2's mechanism with the bold line moved from a term's section
   to the preamble, and `**Status:**` or `**Last updated:**` under the title is common. One
   alternative is to let the reading with more entries win (bold entries against term-led
   headings). The tradeoff is a rule that is harder to state, and ties in small mixed files. Worth a
   `decide` row in the follow-up item, not this round.
2. **`## C#` is read as the term `C`.** `HEADING` (`src/glossary.ts:122`, `\s*#*$`) strips a
   trailing `#` with no space before it, so case b27 (`## C` / `A systems language.` / `## C#` / `A
   managed language.`) fails `GLOSSARY.md:7: entry "C" repeats "C" from line 3`, rc 1 on both
   runtimes. The same result at `3a6fab4`. This is a wrongly failed glossary, but it needs two terms
   that differ only by a trailing `#`, and the regex predates this round. `(?:\s+#+)?\s*$` would keep
   `C#`.
3. **"after a blank line it is read as a term" overstates for an indented label.**
   `domain-docs.md:23` and `Gates-and-Hooks.md:287-288`. Case b32 (`- **Order**: A request.` /
   blank / `  **Example:** order 1042.`, the same under `- **Invoice**`) passes with 2 entries,
   because an indented line never starts an entry (`src/glossary.ts:181`). The doc is stricter than
   the code, so nobody is wrongly failed by it. "an unindented one after a blank line" would be
   exact.
4. **The no-entry warning does not say why an indented entry is not counted.** Case b30 (two
   `  **Order**: ...` lines indented by two spaces) and case x1 (a nested list grouped by category,
   `- Sales` / `  - **Order**: A request.` ...) get `[warn] GLOSSARY.md: no entry recognised; entries
   are **Term**: or **Term:** (also as a list item) ...`. That lists the very forms the file uses. At
   `3a6fab4` x1 read 3 entries and b30 read 2. Both stay green, and the margin rule is decided.
   "at the start of a line" in `FORMS` (`src/glossary.ts:38-39`) would make the warning
   self-explaining.
5. **The implementer's report is stale on one point.** `impl_glossary-and-adr_r3.md` says ADR line
   13's first sentence "still says 'none of its four commits in this clone is on a remote branch'".
   At the head, line 13 reads "In the maintainer's working copy, when this was written, none of its
   four commits was on a remote branch", changed by `5fcbe9f`. The file is right and the report is
   not.

## Probe A: round 2 blocking findings closed

```
== 11-def-after-comment         bun rc=0 | node rc=0   [ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
== 25-example-labels-bold       bun rc=0 | node rc=0   [ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
== 26-example-labels-headings   bun rc=0 | node rc=0   [ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
== 27-see-also-once-headings    bun rc=0 | node rc=0   [ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
== 28-synonym-labels-list       bun rc=0 | node rc=0   [ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
== 31-hash-line-in-def          bun rc=0 | node rc=0   [ok]    GLOSSARY.md: 1 entry, each a term with a one or two sentence definition
== 39-heading-empty-plus-one-label  bun rc=1 FAILED - 1 failure | node rc=1 FAILED - 1 failure
      [fail]  GLOSSARY.md:7: entry "Invoice" has no definition
              fix: write one or two sentences under it, or remove the entry
== 40-heading-dup-plus-one-label    bun rc=1 FAILED - 1 failure | node rc=1 FAILED - 1 failure
      [fail]  GLOSSARY.md:7: entry "Order" repeats "Order" from line 3
              fix: merge the two or rename one
```

(Output condensed onto one line per case; each line says "glossary section identical on both
runtimes" in `review58r3/work/A`.) The Stop hook on case 25 prints nothing, rc 0.

## Probe B: the rule, 35 inputs of my own

All through the CLI on both runtimes (`review58r3/B.out`). "Design" is what the brief's bullets
say; every row matches.

| Case | Input (abridged) | Design | Code |
|---|---|---|---|
| b01 | `## Sales` / `### Order` text / `### Invoice` text / `## Billing` / `### Receipt` text | `##` groups, `###` term-led | `[ok] 3 entries` |
| b02 | `## Sales` / `#### Order` / text | deeper heading groups; `####` is no term | no-entry warning |
| b03 | `### Order` / `## Invoice` / text | not deeper: empty | `:3 "Order" has no definition` |
| b04 | `## Order` text / `## Invoice` at EOF | EOF: empty | `:7 "Invoice" has no definition` |
| b05 | `## Order` / `<!-- todo -->` / `A request.` | comment transparent, term-led | `[ok] 2 entries` |
| b06 | `## Order` / `<!-- todo -->` / `## Invoice` | comment is no text: empty | `:3 "Order" has no definition` |
| b07 | `## Order` / fenced block / `A request.` | fence blank, term-led | `[ok] 2 entries` |
| b08 | `## Order` / `    **Example:** order 1042.` | indented: other text, term-led; label not definition | `:3 "Order" has no definition` |
| b09 | `## Terms` / `- **Order**: ...` / `- **Invoice**: ...` | list bold-colon first: groups | `[ok] 2 entries` |
| b10 | `The terms:` / `- **Order**: ...` / `- **Invoice**: ...` | later list items start entries | `[ok] 2 entries` |
| b11 | `The terms:` / `**Order**: ...` (one block) / blank / `**Invoice**: ...` | later non-list line starts none | `[ok] 1 entry` |
| b12 | `- **Order**:` / `**Note:** ...` / `- **Invoice**:` / `**Note:** ...` | list-led block: items start, notes belong | `[ok] 2 entries` |
| b13 | `**Order**: ...` / `- **Invoice**: ...` | began with non-list entry: item belongs | `[ok] 1 entry` |
| b14 | `- plain words` / `- **Order**: ...` / `- **Order**: Again.` | both items start: repeat | `:5 "Order" repeats "Order" from line 4` |
| b15 | `**Order**:` / `**Example:** ...` / `_Avoid_: Purchase` | labels and Avoid are no definition | `:3 "Order" has no definition` |
| b16 | `- **Order**:` / two indented lines, three sentences | belongs; warning | `[ok] 2 entries` + `[warn] :3 ... 3 sentences` |
| b17 | `- **Order**: ...` / `<!-- moved -->` / `- **Order**: Again.` | comment does not end block: repeat | `:5 "Order" repeats "Order" from line 3` |
| b18 | `**Order**: ...` / `<!-- x -->` / `**Invoice**: ...` | same block, non-list: belongs (decided limit) | `[ok] 1 entry` |
| b19 | `**Status:** draft` / heading terms with an empty and a repeat | bold wins, headings free | `[ok] 1 entry` (non-blocking 1) |
| b20 | upstream shape: intro, `## Language` / `### Ordering` / `### Billing` bold entries with `_Avoid_`, `## Relationships` plain list, `## Example dialogue` with `> **Dev:**`, `## Flagged ambiguities` | bold entries; the rest free | `[ok] 3 entries` |
| b21 | `## Order` / `**Category:** Sales` / text, the same under `## Invoice` | groups; labels are terms (decided limit) | `:10 "Category" repeats` (blocking 1) |
| b22 | `## Sales` / prose / `**Order**:` twice / `## Billing` / prose / `**Invoice**:` empty | term-led sections hide bold (decided limit) | `[ok] 2 entries` |
| b23 | `**Order**:` / blank / `**Example:** ...`, the same for Invoice | label paragraph is a term (decided, stated) | `:9 "Example" repeats "Example" from line 5` |
| b24 | `# Intro` / `## About` prose / `# Terms` / `**Order**: ...` / `**Invoice**:` | `#` ends the term-led section | `:11 "Invoice" has no definition` |
| b25 | `## Order` text / `#### Example` / `**Example:** ...`, the same for Invoice | `####` does not end the section | `[ok] 2 entries` |
| b26 | `## Order` / `_Avoid_: Purchase` / `A request.` | definition minus Avoid | `[ok] 2 entries` |
| b27 | `## C` / text / `## C#` / text | two terms | `:7 "C" repeats "C"` (non-blocking 2) |
| b28 | three tight `**X**: ...` lines | non-list lines belong (decided limit) | `[ok] 1 entry` |
| b29 | `## Order` / text / `**Order**:` (empty) / `## Invoice` / text | bold in term-led section is not an entry | `[ok] 2 entries` |
| b30 | two indented `  **X**: ...` lines | not at the margin: no entry | no-entry warning (non-blocking 4) |
| b31 | `## Order` / `#1 A request.` | `#1` is text | `[ok] 2 entries` |
| b32 | `- **Order**: ...` / blank / `  **Example:** ...`, the same for Invoice | indented: no entry | `[ok] 2 entries` (non-blocking 3) |
| x1 | `- Sales` / `  - **Order**: ...` nested | indented: no entry | no-entry warning |
| x2 | `## A` / `### Account` text / `## B` / `## C` / `### Cart` text | `## B` empty | `:9 "B" has no definition` |
| x5 | `**Also known as:**` first under each term heading | groups (decided limit) | `:11 "Also known as" repeats` (blocking 1) |

No case departs from the design. Wrongly failed, with neither a missing definition nor a repeated
term: x5 and b21 (decided limit, blocking 1 for the docs), b27 (non-blocking 2). x2 is failed as
the design says, because an empty letter heading is an entry with no definition. It is rare in a
hand-written glossary.

## Probe C: regression

| Case | Round 2 | Now (bun and node) |
|---|---|---|
| repo `GLOSSARY.md` | 14, green | `[ok] GLOSSARY.md: 14 entries, each a term ...`, rc 0 |
| reference example (`domain-docs.md:11-21`) | 2, green | `[ok] GLOSSARY.md: 2 entries, each a term ...`, rc 0 |
| 01-05, 08, 09, 13, 14, 15, 37 | ok | the same counts (2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2) |
| 06 table, 07 definition list, 17 title only, 33 `####` | no-entry warning | the same warning, rc 0 |
| 10 def after blank | 2 failures | `:3` and `:7 has no definition`, rc 1 |
| 12 def after rule | `:3 "Order" has no definition` | the same (rules become blank, as decided) |
| 16 empty | `[ok] 0 entries` | the same |
| 18 duplicate case | `:3 "ORDER" repeats "Order" from line 1` | the same |
| 19, 20 duplicate colon, space | `:3 "Order" repeats` | the same |
| 21, 22 emphasis, code span | `[ok] 2 entries` | the same (round 2 non-blocking 2, left) |
| 23, 24 missing definition at EOF | `:3 "Invoice" has no definition` | the same |
| 29 no colon | warning plus two no-colon warnings | the same three warnings |
| 30 three sentences | `[ok] 1 entry` + `[warn] :1 ... 3 sentences` | the same |
| 32 `## Order:` repeat, 34 only Avoid, 35 BOM, 36 four-backtick fence, 38 2000 entries | as round 2 | the same |

The three readings the implementer says changed, against the design:

- An indented `**Term**:` is no longer an entry: b30 and x1 get the no-entry warning (at
  `3a6fab4`: 2 and 3 entries). The design starts an entry only on an unindented line, so this
  matches. It is under-checked and stays green (non-blocking 4).
- A non-list bold line after a prose first line starts no entry: b11 reads 1 entry (at base 2).
  This matches "a later unindented list-item bold-colon line also starts one".
- The no-colon warning fires only on a block's first line: test `:504` and case 29. The design
  leaves this warning open, so this is consistent.

## Probe D: tests and mutants

`tests/glossary.test.ts`: all 39 `test(` calls carry `GATE_TEST` (`{ timeout: 60_000 }`, `:15`).
`rg -c '^test\('` and `rg -c '^test\(.*GATE_TEST'` both print 39. The CLI spawn has `timeout:
30_000, killSignal: "SIGKILL"` (`:142`). The tests go through `runGate`, `stop` and `bin/mstack`,
never through `readGlossary`, and assert literal lines, with two exceptions: `:182` (`[2-9]
entries`, unchanged from round 2) and `:455-459`.

`:455-459` derives the expected count from `line.startsWith("**")` instead of a literal 14.
`rg -c '^\*\*' GLOSSARY.md` prints 14 and the gate says 14. This does not weaken it against code
regressions: the oracle is a simpler, independent rule, and M15 below changes the count and is
killed by this test. What it gives up is noticing the file itself losing or gaining an entry.
That is a change of content, which is reviewed as content. It also forbids a `**`-first label line
in this repository's own glossary, which is stricter, not weaker.

Thirty single-line mutants of `src/glossary.ts`, each run against `tests/glossary.test.ts` on node
(`review58r3/mutants.mjs`, `m1.out` to `m3.out`):

| Mutant | Line | Killed by |
|---|---|---|
| M1 no list marker in `ENTRY` | 16 | colon inside/outside or list item; CRLF; in a list each unindented item (3) |
| M2 `**X:**` not accepted | 16 | 4 tests, incl. duplicate rule and bold label under bold entry |
| M3 `LIST` only `-` | 19 | colon inside/outside or list item |
| M4 heading reading wins | 52 | `_Avoid_` line; upstream layout; prose section first (3) |
| M5 `bold.length > 1` | 52 | 11 tests |
| M6 `parts.length > 1` | 54 | no entry recognised warns once |
| M7 trailing colon kept in key | 65 | duplicate rule ignores case and a trailing colon |
| M8 comment line ends a block | 129 | an HTML comment line inside an entry |
| M9 `indented: false` | 142 | in a list, indented bold label belongs |
| M10 term-led does not hide bold | 158 | bold label under heading term; headings whatever bold lines; CLI (3) |
| M11 `####` classified | 161 | a #### heading is not a term heading |
| M12 `termLed` not reset | 162 | prose section first |
| M13 `#` classified | 164 | no entry recognised; bold term with no colon (2) |
| M14 same-level heading groups | 164 | heading per term; headings whatever bold lines; CLI (3) |
| M15 bold-led heading is term-led | 164 | well-formed; reference example; this repository's glossary; prose section first (4) |
| M16 `termLed = false` after a term | 166 | bold label under heading term; headings whatever bold lines; CLI (3) |
| M17 labels in heading definition | 167 | heading term whose only line is `_Avoid_` |
| M18 list-led block counted as paragraph | 178 | colon inside/outside or list item; in a list (2) |
| M19 list item under non-list entry starts one | 182 | a list-item label under a non-list bold entry |
| M20 every bold-colon line starts one | 182 | bold label under bold entry; CLI; list-item label (3) |
| M21 no-colon warning on any line | 189 | a bold phrase that starts a later line |
| M22 bold labels count as definition | 202 | a bold label under a bold entry |
| M23 `_Avoid_` counts as definition | 202 | `_Avoid_` line; heading term only `_Avoid_` (2) |
| M24 no BOM strip | 216 | a byte order mark does not hide the first entry |
| M25 comment line blank again | 224 | an HTML comment line inside an entry |
| M26 heading without a space | 122 | a line starting with #word is text |
| M27 colons after the term kept | 184 | a term line followed only by colons |
| M28 indented lines may start entries | 181 | in a list, indented bold label belongs |
| M29 no `.trim()` on heading title | 133 | survived: equivalent |
| M30 any next part is the block | 165 | survived: equivalent |

M29 and M30 gave the same `readGlossary` output as the pristine file on all 115 inputs of probes
A, B, C, X and round 2's `cases/` (`cmp eq.pristine eq.m29`, `cmp eq.pristine eq.m30`: no
difference). For M29, `HEADING`'s `\s+` and `\s*#*$` already trim the title: `"##   Order"`,
`"## Order ##"`, `"##\tOrder\t#"` each give a title equal to its own `trim()`. For M30, the heading
after an empty heading is one of level 1 to 3, which resets `termLed`. Every clone's `git status
--short` was empty after the runs.

Size: `src/glossary.ts` is 232 lines. Each new piece is used by a rule: blocks (`partsOf`),
section classification (`readEntries`), the list rule (`LIST`, `paragraph`), `definition()`, null
comment lines, and the BOM strip (M24 is killed, so it is load-bearing under the margin rule). The
only dead weight I found is `Part.number` and `Part.title` on level-0 blocks, which nothing reads.
That is trivial.

## Probe E: docs against the code

| Sentence (changed this round) | Command | Holds |
|---|---|---|
| domain-docs:23 "a line that starts with `**Term**:`" | b30 | yes |
| domain-docs:23 "Entries are separated by blank lines; list items may follow each other directly" (decided limit 2) | b28 `[ok] 1 entry`; `- **Order**:` / `- **Invoice**:` tight `[ok] 2 entries` (test `:396`, case 03) | yes |
| domain-docs:23 "A bold label ... directly under a term's lines, or indented under its list item, belongs to that term and is not its definition" | 25, 28 pass; b15 fails `has no definition` | yes |
| domain-docs:23 "after a blank line it is read as a term, so the same label under two terms is a repeated term" (decided limit 1) | b23 fails `"Example" repeats`; b32 passes | yes for unindented labels; overstated for indented ones (non-blocking 3) |
| domain-docs:23 "a bold line under such a heading belongs to that term" | 26, 27, 39, 40 as stated; x5, b21 fail | **no** (blocking 1) |
| Gates-and-Hooks:283-285 "at the start of a line ... and, in a file with no such entry, one `##` or `###` heading per term" | b30; b19 | yes |
| Gates-and-Hooks:286-288 label "directly under a term, indented under its list item, or under its heading belongs to that term; after a blank line under a bold term it is read as a term" | 25, 28, 26 pass; b23 fails; x5 fails; b32 passes | **no** for a label first under a heading (blocking 1); overstated for b32 |
| Gates-and-Hooks:288-289 "a comment line inside an entry does not end it" | case 11 `[ok] 2 entries`; b17 | yes |
| CHANGELOG:14-15 "reads a bold label such as `**Example:**` under a term as part of it" | 25, 26, 28 | yes as a summary; it has the same gap as blocking 1 |

Both decided limits are stated in `domain-docs.md:23`: limit 1 in "after a blank line it is read as
a term, so the same label under two terms is a repeated term", and limit 2 in "Entries are
separated by blank lines" read with "directly under a term's lines, belongs to that term". In
`Gates-and-Hooks.md:287-288`, limit 1 is stated; limit 2 is stated only through "directly under a
term ... belongs to that term". That holds, but it does not say that this applies to a second term
line too.

`docs/wiki/How-A-Work-Item-Flows.md:179-193` against `skills/router/SKILL.md:154-163`: the same five
steps in the same order. Step 1 matches word for word apart from the link, and step 4 adds the
router's "unless it records a parked fork". `src/roles.ts:64` is still `MIN_REPORT_BYTES = 40`.

ADR: `git diff 3a6fab4..eef0991 -- docs/adr` changes lines 5 and 13 only. Line 5 now opens "The
note also records that ...", which attributes the defect sentence to the note. Line 13's commands,
run here:

```
$ git branch -r --contains 760a281          # prints nothing, rc 0
$ git cat-file -t 760a281
commit
$ git show-ref | rg portable                # rc 1: the ref is gone
$ for c in $(git rev-list 760a281 --not --branches --remotes --tags); do ... done
760a281 commit remote=[]
087b535 commit remote=[]
e479734 commit remote=[]
9cb44df commit remote=[]
```

Four commits, none on a remote branch, all in the object store. "In the maintainer's working copy,
when this was written" keeps the sentence true in another clone.

## Probe F: suite, lint, gate

`npm test` once at `eef0991`, load 9.7 to 11.7: bun `630 pass, 1 fail, Ran 631 tests across 28
files. [208.56s]`. The failure is `(fail) ledger check and the gate's closing audit agree on every
sequence, because both read through readVerdict [5309.81ms] ^ this test timed out after 5000ms`.
`npm test` stops after the bun half (`&&`), so I ran `npm run test:node` alone: `tests 631, pass
630, fail 1, duration_ms 95592`. The failure is `✖ hook paths stay within budget on a 50 MB
transcript` at `tests/costs.test.ts:698` (`Stop with a 50 MB transcript took 1199.214ms against
953.7675840000011ms without one`), with the load at 20.8 when it finished.

Each failing file re-run alone:

```
bun test ./tests/verdict-reader.test.ts       at eef0991: (fail) ledger check and the gate's closing audit agree ... [5941.28ms]  19 pass 1 fail
                                              at 3a6fab4: (fail) ledger check and the gate's closing audit agree ... [5803.10ms]  19 pass 1 fail
node --test --test-name-pattern='hook paths stay within budget' tests/costs.test.ts
                                              at eef0991: tests 1 pass 1 fail 0
                                              at 3a6fab4: tests 1 pass 1 fail 0
```

The verdict-reader timeout fails the same way at the base, and the costs budget passes alone at
both. The diff touches no file either test reads (`git diff --stat 3a6fab4..eef0991 -- src tests`
lists only `src/glossary.ts` and `tests/glossary.test.ts`). Neither failure comes from this diff.
Every glossary test passed on both runtimes in the full run.

`npm run typecheck`: rc 0. `./bin/mstack version`: `mstack 0.2.1 at /Users/romerma/Code/mstack`.
`./bin/mstack lint-plugin .`: `[ok] 5 origin header(s), each naming a licence file that ships` ...
`PASSED - 0 failures, 0 warnings`. `./bin/mstack gate`: `[ok] GLOSSARY.md: 14 entries, each a term
with a one or two sentence definition` ... `PASSED - 0 failures, 0 warnings`. `wc -l
skills/router/references/intake.md`: 77. I did not run `gate --full`. Its verify is `npm test &&
npm run typecheck && bin/mstack lint-plugin .`, and I ran each of those parts above. `--full` also
writes a receipt, and my brief allows two writes.

## Round 2 non-blocking findings taken (decision row 189)

- 1: the comment half is fixed (case 11). The blank-line and rule halves read as before (cases
  10, 12), as the design decides.
- 3: fixed (case 31).
- 7: M26 and M43 are now pinned (tests `:441`, `:447`).
- 8: every test carries `GATE_TEST`.
- 9 and 11: the ADR lines are as above.
- 14: the wiki closing list is as above.
