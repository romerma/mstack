import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { execFileSync, spawn, spawnSync } from "node:child_process";

import { runCommand, type RunOptions } from "../src/run.ts";

const cwd = process.cwd();

test("a background grandchild holding stdout does not keep the call blocked", () => {
  const started = Date.now();
  // The grandchild inherits stdout and outlives the shell. On a pipe, spawnSync
  // waits for it; on a file there is nothing to wait for.
  const result = runCommand("echo hi; (sleep 8 &) ; exit 0", { cwd, output: "capture", timeoutMs: 15_000 });
  const took = Date.now() - started;
  assert.equal(result.code, 0);
  assert.equal(result.timedOut, false);
  assert.match(result.tail, /hi/);
  assert.ok(took < 4_000, `returned after ${took}ms; a grandchild held it`);
});

test("a timeout reports timedOut within a bound, with code null and SIGKILL", () => {
  const started = Date.now();
  const result = runCommand("sleep 30", { cwd, output: "capture", timeoutMs: 300 });
  const took = Date.now() - started;
  assert.equal(result.timedOut, true);
  assert.ok(took < 5_000, `timeout took ${took}ms`);
  assert.equal(result.code, null);
  assert.equal(result.signal, "SIGKILL");
});

test("the whole group dies, not just the child", async () => {
  const result = runCommand("sleep 31.5 & echo $! ; sleep 31.5", { cwd, output: "capture", timeoutMs: 300 });
  assert.equal(result.timedOut, true);
  const pid = Number(result.tail.split("\n")[0]);
  assert.ok(pid > 1, `no grandchild pid in ${JSON.stringify(result.tail)}`);
  await new Promise((r) => setTimeout(r, 200));
  assert.throws(() => process.kill(pid, 0), /ESRCH/, "the grandchild survived the timeout");
});

test("exit code and signal are reported", () => {
  const exit = runCommand("exit 7", { cwd, output: "capture" });
  assert.equal(exit.code, 7);
  assert.equal(exit.signal, null);
  assert.equal(exit.timedOut, false);
  const killed = runCommand("kill -TERM $$", { cwd, output: "capture" });
  assert.equal(killed.code, null);
  assert.equal(killed.signal, "SIGTERM");
});

test("tail keeps the last lines of stdout and stderr, and the temp file is removed", () => {
  const before = readdirSync(tmpdir()).filter((n) => n.startsWith("mstack-run-"));
  const result = runCommand("for i in 1 2 3 4 5; do echo out$i; done; echo err >&2", {
    cwd,
    output: "capture",
    tailLines: 3,
  });
  assert.equal(result.tail, "out4\nout5\nerr");
  const after = readdirSync(tmpdir()).filter((n) => n.startsWith("mstack-run-"));
  assert.deepEqual(after, before, "a temp directory was left behind");
  assert.equal(existsSync(cwd), true);
});

test("inherit returns no tail and still reports the exit code", () => {
  const result = runCommand("exit 3", { cwd, output: "inherit" });
  assert.equal(result.code, 3);
  assert.equal(result.tail, "");
});

const pgidOf = (pid: number) => Number(execFileSync("ps", ["-o", "pgid=", "-p", String(pid)], { encoding: "utf8" }).trim());

/**
 * The shell that ran the command is not what makes the group. Job control (`set -m`)
 * is a no-op under dash without a tty, which is what /bin/sh is on ubuntu CI, so a
 * design built on it passed here and killed nothing there. This runs the whole
 * command under /bin/dash explicitly and asserts a group really exists and dies.
 */
test("under dash, the command leads its own process group and the whole group dies on timeout", async () => {
  const result = runCommand(`exec /bin/dash -c 'sleep 31.2 & echo $!; sleep 31.2'`, {
    cwd,
    output: "capture",
    timeoutMs: 1_500,
  });
  assert.equal(result.timedOut, true);
  const pid = Number(result.tail.split("\n")[0]);
  assert.ok(pid > 1, `no grandchild pid in ${JSON.stringify(result.tail)}`);
  await new Promise((r) => setTimeout(r, 200));
  assert.throws(() => process.kill(pid, "SIGKILL"), /ESRCH/, "the grandchild survived the timeout");
});

test("a timed command runs in a process group that is not ours", () => {
  const result = runCommand("echo $$; ps -o pgid= -p $$; sleep 0.2", { cwd, output: "capture", timeoutMs: 5_000 });
  const [pid, pgid] = result.tail.split("\n").map((l) => Number(l.trim()));
  assert.equal(pgid, pid, "the command should lead its own group");
  assert.notEqual(pgid, pgidOf(process.pid));
});

test("the tail of a timed run is only the command's output", () => {
  const ok = runCommand("printf 'line1\\nline2\\n'; exit 1", { cwd, output: "capture", timeoutMs: 5_000, tailLines: 1 });
  assert.equal(ok.tail, "line2");
  assert.equal(ok.code, 1);
  const signalled = runCommand("echo before; kill -TERM $$", { cwd, output: "capture", timeoutMs: 5_000 });
  assert.equal(signalled.tail, "before");
  const killed = runCommand("echo started; sleep 30", { cwd, output: "capture", timeoutMs: 300 });
  assert.equal(killed.tail, "started");
});

test("inherit with a timeout is refused", () => {
  const untyped = { cwd, output: "inherit", timeoutMs: 100 } as unknown as RunOptions;
  assert.throws(() => runCommand("true", untyped), TypeError);
});

