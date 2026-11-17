import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closingProblems } from "../src/closing.ts";
import { parseState } from "../src/state.ts";
import { item, quiesce, recordReceipt, sandbox, state, trackCurrent } from "./helpers.ts";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "mstack");

function cli(cwd: string, args: string[]) {
  const r = spawnSync(BIN, args, { cwd, encoding: "utf8" });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

test("closingProblems, the gate and state set agree that an unrun verification blocks closing", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    const sha = quiesce(sb);
    const st = parseState(sb.store.state);
    const it = st.items[0]!;

    const problems = closingProblems(sb.store, st, it);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /`pytest -q` has never been executed/);

    const gate = cli(sb.store.root, ["gate"]);
    assert.equal(gate.code, 1, gate.stdout);
    assert.ok(gate.stdout.includes(`one step from done, and ${problems[0]!.message}`), gate.stdout);

    const refused = cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]);
    assert.equal(refused.code, 2, refused.stdout);
    assert.ok(refused.stderr.includes(problems[0]!.message), refused.stderr);

    recordReceipt(sb, { target: "storage-layer", sha, command: "pytest -q", outcome: "passed" });
    assert.deepEqual(closingProblems(sb.store, st, it), []);
    assert.equal(cli(sb.store.root, ["gate"]).code, 0);
    assert.equal(cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]).code, 0);
  } finally {
    sb.dispose();
  }
});

test("an unreadable receipt file is a problem, not a throw, and is the one --force does not override", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying", verification: "pytest -q" })]));
    trackCurrent(sb);
    mkdirSync(sb.store.verification);
    const st = parseState(sb.store.state);
    const problems = closingProblems(sb.store, st, st.items[0]!);
    assert.equal(problems.length, 1);
    assert.equal(problems[0]!.overridable, false);
    assert.equal(problems[0]!.check, "verification");
    assert.match(problems[0]!.message, /EISDIR|illegal operation on a directory/i);

    const forced = cli(sb.store.root, [
      "state", "set", "storage-layer", "--status", "done", "--force", "--closed-by", "why",
    ]);
    assert.equal(forced.code, 2, forced.stdout);
    assert.match(forced.stderr, /verification runs could not be read/);
  } finally {
    sb.dispose();
  }
});

/**
 * The reviewer's probe. With one member in `CLOSING_CHECKS` "the gate and state
 * set cannot disagree" is trivially true, because both reach the same function
 * through the verification check. It is only a claim once a second member exists,
 * and item 41 adds one. This registers a fake second check in a child process
 * (the CLI is a program, not a library) and asks both surfaces about an item that
 * has no verification command at all, where the old gate went quiet.
 */
function cliWithSecondCheck(cwd: string, args: string[], overridable: boolean, reportedAt = ["verifying"]) {
  const dir = mkdtempSync(join(tmpdir(), "mstack-closing-"));
  const boot = join(dir, "boot.mts");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
  writeFileSync(
    boot,
    `import { CLOSING_CHECKS } from ${JSON.stringify(join(root, "closing.ts"))};
CLOSING_CHECKS.push({
  name: "second",
  reportedAt: ${JSON.stringify(reportedAt)},
  run: () => [{ check: "second", message: "a second closing check is not satisfied", hint: "satisfy the second check", overridable: ${overridable} }],
});
await import(${JSON.stringify(join(root, "cli.ts"))});
`,
  );
  try {
    const flags = typeof (globalThis as { Bun?: unknown }).Bun === "undefined"
      ? ["--experimental-strip-types", "--disable-warning=ExperimentalWarning"]
      : [];
    const r = spawnSync(process.execPath, [...flags, boot, ...args], { cwd, encoding: "utf8" });
    return { code: r.status, stdout: r.stdout, stderr: r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a second closing check is seen by the gate and refused by state set, with no verification command", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying" })], { verify: "" }));
    trackCurrent(sb);
    quiesce(sb);

    // Control: with only the verification check, nothing blocks and the gate passes.
    assert.equal(cli(sb.store.root, ["gate"]).code, 0);

    const gate = cliWithSecondCheck(sb.store.root, ["gate"], true);
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /storage-layer.*one step from done, and a second closing check is not satisfied/);
    assert.match(gate.stdout, /satisfy the second check/);

    const refused = cliWithSecondCheck(sb.store.root, ["state", "set", "storage-layer", "--status", "done"], true);
    assert.equal(refused.code, 2, refused.stdout);
    assert.match(refused.stderr, /storage-layer cannot close: a second closing check is not satisfied/);
    assert.doesNotMatch(refused.stderr, /verification that has not run/);
    assert.equal(parseState(sb.store.state).items[0]?.status, "verifying");

    const noReason = cliWithSecondCheck(
      sb.store.root, ["state", "set", "storage-layer", "--status", "done", "--force"], true,
    );
    assert.equal(noReason.code, 2);
    assert.match(noReason.stderr, /--closed-by/);

    const forced = cliWithSecondCheck(
      sb.store.root, ["state", "set", "storage-layer", "--status", "done", "--force", "--closed-by", "because"], true,
    );
    assert.equal(forced.code, 0, forced.stderr);
    assert.match(parseState(sb.store.state).items[0]?.closed_by ?? "", /^closed unverified \(forced\): /);
  } finally {
    sb.dispose();
  }
});

