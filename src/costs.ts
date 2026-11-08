import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import { git } from "./git.ts";
import { isActive } from "./lifecycle.ts";
import type { Store } from "./paths.ts";
import { reportFiles, roleOf, roundOf } from "./roles.ts";
import { parseState } from "./state.ts";
import { append, readRecords, withLock } from "./tsv.ts";

/**
 * Tokens per item, per role and per model, recorded without slowing a hook.
 *
 * ## What was measured before this was built (`impl_cost-ledger.md`, rung 4)
 *
 * - The transcript's `{"type":"cost-state"}` line is on disk *before* the
 *   SessionEnd hook runs, so a SessionEnd flush can read it.
 * - Its `modelUsage` includes subagent usage: main plus subagent transcript
 *   sums matched it to the token.
 * - `--resume` appends to the same file and the same session id, and the
 *   cost-state line is cumulative, so a resumed session's last line is the
 *   whole session's total, not the resume's.
 * - `/compact` writes no assistant usage to any transcript. Its tokens are in
 *   cost-state and nowhere else.
 *
 * ## Shape
 *
 * Nothing here parses a transcript on a hot path. The hooks that run every turn
 * (`Stop`) do a stat and a compare. The transcript is read only by a *flush*,
 * which runs at SessionEnd, at the next SessionStart for a session that never
 * reached one, and inside `mstack cost`.
 *
 * A **mark** says "from this byte offset of this transcript, usage belongs to
 * this item". Marks live under `git rev-parse --git-path mstack/`: machine
 * local, per worktree, and never inside `.mstack/`, because a byte offset into
 * a file on one machine means nothing on another.
 *
 * A flush recomputes totals from the mark's offset and appends only
 * `total - sum(existing rows)` per key, so flushing twice changes nothing and a
 * crash between two flushes loses nothing.
 */

export const NONE = "(none)";

export const HEADER = [
  "ts",
  "run",
  "target",
  "role",
  "agent_id",
  "model",
  "input",
  "cache_write",
  "cache_read",
  "output",
  "messages",
  "cost_usd",
  "source",
] as const;

const MARKS_FILE = "costs-marks.jsonl";
const ENDED_KEEP_MS = 14 * 24 * 3600 * 1000;
const CHUNK = 1 << 20;

export interface Mark {
  /** `<session>@<offset>`: the key every row of this segment carries. */
  readonly run: string;
  readonly session: string;
  readonly transcript_path: string;
  readonly offset: number;
  readonly slug: string | null;
  readonly ts: string;
}

interface Ended {
  readonly session: string;
  readonly ended: true;
  /** Transcript size when the flush ran. A larger file later means something was written after. */
  readonly size: number;
  readonly ts: string;
}

export interface SessionMarks {
  readonly session: string;
  readonly marks: Mark[];
  readonly ended: Ended | undefined;
}

interface Usage {
  input: number;
  cache_write: number;
  cache_read: number;
  output: number;
  messages: number;
}

const COLUMNS = ["input", "cache_write", "cache_read", "output"] as const;

function blank(): Usage {
  return { input: 0, cache_write: 0, cache_read: 0, output: 0, messages: 0 };
}

// ---------------------------------------------------------------------------
// Where marks live
// ---------------------------------------------------------------------------

/**
 * `git rev-parse --git-path mstack` without spawning git.
 *
 * `Stop` runs this on every turn and a spawn is ~20 ms, so the common shapes
 * are read straight off the filesystem: a `.git` directory, or a `.git` file
 * (`gitdir: <path>`) in a linked worktree. `mstack/` is not one of git's shared
 * paths, so in a worktree it is the worktree's own git dir, which is what the
 * spawn answers too (a test pins the two equal). Anything stranger falls back
 * to the spawn.
 */
