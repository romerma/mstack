import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { render, parseInput, renderSubagents } from "../src/statusline.ts";
import { record } from "../src/ledger.ts";
import { sandbox, state, item } from "./helpers.ts";

const ESC = String.fromCharCode(27);

function plain(box: ReturnType<typeof sandbox>, extra: Record<string, unknown> = {}): string {
  return render({ workspace: { current_dir: box.store.root }, ...extra }, { colours: false });
}

test("a stale verdict is called out, because that is the only signal this file exists for", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));
  const old = box.sha;
  box.commit();
  record(box.store, {
    target: "storage-layer",
    sha: old,
    verdict: "test-verified",
    evidence: "suite green",
    verifier: "test",
  });

  const line = plain(box);
  assert.match(line, /verdict stale/);
  assert.doesNotMatch(line, /test-verified/, "a voided row must not be rendered as if it still counted");
  box.dispose();
});

test("a verdict at the current head is rendered as passing", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "verifying" })]));
  record(box.store, {
    target: "storage-layer",
    sha: box.sha,
    verdict: "test-verified",
    evidence: "suite green",
    verifier: "test",
  });

  assert.match(plain(box), /test-verified/);
  box.dispose();
});

test("an active item with no ledger row at all reads as unverified, not as stale", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));

  const line = plain(box);
  assert.match(line, /unverified/);
  assert.doesNotMatch(line, /stale/);
  box.dispose();
});

test("a verdict below the bar is shown by name rather than as a pass", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "verifying" })]));
  record(box.store, {
    target: "storage-layer",
    sha: box.sha,
    verdict: "type-check-only",
    evidence: "tsc clean",
    verifier: "test",
  });

  assert.match(plain(box), /type-check-only/);
  box.dispose();
});

test("no active item reports the pending count instead of inventing one", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "pending" }), item({ id: 2, slug: "cli-search", status: "pending" })]));

  assert.match(plain(box), /idle, 2 pending/);
  box.dispose();
});

test("more than one active item is surfaced, not hidden behind the first one", () => {
  const box = sandbox();
  box.writeState(
    state([item({ status: "in_progress" }), item({ id: 2, slug: "cli-search", status: "reviewing" })]),
  );

  const line = plain(box);
  assert.match(line, /2 active items/);
  assert.doesNotMatch(line, /storage-layer/, "picking one of two would report a violation as normal work");
  box.dispose();
});

test("an unreadable state file says so rather than rendering a confident empty line", () => {
  const box = sandbox();
  execFileSync("sh", ["-c", `printf '{' > ${JSON.stringify(box.store.state)}`]);

  assert.match(plain(box), /state\.json unreadable/);
  box.dispose();
});

test("a directory with no store is distinguished from a store with nothing in it", () => {
  const line = render({ workspace: { current_dir: "/" } }, { colours: false });
  assert.match(line, /no \.mstack/);
});

test("NO_COLOR leaves no escape sequence anywhere, separators included", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));

  const line = plain(box, { model: { display_name: "Opus" }, context_window: { used_percentage: 42 } });
  assert.ok(!line.includes(ESC), `expected no escapes, got ${JSON.stringify(line)}`);
  box.dispose();
});

test("truncation counts printable characters, so colour never eats width", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));
  const input = { workspace: { current_dir: box.store.root }, model: { display_name: "Opus" } };

  const coloured = render(input, { colours: true, columns: 24 });
  const visible = coloured.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");
  assert.equal([...visible].length, 24, `got ${JSON.stringify(visible)}`);
  assert.ok(coloured.endsWith(`${ESC}[0m…`), "a truncated line must still reset the terminal colour");

  const bare = render(input, { colours: false, columns: 24 });
  assert.equal([...bare].length, 24);
  box.dispose();
});

test("a line that already fits is left alone", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));
  const input = { workspace: { current_dir: box.store.root } };

  assert.equal(render(input, { colours: false, columns: 400 }), render(input, { colours: false }));
  box.dispose();
});

test("hostile stdin yields an empty payload rather than throwing", () => {
  for (const raw of ["", "not json", "null", "[]", "3", '{"model":']) {
    assert.doesNotThrow(() => parseInput(raw), `parseInput(${JSON.stringify(raw)}) threw`);
  }
  assert.deepEqual(parseInput("null"), {});
  assert.deepEqual(parseInput("3"), {});
});

