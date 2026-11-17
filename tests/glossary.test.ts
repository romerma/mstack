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

test("no GLOSSARY.md passes and the gate says nothing about one", () => {
  const sb = withGlossary(null);
  try {
    const { report, out } = gate(sb);
    expectPass(report, "no glossary");
    assert.ok(!/glossary/i.test(out), `the gate mentioned a glossary that does not exist:\n${out}`);
  } finally {
    sb.dispose();
  }
});

test("a well-formed GLOSSARY.md passes and the gate reports its entry count", () => {
  const sb = withGlossary(WELL_FORMED);
  try {
    const { report, out } = gate(sb);
    expectPass(report, "well formed");
    assert.match(out, /\[ok\]\s+GLOSSARY\.md: 2 entries, each a term with a one or two sentence definition/);
  } finally {
    sb.dispose();
  }
});

test("an entry with no definition fails and names the entry", () => {
  const sb = withGlossary("# G\n\n**Order**:\nA request to buy.\n\n**Receipt**:\n\n**Fork**: A choice.\n");
  try {
    const { report } = gate(sb);
    expectFail(report, /GLOSSARY\.md:6: entry "Receipt" has no definition -> write one or two sentences under it, or remove the entry/, "empty definition");
    assert.equal(report.failures.length, 1, JSON.stringify(report.failures));
  } finally {
    sb.dispose();
  }
});

test("a term defined twice fails, case-insensitively, naming both lines", () => {
  const sb = withGlossary("**Item**: A unit of work.\n\n**item**: Another unit.\n");
  try {
    expectFail(gate(sb).report, /GLOSSARY\.md:3: entry "item" repeats "Item" from line 1 -> merge the two or rename one/, "duplicate");
  } finally {
    sb.dispose();
  }
});

test("two sentences pass, with abbreviations and code spans not counted", () => {
  const { report, out } = check("**Order**: A request, e.g. Basket or Cart. It ends at `deliver.ts. Done` or later, i.e. At the door.\n");
  expectPass(report, "two sentences with abbreviations");
  assert.deepEqual(glossaryWarnings(report), []);
  assert.match(out, /each a term with a one or two sentence definition/);
});

test("the _Avoid_ line is not part of the definition, and a heading ends the entry above it", () => {
  const avoid = check("**Order**: A request. It is placed.\n_Avoid_: Purchase. Basket. Cart\n");
  const heading = check("**Order**: A request.\n## Next\nstray text. More text. And more.\n");
  assert.deepEqual(glossaryWarnings(avoid.report), []);
  expectPass(avoid.report, "two sentences and an _Avoid_ line");
  assert.deepEqual(glossaryWarnings(heading.report), [], "the stray line under the heading is not part of Order");
});

