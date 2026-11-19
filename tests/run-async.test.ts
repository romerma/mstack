import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runCommand, runCommandAsync } from "../src/run.ts";

/**
 * Item 42, task 2.4: the runner the mutation run starts its obligations with.
 * It does not block the caller's event loop, so the caller's signal handlers
 * run while the command does; the helper watches the caller and takes the
 * command's group down when the caller dies, by itself or with its group.
 */

const RUN = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "run.ts");
const RUNTIME_FLAGS = typeof (globalThis as { Bun?: unknown }).Bun === "undefined"
  ? ["--experimental-strip-types", "--disable-warning=ExperimentalWarning"]
  : [];
const SPAWN_TEST = { timeout: 60_000 };
const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

async function until(condition: () => boolean, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (condition()) return true;
    await sleep(10);
  }
  return condition();
}

/** Processes whose command line holds `marker`, this one excepted. */
function survivors(marker: string): number[] {
  const r = spawnSync("pgrep", ["-f", marker], { encoding: "utf8" });
  return r.stdout.split("\n").filter((l) => l !== "").map(Number).filter((p) => p !== process.pid);
}

function killAll(marker: string): void {
  for (const pid of survivors(marker)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Gone.
    }
  }
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** A sleep whose command line no other test's holds. */
let serial = 0;
const marker = (): string => `sleep 34.${process.pid % 1000}${serial++}`;

async function inDir(body: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "mstack-run-async-"));
  try {
    await body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * A caller in a process of its own, leading its own group, that starts `cmd`
 * with runCommandAsync; with `handler`, its SIGINT handler writes `handled`
 * and calls stop(), and the settled result is written to `result`.
 */
function caller(dir: string, cmd: string, handler: boolean): ChildProcess {
  const script = join(dir, "caller.mts");
  writeFileSync(
    script,
    `import { writeFileSync } from "node:fs";
import { runCommandAsync } from ${JSON.stringify(RUN)};
const running = runCommandAsync(${JSON.stringify(cmd)}, { cwd: ${JSON.stringify(dir)}, timeoutMs: 60000 });
${handler ? `process.on("SIGINT", () => { writeFileSync(${JSON.stringify(join(dir, "handled"))}, "yes"); running.stop(); });` : ""}
running.result.then((r) => writeFileSync(${JSON.stringify(join(dir, "result"))}, JSON.stringify(r)));
`,
  );
  return spawn(process.execPath, [...RUNTIME_FLAGS, script], { detached: true, stdio: "ignore" });
}

function killGroup(child: ChildProcess): void {
  try {
    process.kill(-(child.pid as number), "SIGKILL");
  } catch {
    // Gone.
  }
}

/** The command `<sleep marker> & echo $! > pid; wait`, and the sleep's pid once it is written. */
async function started(dir: string, mark: string): Promise<{ cmd: string; pid: () => Promise<number> }> {
  const pidFile = join(dir, "pid");
  return {
    cmd: `${mark} & echo $! > ${pidFile}; wait`,
    pid: async () => {
      assert.ok(await until(() => existsSync(pidFile) && readFileSync(pidFile, "utf8").trim() !== "", 20_000), "the command never started");
      return Number(readFileSync(pidFile, "utf8").trim());
    },
  };
}

test("R12 async: exit code, signal and tail match runCommand", async () => {
  await inDir(async (dir) => {
    for (const cmd of ["exit 7", "kill -TERM $$", "printf 'one\\ntwo\\nthree\\n'; exit 1", "exec 2>/dev/null; sh -c 'kill -TERM $$'; exit $?", "echo out; echo err >&2; exit 0"]) {
      const sync = runCommand(cmd, { cwd: dir, output: "capture", timeoutMs: 10_000, tailLines: 2 });
      const async = await runCommandAsync(cmd, { cwd: dir, timeoutMs: 10_000, tailLines: 2 }).result;
      assert.deepEqual(async, sync, cmd);
    }
  });
});

test("R12 async: a timeout reports timedOut, code null and SIGKILL, and the group is gone", async () => {
  const mark = marker();
  try {
    await inDir(async (dir) => {
      const r = await runCommandAsync(`${mark} & echo $!; ${mark}`, { cwd: dir, timeoutMs: 300 }).result;
      assert.deepEqual([r.timedOut, r.code, r.signal], [true, null, "SIGKILL"]);
      const pid = Number(r.tail.split("\n")[0]);
      assert.ok(pid > 1, `no grandchild pid in ${JSON.stringify(r.tail)}`);
      assert.ok(await until(() => !alive(pid), 2_000), "the grandchild survived the timeout");
    });
  } finally {
    killAll(mark);
  }
});

test("R12 async: a command that cannot start gives code null and an error", async () => {
  const r = await runCommandAsync("true", { cwd: "/nonexistent-dir-for-mstack", timeoutMs: 1_000 }).result;
  assert.equal(r.code, null);
  assert.equal(r.timedOut, false);
  assert.equal(typeof r.error, "string");
});

test("R12 async: timeoutMs must be an integer from 1 to 2^31-1", async () => {
  await inDir(async (dir) => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -5, 0, 1.5, 2 ** 31, undefined]) {
      assert.throws(() => runCommandAsync("true", { cwd: dir, timeoutMs: bad as number }), TypeError, String(bad));
    }
    const r = await runCommandAsync("true", { cwd: dir, timeoutMs: 2 ** 31 - 1 }).result;
    assert.deepEqual([r.code, r.timedOut], [0, false]);
  });
});

