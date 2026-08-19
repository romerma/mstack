import { test } from "node:test";
import assert from "node:assert/strict";

import { cell, row } from "../src/tsv.ts";

test("a cell a spreadsheet would run as a formula is neutralised", () => {
  // Evidence is often attacker-influenced text: PR titles, branch names,
  // filenames, generated output. None of it may execute when a reviewer opens
  // the file in a spreadsheet.
  for (const hostile of ["=cmd|' /c calc'!A1", "+1+1", "-2+3", "@SUM(A1)"]) {
    assert.equal(cell(hostile).charAt(0), "'", `${hostile} was left executable`);
  }
});

test("ordinary text is left alone", () => {
  assert.equal(cell("reverted, see PR #12"), "reverted, see PR #12");
  assert.equal(cell("a-b"), "a-b");
});

test("tabs and newlines cannot break a row apart", () => {
  assert.equal(cell("a\tb\nc\r\nd"), "a b c d");
  assert.equal(row(["a\tb", "c"]).split("\t").length, 2);
});

test("null and undefined become empty, not the string 'undefined'", () => {
  assert.equal(cell(undefined), "");
  assert.equal(cell(null), "");
});
