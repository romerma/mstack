import { randomUUID } from "node:crypto";
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";

import { UserError } from "./paths.ts";

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
 * Named points inside `withLock` where a test may stop a process, to make an
 * interleaving that is otherwise a window of microseconds happen on purpose.
 *  - `lock-created`: the lock exists and is still empty; the owner is not written.
 *  - `guard-created`: the same for the `.break` guard.
 *  - `judged-stale`: a waiter has judged the lock stale and has not taken the guard.
 *  - `waiting`: a pass found the lock held and is about to sleep. It is the
 *    positive signal that "nothing happened", for a test that must wait for that.
 */
export type LockStep = "lock-created" | "guard-created" | "judged-stale" | "waiting";

export interface LockOptions {
  readonly timeoutMs?: number;
  /** A test seam, like `prune`'s `beforeLock` in costs.ts. Called at each named step, with no effect when absent. */
  readonly step?: (name: LockStep) => void;
}

/**
 * Serialise a read-then-append across processes.
 *
 * Checking a file for a value and then appending to it is two operations, and
 * fan-out means several `mstack` processes do it at once: twelve concurrent
 * `decide` calls produced eight distinct millisecond timestamps, because each
 * one read the file before any of them had written.
 *
 * The lock is a file that names its owner (`<pid> <token>`). It is created with
 * an exclusive create (`O_EXCL`), which is atomic and fails with EEXIST only when
 * the lock exists, and the owner is written straight after. For that instant a
 * reader meets a lock with no owner in it; that is the same as a lock from the
 * previous format, and it is waited on while young (below). Any other failure to
 * create the lock (a missing or read-only directory, a full disk) is not "held":
 * it is thrown, naming the lock and the system error, rather than waited out.
 * Exclusive create is used instead of write-then-`link` because `link` fails
 * with ENOTSUP on filesystems without hard links (exFAT), where nothing could
 * ever take the lock, and because it leaves no temp file behind a killed waiter.
 *
 * A waiter never enters without holding the lock:
 *  - owner dead: the lock is broken at once and taken again with the same
 *    atomic create; breaking is never the same as holding.
 *  - owner alive past the timeout: it THROWS (a `UserError` naming the lock, the
 *    holder and the wait). The earlier "break it and proceed" let a waiter run
 *    beside a live holder and then delete the holder's lock, which is losing
 *    serialisation silently. Critical sections here are a read and an append, so
 *    a live holder past the timeout is a fault; failing is visible and
 *    retryable, and hooks (which fail open) lose one row instead of corrupting.
 *  - owner unreadable (empty file from the previous format, foreign content):
 *    treated as a holder of unknown liveness, waited on like a live one, and
 *    broken only once the file is older than `UNKNOWN_OWNER_STALE_MS`.
 *  - release removes the lock only while it still carries this caller's token.
 *
 * Known limits: a dead owner's pid reused by an unrelated live process reads as
 * alive, so waiters fail at the timeout until it exits (fail-closed, and rare
 * for critical sections that last milliseconds). Two waiters breaking the same
 * dead lock are serialised by a `.break` guard, whose own staleness is decided
 * the same way; a process killed inside the guard in the microseconds between
 * its re-read and its remove, together with a second breaker, is the residual
 * window.
 */
export function withLock<T>(file: string, run: () => T, options: LockOptions = {}): T {
  const lock = `${file}.lock`;
  const timeout = options.timeoutMs ?? 2_000;
  const step = options.step;
  const token = randomUUID();
  const started = Date.now();

  for (;;) {
    if (tryCreate(lock, token, "lock-created", step)) break;
    // Every pass reaches the deadline check or the sleep, or has just removed a
    // dead lock and so made progress: no path through here can spin unbounded.
    const removed = tryBreakStale(lock, token, step);
    const waited = Date.now() - started;
    if (removed && waited <= timeout) continue;
    if (waited > timeout) {
      const holder = readOwner(lock);
      throw new UserError(
        `${lock} is held ${holder === null ? "by a process that cannot be identified" : `by pid ${holder.pid}`} and did not let go in ${waited} ms`,
        holder === null
          ? `if no mstack command is running, remove ${lock}`
          : `wait for pid ${holder.pid} to finish, or stop it; if it is not an mstack process, remove ${lock}`,
      );
    }
    step?.("waiting");
    sleep(2);
  }

  try {
    return run();
  } finally {
    release(lock, token);
  }
}

