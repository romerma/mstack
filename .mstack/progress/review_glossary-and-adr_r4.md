**Verdict:** APPROVED

# Review - glossary-and-adr, round 4

Reviewed alone, round 4, at `af2edff08a45dccc436aadaac17bb3170f9ff02b`, diff
`git diff eef0991..af2edff -- . ':!.mstack'`. Every claim below comes from a command I ran in this
pass. Scratch files are under
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review58r4/`:
`probe.ts`, `probe2.ts` and `probe3.ts` import `/Users/romerma/Code/mstack/src/glossary.ts` and
call `readGlossary`. Each ran with `bun` and with
`node --disable-warning=ExperimentalWarning --experimental-strip-types`, and `diff` of the two
outputs was empty every time. `tpl/` is a throwaway repository (`git init`, an empty commit, this
checkout's `bun src/cli.ts setup`, a commit, branch `feat/x`, gate green with 0 warnings). It was
copied once per gate case with `GLOSSARY.md` committed, and the gate ran on both runtimes from this
checkout.

The diff changes two doc sentences and nothing else. Every clause of both is true of
`src/glossary.ts` at the head on 24 inputs (16 in probe.ts, 6 in probe2.ts, 2 in probe3.ts; the
4 real-gate cases repeat probe.ts cases). Round 3's blocking finding is closed: x5 and
b21 now match what both docs say. I found no ordinary input on which either changed sentence is
false. Evidence rung: 4 for every clause (a script calling the real parser), and 5 for x5, h2, u1
and l2 (the real `gate` in a real repository).

## Blocking findings

None.

## Non-blocking findings

1. **CHANGELOG.md:14-15 still says what round 3 blocked on, in a line this round did not touch.**
   "reads a bold label such as `**Example:**` under a term as part of it". That has no exception,
   and both docs now state two: an unindented label after a blank line under a bold term (u1, u2)
   and a label as the first line under a heading (x5, b21, x5n, e2, e3) are read as terms. In the
   wiki's own words u1's label is "after a blank line under a bold term", so it is "under a term",
   and the CHANGELOG says it is part of the term. The gate fails u1 with
   `GLOSSARY.md:9: entry "Example" repeats "Example" from line 5`. The brief's definition of
   blocking limits it to changed sentences, so this is not blocking. It is the third text of
   probe 3, and the fix is one clause, for example "...under a term as part of it (except a label
   after a blank line under a bold term, or first under a heading, which is read as a term)". Worth
   making before the item closes.
2. **skills/reflect/references/domain-docs.md:23: "a heading followed directly by a bold label".**
   The same bullet uses "directly under a term's lines" two clauses earlier to mean "with no blank
   line", against "after a blank line". By that contrast a reader can take x5 (a blank line between
   `## Order` and the label) as safe, and it is not: x5 (blank) and x5n (no blank) both fail as a
   repeated term. The sentence is true as written, and the wiki's "the first line under a heading"
   (`docs/wiki/Gates-and-Hooks.md:288-289`) has no such reading. Dropping "directly", or writing "a
   heading whose first line is a bold label", would make the two docs say the same thing.
3. **One label-first heading turns the whole heading glossary off (m1).** In
   `## Order` / `**Also known as:** purchase order.` / `A request to buy something.` /
   `## Invoice` / `A request for payment.` / `## Invoice` / `Again.`, the label is the only entry,
   so the repeated `Invoice` is not checked: `entries=1 problems=0`. The docs say the heading "only
   groups". The wiki's "in a file with no such entry" (`Gates-and-Hooks.md:285`) covers the rest,
   and domain-docs says nothing about it. This is round 3 non-blocking 1's mechanism, which belongs
   to the follow-up item. It is not raised as blocking.
4. **docs/wiki/Gates-and-Hooks.md:289 was not re-wrapped.** It is 121 characters, and its
   neighbours 283-291 are 88 to 96 (`awk` over those lines; at `eef0991` the same region was 93 to
   94). Cosmetic only.

