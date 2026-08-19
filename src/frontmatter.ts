/**
 * A deliberately small YAML front-matter reader.
 *
 * It handles what skill and agent front matter actually uses: scalars, quoted
 * strings, inline and block sequences, and one level of nested mapping. It is
 * not a YAML parser and does not pretend to be one; anything it cannot read is
 * reported rather than guessed at, which is the behaviour a linter wants.
 */

export type Scalar = string | number | boolean;
export type Value = Scalar | Scalar[] | Record<string, Scalar>;

export interface Parsed {
  readonly data: Record<string, Value>;
  readonly body: string;
  readonly bodyStartLine: number;
  readonly error: string | null;
}

const DELIMITER = "---";

export function parse(source: string): Parsed {
  const lines = source.split("\n");
  if (lines[0]?.trim() !== DELIMITER) {
    return { data: {}, body: source, bodyStartLine: 1, error: "no front matter" };
  }
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === DELIMITER);
  if (end === -1) {
    return { data: {}, body: source, bodyStartLine: 1, error: "front matter is never closed" };
  }

  const data: Record<string, Value> = {};
  let currentKey: string | null = null;
  let sequence: Scalar[] | null = null;
  let error: string | null = null;

  for (let i = 1; i < end; i += 1) {
    const raw = lines[i] ?? "";
    if (raw.trim() === "" || raw.trimStart().startsWith("#")) continue;

    const indented = /^\s/.test(raw);
    const trimmed = raw.trim();

    if (indented && trimmed.startsWith("- ")) {
      if (currentKey === null) {
        error = `line ${i + 1}: list item outside any key`;
        continue;
      }
      sequence ??= [];
      sequence.push(scalar(trimmed.slice(2).trim()));
      data[currentKey] = sequence;
      continue;
    }
    if (indented) {
      // A nested mapping under the current key. Only depth one is understood.
      continue;
    }

    const colon = trimmed.indexOf(":");
    if (colon === -1) {
      error = `line ${i + 1}: expected 'key: value'`;
      continue;
    }
    currentKey = trimmed.slice(0, colon).trim();
    sequence = null;
    const rest = trimmed.slice(colon + 1).trim();
    data[currentKey] = rest === "" ? "" : scalar(rest);
  }

  return {
    data,
    body: lines.slice(end + 1).join("\n"),
    bodyStartLine: end + 2,
    error,
  };
}

function scalar(text: string): Scalar {
  if (text.startsWith("[") && text.endsWith("]")) return text;
  const unquoted =
    (text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))
      ? text.slice(1, -1)
      : text;
  const lower = unquoted.toLowerCase();
  if (["true", "yes", "on"].includes(lower)) return true;
  if (["false", "no", "off"].includes(lower)) return false;
  return unquoted;
}

export function asList(value: Value | undefined): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value.map(String);
  const text = String(value);
  if (text.startsWith("[") && text.endsWith("]")) {
    return text
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter((s) => s !== "");
  }
  return text.split(/[,\s]+/).filter((s) => s !== "");
}
