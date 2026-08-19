import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { item, sandbox, state } from "./helpers.ts";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

function run(cwd: string, args: readonly string[]): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync(BIN, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { stdout, stderr: "", code: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", code: e.status ?? 1 };
  }
}

test("`state active` prints the slug alone, so command substitution works", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    const result = run(sb.store.root, ["state", "active"]);
    assert.equal(result.stdout.trim(), "storage-layer");
    assert.equal(result.code, 0);
  } finally {
    sb.dispose();
  }
});

test("with nothing active, stdout stays empty and the note goes to stderr", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "pending" })]));
    const result = run(sb.store.root, ["state", "active"]);
    // Every agent file tells agents to run this. `SLUG=$(mstack state active)`
    // must yield an empty string here, not the words "no active item".
    assert.equal(result.stdout.trim(), "");
    assert.match(result.stderr, /no active item/);
    assert.equal(result.code, 1);
  } finally {
    sb.dispose();
  }
});

test("an unknown command exits 2 and says what to run instead", () => {
  const sb = sandbox();
  try {
    const result = run(sb.store.root, ["nonsense"]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /unknown command/);
    assert.match(result.stderr, /mstack help/);
  } finally {
    sb.dispose();
  }
});

test("outside an mstack repository the error names the fix", () => {
  const result = run("/tmp", ["gate"]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /mstack setup/);
});
