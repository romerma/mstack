import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runGate } from "../src/gate.ts";
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

test("text after the first entry that belongs to no entry fails", () => {
  const sb = withGlossary("**Order**: A request.\n\nReceipt: a record of a run.\n");
  try {
    expectFail(gate(sb).report, /GLOSSARY\.md:3: text outside any entry.* -> start it with a \*\*Term\*\*: line or delete it/, "no bold term");
  } finally {
    sb.dispose();
  }
});

test("a definition of three sentences fails; two pass, with abbreviations and code spans not counted", () => {
  const long = withGlossary("**Order**: A request. It is placed. It is paid.\n");
  const ok = withGlossary("**Order**: A request, e.g. Basket or Cart. It ends at `deliver.ts. Done` or later, i.e. At the door.\n");
  try {
    expectFail(gate(long).report, /GLOSSARY\.md:1: entry "Order" has 3 sentences.* -> cut it to the two that say what it is/, "three sentences");
    expectPass(gate(ok).report, "two sentences with abbreviations");
  } finally {
    long.dispose();
    ok.dispose();
  }
});

test("the _Avoid_ line is not part of the definition, and a heading ends the entry above it", () => {
  const avoid = withGlossary("**Order**: A request. It is placed.\n_Avoid_: Purchase. Basket\n");
  const heading = withGlossary("**Order**: A request.\n## Next\nstray text\n");
  try {
    expectPass(gate(avoid).report, "two sentences and an _Avoid_ line");
    expectFail(gate(heading).report, /GLOSSARY\.md:3: text outside any entry/, "text after a heading");
  } finally {
    avoid.dispose();
    heading.dispose();
  }
});

test("a GLOSSARY.md with no entries fails", () => {
  const sb = withGlossary("# Glossary\n\nComing soon.\n");
  try {
    expectFail(gate(sb).report, /GLOSSARY\.md: no entries/, "empty glossary");
  } finally {
    sb.dispose();
  }
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
    assert.match(out, /GLOSSARY\.md: [2-9] entries/);
  } finally {
    sb.dispose();
  }
});