test("the model name comes from the payload and is dropped when absent", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));

  assert.match(plain(box, { model: { display_name: "Opus" } }), /^Opus/);
  assert.doesNotMatch(plain(box), /^Opus/);
  assert.doesNotMatch(plain(box, { model: { display_name: "" } }), /^ ·/);
  box.dispose();
});

test("context percentage is rounded and omitted when the field is null", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));

  assert.match(plain(box, { context_window: { used_percentage: 41.6 } }), /ctx 42%/);
  assert.doesNotMatch(plain(box, { context_window: { used_percentage: null } }), /ctx/);
  assert.doesNotMatch(plain(box, { context_window: {} }), /ctx/);
  box.dispose();
});

test("a subagent row is emitted only for a role mstack has a report contract with", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));

  const rows = renderSubagents(
    {
      cwd: box.store.root,
      tasks: [
        { id: "a", type: "mstack:implementer" },
        { id: "b", type: "Explore" },
        { id: "c", type: "general-purpose" },
      ],
    },
    { colours: false },
  );

  assert.deepEqual(
    rows.map((r) => r.id),
    ["a"],
    "overriding a row we know nothing about would replace Claude Code's default with something worse",
  );
  box.dispose();
});

test("a worker that has not written its report says so while there is still time to fix it", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));

  const before = renderSubagents(
    { cwd: box.store.root, tasks: [{ id: "a", type: "mstack:implementer" }] },
    { colours: false },
  );
  assert.match(before[0]!.content, /no impl report yet/);

  writeFileSync(join(box.store.progress, "impl_storage-layer.md"), "x".repeat(80), "utf8");
  const after = renderSubagents(
    { cwd: box.store.root, tasks: [{ id: "a", type: "mstack:implementer" }] },
    { colours: false },
  );
  assert.match(after[0]!.content, /impl report written/);
  box.dispose();
});

test("an essentially empty report is not a report, matching the SubagentStop floor", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));
  writeFileSync(join(box.store.progress, "impl_storage-layer.md"), "# impl\n", "utf8");

  const rows = renderSubagents(
    { cwd: box.store.root, tasks: [{ id: "a", type: "mstack:implementer" }] },
    { colours: false },
  );
  assert.match(rows[0]!.content, /no impl report yet/);
  box.dispose();
});

test("a bare role name is treated the same as a plugin-qualified one", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));

  const rows = renderSubagents(
    { cwd: box.store.root, tasks: [{ id: "a", type: "reviewer" }] },
    { colours: false },
  );
  assert.equal(rows.length, 1, "a project-level agent file overrides the plugin one and keeps the same contract");
  box.dispose();
});

test("a task with no id is skipped, because the contract keys rows by id", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));

  const rows = renderSubagents(
    { cwd: box.store.root, tasks: [{ type: "mstack:implementer" }] },
    { colours: false },
  );
  assert.deepEqual(rows, []);
  box.dispose();
});

test("token counts are compacted without pretending to precision they do not have", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));
  const row = (tokenCount: number) =>
    renderSubagents(
      { cwd: box.store.root, tasks: [{ id: "a", type: "mstack:implementer", tokenCount }] },
      { colours: false },
    )[0]!.content;

  assert.match(row(940), /· 940$/);
  assert.match(row(3200), /· 3\.2k$/);
  assert.match(row(12400), /· 12k$/);
  assert.doesNotMatch(row(0), /· 0$/);
  box.dispose();
});

test("no tasks and no store both yield no rows rather than an error", () => {
  assert.deepEqual(renderSubagents({}, { colours: false }), []);
  assert.deepEqual(renderSubagents({ tasks: [] }, { colours: false }), []);
  assert.deepEqual(
    renderSubagents({ cwd: "/", tasks: [{ id: "a", type: "mstack:implementer" }] }, { colours: false }),
    [{ id: "a", content: "implementer" }],
    "outside a store the role is still worth showing; the report claim is not",
  );
});

test("a verdict that exists at HEAD is reported as itself, however bad it is", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "verifying" })]));
  // The ordinary sequence: verify, commit, verify again, fail. Testing
  // staleness before the verdict-at-HEAD branch made this render "verdict
  // stale" — telling the reader nobody had verified this, when the truth was
  // the verifier ran here and failed.
  const old = box.sha;
  const head = box.commit();
  record(box.store, {
    target: "storage-layer",
    sha: old,
    verdict: "test-verified",
    evidence: "green then",
    verifier: "test",
  });
  record(box.store, {
    target: "storage-layer",
    sha: head,
    verdict: "verifier-failed",
    evidence: "3 tests failed here",
    verifier: "test",
  });

  const line = plain(box);
  assert.match(line, /verifier-failed/);
  assert.doesNotMatch(line, /stale/, "a row does exist at HEAD; it just says the verifier failed");
  box.dispose();
});

