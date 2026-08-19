import { test } from "node:test";
import assert from "node:assert/strict";

import { asList, parse } from "../src/frontmatter.ts";

test("scalars, quotes and booleans", () => {
  const { data } = parse(`---
name: mstack
description: "A router, not an orchestrator"
disable-model-invocation: true
user-invocable: yes
background: off
---
body`);
  assert.equal(data["name"], "mstack");
  assert.equal(data["description"], "A router, not an orchestrator");
  assert.equal(data["disable-model-invocation"], true);
  assert.equal(data["user-invocable"], true, "Claude Code accepts yes/no/on/off, not only true/false");
  assert.equal(data["background"], false);
});

test("block sequences", () => {
  const { data } = parse(`---
tools:
  - Read
  - Grep
---
`);
  assert.deepEqual(asList(data["tools"]), ["Read", "Grep"]);
});

test("inline sequences and comma strings both read as lists", () => {
  assert.deepEqual(asList("[Read, Write]"), ["Read", "Write"]);
  assert.deepEqual(asList("Read, Write"), ["Read", "Write"]);
  assert.deepEqual(asList(undefined), []);
});

test("the body and its starting line come back", () => {
  const parsed = parse("---\nname: x\n---\n# Title\n");
  assert.equal(parsed.body.trim(), "# Title");
  assert.equal(parsed.bodyStartLine, 4);
});

test("missing and unterminated front matter are reported, not guessed at", () => {
  assert.match(parse("# Just markdown").error ?? "", /no front matter/);
  assert.match(parse("---\nname: x\n").error ?? "", /never closed/);
});
