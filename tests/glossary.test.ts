import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runGate } from "../src/gate.ts";
import { stop } from "../src/hooks.ts";
import { captured, expectFail, expectPass, item, sandbox, state, trackCurrent } from "./helpers.ts";

const MSTACK = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

/** Every test here runs a real gate, which spawns git; bun's 5 s default is too short under load. */
const GATE_TEST = { timeout: 60_000 };

/** A sandbox whose gate is green before any glossary is written. */
function withGlossary(text: string | null, path = "GLOSSARY.md") {
  const sb = sandbox();
  sb.writeState(state([item({ status: "in_progress" })]));
  trackCurrent(sb);
  if (text !== null) {
    mkdirSync(dirname(join(sb.store.root, path)), { recursive: true });
    writeFileSync(join(sb.store.root, path), text, "utf8");
  }
  return sb;
}

function gate(sb: ReturnType<typeof sandbox>) {
  const { value, out } = captured(() => runGate(sb.store));
  return { report: value, out };
}

/** Runs the gate on a glossary and always cleans up. */
function check(text: string) {
  const sb = withGlossary(text);
  try {
    return gate(sb);
  } finally {
    sb.dispose();
  }
}

/** The warnings about the glossary: the sandbox is on main, so the report holds others. */
function glossaryWarnings(report: { warnings: readonly string[] }): string[] {
  return report.warnings.filter((warning) => warning.includes("GLOSSARY.md"));
}

/** The gate's glossary lines: the ones naming GLOSSARY.md. */
function glossaryLines(out: string): string[] {
  return out.split("\n").filter((line) => line.includes("GLOSSARY.md"));
}

const WELL_FORMED = `# Sandbox

What this project is.

## Language

**Order**:
A request to buy something, from placing it to delivery.
_Avoid_: Purchase

**Invoice**: A request for payment sent after delivery, e.g. by email. It is never edited.
`;

test("no GLOSSARY.md passes and the gate says nothing about one", GATE_TEST, () => {
  const sb = withGlossary(null);
  try {
    const { report, out } = gate(sb);
    expectPass(report, "no glossary");
    assert.ok(!/glossary/i.test(out), `the gate mentioned a glossary that does not exist:\n${out}`);
  } finally {
    sb.dispose();
  }
});

test("a well-formed GLOSSARY.md passes and the gate reports its entry count", GATE_TEST, () => {
  const sb = withGlossary(WELL_FORMED);
  try {
    const { report, out } = gate(sb);
    expectPass(report, "well formed");
    assert.match(out, /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/);
  } finally {
    sb.dispose();
  }
});

test("an entry with no definition fails and names the entry", GATE_TEST, () => {
  const sb = withGlossary("# G\n\n**Order**:\nA request to buy.\n\n**Receipt**:\n\n**Fork**: A choice.\n");
  try {
    const { report } = gate(sb);
    expectFail(report, /GLOSSARY\.md:6: entry "Receipt" has no definition -> write one or two sentences under it, or remove the entry/, "empty definition");
    assert.equal(report.failures.length, 1, JSON.stringify(report.failures));
  } finally {
    sb.dispose();
  }
});

test("a term defined twice fails, case-insensitively, naming both lines", GATE_TEST, () => {
  const sb = withGlossary("**Item**: A unit of work.\n\n**item**: Another unit.\n");
  try {
    expectFail(gate(sb).report, /GLOSSARY\.md:3: entry "item" repeats "Item" from line 1 -> merge the two or rename one/, "duplicate");
  } finally {
    sb.dispose();
  }
});

test("two sentences pass, with abbreviations and code spans not counted", GATE_TEST, () => {
  const { report, out } = check("**Order**: A request, e.g. Basket or Cart. It ends at `deliver.ts. Done` or later, i.e. At the door.\n");
  expectPass(report, "two sentences with abbreviations");
  assert.deepEqual(glossaryWarnings(report), []);
  assert.match(out, /each a term with a one or two sentence definition/);
});

