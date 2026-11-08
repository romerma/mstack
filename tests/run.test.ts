import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";

import { execFileSync } from "node:child_process";

import { UserError } from "../src/paths.ts";
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
  assert.throws(() => runCommand("true", untyped), UserError);
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
