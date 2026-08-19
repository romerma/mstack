import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * TSV because GitHub renders it as a sortable table, `column -s$'\t' -t` and
 * spreadsheets read it, and a row appends with one command. Taken from pstack's
 * show-me-your-work skill, along with its formula guard.
 */

const FORMULA_LEADERS = new Set(["=", "+", "-", "@"]);

/**
 * Make one value safe to store in a TSV cell.
 *
 * Two separate jobs. Strip tabs, newlines and carriage returns so a cell cannot
 * break the row apart. Then prefix any cell a spreadsheet would parse as a
 * formula with a single quote: evidence is often attacker-influenced text (PR
 * titles, branch names, filenames, generated output), and it must not become
 * formula execution when a reviewer opens the file.
 */
export function cell(value: unknown): string {
  let s = String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
  const first = s.charAt(0);
  if (first !== "" && FORMULA_LEADERS.has(first)) s = `'${s}`;
  return s;
}

export function row(values: readonly unknown[]): string {
  return values.map(cell).join("\t");
}

export function ensureHeader(file: string, header: readonly string[]): void {
  if (!existsSync(file)) writeFileSync(file, `${header.join("\t")}\n`, "utf8");
}

export function append(file: string, header: readonly string[], values: readonly unknown[]): void {
  ensureHeader(file, header);
  appendFileSync(file, `${row(values)}\n`, "utf8");
}

export interface TsvTable {
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export function read(file: string): TsvTable {
  if (!existsSync(file)) return { header: [], rows: [] };
  const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.length > 0);
  const first = lines.shift();
  if (first === undefined) return { header: [], rows: [] };
  return { header: first.split("\t"), rows: lines.map((l) => l.split("\t")) };
}

/** Read a TSV as objects keyed by its header. Unknown columns are dropped. */
export function readRecords(file: string): Record<string, string>[] {
  const { header, rows } = read(file);
  return rows.map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((name, i) => {
      record[name] = cells[i] ?? "";
    });
    return record;
  });
}
