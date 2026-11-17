import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sandbox } from "./helpers.ts";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

function cli(cwd: string, args: string[]) {
  const r = spawnSync(BIN, args, { cwd, encoding: "utf8" });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

test("ledger check answers at an abbreviated sha, and ledger record stores the full one", () => {
  const sb = sandbox();
  try {
    const short = sb.sha.slice(0, 8);
    const recorded = cli(sb.store.root, ["ledger", "record", "x", short, "test-verified", "--evidence", "node --test tests", "--verifier", "reviewer"]);
    assert.equal(recorded.code, 0, recorded.stderr);
    const full = cli(sb.store.root, ["ledger", "check", "x", sb.sha]);
    assert.equal(full.code, 0, full.stdout);
    const abbreviated = cli(sb.store.root, ["ledger", "check", "x", short]);
    assert.equal(abbreviated.code, 0, abbreviated.stdout + abbreviated.stderr);
    assert.match(abbreviated.stdout, /^PASS test-verified at /);
  } finally {
    sb.dispose();
  }
});

test("ledger record refuses an empty target at exit 2 and says what to pass", () => {
  const sb = sandbox();
  try {
    const r = cli(sb.store.root, ["ledger", "record", "", sb.sha, "test-verified", "--evidence", "node --test tests", "--verifier", "reviewer"]);
    assert.equal(r.code, 2, r.stdout);
    assert.match(r.stderr, /needs a target/);
    assert.equal(cli(sb.store.root, ["ledger", "summary"]).stdout.trim(), "ledger is empty");
  } finally {
    sb.dispose();
  }
});