export function marksDir(store: Store): string | null {
  let dir = resolve(store.root);
  for (;;) {
    const dotGit = join(dir, ".git");
    try {
      const st = statSync(dotGit);
      if (st.isDirectory()) return join(dotGit, "mstack");
      if (st.isFile()) {
        const text = readFileSync(dotGit, "utf8");
        const m = /^gitdir:\s*(.+)$/m.exec(text);
        if (m?.[1] !== undefined) {
          const gitdir = m[1].trim();
          return join(isAbsolute(gitdir) ? gitdir : resolve(dir, gitdir), "mstack");
        }
      }
    } catch {
      // not here; keep walking
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const spawned = git(store, ["rev-parse", "--git-path", "mstack"]);
  if (spawned === null || spawned === "") return null;
  return isAbsolute(spawned) ? spawned : resolve(store.root, spawned);
}

function marksFile(store: Store): string | null {
  const dir = marksDir(store);
  return dir === null ? null : join(dir, MARKS_FILE);
}

function parseMarkLine(line: string): Mark | Ended | null {
  try {
    const o = JSON.parse(line) as Record<string, unknown>;
    if (typeof o["session"] !== "string") return null;
    if (o["ended"] === true) {
      return {
        session: o["session"],
        ended: true,
        size: typeof o["size"] === "number" ? o["size"] : 0,
        ts: typeof o["ts"] === "string" ? o["ts"] : "",
      };
    }
    if (typeof o["run"] !== "string" || typeof o["transcript_path"] !== "string" || typeof o["offset"] !== "number") {
      return null;
    }
    return {
      run: o["run"],
      session: o["session"],
      transcript_path: o["transcript_path"],
      offset: o["offset"],
      slug: typeof o["slug"] === "string" ? o["slug"] : null,
      ts: typeof o["ts"] === "string" ? o["ts"] : "",
    };
  } catch {
    return null;
  }
}

/** Every session in the marks file, in file order. Unreadable lines are skipped. */
export function readSessions(file: string): SessionMarks[] {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const order: string[] = [];
  const marks = new Map<string, Mark[]>();
  const ended = new Map<string, Ended | undefined>();
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const entry = parseMarkLine(line);
    if (entry === null) continue;
    if (!marks.has(entry.session)) {
      order.push(entry.session);
      marks.set(entry.session, []);
    }
    if ("ended" in entry) {
      ended.set(entry.session, entry);
    } else {
      marks.get(entry.session)?.push(entry);
      // A mark after an end record is a resume: the end no longer describes the file.
      ended.set(entry.session, undefined);
    }
  }
  return order.flatMap((session) => {
    const list = (marks.get(session) ?? []).slice().sort((a, b) => a.offset - b.offset || a.ts.localeCompare(b.ts));
    return list.length === 0 ? [] : [{ session, marks: list, ended: ended.get(session) }];
  });
}

/** The newest mark of one session without parsing the rest of the file. */
function lastMarkFor(file: string, session: string): Mark | undefined {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i] as string;
    if (line === "" || !line.includes(session)) continue;
    const entry = parseMarkLine(line);
    if (entry !== null && entry.session === session && !("ended" in entry)) return entry;
  }
  return undefined;
}

function appendLine(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  withLock(file, () => appendFileSync(file, `${JSON.stringify(value)}\n`, "utf8"));
}

function newMark(session: string, transcript: string, slug: string | null): Mark | null {
  let size: number;
  try {
    size = statSync(transcript).size;
  } catch {
    return null;
  }
  return {
    run: `${session}@${size}`,
    session,
    transcript_path: transcript,
    offset: size,
    slug,
    ts: new Date().toISOString(),
  };
}

function activeSlug(store: Store): { on: boolean; slug: string | null } {
  const state = parseState(store.state);
  return { on: state.rules.record_costs, slug: state.items.find((i) => isActive(i.status))?.slug ?? null };
}

// ---------------------------------------------------------------------------
// Hook entry points. Each one may throw; the caller isolates them.
// ---------------------------------------------------------------------------

/**
 * Stop: append a mark only when the active item changed.
 *
 * The unchanged case reads the (small) marks file, parses `state.json` and
 * compares. The transcript is stat'ed only when there is something to write.
 */
