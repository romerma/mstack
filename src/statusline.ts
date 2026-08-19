import { readFileSync, statSync } from "node:fs";

import { findStore } from "./paths.ts";
import { parseState } from "./state.ts";
import { check } from "./ledger.ts";
import { git } from "./gate.ts";
import { isActive } from "./lifecycle.ts";
import { reportFiles, reportKind, roleOf } from "./roles.ts";

/**
 * The status line exists for one signal the rest of the harness cannot deliver
 * in time: a verdict going stale.
 *
 * A ledger row is keyed by `(target, sha)` and a new head SHA voids it. The
 * gate catches that, but only when something runs the gate — by then the work
 * has usually moved on. pstack's own orchestration playbook records the cost:
 * "twenty-one verdicts went stale this way in one run with no signal at all".
 * A row that is re-read every turn is where that signal belongs.
 *
 * Everything else here is context that happens to be free once `.mstack/` is
 * already open.
 */

/** Only the fields we read. Everything is optional: absent keys are documented. */
export interface StatusInput {
  cwd?: string;
  model?: { display_name?: string };
  workspace?: { current_dir?: string; project_dir?: string };
  context_window?: { used_percentage?: number | null };
  exceeds_200k_tokens?: boolean;
}

/** Built from the code point. A literal ESC byte in source is invisible in a diff. */
const ESC = String.fromCharCode(27);
const RESET = `${ESC}[0m`;
const DIM = `${ESC}[2m`;
const RED = `${ESC}[31m`;
const YELLOW = `${ESC}[33m`;
const GREEN = `${ESC}[32m`;
const CYAN = `${ESC}[36m`;
const SEP = `${DIM} · ${RESET}`;
const PLAIN_SEP = " · ";

/**
 * `NO_COLOR` is honoured because the status line is captured, not attached to a
 * tty, so the usual `isatty` check would disable colour for everyone.
 * See https://no-color.org.
 */
function paint(colour: string, text: string, colours: boolean): string {
  return colours ? `${colour}${text}${RESET}` : text;
}

export function parseInput(raw: string): StatusInput {
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === "object" ? (value as StatusInput) : {};
  } catch {
    return {};
  }
}

export interface StatusOptions {
  colours?: boolean;
  /** Terminal width. Claude Code sets COLUMNS before running the command; `tput cols` cannot see it. */
  columns?: number;
}

export function render(input: StatusInput, options: StatusOptions = {}): string {
  const colours = options.colours ?? true;
  const parts: string[] = [];

  const model = input.model?.display_name;
  if (model !== undefined && model !== "") parts.push(paint(CYAN, model, colours));

  const cwd = input.workspace?.current_dir ?? input.cwd ?? process.cwd();
  const store = findStore(cwd);

  if (store === null) {
    // No store here. Say so once, quietly: it is the difference between
    // "nothing to report" and "the status line is broken".
    parts.push(paint(DIM, "no .mstack", colours));
    return join(parts, options);
  }

  const branch = git(store, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== null && branch !== "" && branch !== "HEAD") parts.push(branch);

  let state;
  try {
    state = parseState(store.state);
  } catch {
    // A malformed store is exactly what the gate is for. Do not duplicate its
    // diagnosis here, but do not render a confident line over a broken file.
    parts.push(paint(RED, "state.json unreadable", colours));
    return join(parts, options);
  }

  const active = state.items.filter((item) => isActive(item.status));
  if (active.length === 0) {
    const pending = state.items.filter((item) => item.status === "pending").length;
    parts.push(paint(DIM, pending > 0 ? `idle, ${pending} pending` : "idle", colours));
    return join(parts, options);
  }

  // More than one active item is an invariant violation the gate reports in
  // full. Here it is one word, because a status line that hides it is worse
  // than one that does not mention it.
  if (active.length > 1) {
    parts.push(paint(RED, `${active.length} active items`, colours));
    return join(parts, options);
  }

  const item = active[0]!;
  parts.push(`#${item.id} ${item.slug}`);
  parts.push(paint(item.status === "blocked" ? RED : YELLOW, item.status, colours));

  const sha = git(store, ["rev-parse", "HEAD"]);
  if (sha !== null) {
    const result = check(store, item.slug, sha);
    if (result.passing && result.best !== undefined) {
      parts.push(paint(GREEN, result.best.verdict, colours));
    } else if (result.stale.length > 0) {
      // The whole reason this file exists.
      parts.push(paint(RED, `verdict stale (${result.stale.length})`, colours));
    } else if (result.best !== undefined) {
      parts.push(paint(YELLOW, result.best.verdict, colours));
    } else {
      parts.push(paint(DIM, "unverified", colours));
    }
  }

  const used = input.context_window?.used_percentage;
  if (typeof used === "number") {
    const colour = used >= 80 ? RED : used >= 60 ? YELLOW : DIM;
    parts.push(paint(colour, `ctx ${Math.round(used)}%`, colours));
  }

  return join(parts, options);
}

/**
 * Truncation counts printable characters, not bytes: the escape sequences are
 * added after the budget is spent, so colour never eats width.
 */