test("a signal that ends the shell itself is reported; one that ends a child of it is 128+n", () => {
  const direct = runCommand("kill -TERM $$", { cwd, output: "capture", timeoutMs: 5_000 });
  assert.deepEqual([direct.code, direct.signal], [null, "SIGTERM"]);
  const viaChild = runCommand("sh -c 'kill -TERM $$'; exit $?", { cwd, output: "capture" });
  assert.deepEqual([viaChild.code, viaChild.signal], [143, null]);
});

test("a command that cannot start gives code null and an error, on both paths", () => {
  for (const timeoutMs of [undefined, 1_000]) {
    const r = runCommand("true", { cwd: "/nonexistent-dir-for-mstack", output: "capture", ...(timeoutMs === undefined ? {} : { timeoutMs }) });
    assert.equal(r.code, null);
    assert.equal(r.timedOut, false);
    assert.equal(typeof r.error, "string");
  }
});

test("timeoutMs must be an integer from 1 to 2^31-1; anything else throws", () => {
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -5, 0, 1.5, 2 ** 31]) {
    assert.throws(() => runCommand("true", { cwd, output: "capture", timeoutMs: bad }), TypeError, String(bad));
  }
  for (const good of [2 ** 31 - 1]) {
    const r = runCommand("true", { cwd, output: "capture", timeoutMs: good });
    assert.equal(r.timedOut, false, String(good));
    assert.equal(r.code, 0, String(good));
  }
});

function survivors(marker: string): number[] {
  const r = spawnSync("pgrep", ["-f", marker], { encoding: "utf8" });
  return r.stdout.split("\n").filter((l) => l !== "").map(Number).filter((p) => p !== process.pid);
}

/**
 * One kill of the group misses a child that is mid-fork at that instant; it is
 * born into the group after the signal went out. Measured before the fix with
 * 400 forks and a 40 ms timeout: 4/10 runs (bun) and 7/10 runs (node) left a
 * survivor. Five runs here, because each costs the timeout plus a settle.
 */
test("a timeout kills children that are being forked at that moment", async () => {
  const marker = `sleep 7.8${process.pid % 1000}`;
  let left: number[] = [];
  try {
    for (let run = 0; run < 5; run++) {
      const r = runCommand(`i=0; while [ $i -lt 400 ]; do ${marker} & i=$((i+1)); done; wait`, {
        cwd,
        output: "capture",
        timeoutMs: 40,
      });
      assert.equal(r.timedOut, true);
    }
    await new Promise((res) => setTimeout(res, 300));
    left = survivors(marker);
    assert.deepEqual(left, [], "children survived the timeout");
  } finally {
    for (const pid of survivors(marker)) {
      try { process.kill(pid, "SIGKILL"); } catch { /* gone */ }
    }
  }
});

/**
 * bun loads `bunfig.toml` and `.env` from its cwd. The helper is started
 * elsewhere, so the timed path sees what the untimed one sees.
 */
test("the timed path does not load the target directory's bunfig.toml or .env", () => {
  const target = mkdtempSync(join(tmpdir(), "mstack-target-"));
  try {
    writeFileSync(join(target, "pre.mjs"), 'console.log("PRELOAD RAN");\n');
    writeFileSync(join(target, "bunfig.toml"), 'preload = ["./pre.mjs"]\n');
    writeFileSync(join(target, ".env"), "MSTACK_PROBE_ENV=from-dotenv\n");
    const cmd = 'echo "env=${MSTACK_PROBE_ENV:-unset}"';
    const untimed = runCommand(cmd, { cwd: target, output: "capture" });
    const timed = runCommand(cmd, { cwd: target, output: "capture", timeoutMs: 5_000 });
    assert.equal(untimed.tail, "env=unset");
    assert.equal(timed.tail, "env=unset");
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

/**
 * Ctrl-C reaches the terminal's foreground group: the caller and the helper, not
 * the detached command. The victim stands for the caller, in a group of its own
 * so this test runner is not signalled; `kill(-victim)` is what the terminal does.
 */
test("a SIGINT to the caller's group takes the timed command down with it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mstack-sigint-"));
  try {
    const script = join(dir, "victim.mts");
    const pidFile = join(dir, "pid");
    writeFileSync(
      script,
      `import { runCommand } from ${JSON.stringify(join(cwd, "src", "run.ts"))};
runCommand(${JSON.stringify(`sleep 31.9 & echo $! > ${pidFile}; wait`)}, { cwd: ${JSON.stringify(dir)}, output: "capture", timeoutMs: 60000 });
`,
    );
    const flags = typeof (globalThis as { Bun?: unknown }).Bun === "undefined"
      ? ["--experimental-strip-types", "--disable-warning=ExperimentalWarning"]
      : [];
    const victim = spawn(process.execPath, [...flags, script], { detached: true, stdio: "ignore" });
    let pid = 0;
    for (let i = 0; i < 50 && pid === 0; i++) {
      await new Promise((res) => setTimeout(res, 100));
      if (existsSync(pidFile)) pid = Number(readFileSync(pidFile, "utf8").trim()) || 0;
    }
    assert.ok(pid > 1, "the command never started");
    process.kill(-victim.pid!, "SIGINT");
    await new Promise((res) => setTimeout(res, 800));
    let alive = true;
    try { process.kill(pid, 0); } catch { alive = false; }
    if (alive) process.kill(pid, "SIGKILL");
    assert.equal(alive, false, "the command outlived the Ctrl-C");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
