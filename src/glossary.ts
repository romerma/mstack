/**
 * The entry format of `GLOSSARY.md`, checked as structure and never as content.
 *
 * An entry is a bold term followed by a colon, then its definition, which may
 * start on the same line or on the lines below, up to a blank line, a heading
 * or the next entry; an optional `_Avoid_:` line closes it. Headings and prose
 * before the first entry are free, so a hand-written glossary is not punished
 * for how it introduces itself. The format is stated for writers in
 * `skills/reflect/references/domain-docs.md`, and a test pins that its example
 * passes this check.
 */

/** A definition is one or two sentences; a third is a paragraph, and a paragraph is an essay. */
export const MAX_SENTENCES = 2;

const ENTRY = /^\*\*([^*]+?)\*\*:(.*)$/;
const AVOID = /^_Avoid_:/;

export interface GlossaryProblem {
  readonly line: number;
  /** The entry the problem is about, or null for a problem with the file. */
  readonly term: string | null;
  readonly message: string;
}

export interface GlossaryReading {
  readonly entries: number;
  readonly problems: readonly GlossaryProblem[];
}

interface Entry {
  readonly term: string;
  readonly line: number;
  readonly text: string[];
}

export function readGlossary(source: string): GlossaryReading {
  const problems: GlossaryProblem[] = [];
  const entries: Entry[] = [];
  let current: Entry | null = null;
  let seenEntry = false;

  source.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    const number = index + 1;
    if (line === "" || line.startsWith("#")) {
      current = null;
      return;
    }
    const entry = ENTRY.exec(line);
    if (entry !== null) {
      current = { term: (entry[1] ?? "").trim(), line: number, text: [] };
      const rest = (entry[2] ?? "").trim();
      if (rest !== "") current.text.push(rest);
      entries.push(current);
      seenEntry = true;
      return;
    }
    if (current !== null) {
      if (!AVOID.test(line)) current.text.push(line);
      return;
    }
    if (seenEntry) {
      problems.push({ line: number, term: null, message: `text outside any entry: ${quote(line)}` });
    }
  });

  if (entries.length === 0) {
    problems.push({ line: 0, term: null, message: "no entries: each term is a line starting **Term**:" });
  }

  const first = new Map<string, Entry>();
  for (const entry of entries) {
    const key = entry.term.toLowerCase();
    const earlier = first.get(key);
    if (earlier !== undefined) {
      problems.push({
        line: entry.line,
        term: entry.term,
        message: `entry "${entry.term}" repeats "${earlier.term}" from line ${earlier.line}`,
      });
      continue;
    }
    first.set(key, entry);
    const definition = entry.text.join(" ").trim();
    if (definition === "") {
      problems.push({ line: entry.line, term: entry.term, message: `entry "${entry.term}" has no definition` });
      continue;
    }
    const sentences = countSentences(definition);
    if (sentences > MAX_SENTENCES) {
      problems.push({
        line: entry.line,
        term: entry.term,
        message: `entry "${entry.term}" has ${sentences} sentences; a definition is one or two`,
      });
    }
  }

  problems.sort((a, b) => a.line - b.line);
  return { entries: entries.length, problems };
}

/** Code spans and the common abbreviations do not end a sentence. */
function countSentences(text: string): number {
  const plain = text
    .replace(/`[^`]*`/g, "x")
    .replace(/\b(e\.g|i\.e|etc|vs)\./gi, "$1")
    .trim();
  return plain.split(/(?<=[.!?])\s+(?=[A-Z"'(`*_[])/).filter((part) => part !== "").length;
}

function quote(line: string): string {
  return line.length > 40 ? `"${line.slice(0, 40)}..."` : `"${line}"`;
}
