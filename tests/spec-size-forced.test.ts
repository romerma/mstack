import { test } from "node:test";
import assert from "node:assert/strict";

import { all } from "../src/decisions.ts";
import { parseState } from "../src/state.ts";
import { cli, inWorld, put, specWith, SPAWNING, type Box, type World } from "./budget-helpers.ts";

/**
 * Item 43, round 2, point 4: a forced spec move leaves no `closed_by` on an open
 * item, and the spec limit holds on every route that lands an sdd item at or past
 * spec_ready from before it (not only specifying -> spec_ready).
 */

const over = (status: string, extra: World = {}): World => ({ status, sdd: true, spec: specWith(13), ...extra });
const theItem = (box: Box) => parseState(box.store.state).items[0];
const move = (to: string, ...flags: string[]): string[] => ["state", "set", "bud", "--status", to, ...flags];
const REASON = "the three parts ship together";

const routes: [string, string][] = [
  ["specifying", "spec_ready"],
  ["specifying", "in_progress"],
  ["pending", "spec_ready"],
  ["pending", "in_progress"],
  ["blocked", "in_progress"],
];

for (const [from, to] of routes) {
  test(`${from} -> ${to} is refused past the limit, and forced only with a reason, which goes to the spec-size row alone`, SPAWNING, () => {
    inWorld(over(from), (box) => {
      // Refused unforced: over the limit, or not a legal move at all.
      assert.equal(cli(box, ...move(to)).code, 2);
      assert.equal(theItem(box)?.status, from);

      const bare = cli(box, ...move(to, "--force"));
      assert.equal(bare.code, 2, bare.stdout);
      assert.match(bare.stderr, /past the 12 requirement limit, and that has to be on the record/);
      assert.equal(theItem(box)?.status, from);
      assert.equal(all(box.store).length, 0);

      const forced = cli(box, ...move(to, "--force", "--closed-by", REASON));
      assert.equal(forced.code, 0, forced.stderr);
      assert.equal(theItem(box)?.status, to);
      assert.equal(theItem(box)?.closed_by, undefined, "an open item carries no closed_by");
      const rows = all(box.store);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.phase, "spec-size");
      assert.equal(rows[0]?.decision, REASON);
      assert.equal(rows[0]?.item, "bud");
    });
  });
}

test("a spec within the limit moves on every route without a row", SPAWNING, () => {
  for (const [from, to] of routes) {
    inWorld({ status: from, sdd: true, spec: specWith(12) }, (box) => {
      const r = cli(box, ...move(to, "--force"));
      assert.equal(r.code, 0, `${from} -> ${to}: ${r.stderr}`);
      assert.equal(all(box.store).length, 0);
    });
  }
});

test("a move that stays at or past spec_ready is not asked again, and a non-sdd item is never asked", SPAWNING, () => {
  inWorld(over("in_progress"), (box) => {
    assert.equal(cli(box, ...move("reviewing")).code, 0);
  });
  inWorld({ status: "specifying", spec: specWith(13) }, (box) => {
    assert.equal(cli(box, ...move("spec_ready")).code, 0);
  });
});

test("a forced spec move leaves a reason given with --closed-by out of closed_by even when the same command sets other fields", SPAWNING, () => {
  inWorld(over("specifying"), (box) => {
    const r = cli(box, ...move("spec_ready", "--force", "--closed-by", REASON, "--title", "A new title"));
    assert.equal(r.code, 0, r.stderr);
    assert.equal(theItem(box)?.closed_by, undefined);
    assert.equal(theItem(box)?.title, "A new title");
  });
});

test("--sdd given in the same command as the move puts the item under the limit", SPAWNING, () => {
  inWorld({ status: "specifying" }, (box) => {
    put(box, ".mstack/specs/bud/spec.md", specWith(13));
    // Without --sdd the item is not on the spec path and nothing is counted;
    // with it, the same command is the one that makes it an sdd item.
    const r = cli(box, ...move("spec_ready", "--sdd"));
    assert.equal(r.code, 2, r.stdout);
    assert.match(r.stderr, /declares 13 requirements, and a size m item may have 12/);
    assert.equal(theItem(box)?.status, "specifying");
  });
});
