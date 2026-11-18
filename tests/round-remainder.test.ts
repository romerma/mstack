import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { roundOf } from "../src/roles.ts";

/**
 * Item 43, criterion 5: one rule for the remainder of a report name, in code,
 * prose and tests. A leading `r<digits>` is a round marker only when nothing or
 * a dash follows it; `_r2x` is a lens named `r2x` in round 1.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");
/** Prose and comments joined into one line each, so a sentence wrapped across lines still matches. */
const flat = (text: string): string => text.replace(/\s*\n\s*(?:\*|\/\/)?\s*/g, " ");

const remainders: [string, { round: number; lens?: string }][] = [
  ["", { round: 1 }],
  ["_r2", { round: 2 }],
  ["_r2-facts", { round: 2, lens: "facts" }],
  ["_r2x", { round: 1, lens: "r2x" }],
  ["_r10", { round: 10 }],
  ["_r0", { round: 0 }],
  ["_r", { round: 1, lens: "r" }],
  ["_facts", { round: 1, lens: "facts" }],
];

for (const [rest, want] of remainders) {
  test(`roundOf reads review_slug${rest}.md as ${JSON.stringify(want)}`, () => {
    assert.deepEqual(roundOf(`review_slug${rest}.md`, "review", "slug"), want);
  });
}

test("agents/reviewer.md states the rule roundOf applies, and the old blanket rule is gone", () => {
  const prose = flat(read("agents/reviewer.md"));
  assert.match(prose, /a leading `r<digits>` is a round marker only when nothing follows it or a dash does/);
  assert.match(prose, /`_r2x` is a lens named `r2x`, in round 1/);
  assert.doesNotMatch(prose, /a leading `r<digits>` in what remains is a round marker, never a lens/);
});

test("the comment in src/fanout.ts says the same, and why a new worker name is still refused", () => {
  const source = flat(read("src/fanout.ts"));
  assert.match(source, /`roundOf` takes `r<digits>` as a round only when nothing or a dash follows/);
  assert.match(source, /a file named `_r2x` is a lens called `r2x` in round 1/);
});

// Criterion 3 of item 43 is prose, and the check that reads it is the table check
// of item 41 (tests/r-table-check.test.ts reads the newest round's file alone);
// these pin the prose so the two do not drift apart.
test("the implementer prose says a later round writes impl_<slug>_r<N>.md with the whole table, in under 110 lines", () => {
  const agent = read("agents/implementer.md");
  assert.ok(agent.split("\n").length < 110, `agents/implementer.md has ${agent.split("\n").length} lines`);
  for (const [name, text] of [["agents/implementer.md", flat(agent)], ["skills/implement/SKILL.md", flat(read("skills/implement/SKILL.md"))]] as const) {
    assert.match(text, /impl_<slug>_r<N>\.md/, name);
    assert.match(text, /what changed since the last round/, name);
    assert.match(text, /carries the whole table again, every id/, name);
  }
});

// Round 2 of item 43: a dash after the marker with nothing behind it is not a lens
// separator, so `_r2-` is not round 2. It reads as a lens named `r2-` in round 1,
// the same way `_r3-` must not be taken for round 3 (which needs a decision row).
test("roundOf reads review_slug_r2-.md and review_slug_r3-.md as round 1 with the whole remainder as the lens", () => {
  assert.deepEqual(roundOf("review_slug_r2-.md", "review", "slug"), { round: 1, lens: "r2-" });
  assert.deepEqual(roundOf("review_slug_r3-.md", "review", "slug"), { round: 1, lens: "r3-" });
});
