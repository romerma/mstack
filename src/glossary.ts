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

const ENTRY = /^(?:[-*+]\s+)?\*\*([^*]+?)(?:\*\*:|:\*\*)(.*)$/;
const AVOID = /^_Avoid_:/;
const BOLD_START = /^(?:[-*+]\s+)?\*\*[^*]/;

export interface GlossaryProblem {
  readonly line: number;
  /** The entry the problem is about, or null for a problem with the file. */
  readonly term: string | null;
  readonly message: string;
  /** The next action, in one line. */
  readonly fix: string;
}

export interface GlossaryReading {
  readonly entries: number;
  /** What turns the gate red. */
  readonly problems: readonly GlossaryProblem[];
  /** What is worth saying and leaves the gate green. */
  readonly warnings: readonly GlossaryProblem[];
}

const FORMS =
  "**Term**: or **Term:** (also as a list item) followed by the definition, or a ## Term or ### Term heading followed by a paragraph";

interface Entry {
  readonly term: string;
  readonly line: number;
  readonly text: string[];
}

export function readGlossary(source: string): GlossaryReading {
  const failures: GlossaryProblem[] = [];
  const warnings: GlossaryProblem[] = [];
  const lines = readable(source);
  let entries = boldEntries(lines, warnings);
  if (entries.length === 0) entries = headingEntries(lines);

  if (entries.length === 0 && lines.some((line) => line.trim() !== "")) {
    warnings.push({
      line: 0,
      term: null,
      message: `no entry recognised; entries are ${FORMS}`,
      fix: "",
    });
  }

  const first = new Map<string, Entry>();
  for (const entry of entries) {
    const key = entry.term.replace(/:+$/, "").trim().toLowerCase();
    const earlier = first.get(key);
    if (earlier !== undefined) {
      failures.push({
        line: entry.line,
        term: entry.term,
        message: `entry "${entry.term}" repeats "${earlier.term}" from line ${earlier.line}`,
        fix: "merge the two or rename one",
      });
      continue;
    }
    first.set(key, entry);
    const definition = entry.text.join(" ").trim();
    if (definition === "") {
      failures.push({
        line: entry.line,
        term: entry.term,
        message: `entry "${entry.term}" has no definition`,
        fix: "write one or two sentences under it, or remove the entry",
      });
      continue;
    }
    const sentences = countSentences(definition);
    if (sentences > MAX_SENTENCES) {
      warnings.push({
        line: entry.line,
        term: entry.term,
        message: `entry "${entry.term}" has ${sentences} sentences; a definition is one or two`,
        fix: "",
      });
    }
  }

  failures.sort((a, b) => a.line - b.line);
  warnings.sort((a, b) => a.line - b.line);
  return { entries: entries.length, problems: failures, warnings };
}

/** Code spans and the common abbreviations do not end a sentence. */
function countSentences(text: string): number {
  const plain = text
    .replace(/`[^`]*`/g, "x")
    .replace(/\b(e\.g|i\.e|etc|vs)\./gi, "$1")
    .trim();
  return plain.split(/(?<=[.!?])\s+(?=[A-Z"'(`*_[])/).filter((part) => part !== "").length;
}

function boldEntries(lines: readonly string[], warnings: GlossaryProblem[]): Entry[] {
  const entries: Entry[] = [];
  let current: Entry | null = null;

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) {
      current = null;
      return;
    }
    const entry = ENTRY.exec(line);
    if (entry !== null) {
      current = { term: (entry[1] ?? "").trim(), line: index + 1, text: [] };
      const rest = (entry[2] ?? "").replace(/^:+/, "").trim();
      if (rest !== "") current.text.push(rest);
      entries.push(current);
      return;
    }
    if (current !== null) {
      if (!AVOID.test(line)) current.text.push(line);
    } else if (BOLD_START.test(line)) {
      warnings.push({
        line: index + 1,
        term: null,
        message: `${quote(line)} starts like an entry but has no colon after the term, so it is not counted`,
        fix: "",
      });
    }
  });
  return entries;
}

const RULE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const FENCE = /^(?:```|~~~)/;

/**
 * The lines the format is read from, one for each line of the file so numbers
 * stay true: fenced blocks, HTML comments and horizontal rules become blank.
 */
function readable(source: string): string[] {
  let fenced = false;
  let commented = false;
  return source.split("\n").map((raw) => {
    const line = raw.trim();
    if (fenced || FENCE.test(line)) {
      if (FENCE.test(line)) fenced = !fenced;
      return "";
    }
    if (commented || line.startsWith("<!--")) {
      commented = !line.includes("-->");
      return "";
    }
    return RULE.test(line) ? "" : raw;
  });
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*$/;

/** `## Term` or `### Term`, then a paragraph. A heading followed by a deeper one only groups. */
function headingEntries(lines: readonly string[]): Entry[] {
  const entries: Entry[] = [];
  for (let index = 0; index < lines.length; index++) {
    const heading = HEADING.exec((lines[index] ?? "").trim());
    const level = heading?.[1]?.length ?? 0;
    if (heading === null || level < 2 || level > 3) continue;
    const entry: Entry = { term: (heading[2] ?? "").trim(), line: index + 1, text: [] };
    let next = index + 1;
    while (next < lines.length && (lines[next] ?? "").trim() === "") next++;
    const following = HEADING.exec((lines[next] ?? "").trim());
    if (following !== null && (following[1]?.length ?? 0) > level) continue;
    for (; next < lines.length; next++) {
      const text = (lines[next] ?? "").trim();
      if (text === "" || HEADING.test(text)) break;
      if (!AVOID.test(text)) entry.text.push(text);
    }
    entries.push(entry);
  }
  return entries;
}


function quote(line: string): string {
  return line.length > 60 ? `"${line.slice(0, 60)}..."` : `"${line}"`;
}