## Probes

### 1. What the diff touches

```
$ git diff --stat eef0991..af2edff -- . ':!.mstack'
 docs/wiki/Gates-and-Hooks.md             | 5 +++--
 skills/reflect/references/domain-docs.md | 2 +-
 2 files changed, 4 insertions(+), 3 deletions(-)
$ git diff --stat eef0991..af2edff -- src tests
(no output)
$ git log --oneline eef0991..af2edff
af2edff chore: move item 58 to reviewing for round 4
e2b0989 docs: say a bold label first under a heading is read as a glossary term
fa614a4 chore: record the item 58 round 3 review
```

The `.mstack` side is `decisions.tsv` +1 (row 191, `review-r4`), `ledger.tsv` +1 and the round 3
report. In both files the hunks are the label sentences only (`git diff eef0991..af2edff -- .
':!.mstack'`, read in full). The one test that reads `domain-docs.md`,
`tests/glossary.test.ts:172` ("the example in the reference passes the check"), pins only the
` ```md ` example, which did not change. That file ran green on both runtimes:
`bun test tests/glossary.test.ts` gave `39 pass 0 fail`, and
`node --disable-warning=ExperimentalWarning --experimental-strip-types --test tests/glossary.test.ts`
gave `tests 39 pass 39 fail 0`. I did not re-run the whole suite, as the brief says.

### 2. Each clause against the code

The changed sentences at the head:

- `Gates-and-Hooks.md:286-289`: "A bold label such as `**Example:**` directly under a term,
  indented under its list item, or after the paragraph under its heading belongs to that term. An
  unindented one after a blank line under a bold term is read as a term, and so is one that is the
  first line under a heading, which then only groups."
- `domain-docs.md:23`: "A bold label such as `**Example:**` directly under a term's lines, or
  indented under its list item, belongs to that term and is not its definition; an unindented one
  after a blank line is read as a term, so the same label under two terms is a repeated term. A
  file may use one `##` or `###` heading per term followed by a paragraph instead, and a bold label
  after that paragraph belongs to the term; a heading followed directly by a bold label only
  groups, and the label is read as a term."

Inputs (every file starts `# G` and a blank line; `/` separates lines, `(b)` is a blank line; each
case puts the same label under two terms, so a label read as a term shows up as a repeat). The
output is pasted verbatim from `bun probe.ts`, `bun probe2.ts` and `bun probe3.ts`, and node's was
identical:

