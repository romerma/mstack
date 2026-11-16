import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { HOOK_LOG } from "./paths.ts";

/**
 * The record a failed hook leaves.
 *
 * Hooks fail open, on purpose: they nudge and never block, and a hook that
 * throws would surface as a hook error the user sees. What that decision never
 * said is that nothing should be written down. Before this module a handler that
 * threw, a cost row lost to a held lock and an event the CLI does not know all
 * ended in the same place, an exit 0 with no trace anywhere, and `mstack gate`
 * had nothing to read.
 *
 * One line per failure in `.mstack/hook-errors.log`: timestamp, event, message,
 * tab-separated. The log is machine-local (it is listed in the store's
 * `.gitignore`) and bounded (`MAX_LINES`, oldest dropped). Everything in here is
 * best effort in the strict sense: it never throws, never prints, and never
 * creates `.mstack/`, because the plugin is loaded in every repository and most
 * of them have no store.
 */

/**
 * Every event the CLI's `hook` command handles. The one list: the CLI's
 * dispatch table (`HANDLERS` in `src/cli.ts`) is keyed by it, so adding a handler without naming it here is
 * a type error, and `lint-plugin` checks `hooks/hooks.json` arguments against it.
 */
export const HOOK_COMMANDS = ["session-start", "post-edit", "subagent-stop", "stop", "session-end", "pre-tool-use"] as const;

export type HookCommand = (typeof HOOK_COMMANDS)[number];

export function isHookCommand(event: string | undefined): event is HookCommand {
  return event !== undefined && (HOOK_COMMANDS as readonly string[]).includes(event);
}

/** Lines kept. A hook that fails on every turn must not grow a file without bound. */
export const MAX_LINES = 200;
const MAX_EVENT = 80;
const MAX_MESSAGE = 400;

const CONTROL = new RegExp("[\\u0000-\\u001f\\u007f\\u2028\\u2029]+", "g");

/** One line, no tabs, no control characters, bounded: the message is text from an error or from outside. */
export function oneLine(text: string, max: number): string {
  const flat = text.replace(CONTROL, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}...`;
}

/**
 * Append one line to the log in `storeDir`, or do nothing.
 *
 * "Nothing" covers a store that does not exist (no `.mstack/` is ever created
 * here), a log that is a directory, a read-only store and a full disk.
 */
export function appendHookError(storeDir: string | null, event: string, message: string): void {
  if (storeDir === null) return;
  try {
    // A directory, not merely a path that exists: `.mstack` as a file is no store.
    if (!statSync(storeDir).isDirectory()) return;
    const log = join(storeDir, HOOK_LOG);
    const fresh = !existsSync(log);
    const line = `${new Date().toISOString()}\t${oneLine(event, MAX_EVENT)}\t${oneLine(message, MAX_MESSAGE)}\n`;
    // One O_APPEND write of well under a page: two hooks failing together do not interleave.
    appendFileSync(log, line, "utf8");
    // Only after the line is on disk: a store that cannot take the log has nothing to keep out of git.
    if (fresh) keepOutOfGit(storeDir);
    trim(log);
  } catch {
    // The record of a failure is not allowed to become a failure.
  }
}

/** Drop the oldest lines past `MAX_LINES`. The file is at most `MAX_LINES` short lines, so reading it back costs microseconds. A line appended during the rewrite can be lost; at the cap that is acceptable. */
function trim(log: string): void {
  const all = readFileSync(log, "utf8").split("\n").filter((l) => l !== "");
  if (all.length <= MAX_LINES) return;
  const tmp = `${log}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, `${all.slice(-MAX_LINES).join("\n")}\n`, "utf8");
    renameSync(tmp, log);
  } finally {
    rmSync(tmp, { force: true });
  }
}

