import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";

import { runCommand } from "../src/run.ts";

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

test("a timeout reports timedOut within a bound and kills the process group", () => {
  const started = Date.now();
  const result = runCommand("sleep 30", { cwd, output: "capture", timeoutMs: 300 });
  const took = Date.now() - started;
  assert.equal(result.timedOut, true);
  assert.ok(took < 5_000, `timeout took ${took}ms`);
  assert.equal(result.code, null);
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
