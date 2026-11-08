import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closingProblems, isUnreadable } from "../src/closing.ts";
import { parseState } from "../src/state.ts";
import { item, quiesce, recordReceipt, sandbox, state, trackCurrent } from "./helpers.ts";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

function cli(cwd: string, args: string[]) {
  const r = spawnSync(BIN, args, { cwd, encoding: "utf8" });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

test("closingProblems, the gate and state set agree that an unrun verification blocks closing", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    const sha = quiesce(sb);
    const st = parseState(sb.store.state);
    const it = st.items[0]!;

    const problems = closingProblems(sb.store, st, it);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!, /`pytest -q` has never been executed/);

    const gate = cli(sb.store.root, ["gate"]);
    assert.equal(gate.code, 1, gate.stdout);
    assert.ok(gate.stdout.includes(`one step from done, and ${problems[0]}`), gate.stdout);

    const refused = cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]);
    assert.equal(refused.code, 2, refused.stdout);
    assert.ok(refused.stderr.includes(problems[0]!), refused.stderr);

    recordReceipt(sb, { target: "storage-layer", sha, command: "pytest -q", outcome: "passed" });
    assert.deepEqual(closingProblems(sb.store, st, it), []);
    assert.equal(cli(sb.store.root, ["gate"]).code, 0);
    assert.equal(cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]).code, 0);
  } finally {
    sb.dispose();
  }
});

test("an unreadable receipt file is a problem, not a throw, and is the one --force does not override", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    mkdirSync(sb.store.verification);
    const st = parseState(sb.store.state);
    const problems = closingProblems(sb.store, st, st.items[0]!);
    assert.equal(problems.length, 1);
    assert.ok(isUnreadable(problems[0]!));
    assert.match(problems[0]!, /EISDIR|illegal operation on a directory/i);

    const forced = cli(sb.store.root, [
      "state", "set", "storage-layer", "--status", "done", "--force", "--closed-by", "why",
    ]);
    assert.equal(forced.code, 2, forced.stdout);
    assert.match(forced.stderr, /verification runs could not be read/);
  } finally {
    sb.dispose();
  }
});
