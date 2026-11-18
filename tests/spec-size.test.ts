import { test } from "node:test";
import assert from "node:assert/strict";

import { all } from "../src/decisions.ts";
import { parseState } from "../src/state.ts";
import { cli, inWorld, specWith, SPAWNING, type World } from "./budget-helpers.ts";

/**
 * Item 43, seam 4: `mstack state set --status spec_ready` on an sdd item whose
 * spec.md has more requirements than its size allows (m 12, l 30).
 */

const spec = (n: number, extra: World = {}): World => ({ status: "specifying", sdd: true, spec: specWith(n), ...extra });
const READY = ["state", "set", "bud", "--status", "spec_ready"];

test("12 requirements pass for size m, and so do 12 for no size", SPAWNING, () => {
  for (const size of ["m", undefined]) {
    inWorld(spec(12, size === undefined ? {} : { size }), (box) => {
      const r = cli(box, ...READY);
      assert.equal(r.code, 0, `${size}: ${r.stderr}`);
      assert.equal(parseState(box.store.state).items[0]?.status, "spec_ready");
    });
  }
});

test("13 requirements are refused for m and for no size, with the count, the limit and both ways out", SPAWNING, () => {
  for (const size of ["m", undefined]) {
    inWorld(spec(13, size === undefined ? {} : { size }), (box) => {
      const r = cli(box, ...READY);
      assert.equal(r.code, 2, `${size}`);
      assert.match(r.stderr, /spec\.md declares 13 requirements, and a size m item may have 12/);
      assert.match(r.stderr, /cut the spec to 12 or fewer, or pass --force with --closed-by "<why this many is right>"/);
      assert.equal(parseState(box.store.state).items[0]?.status, "specifying");
      assert.equal(all(box.store).length, 0);
    });
  }
});

test("size l allows 30 and refuses 31", SPAWNING, () => {
  inWorld(spec(30, { size: "l" }), (box) => {
    assert.equal(cli(box, ...READY).code, 0);
  });
  inWorld(spec(31, { size: "l" }), (box) => {
    const r = cli(box, ...READY);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /declares 31 requirements, and a size l item may have 30/);
  });
});

test("the same requirement id twice counts once, as the table check counts ids", SPAWNING, () => {
  inWorld(spec(12, { spec: specWith(12) + "\n### Requirement: R3 again\nThe system MUST.\n" }), (box) => {
    assert.equal(cli(box, ...READY).code, 0);
  });
});

test("--force alone is refused, naming --closed-by; --force with it moves the item and records a spec-size row", SPAWNING, () => {
  inWorld(spec(13), (box) => {
    const bare = cli(box, ...READY, "--force");
    assert.equal(bare.code, 2);
    assert.match(bare.stderr, /--force would move bud to spec_ready past the 12 requirement limit, and that has to be on the record/);
    assert.match(bare.stderr, /add --closed-by "<why this many is right>"/);
    assert.equal(parseState(box.store.state).items[0]?.status, "specifying");
    assert.equal(all(box.store).length, 0);

    const forced = cli(box, ...READY, "--force", "--closed-by", "the three parts ship together");
    assert.equal(forced.code, 0, forced.stderr);
    assert.match(forced.stdout, /forced: bud has 13 requirements, over the 12 a size m item may have/);
    assert.equal(parseState(box.store.state).items[0]?.status, "spec_ready");
    const rows = all(box.store);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.phase, "spec-size");
    assert.equal(rows[0]?.decision, "the three parts ship together");
    assert.equal(rows[0]?.item, "bud");
    assert.match(rows[0]?.why ?? "", /13 requirements/);
  });
});

test("the limit is for the move out of specifying, and for a spec that exists", SPAWNING, () => {
  // From spec_ready back through specifying and forward again is the same move: asked again.
  inWorld(spec(13, { status: "spec_ready" }), (box) => {
    const r = cli(box, "state", "set", "bud", "--status", "in_progress");
    assert.equal(r.code, 0, r.stderr);
  });
  // No spec.md at all: nothing to count, and the gate's own spec check says what is missing.
  inWorld({ status: "specifying" }, (box) => {
    assert.equal(cli(box, ...READY).code, 0);
  });
});

test("--size l given in the same command is the size the limit is read at", SPAWNING, () => {
  inWorld(spec(20), (box) => {
    assert.equal(cli(box, ...READY, "--size", "l").code, 0);
  });
});