test("R12 async: does not load the target directory's bunfig.toml or .env", async () => {
  await inDir(async (dir) => {
    writeFileSync(join(dir, "pre.mjs"), 'console.log("PRELOAD RAN");\n');
    writeFileSync(join(dir, "bunfig.toml"), 'preload = ["./pre.mjs"]\n');
    writeFileSync(join(dir, ".env"), "MSTACK_PROBE_ENV=from-dotenv\n");
    const r = await runCommandAsync('echo "env=${MSTACK_PROBE_ENV:-unset}"', { cwd: dir, timeoutMs: 5_000 }).result;
    assert.equal(r.tail, "env=unset");
  });
});

test("R16 async: stop() kills the whole group and the promise settles within 3 s", SPAWN_TEST, async () => {
  const mark = marker();
  try {
    await inDir(async (dir) => {
      const command = await started(dir, mark);
      const running = runCommandAsync(command.cmd, { cwd: dir, timeoutMs: 60_000 });
      const pid = await command.pid();
      const t0 = Date.now();
      running.stop();
      const settled = await Promise.race([running.result.then(() => true), sleep(3_000).then(() => false)]);
      assert.ok(settled, "the promise did not settle within 3 s of stop()");
      assert.ok(Date.now() - t0 < 3_000);
      assert.ok(await until(() => !alive(pid), 1_000), "the command's group survived stop()");
    });
  } finally {
    killAll(mark);
  }
});

test("R16 async: a SIGINT to the caller's group takes the command down", SPAWN_TEST, async () => {
  const mark = marker();
  await inDir(async (dir) => {
    const command = await started(dir, mark);
    const victim = caller(dir, command.cmd, false);
    try {
      const pid = await command.pid();
      process.kill(-(victim.pid as number), "SIGINT");
      assert.ok(await until(() => !alive(pid), 2_000), "the command outlived the Ctrl-C");
    } finally {
      killGroup(victim);
      killAll(mark);
    }
  });
});

test("R16 async: the caller's signal handler runs while the command runs", SPAWN_TEST, async () => {
  const mark = marker();
  await inDir(async (dir) => {
    const command = await started(dir, mark);
    const victim = caller(dir, command.cmd, true);
    const exited = new Promise<number | null>((res) => victim.on("close", (code) => res(code)));
    try {
      const pid = await command.pid();
      assert.ok(alive(pid));
      process.kill(-(victim.pid as number), "SIGINT");
      assert.ok(await until(() => existsSync(join(dir, "handled")), 5_000), "the caller's handler did not run while the command ran");
      assert.ok(await until(() => existsSync(join(dir, "result")), 5_000), "the result did not settle after the handler's stop()");
      assert.ok(await until(() => !alive(pid), 1_000), "the command survived the handler's stop()");
      assert.equal(await exited, 0, "the caller did not end on its own once the command was gone");
    } finally {
      killGroup(victim);
      killAll(mark);
    }
  });
});

