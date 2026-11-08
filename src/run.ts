import { spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Run a shell command to completion. A leaf module: it imports only `node:`.
 *
 * `capture` writes stdout and stderr to a temp file, never to a pipe. npm and bun
 * leave grandchildren holding the pipe they inherited, and `spawnSync` does not
 * return until every holder of the pipe has closed it, so a pipe made a finished
 * command look hung. A file has no such reader to wait for.
 */

export interface RunOptions {
  readonly cwd: string;
  /** Kill the command (and its whole process group) after this long. No limit when absent. */
  readonly timeoutMs?: number;
  /** `capture` keeps the last lines in `tail`; `inherit` streams to the terminal. */
  readonly output: "capture" | "inherit";
  /** How many trailing lines `tail` keeps. Defaults to 40. */
  readonly tailLines?: number;
}

export interface RunResult {
  /** Exit code, or null when the command was killed by a signal or never started. */
  readonly code: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
  /** The last lines of combined stdout and stderr. Empty under `inherit`. */
  readonly tail: string;
}

const DEFAULT_TAIL_LINES = 40;

/**
 * Runs the command as a job of its own under job control, so it leads a process
 * group, and writes that group's id where the caller can read it. `detached` is
 * the obvious tool and bun's `spawnSync` ignores it, so this is plain `sh`.
 * Cost: a command killed by a signal reports 128+n as its exit code, since the
 * wrapper's `wait` is what exits.
 */
const GROUP_WRAPPER = 'set -m; /bin/sh -c "$1" & echo $! > "$2"; wait $!';

export function runCommand(cmd: string, options: RunOptions): RunResult {
  const needsDir = options.output === "capture" || options.timeoutMs !== undefined;
  const dir = needsDir ? mkdtempSync(join(tmpdir(), "mstack-run-")) : undefined;
  const file = dir !== undefined && options.output === "capture" ? join(dir, "out") : undefined;
  const pidFile = dir === undefined ? undefined : join(dir, "pgid");
  const fd = file === undefined ? undefined : openSync(file, "w");
  try {
    const argv = options.timeoutMs === undefined || pidFile === undefined
      ? ["-c", cmd]
      : ["-c", GROUP_WRAPPER, "sh", cmd, pidFile];
    const result = spawnSync("/bin/sh", argv, {
      cwd: options.cwd,
      stdio: fd === undefined ? "inherit" : ["ignore", fd, fd],
      ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs, killSignal: "SIGKILL" }),
    });
    const timedOut = (result.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
    // spawnSync's own timeout kills the wrapper only; the command's group keeps running.
    if (timedOut && pidFile !== undefined) killGroup(pidFile);
    if (fd !== undefined) closeSync(fd);
    const tail = file === undefined ? "" : lastLines(readFileSync(file, "utf8"), options.tailLines ?? DEFAULT_TAIL_LINES);
    return { code: result.status, signal: result.signal, timedOut, tail };
  } finally {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
}

function killGroup(pidFile: string): void {
  try {
    const pgid = Number(readFileSync(pidFile, "utf8").trim());
    if (Number.isInteger(pgid) && pgid > 1) process.kill(-pgid, "SIGKILL");
  } catch {
    // No pid was written, or the group is already gone.
  }
}

function lastLines(text: string, n: number): string {
  const lines = text.replace(/\n$/, "").split("\n");
  return lines.slice(-n).join("\n");
}
