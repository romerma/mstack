import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
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
  record(box.store, {
    target: "storage-layer",
    sha: "a".repeat(40),
    verdict: "test-verified",
    evidence: "suite green",
    verifier: "test",
  });

  const line = plain(box);
  assert.match(line, /verdict stale \(1\)/);
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