test("the stale marker carries no count, because the count was of history", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));
  for (let i = 0; i < 5; i += 1) {
    const at = box.sha === undefined ? box.commit() : box.commit();
    record(box.store, {
      target: "storage-layer",
      sha: at,
      verdict: "test-verified",
      evidence: "green at that commit",
      verifier: "test",
    });
  }
  box.commit(); // move HEAD past every row above
  // `stale.length` is every row at any other SHA, so it grew with the age of
  // the item. Five verified commits read as "stale (5)" and meant nothing.
  assert.match(plain(box), /verdict stale(?! \()/);
  box.dispose();
});

test("a blocked item is shown, not reported as idle", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "blocked" })]));
  // `blocked` is not an active status, so it fell through to the idle branch:
  // the status line said the opposite of the truth about the one state where a
  // human is required.
  const line = plain(box);
  assert.match(line, /#1 storage-layer/);
  assert.match(line, /blocked/);
  assert.doesNotMatch(line, /idle/);
  box.dispose();
});

test("several blocked items are counted rather than one of them chosen silently", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "blocked" }), item({ id: 2, slug: "two", status: "blocked" })]));
  assert.match(plain(box), /2 blocked/);
  box.dispose();
});

test("an unreadable ledger degrades to a message, the way an unreadable state file does", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));
  rmSync(box.store.ledger);
  mkdirSync(box.store.ledger); // a directory where a file belongs: read throws EISDIR

  const line = plain(box, { model: { display_name: "Opus" } });
  assert.match(line, /ledger unreadable/);
  assert.match(line, /Opus/, "everything computed before the ledger must survive it");
  assert.match(line, /#1 storage-layer/);
  box.dispose();
});

test("the rows refuse to name an item when the bar refuses to pick one", () => {
  const box = sandbox();
  box.writeState(
    state([item({ status: "in_progress" }), item({ id: 2, slug: "two", status: "reviewing" })]),
  );
  // The bar reports "2 active items"; the rows used to pick the first silently
  // and print its slug beside every worker, so the two halves of this file
  // confidently disagreed on the same screen.
  assert.match(plain(box), /2 active items/);
  const rows = renderSubagents(
    { cwd: box.store.root, tasks: [{ id: "a", type: "mstack:implementer" }] },
    { colours: false },
  );
  assert.deepEqual(rows, [{ id: "a", content: "implementer" }]);
  box.dispose();
});

test("one unreadable entry in progress/ does not take the whole panel with it", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "reviewing" })]));
  writeFileSync(join(box.store.progress, "review_storage-layer_ok.md"), "x".repeat(90), "utf8");
  // A dangling symlink stands in for the real risk: parallel writers replace
  // these files while this reads them, so a path can vanish between the
  // readdir and the stat. An unguarded stat threw out of the whole call.
  symlinkSync(join(box.store.progress, "nowhere.md"), join(box.store.progress, "review_storage-layer_gone.md"));

  const rows = renderSubagents(
    { cwd: box.store.root, tasks: [{ id: "a", type: "mstack:reviewer" }] },
    { colours: false },
  );
  assert.equal(rows.length, 1, "the healthy row must survive its broken sibling");
  assert.match(rows[0]!.content, /review report written/);
  box.dispose();
});

test("two reports read as two, not as one", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "reviewing" })]));
  for (const lens of ["correctness", "security"]) {
    writeFileSync(join(box.store.progress, `review_storage-layer_${lens}.md`), "x".repeat(90), "utf8");
  }
  const rows = renderSubagents(
    { cwd: box.store.root, tasks: [{ id: "a", type: "mstack:reviewer" }] },
    { colours: false },
  );
  assert.match(rows[0]!.content, /2 review reports/);
  box.dispose();
});

test("a store with nothing active is not the same row as no store at all", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "pending" })]));
  const rows = renderSubagents(
    { cwd: box.store.root, tasks: [{ id: "a", type: "mstack:implementer" }] },
    { colours: false },
  );
  assert.deepEqual(rows, [{ id: "a", content: "implementer" }]);
  box.dispose();
});

test("parseInput rejects an array, which is an object to typeof but not a payload", () => {
  assert.deepEqual(parseInput("[]"), {});
  assert.deepEqual(parseInput('[{"model":{"display_name":"Opus"}}]'), {});
  assert.ok(!Array.isArray(parseInput("[]")));
});

