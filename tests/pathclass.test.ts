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
  // `*` stays inside one segment
  ["LICENSE/x.ts", "code"],
  ["src/a.test.dir/x.ts", "code"],
  // a test path wins over the doc pattern it also matches
  ["tests/README.md", "test"],
  ["docs/a.test.ts", "test"],
  // Maven and Gradle: **/src/test/**, which also matches with zero directories before src
  ["src/test/java/com/x/GreetTest.java", "test"],
  ["svc/api/src/test/kotlin/GreetTest.kt", "test"],
  ["src/test/resources/application.yml", "test"],
  ["svc/api/src/test/java/com/x/Fixtures.java", "test"],
  ["src/testing-utils.ts", "code"],
  ["src/test.ts", "code"],
  ["src/main/java/com/x/Greet.java", "code"],
  // RSpec: spec/** and **/*_spec.rb
  ["spec/models/greet_spec.rb", "test"],
  ["spec/spec_helper.rb", "test"],
  ["lib/greet_spec.rb", "test"],
  ["specification/readme.ts", "code"],
  ["lib/greet_spec.rb.bak", "code"],
  ["lib/greet.rb", "code"],
  // Swift packages and .NET: a directory ending in Tests (case matters, so Protests is code)
  ["Tests/GreetTests/GreetTests.swift", "test"],
  ["Greet.Tests/Helpers.cs", "test"],
  ["src/GreetTests/Helpers.cs", "test"],
  ["src/Protests/x.cs", "code"],
  ["src/contest/rank.ts", "code"],
  ["src/TestsHelper/x.cs", "code"],
  // test files by name: *Tests.swift, *Tests.cs, *Test.java, *Test.kt
  ["Sources/App/GreetTests.swift", "test"],
  ["Sources/App/Greet.swift", "code"],
  ["src/GreetTests.cs", "test"],
  ["src/Greet.cs", "code"],
  ["src/GreetTests.csx", "code"],
  ["app/src/GreetTest.java", "test"],
  ["app/src/Contest.java", "code"],
  ["app/src/Latest.java", "code"],
  ["app/src/GreetTest.kt", "test"],
  ["app/src/Greet.kt", "code"],
  // Cypress and Playwright
  ["cypress/e2e/greet.ts", "test"],
  ["cypress/support/commands.ts", "test"],
  ["cypress.config.ts", "code"],
  ["web/greet.cy.ts", "test"],
  ["src/policy.ts", "code"],
  ["web/greet.e2e.ts", "test"],
  ["src/e2e-utils.ts", "code"],
  ["e2e/login.ts", "test"],
  ["src/e2e/login.ts", "code"],
  ["playwright/greet.ts", "test"],
  ["src/playwright.ts", "code"],
  // the ./ prefix is stripped before matching
  ["./tests/a.ts", "test"],
  ["./README.md", "doc"],
];

for (const [path, expected] of table) {
  test(`${path} is ${expected}`, () => assert.equal(classifyPath(path), expected));
}

test("an override list replaces the defaults for its class", () => {
  assert.equal(classifyPath("spec/a.rb", { test: ["spec/**"] }), "test");
  assert.equal(classifyPath("tests/a.ts", { test: ["spec/**"] }), "code");
  assert.equal(classifyPath("notes/a.txt", { doc: ["notes/**"] }), "doc");
});
