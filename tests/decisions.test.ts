import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { all } from "../src/decisions.ts";
import { ensureHeader } from "../src/tsv.ts";
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

    mstack(sb.store.root, [
      "decide",
      "--resolves",
      "storage-layer",
      "--decision",
      "versioned envelope",
      "--result",
      "version field required",
    ]);
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

test("the row says which fork it answers, so no other row can close it", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress", decision_required: FORK })]));

    // With the link only on the item, the pointer named a timestamp and nothing
    // more: a row about tabs versus spaces closed a fork about a public API
    // contract, because no column said what a row was about.
    mstack(sb.store.root, ["decide", "--decision", "use tabs", "--result", "tabs"]);
    const unrelated = all(sb.store)[0]!;
    assert.equal(unrelated.resolves, "", "a decision recorded without --resolves resolves nothing");

    const raw = JSON.parse(readFileSync(sb.store.state, "utf8")) as { items: Record<string, unknown>[] };
    raw.items[0]!["decision_resolved"] = unrelated.ts;
    writeFileSync(sb.store.state, JSON.stringify(raw, null, 2));

    const gate = mstack(sb.store.root, ["gate"]);
    assert.notEqual(gate.status, 0);
    assert.match(gate.stdout + gate.stderr, /no row with that timestamp resolves storage-layer/);
  } finally {
    sb.dispose();
  }
});

test("resolving a fork demands an answer that says something", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "specifying", decision_required: FORK })]));

    // `--decision " "` plus the default `--result open` wrote a row that was a
    // timestamp and the word "open", and the gate called the fork answered.
    for (const args of [
      ["--decision", " ", "--result", "x"],
      ["--decision", "a real answer"],
      ["--decision", "a real answer", "--result", "open"],
      ["--decision", "a real answer", "--result", "  "],
    ]) {
      const result = mstack(sb.store.root, ["decide", "--resolves", "storage-layer", ...args]);
      assert.notEqual(result.status, 0, `accepted ${JSON.stringify(args)}`);
    }
    assert.equal(all(sb.store).length, 0, "a refused resolve must not leave a row behind");

    const ok = mstack(sb.store.root, [
      "decide",
      "--resolves",
      "storage-layer",
      "--decision",
      "versioned envelope",
      "--result",
      "version field required",
    ]);
    assert.equal(ok.status, 0, ok.stderr);
  } finally {
    sb.dispose();
  }
});

test("concurrent decisions do not share a timestamp, because the timestamp is the key", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));

    // Twelve concurrent calls produced eight distinct millisecond timestamps
    // before the append was serialised. Fan-out is a shipped feature, so this
    // is the designed workflow rather than a stress test, and a pointer that
    // resolved to two rows could name two contradictory answers.
    const children = Array.from({ length: 12 }, (_, i) =>
      spawnSync(MSTACK, ["decide", "--decision", `concurrent ${i}`], {
        cwd: sb.store.root,
        encoding: "utf8",
      }),
    );
    for (const child of children) assert.equal(child.status, 0, child.stderr);

    const rows = all(sb.store);
    assert.equal(rows.length, 12, "every decision must be recorded");
    assert.equal(new Set(rows.map((r) => r.ts)).size, 12, "and each must be distinguishable from the others");
    assert.ok(!existsSync(`${sb.store.decisions}.lock`), "the lock must not survive the writers");
  } finally {
    sb.dispose();
  }
});

test("a store written before the resolves column keeps its rows and gains the column", () => {
  const sb = sandbox();
  try {
    // Only ever adding a column at the end is what makes this safe. Without the
    // widening, the next append would write more cells than the header names
    // and silently misalign every row against an older store.
    writeFileSync(
      sb.store.decisions,
      "ts\tphase\tdecision\twhy\tevidence\tresult\n2026-01-01T00:00:00.000Z\tdesign\told row\tbecause\tsomewhere\tdone\n",
      "utf8",
    );
    sb.writeState(state([item({ status: "in_progress" })]));
    assert.equal(mstack(sb.store.root, ["decide", "--decision", "new row", "--result", "done"]).status, 0);

    const rows = all(sb.store);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.decision, "old row", "the pre-existing row must survive intact");
    assert.equal(rows[0]!.result, "done", "and stay in its own columns");
    assert.equal(rows[0]!.resolves, "");
    assert.equal(rows[1]!.decision, "new row");
  } finally {
    sb.dispose();
  }
});

test("a header that is not a prefix is left alone rather than guessed at", () => {
  const sb = sandbox();
  try {
    // A rename or a reorder is not a widening, and quietly guessing at one is
    // how data gets attributed to the wrong column.
    const foreign = "when\twhat\twhy\n2026-01-01\tsomething\tbecause\n";
    writeFileSync(sb.store.decisions, foreign, "utf8");
    ensureHeader(sb.store.decisions, ["ts", "phase", "decision"]);
    assert.equal(readFileSync(sb.store.decisions, "utf8"), foreign);
  } finally {
    sb.dispose();
  }
});