test("a check that is not overridable stays closed under --force", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying" })], { verify: "" }));
    trackCurrent(sb);
    const forced = cliWithSecondCheck(
      sb.store.root, ["state", "set", "storage-layer", "--status", "done", "--force", "--closed-by", "because"], false,
    );
    assert.equal(forced.code, 2, forced.stdout);
    assert.match(forced.stderr, /cannot close: a second closing check is not satisfied/);
    assert.equal(parseState(sb.store.state).items[0]?.status, "verifying");
  } finally {
    sb.dispose();
  }
});

test("at verifying the gate reports every check, whatever its reportedAt says", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying" })], { verify: "" }));
    trackCurrent(sb);
    quiesce(sb);
    const gate = cliWithSecondCheck(sb.store.root, ["gate"], true, ["reviewing"]);
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /one step from done, and a second closing check is not satisfied/);
    const refused = cliWithSecondCheck(sb.store.root, ["state", "set", "storage-layer", "--status", "done"], true, ["reviewing"]);
    assert.equal(refused.code, 2, refused.stdout);
    assert.match(refused.stderr, /cannot close: a second closing check is not satisfied/);
  } finally {
    sb.dispose();
  }
});

test("a check reporting before verifying does not claim the item is one step from done", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "in_progress" })], { verify: "" }));
    trackCurrent(sb);
    quiesce(sb);
    const gate = cliWithSecondCheck(sb.store.root, ["gate"], true, ["in_progress"]);
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /\(in_progress\) cannot close as it stands, and a second closing check is not satisfied/);
    assert.doesNotMatch(gate.stdout, /one step from done/);
  } finally {
    sb.dispose();
  }
});

// ---- item 70: the ledger verdict is a closing check, so all three surfaces refuse a standing rejection ----

test("a standing rejection is refused by closingProblems, the gate and state set, and named in each", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying" })], { verify: "" }));
    trackCurrent(sb);
    const sha = quiesce(sb);
    const rec = (verdict: string, evidence: string, verifier = "reviewer") => {
      const r = cli(sb.store.root, ["ledger", "record", "storage-layer", sha, verdict, "--evidence", evidence, "--verifier", verifier]);
      assert.equal(r.code, 0, r.stderr);
    };
    rec("test-verified", ".mstack/progress/impl_storage-layer.md", "implementer");
    rec("test-verified", "review_demo.md");
    rec("verifier-failed", ".mstack/progress/review_storage-layer_r2.md; the claims in impl_storage-layer.md do not hold");

    const st = parseState(sb.store.state);
    const problems = closingProblems(sb.store, st, st.items[0]!);
    assert.equal(problems.length, 1);
    assert.equal(problems[0]!.check, "ledger-verdict");
    assert.equal(problems[0]!.overridable, false, "--force cannot vouch over a rejection: the gate would still fail the closed item");
    assert.match(problems[0]!.message, /verifier-failed at \w{8} by reviewer/);
    assert.match(problems[0]!.message, /review_storage-layer_r2\.md/);

    const gate = cli(sb.store.root, ["gate"]);
    assert.equal(gate.code, 1, gate.stdout);
    assert.ok(gate.stdout.includes(`one step from done, and ${problems[0]!.message}`), gate.stdout);

    const refused = cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]);
    assert.equal(refused.code, 2, refused.stdout);
    assert.ok(refused.stderr.includes(`storage-layer cannot close: ${problems[0]!.message}`), refused.stderr);

    const forced = cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done", "--force", "--closed-by", "why"]);
    assert.equal(forced.code, 2, forced.stdout);
    assert.equal(parseState(sb.store.state).items[0]?.status, "verifying");

    // A verifier-blocked after the failure does not answer it.
    rec("verifier-blocked", "could not re-run the suite here");
    assert.equal(cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]).code, 2);

    // A later independent approval does.
    rec("test-verified", ".mstack/progress/review_storage-layer_r3.md");
    assert.deepEqual(closingProblems(sb.store, st, st.items[0]!), []);
    assert.equal(cli(sb.store.root, ["gate"]).code, 0);
    assert.equal(cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]).code, 0);
  } finally {
    sb.dispose();
  }
});

test("a lone verifier-blocked row does not stop state set from closing", () => {
  const sb = sandbox();
  try {
    sb.writeState(state([item({ status: "verifying" })], { verify: "" }));
    trackCurrent(sb);
    const sha = quiesce(sb);
    const r = cli(sb.store.root, ["ledger", "record", "storage-layer", sha, "verifier-blocked", "--evidence", "no harness in this repo", "--verifier", "reviewer"]);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]).code, 0);
  } finally {
    sb.dispose();
  }
});

