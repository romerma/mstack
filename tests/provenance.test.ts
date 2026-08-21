import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * CLI provenance, driven through the real launcher as a real process.
 *
 * The unit tests in gate.test.ts cover the check's logic; these cover the one
 * thing they cannot — that `bin/mstack` as actually shipped resolves its own
 * root, hands it to the check, and the whole pipeline agrees or disagrees on
 * paths the way a contributor's shell would. The trap under test was found at
 * exactly this level: a `which mstack` that resolved to the installed plugin
 * cache, whose gate printed PASSED over a store this checkout's gate calls
 * FAILED.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MSTACK = join(ROOT, "bin", "mstack");

function run(cwd: string, cli: string, args: readonly string[]) {
  return spawnSync(cli, [...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
}

function scratchRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "mstack-prov-"));
  const git = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
  git(["init", "-q"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "test"]);
  git(["commit", "-q", "--allow-empty", "-m", "init"]);
  return root;
}

/**
 * A store whose root is an mstack checkout: this repository's own launcher and
 * source, byte-copied into a scratch repo. Copied rather than symlinked on
 * purpose — the launcher resolves symlinks, so a symlinked copy would resolve
 * back here and stop being a *different* copy.
 */
function scratchCheckout(): string {
  const root = scratchRepo();
  cpSync(join(ROOT, "bin"), join(root, "bin"), { recursive: true });
  cpSync(join(ROOT, "src"), join(root, "src"), { recursive: true });
  const setup = run(root, join(root, "bin", "mstack"), ["setup"]);
  assert.equal(setup.status, 0, `setup failed: ${setup.stderr}`);
  return root;
}

test("inside a checkout, the checkout's own bin/mstack stays green and says which copy ran", () => {
  const root = scratchCheckout();
  try {
    const gate = run(root, join(root, "bin", "mstack"), ["gate"]);
    assert.equal(gate.status, 0, `own gate went red: ${gate.stdout}${gate.stderr}`);
    assert.match(gate.stdout, /store root is an mstack checkout.*its own \.\/bin\/mstack/, gate.stdout);
    assert.equal(gate.stderr, "", "the agreeing case has nothing to say on stderr");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a foreign copy's gate inside a checkout is exit 1, naming the copy that ran and the one to run", () => {
  // This repository's launcher, run against the scratch checkout's store, *is*
  // the mismatch: two different copies of the same plugin, one store. Before
  // the check existed this reported PASSED exit 0 with nothing on either
  // stream about being foreign — the exact shape of the cached-0.1.0 trap.
  const root = scratchCheckout();
  try {
    const gate = run(root, MSTACK, ["gate"]);
    assert.equal(gate.status, 1, `foreign gate stayed green: ${gate.stdout}`);
    assert.match(gate.stdout, /store's root is an mstack checkout/, gate.stdout);
    assert.ok(gate.stdout.includes(ROOT), `the failure names the copy that ran: ${gate.stdout}`);
    assert.ok(gate.stdout.includes(join(root, "bin", "mstack")), `the fix names the store's own launcher: ${gate.stdout}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("every other subcommand run by a foreign copy says so on stderr without changing its result", () => {
  const root = scratchCheckout();
  try {
    const list = run(root, MSTACK, ["state", "list"]);
    assert.equal(list.status, 0, `state list broke: ${list.stderr}`);
    assert.match(list.stderr, /mstack: note: .*mstack checkout/, "the note is the only new output");
    assert.match(list.stderr, /prefer .*bin\/mstack/, list.stderr);
    assert.ok(!list.stdout.includes("note:"), "stdout stays machine-consumable");

    // The store's own copy has nothing to note.
    const own = run(root, join(root, "bin", "mstack"), ["state", "list"]);
    assert.equal(own.status, 0, own.stderr);
    assert.equal(own.stderr, "", `own copy noted itself: ${own.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an ordinary repository sees none of it: no gate line, no stderr note, exit 0", () => {
  // The constraint proven both ways: the plugin CLI is *supposed* to be
  // foreign in a user's repo, so a store created there by this checkout's own
  // `setup` must stay exactly as quiet as it was before the check existed.
  const root = scratchRepo();
  try {
    const setup = run(root, MSTACK, ["setup"]);
    assert.equal(setup.status, 0, setup.stderr);
    assert.ok(!setup.stderr.includes("note:"), `setup noted a user repo: ${setup.stderr}`);

    const gate = run(root, MSTACK, ["gate"]);
    assert.equal(gate.status, 0, `gate went red in a user repo: ${gate.stdout}`);
    assert.ok(!gate.stdout.includes("checkout"), `provenance fired in a user repo: ${gate.stdout}`);

    const list = run(root, MSTACK, ["state", "list"]);
    assert.equal(list.status, 0, list.stderr);
    assert.equal(list.stderr, "", `a note reached a user repo: ${list.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("version prints the running copy's manifest version and its resolved root, store or no store", () => {
  // The path is the load-bearing half: two copies have already been observed
  // sharing "0.1.0" while their gates disagreed on an exit code, so the line
  // exists to make "which binary produced this" answerable from a transcript.
  const bare = mkdtempSync(join(tmpdir(), "mstack-prov-bare-"));
  try {
    const version = run(bare, MSTACK, ["version"]);
    assert.equal(version.status, 0, `version needed a store: ${version.stderr}`);
    assert.match(version.stdout, /^mstack \S+ at (.+)$/m, version.stdout);
    assert.ok(version.stdout.trim().endsWith(ROOT), `the root is this checkout: ${version.stdout}`);

    const flagged = run(bare, MSTACK, ["version", "--extra"]);
    assert.notEqual(flagged.status, 0, "version takes no arguments");
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});