| Case | Input | Output | Clause |
|---|---|---|---|
| b1 | `**Order**: A request to buy something.` / `**Example:** order 1042.` (b) `**Invoice**: A request for payment.` / `**Example:** invoice 7.` | `entries=2 problems=0 warnings=0` | directly under a bold term: belongs |
| b1b | `**Order**:` / `A request to buy something.` / `**Example:** order 1042.` (b) same for Invoice | `entries=2 problems=0 warnings=0` | directly under a term's lines (definition below) |
| b1c | `- **Order**: A request to buy something.` / `**Example:** order 1042.` / `- **Invoice**: A request for payment.` / `**Example:** invoice 7.` | `entries=2 problems=0 warnings=0` | directly under a list entry, unindented |
| e4 | `**Order**: ...` / `_Avoid_: Purchase` / `**Example:** order 1042.` (b) same for Invoice | `entries=2 problems=0 warnings=0` | directly under a term's lines, after `_Avoid_` |
| d1 | `**Order**:` / `**Example:** order 1042.` | `fail :3 entry "Order" has no definition` | "is not its definition" |
| l1 | `- **Order**: ...` / `  **Example:** order 1042.` / `- **Invoice**: ...` / `  **Example:** invoice 7.` | `entries=2 problems=0 warnings=0` | indented under its list item, directly |
| l2 | `- **Order**: ...` (b) `  **Example:** order 1042.` (b) `- **Invoice**: ...` (b) `  **Example:** invoice 7.` | `entries=2 problems=0 warnings=0` | indented under its list item, after a blank line |
| l3 | `- **Order**: ...` / `  - **Example:** order 1042.` / same for Invoice | `entries=2 problems=0 warnings=0` | indented (nested list item) |
| u1 | `**Order**: ...` (b) `**Example:** order 1042.` (b) `**Invoice**: ...` (b) `**Example:** invoice 7.` | `entries=4 problems=1` / `fail :9 entry "Example" repeats "Example" from line 5` | unindented after a blank line under a bold term: a term, a repeat |
| u2 | u1 with `- ` on both terms | `entries=4 problems=1` / `fail :9 entry "Example" repeats "Example" from line 5` | same, under a list entry |
| h1 | `## Order` (b) `A request to buy something.` / `**Example:** order 1042.` (b) `## Invoice` (b) `A request for payment.` / `**Example:** invoice 7.` | `entries=2 problems=0 warnings=0` | after the paragraph under its heading, directly |
| h2 | h1 with a blank line between paragraph and label | `entries=2 problems=0 warnings=0` | after the paragraph, after a blank line |
| d2 | `## Order` (b) `A request to buy something. A customer sends it.` / `**Example:** Order 1042 was sent. It was paid.` | `entries=1 problems=0 warnings=0` (no 3+ sentence warning, so the label is not definition text) | after the paragraph: belongs, not definition |
| e1 | `## Sales` (b) `### Order` (b) para (b) `**Example:** order 1042.` (b) `### Invoice` (b) para (b) `**Example:** invoice 7.` | `entries=2 problems=0 warnings=0` | after the paragraph, `###` terms |
| e5 | `## Order` (b) para (b) `#### Details` (b) `**Example:** order 1042.`, the same for Invoice | `entries=2 problems=0 warnings=0` | a `####` inside a term's section does not reset it |
| x5 | round 3's x5: `## Order` (b) `**Also known as:** purchase order.` (b) `A request to buy something.` (b) `## Invoice` (b) `**Also known as:** bill.` (b) `A request for payment.` | `entries=2 problems=1` / `fail :11 entry "Also known as" repeats "Also known as" from line 5` | first line under a heading: a term |
| b21 | round 3's b21: `## Order` (b) `**Category:** Sales` / `A request to buy something.` (b) `## Invoice` (b) `**Category:** Sales` / `A request for payment.` | `entries=2 problems=1` / `fail :10 entry "Category" repeats "Category" from line 5` | first line under a heading: a term |
| x5n | `## Order` / `**Also known as:** purchase order.` / `A request to buy something.` (b) `## Invoice` / `**Also known as:** bill.` / `A request for payment.` | `entries=2 problems=1` / `fail :8 entry "Also known as" repeats "Also known as" from line 4` | same with no blank line after the heading |
| e2 | x5 with `###` terms under `## Sales` | `entries=2 problems=1` / `fail :13 entry "Also known as" repeats "Also known as" from line 7` | same at `###` |
| e3 | x5 with `- ` on the labels | `entries=2 problems=1` / `fail :11 entry "Also known as" repeats "Also known as" from line 5` | same, label as a list item |
| g1 | `## Order` (b) `**Also known as:** purchase order.` (b) `## Invoice` (b) `**Synonym:** bill.` (b) `## Order` (b) `**Note:** again.` | `entries=3 problems=0 warnings=0` | "which then only groups": a repeated heading is not a repeat |
| g2 | g1's headings with prose paragraphs (`A request to buy something.` / `A request for payment.` / `Again.`) | `entries=3 problems=1` / `fail :11 entry "Order" repeats "Order" from line 3` | contrast: the same headings as terms do repeat |
| m1 | see non-blocking 3 | `entries=1 problems=0 warnings=0` | the label-first heading turns the file to bold reading |
| e6 | the reference's own example plus `**Example:** ...` directly under each definition | `entries=2 problems=0 warnings=0` | the documented example with labels stays green |

