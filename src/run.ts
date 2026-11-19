import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  /**
   * Kill the command and its whole process group after this long. No limit when absent.
   * A grandchild that detaches into a session of its own (setsid, or `spawn` with
   * `detached: true`) is out of reach of any group kill and outlives this.
   */
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
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
const HELPER = join(dirname(fileURLToPath(import.meta.url)), "run-helper.mjs");

export function runCommand(cmd: string, options: RunOptions): RunResult {
  // The type already says so; this is for callers that are not typed.
  if (options.output === "inherit" && options.timeoutMs !== undefined) {
    throw new TypeError(
      "runCommand: output 'inherit' cannot have a timeout; use 'capture' to bound a command, since an inherited terminal stops a background group",
    );
  }
  const limit = options.timeoutMs;
  // Node and bun both turn an out-of-range timer into a 1 ms one and print a
  // warning, which would read as a command that timed out at once.
  if (limit !== undefined && !(Number.isInteger(limit) && limit >= 1 && limit <= MAX_TIMEOUT_MS)) {
    throw new TypeError(`runCommand: timeoutMs must be an integer from 1 to ${MAX_TIMEOUT_MS}, got ${String(limit)}`);
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
            // Not the target directory: bun loads that directory's bunfig.toml and
            // .env into whatever it starts there, and the command's cwd is passed
            // to the helper as an argument instead.
            cwd: dir,
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

export interface AsyncOptions {
  readonly cwd: string;
  /** Required: the command and its whole group are killed after this long. */
  readonly timeoutMs: number;
  /** How many trailing lines `tail` keeps. Defaults to 40. */
  readonly tailLines?: number;
}

export interface Running {
  /** Settles when the helper has exited, with what `runCommand` would have returned. */
  readonly result: Promise<RunResult>;
  /** SIGTERM to the helper, which kills the command's group and exits; nothing once the result is in. */
  stop(): void;
}

/**
 * `runCommand` with capture and a timeout, without blocking: the caller's
 * event loop runs while the command does, so its signal handlers run too
 * (`spawnSync` runs none while it blocks).
 *
 * The helper is spawned detached, in a process group of its own, with a fifth
 * argument, `watch-parent`: it polls this process and kills the command's
 * group when this process is gone. Detached, a SIGKILL of the caller's whole
 * group does not reach the helper, so its watch still runs; a terminal Ctrl-C
 * reaches the caller and not the helper, and the caller's handler is what
 * calls `stop()` (a caller with no handler dies, which the watch sees).
 */
export function runCommandAsync(cmd: string, options: AsyncOptions): Running {
  const limit = options.timeoutMs;
  if (!(Number.isInteger(limit) && limit >= 1 && limit <= MAX_TIMEOUT_MS)) {
    throw new TypeError(`runCommandAsync: timeoutMs must be an integer from 1 to ${MAX_TIMEOUT_MS}, got ${String(limit)}`);
  }
  const dir = mkdtempSync(join(tmpdir(), "mstack-run-"));
  const out = join(dir, "out");
  const fd = openSync(out, "w");
  let child: ChildProcess;
  try {
    // Not the target directory, as in runCommand: bun loads its bunfig.toml and .env.
    child = spawn(process.execPath, [HELPER, join(dir, "result.json"), String(limit), options.cwd, cmd, "watch-parent"], {
      cwd: dir,
      stdio: ["ignore", fd, fd],
      detached: true,
    });
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  } finally {
    // The helper has its own copy of the descriptor.
    closeSync(fd);
  }
  let done = false;
  const settled = new Promise<RunResult>((resolve) => {
    let spawnError: Error | undefined;
    const finish = (signal: string | null): void => {
      if (done) return;
      done = true;
      try {
        const tail = existsSync(out) ? lastLines(readFileSync(out, "utf8"), options.tailLines ?? DEFAULT_TAIL_LINES) : "";
        try {
          const h = JSON.parse(readFileSync(join(dir, "result.json"), "utf8")) as RunResult;
          resolve(result(h.code, h.signal, h.error === undefined ? undefined : new Error(h.error), h.timedOut, tail));
        } catch {
          // The helper never reported: it could not start, it was stopped, or it died.
          resolve(result(null, signal, spawnError ?? new Error("the timeout helper did not report a result"), false, tail));
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    };
    child.on("error", (error) => {
      spawnError = error;
      if (child.pid === undefined) finish(null);
    });
    child.on("close", (_code, signal) => finish(signal));
  });
  return {
    result: settled,
    stop() {
      if (done || child.pid === undefined) return;
      try {
        process.kill(child.pid, "SIGTERM");
      } catch {
        // It has exited; its close event settles the result.
      }
    },
  };
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
