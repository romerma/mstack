import { test } from "node:test";
import assert from "node:assert/strict";

import { parseRTable } from "../src/rtable.ts";

/**
 * `src/rtable.ts` is a leaf: text in, rows out. Expected values are written out
 * as literals, one report shape per test.
 */

const HEAD = "| R | Test | Where |\n|---|---|---|\n";
const cells = (text: string): string[][] => parseRTable(text).rows.map((r) => [...r.cells]);

test("a plain table gives its rows as trimmed cells, with the line of each", () => {
  const t = parseRTable(`# Report\n\n${HEAD}| A1 | it parses | \`tests/a.test.ts:3\` |\n| A2, A3 | other | n/a: nothing to run |\n\ntext\n`);
  assert.equal(t.found, true);
  assert.deepEqual(t.problems, []);
  assert.deepEqual(cells(`${HEAD}| A1 | it parses | \`tests/a.test.ts:3\` |\n| A2, A3 | other | n/a: nothing to run |\n`), [
    ["A1", "it parses", "`tests/a.test.ts:3`"],
    ["A2, A3", "other", "n/a: nothing to run"],
  ]);
  assert.deepEqual(t.rows.map((r) => r.line), [5, 6]);
});

test("no table, or a table with another header, is not found", () => {
  assert.equal(parseRTable("nothing here\n").found, false);
  for (const head of [
    "| R | Test | Evidence |",
    "| R | Test |",
    "| R | Test | Where | Extra |",
    "| r | test | where |",
    "| Req | Test | Where |",
    "| Test | R | Where |",
  ]) {
    const cols = head.split("|").length - 2;
    const t = parseRTable(`${head}\n|${"---|".repeat(cols)}\n| A1 | x | y |\n`);
    assert.equal(t.found, false, head);
    assert.deepEqual(t.rows, [], head);
  }
});

test("header cells are trimmed; spacing and colons in the separator row do not matter", () => {
  for (const sep of ["|---|---|---|", "| --- | :---: | ---: |", "|:--|--:|:-:|"]) {
    const t = parseRTable(`|R|  Test  |Where|\n${sep}\n|A1|x|y|\n`);
    assert.equal(t.found, true, sep);
    assert.deepEqual(cells(`|R|  Test  |Where|\n${sep}\n|A1|x|y|\n`), [["A1", "x", "y"]], sep);
  }
});

test("a header with no separator row under it is not a table", () => {
  assert.equal(parseRTable("| R | Test | Where |\n| A1 | x | y |\n").found, false);
});

test("an escaped pipe stays inside its cell, unescaped", () => {
  assert.deepEqual(cells(`${HEAD}| A1 | a \\| b | \`t.test.ts:1\` |\n`), [["A1", "a | b", "`t.test.ts:1`"]]);
});

test("a pipe inside a backtick code span does not split the cell", () => {
  assert.deepEqual(cells(`${HEAD}| A1 | \`a | b\` and \`\`x | y\`\` | tests/t.test.ts:1 |\n`), [
    ["A1", "`a | b` and ``x | y``", "tests/t.test.ts:1"],
  ]);
});

test("a backtick with no closing one is a literal and the pipe after it splits", () => {
  assert.deepEqual(cells(`${HEAD}| A1 | it's a \` tick | tests/t.test.ts:1 |\n`), [["A1", "it's a ` tick", "tests/t.test.ts:1"]]);
});

test("with two tables the last one wins", () => {
  const text = `${HEAD}| A1 | first | tests/a.test.ts:1 |\n\nlater\n\n${HEAD}| A9 | second | tests/b.test.ts:2 |\n`;
  assert.deepEqual(cells(text), [["A9", "second", "tests/b.test.ts:2"]]);
});

test("a table inside a fenced code block is an example, not the table", () => {
  const fenced = "```markdown\n" + `${HEAD}| A1 | example | tests/a.test.ts:1 |\n` + "```\n";
  assert.equal(parseRTable(fenced).found, false);
  const both = `${HEAD}| A1 | real | tests/a.test.ts:1 |\n\n${fenced}`;
  assert.deepEqual(cells(both), [["A1", "real", "tests/a.test.ts:1"]]);
  const tilde = "~~~\n" + `${HEAD}| A1 | example | x |\n` + "~~~\n";
  assert.equal(parseRTable(tilde).found, false);
});

test("CRLF line endings read the same", () => {
  const text = `# r\r\n${HEAD}| A1 | x | tests/a.test.ts:1 |\r\n| A2 | y | n/a: a long enough reason |\r\n\r\nend\r\n`.replace(/\r?\n/g, "\r\n");
  assert.deepEqual(cells(text), [
    ["A1", "x", "tests/a.test.ts:1"],
    ["A2", "y", "n/a: a long enough reason"],
  ]);
});

test("a table at the end of the file with no trailing newline is read", () => {
  assert.deepEqual(cells(`${HEAD}| A1 | x | tests/a.test.ts:1 |`), [["A1", "x", "tests/a.test.ts:1"]]);
});

test("a table ends at the first line that is not a row", () => {
  const text = `${HEAD}| A1 | x | tests/a.test.ts:1 |\nprose, not a row\n| A2 | y | tests/a.test.ts:2 |\n`;
  assert.deepEqual(cells(text), [["A1", "x", "tests/a.test.ts:1"]]);
});

test("a row with the wrong number of cells is a problem naming its line, and is not a row", () => {
  const t = parseRTable(`intro\n${HEAD}| A1 | only two |\n| A2 | x | y | z |\n| A3 | ok | tests/a.test.ts:1 |\n`);
  assert.equal(t.found, true);
  assert.deepEqual(t.rows.map((r) => r.cells[0]), ["A3"]);
  assert.deepEqual(t.problems, ["line 4: a row has 2 cells, the table has 3", "line 5: a row has 4 cells, the table has 3"]);
});

test("an indented table (up to three spaces) and a row without its closing pipe are read", () => {
  assert.deepEqual(cells(`   | R | Test | Where |\n   |---|---|---|\n   | A1 | x | y\n`), [["A1", "x", "y"]]);
});