test("R16 async: when the caller is SIGKILLed the command's group is gone within 2 s", SPAWN_TEST, async () => {
  const mark = marker();
  await inDir(async (dir) => {
    const command = await started(dir, mark);
    const victim = caller(dir, command.cmd, false);
    try {
      const pid = await command.pid();
      process.kill(victim.pid as number, "SIGKILL");
      assert.ok(await until(() => !alive(pid) && survivors(mark).length === 0, 2_000), `left after 2 s: ${JSON.stringify(survivors(mark))}`);
    } finally {
      killGroup(victim);
      killAll(mark);
    }
  });
});

test("R16 async: when the caller's whole group is SIGKILLed the command's group is gone within 2 s", SPAWN_TEST, async () => {
  const mark = marker();
  await inDir(async (dir) => {
    const command = await started(dir, mark);
    const victim = caller(dir, command.cmd, false);
    try {
      const pid = await command.pid();
      process.kill(-(victim.pid as number), "SIGKILL");
      assert.ok(await until(() => !alive(pid) && survivors(mark).length === 0, 2_000), `left after 2 s: ${JSON.stringify(survivors(mark))}`);
    } finally {
      killGroup(victim);
      killAll(mark);
    }
  });
});

test("R16 async: a caller SIGKILLed in the first milliseconds after the spawn leaves no command 3 s later", SPAWN_TEST, async () => {
  // Round 2 review, non-blocking 1: dead before the helper ran, the caller read as alive and the command ran to its timeout.
  for (const delay of [0, 3, 10]) {
    const mark = marker();
    await inDir(async (dir) => {
      const script = join(dir, "early.mts");
      const kill = 'process.kill(process.pid, "SIGKILL")';
      writeFileSync(
        script,
        `import { runCommandAsync } from ${JSON.stringify(RUN)};
runCommandAsync(${JSON.stringify(mark)}, { cwd: ${JSON.stringify(dir)}, timeoutMs: 60000 });
${delay === 0 ? `${kill};` : `setTimeout(() => ${kill}, ${delay});`}
`,
      );
      const victim = spawn(process.execPath, [...RUNTIME_FLAGS, script], { detached: true, stdio: "ignore" });
      const exited = new Promise<number | string | null>((res) => victim.on("close", (code, signal) => res(code ?? signal)));
      try {
        assert.equal(await exited, "SIGKILL");
        await sleep(3_000);
        assert.deepEqual(survivors(mark), [], `the caller was SIGKILLed ${delay} ms after the spawn, and the helper and its command are alive 3 s later`);
      } finally {
        killGroup(victim);
        killAll(mark);
      }
    });
  }
});

test("R12 async: a capture file that is gone or cannot be read still settles the result, which says so", SPAWN_TEST, async () => {
  // Round 2 review, non-blocking 8: the close handler read the capture file with no catch.
  for (const how of ["removed", "replaced by a directory"]) {
    await inDir(async (dir) => {
      const tmp = join(dir, "tmp");
      mkdirSync(tmp);
      const release = join(dir, "release");
      const saved = process.env["TMPDIR"];
      process.env["TMPDIR"] = tmp;
      let running: ReturnType<typeof runCommandAsync>;
      try {
        running = runCommandAsync(`while [ ! -e '${release}' ]; do sleep 0.05; done; echo printed; exit 3`, { cwd: dir, timeoutMs: 20_000 });
      } finally {
        if (saved === undefined) delete process.env["TMPDIR"];
        else process.env["TMPDIR"] = saved;
      }
      const made = readdirSync(tmp);
      assert.equal(made.length, 1, `the runner's temp directory is not under the TMPDIR set: ${JSON.stringify(made)}`);
      const capture = join(tmp, made[0] as string, "out");
      rmSync(capture);
      if (how === "replaced by a directory") mkdirSync(capture);
      writeFileSync(release, "");
      const r = await Promise.race([running.result, sleep(15_000).then(() => null)]);
      assert.ok(r !== null, `${how}: the result did not settle`);
      assert.equal(r.code, 3, how);
      assert.match(r.tail, /the output could not be read/, how);
    });
  }
});
