/**
 * The requirement-to-test table of an implementation report. A leaf module: text in,
 * rows out, no store and no file access.
 *
 * The table is the Markdown table headed exactly `| R | Test | Where |` (cells
 * trimmed, case as written) with its separator row under it. The last such table in
 * the text is the one read, so a report that quotes an earlier draft still answers
 * with its final table; a table inside a fenced code block is an example and is
 * never read. A row is a line whose first non-blank character is `|`, indented by
 * at most three spaces; the table ends at the first line that is not a row.
 */

export const R_HEADER: readonly string[] = ["R", "Test", "Where"];

export interface RRow {
  /** 1-based line of the row in the text. */
  readonly line: number;
  /** The three cells, trimmed, with `\|` unescaped. */
  readonly cells: readonly string[];
}

export interface RTable {
  readonly found: boolean;
  readonly rows: RRow[];
  /** Rows that could not be read, each naming its line. */
  readonly problems: string[];
}

/**
 * The cells of one row: split on `|` that is neither escaped (`\|`) nor inside a
 * backtick code span. A run of N backticks opens a span that the next run of
 * exactly N closes; one that is never closed is literal text. The row's leading
 * and trailing pipes are not cells.
 */
export function splitCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let i = 0;
  while (i < line.length) {
    const c = line[i] as string;
    if (c === "\\" && line[i + 1] === "|") {
      cell += "|";
      i += 2;
    } else if (c === "`") {
      let n = 0;
      while (line[i + n] === "`") n += 1;
      const run = "`".repeat(n);
      let close = -1;
      for (let j = i + n; j < line.length; ) {
        if (line[j] !== "`") {
          j += 1;
          continue;
        }
        let m = 0;
        while (line[j + m] === "`") m += 1;
        if (m === n) {
          close = j;
          break;
        }
        j += m;
      }
      if (close === -1) {
        cell += run;
        i += n;
      } else {
        cell += line.slice(i, close + n).replace(/\\\|/g, "|");
        i = close + n;
      }
    } else if (c === "|") {
      cells.push(cell);
      cell = "";
      i += 1;
    } else {
      cell += c;
      i += 1;
    }
  }
  cells.push(cell);
  const trimmed = cells.map((s) => s.trim());
  if (trimmed[0] === "") trimmed.shift();
  if (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") trimmed.pop();
  return trimmed;
}

const isRow = (line: string): boolean => /^ {0,3}\|/.test(line);
const isSeparator = (cells: readonly string[]): boolean => cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

export function parseRTable(text: string): RTable {
  const lines = text.split(/\r?\n/);
  let result: RTable = { found: false, rows: [], problems: [] };
  let fence: string | undefined;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    const marker = FENCE.exec(line)?.[1];
    if (fence !== undefined) {
      if (marker !== undefined && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = undefined;
      continue;
    }
    if (marker !== undefined) {
      fence = marker;
      continue;
    }
    if (!isRow(line)) continue;
    const head = splitCells(line);
    const next = lines[i + 1];
    if (head.length !== R_HEADER.length || !head.every((c, k) => c === R_HEADER[k])) continue;
    if (next === undefined || !isRow(next) || !isSeparator(splitCells(next))) continue;
    const rows: RRow[] = [];
    const problems: string[] = [];
    let j = i + 2;
    for (; j < lines.length && isRow(lines[j] as string); j += 1) {
      const cells = splitCells(lines[j] as string);
      if (cells.length === R_HEADER.length) rows.push({ line: j + 1, cells });
      else problems.push(`line ${j + 1}: a row has ${cells.length} cells, the table has ${R_HEADER.length}`);
    }
    result = { found: true, rows, problems };
    i = j - 1;
  }
  return result;
}