test("truncation splits between characters, never inside one", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));
  // git permits emoji in ref names, so this needs no hostile input. Counting
  // UTF-16 code units left a lone surrogate, which reaches a terminal as U+FFFD
  // and JSON.stringify as a malformed escape.
  const input = { workspace: { current_dir: box.store.root }, model: { display_name: "A\u{1F680}B" } };
  for (let columns = 2; columns <= 12; columns += 1) {
    const line = render(input, { colours: false, columns });
    assert.ok(!line.includes("\uFFFD"), `columns=${columns} produced a replacement character`);
    for (const ch of line) assert.ok(ch.codePointAt(0)! < 0xd800 || ch.codePointAt(0)! > 0xdfff, `lone surrogate at columns=${columns}`);
    assert.ok([...line].length <= columns, `columns=${columns} overflowed: ${[...line].length}`);
  }
  box.dispose();
});

test("the colours are the message, so each one is pinned", () => {
  const GREEN = `${ESC}[32m`;
  const YELLOW = `${ESC}[33m`;
  const RED = `${ESC}[31m`;
  const CYAN = `${ESC}[36m`;

  // Swapping the passing-verdict colour from green to red left all 21 tests of
  // the original suite green. Every test either forced colours off or checked
  // only the width, so the one thing a status line communicates at a glance was
  // the one thing nothing verified.
  const coloured = (box: ReturnType<typeof sandbox>, extra: Record<string, unknown> = {}) =>
    render({ workspace: { current_dir: box.store.root }, ...extra }, { colours: true });

  const pass = sandbox();
  pass.writeState(state([item({ status: "verifying" })]));
  record(pass.store, {
    target: "storage-layer",
    sha: pass.sha,
    verdict: "test-verified",
    evidence: "the suite ran green",
    verifier: "t",
  });
  assert.ok(coloured(pass, { model: { display_name: "Opus" } }).includes(`${CYAN}Opus`), "model is cyan");
  assert.ok(coloured(pass).includes(`${GREEN}test-verified`), "a passing verdict is green");
  assert.ok(coloured(pass).includes(`${YELLOW}verifying`), "an in-flight status is yellow");
  pass.dispose();

  const failed = sandbox();
  failed.writeState(state([item({ status: "verifying" })]));
  record(failed.store, {
    target: "storage-layer",
    sha: failed.sha,
    verdict: "verifier-failed",
    evidence: "3 tests failed here",
    verifier: "t",
  });
  assert.ok(coloured(failed).includes(`${RED}verifier-failed`), "a failed verifier is red");
  failed.dispose();

  const weak = sandbox();
  weak.writeState(state([item({ status: "verifying" })]));
  record(weak.store, {
    target: "storage-layer",
    sha: weak.sha,
    verdict: "type-check-only",
    evidence: "tsc --noEmit clean",
    verifier: "t",
  });
  assert.ok(coloured(weak).includes(`${YELLOW}type-check-only`), "a verdict below the bar is yellow, not green");
  weak.dispose();

  const stale = sandbox();
  stale.writeState(state([item({ status: "in_progress" })]));
  const staleAt = stale.sha;
  stale.commit();
  record(stale.store, {
    target: "storage-layer",
    sha: staleAt,
    verdict: "test-verified",
    evidence: "green then",
    verifier: "t",
  });
  assert.ok(coloured(stale).includes(`${RED}verdict stale`), "a voided verdict is red");
  stale.dispose();

  const blocked = sandbox();
  blocked.writeState(state([item({ status: "blocked" })]));
  assert.ok(coloured(blocked).includes(`${RED}blocked`), "blocked is red");
  blocked.dispose();

  const two = sandbox();
  two.writeState(state([item({ status: "in_progress" }), item({ id: 2, slug: "two", status: "reviewing" })]));
  assert.ok(coloured(two).includes(`${RED}2 active items`), "an invariant violation is red");
  two.dispose();
});

test("the context gauge changes colour as it fills", () => {
  const box = sandbox();
  box.writeState(state([item({ status: "in_progress" })]));
  const at = (used: number) =>
    render({ workspace: { current_dir: box.store.root }, context_window: { used_percentage: used } }, { colours: true });

  assert.ok(at(20).includes(`${ESC}[2mctx 20%`), "dim below 60");
  assert.ok(at(65).includes(`${ESC}[33mctx 65%`), "yellow from 60");
  assert.ok(at(85).includes(`${ESC}[31mctx 85%`), "red from 80");
  box.dispose();
});