// A lock with no readable owner is the previous format (an empty file) or foreign
// content. Two seconds is the old default wait, so a legacy lock is broken after
// the same time it always was; no critical section here lasts that long.
const UNKNOWN_OWNER_STALE_MS = 2_000;
const pause = new Int32Array(new SharedArrayBuffer(4));

function sleep(ms: number): void {
  // Synchronous on purpose: every caller is, and these critical sections are a
  // file read and one append.
  Atomics.wait(pause, 0, 0, ms);
}

interface Owner {
  readonly pid: number;
  readonly token: string;
}

function readOwner(path: string): Owner | null {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const match = /^(\d+) ([0-9a-f-]{36})\n$/.exec(text);
  return match === null ? null : { pid: Number(match[1]), token: match[2] as string };
}

/**
 * Create `path` exclusively and write the owner into it. False only when it
 * already exists; any other failure throws, because "could not create" and "held
 * by someone" need opposite handling.
 */
function tryCreate(path: string, token: string, created: LockStep, step: LockOptions["step"]): boolean {
  let fd: number;
  try {
    fd = openSync(path, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw cannotCreate(path, error);
  }
  try {
    step?.(created);
    writeSync(fd, `${process.pid} ${token}\n`);
  } catch (error) {
    rmSync(path, { force: true });
    throw cannotCreate(path, error);
  } finally {
    closeSync(fd);
  }
  return true;
}

function cannotCreate(path: string, error: unknown): UserError {
  return new UserError(
    `cannot create the lock ${path}: ${(error as Error).message}`,
    `check that ${dirname(path)} exists and is writable, and that its disk is not full`,
  );
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists and belongs to someone else.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function isStale(path: string, owner: Owner | null): boolean {
  if (owner !== null) return !alive(owner.pid);
  try {
    return Date.now() - statSync(path).mtimeMs > UNKNOWN_OWNER_STALE_MS;
  } catch {
    return false;
  }
}

/**
 * Remove a lock whose owner is gone. Returns true only when the caller removed
 * it, and so should try to take the lock again at once; false when the lock is
 * held by someone who may still be inside, is already gone, or another waiter is
 * breaking it.
 */
function tryBreakStale(lock: string, token: string, step: LockOptions["step"]): boolean {
  if (!isStale(lock, readOwner(lock))) return false;
  step?.("judged-stale");

  // One breaker at a time: otherwise two waiters that saw the same dead owner
  // can each remove the lock and each create their own, the second removing
  // the first's live one.
  const guard = `${lock}.break`;
  if (!tryCreate(guard, token, "guard-created", step)) {
    const holder = readOwner(guard);
    if (isStale(guard, holder)) rmIfOwner(guard, holder?.token ?? null);
    return false;
  }
  try {
    // Judge again under the guard: the lock may have been replaced by a live one
    // since the first look, and that one must not be removed.
    if (!isStale(lock, readOwner(lock))) return false;
    rmSync(lock, { force: true });
    return true;
  } finally {
    rmIfOwner(guard, token);
  }
}

function rmIfOwner(path: string, token: string | null): void {
  try {
    const owner = readOwner(path);
    if (token === null ? owner === null : owner?.token === token) rmSync(path, { force: true });
  } catch {
    // Nothing useful to do; a leftover is handled as a stale lock.
  }
}

function release(lock: string, token: string): void {
  rmIfOwner(lock, token);
}
