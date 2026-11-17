import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scripts: Record<string, string> = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
).scripts;

// Item 46: the documented test command has to pass on the documented floor (node 22.6),
// where .ts files only load with the flag, and has to run only this repository's tests.
test("test:node carries the flags node 22.6 needs, like the launcher", () => {
  assert.match(scripts["test:node"]!, /--experimental-strip-types/);
  assert.match(scripts["test:node"]!, /--disable-warning=ExperimentalWarning/);
});

test("test:bun scopes to ./tests, not the filter 'tests/' that also matches sandbox/", () => {
  assert.match(scripts["test:bun"]!, /bun test \.\/tests(\s|$)/);
});

test("npm test is the two halves, so there is one definition of each", () => {
  assert.equal(scripts["test"], "npm run test:bun && npm run test:node");
});
