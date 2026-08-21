import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { STORE_GITIGNORE } from "../src/setup.ts";
import { obligations, PROJECT_TARGET, receipts, record, status } from "../src/verification.ts";
import { parseState } from "../src/state.ts";
import { item, sandbox, state } from "./helpers.ts";

/** The parsed State the module's functions take, built from the helpers' shape. */
function parsed(sb: ReturnType<typeof sandbox>, value: unknown) {
  sb.writeState(value);
  return parseState(sb.store.state);
}

test("the obligation list is exactly what --full would run, project command first", () => {
  const sb = sandbox();
  try {
    const st = parsed(
      sb,
      state([item({ status: "verifying", verification: "pytest -q" })], { verify: "make check" }),
    );
    assert.deepEqual(obligations(st, st.items[0]), [
      { command: "make check", target: PROJECT_TARGET },
      { command: "pytest -q", target: "storage-layer" },
    ]);

    // A seeded-but-empty verify is not a command, which is the shape every
    // fresh `mstack setup` store starts in.
    const seeded = parsed(sb, state([item({ status: "verifying" })], { verify: "   " }));
    assert.deepEqual(obligations(seeded, seeded.items[0]), []);
  } finally {
    sb.dispose();
  }
});

test("a receipt round-trips through the store file", () => {
  const sb = sandbox();
  try {
    record(sb.store, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });
    const rows = receipts(sb.store);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.command, "pytest -q");
    assert.equal(rows[0]?.outcome, "passed");
    assert.equal(rows[0]?.sha, sb.sha);
    assert.ok((rows[0]?.ts ?? "").length > 0, "a receipt is dated, or 'when it last ran' means nothing");
  } finally {
    sb.dispose();
  }
});

test("a command with no run anywhere is reported as never executed", () => {
  const sb = sandbox();
  try {
    const st = parsed(sb, state([item({ status: "verifying", verification: "pytest -q" })]));
    const result = status(sb.store, st, st.items[0], sb.sha);
    assert.equal(result.satisfied, false);
    assert.deepEqual(result.problems, ["`pytest -q` has never been executed"]);
  } finally {
    sb.dispose();
  }
});

test("a passing run at this commit satisfies the command, and only at this commit", () => {
  const sb = sandbox();
  try {
    const st = parsed(sb, state([item({ status: "verifying", verification: "pytest -q" })]));
    record(sb.store, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });
    assert.equal(status(sb.store, st, st.items[0], sb.sha).satisfied, true);

    // The ledger's rule, applied to a run: a new head SHA voids the row. The
    // message has to say the rows exist, or the reader goes looking for them.
    const moved = sb.commit();
    const after = status(sb.store, st, st.items[0], moved);
    assert.equal(after.satisfied, false);
    assert.deepEqual(after.problems, [
      "`pytest -q` has not run at " +
        moved.slice(0, 8) +
        "; 1 earlier run(s) exist at other commits, and a new commit voids them",
    ]);
  } finally {
    sb.dispose();
  }
});

test("a run that failed here is a different fact from one that never ran", () => {
  const sb = sandbox();
  try {
    const st = parsed(sb, state([item({ status: "verifying", verification: "pytest -q" })]));
    record(sb.store, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "failed" });
    const result = status(sb.store, st, st.items[0], sb.sha);
    assert.equal(result.satisfied, false);
    assert.deepEqual(result.problems, [`\`pytest -q\` ran at ${sb.sha.slice(0, 8)} and failed`]);
  } finally {
    sb.dispose();
  }
});

test("the last run at a commit wins, in both directions", () => {
  const sb = sandbox();
  try {
    const st = parsed(sb, state([item({ status: "verifying", verification: "pytest -q" })]));
    const row = (outcome: "passed" | "failed", ts: string) =>
      record(sb.store, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome, ts });

    // Red, then fixed in the working tree and re-run green: green.
    row("failed", "2026-01-01T00:00:00.000Z");
    row("passed", "2026-01-01T00:01:00.000Z");
    assert.equal(status(sb.store, st, st.items[0], sb.sha).satisfied, true);

    // ...and green, then re-run red, is red. "Best" would have said otherwise,
    // which is how a broken suite keeps a stale pass.
    row("failed", "2026-01-01T00:02:00.000Z");
    const result = status(sb.store, st, st.items[0], sb.sha);
    assert.equal(result.satisfied, false);
    assert.match(result.problems[0] ?? "", /ran at .* and failed/);
  } finally {
    sb.dispose();
  }
});

test("editing the verification string voids the receipt that vouched for the old one", () => {
  const sb = sandbox();
  try {
    const before = parsed(sb, state([item({ status: "verifying", verification: "pytest -q" })]));
    record(sb.store, { target: "storage-layer", sha: sb.sha, command: "pytest -q", outcome: "passed" });
    assert.equal(status(sb.store, before, before.items[0], sb.sha).satisfied, true);

    // The incident this whole file exists for was a `verification` that did not
    // execute. Keying the receipt to (item, sha) alone would let the green run
    // of the old string vouch for whatever replaced it.
    const after = parsed(sb, state([item({ status: "verifying", verification: "pytest -q --strict" })]));
    const result = status(sb.store, after, after.items[0], sb.sha);
    assert.equal(result.satisfied, false);
    assert.deepEqual(result.problems, ["`pytest -q --strict` has never been executed"]);
  } finally {
    sb.dispose();
  }
});

test("both commands have to be green, and the failing one is named", () => {
  const sb = sandbox();
  try {
    const st = parsed(
      sb,
      state([item({ status: "verifying", verification: "pytest -q" })], { verify: "make check" }),
    );
    record(sb.store, { target: PROJECT_TARGET, sha: sb.sha, command: "make check", outcome: "passed" });
    const result = status(sb.store, st, st.items[0], sb.sha);
    assert.equal(result.satisfied, false);
    assert.deepEqual(result.problems, ["`pytest -q` has never been executed"], "one green does not carry the other");
  } finally {
    sb.dispose();
  }
});

test("nothing configured is vacuously satisfied, and says the list was empty", () => {
  const sb = sandbox();
  try {
    const st = parsed(sb, state([item({ status: "verifying" })]));
    const result = status(sb.store, st, st.items[0], sb.sha);
    assert.deepEqual(result.required, []);
    assert.equal(result.satisfied, true);
    assert.deepEqual(result.problems, []);
  } finally {
    sb.dispose();
  }
});

test("setup writes a store .gitignore, because a committed receipt voids itself", () => {
  const sb = sandbox();
  try {
    const body = readFileSync(join(sb.store.dir, ".gitignore"), "utf8");
    assert.equal(body, STORE_GITIGNORE);
    assert.match(body, /^verification\.tsv$/m);
    // Only that one file. Every other file in the store is durable state under
    // version control, and an over-broad rule here would silently stop
    // committing a ledger row or a decision.
    assert.deepEqual(
      body.split("\n").filter((line) => line !== "" && !line.startsWith("#")),
      ["verification.tsv"],
    );
  } finally {
    sb.dispose();
  }
});