test("only the root file is checked: a malformed one in a subdirectory or docs/ is not read", () => {
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

test("the CLI exits 1 on a malformed glossary, 0 on a well-formed one and with none", () => {
  const run = (sb: ReturnType<typeof sandbox>) => {
    try {
      const stdout = execFileSync(MSTACK, ["gate"], { cwd: sb.store.root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return { status: 0, stdout };
    } catch (error) {
      const e = error as { status?: number; stdout?: string };
      return { status: e.status ?? 1, stdout: e.stdout ?? "" };
    }
  };
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

test("the example in the reference passes the check it is the format for", () => {
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

test("a bold term with the colon inside or outside the bold, bare or as a list item, is an entry", () => {
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

test("one heading per term followed by a paragraph is an entry when the file uses headings for terms", () => {
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

test("rules, HTML comments and blank lines between entries are ignored", () => {
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

test("a fenced block is skipped whole, wherever it is", () => {
  const before = check("# G\n\n```md\n**Order**:\n```\n\n**Invoice**: A bill.\n");
  const after = check("**Invoice**: A bill.\n\n```md\n**Invoice**:\n**Order**:\n- **Item**: x\n```\n\n~~~\n**Receipt**:\n~~~\n");
  assert.match(before.out, /GLOSSARY\.md: 1 entry,/);
  expectPass(before.report, "fence before the first entry");
  assert.match(after.out, /GLOSSARY\.md: 1 entry,/);
  expectPass(after.report, "fence after the entries");
});

test("a byte order mark does not hide the first entry", () => {
  const { report, out } = check("\uFEFF**Order**: A request.\n\n**Invoice**:\n");
  expectFail(report, /GLOSSARY\.md:3: entry "Invoice" has no definition/, "BOM");
  assert.ok(!/starts like an entry/.test(out), out);
});

test("Windows line endings read like Unix ones", () => {
  const crlf = "# Glossary\r\n\r\n**Order**:\r\nA request to buy something.\r\n\r\n- **Invoice**: A request for payment.\r\n\r\n**Receipt**:\r\n";
  const { report } = check(crlf);
  expectFail(report, /GLOSSARY\.md:8: entry "Receipt" has no definition/, "CRLF");
  assert.equal(report.failures.length, 1, JSON.stringify(report.failures));
  const clean = check(crlf.replace("\r\n\r\n**Receipt**:\r\n", "\r\n"));
  assert.match(clean.out, /GLOSSARY\.md: 2 entries/);
  expectPass(clean.report, "CRLF clean");
});

test("a file in which no entry is recognised warns once, names the recognised forms and stays green", () => {
  const table = check("# Glossary\n\n| Term | Meaning |\n|---|---|\n| Order | A request to buy. |\n");
  const title = check("# Glossary\n");
  for (const { report, out } of [table, title]) {
    expectPass(report, "unknown style");
    const warnings = glossaryWarnings(report);
    assert.equal(warnings.length, 1, JSON.stringify(warnings));
    assert.match(warnings[0] ?? "", /^GLOSSARY\.md: no entry recognised; entries are \*\*Term\*\*: or \*\*Term:\*\* \(also as a list item\) followed by the definition, or a ## Term or ### Term heading followed by a paragraph$/);
    assert.ok(!/delete|remove the file/i.test(out), out);
  }
});

test("an empty GLOSSARY.md is not an unknown style: it has nothing to warn about", () => {
  for (const text of ["", "\n\n  \n"]) {
    const { report } = check(text);
    expectPass(report, "empty");
    assert.deepEqual(glossaryWarnings(report), []);
  }
});

test("a definition of three sentences warns and names the entry; the gate stays green", () => {
  const { report, out } = check("# G\n\n**Order**: A request. It is placed. It is paid.\n\n**Invoice**: A bill.\n");
  expectPass(report, "three sentences");
  assert.deepEqual(glossaryWarnings(report), ['GLOSSARY.md:3: entry "Order" has 3 sentences; a definition is one or two']);
  assert.match(out, /\[warn\]\s+GLOSSARY\.md:3: entry "Order" has 3 sentences/);
  assert.ok(!/each a term with a one or two sentence definition/.test(out), "the clean line claims what the warning denies");
});

test("a bold term with no colon is not an entry and is named in a warning, first or later", () => {
  const first = check("# G\n\n**Invoice** A bill sent after delivery.\n\n**Order**: A request.\n");
  const later = check("**Order**: A request.\n\n**Invoice** A bill.\n");
  for (const { report, out } of [first, later]) {
    expectPass(report, "no colon");
    assert.match(out, /GLOSSARY\.md: 1 entry\b/);
  }
  assert.deepEqual(glossaryWarnings(first.report), ['GLOSSARY.md:3: "**Invoice** A bill sent after delivery." starts like an entry but has no colon after the term, so it is not counted']);
  assert.deepEqual(glossaryWarnings(later.report), ['GLOSSARY.md:3: "**Invoice** A bill." starts like an entry but has no colon after the term, so it is not counted']);
});

test("a sentence ends before a capital, not before a lowercase word: 'approx. ten' is one sentence", () => {
  const { report } = check("**Order**: A request of approx. ten items. It is paid.\n");
  assert.deepEqual(glossaryWarnings(report), []);
  const three = check("**Order**: Is it paid? Yes. Then it ships.\n");
  assert.equal(glossaryWarnings(three.report).length, 1);
});

test("a failure leaves no clean line behind, and the duplicate rule ignores case and a trailing colon", () => {
  const { report, out } = check("**Item**: A unit of work.\n\n**Item:**: Again.\n\n**ITEM **: Third.\n\n**Receipt**:\n\n**Item::**: Fourth.\n");
  assert.equal(report.failures.length, 4, JSON.stringify(report.failures));
  expectFail(report, /GLOSSARY\.md:9: entry "Item:" repeats "Item" from line 1/, "trailing colon");
  assert.ok(!/delete/i.test(out), `a failure told the reader to delete something:\n${out}`);
  expectFail(report, /GLOSSARY\.md:3: entry "Item" repeats "Item" from line 1/, "colon");
  expectFail(report, /GLOSSARY\.md:5: entry "ITEM" repeats "Item" from line 1/, "case and space");
  expectFail(report, /GLOSSARY\.md:7: entry "Receipt" has no definition/, "empty");
  assert.ok(!/\[ok\]\s+GLOSSARY\.md/.test(out), `an [ok] line beside the failures:\n${out}`);
});

test("a GLOSSARY.md that is a directory is a failure with a clear line, and the gate still finishes", () => {
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

test("an unreadable GLOSSARY.md is a failure, not a crash", { skip: process.getuid?.() === 0 }, () => {
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

test("the Stop hook carries a glossary failure to the model, including when the file cannot be read, and is silent on a warning", () => {
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
