import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { all } from "../src/decisions.ts";
import { item, sandbox, state } from "./helpers.ts";
import { cli, SPAWNING } from "./budget-helpers.ts";

/**
 * Item 43, seam 1: `mstack decide` and the decisions.tsv it writes, with and
 * without an active item, and over files from before the `item` column.
 */

const REPO_DECISIONS = join(dirname(fileURLToPath(import.meta.url)), "..", ".mstack", "decisions.tsv");

const DECIDE = ["decide", "--phase", "implement", "--decision", "keep the cap", "--why", "because", "--evidence", "x", "--result", "ok"];

function lastRow(path: string): string[] {
  const rows = readFileSync(path, "utf8").split("\n").filter((l) => l !== "");
  return (rows[rows.length - 1] ?? "").split("\t");
}

function headerOf(path: string): string[] {
  return (readFileSync(path, "utf8").split("\n")[0] ?? "").split("\t");
}

test("decide writes the active item's slug in a trailing item column", SPAWNING, () => {
  const box = sandbox();
  try {
    box.writeState(state([item({ slug: "bud", status: "in_progress" })]));
    const r = cli(box, ...DECIDE);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(headerOf(box.store.decisions).at(-1), "item");
    const row = lastRow(box.store.decisions);
    assert.equal(row.length, 8);
    assert.equal(row[7], "bud");
    assert.equal(row[6], "", "resolves stays its own column");
  } finally {
    box.dispose();
  }
});

test("decide with no active item leaves the item column empty", SPAWNING, () => {
  const box = sandbox();
  try {
    box.writeState(state([item({ slug: "bud", status: "pending" })]));
    assert.equal(cli(box, ...DECIDE).code, 0);
    assert.equal(all(box.store).at(-1)?.item, "");
    assert.equal(lastRow(box.store.decisions)[7] ?? "", "");
  } finally {
    box.dispose();
  }
});

test("--item overrides the active item, and a slug that is not an item is refused with nothing written", SPAWNING, () => {
  const box = sandbox();
  try {
    box.writeState(state([item({ id: 1, slug: "bud", status: "in_progress" }), item({ id: 2, slug: "other", status: "pending" })]));
    assert.equal(cli(box, ...DECIDE, "--item", "other").code, 0);
    assert.equal(all(box.store).at(-1)?.item, "other");

    const before = readFileSync(box.store.decisions, "utf8");
    const bad = cli(box, ...DECIDE, "--item", "nope");
    assert.notEqual(bad.code, 0);
    assert.match(bad.stderr, /no item matches 'nope'/);
    assert.equal(readFileSync(box.store.decisions, "utf8"), before);
  } finally {
    box.dispose();
  }
});

test("a file from before the item column still reads, and the first write keeps every old row valid", SPAWNING, () => {
  const box = sandbox();
  try {
    box.writeState(state([item({ slug: "bud", status: "in_progress" })]));
    // A copy of this repository's own file, cut back to the seven columns it had.
    const lines = readFileSync(REPO_DECISIONS, "utf8").split("\n").filter((l) => l !== "");
    const old = lines.map((l) => l.split("\t").slice(0, 7).join("\t"));
    assert.equal(old[0], "ts\tphase\tdecision\twhy\tevidence\tresult\tresolves");
    writeFileSync(box.store.decisions, `${old.join("\n")}\n`, "utf8");

    const before = all(box.store);
    assert.equal(before.length, old.length - 1);
    assert.ok(before.every((d) => d.item === ""));

    assert.equal(cli(box, ...DECIDE).code, 0);

    const after = all(box.store);
    assert.equal(after.length, before.length + 1);
    assert.deepEqual(after.slice(0, -1), before, "every old row reads as it did, with an empty item");
    assert.equal(after.at(-1)?.item, "bud");
    // The header is rewritten in place, once, and the old rows are byte-for-byte what they were.
    const written = readFileSync(box.store.decisions, "utf8").split("\n").filter((l) => l !== "");
    assert.equal(written[0], `${old[0]}\titem`);
    assert.deepEqual(written.slice(1, -1), old.slice(1));
  } finally {
    box.dispose();
  }
});

test("a file whose old rows carry six cells reads too", SPAWNING, () => {
  const box = sandbox();
  try {
    box.writeState(state([item({ slug: "bud", status: "in_progress" })]));
    writeFileSync(box.store.decisions, "ts\tphase\tdecision\twhy\tevidence\tresult\nt1\tp\td\tw\te\tr\n", "utf8");
    assert.equal(cli(box, ...DECIDE).code, 0);
    const rows = all(box.store);
    assert.equal(rows[0]?.item, "");
    assert.equal(rows[0]?.resolves, "");
    assert.equal(rows[1]?.item, "bud");
  } finally {
    box.dispose();
  }
});
