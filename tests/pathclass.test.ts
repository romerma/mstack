import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyPath } from "../src/pathclass.ts";

const table: [string, "test" | "doc" | "code"][] = [
  ["src/gate.ts", "code"],
  ["src/testing.ts", "code"],
  ["src/contest/run.ts", "code"],
  ["tests/gate.test.ts", "test"],
  ["tests/fixtures/x.json", "test"],
  ["test/a.js", "test"],
  ["pkg/__tests__/a.js", "test"],
  ["__tests__/a.js", "test"],
  ["src/a.test.ts", "test"],
  ["a.spec.js", "test"],
  ["pkg/test_a.py", "test"],
  ["pkg/a_test.py", "test"],
  ["pkg/a_test.go", "test"],
  ["README.md", "doc"],
  ["skills/x/README.md", "doc"],
  ["docs/wiki/a.txt", "doc"],
  ["LICENSE", "doc"],
  ["LICENSE-MIT", "doc"],
  ["CHANGELOG", "doc"],
  ["CHANGELOG.md", "doc"],
  ["src/LICENSE.ts", "code"],
  ["src/docs/a.ts", "code"],
  ["./src/gate.ts", "code"],
  ["scripts/check.mjs", "code"],
];

for (const [path, expected] of table) {
  test(`${path} is ${expected}`, () => assert.equal(classifyPath(path), expected));
}

test("an override list replaces the defaults for its class", () => {
  assert.equal(classifyPath("spec/a.rb", { test: ["spec/**"] }), "test");
  assert.equal(classifyPath("tests/a.ts", { test: ["spec/**"] }), "code");
  assert.equal(classifyPath("notes/a.txt", { doc: ["notes/**"] }), "doc");
});
