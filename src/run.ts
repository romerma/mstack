import { spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { UserError } from "./paths.ts";

/**
 * Run a shell command to completion.
 *
 * `capture` writes stdout and stderr to a temp file, never to a pipe. npm and bun
 * leave grandchildren holding the pipe they inherited, and `spawnSync` does not
 * return until every holder of the pipe has closed it, so a pipe made a finished
 * command look hung. A file has no such reader to wait for.
 */

interface BaseOptions {
  readonly cwd: string;
}

/** `capture` keeps the last lines in `tail`. Only this mode can have a timeout. */
export interface CaptureOptions extends BaseOptions {
  readonly output: "capture";
  /** Kill the command and its whole process group after this long. No limit when absent. */
  readonly timeoutMs?: number;
  /** How many trailing lines `tail` keeps. Defaults to 40. */
  readonly tailLines?: number;
}

/**
 * Streams to the terminal. No timeout: a command that reads the terminal, or
 * writes with `tostop`, would stop in a background group and be reported as timed
 * out after the full wait.
 */
export interface InheritOptions extends BaseOptions {
  readonly output: "inherit";
  readonly timeoutMs?: never;
}

export type RunOptions = CaptureOptions | InheritOptions;

export interface RunResult {
  /**
   * The exit code, or null when the command was killed or never started.
   *
   * Best effort for signals: a shell that ends because a child died of signal n
   * exits 128+n, so `code` is 143 and `signal` is null, indistinguishable from
   * `exit 143`. Only a timeout is reliable: `timedOut` is true, `code` is null and
   * `signal` is "SIGKILL".
   */
  readonly code: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
  /** The last lines of combined stdout and stderr. Empty under `inherit`. */
  readonly tail: string;
  /** Set when the command could not be started (for example, a missing cwd). */
  readonly error?: string;
}

const DEFAULT_TAIL_LINES = 40;
const HELPER = join(dirname(fileURLToPath(import.meta.url)), "run-helper.mjs");

export function runCommand(cmd: string, options: RunOptions): RunResult {
  // The type already says so; this is for callers that are not typed.
  if (options.output === "inherit" && options.timeoutMs !== undefined) {
    throw new UserError(
      "runCommand: output 'inherit' cannot have a timeout",
      "use output 'capture' to bound a command; an inherited terminal stops a background group",
    );
  }
  if (options.output === "inherit") {
    const r = spawnSync("/bin/sh", ["-c", cmd], { cwd: options.cwd, stdio: "inherit" });
    return result(r.status, r.signal, r.error, false, "");
  }

  const dir = mkdtempSync(join(tmpdir(), "mstack-run-"));
  const out = join(dir, "out");
  const fd = openSync(out, "w");
  try {
    const timeout = options.timeoutMs;
    const r =
      timeout === undefined
        ? spawnSync("/bin/sh", ["-c", cmd], { cwd: options.cwd, stdio: ["ignore", fd, fd] })
        : spawnSync(process.execPath, [HELPER, join(dir, "result.json"), String(timeout), options.cwd, cmd], {
            cwd: options.cwd,
            stdio: ["ignore", fd, fd],
          });
    const tail = lastLines(readFileSync(out, "utf8"), options.tailLines ?? DEFAULT_TAIL_LINES);
    if (timeout === undefined) return result(r.status, r.signal, r.error, false, tail);
    try {
      const h = JSON.parse(readFileSync(join(dir, "result.json"), "utf8")) as RunResult;
      return result(h.code, h.signal, h.error === undefined ? undefined : new Error(h.error), h.timedOut, tail);
    } catch {
      // The helper never reported: it could not start, or it died.
      return result(null, r.signal, r.error ?? new Error("the timeout helper did not report a result"), false, tail);
    }
  } finally {
    closeSync(fd);
    rmSync(dir, { recursive: true, force: true });
  }
}

/** bun reports `undefined` where node reports `null`; the contract is `null`. */
function result(
  code: number | null | undefined,
  signal: string | null | undefined,
  error: Error | undefined,
  timedOut: boolean,
  tail: string,
): RunResult {
  return {
    code: code ?? null,
    signal: signal ?? null,
    timedOut,
    tail,
    ...(error === undefined ? {} : { error: error.message }),
  };
}

function lastLines(text: string, n: number): string {
  const lines = text.replace(/\n$/, "").split("\n");
  return lines.slice(-n).join("\n");
}
