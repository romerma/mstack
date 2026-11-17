<!-- Origin: the glossary and ADR formats and the three conditions for an ADR, from mattpocock/skills, skills/engineering/domain-modeling/SKILL.md, GLOSSARY-FORMAT.md and ADR-FORMAT.md @ 49dd158d1076134a641b33efb035946536778336 (MIT, licenses/mattpocock-skills-LICENSE.txt). Adapted: terms are settled against the code and the skills with no question to the user, a term they do not settle is left out, and the glossary's format is the one `mstack gate` checks. -->

# Domain docs

`GLOSSARY.md` at the repository root says what the project's words mean; one file per decision under `docs/adr/` says why a hard choice went the way it did. Both are written from the code, the skills and the session's record, and both are part of the item's diff, so a reviewer that did not write them reads them like code. Each is written before the review of the item that introduced the term or took the decision, so the verdict has seen it; what reflect proposes after the verdict goes into a follow-up item, not into the closed one. A session that introduced no term and took no decision meeting all three conditions below writes nothing and says nothing.

## The glossary

A term goes in when this work introduced or sharpened it. Find its uses (`rg` the term in the source, the skills and the docs), define the sense they agree on, and leave out a term they do not settle and say so in the report. Only terms of this project belong, not general programming words.

```md
# Project name

## Language

**Order**:
A request to buy something, from placing it to delivery.
_Avoid_: Purchase, transaction

**Invoice**: A request for payment sent after delivery.
```

- One entry per term: a line that starts with `**Term**:` (or `**Term:**`, with or without a `- ` list marker), the definition on that line or below it, and an optional `_Avoid_:` line. Entries are separated by blank lines; list items may follow each other directly. A bold label such as `**Example:**` directly under a term's lines, or indented under its list item, belongs to that term and is not its definition; after a blank line it is read as a term, so the same label under two terms is a repeated term. A file may use one `##` or `###` heading per term followed by a paragraph instead, and a bold line under such a heading belongs to that term.
- A definition is one or two sentences saying what the thing is, with no file names, flags, statuses or other implementation detail.
- One word per concept; the others go under `_Avoid_`.
- Prose, rules, HTML comments and fenced blocks are free, and so are headings in a file whose terms are bold. A term appears once. When the file exists, `mstack gate` fails an entry with no definition or a repeated term (case ignored), and warns, staying green, about a definition of more than two sentences or a file in which it recognises no entry.

## ADRs

`docs/adr/NNNN-slug.md`, numbered from `0001`: take the highest number in the directory and add one, and create the directory with the first ADR. An ADR needs all three, otherwise the decision stays a `decide` row:

1. **Hard to reverse.** Changing your mind later costs something real.
2. **Surprising without context.** A later reader will wonder why it was done this way.
3. **The result of a real trade-off.** There were genuine alternatives, and one was picked for stated reasons.

```md
# Short title of the decision

Status: accepted, 2026-11-17

What was decided, in the context that made it necessary, and why. What was given up, in one more sentence.
```

Add `Considered options` or `Consequences` only when a rejected alternative or a downstream effect is worth remembering. When the decision is reversed, a new ADR supersedes it and the old one's status says `superseded by NNNN`.
