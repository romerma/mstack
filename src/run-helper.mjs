// Launched by `runCommand` (src/run.ts) when a timeout is set. Plain JS, `node:`
// only, so it runs unchanged under node and bun.
//
// Why a helper at all: `spawnSync` cannot kill a process *group* when its timer
// fires, and neither shell job control (`set -m`, a no-op under dash without a
// tty) nor `spawnSync({detached})` (ignored by bun) makes one portably. Async
// `spawn({detached: true})` does, on both runtimes: the child leads its own group,
// so its pid is the pgid with nothing to read back.
//
// argv: <result file> <timeout ms> <cwd> <command>. The command's stdout and
// stderr are this process's own, which the caller pointed at the capture file.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const [resultFile, timeoutMs, cwd, cmd] = process.argv.slice(2);
let timedOut = false;
const child = spawn("/bin/sh", ["-c", cmd], { cwd, detached: true, stdio: ["ignore", "inherit", "inherit"] });

const finish = (result) => {
  writeFileSync(resultFile, JSON.stringify(result));
  process.exit(0);
};

const timer = setTimeout(() => {
  timedOut = true;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    // The group is already gone.
  }
}, Number(timeoutMs));

child.on("error", (error) => {
  clearTimeout(timer);
  finish({ code: null, signal: null, timedOut: false, error: error.message });
});
child.on("exit", (code, signal) => {
  clearTimeout(timer);
  finish({ code, signal, timedOut });
});
