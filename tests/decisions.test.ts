import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { all } from "../src/decisions.ts";
import { parseState } from "../src/state.ts";
import { sandbox, state, item } from "./helpers.ts";

const MSTACK = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

function mstack(cwd: string, args: readonly string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(MSTACK, [...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

const FORK = "Stable public contract, or a dump we can reshape?";

test("--resolves writes the row and the pointer together", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "specifying", decision_required: FORK })]));

    const result = mstack(sb.store.root, [
      "decide",
      "--phase",
      "design",
      "--resolves",
      "storage-layer",
      "--decision",
      "versioned envelope",
      "--why",
      "a consumer must be able to detect a breaking change",
      "--evidence",
      "acceptance bullet 2",
      "--result",
      "version field required",
    ]);
    assert.equal(result.status, 0, result.stderr);

    // Neither half can exist alone: a pointer with no row is a claim with no
    // evidence, and a row nothing points at does not unblock the item.
    const rows = all(sb.store);
    assert.equal(rows.length, 1);
    const resolved = parseState(sb.store.state).items[0]!.decision_resolved;
    assert.equal(resolved, rows[0]!.ts, "the pointer must name the row that was just written");
  } finally {
    sb.dispose();
  }
});

test("--resolves on an item with no fork is refused, not silently accepted", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    const result = mstack(sb.store.root, [
      "decide",
      "--resolves",
      "storage-layer",
      "--decision",
      "something",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /carries no decision_required/);
    assert.equal(all(sb.store).length, 0, "a refused resolve must not leave a row behind");
  } finally {
    sb.dispose();
  }
});

test("--resolves naming an item that does not exist writes nothing", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress", decision_required: FORK })]));
    const result = mstack(sb.store.root, ["decide", "--resolves", "nope", "--decision", "x"]);
    assert.notEqual(result.status, 0);
    assert.equal(all(sb.store).length, 0);
  } finally {
    sb.dispose();
  }
});

test("a decision without --resolves is still recorded, and unblocks nothing", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress", decision_required: FORK })]));
    assert.equal(mstack(sb.store.root, ["decide", "--decision", "unrelated"]).status, 0);

    assert.equal(all(sb.store).length, 1, "every decision is worth a row");
    assert.equal(
      parseState(sb.store.state).items[0]!.decision_resolved,
      undefined,
      "only --resolves answers a fork; a bare row must not close one by accident",
    );
  } finally {
    sb.dispose();
  }
});

test("state set refuses to move an item past its open fork", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "specifying", decision_required: FORK })]));

    const refused = mstack(sb.store.root, ["state", "set", "storage-layer", "--status", "spec_ready"]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /unanswered decision/);
    assert.match(refused.stderr, /mstack decide --resolves storage-layer/, "the error must name the fix");
    assert.equal(parseState(sb.store.state).items[0]!.status, "specifying", "a refused move must not happen");

    mstack(sb.store.root, ["decide", "--resolves", "storage-layer", "--decision", "versioned envelope"]);
    const allowed = mstack(sb.store.root, ["state", "set", "storage-layer", "--status", "spec_ready"]);
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.equal(parseState(sb.store.state).items[0]!.status, "spec_ready");
  } finally {
    sb.dispose();
  }
});

test("--force still moves it, because the gate is the authority and this is the speed bump", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "specifying", decision_required: FORK })]));
    const forced = mstack(sb.store.root, [
      "state",
      "set",
      "storage-layer",
      "--status",
      "in_progress",
      "--force",
    ]);
    assert.equal(forced.status, 0, forced.stderr);
    // ...and the gate then says so, which is the point of having both.
    const gate = mstack(sb.store.root, ["gate"]);
    assert.notEqual(gate.status, 0);
    assert.match(gate.stdout + gate.stderr, /decision unanswered/);
  } finally {
    sb.dispose();
  }
});
