import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { item, sandbox, state } from "./helpers.ts";

/**
 * Item 82: which verifier names close an item, and the refusal at `done`.
 *
 * Everything goes through the CLI, `ledger record --verifier`, `state set
 * --status done` and `gate`, on a throwaway git repository, under whichever
 * runtime runs this file (the node flags only apply to node).
 */

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.ts");
const FLAGS = process.execPath.endsWith("bun") ? [] : ["--disable-warning=ExperimentalWarning", "--experimental-strip-types"];
const ENV = { ...process.env, HOME: "", GIT_CONFIG_GLOBAL: "/dev/null" };

type Result = { stdout: string; stderr: string; code: number };

function cli(cwd: string, ...args: string[]): Result {
  const r = spawnSync(process.execPath, [...FLAGS, CLI, ...args], { cwd, encoding: "utf8", timeout: 30_000, env: ENV });
  if (r.error !== undefined) throw r.error;
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status ?? 1 };
}

const SLUG = "demo";

function verifying(): ReturnType<typeof sandbox> {
  const sb = sandbox();
  sb.writeState(state([item({ slug: SLUG, status: "verifying" })]));
  return sb;
}

function recordRow(sb: ReturnType<typeof sandbox>, verifier: string, evidence = "node --test tests", verdict = "test-verified", sha = sb.sha): void {
  const r = cli(sb.store.root, "ledger", "record", SLUG, sha, verdict, "--evidence", evidence, `--verifier=${verifier}`);
  assert.equal(r.code, 0, `record as ${JSON.stringify(verifier)}: ${r.stderr}`);
}

function status(sb: ReturnType<typeof sandbox>): string {
  const items = (JSON.parse(readFileSync(sb.store.state, "utf8")) as { items: { status: string }[] }).items;
  return items[0]!.status;
}

/** Records one row under `verifier`, tries to close, and says what the gate then thinks of the store. */
function closeAs(verifier: string, evidence?: string): { close: Result; status: string; gate: Result } {
  const sb = verifying();
  try {
    recordRow(sb, verifier, evidence);
    const close = cli(sb.store.root, "state", "set", SLUG, "--status", "done");
    return { close, status: status(sb), gate: cli(sb.store.root, "gate") };
  } finally {
    sb.dispose();
  }
}

const REFUSED = [
  "implementer", "Implementer", "IMPLEMENTER", "mstack:implementer", "mstack:Implementer", "  implementer  ",
  "spec-author", "spec author", "spec_author", "Spec-Author", "SPEC_AUTHOR", "spec--author", "mstack:spec-author",
  "impl", "Impl", "implementor", "author", "Author", "developer", "Developer", "dev", "DEV", "coder", "Coder",
  "self", "Self", "SELF", "me", "Me", "mstack:self", "-self-", "_me_",
];

const KEEPS_CLOSING = [
  "reviewer", "mstack:reviewer", "coordinator", "session", "orchestrator", "review panel", "release check", "fact-check reviewer",
  "e2e session", "adversarial reviewer", "verifier", "dev-ci", "self-hosted runner", "impl review bot", "developer-experience team", "my-self", "Maycol",
];

test("a verdict recorded under a name for the pass that wrote the work is refused at done, with the gate's reason", { timeout: 300_000 }, () => {
  for (const name of REFUSED) {
    const { close, status: after } = closeAs(name);
    assert.equal(close.code, 2, `${JSON.stringify(name)} must not close: ${close.stdout}`);
    assert.match(close.stderr, /demo cannot close: .*the pass that wrote the code/s, name);
    assert.match(close.stderr, /a closing verdict has to come from a pass that did not write the code/, name);
    assert.equal(after, "verifying", `${JSON.stringify(name)}: the item stays where it was`);
  }
});

test("a verdict under any other name closes, and the gate agrees afterwards: near misses, panels, people and CI jobs", { timeout: 300_000 }, () => {
  for (const name of KEEPS_CLOSING) {
    const { close, status: after, gate } = closeAs(name);
    assert.equal(close.code, 0, `${JSON.stringify(name)} must close: ${close.stderr}`);
    assert.equal(after, "done", name);
    assert.equal(gate.code, 0, `${JSON.stringify(name)}: gate after the close: ${gate.stdout}`);
  }
});

test("an empty verifier and a whitespace verifier do not close", { timeout: 120_000 }, () => {
  for (const name of ["", " ", "\t"]) {
    const { close, status: after } = closeAs(name);
    assert.equal(close.code, 2, `${JSON.stringify(name)}: ${close.stdout}`);
    assert.match(close.stderr, /demo cannot close: .*the pass that wrote the code/s);
    assert.equal(after, "verifying");
  }
});

test("a row under a closing name whose evidence is the implementer's own report does not close", { timeout: 60_000 }, () => {
  for (const evidence of [".mstack/progress/impl_demo.md", "see impl_demo_r2.md", ".mstack/progress/spec_demo.md"]) {
    const { close, status: after } = closeAs("reviewer", evidence);
    assert.equal(close.code, 2, `${evidence}: ${close.stdout}`);
    assert.match(close.stderr, /demo cannot close: .*own report/s, evidence);
    assert.equal(after, "verifying");
  }
});