function join(parts: readonly string[], options: StatusOptions): string {
  const colours = options.colours ?? true;
  const columns = options.columns;
  const line = parts.join(colours ? SEP : PLAIN_SEP);
  if (columns === undefined || columns <= 0) return line;
  const bare = stripAnsi(line);
  if (bare.length <= columns) return line;
  return `${truncateVisible(line, columns - 1, colours)}…`;
}

const ANSI = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

function truncateVisible(text: string, limit: number, colours: boolean): string {
  let visible = 0;
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    if (text.startsWith(`${ESC}[`, i)) {
      const end = text.indexOf("m", i);
      if (end !== -1) {
        out += text.slice(i, end + 1);
        i = end;
        continue;
      }
    }
    if (visible >= limit) break;
    out += text[i];
    visible += 1;
  }
  return colours ? `${out}${RESET}` : out;
}

/**
 * Never blocks a turn. Any failure prints nothing and exits 0 — a status line
 * that can break a session is a status line that gets deleted.
 */
export function statusline(): number {
  try {
    let raw = "";
    try {
      raw = readFileSync(0, "utf8");
    } catch {
      raw = "";
    }
    const columns = Number.parseInt(process.env.COLUMNS ?? "", 10);
    process.stdout.write(
      `${render(parseInput(raw), {
        colours: process.env.NO_COLOR === undefined,
        columns: Number.isFinite(columns) ? columns : undefined,
      })}\n`,
    );
  } catch {
    // Deliberately silent.
  }
  return 0;
}

/* ------------------------------------------------------------------------- *
 * Subagent rows
 *
 * The main status line is a user setting Claude Code does not let a plugin
 * register. `subagentStatusLine` is the one a plugin may ship in its own
 * settings.json, and it earns its place by showing, while the work is still
 * running, the fact `SubagentStop` can only report once it is too late: which
 * worker has not written its report yet.
 * ------------------------------------------------------------------------- */

/** Only the fields we read, out of the documented task shape. */
export interface SubagentTask {
  id?: string;
  name?: string;
  type?: string;
  status?: string;
  description?: string;
  label?: string;
  tokenCount?: number;
  cwd?: string;
}

export interface SubagentInput {
  cwd?: string;
  columns?: number;
  tasks?: SubagentTask[];
}

export interface SubagentRow {
  id: string;
  content: string;
}

function compactTokens(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return thousands < 10 ? `${thousands.toFixed(1)}k` : `${Math.round(thousands)}k`;
}

/**
 * A row is emitted only for a role mstack actually has a contract with.
 * Everything else is omitted, which leaves Claude Code's default rendering in
 * place rather than replacing it with something worse.
 */
export function renderSubagents(input: SubagentInput, options: StatusOptions = {}): SubagentRow[] {
  const colours = options.colours ?? true;
  const columns = options.columns ?? input.columns;
  const rows: SubagentRow[] = [];

  for (const task of input.tasks ?? []) {
    if (task.id === undefined) continue;
    const kind = reportKind(task.type ?? task.name);
    if (kind === undefined) continue;

    const parts: string[] = [paint(CYAN, roleOf(task.type ?? task.name), colours)];

    const store = findStore(task.cwd ?? input.cwd ?? process.cwd());
    let item;
    if (store !== null) {
      try {
        item = parseState(store.state).items.find((candidate) => isActive(candidate.status));
      } catch {
        item = undefined;
      }
    }

    if (store !== null && item !== undefined) {
      parts.push(`#${item.id} ${item.slug}`);
      // Same prefix contract and same 40-byte floor the SubagentStop hook uses.
      // A file that exists but holds nothing is not a report, and calling it one
      // here would teach people to trust the row.
      const written = reportFiles(store.progress, kind, item.slug).filter(
        (file) => statSync(file).size >= 40,
      );
      parts.push(
        written.length > 0
          ? paint(GREEN, written.length > 1 ? `${written.length} ${kind} reports` : `${kind} report written`, colours)
          : paint(YELLOW, `no ${kind} report yet`, colours),
      );
    }

    if (typeof task.tokenCount === "number" && task.tokenCount > 0) {
      parts.push(paint(DIM, compactTokens(task.tokenCount), colours));
    }

    rows.push({ id: task.id, content: join(parts, { colours, columns }) });
  }

  return rows;
}

/** One JSON object per line, as the subagent status line contract requires. */
export function subagentStatusline(): number {
  try {
    let raw = "";
    try {
      raw = readFileSync(0, "utf8");
    } catch {
      raw = "";
    }
    const columns = Number.parseInt(process.env.COLUMNS ?? "", 10);
    const rows = renderSubagents(parseInput(raw) as SubagentInput, {
      colours: process.env.NO_COLOR === undefined,
      columns: Number.isFinite(columns) ? columns : undefined,
    });
    for (const row of rows) process.stdout.write(`${JSON.stringify(row)}\n`);
  } catch {
    // Deliberately silent: a broken row must never take the panel with it.
  }
  return 0;
}
