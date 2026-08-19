import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MSTACK = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

function run(args: readonly string[], input: string) {
  return spawnSync(MSTACK, [...args], {
    input,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

/**
 * The status line's central promise is that it can never break a session, and
 * that promise is about the process, not about a function's return value. These
 * run the real launcher.
 */
test("a reader that goes away mid-write does not take the process with it", async () => {
  // `process.stdout.write` is asynchronous on a pipe, so the EPIPE arrives as
  // an unhandled error event after the surrounding try/catch has returned. It
  // used to exit 1 with a stack trace on stderr, five times out of five.
  //
  // This is the documented normal case, not an edge one: Claude Code cancels
  // the in-flight status line when a new update triggers, which is exactly a
  // reader going away. Destroying the child's stdout from here reproduces it
  // deterministically; redirecting to /dev/null would not, because a discarded
  // write is a successful one.
  const payload = JSON.stringify({ workspace: { current_dir: process.cwd() } });

  for (const args of [["statusline"], ["statusline", "--subagent"]]) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const child = spawn(MSTACK, [...args], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, NO_COLOR: "1" },
      });
      child.stdout.destroy();
      let stderr = "";
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.stdin.end(payload);

      const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
      assert.equal(code, 0, `${args.join(" ")} exited ${code}: ${stderr}`);
      assert.equal(stderr, "", `${args.join(" ")} wrote to stderr: ${stderr}`);
    }
  }
});

test("hostile stdin never produces a non-zero exit or a word on stderr", () => {
  const NUL = String.fromCharCode(0);
  const inputs = ["", "not json", "null", "[]", "3", `{"model":`, `${NUL}${NUL}binary`, "x".repeat(200_000)];
  for (const input of inputs) {
    const result = run(["statusline"], input);
    const label = JSON.stringify(input.slice(0, 20));
    assert.equal(result.status, 0, `input ${label} exited ${result.status}: ${result.stderr}`);
    assert.equal(result.stderr, "", `input ${label} wrote ${result.stderr}`);
  }
});

test("a cwd that does not exist is a quiet line, not a crash", () => {
  const result = run(["statusline"], JSON.stringify({ workspace: { current_dir: "/no/such/dir/anywhere" } }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
});