export function onStop(store: Store, input: { session_id?: string; transcript_path?: string }): void {
  const { session_id: session, transcript_path: transcript } = input;
  if (session === undefined || session === "" || transcript === undefined || transcript === "") return;
  const { on, slug } = activeSlug(store);
  if (!on) return;
  const file = marksFile(store);
  if (file === null) return;
  const last = lastMarkFor(file, session);
  if (last !== undefined && last.slug === slug) return;
  const mark = newMark(session, transcript, slug);
  if (mark !== null) appendLine(file, mark);
}

/**
 * SessionStart: mark this session, then settle sessions that never ended.
 *
 * A session that crashed, or was killed, never ran its SessionEnd flush; this
 * is where its usage is picked up. The time spent is bounded: a backlog of huge
 * transcripts is finished over several starts rather than stalling one.
 */
export function onSessionStart(
  store: Store,
  input: { session_id?: string; transcript_path?: string },
  budgetMs = 3_000,
): void {
  const { on, slug } = activeSlug(store);
  if (!on) return;
  const file = marksFile(store);
  if (file === null) return;
  const { session_id: session, transcript_path: transcript } = input;

  if (session !== undefined && session !== "" && transcript !== undefined && transcript !== "") {
    const last = lastMarkFor(file, session);
    if (last === undefined || last.slug !== slug || last.transcript_path !== transcript) {
      const mark = newMark(session, transcript, slug);
      if (mark !== null) appendLine(file, mark);
    }
  }

  const deadline = Date.now() + budgetMs;
  const sessions = readSessions(file);
  for (const s of sessions) {
    if (s.session === session) continue;
    if (Date.now() > deadline) break;
    if (needsFlush(s)) flushSession(store, s, file);
  }
  prune(file, sessions);
}

/** SessionEnd: the usual flush. cost-state is on disk by now (measured). */
export function onSessionEnd(store: Store, input: { session_id?: string }): void {
  const session = input.session_id;
  if (session === undefined || session === "") return;
  const { on } = activeSlug(store);
  if (!on) return;
  const file = marksFile(store);
  if (file === null) return;
  const found = readSessions(file).find((s) => s.session === session);
  // Nothing written since the last flush means nothing to read: a 50 MB
  // transcript is not re-scanned to learn that.
  if (found !== undefined && needsFlush(found)) flushSession(store, found, file);
}

function needsFlush(s: SessionMarks): boolean {
  const tp = (s.marks.at(-1) as Mark).transcript_path;
  let size: number;
  try {
    size = statSync(tp).size;
  } catch {
    return false;
  }
  return s.ended === undefined || s.ended.size !== size;
}

/** Drop sessions that are settled and old, or whose transcript is gone. */
function prune(file: string, sessions: readonly SessionMarks[]): void {
  const keep = sessions.filter((s) => {
    if (!existsSync((s.marks.at(-1) as Mark).transcript_path)) return false;
    if (s.ended === undefined) return true;
    const when = Date.parse(s.ended.ts);
    return Number.isNaN(when) || Date.now() - when < ENDED_KEEP_MS;
  });
  if (keep.length === sessions.length) return;
  const lines = keep.flatMap((s) => [...s.marks, ...(s.ended === undefined ? [] : [s.ended])]);
  withLock(file, () => {
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, lines.map((l) => `${JSON.stringify(l)}\n`).join(""), "utf8");
    renameSync(tmp, file);
  });
}

/** `mstack cost` calls this before it reads: settle every session that still needs it. */
export function flushAll(store: Store): number {
  const file = marksFile(store);
  if (file === null) return 0;
  let written = 0;
  for (const s of readSessions(file)) {
    if (needsFlush(s)) written += flushSession(store, s, file);
  }
  return written;
}

// ---------------------------------------------------------------------------
// Reading a transcript
// ---------------------------------------------------------------------------

/**
 * Stream `[start, end)` of a file one line at a time.
 *
 * Never the whole file: a transcript is tens of megabytes by the end of a long
 * session, and this runs inside a hook with a timeout. `fn` gets a view into a
 * reused buffer, so it must finish with the bytes before it returns.
 */