test("the _Avoid_ line is not part of the definition, and a heading ends the entry above it", GATE_TEST, () => {
  const avoid = check("**Order**: A request. It is placed.\n_Avoid_: Purchase. Basket. Cart\n");
  const heading = check("**Order**: A request.\n## Next\nstray text. More text. And more.\n");
  assert.deepEqual(glossaryWarnings(avoid.report), []);
  expectPass(avoid.report, "two sentences and an _Avoid_ line");
  assert.deepEqual(glossaryWarnings(heading.report), [], "the stray line under the heading is not part of Order");
});

test("only the root file is checked: a malformed one in a subdirectory or docs/ is not read", GATE_TEST, () => {
  const sub = withGlossary("**Order**:\n", "src/GLOSSARY.md");
  const docs = withGlossary("**Order**:\n", "docs/GLOSSARY.md");
  try {
    for (const sb of [sub, docs]) {
      const { report, out } = gate(sb);
      expectPass(report, "malformed glossary elsewhere");
      assert.ok(!/glossary/i.test(out), out);
    }
  } finally {
    sub.dispose();
    docs.dispose();
  }
});

/** This checkout's CLI gate, run in the sandbox; the child is killed if it outlives the test. */
function run(sb: ReturnType<typeof sandbox>) {
  try {
    const stdout = execFileSync(MSTACK, ["gate"], { cwd: sb.store.root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000, killSignal: "SIGKILL" });
    return { status: 0, stdout };
  } catch (error) {
    const e = error as { status?: number; stdout?: string };
    return { status: e.status ?? 1, stdout: e.stdout ?? "" };
  }
}

/** The lines of the gate's glossary section. */
function glossarySection(stdout: string): string {
  return /^-- glossary\n([\s\S]*?)\n(?:\n|$)/m.exec(stdout)?.[1] ?? "";
}

test("the CLI exits 1 on a malformed glossary, 0 on a well-formed one and with none", GATE_TEST, () => {
  const none = withGlossary(null);
  const good = withGlossary(WELL_FORMED);
  const bad = withGlossary("**Order**:\n");
  try {
    assert.equal(run(none).status, 0);
    assert.equal(run(good).status, 0);
    const failed = run(bad);
    assert.equal(failed.status, 1);
    assert.match(failed.stdout, /entry "Order" has no definition/);
  } finally {
    none.dispose();
    good.dispose();
    bad.dispose();
  }
});

test("the example in the reference passes the check it is the format for", GATE_TEST, () => {
  const reference = readFileSync(join(dirname(MSTACK), "..", "skills", "reflect", "references", "domain-docs.md"), "utf8");
  const example = /```md\n([\s\S]*?)```/.exec(reference);
  assert.ok(example !== null, "the reference has no ```md example");
  const sb = withGlossary(example[1] ?? "");
  try {
    const { report, out } = gate(sb);
    expectPass(report, "the reference's own example");
    assert.deepEqual(glossaryWarnings(report), [], "the reference's own example must pass with no warning");
    assert.match(out, /each a term with a one or two sentence definition/);
    assert.match(out, /GLOSSARY\.md: [2-9] entries/);
  } finally {
    sb.dispose();
  }
});

test("a bold term with the colon inside or outside the bold, bare or as a list item, is an entry", GATE_TEST, () => {
  const forms = [
    "- **Order**: A request to buy something.\n- **Invoice**: A request for payment.\n",
    "**Order:** A request to buy something.\n\n**Invoice:** A request for payment.\n",
    "- **Order:**\n  A request to buy something.\n- **Invoice**:\n  A request for payment.\n",
    "* **Order**: A request to buy something.\n* **Invoice:** A request for payment.\n",
  ];
  for (const text of forms) {
    const { report, out } = check(`# Glossary\n\n${text}`);
    expectPass(report, text);
    assert.deepEqual(glossaryWarnings(report), [], text);
    assert.match(out, /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/, text);
  }
});

