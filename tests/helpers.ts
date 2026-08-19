import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

import { storeAt, type Store } from "../src/paths.ts";
import { Report } from "../src/report.ts";
import { setup } from "../src/setup.ts";

export interface Sandbox {
  readonly store: Store;
  readonly sha: string;
  /**
   * Another real commit, for a verdict that has gone stale.
   *
   * The ledger rejects a SHA that is not a commit in this repository — half of
   * "keyed by (target, sha)" was unvalidated, so forty zeros recorded fine and
   * read back indistinguishable from a real one. A stale verdict in the world
   * is a verdict against a commit that existed, so the fixtures use one.
   */
  commit(): string;
  writeState(state: unknown): void;
  dispose(): void;
}

export function sandbox(options: { git?: boolean } = {}): Sandbox {
  const root = mkdtempSync(join(tmpdir(), "mstack-test-"));
  if (options.git !== false) {
    const run = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
    run(["init", "-q"]);
    run(["config", "user.email", "test@example.com"]);
    run(["config", "user.name", "test"]);
    run(["commit", "-q", "--allow-empty", "-m", "init"]);
  }
  const quiet = console.log;
  console.log = () => {};
  try {
    setup(root);
  } finally {
    console.log = quiet;
  }
  const store = storeAt(root);
  const sha = options.git === false
    ? "0".repeat(40)
    : execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();

  return {
    store,
    sha,
    commit() {
      const run = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
      run(["commit", "-q", "--allow-empty", "-m", `commit ${Date.now()}`]);
      return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    },
    writeState(state: unknown) {
      writeFileSync(store.state, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    },
    dispose() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/**
 * Fill in `current.md` for a test whose subject is not `current.md`.
 *
 * The gate requires an active item to be reflected there, so a fixture that
 * activates an item and leaves the template in place is red for a reason that
 * has nothing to do with what the test is checking.
 */
export function trackCurrent(box: Sandbox, note = "carry on"): void {
  writeFileSync(
    box.store.current,
    `# Current session\n\n- **Item:** the one under test\n\n## Next step\n\n${note}\n`,
    "utf8",
  );
}

export function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    slug: "storage-layer",
    title: "Atomic JSON storage",
    acceptance: ["load() returns [] when the file is absent"],
    status: "pending",
    ...overrides,
  };
}

export function state(items: readonly unknown[], overrides: Record<string, unknown> = {}): unknown {
  return {
    version: 1,
    project: "sandbox",
    rules: { one_active_item: true, require_verdict_to_close: true, require_spec_for_sdd_items: true },
    items,
    ...overrides,
  };
}

/**
 * Assert that a gate rejected something *and said why*.
 *
 * Ported from enxvo's gate test helper, which checks both halves on purpose.
 * A check that returns non-zero while printing nothing is the "failed silently"
 * defect, and it is indistinguishable from a working gate right up until the
 * moment someone needs to know what broke.
 */
export function expectFail(report: Report, matcher: RegExp, label: string): void {
  assert.ok(report.failed, `${label}: expected a failure, got a pass`);
  assert.ok(
    report.failures.some((f) => matcher.test(f)),
    `${label}: failed silently. No message matched ${matcher}. Got: ${JSON.stringify(report.failures)}`,
  );
}

export function expectPass(report: Report, label: string): void {
  assert.ok(!report.failed, `${label}: expected a pass, got ${JSON.stringify(report.failures)}`);
}