export function eachLine(path: string, start: number, end: number, fn: (line: Buffer, pos: number) => void): void {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.allocUnsafe(CHUNK);
    let pos = start;
    let lineStart = start;
    let pending: Buffer[] = [];
    while (pos < end) {
      const n = readSync(fd, buf, 0, Math.min(CHUNK, end - pos), pos);
      if (n === 0) break;
      const chunk = buf.subarray(0, n);
      let from = 0;
      for (;;) {
        const nl = chunk.indexOf(10, from);
        if (nl === -1) {
          if (from < n) pending.push(Buffer.from(chunk.subarray(from)));
          break;
        }
        const part = chunk.subarray(from, nl);
        const line = pending.length === 0 ? part : Buffer.concat([...pending, part]);
        pending = [];
        fn(line, lineStart);
        lineStart += line.length + 1;
        from = nl + 1;
      }
      pos += n;
    }
    if (pending.length > 0) fn(Buffer.concat(pending), lineStart);
  } finally {
    closeSync(fd);
  }
}

interface Scan {
  /** Per range index, per model. */
  readonly byRange: Map<number, Map<string, Usage>>;
  readonly costState: Record<string, unknown> | null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * One pass over a transcript, from `start` to `end`.
 *
 * Usage is repeated on every content block of one API response, so it is
 * counted once per `message.id`, taking the largest figure seen per column
 * (the repeats were identical in every transcript checked, and a partial early
 * write would be smaller, never larger). Sidechain lines are skipped in a main
 * transcript: they belong to a subagent and are read from its own file.
 */
export function scanTranscript(
  path: string,
  start: number,
  end: number,
  rangeOf: (pos: number) => number,
  options: { skipSidechain: boolean },
): Scan {
  const seen = new Map<string, { range: number; model: string; usage: Usage }>();
  let costState: Record<string, unknown> | null = null;

  eachLine(path, start, end, (line, pos) => {
    const hasUsage = line.includes('"usage"');
    const hasCost = !hasUsage && line.includes('"cost-state"');
    if (!hasUsage && !hasCost) return;
    let o: Record<string, unknown>;
    try {
      o = JSON.parse(line.toString("utf8")) as Record<string, unknown>;
    } catch {
      return;
    }
    if (hasCost || o["type"] === "cost-state") {
      if (o["type"] === "cost-state") costState = o;
      return;
    }
    if (o["type"] !== "assistant") return;
    if (options.skipSidechain && o["isSidechain"] === true) return;
    const message = o["message"] as Record<string, unknown> | undefined;
    const usage = message?.["usage"] as Record<string, unknown> | undefined;
    const id = message?.["id"];
    const model = message?.["model"];
    if (usage === undefined || typeof id !== "string" || typeof model !== "string" || model === "<synthetic>") return;
    const fresh: Usage = {
      input: num(usage["input_tokens"]),
      cache_write: num(usage["cache_creation_input_tokens"]),
      cache_read: num(usage["cache_read_input_tokens"]),
      output: num(usage["output_tokens"]),
      messages: 1,
    };
    const prior = seen.get(id);
    if (prior === undefined) {
      seen.set(id, { range: rangeOf(pos), model, usage: fresh });
    } else {
      for (const c of COLUMNS) prior.usage[c] = Math.max(prior.usage[c], fresh[c]);
    }
  });

  const byRange = new Map<number, Map<string, Usage>>();
  for (const { range, model, usage } of seen.values()) {
    const models = byRange.get(range) ?? new Map<string, Usage>();
    byRange.set(range, models);
    const total = models.get(model) ?? blank();
    models.set(model, total);
    for (const c of COLUMNS) total[c] += usage[c];
    total.messages += 1;
  }
  return { byRange, costState };
}

/** The first `"timestamp"` of a transcript, from its first line, without reading the rest. */
export function firstTimestamp(path: string): number | null {
  let fd: number;
  try {
    fd = openSync(path, "r");
  } catch {
    return null;
  }
  try {
    const buf = Buffer.allocUnsafe(64 * 1024);
    let head = "";
    // A first line is a prompt and can be long; stop at its newline or at 1 MB.
    for (let read = 0; read < 1 << 20; ) {
      const n = readSync(fd, buf, 0, buf.length, read);
      if (n === 0) break;
      read += n;
      head += buf.toString("utf8", 0, n);
      const nl = head.indexOf("\n");
      if (nl !== -1) {
        head = head.slice(0, nl);
        break;
      }
    }
    const m = /"timestamp":"([^"]+)"/.exec(head);
    if (m?.[1] === undefined) return null;
    const when = Date.parse(m[1]);
    return Number.isNaN(when) ? null : when;
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Flush
// ---------------------------------------------------------------------------

function toNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function agentRole(subDir: string, id: string): string {
  try {
    const meta = JSON.parse(readFileSync(join(subDir, `agent-${id}.meta.json`), "utf8")) as { agentType?: unknown };
    if (typeof meta.agentType === "string" && roleOf(meta.agentType) !== "") return roleOf(meta.agentType);
  } catch {
    // no meta: the row still counts, under a generic role
  }
  return "subagent";
}

interface NewRow {
  run: string;
  target: string;
  role: string;
  agent_id: string;
  model: string;
  usage: Usage;
  messages: number | null;
  cost: number | null;
  source: "transcript" | "cost-state";
}

const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;

/**
 * Compute one session's totals and append only what is not on disk yet.
 *
 * Returns the number of rows written. Scanning happens outside the lock and
 * the read-existing-then-append happens inside it, so two processes flushing
 * the same session cannot both write the same delta.
 */
export function flushSession(store: Store, s: SessionMarks, marks: string): number {
  const last = s.marks.at(-1) as Mark;
  const tp = last.transcript_path;
  let size: number;
  try {
    size = statSync(tp).size;
  } catch {
    return 0;
  }
  const first = s.marks[0] as Mark;
  const list = s.marks.filter((m) => m.transcript_path === tp);
  const rangeOf = (pos: number): number => {
    let i = 0;
    while (i + 1 < list.length && (list[i + 1] as Mark).offset <= pos) i += 1;
    return i;
  };
  const main = scanTranscript(tp, Math.min(first.offset, size), size, rangeOf, { skipSidechain: true });

  const rows: NewRow[] = [];
  for (const [i, models] of main.byRange) {
    const mark = list[i] as Mark;
    for (const [model, usage] of models) {
      rows.push({
        run: mark.run,
        target: mark.slug ?? NONE,
        role: "main",
        agent_id: NONE,
        model,
        usage,
        messages: usage.messages,
        cost: null,
        source: "transcript",
      });
    }
  }

  const subDir = join(dirname(tp), basename(tp, ".jsonl"), "subagents");
  let files: string[] = [];
  try {
    files = readdirSync(subDir).filter((f) => f.startsWith("agent-") && f.endsWith(".jsonl"));
  } catch {
    // a session with no subagents has no directory
  }
  for (const file of files) {
    const id = file.slice("agent-".length, -".jsonl".length);
    const path = join(subDir, file);
    const startedAt = firstTimestamp(path);
    let idx = 0;
    if (startedAt !== null) {
      list.forEach((m, i) => {
        const at = Date.parse(m.ts);
        if (!Number.isNaN(at) && at <= startedAt) idx = i;
      });
    }
    const mark = list[idx] as Mark;
    let sub: Scan;
    try {
      sub = scanTranscript(path, 0, statSync(path).size, () => 0, { skipSidechain: false });
    } catch {
      continue;
    }
    const role = agentRole(subDir, id);
    for (const [model, usage] of sub.byRange.get(0) ?? []) {
      rows.push({
        run: mark.run,
        target: mark.slug ?? NONE,
        role,
        agent_id: id,
        model,
        usage,
        messages: usage.messages,
        cost: null,
        source: "transcript",
      });
    }
  }

  const prefix = `${s.session}@`;
  return withLock(store.costs, () => {
    const existing = readRecords(store.costs).filter((r) => (r["run"] ?? "").startsWith(prefix));
    const written: string[][] = [];
    const ts = new Date().toISOString();
    const emit = (r: NewRow): void => {
      written.push([
        ts,
        r.run,
        r.target,
        r.role,
        r.agent_id,
        r.model,
        String(r.usage.input),
        String(r.usage.cache_write),
        String(r.usage.cache_read),
        String(r.usage.output),
        r.messages === null ? NONE : String(r.messages),
        r.cost === null ? NONE : String(r.cost),
        r.source,
      ]);
    };

    const transcriptRows: NewRow[] = [];
    for (const r of rows) {
      const same = existing.filter(
        (e) =>
          e["source"] === "transcript" &&
          e["model"] === r.model &&
          e["agent_id"] === r.agent_id &&
          // A subagent is one key per session; a main thread is one per run.
          (r.agent_id === NONE ? e["run"] === r.run && e["role"] === "main" : true),
      );
      const delta: Usage = blank();
      for (const c of COLUMNS) delta[c] = Math.max(0, r.usage[c] - same.reduce((a, e) => a + toNumber(e[c]), 0));
      const messages = Math.max(0, (r.messages ?? 0) - same.reduce((a, e) => a + toNumber(e["messages"]), 0));
      if (COLUMNS.every((c) => delta[c] === 0) && messages === 0) continue;
      const out: NewRow = { ...r, usage: delta, messages };
      transcriptRows.push(out);
      emit(out);
    }

    // Reconcile against cost-state: whatever it counts that no transcript line
    // does (a compaction, a call the transcript never recorded) goes to one
    // `unattributed` row per model. `cost_usd` lives here and only here, and it
    // is the model's whole real cost for the session, so summing the column
    // gives what was actually spent.
    const state = main.costState;
    const usageByModel = state?.["modelUsage"];
    if (typeof usageByModel === "object" && usageByModel !== null) {
      const sessionRows = existing.concat(
        transcriptRows.map(
          (r): Record<string, string> => ({
            model: r.model,
            input: String(r.usage.input),
            cache_write: String(r.usage.cache_write),
            cache_read: String(r.usage.cache_read),
            output: String(r.usage.output),
            cost_usd: NONE,
          }),
        ),
      );
      for (const [model, raw] of Object.entries(usageByModel as Record<string, Record<string, unknown>>)) {
        const mine = sessionRows.filter((e) => e["model"] === model);
        const total: Record<(typeof COLUMNS)[number], number> = {
          input: num(raw["inputTokens"]),
          cache_write: num(raw["cacheCreationInputTokens"]),
          cache_read: num(raw["cacheReadInputTokens"]),
          output: num(raw["outputTokens"]),
        };
        const delta = blank();
        for (const c of COLUMNS) delta[c] = Math.max(0, total[c] - mine.reduce((a, e) => a + toNumber(e[c]), 0));
        const realCost = typeof raw["costUSD"] === "number" && raw["costUSD"] >= 0 ? raw["costUSD"] : null;
        const costDelta =
          realCost === null ? null : Math.max(0, round6(realCost - mine.reduce((a, e) => a + toNumber(e["cost_usd"]), 0)));
        if (COLUMNS.every((c) => delta[c] === 0) && (costDelta === null || costDelta === 0)) continue;
        emit({
          run: last.run,
          target: last.slug ?? NONE,
          role: "unattributed",
          agent_id: NONE,
          model,
          usage: delta,
          messages: null,
          cost: costDelta,
          source: "cost-state",
        });
      }
    }

    for (const values of written) append(store.costs, HEADER, values);
    return written.length;
  }, { timeoutMs: 2_000 }) + settle(marks, s, size);
}

/** Record that the session was flushed at this size, so an unchanged file is not re-read. */
function settle(file: string, s: SessionMarks, size: number): number {
  const entry: Ended = { session: s.session, ended: true, size, ts: new Date().toISOString() };
  appendLine(file, entry);
  return 0;
}

// ---------------------------------------------------------------------------
// Reading the ledger of costs
// ---------------------------------------------------------------------------

export type By = "role" | "item" | "model";

export interface CostRow {
  readonly key: string;
  readonly input: number;
  readonly cache_write: number;
  readonly cache_read: number;
  readonly output: number;
  readonly messages: number;
  /** null when no row in the group carries a real figure. */
  readonly cost_usd: number | null;
}

export function summarize(store: Store, by: By, slug?: string): CostRow[] {
  const groups = new Map<string, { u: Usage; cost: number | null }>();
  for (const r of readRecords(store.costs)) {
    if (slug !== undefined && r["target"] !== slug) continue;
    const key = by === "role" ? r["role"] : by === "item" ? r["target"] : r["model"];
    const k = key ?? NONE;
    const g = groups.get(k) ?? { u: blank(), cost: null };
    groups.set(k, g);
    for (const c of COLUMNS) g.u[c] += toNumber(r[c]);
    g.u.messages += toNumber(r["messages"]);
    if (r["cost_usd"] !== undefined && r["cost_usd"] !== NONE && r["cost_usd"] !== "") {
      g.cost = round6((g.cost ?? 0) + toNumber(r["cost_usd"]));
    }
  }
  return [...groups.entries()]
    .map(([key, g]) => ({ key, ...g.u, cost_usd: g.cost }))
    .sort((a, b) => b.input + b.cache_write + b.cache_read + b.output - (a.input + a.cache_write + a.cache_read + a.output));
}

/** The highest review round on disk for an item: `review_<slug>.md` is round 1, `_r2` the next. */
export function reviewRounds(store: Store, slug: string): number {
  let top = 0;
  for (const file of reportFiles(store.progress, "review", slug)) {
    top = Math.max(top, roundOf(file, "review", slug).round);
  }
  return top;
}

/** Ledger rows where a verifier said no. Each one is a round that did not close the item. */
export function verifierFailed(store: Store, slug: string): number {
  return readRecords(store.ledger).filter((r) => r["target"] === slug && r["verdict"] === "verifier-failed").length;
}

export function total(rows: readonly CostRow[]): Omit<CostRow, "key"> {
  let cost: number | null = null;
  const t = { input: 0, cache_write: 0, cache_read: 0, output: 0, messages: 0 };
  for (const r of rows) {
    for (const c of COLUMNS) t[c] += r[c];
    t.messages += r.messages;
    if (r.cost_usd !== null) cost = round6((cost ?? 0) + r.cost_usd);
  }
  return { ...t, cost_usd: cost };
}

/**
 * A fixed-width table. `extra` adds the per-item columns the ledger and the
 * review reports contribute, which only make sense when the rows are items.
 */
export function render(
  by: By,
  rows: readonly CostRow[],
  sum: Omit<CostRow, "key">,
  extra?: (key: string) => { review_rounds?: number; verifier_failed?: number },
): string {
  if (rows.length === 0) return "no cost rows recorded yet";
  const head = [by, "input", "cache_write", "cache_read", "output", "messages", "usd"];
  if (extra !== undefined) head.push("rounds", "failed");
  const fmt = (n: number): string => n.toLocaleString("en-US");
  const usd = (n: number | null): string => (n === null ? NONE : n.toFixed(4));
  const body = rows.map((r) => {
    const line = [r.key, fmt(r.input), fmt(r.cache_write), fmt(r.cache_read), fmt(r.output), fmt(r.messages), usd(r.cost_usd)];
    if (extra !== undefined) {
      const e = extra(r.key);
      line.push(e.review_rounds === undefined ? NONE : String(e.review_rounds), e.verifier_failed === undefined ? NONE : String(e.verifier_failed));
    }
    return line;
  });
  const foot = ["total", fmt(sum.input), fmt(sum.cache_write), fmt(sum.cache_read), fmt(sum.output), fmt(sum.messages), usd(sum.cost_usd)];
  if (extra !== undefined) foot.push("", "");
  const all = [head, ...body, foot];
  const widths = head.map((_, i) => Math.max(...all.map((r) => (r[i] ?? "").length)));
  const line = (r: string[]): string =>
    r.map((c, i) => (i === 0 ? c.padEnd(widths[i] as number) : c.padStart(widths[i] as number))).join("  ").trimEnd();
  return [line(head), ...body.map(line), line(foot)].join("\n");
}