test("one heading per term followed by a paragraph is an entry when the file uses headings for terms", GATE_TEST, () => {
  const headed = check("# Glossary\n\n## Order\n\nA request to buy something.\n\n### Invoice\nA request for payment.\n");
  const grouped = check("# Glossary\n\n## Language\n\n### Order\n\nA request to buy something.\n\n### Invoice\n\nA request for payment.\n");
  for (const { report, out } of [headed, grouped]) {
    expectPass(report, "heading per term");
    assert.deepEqual(glossaryWarnings(report), []);
    assert.match(out, /\[ok\]\s+GLOSSARY\.md: 2 entries/);
  }
  const empty = check("# Glossary\n\n## Order\n\nA request to buy something.\n\n## Invoice\n\n## Receipt\n\nA record of a run.\n");
  expectFail(empty.report, /GLOSSARY\.md:7: entry "Invoice" has no definition/, "heading with no paragraph");
  const repeated = check("## Order\n\nA request.\n\n## order\n\nAnother.\n");
  expectFail(repeated.report, /GLOSSARY\.md:5: entry "order" repeats "Order" from line 1/, "duplicate heading");
});

test("rules, HTML comments and blank lines between entries are ignored", GATE_TEST, () => {
  const text = [
    "# Glossary",
    "",
    "**Order**: A request to buy something.",
    "",
    "---",
    "",
    "<!-- keep sorted -->",
    "",
    "<!--",
    "a longer note",
    "-->",
    "**Invoice**: A request for payment.",
    "***",
    "**Receipt**: A record of a run.",
    "",
  ].join("\n");
  const { report, out } = check(text);
  expectPass(report, "rules and comments");
  const bare = check("**Order**:\n---\n\n**Invoice**: A bill.\n");
  expectFail(bare.report, /GLOSSARY\.md:1: entry "Order" has no definition/, "a rule is not a definition");
  const note = check("**Order**:\n<!-- a note\n**Draft** not yet written\n-->\n\n**Invoice**: A bill.\n");
  expectFail(note.report, /GLOSSARY\.md:1: entry "Order" has no definition/, "a comment is not a definition");
  assert.ok(!/starts like an entry/.test(note.out), "a line inside a comment is not an entry candidate");
  assert.deepEqual(glossaryWarnings(report), []);
  assert.match(out, /GLOSSARY\.md: 3 entries/);
});

test("a fenced block is skipped whole, wherever it is", GATE_TEST, () => {
  const before = check("# G\n\n```md\n**Order**:\n```\n\n**Invoice**: A bill.\n");
  const after = check("**Invoice**: A bill.\n\n```md\n**Invoice**:\n**Order**:\n- **Item**: x\n```\n\n~~~\n**Receipt**:\n~~~\n");
  assert.match(before.out, /GLOSSARY\.md: 1 entry,/);
  expectPass(before.report, "fence before the first entry");
  assert.match(after.out, /GLOSSARY\.md: 1 entry,/);
  expectPass(after.report, "fence after the entries");
});

test("a byte order mark does not hide the first entry", GATE_TEST, () => {
  const { report, out } = check("\uFEFF**Order**: A request.\n\n**Invoice**:\n");
  expectFail(report, /GLOSSARY\.md:3: entry "Invoice" has no definition/, "BOM");
  assert.ok(!/starts like an entry/.test(out), out);
  assert.match(check("﻿**Order**: A request.\n").out, /\[ok\]\s+GLOSSARY\.md: 1 entry,/, "the entry behind the mark is counted");
});

test("Windows line endings read like Unix ones", GATE_TEST, () => {
  const crlf = "# Glossary\r\n\r\n**Order**:\r\nA request to buy something.\r\n\r\n- **Invoice**: A request for payment.\r\n\r\n**Receipt**:\r\n";
  const { report } = check(crlf);
  expectFail(report, /GLOSSARY\.md:8: entry "Receipt" has no definition/, "CRLF");
  assert.equal(report.failures.length, 1, JSON.stringify(report.failures));
  const clean = check(crlf.replace("\r\n\r\n**Receipt**:\r\n", "\r\n"));
  assert.match(clean.out, /GLOSSARY\.md: 2 entries/);
  expectPass(clean.report, "CRLF clean");
});