test("--force with --closed-by does not close an item with no independent verdict, and writes nothing", { timeout: 60_000 }, () => {
  const sb = verifying();
  try {
    recordRow(sb, "implementer");
    const before = readFileSync(sb.store.state, "utf8");
    const close = cli(sb.store.root, "state", "set", SLUG, "--status", "done", "--force", "--closed-by", "I wrote it and I say it is fine");
    assert.equal(close.code, 2, close.stdout);
    assert.match(close.stderr, /demo cannot close: .*the pass that wrote the code/s);
    assert.doesNotMatch(close.stderr, /--force closes it anyway/);
    assert.equal(readFileSync(sb.store.state, "utf8"), before);
  } finally {
    sb.dispose();
  }
});

test("an independent approval recorded at an older commit still closes, and one recorded after the implementer's row does too", { timeout: 60_000 }, () => {
  const sb = verifying();
  try {
    recordRow(sb, "implementer");
    recordRow(sb, "reviewer", "review_demo.md and node --test tests");
    sb.commit();
    const close = cli(sb.store.root, "state", "set", SLUG, "--status", "done");
    assert.equal(close.code, 0, close.stderr);
    assert.equal(cli(sb.store.root, "gate").code, 0);
  } finally {
    sb.dispose();
  }
});

test("only the implementer's row at the new commit, over an approval at the old one, is read as the gate reads it", { timeout: 60_000 }, () => {
  const sb = verifying();
  try {
    recordRow(sb, "reviewer");
    const next = sb.commit();
    recordRow(sb, "implementer", "node --test tests", "test-verified", next);
    const close = cli(sb.store.root, "state", "set", SLUG, "--status", "done");
    assert.equal(close.code, 0, close.stderr);
    assert.equal(cli(sb.store.root, "gate").code, 0, "the gate reads every row of a closed item, and so does the close");
  } finally {
    sb.dispose();
  }
});

test("a rejection then an independent approval closes; an approval then a rejection does not", { timeout: 60_000 }, () => {
  const answered = verifying();
  try {
    recordRow(answered, "reviewer", "review_demo.md round 1", "verifier-failed");
    recordRow(answered, "reviewer", "review_demo_r2.md round 2");
    assert.equal(cli(answered.store.root, "state", "set", SLUG, "--status", "done").code, 0);
  } finally {
    answered.dispose();
  }
  const standing = verifying();
  try {
    recordRow(standing, "reviewer", "review_demo.md round 1");
    recordRow(standing, "reviewer", "review_demo_r2.md round 2", "verifier-failed");
    const close = cli(standing.store.root, "state", "set", SLUG, "--status", "done");
    assert.equal(close.code, 2, close.stdout);
    assert.match(close.stderr, /a rejection stands in the ledger/);
  } finally {
    standing.dispose();
  }
});

test("with require_verdict_to_close off, the close does not ask for a verdict", { timeout: 60_000 }, () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ slug: SLUG, status: "verifying" })], { rules: { one_active_item: true, require_verdict_to_close: false, require_spec_for_sdd_items: true } }));
    recordRow(sb, "implementer");
    assert.equal(cli(sb.store.root, "state", "set", SLUG, "--status", "done").code, 0);
  } finally {
    sb.dispose();
  }
});

/**
 * Item 82, round 2: the words of the refusal, and the colon rule.
 */
test("the refusal names the way out for someone working alone, in the words the gate uses at verifying", { timeout: 60_000 }, () => {
  const sb = verifying();
  try {
    recordRow(sb, "implementer");
    const gate = cli(sb.store.root, "gate");
    const close = cli(sb.store.root, "state", "set", SLUG, "--status", "done");
    assert.equal(close.code, 2);
    const fix = close.stderr.split("\n")[1]!.trim();
    assert.match(fix, /a name that is not the author's/);
    assert.match(fix, /your own name/);
    assert.match(fix, /`ci`/);
    assert.match(fix, /verifier-blocked/);
    assert.ok(gate.stdout.includes(`fix: ${fix}`), `the gate's line is the same:\n${gate.stdout}`);
  } finally {
    sb.dispose();
  }
});

test("an item whose only rows are a spec-author's is not told to ask for the implementer", { timeout: 60_000 }, () => {
  const sb = verifying();
  try {
    recordRow(sb, "spec-author");
    const close = cli(sb.store.root, "state", "set", SLUG, "--status", "done");
    assert.equal(close.code, 2);
    assert.match(close.stderr, /only spec-author/);
    assert.doesNotMatch(close.stderr, /implementer/);
  } finally {
    sb.dispose();
  }
});

test("the refusal prints the name as typed, without the apostrophe the ledger writer added", { timeout: 60_000 }, () => {
  const sb = verifying();
  try {
    recordRow(sb, "-implementer");
    const close = cli(sb.store.root, "state", "set", SLUG, "--status", "done");
    assert.equal(close.code, 2);
    assert.match(close.stderr, /\(only -implementer\)/);
    assert.doesNotMatch(close.stderr, /'-implementer/);
  } finally {
    sb.dispose();
  }
});

test("what follows the last colon is the name: ci:dev is the author's, dev:ci closes", { timeout: 60_000 }, () => {
  assert.equal(closeAs("ci:dev").close.code, 2);
  const closes = closeAs("dev:ci");
  assert.equal(closes.close.code, 0, closes.close.stderr);
  assert.equal(closes.gate.code, 0, closes.gate.stdout);
});
