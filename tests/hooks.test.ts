import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { postEdit, preToolUse, readInput, sessionStart, stop, subagentStop } from "../src/hooks.ts";
import { item, sandbox, state } from "./helpers.ts";

const decisionOf = (json: string | null) =>
  json === null ? null : (JSON.parse(json).hookSpecificOutput.permissionDecision as string);
const contextOf = (json: string | null) =>
  json === null ? null : (JSON.parse(json).hookSpecificOutput.additionalContext as string);

test("the destructive-command guard denies what it should and nothing more", () => {
  const cases: readonly [string, "deny" | null][] = [
    ["git push --force origin main", "deny"],
    ["git push -f origin main", "deny"],
    // The safe form the guard's own message recommends must not be denied.
    // `\b` matches between "e" and "-", so a naive `--force\b` also fires here.
    ["git push --force-with-lease origin feat/x", null],
    ["git push origin main", null],
    ["git reset --hard HEAD~1", "deny"],
    ["git reset --soft HEAD~1", null],
    ["git branch -D old", "deny"],
    ["git branch -d old", null],
    ["gh pr merge 12 --admin --squash", "deny"],
    ["gh pr merge 12 --squash", null],
    ["rm -rf .mstack", "deny"],
    ["rm -rf node_modules", null],
  ];
  for (const [command, expected] of cases) {
    const out = preToolUse({ tool_name: "Bash", tool_input: { command } });
    assert.equal(decisionOf(out), expected, `wrong verdict for: ${command}`);
  }
});

test("the guard ignores every tool that is not Bash", () => {
  assert.equal(preToolUse({ tool_name: "Write", tool_input: { command: "git push --force" } }), null);
});

test("a hook that is handed garbage produces an empty object rather than throwing", () => {
  assert.deepEqual(readInput("not json"), {});
  assert.deepEqual(readInput("[1,2]"), [1, 2] as never);
});

test("SessionStart re-injects the active item after a resume", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    const text = contextOf(sessionStart({ cwd: sb.store.root }));
    assert.match(text ?? "", /storage-layer/);
    assert.match(text ?? "", /in_progress/);
  } finally {
    sb.dispose();
  }
});

test("SessionStart surfaces decision_required, because that is the human gate", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "specifying", decision_required: "per-tenant or global quota?" })]));
    assert.match(contextOf(sessionStart({ cwd: sb.store.root })) ?? "", /per-tenant or global quota/);
  } finally {
    sb.dispose();
  }
});

test("SessionStart outside an mstack repo says nothing at all", () => {
  assert.equal(sessionStart({ cwd: "/" }), null);
});

test("SubagentStop catches a subagent that returned without writing its report", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    // The parent never sees a subagent's reply body. A reply is not evidence.
    const missing = contextOf(subagentStop({ cwd: sb.store.root, agent_type: "mstack:implementer" }));
    assert.match(missing ?? "", /without writing/);

    writeFileSync(join(sb.store.progress, "impl_storage-layer.md"), "", "utf8");
    assert.match(contextOf(subagentStop({ cwd: sb.store.root, agent_type: "mstack:implementer" })) ?? "", /essentially empty/);

    writeFileSync(join(sb.store.progress, "impl_storage-layer.md"), "# Implementation\n\nFiles touched: src/storage.ts\n", "utf8");
    assert.equal(subagentStop({ cwd: sb.store.root, agent_type: "mstack:implementer" }), null);
  } finally {
    sb.dispose();
  }
});

test("SubagentStop ignores agents that owe no report", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })]));
    assert.equal(subagentStop({ cwd: sb.store.root, agent_type: "Explore" }), null);
  } finally {
    sb.dispose();
  }
});

test("Stop reports a red gate as feedback rather than a block", () => {
  const sb = sandbox();
  try {
    sb.writeState({ version: 1, project: "sandbox", rules: {}, items: {} });
    const out = stop({ cwd: sb.store.root });
    assert.match(contextOf(out) ?? "", /gate is red/);
    assert.equal(JSON.parse(out ?? "{}").decision, undefined, "must not use decision:block");
  } finally {
    sb.dispose();
  }
});

test("Stop stands down once it has already fired, so it cannot loop", () => {
  const sb = sandbox();
  try {
    sb.writeState({ version: 1, project: "sandbox", rules: {}, items: {} });
    assert.equal(stop({ cwd: sb.store.root, stop_hook_active: true }), null);
  } finally {
    sb.dispose();
  }
});

test("Stop is silent when the gate is green", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item()]));
    assert.equal(stop({ cwd: sb.store.root }), null);
  } finally {
    sb.dispose();
  }
});

test("PostToolUse notices a state file that stopped validating", () => {
  const sb = sandbox();
  try {
    writeFileSync(sb.store.state, "{ broken", "utf8");
    const out = postEdit({ cwd: sb.store.root, tool_input: { file_path: sb.store.state } });
    assert.match(contextOf(out) ?? "", /no longer validates/);
  } finally {
    sb.dispose();
  }
});

test("PostToolUse defends the append-only log", () => {
  const sb = sandbox();
  try {
    assert.match(
      contextOf(postEdit({ cwd: sb.store.root, tool_input: { file_path: sb.store.history } })) ?? "",
      /append-only/,
    );
  } finally {
    sb.dispose();
  }
});

test("SubagentStop accepts a per-lens report, because the review panel runs in parallel", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "reviewing" })]));
    const body = "# Review\n\nVerdict: APPROVED. See src/storage.ts:12.\n";

    // A single shared filename would have parallel reviewers overwrite each
    // other, so the contract is the prefix. A hook that demanded the exact name
    // would accuse the reviewer doing the right thing.
    writeFileSync(join(sb.store.progress, "review_storage-layer_correctness.md"), body, "utf8");
    assert.equal(subagentStop({ cwd: sb.store.root, agent_type: "mstack:reviewer" }), null);

    // ...and one empty lens is still a missing report, even beside a full one.
    writeFileSync(join(sb.store.progress, "review_storage-layer_security.md"), "", "utf8");
    assert.match(
      contextOf(subagentStop({ cwd: sb.store.root, agent_type: "mstack:reviewer" })) ?? "",
      /review_storage-layer_security\.md exists but is essentially empty/,
    );
  } finally {
    sb.dispose();
  }
});

test("a neighbouring slug's report does not satisfy this item's contract", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ slug: "cli", status: "reviewing" })]));
    writeFileSync(join(sb.store.progress, "review_cli-search_correctness.md"), "x".repeat(80), "utf8");

    assert.match(
      contextOf(subagentStop({ cwd: sb.store.root, agent_type: "mstack:reviewer" })) ?? "",
      /without writing/,
      "prefix matching must respect the separator, or 'cli' would claim 'cli-search' work as its own",
    );
  } finally {
    sb.dispose();
  }
});