test("a file in which no entry is recognised warns once, names the recognised forms and stays green", GATE_TEST, () => {
  const table = check("# Glossary\n\n| Term | Meaning |\n|---|---|\n| Order | A request to buy. |\n");
  const title = check("# Glossary\n");
  for (const { report, out } of [table, title]) {
    expectPass(report, "unknown style");
    const warnings = glossaryWarnings(report);
    assert.equal(warnings.length, 1, JSON.stringify(warnings));
    assert.match(warnings[0] ?? "", /^GLOSSARY\.md: no entry recognised; entries are \*\*Term\*\*: or \*\*Term:\*\* \(also as a list item\) followed by the definition, or a ## Term or ### Term heading followed by a paragraph$/);
    assert.ok(!/delete|remove the file/i.test(out), out);
    assert.ok(!/\[ok\]\s+GLOSSARY\.md/.test(out), `an [ok] line for a file with no entry:\n${out}`);
  }
});

test("an empty GLOSSARY.md is not an unknown style: it has nothing to warn about", GATE_TEST, () => {
  for (const text of ["", "\n\n  \n"]) {
    const { report } = check(text);
    expectPass(report, "empty");
    assert.deepEqual(glossaryWarnings(report), []);
  }
});

test("a definition of three sentences warns and names the entry; the gate stays green", GATE_TEST, () => {
  const { report, out } = check("# G\n\n**Order**: A request. It is placed. It is paid.\n\n**Invoice**: A bill.\n");
  expectPass(report, "three sentences");
  assert.deepEqual(glossaryWarnings(report), ['GLOSSARY.md:3: entry "Order" has 3 sentences; a definition is one or two']);
  assert.match(out, /\[warn\]\s+GLOSSARY\.md:3: entry "Order" has 3 sentences/);
  assert.ok(!/each a term with a one or two sentence definition/.test(out), "the clean line claims what the warning denies");
});

test("a bold term with no colon is not an entry and is named in a warning, first or later", GATE_TEST, () => {
  const first = check("# G\n\n**Invoice** A bill sent after delivery.\n\n**Order**: A request.\n");
  const later = check("**Order**: A request.\n\n**Invoice** A bill.\n");
  for (const { report, out } of [first, later]) {
    expectPass(report, "no colon");
    assert.match(out, /GLOSSARY\.md: 1 entry\b/);
  }
  assert.deepEqual(glossaryWarnings(first.report), ['GLOSSARY.md:3: "**Invoice** A bill sent after delivery." starts like an entry but has no colon after the term, so it is not counted']);
  assert.deepEqual(glossaryWarnings(later.report), ['GLOSSARY.md:3: "**Invoice** A bill." starts like an entry but has no colon after the term, so it is not counted']);
});

test("a sentence ends before a capital, not before a lowercase word: 'approx. ten' is one sentence", GATE_TEST, () => {
  const { report } = check("**Order**: A request of approx. ten items. It is paid.\n");
  assert.deepEqual(glossaryWarnings(report), []);
  const three = check("**Order**: Is it paid? Yes. Then it ships.\n");
  assert.equal(glossaryWarnings(three.report).length, 1);
});

test("a failure leaves no clean line behind, and the duplicate rule ignores case and a trailing colon", GATE_TEST, () => {
  const { report, out } = check("**Item**: A unit of work.\n\n**Item:**: Again.\n\n**ITEM **: Third.\n\n**Receipt**:\n\n**Item::**: Fourth.\n");
  assert.equal(report.failures.length, 4, JSON.stringify(report.failures));
  expectFail(report, /GLOSSARY\.md:9: entry "Item:" repeats "Item" from line 1/, "trailing colon");
  assert.ok(!/delete/i.test(out), `a failure told the reader to delete something:\n${out}`);
  expectFail(report, /GLOSSARY\.md:3: entry "Item" repeats "Item" from line 1/, "colon");
  expectFail(report, /GLOSSARY\.md:5: entry "ITEM" repeats "Item" from line 1/, "case and space");
  expectFail(report, /GLOSSARY\.md:7: entry "Receipt" has no definition/, "empty");
  assert.ok(!/\[ok\]\s+GLOSSARY\.md/.test(out), `an [ok] line beside the failures:\n${out}`);
});

test("a GLOSSARY.md that is a directory is a failure with a clear line, and the gate still finishes", GATE_TEST, () => {
  const sb = withGlossary(null);
  try {
    mkdirSync(join(sb.store.root, "GLOSSARY.md"));
    const { report, out } = gate(sb);
    expectFail(report, /^GLOSSARY\.md could not be read \(EISDIR\) -> make it a readable file$/, "directory");
    assert.match(out, /-- workspace/, "the sections after the glossary still ran");
    assert.match(out, /FAILED - 1 failure/);
  } finally {
    sb.dispose();
  }
});

test("an unreadable GLOSSARY.md is a failure, not a crash", { skip: process.getuid?.() === 0, ...GATE_TEST }, () => {
  const sb = withGlossary("**Order**: A request.\n");
  try {
    chmodSync(join(sb.store.root, "GLOSSARY.md"), 0o000);
    const { report, out } = gate(sb);
    expectFail(report, /^GLOSSARY\.md could not be read \(EACCES\) -> make it a readable file$/, "mode 000");
    assert.match(out, /FAILED - 1 failure/);
  } finally {
    chmodSync(join(sb.store.root, "GLOSSARY.md"), 0o644);
    sb.dispose();
  }
});

test("the Stop hook carries a glossary failure to the model, including when the file cannot be read, and is silent on a warning", GATE_TEST, () => {
  const failing = withGlossary("**Order**:\n");
  const unreadable = withGlossary(null);
  const warning = withGlossary("# G\n\n| Term | Meaning |\n");
  try {
    mkdirSync(join(unreadable.store.root, "GLOSSARY.md"));
    for (const [sb, expected] of [
      [failing, /GLOSSARY\.md:1: entry \\?"Order\\?" has no definition/],
      [unreadable, /GLOSSARY\.md could not be read \(EISDIR\)/],
    ] as const) {
      const { value } = captured(() => stop({ cwd: sb.store.root }));
      const context = (JSON.parse(value ?? "{}") as { hookSpecificOutput?: { additionalContext?: string } }).hookSpecificOutput?.additionalContext ?? "";
      assert.match(context, /gate is red/);
      assert.match(context, expected);
    }
    const quiet = captured(() => stop({ cwd: warning.store.root }));
    assert.equal(quiet.value, null);
    assert.equal(quiet.out + quiet.err, "", "a warning must not reach the model or the transcript");
  } finally {
    failing.dispose();
    unreadable.dispose();
    warning.dispose();
  }
});

test("a bold label under a bold entry belongs to that entry and is not a term", GATE_TEST, () => {
  const { report, out } = check("# G\n\n**Order**: A request to buy something.\n**Example:** order 1042.\n\n**Invoice**: A bill sent after delivery.\n**Example:** invoice 77.\n");
  expectPass(report, "an Example label under each entry");
  assert.deepEqual(glossaryWarnings(report), []);
  assert.match(out, /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/);
  const bare = check("**Order**:\n**Example:** order 1042.\n");
  expectFail(bare.report, /GLOSSARY\.md:1: entry "Order" has no definition/, "a label is not a definition");
  assert.equal(bare.report.failures.length, 1, JSON.stringify(bare.report.failures));
});

test("in a list, each unindented bold item is an entry and an indented bold label belongs to the item above", GATE_TEST, () => {
  const nested = check("# G\n\n- **Order**: A request to buy something.\n  - **Synonyms:** purchase\n- **Invoice**: A bill.\n  - **Synonyms:** bill\n");
  expectPass(nested.report, "a nested Synonyms label under each item");
  assert.deepEqual(glossaryWarnings(nested.report), []);
  assert.match(nested.out, /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/);
  const tight = check("- **Order**: A request to buy something.\n- **Invoice**: A bill.\n");
  assert.match(tight.out, /\[ok\]\s+GLOSSARY\.md: 2 entries/);
  const repeated = check("- **Order**: A request to buy something.\n- **Order**: A bill.\n");
  expectFail(repeated.report, /GLOSSARY\.md:2: entry "Order" repeats "Order" from line 1/, "a repeated item in a tight list");
});

test("a bold label under a heading term belongs to that term, directly under its paragraph or after a blank line", GATE_TEST, () => {
  for (const gap of ["", "\n"]) {
    const { report, out } = check(`# G\n\n## Order\n\nA request to buy something.\n${gap}**Example:** order 1042.\n\n## Invoice\n\nA bill sent after delivery.\n${gap}**Example:** invoice 77.\n`);
    expectPass(report, `an Example label under each heading term (gap ${JSON.stringify(gap)})`);
    assert.deepEqual(glossaryWarnings(report), []);
    assert.match(out, /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/);
  }
});

test("a file whose terms are headings is read by its headings whatever bold lines their sections hold", GATE_TEST, () => {
  const seeAlso = check("# G\n\n## Order\n\nA request to buy something.\n\n## Invoice\n\nA bill sent after delivery.\n\n**See also:** Order.\n");
  expectPass(seeAlso.report, "one See also line");
  assert.match(seeAlso.out, /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/);
  const empty = check("# G\n\n## Order\n\nA request to buy something.\n\n## Invoice\n\n## Receipt\n\nA record of a run.\n\n**See also:** the README.\n");
  expectFail(empty.report, /^GLOSSARY\.md:7: entry "Invoice" has no definition -> write one or two sentences under it, or remove the entry$/, "a heading term with no definition beside one bold line");
  assert.equal(empty.report.failures.length, 1, JSON.stringify(empty.report.failures));
  const repeated = check("# G\n\n## Order\n\nA request to buy something.\n\n## Order\n\nAgain.\n\n**Note:** kept short.\n");
  expectFail(repeated.report, /^GLOSSARY\.md:7: entry "Order" repeats "Order" from line 3 -> merge the two or rename one$/, "a repeated heading term beside one bold line");
});

test("an HTML comment line inside an entry neither ends it nor counts as its definition", GATE_TEST, () => {
  const { report, out } = check("# G\n\n**Order**:\n<!-- reviewed 2026-11 -->\nA request to buy something.\n\n**Invoice**: A bill.\n");
  expectPass(report, "a comment between the term line and its definition");
  assert.match(out, /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/);
});

test("a line starting with #word is text, not a heading: a heading needs a space after the hashes", GATE_TEST, () => {
  const { report, out } = check("**Tag**:\n#urgent and #later are examples of a label.\n");
  expectPass(report, "a definition line that starts with a hashtag");
  assert.match(out, /\[ok\]\s+GLOSSARY\.md: 1 entry, each a term with a one or two sentence definition/);
});

test("the upstream layout passes: bold entries under ## Language, then a plain list under ## Relationships", GATE_TEST, () => {
  const { report, out } = check("# Shop\n\nWhat the shop is.\n\n## Language\n\n**Order**:\nA request to buy something.\n_Avoid_: Purchase\n\n**Invoice**:\nA request for payment sent after delivery.\n\n## Relationships\n\n- An **Order** produces one or more **Invoices**\n- An **Invoice** belongs to exactly one **Customer**\n");
  expectPass(report, "upstream layout");
  assert.deepEqual(glossaryWarnings(report), []);
  assert.match(out, /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/);
});

test("a term line followed only by colons has no definition", GATE_TEST, () => {
  const { report } = check("**Order:**:\n\n**Invoice**: A bill.\n");
  expectFail(report, /^GLOSSARY\.md:1: entry "Order" has no definition -> write one or two sentences under it, or remove the entry$/, "colons only");
  assert.equal(report.failures.length, 1, JSON.stringify(report.failures));
});

test("a heading term whose only line is an _Avoid_ line has no definition", GATE_TEST, () => {
  const { report } = check("## Order\n\n_Avoid_: Purchase\n\n## Invoice\n\nA bill.\n");
  expectFail(report, /^GLOSSARY\.md:1: entry "Order" has no definition -> write one or two sentences under it, or remove the entry$/, "only an _Avoid_ line");
  assert.equal(report.failures.length, 1, JSON.stringify(report.failures));
});

test("this repository's own GLOSSARY.md passes with no warning, and each of its bold term lines is an entry", GATE_TEST, () => {
  const text = readFileSync(join(dirname(MSTACK), "..", "GLOSSARY.md"), "utf8");
  const termLines = text.split("\n").filter((line) => line.startsWith("**")).length;
  const { report, out } = check(text);
  expectPass(report, "this repository's glossary");
  assert.deepEqual(glossaryWarnings(report), []);
  assert.match(out, new RegExp(`\\[ok\\]\\s+GLOSSARY\\.md: ${termLines} entries, each a term with a one or two sentence definition`));
});

test("the CLI reads bold labels as part of their entry and heading terms by their headings", GATE_TEST, () => {
  const cases = [
    {
      text: "# G\n\n**Order**: A request to buy something.\n**Example:** order 1042.\n\n**Invoice**: A bill sent after delivery.\n**Example:** invoice 77.\n",
      status: 0,
      section: "[ok]    GLOSSARY.md: 2 entries, each a term with a one or two sentence definition",
    },
    {
      text: "# G\n\n## Order\n\nA request to buy something.\n\n## Invoice\n\n## Receipt\n\nA record of a run.\n\n**See also:** the README.\n",
      status: 1,
      section: '[fail]  GLOSSARY.md:7: entry "Invoice" has no definition\n        fix: write one or two sentences under it, or remove the entry',
    },
    {
      text: "# G\n\n## Order\n\nA request to buy something.\n\n## Order\n\nAgain.\n\n**Note:** kept short.\n",
      status: 1,
      section: '[fail]  GLOSSARY.md:7: entry "Order" repeats "Order" from line 3\n        fix: merge the two or rename one',
    },
  ];
  for (const { text, status, section } of cases) {
    const sb = withGlossary(text);
    try {
      const ran = run(sb);
      assert.equal(ran.status, status, ran.stdout);
      assert.equal(glossarySection(ran.stdout), section, ran.stdout);
    } finally {
      sb.dispose();
    }
  }
});

test("a list-item label under a non-list bold entry belongs to that entry", GATE_TEST, () => {
  const { report, out } = check("**Order**: A request to buy something.\n- **Synonyms:** purchase\n\n**Invoice**: A bill.\n- **Synonyms:** bill\n");
  expectPass(report, "a Synonyms list item under each entry");
  assert.match(out, /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/);
});

test("a section of prose under a ## heading does not hide the bold entries in the sections after it", GATE_TEST, () => {
  const { report, out } = check("# Shop\n\n## About\n\nWhat the shop is.\n\n## Language\n\n**Order**: A request to buy something.\n\n**Invoice**: A bill.\n");
  expectPass(report, "prose section first");
  assert.match(out, /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/);
});

test("a bold phrase that starts a later line of a paragraph is not named as an entry missing its colon", GATE_TEST, () => {
  const { report } = check("# G\n\nThe words of the shop, written\n**before** the code that uses them.\n\n**Order**: A request.\n");
  expectPass(report, "a wrapped paragraph");
  assert.deepEqual(glossaryWarnings(report), []);
});

test("a #### heading is not a term heading: only ## and ### are", GATE_TEST, () => {
  const { report } = check("# G\n\n#### Order\n\nA request to buy something.\n");
  expectPass(report, "a level-4 heading");
  assert.deepEqual(glossaryWarnings(report), ["GLOSSARY.md: no entry recognised; entries are **Term**: or **Term:** (also as a list item) followed by the definition, or a ## Term or ### Term heading followed by a paragraph"]);
});
