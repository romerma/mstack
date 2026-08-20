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
    // The analysis lives in the subagent's working context, which the parent
    // never sees. A reply is not evidence.
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

/**
 * A guard that matches a spelling rather than an operation is a guard with a
 * synonym for a hole. Every DENY row below was a live evasion at some point.
 */
const DENY: readonly [string, string][] = [
  ["git push --force origin main", "the plain form"],
  ["git push -f origin main", "the short flag"],
  ["git push origin main --force", "the flag after the refspec"],
  ["git  push   --force  origin", "extra whitespace"],
  ["cd /tmp && git push --force origin main", "inside a compound command"],
  ["git -C /repo push --force origin main", "a global option between git and push"],
  ["git -c protocol.version=2 push --force origin main", "-c is the same hole as -C"],
  ["git --git-dir=/x/.git push --force origin main", "--git-dir is the same hole again"],
  ["git push origin +main", "a leading + on a refspec IS a force push"],
  ["git push origin +HEAD:main", "the same, spelled as a full refspec"],
  ["git reset --hard HEAD~3", "the plain form"],
  ["git -C /repo reset --hard", "with a global option"],
  ["git branch -D feature", "the short flag"],
  ["git branch --delete --force feature", "the long spelling of -D"],
  ["git branch --force --delete feature", "the same two flags, reversed"],
  ["git branch -d --force feature", "-d with --force is -D spelled apart"],
  ["git branch --force -d feature", "and the same pair reversed"],
  ["gh pr merge 3 --admin", "merging past a check"],
  ["rm -rf .mstack", "the durable state"],
  ["rm -rf .mstack*", "a glob reaching the same directory"],
  ["rm -rf ./.mstac?", "a single-character wildcard reaching it too"],
];

const ALLOW: readonly [string, string][] = [
  ["git push --force-with-lease origin main", "the safe form the guard recommends"],
  ["git push --force-with-lease=main:abc123 origin", "with an explicit expected value"],
  ["git push origin main", "an ordinary push"],
  ["git push origin --set-upstream main", "a flag that is not a force"],
  ["git branch -d feature", "the refusing delete"],
  ["git branch --delete feature", "its long spelling"],
  ["git branch -a", "listing branches"],
  ["git branch --list 'feat/*'", "listing with a pattern"],
  ["git branch feature", "creating one"],
  ["git reset --soft HEAD~1", "a reset that keeps the work"],
  ["git reset HEAD~1", "a mixed reset"],
  ["gh pr merge 3 --squash", "an ordinary merge"],
  ["rm -rf node_modules", "something that is not the store"],
  ["rm -rf dist", "likewise"],
];

function denied(command: string): boolean {
  const output = preToolUse({ tool_name: "Bash", tool_input: { command }, cwd: process.cwd() });
  return output !== null && output.includes('"deny"');
}

test("every irreversible operation is denied however it is spelled", () => {
  for (const [command, why] of DENY) {
    assert.ok(denied(command), `should be denied (${why}): ${command}`);
  }
});

test("the safe forms are not denied, including the one the guard recommends", () => {
  for (const [command, why] of ALLOW) {
    assert.ok(!denied(command), `should be allowed (${why}): ${command}`);
  }
});
