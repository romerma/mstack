import { readFileSync } from "node:fs";

import { findStore, type Store } from "./paths.ts";
import { activeItem, parseState } from "./state.ts";
import { check } from "./ledger.ts";
import { git } from "./git.ts";
import { isActive } from "./lifecycle.ts";
import { reportKind, roleOf, substantialReports } from "./roles.ts";

/**
 * The status line exists for one signal the rest of the harness cannot deliver
 * in time: a verdict going stale.
 *
 * A ledger row is keyed by `(target, sha)` and a new head SHA voids it. The
 * gate catches that, but only when something runs the gate — by then the work
 * has usually moved on. pstack's own shipping playbook records the cost:
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
    // `typeof [] === "object"` on its own let an array through as the payload,
    // so `parseInput("[]")` returned an array from a function documented to
    // return `{}`. Harmless downstream, but the contract was false.
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as StatusInput)
      : {};
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
    // `blocked` is not an active status, so it fell through to "idle" — the
    // status line said the opposite of the truth about the one state where a
    // human is required. It is louder than the pending count, so it goes first.
    const blocked = state.items.filter((item) => item.status === "blocked");
    if (blocked.length > 0) {
      const first = blocked[0]!;
      parts.push(`#${first.id} ${first.slug}`);
      parts.push(paint(RED, blocked.length > 1 ? `${blocked.length} blocked` : "blocked", colours));
      return join(parts, options);
    }
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
  // Not `blocked` here: that status never reaches this branch, and the ternary
  // that pretended otherwise was unreachable.
  parts.push(paint(YELLOW, item.status, colours));

  const sha = git(store, ["rev-parse", "HEAD"]);
  if (sha !== null) {
    // Wrapped on its own: an unreadable ledger.tsv used to throw past every
    // part already computed and print an empty line, where the sibling
    // state.json failure degrades to a message.
    let result: ReturnType<typeof check> | null = null;
    try {
      result = check(store, item.slug, sha);
    } catch {
      parts.push(paint(RED, "ledger unreadable", colours));
    }

    if (result !== null) {
      // A verdict at HEAD is reported as itself, whatever it says. Testing
      // staleness first meant a verifier-failed row *at HEAD* rendered as
      // "verdict stale" — telling the reader nobody had verified this, when the
      // truth was that the verifier ran here and failed. Reachable by the most
      // ordinary sequence there is: verify, commit, verify again, fail.
      if (result.best !== undefined) {
        const verdict = result.best.verdict;
        const colour = result.passing ? GREEN : verdict === "verifier-failed" ? RED : YELLOW;
        parts.push(paint(colour, verdict, colours));
      } else if (result.stale.length > 0) {
        // The whole reason this file exists. No count: `stale.length` is every
        // row at any other SHA, so it grew with the age of the item and said
        // nothing about how stale anything was.
        parts.push(paint(RED, "verdict stale", colours));
      } else {
        parts.push(paint(DIM, "unverified", colours));
      }
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
  // Code points, not UTF-16 code units. `.length` counted an emoji as two and
  // `text[i]` split it in half, so a branch name with one — git allows them —
  // reached the terminal as U+FFFD, and through JSON.stringify as a lone
  // surrogate escape. Wide characters still cost two terminal columns and are
  // measured as one; an east-asian-width table is not worth carrying for that.
  if ([...stripAnsi(line)].length <= columns) return line;
  return `${truncateVisible(line, columns - 1, colours)}…`;
}

const ANSI = new RegExp(`${ESC}\\[[0-9;]*m`, "g");
const ANSI_ONE = new RegExp(`^${ESC}\\[[0-9;]*m`);

function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

function truncateVisible(text: string, limit: number, colours: boolean): string {
  let visible = 0;
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text.startsWith(`${ESC}[`, i)) {
      // Bounded to the sequence itself. A bare indexOf("m") would swallow
      // everything up to the next "m" anywhere in the line, which disagreed
      // with what stripAnsi measured.
      const match = ANSI_ONE.exec(text.slice(i));
      if (match !== null) {
        out += match[0];
        i += match[0].length;
        continue;
      }
    }
    if (visible >= limit) break;
    // Iterate by code point so a surrogate pair is never split.
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    out += ch;
    i += ch.length;
    visible += 1;
  }
  return colours ? `${out}${RESET}` : out;
}

/**
 * Make the "prints nothing and exits 0" promise actually true.
 *
 * `process.stdout.write` is asynchronous on a pipe. When the reader goes away
 * the EPIPE arrives as an unhandled `error` event *after* the surrounding
 * try/catch has already returned, so the catch never sees it: the process died
 * with a stack trace on stderr and exit code 1. Reproduced 5 times out of 5.
 *
 * That is not an edge case here. The status line docs say Claude Code cancels
 * the in-flight script when a new update triggers, which is precisely a reader
 * going away mid-write.
 *
 * Both handlers are deliberate redundancy: on this machine either one alone
 * holds the promise, and they cover the two runtimes the launcher chooses
 * between. Removing the call to this function does fail the launcher test.
 */
function silenceBrokenPipe(): void {
  process.stdout.on("error", () => {});
  process.on("uncaughtException", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE" && error.code !== "ERR_STREAM_DESTROYED") throw error;
  });
}

/**
 * Never blocks a turn. Any failure prints nothing and exits 0 — a status line
 * that can break a session is a status line that gets deleted.
 */
export function statusline(): number {
  silenceBrokenPipe();
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

/**
 * More than one active item means we cannot say which one a worker belongs to.
 *
 * The bar refuses to pick in that case and reports the violation. The rows used
 * to pick the first silently and print its slug beside every worker, so the two
 * halves of this file confidently disagreed on the same screen.
 */
function ambiguous(store: Store): boolean {
  try {
    return parseState(store.state).items.filter((item) => isActive(item.status)).length > 1;
  } catch {
    return true;
  }
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
    // `activeItem`, not a hand-inlined copy of it. This used to duplicate the
    // body including its try/catch, which is how the two consumers drifted.
    const item = store === null ? undefined : activeItem(store);

    if (store !== null && item !== undefined && !ambiguous(store)) {
      parts.push(`#${item.id} ${item.slug}`);
      // Same prefix contract and same floor the SubagentStop hook uses, from
      // the one place both import it.
      const written = substantialReports(store.progress, kind, item.slug);
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
  silenceBrokenPipe();
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
