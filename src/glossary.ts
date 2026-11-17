/**
 * The entry format of `GLOSSARY.md`, checked as structure and never as content.
 *
 * An entry is a bold term and a colon at the margin, opening a block of lines
 * or as a list item, then its definition on that line or below; the rest of the
 * block belongs to it, where an `_Avoid_:` line or a bold label such as
 * `**Example:**` is not definition text. A file with no bold entry is read by
 * its `##` and `###` headings, one per term. The format is stated for writers in
 * `skills/reflect/references/domain-docs.md`, and a test pins that its example
 * passes this check.
 */

/** A definition is one or two sentences; a third is a paragraph, and a paragraph is an essay. */
export const MAX_SENTENCES = 2;

const ENTRY = /^(?:[-*+]\s+)?\*\*([^*]+?)(?:\*\*:|:\*\*)(.*)$/;
const AVOID = /^_Avoid_:/;
const BOLD_START = /^(?:[-*+]\s+)?\*\*[^*]/;
const LIST = /^[-*+]\s/;

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
  const parts = partsOf(readable(source));
  const { bold, headed } = readEntries(parts, warnings);
  const entries = bold.length > 0 ? bold : headed;

  if (entries.length === 0 && parts.length > 0) {
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

type Line = { readonly number: number; readonly text: string; readonly indented: boolean };

/** A heading (level 1 to 6), or a block of text lines (level 0), in file order. */
interface Part {
  readonly level: number;
  readonly number: number;
  readonly title: string;
  readonly lines: Line[];
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*$/;

/** A block is a run of text lines, ended by a blank line or a heading. */
function partsOf(lines: readonly (string | null)[]): Part[] {
  const parts: Part[] = [];
  let block: Part | null = null;
  lines.forEach((raw, index) => {
    if (raw === null) return;
    const text = raw.trim();
    const heading = HEADING.exec(text);
    const level = heading?.[1]?.length ?? 0;
    if (heading !== null) parts.push({ level, number: index + 1, title: (heading[2] ?? "").trim(), lines: [] });
    if (text === "" || heading !== null) {
      block = null;
      return;
    }
    if (block === null) {
      block = { level: 0, number: index + 1, title: "", lines: [] };
      parts.push(block);
    }
    block.lines.push({ number: index + 1, text, indented: /^\s/.test(raw) });
  });
  return parts;
}

/**
 * A `##` or `###` heading followed by a deeper heading or a bold entry groups.
 * Followed by other text it is a term, and its section (up to the next heading
 * of level 1 to 3) holds no bold entry; followed by nothing it has no definition.
 */
function readEntries(parts: readonly Part[], warnings: GlossaryProblem[]): { bold: Entry[]; headed: Entry[] } {
  const bold: Entry[] = [];
  const headed: Entry[] = [];
  let termLed = false;
  parts.forEach((part, index) => {
    if (part.level === 0) {
      if (!termLed) boldEntries(part.lines, bold, warnings);
      return;
    }
    if (part.level > 3) return;
    termLed = false;
    const next = parts[index + 1];
    if (part.level === 1 || (next !== undefined && next.level > part.level) || opensEntry(next?.lines[0])) return;
    const block = next?.level === 0 ? next : undefined;
    termLed = block !== undefined;
    headed.push({ term: part.title, line: part.number, text: block === undefined ? [] : definition(block.lines) });
  });
  return { bold, headed };
}

/**
 * A block's first line starts an entry when it is a bold term at the margin; so
 * does a later list item at the margin, unless the block opened with a non-list
 * entry. Every other line belongs to the entry above it.
 */
function boldEntries(block: readonly Line[], entries: Entry[], warnings: GlossaryProblem[]): void {
  const paragraph = opensEntry(block[0]) && !LIST.test(block[0]?.text ?? "");
  let current: Entry | null = null;
  block.forEach((line, index) => {
    const entry = line.indented ? null : ENTRY.exec(line.text);
    if (entry !== null && (index === 0 || (LIST.test(line.text) && !paragraph))) {
      current = { term: (entry[1] ?? "").trim(), line: line.number, text: [] };
      const rest = (entry[2] ?? "").replace(/^:+/, "").trim();
      if (rest !== "") current.text.push(rest);
      entries.push(current);
    } else if (current !== null) {
      current.text.push(...definition([line]));
    } else if (index === 0 && !ENTRY.test(line.text) && BOLD_START.test(line.text)) {
      const message = `${quote(line.text)} starts like an entry but has no colon after the term, so it is not counted`;
      warnings.push({ line: line.number, term: null, message, fix: "" });
    }
  });
}

function opensEntry(line: Line | undefined): boolean {
  return line !== undefined && !line.indented && ENTRY.test(line.text);
}

/** `_Avoid_:` lines and bold labels such as `**Example:**` are not definition text. */
function definition(lines: readonly Line[]): string[] {
  return lines.filter((line) => !AVOID.test(line.text) && !ENTRY.test(line.text)).map((line) => line.text);
}

const RULE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const FENCE = /^(?:```|~~~)/;

/**
 * The lines the format is read from, one for each line of the file so numbers
 * stay true: fenced blocks and horizontal rules become blank, and an HTML
 * comment line becomes null, which neither ends a block nor counts as text.
 */
function readable(source: string): (string | null)[] {
  let fenced = false;
  let commented = false;
  return source.replace(/^\uFEFF/, "").split("\n").map((raw) => {
    const line = raw.trim();
    if (fenced || FENCE.test(line)) {
      if (FENCE.test(line)) fenced = !fenced;
      return "";
    }
    if (commented || line.startsWith("<!--")) {
      commented = !line.includes("-->");
      return null;
    }
    return RULE.test(line) ? "" : raw;
  });
}

function quote(line: string): string {
  return line.length > 60 ? `"${line.slice(0, 60)}..."` : `"${line}"`;
}
