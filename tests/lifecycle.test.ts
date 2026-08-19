import { test } from "node:test";
import assert from "node:assert/strict";

import { ACTIVE_STATUSES, canTransition, isActive, isStatus, STATUSES, TRANSITIONS } from "../src/lifecycle.ts";

test("every status has a transition entry", () => {
  for (const status of STATUSES) {
    assert.ok(TRANSITIONS[status] !== undefined, `${status} has no transitions declared`);
  }
});

test("every transition target is itself a status", () => {
  for (const [from, targets] of Object.entries(TRANSITIONS)) {
    for (const to of targets) assert.ok(isStatus(to), `${from} -> ${to} is not a status`);
  }
});

test("done is terminal", () => {
  assert.deepEqual(TRANSITIONS.done, []);
  for (const status of STATUSES) {
    if (status !== "done") assert.equal(canTransition("done", status), false, `done -> ${status}`);
  }
});

test("anything unfinished can become blocked; nothing finished can", () => {
  assert.equal(canTransition("in_progress", "blocked"), true);
  assert.equal(canTransition("pending", "blocked"), true);
  assert.equal(canTransition("done", "blocked"), false);
  assert.equal(canTransition("cancelled", "blocked"), false);
});

test("the direct path skips the spec statuses", () => {
  assert.equal(canTransition("pending", "in_progress"), true);
  assert.equal(canTransition("pending", "specifying"), true);
});

test("code cannot start before a spec is ready", () => {
  assert.equal(canTransition("specifying", "in_progress"), false);
  assert.equal(canTransition("specifying", "spec_ready"), true);
  assert.equal(canTransition("spec_ready", "in_progress"), true);
});

test("review sits between implementation and close", () => {
  assert.equal(canTransition("in_progress", "done"), false, "no self-approval shortcut");
  assert.equal(canTransition("reviewing", "done"), false, "verification still has to happen");
  assert.equal(canTransition("verifying", "done"), true);
});

test("review can send work back", () => {
  assert.equal(canTransition("reviewing", "in_progress"), true);
  assert.equal(canTransition("verifying", "in_progress"), true);
});

test("active statuses are exactly the ones between pending and done", () => {
  for (const status of STATUSES) {
    const expected = (ACTIVE_STATUSES as readonly string[]).includes(status);
    assert.equal(isActive(status), expected, `${status}`);
  }
  assert.equal(isActive("pending"), false);
  assert.equal(isActive("done"), false);
  assert.equal(isActive("blocked"), false);
});
