import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closingProblems } from "../src/closing.ts";
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
    assert.match(problems[0]!.message, /`pytest -q` has never been executed/);

    const gate = cli(sb.store.root, ["gate"]);
    assert.equal(gate.code, 1, gate.stdout);
    assert.ok(gate.stdout.includes(`one step from done, and ${problems[0]!.message}`), gate.stdout);

    const refused = cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]);
    assert.equal(refused.code, 2, refused.stdout);
    assert.ok(refused.stderr.includes(problems[0]!.message), refused.stderr);

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
    assert.equal(problems[0]!.overridable, false);
    assert.equal(problems[0]!.check, "verification");
    assert.match(problems[0]!.message, /EISDIR|illegal operation on a directory/i);

    const forced = cli(sb.store.root, [
      "state", "set", "storage-layer", "--status", "done", "--force", "--closed-by", "why",
    ]);
    assert.equal(forced.code, 2, forced.stdout);
    assert.match(forced.stderr, /verification runs could not be read/);
  } finally {
    sb.dispose();
  }
});

/**
 * The reviewer's probe. With one member in `CLOSING_CHECKS` "the gate and state
 * set cannot disagree" is trivially true, because both reach the same function
 * through the verification check. It is only a claim once a second member exists,
 * and item 41 adds one. This registers a fake second check in a child process
 * (the CLI is a program, not a library) and asks both surfaces about an item that
 * has no verification command at all, where the old gate went quiet.
 */
function cliWithSecondCheck(cwd: string, args: string[], overridable: boolean, reportedAt = ["verifying"]) {
  const dir = mkdtempSync(join(tmpdir(), "mstack-closing-"));
  const boot = join(dir, "boot.mts");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
  writeFileSync(
    boot,
    `import { CLOSING_CHECKS } from ${JSON.stringify(join(root, "closing.ts"))};
CLOSING_CHECKS.push({
  name: "second",
  reportedAt: ${JSON.stringify(reportedAt)},
  run: () => [{ check: "second", message: "a second closing check is not satisfied", hint: "satisfy the second check", overridable: ${overridable} }],
});
await import(${JSON.stringify(join(root, "cli.ts"))});
`,
  );
  try {
    const flags = typeof (globalThis as { Bun?: unknown }).Bun === "undefined"
      ? ["--experimental-strip-types", "--disable-warning=ExperimentalWarning"]
      : [];
    const r = spawnSync(process.execPath, [...flags, boot, ...args], { cwd, encoding: "utf8" });
    return { code: r.status, stdout: r.stdout, stderr: r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a second closing check is seen by the gate and refused by state set, with no verification command", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying" })], { verify: "" }));
    trackCurrent(sb);
    quiesce(sb);

    // Control: with only the verification check, nothing blocks and the gate passes.
    assert.equal(cli(sb.store.root, ["gate"]).code, 0);

    const gate = cliWithSecondCheck(sb.store.root, ["gate"], true);
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /storage-layer.*one step from done, and a second closing check is not satisfied/);
    assert.match(gate.stdout, /satisfy the second check/);

    const refused = cliWithSecondCheck(sb.store.root, ["state", "set", "storage-layer", "--status", "done"], true);
    assert.equal(refused.code, 2, refused.stdout);
    assert.match(refused.stderr, /storage-layer cannot close: a second closing check is not satisfied/);
    assert.doesNotMatch(refused.stderr, /verification that has not run/);
    assert.equal(parseState(sb.store.state).items[0]?.status, "verifying");

    const noReason = cliWithSecondCheck(
      sb.store.root, ["state", "set", "storage-layer", "--status", "done", "--force"], true,
    );
    assert.equal(noReason.code, 2);
    assert.match(noReason.stderr, /--closed-by/);

    const forced = cliWithSecondCheck(
      sb.store.root, ["state", "set", "storage-layer", "--status", "done", "--force", "--closed-by", "because"], true,
    );
    assert.equal(forced.code, 0, forced.stderr);
    assert.match(parseState(sb.store.state).items[0]?.closed_by ?? "", /^closed unverified \(forced\): /);
  } finally {
    sb.dispose();
  }
});

test("a check that is not overridable stays closed under --force", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying" })], { verify: "" }));
    trackCurrent(sb);
    const forced = cliWithSecondCheck(
      sb.store.root, ["state", "set", "storage-layer", "--status", "done", "--force", "--closed-by", "because"], false,
    );
    assert.equal(forced.code, 2, forced.stdout);
    assert.match(forced.stderr, /cannot close: a second closing check is not satisfied/);
    assert.equal(parseState(sb.store.state).items[0]?.status, "verifying");
  } finally {
    sb.dispose();
  }
});

test("at verifying the gate reports every check, whatever its reportedAt says", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying" })], { verify: "" }));
    trackCurrent(sb);
    quiesce(sb);
    const gate = cliWithSecondCheck(sb.store.root, ["gate"], true, ["reviewing"]);
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /one step from done, and a second closing check is not satisfied/);
    const refused = cliWithSecondCheck(sb.store.root, ["state", "set", "storage-layer", "--status", "done"], true, ["reviewing"]);
    assert.equal(refused.code, 2, refused.stdout);
    assert.match(refused.stderr, /cannot close: a second closing check is not satisfied/);
  } finally {
    sb.dispose();
  }
});
