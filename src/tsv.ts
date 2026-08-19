import { appendFileSync, closeSync, existsSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";

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

/**
 * Create the file with this header, or widen an existing one.
 *
 * A column added to the end of a header is the only schema change these files
 * take, and without this the next `append` would write more cells than the
 * header names — silently misaligning every row against a store written by an
 * older version. Widening is refused unless the existing header is a prefix of
 * the new one, because anything else is a rename or a reorder, and quietly
 * guessing at those is how data gets attributed to the wrong column.
 */
export function ensureHeader(file: string, header: readonly string[]): void {
  if (!existsSync(file)) {
    writeFileSync(file, `${header.join("\t")}\n`, "utf8");
    return;
  }
  const { header: present } = read(file);
  if (present.length === 0 || present.length >= header.length) return;
  const isPrefix = present.every((name, i) => name === header[i]);
  if (!isPrefix) return;

  const source = readFileSync(file, "utf8");
  const rest = source.slice(source.indexOf("\n") + 1);
  writeFileSync(file, `${header.join("\t")}\n${rest}`, "utf8");
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

/**
 * Serialise a read-then-append across processes.
 *
 * Checking a file for a value and then appending to it is two operations, and
 * fan-out means several `mstack` processes do it at once: twelve concurrent
 * `decide` calls produced eight distinct millisecond timestamps, because each
 * one read the file before any of them had written. `open` with `wx` is atomic
 * — exactly one process creates the lock and the rest wait.
 *
 * A stale lock from a killed process is broken after the timeout rather than
 * deadlocking the workflow: losing serialisation is recoverable, a CLI that
 * hangs forever is not.
 */
export function withLock<T>(file: string, run: () => T, options: { timeoutMs?: number } = {}): T {
  const lock = `${file}.lock`;
  const timeout = options.timeoutMs ?? 2_000;
  const started = Date.now();

  for (;;) {
    try {
      closeSync(openSync(lock, "wx"));
      break;
    } catch {
      if (Date.now() - started > timeout) {
        // Break it and proceed. The alternative is a hang.
        try {
          rmSync(lock, { force: true });
        } catch {
          // Someone else broke it first, which is the outcome we wanted.
        }
        break;
      }
      // Busy-wait deliberately: these critical sections are a file read and one
      // append, and pulling in async here would make every caller async.
      const until = Date.now() + 2;
      while (Date.now() < until) {
        // spin
      }
    }
  }

  try {
    return run();
  } finally {
    try {
      rmSync(lock, { force: true });
    } catch {
      // Nothing useful to do; the timeout above covers a leftover.
    }
  }
}