// ---- item 70 round 2: the verdict is judged AT the sha being closed, and across the item's rows ----

/** A verifying item whose repository has two commits: `old` (HEAD~1) and `head` (what would be closed). */
function twoShaStore() {
  const sb = sandbox();
  sb.writeState(state([item({ status: "verifying" })], { verify: "" }));
  trackCurrent(sb);
  const old = sb.sha;
  const head = quiesce(sb);
  assert.notEqual(old, head);
  const rec = (sha: string, verdict: string, evidence: string, verifier = "reviewer") => {
    const r = cli(sb.store.root, ["ledger", "record", "storage-layer", sha, verdict, "--evidence", evidence, "--verifier", verifier]);
    assert.equal(r.code, 0, r.stderr);
  };
  const problems = () => {
    const st = parseState(sb.store.state);
    return closingProblems(sb.store, st, st.items[0]!);
  };
  return { sb, old, head, rec, problems };
}

test("a rejection at the closing sha is not answered by an approval of an older commit recorded after it", () => {
  const { sb, old, head, rec, problems } = twoShaStore();
  try {
    rec(head, "verifier-failed", ".mstack/progress/review_storage-layer.md");
    rec(old, "test-verified", ".mstack/progress/review_storage-layer_old.md");

    const found = problems();
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.equal(found[0]!.check, "ledger-verdict");
    assert.equal(found[0]!.overridable, false);
    assert.match(found[0]!.message, new RegExp(`verifier-failed at ${head.slice(0, 8)} by reviewer`));

    const gate = cli(sb.store.root, ["gate"]);
    assert.equal(gate.code, 1, gate.stdout);
    assert.ok(gate.stdout.includes(`one step from done, and ${found[0]!.message}`), gate.stdout);

    const refused = cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]);
    assert.equal(refused.code, 2, refused.stdout);
    assert.ok(refused.stderr.includes(`storage-layer cannot close: ${found[0]!.message}`), refused.stderr);
    const forced = cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done", "--force", "--closed-by", "why"]);
    assert.equal(forced.code, 2, forced.stdout);
    assert.equal(parseState(sb.store.state).items[0]?.status, "verifying");
  } finally {
    sb.dispose();
  }
});

test("a rejection recorded later against an older commit still refuses the close, and says it is at another commit", () => {
  const { sb, old, head, rec, problems } = twoShaStore();
  try {
    rec(head, "test-verified", ".mstack/progress/review_storage-layer.md");
    rec(old, "verifier-failed", ".mstack/progress/review_storage-layer_old.md");

    const found = problems();
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.match(found[0]!.message, new RegExp(`verifier-failed at ${old.slice(0, 8)} by reviewer`));
    assert.match(found[0]!.message, /another commit/);

    const refused = cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]);
    assert.equal(refused.code, 2, refused.stdout);
    assert.match(refused.stderr, /another commit/);
    assert.equal(cli(sb.store.root, ["gate"]).code, 1);

    // Answered by a later independent approval at the closing sha: closes.
    rec(head, "test-verified", ".mstack/progress/review_storage-layer_r2.md");
    assert.deepEqual(problems(), []);
    assert.equal(cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]).code, 0);
  } finally {
    sb.dispose();
  }
});

test("a rejection at an older commit followed by an approval at the closing sha recorded later closes", () => {
  const { sb, old, head, rec, problems } = twoShaStore();
  try {
    rec(old, "verifier-failed", ".mstack/progress/review_storage-layer.md");
    rec(head, "test-verified", ".mstack/progress/review_storage-layer_r2.md");
    assert.deepEqual(problems(), []);
    assert.equal(cli(sb.store.root, ["gate"]).code, 0);
    assert.equal(cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]).code, 0);
  } finally {
    sb.dispose();
  }
});

test("an implementer's row at the older commit neither rejects nor answers anything at the closing sha", () => {
  const { sb, old, head, rec, problems } = twoShaStore();
  try {
    rec(old, "test-verified", ".mstack/progress/impl_storage-layer.md", "implementer");
    rec(head, "test-verified", ".mstack/progress/review_storage-layer.md");
    rec(old, "verifier-failed", ".mstack/progress/impl_storage-layer.md", "implementer");
    assert.deepEqual(problems(), []);
    assert.equal(cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]).code, 0);
  } finally {
    sb.dispose();
  }
});

test("an implementer's approval at the older commit does not answer a reviewer's rejection at the closing sha", () => {
  const { sb, old, head, rec, problems } = twoShaStore();
  try {
    rec(head, "verifier-failed", ".mstack/progress/review_storage-layer.md");
    rec(old, "test-verified", ".mstack/progress/impl_storage-layer.md", "implementer");
    const found = problems();
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.match(found[0]!.message, new RegExp(`verifier-failed at ${head.slice(0, 8)}`));
    assert.equal(cli(sb.store.root, ["state", "set", "storage-layer", "--status", "done"]).code, 2);
  } finally {
    sb.dispose();
  }
});