Through the real gate (`bun /Users/romerma/Code/mstack/src/cli.ts gate` and
`node --disable-warning=ExperimentalWarning --experimental-strip-types .../src/cli.ts gate` in a
copy of `tpl/` with the glossary committed). The node output was byte-identical to bun's in all
four (`diff -q`):

```
=== g_x5 (x5)
-- glossary
[fail]  GLOSSARY.md:11: entry "Also known as" repeats "Also known as" from line 5
        fix: merge the two or rename one
FAILED - 1 failure, 0 warnings
bun rc=1 node rc=1
=== g_h2 (h2)
-- glossary
[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
PASSED - 0 failures, 0 warnings
bun rc=0 node rc=0
=== g_u1 (u1)
-- glossary
[fail]  GLOSSARY.md:9: entry "Example" repeats "Example" from line 5
        fix: merge the two or rename one
FAILED - 1 failure, 0 warnings
bun rc=1 node rc=1
=== g_l2 (l2)
-- glossary
[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition
PASSED - 0 failures, 0 warnings
bun rc=0 node rc=0
```

The code behind each outcome: a label after a heading term's paragraph is skipped because
`termLed` stays true for the rest of the section (`src/glossary.ts:158`, `:166`), and a `####` does
not reset it (`:161`). A heading whose next part opens with an unindented entry returns before it
becomes a term (`:164`), and with `termLed` false (`:162`) the label block goes to `boldEntries`.
An indented line never starts an entry (`:181`). A later unindented label in the same block only
starts one as a list item in a list-led block (`:182`).

What I tried to make a sentence false: a definition on the line below the term (b1b), an
unindented label under a list entry (b1c), a label after `_Avoid_` (e4), a nested list label (l3),
`###` term headings (e1, e2), a `####` inside a term section (e5), a list-marked label first under
a heading (e3), no blank line after the heading (x5n), labels that would push a definition over
two sentences (d2), and a mixed file (m1). None contradicts a changed sentence. m1 is the closest
(non-blocking 3), and "directly" in domain-docs is the closest wording (non-blocking 2).

### 3. The two docs and the CHANGELOG

- Wiki and domain-docs agree on each case in the table: label belongs (directly, indented, after
  the heading's paragraph) and label read as a term (unindented after a blank line under a bold
  term, first under a heading). They differ only in wording: "directly" in domain-docs
  (non-blocking 2), and the wiki's "directly under a term", which its next sentence narrows to a
  bold term.
- `CHANGELOG.md:5-17` contradicts both on u1, u2, x5, b21 and x5n (non-blocking 1). The rest of
  the entry (forms recognised, no-definition and repeat failures, the two warnings, the unreadable
  file) is untouched by this round and agrees with the outputs above (b1 to l3 green; d1 no
  definition; u1 and x5 repeats).

### 4. lint-plugin and gate in this checkout

```
$ ./bin/mstack version
mstack 0.2.1 at /Users/romerma/Code/mstack
$ ./bin/mstack lint-plugin .
...
-- references
[ok]    24 reference file(s), every relative link resolves
...
-- provenance
[ok]    5 origin header(s), each naming a licence file that ships
...
PASSED - 0 failures, 0 warnings
lint-plugin rc=0
$ ./bin/mstack gate
...
[ok]    one active item: glossary-and-adr (reviewing)
...
-- glossary
[ok]    GLOSSARY.md: 14 entries, each a term with a one or two sentence definition

-- workspace
[ok]    store root is an mstack checkout, and this report came from its own ./bin/mstack
[ok]    on branch feat/glossary-and-adr
[ok]    working tree is clean

PASSED - 0 failures, 0 warnings
gate rc=0
$ ./bin/mstack ledger check glossary-and-adr      # before my row
FAIL no verdict at af2edff0; 6 row(s) exist at other SHAs and a new head SHA voids them
```

The working tree was clean after every probe (`git status --short` empty in this checkout and in
each scratch repository).