/**
 * A store written before the log existed has a `.gitignore` that does not list
 * it, and the first failure would then show up in `git status`. Editing that
 * file from a hook is worse: it is tracked, so the tree goes dirty and the
 * gate's own clean-tree check turns red because of a hook. The repository's
 * `.git/info/exclude` is local, untracked and read by git, so the log is
 * excluded there until `mstack setup` rewrites the store's `.gitignore`.
 */
function keepOutOfGit(storeDir: string): void {
  try {
    const ignore = join(storeDir, ".gitignore");
    if (existsSync(ignore) && readFileSync(ignore, "utf8").split("\n").some((l) => l.trim() === HOOK_LOG)) return;
    const common = gitCommonDir(dirname(storeDir));
    if (common === null) return;
    const exclude = join(common, "info", "exclude");
    const entry = `**/.mstack/${HOOK_LOG}`;
    const have = existsSync(exclude) ? readFileSync(exclude, "utf8") : "";
    if (have.split("\n").some((l) => l.trim() === entry)) return;
    mkdirSync(dirname(exclude), { recursive: true });
    appendFileSync(exclude, `${have === "" || have.endsWith("\n") ? "" : "\n"}# mstack: machine-local hook error log\n${entry}\n`, "utf8");
  } catch {
    // no git, or not writable: nothing to keep the log out of
  }
}

function gitCommonDir(start: string): string | null {
  let dir = resolve(start);
  for (;;) {
    const dotGit = join(dir, ".git");
    try {
      const st = statSync(dotGit);
      if (st.isDirectory()) return dotGit;
      if (st.isFile()) {
        const m = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, "utf8"));
        if (m?.[1] === undefined) return null;
        const gitdir = isAbsolute(m[1].trim()) ? m[1].trim() : resolve(dir, m[1].trim());
        // A linked worktree's own git dir names the shared one, and `info/exclude` is read from the shared one.
        const common = join(gitdir, "commondir");
        return existsSync(common) ? resolve(gitdir, readFileSync(common, "utf8").trim()) : gitdir;
      }
    } catch {
      // not here
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ---------------------------------------------------------------------------
// The hook in flight
// ---------------------------------------------------------------------------

let current: { storeDir: string | null; event: string } | null = null;

/** `mstack hook` calls this once, before the handler. Outside a hook nothing below records anything. */
export function beginHook(storeDir: string | null, event: string): void {
  current = { storeDir, event };
}

export function endHook(): void {
  current = null;
}

/** Record a failure for the hook in flight. No hook in flight, no store, no line. */
export function recordFailure(message: string): void {
  if (current !== null) appendHookError(current.storeDir, current.event, message);
}

/** Record `what` and the error's own text. */
export function noteFailure(what: string, error: unknown): void {
  recordFailure(`${what}: ${error instanceof Error ? error.message : String(error)}`);
}

/**
 * For a `catch` that tolerates a file that may not exist.
 *
 * ENOENT and ENOTDIR are the expected absence and stay silent. Anything else
 * (permission denied, a directory where a file should be, an I/O error) is the
 * same lost read as the absence from the caller's point of view, but it is a
 * fault, and it is recorded.
 */
export function tolerateAbsence(what: string, error: unknown): void {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code === "ENOENT" || code === "ENOTDIR") return;
  noteFailure(what, error);
}

// ---------------------------------------------------------------------------
// Reading it back
// ---------------------------------------------------------------------------

export interface HookErrors {
  readonly count: number;
  readonly newest: { readonly event: string; readonly message: string } | null;
}

/** Lines of the log stamped after `sinceMs`. An unreadable log is an empty one. */
export function errorsSince(log: string, sinceMs: number): HookErrors {
  let text: string;
  try {
    text = readFileSync(log, "utf8");
  } catch {
    return { count: 0, newest: null };
  }
  let count = 0;
  let newest: HookErrors["newest"] = null;
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const [ts = "", event = "", ...rest] = line.split("\t");
    const at = Date.parse(ts);
    if (Number.isNaN(at) || at <= sinceMs) continue;
    count += 1;
    newest = { event, message: rest.join("\t") };
  }
  return { count, newest };
}
